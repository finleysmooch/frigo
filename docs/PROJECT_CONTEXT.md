# Frigo - Project Context
**Last Updated:** June 9, 2026
**Version:** 10.8
**Status:** Active Development — **Phase 10 (Nutrition Depth) shipped 2026-05-27 (single session, six sub-phases + hot fix).** Phase 8 complete pending cleanup pass; 8R closeout (CP1 → CP6e shipped 2026-04-29 → 2026-05-13; smoke clean 2026-05-15) + 8D (CP1 → CP4 shipped 2026-05-19, CP5 bundled into CP3). **8E retired** — F&F-relevant CPs merged into Phase 11 (2026-05-19). F&F readiness criterion = Phases 8, 9, 10, 11, 12 all complete; **3 of 5 now done** (8, 10). Next: **Phase 11 (Recipe Polish, including RecipeListScreen redesign)** or Phase 9 (Meal & Planning UX). F&F launch target: **late August or early September 2026**.

---

## 🎯 Quick Start for Claude

### About Me (The Developer)
- Background: App co-founder (Visana Health) with architecture experience but learning to code directly. Biomedical engineering education.
- Coding Level: Can read and understand code, learning to write React Native/TypeScript
- Preferences:
  - Keep explanations concise
  - Prefer simple, working solutions over complex ones
  - Ask clarifying questions before detailed answers
  - Values evidence over assumptions, appreciates being challenged
  - **CRITICAL:** Always ensure existing functionality isn't lost when making changes

### About This Project
Frigo is a "Strava for cooking" — a social cooking app that helps users:
- Digitize recipes from cookbooks (AI photo extraction) and websites (URL scraping)
- Log what they cook and share with friends (Strava-style stat cards, dietary badges)
- **Track cooking stats** — personal dashboard with weekly trends, diversity scores, cooking personality, nutrition goals, and growth milestones
- Plan meals with a calendar and collaborate with cooking partners
- Manage household supplies + needs with shared household spaces (unified Phase 8R model)
- Browse recipes with rich metadata (hero ingredients, vibe tags, dietary info, nutrition)
- View recipe nutrition and dietary information
- Search and filter recipes by multiple criteria (dietary flags, vibe tags, nutrition, course type, serving temp)

### Tracking
Code and features tracked in **FRIGO_TRACKER** (Google Sheets). Claude Code uses CLAUDE.md in repo root for session logging and tracker row generation.

### Documentation System

**Claude.ai is the planning brain — it owns all living docs:**
- **FF_LAUNCH_MASTER_PLAN.md** — strategic plan for F&F launch, phase sequence, scope decisions, timeline
- **Active phase doc** (currently `PHASE_8_PANTRY_AND_GROCERY.md`) — merged Phase 8 + 8R history; 8D scoping in companion `PHASE_8D_PLANNING.md`
- **PROJECT_CONTEXT.md** (this doc) — high-level project overview
- **FRIGO_ARCHITECTURE.md** — codebase map, services, patterns
- **DEFERRED_WORK.md** — master backlog of bugs, tech debt, deferred items
- **DOC_MAINTENANCE_PROCESS.md** — planning/execution workflow, doc allocation rules, archive lifecycle

**Claude Code is the execution hands** — it writes only to `_SESSION_LOG.md` in the repo, including detailed reports and recommended doc updates. Claude Code never authors strategic content on its own.

**The loop:** Claude.ai makes decisions → generates prompts for Claude Code → Claude Code executes and reports via SESSION_LOG → Claude.ai reads the log and reconciles into the living docs.

**Repo-as-canonical:** Living docs live in `docs/` in the repo and are the source of truth. Project knowledge (PK) is a minimal working set (~10 files) that Claude.ai searches during planning sessions — it's a cache, not canonical. When Claude.ai updates a living doc, the repo gets committed first, then the updated file stages in `_pk_sync/` for Tom's manual upload to PK.

**Archive lifecycle:** Completed phase docs, consumed CC prompts, and historical material move to `docs/archive/` subfolders (phases, handoffs, prompts, session_logs, design_decisions, wireframes). The most recently completed phase stays at top-level `docs/` until the next phase ships ("warm one phase" rule). See `DOC_MAINTENANCE_PROCESS.md` for the full rules.

**Deferred items:** Live in the active phase doc until phase completion. At phase completion, Claude.ai reconciles them into `DEFERRED_WORK.md`.

### Key Documentation (Read in Order)
1. **This document** — project overview, what works, what's next
2. **FF_LAUNCH_MASTER_PLAN.md** — F&F launch strategy, phase sequence, scope decisions, timeline
3. **Active phase doc** (`PHASE_8_PANTRY_AND_GROCERY.md`) — current goals, decisions, progress; 8D scoping in `PHASE_8D_PLANNING.md`
4. **FRIGO_ARCHITECTURE.md** — codebase map, architecture patterns, file reference
5. **DEFERRED_WORK.md** — master backlog
6. **DOC_MAINTENANCE_PROCESS.md** — workflow rules
7. Feature specs as needed: `CONCEPT_FLEXIBLE_MEAL_PLANNING`, `SHARED_PANTRIES_FEATURE_SPEC`

