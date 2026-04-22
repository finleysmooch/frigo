# Frigo - Project Context
**Last Updated:** April 21, 2026
**Version:** 10.0
**Status:** Active Development — Phase 7 ✅ Complete (all 13 sub-phases shipped 2026-04-17). Phase 8 (Pantry Intelligence + UX Overhaul) in planning. F&F launch target: early-to-mid June 2026. Doc maintenance workflow overhauled 2026-04-20/21: repo-as-canonical established, archive structure created at `docs/archive/`, `_pk_sync/` workflow folder introduced, PK pruned to lean working set.

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
- Manage pantry inventory with shared household pantries
- Generate and manage grocery lists
- Browse recipes with rich metadata (hero ingredients, vibe tags, dietary info, nutrition)
- View recipe nutrition and dietary information
- Search and filter recipes by multiple criteria (dietary flags, vibe tags, nutrition, course type, serving temp)

### Tracking
Code and features tracked in **FRIGO_TRACKER** (Google Sheets). Claude Code uses CLAUDE.md in repo root for session logging and tracker row generation.

### Documentation System

**Claude.ai is the planning brain — it owns all living docs:**
- **FF_LAUNCH_MASTER_PLAN.md** — strategic plan for F&F launch, phase sequence, scope decisions, timeline
- **Active phase doc** (currently `PHASE_8_PANTRY_INTELLIGENCE.md`) — goals, decisions, progress, deferred items for the active phase
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
3. **Active phase doc** (`PHASE_8_PANTRY_INTELLIGENCE.md`) — current goals, decisions, progress
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
- **State:** React hooks (useState, useEffect) + React Context (SpaceContext for shared pantries)
- **Icons:** 79+ custom SVG components via react-native-svg across 4 groups (recipe/vibe/pantry/filter), now including PencilIcon
- **Charts:** react-native-svg for line charts (WeeklyChart), donut charts (StatsNutrition), heatmaps, bubble maps

### Backend
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password)
- **Storage:** Supabase Storage (recipe photos, post photos, profile images)
- **Edge Functions:** Deno (recipe extraction three-pass, book processing pipeline, web scraping)

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
| **Pantry** | PantryStack | PantryScreen → SpaceSettingsScreen |
| **Grocery** | GroceryStack | GroceryListsScreen → GroceryListDetailScreen |
| **You** | StatsStack | StatsScreen (Cooking Stats / My Posts) → DrillDown, ChefDetail, BookDetail, UserPosts, RecipeDetail, Profile, Settings |

Also: StoresScreen, AdminScreen (dev tools), CookSoonScreen (saved recipes queue)

### Context Providers
- **SpaceProvider** (SpaceContext.tsx) — wraps entire authenticated app. Manages shared pantry spaces, active space selection, invitations.
- **ThemeProvider** (ThemeContext.tsx) — color scheme management
- **LogoConfigProvider** (LogoConfigContext.tsx) — logo variant selection

---

## ✅ What Works (as of April 6, 2026)

### Recipe System
- **AI Photo Extraction:** Three-pass pipeline (structure → content → review) using Claude Haiku (default) or Sonnet. Handles multi-page cookbook spreads. Extracts: title, ingredients (with quantities, units, preparation), instructions, servings, timing, source attribution.
- **URL Extraction:** Web scraper for recipe sites (JSON-LD, Microdata, HTML parsing).
- **Recipe Detail:** Full detail with collapsible nutrition panel, dietary badges, hero ingredients display, vibe tags, cooking concept. RecipeDetailScreen.tsx. Now includes step notes display in "Your Private Notes" section (added in 7B-Rev), edit mode banner with Exit button, and grouped overflow menu with view mode subheader.
- **Recipe Browse:** 3 view modes (grid, list, compact), 8 sort options, multi-criteria filtering (dietary flags, vibe tags, nutrition ranges, course type, serving temperature). RecipeListScreen.tsx.
- **Cookbook/Book View:** BookViewScreen with TOC navigation, chapter organization, completion tracking. Book processing pipeline for batch extraction. *Flagged for UX rebuild in Phase 11.*
- **Recipe Annotations:** Inline editing of ingredients (quantity, unit, name, preparation) and instructions via AnnotationModal system. *Edit Mode redesign deferred to Phase 11.*
- **Cook Soon:** Save recipes to cooking queue. CookSoonScreen.tsx. *Flagged for UX rebuild in Phase 11.*
- **Recipe Classification:** AI-powered on extraction — hero_ingredients, vibe_tags (8 categories with SVG icons), course_type, cooking_concept (78 unique), ingredient_classification.
- **Cooking Mode v2 (Phase 6):** Full step-by-step navigation, swipe between steps, section dots, in-step ingredient sheets, timers (auto-detected from step text), screen-awake during cook, classic and step-focused view modes.

