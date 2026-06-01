# CC PROMPT — 11A-CP5a: Mode split (discovery vs list)

> **Depends on 11A-CP1–CP4 (all shipped 2026-05-28).** Continues 11A with the corrective mode split that came out of Tom's smoke pass on CP4 — the screen accumulated too much chrome and the recipe list lost room to breathe. CP5b (card chips + WhatCanICook absorption) follows once CP5a smokes clean.

## Context

CP1–CP4 built the unified browse model, tile grid, refine surface (chips + facet row), and the refine sheet. The result, after smoking in Expo: too much vertical chrome stacked above the recipe list — header → search → prompt → tiles → cuisine strip → refinement chips → facet row → status bar → *then* a recipe card. Six sections before any recipe.

CP5a fixes this by splitting the screen into **two explicit states**:

- **Mode A — Home / discovery.** Tiles only (plus search and a "Browse all" link). No list, no refinement chips, no facet row, no cuisine strip, no status bar.
- **Mode B — List view.** Tiles gone. One compressed filter line (lens chip + dismissible refinement chips + "Refine" button) above the recipe list. The list gets the screen.

Most of CP3 and CP4's work is preserved — only relocated:

- `BrowseLensChip` (CP3): preserved, central to the Mode B filter line.
- `RefineSheet` (CP4): preserved, gets one addition — a "Quick refine" section at the very top with the per-context facets as one-tap toggles (relocated from the persistent row).
- `recipeBrowseService` (CP1) + facet config layer (CP3): fully preserved.
- `quickFilters` retirement, FilterState shape, dietary auto-apply seeding semantics: all preserved.

What goes away: the persistent facet row above the list, the cuisine strip on home, the "X you can make now" tap-through in the status bar (Ready to cook tile is the entry now), and most of the multi-row chrome stack.

## What you're building

1. **Screen-mode state.** Add `screenMode: 'home' | 'list'` as explicit UI state in `RecipeListScreen.tsx`. Not derived — explicit, because "Browse all 475" needs a way to be in Mode B with `context='all'`, which derivation from context alone can't express. Initial value: `'home'`.

2. **Mode A — Home / discovery.** When `screenMode === 'home'`, render top to bottom:
   - Header (`Recipes` + `Add recipe`) — unchanged
   - Search bar — unchanged (same elevated bar, same debounce, same `searchService` call)
   - "What are you looking for?" prompt — unchanged
   - 6-tile grid — unchanged from CP2 (conditional + inroad + counts)
   - **NEW:** "Browse all `<N>` →" link below the tiles, right-aligned, small. Tapping it transitions to Mode B with `context='all'`, no other state changes.

   Do NOT render in Mode A: the cuisine strip, refinement chips row, facet row, status bar text, recipe list. Those all belong to Mode B.

