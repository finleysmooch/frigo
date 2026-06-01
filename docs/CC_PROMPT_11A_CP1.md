# CC PROMPT — 11A-CP1: Unified browse model (foundational, non-visual refactor)

## Context

Phase 11 sub-phase **11A** redesigns the Recipes browse experience (`screens/RecipeListScreen.tsx`): search elevated to the top, a 6-preset "tile" grid + a cuisine strip as entry points, and a single locked-context-chip + contextual-facets refine surface shared by tiles, cuisine, and search. The current screen has three overlapping filter systems — the `browseMode` segmented control, the `quickFilters` chip row, and `advancedFilters` (the FilterDrawer state) — plus a 9-option sort dropdown and a bottom search bar.

**CP1 is the foundational, NON-VISUAL first step.** It extracts the screen's filter/sort/search/section composition into one pure, testable browse model — a `BrowseState` shape, a context registry, and a single `resolveBrowse` function — and routes the existing screen through it. **The screen must look and behave identically after CP1.** This establishes the engine the later CPs (tiles, cuisine, facets, refine sheet) build on, and lets us prove behavioral parity against a known-good baseline before any pixels change.

This is deliberately a refactor with zero visible output change. Do not redesign anything.

## What you're building

1. **New pure module `lib/services/recipeBrowseService.ts`** — pure domain logic, no Supabase calls, no React. It owns:
   - `SortOption` (moved here from RecipeListScreen)
   - `BrowseContextId` and a context registry
   - `BrowseState` (the single composable shape)
   - `resolveBrowse(recipes, matchMap, state): Recipe[]` — the one composition function, porting the current `applyFilters` logic **verbatim** (same order, same predicates, same null-handling, same `matchMap` reads)
   - `getCookAgainSections(recipes): BrowseSection[]` — the Cook Again grouping, ported verbatim

2. **Refactor `screens/RecipeListScreen.tsx`** to delegate all filtering/sorting/sectioning to the new module: assemble a `BrowseState` (via `useMemo`) from the existing UI state pieces, call `resolveBrowse` / `getCookAgainSections`, and feed the results into the existing render. Remove the in-component `applyFilters` body and the `cookAgainSections` composition (now in the module). Keep every state piece, render function, route-param effect, search path, dietary auto-apply, status bar, and selection-mode behavior unchanged.

3. **New `lib/services/__recipeBrowseResolverTest.ts`** — a lightweight resolver smoke test mirroring the existing `lib/services/_pantryMatchingSmokeTest` pattern.

## Explicitly OUT of scope for CP1

