// ============================================
// FRIGO — NEEDS SERVICE (Phase 8R-CP2b)
// ============================================
// Transient household needs. Status cycle per Q7: need → in_cart → acquired.
// Q49: getNeedsForView default status filter is ['need'] only.
// Q50: cycleNeedStatus treats 'acquired' as terminal (no-op + console.warn).
// Q42: view-filter query splits DB (space + status) from JS (tag predicates).
// Q46: all param/return interfaces live in lib/types/.
// ============================================

import { supabase } from '../supabase';
import {
  AddNeedFromRecipeParams,
  CreateNeedParams,
  MergedNeedGroup,
  Need,
  NeedIngredient,
  NeedRecipe,
  NeedStatus,
  NeedWithDetails,
  NeedWithTags,
  UpdateNeedParams,
} from '../types/needs';
import {
  CreateLotParams,
  StorageLocation,
  SupplyLot,
  SupplyStatus,
} from '../types/supplies';
import { Tag } from '../types/tags';
import { createLot } from './lotsService';
import { getSupplyById, setSupplyStatus } from './suppliesService';
import { getTagsForSpace, setNeedTags } from './tagsService';

// ============================================
// ERROR CLASSES
// ============================================

export class NeedNotFoundError extends Error {
  constructor(id: string) {
    super(`Need ${id} not found or not accessible`);
    this.name = 'NeedNotFoundError';
  }
}

// ============================================
// INTERNAL HELPERS
// ============================================

const STATUS_SORT_PRIORITY: Record<NeedStatus, number> = {
  need: 0,
  in_cart: 1,
  acquired: 2,
};

const STATUS_CYCLE_NEXT: Record<NeedStatus, NeedStatus | null> = {
  need: 'in_cart',
  in_cart: 'acquired',
  acquired: null, // terminal per Q50
};

const NEED_SELECT = `
  *,
  ingredient:ingredients(id, name, plural_name, family, ingredient_type, typical_store_section),
  need_tags(tag:tags(*))
`;

const NEED_DETAILS_SELECT = `
  *,
  ingredient:ingredients(id, name, plural_name, family, ingredient_type, typical_store_section),
  need_tags(tag:tags(*)),
  needs_recipes(*, recipe:recipes(title))
`;

function flattenNeedRow(
  row: Need & {
    ingredient: NeedIngredient | null;
    need_tags: Array<{ tag: Tag | null }> | null;
  }
): NeedWithTags {
  const { ingredient, need_tags, ...rest } = row;
  const tags = (need_tags ?? [])
    .map((t) => t.tag)
    .filter((t): t is Tag => t !== null);
  return {
    ...rest,
    ingredient: ingredient ?? null,
    tags,
  };
}

function flattenNeedDetailsRow(
  row: Need & {
    ingredient: NeedIngredient | null;
    need_tags: Array<{ tag: Tag | null }> | null;
    needs_recipes:
      | Array<{
          id: string;
          need_id: string;
          recipe_id: string;
          recipe_quantity_amount: number | null;
          recipe_quantity_unit: string | null;
          added_by: string | null;
          created_at: string;
          recipe: { title: string } | null;
        }>
      | null;
  }
): NeedWithDetails {
  const { ingredient, need_tags, needs_recipes, ...rest } = row;
  const tags = (need_tags ?? [])
    .map((t) => t.tag)
    .filter((t): t is Tag => t !== null);
  const recipes: NeedRecipe[] = (needs_recipes ?? []).map((r) => ({
    id: r.id,
    need_id: r.need_id,
    recipe_id: r.recipe_id,
    recipe_quantity_amount: r.recipe_quantity_amount,
    recipe_quantity_unit: r.recipe_quantity_unit,
    added_by: r.added_by,
    created_at: r.created_at,
    recipe_title: r.recipe?.title,
  }));
  return {
    ...rest,
    ingredient: ingredient ?? null,
    tags,
    recipes,
  };
}

function getNeedDisplayNameInternal(need: NeedWithTags): string {
  return need.ingredient?.name ?? need.custom_name ?? '';
}

