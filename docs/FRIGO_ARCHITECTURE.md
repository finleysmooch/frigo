# Frigo — Architecture & Codebase Map
**Last Updated:** March 2, 2026  
**Version:** 2.0

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

## Directory Structure

```
frigo/
├── App.tsx                          ← Main entry, navigation, tab bar
├── CLAUDE.md                        ← Claude Code instructions (8 domains, tracker rows, conventions)
├── screens/                         ← 30+ screen components
├── components/
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
│   └── [40+ component files]        ← Modals, cards, pickers, sections
├── lib/
│   ├── services/                    ← ALL database interaction
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
└── external_documents/              ← Claude Code prompt files (gitignored)
```

---

## Services (lib/services/)

| Service | Purpose | Key Functions |
|---------|---------|---------------|
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
| RecipeDetailScreen.tsx | Largest screen. RecipeNutritionPanel integrated. Static StyleSheet (dynamic theming removed). |
| RecipeListScreen.tsx | Phase 3A overhaul. Expandable cards, 3 browse modes (All/Cook Again/Try New), 8 sort options, quick filter chips with SVG icons. |
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
| MyPostsScreen.tsx | User's posts list |
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

### Cards & Display
PostCard.tsx (Strava-style stat row, recipe/chef press callbacks, recipe image fallback with badge, dietary badges, star ratings removed), MealPostCard.tsx (batch nutrition fetch + aggregation, clickable dish names, stacked UserAvatar for likes), LinkedPostsGroup.tsx, RecipeNutritionPanel.tsx (collapsible: calories+PCF collapsed, full macro breakdown expanded, quality confidence indicator), DietaryBadgeRow.tsx (color-coded dietary flags, compact/default sizes, overflow +N), UserAvatar.tsx (emoji regex includes \uFE0F, emoji font size 0.75x), PostActionMenu.tsx, CategoryHeader.tsx (SVG family icons, chip-style type breakdown), TypeHeader.tsx (SVG type icons with emoji fallback), PantryItemRow.tsx (SVG stock status: NoneIcon/WarningIcon/LowFuelIcon), GroceryListItem.tsx, MealInvitationsCard.tsx, PendingSpaceInvitations.tsx, MarkupText.tsx

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
├── (star ratings REMOVED from UI — column may still exist in DB)

meals → meal_dishes, meal_participants, meal_plan_items
spaces → space_members, space_invitations
pantry_items → ingredients (space-aware)
grocery_lists → grocery_list_items → ingredients
regular_items
```

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

### Theme Usage
```typescript
const { colors, functionalColors } = useTheme();
// Never hardcode colors — always use theme
// Exception: RecipeDetailScreen and BookViewScreen currently use static StyleSheet
```

---

## Recent Breaking Changes (March 2026)

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

### OR Pattern Detection (designed)
- Color variants → Equivalent (red/green cabbage)
- Common substitutions → Primary/Alternative (butter/oil)
- Decisions tracked to `or_pattern_decisions` table (⚠️ may not exist)

### Analytics Views (designed, may not exist)
- `or_pattern_analysis` — Aggregated OR patterns across recipes
- `migration_readiness` — Progress toward ML-based matching
- `remaining_review_items` — Ingredients needing manual review
- `unmatched_ingredients` — Items that couldn't be matched

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
