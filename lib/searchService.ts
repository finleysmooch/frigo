// ============================================
// FRIGO - SEARCH SERVICE
// ============================================
// Reusable search functions for recipes
// Last updated: October 27, 2025

import { supabase } from './supabase';
import { SearchOptions, SearchResult, SearchError } from './types/search';

/**
 * Search recipes by ingredient name
 * 
 * Example: searchRecipesByIngredient('basil')
 * Returns: ['recipe-id-1', 'recipe-id-2', ...]
 */
export async function searchRecipesByIngredient(
  searchTerm: string
): Promise<string[]> {
  try {
    if (!searchTerm.trim()) {
      return [];
    }

    const search = searchTerm.toLowerCase().trim();
    console.log('🔍 Searching ingredients for:', search);

    // PATH A — catalog match (ingredients.name / plural_name).
    // Joins via ingredient_id. Catches recipes whose ingredient row's
    // canonical name contains the query (e.g. "miso" matches "miso",
    // "white miso", "miso paste").
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('ingredients')
      .select('id')
      .or(`name.ilike.%${search}%,plural_name.ilike.%${search}%`);

    if (ingredientsError) {
      throw new SearchError(
        'Failed to search ingredients',
        searchTerm,
        ingredientsError
      );
    }

    let recipeIdsFromCatalog: string[] = [];
    if (ingredients && ingredients.length > 0) {
      const ingredientIds = ingredients.map(i => i.id);
      const { data: recipeIngredients, error: recipeError } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id')
        .in('ingredient_id', ingredientIds);

      if (recipeError) {
        throw new SearchError(
          'Failed to find recipes with ingredients',
          searchTerm,
          recipeError
        );
      }
      recipeIdsFromCatalog = (recipeIngredients ?? []).map(ri => ri.recipe_id);
    }

    // PATH B — recipe-level display-text match (recipe_ingredients.original_text).
    // Per ingredientsParser.ts comment line 581: original_text is the
    // user-facing string. Catalog names can be normalized away from what the
    // user actually sees (e.g. recipe shows "white miso paste" but catalog
    // ingredient.name is just "miso"), so the catalog-only path misses
    // legitimate matches. This path catches them.
    const { data: textMatches, error: textError } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id')
      .ilike('original_text', `%${search}%`);

    if (textError) {
      throw new SearchError(
        'Failed to search recipe ingredient text',
        searchTerm,
        textError
      );
    }
    const recipeIdsFromText = (textMatches ?? []).map(ri => ri.recipe_id);

    // Union and dedupe.
    const recipeIds = [
      ...new Set([...recipeIdsFromCatalog, ...recipeIdsFromText]),
    ];
    console.log(
      '✅ Found',
      recipeIds.length,
      `recipes for "${search}" (catalog: ${recipeIdsFromCatalog.length}, original_text: ${recipeIdsFromText.length})`
    );

    return recipeIds;

  } catch (error) {
    if (error instanceof SearchError) {
      throw error;
    }
    console.error('❌ Error in searchRecipesByIngredient:', error);
    throw new SearchError(
      'Unexpected error during ingredient search',
      searchTerm,
      error
    );
  }
}

/**
 * Search recipes by title
 * 
 * Example: searchRecipesByTitle('pasta')
 * Returns: ['recipe-id-1', 'recipe-id-2', ...]
 */
export async function searchRecipesByTitle(
  searchTerm: string
): Promise<string[]> {
  try {
    if (!searchTerm.trim()) {
      return [];
    }

    const search = searchTerm.toLowerCase().trim();
    console.log('🔍 Searching recipe titles for:', search);

    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id')
      .ilike('title', `%${search}%`);

    if (error) {
      throw new SearchError(
        'Failed to search recipe titles',
        searchTerm,
        error
      );
    }

    const recipeIds = recipes?.map(r => r.id) || [];
    console.log('✅ Found', recipeIds.length, 'recipes with title matching:', search);

    return recipeIds;

  } catch (error) {
    if (error instanceof SearchError) {
      throw error;
    }
    console.error('❌ Error in searchRecipesByTitle:', error);
    throw new SearchError(
      'Unexpected error during title search',
      searchTerm,
      error
    );
  }
}

/**
 * Search recipes by chef name
 * 
 * Example: searchRecipesByChef('molly')
 * Returns: ['recipe-id-1', 'recipe-id-2', ...]
 */
