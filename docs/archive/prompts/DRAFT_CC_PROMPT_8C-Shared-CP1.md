# [DRAFT v3] CC Prompt — 8C-Shared-CP1: Schema + RLS + migration

> Phase 8C-Shared sub-phase, Checkpoint 1. F&F-prerequisite. Adds `grocery_lists.space_id` for optional space-sharing, `grocery_list_item_recipes.added_by` for recipe authorship, RLS rewrites widening `grocery_lists` + `grocery_list_items` + `grocery_list_item_recipes` to accepted space members, and backfills existing lists to "Home" space.
>
> Estimated work: ~1.5 hr (mostly verification + types + SESSION_LOG; the migration SQL is pre-authored, has already been applied, and verified during the planning chat — Tom hands you the verification query results inline with this prompt).
>
> See `docs/PHASE_8_PANTRY_INTELLIGENCE.md` for the architectural decisions D8C-Shared-1 through D8C-Shared-8.
>
> **v2 revision notes:** post-audit: junction-table RLS widening folded into the migration scope (was previously deferred to CP3 per locked decisions; surfaced as silent-break risk during audit). Verification flow restructured: CC does source-code-derived verification, Tom pastes Dashboard query results into SESSION_LOG. Service path corrected to `lib/groceryListsService.ts` (top-level, not `lib/services/`). File-location search order fixed to docs/ first (matches 8A-CP1 precedent).
>
> **v3 revision notes:** post-application discovery: planning-session verification (run 1) surfaced 9 pre-existing legacy policies across the three affected tables using a third naming convention beyond the two the original DROPs covered ("Users can create...", "Users can view own grocery list", "Users can [...] own grocery items", "Users can [...] junction rows for their own list items"). They were dropped via ad-hoc cleanup query during the planning chat to clear pg_policies state, AND a new Section 5c was folded into the migration file so the cleanup is replayable on a fresh dev DB clone or post-rollback reapply. Migration was applied to the live Supabase DB BEFORE Section 5c was added — meaning the live DB matches the file's intended end-state, but the file on disk now contains additional Section 5c statements that were applied separately. CC should treat the migration file as the authoritative replayable artifact regardless.

---

## Context

Phase 8C-Shared is a 4-CP sub-phase that adds shared-grocery-list infrastructure, sequenced before paused 8C-CP4b. CP1 is purely additive at the schema layer:

- `grocery_lists.space_id UUID NULL REFERENCES spaces(id) ON DELETE SET NULL` — optional space attachment. NULL = private; set = shared with all accepted members.
- `grocery_list_item_recipes.added_by UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL` — column added now, populated at insert in CP3.
- `idx_grocery_lists_space` partial index on `(space_id) WHERE space_id IS NOT NULL`.
- RLS rewrite on `grocery_lists` (4 policies), `grocery_list_items` (4 policies), and **`grocery_list_item_recipes` (4 policies)**. The junction-table rewrite uses parent-RLS-delegation — its policies say "you can see this junction row if you can see the parent `grocery_list_items` row," and Postgres applies `grocery_list_items`' RLS to the inner subquery. Without this, CP2a's parent-ownership-based junction policies would silently break recipe pills for shared-list members in CP3.
- Backfill: all existing rows in `grocery_lists` are UPDATEd to `space_id = '7aa945ab-fb32-4197-ae11-e6dbd3392587'` ("Home"). Hardcoded UUID per D8C-Shared-2 (single-user dev DB at migration time).

**Behavior changes after CP1:** none from the user's perspective. Service-layer queries still filter by `user_id` (CP2 widens them); creation modal still has no sharing toggle (CP2 adds it); routing still owner-only (CP3 widens it); UX visibility unchanged (CP4 adds subtitle/icon). CP1 is the schema-and-policy floor everything else builds on.

**Migration application:** Tom applies the SQL via Supabase Dashboard **before handing this prompt to CC**. The SQL is staged at `docs/` (or repo root) as `phase_8c_shared_cp1_migration.sql`. CC's job is to move it to the canonical migrations directory and update TypeScript types to match.

**Tom's manual prerequisite (run BEFORE applying the migration):** add Mary Frigo to "Home" space via:
```sql
INSERT INTO space_members (space_id, user_id, role, status, joined_at)
VALUES (
  '7aa945ab-fb32-4197-ae11-e6dbd3392587',  -- "Home"
  '7c1616f6-517c-48bc-a96b-fd950142c1d7',  -- Mary Frigo
  'member',
  'accepted',
  NOW()
)
ON CONFLICT (space_id, user_id) DO NOTHING;
```
This is user-data setup, not migration logic. Tom runs it once. CC does NOT run this and does NOT include it in the moved migration file.

---

## Inputs to read

