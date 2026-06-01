# CC PROMPT — Phase 11 doc creation + 11A doc reconciliation (post-CP4)

> **Mechanical doc edits only — no code changes.** Supersedes `CC_PROMPT_11A_DOC_RECONCILIATION.md` (the earlier version which assumed a Phase 11 doc might already exist — it doesn't). 11A has shipped CP1–CP4 across 2026-05-28; the living docs need to catch up, and Phase 11 needs its own proper phase doc since current references are scattered across the master plan, the Phase 8 doc, and DEFERRED_WORK.

## What you're doing

1. **Create** `docs/PHASE_11_RECIPE_POLISH.md` as a new phase doc — 11A fleshed out, 11B–11H as short skeletons (scope, refs, status only).
2. **Update** the master plan to point at the new Phase 11 doc rather than continuing to host scattered Phase 11 content.
3. **Update** `FRIGO_ARCHITECTURE.md`, `PROJECT_CONTEXT.md`, `DEFERRED_WORK.md` per the changes below.
4. **Stage** the new + updated docs in `_pk_sync/` per the repo-as-canonical workflow.

No code changes. No deletions of existing master-plan content — only additive pointers + the new doc.

## 1. Create `docs/PHASE_11_RECIPE_POLISH.md`

Create this file with the content below verbatim:

```markdown
# Phase 11 — Recipe Polish

Phase 11 absorbs all remaining pre-F&F recipe-system polish work — the browse rebuild, extractor updates, cookbook/cook-soon UX, concept cooking, substitutions v0, and the stretch folders item — into a single phase. Estimated 9–15 sessions (up from the original 7–12 after 8E-CP1/CP3/CP4 absorbed 2026-05-19 per Tom's close-out decision).

By this point the dependent systems (ingredients, pantry, meals, nutrition) are stable, so the recipe-system polish can land without rework.

**Status:** Active. 11A (Browse rebuild) in flight — CP1–CP4 shipped 2026-05-28, CP5 outstanding. Remaining sub-phases (11B–11H) outstanding, not yet scoped.

---

## 11A — Browse rebuild (Recipes screen)

### Goal
Redesign the Recipes browse experience to reduce decision fatigue and improve discoverability without losing capabilities. Replace the three overlapping filter systems (segmented control + quick filters + advanced drawer) with a single coherent model: elevated search + 6 preset tiles + cuisine strip + locked lens chip + contextual facets + reworked refine sheet.

### Locked direction (Direction B + C hybrid; tiles entry pattern; show-all-in-place on clear)
- **Top of screen:** elevated search bar. Search floor for F&F is Tier 1 + Tier 2 (existing token search + rules-based parser); LLM NL search (8E-CP2) deferred post-launch.
- **Six preset tiles (2×3):** Quick tonight · Ready to cook · Recently added · Your classics · For your diet · Friends cook. `something_new` is registered but not a default tile.
- **Conditional + inroad logic:** setup-gated tiles render as inroads when their prerequisite is missing — Ready to cook → Pantry, For your diet → Dietary prefs, Friends cook → User search, Your classics → "cook a few to build these." Inroads navigate to feature setup, doubling as in-context onboarding.
- **Cuisine strip** below the tiles — the one extra lens row that earns its place. No further lens rows.
- **Locked lens chip** for the active context/cuisine/search; `✕` clears in place (no navigation).
- **Dismissible refinement chips** for every applied refinement (auto-applied dietary prefs included — P11-input-1).
- **Contextual facet row** driven by per-context `facets: FacetId[]` data on `BROWSE_CONTEXTS`: 3–4 high-value facets per context with the locked dimension excluded, plus `Sort` and `More`.
- **Refine sheet** (opens from `More ›` or directly anchored from the `cuisine` facet): grouped sections, range chips replace sliders, live "Show N recipes" count, lens-label header, `initialSection` prop.

### Sub-phase spine

| CP | Scope | Status |
|---|---|---|
| 11A-CP1 | Unified browse model — `lib/services/recipeBrowseService.ts` (BrowseState + BROWSE_CONTEXTS + `resolveBrowse` + `getCookAgainSections`), pure non-visual refactor with parity-only acceptance | ✅ Shipped 2026-05-28 |
| 11A-CP2 | Home rebuild — top search, 6-tile grid with conditional/inroad/live counts, cuisine strip, minimal `BrowseLensChip`. CP1 leftovers folded (Recipe type consolidation; `filteredRecipes` → `useMemo`) | ✅ Shipped 2026-05-28 |
| 11A-CP3 | Refine surface — reusable `BrowseLensChip` (lens + refinement variants), dismissible refinement chips, contextual facet row, dietary pills (P11-input-1), `quickFilters` state retired | ✅ Shipped 2026-05-28 |
| 11A-CP4 | RefineSheet rework — `FilterDrawer` → `RefineSheet` rename, grouped sections, range chips replacing sliders, live `previewCount`, lens-label header, `initialSection` anchored opens, orphan style sweep | ✅ Shipped 2026-05-28 |
| 11A-CP5 | Card chips + WhatCanICook absorption — low-stock indicators (8E-CP4), match-badge integration on `RecipeCard`, "Ready to cook" tile absorbs the WhatCanICook surface | Outstanding |

### CP5 open items
- Decision: does `WhatCanICookScreen` survive as a destination (re-skinned with the lens-chip + facet model) or get fully absorbed and removed?
- Low-stock chip surfacing: card-row vs detail-row placement on `RecipeCard`.
- Match-badge integration with the existing `pantry_match` field on `RecipeCard`.

### Carried deferred (post-CP5 / post-F&F)
- **P11A-CP5-deferred-1:** Surface a search-lens label through `BrowseState.activeLens` so the `RefineSheet` header reads `Refine · "<query>"` for search-active opens (CP4 currently falls back to "Refine recipes" in that case).
- Adopt the reusable `BrowseLensChip` on `WhatCanICookScreen` + stats `DrillDownScreen` (post-F&F).
- Tile facet config tuning — defaults are data-driven on `BROWSE_CONTEXTS.facets`, easy to tweak as smoke surfaces preferences.

---

## 11B — Recipe-from-photo extractor update

### Scope
Improvements to the existing photo-extraction pipeline. Specifics TBD when 11B starts; the existing pipeline is functional but flagged for polish in the master plan.

### Inputs / refs
- `lib/services/recipeExtraction/` — current services (`claudeVisionAPI`, `imageProcessor`, `unifiedParser`, `chefService`, `bookService`, `ingredientMatcher`)
- Master plan Phase 11 must-have entry

### Open questions
- What specifically needs updating? Quality, speed, structured-output fields, handwritten edge cases? Defer to planning session.

### Status
Outstanding — not yet scoped.

---

## 11C — Recipe-from-URL extractor update

### Scope
Improvements to the URL-extraction path. Specifics TBD when 11C starts.

### Inputs / refs
- `lib/services/recipeExtraction/webExtractor.ts`
- Master plan Phase 11 must-have entry

### Open questions
- Scope of "update" — defer to planning.

### Status
Outstanding — not yet scoped.

---

## 11D — Cookbook / BookView UX update

### Scope
UX polish on `BookViewScreen` and the cookbook browse experience. Specifics TBD.

### Inputs / refs
- `screens/BookViewScreen.tsx`, `screens/BookDetailScreen.tsx`
- `lib/services/bookViewService.ts`
- Master plan Phase 11 must-have entry

### Open questions
- What specifically feels wrong on the cookbook surfaces? Defer to planning.

### Status
Outstanding — not yet scoped.

---

## 11E — Cook Soon UX update

### Scope
UX polish on `CookSoonScreen` and the cook-soon queue experience. Specifics TBD.

### Inputs / refs
- `screens/CookSoonScreen.tsx`, `components/CookSoonSection.tsx`
- Master plan Phase 11 must-have entry

### Open questions
- TBD at planning.

### Notes
- `components/CookSoonSection.tsx` carries the pre-existing T32 JSX parse error flagged across 11A SESSION_LOG entries. Worth addressing during 11E, or sooner as a small pre-11E cleanup if the noisy `tsc -p` output becomes blocking.

### Status
Outstanding — not yet scoped.

---

## 11F — Concept cooking first-stab (Notion #95)

### Scope
First-cut implementation of "concept cooking" — recipe browsing/planning anchored on a high-level concept (e.g., "I want to make a stew tonight") rather than a specific recipe. Notion item #95. Master plan explicitly scopes this as a *first stab*; full concept cooking remains v2.

### Inputs / refs
- Notion #95
- `DEFERRED_WORK` items R7 (recipe discovery) and R9 (concept cooking inline suggestions)
- Master plan Phase 11 must-have entry

### Open questions
- What does "first stab" include — UI entry point, suggestion data, ranking model?
- Relationship to the 11A browse rebuild — could a "concept" be another lens/context that plugs into `BROWSE_CONTEXTS`?
- Defer to planning.

### Status
Outstanding — not yet scoped.

---

## 11G — Ingredient substitutions v0

### Scope
First version of ingredient substitution suggestions on recipe detail / cook surfaces.

### Inputs / refs
- `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-26.md` — primary planning artifact (a roadmap already exists for this sub-phase)
- `DEFERRED_WORK` item #12 (ingredient alternatives/substitutions)
- Master plan Phase 11 must-have entry

### Open questions
- v0 scope per the substitution roadmap — confirm at 11G planning kickoff.

### Status
Outstanding — substitution roadmap exists; 11G execution not yet scoped against it.

---

## 11H — Recipe folders (stretch)

### Scope
Single-user recipe folders (no sharing) for organizing recipes beyond cookbook attribution. **Stretch goal — first to cut if the Phase 11 calendar tightens.** Per master plan.

### Inputs / refs
- Master plan Phase 11 stretch entry

### Open questions
- Folder data model — tag-style on recipes vs separate folders table + membership join?
- Naming + nesting — flat list or hierarchical?
- Defer to planning only if 11H survives the scope-cut decision.

### Status
Outstanding — stretch only; may be cut from Phase 11.

---

## Post-launch (explicitly deferred from Phase 11)

- **Edit mode redesign** (carries P7-11) — full notebook aesthetic + structural ingredient editing + drag handles + "or" syntax. Banner shipped in Phase 7B-Rev; full redesign explicitly post-launch per master plan.
- **Recipe comments knowledge base** — post-launch per master plan.
- **8E-CP2 (Natural-language search)** — LLM-parsed recipe search. First post-launch ship if Phase 11 exercises the scope-cut lever.

---

## References

- `FF_LAUNCH_MASTER_PLAN_2026-05-27.md` — Phase 11 row + ordering rationale + 8E merge note (this doc supersedes that scattered content)
- `PHASE_8_PANTRY_AND_GROCERY_2026-05-19.md` — 8E retirement section pointing forward to Phase 11
- `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-26.md` — 11G primary planning artifact
- `docs/SESSION_LOG.md` — 11A-CP1 through 11A-CP4 entries (2026-05-28)
- `DEFERRED_WORK.md` — scattered Phase 11 territory items (B2, P11-input-1, etc.)
```

## 2. Update the master plan to point at the new doc

In `docs/FF_LAUNCH_MASTER_PLAN_2026-05-27.md` (or whatever the current master plan filename is), find the Phase 11 section under "Phase Scope Definitions" or the equivalent (where Phase 7 / 7P / 8 / 9 / 10 / 12 each have their scope-definition entries). **Keep the existing Phase 11 row in the phase table and the existing "Why this order" paragraph — do not delete master-plan content.**

If a Phase 11 scope-definition section exists, add at its end:

```
See `docs/PHASE_11_RECIPE_POLISH.md` for the full phase doc (sub-phase spine, 11A status, carried deferred).
```

If no Phase 11 scope-definition section exists yet (other phases have one but Phase 11 was skipped), add a minimal one:

```markdown
### Phase 11: Recipe Polish 🔲

In flight. 11A (Browse rebuild): CP1–CP4 shipped 2026-05-28; CP5 outstanding. Remaining sub-phases 11B–11H outstanding. See `docs/PHASE_11_RECIPE_POLISH.md` for the full phase doc.
```

## 3. Update `docs/FRIGO_ARCHITECTURE.md`

Three additive edits — services list, components list, and a rename. Find sections by header; if structure has drifted, use your judgment for placement but keep the content verbatim.

### 3a. Services list

Add (or update if a stub line exists) under the services / `lib/services/` section:

```
- recipeBrowseService.ts — Pure browse domain model. Owns BrowseState, the BROWSE_CONTEXTS registry (tile + cook-again contexts with base predicates and per-context facets), the facet config layer (FACET_META, CUISINE_LENS_FACETS, SEARCH_LENS_FACETS, isFacetActive, getActiveFacets), the resolver (resolveBrowse), and Cook Again sectioning (getCookAgainSections). No Supabase, no React. Consumer: RecipeListScreen.
```

### 3b. Components — rename and update

Find any line referencing `components/FilterDrawer.tsx` and rename it to `components/RefineSheet.tsx`, replacing the description with:

```
- RefineSheet.tsx (renamed from FilterDrawer in 11A-CP4) — Long-tail refine sheet opened from the More facet or directly anchored from the cuisine facet via initialSection. Grouped sections (Time / Nutrition / Dietary / Cuisine / Vibe / Difficulty / Cooking method / Course / Hero ingredient / Ingredient count / Serving temp / Make-ahead / Social), range chips replacing legacy sliders for the four numeric bounds, live previewCount(draft) result count on Apply, lens-label header. Owns the FilterState type (the refinements shape). Consumer: RecipeListScreen.
```

### 3c. Components — add

Add a new line for `components/recipe/BrowseLensChip.tsx`:

```
- recipe/BrowseLensChip.tsx — Reusable locked-filter chip implementing the 8E-CP3 pattern. API: { label, icon?, count?, variant: 'lens' | 'refinement', onClear }. Lens variant = filled primary, used for the active context / cuisine / search; refinement variant = lighter outline with ✕, used for individual applied refinements. Current consumer: RecipeListScreen. Future consumers (post-F&F): WhatCanICookScreen, DrillDownScreen.
```

### 3d. Phase 11A status line

If FRIGO_ARCHITECTURE carries a phase-status note anywhere, add or update:

```
Phase 11A (Browse rebuild): CP1–CP4 shipped 2026-05-28; CP5 (cards + WhatCanICook absorption) outstanding. See docs/PHASE_11_RECIPE_POLISH.md for the full phase doc.
```

## 4. Update `docs/PROJECT_CONTEXT.md`

Find the current-phase status line/section and update the Phase 11 entry to:

```
Phase 11 (Recipe Polish) — Active. 11A (Browse rebuild): CP1–CP4 shipped 2026-05-28 (foundational model, home tiles + cuisine, refine surface, refine sheet). CP5 (card low-stock chips + WhatCanICook absorption) outstanding. Remaining Phase 11 sub-phases (11B–11H: extractors, cookbook UX, cook soon UX, concept cooking, substitutions v0, folders stretch) outstanding, not yet scoped. See docs/PHASE_11_RECIPE_POLISH.md.
```

## 5. Update `docs/DEFERRED_WORK.md`

Add a single new entry under the Phase 11 section (create the section if needed):

```
- **P11A-CP5-deferred-1 — Search-lens label.** CP2's activeLens shape doesn't surface a search label, so opening the RefineSheet during an active search shows "Refine recipes" rather than "Refine · '<query>'". Extend BrowseState.activeLens to carry a search-lens variant and update refineLensLabel in RecipeListScreen to read it. Touched code: lib/services/recipeBrowseService.ts, screens/RecipeListScreen.tsx. Low priority — cosmetic header improvement.
```

## 6. Stage in `_pk_sync/`

After applying the above:

1. Create `_pk_sync/` at the repo root if it doesn't exist.
2. Copy the five updated/new docs into `_pk_sync/`:
   - `PHASE_11_RECIPE_POLISH.md` (new)
   - `FF_LAUNCH_MASTER_PLAN_2026-05-27.md` (updated — confirm the actual current filename; could carry a newer date suffix)
   - `FRIGO_ARCHITECTURE.md` (updated)
   - `PROJECT_CONTEXT.md` (updated — confirm the actual current filename)
   - `DEFERRED_WORK.md` (updated — confirm the actual current filename)

## Verification

- `git status` shows the new Phase 11 doc + the four updated docs, nothing else.
- `ls _pk_sync/` shows all five files staged for upload.
- No code files modified.
- Phase 11 doc contains all eight sub-phases (11A fleshed out; 11B–11H skeletal), the Post-launch section, the Phase-wide carried deferred from 11A, and the References block.
- Master plan still contains its original Phase 11 row + "Why this order" paragraph, with the new pointer added (no master-plan content removed).

## SESSION_LOG entry

Append to `docs/SESSION_LOG.md`:

```
### 2026-05-28 — Phase 11 doc creation + 11A doc reconciliation (post-CP4)

**Shipped:** New `docs/PHASE_11_RECIPE_POLISH.md` created — 11A fleshed out (locked direction, CP1–CP5 spine with CP1–CP4 marked shipped, CP5 open items, carried deferred); 11B–11H skeletal placeholders (scope, refs, status only); post-launch + phase-wide deferred + references blocks. Master plan gained a pointer at the Phase 11 scope-definition section. FRIGO_ARCHITECTURE bumped for recipeBrowseService, RefineSheet (renamed from FilterDrawer), and BrowseLensChip (reusable locked-filter chip pattern). PROJECT_CONTEXT Phase 11 status line updated. DEFERRED_WORK gained P11A-CP5-deferred-1 (search-lens label). All five updated/new docs staged in _pk_sync/.

**Files:** new docs/PHASE_11_RECIPE_POLISH.md; modified the master plan (confirm filename — likely FF_LAUNCH_MASTER_PLAN_2026-05-27.md), docs/FRIGO_ARCHITECTURE.md, docs/PROJECT_CONTEXT.md, docs/DEFERRED_WORK.md. Copies staged in _pk_sync/.

**Notes:** No code changes. PK code snapshot for screens/RecipeListScreen.tsx is now ~1450 lines added / ~1000 removed across CP1–CP4 vs the 2026-05-19 baseline; refresh recommended after CP5 ships.
```
