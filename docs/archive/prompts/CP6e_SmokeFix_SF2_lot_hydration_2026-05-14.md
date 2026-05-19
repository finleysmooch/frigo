# CC PROMPT — CP6e-SmokeFix-SF2 · LotBadge tap behavior + tracks_lots hydration

**Phase:** 8R · CP6e-Lots closeout smoke
**Source:** SF-2 in `CP6e_SMOKE_FINDINGS_2026-05-14.md`
**Severity:** 🔴 Blocker — perceived data loss (actual data intact; UI hydration bug)
**Estimated effort:** ~90-150 lines, 1 session
**F&F target:** late August / early September 2026

---

## Context

CP6e-PantryUI-a shipped LotBadge as a status-colored pill replacing StatusIcon for `tracks_lots=true` supplies. Per D8R-Q54, tapping LotBadge was wired to `cycleSupplyStatus(supplyId)` so users could manually override `supply.status` independent of lot quantities.

CP6e smoke 2026-05-14 (SF-2) surfaced two issues:

1. **Design issue.** Tom's report: *"clicking that should not auto update — it was far too easy to accidentally lose that lot."* Cycle-tap on the LotBadge is a footgun. **Override D8R-Q54: route LotBadge tap to expand the row instead** (showing the LotsCollapser + LotsList immediately, surfacing the lot details that the user wants to see). Cycle-tap behavior on tracks_lots supplies is removed; users can still set status via SupplyControls in the expanded panel or via SupplyDetailScreen.

2. **Underlying hydration bug.** `cycleSupplyStatus`, `setSupplyStatus`, and `setSupplyUsageLevel` return `SupplyWithTags` rows WITHOUT the `lots` and `lot_aggregate` fields hydrated. When `onSupplyChanged(returnedSupply)` fires on a tracks_lots supply, the local supply state loses its lot data → re-render falls through to StatusIcon dots → expand panel no longer shows lots → UI looks like total data loss. The DB row is intact; the local React state is the casualty.

**The hydration bug affects ALL update paths**, not just LotBadge tap:
- `SupplyControls`' usage-level slider (in the expanded panel) → calls `setSupplyUsageLevel`
- `SupplyDetailScreen` status buttons → calls `setSupplyStatus`
- Long-press action sheet status actions → calls service mutations
- Any future call site that does `await mutate; onSupplyChanged(result.supply)`

Even after we route LotBadge tap to expand-row in (1), the hydration bug remains a hazard for tracks_lots supplies on any other update path. Both fixes ship together.

### Scope leans (locked in Claude.ai chat)

- **Override D8R-Q54.** LotBadge tap on tracks_lots supplies = expand row (calls `onToggleExpanded`). Long-press still routes to `onLongPress` (action sheet).
- **Service-layer hydration fix.** `cycleSupplyStatus`, `setSupplyStatus`, `setSupplyUsageLevel` return hydrated supplies when `tracks_lots = true`. Non-tracks_lots supplies unchanged (no extra query overhead in that path).
- **No changes to `lotsService`.** All hydration logic lives in suppliesService since it owns the SupplyWithTags shape.

---

## Pre-read order

1. `lib/services/suppliesService.ts` — focus on `cycleSupplyStatus`, `setSupplyStatus`, `setSupplyUsageLevel`, and the `getSupplyWithLotsAndAggregate` helper if it exists (CP6e-Services-a should have introduced something for lots hydration; if not, the fetch path used by `getSuppliesForSpace({ includeLots: true })` is the reference).
2. `lib/services/lotsService.ts` — read `getLotsForSupply` and `getLotAggregate` signatures. These are the building blocks for the hydration helper.
3. `lib/types/supplies.ts` — `SupplyWithTags`, `SupplyLot`, `SupplyLotAggregate`, `SupplyStatusResult`.
4. `components/pantry/SupplyRow.tsx` — `handleLotBadgeTap` is the behavior fix target.
5. `components/pantry/SupplyControls.tsx` — verify it's calling `setSupplyUsageLevel` / `setSupplyStatus`. The hydration fix benefits this caller transparently (no changes needed).
6. `screens/SupplyDetailScreen.tsx` (latest) — verify status mutation patterns. Same: should benefit transparently.

