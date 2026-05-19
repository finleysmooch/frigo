# CC PROMPT — Phase 8R-CP6d-SupplyDetail

**Phase:** 8R-CP6d-SupplyDetail (new screen + cross-cutting wire-ups + cleanup)
**Estimated cost:** L. ~700-1000 lines net.
**Prerequisite:** CP6d-Schema shipped (storage_location, is_priority, tracking_mode columns + service support). CP6d-Pantry strongly recommended first (so the SupplyRow's "Open detail ›" link has a destination).

---

## Context

Per audit doc (section "CP6d-SupplyDetail" + gap rows P7, P9, P14, Q-NEW-26). This CP delivers the long-missing Tab 8 Supply Detail screen plus several smaller cross-cutting items:

- **NEW SupplyDetailScreen.tsx** — the main blocker from the audit. Currently a stub Alert.
- **T1 inversion wire-up** — SupplyCreateSheet's "this already exists" path should route to SupplyDetail instead of Alert stub.
- **ManageSuppliesScreen deletion** — orphan screen, supplanted by SuppliesSection + SupplyCreateSheet + SupplyDetail.
- **RecipeListScreen `initialIngredient` param** — small route-param add that enables the "Find recipes with X" CTA on SupplyDetail.

This CP closes out the CP6d series.

---

## Inputs to read

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — section "CP6d-SupplyDetail" + gap rows + decision Q-NEW-26.
2. `screens/PantryScreen.tsx` — current `handleSupplyNameTap` is a stub Alert; needs to route to SupplyDetail.
3. `components/pantry/SupplyRow.tsx` — has the "Open detail ›" link from CP6d-Pantry expecting a SupplyDetail route.
4. `components/SupplyCreateSheet.tsx` — T1 path currently shows "already in pantry, edit instead?" Alert stub. Needs routing.
5. `screens/ManageSuppliesScreen.tsx` — to be deleted.
6. `screens/RecipeListScreen.tsx` — adding one route param.
7. `App.tsx` — for route registration changes.
8. `lib/services/suppliesService.ts` — exists for read/write.
9. `lib/services/tagsService.ts` — for stores + brands tag dimensions (or whatever existing pattern stores brand info).
10. `components/AddNeedSheet.tsx`, `components/EditNeedSheet.tsx`, `components/ViewCreatorModal.tsx` — read for the inline tag-picker pattern (TAG_DIMENSIONS array, getOrCreateTag flow, chip rendering). SupplyDetail will inline the same pattern.

---

## Tasks

### Task 1 — NEW screen: SupplyDetailScreen.tsx

Location: `screens/SupplyDetailScreen.tsx`.
Estimated: ~600-800 lines.

Route param: `{ supplyId: string }`. Add to `PantryStackParamList` in App.tsx.

Layout (top to bottom):

```
[ ← Back     {Supply Name}            ⋯ ]   ← header with overflow menu

[ Hero state cycle — 4-segment strip ]
  ┌──────────┬──────────┬──────────┬──────────┐
  │ in_stock │   low    │ critical │   out    │
  └──────────┴──────────┴──────────┴──────────┘
     (current state highlighted, tap any to jump-set)

[ Inline 5-circle visual using usage_level — large display ]
  Shows current usage_level (0-5) with the matching SVG icon

[ Two CTAs ]
  [ + Add to needs ]   [ Restock ]
  
  + Add to needs: opens AddNeedSheet pre-populated with this supply selected (T1 hit)
  Restock: setSupplyStatus to 'in_stock' (snaps usage_level to 5)

[ Star toggle — is_priority ]
  ★ Priority    [Toggle: On/Off]
  Hint text: "Spawns a need automatically when this drops to low."

[ Tracking mode toggle ]
  ○ Restock automatically when out
  ● Just track in pantry (no auto-restock)
  Hint text: "Defaulted from {ingredient name}'s shelf life."

[ Storage location ]
  [Fridge] [Freezer] [Pantry] [Counter]    ← segmented picker
  Hint text: "Affects when staleness reminders fire."

[ Stores section ]
  Shopping at:
    [Costco ✗] [Whole Foods ✗] [Trader Joe's ✗] [+ Add store]
    (multi-select chips; tap to toggle on/off; "+ Add" opens inline input)

[ Brands section ]
  Brands you like:
    Kerrygold, Kirkland, Plugra
    (free-form list — comma-separated TextInput, simplest pattern)

[ For-user (stub for F&F) ]
  For: Everyone (default)
  Hint text: "Per-user supplies coming soon."
  (DO NOT wire to a sub-sheet for F&F per P8R-D13)

[ Find recipes CTA ]
  [🍳 Find recipes with {name} →]
  Tapping navigates to RecipeListScreen with initialIngredient={name}

[ Activity log — simplest version ]
  Last cycled: 3 days ago
  Last acquired: 2 weeks ago
  Created: 6 weeks ago
  (just timestamps from the supply row's last_confirmed_at, created_at, etc.)

[ Bottom — destructive actions area ]
  Archive supply
  Delete supply (red, destructive)
```

Implementation notes:

**State management:**
- Fetch supply via `getSupplyById(supplyId)` on mount
- Hydrate all form fields from supply
- Per-field updates fire individual service calls (no central save button) — state cycle, priority, tracking_mode, storage_location, stores, brands, for-user all update on toggle/select
- This pattern matches PantryItem-Picker era — direct manipulation, no modal save flow
- Optimistic updates with revert on error

**State cycle interaction (Q30):**
- 4-segment strip is tap-to-set, NOT tap-to-cycle
- Tapping any segment calls `setSupplyStatus(supplyId, status)` directly
- Visual feedback: tapped segment highlights immediately, others dim
- The 5-circle visual below updates to match (driven by `usage_level` from updated supply)
- Distinct from list-row tap-to-cycle (Q30): on the list, tap advances; here, tap jumps

**Stores section:**
- Reuse the existing `tags` system. Stores are tag dimension `'store'`.
- Tag chips render selected (filled) when `supply.tags.some(t => t.dimension === 'store' && t.value === chip.value)`.
- Tap to toggle: get-or-create tag → call `setSupplyTags` (or specific add/remove tag helper if it exists in tagsService — verify).
- "+ Add" opens inline TextInput → `getOrCreateTag` → adds to selected.
- Same pattern as AddNeedSheet's tag-picker. Inline (no shared component yet — P8R-D14 captures the future refactor).

**Brands section:**
- Brands are stored where? VERIFY — likely as part of supply row directly (free-text array), or as a separate `brands` table with FK, or as tag dimension `'brand'`.
- Q22 made brands first-class — find what schema CP6b-CP6c shipped.
- Implementation: simplest pattern is a comma-separated TextInput that splits on save into an array, persisted on supply row. If it's a tag dimension, use the same tag-chip pattern as stores.

**Tracking mode toggle:**
- Two-option radio (or a Switch with two labels).
- On change: `await suppliesService.setSupplyTrackingMode(supplyId, mode)` — add helper if not present (~10 lines: simple update).
- DO NOT change other fields when toggling. User's explicit override sticks.

**Storage location segmented picker:**
- 4-segment selector.
- On change: `await suppliesService.setSupplyStorage(supplyId, location)` — add helper if not present.
- Per Tom's call (Q-NEW-25): storage transitions only affect staleness threshold downstream, NOT tracking_mode. So this update is independent.

**Find recipes CTA:**
- Routes to `RecipeListScreen` with `initialIngredient: <name>` param.
- See Task 4 — that param needs adding to RecipeList first.

**Overflow menu (⋯):**
- ActionSheet or custom menu: Archive / Delete.
- Archive: `await suppliesService.archiveSupply(supplyId)` — set archived_at = NOW(). Navigate back. Item disappears from Pantry.
- Delete: confirm dialog → hard delete. Cascades via foreign keys.

**Activity log timestamps:**
- Simplest version: read supply.last_confirmed_at, supply.created_at, and any `acquired_at`-type fields if exist on linked needs.
- Display as relative ("3 days ago") using `formatRelativeTime` helper if it exists, else inline.

### Task 2 — Wire SupplyRow / PantryScreen to SupplyDetail

Update `screens/PantryScreen.tsx`:
- `handleSupplyNameTap`: replace Alert stub with `navigation.navigate('SupplyDetail', { supplyId: supply.id })`.

Update `components/pantry/SupplyRow.tsx`:
- "Open detail ›" link in expanded row: route to SupplyDetail.

Both consumers should now have working detail screen access.

### Task 3 — T1 inversion in SupplyCreateSheet (Gap-P9)

In SupplyCreateSheet, find the T1 path (the "🏠 already in your pantry" handler). Currently shows Alert stub.

Replace with:
```ts
Alert.alert(
  '{name} is already tracked',
  'Edit it in detail view?',
  [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Edit',
      onPress: () => {
        onClose();
        navigation.navigate('SupplyDetail', { supplyId: existingSupply.id });
      },
    },
  ]
);
```

Or skip the Alert entirely and just navigate — Tom's preference TBD; the Alert pattern matches existing UX patterns elsewhere, so default to keeping it.

The SupplyCreateSheet's `navigation` prop may not exist (it's a modal, not a screen). Either:
- Pass `navigation` as a prop from each consumer (PantryScreen, ExpandedRegularsSheet)
- OR use `useNavigation` hook from @react-navigation/native inside the sheet

