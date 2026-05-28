# CC Prompt — Phase 10E: Meal-level nutrition aggregation UI

## Context

Phase 10A-D shipped earlier today 2026-05-27. We have:
- 10 micronutrient columns on `ingredients`
- 10 micro rollups in `recipe_nutrition_computed` matview
- Recipe-level micro UI (10C) on `RecipeDetailScreen`
- Stats-screen micro UI (10D) on the Stats Nutrition tab

This step (10E) wires aggregated nutrition into the meal-level surfaces. When a meal has multiple dishes (each linked to a recipe), users see one consolidated nutrition panel showing the combined macros + micros across all dishes.

Two screens host meals in Frigo:
- **`MealEventDetailScreen`** (the Phase 7I-shipped surface, cook-post-centric, primary target)
- **`MealDetailScreen`** (legacy, still in use for MyMeals tab and meal_plan_items)

Both get the same new panel for parity.

**Existing substrate:** `aggregateMealNutrition` exists in `nutritionService.ts` (line ~348) but currently only rolls up 4 macros (cal/P/C/F) and returns the narrow `CompactNutrition` type. It's currently unused — so refactoring its return shape is safe.

## Inputs to read

1. `lib/services/nutritionService.ts` — particularly `aggregateMealNutrition` (line ~348), `getRecipeNutritionBatch` (line ~284), `CompactNutrition` type, the new 10C extensions to `RecipeNutrition`
2. `components/RecipeNutritionPanel.tsx` — the design pattern to mirror. Same Vitamins/Minerals sub-section structure, same disclaimer copy, same DV % formatting
3. `screens/MealEventDetailScreen.tsx` — anchor at line ~1101 ("Block 5 — What everyone brought"). New panel slots in AFTER this block (i.e., as the next block after the dish rows)
4. `screens/MealDetailScreen.tsx` — anchor at line ~1361 (Dishes Section). New panel slots in AFTER this section
5. `lib/services/mealService.ts` — `MealEventDetail.cooks[]` (line ~1595) and `DishInMeal` (line ~65) shapes. Both have nullable `recipe_id`
6. `lib/constants/dailyValues.ts` — from 10C, contains `DAILY_VALUES` constant + `getDvPercent` helper

## Task

### Edit 1 — `lib/services/nutritionService.ts`

**(a)** Add a new `MealNutrition` type next to `CompactNutrition`. Richer shape — all macros + 10 micros + quality + dish count.

```typescript
/**
 * Aggregated nutrition across multiple dishes in a meal.
 * Semantically: "one serving of each dish" — sums cal_per_serving, protein_per_serving_g, etc. across recipes.
 * Per-person estimate at a potluck-style meal; understated for people who skip dishes,
 * overstated for people who have seconds.
 */
export interface MealNutrition {
  // Macros (per-person, summed across one serving of each dish)
  cal_per_person: number;
  protein_per_person_g: number;
  carbs_per_person_g: number;
  fat_per_person_g: number;
  fiber_per_person_g: number;
  sugar_per_person_g: number;
  sodium_per_person_mg: number;
  // Micronutrients (per-person, summed across one serving of each dish)
  vitamin_a_per_person_mcg: number;
  vitamin_c_per_person_mg: number;
  vitamin_d_per_person_mcg: number;
  vitamin_b12_per_person_mcg: number;
  folate_per_person_mcg: number;
  iron_per_person_mg: number;
  calcium_per_person_mg: number;
  potassium_per_person_mg: number;
  magnesium_per_person_mg: number;
  zinc_per_person_mg: number;
  // Dietary flags — AND across all dishes (meal is only vegan if every dish is vegan)
  is_vegan: boolean;
  is_vegetarian: boolean;
  is_gluten_free: boolean;
  is_dairy_free: boolean;
  is_nut_free: boolean;
  is_shellfish_free: boolean;
  is_soy_free: boolean;
  is_egg_free: boolean;
  // Metadata
  dishes_with_nutrition: number;  // count of recipes that had nutrition data
  total_dishes: number;            // count of recipe_ids passed in (some may lack nutrition)
  quality_label: NutritionQualityLabel;
}
```

**(b)** Refactor `aggregateMealNutrition` to return `MealNutrition` instead of `CompactNutrition`. Update its signature, body, and return shape.

