// lib/services/recipeHistoryService.ts
// Queries the posts table to build per-recipe cooking history for a user.

import { supabase } from '../supabase';

// ── Types ────────────────────────────────────────────────────────

export interface CookingHistory {
  recipe_id: string;
  times_cooked: number;
  last_cooked: string;  // ISO date
  first_cooked: string; // ISO date
  avg_rating: number | null;
  latest_rating: number | null;
}

export interface FriendsCookingInfo {
  recipe_id: string;
  friends_cooked_count: number;
}

// ── Queries ──────────────────────────────────────────────────────

/**
 * Fetch a user's full cooking history, grouped by recipe.
 *
 * Uses a single query ordered by cooked_at DESC so we can extract
 * latest_rating client-side (first row per recipe) without a second
 * round-trip or DISTINCT ON.
 *
 * Returns a Map keyed by recipe_id for O(1) lookups in calling code.
 */
export async function getCookingHistory(
  userId: string
): Promise<Map<string, CookingHistory>> {
  const { data, error } = await supabase
    .from('posts')
    .select('recipe_id, cooked_at, rating')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null)
    .order('cooked_at', { ascending: false });

  if (error) {
    console.error('Error fetching cooking history:', error);
    return new Map();
  }

  // Group rows by recipe_id. Because rows are ordered cooked_at DESC,
  // the first row we see for each recipe is the most recent cook.
  // Accumulator also tracks rated_count separately so the running average
  // is correct even when some posts have no rating.
  type Acc = CookingHistory & { _rated_count: number; _rating_sum: number };
  const acc = new Map<string, Acc>();

  for (const row of data || []) {
    const id: string = row.recipe_id;
    const existing = acc.get(id);

    if (!existing) {
      const hasRating = row.rating != null;
      acc.set(id, {
        recipe_id: id,
        times_cooked: 1,
        last_cooked: row.cooked_at,
        first_cooked: row.cooked_at,
        avg_rating: hasRating ? row.rating : null,
        latest_rating: hasRating ? row.rating : null,
        _rated_count: hasRating ? 1 : 0,
        _rating_sum: hasRating ? row.rating : 0,
      });
    } else {
      existing.times_cooked += 1;
      existing.first_cooked = row.cooked_at; // rows are DESC so this keeps getting older

      if (row.rating != null) {
        existing._rated_count += 1;
        existing._rating_sum += row.rating;
        existing.avg_rating = existing._rating_sum / existing._rated_count;
      }
      // latest_rating stays as the first row we saw (most recent cook)
    }
  }

  // Strip internal accumulators before returning
  const map = new Map<string, CookingHistory>();
  for (const [id, entry] of acc) {
    const { _rated_count: _rc, _rating_sum: _rs, ...history } = entry;
    map.set(id, history);
  }
  return map;
}

/**
 * For each recipe, count how many distinct friends of userId have cooked it.
 *
 * Two queries:
 *   1. Resolve the followed user IDs from the follows table.
 *   2. Fetch their dish posts, then count distinct user_id per recipe client-side.
 *
 * Returns a Map keyed by recipe_id for O(1) lookups in calling code.
 * Recipes not cooked by any friend are absent from the map.
 */
export async function getFriendsCookingInfo(
  userId: string
): Promise<Map<string, FriendsCookingInfo>> {
  // 1. Who does this user follow?
  const { data: followData, error: followError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (followError) {
    console.error('Error fetching follows:', followError);
    return new Map();
  }

  const friendIds = (followData || []).map((r: any) => r.following_id as string);
  if (friendIds.length === 0) return new Map();

  // 2. Fetch their dish posts (only recipe_id + user_id needed for counting)
  const { data: postData, error: postError } = await supabase
    .from('posts')
    .select('recipe_id, user_id')
    .in('user_id', friendIds)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null);

  if (postError) {
    console.error('Error fetching friends\' posts:', postError);
    return new Map();
  }

  // Count distinct friends per recipe client-side
  const friendSets = new Map<string, Set<string>>();
  for (const row of postData || []) {
    const recipeId: string = row.recipe_id;
    let set = friendSets.get(recipeId);
    if (!set) {
      set = new Set();
      friendSets.set(recipeId, set);
    }
    set.add(row.user_id);
  }

  const map = new Map<string, FriendsCookingInfo>();
  for (const [recipeId, set] of friendSets) {
    map.set(recipeId, {
      recipe_id: recipeId,
      friends_cooked_count: set.size,
    });
  }
  return map;
}

// ============================================================================
// PHASE 7I CHECKPOINT 2 — COOK HISTORY FOR A SPECIFIC (USER, RECIPE)
// ============================================================================

/**
 * A single cook-history row for the L6 CookDetailScreen's "Your history with
 * this recipe" section. Minimum data needed to render a row: date, rating,
 * optional photo thumbnail, optional notes preview.
 */
export interface CookHistoryEntry {
  post_id: string;
  cooked_at: string;
  rating: number | null;
  title?: string;
  notes?: string;
  /** First photo from the post, if any — used as a row thumbnail. */
  photo_thumbnail?: any;
}

/**
 * Return the list of prior cook posts for a given (user, recipe) pair,
 * newest first. No pagination — L6 shows the full history for a recipe.
 *
 * Falls back to `created_at` when `cooked_at` is null (legacy data / future
 * Phase 7G backdated-post compatibility).
 */
export async function getCookHistoryForUserRecipe(
  userId: string,
  recipeId: string
): Promise<CookHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, notes, rating, cooked_at, created_at, photos')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .eq('post_type', 'dish')
      .order('cooked_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cook history for user+recipe:', error);
      return [];
    }

    return (data || []).map((row: any) => {
      const photos = Array.isArray(row.photos) ? row.photos : [];
      return {
        post_id: row.id,
        cooked_at: row.cooked_at || row.created_at,
        rating: row.rating,
        title: row.title,
        notes: row.notes,
        photo_thumbnail: photos[0],
      };
    });
  } catch (err) {
    console.error('Error in getCookHistoryForUserRecipe:', err);
    return [];
  }
}
