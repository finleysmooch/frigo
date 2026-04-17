// lib/types/feed.ts
// Phase 7I Checkpoint 2 — types for the cook-post-centric feed model.
// See docs/PHASE_7I_MASTER_PLAN.md for full context and wireframes L1-L7.
//
// This file establishes `lib/types/` as the home for Phase 7 feed types.
// Note: `PostType` historically lives in `lib/services/postParticipantsService.ts`
// and stays there for now — Checkpoint 7 cleanup may relocate it.

/**
 * CookCardData — the per-cook-post data shape that CookCard consumes.
 * Denormalizes recipe and author fields onto the post so the card can
 * render without follow-up queries. Populated by Checkpoint 4's FeedScreen
 * after it fetches dish posts + their recipe + author joins.
 */
export interface CookCardData {
  // Post fields
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  rating: number | null;
  cooking_method: string | null;
  modifications?: string | null;
  notes?: string | null;
  photos: any[];
  created_at: string;
  cooked_at?: string | null;
  parent_meal_id?: string | null;

  // Recipe fields (denormalized)
  recipe_id?: string | null;
  recipe_title?: string | null;
  recipe_image_url?: string | null;
  recipe_cook_time_min?: number | null;
  recipe_cuisine_types?: string[] | null;
  recipe_vibe_tags?: string[] | null;
  recipe_times_cooked?: number | null;
  /** Cookbook page number for the recipe line on CookDetailScreen (P7-53
   *  deep-linking deferred; this is just for display). */
  recipe_page_number?: number | null;
  /** Chef name for the chef attribution line in CookCard */
  chef_name?: string | null;

  // Author profile
  author: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
    subscription_tier?: string;
  };
}

/**
 * LinkContext — describes why posts in a FeedGroup are linked together.
 *   'cook_partner' → L3b Strava-style indent pair
 *   'meal_event'   → L5 meal event group header with contributor stack
 */
export type LinkContextKind = 'cook_partner' | 'meal_event';

export interface LinkContext {
  kind: LinkContextKind;
  /** Populated only when kind === 'meal_event'. The shared parent_meal_id. */
  mealEventId?: string;
}

/**
 * FeedGroupSubUnit (Checkpoint 3.5) — a nested unit inside a
 * `linked_meal_event` group. Either a single solo sub-section or a
 * shared-recipe merged mini-group. Introduced to support the shared-hero
 * layout for cooks inside a meal event who made the same recipe. See D48.
 */
export interface FeedGroupSubUnit {
  kind: 'solo' | 'shared_recipe';
  posts: CookCardData[]; // 1 for solo, 2+ for shared_recipe
}

/**
 * FeedGroup — a unit in the feed.
 *
 * Three `type` values (Checkpoint 3.5, expanded from 'solo' | 'linked'):
 *   - 'solo'                 → single cook card (may still have a prehead)
 *   - 'linked_meal_event'    → L5 meal-event linked group, may contain
 *                              nested shared-recipe sub-units (see `subUnits`)
 *   - 'linked_shared_recipe' → L3b standalone same-recipe cook-partner pair,
 *                              rendered via SharedRecipeLinkedGroup with a
 *                              linking header at top
 *
 * `subUnits` is only populated for `linked_meal_event` groups whose posts
 * contain at least one shared-recipe cluster. When present, the rendering
 * layer should iterate subUnits instead of `posts` directly.
 */
export interface FeedGroup {
  /** Stable group ID (earliest post ID in the group) for FlatList key stability. */
  id: string;
  type: 'solo' | 'linked_meal_event' | 'linked_shared_recipe';
  /** Flat list of all posts in the group, oldest-first. Always populated for
   *  callers that want to iterate posts without inspecting subUnits. */
  posts: CookCardData[];
  /** When present, the top-level structure of a `linked_meal_event` group.
   *  Each sub-unit is either a solo cook or a shared-recipe merged mini. */
  subUnits?: FeedGroupSubUnit[];
  linkContext?: LinkContext;
}

/**
 * MealEventContext — minimal meal event data for L4 prehead rendering
 * ("Tom's dish at Friday night crew") above a solo cook card.
 * Returned by `getMealEventForCook` in mealService.ts.
 */
export interface MealEventContext {
  id: string;                         // meal_event post ID
  title: string;
  meal_time?: string;
  meal_location?: string;
  host_id: string;
  host_username?: string;
  host_display_name?: string;
  host_avatar_url?: string | null;
  /** Count of distinct cook post authors whose parent_meal_id points here. */
  total_contributor_count: number;
}
