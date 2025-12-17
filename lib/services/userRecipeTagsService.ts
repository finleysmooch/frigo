// lib/services/userRecipeTagsService.ts
// Service for managing user recipe tags (cook_soon, saved, favorites, etc.)
// Created: December 10, 2025
// Updated: December 12, 2025 - Fixed chefs join (was incorrectly using user_profiles)

import { supabase } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

// Common tag values - these are conventions, not enforced by DB
export type RecipeTagType = 
  | 'cook_soon'    // Cooking shortlist - want to cook soon
  | 'saved'        // Saved/bookmarked
  | 'favorite'     // User's favorites
  | 'tried'        // Has cooked before
  | 'want_to_try'; // Want to try someday

export interface UserRecipeTag {
  id: string;
  user_id: string;
  recipe_id: string;
  tag: string;
  created_at: string;
}

// Interface for recipes returned from getRecipesWithTag
// This is what CookSoonSection and CookSoonScreen expect
export interface TaggedRecipe {
  id: string;
  title: string;
  image_url?: string;
  recipe_type?: string;
  chef_name?: string;
  total_time_min?: number;
  difficulty_level?: string;
  cuisine_types?: string[];
  tagged_at: string;
}

// Legacy interface - kept for backwards compatibility
export interface RecipeWithTag {
  recipe_id: string;
  recipe_title: string;
  recipe_image_url?: string;
  recipe_type?: string;
  chef_name?: string;
  tag: string;
  tagged_at: string;
}

// ============================================================================
// TAG OPERATIONS
// ============================================================================

/**
 * Add a tag to a recipe for the current user
 */
export async function addRecipeTag(
  userId: string,
  recipeId: string,
  tag: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_recipe_tags')
      .upsert(
        {
          user_id: userId,
          recipe_id: recipeId,
          tag: tag.toLowerCase().trim(),
        },
        {
          onConflict: 'user_id,recipe_id,tag',
          ignoreDuplicates: true,
        }
      );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error adding recipe tag:', error);
    return { success: false, error: 'Failed to add tag' };
  }
}

/**
 * Remove a tag from a recipe for the current user
 */
export async function removeRecipeTag(
  userId: string,
  recipeId: string,
  tag: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_recipe_tags')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .eq('tag', tag.toLowerCase().trim());

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error removing recipe tag:', error);
    return { success: false, error: 'Failed to remove tag' };
  }
}

/**
 * Toggle a tag on/off for a recipe
 */
export async function toggleRecipeTag(
  userId: string,
  recipeId: string,
  tag: string
): Promise<{ success: boolean; isTagged: boolean; error?: string }> {
  try {
    // Check if tag exists
    const hasTag = await hasRecipeTag(userId, recipeId, tag);
    
    if (hasTag) {
      const result = await removeRecipeTag(userId, recipeId, tag);
      return { ...result, isTagged: false };
    } else {
      const result = await addRecipeTag(userId, recipeId, tag);
      return { ...result, isTagged: true };
    }
  } catch (error) {
    console.error('Error toggling recipe tag:', error);
    return { success: false, isTagged: false, error: 'Failed to toggle tag' };
  }
}

/**
 * Check if user has a specific tag on a recipe
 */
export async function hasRecipeTag(
  userId: string,
  recipeId: string,
  tag: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_recipe_tags')
      .select('id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .eq('tag', tag.toLowerCase().trim())
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking recipe tag:', error);
    return false;
  }
}

/**
 * Get all tags for a specific recipe (for current user)
 */
export async function getRecipeTags(
  userId: string,
  recipeId: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_recipe_tags')
      .select('tag')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId);

    if (error) throw error;
    return (data || []).map(t => t.tag);
  } catch (error) {
    console.error('Error getting recipe tags:', error);
    return [];
  }
}

/**
 * Get all recipes with a specific tag for the current user
 * Returns full recipe details for display in lists
 * 
 * UPDATED Dec 12: Fixed join to use chefs table (not user_profiles)
 * Returns format compatible with CookSoonSection component
 */