---

## Task list

### Task 1 — Add/extend a service helper for hydrated tracks_lots supplies

In `lib/services/suppliesService.ts`, define (or reuse if exists):

```ts
/**
 * Re-fetch a supply with its tags + lots + lot_aggregate hydrated.
 * Mirrors the shape returned by getSuppliesForSpace({ includeLots: true })
 * for a single supply. Used after status mutations on tracks_lots supplies
 * so callers receive a fully-shaped row (no aggregate-stripping disappear bug).
 *
 * For non-tracks_lots supplies, returns the supply without lots/aggregate
 * (matches getSuppliesForSpace behavior — those fields are undefined when
 * tracks_lots is false).
 */
async function getHydratedSupply(supplyId: string): Promise<SupplyWithTags>
```

Body:
1. Fetch the supplies row + tags (existing pattern from getSupplyById or similar).
2. If `supply.tracks_lots`:
   - `const lots = await lotsService.getLotsForSupply(supplyId, { includeArchived: false })`
   - `const aggregate = await lotsService.getLotAggregate(supplyId)`
   - Attach: `supply.lots = lots; supply.lot_aggregate = aggregate;`
3. Return the hydrated supply.

If the lot service calls fail, log + return the supply WITHOUT lots/aggregate (don't throw — degrades gracefully back to today's bug behavior, which is recoverable; better than blocking the status update).

If an equivalent helper already exists in suppliesService (CP6e-Services-a may have introduced one for `getSupplyById`), use it. Don't duplicate. The key requirement: the helper must hydrate lots + aggregate when tracks_lots is true.

### Task 2 — Update `cycleSupplyStatus` to return hydrated supply on tracks_lots

Modify `cycleSupplyStatus`:

```ts
export async function cycleSupplyStatus(supplyId: string): Promise<SupplyStatusResult> {
  // ... existing status mutation logic ...
  
  // After mutation, if tracks_lots, re-fetch with hydration.
  const hydratedSupply = updatedSupply.tracks_lots
    ? await getHydratedSupply(updatedSupply.id)
    : updatedSupply;
  
  return {
    supply: hydratedSupply,
    // ... rest of SupplyStatusResult fields unchanged ...
  };
}
```

The "if tracks_lots" check avoids the extra round-trip for non-lots supplies (preserves existing performance).

### Task 3 — Same treatment for `setSupplyStatus`

Identical pattern. After the existing status mutation logic, if `updatedSupply.tracks_lots`, swap the returned supply for `getHydratedSupply(supplyId)`. Otherwise return as today.

Note: `setSupplyStatus` is called internally by `cycleSupplyStatus`. If `cycleSupplyStatus` calls `setSupplyStatus` and then itself hydrates, that's a double hydration. Pick one of:
- (a) Hydrate only in `setSupplyStatus`; `cycleSupplyStatus` returns whatever `setSupplyStatus` returns.
- (b) Hydrate only in `cycleSupplyStatus`; have it tell `setSupplyStatus` to skip the hydration via an internal flag.

Lean: (a) — keep the hydration close to the mutation, all upstream callers benefit. `cycleSupplyStatus` just returns the already-hydrated `setSupplyStatus` result.

### Task 4 — Same treatment for `setSupplyUsageLevel`

Pattern again: after the existing mutation, hydrate if tracks_lots. This path is hit by SupplyControls' usage-level slider and SupplyRow's `handleStatusIconTap`. (For non-tracks_lots supplies the slider is the only update path; hydration extra-fetch only fires on tracks_lots.)

Note that `setSupplyUsageLevel` internally calls `setSupplyStatus` when the level change implies a status change (per P8R-D24 resolution). If we hydrate in `setSupplyStatus` per Task 3, the result already comes back hydrated. The status-only branch (no status change, just usage_level patch) needs its own hydration path. Pattern:

