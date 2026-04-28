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
import { createGroceryList, updateListItem } from './groceryListsService';

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
 *
 * Phase 8C-CP4: when the resolved new state is 'out', auto-route the staple to
 * the user's primary grocery list. Routing failure is a soft-fail (logged,
 * swallowed) — the state change still succeeds.
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

  const updated = data as PantryStaple;
  if (updated.state === 'out') {
    try {
      await routeStapleToGroceryList(stapleId);
    } catch (routeError) {
      console.error('❌ routeStapleToGroceryList failed (soft-fail):', routeError);
    }
  }

  return updated;
}

/**
 * Set a staple's state directly. For explicit changes from the recipe tap-sheet's
 * "Mark low" / "Mark out" / "Actually have" actions and cook-post depletion.
 * Bumps last_confirmed_at = NOW().
 *
 * Phase 8C-CP4: when newState === 'out', auto-route the staple to the user's
 * primary grocery list. Soft-fail on routing error (state change succeeds).
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

  if (newState === 'out') {
    try {
      await routeStapleToGroceryList(stapleId);
    } catch (routeError) {
      console.error('❌ routeStapleToGroceryList failed (soft-fail):', routeError);
    }
  }

  return data as PantryStaple;
}

// ============================================
// PHASE 8C-CP4 — STAPLE → GROCERY ROUTING
// ============================================

/**
 * Phase 8C-CP4. Auto-route a staple-out event to the user's primary grocery list.
 * Idempotent: re-routing a staple that already has a routed item is a no-op
 * promotion (Stage 1 finds the existing row and refreshes its priority/reason).
 *
 * Algorithm:
 * 1. Resolve acting user via supabase.auth.getUser. Soft-fail if absent.
 * 2. Fetch staple (id, ingredient_id, custom_name).
 * 3. Resolve primary list = acting user's most-recently-updated active list.
 *    Auto-create a 'Groceries' list if none exists.
 * 4. Stage 1 match by source_staple_id on the primary list — if hit, promote
 *    priority + refresh priority_reason.
 * 5. Stage 2 match by ingredient_id (or custom_name when ingredient_id is null),
 *    ORDER BY updated_at DESC LIMIT 1 — if hit, link source_staple_id and promote.
 * 6. Insert new row if no match.
 *
 * Always overwrites priority_reason to 'staple · out' (D8C-CP4-4).
 * Throws if staple not found.
 */
export async function routeStapleToGroceryList(stapleId: string): Promise<void> {
  console.log('🛒 Routing staple to grocery list:', stapleId);

  // Step 4a — resolve acting user.
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.warn('⚠️ routeStapleToGroceryList: auth error; soft-failing', authError);
    return;
  }
  if (!user) {
    console.warn('⚠️ routeStapleToGroceryList: no auth user; soft-failing');
    return;
  }

  // Step 4b — fetch staple.
  const staple = await getStapleById(stapleId);
  if (!staple) throw new StapleNotFoundError(stapleId);

  // Step 4c — resolve primary list (user-scoped, not space-scoped per D8C-CP4-2).
  const { data: listRows, error: listError } = await supabase
    .from('grocery_lists')
    .select('id, updated_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (listError) {
    console.error('❌ routeStapleToGroceryList: error loading primary list:', listError);
    throw listError;
  }

  let primaryListId: string;
  if (!listRows || listRows.length === 0) {
    console.log('🛒 No active list — auto-creating "Groceries" for routing');
    const created = await createGroceryList({ user_id: user.id, name: 'Groceries' });
    primaryListId = created.id;
  } else {
    primaryListId = (listRows[0] as { id: string }).id;
  }

  // Step 4d — Stage 1 dedup by source_staple_id.
  const { data: stage1, error: stage1Error } = await supabase
    .from('grocery_list_items')
    .select('id')
    .eq('list_id', primaryListId)
    .eq('source_staple_id', stapleId)
    .limit(1)
    .maybeSingle();

  if (stage1Error) {
    console.error('❌ routeStapleToGroceryList: Stage 1 query error:', stage1Error);
    throw stage1Error;
  }

  if (stage1) {
    console.log('🛒 Stage 1 hit — promoting existing routed row');
    await updateListItem((stage1 as { id: string }).id, {
      priority: 'needed',
      priority_reason: 'staple · out',
    });
    return;
  }

  // Step 4e — Stage 2 dedup by ingredient_id / custom_name.
  let stage2Query = supabase
    .from('grocery_list_items')
    .select('id')
    .eq('list_id', primaryListId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (staple.ingredient_id) {
    stage2Query = stage2Query.eq('ingredient_id', staple.ingredient_id);
  } else if (staple.custom_name) {
    stage2Query = stage2Query.is('ingredient_id', null).eq('custom_name', staple.custom_name);
  } else {
    // Defensive — staple insert path enforces at least one identity, so this
    // branch should be unreachable. Skip Stage 2 and fall through to insert.
    stage2Query = stage2Query.eq('id', '00000000-0000-0000-0000-000000000000'); // forces no-match
  }

  const { data: stage2, error: stage2Error } = await stage2Query.maybeSingle();

  if (stage2Error) {
    console.error('❌ routeStapleToGroceryList: Stage 2 query error:', stage2Error);
    throw stage2Error;
  }

  if (stage2) {
    console.log('🛒 Stage 2 hit — linking source_staple_id and promoting');
    await updateListItem((stage2 as { id: string }).id, {
      priority: 'needed',
      priority_reason: 'staple · out',
      source_staple_id: stapleId,
    });
    return;
  }

  // Step 4f — Stage 3 insert.
  console.log('🛒 No match — inserting new routed row');
  const insertRow = {
    list_id: primaryListId,
    user_id: user.id,
    ingredient_id: staple.ingredient_id,
    custom_name: staple.custom_name,
    quantity_display: 1,
    unit_display: 'unit',
    priority: 'needed' as const,
    priority_reason: 'staple · out',
    added_from: 'staple' as const,
    source_staple_id: staple.id,
    is_in_cart: false,
  };

  const { error: insertError } = await supabase
    .from('grocery_list_items')
    .insert(insertRow);

  if (insertError) {
    console.error('❌ routeStapleToGroceryList: insert error:', insertError);
    throw insertError;
  }

  console.log('✅ Staple routed to grocery list');
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
