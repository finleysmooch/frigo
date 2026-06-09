-- ============================================================================
-- Phase 8C-Shared-CP1 — Shared grocery list infrastructure (schema)
-- ============================================================================
-- Run this entire file in Supabase Dashboard SQL Editor.
-- Supabase wraps multi-statement pastes in a transaction by default — if any
-- statement fails, all roll back. No partial state.
--
-- See docs/PHASE_8_PANTRY_INTELLIGENCE.md (Decisions Log: D8C-Shared-1..8) and
-- the 8C-Shared sub-phase scope block for the architectural rationale.
--
-- v2 revision: added Section 5b widening grocery_list_item_recipes RLS to
-- delegate to parent grocery_list_items visibility (necessary because CP2a's
-- junction policies were authored against the pre-CP1 owner-only parent
-- model; without this, shared-list members can see items but not their
-- recipe attributions, silently breaking CP3 recipe pills). Section 6
-- verification queries tightened to assert exactly 4 policies per table
-- with no orphan names from prior naming conventions.
--
-- v3 revision: added Section 5c dropping 9 specific orphan policies
-- discovered during planning-session verification (run 1). The defensive
-- DROPs in sections 4, 5, 5b covered two naming conventions (prose-style
-- "Users can view/insert/update/delete their own X" + new snake_case
-- "X_select/insert/update/delete"), but a third pre-existing convention
-- shipped from earlier phases used variants like "create" instead of
-- "insert", "view own X list" with singular noun, and verbose
-- junction-specific names. Section 5c drops all 9 by exact name. Without
-- this, the new policies still functioned correctly (RLS is permissive-
-- by-default — multiple policies are OR'd, and the new ones are strictly
-- wider than legacy), but pg_policies state would have stayed cluttered
-- with 2x policy evaluation per query and drift risk on future audits.
--
-- ============================================================================
-- PREREQUISITE — run BEFORE this migration (one-off, outside this script)
-- ============================================================================
-- Tom adds Mary Frigo to the "Home" space as test partner. This is user-data
-- setup, not migration logic, so it is intentionally NOT part of this script.
-- Required so the post-migration default-shared state has a meaningful
-- second member to validate routing/edit-permission flows against.
--
--   INSERT INTO space_members (space_id, user_id, role, status, joined_at)
--   VALUES (
--     '7aa945ab-fb32-4197-ae11-e6dbd3392587',  -- "Home" space
--     '7c1616f6-517c-48bc-a96b-fd950142c1d7',  -- Mary Frigo
--     'member',
--     'accepted',
--     NOW()
--   )
--   ON CONFLICT (space_id, user_id) DO NOTHING;
--
-- This migration is idempotent regardless of whether Mary has been added.
--
-- ============================================================================
-- What this migration creates:
--   1. grocery_lists.space_id column + FK + partial index
--   2. grocery_list_item_recipes.added_by column + FK
--   3. Backfill: existing grocery_lists rows set to space_id = "Home"
--   4. RLS rewrite on grocery_lists (4 policies)
--   5. RLS rewrite on grocery_list_items (4 policies)
--   5b. RLS rewrite on grocery_list_item_recipes (4 policies, parent-delegating)
--   5c. Orphan-policy cleanup (9 specific legacy names from earlier phases)
--
-- What this migration does NOT do:
--   - Service-layer query changes (8C-Shared-CP2)
--   - Sharing toggle on creation modal (8C-Shared-CP2)
--   - Routing service updates (8C-Shared-CP3)
--   - Cross-list query widening (8C-Shared-CP3)
--   - added_by population (8C-Shared-CP3 — column sits NULL until then)
--   - UX visibility (8C-Shared-CP4)
--
-- Rollback: see commented block at bottom. Do NOT run rollback unless needed.
-- ============================================================================

-- ============================================================================
-- 1. New columns
-- ============================================================================

-- 1a. grocery_lists.space_id — optional space attachment
ALTER TABLE grocery_lists
ADD COLUMN space_id UUID NULL REFERENCES spaces(id) ON DELETE SET NULL;

