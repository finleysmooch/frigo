// ============================================
// FRIGO - PANTRY SERVICE
// ============================================
// Supabase functions for pantry management
// Location: lib/pantryService.ts

import { supabase } from './supabase';
import {
  PantryItem,
  PantryItemInsert,
  PantryItemUpdate,
  PantryItemWithIngredient,
  IngredientWithPantryData,
  StorageLocation
} from './types/pantry';
import {
  convertToMetric,
  calculateExpirationDate,
  getOpenedStorageLocation
} from '../utils/pantryConversions';

/**
 * Get all pantry items for a user with ingredient details
 * Returns items sorted by expiration date (expiring soonest first)
 */
export async function getPantryItems(
  userId: string
): Promise<PantryItemWithIngredient[]> {
  try {
    console.log('🔍 Fetching pantry items for user:', userId);

    const { data, error } = await supabase
      .from('pantry_items')
      .select(`
        *,
        ingredient:ingredients(
          name,
          plural_name,
          family,
          ingredient_type
        )
      `)
      .eq('user_id', userId)
      .order('expiration_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('❌ Error fetching pantry items:', error);
      throw error;
    }

    console.log('✅ Found', data?.length || 0, 'pantry items');
    return data || [];

  } catch (error) {
    console.error('❌ Error in getPantryItems:', error);
    throw error;
  }
}

/**
 * Get pantry items expiring within specified days
 * Default: 3 days
 */
export async function getExpiringItems(
  userId: string,
  daysThreshold: number = 3
): Promise<PantryItemWithIngredient[]> {
  try {
    console.log('🔍 Fetching items expiring within', daysThreshold, 'days');

    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + daysThreshold);

    const { data, error } = await supabase
      .from('pantry_items')
      .select(`
        *,
        ingredient:ingredients(
          name,
          plural_name,
          family,
          ingredient_type
        )
      `)
      .eq('user_id', userId)
      .not('expiration_date', 'is', null)
      .lte('expiration_date', thresholdDate.toISOString().split('T')[0])
      .order('expiration_date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching expiring items:', error);
      throw error;
    }

    console.log('✅ Found', data?.length || 0, 'expiring items');
    return data || [];

  } catch (error) {
    console.error('❌ Error in getExpiringItems:', error);
    throw error;
  }
}

/**
 * Get pantry items grouped by category (ingredient family)
 */
export async function getPantryItemsByCategory(
  userId: string
): Promise<Record<string, PantryItemWithIngredient[]>> {
  try {
    console.log('🔍 Fetching pantry items grouped by category');

    const items = await getPantryItems(userId);

    // Group by ingredient family
    const grouped: Record<string, PantryItemWithIngredient[]> = {};
    
    items.forEach(item => {
      const family = item.ingredient.family || 'Other';
      if (!grouped[family]) {
        grouped[family] = [];
      }
      grouped[family].push(item);
    });

    console.log('✅ Grouped into', Object.keys(grouped).length, 'categories');
    return grouped;

  } catch (error) {
    console.error('❌ Error in getPantryItemsByCategory:', error);
    throw error;
  }
}

/**
 * Get pantry items grouped by storage location
 */
export async function getPantryItemsByStorage(
  userId: string
): Promise<Record<StorageLocation, PantryItemWithIngredient[]>> {
  try {
    console.log('🔍 Fetching pantry items grouped by storage');

    const items = await getPantryItems(userId);

    // Group by storage location
    const grouped: Record<StorageLocation, PantryItemWithIngredient[]> = {
      fridge: [],
      freezer: [],
      pantry: [],
      counter: []
    };
    
    items.forEach(item => {
      grouped[item.storage_location].push(item);
    });

    console.log('✅ Grouped by storage locations');
    return grouped;

  } catch (error) {
    console.error('❌ Error in getPantryItemsByStorage:', error);
    throw error;
  }
}

/**
 * Get full ingredient data needed for pantry operations
 */
