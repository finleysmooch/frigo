# Frigo — Architecture & Codebase Map
**Last Updated:** April 15, 2026 (Phase 7I Checkpoint 7 closeout)
**Version:** 3.2

---

## Architecture Overview

```
React Native (Expo) + TypeScript
    ↓
Screens → Components → Services → Supabase
    ↓              ↓
  Context       Theme (useTheme)
  (SpaceContext)
```

**Core rule:** Services handle ALL Supabase calls. Components never call the database directly.

---

## Feature Domains

Frigo is organized into **8 Feature Domains**. Each feature belongs to exactly ONE domain. Use these boundaries when deciding where new code belongs.

### Domain Overview

| Domain | Emoji | Description |
|--------|-------|-------------|
| Recipe Management | 🍳 | Adding, storing, viewing, organizing recipes |
| Cooking Experience | 👩‍🍳 | Active cooking: step-by-step, timers, guidance |
| Meal Planning | 🗓️ | Scheduling, calendars, "cook soon" lists |
| Social & Cooking History | 👥 | Posts, feeds, followers, cooking history, **cooking stats** |
| Pantry & Inventory | 🥫 | What you have, expiration, shared pantries |
| Grocery & Shopping | 🛒 | Shopping lists, stores, purchasing |
| Discovery & Intelligence | 🔍 | Search, filtering, AI, recommendations |
| Platform & Settings | ⚙️ | Auth, profile, preferences, admin |

### Domain Scope Boundaries

**🍳 Recipe Management**
- **Includes:** Recipe input (image, URL, manual), recipe display/browsing, editing/annotations, cookbook/book management, recipe organization (folders, tags, stars), search within user's recipes
- **Does NOT include:** Active cooking mode (→ Cooking), AI-powered discovery (→ Discovery), shopping list generation (→ Grocery)

**👩‍🍳 Cooking Experience**
- **Includes:** Cooking mode display, step-by-step guidance, timers/alerts, ingredient checking during cook, post-cook reflection, offline cooking support
- **Does NOT include:** Recipe browsing/selection (→ Recipe), post creation after cooking (→ Social)

**🗓️ Meal Planning**
- **Includes:** Meal calendar, recipe scheduling, "cook soon" / "want to make" lists, flexible meal planning, prep timing reminders, meal events (dinners with friends)
- **Does NOT include:** Actual cooking (→ Cooking), shopping list management (→ Grocery)

**👥 Social & Cooking History**
- **Includes:** Feed display/algorithm, posts (dishes and meals), likes/comments, following/followers, cooking partners, meal participants, recipe sharing, historical posts, post statistics, **cooking stats dashboard**, ingredient source logging
- **Does NOT include:** Recipe input/editing (→ Recipe), meal scheduling (→ Meal Planning)

**🥫 Pantry & Inventory**
- **Includes:** Pantry item management, stock levels/expiration, storage locations, shared pantries (Spaces), space membership/invites
- **Does NOT include:** Shopping lists (→ Grocery), recipe-pantry matching logic (→ Discovery)

**🛒 Grocery & Shopping**
- **Includes:** Grocery lists, regular/recurring items, store management, recipe-to-list flow, list sharing
- **Does NOT include:** Pantry tracking (→ Pantry), receipt scanning for pantry (→ Pantry)

**🔍 Discovery & Intelligence**
- **Includes:** Recipe search/filtering, ingredient-based discovery, recipe-pantry matching ("what can I make?"), AI recommendations, effort/difficulty ratings, pairing suggestions, ingredient parsing/matching
- **Does NOT include:** Basic recipe display (→ Recipe), pantry data storage (→ Pantry)

**⚙️ Platform & Settings**
- **Includes:** Authentication (login/signup), user profiles, settings/preferences, dietary needs config, admin panel, feature flags/testing, payments/subscriptions, notifications
- **Does NOT include:** Feature-specific preferences (belong with their features)

### Cross-Domain Integration Map

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  🍳 Recipe      │────▶│  👩‍🍳 Cooking     │────▶│  👥 Social      │
│  Management     │     │  Experience      │     │  & History      │
└────────┬────────┘     └──────────────────┘     └─────────────────┘
         │                                                │
         ▼                                                │
┌─────────────────┐     ┌──────────────────┐              │
│  🔍 Discovery   │◀────│  🥫 Pantry       │◀─────────────┘
│  & Intelligence │     │  & Inventory     │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  🗓️ Meal        │────▶│  🛒 Grocery      │
│  Planning       │     │  & Shopping      │
└─────────────────┘     └──────────────────┘

         ┌──────────────────┐
         │  ⚙️ Platform     │  (underlies all)
         │  & Settings      │
         └──────────────────┘