COMMENT ON COLUMN grocery_lists.space_id IS
'Phase 8C-Shared. Optional space attachment. NULL = private (owner-only). Set = shared with all accepted members of that space. Owner is always grocery_lists.user_id; only owner can DELETE the list (D8C-Shared-3 EP2 + owner-only-hard-delete). Members can SELECT/INSERT/UPDATE/DELETE items and UPDATE list metadata. ON DELETE SET NULL: if the space is deleted, lists revert to private (owner still has full access; non-owner members lose access — by design).';

-- 1b. grocery_list_item_recipes.added_by — recipe-attribution authorship
ALTER TABLE grocery_list_item_recipes
ADD COLUMN added_by UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN grocery_list_item_recipes.added_by IS
'Phase 8C-Shared. NULL on rows backfilled before 8C-Shared-CP1; NULL is also the legitimate value for rows where authorship was not captured. New rows populated from auth.uid() at insert time starting in 8C-Shared-CP3. Powers post-F&F per-user contribution badges + audit trail.';

-- ============================================================================
-- 2. Indexes
-- ============================================================================

-- Partial index supporting membership-based reads (the "all shared lists I can
-- access" query path widened in 8C-Shared-CP2).
CREATE INDEX IF NOT EXISTS idx_grocery_lists_space
ON grocery_lists(space_id)
WHERE space_id IS NOT NULL;

-- ============================================================================
-- 3. Backfill — set space_id on existing user-owned lists to "Home"
-- ============================================================================
-- D8C-Shared-2: hardcoded Home UUID per Tom's setup. Single-user dev DB at
-- migration time. Tom adds Mary Frigo to "Home" separately (see PREREQUISITE
-- header) so the post-migration state has a meaningful test partner. Tom
-- manually privatizes 1-2 lists post-CP4 UX to validate the private path.
--
-- Idempotent: re-running the UPDATE no-ops because space_id is already set.

UPDATE grocery_lists
SET space_id = '7aa945ab-fb32-4197-ae11-e6dbd3392587'  -- "Home" space
WHERE space_id IS NULL;

-- ============================================================================
-- 4. RLS — grocery_lists
-- ============================================================================
-- D8C-Shared-3: SELECT/UPDATE widened to owner OR accepted-member-of-space;
-- DELETE stays owner-only; INSERT requires user create their own list and, if
-- space_id is set, that they belong to that space (defensive WITH CHECK).
--
-- Pattern: EXISTS (SELECT 1 FROM space_members ...) — matches established
-- codebase precedent (pantry_staples, pantry_items).

DROP POLICY IF EXISTS "Users can view their own grocery lists" ON grocery_lists;
DROP POLICY IF EXISTS "Users can insert their own grocery lists" ON grocery_lists;
DROP POLICY IF EXISTS "Users can update their own grocery lists" ON grocery_lists;
DROP POLICY IF EXISTS "Users can delete their own grocery lists" ON grocery_lists;

DROP POLICY IF EXISTS "grocery_lists_select" ON grocery_lists;
DROP POLICY IF EXISTS "grocery_lists_insert" ON grocery_lists;
DROP POLICY IF EXISTS "grocery_lists_update" ON grocery_lists;
DROP POLICY IF EXISTS "grocery_lists_delete" ON grocery_lists;

CREATE POLICY "grocery_lists_select" ON grocery_lists FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    space_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM space_members sm
      WHERE sm.space_id = grocery_lists.space_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'accepted'
    )
  )
);

CREATE POLICY "grocery_lists_insert" ON grocery_lists FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    space_id IS NULL
    OR EXISTS (
      SELECT 1 FROM space_members sm
      WHERE sm.space_id = grocery_lists.space_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'accepted'
    )
  )
);

CREATE POLICY "grocery_lists_update" ON grocery_lists FOR UPDATE
USING (
  user_id = auth.uid()
  OR (
    space_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM space_members sm
      WHERE sm.space_id = grocery_lists.space_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'accepted'
    )
  )
);

