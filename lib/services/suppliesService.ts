// ============================================
// FRIGO — SUPPLIES SERVICE (Phase 8R-CP2a)
// ============================================
// Household supplies (ongoing-stock items). Status enum cycle per Q7:
//   in_stock → low → critical → out → in_stock
// Spawn-on-out per Q10β + Q41 + Q48 (idempotency).
// Q35: initial state restricted to in_stock/low/out (critical only via cycling).
// Q46: all param/return interfaces live in lib/types/.
//
// ============================================
// CONFIRMING_FUNCTIONS_REFERENCE (8R-UX4)
// ============================================
// Canonical list of service functions that bump `supplies.last_confirmed_at`
// — the behavioral-engagement signal driving "Sitting Idle" in the Pantry
// Use Soon outer tab. New functions representing user engagement with a
// physical supply MUST bump this column.
//
// Bumpers (touch supplies.last_confirmed_at):
//   • setSupplyStatus              — any status transition or re-write
//   • markSupplyUsed               — swipe-right "used" gesture
//   • createSupply                 — initial timestamp on insert
//   • createLot                    — adding a physical lot is engagement
//   • updateLot (quantity change)  — partial consume / re-count is engagement
//   • archiveLot                   — consumed a whole lot
//   • deductFromOldest             — cook depletion FIFO walk
//   • deductFromSpecificLots       — cook depletion explicit-lot path
//   • moveLotStorage               — moving a lot is engaging with it
//
// Non-bumpers (deliberately leave last_confirmed_at alone):
//   • setSupplyTags / addTag / removeTag — metadata, not engagement
//   • Notes-only updates, custom_name edits
//   • storage_location change on the supply itself (not a lot)
//   • archived_at flips on the supply (cleanup, not engagement)
//   • setSupplyTracksLots — config toggle
//
// The bumpers/non-bumpers split is best-guess for F&F. Re-assess after
// real usage data is available — DEFERRED_WORK has the follow-up item.
// ============================================

import { supabase } from '../supabase';
import { createLot, getLotAggregate } from './lotsService';
import { createNeed } from './needsService';
import {
  CreateLotParams,
  CreateSupplyParams,
  StorageLocation,
  Supply,
  SupplyIngredient,
  SupplyLot,
  SupplyStatus,
  SupplyStatusResult,
  SupplyWithTags,
  TrackingMode,
  UpdateSupplyParams,
} from '../types/supplies';
import { Tag } from '../types/tags';
import { addNeedTag, getOrCreateTag, setSupplyTags } from './tagsService';

// ============================================
// ERROR CLASSES
// ============================================

export class SupplyNotFoundError extends Error {
  constructor(id: string) {
    super(`Supply ${id} not found or not accessible`);
    this.name = 'SupplyNotFoundError';
  }
}

export class InvalidInitialStatusError extends Error {
  constructor(status: string) {
    super(`Invalid initial supply status "${status}". Allowed: in_stock, low, out (Q35).`);
    this.name = 'InvalidInitialStatusError';
  }
}

// ============================================
// INTERNAL HELPERS
// ============================================

const STATUS_SORT_PRIORITY: Record<SupplyStatus, number> = {
  out: 0,
  critical: 1,
  low: 2,
  in_stock: 3,
};

const STATUS_CYCLE_NEXT: Record<SupplyStatus, SupplyStatus> = {
  in_stock: 'low',
  low: 'critical',
  critical: 'out',
  out: 'in_stock',
};

// Flatten a Supabase joined-row response (supply + ingredient + supply_tags(tag)).
// Inline-shaped param type per Q46 (no service-internal interface declaration).
function flattenSupplyRow(
  row: Supply & {
    ingredient: SupplyIngredient | null;
    supply_tags: Array<{ tag: Tag | null }> | null;
  }
): SupplyWithTags {
  const { ingredient, supply_tags, ...rest } = row;
  const tags = (supply_tags ?? [])
    .map((t) => t.tag)
    .filter((t): t is Tag => t !== null);
  return {
    ...rest,
    ingredient: ingredient ?? null,
    tags,
  };
}

function getSupplyDisplayNameInternal(supply: SupplyWithTags): string {
  return supply.ingredient?.name ?? supply.custom_name ?? '';
}

function sortSupplies(rows: SupplyWithTags[]): SupplyWithTags[] {
  rows.sort((a, b) => {
    const statusDiff = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;
    const aName = getSupplyDisplayNameInternal(a).toLowerCase();
    const bName = getSupplyDisplayNameInternal(b).toLowerCase();
    return aName.localeCompare(bName);
  });
  return rows;
}

const SUPPLY_SELECT = `
  *,
  ingredient:ingredients(id, name, plural_name, family, ingredient_type, typical_store_section, shelf_life_days_fridge, shelf_life_days_freezer, shelf_life_days_pantry, shelf_life_days_counter),
  supply_tags(tag:tags(*))
`;

