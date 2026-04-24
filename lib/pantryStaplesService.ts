// ============================================
// FRIGO - PANTRY STAPLES SERVICE (SPACE-SCOPED)
// ============================================
// Supabase functions for pantry staples — space-scoped, state-based.
// Separate from pantryService (different data shape: no quantity, no expiration).
// Location: lib/pantryStaplesService.ts
// Introduced: Phase 8B-CP1 (service layer only; UI is 8B-CP2).
// ============================================

import { supabase } from './supabase';
import {
  PantryStaple,
  PantryStapleInsert,
  PantryStapleUpdate,
  StapleState,
} from './types/pantry';

// ============================================
// TYPES (in-file — service-specific, not shared)
// ============================================

// Shape returned by getStaplesBySpace: staple row + denormalized ingredient name.
// Custom-named staples have ingredient_name = null (use custom_name instead).
export interface PantryStapleWithIngredientName extends PantryStaple {
  ingredient_name: string | null;
}

export class DuplicateStapleError extends Error {
  constructor(name: string) {
    super(`Staple "${name}" is already on your list`);
    this.name = 'DuplicateStapleError';
  }
}

export class StapleNotFoundError extends Error {
  constructor(id: string) {
    super(`Staple ${id} not found or not accessible`);
    this.name = 'StapleNotFoundError';
  }
}

// ============================================
// INTERNAL HELPERS
// ============================================

const STATE_SORT_PRIORITY: Record<StapleState, number> = {
  out: 0,
  running_low: 1,
  good: 2,
  unknown: 3,
};

function nextState(current: StapleState): StapleState {
  switch (current) {
    case 'unknown':
      return 'good'; // first confirmation — unknown exits permanently
    case 'good':
      return 'running_low';
    case 'running_low':
      return 'out';
    case 'out':
      return 'good';
  }
}

// Supabase / PostgREST surfaces PostgreSQL unique_violation as code '23505'.
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

// Phase 8B-CP3a: case-insensitive + cross-boundary duplicate guard.
// Before inserting a new staple, check whether any existing staple in the
// same space has the same display name (custom_name OR joined ingredient.name,
// compared after trim + lowercase). If so, throw DuplicateStapleError so the
// caller surfaces "[Name] is already on your list" rather than inserting a
// case variant or a cross-identity duplicate.
// The DB-level UNIQUE(space_id, ingredient_id, custom_name) stays as a race
// safety net (caller still handles 23505 → DuplicateStapleError).
async function throwIfDisplayNameTaken(
  spaceId: string,
  candidateName: string
): Promise<void> {
  const normalized = candidateName.trim().toLowerCase();
  if (!normalized) return; // empty candidate — let downstream insert validation handle it.

  const { data, error } = await supabase
    .from('pantry_staples')
    .select('id, custom_name, ingredient:ingredients(name)')
    .eq('space_id', spaceId);

  if (error) {
    console.error('❌ Error loading staples for duplicate check:', error);
    throw error;
  }

  for (const row of data || []) {
    const r = row as {
      custom_name: string | null;
      ingredient: { name: string } | null;
    };
    const display = (r.custom_name ?? r.ingredient?.name ?? '').trim().toLowerCase();
    if (display && display === normalized) {
      throw new DuplicateStapleError(candidateName);
    }
  }
}

// ============================================
// READ
// ============================================

/**
 * Get all staples for a space. Joined with ingredients(name) for display; flattened
 * to `ingredient_name` on each row. Sorted client-side by state priority
 * (out → running_low → good → unknown), then alphabetical by display name.
 *
 * Client-side sort rather than SQL CASE: PostgREST `.order()` doesn't accept
 * raw expressions, and 8A-CP1's migration didn't add a state_priority generated
 * column. Staple counts per space are small (<100), so the overhead is trivial.
 */
export async function getStaplesBySpace(
  spaceId: string
): Promise<PantryStapleWithIngredientName[]> {
  console.log('📦 Loading staples for space:', spaceId);

  const { data, error } = await supabase
    .from('pantry_staples')
    .select('*, ingredient:ingredients(name)')
    .eq('space_id', spaceId);

  if (error) {
    console.error('❌ Error loading staples:', error);
    throw error;
  }

  const flattened: PantryStapleWithIngredientName[] = (data || []).map((row) => {
    const { ingredient, ...rest } = row as PantryStaple & {
      ingredient: { name: string } | null;
    };
    return {
      ...rest,
      ingredient_name: ingredient?.name ?? null,
    };
  });

  flattened.sort((a, b) => {
    const stateDiff = STATE_SORT_PRIORITY[a.state] - STATE_SORT_PRIORITY[b.state];
    if (stateDiff !== 0) return stateDiff;
    const aName = (a.ingredient_name ?? a.custom_name ?? '').toLowerCase();
    const bName = (b.ingredient_name ?? b.custom_name ?? '').toLowerCase();
    return aName.localeCompare(bName);
  });

  console.log('📦 Found', flattened.length, 'staples in space');
  return flattened;
}

