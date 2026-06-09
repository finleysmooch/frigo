-- ============================================
-- 2026-06-04 — Supply auto-list rules (Low / Out → which grocery list)
-- ============================================
-- Adds a per-supply, user-configurable rule controlling which default grocery
-- list a Staple is auto-added to when it drops to Low vs Out. Replaces the
-- previous hard-coded spawn behavior (restock spawn-on-out + priority
-- spawn-on-low-with-urgency=today) with two explicit, configurable targets.
--
-- Targets map to the default views (see 20260526_rename_default_view_names.sql):
--   'short'  → urgency=today      (Short List)
--   'medium' → urgency=this-week  (Medium List)
--   'long'   → status=need only   (Long List — no urgency tag)
--   'none'   → not auto-listed
--
-- Only consulted when tracking_mode='restock' (Staple / Priority). track_only
-- ("On hand") supplies are never auto-listed regardless of these values.
--
-- Bookmark presets (set together by the UI):
--   On hand  → tracking_mode='track_only'              (no auto-list)
--   Staple   → tracking_mode='restock', low='long',  out='short'
--   Priority → tracking_mode='restock', low='short', out='short', is_priority=true
-- ============================================

ALTER TABLE supplies
  ADD COLUMN IF NOT EXISTS low_list_target text NOT NULL DEFAULT 'long',
  ADD COLUMN IF NOT EXISTS out_list_target text NOT NULL DEFAULT 'short';

ALTER TABLE supplies DROP CONSTRAINT IF EXISTS supplies_low_list_target_check;
ALTER TABLE supplies
  ADD CONSTRAINT supplies_low_list_target_check
  CHECK (low_list_target IN ('none', 'short', 'medium', 'long'));

ALTER TABLE supplies DROP CONSTRAINT IF EXISTS supplies_out_list_target_check;
ALTER TABLE supplies
  ADD CONSTRAINT supplies_out_list_target_check
  CHECK (out_list_target IN ('none', 'short', 'medium', 'long'));

-- Backfill existing rows from current (tracking_mode, is_priority) so behavior
-- matches the new preset semantics.
--   track_only            → none / none
--   restock + priority    → short / short
--   restock + not priority→ long  / short   (= column defaults; explicit anyway)
UPDATE supplies
  SET low_list_target = CASE
        WHEN tracking_mode = 'track_only' THEN 'none'
        WHEN is_priority THEN 'short'
        ELSE 'long'
      END,
      out_list_target = CASE
        WHEN tracking_mode = 'track_only' THEN 'none'
        ELSE 'short'
      END;

COMMENT ON COLUMN supplies.low_list_target IS
  '2026-06-04: grocery list a restock supply is auto-added to when status→low. one of none/short/medium/long. Ignored for track_only.';
COMMENT ON COLUMN supplies.out_list_target IS
  '2026-06-04: grocery list a restock supply is escalated to when status→out/critical. one of none/short/medium/long. Ignored for track_only.';
