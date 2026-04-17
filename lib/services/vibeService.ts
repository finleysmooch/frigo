// lib/services/vibeService.ts
// Vibe tag helpers for feed card rendering (Phase 7F)
//
// Vibe data lives in recipes.vibe_tags (JSONB string array).
// The build prompt references "recipe_vibe_tags" as an existing taxonomy,
// but the actual source of truth is the vibe_tags column on the recipes table.
//
// Personalization is deferred (P7-40/P7-41). The pill is static for all viewers
// in 7F. When viewer-taste-profile model lands (Phase 11), vibe pill selection
// becomes viewer-relevance-driven per Q36 hybrid b.

import { supabase } from '../supabase';

export interface VibeTag {
  emoji: string;
  label: string;
}

// Known vibe tag → emoji mapping
const VIBE_EMOJI_MAP: Record<string, string> = {
  'comfort': '🍲',
  'fresh & light': '🌿',
  'crowd-pleaser': '👥',
  'quick & easy': '⚡',
  'indulgent': '🍫',
  'healthy': '🥗',
  'spicy': '🌶️',
  'classic': '📚',
  'adventurous': '🌍',
  'seasonal': '🍂',
  'family-friendly': '👨‍👩‍👧‍👦',
  'date night': '🕯️',
  'meal prep': '📦',
  'weekend project': '🔨',
};

/**
 * Get the first vibe tag for a recipe, formatted as VibeTag.
 * Returns null if the recipe has no vibe tags.
 */
export async function getRecipeVibe(recipeId: string): Promise<VibeTag | null> {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('vibe_tags')
      .eq('id', recipeId)
      .single();

    if (error || !data?.vibe_tags || !Array.isArray(data.vibe_tags) || data.vibe_tags.length === 0) {
      return null;
    }

    return formatVibeTag(data.vibe_tags[0]);
  } catch {
    return null;
  }
}

/**
 * Get vibe from pre-fetched vibe_tags array (avoids extra query when data is already loaded).
 */
export function getVibeFromTags(vibeTags: string[] | null | undefined): VibeTag | null {
  if (!vibeTags || vibeTags.length === 0) return null;
  return formatVibeTag(vibeTags[0]);
}

/**
 * Human-readable overrides for vibe tags that need special formatting
 * (punctuation, custom capitalization). Any tag not in this map falls back
 * to the generic transform: underscores → spaces, first letter capitalized.
 * Fix Pass 6 / Fix 3.
 */
const VIBE_LABEL_OVERRIDES: Record<string, string> = {
  'fresh_and_light': 'Fresh & light',
  'fresh and light': 'Fresh & light',
  'crowd_pleaser': 'Crowd-pleaser',
  'crowd-pleaser': 'Crowd-pleaser',
  'family_friendly': 'Family-friendly',
  'family-friendly': 'Family-friendly',
  'date_night': 'Date night',
  'meal_prep': 'Meal prep',
  'weeknight_quick': 'Weeknight quick',
  'quick_and_easy': 'Quick & easy',
  'quick & easy': 'Quick & easy',
  'weekend_project': 'Weekend project',
};

function formatVibeLabel(tag: string): string {
  const normalized = tag.toLowerCase().trim();
  if (VIBE_LABEL_OVERRIDES[normalized]) return VIBE_LABEL_OVERRIDES[normalized];
  return normalized
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Format a raw vibe tag string into a VibeTag with emoji + display label.
 */
function formatVibeTag(tag: string): VibeTag {
  const normalized = tag.toLowerCase().trim();
  const emoji = VIBE_EMOJI_MAP[normalized] || '✨';
  return { emoji, label: formatVibeLabel(normalized) };
}

/**
 * Compute the meal-level vibe by aggregating across its dishes.
 * Picks the most common tag. When tied, picks alphabetically (deterministic).
 * Returns null when no recipe-backed dishes have vibe tags.
 */
export async function computeMealVibe(mealId: string): Promise<VibeTag | null> {
  try {
    // Get recipe IDs for all dishes in the meal
    const { data: dishes, error } = await supabase
      .from('dish_courses')
      .select('dish_id')
      .eq('meal_id', mealId);

    if (error || !dishes || dishes.length === 0) return null;

    const dishIds = dishes.map(d => d.dish_id);

    // Get recipe_id for each dish
    const { data: dishPosts } = await supabase
      .from('posts')
      .select('recipe_id')
      .in('id', dishIds)
      .not('recipe_id', 'is', null);

    if (!dishPosts || dishPosts.length === 0) return null;

    const recipeIds = dishPosts.map(d => d.recipe_id).filter(Boolean) as string[];
    if (recipeIds.length === 0) return null;

    // Get vibe_tags for all recipes
    const { data: recipes } = await supabase
      .from('recipes')
      .select('vibe_tags')
      .in('id', recipeIds);

    if (!recipes) return null;

    // Count tag frequencies
    const tagCounts = new Map<string, number>();
    for (const recipe of recipes) {
      if (recipe.vibe_tags && Array.isArray(recipe.vibe_tags)) {
        for (const tag of recipe.vibe_tags) {
          const normalized = tag.toLowerCase().trim();
          tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
        }
      }
    }

    if (tagCounts.size === 0) return null;

    // Pick most common, alphabetical tiebreak
    let bestTag = '';
    let bestCount = 0;
    for (const [tag, count] of tagCounts) {
      if (count > bestCount || (count === bestCount && tag < bestTag)) {
        bestTag = tag;
        bestCount = count;
      }
    }

    return formatVibeTag(bestTag);
  } catch {
    return null;
  }
}
