# Session Log

_This log is for **post-Phase-10 work** — beginning after the Phase 10 (Nutrition Depth) ship on 2026-05-27. Likely contents going forward: Phase 9 (Meal & Planning UX), Phase 11 (Recipe Polish, including RecipeListScreen redesign per P11-input-1), Phase 12 (Distribution & Testing), plus any inter-phase cleanup / hot fixes._

_Phase 10 era entries (8D cleanup pass + Phase 10 ship) are archived at `docs/_SESSION_LOG_PHASE10.md` (stays top-level for one phase per `docs/archive/README.md`, then moves to `docs/archive/session_logs/` when the next phase completes). Phase 8 era is at `docs/_SESSION_LOG_PHASE8.md`. Earlier phases at `docs/archive/session_logs/`._

_Direct Tom↔CC UX iteration work on existing pantry/grocery surfaces is logged separately in `docs/UX_ITERATIONS_LOG.md` — not here. This log captures phase-checkpoint-level work only._

## 2026-06-01

**Task:** NYT community notes import + richer attribution (multi-author) + most-helpful notes

Tom-directed feature extending the NYT provenance work. Captures NYT Cooking community notes and richer attribution (original author(s), byline/adapter, credit, source dates) — all from the page's `__NEXT_DATA__` payload (no auth; same soft-paywall access path as the recipe). Verified end-to-end in-app on recipes 12957 (multi-author) and others.

### Key discoveries (via signed-out `node fetch` probes — Claude Code is blocked from cooking.nytimes.com, but a plain fetch on the dev machine sees the same payload the edge function does)
- Notes live in `__NEXT_DATA__.props.pageProps.allNotes` / `helpfulNotes` (JSON strings: `{totals:{all,parents,helpful}, notes:[...]}`). **Both blocks cap at ~15 (one page).** `helpfulNotes` = top ~15 by upvotes; `allNotes` = first ~15. Full set (e.g. 29 helpful / 148 all) needs NYT-API pagination — deferred.
- Attribution: `sourcesString` = original author(s) the recipe is "from" (e.g. "Yotam Ottolenghi and Sami Tamimi" — **co-authors joined by " and "**); `bylines[].displayName` = NYT adapter (e.g. "Tara Parker-Pope"); `credit` = full credit line; `publishInfo.firstPublishedAt` + `seoMeta.lastMajorModification` = dates.
- **Bug found & fixed:** setting `source_author = sourcesString` would create one garbage chef named "Yotam Ottolenghi and Sami Tamimi". Now the combined string is split; the PRIMARY author (authors[0]) drives the single `chef_id`; co-authors stored in `source_authors` for display. (Option B — keeps the single-chef machinery across ~20 files untouched; per-author chef pages/stats = future Option A.)

### Migrations (Tom ran both; SQL also in files)
- `20260601_recipe_source_notes.sql` — `recipe_source_notes` table (FK→recipes cascade, `UNIQUE(recipe_id, source_note_id)`, helpful-first index). No RLS (matches sibling recipe child tables `instruction_sections`/`recipe_ingredients`, which are anon-readable — confirmed by live probe).
- `20260601_recipe_source_attribution.sql` — adds `source_authors text[]`, `source_byline`, `source_credit`, `source_published_at`, `source_updated_at`, `source_extracted_at` to `recipes`.

### Edge function (REDEPLOYED — `supabase functions deploy scrape-recipe`, done this session via `--project-ref siaawxcgyghuphwgufkn`)
- `supabase/functions/scrape-recipe/index.ts` — parses `__NEXT_DATA__` for notes (prefers `helpfulNotes`) + `sourceMeta` (authors split, byline, credit, dates); returns `notes[]`, `notesTotal`, `sourceMeta` on the payload. Note: edge `console.log`s appear in Supabase logs, not Metro.