export async function searchRecipesByChef(
  searchTerm: string
): Promise<string[]> {
  try {
    if (!searchTerm.trim()) {
      return [];
    }

    const search = searchTerm.toLowerCase().trim();
    console.log('🔍 Searching chef names for:', search);

    // STEP 1: Find chefs matching search
    const { data: chefs, error: chefsError } = await supabase
      .from('chefs')
      .select('id')
      .ilike('name', `%${search}%`);

    if (chefsError) {
      throw new SearchError(
        'Failed to search chefs',
        searchTerm,
        chefsError
      );
    }

    if (!chefs || chefs.length === 0) {
      console.log('❌ No chefs found matching:', search);
      return [];
    }

    console.log('✅ Found', chefs.length, 'matching chefs');

    // STEP 2: Find recipes by those chefs
    const chefIds = chefs.map(c => c.id);
    
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select('id')
      .in('chef_id', chefIds);

    if (recipesError) {
      throw new SearchError(
        'Failed to find recipes by chef',
        searchTerm,
        recipesError
      );
    }

    const recipeIds = recipes?.map(r => r.id) || [];
    console.log('✅ Found', recipeIds.length, 'recipes by chef:', search);

    return recipeIds;

  } catch (error) {
    if (error instanceof SearchError) {
      throw error;
    }
    console.error('❌ Error in searchRecipesByChef:', error);
    throw new SearchError(
      'Unexpected error during chef search',
      searchTerm,
      error
    );
  }
}

/**
 * Search recipes by cuisine type
 * 
 * Example: searchRecipesByCuisine('italian')
 * Returns: ['recipe-id-1', 'recipe-id-2', ...]
 */
export async function searchRecipesByCuisine(
  searchTerm: string
): Promise<string[]> {
  try {
    if (!searchTerm.trim()) {
      return [];
    }

    const search = searchTerm.toLowerCase().trim();
    console.log('🔍 Searching cuisine types for:', search);

    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, cuisine_types')
      .not('cuisine_types', 'is', null);

    if (error) {
      throw new SearchError(
        'Failed to search cuisines',
        searchTerm,
        error
      );
    }

    // Filter recipes that have matching cuisine type
    const matchingRecipes = recipes?.filter(r => 
      r.cuisine_types?.some((c: string) => 
        c.toLowerCase().includes(search)
      )
    ) || [];

    const recipeIds = matchingRecipes.map(r => r.id);
    console.log('✅ Found', recipeIds.length, 'recipes with cuisine:', search);

    return recipeIds;

  } catch (error) {
    if (error instanceof SearchError) {
      throw error;
    }
    console.error('❌ Error in searchRecipesByCuisine:', error);
    throw new SearchError(
      'Unexpected error during cuisine search',
      searchTerm,
      error
    );
  }
}

/**
 * Combined search across multiple fields
 * 
 * Example: searchRecipes('basil', { searchIngredients: true, searchTitles: true })
 * Returns: { recipeIds: [...], matchCount: 5, searchTerm: 'basil', searchType: 'combined' }
 */
export async function searchRecipes(
  searchTerm: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  try {
    if (!searchTerm.trim()) {
      return {
        recipeIds: [],
        matchCount: 0,
        searchTerm,
        searchType: 'none'
      };
    }

    // Default: search everything
    const {
      searchIngredients = true,
      searchTitles = true,
      searchChefs = true,
      searchCuisines = true,
    } = options;

    console.log('🔍 Combined search for:', searchTerm);
    console.log('   Searching:', {
      ingredients: searchIngredients,
      titles: searchTitles,
      chefs: searchChefs,
      cuisines: searchCuisines
    });

    // Collect all recipe IDs from different searches
    const allRecipeIds: string[] = [];
    const searchTypes: string[] = [];

    if (searchIngredients) {
      const ingredientResults = await searchRecipesByIngredient(searchTerm);
      allRecipeIds.push(...ingredientResults);
      if (ingredientResults.length > 0) searchTypes.push('ingredients');
    }

    if (searchTitles) {
      const titleResults = await searchRecipesByTitle(searchTerm);
      allRecipeIds.push(...titleResults);
      if (titleResults.length > 0) searchTypes.push('titles');
    }

    if (searchChefs) {
      const chefResults = await searchRecipesByChef(searchTerm);
      allRecipeIds.push(...chefResults);
      if (chefResults.length > 0) searchTypes.push('chefs');
    }

    if (searchCuisines) {
      const cuisineResults = await searchRecipesByCuisine(searchTerm);
      allRecipeIds.push(...cuisineResults);
      if (cuisineResults.length > 0) searchTypes.push('cuisines');
    }

    // Remove duplicates
    const uniqueRecipeIds = [...new Set(allRecipeIds)];

    console.log('✅ Combined search found', uniqueRecipeIds.length, 'unique recipes');
    console.log('   Matched in:', searchTypes.join(', ') || 'none');

    return {
      recipeIds: uniqueRecipeIds,
      matchCount: uniqueRecipeIds.length,
      searchTerm,
      searchType: searchTypes.length > 0 ? searchTypes.join(', ') : 'none'
    };

  } catch (error) {
    if (error instanceof SearchError) {
      throw error;
    }
    console.error('❌ Error in searchRecipes:', error);
    throw new SearchError(
      'Unexpected error during combined search',
      searchTerm,
      error
    );
  }
}