// CP6e-Services-a: batch-attach active lots + compute aggregates onto a list
// of supplies. No-op for supplies with tracks_lots=false (those get
// `lots: []`, `lot_aggregate: undefined`).
async function hydrateSupplyLots(
  supplies: SupplyWithTags[]
): Promise<SupplyWithTags[]> {
  if (supplies.length === 0) return supplies;

  // CP6e-SmokeFix-SF2: short-circuit when no supply in the batch has
  // tracks_lots=true. This makes `getSupplyById(id, { includeLots: true })`
  // free for non-lots supplies — the lots IN-query never fires, so the
  // mutation-then-hydrate flow downstream (setSupplyStatus /
  // setSupplyUsageLevel) pays zero extra round-trips for the 80% non-lots
  // path while still keeping the lots hydrated for tracks_lots supplies.
  const lotSupplyIds = supplies.filter((s) => s.tracks_lots).map((s) => s.id);
  if (lotSupplyIds.length === 0) {
    for (const s of supplies) {
      s.lots = [];
      s.lot_aggregate = undefined;
    }
    return supplies;
  }

  const { data: lotRows, error } = await supabase
    .from('supply_lots')
    .select('*')
    .in('supply_id', lotSupplyIds)
    .is('consumed_at', null)
    .order('expires_at', { ascending: true, nullsFirst: false })
    .order('acquired_at', { ascending: true });

  if (error) {
    console.error('❌ Error batch-loading lots:', error);
    // SF-2 defensive degradation: don't throw — let the caller keep the
    // un-hydrated supplies. The original CP6e-Services-a code threw here
    // and `getSuppliesForSpace` propagated, blocking pantry load. For
    // SF-2 the cost of a transient lot-fetch failure is "no aggregate
    // briefly," which is recoverable; blocking the whole load isn't.
    for (const s of supplies) {
      s.lots = [];
      s.lot_aggregate = undefined;
    }
    return supplies;
  }

  const bySupply = new Map<string, SupplyLot[]>();
  for (const lot of (lotRows ?? []) as SupplyLot[]) {
    const arr = bySupply.get(lot.supply_id);
    if (arr) {
      arr.push(lot);
    } else {
      bySupply.set(lot.supply_id, [lot]);
    }
  }

  for (const s of supplies) {
    const lots = bySupply.get(s.id) ?? [];
    s.lots = lots;
    if (s.tracks_lots && lots.length > 0) {
      // 8R-UX1: pass ingredient through so has_expiring_soon uses the
      // shelf-life-aware threshold (clamp 1-7d at 25% of shelf life).
      // Falls back to flat 7d when ingredient or its shelf_life column is null.
      s.lot_aggregate = await getLotAggregate(lots, s.ingredient);
    } else {
      s.lot_aggregate = undefined;
    }
  }

  return supplies;
}

// ============================================
// READ
// ============================================

/**
 * CP6d-Schema: archived rows (archived_at IS NOT NULL) are excluded by
 * default. Pass `{ includeArchived: true }` to lift the filter — used by the
 * resurrection path (CP6d-SupplyDetail will wire SupplyCreateSheet T1 search-
 * by-name through this).
 *
 * CP6e-Services-a: pass `{ includeLots: true }` to hydrate `supply.lots` +
 * `supply.lot_aggregate`. Default false for back-compat.
 */
export async function getSuppliesForSpace(
  spaceId: string,
  options?: { includeArchived?: boolean; includeLots?: boolean }
): Promise<SupplyWithTags[]> {
  console.log('📦 Loading supplies for space:', spaceId, options ?? {});

  let query = supabase
    .from('supplies')
    .select(SUPPLY_SELECT)
    .eq('space_id', spaceId);

  if (!options?.includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Error loading supplies:', error);
    throw error;
  }

  const flattened = (data ?? []).map((row) => flattenSupplyRow(row as Supply & { ingredient: SupplyIngredient | null; supply_tags: Array<{ tag: Tag | null }> | null }));
  const sorted = sortSupplies(flattened);

  if (options?.includeLots) {
    await hydrateSupplyLots(sorted);
  }

  return sorted;
}

export async function getSupplyById(
  supplyId: string,
  options?: { includeLots?: boolean }
): Promise<SupplyWithTags | null> {
  const { data, error } = await supabase
    .from('supplies')
    .select(SUPPLY_SELECT)
    .eq('id', supplyId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error loading supply:', error);
    throw error;
  }

  if (!data) return null;
  const supply = flattenSupplyRow(
    data as Supply & {
      ingredient: SupplyIngredient | null;
      supply_tags: Array<{ tag: Tag | null }> | null;
    }
  );

  if (options?.includeLots) {
    await hydrateSupplyLots([supply]);
  }

  return supply;
}

export async function getSuppliesByStatus(
  spaceId: string,
  statuses: SupplyStatus[]
): Promise<SupplyWithTags[]> {
  if (statuses.length === 0) return [];

  console.log('📦 Loading supplies by status:', { spaceId, statuses });

  const { data, error } = await supabase
    .from('supplies')
    .select(SUPPLY_SELECT)
    .eq('space_id', spaceId)
    .in('status', statuses);

  if (error) {
    console.error('❌ Error loading supplies by status:', error);
    throw error;
  }

  const flattened = (data ?? []).map((row) => flattenSupplyRow(row as Supply & { ingredient: SupplyIngredient | null; supply_tags: Array<{ tag: Tag | null }> | null }));
  return sortSupplies(flattened);
}

// ============================================
// CREATE
// ============================================

// Initial usage_level seed at create. Q35 keeps 'critical' off the create path,
// so only in_stock / low / out land here.
function initialUsageLevelForStatus(status: SupplyInitialStatus): number {
  switch (status) {
    case 'in_stock':
      return 5;
    case 'low':
      return 2;
    case 'out':
      return 0;
  }
}

