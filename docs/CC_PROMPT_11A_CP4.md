# CC PROMPT — 11A-CP4: Refine sheet rework (FilterDrawer → grouped + range chips + live count + cuisine shortcut)

> **Depends on 11A-CP3 (verify before running).** Assumes CP3's refine surface: dismissible refinement chips + contextual facet row + the reusable `BrowseLensChip`, with `More ›` and the `cuisine` facet both currently pointing at the unchanged `FilterDrawer`. **Reconcile against CP3's SESSION_LOG** before running, and only run CP4 after CP3 has cleared its Expo smoke.

## Context

CP3 shipped the refine surface that lives *above* the list. CP4 reworks the long-tail refinement UI that lives *behind* `More ›`: the current `FilterDrawer` becomes the **refine sheet** (Direction C in the locked wireframe). The key changes:

- **Grouped sections** (drop the "Advanced" collapse) so refinements are clearly organized rather than buried.
- **Range chips replace sliders** for the four numeric dimensions (calories max, protein min, active time, total time) — sliders are mobile-hostile and we agreed back at Direction B+C lock to swap them.
- **Live result count** on the Apply button — "Show N recipes" updates as the user toggles draft refinements, so they can see what they're narrowing toward.
- **Cuisine picker shortcut** — CP3's `cuisine` facet currently opens the full drawer as a stopgap; CP4 lets the facet open the sheet *anchored at the Cuisine section* so picking a cuisine doesn't require scrolling past everything else.

After CP4, the refine model is complete: lens chip + refinement chips + facet row (CP3) + reworked refine sheet (CP4). CP5 then handles cards.

## What you're building

1. **Rename + rework `components/FilterDrawer.tsx` → `components/RefineSheet.tsx`.** Rename the file, the default export, and update the import in `screens/RecipeListScreen.tsx`. **Keep the `FilterState` type name** — it's the refinements shape, still continues to live in this file, and is imported by `recipeBrowseService.ts` and the resolver; renaming it ripples too far.

2. **Header.** "Refine · `<lensLabel>`" + ✕. Add a `lensLabel?: string` prop the parent passes when a context/cuisine/search lens is active (e.g., "Quick tonight" / "Thai" / `"chicken"`); fall back to "Refine recipes" when no lens. This makes the sheet read as a refinement *of the current subset* rather than a generic filter modal.

3. **Range chips replace the four sliders:**

   | Dimension | Chips | Sets |
   |---|---|---|
   | Time (Active) | `≤15m / ≤30m / ≤45m / ≤60m` | `maxActiveTime` |
   | Time (Total)  | `≤30m / ≤60m / ≤90m / ≤2h`   | `maxTotalTime` |
   | Calories max  | `≤300 / ≤500 / ≤750`         | `maxCaloriesPerServing` |
   | Protein min   | `20g+ / 30g+ / 40g+`         | `minProteinPerServing` |

   Chips are mutually exclusive within a dimension. Tapping the active chip clears the bound (`undefined`). Tapping a different chip replaces. No explicit "Any" chip needed — *unselected = any*.

4. **Live result count on the Apply button.** Render "Show N recipes" where N updates whenever `localFilters` changes. Implement via a `previewCount: (draftRefinements: Partial<FilterState>) => number` prop the parent provides. The parent computes it as `resolveBrowse(recipes, matchMap, { ...currentBrowseState, refinements: draft }).length` — so N reflects the **full pipeline** (active context + search + draft refinements), not refinements in isolation. The resolver is cheap (~475 recipes); no debounce needed unless flicker shows up in testing.

5. **Grouping + section order** (top → bottom, no global "Advanced" collapse):
   Time → Nutrition → Dietary → Cuisine → Vibe → Difficulty (+ easier-than-looks) → Cooking method → Course → Hero ingredient → Ingredient count → Serving temp → Make-ahead → Social.

   Use clean section headers (existing `sectionTitle` style) and dividers. The user opened the sheet intentionally; the depth is the point.

6. **Cuisine picker shortcut.** Add an optional `initialSection?: SectionId` prop. When the sheet opens with `initialSection='cuisine'`, anchor/scroll the Cuisine section into view on mount. Wire this in `RecipeListScreen.tsx`: the `cuisine` facet now opens `RefineSheet` with `initialSection='cuisine'` (replaces the CP3 stopgap); `More ›` opens from the top. `SectionId` is the union of group ids; expose it from the sheet file.

7. **Orphaned style sweep in `RecipeListScreen.tsx`.** CP3's deferred list flagged several dead styles. Remove anything no longer referenced after CP3: `bookFilterContainer`, `bookFilterButton`, `dietaryPrefIndicator`, `dietaryPrefIndicatorIcon`, `dietaryPrefIndicatorText`, `dietaryPrefShowAll`, `quickFiltersContainer`, and any other dead style. **Verify each is genuinely unused before deleting** (grep the file for the style key).