CREATE POLICY "grocery_lists_delete" ON grocery_lists FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- 5. RLS — grocery_list_items
-- ============================================================================
-- All four policies reach through grocery_lists for the membership check.
-- D8C-Shared-3 EP2: members can INSERT/UPDATE/DELETE items on shared lists.
-- (Item-level DELETE widens in symmetry with UPDATE — list-level DELETE stays
-- owner-only above.)

DROP POLICY IF EXISTS "Users can view their own grocery list items" ON grocery_list_items;
DROP POLICY IF EXISTS "Users can insert their own grocery list items" ON grocery_list_items;
DROP POLICY IF EXISTS "Users can update their own grocery list items" ON grocery_list_items;
DROP POLICY IF EXISTS "Users can delete their own grocery list items" ON grocery_list_items;

DROP POLICY IF EXISTS "grocery_list_items_select" ON grocery_list_items;
DROP POLICY IF EXISTS "grocery_list_items_insert" ON grocery_list_items;
DROP POLICY IF EXISTS "grocery_list_items_update" ON grocery_list_items;
DROP POLICY IF EXISTS "grocery_list_items_delete" ON grocery_list_items;

CREATE POLICY "grocery_list_items_select" ON grocery_list_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM grocery_lists gl
    WHERE gl.id = grocery_list_items.list_id
      AND (
        gl.user_id = auth.uid()
        OR (
          gl.space_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM space_members sm
            WHERE sm.space_id = gl.space_id
              AND sm.user_id = auth.uid()
              AND sm.status = 'accepted'
          )
        )
      )
  )
);

CREATE POLICY "grocery_list_items_insert" ON grocery_list_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM grocery_lists gl
    WHERE gl.id = grocery_list_items.list_id
      AND (
        gl.user_id = auth.uid()
        OR (
          gl.space_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM space_members sm
            WHERE sm.space_id = gl.space_id
              AND sm.user_id = auth.uid()
              AND sm.status = 'accepted'
          )
        )
      )
  )
);

CREATE POLICY "grocery_list_items_update" ON grocery_list_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM grocery_lists gl
    WHERE gl.id = grocery_list_items.list_id
      AND (
        gl.user_id = auth.uid()
        OR (
          gl.space_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM space_members sm
            WHERE sm.space_id = gl.space_id
              AND sm.user_id = auth.uid()
              AND sm.status = 'accepted'
          )
        )
      )
  )
);

CREATE POLICY "grocery_list_items_delete" ON grocery_list_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM grocery_lists gl
    WHERE gl.id = grocery_list_items.list_id
      AND (
        gl.user_id = auth.uid()
        OR (
          gl.space_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM space_members sm
            WHERE sm.space_id = gl.space_id
              AND sm.user_id = auth.uid()
              AND sm.status = 'accepted'
          )
        )
      )
  )
);

-- ============================================================================
-- 5b. RLS — grocery_list_item_recipes (junction table from CP2a)
-- ============================================================================
-- CP2a originally set up RLS as "via parent ownership" — the policies checked
-- ownership against grocery_list_items, which at the time had owner-only RLS.
-- After CP1's grocery_list_items widening, junction policies authored against
-- the pre-CP1 model would silently break for shared-list members (member can
-- see items but not their recipe-attribution rows). Without this rewrite,
-- CP3 recipe pills would silently fail on shared lists.
--
-- Pattern: parent-RLS-delegation. The EXISTS subquery against
-- grocery_list_items implicitly inherits that table's RLS, so this junction's
-- visibility tracks the parent automatically — DRY, and self-correcting if
-- parent RLS evolves further.
--
-- Defensive DROPs cover both naming conventions (CP2a may have used either).

DROP POLICY IF EXISTS "Users can view their own grocery list item recipes" ON grocery_list_item_recipes;
DROP POLICY IF EXISTS "Users can insert their own grocery list item recipes" ON grocery_list_item_recipes;
DROP POLICY IF EXISTS "Users can update their own grocery list item recipes" ON grocery_list_item_recipes;
DROP POLICY IF EXISTS "Users can delete their own grocery list item recipes" ON grocery_list_item_recipes;

