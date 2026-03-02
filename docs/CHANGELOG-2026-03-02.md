# Changelog - 2 March 2026

Comprehensive update covering Phase 3A recipe classification, SVG icon system, social feed redesign, nutrition display, and cookbook extraction pipeline.

---

## Commit 1: Platform housekeeping

### `.gitignore`
- Fixed corrupted UTF-16 encoding at end of file
- Added exclusions for: `External documents/`, `assets/svg-source/`, `test-*.ps1`, `recipe_classification_*.json`
- Added exclusions for superseded edge function versions (`extract-recipe-v2` through `v10.2`)

### `CLAUDE.md`
- Replaced verbose file listings with concise `...` placeholders
- Removed old/new theme system documentation (theme migration is complete)
- Added formal "8 Domains" table mapping all code to domain areas
- Added "Tracker Row Generation" section with tab-separated format instructions for the Code_Log spreadsheet
- Added convention: "Don't remove existing functionality unless asked"

### `.claude/settings.local.json`
- Updated local Claude Code settings

---

## Commit 2: SVG icon system and emoji-to-icon migrations

### New icon components (78 files across 4 groups)

**`components/icons/filter/`** (14 files)
Dietary filter icons (`DairyFreeIcon`, `GlutenFreeIcon`, `NutFreeIcon`, `SoyFreeIcon`, `EggFreeIcon`, `ShellfishFreeIcon`), cooking method icons (`OvenIcon`, `GrillIcon`, `SlowCookerIcon`, `AirFryerIcon`), and temperature/diet icons (`WarmIcon`, `ThermometerIcon`, `SproutIcon`). All accept `size` and `color` props via `react-native-svg`.

**`components/icons/pantry/`** (37 files)
Food category icons covering vegetables, meat, dairy, canned goods, leafy greens, fruit, herbs, mushrooms, seafood, tofu, grains, baking, oils, condiments, spices, nuts, beans, soup. Also includes dairy subcategory icons (milk, yogurt, cheese, butter, eggs), storage icons (fridge, cold), and status indicators (warning, none, low fuel).

**`components/icons/recipe/`** (18 files)
Recipe metadata icons: `TimerIcon`, `FireIcon`, `BodybuilderIcon`, `ServingIcon`, `LevelIcon`, `PiggyBankIcon`. Badge icons: `BookIcon`, `AgainIcon`, `NewIcon`, `GemIcon`. Cooking mode icons: `PanIcon`, `FriendsIcon`, `PotIcon`, `EasyIcon`. List action icons: `SortIcon`, `StarIcon`, `PinIcon`.

**`components/icons/vibe/`** (9 files)
Vibe tag icons for the 8 recipe moods: `ComfortIcon`, `FreshLightIcon`, `ImpressiveIcon`, `QuickIcon`, `MealPrepIcon`, `CrowdPleaserIcon`, `AdventurousIcon`, `ProjectIcon`.

### `constants/vibeIcons.ts` (new)
Maps vibe tag string keys (e.g., `'comfort'`, `'fresh & light'`) to their SVG icon components.

### `components/icons/index.ts` (modified)
Added barrel re-exports for all four new icon groups (`./recipe`, `./vibe`, `./pantry`, `./filter`).

### `constants/pantry.ts` (modified)
- Added ~30 SVG icon component imports
- Added `INGREDIENT_TYPE_ALIASES` map to normalize lowercase DB values to canonical type keys
- Added three component-based icon maps: `FAMILY_ICON_COMPONENTS`, `INGREDIENT_TYPE_ICON_COMPONENTS`, `STORAGE_ICON_COMPONENTS`
- Added three accessor functions: `getFamilyIconComponent()`, `getTypeIconComponent()`, `getStorageIconComponent()`
- Updated `getTypeIcon()` to try alias-based lookup before direct lookup

### Emoji-to-SVG migrations

**`components/CategoryHeader.tsx`** - Family icons and collapsed type breakdown now use SVG icons with emoji fallback. Type breakdown changed from a single text string to chip-style elements with icons.

**`components/TypeHeader.tsx`** - Type header icons now render SVG components, falling back to box emoji if unavailable.

**`components/PantryItemRow.tsx`** - Stock status badges ("Out", "Critical", "Low") now use `NoneIcon`, `WarningIcon`, `LowFuelIcon` SVG components instead of emoji.

**`screens/PantryScreen.tsx`** - Empty state uses `VegetablesIcon` instead of lettuce emoji. "Expiring Soon" header uses `WarningIcon`. Type/family/storage section headers render SVG icons with emoji fallback.

**`screens/GroceryListDetailScreen.tsx`** - Cart emoji replaced with `GroceryFilled` SVG component in progress bar and empty state.

**`components/UserAvatar.tsx`** - Fixed emoji detection regex by adding `\uFE0F` (variation selector) to the pattern. Increased emoji font size from `size * 0.6` to `size * 0.75`.

---

## Commit 3: Nutrition, history, and classification services