// CP6d-Schema (Gap-G41): softened dedup uses the display merge predicate.
// Treats null / undefined / '' as equivalent for unit_display. Compares
// store-tag sets only (urgency / recipe / etc don't gate merge). Compares
// for_user_ids as a sorted set.
function matchesMergePredicate(
  candidate: Need & { need_tags: Array<{ tag: Tag | null }> | null },
  params: CreateNeedParams,
  storeTagIdsForSpace: Set<string>
): boolean {
  const normUnit = (u: string | null | undefined): string | null => {
    if (u === null || u === undefined || u === '') return null;
    return u;
  };
  if (normUnit(candidate.unit_display) !== normUnit(params.unitDisplay)) {
    return false;
  }

  const candStoreTags = new Set(
    (candidate.need_tags ?? [])
      .map((row) => row.tag)
      .filter((t): t is Tag => t !== null && t.dimension === 'store')
      .map((t) => t.id)
  );
  const paramStoreTags = new Set(
    (params.tagIds ?? []).filter((id) => storeTagIdsForSpace.has(id))
  );
  if (candStoreTags.size !== paramStoreTags.size) return false;
  for (const id of candStoreTags) {
    if (!paramStoreTags.has(id)) return false;
  }

  const candFor = [...candidate.for_user_ids].sort();
  const paramFor = [...(params.forUserIds ?? [])].sort();
  if (candFor.length !== paramFor.length) return false;
  for (let i = 0; i < candFor.length; i++) {
    if (candFor[i] !== paramFor[i]) return false;
  }

  return true;
}

function sortNeeds<T extends NeedWithTags>(rows: T[]): T[] {
  rows.sort((a, b) => {
    const statusDiff = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;
    const aName = getNeedDisplayNameInternal(a).toLowerCase();
    const bName = getNeedDisplayNameInternal(b).toLowerCase();
    return aName.localeCompare(bName);
  });
  return rows;
}

// ============================================
// READ
// ============================================

export async function getNeedsForSpace(spaceId: string): Promise<NeedWithTags[]> {
  console.log('🛒 Loading needs for space:', spaceId);

  const { data, error } = await supabase
    .from('needs')
    .select(NEED_SELECT)
    .eq('space_id', spaceId);

  if (error) {
    console.error('❌ Error loading needs:', error);
    throw error;
  }

  const flattened = (data ?? []).map((row) =>
    flattenNeedRow(
      row as Need & {
        ingredient: NeedIngredient | null;
        need_tags: Array<{ tag: Tag | null }> | null;
      }
    )
  );
  return sortNeeds(flattened);
}

export async function getNeedById(needId: string): Promise<NeedWithDetails | null> {
  const { data, error } = await supabase
    .from('needs')
    .select(NEED_DETAILS_SELECT)
    .eq('id', needId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error loading need:', error);
    throw error;
  }

  if (!data) return null;
  return flattenNeedDetailsRow(
    data as Need & {
      ingredient: NeedIngredient | null;
      need_tags: Array<{ tag: Tag | null }> | null;
      needs_recipes: Array<{
        id: string;
        need_id: string;
        recipe_id: string;
        recipe_quantity_amount: number | null;
        recipe_quantity_unit: string | null;
        added_by: string | null;
        created_at: string;
        recipe: { title: string } | null;
      }> | null;
    }
  );
}

export async function getNeedsByStatus(
  spaceId: string,
  statuses: NeedStatus[]
): Promise<NeedWithTags[]> {
  if (statuses.length === 0) return [];

  console.log('🛒 Loading needs by status:', { spaceId, statuses });

  const { data, error } = await supabase
    .from('needs')
    .select(NEED_SELECT)
    .eq('space_id', spaceId)
    .in('status', statuses);

  if (error) {
    console.error('❌ Error loading needs by status:', error);
    throw error;
  }

  const flattened = (data ?? []).map((row) =>
    flattenNeedRow(
      row as Need & {
        ingredient: NeedIngredient | null;
        need_tags: Array<{ tag: Tag | null }> | null;
      }
    )
  );
  return sortNeeds(flattened);
}

// ============================================
// VIEW FILTER QUERY (Q42)
// ============================================

/**
 * Fetch needs matching a view's filter predicates.
 * - DB query: space_id + status (indexed, scope-bounded).
 * - JS post-query: tag-dimension predicates (AND across dimensions, OR within).
 * - Q49: default status filter is ['need'] when the view has no explicit status filter.
 * - Q5/Q11: urgency derived hierarchy — 'this-week' includes 'today';
 *   'this-month' includes 'today' + 'this-week'.
 */
/**
 * Fetch needs for a view's filter predicates. When `statusOverride` is
 * provided, the view's own status filter is IGNORED and the override is used
 * instead. Tag predicates (urgency, store, recipe, etc.) still apply from the
 * view. Used by the cart-footer surface to fetch in_cart needs from a
 * need-only view (CP6c Part 4).
 */