- **No visual change of any kind.** No tiles, no cuisine strip, no contextual facets, no locked chip, no refine sheet, no card changes.
- Do **not** remove the `browseMode` segmented control, the `quickFilters` chip row, the `More ›` drawer trigger, the `Sort` dropdown, or the bottom search bar — they stay and keep feeding the model. They get migrated/retired in CP2–CP3.
- Do **not** touch `components/FilterDrawer.tsx`, `components/recipe/RecipeCard.tsx`, `screens/WhatCanICookScreen.tsx`, `lib/searchService.ts`, or `lib/services/readyToCookService.ts`.
- Leave `canMakeCount` and the ready-to-cook gate in the component as-is (they're touched in CP5, the "Ready to cook" context).
- No theme/style changes.

## Inputs to read first

- `screens/RecipeListScreen.tsx` — **the working-tree version is authoritative.** The current file includes the Phase 10F dietary-preferences indicator (`userDietaryPrefs`, `autoFilterDismissed`, `renderDietaryPrefIndicator`, the auto-apply effect that seeds `advancedFilters.dietaryFlags`) and the 8R-UX1 debounced `searchedRecipeIds` search. Do not rely on any older snapshot.
- `components/FilterDrawer.tsx` — the `FilterState` shape (this is the "refinements" type).
- `components/recipe/RecipeCard.tsx` — exports the canonical `Recipe` type. **Import it; do not create a third copy** (RecipeListScreen currently has its own duplicate `Recipe` interface — for CP1 you may leave that in place or import the canonical one, but the new module must use the canonical `Recipe` from RecipeCard).
- `lib/services/pantryMatchingService.ts` — the `PantryMatchResult` type.
- `lib/searchService.ts` — `searchRecipesByMixedTerms` (CP1 keeps calling it unchanged from the component).
- `docs/FRIGO_ARCHITECTURE.md` — conventions.

## Task

1. **Define the model in `recipeBrowseService.ts`:**

   ```ts
   export type SortOption =
     | 'newest' | 'alpha' | 'cal_low' | 'cal_high' | 'protein_high'
     | 'fastest' | 'most_cooked' | 'highest_rated' | 'pantry_match';

   export type BrowseContextId = 'all' | 'cook_again' | 'try_new';

   export type QuickFilterId = 'vegetarian' | 'highProtein' | 'quick30' | 'comfort';

   export interface BrowseState {
     context: BrowseContextId;
     selectedBook: string | null;       // only meaningful for 'try_new'
     quickFilterIds: QuickFilterId[];    // active quick filters
     refinements: Partial<FilterState>;  // = current advancedFilters
     searchedRecipeIds: Set<string> | null; // null = no active search
     sort: SortOption;
   }

   export interface BrowseSection {
     title: string;
     iconKey?: 'fire' | 'gem' | 'again'; // mapped to an icon by the screen
     data: Recipe[];
   }
   ```

2. **Context registry** keyed by `BrowseContextId`, each entry exposing a base predicate over a recipe:
   - `all` — no base filter
   - `cook_again` — `(r) => (r.times_cooked ?? 0) > 0`; marked as sectioned
   - `try_new` — `(r) => (r.times_cooked ?? 0) === 0`; applies the `selectedBook` filter when set
   Shape the registry so a tile context (`quick_tonight`, `ready_to_cook`, …) can be added as a single entry in CP2.

3. **Port `applyFilters` → `resolveBrowse(recipes, matchMap, state)` verbatim**, preserving the exact current order:
   1. Search intersection — if `state.searchedRecipeIds !== null`, keep only recipes in the set
   2. Context base filter (+ `selectedBook` for `try_new`)
   3. Quick filters — `vegetarian` (`is_vegetarian === true`), `highProtein` (`protein_per_serving_g >= 25`), `quick30` (total/active/prep+cook ≤30), `comfort` (`vibe_tags` includes `comfort`)
   4. Advanced refinements, all current dimensions with their current logic: dietary flags (AND), hero ingredients (OR), vibe tags (OR), `maxCaloriesPerServing`, `minProteinPerServing`, `maxActiveTime`, `maxTotalTime`, difficulty levels (OR) + `easierThanLooks`, cooking methods (OR), cuisine types (OR), course types (OR), ingredient-count ranges (OR), `makeAheadFriendly`, serving temp (OR), `recentlySaved`, `recentlyCookedByFriends`
   5. Sort — all 9 options with identical null-handling; `pantry_match` reads `matchMap.get(id)?.matchPercentage ?? 0`
   Preserve every `?? 0` / null-to-end behavior exactly as written today.

4. **Port `cookAgainSections` → `getCookAgainSections(recipes)` verbatim** — Recent Favorites (`last_cooked` ≤30d AND `avg_rating` ≥4), Forgotten Gems (`avg_rating` ≥4 AND >60d), Regulars (`times_cooked` ≥3), and the "Cooked Recipes" fallback when no smart section matches. Return `iconKey` (`'fire'`/`'gem'`/`'again'`) instead of importing icon components, so the module stays React-free.

5. **Refactor `RecipeListScreen.tsx`:**
   - Move `SortOption` import to the new module.
   - Build a `browseState: BrowseState` via `useMemo` from existing state: `browseMode → context`, `selectedBook`, active `quickFilters → quickFilterIds`, `advancedFilters → refinements`, `searchedRecipeIds`, `sortOption → sort`.
   - Replace the `applyFilters` function and its `useEffect`/`setFilteredRecipes` flow with `setFilteredRecipes(resolveBrowse(recipesWithMatch, matchMap, browseState))`, keeping the same dependency set so it recomputes on the same triggers.
   - Replace the `cookAgainSections` `useMemo` with `getCookAgainSections(filteredRecipes)`.
   - Update `renderSectionHeader` to map `iconKey → { fire: FireIcon, gem: GemIcon, again: AgainIcon }`.
   - Everything else (route-param effect, debounced search, dietary auto-apply, status bar, selection mode, all render functions, the FilterDrawer wiring) stays untouched.

6. **Add `lib/services/__recipeBrowseResolverTest.ts`** (mirror `_pantryMatchingSmokeTest`): a small fixture recipe array + a state matrix that asserts `resolveBrowse` output ID sets/orders for each context, each quick filter, a representative set of advanced dimensions, each of the 9 sorts, a search-intersection case, and one combined case. The point is a fast, repeatable parity guard for CP2+.

## Constraints

- The module is **pure** — no Supabase, no React imports, no icon components. Search execution stays in the component (it just passes the resolved `searchedRecipeIds` into the model).
- **Behavioral parity is the acceptance bar**: identical filtered set, identical order, identical Cook Again sections for every state. Nothing visible changes.
- **Never remove existing functionality.** All filter dimensions, all 9 sorts, search, route-param drill-downs, dietary auto-apply, and selection mode must work exactly as before.
- Use the canonical `Recipe` type from `components/recipe/RecipeCard.tsx`.
- Match existing code style and comment conventions.

## Verification

Confirm parity (CC self-check via the resolver test, then Tom smoke in Expo Go):

1. Each browse mode (All / Cook Again / Try New) renders the same recipes, order, and — for Cook Again — the same sections.
2. Try New: the book dropdown filters identically.
3. Each quick filter (Vegetarian / High Protein / Under 30m / Comfort) toggles to the same result set.
4. Every FilterDrawer dimension filters identically (dietary AND, hero/vibe/method/cuisine/course/count/temp OR, the two nutrition and two time bounds, difficulty + easier-than-looks, make-ahead, the two social toggles).
5. All 9 sorts order identically, including null-to-bottom and `pantry_match`.
6. Search (single + multi-token) intersects identically; clearing search restores the prior set.
7. Stats drill-down route params still apply: `initialBrowseMode`, `initialCuisine`, `initialCookingConcept` (→ vibe), `initialDietaryFlag`, `initialIngredient` (→ search), and `sortBy=cook_count` (→ most_cooked).
8. 10F dietary auto-apply still seeds the dietary refinements; the "From your dietary preferences / Show all" indicator behaves as before.
9. "X you can make now" count and the status-bar logic are unchanged.
10. `clearAllFilters` resets identically; selection mode is unaffected.

## SESSION_LOG entry format

Append to `_SESSION_LOG.md`:

```
### 11A-CP1 — Unified browse model (foundational refactor) — <date>

**Shipped:** New pure `lib/services/recipeBrowseService.ts` (BrowseState + context registry + resolveBrowse + getCookAgainSections), RecipeListScreen routed through it, resolver smoke test added. No visual change.

**Files:** added recipeBrowseService.ts, __recipeBrowseResolverTest.ts; modified RecipeListScreen.tsx.

**Key decisions / deviations:** <e.g. SortOption moved to module; iconKey mapping for section headers; any Recipe-type consolidation; anything that surprised you>

**Parity verification:** <results of the resolver test + which of the 10 checklist items were exercised; flag any behavior you could not perfectly reproduce>

**Deferred / notes for CP2:** <e.g. the old browseMode/quickFilters/advancedFilters state pieces remain as temporary populators of BrowseState; tile contexts plug into the registry next>

**Recommended doc updates:** <FRIGO_ARCHITECTURE service list, phase doc 11A status>
```
