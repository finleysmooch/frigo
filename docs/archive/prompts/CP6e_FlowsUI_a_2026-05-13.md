# CC PROMPT — CP6e-FlowsUI-a · Cook depletion lot-aware review + picker

**Phase:** 8R · CP6e-Lots · FlowsUI sub-phase a (of 2)
**Date drafted:** 2026-05-13 (Claude.ai planning instance)
**Predecessor:** CP6e-PantryUI-a/-b/-c (shipped 2026-05-13, smoke deferred)
**Successor:** CP6e-FlowsUI-b (grocery acquire toast + search-results UI)
**F&F target:** late August / early September 2026

---

## Context

Cook depletion today (post Services-b) auto-deducts oldest-first from lots when a cook-post lands. The user sees `CookDepletionBanner` ("Pantry updated — N supplies") and can open `CookDepletionReviewModal` to keep/rollback per supply. There is no way to **revise which lots were drawn from**.

This sub-phase adds that: per-row "Drew X from Y lot(s)" rendering in the review modal, and a `LotPickerModal` invoked via a per-row "Change ▾" affordance for the user to select different lots and quantities. Confirming the picker reverses just that one supply's auto-pick and re-deducts with the user's explicit plan.

The banner is untouched. Non-tracks_lots supplies don't enter the depletion plan (Q53 skip), so every row in the review modal is a lot-tracked supply.

### Architecture lean (locked in Claude.ai chat)

- **F1 = (a)** Multi-select picker with per-lot qty inputs (not single-lot override).
- **F2 = (a)** Lot rows in the picker are READ-ONLY (no inline edit affordance during cook).
- **Apply-immediately + revise.** `runPostCookDepletion` stays as-is (auto-applies oldest-first on cook). The picker confirm path does revert-this-supply + re-deduct-with-override. No preview/confirm refactor.
- **Service-layer addition allowed.** One new exported orchestrator function on `cookDepletionService` (`replaceSupplyDeduction`). `lotsService` is untouched; `deductFromOldest` and `deductFromSpecificLots` are unchanged.
- **Shortfall non-blocking.** Selected total < recipe qty surfaces as a subtle "?" near the running total + faint hint text. Confirm always allowed. The `shortfall` field on `DepletionSupply` captures the gap and feeds downstream surfaces later. Tap-to-acknowledge "have enough" + grocery-list "add missing/all/potentially missing" verbiage is **DEFERRED** to a follow-up planning pass — do NOT design or build any of that here.

---

## Pre-read order

Read each before starting. Do NOT skip — current state matters.

1. `lib/cookDepletionService.ts` (full) — `DepletionPlan`, `DepletionSupply`, `applyDepletion`, `rollbackDepletion`. This is where `replaceSupplyDeduction` lands.
2. `lib/services/lotsService.ts` — focus on `deductFromSpecificLots`, `getLotsForSupply`, `_maybeAutoOutOfStock` (private — do NOT call directly; use `deductFromSpecificLots` as the entry point; Q44 fires internally).
3. `lib/types/supplies.ts` — `SupplyLot`, `LotDeductionPlanItem`, `LotDeductionResult`.
4. `components/pantry/CookDepletionBanner.tsx` — current state, **unchanged in this prompt**. Read so you know what it renders and what it imports.
5. `components/pantry/CookDepletionReviewModal.tsx` — current row rendering. You will extend rows here.
6. `components/pantry/LotRow.tsx` — reuse inside the picker (display-only, no `onTap`).
7. `components/pantry/LotsList.tsx` — visual reference for lot list rendering (informational only — picker is a different component).
8. `contexts/CookDepletionBannerContext.tsx` — small addition: `updateSupplyEntry` method.
9. `lib/services/unitConverter.ts` (look for `convertBetween`) — used inside the picker to convert each lot row's picked qty to the recipe unit for the running total display.

---

## Task list

### Task 1 — Add `replaceSupplyDeduction` to `lib/cookDepletionService.ts`