export async function getNeedsForView(
  viewId: string,
  includeRecipes: boolean = false,
  statusOverride?: NeedStatus[]
): Promise<NeedWithDetails[]> {
  console.log('🛒 Loading needs for view:', { viewId, includeRecipes, statusOverride });

  // 1. Read the view + its filters.
  const { data: view, error: viewError } = await supabase
    .from('views')
    .select('id, space_id, name, is_default, view_filters(*)')
    .eq('id', viewId)
    .maybeSingle();

  if (viewError) {
    console.error('❌ Error loading view for filter query:', viewError);
    throw viewError;
  }
  if (!view) return [];

  const viewRow = view as {
    id: string;
    space_id: string;
    name: string;
    is_default: boolean;
    view_filters: Array<{ id: string; view_id: string; dimension: string; values: string[] }> | null;
  };

  const filters = viewRow.view_filters ?? [];
  const statusFilter = filters.find((f) => f.dimension === 'status');
  const tagFilters = filters.filter((f) => f.dimension !== 'status');

  // 2. Build Supabase query: space_id + status (DB-handled).
  // statusOverride wins over the view's own status filter when provided
  // (CP6c Part 4: cart footer fetches in_cart needs from a need-only view).
  const statusValues = statusOverride
    ? statusOverride
    : statusFilter
    ? (statusFilter.values as NeedStatus[])
    : (['need'] as NeedStatus[]); // Q49 default

  const { data, error } = await supabase
    .from('needs')
    .select(NEED_SELECT)
    .eq('space_id', viewRow.space_id)
    .in('status', statusValues);

  if (error) {
    console.error('❌ Error loading needs for view:', error);
    throw error;
  }

  let needs = (data ?? []).map((row) =>
    flattenNeedRow(
      row as Need & {
        ingredient: NeedIngredient | null;
        need_tags: Array<{ tag: Tag | null }> | null;
      }
    )
  );

  // 4. Tag-predicate evaluation in JS (AND across dimensions; OR within).
  for (const f of tagFilters) {
    const allowedValues = expandUrgencyValues(f.dimension, f.values);
    needs = needs.filter((need) =>
      need.tags.some(
        (t) => t.dimension === f.dimension && allowedValues.includes(t.value)
      )
    );
  }

  // 4b. 8R-UX1: Long List excludes "private" custom-list items. Privacy is
  // encoded in the event tag value via the `__private` suffix (set in
  // ViewCreatorModal when the user picks "Just this list"). Standalone
  // lists' items live only in their own view; Long List would otherwise
  // include them since its only filter is status=need.
  if (viewRow.is_default && viewRow.name === 'Long List') {
    needs = needs.filter(
      (need) =>
        !need.tags.some(
          (t) => t.dimension === 'event' && t.value.endsWith('__private')
        )
    );
  }

  const sorted = sortNeeds(needs);

  // 5. Hydrate recipes — either empty arrays (default) or batch-fetched.
  if (!includeRecipes) {
    return sorted.map((n) => ({ ...n, recipes: [] as NeedRecipe[] }));
  }

  if (sorted.length === 0) return [];

  const needIds = sorted.map((n) => n.id);
  const { data: recipeRows, error: recipeError } = await supabase
    .from('needs_recipes')
    .select('*, recipe:recipes(title)')
    .in('need_id', needIds);

  if (recipeError) {
    console.error('❌ Error batch-loading recipes for needs:', recipeError);
    throw recipeError;
  }

  const recipesByNeed = new Map<string, NeedRecipe[]>();
  for (const row of recipeRows ?? []) {
    const r = row as {
      id: string;
      need_id: string;
      recipe_id: string;
      recipe_quantity_amount: number | null;
      recipe_quantity_unit: string | null;
      added_by: string | null;
      created_at: string;
      recipe: { title: string } | null;
    };
    const list = recipesByNeed.get(r.need_id) ?? [];
    list.push({
      id: r.id,
      need_id: r.need_id,
      recipe_id: r.recipe_id,
      recipe_quantity_amount: r.recipe_quantity_amount,
      recipe_quantity_unit: r.recipe_quantity_unit,
      added_by: r.added_by,
      created_at: r.created_at,
      recipe_title: r.recipe?.title,
    });
    recipesByNeed.set(r.need_id, list);
  }

  return sorted.map((n) => ({
    ...n,
    recipes: recipesByNeed.get(n.id) ?? [],
  }));
}

// Q5/Q11: urgency derived hierarchy.
function expandUrgencyValues(dimension: string, values: string[]): string[] {
  if (dimension !== 'urgency') return values;

  const expanded = new Set<string>(values);
  if (values.includes('this-week')) {
    expanded.add('today');
  }
  if (values.includes('this-month')) {
    expanded.add('today');
    expanded.add('this-week');
  }
  return Array.from(expanded);
}

