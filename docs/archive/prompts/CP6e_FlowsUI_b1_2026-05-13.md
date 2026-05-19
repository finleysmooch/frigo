# CC PROMPT — CP6e-FlowsUI-b1 · Grocery acquire lot toast

**Phase:** 8R · CP6e-Lots · FlowsUI sub-phase b1 (of 2 — b2 = search UI, drafted separately)
**Date drafted:** 2026-05-13 (Claude.ai planning instance)
**Predecessor:** CP6e-FlowsUI-a (shipped 2026-05-13, smoke deferred)
**Successor:** CP6e-FlowsUI-b2 (search results UI)
**F&F target:** late August / early September 2026

---

## Context

When a user acquires a need linked to a `tracks_lots=true` supply, `needsService.setNeedStatus` (via `_handleAcquiredSideEffects`) silently creates a new lot via `lotsService.createLot` (CP6e-Services-c). Today, this happens with **no user-facing surface** — the lot just appears in the pantry. CP6e-Services-c's SESSION_LOG explicitly anticipated this gap:

> "`statusChangedTo` from helper is internal-only (returned to caller's `console.log`, not exposed to UI). CP6e-FlowsUI can add a `setNeedStatusWithDetails` variant for toast metadata if needed."

This sub-phase wires that surface. After a single-need user-action acquire that creates a lot, a top-floating toast appears summarizing what landed in the pantry, with Edit + Undo affordances and a 5-second auto-dismiss.

### Scope leans (locked in Claude.ai chat)

