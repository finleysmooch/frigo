// ============================================
// FRIGO — useReadyToCookRecipes HOOK (Phase 8D-CP4)
// ============================================
// Loads the user's recipes, bulk-matches them against the active space's
// supplies, and returns the subset that passes the ready-to-cook gate
// (readyToCookService.filterReadyToCook). Backs WhatCanICookScreen.
//
// NOTE (CP4): the gate needs each recipe's catalog `{id, name}` ingredient
// pairs for hero-name resolution — `recipes.hero_ingredients` carries no
// catalog ids. We fetch those via `getRecipeIngredientNames` (one extra query)
// and attach them before filtering. See readyToCookService + DEFERRED_WORK T31.
//
// This is the project's first standalone hook (no prior `lib/hooks/`); kept as
// a plain hook rather than a context provider since it has a single consumer.
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { calculateRecipeSupplyMatchBulk } from '../services/pantryMatchingService';
import type { PantryMatchResult } from '../services/pantryMatchingService';
import { filterReadyToCook, getRecipeIngredientNames } from '../services/readyToCookService';
import type { Recipe } from '../../components/recipe/RecipeCard';

interface UseReadyToCookResult {
  readyToCookRecipes: Recipe[]; // strict gate (>=90% + all heroes)
  allRecipesWithMatch: Recipe[]; // 8R-UX1: every loaded recipe with `pantry_match` populated, for the threshold-aware view
  matchMap: Map<string, PantryMatchResult>; // full match data for all recipes
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useReadyToCookRecipes(spaceId: string | null): UseReadyToCookResult {
  const [readyToCookRecipes, setReadyToCookRecipes] = useState<Recipe[]>([]);
  const [allRecipesWithMatch, setAllRecipesWithMatch] = useState<Recipe[]>([]);
  const [matchMap, setMatchMap] = useState<Map<string, PantryMatchResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!spaceId) {
      setReadyToCookRecipes([]);
      setAllRecipesWithMatch([]);
      setMatchMap(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setReadyToCookRecipes([]);
        setAllRecipesWithMatch([]);
        setMatchMap(new Map());
        setLoading(false);
        return;
      }

      // 1. Load the user's recipes (same query shape as RecipeListScreen).
      const { data, error: recipeError } = await supabase
        .from('recipes')
        .select('*, chefs:chef_id (name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (recipeError) throw recipeError;

      const recipes: Recipe[] = (data ?? []).map((r: any) => ({
        ...r,
        chef_name: r.chefs?.name || 'Unknown Chef',
      }));
      const recipeIds = recipes.map((r) => r.id);

      // 2. Bulk-match + 3. load catalog ingredient names for hero resolution.
      const [matches, ingredientNames] = await Promise.all([
        calculateRecipeSupplyMatchBulk(recipeIds, spaceId),
        getRecipeIngredientNames(recipeIds),
      ]);
      setMatchMap(matches);

      // 4. Attach ingredients[], apply the ready-to-cook gate.
      const recipesWithIngredients = recipes.map((r) => ({
        ...r,
        ingredients: ingredientNames.get(r.id) ?? [],
      }));
      const ready = filterReadyToCook(recipesWithIngredients, matches);
      setReadyToCookRecipes(ready);

      // 8R-UX1: full set with pantry_match populated, for the threshold-
      // aware view in WhatCanICookScreen. Sort highest → lowest. Recipes
      // not in matchMap (shouldn't happen, defensive) sort to the bottom
      // at 0.
      const withMatch: Recipe[] = recipesWithIngredients
        .map((r) => ({
          ...r,
          pantry_match: matches.get(r.id)?.matchPercentage ?? 0,
        }))
        .sort((a, b) => (b.pantry_match ?? 0) - (a.pantry_match ?? 0));
      setAllRecipesWithMatch(withMatch);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      console.error('[useReadyToCookRecipes] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    readyToCookRecipes,
    allRecipesWithMatch,
    matchMap,
    loading,
    error,
    refresh: load,
  };
}
