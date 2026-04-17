// lib/services/highlightsService.ts
// Highlights pill computation for feed cards (Phase 7F Checkpoint 3)
//
// The Highlights pill picks ONE signal per card per viewer.
// Author-side signals: milestones from the cook's history.
// Viewer-side signals: relevance to the viewer (pantry %, cuisine match).
// Per philosophy (c): hybrid of quantitative stats + qualitative context.
//
// IMPORTANT: call via computeHighlightsForFeedBatch from FeedScreen, not
// per-card hooks inside PostCard/MealPostCard. Mirrors the batch-and-prop
// pattern used by getRecipeNutritionBatch in nutritionService.

import { supabase } from '../supabase';
import { calculateBulkPantryMatch } from '../pantryService';
import type { MealWithDetails } from './mealService';

// ============================================================================
// TYPES
// ============================================================================

export interface Highlight {
  text: string;
  /** true for viewer-side (cream tone), false for author-side (teal tone) */
  viewerSide: boolean;
  /** Internal identifier for which signal won (for analytics/debugging) */
  signal: string;
}

export interface FeedHighlightsBatch {
  /** post_id → top highlight (author vs viewer winner already resolved) */
  postHighlights: Map<string, Highlight | null>;
  /** meal_id → top highlight */
  mealHighlights: Map<string, Highlight | null>;
}

interface SoloPostInput {
  id: string;
  user_id: string;
  recipe_id?: string | null;
  created_at: string;
  /**
   * Current total times_cooked for the post's recipe. Used to guard
   * `first_cook` from firing on an OLDER post of a recipe that has since
   * been cooked again — the stats row shows the current total, so the
   * highlights pill must match. Fix Pass 6 / Fix 2.
   */
  times_cooked?: number | null;
}

// ============================================================================
// SESSION CACHE — cleared when viewer changes
// ============================================================================

let cachedViewerId: string | null = null;
const highlightCache = new Map<string, Highlight | null>(); // key: `${id}|${viewerId}|${kind}`

function cacheKey(id: string, viewerId: string, kind: 'solo' | 'meal'): string {
  return `${id}|${viewerId}|${kind}`;
}

function ensureCacheForViewer(viewerId: string) {
  if (cachedViewerId !== viewerId) {
    cachedViewerId = viewerId;
    highlightCache.clear();
  }
}

/** Exported for tests or explicit invalidation */
export function clearHighlightsCache() {
  highlightCache.clear();
  cachedViewerId = null;
}

// ============================================================================
// VIEWER-SIDE: most-cooked cuisine (memoised per viewer)
// ============================================================================

let cachedTopCuisine: { viewerId: string; cuisine: string | null } | null = null;

async function getViewerTopCuisine(viewerId: string): Promise<string | null> {
  if (cachedTopCuisine && cachedTopCuisine.viewerId === viewerId) {
    return cachedTopCuisine.cuisine;
  }

  try {
    // Pull the viewer's cooked dish posts and their recipes' cuisine_types
    const { data: posts } = await supabase
      .from('posts')
      .select('recipe_id')
      .eq('user_id', viewerId)
      .eq('post_type', 'dish')
      .not('recipe_id', 'is', null)
      .limit(500);

    const recipeIds = [...new Set((posts || []).map((p: any) => p.recipe_id))] as string[];
    if (recipeIds.length === 0) {
      cachedTopCuisine = { viewerId, cuisine: null };
      return null;
    }

    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, cuisine_types')
      .in('id', recipeIds);

    const counts = new Map<string, number>();
    const recipeMap = new Map<string, string[]>();
    for (const r of recipes || []) {
      if (Array.isArray((r as any).cuisine_types)) {
        recipeMap.set((r as any).id, (r as any).cuisine_types);
      }
    }

    for (const p of posts || []) {
      const cuisines = recipeMap.get((p as any).recipe_id);
      if (!cuisines) continue;
      for (const c of cuisines) {
        if (!c) continue;
        counts.set(c, (counts.get(c) || 0) + 1);
      }
    }

    let top: string | null = null;
    let topCount = 0;
    for (const [c, n] of counts.entries()) {
      if (n > topCount) {
        top = c;
        topCount = n;
      }
    }

    // Require >= 3 cooks of the cuisine before treating as "usual"
    if (topCount < 3) top = null;

    cachedTopCuisine = { viewerId, cuisine: top };
    return top;
  } catch (err) {
    console.error('Error computing viewer top cuisine:', err);
    cachedTopCuisine = { viewerId, cuisine: null };
    return null;
  }
}

