-- ============================================================================
-- Phase 8 Schema Foundation Migration
-- ============================================================================
-- Run this entire file in Supabase Dashboard SQL Editor.
-- Supabase wraps multi-statement pastes in a transaction by default — if any
-- statement fails, all roll back. No partial state.
--
-- Post-second-audit updates:
--   - RLS INSERT/UPDATE policies now allow guest role (matches pantry_items
--     pattern per SHARED_PANTRIES_FEATURE_SPEC permission matrix). DELETE
--     still restricted to owner + member only.
--   - custom_name comment clarifies quantity_display/unit_display still
--     required with natural display units.
--
-- What this migration creates:
--   1. pantry_staples table (space-scoped, state-based staples)
--   2. New columns on pantry_items (staleness foundation, soft delete, thaw)
--   3. New columns on grocery_list_items (tier reasons, custom items)
--   4. New column on space_settings (expiration fall-off threshold)
--   5. New column on user_pantry_preferences (staleness thresholds JSONB)
--   6. Backfill last_confirmed_at on existing pantry_items (best-effort)
--
-- What this migration does NOT do:
--   - Add default_aisle to ingredients (use existing typical_store_section)
--   - Add brand columns (grocery_list_items.brand_preference already exists)
--   - Any service or UI changes (separate checkpoints)
--
-- Rollback: see commented block at bottom. Do NOT run rollback unless needed.
-- ============================================================================

-- ============================================================================
-- 1. New table: pantry_staples
-- ============================================================================

CREATE TABLE pantry_staples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  custom_name TEXT,
  state TEXT NOT NULL CHECK (state IN ('unknown', 'good', 'running_low', 'out')) DEFAULT 'unknown',
  last_confirmed_at TIMESTAMPTZ,
  added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staple_has_identity CHECK (ingredient_id IS NOT NULL OR custom_name IS NOT NULL),
  CONSTRAINT unique_staple_per_space UNIQUE(space_id, ingredient_id, custom_name)
);

CREATE INDEX idx_pantry_staples_space ON pantry_staples(space_id);
CREATE INDEX idx_pantry_staples_state ON pantry_staples(state) WHERE state IN ('running_low', 'out');
CREATE INDEX idx_pantry_staples_ingredient ON pantry_staples(ingredient_id) WHERE ingredient_id IS NOT NULL;

COMMENT ON TABLE pantry_staples IS 'Space-scoped staples (olive oil, salt, etc). Separate from pantry_items — no quantity, no expiration, state-based.';
COMMENT ON COLUMN pantry_staples.ingredient_id IS 'Optional — for staples that map to the ingredients table.';
COMMENT ON COLUMN pantry_staples.custom_name IS 'Optional — for branded/custom staples like "Motor City pizza". Must be set if ingredient_id is null.';
COMMENT ON COLUMN pantry_staples.state IS 'Canonical state enum: unknown / good / running_low / out. Unknown is initial state for user-added staples not yet confirmed.';
COMMENT ON COLUMN pantry_staples.last_confirmed_at IS 'NULL at insert. Bumped to NOW() on any state transition including unknown → good first confirmation. Powers post-F&F staleness logic.';

-- RLS policies — space_members (NOT space_memberships) — matches pantry_items pattern
-- Accepted members of any role can SELECT; owner+member can write; guests read-only
ALTER TABLE pantry_staples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pantry_staples_select" ON pantry_staples FOR SELECT
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = pantry_staples.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
));

CREATE POLICY "pantry_staples_insert" ON pantry_staples FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = pantry_staples.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "pantry_staples_update" ON pantry_staples FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = pantry_staples.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

-- DELETE restricted to owner + member only (matches pantry_items pattern).
-- Guests can add and cycle staple state, but cannot remove entries.
CREATE POLICY "pantry_staples_delete" ON pantry_staples FOR DELETE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = pantry_staples.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));

-- ============================================================================
-- 2. New columns on pantry_items
-- ============================================================================

