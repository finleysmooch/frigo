// lib/services/cookCardDataService.ts
// Phase 7I Checkpoint 5 — shared data-loading module for surfaces that
// consume CookCardData. Both FeedScreen (batch/feed load) and
// CookDetailScreen (single-post hydration) call through here.
//
// The `transformToCookCardData` helper originated in FeedScreen during
// Checkpoint 4 and was moved here unchanged (Checkpoint 5 / 5.1.0) so a
// second surface can consume it without duplication. The two new exports
// below — `fetchSingleCookCardData` and `fetchCookCardDataBatch` — wrap
// the same SELECT columns FeedScreen uses so the transform's input shape
// stays identical across all callers.

import { supabase } from '../supabase';
import type { CookCardData } from '../types/feed';

// ============================================================================
// TRANSFORM: raw post rows → CookCardData[]
// ============================================================================
//
// Honors six denormalization invariants (see Checkpoint 4 prompt §4.1):
//   1. recipe_cook_time_min = recipe.cook_time_min + recipe.prep_time_min
//      (null when both are zero/null — so the stats row omits the cell)
//   2. recipe_image_url always comes from recipes lookup, never per-post
//   3. author is the full user_profiles row
//   4. chef_name flattened from recipes.chefs[0].name
//   5. photos pass through verbatim
//   6. all recipe fields flattened to top-level recipe_* names

export function transformToCookCardData(
  rawPosts: any[],
  profilesMap: Map<string, any>,
  recipesMap: Map<string, any>
): CookCardData[] {
  return rawPosts.map((post: any) => {
    const recipe = post.recipe_id ? recipesMap.get(post.recipe_id) : undefined;

    // INVARIANT 4: flatten chef
    const chef = recipe?.chefs
      ? Array.isArray(recipe.chefs)
        ? recipe.chefs[0]
        : recipe.chefs
      : null;

    // INVARIANT 1: aggregate cook + prep time; null when both missing
    const cookTime = recipe?.cook_time_min ?? 0;
    const prepTime = recipe?.prep_time_min ?? 0;
    const totalTime = cookTime + prepTime;
    const recipe_cook_time_min = totalTime > 0 ? totalTime : null;

    const profile = profilesMap.get(post.user_id);
    const author: CookCardData['author'] = profile
      ? {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          subscription_tier: profile.subscription_tier,
        }
      : {
          id: post.user_id,
          username: 'Unknown',
          display_name: 'Unknown User',
          avatar_url: null,
        };

    // Title cascade — explicit title → recipe title → freeform dish_name → fallback
    const title =
      post.title || recipe?.title || post.dish_name || 'Untitled Post';

    return {
      id: post.id,
      user_id: post.user_id,
      title,
      description: post.description ?? null,
      rating: post.rating ?? null,
      cooking_method: post.cooking_method ?? null,
      modifications: post.modifications ?? null,
      notes: post.notes ?? null,
      photos: post.photos || [], // INVARIANT 5
      created_at: post.created_at,
      cooked_at: post.cooked_at ?? null,
      parent_meal_id: post.parent_meal_id ?? null,
      // INVARIANT 6: flattened recipe fields
      recipe_id: post.recipe_id ?? null,
      recipe_title: recipe?.title ?? null,
      recipe_image_url: recipe?.image_url ?? null, // INVARIANT 2
      recipe_cook_time_min,
      recipe_cuisine_types: recipe?.cuisine_types ?? null,
      recipe_vibe_tags: recipe?.vibe_tags ?? null,
      recipe_times_cooked: recipe?.times_cooked ?? null,
      recipe_page_number: recipe?.page_number ?? null,
      chef_name: chef?.name ?? null,
      author,
    };
  });
}

// ============================================================================
// SELECT COLUMNS — single source of truth
// ============================================================================
// Must stay in sync with FeedScreen.loadDishPosts's SELECT list so all
// callers produce the same input shape to `transformToCookCardData`.

const POST_SELECT_COLUMNS =
  'id, user_id, title, rating, cooking_method, created_at, cooked_at, photos, recipe_id, modifications, description, notes, post_type, parent_meal_id';