DROP POLICY IF EXISTS "grocery_list_item_recipes_select" ON grocery_list_item_recipes;
DROP POLICY IF EXISTS "grocery_list_item_recipes_insert" ON grocery_list_item_recipes;
DROP POLICY IF EXISTS "grocery_list_item_recipes_update" ON grocery_list_item_recipes;
DROP POLICY IF EXISTS "grocery_list_item_recipes_delete" ON grocery_list_item_recipes;

CREATE POLICY "grocery_list_item_recipes_select" ON grocery_list_item_recipes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM grocery_list_items gli
    WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id
  )
);

CREATE POLICY "grocery_list_item_recipes_insert" ON grocery_list_item_recipes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM grocery_list_items gli
    WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id
  )
);

CREATE POLICY "grocery_list_item_recipes_update" ON grocery_list_item_recipes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM grocery_list_items gli
    WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id
  )
);

CREATE POLICY "grocery_list_item_recipes_delete" ON grocery_list_item_recipes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM grocery_list_items gli
    WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id
  )
);

-- ============================================================================
-- 5c. Orphan-policy cleanup (discovered during 2026-04-28 planning verification)
-- ============================================================================
-- The defensive DROP IF EXISTS lists in Sections 4, 5, and 5b covered two
-- naming conventions used in the codebase: the prose-style
-- "Users can view/insert/update/delete their own X" pattern and the new
-- snake_case "X_select/insert/update/delete" pattern.
--
-- Initial planning-session verification of run 1 surfaced 9 additional
-- pre-existing policies using a third convention from earlier phases:
--   • "Users can create their own grocery lists" (uses 'create' not 'insert')
--   • "Users can view own grocery list" (singular 'list', not '... items')
--   • "Users can [insert|update|delete] own grocery items" (no 'their', '... items' suffix)
--   • "Users can [read|insert|update|delete] junction rows for their own list items"
--     (verbose junction-specific names)
--
-- Functional impact of leaving them was zero (Postgres RLS is permissive-
-- by-default — multiple policies are OR'd, and the new CP1 policies are
-- strictly wider than these legacy ones). Real cost was cluttered
-- pg_policies state, 2x policy evaluation per query, drift risk on future
-- audits. Cleanup folded into the migration so a future replay against a
-- fresh dev DB clone (or a rollback + reapply) doesn't silently leave
-- orphans behind.

DROP POLICY IF EXISTS "Users can create their own grocery lists" ON grocery_lists;

DROP POLICY IF EXISTS "Users can view own grocery list" ON grocery_list_items;
DROP POLICY IF EXISTS "Users can insert own grocery items" ON grocery_list_items;
DROP POLICY IF EXISTS "Users can update own grocery items" ON grocery_list_items;
DROP POLICY IF EXISTS "Users can delete own grocery items" ON grocery_list_items;

DROP POLICY IF EXISTS "Users can read junction rows for their own list items" ON grocery_list_item_recipes;
DROP POLICY IF EXISTS "Users can insert junction rows for their own list items" ON grocery_list_item_recipes;
DROP POLICY IF EXISTS "Users can update junction rows for their own list items" ON grocery_list_item_recipes;
DROP POLICY IF EXISTS "Users can delete junction rows for their own list items" ON grocery_list_item_recipes;

-- ============================================================================
-- 6. Post-migration verification queries (run these manually to confirm)
-- ============================================================================

-- 6a. Verify space_id column added
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
-- WHERE table_name = 'grocery_lists' AND column_name = 'space_id';
-- Expected: 1 row, uuid, YES

-- 6b. Verify added_by column added
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
-- WHERE table_name = 'grocery_list_item_recipes' AND column_name = 'added_by';
-- Expected: 1 row, uuid, YES

-- 6c. Verify backfill — all existing lists have space_id set
-- SELECT COUNT(*) AS lists_unbackfilled FROM grocery_lists WHERE space_id IS NULL;
-- Expected: 0

