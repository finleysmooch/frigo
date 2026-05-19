-- Phase 8C-CP1b — typical_store_section backfill + vocabulary normalization
-- Resolves P8-15.
-- 314 null rows backfilled via (family, ingredient_type) heuristic.
-- 2 capitalized anomalies (Produce, Pantry) normalized to lowercase.
-- All UPDATEs are idempotent — re-running is a no-op.

BEGIN;

-- Statement 1: Backfill 314 null rows via (family, ingredient_type).
UPDATE ingredients
SET typical_store_section = CASE
  WHEN family = 'Dairy'    THEN 'dairy'
  WHEN family = 'Produce'  THEN 'produce'
  WHEN family = 'Proteins' AND ingredient_type = 'Seafood' THEN 'seafood'
  WHEN family = 'Proteins' THEN 'meat'    -- Red Meat, Poultry, Plant-Based Proteins
  WHEN family = 'Pantry'   AND ingredient_type = 'Baking'  THEN 'baking'
  WHEN family = 'Pantry'   THEN 'pantry'  -- includes 2 rows with NULL ingredient_type
  ELSE typical_store_section              -- safety: leave unmatched rows alone
END
WHERE typical_store_section IS NULL;

-- Statement 2: Normalize capitalization on the 2 anomalies.
UPDATE ingredients
SET typical_store_section = LOWER(typical_store_section)
WHERE typical_store_section IN ('Produce', 'Pantry');

COMMIT;

-- Rollback (if needed):
-- BEGIN;
-- -- Re-null the rows backfilled by Statement 1. No way to identify them post-fact
-- -- unless we recorded a snapshot first; rollback is best-effort and would null
-- -- ALL rows matching the values written by this migration, including any that
-- -- happened to have those values pre-CP1b. Recommend taking a snapshot first.
-- -- See pre-image query in CP1b prompt.
-- COMMIT;
