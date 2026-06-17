# Cookbook Extraction — Gaps & Roadmap for the Updated Funnel

**Created:** June 17, 2026 · **Owner:** Tom + CC · **Status:** audit complete; quick wins shipped; classification/image work is the roadmap

This documents what the **`frigo-book-ingest`** extraction pipeline left unpopulated on its ~1,077 recipes (vs. the older claude.ai-subproject extractions), what's been backfilled, and the **field-by-field roadmap** the *next* extraction funnel must cover so a recipe lands complete. Use this as the build spec when rebuilding extraction.

---

## 1. The two pipelines

| | OLD (claude.ai subproject) | NEW (`frigo-book-ingest`) |
|---|---|---|
| Marker | `recipes.extraction_method` = NULL | `recipes.extraction_method` = `'cookbook_ingest_stage1'` |
| Books | Plenty, Simple, Cook This Book, That Sounds So Good, Cook's/Cooked Veg | Six Seasons, By Heart, Dinner Tonight, Ambitious Kitchen, Tahini Baby, Comfortable Kitchen, Rachael's Good Eats, Something from Nothing, Eating Out Loud |
| Recipes | ~468 book-attached | **1,077** |
| Strength | full classification + chef linking; full-line `original_text` | clean ingredient **matching** (98% linked to catalog, low needs-review) + parsed quantities + ingredient **group_name** sections + per-ingredient role |
| Weakness | bare-name issues elsewhere | **skipped recipe-level classification, chef linking, images, supplementary content** |

The new pipeline is *better* at the normalized ingredient layer and *worse* at recipe-level metadata. The two are reconciled in the app where possible (see `ENGINEERING_GOTCHAS.md`).

---

## 2. Field-by-field audit (new % populated vs old %)

`recipes` columns, % of recipes with a non-empty value:

| Field | NEW % | OLD % | Status |
|---|---|---|---|
| `title`, `description`, `servings`, `difficulty_level`, `default_course`, `page_number` | ~95–100 | ~100 | ✅ parity |
| `ingredients` (JSONB), `instructions` (JSONB) | 99 | 98–99 | ✅ parity |
| `source_author` / `source_name` / `source_type` | 100 | 98 | ✅ parity (author lives here, not `chef_id`) |
| **`chef_id`** | **0** | 57 | ✅ **addressed** (render fallback → `source_author`) |
| **`hero_ingredients`** | **0** | 100 | ✅ **backfilled** (from per-ingredient `hero` role) |
| **`recipe_notes`** | **0** | ~1 | ✅ **backfilled** (from `raw_extraction_data.notes`) |
| **`cuisine_types`** | **0** | 93 | 🔲 roadmap — needs classification |
| **`cooking_methods`** | **0** | 94 | 🔲 roadmap — needs classification |
| **`vibe_tags`** | **0** | 100 | 🔲 roadmap — needs classification |
| **`serving_temp`** | **0** | 100 | 🔲 roadmap — needs classification |
| **`course_type`** | **0** | 100 | 🔲 roadmap — needs classification |
| **`make_ahead_score`** | **0** | 100 | 🔲 roadmap — needs classification |
| **`cooking_concept`** | **0** | 100 | 🔲 roadmap — needs classification |
| **`dietary_tags`** (+ dietary flags) | **0** | ~1 | 🔲 roadmap — needs classification (old also sparse; recompute from ingredients) |
| **`image_url`** | **0** | 74 | 🔲 roadmap — dish-photo extraction (location known: `book_recipe_assembly.primary_photo_page` 88%) |
| **`instruction_sections`** (prep-step grouping; recipes col + table) | **0** | 100 (col) | 🔲 roadmap — new recipes have flat `instructions`; needs step-section structure |
| **`supplementary_content`** (sidebars, "spin it" subs, market/home) | **0** | 81 | 🔲 roadmap — not retained in assembly; needs re-extraction from page scans |
| `extraction_confidence` / `extraction_model` | 0 | 65 / 0 | 🔲 low-value metadata; the JSON has confidence, import dropped it |
| `prep_time_min` / `cook_time_min` | ~9 / 8 | ~12 | ⚪ both sparse (cookbooks rarely split times) |
| `ai_difficulty_level/score` | 0 | ~2 | ⚪ both sparse |
| `recipe_type`, `easier_than_looks`, `make_ahead_friendly`, `meal_type`, `recipe_tags` | 0 | 0–2 | ⚪ sparse in both — not pipeline-specific |

