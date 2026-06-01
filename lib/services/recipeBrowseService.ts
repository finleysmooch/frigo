// ============================================
// FRIGO — RECIPE BROWSE SERVICE (Phase 11A-CP1)
// ============================================
// Pure domain logic for the Recipes browse experience. Owns the single
// composable BrowseState, the context registry, the resolveBrowse composition
// function (filter + sort), and the Cook Again sectioner. No Supabase, no
// React, no icon components — search execution stays in the screen and is
// passed in as `searchedRecipeIds`.
//
// Foundational extraction for the 11A redesign: tiles, cuisine strip,
// contextual facets, refine sheet all plug into this model in CP2+. CP1 is a
// behavior-preserving refactor — the resolver was ported verbatim from
// RecipeListScreen.applyFilters and the section grouping from its
// cookAgainSections useMemo. Section icons return as `iconKey` so the screen
// can map them to icon components without dragging React into this module.
// ============================================

import type { FilterState } from '../../components/FilterDrawer';
import type { Recipe } from '../../components/recipe/RecipeCard';
import type { PantryMatchResult } from './pantryMatchingService';

// ============================================
// TYPES
// ============================================

export type SortOption =
  | 'newest'
  | 'alpha'
  | 'cal_low'
  | 'cal_high'
  | 'protein_high'
  | 'fastest'
  | 'most_cooked'
  | 'highest_rated'
  | 'pantry_match'
  | 'source_updated';

// 11A-CP2: tile contexts added. `your_classics` and `something_new` replace
// CP1's `cook_again` / `try_new` IDs (identical predicates + sectioning). The
// route-param handler in RecipeListScreen maps incoming stats drill-down
// `initialBrowseMode='cook_again' | 'try_new'` to the new IDs so external
// callers don't need to change.
export type BrowseContextId =
  | 'all'
  | 'your_classics'
  | 'something_new'
  | 'quick_tonight'
  | 'ready_to_cook'
  | 'recently_added'
  | 'for_your_diet'
  | 'friends_cook';

// 11A-CP3: QuickFilterId / quickFilterIds removed — the four legacy quick
// filters (`vegetarian`, `highProtein`, `quick30`, `comfort`) are now facet-
// driven refinements (dietary, minProteinPerServing, quickUnder30, vibeTags
// respectively). One source of truth: BrowseState.refinements.

export interface BrowseState {
  context: BrowseContextId;
  selectedBook: string | null;
  refinements: Partial<FilterState>;
  searchedRecipeIds: Set<string> | null;
  sort: SortOption;
  // 11A-CP2: tile-context inputs that need data the resolver can't compute
  // itself. The screen owns the integrations (readyToCookService gate over
  // matchMap + catalog ingredient names; the user's saved dietary prefs) and
  // hands the results in via state.
  readyToCookIds: Set<string> | null;        // null = gate not yet computed
  userDietaryFlags: Partial<FilterState['dietaryFlags']>;
}

export interface BrowseSection {
  title: string;
  iconKey?: 'fire' | 'gem' | 'again';
  data: Recipe[];
}

// 11A-CP2: default-tile registration. Order = render order in the 2×3 grid.
// `something_new` is intentionally NOT a default tile per the prompt — it's
// registered so search/deep-links can target it, but doesn't surface as a
// home-screen entry point.
export interface TileMeta {
  id: BrowseContextId;
  label: string;
}

export const DEFAULT_TILES: TileMeta[] = [
  { id: 'quick_tonight', label: 'Quick tonight' },
  { id: 'ready_to_cook', label: 'Ready to cook' },
  { id: 'recently_added', label: 'Recently added' },
  { id: 'your_classics', label: 'Your classics' },
  { id: 'for_your_diet', label: 'For your diet' },
  { id: 'friends_cook', label: 'Friends cook' },
];

