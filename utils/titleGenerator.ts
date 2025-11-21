// lib/utils/titleGenerator.ts
// Generates smart, contextual titles for cooking posts
// Created: November 21, 2025

/**
 * Generate a smart title based on time of day and cooking method
 * @param timestamp - ISO timestamp of when the action occurred
 * @param cookingMethod - Optional cooking method (e.g., 'bake', 'bbq', 'grill')
 * @param recipeName - Optional recipe name for fallback
 * @returns A contextual title like "Morning Cook" or "Dinner BBQ"
 */
export function generateSmartTitle(
  timestamp?: string,
  cookingMethod?: string | null,
  recipeName?: string
): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  const hour = date.getHours();
  
  const timeOfDay = getTimeOfDay(hour);
  const activity = getActivityName(cookingMethod);
  
  // Pattern: "[Time] [Activity]" or "[Time] [Recipe]"
  if (activity) {
    return `${timeOfDay} ${activity}`;
  } else if (recipeName) {
    return `${timeOfDay} ${recipeName}`;
  } else {
    return `${timeOfDay} Cook`;
  }
}

/**
 * Get time of day descriptor based on hour
 */
function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Morning';
  if (hour >= 11 && hour < 14) return 'Lunch';
  if (hour >= 14 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Dinner';
  if (hour >= 21 || hour < 5) return 'Late Night';
  return 'Evening';
}

/**
 * Map cooking method to activity name
 */
function getActivityName(cookingMethod?: string | null): string | null {
  if (!cookingMethod) return null;
  
  const method = cookingMethod.toLowerCase();
  
  const methodMap: { [key: string]: string } = {
    'cook': 'Cook',
    'bake': 'Bake',
    'bbq': 'BBQ',
    'grill': 'Grill',
    'roast': 'Roast',
    'fry': 'Fry',
    'saute': 'Sauté',
    'steam': 'Steam',
    'boil': 'Boil',
    'simmer': 'Simmer',
    'braise': 'Braise',
    'smoke': 'Smoke',
    'broil': 'Broil',
    'poach': 'Poach',
    'air_fry': 'Air Fry',
    'slow_cook': 'Slow Cook',
    'pressure_cook': 'Pressure Cook',
    'sous_vide': 'Sous Vide',
  };
  
  return methodMap[method] || null;
}

/**
 * Generate a title with linked user mention
 * @param timestamp - ISO timestamp
 * @param cookingMethod - Cooking method
 * @param recipeName - Recipe name
 * @param linkedUserName - Name of the person you cooked with
 * @returns Title like "Morning Cook with Mary"
 */
export function generateSmartTitleWithUser(
  timestamp: string,
  cookingMethod?: string | null,
  recipeName?: string,
  linkedUserName?: string
): string {
  const baseTitle = generateSmartTitle(timestamp, cookingMethod, recipeName);
  
  if (linkedUserName) {
    return `${baseTitle} with ${linkedUserName}`;
  }
  
  return baseTitle;
}

/**
 * Get a descriptive meal type based on time
 * Useful for meal posts
 */
export function getMealTypeFromTime(timestamp?: string): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  const hour = date.getHours();
  
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 17) return 'snack';
  if (hour >= 17 && hour < 21) return 'dinner';
  return 'snack';
}

/**
 * Examples of generated titles:
 * 
 * Time: 8:00 AM, Method: bake -> "Morning Bake"
 * Time: 12:30 PM, Method: cook -> "Lunch Cook"
 * Time: 6:00 PM, Method: bbq -> "Dinner BBQ"
 * Time: 11:00 PM, Method: null -> "Late Night Cook"
 * Time: 3:00 PM, Method: null, Recipe: "Pasta Carbonara" -> "Afternoon Pasta Carbonara"
 */