// ============================================
// FRIGO — READY-TO-COOK SERVICE (Phase 8D-CP4)
// ============================================
// Single source of truth for the "ready to cook" predicate (D8D-Q3):
//   matchPercentage >= 0.90  AND  every resolvable hero ingredient is matched.
//
// Both RecipeListScreen (canMakeCount badge) and WhatCanICookScreen (the gated
// subset) call this — keep the gate here, never inline it.
//
// hero_ingredients data-shape note (T31): `recipes.hero_ingredients` is a
// `text[]` of plain name strings — NOT a structured array carrying catalog
// ingredient_ids. To decide whether a hero is missing, we name-resolve it at
// filter time against the recipe's own catalog ingredients (the `{id, name}`
// pairs sourced from `recipe_ingredients`). `getRecipeIngredientNames` loads
// those pairs; `resolveHeroToIngredientId` does the case-insensitive match.
// console.warn on a miss is PERMANENT instrumentation (not an 8D-cleanup
// removal) — it measures hero-tagging data quality for the T31 schema decision.
// ============================================

import { supabase } from '../supabase';
import type { PantryMatchResult } from './pantryMatchingService';

export const READY_TO_COOK_THRESHOLD = 0.9; // D8D-Q3 locked decision

/**
 * Minimal recipe shape the ready-to-cook gate needs. Callers pass their own
 * fuller Recipe type — the gate functions are generic over anything that
 * structurally satisfies this.
 */
export interface ReadyToCookRecipe {
  id: string;
  title: string;
  hero_ingredients?: string[] | null;
  /** The recipe's catalog ingredients — `{id, name}` from `recipe_ingredients`. */
  ingredients: Array<{ id: string; name: string }>;
}

/**
 * Resolve a hero ingredient name to its catalog ingredient_id by matching
 * against the recipe's own ingredients[] (case-insensitive). Returns null on
 * a miss and emits a console.warn for data-quality tracking (T31).
 */
export function resolveHeroToIngredientId(
  heroName: string,
  recipeIngredients: Array<{ id: string; name: string }>
): string | null {
  const match = recipeIngredients.find(
    (ing) => ing.name.toLowerCase() === heroName.toLowerCase()
  );
  if (!match) {
    console.warn('[readyToCookService] hero name unresolved', {
      heroName,
      recipeIngredientCount: recipeIngredients.length,
    });
    return null;
  }
  return match.id;
}

/**
 * True if the recipe is ready to cook given its match result.
 * Criterion (D8D-Q3): matchPercentage >= 0.90 AND every resolvable hero
 * ingredient is matched (not in missing[]).
 *
 * Unresolvable heroes (name matches no recipe ingredient) are SKIPPED — a soft
 * pass. Conservative choice for F&F given uneven hero-tagging coverage (T31).
 */
export function isReadyToCook(
  recipe: ReadyToCookRecipe,
  matchResult: PantryMatchResult | undefined
): boolean {
  if (!matchResult) return false;
  if (matchResult.matchPercentage < READY_TO_COOK_THRESHOLD) return false;

  const heroNames = recipe.hero_ingredients ?? [];
  if (heroNames.length === 0) return false; // no heroes → can't qualify per D8D-Q3

  const missingSet = new Set(matchResult.missing);

  for (const heroName of heroNames) {
    const heroIngredientId = resolveHeroToIngredientId(heroName, recipe.ingredients);
    if (heroIngredientId === null) continue; // unresolved → soft pass (T31)
    if (missingSet.has(heroIngredientId)) return false; // hero missing → not ready
  }

  return true;
}

/**
 * Filter recipes to those passing the ready-to-cook gate, sorted by
 * matchPercentage DESC then title ASC.
 */
export function filterReadyToCook<T extends ReadyToCookRecipe>(
  recipes: T[],
  matchMap: Map<string, PantryMatchResult>
): T[] {
  return recipes
    .filter((r) => isReadyToCook(r, matchMap.get(r.id)))
    .sort((a, b) => {
      const pctA = matchMap.get(a.id)?.matchPercentage ?? 0;
      const pctB = matchMap.get(b.id)?.matchPercentage ?? 0;
      if (pctA !== pctB) return pctB - pctA;
      return a.title.localeCompare(b.title);
    });
}

/**
 * Load the catalog `{id, name}` ingredient pairs for a set of recipes, keyed
 * by recipe_id. CP4 NOTE: needed because `recipes.hero_ingredients` carries no
 * catalog ids and `recipes.ingredients` (JSONB) is free-text — the catalog
 * ingredient_ids live only in the `recipe_ingredients` join. Free-text rows
 * (null ingredient_id) are skipped. Every requested recipe id gets a Map entry
 * (empty array if it has no catalogued ingredients). See T31.
 */
export async function getRecipeIngredientNames(
  recipeIds: string[]
): Promise<Map<string, Array<{ id: string; name: string }>>> {
  const result = new Map<string, Array<{ id: string; name: string }>>();
  for (const id of recipeIds) result.set(id, []);
  if (recipeIds.length === 0) return result;

  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, ingredient_id, ingredient:ingredients(id, name)')
    .in('recipe_id', recipeIds);

  if (error) {
    console.error('[readyToCookService] getRecipeIngredientNames failed', error);
    throw error;
  }

  for (const row of (data ?? []) as Array<{
    recipe_id: string;
    ingredient_id: string | null;
    ingredient: { id: string; name: string } | null;
  }>) {
    if (!row.ingredient_id || !row.ingredient) continue; // free-text row
    const arr = result.get(row.recipe_id);
    if (arr) arr.push({ id: row.ingredient.id, name: row.ingredient.name });
  }

  return result;
}