// ============================================
// RECIPE ATTRIBUTION (Q6)
// ============================================

export async function getRecipesForNeed(needId: string): Promise<NeedRecipe[]> {
  const { data, error } = await supabase
    .from('needs_recipes')
    .select('*, recipe:recipes(title)')
    .eq('need_id', needId);

  if (error) {
    console.error('❌ Error loading recipes for need:', error);
    throw error;
  }

  return (data ?? []).map((r) => {
    const row = r as {
      id: string;
      need_id: string;
      recipe_id: string;
      recipe_quantity_amount: number | null;
      recipe_quantity_unit: string | null;
      added_by: string | null;
      created_at: string;
      recipe: { title: string } | null;
    };
    return {
      id: row.id,
      need_id: row.need_id,
      recipe_id: row.recipe_id,
      recipe_quantity_amount: row.recipe_quantity_amount,
      recipe_quantity_unit: row.recipe_quantity_unit,
      added_by: row.added_by,
      created_at: row.created_at,
      recipe_title: row.recipe?.title,
    };
  });
}

export async function addRecipeToNeed(
  needId: string,
  recipeId: string,
  params: {
    recipeQuantityAmount?: number;
    recipeQuantityUnit?: string;
    addedBy: string;
  }
): Promise<void> {
  const { error } = await supabase.from('needs_recipes').insert({
    need_id: needId,
    recipe_id: recipeId,
    recipe_quantity_amount: params.recipeQuantityAmount ?? null,
    recipe_quantity_unit: params.recipeQuantityUnit ?? null,
    added_by: params.addedBy,
  });

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      // Already linked — upsert no-op.
      return;
    }
    console.error('❌ Error adding recipe to need:', error);
    throw error;
  }
}

export async function removeRecipeFromNeed(
  needId: string,
  recipeId: string
): Promise<void> {
  const { error } = await supabase
    .from('needs_recipes')
    .delete()
    .eq('need_id', needId)
    .eq('recipe_id', recipeId);

  if (error) {
    console.error('❌ Error removing recipe from need:', error);
    throw error;
  }
}

// ============================================
// CREATE
// ============================================

export async function createNeed(params: CreateNeedParams): Promise<NeedWithTags> {
  console.log('🛒 Creating need:', {
    spaceId: params.spaceId,
    ingredientId: params.ingredientId,
    customName: params.customName,
    addedFrom: params.addedFrom,
  });

  // Dedup (CP6d-Schema Gap-G41 softening): when supply_id is set, look for an
  // existing active need that matches the **display merge predicate** (Q28):
  //   (supply_id, unit_display, store_tag_ids, for_user_ids, status IN
  //    ['need','in_cart'])
  // Previously (CP6a) any active need with the same supply_id blocked
  // creation; that prevented users from coexisting needs like "1L of olive
  // oil tonight from the corner store" + "5L Costco-bulk this week".
  // The softened predicate aligns with how the UI merges rows for display.
  if (params.supplyId) {
    const { data: candidates, error: dedupError } = await supabase
      .from('needs')
      .select(NEED_SELECT)
      .eq('space_id', params.spaceId)
      .eq('supply_id', params.supplyId)
      .in('status', ['need', 'in_cart']);

    if (dedupError) {
      console.error('❌ Error checking dedup for createNeed:', dedupError);
      throw dedupError;
    }

    // For partitioning params.tagIds into the store-dimension subset.
    const spaceStoreTags = await getTagsForSpace(params.spaceId, 'store');
    const storeTagIdsForSpace = new Set(spaceStoreTags.map((t) => t.id));

    const existingRow = (candidates ?? [])
      .map((row) => row as Need & {
        need_tags: Array<{ tag: Tag | null }> | null;
      })
      .find((row) => matchesMergePredicate(row, params, storeTagIdsForSpace));

    if (existingRow) {
      console.log(
        '🔄 createNeed dedup hit (softened predicate) — returning existing need:',
        existingRow.id
      );

      // Tag merge: union new tagIds with existing need's tags so users can
      // upgrade an existing need's tags by re-adding with new ones (e.g.,
      // adding 'urgent' to a previously-untagged need). Acquired path is
      // not reached here (filtered above).
      if (params.tagIds && params.tagIds.length > 0) {
        const existingTagIds = (existingRow.need_tags ?? [])
          .map((row) => row.tag?.id)
          .filter((id): id is string => !!id);
        const merged = Array.from(new Set([...existingTagIds, ...params.tagIds]));
        if (merged.length > existingTagIds.length) {
          await setNeedTags(existingRow.id, merged);
        }
      }

      const refreshed = await getNeedByIdWithTagsOnly(existingRow.id);
      if (!refreshed) throw new NeedNotFoundError(existingRow.id);
      return refreshed;
    }
  }

  const insertRow = {
    space_id: params.spaceId,
    ingredient_id: params.ingredientId ?? null,
    custom_name: params.customName ?? null,
    status: params.status ?? ('need' as NeedStatus),
    quantity_display: params.quantityDisplay ?? null,
    unit_display: params.unitDisplay ?? null,
    for_user_ids: params.forUserIds ?? [],
    supply_id: params.supplyId ?? null,
    added_by: params.addedBy,
    added_from: params.addedFrom,
    notes: params.notes ?? null,
  };

  const { data: inserted, error } = await supabase
    .from('needs')
    .insert(insertRow)
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error creating need:', error);
    throw error;
  }

  const newId = (inserted as { id: string }).id;

  if (params.tagIds && params.tagIds.length > 0) {
    await setNeedTags(newId, params.tagIds);
  }

  // Re-read to return the joined shape.
  const result = await getNeedByIdWithTagsOnly(newId);
  if (!result) throw new NeedNotFoundError(newId);
  return result;
}