// 11A-CP3 — facet config. Per-context facet sets live on the registry below;
// the cuisine-lens / search-lens overrides + a `getActiveFacets` helper sit
// here so the screen never hardcodes a facet list. `sort` and `More` are
// rendered by the screen as trailing items and aren't included in these
// lists (they're universal, not contextual).
export type FacetId =
  | 'quick'
  | 'vegetarian'
  | 'high_protein'
  | 'one_pot'
  | 'cuisine'
  | 'cookbook'
  | 'sort';

export type FacetKind = 'toggle' | 'picker';

export interface FacetMeta {
  id: FacetId;
  label: string;
  kind: FacetKind;
}

export const FACET_META: Record<FacetId, FacetMeta> = {
  quick:        { id: 'quick',        label: 'Under 30m',   kind: 'toggle' },
  vegetarian:   { id: 'vegetarian',   label: 'Vegetarian',  kind: 'toggle' },
  high_protein: { id: 'high_protein', label: 'High Protein', kind: 'toggle' },
  one_pot:      { id: 'one_pot',      label: 'One pot',     kind: 'toggle' },
  cuisine:      { id: 'cuisine',      label: 'Cuisine',     kind: 'picker' },
  cookbook:     { id: 'cookbook',     label: 'Cookbook',    kind: 'picker' },
  sort:         { id: 'sort',         label: 'Sort',        kind: 'picker' },
};

// Cuisine-lens (context=all + exactly one cuisineTypes entry) and search-lens
// (search active) facet overrides, per the CP3 prompt table. Cuisine is
// excluded from the cuisine-lens set because the dimension is already locked.
export const CUISINE_LENS_FACETS: FacetId[] = ['quick', 'vegetarian', 'cookbook'];
export const SEARCH_LENS_FACETS: FacetId[] = ['quick', 'vegetarian', 'cuisine'];

// True iff a toggle facet is currently applied in the given BrowseState.
// Used by the screen to render facet chips as inactive (default) vs active
// (rendered through the dismissible refinement chip row instead, to avoid
// double-rendering).
export function isFacetActive(id: FacetId, state: BrowseState): boolean {
  const r = state.refinements;
  switch (id) {
    case 'quick':        return !!r.quickUnder30;
    case 'vegetarian':   return !!r.dietaryFlags?.is_vegetarian;
    case 'high_protein': return (r.minProteinPerServing ?? 0) >= 25;
    case 'one_pot':      return !!r.onePotOnly;
    case 'cuisine':      return (r.cuisineTypes?.length ?? 0) > 0;
    case 'cookbook':     return state.selectedBook !== null;
    case 'sort':         return state.sort !== 'newest';
  }
}

// Resolve the active contextual facet list for a BrowseState. Search lens
// wins over cuisine lens (a search inside a cuisine view is still a search).
export function getActiveFacets(state: BrowseState): FacetId[] {
  if (state.searchedRecipeIds !== null) return SEARCH_LENS_FACETS;
  if (
    state.context === 'all' &&
    state.refinements.cuisineTypes?.length === 1
  ) {
    return CUISINE_LENS_FACETS;
  }
  return getBrowseContext(state.context).facets;
}

// ============================================
// CONTEXT REGISTRY
// ============================================

// Each context contributes a base predicate over a recipe. Shape allows tile
// contexts (`quick_tonight`, `ready_to_cook`, …) to plug in as new entries in
// CP2 without resolver changes. `sectioned` flags the contexts whose output
// gets handed to a sectioner before render (today: cook_again only).
interface BrowseContextEntry {
  id: BrowseContextId;
  predicate: (recipe: Recipe, state: BrowseState) => boolean;
  sectioned: boolean;
  // 11A-CP3: contextual facets — the dimensions surfaced in the refine row
  // for this context. The dimension the context already locks is excluded
  // (e.g. quick_tonight excludes `quick`). `sort` + `More` are appended
  // universally by the screen and aren't in this list.
  facets: FacetId[];
}