Use the hook approach — cleaner, no new prop plumbing.

### Task 4 — RecipeListScreen `initialIngredient` route param (Gap-Q-NEW-26)

Add `initialIngredient?: string` to `RecipesStackParamList.RecipeList`.

In RecipeListScreen's existing `useEffect` that handles route params (find the block that processes `initialCuisine`, `initialCookingConcept`, etc.):

```ts
const { initialIngredient, ... } = params;

// ... existing logic ...

if (initialIngredient) {
  setAdvancedFilters(prev => ({
    ...prev,
    heroIngredients: [...(prev.heroIngredients ?? []), initialIngredient],
  }));
}

// In the param-clearing setParams call, add:
navigation.setParams({
  initialIngredient: undefined,
  // ... existing fields ...
} as any);
```

That's the entire change. ~10 lines.

Caveat noted in audit: this filters by `hero_ingredients` (featured ingredients only), not all recipe ingredients. For F&F that's adequate; future filter-screen redesign can address.

### Task 5 — ManageSuppliesScreen deletion (Gap-P14)

Delete files:
- `screens/ManageSuppliesScreen.tsx`

Update `App.tsx`:
- Remove `ManageSupplies` route from PantryStackParamList
- Remove `<Stack.Screen name="ManageSupplies" ... />` registration
- Remove `import ManageSuppliesScreen` line

