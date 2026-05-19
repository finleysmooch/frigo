// ============================================
// FRIGO — LOTS SERVICE (Phase 8R-CP6e-Services-a)
// ============================================
// Individual physical inventory instances ("lots") of a supply when the supply
// has tracks_lots = true. CRUD + aggregate + cook-depletion entry-point.
//
// Decisions wired here:
//   D8R-Q43 (tracks_lots opt-in)   — caller flips via suppliesService
//   D8R-Q44 (auto-out at qty=0)    — _maybeAutoOutOfStock
//   D8R-Q45 (auto-restock on add)  — _maybeAutoRestock
//   D8R-Q46 (lot fields)           — see lib/types/supplies.ts
//   D8R-Q47 (storage move recomputes expiration unless overridden)
//   D8R-Q48 (consume → archive)    — updateLot at qty=0 + archiveLot direct
//   D8R-Q52 (oldest-first deplete) — deductFromOldest
//   D8R-Q60 (toggle blocked w/ active lots) — enforced in suppliesService
//
// No UI changes here. No cookDepletion changes here (that's CP6e-Services-b).
// ============================================

import { supabase } from '../supabase';
import {
  CreateLotParams,
  LotDeductionPlanItem,
  LotDeductionResult,
  StorageLocation,
  SupplyLot,
  SupplyLotAggregate,
  SupplyStatus,
  UpdateLotParams,
} from '../types/supplies';
import { setSupplyStatus } from './suppliesService';
import { convertBetween } from './unitConverter';

// ============================================
// ERROR CLASSES
// ============================================

export class LotNotFoundError extends Error {
  constructor(id: string) {
    super(`Lot ${id} not found or not accessible`);
    this.name = 'LotNotFoundError';
  }
}

// ============================================
// INTERNAL
// ============================================

const LOT_SELECT = '*';

const EXPIRING_SOON_DAYS = 7;

// Days-to-ms for expiration math.
const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNowISO(days: number, fromISO?: string): string {
  const base = fromISO ? new Date(fromISO).getTime() : Date.now();
  return new Date(base + days * DAY_MS).toISOString();
}

// CP6d-Schema parity: 'counter' falls back to pantry shelf-life.
function pickShelfLifeDays(
  storage: StorageLocation,
  ing: {
    shelf_life_days_fridge: number | null;
    shelf_life_days_freezer: number | null;
    shelf_life_days_pantry: number | null;
  }
): number | null {
  switch (storage) {
    case 'freezer':
      return ing.shelf_life_days_freezer;
    case 'fridge':
      return ing.shelf_life_days_fridge;
    case 'pantry':
    case 'counter':
      return ing.shelf_life_days_pantry;
  }
}

async function _getShelfLifeDays(
  supplyId: string,
  storage: StorageLocation
): Promise<number | null> {
  const { data, error } = await supabase
    .from('supplies')
    .select(
      'ingredient:ingredients(shelf_life_days_fridge, shelf_life_days_freezer, shelf_life_days_pantry)'
    )
    .eq('id', supplyId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error loading ingredient shelf life for supply:', error);
    return null;
  }
  if (!data) return null;

  const ing = (
    data as {
      ingredient: {
        shelf_life_days_fridge: number | null;
        shelf_life_days_freezer: number | null;
        shelf_life_days_pantry: number | null;
      } | null;
    }
  ).ingredient;
  if (!ing) return null;

  return pickShelfLifeDays(storage, ing);
}

// D8R-Q44. Called after operations that may have brought total active qty to 0.
// Auto-flips supply.status to 'out' iff:
//   - supply.tracks_lots = true
//   - no remaining active lot has quantity > 0
//   - status isn't already 'out'
async function _maybeAutoOutOfStock(supplyId: string): Promise<SupplyStatus | null> {
  const { data: supplyRow, error: supError } = await supabase
    .from('supplies')
    .select('id, tracks_lots, status, archived_at')
    .eq('id', supplyId)
    .maybeSingle();

  if (supError) {
    console.error('❌ Error reading supply for auto-out check:', supError);
    return null;
  }
  if (!supplyRow) return null;

  const sup = supplyRow as { id: string; tracks_lots: boolean; status: SupplyStatus; archived_at: string | null };
  if (!sup.tracks_lots) return null;
  if (sup.archived_at !== null) return null;
  if (sup.status === 'out') return null;

  // Count active lots with qty > 0.
  const { count: nonzeroCount, error: countError } = await supabase
    .from('supply_lots')
    .select('id', { count: 'exact', head: true })
    .eq('supply_id', supplyId)
    .is('consumed_at', null)
    .gt('quantity', 0);

  if (countError) {
    console.error('❌ Error counting nonzero active lots:', countError);
    return null;
  }

  if ((nonzeroCount ?? 0) > 0) return null;

  console.log('📦 Auto-flipping supply to out (Q44):', supplyId);
  const result = await setSupplyStatus(supplyId, 'out');
  return result.supply.status;
}

