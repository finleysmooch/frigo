# 8R-CP2b — Needs Service + Views Service + Old Service Deletion

**Phase:** 8R — Unified Household Needs  
**Checkpoint:** CP2b (second half of CP2 split)  
**Type:** Service layer completion + cleanup  
**Estimated:** 1 session

---

## Context

CP2a shipped: 4 type files (`lib/types/tags.ts`, `supplies.ts`, `needs.ts`, `views.ts`) + 2 services (`lib/services/tagsService.ts`, `lib/services/suppliesService.ts`). All types that CP2b's services need are already defined. CP2b adds the remaining two services and deletes the old ones.

**Decision references:** Key ones for this checkpoint:
- Q2: views presented as "lists" in UI
- Q6: recipe attribution via needs_recipes junction
- Q7: need status cycle (need → in_cart → acquired)
- Q12/Q28/Q36: display-merge predicate (same identity + unit + store tags + for_user_ids)
- Q16: AND across dimensions, multi-value within dimension
- Q19: 4 default views (Tonight, This week, All needs, In cart)
- Q25: render modes (tier / aisle / flat)
- Q29: aisle is render mode computed from ingredients.typical_store_section, NOT a tag dimension
- Q32: status filter defaults to "need" only in creator
- Q37: for_user_ids write semantics (empty = everyone)
- Q42: view filter engine — DB handles space_id + status; tag predicates in JS post-query
- Q43: old services deleted (not zombied); compile failures become CP3-CP5 TODO list
- Q46: all param/return types in canonical type files
- Q49: getNeedsForView default status filter is `['need']` only (not need+in_cart). Views are shopping lists, not pantry views. Tonight/This-week seed views have no explicit status filter, so this fallback applies.
- Q50: acquired is terminal in cycleNeedStatus (no-op + console.warn). setNeedStatus can still set any status directly.

---

## Inputs to read

1. `docs/PHASE_8R_UNIFIED_NEEDS.md` — decisions log (Q1-Q48).
2. `docs/phase_8r_cp1_schema_migration.sql` — exact column names, CHECK constraints, FK relationships.
3. `lib/types/needs.ts` — all Need-related types (created in CP2a). Pay attention to: `NeedWithTags`, `NeedWithDetails`, `NeedRecipe`, `MergedNeedGroup`, `CreateNeedParams`, `AddNeedFromRecipeParams`, `UpdateNeedParams`.
4. `lib/types/views.ts` — all View-related types (created in CP2a). Pay attention to: `ViewWithFilters`, `ViewFilter`, `ViewFilterInput`, `CreateViewParams`, `UpdateViewParams`.
5. `lib/types/tags.ts` — `Tag`, `TagDimension`.
6. `lib/types/supplies.ts` — `SupplyStatus` type (referenced by spawn context comments). mergeNeedsForDisplay does NOT take supply types.
7. `lib/services/tagsService.ts` — for tag management functions. needsService uses `getNeedTags`, `setNeedTags` etc.
8. `lib/services/suppliesService.ts` — reference for patterns (Supabase query style, error classes, flattenRow helper approach, logging conventions).
9. `lib/pantryStaplesService.ts` — read its export list before deleting, to understand what callers expect.
10. `lib/groceryListsService.ts` — read its export list before deleting. Note: imports `createGroceryList` and `updateListItem` from itself (no cross-dep issue on delete).
11. `lib/groceryService.ts` — read its export list before deleting.
12. `lib/supabase.ts` — Supabase client import.
13. `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 — SESSION_LOG entry format.
14. `docs/CLAUDE.md` — session logging rules.

---

## Task

Create 2 new service files, then delete 3 old service files.

### Part 1 — needsService (`lib/services/needsService.ts`)

Import `supabase` from `../supabase`. Import types from `../types/needs`, `../types/tags`.

**Functions to implement:**

```typescript
// ----- READ -----

// Get all needs for a space with ingredient + tags eagerly loaded.
// Supabase query pattern (same as suppliesService):
//   select('*, ingredient:ingredients(...), need_tags(tag:tags(*))')
// Flatten need_tags from [{tag: Tag}] to Tag[] in mapping.
// Sort: need → in_cart → acquired, then alphabetical by display name.
getNeedsForSpace(spaceId: string): Promise<NeedWithTags[]>

