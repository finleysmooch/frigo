// ============================================
// FRIGO - STORE SERVICE
// ============================================
// Service functions for stores and ingredient preferences
// Location: lib/storeService.ts
// Created: November 6, 2025

import { supabase } from './supabase';
import {
  Store,
  UserIngredientPreference,
  IngredientWithPreference,
  PurchaseFrequency,
  PreferenceInput,
} from './types/store';

// ============================================
// STORES CRUD
// ============================================

/**
 * Get all stores for a user
 */
export async function getUserStores(userId: string): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching stores:', error);
    throw error;
  }

  return data || [];
}

/**
 * Create a new store
 */
export async function createStore(userId: string, name: string): Promise<Store> {
  // Validate input
  if (!name.trim()) {
    throw new Error('Store name cannot be empty');
  }

  // Check if store already exists
  const { data: existing } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', name.trim())
    .maybeSingle();

  if (existing) {
    throw new Error('A store with this name already exists');
  }

  const { data, error } = await supabase
    .from('stores')
    .insert({ 
      user_id: userId, 
      name: name.trim() 
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating store:', error);
    throw error;
  }

  return data;
}

/**
 * Update a store name
 */
export async function updateStore(storeId: string, name: string): Promise<Store> {
  if (!name.trim()) {
    throw new Error('Store name cannot be empty');
  }

  const { data, error } = await supabase
    .from('stores')
    .update({ name: name.trim() })
    .eq('id', storeId)
    .select()
    .single();

  if (error) {
    console.error('Error updating store:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a store
 * Note: This will set preferred_store_id to NULL for any ingredients using this store
 */
export async function deleteStore(storeId: string): Promise<void> {
  const { error } = await supabase
    .from('stores')
    .delete()
    .eq('id', storeId);

  if (error) {
    console.error('Error deleting store:', error);
    throw error;
  }
}

// ============================================
// INGREDIENT PREFERENCES
// ============================================

/**
 * Get all ingredient preferences for a user
 */
export async function getUserIngredientPreferences(
  userId: string
): Promise<UserIngredientPreference[]> {
  const { data, error } = await supabase
    .from('user_ingredient_preferences')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching preferences:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get preference for a specific ingredient
 */
export async function getIngredientPreference(
  userId: string,
  ingredientId: string
): Promise<UserIngredientPreference | null> {
  const { data, error } = await supabase
    .from('user_ingredient_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('ingredient_id', ingredientId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching preference:', error);
    throw error;
  }

  return data;
}

/**
 * Set or update store preference for an ingredient
 */
export async function setIngredientStore(
  userId: string,
  ingredientId: string,
  storeId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('user_ingredient_preferences')
    .upsert({
      user_id: userId,
      ingredient_id: ingredientId,
      preferred_store_id: storeId,
    }, {
      onConflict: 'user_id,ingredient_id',
    });

  if (error) {
    console.error('Error setting ingredient store:', error);
    throw error;
  }
}

/**
 * Set or update purchase frequency for an ingredient
 */
export async function setIngredientFrequency(
  userId: string,
  ingredientId: string,
  frequency: PurchaseFrequency | null
): Promise<void> {
  const { error } = await supabase
    .from('user_ingredient_preferences')
    .upsert({
      user_id: userId,
      ingredient_id: ingredientId,
      purchase_frequency: frequency,
    }, {
      onConflict: 'user_id,ingredient_id',
    });

  if (error) {
    console.error('Error setting ingredient frequency:', error);
    throw error;
  }
}

/**
 * Update both store and frequency at once
 */
export async function updateIngredientPreference(
  userId: string,
  ingredientId: string,
  updates: {
    preferred_store_id?: string | null;
    purchase_frequency?: PurchaseFrequency | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('user_ingredient_preferences')
    .upsert({
      user_id: userId,
      ingredient_id: ingredientId,
      ...updates,
    }, {
      onConflict: 'user_id,ingredient_id',
    });

  if (error) {
    console.error('Error updating ingredient preference:', error);
    throw error;
  }
}

/**
 * Delete preference for an ingredient
 */
export async function deleteIngredientPreference(
  userId: string,
  ingredientId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_ingredient_preferences')
    .delete()
    .eq('user_id', userId)
    .eq('ingredient_id', ingredientId);

  if (error) {
    console.error('Error deleting preference:', error);
    throw error;
  }
}

// ============================================
// GROCERY LIST WITH STORES
// ============================================

/**
 * Get grocery list items with store information
 */
export async function getGroceryListWithStores(userId: string) {
  const { data, error } = await supabase
    .from('grocery_list_items')
    .select(`
      *,
      ingredient:ingredients!grocery_list_items_ingredient_id_fkey (
        id,
        name,
        plural_name,
        family
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching grocery list:', error);
    throw error;
  }

  // Now get preferences for these ingredients
  const ingredientIds = data?.map(item => item.ingredient_id) || [];
  
  if (ingredientIds.length === 0) {
    return [];
  }

  const { data: preferences, error: prefError } = await supabase
    .from('user_ingredient_preferences')
    .select(`
      ingredient_id,
      preferred_store_id,
      purchase_frequency,
      store:stores!user_ingredient_preferences_preferred_store_id_fkey (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .in('ingredient_id', ingredientIds);

  if (prefError) {
    console.error('Error fetching preferences:', prefError);
    // Continue without preferences rather than failing
  }

  // Merge preferences into grocery items
  const prefsMap = new Map(
    (preferences || []).map(pref => [pref.ingredient_id, pref])
  );

  const itemsWithStores = data?.map(item => ({
    ...item,
    preferred_store_id: prefsMap.get(item.ingredient_id)?.preferred_store_id || null,
    store: prefsMap.get(item.ingredient_id)?.store || null,
    purchase_frequency: prefsMap.get(item.ingredient_id)?.purchase_frequency || null,
  }));

  return itemsWithStores || [];
}

/**
 * Get ingredients with their store preferences for the preferences screen
 */
export async function getIngredientsWithPreferences(
  userId: string,
  searchQuery?: string
): Promise<IngredientWithPreference[]> {
  let query = supabase
    .from('ingredients')
    .select(`
      id,
      name,
      plural_name,
      family
    `)
    .order('name', { ascending: true });

  // Add search filter if provided
  if (searchQuery && searchQuery.trim()) {
    query = query.or(`name.ilike.%${searchQuery.trim()}%,plural_name.ilike.%${searchQuery.trim()}%`);
  }

  const { data: ingredients, error } = await query.limit(50); // Limit for performance

  if (error) {
    console.error('Error fetching ingredients:', error);
    throw error;
  }

  if (!ingredients || ingredients.length === 0) {
    return [];
  }

  // Get preferences for these ingredients
  const ingredientIds = ingredients.map(ing => ing.id);

  const { data: preferences } = await supabase
    .from('user_ingredient_preferences')
    .select(`
      ingredient_id,
      preferred_store_id,
      purchase_frequency,
      store:stores!user_ingredient_preferences_preferred_store_id_fkey (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .in('ingredient_id', ingredientIds);

  // Merge preferences with ingredients
  const prefsMap = new Map(
    (preferences || []).map(pref => [pref.ingredient_id, pref])
  );

  return ingredients.map(ing => {
    const pref = prefsMap.get(ing.id);
    // Store comes back as an object from Supabase join
    const store = pref?.store ? (Array.isArray(pref.store) ? pref.store[0] : pref.store) : null;
    
    return {
      ...ing,
      preferred_store_id: pref?.preferred_store_id || null,
      preferred_store: store as any,
      purchase_frequency: pref?.purchase_frequency || null,
    };
  });
}

// ============================================
// GROUPING HELPERS
// ============================================

/**
 * Group grocery items by store
 */
export function groupItemsByStore(items: any[]) {
  const grouped: Record<string, any[]> = {
    unassigned: [],
  };

  items.forEach(item => {
    const storeName = item.store?.name || 'unassigned';
    if (!grouped[storeName]) {
      grouped[storeName] = [];
    }
    grouped[storeName].push(item);
  });

  return grouped;
}

/**
 * Group items by store, then by family within each store
 */
export function groupItemsByStoreAndFamily(items: any[]) {
  // First group by store
  const storeGroups: Record<string, Record<string, any[]>> = {};

  items.forEach(item => {
    const storeName = item.store?.name || 'Unassigned';
    const family = item.ingredient.family;

    if (!storeGroups[storeName]) {
      storeGroups[storeName] = {};
    }

    if (!storeGroups[storeName][family]) {
      storeGroups[storeName][family] = [];
    }

    storeGroups[storeName][family].push(item);
  });

  return storeGroups;
}

/**
 * Get store statistics for a user
 */
export async function getStoreStatistics(userId: string) {
  const [stores, preferences, groceryItems] = await Promise.all([
    getUserStores(userId),
    getUserIngredientPreferences(userId),
    getGroceryListWithStores(userId),
  ]);

  const storeStats = stores.map(store => {
    const prefsCount = preferences.filter(
      pref => pref.preferred_store_id === store.id
    ).length;

    const itemsCount = groceryItems.filter(
      item => item.preferred_store_id === store.id
    ).length;

    return {
      store,
      ingredientsWithPreference: prefsCount,
      itemsOnGroceryList: itemsCount,
    };
  });

  const unassignedPrefs = preferences.filter(pref => !pref.preferred_store_id).length;
  const unassignedItems = groceryItems.filter(item => !item.preferred_store_id).length;

  return {
    stores: storeStats,
    unassigned: {
      ingredientsWithPreference: unassignedPrefs,
      itemsOnGroceryList: unassignedItems,
    },
    total: {
      stores: stores.length,
      preferences: preferences.length,
      groceryItems: groceryItems.length,
    },
  };
}