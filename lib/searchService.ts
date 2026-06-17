// ============================================
// FRIGO - SEARCH SERVICE
// ============================================
// Reusable search functions for recipes
// Last updated: October 27, 2025

import { supabase } from './supabase';
import { fetchAllRows } from './utils/fetchAllRows';
import { SearchOptions, SearchResult, SearchError } from './types/search';
import type { Suggestion, SearchTerm } from './searchTerms';

// ============================================
// SEARCH SYNONYMS (11D — ingredient family search)
// ============================================
// Curated, DIRECTED query-term expansion: searching a key term ALSO matches its
// listed terms. This is the search-layer "many doors" — multi-membership for
// SEARCH only; it never touches the single-valued classification taxonomy.
// `seafood → [fish, shellfish]` is the EMPTIED-PARENT UMBRELLA: the 11D backfill
// emptied the `Seafood` type (all rows split to Fish/Shellfish), so this
// restores "seafood" search (regression fix) without re-typing data. Directed
// (not bidirectional) on purpose so "shellfish" still returns Shellfish only.
// Curated, not exhaustive. See docs/CC_PROMPT_family_search_code_2026-06-01.md.
const SEARCH_SYNONYMS: Record<string, string[]> = {
  seafood: ['fish', 'shellfish'],          // emptied-parent umbrella — RESTORES "seafood" search
  noodle: ['pasta'], noodles: ['pasta'],   // one-way: "noodles" finds pasta, but "pasta" stays pasta-only
  scallion: ['green onion'], 'green onion': ['scallion'],
  cilantro: ['coriander'], coriander: ['cilantro'],
  shrimp: ['prawn'], prawn: ['shrimp'],
  garbanzo: ['chickpea'], chickpea: ['garbanzo'],
  aubergine: ['eggplant'], eggplant: ['aubergine'],
  courgette: ['zucchini'], zucchini: ['courgette'],
};

// Expand a search term into itself + any synonyms. Wired in at the ingredient-
// search chokepoint (recon 2026-06-01) so all ingredient paths see synonyms
// without leaking into title/chef/metadata searches.
function expandTerm(t: string): string[] {
  const k = t.toLowerCase().trim();
  return [k, ...(SEARCH_SYNONYMS[k] ?? [])];
}

/**
 * Search recipes by ingredient — matches the FULL ingredient catalog (name /
 * plural), the ingredient FAMILY taxonomy (ingredient_type), and the recipe's
 * display text, with curated synonym expansion.
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
    // Synonym expansion (chokepoint per recon 2026-06-01): expand once here so
    // every ingredient path below sees synonyms, without leaking into the
    // title/chef/metadata searches in searchRecipes().
    const terms = expandTerm(search);
    console.log(
      '🔍 Searching ingredients for:',
      search,
      terms.length > 1 ? `(+synonyms: ${terms.slice(1).join(', ')})` : ''
    );

    // PATH A+C — catalog match on ingredients.name / plural_name PLUS the
    // FAMILY taxonomy (ingredients.ingredient_type), across all expanded terms.
    // Folding ingredient_type into the same .or() (per handoff §4) means a
    // family term like "cheese" resolves to every member of type='Cheese'
    // (parmesan/cheddar/gouda…) even though their names don't contain "cheese".
    // Type-only — `family` is intentionally NOT matched (v1 decision).
    // Note: "shellfish" contains "fish", so searching `fish` returns
    // Fish+Shellfish and `shellfish` returns Shellfish only — acceptable.
    const catalogOr = terms
      .flatMap((t) => [
        `name.ilike.%${t}%`,
        `plural_name.ilike.%${t}%`,
        `ingredient_type.ilike.%${t}%`,
      ])
      .join(',');
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('ingredients')
      .select('id')
      .or(catalogOr);

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

    // PATH B — recipe-level display-text match (recipe_ingredients.original_text),
    // across all expanded terms. Per ingredientsParser.ts: original_text is the
    // user-facing string. Catalog names can be normalized away from what the
    // user actually sees (e.g. recipe shows "white miso paste" but catalog
    // ingredient.name is just "miso"), so the catalog-only path misses
    // legitimate matches. This path catches them.
    const textOr = terms.map((t) => `original_text.ilike.%${t}%`).join(',');
    const { data: textMatches, error: textError } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id')
      .or(textOr);

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
      `recipes for "${search}" (catalog+family: ${recipeIdsFromCatalog.length}, original_text: ${recipeIdsFromText.length})`
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

    // Paginated: loads the full recipe set (capped at 1000 otherwise → search
    // would miss recipes beyond the first 1000 for users with many recipes).
    const recipes = await fetchAllRows<{ id: string; cuisine_types: string[] | null }>((from, to) =>
      supabase
        .from('recipes')
        .select('id, cuisine_types')
        .not('cuisine_types', 'is', null)
        .range(from, to)
    );

    // Filter recipes that have matching cuisine type
    const matchingRecipes = recipes.filter(r =>
      r.cuisine_types?.some((c: string) =>
        c.toLowerCase().includes(search)
      )
    );

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
 * Search recipes by metadata fields — cuisine types, cooking methods, vibe
 * tags, course type, and difficulty — in a single pass.
 *
 * Supersedes searchRecipesByCuisine for the combined search: one fetch of the
 * array/scalar metadata columns, filtered in JS so a term like "braise",
 * "comfort", "dessert", or "thai" matches the right dimension.
 *
 * Example: searchRecipesByMetadata('roast') → recipes whose cooking_methods
 * include a roast variant.
 */
