# CC Prompt — Phase 8R-CP6b: Tab 12 Supply Create + Tab 9 Spawn Toast + Edit-Need Modal

**Phase:** 8R-CP6b (heaviest CP of the 8R series — 3 new modal/sheet/toast surfaces, 1 service addition, 4 wiring updates)
**Predecessor:** 8R-CP6a shipped 2026-04-30 (createNeed dedup hoist + AddNeedSheet T3 top + SupplyRow long-press jump-set). Smoke test deferred per Tom's "build 6b first, then test everything" decision.
**Successor:** 8R-CP6c (cart visibility + bulk acquire + filename rename + cleanup). CP6b is prerequisite — CP6c's bulk-acquire bulk-creates needs that benefit from CP6a's dedup, and CP6c's cleanup pass relies on CP6b's surfaces being stable.
**Standing rules in effect:** A, B, C, D, E.

---

## Context

CP6b builds the three remaining 8R wireframe surfaces:

1. **Tab 12 — Supply Create Sheet.** New sheet for "track without needing now." Wired from PantryScreen's "+ Add new" tap (currently navigates to ManageSuppliesScreen) AND from ExpandedRegularsSheet's "+ Add new supply" footer (currently `Alert.alert('Coming in CP6')`). 3-tier autocomplete mirroring AddNeedSheet but with Tier 1 inverted (matching existing supply → "this already exists, edit it instead" hint). Initial status restricted to in_stock / low / out per D8R-Q35. Save-as-regular concept doesn't apply (it IS the supply create path).

2. **Tab 9 — Spawn-on-Out Toast.** Ephemeral toast surfacing supply→out transitions. Triggered by `SupplyStatusResult.spawnedNeed` being non-null after a `setSupplyStatus(supplyId, 'out')` call (i.e., when CP3's spawn-on-out logic created a new need). Toast format: "Olive oil out → added to needs" + Edit action + Undo action. Edit opens the edit-need modal pre-populated for the spawned need. Undo reverts the supply to its prior status AND deletes the spawned need atomically. Suppressed when CookDepletionBanner is showing (cookDepletion path has its own banner UX).

3. **Tab 9 — Edit-Need Modal (long-press on need row).** Opens via long-press on a need row in ViewDetailScreen. Configure form: quantity, unit, tag chips (urgency / store / recipe / for-user), notes. Conditional "Update default routing" toggle per D8R-Q34 — appears ONLY when the need's tags differ from its supply's tags AND supply_id is set. Toggle ON saves the need's tags onto the supply too (changes future restocks' default tag set). Save calls a new `needsService.updateNeed` function (added in this CP).

**Plus a small service addition:**

4. **`needsService.updateNeed`** for non-status field updates (quantity_display, unit_display, custom_name, for_user_ids, tagIds, notes). Mirrors `suppliesService.updateSupply`'s pattern. Status updates stay on the existing `setNeedStatus`/`cycleNeedStatus`. Required by EditNeedSheet's Save flow.

**Plus four wiring updates:**

5a. **PantryScreen** — `handleAddNewTap` opens SupplyCreateSheet instead of navigating to ManageSuppliesScreen.
5b. **ExpandedRegularsSheet** — footer's "+ Add new supply" Alert replaced with SupplyCreateSheet open. Sheet's `onSaved` callback triggers Regulars zone refetch (the new supply joins the Regulars list immediately).
5c. **ViewDetailScreen** — NeedRow gains `onLongPress` prop. ViewDetailScreen handles long-press → opens EditNeedSheet with the tapped need's ID. Save triggers needs reload.
5d. **App.tsx** — wraps the existing provider tree with new `SpawnOnOutToastProvider` (sibling to CookDepletionBannerProvider).

**Out of scope (deferred):**
- Cart visibility, bulk acquire, filename rename, type cleanup, PK_CODE_SNAPSHOTS reconciliation — CP6c.
- ManageSuppliesScreen rewrite — Tab 12 takes over the supply-create path. ManageSuppliesScreen stays as the browse/search surface; its own "+create" path becomes redundant but is left intact for CP6c cleanup. **Q1 below flags whether Tom wants ManageSuppliesScreen's create path REMOVED in CP6b vs left for CP6c.**
- D22 (UnitPicker), D23 (highlightsService rewire) — separate work.

---

## Inputs to read