/**
 * Get a single staple by ID. Returns null if not found or not accessible via RLS.
 */
export async function getStapleById(stapleId: string): Promise<PantryStaple | null> {
  const { data, error } = await supabase
    .from('pantry_staples')
    .select('*')
    .eq('id', stapleId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error loading staple:', error);
    throw error;
  }

  return (data as PantryStaple | null) ?? null;
}

/**
 * Search ingredients by ILIKE prefix match on name. Case-insensitive.
 * Returns ingredient rows + a boolean flagging whether each is already a staple
 * in the given space, so the UI can grey out duplicates.
 * Returns [] for empty / whitespace queries to avoid unbounded fetches.
 */
export async function searchIngredientsForStapleAdd(
  spaceId: string,
  searchQuery: string
): Promise<Array<{ id: string; name: string; already_staple: boolean }>> {
  const q = searchQuery.trim();
  if (q.length === 0) return [];

  console.log('📦 Searching ingredients for staple add:', { spaceId, q });

  const [ingredientsResult, stapleResult] = await Promise.all([
    supabase
      .from('ingredients')
      .select('id, name')
      .ilike('name', `${q}%`)
      .order('name')
      .limit(30),
    supabase
      .from('pantry_staples')
      .select('ingredient_id')
      .eq('space_id', spaceId)
      .not('ingredient_id', 'is', null),
  ]);

  if (ingredientsResult.error) {
    console.error('❌ Error searching ingredients:', ingredientsResult.error);
    throw ingredientsResult.error;
  }
  if (stapleResult.error) {
    console.error('❌ Error loading existing staples for duplicate check:', stapleResult.error);
    throw stapleResult.error;
  }

  const existingIds = new Set(
    (stapleResult.data || [])
      .map((row) => (row as { ingredient_id: string | null }).ingredient_id)
      .filter((id): id is string => id !== null)
  );

  return (ingredientsResult.data || []).map((row) => {
    const r = row as { id: string; name: string };
    return {
      id: r.id,
      name: r.name,
      already_staple: existingIds.has(r.id),
    };
  });
}

/**
 * Check whether a given ingredient_id is already a staple in this space.
 * Lets callers prevent duplicate adds before the DB rejects them.
 */
export async function isIngredientAlreadyStaple(
  spaceId: string,
  ingredientId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('pantry_staples')
    .select('id')
    .eq('space_id', spaceId)
    .eq('ingredient_id', ingredientId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error checking staple duplicate:', error);
    throw error;
  }

  return data !== null;
}

// ============================================
// CREATE
// ============================================

/**
 * Add a staple by ingredient_id. Default state is 'unknown' with last_confirmed_at=NULL
 * so the user's first tap counts as the initial confirmation.
 * Throws DuplicateStapleError on unique-constraint violation.
 */
export async function addStapleByIngredient(
  spaceId: string,
  ingredientId: string,
  addedBy: string,
  initialState: StapleState = 'unknown'
): Promise<PantryStaple> {
  console.log('📦 Adding staple by ingredient:', { spaceId, ingredientId });

  // 8B-CP3a Part 5: fetch ingredient name + run cross-boundary dedup check.
  const { data: ingredient, error: ingredientError } = await supabase
    .from('ingredients')
    .select('name')
    .eq('id', ingredientId)
    .maybeSingle();

  if (ingredientError) {
    console.error('❌ Error fetching ingredient for duplicate check:', ingredientError);
    throw ingredientError;
  }

  const ingredientName = (ingredient as { name: string } | null)?.name ?? '';
  if (ingredientName) {
    await throwIfDisplayNameTaken(spaceId, ingredientName);
  }

  const insert: PantryStapleInsert = {
    space_id: spaceId,
    ingredient_id: ingredientId,
    state: initialState,
    last_confirmed_at: initialState === 'unknown' ? null : new Date().toISOString(),
    added_by: addedBy,
  };

  const { data, error } = await supabase
    .from('pantry_staples')
    .insert(insert)
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) throw new DuplicateStapleError(ingredientName || ingredientId);
    console.error('❌ Error adding staple by ingredient:', error);
    throw error;
  }

  return data as PantryStaple;
}