async function getNeedByIdWithTagsOnly(needId: string): Promise<NeedWithTags | null> {
  const { data, error } = await supabase
    .from('needs')
    .select(NEED_SELECT)
    .eq('id', needId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error loading need:', error);
    throw error;
  }

  if (!data) return null;
  return flattenNeedRow(
    data as Need & {
      ingredient: NeedIngredient | null;
      need_tags: Array<{ tag: Tag | null }> | null;
    }
  );
}

/**
 * Convenience: create a need + recipe attribution row in one call.
 * Used by the recipe-add flow (CP3).
 */
export async function addNeedFromRecipe(
  params: AddNeedFromRecipeParams
): Promise<NeedWithDetails> {
  console.log('🛒 Adding need from recipe:', {
    spaceId: params.spaceId,
    ingredientId: params.ingredientId,
    recipeId: params.recipeId,
  });

  const created = await createNeed({
    spaceId: params.spaceId,
    ingredientId: params.ingredientId,
    quantityDisplay: params.quantityDisplay,
    unitDisplay: params.unitDisplay,
    addedBy: params.addedBy,
    addedFrom: 'recipe',
    tagIds: params.tagIds,
  });

  await addRecipeToNeed(created.id, params.recipeId, {
    recipeQuantityAmount: params.recipeQuantityAmount,
    recipeQuantityUnit: params.recipeQuantityUnit,
    addedBy: params.addedBy,
  });

  const detailed = await getNeedById(created.id);
  if (!detailed) throw new NeedNotFoundError(created.id);
  return detailed;
}

// ============================================
// UPDATE — non-status fields
// ============================================

/**
 * CP6d-SmokeFix-3 (V33 BulkAcquire dedup follow-up): set the supply_id
 * back-pointer on an existing need. Used by BulkAcquirePromotionModal when
 * multiple needs in the cart resolve to the same ingredient/custom_name —
 * one supply gets created via createSupply, and the duplicate needs get
 * linked to it via this helper so the merge predicate (CP6d-Schema dedup
 * softening) recognizes them as same-supply rows.
 */
export async function linkNeedToSupply(
  needId: string,
  supplyId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('needs')
    .update({ supply_id: supplyId })
    .eq('id', needId);
  if (error) {
    console.error('❌ linkNeedToSupply error:', error);
    throw error;
  }
}

export async function updateNeed(
  needId: string,
  params: UpdateNeedParams
): Promise<NeedWithTags> {
  console.log('🛒 Updating need:', { needId, params });

  const patch: Record<string, unknown> = {};
  if (params.customName !== undefined) patch.custom_name = params.customName;
  if (params.quantityDisplay !== undefined) patch.quantity_display = params.quantityDisplay;
  if (params.unitDisplay !== undefined) patch.unit_display = params.unitDisplay;
  if (params.forUserIds !== undefined) patch.for_user_ids = params.forUserIds;
  if (params.notes !== undefined) patch.notes = params.notes;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('needs').update(patch).eq('id', needId);
    if (error) {
      console.error('❌ Error updating need:', error);
      throw error;
    }
  }

  if (params.tagIds !== undefined) {
    await setNeedTags(needId, params.tagIds);
  }

  const result = await getNeedByIdWithTagsOnly(needId);
  if (!result) throw new NeedNotFoundError(needId);
  return result;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

