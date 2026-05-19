# 8R-CP3 — Cook-Flow Bridge + Recipe-to-Needs + Regulars Deletion

**Phase:** 8R — Unified Household Needs  
**Checkpoint:** CP3  
**Type:** Service rewrite + UI cascading updates + file deletions  
**Estimated:** 1 session

---

## Context

CP1 dropped all old pantry/grocery tables. CP2a/CP2b created the new service layer (suppliesService, needsService, tagsService, viewsService). CP3 rewires the cook-flow and recipe-add-to-needs paths against the new model, and cleans up the regulars concept (absorbed into supplies).

**What's changing conceptually:**

1. **Cook depletion simplifies.** Old flow matched recipe ingredients against pantry_items (quantity decrement) AND pantry_staples (state cycle). New flow matches recipe ingredients against supplies (status cycle only). Supplies don't track quantity (Q15), so there is no decrement logic. The depletion plan shrinks from `{ items[], staples[] }` to `{ supplies[] }`.

2. **"Add to grocery list" becomes "Add to needs."** Old flow: pick a list → add items one by one to `grocery_list_items`. New flow: add all recipe ingredients as needs directly to the space. No list picker. Uses `needsService.addNeedFromRecipe`.

3. **Regulars are gone.** The concept is absorbed by supplies with status cycling. The 3 regulars screens/modals are deleted.

**Decision references:**
- Q7: supply status cycle (in_stock → low → critical → out → in_stock)
- Q10β: spawn-on-out (suppliesService.setSupplyStatus handles this)
- Q15: supplies are status-only, no quantity tracking
- Q41: depletion is service-level (cookDepletionService calls suppliesService)
- Q48: spawn idempotency (already in suppliesService)

---

## Inputs to read

1. `lib/cookDepletionService.ts` — **current** file to rewrite. Understand the full structure: `computeDepletion`, `applyDepletion`, `rollbackDepletion`, `runPostCookDepletion`, types (`DepletionPlan`, `DepletionItem`, `DepletionStaple`), `cookTransition` state machine.
2. `contexts/CookDepletionBannerContext.tsx` — imports `DepletionPlan` from cookDepletionService. Will need type import update.
3. `components/pantry/CookDepletionBanner.tsx` — imports `DepletionPlan`, `rollbackDepletion` from cookDepletionService. Displays summary text.
4. `components/pantry/CookDepletionReviewModal.tsx` — imports types from cookDepletionService. Renders per-row detail (item quantities, staple states). Heaviest UI changes here.
5. `components/AddRecipeToListModal.tsx` — **current** file to rewrite. Imports from dead `groceryListsService`.
6. `lib/services/suppliesService.ts` — `getSuppliesForSpace`, `setSupplyStatus`, `cycleSupplyStatus`, `getSupplyDisplayName`, `SupplyStatusResult`, `SupplyWithTags`. The depletion calls `setSupplyStatus` which handles spawn-on-out.
7. `lib/services/needsService.ts` — `addNeedFromRecipe`, `AddNeedFromRecipeParams`.
8. `lib/types/supplies.ts` — `Supply`, `SupplyStatus`, `SupplyWithTags`.
9. `lib/types/needs.ts` — `AddNeedFromRecipeParams`.
10. `screens/RecipeDetailScreen.tsx` — caller of both `AddRecipeToListModal` and `runPostCookDepletion`. Read to understand integration points. **Modify only** the AddRecipeToListModal reference (rename import). Do NOT touch RecipeDetailScreen's pantryService imports — those are CP4 scope.
11. `screens/CookingScreen.tsx` — caller of `runPostCookDepletion`. Read to understand integration point. Should need zero changes (it calls `runPostCookDepletion` which keeps the same signature).
12. `App.tsx` — navigation setup. Find the RegularItems route(s) and ManageStaples route to understand nav topology.
13. `screens/RegularItemsScreen.tsx` — read export list before deleting.
14. `components/AddRegularItemModal.tsx` — read export list before deleting.
15. `components/EditRegularItemModal.tsx` — read export list before deleting.
16. `docs/CLAUDE.md` — session logging rules.

---

## Task

### Part 1 — Rewrite `lib/cookDepletionService.ts`

Replace the entire file. New implementation against suppliesService.

**New types (defined in this file — runtime types for the depletion flow, Q46 exempt since these are domain-specific transient types consumed only by the banner UI, not service params/returns):**

