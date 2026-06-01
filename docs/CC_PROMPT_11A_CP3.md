# CC PROMPT — 11A-CP3: Refine surface (locked lens chip + contextual facets + dismissible chips)

> **Depends on 11A-CP1 (shipped) and 11A-CP2 (verify before running).** Assumes CP2's outputs: the `BrowseLensChip` component, the tile contexts in `BROWSE_CONTEXTS`, the cuisine lens (`refinements.cuisineTypes` set from the cuisine strip), and the rebuilt home. **Reconcile against CP2's SESSION_LOG** and adjust names/shapes if CP2 deviated. Run CP3 only after CP2 has shipped and smoke-passed.

## Context

This is the CP that **collapses the three overlapping filter systems into one.** CP2 kept the legacy refine controls as an interim layer — the `quickFilters` chip row, the standalone `Sort` dropdown, the book dropdown, and the 10F "From your dietary preferences" text indicator. CP3 removes all of them and replaces them with a single refine surface, built on the locked decision (Direction B + C):

- A **locked lens chip** for the active context/cuisine/search, with clear → show all in place.
- A row of **dismissible refinement chips** (every active refinement, including auto-applied dietary prefs).
- A row of **contextual facets** — 3–4 high-value toggles/pickers per context, with the dimension the context already locks excluded — plus `Sort` and `More`.
- `More` opens the existing FilterDrawer **unchanged** (its rework is CP4).

After CP3, `BrowseState` is the single source of truth: `context` + `refinements` + `searchedRecipeIds` + `sort`. The `quickFilters` state and its resolver branch are gone (those four toggles become refinements/facets).

## What you're building

1. **Formalize the reusable locked-filter chip.** Extend CP2's `BrowseLensChip` into the reusable component the master plan calls for (8E-CP3 "locked filter chips pattern"): a clean API — `{ label, icon?, count?, variant: 'lens' | 'refinement', onClear }`. `lens` variant = the primary active context/cuisine/search (filled, `onClear` shows all in place); `refinement` variant = a single applied refinement (lighter, `onClear` removes just that one). Wire it into RecipeListScreen now. (Do **not** refactor WhatCanICook / stats DrillDown to adopt it yet — that's a later/post-F&F pass; just give it the reusable API.)

2. **The refine surface** above the list, top to bottom:
   - The **lens chip** (`lens` variant) when a context/cuisine/search is active. No chip when the lens is plain "all".
   - A wrapping row of **active refinement chips** (`refinement` variant, dismissible) — one per applied refinement, including dietary flags auto-applied from 10F prefs and anything applied via the More sheet.
   - The **contextual facet row**: the context's configured facets (inactive ones as plain chips, active ones rendered as the dismissible refinement chips above — don't double-render), then `Sort ▾` and `More`.

3. **Facet mechanism, config-driven.** Add a per-context `facets: FacetId[]` to the `BROWSE_CONTEXTS` registry and a facet definition map (`FacetId → { label, kind, apply }`). Facet kinds:
   - **toggle** (instant): `vegetarian`, `high_protein`, `one_pot`, `quick` — flip a refinement on/off.
   - **picker** (opens an existing modal): `cuisine` (multi-select), `cookbook` (the existing book-picker modal → `selectedBook`), `sort` (the existing sort-picker modal).
   The facet row always appends `sort` and `More`. Starting config (tunable — this is content, not logic; Tom will refine):

   | Context | Default facets (locked dimension excluded) |
   |---|---|
   | `all` | cuisine, quick, vegetarian, cookbook |
   | `quick_tonight` | vegetarian, high_protein, cuisine |
   | `ready_to_cook` | quick, cuisine, one_pot |
   | `recently_added` | cuisine, quick, vegetarian |
   | `your_classics` | quick, cuisine |
   | `for_your_diet` | quick, high_protein, cuisine |
   | `friends_cook` | cuisine, quick |
   | cuisine lens | quick, vegetarian, cookbook |
   | search lens | quick, vegetarian, cuisine |

4. **Retire `quickFilters` → refinements.** Remove the `quickFilters` state, the interim quick-filter chip row, and the resolver's quick-filter branch. The four semantics become facet-driven refinements: `vegetarian` → `dietaryFlags.is_vegetarian`; `high_protein` → `minProteinPerServing = 25`; `comfort` → `vibeTags: ['comfort']` (available via More/vibe, not a default facet); **`quick` must preserve the old `quick30` predicate exactly** — the 3-way OR (`total_time_min ≤30 OR active_time_min ≤30 OR prep+cook ≤30`), NOT a naive `maxTotalTime = 30`. Implement `quick` as its own facet predicate, not a slider mapping.

5. **Dietary pills (P11-input-1).** Remove the 10F text indicator + its "Show all" link. Active dietary flags (whether auto-applied from prefs or set via More) now render as dismissible refinement chips. Preserve the auto-apply behavior (prefs still seed `refinements.dietaryFlags` on load) and the existing semantic that clearing a dietary chip this session does **not** change the saved preferences.