```

**Primary User Flows:**
1. **Recipe → Cook → Share:** 🍳 Recipe Management → 👩‍🍳 Cooking Experience → 👥 Social
2. **Plan → Shop → Stock:** 🗓️ Meal Planning → 🛒 Grocery → 🥫 Pantry
3. **Stock → Discover → Plan:** 🥫 Pantry → 🔍 Discovery → 🗓️ Meal Planning
4. **Cook → Reflect → Discover:** 👥 Social (stats) → 🔍 Discovery → 🍳 Recipe Management

---

## Directory Structure

```
frigo/
├── App.tsx                          ← Main entry, navigation, tab bar (6 tabs)
├── CLAUDE.md                        ← Claude Code instructions (8 domains, tracker rows, conventions)
├── screens/                         ← 35+ screen components
├── components/
│   ├── stats/                       ← ~30 stats dashboard components (Phase 4)
│   │   ├── index.ts                 ← Barrel export for all stats components
│   │   ├── StatsOverview.tsx        ← Overview page (chart, calendar, gateway, partners)
│   │   ├── StatsRecipes.tsx         ← Cooking page (podium, bubbles, ingredients, frontier)
│   │   ├── StatsNutrition.tsx       ← Nutrition page (donut, goals, dietary)
│   │   ├── StatsInsights.tsx        ← Insights page (personality, diversity, growth, heatmap)
│   │   ├── WeeklyChart.tsx          ← 5-mode SVG chart with tappable dots
│   │   ├── CalendarWeekCard.tsx     ← 7-day emoji grid, streak, week stats
│   │   ├── MostCookedPodium.tsx     ← 3-pedestal with 5-way toggle (embedded prop)
│   │   ├── ConceptBubbleMap.tsx     ← Size-scaled bubbles, 3 tiers
│   │   ├── CookingPersonalityCard.tsx ← Dark teal card, AI-generated profile
│   │   ├── GrowthTimeline.tsx       ← Monthly milestones
│   │   ├── FrontierCards.tsx        ← Horizontal scroll suggestions
│   │   ├── GatewayCard.tsx          ← Tappable overview card with insight/period
│   │   ├── MealTypeDropdown.tsx     ← Anchored popup (measureInWindow)
│   │   ├── PeriodToggle.tsx         ← Pill toggle with compact prop
│   │   ├── SectionHeader.tsx        ← Kitchen/Frontier dividers
│   │   └── [16 more shared components]
│   ├── cooking/                     ← Cooking mode components (Phase 6)
│   │   ├── ClassicView.tsx, SectionCard.tsx, StepIngredients.tsx
│   │   ├── IngredientSheet.tsx, IngredientDetailPopup.tsx
│   │   ├── TimerDetail.tsx, CompactTimerBar.tsx
│   │   ├── SectionDots.tsx, ViewModeMenu.tsx
│   │   ├── StepNoteInput.tsx, StepNoteDisplay.tsx
│   │   └── PostCookFlow.tsx         ← DEPRECATED in 7B-Rev. Replaced by LogCookSheet full mode.
│   ├── icons/
│   │   ├── index.ts                 ← Barrel export for all icon subdirectories
│   │   ├── recipe/                  ← 19 SVG components (TimerIcon, FireIcon, SortIcon, PencilIcon, etc.)
│   │   ├── vibe/                    ← 9 SVG components (ComfortIcon, QuickIcon, etc.)
│   │   ├── pantry/                  ← 37 SVG components (FridgeIcon, VegetablesIcon, etc.)
│   │   ├── filter/                  ← 14 SVG components (DairyFreeIcon, OvenIcon, SproutIcon, etc.)
│   │   ├── HomeFilled.tsx, HomeOutline.tsx  ← Nav icons
│   │   ├── PantryFilled.tsx, GroceryFilled.tsx
│   │   └── ...
│   ├── branding/
│   │   └── icons/ChefHat2.tsx       ← Brand icons
│   ├── LogCookSheet.tsx             ← Phase 7B unified cook-logging bottom sheet (compact + full modes)
│   ├── TimesMadeModal.tsx           ← Phase 7B "I've Made This Before" stepper modal
│   ├── NutritionGoalsModal.tsx      ← Stepper inputs, daily/per-meal toggle
│   └── [40+ component files]        ← Modals, cards, pickers, sections
├── lib/
│   ├── services/                    ← ALL database interaction
│   │   ├── statsService.ts          ← 38 exported functions (Phase 4)
│   │   ├── nutritionGoalsService.ts ← Nutrition goal CRUD (Phase 4)
│   │   ├── recipeService.ts         ← Top-level recipe CRUD (Phase 7B-Rev — currently just deleteRecipe)
│   │   ├── postService.ts           ← Post creation, cook tracking (createDishPost, getTimesCooked, updateTimesCooked)
│   │   ├── recipeExtraction/        ← Extraction-specific services (own recipeService.ts inside)
│   │   └── [20+ service files]
│   ├── types/                       ← TypeScript type definitions
│   ├── theme/                       ← ThemeContext, schemes, typography
│   └── supabase.ts                  ← Supabase client config
├── contexts/
│   ├── SpaceContext.tsx              ← Shared pantry spaces
│   └── LogoConfigContext.tsx         ← Logo configuration
├── constants/
│   ├── pantry.ts                    ← Dual emoji/component icon system + INGREDIENT_TYPE_ALIASES
│   └── vibeIcons.ts                 ← Vibe tag → icon component mapping
├── scripts/                         ← Python scripts for data operations
│   ├── recipe_classification_test.py      ← Haiku vs Sonnet comparison
│   ├── recipe_classification_backfill.py  ← Classify all recipes (roles, tags, etc.)
│   └── backfill_cooking_concept.py        ← Cooking concept backfill via Haiku
├── assets/
│   ├── icons/                       ← PNG icons for cooking methods etc.
│   └── svg-source/                  ← Raw SVG source files (gitignored, reference only)
│       ├── noun-pencil-8196252.svg  ← PencilIcon outline source
│       └── noun-pencil-8196301.svg  ← PencilIcon filled source
├── supabase/
│   ├── functions/
│   │   ├── extract-recipe-three-pass/   ← Current production extraction (3-pass, Haiku default)
│   │   ├── extract-book-toc/            ← Book table of contents extraction
│   │   ├── scan-book-pages/             ← Page spread scanning
│   │   ├── assemble-book-recipes/       ← Assemble recipes from scanned pages
│   │   ├── process-recipe-queue/        ← v12 queue processor with TOC-guided extraction
│   │   └── scrape-recipe/               ← Web URL scraping function
│   └── import_map.json                  ← Deno import map for edge functions
├── docs/
│   ├── _SESSION_LOG.md              ← Active session log (current phase)
│   ├── _SESSION_LOG_PHASE4.md       ← Archived Phase 4 session log
│   ├── FRIGO_ARCHITECTURE.md        ← This file (canonical)
│   ├── DEFERRED_WORK.md             ← Master backlog (canonical)
│   ├── playbooks/                   ← Per-feature design rationale (Phase 7+)
│   └── README.md                    ← Index of docs/
└── external_documents/              ← Claude Code prompt files (gitignored)
```

---

## Services (lib/services/)

### Core Services

| Service | Purpose | Key Functions |
|---------|---------|---------------|
| **statsService.ts** | Cooking stats data layer (38 functions) | Overview: getWeekDots, getCookingStreak, getWeeklyFrequency, getOverviewStats, getHowYouCook, getCookingPartners, getNewVsRepeat. Recipes: getMostCooked, getCookingConcepts, getTopIngredients, getCuisineBreakdown, getMethodBreakdown, getTopChefs, getTopBooks, getCookbookProgress, getRecipeDiscovery. Nutrition: getNutritionAverages, getNutrientTrend, getTopNutrientSources, getHighestNutrientRecipes, getDietaryBreakdown. Insights: getDiversityScore, getComplexityTrend, getSeasonalPatterns, getCookingHeatmap, getPantryUtilization. Drill-down: getCuisineDetail, getConceptDetail, getMethodDetail, getIngredientDetail. Chef/Book: getChefStats, getBookStats. Helpers: computeDateRange, getGatewayInsights, getFrontierSuggestions, getCookingPersonality, getGrowthMilestones. Exports: StatsPeriod ('12w'\|'6m'\|'1y'), DateRange, StatsParams, MealTypeFilter, CONCEPT_EMOJI_MAP. |
| **nutritionGoalsService.ts** | Nutrition goal CRUD | getNutritionGoals, upsertNutritionGoals, deleteNutritionGoal. Table: user_nutrition_goals. |
| **recipeService.ts** | Top-level recipe CRUD (Phase 7B-Rev) | deleteRecipe. Created in 7B-Rev to extract inline supabase delete from RecipeDetailScreen. Will absorb other recipe CRUD operations over time. |
| **recipeExtraction/recipeService.ts** | Recipe save from extraction pipeline | saveRecipe (saves Phase 3A fields: hero_ingredients, vibe_tags, serving_temp, course_type, make_ahead_score, cooking_concept + per-ingredient classification/flavor_tags) |
| **postService.ts** | Post creation, cook tracking, narrow-scope edits | createDishPost (accepts visibility, optional makeAgain, nullable rating), getTimesCooked, updateTimesCooked, **updatePost (Checkpoint 5/6)** — accepts `UpdatePostPatch` with `title?`, `description?`, `parent_meal_id?`, `meal_time?`, `meal_location?`; thin `.update(patch)` passthrough, **deletePost** (Checkpoint 5). |
| **nutritionService.ts** | Nutrition queries, batch fetch | getRecipeNutrition, getRecipeNutritionBatch, getCompactNutrition, getRecipeNutritionBreakdown, aggregateMealNutrition |
| **recipeHistoryService.ts** | Cooking history for browse modes | getCookingHistory → Map<recipe_id, CookingHistory>, getFriendsCookingInfo, **getCookHistoryForUserRecipe** (Checkpoint 5 — CookDetailScreen Block 11) |
| **mealService.ts** | Meal CRUD, participants, dishes + **meal event detail** | createMeal, addDish, inviteParticipant, **getMealEventForCook** (Checkpoint 2 — L4 prehead context), **getMealEventDetail** (Checkpoint 2/6 — L7 screen payload: event + host + cooks + attendees + shared_media + stats + highlight_photo). MealParticipant includes subscription_tier. |
| **mealPlanService.ts** | Meal plan items, calendar | getPlanItems, claimItem |
| **feedGroupingService.ts** | Feed post grouping logic | **buildFeedGroups** (Checkpoint 4 rewrite) — classifies dish posts into four `FeedGroup` types (`solo`, `linked_meal_event`, `linked_shared_recipe`, legacy fall-through) with per-recipe bucketing for D48 shared-recipe merge. |
| **cookCardDataService.ts** | **NEW Checkpoint 5** — shared post→CookCardData transform | **transformToCookCardData** (migrated from FeedScreen), **fetchSingleCookCardData(postId)** (CookDetailScreen hydration), **fetchCookCardDataBatch(postIds)** (batch hydration, preserves input order). Single source of truth for FeedScreen + CookDetailScreen + future MealEventDetailScreen dish-row hydration. |
| **eaterRatingsService.ts** | **NEW Checkpoint 6** — D43 private per-eater dish ratings | **getEaterRatingsForMeal(mealEventId, viewerUserId)** → Map<postId, rating>; **upsertEaterRating(postId, raterUserId, rating \| null)** — upsert or delete. Trusts `eater_ratings` table RLS for visibility (rater + post author only). |
| **commentsService.ts** | Post comments hydration | getCommentsForPost (CookDetailScreen Block 13, MealEventDetailScreen Block 8), getCommentsForMeal, getCommentCountsForPosts |
| **highlightsService.ts** | Per-post highlights pill data | computeHighlightsForFeedBatch (feed + CookDetailScreen Block 9) |
| **postParticipantsService.ts** | Cooking partners + attendees on posts | getPostParticipants, invitePartner. `PostType` union = `'dish' \| 'meal_event'` (legacy `'meal'` removed in Checkpoint 7). |
| **spaceService.ts** | Shared pantry spaces | getSpaces, createSpace, inviteMember |
| **pantryService.ts** | Pantry item CRUD (space-aware) | getItems, addItem, updateItem |
| **groceryService.ts** | Grocery items | addItem, checkOff |
| **groceryListsService.ts** | Grocery list management | createList, getLists |
| **storeService.ts** | Grocery store management | getStores, createStore |
| **searchService.ts** | Recipe search (mixed term) | searchRecipes |
| **ingredientService.ts** | Ingredient lookup/management | getIngredient, searchIngredients |
| **ingredientSuggestionService.ts** | Autocomplete for ingredients | getSuggestions |
| **instructionSectionsService.ts** | Instruction section CRUD | getSections, updateStep |
| **recipeAnnotationsService.ts** | Recipe annotation tracking | getAnnotations, saveAnnotation |
| **userRecipeTagsService.ts** | Cook Soon tags | tagRecipe, getTaggedRecipes |
| **bookViewService.ts** | Cookbook browsing | getBookRecipes |
| **chefService.ts** | Chef data | getChef, getChefRecipes |
| **imageStorageService.ts** | Photo upload/retrieval | uploadImage, getImageUrl |
| **subscriptionService.ts** | User subscription tiers | getSubscription |
| **annotationService.ts** | Recipe edit annotations | — |
| **cookingService.ts** | Cooking session state, step notes | upsertStepNote, getStepNotes (table: recipe_step_notes) |
| **unitConverter.ts** | Metric/imperial conversion | convert |

### statsService.ts Key Patterns

```typescript
// Rolling window period model — all queries use DateRange with both bounds
type StatsPeriod = '12w' | '6m' | '1y';
type DateRange = { start: string; end: string };
computeDateRange(period: StatsPeriod, offset: number) → DateRange