export async function getIngredientWithPantryData(
  ingredientId: string
): Promise<IngredientWithPantryData | null> {
  try {
    console.log('🔍 Fetching ingredient with pantry data:', ingredientId);

    const { data, error } = await supabase
      .from('ingredients')
      .select(`
        id,
        name,
        plural_name,
        family,
        ingredient_type,
        ingredient_subtype,
        typical_unit,
        typical_weight_small_g,
        typical_weight_medium_g,
        typical_weight_large_g,
        default_storage_location,
        shelf_life_days_fridge,
        shelf_life_days_freezer,
        shelf_life_days_pantry,
        shelf_life_days_counter,
        shelf_life_days_fridge_opened,
        shelf_life_days_pantry_opened,
        requires_metric_conversion
      `)
      .eq('id', ingredientId)
      .single();

    if (error) {
      console.error('❌ Error fetching ingredient:', error);
      throw error;
    }

    console.log('✅ Found ingredient:', data?.name);
    return data;

  } catch (error) {
    console.error('❌ Error in getIngredientWithPantryData:', error);
    throw error;
  }
}

/**
 * Add a new pantry item
 * Automatically calculates metric conversion and expiration date
 */
export async function addPantryItem(
  itemData: Omit<PantryItemInsert, 'user_id'>,
  userId: string
): Promise<PantryItem> {
  try {
    console.log('➕ Adding pantry item:', itemData);

    // Get ingredient data for conversions
    const ingredient = await getIngredientWithPantryData(itemData.ingredient_id);
    if (!ingredient) {
      throw new Error('Ingredient not found');
    }

    // Convert to metric if needed
    const { quantity_metric, unit_metric } = convertToMetric(
      itemData.quantity_display,
      itemData.unit_display,
      ingredient
    );

    // Calculate expiration if not provided
    let expiration_date = itemData.expiration_date;
    if (!expiration_date) {
      expiration_date = calculateExpirationDate(
        itemData.purchase_date,
        itemData.storage_location,
        ingredient,
        itemData.is_opened || false,
        itemData.opened_date || null
      );
    }

    // Build insert object
    const insertData: PantryItemInsert = {
      user_id: userId,
      ingredient_id: itemData.ingredient_id,
      quantity_display: itemData.quantity_display,
      unit_display: itemData.unit_display,
      quantity_metric,
      unit_metric,
      storage_location: itemData.storage_location,
      purchase_date: itemData.purchase_date,
      expiration_date,
      is_opened: itemData.is_opened || false,
      opened_date: itemData.opened_date || null,
      notes: itemData.notes || null
    };

    const { data, error } = await supabase
      .from('pantry_items')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding pantry item:', error);
      throw error;
    }

    console.log('✅ Added pantry item:', data.id);
    return data;

  } catch (error) {
    console.error('❌ Error in addPantryItem:', error);
    throw error;
  }
}

/**
 * Update an existing pantry item
 */
export async function updatePantryItem(
  itemId: string,
  updates: PantryItemUpdate,
  userId: string
): Promise<PantryItem> {
  try {
    console.log('✏️ Updating pantry item:', itemId);

    // If quantity or unit changed, recalculate metric conversion
    if (updates.quantity_display || updates.unit_display) {
      // Get current item to get ingredient_id
      const { data: currentItem } = await supabase
        .from('pantry_items')
        .select('ingredient_id, quantity_display, unit_display')
        .eq('id', itemId)
        .eq('user_id', userId)
        .single();

      if (currentItem) {
        const ingredient = await getIngredientWithPantryData(currentItem.ingredient_id);
        if (ingredient) {
          const { quantity_metric, unit_metric } = convertToMetric(
            updates.quantity_display || currentItem.quantity_display,
            updates.unit_display || currentItem.unit_display,
            ingredient
          );
          updates.quantity_metric = quantity_metric;
          updates.unit_metric = unit_metric;
        }
      }
    }

    const { data, error } = await supabase
      .from('pantry_items')
      .update(updates)
      .eq('id', itemId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating pantry item:', error);
      throw error;
    }

    console.log('✅ Updated pantry item:', itemId);
    return data;

  } catch (error) {
    console.error('❌ Error in updatePantryItem:', error);
    throw error;
  }
}

/**
 * Mark an item as opened
 * Recalculates expiration date and may suggest moving to fridge
 */
