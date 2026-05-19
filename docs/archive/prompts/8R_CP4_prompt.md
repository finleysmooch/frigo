# 8R-CP4 — Supplies UX Rewrite + Pantry Service Deletion

**Phase:** 8R — Unified Household Needs  
**Checkpoint:** CP4  
**Type:** Screen rewrites + component rewrites + service/type deletions  
**Estimated:** 1 session (largest CP so far — ~6-8 files touched)

---

## Context

CP1-CP3 shipped: schema migrated, 4 new services live, cook-flow rewired, regulars deleted. CP4 rewrites the pantry/supplies-facing screens against the new model and deletes the last old-model service + type files.

**What's changing conceptually:**

1. **PantryScreen transforms.** Was: pantry items (quantity-tracked, expiration dates) + staples grid (8-cell max). Becomes: supplies list (status-tracked only). The entire pantry-items concept (quantity, expiration, storage location, batch management) is gone — supplies are status-only per Q15. The screen shows all supplies grouped by status attention.

2. **StaplesGrid + StapleCell → SuppliesSection + SupplyRow.** Same tap-to-cycle-status UX, but backed by `suppliesService` instead of `pantryStaplesService`. Status states change from `unknown/good/running_low/out` to `in_stock/low/critical/out` (Q7). List view instead of 2-column grid per wireframe Tab 7 Variant A.

3. **ManageStaplesScreen → ManageSuppliesScreen.** Same search + add + edit + delete flow, but backed by `suppliesService` + `tagsService`. State cycling added to each row (resolves P8-22 deferred item). Custom-name add uses `suppliesService.createSupply` with `customName` instead of `addStapleByCustomName`.

4. **RecipeDetailScreen ingredient availability.** Was: `getPantryItems(userId)` → match by ingredient_id. Becomes: `suppliesService.getSuppliesForSpace(spaceId)` → match by ingredient_id, considering supply status (out = "missing", in_stock/low/critical = "have it").

5. **pantryService.ts + types/pantry.ts deleted.** Last old-model files. The `utils/pantryConversions.ts` file referenced by pantryService is now orphaned — delete it too if no other file imports from it (check first).

6. **Storage groupings intentionally gone.** The old PantryScreen had fridge/freezer/pantry/counter sections. The 8R supplies model has no storage-location field — supplies are flat, grouped by status only. Users who want storage grouping can use the `storage` tag dimension post-F&F. This is intentional per Q15 (status-only tracking). **Smoke-test expectation for Tom:** day-1 post-CP4, the Pantry tab shows a flat supplies list with attention/in-stock sections. No fridge/freezer/pantry/counter grouping. This is correct behavior, not a bug.

**Decision references:**
- Q7: supply status enum + cycle (in_stock → low → critical → out → in_stock)
- Q14: identity = ingredient_id XOR custom_name
- Q15: status-only tracking, no quantity
- Q26: supplies grid — list view per Tab 7 Variant A
- Q30: list = tap-to-cycle; detail = tap-to-set (detail screen is CP5)
- Q35: initial status restricted to in_stock/low/out (critical only via cycling)
- P8-22: RESOLVED by this CP (status cycling on manage screen)

**Wireframe reference:** `docs/wireframes/phase_8r/phase_8r_wireframes_v3.html` — Tabs 7, 8, 12.

---

## Inputs to read