// Shared params object — passed to most functions
type StatsParams = { userId: string; dateRange: DateRange; mealType: MealTypeFilter };

// Internal helpers
fetchFilteredPosts(params, fields) → filtered posts
fetchRecipesForPosts(posts, selectFields) → batch recipe fetch
applyDateRangeFilter(query, dateRange) → adds .gte AND .lte on cooked_at

// getWeeklyFrequency fetches ALL data (no date filter), caller slices to window
getWeeklyFrequency(userId, mealType) → WeeklyFrequency[]
```

### Extraction Services (lib/services/recipeExtraction/)
| Service | Purpose |
|---------|---------|
| **claudeVisionAPI.ts** | Claude API calls for photo extraction |
| **imageProcessor.ts** | Image preprocessing |
| **webExtractor.ts** | Web URL recipe scraping |
| **unifiedParser.ts** | Parse extraction results |
| **ingredientMatcher.ts** | Instruction text ingredient highlighting (NOT DB matching) |
| **recipeService.ts** | Recipe save from extraction (saveRecipe — not the same as the top-level recipeService.ts) |

---

## Screens (screens/)

| Screen | Notes |
|--------|-------|
| **StatsScreen.tsx** | Main stats container. Cooking Stats/My Posts toggle (Strava underline). Sub-tabs: Overview/Cooking/Nutrition/Insights. Sticky bar with descriptive subtitle on non-Overview tabs. ControlStrip at top of content for Cooking/Nutrition/Insights. My Posts inline with .map() (no FlatList). Contains ActivityCard and ControlStrip inline components. |
| **DrillDownScreen.tsx** | Reusable drill-down for cuisine/concept/method/ingredient. Stats, most cooked, ingredients, chefs, explore CTA. Cross-stack nav to RecipeList with filters. |
| **ChefDetailScreen.tsx** | Chef stats: hero stats, nutrition comparison, most cooked, concepts, signature ingredients, stock up, books. |
| **BookDetailScreen.tsx** | Book stats: progress bar, completion%, most cooked, highest rated, key ingredients, cuisines, methods. |
| **UserPostsScreen.tsx** | Read-only Strava-style activity cards for other users' posts. |
| **RecipeDetailScreen.tsx** | Largest screen. RecipeNutritionPanel integrated. Static StyleSheet (dynamic theming removed). Phase 7B/7B-Rev: Primary "Log This Cook" CTA opens LogCookSheet (compact mode). Secondary "Cook in Step-by-Step Mode" text link. Grouped overflow menu with view mode subheader, edit mode toggle (PencilIcon with filled state), delete via recipeService. Edit mode banner with Exit button below sticky bar. Step notes display in "Your Private Notes" section. |
| RecipeListScreen.tsx | Phase 3A overhaul. Expandable cards, 3 browse modes (All/Cook Again/Try New), 8 sort options, quick filter chips with SVG icons. Accepts initial filter params from stats drill-downs (cuisine, concept, dietary, sortBy). |
| FeedScreen.tsx | **Phase 7I Checkpoint 4 rewrite — cook-post-centric feed.** Queries `posts` where `post_type='dish'`, hydrates via `cookCardDataService.transformToCookCardData`, groups via `feedGroupingService.buildFeedGroups` into four `FeedGroup` types (`solo`, `linked_meal_event`, `linked_shared_recipe`, legacy fall-through), dispatches to `CookCard` / `NestedMealEventGroup` / `SharedRecipeLinkedGroup` / `LinkedCookStack`. Meal events are surfaced only as L4 preheads or L5 group headers — never as their own feed cards. Tapping a cook card → `CookDetail`; tapping a meal event prehead/header → `MealEventDetail`. Feed header has no flask debug button as of Checkpoint 7 cleanup. |
| **CookDetailScreen.tsx** | **Phase 7I Checkpoint 5 — L6 detail screen** for a single cook post. Reached from every CookCard tap. 14 content blocks (header, hero carousel, author block, title, description, recipe line, cooked-with row, stats grid, highlights pill, mods/notes, cook history, photo gallery, comments preview, sticky engagement bar). Narrow-scope editing via a 6-item overflow menu (Add photos, Edit title, Edit description, Manage cook partners, Change meal event, Delete post) — scaffolding for the unified 7M EditPostScreen. Inline title/description editing, `AddCookingPartnersModal` manage mode, inline meal-event picker, `post_likes` toggle, `CommentsList` tap-through. Uses `fetchSingleCookCardData` + `getCommentsForPost` + `computeHighlightsForFeedBatch` + `getCookHistoryForUserRecipe`. |
| **MealEventDetailScreen.tsx** | **Phase 7I Checkpoint 6 — L7 detail screen** for a meal event. Reached from L4 preheads (solo cook + meal event) and L5 group headers (nested meal event). 8 content blocks (header, hero, metadata, stats grid, "what everyone brought" dish rows, "at the table" attendees, shared media grid, "about the evening" comments) + sticky engagement bar. Private per-eater rating pill per dish (D43) via `eaterRatingsService`. Host overflow menu (6 items: Edit title, Edit date/time, Edit location, Edit highlight photo, Manage attendees, Delete event) and attendee overflow menu (3 items: Add photo to shared media, Add event comment, Leave event). Uses `getMealEventDetail` + `getEaterRatingsForMeal` + `getCommentsForPost` + existing `post_likes` (D51). Rating pill text + 5-star picker active state use `colors.primary` (teal). |
| MyPostDetailsScreen.tsx | RecipeNutritionPanel replaces old star ratings. Uses UserAvatar component. Legacy surface inside the You tab — still references `MealDetail` for its in-tab meal detail flow. |
| BookViewScreen.tsx | Static styling. User auth check — filters recipes by user_id (security fix). |
| MealDetailScreen.tsx | **DEPRECATED for feed navigation as of Phase 7I Checkpoint 6.** Still active inside the Meals tab (`MyMealsScreen`, `MyPostsScreen`, `MyPostDetailsScreen`, `RecipeDetailScreen` all route here for their own meal-detail flows). Remove after the You/Meals tab migrates to `MealEventDetailScreen`. |
| PantryScreen.tsx | SVG icons for storage/family/type with emoji fallback |
| **CookingScreen.tsx** | Phase 6 step-by-step with timers. Phase 7B-Rev: "Done cooking" now opens LogCookSheet in full mode directly (PostCookFlow removed from flow). |
| GroceryListDetailScreen.tsx | SVG cart icon in progress bar and empty state |
| AddRecipeFromPhotoScreen.tsx | Photo capture → extraction |
| AddRecipeFromUrlScreen.tsx | URL paste → web scraping |
| RecipeReviewScreen.tsx | Review extracted recipe before save |
| RecipeExtractionLoadingScreen.tsx | Loading state during extraction |
| MyMealsScreen.tsx | Meals list |
| CookSoonScreen.tsx | Saved recipes queue |
| CommentsScreen.tsx | Post comments |
| MyPostsScreen.tsx | User's posts list (legacy — My Posts now inline in StatsScreen) |
| AuthorViewScreen.tsx | Chef/author profile and recipes |
| UserSearchScreen.tsx | Find and follow people |
| PendingApprovalsScreen.tsx | Space join approvals |
| LoginScreen.tsx / SignupScreen.tsx | Auth |
| ProfileScreen.tsx / EditProfileScreen.tsx | User profile |
| SettingsScreen.tsx / AdminScreen.tsx | Settings, dev tools |
| SpaceSettingsScreen.tsx | Space management |
| StoresScreen.tsx / RegularItemsScreen.tsx | Grocery stores, recurring items |
| MissingIngredientsScreen.tsx | What you need for a recipe |
| LogoPlaygroundScreen.tsx | Logo testing (dev) |

---

## Components (components/)

### Stats Dashboard (components/stats/)

**Sub-pages (rendered inside StatsScreen):**
StatsOverview.tsx (independent section loading: frequency, sections, week data, streak each load separately; chart card with footer controls + date nav popup), StatsRecipes.tsx (Kitchen/Frontier structure with SectionHeader dividers; "Your Kitchen" header removed, "Your Frontier" header remains), StatsNutrition.tsx (SVG donut, macro cards, nutrient drill-downs, nutrition goals, dietary breakdown), StatsInsights.tsx (7 sections: personality, diversity, growth, complexity, seasonal, heatmap, pantry utilization)

**Chart & Calendar:**
WeeklyChart.tsx (5 modes: meals/calories/protein/veg_pct/new_repeat; tappable dots with 44px hit areas; 1Y monthly aggregation; selected week highlight), CalendarWeekCard.tsx (7-day emoji grid, week nav arrows, streak badge, 4-stat summary with prior-week deltas)

**Cards & Display:**
GatewayCard.tsx (icon/value/label/detail/insight/period props), MostCookedPodium.tsx (3-pedestal with embedded prop for card-less rendering, 5-way toggle), ConceptBubbleMap.tsx (size-scaled circles: Staple/Regular/Frontier tiers), CookingPersonalityCard.tsx (dark #0b6b60 card, template narrative + tags), GrowthTimeline.tsx (vertical timeline entries), FrontierCards.tsx (horizontal scroll with loading skeleton), SectionHeader.tsx (kitchen teal / frontier amber pill + line)

**Shared Components:**
PeriodToggle.tsx (compact prop for chart footer), MealTypeDropdown.tsx (anchored popup via measureInWindow, opens up/down based on screen position), StreakDots.tsx, MiniBarRow.tsx, CompactBarRow.tsx, RankedList.tsx, TappableConceptList.tsx, ComparisonBars.tsx, DrillDownPanel.tsx, NutrientRow.tsx, IngredientFilterPills.tsx, DiversityBadge.tsx, GoalRow.tsx, SignatureIngredientGroup.tsx, StockUpCard.tsx, CookbookProgressRow.tsx

### Cooking Mode (components/cooking/)
ClassicView.tsx, SectionCard.tsx, StepIngredients.tsx (per-step ingredient display), IngredientSheet.tsx (full ingredient list during cook), IngredientDetailPopup.tsx, TimerDetail.tsx, CompactTimerBar.tsx, SectionDots.tsx, ViewModeMenu.tsx, StepNoteInput.tsx, StepNoteDisplay.tsx, **PostCookFlow.tsx (DEPRECATED in 7B-Rev — replaced by LogCookSheet full mode, kept for now)**

### Cards & Display
**Phase 7I Checkpoint 7:** `PostCard.tsx`, `MealPostCard.tsx`, and `LinkedPostsGroup.tsx` were deleted. Their roles are now served by the `components/feedCard/` module (see Phase 7I Feed Card Components below). `PostActionMenu.tsx` is still used by legacy `MyPostDetailsScreen` and `MyPostsScreen` inside the You/Meals tabs — kept in place until those screens migrate to the new detail screens.

RecipeNutritionPanel.tsx (collapsible: calories+PCF collapsed, full macro breakdown expanded, quality confidence indicator), DietaryBadgeRow.tsx (color-coded dietary flags, compact/default sizes, overflow +N), UserAvatar.tsx (handles emoji strings, URLs, and null via regex `/^[\p{Emoji}\u200D\uFE0F]+$/u`; emoji font size 0.75x), NutritionGoalsModal.tsx (6 nutrients, stepper inputs, daily/per-meal toggle, MEALS_PER_DAY=2.5), PostActionMenu.tsx (legacy — see above), CategoryHeader.tsx (SVG family icons, chip-style type breakdown), TypeHeader.tsx (SVG type icons with emoji fallback), PantryItemRow.tsx (SVG stock status: NoneIcon/WarningIcon/LowFuelIcon), GroceryListItem.tsx, MealInvitationsCard.tsx, PendingSpaceInvitations.tsx, MarkupText.tsx

### Phase 7I Feed Card Components (components/feedCard/)

Phase 7I's cook-post-centric feed model (D47) consolidated every feed surface into three files inside `components/feedCard/`. No other components in this subtree.

- **`CookCard.tsx`** — outer `CookCard` wraps a single cook post with its `CardWrapper` and full card chrome; `CookCardInner` is the wrapper-less variant reused by linked groups so a group can render its members under a single outer wrapper with hairline dividers (no gray gaps). Both consume `CookCardData` from `cookCardDataService`.
- **`groupingPrimitives.tsx`** — preheads and grouped-card renderers. `MealEventPrehead` (L4 context line above a solo cook card), `CookPartnerPrehead` (cook-partner context when no meal event), `MealEventGroupHeader` (L5 group header above a nested meal event), `LinkedCookStack` (multi-author linked group), `SharedRecipeLinkedGroup` (D48 — multiple cooks cooking the same recipe, shared hero + per-cook sub-sections), `NestedMealEventGroup` (D47 — meal event group header + per-sub-unit rendering).
- **`sharedCardElements.tsx`** — shared visual primitives consumed by every surface above plus `CookDetailScreen` and `MealEventDetailScreen`: `CardWrapper`, `CardHeader`, `PhotoCarousel` (with per-slide `failedIndices` via `onError` and optional `scrollToIndex` / `onScrollToIndexComplete` props), `NoPhotoPlaceholder` (D50 — light grey backdrop + `BookIcon` + "No photo yet" text), `RecipeLine`, `DescriptionLine`, `StatsRow`, `VibePillRow`, `EngagementRow`, `ActionRow`, `HighlightsPill`, `optimizeStorageUrl` helper (rewrites Supabase public URLs to the `/render/image/` endpoint with size + quality params).

Feed data flow: `FeedScreen.loadDishPosts()` → `transformToCookCardData` → `buildFeedGroups` → `renderFeedItem` dispatch on `FeedGroup.type` → `CookCard` (solo) / `SharedRecipeLinkedGroup` (linked_shared_recipe) / `NestedMealEventGroup` (linked_meal_event). Navigation from feed: cook card tap → `CookDetail`; meal event prehead or group header tap → `MealEventDetail`.

### Phase 7 Components
- **LogCookSheet.tsx** — Unified bottom sheet for logging cooks. `mode` prop ('compact' | 'full') switches layout density. Compact (~65% height) opens from RecipeDetailScreen primary CTA. Full (~90%) opens from CookingScreen "Done cooking". Half-star slide-to-rate via PanResponder (per-star position mapping with gap awareness, slide-left-to-clear, teal). Keyboard handling: KeyboardAvoidingView `behavior="position"`, InputAccessoryView Done button on TextInputs, tap-outside-to-dismiss via onTouchStart on container. Photo placeholders, voice memo placeholder, helper chips, modifications field (full mode only). Submit calls `createDishPost` with visibility flag.
- **TimesMadeModal.tsx** — Stepper modal for "I've Made This Before" history backfill. Shows additions delta (default 1, min 1) with live preview "Update total to **X** times logged". `onConfirm` passes the new total. Repurposed in 7B-Rev from earlier "I Made This" use.

### Modals
AddRecipeModal, AddDishToMealModal, AddGroceryItemModal, AddMealParticipantsModal, AddMediaModal, AddPantryItemModal, AddPlanItemModal, AddRecipeToListModal, AddRegularItemModal, AddCookingPartnersModal, AnnotationModal, AnnotationModeModal, BookOwnershipModal, BookSelectionModal, CookingPartnerApprovalModal, CreateMealModal, CreateSpaceModal, DayMealsModal, EditIngredientModal, EditInstructionModal, EditMealModal, EditRegularItemModal, EmojiPickerModal, FilterDrawer (major rewrite — see FilterDrawer State below), InviteMemberModal, ItemDetailModal, ParticipantsListModal, **PostCreationModal (partially deprecated for cook logging in 7B-Rev — LogCookSheet replaces it for cook flows; still used for non-cook post types)**, QuickAddModal, QuickMealPlanModal, SelectMealForRecipeModal, SelectMealModal

### Pickers & Inputs
CourseCategoryPicker, DateTimePicker, ExpirationPicker, InlineExpirationPicker, InlineQuantityPicker, InlineStoragePicker, QuantityPicker, StoragePicker, UnitPicker, WeekCalendarPicker

### Sections
CookSoonSection, MealPlanSection, QuickAddSection

### Inline Editing
InlineEditableIngredient, InlineEditableInstruction, IngredientPopup

### Other
AddRecipeImageButton, RemainderPrompt, StorageChangePrompt, SpaceSwitcher

---

## Navigation (App.tsx)

### Bottom Tab Bar (left to right)

| Tab | Stack | Key Screens |
|-----|-------|-------------|
| **Home** | FeedStack | FeedScreen → PendingApprovals, RecipeDetail, AuthorView, YasChefsList, CommentsList |
| **Recipes** | RecipesStack | RecipeListScreen → RecipeDetail → CookingScreen, BookView, AuthorView, AddFromPhoto, AddFromUrl, RecipeReview, MissingIngredients |
| **Meals** | MealsStack | MyMealsScreen → MealDetailScreen |
| **Pantry** | PantryStack | PantryScreen → SpaceSettingsScreen |
| **Grocery** | GroceryStack | GroceryListsScreen → GroceryListDetailScreen |
| **You** | StatsStack | StatsScreen → DrillDown, ChefDetail, BookDetail, UserPosts, RecipeDetail, Profile, Settings, EditProfile |

### StatsStack Routes
```typescript
type StatsStackParamList = {
  StatsHome: undefined;
  DrillDown: { type: string; value: string; label: string };
  ChefDetail: { chefId: string };
  BookDetail: { bookId: string };
  UserPosts: { userId: string; displayName: string };
  RecipeDetail: { recipe: { id: string; title: string } };
  Profile: undefined;
  Settings: undefined;
  EditProfile: undefined;
};
```

### Cross-Stack Navigation
Stats drill-downs navigate to RecipeList via: `navigation.getParent()?.navigate('RecipesStack', { screen: 'RecipeList', params: { initialCuisine, initialCookingConcept, initialDietaryFlag, sortBy } })`

### Phase 7I FeedStack Routes (post-Checkpoint 7)

```typescript
type FeedStackParamList = {
  FeedMain: undefined;
  PendingApprovals: undefined;
  YasChefsList: { postId: string; postTitle: string };
  CommentsList: { postId: string };
  UserSearch: undefined;
  Profile: undefined;
  Settings: undefined;
  EditProfile: undefined;
  RecipeDetail: { recipe: any; planItemId?: string; mealId?: string; mealTitle?: string };
  AuthorView: { chefName: string };
  MealDetail: { mealId: string; currentUserId: string };       // legacy, kept for Meals tab callers
  CookDetail: { postId: string; photoIndex?: number };          // L6 — Checkpoint 5
  MealEventDetail: { mealEventId: string };                     // L7 — Checkpoint 6
  EditMedia: { postId: string; existingPhotos: PostPhoto[] };
};
```

**Key feed nav flows:**

- **Feed → CookDetail:** every `CookCard` tap routes to `CookDetail` with `{ postId, photoIndex? }`. `photoIndex` centers the hero carousel on that index at mount (used by future surfaces that tap into a specific photo).
- **Feed → MealEventDetail:** meal event preheads (L4) and nested meal event group headers (L5) both call `navigateToMealEvent(mealEventId)` → `MealEventDetail` with `{ mealEventId }`.
- **CookDetail → RecipeDetail:** tapping the recipe line when the post is recipe-backed.
- **CookDetail → EditMedia:** overflow menu "Add photos" item. `EditMedia` is registered in the FeedStack so it's reachable without cross-stack jumps.
- **CookDetail → CommentsList:** Block 13 comment tap-through or sticky bar comment icon.
- **MealEventDetail → CookDetail:** Block 5 dish row tap — each row routes to `CookDetail` for that specific cook post (L7→L6 drill).
- **MealEventDetail → CommentsList:** Block 8 "About the evening" tap-through or sticky bar comment icon. Uses the meal_event post's ID as the target (D51 — engagement via existing `post_likes` / `post_comments` infrastructure).
- **MealEventDetail → AuthorView:** "Hosted by" chip and attendee row taps.

The test harness route (`Phase7ITestHarness`) was registered from Checkpoint 3 through 6 for synthetic-data visual verification. **Removed in Checkpoint 7 cleanup** — the flask button in the FeedScreen header was deleted along with the route registration and the screen file.

---

## StatsScreen Architecture

### Layout Structure
```
<ScrollView stickyHeaderIndices={[1]}>
  Child 0: Header + Cooking Stats/My Posts toggle (scrolls away)
  Child 1: Sticky bar (sub-tabs + optional descriptive subtitle)
  Child 2: Content view (sub-page components)
