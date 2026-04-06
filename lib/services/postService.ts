// lib/services/postService.ts
// Service for creating posts. Extracted from CookingScreen to fix Supabase violation.

import { supabase } from '../supabase';

export interface CreateDishPostParams {
  userId: string;
  recipeId: string;
  title: string;
  rating?: number | null;
  modifications?: string;
  cookingMethod?: string;
  notes?: string;
  visibility?: string;
  parentMealId?: string | null;
}

export interface DishPost {
  id: string;
  recipe_id: string;
  user_id: string;
  [key: string]: any;
}

/**
 * Create a dish post for a completed cooking session.
 */
export async function createDishPost(params: CreateDishPostParams): Promise<DishPost> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      recipe_id: params.recipeId,
      user_id: params.userId,
      meal_type: 'dinner',
      title: params.title,
      rating: params.rating ?? null,
      modifications: params.modifications || null,
      cooking_method: params.cookingMethod || null,
      notes: params.notes || null,
      visibility: params.visibility || 'everyone',
      post_type: 'dish',
      parent_meal_id: params.parentMealId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the times_cooked count for a recipe.
 */
export async function getTimesCooked(recipeId: string): Promise<number> {
  const { data, error } = await supabase
    .from('recipes')
    .select('times_cooked')
    .eq('id', recipeId)
    .single();
  if (error) return 0;
  return data?.times_cooked || 0;
}

/**
 * Update the times_cooked count for a recipe.
 */
export async function updateTimesCooked(recipeId: string, count: number): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .update({ times_cooked: count })
    .eq('id', recipeId);
  if (error) throw error;
}