- **Toast fires only for tracks_lots acquires that successfully created a lot** (gate: `sideEffect.lotCreated !== null`). Non-tracks_lots acquires (status flip only) stay silent.
- **Single-need user-action acquires only.** Bulk paths (BulkAcquirePromotionModal, ViewDetailScreen's bulk acquire loop, merged-group cycle) suppress the toast. Side effects (lot creation) still fire in those bulk paths — only the toast is suppressed.
- **Edit + Undo both in scope.** Edit opens `LotEditSheet` for the freshly-created lot. Undo is a best-effort revert: deleteLot + setSupplyStatus back to `statusBefore` + setNeedStatus back to `in_cart` with `suppressSideEffects=true`. Best-effort means no guarantee against weird cascade interactions (e.g., if Q45 auto-restock fired AND a downstream cook depleted the lot before undo lands — rare for F&F).
- **Pause-on-edit-sheet, resume-on-close.** Auto-dismiss timer pauses while LotEditSheet is open (mounted inside the toast); resumes with a fresh 5s on close. Matches CookDepletionBanner's pattern.
- **No conflict-suppression with other top toasts.** AcquireLotToast can co-exist with CookDepletionBanner / SpawnOnOutToast. If smoke shows visual stacking issues, address in a follow-up.

---

## Pre-read order

1. `lib/services/needsService.ts` — focus on `_handleAcquiredSideEffects` (line ~747), `setNeedStatus` (line ~846), `cycleNeedStatus` (line ~897). You'll extend all three.
2. `lib/services/lotsService.ts` — `createLot`, `deleteLot`. The Undo path calls `deleteLot`.
3. `lib/services/suppliesService.ts` — `getSupplyById`, `setSupplyStatus`. Undo restores status via `setSupplyStatus`.
4. `lib/types/needs.ts` — `NeedWithTags`, `NeedStatus`. AcquireSideEffectResult type goes here.
5. `lib/types/supplies.ts` — `SupplyLot`, `SupplyStatus`, `SupplyWithTags`. Toast payload references these.
6. `contexts/SpawnOnOutToastContext.tsx` — sibling pattern. AcquireLotToastContext mirrors it.
7. `components/pantry/SpawnOnOutToast.tsx` (if exists; else check the SpawnOnOutToast component path used in App.tsx) — visual reference for top-floating toast with edges + auto-dismiss.
8. `components/pantry/CookDepletionBanner.tsx` — pause-on-modal-open pattern reference for the Edit-sheet interaction.
9. `components/pantry/LotEditSheet.tsx` — discover its current props signature (it was built in CP6e-PantryUI-b). The toast's Edit affordance mounts it. Note its supply + lot prop names; you'll pass the freshly-created lot.
10. `App.tsx` — see how `SpawnOnOutToastProvider` + `CookDepletionBannerProvider` are layered. AcquireLotToastProvider slots in alongside.
11. `screens/ViewDetailScreen.tsx` — lines ~270-340. Single-tap row handler (line ~276) is where the toast wire-up lands. Merged-group cycle handler (line ~340) stays as `Promise.all(cycleNeedStatus(...))` (no wire-up).

---

## Task list

### Task 1 — Extend `lib/services/needsService.ts`

**A. New exported type `AcquireSideEffectResult`** (or add to `lib/types/needs.ts` if you prefer; I'd keep it in needsService since it's a service-return shape):

```ts
export interface AcquireSideEffectResult {
  lotCreated: SupplyLot | null;
  statusBefore: SupplyStatus | null;       // captured at start of helper; needed for Undo
  statusChangedTo: SupplyStatus | null;
  skippedReason: string | null;
}
```

Note `statusBefore` is the new field — current `_handleAcquiredSideEffects` captures it as a local `statusBefore = supply.status` but doesn't return it. Add it to the return shape, populate from existing local var. Branches that short-circuit before the supply read (`no_supply_linked`, `supply_not_found`) leave `statusBefore` as null.

**B. Rename `_handleAcquiredSideEffects` → `handleAcquiredSideEffects` (public)** so external wrappers can call it without going through `setNeedStatus`. Update its return type to `Promise<AcquireSideEffectResult>` (include `statusBefore`).

**C. Add optional `suppressSideEffects` flag to `setNeedStatus`:**

```ts
export async function setNeedStatus(
  needId: string,
  newStatus: NeedStatus,
  options?: { suppressSideEffects?: boolean }
): Promise<NeedWithTags>
```

In the body, guard the existing helper call:

```ts
if (isAcquireTransition && !options?.suppressSideEffects) {
  await handleAcquiredSideEffects(result);
}
```

All 5 existing call sites (per CP6e-Services-c SESSION_LOG enumeration) call without the new arg → default behavior unchanged.

**D. Add `acquireNeedWithDetails(needId)` wrapper:**

```ts
export async function acquireNeedWithDetails(needId: string): Promise<{
  need: NeedWithTags;
  sideEffect: AcquireSideEffectResult;
}>
```

Body:
1. `const need = await setNeedStatus(needId, 'acquired', { suppressSideEffects: true });`
2. `const sideEffect = await handleAcquiredSideEffects(need);`
3. Return `{ need, sideEffect }`.

Errors from `setNeedStatus` propagate. Errors inside `handleAcquiredSideEffects` are already caught + logged + returned as a result with `skippedReason='side_effect_error'` (current helper behavior — preserve).

**E. Add `cycleNeedStatusWithDetails(needId)` wrapper:**

```ts
export async function cycleNeedStatusWithDetails(needId: string): Promise<{
  need: NeedWithTags;
  acquireSideEffect: AcquireSideEffectResult | null;  // non-null only when transition landed on 'acquired'
}>
```

Body:
1. Read current need (mirrors existing `cycleNeedStatus`).
2. Compute `next = STATUS_CYCLE_NEXT[current.status]`. If null (Q50 terminal): return `{ need: current, acquireSideEffect: null }` with the existing console.warn.
3. If `next === 'acquired'`: call `acquireNeedWithDetails(needId)`, map to `{ need, acquireSideEffect: sideEffect }`.
4. Else (next === 'in_cart'): call `setNeedStatus(needId, next)`, return `{ need, acquireSideEffect: null }`.

Existing `cycleNeedStatus` stays untouched — it's still the right entry point for callers that don't need toast metadata.

### Task 2 — Create `contexts/AcquireLotToastContext.tsx` (NEW)

Mirror `SpawnOnOutToastContext.tsx`. Singleton state.

```ts
export interface AcquireLotToastPayload {
  needId: string;                 // for Undo
  supply: SupplyWithTags;         // for display name + supply_id; UI reads ingredient.name | custom_name
  lot: SupplyLot;                 // freshly-created lot
  statusBefore: SupplyStatus | null;  // for Undo's setSupplyStatus call (skip if null or unchanged)
}

interface AcquireLotToastContextValue {
  currentToast: AcquireLotToastPayload | null;
  showToast: (payload: AcquireLotToastPayload) => void;
  dismissToast: () => void;
}
```

`showToast` replaces any existing toast (singleton). No `pauseTimer` / `resumeTimer` on the context — the pause behavior lives inside the toast component via local state (mirrors CookDepletionBanner).

Export `AcquireLotToastProvider` + `useAcquireLotToast()` hook with the same throw-if-outside-provider guard pattern.

### Task 3 — Create `components/pantry/AcquireLotToast.tsx` (NEW)

Top-floating toast, mounted at App level.

**Visual:**
- Same SafeAreaView + edges=['top'] + absolute positioning + zIndex/elevation: 1000 pattern as CookDepletionBanner.
- `marginTop: 64` for header clearance.
- Background: subtle success tint (`functionalColors.successLight` or matching `colors.primaryLight` — pick to match CookDepletionBanner).
- Border-left accent for visual continuity.
- Single-row layout: ✓ icon · message text · Edit · Undo · ✕

**Message format:**

`Acquired: {supplyName} · {qty} {unit} · added to {storageLabel} · expires {expDate}`

Where:
- `supplyName` = `supply.ingredient?.name ?? supply.custom_name ?? 'item'`
- `qty` = `lot.quantity` formatted (integer if whole, 2-decimal stripped of trailing zeros — copy `formatQty` helper from `LotRow.tsx`)
- `unit` = `lot.quantity_unit`
- `storageLabel` = capitalized storage_location ("Fridge", "Freezer", "Pantry", "Counter") — copy helper from `LotRow.tsx`
- `expDate` = `lot.expires_at` formatted as `{month} {day}` (e.g., "May 22"). If `lot.expires_at === null`: drop the entire ` · expires {expDate}` segment.

`numberOfLines={1}` on the message text with `flex: 1`. Long ingredient names truncate before the buttons.

**Behaviors:**

- **Auto-dismiss timer** — 5 seconds. `useEffect` pattern from CookDepletionBanner: clear on unmount or when `editOpen` flips true; restart fresh-5s when `editOpen` flips back to false. Timer also clears if `currentToast` becomes null (e.g., user dismissed via ✕ or Undo).
- **Edit button** — `setEditOpen(true)`. Renders `<LotEditSheet>` as a child (sibling to the toast bar). On sheet close, `setEditOpen(false)`. LotEditSheet's own save flow updates the lot in DB; the toast doesn't need to re-fetch — it's about to dismiss anyway. The toast's displayed message uses the snapshot from `currentToast.lot`; it WON'T reflect edits made via the sheet (acceptable; the toast is ephemeral). Use the `LotEditSheet` props you discover during pre-read.
- **Undo button** — async handler with local `undoing` state (button shows `…` while running). Sequence:
  1. `await deleteLot(currentToast.lot.id)` — lotsService import.
  2. If `currentToast.statusBefore !== null` AND the supply's current status would benefit from restore (best-effort — just call `setSupplyStatus(currentToast.supply.id, currentToast.statusBefore)` unconditionally and accept that any re-firing of Q10β/Q48 is benign): `await setSupplyStatus(currentToast.supply.id, currentToast.statusBefore);`
  3. `await setNeedStatus(currentToast.needId, 'in_cart', { suppressSideEffects: true });` — revert the need.
  4. `dismissToast()`.
  
  Wrap in try/catch. Log errors; still call `dismissToast()` in finally. Don't surface error UI within the toast for F&F simplicity — Undo is best-effort.
- **Close (✕)** — just `dismissToast()`. No side-effects (the acquire stands).

**Accessibility:**
- Toast: `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`.
- Edit / Undo / ✕: `accessibilityRole="button"` + labels.

### Task 4 — Mount in `App.tsx`

Add `AcquireLotToastProvider` as a sibling to `SpawnOnOutToastProvider`. Render `<AcquireLotToast />` alongside `<SpawnOnOutToast />` + `<CookDepletionBanner />` at the same level. Read App.tsx to find the existing nesting and slot in following the same pattern.

If there's a natural nesting (e.g., the existing providers are layered), put AcquireLotToastProvider as the OUTERMOST or INNERMOST — pick what matches the conventions you observe. Document the choice in the SESSION_LOG entry.

### Task 5 — Wire single-tap acquire in `screens/ViewDetailScreen.tsx`

**Target:** the single-tap row handler at approximately line 276.

Replace the `await cycleNeedStatus(needId)` call with `await cycleNeedStatusWithDetails(needId)`. Then:

```ts
const { acquireSideEffect } = await cycleNeedStatusWithDetails(needId);
if (acquireSideEffect?.lotCreated) {
  const supply = supplies.find(s => s.id === acquireSideEffect.lotCreated!.supply_id);
  if (supply) {
    showToast({
      needId,
      supply,
      lot: acquireSideEffect.lotCreated,
      statusBefore: acquireSideEffect.statusBefore,
    });
  }
}
```

`showToast` comes from `useAcquireLotToast()`. Add the hook call at the top of the component.

**Do NOT change:**
- The merged-group handler at line ~340 (`Promise.all(needIds.map(id => cycleNeedStatus(id)))`). Stays using `cycleNeedStatus` (no toast).
- The bulk acquire handler at line ~498 (`setNeedStatus(need.id, 'acquired')`). Stays using `setNeedStatus` (no toast).
- The cleanup flag from CP6e-Services-c SESSION_LOG about redundant `setSupplyStatus` calls in the bulk paths — that's a separate cleanup, not part of b1.

Other callers (BulkAcquirePromotionModal lines 144, 160): no changes — bulk modal stays silent.

---

## Constraints

1. **No changes to existing function bodies except:** `setNeedStatus` (add optional arg + guard), `_handleAcquiredSideEffects` → `handleAcquiredSideEffects` rename + return-type extension (add `statusBefore`).
2. **No changes to** `lotsService.ts` (any function), `suppliesService.ts` (any function), `cookDepletionService.ts`, `CookDepletionBanner.tsx`, `SpawnOnOutToast.tsx`, `LotEditSheet.tsx`.
3. **TypeScript strict.** No `any`.
4. **Components don't call Supabase directly.** Undo path calls `deleteLot` + `setSupplyStatus` + `setNeedStatus` (all service functions).
5. **No new types in `lib/types/needs.ts` if avoidable** — `AcquireSideEffectResult` lives in `needsService.ts` next to the function that returns it. `AcquireLotToastPayload` is component-internal (in the context file).
6. **Accessibility on every interactive element.**
7. **No tests, no smoke** — smoke deferred to combined PantryUI + FlowsUI smoke per Tom.
8. **Existing call sites preserved.** All 5 acquire call sites from CP6e-Services-c's SESSION_LOG enumeration continue to work without modification (since `setNeedStatus`'s new arg is optional).