</ScrollView>
```

### Control Placement
- **Overview tab:** Sticky bar = sub-tabs only. Period pills + date range chip in chart card footer. MealTypeDropdown in chart card header. Date range chip opens anchored popup with ← Older / Newer → nav.
- **Cooking/Nutrition/Insights tabs:** Sticky bar = sub-tabs + descriptive subtitle when scrolled past ControlStrip. ControlStrip (MealTypeDropdown + PeriodToggle) at top of content, scrolls with content. Subtitle shows "Last 12 Weeks · All Meals" etc., tappable to expand into overlay controls (period + meal type).

### Scroll-Based Subtitle Logic
ControlStrip's Y position measured via `onLayout` (relative to content View). Content View's Y measured via separate `onLayout` (relative to ScrollView). Combined = ControlStrip position in ScrollView coordinates. Subtitle appears when `scrollY > stripBottom - stickyBarHeight`, disappears when scrolling back.

### Data Flow
```
StatsScreen (owns state: period, timeOffset, mealType)
  ↓ computeDateRange(period, timeOffset) → dateRange
  ↓
  ├── StatsOverview (receives all control props + dateRange)
  │   ├── Independent loading: streak, frequency, sections, week data
  │   ├── Chart card footer: date chip + period pills
  │   └── Date nav popup: ← Older / Newer → (anchored below chip)
  │
  ├── StatsRecipes (receives dateRange, mealType)
  ├── StatsNutrition (receives dateRange, mealType)
  └── StatsInsights (receives dateRange, mealType)
