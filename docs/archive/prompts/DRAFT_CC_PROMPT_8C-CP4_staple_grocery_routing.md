# CC Prompt — Phase 8C-CP4 — Staple → Grocery Auto-Routing

**Phase:** 8C (Pantry Intelligence — Grocery Integration)
**CP:** 4 of 8 numbered CPs in the 8C build plan
**Authored:** 2026-04-27 (planning chat) for execution
**Estimated effort:** ~2 hours
**Prereq CPs shipped:** 8C-CP1 through 8C-CP3 (3-tier restructure, store_name schema, typical_store_section backfill, cross-list confirm, recipe attribution junction, view toggle + recipe pills + filter)

---

## Context

When a pantry staple's state transitions to `'out'`, an item should automatically appear on the user's grocery list. When that item is checked off (in cart), the staple should automatically restore to `'good'`. CP4 wires this loop.

Why now: Tom marked 3 staples (lemon, red wine vinegar, cumin) as `'out'` during CP3 smoke-test setup and noticed they didn't propagate to grocery. That gap is exactly what CP4 closes. Those 3 staples are real test data for verification.

Architectural decisions (set in planning chat 2026-04-27, captured here for execution):
- **D8C-CP4-1.** Routing fires inside `cycleStapleState` and `setStapleState` themselves, gated on `newState === 'out'`. No new orchestrator. Catches all three state-change call sites (tap cycle, cook-depletion apply, cook-depletion undo) automatically.
- **D8C-CP4-2.** "Primary" grocery list = most-recently-updated `is_active=true` list belonging to the **acting user** (the one who triggered the state change, resolved via `supabase.auth.getUser()`). Lists are user-scoped in the schema, not space-scoped — no `space_id` column on `grocery_lists`. Auto-create a list named `'Groceries'` for the user if zero active lists exist. Multi-user shared spaces: routing follows the actor, not the staple's `added_by`.
- **D8C-CP4-3.** Existing-item dedup is two-stage: Stage 1 matches `source_staple_id`, Stage 2 falls back to `ingredient_id` / `custom_name`. Stage 2 picks `ORDER BY updated_at DESC LIMIT 1` — leave any duplicates alone.
- **D8C-CP4-4.** Always overwrite `priority_reason` to `'staple · out'` on routing — even if the matched row had a user-set value. Preserves staple-ness as the structural fact for the CP3 pill render. (Follow-up P8-20 will switch pill render to `source_staple_id IS NOT NULL`, removing the substring-match brittleness — deferred.)
- **D8C-CP4-5.** Reverse direction fires on `is_in_cart` transition `false → true` only. Does not fire on un-check (correction) or delete (intent reversal). Restores staple to `'good'`, bumps `last_confirmed_at`.
- **D8C-CP4-6.** Schema diff is one column + one partial index: `grocery_list_items.source_staple_id UUID NULLABLE REFERENCES pantry_staples(id) ON DELETE SET NULL` plus `idx_gli_source_staple_id ON grocery_list_items(source_staple_id) WHERE source_staple_id IS NOT NULL`.
- **D8C-CP4-7.** State scope for CP4 is `'out'` only. `'running_low'` is a separate small CP if the routing pattern works as expected.
- **D8C-CP4-8.** New routed rows use `quantity_display=1`, `unit_display='unit'`, `added_from='staple'`. The `added_from` CHECK constraint is extended in this CP's migration to add `'staple'` as a fifth enum value (existing values: `'recipe'`, `'pantry'`, `'manual'`, `'regular'`). `'pantry'` retains its existing semantic of "manually added from pantry tab" and is NOT reused for staple routing. (`'unit'` is Tom's pick for fallback `unit_display` — defensible "intentionally unitless" semantic. If during draft you find empty string is genuinely cleaner with the existing UI concatenation, defer to your read and flag in SESSION_LOG.)

---

## Inputs to read (in this order)