Verify no remaining navigation calls target this route. Search for `'ManageSupplies'` (string literal) and `navigate('ManageSupplies'` across the codebase. None should remain after CP6d-Pantry — this is a confirmation step.

If any consumer still navigates here: that's a bug from CP6d-Pantry that needs fixing as part of this CP.

---

## Constraints

- **DO NOT** add new schema columns. CP6d-Schema is authoritative.
- **DO NOT** change spawn-on-out logic, tracking_mode gating, or createNeed dedup. Those are CP6d-Schema.
- **DO NOT** modify SuppliesSection's interaction logic (Pantry CP territory).
- **DO NOT** modify ViewDetailScreen, AddNeedSheet, EditNeedSheet — those are other CPs.
- **DO NOT** wire the for-user picker beyond the stub. P8R-D13 explicitly defers this.
- **DO** preserve cookDepletionService integration. Cooking flow still works the same way.
- **DO** preserve SpawnOnOutToast. When cycling supply to out from this screen, toast should fire (via the existing setSupplyStatus path).
- **PRESERVE** all existing exports from suppliesService and tagsService. Add new helpers, don't break old ones.

---

## Verification

1. **Navigate to SupplyDetail.** From Pantry, tap a supply name → SupplyDetailScreen opens with that supply's data hydrated.
2. **From SupplyRow expand row, tap "Open detail ›"** → same screen opens.
3. **State cycle strip — tap-to-set.** Tap "low" segment → supply transitions to low. Visual updates (5-circle icon shows 2/5 yellow). If supply is is_priority=true, a need spawns with urgency=today (verify in Supabase).
4. **Restock CTA.** Tap → supply transitions to in_stock, usage_level=5, full visual. If track_only and was archived: archived_at clears.
5. **Priority toggle.** Toggle ON → next time supply hits low, need auto-spawns. Verify by manually setting status to low after toggling.
6. **Tracking mode toggle.** Toggle from restock → track_only → next time supply hits out, supply auto-archives (archived_at set, no need spawned).
7. **Storage location change.** Change from fridge → pantry → supply.storage_location updated. Tracking_mode does NOT auto-flip (per Q-NEW-25).
8. **Stores section.** Tap Costco chip → tag added to supply. Tap again → removed. "+ Add" → create new store tag.
9. **Brands section.** Type "Kerrygold, Kirkland" → save → both persisted.
10. **Find recipes CTA.** Tap → navigates to RecipeListScreen with the supply's name pre-filtering hero_ingredients. Recipes featuring that ingredient should render.
11. **Archive.** Overflow menu → Archive → returns to Pantry. Supply no longer visible in any pantry section.
12. **Delete.** Overflow menu → Delete → confirm → returns to Pantry. Supply gone from DB (verify via Supabase).
13. **T1 inversion.** Open SupplyCreateSheet, search "olive oil" (assuming you have it) → 🏠 hint → tap Edit → navigates to SupplyDetail for that supply.
14. **ManageSupplies deleted.** Search codebase for `'ManageSupplies'` literal → no hits. Open the app, navigate Pantry → no broken links.
15. **RecipeList initialIngredient.** Manually navigate with `{ initialIngredient: 'mushrooms' }` route param → RecipeList opens with hero filter pre-applied.

---

## SESSION_LOG entry format

(Standard template. Files created: SupplyDetailScreen.tsx. Files deleted: ManageSuppliesScreen.tsx. Files modified: PantryScreen, SupplyRow, SupplyCreateSheet, RecipeListScreen, App.tsx. Plus suppliesService for any new helpers.)

After this CP ships, all CP6d sub-checkpoints are complete. Trigger full-surface smoke test as the next move (Tom's call). After smoke passes, update PHASE_8R, FF_LAUNCH_MASTER_PLAN, DEFERRED_WORK to reflect CP6d completion.
