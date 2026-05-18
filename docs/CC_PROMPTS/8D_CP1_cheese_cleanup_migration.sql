-- 8D-CP1 Part 0 — Cheese duplicate cleanup migration (v2 — actually applied)
-- Run manually in Supabase SQL editor.
-- This migration deletes orphan ingredient rows of the form "X cheese" when a
-- canonical "X" row already exists with cheese-family metadata. The orphan rows
-- were created during recipe extraction before the cheese-family normalization
-- landed in CP6e-Catalog-SF5.
--
-- Phase 3b v2 fix: previously set custom_name alongside ingredient_id, which
-- violated supply_has_identity (XOR CHECK on supplies — exactly one of
-- ingredient_id OR custom_name, never both). v2 nulls ingredient_id at the
-- same time, satisfying the constraint and pre-empting Phase 5's FK SET NULL
-- cascade.

BEGIN;

-- ============================================
-- Phase 1: Discovery — enumerate orphan/canonical pairs
-- ============================================
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
    AND orphan.base_ingredient_id IS NULL
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
    orphan.id AS orphan_id,
    canon.id  AS canonical_id
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
-- Phase 3a: Re-point supplies that have NO collision
-- ============================================
WITH orphan_pairs AS (
  SELECT
    orphan.id AS orphan_id,
    canon.id  AS canonical_id
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

-- ============================================
-- Phase 3b (v2): Archive orphan-side supplies WHERE collision exists
--                Atomic: null FK + set custom_name + archive
--                Result: XOR constraint satisfied (ingredient_id NULL, custom_name NOT NULL)
-- ============================================
WITH orphan_pairs AS (
  SELECT
    orphan.id   AS orphan_id,
    orphan.name AS orphan_name
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
UPDATE supplies s
SET
  archived_at   = NOW(),
  custom_name   = pairs.orphan_name,
  ingredient_id = NULL
FROM orphan_pairs pairs
WHERE s.ingredient_id = pairs.orphan_id
  AND s.archived_at IS NULL;

-- ============================================
-- Phase 4: Verify zero references remain
-- ============================================
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

SELECT COUNT(*) AS leftover_supply_refs
FROM supplies s
WHERE s.ingredient_id IN (
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
-- Phase 6: Final verification — should return 0
-- ============================================
SELECT COUNT(*) AS remaining_orphans
FROM ingredients orphan
JOIN ingredients canon
  ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
WHERE LOWER(orphan.name) ~ ' cheese$'
  AND orphan.base_ingredient_id IS NULL
  AND canon.id != orphan.id;

COMMIT;
