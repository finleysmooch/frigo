# CC Prompt — Phase 8C-CP4a — running_low routing + pill differentiation + P8-20 fold-in

**Phase:** 8C-CP4a (patch-up — extends 8C-CP4's staple→grocery routing to cover the `'running_low'` state, adds pill color differentiation, and folds in P8-20's pill render structural-field switch)
**Authored:** 2026-04-27 (planning chat) for execution
**Estimated effort:** ~1.5–2 hours
**Prereq CPs shipped:** 8C-CP1 through 8C-CP4 (3-tier restructure, store_name schema, store_section backfill, cross-list confirm, recipe attribution junction, view toggle + recipe pills + filter, staple → grocery auto-routing for `'out'` state)

---

## Context

CP4 shipped the staple→grocery loop for `'out'` state only (D8C-CP4-7 deferred `'running_low'` to a separate small CP). CP4a extends the loop:

- Staples transitioning to `'running_low'` route to "Could wait" tier with `priority_reason='staple · low'` and an amber pill (vs CP4's "Now" tier + red pill for `'out'`).
- Cross-state promotion (low → out) and demotion (out → low) are handled by Stage 1 dedup re-writing `priority` and `priority_reason` on the existing routed row.
- CP3's pill render switches from substring-match-on-`priority_reason` to structural-field check on `source_staple_id IS NOT NULL` (boolean), with `priority_reason` substring still driving color variant. This closes P8-20.

cookDepletion already emits `'running_low'` as a target state (`cookTransition` line 51-53 of `lib/cookDepletionService.ts`: `good → running_low` on cook). So CP4a's running_low routing fires from BOTH tap-cycle AND cookDepletion paths — same dual-exercise surface as CP4 had for `'out'`.

Architectural decisions (set in planning chat 2026-04-27, captured here for execution):
- **D8C-CP4a-1.** Routing trigger expanded: both `cycleStapleState` and `setStapleState` route on `newState === 'out' || newState === 'running_low'`. Same try/catch soft-fail wrapper. No new entry points.
- **D8C-CP4a-2.** `routeStapleToGroceryList(stapleId)` learns the state via internal refetch (no new param). The function already calls `getStapleById` for ingredient_id/custom_name; reading `staple.state` is free off the same fetch. State is the source of truth; param threading from caller would create TOCTOU coupling we don't need.
- **D8C-CP4a-3.** Routed-row state-derived values:
  - `state='out'`: `priority='needed'`, `priority_reason='staple · out'`, tier=Now
  - `state='running_low'`: `priority='nice_to_have'`, `priority_reason='staple · low'`, tier=Could wait
- **D8C-CP4a-4.** Stage 1 dedup handles cross-state transitions as priority+reason re-write. Promotion (low → out): existing row's priority='needed', priority_reason='staple · out'; row visually moves Could wait → Now, pill flips amber → red. Demotion (out → low, fires only on cookDepletion rollback when old_state was 'low'): priority='nice_to_have', priority_reason='staple · low'; row moves Now → Could wait, pill flips red → amber. `is_in_cart` preserved through both.
- **D8C-CP4a-5.** Pill render switches to hybrid: `source_staple_id IS NOT NULL` for the boolean ("is this a staple pill"), `priority_reason` substring for the variant (`'staple · out'` → red, `'staple · low'` → amber). Going fully structural would require a JOIN to `pantry_staples.state` per row in the grocery list query; not worth the cost since `priority_reason` is service-controlled (never user-modified for staple-routed rows) and reliably reflects current state.
- **D8C-CP4a-6.** Pill color: `functionalColors.warning` (saturated amber) for low. Parity with CP3's saturated red for out. If CC finds the saturated amber reads weirdly when both colors appear on the same screen during execution, fall back to a darker amber or muted treatment — flag in SESSION_LOG.
- **D8C-CP4a-7.** Manual cycle `'out' → 'good'` cleanup is OUT OF SCOPE — same restriction as CP4's D8C-CP4-5. Cleanup of routed grocery rows fires on check-off only. Manual-cycle bypassing check-off leaves the row lingering; recoverable by user delete. Filed as P8-23 in DEFERRED_WORK if F&F testing surfaces friction.

---

## Inputs to read (in this order)

1. `lib/pantryStaplesService.ts` — `cycleStapleState`, `setStapleState`, `routeStapleToGroceryList`. Verify the existing `if (newState === 'out')` gates at the two call-sites (post-CP4 state). Routing function's existing structure stays; expansion is in callers.
2. `lib/cookDepletionService.ts` — confirm `cookTransition` emits `'running_low'` for `good → running_low` (line 51–53). No changes needed here; surface for verification context.
3. `components/GroceryListItem.tsx` — current pill render uses `priority_reason.toLowerCase().includes('staple')` substring match (D8-41 from CP3). CP4a switches the boolean check to `source_staple_id !== null` and adds an amber color branch.
4. `lib/types/grocery.ts` — `GroceryListItem` already has `source_staple_id` (added in CP4) and `priority_reason`. No type changes needed.
5. `lib/groceryListsService.ts` — `routeStapleToGroceryList`'s Stage 1/2/3 logic. Re-using the staple-state-derived values means computing them once at function entry from `staple.state` and passing through.
6. `screens/GroceryListDetailScreen.tsx` — `handleToggleItem` reverse-direction logic. CP4 currently calls `setStapleState(item.source_staple_id, 'good')` on check-on. **No change needed** — this still works for low-routed items (check-on a 'staple · low' row restores staple to 'good' same way as 'staple · out').

---

## Tasks (in order)

### Task 1 — Expand routing trigger in `cycleStapleState` and `setStapleState`

In `lib/pantryStaplesService.ts`, locate the two call sites where `routeStapleToGroceryList` is invoked. Each currently looks like:

```typescript
if (newState === 'out') {
  try {
    await routeStapleToGroceryList(stapleId);
  } catch (routeError) {
    console.error('❌ routeStapleToGroceryList failed (soft-fail):', routeError);
  }
}
```

Replace each with:

```typescript
if (newState === 'out' || newState === 'running_low') {
  try {
    await routeStapleToGroceryList(stapleId);
  } catch (routeError) {
    console.error('❌ routeStapleToGroceryList failed (soft-fail):', routeError);
  }
}
```

Two locations: end of `cycleStapleState` and end of `setStapleState`. No other changes to those functions.

### Task 2 — Generalize `routeStapleToGroceryList` to handle both states

In the routing function, after fetching the staple via `getStapleById(stapleId)`, derive the routing values from `staple.state`. Add at the top of the function (just after the staple fetch + null-throw):

```typescript
// Phase 8C-CP4a: state-derived routing values.
const routingValues = staple.state === 'out'
  ? { priority: 'needed' as const, priority_reason: 'staple · out' }
  : staple.state === 'running_low'
  ? { priority: 'nice_to_have' as const, priority_reason: 'staple · low' }
  : null;

if (!routingValues) {
  console.warn(`⚠️ routeStapleToGroceryList called with non-routable state '${staple.state}'; soft-failing`);
  return;
}
```

The caller-side gate in Task 1 already prevents non-routable states from reaching here, but this defensive guard catches any future caller (or a TOCTOU race where state changed between cycle's update and routing's refetch).

Then thread `routingValues.priority` and `routingValues.priority_reason` through Stage 1, Stage 2, and Stage 3 in place of the hardcoded `'needed'` and `'staple · out'` values.

**Stage 1 (existing source_staple_id match):** `updateListItem(item.id, { priority: routingValues.priority, priority_reason: routingValues.priority_reason })`. Always overwrite `priority_reason` per D8C-CP4-4. This handles both cross-state promotion (low → out: priority bumped, reason refreshed) and demotion (out → low: priority lowered, reason refreshed).

**Stage 2 (ingredient_id / custom_name match):** `updateListItem(item.id, { priority: routingValues.priority, priority_reason: routingValues.priority_reason, source_staple_id: stapleId })`. Same handling, plus the source_staple_id link backfill.

**Stage 3 (insert):** `priority: routingValues.priority, priority_reason: routingValues.priority_reason` in the insert payload. Other fields (`quantity_display: 1`, `unit_display: 'unit'`, `added_from: 'staple'`, `source_staple_id`) unchanged from CP4.

### Task 3 — Pill render switch in `GroceryListItem.tsx` (P8-20 fold-in)

Locate the current pill render logic in `components/GroceryListItem.tsx`. CP3's logic checks `priority_reason.toLowerCase().includes('staple')` to decide whether to render the pill, then extracts the variant from the second segment of `'staple · {variant}'`.

Replace the boolean check:

**Current pattern (find):**
```typescript
const showStaplePill = item.priority_reason?.toLowerCase().includes('staple');
```

**Replace with:**
```typescript
// Phase 8C-CP4a: structural-field check (P8-20). Decouples pill rendering from
// priority_reason text content; user-typed reasons can never render a phantom pill.
const showStaplePill = item.source_staple_id !== null;
```

Keep the variant-extraction logic (`priority_reason` substring → 'out' | 'low' | other) — that's the durable color signal per D8C-CP4a-5.

Add the amber color branch. Current variant logic (CP3) likely returns red for the "staple" pill regardless. Update to:

```typescript
const stapleVariant = item.priority_reason?.toLowerCase().includes('low')
  ? 'low'
  : 'out';

// Color: red for out, amber for low. Saturated tones for at-a-glance signal.
const pillBackgroundColor = stapleVariant === 'low'
  ? functionalColors.warning
  : functionalColors.error;

const pillLabel = stapleVariant === 'low' ? 'staple · low' : 'staple · out';
```

(Adjust to match the existing variable naming and rendering pattern in CP3's pill code — these are illustrative.)

**Truncation:** keep CP3's existing 12-character truncation if present; the pill labels `'staple · low'` (12 chars) and `'staple · out'` (12 chars) both fit cleanly.

**Defensive case:** if `source_staple_id IS NOT NULL` but `priority_reason` is somehow null or doesn't contain 'low' or 'out' (data anomaly, shouldn't happen with CP4a's service-controlled writes), default to 'out' / red. Logged at debug level if you want surfacing in console; not user-visible.

### Task 4 — Verify reverse-direction (no change required)

In `screens/GroceryListDetailScreen.tsx`, the `handleToggleItem` reverse-direction logic from CP4 calls `setStapleState(item.source_staple_id, 'good')` on check-on. This already works for low-routed items: checking off a `'staple · low'` row restores the staple to `'good'` the same way as `'staple · out'` rows. **Skip — no changes here.**

Verify by reading the existing block; if the logic is gated on something other than `source_staple_id !== null` (e.g., a stale check on `priority_reason` substring), flag and consult.

### Task 5 — DEFERRED_WORK note for SESSION_LOG only

This CP is execution scope, not doc-hygiene scope (same convention as CP4). Do NOT edit `DEFERRED_WORK.md` directly. In the SESSION_LOG entry, note:

- **P8-20 — closed.** CP3's substring-match pill render switched to `source_staple_id !== null` structural check in this CP.
- **P8-23 — flagged for capture in next doc-hygiene CP.** Manual cycle `'out' → 'good'` cleanup of routed grocery items. Symmetric with P8-21 (cookDepletion undo cleanup); same shape — recoverable manually, narrow path. Defer.

The doc-hygiene CP will move these into `DEFERRED_WORK.md` formally; this CP just surfaces them.

### Task 6 — SESSION_LOG entry

Standard format. Include:
- Files changed (3 expected: `lib/pantryStaplesService.ts`, `lib/groceryListsService.ts`, `components/GroceryListItem.tsx`)
- Decisions executed (D8C-CP4a-1 through D8C-CP4a-7, plus any sub-decisions)
- Smoke test results (tests below)
- Any deviations from this prompt
- DEFERRED_WORK status: P8-20 closed inline; P8-23 flagged for next doc-hygiene
- Soft-fail behavior — same try/catch swallow as CP4, log signal `routeStapleToGroceryList failed` and the new defensive guard `routeStapleToGroceryList called with non-routable state`

---

## Constraints

- **Do not** modify `screens/GroceryListDetailScreen.tsx` reverse-direction logic (CP4 already correct for both states).
- **Do not** add manual-cycle-cleanup for `'out' → 'good'` (P8-23 deferred).
- **Do not** modify `lib/cookDepletionService.ts` (`cookTransition` emits the right values; routing-from-cookDepletion exercises CP4a automatically via `setStapleState`).
- **Do not** add a new pill color variant beyond amber/red (e.g., gray for unknown states); D8C-CP4a-6 is the full color spec.
- **Do not** edit `DEFERRED_WORK.md`. P8-20 closure + P8-23 flag go in SESSION_LOG only.
- Service-layer-only for DB calls. No raw Supabase calls from `GroceryListItem.tsx`.
- Routing failures are soft fails — log and swallow, do not propagate.

---

## Verification (smoke tests)

Real test data after CP4: lemon, red wine vinegar, cumin currently 'good' (Test 5 from CP4 restored lemon; tests 3+5 left RWV at 'out' check-off → 'good', cumin at 'out' from delete-doesn't-restore which leaves it 'out'; status may have drifted with subsequent cycling). Run a state-check query first:

```sql
SELECT id, custom_name, ingredient_id, state
FROM pantry_staples
WHERE space_id = '7aa945ab-fb32-4197-ae11-e6dbd3392587'
ORDER BY state, custom_name NULLS LAST;
```

Pick three 'good' staples to use as fresh test fixtures (cycle them as test inputs). If you have fewer than 3 'good' staples, cycle existing 'out' or 'low' staples back to 'good' first via StaplesGrid taps.

### Test 1 — Fresh transition to 'low' via tap-cycle

1. From StaplesGrid, tap a 'good' staple ONCE to cycle to `'running_low'`.
2. Open the routing target list (most-recently-updated active list).

**Verify:**
- New row appears in **Could wait** tier (NOT Now)
- Amber staple pill renders inline
- SQL: `priority='nice_to_have'`, `priority_reason='staple · low'`, `source_staple_id` set, `added_from='staple'`

```sql
SELECT id, priority, priority_reason, source_staple_id, added_from
FROM grocery_list_items
WHERE source_staple_id IS NOT NULL
ORDER BY created_at DESC LIMIT 5;
```

### Test 2 — Cross-state promotion (low → out)

1. Continue from Test 1's staple. Tap StaplesGrid AGAIN to cycle `'running_low' → 'out'`.
2. Refresh the grocery list view.

**Verify:**
- **Same row** (no duplicate) — Stage 1 dedup fired by `source_staple_id` match
- Row moved from Could wait → **Now** tier
- Pill flipped from amber → **red**
- SQL: same `source_staple_id`, but `priority='needed'`, `priority_reason='staple · out'`. `is_in_cart` still `false`.

### Test 3 — Cross-state demotion (out → low) via cookDepletion rollback

This is the narrow but real path. Setup:

1. Cycle a 'good' staple to 'low' via tap (Test 1 mechanism). Verify amber pill in Could wait. — Or use Test 1's staple if it's still in 'low' state pre-Test-2. — Or skip this test if you don't want the setup overhead.
2. Cook a recipe that has this staple as an ingredient. The `CookDepletionReviewModal` should propose `low → out`. Accept.
3. **Verify intermediate state:** grocery row promoted to Now, red pill (Test 2 mechanism via cookDepletion path).
4. Now undo the cook (whatever the existing undo flow looks like — check the existing UI surface for cookDepletion rollback, or the cooked-post detail screen's delete option if that exercises rollback).
5. Refresh the grocery list view.

**Verify:**
- Same row (no duplicate)
- Row moved Now → **Could wait** (demoted)
- Pill flipped red → **amber**
- SQL: `priority='nice_to_have'`, `priority_reason='staple · low'`. `source_staple_id` unchanged.

If the cookDepletion rollback UI is hard to surface from the test app: **defer this test** with rationale. The code path is identical to Test 2's promotion, just with values flowing the other way. Mechanical confidence is high.

### Test 4 — Reverse direction (low staple check-off restores)

1. Pick a 'staple · low' row on the grocery list (use Test 1's row).
2. Check it off (`is_in_cart: false → true`).

**Verify:**
- StaplesGrid: staple visual state reverts to `'good'`
- SQL: `pantry_staples.state='good'`, `last_confirmed_at` recent
- Grocery row stays on list (checked, In cart tier)

### Test 5 — Pill rendering (P8-20 verification)

**Goal:** Confirm pill renders based on `source_staple_id IS NOT NULL`, not on `priority_reason` substring. The defensive case.

1. From any active grocery list, manually add an item with `priority_reason` containing the word "staple" — e.g., free-typed in some text field if such a field exists, or via SQL:

```sql
UPDATE grocery_list_items
SET priority_reason = 'manual note about staple shelf'
WHERE id = '<some-existing-non-staple-row-id>';
```

2. Refresh the grocery list view.

**Verify:**
- The manually-modified row does NOT render a staple pill (since `source_staple_id` is null)
- Existing staple-routed rows still render the correct pill (red or amber per their state)

This confirms P8-20's fix: substring match brittleness is gone. User-typed `priority_reason` text can no longer render a phantom staple pill.

Cleanup after test:
```sql
UPDATE grocery_list_items SET priority_reason = NULL WHERE id = '<the-test-row-id>';
```

### Test 6 — Visual differentiation on the same screen

If Tests 1 and 2 left the grocery list with a mix of `'staple · low'` (amber, Could wait) and `'staple · out'` (red, Now) rows, scroll the list and visually confirm the two pill colors are distinguishable. If amber feels too pale next to the red:
- Note in SESSION_LOG with screenshot if possible
- Flag for follow-up color tuning (would be a small CP, not a CP4a blocker)

If only one color is on screen at a time (e.g., all routed rows are 'low'), cycle one of them up to 'out' to populate the comparison.

### Test 7 — Idempotency on running_low routing

Same idea as CP4's Test 9. Re-route an already-low-routed staple by triggering another `setStapleState(stapleId, 'running_low')` call (cookDepletion redo, or direct cycle through good → low again).

**Verify:** Stage 1 finds the existing row, no-ops the priority/reason rewrite (same values), no duplicate. `is_in_cart` preserved.

If this is hard to exercise cleanly in dev: defer with rationale. Stage 1 is algorithmically protected by `source_staple_id` uniqueness in the routed-row context.

### Test 8 — Auto-create primary list (running_low variant)

Same as CP4's Test 10 but for the running_low path. Skip if CP4's Test 10 already exercised the auto-create path — code is identical.

If feasible:
1. Deactivate all active lists (SQL).
2. Cycle a 'good' staple to 'low' via StaplesGrid.
3. Verify a new "Groceries" list is created and the routed item appears with `priority='nice_to_have'`, amber pill.

If not feasible: defer to F&F validation.

---

## Out of scope (explicit non-goals)

- Drag-to-reorder of grocery list items (post-launch UX polish per planning chat decision)
- Manual cycle 'out' → 'good' cleanup of routed grocery rows (P8-23 deferred)
- cookDepletion undo cleanup of routed grocery rows (P8-21 from CP4, still deferred)
- Pill render fully structural via `pantry_staples.state` JOIN (priority_reason substring is sufficient + cheap; D8C-CP4a-5)
- New states beyond out/low (`'unknown'` and `'good'` don't route)
- ManageStaplesScreen state cycling (P8-22 — separate CP)

---

## Done criteria

- All 8 smoke tests pass (or unable-to-test items flagged with rationale in SESSION_LOG).
- Routing fires from both tap-cycle and cookDepletion paths for `'running_low'` transitions.
- Cross-state promotion (low → out) and demotion (out → low) both work via Stage 1 dedup; no duplicates.
- Pill renders use `source_staple_id IS NOT NULL` for the boolean (P8-20 closed).
- Pill color differentiates: amber for low, red for out.
- SESSION_LOG entry filed with file diff, decision execution log, smoke test results.
- P8-20 closed inline. P8-23 flagged for next doc-hygiene CP. `DEFERRED_WORK.md` itself NOT touched in this CP.
- No regressions in: existing 'out' state routing (CP4), reverse direction (CP4 Test 5–7), recipe→list, manual-add, cross-list confirm, view toggle, recipe pills paths.
