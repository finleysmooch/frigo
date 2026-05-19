-- 8D-CP1.5 Part 5 — Post-migration verification queries
-- Run in Supabase SQL editor AFTER the Part 4 linkage migration commits.
-- All read-only SELECTs — safe to run any number of times.

-- ============================================
-- Query 1: Orphan rate by family (pre/post comparison)
-- ============================================
-- Expected: orphan_pct drops from ~82% (pre-CP1.5) to ~20% (legitimate
-- standalones — distinctive-flavor oils, generic-only items, etc.).
SELECT family,
       COUNT(*) FILTER (WHERE is_base_ingredient = true) AS bases,
       COUNT(*) FILTER (WHERE is_base_ingredient = false AND base_ingredient_id IS NOT NULL) AS linked_variants,
       COUNT(*) FILTER (WHERE is_base_ingredient = false AND base_ingredient_id IS NULL) AS orphans,
       ROUND(100.0 * COUNT(*) FILTER (WHERE is_base_ingredient = false AND base_ingredient_id IS NULL)
             / NULLIF(COUNT(*) FILTER (WHERE is_base_ingredient = false), 0), 0) AS orphan_pct
FROM ingredients
GROUP BY family
ORDER BY family;

-- ============================================
-- Query 2: Contradictory-base regression check
-- ============================================
-- Expected: 0 rows. Sub-op D's CHECK constraint should make a contradictory
-- row impossible to write; this confirms nothing slipped through.
SELECT id, name FROM ingredients
WHERE is_base_ingredient = true AND base_ingredient_id IS NOT NULL;

-- ============================================
-- Query 3: Dangling link check
-- ============================================
-- Expected: 0 rows. Every base_ingredient_id must resolve to a real row.
SELECT i.id, i.name, i.base_ingredient_id
FROM ingredients i
WHERE i.base_ingredient_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ingredients b WHERE b.id = i.base_ingredient_id);

-- ============================================
-- Query 4: Cycle check — variants must not point at each other
-- ============================================
-- Expected: 0 rows. Walks the base_ingredient_id chain; flags any row whose
-- chain revisits its own id (a cycle) or exceeds a sane depth. The disposition
-- vocabulary makes cycles impossible, but verify.
WITH RECURSIVE chain AS (
  SELECT id AS start_id, id AS cur_id, base_ingredient_id, 1 AS depth
  FROM ingredients
  WHERE base_ingredient_id IS NOT NULL
  UNION ALL
  SELECT c.start_id, i.id, i.base_ingredient_id, c.depth + 1
  FROM chain c
  JOIN ingredients i ON i.id = c.base_ingredient_id
  WHERE c.depth < 10 AND i.base_ingredient_id IS NOT NULL
)
SELECT DISTINCT start_id, (SELECT name FROM ingredients WHERE id = start_id) AS name, depth
FROM chain
WHERE cur_id = start_id OR depth >= 10
ORDER BY depth DESC;

-- ============================================
-- Query 5: Cheese-base follow-up surface (DEFERRED_WORK T12)
-- ============================================
-- Expected: 1 row. Lists the recipe ingredient line(s) still pointing at the
-- demoted `cheese` base. Capture the result into DEFERRED_WORK as T12 — the
-- line should be re-pointed to a specific cheese variant or its recipe's
-- ingredient parsing improved.
SELECT r.id AS recipe_id, r.title, ri.id AS recipe_ingredient_id, ri.original_text
FROM recipe_ingredients ri
JOIN recipes r ON r.id = ri.recipe_id
WHERE ri.ingredient_id = '8fbe2d77-3f3e-4b01-abec-f82d176fa45d';
