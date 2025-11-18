// ============================================
// FRIGO - GROCERY LISTS SERVICE
// ============================================
// Service functions for managing multiple grocery lists
// Location: lib/groceryListsService.ts

import { supabase } from './supabase';

// ============================================
// TYPES
// ============================================

export interface GroceryList {
  id: string;
  user_id: string;
  name: string;
  store_name?: string;
  created_at: string;
  updated_at: string;
}

export interface GroceryListItem {
  id: string;
  list_id: string;
  ingredient_id: string;
  quantity_display: number;
  unit_display: string;
  is_in_cart: boolean;
  notes?: string;
  created_at: string;
  ingredient?: {
    id: string;
    name: string;
    family: string;
  };
}

export interface CreateGroceryListParams {
  user_id: string;
  name: string;
  store_name?: string;
}

export interface AddItemToListParams {
  list_id: string;
  ingredient_id: string;
  quantity_display: number;
  unit_display: string;
  notes?: string;
}

// ============================================
// LIST MANAGEMENT
// ============================================

/**
 * Get all grocery lists for a user
 */
export async function getUserGroceryLists(userId: string): Promise<GroceryList[]> {
  try {
    console.log('📋 Getting grocery lists for user:', userId);

    const { data, error } = await supabase
      .from('grocery_lists')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (error) {
      console.error('❌ Error getting grocery lists:', error);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} lists`);
    return data || [];
  } catch (error) {
    console.error('❌ Error in getUserGroceryLists:', error);
    throw error;
  }
}

/**
 * Create a new grocery list
 */
export async function createGroceryList(params: CreateGroceryListParams): Promise<GroceryList> {
  try {
    console.log('➕ Creating grocery list:', params.name);

    const { data, error } = await supabase
      .from('grocery_lists')
      .insert({
        user_id: params.user_id,
        name: params.name,
        store_name: params.store_name,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating grocery list:', error);
      throw error;
    }

    console.log('✅ Grocery list created');
    return data;
  } catch (error) {
    console.error('❌ Error in createGroceryList:', error);
    throw error;
  }
}

/**
 * Delete a grocery list (and all its items)
 */
export async function deleteGroceryList(listId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting grocery list:', listId);

    // First delete all items in the list
    await supabase
      .from('grocery_list_items')
      .delete()
      .eq('list_id', listId);

    // Then delete the list
    const { error } = await supabase
      .from('grocery_lists')
      .delete()
      .eq('id', listId);

    if (error) {
      console.error('❌ Error deleting grocery list:', error);
      throw error;
    }

    console.log('✅ Grocery list deleted');
  } catch (error) {
    console.error('❌ Error in deleteGroceryList:', error);
    throw error;
  }
}

// ============================================
// ITEM MANAGEMENT
// ============================================

/**
 * Get all items for a specific list
 */
export async function getItemsForList(listId: string): Promise<GroceryListItem[]> {
  try {
    console.log('📦 Getting items for list:', listId);

    const { data, error } = await supabase
      .from('grocery_list_items')
      .select(`
        *,
        ingredient:ingredients (
          id,
          name,
          family
        )
      `)
      .eq('list_id', listId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error getting list items:', error);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} items`);
    return data || [];
  } catch (error) {
    console.error('❌ Error in getItemsForList:', error);
    throw error;
  }
}

/**
 * Add item to a specific list
 */
export async function addItemToList(params: AddItemToListParams): Promise<GroceryListItem> {
  try {
    console.log('➕ Adding item to list:', params.list_id);

    // First get the user_id from the grocery_lists table
    const { data: listData, error: listError } = await supabase
      .from('grocery_lists')
      .select('user_id')
      .eq('id', params.list_id)
      .single();

    if (listError) {
      console.error('❌ Error getting list:', listError);
      throw listError;
    }

    // Check if this ingredient already exists in this list
    const { data: existingItem, error: checkError } = await supabase
      .from('grocery_list_items')
      .select(`
        *,
        ingredient:ingredients (
          id,
          name,
          family
        )
      `)
      .eq('list_id', params.list_id)
      .eq('ingredient_id', params.ingredient_id)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking for existing item:', checkError);
      throw checkError;
    }

    // If item exists, update quantity instead of creating duplicate
    if (existingItem) {
      console.log('📝 Item exists, merging quantities');
      
      const newQuantity = existingItem.quantity_display + params.quantity_display;
      
      // Combine notes if both exist
      let combinedNotes = existingItem.notes || '';
      if (params.notes) {
        combinedNotes = combinedNotes 
          ? `${combinedNotes}\n${params.notes}`
          : params.notes;
      }

      const { data: updatedItem, error: updateError } = await supabase
        .from('grocery_list_items')
        .update({
          quantity_display: newQuantity,
          notes: combinedNotes || null,
        })
        .eq('id', existingItem.id)
        .select(`
          *,
          ingredient:ingredients (
            id,
            name,
            family
          )
        `)
        .single();

      if (updateError) {
        console.error('❌ Error updating item:', updateError);
        throw updateError;
      }

      console.log(`✅ Merged quantities: ${existingItem.quantity_display} + ${params.quantity_display} = ${newQuantity}`);
      return updatedItem;
    }

    // Item doesn't exist, create new one
    const { data, error } = await supabase
      .from('grocery_list_items')
      .insert({
        list_id: params.list_id,
        user_id: listData.user_id,
        ingredient_id: params.ingredient_id,
        quantity_display: params.quantity_display,
        unit_display: params.unit_display,
        notes: params.notes,
        is_in_cart: false,
      })
      .select(`
        *,
        ingredient:ingredients (
          id,
          name,
          family
        )
      `)
      .single();

    if (error) {
      console.error('❌ Error adding item:', error);
      throw error;
    }

    console.log('✅ Item added to list');
    return data;
  } catch (error) {
    console.error('❌ Error in addItemToList:', error);
    throw error;
  }
}