```typescript
export function aggregateMealNutrition(
  nutritions: RecipeNutrition[],
  totalDishCount?: number  // optional — pass the original recipe_id count to surface "X dishes had no data"
): MealNutrition | null {
  if (nutritions.length === 0) return null;

  // Per-person sums — one serving of each dish
  const sum = (key: keyof RecipeNutrition) =>
    nutritions.reduce((acc, n) => acc + (Number(n[key]) || 0), 0);

  // For totals that need to be divided by servings (fiber/sugar/sodium + all 10 micros)
  const sumPerServing = (totalKey: keyof RecipeNutrition) =>
    nutritions.reduce((acc, n) => {
      const total = Number(n[totalKey]) || 0;
      const servings = n.servings || 1;
      return acc + (total / servings);
    }, 0);

  return {
    // Macros
    cal_per_person: Math.round(sum('cal_per_serving')),
    protein_per_person_g: Math.round(sum('protein_per_serving_g') * 10) / 10,
    carbs_per_person_g: Math.round(sum('carbs_per_serving_g') * 10) / 10,
    fat_per_person_g: Math.round(sum('fat_per_serving_g') * 10) / 10,
    fiber_per_person_g: Math.round(sumPerServing('total_fiber_g') * 10) / 10,
    sugar_per_person_g: Math.round(sumPerServing('total_sugar_g') * 10) / 10,
    sodium_per_person_mg: Math.round(sumPerServing('total_sodium_mg')),
    // Micros
    vitamin_a_per_person_mcg: Math.round(sumPerServing('total_vitamin_a_mcg') * 10) / 10,
    vitamin_c_per_person_mg: Math.round(sumPerServing('total_vitamin_c_mg') * 10) / 10,
    vitamin_d_per_person_mcg: Math.round(sumPerServing('total_vitamin_d_mcg') * 10) / 10,
    vitamin_b12_per_person_mcg: Math.round(sumPerServing('total_vitamin_b12_mcg') * 10) / 10,
    folate_per_person_mcg: Math.round(sumPerServing('total_folate_mcg') * 10) / 10,
    iron_per_person_mg: Math.round(sumPerServing('total_iron_mg') * 10) / 10,
    calcium_per_person_mg: Math.round(sumPerServing('total_calcium_mg') * 10) / 10,
    potassium_per_person_mg: Math.round(sumPerServing('total_potassium_mg') * 10) / 10,
    magnesium_per_person_mg: Math.round(sumPerServing('total_magnesium_mg') * 10) / 10,
    zinc_per_person_mg: Math.round(sumPerServing('total_zinc_mg') * 10) / 10,
    // Dietary flags — every dish must satisfy for the meal to satisfy
    is_vegan: nutritions.every(n => n.is_vegan),
    is_vegetarian: nutritions.every(n => n.is_vegetarian),
    is_gluten_free: nutritions.every(n => n.is_gluten_free),
    is_dairy_free: nutritions.every(n => n.is_dairy_free),
    is_nut_free: nutritions.every(n => n.is_nut_free),
    is_shellfish_free: nutritions.every(n => n.is_shellfish_free),
    is_soy_free: nutritions.every(n => n.is_soy_free),
    is_egg_free: nutritions.every(n => n.is_egg_free),
    // Metadata
    dishes_with_nutrition: nutritions.length,
    total_dishes: totalDishCount ?? nutritions.length,
    quality_label: getWorstQualityLabel(nutritions.map(n => n.quality_label)),
  };
}
```

The existing `getWorstQualityLabel` helper (defined at the bottom of the file) is reused. No changes to it.

### File 2 — NEW `components/MealNutritionPanel.tsx`

Mirrors `RecipeNutritionPanel.tsx` structure but for meal-level data. Always expanded (no outer collapse — meal nutrition is auxiliary; on the meal page users have already opted in). Sub-toggle for Vitamins & minerals matches the recipe panel's pattern exactly.

Component signature:
```typescript
interface MealNutritionPanelProps {
  recipeIds: string[];  // recipe IDs from the meal's dishes (filter nulls before passing)
}
```

