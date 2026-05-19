# CC Prompt — CP6e-Services-c · grocery acquire → lot create

**Date:** 2026-05-06
**Author:** Claude.ai planning instance
**Type:** Service-layer extension — acquire side-effects moved into needsService
**Estimated effort:** ~0.5 CC session, ~150-250 lines net
**Depends on:** CP6e-Services-a SHIPPED (lotsService exists), CP6e-Services-b SHIPPED (cookDepletion lot-aware)

---

## Context

CP6e-Services-a and -b are complete. lotsService has `createLot` with `_maybeAutoRestock` (Q45). cookDepletion is rewritten lot-aware. This is the THIRD and FINAL service-layer prompt.

**Architectural note (read before starting):** The current acquire flow has a quirk. `needsService.setNeedStatus` only updates the needs row — it does NOT trigger supply restock. The supply restock happens at the **UI layer**: `ViewDetailScreen.tsx` calls `setSupplyStatus(supplyId, 'in_stock')` after `setNeedStatus(needId, 'acquired')`. This is pre-existing architecture from 8R-CP5 era; not a bug, just a separation of concerns that ended up in the UI rather than the service.

**This prompt fixes that** — moves acquire-side-effect logic INTO `setNeedStatus` so:
- Lot-creation happens at the service layer (where it belongs)
- All consumers (current ViewDetailScreen, future CP6c bulk acquire, future receipt scan) get lot-aware behavior automatically
- UI consumers continue to work unmodified (their redundant `setSupplyStatus` calls become harmless no-ops; cleaned up later in CP6e-FlowsUI)

**No UI changes in -c.** Existing UI consumers' redundant calls are deliberately preserved for forward-compat.

**Smoke testing happens at end** of full -a/-b/-c build, after this lands.

Read `docs/PHASE_8R_UNIFIED_NEEDS.md` (v0.6) for context. Most relevant decisions:
- D8R-Q45 (auto-restock to in_stock on lot add to low/critical/out supply — already wired in lotsService.createLot via _maybeAutoRestock)
- D8R-Q46 (lot fields)

---

## Inputs to read

1. **`lib/services/needsService.ts`** — the file you'll modify. Read end-to-end. The function to modify is `setNeedStatus` (line ~733). `cycleNeedStatus` calls `setNeedStatus` and inherits the new behavior; do not modify cycleNeedStatus directly.

2. **`lib/services/lotsService.ts`** — confirm `createLot` exists with the signature from -a's prompt: `createLot(params: CreateLotParams): Promise<SupplyLot>`. You will call it.

3. **`lib/services/suppliesService.ts`** — confirm `setSupplyStatus` and `getSupplyById` exist. You will call both. `getSupplyById` accepts an optional `includeLots` param (added in -a) but you don't need lots for this flow.

4. **`lib/types/needs.ts`** — `NeedStatus` enum, `NeedWithTags` shape. The `Need` row has `quantity`, `quantity_unit`, `brand_preference`, `supply_id` fields you'll read.

5. **`lib/types/supplies.ts`** — `Supply` has `tracks_lots`, `storage_location`, `ingredient_id`, `status` fields.

6. **`screens/ViewDetailScreen.tsx`** lines 480-528 — read `doBulkAcquireSupplyLinked` for context on the existing acquire pattern. **Don't modify this file.** The redundant `setSupplyStatus` call there (line ~500) gets cleaned up in CP6e-FlowsUI.

---

## Tasks — execute in order

### Task 1 — Add private helper `_handleAcquiredSideEffects` to needsService

Add this private helper (NOT exported) before the `setNeedStatus` function definition:

```ts
/**
 * Handle supply-side effects when a need transitions to 'acquired' status.
 * Encapsulates the branching for tracks_lots supplies (lot create) vs
 * non-tracks_lots supplies (status flip).
 *
 * D8R-Q45 auto-restock fires automatically via lotsService.createLot's
 * _maybeAutoRestock when applicable.
 *
 * Returns side-effect metadata for the caller to surface in UI (toast etc.).
 * Errors are caught + logged but do NOT throw — the need's acquire transition
 * has already succeeded; supply-side failures should not roll it back.
 */
async function _handleAcquiredSideEffects(
  need: NeedWithTags
): Promise<{
  lotCreated: SupplyLot | null;
  statusChangedTo: SupplyStatus | null;
  skippedReason: string | null;
}>
```

Implementation:

1. **No supply linked.** If `need.supply_id` is null or undefined, return `{ lotCreated: null, statusChangedTo: null, skippedReason: 'no_supply_linked' }`. Some needs are free-text without a supply; nothing to do.

