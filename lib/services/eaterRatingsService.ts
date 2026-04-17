// lib/services/eaterRatingsService.ts
// Phase 7I Checkpoint 6 — D43 private per-eater dish ratings.
//
// Two exports:
//   - getEaterRatingsForMeal: returns Map<postId, rating> for the viewer's
//     ratings on dishes linked to a meal event
//   - upsertEaterRating: writes or deletes a single rating
//
// RLS enforces D43 visibility (rater + post author can read; only rater
// can write). The service is intentionally thin — no caching, no extra
// validation beyond what the DB constraints already enforce.

import { supabase } from '../supabase';

/**
 * Get all of the viewer's eater ratings for dishes linked to a meal event.
 * Returns a Map<dishPostId, rating>. Unrated dishes are simply absent.
 *
 * Two round trips: dish post IDs → ratings for those IDs.
 */
export async function getEaterRatingsForMeal(
  mealEventId: string,
  viewerUserId: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  const { data: dishPosts, error: dishErr } = await supabase
    .from('posts')
    .select('id')
    .eq('parent_meal_id', mealEventId)
    .eq('post_type', 'dish');

  if (dishErr || !dishPosts || dishPosts.length === 0) return map;

  const dishPostIds = dishPosts.map((p: any) => p.id);

  const { data: ratings, error: ratingErr } = await supabase
    .from('eater_ratings')
    .select('post_id, rating')
    .eq('rater_user_id', viewerUserId)
    .in('post_id', dishPostIds);

  if (ratingErr || !ratings) return map;

  ratings.forEach((r: any) => map.set(r.post_id, r.rating));
  return map;
}

/**
 * Upsert an eater rating for a single dish post.
 * Pass `rating = null` to delete the viewer's rating for that dish.
 */
export async function upsertEaterRating(
  postId: string,
  raterUserId: string,
  rating: number | null
): Promise<void> {
  if (rating === null) {
    const { error } = await supabase
      .from('eater_ratings')
      .delete()
      .eq('post_id', postId)
      .eq('rater_user_id', raterUserId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('eater_ratings')
    .upsert(
      {
        post_id: postId,
        rater_user_id: raterUserId,
        rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'post_id,rater_user_id' }
    );
  if (error) throw error;
}