// CP6d-Schema: shelf-life lookup helper. Counter falls back to pantry per
// the inference spec; null storageLocation falls back to fridge → pantry.
function pickShelfLifeDays(
  storageLocation: StorageLocation | null,
  ing: {
    shelf_life_days_fridge: number | null;
    shelf_life_days_freezer: number | null;
    shelf_life_days_pantry: number | null;
  }
): number | null {
  switch (storageLocation) {
    case 'freezer':
      return ing.shelf_life_days_freezer;
    case 'fridge':
      return ing.shelf_life_days_fridge;
    case 'pantry':
    case 'counter':
      return ing.shelf_life_days_pantry;
    default:
      return ing.shelf_life_days_fridge ?? ing.shelf_life_days_pantry;
  }
}

export async function createSupply(params: CreateSupplyParams): Promise<SupplyWithTags> {
  // Q35: critical only via cycling. Defensive runtime check (compile-time
  // type already excludes 'critical' from SupplyInitialStatus, but services
  // may receive a wider value from upstream callers casting through any).
  if (params.status === ('critical' as SupplyStatus)) {
    throw new InvalidInitialStatusError(params.status);
  }
  if (
    params.status !== 'in_stock' &&
    params.status !== 'low' &&
    params.status !== 'out'
  ) {
    throw new InvalidInitialStatusError(params.status);
  }

  console.log('📦 Creating supply:', {
    spaceId: params.spaceId,
    ingredientId: params.ingredientId,
    customName: params.customName,
    status: params.status,
  });

  // CP6d-Schema: infer storage_location + tracking_mode when not explicitly
  // overridden in params. Custom-name supplies (no ingredient_id) skip the
  // ingredient lookup and default to 'restock' / null storage.
  let inferredStorage: StorageLocation | null = null;
  let inferredTrackingMode: TrackingMode = 'restock';

  if (params.ingredientId) {
    const { data: ingRow, error: ingError } = await supabase
      .from('ingredients')
      .select(
        'default_storage_location, shelf_life_days_fridge, shelf_life_days_freezer, shelf_life_days_pantry'
      )
      .eq('id', params.ingredientId)
      .maybeSingle();

    if (ingError) {
      console.error('❌ Error loading ingredient for supply inference:', ingError);
      throw ingError;
    }

    if (ingRow) {
      const ing = ingRow as {
        default_storage_location: StorageLocation | null;
        shelf_life_days_fridge: number | null;
        shelf_life_days_freezer: number | null;
        shelf_life_days_pantry: number | null;
      };
      inferredStorage = ing.default_storage_location ?? null;
      const storageForLookup = params.storageLocation ?? inferredStorage;
      const shelfLife = pickShelfLifeDays(storageForLookup, ing);
      inferredTrackingMode =
        shelfLife !== null && shelfLife < 14 ? 'track_only' : 'restock';
    }
  }

  const finalStorage: StorageLocation | null =
    params.storageLocation ?? inferredStorage;
  const finalTrackingMode: TrackingMode =
    params.trackingMode ?? inferredTrackingMode;
  const finalIsPriority = params.isPriority ?? false;

  const insertRow = {
    space_id: params.spaceId,
    ingredient_id: params.ingredientId ?? null,
    custom_name: params.customName ?? null,
    status: params.status,
    for_user_ids: params.forUserIds ?? [],
    brands: params.brands ?? [],
    added_by: params.addedBy,
    notes: params.notes ?? null,
    tracking_mode: finalTrackingMode,
    storage_location: finalStorage,
    is_priority: finalIsPriority,
    usage_level: initialUsageLevelForStatus(params.status),
    archived_at: null,
    // 8R-UX4: explicit on insert (DB default exists as a safety net but we
    // own the timestamp at the service layer so all bumper functions are
    // consistent).
    last_confirmed_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from('supplies')
    .insert(insertRow)
    .select('id')
    .single();

  if (insertError) {
    console.error('❌ Error creating supply:', insertError);
    throw insertError;
  }

  const newId = (inserted as { id: string }).id;

  if (params.tagIds && params.tagIds.length > 0) {
    await setSupplyTags(newId, params.tagIds);
  }

  // Constraint 9 preserved: createSupply does NOT spawn-on-out at create time;
  // spawn is the transition path's responsibility.

  const result = await getSupplyById(newId);
  if (!result) throw new SupplyNotFoundError(newId);
  return result;
}

// ============================================
// UPDATE — non-status fields
// ============================================

export async function updateSupply(
  supplyId: string,
  params: UpdateSupplyParams
): Promise<SupplyWithTags> {
  console.log('📦 Updating supply:', { supplyId, params });

  const patch: Record<string, unknown> = {};
  if (params.customName !== undefined) patch.custom_name = params.customName;
  if (params.forUserIds !== undefined) patch.for_user_ids = params.forUserIds;
  if (params.brands !== undefined) patch.brands = params.brands;
  if (params.notes !== undefined) patch.notes = params.notes;

  const { error } = await supabase
    .from('supplies')
    .update(patch)
    .eq('id', supplyId);

  if (error) {
    console.error('❌ Error updating supply:', error);
    throw error;
  }

  const result = await getSupplyById(supplyId);
  if (!result) throw new SupplyNotFoundError(supplyId);
  return result;
}

// ============================================
// STATUS TRANSITIONS — with spawn-on-out (Q10β + Q41 + Q48)
// ============================================

// CP6d-Schema: usage_level set on transition into a status. No-transition
// (oldStatus === newStatus) leaves usage_level alone — handled by callers.
// CP6d-SmokeFix-4: 'unknown' transitions leave usage_level UNCHANGED — the
// level memory is preserved for when the user re-promotes the supply later.
// Returns null to signal "don't patch usage_level" to the caller.
function usageLevelForTransition(newStatus: SupplyStatus): number | null {
  switch (newStatus) {
    case 'in_stock':
      return 5;
    case 'low':
      return 2;
    case 'critical':
      return 1;
    case 'out':
      return 0;
    case 'unknown':
      return null;
  }
}

/**
 * Set status directly. CP6d-Schema behavior gates layered on top of CP3-era spawn:
 *
 *   1. usage_level is updated to track the new status (5 / 2 / 1 / 0). On a
 *      no-op transition (status unchanged), usage_level is left alone.
 *   2. Spawn-on-out is gated by tracking_mode:
 *      - 'restock': existing CP3 spawn behavior (Q48 idempotency, store-tag copy).
 *      - 'track_only': no spawn; instead set archived_at = NOW() and return
 *        autoArchived=true.
 *   3. Priority spawn-on-low: if old != 'low' and new === 'low' and is_priority,
 *      fire createNeed with supply's tag_ids EXCLUDING any urgency tag, then
 *      attach the 'today' urgency tag explicitly. Mirrors restock spawn-on-out
 *      shape but with an urgency override.
 *
 * The cookDepletionService integration is unchanged (it calls setSupplyStatus,
 * which means depletion automatically inherits the new gates).
 */
export async function setSupplyStatus(
  supplyId: string,
  newStatus: SupplyStatus
): Promise<SupplyStatusResult> {
  console.log('📦 Setting supply status:', { supplyId, newStatus });

  // Capture pre-update tags so we can copy store-dimension tags after the
  // status change (and the spawn check) without an extra round-trip.
  const before = await getSupplyById(supplyId);
  if (!before) throw new SupplyNotFoundError(supplyId);

  const oldStatus = before.status;
  const isTransition = oldStatus !== newStatus;

  // Build the patch. usage_level is set only on actual transitions; an
  // unchanged status leaves the field alone (callers shouldn't see a status
  // re-write nuke a manually-set usage_level). Transitions into 'unknown'
  // also leave usage_level alone (per CP6d-SmokeFix-4 — preserve level
  // memory for when the user re-promotes).
  // 8R-UX4: bump last_confirmed_at on EVERY setSupplyStatus call (transition
  // or not — any call is a "yes I touched this" event). See
  // CONFIRMING_FUNCTIONS_REFERENCE in this file's header.
  const patch: Record<string, unknown> = {
    status: newStatus,
    last_confirmed_at: new Date().toISOString(),
  };
  if (isTransition) {
    const nextLevel = usageLevelForTransition(newStatus);
    if (nextLevel !== null) {
      patch.usage_level = nextLevel;
    }
  }

  // track_only at out auto-archives instead of spawning. We set archived_at
  // in the same patch so the supply's archived state is consistent post-update.
  const isAutoArchive =
    isTransition && newStatus === 'out' && before.tracking_mode === 'track_only';
  if (isAutoArchive) {
    patch.archived_at = new Date().toISOString();
  }

  // CP6d-SupplyDetail follow-up (P8R-D28): transitioning back into in_stock
  // also unarchives the supply. Closes the resurrection-flow loop —
  // SupplyCreateSheet T1 finds an archived supply → user taps Edit →
  // SupplyDetail's Restock CTA un-archives AND restocks in one action.
  // Always-clear on in_stock transitions (cheap; idempotent for already-null
  // values).
  if (isTransition && newStatus === 'in_stock') {
    patch.archived_at = null;
  }

  const { data: updated, error: updateError } = await supabase
    .from('supplies')
    .update(patch)
    .eq('id', supplyId)
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('❌ Error setting supply status:', updateError);
    throw updateError;
  }

  if (!updated) throw new SupplyNotFoundError(supplyId);

  let spawnedNeed: SupplyStatusResult['spawnedNeed'] = undefined;

  // ---- Restock spawn-on-out path (CP3-era; preserved verbatim, gated). ----
  if (
    isTransition &&
    newStatus === 'out' &&
    before.tracking_mode === 'restock'
  ) {
    // Q48 idempotency check.
    const { data: existing, error: existingError } = await supabase
      .from('needs')
      .select('id')
      .eq('supply_id', supplyId)
      .in('status', ['need', 'in_cart'])
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('❌ Error checking existing spawned need:', existingError);
      throw existingError;
    }

    if (!existing) {
      // Spawn new need. Inherits identity + for_user_ids from the supply (Q27).
      const needInsert = {
        space_id: before.space_id,
        ingredient_id: before.ingredient_id,
        custom_name: before.ingredient_id ? null : before.custom_name,
        status: 'need' as const,
        quantity_display: null,
        unit_display: null,
        for_user_ids: before.for_user_ids,
        supply_id: supplyId,
        added_by: before.added_by,
        added_from: 'supply_spawn' as const,
      };

      const { data: createdNeed, error: needError } = await supabase
        .from('needs')
        .insert(needInsert)
        .select('id, ingredient_id, custom_name, status, supply_id')
        .single();

      if (needError) {
        console.error('❌ Error spawning need on supply→out:', needError);
        throw needError;
      }

      const needRow = createdNeed as {
        id: string;
        ingredient_id: string | null;
        custom_name: string | null;
        status: string;
        supply_id: string;
      };

      // Copy store-dimension tags from supply to the new need.
      const storeTagIds = before.tags
        .filter((t) => t.dimension === 'store')
        .map((t) => t.id);

      if (storeTagIds.length > 0) {
        const tagInserts = storeTagIds.map((tagId) => ({
          need_id: needRow.id,
          tag_id: tagId,
        }));

        const { error: tagInsertError } = await supabase
          .from('need_tags')
          .insert(tagInserts);

        if (tagInsertError) {
          console.error('❌ Error copying store tags to spawned need:', tagInsertError);
          throw tagInsertError;
        }
      }

      spawnedNeed = needRow;
      console.log('📦 Spawned need from supply→out:', needRow.id);
    } else {
      console.log('📦 Active need already exists for this supply — skipping spawn (Q48)');
    }
  }

  // ---- Priority spawn-on-low path (CP6d-Schema). ----
  if (
    isTransition &&
    newStatus === 'low' &&
    before.is_priority === true
  ) {
    // Reuse createNeed (gets dedup softening for free). Strip any urgency tags
    // from the supply's tag set so the spawned need's urgency comes from the
    // explicit 'today' override, not the supply's resting urgency.
    const tagIdsWithoutUrgency = before.tags
      .filter((t) => t.dimension !== 'urgency')
      .map((t) => t.id);

    const created = await createNeed({
      spaceId: before.space_id,
      ingredientId: before.ingredient_id ?? undefined,
      customName: before.ingredient_id ? undefined : before.custom_name ?? undefined,
      forUserIds: before.for_user_ids,
      supplyId: supplyId,
      addedBy: before.added_by ?? '',
      addedFrom: 'supply_spawn',
      tagIds: tagIdsWithoutUrgency,
    });

    // Resolve / create the 'today' urgency tag and attach it. added_by may be
    // null on legacy rows; fall back to empty string (tags.created_by is
    // nullable on the SQL side but getOrCreateTag types it non-null).
    const todayTag = await getOrCreateTag(
      before.space_id,
      'urgency',
      'today',
      before.added_by ?? ''
    );
    await addNeedTag(created.id, todayTag.id);

    spawnedNeed = {
      id: created.id,
      ingredient_id: created.ingredient_id,
      custom_name: created.custom_name,
      status: created.status,
      supply_id: supplyId,
    };
    console.log('📦 Priority spawn-on-low fired:', created.id);
  }

  // CP6e-SmokeFix-SF2: post-mutation re-fetch hydrates lots + aggregate so
  // callers' onSupplyChanged map-by-id retains the LotBadge / LotsCollapser
  // surfaces for tracks_lots supplies. Non-tracks_lots supplies skip the
  // lot IN-query via hydrateSupplyLots's tracks_lots-aware short-circuit.
  const supplyAfter = await getSupplyById(supplyId, { includeLots: true });
  if (!supplyAfter) throw new SupplyNotFoundError(supplyId);

  return {
    supply: supplyAfter,
    spawnedNeed,
    autoArchived: isAutoArchive,
  };
}