```

---

## FilterDrawer State (current shape)

The FilterDrawer was substantially rewritten in Phase 3A. Current FilterState:

```typescript
// Current fields
dietaryFlags: { isVegan, isVegetarian, isGlutenFree, isDairyFree, isNutFree, isEggFree, isSoyFree, isShellfishFree }
heroIngredients: string[]
vibeTags: string[]
maxCaloriesPerServing: number | null
minProteinPerServing: number | null
servingTemp: string | null
courseType: string | null
// Plus existing: cookTime, prepTime, bookId, chefId, etc.

// Removed (breaking change): maxCost, minPantryMatch, onePostOnly, dietaryTags
```

All cooking method and dietary filter options use SVG icon components.

---

## Data Model — Key Relationships

```
users → user_profiles, user_follows, user_recipe_tags

recipes
├── recipe_ingredients → ingredients
│   ├── recipe_ingredient_alternatives (OR-patterns)
│   ├── quantity_confidence, embedded_grams, embedded_ml
│   ├── ingredient_role, nutrition_multiplier
│   ├── ingredient_classification, flavor_tags            ← Phase 3A
│   │   (classification: hero/primary/secondary)
│   │   (flavor_tags: sweet/salty/bitter/umami/fatty/spicy/sour)
│   └── ...
├── hero_ingredients, vibe_tags, serving_temp              ← Phase 3A
├── course_type, make_ahead_score, cooking_concept         ← Phase 3A
├── times_cooked                                           ← Phase 7A
├── instruction_sections → instruction_steps
├── recipe_media, recipe_references
├── books (optional) → chefs
│   ├── book_page_scans       (from scan-book-pages edge function)
│   └── book_recipe_assembly  (from assemble-book-recipes edge function)

ingredients
├── Nutrition: calories/protein/fat/carbs/fiber/sugar/sodium per 100g
├── Weight: g_per_cup/tbsp/tsp/whole, typical_weight_small/medium/large_g
├── Dietary: is_vegan, is_vegetarian, is_gluten_free, is_dairy_free, +4 more
├── Provenance: usda_fdc_id, nutrition_data_source, created_by
├── cooked_ratio, base_ingredient_id (parent-child)
└── ingredient_common_units, measurement_units

posts → post_photos, post_participants, post_likes (yas_chefs), comments
├── post_type: 'dish' (standalone or child of a meal) or 'meal' (parent)
├── parent_meal_id (for dish posts within meals)
├── cooking_method, modifications
├── photos: jsonb column (NOT a relation — [{url, order}])
├── notes (the "thoughts" field — casual cook-level observations)  ← Phase 7A
├── modifications (recipe-level edits — what they changed)         ← Phase 7A
├── rating: numeric(3,1) nullable                                  ← Phase 7B-Rev (was integer)
├── visibility: 'everyone'|'followers'|'private', default 'everyone' ← Phase 7A
├── make_again: text (DEPRECATED in 7B-Rev, column kept)           ← Phase 7A
└── cooked_at (PLANNED for 7G — currently NULL, defaults to created_at)