1. `lib/pantryStaplesService.ts` — `cycleStapleState` (line 359), `setStapleState` (line 390), the surrounding type definitions (`PantryStaple`, `StapleState`).
2. `lib/groceryListsService.ts` — `addItemToList` (~line 580–650), `updateListItem` (~line 700–730). Note that `addItemToList`'s insert path does NOT currently include `priority`, `priority_reason`, `added_from`, `custom_name`, or `source_staple_id` fields. CP4's new routing function will do its own insert with the full field set rather than extending `addItemToList`.
3. `lib/types/grocery.ts` — `GroceryListItem` interface. Add `source_staple_id: string | null` field.
4. `lib/types/pantry.ts` — `PantryStaple` interface (no changes).
5. `lib/cookDepletionService.ts` — confirm that lines 295 and 362 call `setStapleState`. No changes here, but verify the call sites will get routing automatically once `setStapleState` is updated.
6. `screens/GroceryListDetailScreen.tsx` — `handleToggleItem`. Add the reverse-direction logic here on check-on transitions where `item.source_staple_id !== null`.
7. `components/pantry/StaplesGrid.tsx` — confirm no changes needed (calls `cycleStapleState` which will auto-route after CP4).
8. `components/pantry/StapleCell.tsx` — confirm no changes needed.
9. `components/GroceryListItem.tsx` — pill render is unchanged; confirm `priority_reason='staple · out'` will substring-match the existing CP3 pill logic.

Schema reference: `Supabase_Snippet_Schema_Column_Details_with_PK_FK_Metadata.csv` — confirms `quantity_display NOT NULL CHECK > 0`, `unit_display NOT NULL`, `priority CHECK in ('needed','nice_to_have')`, `added_from CHECK in ('recipe','pantry','manual','regular')`, and the existing `grocery_item_has_identity` CHECK.

---

## Tasks (in order)

### Task 1 — P8-19 fold-in (3-line fix)

In `lib/groceryListsService.ts`, function `addIngredientsToDefaultList`. The function accepts a `recipeId` parameter but does not forward it to each `addItemToList` call. Add `recipeId: params.recipeId` to the params object passed to `addItemToList`. Also forward `recipeQuantityAmount` and `recipeQuantityUnit` if those are part of the per-ingredient params. Quick fix — should be 3–6 lines net.

Verify: any caller of `addIngredientsToDefaultList` that passes `recipeId` ends up creating `recipe_grocery_item_attributions` junction rows for each added ingredient.

### Task 2 — Schema migration

Create migration file `supabase/migrations/[timestamp]_8c_cp4_staple_routing.sql`:

```sql
-- Phase 8C-CP4: Staple → grocery auto-routing.
-- (1) Adds back-pointer on grocery_list_items to the staple that triggered the route,
--     enabling Stage-1 dedup and reverse-direction restoration on checkoff.
-- (2) Extends the added_from CHECK to recognize 'staple' as a fifth source semantic,
--     distinct from 'pantry' (which means "user added manually from the pantry tab").

ALTER TABLE grocery_list_items
  ADD COLUMN source_staple_id UUID NULL
    REFERENCES pantry_staples(id) ON DELETE SET NULL;

CREATE INDEX idx_gli_source_staple_id
  ON grocery_list_items(source_staple_id)
  WHERE source_staple_id IS NOT NULL;

COMMENT ON COLUMN grocery_list_items.source_staple_id IS
  'Phase 8C-CP4: when set, this row was created or last-updated by a staple-out auto-route. Checking this item off restores the linked staple to state=good.';

-- Drop and re-add added_from CHECK with 'staple' included.
ALTER TABLE grocery_list_items
  DROP CONSTRAINT grocery_list_items_added_from_check;

ALTER TABLE grocery_list_items
  ADD CONSTRAINT grocery_list_items_added_from_check
  CHECK (added_from = ANY (ARRAY['recipe'::text, 'pantry'::text, 'manual'::text, 'regular'::text, 'staple'::text]));
```

Apply via Supabase migration tooling (existing project pattern). Verify the column appears in the schema after apply, and that an insert with `added_from='staple'` succeeds while invalid values still fail.

### Task 3 — Type updates

Add `source_staple_id: string | null` to the `GroceryListItem` interface in `lib/types/grocery.ts`. Confirm derived types (`GroceryListItemWithIngredient`, anything else that extends/picks from `GroceryListItem`) propagate the new field.

### Task 4 — `routeStapleToGroceryList` service function

Add new exported function in `lib/pantryStaplesService.ts` (or sibling file if you prefer separation; service-layer-only either way):