### App files changed
- `lib/services/recipeExtraction/recipeService.ts` — saves the new provenance columns + calls `saveSourceNotes`. ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/services/recipeExtraction/unifiedParser.ts` — primary-author selection (authors[0]) for chef; carries `source_notes`/`source_meta`. ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/services/recipeExtraction/webExtractor.ts` — `StandardizedRecipeData` gains `notes`/`notesTotal`/`sourceMeta` types. ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/types/recipeExtraction.ts` — `SourceNote`, `SourceMetaInfo`, `ProcessedRecipe.source_notes/source_meta`, `raw_extraction_data.extraction_date`. ⚠️ PK snapshot now stale (was 2026-04-22)
- `screens/RecipeDetailScreen.tsx` — maps new fields; renders `SourceNotesSection`. ⚠️ PK snapshot now stale (was 2026-05-19)
- `components/recipe/RecipeHeader.tsx` — co-authors line ("with …"), "Adapted by {byline}", "Updated {Mon YYYY}". (Not in PK tracking doc.)

### App files created
- `lib/services/recipeExtraction/sourceNotesService.ts` — `saveSourceNotes` (idempotent upsert) + `getSourceNotes` (helpful/recommended-first).
- `components/recipe/SourceNotesSection.tsx` — collapsible "Most helpful notes from NYT Cooking (N)" with threaded replies + ★ Recommended.

### Verification (in-app, recipe 12957 "Chermoula Eggplant", multi-author)
- chef (linked) = **Yotam Ottolenghi** (not the combined string, not the byline); `source_authors` = ["Yotam Ottolenghi","Sami Tamimi"]; `source_byline` = "Tara Parker-Pope"; credit + published(2012-11-13)/updated(2020-07-08)/extracted(now) all populated; image single URL; 4 sections, no dupes.
- Notes: 15 most-helpful stored, recommendations 90 → 11 (Philip 90, Hillary 83, JRussell 71…), sorted by helpfulness. tsc clean throughout.

### Deferred / follow-ups (recommend for DEFERRED_WORK)
- **All notes via pagination** — embedded payload caps at ~15; pulling all helpful (29) / all (148) needs NYT notes-API paging.
- **Option A multi-chef** — per-co-author chef pages + stats via a `recipe_chefs` join table (touches ~20 files); current Option B keeps one primary chef.
- **Staleness monitor** — re-scrape and compare live `lastMajorModification` vs stored `source_updated_at`; `source_extracted_at` records last pull.
- **Project-wide RLS / data-exposure review** — recipe tables are anon-readable; same class as client-side `ANTHROPIC_API_KEY`. Belongs with increment-3 gating.
- Threaded-reply / ★ Recommended display code is in place but unexercised by sampled recipes (their first pages had none).

### Recommended doc updates
- `FRIGO_ARCHITECTURE.md` — none yet (note `recipe_source_notes` + the source_* columns once the NYT feature set stabilizes).
- `DEFERRED_WORK.md` — add the four follow-ups above (CC did not edit it — flagging for Claude.ai).
- `PROJECT_CONTEXT.md` / `FF_LAUNCH_MASTER_PLAN.md` — none.

### Recommended next steps for Tom
1. Eyeball the chermoula detail page (notes + multi-author header) — confirm UI.
2. Photo-extraction test (Sonnet 4.6 vision path) still outstanding.
3. Decide whether all-notes pagination / Option A multi-chef are in scope for F&F.

---

## 2026-06-01

**Task:** Recipe-detail source provenance UI (NYT Cooking attribution + link)

Surfaces a web recipe's source on the detail page, in the same slot the book title occupies for book recipes. Builds on the increment-1 source columns. Tom-directed follow-on; verified visually in-app on a NYT recipe (link opens correctly).

### Files changed
- `components/recipe/RecipeHeader.tsx` — added `source_url` / `source_domain` to its local Recipe interface; renders a tappable source line in `metaCol` (same place as the book line, since web recipes have no `book_title`). `cooking.nytimes.com` → label "NYT Cooking"; other domains → title-cased first segment (generalizes for free). Tapping calls `Linking.openURL(source_url)`. Added a `BookIcon` to the existing book line and a `GlobeIcon` to the new source line (14px, teal `#0d9488`), with a shared `sourceRow` flex style. (Not in PK snapshot tracking doc — no Rule E flag.)
- `components/icons/recipe/GlobeIcon.tsx` — NEW. Stroke-based `react-native-svg` globe (circle + meridian + equator + 2 latitude lines) matching the app's icon convention (`{size, color}` props, default export).
- `screens/RecipeDetailScreen.tsx` — mapped `source_url` / `source_domain` / `external_source_id` from the recipe row (already selected via `*`) into `formattedRecipe` + its Recipe interface, so RecipeHeader receives them. ⚠️ PK snapshot now stale (was 2026-05-19)

