// CP3 (D-ON-2 / D-ON-13) — staples checklist submit path.
//
// Resolves config items (exact ingredients.name match) and creates one supply
// per checked item via createSupply (dedup + storage/tracking inference live
// there — this service adds NO supply logic of its own). Content lives in
// lib/config/staplesChecklist.ts; this service is content-free.
//
// Space-ensure is the CALLER's job (anchor §6): the StaplesChecklist component
// resolves a real space id (SpaceContext, else ensureDefaultSpace) BEFORE
// calling addStaples. addStaples never creates spaces.

import { supabase } from '../supabase';
import { createSupply } from './suppliesService';
import { StapleItem } from '../config/staplesChecklist';

export interface StapleAddResult {
  label: string;
  supplyId: string;
  /** Resolved catalog ingredient, or null when the customName fallback fired. */
  ingredientId: string | null;
  usedCustomName: boolean;
}

interface ResolvedIngredient {
  id: string;
  name: string;
}

/**
 * Exact-name lookup of staple catalogNames against the ingredients catalog.
 * Items that don't resolve are NOT dropped — addStaples falls back to a
 * customName supply for them.
 */
export async function resolveStapleIngredients(
  catalogNames: string[]
): Promise<Map<string, ResolvedIngredient>> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name')
    .in('name', catalogNames);

  if (error) {
    console.error('❌ resolveStapleIngredients error:', error);
    throw error;
  }

  const map = new Map<string, ResolvedIngredient>();
  for (const row of (data ?? []) as ResolvedIngredient[]) {
    map.set(row.name, row);
  }
  return map;
}

/**
 * Create one in-stock supply per checked staple. Sequential on purpose:
 * createSupply's dedup makes re-runs safe, and the list is small (≤21).
 */
export async function addStaples(
  userId: string,
  spaceId: string,
  items: StapleItem[]
): Promise<StapleAddResult[]> {
  if (items.length === 0) return [];

  const resolved = await resolveStapleIngredients(items.map((i) => i.catalogName));
  const results: StapleAddResult[] = [];

  for (const item of items) {
    const ingredient = resolved.get(item.catalogName);
    const supply = await createSupply({
      spaceId,
      ingredientId: ingredient?.id,
      customName: ingredient ? undefined : item.label,
      status: 'in_stock',
      addedBy: userId,
      // Only config-set where the catalog default is NULL; otherwise
      // createSupply infers from ingredient.default_storage_location.
      storageLocation: item.storageLocation,
    });
    results.push({
      label: item.label,
      supplyId: supply.id,
      ingredientId: ingredient?.id ?? null,
      usedCustomName: !ingredient,
    });
  }

  return results;
}
