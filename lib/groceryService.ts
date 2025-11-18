// ============================================
// FRIGO GROCERY SERVICE - REGULAR ITEMS ONLY
// ============================================
// Location: lib/groceryService.ts
// Simplified version focusing on Regular Grocery Items management

import { supabase } from './supabase';
import {
  RegularGroceryItem,
  RegularGroceryItemWithIngredient,
  AddRegularItemParams,
  UpdateRegularItemParams,
} from './types/grocery';

// ============================================
// REGULAR GROCERY ITEMS (SHOPPING TEMPLATES)
// ============================================

/**
 * Get all regular grocery items for a user
 */
export async function getRegularGroceryItems(
  userId: string
): Promise<RegularGroceryItemWithIngredient[]> {
  try {
    console.log('📋 Fetching regular grocery items for user:', userId);

    const { data, error } = await supabase
      .from('regular_grocery_items')
      .select(`
        *,
        ingredient:ingredients(
          id,
          name,
          plural_name,
          family,
          ingredient_type
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`✅ Loaded ${data?.length || 0} regular items`);
    return (data || []) as RegularGroceryItemWithIngredient[];
  } catch (error) {
    console.error('❌ Error fetching regular items:', error);
    throw error;
  }
}

/**
 * Add a regular grocery item (shopping template)
 */
export async function addRegularItem(
  userId: string,
  params: AddRegularItemParams
): Promise<RegularGroceryItem> {
  try {
    console.log('➕ Adding regular grocery item:', params);

    const newItem = {
      user_id: userId,
      ingredient_id: params.ingredientId,
      quantity_display: params.quantity,
      unit_display: params.unit,
      purchase_frequency: params.frequency,
      frequency_days: params.frequencyDays || null,
      last_purchased: null,
      next_suggested_date: null,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('regular_grocery_items')
      .insert(newItem)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Regular grocery item added');
    return data as RegularGroceryItem;
  } catch (error) {
    console.error('❌ Error adding regular item:', error);
    throw error;
  }
}

/**
 * Update a regular grocery item
 */
export async function updateRegularItem(
  itemId: string,
  updates: UpdateRegularItemParams
): Promise<RegularGroceryItem> {
  try {
    console.log('✏️ Updating regular grocery item:', itemId);

    // Convert camelCase to snake_case for database
    const dbUpdates: any = {};
    
    if (updates.quantity !== undefined) {
      dbUpdates.quantity_display = updates.quantity;
    }
    if (updates.unit !== undefined) {
      dbUpdates.unit_display = updates.unit;
    }
    if (updates.frequency !== undefined) {
      dbUpdates.purchase_frequency = updates.frequency;
    }
    if (updates.frequencyDays !== undefined) {
      dbUpdates.frequency_days = updates.frequencyDays;
    }
    if (updates.isActive !== undefined) {
      dbUpdates.is_active = updates.isActive;
    }

    const { data, error } = await supabase
      .from('regular_grocery_items')
      .update(dbUpdates)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Regular grocery item updated');
    return data as RegularGroceryItem;
  } catch (error) {
    console.error('❌ Error updating regular item:', error);
    throw error;
  }
}

/**
 * Delete a regular grocery item
 */
export async function deleteRegularItem(itemId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting regular grocery item:', itemId);

    const { error } = await supabase
      .from('regular_grocery_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    console.log('✅ Regular grocery item deleted');
  } catch (error) {
    console.error('❌ Error deleting regular item:', error);
    throw error;
  }
}