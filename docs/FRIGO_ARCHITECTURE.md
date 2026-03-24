# Frigo — Architecture & Codebase Map
**Last Updated:** March 5, 2026  
**Version:** 3.0

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
│   ├── icons/
│   │   ├── index.ts                 ← Barrel export for all icon subdirectories
│   │   ├── recipe/                  ← 18 SVG components (TimerIcon, FireIcon, SortIcon, etc.)
│   │   ├── vibe/                    ← 9 SVG components (ComfortIcon, QuickIcon, etc.)
│   │   ├── pantry/                  ← 37 SVG components (FridgeIcon, VegetablesIcon, etc.)
│   │   ├── filter/                  ← 14 SVG components (DairyFreeIcon, OvenIcon, SproutIcon, etc.)
│   │   ├── HomeFilled.tsx, HomeOutline.tsx  ← Nav icons
│   │   ├── PantryFilled.tsx, GroceryFilled.tsx
│   │   └── ...
│   ├── branding/
│   │   └── icons/ChefHat2.tsx       ← Brand icons
│   ├── NutritionGoalsModal.tsx      ← Stepper inputs, daily/per-meal toggle
│   └── [40+ component files]        ← Modals, cards, pickers, sections
├── lib/
│   ├── services/                    ← ALL database interaction
│   │   ├── statsService.ts          ← 38 exported functions (Phase 4)
│   │   ├── nutritionGoalsService.ts ← Nutrition goal CRUD (Phase 4)
│   │   ├── recipeExtraction/        ← Extraction-specific services
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
| **recipeService.ts** | Recipe CRUD, save from extraction | getRecipes, saveRecipe (saves Phase 3A fields: hero_ingredients, vibe_tags, serving_temp, course_type, make_ahead_score, cooking_concept + per-ingredient classification/flavor_tags) |
| **nutritionService.ts** | Nutrition queries, batch fetch | getRecipeNutrition, getRecipeNutritionBatch, getCompactNutrition, getRecipeNutritionBreakdown, aggregateMealNutrition |
| **recipeHistoryService.ts** | Cooking history for browse modes | getCookingHistory → Map<recipe_id, CookingHistory>, getFriendsCookingInfo |
| **mealService.ts** | Meal CRUD, participants, dishes | createMeal, addDish, inviteParticipant. MealParticipant includes subscription_tier. |
| **mealPlanService.ts** | Meal plan items, calendar | getPlanItems, claimItem |
| **feedGroupingService.ts** | Feed post grouping logic | groupFeedItems |
| **postParticipantsService.ts** | Cooking partners on posts | getParticipants, invitePartner |
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

---

## Screens (screens/)

| Screen | Notes |
|--------|-------|
| **StatsScreen.tsx** | Main stats container. Cooking Stats/My Posts toggle (Strava underline). Sub-tabs: Overview/Cooking/Nutrition/Insights. Sticky bar with descriptive subtitle on non-Overview tabs. ControlStrip at top of content for Cooking/Nutrition/Insights. My Posts inline with .map() (no FlatList). Contains ActivityCard and ControlStrip inline components. |
| **DrillDownScreen.tsx** | Reusable drill-down for cuisine/concept/method/ingredient. Stats, most cooked, ingredients, chefs, explore CTA. Cross-stack nav to RecipeList with filters. |
| **ChefDetailScreen.tsx** | Chef stats: hero stats, nutrition comparison, most cooked, concepts, signature ingredients, stock up, books. |
| **BookDetailScreen.tsx** | Book stats: progress bar, completion%, most cooked, highest rated, key ingredients, cuisines, methods. |
| **UserPostsScreen.tsx** | Read-only Strava-style activity cards for other users' posts. |
| RecipeDetailScreen.tsx | Largest screen. RecipeNutritionPanel integrated. Static StyleSheet (dynamic theming removed). |
| RecipeListScreen.tsx | Phase 3A overhaul. Expandable cards, 3 browse modes (All/Cook Again/Try New), 8 sort options, quick filter chips with SVG icons. Accepts initial filter params from stats drill-downs (cuisine, concept, dietary, sortBy). |
| FeedScreen.tsx | Feed data loading. Navigation callbacks for onRecipePress, onChefPress, onDishPress. Queries include cook_time, prep_time, cuisine. |
| MyPostDetailsScreen.tsx | RecipeNutritionPanel replaces old star ratings. Uses UserAvatar component. |
| BookViewScreen.tsx | Static styling. User auth check — filters recipes by user_id (security fix). |
| MealDetailScreen.tsx | Dishes, participants, plan items |
| PantryScreen.tsx | SVG icons for storage/family/type with emoji fallback |
| CookingScreen.tsx | Step-by-step with timers |
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