/**
 * Search for multiple ingredients (AND logic)
 * Returns recipes that contain ALL specified ingredients
 * 
 * Example: searchRecipesByMultipleIngredients(['basil', 'tomato'])
 * Returns: ['recipe-id-1', 'recipe-id-2', ...]
 */
export async function searchRecipesByMultipleIngredients(
  ingredients: string[]
): Promise<string[]> {
  try {
    if (ingredients.length === 0) {
      return [];
    }

    console.log('🔍 Searching for recipes with ALL of:', ingredients);

    // Search for each ingredient
    const searchPromises = ingredients.map(ing => searchRecipesByIngredient(ing));
    const results = await Promise.all(searchPromises);

    // Find recipes that appear in ALL result sets (intersection)
    if (results.length === 0) {
      return [];
    }

    let intersection = results[0];
    for (let i = 1; i < results.length; i++) {
      intersection = intersection.filter(id => results[i].includes(id));
    }

    console.log('✅ Found', intersection.length, 'recipes with all ingredients');

    return intersection;

  } catch (error) {
    console.error('❌ Error in searchRecipesByMultipleIngredients:', error);
    throw new SearchError(
      'Unexpected error during multi-ingredient search',
      ingredients.join(', '),
      error
    );
  }
}

/**
 * Smart mixed search across multiple terms (AND logic)
 * Each term searches across ingredients, titles, chefs, and cuisines
 * Returns recipes that match ALL terms
 * 
 * Examples:
 * - searchRecipesByMixedTerms(['lemon', 'molly']) → recipes with ingredient lemon by chef molly
 * - searchRecipesByMixedTerms(['basil', 'italian']) → recipes with basil that are Italian cuisine
 * - searchRecipesByMixedTerms(['pasta', 'garlic']) → recipes with both ingredients
 * 
 * @param terms Array of search terms
 * @returns Array of recipe IDs that match ALL terms
 */
export async function searchRecipesByMixedTerms(
  terms: string[]
): Promise<string[]> {
  try {
    if (terms.length === 0) {
      return [];
    }

    console.log('🔍 Smart mixed search for ALL of:', terms);

    // Search each term across all fields (ingredients, titles, chefs, cuisines)
    const searchPromises = terms.map(term => 
      searchRecipes(term, {
        searchIngredients: true,
        searchTitles: true,
        searchChefs: true,
        searchCuisines: true
      })
    );

    const results = await Promise.all(searchPromises);

    // Find recipes that appear in ALL result sets (intersection)
    if (results.length === 0) {
      return [];
    }

    let intersection = results[0].recipeIds;
    for (let i = 1; i < results.length; i++) {
      intersection = intersection.filter(id => results[i].recipeIds.includes(id));
    }

    console.log('✅ Found', intersection.length, 'recipes matching all terms');
    console.log('   Each term matched in:', results.map((r, i) => `"${terms[i]}" → ${r.searchType}`).join(', '));

    return intersection;

  } catch (error) {
    console.error('❌ Error in searchRecipesByMixedTerms:', error);
    throw new SearchError(
      'Unexpected error during mixed search',
      terms.join(', '),
      error
    );
  }
}