/**
 * CP6e-FlowsUI-b1: side-effect result shape, surfaced through
 * `acquireNeedWithDetails` and `cycleNeedStatusWithDetails` so callers can
 * render UI (e.g., `AcquireLotToast`) on top of the silent helper.
 *
 * `statusBefore` is the supply's status at helper entry. Needed by the toast's
 * Undo path to know what status to restore. Null when the helper short-
 * circuited before the supply read (`no_supply_linked` / `supply_not_found`).
 */
export interface AcquireSideEffectResult {
  lotCreated: SupplyLot | null;
  statusBefore: SupplyStatus | null;
  statusChangedTo: SupplyStatus | null;
  skippedReason: string | null;
}

/**
 * CP6e-Services-c (D8R-Q45-adjacent). Handle supply-side effects when a need
 * transitions to 'acquired' status. Encapsulates the branching for
 * tracks_lots supplies (lot create) vs non-tracks_lots supplies (status flip).
 *
 * D8R-Q45 auto-restock fires automatically via lotsService.createLot's
 * _maybeAutoRestock when applicable.
 *
 * Returns side-effect metadata for the caller. Errors are caught + logged but
 * do NOT throw — the need's acquire transition has already succeeded; supply-
 * side failures should not roll it back.
 *
 * CP6e-FlowsUI-b1: renamed from `_handleAcquiredSideEffects` and made public
 * so `acquireNeedWithDetails` can run it on the side (paired with
 * `setNeedStatus(.., 'acquired', { suppressSideEffects: true })`). Return
 * shape extended with `statusBefore` so the toast's Undo path can restore.
 */
export async function handleAcquiredSideEffects(
  need: NeedWithTags
): Promise<AcquireSideEffectResult> {
  // 1. No supply linked → nothing to do.
  if (!need.supply_id) {
    return {
      lotCreated: null,
      statusBefore: null,
      statusChangedTo: null,
      skippedReason: 'no_supply_linked',
    };
  }

  try {
    // 2. Read supply.
    const supply = await getSupplyById(need.supply_id);
    if (!supply) {
      console.warn('⚠️ Need acquired but parent supply not found:', {
        needId: need.id,
        supplyId: need.supply_id,
      });
      return {
        lotCreated: null,
        statusBefore: null,
        statusChangedTo: null,
        skippedReason: 'supply_not_found',
      };
    }

    const statusBefore = supply.status;

    // 3. Branch A — non-tracks_lots supply: status flip.
    if (!supply.tracks_lots) {
      const result = await setSupplyStatus(supply.id, 'in_stock');
      const changed = result.supply.status !== statusBefore;
      return {
        lotCreated: null,
        statusBefore,
        statusChangedTo: changed ? result.supply.status : null,
        skippedReason: null,
      };
    }

    // 3. Branch B — tracks_lots supply: lot create.
    // Need's qty/unit are stored as quantity_display / unit_display per
    // schema (Need interface in lib/types/needs.ts). Fall through to
    // status-flip if either is missing.
    const qty = need.quantity_display;
    const qtyUnit = need.unit_display;
    if (qty === null || qtyUnit === null || qtyUnit.trim() === '') {
      console.warn(
        '⚠️ Need acquired but missing qty/unit; falling back to status flip:',
        { needId: need.id }
      );
      const result = await setSupplyStatus(supply.id, 'in_stock');
      const changed = result.supply.status !== statusBefore;
      return {
        lotCreated: null,
        statusBefore,
        statusChangedTo: changed ? result.supply.status : null,
        skippedReason: 'no_quantity_data',
      };
    }

    // Storage: prefer supply.storage_location; default to 'pantry' if null.
    // The joined ingredient on SupplyWithTags doesn't expose
    // default_storage_location (per Resolution A — Tom approved skipping
    // that lookup); pantry is the catalog-neutral default.
    const storage: StorageLocation = supply.storage_location ?? 'pantry';

    const lotParams: CreateLotParams = {
      supply_id: supply.id,
      quantity: qty,
      quantity_unit: qtyUnit,
      storage_location: storage,
      // acquired_at omitted → lotsService defaults to NOW
      // expires_at omitted → lotsService computes from acquired_at + shelf_life
      // brand omitted per Resolution A — needs table has no brand_preference
      //   column; lot.brand stays null and the user can edit it in the
      //   lot-edit modal (CP6e-PantryUI). Receipt scan (P8R-D22) will fill
      //   brand from real purchase data when that ships.
    };

    const lot = await createLot(lotParams);

    // Q45 detection: re-read supply post-createLot; the _maybeAutoRestock
    // helper inside createLot would have flipped status low/critical/out →
    // in_stock if applicable.
    const supplyAfter = await getSupplyById(supply.id);
    const newStatus = supplyAfter?.status ?? statusBefore;
    const statusChanged = newStatus !== statusBefore;

    return {
      lotCreated: lot,
      statusBefore,
      statusChangedTo: statusChanged ? newStatus : null,
      skippedReason: null,
    };
  } catch (err) {
    console.error('❌ handleAcquiredSideEffects error (need acquire NOT rolled back):', {
      needId: need.id,
      supplyId: need.supply_id,
      err,
    });
    return {
      lotCreated: null,
      statusBefore: null,
      statusChangedTo: null,
      skippedReason: 'side_effect_error',
    };
  }
}

