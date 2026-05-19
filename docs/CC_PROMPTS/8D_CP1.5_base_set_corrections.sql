-- 8D-CP1.5 Part 0 — Pre-migration catalog corrections (deterministic SQL)
-- Run manually in Supabase SQL editor. Run this BEFORE the Part 1 discovery
-- script — Part 1 enumerates orphans against the post-Part-0 catalog state.
--
-- Decisions: D8D-Q14 (cheese demote), structural base-set surgery scoped by
-- the CP1.5 planning instance (3 protein bases, 9 produce bases, 6 cheese
-- bases). Sub-op D lifts the base/variant invariant into the schema.
--
-- CHECK constraints (verified 2026-05-19 via Supabase Snippet List Public CHECK
-- Constraints CSVs — both versions): NONE present on the ingredients table.
-- The invariant `NOT (is_base_ingredient = true AND base_ingredient_id IS NOT NULL)`
-- is currently unenforced; CP1 cleanup hand-fixed 4 contradictory rows on
-- 2026-05-18 (olive oil, parmesan, mozzarella, cream cheese). Sub-op D of this
-- migration lifts the invariant into the schema as a CHECK constraint.
--
-- ingredient_type for new base rows is NOT hardcoded — Sub-op B derives it
-- in-SQL via a subquery (most common ingredient_type among existing bases of
-- the same family). The discovery SELECT below lets Tom sanity-check what that
-- derivation will pick before committing.
--
-- Idempotency: re-running this file is safe. Promotions are UPDATEs (no-op on
-- second run); inserts are guarded by WHERE NOT EXISTS; Sub-op D's ADD
-- CONSTRAINT is wrapped in a DO-block existence check.

-- ============================================
-- Discovery (run + review FIRST — non-destructive, autocommit)
-- ============================================
-- D-pre.1: ingredient_type distribution across existing bases, per family.
-- Confirms the Sub-op B derivation subqueries will pick sensible values.
SELECT family,
       ingredient_type,
       COUNT(*) AS base_rows
FROM ingredients
WHERE is_base_ingredient = true
GROUP BY family, ingredient_type
ORDER BY family, COUNT(*) DESC;

-- D-pre.2: existence preview for the Sub-op B candidates. Rows that already
-- exist will be PROMOTED; rows absent here will be INSERTED.
SELECT family, LOWER(name) AS name_lc, is_base_ingredient, base_ingredient_id
FROM ingredients
WHERE (family = 'Proteins' AND LOWER(name) IN ('chicken','beef','pork'))
   OR (family = 'Produce'  AND LOWER(name) IN ('basil','cilantro','parsley','mint','dill','rosemary','thyme','oregano','onion'))
   OR (family = 'Dairy'    AND LOWER(name) IN ('feta','cheddar','brie','swiss','ricotta','gouda'))
ORDER BY family, name_lc;

-- ============================================
-- BEGIN — Sub-ops A, B, C, D run as one transaction.
-- If any statement fails (e.g. Sub-op D.2 because contradictory rows exist),
-- the ENTIRE transaction rolls back — Sub-ops A/B/C do NOT partially commit.
-- ============================================
BEGIN;

-- ============================================
-- Sub-op A: Demote `cheese` to standalone (D8D-Q14)
-- ============================================
-- ID confirmed via refs check 2026-05-19: recipe_refs=1, supply_refs=0 →
-- demote (not delete). The 1 retained recipe_ingredients reference is a
-- DEFERRED_WORK T12 candidate (see Part 5 verification Query 5).
UPDATE ingredients
SET is_base_ingredient = false
WHERE id = '8fbe2d77-3f3e-4b01-abec-f82d176fa45d';

-- ============================================
-- Sub-op B: Add or promote new bases
-- ============================================
-- Per candidate: if a same-family row exists (case-insensitive name match),
-- promote it (is_base_ingredient=true, base_ingredient_id=NULL). If absent,
-- insert a fresh base row. ingredient_type is derived from the family's
-- existing bases — never guessed.

-- ---- Proteins: chicken, beef, pork ----
UPDATE ingredients
SET is_base_ingredient = true, base_ingredient_id = NULL
WHERE family = 'Proteins' AND LOWER(name) IN ('chicken','beef','pork');

INSERT INTO ingredients (name, family, ingredient_type, is_base_ingredient, created_by)
SELECT cand.name,
       'Proteins',
       (SELECT ingredient_type FROM ingredients
        WHERE family = 'Proteins' AND is_base_ingredient = true AND ingredient_type IS NOT NULL
        GROUP BY ingredient_type ORDER BY COUNT(*) DESC LIMIT 1),
       true,
       'cp1.5_haiku_backfill'