### Social & Feed
- **Cook Logging (LogCookSheet):** Unified bottom sheet for logging cooks. Two modes via `mode` prop — compact (~65% height) opens from RecipeDetailScreen primary "Log This Cook" CTA; full (~90%) opens from CookingScreen "Done cooking". Half-star slide-to-rate via PanResponder (teal, supports 0.5 increments, slide-left-to-clear). Keyboard handling via `KeyboardAvoidingView` + `InputAccessoryView` Done button + tap-outside-to-dismiss. Modifications field, voice memo placeholder, photo placeholders, helper chips.
- **Times Cooked Tracking:** `recipes.times_cooked` increments on each logged cook. "I've Made This Before" menu item (TimesMadeModal) lets users backfill historical cook counts without creating fake-dated posts. Real backdated posts come in 7E.
- **Post Visibility Model:** `posts.visibility` ('everyone' | 'followers' | 'private', default 'everyone'). "Just log it" creates private posts that never appear on the feed. Legacy posts with NULL visibility are treated as public.
- **Post Creation (PostCreationModal):** Recipe linking, photo upload, cooking partner tagging, dietary badge auto-display, meal association. *Being deprecated for cook-logging in favor of LogCookSheet (Phase 7B). Still used for non-cook post types.*
- **Feed:** Chronological Strava-style cards (PostCard.tsx) with stat rows (cook time, servings, rating), dietary badge row, chef's kiss interaction. FeedScreen.tsx. Now filters out private posts.
- **Interactions:** Chef's kiss (reaction), comments (CommentsScreen), user profiles, following system.
- **User Profiles:** ProfileScreen with avatar, display name, follower/following counts.
- **Recipe Detail Overflow Menu:** Grouped layout (plan / view / delete) with icons, view mode radios, edit mode toggle (PencilIcon component with filled state), delete with confirmation. Tom flagged for post-F&F iteration.
- **Edit Mode Banner:** Visible indicator when editing a recipe, with Exit button. Minimum-viable shipped in 7B-Rev. Full notebook-aesthetic redesign deferred to Phase 11.

### Meals & Planning
- **Meal Creation:** CreateMealModal with dishes (recipe-linked or freeform), participants, date/time scheduling. *Flagged for UX rebuild in Phase 9.*
- **Meal Calendar:** MealCalendarView with WeekCalendarPicker, week navigation. *Flagged for UX rebuild in Phase 9.*
- **Meal Invitations:** MealInvitationsCard for pending invites. *Flagged for QA + UX rebuild in Phase 9.*
- **Cooking Partners:** AddCookingPartnersModal, partner approval flow.

### Pantry & Grocery
- **Pantry:** PantryScreen with inline editing (quantity, storage location, expiration), SVG category icons, search. *Flagged for UX overhaul in Phase 8.*
- **Shared Spaces:** Full space system — create, invite (owner/member/guest roles), switch active space. SpaceContext global state.
- **Grocery Lists:** Multiple lists, regular items, store association, check-off interaction. GroceryListsScreen → GroceryListDetailScreen. *Flagged for UX overhaul in Phase 8.*

### Nutrition & Stats
- **Per-Recipe Nutrition:** Collapsible panel on RecipeDetailScreen. Macros (calories, protein, fat, carbs), quality tier badge, USDA-sourced.
- **Dietary Badges:** 8 flags (vegetarian, vegan, gluten-free, dairy-free, nut-free, shellfish-free, soy-free, egg-free) computed from ingredient data. Displayed on post cards and recipe detail.
- **Cooking Stats Dashboard (Phase 4):** Comprehensive stats system in the "You" tab with 4 sub-pages:
  - **Overview:** CalendarWeekCard (7-day emoji grid with streak badge), WeeklyChart (5 chart modes: frequency, calories, protein, fat percentage, vegetarian percentage), gateway insight cards, cooking frequency/partner stats.
  - **Recipes:** Kitchen Staples / Frontier Discovery framing, MostCookedPodium, ConceptBubbleMap, signature ingredients with family chips, FrontierCards suggestions, cookbook progress.
  - **Nutrition:** SVG donut chart (macro breakdown), inline nutrient drill-downs per ingredient, nutrition goals (pending migration), dietary balance tiles.
  - **Insights:** CookingPersonalityCard (template narrative with tag pills), GrowthTimeline (monthly milestones), diversity score with DiversityBadge, complexity trend, seasonal patterns, time-of-day heatmap.
  - **Drill-Downs:** DrillDownScreen (reusable for cuisine/concept/method/ingredient), ChefDetailScreen, BookDetailScreen.
  - **Global controls:** PeriodToggle (12W/6M/1Y rolling windows), MealTypeDropdown, time navigation arrows. Sticky control bar.
  - **Data layer:** statsService.ts — 38 exported functions, services-only pattern.

