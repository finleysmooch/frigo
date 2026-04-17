// lib/utils/mealTypeHelpers.ts
// Shared meal-type inference helpers. Extracted from postService.ts (P7-29) to break
// the circular dependency between postService and mealService.

/**
 * Compute meal_type from a specific Date object's hour.
 * Used by both computeMealType (for current time fallback) and
 * detectPlannedMealForCook (for slot matching).
 * 4-band scheme per Checkpoint 2b fix — no snack or brunch slots.
 */
export function computeMealTypeFromHour(date: Date): string {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour < 10.5) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 22) return 'dinner';
  return 'late_night';
}

/**
 * Compute the meal_type for a dish post.
 * Precedence: (1) parent meal's meal_type, (2) recipe's meal_type, (3) time-of-day, (4) 'dinner'.
 */
export function computeMealType(params?: {
  recipe?: { meal_type?: string | null };
  parentMeal?: { meal_type?: string | null };
}): string {
  if (params?.parentMeal?.meal_type) return params.parentMeal.meal_type;
  if (params?.recipe?.meal_type) return params.recipe.meal_type;
  return computeMealTypeFromHour(new Date());
}
