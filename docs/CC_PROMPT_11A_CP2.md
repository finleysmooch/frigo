# CC PROMPT — 11A-CP2: Home rebuild (search + preset tiles + cuisine strip)

> **Depends on 11A-CP1 (shipped 2026-05-28).** CP1's `lib/services/recipeBrowseService.ts` contract is confirmed and matches the references below: `BrowseState`, the `BROWSE_CONTEXTS` registry (`BrowseContextId` = `all | cook_again | try_new`), `SortOption`, `QuickFilterId`, `BrowseSection`, `resolveBrowse(recipes, matchMap, state)`, `getCookAgainSections(recipes)`. **Run CP2 only after CP1's resolver smoke test and Expo parity pass are green** — CP1 was traced and type-checked but not yet executed, so verify the baseline before stacking tile contexts on the resolver.

## Context

11A redesigns the Recipes home (`screens/RecipeListScreen.tsx`). The locked direction: search elevated to the top, a 6-preset **tile grid** + a **cuisine strip** as the primary entry points, and (in CP3/CP4) a single locked-chip + contextual-facets refine surface. CP1 built the engine. **CP2 builds the new home presentation and wires tiles + cuisine to set the active lens, replacing the segmented control.**

CP2 deliberately leaves the *existing* refine controls in place as an interim layer — the `quickFilters` chip row, the `More ›` → FilterDrawer, the `Sort` dropdown, and the book dropdown all stay and keep feeding `BrowseState`. They are replaced in CP3 (facets + locked chip) and CP4 (refine sheet). So the CP2 build state shows tiles + the old controls coexisting — that is intentional and temporary, not the final look. This sequencing is how we honor "never remove existing functionality": new entry points are added before the old ones are retired.

## What you're building

1. **Extend the CP1 `BROWSE_CONTEXTS` registry** with the tile contexts (each a base predicate; reuse the resolver):

   | Context id | Predicate / source | List render | Liveness gate | Default tile? |
   |---|---|---|---|---|
   | `quick_tonight` | total/active/(prep+cook) ≤ 30 | flat | always live | ✓ |
   | `ready_to_cook` | the ready-to-cook gate (matchMap + heroes — same gate `canMakeCount` uses) | flat | live if active space has supplies (proxy: any `matchMap` entry > 0); else inroad | ✓ |
   | `recently_added` | `created_at` within last 30 days | flat | always live (if user has recipes) | ✓ |
   | `your_classics` | `times_cooked > 0` — **reuse the existing `cook_again` predicate + `getCookAgainSections` sectioning** | sectioned (Recent Favorites / Forgotten Gems / Regulars) | live if ≥1 recipe `times_cooked > 0`; else inroad | ✓ |
   | `for_your_diet` | the user's set dietary flags (from `userDietaryPrefs`) ANDed | flat | live if ≥1 dietary pref set; else inroad | ✓ |
   | `friends_cook` | `friends_cooked_count > 0` | flat | live if any recipe has `friends_cooked_count > 0`; else inroad | ✓ |
   | `something_new` | `times_cooked === 0` — **the old `try_new`** | flat | n/a | registered, not a default tile |

   `your_classics` is the old `cook_again` experience surfaced via a tile — preserve its 3-section grouping exactly. `something_new` is the old `try_new`; register it so search/deep-links can target it, but don't show it as a default tile.

2. **Tile counts** — for each default tile, count = `resolveBrowse(recipes, matchMap, <state with that context, empty refinements/quickFilters/search>).length`, computed in a `useMemo`. Six resolver passes over the loaded set; cheap.

3. **Inroad behavior** — a setup-gated tile whose gate is unmet renders in the inroad style (dashed, muted, CTA arrow) instead of a count, and tapping it navigates to the feature that unlocks it (use the existing cross-stack nav pattern — `navigation.getParent()?.navigate(...)`; read `App.tsx` for exact route names):
   - `ready_to_cook` → PantryScreen ("Track your pantry")
   - `for_your_diet` → DietaryPreferencesScreen ("Set dietary preferences")
   - `friends_cook` → user search / follow ("Follow friends")
   - `your_classics` → clear to all recipes ("Cook a few to build these") — no setup screen exists, so this just drops the user into the full list to start cooking
   A live tile, when tapped, sets `BrowseState.context` to that tile's context.

4. **Cuisine strip** — below the tile grid: a label ("Or by cuisine") + a horizontal, scrollable chip row of available cuisines derived from the loaded recipe set (`recipes[].cuisine_types`), top ~8 by frequency, then a trailing chevron/"More". Tapping a cuisine sets `BrowseState.refinements.cuisineTypes = [cuisine]` (lens = cuisine), context stays `all`.

