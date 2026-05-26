-- ============================================
-- 8R-UX1: Add 'garden' as a storage_location value
-- ============================================
-- Apply manually via Supabase SQL editor.
--
-- The original CP6e schema migration set:
--   CHECK (storage_location IN ('fridge', 'freezer', 'pantry', 'counter'))
-- on both `supplies.storage_location` and `supply_lots.storage_location`.
-- This migration adds 'garden' so users can track items growing at home.
--
-- Source of truth for the TypeScript side: lib/types/supplies.ts (already
-- updated to include 'garden' in the StorageLocation union).
-- ============================================

ALTER TABLE supplies
  DROP CONSTRAINT IF EXISTS supplies_storage_location_check;
ALTER TABLE supplies
  ADD CONSTRAINT supplies_storage_location_check
  CHECK (storage_location IS NULL OR storage_location IN (
    'fridge', 'freezer', 'pantry', 'counter', 'garden'
  ));

ALTER TABLE supply_lots
  DROP CONSTRAINT IF EXISTS supply_lots_storage_location_check;
ALTER TABLE supply_lots
  ADD CONSTRAINT supply_lots_storage_location_check
  CHECK (storage_location IN (
    'fridge', 'freezer', 'pantry', 'counter', 'garden'
  ));

-- Notes for future schema work (Claude.ai topics):
--   1. Shelf-life columns: the ingredients table currently has
--      shelf_life_days_fridge / freezer / pantry. 'counter' currently falls
--      back to pantry shelf-life (see lotsService.pickShelfLifeDays).
--      A `shelf_life_days_garden` column would let lotsService.createLot
--      compute meaningful default expirations for garden produce. Until
--      then, garden-storage lots will compute expires_at from the pantry
--      shelf-life unless we extend pickShelfLifeDays.
--   2. Storage synonyms: search_supplies tsvector expansion currently maps
--      cold/refrigerated → fridge, frozen → freezer, etc. (see
--      cp6e_schema_migration.sql:338+). Add 'growing' / 'planted' →
--      'garden' for consistency.
