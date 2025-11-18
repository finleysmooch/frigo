// Metric Conversion Utility for Pantry Items
// Location: utils/pantryConversions.ts

import { IngredientWithPantryData, StorageLocation } from '../lib/types/pantry';

export interface ConversionResult {
  quantity_metric: number | null;
  unit_metric: string | null;
}

/**
 * Converts display quantity to metric quantity
 * Uses ingredient's typical_weight_medium_g for unit items (onions, eggs, etc)
 * Returns null for items that don't require metric conversion (spices)
 */
export function convertToMetric(
  quantityDisplay: number,
  unitDisplay: string,
  ingredient: IngredientWithPantryData
): ConversionResult {
  // Skip conversion for items like spices
  if (!ingredient.requires_metric_conversion) {
    return {
      quantity_metric: null,
      unit_metric: null
    };
  }

  // Already in metric units - pass through
  if (unitDisplay === 'g' || unitDisplay === 'kg') {
    return {
      quantity_metric: unitDisplay === 'kg' ? quantityDisplay * 1000 : quantityDisplay,
      unit_metric: 'g'
    };
  }

  if (unitDisplay === 'ml' || unitDisplay === 'l') {
    return {
      quantity_metric: unitDisplay === 'l' ? quantityDisplay * 1000 : quantityDisplay,
      unit_metric: 'ml'
    };
  }

  // Unit items (onions, eggs, bunches, etc) - use typical_weight_medium_g
  if (ingredient.typical_weight_medium_g) {
    return {
      quantity_metric: quantityDisplay * ingredient.typical_weight_medium_g,
      unit_metric: 'g'
    };
  }

  // No conversion available
  console.warn(`No metric conversion available for ${ingredient.name} in ${unitDisplay}`);
  return {
    quantity_metric: null,
    unit_metric: null
  };
}

/**
 * Calculates expiration date based on purchase date, storage location, and opened status
 * Returns null if no shelf life data available
 */
export function calculateExpirationDate(
  purchaseDate: string,
  storageLocation: StorageLocation,
  ingredient: IngredientWithPantryData,
  isOpened: boolean = false,
  openedDate: string | null = null
): string | null {
  // If opened, use opened shelf life from opened_date
  if (isOpened && openedDate) {
    const shelfLifeDays = 
      storageLocation === 'fridge' ? ingredient.shelf_life_days_fridge_opened :
      storageLocation === 'pantry' ? ingredient.shelf_life_days_pantry_opened :
      // Freezer and counter don't have opened variants, use regular
      storageLocation === 'freezer' ? ingredient.shelf_life_days_freezer :
      ingredient.shelf_life_days_counter;

    if (!shelfLifeDays) {
      // Fall back to regular shelf life if no opened variant
      const regularShelfLife = 
        storageLocation === 'fridge' ? ingredient.shelf_life_days_fridge :
        storageLocation === 'freezer' ? ingredient.shelf_life_days_freezer :
        storageLocation === 'pantry' ? ingredient.shelf_life_days_pantry :
        ingredient.shelf_life_days_counter;
      
      if (!regularShelfLife) {
        return null;
      }

      const opened = new Date(openedDate);
      const expiration = new Date(opened);
      expiration.setDate(expiration.getDate() + regularShelfLife);
      
      return expiration.toISOString().split('T')[0];
    }

    const opened = new Date(openedDate);
    const expiration = new Date(opened);
    expiration.setDate(expiration.getDate() + shelfLifeDays);
    
    return expiration.toISOString().split('T')[0];
  }

  // Otherwise use regular shelf life from purchase date
  const shelfLifeDays = 
    storageLocation === 'fridge' ? ingredient.shelf_life_days_fridge :
    storageLocation === 'freezer' ? ingredient.shelf_life_days_freezer :
    storageLocation === 'pantry' ? ingredient.shelf_life_days_pantry :
    ingredient.shelf_life_days_counter;

  if (!shelfLifeDays) {
    return null;
  }

  const purchase = new Date(purchaseDate);
  const expiration = new Date(purchase);
  expiration.setDate(expiration.getDate() + shelfLifeDays);
  
  return expiration.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

/**
 * Formats display quantity for UI
 * Examples: "3 onions", "2 jars", "500g", "1.5 kg"
 */
export function formatPantryQuantity(
  quantityDisplay: number,
  unitDisplay: string,
  ingredientName: string,
  ingredientPluralName: string | null
): string {
  // For unit items, use singular/plural
  if (unitDisplay === ingredientName || unitDisplay === ingredientPluralName) {
    const name = quantityDisplay === 1 ? ingredientName : (ingredientPluralName || ingredientName);
    return `${quantityDisplay} ${name}`;
  }

  // For metric or other units, just show quantity + unit
  return `${quantityDisplay}${unitDisplay}`;
}

/**
 * Gets days until expiration
 * Returns negative number if expired
 */
export function getDaysUntilExpiration(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiration = new Date(expirationDate);
  expiration.setHours(0, 0, 0, 0);
  
  const diffTime = expiration.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Checks if item is expiring soon (within 3 days) or expired
 */
export function getExpirationStatus(expirationDate: string | null): 'expired' | 'expiring-soon' | 'fresh' | 'unknown' {
  if (!expirationDate) return 'unknown';
  
  const daysUntil = getDaysUntilExpiration(expirationDate);
  if (daysUntil === null) return 'unknown';
  
  if (daysUntil < 0) return 'expired';
  if (daysUntil <= 3) return 'expiring-soon';
  return 'fresh';
}

/**
 * Determines if item should move to fridge when opened
 * (e.g., mustard, ketchup move from pantry to fridge when opened)
 */
export function shouldMoveToFridgeWhenOpened(
  ingredient: IngredientWithPantryData,
  currentLocation: StorageLocation
): boolean {
  return (
    currentLocation === 'pantry' && 
    ingredient.shelf_life_days_fridge_opened !== null &&
    ingredient.shelf_life_days_fridge_opened > 0
  );
}

/**
 * Get suggested storage location for opened item
 */
export function getOpenedStorageLocation(
  ingredient: IngredientWithPantryData,
  currentLocation: StorageLocation
): StorageLocation {
  if (shouldMoveToFridgeWhenOpened(ingredient, currentLocation)) {
    return 'fridge';
  }
  return currentLocation;
}

/**
 * Format expiration display text
 * Examples: "Tomorrow", "2 days", "14 days", "Expired"
 */
export function formatExpirationDisplay(expirationDate: string | null): string {
  if (!expirationDate) return 'No expiration set';
  
  const daysUntil = getDaysUntilExpiration(expirationDate);
  
  if (daysUntil === null) return 'Unknown';
  if (daysUntil < 0) return 'Expired';
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  
  return `${daysUntil} days`;
}