export async function getRecipesWithTag(
  userId: string,
  tag: string
): Promise<TaggedRecipe[]> {
  try {
    const { data, error } = await supabase
      .from('user_recipe_tags')
      .select(`
        recipe_id,
        tag,
        created_at,
        recipes (
          id,
          title,
          image_url,
          recipe_type,
          chef_id,
          prep_time_min,
          cook_time_min,
          difficulty_level,
          cuisine_types,
          chefs:chef_id (
            name
          )
        )
      `)
      .eq('user_id', userId)
      .eq('tag', tag.toLowerCase().trim())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error in getRecipesWithTag query:', error);
      throw error;
    }

    // Transform to flat structure expected by UI components
    // Calculate total_time_min from prep + cook since the column doesn't exist
    return (data || []).map((item: any) => {
      const prepTime = item.recipes?.prep_time_min || 0;
      const cookTime = item.recipes?.cook_time_min || 0;
      const totalTime = prepTime + cookTime > 0 ? prepTime + cookTime : undefined;
      
      return {
        id: item.recipe_id,
        title: item.recipes?.title || 'Unknown Recipe',
        image_url: item.recipes?.image_url,
        recipe_type: item.recipes?.recipe_type,
        chef_name: item.recipes?.chefs?.name || 'Unknown Chef',
        total_time_min: totalTime,
        difficulty_level: item.recipes?.difficulty_level,
        cuisine_types: item.recipes?.cuisine_types,
        tagged_at: item.created_at,
      };
    });
  } catch (error) {
    console.error('Error getting recipes with tag:', error);
    return [];
  }
}

/**
 * Get count of recipes for each tag
 */
export async function getTagCounts(
  userId: string
): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('user_recipe_tags')
      .select('tag')
      .eq('user_id', userId);

    if (error) throw error;

    const counts: Record<string, number> = {};
    (data || []).forEach((item: any) => {
      counts[item.tag] = (counts[item.tag] || 0) + 1;
    });
    return counts;
  } catch (error) {
    console.error('Error getting tag counts:', error);
    return {};
  }
}

/**
 * Get "Cook Soon" recipes count (quick helper)
 */
export async function getCookSoonCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('user_recipe_tags')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tag', 'cook_soon');

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting cook soon count:', error);
    return 0;
  }
}

/**
 * Add to "Cook Soon" list (convenience function)
 */
export async function addToCookSoon(
  userId: string,
  recipeId: string
): Promise<{ success: boolean; error?: string }> {
  return addRecipeTag(userId, recipeId, 'cook_soon');
}

/**
 * Remove from "Cook Soon" list (convenience function)
 */
export async function removeFromCookSoon(
  userId: string,
  recipeId: string
): Promise<{ success: boolean; error?: string }> {
  return removeRecipeTag(userId, recipeId, 'cook_soon');
}

/**
 * Check if recipe is in "Cook Soon" list (convenience function)
 */
export async function isInCookSoon(
  userId: string,
  recipeId: string
): Promise<boolean> {
  return hasRecipeTag(userId, recipeId, 'cook_soon');
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

export function getTagDisplayInfo(tag: string): {
  label: string;
  emoji: string;
  color: string;
} {
  const tagInfo: Record<string, { label: string; emoji: string; color: string }> = {
    cook_soon: { label: 'Cook Soon', emoji: '🔥', color: '#F59E0B' },
    saved: { label: 'Saved', emoji: '🔖', color: '#3B82F6' },
    favorite: { label: 'Favorite', emoji: '❤️', color: '#EF4444' },
    tried: { label: 'Tried', emoji: '✅', color: '#10B981' },
    want_to_try: { label: 'Want to Try', emoji: '🎯', color: '#8B5CF6' },
  };

  return tagInfo[tag] || { label: tag, emoji: '🏷️', color: '#6B7280' };
}