Behavior:
- Calls `getRecipeNutritionBatch(recipeIds)` on mount
- Calls `aggregateMealNutrition(Array.from(nutritionMap.values()), recipeIds.length)` 
- If `recipeIds.length === 0` → render nothing (parent screen renders nothing for this section)
- If aggregation returns null (no recipes had data) → render the panel with empty-state message: "No nutrition data available yet" + reason ("Add recipes to dishes to see meal nutrition")
- If `dishes_with_nutrition < total_dishes` → render the panel normally but add a small note: "Nutrition shown for X of Y dishes" near the quality indicator

Panel structure (matches RecipeNutritionPanel Variant C from 10C):

```
┌─ Card ────────────────────────────────────────┐
│ Meal nutrition                                │
│ Total · one serving of each dish              │ ← subtitle
│                                               │
│ [608 calories]                                │ ← large headline
│                                               │
│ [protein/carbs/fat proportion bar]            │
│                                               │
│ Protein            42.1g                      │ ← 6 macro rows
│ Carbs              98.4g                      │
│ Fat                36.2g                      │
│ Fiber              12.3g                      │
│ Sugar              18.7g                      │
│ Sodium             1,240mg                    │
│                                               │
│ ▶ Vitamins & minerals                         │ ← sub-toggle (default collapsed)
│                                               │
│ ● Good estimate ⓘ                             │ ← quality dot
│ Nutrition for 3 of 4 dishes                   │ ← only when partial
└───────────────────────────────────────────────┘
```

When the sub-toggle is expanded:
```
▼ Vitamins & minerals
    VITAMINS
    Vitamin A         48mcg  (5% DV)
    Vitamin C         62.4mg (69% DV)
    Vitamin D         0.3mcg (2% DV)
    Vitamin B12       2.1mcg (88% DV)
    Folate            312mcg (78% DV)
    MINERALS
    Iron              7.4mg  (41% DV)
    Calcium           618mg  (48% DV)
    Potassium         1,847mg (39% DV)
    Magnesium         142mg  (34% DV)
    Zinc              4.8mg  (44% DV)
    Estimates based on USDA data and ingredient matching. Directional, not for medical use.
```

Use the existing NutrientRow pattern from RecipeNutritionPanel.tsx (the version updated in 10C that supports optional dvPercent). Copy the NutrientRow definition if needed, or import it if it's exported from RecipeNutritionPanel — CC's call based on what's cleaner.

Disclaimer wording must be exactly: `"Estimates based on USDA data and ingredient matching. Directional, not for medical use."`

Styling: match the RecipeNutritionPanel's container styles, padding, colors. The panel should visually feel like a sibling of the recipe panel.

Import the DV helpers:
```typescript
import { getDvPercent } from '../lib/constants/dailyValues';
```

### File 3 — `screens/MealEventDetailScreen.tsx`

Add the `MealNutritionPanel` component AFTER the "Block 5 — What everyone brought" `dishesBlock` (current closing around line ~1300-1310, look for the closing of the `<View style={styles.dishesBlock}>` block).

Import the panel:
```typescript
import MealNutritionPanel from '../components/MealNutritionPanel';
```

Insert as a new block:
```typescript
{/* Block 6 — Meal nutrition */}
{detail.cooks.length > 0 && (
  <View style={styles.nutritionBlock}>
    <MealNutritionPanel
      recipeIds={detail.cooks
        .map(c => c.recipe_id)
        .filter((id): id is string => !!id)}
    />
  </View>
)}
```

Add a `nutritionBlock` style entry to the StyleSheet matching the existing block spacing (use same `marginTop`, `marginHorizontal`, etc. as `dishesBlock` for visual consistency).

If `recipeIds` is empty (e.g., all dishes were posted without recipe links), the panel returns null gracefully — the outer conditional `detail.cooks.length > 0 && ...` is just to skip rendering when there are no cooks at all. The panel itself handles the empty-recipe-list case.

### File 4 — `screens/MealDetailScreen.tsx`

Add the `MealNutritionPanel` component AFTER the "Dishes Section" (currently around line ~1361-1600). Look for the closing of that section's container `<View>` and insert the panel as the next sibling section.

Import the panel:
```typescript
import MealNutritionPanel from '../components/MealNutritionPanel';
```

Insert as a new section:
```typescript
{/* Nutrition Section */}
{dishes.length > 0 && (
  <View style={styles.section}>
    <MealNutritionPanel
      recipeIds={dishes
        .map(d => d.recipe_id)
        .filter((id): id is string => !!id)}
    />
  </View>
)}
```

Reuses the existing `section` style. No new styles needed.

