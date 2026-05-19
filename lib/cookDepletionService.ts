// ============================================
// FRIGO - COOK DEPLETION SERVICE (Phase 8R-CP6e-Services-b)
// ============================================
// Orchestrates lot-level supply depletion after a cook post is submitted.
// Cross-cuts supplies, supply_lots, recipe_ingredients, posts.
// Location: lib/cookDepletionService.ts
//
// CP6e-Services-b model (D8R-Q53):
//   - For tracks_lots=true supplies: deduct actual recipe qty from oldest-
//     expiring lot (cross-lot draw if needed). Status auto-flips to 'out' only
//     when total active qty=0 (Q44 via lotsService._maybeAutoOutOfStock).
//   - For tracks_lots=false supplies: NO-OP. No status demote on cook. User
//     manages status manually. (Reverses prior 8R-CP3 one-step demotion rule.)
//   - Optional per-supply manual override via applyDepletion(plan, { overrides }).
//   - Persistent record on posts.lot_depletions JSONB so undo survives restart.
//   - Spawn-on-out chain preserved transparently: lot qty=0 → Q44 →
//     setSupplyStatus(out) → existing Q10β/Q48 spawn logic.
// ============================================

import { supabase } from './supabase';
import {
  setSupplyStatus,
  getSuppliesForSpace,
  getSupplyDisplayName,
} from './services/suppliesService';
import {
  deductFromOldest,
  deductFromSpecificLots,
} from './services/lotsService';
import {
  LotDeductionPlanItem,
  SupplyStatus,
} from './types/supplies';

// ============================================
// TYPES (UI-flow domain types — Q46 exempt per Constraint 7)
// ============================================

export interface DepletionSupply {
  supply_id: string;
  display_name: string;

  // Existing — preserved for back-compat with banner UI consumers.
  // Semantically: status before / status after the cook event.
  old_status: SupplyStatus;
  new_status: SupplyStatus;
  spawned_need_id: string | null;

  // CP6e-Services-b: recipe context populated at compute time.
  recipe_quantity: number;
  recipe_quantity_unit: string;
  is_lot_supply: boolean;        // true for every entry in current model (Q53 skips non-lot)

  // CP6e-Services-b: populated at apply time by deductFromOldest / deductFromSpecificLots.
  lots_affected: Array<{
    lot_id: string;
    quantity_before: number;
    quantity_deducted: number;
    quantity_after: number;
    quantity_unit: string;
    archived: boolean;
  }>;
  shortfall: number;
  shortfall_reason: 'no_compatible_unit' | 'insufficient_stock' | null;
}

export interface DepletionPlan {
  post_id: string;
  space_id: string;
  supplies: DepletionSupply[];
}

// Persisted JSONB shape (omits display_name — re-derived on read).
type PersistedDepletionEntry = Omit<DepletionSupply, 'display_name'>;

// ============================================
// COMPUTE
// ============================================

/**
 * Compute a depletion plan for a cook post against a specific space's supplies.
 * Returns null when there's nothing to do (silent):
 *   - post has no recipe_id (freeform post)
 *   - recipe has no ingredients with matching tracks_lots supplies
 *   - matching supplies are all tracks_lots=false (Q53 skip)
 *
 * Only tracks_lots=true supplies enter the plan. Custom-name supplies (no
 * ingredient_id) never match recipe ingredients. Recipe ingredients with
 * NULL quantity_amount are silently skipped per Constraint 9.
 */
