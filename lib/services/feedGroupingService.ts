// lib/services/feedGroupingService.ts
// Service for grouping linked posts in the feed (Strava-style)
// Created: November 20, 2025
// Phase 7I Checkpoint 2 (2026-04-13): added `buildFeedGroups` for the
// cook-post-centric feed model. The old `groupPostsForFeed` and its
// `GroupedPost`/`SinglePost`/`FeedItem` types are kept in place for
// backward compat until Checkpoint 7 deletes them. The DFS union-find
// primitive (`groupConnectedPosts`) is still used by both entry points.

import { supabase } from '../supabase';
import type {
  CookCardData,
  FeedGroup,
  FeedGroupSubUnit,
  LinkContext,
} from '../types/feed';
import { getLinkedCookPartnersForPosts } from './postParticipantsService';

export interface GroupedPost {
  type: 'grouped';
  id: string; // Use the earliest post ID as the group ID
  mainPost: any;
  linkedPosts: any[];
  relationshipType: 'dish_pair' | 'meal_group';
}

export interface SinglePost {
  type: 'single';
  post: any;
}

export type FeedItem = GroupedPost | SinglePost;

/**
 * Get all post relationships for a set of posts
 */
async function getPostRelationships(postIds: string[]): Promise<Map<string, Set<string>>> {
  try {
    const { data, error } = await supabase
      .from('post_relationships')
      .select('post_id_1, post_id_2, relationship_type')
      .or(`post_id_1.in.(${postIds.join(',')}),post_id_2.in.(${postIds.join(',')})`);

    if (error) throw error;

    // Build a map of post_id -> set of related post_ids
    const relationshipsMap = new Map<string, Set<string>>();
    
    data?.forEach(rel => {
      // Add bidirectional relationships
      if (!relationshipsMap.has(rel.post_id_1)) {
        relationshipsMap.set(rel.post_id_1, new Set());
      }
      if (!relationshipsMap.has(rel.post_id_2)) {
        relationshipsMap.set(rel.post_id_2, new Set());
      }
      
      relationshipsMap.get(rel.post_id_1)!.add(rel.post_id_2);
      relationshipsMap.get(rel.post_id_2)!.add(rel.post_id_1);
    });

    return relationshipsMap;
  } catch (error) {
    console.error('Error getting post relationships:', error);
    return new Map();
  }
}

/**
 * Group connected posts together using Union-Find algorithm
 */
function groupConnectedPosts(
  posts: any[],
  relationshipsMap: Map<string, Set<string>>
): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();
  const visited = new Set<string>();

  function dfs(postId: string, currentGroup: Set<string>) {
    if (visited.has(postId)) return;
    visited.add(postId);
    currentGroup.add(postId);

    const relatedPosts = relationshipsMap.get(postId);
    if (relatedPosts) {
      relatedPosts.forEach(relatedId => {
        if (!visited.has(relatedId)) {
          dfs(relatedId, currentGroup);
        }
      });
    }
  }

  posts.forEach(post => {
    if (!visited.has(post.id)) {
      const group = new Set<string>();
      dfs(post.id, group);
      
      if (group.size > 1) {
        // Use the earliest post ID as the group key
        const sortedIds = Array.from(group).sort();
        groups.set(sortedIds[0], group);
      }
    }
  });

  return groups;
}

/**
 * Transform a list of posts into feed items (grouped and single)
 */
export async function groupPostsForFeed(posts: any[]): Promise<FeedItem[]> {
  if (posts.length === 0) return [];

  const postIds = posts.map(p => p.id);
  const relationshipsMap = await getPostRelationships(postIds);

  // Group connected posts
  const groups = groupConnectedPosts(posts, relationshipsMap);

  // Create a map for quick post lookup
  const postMap = new Map(posts.map(p => [p.id, p]));

  // Track which posts are already in groups
  const postsInGroups = new Set<string>();

  // Create feed items
  const feedItems: FeedItem[] = [];

  // Add grouped posts
  groups.forEach((postIds, groupId) => {
    const postIdArray = Array.from(postIds);
    const groupPosts = postIdArray
      .map(id => postMap.get(id))
      .filter(Boolean)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (groupPosts.length > 1) {
      const [mainPost, ...linkedPosts] = groupPosts;
      
      feedItems.push({
        type: 'grouped',
        id: groupId,
        mainPost,
        linkedPosts,
        relationshipType: 'dish_pair', // Could be enhanced to detect type
      });

      postIdArray.forEach(id => postsInGroups.add(id));
    }
  });

  // Add single posts (not in any group)
  posts.forEach(post => {
    if (!postsInGroups.has(post.id)) {
      feedItems.push({
        type: 'single',
        post,
      });
    }
  });

  // Sort all feed items by creation date (use mainPost date for groups)
  feedItems.sort((a, b) => {
    const dateA = a.type === 'grouped' 
      ? new Date(a.mainPost.created_at).getTime()
      : new Date(a.post.created_at).getTime();
    const dateB = b.type === 'grouped'
      ? new Date(b.mainPost.created_at).getTime()
      : new Date(b.post.created_at).getTime();
    return dateB - dateA; // Newest first
  });

  return feedItems;
}