recipe_step_notes (Phase 6 — separate from annotations)
├── recipe_id, user_id, step_id, content
└── Read by both CookingScreen and RecipeDetailScreen "Your Private Notes" (after 7B-Rev)

recipe_annotations (general user annotations)
└── Also displayed in RecipeDetailScreen "Your Private Notes" — separate code path from step_notes

# MEAL MODEL ("Model 1") — see PHASE_7_SOCIAL_FEED.md decisions D21-D31
# Important: there is NO `meals` table. A "meal" is a `posts` row with post_type='meal'.
# Multi-dish meals are NOT modeled via a separate junction; they use parent_meal_id +
# the dish_courses junction table. This is the existing model and Phase 7D extends it
# rather than replacing it.

posts (post_type='meal')
├── title, description, meal_type, meal_time, meal_location
├── meal_status: 'planning' | 'completed'
├── photos (JSONB — meal-level photos on the post itself)
└── visibility (same model as dish posts)

dish_courses (junction — links dish post to parent meal post)
├── dish_id (FK to posts where post_type='dish')
├── meal_id (FK to posts where post_type='meal')
├── course_type: 'appetizer'|'main'|'side'|'dessert'|'drink'|'other'
├── is_main_dish (boolean)
└── course_order (int)

post_participants (cook attribution at the POST level)
├── post_id, participant_user_id, role: 'host'|'sous_chef'|'ate_with'
├── status: 'pending'|'approved'|'rejected' (sous chef approval flow)
├── invited_by_user_id
└── 7D will add: external_name (text, nullable) for non-Frigo-user contributors (D27)

meal_participants (RSVP at the MEAL level — separate from post_participants)
├── meal_id, user_id, role: 'host'|'attendee'
├── rsvp_status: 'pending'|'accepted'|'maybe'|'declined'
└── Used for who's at the dinner, who's invited

meal_photos (per-meal multi-uploader photo bucket)
├── meal_id, user_id, photo_url, caption
└── Built but NOT yet rendered in MealPostCard (Gap 5, fix in 7F)

meal_dish_plans (PLANNED meals — meal planner, separate from logged meal posts)
├── meal_id, course_type, recipe_id, placeholder_name
├── claimed_by, assigned_to, completed_at
└── 7D will add a link to the logged meal post (Gap 4, supports D14 smart auto-populate)

post_relationships (sibling-post linking — built but only partially wired)
├── post_id_1, post_id_2, relationship_type: 'dish_pair'|'meal_group'
├── Phase 7I will wire 'dish_pair' for the same-recipe-different-cooks case
└── 'meal_group' rows are CURRENTLY ALSO written by addDishesToMeal, creating
    three parallel meal↔dish representations (parent_meal_id, dish_courses,
    post_relationships). Tech debt — see P7-14 in PHASE_7_SOCIAL_FEED.md.

spaces → space_members, space_invitations
pantry_items → ingredients (space-aware)
grocery_lists → grocery_list_items → ingredients
regular_items

user_nutrition_goals                                       ← Phase 4
├── user_id, nutrient, goal_value, goal_unit
├── RLS: users manage own goals
```

### Key Database Tables by Domain

| Domain | Tables |
|--------|--------|
| 🍳 Recipe | recipes, recipe_ingredients, instruction_sections, instruction_steps, recipe_photos, recipe_annotations, recipe_step_notes, recipe_references, books, chefs, user_books |
| 👩‍🍳 Cooking | recipe_annotations (edits while cooking), instruction_steps, recipe_step_notes |
| 🗓️ Meal Planning | meal_dish_plans, user_recipe_tags, posts (post_type='meal_event' — migrated from legacy 'meal' in Phase 7I Checkpoint 1) |
| 👥 Social | posts, post_likes, post_comments, comment_likes, post_participants, post_relationships, follows, meal_participants, meal_photos, dish_courses, **eater_ratings** (D43 — Phase 7I Checkpoint 6, private per-eater dish ratings with RLS scoped to rater + post author), **user_nutrition_goals** |
| 🥫 Pantry | pantry_items, spaces, space_members, space_settings, user_active_space, user_pantry_preferences |
| 🛒 Grocery | grocery_lists, grocery_list_items, regular_grocery_items, stores |
| 🔍 Discovery | ingredients, ingredient_suggestions, or_pattern_decisions |
| ⚙️ Platform | user_profiles, user_ingredient_preferences, user_recipe_preferences, user_ingredient_choices |

### Extraction Tables (semi-independent subproject)

| Table | Purpose |
|-------|---------|
| recipe_extraction_queue | Processing pipeline |
| recipe_extraction_comparison | Accuracy metrics |
| recipe_extraction_verification | 4-pass verification |
| extraction_logs | Historical extractions |
| extraction_corrections | User corrections |
| book_page_scans | Page-level extraction |
| book_recipe_assembly | Multi-page assembly |
| book_assembly_runs | Batch processing |

Integration: Extraction outputs flow into `recipes` table via review flow (RecipeReviewScreen).

### Materialized Views
- **recipe_nutrition_computed** — Per-recipe nutrition + dietary flags + quality labels. Refresh: `SELECT refresh_recipe_nutrition()`

### Regular Views  
- **recipe_ingredient_nutrition** — Per-ingredient nutrition breakdown

### Key Functions
- **estimate_ingredient_grams()** — Converts quantity + unit to grams using ingredient weight data

---

## Recipes Have TWO Instruction Formats

Must support both:
1. **Old:** `instructions: string[]` — flat array (photo-extracted)
2. **New:** `instruction_sections: InstructionSection[]` — sections with title, time, steps

```typescript
if (instructionSections.length > 0) {
  renderSections(instructionSections);
} else if (recipe.instructions.length > 0) {
  renderFlatInstructions(recipe.instructions);
}
```

---

## Icon System

**79+ SVG components** across 4 groups, all following `({ size = 24, color = '#000' }) => <Svg>...</Svg>`

| Group | Count | Examples |
|-------|-------|---------|
| recipe/ | 19 | TimerIcon, FireIcon, BodybuilderIcon, SortIcon, BookIcon, AgainIcon, PinIcon, **PencilIcon (Phase 7B-Rev)** |
| vibe/ | 9 | ComfortIcon, FreshLightIcon, ImpressiveIcon, QuickIcon, ProjectIcon |
| pantry/ | 37 | VegetablesIcon, MeatIcon, DairyIcon, FridgeIcon, WarningIcon, NoneIcon, LowFuelIcon |
| filter/ | 14 | DairyFreeIcon, GlutenFreeIcon, OvenIcon, GrillIcon, AirFryerIcon, SproutIcon |

**PencilIcon (Phase 7B-Rev):** Located at `components/icons/recipe/PencilIcon.tsx`. Built from `assets/svg-source/noun-pencil-8196252.svg` (outline) and `noun-pencil-8196301.svg` (filled). Supports `filled` prop — used by RecipeDetailScreen overflow menu to indicate edit mode active state.

**Pantry dual system (constants/pantry.ts):**
- Emoji functions (fallback): `getFamilyIcon()`, `getTypeIcon()` — getTypeIcon uses INGREDIENT_TYPE_ALIASES for normalized lookup
- Component functions: `getFamilyIconComponent()`, `getTypeIconComponent()`, `getStorageIconComponent()`

**Vibe tag mapping (constants/vibeIcons.ts):**
- Maps 10 vibe tag strings → icon components (comfort, fresh & light, impressive, etc.)

**Imports:** All via barrel export: `import { TimerIcon, FireIcon, PencilIcon } from './components/icons'`

---

## Nutrition Architecture

**Core principle: Store raw facts, compute derived values.**
```
RAW: recipe_ingredients.original_text, .quantity_amount, .quantity_unit
  → REFERENCE: ingredients.calories_per_100g, .g_per_cup, etc. (USDA)
    → CALCULATION: estimate_ingredient_grams() + views
      → CACHE: recipe_nutrition_computed (materialized, manual refresh)