Add a new exported function that orchestrates revert-this-supply + re-deduct-with-override + re-persist:

```ts
export async function replaceSupplyDeduction(
  plan: DepletionPlan,
  supplyId: string,
  newDraw: LotDeductionPlanItem[]
): Promise<DepletionSupply>
```

**Behavior:**

1. Find `entry = plan.supplies.find(s => s.supply_id === supplyId)`. Throw a typed error if not found (e.g., `SupplyEntryNotInPlanError`).
2. **Reverse the existing draw for `entry`:**
   - For each `lotChange` in `entry.lots_affected`: update `supply_lots` row by `lot_id` setting `quantity = quantity_before` and (if `lotChange.archived === true`) `consumed_at = null`. Per-lot errors logged but not thrown (matches `rollbackDepletion` style).
   - If `entry.new_status !== entry.old_status`: call `setSupplyStatus(supplyId, entry.old_status)` to restore status. This may trigger the existing spawn-on-out reversal logic in `setSupplyStatus` — that's fine.
   - If `entry.spawned_need_id !== null`: `supabase.from('needs').delete().eq('id', entry.spawned_need_id)`. Per-supply-revert errors are logged but don't abort the re-deduct step.
3. **Re-deduct with override:** call `deductFromSpecificLots(supplyId, newDraw)` → `LotDeductionResult`.
4. **Build the updated entry** by mutating the existing `entry` object (in place — the caller is updating the context plan reference next anyway):
   - `entry.lots_affected = result.lots_affected`
   - `entry.shortfall = result.shortfall`
   - `entry.shortfall_reason = result.shortfall_reason`
   - `entry.new_status = result.status_changed_to ?? entry.old_status`
   - `entry.spawned_need_id = null` initially. If `result.status_changed_to !== null`, look up the spawned need (`needs` table, `supply_id = supplyId`, `status IN ('need', 'in_cart')`, `limit 1`, `maybeSingle`) — same query shape `applyDepletion` uses. On match, set `entry.spawned_need_id` to that id.