export async function computeDepletion(
  postId: string,
  spaceId: string
): Promise<DepletionPlan | null> {
  console.log('📦 Computing depletion plan:', { postId, spaceId });

  // 1. Fetch post → recipe_id. No recipe_id = freeform = silent.
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, recipe_id')
    .eq('id', postId)
    .single();

  if (postError) {
    console.error('❌ Error fetching post for depletion:', postError);
    throw postError;
  }
  const recipeId = (post as { recipe_id: string | null })?.recipe_id;
  if (!recipeId) return null;

  // 2. Fetch recipe_ingredients with quantity context.
  const { data: recipeIngredients, error: riError } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_id, quantity_amount, quantity_unit')
    .eq('recipe_id', recipeId);

  if (riError) {
    console.error('❌ Error fetching recipe_ingredients for depletion:', riError);
    throw riError;
  }

  type RI = {
    ingredient_id: string | null;
    quantity_amount: number | null;
    quantity_unit: string | null;
  };
  const ingredientQtyMap = new Map<string, { quantity: number; unit: string }>();
  for (const row of (recipeIngredients ?? []) as RI[]) {
    if (!row.ingredient_id) continue;
    if (row.quantity_amount === null || row.quantity_unit === null) {
      console.log(
        '⏭️ Skipping depletion for ingredient with no quantity:',
        row.ingredient_id
      );
      continue;
    }
    ingredientQtyMap.set(row.ingredient_id, {
      quantity: row.quantity_amount,
      unit: row.quantity_unit,
    });
  }

  if (ingredientQtyMap.size === 0) return null;

  // 3. Fetch supplies (with lots) for the space.
  const supplies = await getSuppliesForSpace(spaceId, { includeLots: true });

  // 4. Match recipe ingredients → supplies. Skip non-tracks_lots silently
  //    (Q53). Custom-name supplies have ingredient_id=null and never match.
  const planSupplies: DepletionSupply[] = [];

  for (const supply of supplies) {
    if (!supply.ingredient_id) continue;
    const recipeQty = ingredientQtyMap.get(supply.ingredient_id);
    if (!recipeQty) continue;

    // Q53 — silent skip for non-lot-tracking supplies.
    if (!supply.tracks_lots) continue;

    planSupplies.push({
      supply_id: supply.id,
      display_name: getSupplyDisplayName(supply),
      old_status: supply.status,
      new_status: supply.status,        // updated at apply if Q44 fires
      spawned_need_id: null,
      recipe_quantity: recipeQty.quantity,
      recipe_quantity_unit: recipeQty.unit,
      is_lot_supply: true,
      lots_affected: [],
      shortfall: 0,
      shortfall_reason: null,
    });
  }

  if (planSupplies.length === 0) return null;

  return {
    post_id: postId,
    space_id: spaceId,
    supplies: planSupplies,
  };
}

// ============================================
// APPLY
// ============================================

/**
 * Apply the plan. For each supply entry:
 *   - With override: lotsService.deductFromSpecificLots(supply_id, plan).
 *   - Without override: lotsService.deductFromOldest(supply_id, qty, unit).
 *
 * Both paths fire Q44 auto-out via lotsService._maybeAutoOutOfStock when total
 * active qty hits 0; that calls setSupplyStatus, which carries the existing
 * Q10β/Q48 spawn-on-out chain. cookDepletion does NOT manually re-spawn.
 *
 * Per-supply errors are logged but not thrown — partial state is acceptable
 * (user can review and undo).
 *
 * After the loop, persists structured `lot_depletions` JSONB on posts.
 */
export async function applyDepletion(
  plan: DepletionPlan,
  options?: {
    overrides?: Record<string, LotDeductionPlanItem[]>;
  }
): Promise<void> {
  console.log('📦 Applying depletion plan:', {
    post_id: plan.post_id,
    supplies: plan.supplies.length,
    overrides: options?.overrides ? Object.keys(options.overrides).length : 0,
  });

  for (const entry of plan.supplies) {
    try {
      const override = options?.overrides?.[entry.supply_id];

      const result = override
        ? await deductFromSpecificLots(entry.supply_id, override)
        : await deductFromOldest(
            entry.supply_id,
            entry.recipe_quantity,
            entry.recipe_quantity_unit
          );

      entry.lots_affected = result.lots_affected;
      entry.shortfall = result.shortfall;
      entry.shortfall_reason = result.shortfall_reason;

      if (result.status_changed_to !== null) {
        entry.new_status = result.status_changed_to;

        // Q44 fired → setSupplyStatus(out) → spawn-on-out chain. Pull the
        // spawned need's id (if any) for the rollback path.
        const { data: spawnedNeed, error: spawnLookupError } = await supabase
          .from('needs')
          .select('id')
          .eq('supply_id', entry.supply_id)
          .in('status', ['need', 'in_cart'])
          .limit(1)
          .maybeSingle();

        if (spawnLookupError) {
          console.error(
            '❌ applyDepletion spawn-need lookup failed:',
            { id: entry.supply_id, err: spawnLookupError }
          );
        } else {
          entry.spawned_need_id =
            (spawnedNeed as { id: string } | null)?.id ?? null;
        }
      }
    } catch (err) {
      console.error('❌ applyDepletion supply failed:', {
        id: entry.supply_id,
        err,
      });
      entry.shortfall = entry.recipe_quantity;
      entry.shortfall_reason = 'insufficient_stock';
    }
  }

  // Persist the structured record. Omit display_name (re-derived on read).
  const persisted: PersistedDepletionEntry[] = plan.supplies.map((entry) => ({
    supply_id: entry.supply_id,
    old_status: entry.old_status,
    new_status: entry.new_status,
    spawned_need_id: entry.spawned_need_id,
    recipe_quantity: entry.recipe_quantity,
    recipe_quantity_unit: entry.recipe_quantity_unit,
    is_lot_supply: entry.is_lot_supply,
    lots_affected: entry.lots_affected,
    shortfall: entry.shortfall,
    shortfall_reason: entry.shortfall_reason,
  }));

  const { error: persistError } = await supabase
    .from('posts')
    .update({ lot_depletions: persisted })
    .eq('id', plan.post_id);

  if (persistError) {
    console.error(
      '❌ applyDepletion failed to persist lot_depletions:',
      persistError
    );
  }
}