1. `screens/PantryScreen.tsx` — **current** file to rewrite. Study imports, state, data loading, section rendering, view toggle, StaplesGrid integration, refresh pattern.
2. `components/pantry/StaplesGrid.tsx` — **current** file to rewrite. Study props interface, load pattern, cell rendering, overflow handling, optimistic updates, re-sort logic.
3. `components/pantry/StapleCell.tsx` — **current** file to rewrite. Study split-tap zones, state visuals, cycle handling.
4. `screens/ManageStaplesScreen.tsx` — **current** file to rewrite. Study search, ingredient add, custom-name add, edit, delete, staple row rendering.
5. `screens/RecipeDetailScreen.tsx` — **modify** ingredient-availability section only. Study `loadPantryItems`, `pantryItems` state, `missingIngredients` computation, `listModalMode` logic.
6. `lib/pantryService.ts` — to be deleted. Read its export list first.
7. `lib/types/pantry.ts` — to be deleted. Read its export list first.
8. `utils/pantryConversions.ts` — check if any file other than pantryService imports from it. If orphaned, delete.
9. `lib/services/suppliesService.ts` — the replacement service. Key functions: `getSuppliesForSpace`, `createSupply`, `updateSupply`, `deleteSupply`, `cycleSupplyStatus`, `setSupplyStatus`, `getSupplyById`, `getSupplyDisplayName`, `getSuppliesByStatus`.
10. `lib/services/tagsService.ts` — `getOrCreateTag`, `getSupplyTags`, `setSupplyTags` for store-tag management on supplies.
11. `lib/types/supplies.ts` — `Supply`, `SupplyStatus`, `SupplyWithTags`, `SupplyIngredient`, `CreateSupplyParams`, `UpdateSupplyParams`, `SupplyStatusResult`.
12. `lib/types/tags.ts` — `Tag`, `TagDimension`.
13. `lib/services/needsService.ts` — `getNeedDisplayName` (reference pattern for display name helper).
14. `App.tsx` — navigation setup. `PantryStackParamList` has `Pantry`, `SpaceSettings`, `ManageStaples`. Confirm ManageStaples route stays (screen renamed but route name can stay or change).
15. `screens/GroceryListDetailScreen.tsx` — has stale `RegularItems: undefined` in ParamList type. Remove that line.
16. `docs/wireframes/phase_8r/phase_8r_wireframes_v3.html` — open Tab 7 (Supplies grid), Tab 8 (Supply detail), Tab 12 (Supply create) for UX reference.
17. `docs/CLAUDE.md` — session logging rules.

---

## Task

### Part 1 — Delete old files

**Before deleting**, record the export list from each file in SESSION_LOG.

Delete:
1. `lib/pantryService.ts`
2. `lib/types/pantry.ts`
3. `utils/pantryConversions.ts` — **only if** no file other than `pantryService.ts` imports from it. Run: `grep -rn "pantryConversions" lib/ screens/ components/ utils/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v pantryService`. If 0 matches, delete. If matches found, note in SESSION_LOG and leave it.

### Part 1.5 — Collateral consumers of deleted types/service

The `types/pantry.ts` and `pantryService.ts` deletions break 3 additional files. Handle each:

1. **`lib/services/ingredientSuggestionService.ts`** — imports `StorageLocation` from `types/pantry`. Fix: inline the type at the top of the file:
   ```typescript
   type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'counter';
   ```
   Remove the `types/pantry` import. Do not modify any other logic in this file.

2. **`components/PantryItemRow.tsx`** — imports `PantryItemWithIngredient` from `types/pantry`. This component was used by the old PantryScreen pantry-items list. With PantryScreen rewritten, PantryItemRow is orphaned. **Delete it.** Before deleting, run: `grep -rn "PantryItemRow" screens/ components/ --include="*.tsx" | grep -v node_modules`. If 0 matches (confirming no consumers), delete. If matches found, note in SESSION_LOG.

3. **`screens/GroceryListDetailScreen.tsx`** — imports `addPantryItem` from `pantryService` for a "Move to pantry" bulk action. This screen is being fully rewritten in CP5, but CP4's pantryService deletion creates a runtime break in the meantime. **Stub it:** replace the pantryService import with a local stub at the top of the file:
   ```typescript
   // Stub: pantryService deleted in 8R-CP4. Full rewrite in CP5.
   const addPantryItem = async (..._args: any[]) => {
     throw new Error('Move to pantry deprecated in 8R. CP5 rewrite pending.');
   };
   ```
   Remove the pantryService import line. Do NOT rewrite the rest of GroceryListDetailScreen — that's CP5.

### Part 2 — Rewrite `components/pantry/StapleCell.tsx` → `components/pantry/SupplyRow.tsx`

Rename file. New component backed by `suppliesService`.

**Props:**
```typescript
interface SupplyRowProps {
  supply: SupplyWithTags;
  onNameTap: () => void;          // Parent decides (detail screen or alert stub)
  onCycleComplete: (result: SupplyStatusResult) => void;
  onCycleError?: (error: unknown) => void;
}
```