```typescript
/**
 * Phase 8C-CP4. Auto-route a staple-out event to the user's primary grocery list.
 * Idempotent: re-routing a staple that already has a routed item is a no-op promotion.
 *
 * Algorithm:
 * 1. Resolve acting user (auth.getUser); resolve primary list (user's most-recently-updated active list; auto-create if none)
 * 2. Stage 1 match by source_staple_id — if hit, promote priority + refresh priority_reason
 * 3. Stage 2 match by ingredient_id / custom_name (ORDER BY updated_at DESC LIMIT 1) — if hit, link source_staple_id and promote
 * 4. Insert new row if no match
 *
 * Always overwrites priority_reason to 'staple · out' (D8C-CP4-4).
 * Throws if staple not found.
 */
export async function routeStapleToGroceryList(stapleId: string): Promise<void>
```

Implementation specifics:

**Step 4a — Resolve acting user.** First call inside `routeStapleToGroceryList`. Use the established codebase pattern (see `screens/PantryScreen.tsx:442` for the form):

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  console.warn('⚠️ routeStapleToGroceryList: no auth user; soft-failing');
  return;
}
```

Soft-fail with a log and return if auth resolution fails — should not happen in normal flow since the caller (`cycleStapleState` / `setStapleState`) already required auth, but defensive against any edge case.

**Step 4b — Fetch staple.** Need `staple.id`, `staple.ingredient_id`, `staple.custom_name`. If `ingredient_id` is set, also fetch `ingredients.name` for the insert path's display fallback (in case Stage 3 runs and we need a sensible value). Use existing helpers if any. Note: `staple.space_id` is NOT used for primary-list scoping (lists are user-scoped, not space-scoped — see D8C-CP4-2).

**Step 4c — Resolve primary list.** Query the acting user's lists, not the staple's space:

```sql
SELECT id, updated_at FROM grocery_lists
WHERE user_id = $userId AND is_active = true
ORDER BY updated_at DESC
LIMIT 1
```

If zero rows: call `createGroceryList({ user_id: userId, name: 'Groceries' })` (existing service function, line 155 of `groceryListsService.ts`). Use the new list's id as primary.

**Step 4d — Stage 1 match.**

```sql
SELECT id, priority, priority_reason, is_in_cart FROM grocery_list_items
WHERE list_id = $primaryListId AND source_staple_id = $stapleId
LIMIT 1
```

If hit: call `updateListItem(item.id, { priority: 'needed', priority_reason: 'staple · out' })`. Done. Return.

**Step 4e — Stage 2 match (only if Stage 1 missed).**

```sql
SELECT id FROM grocery_list_items
WHERE list_id = $primaryListId
  AND (
    (ingredient_id IS NOT NULL AND ingredient_id = $stapleIngredientId)
    OR (ingredient_id IS NULL AND custom_name = $stapleCustomName)
  )
