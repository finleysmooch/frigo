-- ============================================
-- 8R-UX4: supplies.last_confirmed_at
-- ============================================
-- Dedicated "behavioral engagement" timestamp for Pantry's "Sitting Idle"
-- signal. Replaces the noisy updated_at proxy that incidentally bumps on
-- tag edits, notes changes, and tracking_mode toggles.
--
-- Write coverage (canonical list lives in lib/services/suppliesService.ts):
--   Bumpers — setSupplyStatus, markSupplyUsed, createSupply, plus the
--     lot ops that bump via _bumpSupplyConfirmation in lotsService:
--     createLot, updateLot (quantity changes only), archiveLot,
--     deductFromOldest, deductFromSpecificLots, moveLotStorage.
--   Non-bumpers — tag edits, notes edits, custom_name changes, storage
--     change on the supply itself, archived_at flips, setSupplyTracksLots.
--
-- The bumpers/non-bumpers split is best-guess for F&F. Re-assess after we
-- have real usage data — DEFERRED_WORK has the follow-up item.
-- ============================================

ALTER TABLE supplies
  ADD COLUMN last_confirmed_at TIMESTAMPTZ;

-- Backfill: existing rows inherit their updated_at value. Preserves current
-- Sitting Idle behavior on rollout — supplies that were idle stay idle.
UPDATE supplies
  SET last_confirmed_at = updated_at
  WHERE last_confirmed_at IS NULL;

ALTER TABLE supplies
  ALTER COLUMN last_confirmed_at SET NOT NULL;

-- Service layer should always set this explicitly on insert; default is a
-- safety net for direct DB inserts and any code path that forgets.
ALTER TABLE supplies
  ALTER COLUMN last_confirmed_at SET DEFAULT NOW();

-- Sitting Idle queries filter by storage_location + last_confirmed_at <
-- threshold. Single-column btree is sufficient at F&F scale (~200 supplies
-- per space).
CREATE INDEX IF NOT EXISTS idx_supplies_last_confirmed_at
  ON supplies (last_confirmed_at);

COMMENT ON COLUMN supplies.last_confirmed_at IS
  '8R-UX4: behavioral-engagement timestamp. Bumped by status changes, swipe-mark-used, lot creates/updates/archives, cook depletion, and lot storage moves. Drives "Sitting Idle" in the Pantry Use Soon outer tab. See lib/services/suppliesService.ts CONFIRMING_FUNCTIONS_REFERENCE for the canonical bumper list.';