const BROWSE_CONTEXTS: Record<BrowseContextId, BrowseContextEntry> = {
  all: {
    id: 'all',
    predicate: () => true,
    sectioned: false,
    facets: ['cuisine', 'quick', 'vegetarian', 'cookbook'],
  },
  // CP1's cook_again — renamed for CP2 tile UX; predicate + sectioning unchanged.
  your_classics: {
    id: 'your_classics',
    predicate: (r) => (r.times_cooked ?? 0) > 0,
    sectioned: true,
    facets: ['quick', 'cuisine'],
  },
  // CP1's try_new — renamed for CP2 (registered but not a default tile).
  // `selectedBook` still narrows when populated (now via the cookbook facet,
  // not a standalone interim dropdown).
  something_new: {
    id: 'something_new',
    predicate: (r, state) => {
      if ((r.times_cooked ?? 0) !== 0) return false;
      if (state.selectedBook && r.book_name !== state.selectedBook) return false;
      return true;
    },
    sectioned: false,
    facets: ['cookbook', 'cuisine', 'quick'],
  },
  // 11A-CP2 new tile contexts. Same time predicate as the `quick30` quickFilter
  // — including the prep+cook ≤30 fallback that also matches recipes with no
  // time data populated (existing behavior; verified by CP1 smoke).
  quick_tonight: {
    id: 'quick_tonight',
    predicate: (r) =>
      (r.total_time_min != null && r.total_time_min > 0 && r.total_time_min <= 30) ||
      (r.active_time_min != null && r.active_time_min > 0 && r.active_time_min <= 30) ||
      (r.prep_time_min + r.cook_time_min <= 30),
    sectioned: false,
    facets: ['vegetarian', 'high_protein', 'cuisine'],
  },
  // Ready-to-cook gate is computed in the screen via readyToCookService
  // (matchPercentage ≥0.9 + hero resolution against catalog ingredient names).
  // The screen passes the resulting id set as state.readyToCookIds; predicate
  // just looks it up.
  ready_to_cook: {
    id: 'ready_to_cook',
    predicate: (r, state) => state.readyToCookIds?.has(r.id) ?? false,
    sectioned: false,
    facets: ['quick', 'cuisine', 'one_pot'],
  },
  recently_added: {
    id: 'recently_added',
    predicate: (r) => {
      const created = (r as any).created_at;
      if (!created) return false;
      const days = (Date.now() - new Date(created).getTime()) / (24 * 60 * 60 * 1000);
      return days <= 30;
    },
    sectioned: false,
    facets: ['cuisine', 'quick', 'vegetarian'],
  },
  // AND over every dietary flag the user has set in preferences. No prefs set
  // → predicate is vacuously false (the tile is shown as an inroad in that
  // case anyway).
  for_your_diet: {
    id: 'for_your_diet',
    predicate: (r, state) => {
      const entries = Object.entries(state.userDietaryFlags).filter(([, v]) => !!v);
      if (entries.length === 0) return false;
      return entries.every(([k]) => (r as any)[k] === true);
    },
    sectioned: false,
    facets: ['quick', 'high_protein', 'cuisine'],
  },
  friends_cook: {
    id: 'friends_cook',
    predicate: (r) => (r.friends_cooked_count ?? 0) > 0,
    sectioned: false,
    facets: ['cuisine', 'quick'],
  },
};

export function getBrowseContext(id: BrowseContextId): BrowseContextEntry {
  return BROWSE_CONTEXTS[id];
}

// ============================================
// RESOLVE — single composition function
// ============================================