3. **Mode B — List.** When `screenMode === 'list'`, render top to bottom:
   - Header — unchanged
   - **One filter line**, single horizontal row (wraps if it overflows):
     - **Lens chip** (always present, leftmost) — uses `BrowseLensChip` with `variant='lens'`. Label varies by what put us in Mode B:
       - Tile context: the tile label (e.g., `Quick tonight`)
       - Search active: `"<query>"` (e.g., `"chicken"`)
       - Browse all: `All recipes`
     - **Refinement chips** — every applied refinement renders as `BrowseLensChip` with `variant='refinement'`. This includes auto-applied dietary flags (P11-input-1, preserved from CP3) and any refinements set via the Refine sheet (cuisine, time bounds, etc.).
     - **Refine button** (right-aligned at the line's end) — small chip-styled control with the adjustments icon and label `Refine`. Tapping it opens `RefineSheet`.
   - **Small status text** below the chip line: `"<N> recipes"` (e.g., `"42 recipes"`). Drop the previous "Y you can make now" segment — that affordance is the Ready to cook tile now (which CP5b will formalize as the WhatCanICook absorption).
   - Recipe list — `FlatList`, or `SectionList` when `context === 'your_classics'` (the cook_again sectioned variant is preserved).

   Do NOT render in Mode B: the tile grid, the cuisine strip, the "What are you looking for?" prompt, the prior persistent facet row.

4. **Transitions.**
   - Tap a tile → `screenMode='list'`, `context=<tile>`, lens label = tile label
   - Tap "Browse all" → `screenMode='list'`, `context='all'`, lens label = "All recipes"
   - Submit a search (from Mode A's search bar) → `screenMode='list'`, `searchedRecipeIds` set, lens label = `"<query>"`
   - Stats drill-down route params (`initialBrowseMode`, `initialCuisine`, `initialIngredient`, etc.) → `screenMode='list'`, BrowseState populated as today
   - **Lens chip `✕` (in Mode B) → `screenMode='home'`**, reset: `context='all'`, clear all refinements EXCEPT auto-applied dietary (let the auto-apply effect re-seed naturally), clear search (`searchedRecipeIds=null`), clear `selectedBook`. **This supersedes the prior "show all in place" decision** — with the mode split, returning to discovery is the cleaner semantic.

5. **Relocate the contextual facets into the Refine sheet.** The per-context facets that CP3 rendered as a persistent row (e.g. `Under 30m`, `Vegetarian`, `Cookbook ▾` for the `quick_tonight` context) become a **"Quick refine" section** at the very top of `RefineSheet`'s scrollable content — above `Time / Nutrition / Dietary / …`. Render them as one-tap toggle chips using the same `FACET_META`, `getActiveFacets`, `isFacetActive` plumbing that exists today. Tapping a facet toggles its refinement in `localFilters` exactly as the persistent row did. The `cuisine` and `cookbook` picker facets in this section retain their existing modal-opening behavior. **The facet data and behavior are unchanged — only the location moves.**

6. **Auto-applied dietary stays silent on Mode A.** Preserve the existing CP3 auto-apply effect (`userDietaryPrefs` → `advancedFilters.dietaryFlags`). On Mode A, the tile counts already respect the auto-applied flags (since `resolveBrowse` runs over the full `BrowseState`), so the user sees correct counts without any visible chip on home. On entering Mode B (via tile/search/Browse all), the auto-applied dietary refinements appear in the chip line alongside any user-set refinements, just as today. Removing a dietary chip in Mode B still does not write back to `userDietaryPrefs` — that semantic is preserved.

## Explicitly OUT of scope for CP5a (these belong to CP5b)

- `RecipeCard` changes — low-stock chips, match-badge integration.
- `WhatCanICookScreen` removal and the absorbed `ready_to_cook` lens.
- `PantryScreen` "What can I cook?" CTA redirection.
- Pantry-match threshold refinement (`50%+ / 75%+ / 90%+ / Any`) — that's the WhatCanICook preservation, lands in CP5b.
- The status bar's previous "Y you can make now" tap-through is *gone* in CP5a; CP5b decides if/how it surfaces in the new model.

## Inputs to read first

- `screens/RecipeListScreen.tsx` (post-CP4 working tree) — the screen being restructured.
- `components/recipe/BrowseLensChip.tsx` (CP3 reusable chip) — used to render every chip in the Mode B filter line.
- `components/RefineSheet.tsx` (post-CP4) — gets the new "Quick refine" section at the top of its scrollable content.
- `lib/services/recipeBrowseService.ts` (post-CP3/CP4) — `getActiveFacets`, `isFacetActive`, `FACET_META`. No service changes in CP5a.
- CP4's SESSION_LOG entry for the `initialSection`/`previewCount`/`refineLensLabel` wiring.

## Constraints

- **Never lose a capability.** Every refinement reachable today must remain reachable: contextual facets via the sheet's "Quick refine" section, full dimensions via the rest of the sheet, cuisine via the existing `initialSection='cuisine'` shortcut from inside the sheet.
- `BrowseLensChip`, `FilterState`, `BROWSE_CONTEXTS`, the resolver, the facet config — no changes. Only their orchestration in `RecipeListScreen` changes.
- The auto-apply dietary semantic from CP3 is preserved (silent on Mode A, chip in Mode B, clearing doesn't touch saved prefs).
- The cook_again sectioning under the `your_classics` context is preserved — `SectionList` still used for that context.
- Stats drill-down route params still land correctly — they should set `screenMode='list'` along with the BrowseState they configure.
- Selection mode (recipe picker from MyMealsScreen) is unaffected — it bypasses the mode-split UI entirely (the existing `isSelectionMode` gates keep the picker layout).
- No code in `recipeBrowseService.ts` should change.

## Verification

1. **Mode A renders cleanly:** header + search + prompt + 6 tiles + "Browse all `<N>` →" link. No other chrome. Visibly more breathing room than CP4.
2. **Mode B renders cleanly:** header + one filter line + status text + list. Visibly more recipe space than the CP4 screenshot.
3. **Tile tap** → Mode B with the correct lens label; list filters correctly; `your_classics` shows the three Cook Again sections.
4. **Browse all tap** → Mode B with lens label `"All recipes"`; full library shown; `✕` returns to Mode A.
5. **Search submit** → Mode B with lens label = the query string; results filter correctly; `✕` clears search and returns to Mode A.
6. **Lens chip `✕` in Mode B** → returns to Mode A; refinements clear (except auto-dietary re-seeds); context resets to `'all'`; search clears.
7. **Refine sheet's "Quick refine" section** at top: contextual facets for the active context (or cuisine/search lens) appear as toggle chips; tapping one toggles the refinement and surfaces a chip in the Mode B filter line.
8. **Stats drill-downs** still land correctly — e.g., Stats → Cuisine podium → See all should arrive at Mode B with `context='something_new'`, `cuisineTypes` set, and the lens chip showing `Something new`, with cuisine as a refinement chip beside it.
9. **Auto-apply dietary** still seeds on load; Mode A shows no dietary chip but tile counts reflect the flags; opening Mode B shows the dietary chip(s) in the filter line.
10. **Selection mode** (from MyMealsScreen → Select recipe) still works — header swap, no mode-split UI noise.
11. **Resolver smoke test** still 45 ✅ (no service changes; defensive re-run).
12. **Type-check clean** on `RecipeListScreen.tsx` and `RefineSheet.tsx`.

## SESSION_LOG entry format

Append to `docs/SESSION_LOG.md`:

```
### 11A-CP5a — Mode split (discovery vs list) — <date>

**Shipped:** Recipes screen split into Mode A (home / discovery — tiles + search + Browse all) and Mode B (list — one filter line + recipes). Persistent facet row removed; contextual facets relocated into a new "Quick refine" section at the top of RefineSheet content. Cuisine strip removed from home. Lens chip ✕ now returns to Mode A (supersedes the prior "show all in place" decision). The "X you can make now" status-bar link is removed; the Ready to cook tile is the entry. BrowseLensChip, RefineSheet, recipeBrowseService all unchanged in code.

**Files:** modified screens/RecipeListScreen.tsx, components/RefineSheet.tsx (Quick refine section added at top of scrollable content). Service module + smoke test unchanged.

**Key decisions / deviations:** <screenMode explicit state vs derivation; how the Quick refine section anchors with initialSection; how the Mode B status text renders; anything about the Browse all label/positioning that needed judgment>

**Verification:** <results against the 12 checks; resolver smoke 45 ✅ status; type-check status>

**Deferred / notes for CP5b:** <RecipeCard low-stock chips, match-badge integration, WhatCanICook screen removal, ready_to_cook pantry-match threshold refinement, PantryScreen "What can I cook?" CTA redirect, decision on whether "X you can make now" returns in some form>

**Recommended doc updates:** <phase doc 11A status — CP5a shipped; PHASE_11_RECIPE_POLISH.md sub-phase spine; FRIGO_ARCHITECTURE if the mode-state pattern warrants a note>
```