ORDER BY updated_at DESC
LIMIT 1
```

If hit: call `updateListItem` with `{ priority: 'needed', priority_reason: 'staple · out', source_staple_id: stapleId }`. Note that `updateListItem` currently does NOT accept `source_staple_id` as an updatable field — extend its signature to include it. Done. Return.

**Step 4f — Stage 3 insert (no match).** Insert new row directly:

```typescript
{
  list_id: primaryListId,
  user_id: user.id,                              // resolved in Step 4a
  ingredient_id: staple.ingredient_id,           // nullable, fine
  custom_name: staple.custom_name,                // nullable, but at least one of these must be set per CHECK
  quantity_display: 1,
  unit_display: 'unit',
  priority: 'needed',
  priority_reason: 'staple · out',
  added_from: 'staple',                           // CHECK extended in this CP's migration
  source_staple_id: staple.id,
  is_in_cart: false,
}
```

Verify the `grocery_item_has_identity` CHECK is satisfied (at least one of `ingredient_id`, `custom_name` is set — staples themselves enforce this on creation, so it should always pass).

### Task 5 — Wire routing into `cycleStapleState` and `setStapleState`

Modify `cycleStapleState` (line 359):
- After the successful update, check the resolved new state on the returned row. If `'out'`, call `await routeStapleToGroceryList(stapleId)`.
- Wrap the routing call in try/catch — log and swallow errors, do not fail the state-change. State change succeeded; routing failure is a soft fail (user can manually add to list).

Modify `setStapleState` (line 390):
- After the successful update, if `newState === 'out'`, call `await routeStapleToGroceryList(stapleId)`.
- Same try/catch swallow pattern.

**Do not** change the function signatures or return types. Existing callers continue to work.

### Task 6 — Reverse direction in `GroceryListDetailScreen.handleToggleItem`

On the check-on transition (item is being toggled from `is_in_cart=false` to `is_in_cart=true`):
- After the existing checkoff logic completes, check `item.source_staple_id`. If non-null:
  - Call `setStapleState(item.source_staple_id, 'good')`.
  - Wrap in try/catch — log and swallow on error (checkoff already succeeded; staple restore is a soft fail).
- Do NOT fire on un-check (true → false).
- Do NOT fire on delete.

Confirm by reading the existing `handleToggleItem` flow; the CP2 cross-list confirmation already runs here, so add the reverse-direction logic in a position that doesn't conflict with CP2's user prompt.

### Task 7 — DEFERRED_WORK note for SESSION_LOG only

This CP is execution scope, not doc-hygiene scope. **Do not** edit `DEFERRED_WORK.md` directly. The two follow-up items surfaced in planning (P8-20: pill render switch from substring match to `source_staple_id IS NOT NULL`; P8-21: cookDepletion undo cleanup of routed grocery items) are explicitly held back for the post-CP4 doc-hygiene CP.

In the SESSION_LOG entry for this CP, note:
- **P8-19 — closed.** Inline fix shipped in Task 1; `addIngredientsToDefaultList` now forwards `recipeId` to `addItemToList`.
- **P8-20 — flagged for capture in next doc-hygiene CP.** Rationale: pill render currently uses `priority_reason.toLowerCase().includes('staple')` substring match; once CP4 is in use and `source_staple_id` is reliably populated for staple routes, the pill render should switch to the structural field. Defer until lived-with.
- **P8-21 — flagged for capture in next doc-hygiene CP.** Rationale: cookDepletion undo path (`cookDepletionService.ts:362`) reverts staple state but does not clean up routed grocery items. Recoverable manually; rare in practice.

The doc-hygiene CP will move these into `DEFERRED_WORK.md` formally; this CP just surfaces them.

### Task 8 — SESSION_LOG entry

Standard format. Include:
- Files changed (count + paths)
- Decisions executed (D8C-CP4-1 through D8C-CP4-8, plus any sub-decisions you made during implementation — e.g., the `unit_display` final value if it deviated from `'unit'`)
- Smoke test results (each of the smoke tests below)
- Any deviations from this prompt and reasoning
- DEFERRED_WORK status: P8-19 closed inline; P8-20 and P8-21 flagged for next doc-hygiene CP (do not edit DEFERRED_WORK.md in this CP)
- **Soft-fail behavior, explicit.** Tasks 5 (`cycleStapleState` / `setStapleState` routing call) and 6 (`handleToggleItem` reverse-direction restore) wrap their cross-system call in try/catch and swallow errors with a log line. Document this as intentional: state changes succeed even if their side effects (routing or reverse restore) fail. Future debugging signal lives in the console logs (`console.warn` for soft-fails, `console.error` for caught exceptions). Anyone investigating "staple went out but no grocery item appeared" should grep logs for `routeStapleToGroceryList` warnings, not assume the function didn't run.

---

## Constraints

- **Do not** modify CP3's pill render logic in `GroceryListItem.tsx` (P8-20 deferred).
- **Do not** add cook-depletion undo cleanup (P8-21 deferred).
- **Do not** add drag-to-reorder (CP4a, separate).
- **Do not** add `'running_low'` routing (separate small CP).
- **Do not** add `is_primary` schema column or primary-list selection UI (D8C-CP4-2 settled — heuristic only).
- **Do not** break existing `addItemToList` callers — its insert path stays unchanged. Staple routing does its own insert.
- Service layer handles all Supabase calls — components do not touch the DB. The reverse-direction logic in `GroceryListDetailScreen` calls `setStapleState`, not raw Supabase.
- Routing failures are soft fails — log and swallow, do not propagate to the user as a state-change error.

---

## Verification (smoke tests)

Real test data: Tom's space `7aa945ab-fb32-4197-ae11-e6dbd3392587` has three staples currently `state='out'` from CP3 setup: lemon, red wine vinegar, cumin. None are routed yet (CP4 introduces routing). Pre-CP4 `'out'` staples remain un-routed after deploy — that's expected, fine, treated as test residue.

Run in order:

1. **Reset test data via UI.** From `StaplesGrid`, tap each of the three pre-CP4 `'out'` staples (lemon, red wine vinegar, cumin) to cycle them through to `'good'`. Confirm: their state in the staples row updates; no grocery item appears yet (transitions are not landing on `'out'`). This resets the test fixtures so the next test exercises a real production transition.

2. **Fresh transition — lemon.** Tap lemon in `StaplesGrid` repeatedly to cycle it back to `'out'`. Confirm: a row appears on Tom's most-recently-updated active list with `priority='needed'`, `priority_reason='staple · out'`, `source_staple_id=<lemon id>`, `quantity_display=1`, `unit_display='unit'`, `added_from='staple'`. Pill renders red in the `GroceryListDetailScreen` UI.

3. **Fresh transitions — red wine vinegar and cumin.** Repeat the cycle-to-`'out'` for each. Three rows total on the list, each linked via `source_staple_id`. All three render with red staple pills.

4. **Fresh transition via cook-depletion.** Log a cook that depletes a `'good'` staple to `'out'` via `CookDepletionReviewModal`. Confirm: routed item appears on grocery list. (This validates that `setStapleState` routing fires from the cookDepletion path, not just the tap-cycle path.)

5. **Reverse direction — check off restores.** From `GroceryListDetailScreen`, check off the lemon item (transition `is_in_cart` to `true`). Confirm: lemon's `pantry_staples.state` becomes `'good'`, `last_confirmed_at` bumps to now. The grocery item stays on the list (checked).

6. **Un-check does NOT re-trigger.** Continue from step 5 — un-check the lemon. Confirm: lemon staple stays `'good'` (does NOT revert to `'out'`).

7. **Delete does NOT restore.** Delete the cumin item from the grocery list (without checking it off first). Confirm: cumin staple stays `'out'`.

8. **Stage 2 dedup — manually-added existing item.** Manually add "lemon" to a grocery list with `priority='nice_to_have'` (Could wait tier). Then cycle the lemon staple back to `'out'` from StaplesGrid. Confirm: the existing manually-added lemon row is promoted to `priority='needed'`, `priority_reason='staple · out'`, `source_staple_id` set. No duplicate created. Item moves from "Could wait" to "Now" tier in the UI.

9. **Idempotency — re-cycling already-routed staple.** With a staple already `'out'` and routed (e.g., red wine vinegar after step 3), trigger another state-change call to `'out'` — easiest path: cookDepletion redo, OR if not feasible, leave as deferred-verify and note in SESSION_LOG. Expected behavior: Stage 1 finds the existing row, promotes/no-ops cleanly. No duplicate. `is_in_cart` state preserved.

10. **Auto-create primary list.** (If feasible to test in dev — may need a fresh space with zero lists.) From a state with no `is_active=true` lists for the user, mark a staple `'out'`. Confirm: a new `'Groceries'` list is created and the routed item appears on it. If not feasible to test cleanly in dev, flag in SESSION_LOG and defer to F&F validation.

If any test fails, capture the failure mode in SESSION_LOG and flag for triage.

---

## Out of scope (explicit non-goals)

- Drag-to-reorder of grocery list items (CP4a, separate)
- `'running_low'` state routing (separate small CP)
- Pill render switch to `source_staple_id` (P8-20, deferred)
- CookDepletion undo cleanup (P8-21, deferred)
- Per-staple "typical purchase quantity" field (no schema change in CP4)
- Primary-list selection UI / `is_primary` column (heuristic only, D8C-CP4-2)
- UI changes to `StaplesGrid`, `StapleCell`, `GroceryListItem`, `GroceryListDetailScreen` UX beyond the reverse-direction wiring

---

## Done criteria

- All 10 smoke tests pass (or unable-to-test items flagged with rationale in SESSION_LOG).
- After test 3, three corresponding rows on Tom's most-recently-updated active list (lemon, red wine vinegar, cumin), all with red staple pill, all linked via `source_staple_id`, all with `added_from='staple'`.
- Tests 5–7 confirm reverse-direction behavior is correctly bounded (check-on restores; un-check and delete don't).
- Test 8 confirms Stage 2 dedup works without duplicating the manually-added row.
- SESSION_LOG entry filed with file diff, decision execution log, smoke test results, and explicit soft-fail behavior note.
- P8-19 closed inline. P8-20 and P8-21 noted in SESSION_LOG for capture in the next doc-hygiene CP — `DEFERRED_WORK.md` itself NOT touched in this CP.
- No regressions in existing recipe→list, manual-add, pantry-depletion, or cross-list confirmation paths.