FROM (VALUES ('chicken'),('beef'),('pork')) AS cand(name)
WHERE NOT EXISTS (
  SELECT 1 FROM ingredients i
  WHERE LOWER(i.name) = LOWER(cand.name) AND i.family = 'Proteins'
);

-- ---- Produce: basil, cilantro, parsley, mint, dill, rosemary, thyme, oregano, onion ----
UPDATE ingredients
SET is_base_ingredient = true, base_ingredient_id = NULL
WHERE family = 'Produce'
  AND LOWER(name) IN ('basil','cilantro','parsley','mint','dill','rosemary','thyme','oregano','onion');

INSERT INTO ingredients (name, family, ingredient_type, is_base_ingredient, created_by)
SELECT cand.name,
       'Produce',
       (SELECT ingredient_type FROM ingredients
        WHERE family = 'Produce' AND is_base_ingredient = true AND ingredient_type IS NOT NULL
        GROUP BY ingredient_type ORDER BY COUNT(*) DESC LIMIT 1),
       true,
       'cp1.5_haiku_backfill'
FROM (VALUES ('basil'),('cilantro'),('parsley'),('mint'),('dill'),
             ('rosemary'),('thyme'),('oregano'),('onion')) AS cand(name)
WHERE NOT EXISTS (
  SELECT 1 FROM ingredients i
  WHERE LOWER(i.name) = LOWER(cand.name) AND i.family = 'Produce'
);

-- ---- Dairy (from cheese cleanup): feta, cheddar, brie, swiss, ricotta, gouda ----
-- Per D8D-Q1, different cheeses do NOT share a base — each is its own base.
UPDATE ingredients
SET is_base_ingredient = true, base_ingredient_id = NULL
WHERE family = 'Dairy'
  AND LOWER(name) IN ('feta','cheddar','brie','swiss','ricotta','gouda');

INSERT INTO ingredients (name, family, ingredient_type, is_base_ingredient, created_by)
SELECT cand.name,
       'Dairy',
       (SELECT ingredient_type FROM ingredients
        WHERE family = 'Dairy' AND is_base_ingredient = true AND ingredient_type IS NOT NULL
        GROUP BY ingredient_type ORDER BY COUNT(*) DESC LIMIT 1),
       true,
       'cp1.5_haiku_backfill'
FROM (VALUES ('feta'),('cheddar'),('brie'),('swiss'),('ricotta'),('gouda')) AS cand(name)
WHERE NOT EXISTS (
  SELECT 1 FROM ingredients i
  WHERE LOWER(i.name) = LOWER(cand.name) AND i.family = 'Dairy'
);

-- ============================================
-- Sub-op C: Post-state base counts (review before COMMIT)
-- ============================================
SELECT family,
       COUNT(*) FILTER (WHERE is_base_ingredient = true)  AS bases,
       COUNT(*) FILTER (WHERE is_base_ingredient = false) AS non_bases
FROM ingredients
GROUP BY family
ORDER BY family;

-- ============================================
-- Sub-op D: Lift the base-or-variant invariant into the schema
-- ============================================
-- The CP1-cleanup hand-fixed 4 contradictory rows. Without a CHECK constraint,
-- future destructive operations (Part 4 of this migration, the deferred
-- form-backfill pass, post-F&F catalog hygiene) can re-introduce the bug.
-- This Sub-op lifts the invariant into the schema after confirming no
-- contradictory rows currently exist.

-- D.1: Pre-check — confirm zero contradictory rows. If this returns any rows,
-- D.2 below WILL fail and roll the whole transaction back (Sub-ops A-C
-- included — safe, no partial commit). Investigate the listed rows, fix them,
-- and re-run Part 0.
SELECT id, name, family
FROM ingredients
WHERE is_base_ingredient = true AND base_ingredient_id IS NOT NULL;
-- Expected: 0 rows (CP1 cleanup fixed olive oil, parmesan, mozzarella, cream
-- cheese on 2026-05-18).

-- D.2: Add the constraint. Wrapped in a DO-block existence check because
-- `ALTER TABLE ... ADD CONSTRAINT` does not support IF NOT EXISTS natively —
-- this keeps Part 0 re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ingredients_base_or_variant_not_both'
      AND conrelid = 'ingredients'::regclass
  ) THEN
    ALTER TABLE ingredients
    ADD CONSTRAINT ingredients_base_or_variant_not_both
    CHECK (NOT (is_base_ingredient = true AND base_ingredient_id IS NOT NULL));
  END IF;
END $$;

-- D.3: Verify the constraint exists.
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ingredients'::regclass
  AND conname = 'ingredients_base_or_variant_not_both';
-- Expected: 1 row, constraint definition matches D.2.

COMMIT;