export async function cycleSupplyStatus(supplyId: string): Promise<SupplyStatusResult> {
  console.log('📦 Cycling supply status:', supplyId);

  const current = await getSupplyById(supplyId);
  if (!current) throw new SupplyNotFoundError(supplyId);

  const next = STATUS_CYCLE_NEXT[current.status];
  return setSupplyStatus(supplyId, next);
}

// ============================================
// PRIORITY TOGGLE (CP6d-Pantry)
// ============================================

/**
 * Toggle (or set) `is_priority` on a supply. Used by SupplyRow's expanded-state
 * star toggle. The priority flag is what gates the spawn-on-low path inside
 * setSupplyStatus (added in CP6d-Schema).
 */
export async function setSupplyPriority(
  supplyId: string,
  isPriority: boolean
): Promise<SupplyWithTags> {
  console.log('📦 Setting supply priority:', { supplyId, isPriority });

  const { error } = await supabase
    .from('supplies')
    .update({ is_priority: isPriority })
    .eq('id', supplyId);

  if (error) {
    console.error('❌ Error setting supply priority:', error);
    throw error;
  }

  const result = await getSupplyById(supplyId);
  if (!result) throw new SupplyNotFoundError(supplyId);
  return result;
}

// ============================================
// SHADOW SUPPLY SEARCH (CP6d-SmokeFix-4 Task 2, P5)
// ============================================