---

## What's explicitly out of scope (do NOT implement)

- Toast for non-tracks_lots acquires (Branch A — status flip only). Toast gates on `lotCreated !== null`.
- Toast for merged-group cycles (`Promise.all(cycleNeedStatus(...))` at ViewDetailScreen line ~340).
- Toast for bulk paths (BulkAcquirePromotionModal, ViewDetailScreen bulk loop).
- Cleanup of the redundant `setSupplyStatus` calls in BulkAcquirePromotionModal / ViewDetailScreen bulk loop (flagged in CP6e-Services-c SESSION_LOG; separate prompt).
- Search results UI (CP6e-FlowsUI-b2).
- Any change to `cycleNeedStatus` (keep it as-is; `cycleNeedStatusWithDetails` is a new sibling).
- Auto-restock toast surface for Q45 cascades that fire from sources OTHER than acquire (currently none — Q45 fires only from createLot, which only fires from acquire and supply-create initial-lot flow; if other callers emerge, that's separate).

---

## Verification

1. `npx tsc --noEmit -p .` — filter to the touched files (`lib/services/needsService.ts`, `contexts/AcquireLotToastContext.tsx`, `components/pantry/AcquireLotToast.tsx`, `App.tsx`, `screens/ViewDetailScreen.tsx`). Zero new errors. Pre-existing errors listed separately in SESSION_LOG.
2. **Read-through verification:**
   - Confirm all 5 existing `setNeedStatus(.., 'acquired')` call sites compile without changes (the new optional arg is back-compat).
   - Confirm `cycleNeedStatus` still routes through `setNeedStatus` and still fires side effects (existing behavior — `cycleNeedStatusWithDetails` is the new path; `cycleNeedStatus` unchanged).
   - Confirm the toast renders ONLY when `currentToast.lot` is defined AND non-null. A defensive guard at the top of the component (`if (!currentToast) return null;`) is sufficient given the context only stores payloads with a `lot` field.
   - Confirm the Edit-sheet pause pattern: opening the sheet clears the auto-dismiss timer; closing restarts a fresh 5s. Inspect the useEffect dep list — should include `editOpen` and `currentToast`.
   - Confirm Undo handler awaits all three service calls in sequence and dismisses in `finally` even on error.
3. **Sanity check the side-effect-suppression flow.** `acquireNeedWithDetails` calls `setNeedStatus(.., 'acquired', { suppressSideEffects: true })` THEN `handleAcquiredSideEffects(need)` manually. The helper should fire ONCE — no double-fire. Trace through and confirm.

---

## SESSION_LOG entry template

Standard format. Top of `docs/SESSION_LOG.md` under today's date.

```
## 2026-05-13 — CP6e-FlowsUI-b1 · Grocery acquire lot toast

**Type:** UI build. First of 2 FlowsUI-b sub-prompts. Surfaces the CP6e-Services-c lot-create side-effect through a top-floating toast with Edit + Undo affordances.

**Files modified:**
- `lib/services/needsService.ts` — +N lines. Added `AcquireSideEffectResult` type (statusBefore + lotCreated + statusChangedTo + skippedReason); renamed `_handleAcquiredSideEffects` → `handleAcquiredSideEffects` (public) + extended return type with `statusBefore`. Added optional `suppressSideEffects` to `setNeedStatus`. Added `acquireNeedWithDetails(needId)` and `cycleNeedStatusWithDetails(needId)` wrappers. Existing `cycleNeedStatus` untouched. All 5 pre-existing acquire call sites compile unchanged. ⚠️ PK snapshot now stale.
- `App.tsx` — +N lines. Mounted `AcquireLotToastProvider` + `<AcquireLotToast />` alongside existing toast/banner providers. Nesting: [describe what you chose and why].
- `screens/ViewDetailScreen.tsx` — +N lines. Single-tap row handler swapped from `cycleNeedStatus` → `cycleNeedStatusWithDetails`; on success with non-null `lotCreated`, fires `showToast` with the resolved supply (from local `supplies` array) + lot + statusBefore. Merged-group handler + bulk loop unchanged.

**Files created:**
- `contexts/AcquireLotToastContext.tsx` (NEW, ~N lines) — singleton toast state mirroring SpawnOnOutToastContext. Exports `AcquireLotToastPayload`, provider, hook.
- `components/pantry/AcquireLotToast.tsx` (NEW, ~N lines) — top-floating toast with 5s auto-dismiss, pause-on-edit-sheet, Edit (opens LotEditSheet for fresh lot), Undo (deleteLot + setSupplyStatus to statusBefore + setNeedStatus to in_cart with suppressSideEffects), ✕ dismiss.

**Q-rule wiring:**
- D8R-Q45 (auto-restock cascade): `statusBefore` captured in `AcquireSideEffectResult` for Undo's setSupplyStatus revert call.
- Existing Branch A / B logic in `handleAcquiredSideEffects` unchanged; only the return shape extends.

**Decisions made during build:**
- [LotEditSheet prop names — what you discovered + how you passed the lot]
- [Provider nesting order in App.tsx + reasoning]
- [Any visual styling choices for the toast — successLight tint chosen, etc.]
- [Anything else that came up]

**Constraints honored:**
- No changes to lotsService / suppliesService / cookDepletionService / existing toast components.
- TypeScript strict; no `any`.
- All 5 pre-existing `setNeedStatus(.., 'acquired')` call sites compile without modification.
- Single-need user-action acquires only — bulk paths and merged-group cycles do NOT fire the toast.
- Accessibility on every interactive element.

**Verification:** `npx tsc --noEmit -p .` filtered to touched files = zero errors.

**Tracker rows:** [generate per CLAUDE.md Rule X format]

**Tracking-doc reconciliation (Rule E PK-snapshot):**
[run the standard check + report]

**Recommended next steps for Tom:**
1. Sanity-read the diff. Visual review of the toast flow deferred until combined smoke.
2. Next CC engagement: **CP6e-FlowsUI-b2** (search results UI for `search_supplies` RPC).

**Surprises / Notes for Claude.ai:**
[anything worth flagging]
```

---

## ID card

| Label | UUID |
|---|---|
| Space ("Home") | `7aa945ab-fb32-4197-ae11-e6dbd3392587` |
| Tom's user_id | `47feb56f-530f-4ab3-8fef-33664c3885b7` |
| `SUPPLY_CHICKEN_ID` (tracks_lots=true) | `7be3388d-18b3-4279-b6c8-92974151ef6f` |
| `SUPPLY_OLIVE_OIL_ID` | `430d8b9d-a597-4215-940a-ad5d01ad7702` |

---

End of prompt.
