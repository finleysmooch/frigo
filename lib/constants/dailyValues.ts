/**
 * FDA Reference Daily Intake (RDI) values, revised 2016 (current Nutrition Facts label).
 * Source: 21 CFR § 101.9(c)(8)(iv)
 *
 * Used by RecipeNutritionPanel to compute Daily Value (DV) percentages.
 *
 * Units must match the per-100g column units on the `ingredients` table
 * and the totals on the recipe_nutrition_computed materialized view.
 */

export const DAILY_VALUES = {
  vitamin_a_mcg: 900,    // mcg RAE (Retinol Activity Equivalents)
  vitamin_c_mg: 90,
  vitamin_d_mcg: 20,     // 800 IU
  vitamin_b12_mcg: 2.4,
  folate_mcg: 400,       // mcg DFE (Dietary Folate Equivalents)
  iron_mg: 18,
  calcium_mg: 1300,
  potassium_mg: 4700,
  magnesium_mg: 420,
  zinc_mg: 11,
} as const;

export type MicronutrientKey = keyof typeof DAILY_VALUES;

/**
 * Compute Daily Value percentage for a given micronutrient.
 * Returns an integer percent (e.g., 23 for 23%). Not capped at 100 — values
 * above 100 are meaningful ("high in vitamin C"). Returns 0 if value is
 * null/undefined/0.
 */
export function getDvPercent(
  value: number | null | undefined,
  key: MicronutrientKey
): number {
  if (!value) return 0;
  return Math.round((value / DAILY_VALUES[key]) * 100);
}