/**
 * Search the catalog for ingredients matching `query` that are NOT yet a
 * real supply in the given space. Used by SuppliesSection's search filter
 * pipeline to surface "shadow supplies" (catalog-only matches) under a
 * "Not tracked yet" section. Tap behavior in the UI: open SupplyCreateSheet
 * pre-populated with the ingredient as a T2 hit. Real supply rows only get
 * created on user-explicit promote.
 */
export interface ShadowSupplyCandidate {
  id: string;
  name: string;
  plural_name: string | null;
  family: string | null;
  ingredient_type: string | null;
  typical_store_section: string | null;
}

export async function searchCatalogIngredients(
  query: string,
  spaceId: string,
  limit: number = 20
): Promise<ShadowSupplyCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // 1. Find ingredients matching the query (substring on name + plural_name).
  const pattern = `%${trimmed}%`;
  const { data: ingredients, error: ingError } = await supabase
    .from('ingredients')
    .select('id, name, plural_name, family, ingredient_type, typical_store_section')
    .or(`name.ilike.${pattern},plural_name.ilike.${pattern}`)
    .limit(limit * 2); // over-fetch; we filter against existing supplies next.

  if (ingError) {
    console.error('❌ searchCatalogIngredients ingredient query error:', ingError);
    throw ingError;
  }

  const matched = (ingredients ?? []) as ShadowSupplyCandidate[];
  console.log(
    `🔍 searchCatalogIngredients(${trimmed}) → ${matched.length} catalog hits, names=${matched.map((m) => m.name).slice(0, 5).join(', ')}`
  );
  if (matched.length === 0) return [];

  // 2. Look up which of these ingredient IDs already have an ACTIVE supply
  //    in the space; exclude those from shadow results. 8R-UX1 fix:
  //    archived supplies (e.g., track_only items auto-archived on out)
  //    used to count as "existing" here, which hid those ingredients from
  //    the "Could add" surface even though the user no longer had them.
  //    Resurrection flow now shows them again so they can be re-added.
  const ingredientIds = matched.map((i) => i.id);
  const { data: existing, error: supError } = await supabase
    .from('supplies')
    .select('ingredient_id')
    .eq('space_id', spaceId)
    .is('archived_at', null)
    .in('ingredient_id', ingredientIds);

  if (supError) {
    console.error('❌ searchCatalogIngredients supply check error:', supError);
    throw supError;
  }

  const existingIds = new Set(
    (existing ?? [])
      .map((row) => (row as { ingredient_id: string | null }).ingredient_id)
      .filter((id): id is string => !!id)
  );

  const filtered = matched.filter((i) => !existingIds.has(i.id)).slice(0, limit);
  console.log(
    `🔍 searchCatalogIngredients(${trimmed}) → ${filtered.length} after excluding ${existingIds.size} existing supplies`
  );
  return filtered;
}