// ============================================
// REPLACE — manual override path (CP6e-FlowsUI-a)
// ============================================

export class SupplyEntryNotInPlanError extends Error {
  constructor(supplyId: string) {
    super(`Supply ${supplyId} not present in plan.supplies`);
    this.name = 'SupplyEntryNotInPlanError';
  }
}

/**
 * CP6e-FlowsUI-a. Reverse the existing draw for ONE supply in the plan, then
 * re-deduct with the user's override plan. Mutates the entry in place inside
 * `plan.supplies` (caller passes the mutated reference to the banner
 * context's `updateSupplyEntry` to trigger a re-render with a fresh
 * BannerState) and re-persists `posts.lot_depletions`.
 *
 * Mirrors a partial `rollbackDepletion` for the one supply followed by a
 * partial `applyDepletion` with `options.overrides`, condensed into one
 * service call so the picker UI doesn't need to chain orchestration.
 *
 * Throws `SupplyEntryNotInPlanError` when `supplyId` isn't in the plan.
 * Per-supply revert errors (lot patch, status restore, spawned-need delete)
 * are logged + swallowed — matches `rollbackDepletion` style. If
 * `deductFromSpecificLots` throws, the error propagates so the picker can
 * surface it. Re-persist failures are logged + swallowed.
 *
 * `newDraw.length === 0` is treated as a no-op (returns the entry unchanged).
 * The picker's Confirm button should already prevent this, but the guard is
 * defensive.
 */