2. **Read supply.** Call `suppliesService.getSupplyById(need.supply_id)` (without includeLots). If not found, log + return with `skippedReason: 'supply_not_found'`.

3. **Branch on tracks_lots:**

   **Branch A — `supply.tracks_lots === false`:**
   - Call `setSupplyStatus(supply.id, 'in_stock')`. The function is idempotent — flipping in_stock → in_stock is a no-op; flipping low/out → in_stock is the actual restock.
   - Capture if status changed (compare returned status to pre-call status).
   - Return `{ lotCreated: null, statusChangedTo: <status_if_changed_or_null>, skippedReason: null }`.

   **Branch B — `supply.tracks_lots === true`:**
   - Validate need has quantity data: `need.quantity` is non-null AND `need.quantity_unit` is non-empty.
     - If missing, fall through to status-flip path (call setSupplyStatus to 'in_stock' just like Branch A). Log: `console.warn('⚠️ Need acquired but missing qty/unit; falling back to status flip:', { needId: need.id })`. Return with `skippedReason: 'no_quantity_data'` to signal the fallback.
   - Compute storage_location: prefer `supply.storage_location`. If null, query ingredient via `suppliesService.getSupplyById` already returned ingredient data, so use `supply.ingredient?.default_storage_location`. If still null, default to `'pantry'`.
   - Build `CreateLotParams`:
     ```ts
     {
       supply_id: supply.id,
       quantity: need.quantity,
       quantity_unit: need.quantity_unit,
       storage_location: <computed>,
       acquired_at: undefined,  // lotsService defaults to NOW
       expires_at: undefined,   // lotsService computes from acquired_at + shelf_life
       variant_label: undefined,
       brand: need.brand_preference || undefined,
       notes: undefined,
     }
     ```
   - Call `lotsService.createLot(params)`. The Q45 _maybeAutoRestock helper inside fires automatically if supply.status was low/critical/out.
   - To detect if Q45 fired: re-fetch supply after createLot returns; compare new `supply.status` to pre-acquire status.
   - Return `{ lotCreated: <lot>, statusChangedTo: <new_status_if_changed_else_null>, skippedReason: null }`.

4. **Errors:** wrap each branch in try/catch. On error, log + return with `skippedReason: 'side_effect_error'` and the error message. Do NOT re-throw. The need is already acquired; rolling that back due to a supply-side failure would be worse UX than a stale supply state the user can fix manually.

### Task 2 — Modify `setNeedStatus` to call the helper

Update `setNeedStatus`:

```ts
export async function setNeedStatus(
  needId: string,
  newStatus: NeedStatus
): Promise<NeedWithTags> {
  console.log('🛒 Setting need status:', { needId, newStatus });

  // Read need BEFORE update to detect transition (need vs in_cart vs acquired)
  const before = await getNeedByIdWithTagsOnly(needId);
  if (!before) throw new NeedNotFoundError(needId);

  // Only fire side-effects when transitioning TO 'acquired' from a non-acquired state
  const isAcquireTransition = newStatus === 'acquired' && before.status !== 'acquired';

  // Existing update logic
  const { data, error } = await supabase
    .from('needs')
    .update({ status: newStatus })
    .eq('id', needId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('❌ Error setting need status:', error);
    throw error;
  }
  if (!data) throw new NeedNotFoundError(needId);

  const result = await getNeedByIdWithTagsOnly(needId);
  if (!result) throw new NeedNotFoundError(needId);

  // D8R-Q45-adjacent: side-effects on acquire transition
  if (isAcquireTransition) {
    const sideEffectResult = await _handleAcquiredSideEffects(result);
    console.log('📦 Acquire side-effects:', {
      needId,
      lotCreated: sideEffectResult.lotCreated?.id ?? null,
      statusChangedTo: sideEffectResult.statusChangedTo,
      skippedReason: sideEffectResult.skippedReason,
    });
  }

  return result;
}
```

Notes:
- The `isAcquireTransition` check ensures the helper fires only on actual transitions. Re-setting an already-`acquired` need to `acquired` is a no-op (idempotent). Setting `need → in_cart` doesn't fire (no supply restock yet). Setting `in_cart → acquired` fires. Setting `need → acquired` directly also fires.
- Side-effect failures are logged but don't propagate. The need state change persists.
- Return value is unchanged — `Promise<NeedWithTags>`. Side-effect metadata is internal-only for now; a future overload or new function (`setNeedStatusWithDetails`) can expose it for toast UI in CP6e-FlowsUI.

### Task 3 — Verify nothing else needs changes