// ============================================================================
// AUTHOR-SIDE: SOLO POST
// ============================================================================

export async function computeHighlightForSoloPost(
  post: SoloPostInput,
  viewerId: string,
  options?: { suppressFirstCook?: boolean }
): Promise<Highlight | null> {
  ensureCacheForViewer(viewerId);
  const key = cacheKey(post.id, viewerId, 'solo');
  if (highlightCache.has(key)) return highlightCache.get(key) ?? null;

  const result = await computeSoloInternal(post, viewerId, options);
  highlightCache.set(key, result);
  return result;
}

async function computeSoloInternal(
  post: SoloPostInput,
  viewerId: string,
  options?: { suppressFirstCook?: boolean }
): Promise<Highlight | null> {
  // Viewer-side FIRST (cross-cutting pick rule: viewer wins when both apply)
  const viewerSignal = await computeViewerSignalForRecipe(post.recipe_id ?? null, viewerId);

  // Author-side
  const authorSignal = post.recipe_id
    ? await computeSoloAuthorSignal(post, options)
    : null;

  if (viewerSignal) return viewerSignal;
  return authorSignal;
}

async function computeSoloAuthorSignal(
  post: SoloPostInput,
  options?: { suppressFirstCook?: boolean }
): Promise<Highlight | null> {
  if (!post.recipe_id) return null;

  try {
    const { data: cookHistory, error } = await supabase
      .from('posts')
      .select('id, created_at')
      .eq('recipe_id', post.recipe_id)
      .eq('user_id', post.user_id)
      .eq('post_type', 'dish')
      .lt('created_at', post.created_at)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const previousCooks = cookHistory || [];

    // first_cook guard: only fire when the recipe's current total is <= 1.
    // The stats row reads `recipes.times_cooked` which reflects the current
    // total across all posts; if we've seen 2+ cooks total, "First time
    // cooking this" is stale and contradicts the stat. Fix Pass 6 / Fix 2.
    const currentTotal = post.times_cooked ?? null;
    const isFirstCookSafe =
      currentTotal === null ? true : currentTotal <= 1;

    if (
      previousCooks.length === 0 &&
      isFirstCookSafe &&
      !options?.suppressFirstCook
    ) {
      return {
        text: 'First time cooking this',
        viewerSide: false,
        signal: 'first_cook',
      };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCooks = previousCooks.filter(
      c => new Date(c.created_at) >= thirtyDaysAgo
    );
    const monthlyCount = recentCooks.length + 1;
    if (monthlyCount >= 3) {
      return {
        text: `Cooked ${monthlyCount}× this month`,
        viewerSide: false,
        signal: 'cooked_n_this_month',
      };
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const yearCooks = previousCooks.filter(
      c => new Date(c.created_at) >= oneYearAgo
    );
    const yearlyCount = yearCooks.length + 1;
    if (yearlyCount >= 5) {
      return {
        text: `Cooked ${yearlyCount}× this year`,
        viewerSide: false,
        signal: 'cooked_n_this_year',
      };
    }

    return null;
  } catch (err) {
    console.error('Error computing solo author signal:', err);
    return null;
  }
}

// ============================================================================
// AUTHOR-SIDE: MEAL POST
// ============================================================================

export async function computeHighlightForMealPost(
  meal: { id: string; user_id: string; created_at: string },
  viewerId: string
): Promise<Highlight | null> {
  ensureCacheForViewer(viewerId);
  const key = cacheKey(meal.id, viewerId, 'meal');
  if (highlightCache.has(key)) return highlightCache.get(key) ?? null;

  const result = await computeMealInternal(meal, viewerId);
  highlightCache.set(key, result);
  return result;
}

async function computeMealInternal(
  meal: { id: string; user_id: string; created_at: string },
  viewerId: string
): Promise<Highlight | null> {
  const viewerSignal = await computeViewerSignalForMeal(meal.id, viewerId);
  const authorSignal = await computeMealAuthorSignal(meal);

  if (viewerSignal) return viewerSignal;
  return authorSignal;
}

async function computeMealAuthorSignal(
  meal: { id: string; user_id: string; created_at: string }
): Promise<Highlight | null> {
  try {
    const hostId = meal.user_id;

    // Gather participants (cooks)
    const { data: participants } = await supabase
      .from('post_participants')
      .select('participant_user_id, role, external_name')
      .eq('post_id', meal.id)
      .in('role', ['host', 'sous_chef'])
      .eq('status', 'approved');

    const cooks = participants || [];

    // Gather dish_courses for this meal (with recipe_id)
    const { data: dishCourses } = await supabase
      .from('dish_courses')
      .select('dish_id')
      .eq('meal_id', meal.id);

    const dishCount = (dishCourses || []).length;

    // Fetch dish posts → recipe_ids for cuisine aggregation
    const dishIds = (dishCourses || []).map((d: any) => d.dish_id);
    let mealRecipeIds: string[] = [];
    if (dishIds.length > 0) {
      const { data: dishPosts } = await supabase
        .from('posts')
        .select('id, recipe_id')
        .in('id', dishIds)
        .not('recipe_id', 'is', null);
      mealRecipeIds = (dishPosts || []).map((d: any) => d.recipe_id);
    }

    // --- Priority 1: cooking_with_new ---
    const coCooks = cooks.filter(c => c.participant_user_id && c.participant_user_id !== hostId);
    for (const coCook of coCooks) {
      // Has host ever cooked with this person before? Check post_participants joined
      // to host's prior meals. Naive: fetch prior meal ids, then check if coCook
      // shows up in any of their participant rows.
      const { data: priorMeals } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', hostId)
        .eq('post_type', 'meal_event')
        .lt('created_at', meal.created_at);

      const priorMealIds = (priorMeals || []).map((m: any) => m.id);
      let cookedTogetherBefore = false;
      if (priorMealIds.length > 0) {
        const { count } = await supabase
          .from('post_participants')
          .select('id', { count: 'exact', head: true })
          .in('post_id', priorMealIds)
          .eq('participant_user_id', coCook.participant_user_id)
          .in('role', ['host', 'sous_chef'])
          .eq('status', 'approved');
        cookedTogetherBefore = (count || 0) > 0;
      }

      if (!cookedTogetherBefore) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('display_name, username')
          .eq('id', coCook.participant_user_id)
          .single();
        const name = profile?.display_name || profile?.username || 'someone new';
        return {
          text: `Cooking with ${name} (new)`,
          viewerSide: false,
          signal: 'cooking_with_new',
        };
      }
    }

    // Fetch host's previous meals once for the remaining milestone checks
    const { data: previousMeals } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', hostId)
      .eq('post_type', 'meal_event')
      .lt('created_at', meal.created_at);

    const previousMealIds = (previousMeals || []).map((m: any) => m.id);

    // --- Priority 2: first_potluck (3+ cooks, host has never done this) ---
    if (cooks.length >= 3) {
      let hadPotluckBefore = false;
      if (previousMealIds.length > 0) {
        // Count cooks per prior meal in a single grouped query (naive: iterate)
        for (const prevId of previousMealIds) {
          const { count: prevCookCount } = await supabase
            .from('post_participants')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', prevId)
            .in('role', ['host', 'sous_chef'])
            .eq('status', 'approved');
          if ((prevCookCount || 0) >= 3) {
            hadPotluckBefore = true;
            break;
          }
        }
      }
      if (!hadPotluckBefore) {
        return {
          text: 'First potluck',
          viewerSide: false,
          signal: 'first_potluck',
        };
      }
    }

    // --- Priority 3: biggest_meal_yet ---
    if (dishCount > 0 && previousMealIds.length > 0) {
      // Batch: fetch dish counts for all previous meals in one query
      const { data: prevDishes } = await supabase
        .from('dish_courses')
        .select('meal_id')
        .in('meal_id', previousMealIds);

      const prevCounts = new Map<string, number>();
      for (const d of prevDishes || []) {
        const id = (d as any).meal_id;
        prevCounts.set(id, (prevCounts.get(id) || 0) + 1);
      }
      let maxPreviousDishes = 0;
      for (const n of prevCounts.values()) {
        if (n > maxPreviousDishes) maxPreviousDishes = n;
      }
      if (dishCount > maxPreviousDishes && maxPreviousDishes > 0) {
        return {
          text: 'Biggest meal yet',
          viewerSide: false,
          signal: 'biggest_meal_yet',
        };
      }
    }

    // --- Priority 4: first_cuisine ---
    if (mealRecipeIds.length > 0) {
      const { data: mealRecipes } = await supabase
        .from('recipes')
        .select('id, cuisine_types')
        .in('id', mealRecipeIds);

      const cuisineCounts = new Map<string, number>();
      for (const r of mealRecipes || []) {
        const tags = (r as any).cuisine_types;
        if (Array.isArray(tags)) {
          for (const c of tags) {
            if (!c) continue;
            cuisineCounts.set(c, (cuisineCounts.get(c) || 0) + 1);
          }
        }
      }

      let dominantCuisine: string | null = null;
      let dominantCount = 0;
      for (const [c, n] of cuisineCounts.entries()) {
        if (n > dominantCount) {
          dominantCuisine = c;
          dominantCount = n;
        }
      }

      if (dominantCuisine && previousMealIds.length > 0) {
        // Check if any prior meal used this cuisine
        const { data: priorDishCourses } = await supabase
          .from('dish_courses')
          .select('dish_id')
          .in('meal_id', previousMealIds);

        const priorDishIds = (priorDishCourses || []).map((d: any) => d.dish_id);
        let priorRecipeIds: string[] = [];
        if (priorDishIds.length > 0) {
          const { data: priorDishPosts } = await supabase
            .from('posts')
            .select('recipe_id')
            .in('id', priorDishIds)
            .not('recipe_id', 'is', null);
          priorRecipeIds = (priorDishPosts || []).map((p: any) => p.recipe_id);
        }

        let cuisineSeenBefore = false;
        if (priorRecipeIds.length > 0) {
          const { data: priorRecipes } = await supabase
            .from('recipes')
            .select('cuisine_types')
            .in('id', priorRecipeIds);
          for (const r of priorRecipes || []) {
            const tags = (r as any).cuisine_types;
            if (Array.isArray(tags) && tags.includes(dominantCuisine)) {
              cuisineSeenBefore = true;
              break;
            }
          }
        } else if (priorDishIds.length === 0) {
          // No prior meals with dishes — treat as first
        }

        if (!cuisineSeenBefore) {
          return {
            text: `First ${dominantCuisine} meal`,
            viewerSide: false,
            signal: 'first_cuisine',
          };
        }
      } else if (dominantCuisine && previousMealIds.length === 0) {
        return {
          text: `First ${dominantCuisine} meal`,
          viewerSide: false,
          signal: 'first_cuisine',
        };
      }
    }

    return null;
  } catch (err) {
    console.error('Error computing meal author signal:', err);
    return null;
  }
}

// ============================================================================
// VIEWER-SIDE SIGNALS
// ============================================================================

async function computeViewerSignalForRecipe(
  recipeId: string | null,
  viewerId: string
): Promise<Highlight | null> {
  if (!recipeId) return null;

  try {
    // Pantry match (wins over cuisine per spec 3.3)
    const pantryMap = await calculateBulkPantryMatch([recipeId], viewerId);
    const pct = pantryMap.get(recipeId) || 0;
    if (pct >= 60) {
      return {
        text: `${pct}% in your pantry`,
        viewerSide: true,
        signal: 'pantry_match',
      };
    }

    // Cuisine match
    const topCuisine = await getViewerTopCuisine(viewerId);
    if (topCuisine) {
      const { data: recipe } = await supabase
        .from('recipes')
        .select('cuisine_types')
        .eq('id', recipeId)
        .single();
      const tags = (recipe as any)?.cuisine_types;
      if (Array.isArray(tags) && tags.includes(topCuisine)) {
        return {
          text: 'Matches your usual cuisine',
          viewerSide: true,
          signal: 'cuisine_match',
        };
      }
    }

    return null;
  } catch (err) {
    console.error('Error computing viewer signal for recipe:', err);
    return null;
  }
}

async function computeViewerSignalForMeal(
  mealId: string,
  viewerId: string
): Promise<Highlight | null> {
  try {
    // Aggregate the meal's recipe_ids via dish_courses → posts
    const { data: dishCourses } = await supabase
      .from('dish_courses')
      .select('dish_id')
      .eq('meal_id', mealId);

    const dishIds = (dishCourses || []).map((d: any) => d.dish_id);
    if (dishIds.length === 0) return null;

    const { data: dishPosts } = await supabase
      .from('posts')
      .select('recipe_id')
      .in('id', dishIds)
      .not('recipe_id', 'is', null);

    const recipeIds = [...new Set((dishPosts || []).map((p: any) => p.recipe_id))] as string[];
    if (recipeIds.length === 0) return null;

    // Pantry match — take the best-matching dish in the meal
    const pantryMap = await calculateBulkPantryMatch(recipeIds, viewerId);
    let bestPct = 0;
    for (const pct of pantryMap.values()) {
      if (pct > bestPct) bestPct = pct;
    }
    if (bestPct >= 60) {
      return {
        text: `${bestPct}% in your pantry`,
        viewerSide: true,
        signal: 'pantry_match',
      };
    }

    // Cuisine match
    const topCuisine = await getViewerTopCuisine(viewerId);
    if (topCuisine) {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('cuisine_types')
        .in('id', recipeIds);
      for (const r of recipes || []) {
        const tags = (r as any).cuisine_types;
        if (Array.isArray(tags) && tags.includes(topCuisine)) {
          return {
            text: 'Matches your usual cuisine',
            viewerSide: true,
            signal: 'cuisine_match',
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.error('Error computing viewer signal for meal:', err);
    return null;
  }
}

// ============================================================================
// BATCH ENTRY POINT — called from FeedScreen.loadFeed
// ============================================================================

/**
 * Compute top highlight for every post + meal in a feed page.
 * Uses the session cache to avoid recomputing across scroll refreshes.
 *
 * Performance note (Phase 7F): viewer top cuisine + bulk pantry match are
 * batched. The meal author-side milestone checks still issue per-meal queries
 * (~4 queries per meal worst case, ~2 when a milestone short-circuits early).
 * For a page of 20 dish posts + 5 meals that works out to roughly:
 *   - 1 bulk pantry query, 1 recipes query (viewer cuisine memo)
 *   - ~20 queries for solo author signals (cook history per recipe)
 *   - ~25 queries for meal author signals (5 meals × ~5 each)
 *   - ~5 queries for meal viewer signals
 *   ≈ 50 queries total per feed load, all fired in parallel per card.
 * This is acceptable for 7F — flagged as follow-up in SESSION_LOG. A SQL-side
 * rollup (materialised view or RPC) is the real fix.
 */
export async function computeHighlightsForFeedBatch(
  posts: SoloPostInput[],
  meals: Pick<MealWithDetails, 'id' | 'user_id' | 'created_at'>[],
  viewerId: string
): Promise<FeedHighlightsBatch> {
  ensureCacheForViewer(viewerId);

  // Warm the top-cuisine memo once
  await getViewerTopCuisine(viewerId);

  const postHighlights = new Map<string, Highlight | null>();
  const mealHighlights = new Map<string, Highlight | null>();

  // Parallel per kind, but cap concurrency implicitly via Promise.all on lists
  // this size (~20 + ~5) — Supabase handles the burst fine.
  await Promise.all([
    ...posts.map(async (p) => {
      const h = await computeHighlightForSoloPost(p, viewerId);
      postHighlights.set(p.id, h);
    }),
    ...meals.map(async (m) => {
      const h = await computeHighlightForMealPost(
        { id: m.id, user_id: m.user_id, created_at: m.created_at },
        viewerId
      );
      mealHighlights.set(m.id, h);
    }),
  ]);

  return { postHighlights, mealHighlights };
}

// ============================================================================
// DETAIL CARD — full lists split author / viewer
// ============================================================================

/**
 * Return every highlight that applies (not just the top one) for the detail
 * card. Author signals and viewer signals are kept in separate arrays per
 * D43/ζ so the detail card can render them in distinct sections.
 *
 * Phase 7F Checkpoint 4 will call this from MealDetailScreen. For now it is
 * wired but not rendered by any surface other than what Checkpoint 4 adds.
 */
export async function computeHighlightsListForDetailCard(
  postOrMealId: string,
  viewerId: string
): Promise<{ author: Highlight[]; viewer: Highlight[] }> {
  try {
    ensureCacheForViewer(viewerId);

    // Detect whether this is a meal or a dish/solo post
    const { data: post } = await supabase
      .from('posts')
      .select('id, user_id, recipe_id, post_type, created_at')
      .eq('id', postOrMealId)
      .single();

    if (!post) return { author: [], viewer: [] };

    const author: Highlight[] = [];
    const viewer: Highlight[] = [];

    if ((post as any).post_type === 'meal_event') {
      const meal = {
        id: (post as any).id,
        user_id: (post as any).user_id,
        created_at: (post as any).created_at,
      };
      const [a, v] = await Promise.all([
        computeMealAuthorSignal(meal),
        computeViewerSignalForMeal(meal.id, viewerId),
      ]);
      if (a) author.push(a);
      if (v) viewer.push(v);
    } else {
      const soloInput: SoloPostInput = {
        id: (post as any).id,
        user_id: (post as any).user_id,
        recipe_id: (post as any).recipe_id,
        created_at: (post as any).created_at,
      };
      const [a, v] = await Promise.all([
        computeSoloAuthorSignal(soloInput),
        computeViewerSignalForRecipe(soloInput.recipe_id ?? null, viewerId),
      ]);
      if (a) author.push(a);
      if (v) viewer.push(v);
    }

    return { author, viewer };
  } catch (err) {
    console.error('Error computing detail-card highlights:', err);
    return { author: [], viewer: [] };
  }
}
