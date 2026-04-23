# [DRAFT] CC Prompt 1 — Phase 8A-CP1 Schema Foundation

> **⚠️ DRAFT v2.1 — second audit pass cleared.** v2 was cleared by second audit with one polish fix: SQL migration file handoff path now explicit (Tom drops at repo root, CC moves to supabase/migrations/). No other changes since v2. Generated 2026-04-23.

**Session type:** Execution
**Checkpoint:** 8A-CP1 — Phase 8 Schema Foundation (first executable Phase 8 prompt)
**Estimated duration:** Half to one session
**Dependencies:** None (fresh start of Phase 8)

---

## Context

Phase 8 introduces pantry staples as a new concept, a 3-tier grocery structure, Path B tracked-item staleness foundation (UI deferred post-F&F), expiration auto-fall-off, freezer thaw planning, and custom (non-ingredient) grocery items. All of these need schema changes before any UI work can start.

**This prompt executes the full Phase 8 schema foundation via a standalone SQL migration file.** Tom has already written the migration SQL in `phase_8_schema_migration.sql` at the top level of the outputs (to be placed in `supabase/migrations/`). Your job is to (1) place the SQL file in the right location, (2) verify it against current DB state, (3) update TypeScript types to match, (4) run verification checks. You do NOT execute the SQL — Tom pastes it into Supabase Dashboard manually per current workflow (CLI-based migrations deferred per P7-23).

**Why one migration, not several:** Phase 8 schema changes are interrelated (staples table references `ingredients`, `spaces`, and `user_profiles`; `last_confirmed_at` needs to be on both `pantry_items` and `pantry_staples`). Splitting creates ordering fragility. Supabase Dashboard wraps multi-statement pastes in a transaction by default — if any statement fails, all roll back. No partial state.

**Why no service changes:** Service updates land in separate checkpoints (8B-CP1 for staples service, 8C-CP1 for grocery tier routing, 8D-CP1 for matching upgrades). Each builds on this foundation.

**Broader Phase 8 context:** Full phase scope in `docs/planning/PHASE_8_PANTRY_INTELLIGENCE.md` v2.1. Wireframe prototypes will live at `docs/wireframes/phase_8/` after wireframe setup commit. v5 is the primary visual reference.

---

## Inputs to read