// Single need by ID with ingredient + tags + recipe attributions.
// Joins needs_recipes with recipe title: select('*, recipe:recipes(title)')
getNeedById(needId: string): Promise<NeedWithDetails | null>

// Filtered by status array. Same eager loading as getNeedsForSpace.
getNeedsByStatus(spaceId: string, statuses: NeedStatus[]): Promise<NeedWithTags[]>

// ----- VIEW FILTER QUERY (Q42) -----

// Fetch needs matching a view's filter predicates.
// Implementation per Q42 (scope-bounded DB + JS split):
//   1. Read the view's filters from view_filters table.
//   2. Build Supabase query: .eq('space_id', view.space_id)
//      If a 'status' filter exists: .in('status', statusFilter.values)
//      If NO status filter: default to .in('status', ['need'])
//        (these are shopping lists, not pantry views — show only what's still needed)
//   3. Execute query with ingredient + tags eagerly loaded.
//   4. Tag-predicate evaluation in JS:
//      For each non-status filter (store, urgency, recipe, event, storage):
//        Keep only needs where the need's tags include AT LEAST ONE value
//        from the filter's values array for that dimension.
//      AND across dimensions (need must pass ALL dimension filters).
//   5. Urgency derived hierarchy (Q5/Q11):
//      If urgency filter includes 'this-week', also match needs tagged 'today'.
//      If urgency filter includes 'this-month', also match 'today' and 'this-week'.
//   6. Return NeedWithTags[] (caller can upgrade to NeedWithDetails via getNeedById if needed).
getNeedsForView(viewId: string): Promise<NeedWithTags[]>

// ----- RECIPE ATTRIBUTION -----

// Get recipe attributions for a need.
getRecipesForNeed(needId: string): Promise<NeedRecipe[]>

// Add a recipe attribution to an existing need. Upsert pattern (no-op if already linked).
addRecipeToNeed(needId: string, recipeId: string, params: {
  recipeQuantityAmount?: number;
  recipeQuantityUnit?: string;
  addedBy: string;
}): Promise<void>

// Remove a recipe attribution from a need.
removeRecipeFromNeed(needId: string, recipeId: string): Promise<void>

// ----- CREATE -----

// Create a need. If tagIds provided, calls tagsService.setNeedTags after insert.
// tagIds are caller-resolved: UI handles Q11 view-context auto-application
// (inheriting the active view's tags) before calling this function.
// for_user_ids: defaults to [] if not provided (Q37).
createNeed(params: CreateNeedParams): Promise<NeedWithTags>

// Convenience: create need + recipe attribution in one call.
// Used by recipe-add flow (CP3).
// Creates the need, then inserts a needs_recipes row.
// If tagIds provided, applies those too.
addNeedFromRecipe(params: AddNeedFromRecipeParams): Promise<NeedWithDetails>

// ----- UPDATE -----

// Update non-status fields on a need.
// If tagIds provided, calls tagsService.setNeedTags (symmetric with createNeed).
// NOTE: requires adding optional `tagIds?: string[]` to UpdateNeedParams in lib/types/needs.ts.
updateNeed(needId: string, params: UpdateNeedParams): Promise<NeedWithTags>

// Set status directly (tap-to-set on view detail per Q30).
setNeedStatus(needId: string, newStatus: NeedStatus): Promise<NeedWithTags>

// Cycle status: need → in_cart → acquired (Q7).
// Acquired is terminal — cycleNeedStatus on an acquired need is a no-op
// with a console.warn. setNeedStatus can still set any status directly.
cycleNeedStatus(needId: string): Promise<NeedWithTags>

// ----- DELETE -----

deleteNeed(needId: string): Promise<void>

// ----- DISPLAY MERGE (Q28/Q36) -----

// Pure function (no DB calls). Groups needs by merge predicate:
//   Same ingredient_id (or custom_name) + same unit_display + same store tag set + same for_user_ids set.
//   Recipe attributions do NOT block merge. Urgency tags don't block merge.
//
// Implementation:
//   1. For each need, compute a merge key:
//      - identity: ingredient_id ?? `custom:${custom_name}`
//      - unit: unit_display ?? 'none'
//      - storeTags: sorted array of tag IDs where dimension='store', joined as string
//      - forUsers: sorted for_user_ids joined as string
//      Concatenate with `|||` separator: `${identity}|||${unit}|||${storeTags}|||${forUsers}`
//      (separator prevents string-concat collisions with custom_name values).
//   2. Group needs by key.
//   3. For each group, compute:
//      - totalQuantity: sum of quantity_display across needs (null if all null)
//      - allRecipes: deduplicated union of all NeedRecipe entries across needs
//   4. Return MergedNeedGroup[].
mergeNeedsForDisplay(needs: NeedWithDetails[]): MergedNeedGroup[]