6. **Relocate Sort and Cookbook.** Remove the standalone `Sort` button and the standalone book dropdown. `Sort` becomes the `sort` facet (opens the existing sort-picker modal — keep the modal). `Cookbook` becomes the `cookbook` facet (opens the existing book-picker modal, sets `selectedBook` — keep the modal). Book filtering must remain fully reachable; it just moves into the facet row.

7. **Update `getActiveFilterCount` and `clearAllFilters`** to the unified model (no `quickFilters` references; count = active refinements; clear = reset refinements + lens to all, in place).

## Explicitly OUT of scope for CP3

- The FilterDrawer internal rework (grouping, range chips replacing sliders, live count) — that's CP4. `More` opens the **current** FilterDrawer unchanged.
- Card low-stock chips, match-badge integration, WhatCanICook absorption — CP5.
- Adopting the reusable locked-chip component in WhatCanICook / stats DrillDown — later pass.
- Don't change `resolveBrowse`'s refinement/sort logic beyond removing the now-dead `quickFilters` branch.

## Inputs to read first

- `lib/services/recipeBrowseService.ts` + `screens/RecipeListScreen.tsx` (post-CP2 working tree) + CP2's SESSION_LOG.
- The CP2 `BrowseLensChip` component.
- `components/FilterDrawer.tsx` — the `More` target (read only; the active refinements you render as chips come from this same `FilterState`).
- The existing sort-picker and book-picker modal code in RecipeListScreen (you're keeping these, re-triggering from facets).
- `docs/FRIGO_ARCHITECTURE.md` — conventions + icons.

## Constraints

- **Never lose a capability.** Every function of the removed interim controls (4 quick filters, sort, book, dietary indicator) must remain reachable — through facets, chips, or More.
- The `quick` facet must reproduce the old `quick30` result set exactly (3-way OR).
- Dietary auto-apply behavior and "clearing doesn't touch saved prefs" must be preserved.
- Facet config is **data on the registry**, not hardcoded in the render — so Tom can tune the per-context sets without touching render logic.
- One source of truth: after CP3 there is no `quickFilters` state; all filtering flows through `BrowseState.refinements` (+ context + search + sort).
- Match existing theme tokens and icons; chip styling per the locked wireframe (lens = filled/primary; refinement = lighter with ✕).

## Verification

1. Each context renders its configured facets with the locked dimension excluded; `Sort` and `More` always present.
2. Toggling a facet filters instantly and surfaces a dismissible chip; clearing the chip removes just that refinement.
3. The `quick` facet returns the same set the old "Under 30m" quick filter did (spot-check a few recipes that qualify via active-time or prep+cook but not total-time).
4. Dietary prefs auto-apply as dismissible chips; removing one filters live but leaves saved prefs unchanged; the old text indicator is gone.
5. `Sort` facet opens the existing picker and sorts identically; `Cookbook` facet opens the existing book picker and filters by book identically.
6. `More` opens the unchanged FilterDrawer; applying filters there shows them as chips in the row.
7. The lens chip's clear shows all in place (no navigation/reset beyond clearing context+refinements).
8. The interim quick-filter row, standalone Sort button, book dropdown, and dietary text indicator are all gone; nothing is unreachable.
9. `getActiveFilterCount` / `clearAllFilters` behave correctly with no `quickFilters` references.
10. Resolver smoke test still green after the quick-filter-branch removal (update the test's quick-filter assertions to the facet/refinement equivalents).

## SESSION_LOG entry format

Append to `docs/SESSION_LOG.md` (canonical per CLAUDE.md):

```
### 11A-CP3 — Refine surface (locked lens chip + contextual facets) — <date>

**Shipped:** Single refine surface replacing the interim controls — reusable locked-filter chip, dismissible refinement chips (incl. P11-input-1 dietary pills), config-driven contextual facets per context, Sort + Cookbook relocated to facets, More → unchanged FilterDrawer. quickFilters state + resolver branch removed; BrowseState is now the single filter source of truth.

**Files:** modified recipeBrowseService.ts (facet config on registry, quickFilters branch removed), RecipeListScreen.tsx, BrowseLensChip → reusable locked-filter chip, __recipeBrowseResolverTest.ts (quick-filter assertions migrated).

**Key decisions / deviations:** <quick facet predicate preservation; facet-config defaults used; how dietary auto-apply chips handle saved prefs; any facet-set choices that differ from the prompt table>

**Verification:** <results against the 10 checks; resolver test status>

**Deferred / notes for CP4:** <More still opens the unchanged FilterDrawer; CP4 reworks it into grouped/range-chip/live-count and can render inside this same surface>

**Recommended doc updates:** <phase doc 11A status; FRIGO_ARCHITECTURE — reusable locked-filter chip component + facet-config note>
```