```typescript
export interface DepletionSupply {
  supply_id: string;
  display_name: string;
  old_status: SupplyStatus;
  new_status: SupplyStatus;
  spawned_need_id: string | null;  // non-null if spawn-on-out fired
}

export interface DepletionPlan {
  post_id: string;
  space_id: string;
  supplies: DepletionSupply[];
}
```

**`cookTransition` state machine (8R version):**
```
in_stock  → low        (used a good amount)
low       → critical   (getting scarce)
critical  → out        (depleted — triggers spawn-on-out in suppliesService)
out       → out        (already out, no-op)
```

Note: this is a one-step demotion per cook event, NOT cycling through the full sequence. Cooking uses olive oil → olive oil moves one step down. If you cook again, it moves another step.

**`computeDepletion(postId, spaceId)` — rewrite:**

1. Fetch post → recipe_id. No recipe_id = freeform post = return null (silent).
2. Fetch recipe_ingredients for that recipe: `.from('recipe_ingredients').select('ingredient_id').eq('recipe_id', recipeId)`. Filter out null ingredient_ids.
3. Fetch all supplies for the space: `suppliesService.getSuppliesForSpace(spaceId)`.
4. Match: for each recipe ingredient, find supplies with the same `ingredient_id`. If a supply is found, compute the transition via `cookTransition`.
5. Filter out no-ops (out → out).
6. If nothing to do, return null.
7. Build and return `DepletionPlan`.

**Important matching change from old model:** Old model matched by ingredient_id against both pantry_items AND pantry_staples separately. New model matches against supplies only. A supply with `custom_name` (no ingredient_id) will never match a recipe ingredient (recipe ingredients always have ingredient_id). This is correct — custom-name supplies like "toilet paper" don't appear in recipes.

**`applyDepletion(plan)` — rewrite:**

For each `DepletionSupply` in the plan:
- Call `suppliesService.setSupplyStatus(supply.supply_id, entry.new_status)`.
- This returns a `SupplyStatusResult` which includes `spawnedNeed` if spawn-on-out fired.
- Capture `spawnedNeed?.id` into the `DepletionSupply.spawned_need_id` field (mutate in place — the plan object is the undo-state record).
- Errors per-supply are logged but don't throw (same pattern as old code — partial state is acceptable, user can review/undo).

**`rollbackDepletion(plan, excludeIds?)` — rewrite:**