### Cards & Display
PostCard.tsx (Strava-style stat row, recipe/chef press callbacks, recipe image fallback with badge, dietary badges, star ratings removed), MealPostCard.tsx (batch nutrition fetch + aggregation, clickable dish names, stacked UserAvatar for likes), LinkedPostsGroup.tsx, RecipeNutritionPanel.tsx (collapsible: calories+PCF collapsed, full macro breakdown expanded, quality confidence indicator), DietaryBadgeRow.tsx (color-coded dietary flags, compact/default sizes, overflow +N), UserAvatar.tsx (handles emoji strings, URLs, and null via regex `/^[\p{Emoji}\u200D\uFE0F]+$/u`; emoji font size 0.75x), NutritionGoalsModal.tsx (6 nutrients, stepper inputs, daily/per-meal toggle, MEALS_PER_DAY=2.5), PostActionMenu.tsx, CategoryHeader.tsx (SVG family icons, chip-style type breakdown), TypeHeader.tsx (SVG type icons with emoji fallback), PantryItemRow.tsx (SVG stock status: NoneIcon/WarningIcon/LowFuelIcon), GroceryListItem.tsx, MealInvitationsCard.tsx, PendingSpaceInvitations.tsx, MarkupText.tsx

### Modals
AddRecipeModal, AddDishToMealModal, AddGroceryItemModal, AddMealParticipantsModal, AddMediaModal, AddPantryItemModal, AddPlanItemModal, AddRecipeToListModal, AddRegularItemModal, AddCookingPartnersModal, AnnotationModal, AnnotationModeModal, BookOwnershipModal, BookSelectionModal, CookingPartnerApprovalModal, CreateMealModal, CreateSpaceModal, DayMealsModal, EditIngredientModal, EditInstructionModal, EditMealModal, EditRegularItemModal, EmojiPickerModal, FilterDrawer (major rewrite — see FilterDrawer State below), InviteMemberModal, ItemDetailModal, ParticipantsListModal, PostCreationModal, QuickAddModal, QuickMealPlanModal, SelectMealForRecipeModal, SelectMealModal

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
├── post_type: 'dish' (standalone) or 'meal' (parent)
├── parent_meal_id (for dish posts within meals)
├── cooking_method, modifications
├── photos: jsonb column (NOT a relation — [{url, order}])
├── (star ratings REMOVED from UI — column may still exist in DB)

meals → meal_dishes, meal_participants, meal_plan_items
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
| 🍳 Recipe | recipes, recipe_ingredients, instruction_sections, instruction_steps, recipe_photos, recipe_annotations, recipe_references, books, chefs, user_books |
| 👩‍🍳 Cooking | recipe_annotations (edits while cooking), instruction_steps |
| 🗓️ Meal Planning | meal_dish_plans, user_recipe_tags, posts (meal type) |
| 👥 Social | posts, post_likes, post_comments, comment_likes, post_participants, post_relationships, follows, meal_participants, **user_nutrition_goals** |
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

**78 SVG components** across 4 groups, all following `({ size = 24, color = '#000' }) => <Svg>...</Svg>`

| Group | Count | Examples |
|-------|-------|---------|
| recipe/ | 18 | TimerIcon, FireIcon, BodybuilderIcon, SortIcon, BookIcon, AgainIcon, PinIcon |
| vibe/ | 9 | ComfortIcon, FreshLightIcon, ImpressiveIcon, QuickIcon, ProjectIcon |
| pantry/ | 37 | VegetablesIcon, MeatIcon, DairyIcon, FridgeIcon, WarningIcon, NoneIcon, LowFuelIcon |
| filter/ | 14 | DairyFreeIcon, GlutenFreeIcon, OvenIcon, GrillIcon, AirFryerIcon, SproutIcon |

**Pantry dual system (constants/pantry.ts):**
- Emoji functions (fallback): `getFamilyIcon()`, `getTypeIcon()` — getTypeIcon uses INGREDIENT_TYPE_ALIASES for normalized lookup
- Component functions: `getFamilyIconComponent()`, `getTypeIconComponent()`, `getStorageIconComponent()`

**Vibe tag mapping (constants/vibeIcons.ts):**
- Maps 10 vibe tag strings → icon components (comfort, fresh & light, impressive, etc.)

**Imports:** All via barrel export: `import { TimerIcon, FireIcon } from './components/icons'`

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

Save flow: extraction → RecipeReviewScreen → recipeService.ts → DB
⚠️ Save path not yet tested end-to-end for Phase 3A fields (see B19 in deferred work)

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

---

## Recent Breaking Changes (March 2026)

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
| 2026-03-05 | 3.0 | **Phase 4 complete.** Added statsService.ts (38 functions) and nutritionGoalsService.ts to services. Added components/stats/ directory (~30 components) to directory structure. Added 5 new screens (StatsScreen, DrillDown, ChefDetail, BookDetail, UserPosts). Added Navigation section with StatsStack routes and cross-stack nav pattern. Added StatsScreen Architecture section (layout, control placement, scroll subtitle, data flow). Added posts.photos JSONB pattern, anchored popup pattern, avatar handling pattern, independent section loading pattern to Common Patterns. Updated data model with user_nutrition_goals table and photos jsonb note. Updated bottom tab bar (6 tabs, You tab far right). Added Phase 4/I breaking changes. |
| 2026-03-02 | 2.1 | Added domain scope boundaries from Product Architecture, cross-domain integration map. |
| 2026-03-02 | 2.0 | Major restructure. Added 8 Feature Domains. Ingredient matching section with validation warnings. March 2 changelog incorporated. |