8. **The four facet-only refinements stay facet-only.** `quickUnder30`, `onePotOnly` (added in CP3 to `FilterState`), and the `vegetarian` / `high_protein` shortcut semantics live only on the facet row. They get **no UI in the refine sheet** — they're shortcuts to existing dimensions (dietary, protein, time), and surfacing them in the sheet would double-represent the same thing the dietary chips / range chips already cover.

## Explicitly OUT of scope

- Card low-stock chips, match-badge integration, WhatCanICook absorption — CP5.
- Adopting the reusable `BrowseLensChip` in WhatCanICook / stats DrillDown — post-F&F.
- Don't change `resolveBrowse`, `BROWSE_CONTEXTS`, the facet config, or the chip components — CP3 finalized those.
- Don't touch the existing sort-picker modal or the book-picker modal — they're still triggered from their facets and need no rework.

## Inputs to read first

- `components/FilterDrawer.tsx` (current state, post-CP3) — the file being reworked
- `lib/services/recipeBrowseService.ts` (post-CP3) — `resolveBrowse` signature for `previewCount`, the `FilterState` type
- `screens/RecipeListScreen.tsx` (post-CP3) — where `previewCount` gets wired, where the cuisine-facet target swaps, and where the orphaned styles live
- CP3's SESSION_LOG — confirm names/types match before editing

## Constraints

- **Never lose a capability.** Every dimension currently in `FilterDrawer` (all 14 + the dietary 8) remains reachable in `RefineSheet`. The chip/switch UIs that work today carry over; only the four sliders get the range-chip treatment.
- Multi-select stays multi-select for the multi-select dimensions (Cuisine, Vibe, Cooking method, Course, Difficulty, Ingredient count, Serving temp, Hero ingredient suggestions).
- `FilterState` type name preserved.
- Live count reflects the **full pipeline** (context + search + draft refinements).
- Range chips: tapping the active chip clears; mutually exclusive within a dimension.
- Match existing theme tokens; chip visual matches the facet/refinement chip styling for consistency across the refine surface.

## Verification

1. Every `FilterState` dimension is reachable in `RefineSheet` and applying via Apply writes through to `advancedFilters`.
2. The four range-chip dimensions reproduce the same filtered results the sliders did — spot-check at boundary values (e.g., a recipe at exactly 30 active min should be included by `≤30m`, excluded by `≤15m`).
3. Range chips clear/replace correctly; "no chip selected" = unbounded.
4. Live count "Show N recipes" updates as draft refinements toggle; N after Apply matches the resulting list length exactly.
5. Cuisine facet → sheet opens with Cuisine section visible/anchored at top; `More ›` → opens from the top.
6. Lens label appears in the header when a context/cuisine/search is active; falls back to "Refine recipes" otherwise.
7. 10F dietary auto-apply still seeds correctly; the seeded flags show as selected chips in the Dietary section when the sheet opens.
8. Orphaned styles removed; screen renders identically (no layout shift).
9. Resolver smoke test still 45 ✅ — no resolver changes, just confirming nothing was disturbed.
10. Type-check clean on `RefineSheet.tsx`, `recipeBrowseService.ts`, and `RecipeListScreen.tsx` in isolation.

## SESSION_LOG entry format

Append to `docs/SESSION_LOG.md`:

```
### 11A-CP4 — Refine sheet rework (FilterDrawer → RefineSheet) — <date>

**Shipped:** FilterDrawer reworked into RefineSheet — grouped sections (no Advanced collapse), range chips replacing the four sliders, live "Show N recipes" count on Apply, lens-label header, cuisine-anchored open via initialSection. Cuisine facet now opens the sheet anchored at Cuisine (CP3 stopgap retired). Orphaned styles from CP1–CP3 swept from RecipeListScreen.

**Files:** renamed components/FilterDrawer.tsx → components/RefineSheet.tsx (default export + file rename); modified screens/RecipeListScreen.tsx (import update, previewCount wiring, cuisine-facet target swap, style sweep). FilterState stays in the same module under the same name.

**Key decisions / deviations:** <range-chip preset choices; how initialSection anchors (scrollIntoView vs onLayout vs section state); previewCount implementation; any sections that earned collapsing for size; anything the boundary-value spot-checks surfaced>

**Verification:** <results against the 10 checks; resolver smoke 45 ✅ status; type-check status; orphaned-style sweep list>

**Deferred / notes for CP5:** <none expected — the refine model is complete after CP4>

**Recommended doc updates:** <FRIGO_ARCHITECTURE — FilterDrawer → RefineSheet rename in the components list; phase doc 11A status CP4 shipped>
```