// Order ported verbatim from RecipeListScreen.applyFilters:
//   0. search intersection
//   1. context base filter
//   2. quick filters
//   3. advanced refinements (every dimension, same null-handling)
//   4. sort (all 9 options, null-to-bottom)
// pantry_match reads matchMap directly so it stays correct even when the
// caller hasn't pre-stamped recipe.pantry_match.
export function resolveBrowse(
  recipes: Recipe[],
  matchMap: Map<string, PantryMatchResult>,
  state: BrowseState
): Recipe[] {
  let filtered = [...recipes];

  // 0. Search filter (8R-UX1). When searchedRecipeIds is non-null, the user
  // has an active search; intersect with the search hits before applying
  // other filters.
  if (state.searchedRecipeIds !== null) {
    const ids = state.searchedRecipeIds;
    filtered = filtered.filter((r) => ids.has(r.id));
  }

  // 1. Context base filter (cook_again > 0; try_new === 0 + selectedBook)
  const ctx = BROWSE_CONTEXTS[state.context];
  filtered = filtered.filter((r) => ctx.predicate(r, state));

  // 2. (CP3) Quick-filter branch removed — semantics now flow through
  // refinements below. The facet UI in the screen toggles dietary flags,
  // minProteinPerServing, quickUnder30, vibeTags directly on FilterState.

  // 3. Advanced refinements
  const af = state.refinements;

  // Dietary — AND logic: every selected flag must be true on the recipe
  if (af.dietaryFlags) {
    const flags = af.dietaryFlags as Record<string, boolean | undefined>;
    Object.entries(flags).forEach(([key, required]) => {
      if (!required) return;
      filtered = filtered.filter((r) => (r as any)[key] === true);
    });
  }

  // Hero ingredients — OR logic
  if (af.heroIngredients?.length) {
    filtered = filtered.filter((r) =>
      af.heroIngredients!.some((h) =>
        r.hero_ingredients?.some((rh) => rh.toLowerCase() === h.toLowerCase())
      )
    );
  }

  // Vibe tags — OR logic
  if (af.vibeTags?.length) {
    filtered = filtered.filter((r) =>
      af.vibeTags!.some((v) =>
        r.vibe_tags?.some((rv) => rv.toLowerCase() === v.toLowerCase())
      )
    );
  }

  // Nutrition
  if (af.maxCaloriesPerServing != null) {
    filtered = filtered.filter(
      (r) => r.cal_per_serving == null || r.cal_per_serving <= af.maxCaloriesPerServing!
    );
  }
  if (af.minProteinPerServing != null) {
    filtered = filtered.filter(
      (r) => r.protein_per_serving_g != null && r.protein_per_serving_g >= af.minProteinPerServing!
    );
  }
  // 11D: additional high/low macro thresholds (carbs/fat + other directions).
  // Convention: MAX lets null-nutrition rows pass; MIN excludes them.
  if (af.minCaloriesPerServing != null) {
    filtered = filtered.filter((r) => r.cal_per_serving != null && r.cal_per_serving >= af.minCaloriesPerServing!);
  }
  if (af.maxProteinPerServing != null) {
    filtered = filtered.filter((r) => r.protein_per_serving_g == null || r.protein_per_serving_g <= af.maxProteinPerServing!);
  }
  if (af.minCarbsPerServing != null) {
    filtered = filtered.filter((r) => r.carbs_per_serving_g != null && r.carbs_per_serving_g >= af.minCarbsPerServing!);
  }
  if (af.maxCarbsPerServing != null) {
    filtered = filtered.filter((r) => r.carbs_per_serving_g == null || r.carbs_per_serving_g <= af.maxCarbsPerServing!);
  }
  if (af.minFatPerServing != null) {
    filtered = filtered.filter((r) => r.fat_per_serving_g != null && r.fat_per_serving_g >= af.minFatPerServing!);
  }
  if (af.maxFatPerServing != null) {
    filtered = filtered.filter((r) => r.fat_per_serving_g == null || r.fat_per_serving_g <= af.maxFatPerServing!);
  }

  // Time
  if (af.maxActiveTime != null) {
    filtered = filtered.filter(
      (r) => r.active_time_min == null || r.active_time_min <= af.maxActiveTime!
    );
  }
  if (af.maxTotalTime != null) {
    filtered = filtered.filter(
      (r) =>
        (r.total_time_min == null || r.total_time_min <= af.maxTotalTime!) &&
        (r.active_time_min == null || r.active_time_min <= af.maxTotalTime!)
    );
  }

  // Difficulty — OR logic
  if (af.difficultyLevels?.length) {
    filtered = filtered.filter(
      (r) => r.difficulty_level != null && af.difficultyLevels!.includes(r.difficulty_level)
    );
  }
  if (af.easierThanLooks) {
    filtered = filtered.filter((r) => r.easier_than_looks === true);
  }

  // Cooking methods — OR logic
  if (af.cookingMethods?.length) {
    filtered = filtered.filter((r) =>
      r.cooking_methods?.some((m) => af.cookingMethods!.includes(m))
    );
  }

  // Source — OR logic on source_domain (NYT import; book/photo recipes have none)
  if (af.sources?.length) {
    filtered = filtered.filter(
      (r) => (r as any).source_domain && af.sources!.includes((r as any).source_domain)
    );
  }

  // Cuisine — OR logic
  if (af.cuisineTypes?.length) {
    filtered = filtered.filter((r) =>
      r.cuisine_types?.some((c) => af.cuisineTypes!.includes(c))
    );
  }

  // Course type — OR logic
  if (af.courseTypes?.length) {
    filtered = filtered.filter(
      (r) => r.course_type != null && af.courseTypes!.includes(r.course_type)
    );
  }

  // Ingredient count ranges — OR logic ('1–5', '6–10', …, '16+')
  if (af.ingredientCountRanges?.length) {
    filtered = filtered.filter((r) => {
      if (r.ingredient_count == null) return false;
      return af.ingredientCountRanges!.some((range) => {
        if (range === '16+') return r.ingredient_count! >= 16;
        const [lo, hi] = range.split('–').map(Number);
        return r.ingredient_count! >= lo && r.ingredient_count! <= hi;
      });
    });
  }

  // Make-ahead
  if (af.makeAheadFriendly) {
    filtered = filtered.filter((r) => r.make_ahead_friendly === true);
  }

  // 11A-CP3: facet refinements without dedicated FilterDrawer UI.
  // quickUnder30 preserves the legacy quick30 quickFilter predicate (3-way
  // OR: total/active/(prep+cook) ≤30) exactly. onePotOnly filters on
  // recipes.is_one_pot.
  if (af.quickUnder30) {
    filtered = filtered.filter(
      (r) =>
        (r.total_time_min && r.total_time_min <= 30) ||
        (r.active_time_min && r.active_time_min <= 30) ||
        (r.prep_time_min + r.cook_time_min <= 30),
    );
  }
  if (af.onePotOnly) {
    filtered = filtered.filter((r) => r.is_one_pot === true);
  }

  // Serving temp — OR logic
  if (af.servingTemp?.length) {
    filtered = filtered.filter(
      (r) => r.serving_temp != null && af.servingTemp!.includes(r.serving_temp)
    );
  }

  // Social
  if (af.recentlySaved) {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    filtered = filtered.filter(
      (r) => (r as any).created_at && new Date((r as any).created_at).getTime() >= thirtyDaysAgo
    );
  }
  if (af.recentlyCookedByFriends) {
    filtered = filtered.filter((r) => (r.friends_cooked_count ?? 0) > 0);
  }

  // 4. Sort (nulls/undefineds pushed to end)
  switch (state.sort) {
    case 'newest':
      // Already ordered by created_at desc from the query — no-op
      break;
    case 'alpha':
      filtered.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'cal_low':
      filtered.sort((a, b) => {
        if (a.cal_per_serving == null && b.cal_per_serving == null) return 0;
        if (a.cal_per_serving == null) return 1;
        if (b.cal_per_serving == null) return -1;
        return a.cal_per_serving - b.cal_per_serving;
      });
      break;
    case 'cal_high':
      filtered.sort((a, b) => {
        if (a.cal_per_serving == null && b.cal_per_serving == null) return 0;
        if (a.cal_per_serving == null) return 1;
        if (b.cal_per_serving == null) return -1;
        return b.cal_per_serving - a.cal_per_serving;
      });
      break;
    case 'protein_high':
      filtered.sort((a, b) => {
        if (a.protein_per_serving_g == null && b.protein_per_serving_g == null) return 0;
        if (a.protein_per_serving_g == null) return 1;
        if (b.protein_per_serving_g == null) return -1;
        return b.protein_per_serving_g - a.protein_per_serving_g;
      });
      break;
    case 'fastest':
      filtered.sort((a, b) => {
        const timeA = a.total_time_min ?? a.active_time_min ?? null;
        const timeB = b.total_time_min ?? b.active_time_min ?? null;
        if (timeA == null && timeB == null) return 0;
        if (timeA == null) return 1;
        if (timeB == null) return -1;
        return timeA - timeB;
      });
      break;
    case 'most_cooked':
      filtered.sort((a, b) => {
        const ca = a.times_cooked ?? 0;
        const cb = b.times_cooked ?? 0;
        if (ca === 0 && cb === 0) return 0;
        if (ca === 0) return 1;
        if (cb === 0) return -1;
        return cb - ca;
      });
      break;
    case 'highest_rated':
      filtered.sort((a, b) => {
        if (a.avg_rating == null && b.avg_rating == null) return 0;
        if (a.avg_rating == null) return 1;
        if (b.avg_rating == null) return -1;
        return b.avg_rating - a.avg_rating;
      });
      break;
    case 'pantry_match':
      // Descending by pantry match %. Recipes with no match data (match not
      // yet computed) sort to the bottom at 0.
      filtered.sort((a, b) => {
        const ma = matchMap.get(a.id)?.matchPercentage ?? 0;
        const mb = matchMap.get(b.id)?.matchPercentage ?? 0;
        return mb - ma;
      });
      break;
    case 'source_updated':
      // NYT import: web recipes by the source's last-modified date, newest
      // first. Recipes with no source date (book/photo) sort to the bottom.
      filtered.sort((a, b) => {
        const ta = (a as any).source_updated_at ? new Date((a as any).source_updated_at).getTime() : null;
        const tb = (b as any).source_updated_at ? new Date((b as any).source_updated_at).getTime() : null;
        if (ta == null && tb == null) return 0;
        if (ta == null) return 1;
        if (tb == null) return -1;
        return tb - ta;
      });
      break;
  }

  return filtered;
}