export async function markAsOpened(
  itemId: string,
  userId: string,
  openedDate?: string
): Promise<{ item: PantryItem; shouldMoveToFridge: boolean }> {
  try {
    console.log('📦 Marking item as opened:', itemId);

    // Get current item
    const { data: currentItem, error: fetchError } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentItem) {
      console.error('❌ Error fetching item:', fetchError);
      throw fetchError || new Error('Item not found');
    }

    // Get ingredient data
    const ingredient = await getIngredientWithPantryData(currentItem.ingredient_id);
    if (!ingredient) {
      throw new Error('Ingredient not found');
    }

    const opened = openedDate || new Date().toISOString().split('T')[0];

    // Recalculate expiration based on opened date
    const newExpiration = calculateExpirationDate(
      currentItem.purchase_date,
      currentItem.storage_location,
      ingredient,
      true,
      opened
    );

    // Check if should move to fridge
    const newLocation = getOpenedStorageLocation(ingredient, currentItem.storage_location);
    const shouldMoveToFridge = newLocation !== currentItem.storage_location;

    // Update item
    const updates: PantryItemUpdate = {
      is_opened: true,
      opened_date: opened,
      expiration_date: newExpiration
    };

    // Only update storage if it should move
    if (shouldMoveToFridge) {
      updates.storage_location = newLocation;
      console.log('📍 Item should move from', currentItem.storage_location, 'to', newLocation);
    }

    const { data, error } = await supabase
      .from('pantry_items')
      .update(updates)
      .eq('id', itemId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error marking as opened:', error);
      throw error;
    }

    console.log('✅ Marked as opened:', itemId);
    return {
      item: data,
      shouldMoveToFridge
    };

  } catch (error) {
    console.error('❌ Error in markAsOpened:', error);
    throw error;
  }
}

/**
 * Delete a pantry item
 */
export async function deletePantryItem(
  itemId: string,
  userId: string
): Promise<void> {
  try {
    console.log('🗑️ Deleting pantry item:', itemId);

    const { error } = await supabase
      .from('pantry_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error deleting pantry item:', error);
      throw error;
    }

    console.log('✅ Deleted pantry item:', itemId);

  } catch (error) {
    console.error('❌ Error in deletePantryItem:', error);
    throw error;
  }
}

/**
 * Mark item as used (reduce quantity or delete if 0)
 */
export async function markAsUsed(
  itemId: string,
  userId: string,
  quantityUsed?: number
): Promise<PantryItem | null> {
  try {
    console.log('✓ Marking item as used:', itemId);

    // Get current item
    const { data: currentItem, error: fetchError } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentItem) {
      console.error('❌ Error fetching item:', fetchError);
      throw fetchError || new Error('Item not found');
    }

    // If no quantity specified, delete the item
    if (!quantityUsed) {
      await deletePantryItem(itemId, userId);
      console.log('✅ Item fully used and removed');
      return null;
    }

    // Reduce quantity
    const newQuantity = currentItem.quantity_display - quantityUsed;

    if (newQuantity <= 0) {
      // Delete if quantity reaches 0
      await deletePantryItem(itemId, userId);
      console.log('✅ Item fully used and removed');
      return null;
    }

    // Update with new quantity
    const updated = await updatePantryItem(
      itemId,
      { quantity_display: newQuantity },
      userId
    );

    console.log('✅ Reduced quantity to:', newQuantity);
    return updated;

  } catch (error) {
    console.error('❌ Error in markAsUsed:', error);
    throw error;
  }
}

/**
 * Search ingredients for adding to pantry
 * Filters by category if provided
 */
export async function searchIngredientsForPantry(
  searchTerm: string,
  category?: string
): Promise<IngredientWithPantryData[]> {
  try {
    console.log('🔍 Searching ingredients:', searchTerm, category ? `in ${category}` : '');

    let query = supabase
      .from('ingredients')
      .select(`
        id,
        name,
        plural_name,
        family,
        ingredient_type,
        ingredient_subtype,
        typical_unit,
        typical_weight_small_g,
        typical_weight_medium_g,
        typical_weight_large_g,
        default_storage_location,
        shelf_life_days_fridge,
        shelf_life_days_freezer,
        shelf_life_days_pantry,
        shelf_life_days_counter,
        shelf_life_days_fridge_opened,
        shelf_life_days_pantry_opened,
        requires_metric_conversion
      `)
      .or(`name.ilike.%${searchTerm}%,plural_name.ilike.%${searchTerm}%`);

    if (category) {
      query = query.eq('family', category);
    }

    const { data, error } = await query.limit(20);

    if (error) {
      console.error('❌ Error searching ingredients:', error);
      throw error;
    }

    console.log('✅ Found', data?.length || 0, 'ingredients');
    return data || [];

  } catch (error) {
    console.error('❌ Error in searchIngredientsForPantry:', error);
    throw error;
  }
}

