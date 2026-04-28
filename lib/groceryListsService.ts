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
  GroceryListItemRecipe,
  UpdateGroceryListParams,
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
  // Phase 8C-CP2a: optional recipe attribution. When provided, a junction
  // row is written linking the resulting list item to the recipe with the
  // per-recipe quantity preserved. Existing callers that omit these fields
  // keep working unchanged.
  recipeId?: string;
  recipeQuantityAmount?: number;
  recipeQuantityUnit?: string;
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

/**
 * Phase 8C-CP3 — fetch a single list's metadata (used to hydrate per-list
 * preferences like view_mode on screen mount).
 */
export async function getGroceryList(listId: string): Promise<GroceryList | null> {
  try {
    const { data, error } = await supabase
      .from('grocery_lists')
      .select('*')
      .eq('id', listId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error getting grocery list:', error);
      throw error;
    }

    return (data as unknown as GroceryList | null) ?? null;
  } catch (error) {
    console.error('❌ Error in getGroceryList:', error);
    throw error;
  }
}

/**
 * Phase 8C-CP3 — update a grocery list's metadata. Maps camelCase params to
 * snake_case DB columns. All fields optional; only those provided are written.
 */
export async function updateGroceryList(
  listId: string,
  params: UpdateGroceryListParams
): Promise<GroceryList> {
  try {
    const updates: Record<string, unknown> = {};
    if (params.name !== undefined) updates.name = params.name;
    if (params.emoji !== undefined) updates.emoji = params.emoji;
    if (params.isActive !== undefined) updates.is_active = params.isActive;
    if (params.isTemplate !== undefined) updates.is_template = params.isTemplate;
    if (params.sortOrder !== undefined) updates.sort_order = params.sortOrder;
    if (params.storeName !== undefined) updates.store_name = params.storeName;
    if (params.viewMode !== undefined) updates.view_mode = params.viewMode;

    const { data, error } = await supabase
      .from('grocery_lists')
      .update(updates)
      .eq('id', listId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating grocery list:', error);
      throw error;
    }

    console.log('✅ Grocery list updated');
    return data as unknown as GroceryList;
  } catch (error) {
    console.error('❌ Error in updateGroceryList:', error);
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

// ============================================
// PHASE 8C-CP2a — RECIPE ATTRIBUTION (JUNCTION)
// ============================================

/**
 * Upsert one (item, recipe) attribution row with additive-on-conflict semantics
 * for the per-recipe quantity. Re-adding the same recipe to the same item
 * sums recipe_quantity_amount on top of the existing value.
 *
 * Implementation note: PostgREST does not directly expose `ON CONFLICT ... DO
 * UPDATE SET col = col + EXCLUDED.col` via the supabase-js builder. We do a
 * read-then-write: try insert; on unique-violation, read the existing row,
 * compute the new sum, update. Two round-trips on conflict, one on first add —
 * acceptable for the typical small-N use case (recipe Add flow is per-modal
 * action, not in a hot loop).
 */
async function upsertItemRecipeAttribution(
  itemId: string,
  recipeId: string,
  recipeQuantityAmount: number | null | undefined,
  recipeQuantityUnit: string | null | undefined
): Promise<void> {
  try {
    const { error: insertError } = await supabase
      .from('grocery_list_item_recipes')
      .insert({
        grocery_list_item_id: itemId,
        recipe_id: recipeId,
        recipe_quantity_amount: recipeQuantityAmount ?? null,
        recipe_quantity_unit: recipeQuantityUnit ?? null,
      });

    if (!insertError) {
      console.log(`✅ Junction attributed item to recipe ${recipeId}`);
      return;
    }

    // 23505 = unique_violation. On conflict, sum quantities additively.
    if ((insertError as { code?: string }).code !== '23505') {
      console.error('❌ Error inserting junction row:', insertError);
      throw insertError;
    }

    const { data: existing, error: fetchError } = await supabase
      .from('grocery_list_item_recipes')
      .select('id, recipe_quantity_amount')
      .eq('grocery_list_item_id', itemId)
      .eq('recipe_id', recipeId)
      .single();

    if (fetchError || !existing) {
      console.error('❌ Error fetching existing junction row:', fetchError);
      throw fetchError;
    }

    const oldAmount = (existing as { recipe_quantity_amount: number | null }).recipe_quantity_amount ?? 0;
    const addAmount = recipeQuantityAmount ?? 0;
    const newAmount = oldAmount + addAmount;

    const { error: updateError } = await supabase
      .from('grocery_list_item_recipes')
      .update({
        recipe_quantity_amount: newAmount,
        recipe_quantity_unit: recipeQuantityUnit ?? null,
      })
      .eq('id', (existing as { id: string }).id);

    if (updateError) {
      console.error('❌ Error updating junction row:', updateError);
      throw updateError;
    }

    console.log(`✅ Junction merged: ${oldAmount} + ${addAmount} = ${newAmount}`);
  } catch (error) {
    console.error('❌ Error in upsertItemRecipeAttribution:', error);
    throw error;
  }
}

/**
 * Phase 8C-CP2a — fetch all recipe attributions for a single item, with
 * recipe titles joined.
 */
export async function getRecipesForItem(itemId: string): Promise<GroceryListItemRecipe[]> {
  try {
    const { data, error } = await supabase
      .from('grocery_list_item_recipes')
      .select(`
        id,
        grocery_list_item_id,
        recipe_id,
        recipe_quantity_amount,
        recipe_quantity_unit,
        created_at,
        recipe:recipes (
          title
        )
      `)
      .eq('grocery_list_item_id', itemId);

    if (error) {
      console.error('❌ Error fetching recipes for item:', error);
      throw error;
    }

    type Row = {
      id: string;
      grocery_list_item_id: string;
      recipe_id: string;
      recipe_quantity_amount: number | null;
      recipe_quantity_unit: string | null;
      created_at: string;
      recipe: { title: string } | null;
    };

    const rows = (data as unknown as Row[]) || [];
    return rows.map((r) => ({
      id: r.id,
      grocery_list_item_id: r.grocery_list_item_id,
      recipe_id: r.recipe_id,
      recipe_title: r.recipe?.title ?? '',
      recipe_quantity_amount: r.recipe_quantity_amount,
      recipe_quantity_unit: r.recipe_quantity_unit,
      created_at: r.created_at,
    }));
  } catch (error) {
    console.error('❌ Error in getRecipesForItem:', error);
    throw error;
  }
}

/**
 * Phase 8C-CP2a — fetch all items for a list with each item's recipe
 * attributions attached. Single batched query for junction rows; client-side
 * group-by to avoid N+1. Used by CP3 in Detailed mode.
 */
export async function getItemsWithRecipes(listId: string): Promise<GroceryListItemWithIngredient[]> {
  try {
    const items = await getItemsForList(listId);
    if (items.length === 0) {
      return items;
    }

    const itemIds = items.map((i) => i.id);

    const { data: junctionData, error: junctionError } = await supabase
      .from('grocery_list_item_recipes')
      .select(`
        id,
        grocery_list_item_id,
        recipe_id,
        recipe_quantity_amount,
        recipe_quantity_unit,
        created_at,
        recipe:recipes (
          title
        )
      `)
      .in('grocery_list_item_id', itemIds);

    if (junctionError) {
      console.error('❌ Error fetching junction rows for list:', junctionError);
      throw junctionError;
    }

    type Row = {
      id: string;
      grocery_list_item_id: string;
      recipe_id: string;
      recipe_quantity_amount: number | null;
      recipe_quantity_unit: string | null;
      created_at: string;
      recipe: { title: string } | null;
    };

    const groups = new Map<string, GroceryListItemRecipe[]>();
    for (const row of (junctionData as unknown as Row[]) || []) {
      const existing = groups.get(row.grocery_list_item_id) || [];
      existing.push({
        id: row.id,
        grocery_list_item_id: row.grocery_list_item_id,
        recipe_id: row.recipe_id,
        recipe_title: row.recipe?.title ?? '',
        recipe_quantity_amount: row.recipe_quantity_amount,
        recipe_quantity_unit: row.recipe_quantity_unit,
        created_at: row.created_at,
      });
      groups.set(row.grocery_list_item_id, existing);
    }

    return items.map((item) => ({
      ...item,
      recipes: groups.get(item.id) || [],
    }));
  } catch (error) {
    console.error('❌ Error in getItemsWithRecipes:', error);
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

      // Phase 8C-CP2a: junction-row write on merge. Additive on conflict so
      // re-adding the same recipe to the same item sums per-recipe quantities.
      if (params.recipeId) {
        await upsertItemRecipeAttribution(
          existingItem.id,
          params.recipeId,
          params.recipeQuantityAmount ?? params.quantity_display,
          params.recipeQuantityUnit ?? params.unit_display
        );
      }

      console.log(`✅ Merged quantities: ${existingItem.quantity_display} + ${params.quantity_display} = ${newQuantity}`);
      return updatedItem as unknown as GroceryListItemWithIngredient;
    }

    // Item doesn't exist, create new one. Phase 8C-CP2a: do NOT pass legacy
    // recipe_id — junction is the source of truth for new attributions.
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

    // Phase 8C-CP2a: junction-row write on insert.
    if (params.recipeId && data) {
      await upsertItemRecipeAttribution(
        (data as { id: string }).id,
        params.recipeId,
        params.recipeQuantityAmount ?? params.quantity_display,
        params.recipeQuantityUnit ?? params.unit_display
      );
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
    source_staple_id?: string | null;   // Phase 8C-CP4 — staple back-pointer (set when Stage-2 dedup links an existing row)
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

    // Add all ingredients to the list. Phase 8C-CP4 (P8-19 fold-in): forward
    // recipeId so addItemToList writes the junction attribution row for each
    // ingredient. Per-recipe quantity defaults to the per-ingredient amount.
    let addedCount = 0;
    for (const ingredient of ingredients) {
      try {
        await addItemToList({
          list_id: targetList.id,
          ingredient_id: ingredient.ingredient_id,
          quantity_display: ingredient.quantity,
          unit_display: ingredient.unit,
          recipeId,
          recipeQuantityAmount: ingredient.quantity,
          recipeQuantityUnit: ingredient.unit,
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