**Required:**
1. `docs/PHASE_8_PANTRY_INTELLIGENCE.md` — read the `### 8C-Shared` sub-phase block + Decisions Log entries D8C-Shared-1 through D8C-Shared-8 for full architectural context.
2. `phase_8c_shared_cp1_migration.sql` (Tom places at `docs/` or repo root before handing this prompt to CC) — the standalone SQL file Tom pasted into Supabase. CC moves this file; do not modify its contents.
3. `lib/types/grocery.ts` — current `GroceryList`, `GroceryListItemRecipe`, `CreateGroceryListParams` shapes. Extend in this checkpoint.
4. `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 — canonical SESSION_LOG entry format. Use this exact format.
5. `docs/PK_CODE_SNAPSHOTS.md` — list of tier-1 PK snapshots. Check before writing SESSION_LOG (Rule E).

**Reference only (do not modify):**
- `lib/groceryListsService.ts` — the service file that CP2 will widen. Don't touch in CP1. (Note: this file is at `lib/` top-level, not `lib/services/` — the codebase has mixed convention; this particular service is at root.)
- `supabase/migrations/20260424_phase_8_schema_foundation.sql` — reference for migration-file naming convention and the EXISTS-based RLS pattern used on `pantry_staples`.

---

## Task

Three parts. Do them in order.

### Part 1 — Move the migration file

Tom will have placed `phase_8c_shared_cp1_migration.sql` at one of:
- **`docs/`** (preferred — matches 8A-CP1 precedent)
- **Repo root** (fallback)

Search order: try `docs/` first, then repo root. If found in neither, STOP and flag in SESSION_LOG. Don't proceed with Parts 2 and 3 and don't search elsewhere on the filesystem — the file's presence in one of these two locations is a handoff precondition Tom needs to meet.

Move the file to `supabase/migrations/20260428_phase_8c_shared_cp1_schema.sql`. (Date is today's date in YYYYMMDD format; if today is not 2026-04-28 when CC runs, use the actual current date.)

Per Rule C (verify git tracking before `git mv`): if the file is untracked, use plain `mv` + `git add` at destination, NOT `git mv`.

Do NOT modify the SQL content during the move. If verification (Part 2) surfaces issues that require adjustment, flag them in SESSION_LOG and propose changes — don't silently edit.

### Part 2 — Verify post-migration DB state

**Verification flow:** Tom applied the migration via Supabase Dashboard during the planning chat that authored this prompt. The 13 Section 6 verification queries were run + cleaned up; full results below. CC does **source-code-derived verification only** — confirms the migration file's expected post-state matches what the rest of the codebase assumes. CC does NOT have direct DB access in this setup.

CC's source-code verification asserts:

1. The migration file content matches what was authored (no in-flight edits during the move).
2. The migration file's claimed post-state is internally consistent — e.g., the FK clauses match the column comments, the verification queries in Section 6 match the actual policy/index/column names the migration creates.
3. No code in the working tree currently references `grocery_lists.space_id` or `grocery_list_item_recipes.added_by` as if they already exist (i.e., no premature CP2/CP3 work leaked in).
4. The 18 backfilled CP2a junction rows referenced in Section 6o are still expected to exist (cross-check via `lib/types/grocery.ts` having the `GroceryListItemRecipe` interface from CP2a).

If any of these source-code assertions fail, flag in SESSION_LOG.

**DB-state verification results from planning chat (paste verbatim into SESSION_LOG):**

| Check | Result |
|-------|--------|
| 6a — `space_id` column | ✅ uuid, nullable |
| 6b — `added_by` column | ✅ uuid, nullable |
| 6c — `lists_unbackfilled` | ✅ 0 |
| 6d — backfill grouping | ✅ 1 row, space_id `7aa945ab-...`, count 5 |
| 6e — FK on `space_id` | ✅ `grocery_lists_space_id_fkey`, delete_rule `SET NULL` |
| 6f — FK on `added_by` | ✅ `grocery_list_item_recipes_added_by_fkey`, delete_rule `SET NULL` |
| 6g — partial index | ✅ `idx_grocery_lists_space ... WHERE (space_id IS NOT NULL)` |
| 6h — grocery_lists policies | ✅ 4 policies, 0 unexpected (post-5c cleanup) |
| 6i — grocery_lists policy details | ✅ delete / insert / select / update — all snake_case |
| 6j — grocery_list_items policies | ✅ 4 policies, 0 unexpected (post-5c cleanup) |
| 6k — grocery_list_items policy details | ✅ delete / insert / select / update — all snake_case |
| 6l — grocery_list_item_recipes policies | ✅ 4 policies, 0 unexpected (post-5c cleanup) |
| 6m — grocery_list_item_recipes policy details | ✅ delete / insert / select / update — all snake_case |
| 6n — backfill smoke-test | ✅ 5 lists, all populated with `7aa945ab-...` |
| 6o — junction rows preserved | ✅ count: 15 (CP2a's 18 minus a few presumed deleted between CP2a and CP1) |

**Discovery during planning verification:** initial run of 6h/6j/6l surfaced 9 orphan pre-existing policies missed by the migration's defensive DROPs:
- `grocery_lists`: `Users can create their own grocery lists` (uses 'create' not 'insert')
- `grocery_list_items` (4): `Users can view own grocery list`, `Users can [insert|update|delete] own grocery items`
- `grocery_list_item_recipes` (4): `Users can [read|insert|update|delete] junction rows for their own list items`

These were dropped via ad-hoc cleanup SQL during the planning chat. The cleanup was then folded into the migration file as Section 5c so a fresh-DB replay will produce the same end-state. The live DB now matches the migration file's intended end-state.

CC: include this discovery in the SESSION_LOG entry's "Surprises / Notes for Claude.ai" section as material context — 9 orphans across 3 tables is a non-trivial finding that should be on the record.

### Part 3 — Update TypeScript types

Edit `lib/types/grocery.ts` to extend three types:

**3a. `GroceryList` interface** — add `space_id` field:
```typescript
export interface GroceryList {
  id: string;
  user_id: string;
  // ... existing fields ...
  space_id: string | null;  // Phase 8C-Shared-CP1: optional space attachment for sharing
  // ... rest of existing fields ...
}
```
Place the `space_id` field directly after `user_id` for grouping with the ownership-related fields.

**3b. `GroceryListItemRecipe` interface** — add `added_by` field:
```typescript
export interface GroceryListItemRecipe {
  id: string;
  grocery_list_item_id: string;
  recipe_id: string;
  recipe_title: string;
  recipe_quantity_amount: number | null;
  recipe_quantity_unit: string | null;
  added_by: string | null;  // Phase 8C-Shared-CP1: user_profiles.id of the user who added this attribution; populated from auth.uid() in CP3, NULL on backfilled rows
  created_at: string;
}
```

**3c. `CreateGroceryListParams` interface** — add `space_id` optional field:
```typescript
export interface CreateGroceryListParams {
  // ... existing fields ...
  space_id?: string | null;  // Phase 8C-Shared-CP1: optional space attachment; CP2 wires the toggle in CreateGroceryListModal
}
```

Do NOT update `lib/groceryListsService.ts` in this checkpoint. Service-layer changes are 8C-Shared-CP2's scope. The types are added now so CP2 can pass values through without re-touching `lib/types/grocery.ts`.

Do NOT update `getRecipesForItem` or `getItemsWithRecipes` in `lib/groceryListsService.ts` to read the new `added_by` column — that's CP3's scope. The Row type they cast to internally can be updated to include `added_by: string | null` if it's straightforward, but is not required.

---

## Constraints

1. **Do NOT modify the migration SQL** during the file move. If you spot an issue, propose changes in SESSION_LOG and ask Tom for direction — don't silently edit.
2. **Do NOT modify any service files** (`lib/groceryListsService.ts`, `lib/groceryService.ts`, `lib/pantryStaplesService.ts`, etc.). CP1 is type-level only.
3. **Do NOT modify any UI components or screens.** CP1 is type-level only.
4. **Do NOT modify the migration to include the Mary-add-to-Home INSERT.** That's user-data setup Tom runs separately. The header comment in the migration documents the SQL but does NOT execute it (the INSERT is inside a multi-line comment block, lines 23-31).
5. **DO note that `grocery_list_item_recipes` RLS IS being widened in CP1.** This is a v2-revision change from the original scope. The junction's policies are rewritten using parent-RLS-delegation (Section 5b of the migration). This was originally framed as "don't touch grocery_list_item_recipes RLS" but a post-draft audit surfaced that CP2a's existing parent-ownership policies would silently break for shared-list members in CP3 without this rewrite. The rewrite is in scope; do not flag as out-of-bounds.
6. **Verify before authoring.** If DB state doesn't match what the migration claims to do, STOP. Don't extend types against a state that doesn't exist. (Source-code-derived verification per Part 2 above; Tom validates against actual DB state post-session.)
7. **Migration file naming.** Use `supabase/migrations/YYYYMMDD_phase_8c_shared_cp1_schema.sql`. YYYYMMDD = today's date when CC runs.
8. **Match codebase precedent.** RLS uses EXISTS pattern; types use `string | null` not `string | undefined` for nullable DB columns; column comments cite the CP that added them. Junction RLS uses parent-RLS-delegation pattern (no restated membership check) so it's robust to future parent RLS changes.

---

## Verification checklist

Confirm before submitting:

- [ ] Migration file moved from `docs/` (or repo root fallback) to `supabase/migrations/YYYYMMDD_phase_8c_shared_cp1_schema.sql`
- [ ] Source-code-derived verification (4 source-code assertions in Part 2) all pass
- [ ] `lib/types/grocery.ts`: `GroceryList.space_id` added
- [ ] `lib/types/grocery.ts`: `GroceryListItemRecipe.added_by` added
- [ ] `lib/types/grocery.ts`: `CreateGroceryListParams.space_id` added (optional)
- [ ] `tsc --noEmit` passes (no new TypeScript errors introduced)
- [ ] No service files modified
- [ ] No UI files modified
- [ ] SESSION_LOG entry written per `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 format
- [ ] SESSION_LOG entry contains the **DB-state verification results table** from Part 2 above (paste verbatim, all 15 rows)
- [ ] SESSION_LOG entry's "Surprises / Notes" section captures the **9-orphan discovery** + Section 5c fold-in
- [ ] PK_CODE_SNAPSHOTS staleness flag set on `lib/types/grocery.ts` (HIGH, Last Touched By = "Phase 8C-Shared-CP1") per Rule E
- [ ] Surprises / notes for Claude.ai documented at the end of the SESSION_LOG entry, including: (a) ON DELETE SET NULL semantic on space_id (if "Home" space is deleted, lists revert to private — non-owner members lose access; this is by design, not a bug); (b) any deviation in policy names, FK behavior, backfill row count, or types-file shape

