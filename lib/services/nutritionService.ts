// lib/services/nutritionService.ts
// Queries recipe_nutrition_computed (materialized view) and
// recipe_ingredient_nutrition (view) for UI display.

import { supabase } from '../supabase';

// ── Types ────────────────────────────────────────────────────────

export type NutritionQualityLabel =
  | 'high_confidence'
  | 'good_estimate'
  | 'rough_estimate'
  | 'incomplete';

export interface RecipeNutrition {
  recipe_id: string;
  title: string;
  servings: number;

  // Per-serving macros
  cal_per_serving: number;
  protein_per_serving_g: number;
  fat_per_serving_g: number;
  carbs_per_serving_g: number;

  // Totals
  total_calories: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carbs_g: number;
  total_fiber_g: number;
  total_sugar_g: number;
  total_sodium_mg: number;

  // Per-serving derived (computed client-side from totals + servings)
  fiber_per_serving_g: number;
  sugar_per_serving_g: number;
  sodium_per_serving_mg: number;

  // Dietary flags
  is_vegan: boolean;
  is_vegetarian: boolean;
  is_gluten_free: boolean;
  is_dairy_free: boolean;
  is_nut_free: boolean;
  is_shellfish_free: boolean;
  is_soy_free: boolean;
  is_egg_free: boolean;

  // Quality metadata
  quality_label: NutritionQualityLabel;
  avg_confidence: number;
  min_confidence: number;
  nutrition_coverage_pct: number;
  total_ingredients: number;
  matched_ingredients: number;
  ingredients_with_nutrition: number;
  ingredients_with_grams: number;
}

export interface IngredientNutrition {
  recipe_ingredient_id: string;
  original_text: string;
  ingredient_name: string | null;
  quantity_amount: number | null;
  quantity_unit: string | null;
  sequence_order: number;
  ingredient_role: string | null;
  nutrition_multiplier: number | null;
  estimated_grams: number | null;
  gram_confidence: number | null;
  conversion_method: string | null;
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
}

// ── Queries ──────────────────────────────────────────────────────

/**
 * Get recipe-level nutrition from the materialized view.
 * Returns null if recipe has no nutrition data.
 */
export async function getRecipeNutrition(
  recipeId: string
): Promise<RecipeNutrition | null> {
  const { data, error } = await supabase
    .from('recipe_nutrition_computed')
    .select('*')
    .eq('recipe_id', recipeId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching recipe nutrition:', error);
    return null;
  }

  if (!data) return null;

  const servings = data.servings || 1;

  return {
    recipe_id: data.recipe_id,
    title: data.title,
    servings,

    cal_per_serving: data.cal_per_serving ?? 0,
    protein_per_serving_g: data.protein_per_serving_g ?? 0,
    fat_per_serving_g: data.fat_per_serving_g ?? 0,
    carbs_per_serving_g: data.carbs_per_serving_g ?? 0,

    total_calories: data.total_calories ?? 0,
    total_protein_g: data.total_protein_g ?? 0,
    total_fat_g: data.total_fat_g ?? 0,
    total_carbs_g: data.total_carbs_g ?? 0,
    total_fiber_g: data.total_fiber_g ?? 0,
    total_sugar_g: data.total_sugar_g ?? 0,
    total_sodium_mg: data.total_sodium_mg ?? 0,

    // Compute per-serving for fiber/sugar/sodium (not in materialized view)
    fiber_per_serving_g: Math.round(((data.total_fiber_g ?? 0) / servings) * 10) / 10,
    sugar_per_serving_g: Math.round(((data.total_sugar_g ?? 0) / servings) * 10) / 10,
    sodium_per_serving_mg: Math.round((data.total_sodium_mg ?? 0) / servings),

    is_vegan: data.is_vegan ?? false,
    is_vegetarian: data.is_vegetarian ?? false,
    is_gluten_free: data.is_gluten_free ?? false,
    is_dairy_free: data.is_dairy_free ?? false,
    is_nut_free: data.is_nut_free ?? false,
    is_shellfish_free: data.is_shellfish_free ?? false,
    is_soy_free: data.is_soy_free ?? false,
    is_egg_free: data.is_egg_free ?? false,

    quality_label: data.quality_label as NutritionQualityLabel,
    avg_confidence: data.avg_confidence ?? 0,
    min_confidence: data.min_confidence ?? 0,
    nutrition_coverage_pct: data.nutrition_coverage_pct ?? 0,
    total_ingredients: data.total_ingredients ?? 0,
    matched_ingredients: data.matched_ingredients ?? 0,
    ingredients_with_nutrition: data.ingredients_with_nutrition ?? 0,
    ingredients_with_grams: data.ingredients_with_grams ?? 0,
  };
}

/**
 * Get per-ingredient nutrition breakdown for a recipe.
 * Sorted by calories descending (highest contributors first).
 */