// ----- HELPERS -----

// Pure function. Returns ingredient.name if available, else custom_name.
getNeedDisplayName(need: NeedWithTags): string
```

**Error handling:**
- `NeedNotFoundError` — thrown by getNeedById / setNeedStatus / cycleNeedStatus when not found.
- Error class defined in the service file (runtime construct, Q46 exempt).

**Logging:** Use 🛒 emoji prefix for need operations, ❌ for errors.

### Part 2 — viewsService (`lib/services/viewsService.ts`)

Import `supabase` from `../supabase`. Import types from `../types/views`, `../types/tags`.

**Functions to implement:**

```typescript
// ----- READ -----

// Get all views for a space with filters eagerly loaded.
// Supabase: select('*, view_filters(*)')
// Sort by sort_order ascending.
// Filter OUT hidden views (is_hidden = true) by default.
getViewsForSpace(spaceId: string, includeHidden?: boolean): Promise<ViewWithFilters[]>

// Single view by ID with filters. Returns null if not found.
getViewById(viewId: string): Promise<ViewWithFilters | null>

// ----- CREATE -----

// Create a custom view with filters.
// Insert view row, then insert view_filter rows.
// is_default = false for user-created views.
createView(params: CreateViewParams): Promise<ViewWithFilters>

// ----- UPDATE -----

// Update view metadata (name, emoji, render_mode, sort_order).
// Does NOT update filters — use updateViewFilters for that.
updateView(viewId: string, params: UpdateViewParams): Promise<ViewWithFilters>

// Replace all filters on a view. Delete existing view_filters, insert new ones.
updateViewFilters(viewId: string, filters: ViewFilterInput[]): Promise<void>

// Toggle is_hidden on a view. Used for hiding default views from Lists home (Q19).
toggleViewHidden(viewId: string): Promise<ViewWithFilters>

// Set render mode on a view (tier / aisle / flat per Q25). Per-view persisted preference.
setViewRenderMode(viewId: string, mode: RenderMode): Promise<ViewWithFilters>

// ----- DELETE -----

// Delete a custom view. Blocks deletion of default views (is_default = true).
// Throws DefaultViewDeleteError if attempted.
deleteView(viewId: string): Promise<void>

// ----- SEED -----