### `lib/services/nutritionService.ts` (new, 390 lines)
Service layer for recipe nutrition data, querying the `recipe_nutrition_computed` materialized view and `recipe_ingredient_nutrition` view.
- `getRecipeNutrition()` - Full nutrition with macros, dietary flags, quality metadata
- `getIngredientNutrition()` - Per-ingredient calorie breakdown
- `getCompactNutrition()` - Lightweight version for feed cards
- `getRecipeNutritionBatch()` - Batch fetch for meal planning
- `aggregateMealNutrition()` - Sums nutrition across multiple recipes
- Helper functions for quality labels, dietary flag display, color coding

### `lib/services/recipeHistoryService.ts` (new, 155 lines)
Cooking history and social cooking data:
- `getCookingHistory(userId)` - Queries posts table, groups by recipe, computes times_cooked, first/last cooked, average/latest rating. Returns a `Map` for O(1) lookups.
- `getFriendsCookingInfo(userId)` - Resolves followed user IDs, counts distinct friends who've cooked each recipe.

### `components/DietaryBadgeRow.tsx` (new, 106 lines)
Renders a horizontal row of color-coded dietary flag badges (Vegan, GF, Dairy-Free, Nut-Free, Egg-Free, Soy-Free, Shellfish-Free). Supports `compact` and `default` sizes with overflow `+N more` indicator.

### `components/RecipeNutritionPanel.tsx` (new, 486 lines)
Collapsible nutrition panel for recipe detail screens:
- **Collapsed:** Calories + macro highlights (P/C/F)
- **Expanded:** Macro proportion bar chart, detailed nutrient breakdown (fiber, sugar, sodium), quality confidence indicator with tap-to-explain, per-ingredient calorie breakdown

### `lib/types/recipeExtraction.ts` (modified)
Added Phase 3A fields to `ExtractedRecipeData.recipe`: `hero_ingredients`, `vibe_tags`, `serving_temp`, `course_type`, `make_ahead_score`, `cooking_concept`. Added to `ExtractedIngredient`: `ingredient_classification` (hero/primary/secondary), `flavor_tags`. Added `page_number` to `RecipeWithBook`.

### `lib/services/recipeExtraction/recipeService.ts` (modified)
Added 6 new fields to recipe insert in `saveRecipe()`: `hero_ingredients`, `vibe_tags`, `serving_temp`, `course_type`, `make_ahead_score`, `cooking_concept`. Added 2 new fields to ingredient insert: `ingredient_classification`, `flavor_tags`.

### `lib/services/mealService.ts` (modified)
Added `subscription_tier` to `MealParticipant.user_profile` interface and data mapping, enabling tier-based badge rendering on participant avatars.

---

## Commit 4: Recipe browse redesign

### `components/FilterDrawer.tsx` (modified, near-complete rewrite)
- `FilterState` expanded with: `dietaryFlags` (8 boolean fields), `heroIngredients`, `vibeTags`, `maxCaloriesPerServing`, `minProteinPerServing`, `servingTemp`
- Removed old fields: `maxCost`, `minPantryMatch`, `onePostOnly`, `dietaryTags`
- New filter sections: dietary flag toggle chips with SVG icons, vibe tag selection, hero ingredient input with suggestion chips, serving temperature filter (hot/warm/room temp/cold), nutrition sliders, course type filter
- Active filter count badge in header
- All cooking method options now use SVG icons

### `screens/RecipeListScreen.tsx` (modified, major enhancement)
- Browse mode segmented control: "All", "Cook Again", "Try New"
- "Cook Again" mode uses `SectionList` with smart groupings: "Recent Favorites", "Forgotten Gems", "Regulars"
- "Try New" mode adds book dropdown filter
- Quick filters changed from emoji to SVG icons: Vegetarian, High Protein, Under 30m, Comfort
- Sort options: newest, alpha, cal_low, cal_high, protein_high, fastest, most_cooked, highest_rated
- Recipe interface expanded with Phase 3A fields, cooking history, and nutrition data
- Header simplified: removed More/filter button, replaced `+` with wide "Add Recipe" button

### `screens/RecipeDetailScreen.tsx` (modified, refactor)
- Removed `useTheme` and `useMemo`-based dynamic styles (~585 lines)
- Moved to static `StyleSheet.create()` with hardcoded colors
- Replaced `QuickMealPlanModal` with `SelectMealForRecipeModal`
- Added `RecipeNutritionPanel` for displaying nutrition data

