-- ============================================
-- FRIGO — CP6e-Schema migration
-- ============================================
-- Adds lot-tracking foundation to Phase 8R/CP6e
--
-- Includes:
--   1. supplies.tracks_lots flag
--   2. supply_lots table (with all fields per D8R-Q46)
--   3. tsvector + GIN indexes on supplies & supply_lots
--   4. Triggers maintaining tsvectors from joined data
--   5. search_supplies(query_text, p_space_id) RPC
--   6. RLS policies for supply_lots
--   7. Backfill of supply tsvectors (no lots to backfill — net new)
--
-- All statements idempotent. Safe to re-run.
--
-- DRY-RUN STRATEGY:
--   Wrap the whole script in:  BEGIN; <script>; ROLLBACK;
--   This executes everything, then undoes it. Verify the validation
--   queries at the bottom return expected counts inside the transaction
--   (move them ABOVE the ROLLBACK), then re-run with COMMIT instead.
-- ============================================


-- ============================================
-- SECTION 1 — supplies.tracks_lots flag
-- ============================================

ALTER TABLE supplies
  ADD COLUMN IF NOT EXISTS tracks_lots BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_supplies_tracks_lots_active
  ON supplies(tracks_lots)
  WHERE tracks_lots = true AND archived_at IS NULL;

COMMENT ON COLUMN supplies.tracks_lots IS
  'D8R-Q43. When true, supply tracks individual lots in supply_lots table. When false (default), supply uses status-only tracking via usage_level.';


-- ============================================
-- SECTION 2 — supply_lots table
-- ============================================

CREATE TABLE IF NOT EXISTS supply_lots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id       UUID NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,

  -- Quantity
  quantity        NUMERIC(10, 3) NOT NULL,
  quantity_unit   TEXT NOT NULL,

  -- Where & when
  storage_location TEXT NOT NULL,
  acquired_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NULL,
  expires_at_overridden BOOLEAN NOT NULL DEFAULT false,

  -- Variant + brand + notes (all optional)
  variant_label   TEXT NULL,
  brand           TEXT NULL,
  notes           TEXT NULL,

  -- Soft-delete on consume
  consumed_at     TIMESTAMPTZ NULL,

  -- Search
  search_vector   TSVECTOR,

  -- Standard
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Storage check matches supplies.storage_location_check
ALTER TABLE supply_lots DROP CONSTRAINT IF EXISTS supply_lots_storage_location_check;
ALTER TABLE supply_lots ADD CONSTRAINT supply_lots_storage_location_check
  CHECK (storage_location IN ('fridge', 'freezer', 'pantry', 'counter'));

-- Quantity must be non-negative; zero = consumed (auto-archive trigger sets consumed_at)
ALTER TABLE supply_lots DROP CONSTRAINT IF EXISTS supply_lots_quantity_nonneg_check;
ALTER TABLE supply_lots ADD CONSTRAINT supply_lots_quantity_nonneg_check
  CHECK (quantity >= 0);

-- Active lot indexing — all the perf-sensitive queries filter on consumed_at IS NULL
CREATE INDEX IF NOT EXISTS idx_supply_lots_supply_active
  ON supply_lots(supply_id)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_supply_lots_expires_active
  ON supply_lots(expires_at)
  WHERE consumed_at IS NULL AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supply_lots_storage_active
  ON supply_lots(storage_location)
  WHERE consumed_at IS NULL;

-- updated_at maintenance — reuse existing trigger function if present
CREATE OR REPLACE FUNCTION set_supply_lots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supply_lots_updated_at ON supply_lots;
CREATE TRIGGER trg_supply_lots_updated_at
  BEFORE UPDATE ON supply_lots
  FOR EACH ROW
  EXECUTE FUNCTION set_supply_lots_updated_at();

COMMENT ON TABLE supply_lots IS
  'D8R-Q43-Q48. Individual physical lots tracked per supply when supplies.tracks_lots = true.';
COMMENT ON COLUMN supply_lots.expires_at_overridden IS
  'D8R-Q47. When true, expires_at was user-set and storage moves should NOT recompute it.';
COMMENT ON COLUMN supply_lots.consumed_at IS
  'D8R-Q48. Soft-delete on full consumption. Active queries filter consumed_at IS NULL.';