// ============================================
// COOK AGAIN SECTIONS
// ============================================

// Organises already-browse-filtered recipes into smart Cook Again groups.
// Ported verbatim from RecipeListScreen's cookAgainSections useMemo. Returns
// iconKey strings (mapped to icon components by the screen) so the module
// stays React-free.
export function getCookAgainSections(recipes: Recipe[]): BrowseSection[] {
  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  const recentFavorites = recipes.filter((r) => {
    if (!r.last_cooked) return false;
    const days = (now - new Date(r.last_cooked).getTime()) / msPerDay;
    return days <= 30 && (r.avg_rating ?? 0) >= 4;
  });

  const forgottenGems = recipes.filter((r) => {
    if (!r.last_cooked) return false;
    const days = (now - new Date(r.last_cooked).getTime()) / msPerDay;
    return (r.avg_rating ?? 0) >= 4 && days > 60;
  });

  const regulars = recipes.filter((r) => (r.times_cooked ?? 0) >= 3);

  const sections: BrowseSection[] = [];
  if (recentFavorites.length > 0)
    sections.push({ title: 'Recent Favorites', iconKey: 'fire', data: recentFavorites });
  if (forgottenGems.length > 0)
    sections.push({ title: 'Forgotten Gems', iconKey: 'gem', data: forgottenGems });
  if (regulars.length > 0)
    sections.push({ title: 'Regulars', iconKey: 'again', data: regulars });

  // Fallback: show everything under a generic heading when no smart sections match
  if (sections.length === 0 && recipes.length > 0) {
    sections.push({ title: 'Cooked Recipes', data: recipes });
  }

  return sections;
}