/**
 * CP6e-FlowsUI-b1: optional `suppressSideEffects` flag lets callers opt out
 * of the in-line side-effect call so they can run it explicitly on the side
 * (via `handleAcquiredSideEffects`) and capture its return shape.
 *
 * `acquireNeedWithDetails` and `cycleNeedStatusWithDetails` use this. Pre-
 * existing callers (5 sites enumerated in CP6e-Services-c SESSION_LOG) pass
 * no `options` arg → flag defaults to `false` → behavior unchanged.
 */
export async function setNeedStatus(
  needId: string,
  newStatus: NeedStatus,
  options?: { suppressSideEffects?: boolean }
): Promise<NeedWithTags> {
  console.log('🛒 Setting need status:', { needId, newStatus });

  // Read pre-update so we can detect the acquire transition (per D8R-Q45-
  // adjacent CP6e-Services-c logic). Pre-existing callers don't observe this
  // extra read — return shape is unchanged.
  const before = await getNeedByIdWithTagsOnly(needId);
  if (!before) throw new NeedNotFoundError(needId);

  const isAcquireTransition =
    newStatus === 'acquired' && before.status !== 'acquired';

  const { data, error } = await supabase
    .from('needs')
    .update({ status: newStatus })
    .eq('id', needId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('❌ Error setting need status:', error);
    throw error;
  }
  if (!data) throw new NeedNotFoundError(needId);

  const result = await getNeedByIdWithTagsOnly(needId);
  if (!result) throw new NeedNotFoundError(needId);

  // CP6e-Services-c: side-effects on acquire transition. Failures are logged
  // inside the helper, never thrown — the need is already acquired.
  // CP6e-FlowsUI-b1: callers using `acquireNeedWithDetails` pass
  // `suppressSideEffects: true` so they can run the helper themselves and
  // capture its return shape.
  if (isAcquireTransition && !options?.suppressSideEffects) {
    const sideEffectResult = await handleAcquiredSideEffects(result);
    console.log('📦 Acquire side-effects:', {
      needId,
      lotCreated: sideEffectResult.lotCreated?.id ?? null,
      statusChangedTo: sideEffectResult.statusChangedTo,
      skippedReason: sideEffectResult.skippedReason,
    });
  }

  return result;
}

/**
 * CP6e-FlowsUI-b1. Acquire-with-details wrapper. Same observable end-state
 * as `setNeedStatus(needId, 'acquired')`, but returns both the updated need
 * AND the side-effect result so the caller (currently
 * `cycleNeedStatusWithDetails` → `AcquireLotToast`) can render a toast.
 *
 * Internally calls `setNeedStatus` with `suppressSideEffects: true` then
 * invokes `handleAcquiredSideEffects` manually so the helper fires exactly
 * ONCE per acquire.
 *
 * Errors from `setNeedStatus` (e.g., need not found, DB error) propagate.
 * Errors inside the helper are caught + logged + returned in the result
 * with `skippedReason: 'side_effect_error'` (existing helper behavior —
 * preserved).
 */
export async function acquireNeedWithDetails(
  needId: string
): Promise<{ need: NeedWithTags; sideEffect: AcquireSideEffectResult }> {
  const need = await setNeedStatus(needId, 'acquired', {
    suppressSideEffects: true,
  });
  const sideEffect = await handleAcquiredSideEffects(need);
  console.log('📦 acquireNeedWithDetails:', {
    needId,
    lotCreated: sideEffect.lotCreated?.id ?? null,
    statusBefore: sideEffect.statusBefore,
    statusChangedTo: sideEffect.statusChangedTo,
    skippedReason: sideEffect.skippedReason,
  });
  return { need, sideEffect };
}