// ============================================================================
// PHASE 7I CHECKPOINT 2 — buildFeedGroups (cook-post-centric grouping)
// ============================================================================

/**
 * Build feed groups from a flat list of cook posts. Each returned group is
 * either a solo cook card (`type: 'solo'`, 1 post) or a linked stack of
 * 2+ posts (`type: 'linked'`) that share either a cook partner relationship
 * or a meal event.
 *
 * Uses the same DFS union-find pattern as the old `groupPostsForFeed` but
 * with different edge sources: `getLinkedCookPartnersForPosts` (cook partner
 * reciprocal tagging) and `parent_meal_id` grouping (meal event membership).
 *
 * Rule C visibility: a linked group only forms when ≥2 posts in the
 * connected component are visible to the viewer. If only 1 is visible, the
 * group degrades to a solo group containing just that post. Invisible posts
 * are dropped. This mirrors the L3b/L3a split in the 7I wireframes.
 *
 * Sort order:
 *   - Within each group: posts ordered oldest-first (narrative / wireframe).
 *   - Across groups: groups ordered newest-first by the max created_at of
 *     posts in the group.
 *
 * Perf: one round-trip via `getLinkedCookPartnersForPosts` regardless of
 * input size. Meal event edges are computed from in-memory `parent_meal_id`
 * with no extra queries.
 */