/**
 * Toggle item checked/unchecked (in cart)
 */
export async function toggleItemInCart(itemId: string, isInCart: boolean): Promise<void> {
  try {
    console.log('✓ Toggling item in cart:', itemId, isInCart);

    const { error } = await supabase
      .from('grocery_list_items')
      .update({ is_in_cart: isInCart })
      .eq('id', itemId);

    if (error) {
      console.error('❌ Error toggling item:', error);
      throw error;
    }

    console.log('✅ Item toggled');
  } catch (error) {
    console.error('❌ Error in toggleItemInCart:', error);
    throw error;
  }
}

/**
 * Delete item from list
 */
export async function deleteItemFromList(itemId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting item:', itemId);

    const { error } = await supabase
      .from('grocery_list_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('❌ Error deleting item:', error);
      throw error;
    }

    console.log('✅ Item deleted');
  } catch (error) {
    console.error('❌ Error in deleteItemFromList:', error);
    throw error;
  }
}

/**
 * Update item in list (for quantity, notes, etc.)
 */
export async function updateListItem(
  itemId: string, 
  updates: {
    quantity_display?: number;
    unit_display?: string;
    notes?: string;
    is_in_cart?: boolean;
  }
): Promise<void> {
  try {
    console.log('📝 Updating list item:', itemId);

    const { error } = await supabase
      .from('grocery_list_items')
      .update(updates)
      .eq('id', itemId);

    if (error) {
      console.error('❌ Error updating item:', error);
      throw error;
    }

    console.log('✅ Item updated');
  } catch (error) {
    console.error('❌ Error in updateListItem:', error);
    throw error;
  }
}

/**
 * Delete item from list (alias for deleteItemFromList for compatibility)
 */
export async function deleteListItem(itemId: string): Promise<void> {
  return deleteItemFromList(itemId);
}

/**
 * Get item count for a list
 */
export async function getListItemCount(listId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('grocery_list_items')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId);

    if (error) {
      console.error('❌ Error getting item count:', error);
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Error in getListItemCount:', error);
    throw error;
  }
}

// ============================================
// RECIPE INTEGRATION
// ============================================

/**
 * Add ingredients from recipe to user's default grocery list
 * Creates "This Week" list if user has no lists
 */
export async function addIngredientsToDefaultList(
  userId: string,
  recipeId: string,
  ingredients: Array<{
    ingredient_id: string;
    quantity: number;
    unit: string;
  }>
): Promise<{ listId: string; addedCount: number }> {
  try {
    console.log(`➕ Adding ${ingredients.length} ingredients from recipe to default list`);

    // Get user's lists
    const lists = await getUserGroceryLists(userId);
    
    let targetList: GroceryList;
    
    if (lists.length === 0) {
      // Create "This Week" list if user has none
      console.log('Creating default "This Week" list for user');
      targetList = await createGroceryList({
        user_id: userId,
        name: 'This Week',
      });
    } else {
      // Use first list (could be "This Week" or whatever they created first)
      targetList = lists[0];
    }

    // Add all ingredients to the list
    let addedCount = 0;
    for (const ingredient of ingredients) {
      try {
        await addItemToList({
          list_id: targetList.id,
          ingredient_id: ingredient.ingredient_id,
          quantity_display: ingredient.quantity,
          unit_display: ingredient.unit,
        });
        addedCount++;
      } catch (error) {
        console.error(`Failed to add ingredient ${ingredient.ingredient_id}:`, error);
      }
    }

    console.log(`✅ Added ${addedCount} ingredients to list "${targetList.name}"`);
    return { listId: targetList.id, addedCount };
  } catch (error) {
    console.error('❌ Error in addIngredientsToDefaultList:', error);
    throw error;
  }
}