export async function getIngredientNutrition(
  recipeId: string
): Promise<IngredientNutrition[]> {
  const { data, error } = await supabase
    .from('recipe_ingredient_nutrition')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('calories', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching ingredient nutrition:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    recipe_ingredient_id: row.recipe_ingredient_id,
    original_text: row.original_text,
    ingredient_name: row.ingredient_name,
    quantity_amount: row.quantity_amount,
    quantity_unit: row.quantity_unit,
    sequence_order: row.sequence_order,
    ingredient_role: row.ingredient_role,
    nutrition_multiplier: row.nutrition_multiplier,
    estimated_grams: row.estimated_grams,
    gram_confidence: row.gram_confidence,
    conversion_method: row.conversion_method,
    calories: row.calories,
    protein_g: row.protein_g,
    fat_g: row.fat_g,
    carbs_g: row.carbs_g,
  }));
}

// ── Helpers ──────────────────────────────────────────────────────

/** Human-readable quality label */
export function getQualityDisplayText(label: NutritionQualityLabel): string {
  switch (label) {
    case 'high_confidence': return 'High confidence';
    case 'good_estimate': return 'Good estimate';
    case 'rough_estimate': return 'Rough estimate';
    case 'incomplete': return 'Incomplete data';
  }
}

/** Quality label explanation for tooltip/info */
export function getQualityExplanation(label: NutritionQualityLabel): string {
  switch (label) {
    case 'high_confidence':
      return 'Most ingredients have verified weights and USDA nutrition data. Values are reliable.';
    case 'good_estimate':
      return 'Nutrition is estimated from standard portion sizes. Actual values may vary by 10–20%.';
    case 'rough_estimate':
      return 'Some ingredients used approximate conversions. Treat as a rough guide.';
    case 'incomplete':
      return 'Several ingredients are missing nutrition data. Totals are underestimated.';
  }
}

/** Color for quality indicator */
export function getQualityColor(label: NutritionQualityLabel): string {
  switch (label) {
    case 'high_confidence': return '#34C759';
    case 'good_estimate': return '#007AFF';
    case 'rough_estimate': return '#FF9500';
    case 'incomplete': return '#FF3B30';
  }
}

/** Dietary flags as a flat list of active labels */
export interface DietaryFlag {
  key: string;
  label: string;
  shortLabel: string;
}

export function getActiveDietaryFlags(nutrition: RecipeNutrition): DietaryFlag[] {
  const flags: DietaryFlag[] = [];

  // Vegan supersedes vegetarian — don't show both
  if (nutrition.is_vegan) flags.push({ key: 'vegan', label: 'Vegan', shortLabel: 'VG' });
  else if (nutrition.is_vegetarian) flags.push({ key: 'vegetarian', label: 'Vegetarian', shortLabel: 'V' });

  if (nutrition.is_gluten_free) flags.push({ key: 'gluten_free', label: 'Gluten-Free', shortLabel: 'GF' });
  if (nutrition.is_dairy_free) flags.push({ key: 'dairy_free', label: 'Dairy-Free', shortLabel: 'DF' });
  if (nutrition.is_nut_free) flags.push({ key: 'nut_free', label: 'Nut-Free', shortLabel: 'NF' });
  if (nutrition.is_egg_free) flags.push({ key: 'egg_free', label: 'Egg-Free', shortLabel: 'EF' });
  // Shellfish-free and soy-free omitted — true for vast majority, adds noise not signal

  return flags;
}

// ── Batch & Meal Helpers (Phase 2) ───────────────────────────────

/** Compact nutrition for feed cards — just what PostCard/MealPostCard need */
export interface CompactNutrition {
  cal_per_serving: number;
  protein_per_serving_g: number;
  carbs_per_serving_g: number;
  fat_per_serving_g: number;
  dietaryFlags: DietaryFlag[];
  quality_label: NutritionQualityLabel;
}

/**
 * Get nutrition for a single recipe, formatted for feed card display.
 * Returns null if no data.
 */
export async function getCompactNutrition(
  recipeId: string
): Promise<CompactNutrition | null> {
  const data = await getRecipeNutrition(recipeId);
  if (!data) return null;

  return {
    cal_per_serving: data.cal_per_serving,
    protein_per_serving_g: data.protein_per_serving_g,
    carbs_per_serving_g: data.carbs_per_serving_g,
    fat_per_serving_g: data.fat_per_serving_g,
    dietaryFlags: getActiveDietaryFlags(data),
    quality_label: data.quality_label,
  };
}

/**
 * Batch-fetch nutrition for multiple recipe IDs (for meals).
 * Returns a map of recipeId → RecipeNutrition.
 */