### Social Feed & Posts (Phase 7, completed 2026-04-17)
Full social layer shipped across 13 sub-phases (7A-7N + 7M):
- **Cook-post-centric feed architecture** — every feed card is a standalone cook post authored by one person; meal events become detail-screen-only connective tissue. Linked cook posts render as indented Strava-style stacks with a left-gutter connector.
- **LogCookSheet** — compact + full modes, smart meal-detection ("was this part of a planned meal?"), partner tagging with external-participant support, in-sheet meal creation, four-value visibility enum, half-star slide-to-rate.
- **Multi-dish meal events** — meal event detail screen (L7) with shared media pool, eater ratings (private per rater), host/attendee editing rights, shared comments thread.
- **Detail screens** — CookDetailScreen (L6) with narrow-scope editing, MealEventDetailScreen (L7), EditPostScreen with Strava-style edit flow.
- **Engagement primitives** — yas chef reactions (Frigo's "like"), threaded comments on posts and meal events, photo carousel with failure handling and NoPhotoPlaceholder fallback.
- **Historical cook logging (7G)** — log past cooks without creating feed posts.
- **My Posts toggle (7H)** — active in the You tab.
- **Feed card polish (7N)** — multi-photo carousel, Strava-style swipe restructure, star picker stay-open, inline engagement bar.
- **Full post editing (7M)** — cooking method tagging, dirty-state + delete, meal picker enhancement.

---

## 🐛 Known Issues & Limitations

Most Phase 7-era known issues are now tracked in `DEFERRED_WORK.md` under the "From Phase 7" section. Current cross-cutting concerns:

**Data quality:**
- ~347 recipe image storage files with uppercase/double-extension filenames need normalization (P7-72)
- `posts.photos` JSONB shape normalization (mix of string-array and object-array forms — P7-73)
- Potential broken URL patterns on ~173 recipes (P7-79)
- Cooking time data sparse: 60/475 recipes have `prep_time_min`/`cook_time_min` (P6-1)

**Infrastructure:**
- `supabase/migrations/` tracking not yet set up; 8+ direct-in-Supabase migrations run without version control (P7-23)
- Schema change propagation discipline — T3 cross-cutting item

**Deprecated but not yet deleted:**
- `posts.make_again` column (P7-2)
- `PostCookFlow.tsx` (P7-3)

See `DEFERRED_WORK.md` for the full backlog.

---

## 🎯 What's Next

### Immediate (Phase 8 planning, starting 2026-04-21)
Phase 8 covers pantry intelligence + UX overhaul. Scope in `PHASE_8_PANTRY_INTELLIGENCE.md`:
- **Pantry UX overhaul** (8A) — expiration visibility, organization, usability
- **Grocery UX overhaul** (8B) — shopping flow, multi-list clarity
- **Recipe-pantry matching (#57)** (8C) — scoring, browse mode, pantry shortcut, missing-to-grocery one-tap
- **Flexible meal planning v1** (8D) — locked + shortlisted commitment levels per `CONCEPT_FLEXIBLE_MEAL_PLANNING.md`
- **NYT Cooking scoping (#15)** (8E) — 1 session to scope, possibly build if feasible

Estimated: 6-12 sessions depending on UX overhaul scope and NYT outcome.

### After Phase 8 (F&F-blocking phases)
- **Phase 9 — Meal & Planning UX** (post-F&F per master plan)
- **Phase 10 — Nutrition Depth** (per master plan)
- **Phase 11 — Recipe Polish** (per master plan)
- **Phase 12 — Distribution & Testing** — TestFlight build, Apple Developer Account, tester onboarding

**Note:** Phase scope is adaptive. See `FF_LAUNCH_MASTER_PLAN.md` and individual phase docs for current scope.

### Post-F&F
- AI pantry photo recognition (onboarding moonshot)
- Grocery account integration to populate pantry
- Full micronutrient import (beyond curated 12)
- Public website
- Smart ingredient substitutions (beyond v0)
- Concept cooking depth (beyond first-stab)
- Linecook competitor diligence (action item to schedule)
- See `FF_LAUNCH_MASTER_PLAN.md` "Deferred to Post-F&F" for full list.

---

## 📊 Data Metrics (as of April 6, 2026)

| Metric | Value |
|--------|-------|
| Recipes | 475 (Simple 132, Cook This Book 131, Plenty 120, That Sounds So Good 88, Other ~4) |
| Ingredients | ~480 (450 with USDA nutrition) |
| recipe_ingredient rows | 5,322 (90.8% matched to USDA) |
| Nutrition quality | 43 high, 236 good, 183 rough, 21 incomplete |
| Cooking concepts | 78 unique (salad 68, composed_plate 50, roast 47, soup 24, pasta 19...) |
| Posts | 1,740 (seeded test data) |
| Meals | 285 |
| Chef's kisses | 3,860 |
| Active users | 19 (2 real + 17 test) |
| SVG icon components | 79+ (across recipe/vibe/pantry/filter groups, plus PencilIcon) |
| Stats service functions | 38 exported |
| Stats UI components | ~30 (in components/stats/) |
| Phase 4 sessions | 40 (A1-E2, G1-G3, H0-H6, I1-I8h) |

*Metrics last refreshed April 6, 2026. Phase 7 activity adds an unknown number of test posts, cook relationships, eater ratings, and meal events from 78 shipped items across 13 sub-phases. Refresh during Phase 8 planning if relevant to pantry intelligence work.*

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
| 8: Pantry intelligence + UX overhaul | 🔄 Planning (started 2026-04-21) |
| 9: Meal & planning UX | 🔲 Planned |
| 10: Nutrition depth | 🔲 Planned |
| 11: Recipe polish | 🔲 Planned |
| 12: Distribution & testing | 🔲 Planned |
| F&F Launch | 🎯 Target: early-to-mid June 2026 |
| Beyond: AI pantry vision, grocery integration, full micros, web, social depth | 💡 Post-F&F |

---

## 🔎 Related Documentation

### Strategic Planning
- **FF_LAUNCH_MASTER_PLAN.md** — F&F launch strategy, phase sequence, scope decisions, timeline, risk register

### Living Docs (Claude.ai owns, updated at phase boundaries)
- **Active phase doc** — `PHASE_8_PANTRY_INTELLIGENCE.md`
- **FRIGO_ARCHITECTURE.md** — codebase map, services, patterns
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
- `PHASE_7_SOCIAL_FEED.md` will move here when Phase 8 ships (warm-one-phase rule)

### Feature Specs (reference when modifying those areas)
- `CONCEPT_FLEXIBLE_MEAL_PLANNING.md` — flexible meal planning spec, Phase 8D source
- `SHARED_PANTRIES_FEATURE_SPEC.md` — shared pantries spec, adjacent to Phase 8A

### Reference Data (in PK)
- `Frigo_Roadmap_Decision_Document` — March 2026 strategic analysis (decision boxes + domain-by-domain F&F readiness assessment)
- `Frigo_Wireframes_Companion.pdf` — visual reference for cooking mode, rating UX, onboarding
- Supabase DB schema CSV (`Supabase_Snippet_Supabase_Frigo_DB_Structure_Query_22.csv`)
- Product Feature Roadmap CSV

### Archive Structure (in `docs/archive/`)
- `phases/` — completed phase docs
- `handoffs/` — completed handoff docs, consolidated change lists (e.g. `DOC_UPDATES_CONSOLIDATED_2026-04-15.md`)
- `prompts/` — consumed CC prompts (going forward)
- `session_logs/` — archived session logs at phase boundaries
- `design_decisions/` — design decision docs (e.g. `PHASE_7F_DESIGN_DECISIONS.md` when recovered)
- `wireframes/` — wireframe HTMLs (7F canonical + earlier iteration currently archived)

---

## 📞 For Future Claude Sessions

1. Read this document first
2. Read FF_LAUNCH_MASTER_PLAN.md for the F&F launch strategy
3. Check the active phase doc (`PHASE_8_PANTRY_INTELLIGENCE.md`) for current goals and decisions
4. Check FRIGO_ARCHITECTURE.md for codebase map
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
| 2026-04-21 | 10.0 | **Phase 7 completion + doc maintenance overhaul.** Marked Phase 7 complete (all 13 sub-phases shipped 2026-04-17). Phase 8 (Pantry Intelligence + UX Overhaul) in planning. Documentation workflow overhauled: repo-as-canonical established, `docs/archive/` structure created (6 subfolders), `_pk_sync/` workflow folder introduced, PK pruned to ~10 essential files. Phases 1-6 + 7I_MASTER_PLAN + RECIPE_DISCOVERY docs archived. Phase 7F wireframes (canonical + earlier iteration) archived. `DOC_UPDATES_CONSOLIDATED_2026-04-15` archived after absorption. PHASE_7I_MASTER_PLAN content absorbed into PHASE_7 appendix. console.warn instrumentation pattern absorbed into DOC_MAINTENANCE_PROCESS. Project custom instructions updated to reflect Phase 8 active state. FF_LAUNCH_MASTER_PLAN and FRIGO_ARCHITECTURE refreshes pending (tracked as separate tasks). |
| 2026-04-13 | 9.4 | **Phase 7F Fix Passes 7–9 complete; Phase 7I planning session complete (supersedes D44).** Fix Passes 7/8/9 resolved all reported 7F feed bugs: yas chef/comment handler wiring on meal cards (Pass 7), unified Strava-style PhotoCarousel with natural aspect ratios + CardWrapper gesture arbitration fix + meal likes/comments read-path hydration (Pass 8), Supabase storage `resize=contain` transform fix for portrait photos + MealPostCard `likeData` prop wiring (Pass 9). 7F is now in a shippable state. **Then the session turned into a full architectural redesign of Phase 7I** after Tom hit a mental block reconciling individual cook voice vs. meal event context. Resolution: retire meal cards from the feed entirely. Every feed unit becomes a solo cook post; meal events become detail-screen-only connective tissue. Linked cook posts render as indented stacks with a left gutter connector, Strava-style. Seven wireframe states locked (L1–L7) in `frigo_phase_7i_wireframes.html`. Master plan with 7 sequential checkpoints written as `PHASE_7I_MASTER_PLAN.md`. First actionable CC prompt issued as `CC_PROMPT_7I_CHECKPOINT_1_MIGRATION.md` (SQL migration from `post_type='meal'` to `post_type='meal_event'` with rollback snapshot). **This session's decisions SUPERSEDE earlier decisions D41/D44/D45/D46 where they conflict, per Tom's explicit instruction during the session.** New decision D47 captures the supersession in PHASE_7_SOCIAL_FEED.md. Phase 7I scope expanded from 3-5 sessions (D44 scope) to 7-10 sessions (D47 scope). Earlier deferred items P7-28 through P7-31 reframed or retired: P7-29 (GroupedMealCard) is fully retired; P7-28, P7-30, P7-31 are reframed for the new model. 16 new deferred items added as P7-44 through P7-59 (renumbered to avoid collision with existing P7-1 through P7-43). **Ordering decision:** 7I Wave 1 (Checkpoints 1-4 — migration through FeedScreen rewrite) → 7G (historical cook logging) → 7H (My Posts toggle) → 7I Wave 2 (Checkpoints 5-7 — detail screens + cleanup) → 7J/7K/7L. Wave 1 ships the riskiest architectural change first; 7G/7H are small and safe between waves; Wave 2 finishes the detail screens. **Next action:** fire the Checkpoint 1 CC prompt at Claude Code. |
| 2026-04-09 | 9.3 | **Schema CSV refreshed from Supabase export.** Previous CSV in project knowledge was missing `recipes.times_cooked` (added in 7B-Rev per D11) and was the source of a verification ambiguity caught during the Phase 7F Checkpoint 2 fix-pass review. Refreshed CSV confirms both `recipes.times_cooked` (integer, nullable, default 0) and `recipes.cook_time_min` (integer, nullable, default null) for use in the Checkpoint 2 fix pass aggregation work on meal cards. Future planning instances should treat the live database as authoritative; the CSV in project knowledge is a snapshot dated 2026-04-09. |
| 2026-04-09 | 9.2 | **Phase 7F wireframe session complete.** Six iteration passes locked the multi-cook feed rendering design. Six new decisions D41–D46 captured in PHASE_7_SOCIAL_FEED.md, with full rationale in the new `PHASE_7F_DESIGN_DECISIONS.md` source-of-truth doc. Headlines: philosophy (c) hybrid stat-row framing locked (3 quantitative stats + Highlights slot + conditional vibe pill); cooked-vs-ate byline split (D45); two-level photo model (D46); comment attribution refinement (D41); notification scope tiered model (D42); eater rating model wireframed and deferred (D43); M3 architecture deferred with G4rr-b grouped meal pattern locked as the target for Phase 7I (D44). Phase 7I scope expanded by 3–5 sessions to absorb G4rr-b implementation. Total Phase 7 estimate grew from 16–23 to 18–26 sessions. 14 new deferred items added (P7-28 through P7-42). 7F build prompt issued as `CC_PROMPT_7F.md`. Three new project docs: `PHASE_7F_DESIGN_DECISIONS.md`, `frigo_phase_7f_wireframes.html`, `CC_PROMPT_7F.md`. |
| 2026-04-07 | 9.1 | **Phase 7D scoping reframing.** 7C marked done. 7D split into three sub-phases (7D data + service layer / 7E cook→meal handoff UX / 7F feed rendering) after discovering that the existing meal model already implements multi-dish multi-cook meals via `posts.parent_meal_id` + `dish_courses` + `post_participants` + `meal_participants` + `meal_photos`. Old D12 ("build a `post_dishes` junction table") retired as D21. Old 7E–7J renumbered to 7G–7L. Total Phase 7 estimate grew from 12-18 sessions to 14-21. Updated Known Issues to reflect 7D will audit and fix the broken meal-creation flow (not just feed display). New decisions D21–D31 captured in PHASE_7_SOCIAL_FEED.md. New companion docs: `_SCOPING_NOTES_7D.md` (raw conversation findings + reasoning chain) and `PHASE_RECIPE_DISCOVERY.md` (stub for unscheduled discovery feature surfaced from dish-tap behavior in scoping). DEFERRED_WORK gained R6 (personal eating log), R7 (recipe discovery), R8 (external participant retroactive claim), R9 (concept cooking inline suggestions). |
| 2026-04-06 | 9.0 | **Phase 5/6 complete, Phase 7 active, master plan reconciled.** Marked Phases 5 and 6 ✅ Complete. Phase 7 in progress (sub-phase 7C). Updated phase sequence from 4 phases (5-8) to 8 phases (5-12) following April 6 master plan reconciliation: added Phase 9 Meal & Planning UX, Phase 10 Nutrition Depth, Phase 11 Recipe Polish, renamed final to Phase 12 Distribution. Pulled into pre-launch scope: micronutrients (curated 12), meal-level nutrition, nutrition source labeling, dietary preferences capture, cookbook UX, cook soon UX, meal flows, concept cooking first-stab, ingredient substitutions v0, Edit Mode redesign. Target launch revised from late May to early-to-mid June. Added LogCookSheet, TimesMadeModal, post visibility model, times_cooked tracking, edit mode banner, PencilIcon to "What Works." Updated Known Issues with deprecated PostCreationModal/PostCookFlow and unused make_again column. Removed Phase 5 fixes (DI-5 nutrition goals, B19 extraction save) from Critical since Phase 5 is complete. |
| 2026-03-17 | 8.0 | **F&F launch planning complete.** Phases 5-8 defined: Ingredient Architecture, Cooking Mode v2, Social & Feed, Pantry Intelligence. Master plan doc created (FF_LAUNCH_MASTER_PLAN.md). Updated "What's Next" with 4-phase sequence targeting mid-to-late May. Updated Project Vision table (old Phase 5/6 replaced with new 5-8). Updated Related Documentation with new phase docs, master plan, and roadmap reference docs. Added FF_LAUNCH_MASTER_PLAN to Documentation System and Key Documentation sections. Updated "For Future Claude Sessions" to include master plan. |
| 2026-03-05 | 7.0 | **Phase 4 complete.** Added Cooking Stats Dashboard to "What Works" (comprehensive section). Updated app structure (My Posts → You tab, far right). Added stats-related known issues (nutrition goals migration, sparse difficulty scores). Updated "What's Next" (Phase 4 done, next TBD). Updated data metrics (+38 stats functions, ~30 stats components, 40 sessions). Updated Project Vision (Phase 4 ✅). Cleaned up Related Documentation (removed stale references to handoff docs, added completed phase docs section). Removed NUTRITION_UI_PROJECT_PLAN reference (consumed). Added session log archival to doc system description. |
| 2026-03-02 | 6.0 | Documentation system overhaul. New doc maintenance process. Phase 3 marked complete. |

---

**Remember:** See DOC_MAINTENANCE_PROCESS.md for the full documentation workflow.