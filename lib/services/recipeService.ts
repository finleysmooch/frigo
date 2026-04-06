// lib/services/recipeService.ts
// Service for recipe CRUD operations

import { supabase } from '../supabase';

/**
 * Delete a recipe by ID.
 * Throws on error so the caller can show an appropriate message.
 */
export async function deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId);

  if (error) {
    console.error('deleteRecipe error:', error);
    throw error;
  }
}