**Behavior:**
- Single row layout (not a grid cell): status dot on left, display name, status label on right.
- **Status dot colors** (adapt from old StapleCell's `stateVisuals`):
  - `in_stock` → success green (was `good`)
  - `low` → warning amber (was `running_low`)
  - `critical` → warning-dark or error-light (NEW state — pick a visual between amber and red)
  - `out` → error red (same as before)
- **Tap dot** → calls `suppliesService.cycleSupplyStatus(supply.id)`, returns `SupplyStatusResult` to parent via `onCycleComplete`. Parent handles optimistic update + re-sort + spawn toast display.
- **Tap name/row** → calls `onNameTap()`.
- Display name via `suppliesService.getSupplyDisplayName(supply)`.
- Accessibility: same pattern as old StapleCell (dot = button with state label, name = button for details).
- Keep `cycling` local state for disabled-during-request pattern.

### Part 3 — Rewrite `components/pantry/StaplesGrid.tsx` → `components/pantry/SuppliesSection.tsx`

Rename file. Changes from a 2-column grid to a list-based layout per Tab 7 Variant A.

**Props:**
```typescript
interface SuppliesSectionProps {
  spaceId: string | null;
  refreshTrigger?: number;
  onSupplyNameTap: (supply: SupplyWithTags) => void;
  onAddNewTap: () => void;
}
```

**Layout (per Tab 7 wireframe):**
1. **Attention section** (out + critical + low supplies combined):
   - Sub-section label: "Attention" or "Needs attention" with count.
   - All supplies with status `out`, `critical`, or `low`, rendered as `SupplyRow` components.
   - Sorted: out first, then critical, then low. Alphabetical within each status.
   - If empty, this section is hidden.

2. **In-stock section:**
   - Section label: "In stock" with count.
   - Shows first ~6 in-stock supplies.
   - If more than 6: shows "+ N more" expandable. Tap expands to show all in-stock inline.
   - Sorted alphabetically by display name.

3. **Footer:** "+ Add new supply" tap target → `onAddNewTap()`.

4. **Empty state:** If zero supplies total, show instructional card: "Track your household supplies" with "Add first supply" button → `onAddNewTap()`.

**Data loading:**
- On mount + spaceId change + refreshTrigger change: call `suppliesService.getSuppliesForSpace(spaceId)`.
- Store in local state.
- Optimistic update on cycle: replace the supply in local array with the returned `SupplyStatusResult.supply`, re-sort.
- If `SupplyStatusResult.spawnedNeed` is non-null, log it: `console.log('📦 Spawned need for:', displayName)`. Do NOT use `Alert.alert` — modal alerts block rapid cycling during F&F testing. Full spawn toast UX (Tab 9 wireframe) deferred to CP5 or CP6. Add a `// TODO: 8R-CP5/CP6 — replace with Tab 9 spawn toast` comment at the log site.

**Sort order (application-level, same pattern as suppliesService):**
```
1. out         (most urgent)
2. critical
3. low
4. in_stock
Within each status group: alphabetical by display name.
```

### Part 4 — Rewrite `screens/PantryScreen.tsx`

The screen simplifies dramatically. The entire pantry-items section (expiration, storage groups, family groups, quantity pickers, storage pickers) goes away. The screen becomes a supplies-list shell.

**Structure:**
```
PantryScreen
  ├── Header (space name, space switcher — keep existing pattern)
  ├── SuppliesSection (the rewritten component from Part 3)
  └── Pull-to-refresh (triggers SuppliesSection reload via refreshTrigger)
```

**Remove entirely:**
- All `pantryService` imports and calls (`getPantryItems`, `getPantryItemsBySpace`, `getExpiringItems`, etc.)
- All `types/pantry` imports (`PantryItem`, `PantryItemWithIngredient`, `StorageLocation`, etc.)
- All pantry-items state (`items`, `selectedItem`, `showQuantityPicker`, `showStoragePicker`, `showExpirationPicker`, etc.)
- All pantry-items handlers (`handleTapQuantity`, `handleTapStorage`, `handleTapExpiration`, `handleTapRecipes`, `handleTapItem`)
- The `loadPantryData` function
- The view toggle (Family / Storage / Type views)
- The expiring-items banner
- All section rendering for pantry items (storage sections, family sections)
- All pantry-items grouping helpers (`getExpiringItems`, `groupItemsByFamilyAndType`, `convertToFamilySections`, `groupItemsByStorageAndFamily`)

**Keep:**
- Space context integration (`useActiveSpaceId`)
- Header with space name display
- Navigation setup (PantryStackParamList, SpaceSettings route)
- Pull-to-refresh pattern (now triggers SuppliesSection refresh)
- `onSupplyNameTap` handler — for now, stubs with `Alert.alert('Supply detail coming soon')`. Supply detail screen is CP5.
- `onAddNewTap` → `navigation.navigate('ManageSupplies')` (or 'ManageStaples' if keeping the route name — see Part 5 note).
- Space invitations display if it exists.

### Part 5 — Rewrite `screens/ManageStaplesScreen.tsx` → `screens/ManageSuppliesScreen.tsx`

Rename file. Same concept (search ingredients, add supply, manage list), backed by new services.

**Key changes from old ManageStaplesScreen:**

1. **Imports:** `pantryStaplesService` → `suppliesService` + `tagsService`. `types/pantry` → `types/supplies`.

2. **Search:** Old: `searchIngredientsForStapleAdd(spaceId, query)`. New: use the `search_ingredients` RPC (shipped pre-8R, uses pg_trgm trigram similarity + ranking — better search quality than raw ILIKE). Call: `supabase.rpc('search_ingredients', { search_query: query, result_limit: 20 })`. Verify this RPC still exists (it queries the `ingredients` table which survived CP1 — should be fine). If the RPC is missing, fall back to `.from('ingredients').select('id, name').ilike('name', '%query%').limit(20)` and note in SESSION_LOG.
   - For each result, check if a supply with that `ingredient_id` already exists in the space (cross-reference the loaded supplies list in local state). Mark as `already_supply: true` if so.
   - This is a screen-level concern (one query + in-memory filter), not a service method. Keep it local to the screen.

3. **Add by ingredient:** Old: `addStapleByIngredient(spaceId, ingredientId, userId)`. New: `suppliesService.createSupply({ spaceId, ingredientId, status: 'in_stock', addedBy: userId })`. Default initial status = `in_stock` for search-based adds (user is confirming they have this item).

4. **Add by custom name:** Old: `addStapleByCustomName(spaceId, name, userId)`. New: `suppliesService.createSupply({ spaceId, customName: name, status: 'in_stock', addedBy: userId })`.

5. **Delete:** Old: `deleteStaple(id)`. New: `suppliesService.deleteSupply(id)`.

6. **Status cycling on each row (resolves P8-22):** Each supply row shows a status dot + display name. Tapping the dot calls `suppliesService.cycleSupplyStatus(supply.id)`. Use `SupplyRow` component from Part 2. This resolves the deferred P8-22 item.

7. **Edit custom name:** Old: `updateStapleCustomName(id, name)`. New: `suppliesService.updateSupply(id, { customName: name })`.

8. **Display name:** Old: `getStapleDisplayName(staple)`. New: `suppliesService.getSupplyDisplayName(supply)`.

9. **State dot color mapping:** Same as SupplyRow (in_stock=green, low=amber, critical=amber-dark, out=red).

**Navigation:** The route name in App.tsx is currently `ManageStaples`. Two options:
- **Option A:** Rename to `ManageSupplies` in App.tsx + PantryStackParamList. Cleaner but touches App.tsx.
- **Option B:** Keep route name `ManageStaples`, just change the component. Less churn.
- **Recommendation: Option A.** It's one line in App.tsx's ParamList + one line in the Screen registration + one line in PantryScreen's navigate call. Clean naming matters for maintainability.

### Part 6 — Rewrite RecipeDetailScreen ingredient availability

**Current pattern:**
```typescript
const loadPantryItems = async () => {
  const items = await getPantryItems(userId);
  setPantryItems(items);
};

// Later: filter missing ingredients
const missing = ingredients.filter(ingredient => {
  const inPantry = pantryItems.some(item => item.ingredient_id === ingredient.id);
  return !inPantry;
});
```

**New pattern:**
```typescript
const loadSupplies = async () => {
  if (!activeSpaceId) return;
  const supplies = await getSuppliesForSpace(activeSpaceId);
  setSupplies(supplies);
};

// Later: filter missing ingredients — "missing" means no supply OR supply is 'out'
const missing = ingredients.filter(ingredient => {
  if (!ingredient.id) return true;  // no ingredient_id = can't match
  const supply = supplies.find(s => s.ingredient_id === ingredient.id);
  return !supply || supply.status === 'out';
});
```

**Changes to RecipeDetailScreen:**
- Remove `import { getPantryItems } from '../lib/pantryService'`
- Remove `import { PantryItemWithIngredient } from '../lib/types/pantry'`
- Add `import { getSuppliesForSpace } from '../lib/services/suppliesService'`
- Add `import { SupplyWithTags } from '../lib/types/supplies'`
- Rename `pantryItems` state → `supplies` state (type: `SupplyWithTags[]`)
- Rewrite `loadPantryItems` → `loadSupplies` (space-scoped, not user-scoped)
- Update `missingIngredients` filter logic per above
- Keep `currentUserId` state (still needed for other features on this screen: cook-soon, log cook, etc.)
- **Do NOT touch** the `AddRecipeToNeedsModal` integration (CP3 already handled that)
- **Do NOT touch** the cook depletion integration (CP3 already handled that)

### Part 7 — Nav + ParamList cleanup

1. **App.tsx:** Rename `ManageStaples` route to `ManageSupplies` in `PantryStackParamList` and the `Screen` registration. Update the import from `ManageStaplesScreen` to `ManageSuppliesScreen`.

2. **GroceryListDetailScreen.tsx:** Remove the stale `RegularItems: undefined` from its local ParamList type definition (around line 61 per CP3 SESSION_LOG). **Do NOT rewrite** the rest of the file — that's CP5.

---

## Constraints

1. **Do NOT modify** `lib/services/suppliesService.ts`, `needsService.ts`, `tagsService.ts`, `viewsService.ts`. Services are stable.
2. **Do NOT modify** `lib/types/supplies.ts`, `needs.ts`, `tags.ts`, `views.ts`.
3. **Do NOT rewrite** `GroceryListsScreen.tsx`, `GroceryListDetailScreen.tsx` (beyond the ParamList cleanup), `AddGroceryItemModal.tsx`, `QuickAddSection.tsx`. Those are CP5.
4. **Do NOT create** SupplyDetailScreen or SupplyCreateSheet. Those are CP5. Supply name tap stubs with `Alert.alert` for now.
5. **Do NOT modify** `cookDepletionService.ts` or any depletion-related files (CP3 already handled those).
6. **Verification is grep-based** (not tsc), per the tsc-blindness finding.
7. **Keep file names clean:** renamed files get new names (SupplyRow.tsx, SuppliesSection.tsx, ManageSuppliesScreen.tsx). Delete the old-name files explicitly.

---

## Verification steps

1. **Old files deleted.** Run:
   ```
   ls lib/pantryService.ts lib/types/pantry.ts 2>&1
   ```
   Expected: "No such file or directory" for both. Also check `utils/pantryConversions.ts` if it was deleted.

2. **Old component files deleted.** Run:
   ```
   ls components/pantry/StaplesGrid.tsx components/pantry/StapleCell.tsx screens/ManageStaplesScreen.tsx 2>&1
   ```
   Expected: "No such file or directory" for all 3.

3. **New component files exist.** Run:
   ```
   ls components/pantry/SupplyRow.tsx components/pantry/SuppliesSection.tsx screens/ManageSuppliesScreen.tsx
   ```
   Expected: all 3 exist.

4. **Zero references to deleted services/types in modified files.** Run:
   ```
   grep -rn "pantryService\|pantryStaplesService\|types/pantry\|StapleState\|PantryStaple\|PantryItem" screens/PantryScreen.tsx screens/ManageSuppliesScreen.tsx screens/RecipeDetailScreen.tsx components/pantry/SupplyRow.tsx components/pantry/SuppliesSection.tsx
   ```
   Expected: 0 matches (or only comments referencing old names for context).

5. **New imports present.** Run:
   ```
   grep "suppliesService\|types/supplies" screens/PantryScreen.tsx components/pantry/SuppliesSection.tsx components/pantry/SupplyRow.tsx screens/ManageSuppliesScreen.tsx screens/RecipeDetailScreen.tsx
   ```
   Expected: at least one match per file.

6. **App.tsx nav updated.** Run:
   ```
   grep "ManageStaples\|ManageSupplies" App.tsx
   ```
   Expected: only `ManageSupplies` references.

7. **GroceryListDetailScreen ParamList cleaned.** Run:
   ```
   grep "RegularItems" screens/GroceryListDetailScreen.tsx
   ```
   Expected: 0 matches.

8. **RecipeDetailScreen pantryService references eliminated.** Run:
   ```
   grep "pantryService\|getPantryItems\|PantryItemWithIngredient\|types/pantry" screens/RecipeDetailScreen.tsx
   ```
   Expected: 0 matches.

9. **RecipeDetailScreen still has AddRecipeToNeedsModal + depletion integrations.** Run:
   ```
   grep "AddRecipeToNeedsModal\|runPostCookDepletion" screens/RecipeDetailScreen.tsx
   ```
   Expected: both present (CP3 work preserved).

10. **No orphaned pantryService/pantryStaplesService references anywhere.** Run:
    ```
    grep -rn "pantryService\|pantryStaplesService" lib/ screens/ components/ contexts/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v SESSION_LOG | grep -v CLAUDE.md
    ```
    Note any remaining references. If found only in files being rewritten in CP5 (GroceryListDetailScreen, etc.), that's expected. If found in CP4-scoped files, that's a bug.

11. **File line counts.** Report `wc -l` for all new/modified files.

12. **Import-break audit.** Run:
    ```
    grep -rn "StaplesGrid\|StapleCell\|ManageStaplesScreen\|pantryService\|types/pantry" screens/ components/ lib/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v SESSION_LOG | grep -v CLAUDE.md
    ```
    List any remaining references. Classify as: (a) CP5 scope, (b) dead code to clean up, (c) bugs.

13. **Part 1.5 collateral — PantryItemRow deleted.** Run:
    ```
    ls components/PantryItemRow.tsx 2>&1
    ```
    Expected: "No such file or directory."

14. **Part 1.5 collateral — ingredientSuggestionService fixed.** Run:
    ```
    grep "types/pantry" lib/services/ingredientSuggestionService.ts
    ```
    Expected: 0 matches. Then:
    ```
    grep "StorageLocation" lib/services/ingredientSuggestionService.ts
    ```
    Expected: inline type definition present.

15. **Part 1.5 collateral — GroceryListDetailScreen pantryService stub.** Run:
    ```
    grep "pantryService" screens/GroceryListDetailScreen.tsx
    ```
    Expected: 0 import matches (only the stub comment if any).

---

## SESSION_LOG entry format

```
## 2026-MM-DD — 8R-CP4 — Supplies UX Rewrite + Pantry Service Deletion

**Phase:** 8R-CP4
**Status:** ✅ Complete | ⚠️ Partial | ❌ Blocked

**Files created (renamed):**
- components/pantry/SupplyRow.tsx (N lines, was StapleCell.tsx N lines)
- components/pantry/SuppliesSection.tsx (N lines, was StaplesGrid.tsx N lines)
- screens/ManageSuppliesScreen.tsx (N lines, was ManageStaplesScreen.tsx N lines)

**Files rewritten:**
- screens/PantryScreen.tsx (was N lines → now N lines)
- screens/RecipeDetailScreen.tsx (ingredient-availability section only)

**Files deleted:**
- lib/pantryService.ts (was N lines, N exports)
- lib/types/pantry.ts (was N lines, N exports)
- utils/pantryConversions.ts (N lines — if deleted; "kept: reason" if not)
- components/PantryItemRow.tsx (N lines — if deleted; "kept: reason" if not)
- components/pantry/StaplesGrid.tsx (replaced by SuppliesSection.tsx)
- components/pantry/StapleCell.tsx (replaced by SupplyRow.tsx)
- screens/ManageStaplesScreen.tsx (replaced by ManageSuppliesScreen.tsx)

**Files updated:**
- App.tsx (ManageStaples → ManageSupplies route rename)
- screens/GroceryListDetailScreen.tsx (RegularItems ParamList removed + addPantryItem stub)
- lib/services/ingredientSuggestionService.ts (StorageLocation inlined)

**Old service/type export inventories:**
- pantryService exports: [list]
- types/pantry exports: [list]

**P8-22 resolution:** [confirmed — status cycling on ManageSuppliesScreen via SupplyRow]

**Verification (12 steps):** [pass/fail for each]

**Remaining import-break references (from step 12):** [list with classification]

**Deviations from prompt:** [list or "none"]

**Recommended next steps:** CP5 (needs + views UX)
```

---

## Tracker row

```
| 8R-CP4 | Supplies UX rewrite + pantryService deletion | SupplyRow, SuppliesSection, ManageSuppliesScreen, PantryScreen rewrite, RecipeDetailScreen fix, pantryService + types/pantry deleted | — |
```