/**
 * Add a custom-named staple (branded items like "Motor City pizza" that don't
 * map to the ingredients table). Throws DuplicateStapleError on unique violation.
 */
export async function addStapleByCustomName(
  spaceId: string,
  customName: string,
  addedBy: string,
  initialState: StapleState = 'unknown'
): Promise<PantryStaple> {
  console.log('📦 Adding custom-named staple:', { spaceId, customName });

  // 8B-CP3a Part 4: case-insensitive + cross-boundary dedup check.
  await throwIfDisplayNameTaken(spaceId, customName);

  const insert: PantryStapleInsert = {
    space_id: spaceId,
    custom_name: customName,
    state: initialState,
    last_confirmed_at: initialState === 'unknown' ? null : new Date().toISOString(),
    added_by: addedBy,
  };

  const { data, error } = await supabase
    .from('pantry_staples')
    .insert(insert)
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) throw new DuplicateStapleError(customName);
    console.error('❌ Error adding custom staple:', error);
    throw error;
  }

  return data as PantryStaple;
}

// ============================================
// UPDATE — state cycling
// ============================================

/**
 * Cycle a staple's state per canonical rules:
 *   unknown → good (first confirmation)
 *   good → running_low → out → good → ...
 * Bumps last_confirmed_at = NOW() on EVERY transition (including unknown→good).
 * Throws StapleNotFoundError if ID doesn't exist in user's accessible spaces.
 */
export async function cycleStapleState(stapleId: string): Promise<PantryStaple> {
  console.log('📦 Cycling staple state:', stapleId);

  const current = await getStapleById(stapleId);
  if (!current) throw new StapleNotFoundError(stapleId);

  const patch: PantryStapleUpdate = {
    state: nextState(current.state),
    last_confirmed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('pantry_staples')
    .update(patch)
    .eq('id', stapleId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error cycling staple state:', error);
    throw error;
  }

  return data as PantryStaple;
}

/**
 * Set a staple's state directly. For explicit changes from the recipe tap-sheet's
 * "Mark low" / "Mark out" / "Actually have" actions and cook-post depletion.
 * Bumps last_confirmed_at = NOW().
 */
export async function setStapleState(
  stapleId: string,
  newState: StapleState
): Promise<PantryStaple> {
  console.log('📦 Setting staple state:', { stapleId, newState });

  const patch: PantryStapleUpdate = {
    state: newState,
    last_confirmed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('pantry_staples')
    .update(patch)
    .eq('id', stapleId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('❌ Error setting staple state:', error);
    throw error;
  }

  if (!data) throw new StapleNotFoundError(stapleId);
  return data as PantryStaple;
}

/**
 * Update a staple's custom_name. Does NOT bump last_confirmed_at — this is
 * metadata editing, not state engagement.
 */
export async function updateStapleCustomName(
  stapleId: string,
  customName: string
): Promise<PantryStaple> {
  console.log('📦 Updating staple custom_name:', { stapleId, customName });

  const { data, error } = await supabase
    .from('pantry_staples')
    .update({ custom_name: customName } as PantryStapleUpdate)
    .eq('id', stapleId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('❌ Error updating staple custom_name:', error);
    throw error;
  }

  if (!data) throw new StapleNotFoundError(stapleId);
  return data as PantryStaple;
}

// ============================================
// DELETE
// ============================================

/**
 * Hard-delete a staple.
 */
export async function deleteStaple(stapleId: string): Promise<void> {
  console.log('📦 Deleting staple:', stapleId);

  const { error } = await supabase
    .from('pantry_staples')
    .delete()
    .eq('id', stapleId);

  if (error) {
    console.error('❌ Error deleting staple:', error);
    throw error;
  }
}

// ============================================
// HELPER (pure)
// ============================================

/**
 * Display name for a staple regardless of identity source. Prefers the
 * denormalized ingredient_name (from getStaplesBySpace's join); falls back
 * to custom_name for branded items.
 */
export function getStapleDisplayName(
  staple: PantryStaple & { ingredient_name?: string | null }
): string {
  return staple.ingredient_name ?? staple.custom_name ?? '';
}