---

## 🛠 Tech Stack

### Frontend
- **Framework:** React Native (Expo)
- **Language:** TypeScript
- **Navigation:** React Navigation (bottom tabs + nested stacks). 6 tabs: Home, Recipes, Meals, Pantry, Grocery, You
- **State:** React hooks (useState, useEffect) + React Context (SpaceContext for shared spaces)
- **Icons:** 79+ custom SVG components via react-native-svg across 4 groups (recipe/vibe/pantry/filter), now including PencilIcon
- **Charts:** react-native-svg for line charts (WeeklyChart), donut charts (StatsNutrition), heatmaps, bubble maps

### Backend
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password)
- **Storage:** Supabase Storage (recipe photos, post photos, profile images)
- **Edge Functions:** Deno (recipe extraction three-pass, book processing pipeline, web scraping)
- **Full-text search:** PostgreSQL tsvector + GIN index, server-side RPC `search_supplies` (8R-CP6e — multi-dimension search across supplies + lots)
- **Migrations:** CLI-tracked via `supabase/migrations/` (baseline `20260609155555`, P7-23). See `docs/MIGRATIONS.md` for the workflow + tiered push policy (CC pushes mechanical migrations; Tom runs the push for CP5/auth-trigger and anything destructive).

### AI/ML
- **Claude Haiku:** Default for recipe extraction (92% cheaper than Sonnet), recipe classification (hero ingredients, vibe tags, course type, cooking concept)
- **Claude Sonnet:** Available as extraction option, used for book TOC extraction
- **Vision:** Photo-to-recipe extraction via Claude Vision (three-pass pipeline)

### Key Libraries
- react-native-image-picker, expo-file-system, date-fns, @react-native-community/slider, @anthropic-ai/sdk, react-native-svg

---

## 📱 App Structure — Tabs & Screens

### Bottom Tab Navigation (left to right)
| Tab | Stack | Screens |
|-----|-------|---------|
| **Home** (Feed) | FeedStack | FeedScreen → PendingApprovals, RecipeDetail, AuthorView, YasChefsList, CommentsList |
| **Recipes** | RecipesStack | RecipeListScreen → RecipeDetailScreen → CookingScreen, BookView, AuthorView, AddFromPhoto, AddFromUrl, RecipeReview, MissingIngredients |
| **Meals** | MealsStack | MyMealsScreen → MealDetailScreen |
| **Pantry** | PantryStack | PantryScreen → SupplyDetailScreen, SpaceSettingsScreen |
| **Grocery** | GroceryStack | ViewsScreen → ViewDetailScreen (renamed from GroceryListsScreen / GroceryListDetailScreen in 8R-CP6c; rename completion pending CC cleanup pass) |
| **You** | StatsStack | StatsScreen (Cooking Stats / My Posts) → DrillDown, ChefDetail, BookDetail, UserPosts, RecipeDetail, Profile, Settings |

Also: StoresScreen, AdminScreen (dev tools), CookSoonScreen (saved recipes queue)

### Context Providers
- **SpaceProvider** (SpaceContext.tsx) — wraps entire authenticated app. Manages shared household spaces, active space selection, invitations.
- **ThemeProvider** (ThemeContext.tsx) — color scheme management
- **LogoConfigProvider** (LogoConfigContext.tsx) — logo variant selection

---

## ✅ What Works (as of May 27, 2026)

### Recipe System
- **AI Photo Extraction:** Three-pass pipeline (structure → content → review) using Claude Haiku (default) or Sonnet. Handles multi-page cookbook spreads. Extracts: title, ingredients (with quantities, units, preparation), instructions, servings, timing, source attribution.
- **URL Extraction:** Web scraper for recipe sites (JSON-LD, Microdata, HTML parsing).
- **Recipe Detail:** Full detail with collapsible nutrition panel, dietary badges, hero ingredients display, vibe tags, cooking concept. RecipeDetailScreen.tsx. Step notes display in "Your Private Notes" section (added in 7B-Rev), edit mode banner with Exit button, grouped overflow menu. Ingredient rows show 4-level pantry match (8D-CP2) and are tappable (8D-CP3) — tap opens an inline tap-sheet with state-driven actions; a match % banner sits above the section when the recipe isn't fully covered.
- **Recipe Browse:** 3 view modes (grid, list, compact), 8 sort options, multi-criteria filtering (dietary flags, vibe tags, nutrition ranges, course type, serving temperature). RecipeListScreen.tsx.
- **Cookbook/Book View:** BookViewScreen with TOC navigation, chapter organization, completion tracking. Book processing pipeline for batch extraction. *Flagged for UX rebuild in Phase 11.*
- **Recipe Annotations:** Inline editing of ingredients (quantity, unit, name, preparation) and instructions via AnnotationModal system. *Edit Mode redesign deferred to Phase 11.*
- **Cook Soon:** Save recipes to cooking queue. CookSoonScreen.tsx. *Flagged for UX rebuild in Phase 11.*
- **Recipe Classification:** AI-powered on extraction — hero_ingredients, vibe_tags (8 categories with SVG icons), course_type, cooking_concept (78 unique), ingredient_classification.
- **Cooking Mode v2 (Phase 6):** Full step-by-step navigation, swipe between steps, section dots, in-step ingredient sheets, timers (auto-detected from step text), screen-awake during cook, classic and step-focused view modes.