ALTER TABLE pantry_items ADD COLUMN last_confirmed_at TIMESTAMPTZ;
ALTER TABLE pantry_items ADD COLUMN discarded_at TIMESTAMPTZ;
ALTER TABLE pantry_items ADD COLUMN discarded_reason TEXT;
ALTER TABLE pantry_items ADD COLUMN thaw_planned_for DATE;

CREATE INDEX idx_pantry_items_active ON pantry_items(discarded_at) WHERE discarded_at IS NULL;
CREATE INDEX idx_pantry_items_thawing ON pantry_items(thaw_planned_for) WHERE thaw_planned_for IS NOT NULL;

COMMENT ON COLUMN pantry_items.last_confirmed_at IS 'Bumped on any user-initiated state change (qty edit, expiration edit, state cycle, cook-post depletion credit, manual confirmation). Powers Path B staleness logic and freezer cleanout detection.';
COMMENT ON COLUMN pantry_items.discarded_at IS 'Soft-delete timestamp. Set by expiration fall-off job or manual toss. Queries should filter WHERE discarded_at IS NULL for active items.';
COMMENT ON COLUMN pantry_items.discarded_reason IS 'One of: expired / tossed / used_up. For stats.';
COMMENT ON COLUMN pantry_items.thaw_planned_for IS 'When user intends to thaw. NULL if not planned. Powers Thawing tray on PantryScreen.';

-- ============================================================================
-- 3. New columns on grocery_list_items
-- ============================================================================

-- Note: grocery_list_items.ingredient_id — verify current NOT NULL status before running.
-- If already nullable, this ALTER will be a no-op in PostgreSQL.
ALTER TABLE grocery_list_items ALTER COLUMN ingredient_id DROP NOT NULL;

ALTER TABLE grocery_list_items ADD COLUMN priority_reason TEXT;
ALTER TABLE grocery_list_items ADD COLUMN custom_name TEXT;

ALTER TABLE grocery_list_items ADD CONSTRAINT grocery_item_has_identity
  CHECK (ingredient_id IS NOT NULL OR custom_name IS NOT NULL);

COMMENT ON COLUMN grocery_list_items.priority_reason IS 'Machine-populated reason for current priority tier (staple out / for X recipe / manual). Distinct from notes which is user freeform.';
COMMENT ON COLUMN grocery_list_items.custom_name IS 'For non-ingredient items like duct tape, toilet paper. Must be set if ingredient_id is null. Custom items still require quantity_display > 0 and unit_display per existing constraints — use natural display units (e.g., ''1 roll'', ''2 pack'').';

-- ============================================================================
-- 4. Auto-expiry fall-off threshold on space_settings
-- ============================================================================

ALTER TABLE space_settings ADD COLUMN expiration_falloff_days INTEGER DEFAULT 14;

COMMENT ON COLUMN space_settings.expiration_falloff_days IS 'Days past expiration_date at which non-freezer pantry items auto-soft-delete (set discarded_at, discarded_reason=''expired''). Default 14. The job that applies this runs in 8A-CP4.';

-- ============================================================================
-- 5. Staleness thresholds on user_pantry_preferences
-- ============================================================================

ALTER TABLE user_pantry_preferences ADD COLUMN staleness_threshold_days JSONB
  DEFAULT '{"produce":7,"dairy":14,"pantry_staple":60,"freezer":180}'::jsonb;

COMMENT ON COLUMN user_pantry_preferences.staleness_threshold_days IS 'Per-category thresholds for considering tracked items stale. Key by ingredient family. UI deferred to post-F&F; data collects during F&F for Path B readiness.';

-- ============================================================================
-- 6. Backfill last_confirmed_at on existing pantry_items
-- ============================================================================
-- Best-effort backfill using updated_at as engagement proxy. This overstates
-- engagement for items touched only by bulk admin updates (e.g., schema
-- migrations, mass imports). Tune expiration_falloff_days and
-- staleness_threshold_days post-launch if cleanout surfaces too much or too
-- little.
--
-- Running this here (rather than in a later checkpoint) so existing pantries
-- don't all flag as "never confirmed" when Path B logic eventually ships.