// ============================================
// UNIT MANAGEMENT FUNCTIONS
// ============================================

export interface UnitOption {
  unit_id: string;
  display_name: string;
  is_common: boolean;
  sort_order: number;
}

/**
 * Get common units for a specific ingredient
 * Returns units in order of preference (display_order)
 */
export async function getIngredientUnits(
  ingredientId: string
): Promise<UnitOption[]> {
  try {
    console.log('🔍 Fetching common units for ingredient:', ingredientId);

    const { data, error } = await supabase
      .from('ingredient_common_units')
      .select(`
        unit_id,
        display_order,
        measurement_units!inner(
          id,
          display_plural
        )
      `)
      .eq('ingredient_id', ingredientId)
      .order('display_order');

    if (error) {
      console.error('❌ Error fetching ingredient units:', error);
      throw error;
    }

    const units: UnitOption[] = (data || []).map((item: any) => ({
      unit_id: item.measurement_units.id,
      display_name: item.measurement_units.display_plural,
      is_common: true,
      sort_order: item.display_order
    }));

    console.log('✅ Found', units.length, 'common units');
    return units;

  } catch (error) {
    console.error('❌ Error in getIngredientUnits:', error);
    // Return empty array instead of throwing to allow graceful fallback
    return [];
  }
}

/**
 * Get all measurement units alphabetically
 * Used for "Other..." option in unit picker
 */
export async function getAllMeasurementUnits(): Promise<UnitOption[]> {
  try {
    console.log('🔍 Fetching all measurement units');

    const { data, error } = await supabase
      .from('measurement_units')
      .select('id, display_plural, sort_order')
      .order('display_plural');

    if (error) {
      console.error('❌ Error fetching all units:', error);
      throw error;
    }

    const units: UnitOption[] = (data || []).map((unit: any) => ({
      unit_id: unit.id,
      display_name: unit.display_plural,
      is_common: false,
      sort_order: unit.sort_order
    }));

    console.log('✅ Found', units.length, 'total units');
    return units;

  } catch (error) {
    console.error('❌ Error in getAllMeasurementUnits:', error);
    return [];
  }
}

/**
 * Get user's preferred unit for an ingredient
 * Returns null if no preference saved
 */
export async function getUserPreferredUnit(
  userId: string,
  ingredientId: string
): Promise<string | null> {
  try {
    console.log('🔍 Fetching user unit preference');

    // Note: This requires a user_unit_preferences table
    // For MVP, we'll just return null and implement later
    console.log('⚠️ User preferences not yet implemented');
    return null;

  } catch (error) {
    console.error('❌ Error in getUserPreferredUnit:', error);
    return null;
  }
}

/**
 * Save user's preferred unit for an ingredient
 * This helps the app learn user preferences over time
 */
export async function saveUserUnitPreference(
  userId: string,
  ingredientId: string,
  unitId: string
): Promise<void> {
  try {
    console.log('💾 Saving user unit preference');

    // Note: This requires a user_unit_preferences table
    // For MVP, we'll just log and implement later
    console.log('⚠️ User preferences not yet implemented');

  } catch (error) {
    console.error('❌ Error in saveUserUnitPreference:', error);
  }
}

// ============================================
// RECIPE MATCHING
// ============================================

/**
 * Calculate what percentage of a recipe's ingredients the user has in their pantry
 * Returns percentage of MATCHED ingredients only (ignores unmatched ones)
 */
