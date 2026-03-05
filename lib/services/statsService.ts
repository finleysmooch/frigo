// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// lib/services/statsService.ts
// Stats dashboard data layer — all query functions.
// All queries follow the services-only pattern: components never call Supabase directly.
// Uses cooked_at (not created_at) for all time queries.

import { supabase } from '../supabase';

// ── Types ────────────────────────────────────────────────────────

export type StatsPeriod = '12w' | '6m' | '1y';
export type MealTypeFilter = 'all' | 'dinner' | 'lunch' | 'breakfast' | 'dessert' | 'meal_prep';

export interface DateRange {
  start: string;   // ISO datetime
  end: string;     // ISO datetime
}

export interface StatsParams {
  userId: string;
  dateRange: DateRange;
  mealType: MealTypeFilter;
}

export interface WeekDot {
  day: string;        // ISO date string (YYYY-MM-DD)
  hasMeal: boolean;
  mealId?: string;    // post id if there was a meal
  recipeId?: string;  // recipe id for navigation
  emoji?: string;       // cooking concept emoji, e.g. "🥗"
  recipeName?: string;  // for tooltip/accessibility
}

export interface CookingStreak {
  current: number;    // consecutive weeks with ≥1 cook
  best: number;
}

export interface WeeklyFrequency {
  week: string;       // ISO week start date (YYYY-MM-DD)
  count: number;
  caloriesAvg?: number;    // avg cal_per_serving for recipes cooked that week
  proteinAvg?: number;     // avg protein_per_serving_g
  vegPct?: number;         // % of posts that week where recipe is_vegetarian = true
  newCount?: number;       // # recipes cooked for the FIRST TIME that week
  repeatCount?: number;    // # recipes cooked that were cooked in a prior week
}

export interface OverviewStats {
  totalCooks: number;
  uniqueRecipes: number;
  avgRating: number | null;
  avgCalories: number;
  totalTimeHours: number;
  newRecipesThisWeek: number;
}

export interface HowYouCook {
  fromRecipe: number;   // cooked from recipe without modifications
  modified: number;     // cooked from recipe with modifications
  freeform: number;     // no recipe_id (freeform post)
}

export interface CookingPartner {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  count: number;
}

export interface NewVsRepeat {
  newPct: number;
  repeatPct: number;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Compute a rolling date range window from a period and offset */
export function computeDateRange(period: StatsPeriod, offset: number = 0): DateRange {
  const windowDays: Record<StatsPeriod, number> = { '12w': 84, '6m': 182, '1y': 365 };
  const days = windowDays[period];
  const now = new Date();

  // End of window: shift back by offset * window size
  const end = new Date(now);
  end.setDate(end.getDate() - offset * days);

  // Start of window: shift back by one window from end
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  return { start: start.toISOString(), end: end.toISOString() };
}

/** Base query builder: filters posts by user, post_type=dish, and optional meal_type */
function basePostsQuery(userId: string, mealType: MealTypeFilter) {
  let query = supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .eq('post_type', 'dish');
  if (mealType !== 'all') {
    query = query.eq('meal_type', mealType);
  }
  return query;
}

/** Apply date range filter to a query (uses cooked_at) — applies BOTH bounds */
function applyDateRangeFilter(query: any, dateRange: DateRange) {
  query = query.gte('cooked_at', dateRange.start);
  query = query.lte('cooked_at', dateRange.end);
  return query;
}

/** Format date as YYYY-MM-DD */
function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Get Monday of a given date's week */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Concept Emoji Map ────────────────────────────────────────────

export const CONCEPT_EMOJI_MAP: Record<string, string> = {
  salad: '🥗', soup: '🍲', pasta: '🍝', roast: '🍖', stew: '🫕',
  cake: '🎂', bread: '🍞', grill: '🔥', sauté: '🍳', curry: '🍛',
  taco: '🌮', sandwich: '🥪', pizza: '🍕', stir_fry: '🥘',
  composed_plate: '🍽️', braise: '🥘', pilaf: '🍚', risotto: '🍚',
  fritter: '🧆', dumpling: '🥟', smoothie: '🥤', bake: '🥧',
};
export const DEFAULT_COOK_EMOJI = '👨‍🍳';

// ── Overview Functions ───────────────────────────────────────────

/**
 * Get 7 dots for the current week (Mon-Sun), showing which days had meals.
 * Each dot includes the post ID if a meal was cooked that day.
 */
export async function getWeekDots(
  userId: string,
  weekStart?: Date
): Promise<WeekDot[]> {
  const monday = weekStart ? getMondayOfWeek(weekStart) : getMondayOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const { data, error } = await supabase
    .from('posts')
    .select('id, cooked_at, recipe_id')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .gte('cooked_at', monday.toISOString())
    .lt('cooked_at', sunday.toISOString())
    .order('cooked_at', { ascending: true });

  if (error) {
    console.error('Error fetching week dots:', error);
    return [];
  }

  const posts = data || [];

  // Fetch recipe details (cooking_concept, title) for posts with recipe_id
  const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
  let recipeMap = new Map<string, { cooking_concept: string | null; title: string }>();
  if (recipeIds.length > 0) {
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, cooking_concept, title')
      .in('id', recipeIds);
    for (const r of recipes || []) {
      recipeMap.set(r.id, { cooking_concept: r.cooking_concept, title: r.title });
    }
  }

  // Build a map of date → first post info
  const dayMap = new Map<string, { id: string; recipe_id: string | null }>();
  for (const row of posts) {
    const dayStr = new Date(row.cooked_at).toISOString().split('T')[0];
    if (!dayMap.has(dayStr)) {
      dayMap.set(dayStr, { id: row.id, recipe_id: row.recipe_id });
    }
  }

  // Generate 7 dots (Mon-Sun)
  const dots: WeekDot[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dayStr = toDateStr(d);
    const dayInfo = dayMap.get(dayStr);

    let emoji: string | undefined;
    let recipeName: string | undefined;
    if (dayInfo?.recipe_id) {
      const recipe = recipeMap.get(dayInfo.recipe_id);
      if (recipe) {
        recipeName = recipe.title;
        const concept = recipe.cooking_concept?.toLowerCase();
        emoji = concept ? (CONCEPT_EMOJI_MAP[concept] || DEFAULT_COOK_EMOJI) : DEFAULT_COOK_EMOJI;
      }
    } else if (dayInfo) {
      emoji = DEFAULT_COOK_EMOJI; // freeform post
    }

    dots.push({
      day: dayStr,
      hasMeal: !!dayInfo,
      mealId: dayInfo?.id,
      recipeId: dayInfo?.recipe_id ?? undefined,
      emoji,
      recipeName,
    });
  }

  return dots;
}

// ── Week Stats ───────────────────────────────────────────────────

export interface WeekStats {
  meals: number;
  uniqueRecipes: number;
  calAvg: number;
  newRecipes: number;
}

/**
 * Stats for a given week AND the prior week, for delta comparison.
 * "New recipe" = recipe not cooked in ANY prior post (globally, not just prior to dateRange).
 */
export async function getWeekStats(
  userId: string,
  weekStart: Date,
  mealType: MealTypeFilter
): Promise<{ current: WeekStats; prior: WeekStats }> {
  const monday = getMondayOfWeek(weekStart);
  const priorMonday = new Date(monday);
  priorMonday.setDate(priorMonday.getDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const priorEnd = monday; // prior week ends at current week's Monday

  // Fetch posts for both weeks in parallel, plus all-time posts for "new" detection
  let currentQuery = supabase
    .from('posts')
    .select('id, recipe_id')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .gte('cooked_at', monday.toISOString())
    .lt('cooked_at', nextMonday.toISOString());
  if (mealType !== 'all') currentQuery = currentQuery.eq('meal_type', mealType);

  let priorQuery = supabase
    .from('posts')
    .select('id, recipe_id')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .gte('cooked_at', priorMonday.toISOString())
    .lt('cooked_at', priorEnd.toISOString());
  if (mealType !== 'all') priorQuery = priorQuery.eq('meal_type', mealType);

  // All-time recipe posts for new recipe detection
  const allTimeQuery = supabase
    .from('posts')
    .select('recipe_id, cooked_at')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null)
    .order('cooked_at', { ascending: true });

  const [currentRes, priorRes, allTimeRes] = await Promise.all([
    currentQuery, priorQuery, allTimeQuery,
  ]);

  const currentPosts = currentRes.data || [];
  const priorPosts = priorRes.data || [];
  const allTimePosts = allTimeRes.data || [];

  // Build first-cook-date map (globally)
  const firstCookDate = new Map<string, string>();
  for (const p of allTimePosts) {
    if (!firstCookDate.has(p.recipe_id)) {
      firstCookDate.set(p.recipe_id, p.cooked_at);
    }
  }

  // Helper to compute WeekStats for a set of posts within a week boundary
  async function computeWeekStats(posts: any[], weekMonday: Date): Promise<WeekStats> {
    const meals = posts.length;
    const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
    const uniqueRecipes = recipeIds.length;

    // Average calories
    let calAvg = 0;
    if (recipeIds.length > 0) {
      const { data: nutr } = await supabase
        .from('recipe_nutrition_computed')
        .select('recipe_id, cal_per_serving')
        .in('recipe_id', recipeIds);
      if (nutr && nutr.length > 0) {
        const nutrMap = new Map(nutr.map(n => [n.recipe_id, n.cal_per_serving ?? 0]));
        let total = 0, count = 0;
        for (const p of posts) {
          if (p.recipe_id && nutrMap.has(p.recipe_id)) {
            total += nutrMap.get(p.recipe_id)!;
            count++;
          }
        }
        if (count > 0) calAvg = Math.round(total / count);
      }
    }

    // New recipes: first cook date falls within this week
    const weekEnd = new Date(weekMonday);
    weekEnd.setDate(weekEnd.getDate() + 7);
    let newRecipes = 0;
    for (const rid of recipeIds) {
      const firstDate = firstCookDate.get(rid);
      if (firstDate && firstDate >= weekMonday.toISOString() && firstDate < weekEnd.toISOString()) {
        newRecipes++;
      }
    }

    return { meals, uniqueRecipes, calAvg, newRecipes };
  }

  const [current, prior] = await Promise.all([
    computeWeekStats(currentPosts, monday),
    computeWeekStats(priorPosts, priorMonday),
  ]);

  return { current, prior };
}

/**
 * Count consecutive weeks with ≥1 cook (current streak and best streak).
 * Weeks are ISO weeks starting Monday.
 */
export async function getCookingStreak(userId: string): Promise<CookingStreak> {
  const { data, error } = await supabase
    .from('posts')
    .select('cooked_at')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .order('cooked_at', { ascending: false });

  if (error) {
    console.error('Error fetching cooking streak:', error);
    return { current: 0, best: 0 };
  }

  if (!data || data.length === 0) {
    return { current: 0, best: 0 };
  }

  // Get distinct weeks (Monday-based) sorted descending
  const weekSet = new Set<string>();
  for (const row of data) {
    const monday = getMondayOfWeek(new Date(row.cooked_at));
    weekSet.add(toDateStr(monday));
  }

  const weeks = [...weekSet].sort().reverse(); // most recent first

  if (weeks.length === 0) return { current: 0, best: 0 };

  // Check if current/most recent week is this week or last week
  const thisMonday = getMondayOfWeek(new Date());
  const thisMondayStr = toDateStr(thisMonday);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastMondayStr = toDateStr(lastMonday);

  // Calculate streaks by walking consecutive weeks
  let currentStreak = 0;
  let bestStreak = 0;
  let streak = 1;

  // Current streak: only counts if most recent cook is this week or last week
  const mostRecentWeek = weeks[0];
  const isCurrent = mostRecentWeek === thisMondayStr || mostRecentWeek === lastMondayStr;

  for (let i = 1; i < weeks.length; i++) {
    const prevWeek = new Date(weeks[i - 1]);
    const thisWeek = new Date(weeks[i]);
    const diffDays = (prevWeek.getTime() - thisWeek.getTime()) / (1000 * 60 * 60 * 24);

    if (Math.abs(diffDays - 7) < 1) {
      streak++;
    } else {
      if (i === 1 || (i > 1 && currentStreak === 0 && isCurrent)) {
        // This was potentially the current streak
      }
      bestStreak = Math.max(bestStreak, streak);
      if (currentStreak === 0 && isCurrent) {
        currentStreak = streak;
      }
      streak = 1;
    }
  }

  bestStreak = Math.max(bestStreak, streak);
  if (currentStreak === 0 && isCurrent) {
    currentStreak = streak;
  }

  return { current: currentStreak, best: bestStreak };
}

/**
 * Get cook counts per ISO week for the line chart.
 * Fetches ALL data (no date range filter) — caller slices to fit the window.
 * Fills gaps from first data point to today.
 */
export async function getWeeklyFrequency(
  userId: string,
  mealType: MealTypeFilter = 'all'
): Promise<WeeklyFrequency[]> {
  let query = supabase
    .from('posts')
    .select('cooked_at, recipe_id')
    .eq('user_id', userId)
    .eq('post_type', 'dish');

  if (mealType !== 'all') query = query.eq('meal_type', mealType);
  query = query.order('cooked_at', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching weekly frequency:', error);
    return [];
  }

  const posts = data || [];

  // Collect unique recipe_ids and fetch nutrition in a single query
  const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
  let nutrMap = new Map<string, { cal: number; protein: number; isVeg: boolean }>();
  if (recipeIds.length > 0) {
    const { data: nutr } = await supabase
      .from('recipe_nutrition_computed')
      .select('recipe_id, cal_per_serving, protein_per_serving_g, is_vegetarian')
      .in('recipe_id', recipeIds);
    for (const n of nutr || []) {
      nutrMap.set(n.recipe_id, {
        cal: n.cal_per_serving ?? 0,
        protein: n.protein_per_serving_g ?? 0,
        isVeg: !!n.is_vegetarian,
      });
    }
  }

  // Group posts by week
  const weekPosts = new Map<string, typeof posts>();
  for (const row of posts) {
    const monday = getMondayOfWeek(new Date(row.cooked_at));
    const key = toDateStr(monday);
    const arr = weekPosts.get(key) || [];
    arr.push(row);
    weekPosts.set(key, arr);
  }

  // Track seen recipe_ids chronologically for new vs repeat
  const seenRecipeIds = new Set<string>();

  // Fill gaps between first and last week
  const sortedWeeks = [...weekPosts.keys()].sort();
  if (sortedWeeks.length === 0) return [];
  const result: WeeklyFrequency[] = [];
  const cursor = new Date(sortedWeeks[0] + 'T00:00:00');
  const endDate = getMondayOfWeek(new Date());
  while (cursor <= endDate) {
    const key = toDateStr(cursor);
    const wp = weekPosts.get(key) || [];
    const count = wp.length;

    // Compute nutrition averages for this week
    let calTotal = 0, protTotal = 0, calCount = 0, vegCount = 0, nutrCount = 0;
    let newCount = 0, repeatCount = 0;

    for (const p of wp) {
      if (p.recipe_id) {
        const n = nutrMap.get(p.recipe_id);
        if (n) {
          calTotal += n.cal;
          protTotal += n.protein;
          if (n.isVeg) vegCount++;
          nutrCount++;
        }
        // New vs repeat: first appearance = new
        if (seenRecipeIds.has(p.recipe_id)) {
          repeatCount++;
        } else {
          newCount++;
          seenRecipeIds.add(p.recipe_id);
        }
      }
    }

    result.push({
      week: key,
      count,
      caloriesAvg: nutrCount > 0 ? Math.round(calTotal / nutrCount) : undefined,
      proteinAvg: nutrCount > 0 ? Math.round((protTotal / nutrCount) * 10) / 10 : undefined,
      vegPct: nutrCount > 0 ? Math.round((vegCount / nutrCount) * 100) : undefined,
      newCount,
      repeatCount,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return result;
}

/**
 * Hero metrics for overview gateway cards.
 */
export async function getOverviewStats(params: StatsParams): Promise<OverviewStats> {
  const { userId, dateRange, mealType } = params;
  let query = basePostsQuery(userId, mealType)
    .select('id, recipe_id, rating, cooked_at');
  query = applyDateRangeFilter(query, dateRange);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching overview stats:', error);
    return { totalCooks: 0, uniqueRecipes: 0, avgRating: null, avgCalories: 0, totalTimeHours: 0, newRecipesThisWeek: 0 };
  }

  const posts = data || [];
  const totalCooks = posts.length;

  // Unique recipes (excluding freeform posts with no recipe_id)
  const recipeIds = new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id));
  const uniqueRecipes = recipeIds.size;

  // Average rating (only rated posts)
  const ratings = posts.filter(p => p.rating != null).map(p => p.rating as number);
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  // New recipes this week: recipes cooked for the first time this week
  // We need the user's full history to know which are truly "first cooks"
  const thisMonday = getMondayOfWeek(new Date());
  const thisMondayStr = thisMonday.toISOString();

  // Fetch all recipe posts to determine first cook dates
  const { data: allPosts } = await supabase
    .from('posts')
    .select('recipe_id, cooked_at')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null)
    .order('cooked_at', { ascending: true });