5. **Re-persist `posts.lot_depletions`:** build the persisted shape from `plan.supplies` (omitting `display_name`, matching `applyDepletion`'s `PersistedDepletionEntry` mapping) and `update` it on the post row. Log on failure; do not throw.
6. Return the mutated `entry` (for the caller to pass to the context update method).

**Error handling:**
- If `newDraw.length === 0`: treat as no-op (return `entry` unchanged, do not call the service). Defensive — the picker should never confirm with zero selections, but be safe.
- If `deductFromSpecificLots` throws (e.g., bad lot_id), let it propagate — the picker will show an error.
- The revert step's per-lot updates use the same error pattern as `rollbackDepletion`: log + continue.

**Why this lives in cookDepletionService and not the picker:** the persistence + status restore + spawn-need delete is identical to a partial `rollbackDepletion` followed by a partial `applyDepletion`, and exposing this orchestration via a single service function keeps the picker free of supabase calls.

### Task 2 — Extend `CookDepletionReviewModal` rows

In `components/pantry/CookDepletionReviewModal.tsx`:

**A. Add a per-row "lot draw" summary line** between the existing status-transition line (`statusLabel(old) → statusLabel(new)`) and the spawn-on-out indicator. Pull from `entry.lots_affected` and `entry.shortfall`.

Format rules (apply in order):

- **Single lot drawn, no shortfall:** `Drew 0.5 lb from oldest lot`
- **Multiple lots drawn, no shortfall:** `Drew 0.6 lb across 2 lots`
- **Any draw with shortfall > 0:** append `(0.2 lb short)` in a subtle warning color (`functionalColors.warning` or `colors.text.tertiary` — pick what reads as "soft warning, not blocking").
- **Total deducted = 0, shortfall > 0** (full unit-incompat or no compatible lot): `Couldn't draw — no compatible lot` in subtle warning color.

For the quantity display: sum `lots_affected[].quantity_deducted`. Since lots can be in mixed units, when summing across lots, prefer the FIRST lot's `quantity_unit` and try to convert others into it via `convertBetween`. If any lot can't be converted to that unit, fall back to displaying just the first lot's draw and append `+ N more` (uncommon edge case; keep it simple).

Helper: write a small `formatLotDrawSummary(entry: DepletionSupply): Promise<string>` async helper at the bottom of the file (or extract to `lib/utils/`). Since the summary needs `convertBetween` which is async, you'll need to compute summaries on render via `useEffect` keyed off `plan.supplies`, store in a `Map<supplyId, string>` state. Show `"…"` while resolving.

**B. Add a "Change ▾" affordance to each row.** Right-edge pill or chevron-text button. Tap target ≥ 44pt. On tap: open `LotPickerModal` with the supply's context.

Constraints:
- The checkbox + tap-to-toggle-keep behavior on the row must be preserved. The "Change" button is INSIDE the row but its tap target must NOT toggle the checkbox (use `onPress` with `e.stopPropagation()` or render outside the existing `TouchableOpacity`'s tap region — easier to wrap the existing row content in a flex container and keep "Change" as a sibling `TouchableOpacity`).
- Accessibility: `accessibilityRole="button"`, `accessibilityLabel="Change lots drawn for {supplyName}"`.
- Visually: subtle, secondary affordance — not a primary CTA. Suggest text + chevron: `Change ▾` in `colors.text.secondary` at `typography.sizes.sm`, slight horizontal padding, no background. Match the existing row's understated tone.

**C. State for the picker.** Add modal-local state:

```ts
const [pickerOpenFor, setPickerOpenFor] = useState<DepletionSupply | null>(null);
```

When non-null, `<LotPickerModal>` is rendered with props derived from that entry. On confirm, the modal calls a handler that:
1. Calls `replaceSupplyDeduction(plan, entry.supply_id, newDraw)`.
2. Calls a new context method `updateSupplyEntry(supplyId, updatedEntry)` (see Task 4).
3. Clears `pickerOpenFor`.

The review modal does NOT manage its own plan copy — `plan` is the prop from context, and the context update triggers a re-render. **However:** the format-helper `useEffect` that builds the summary map will need to re-run when `plan.supplies` changes (key the effect off a stable signal — e.g., serialize `lots_affected` lengths or use `plan` as the dep).

### Task 3 — Create `components/pantry/LotPickerModal.tsx` (NEW)

Page-sheet modal (`Modal` with `presentationStyle="pageSheet"`, matches `CookDepletionReviewModal` and `LotEditSheet` patterns).

**Props:**

```ts
interface Props {
  visible: boolean;
  supplyId: string;
  supplyName: string;
  recipeQuantity: number;
  recipeQuantityUnit: string;
  currentLotsAffected: DepletionSupply['lots_affected'];
  onConfirm: (newDraw: LotDeductionPlanItem[]) => Promise<void>;
  onCancel: () => void;
}
```

**Layout (top to bottom):**

1. **Header.** Title `Change lots — {supplyName}`. Close ✕ on right.
2. **Recipe-needed line.** Subtle, `colors.text.secondary`: `Recipe needs {formatQty(recipeQuantity, recipeQuantityUnit)}`.
3. **Body (ScrollView).** Active lots for this supply (fetched on `visible=true` via `getLotsForSupply(supplyId, { includeArchived: false })`). For each lot:
   - **Selection checkbox** (left, matches existing review modal checkbox style).
   - **`<LotRow lot={lot} showVariantInline />`** (display-only — no `onTap`). The LotRow already renders storage badge, qty in lot's native unit, variant, expiration.
   - **Quantity input** (right): `TextInput`, numeric keyboard, default value when selected = the qty drawn (in lot's native unit) — see "Pre-select" below.
   - **Lot row container is a TouchableOpacity** wrapping the checkbox + LotRow (NOT the qty input, so input edits don't toggle). Tap container → toggle selection.
   - **Unit-incompatible lots** (no `convertBetween(lot.quantity, lot.quantity_unit, recipeQuantityUnit)` result): render the row at `opacity: 0.5`, disable selection (no tap response on the row container), still show the LotRow contents. Append a small subtitle below the row: `Can't combine with recipe unit ({recipeQuantityUnit})`.
4. **Empty state** if zero active lots: `No lots available for this supply. Add a lot first.` Centered.
5. **Footer.** Two-column:
   - Left (flex grow): running total. Format `Total: 0.5 lb / 0.5 lb` where left side is the sum of selected qties converted to `recipeQuantityUnit` and right is the recipe qty. Unit-incompat selections contribute 0 to the displayed total.
     - If `selectedTotalInRecipeUnit < recipeQuantity` AND at least one lot is selected: append `?` in `colors.text.tertiary` and a hint line below: `{shortfall} {recipeQuantityUnit} short` in `typography.sizes.xs` faint. Subtle, not alarming.
     - If `selectedTotalInRecipeUnit >= recipeQuantity`: no marker.
   - Right: `[Confirm]` button. Always enabled when at least one lot is selected with positive qty. Disabled if no lots selected (no zero-confirm).

**Pre-selection logic** (when `visible` becomes true):

For each lot in `getLotsForSupply` result:
- If a matching `lot_id` exists in `currentLotsAffected` with `quantity_deducted > 0`: pre-select it with `qty = quantity_deducted` in the lot's native unit.
- Otherwise: not selected, qty input cleared (default `""`).
- If the picker is opened on a supply with zero current `lots_affected` (e.g., a previous full unit-incompat), no lots are pre-selected.

**Running total computation:**

On each render, walk selected lots, for each:
```ts
const lotQtyInRecipeUnit = await convertBetween(parsedQty, lot.quantity_unit, recipeQuantityUnit);
// if null → contribute 0 (and silently — the row's unit-incompat state already shows it)
```

This is async, so memoize the result via `useEffect` + state. Recompute on selection changes or qty edits.

**Confirm handler:**

Build `LotDeductionPlanItem[]`:
```ts
const newDraw = selectedLots.map(lot => ({
  lot_id: lot.id,
  quantity: parseFloat(qtyByLotId[lot.id] ?? '0'),
  quantity_unit: lot.quantity_unit,  // native unit, not recipe unit
}));
```

Filter out any item with `quantity <= 0` or `NaN`. If the filtered list is empty, treat the confirm as a no-op (don't call onConfirm; ideally the button is already disabled at this point).

Call `await onConfirm(filtered)`. The parent handles `replaceSupplyDeduction` + context update; the picker just awaits and closes via the parent setting `pickerOpenFor = null`.

**Loading + error UX:**

- While `getLotsForSupply` is in flight: full-modal centered spinner.
- If the lots fetch fails: show an inline error string in the body with a retry tap. Cancel button still works.
- While `onConfirm` is in flight: disable Confirm button, show `…`. On error (try/catch around `onConfirm`): keep modal open, display an inline error at the footer.

**Accessibility:**

- Modal `accessibilityViewIsModal={true}`.
- Each lot row container: `accessibilityRole="checkbox"`, `accessibilityState={{ checked, disabled }}`, `accessibilityLabel` describing the lot + selection state.
- Qty inputs: `accessibilityLabel="Quantity drawn from lot, {lot description}"`, `keyboardType="decimal-pad"`.
- Confirm button: `accessibilityRole="button"`, label `"Confirm lot selection"`.

### Task 4 — Extend `CookDepletionBannerContext` with `updateSupplyEntry`

Small addition to `contexts/CookDepletionBannerContext.tsx`:

```ts
interface CookDepletionBannerContextValue {
  currentBanner: BannerState | null;
  showBanner: (plan: DepletionPlan) => void;
  dismissBanner: () => void;
  updateSupplyEntry: (supplyId: string, updatedEntry: DepletionSupply) => void;  // NEW
}
```

Implementation: replace the matching `plan.supplies[i]` with the updated entry (preserve array order), build a fresh `BannerState`, call `setCurrentBanner`. The `DepletionSupply` import comes from `'../lib/cookDepletionService'` (same file already imports `DepletionPlan`).

**Why a fresh BannerState object:** React reference equality. Mutating in place won't re-trigger consumers.

The review modal's confirm handler (Task 2) calls this after `replaceSupplyDeduction` resolves.

---

## Constraints

1. **No changes to:** `lotsService.ts` (any function), `cookDepletionService.computeDepletion`, `cookDepletionService.applyDepletion`, `cookDepletionService.rollbackDepletion`, `cookDepletionService.runPostCookDepletion`, `cookDepletionService.rollbackFromPersistedRecord`, `CookDepletionBanner.tsx`. Touching any of these is out of scope and will be reverted.
2. **TypeScript strict.** No `any`. If a Supabase result needs a cast, use a narrow `as { ... }` shape — same pattern as existing service code.
3. **Reuse `LotRow.tsx` in the picker** — display-only mode, no `onTap`. Do NOT duplicate lot row rendering.
4. **No new types in `lib/types/`.** `LotDeductionPlanItem` already exists. Any picker-internal types (selection state, etc.) stay in `LotPickerModal.tsx`.
5. **Components don't call Supabase directly.** The picker calls `lotsService.getLotsForSupply` and `cookDepletionService.replaceSupplyDeduction` only.
6. **Accessibility on every interactive element.** Tap targets ≥ 44pt where reachable; `accessibilityLabel` on every button/checkbox; `accessibilityRole` correct (button / checkbox / alert).
7. **Behavior parity for non-revised rows.** A user who never opens the picker should see the exact same review-modal behavior as today, plus the new lot-draw summary line under the status transition. No regression on the keep/rollback flow.
8. **No tests** required this sub-phase. Smoke is deferred (will batch with FlowsUI-b smoke per Tom).

---

## What's explicitly out of scope (do NOT implement)

- "I have enough" / tap-to-acknowledge-shortfall UX. Subtle "?" indicator + hint text is the only shortfall surfacing.
- Grocery list "add missing / all / potentially missing" verbiage or modal.
- Refactoring `runPostCookDepletion` to compute-only. Apply-immediately stays.
- Banner per-row rendering. Banner is untouched.
- Any change to `lotsService` exports.
- Tab 12 supply create (CP6b territory).
- Search results UI for `search_supplies` RPC (CP6e-FlowsUI-b).
- Grocery acquire toast (CP6e-FlowsUI-b).

---

## Verification (what to do before declaring complete)

1. `npx tsc --noEmit -p .` — filter to the 4 touched files (`lib/cookDepletionService.ts`, `components/pantry/CookDepletionReviewModal.tsx`, `components/pantry/LotPickerModal.tsx`, `contexts/CookDepletionBannerContext.tsx`). Zero new errors introduced by these files. Pre-existing repo-wide errors are noise — list them separately in the SESSION_LOG entry so Claude.ai can decide if any are real bugs.
2. **Read-through verification** (since no smoke):
   - Confirm `replaceSupplyDeduction` mutates the entry object passed in via `plan.supplies` AND returns it. The caller in the review modal uses the returned value to call `updateSupplyEntry`. Both paths should agree on the same data.
   - Confirm the picker pre-selects from `currentLotsAffected` not from `getLotsForSupply` order. Test mentally: a supply with 3 lots where the auto-pick used lot #2 — opening the picker should show lot #2 pre-selected with the deducted qty filled in, lots #1 and #3 unselected.
   - Confirm the review modal's lot-draw summary recomputes when the context plan updates. Inspect the `useEffect` dep list.
   - Confirm the picker handles the unit-incompat lot case visually (greyed row, can't be selected).
3. **Sanity check the persisted `lot_depletions` JSONB shape** post-revision. After `replaceSupplyDeduction`, the persisted record should reflect the NEW `lots_affected` for the revised supply and PRESERVE the original entries for unrevised supplies. The mapping in `replaceSupplyDeduction`'s persistence step should match `applyDepletion`'s `PersistedDepletionEntry` (omits `display_name`).

---

## SESSION_LOG entry format

At completion, write a SESSION_LOG entry under today's date in `docs/SESSION_LOG.md` (top of file). Template:

```
## 2026-05-13 — CP6e-FlowsUI-a · Cook depletion lot-aware review + LotPickerModal

**Type:** UI build. First of 2 FlowsUI sub-prompts. Builds on CP6e-Services-b's deductFromSpecificLots and CP6e-PantryUI-a's LotRow.

**Files modified:**
- `lib/cookDepletionService.ts` — +N lines. Added `replaceSupplyDeduction(plan, supplyId, newDraw)`. Orchestrates revert-this-supply + `deductFromSpecificLots` + re-persist. ⚠️ PK snapshot now stale.
- `components/pantry/CookDepletionReviewModal.tsx` — +N lines. Per-row lot-draw summary line + "Change ▾" affordance opening `LotPickerModal`. Async summary helper memoized via useEffect. ⚠️ PK snapshot now stale.
- `contexts/CookDepletionBannerContext.tsx` — +N lines. Added `updateSupplyEntry(supplyId, updatedEntry)` to allow picker-confirm to sync the revised plan back to context (so banner Undo reverses correct lots). ⚠️ PK snapshot now stale.

**Files created:**
- `components/pantry/LotPickerModal.tsx` (NEW, ~N lines) — page-sheet picker. Pre-selects current draw, multi-select with per-lot qty inputs, running total in recipe unit with subtle "?" + hint on shortfall, unit-incompat lots greyed and unselectable.

**Q-rule wiring:**
- D8R-Q53 manual override path: now reachable via UI. `replaceSupplyDeduction` calls `lotsService.deductFromSpecificLots` with user's plan.
- Q44 auto-out: fires inside `deductFromSpecificLots` (unchanged); `replaceSupplyDeduction` captures `status_changed_to` and re-fetches spawned need id, mirroring `applyDepletion`.

**Decisions made during build:**
- [list anything not pinned in the prompt that came up during implementation — e.g., specific styling choices for the "Change ▾" affordance, how the summary helper handled mixed-unit lots, etc.]

**Constraints honored:**
- No service-layer changes except the one new exported orchestrator (`replaceSupplyDeduction`). `lotsService` untouched.
- TypeScript strict; no `any`.
- Reused `LotRow.tsx` in picker without `onTap` (display-only).
- No tests, no smoke (deferred to combined PantryUI+FlowsUI smoke).
- Banner untouched; per-row rendering lives in review modal as agreed.

**Tracker rows:** [generate per CLAUDE.md Rule X format]

**Tracking-doc reconciliation (Rule E PK-snapshot):**
[run the standard check + report]

**Recommended next steps for Tom:**
1. Sanity-read the diff to all 4 files. Visual review of the new picker flow deferred until combined smoke.
2. Next CC engagement: **CP6e-FlowsUI-b** (grocery acquire toast + search results UI).

**Surprises / Notes for Claude.ai:**
[anything worth flagging — pre-existing errors found, ambiguities resolved, etc.]
```

---

## ID card for any test queries you might run

| Label | UUID |
|---|---|
| Space ("Home") | `7aa945ab-fb32-4197-ae11-e6dbd3392587` |
| Tom's user_id | `47feb56f-530f-4ab3-8fef-33664c3885b7` |
| `SUPPLY_CHICKEN_ID` (tracks_lots=true) | `7be3388d-18b3-4279-b6c8-92974151ef6f` |
| `SUPPLY_OLIVE_OIL_ID` | `430d8b9d-a597-4215-940a-ad5d01ad7702` |
| Active chicken lot (1.5 lb freezer, exp ~Aug 11) | `3bccde4f-6303-4f61-8809-3cedd0ce4e23` |

---

End of prompt.