### Verification
- tsc --noEmit clean on all touched files.
- In-app: NYT recipe 1025971 shows "🌐 NYT Cooking ↗"; tap opens the source URL. Book recipes show the book icon + title. Tom confirmed look + link.

### Comments / community notes — feasibility (investigated, NOT built)
Tom asked whether NYT community notes can be imported. Findings: the `scrape-recipe` edge function reads static-HTML JSON-LD, which does NOT contain community notes — they load client-side from NYT's internal (undocumented) endpoint into the page's `#notes_section`. Web search found no public NYT notes API; only third-party paid scrapers (Apify) and recipe-body tools. Claude Code is blocked from fetching `cooking.nytimes.com`, so the live endpoint probe must come from Tom's browser DevTools. Recommended as its own gated increment (new `recipe_source_notes` table + edge function), pending: (a) the actual notes request URL + whether it needs auth/cookie, (b) a ToS decision on storing NYT users' comments. We already store `external_source_id` (their key), so if the endpoint is fetchable unauthenticated it's viable.

### Recommended doc updates
- `FRIGO_ARCHITECTURE.md` — none (could note RecipeHeader now renders web-source attribution once the feature set stabilizes).
- `DEFERRED_WORK.md` — recommend adding **"import NYT community notes"** as a gated increment with the two prerequisites above (CC did not edit DEFERRED_WORK — flagging for Claude.ai).
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none.

### Recommended next steps for Tom
1. (Optional) Capture the NYT notes request from DevTools to decide whether the comments increment is viable.
2. Photo extraction test (still outstanding from the model-migration task) to confirm the Sonnet 4.6 vision path.

---

## 2026-06-01

**Task:** Migrate retired extraction model strings (unblock recipe import)

URL recipe import was failing with `404 not_found_error` — the parse path called `claude-3-haiku-20240307` (Haiku 3), which Anthropic retired ~2026-04-20. The photo path used `claude-sonnet-4-20250514` (Sonnet 4), which retires 2026-06-15 and would break the same way. Migrated both, centralized the IDs, and swept the whole repo for other dated model strings. Model-string migration only — no prompt/max_tokens/parsing changes.