### Social & Feed
- **Cook Logging (LogCookSheet):** Unified bottom sheet for logging cooks. Two modes via `mode` prop — compact (~65% height) from RecipeDetail; full (~90%) from CookingScreen. Half-star slide-to-rate via PanResponder. Modifications field, voice memo placeholder, photo placeholders, helper chips.
- **Times Cooked Tracking:** `recipes.times_cooked` increments on each logged cook. "I've Made This Before" menu item (TimesMadeModal) lets users backfill historical counts.
- **Post Visibility Model:** `posts.visibility` ('everyone' | 'followers' | 'private', default 'everyone'). Private posts never appear on the feed.
- **Feed:** Chronological Strava-style cards. Cook-post-centric architecture (Phase 7I) — every feed unit is a standalone cook post; meal events become detail-screen-only connective tissue with indented linked-cook stacks.
- **Multi-dish meal events:** MealEventDetailScreen (L7) with shared media pool, eater ratings (private per rater), host/attendee editing rights, shared comments thread.
- **Detail screens:** CookDetailScreen (L6), MealEventDetailScreen (L7), EditPostScreen with Strava-style edit flow.
- **Engagement primitives:** yas chef reactions (Frigo's "like"), threaded comments on posts and meal events, photo carousel with failure handling.
- **Historical cook logging (7G), My Posts toggle (7H), Feed card polish (7N), Full post editing (7M)** — all shipped in Phase 7.

### Meals & Planning
- **Meal Creation:** CreateMealModal (heavyweight, Meals-tab entry) + InSheetMealCreate.tsx (in-sheet cook-logging path). *CreateMealModal flagged for UX rebuild in Phase 9.*
- **Meal Calendar:** MealCalendarView with WeekCalendarPicker. *Flagged for UX rebuild in Phase 9.*
- **Meal Invitations:** MealInvitationsCard for pending invites. *Flagged for QA + UX rebuild in Phase 9.*
- **Cooking Partners:** AddCookingPartnersModal, partner approval flow.

### Pantry & Grocery (Phase 8R unified household needs model — shipped CP1 → CP6e; smoke clean 2026-05-15)
- **Unified data model:** Supplies (household items in ongoing stock, cycling `in_stock → low → critical → out`) + Needs (transient household needs, cycling `need → in_cart → acquired`) replace the old separate `pantry_staples` + `grocery_lists` schemas. Pantry surfaces show supplies; grocery "lists" are views (filter expressions over the unified needs bag).
- **PantryScreen:** Rewritten around supplies. SuppliesSection with Attention / Regulars / On Hand sub-groups. Lot-aware SupplyRow with expandable lots list, variant sub-headers, search-within-lots affordance.
- **Supply state cycle:** Tap-to-cycle on non-lots supplies (5-circle dot); tap-to-set in SupplyDetailScreen. Per D8R-Q54-OVERRIDE (2026-05-14), lot-supply badge tap expands the row rather than cycling status — status assignment for lots supplies happens explicitly in SupplyDetail's state strip.
- **Lots model (CP6e):** Opt-in `tracks_lots` flag per supply. Individual physical instances tracked with quantity, storage location, expiration, variant_label, brand. Cook depletion deducts from oldest-expiring compatible lot first. Lot qty=0 auto-flips status to out; lot add auto-restocks status. Lots service: `lib/services/lotsService.ts`.
- **Views (grocery surfaces):** ViewsScreen + ViewDetailScreen replace GroceryListsScreen + GroceryListDetailScreen. 4 default views ship pre-baked (Tonight, This week, All needs, In cart). Custom-view creator. Three render modes: Tier / Aisle / Flat (per-view preference).
- **Regulars zone:** On every view detail, collapsed-by-default strip surfacing supplies whose tags match the view filter. Tap → expanded multi-select. Bridges pantry data → grocery action without context switch.
- **Add-need flow:** AddNeedSheet (3-tier autocomplete: existing supply → fast path; existing need → merge prompt; new item → full configure with optional "Save as regular" toggle). Configure-once-and-done pattern — the supply IS the configuration.
- **Spawn-on-out:** When supply transitions to out, system auto-creates a need tagged with the supply's tags. Toast surfaces with Edit + Undo affordances.
- **Cook depletion:** Per D8R-Q53, cook does NOT auto-demote status anymore. Tracks_lots supplies decrement lot qty (auto-flip to out only when total qty=0); non-tracks_lots supplies do nothing. Users manage status manually.
- **Server-side search:** Multi-token AND across all dimensions (ingredient name/plural/family/type, supply custom_name/brands, supply tags, lot variant_label/brand/notes/storage_location/for_user_ids). Storage synonym map ("frozen" → freezer, etc.). RPC `search_supplies` with tsvector + GIN.
- **Catalog:** ~90 rows added in SF-5 catalog audit (coffee, tea, cheese variants, spices, grains). Plural_name audit completed for mass nouns. Cheese duplicate cleanup shipped (8D-CP1 cheese-cleanup migration + the `cheese`-base demote in 8D-CP1.5 base-set corrections). 8D-CP1.5 backfilled `base_ingredient_id` + `ingredient_subtype` across the catalog (~604 bases, ~108 linked, 10 intentional orphans, ~700 rows subtyped).
- **Multi-space supplies/needs:** Per Q27/Q37, `for_user_ids UUID[]` field. Empty array = household-shared (all current and future members; forward-compatible). Explicit subset = frozen (immune to membership changes).
- **Cross-user smoke:** Tom + Mary household interaction verified 2026-04-28 + 2026-05-15.
- **Recipe-pantry matching:** the matcher (`pantryMatchingService.ts`) is a **4-level** soft match (L1 exact / L2 form-variant / L3 substitute / L4 missing, whitelist-gated) as of 8D-CP2. RecipeDetail shows 4-level indicators + a tappable ingredient tap-sheet + match % banner (CP3); RecipeList carries real `pantry_match` + a "you can make now" badge; the WhatCanICookScreen surfaces the ready-to-cook subset (CP4). See 8D status below.

### Nutrition & Stats
- **Per-Recipe Nutrition:** Collapsible panel on RecipeDetailScreen. Macros (calories, protein, fat, carbs, fiber, sugar, sodium), quality tier badge, USDA-sourced. **Vitamins & minerals sub-toggle (Phase 10C, 2026-05-27)** — 10 micros (Vitamin A, C, D, B12, Folate, Iron, Calcium, Potassium, Magnesium, Zinc) with FDA RDI-based Daily Value percentages and a "USDA data / directional, not for medical use" disclaimer.
- **Per-Meal Nutrition (Phase 10E, 2026-05-27):** New `MealNutritionPanel` on `MealEventDetailScreen` and `MealDetailScreen` aggregates one serving of each dish across all linked recipes. Same Vitamins/Minerals sub-toggle pattern as the recipe panel. Surfaces partial-data notice ("Nutrition shown for X of Y dishes") when some dishes lack recipe links.
- **Raw vs. cooked accounting (Phase 10A, 2026-05-27):** `ingredient_state` column + `recipe_nutrition_computed` matview rewrite — `cooked_ratio` now applies only when an ingredient row is explicitly tagged `cooked`. Fixes systematic over-counting on raw-state recipes; verified against a 5-recipe control set.
- **Dietary Badges:** 8 flags (vegetarian, vegan, gluten-free, dairy-free, nut-free, shellfish-free, soy-free, egg-free) computed from ingredient data. Displayed on post cards and recipe detail. *FDA Big 9 gaps (peanuts/fish/sesame as separate flags) tracked as P10F-1.*
- **Dietary Preferences (Phase 10F, 2026-05-27):** New `DietaryPreferencesScreen` under Settings → Preferences with DIETARY STYLE / AVOID / BEHAVIOR sections. `auto_apply_to_browse` boolean pre-populates `RecipeListScreen.advancedFilters.dietaryFlags`; a "From your dietary preferences 🥬 / Show all" indicator above the filter row gives a one-tap escape hatch. Onboarding integration deferred to Phase 12 (P10F-2).
- **Cooking Stats Dashboard (Phase 4 + Phase 10D):** Comprehensive stats system in the "You" tab — Overview, Recipes, Nutrition, Insights sub-pages with drill-downs. **Phase 10D (2026-05-27)** replaced the 🔬 placeholder card on the Nutrition sub-page with a real Micronutrients section (Vitamins/Minerals subsections, DV%, drill-down + trend chart per nutrient) and hoisted the Per Day / Per Meal toggle out of the Goals card to a shared position above both Goals and Micronutrients. Data layer: statsService.ts (extended to include 10 new micro keys + per-meal averages). *Note: 2 stale `pantry_items` query sites in statsService.ts flagged as T8 cross-cutting tech debt — read from a dropped table, return empty silently. Audit pass scheduled with 8D-CP1.*

---

## 🐛 Known Issues & Limitations

Most Phase 7-era known issues are now tracked in `DEFERRED_WORK.md` under the "From Phase 7" section. Current cross-cutting concerns:

**8R closeout residuals (2026-05-15):**
- 5 stale `pantry_items` query sites in spaceService.ts (3) + statsService.ts (2) — read from dropped table. T8 cross-cutting tech debt. Audit pass scheduled with 8D-CP1 (per-site decision: dead code → delete, or live feature → re-point to `supplies`).
- D8R-Q54-OVERRIDE wireframe-divergence — wireframes still show original Q54 design (LotBadge tap = cycle-status); code is authoritative (LotBadge tap = expand-row per CP6e-SmokeFix-SF2).
- File renames partial: `GroceryListsScreen.tsx` → `ViewsScreen.tsx` and `GroceryListDetailScreen.tsx` → `ViewDetailScreen.tsx` (CP6c, pending CC cleanup pass verification).

**Data quality:**
- ~347 recipe image storage files with uppercase/double-extension filenames need normalization (P7-72)
- `posts.photos` JSONB shape normalization (mix of string-array and object-array forms — P7-73)
- Potential broken URL patterns on ~173 recipes (P7-79)
- Cooking time data sparse: 60/475 recipes have `prep_time_min`/`cook_time_min` (P6-1)
- Cheese duplicate ingredient rows (feta/feta cheese, mozzarella/mozzarella cheese, etc.) — cleanup migration bundled as 8D-CP1 Part 0.

**Infrastructure:**
- ~~`supabase/migrations/` tracking not yet set up; multiple direct-in-Supabase migrations run without version control~~ — **RESOLVED 2026-06-09 (P7-23):** CLI-tracked; baseline `20260609155555`; 20 pre-baseline files archived to `supabase/migrations_provenance/`. See `docs/MIGRATIONS.md`.
- Schema change propagation discipline — T3 cross-cutting item

**Deprecated but not yet deleted:**
- `posts.make_again` column (P7-2)
- Several files queued for CC cleanup pass (`lib/types/grocery.ts`, `lib/oldTheme.ts`, `components/cooking/PostCookFlow.tsx`)

See `DEFERRED_WORK.md` for the full backlog.

---

## 🎯 What's Next

### Active phase

**Active phase:** Phase 8 — Pantry & Grocery (Household Needs). Document: `PHASE_8_PANTRY_AND_GROCERY.md` (merged from PHASE_8_PANTRY_INTELLIGENCE + PHASE_8R_UNIFIED_NEEDS on 2026-05-15).

**Status as of 2026-05-19:**
- ✅ **8A** Schema foundation + pantry polish (shipped pre-refactor)
- ✅ **8B** Staples & depletion (shipped pre-refactor; staples became supplies in 8R)
- 🟡 **8C / 8C-Shared** Partially shipped (CP1-CP4a + CP4a) — superseded by 8R for CP4b/CP4c + CP5-CP8 + 8C-Shared CP3-CP4
- 🟢 **8R Unified household needs refactor** — CP1 → CP6e shipped (2026-04-29 → 2026-05-13). SmokeFix-SF1/SF2/SF3 + catalog SF-5 shipped 2026-05-14. Smoke validation passed clean 2026-05-15.
- 🟢 **8D** Recipe-pantry matching — **CP1 (matching primitive) + CP1.5 (catalog variant linkage backfill) shipped 2026-05-19.** CP1.5 drove the Pantry catalog orphan rate to 0 and built the soft-match scaffolding (`ingredient_subtype` + `form`; ~700 rows subtyped). **CP2 (matcher 4-level logic) is the next checkpoint; data scaffolding ready.** Catalog data is F&F-ready; matcher behavior is still binary pending the CP2 build (DEFERRED_WORK T20). F&F-blocker. See `PHASE_8D_PLANNING.md`.
- 🔲 **8E** Recipe discovery polish + natural search — F&F-relevant subset deferred to after 8D.

**8R closeout — remaining work (in flight):**
- 🟢 Doc reconciliation (this 2026-05-15 session — merged phase doc shipped, DEFERRED_WORK v5.20 shipped, FF_LAUNCH_MASTER_PLAN v6.4 shipped, PROJECT_CONTEXT v10.3 staged)
- 🔲 CC repo cleanup pass (filename rename verification, dead-file deletions, 5 stale pantry_items site audit)
- 🔲 FRIGO_ARCHITECTURE.md refresh (dedicated session — ~3 weeks stale)
- 🔲 CP6e commit batch landing (CC git workflow)
- 🔲 8R closeout marker

**F&F LAUNCH TARGET:** **Late August or early September 2026** (slipped from late July/August after CP6e-Lots scope addition 2026-05-06). ~100-200 testers via Expo Go. 14-18 weeks of remaining work per dashboard v2 arithmetic; 32-51 build sessions across Phases 8D–12.

**Parallel admin track (status as of 2026-05-15):**
- ✅ LLC formed
- ✅ Frigo domain acquired
- 🔲 D-U-N-S number — unknown state (resolves naturally when Apple Developer enrollment kicks off; Apple looks up D-U-N-S via D&B database)
- 🔲 Minimal website at the domain (Apple requires publicly accessible site with matching-domain email)
- 🔲 Apple Developer Program enrollment as organization (not started — longest-pole non-code F&F risk; gates everything in Phase 12)

**Next-session priorities:**
1. Tom kicks off admin track this/next week: confirm D-U-N-S via Apple's lookup → stand up minimal one-pager → start Apple Developer org enrollment
2. Claude.ai drafts `CC_PROMPT_8D_CP1.md` (matching primitive + pre-written cheese cleanup SQL + form comparison + 5 stale pantry_items site fixes)
3. After CC repo cleanup pass: review audit reports for filename rename completion + stale pantry_items site disposition

### After Phase 8 (F&F-blocking phases)
- **Phase 9 — Meal & Planning UX** (pre-launch; includes flex meal planning v1 + cross-meal dedup)
- ✅ **Phase 10 — Nutrition Depth** — **shipped 2026-05-27** (10A raw/cooked fix + 10B USDA micronutrient backfill + 10C recipe UI + 10D stats UI + 10E meal UI + 10F dietary preferences + URL-length chunking hot fix). See `FF_LAUNCH_MASTER_PLAN.md` Phase 10 section.
- **Phase 11 (Recipe Polish) — Active.** 11A (Browse rebuild): CP1–CP4 shipped 2026-05-28 (foundational model, home tiles + cuisine, refine surface, refine sheet). CP5 (card low-stock chips + WhatCanICook absorption) outstanding. Remaining Phase 11 sub-phases (11B–11H: extractors, cookbook UX, cook soon UX, concept cooking, substitutions v0, folders stretch) outstanding, not yet scoped. See `docs/PHASE_11_RECIPE_POLISH.md`.
- **Phase 12 — Distribution & Testing** — TestFlight build, Apple Developer org distribution, tester onboarding

**Note:** Phase scope is adaptive. See `FF_LAUNCH_MASTER_PLAN.md` and individual phase docs for current scope.

### Post-F&F
- AI pantry photo recognition (onboarding moonshot)
- Grocery account integration to populate supplies
- Full micronutrient import (beyond curated 12)
- Public website
- Smart ingredient substitutions (beyond v0; pairs with concept cooking)
- Concept cooking depth (beyond first-stab)
- Linecook competitor diligence (action item to schedule)
- Quantity-aware recipe-pantry matching (post-8D when tracks_lots adoption surfaces demand)
- Category-level pantry matching ("any cheese", "any dried pasta")
- Recipe substitution engine
- See `FF_LAUNCH_MASTER_PLAN.md` "Deferred to Post-F&F" for full list.

---

## 📊 Data Metrics (as of April 6, 2026 — stale; refresh post-8D)

| Metric | Value |
|--------|-------|
| Recipes | 475 (Simple 132, Cook This Book 131, Plenty 120, That Sounds So Good 88, Other ~4) |
| Ingredients | ~480 (450 with USDA nutrition); +90 added in 8R-CP6e-Catalog-SF5 |
| recipe_ingredient rows | 5,322 (90.8% matched to USDA) |
| Nutrition quality | 43 high, 236 good, 183 rough, 21 incomplete |
| Cooking concepts | 78 unique (salad 68, composed_plate 50, roast 47, soup 24, pasta 19...) |
| Posts | 1,740 (seeded test data) + Phase 7 activity |
| Meals | 285 + Phase 7 activity |
| Chef's kisses | 3,860 + Phase 7 activity |
| Active users | 19 (2 real + 17 test) |
| SVG icon components | 79+ |
| Stats service functions | 38 exported |
| Stats UI components | ~30 (in components/stats/) |

*Metrics last refreshed April 6, 2026. Phase 7 + 8R activity adds an unknown delta. Refresh during 8D planning if relevant to matching work.*

---

## 🗓 Project Vision

| Phase | Status |
|-------|--------|
| 1: Core recipes + AI extraction | ✅ Complete |
| 2: Social, meals, shared spaces | ✅ Complete |
| 3: Nutrition data + dietary + recipe browse | ✅ Complete |
| 4: Cooking stats dashboard | ✅ Complete (Mar 3-5, 2026) |
| 5: Ingredient architecture + critical fixes | ✅ Complete |
| 6: Cooking mode v2 | ✅ Complete |
| 7: Social & feed polish | ✅ Complete (2026-04-17 — 13 sub-phases shipped) |
| 8: Pantry & Grocery (Household Needs) | ✅ Complete pending cleanup pass — 8R (CP1→CP6e) + 8D (CP1→CP4, CP5 bundled into CP3) shipped 2026-05-19. **8E retired → merged to Phase 11.** |
| 9: Meal & planning UX | 🔲 Planned |
| 10: Nutrition depth | 🔲 Planned |
| 11: Recipe polish | 🔲 Planned |
| 12: Distribution & testing | 🔲 Planned |
| F&F Launch | 🎯 Target: late August or early September 2026 |
| Beyond: AI pantry vision, grocery integration, full micros, web, social depth | 💡 Post-F&F |

---

## 🔎 Related Documentation

### Strategic Planning
- **FF_LAUNCH_MASTER_PLAN.md** — F&F launch strategy, phase sequence, scope decisions, timeline, risk register

### Living Docs (Claude.ai owns, updated at phase boundaries)
- **Active phase doc** — `PHASE_8_PANTRY_AND_GROCERY.md` (merged 2026-05-15)
- **8D scoping doc** — `PHASE_8D_PLANNING.md` (v0.2, all decisions locked, ready for CP1 prompt drafting)
- **FRIGO_ARCHITECTURE.md** — codebase map, services, patterns (refresh pending — ~3 weeks stale)
- **DEFERRED_WORK.md** — master backlog
- **DOC_MAINTENANCE_PROCESS.md** — planning/execution workflow, doc allocation rules, archive lifecycle

### Archived Phase Docs (historical reference, in `docs/archive/phases/`)
- `PHASE_1_RECIPES_EXTRACTION.md`
- `PHASE_2_SOCIAL_MEALS_SPACES.md`
- `PHASE_3_NUTRITION_BROWSE.md`
- `PHASE_4_COOKING_STATS.md`
- `PHASE_5_INGREDIENT_ARCHITECTURE.md`
- `PHASE_6_COOKING_MODE.md`
- `PHASE_7I_MASTER_PLAN.md` (absorbed into PHASE_7 appendix 2026-04-20)
- `PHASE_RECIPE_DISCOVERY.md`
- `PHASE_8_PANTRY_INTELLIGENCE.md` (merged into PHASE_8_PANTRY_AND_GROCERY.md 2026-05-15)
- `PHASE_8R_UNIFIED_NEEDS.md` (merged into PHASE_8_PANTRY_AND_GROCERY.md 2026-05-15)
- `PHASE_7_SOCIAL_FEED.md` will move here when Phase 8 ships fully (warm-one-phase rule)

### Feature Specs (reference when modifying those areas)
- `CONCEPT_FLEXIBLE_MEAL_PLANNING.md` — flexible meal planning spec, Phase 9 source
- `SHARED_PANTRIES_FEATURE_SPEC.md` — shared pantries spec, foundation for 8R household-subset supplies model

### Reference Data (in PK)
- `Frigo_Roadmap_Decision_Document` — March 2026 strategic analysis (decision boxes + domain-by-domain F&F readiness assessment)
- `Frigo_Wireframes_Companion.pdf` — visual reference for cooking mode, rating UX, onboarding
- Supabase DB schema CSVs (snapshot dated 2026-05-13 — refresh during 8D-CP1 if matching schema queries surprise)
- Product Feature Roadmap CSV

### Archive Structure (in `docs/archive/`)
- `phases/` — completed phase docs
- `handoffs/` — completed handoff docs, consolidated change lists
- `prompts/` — consumed CC prompts (44 archived 2026-05-15)
- `session_logs/` — archived session logs at phase boundaries
- `design_decisions/` — design decision docs
- `wireframes/` — wireframe HTMLs (7F canonical + earlier iteration archived)

---

## 📞 For Future Claude Sessions

1. Read this document first
2. Read FF_LAUNCH_MASTER_PLAN.md for the F&F launch strategy
3. Check the active phase doc (`PHASE_8_PANTRY_AND_GROCERY.md`) for current goals and decisions; if working on 8D specifically, read `PHASE_8D_PLANNING.md` too
4. Check FRIGO_ARCHITECTURE.md for codebase map (note: ~3 weeks stale as of 2026-05-15; refresh pending)
5. Check `DEFERRED_WORK.md` for known limitations; `DOC_MAINTENANCE_PROCESS.md` for workflow rules
6. Ask clarifying questions before diving in
7. **Services handle ALL DB calls** — never query Supabase from components
8. **Never remove existing functionality** unless explicitly told to
9. **Verify, don't assume** — be explicit about what needs testing
10. For complex multi-day tasks, suggest spinning up a focused subproject

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-19 | 10.7 | **Phase 8 close-out + 8E→Phase 11 merge.** 8D end-of-phase reconciliation: 8E retired as a standalone sub-phase; F&F-relevant CPs (8E-CP1 Browse rebuild, 8E-CP3 Locked filter chips, 8E-CP4 Low stock indicators) merged into Phase 11 must-haves. 8E-CP2 Natural-language search stays post-launch. F&F readiness criterion = Phases 8, 9, 10, 11, 12 complete (made explicit). Phase 8 marked complete pending the 8D cleanup pass (console.warn removal, T29 smoke realignment, PHASE_8D_PLANNING refresh, PK_CODE_SNAPSHOTS). |
| 2026-05-19 | 10.6 | **8D-CP4 ship — Phase 8D essentially complete.** 8D-CP4 (What-can-I-cook screen + RecipeList match wiring) shipped — `readyToCookService.ts`, `useReadyToCookRecipes` hook, `RecipeCard.tsx` (extracted), `WhatCanICookScreen.tsx` all new; RecipeList `pantry_match`/`canMakeCount` wired; PantryScreen CTA. Status lines + phase table + the stale "matching is still binary" feature note updated to reflect CP1→CP4 all shipped. |
| 2026-05-19 | 10.5 | **8D-CP3 ship + 8D status catch-up.** 8D-CP3 (recipe ingredient tap-sheet + match % banner; CP5 bundled) shipped — `IngredientTapSheet.tsx` created, IngredientsSection rows tappable, `MatchedIngredient.supplyStatus` added. Status lines brought current: the doc still read "CP2 next" despite CP2 + CP2-patch having shipped earlier 2026-05-19 — header status, Recipe Detail feature note, and the phase table row updated to reflect CP1 → CP3 shipped. NOTE: this doc was 2+ checkpoints stale; a fuller 8D reconciliation is recommended for Claude.ai (the 10.4 version bump has no changelog row). |
| 2026-05-15 | 10.3 | **8R closeout + 8D verification + doc merge.** Status caught up to 2026-05-15 reality: Phase 8R CP1 → CP6e shipped, smoke validation passed clean, doc reconciliation in flight. 8D verified NOT SHIPPED (code-level grep, zero matching-function references). Scoping doc `PHASE_8D_PLANNING.md` v0.2 complete with all 13 decisions locked. F&F target wording aligned to **late August or early September 2026** across header + What's Next + Project Vision. Active phase pointer updated from `PHASE_8R_UNIFIED_NEEDS.md` to merged `PHASE_8_PANTRY_AND_GROCERY.md`. Archived phase doc list updated (PHASE_8_PANTRY_INTELLIGENCE.md + PHASE_8R_UNIFIED_NEEDS.md moved to docs/archive/phases/). App Structure table updated: ViewsScreen/ViewDetailScreen replace GroceryListsScreen/GroceryListDetailScreen (rename pending CC cleanup pass). What Works pantry/grocery section rewritten around 8R unified model (supplies, needs, views, lots, server-side search, multi-space supplies/needs). Known Issues section adds 8R closeout residuals (5 stale pantry_items sites flagged T8, D8R-Q54-OVERRIDE wireframe-divergence, partial filename rename). Admin track status captured: LLC ✓, domain ✓, D-U-N-S unknown, Apple Developer org not started. Tech Stack note adds tsvector + RPC search_supplies (CP6e). |
| 2026-04-29 | 10.2 | **Phase 8R reframe + wireframes complete with audit cycle.** Active phase shifts from Phase 8 to Phase 8R after 2026-04-29 architectural walkthrough. 8C-Shared work shipped 2026-04-28 becomes background; existing pantry + grocery data nuked at 8R-CP1. F&F target slips late July / August. Same-day wireframe iteration + audit pass + audit follow-up: 12 surfaces, 37 decisions (Q1-Q37), wireframes consolidated to single file at `docs/wireframes/phase_8r/`. CP1 schema design is the next handoff. |
| 2026-04-22 | 10.1 | **Post-v6 master plan reconciliation.** Phase 7P introduced in "What's Next" as a 1-2 session pre-Phase-8 feed polish pass (P7-44 pagination + P7-45 hang investigation). Phase 8 "Immediate" bullets updated. Phase 9 entry in "After Phase 8" list corrected. No scope or strategic changes — purely reconciling PROJECT_CONTEXT to match FF_LAUNCH_MASTER_PLAN v6.0 state. |
| 2026-04-21 | 10.0 | **Phase 7 completion + doc maintenance overhaul.** Marked Phase 7 complete (all 13 sub-phases shipped 2026-04-17). Phase 8 (Pantry Intelligence + UX Overhaul) in planning. Documentation workflow overhauled: repo-as-canonical established, `docs/archive/` structure created, `_pk_sync/` workflow folder introduced, PK pruned to ~10 essential files. |
| 2026-04-13 | 9.4 | **Phase 7F Fix Passes 7–9 complete; Phase 7I planning session complete (supersedes D44).** Architectural redesign of Phase 7I: retire meal cards from the feed entirely; every feed unit becomes a solo cook post. Seven wireframe states locked. Master plan with 7 sequential checkpoints. Decisions D41/D44/D45/D46 superseded by D47. Phase 7I scope grew from 3-5 to 7-10 sessions. |
| 2026-04-09 | 9.3 | **Schema CSV refreshed from Supabase export.** Future planning instances should treat the live database as authoritative; the CSV is a snapshot. |
| 2026-04-09 | 9.2 | **Phase 7F wireframe session complete.** Six iteration passes locked the multi-cook feed rendering design. Six new decisions D41–D46. Two-level photo model (D46), eater rating model wireframed and deferred (D43), G4rr-b grouped meal pattern locked as target for Phase 7I (D44). |
| 2026-04-07 | 9.1 | **Phase 7D scoping reframing.** 7C marked done. 7D split into three sub-phases (7D data + service layer / 7E cook→meal handoff UX / 7F feed rendering). Old D12 retired as D21. Old 7E–7J renumbered to 7G–7L. Total Phase 7 estimate grew from 12-18 to 14-21. |
| 2026-04-06 | 9.0 | **Phase 5/6 complete, Phase 7 active, master plan reconciled.** Marked Phases 5 and 6 ✅ Complete. Updated phase sequence from 4 phases (5-8) to 8 phases (5-12). Pulled into pre-launch scope: micronutrients, meal-level nutrition, nutrition source labeling, dietary preferences capture, cookbook UX, cook soon UX, meal flows, concept cooking first-stab, ingredient substitutions v0, Edit Mode redesign. Target launch revised from late May to early-to-mid June. |
| 2026-03-17 | 8.0 | **F&F launch planning complete.** Phases 5-8 defined. Master plan doc created. |
| 2026-03-05 | 7.0 | **Phase 4 complete.** Added Cooking Stats Dashboard to "What Works." |
| 2026-03-02 | 6.0 | Documentation system overhaul. New doc maintenance process. Phase 3 marked complete. |

---

**Remember:** See DOC_MAINTENANCE_PROCESS.md for the full documentation workflow.