/**
 * Cycle status: need → in_cart → acquired (Q7).
 * Q50: 'acquired' is terminal — no-op + console.warn. setNeedStatus can still
 * set any status directly.
 */
export async function cycleNeedStatus(needId: string): Promise<NeedWithTags> {
  console.log('🛒 Cycling need status:', needId);

  const current = await getNeedByIdWithTagsOnly(needId);
  if (!current) throw new NeedNotFoundError(needId);

  const next = STATUS_CYCLE_NEXT[current.status];
  if (next === null) {
    console.warn(
      `⚠️ cycleNeedStatus: need ${needId} is already 'acquired' (terminal per Q50); no-op`
    );
    return current;
  }

  return setNeedStatus(needId, next);
}

/**
 * CP6e-FlowsUI-b1. Cycle-with-details wrapper. Same cycle as
 * `cycleNeedStatus` but returns `acquireSideEffect` non-null when the
 * transition lands on `acquired`, so callers can render the
 * AcquireLotToast.
 *
 * Existing `cycleNeedStatus` stays unchanged — pre-existing callers that
 * don't need toast metadata continue using it without modification.
 */
export async function cycleNeedStatusWithDetails(
  needId: string
): Promise<{
  need: NeedWithTags;
  acquireSideEffect: AcquireSideEffectResult | null;
}> {
  console.log('🛒 Cycling need status (with details):', needId);

  const current = await getNeedByIdWithTagsOnly(needId);
  if (!current) throw new NeedNotFoundError(needId);

  const next = STATUS_CYCLE_NEXT[current.status];
  if (next === null) {
    console.warn(
      `⚠️ cycleNeedStatusWithDetails: need ${needId} is already 'acquired' (terminal per Q50); no-op`
    );
    return { need: current, acquireSideEffect: null };
  }

  if (next === 'acquired') {
    const { need, sideEffect } = await acquireNeedWithDetails(needId);
    return { need, acquireSideEffect: sideEffect };
  }

  // next === 'in_cart' — no side-effects on this transition.
  const need = await setNeedStatus(needId, next);
  return { need, acquireSideEffect: null };
}

// ============================================
// DELETE
// ============================================

export async function deleteNeed(needId: string): Promise<void> {
  console.log('🛒 Deleting need:', needId);

  const { error } = await supabase.from('needs').delete().eq('id', needId);

  if (error) {
    console.error('❌ Error deleting need:', error);
    throw error;
  }
}

// ============================================
// DISPLAY MERGE (Q28/Q36) — pure function
// ============================================

/**
 * Pure function. Groups needs by display-merge predicate:
 *   same identity (ingredient_id or `custom:${custom_name}`)
 *   + same unit_display
 *   + same store-tag set (sorted tag IDs)
 *   + same for_user_ids set (sorted)
 * Recipe attributions and urgency tags do NOT block merge.
 */
export function mergeNeedsForDisplay(needs: NeedWithDetails[]): MergedNeedGroup[] {
  const groups = new Map<string, MergedNeedGroup>();

  for (const need of needs) {
    const identity = need.ingredient_id ?? `custom:${need.custom_name ?? ''}`;
    const unit = need.unit_display ?? 'none';

    const storeTagIds = need.tags
      .filter((t) => t.dimension === 'store')
      .map((t) => t.id)
      .sort();
    const storeTagsKey = storeTagIds.join(',');

    const forUsersSorted = [...need.for_user_ids].sort();
    const forUsersKey = forUsersSorted.join(',');

    const key = `${identity}|||${unit}|||${storeTagsKey}|||${forUsersKey}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        ingredientId: need.ingredient_id,
        customName: need.custom_name,
        unitDisplay: need.unit_display,
        forUserIds: forUsersSorted,
        storeTagIds,
        totalQuantity: null,
        needs: [],
        allRecipes: [],
      };
      groups.set(key, group);
    }

    group.needs.push(need);

    if (need.quantity_display !== null) {
      group.totalQuantity = (group.totalQuantity ?? 0) + need.quantity_display;
    }

    for (const r of need.recipes) {
      if (!group.allRecipes.some((existing) => existing.id === r.id)) {
        group.allRecipes.push(r);
      }
    }
  }

  return Array.from(groups.values());
}

// ============================================
// HELPER (pure)
// ============================================

export function getNeedDisplayName(need: NeedWithTags): string {
  return getNeedDisplayNameInternal(need);
}
