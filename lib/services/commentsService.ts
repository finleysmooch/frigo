// lib/services/commentsService.ts
// Comment attribution model for meals (Phase 7F Checkpoint 3 / D41).
//
// Comments already attach to any post via post_id — the schema supports both
// meal-level and dish-level comments natively. This service surfaces them in
// the shape MealDetailScreen (Checkpoint 4) needs: one list of comments
// written directly on the meal post, plus one list per dish, grouped under
// the dish's title so the reader knows what each comment refers to.

import { supabase } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  user_name?: string;
  avatar_url?: string | null;
  subscription_tier?: string;
}

export interface DishLevelComment extends Comment {
  dish_id: string;
  dish_title: string;
}

export interface CommentsForMeal {
  /** Comments written directly on the meal post */
  mealLevel: Comment[];
  /** Comments written on any dish post belonging to this meal */
  dishLevel: DishLevelComment[];
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Load all comments for a meal, split into meal-level and dish-level.
 *
 * Meal-level: comments where post_id = mealId.
 * Dish-level: for every dish in dish_courses(meal_id = mealId), fetch the
 * dish post's comments and tag each with dish_id + dish_title.
 *
 * Ordered chronologically within each bucket (oldest first).
 */
export async function getCommentsForMeal(mealId: string): Promise<CommentsForMeal> {
  try {
    // 1. Meal-level comments
    const mealLevelRaw = await loadCommentsForPostIds([mealId]);
    const mealLevel = mealLevelRaw.map(c => c); // already Comment-shaped

    // 2. Find the dishes in this meal
    const { data: dishCourses } = await supabase
      .from('dish_courses')
      .select('dish_id')
      .eq('meal_id', mealId);

    const dishIds = (dishCourses || []).map((d: any) => d.dish_id);
    if (dishIds.length === 0) {
      return { mealLevel, dishLevel: [] };
    }

    // 3. Dish titles so we can attach metadata to each comment
    const { data: dishPosts } = await supabase
      .from('posts')
      .select('id, title')
      .in('id', dishIds);

    const dishTitleMap = new Map<string, string>(
      (dishPosts || []).map((p: any) => [p.id, p.title || 'Untitled dish'])
    );

    // 4. Dish-level comments (one query across all dish ids)
    const dishComments = await loadCommentsForPostIds(dishIds);
    const dishLevel: DishLevelComment[] = dishComments.map(c => ({
      ...c,
      dish_id: c.post_id,
      dish_title: dishTitleMap.get(c.post_id) || 'Untitled dish',
    }));

    return { mealLevel, dishLevel };
  } catch (err) {
    console.error('Error loading comments for meal:', err);
    return { mealLevel: [], dishLevel: [] };
  }
}

/**
 * Load comments for a single post (solo dish or any post type). No grouping.
 */
export async function getCommentsForPost(postId: string): Promise<Comment[]> {
  return loadCommentsForPostIds([postId]);
}

/**
 * Count-only helper so feed cards can show "N comments" without hydrating
 * full records. Replaces the inline loadCommentsForPosts query in FeedScreen.
 */
export async function getCommentCountsForPosts(
  postIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of postIds) counts.set(id, 0);

  if (postIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('post_comments')
    .select('post_id')
    .in('post_id', postIds);

  if (error) {
    console.error('Error counting comments:', error);
    return counts;
  }

  for (const row of data || []) {
    const id = (row as any).post_id;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

// ============================================================================
// INTERNALS
// ============================================================================

async function loadCommentsForPostIds(postIds: string[]): Promise<Comment[]> {
  if (postIds.length === 0) return [];

  const { data: rows, error } = await supabase
    .from('post_comments')
    .select('id, post_id, user_id, comment_text, created_at')
    .in('post_id', postIds)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  // Hydrate user profiles in one query
  const userIds = [...new Set(rows.map((r: any) => r.user_id))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, subscription_tier')
    .in('id', userIds);

  const profileMap = new Map(
    (profiles || []).map((p: any) => [p.id, p])
  );

  return rows.map((row: any): Comment => {
    const profile = profileMap.get(row.user_id) as any;
    return {
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      comment_text: row.comment_text,
      created_at: row.created_at,
      user_name: profile?.display_name || profile?.username || 'Someone',
      avatar_url: profile?.avatar_url || null,
      subscription_tier: profile?.subscription_tier || 'free',
    };
  });
}