export async function replaceSupplyDeduction(
  plan: DepletionPlan,
  supplyId: string,
  newDraw: LotDeductionPlanItem[]
): Promise<DepletionSupply> {
  console.log('📦 Replacing supply deduction:', {
    post_id: plan.post_id,
    supplyId,
    newDrawCount: newDraw.length,
  });

  const entry = plan.supplies.find((s) => s.supply_id === supplyId);
  if (!entry) throw new SupplyEntryNotInPlanError(supplyId);

  if (newDraw.length === 0) {
    console.log('📦 replaceSupplyDeduction no-op (empty newDraw):', supplyId);
    return entry;
  }

  // 1. Reverse the existing draw for this entry — mirror rollbackDepletion's
  //    per-entry loop, but scoped to just this one supply.
  for (const lotChange of entry.lots_affected) {
    try {
      const patch: Record<string, unknown> = {
        quantity: lotChange.quantity_before,
      };
      if (lotChange.archived) {
        patch.consumed_at = null;
      }
      const { error: lotError } = await supabase
        .from('supply_lots')
        .update(patch)
        .eq('id', lotChange.lot_id);
      if (lotError) {
        console.error('❌ replaceSupplyDeduction lot revert failed:', {
          id: lotChange.lot_id,
          err: lotError,
        });
      }
    } catch (err) {
      console.error('❌ replaceSupplyDeduction lot revert threw:', {
        id: lotChange.lot_id,
        err,
      });
    }
  }

  if (entry.new_status !== entry.old_status) {
    try {
      await setSupplyStatus(entry.supply_id, entry.old_status);
    } catch (err) {
      console.error('❌ replaceSupplyDeduction supply restore failed:', {
        id: entry.supply_id,
        err,
      });
    }
  }

  if (entry.spawned_need_id) {
    const { error: needError } = await supabase
      .from('needs')
      .delete()
      .eq('id', entry.spawned_need_id);
    if (needError) {
      console.error('❌ replaceSupplyDeduction spawned-need delete failed:', {
        id: entry.spawned_need_id,
        err: needError,
      });
    }
    // Always clear locally; if the delete failed, the row stays orphaned but
    // we still need a fresh spawned_need_id lookup after the re-deduct.
    entry.spawned_need_id = null;
  }

  // 2. Re-deduct with the user's override plan. Let errors propagate — the
  //    picker will catch and surface.
  const result = await deductFromSpecificLots(entry.supply_id, newDraw);

  // 3. Mutate the entry in place with the new result.
  entry.lots_affected = result.lots_affected;
  entry.shortfall = result.shortfall;
  entry.shortfall_reason = result.shortfall_reason;
  entry.new_status = result.status_changed_to ?? entry.old_status;

  // 4. Re-fetch spawned need id if Q44 cascade fired (mirrors applyDepletion).
  if (result.status_changed_to !== null) {
    const { data: spawnedNeed, error: spawnLookupError } = await supabase
      .from('needs')
      .select('id')
      .eq('supply_id', entry.supply_id)
      .in('status', ['need', 'in_cart'])
      .limit(1)
      .maybeSingle();

    if (spawnLookupError) {
      console.error('❌ replaceSupplyDeduction spawn-need lookup failed:', {
        id: entry.supply_id,
        err: spawnLookupError,
      });
    } else {
      entry.spawned_need_id =
        (spawnedNeed as { id: string } | null)?.id ?? null;
    }
  }

  // 5. Re-persist `posts.lot_depletions` with the full plan's supplies (the
  //    in-place mutation is reflected; other entries are unchanged).
  const persisted: PersistedDepletionEntry[] = plan.supplies.map((s) => ({
    supply_id: s.supply_id,
    old_status: s.old_status,
    new_status: s.new_status,
    spawned_need_id: s.spawned_need_id,
    recipe_quantity: s.recipe_quantity,
    recipe_quantity_unit: s.recipe_quantity_unit,
    is_lot_supply: s.is_lot_supply,
    lots_affected: s.lots_affected,
    shortfall: s.shortfall,
    shortfall_reason: s.shortfall_reason,
  }));

  const { error: persistError } = await supabase
    .from('posts')
    .update({ lot_depletions: persisted })
    .eq('id', plan.post_id);

  if (persistError) {
    console.error(
      '❌ replaceSupplyDeduction failed to persist lot_depletions:',
      persistError
    );
  }

  return entry;
}

// ============================================
// ROLLBACK
// ============================================

/**
 * Reverse the plan for everything NOT in excludeIds. The Review flow passes
 * the set of supply IDs the user wants to KEEP — rollback leaves those alone
 * and reverses everything else.
 *
 * For each rolled-back entry:
 *   1. Re-add the deducted qty to each lot in lots_affected; un-archive lots
 *      that this apply pass had archived.
 *   2. If status changed during apply (new_status !== old_status), restore
 *      via setSupplyStatus. This may trigger spawn-on-out reversal via
 *      existing setSupplyStatus logic.
 *   3. If a need was spawned, delete it directly.
 *
 * After per-entry reversal, clear posts.lot_depletions (set to NULL) so the
 * persisted record disappears.
 */