---

## SESSION_LOG entry format

Use the canonical format from `docs/DOC_MAINTENANCE_PROCESS.md` Section 8. Include:

- **Phase:** 8C-Shared-CP1 (schema + RLS + migration)
- **Prompt from:** `docs/DRAFT_CC_PROMPT_8C-Shared-CP1.md` (or whatever path Tom uses)
- **Status:** Shipped / Blocked / Partial — with one-sentence reason
- **Scope:** What you did (file move + source-code verification + types). Reference D8C-Shared-1..8 by ID where decisions trace through. Note the v2-revision junction RLS widening (Section 5b) closed the audit-surfaced silent-break risk on CP3 recipe pills, AND the v3-revision orphan-policy cleanup (Section 5c) discovered during planning verification cleared 9 legacy policies across 3 tables.
- **Files modified:** Full list with line counts where relevant
- **Source-code verification table:** 4-row table mapping check # → outcome → evidence (the source-code-derived checks; DB-state was settled in the planning chat — paste the 15-row table from Part 2)
- **DB-state verification results:** 15-row table from Part 2 of this prompt, pasted verbatim
- **No `_pk_sync/` staging this session** — no living docs touched on CC's initiative; SESSION_LOG and PK_CODE_SNAPSHOTS staleness flag are Rule-governed mechanical edits, not strategic content authorship.
- **Recommended next steps for Tom:**
  - Commit suggestion (e.g., `feat(schema): Phase 8C-Shared-CP1 — grocery_lists.space_id + grocery_list_item_recipes.added_by + RLS rewrite (incl. junction + legacy cleanup)`)
  - Reconciliation needed in living docs (Claude.ai will handle in a follow-up doc-hygiene chat) — including a new deferred row for "third-RLS-naming-convention discovery process" if the planning chat decides it's worth tracking
  - Queue 8C-Shared-CP2 once Claude.ai drafts that prompt