## Constraints

- DO NOT modify `getRecipeNutritionBatch` — it was extended in 10C and returns all the needed fields already
- DO NOT modify the matview — that's done in 10B
- DO NOT add an outer collapse toggle to MealNutritionPanel — always-expanded by design
- DO NOT add per-dish breakdown inside the panel — that's the surrounding screen's job (the dishes block already shows each dish)
- Disclaimer wording MUST be exact: `"Estimates based on USDA data and ingredient matching. Directional, not for medical use."`
- The new `MealNutrition` type's fields are named `*_per_person_*` (not `*_per_serving_*`) deliberately — emphasizes the aggregation semantic. Don't rename.
- Existing callers of `aggregateMealNutrition` — there are NONE currently (function is defined but unused), so the return-type change is safe. Verify with `grep -rn "aggregateMealNutrition(" --include="*.ts" --include="*.tsx" .`
- Subtitle wording: `"Total · one serving of each dish"` (verbatim — helps users understand the semantic)
- All TS must type-check with strict mode

## Verification

Before reporting done:

1. `npx tsc --noEmit` — zero new type errors
2. `grep -rn "aggregateMealNutrition(" --include="*.ts" --include="*.tsx" .` — should return 1 call site (the new MealNutritionPanel) + the definition itself. If you see more, list them and confirm each is compatible.
3. `grep -c "MealNutritionPanel" screens/MealEventDetailScreen.tsx` — should be 2 (import + usage)
4. `grep -c "MealNutritionPanel" screens/MealDetailScreen.tsx` — should be 2 (import + usage)
5. `grep "Directional, not for medical use" components/MealNutritionPanel.tsx` — exact match
6. `grep "_per_person_" lib/services/nutritionService.ts | wc -l` — should be ≥17 (the MealNutrition interface fields + return shape)

## Smoke test guidance for Tom (post-CC)

1. Open a meal event with 2-3 dishes that have recipes attached
2. Scroll past "What everyone brought" — verify Meal Nutrition card appears
3. Verify total calories looks roughly like the sum of cal_per_serving across the dishes
4. Tap "▶ Vitamins & minerals" — verify the same Vitamins/Minerals subsections appear as on RecipeDetailScreen
5. Open a legacy MealDetailScreen with dishes — verify the same panel appears below the Dishes section
6. Open a meal where some dishes have recipes and some don't — verify "Nutrition for X of Y dishes" partial-data note appears
7. Open an empty meal (no dishes) — verify the panel does NOT render
8. Open a meal where dishes exist but none have recipe_id (manual posts only) — verify the panel does NOT render

## SESSION_LOG entry

Append under today's 2026-05-27 day header, after the 10D entry:

```
### Phase 10E — Meal-level nutrition aggregation UI shipped

Added meal-level nutrition panel to both MealEventDetailScreen and MealDetailScreen. Single shared component MealNutritionPanel takes a list of recipe_ids, fetches via getRecipeNutritionBatch, aggregates via the extended aggregateMealNutrition.

Files touched:
- `lib/services/nutritionService.ts` — new MealNutrition type (17 nutrients + dietary flags + quality + dish counts). Refactored aggregateMealNutrition to return MealNutrition instead of CompactNutrition. Was previously unused so return-type change had no callers to break.
- NEW `components/MealNutritionPanel.tsx` — always-expanded panel with same Vitamins/Minerals sub-toggle pattern as RecipeNutritionPanel. Subtitle "Total · one serving of each dish" clarifies the aggregation semantic (sums per-serving across dishes, no per-person attendee assumption).
- `screens/MealEventDetailScreen.tsx` — added Block 6 nutrition panel after "What everyone brought"
- `screens/MealDetailScreen.tsx` — added nutrition section after Dishes section

Design notes:
- Always-expanded (no outer collapse) — meal nutrition is auxiliary info; user is past the "should I look" decision
- Partial-data state ("Nutrition for X of Y dishes") shown when some dishes lack recipe links
- Disclaimer copy matches RecipeNutritionPanel exactly for consistency

Pending: Tom smoke test on real meal events.
```

## Reporting back

When done, paste:
1. Result of `npx tsc --noEmit`
2. The grep counts from verification steps 2-6
3. Confirmation files exist
4. Any deviations / unexpected issues
5. The SESSION_LOG entry