// Call the DB function seed_default_views(space_id) via .rpc().
// Used when creating a new space (wired by space-creation flow).
// Idempotent (the DB function skips if defaults already exist).
seedDefaultViews(spaceId: string): Promise<void>
```

**Error handling:**
- `ViewNotFoundError` — thrown by getViewById / updateView / deleteView when not found.
- `DefaultViewDeleteError` — thrown by deleteView when is_default = true.
- Error classes defined in the service file.

**Logging:** Use 📋 emoji prefix for view operations, ❌ for errors.

### Part 3 — Delete old service files (Q43)

Delete these 3 files entirely:

1. `lib/pantryStaplesService.ts`
2. `lib/groceryListsService.ts`
3. `lib/groceryService.ts`

**Before deleting**, record the list of exports from each file. Include the export lists in the SESSION_LOG — this becomes the reference for CP3-CP5 screen rewrites.

**After deleting**, run `npx tsc --noEmit 2>&1 | grep -c "error TS"` and record the new error count. The delta from CP2a's baseline (181) represents the import-break surface — the screens that need rewriting in CP3-CP5. List the files with new errors in the SESSION_LOG.

**Do NOT fix the import errors.** They are intentional per Q43. The compile-error list IS the CP3-CP5 work list.

---

## Constraints

1. **2 new service files + 3 deletions.** No UI changes. No screen modifications. One type file modification allowed: add `tagIds?: string[]` to `UpdateNeedParams` in `lib/types/needs.ts`.
2. **No service-internal type definitions (Q46).** All interfaces and type aliases used as function params/returns already exist in `lib/types/`. Error classes are exempt.
3. **Use existing Supabase client pattern.** `import { supabase } from '../supabase'`.
4. **RLS does the space-access check.** No space-membership checks in service code.
5. **needsService must NOT import from suppliesService.** Keep services independent. Supply-related lookups (e.g., for display-merge context) are the caller's responsibility.
6. **viewsService must NOT import from needsService.** View service handles view CRUD only. The view-filter query engine lives in needsService (getNeedsForView), NOT in viewsService — viewsService just reads/writes view definitions and filters.
7. **Keep each service file under ~400 lines.** suppliesService at 406 was fine; same tolerance applies.
8. **getNeedsForView implements Q42 split:** DB query handles space_id + status (indexed); tag-predicate evaluation runs in JS post-query. This is scope-bounded to this function only.
9. **mergeNeedsForDisplay is a pure function.** No Supabase calls. Takes NeedWithDetails[], returns MergedNeedGroup[]. Called by UI layer after fetching needs.
10. **Do not modify `lib/services/tagsService.ts` or `lib/services/suppliesService.ts`.**

---

## Verification steps

Before marking complete:

1. **TypeScript error count — two snapshots.**
   - After creating needsService + viewsService (before deleting old services): should equal CP2a baseline (181). Zero new errors from the new services.
   - After deleting old services: record new count. The delta from 181 is the import-break surface. **List every file with new errors** in SESSION_LOG.
2. **All exported function signatures match the stubs above.** If you deviated, explain why.
3. **No service-internal type definitions.** `grep "interface\|type " lib/services/needsService.ts lib/services/viewsService.ts` — should only show error classes.
4. **needsService has 15 exported functions** (3 read + 1 view-filter + 3 recipe-attribution + 2 create + 1 update + 2 status + 1 delete + 1 merge + 1 helper) + 1 error class.
5. **viewsService has 8 exported functions** (2 read + 1 create + 2 update + 1 toggle + 1 delete + 1 seed) + 2 error classes.
6. **getNeedsForView implements Q42 split.** Confirm: Supabase query uses `.eq('space_id', ...)` and `.in('status', ...)`, then tag filtering happens in a JS loop post-query.
7. **getNeedsForView handles urgency derived hierarchy.** Confirm: if filter includes 'this-week', the JS evaluation also matches needs tagged 'today'.
8. **mergeNeedsForDisplay is pure.** Confirm: no `supabase` calls in the function body.
9. **deleteView blocks default views.** Confirm: checks `is_default` and throws `DefaultViewDeleteError`.
10. **Old services deleted.** `ls lib/pantryStaplesService.ts lib/groceryListsService.ts lib/groceryService.ts 2>&1` should show "No such file or directory" for all 3.
11. **Zero React/UI imports in new files.** `grep -r "from 'react\|from 'react-native" lib/services/needsService.ts lib/services/viewsService.ts` — 0 matches.
12. **File line counts.** Report `wc -l` for both new files.

---

## SESSION_LOG entry format

```
## 2026-MM-DD — 8R-CP2b — Needs Service + Views Service + Old Service Deletion

**Phase:** 8R-CP2b
**Status:** ✅ Complete | ⚠️ Partial | ❌ Blocked

**Files created:**
- lib/services/needsService.ts (N lines)
- lib/services/viewsService.ts (N lines)

**Files deleted:**
- lib/pantryStaplesService.ts (was N lines, N exports)
- lib/groceryListsService.ts (was N lines, N exports)
- lib/groceryService.ts (was N lines, N exports)

**TypeScript error count:**
- After new services (before deletion): N (delta from CP2a baseline: ±N)
- After old service deletion: N (delta from CP2a baseline: +N)
- Files with new import errors: [list each file and error count]

**Function inventory:**
- needsService: N exported functions + N helpers
- viewsService: N exported functions

**Q42 view-filter split:** [confirmed / deviation noted]
**Urgency derived hierarchy:** [confirmed / deviation noted]
**mergeNeedsForDisplay purity:** [confirmed / deviation noted]
**deleteView default-view guard:** [confirmed / deviation noted]

**Old service export inventories (for CP3-CP5 reference):**
- pantryStaplesService exports: [list]
- groceryListsService exports: [list]
- groceryService exports: [list]

**Deviations from prompt:** [list or "none"]

**Recommended next steps:** CP3 (recipe + cook flow integration)
```

---

## Tracker row

```
| 8R-CP2b | needsService + viewsService + old service deletion | lib/services/{needsService,viewsService}.ts created; lib/{pantryStaplesService,groceryListsService,groceryService}.ts deleted | — |
```