Run a grep across the codebase:
- `setNeedStatus.*acquired` — find all callers.
- For each caller, confirm: existing behavior preserved (return type same, no new args required).
- Note any callers with redundant `setSupplyStatus(.., 'in_stock')` patterns. These are now harmless (idempotent) but should be flagged for CP6e-FlowsUI cleanup.

In SESSION_LOG, list the redundant call sites you find. Don't modify them.

---

## Constraints

1. **No UI changes.** Don't modify any file in `/screens/` or `/components/`. Existing redundant `setSupplyStatus` calls at UI layer are deliberately left as no-ops.

2. **`setNeedStatus` external signature is preserved.** `(needId, newStatus) → Promise<NeedWithTags>`. No new args. No throw on side-effect failure.

3. **Idempotency on re-acquire.** Setting an already-acquired need to acquired = no-op (the `isAcquireTransition` guard handles this). Don't re-create lots.

4. **No tests.** Smoke at end of full build.

5. **No new exports.** `_handleAcquiredSideEffects` is private (note the underscore prefix matches the convention used in lotsService for `_maybeAutoOutOfStock` etc.).

6. **Match existing style.** Use `console.log` / `console.error` with emoji prefixes. Mirror suppliesService and existing needsService.

7. **Don't optimize prematurely.** Per-need acquire-side-effect calls are fine for F&F scale. Bulk acquire of 50+ needs with N+1 supply reads is tolerable (each read is fast; serialized acquire is forgiving). If a future bulk path needs batching, add `bulkAcquireNeeds` later.

8. **Q45 auto-restock toast metadata.** The `statusChangedTo` field in the helper's return signals when Q45 fired. Currently nobody consumes this — the return is internal-only. CP6e-FlowsUI will add a `setNeedStatusWithDetails` variant or similar to surface it to UI for the auto-restock toast. Don't add that now.

---

## What this prompt does NOT do

- UI components (CP6e-FlowsUI later)
- Toast UI for auto-restock (CP6e-FlowsUI)
- Receipt scan path (P8R-D22, post-F&F)
- createNeed dedup hoist (CP6a)
- Bulk acquire on In Cart view (CP6c)
- Tests (smoke at end)

---

## SESSION_LOG entry format

Append to `SESSION_LOG.md`:

```
## 2026-05-06 — CP6e-Services-c · grocery acquire → lot create

**Type:** Service-layer extension. Move acquire side-effects from UI to needsService.

**Files modified:**
- lib/services/needsService.ts (extended) — N lines

**Behavior change:**
- setNeedStatus(needId, 'acquired') now triggers _handleAcquiredSideEffects:
  - tracks_lots=true: creates lot via lotsService.createLot (Q45 auto-restock fires inside)
  - tracks_lots=false: flips supply.status to in_stock (idempotent — no-op if already in_stock)
  - Errors swallowed + logged; need acquire is not rolled back
- Idempotency: re-setting acquired→acquired is a no-op (isAcquireTransition guard)
- No external signature change to setNeedStatus

**Pre-existing UI redundancy preserved:**
- ViewDetailScreen.tsx line ~500 calls setSupplyStatus(.., 'in_stock') after setNeedStatus(.., 'acquired')
- Now redundant (the service handles it) but harmless (idempotent)
- Flagged for cleanup in CP6e-FlowsUI

**Other call sites of setNeedStatus(.., 'acquired') discovered:**
- [list grep findings here]

**Q-rule wiring:**
- Q45 (auto-restock) fires inside lotsService.createLot via existing _maybeAutoRestock
- No changes to lotsService needed for -c

**No UI touched. No cookDepletion touched. No tests written. No schema changes.**

**Next:** Tom runs end-to-end smoke test of full -a/-b/-c build.
```

---

## If anything blocks

- **lotsService.createLot signature differs from -a's contract.** STOP and report.
- **getSupplyById doesn't exist or has different shape.** STOP and read suppliesService to find the correct equivalent.
- **NeedWithTags doesn't have `quantity` / `quantity_unit` / `brand_preference` fields.** STOP. The schema CSVs in PK should confirm these exist on the `needs` table.
- **`supply.ingredient?.default_storage_location` access fails because ingredient isn't joined.** Fall back: query ingredient separately. Or use storage_location from supply only and skip the ingredient lookup if missing — fall through to 'pantry' default.
- **Existing `setNeedStatus` tests / mocks discovered.** None expected (no test files in repo). If you find any, STOP and report — adding side-effects is a contract change for those tests.

Don't invent service behavior. The decisions list is exhaustive. If you encounter a case I didn't cover, stop and report.
