// lib/services/postService.ts
// Service for creating posts. Extracted from CookingScreen to fix Supabase violation.

import { supabase } from '../supabase';

export interface CreateDishPostParams {
  userId: string;
  recipeId: string;
  title: string;
  rating: number;
  modifications?: string;
  cookingMethod?: string;
  notes?: string;
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
      rating: params.rating,
      modifications: params.modifications || null,
      cooking_method: params.cookingMethod || null,
      notes: params.notes || null,
      post_type: 'dish',
      parent_meal_id: params.parentMealId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