// ============================================
// USAGE-LEVEL DIRECT SET (CP6d-SmokeFix-1, P8R-D24 resolution)
// ============================================

/**
 * Set usage_level directly. Status is derived from level via the standard
 * mapping (5/4/3 → in_stock, 2 → low, 1 → critical, 0 → out). When the
 * derived status differs from current, routes through setSupplyStatus to
 * preserve spawn-on-out + tracking_mode + archived_at gating. When status
 * stays the same (e.g., 5 → 4 within in_stock), patches usage_level only.
 *
 * Resolves P8R-D24: setSupplyStatus's transition-only usage_level patch
 * meant the slider's level=4 case was a no-op when the row was already
 * in_stock. This helper closes that gap.
 */
export async function setSupplyUsageLevel(
  supplyId: string,
  newLevel: number
): Promise<SupplyWithTags> {
  if (newLevel < 0 || newLevel > 5 || !Number.isFinite(newLevel)) {
    throw new Error(`Invalid usage_level: ${newLevel}. Must be 0-5.`);
  }
  const level = Math.round(newLevel);

  const newStatus: SupplyStatus =
    level >= 3 ? 'in_stock' : level === 2 ? 'low' : level === 1 ? 'critical' : 'out';

  const current = await getSupplyById(supplyId);
  if (!current) throw new SupplyNotFoundError(supplyId);

  // Status-changing transition → setSupplyStatus owns the lifecycle.
  // Note: setSupplyStatus's usage_level patch will land on a fixed value
  // (5/2/1/0) for those transitions, which is correct — level=4 doesn't
  // hit this branch.
  //
  // 2026-05-13 fix: unwrap SupplyStatusResult — setSupplyStatus returns
  // { supply, spawnedNeed?, autoArchived? } but this function declares
  // Promise<SupplyWithTags>. Previously returning the wrapper handed callers
  // an object with `id === undefined`, which silently broke their
  // map-by-id state updates and required a second tap to recover via the
  // same-status branch's re-fetch.
  if (current.status !== newStatus) {
    const result = await setSupplyStatus(supplyId, newStatus);
    return result.supply;
  }

  // Same-status refinement (e.g., 5 → 4 within in_stock) — patch level only.
  const { error } = await supabase
    .from('supplies')
    .update({ usage_level: level })
    .eq('id', supplyId);

  if (error) {
    console.error('❌ Error setting supply usage_level:', error);
    throw error;
  }

  // CP6e-SmokeFix-SF2: hydrate lots on the post-mutation re-fetch. The
  // status-changing branch routes through setSupplyStatus which already
  // hydrates; this is the direct-patch (same-status) branch.
  const updated = await getSupplyById(supplyId, { includeLots: true });
  if (!updated) throw new SupplyNotFoundError(supplyId);
  return updated;
}

// ============================================
// FIELD-LEVEL UPDATERS (CP6d-SupplyDetail)
// ============================================
// Granular setters for SupplyDetailScreen's "no save button — direct manipulation"
// pattern. Each helper writes one column and re-fetches the joined row.