export async function calculatePantryMatchPercentage(
  recipeId: string,
  userId: string
): Promise<number> {
  try {
    // Get recipe ingredients (only matched ones with ingredient_id)
    const { data: recipeIngredients, error: recipeError } = await supabase
      .from('recipe_ingredients')
      .select('ingredient_id')
      .eq('recipe_id', recipeId)
      .not('ingredient_id', 'is', null); // Only count matched ingredients
    
    if (recipeError) throw recipeError;
    
    if (!recipeIngredients || recipeIngredients.length === 0) {
      return 0; // No matched ingredients
    }

    // Get user's pantry ingredients
    const { data: pantryItems, error: pantryError } = await supabase
      .from('pantry_items')
      .select('ingredient_id')
      .eq('user_id', userId);
    
    if (pantryError) throw pantryError;
    
    if (!pantryItems || pantryItems.length === 0) {
      return 0; // User has nothing in pantry
    }

    // Create a set of ingredient IDs the user has
    const userIngredientIds = new Set(
      pantryItems.map(item => item.ingredient_id)
    );

    // Count how many recipe ingredients the user has
    const matchedCount = recipeIngredients.filter(ri => 
      userIngredientIds.has(ri.ingredient_id)
    ).length;

    // Calculate percentage
    const percentage = Math.round((matchedCount / recipeIngredients.length) * 100);
    
    return percentage;
  } catch (error) {
    console.error('Error calculating pantry match:', error);
    return 0;
  }
}

/**
 * Calculate pantry match for multiple recipes at once (more efficient)
 * Returns a map of recipeId => percentage
 */
export async function calculateBulkPantryMatch(
  recipeIds: string[],
  userId: string
): Promise<Map<string, number>> {
  try {
    const results = new Map<string, number>();

    // Get all recipe ingredients for all recipes at once
    const { data: allRecipeIngredients, error: recipeError } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id')
      .in('recipe_id', recipeIds)
      .not('ingredient_id', 'is', null);
    
    if (recipeError) throw recipeError;

    // Get user's pantry once
    const { data: pantryItems, error: pantryError } = await supabase
      .from('pantry_items')
      .select('ingredient_id')
      .eq('user_id', userId);
    
    if (pantryError) throw pantryError;
    
    const userIngredientIds = new Set(
      (pantryItems || []).map(item => item.ingredient_id)
    );

    // Group ingredients by recipe
    const recipeIngredientsMap = new Map<string, string[]>();
    
    (allRecipeIngredients || []).forEach(ri => {
      if (!recipeIngredientsMap.has(ri.recipe_id)) {
        recipeIngredientsMap.set(ri.recipe_id, []);
      }
      recipeIngredientsMap.get(ri.recipe_id)!.push(ri.ingredient_id);
    });

    // Calculate percentage for each recipe
    recipeIds.forEach(recipeId => {
      const ingredients = recipeIngredientsMap.get(recipeId) || [];
      
      if (ingredients.length === 0) {
        results.set(recipeId, 0);
        return;
      }

      const matchedCount = ingredients.filter(ingId => 
        userIngredientIds.has(ingId)
      ).length;

      const percentage = Math.round((matchedCount / ingredients.length) * 100);
      results.set(recipeId, percentage);
    });

    return results;
  } catch (error) {
    console.error('Error calculating bulk pantry match:', error);
    return new Map();
  }
}

/**
 * Get list of missing ingredients for a recipe
 */
export async function getMissingIngredients(
  recipeId: string,
  userId: string
): Promise<any[]> {
  try {
    // Get recipe ingredients with details
    const { data: recipeIngredients, error: recipeError } = await supabase
      .from('recipe_ingredients')
      .select(`
        ingredient_id,
        quantity_amount,
        quantity_unit,
        original_text,
        ingredients (
          id,
          name,
          family
        )
      `)
      .eq('recipe_id', recipeId)
      .not('ingredient_id', 'is', null);
    
    if (recipeError) throw recipeError;

    // Get user's pantry
    const { data: pantryItems, error: pantryError } = await supabase
      .from('pantry_items')
      .select('ingredient_id')
      .eq('user_id', userId);
    
    if (pantryError) throw pantryError;
    
    const userIngredientIds = new Set(
      (pantryItems || []).map(item => item.ingredient_id)
    );

    // Filter to missing ingredients
    const missing = (recipeIngredients || [])
      .filter(ri => !userIngredientIds.has(ri.ingredient_id))
      .map(ri => {
        // Fix: Handle ingredients as potentially being an array (Supabase type quirk)
        const ingredient = Array.isArray(ri.ingredients) 
          ? ri.ingredients[0] 
          : ri.ingredients;
        
        return {
          id: ri.ingredient_id,
          name: ingredient?.name || ri.original_text,
          family: ingredient?.family || 'Other',
          quantity: ri.quantity_amount,
          unit: ri.quantity_unit,
        };
      });

    return missing;
  } catch (error) {
    console.error('Error getting missing ingredients:', error);
    return [];
  }
}