export async function buildFeedGroups(
  posts: CookCardData[],
  currentUserId: string,
  followingIds: string[]
): Promise<FeedGroup[]> {
  if (posts.length === 0) return [];

  const postById = new Map(posts.map(p => [p.id, p]));
  const followingSet = new Set(followingIds);

  // ── Step 1: Gather cook-partner edges (one batched round-trip) ─────────
  const partnerMap = await getLinkedCookPartnersForPosts(
    posts.map(p => ({
      id: p.id,
      user_id: p.user_id,
      created_at: p.created_at,
    })),
    followingIds
  );

  // ── Step 2: Gather meal-event edges (in-memory from parent_meal_id) ────
  // Posts sharing a non-null parent_meal_id are all connected via that
  // meal event. Record the mealEventId per post so we can classify groups
  // later.
  const mealEventBuckets = new Map<string, string[]>(); // parent_meal_id → post_ids
  const mealEventByPost = new Map<string, string>();    // post_id → parent_meal_id
  for (const p of posts) {
    if (!p.parent_meal_id) continue;
    mealEventByPost.set(p.id, p.parent_meal_id);
    let bucket = mealEventBuckets.get(p.parent_meal_id);
    if (!bucket) {
      bucket = [];
      mealEventBuckets.set(p.parent_meal_id, bucket);
    }
    bucket.push(p.id);
  }

  // ── Step 3: Build combined adjacency map ───────────────────────────────
  // Edge kinds: 'cook_partner' and 'meal_event'. Track which kind produced
  // each edge so we can classify the resulting group's linkContext.
  const adjacency = new Map<string, Set<string>>();
  const edgeKinds = new Map<string, 'cook_partner' | 'meal_event'>();

  const addEdge = (
    a: string,
    b: string,
    kind: 'cook_partner' | 'meal_event'
  ) => {
    if (a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
    const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`;
    // If an edge already recorded as meal_event, don't downgrade it to
    // cook_partner. Otherwise record whichever came first.
    if (!edgeKinds.has(edgeKey) || kind === 'meal_event') {
      edgeKinds.set(edgeKey, kind);
    }
  };

  // Cook-partner edges from the batched partner map.
  for (const [postId, partners] of partnerMap) {
    for (const partner of partners) {
      if (postById.has(partner.post_id)) {
        addEdge(postId, partner.post_id, 'cook_partner');
      }
    }
  }

  // Meal-event edges: every pair of posts in the same bucket is connected.
  for (const [, bucket] of mealEventBuckets) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        addEdge(bucket[i], bucket[j], 'meal_event');
      }
    }
  }

  // ── Step 4: DFS to find connected components ──────────────────────────
  const visited = new Set<string>();
  const components: string[][] = [];

  const dfs = (startId: string, comp: string[]) => {
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      comp.push(id);
      const neighbors = adjacency.get(id);
      if (neighbors) {
        neighbors.forEach(n => {
          if (!visited.has(n)) stack.push(n);
        });
      }
    }
  };

  for (const post of posts) {
    if (!visited.has(post.id)) {
      const comp: string[] = [];
      dfs(post.id, comp);
      components.push(comp);
    }
  }

  // ── Step 5: Apply Rule C visibility and classify each component ────────
  //
  // Checkpoint 3.5 classification (replaces the simple solo/linked split):
  //
  //   Component size 1                                   → 'solo'
  //   Size 2+, meal_event edge present                   → 'linked_meal_event'
  //     (compute subUnits: posts grouped by recipe_id;
  //      shared recipe_id → shared_recipe sub-unit,
  //      unique/null recipe_id → its own solo sub-unit)
  //   Size 2+, cook_partner edges only, all share recipe → 'linked_shared_recipe'
  //   Size 2+, cook_partner edges only, mixed recipes    → degrade to N solos
  //     (P7-68 deferred — different-recipe L3b is unsupported as a linked group)
  //
  const isVisible = (postId: string): boolean => {
    const p = postById.get(postId);
    if (!p) return false;
    if (p.user_id === currentUserId) return true;
    if (followingSet.has(p.user_id)) return true;
    // FeedScreen pre-filters by visibility, so anything reaching this
    // function that isn't own or followed is treated as viewable.
    return true;
  };

  const groups: FeedGroup[] = [];
  let p7_68_degradedCount = 0; // for dry-run / telemetry logging

  for (const comp of components) {
    const visiblePostIds = comp.filter(isVisible);
    if (visiblePostIds.length === 0) continue; // drop entirely

    const visiblePosts = visiblePostIds
      .map(id => postById.get(id)!)
      .filter(Boolean);

    // Rule C: 0 or 1 visible → solo. Also handles size-1 components.
    if (visiblePosts.length === 1 || comp.length === 1) {
      const only = visiblePosts[0];
      groups.push({
        id: only.id,
        type: 'solo',
        posts: [only],
      });
      continue;
    }

    // Sort within-group posts oldest-first for narrative order.
    // Phase 7G: use cooked_at for timeline position (when the cook
    // actually happened) with a created_at fallback for any legacy post
    // where cooked_at is null.
    const dateKey = (p: CookCardData) =>
      new Date(p.cooked_at ?? p.created_at).getTime();
    const sortedPosts = [...visiblePosts].sort(
      (a, b) => dateKey(a) - dateKey(b)
    );

    // Detect whether any edge in this component is a meal_event edge
    let hasMealEventEdge = false;
    let sharedMealEventId: string | undefined;
    for (let i = 0; i < visiblePostIds.length && !hasMealEventEdge; i++) {
      for (let j = i + 1; j < visiblePostIds.length; j++) {
        const a = visiblePostIds[i];
        const b = visiblePostIds[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (edgeKinds.get(key) === 'meal_event') {
          hasMealEventEdge = true;
          const mid = mealEventByPost.get(a) || mealEventByPost.get(b);
          if (mid) sharedMealEventId = mid;
          break;
        }
      }
    }
    // Fallback: if all visible posts share one parent_meal_id, use it
    if (hasMealEventEdge && !sharedMealEventId) {
      const candidate = mealEventByPost.get(visiblePostIds[0]);
      if (
        candidate &&
        visiblePostIds.every(pid => mealEventByPost.get(pid) === candidate)
      ) {
        sharedMealEventId = candidate;
      }
    }

    if (hasMealEventEdge) {
      // linked_meal_event — compute subUnits
      const subUnits = buildSubUnits(sortedPosts);
      const linkContext: LinkContext = {
        kind: 'meal_event',
        ...(sharedMealEventId ? { mealEventId: sharedMealEventId } : {}),
      };
      groups.push({
        id: sortedPosts[0].id,
        type: 'linked_meal_event',
        posts: sortedPosts,
        subUnits,
        linkContext,
      });
      continue;
    }

    // No meal_event edge: cook_partner-only component.
    // Merge only when all posts share the same recipe_id (non-null).
    const firstRecipeId = sortedPosts[0].recipe_id;
    const allShareRecipe =
      !!firstRecipeId &&
      sortedPosts.every(p => p.recipe_id === firstRecipeId);

    if (allShareRecipe) {
      const linkContext: LinkContext = { kind: 'cook_partner' };
      groups.push({
        id: sortedPosts[0].id,
        type: 'linked_shared_recipe',
        posts: sortedPosts,
        linkContext,
      });
      continue;
    }

    // P7-68 degradation: mixed-recipe cook-partner component → emit each
    // visible post as its own solo group. Loses the "cooked together"
    // signal but prevents rendering a half-broken shared layout.
    for (const post of sortedPosts) {
      p7_68_degradedCount++;
      groups.push({
        id: post.id,
        type: 'solo',
        posts: [post],
      });
    }
  }

  if (p7_68_degradedCount > 0) {
    // Dev-time observability. Does not fail the build.
    console.log(
      `[buildFeedGroups] P7-68 degradation: ${p7_68_degradedCount} posts emitted as solo because their cook-partner component had mixed recipe_ids.`
    );
  }

  // ── Step 6: Sort groups newest-first by max(cooked_at) in each group ──
  // Phase 7G: cook-time drives feed ordering, not publish-time. A cook
  // backdated to last week sorts into its chronological slot, not above
  // today's posts. Fall back to created_at for legacy rows with null
  // cooked_at.
  groups.sort((a, b) => {
    const keyOf = (p: CookCardData) =>
      new Date(p.cooked_at ?? p.created_at).getTime();
    const aMax = Math.max(...a.posts.map(keyOf));
    const bMax = Math.max(...b.posts.map(keyOf));
    return bMax - aMax;
  });

  return groups;
}

// ============================================================================
// Sub-unit construction for linked_meal_event groups (Checkpoint 3.5)
// ============================================================================

/**
 * Group meal-event posts into sub-units. Posts sharing a non-null recipe_id
 * within the meal event form a `shared_recipe` sub-unit. Posts with a unique
 * recipe_id (only one post has it) or null recipe_id each form their own
 * `solo` sub-unit.
 *
 * Ordering: sub-units are sorted by the earliest created_at of the posts
 * within each sub-unit, ascending. Ties (identical earliest timestamps) fall
 * back to sub-unit kind order (solo before shared_recipe) then to post id
 * string compare — deterministic but arbitrary.
 */
function buildSubUnits(sortedPosts: CookCardData[]): FeedGroupSubUnit[] {
  // Bucket posts by non-null recipe_id. Null-recipe posts each get their own
  // "null-<id>" bucket so they stay solo.
  const buckets = new Map<string, CookCardData[]>();
  for (const post of sortedPosts) {
    const key =
      post.recipe_id && post.recipe_id.length > 0
        ? `recipe:${post.recipe_id}`
        : `null:${post.id}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(post);
  }

  const subUnits: FeedGroupSubUnit[] = [];
  for (const [, bucketPosts] of buckets) {
    if (bucketPosts.length === 1) {
      subUnits.push({ kind: 'solo', posts: [bucketPosts[0]] });
    } else {
      // 2+ posts with the same recipe_id inside a meal event → shared_recipe
      // sub-unit. The meal event context establishes "they were together";
      // explicit sous_chef tagging is not required.
      subUnits.push({ kind: 'shared_recipe', posts: bucketPosts });
    }
  }

  // Sort by earliest cooked_at in each sub-unit (Phase 7G), with the
  // created_at fallback for legacy rows.
  const keyOf = (p: CookCardData) =>
    new Date(p.cooked_at ?? p.created_at).getTime();
  subUnits.sort((a, b) => {
    const aEarliest = Math.min(...a.posts.map(keyOf));
    const bEarliest = Math.min(...b.posts.map(keyOf));
    if (aEarliest !== bEarliest) return aEarliest - bEarliest;
    // Tie-breaker: solo before shared_recipe, then post id
    if (a.kind !== b.kind) return a.kind === 'solo' ? -1 : 1;
    return a.posts[0].id.localeCompare(b.posts[0].id);
  });

  return subUnits;
}

/**
 * Check if a specific post is part of a group
 */
export async function isPostInGroup(postId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('post_relationships')
      .select('id')
      .or(`post_id_1.eq.${postId},post_id_2.eq.${postId}`)
      .limit(1)
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
}