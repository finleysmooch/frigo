# Frigo — Engineering Gotchas

**Last Updated:** June 17, 2026

Durable, non-obvious technical pitfalls in this codebase — the kind that cause silent, hard-to-diagnose bugs and that have already bitten more than once. Read before touching the data layer or the recipe-ingredient surfaces. Add new entries as they're discovered (one gotcha = one section).

---

## 1. Supabase pagination needs a unique tiebreaker (and watch the 1000-row cap)

**The cap.** PostgREST truncates any `.select()` to **1000 rows** by default. A query that "works" in dev silently returns only the first 1000 for a heavy user, and any count/filter derived from that set is wrong. Use `lib/utils/fetchAllRows.ts` (loops `.range()` to exhaustion) for anything that can exceed 1000.

**The tiebreaker (subtler, worse).** `.range()` pagination ordered by a **non-unique** key is **non-deterministic across requests**. Postgres does not guarantee a stable order for rows with equal sort values between the separate page queries, so a row sitting at a page boundary inside a tied cluster can be **skipped entirely** (or duplicated) — it never appears in the assembled list, with no error.

**Why it bites Frigo specifically:** the `frigo-book-ingest` bulk importer stamps **hundreds of recipes with one identical `created_at`** (~200 recipes share `2026-06-12T00:05:26`, out of ~1,900). Ordering recipe pagination by `created_at` alone put a favorited recipe (~row 1043, inside that tied cluster) right on the 1000-row page boundary, so it dropped out of the loaded list — present in the single-query book view, absent from the paginated Recipes page and its filters. Classic "shows here, not there."

**Rule:** every paginated query (`.range()` loop, or `fetchAllRows` callbacks) MUST order by a **total** key — append a unique tiebreaker, e.g. `.order('created_at', { ascending: false }).order('id', { ascending: false })`. Single un-paginated queries (e.g. one book's recipes) are immune, which is exactly why bugs hide on the list/filter side.

**Status:** `screens/RecipeListScreen.tsx` `loadRecipes` fixed 2026-06-17. **Still latent (sweep pending)** — `recipeHistoryService.getCookingHistory`, `bookmarkService.getBookmarksByRecipe` (paginates `user_recipe_tags` with no `.order()` at all), and the `fetchAllRows` callers (`getBooksForIndex`, `searchService` cuisine/metadata, `getTagCounts`) whose `page` callbacks set a non-unique or absent order. Tracked: DEFERRED_WORK OB-23.

---

## 2. Recipe ingredients: render from the JSONB, match from the normalized rows

Two layers hold a recipe's ingredients, and they are **not 1:1**:

- **`recipes.ingredients` (JSONB)** — the verbatim, as-extracted **display** representation: one entry per displayed line, full `original_text` (incl. parentheticals like "(2¼ teaspoons)"), plus `group_name` / `group_number` for ingredient sections. This is what the recipe screen renders.
- **`recipe_ingredients` (table)** — the **normalized / matched** layer: `ingredient_id`, parsed `quantity_amount`/`quantity_unit`, 4-level pantry-match data. This drives the ✓/⚠ glyph, tap-sheet, and What-Can-I-Cook.

**Two extraction pipelines store them differently:**
- **OLD (claude.ai subproject)** — Plenty, Simple, Cook This Book, That Sounds So Good, Cook's/Cooked Veg: full ingredient line in `recipe_ingredients.original_text`.
- **NEW (`frigo-book-ingest`)** — Six Seasons, By Heart, Dinner Tonight, Ambitious Kitchen, Tahini Baby, Comfortable Kitchen, Rachael's, Something from Nothing, Eating Out Loud: only the **cleaned name** in `original_text` (amount lives in the columns + JSONB). Rendering `original_text` directly showed these recipes with **no quantities** until the screen was switched to render from the JSONB.

**Gotcha for the match overlay:** the new pipeline **splits a compound line** ("salt and pepper" → 2 rows) and **skips sub-recipe-reference lines**, so `recipe_ingredients` row count drifts from the JSONB display-line count (~34% of new recipes differ, by ~1.3 lines avg). **Do NOT map display line → row by `sequence_order`** — it shifts after the first split and lands glyphs on the wrong ingredients. Use an **ordered two-pointer walk + normalized text containment** (both lists are sequence-ordered): per display line, consume the consecutive rows whose text is contained in it (≥1 for a split, 0 for a skip). See `screens/RecipeDetailScreen.tsx`.

**Web/URL imports** leave `recipes.ingredients` empty (the app's `recipeService.saveRecipe` doesn't write it), so they fall back to rendering `recipe_ingredients` and have no ingredient sections yet — capturing those needs a `scrape-recipe` change (DEFERRED_WORK / Step 4).

---

## Conventions for adding entries
- One gotcha per `##` section: the symptom, the root cause, the rule, and current status (fixed where / latent where).
- Prefer gotchas that are **non-obvious** and have **caused a real bug** — not general best practices.
