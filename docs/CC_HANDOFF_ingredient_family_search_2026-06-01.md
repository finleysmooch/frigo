# CC Handoff — Ingredient Family Search

**Date:** 2026-06-01
**Author:** Claude.ai (planning) — strategic pass over CC's `Ingredient Taxonomy Refinement` draft
**Status:** Decisions LOCKED with Tom. Ready to execute (recon → review → execute).

---

## DECISION RECORD — for PHASE_11_RECIPE_POLISH.md

> Append this block to the active phase doc. Mark CC's `Ingredient Taxonomy Refinement` draft as **APPROVED — superseded by this record** (it was directionally right; this record corrects the forward-drift framing and adds the search-architecture decision).

### Architecture principle: one home, many doors
`ingredient_type` stays **single-valued**. It is the classification used for *grouping/display* (pantry aisles, stats pills, icons) — where a single answer is correct, and where multi-membership would render an item twice and break the `===` filter + icon lookups. Multi-membership ("spaghetti is also a noodle") lives in the **search layer only**, never in the classification. Two search doors:
- **Synonym map** — curated query-time term expansion. Ships now. No schema change.
- **`search_aliases text[]` on `ingredients`** — matched in search, ignored by grouping. **Post-launch fast-follow.** Follows the existing `measurement_units.aliases` pattern.

### Scope locked
- Split `Grains` → **`Pasta`**, **`Rice`**, **`Grains`**.
- Split `Seafood` → **`Fish`**, **`Shellfish`**.
- `Chiles & Peppers` split **DEFERRED** — the fresh-vs-dried ambiguity (produce vs spice) is better expressed via the existing `form` column. Revisit post-launch.
- Asian noodles get their **own home** — a `Noodles` type if the bucket warrants it, else stay under `Rice` if rice-based — **decided per-row at the classify-script review gate.**
- Add icons for the new types **and** the 4 orphan types currently falling back to 📦: **Wines & Spirits, Coffee & Tea, Stocks & Broths, Beverages.**

### Search
- **Path C** — add an `ingredient_type` substring match to the existing `.or()` in `searchRecipesByIngredient`. **Type-only, NOT `family`,** for v1.
- **Synonym map** — small curated bidirectional map, ships with this work.

### Forward drift (data integrity — separate from the search win)
- Verified: the classifier (`ingredientSuggestionService`) prompt emits a *different* lowercase vocabulary (`seafood`/`meat`/`bakery`/`frozen` as families; free-form lowercase types), and **there is no DB CHECK constraint** enforcing the taxonomy. So the "fully reconciled" catalog is **unprotected**, and the draft's touchpoint-#2 framing ("new ingredients get the *old coarse* type") is wrong — they'd get an entirely different vocabulary.
- **Decision:** backfill the split buckets now; do **NOT** touch the classifier prompt blind. Run recon first to establish the live write path + whether output is normalized. Realigning the classifier vocabulary to the canonical 32 types (and likely adding a CHECK constraint to make the taxonomy self-protecting) is a **deliberate fast-follow scoped after recon.**

### Hard constraint
Do **not** touch the 4 `family` values (hardcoded as aisle tabs + icons + in the classifier prompt). Refinement happens under the families.

### Verified against code (this pass)
`searchRecipesByIngredient` two-step structure ✓ · schema has `family`+`ingredient_type`+`ingredient_subtype`+`form` ✓ · icon map = 28 keys, 4 orphans exactly as claimed ✓ · `family` hardcoded ✓ · `getTopIngredients` uses `===` on family/type (L1273) ✓ · `SuppliesSection` groups dynamically (L965-967) ✓ · no taxonomy CHECK constraint ✓ · no existing alias/search column on `ingredients`; `measurement_units.aliases` precedent exists ✓.

---

## CC PROMPT 1 — RECON (run first; read-only; decision-independent)

**Context:** We're adding ingredient-family search to Frigo. Before touching forward-classification of new ingredients, we need ground truth on how new ingredient rows actually get written and classified — the `ingredientSuggestionService` prompt vocabulary does NOT match the live catalog, and there's no DB constraint enforcing the taxonomy. **This is investigation only — change no code, run no migrations.**

**Read:**
- `lib/services/ingredientSuggestionService.ts` (full)
- All callers of `suggestIngredientMetadata` / `generateBasicSuggestion` (grep)
- The ingredient insert path(s): grep `.from('ingredients').insert` and `.upsert(` across `lib/` and `screens/`
- `lib/services/ingredientService.ts`
- `lib/services/statsService.ts` → `getTopIngredients` and wherever its filter-pill *options* are built (stats screen / `components/stats/*`)
- `lib/searchService.ts` → `searchRecipesByIngredient` and its callers

**Tasks (report findings only):**
1. **Live write path:** when a new ingredient row is created (e.g. during recipe extraction / ingredient matching), what writes it, and what sets `family` + `ingredient_type`? Is `suggestIngredientMetadata` actually on that path, or was the clean 733-row catalog a one-time backfill done elsewhere?
2. **Normalization:** between any suggestion output and the `ingredients` insert, is there code that maps/normalizes `family`/`ingredient_type` to the canonical title-case taxonomy? If so, where, and what's the mapping?
3. **Stats pills:** are the `getTopIngredients` filter-pill *options* a hardcoded list or derived from distinct values in returned data? (Determines whether new types need a manual addition.)
4. **Synonym wiring:** identify the single best chokepoint to expand a search term into synonyms *before* the ingredient/type match runs (so the synonym map wires in once, not per-call-site). Likely inside `searchRecipesByIngredient` or `searchRecipes`.

**Constraints:** read-only; no edits, no migrations. If a path is ambiguous, say so rather than guess.