export async function rollbackDepletion(
  plan: DepletionPlan,
  excludeIds: string[] = []
): Promise<void> {
  console.log('📦 Rolling back depletion:', {
    post_id: plan.post_id,
    excluded: excludeIds.length,
  });

  const exclude = new Set(excludeIds);

  for (const entry of plan.supplies) {
    if (exclude.has(entry.supply_id)) continue;

    // 1. Reverse lot deductions.
    for (const lotChange of entry.lots_affected) {
      try {
        const patch: Record<string, unknown> = {
          quantity: lotChange.quantity_before,
        };
        if (lotChange.archived) {
          patch.consumed_at = null;
        }
        const { error: lotError } = await supabase
          .from('supply_lots')
          .update(patch)
          .eq('id', lotChange.lot_id);
        if (lotError) {
          console.error('❌ rollbackDepletion lot revert failed:', {
            id: lotChange.lot_id,
            err: lotError,
          });
        }
      } catch (err) {
        console.error('❌ rollbackDepletion lot revert threw:', {
          id: lotChange.lot_id,
          err,
        });
      }
    }

    // 2. Status restore (skip if no transition during apply).
    if (entry.new_status !== entry.old_status) {
      try {
        await setSupplyStatus(entry.supply_id, entry.old_status);
      } catch (err) {
        console.error('❌ rollbackDepletion supply restore failed:', {
          id: entry.supply_id,
          err,
        });
      }
    }

    // 3. Delete spawned need.
    if (entry.spawned_need_id) {
      const { error } = await supabase
        .from('needs')
        .delete()
        .eq('id', entry.spawned_need_id);
      if (error) {
        console.error('❌ rollbackDepletion spawned-need delete failed:', {
          id: entry.spawned_need_id,
          err: error,
        });
      } else {
        entry.spawned_need_id = null;
      }
    }
  }

  // 4. Clear persisted record.
  const { error: clearError } = await supabase
    .from('posts')
    .update({ lot_depletions: null })
    .eq('id', plan.post_id);

  if (clearError) {
    console.error('❌ rollbackDepletion lot_depletions clear failed:', clearError);
  }
}

/**
 * Cross-session rollback: rehydrate the plan from posts.lot_depletions, then
 * call rollbackDepletion. Used when the user reverts a cook after the app has
 * restarted (in-memory plan from runPostCookDepletion is gone).
 *
 * display_name is re-derived from a supply lookup; space_id is left empty
 * because rollbackDepletion doesn't read it.
 */
export async function rollbackFromPersistedRecord(
  postId: string,
  excludeIds: string[] = []
): Promise<void> {
  console.log('📦 Rollback from persisted record:', { postId });

  const { data: postRow, error: postError } = await supabase
    .from('posts')
    .select('id, lot_depletions')
    .eq('id', postId)
    .maybeSingle();

  if (postError) {
    console.error('❌ Error fetching persisted depletion record:', postError);
    throw postError;
  }
  if (!postRow) return;

  const persisted = (postRow as { lot_depletions: PersistedDepletionEntry[] | null })
    .lot_depletions;
  if (!persisted || persisted.length === 0) return;

  // Re-derive display_name via supply lookup (best-effort; rollback does not
  // rely on this field but the type requires it).
  const supplyIds = persisted.map((p) => p.supply_id);
  const { data: supplyRows } = await supabase
    .from('supplies')
    .select(
      `id, custom_name, ingredient:ingredients(name)`
    )
    .in('id', supplyIds);

  const nameById = new Map<string, string>();
  for (const s of (supplyRows ?? []) as Array<{
    id: string;
    custom_name: string | null;
    ingredient: { name: string } | null;
  }>) {
    nameById.set(s.id, s.ingredient?.name ?? s.custom_name ?? '');
  }

  const plan: DepletionPlan = {
    post_id: postId,
    space_id: '',
    supplies: persisted.map((entry) => ({
      supply_id: entry.supply_id,
      display_name: nameById.get(entry.supply_id) ?? '',
      old_status: entry.old_status,
      new_status: entry.new_status,
      spawned_need_id: entry.spawned_need_id,
      recipe_quantity: entry.recipe_quantity,
      recipe_quantity_unit: entry.recipe_quantity_unit,
      is_lot_supply: entry.is_lot_supply,
      lots_affected: entry.lots_affected,
      shortfall: entry.shortfall,
      shortfall_reason: entry.shortfall_reason,
    })),
  };

  await rollbackDepletion(plan, excludeIds);
}

// ============================================
// CONVENIENCE: post-cook entry point
// ============================================

/**
 * Called by cook-post creators after createDishPost resolves. Computes +
 * applies + returns the plan for banner rendering, or returns null when
 * there's nothing to show (silent path).
 *
 * Errors during compute/apply are logged but not thrown — post-save success
 * is not blocked by depletion.
 *
 * The new behavior (D8R-Q53 + Q44) bubbles up through applyDepletion; this
 * orchestrator stays thin.
 */
export async function runPostCookDepletion(
  postId: string,
  spaceId: string | null
): Promise<DepletionPlan | null> {
  if (!spaceId) return null;
  try {
    const plan = await computeDepletion(postId, spaceId);
    if (!plan) return null;
    await applyDepletion(plan);
    return plan;
  } catch (error) {
    console.error('❌ runPostCookDepletion error (non-fatal):', error);
    return null;
  }
}