// D8R-Q45. Called after createLot. Auto-flips supply.status to 'in_stock' iff:
//   - supply.tracks_lots = true
//   - status currently in (low, critical, out)
//   - at least one active lot has qty > 0 (the new lot just inserted satisfies)
async function _maybeAutoRestock(supplyId: string): Promise<SupplyStatus | null> {
  const { data: supplyRow, error: supError } = await supabase
    .from('supplies')
    .select('id, tracks_lots, status, archived_at')
    .eq('id', supplyId)
    .maybeSingle();

  if (supError) {
    console.error('❌ Error reading supply for auto-restock check:', supError);
    return null;
  }
  if (!supplyRow) return null;

  const sup = supplyRow as { id: string; tracks_lots: boolean; status: SupplyStatus; archived_at: string | null };
  if (!sup.tracks_lots) return null;
  if (sup.archived_at !== null) return null;
  if (sup.status !== 'low' && sup.status !== 'critical' && sup.status !== 'out') return null;

  // At least one active lot with qty > 0?
  const { count: nonzeroCount, error: countError } = await supabase
    .from('supply_lots')
    .select('id', { count: 'exact', head: true })
    .eq('supply_id', supplyId)
    .is('consumed_at', null)
    .gt('quantity', 0);

  if (countError) {
    console.error('❌ Error counting active lots for restock:', countError);
    return null;
  }
  if ((nonzeroCount ?? 0) === 0) return null;

  console.log('📦 Auto-flipping supply to in_stock (Q45):', supplyId);
  const result = await setSupplyStatus(supplyId, 'in_stock');
  return result.supply.status;
}

// ============================================
// CREATE
// ============================================

/**
 * Insert a new lot. If `expires_at` is omitted, attempts to compute a default
 * from the supply's ingredient.shelf_life_days_<storage>. After insert,
 * D8R-Q45 auto-restock fires when applicable (private helper).
 *
 * createLot is NOT idempotent — duplicate calls create duplicate rows. Lots
 * are physical instances and the user can genuinely have two identical packs.
 */
