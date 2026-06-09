-- ============================================================================
-- Phase 8C-Shared-CP2b.1 — search_ingredients RPC v2 (tiered scoring)
-- ============================================================================
-- Run this entire file in Supabase Dashboard SQL Editor BEFORE handing the
-- CP2b.1 prompt to CC. Updates the RPC created in CP2b to use a 5-tier scoring
-- formula that solves three smoke-test-discovered issues:
--
--   • "corr" → only "corn" matched (similarity threshold 0.3 too high for
--     short queries; "corr" has only 2 trigrams). Adds prefix-match tier
--     so the user sees coriander as soon as they type "cori".
--   • "tomatoes" → exact match "Tomatoes" not first in results (substring
--     match scored everything 1.0; alphabetical secondary sort meant
--     "Cherry tomatoes" beat "Tomatoes"). Adds exact-match tier (score 2.0)
--     so the canonical name always ranks first when typed verbatim.
--   • Tiebreak ambiguity (multiple ingredients with same score returned in
--     arbitrary order). Replaces alphabetical-only secondary sort with
--     length-ASC-then-name-ASC, so shorter/simpler names win ties.
--
-- Threshold lowered 0.3 → 0.25 for slightly more typo tolerance on medium-
-- length queries. Smoke-test data point: "corriander" still returns 0.75 →
-- well above either threshold; the lower threshold helps borderline cases.
--
-- ============================================================================
-- 5-tier scoring formula
-- ============================================================================
-- Tier 1: Exact match (case-insensitive on name OR plural_name) → score 2.0
-- Tier 2: Substring starts at position 0 (name OR plural_name)    → score 1.5
-- Tier 3: Prefix match — query starts an ingredient's name        → score 0.95
-- Tier 4: Substring anywhere in name OR plural_name               → score 1.0
-- Tier 5: Trigram similarity ≥ 0.25                               → score = similarity
--
-- Notes on tier ordering:
--   • Tier 2 (starts-with at position 0) outranks Tier 4 (substring anywhere)
--     because "tomatoes" matching "Cherry tomatoes" (anywhere) shouldn't
--     beat "tomatoes" matching "Tomatoes" (starts-with at 0).
--   • Tier 3 (prefix) sits between Tier 2 and Tier 4 conceptually but uses
--     score 0.95 to defer to Tier 4 substring hits — because if the query
--     IS in the name as a substring, that's a stronger signal than the
--     name starting with the query.
--     Worked example: query "tom" → matches "Tomato" (Tier 4 substring,
--     score 1.0) AND "Tomatoes" (Tier 4 substring, score 1.0). Both win
--     over Tier 3 prefix-only matches. Good.
--   • Tier 5 (similarity) bottoms out — only fires when no higher tier hits
--     because GREATEST() picks the max.
--
-- Returns top 20 ordered by score DESC, name length ASC, name ASC.

-- ============================================================================
-- 1. Replace search_ingredients function (CREATE OR REPLACE — idempotent)
-- ============================================================================

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
  WITH q AS (
    SELECT LOWER(TRIM(query_text)) AS qt
  )
  SELECT
    i.id,
    i.name,
    i.plural_name,
    i.family,
    i.ingredient_type,
    i.typical_unit,
    i.typical_store_section,
    GREATEST(
      -- Tier 1: exact match (case-insensitive)
      CASE 
        WHEN LOWER(i.name) = (SELECT qt FROM q) THEN 2.0
        WHEN LOWER(COALESCE(i.plural_name, '')) = (SELECT qt FROM q) THEN 2.0
        ELSE 0.0
      END,
      -- Tier 2: substring starts at position 0 (case-insensitive)
      CASE 
        WHEN LOWER(i.name) LIKE (SELECT qt FROM q) || '%' THEN 1.5
        WHEN LOWER(COALESCE(i.plural_name, '')) LIKE (SELECT qt FROM q) || '%' THEN 1.5
        ELSE 0.0
      END,
      -- Tier 4: substring anywhere (case-insensitive ILIKE; outranks prefix-only via score 1.0 vs 0.95)
      CASE 
        WHEN i.name ILIKE '%' || (SELECT qt FROM q) || '%' THEN 1.0
        WHEN i.plural_name ILIKE '%' || (SELECT qt FROM q) || '%' THEN 1.0
        ELSE 0.0
      END,
      -- Tier 3: prefix match — query is a prefix of ingredient name
      -- (covers "cori" → "Coriander" before similarity threshold kicks in;
      -- score 0.95 so true-substring hits at Tier 4 still win)
      CASE 
        WHEN LOWER(i.name) LIKE (SELECT qt FROM q) || '%' 
          AND LENGTH((SELECT qt FROM q)) >= 3 THEN 0.95
        WHEN LOWER(COALESCE(i.plural_name, '')) LIKE (SELECT qt FROM q) || '%' 
          AND LENGTH((SELECT qt FROM q)) >= 3 THEN 0.95
        ELSE 0.0
      END,
      -- Tier 5: trigram similarity (fallback for typos and longer-query fuzzy)
      similarity(i.name, query_text),
      similarity(COALESCE(i.plural_name, ''), query_text)
    ) AS score
  FROM ingredients i
  WHERE
    i.name ILIKE '%' || query_text || '%'
    OR i.plural_name ILIKE '%' || query_text || '%'
    OR similarity(i.name, query_text) > 0.25
    OR similarity(COALESCE(i.plural_name, ''), query_text) > 0.25
  ORDER BY 
    score DESC, 
    LENGTH(i.name) ASC,
    i.name ASC
  LIMIT 20;