**Required:**
1. `docs/planning/PHASE_8_PANTRY_INTELLIGENCE.md` v2.1 — specifically the "Architecture → Data model additions" section. Contains the SQL that this prompt implements. Read top-to-bottom once for full context.
2. `phase_8_schema_migration.sql` (Tom will have placed this at the repo root before handing you this prompt) — the standalone SQL file Tom will paste into Supabase Dashboard. Your job is to move it to `supabase/migrations/20260424_phase_8_schema_foundation.sql` and update TypeScript types to match.
3. `lib/types/pantry.ts` — current `PantryItem`, `PantryItemInsert`, `PantryItemUpdate` shapes. You'll extend these in this checkpoint and add new `PantryStaple` types.
4. `lib/types/grocery.ts` — current `GroceryListItem` shapes + `AddedFrom`, `Priority` enums. Extend in this checkpoint.
5. `lib/pantryService.ts` — understand the `addPantryItem`, `addPantryItemToSpace`, `updatePantryItem` surface area. **Don't modify yet** (that's 8B-CP1) but note which functions will need `last_confirmed_at` bumping later.
6. Supabase CSVs in project root (`Supabase_Snippet_Supabase_Frigo_DB_Structure_Query_26.csv`, `Supabase_Snippet_List_Public_CHECK_Constraints.csv`, `Supabase_Snippet_List_Index_Definitions_in_Public_Schema.csv`) — current canonical DB schema. Verify existing columns before adding.
7. `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 — canonical SESSION_LOG entry format. You will use this exact format (not a custom one) for the session log write-up.
8. `docs/PK_CODE_SNAPSHOTS.md` — list of tier-1 PK snapshots. Check before writing SESSION_LOG (Rule E).

**Reference only:**
- `SHARED_PANTRIES_FEATURE_SPEC.md` — established pattern for space-scoped tables (pantry_items has `space_id`, `added_by`). `pantry_staples` follows the same pattern. Note the RLS uses `space_members` (NOT `space_memberships` — the first audit caught this).
- `lib/services/spaceService.ts` — confirms `space_members` table with columns `role`, `status`, `user_id`, `space_id`. Role values: `'owner' | 'member' | 'guest'`. Status values: `'accepted' | 'pending' | 'declined'`.

---

## Task

Three parts. Do them in order.

### Part 1 — Move the migration file

Tom will have placed `phase_8_schema_migration.sql` at the **repo root** (top-level of the project, same directory as `package.json`) before handing you this prompt.

Your task: move that file to `supabase/migrations/20260424_phase_8_schema_foundation.sql`. Create the `supabase/migrations/` directory if it doesn't exist (per P7-23 deferred work, migration tracking isn't formally set up yet but the directory convention is fine).

If `phase_8_schema_migration.sql` is NOT at the repo root when you look, STOP and flag in SESSION_LOG — don't proceed with Parts 2 and 3, and don't search the filesystem for it in other locations. The file's presence at repo root is a handoff precondition Tom needs to meet.

Do NOT modify the SQL content during the move unless verification (Part 2) surfaces issues that require adjustment. If you need to adjust, flag in SESSION_LOG and propose changes rather than silently editing.

### Part 2 — Verification against current DB state

Before Tom runs the migration, verify these in the DB structure CSV:

1. **`space_members` table exists** with columns `space_id`, `user_id`, `role`, `status`. Values for `status` include `'accepted'`. Values for `role` include `'owner'` and `'member'`. (This was a first-audit fix — confirm it's correct in the SQL.)
2. **`spaces` table exists** (for pantry_staples FK)
3. **`ingredients` table exists** (for pantry_staples FK)
4. **`user_profiles` table exists** (for added_by FK)
5. **`pantry_items` table exists** and does NOT already have `last_confirmed_at`, `discarded_at`, `discarded_reason`, or `thaw_planned_for` columns
6. **`grocery_list_items` table exists** and its `ingredient_id` column is currently NOT NULL (so the ALTER to DROP NOT NULL is required; if it's already nullable, the ALTER is a no-op but note in log)
7. **`user_pantry_preferences` table exists** (the migration adds a column; if the table doesn't exist, STOP and flag in log)
8. **`space_settings` table exists** (the migration adds a column; if the table doesn't exist, STOP and flag in log)
9. **No index name collisions** — check the Index Definitions CSV for existing `idx_pantry_staples_*`, `idx_pantry_items_active`, `idx_pantry_items_thawing`. If any exist with different definitions, adjust names in the SQL and flag.
10. **No CHECK constraint name collisions** — check the CHECK Constraints CSV for `pantry_staples_state_check`, `staple_has_identity`, `unique_staple_per_space`, `grocery_item_has_identity`. Adjust if needed.

### Part 3 — TypeScript type updates

Update in parallel:

**`lib/types/pantry.ts`:**
- Add `StapleState` type: `type StapleState = 'unknown' | 'good' | 'running_low' | 'out';`
- Add `PantryStaple`, `PantryStapleInsert`, `PantryStapleUpdate` interfaces matching the schema (see phase doc architecture section for fields)
- Extend `PantryItem`, `PantryItemInsert`, `PantryItemUpdate` with new optional fields: `last_confirmed_at?: string | null`, `discarded_at?: string | null`, `discarded_reason?: string | null`, `thaw_planned_for?: string | null`

**`lib/types/grocery.ts`:**
- Extend `GroceryListItem`, `AddGroceryItemParams`, `UpdateGroceryItemParams` with `priority_reason?: string | null`, `custom_name?: string | null`
- Change `ingredient_id` to `string | null` in these types to reflect nullable DB column
- Consider adding a `GroceryItemIdentity` helper type asserting "ingredient_id OR custom_name is set" at TypeScript level (matches the CHECK constraint) — judgment call, don't over-engineer

**Don't update services yet.** Type updates only. Service updates in 8B-CP1 and 8C-CP1.

---

## Constraints

1. **SQL file is load-bearing.** Don't modify the content of `phase_8_schema_migration.sql` unless verification surfaces a real conflict. Any changes require flagging in SESSION_LOG.
2. **Don't run migrations yourself.** The file is ready for Tom to paste into Supabase Dashboard. Leave a clear path to the file in SESSION_LOG.
3. **Verify existing schema before confirming.** Use the DB structure CSV and CHECK constraints CSV to confirm column names, table names, existing constraints. If anything conflicts, flag in SESSION_LOG — don't silently resolve.
4. **No service changes.** Don't touch `pantryService.ts`, `groceryService.ts`, `groceryListsService.ts`. Services are separate checkpoints.
5. **No UI changes.** Don't touch any screen or component files.
6. **Type updates only for new/changed shapes.** Don't refactor existing types beyond what these additions require.
7. **Preserve existing RLS patterns.** `pantry_staples` RLS copies `pantry_items` RLS where possible. If `pantry_items` RLS differs meaningfully from what's in the SQL file, flag — don't silently adjust.
8. **Accessibility check.** This is a schema-only checkpoint — no UI, no tap targets. Accessibility verification does not apply here. (Future CP prompts that touch UI will add the verification bullet.)
9. **PK snapshot staleness check (Rule E).** Before writing SESSION_LOG, run Rule E check against `docs/PK_CODE_SNAPSHOTS.md` for `lib/types/pantry.ts` and `lib/types/grocery.ts`. Flag any tier-1 snapshots needing refresh.
10. **Session log format: canonical only.** Write SESSION_LOG entry per canonical format in `docs/DOC_MAINTENANCE_PROCESS.md` Section 8. Required fields: **Phase:**, **Prompt from:**, body, **Recommended doc updates:** (listing all four living docs — DEFERRED_WORK, PROJECT_CONTEXT, FF_LAUNCH_MASTER_PLAN, active phase doc PHASE_8_PANTRY_INTELLIGENCE), **Recommended next steps for Tom:**, **Surprises / Notes for Claude.ai:**. Add entry at top of `docs/SESSION_LOG.md`.

---

## Verification steps

Before marking this checkpoint complete:

1. **Migration SQL placed at `supabase/migrations/20260424_phase_8_schema_foundation.sql`.**
2. **Pre-migration verification checklist completed** (all 10 items in Part 2). Any conflicts flagged in SESSION_LOG.
3. **TypeScript compiles clean** — `npx tsc --noEmit` exits 0 after type updates.
4. **Nothing imports from the types you changed is broken** — grep for `PantryItem`, `GroceryListItem`, `PantryItemInsert` and confirm consumers still compile. They should; we're adding optional fields only.
5. **SQL file ends with a clearly-commented rollback block** (it already does — verify it survived the copy).
6. **Rule E check completed.** PK snapshots for `lib/types/pantry.ts` and `lib/types/grocery.ts` either refreshed or flagged as needing refresh.
7. **SESSION_LOG written in canonical format** (not a custom template). Entry added at top of `docs/SESSION_LOG.md`.

---

## Open questions to flag (if encountered)

STOP and flag in SESSION_LOG rather than silently resolving:

1. **`user_pantry_preferences` table doesn't exist** — where do per-user pantry prefs live today? Flag for Tom.
2. **`space_settings` table doesn't exist** — flag.
3. **`space_members` has different column names** (e.g., `member_status` vs `status`). Match what's actually there in the SQL — but flag so Tom reviews.
4. **`grocery_list_items.ingredient_id` is already nullable** — the ALTER is a no-op. Note in log but don't remove the statement.
5. **A proposed index collides with an existing one** — adjust name, flag.
6. **RLS policies on `pantry_items` differ from what's in the SQL** — match the existing pattern (copy it if needed), flag.
7. **`ingredients.typical_store_section` is unpopulated or inconsistent** — out of scope for this CP (8C will handle), but note if you observe the data quality.

---

## What this unblocks

After this checkpoint:
- **8A-CP2** through **8A-CP4** can build the pantry polish UI + expiration fall-off job
- **8B-CP1** can build `pantryStaplesService.ts`
- **8B-CP4** can wire cook post depletion to bump `last_confirmed_at`
- **8C-CP1** can build 3-tier grocery routing using `priority_reason`
- **8C-CP7** can build Thawing tray using `thaw_planned_for`
- **8D-CP1** (later) has the cleaner foundation to work against

---

## Notes for the audit instance

This prompt is intentionally light because the heavy lifting (the SQL) is a standalone file Tom pastes directly. The prompt focuses on verification, placement, and type updates. The audit instance should verify:

- File paths are correct (`supabase/migrations/`, `lib/types/`)
- Referenced docs exist (`DOC_MAINTENANCE_PROCESS.md` Section 8, `PK_CODE_SNAPSHOTS.md`)
- The 10-item verification checklist catches everything it needs to
- The constraint list is complete (not over-restrictive, not under-restrictive)
- Nothing drifted during the rename from 8B-CP1 to 8A-CP1

Flag any tightening opportunities.
