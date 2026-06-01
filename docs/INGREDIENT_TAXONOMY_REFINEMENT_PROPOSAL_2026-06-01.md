# Ingredient Taxonomy Refinement — Proposal for Review

**Created:** 2026-06-01
**Author:** Claude Code (CC), from a live troubleshooting session with Tom
**Status:** DRAFT — awaiting approval from Tom + a Claude.ai strategic pass before any data or code changes
**Purpose:** Decide whether to refine the `ingredients.ingredient_type` taxonomy to support **ingredient-family search** (e.g. searching "pasta" should match spaghetti/penne/orzo; "fish" should match salmon/cod/anchovy), and confirm it fits the current data model.

---

## 1. Why this came up

Search work in Phase 11 surfaced a gap. Two fixes already shipped this session:
- **Unified search engine** — in-cookbook search (BookView) now runs the same server-side engine as the main Recipes screen (`searchRecipesByMixedTerms`), matching the **full ingredient list** + title + chef + metadata. (Previously BookView was a 4-field client-side substring filter over `title`/`description`/`cuisine_types`/`hero_ingredients`, which is why searching "cumin" returned only 3 title matches.) **Verified fixed.**
- **Metadata search** — `searchService.searchRecipesByMetadata` folds cuisine + cooking methods + vibe tags + course type + difficulty into the union.

The remaining gap is **ingredient families**. Substring search has no concept of "spaghetti *is a* pasta." Searching "pasta" misses every recipe whose pasta is listed as spaghetti/penne/orzo/linguine/rigatoni, because none of those strings contain "pasta." To fix this properly we need taxonomy data that groups ingredients into culinary families.

The planned app-side change is small — a **"Path C"** in `searchRecipesByIngredient` that also matches the query against `ingredients.ingredient_type`, resolves the matching ingredient ids, and unions them into the result. But that's only as good as the taxonomy values. This doc is about getting those values right.

---

## 2. Current state (ground truth from the DB)

The `ingredients` table has a **2-level taxonomy**: `family` (4 broad aisle values) → `ingredient_type` (finer). Current distribution — **733 ingredients across 4 families and 32 distinct types**, fully reconciled (no nulls, no drift):

### Dairy (70)
| ingredient_type | n |
|---|---|
| Cheese | 36 |
| Fresh Dairy | 15 |
| Cultured Dairy | 11 |
| Eggs | 5 |
| Butter | 3 |

### Produce (172)
| ingredient_type | n |
|---|---|
| Vegetables | 47 |
| Fruits | 31 |
| Leafy Greens | 21 |
| Fresh Herbs | 19 |
| Root Vegetables | 17 |
| Mushrooms | 10 |
| Alliums | 10 |
| Citrus | 10 |
| Gourds | 7 |

### Proteins (90)
| ingredient_type | n |
|---|---|
| Red Meat | 37 |
| Seafood | 33 |
| Poultry | 14 |
| Plant-Based Proteins | 6 |

### Pantry (401)
| ingredient_type | n |
|---|---|
| Spices & Dried Herbs | 90 |
| Grains | 64 |
| Condiments & Sauces | 58 |
| Baking | 54 |
| Nuts & Seeds | 36 |
| Canned/Jarred Goods | 23 |
| Wines & Spirits | 14 |
| Legumes | 14 |
| Oils & Fats | 13 |
| Coffee & Tea | 10 |
| Vinegars | 10 |
| Dried Fruit | 8 |
| Stocks & Broths | 5 |
| Beverages | 2 |

**Headline finding: the catalog is already clean.** All 733 rows are consistently typed into 32 sensible values. This is **not** a messy catalog needing a wholesale reclassification — re-running an LLM over the ~600 already-correct rows would only risk regressing them. The real problem is narrower: **a few buckets are coarser than search needs.**

---

## 3. The actual problem: a few over-broad buckets

Most types are already at good search granularity (Cheese, Citrus, Alliums, Legumes, Vinegars…). Only a handful bury a culinary family inside a broader bucket:

| Bucket | n | What's buried | Search miss |
|---|---|---|---|
| **Grains** | 64 | pasta + rice + actual grains all together | "pasta", "rice" |
| **Seafood** | 33 | fish + shellfish together | "fish", "shellfish" |
| **Vegetables** | 47 | catch-all incl. chiles/peppers | "pepper", "chili" |

Verified example (from the DB): `spaghetti`, `penne`, `orzo`, `linguine`, `rigatoni`, `angel hair pasta` are all `ingredient_type = 'Grains'`; `cheddar`, `parmesan`, `gouda` are all `ingredient_type = 'Cheese'` (which is why "cheese" would already work but "pasta" does not).

---

## 4. Does it fit the current model? **Yes — no schema change**

The 2-level `family → ingredient_type` model already exists and the pantry grouping consumes it **dynamically** (`components/pantry/SuppliesSection.tsx → groupByFamilyThenType`), so finer `ingredient_type` values flow through automatically with no grouping-code change. This is a **refinement of `ingredient_type`**, not a remodel.

**Firm constraint: do NOT touch the 4 `family` values.** `Produce / Proteins / Dairy / Pantry` are hardcoded as aisle tabs + icons + in the LLM prompt. Splitting/renaming a family = sweeping breakage. Refining `ingredient_type` *underneath* the families is safe.

### Blast radius — touchpoints that must stay in sync per NEW type
A new `ingredient_type` value degrades silently unless three things are updated together:

| Touchpoint | File | If skipped |
|---|---|---|
| Emoji + SVG icon | `constants/pantry.ts` (`INGREDIENT_TYPE_ICONS` + `INGREDIENT_TYPE_ICON_COMPONENTS`) | New type renders generic 📦 |
| LLM classifier prompt | `lib/services/ingredientSuggestionService.ts` (the family/type vocabulary in the suggestion prompt + the keyword fallback heuristic) | **New ingredients get the OLD coarse type — drift recurs** |
| Stats filter pills | `lib/services/statsService.ts → getTopIngredients` (already reads both family + type; uses `===` match) | New type missing from filter pill options |

Everything else adapts dynamically: pantry grouping, supply/lot search (`lib/utils/lotSearch.ts` tsvector dimensions), pantry↔recipe matching (`pantryMatchingService` uses `ingredient_subtype`/`form`, not these columns — unaffected), hero ingredients (independent).

### Existing gap to fix regardless
4 types exist in the data but have **no icon mapping** in `constants/pantry.ts`, so they show generic 📦 today: **Wines & Spirits (14), Coffee & Tea (10), Stocks & Broths (5), Beverages (2).** Worth adding icons independent of the splits.

---

## 5. Proposed change (for approval)

**Targeted splits, not mass reclassification.** Keep all 32 existing types; add only the splits that unlock search, and scope the work to only re-touch rows in the buckets being split (so the ~600 already-correct rows are never at risk, and review is ~100 changes not 733).

### Proposed new `ingredient_type` values
| Split | From → into | Rows in scope | Rationale |
|---|---|---|---|
| **Core (recommended)** | `Grains` → `Pasta`, `Rice`, `Grains` | 64 | Fixes "pasta" (the original ask) and "rice" |
| **High-value (recommended)** | `Seafood` → `Fish`, `Shellfish` | 33 | "fish" works; also aligns with the existing shellfish dietary flag |
| **Optional** | `Vegetables` → pull out `Chiles & Peppers` | ~47 reviewed | "pepper"/"chili" resolve |
| **Independent** | — (add icons for the 4 orphan types) | 0 (icons only) | Removes generic-📦 fallback |

Net vocabulary additions to approve: **`Pasta`, `Rice`, `Fish`, `Shellfish`** (+ optional **`Chiles & Peppers`**), plus icon entries for those and the 4 orphan types.

> **Search-friendly naming note:** Path C matches the query as a substring against `ingredient_type`, so compound names auto-absorb likely queries — "spice" already hits `Spices & Dried Herbs`, "oil" hits `Oils & Fats`. If "noodles" should also resolve, naming the pasta bucket `Pasta & Noodles` would catch both "pasta" and "noodles" for free. **Open question — see §7.**

---

## 6. Execution plan (once vocabulary approved)

1. **Lock the vocabulary** as a shared constant (the single source of truth the script, the LLM prompt, and the icon map all reference).
2. **`scripts/classifyIngredients.ts`** — committed, reusable Claude API script (uses existing `ANTHROPIC_API_KEY` + `@anthropic-ai/sdk`). Scoped to the split buckets only; sends those rows to Claude against the locked vocabulary; emits reviewable SQL `UPDATE`s (no auto-apply). An LLM pass beats pure keyword rules here because it catches traps like "fish sauce" → `Condiments & Sauces` (not `Fish`) and "rice vinegar" → `Vinegars` (not `Rice`).
3. **Review + apply** the SQL (Tom).
4. **Code updates:** add Path C to `searchService.searchRecipesByIngredient`; add the new + orphan icons to `constants/pantry.ts`; update the `ingredientSuggestionService` prompt vocabulary + fallback so new ingredients get the finer types going forward.
5. **Verify** in-app: search "pasta"/"fish"/"rice" inside a cookbook and on the main Recipes screen; confirm pantry grouping still renders; confirm stats filter pills include new types.

---

## 7. Open questions for the review

1. **Scope:** Approve all three splits, or core-only (`Grains`) for v1? (Recommendation: Grains + Seafood; Vegetables optional.)
2. **Noodles:** name the pasta bucket `Pasta` or `Pasta & Noodles`? (Asian noodles — udon, soba, rice noodles — currently in Grains. `Pasta & Noodles` catches both search terms but conflates two cuisines' staples. Alternative: separate `Noodles` type.)
3. **Rice granularity:** one `Rice` type, or fold "Rice & Grains" (i.e. only split out Pasta, leave rice with grains)? Rice has fewer rows; depends on whether "rice" is a common enough search.
4. **`family` matching:** should Path C *also* match the query against `family` (the 4 aisles)? Enables "dairy"/"produce" aisle-level searches but risks over-broadening on partial strings. (Recommendation: type-only for v1.)
5. **Forward drift:** confirm we want to update the extractor's LLM prompt now (so new ingredients get finer types), vs. backfill-only and defer the prompt update.

---

## 8. Decisions already locked (this session, Tom)

- **Vehicle:** committed Claude API script (`scripts/classifyIngredients.ts`), not a manual Claude.ai chat — reusable for ongoing catalog hygiene.
- **Taxonomy approval:** CC drafts (this doc); Tom + a Claude.ai instance approve before execution.
- **Search direction:** in-cookbook and main Recipes search unified onto one engine (shipped); family search is the next layer, gated on this taxonomy.

---

## 9. References
- `lib/searchService.ts` — search engine (Path C lands here)
- `constants/pantry.ts` — icon maps = de-facto type vocabulary
- `lib/services/ingredientSuggestionService.ts` — LLM that assigns family/type to new ingredients
- `components/pantry/SuppliesSection.tsx` — dynamic family→type grouping (no change needed)
- `lib/services/statsService.ts` — `getTopIngredients` type/family filter
- `docs/PHASE_11_RECIPE_POLISH.md` — phase context (8E-CP2 NL-search is the post-launch LLM-expansion alternative)