export async function setSupplyTrackingMode(
  supplyId: string,
  trackingMode: TrackingMode
): Promise<SupplyWithTags> {
  console.log('📦 Setting supply tracking_mode:', { supplyId, trackingMode });
  const { error } = await supabase
    .from('supplies')
    .update({ tracking_mode: trackingMode })
    .eq('id', supplyId);
  if (error) {
    console.error('❌ Error setting supply tracking_mode:', error);
    throw error;
  }
  const result = await getSupplyById(supplyId);
  if (!result) throw new SupplyNotFoundError(supplyId);
  return result;
}

export async function setSupplyStorage(
  supplyId: string,
  storageLocation: StorageLocation | null
): Promise<SupplyWithTags> {
  console.log('📦 Setting supply storage_location:', { supplyId, storageLocation });
  const { error } = await supabase
    .from('supplies')
    .update({ storage_location: storageLocation })
    .eq('id', supplyId);
  if (error) {
    console.error('❌ Error setting supply storage_location:', error);
    throw error;
  }
  const result = await getSupplyById(supplyId);
  if (!result) throw new SupplyNotFoundError(supplyId);
  return result;
}

export async function setSupplyBrands(
  supplyId: string,
  brands: string[]
): Promise<SupplyWithTags> {
  console.log('📦 Setting supply brands:', { supplyId, count: brands.length });
  const { error } = await supabase
    .from('supplies')
    .update({ brands })
    .eq('id', supplyId);
  if (error) {
    console.error('❌ Error setting supply brands:', error);
    throw error;
  }
  const result = await getSupplyById(supplyId);
  if (!result) throw new SupplyNotFoundError(supplyId);
  return result;
}

/**
 * 8R-UX1: "Mark used" semantics for the Use Soon swipe action. Refreshes the
 * supply's idle freshness signal so the row drops out of "Back of the fridge"
 * / "Collecting freezer burn" immediately, without lying about consumption
 * (lot quantity unchanged, status unchanged).
 *
 * Per-path behavior:
 *   • lot-tracked: bump the oldest active lot's `acquired_at` to now. This is
 *     the signal SuppliesSection.getIdleSinceIso reads for lot-tracked
 *     supplies. We deliberately use a direct supabase update (NOT
 *     lotsService.updateLot) to avoid `expires_at_overridden` getting flipped
 *     as a side effect — the user is signaling "I'm using this," not setting
 *     a new expiration.
 *   • non-lot: bump `supplies.updated_at` via a benign self-update.
 *     SuppliesSection's idle predicate uses MAX(created_at, updated_at) for
 *     non-lot supplies, so this refreshes the signal.
 *
 * 8R-UX4: also bumps supplies.last_confirmed_at on every path — that column
 * is the canonical behavioral-engagement signal driving Sitting Idle in the
 * Pantry Use Soon outer tab. See CONFIRMING_FUNCTIONS_REFERENCE.
 */
export async function markSupplyUsed(
  supplyId: string
): Promise<SupplyWithTags> {
  console.log('📦 Marking supply used:', supplyId);

  const before = await getSupplyById(supplyId, { includeLots: true });
  if (!before) throw new SupplyNotFoundError(supplyId);

  const nowIso = new Date().toISOString();

  if (before.tracks_lots) {
    const active = (before.lots ?? []).filter((l) => l.consumed_at === null);
    if (active.length > 0) {
      // Oldest active lot by acquired_at — that's the lot driving the idle
      // signal in getIdleSinceIso.
      const oldest = active.reduce((acc, l) =>
        l.acquired_at < acc.acquired_at ? l : acc
      );
      const { error: lotError } = await supabase
        .from('supply_lots')
        .update({ acquired_at: nowIso })
        .eq('id', oldest.id);
      if (lotError) {
        console.error('❌ Error refreshing lot acquired_at:', lotError);
        throw lotError;
      }
    }
    // Fall through to the unified supply-level bump below.
  }

  // 8R-UX4: unified bump for supplies.last_confirmed_at. Replaces the
  // previous tri-path updated_at touches; the supply column is now the
  // canonical idle signal for non-lot supplies and the fallback signal for
  // lot-tracked supplies with no active lots.
  const { error } = await supabase
    .from('supplies')
    .update({ last_confirmed_at: nowIso })
    .eq('id', supplyId);
  if (error) {
    console.error('❌ Error bumping supply last_confirmed_at:', error);
    throw error;
  }

  const after = await getSupplyById(supplyId, { includeLots: true });
  if (!after) throw new SupplyNotFoundError(supplyId);
  return after;
}

export async function archiveSupply(
  supplyId: string
): Promise<SupplyWithTags> {
  console.log('📦 Archiving supply:', supplyId);
  const { error } = await supabase
    .from('supplies')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', supplyId);
  if (error) {
    console.error('❌ Error archiving supply:', error);
    throw error;
  }
  const result = await getSupplyById(supplyId);
  if (!result) throw new SupplyNotFoundError(supplyId);
  return result;
}