export async function getRecipeNutritionBatch(
  recipeIds: string[]
): Promise<Map<string, RecipeNutrition>> {
  const uniqueIds = [...new Set(recipeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('recipe_nutrition_computed')
    .select('*')
    .in('recipe_id', uniqueIds);

  if (error) {
    console.error('Error batch fetching recipe nutrition:', error);
    return new Map();
  }

  const map = new Map<string, RecipeNutrition>();
  for (const row of data || []) {
    const servings = row.servings || 1;
    map.set(row.recipe_id, {
      recipe_id: row.recipe_id,
      title: row.title,
      servings,
      cal_per_serving: row.cal_per_serving ?? 0,
      protein_per_serving_g: row.protein_per_serving_g ?? 0,
      fat_per_serving_g: row.fat_per_serving_g ?? 0,
      carbs_per_serving_g: row.carbs_per_serving_g ?? 0,
      total_calories: row.total_calories ?? 0,
      total_protein_g: row.total_protein_g ?? 0,
      total_fat_g: row.total_fat_g ?? 0,
      total_carbs_g: row.total_carbs_g ?? 0,
      total_fiber_g: row.total_fiber_g ?? 0,
      total_sugar_g: row.total_sugar_g ?? 0,
      total_sodium_mg: row.total_sodium_mg ?? 0,
      fiber_per_serving_g: Math.round(((row.total_fiber_g ?? 0) / servings) * 10) / 10,
      sugar_per_serving_g: Math.round(((row.total_sugar_g ?? 0) / servings) * 10) / 10,
      sodium_per_serving_mg: Math.round((row.total_sodium_mg ?? 0) / servings),
      is_vegan: row.is_vegan ?? false,
      is_vegetarian: row.is_vegetarian ?? false,
      is_gluten_free: row.is_gluten_free ?? false,
      is_dairy_free: row.is_dairy_free ?? false,
      is_nut_free: row.is_nut_free ?? false,
      is_shellfish_free: row.is_shellfish_free ?? false,
      is_soy_free: row.is_soy_free ?? false,
      is_egg_free: row.is_egg_free ?? false,
      quality_label: row.quality_label as NutritionQualityLabel,
      avg_confidence: row.avg_confidence ?? 0,
      min_confidence: row.min_confidence ?? 0,
      nutrition_coverage_pct: row.nutrition_coverage_pct ?? 0,
      total_ingredients: row.total_ingredients ?? 0,
      matched_ingredients: row.matched_ingredients ?? 0,
      ingredients_with_nutrition: row.ingredients_with_nutrition ?? 0,
      ingredients_with_grams: row.ingredients_with_grams ?? 0,
    });
  }
  return map;
}

/**
 * Aggregate nutrition across multiple recipes (for meal cards).
 * Calories/macros are summed (per-serving from each dish = one portion of meal).
 * Dietary flags are AND-ed (meal is vegan only if ALL dishes are vegan).
 * Returns null if no recipes have nutrition data.
 */
export function aggregateMealNutrition(
  nutritions: RecipeNutrition[]
): CompactNutrition | null {
  if (nutritions.length === 0) return null;

  const totalCal = nutritions.reduce((sum, n) => sum + n.cal_per_serving, 0);
  const totalProtein = nutritions.reduce((sum, n) => sum + n.protein_per_serving_g, 0);
  const totalCarbs = nutritions.reduce((sum, n) => sum + n.carbs_per_serving_g, 0);
  const totalFat = nutritions.reduce((sum, n) => sum + n.fat_per_serving_g, 0);

  // AND across all dishes — meal is only vegan if every dish is vegan
  const aggregated: RecipeNutrition = {
    ...nutritions[0],
    cal_per_serving: totalCal,
    protein_per_serving_g: totalProtein,
    carbs_per_serving_g: totalCarbs,
    fat_per_serving_g: totalFat,
    is_vegan: nutritions.every(n => n.is_vegan),
    is_vegetarian: nutritions.every(n => n.is_vegetarian),
    is_gluten_free: nutritions.every(n => n.is_gluten_free),
    is_dairy_free: nutritions.every(n => n.is_dairy_free),
    is_nut_free: nutritions.every(n => n.is_nut_free),
    is_shellfish_free: nutritions.every(n => n.is_shellfish_free),
    is_soy_free: nutritions.every(n => n.is_soy_free),
    is_egg_free: nutritions.every(n => n.is_egg_free),
    // Worst quality label across dishes
    quality_label: getWorstQualityLabel(nutritions.map(n => n.quality_label)),
  };

  return {
    cal_per_serving: totalCal,
    protein_per_serving_g: totalProtein,
    carbs_per_serving_g: totalCarbs,
    fat_per_serving_g: totalFat,
    dietaryFlags: getActiveDietaryFlags(aggregated),
    quality_label: aggregated.quality_label,
  };
}

/** Return the worst (least confident) quality label from a list */
function getWorstQualityLabel(labels: NutritionQualityLabel[]): NutritionQualityLabel {
  const order: NutritionQualityLabel[] = ['incomplete', 'rough_estimate', 'good_estimate', 'high_confidence'];
  let worstIndex = 3; // start at best
  for (const label of labels) {
    const idx = order.indexOf(label);
    if (idx < worstIndex) worstIndex = idx;
  }
  return order[worstIndex];
}