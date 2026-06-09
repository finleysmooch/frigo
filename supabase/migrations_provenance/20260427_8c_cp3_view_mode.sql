-- Phase 8C-CP3 — grocery_lists.view_mode
-- Per-list persistence of Compact/Detailed view preference.
-- Additive, NOT NULL with default — existing lists backfill to 'compact'.

BEGIN;

ALTER TABLE grocery_lists
  ADD COLUMN IF NOT EXISTS view_mode TEXT NOT NULL DEFAULT 'compact'
  CHECK (view_mode IN ('compact', 'detailed'));

COMMENT ON COLUMN grocery_lists.view_mode IS
  'Per-list UI preference: ''compact'' (default, no recipe annotations on rows) or ''detailed'' (recipe pills + For: strip + filter-by-recipe enabled). Toggled via the list header icon. Added 2026-04-27 (Phase 8C-CP3).';

COMMIT;

-- Rollback (if needed):
-- BEGIN;
-- ALTER TABLE grocery_lists DROP COLUMN view_mode;
-- COMMIT;