```

---

## Extraction Pipeline

### Current Production: extract-recipe-three-pass
Three-pass pipeline using Claude Vision:
1. **Pass 1:** Visual analysis and recipe counting
2. **Pass 2:** Detailed extraction with counts as constraints
3. **Pass 3:** Verification pass

Default model: **Haiku** (92% cheaper than Sonnet). Sonnet available as option.
Includes gold standard comparison and test mode.

Generates per recipe: hero_ingredients, vibe_tags, serving_temp, course_type, make_ahead_score, cooking_concept.
Generates per ingredient: ingredient_classification (hero/primary/secondary), flavor_tags.

Save flow: extraction → RecipeReviewScreen → recipeExtraction/recipeService.ts → DB

### Book Processing Pipeline (4 functions)
For bulk cookbook digitization:
```
extract-book-toc → scan-book-pages → assemble-book-recipes → process-recipe-queue
```
1. **extract-book-toc** — Claude Sonnet vision extracts TOC structure, sections, page numbers → books table
2. **scan-book-pages** — Scans page spreads, identifies recipes/ingredients/steps → book_page_scans table
3. **assemble-book-recipes** — Assembles complete recipes from overlapping page data, cross-refs TOC → book_recipe_assembly table
4. **process-recipe-queue** — v12 queue processor, TOC-guided extraction with fuzzy title matching, image resize

### Web Extraction: scrape-recipe
Fetches URL, extracts recipe data from web pages.

### Classification Scripts (scripts/)
Python scripts for batch data operations:
- **recipe_classification_backfill.py** — Classify all recipes via Haiku (roles, tags, hero ingredients, vibe, course type, make-ahead). Supports --dry-run, --resume, --limit.
- **recipe_classification_test.py** — Haiku vs Sonnet comparison on 10 test recipes
- **backfill_cooking_concept.py** — Backfill cooking_concept via Haiku in batches of 40

---

## Common Patterns

### Supabase Queries with Relations
```typescript
const { data } = await supabase
  .from('recipes')
  .select('*, book:books(id, title, author), chef:chefs(id, name)')
  .eq('id', recipeId);
```

### posts.photos is JSONB (NOT a relation)
```typescript
// CORRECT — photos is a jsonb column on posts table
const { data } = await supabase.from('posts').select('id, title, photos');
// data.photos = [{url: '...', order: 0}, ...]

// WRONG — post_photos table does NOT exist
const { data } = await supabase.from('posts').select('id, post_photos(url, order)');
```

### Querying Nutrition Data
```typescript
const { data } = await supabase
  .from('recipe_nutrition_computed')
  .select('*')
  .eq('recipe_id', recipeId)
  .single();
```

### Space-Aware Queries (Pantry)
```typescript
const { data } = await supabase
  .from('pantry_items')
  .select('*, ingredient:ingredients(*)')
  .eq('space_id', activeSpaceId);
```

### Anchored Popup Pattern (MealTypeDropdown, date nav)
```typescript
// measureInWindow gives position relative to screen
buttonRef.current?.measureInWindow((x, y, w, h) => {
  setLayout({ x, y, w, h });
  setVisible(true);
});
// Open upward if button is in bottom half, downward otherwise
const opensUp = layout.y > screenHeight / 2;
```

### Theme Usage
```typescript
const { colors, functionalColors } = useTheme();
// Never hardcode colors — always use theme
// Exception: RecipeDetailScreen and BookViewScreen currently use static StyleSheet
```

### Avatar Handling
```typescript
// avatar_url can contain emoji strings ("👨‍🔬"), URLs, or null
// ALWAYS use UserAvatar component — never raw <Image source={{ uri: avatarUrl }}>
<UserAvatar user={{ avatar_url: avatarUrl }} size={32} />
```

### Independent Section Loading (StatsOverview pattern)
```typescript
// Instead of one loading state that blanks the whole page:
const [frequencyLoading, setFrequencyLoading] = useState(true);
const [sectionsLoading, setSectionsLoading] = useState(true);
// Card shells always render. Content inside shows small spinner or data.
// No full-page flash on period/meal type change.
```

### Mode-variant components (Phase 7B-Rev)

A single component with a `mode` prop that switches layout density and feature set without duplicating code. Used when the same component serves multiple contexts but the form fields and submission logic are identical.

**Example: `LogCookSheet`**

```typescript
type Mode = 'compact' | 'full';

<LogCookSheet
  mode="compact"      // ~65% height, no helper chips, no modifications field
  // ... opens from RecipeDetailScreen
/>

<LogCookSheet
  mode="full"         // ~90% height, full feature set
  // ... opens from CookingScreen
/>
```

Both modes share state, validation, and submit logic. The `mode` prop only affects layout, height, and which optional sections render. Prefer this over creating two separate components when the underlying behavior is identical.

**When NOT to use:** If the modes diverge enough that they need different state shapes, different submit handlers, or different external integrations, split into two components.

### Keyboard Avoidance Pattern (LogCookSheet, Phase 7B-Rev)

For bottom sheets with text inputs that must remain visible when the keyboard appears:

```typescript
<KeyboardAvoidingView
  behavior="position"  // NOT "padding" — padding causes glitchy resize animations
  keyboardVerticalOffset={0}
>
  <View onTouchStart={dismissKeyboard}>  {/* tap-outside-to-dismiss */}
    <TextInput
      inputAccessoryViewID="logCookDoneAccessory"
      // ...
    />
  </View>
</KeyboardAvoidingView>