-- ============================================
-- SECTION 3 — RLS policies on supply_lots
-- ============================================
-- Mirrors the supplies table policies: lots are accessible to space members.

ALTER TABLE supply_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supply_lots_select_space_member" ON supply_lots;
CREATE POLICY "supply_lots_select_space_member" ON supply_lots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM supplies s
      JOIN space_members sm ON sm.space_id = s.space_id
      WHERE s.id = supply_lots.supply_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "supply_lots_insert_space_member" ON supply_lots;
CREATE POLICY "supply_lots_insert_space_member" ON supply_lots
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM supplies s
      JOIN space_members sm ON sm.space_id = s.space_id
      WHERE s.id = supply_lots.supply_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "supply_lots_update_space_member" ON supply_lots;
CREATE POLICY "supply_lots_update_space_member" ON supply_lots
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM supplies s
      JOIN space_members sm ON sm.space_id = s.space_id
      WHERE s.id = supply_lots.supply_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "supply_lots_delete_space_member" ON supply_lots;
CREATE POLICY "supply_lots_delete_space_member" ON supply_lots
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM supplies s
      JOIN space_members sm ON sm.space_id = s.space_id
      WHERE s.id = supply_lots.supply_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );


-- ============================================
-- SECTION 4 — supplies.search_vector + GIN + trigger
-- ============================================
-- Composite tsvector built from joined data. Stored, not generated, because
-- it depends on JOIN to ingredients and tags — generated columns can't reference
-- other tables.

ALTER TABLE supplies
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

CREATE INDEX IF NOT EXISTS idx_supplies_search_vector
  ON supplies USING GIN (search_vector);

CREATE OR REPLACE FUNCTION supplies_compute_search_vector(p_supply_id UUID)
RETURNS TSVECTOR AS $$
DECLARE
  result TSVECTOR;
BEGIN
  SELECT
    setweight(to_tsvector('simple', COALESCE(s.custom_name, '')),                    'A') ||
    setweight(to_tsvector('simple', COALESCE(i.name, '')),                            'A') ||
    setweight(to_tsvector('simple', COALESCE(i.plural_name, '')),                    'A') ||
    setweight(to_tsvector('simple', COALESCE(i.family, '')),                          'B') ||
    setweight(to_tsvector('simple', COALESCE(i.ingredient_type, '')),                 'B') ||
    setweight(to_tsvector('simple',
      COALESCE(
        (SELECT string_agg(t.value, ' ')
         FROM supply_tags st
         JOIN tags t ON t.id = st.tag_id
         WHERE st.supply_id = s.id),
        '')),                                                                        'C')
  INTO result
  FROM supplies s
  LEFT JOIN ingredients i ON i.id = s.ingredient_id
  WHERE s.id = p_supply_id;

  RETURN COALESCE(result, ''::tsvector);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION supplies_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := supplies_compute_search_vector(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplies_search_vector ON supplies;
CREATE TRIGGER trg_supplies_search_vector
  BEFORE INSERT OR UPDATE OF custom_name, ingredient_id ON supplies
  FOR EACH ROW
  EXECUTE FUNCTION supplies_search_vector_trigger();

-- Refresh trigger when joined data changes — fires on ingredients UPDATE
CREATE OR REPLACE FUNCTION supplies_refresh_on_ingredient_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.name IS DISTINCT FROM OLD.name OR
      NEW.plural_name IS DISTINCT FROM OLD.plural_name OR
      NEW.family IS DISTINCT FROM OLD.family OR
      NEW.ingredient_type IS DISTINCT FROM OLD.ingredient_type) THEN
    UPDATE supplies
    SET search_vector = supplies_compute_search_vector(id)
    WHERE ingredient_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplies_refresh_on_ingredient_change ON ingredients;
CREATE TRIGGER trg_supplies_refresh_on_ingredient_change
  AFTER UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION supplies_refresh_on_ingredient_change();

-- Refresh trigger when supply_tags changes
CREATE OR REPLACE FUNCTION supplies_refresh_on_supply_tag_change()
RETURNS TRIGGER AS $$
DECLARE
  affected_supply UUID;
BEGIN
  affected_supply := COALESCE(NEW.supply_id, OLD.supply_id);
  IF affected_supply IS NOT NULL THEN
    UPDATE supplies
    SET search_vector = supplies_compute_search_vector(id)
    WHERE id = affected_supply;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplies_refresh_on_supply_tag_change ON supply_tags;