  const firstCookDates = new Map<string, string>();
  for (const p of allPosts || []) {
    if (!firstCookDates.has(p.recipe_id)) {
      firstCookDates.set(p.recipe_id, p.cooked_at);
    }
  }

  let newRecipesThisWeek = 0;
  for (const [, firstDate] of firstCookDates) {
    if (firstDate >= thisMondayStr) newRecipesThisWeek++;
  }

  // Average calories weighted by cook count (same pattern as getNutritionAverages)
  let avgCalories = 0;
  const uniqueRecipeIds = [...recipeIds] as string[];
  if (uniqueRecipeIds.length > 0) {
    const { data: nutr } = await supabase
      .from('recipe_nutrition_computed')
      .select('recipe_id, cal_per_serving')
      .in('recipe_id', uniqueRecipeIds);

    if (nutr && nutr.length > 0) {
      const nutrMap = new Map(nutr.map(n => [n.recipe_id, n.cal_per_serving]));
      let totalCal = 0;
      let calCount = 0;
      for (const p of posts) {
        if (!p.recipe_id) continue;
        const cal = nutrMap.get(p.recipe_id);
        if (cal != null) {
          totalCal += cal;
          calCount++;
        }
      }
      if (calCount > 0) {
        avgCalories = Math.round(totalCal / calCount);
      }
    }
  }

  return {
    totalCooks,
    uniqueRecipes,
    avgRating,
    avgCalories,
    totalTimeHours: 0, // TODO: needs cook_time data on posts or recipes
    newRecipesThisWeek,
  };
}

/**
 * Breakdown: recipe-based, modified recipe, or freeform cooking.
 * - fromRecipe: has recipe_id, modifications is null or empty
 * - modified: has recipe_id, modifications is non-empty
 * - freeform: no recipe_id
 */
export async function getHowYouCook(params: StatsParams): Promise<HowYouCook> {
  const { userId, dateRange, mealType } = params;
  let query = basePostsQuery(userId, mealType)
    .select('recipe_id, modifications');
  query = applyDateRangeFilter(query, dateRange);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching how you cook:', error);
    return { fromRecipe: 0, modified: 0, freeform: 0 };
  }

  let fromRecipe = 0;
  let modified = 0;
  let freeform = 0;

  for (const post of data || []) {
    if (!post.recipe_id) {
      freeform++;
    } else if (post.modifications !== null && post.modifications !== '') {
      modified++;
    } else {
      fromRecipe++;
    }
  }

  return { fromRecipe, modified, freeform };
}

/**
 * Cooking partners ranked by times cooked together.
 * Uses post_participants table (column: participant_user_id).
 */
export async function getCookingPartners(params: StatsParams): Promise<CookingPartner[]> {
  const { userId, dateRange, mealType } = params;

  // First get the user's post IDs within the date range/filter
  let query = basePostsQuery(userId, mealType)
    .select('id');
  query = applyDateRangeFilter(query, dateRange);

  const { data: posts, error: postsError } = await query;

  if (postsError || !posts || posts.length === 0) {
    if (postsError) console.error('Error fetching posts for partners:', postsError);
    return [];
  }

  const postIds = posts.map(p => p.id);

  // Fetch participants for those posts
  // Supabase .in() has a limit, so batch if needed
  const batchSize = 200;
  const allParticipants: any[] = [];

  for (let i = 0; i < postIds.length; i += batchSize) {
    const batch = postIds.slice(i, i + batchSize);
    const { data: participants, error: partError } = await supabase
      .from('post_participants')
      .select('participant_user_id, post_id')
      .in('post_id', batch)
      .eq('status', 'approved');

    if (partError) {
      console.error('Error fetching participants:', partError);
      continue;
    }
    if (participants) allParticipants.push(...participants);
  }

  if (allParticipants.length === 0) return [];

  // Count by participant (exclude the user themselves)
  const countMap = new Map<string, number>();
  for (const p of allParticipants) {
    if (p.participant_user_id === userId) continue;
    countMap.set(
      p.participant_user_id,
      (countMap.get(p.participant_user_id) || 0) + 1
    );
  }

  if (countMap.size === 0) return [];

  // Fetch profiles for all partner user IDs
  const partnerIds = [...countMap.keys()];
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, display_name, avatar_url')
    .in('id', partnerIds);

  if (profileError) {
    console.error('Error fetching partner profiles:', profileError);
    return [];
  }

  const profileMap = new Map<string, { display_name: string; avatar_url: string | null }>();
  for (const p of profiles || []) {
    profileMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
  }

  // Build result sorted by count descending
  const result: CookingPartner[] = [];
  for (const [uid, count] of countMap) {
    const profile = profileMap.get(uid);
    result.push({
      userId: uid,
      displayName: profile?.display_name || 'Unknown',
      avatarUrl: profile?.avatar_url || null,
      count,
    });
  }

  result.sort((a, b) => b.count - a.count);
  return result;
}

/**
 * New vs Repeat: percentage of cooks that were first-time vs repeat recipes.
 * Only counts posts with a recipe_id (freeform excluded).
 */
export async function getNewVsRepeat(params: StatsParams): Promise<NewVsRepeat> {
  const { userId, dateRange, mealType } = params;

  // Get all recipe posts (all-time) to determine first cook dates
  const { data: allPosts, error: allError } = await supabase
    .from('posts')
    .select('recipe_id, cooked_at')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null)
    .order('cooked_at', { ascending: true });

  if (allError || !allPosts || allPosts.length === 0) {
    if (allError) console.error('Error fetching posts for new vs repeat:', allError);
    return { newPct: 0, repeatPct: 0 };
  }

  // Build first cook date per recipe
  const firstCookDate = new Map<string, string>();
  for (const p of allPosts) {
    if (!firstCookDate.has(p.recipe_id)) {
      firstCookDate.set(p.recipe_id, p.cooked_at);
    }
  }

  // Now filter to the date range window + meal type
  let filteredPosts = allPosts.filter(
    p => p.cooked_at >= dateRange.start && p.cooked_at <= dateRange.end
  );

  // For meal type filter, we need to re-query with meal_type since allPosts doesn't have it
  if (mealType !== 'all') {
    let query = supabase
      .from('posts')
      .select('recipe_id, cooked_at')
      .eq('user_id', userId)
      .eq('post_type', 'dish')
      .eq('meal_type', mealType)
      .not('recipe_id', 'is', null);
    query = applyDateRangeFilter(query, dateRange);

    const { data: filtered } = await query;
    filteredPosts = filtered || [];
  }

  let newCount = 0;
  let repeatCount = 0;

  for (const p of filteredPosts) {
    const firstDate = firstCookDate.get(p.recipe_id);
    if (firstDate && p.cooked_at === firstDate) {
      newCount++;
    } else {
      repeatCount++;
    }
  }

  const total = newCount + repeatCount;
  if (total === 0) return { newPct: 0, repeatPct: 0 };

  return {
    newPct: Math.round((newCount / total) * 100),
    repeatPct: Math.round((repeatCount / total) * 100),
  };
}

// ── Session 2 Types ──────────────────────────────────────────────

export interface MostCookedItem {
  recipeId: string;
  title: string;
  chef: string | null;
  book: string | null;
  rating: number | null;
  count: number;
  barPct: number;
}

export interface ConceptCount {
  concept: string;
  count: number;
}

export interface TopIngredientItem {
  ingredientId: string;
  name: string;
  type: string | null;
  family: string | null;
  classification: 'hero' | 'primary' | 'secondary' | null;
  count: number;
  barPct: number;
}

export interface CuisineBreakdownItem {
  cuisine: string;
  pct: number;
  count: number;
}

export interface MethodBreakdownItem {
  method: string;
  pct: number;
  count: number;
}

export interface TopChefItem {
  chefId: string;
  name: string;
  count: number;
}