-- 6d. Verify all backfilled to "Home"
-- SELECT space_id, COUNT(*) FROM grocery_lists GROUP BY space_id;
-- Expected: 1 row with space_id = '7aa945ab-fb32-4197-ae11-e6dbd3392587'

-- 6e. Verify FK on grocery_lists.space_id
-- SELECT tc.constraint_name, kcu.column_name, rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu USING (constraint_name)
-- JOIN information_schema.referential_constraints rc USING (constraint_name)
-- WHERE tc.table_name = 'grocery_lists' AND tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name = 'space_id';
-- Expected: 1 row, delete_rule = 'SET NULL'

-- 6f. Verify FK on grocery_list_item_recipes.added_by
-- SELECT tc.constraint_name, kcu.column_name, rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu USING (constraint_name)
-- JOIN information_schema.referential_constraints rc USING (constraint_name)
-- WHERE tc.table_name = 'grocery_list_item_recipes' AND tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name = 'added_by';
-- Expected: 1 row, delete_rule = 'SET NULL'

-- 6g. Verify partial index on space_id
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'grocery_lists' AND indexname = 'idx_grocery_lists_space';
-- Expected: 1 row, indexdef contains "WHERE (space_id IS NOT NULL)"

-- 6h. Verify EXACTLY 4 RLS policies on grocery_lists, all with snake_case names.
-- Section 5c's cleanup is verified here — if 5c missed a legacy name,
-- unexpected_named will be > 0.
-- SELECT
--   COUNT(*) AS policy_count,
--   COUNT(*) FILTER (WHERE policyname NOT LIKE 'grocery_lists_%') AS unexpected_named
-- FROM pg_policies WHERE tablename = 'grocery_lists';
-- Expected: policy_count = 4, unexpected_named = 0

-- 6i. Confirm policy details on grocery_lists
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'grocery_lists' ORDER BY cmd;
-- Expected: 4 rows — grocery_lists_delete / _insert / _select / _update

-- 6j. Verify EXACTLY 4 RLS policies on grocery_list_items, all snake_case
-- SELECT
--   COUNT(*) AS policy_count,
--   COUNT(*) FILTER (WHERE policyname NOT LIKE 'grocery_list_items_%') AS unexpected_named
-- FROM pg_policies WHERE tablename = 'grocery_list_items';
-- Expected: policy_count = 4, unexpected_named = 0

-- 6k. Confirm policy details on grocery_list_items
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'grocery_list_items' ORDER BY cmd;
-- Expected: 4 rows — grocery_list_items_delete / _insert / _select / _update

-- 6l. Verify EXACTLY 4 RLS policies on grocery_list_item_recipes, all snake_case
-- SELECT
--   COUNT(*) AS policy_count,
--   COUNT(*) FILTER (WHERE policyname NOT LIKE 'grocery_list_item_recipes_%') AS unexpected_named
-- FROM pg_policies WHERE tablename = 'grocery_list_item_recipes';
-- Expected: policy_count = 4, unexpected_named = 0

-- 6m. Confirm policy details on grocery_list_item_recipes
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'grocery_list_item_recipes' ORDER BY cmd;
-- Expected: 4 rows — grocery_list_item_recipes_delete / _insert / _select / _update

-- 6n. Smoke-test the SELECT widening on lists
-- (run as authenticated user via Supabase Dashboard or via app)
-- SELECT id, name, user_id, space_id FROM grocery_lists ORDER BY created_at;
-- Expected: same row count as before migration; all rows now have space_id set.

-- 6o. Smoke-test that backfilled junction rows are still visible after RLS rewrite
-- (CP2a backfilled 18 rows; should remain SELECT-able post-CP1)
-- SELECT COUNT(*) FROM grocery_list_item_recipes;
-- Expected: row count >= 18 (more if CP3 has shipped between CP1 and run-time)