### `screens/BookViewScreen.tsx` (modified, refactor + security fix)
- Added user authentication check in `loadBookData()` - now fetches `supabase.auth.getUser()` and filters recipes by `user_id` (only shows user's own recipes)
- Removed dynamic theming, moved to static `StyleSheet.create()`

---

## Commit 5: Strava-style social feed redesign

### `components/PostCard.tsx` (modified, major redesign)
- Added `onRecipePress` and `onChefPress` callback props for navigation
- Dynamic `stats` array (Time, Method, Cuisine) for Strava-style stat row
- Recipe title and chef name are now clickable links
- Recipe image used as fallback when post has no photos (with "Recipe photo" badge overlay)
- **Removed** star rating display entirely
- Added dietary badge row (vegan/vegetarian/GF/DF/NF/EF)
- Uses `UserAvatar` component instead of inline avatar styles
- Fixed comment count check using nullish coalescing

### `components/MealPostCard.tsx` (modified, major enhancement)
- Added `onDishPress` callback for navigating to recipes from dish names
- Fetches nutrition data for all dishes via batch API + aggregation
- Renders nutrition stats row (Calories/Protein/Carbs/Fat) with dietary badges
- Dish names now clickable with link styling
- Likes section shows stacked `UserAvatar` components
- Comments now tappable
- Stat labels uppercase with letter-spacing (Strava-inspired)

### `components/LinkedPostsGroup.tsx` (modified, bug fix)
Changed `likesText` initialization from empty string `''` to `undefined` to fix truthy empty string rendering.

### `App.tsx` (modified)
Added `RecipeDetail` and `AuthorView` screens to `FeedStackParamList` type and registered them in `FeedStackNavigator`, enabling navigation from feed posts to recipe details and chef profiles.

### `screens/FeedScreen.tsx` (modified)
- Recipe query now includes `cook_time_min`, `prep_time_min`, `cuisine_types`
- Added `onDishPress`, `onRecipePress`, `onChefPress` navigation handlers
- Cleaned up comments and privacy filtering code

### `screens/MyPostDetailsScreen.tsx` (modified)
- **Replaced** `renderStars()` with `RecipeNutritionPanel`
- Added `id` to recipe query for nutrition panel
- Removed star rating styles (`ratingContainer`, `starsContainer`, `star`)
- Removed inline avatar styles (uses `UserAvatar`)

---

## Commit 6: Cookbook extraction pipeline and classification scripts

### Supabase Edge Functions

**`supabase/functions/extract-book-toc/`** (310 lines)
Extracts table of contents from a cookbook image using Claude Sonnet vision. Identifies sections, recipes, and page numbers. Stores structured TOC data on the `books` table.

**`supabase/functions/scan-book-pages/`** (438 lines)
Scans cookbook page spreads using Claude Sonnet vision. Identifies recipe titles (large/bold text detection), page numbers, ingredients, steps, and photos. Saves structured per-page data to `book_page_scans` table.

**`supabase/functions/assemble-book-recipes/`** (535 lines)
Assembles complete recipes from scanned page data. Processes overlapping chunks, cross-references TOC, saves assembled recipes to `book_recipe_assembly` table.

**`supabase/functions/process-recipe-queue/`** (722 lines + config.toml)
Version 12 queue processor. Uses TOC-guided extraction with smart post-processing and fuzzy title matching. Handles image resize to avoid cropping. Config: JWT verification, 300s timeout.

**`supabase/functions/extract-recipe-three-pass/`** (921 lines)
Current production extraction function. Three-pass pipeline:
1. **Pass 1:** Visual analysis and recipe counting
2. **Pass 2:** Detailed extraction with counts as constraints
3. **Pass 3:** Verification pass
Supports Haiku (default, 92% cheaper) or Sonnet. Includes gold standard comparison and test mode.

**`supabase/functions/import_map.json`**
Deno import map for edge functions (deno.land and esm.sh imports).

### Classification Scripts

**`scripts/recipe_classification_test.py`** (503 lines)
Compares Haiku vs Sonnet on 10 specific recipes for ingredient-level classification (roles, flavor tags) and recipe-level classification (hero ingredients, vibe tags, serving temp, dominant flavors).

**`scripts/recipe_classification_backfill.py`** (412 lines)
Production backfill script that classifies ALL recipes using Haiku. Writes ingredient roles, flavor tags, hero ingredients, vibe tags, serving temp, course type, and make-ahead score back to Supabase. Supports `--dry-run`, `--resume`, `--limit`.

**`scripts/backfill_cooking_concept.py`** (220 lines)
Backfill script for `cooking_concept` field. Uses Haiku in batches of 40 recipes to classify dish type from a defined vocabulary.

---

## Gitignored (not committed)

| Path | Reason |
|------|--------|
| `External documents/` | Claude Code prompt scripts used during development |
| `assets/svg-source/*.svg` | Raw SVG source files (~120 files) used to create icon components |
| `test-*.ps1` | PowerShell test scripts for extraction pipeline testing |
| `recipe_classification_*.json` | Output artifacts from classification script runs |
| `supabase/functions/extract-recipe-v2/` through `v10.2/` | 13 superseded extraction function versions |

---

## Breaking changes

- **Star ratings removed** from `PostCard` and `MyPostDetailsScreen` - replaced with nutrition display
- **FilterDrawer state shape changed** - old filter fields (`maxCost`, `minPantryMatch`, `onePostOnly`, `dietaryTags`) removed, new fields added
- **Dynamic theming removed** from `RecipeDetailScreen` and `BookViewScreen` - now uses hardcoded colors via static `StyleSheet.create()`
