-- ============================================================================
-- Pantry battery rework — usage_level 0–5 → 0–4  (2026-06-02)
-- ============================================================================
-- The pantry inventory indicator moved from a 6-state 5-circle dot
-- (usage_level 0–5) to a 5-state vertical battery (usage_level 0–4, four bars):
--
--   4/4, 3/4, 2/4 → in_stock · 1/4 → low · 0/4 → out   ('critical' retired)
--
-- The app already clamps any legacy 5 down to 4 on read, so it is safe to run
-- the app BEFORE this migration. This migration aligns the stored data + the
-- column constraints with the new model.
--
-- ⚠️ REVIEW BEFORE APPLYING. Run against Supabase manually (Tom). Not auto-run.
-- Verify the existing CHECK constraint name first (step 3 assumes the Postgres
-- default `supplies_usage_level_check`):
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'supplies'::regclass AND contype = 'c'
--     AND pg_get_constraintdef(oid) ILIKE '%usage_level%';
-- ============================================================================

BEGIN;

-- 1. Collapse the legacy top level (5 = old "100%") to a full 4-bar battery.
UPDATE supplies
SET usage_level = 4
WHERE usage_level = 5;

-- 2. Retire the 'critical' status. It is no longer produced by the level system
--    or selectable in the UI; fold existing rows down to 'low' at 1 bar.
--    (The 'critical' value is intentionally LEFT in the status CHECK constraint
--    for back-compat — we only reassign the rows, we do not drop the value.)
UPDATE supplies
SET status = 'low',
    usage_level = 1
WHERE status = 'critical';

-- 3. Tighten the range constraint 0–5 → 0–4 and lower the column default.
--    Steps 1–2 guarantee no row violates the new range before we add it.
ALTER TABLE supplies DROP CONSTRAINT IF EXISTS supplies_usage_level_check;
ALTER TABLE supplies
  ADD CONSTRAINT supplies_usage_level_check CHECK (usage_level BETWEEN 0 AND 4);
ALTER TABLE supplies ALTER COLUMN usage_level SET DEFAULT 4;

COMMIT;

-- ── Verification (run after COMMIT) ─────────────────────────────────────────
-- Expect 0 rows:
--   SELECT count(*) FROM supplies WHERE usage_level NOT BETWEEN 0 AND 4;
--   SELECT count(*) FROM supplies WHERE status = 'critical';
-- Expect default = 4:
--   SELECT column_default FROM information_schema.columns
--   WHERE table_name = 'supplies' AND column_name = 'usage_level';