`recipe_ingredients` (the new pipeline's strength — **no gap**): 98% rows linked to catalog (`ingredient_id`), 84% with parsed `quantity_amount`, per-row `ingredient_classification` (hero/primary/secondary/frying_medium), `quantity_parse_metadata` with `embedded_grams`. Only `needs_review` differs (new 3% vs old 19% — new matching is cleaner).

---

## 3. What was addressed now (June 17)

1. **Chef name — render fallback (code).** `screens/RecipeListScreen.tsx` (`loadRecipes`) + `screens/RecipeDetailScreen.tsx` (load) now derive `chef_name = chefs.name ?? source_author`. New cookbook recipes show their book author (e.g. "Hailee Catalano") without inventing `chefs` rows. No data write.
2. **`hero_ingredients` — backfilled (data).** Derived from `recipe_ingredients.ingredient_classification = 'hero'` (the ingest tool *did* tag roles). **1,041 / 1,077** recipes filled (kabocha → `["kabocha squash"]`). Idempotent — only empty rows touched.
3. **`recipe_notes` — backfilled (data).** From `recipes.raw_extraction_data.notes` (the tip/note the assembly retained). **437** filled.

Reversible (only filled empties). No schema change.

---

## 4. Roadmap — what the updated extraction funnel must populate

Grouped by the work each needs. For each: the **target field(s)**, where the data is, and how to produce it.

### 4a. Recipe-level classification (one Claude pass per recipe)
The old pipeline ran a classifier at extraction; the new one didn't, and the source data (`book_recipe_assembly`) has these at **0%** too — so they must be **generated**, not backfilled. Run a classification service over title + ingredients + instructions and write:
- `cuisine_types text[]` — e.g. `["Middle Eastern"]`
- `cooking_methods text[]` — e.g. `["roasting","steaming"]`
- `vibe_tags text[]` — the 8 Phase-3A vibe categories (with SVG icons)
- `cooking_concept text` — one of the ~78 concepts (`salad`, `composed_plate`, `roast`, …)
- `serving_temp text`, `course_type text`, `make_ahead_score numeric`
- `dietary_tags text[]` + dietary flags — better computed from `recipe_ingredients` (allergen/diet rules) than guessed
Reuse the prompt/logic from the app's `unifiedParser` / vision extraction (Phase-3A classification fields). Cost: ~1,077 Claude calls (one-time backfill) + bake into the funnel going forward.

### 4b. Dish images (`image_url`)
`book_recipe_assembly.primary_photo_page` is populated 88% (+ `photo_page_numbers`, and `supplementary_content` had photo bounding boxes at scan time). The page scans exist (`page_scan_ids`). Funnel step: locate the dish photo on its scan page → crop → upload to Supabase storage (`recipe-images/…`, mirror the catalog-cover hosting pattern) → set `recipes.image_url`. The location data is already there; this is an image-processing pipeline, not re-extraction.

### 4c. Supplementary content & instruction sections
- `supplementary_content` (sidebars, "Get Ahead" tips, **"spin it" substitutions**, "from the market / at home" splits) — present in the *original extraction JSON* (see the tart example in `CC_START_PROMPT.md`) but **dropped at the stage-1 assembly** (empty in both `recipes` and `book_recipe_assembly`). Recovery needs re-reading the raw page-scan JSON (`page_scan_ids`) or re-extraction.
- `instruction_sections` (prep-step grouping like "MAKE THE DOUGH") — new recipes have flat `instructions[]`; the step-section structure needs to be captured at extraction (the app renders sections from the `instruction_sections` table / column).

### 4d. Metadata (low value)
`extraction_confidence`, `extraction_model`, `ai_difficulty_*` — the extraction JSON carries confidence/model; the import dropped them. Cheap to thread through in the new funnel; not worth a backfill.

---

## 5. Canonical "complete extraction" checklist (the funnel spec)

A fully-populated recipe should write **all** of the below. Items marked ✅ the new pipeline already does; 🔲 are the gaps above.

**`recipes` (core):** ✅ `title`, `description`, `servings`, `prep_time_min`/`cook_time_min`, `page_number`, `source_author`/`source_name`/`source_type`, `book_id`, `difficulty_level`, `default_course` · ✅ `ingredients` (JSONB display: per-line `original_text` + `group_name`/`group_number` + `quantity`/`unit`/`ingredient`/`sequence_order`) · ✅ `instructions` · 🔲 `chef_id` (link/create a `chefs` row from author) · 🔲 `cuisine_types`, `cooking_methods`, `vibe_tags`, `cooking_concept`, `serving_temp`, `course_type`, `make_ahead_score` · 🔲 `dietary_tags` · 🔲 `image_url` · 🔲 `instruction_sections` · 🔲 `supplementary_content` · 🔲 `recipe_notes` (now backfilled; capture at source going forward) · 🔲 `extraction_confidence`/`extraction_model`.

**`recipe_ingredients` (normalized — keep the new pipeline's approach):** ✅ `ingredient_id` (catalog match), `original_text`, `quantity_amount`/`quantity_unit`, `ingredient_classification` (hero/primary/secondary), `quantity_parse_metadata` (+`embedded_grams`/`embedded_ml`), `sequence_order`, `needs_review`, `match_confidence`/`match_method`. 🔲 consider stamping a **`source_line_index`** so the normalized rows map 1:1 back to the JSONB display lines (fixes the compound-split match-overlay gap — see `ENGINEERING_GOTCHAS.md` §2).

**Related tables:** 🔲 `instruction_sections` + `instruction_steps` (sectioned prep) · ✅ nutrition flows from `recipe_ingredients.ingredient_id` → catalog → USDA (matched 98%, so nutrition mostly works) · ✅ ingredient `group_name` sections (in the JSONB).

**Cross-cutting:** every paginator over these tables needs a unique sort tiebreaker (`ENGINEERING_GOTCHAS.md` §1).

---

*Audit + quick-win backfills by CC 2026-06-17. The classification pass, image pipeline, and supplementary re-extraction are the substance of the "updated extraction funnel" build — this doc is the field-level spec to build against.*