**SESSION_LOG entry:**
```
## RECON — Ingredient classifier write-path & search wiring (2026-06-01)
- Live write path: <file:fn> writes ingredients; family/type set by <...>
- suggestIngredientMetadata on that path? YES/NO — <evidence>
- Normalization layer: YES@<file:line> mapping <...> / NONE
- Stats pill options: HARDCODED@<file:line> / DERIVED
- Synonym chokepoint: <file:fn> — recommend expanding term here
- Open/ambiguous: <...>
```

---

## CC PROMPT 2 — EXECUTION (run after recon + at bucket review)

**Context:** Implement ingredient-family search per the PHASE_11 Decision Record (above). Single-valued `ingredient_type` stays the classification; search gets two doors. This prompt: split the two coarse buckets via a **reviewable** backfill, add Path C, add a synonym map, add icons. Do **NOT** touch the classifier prompt (separate fast-follow, pending recon). Do **NOT** touch the 4 `family` values.

**Read first:** the recon SESSION_LOG entry (synonym chokepoint + any normalization layer); `lib/searchService.ts`; `constants/pantry.ts`; the PHASE_11 Decision Record.

**Tasks:**

1. **Lock the vocabulary constant.** Create a single source of truth (`constants/ingredientTaxonomy.ts`) exporting the canonical 32 types grouped under the 4 families, with new types added: `Grains → {Pasta, Rice, Grains}`, `Seafood → {Fish, Shellfish}`, and `Noodles` **only if** step-2 review warrants. The classify script, icon map, and (later) classifier prompt all reference this constant.

2. **`scripts/classifyIngredients.ts`** — committed, reusable. Uses existing `ANTHROPIC_API_KEY` + `@anthropic-ai/sdk`. **Scope: ONLY rows where `ingredient_type IN ('Grains','Seafood')` (~97 rows).** Send those rows (name + plural_name + current type) to Claude against the locked vocabulary; assign the finer type and flag traps (`fish sauce` → Condiments & Sauces, `rice vinegar` → Vinegars, etc.). **Output: a reviewable `.sql` file of `UPDATE ingredients SET ingredient_type='...' WHERE id='...';` statements + a summary table to stdout. NO auto-apply.** During the run, surface the Asian-noodle rows (udon/soba/ramen/rice noodles/glass noodles) so Tom decides `Noodles`-vs-`Rice` per row before finalizing the vocabulary + SQL.

3. **REVIEW GATE (Tom) — stop point.** Tom reviews the SQL + the noodle decision and applies the SQL manually. Then continue.

4. **Path C** in `searchRecipesByIngredient`: extend the existing Step-1 `.or()` to also match `ingredient_type` substring →
   `name.ilike.%${search}%,plural_name.ilike.%${search}%,ingredient_type.ilike.%${search}%`
   **Type-only — do NOT add `family`.** Note the expected behavior in the log: "shellfish" contains "fish", so searching `fish` returns Fish+Shellfish and `shellfish` returns Shellfish only — leave as-is (acceptable).

5. **Synonym map:** add a small curated bidirectional `SEARCH_SYNONYMS` map and expand the term at the chokepoint recon identified. Seed: `noodle↔pasta`, `scallion↔green onion`, `cilantro↔coriander`, `shrimp↔prawn`, `garbanzo↔chickpea`, `aubergine↔eggplant`, `courgette↔zucchini`. Keep it tiny and obvious — curated, not exhaustive.

6. **Icons** in `constants/pantry.ts`: add `INGREDIENT_TYPE_ICONS` + `INGREDIENT_TYPE_ICON_COMPONENTS` entries for the new types (Pasta, Rice, Fish, Shellfish, +Noodles if added) **and** the 4 orphans (Wines & Spirits, Coffee & Tea, Stocks & Broths, Beverages).

**Constraints:**
- Services handle all Supabase calls; components never hit the DB.
- Do NOT touch the 4 `family` values or the classifier prompt.
- Do NOT auto-apply SQL.
- Don't remove existing functionality.

**Verification (after SQL applied):**
- Search `pasta` / `fish` / `rice` / `noodles` both inside a cookbook (BookView) and on the main Recipes screen → expected recipes returned.
- Pantry (`SuppliesSection`) still groups correctly and shows new-type icons (no 📦).
- Stats filter pills include the new types (per recon: hardcoded → confirm added; derived → confirm they appear).
- Synonym: `noodles` returns pasta recipes; `scallion` returns green-onion recipes.

**SESSION_LOG entry:**
```
## EXEC — Ingredient family search (2026-06-01)
- Vocabulary constant: <file> — added <types>
- classifyIngredients.ts: scoped Grains+Seafood, <n> rows → <n> UPDATEs in <file.sql>
- Noodles decision: <Noodles type added / kept under Rice> — <n rows>
- SQL applied by Tom: YES/NO
- Path C: searchRecipesByIngredient .or() extended (type-only)
- Synonym map: <file> — <n> pairs
- Icons added: <list> (new + orphans)
- Verification: <pasta/fish/rice/noodles; pantry; stats pills>
- Staged for PK: <files in _pk_sync/>
```

**Doc maintenance:** stage updated `searchService.ts`, `constants/pantry.ts`, the new `ingredientTaxonomy.ts`, and the PHASE_11 Decision Record into `_pk_sync/` for Tom's manual PK upload.

---

## Fast-follow (post-launch, scoped after recon) — NOT in this handoff
- Realign `ingredientSuggestionService` vocabulary to the canonical 32 types (single source = `ingredientTaxonomy.ts`).
- Consider a DB CHECK constraint (or normalization step) so `family`/`ingredient_type` can't drift.
- `search_aliases text[]` column on `ingredients` (the "many doors" layer) following `measurement_units.aliases`.