export interface TopBookItem {
  bookId: string;
  title: string;
  count: number;
}

export interface CookbookProgressItem {
  bookId: string;
  title: string;
  cooked: number;
  total: number;
  pct: number;
}

export interface RecipeDiscoveryItem {
  sourceType: string;
  pct: number;
}

export interface NutritionAverages {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
}

export interface NutrientTrendPoint {
  week: string;
  value: number;
}

export interface NutrientSourceItem {
  source: string;
  pct: number;
}

export interface HighNutrientRecipe {
  recipeId: string;
  title: string;
  value: number;
}

export interface DietaryBreakdown {
  vegetarian: number;
  glutenFree: number;
  dairyFree: number;
  vegan: number;
}

export interface MicronutrientLevel {
  nutrient: string;
  pctDaily: number;
}

export interface DiversityScore {
  score: number;
  cuisineCount: number;
  methodCount: number;
  conceptCount: number;
  label: string;
}

export interface ComplexityTrendPoint {
  month: string;
  avgDifficulty: number;
}

export interface SeasonalPattern {
  season: string;
  topConcepts: string[];
}

export interface HeatmapCell {
  day: number;          // 0-6 (Sun-Sat)
  timeSlot: 'am' | 'mid' | 'pm';
  intensity: number;
}

export interface PantryUtilization {
  used: number;
  total: number;
  pct: number;
}

export interface DrillDownDetail {
  stats: { count: number; avgRating: number | null; trend: number };
  mostCooked: MostCookedItem[];
  ingredients: TopIngredientItem[];
  chefs: TopChefItem[];
  concepts: ConceptCount[];
  uncookedCount: number;
}

export interface NutritionComparison {
  avgCalories: number;
  avgProtein: number;
  vegetarianPct: number;
}

export interface ChefStats {
  recipesCooked: number;
  avgRating: number | null;
  timesCooked: number;
  comparison: { chef: NutritionComparison; overall: NutritionComparison };
  mostCooked: MostCookedItem[];
  concepts: ConceptCount[];
  signatureIngredients: TopIngredientItem[];
  stockUpList: { id: string; name: string; ingredientType: string | null }[];
  books: TopBookItem[];
}

export interface BookStats {
  completionPct: number;
  avgRating: number | null;
  timesCooked: number;
  progress: { cooked: number; total: number };
  comparison: { book: NutritionComparison; overall: NutritionComparison };
  mostCooked: MostCookedItem[];
  highestRated: MostCookedItem[];
  keyIngredients: TopIngredientItem[];
  cuisines: CuisineBreakdownItem[];
  methods: MethodBreakdownItem[];
}

export type StatsNutrient = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium';

// ── Shared Internal Helpers ──────────────────────────────────────

/** Fetch user's dish post IDs + recipe_ids within a dateRange/mealType window */
async function fetchFilteredPosts(
  params: StatsParams,
  fields: string = 'id, recipe_id, cooked_at, rating'
): Promise<any[]> {
  const { userId, dateRange, mealType } = params;
  let query = supabase
    .from('posts')
    .select(fields)
    .eq('user_id', userId)
    .eq('post_type', 'dish') as any;
  if (mealType !== 'all') query = query.eq('meal_type', mealType);
  query = applyDateRangeFilter(query, dateRange);
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching filtered posts:', error);
    return [];
  }
  return data || [];
}

/** Given post data with recipe_id, fetch recipes with join fields */
async function fetchRecipesForPosts(
  posts: any[],
  selectFields: string = 'id, title, chef_id, book_id, cooking_concept, cuisine_types, cooking_methods, source_type, ai_difficulty_score'
): Promise<any[]> {
  const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
  if (recipeIds.length === 0) return [];
  const { data, error } = await (supabase
    .from('recipes')
    .select(selectFields) as any)
    .in('id', recipeIds);
  if (error) {
    console.error('Error fetching recipes for stats:', error);
    return [];
  }
  return data || [];
}

/** Build a count-by-recipe map from posts */
function countByRecipe(posts: any[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of posts) {
    if (p.recipe_id) {
      map.set(p.recipe_id, (map.get(p.recipe_id) || 0) + 1);
    }
  }
  return map;
}

/** Build an avg-rating-by-recipe map from posts */
function avgRatingByRecipe(posts: any[]): Map<string, number | null> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const p of posts) {
    if (p.recipe_id && p.rating != null) {
      const existing = sums.get(p.recipe_id) || { total: 0, count: 0 };
      existing.total += p.rating;
      existing.count += 1;
      sums.set(p.recipe_id, existing);
    }
  }
  const map = new Map<string, number | null>();
  for (const [id, { total, count }] of Array.from(sums.entries())) {
    map.set(id, Math.round((total / count) * 10) / 10);
  }
  return map;
}

/** Get nutrient value from a recipe_nutrition_computed row */
function getNutrientValue(row: any, nutrient: StatsNutrient): number {
  const servings = row.servings || 1;
  switch (nutrient) {
    case 'calories': return row.cal_per_serving ?? 0;
    case 'protein':  return row.protein_per_serving_g ?? 0;
    case 'carbs':    return row.carbs_per_serving_g ?? 0;
    case 'fat':      return row.fat_per_serving_g ?? 0;
    case 'fiber':    return (row.total_fiber_g ?? 0) / servings;
    case 'sugar':    return (row.total_sugar_g ?? 0) / servings;
    case 'sodium':   return (row.total_sodium_mg ?? 0) / servings;
  }
}

/** Map nutrient name to recipe_ingredient_nutrition column (null if unsupported) */
function nutrientToIngredientColumn(nutrient: StatsNutrient): string | null {
  switch (nutrient) {
    case 'calories': return 'calories';
    case 'protein':  return 'protein_g';
    case 'carbs':    return 'carbs_g';
    case 'fat':      return 'fat_g';
    default:         return null; // fiber/sugar/sodium not in view
  }
}

/** Compute overall nutrition comparison averages from posts + recipe_nutrition_computed */
async function computeNutritionComparison(
  userId: string,
  recipeFilter?: { column: string; value: string }
): Promise<NutritionComparison> {
  // Get post recipe_ids
  let query = supabase
    .from('posts')
    .select('recipe_id')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null);
  const { data: posts } = await query;
  if (!posts || posts.length === 0) return { avgCalories: 0, avgProtein: 0, vegetarianPct: 0 };

  let recipeIds = [...new Set(posts.map(p => p.recipe_id))] as string[];

  // If filtering by chef/book, narrow recipe list
  if (recipeFilter) {
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id')
      .in('id', recipeIds)
      .eq(recipeFilter.column, recipeFilter.value);
    recipeIds = (recipes || []).map(r => r.id);
    if (recipeIds.length === 0) return { avgCalories: 0, avgProtein: 0, vegetarianPct: 0 };
  }

  const { data: nutr } = await supabase
    .from('recipe_nutrition_computed')
    .select('cal_per_serving, protein_per_serving_g, is_vegetarian')
    .in('recipe_id', recipeIds);

  if (!nutr || nutr.length === 0) return { avgCalories: 0, avgProtein: 0, vegetarianPct: 0 };

  const avgCalories = Math.round(nutr.reduce((s, r) => s + (r.cal_per_serving ?? 0), 0) / nutr.length);
  const avgProtein = Math.round(nutr.reduce((s, r) => s + (r.protein_per_serving_g ?? 0), 0) / nutr.length * 10) / 10;
  const vegetarianPct = Math.round(nutr.filter(r => r.is_vegetarian).length / nutr.length * 100);

  return { avgCalories, avgProtein, vegetarianPct };
}

// ── Recipes Functions ────────────────────────────────────────────

/**
 * Most cooked recipes ranked by count.
 * barPct = count / maxCount for bar chart rendering.
 */
export async function getMostCooked(
  params: StatsParams,
  limit: number = 10
): Promise<MostCookedItem[]> {
  const posts = await fetchFilteredPosts(params);
  const counts = countByRecipe(posts);
  const ratings = avgRatingByRecipe(posts);

  if (counts.size === 0) return [];

  const recipeIds = [...counts.keys()];
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, title, chef_id, book_id')
    .in('id', recipeIds);

  // Fetch chef and book names
  const chefIds = [...new Set((recipes || []).filter(r => r.chef_id).map(r => r.chef_id))] as string[];
  const bookIds = [...new Set((recipes || []).filter(r => r.book_id).map(r => r.book_id))] as string[];

  const [chefRes, bookRes] = await Promise.all([
    chefIds.length > 0
      ? supabase.from('chefs').select('id, name').in('id', chefIds)
      : { data: [] },
    bookIds.length > 0
      ? supabase.from('books').select('id, title').in('id', bookIds)
      : { data: [] },
  ]);

  const chefMap = new Map((chefRes.data || []).map(c => [c.id, c.name]));
  const bookMap = new Map((bookRes.data || []).map(b => [b.id, b.title]));
  const recipeMap = new Map((recipes || []).map(r => [r.id, r]));

  // Sort by count descending
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const maxCount = sorted[0]?.[1] || 1;

  return sorted.map(([recipeId, count]) => {
    const recipe = recipeMap.get(recipeId);
    return {
      recipeId,
      title: recipe?.title || 'Unknown',
      chef: recipe?.chef_id ? chefMap.get(recipe.chef_id) || null : null,
      book: recipe?.book_id ? bookMap.get(recipe.book_id) || null : null,
      rating: ratings.get(recipeId) ?? null,
      count,
      barPct: Math.round((count / maxCount) * 100),
    };
  });
}

/**
 * Cooking concepts counted via posts.
 * From recipes.cooking_concept.
 */
