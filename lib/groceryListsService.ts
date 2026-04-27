// ============================================
// FRIGO - GROCERY LISTS SERVICE
// ============================================
// Service functions for managing multiple grocery lists
// Location: lib/groceryListsService.ts

import { supabase } from './supabase';
import {
  GroceryList,
  GroceryListItemWithIngredient,
  GroceryListWithCounts,
  CrossListIngredientPresence,
} from './types/grocery';

// ============================================
// TYPES
// ============================================

export interface CreateGroceryListParams {
  user_id: string;
  name: string;
  storeName?: string;   // Phase 8C-CP1a — was snake_case `store_name`; renamed to align with canonical params shape (DB column stays snake_case)
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
    return (data as unknown as GroceryList[]) || [];
  } catch (error) {
    console.error('❌ Error in getUserGroceryLists:', error);
    throw error;
  }
}

/**
 * Get all grocery lists for a user with item counts broken down by tier.
 * Phase 8C-CP1: single grouped item-query, derived client-side, to avoid N+1.
 */
export async function getUserGroceryListsWithCounts(
  userId: string
): Promise<GroceryListWithCounts[]> {
  try {
    const lists = await getUserGroceryLists(userId);

    if (lists.length === 0) {
      return [];
    }

    const listIds = lists.map((l) => l.id);

    const { data: itemRows, error } = await supabase
      .from('grocery_list_items')
      .select('list_id, priority, is_in_cart')
      .in('list_id', listIds);

    if (error) {
      console.error('❌ Error getting items for tier counts:', error);
      throw error;
    }

    type Counts = {
      total_items: number;
      checked_items: number;
      unchecked_items: number;
      now_count: number;
      could_wait_count: number;
      in_cart_count: number;
    };

    const emptyCounts = (): Counts => ({
      total_items: 0,
      checked_items: 0,
      unchecked_items: 0,
      now_count: 0,
      could_wait_count: 0,
      in_cart_count: 0,
    });

    const countsByList = new Map<string, Counts>();
    for (const id of listIds) {
      countsByList.set(id, emptyCounts());
    }

    for (const row of (itemRows as Array<{
      list_id: string;
      priority: 'needed' | 'nice_to_have' | null;
      is_in_cart: boolean;
    }> | null) || []) {
      const c = countsByList.get(row.list_id);
      if (!c) continue;
      c.total_items += 1;
      if (row.is_in_cart) {
        c.checked_items += 1;
        c.in_cart_count += 1;
      } else {
        c.unchecked_items += 1;
        if (row.priority === 'nice_to_have') {
          c.could_wait_count += 1;
        } else {
          c.now_count += 1;
        }
      }
    }

    return lists.map((list) => ({
      ...list,
      ...(countsByList.get(list.id) ?? emptyCounts()),
    }));
  } catch (error) {
    console.error('❌ Error in getUserGroceryListsWithCounts:', error);
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
        store_name: params.storeName,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating grocery list:', error);
      throw error;
    }

    console.log('✅ Grocery list created');
    return data as unknown as GroceryList;
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
export async function getItemsForList(listId: string): Promise<GroceryListItemWithIngredient[]> {
  try {
    console.log('📦 Getting items for list:', listId);

    const { data, error } = await supabase
      .from('grocery_list_items')
      .select(`
        *,
        ingredient:ingredients (
          id,
          name,
          plural_name,
          family,
          ingredient_type,
          typical_unit,
          typical_store_section
        )
      `)
      .eq('list_id', listId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error getting list items:', error);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} items`);
    return (data as unknown as GroceryListItemWithIngredient[]) || [];
  } catch (error) {
    console.error('❌ Error in getItemsForList:', error);
    throw error;
  }
}

/**
 * Add item to a specific list
 */
export async function addItemToList(params: AddItemToListParams): Promise<GroceryListItemWithIngredient> {
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
      return updatedItem as unknown as GroceryListItemWithIngredient;
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
    return data as unknown as GroceryListItemWithIngredient;
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
    priority?: 'needed' | 'nice_to_have';
    priority_reason?: string | null;
    brand_preference?: string | null;
    size_preference?: string | null;
    custom_name?: string | null;
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
 * Phase 8C-CP2 — find other active lists owned by the same user that contain
 * the given ingredient as a not-yet-in-cart entry. Used by the checkoff-moment
 * cross-list prompt: when an item is checked, surface which other lists still
 * have it pending so the user can decide whether to keep or remove.
 */
export async function getOtherListsContainingIngredient(
  ingredientId: string,
  currentListId: string,
  userId: string
): Promise<CrossListIngredientPresence[]> {
  try {
    const { data, error } = await supabase
      .from('grocery_list_items')
      .select(`
        list_id,
        is_in_cart,
        list:grocery_lists!inner (
          id,
          name,
          user_id,
          is_active
        )
      `)
      .eq('ingredient_id', ingredientId)
      .eq('is_in_cart', false)
      .neq('list_id', currentListId);

    if (error) {
      console.error('❌ Error querying cross-list overlap:', error);
      throw error;
    }

    type Row = {
      list_id: string;
      is_in_cart: boolean;
      list: {
        id: string;
        name: string;
        user_id: string;
        is_active: boolean;
      } | null;
    };

    const rows = (data as unknown as Row[]) || [];

    // Filter to active lists owned by this user (the !inner join is mandatory
    // but the eq filters on the joined table aren't directly expressible in
    // PostgREST, so apply them client-side).
    const filtered = rows.filter(
      (r) => r.list && r.list.user_id === userId && r.list.is_active
    );

    // Deduplicate by list_id — an ingredient can appear on the same list
    // multiple times (e.g., via different recipe annotations).
    const seen = new Set<string>();
    const result: CrossListIngredientPresence[] = [];
    for (const r of filtered) {
      if (!r.list || seen.has(r.list_id)) continue;
      seen.add(r.list_id);
      result.push({ list_id: r.list_id, list_name: r.list.name });
    }

    if (result.length === 0) {
      console.log('🔍 No cross-list overlap');
    } else {
      console.log(`🔍 Cross-list overlap: ${result.length} other list(s)`);
    }

    return result;
  } catch (error) {
    console.error('❌ Error in getOtherListsContainingIngredient:', error);
    throw error;
  }
}

/**
 * Phase 8C-CP2 — bulk-delete pending entries of a given ingredient from a set
 * of other lists. Defensive filters: only deletes rows still pending
 * (`is_in_cart = false`) and only on lists owned by the requesting user.
 * Returns the count of deleted rows.
 */
export async function deleteItemsByIngredientFromLists(
  ingredientId: string,
  listIds: string[],
  userId: string
): Promise<number> {
  if (listIds.length === 0) return 0;

  try {
    // First fetch the matching item ids so we can return a count and confirm
    // user ownership via the list join (defensive — RLS should already enforce).
    const { data: rows, error: fetchError } = await supabase
      .from('grocery_list_items')
      .select(`
        id,
        list:grocery_lists!inner (
          id,
          user_id
        )
      `)
      .eq('ingredient_id', ingredientId)
      .eq('is_in_cart', false)
      .in('list_id', listIds);

    if (fetchError) {
      console.error('❌ Error fetching items for cross-list delete:', fetchError);
      throw fetchError;
    }

    type Row = { id: string; list: { id: string; user_id: string } | null };
    const owned = ((rows as unknown as Row[]) || []).filter(
      (r) => r.list && r.list.user_id === userId
    );

    if (owned.length === 0) {
      console.log('🗑️ Cross-list delete: nothing to remove');
      return 0;
    }

    const ids = owned.map((r) => r.id);
    const { error: deleteError } = await supabase
      .from('grocery_list_items')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('❌ Error deleting cross-list items:', deleteError);
      throw deleteError;
    }

    console.log(`🗑️ Cross-list delete: removed ${ids.length} item(s)`);
    return ids.length;
  } catch (error) {
    console.error('❌ Error in deleteItemsByIngredientFromLists:', error);
    throw error;
  }
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