{Platform.OS === 'ios' && (
  <InputAccessoryView nativeID="logCookDoneAccessory">
    <View><TouchableOpacity onPress={() => inputRef.current?.blur()}>
      <Text>Done</Text>
    </TouchableOpacity></View>
  </InputAccessoryView>
)}
```

This combination (position behavior + InputAccessoryView Done button + tap-outside-to-dismiss) avoids the resize glitches and unreachable input issues that come from `behavior="padding"` or `TouchableWithoutFeedback` wrappers.

---

## Recent Breaking Changes

### Phase 7I — Cook-Post-Centric Feed Rebuild (April 13 – April 15, 2026)

Seven-checkpoint rebuild of the feed + detail surfaces around D47 (cook posts are the atomic unit; meal events only surface as context above or around cook posts). All 7 checkpoints plus 3 fix passes shipped.

| Date | Change | Impact |
|------|--------|--------|
| 2026-04-13 | **Checkpoint 1:** migrated all `posts.post_type='meal'` rows to `'meal_event'` | The legacy `'meal'` value was removed from the `PostType` union in Checkpoint 7. Any code still comparing against `'meal'` will silently miss every row. |
| 2026-04-13 | **Checkpoint 2:** `getMealEventForCook` and `getMealEventDetail` added to `mealService.ts` | L4 prehead and L7 detail screen depend on these. Both resolve the host via `post_participants` first with a fallback to `posts.user_id`. |
| 2026-04-13 | **Checkpoints 3 / 3.5:** `components/feedCard/` module created with `CookCard`, `groupingPrimitives`, `sharedCardElements` | Replaces the old `PostCard` / `MealPostCard` / `LinkedPostsGroup` render path entirely. |
| 2026-04-13 | **Checkpoint 4:** FeedScreen rewrite — `loadDishPosts → transformToCookCardData → buildFeedGroups → renderFeedItem dispatch` | Meal events no longer render as standalone feed cards. They only appear as preheads (L4) or group headers (L5) above/around cook cards. |
| 2026-04-14 | **Checkpoint 5:** `CookDetailScreen.tsx` (L6) added with 14 content blocks + 6-item overflow menu (Add photos, Edit title, Edit description, Manage cook partners, Change meal event, Delete post). `cookCardDataService.ts` created as the single source of truth for post→CookCardData transforms. `UpdatePostPatch` interface introduced on `postService.ts`. `NoPhotoPlaceholder` added to `sharedCardElements.tsx` (D50). | Every cook card tap now routes to this screen; scaffolding for 7M EditPostScreen. |
| 2026-04-15 | **Checkpoint 6:** `MealEventDetailScreen.tsx` (L7) added with 8 content blocks + 6 host menu items + 3 attendee menu items. `eater_ratings` table created with D43 RLS (rater + post author visibility). `eaterRatingsService.ts` added. `UpdatePostPatch` extended with `meal_time?` and `meal_location?`. D51 committed — meal-event-level engagement uses existing `post_likes` / `post_comments` infrastructure with `post_id = mealEventId`. | FeedScreen's `navigateToMealEvent` rewired from legacy `MealDetail` to the new `MealEventDetail`. The rating pill and 5-star picker use `colors.primary` (teal) for the active state. |
| 2026-04-15 | **Checkpoint 7:** cleanup pass | `PostCard.tsx`, `MealPostCard.tsx`, `LinkedPostsGroup.tsx` deleted. `_Phase7ITestHarness.tsx` + flask debug button removed. `PostType` union shrunk to `'dish' \| 'meal_event'`. Two stale `post_type = 'meal'` queries in `MyMealsScreen` and `EditMealModal` fixed to `'meal_event'`. `MealDetailScreen.tsx` **kept** (still referenced by MyMealsScreen, MyPostsScreen, MyPostDetailsScreen, RecipeDetailScreen for their in-tab flows) and annotated as deprecated. AuthorViewScreen confirmed functional. Legacy `navigate('MealDetail' as any, ...)` casts in RecipeDetailScreen and MyPostDetailsScreen still point at the retained legacy route — safe. |

**Key decisions log references** (see `docs/PHASE_7_SOCIAL_FEED.md` for full text):
- **D43** — Eater ratings: private to the rater, schema via new `eater_ratings` table, RLS scoped to rater + post author.
- **D47** — Cook-post-centric feed model: the atomic feed unit is a cook post; meal events surface as context only.
- **D48** — Same-recipe cook-pair merge: multiple cooks of the same recipe inside a linked group collapse to a shared-hero card with per-cook sub-sections (`SharedRecipeLinkedGroup`, `NestedMealEventGroup` for the nested case).
- **D49** — Same-author multi-dish collapse within meal events. **NOT YET BUILT.** Captured only as a nav contract in Checkpoint 5 (`CookDetail { postId, photoIndex? }` param shape is stable). D51 resolved the schema coupling that previously linked D49 to Checkpoint 6, so D49 can ship independently.
- **D50** — No-image state: feed cards collapse the photo slot entirely; detail screens render `NoPhotoPlaceholder` (light grey backdrop + BookIcon + "No photo yet" text). Shared primitive in `sharedCardElements.tsx`.
- **D51** — Meal-event-level engagement uses existing `post_likes` / `post_comments` tables with the meal_event post's ID as the target. No new engagement tables. The meal_event row is already a `posts` row, so existing infrastructure works unchanged.

### Phase 7A/7B/7B-Rev (March 24 – April 6, 2026)
| Date | Change | Impact |
|------|--------|--------|
| 2026-03-24 | Added `posts.make_again` column (Phase 7A) | Now unused after 7B-Rev. Drop post-launch. |
| 2026-03-24 | Added `recipes.times_cooked` column (Phase 7A) | Incremented on every logged cook. Read by RecipeDetailScreen and TimesMadeModal. |
| 2026-03-24 | Added `posts.visibility` column (Phase 7A) | Default 'everyone'. FeedScreen filters out 'private'. Legacy NULL treated as public. |
| 2026-04-06 | Changed `posts.rating` to `numeric(3,1)` nullable (Phase 7B-Rev) | Supports half-star ratings (0.5 increments). Constraint allows NULL or 0-5. Old constraint dropped. |
| 2026-04-06 | `PostCookFlow.tsx` deprecated (Phase 7B-Rev) | No longer rendered by CookingScreen. CookingScreen "Done cooking" now opens LogCookSheet directly in full mode. File kept temporarily, delete in cleanup pass. |
| 2026-04-06 | `PostCreationModal.tsx` partially deprecated for cook logging (Phase 7B-Rev) | LogCookSheet replaces it for cook flows. Component still exists for non-cook post types. Cleanup pending. |
| 2026-04-06 | `createDishPost` signature changed (Phase 7A/7B/7B-Rev) | Now accepts `visibility` and (legacy) `makeAgain`. Rating accepts null. |
| 2026-04-06 | New top-level `lib/services/recipeService.ts` created (Phase 7B-Rev) | Currently only exports `deleteRecipe`. Distinct from `lib/services/recipeExtraction/recipeService.ts` which handles save-from-extraction. |

### Phase 4/I (March 3-5)
- **MyPostsStack → StatsStack** in App.tsx. "My Posts" tab renamed to "You" and moved to far right of bottom nav
- **Legacy MyPostsStackParamList** type export kept for 4 screens (YasChef, Comments, EditMedia, MyPostDetails)
- **"Recipes" sub-tab renamed to "Cooking"** in stats dashboard
- **Period model changed** from calendar periods ('week'/'month'/'season'/'year'/'all') to rolling windows ('12w'/'6m'/'1y')
- **All stats queries use DateRange** with both .gte AND .lte bounds (previously only .gte)

### Phase 3A (February)
- **Star ratings removed** from PostCard and MyPostDetailsScreen — replaced with nutrition display and dietary badges
- **FilterDrawer state shape changed** — removed: maxCost, minPantryMatch, onePostOnly, dietaryTags. Added: dietaryFlags (8 booleans), heroIngredients, vibeTags, nutrition sliders, servingTemp
- **Dynamic theming removed** from RecipeDetailScreen and BookViewScreen — now use static StyleSheet.create() with hardcoded colors

---

## Development Setup

```bash
# Prerequisites: Node.js 18+, Expo CLI, Supabase CLI, iOS Simulator
npm install
npx expo start

# Environment: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_CLAUDE_API_KEY

# Deploy edge functions
supabase functions deploy scrape-recipe
supabase functions deploy extract-recipe-three-pass
```

---

## Ingredient Matching Pipeline (⚠️ NEEDS VALIDATION)

> **Status:** This was designed early in the project. Unclear how much was fully implemented vs. planned. Validate against actual code in `ingredientMatcher.ts`, `ingredientsParser.ts`, and the `recipe_ingredients` table before relying on these details.

### Confidence Scoring System
- **1.0** — Exact match found
- **0.8** — Fuzzy match (removed descriptors like "extra-virgin")
- **0.6-0.7** — Partial match or generic parent
- **0.5** — Fallback to generic ingredient
- **0.0** — No match found, needs_review = true

### Import Flow (designed)
```
1. Recipe JSON ingredients array
   ["2 tablespoons extra-virgin olive oil", "purple or green cabbage"]
                    ↓
2. Parser extracts structure
   {quantity: 2, unit: "tablespoon", ingredient: "extra-virgin olive oil"}
                    ↓
3. Matching attempts (in order):
   a. Exact match → confidence 1.0
   b. Simplified match → confidence 0.8
   c. Partial match → confidence 0.6
   d. Generic parent → confidence 0.5
   e. No match → confidence 0.0, needs_review = true
                    ↓
4. OR patterns detected & tracked
   Equivalent options OR Primary/Alternative
                    ↓
5. Store in recipe_ingredients + alternatives
```

### Display Principle
```
recipe_ingredients.original_text → UI → User sees exact recipe text
         ↓ (hidden from user)
    ingredient_id → nutrition, shopping list, pantry matching
```

### Hierarchical Ingredients (confirmed in DB)
```
sugar (parent, base_ingredient_id = NULL)
├── white sugar (base_ingredient_id → sugar)
├── brown sugar (base_ingredient_id → sugar)
└── powdered sugar (base_ingredient_id → sugar)
```

### Key Design Principle: Preserve Original Text
- Always store and display exact recipe wording in `original_text`
- Never show users the "matched" ingredient name
- Maintains recipe author's intent

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-06 | 3.1 | **Phase 7A/7B/7B-Rev reconciliation.** Added new top-level `lib/services/recipeService.ts` (deleteRecipe, distinct from recipeExtraction one). Added `postService.ts` to services table. Added `cookingService.ts` to services table (recipe_step_notes CRUD). Added `LogCookSheet.tsx` and `TimesMadeModal.tsx` to components with full descriptions. Marked `PostCookFlow.tsx` as DEPRECATED in 7B-Rev. Marked `PostCreationModal.tsx` as partially deprecated for cook logging. Added `PencilIcon` to recipe icons (built from noun-pencil SVGs, supports filled prop). Added `recipe_step_notes` table to data model and domain table. Added `posts.make_again`, `recipes.times_cooked`, `posts.visibility`, half-star numeric rating to data model. Updated RecipeDetailScreen and CookingScreen entries to reflect 7B-Rev changes (LogCookSheet primary CTA, edit mode banner, step notes display, "Done cooking" → LogCookSheet directly). Added Mode-variant components and Keyboard Avoidance patterns to Common Patterns. Added Recent Breaking Changes section for 7A/7B/7B-Rev. Added playbooks/ folder reference to directory structure. |
| 2026-03-05 | 3.0 | **Phase 4 complete.** Added statsService.ts (38 functions) and nutritionGoalsService.ts to services. Added components/stats/ directory (~30 components) to directory structure. Added 5 new screens (StatsScreen, DrillDown, ChefDetail, BookDetail, UserPosts). Added Navigation section with StatsStack routes and cross-stack nav pattern. Added StatsScreen Architecture section (layout, control placement, scroll subtitle, data flow). Added posts.photos JSONB pattern, anchored popup pattern, avatar handling pattern, independent section loading pattern to Common Patterns. Updated data model with user_nutrition_goals table and photos jsonb note. Updated bottom tab bar (6 tabs, You tab far right). Added Phase 4/I breaking changes. |
| 2026-03-02 | 2.1 | Added domain scope boundaries from Product Architecture, cross-domain integration map. |
| 2026-03-02 | 2.0 | Major restructure. Added 8 Feature Domains. Ingredient matching section with validation warnings. March 2 changelog incorporated. |