For each `DepletionSupply` NOT in excludeIds:
- Call `suppliesService.setSupplyStatus(supply.supply_id, entry.old_status)` to restore.
- If `spawned_need_id` is non-null, delete the spawned need: `.from('needs').delete().eq('id', spawned_need_id)`. Direct Supabase call is fine here (needsService.deleteNeed would work too, but we don't want to import needsService into cookDepletionService — keep it independent like suppliesService).
- Per-supply errors logged, not thrown.

**`runPostCookDepletion(postId, spaceId)` — same signature, same fire-and-forget pattern.**

Keep the same export signature so CookingScreen and RecipeDetailScreen callers need zero changes.

### Part 2 — Update banner/context/modal (type cascade)

**`contexts/CookDepletionBannerContext.tsx`:**
- Update `DepletionPlan` import from `cookDepletionService` (same path, new shape).
- No logic changes needed — it just stores the plan object.

**`components/pantry/CookDepletionBanner.tsx`:**
- Update imports (DepletionPlan, rollbackDepletion from cookDepletionService).
- Update the summary text line. Old: showed item count + staple count. New: show supply count.
  - Example: "Updated 3 supplies" or "3 pantry items updated" — keep it simple.
- Rest of banner logic (timer, undo, review) stays the same.

**`components/pantry/CookDepletionReviewModal.tsx`:**
- Update imports.
- Row rendering changes:
  - Old: two sections (items with quantity changes, staples with state changes).
  - New: one section (supplies with status changes).
  - Each row shows: `display_name` + `old_status → new_status` (e.g., "Olive Oil: in stock → low").
  - If `spawned_need_id` is non-null, show a small indicator (e.g., "+ added to needs").
  - Checkbox behavior stays the same (unchecked = will roll back on Done).
- The `excludeIds` passed to `rollbackDepletion` now contain `supply_id` values instead of a mix of `pantry_item_id` and `staple_id`.

### Part 3 — Rewrite `components/AddRecipeToListModal.tsx`

Rename file to `components/AddRecipeToNeedsModal.tsx`. This is a conceptual rename — the modal no longer picks a list.

**New behavior:**
1. Shows the list of recipe ingredients (same as before, with scaled quantities).
2. Single "Add to Needs" button (no list picker, no "create new list").
3. On press: loops through ingredients, calls `needsService.addNeedFromRecipe` for each valid ingredient (skip unmatched/no-ID ingredients, same as before).
4. Shows success count + any failures.
5. Props change:
   - Remove `userId` prop (needs are space-scoped, use `spaceId` from caller).
   - Add `spaceId: string` prop.
   - Keep: `visible`, `onClose`, `recipe` (id + title), `ingredients`, `scale`.

**Update `screens/RecipeDetailScreen.tsx`:**
- Change import: `AddRecipeToListModal` → `AddRecipeToNeedsModal` from new path.
- Update the JSX: `<AddRecipeToListModal ... userId={currentUserId || ''} />` → `<AddRecipeToNeedsModal ... spaceId={activeSpaceId || ''} />`.
- Add `useActiveSpaceId` import if not already present (it was added in 8B-CP4 for depletion).
- **Do NOT modify** RecipeDetailScreen's `pantryService` imports or the `getPantryItems` call. That is CP4 scope.

### Part 4 — Delete regulars files + nav cleanup

**Delete these 3 files:**
1. `screens/RegularItemsScreen.tsx`
2. `components/AddRegularItemModal.tsx`
3. `components/EditRegularItemModal.tsx`

**Before deleting**, record the export list from each file in SESSION_LOG.

**Navigation cleanup in `App.tsx`:**
- Find and remove the `RegularItems` route/screen registration from whichever stack it's in (likely GroceryStack or PantryStack).
- Remove the import of `RegularItemsScreen`.
- If any other screen has a navigation.navigate('RegularItems') call, note it in SESSION_LOG but do NOT rewrite that screen (it's CP4/CP5 territory). The dead nav call will crash at runtime if triggered, but those screens are being rewritten anyway.

### Part 5 — Delete old `AddRecipeToListModal.tsx`

After creating the new `AddRecipeToNeedsModal.tsx`, verify the old file path (`components/AddRecipeToListModal.tsx`) is gone. If you renamed in place, confirm the old name no longer exists.

---

## Constraints

1. **Do NOT modify `lib/services/suppliesService.ts`, `needsService.ts`, `tagsService.ts`, or `viewsService.ts`.** Services are stable from CP2.
2. **Do NOT modify `lib/types/` files.** All needed types exist.
3. **Do NOT rewrite `PantryScreen.tsx`, `ManageStaplesScreen.tsx`, `GroceryListsScreen.tsx`, `GroceryListDetailScreen.tsx`, or `StaplesGrid.tsx`.** Those are CP4/CP5.
4. **Do NOT remove RecipeDetailScreen's `pantryService` imports.** CP4 scope.
5. **`runPostCookDepletion` keeps the same function signature:** `(postId: string, spaceId: string | null) => Promise<DepletionPlan | null>`. CookingScreen and RecipeDetailScreen callers must need zero changes to their depletion call sites.
6. **cookDepletionService does NOT import from needsService.** It uses `suppliesService.setSupplyStatus` (which internally handles spawn-on-out). For need deletion during rollback, use direct Supabase call.
7. **DepletionPlan types live in cookDepletionService.ts** (not lib/types/). They're transient domain types consumed only by the banner UI, not service-layer params. Q46's canonical-types rule applies to service-layer interfaces; these are UI-flow types.
8. **Verification is grep-based (not tsc).** Per the tsc-blindness finding from CP2b, upstream nav-types parse errors block TS2307 detection. Use grep to verify import health.

---

## Verification steps

1. **New imports resolve.** Run:
   ```
   grep -rn "from.*cookDepletionService" lib/ contexts/ components/ screens/ | grep -v node_modules
   ```
   Every hit should resolve to the rewritten `lib/cookDepletionService.ts`. No references to `pantryService` or `pantryStaplesService` in any modified file.

2. **Old imports eliminated from modified files.** Run:
   ```
   grep -rn "pantryStaplesService\|groceryListsService\|groceryService" lib/cookDepletionService.ts components/AddRecipeToNeedsModal.tsx components/pantry/CookDepletionBanner.tsx components/pantry/CookDepletionReviewModal.tsx contexts/CookDepletionBannerContext.tsx
   ```
   Expected: 0 matches.

3. **AddRecipeToListModal replaced.** Run:
   ```
   ls components/AddRecipeToListModal.tsx 2>&1
   ```
   Expected: "No such file or directory."
   ```
   ls components/AddRecipeToNeedsModal.tsx
   ```
   Expected: file exists.

4. **RecipeDetailScreen imports updated.** Run:
   ```
   grep "AddRecipeToListModal\|AddRecipeToNeedsModal" screens/RecipeDetailScreen.tsx
   ```
   Expected: only `AddRecipeToNeedsModal` reference.

5. **RecipeDetailScreen's pantryService imports preserved.** Run:
   ```
   grep "pantryService" screens/RecipeDetailScreen.tsx
   ```
   Expected: still present (CP4 will handle this).

6. **runPostCookDepletion signature unchanged.** Run:
   ```
   grep "export async function runPostCookDepletion" lib/cookDepletionService.ts
   ```
   Confirm params are `(postId: string, spaceId: string | null)`.

7. **CookingScreen + RecipeDetailScreen depletion call sites unchanged.** Run:
   ```
   grep "runPostCookDepletion" screens/CookingScreen.tsx screens/RecipeDetailScreen.tsx
   ```
   Confirm both still call `runPostCookDepletion` with same args as before CP3.

8. **Regulars files deleted.** Run:
   ```
   ls screens/RegularItemsScreen.tsx components/AddRegularItemModal.tsx components/EditRegularItemModal.tsx 2>&1
   ```
   Expected: "No such file or directory" for all 3.

9. **RegularItems nav route removed from App.tsx.** Run:
   ```
   grep "RegularItems" App.tsx
   ```
   Expected: 0 matches (or only in ParamList type — the type definition is harmless dead code).

10. **No React import in cookDepletionService.** Run:
    ```
    grep "from 'react" lib/cookDepletionService.ts
    ```
    Expected: 0 matches.

11. **File line counts.** Report `wc -l` for all modified/created files.

12. **Import-break audit.** Run:
    ```
    grep -rn "AddRecipeToListModal\|RegularItemsScreen\|AddRegularItemModal\|EditRegularItemModal" screens/ components/ lib/ --include="*.tsx" --include="*.ts" | grep -v node_modules
    ```
    List any remaining references. These are CP4/CP5 cleanup unless they're in files modified by this session (which would be bugs).

---

## SESSION_LOG entry format

```
## 2026-MM-DD — 8R-CP3 — Cook-Flow Bridge + Recipe-to-Needs + Regulars Deletion

**Phase:** 8R-CP3
**Status:** ✅ Complete | ⚠️ Partial | ❌ Blocked

**Files rewritten:**
- lib/cookDepletionService.ts (was N lines → now N lines)
- components/AddRecipeToListModal.tsx → components/AddRecipeToNeedsModal.tsx (was N lines → now N lines)

**Files updated (type cascade):**
- contexts/CookDepletionBannerContext.tsx (N lines changed)
- components/pantry/CookDepletionBanner.tsx (N lines changed)
- components/pantry/CookDepletionReviewModal.tsx (N lines changed)
- screens/RecipeDetailScreen.tsx (import rename only)

**Files deleted:**
- screens/RegularItemsScreen.tsx (was N lines, N exports)
- components/AddRegularItemModal.tsx (was N lines, N exports)
- components/EditRegularItemModal.tsx (was N lines, N exports)

**Nav changes:**
- [describe RegularItems route removal from App.tsx]

**Old service export inventories (deleted files):**
- RegularItemsScreen exports: [list]
- AddRegularItemModal exports: [list]
- EditRegularItemModal exports: [list]

**Verification (12 steps):** [pass/fail for each]

**Remaining import-break references (from step 12):** [list]

**Deviations from prompt:** [list or "none"]

**Recommended next steps:** CP4 (supplies UX + pantryService deletion)
```

---

## Tracker row

```
| 8R-CP3 | Cook-flow bridge + recipe-to-needs + regulars deletion | cookDepletionService rewrite, AddRecipeToNeedsModal, banner/modal cascade, 3 regulars files deleted | — |
```