```ts
export async function setSupplyUsageLevel(supplyId: string, level: UsageLevel): Promise<SupplyWithTags> {
  // ... existing logic ...
  
  if (statusWillChange) {
    const result = await setSupplyStatus(supplyId, newStatus);
    return result.supply;  // already hydrated by setSupplyStatus
  }
  
  // Direct usage_level patch (no status change).
  const updated = /* existing patch + re-fetch */;
  return updated.tracks_lots
    ? await getHydratedSupply(supplyId)
    : updated;
}
```

### Task 5 — Behavior fix in `components/pantry/SupplyRow.tsx`

Change `handleLotBadgeTap` from cycling status to expanding the row:

```ts
const handleLotBadgeTap = () => {
  // CP6e-SmokeFix-SF2 — override D8R-Q54 per Tom's smoke feedback.
  // Tapping the lot badge was previously wired to cycleSupplyStatus, but
  // (a) it was a footgun (perceived data loss when the hydration bug fired,
  // now fixed by service-layer hydration in cycleSupplyStatus/setSupplyStatus),
  // and (b) Tom's stronger preference is for tap to surface lot details, not
  // change status. Manual status override on tracks_lots supplies remains
  // available via SupplyControls (in the expanded panel) and SupplyDetailScreen.
  onToggleExpanded();
};
```

This makes the LotBadge tap functionally identical to tapping the supply name. Long-press still routes to `onLongPress(supply)` (action sheet — unchanged).

**Update the accessibility label** for the iconTouchable when isLotSupply is true:

```tsx
accessibilityLabel={
  isLotSupply
    ? `${expanded ? 'Collapse' : 'Expand'} ${displayName} details, ${
        aggregate
          ? `${aggregate.lot_count} lots totaling ${formatQty(aggregate.total_quantity, aggregate.canonical_unit)}`
          : 'no active lots'
      }`
    : `Cycle ${displayName}, currently ${statusLabel(status)}`
}
```

(The status-cycle accessibility text was misleading anyway since cycle-tap is now gone for tracks_lots.)

### Task 6 — Verify SupplyControls + SupplyDetailScreen update paths still work

No code changes needed. These paths call the same suppliesService functions; once Tasks 2-4 land, the returned supply is hydrated and the disappear bug doesn't fire.

Read-through verification only:
- `SupplyControls.tsx`: after usage-level slider drag or status-pill tap, the supply update flows through `onSupplyChanged` correctly.
- `SupplyDetailScreen.tsx`: after status buttons or Restock CTA, the screen-level state retains lots + aggregate.

---

## Constraints

1. **No changes to** `lotsService` (any function), `CookDepletionBanner.tsx`, `AcquireLotToast.tsx`, `LotPickerModal.tsx`, or any other CP6e component except `SupplyRow.tsx`.
2. **No changes to D8R-Q54 documentation in `PHASE_8R_UNIFIED_NEEDS.md`** in this prompt — that's a separate doc-refresh task. Just note the override in the code comment + SESSION_LOG entry.
3. **TypeScript strict.** No `any`. Service helper's return type is exactly `SupplyWithTags`.
4. **Behavior parity for non-tracks_lots supplies.** Tasks 2/3/4 should only add the hydration fetch when `tracks_lots = true`. Non-lots paths retain their existing performance (no extra query).
5. **Defensive degradation.** If `getHydratedSupply` lot fetches fail, log + return the supply without lots/aggregate — same as today's buggy behavior. Don't let the hydration fix become a new failure mode.
6. **No tests, no smoke** — Tom re-runs SF-2 repro manually after ship.

---

## What's explicitly out of scope

- Storage-location display reflecting actual lot locations on supply row (SF-2-sub-a). Separate prompt; needs SupplyDetailScreen + a lot-location summary helper.
- Multi-location display when lots span multiple storages (SF-2-sub-b). Bundled with sub-a.
- "Cook from supply" workflow combo for tracks_lots non-recipe cooks (SF-2-extra / P8R-D38). Feature scope, post-F&F.
- Restoring D8R-Q54 cycle-tap as a long-press option. If Tom wants manual status override on tracks_lots without going through SupplyDetailScreen, the long-press action sheet is the existing path.
- Any change to the `LotBadge.tsx` component itself — it's pure presentation, no behavior to change.