export async function getCookingConcepts(params: StatsParams): Promise<ConceptCount[]> {
  const posts = await fetchFilteredPosts(params);
  const recipes = await fetchRecipesForPosts(posts, 'id, cooking_concept');

  const recipeConceptMap = new Map<string, string>();
  for (const r of recipes) {
    if (r.cooking_concept) recipeConceptMap.set(r.id, r.cooking_concept);
  }

  const conceptCounts = new Map<string, number>();
  for (const p of posts) {
    if (!p.recipe_id) continue;
    const concept = recipeConceptMap.get(p.recipe_id);
    if (concept) {
      conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
    }
  }

  return [...conceptCounts.entries()]
    .map(([concept, count]) => ({ concept, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Top ingredients via recipe_ingredients → ingredients, counted per distinct post.
 * Optional typeFilter matches against family OR ingredient_type.
 */
export async function getTopIngredients(
  params: StatsParams,
  typeFilter?: string,
  limit: number = 20
): Promise<TopIngredientItem[]> {
  const posts = await fetchFilteredPosts(params, 'id, recipe_id');
  const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
  if (recipeIds.length === 0) return [];

  // Build recipe_id → post_ids map for counting distinct posts per ingredient
  const recipePostMap = new Map<string, string[]>();
  for (const p of posts) {
    if (!p.recipe_id) continue;
    const arr = recipePostMap.get(p.recipe_id) || [];
    arr.push(p.id);
    recipePostMap.set(p.recipe_id, arr);
  }

  // Fetch recipe_ingredients for those recipes
  const { data: riData } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, ingredient_id, ingredient_classification')
    .in('recipe_id', recipeIds)
    .not('ingredient_id', 'is', null);

  if (!riData || riData.length === 0) return [];

  // Track highest classification per ingredient (hero > primary > secondary)
  const ingredientClassMap = new Map<string, 'hero' | 'primary' | 'secondary'>();
  const CLASS_PRIORITY: Record<string, number> = { hero: 3, primary: 2, secondary: 1 };

  for (const ri of riData) {
    const cls = ri.ingredient_classification as 'hero' | 'primary' | 'secondary' | null;
    if (!cls) continue;
    const existing = ingredientClassMap.get(ri.ingredient_id);
    if (!existing || CLASS_PRIORITY[cls] > CLASS_PRIORITY[existing]) {
      ingredientClassMap.set(ri.ingredient_id, cls);
    }
  }

  // Get unique ingredient IDs
  const ingredientIds = [...new Set(riData.map(ri => ri.ingredient_id))] as string[];

  // Fetch ingredient details
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name, ingredient_type, family')
    .in('id', ingredientIds);

  if (!ingredients) return [];

  const ingredientMap = new Map(ingredients.map(i => [i.id, i]));

  // Apply type filter
  let filteredIngredientIds: Set<string>;
  if (typeFilter && typeFilter !== 'all') {
    filteredIngredientIds = new Set(
      ingredients
        .filter(i => i.family === typeFilter || i.ingredient_type === typeFilter)
        .map(i => i.id)
    );
  } else {
    filteredIngredientIds = new Set(ingredientIds);
  }

  // Count distinct posts per ingredient
  const ingredientPostCounts = new Map<string, Set<string>>();
  for (const ri of riData) {
    if (!filteredIngredientIds.has(ri.ingredient_id)) continue;
    const postIds = recipePostMap.get(ri.recipe_id) || [];
    let postSet = ingredientPostCounts.get(ri.ingredient_id);
    if (!postSet) {
      postSet = new Set();
      ingredientPostCounts.set(ri.ingredient_id, postSet);
    }
    for (const pid of postIds) postSet.add(pid);
  }

  // Sort and build result
  const sorted = [...ingredientPostCounts.entries()]
    .map(([id, posts]) => ({ id, count: posts.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const maxCount = sorted[0]?.count || 1;

  return sorted.map(({ id, count }) => {
    const ing = ingredientMap.get(id);
    return {
      ingredientId: id,
      name: ing?.name || 'Unknown',
      type: ing?.ingredient_type || null,
      family: ing?.family || null,
      classification: ingredientClassMap.get(id) ?? null,
      count,
      barPct: Math.round((count / maxCount) * 100),
    };
  });
}

/**
 * Cuisine breakdown from recipes.cuisine_types array.
 * Supabase can't unnest arrays — fetch and aggregate in TypeScript.
 */
export async function getCuisineBreakdown(params: StatsParams): Promise<CuisineBreakdownItem[]> {
  const posts = await fetchFilteredPosts(params);
  const recipes = await fetchRecipesForPosts(posts, 'id, cuisine_types');

  const recipeCuisineMap = new Map<string, string[]>();
  for (const r of recipes) {
    if (r.cuisine_types && Array.isArray(r.cuisine_types) && r.cuisine_types.length > 0) {
      recipeCuisineMap.set(r.id, r.cuisine_types);
    }
  }

  const cuisineCounts = new Map<string, number>();
  let totalAssignments = 0;

  for (const p of posts) {
    if (!p.recipe_id) continue;
    const cuisines = recipeCuisineMap.get(p.recipe_id);
    if (cuisines) {
      for (const c of cuisines) {
        cuisineCounts.set(c, (cuisineCounts.get(c) || 0) + 1);
        totalAssignments++;
      }
    }
  }

  if (totalAssignments === 0) return [];

  return [...cuisineCounts.entries()]
    .map(([cuisine, count]) => ({
      cuisine,
      count,
      pct: Math.round((count / totalAssignments) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Method breakdown from posts.cooking_method or recipes.cooking_methods.
 * Posts cooking_method takes priority; falls back to recipe's cooking_methods array.
 */
export async function getMethodBreakdown(params: StatsParams): Promise<MethodBreakdownItem[]> {
  const posts = await fetchFilteredPosts(params, 'id, recipe_id, cooking_method');
  const recipes = await fetchRecipesForPosts(posts, 'id, cooking_methods');

  const recipeMethodMap = new Map<string, string[]>();
  for (const r of recipes) {
    if (r.cooking_methods && Array.isArray(r.cooking_methods)) {
      recipeMethodMap.set(r.id, r.cooking_methods);
    }
  }

  const methodCounts = new Map<string, number>();
  let totalAssignments = 0;

  for (const p of posts) {
    // Prefer post-level cooking_method
    if (p.cooking_method) {
      methodCounts.set(p.cooking_method, (methodCounts.get(p.cooking_method) || 0) + 1);
      totalAssignments++;
    } else if (p.recipe_id) {
      const methods = recipeMethodMap.get(p.recipe_id);
      if (methods) {
        for (const m of methods) {
          methodCounts.set(m, (methodCounts.get(m) || 0) + 1);
          totalAssignments++;
        }
      }
    }
  }

  if (totalAssignments === 0) return [];

  return [...methodCounts.entries()]
    .map(([method, count]) => ({
      method,
      count,
      pct: Math.round((count / totalAssignments) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Top chefs by cook count.
 */
export async function getTopChefs(
  params: StatsParams,
  limit: number = 10
): Promise<TopChefItem[]> {
  const posts = await fetchFilteredPosts(params);
  const recipes = await fetchRecipesForPosts(posts, 'id, chef_id');

  const recipeChefMap = new Map<string, string>();
  for (const r of recipes) {
    if (r.chef_id) recipeChefMap.set(r.id, r.chef_id);
  }

  const chefCounts = new Map<string, number>();
  for (const p of posts) {
    if (!p.recipe_id) continue;
    const chefId = recipeChefMap.get(p.recipe_id);
    if (chefId) {
      chefCounts.set(chefId, (chefCounts.get(chefId) || 0) + 1);
    }
  }

  if (chefCounts.size === 0) return [];

  const chefIds = [...chefCounts.keys()];
  const { data: chefs } = await supabase
    .from('chefs')
    .select('id, name')
    .in('id', chefIds);

  const chefNameMap = new Map((chefs || []).map(c => [c.id, c.name]));

  return [...chefCounts.entries()]
    .map(([chefId, count]) => ({
      chefId,
      name: chefNameMap.get(chefId) || 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Top books by cook count.
 */
export async function getTopBooks(
  params: StatsParams,
  limit: number = 10
): Promise<TopBookItem[]> {
  const posts = await fetchFilteredPosts(params);
  const recipes = await fetchRecipesForPosts(posts, 'id, book_id');

  const recipeBookMap = new Map<string, string>();
  for (const r of recipes) {
    if (r.book_id) recipeBookMap.set(r.id, r.book_id);
  }

  const bookCounts = new Map<string, number>();
  for (const p of posts) {
    if (!p.recipe_id) continue;
    const bookId = recipeBookMap.get(p.recipe_id);
    if (bookId) {
      bookCounts.set(bookId, (bookCounts.get(bookId) || 0) + 1);
    }
  }

  if (bookCounts.size === 0) return [];

  const bookIds = [...bookCounts.keys()];
  const { data: books } = await supabase
    .from('books')
    .select('id, title')
    .in('id', bookIds);

  const bookTitleMap = new Map((books || []).map(b => [b.id, b.title]));

  return [...bookCounts.entries()]
    .map(([bookId, count]) => ({
      bookId,
      title: bookTitleMap.get(bookId) || 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Cookbook progress — all-time, not period-filtered.
 * Filtered to books the user owns (user_books table).
 */
export async function getCookbookProgress(userId: string): Promise<CookbookProgressItem[]> {
  // Get user's books
  const { data: userBooks } = await supabase
    .from('user_books')
    .select('book_id, recipe_count')
    .eq('user_id', userId);

  if (!userBooks || userBooks.length === 0) return [];

  const bookIds = userBooks.map(ub => ub.book_id);

  // Get book titles
  const { data: books } = await supabase
    .from('books')
    .select('id, title')
    .in('id', bookIds);

  const bookTitleMap = new Map((books || []).map(b => [b.id, b.title]));

  // Get user's cooked recipes from these books
  const { data: posts } = await supabase
    .from('posts')
    .select('recipe_id')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null);

  const cookedRecipeIds = new Set((posts || []).map(p => p.recipe_id));

  // Get recipes from these books
  const { data: bookRecipes } = await supabase
    .from('recipes')
    .select('id, book_id')
    .in('book_id', bookIds);

  // Count cooked per book
  const cookedPerBook = new Map<string, number>();
  const totalPerBook = new Map<string, number>();

  for (const r of bookRecipes || []) {
    totalPerBook.set(r.book_id, (totalPerBook.get(r.book_id) || 0) + 1);
    if (cookedRecipeIds.has(r.id)) {
      cookedPerBook.set(r.book_id, (cookedPerBook.get(r.book_id) || 0) + 1);
    }
  }

  // Use user_books.recipe_count as total if available, otherwise count from recipes table
  return userBooks.map(ub => {
    const total = ub.recipe_count || totalPerBook.get(ub.book_id) || 0;
    const cooked = cookedPerBook.get(ub.book_id) || 0;
    return {
      bookId: ub.book_id,
      title: bookTitleMap.get(ub.book_id) || 'Unknown',
      cooked,
      total,
      pct: total > 0 ? Math.round((cooked / total) * 100) : 0,
    };
  }).sort((a, b) => b.cooked - a.cooked);
}

/**
 * Recipe source type distribution (photo, url, manual, etc.).
 */
export async function getRecipeDiscovery(params: StatsParams): Promise<RecipeDiscoveryItem[]> {
  const posts = await fetchFilteredPosts(params);
  const recipes = await fetchRecipesForPosts(posts, 'id, source_type');

  const recipeSourceMap = new Map<string, string>();
  for (const r of recipes) {
    if (r.source_type) recipeSourceMap.set(r.id, r.source_type);
  }

  const sourceCounts = new Map<string, number>();
  let total = 0;

  for (const p of posts) {
    if (!p.recipe_id) continue;
    const sourceType = recipeSourceMap.get(p.recipe_id);
    if (sourceType) {
      sourceCounts.set(sourceType, (sourceCounts.get(sourceType) || 0) + 1);
      total++;
    }
  }

  if (total === 0) return [];

  return [...sourceCounts.entries()]
    .map(([sourceType, count]) => ({
      sourceType,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);
}

// ── Nutrition Functions ──────────────────────────────────────────

/**
 * Average nutrition per meal from recipe_nutrition_computed.
 * Fiber/sugar/sodium computed from totals ÷ servings (not stored per-serving).
 */
export async function getNutritionAverages(params: StatsParams): Promise<NutritionAverages> {
  const posts = await fetchFilteredPosts(params);
  const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];

  if (recipeIds.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 };
  }

  const { data: nutr } = await supabase
    .from('recipe_nutrition_computed')
    .select('recipe_id, servings, cal_per_serving, protein_per_serving_g, fat_per_serving_g, carbs_per_serving_g, total_fiber_g, total_sugar_g, total_sodium_mg')
    .in('recipe_id', recipeIds);

  if (!nutr || nutr.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 };
  }

  // Weight averages by cook count (a recipe cooked 5x counts 5x in average)
  const nutrMap = new Map(nutr.map(n => [n.recipe_id, n]));
  let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  let totalFiber = 0, totalSugar = 0, totalSodium = 0;
  let count = 0;

  for (const p of posts) {
    if (!p.recipe_id) continue;
    const n = nutrMap.get(p.recipe_id);
    if (!n) continue;
    const servings = n.servings || 1;
    totalCal += n.cal_per_serving ?? 0;
    totalProt += n.protein_per_serving_g ?? 0;
    totalCarbs += n.carbs_per_serving_g ?? 0;
    totalFat += n.fat_per_serving_g ?? 0;
    totalFiber += (n.total_fiber_g ?? 0) / servings;
    totalSugar += (n.total_sugar_g ?? 0) / servings;
    totalSodium += (n.total_sodium_mg ?? 0) / servings;
    count++;
  }

  if (count === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 };
  }

  return {
    calories: Math.round(totalCal / count),
    protein: Math.round((totalProt / count) * 10) / 10,
    carbs: Math.round((totalCarbs / count) * 10) / 10,
    fat: Math.round((totalFat / count) * 10) / 10,
    fiber: Math.round((totalFiber / count) * 10) / 10,
    sodium: Math.round(totalSodium / count),
    sugar: Math.round((totalSugar / count) * 10) / 10,
  };
}

/**
 * Weekly nutrient trend for inline chart.
 * Per-serving computation caveat applies for fiber/sugar/sodium.
 */
export async function getNutrientTrend(
  params: StatsParams,
  nutrient: StatsNutrient
): Promise<NutrientTrendPoint[]> {
  const posts = await fetchFilteredPosts(params, 'id, recipe_id, cooked_at');
  const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];

  if (recipeIds.length === 0) return [];

  const { data: nutr } = await supabase
    .from('recipe_nutrition_computed')
    .select('recipe_id, servings, cal_per_serving, protein_per_serving_g, fat_per_serving_g, carbs_per_serving_g, total_fiber_g, total_sugar_g, total_sodium_mg')
    .in('recipe_id', recipeIds);

  if (!nutr || nutr.length === 0) return [];

  const nutrMap = new Map(nutr.map(n => [n.recipe_id, n]));

  // Group by week
  const weekData = new Map<string, { total: number; count: number }>();
  for (const p of posts) {
    if (!p.recipe_id) continue;
    const n = nutrMap.get(p.recipe_id);
    if (!n) continue;
    const value = getNutrientValue(n, nutrient);
    const weekKey = toDateStr(getMondayOfWeek(new Date(p.cooked_at)));
    const existing = weekData.get(weekKey) || { total: 0, count: 0 };
    existing.total += value;
    existing.count += 1;
    weekData.set(weekKey, existing);
  }

  return [...weekData.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { total, count }]) => ({
      week,
      value: Math.round((total / count) * 10) / 10,
    }));
}

/**
 * Top sources for a nutrient (e.g., protein → Chicken 28%, Eggs 18%).
 * Uses recipe_ingredient_nutrition view.
 * STUBBED for fiber/sugar/sodium — view lacks those columns.
 */
export async function getTopNutrientSources(
  params: StatsParams,
  nutrient: StatsNutrient,
  limit: number = 10
): Promise<NutrientSourceItem[]> {
  const column = nutrientToIngredientColumn(nutrient);
  if (!column) {
    // fiber/sugar/sodium not available in recipe_ingredient_nutrition view
    return [];
  }

  const posts = await fetchFilteredPosts(params);
  const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
  if (recipeIds.length === 0) return [];

  // Weight each recipe by cook count
  const recipeCookCount = new Map<string, number>();
  for (const p of posts) {
    if (p.recipe_id) {
      recipeCookCount.set(p.recipe_id, (recipeCookCount.get(p.recipe_id) || 0) + 1);
    }
  }

  // Fetch ingredient nutrition for those recipes
  const { data: ingredNutr } = await (supabase
    .from('recipe_ingredient_nutrition')
    .select(`recipe_id, ingredient_name, ${column}`) as any)
    .in('recipe_id', recipeIds)
    .not(column, 'is', null);

  if (!ingredNutr || ingredNutr.length === 0) return [];

  // Aggregate by ingredient name, weighted by cook count
  const sourceAmounts = new Map<string, number>();
  let grandTotal = 0;

  for (const row of ingredNutr) {
    const name = row.ingredient_name || 'Unknown';
    const amount = (row[column] ?? 0) * (recipeCookCount.get(row.recipe_id) || 1);
    sourceAmounts.set(name, (sourceAmounts.get(name) || 0) + amount);
    grandTotal += amount;
  }

  if (grandTotal === 0) return [];

  return [...sourceAmounts.entries()]
    .map(([source, amount]) => ({
      source,
      pct: Math.round((amount / grandTotal) * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);
}

/**
 * Recipes with highest value for a specific nutrient.
 */
export async function getHighestNutrientRecipes(
  params: StatsParams,
  nutrient: StatsNutrient,
  limit: number = 10
): Promise<HighNutrientRecipe[]> {
  const posts = await fetchFilteredPosts(params);
  const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
  if (recipeIds.length === 0) return [];

  const { data: nutr } = await supabase
    .from('recipe_nutrition_computed')
    .select('recipe_id, title, servings, cal_per_serving, protein_per_serving_g, fat_per_serving_g, carbs_per_serving_g, total_fiber_g, total_sugar_g, total_sodium_mg')
    .in('recipe_id', recipeIds);

  if (!nutr || nutr.length === 0) return [];

  return nutr
    .map(row => ({
      recipeId: row.recipe_id,
      title: row.title || 'Unknown',
      value: Math.round(getNutrientValue(row, nutrient) * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/**
 * Dietary flags breakdown as percentages.
 */
export async function getDietaryBreakdown(params: StatsParams): Promise<DietaryBreakdown> {
  const posts = await fetchFilteredPosts(params);
  const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
  if (recipeIds.length === 0) {
    return { vegetarian: 0, glutenFree: 0, dairyFree: 0, vegan: 0 };
  }

  const { data: nutr } = await supabase
    .from('recipe_nutrition_computed')
    .select('recipe_id, is_vegetarian, is_gluten_free, is_dairy_free, is_vegan')
    .in('recipe_id', recipeIds);

  if (!nutr || nutr.length === 0) {
    return { vegetarian: 0, glutenFree: 0, dairyFree: 0, vegan: 0 };
  }

  // Weight by cook count
  const nutrMap = new Map(nutr.map(n => [n.recipe_id, n]));
  let veg = 0, gf = 0, df = 0, vgn = 0, total = 0;

  for (const p of posts) {
    if (!p.recipe_id) continue;
    const n = nutrMap.get(p.recipe_id);
    if (!n) continue;
    total++;
    if (n.is_vegetarian) veg++;
    if (n.is_gluten_free) gf++;
    if (n.is_dairy_free) df++;
    if (n.is_vegan) vgn++;
  }

  if (total === 0) return { vegetarian: 0, glutenFree: 0, dairyFree: 0, vegan: 0 };

  return {
    vegetarian: Math.round((veg / total) * 100),
    glutenFree: Math.round((gf / total) * 100),
    dairyFree: Math.round((df / total) * 100),
    vegan: Math.round((vgn / total) * 100),
  };
}

/**
 * Micronutrient levels — STUBBED.
 * ingredients table has no vitamin/mineral columns (only macros + fiber/sugar/sodium).
 * Returns empty array until vitamin/mineral data is added.
 */
export async function getMicronutrientLevels(
  _params: StatsParams
): Promise<MicronutrientLevel[]> {
  return [];
}

// ── Insights Functions ───────────────────────────────────────────

/** Diminishing returns formula for diversity score */
function computeDiversityScore(cuisineCount: number, methodCount: number, conceptCount: number): number {
  const cuisineScore = Math.min(cuisineCount, 12) * 3 + Math.max(0, cuisineCount - 12) * 0.5;
  const methodScore = Math.min(methodCount, 8) * 4 + Math.max(0, methodCount - 8) * 0.5;
  const conceptScore = Math.min(conceptCount, 15) * 1.5 + Math.max(0, conceptCount - 15) * 0.3;
  return Math.min(100, Math.round(cuisineScore + methodScore + conceptScore));
}

function getDiversityLabel(score: number): string {
  if (score <= 25) return 'Creature of Habit';
  if (score <= 50) return 'Curious Cook';
  if (score <= 75) return 'Explorer';
  return 'Adventurer';
}

/**
 * Composite diversity metric: unique cuisines × methods × concepts with diminishing returns.
 */
export async function getDiversityScore(params: StatsParams): Promise<DiversityScore> {
  const posts = await fetchFilteredPosts(params);
  const recipes = await fetchRecipesForPosts(posts, 'id, cuisine_types, cooking_methods, cooking_concept');

  const recipeMap = new Map(recipes.map(r => [r.id, r]));

  const cuisines = new Set<string>();
  const methods = new Set<string>();
  const concepts = new Set<string>();

  for (const p of posts) {
    if (!p.recipe_id) continue;
    const r = recipeMap.get(p.recipe_id);
    if (!r) continue;
    if (r.cuisine_types && Array.isArray(r.cuisine_types)) {
      for (const c of r.cuisine_types) cuisines.add(c);
    }
    if (r.cooking_methods && Array.isArray(r.cooking_methods)) {
      for (const m of r.cooking_methods) methods.add(m);
    }
    if (r.cooking_concept) concepts.add(r.cooking_concept);
  }

  const score = computeDiversityScore(cuisines.size, methods.size, concepts.size);

  return {
    score,
    cuisineCount: cuisines.size,
    methodCount: methods.size,
    conceptCount: concepts.size,
    label: getDiversityLabel(score),
  };
}

/**
 * Monthly average difficulty score trend.
 * From recipes.ai_difficulty_score.
 */
export async function getComplexityTrend(params: StatsParams): Promise<ComplexityTrendPoint[]> {
  const posts = await fetchFilteredPosts(params, 'id, recipe_id, cooked_at');
  const recipes = await fetchRecipesForPosts(posts, 'id, ai_difficulty_score');

  const recipeDiffMap = new Map<string, number>();
  for (const r of recipes) {
    if (r.ai_difficulty_score != null) {
      recipeDiffMap.set(r.id, r.ai_difficulty_score);
    }
  }

  // Group by month
  const monthData = new Map<string, { total: number; count: number }>();
  for (const p of posts) {
    if (!p.recipe_id) continue;
    const diff = recipeDiffMap.get(p.recipe_id);
    if (diff == null) continue;
    const monthKey = p.cooked_at.substring(0, 7); // YYYY-MM
    const existing = monthData.get(monthKey) || { total: 0, count: 0 };
    existing.total += diff;
    existing.count += 1;
    monthData.set(monthKey, existing);
  }

  return [...monthData.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { total, count }]) => ({
      month,
      avgDifficulty: Math.round((total / count) * 10) / 10,
    }));
}

/**
 * Seasonal cooking patterns — full year, not period-filtered.
 * Groups by meteorological season and finds top cooking concepts.
 */
export async function getSeasonalPatterns(userId: string): Promise<SeasonalPattern[]> {
  const { data: posts } = await supabase
    .from('posts')
    .select('recipe_id, cooked_at')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null);

  if (!posts || posts.length === 0) return [];

  const recipeIds = [...new Set(posts.map(p => p.recipe_id))] as string[];
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, cooking_concept')
    .in('id', recipeIds);

  const recipeConceptMap = new Map<string, string>();
  for (const r of recipes || []) {
    if (r.cooking_concept) recipeConceptMap.set(r.id, r.cooking_concept);
  }

  // Map months to seasons
  function monthToSeason(month: number): string {
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  }

  const seasonConcepts = new Map<string, Map<string, number>>();
  for (const p of posts) {
    const concept = recipeConceptMap.get(p.recipe_id);
    if (!concept) continue;
    const month = new Date(p.cooked_at).getMonth(); // 0-indexed
    const season = monthToSeason(month);
    let concepts = seasonConcepts.get(season);
    if (!concepts) {
      concepts = new Map();
      seasonConcepts.set(season, concepts);
    }
    concepts.set(concept, (concepts.get(concept) || 0) + 1);
  }

  const seasonOrder = ['Spring', 'Summer', 'Fall', 'Winter'];
  return seasonOrder
    .filter(s => seasonConcepts.has(s))
    .map(season => {
      const concepts = seasonConcepts.get(season)!;
      const topConcepts = [...concepts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);
      return { season, topConcepts };
    });
}

/**
 * Day-of-week × time-of-day heatmap from posts.cooked_at.
 * day: 0=Sun, 1=Mon, ..., 6=Sat.
 * timeSlot: am (before 12), mid (12-17), pm (17+).
 */
export async function getCookingHeatmap(params: StatsParams): Promise<HeatmapCell[]> {
  const posts = await fetchFilteredPosts(params, 'id, cooked_at');

  const grid = new Map<string, number>();
  for (const p of posts) {
    const d = new Date(p.cooked_at);
    const day = d.getUTCDay();
    const hour = d.getUTCHours();
    let timeSlot: 'am' | 'mid' | 'pm';
    if (hour < 12) timeSlot = 'am';
    else if (hour < 17) timeSlot = 'mid';
    else timeSlot = 'pm';
    const key = `${day}-${timeSlot}`;
    grid.set(key, (grid.get(key) || 0) + 1);
  }

  // Find max for normalization
  const maxCount = Math.max(1, ...Array.from(grid.values()));

  const result: HeatmapCell[] = [];
  const slots: ('am' | 'mid' | 'pm')[] = ['am', 'mid', 'pm'];
  for (let day = 0; day < 7; day++) {
    for (const timeSlot of slots) {
      const key = `${day}-${timeSlot}`;
      const count = grid.get(key) || 0;
      result.push({
        day,
        timeSlot,
        intensity: Math.round((count / maxCount) * 100),
      });
    }
  }

  return result;
}

/**
 * Pantry utilization — what % of pantry items appear in recently cooked recipes.
 * Space-aware: queries WHERE user_id = userId OR added_by = userId.
 */
export async function getPantryUtilization(
  userId: string,
  spaceId?: string
): Promise<PantryUtilization> {
  // Get pantry items
  let pantryQuery = supabase
    .from('pantry_items')
    .select('ingredient_id')
    .or(`user_id.eq.${userId},added_by.eq.${userId}`);
  if (spaceId) {
    pantryQuery = pantryQuery.eq('space_id', spaceId);
  }

  const { data: pantryItems } = await pantryQuery;
  if (!pantryItems || pantryItems.length === 0) return { used: 0, total: 0, pct: 0 };

  const pantryIngredientIds = new Set(
    pantryItems.filter(p => p.ingredient_id).map(p => p.ingredient_id as string)
  );
  const total = pantryIngredientIds.size;

  // Get recent posts (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: posts } = await supabase
    .from('posts')
    .select('recipe_id')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null)
    .gte('cooked_at', thirtyDaysAgo.toISOString());

  const recipeIds = [...new Set((posts || []).map(p => p.recipe_id))] as string[];
  if (recipeIds.length === 0) return { used: 0, total, pct: 0 };

  // Get ingredients used in those recipes
  const { data: riData } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_id')
    .in('recipe_id', recipeIds)
    .not('ingredient_id', 'is', null);

  const usedIngredientIds = new Set((riData || []).map(ri => ri.ingredient_id as string));

  // Intersection: pantry items that were used in recipes
  let used = 0;
  for (const id of Array.from(pantryIngredientIds)) {
    if (usedIngredientIds.has(id)) used++;
  }

  return {
    used,
    total,
    pct: total > 0 ? Math.round((used / total) * 100) : 0,
  };
}

// ── Drill-Down Functions ─────────────────────────────────────────

/**
 * Generic drill-down detail builder.
 * Filters posts/recipes by a predicate, then computes stats, most cooked, ingredients, chefs, concepts.
 */
async function buildDrillDownDetail(
  params: StatsParams,
  recipeFilter: (recipe: any) => boolean,
  countAllMatchingRecipes?: () => Promise<number>
): Promise<DrillDownDetail> {
  const posts = await fetchFilteredPosts(params);
  const recipes = await fetchRecipesForPosts(posts, 'id, title, chef_id, cooking_concept, cuisine_types, cooking_methods');

  // Filter recipes matching the drill-down criteria
  const matchingRecipeIds = new Set(recipes.filter(recipeFilter).map(r => r.id));

  // Filter posts to only those with matching recipes
  const filteredPosts = posts.filter(p => p.recipe_id && matchingRecipeIds.has(p.recipe_id));

  // Stats
  const ratings = filteredPosts.filter(p => p.rating != null).map(p => p.rating as number);
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  // Trend: compare recent half vs older half
  const sorted = [...filteredPosts].sort((a, b) => a.cooked_at.localeCompare(b.cooked_at));
  const mid = Math.floor(sorted.length / 2);
  const olderHalf = sorted.slice(0, mid);
  const recentHalf = sorted.slice(mid);
  const trend = olderHalf.length > 0 && recentHalf.length > 0
    ? Math.round(((recentHalf.length - olderHalf.length) / olderHalf.length) * 100)
    : 0;

  // Most cooked
  const counts = countByRecipe(filteredPosts);
  const ratingMap = avgRatingByRecipe(filteredPosts);
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  const sortedCounts = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCount = sortedCounts[0]?.[1] || 1;
  const mostCooked: MostCookedItem[] = sortedCounts.map(([recipeId, count]) => {
    const recipe = recipeMap.get(recipeId);
    return {
      recipeId,
      title: recipe?.title || 'Unknown',
      chef: null,
      book: null,
      rating: ratingMap.get(recipeId) ?? null,
      count,
      barPct: Math.round((count / maxCount) * 100),
    };
  });

  // Top ingredients
  const matchingRecipeIdList = [...matchingRecipeIds] as string[];
  const { data: riData } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, ingredient_id')
    .in('recipe_id', matchingRecipeIdList)
    .not('ingredient_id', 'is', null);

  const ingredientIds = [...new Set((riData || []).map(ri => ri.ingredient_id))] as string[];
  let ingredientItems: TopIngredientItem[] = [];

  if (ingredientIds.length > 0) {
    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('id, name, ingredient_type, family')
      .in('id', ingredientIds);

    const ingMap = new Map((ingredients || []).map(i => [i.id, i]));

    // Count by distinct post
    const recipePostMap = new Map<string, string[]>();
    for (const p of filteredPosts) {
      if (!p.recipe_id) continue;
      const arr = recipePostMap.get(p.recipe_id) || [];
      arr.push(p.id);
      recipePostMap.set(p.recipe_id, arr);
    }

    const ingPostCounts = new Map<string, Set<string>>();
    for (const ri of riData || []) {
      const postIds = recipePostMap.get(ri.recipe_id) || [];
      let s = ingPostCounts.get(ri.ingredient_id);
      if (!s) { s = new Set(); ingPostCounts.set(ri.ingredient_id, s); }
      for (const pid of postIds) s.add(pid);
    }

    const sortedIngs = [...ingPostCounts.entries()]
      .map(([id, s]) => ({ id, count: s.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const maxIng = sortedIngs[0]?.count || 1;

    ingredientItems = sortedIngs.map(({ id, count }) => {
      const ing = ingMap.get(id);
      return {
        ingredientId: id,
        name: ing?.name || 'Unknown',
        type: ing?.ingredient_type || null,
        family: ing?.family || null,
        classification: null,
        count,
        barPct: Math.round((count / maxIng) * 100),
      };
    });
  }

  // Top chefs
  const chefCounts = new Map<string, number>();
  for (const p of filteredPosts) {
    if (!p.recipe_id) continue;
    const r = recipeMap.get(p.recipe_id);
    if (r?.chef_id) chefCounts.set(r.chef_id, (chefCounts.get(r.chef_id) || 0) + 1);
  }
  const chefIds = [...chefCounts.keys()];
  let chefs: TopChefItem[] = [];
  if (chefIds.length > 0) {
    const { data: chefData } = await supabase.from('chefs').select('id, name').in('id', chefIds);
    const chefNameMap = new Map((chefData || []).map(c => [c.id, c.name]));
    chefs = [...chefCounts.entries()]
      .map(([chefId, count]) => ({ chefId, name: chefNameMap.get(chefId) || 'Unknown', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // Concepts
  const conceptCounts = new Map<string, number>();
  for (const p of filteredPosts) {
    if (!p.recipe_id) continue;
    const r = recipeMap.get(p.recipe_id);
    if (r?.cooking_concept) {
      conceptCounts.set(r.cooking_concept, (conceptCounts.get(r.cooking_concept) || 0) + 1);
    }
  }
  const concepts: ConceptCount[] = [...conceptCounts.entries()]
    .map(([concept, count]) => ({ concept, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Uncooked count
  let uncookedCount = 0;
  if (countAllMatchingRecipes) {
    const totalMatching = await countAllMatchingRecipes();
    uncookedCount = Math.max(0, totalMatching - matchingRecipeIds.size);
  }

  return {
    stats: { count: filteredPosts.length, avgRating, trend },
    mostCooked,
    ingredients: ingredientItems,
    chefs,
    concepts,
    uncookedCount,
  };
}

/**
 * Cuisine drill-down detail.
 */
export async function getCuisineDetail(
  params: StatsParams,
  cuisine: string
): Promise<DrillDownDetail> {
  return buildDrillDownDetail(
    params,
    (r) => Array.isArray(r.cuisine_types) && r.cuisine_types.includes(cuisine),
    async () => {
      const { count } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .contains('cuisine_types', [cuisine]);
      return count || 0;
    }
  );
}

/**
 * Cooking concept drill-down detail.
 */
export async function getConceptDetail(
  params: StatsParams,
  concept: string
): Promise<DrillDownDetail> {
  return buildDrillDownDetail(
    params,
    (r) => r.cooking_concept === concept,
    async () => {
      const { count } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .eq('cooking_concept', concept);
      return count || 0;
    }
  );
}

/**
 * Cooking method drill-down detail.
 */
export async function getMethodDetail(
  params: StatsParams,
  method: string
): Promise<DrillDownDetail> {
  return buildDrillDownDetail(
    params,
    (r) => Array.isArray(r.cooking_methods) && r.cooking_methods.includes(method),
    async () => {
      const { count } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .contains('cooking_methods', [method]);
      return count || 0;
    }
  );
}

/**
 * Ingredient drill-down detail.
 */
export async function getIngredientDetail(
  params: StatsParams,
  ingredientId: string
): Promise<DrillDownDetail> {
  // Find all recipes that use this ingredient
  const { data: riData } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id')
    .eq('ingredient_id', ingredientId);

  const recipeIdsWithIngredient = new Set((riData || []).map(ri => ri.recipe_id));

  return buildDrillDownDetail(
    params,
    (r) => recipeIdsWithIngredient.has(r.id),
    async () => recipeIdsWithIngredient.size
  );
}

// ── Chef/Book Functions ──────────────────────────────────────────

/**
 * Full chef detail page data.
 */
export async function getChefStats(
  userId: string,
  chefId: string
): Promise<ChefStats> {
  // Get all user's dish posts
  const { data: posts } = await supabase
    .from('posts')
    .select('id, recipe_id, cooked_at, rating')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null);

  if (!posts || posts.length === 0) {
    return emptyChefStats();
  }

  // Get all user's recipes, identify which are by this chef
  const recipeIds = [...new Set(posts.map(p => p.recipe_id))] as string[];
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, title, chef_id, book_id, cooking_concept')
    .in('id', recipeIds);

  const chefRecipeIds = new Set((recipes || []).filter(r => r.chef_id === chefId).map(r => r.id));
  const chefPosts = posts.filter(p => chefRecipeIds.has(p.recipe_id));

  if (chefPosts.length === 0) return emptyChefStats();

  const recipesCooked = chefRecipeIds.size;
  const timesCooked = chefPosts.length;
  const ratings = chefPosts.filter(p => p.rating != null).map(p => p.rating as number);
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  // Comparison: chef vs overall
  const [chefComparison, overallComparison] = await Promise.all([
    computeNutritionComparison(userId, { column: 'chef_id', value: chefId }),
    computeNutritionComparison(userId),
  ]);

  // Most cooked from this chef
  const counts = countByRecipe(chefPosts);
  const ratingMap = avgRatingByRecipe(chefPosts);
  const recipeMap = new Map((recipes || []).map(r => [r.id, r]));
  const sortedCounts = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCount = sortedCounts[0]?.[1] || 1;

  const mostCooked: MostCookedItem[] = sortedCounts.map(([recipeId, count]) => {
    const recipe = recipeMap.get(recipeId);
    return {
      recipeId,
      title: recipe?.title || 'Unknown',
      chef: null,
      book: null,
      rating: ratingMap.get(recipeId) ?? null,
      count,
      barPct: Math.round((count / maxCount) * 100),
    };
  });

  // Concepts from this chef's recipes
  const conceptCounts = new Map<string, number>();
  for (const p of chefPosts) {
    const r = recipeMap.get(p.recipe_id);
    if (r?.cooking_concept) {
      conceptCounts.set(r.cooking_concept, (conceptCounts.get(r.cooking_concept) || 0) + 1);
    }
  }
  const concepts: ConceptCount[] = [...conceptCounts.entries()]
    .map(([concept, count]) => ({ concept, count }))
    .sort((a, b) => b.count - a.count);

  // Signature ingredients
  const chefRecipeIdList = [...chefRecipeIds] as string[];
  const { data: riData } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, ingredient_id')
    .in('recipe_id', chefRecipeIdList)
    .not('ingredient_id', 'is', null);

  const ingCounts = new Map<string, number>();
  for (const ri of riData || []) {
    ingCounts.set(ri.ingredient_id, (ingCounts.get(ri.ingredient_id) || 0) + 1);
  }

  const topIngIds = [...ingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id]) => id);

  let signatureIngredients: TopIngredientItem[] = [];
  if (topIngIds.length > 0) {
    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('id, name, ingredient_type, family')
      .in('id', topIngIds);

    const ingMap = new Map((ingredients || []).map(i => [i.id, i]));
    const maxIng = ingCounts.get(topIngIds[0]) || 1;
    signatureIngredients = topIngIds.map(id => {
      const ing = ingMap.get(id);
      const count = ingCounts.get(id) || 0;
      return {
        ingredientId: id,
        name: ing?.name || 'Unknown',
        type: ing?.ingredient_type || null,
        family: ing?.family || null,
        classification: null,
        count,
        barPct: Math.round((count / maxIng) * 100),
      };
    });
  }

  // Stock up list: chef's hero/primary ingredients not in user's pantry
  // Uses ingredient_classification (hero/primary/secondary)
  const { data: classifiedRi } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_id, recipe_id')
    .in('recipe_id', chefRecipeIdList)
    .not('ingredient_id', 'is', null)
    .in('ingredient_classification', ['hero', 'primary']);

  const { data: pantryItems } = await supabase
    .from('pantry_items')
    .select('ingredient_id')
    .or(`user_id.eq.${userId},added_by.eq.${userId}`);

  const pantryIngIds = new Set((pantryItems || []).filter(p => p.ingredient_id).map(p => p.ingredient_id));
  const missingIngCounts = new Map<string, number>();

  for (const ri of classifiedRi || []) {
    if (!pantryIngIds.has(ri.ingredient_id)) {
      missingIngCounts.set(ri.ingredient_id, (missingIngCounts.get(ri.ingredient_id) || 0) + 1);
    }
  }

  const topMissing = [...missingIngCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  let stockUpList: { id: string; name: string; ingredientType: string | null }[] = [];
  if (topMissing.length > 0) {
    const { data: missingIngs } = await supabase
      .from('ingredients')
      .select('id, name, ingredient_type')
      .in('id', topMissing);

    stockUpList = topMissing.map(id => {
      const ing = (missingIngs || []).find(i => i.id === id);
      return { id, name: ing?.name || 'Unknown', ingredientType: ing?.ingredient_type || null };
    });
  }

  // Books by this chef
  const chefBookIds = [...new Set((recipes || []).filter(r => r.chef_id === chefId && r.book_id).map(r => r.book_id))] as string[];
  let books: TopBookItem[] = [];
  if (chefBookIds.length > 0) {
    const { data: bookData } = await supabase
      .from('books')
      .select('id, title')
      .in('id', chefBookIds);

    const bookPostCounts = new Map<string, number>();
    for (const p of chefPosts) {
      const r = recipeMap.get(p.recipe_id);
      if (r?.book_id) bookPostCounts.set(r.book_id, (bookPostCounts.get(r.book_id) || 0) + 1);
    }

    const bookTitleMap = new Map((bookData || []).map(b => [b.id, b.title]));
    books = [...bookPostCounts.entries()]
      .map(([bookId, count]) => ({ bookId, title: bookTitleMap.get(bookId) || 'Unknown', count }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    recipesCooked,
    avgRating,
    timesCooked,
    comparison: { chef: chefComparison, overall: overallComparison },
    mostCooked,
    concepts,
    signatureIngredients,
    stockUpList,
    books,
  };
}

function emptyChefStats(): ChefStats {
  const empty: NutritionComparison = { avgCalories: 0, avgProtein: 0, vegetarianPct: 0 };
  return {
    recipesCooked: 0,
    avgRating: null,
    timesCooked: 0,
    comparison: { chef: empty, overall: empty },
    mostCooked: [],
    concepts: [],
    signatureIngredients: [],
    stockUpList: [],
    books: [],
  };
}

/**
 * Full book detail page data.
 */
export async function getBookStats(
  userId: string,
  bookId: string
): Promise<BookStats> {
  // Get book info and total recipes
  const [bookRes, allBookRecipesRes] = await Promise.all([
    supabase.from('books').select('id, title, chef_id').eq('id', bookId).maybeSingle(),
    supabase.from('recipes').select('id, title, cooking_concept, cuisine_types, cooking_methods').eq('book_id', bookId),
  ]);

  const bookRecipes = allBookRecipesRes.data || [];
  const totalRecipes = bookRecipes.length;
  const bookRecipeIds = new Set(bookRecipes.map(r => r.id));

  // Get user's posts for recipes in this book
  const { data: posts } = await supabase
    .from('posts')
    .select('id, recipe_id, cooked_at, rating')
    .eq('user_id', userId)
    .eq('post_type', 'dish')
    .not('recipe_id', 'is', null);

  const bookPosts = (posts || []).filter(p => bookRecipeIds.has(p.recipe_id));
  const cookedRecipeIds = new Set(bookPosts.map(p => p.recipe_id));
  const cooked = cookedRecipeIds.size;
  const timesCooked = bookPosts.length;

  const ratings = bookPosts.filter(p => p.rating != null).map(p => p.rating as number);
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  const completionPct = totalRecipes > 0 ? Math.round((cooked / totalRecipes) * 100) : 0;

  // Comparison
  const [bookComparison, overallComparison] = await Promise.all([
    computeNutritionComparison(userId, { column: 'book_id', value: bookId }),
    computeNutritionComparison(userId),
  ]);

  // Most cooked
  const counts = countByRecipe(bookPosts);
  const ratingMap = avgRatingByRecipe(bookPosts);
  const recipeMap = new Map(bookRecipes.map(r => [r.id, r]));

  const sortedCounts = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCount = sortedCounts[0]?.[1] || 1;
  const mostCooked: MostCookedItem[] = sortedCounts.map(([recipeId, count]) => ({
    recipeId,
    title: recipeMap.get(recipeId)?.title || 'Unknown',
    chef: null,
    book: null,
    rating: ratingMap.get(recipeId) ?? null,
    count,
    barPct: Math.round((count / maxCount) * 100),
  }));

  // Highest rated
  const ratedRecipes = [...ratingMap.entries()]
    .filter(([, r]) => r !== null)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 10);
  const highestRated: MostCookedItem[] = ratedRecipes.map(([recipeId, rating]) => ({
    recipeId,
    title: recipeMap.get(recipeId)?.title || 'Unknown',
    chef: null,
    book: null,
    rating,
    count: counts.get(recipeId) || 0,
    barPct: rating != null ? Math.round((rating / 5) * 100) : 0,
  }));

  // Key ingredients
  const cookedRecipeIdList = [...cookedRecipeIds] as string[];
  let keyIngredients: TopIngredientItem[] = [];

  if (cookedRecipeIdList.length > 0) {
    const { data: riData } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id')
      .in('recipe_id', cookedRecipeIdList)
      .not('ingredient_id', 'is', null);

    const ingCounts = new Map<string, number>();
    for (const ri of riData || []) {
      ingCounts.set(ri.ingredient_id, (ingCounts.get(ri.ingredient_id) || 0) + 1);
    }

    const topIngIds = [...ingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([id]) => id);

    if (topIngIds.length > 0) {
      const { data: ingredients } = await supabase
        .from('ingredients')
        .select('id, name, ingredient_type, family')
        .in('id', topIngIds);

      const ingMap = new Map((ingredients || []).map(i => [i.id, i]));
      const maxIng = ingCounts.get(topIngIds[0]) || 1;
      keyIngredients = topIngIds.map(id => {
        const ing = ingMap.get(id);
        const count = ingCounts.get(id) || 0;
        return {
          ingredientId: id,
          name: ing?.name || 'Unknown',
          type: ing?.ingredient_type || null,
          family: ing?.family || null,
          classification: null,
          count,
          barPct: Math.round((count / maxIng) * 100),
        };
      });
    }
  }

  // Cuisines from book recipes
  const cuisineCounts = new Map<string, number>();
  let cuisineTotal = 0;
  for (const r of bookRecipes) {
    if (r.cuisine_types && Array.isArray(r.cuisine_types)) {
      for (const c of r.cuisine_types) {
        cuisineCounts.set(c, (cuisineCounts.get(c) || 0) + 1);
        cuisineTotal++;
      }
    }
  }
  const cuisines: CuisineBreakdownItem[] = [...cuisineCounts.entries()]
    .map(([cuisine, count]) => ({
      cuisine,
      count,
      pct: cuisineTotal > 0 ? Math.round((count / cuisineTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Methods from book recipes
  const methodCounts = new Map<string, number>();
  let methodTotal = 0;
  for (const r of bookRecipes) {
    if (r.cooking_methods && Array.isArray(r.cooking_methods)) {
      for (const m of r.cooking_methods) {
        methodCounts.set(m, (methodCounts.get(m) || 0) + 1);
        methodTotal++;
      }
    }
  }
  const methods: MethodBreakdownItem[] = [...methodCounts.entries()]
    .map(([method, count]) => ({
      method,
      count,
      pct: methodTotal > 0 ? Math.round((count / methodTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    completionPct,
    avgRating,
    timesCooked,
    progress: { cooked, total: totalRecipes },
    comparison: { book: bookComparison, overall: overallComparison },
    mostCooked,
    highestRated,
    keyIngredients,
    cuisines,
    methods,
  };
}

// ── Phase H: Gateway Insights ────────────────────────────────────

export interface GatewayInsights {
  recipes: { insight: string; period: string };
  calories: { insight: string; period: string };
  diversity: { insight: string; period: string };
  social: { insight: string; period: string };
}

/** Period label from DateRange duration */
function periodLabel(dateRange: DateRange): string {
  const days = Math.round((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 90) return '12 weeks';
  if (days <= 185) return '6 months';
  return '1 year';
}

/**
 * Batch insight text for all 4 gateway cards.
 * Compares current period vs prior period for trend insights.
 */
export async function getGatewayInsights(
  params: StatsParams,
  priorDateRange: DateRange
): Promise<GatewayInsights> {
  const priorParams: StatsParams = { ...params, dateRange: priorDateRange };
  const pLabel = periodLabel(params.dateRange);

  const [
    currentCuisines, priorCuisines,
    currentOverview, priorOverview,
    currentDiversity, priorDiversity,
    currentPartners,
  ] = await Promise.all([
    getCuisineBreakdown(params),
    getCuisineBreakdown(priorParams),
    getOverviewStats(params),
    getOverviewStats(priorParams),
    getDiversityScore(params),
    getDiversityScore(priorParams),
    getCookingPartners(params),
  ]);

  // Recipes insight: new cuisines
  const priorCuisineSet = new Set(priorCuisines.map(c => c.cuisine));
  const newCuisineCount = currentCuisines.filter(c => !priorCuisineSet.has(c.cuisine)).length;
  const recipesInsight = newCuisineCount > 0
    ? `${newCuisineCount} new cuisine${newCuisineCount > 1 ? 's' : ''} tried`
    : currentCuisines.length > 0
      ? `${currentCuisines.length} cuisines explored`
      : 'Explore more cuisines';

  // Calories insight: % change
  let caloriesInsight: string;
  if (currentOverview.avgCalories > 0 && priorOverview.avgCalories > 0) {
    const pctChange = Math.round(((currentOverview.avgCalories - priorOverview.avgCalories) / priorOverview.avgCalories) * 100);
    if (pctChange === 0) {
      caloriesInsight = `Steady at ${currentOverview.avgCalories} cal`;
    } else {
      const direction = pctChange > 0 ? 'Up' : 'Down';
      caloriesInsight = `${direction} ${Math.abs(pctChange)}% from prior ${pLabel}`;
    }
  } else if (currentOverview.avgCalories > 0) {
    caloriesInsight = `Avg ${currentOverview.avgCalories} cal per recipe`;
  } else {
    caloriesInsight = 'No calorie data yet';
  }

  // Diversity insight: new methods + tier
  const priorMethodSet = new Set<string>(); // We track method count difference
  const newMethodCount = Math.max(0, currentDiversity.methodCount - priorDiversity.methodCount);
  const diversityInsight = newMethodCount > 0
    ? `${newMethodCount} new method${newMethodCount > 1 ? 's' : ''}`
    : `${currentDiversity.methodCount} methods mastered`;
  const diversityPeriod = `${currentDiversity.label} tier`;

  // Social insight: top partner
  let socialInsight: string;
  let socialPeriod: string;
  if (currentPartners.length > 0) {
    const top = currentPartners[0];
    socialInsight = `Most with ${top.displayName} (${top.count} cooks)`;
    socialPeriod = 'cooked with others';
  } else {
    socialInsight = 'Cook with a friend!';
    socialPeriod = 'no partners yet';
  }

  return {
    recipes: { insight: recipesInsight, period: `in last ${pLabel}` },
    calories: { insight: caloriesInsight, period: 'per recipe average' },
    diversity: { insight: diversityInsight, period: diversityPeriod },
    social: { insight: socialInsight, period: socialPeriod },
  };
}

// ── Phase H: Frontier Suggestions ────────────────────────────────

export interface FrontierSuggestion {
  type: 'cuisine' | 'concept' | 'cookbook';
  title: string;
  label: string;
  description: string;
  recipeId?: string;
  bookId?: string;
}

/**
 * v1 frontier suggestions: high-rated-but-rare cuisines, low-count concepts, untouched cookbooks.
 * Returns top 5, interleaved by type.
 */
export async function getFrontierSuggestions(
  params: StatsParams
): Promise<FrontierSuggestion[]> {
  const [cuisines, concepts, cookbookProgress] = await Promise.all([
    getCuisineBreakdown(params),
    getCookingConcepts(params),
    getCookbookProgress(params.userId),
  ]);

  // 1. High-rated-but-rare cuisines (count ≤ 2)
  // Need avg rating per cuisine — separate query joining posts.rating grouped by cuisine
  const posts = await fetchFilteredPosts(params, 'id, recipe_id, rating');
  const recipes = await fetchRecipesForPosts(posts, 'id, cuisine_types');
  const recipeCuisineMap = new Map<string, string[]>();
  for (const r of recipes) {
    if (r.cuisine_types && Array.isArray(r.cuisine_types)) {
      recipeCuisineMap.set(r.id, r.cuisine_types);
    }
  }

  const cuisineRatings = new Map<string, number[]>();
  for (const p of posts) {
    if (!p.recipe_id || p.rating == null) continue;
    const cs = recipeCuisineMap.get(p.recipe_id);
    if (cs) {
      for (const c of cs) {
        const arr = cuisineRatings.get(c) || [];
        arr.push(p.rating);
        cuisineRatings.set(c, arr);
      }
    }
  }

  // Count recipes per cuisine in user's books
  const { data: userBooks } = await supabase
    .from('user_books')
    .select('book_id')
    .eq('user_id', params.userId);
  const bookIds = (userBooks || []).map(ub => ub.book_id);
  let bookRecipeCuisineCount = new Map<string, number>();
  if (bookIds.length > 0) {
    const { data: bookRecipes } = await supabase
      .from('recipes')
      .select('id, cuisine_types')
      .in('book_id', bookIds);
    for (const r of bookRecipes || []) {
      if (r.cuisine_types && Array.isArray(r.cuisine_types)) {
        for (const c of r.cuisine_types) {
          bookRecipeCuisineCount.set(c, (bookRecipeCuisineCount.get(c) || 0) + 1);
        }
      }
    }
  }

  const cuisineSuggestions: FrontierSuggestion[] = [];
  for (const c of cuisines) {
    if (c.count > 2) continue;
    const ratings = cuisineRatings.get(c.cuisine) || [];
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;
    if (avgRating < 4.0) continue;
    const bookCount = bookRecipeCuisineCount.get(c.cuisine) || 0;
    cuisineSuggestions.push({
      type: 'cuisine',
      title: c.cuisine,
      label: `Rated \u2B50 ${avgRating}`,
      description: `Cooked ${c.count === 1 ? 'once' : 'twice'}, loved it.${bookCount > 0 ? ` ${bookCount} recipes in your books.` : ''}`,
    });
  }

  // 2. Low-count concepts (count ≤ 2)
  const conceptSuggestions: FrontierSuggestion[] = [];
  for (const c of concepts) {
    if (c.count > 2) continue;
    const titleCased = c.concept.charAt(0).toUpperCase() + c.concept.slice(1);
    conceptSuggestions.push({
      type: 'concept',
      title: titleCased,
      label: c.count === 1 ? 'Tried once' : 'Tried twice',
      description: `Only ${c.count} ${c.concept} cooked.`,
    });
  }

  // 3. Untouched cookbook recipes (completion < 50%)
  const cookbookSuggestions: FrontierSuggestion[] = [];
  for (const book of cookbookProgress) {
    if (book.pct >= 50) continue;
    const remaining = book.total - book.cooked;
    cookbookSuggestions.push({
      type: 'cookbook',
      title: book.title,
      label: 'Untouched',
      description: `${remaining} recipes you haven't tried.`,
      bookId: book.bookId,
    });
  }

  // Interleave types, limit to 5
  const result: FrontierSuggestion[] = [];
  const sources = [cuisineSuggestions, conceptSuggestions, cookbookSuggestions];
  const indices = [0, 0, 0];
  while (result.length < 5) {
    let added = false;
    for (let s = 0; s < sources.length; s++) {
      if (indices[s] < sources[s].length && result.length < 5) {
        result.push(sources[s][indices[s]]);
        indices[s]++;
        added = true;
      }
    }
    if (!added) break;
  }

  return result;
}

// ── Phase H: Growth Milestones ───────────────────────────────────

export interface GrowthMilestone {
  period: string;     // "Mar", "Feb", "Jan"
  headline: string;   // "Peak week: 7 meals cooked"
  detail: string;     // "Added fermentation, tried Korean"
}

/**
 * Monthly growth milestones iterating backward from current month.
 * Finds peak weeks, new cuisines/concepts, highest-rated recipes.
 */
export async function getGrowthMilestones(
  userId: string,
  mealType: MealTypeFilter,
  limit: number = 6
): Promise<GrowthMilestone[]> {
  // Fetch all dish posts
  let query = supabase
    .from('posts')
    .select('id, recipe_id, cooked_at, rating')
    .eq('user_id', userId)
    .eq('post_type', 'dish');
  if (mealType !== 'all') query = query.eq('meal_type', mealType);
  query = query.order('cooked_at', { ascending: true });

  const { data, error } = await query;
  if (error || !data || data.length === 0) return [];

  // Fetch recipes for cuisine + concept
  const recipeIds = [...new Set(data.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
  let recipeMap = new Map<string, { cuisine_types: string[]; cooking_concept: string | null; title: string }>();
  if (recipeIds.length > 0) {
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, cuisine_types, cooking_concept, title')
      .in('id', recipeIds);
    for (const r of recipes || []) {
      recipeMap.set(r.id, {
        cuisine_types: r.cuisine_types || [],
        cooking_concept: r.cooking_concept,
        title: r.title,
      });
    }
  }

  // Group posts by calendar month (YYYY-MM)
  const monthPosts = new Map<string, typeof data>();
  for (const p of data) {
    const monthKey = p.cooked_at.substring(0, 7);
    const arr = monthPosts.get(monthKey) || [];
    arr.push(p);
    monthPosts.set(monthKey, arr);
  }

  // Sort months descending
  const months = [...monthPosts.keys()].sort().reverse().slice(0, limit);

  // Track cumulative cuisines/concepts for "new this month" detection
  const allCuisinesBefore = new Set<string>();
  const allConceptsBefore = new Set<string>();
  // We need to process chronologically to build cumulative sets, then generate milestones in reverse
  const allMonthsSorted = [...monthPosts.keys()].sort();
  const monthMilestoneData = new Map<string, {
    posts: typeof data;
    newCuisines: string[];
    newConcepts: string[];
  }>();

  for (const month of allMonthsSorted) {
    const posts = monthPosts.get(month)!;
    const newCuisines: string[] = [];
    const newConcepts: string[] = [];

    for (const p of posts) {
      if (!p.recipe_id) continue;
      const r = recipeMap.get(p.recipe_id);
      if (!r) continue;
      for (const c of r.cuisine_types) {
        if (!allCuisinesBefore.has(c)) {
          newCuisines.push(c);
          allCuisinesBefore.add(c);
        }
      }
      if (r.cooking_concept && !allConceptsBefore.has(r.cooking_concept)) {
        newConcepts.push(r.cooking_concept);
        allConceptsBefore.add(r.cooking_concept);
      }
    }

    monthMilestoneData.set(month, { posts, newCuisines: [...new Set(newCuisines)], newConcepts: [...new Set(newConcepts)] });
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const milestones: GrowthMilestone[] = [];

  for (const month of months) {
    const md = monthMilestoneData.get(month);
    if (!md) continue;
    const monthIdx = parseInt(month.substring(5, 7)) - 1;
    const periodLabel = monthNames[monthIdx];

    // Peak week count
    const weekCounts = new Map<string, number>();
    for (const p of md.posts) {
      const weekKey = toDateStr(getMondayOfWeek(new Date(p.cooked_at)));
      weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
    }
    const peakWeek = Math.max(0, ...Array.from(weekCounts.values()));

    // Highest rated recipe this month
    let bestRating = 0;
    let bestRecipeTitle = '';
    for (const p of md.posts) {
      if (p.rating != null && p.rating > bestRating) {
        bestRating = p.rating;
        if (p.recipe_id) {
          bestRecipeTitle = recipeMap.get(p.recipe_id)?.title || '';
        }
      }
    }

    // Average rating this month
    const ratings = md.posts.filter(p => p.rating != null).map(p => p.rating as number);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    // Choose headline (most notable stat)
    let headline: string;
    if (md.newConcepts.length > 0 && md.newConcepts.length <= 2) {
      headline = `First ${md.newConcepts[0]} of the year`;
    } else if (peakWeek >= 5) {
      headline = `Peak week: ${peakWeek} meals cooked`;
    } else if (avgRating >= 4.5 && ratings.length >= 3) {
      headline = `Highest-rated month (avg ${avgRating})`;
    } else if (peakWeek > 0) {
      headline = `Peak week: ${peakWeek} meals cooked`;
    } else {
      headline = `${md.posts.length} meals cooked`;
    }

    // Build detail
    const detailParts: string[] = [];
    if (md.newCuisines.length > 0) {
      if (md.newCuisines.length <= 2) {
        detailParts.push(`Tried ${md.newCuisines.join(', ')}`);
      } else {
        detailParts.push(`${md.newCuisines.length} new cuisines`);
      }
    }
    if (md.newConcepts.length > 1) {
      detailParts.push(`Added ${md.newConcepts.slice(0, 2).join(', ')}`);
    }
    if (bestRating >= 4.5 && bestRecipeTitle) {
      detailParts.push(`Loved ${bestRecipeTitle}`);
    }
    if (detailParts.length === 0) {
      detailParts.push(`${md.posts.length} meals total`);
    }

    milestones.push({
      period: periodLabel,
      headline,
      detail: detailParts.join('. '),
    });
  }

  return milestones;
}

// ── Phase H: Cooking Personality ─────────────────────────────────

export interface CookingPersonality {
  title: string;      // "The Adventurous Weeknight Cook"
  narrative: string;  // Generated template text
  tags: string[];     // ["17 Cuisines", "Salad Lover", "Weeknight Regular"]
}

/**
 * Template-based cooking personality (NOT AI-generated).
 * Assembles from diversity score, cuisines, concepts, heatmap data.
 */
export async function getCookingPersonality(
  params: StatsParams
): Promise<CookingPersonality> {
  const [diversity, cuisines, concepts, heatmap] = await Promise.all([
    getDiversityScore(params),
    getCuisineBreakdown(params),
    getCookingConcepts(params),
    getCookingHeatmap(params),
  ]);

  // Diversity adjective from tier
  const diversityAdj: Record<string, string> = {
    'Adventurer': 'Adventurous',
    'Explorer': 'Curious',
    'Curious Cook': 'Focused',
    'Creature of Habit': 'Emerging',
  };
  const adj = diversityAdj[diversity.label] || 'Curious';

  // Time pattern from heatmap peak
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdaySlots = heatmap.filter(h => h.day >= 1 && h.day <= 5);
  const weekendSlots = heatmap.filter(h => h.day === 0 || h.day === 6);
  const weekdayTotal = weekdaySlots.reduce((s, h) => s + h.intensity, 0);
  const weekendTotal = weekendSlots.reduce((s, h) => s + h.intensity, 0);

  let timeAdj: string;
  let peakDays: string;
  if (weekdayTotal > 0 && weekdayTotal > weekendTotal * 2) {
    timeAdj = 'Weeknight';
    peakDays = 'weeknights';
  } else if (weekendTotal > 0 && weekendTotal > weekdayTotal * 2) {
    timeAdj = 'Weekend';
    peakDays = 'weekends';
  } else if (weekdayTotal > 0 && weekendTotal > 0) {
    timeAdj = 'Everyday';
    peakDays = 'throughout the week';
  } else {
    timeAdj = 'Batch';
    // Find actual peak day
    const peakCell = heatmap.reduce((a, b) => a.intensity > b.intensity ? a : b, heatmap[0]);
    peakDays = peakCell ? dayNames[peakCell.day] + 's' : 'various days';
  }

  const title = `The ${adj} ${timeAdj} Cook`;

  // Narrative
  const cuisine1 = cuisines[0]?.cuisine || 'various';
  const cuisine2 = cuisines[1]?.cuisine || 'diverse';
  const topConcept = concepts[0]?.concept || 'cooking';

  // Growth percentage: compare recipe count — we can estimate from cuisine/concept diversity
  const startMonth = new Date(params.dateRange.start).toLocaleString('en-US', { month: 'short' });

  const narrative = `You gravitate toward ${cuisine1} and ${cuisine2} flavors, with ${topConcept} as your backbone. You cook most on ${peakDays}. Your repertoire spans ${diversity.cuisineCount} cuisines and ${diversity.methodCount} methods since ${startMonth}.`;

  // Tags
  const tags = [
    `${diversity.cuisineCount} Cuisines`,
    `${diversity.methodCount} Methods`,
    `${topConcept.charAt(0).toUpperCase() + topConcept.slice(1)} Lover`,
    `${timeAdj} Regular`,
  ];

  return { title, narrative, tags };
}