export async function createLot(params: CreateLotParams): Promise<SupplyLot> {
  console.log('🧊 Creating lot:', {
    supplyId: params.supply_id,
    qty: params.quantity,
    unit: params.quantity_unit,
    storage: params.storage_location,
  });

  const acquiredAt = params.acquired_at ?? new Date().toISOString();

  let expiresAt: string | null = params.expires_at ?? null;
  if (params.expires_at === undefined) {
    const shelfDays = await _getShelfLifeDays(params.supply_id, params.storage_location);
    if (shelfDays !== null) {
      expiresAt = daysFromNowISO(shelfDays, acquiredAt);
    }
  }

  const insertRow = {
    supply_id: params.supply_id,
    quantity: params.quantity,
    quantity_unit: params.quantity_unit,
    storage_location: params.storage_location,
    acquired_at: acquiredAt,
    expires_at: expiresAt,
    expires_at_overridden: params.expires_at !== undefined,
    variant_label: params.variant_label ?? null,
    brand: params.brand ?? null,
    notes: params.notes ?? null,
    created_by: params.created_by ?? null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('supply_lots')
    .insert(insertRow)
    .select(LOT_SELECT)
    .single();

  if (insertError) {
    console.error('❌ Error creating lot:', insertError);
    throw insertError;
  }

  // Q45 auto-restock cascade — runs after lot row is committed.
  await _maybeAutoRestock(params.supply_id);

  return inserted as SupplyLot;
}

// ============================================
// UPDATE
// ============================================

/**
 * Patch a lot. Special semantics:
 *   - If `expires_at` is provided, also set `expires_at_overridden = true`
 *     (future storage moves will respect the override per Q47).
 *   - If `quantity` is provided as 0, also set `consumed_at = NOW` (Q48
 *     soft-delete) and trigger Q44 auto-out check.
 *   - Trigger maintains updated_at + search_vector automatically.
 */
export async function updateLot(
  lotId: string,
  params: UpdateLotParams
): Promise<SupplyLot> {
  console.log('🧊 Updating lot:', { lotId, params });

  const before = await getLotById(lotId);
  if (!before) throw new LotNotFoundError(lotId);

  const patch: Record<string, unknown> = {};
  let willArchive = false;

  if (params.quantity !== undefined) {
    if (params.quantity < 0) {
      throw new Error(`Invalid quantity: ${params.quantity}. Must be >= 0.`);
    }
    patch.quantity = params.quantity;
    if (params.quantity === 0 && before.consumed_at === null) {
      patch.consumed_at = new Date().toISOString();
      willArchive = true;
    }
  }

  if (params.quantity_unit !== undefined) patch.quantity_unit = params.quantity_unit;
  if (params.storage_location !== undefined) patch.storage_location = params.storage_location;
  if (params.acquired_at !== undefined) patch.acquired_at = params.acquired_at;
  if (params.expires_at !== undefined) {
    patch.expires_at = params.expires_at;
    patch.expires_at_overridden = true;
  }
  if (params.variant_label !== undefined) patch.variant_label = params.variant_label;
  if (params.brand !== undefined) patch.brand = params.brand;
  if (params.notes !== undefined) patch.notes = params.notes;

  const { data: updated, error } = await supabase
    .from('supply_lots')
    .update(patch)
    .eq('id', lotId)
    .select(LOT_SELECT)
    .single();

  if (error) {
    console.error('❌ Error updating lot:', error);
    throw error;
  }

  if (willArchive) {
    await _maybeAutoOutOfStock(before.supply_id);
  }

  return updated as SupplyLot;
}

// ============================================
// ARCHIVE / DELETE
// ============================================

/**
 * Soft-delete a lot by setting consumed_at = NOW (D8R-Q48). Idempotent at the
 * caller's expense — re-archiving overwrites consumed_at with a later NOW.
 */
export async function archiveLot(lotId: string): Promise<void> {
  console.log('🧊 Archiving lot:', lotId);

  const before = await getLotById(lotId);
  if (!before) throw new LotNotFoundError(lotId);

  const { error } = await supabase
    .from('supply_lots')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', lotId);

  if (error) {
    console.error('❌ Error archiving lot:', error);
    throw error;
  }

  await _maybeAutoOutOfStock(before.supply_id);
}

/**
 * Hard-delete a lot. Rare; archive (soft-delete) is the normal path so activity
 * history remains queryable.
 */
export async function deleteLot(lotId: string): Promise<void> {
  console.log('🧊 Deleting lot (hard):', lotId);

  const { error } = await supabase
    .from('supply_lots')
    .delete()
    .eq('id', lotId);

  if (error) {
    console.error('❌ Error deleting lot:', error);
    throw error;
  }
}

// ============================================
// READ
// ============================================

/**
 * Active lots first (consumed_at IS NULL), ordered oldest-expiration-first
 * with acquired_at as tiebreaker. With `includeArchived: true`, archived lots
 * are appended at the end with the same secondary ordering.
 */
export async function getLotsForSupply(
  supplyId: string,
  options?: { includeArchived?: boolean }
): Promise<SupplyLot[]> {
  const { data: active, error: activeError } = await supabase
    .from('supply_lots')
    .select(LOT_SELECT)
    .eq('supply_id', supplyId)
    .is('consumed_at', null)
    .order('expires_at', { ascending: true, nullsFirst: false })
    .order('acquired_at', { ascending: true });

  if (activeError) {
    console.error('❌ Error loading active lots:', activeError);
    throw activeError;
  }

  if (!options?.includeArchived) {
    return (active ?? []) as SupplyLot[];
  }

  const { data: archived, error: archivedError } = await supabase
    .from('supply_lots')
    .select(LOT_SELECT)
    .eq('supply_id', supplyId)
    .not('consumed_at', 'is', null)
    .order('consumed_at', { ascending: false });

  if (archivedError) {
    console.error('❌ Error loading archived lots:', archivedError);
    throw archivedError;
  }

  return [...((active ?? []) as SupplyLot[]), ...((archived ?? []) as SupplyLot[])];
}

export async function getLotById(lotId: string): Promise<SupplyLot | null> {
  const { data, error } = await supabase
    .from('supply_lots')
    .select(LOT_SELECT)
    .eq('id', lotId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error loading lot:', error);
    throw error;
  }

  return (data as SupplyLot | null) ?? null;
}

/**
 * Aggregate already-loaded lots into display-ready summary fields. Filters to
 * active (consumed_at IS NULL). Picks a canonical_unit by trying to convert
 * every lot's qty into the first lot's unit; if any lot doesn't bridge, falls
 * back to canonical_unit=null + total_quantity=0 as the caller's signal that
 * aggregation isn't meaningful.
 *
 * Async because unit-bridging needs the measurement_units table (cached after
 * first call by unitConverter).
 */
export async function getLotAggregate(
  lots: SupplyLot[]
): Promise<SupplyLotAggregate> {
  const active = lots.filter((l) => l.consumed_at === null);

  const lot_count = active.length;
  const storage_locations = Array.from(
    new Set(active.map((l) => l.storage_location))
  );
  const variant_labels = Array.from(
    new Set(
      active
        .map((l) => l.variant_label)
        .filter((v): v is string => v !== null && v.length > 0)
    )
  );

  // Oldest expiration across active lots (skip nulls).
  let oldest_expiration: string | null = null;
  for (const lot of active) {
    if (lot.expires_at === null) continue;
    if (oldest_expiration === null || lot.expires_at < oldest_expiration) {
      oldest_expiration = lot.expires_at;
    }
  }

  const sevenDaysOut = new Date(Date.now() + EXPIRING_SOON_DAYS * DAY_MS);
  const has_expiring_soon = active.some(
    (l) => l.expires_at !== null && new Date(l.expires_at) <= sevenDaysOut
  );

  // Total + canonical_unit.
  let total_quantity = 0;
  let canonical_unit: string | null = null;

  if (active.length === 1) {
    total_quantity = active[0].quantity;
    canonical_unit = active[0].quantity_unit;
  } else if (active.length > 1) {
    canonical_unit = active[0].quantity_unit;
    let runningTotal = 0;
    let bridgeOk = true;
    for (const lot of active) {
      const inCanonical = await convertBetween(
        lot.quantity,
        lot.quantity_unit,
        canonical_unit
      );
      if (inCanonical === null) {
        bridgeOk = false;
        break;
      }
      runningTotal += inCanonical;
    }
    if (bridgeOk) {
      total_quantity = runningTotal;
    } else {
      canonical_unit = null;
      total_quantity = 0;
    }
  }

  return {
    total_quantity,
    canonical_unit,
    lot_count,
    storage_locations,
    variant_labels,
    oldest_expiration,
    has_expiring_soon,
  };
}

// ============================================
// DEDUCT (cookDepletion entry-point)
// ============================================

/**
 * Draw `quantity` of `quantityUnit` from this supply's lots, oldest-expiration
 * first. Cross-lot decrement when one lot can't satisfy the full draw. Skips
 * lots with units that can't bridge to `quantityUnit`.
 *
 * S3 cross-lot rules:
 *   (a) variant_label mixing — silently mixed (variant is a tag, not a constraint)
 *   (b) unit mismatches — skip incompatible lots; if NO lot is compatible,
 *       short-circuit with shortfall_reason='no_compatible_unit' and don't
 *       partial-draw any compatible-but-insufficient pool
 *   (c) recipe demands more than total available — partial deplete to 0 across
 *       all compatible lots; shortfall reflects the gap; status auto-flips to
 *       'out' (Q44 — total active qty is now 0)
 *
 * Lots that hit qty=0 auto-archive (Q48). Q44 auto-out fires after the walk.
 */
export async function deductFromOldest(
  supplyId: string,
  quantity: number,
  quantityUnit: string
): Promise<LotDeductionResult> {
  console.log('🧊 deductFromOldest:', { supplyId, quantity, quantityUnit });

  if (quantity <= 0) {
    return {
      lots_affected: [],
      status_changed_to: null,
      shortfall: 0,
      shortfall_reason: null,
    };
  }

  const lots = await getLotsForSupply(supplyId, { includeArchived: false });

  // Pre-walk: at least one lot has compatible unit AND qty > 0?
  let hasCompatible = false;
  for (const lot of lots) {
    if (lot.quantity <= 0) continue;
    const factor = await convertBetween(1, lot.quantity_unit, quantityUnit);
    if (factor !== null) {
      hasCompatible = true;
      break;
    }
  }

  if (!hasCompatible) {
    return {
      lots_affected: [],
      status_changed_to: null,
      shortfall: quantity,
      shortfall_reason: 'no_compatible_unit',
    };
  }

  let remaining = quantity;
  const lotsAffected: LotDeductionResult['lots_affected'] = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    if (lot.quantity <= 0) continue;

    const lotQtyInTarget = await convertBetween(
      lot.quantity,
      lot.quantity_unit,
      quantityUnit
    );
    if (lotQtyInTarget === null) continue; // incompatible — skip silently

    const drawTarget = Math.min(remaining, lotQtyInTarget);
    // Convert the target-unit draw back to the lot's unit for the actual write.
    const drawLotUnit = await convertBetween(
      drawTarget,
      quantityUnit,
      lot.quantity_unit
    );
    if (drawLotUnit === null) continue; // shouldn't happen; same pair worked above

    const newQty = Math.max(0, lot.quantity - drawLotUnit);
    const archivedNow = newQty === 0;

    const patch: Record<string, unknown> = { quantity: newQty };
    if (archivedNow) {
      patch.consumed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('supply_lots')
      .update(patch)
      .eq('id', lot.id);

    if (updateError) {
      console.error('❌ Error deducting from lot:', updateError);
      throw updateError;
    }

    lotsAffected.push({
      lot_id: lot.id,
      quantity_before: lot.quantity,
      quantity_deducted: drawLotUnit,
      quantity_after: newQty,
      quantity_unit: lot.quantity_unit,
      archived: archivedNow,
    });

    remaining -= drawTarget;
  }

  const shortfall = remaining > 0 ? remaining : 0;
  const shortfall_reason: LotDeductionResult['shortfall_reason'] =
    shortfall > 0 ? 'insufficient_stock' : null;

  // Q44 cascade if we drained anything.
  let status_changed_to: SupplyStatus | null = null;
  if (lotsAffected.length > 0) {
    status_changed_to = await _maybeAutoOutOfStock(supplyId);
  }

  return {
    lots_affected: lotsAffected,
    status_changed_to,
    shortfall,
    shortfall_reason,
  };
}

// ============================================
// DEDUCT — manual override (CP6e-Services-b)
// ============================================

/**
 * Draw explicit quantities from explicit lots (caller-named, not oldest-first).
 * Used by cookDepletionService.applyDepletion when the user picks specific
 * lots via the lot-picker UI. Bypasses the oldest-first heuristic of
 * deductFromOldest.
 *
 * Each plan item is processed in plan order. Per-item:
 *   - Unit incompatibility → soft fail (lots_affected entry with
 *     quantity_deducted=0; tracked in shortfall; shortfall_reason eventually
 *     set to 'no_compatible_unit').
 *   - Insufficient stock in the named lot → partial deduct + remaining
 *     contributes to shortfall (shortfall_reason='insufficient_stock' if no
 *     unit failure also occurred).
 *
 * Shortfall is summed numerically across plan items in the requested unit
 * (no cross-unit conversion); the caller is responsible for reconciling
 * mixed-unit shortfalls if relevant.
 *
 * Q44 auto-out fires after the walk via the shared `_maybeAutoOutOfStock`
 * helper.
 */
export async function deductFromSpecificLots(
  supplyId: string,
  plan: LotDeductionPlanItem[]
): Promise<LotDeductionResult> {
  console.log('🧊 deductFromSpecificLots:', { supplyId, items: plan.length });

  if (plan.length === 0) {
    return {
      lots_affected: [],
      status_changed_to: null,
      shortfall: 0,
      shortfall_reason: null,
    };
  }

  // Validate every lot_id in the plan belongs to supplyId. Fetch the lots in
  // one round-trip; throw if any plan id is unknown or wrong-supply.
  const planLotIds = plan.map((p) => p.lot_id);
  const { data: rawLotRows, error: fetchError } = await supabase
    .from('supply_lots')
    .select(LOT_SELECT)
    .in('id', planLotIds)
    .eq('supply_id', supplyId);

  if (fetchError) {
    console.error('❌ Error fetching lots for plan validation:', fetchError);
    throw fetchError;
  }

  const fetched = (rawLotRows ?? []) as SupplyLot[];
  if (fetched.length !== planLotIds.length) {
    throw new Error('Lot ID does not belong to supply');
  }
  const lotsById = new Map<string, SupplyLot>(fetched.map((l) => [l.id, l]));

  const lotsAffected: LotDeductionResult['lots_affected'] = [];
  let totalShortfall = 0;
  let sawUnitIncompatibility = false;

  for (const item of plan) {
    if (item.quantity <= 0) {
      // Treat as no-op per prompt — skip silently.
      continue;
    }

    const lot = lotsById.get(item.lot_id);
    if (!lot) {
      // Defensive — validation pass should have caught this.
      throw new Error('Lot ID does not belong to supply');
    }

    const lotQtyInPlanUnit = await convertBetween(
      lot.quantity,
      lot.quantity_unit,
      item.quantity_unit
    );

    if (lotQtyInPlanUnit === null) {
      // Unit incompatible — soft fail.
      lotsAffected.push({
        lot_id: lot.id,
        quantity_before: lot.quantity,
        quantity_deducted: 0,
        quantity_after: lot.quantity,
        quantity_unit: lot.quantity_unit,
        archived: false,
      });
      sawUnitIncompatibility = true;
      totalShortfall += item.quantity;
      continue;
    }

    const drawInPlanUnit = Math.min(item.quantity, lotQtyInPlanUnit);
    const drawInLotUnit = await convertBetween(
      drawInPlanUnit,
      item.quantity_unit,
      lot.quantity_unit
    );
    if (drawInLotUnit === null) {
      // Shouldn't happen since the inverse just succeeded.
      lotsAffected.push({
        lot_id: lot.id,
        quantity_before: lot.quantity,
        quantity_deducted: 0,
        quantity_after: lot.quantity,
        quantity_unit: lot.quantity_unit,
        archived: false,
      });
      sawUnitIncompatibility = true;
      totalShortfall += item.quantity;
      continue;
    }

    const newQty = Math.max(0, lot.quantity - drawInLotUnit);
    const archivedNow = newQty === 0;

    const patch: Record<string, unknown> = { quantity: newQty };
    if (archivedNow) {
      patch.consumed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('supply_lots')
      .update(patch)
      .eq('id', lot.id);

    if (updateError) {
      console.error('❌ Error deducting from specific lot:', updateError);
      throw updateError;
    }

    lotsAffected.push({
      lot_id: lot.id,
      quantity_before: lot.quantity,
      quantity_deducted: drawInLotUnit,
      quantity_after: newQty,
      quantity_unit: lot.quantity_unit,
      archived: archivedNow,
    });

    if (drawInPlanUnit < item.quantity) {
      // Lot didn't have enough — partial draw, contributes to shortfall.
      totalShortfall += item.quantity - drawInPlanUnit;
    }
  }

  // Reason precedence: unit failure > insufficient stock > none.
  let shortfall_reason: LotDeductionResult['shortfall_reason'] = null;
  if (sawUnitIncompatibility) {
    shortfall_reason = 'no_compatible_unit';
  } else if (totalShortfall > 0) {
    shortfall_reason = 'insufficient_stock';
  }

  // Q44 cascade — same private helper used by deductFromOldest.
  const status_changed_to = await _maybeAutoOutOfStock(supplyId);

  return {
    lots_affected: lotsAffected,
    status_changed_to,
    shortfall: totalShortfall,
    shortfall_reason,
  };
}

// ============================================
// STORAGE MOVE (D8R-Q47)
// ============================================

/**
 * Move a lot to a different storage location. Recomputes expires_at using the
 * NEW storage's shelf_life_days from NOW (not from acquired_at — moving
 * fresh→freezer extends from the moment of the move) UNLESS:
 *   - `expires_at_overridden = true` (user explicitly set the expiration), OR
 *   - the ingredient has no shelf_life_days_<newStorage> data
 * In either of those cases, expires_at is preserved unchanged.
 */
export async function moveLotStorage(
  lotId: string,
  newStorage: StorageLocation
): Promise<{ lot: SupplyLot; expiration_recomputed: boolean }> {
  console.log('🧊 moveLotStorage:', { lotId, newStorage });

  const before = await getLotById(lotId);
  if (!before) throw new LotNotFoundError(lotId);

  const patch: Record<string, unknown> = { storage_location: newStorage };
  let expiration_recomputed = false;

  if (!before.expires_at_overridden) {
    const shelfDays = await _getShelfLifeDays(before.supply_id, newStorage);
    if (shelfDays !== null) {
      patch.expires_at = daysFromNowISO(shelfDays);
      expiration_recomputed = true;
    }
  }

  const { data: updated, error } = await supabase
    .from('supply_lots')
    .update(patch)
    .eq('id', lotId)
    .select(LOT_SELECT)
    .single();

  if (error) {
    console.error('❌ Error moving lot storage:', error);
    throw error;
  }

  return { lot: updated as SupplyLot, expiration_recomputed };
}