---

## Verification

1. `npx tsc --noEmit -p .` filtered to touched files (`lib/services/suppliesService.ts`, `components/pantry/SupplyRow.tsx`). Zero new errors.
2. **Read-through verification:**
   - Confirm `cycleSupplyStatus`, `setSupplyStatus`, `setSupplyUsageLevel` return a `SupplyWithTags` with non-undefined `lots` + `lot_aggregate` when `supply.tracks_lots === true`.
   - Confirm non-tracks_lots paths are unchanged (no extra query, no extra fields on the returned supply).
   - Confirm `handleLotBadgeTap` no longer calls any service function — pure UI toggle.
   - Confirm `handleStatusIconTap` (the non-lots branch) is unchanged — still cycles usage level via `setSupplyUsageLevel`. tracks_lots supplies don't reach this handler (they render LotBadge instead).
3. **Manual smoke after ship** (Tom):
   - Repro the falafel disappear scenario: tap LotBadge → expect row to expand (not change badge appearance), lots visible inside LotsCollapser.
   - Slide usage-level slider on a tracks_lots supply via SupplyControls → expect supply row to keep its LotBadge after the update.
   - Open SupplyDetailScreen for a tracks_lots supply, tap Restock or status buttons → expect lots section to remain populated after the action.
   - Repro non-tracks_lots cycle: tap StatusIcon (5-circle) → expect dots to cycle as before (regression check).

---

## SESSION_LOG entry template

```
## 2026-05-14 — CP6e-SmokeFix-SF2 · LotBadge tap + tracks_lots hydration fix

**Type:** Service-layer + component fix. Closes SF-2 from CP6e smoke (perceived lot data loss).

**Files modified:**
- `lib/services/suppliesService.ts` — +N lines. Added `getHydratedSupply` helper (or extended existing). Updated `cycleSupplyStatus`, `setSupplyStatus`, `setSupplyUsageLevel` to return hydrated supplies when `tracks_lots = true`. Non-tracks_lots paths unchanged (no extra query). ⚠️ PK snapshot now stale.
- `components/pantry/SupplyRow.tsx` — +N lines / -N lines. Replaced `handleLotBadgeTap`'s `cycleSupplyStatus` call with `onToggleExpanded()` to surface lot details on tap. Updated accessibility label. Long-press behavior unchanged. ⚠️ PK snapshot now stale.

**Q-rule resolution:**
- D8R-Q54 OVERRIDDEN. Original intent (LotBadge tap cycles supply.status manually) replaced with tap = expand row. Override is in code comment for now; doc reconciliation to PHASE_8R_UNIFIED_NEEDS at end-of-CP6e refresh.

**Decisions made during build:**
- [Whether you reused an existing helper or added a new one for getHydratedSupply]
- [Hydration placement in setSupplyUsageLevel's two branches (status-change branch vs direct-patch branch)]
- [Anything else]

**Constraints honored:**
- No changes to lotsService.
- TypeScript strict; no `any`.
- Non-tracks_lots paths unchanged — zero extra-query overhead.
- Defensive degradation: lot-fetch failures fall back to pre-fix behavior (supply without aggregate), not a hard failure.

**Verification:** `npx tsc --noEmit -p .` filtered = zero errors.

**Read-through verification:**
- ✅ `cycleSupplyStatus` returns hydrated supply on tracks_lots
- ✅ `setSupplyStatus` returns hydrated supply on tracks_lots
- ✅ `setSupplyUsageLevel` returns hydrated supply on tracks_lots in both branches
- ✅ Non-tracks_lots paths skip extra fetch
- ✅ `handleLotBadgeTap` no longer calls any service function
- ✅ Long-press path unchanged on LotBadge tap target
- ✅ StatusIcon cycle path (non-lots branch) unchanged

**Maps to:** Closes SF-2 in CP6e_SMOKE_FINDINGS_2026-05-14.md. P8R-D34 deferred-work entry can be marked ✅ Resolved.

**Surprises / Notes for Claude.ai:**
[anything worth flagging]
```

---

End of prompt.