const RECIPE_SELECT_COLUMNS =
  'id, title, image_url, cook_time_min, prep_time_min, cuisine_types, vibe_tags, times_cooked, page_number, chefs(name)';

const PROFILE_SELECT_COLUMNS =
  'id, username, display_name, avatar_url, subscription_tier';

// ============================================================================
// Single-post fetch — CookDetailScreen entry point
// ============================================================================

/**
 * Fetch one post + its author profile + its recipe (if any), then transform
 * to `CookCardData`. Returns `null` if the post doesn't exist or fails the
 * visibility filter (everyone / followers / null). Used by CookDetailScreen's
 * `loadPostDetail` helper.
 *
 * NOTE: this function trusts RLS + the visibility `.or` filter for access
 * control. It does NOT apply the follow-graph filter that FeedScreen's
 * loadFollows applies — a viewer can reach CookDetailScreen via nav from
 * CommentsList or a linked group, so the follow-graph prefilter isn't
 * appropriate here.
 */
export async function fetchSingleCookCardData(
  postId: string
): Promise<CookCardData | null> {
  // 1. Post row
  const { data: postRow, error: postErr } = await supabase
    .from('posts')
    .select(POST_SELECT_COLUMNS)
    .eq('id', postId)
    .or('visibility.eq.everyone,visibility.eq.followers,visibility.is.null')
    .maybeSingle();

  if (postErr || !postRow) return null;

  // 2. Author profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select(PROFILE_SELECT_COLUMNS)
    .eq('id', (postRow as any).user_id)
    .maybeSingle();

  const profilesMap = new Map();
  if (profile) profilesMap.set((profile as any).id, profile);

  // 3. Recipe (optional)
  const recipesMap = new Map();
  if ((postRow as any).recipe_id) {
    const { data: recipe } = await supabase
      .from('recipes')
      .select(RECIPE_SELECT_COLUMNS)
      .eq('id', (postRow as any).recipe_id)
      .maybeSingle();
    if (recipe) recipesMap.set((recipe as any).id, recipe);
  }

  const result = transformToCookCardData([postRow], profilesMap, recipesMap);
  return result[0] ?? null;
}

// ============================================================================
// Batch fetch — for MealEventDetailScreen (Checkpoint 6) and other surfaces
// that hydrate a known set of post IDs
// ============================================================================

/**
 * Fetch N posts by ID, hydrate profiles and recipes in one pass each, then
 * transform as a batch. Preserves the order of the input `postIds` array
 * in the output. Posts that don't exist or fail visibility are omitted
 * from the output (the returned array may be shorter than `postIds`).
 *
 * Checkpoint 6's MealEventDetailScreen will use this to hydrate its dish
 * list. Added in Checkpoint 5 so the module API is consistent from day one.
 */
export async function fetchCookCardDataBatch(
  postIds: string[]
): Promise<CookCardData[]> {
  if (postIds.length === 0) return [];

  // 1. Post rows
  const { data: postsData, error: postErr } = await supabase
    .from('posts')
    .select(POST_SELECT_COLUMNS)
    .in('id', postIds)
    .or('visibility.eq.everyone,visibility.eq.followers,visibility.is.null');

  if (postErr || !postsData || postsData.length === 0) return [];

  // 2. Author profiles (one query for all unique user_ids)
  const userProfileIds = [...new Set(postsData.map((p: any) => p.user_id))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select(PROFILE_SELECT_COLUMNS)
    .in('id', userProfileIds);
  const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  // 3. Recipes (one query for all unique recipe_ids)
  const recipeIds = postsData
    .map((p: any) => p.recipe_id)
    .filter((id: any): id is string => !!id);
  let recipesData: any[] = [];
  if (recipeIds.length > 0) {
    const { data } = await supabase
      .from('recipes')
      .select(RECIPE_SELECT_COLUMNS)
      .in('id', recipeIds);
    recipesData = data || [];
  }
  const recipesMap = new Map(recipesData.map(r => [r.id, r]));

  // 4. Transform and preserve input order
  const transformed = transformToCookCardData(postsData, profilesMap, recipesMap);
  const byId = new Map(transformed.map(c => [c.id, c]));
  return postIds
    .map(id => byId.get(id))
    .filter((c): c is CookCardData => c !== undefined);
}
