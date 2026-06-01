# Handoff: NYT Cooking import — integrate branch + build the source browse screen (③)

**From:** the CC instance working in `frigo-nyt-build` on branch `nyt-source-metadata`
**To:** the CC instance in the main Frigo checkout
**Date:** 2026-06-01

## TL;DR
A large NYT Cooking import increment was built and **pushed to `origin/nyt-source-metadata`** (repo `finleysmooch/frigo`). All DB migrations and the `scrape-recipe` edge function are **already applied/deployed to the shared Supabase project** (`siaawxcgyghuphwgufkn`) — you do **not** need to re-run them. Your job: **integrate this branch into your workstream**, then build **increment ③ (the in-app source browse screen)** and wire the currently-inert chef-page source pills to it.

## What was built (all on `nyt-source-metadata`, verified end-to-end in-app)
Read the `2026-06-01` entries in `docs/SESSION_LOG.md` for full detail. Summary:

1. **Source-metadata foundation** — `recipes.source_url`, `source_domain`, `external_source_id` (NYT numeric id via `/recipes/(\d+)`), derived at save in `recipeService.deriveSourceMetadata`. Backfill: `scripts/backfill_source_metadata.mjs`. Migration: `supabase/migrations/20260601_recipe_source_metadata.sql`.
2. **Retired-model migration** — model IDs centralized in `lib/services/recipeExtraction/models.ts` (`RECIPE_PARSE_MODEL = claude-haiku-4-5-20251001`, `VISION_MODEL = claude-sonnet-4-6`). Migrated unifiedParser, claudeVisionAPI, ingredientSuggestionService, and 4 edge functions. Also bumped parse `max_tokens` 3000→8000 (truncation fix) and added `normalizeImageUrl()` (NYT JSON-LD image arrays).
3. **Fixed double-save of instruction sections** — removed redundant `saveInstructionSections` calls in `RecipeReviewScreen` + `recipeExtraction/index.ts` (saveRecipeToDatabase already owns it).
4. **Source provenance UI** — `RecipeHeader` shows a tappable "NYT Cooking ↗" line (opens the source URL), `GlobeIcon`, "Adapted by {byline}", co-authors ("with …").
5. **Community notes** — `recipe_source_notes` table (migration `…_recipe_source_notes.sql`); `scrape-recipe` edge function parses `__NEXT_DATA__` (`helpfulNotes` preferred — top ~15 by upvotes); `sourceNotesService` persists/fetches; `SourceNotesSection` renders a collapsible "Most helpful notes" list with thumbs-up upvote counts + threaded replies.
6. **Richer attribution / multi-author** — migration `…_recipe_source_attribution.sql` adds `source_authors text[]`, `source_byline`, `source_credit`, `source_published_at`, `source_updated_at`, `source_extracted_at`. Primary author (`sourcesString` split on " and ") drives the single `chef_id`; co-authors stored in `source_authors`.
7. **Discovery surfaces** — recipe-card source badge (`RecipeCard`), filter-drawer "Source" multi-select + "Source: Recently Updated" sort (`RecipeListScreen` + `FilterDrawer`), chef-page "Other sources" section (`AuthorViewScreen`). Shared label util: `lib/utils/sourceLabel.ts`.

## Integration steps
1. **Get the code.** `git fetch && git checkout nyt-source-metadata` (or merge it into your branch). Same repo/remote.
2. **Do NOT re-run migrations or redeploy `scrape-recipe`** — already live on the shared project `siaawxcgyghuphwgufkn`. The migration SQL files are in `supabase/migrations/` for record. (If you ever point at a *different* Supabase project, you'd run all three `20260601_recipe_source_*.sql` and `supabase functions deploy scrape-recipe`.)
3. **Sanity check after merge:** `npx tsc --noEmit` should be clean. Import a NYT recipe (e.g. `cooking.nytimes.com/recipes/12957-...`) and confirm: chef = primary author, "Other sources" on the chef page, notes section with upvotes, card badge, filter/sort.

## Your task — increment ③: in-app source browse screen
The dedicated "view all my NYT Cooking recipes" surface was deferred to you. Mirror the **`BookViewScreen`** pattern:
- New `SourceViewScreen` (route in `RecipesStackParamList`, e.g. `SourceView: { domain: string }`). Query: `recipes where source_domain = ? AND user_id = ? order by source_updated_at desc`. Render the recipe list (reuse `RecipeCard`).
- **Wire the currently-inert pills:** in `AuthorViewScreen` the "Other sources" chips (search `sourceChip`) are info-only — make them `navigation.navigate('SourceView', { domain })`. There's a code comment marking this.
- Optional entry point: a top-level "Sources" shelf (note: there's no top-level "all books shelf" today either — books are reached via chef/stats pages, so decide whether a shelf is worth it or if chip/badge taps suffice).

## Still outstanding (not yet done by anyone)
- **Photo-extraction smoke test** — the Sonnet 4.6 vision path (`claudeVisionAPI`) was migrated but never tested end-to-end in-app. Do one photo import.
- **Deferred (see SESSION_LOG):** all-notes pagination (embedded payload caps at ~15), Option A multi-chef (per-co-author chef pages/stats via a `recipe_chefs` join table — currently single primary chef), source-staleness monitor (re-scrape, compare `source_updated_at`), and a **project-wide RLS / data-exposure review** (recipe tables are anon-readable; same class as the client-side `ANTHROPIC_API_KEY` exposure — both flagged, neither fixed).

## Watch-outs
- `chef_id` is a **single FK across ~20 files**; multi-author is intentionally "primary chef + `source_authors` list", not many-to-many. Don't assume co-authors are clickable entities yet.
- Edge function `console.log`s show in **Supabase logs**, not Metro.
- NYT recipe content + notes are embedded in the page payload despite the visual paywall (soft paywall); **comments are NOT separately fetchable without auth** and pulling all of them needs NYT-API pagination — out of scope.
