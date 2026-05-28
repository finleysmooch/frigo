// lib/services/dietaryPreferencesService.ts
// Phase 10F — per-user dietary preferences.
// Single-row-per-user table (`user_dietary_preferences`) mirroring the 8 recipe
// dietary flag columns + `auto_apply_to_browse`.

import { supabase } from '../supabase';

export interface DietaryPreferences {
  user_id: string;
  is_vegan: boolean;
  is_vegetarian: boolean;
  is_gluten_free: boolean;
  is_dairy_free: boolean;
  is_nut_free: boolean;
  is_shellfish_free: boolean;
  is_soy_free: boolean;
  is_egg_free: boolean;
  auto_apply_to_browse: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * 8 dietary flag keys (excludes user_id, auto_apply_to_browse, timestamps).
 * Used for iteration in UI and counting active prefs.
 */
export const DIETARY_FLAG_KEYS = [
  'is_vegan', 'is_vegetarian',
  'is_gluten_free', 'is_dairy_free', 'is_nut_free',
  'is_shellfish_free', 'is_soy_free', 'is_egg_free',
] as const;
export type DietaryFlagKey = typeof DIETARY_FLAG_KEYS[number];

/**
 * Fetch user's dietary preferences. Returns null if the user has never set them
 * (row doesn't exist yet — defaults apply, but caller decides whether to show "Not set").
 */
export async function getDietaryPreferences(
  userId: string
): Promise<DietaryPreferences | null> {
  const { data, error } = await supabase
    .from('user_dietary_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching dietary preferences:', error);
    return null;
  }
  return data;
}

/**
 * Upsert the user's dietary preferences. Pass partial — service merges with current row.
 */
export async function upsertDietaryPreferences(
  userId: string,
  prefs: Partial<Omit<DietaryPreferences, 'user_id' | 'created_at' | 'updated_at'>>
): Promise<DietaryPreferences | null> {
  const { data, error } = await supabase
    .from('user_dietary_preferences')
    .upsert(
      { user_id: userId, ...prefs },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting dietary preferences:', error);
    return null;
  }
  return data;
}

/** Count how many of the 8 dietary flags are true. Used for Settings subtitle. */
export function countActivePreferences(prefs: DietaryPreferences | null): number {
  if (!prefs) return 0;
  return DIETARY_FLAG_KEYS.reduce((count, key) => count + (prefs[key] ? 1 : 0), 0);
}
