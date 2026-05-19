-- ============================================
-- FRIGO — CP6e-SmokeFix-SF3 · search_supplies tsquery prefix wildcard
-- ============================================
-- Closes the partial-word regression surfaced in CP6e closeout smoke
-- (SF-3 in docs/archive/sessions/CP6e_SMOKE_FINDINGS_2026-05-14.md).
--
-- Before: tokens were passed to to_tsquery() as complete lexemes. The
--   'simple' dictionary doesn't stem, so 'oliv' wouldn't match the tsvector
--   lexeme 'olive' — the user had to type the full word.
--
-- After: each synonym in the expanded-tokens list gets ':*' appended, which
--   tells to_tsquery to match any tsvector lexeme starting with that token.
--   'oliv:*' matches 'olive', 'olives', 'olive_oil', etc.
--
-- Signature unchanged. Return shape unchanged. Triggers, RLS, indexes
-- untouched. The client-side substring matcher in
-- lib/utils/lotSearch.computeSupplySearchMatch was already substring-based
-- and doesn't need a change.
--
-- The :* qualifier is safe at the language layer because:
--   • The SuppliesSection debounced effect gates server search at query
--     length >= 2; single-character prefix wildcards (which would match
--     huge swaths of the tsvector) can't reach the RPC.
--   • Lexeme starting-with semantics are bounded by lexeme — not by full
--     token concatenations — so 'oliv:*' won't accidentally match
--     'eaten-olive' (the dictionary tokenizes that as separate lexemes).
-- ============================================

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

  -- Expand each token via storage synonyms; build a per-token
  -- "(synonym1:* | synonym2:* | ...)" term.
  --
  -- SF-3 (2026-05-14): the :* prefix-wildcard suffix is the only change vs
  -- the original CP6e-Schema body. Without it, 'oliv' fails to match the
  -- lexeme 'olive' under the 'simple' dictionary (no stemming).
  FOR raw_token IN SELECT unnest(tokens)
  LOOP
    expanded_synonyms := expand_storage_synonyms(raw_token);
    expanded_tokens := array_append(
      expanded_tokens,
      '(' || array_to_string(
        ARRAY(SELECT t || ':*' FROM unnest(expanded_synonyms) AS t),
        ' | '
      ) || ')'
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
  'D8R-Q56-Q57. Multi-token AND search across supply + lot dimensions, with storage synonym expansion. SF-3 (2026-05-14) added :* prefix-wildcard per token for partial-word matching.';


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run after applying. Replace the UUID with your space_id.
--
-- SELECT * FROM search_supplies('oliv', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
-- Expected: at least one row if an 'olive'-prefixed supply exists.
--
-- SELECT * FROM search_supplies('ket', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
-- Expected: ketchup supply (or similar) returned.
--
-- Regression check — full-word still works:
-- SELECT * FROM search_supplies('ketchup', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
--
-- Multi-token AND with partial prefixes:
-- SELECT * FROM search_supplies('oliv oil', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
--
-- Synonym expansion still works:
-- SELECT * FROM search_supplies('frozen', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