export async function searchRecipesByMetadata(
  searchTerm: string
): Promise<string[]> {
  try {
    if (!searchTerm.trim()) {
      return [];
    }

    const search = searchTerm.toLowerCase().trim();
    console.log('🔍 Searching recipe metadata (cuisine/methods/vibes/course/difficulty) for:', search);

    // Paginated: full recipe set (otherwise capped at 1000 → metadata search
    // misses recipes beyond the first 1000).
    const recipes = await fetchAllRows<any>((from, to) =>
      supabase
        .from('recipes')
        .select('id, cuisine_types, cooking_methods, vibe_tags, course_type, difficulty_level')
        .range(from, to)
    );

    const arrHit = (arr: unknown): boolean =>
      Array.isArray(arr) &&
      arr.some((v) => typeof v === 'string' && v.toLowerCase().includes(search));
    const strHit = (s: unknown): boolean =>
      typeof s === 'string' && s.toLowerCase().includes(search);

    const recipeIds = (recipes ?? [])
      .filter((r: any) =>
        arrHit(r.cuisine_types) ||
        arrHit(r.cooking_methods) ||
        arrHit(r.vibe_tags) ||
        strHit(r.course_type) ||
        strHit(r.difficulty_level)
      )
      .map((r: any) => r.id);

    console.log('✅ Found', recipeIds.length, 'recipes with metadata matching:', search);
    return recipeIds;

  } catch (error) {
    if (error instanceof SearchError) {
      throw error;
    }
    console.error('❌ Error in searchRecipesByMetadata:', error);
    throw new SearchError(
      'Unexpected error during metadata search',
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

    // Default: search everything. `searchMetadata` supersedes the legacy
    // `searchCuisines` flag (covers cuisine + cooking methods + vibe tags +
    // course type + difficulty); we honor an explicit `searchCuisines: false`
    // as a way to also opt out of metadata for backward compatibility.
    const {
      searchIngredients = true,
      searchTitles = true,
      searchChefs = true,
      searchCuisines = true,
      searchMetadata = searchCuisines,
    } = options;

    console.log('🔍 Combined search for:', searchTerm);
    console.log('   Searching:', {
      ingredients: searchIngredients,
      titles: searchTitles,
      chefs: searchChefs,
      metadata: searchMetadata
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

    if (searchMetadata) {
      const metadataResults = await searchRecipesByMetadata(searchTerm);
      allRecipeIds.push(...metadataResults);
      if (metadataResults.length > 0) searchTypes.push('metadata');
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
        searchMetadata: true
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

// ============================================
// SEARCH ENTITY DICTIONARY (11D — entity-aware query tokenization)
// ============================================
// Known MULTI-WORD entities, sourced from the real catalog: ingredient names /
// plural names that contain a space ("olive oil", "soy sauce") and chef names
// ("Molly Baz", "Yotam Ottolenghi"). Used by the stacked-search input so a
// multi-word entity stays ONE search pill instead of splitting into AND'd
// words — data-driven, so it stays correct as the catalog grows (no blacklist).
// Cached module-side; loads once per app session.
let _searchEntityCache: Set<string> | null = null;

export async function getSearchEntities(): Promise<Set<string>> {
  if (_searchEntityCache) return _searchEntityCache;
  const set = new Set<string>();
  try {
    const [{ data: ings }, { data: chefs }] = await Promise.all([
      supabase.from('ingredients').select('name, plural_name'),
      supabase.from('chefs').select('name, first_name, last_name'),
    ]);
    for (const r of ings ?? []) {
      for (const v of [r.name, r.plural_name]) {
        if (v && v.trim().includes(' ')) set.add(v.toLowerCase().trim());
      }
    }
    for (const c of chefs ?? []) {
      if (c.name && c.name.trim().includes(' ')) set.add(c.name.toLowerCase().trim());
      if (c.first_name && c.last_name) {
        set.add(`${c.first_name} ${c.last_name}`.toLowerCase().trim());
      }
    }
  } catch (error) {
    console.error('❌ Error loading search entities:', error);
  }
  _searchEntityCache = set;
  return set;
}

// ============================================
// SEARCH SUGGESTIONS (11D — typeahead / scoped pills)
// ============================================
// Suggestion index for the search typeahead: ingredients, ingredient-type
// CATEGORIES (the taxonomy), chefs, and cuisines — each labelled by kind so the
// user can pick a precise, scoped term. Cached once per app session.
let _suggestionCache: Suggestion[] | null = null;

export async function getSearchSuggestions(): Promise<Suggestion[]> {
  if (_suggestionCache) return _suggestionCache;
  const out: Suggestion[] = [];
  try {
    const [{ data: ings }, { data: chefs }, { data: recs }] = await Promise.all([
      supabase.from('ingredients').select('name, ingredient_type'),
      supabase.from('chefs').select('name'),
      supabase.from('recipes').select('cuisine_types, cooking_methods, vibe_tags, course_type'),
    ]);

    // Ingredients + categories (ingredient_type) — SEARCH kinds.
    const seenIng = new Set<string>();
    const categories = new Set<string>();
    for (const r of ings ?? []) {
      if (r.name) {
        const k = r.name.toLowerCase();
        if (!seenIng.has(k)) { seenIng.add(k); out.push({ kind: 'ingredient', value: r.name, label: r.name }); }
      }
      if (r.ingredient_type) categories.add(r.ingredient_type);
    }
    for (const c of categories) out.push({ kind: 'category', value: c, label: c });

    // Chefs — SEARCH kind.
    const seenChef = new Set<string>();
    for (const c of chefs ?? []) {
      if (c.name && !seenChef.has(c.name.toLowerCase())) {
        seenChef.add(c.name.toLowerCase());
        out.push({ kind: 'chef', value: c.name, label: c.name });
      }
    }

    // Cuisines (SEARCH) + cooking methods / vibe tags / course types (REFINE),
    // aggregated distinct from the recipe set.
    const seenCui = new Set<string>();
    const seenMethod = new Set<string>();
    const seenVibe = new Set<string>();
    const seenCourse = new Set<string>();
    const CUISINE_KW = ['cuisine', 'cuisines'];
    const METHOD_KW = ['method', 'methods', 'cooking', 'technique'];
    const VIBE_KW = ['vibe', 'vibes', 'mood', 'occasion', 'style'];
    const COURSE_KW = ['course', 'courses', 'meal', 'dish type'];
    for (const r of recs ?? []) {
      for (const c of (r.cuisine_types ?? []) as string[]) {
        if (c && !seenCui.has(c.toLowerCase())) { seenCui.add(c.toLowerCase()); out.push({ kind: 'cuisine', value: c, label: c, keywords: CUISINE_KW }); }
      }
      for (const m of (r.cooking_methods ?? []) as string[]) {
        if (m && !seenMethod.has(m.toLowerCase())) { seenMethod.add(m.toLowerCase()); out.push({ kind: 'method', value: m, label: m, keywords: METHOD_KW }); }
      }
      for (const v of (r.vibe_tags ?? []) as string[]) {
        if (v && !seenVibe.has(v.toLowerCase())) { seenVibe.add(v.toLowerCase()); out.push({ kind: 'vibe', value: v, label: v, keywords: VIBE_KW }); }
      }
      const ct = (r as any).course_type as string | null;
      if (ct && !seenCourse.has(ct.toLowerCase())) { seenCourse.add(ct.toLowerCase()); out.push({ kind: 'course', value: ct, label: ct, keywords: COURSE_KW }); }
    }

    // Dietary flags — REFINE kind. value = the recipe boolean column. The shared
    // keywords mean typing "diet"/"dietary"/"allergy" surfaces the whole group.
    const DIET_KW = ['diet', 'dietary', 'allergy', 'allergen', 'restriction', 'free'];
    const DIETARY: [string, string][] = [
      ['is_vegan', 'Vegan'], ['is_vegetarian', 'Vegetarian'], ['is_gluten_free', 'Gluten-free'],
      ['is_dairy_free', 'Dairy-free'], ['is_nut_free', 'Nut-free'], ['is_shellfish_free', 'Shellfish-free'],
      ['is_soy_free', 'Soy-free'], ['is_egg_free', 'Egg-free'],
    ];
    for (const [v, l] of DIETARY) out.push({ kind: 'dietary', value: v, label: l, keywords: DIET_KW });

    // Named attribute presets — REFINE kind. Mapped to FilterState in the screen.
    // Thresholds are shown in the label; finer control lives in the Refine sheet.
    // Macro presets encode `nut:<nutrient>:<dir>:<defaultValue>`; the screen
    // applies them and they're then adjustable (direction + value) via the pill.
    const ATTRS: { value: string; label: string; keywords: string[] }[] = [
      { value: 'nut:protein:min:25', label: 'High protein (25g+)', keywords: ['protein', 'macro', 'macros', 'high protein', 'healthy', 'filter'] },
      { value: 'nut:calories:max:600', label: 'Low calorie (≤600)', keywords: ['calorie', 'calories', 'low cal', 'light', 'filter'] },
      { value: 'nut:carbs:max:30', label: 'Low carb (≤30g)', keywords: ['carb', 'carbs', 'low carb', 'keto', 'filter'] },
      { value: 'nut:fat:max:20', label: 'Low fat (≤20g)', keywords: ['fat', 'low fat', 'filter'] },
      { value: 'quick', label: 'Quick (under 30 min)', keywords: ['quick', 'fast', 'easy', 'weeknight', 'time', 'filter'] },
      { value: 'one_pot', label: 'One pot', keywords: ['one pot', 'onepot', 'cleanup', 'filter'] },
      { value: 'make_ahead', label: 'Make-ahead', keywords: ['make ahead', 'prep', 'batch', 'meal prep', 'filter'] },
      { value: 'easier', label: 'Easier than it looks', keywords: ['easy', 'simple', 'beginner', 'filter'] },
    ];
    for (const a of ATTRS) out.push({ kind: 'attribute', value: a.value, label: a.label, keywords: a.keywords });
  } catch (error) {
    console.error('❌ Error loading search suggestions:', error);
  }
  _suggestionCache = out;
  return out;
}

// Recipes that use an ingredient of an EXACT ingredient_type (the "category"
// scope — e.g. "Rice" → only the grain, never rice vinegar).
export async function searchRecipesByType(type: string): Promise<string[]> {
  try {
    const { data: ings, error } = await supabase
      .from('ingredients')
      .select('id')
      .eq('ingredient_type', type);
    if (error) throw error;
    const ids = (ings ?? []).map((i) => i.id);
    if (ids.length === 0) return [];
    const { data: ri, error: riErr } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id')
      .in('ingredient_id', ids);
    if (riErr) throw riErr;
    return [...new Set((ri ?? []).map((r) => r.recipe_id))];
  } catch (error) {
    console.error('❌ Error in searchRecipesByType:', error);
    return [];
  }
}

// Resolve one scoped term to recipe ids. Free 'text' terms fan out across all
// fields (the default stacked-search behaviour); scoped terms target one
// dimension. The 'chef' scope is broadened to include recipes whose BOOK author
// matches — so "Molly Baz — chef" also catches her cookbook recipes that lack a
// direct chef_id (the attribution gap).
async function resolveScopedTerm(t: SearchTerm): Promise<string[]> {
  switch (t.kind) {
    case 'ingredient':
      return searchRecipesByIngredient(t.value);
    case 'category':
      return searchRecipesByType(t.value);
    case 'cuisine':
      return searchRecipesByCuisine(t.value);
    case 'chef': {
      const byChef = await searchRecipesByChef(t.value);
      const { data: books } = await supabase
        .from('books')
        .select('id')
        .ilike('author', `%${t.value}%`);
      let byBook: string[] = [];
      if (books && books.length > 0) {
        const { data: ri } = await supabase
          .from('recipes')
          .select('id')
          .in('book_id', books.map((b) => b.id));
        byBook = (ri ?? []).map((r) => r.id);
      }
      return [...new Set([...byChef, ...byBook])];
    }
    case 'text':
    default: {
      const res = await searchRecipes(t.value, {
        searchIngredients: true,
        searchTitles: true,
        searchChefs: true,
        searchMetadata: true,
      });
      return res.recipeIds;
    }
  }
}

// AND across all (mixed scoped + free-text) terms → intersected recipe ids.
export async function searchRecipesByScopedTerms(terms: SearchTerm[]): Promise<string[]> {
  if (terms.length === 0) return [];
  const results = await Promise.all(terms.map(resolveScopedTerm));
  let intersection = results[0];
  for (let i = 1; i < results.length; i++) {
    const set = new Set(results[i]);
    intersection = intersection.filter((id) => set.has(id));
  }
  return [...new Set(intersection)];
}