CREATE TRIGGER trg_supplies_refresh_on_supply_tag_change
  AFTER INSERT OR DELETE ON supply_tags
  FOR EACH ROW
  EXECUTE FUNCTION supplies_refresh_on_supply_tag_change();


-- ============================================
-- SECTION 5 — supply_lots.search_vector + GIN + trigger
-- ============================================

CREATE INDEX IF NOT EXISTS idx_supply_lots_search_vector
  ON supply_lots USING GIN (search_vector);

CREATE OR REPLACE FUNCTION supply_lots_compute_search_vector(
  p_variant_label TEXT,
  p_brand TEXT,
  p_notes TEXT,
  p_storage_location TEXT
)
RETURNS TSVECTOR AS $$
BEGIN
  RETURN
    setweight(to_tsvector('simple', COALESCE(p_variant_label, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_brand, '')),         'A') ||
    setweight(to_tsvector('simple', COALESCE(p_notes, '')),         'B') ||
    setweight(to_tsvector('simple', COALESCE(p_storage_location, '')), 'C');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION supply_lots_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := supply_lots_compute_search_vector(
    NEW.variant_label,
    NEW.brand,
    NEW.notes,
    NEW.storage_location
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supply_lots_search_vector ON supply_lots;
CREATE TRIGGER trg_supply_lots_search_vector
  BEFORE INSERT OR UPDATE OF variant_label, brand, notes, storage_location ON supply_lots
  FOR EACH ROW
  EXECUTE FUNCTION supply_lots_search_vector_trigger();


-- ============================================
-- SECTION 6 — Storage synonym map (reusable)
-- ============================================
-- Static map; expanded into the search query at RPC time. D8R-Q58.

CREATE OR REPLACE FUNCTION expand_storage_synonyms(p_token TEXT)
RETURNS TEXT[] AS $$
BEGIN
  RETURN CASE LOWER(p_token)
    WHEN 'frozen'        THEN ARRAY['frozen', 'freezer']
    WHEN 'freezer'       THEN ARRAY['freezer', 'frozen']
    WHEN 'fridge'        THEN ARRAY['fridge', 'refrigerated', 'cold']
    WHEN 'refrigerated'  THEN ARRAY['refrigerated', 'fridge', 'cold']
    WHEN 'cold'          THEN ARRAY['cold', 'fridge', 'refrigerated']
    WHEN 'shelf'         THEN ARRAY['shelf', 'pantry', 'cupboard']
    WHEN 'cupboard'      THEN ARRAY['cupboard', 'pantry', 'shelf']
    WHEN 'pantry'        THEN ARRAY['pantry', 'shelf', 'cupboard']
    WHEN 'counter'       THEN ARRAY['counter', 'room', 'temp']
    ELSE ARRAY[p_token]
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================
-- SECTION 7 — search_supplies RPC
-- ============================================
-- Multi-token AND across supply tsvector OR any-of-supply's-lots' tsvectors.
-- Returns supply IDs ordered by match relevance.
--
-- Each token must match at least one of:
--   - the supply's tsvector
--   - ANY of the supply's active lots' tsvectors
--
-- A supply is returned if every token matches at least one of those.
--
-- Storage synonym expansion: each token expanded via expand_storage_synonyms,
-- joined with " | " in the tsquery so any synonym hits.

DROP FUNCTION IF EXISTS search_supplies(TEXT, UUID);
CREATE OR REPLACE FUNCTION search_supplies(
  query_text TEXT,
  p_space_id UUID
)
RETURNS TABLE (
  supply_id UUID,
  rank REAL,
  match_count INTEGER
) AS $$
DECLARE
  tokens TEXT[];
  expanded_tokens TEXT[] := ARRAY[]::TEXT[];
  raw_token TEXT;
  expanded_synonyms TEXT[];
  ts_query_str TEXT;
BEGIN
  -- Tokenize: split on whitespace, lowercase, strip empties
  tokens := regexp_split_to_array(LOWER(TRIM(query_text)), '\s+');
  tokens := ARRAY(SELECT t FROM unnest(tokens) AS t WHERE t <> '');

  IF array_length(tokens, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Expand each token via storage synonyms; build a per-token "synonym1 | synonym2 | ..." term
  FOR raw_token IN SELECT unnest(tokens)
  LOOP
    expanded_synonyms := expand_storage_synonyms(raw_token);
    expanded_tokens := array_append(
      expanded_tokens,
      '(' || array_to_string(expanded_synonyms, ' | ') || ')'
    );
  END LOOP;

  -- AND across tokens — full tsquery string
  ts_query_str := array_to_string(expanded_tokens, ' & ');

  RETURN QUERY
  WITH supply_matches AS (
    -- Direct matches against supply's own search_vector
    SELECT
      s.id AS supply_id,
      ts_rank(s.search_vector, to_tsquery('simple', ts_query_str)) AS rank,
      1 AS source_kind
    FROM supplies s
    WHERE s.space_id = p_space_id
      AND s.archived_at IS NULL
      AND s.search_vector @@ to_tsquery('simple', ts_query_str)

    UNION ALL

    -- Indirect matches via any active lot
    SELECT DISTINCT ON (s.id)
      s.id AS supply_id,
      ts_rank(sl.search_vector, to_tsquery('simple', ts_query_str)) AS rank,
      2 AS source_kind
    FROM supplies s
    JOIN supply_lots sl ON sl.supply_id = s.id
    WHERE s.space_id = p_space_id
      AND s.archived_at IS NULL
      AND sl.consumed_at IS NULL
      AND sl.search_vector @@ to_tsquery('simple', ts_query_str)
  ),
  union_partial AS (
    -- Now match the FULL query against UNION of supply + lot vectors per supply.
    -- Without this, we'd return supplies where SOME tokens match supply and OTHERS
    -- match a lot — the AND across tokens needs to be evaluated against the union.
    --
    -- Approach: for each supply in supply_matches, build a synthetic
    -- combined vector and re-test the query.
    SELECT
      s.id AS supply_id,
      (
        s.search_vector ||
        COALESCE(
          (SELECT setweight(to_tsvector('simple',
                  string_agg(
                    COALESCE(sl.variant_label, '') || ' ' ||
                    COALESCE(sl.brand, '')         || ' ' ||
                    COALESCE(sl.notes, '')         || ' ' ||
                    COALESCE(sl.storage_location, ''),
                    ' '
                  )), 'A')
           FROM supply_lots sl
           WHERE sl.supply_id = s.id AND sl.consumed_at IS NULL),
          ''::tsvector
        )
      ) AS combined_vector
    FROM supplies s
    WHERE s.space_id = p_space_id
      AND s.archived_at IS NULL
      AND s.id IN (SELECT supply_id FROM supply_matches)
  )
  SELECT
    up.supply_id,
    ts_rank(up.combined_vector, to_tsquery('simple', ts_query_str))::REAL AS rank,
    1 AS match_count  -- placeholder; per-dimension match counts can be computed client-side from results
  FROM union_partial up
  WHERE up.combined_vector @@ to_tsquery('simple', ts_query_str)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

COMMENT ON FUNCTION search_supplies(TEXT, UUID) IS
  'D8R-Q56-Q57. Multi-token AND search across supply + lot dimensions, with storage synonym expansion.';


-- ============================================
-- SECTION 8 — BACKFILL — initial supply search vectors
-- ============================================

UPDATE supplies
SET search_vector = supplies_compute_search_vector(id)
WHERE search_vector IS NULL;

-- supply_lots starts empty, no backfill needed there.


-- ============================================
-- VALIDATION QUERIES
-- ============================================
-- Run these after the migration. Move them ABOVE a ROLLBACK to dry-run.

-- 1. Confirm supplies.tracks_lots column
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'supplies' AND column_name = 'tracks_lots';
-- Expected: 1 row, BOOLEAN, NOT NULL, default 'false'.

-- 2. Confirm supply_lots table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'supply_lots'
ORDER BY ordinal_position;
-- Expected: 14 rows (id, supply_id, quantity, quantity_unit, storage_location,
--   acquired_at, expires_at, expires_at_overridden, variant_label, brand,
--   notes, consumed_at, search_vector, created_by, created_at, updated_at).
-- Note: 16 actual rows. Recount as you scroll.

-- 3. Confirm CHECK constraints on supply_lots
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name LIKE 'supply_lots_%';
-- Expected: 2 rows (storage_location_check, quantity_nonneg_check).
-- (PK constraint not listed here; that's a different constraint type.)

-- 4. Confirm indexes
SELECT indexname FROM pg_indexes
WHERE tablename IN ('supplies', 'supply_lots')
  AND (indexname LIKE 'idx_supplies_tracks_lots%'
    OR indexname LIKE 'idx_supplies_search%'
    OR indexname LIKE 'idx_supply_lots_%');
-- Expected: at least 6 (tracks_lots_active, supplies_search_vector,
--   supply_active, expires_active, storage_active, search_vector).

-- 5. Confirm RLS policies on supply_lots
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'supply_lots'
ORDER BY cmd, policyname;
-- Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE).

-- 6. Confirm RPC exists and is callable
SELECT proname, pronargs, prorettype::regtype
FROM pg_proc
WHERE proname = 'search_supplies';
-- Expected: 1 row, pronargs=2, returns SETOF record (RECORD/TABLE).

-- 7. Confirm tsvector backfill on supplies
SELECT
  COUNT(*) FILTER (WHERE search_vector IS NULL) AS null_vectors,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL AND search_vector <> ''::tsvector) AS populated_vectors,
  COUNT(*) AS total
FROM supplies
WHERE archived_at IS NULL;
-- Expected: null_vectors = 0; populated_vectors close to total (rows with no
--   ingredient AND no custom_name AND no tags will have empty tsvector — rare).

-- 8. Smoke-test the RPC with a known query
-- Replace YOUR_SPACE_ID with your actual space_id UUID.
-- SELECT * FROM search_supplies('chicken', 'YOUR_SPACE_ID') LIMIT 5;
-- Expected: returns supply IDs whose name/family/etc. match "chicken" — likely
--   just a couple of supplies before lots data exists.

-- 9. Smoke-test storage synonym expansion
SELECT expand_storage_synonyms('frozen') AS frozen_synonyms,
       expand_storage_synonyms('fridge') AS fridge_synonyms,
       expand_storage_synonyms('xyz')    AS unmapped_synonyms;
-- Expected:
--   frozen_synonyms = {frozen,freezer}
--   fridge_synonyms = {fridge,refrigerated,cold}
--   unmapped_synonyms = {xyz}

-- 10. Smoke-test trigger maintenance — UPDATE a supply, confirm vector refreshes
-- BEGIN;
-- UPDATE supplies SET custom_name = custom_name || ' test' WHERE id = (SELECT id FROM supplies LIMIT 1);
-- SELECT search_vector FROM supplies WHERE id = (SELECT id FROM supplies LIMIT 1);
-- ROLLBACK;
-- Expected: tsvector contains "test".


-- ============================================
-- ROLLBACK NOTES (if needed manually)
-- ============================================
-- DROP FUNCTION IF EXISTS search_supplies(TEXT, UUID);
-- DROP FUNCTION IF EXISTS expand_storage_synonyms(TEXT);
-- DROP TRIGGER IF EXISTS trg_supply_lots_search_vector ON supply_lots;
-- DROP FUNCTION IF EXISTS supply_lots_search_vector_trigger();
-- DROP FUNCTION IF EXISTS supply_lots_compute_search_vector(TEXT, TEXT, TEXT, TEXT);
-- DROP TRIGGER IF EXISTS trg_supplies_refresh_on_supply_tag_change ON supply_tags;
-- DROP FUNCTION IF EXISTS supplies_refresh_on_supply_tag_change();
-- DROP TRIGGER IF EXISTS trg_supplies_refresh_on_ingredient_change ON ingredients;
-- DROP FUNCTION IF EXISTS supplies_refresh_on_ingredient_change();
-- DROP TRIGGER IF EXISTS trg_supplies_search_vector ON supplies;
-- DROP FUNCTION IF EXISTS supplies_search_vector_trigger();
-- DROP FUNCTION IF EXISTS supplies_compute_search_vector(UUID);
-- DROP INDEX IF EXISTS idx_supplies_search_vector;
-- ALTER TABLE supplies DROP COLUMN IF EXISTS search_vector;
-- DROP TABLE IF EXISTS supply_lots CASCADE;
-- ALTER TABLE supplies DROP COLUMN IF EXISTS tracks_lots;