-- ============================================================================
-- ROLLBACK (DO NOT RUN unless migration needs to be reversed)
-- ============================================================================
-- Note: rollback restores pre-CP1 owner-only RLS shape but does NOT restore
-- the 9 orphan policies dropped in Section 5c. Those names are preserved in
-- this file's Section 5c comments if you ever need to re-create them — but
-- the new owner-only policies created in this rollback block functionally
-- supersede them anyway.
--
-- BEGIN;
--
-- -- Junction table policies — restore CP2a parent-ownership shape
-- DROP POLICY IF EXISTS "grocery_list_item_recipes_delete" ON grocery_list_item_recipes;
-- DROP POLICY IF EXISTS "grocery_list_item_recipes_update" ON grocery_list_item_recipes;
-- DROP POLICY IF EXISTS "grocery_list_item_recipes_insert" ON grocery_list_item_recipes;
-- DROP POLICY IF EXISTS "grocery_list_item_recipes_select" ON grocery_list_item_recipes;
--
-- -- Re-create CP2a-shape policies (parent-ownership with auth.uid() against parent.user_id).
-- -- ADJUST this block to match the actual CP2a policy bodies — verify against
-- -- a pre-rollback pg_policies snapshot if one was captured.
-- CREATE POLICY "grocery_list_item_recipes_select" ON grocery_list_item_recipes FOR SELECT
-- USING (EXISTS (SELECT 1 FROM grocery_list_items gli WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id AND gli.user_id = auth.uid()));
-- CREATE POLICY "grocery_list_item_recipes_insert" ON grocery_list_item_recipes FOR INSERT
-- WITH CHECK (EXISTS (SELECT 1 FROM grocery_list_items gli WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id AND gli.user_id = auth.uid()));
-- CREATE POLICY "grocery_list_item_recipes_update" ON grocery_list_item_recipes FOR UPDATE
-- USING (EXISTS (SELECT 1 FROM grocery_list_items gli WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id AND gli.user_id = auth.uid()));
-- CREATE POLICY "grocery_list_item_recipes_delete" ON grocery_list_item_recipes FOR DELETE
-- USING (EXISTS (SELECT 1 FROM grocery_list_items gli WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id AND gli.user_id = auth.uid()));
--
-- -- grocery_list_items + grocery_lists — restore owner-only shape
-- DROP POLICY IF EXISTS "grocery_list_items_delete" ON grocery_list_items;
-- DROP POLICY IF EXISTS "grocery_list_items_update" ON grocery_list_items;
-- DROP POLICY IF EXISTS "grocery_list_items_insert" ON grocery_list_items;
-- DROP POLICY IF EXISTS "grocery_list_items_select" ON grocery_list_items;
--
-- DROP POLICY IF EXISTS "grocery_lists_delete" ON grocery_lists;
-- DROP POLICY IF EXISTS "grocery_lists_update" ON grocery_lists;
-- DROP POLICY IF EXISTS "grocery_lists_insert" ON grocery_lists;
-- DROP POLICY IF EXISTS "grocery_lists_select" ON grocery_lists;
--
-- CREATE POLICY "grocery_lists_select" ON grocery_lists FOR SELECT USING (user_id = auth.uid());
-- CREATE POLICY "grocery_lists_insert" ON grocery_lists FOR INSERT WITH CHECK (user_id = auth.uid());
-- CREATE POLICY "grocery_lists_update" ON grocery_lists FOR UPDATE USING (user_id = auth.uid());
-- CREATE POLICY "grocery_lists_delete" ON grocery_lists FOR DELETE USING (user_id = auth.uid());
--
-- CREATE POLICY "grocery_list_items_select" ON grocery_list_items FOR SELECT USING (user_id = auth.uid());
-- CREATE POLICY "grocery_list_items_insert" ON grocery_list_items FOR INSERT WITH CHECK (user_id = auth.uid());
-- CREATE POLICY "grocery_list_items_update" ON grocery_list_items FOR UPDATE USING (user_id = auth.uid());
-- CREATE POLICY "grocery_list_items_delete" ON grocery_list_items FOR DELETE USING (user_id = auth.uid());
--
-- DROP INDEX IF EXISTS idx_grocery_lists_space;
--
-- ALTER TABLE grocery_list_item_recipes DROP COLUMN added_by;
-- ALTER TABLE grocery_lists DROP COLUMN space_id;
--
-- COMMIT;
