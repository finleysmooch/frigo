-- Phase 8C-CP1a — grocery_lists.store_name
-- Resolves D8-35 (vestigial store_name field).
-- Pre-8C-CP1 code wrote and read this column though it never existed in the DB.
-- Adding it now so the existing create-flow and badge render actually work.
-- Additive, nullable, no default — safe rollback via DROP COLUMN if needed.

BEGIN;

ALTER TABLE grocery_lists
  ADD COLUMN IF NOT EXISTS store_name TEXT;

COMMENT ON COLUMN grocery_lists.store_name IS
  'Optional store association for the list (e.g., "Costco", "Whole Foods"). '
  'Surfaced as a 🏪 badge on GroceryListsScreen. Added 2026-04-27 (Phase 8C-CP1a).';

COMMIT;

-- Rollback (if needed):
-- BEGIN;
-- ALTER TABLE grocery_lists DROP COLUMN store_name;
-- COMMIT;