5. **New home layout** in `RecipeListScreen.tsx`, top to bottom:
   - Header (`Recipes` + `Add recipe`) — unchanged
   - **Search bar relocated to the top** (remove the bottom search bar; keep the existing debounced `searchedRecipeIds` search logic and `searchService` call exactly — only the bar's position changes). Update placeholder to a Tier-2-style hint (e.g. `Try: thai chicken, quick, from molly`).
   - "What are you looking for?" prompt
   - Tile grid (2×3)
   - Cuisine strip
   - Interim controls (the existing `quickFilters` row, `More ›`, `Sort`, book dropdown) — kept as-is for now
   - `All recipes · N` status + the existing list (FlatList, or SectionList when the active context is `your_classics`)

6. **Minimal active-lens chip** — when a context tile or cuisine is active (i.e. the lens is not the default "all"), show a small lens chip above the list reflecting the active lens (tile label, or cuisine name) with a clear control that returns to all recipes **in place** (don't navigate away — per the locked decision, clearing shows all without leaving the screen). Build this as a small `BrowseLensChip` component; CP3 extends it with dismissible refinement chips, dietary pills, and the search-lens case.

7. **Two CP1 cleanups while you're already in the screen:**
   - Fold the duplicate `Recipe` interface in `RecipeListScreen.tsx` into the canonical export from `components/recipe/RecipeCard.tsx` (CP1 left both copies in sync as a flagged hazard). Verify the screen still type-checks against the canonical shape.
   - Convert the `applyFilters` side-effect into a `useMemo` that derives `filteredRecipes` from `browseState` directly, dropping the ESLint `exhaustive-deps` warning CP1 carried forward. Keep behavior identical.

## Explicitly OUT of scope for CP2

- The contextual-facets row, dismissible refinement chips, dietary pills (P11-input-1), and the formalized locked-chip-with-facets — all CP3.
- The FilterDrawer rework into the grouped/range-chip/live-count refine sheet — CP4.
- Card low-stock chips, match-badge integration, WhatCanICook absorption — CP5.
- Do **not** remove the `quickFilters` row, `More ›` drawer, `Sort` dropdown, or book dropdown. They stay (interim).
- Do **not** change `resolveBrowse`'s composition logic or `RecipeCard`. Don't touch `FilterDrawer`, `WhatCanICookScreen`, `searchService`.

## Inputs to read first

- `lib/services/recipeBrowseService.ts` (CP1 output) + CP1's SESSION_LOG entry — the contract you're extending.
- `screens/RecipeListScreen.tsx` (post-CP1 working tree).
- `components/recipe/RecipeCard.tsx` — canonical `Recipe` type.
- `App.tsx` — stack/route names for the inroad cross-tab navigation (Pantry, Dietary preferences, user search).
- `screens/WhatCanICookScreen.tsx` — the ready-to-cook gate it uses (for `ready_to_cook` parity; do not modify it).
- `docs/FRIGO_ARCHITECTURE.md` — conventions + the icon set (use existing SVG icon components for tile icons).

## Constraints

- Tile context predicates live in the `recipeBrowseService` registry (pure); the screen only reads counts/liveness and sets `BrowseState`.
- Reuse the CP1 resolver for counts — do not write parallel filtering logic.
- Search behavior is unchanged except for the bar's screen position.
- `your_classics` must reproduce the existing Cook Again sectioning exactly.
- Never remove existing functionality (the interim controls stay).
- Use existing theme tokens and SVG icons; inroad style = dashed border + muted text + trailing arrow (match the locked wireframe).

## Verification

1. Six tiles render with correct live counts for an established account; counts match what the corresponding filter produced before.
2. On a fresh/empty account: `ready_to_cook`, `for_your_diet`, `friends_cook` (and `your_classics` with no cook history) render as inroads; `quick_tonight` and `recently_added` render live.
3. Each inroad navigates to the right screen; each live tile sets its context and filters the list (and `your_classics` shows the 3 Cook Again sections).
4. Cuisine strip lists real cuisines from the library; tapping one filters to that cuisine and shows the lens chip.
5. The lens chip's clear control returns to all recipes in place (no navigation, no screen reset beyond clearing the lens).
6. Search works from the top bar (single + multi-token); the bottom bar is gone.
7. The interim controls (quick filters, More drawer, Sort, book) still work and still affect the list.
8. Selection mode (recipe picker for meals) still works — header swap, no tiles/search noise that breaks it.
9. Stats drill-down route params still land correctly (now that tiles set context, confirm `initialBrowseMode` etc. still apply via `BrowseState`).

## SESSION_LOG entry format

Append to `docs/SESSION_LOG.md` (canonical per CLAUDE.md — note: the `_SESSION_LOG.md` filename in earlier prompts doesn't exist):

```
### 11A-CP2 — Home rebuild (tiles + cuisine + top search) — <date>

**Shipped:** Tile contexts added to the browse registry; RecipeListScreen home rebuilt with top search, 6-tile grid (conditional + inroad), cuisine strip, and a minimal BrowseLensChip. Segmented control removed; interim quick-filter/More/Sort/book controls retained.

**Files:** modified recipeBrowseService.ts, RecipeListScreen.tsx; added BrowseLensChip component (+ any tile component).

**Key decisions / deviations:** <e.g. friends_cook liveness proxy used; ready_to_cook supply-presence proxy; cuisine strip top-N count; any nav route specifics from App.tsx>

**Verification:** <results against the 9 checks; new-account vs established-account behavior>

**Deferred / notes for CP3:** <interim controls still present; BrowseLensChip to grow facets + dismissible refinement chips + dietary pills + search-lens case; book filter still on the interim row pending its facet home>

**Recommended doc updates:** <phase doc 11A status; FRIGO_ARCHITECTURE if a tile/chip component warrants listing>
```