- **Surprises / Notes for Claude.ai:**
  - **9-orphan-policy discovery during planning verification.** Defensive DROP lists in Sections 4, 5, 5b covered two naming conventions; a third pre-existing convention (using "create"/"view own grocery list"/"... own grocery items"/"junction rows for their own list items") shipped from earlier phases and survived. Live DB now clean post-Section 5c application. Worth flagging in PROCESS_WATCHPOINTS if a pattern emerges across future RLS migrations — could indicate authoring discipline gap or, alternatively, an organic accumulation of inherited Supabase auto-generated policies that need a one-time audit.
  - ON DELETE SET NULL semantic on `grocery_lists.space_id` — if "Home" is deleted, lists revert to private; owner retains access, members lose it. Acceptable behavior, not a bug.
  - Any deviation in policy names, FK behavior, backfill row count, or types-file shape from prompt assumptions
  - If `tsc --noEmit` surfaces new errors that aren't related to this CP, flag separately

---

## Open questions for CC to flag

If any of the following are NOT true at runtime, flag in SESSION_LOG (don't silently work around):

- The migration file is at `docs/` or repo root (not somewhere else)
- `lib/types/grocery.ts` still has the `GroceryListItemRecipe` interface in the shape captured by the 2026-04-27 PK snapshot (no surprise refactor since)
- The service file `lib/groceryListsService.ts` exists at top-level `lib/` (not `lib/services/`) — recent SESSION_LOG entries reference both paths in different contexts; CP1 doesn't modify it but path correctness matters for the constraint check