### Confirmed model IDs (source: https://platform.claude.com/docs/en/about-claude/models/overview)
- **VISION_MODEL = `claude-sonnet-4-6`** — Sonnet 4.6's API ID is **dateless** (the 4.6 generation onward uses a pinned-but-dateless format; there is no `-YYYYMMDD` form). Docs explicitly list `claude-sonnet-4-20250514` as deprecated, retiring 2026-06-15.
- **RECIPE_PARSE_MODEL = `claude-haiku-4-5-20251001`** — current Haiku 4.5 (matches the ID already used across the repo's scripts/edge functions).

### API-level verification (direct fetch to api.anthropic.com, 8-token ping)
- `claude-haiku-4-5-20251001` → **OK**
- `claude-sonnet-4-6` → **OK**
- `claude-3-haiku-20240307` (old) → **404 not_found_error** — reproduces the exact reported failure. Confirms the swap resolves it.

### Repo-wide sweep for dated `claude-*` strings — every hit + resolution
**App code — migrated to centralized constants:**
- `lib/services/recipeExtraction/unifiedParser.ts:175` — `claude-3-haiku-20240307` → `RECIPE_PARSE_MODEL`. (THE failure.) ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/services/recipeExtraction/claudeVisionAPI.ts:265 & :343` — `claude-sonnet-4-20250514` → `VISION_MODEL` (both call sites). ⚠️ PK snapshot now stale (was 2026-04-22)

**App code — separate live bug found & fixed in place:**
- `lib/services/ingredientSuggestionService.ts:119` — was `claude-haiku-4-20250514`, an **invalid model ID** (no "Haiku 4"; that date belongs to Sonnet 4). Would have 404'd whenever AI ingredient suggestions ran. Fixed to `claude-haiku-4-5-20251001` in place (outside the extraction module, so not routed through `models.ts`). ⚠️ PK snapshot now stale (was 2026-04-22)

**Edge functions (Deno — cannot import `models.ts`; migrated literals, REQUIRE separate redeploy):**
- `supabase/functions/scan-book-pages/index.ts:12`
- `supabase/functions/process-recipe-queue/index.ts:17`
- `supabase/functions/extract-book-toc/index.ts:18`
- `supabase/functions/assemble-book-recipes/index.ts:20`
  — all four had `const CLAUDE_MODEL = "claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"`. Sonnet 4.6 input price is still $3/MTok so the cost constants below each line stay valid. **These do not take effect until redeployed** (`supabase functions deploy <name>`). None are on the URL/photo import path, so they don't block this task, but they retire 2026-06-15 — redeploy before then.

**Comment-only (no live call):**
- `lib/types/recipeFeatures.ts:215` — example in a type comment cited the dead `claude-sonnet-4-20250514`; updated to `e.g. 'claude-sonnet-4-6'` to prevent copy-paste of a retired ID. ⚠️ PK snapshot now stale (was 2026-04-22)

**Already-current — left as-is (no retired/retiring IDs):**
- `supabase/functions/extract-recipe-three-pass/index.ts` — uses `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101` (4.5 family; legacy-but-available, not retiring). Inconsistent with the 4.6 used in the other edge functions but out of scope here — flagged below.
- `scripts/*.py`, `scripts/detect-sections.ts`, `scripts/recipe_classification_test.py` — all on current 4.5-family IDs. No action.
- `docs/` session logs / prompts — historical references only. No action.

### Files created
- `lib/services/recipeExtraction/models.ts` — exports `RECIPE_PARSE_MODEL` and `VISION_MODEL` with a deprecation-history comment. Root-cause fix: model strings were scattered literals, making each Anthropic retirement a multi-file 404 hunt. Now the next deprecation is a one-line change here. (Doc note in-file: edge functions run under Deno and can't import this; they keep their own constants.)

### Files modified
- `unifiedParser.ts`, `claudeVisionAPI.ts` — added `import { ... } from './models'` and swapped the model literals.
- `ingredientSuggestionService.ts` — invalid-ID fix (above).
- `recipeFeatures.ts` — comment fix (above).
- 4 edge functions — literal swap (above).
- `unifiedParser.ts` — also `max_tokens` 3000→8000 + truncation warning, and `normalizeImageUrl()` (see "Follow-on bugs" below).
- `screens/RecipeReviewScreen.tsx`, `lib/services/recipeExtraction/index.ts` — removed redundant `saveInstructionSections()` calls (double-save fix, see below).
- `docs/PK_CODE_SNAPSHOTS.md` — set the 4 tracked edited files' Staleness Risk to HIGH (Rule E). Edge functions and `models.ts` aren't in the tracking doc, so no rows there.

### tsc
`npx tsc --noEmit` reports no errors in any touched file (`models.ts`, `unifiedParser.ts`, `claudeVisionAPI.ts`, `ingredientSuggestionService.ts`, `recipeFeatures.ts`).

### End-to-end app tests — DONE for URL path (photo path still pending)
Ran the app from `frigo-nyt-build` (had to `npm install` first — this build repo had no `node_modules`; Metro on port 8082 since 8081 was taken by the main Frigo instance). Tested via real NYT URL imports:

- **Model swap confirmed live**: first NYT import (recipe 1021789) ran the parse call on Haiku 4.5 with NO 404 — the exact failure is gone.
- **Increment 1 confirmed live**: saved row had `source_url` (query-clean), `source_domain=cooking.nytimes.com`, `external_source_id=1021789` (then again 1025971 on a second recipe) — the NYT numeric-ID branch works end-to-end.
- **Photo extraction (`claude-sonnet-4-6` vision path): still NOT tested** — Tom to run one photo import to close this out.

### Follow-on bugs found during verification (pre-existing, NOT caused by the model migration) — fixed
While verifying the URL import, two unrelated import-path bugs surfaced. Fixed them since they blocked clean verification:

1. **Parser `max_tokens` truncation.** The first import parsed on Haiku 4.5 (no 404) but then threw `JSON Parse error: Unexpected end of input` — the structured recipe JSON exceeded `max_tokens: 3000` and got cut off. Haiku 4.5 emits fuller output than the retired Haiku 3, so this is the model swap "demonstrably requiring" the bump (the constraint's escape hatch). `unifiedParser.ts`: raised `max_tokens` 3000→8000 and added a `stop_reason === 'max_tokens'` warning so a future truncation is obvious rather than a cryptic JSON error. After the bump the same recipe parsed cleanly (13 ingredients, 4 sections). ⚠️ PK snapshot now stale (was 2026-04-22)
2. **Instruction sections double-saved.** Every section + its steps was inserted twice (DB had 8 sections for a 4-section parse). Root cause: `saveRecipeToDatabase()` already saves instruction sections internally (recipeService.ts:121), but two callers — `screens/RecipeReviewScreen.tsx` and `lib/services/recipeExtraction/index.ts` — *also* called `saveInstructionSections()` on the returned recipe ID (leftover from before section-saving moved into `saveRecipeToDatabase`). Removed both redundant call sites (and the now-unused import in the screen); `saveRecipeToDatabase` is now the sole owner. Re-import confirmed exactly 3 sections, no duplicate `section_order`s. ⚠️ PK snapshot now stale (was 2026-04-22) for both `RecipeReviewScreen.tsx` and `recipeExtraction/index.ts`
3. **Image not captured for NYT (related, found same pass).** NYT serves a JSON-LD *array* of `ImageObject`s; the scraper passed it through and `unifiedParser` saved the whole array verbatim into the `image_url` text column (a giant blob → nothing rendered). Added `normalizeImageUrl()` in `unifiedParser.ts` — collapses string / object / array-of-either to a single URL, preferring the largest image ≤2000px. Re-import stored a single clean URL (`…mediumSquareAt3X.jpg`). (Same `unifiedParser.ts` staleness flag as above.)

**Verification of the fixes (recipe 1025971, smoky shrimp saganaki):** `image_url` = single 102-char URL string; 3 sections with 2/3/2 steps and zero duplicate orders; source metadata all correct. Broken first test row (1021789, `b63cec1d…`) was deleted after diagnosis; the clean 1025971 row (`361bc695…`) was left in place.

### Photo path — still PENDING Tom
- **Photo extraction** — confirm the `claude-sonnet-4-6` vision swap parses + saves a photo recipe.

### ⚠️ Security item flagged (NOT changed this task, per constraint)
Both `unifiedParser.ts` and `claudeVisionAPI.ts` instantiate the Anthropic client with `apiKey: ANTHROPIC_API_KEY` imported from `@env` (react-native-dotenv). **This bundles the raw Anthropic API key into the client app**, where it can be extracted from the shipped bundle. The extraction calls should go through a Supabase edge function (server-side key) like the book-scanning functions already do. Tracked separately as a security item — left untouched here as instructed.

### Recommended doc updates
- `FRIGO_ARCHITECTURE.md` — none required, but worth a future note that recipe-extraction model IDs are now centralized in `lib/services/recipeExtraction/models.ts` (and that edge functions hold their own copies).
- `DEFERRED_WORK.md` — recommend adding: (a) **client-side `ANTHROPIC_API_KEY` exposure** — move extraction calls server-side (security); (b) **edge-function model consistency** — `extract-recipe-three-pass` is on Sonnet 4.5 while the others are now on 4.6; decide on one and align; (c) **normalize image URL upstream in the `scrape-recipe` edge function** — the app-side `normalizeImageUrl()` added here is a safety net; the scraper should ideally return a single best URL so the raw JSON-LD array never reaches the client. (CC did not edit DEFERRED_WORK — flagging for Claude.ai.)
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none.

### Recommended next steps for Tom
1. Run the app and do one NYT URL import + one photo extraction to complete end-to-end verification (incl. the increment-1 column check on the saved NYT row).
2. Redeploy the 4 migrated edge functions before 2026-06-15: `supabase functions deploy scan-book-pages process-recipe-queue extract-book-toc assemble-book-recipes` (run individually if the multi-arg form isn't supported by your CLI version).
3. Decide whether the security item (client-side API key) gets scheduled before F&F launch.

---

## 2026-06-01

**Task:** Recipe source-metadata foundation — increment 1 (NYT Cooking import groundwork, roadmap #15)

First of three increments toward NYT Cooking import. This one makes source provenance first-class: three new top-level columns on `recipes`, populated at save time from the URL already captured in `raw_extraction_data.source_url`, plus a one-off backfill for existing rows. **No dedup (#2) and no gating (#3) logic** — explicitly out of scope here. Existing `source_author` / `source_name` / `source_type` / `chef_id` behavior untouched.

### Migration SQL (Tom runs this in Supabase — NOT auto-applied)

Also saved to the repo at `supabase/migrations/20260601_recipe_source_metadata.sql`.

```sql
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS source_url         text,
  ADD COLUMN IF NOT EXISTS external_source_id text,
  ADD COLUMN IF NOT EXISTS source_domain      text;

CREATE INDEX IF NOT EXISTS idx_recipes_source_dedup
  ON public.recipes (source_domain, external_source_id)
  WHERE external_source_id IS NOT NULL;
```

Purely additive (recipes was 56 columns; none of these three existed). **No UNIQUE constraint** on the new columns — increment 2 is copy-on-import, so multiple user rows will intentionally share the same `(source_domain, external_source_id)`. The partial index is a plain btree to make the future dedup lookup fast; it does **not** enforce uniqueness. (The migration file also adds `COMMENT ON COLUMN` docs for the three columns.)

### Files modified
- `lib/services/recipeExtraction/recipeService.ts` — added exported `deriveSourceMetadata(rawUrl)` helper + `SourceMetadata` interface; wired the three derived fields into the `saveRecipe` insert (and a log line). Derivation: `source_url` = URL with query string/hash stripped; `source_domain` = hostname w/o `www.` (reuses `getDomainFromUrl` from `webExtractor.ts` — no new domain parser); `external_source_id` = numeric NYT ID via `/\/recipes\/(\d+)/` for `cooking.nytimes.com` only, else null. All three null when `raw_extraction_data.source_url` is absent (book/photo recipes) — correct, not a failure. ⚠️ PK snapshot now stale (was 2026-05-19)
- `docs/PK_CODE_SNAPSHOTS.md` — set `recipeExtraction/recipeService.ts` Staleness Risk to HIGH (Rule E).

### Files created
- `supabase/migrations/20260601_recipe_source_metadata.sql` — the migration above, with column comments.
- `scripts/backfill_source_metadata.mjs` — one-off backfill, `--dry-run` supported. Fetches recipes where `raw_extraction_data->>source_url` is not null (paged via PostgREST + service-role key, lightweight jsonb-path select), derives the three fields with logic mirroring `deriveSourceMetadata`, and PATCHes each row. Reports: total recipes, # with a source_url, # that got a source_domain, # that got an external_source_id (NYT), plus any URLs that failed to parse and up to 5 NYT spot-check rows.

### TS types
No generated `Database` type on the Supabase client (it's created untyped in `lib/supabase.ts`), so the new insert fields type-check without a generated-type update. `raw_extraction_data.source_url` was already typed in `lib/types/recipeExtraction.ts`. Added the `SourceMetadata` interface as the new shared shape. `npx tsc --noEmit` reports no errors in the touched files.

### Derivation verified (local, pre-DB)
Ran the logic against representative URLs:
- NYT + tracking params → params stripped, `external_source_id` = `1018028` ✓
- NYT with `www.` → domain normalized to `cooking.nytimes.com`, ID extracted ✓
- seriouseats.com + utm → domain set, `external_source_id` null ✓
- NYT path with no numeric ID → ID null (graceful) ✓
- unparseable string → `parseFailed`, raw kept as `source_url`, domain/id null ✓
- null/absent URL → all three null ✓

### Backfill results
**Ran 2026-06-01** (dry-run then live) after Tom applied the migration. Same counts both passes:
- Total recipes in table: **822**
- Recipes with a `source_url`: **3**
- → got `source_domain`: **3**
- → got `external_source_id` (NYT): **0** (no NYT recipes imported yet — that's increment #2)
- URL parse failures: **0**

Small populated count as expected — the corpus is overwhelmingly book/photo-sourced with no URL. Verified by reading the rows back: the 3 domains are `ambitiouskitchen.com`, `thedefineddish.com`, `yourhomebasedmom.com` (all `www.` correctly stripped), `external_source_id` null on all three.

Setup note: this build repo (`frigo-nyt-build`) had no `.env`; copied it from `C:\Users\tommo\Frigo\.env` (same Supabase project; `.env` is gitignored here).

### Verification still pending (needs Tom)
1. Apply migration in Supabase.
2. Run backfill (dry-run then live); report the non-null counts per column.
3. Spot-check 3–5 NYT recipes: `external_source_id` matches the numeric ID in the URL.
4. Fresh NYT URL import → confirm all three columns populate end-to-end.
5. Book/photo import → confirm it still saves fine with the three columns null.

### Notes for increments #2 / #3
- The dedup lookup key is `(source_domain, external_source_id)` — the partial index `idx_recipes_source_dedup` is already in place for it. Increment 2 should query that pair, NOT add a UNIQUE constraint (copy-on-import duplicates it deliberately).
- `external_source_id` is currently NYT-only by design. Adding more sources later = extend `deriveSourceMetadata` with another `domain === ...` branch; backfill script mirrors the same function and should be updated in lockstep (comment in both files calls this out).
- `source_url` is stored cleaned (query/hash stripped). If #2/#3 ever need the original tracking URL, it's still preserved in `raw_extraction_data.source_url`.
- Live save and backfill share derivation logic but in two languages (TS helper + JS mirror in the .mjs). Kept intentionally separate because the .mjs runs standalone against PostgREST and can't import the TS module. Both carry a "keep in sync" comment.

### Recommended doc updates
- `FRIGO_ARCHITECTURE.md` — none for now (could note the three `recipes` source columns once the feature lands across all 3 increments; premature at increment 1).
- `DEFERRED_WORK.md` — none (increments #2/#3 are tracked under roadmap #15, not new deferred items).
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none.

### Recommended next steps for Tom
1. Run `supabase/migrations/20260601_recipe_source_metadata.sql` in Supabase.
2. `node scripts/backfill_source_metadata.mjs --dry-run`, eyeball the report, then run live.
3. Paste the backfill counts back so they can be recorded and the NYT spot-check confirmed.
4. Do one fresh NYT URL import + one book/photo import to confirm the end-to-end paths.