1. `docs/PHASE_8R_UNIFIED_NEEDS.md` v0.5 — focus on D8R-Q21, Q23, Q27, Q34, Q35, Q37, Q41, Q48 (spawn-on-out idempotency).
2. `docs/wireframes/phase_8r/phase_8r_wireframes_v3.html` — Tab 9 (spawn toast + edit-need modal) and Tab 12 (supply create) detailed specs.
3. `docs/wireframes/phase_8r/phase_8r_wireframes_README.md` — tab→checkpoint mapping for context.
4. `docs/SESSION_LOG.md` — most recent CP6a entry.
5. `lib/services/suppliesService.ts` — `createSupply` + `setSupplyStatus` (CP6b's Undo path uses these). Confirmed signatures from `_pk_sync/lib__services__suppliesService_2026-04-30b.ts`.
6. `lib/services/needsService.ts` — `createNeed` (post-CP6a dedup), `setNeedTags`, `deleteNeed`. Part 4 ADDS `updateNeed` here.
7. `lib/services/tagsService.ts` — `getOrCreateTag`, `getTagsForSpace`, `setNeedTags`, `setSupplyTags` (the last two for the "Update default routing" toggle).
8. `components/AddNeedSheet.tsx` — pattern reference for the 3-tier autocomplete + tag-picker + configure form. SupplyCreateSheet mirrors this structure.
9. `components/ExpandedRegularsSheet.tsx` — for the "+ Add new supply" footer wiring point.
10. `screens/GroceryListDetailScreen.tsx` (post-CP5a + CP5b + CP6a; staged at `_pk_sync/screens__GroceryListDetailScreen_2026-04-30b.tsx`) — for NeedRow long-press wiring + EditNeedSheet mounting.
11. `contexts/CookDepletionBannerContext.tsx` (staged at `_pk_sync/contexts__CookDepletionBannerContext_2026-04-30b.tsx`) — pattern reference for SpawnOnOutToastContext.
12. `screens/PantryScreen.tsx` (staged 2026-04-30) — for `handleAddNewTap` rewire.
13. `App.tsx` — for provider tree wrap.
14. `lib/types/needs.ts` — `Need`, `NeedWithTags`, `NeedWithDetails`, `UpdateNeedParams` (NEW; needs to be added). Confirm convention by reading existing `UpdateSupplyParams` in `lib/types/supplies.ts`.
15. `lib/types/supplies.ts` — `CreateSupplyParams`, `SupplyInitialStatus` (the `'in_stock' | 'low' | 'out'` subset enum per Q35). Q35 enforcement is already in `createSupply`; SupplyCreateSheet needs to respect it in the UI.

---

## Task

### Part 1 — `needsService.updateNeed` (new service function)

Edit `lib/services/needsService.ts` and `lib/types/needs.ts`.

**Edits to `lib/types/needs.ts`:**

Add `UpdateNeedParams` interface. Pattern matches `UpdateSupplyParams` (read it first to confirm convention):

```ts
export interface UpdateNeedParams {
  customName?: string | null;
  quantityDisplay?: number | null;
  unitDisplay?: string | null;
  forUserIds?: string[];
  tagIds?: string[];
  notes?: string | null;
}
```

Notes:
- Status NOT included — separate path via `setNeedStatus`/`cycleNeedStatus`.
- ingredient_id and supply_id NOT included — those are identity fields, can't change post-create.
- All fields optional — only provided ones get patched. tagIds replaces the full tag set when provided (matches `setSupplyTags` semantics).

**Edits to `lib/services/needsService.ts`:**

Add `updateNeed` function. Pattern mirrors `updateSupply`:

```ts
// ============================================
// UPDATE — non-status fields
// ============================================

/**
 * Update non-status fields on an existing need. Status is managed via
 * setNeedStatus/cycleNeedStatus. ingredient_id and supply_id are identity
 * fields and cannot be changed post-create.
 *
 * tagIds replaces the full tag set when provided. Pass empty array to clear.
 */
export async function updateNeed(
  needId: string,
  params: UpdateNeedParams
): Promise<NeedWithTags> {
  console.log('🛒 Updating need:', { needId, params });

  const patch: Record<string, unknown> = {};
  if (params.customName !== undefined) patch.custom_name = params.customName;
  if (params.quantityDisplay !== undefined) patch.quantity_display = params.quantityDisplay;
  if (params.unitDisplay !== undefined) patch.unit_display = params.unitDisplay;
  if (params.forUserIds !== undefined) patch.for_user_ids = params.forUserIds;
  if (params.notes !== undefined) patch.notes = params.notes;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from('needs')
      .update(patch)
      .eq('id', needId);

    if (error) {
      console.error('❌ Error updating need:', error);
      throw error;
    }
  }

  if (params.tagIds !== undefined) {
    await setNeedTags(needId, params.tagIds);
  }

  const result = await getNeedByIdWithTagsOnly(needId);
  if (!result) throw new NeedNotFoundError(needId);
  return result;
}
```

Place this AFTER the `createNeed` function and BEFORE the `setNeedStatus` function (mirrors update-create-status grouping in suppliesService).

Add the import for `UpdateNeedParams` at the top of needsService.ts.

### Part 2 — `components/SupplyCreateSheet.tsx` (new component, Tab 12)

Create new file. Bottom-sheet modal mirroring AddNeedSheet's structure but with these differences:

**Header:** "Add to pantry" (or "Track new supply"). Cancel + (no Save in header — Save lives in footer once selection made).

**Body — search input + 3-tier autocomplete:**

Same pattern as AddNeedSheet but with semantics inverted for T1:

- **Tier 1 — existing supply (warning, not fast path):** match supply.display_name ILIKE %query%. Top 5 results. Prefix marker: 🏠. Selection shows: "{name} already in your pantry — edit it instead?" with "Edit" + "Cancel" buttons. Edit closes SupplyCreateSheet and opens... actually, Tab 8 supply detail isn't built yet (Q stub). For CP6b, the Edit button stubs to `Alert.alert('{name}', 'Supply detail coming in a future CP.')`. **Do NOT route to ManageSuppliesScreen as a fallback** — that creates a navigation loop.

- **Tier 2 — catalog ingredient (primary path):** call `supabase.rpc('search_ingredients', { query_text: query })`. Filter out ingredient_ids already linked to a supply in this space (cross-reference T1's supplies). Top 10. Prefix marker: 🆕. Selection drops user into the configure form.

- **Tier 3 — custom name (always-visible at top per D8R-Q33):** "Add custom: '{query}'" row, top of results when query.length >= 2 and no exact match in T1/T2. Prefix marker: ✏️. Selection drops user into the configure form with `ingredient_id = null`.

**Body — configure form (post-selection):**

- **Display name** — read-only from selection.
- **Initial status — segmented control: In stock / Low / Out** per D8R-Q35. Critical NOT shown (only reachable via cycling). Default: In stock.
- **Tag chips — multi-select per dimension** (urgency / store / recipe). Same pattern as AddNeedSheet's tag picker. Pre-populate empty (no view context — this is a pantry-side surface). Inline "+ Add new tag" via `getOrCreateTag`.
- **For-user multi-select** — empty default = "Everyone" per Q37. Dropdown of space members. Per AddNeedSheet's deferral (P8R-D13), this can stub as "Everyone (default)" non-interactive label for CP6b. **Q3 below flags this is a CP6b decision.**
- **Brands** — comma-separated text input, parsed to array on save. Optional. Skip if you want; brands isn't smoke-test-prominent.
- **Notes** — single-line text input. Optional.

**Footer:**
- "Save" button. Disabled until a selection exists AND status is set (defaults to in_stock so always set — really just requires selection).

**Save behavior:**

1. Call `suppliesService.createSupply({ spaceId, ingredientId, customName, status, forUserIds, brands, addedBy, notes, tagIds })`.
2. If success: close sheet + toast "Added to pantry" + call `onSaved` callback.
3. If status is 'out': `createSupply` does NOT spawn a need (spawn-on-out is on the `setSupplyStatus` path, not `createSupply`). This is intentional per the existing service behavior. **Do NOT spawn a need on supply-create-as-out** — defer to the user's manual transitions if they want to track the need.
4. On error: toast + keep sheet open.

**Implementation notes:**

- Use `useActiveSpaceId()` from SpaceContext.
- `userId` from `supabase.auth.getUser()` once on mount.
- Search debounce: 200ms (matches AddNeedSheet).
- Sheet primitive: same Modal + bottom-sheet pattern as AddNeedSheet.
- KeyboardAvoidingView wrapping the form.

### Part 3 — `contexts/SpawnOnOutToastContext.tsx` + `components/SpawnOnOutToast.tsx` (new files, Tab 9 ephemeral)

**Edits to `contexts/SpawnOnOutToastContext.tsx`:**

New file. Sibling pattern to `CookDepletionBannerContext`:

```tsx
import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { SupplyWithTags } from '../lib/types/supplies';

interface ToastState {
  supply: SupplyWithTags;
  spawnedNeedId: string;
  priorStatus: SupplyStatus; // for Undo
}

interface SpawnOnOutToastContextValue {
  currentToast: ToastState | null;
  showToast: (supply: SupplyWithTags, spawnedNeedId: string, priorStatus: SupplyStatus) => void;
  dismissToast: () => void;
}

// ... provider + useSpawnOnOutToast hook, mirroring CookDepletionBannerContext exactly.
```

Provider mounts in App.tsx (Part 5d).

**Auto-dismiss:** the toast auto-dismisses after 5 seconds via setTimeout inside the provider, unless the user taps Edit or Undo (which dismiss explicitly). Use a useEffect with cleanup to handle the timer.

**Conflict suppression:** the showToast function should check if `CookDepletionBannerContext.currentBanner` is non-null and SKIP showing if so (CookDepletion fires its own banner that captures the same intent — stacking would be jarring). Pull this check via `useCookDepletionBanner()` inside the provider OR pass it through callers' awareness — **flag the implementation choice**.

**Edits to `components/SpawnOnOutToast.tsx`:**

New file. The visual.

```tsx
// Renders the toast pinned to bottom of screen with safe-area inset.
// Reads from useSpawnOnOutToast(); if currentToast is null, returns null.
//
// Layout:
//  [icon] Olive oil out → added to needs    [Edit] [Undo] [×]
//
// Edit action: opens EditNeedSheet for currentToast.spawnedNeedId.
//   For CP6b: this routes via prop callback `onEditPress(needId)` so the
//   parent screen mounting the toast can open EditNeedSheet itself.
//
// Undo action:
//   1. Call needsService.deleteNeed(currentToast.spawnedNeedId).
//   2. Call suppliesService.setSupplyStatus(currentToast.supply.id, currentToast.priorStatus).
//      ⚠ This will NOT re-spawn (priorStatus is in_stock/low/critical, not out).
//      Q48 idempotency in spawn handles dedup if the user re-cycles to out later.
//   3. Dismiss toast.
//   4. Trigger refresh on the calling surface (SuppliesSection or ViewDetailScreen).
```

The visual layout follows the wireframe v3 Tab 9 spec — sticky bottom toast, Edit + Undo actions inline, dismiss × on right.

**Mounting:** the toast component needs to be rendered somewhere in the app's view tree to be visible. The cleanest spot is alongside `<CookDepletionBanner>` in whatever screen mounts that today (search via `grep -rn "CookDepletionBanner\|useCookDepletionBanner" --include="*.tsx" screens/`). Mount `<SpawnOnOutToast onEditPress={...} />` next to it. **STOP and flag** if no clear precedent for how CookDepletionBanner is mounted exists in screen code (it might be App-level via the context, in which case SpawnOnOutToast follows suit).

### Part 4 — `components/EditNeedSheet.tsx` (new component, Tab 9 long-press)

Create new file. Bottom-sheet modal. Smaller than AddNeedSheet (no autocomplete tier dispatch; user is editing an existing need's fields).

**Props:**
```ts
interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  spaceId: string;
  userId: string;
  needId: string | null; // the need being edited; null when not visible
}
```

**Open behavior:**
- When `visible && needId`: hydrate the need via `getNeedById` (verify this exists in needsService; if not, use the existing query pattern from `getNeedByIdWithTagsOnly` — exposed or replicated).
- ALSO hydrate the supply if `need.supply_id` is set (for the conditional "Update default routing" toggle).

**Header:** "Edit need" + Cancel + Save buttons.

**Body — configure form:**

- **Display name** — read-only label.
- **Quantity** — TextInput, pre-populated from `need.quantity_display`.
- **Unit** — TextInput, pre-populated from `need.unit_display`. (UnitPicker swap is D22 deferred.)
- **Tag chips — multi-select per dimension** (urgency / store / recipe) — pre-populated from `need.tags`. Same chip pattern as AddNeedSheet's tag picker. Inline "+ Add new tag" via `getOrCreateTag`.
- **For-user multi-select** — pre-populated from `need.for_user_ids`. Same stub treatment as SupplyCreateSheet for CP6b (P8R-D13).
- **Notes** — TextInput, pre-populated from `need.notes`.
- **"Update default routing" toggle (CONDITIONAL):** appears ONLY when ALL of:
    - `need.supply_id` is set (need is linked to a supply)
    - The need's tagIds (after edit) differ from the supply's tagIds (compute diff at render time)
  Toggle text: "Apply these tags to {supply.name} as the default" (or similar — match wireframe phrasing).
  Toggle default: OFF.

**Footer:**
- Save button.
- Delete button (red destructive style) — calls `deleteNeed(needId)` after confirmation Alert. Same pattern as ManageSuppliesScreen's delete.

**Save behavior:**

1. Compute the diff between current form state and original need state.
2. Call `needsService.updateNeed(needId, { quantityDisplay, unitDisplay, tagIds, forUserIds, notes })`.
3. If "Update default routing" toggle is ON AND need.supply_id is set:
    - Call `tagsService.setSupplyTags(supply.id, formTagIds)`.
4. Close sheet + onSaved callback + toast "Updated".
5. On error: toast + keep sheet open.

**Implementation notes:**

- Reuse the tag-picker pattern from AddNeedSheet — the `renderTagDimensionSection` style helper. Ideally extract to a shared component `<TagDimensionPicker>` per P8R-D14 since this is the third consumer (AddNeedSheet, ViewCreatorModal, EditNeedSheet) — **but for CP6b, just inline the pattern again. P8R-D14 captures the extraction as future cleanup.** Constraint 3 below reinforces this.
- Sheet primitive: Modal + bottom-sheet, same as AddNeedSheet.
- The "Update default routing" toggle's diff computation is the trickiest part. Compute as: `setEqual(supply.tags.map(t => t.id), formTagIds)` — show toggle iff they're not equal.

### Part 5 — Wiring

**5a. `screens/PantryScreen.tsx`:**

Replace `handleAddNewTap` to open SupplyCreateSheet instead of navigating:

```tsx
// BEFORE:
const handleAddNewTap = useCallback(() => {
  navigation.navigate('ManageSupplies');
}, [navigation]);

// AFTER:
const [supplyCreateSheetOpen, setSupplyCreateSheetOpen] = useState(false);

const handleAddNewTap = useCallback(() => {
  setSupplyCreateSheetOpen(true);
}, []);

const handleSupplyCreated = useCallback(() => {
  setSupplyCreateSheetOpen(false);
  setRefreshTrigger((n) => n + 1);
}, []);

// In JSX, after <CreateSpaceModal>:
{activeSpaceId && currentUserId && (
  <SupplyCreateSheet
    visible={supplyCreateSheetOpen}
    onClose={() => setSupplyCreateSheetOpen(false)}
    onSaved={handleSupplyCreated}
    spaceId={activeSpaceId}
    userId={currentUserId}
  />
)}
```

PantryScreen needs `currentUserId` if not already loaded. Check the file; if it loads `useEffect(() => { supabase.auth.getUser()... })` already, reuse. If not, add it.

**Q4 below: ManageSuppliesScreen disposition.** PantryScreen no longer navigates there from "+". Question is whether ManageSuppliesScreen stays as a separate path or becomes orphaned for CP6c removal. CP6b's scope: leave it for CP6c. Just rewire the FAB.

**5b. `components/ExpandedRegularsSheet.tsx`:**

Replace footer Alert with SupplyCreateSheet open:

```tsx
// BEFORE:
const handleAddNewSupply = () => {
  Alert.alert('Add supply', 'Coming in CP6.');
};

// AFTER:
const [supplyCreateOpen, setSupplyCreateOpen] = useState(false);

const handleAddNewSupply = () => {
  setSupplyCreateOpen(true);
};

const handleSupplyCreated = () => {
  setSupplyCreateOpen(false);
  // Reload the supplies list inside ExpandedRegularsSheet.
  // Existing effect should handle it via a refresh trigger pattern,
  // OR add a refetch call here. Match existing precedent in the file.
};

// At end of JSX, alongside other modals:
<SupplyCreateSheet
  visible={supplyCreateOpen}
  onClose={() => setSupplyCreateOpen(false)}
  onSaved={handleSupplyCreated}
  spaceId={spaceId}
  userId={userId}
/>
```

**5c. `screens/GroceryListDetailScreen.tsx` (ViewDetailScreen):**

Add long-press wiring + EditNeedSheet mount:

```tsx
// Add state:
const [editNeedSheetOpen, setEditNeedSheetOpen] = useState(false);
const [editingNeedId, setEditingNeedId] = useState<string | null>(null);

// Add handler:
const handleLongPressNeed = (needId: string) => {
  setEditingNeedId(needId);
  setEditNeedSheetOpen(true);
};

const handleEditSaved = () => {
  setEditNeedSheetOpen(false);
  setEditingNeedId(null);
  load();
};

// Pass onLongPress to NeedRow:
<NeedRow
  // ... existing props
  onLongPress={handleLongPressNeed}  // NEW
/>

// Mount EditNeedSheet alongside other sheets:
<EditNeedSheet
  visible={editNeedSheetOpen}
  onClose={() => { setEditNeedSheetOpen(false); setEditingNeedId(null); }}
  onSaved={handleEditSaved}
  spaceId={spaceId}
  userId={currentUserId}
  needId={editingNeedId}
/>
```

Update `NeedRow` interface to accept `onLongPress?: (needId: string) => void` and wire it to the row's TouchableOpacity:

```tsx
<TouchableOpacity
  style={styles.needRow}
  onPress={() => onCycle(head.id)}
  onLongPress={() => onLongPress?.(head.id)}  // NEW
  delayLongPress={400}
  activeOpacity={0.7}
  // ... existing props
>
```

**5d. `App.tsx`:**

Wrap the existing provider tree with `SpawnOnOutToastProvider`:

```tsx
// BEFORE:
<CookDepletionBannerProvider>
  <NavigationContainer>
    {/* ... */}
  </NavigationContainer>
</CookDepletionBannerProvider>

// AFTER:
<CookDepletionBannerProvider>
  <SpawnOnOutToastProvider>
    <NavigationContainer>
      {/* ... */}
    </NavigationContainer>
  </SpawnOnOutToastProvider>
</CookDepletionBannerProvider>
```

Add the import.

**5e. SpawnOnOutToast trigger wiring:**

The toast needs to fire from the two surfaces where `setSupplyStatus(_, 'out')` can spawn a need:

- **`components/pantry/SuppliesSection.tsx`** — `handleCycleComplete(result)` already receives `SupplyStatusResult`. After updating local state, if `result.spawnedNeed` is non-null AND `result.supply.status === 'out'`, call `showToast(result.supply, result.spawnedNeed.id, /*priorStatus*/ ?)`. **Problem:** prior status isn't in the result. Capture it before the setSupplyStatus call. SuppliesSection needs to be aware of the supply's current status BEFORE the cycle/jump-set fires. Easiest path: in SupplyRow, when calling `cycleSupplyStatus` or `setSupplyStatus`, capture `supply.status` first and pass as third arg to `onCycleComplete(result, priorStatus)` — extending the callback signature. Similar change in CP6a's `applyStatus` for long-press jump-set.

- **`screens/CookingScreen.tsx`** (or wherever cookDepletion fires post-cook) — actually, NO. Per the conflict-suppression rule (Part 3), spawn-on-out toast is suppressed when CookDepletionBanner is showing. CookDepletion path doesn't trigger the spawn toast.

**STOP and flag** if extending `onCycleComplete` to include `priorStatus` breaks more than 2 call sites. The cleanest alternative is having the service return priorStatus in `SupplyStatusResult` directly — but that requires modifying suppliesService, which is otherwise frozen.

**Q5 below: priorStatus capture mechanism.**

---

## Constraints

1. **DO NOT** modify the wireframe-defined sheet primitives (Modal + bottom-sheet pattern). Reuse the AddNeedSheet structure for SupplyCreateSheet and EditNeedSheet.
2. **DO NOT** extract a shared `<TagDimensionPicker>` component in this CP (P8R-D14 captures it as future cleanup). Inline the chip pattern in EditNeedSheet for now.
3. **DO NOT** rewrite or delete ManageSuppliesScreen. Just rewire PantryScreen's FAB. ManageSuppliesScreen stays as a browse path; CP6c decides its disposition.
4. **DO NOT** modify suppliesService — except via the service pattern existing functions support. CP6b is consumer-side except for the `needsService.updateNeed` addition (Part 1).
5. **DO NOT** modify the spawn-on-out behavior in `setSupplyStatus`. The service does the right thing already (Q41 + Q48). CP6b just surfaces the result via the toast.
6. **DO NOT** implement bulk-acquire, cart visibility, or progress bar — those are CP6c.
7. **DO NOT** add UnitPicker (P8R-D22) or rewire highlightsService (P8R-D23) — separate work.
8. **DO NOT** rename screens or files. CP6c handles renames.
9. **DO NOT** spawn a need on `createSupply(_, status: 'out')`. Spawn-on-out is on the transition path (`setSupplyStatus`), not the create path. Document this in SupplyCreateSheet's save handler if the user picks "Out" as initial status.
10. **DO NOT** bump versions on living docs. Per Standing Rule A.
11. **TARGET LINE COUNTS** (soft, ~30% tolerance — calibrated against CP5b's actual 1396-line ship):
    - `needsService.ts` Part 1: +50-80 lines (updateNeed function + import)
    - `lib/types/needs.ts` Part 1: +10-15 lines (UpdateNeedParams interface)
    - `components/SupplyCreateSheet.tsx` Part 2: ~600-800 lines
    - `contexts/SpawnOnOutToastContext.tsx` Part 3: ~80-120 lines
    - `components/SpawnOnOutToast.tsx` Part 3: ~150-250 lines
    - `components/EditNeedSheet.tsx` Part 4: ~400-550 lines
    - Wiring (5a-e): ~100-200 lines net across 5 files
    - **Total: ~1390-2015 lines.** Flag if substantially over (e.g., >2400). This is the heaviest CP of the 8R series; running over 2000 is acceptable given the 3 new surfaces.

---

## Verification

1. `npx tsc --noEmit -p tsconfig.json` — confirm zero new errors. Baseline 181 (per CP6a SESSION_LOG).
2. **Part 1 verification:**
    - `grep -n "export async function updateNeed" lib/services/needsService.ts` — confirms function exported.
    - `grep -n "UpdateNeedParams" lib/types/needs.ts` — confirms type exported.
3. **Part 2 verification:**
    - File `components/SupplyCreateSheet.tsx` exists.
    - `grep -n "tier1\|tier2\|tier3" components/SupplyCreateSheet.tsx` — confirms 3-tier structure.
    - `grep -n "createSupply" components/SupplyCreateSheet.tsx` — confirms service call.
4. **Part 3 verification:**
    - File `contexts/SpawnOnOutToastContext.tsx` exists.
    - File `components/SpawnOnOutToast.tsx` exists.
    - `grep -n "useSpawnOnOutToast\|SpawnOnOutToastProvider" --include="*.tsx" -r .` — confirms hook exported + provider wrapped.
5. **Part 4 verification:**
    - File `components/EditNeedSheet.tsx` exists.
    - `grep -n "updateNeed" components/EditNeedSheet.tsx` — confirms service call.
    - `grep -n "Update default routing\|setSupplyTags" components/EditNeedSheet.tsx` — confirms toggle wired.
6. **Part 5 verification:**
    - PantryScreen: `grep -n "navigation.navigate('ManageSupplies'" screens/PantryScreen.tsx` — should return 0 matches (handler rewired).
    - ExpandedRegularsSheet: `grep -n "Coming in CP6\|Add supply.*Alert" components/ExpandedRegularsSheet.tsx` — should return 0 matches (footer rewired).
    - ViewDetailScreen (`screens/GroceryListDetailScreen.tsx`): `grep -n "onLongPress\|EditNeedSheet" screens/GroceryListDetailScreen.tsx` — confirms long-press wiring.
    - App.tsx: `grep -n "SpawnOnOutToastProvider" App.tsx` — confirms provider wrap.
7. **CP6a dedup behavior at CP6b call sites** (smoke-test focus):
    - SupplyCreateSheet's createSupply path does NOT call createNeed; dedup not exercised here.
    - EditNeedSheet's save calls updateNeed (not createNeed); dedup not exercised here.
    - SpawnOnOutToast's Edit action opens EditNeedSheet for the spawned need; the spawned need was created server-side by setSupplyStatus, not via createNeed; dedup not exercised here.
    - **Conclusion:** CP6a's dedup logic is dormant in CP6b's new surfaces. CP6c's bulk-acquire is the first real CP6a-dedup consumer.
8. **Smoke-test plan (deferred to Tom — code-only verification this session):**
    - **Tab 12 supply create from PantryScreen:** Tap "+" on PantryScreen → SupplyCreateSheet opens. Search "saffron" → 🆕 row. Tap → configure form. Pick "Low" status. Save → supply added to pantry as Low. Check Supabase Studio.
    - **Tab 12 supply create from ExpandedRegularsSheet:** Open Tonight view → tap Regulars "Open ▸" → tap "+ Add new supply" footer → SupplyCreateSheet opens. Same flow. Save → supply added + Regulars zone refreshes (the new Low supply appears in ExpandedRegularsSheet's Low section without closing the sheet).
    - **Tab 12 T1 inversion:** Search a supply you already have ("olive oil") → 🏠 row → tap → "already in your pantry" hint with Edit + Cancel. Tap Edit → stub Alert. Tap Cancel → returns to search.
    - **Tab 12 T3 always-visible:** Type "protein" → ✏️ row at top regardless of T1/T2 hits.
    - **Tab 12 Q35 enforcement:** Status segmented control shows In stock / Low / Out only — no Critical option.
    - **Spawn-on-out toast (manual cycle):** PantryScreen → cycle olive oil from in_stock through low/critical to out. After "out" cycle: toast appears bottom: "Olive oil out → added to needs" + Edit + Undo + ×.
    - **Spawn-on-out toast (long-press jump-set):** PantryScreen → long-press olive oil → "Out" → toast appears.
    - **Spawn-on-out toast suppression:** Open RecipeDetailScreen → cook a recipe → cookDepletion banner appears for the cooked items. If any of those depletions transitioned a supply to out: spawn toast does NOT appear (suppressed by CookDepletionBanner). Verify both banners don't stack.
    - **Toast Edit action:** Tap Edit on toast → EditNeedSheet opens for the spawned need. Confirm the need's tags/quantity are pre-populated.
    - **Toast Undo action:** Tap Undo → spawned need deleted + supply reverts to prior status (last status before "out"). Verify in Supabase Studio.
    - **Toast auto-dismiss:** Trigger toast, wait 5 seconds, verify auto-dismiss without action.
    - **Toast manual dismiss:** Trigger toast, tap × → dismisses without action.
    - **Edit-need modal from long-press:** Open Tonight view → long-press a need row → EditNeedSheet opens with pre-populated values. Change quantity. Save → reflects on view detail.
    - **Edit-need "Update default routing" toggle:** Need with supply_id set, edit tags to differ from supply → toggle appears. Toggle ON + save → supply's tags now equal the new need tags. Toggle OFF + save → supply's tags unchanged.
    - **Edit-need "Update default routing" toggle hidden:** Need without supply_id (custom-name need) → toggle never appears. Need where need.tags === supply.tags exactly → toggle hidden.
    - **Edit-need delete:** Tap Delete in modal footer → confirm Alert → need removed from view detail.

---

## Open questions to flag (per Rule D)

- **Q1: ManageSuppliesScreen create path disposition.** PantryScreen no longer navigates there from "+". The screen still has its own "create" path (text input + Add button). Tom's call: leave it alone in CP6b (current spec) OR remove the create path and reduce ManageSuppliesScreen to a browse-only surface. **Default: leave alone for CP6b; CP6c decides.** Flag if the surface looks broken without the rewire.
- **Q2: SpawnOnOutToast mounting location.** The toast component needs to render somewhere visible. CookDepletionBanner is presumably mounted by some screen; SpawnOnOutToast follows suit. **STOP and flag** the actual mounting pattern after reading the codebase. If CookDepletionBanner is App-level, SpawnOnOutToast follows; if it's per-screen, decide which screens mount it.
- **Q3: For-user multi-select in SupplyCreateSheet + EditNeedSheet.** Per P8R-D13, this is deferred to a future CP. CP6b stubs as "Everyone (default)" non-interactive label. Flag if Tom wants the picker now.
- **Q4: ManageSuppliesScreen disposition (related to Q1).** If Tom decides the screen's create path should be removed, that's a CP6c item. Flag in SESSION_LOG either way.
- **Q5: priorStatus capture for spawn toast.** Easiest path: extend `onCycleComplete` callback signature to accept priorStatus. Alternative: modify SupplyStatusResult shape to include priorStatus (but that's a service change CP6b shouldn't do). Pick one; flag the choice.
- **Q6: PK_CODE_SNAPSHOTS staleness.** Per Rule E, edited/new files in PK snapshot tables get HIGH-flagged:
    - `lib/services/needsService.ts` (Part 1)
    - `lib/types/needs.ts` (Part 1)
    - `components/SupplyCreateSheet.tsx` (NEW Part 2)
    - `contexts/SpawnOnOutToastContext.tsx` (NEW Part 3)
    - `components/SpawnOnOutToast.tsx` (NEW Part 3)
    - `components/EditNeedSheet.tsx` (NEW Part 4)
    - `screens/PantryScreen.tsx` (Part 5a)
    - `components/ExpandedRegularsSheet.tsx` (Part 5b)
    - `screens/GroceryListDetailScreen.tsx` (Part 5c)
    - `App.tsx` (Part 5d)
    - `components/pantry/SuppliesSection.tsx` (Part 5e)
    - `components/pantry/SupplyRow.tsx` (Part 5e — onCycleComplete signature change)
    - **DO NOT update `docs/PK_CODE_SNAPSHOTS.md`** per Rule A. Reconciliation lives in CP6c.
- **Q7: 12-file blast radius.** This is the biggest single-CP file count of the 8R series. Flag in SESSION_LOG if any feel under-tested or if the cross-file wiring (5a-e) introduces unexpected coupling.

---

## SESSION_LOG entry format

Per `docs/DOC_MAINTENANCE_PROCESS.md` Section 8. Single entry. Include all standard sections.

Tracker rows per `docs/TRACKER_SPEC.md` for each modified/created file.

---

## Recommended commit message (when smoke test passes)

```
git commit -m "feat(8R): Phase 8R-CP6b — Tab 12 supply create + Tab 9 spawn toast + edit-need modal" -- lib/services/needsService.ts lib/types/needs.ts components/SupplyCreateSheet.tsx contexts/SpawnOnOutToastContext.tsx components/SpawnOnOutToast.tsx components/EditNeedSheet.tsx screens/PantryScreen.tsx screens/GroceryListDetailScreen.tsx components/ExpandedRegularsSheet.tsx components/pantry/SuppliesSection.tsx components/pantry/SupplyRow.tsx App.tsx docs/SESSION_LOG.md
```

(Adjust paths if any wiring touched fewer/more files than expected.)
