-- ============================================================================
-- Phase 8C-Shared-CP2b — Fuzzy ingredient search RPC + pg_trgm extension
-- ============================================================================
-- Run this entire file in Supabase Dashboard SQL Editor BEFORE handing the
-- CP2b prompt to CC. This adds the schema substrate for the autocomplete:
--
--   1. Enables pg_trgm extension (PostgreSQL trigram similarity matching)
--   2. Creates GIN trigram index on ingredients.name + plural_name for query speed
--   3. Creates search_ingredients() RPC function combining substring + similarity matching
--
-- Why an RPC:  PostgREST's filter syntax doesn't support similarity() functions
-- in WHERE clauses or ORDER BY similarity scores. RPC keeps the query logic
-- server-side and exposes a clean callable interface to the client.
--
-- Why pg_trgm:  Tom's smoke-test discovery — typing "corriander" (one extra 'r',
-- common misspelling) returned zero results from a substring-only search.
-- Trigram similarity tolerates small typos by comparing 3-character n-grams
-- between the query and target strings. Two strings that share most trigrams
-- score high; one-character typos preserve most trigrams.
--
-- Pre-flight check (run this FIRST to see if pg_trgm is already enabled):
--   SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
--   - If returns 1 row: skip Section 1 (extension already enabled)
--   - If returns 0 rows: run all sections in order
-- ============================================================================

-- ============================================================================
-- 1. Enable pg_trgm extension
-- ============================================================================
-- IF NOT EXISTS makes this idempotent. No-op if already enabled.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 2. GIN trigram indexes on ingredients.name + plural_name
-- ============================================================================
-- These accelerate similarity-based queries from O(n) full-table scans to
-- O(log n) index lookups. ingredients table is small enough (~1500 rows) that
-- the speedup is modest, but the indexes also accelerate ILIKE queries for
-- substring matching.

CREATE INDEX IF NOT EXISTS idx_ingredients_name_trgm
ON ingredients USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ingredients_plural_name_trgm
ON ingredients USING gin (plural_name gin_trgm_ops);

-- ============================================================================
-- 3. search_ingredients() RPC function
-- ============================================================================
-- Combines two passes:
--   • Pass 1 (substring match via ILIKE): exact-substring hits get score = 1.0
--     and surface first. Handles correctly-spelled queries optimally.
--   • Pass 2 (similarity match via pg_trgm): catches typos. Threshold 0.3 is a
--     good balance — too low (0.1) returns noise; too high (0.5) misses single-
--     character typos in short words.
--
-- Returns top 20 results ordered by score DESC. Sufficient for an autocomplete
-- dropdown; if the user's intended ingredient isn't in the top 20, they need a
-- different query.
--
-- Returns the joined fields the autocomplete UI needs (no separate query
-- required by the client to display ingredients).

CREATE OR REPLACE FUNCTION search_ingredients(query_text TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  plural_name TEXT,
  family TEXT,
  ingredient_type TEXT,
  typical_unit TEXT,
  typical_store_section TEXT,
  score REAL
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    i.id,
    i.name,
    i.plural_name,
    i.family,
    i.ingredient_type,
    i.typical_unit,
    i.typical_store_section,
    GREATEST(
      CASE WHEN i.name ILIKE '%' || query_text || '%' THEN 1.0 ELSE 0.0 END,
      CASE WHEN i.plural_name ILIKE '%' || query_text || '%' THEN 1.0 ELSE 0.0 END,
      similarity(i.name, query_text),
      similarity(COALESCE(i.plural_name, ''), query_text)
    ) AS score
  FROM ingredients i
  WHERE
    i.name ILIKE '%' || query_text || '%'
    OR i.plural_name ILIKE '%' || query_text || '%'
    OR similarity(i.name, query_text) > 0.3
    OR similarity(COALESCE(i.plural_name, ''), query_text) > 0.3
  ORDER BY score DESC, i.name ASC
  LIMIT 20;
$$;

COMMENT ON FUNCTION search_ingredients(TEXT) IS
'Phase 8C-Shared-CP2b. Fuzzy ingredient autocomplete combining substring (ILIKE) + trigram similarity. Substring hits score 1.0; similarity hits score 0.3-1.0. Top 20 by score DESC then name ASC. Used by GroceryListDetailScreen add-item sheet for typo-tolerant ingredient lookup.';

-- ============================================================================
-- 4. RLS — search_ingredients function security
-- ============================================================================
-- ingredients table is publicly readable per existing RLS — the function
-- inherits that. Authenticated users only by default (Supabase exposes RPCs
-- to authenticated role unless explicitly granted otherwise).

GRANT EXECUTE ON FUNCTION search_ingredients(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_ingredients(TEXT) TO anon;

-- ============================================================================
-- 5. Post-migration verification queries (run manually to confirm)
-- ============================================================================

-- Verify pg_trgm extension enabled
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';
-- Expected: 1 row, extname = 'pg_trgm'

-- Verify trigram indexes exist
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE tablename = 'ingredients' AND indexname LIKE '%_trgm';
-- Expected: 2 rows

-- Verify function exists with correct signature
-- SELECT proname, pg_get_function_arguments(oid) AS args, pg_get_function_result(oid) AS returns
-- FROM pg_proc WHERE proname = 'search_ingredients';
-- Expected: 1 row, args = 'query_text text', returns = 'TABLE(id uuid, name text, ...)'

-- Smoke-test substring path: should return "Coriander" and similar
-- SELECT name, score FROM search_ingredients('coriander') LIMIT 5;
-- Expected: top result includes 'Coriander' or similar with score = 1.0

-- Smoke-test typo path: should return "Coriander" via similarity
-- SELECT name, score FROM search_ingredients('corriander') LIMIT 5;
-- Expected: top result includes 'Coriander' with score 0.4-0.7

-- Smoke-test no-match path: should return empty
-- SELECT name, score FROM search_ingredients('xyzzyxabc') LIMIT 5;
-- Expected: 0 rows

-- ============================================================================
-- ROLLBACK (DO NOT RUN unless migration needs to be reversed)
-- ============================================================================
-- BEGIN;
--
-- DROP FUNCTION IF EXISTS search_ingredients(TEXT);
-- DROP INDEX IF EXISTS idx_ingredients_plural_name_trgm;
-- DROP INDEX IF EXISTS idx_ingredients_name_trgm;
-- -- Note: do NOT drop pg_trgm extension on rollback — other parts of the app
-- -- (or future migrations) may depend on it.
--
-- COMMIT;