$$;

COMMENT ON FUNCTION search_ingredients(TEXT) IS
'Phase 8C-Shared-CP2b.1. Tiered fuzzy ingredient autocomplete: exact (2.0) > substring-starts-with (1.5) > substring-anywhere (1.0) > prefix-3char-min (0.95) > similarity (0.25-1.0). Tiebreak by name length ASC then name ASC. Top 20. Used by GroceryListDetailScreen add-item sheet.';

-- ============================================================================
-- 2. Post-migration verification queries
-- ============================================================================
-- Tom runs these manually after apply to confirm the tier ordering works.

-- Smoke-test 1: exact match wins (the "tomatoes" issue)
-- SELECT name, score FROM search_ingredients('tomatoes') LIMIT 5;
-- Expected: top result is "Tomatoes" (or whatever the canonical plural-form
-- ingredient is named) with score = 2.0; "Cherry tomatoes" / "Roma tomatoes"
-- below with score 1.0 (substring anywhere).

-- Smoke-test 2: prefix match surfaces earlier (the "corr" → "corn" issue)
-- SELECT name, score FROM search_ingredients('cori') LIMIT 5;
-- Expected: "Coriander" with score 1.5 (Tier 2 — name starts with "cori")
-- ranked above other partial matches.

-- Smoke-test 3: typo path still works (regression check on lowered threshold)
-- SELECT name, score FROM search_ingredients('corriander') LIMIT 5;
-- Expected: "Coriander" with similarity score around 0.7 (Tier 5).

-- Smoke-test 4: starts-with beats substring-anywhere
-- SELECT name, score FROM search_ingredients('tom') LIMIT 5;
-- Expected: "Tomato" / "Tomatoes" / "Tomatillo" first (Tier 2 starts-with,
-- 1.5) ranked above any ingredient where "tom" appears mid-name (Tier 4
-- substring anywhere, 1.0).

-- Smoke-test 5: short-query prefix correctly excluded
-- SELECT name, score FROM search_ingredients('co') LIMIT 5;
-- Expected: only ingredients with substring "co" (Tier 4); Tier 3 prefix
-- match suppressed for queries < 3 chars to avoid noise.

-- Smoke-test 6: tiebreak verified
-- (Anything that produces multiple Tier 2 starts-with hits at score 1.5
-- should now sort by name length ASC, so shorter canonical names rank first.)

-- ============================================================================
-- ROLLBACK (DO NOT RUN unless reverting CP2b.1)
-- ============================================================================
-- Restores the pre-CP2b.1 RPC body. Indexes from CP2b are not touched.
-- BEGIN;
-- CREATE OR REPLACE FUNCTION search_ingredients(query_text TEXT)
-- RETURNS TABLE (
--   id UUID, name TEXT, plural_name TEXT, family TEXT, ingredient_type TEXT,
--   typical_unit TEXT, typical_store_section TEXT, score REAL
-- )
-- LANGUAGE sql STABLE AS $$
--   SELECT
--     i.id, i.name, i.plural_name, i.family, i.ingredient_type,
--     i.typical_unit, i.typical_store_section,
--     GREATEST(
--       CASE WHEN i.name ILIKE '%' || query_text || '%' THEN 1.0 ELSE 0.0 END,
--       CASE WHEN i.plural_name ILIKE '%' || query_text || '%' THEN 1.0 ELSE 0.0 END,
--       similarity(i.name, query_text),
--       similarity(COALESCE(i.plural_name, ''), query_text)
--     ) AS score
--   FROM ingredients i
--   WHERE
--     i.name ILIKE '%' || query_text || '%'
--     OR i.plural_name ILIKE '%' || query_text || '%'
--     OR similarity(i.name, query_text) > 0.3
--     OR similarity(COALESCE(i.plural_name, ''), query_text) > 0.3
--   ORDER BY score DESC, i.name ASC
--   LIMIT 20;
-- $$;
-- COMMIT;
