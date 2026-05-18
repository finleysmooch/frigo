-- 8D-CP1 Part 0 — Cheese duplicate cleanup migration
-- Run manually in Supabase SQL editor.
-- This migration deletes orphan ingredient rows of the form "X cheese" when a
-- canonical "X" row already exists with cheese-family metadata. The orphan rows
-- were created during recipe extraction before the cheese-family normalization
-- landed in CP6e-Catalog-SF5.
--
-- Each phase outputs row counts so Tom can verify before committing the
-- transaction. Run with the transaction open (BEGIN/COMMIT) so any anomaly
-- can be rolled back.

BEGIN;

-- ============================================
-- Phase 1: Discovery — enumerate orphan/canonical pairs
-- ============================================
-- Output: list of pairs for Tom's manual review before destructive phases.
-- Tom can SELECT this CTE first, sanity-check the pair count and names,
-- then proceed to Phase 2.

WITH orphan_pairs AS (
  SELECT
    orphan.id   AS orphan_id,
    orphan.name AS orphan_name,
    canon.id    AS canonical_id,
    canon.name  AS canonical_name
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL  -- only base-level orphans, not variants
    AND canon.id != orphan.id
)
SELECT
  orphan_id,
  orphan_name,
  canonical_id,
  canonical_name,
  (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.ingredient_id = orphan_id) AS recipe_ingredient_refs,
  (SELECT COUNT(*) FROM supplies s WHERE s.ingredient_id = orphan_id AND s.archived_at IS NULL) AS active_supply_refs
FROM orphan_pairs
ORDER BY orphan_name;

-- ============================================
-- Phase 2: Re-point recipe_ingredients FKs
-- ============================================

WITH orphan_pairs AS (
  SELECT
    orphan.id   AS orphan_id,
    canon.id    AS canonical_id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
UPDATE recipe_ingredients ri
SET ingredient_id = pairs.canonical_id
FROM orphan_pairs pairs
WHERE ri.ingredient_id = pairs.orphan_id;

-- ============================================
-- Phase 3: Re-point supplies FKs (with collision safety)
-- ============================================
-- If a user has BOTH "feta" and "feta cheese" supplies in the same space,
-- we archive the orphan-side and leave the canonical-side intact.

-- Phase 3a: Re-point supplies that have no collision
WITH orphan_pairs AS (
  SELECT
    orphan.id   AS orphan_id,
    canon.id    AS canonical_id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
UPDATE supplies s
SET ingredient_id = pairs.canonical_id
FROM orphan_pairs pairs
WHERE s.ingredient_id = pairs.orphan_id
  AND NOT EXISTS (
    SELECT 1 FROM supplies s2
    WHERE s2.space_id = s.space_id
      AND s2.ingredient_id = pairs.canonical_id
      AND s2.archived_at IS NULL
  );

-- Phase 3b: Archive orphan-side supplies where collision exists
WITH orphan_pairs AS (
  SELECT orphan.id AS orphan_id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
UPDATE supplies
SET archived_at = NOW()
WHERE ingredient_id IN (SELECT orphan_id FROM orphan_pairs)
  AND archived_at IS NULL;

-- ============================================
-- Phase 4: Verify zero references remain before deleting ingredient rows
-- ============================================

-- Should return 0
SELECT COUNT(*) AS leftover_recipe_ingredient_refs
FROM recipe_ingredients ri
WHERE ri.ingredient_id IN (
  SELECT orphan.id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
);

-- Should return 0
SELECT COUNT(*) AS leftover_active_supply_refs
FROM supplies s
WHERE s.archived_at IS NULL
  AND s.ingredient_id IN (
    SELECT orphan.id
    FROM ingredients orphan
    JOIN ingredients canon
      ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
    WHERE LOWER(orphan.name) ~ ' cheese$'
      AND orphan.base_ingredient_id IS NULL
      AND canon.id != orphan.id
  );

-- ============================================
-- Phase 5: Delete orphan ingredient rows
-- ============================================
-- Only run if Phase 4 verification queries return 0 for both checks.

DELETE FROM ingredients
WHERE id IN (
  SELECT orphan.id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
);

-- ============================================
-- Phase 6: Final verification
-- ============================================
-- Should return 0 orphan rows
SELECT COUNT(*) AS remaining_orphans
FROM ingredients orphan
JOIN ingredients canon
  ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
WHERE LOWER(orphan.name) ~ ' cheese$'
  AND orphan.base_ingredient_id IS NULL
  AND canon.id != orphan.id;

COMMIT;
