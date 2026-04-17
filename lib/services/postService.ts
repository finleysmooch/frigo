// lib/services/postService.ts
// Service for creating posts. Extracted from CookingScreen to fix Supabase violation.

import { supabase } from '../supabase';
import { addDishesToMeal } from './mealService';

// Re-export meal-type helpers from neutral utils (P7-29) so existing callers
// that import from postService continue to work unchanged.
export { computeMealTypeFromHour, computeMealType } from '../utils/mealTypeHelpers';
import { computeMealType } from '../utils/mealTypeHelpers';

// ── Visibility types and defaults (D34/D35) ──

export type PostVisibility = 'everyone' | 'followers' | 'private' | 'meal_tagged';

export const DEFAULT_VISIBILITY: PostVisibility = 'followers';

/**
 * Compute the default visibility for a post (D34).
 * Phase 7L: accepts optional userDefault from user_profiles.default_visibility.
 * When userDefault is set, it overrides the hardcoded defaults.
 * - Meal context present → userDefault or 'followers'
 * - Solo dinner → userDefault or 'followers'
 * - Solo anything else → userDefault or 'private'
 */
export function computeDefaultVisibility(params: {
  hasMealContext: boolean;
  mealType?: string;
  userDefault?: PostVisibility;
}): PostVisibility {
  if (params.userDefault) {
    console.warn(`[computeDefaultVisibility] using stored preference: ${params.userDefault}`);
  }
  if (params.hasMealContext) return params.userDefault || 'followers';
  if (params.mealType === 'dinner') return params.userDefault || 'followers';
  return params.userDefault || 'private';
}

// ── Post creation ──

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
  mealType?: string | null;
  /**
   * Phase 7G: ISO timestamp for when the cook actually happened.
   * If omitted, defaults to now() at insert time. Historical cook
   * logging passes a backdated value here; normal cooks omit it
   * (or pass `now()` explicitly) — both paths write `cooked_at`
   * explicitly so feed + stats + detail all agree on a single source.
   */
  cookedAt?: string | null;
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
  // 1. Insert the dish post
  //
  // Phase 7G: `cooked_at` is written explicitly on every insert — for
  // historical cooks it's the user-chosen backdated timestamp, for normal
  // cooks it's `now()` at insert time. Relying on the DB default would
  // leave the column null for any path that didn't touch it, which breaks
  // the feed + stats sort key contract.
  const { data, error } = await supabase
    .from('posts')
    .insert({
      recipe_id: params.recipeId,
      user_id: params.userId,
      meal_type: params.mealType || computeMealType(),
      title: params.title,
      rating: params.rating ?? null,
      modifications: params.modifications || null,
      cooking_method: params.cookingMethod || null,
      notes: params.notes || null,
      visibility: params.visibility || DEFAULT_VISIBILITY,
      post_type: 'dish',
      parent_meal_id: params.parentMealId || null,
      cooked_at: params.cookedAt || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('createDishPost: insert returned null');

  // 2. If parentMealId is set, link the dish to the meal via addDishesToMeal.
  //    This writes the dish_courses row and the post_relationships row that the
  //    direct insert above does not. parent_meal_id will be redundantly re-updated
  //    inside addDishesToMeal — that's fine, it's a no-op.
  if (params.parentMealId) {
    const linkResult = await addDishesToMeal(
      params.parentMealId,
      params.userId,
      [{
        dish_id: data.id,
        course_type: 'main',
        is_main_dish: false,
        course_order: undefined,
      }]
    );

    if (!linkResult.success) {
      // The post row exists but the meal link failed. We deliberately do NOT
      // roll back the post — Tom's preference is to never delete user data,
      // even in transient failure windows. Surface the error loudly; the next
      // backfill run will mop up any orphans if this ever fires in practice.
      console.error(
        '[createDishPost] Dish post created but meal linking failed.',
        { dishId: data.id, mealId: params.parentMealId, error: linkResult.error }
      );
      throw new Error(
        `Dish created but meal linking failed: ${linkResult.error ?? 'unknown error'}`
      );
    }
  }

  return data;
}

/**
 * Get the user's most recent dish post for a given recipe.
 * Returns null if the user has never logged this recipe.
 */
export async function getMostRecentDishPost(
  userId: string,
  recipeId: string
): Promise<DishPost | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .eq('post_type', 'dish')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching most recent dish post:', error);
    return null;
  }
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

// ============================================================================
// PHASE 7I CHECKPOINT 5 / 5.3 — post editing helpers
// ============================================================================

/**
 * Patch shape accepted by `updatePost`. Covers the narrow-scope edit
 * affordances on CookDetailScreen (title, description, parent_meal_id) and
 * MealEventDetailScreen (meal_time, meal_location). Any combination may be
 * updated in a single call; undefined keys are not written.
 *
 * `meal_time` and `meal_location` were added in Phase 7I Checkpoint 6 for
 * the host overflow menu's Edit date/time + Edit location items. They
 * apply to meal_event posts but the patch is not type-narrowed — callers
 * are responsible for passing valid combinations.
 */
export interface UpdatePostPatch {
  title?: string;
  description?: string | null;
  parent_meal_id?: string | null;
  meal_time?: string | null;
  meal_location?: string | null;
  // Phase 7M additions:
  rating?: number | null;
  cooking_method?: string | null;
  modifications?: string | null;
  notes?: string | null;
  visibility?: string;
  cooked_at?: string;
}

/**
 * Minimal post-edit helper. Writes the patch to `posts` by id. No validation,
 * no cascade — the caller is responsible for passing valid values.
 *
 * Used by CookDetailScreen's overflow menu for:
 *   - Edit title (title)
 *   - Edit description (description, allows empty string)
 *   - Change meal event (parent_meal_id, null = detach)
 */
export async function updatePost(
  postId: string,
  patch: UpdatePostPatch
): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update(patch)
    .eq('id', postId);
  if (error) throw error;
}

/**
 * Delete a dish post. Relies on DB foreign-key cascade rules to clean up
 * `post_likes`, `post_comments`, `post_participants`, and `dish_courses`
 * children — this mirrors the pattern used by `mealService.deleteMeal`
 * which also trusts FK cascade for its cleanup.
 *
 * For a dish post, nothing else should reference this post as a parent
 * (dishes don't have child dishes), so a single DELETE is sufficient.
 *
 * The caller is responsible for any UI concerns (navigation, toast, etc.).
 */
export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);
  if (error) throw error;
}