// 8R-UX1: getStaleTrackOnlySupplies / getIdleColdSupplies were removed.
// SuppliesSection now derives "idle cold-storage" supplies in-render from
// the hydrated `supplies` snapshot (lots are already loaded via
// getSuppliesForSpace's includeLots option), which lets the freshness
// signal differ per supply: oldest active lot's `acquired_at` for
// lot-tracked supplies, falling back to `supplies.updated_at` otherwise.
// See SuppliesSection's getIdleSinceIso helper.

// ============================================
// DELETE
// ============================================

export async function deleteSupply(supplyId: string): Promise<void> {
  console.log('📦 Deleting supply:', supplyId);

  const { error } = await supabase
    .from('supplies')
    .delete()
    .eq('id', supplyId);

  if (error) {
    console.error('❌ Error deleting supply:', error);
    throw error;
  }
}

// ============================================
// LOT TRACKING TOGGLE (CP6e-Services-a, D8R-Q43 / Q60)
// ============================================

/**
 * D8R-Q43. Flip `tracks_lots` on/off for a supply.
 *
 * When `value === true`:
 *   - Set tracks_lots=true.
 *   - If `initialLot` is provided, create it via lotsService.createLot. The
 *     createLot call's Q45 auto-restock then handles status if the supply was
 *     in low/critical/out before the lot landed.
 *
 * When `value === false` (D8R-Q60):
 *   - Reject if any active lots exist. Caller must archive lots first via
 *     SupplyDetail UI. The toggle is hidden in the UI when active lots are
 *     present (Q60 prevents accidental toggle-off).
 */
export async function setSupplyTracksLots(
  supplyId: string,
  value: boolean,
  initialLot?: CreateLotParams
): Promise<SupplyWithTags> {
  console.log('📦 Setting supply tracks_lots:', { supplyId, value, hasInitialLot: !!initialLot });

  const before = await getSupplyById(supplyId);
  if (!before) throw new SupplyNotFoundError(supplyId);

  if (value === true) {
    if (!before.tracks_lots) {
      const { error } = await supabase
        .from('supplies')
        .update({ tracks_lots: true })
        .eq('id', supplyId);

      if (error) {
        console.error('❌ Error enabling tracks_lots:', error);
        throw error;
      }
    }

    if (initialLot) {
      // createLot's _maybeAutoRestock reads supplies.tracks_lots, which is now
      // true post-update — so a low/critical/out supply auto-flips to in_stock
      // when the first lot lands.
      await createLot({ ...initialLot, supply_id: supplyId });
    }

    const after = await getSupplyById(supplyId, { includeLots: true });
    if (!after) throw new SupplyNotFoundError(supplyId);
    return after;
  }

  // value === false: D8R-Q60 — block if any active lots remain.
  const { count: activeLotCount, error: countError } = await supabase
    .from('supply_lots')
    .select('id', { count: 'exact', head: true })
    .eq('supply_id', supplyId)
    .is('consumed_at', null);

  if (countError) {
    console.error('❌ Error counting active lots for tracks_lots disable:', countError);
    throw countError;
  }

  if ((activeLotCount ?? 0) > 0) {
    throw new Error(
      'Cannot disable lot tracking while active lots exist. Archive all lots first.'
    );
  }

  const { error } = await supabase
    .from('supplies')
    .update({ tracks_lots: false })
    .eq('id', supplyId);

  if (error) {
    console.error('❌ Error disabling tracks_lots:', error);
    throw error;
  }

  const after = await getSupplyById(supplyId);
  if (!after) throw new SupplyNotFoundError(supplyId);
  return after;
}

// ============================================
// SERVER-SIDE FULL-TEXT SEARCH (CP6e-FlowsUI-b2)
// ============================================

/**
 * One row returned from the `search_supplies` RPC. The RPC also returns a
 * `match_count` column but it's a placeholder (per the schema migration
 * comment); we drop it client-side and rely on the post-hoc matcher
 * (`lib/utils/lotSearch.computeSupplySearchMatch`) to compute pill labels.
 */
export interface SupplySearchHit {
  supplyId: string;
  rank: number;
}

/**
 * D8R-Q56 + Q57 — full-text supply + lot search via the server's
 * `search_supplies(query_text, p_space_id)` RPC. Tokens AND across; each
 * token must match somewhere in the union of supply + active-lots tsvectors
 * (with storage synonym expansion via `expand_storage_synonyms`).
 *
 * Returns supply IDs ordered by ts_rank DESC. Caller maps to local supply
 * objects and runs the post-hoc dimension matcher to derive pill labels +
 * matched lot ids.
 *
 * The RPC tolerates whitespace-only queries internally (returns nothing);
 * callers can pass through without pre-validation.
 */
export async function searchSuppliesServerSide(
  query: string,
  spaceId: string
): Promise<SupplySearchHit[]> {
  console.log('🔍 searchSuppliesServerSide:', { query, spaceId });

  const { data, error } = await supabase.rpc('search_supplies', {
    query_text: query,
    p_space_id: spaceId,
  });

  if (error) {
    console.error('❌ searchSuppliesServerSide error:', error);
    throw error;
  }

  type RpcRow = { supply_id: string; rank: number; match_count?: number };
  return ((data ?? []) as RpcRow[]).map((row) => ({
    supplyId: row.supply_id,
    rank: row.rank,
  }));
}

// ============================================
// HELPER (pure)
// ============================================

export function getSupplyDisplayName(supply: SupplyWithTags): string {
  return getSupplyDisplayNameInternal(supply);
}