UPDATE pantry_items SET last_confirmed_at = updated_at WHERE last_confirmed_at IS NULL;

-- ============================================================================
-- 7. Post-migration verification queries (run these manually to confirm)
-- ============================================================================

-- Verify pantry_staples table created with correct RLS
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'pantry_staples';
-- Expected: 1 row, rowsecurity = true

-- Verify pantry_staples has 4 RLS policies
-- SELECT COUNT(*) FROM pg_policies WHERE tablename = 'pantry_staples';
-- Expected: 4

-- Verify CHECK constraint on state enforces allowed values
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'pantry_staples_state_check';
-- Expected: CHECK (state = ANY (ARRAY['unknown', 'good', 'running_low', 'out']))

-- Verify new columns on pantry_items
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
-- WHERE table_name = 'pantry_items' AND column_name IN ('last_confirmed_at', 'discarded_at', 'discarded_reason', 'thaw_planned_for');
-- Expected: 4 rows, all nullable

-- Verify backfill worked
-- SELECT COUNT(*) AS null_confirmed FROM pantry_items WHERE last_confirmed_at IS NULL;
-- Expected: 0 (or very few — only items with NULL updated_at, which shouldn't exist)

-- Verify grocery_list_items.ingredient_id is nullable
-- SELECT is_nullable FROM information_schema.columns
-- WHERE table_name = 'grocery_list_items' AND column_name = 'ingredient_id';
-- Expected: YES

-- Verify space_settings has expiration_falloff_days
-- SELECT column_name, column_default FROM information_schema.columns
-- WHERE table_name = 'space_settings' AND column_name = 'expiration_falloff_days';
-- Expected: expiration_falloff_days | 14

-- Verify user_pantry_preferences has staleness_threshold_days
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'user_pantry_preferences' AND column_name = 'staleness_threshold_days';
-- Expected: 1 row

-- ============================================================================
-- ROLLBACK (DO NOT RUN unless migration needs to be reversed)
-- ============================================================================
-- Uncomment this block and run to fully reverse the migration.
-- Data in pantry_staples will be permanently deleted. last_confirmed_at
-- backfill on pantry_items cannot be precisely un-done; it just drops the
-- column.
--
-- BEGIN;
-- DROP TABLE IF EXISTS pantry_staples CASCADE;
-- ALTER TABLE pantry_items DROP COLUMN IF EXISTS last_confirmed_at;
-- ALTER TABLE pantry_items DROP COLUMN IF EXISTS discarded_at;
-- ALTER TABLE pantry_items DROP COLUMN IF EXISTS discarded_reason;
-- ALTER TABLE pantry_items DROP COLUMN IF EXISTS thaw_planned_for;
-- DROP INDEX IF EXISTS idx_pantry_items_active;
-- DROP INDEX IF EXISTS idx_pantry_items_thawing;
-- ALTER TABLE grocery_list_items DROP CONSTRAINT IF EXISTS grocery_item_has_identity;
-- ALTER TABLE grocery_list_items DROP COLUMN IF EXISTS priority_reason;
-- ALTER TABLE grocery_list_items DROP COLUMN IF EXISTS custom_name;
-- -- Note: re-applying NOT NULL on ingredient_id after dropping custom_name
-- -- will fail if any row has ingredient_id IS NULL. Manually clean up first:
-- -- DELETE FROM grocery_list_items WHERE ingredient_id IS NULL AND custom_name IS NOT NULL;
-- -- Then: ALTER TABLE grocery_list_items ALTER COLUMN ingredient_id SET NOT NULL;
-- ALTER TABLE space_settings DROP COLUMN IF EXISTS expiration_falloff_days;
-- ALTER TABLE user_pantry_preferences DROP COLUMN IF EXISTS staleness_threshold_days;
-- COMMIT;
