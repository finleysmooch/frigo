// TEMP — keep alongside the resolver while 11A iterates; remove once the
// dedicated test infrastructure for Phase 11 ships.
// ============================================
// FRIGO — RECIPE BROWSE RESOLVER SMOKE TEST (Phase 11A-CP1)
// ============================================
// In-memory smoke harness for lib/services/recipeBrowseService — no Supabase,
// no async. Builds a small fixture recipe set + a state matrix and asserts
// resolveBrowse output IDs/orders. Purpose: a fast parity guard so the
// downstream CPs (tiles, cuisine, facets, refine sheet) can lean on the
// resolver without re-deriving the current behavior by hand.
//
// Trigger: AdminScreen → "Run recipe browse resolver tests" button (or any
// other screen-level invocation). Results land in the Metro/RN debugger
// console as [BROWSE-N] lines.
//
// Mirrors `_pantryMatchingSmokeTest.ts` log conventions: `report(label, pass,
// expected, result)` for each assertion. No teardown — the fixtures are
// plain JS objects.
// ============================================

import { resolveBrowse, type BrowseState } from './recipeBrowseService';
import type { PantryMatchResult } from './pantryMatchingService';
import type { Recipe } from '../../components/recipe/RecipeCard';

// ============================================
// LOGGING
// ============================================

function report(label: string, pass: boolean, expected: string, result: unknown): void {
  console.warn(`[${label}]`, pass ? '✅ PASS' : '❌ FAIL', { result, expected });
}

function arrEq(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function setEq(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const A = new Set(a);
  for (const id of b) if (!A.has(id)) return false;
  return true;
}

// ============================================
// FIXTURES
// ============================================

// Helper: stub the fields resolveBrowse never reads so we only have to spell
// out the meaningful ones per recipe. id + title come in via `overrides`.
function mkRecipe(overrides: Partial<Recipe> & { id: string; title: string }): Recipe {
  return {
    description: '',
    prep_time_min: 0,
    cook_time_min: 0,
    inactive_time_min: 0,
    active_time_min: 0,
    total_time_min: 0,
    servings: 1,
    difficulty_level: 'easy',
    easier_than_looks: false,
    cooking_methods: [],
    cuisine_types: [],
    make_ahead_friendly: false,
    is_one_pot: false,
    chef_id: 'chef-x',
    hero_ingredients: [],
    vibe_tags: [],
    serving_temp: null,
    course_type: null,
    make_ahead_score: null,
    ...overrides,
    // Cast-through: `created_at` is read by the recentlySaved refinement via
    // `(r as any).created_at` and isn't on the canonical Recipe shape.
  } as Recipe;
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

// Recipe set spans every dimension the resolver inspects.
const RECIPES: Recipe[] = [
  // r1 — cooked recently, high rating, italian comfort vegetarian, quick30
  mkRecipe({
    id: 'r1',
    title: 'Aglio e Olio',
    times_cooked: 5,
    last_cooked: new Date(NOW - 10 * DAY).toISOString(),
    avg_rating: 5,
    cuisine_types: ['italian'],
    cooking_methods: ['stovetop'],
    course_type: 'main',
    vibe_tags: ['comfort', 'quick'],
    hero_ingredients: ['Garlic', 'Olive Oil'],
    is_vegetarian: true,
    is_vegan: false,
    is_gluten_free: false,
    cal_per_serving: 420,
    protein_per_serving_g: 12,
    total_time_min: 20,
    active_time_min: 20,
    difficulty_level: 'easy',
    ingredient_count: 5,
    serving_temp: 'hot',
    make_ahead_friendly: false,
    book_name: 'Book A',
    friends_cooked_count: 2,
    pantry_match: 0,
  }),
  // r2 — cooked once long ago, low rating, mexican high-protein advanced.
  // prep+cook set explicitly so the quick30 fallback clause (prep+cook ≤30)
  // doesn't accidentally include it.
  mkRecipe({
    id: 'r2',
    title: 'Birria Tacos',
    times_cooked: 1,
    last_cooked: new Date(NOW - 90 * DAY).toISOString(),
    avg_rating: 2,
    cuisine_types: ['mexican'],
    cooking_methods: ['braise'],
    course_type: 'main',
    vibe_tags: ['project'],
    hero_ingredients: ['Beef'],
    is_vegetarian: false,
    cal_per_serving: 780,
    protein_per_serving_g: 45,
    prep_time_min: 30,
    cook_time_min: 210,
    total_time_min: 240,
    active_time_min: 60,
    difficulty_level: 'advanced',
    ingredient_count: 14,
    serving_temp: 'hot',
    make_ahead_friendly: true,
    book_name: 'Book B',
    pantry_match: 0,
  }),
  // r3 — never cooked, book B, high protein, no rating, no last_cooked
  mkRecipe({
    id: 'r3',
    title: 'Chicken Cobb',
    times_cooked: 0,
    cuisine_types: ['american'],
    cooking_methods: ['grill'],
    course_type: 'main',
    vibe_tags: ['fresh & light'],
    hero_ingredients: ['Chicken Breast', 'Avocado'],
    is_vegetarian: false,
    is_gluten_free: true,
    cal_per_serving: 540,
    protein_per_serving_g: 38,
    total_time_min: 35,
    active_time_min: 25,
    difficulty_level: 'medium',
    ingredient_count: 9,
    serving_temp: 'cold',
    book_name: 'Book B',
    pantry_match: 0,
  }),
  // r4 — never cooked, no book, vegetarian + quick + no cal data
  mkRecipe({
    id: 'r4',
    title: 'Veggie Stir Fry',
    times_cooked: 0,
    cuisine_types: ['chinese'],
    cooking_methods: ['stovetop'],
    course_type: 'main',
    vibe_tags: ['quick', 'comfort'],
    hero_ingredients: ['Broccoli'],
    is_vegetarian: true,
    is_vegan: true,
    protein_per_serving_g: 18,
    total_time_min: 15,
    active_time_min: 15,
    difficulty_level: 'easy',
    ingredient_count: 8,
    serving_temp: 'hot',
    make_ahead_friendly: false,
    pantry_match: 0,
  }),
  // r5 — regular (times_cooked >=3) + forgotten gem (last_cooked >60d, rating>=4).
  // prep+cook set so quick30 (prep+cook ≤30) doesn't accidentally include it.
  mkRecipe({
    id: 'r5',
    title: 'Sunday Roast',
    times_cooked: 4,
    last_cooked: new Date(NOW - 75 * DAY).toISOString(),
    avg_rating: 4.5,
    cuisine_types: ['british'],
    cooking_methods: ['oven'],
    course_type: 'main',
    vibe_tags: ['crowd pleaser', 'project'],
    hero_ingredients: ['Beef'],
    is_vegetarian: false,
    cal_per_serving: 650,
    protein_per_serving_g: 50,
    prep_time_min: 30,
    cook_time_min: 150,
    total_time_min: 180,
    active_time_min: 40,
    difficulty_level: 'medium',
    ingredient_count: 11,
    serving_temp: 'hot',
    make_ahead_friendly: false,
    book_name: 'Book A',
    pantry_match: 0,
  }),
  // r6 — never cooked, no nutrition / no times_cooked (undefined fields)
  // also exercises null-to-bottom behavior in sorts.
  mkRecipe({
    id: 'r6',
    title: 'Mystery Recipe',
    cuisine_types: ['fusion'],
    vibe_tags: [],
    hero_ingredients: [],
    difficulty_level: 'easy',
    ingredient_count: 3,
    serving_temp: 'warm',
    pantry_match: 0,
  }),
];

// matchMap: r1=10%, r4=80%, r5=50%, rest absent (→ default 0).
const MATCH_MAP: Map<string, PantryMatchResult> = new Map([
  ['r1', { recipeId: 'r1', matchPercentage: 0.10, matched: [], missing: [], totalCount: 5, matchedCount: 1 }],
  ['r4', { recipeId: 'r4', matchPercentage: 0.80, matched: [], missing: [], totalCount: 8, matchedCount: 6 }],
  ['r5', { recipeId: 'r5', matchPercentage: 0.50, matched: [], missing: [], totalCount: 10, matchedCount: 5 }],
]);

// Baseline state — no filters, no search, sort by 'newest' (no-op).
function baseState(overrides: Partial<BrowseState> = {}): BrowseState {
  return {
    context: 'all',
    selectedBook: null,
    refinements: {},
    searchedRecipeIds: null,
    sort: 'newest',
    readyToCookIds: null,
    userDietaryFlags: {},
    ...overrides,
  };
}

// ============================================
// RUNNER
// ============================================

export function runRecipeBrowseResolverTests(): void {
  console.warn('[BROWSE-START]', 'Recipe browse resolver smoke tests — fixtures:', RECIPES.length);

  // ---- Context: all → every recipe ----
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState()).map((r) => r.id);
    report('BROWSE-CTX-all', setEq(out, ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']),
      'all 6 recipes when context=all + no filters', out);
  }

  // ---- Context: your_classics (CP1 cook_again) → times_cooked > 0 (r1, r2, r5) ----
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ context: 'your_classics' })).map((r) => r.id);
    report('BROWSE-CTX-your_classics', setEq(out, ['r1', 'r2', 'r5']),
      'r1, r2, r5 (times_cooked > 0)', out);
  }

  // ---- Context: something_new (CP1 try_new) → times_cooked === 0 (r3, r4, r6 — r6 has undefined) ----
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ context: 'something_new' })).map((r) => r.id);
    report('BROWSE-CTX-something_new', setEq(out, ['r3', 'r4', 'r6']),
      'r3, r4, r6 (times_cooked === 0 or undefined → 0)', out);
  }

  // ---- something_new + selectedBook='Book B' → r3 only ----
  {
    const out = resolveBrowse(
      RECIPES,
      MATCH_MAP,
      baseState({ context: 'something_new', selectedBook: 'Book B' }),
    ).map((r) => r.id);
    report('BROWSE-CTX-something_new-book', setEq(out, ['r3']),
      'r3 only (something_new + book_name === "Book B")', out);
  }

  // ---- Facet refinements (CP3: former quickFilters as one-source-of-truth
  // refinements on FilterState — vegetarian/highProtein/quick30/comfort →
  // dietaryFlags.is_vegetarian / minProteinPerServing=25 / quickUnder30 /
  // vibeTags=['comfort']). Same sets as the CP1 quick-filter assertions. ----
  {
    const out = resolveBrowse(
      RECIPES, MATCH_MAP,
      baseState({ refinements: { dietaryFlags: { is_vegetarian: true } } }),
    ).map((r) => r.id);
    report('BROWSE-REF-vegetarian', setEq(out, ['r1', 'r4']),
      'r1, r4 (is_vegetarian === true) — facet-refinement parity', out);
  }
  {
    const out = resolveBrowse(
      RECIPES, MATCH_MAP,
      baseState({ refinements: { minProteinPerServing: 25 } }),
    ).map((r) => r.id);
    report('BROWSE-REF-highProtein', setEq(out, ['r2', 'r3', 'r5']),
      'r2, r3, r5 (protein >= 25g) — facet-refinement parity', out);
  }
  {
    // quick: total_time<=30 OR active_time<=30 OR prep+cook<=30. Same set as
    // the CP1 quick30 quickFilter. r1=20, r3=35 (active=25 ≤30 → included),
    // r4=15, r6=0+0=0. r2=240/60, r5=180/40 both excluded.
    const out = resolveBrowse(
      RECIPES, MATCH_MAP,
      baseState({ refinements: { quickUnder30: true } }),
    ).map((r) => r.id);
    report('BROWSE-REF-quick', setEq(out, ['r1', 'r3', 'r4', 'r6']),
      'r1, r3, r4, r6 (any time-dim ≤30 or prep+cook=0≤30) — quick30 parity', out);
  }
  {
    const out = resolveBrowse(
      RECIPES, MATCH_MAP,
      baseState({ refinements: { vibeTags: ['comfort'] } }),
    ).map((r) => r.id);
    report('BROWSE-REF-comfort', setEq(out, ['r1', 'r4']),
      'r1, r4 (vibe_tags includes "comfort") — vibe refinement parity', out);
  }
  // 11A-CP3 new refinement: onePotOnly → is_one_pot === true. None of the
  // fixtures set is_one_pot, so this asserts the empty-set case; if we add a
  // fixture later, this guards against unintended onePotOnly matches.
  {
    const out = resolveBrowse(
      RECIPES, MATCH_MAP,
      baseState({ refinements: { onePotOnly: true } }),
    ).map((r) => r.id);
    report('BROWSE-REF-onePot', out.length === 0,
      'no fixture has is_one_pot=true → empty set', out);
  }

  // ---- Advanced dimensions ----
  // Dietary AND — vegan + vegetarian both required → r4 only (r1 vegetarian-only)
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { dietaryFlags: { is_vegan: true, is_vegetarian: true } },
    })).map((r) => r.id);
    report('BROWSE-ADV-dietary-AND', setEq(out, ['r4']),
      'r4 only (vegan AND vegetarian both true)', out);
  }
  // Hero OR (case-insensitive) — 'beef' matches r2 (Beef Chuck) + r5 (Beef)
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { heroIngredients: ['beef'] },
    })).map((r) => r.id);
    report('BROWSE-ADV-hero-OR', setEq(out, ['r2', 'r5']),
      'r2, r5 (hero "beef" — case-insensitive)', out);
  }
  // Vibe OR — 'project' → r2 + r5
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { vibeTags: ['project'] },
    })).map((r) => r.id);
    report('BROWSE-ADV-vibe-OR', setEq(out, ['r2', 'r5']),
      'r2, r5 (vibe "project")', out);
  }
  // Cuisine OR — 'italian' + 'mexican' → r1, r2
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { cuisineTypes: ['italian', 'mexican'] },
    })).map((r) => r.id);
    report('BROWSE-ADV-cuisine-OR', setEq(out, ['r1', 'r2']),
      'r1, r2 (italian OR mexican)', out);
  }
  // Cooking methods OR
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { cookingMethods: ['grill', 'oven'] },
    })).map((r) => r.id);
    report('BROWSE-ADV-methods-OR', setEq(out, ['r3', 'r5']),
      'r3 (grill), r5 (oven)', out);
  }
  // Course OR
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { courseTypes: ['main'] },
    })).map((r) => r.id);
    report('BROWSE-ADV-course-OR', setEq(out, ['r1', 'r2', 'r3', 'r4', 'r5']),
      'r1-r5 (course "main"; r6 course null)', out);
  }
  // Difficulty OR + easierThanLooks (no recipe has flag → empty)
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { difficultyLevels: ['advanced', 'medium'] },
    })).map((r) => r.id);
    report('BROWSE-ADV-difficulty-OR', setEq(out, ['r2', 'r3', 'r5']),
      'r2 advanced, r3+r5 medium', out);
  }
  // Max cal — recipes with null cal pass through (r4, r6); cal<=500 → r1 (420)
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { maxCaloriesPerServing: 500 },
    })).map((r) => r.id);
    report('BROWSE-ADV-maxCal', setEq(out, ['r1', 'r4', 'r6']),
      'r1 (420), r4+r6 (null cal pass-through)', out);
  }
  // Min protein — protein != null AND >=30 → r2 (45), r3 (38), r5 (50)
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { minProteinPerServing: 30 },
    })).map((r) => r.id);
    report('BROWSE-ADV-minProtein', setEq(out, ['r2', 'r3', 'r5']),
      'r2/r3/r5 (protein >= 30g; r6 null excluded)', out);
  }
  // maxActiveTime — null pass-through; active<=20 → r1 (20), r4 (15), r6 (0)
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { maxActiveTime: 20 },
    })).map((r) => r.id);
    report('BROWSE-ADV-maxActive', setEq(out, ['r1', 'r4', 'r6']),
      'r1/r4/r6 (active_time ≤20)', out);
  }
  // Ingredient count ranges — '6–10' covers r3 (9), r4 (8) — and '16+' is empty here
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { ingredientCountRanges: ['6–10'] },
    })).map((r) => r.id);
    report('BROWSE-ADV-ingCount-range', setEq(out, ['r3', 'r4']),
      'r3 (9), r4 (8) — ingredient_count in [6,10]', out);
  }
  // makeAheadFriendly
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { makeAheadFriendly: true },
    })).map((r) => r.id);
    report('BROWSE-ADV-makeAhead', setEq(out, ['r2']),
      'r2 only (make_ahead_friendly === true)', out);
  }
  // servingTemp OR
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { servingTemp: ['cold', 'warm'] },
    })).map((r) => r.id);
    report('BROWSE-ADV-servingTemp', setEq(out, ['r3', 'r6']),
      'r3 (cold), r6 (warm)', out);
  }
  // recentlyCookedByFriends
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      refinements: { recentlyCookedByFriends: true },
    })).map((r) => r.id);
    report('BROWSE-ADV-friendsCooked', setEq(out, ['r1']),
      'r1 only (friends_cooked_count > 0)', out);
  }

  // ---- Sorts (all 9, null-to-bottom semantics) ----
  // newest — no-op, preserves input order
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ sort: 'newest' })).map((r) => r.id);
    report('BROWSE-SORT-newest', arrEq(out, ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']),
      'input order preserved', out);
  }
  // alpha
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ sort: 'alpha' })).map((r) => r.id);
    report('BROWSE-SORT-alpha',
      arrEq(out, ['r1', 'r2', 'r3', 'r6', 'r5', 'r4']),
      'A→Z by title: Aglio, Birria, Chicken, Mystery, Sunday, Veggie', out);
  }
  // cal_low — nulls (r4, r6) to bottom; r1<r3<r5<r2
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ sort: 'cal_low' })).map((r) => r.id);
    const head = out.slice(0, 4);
    const tail = out.slice(4);
    const pass = arrEq(head, ['r1', 'r3', 'r5', 'r2']) && setEq(tail, ['r4', 'r6']);
    report('BROWSE-SORT-cal_low', pass,
      'head r1/r3/r5/r2 ascending; nulls r4,r6 trailing', out);
  }
  // cal_high — nulls to bottom; r2>r5>r3>r1
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ sort: 'cal_high' })).map((r) => r.id);
    const head = out.slice(0, 4);
    const tail = out.slice(4);
    const pass = arrEq(head, ['r2', 'r5', 'r3', 'r1']) && setEq(tail, ['r4', 'r6']);
    report('BROWSE-SORT-cal_high', pass,
      'head r2/r5/r3/r1 descending; nulls r4,r6 trailing', out);
  }
  // protein_high — only r6 lacks protein → trailing. r5(50)>r2(45)>r3(38)>r4(18)>r1(12)>r6(null)
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ sort: 'protein_high' })).map((r) => r.id);
    report('BROWSE-SORT-protein_high',
      arrEq(out, ['r5', 'r2', 'r3', 'r4', 'r1', 'r6']),
      'r5>r2>r3>r4>r1; r6 (null) last', out);
  }
  // fastest — total_time or active_time. r6=0, r4=15, r1=20, r3=35, r5=180, r2=240
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ sort: 'fastest' })).map((r) => r.id);
    report('BROWSE-SORT-fastest',
      arrEq(out, ['r6', 'r4', 'r1', 'r3', 'r5', 'r2']),
      'ascending by total_time fallback active_time', out);
  }
  // most_cooked — r1(5)>r5(4)>r2(1); zeros/undefined (r3, r4, r6) trailing
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ sort: 'most_cooked' })).map((r) => r.id);
    const head = out.slice(0, 3);
    const tail = out.slice(3);
    const pass = arrEq(head, ['r1', 'r5', 'r2']) && setEq(tail, ['r3', 'r4', 'r6']);
    report('BROWSE-SORT-most_cooked', pass,
      'head r1/r5/r2; zero/undefined cooked trailing', out);
  }
  // highest_rated — r1(5)>r5(4.5)>r2(2); null ratings (r3, r4, r6) trailing
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ sort: 'highest_rated' })).map((r) => r.id);
    const head = out.slice(0, 3);
    const tail = out.slice(3);
    const pass = arrEq(head, ['r1', 'r5', 'r2']) && setEq(tail, ['r3', 'r4', 'r6']);
    report('BROWSE-SORT-highest_rated', pass,
      'head r1/r5/r2; null ratings trailing', out);
  }
  // pantry_match — reads matchMap directly. r4(0.80)>r5(0.50)>r1(0.10); others 0
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ sort: 'pantry_match' })).map((r) => r.id);
    const head = out.slice(0, 3);
    const tail = out.slice(3);
    const pass = arrEq(head, ['r4', 'r5', 'r1']) && setEq(tail, ['r2', 'r3', 'r6']);
    report('BROWSE-SORT-pantry_match', pass,
      'head r4/r5/r1; absent-from-map (=0) trailing', out);
  }

  // ---- Search intersection ----
  {
    const search = new Set(['r1', 'r3', 'r5']);
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ searchedRecipeIds: search })).map((r) => r.id);
    report('BROWSE-SEARCH-intersect', setEq(out, ['r1', 'r3', 'r5']),
      'only ids in searchedRecipeIds survive', out);
  }
  {
    // Search ∩ something_new → only r3 (r1 cooked, r5 cooked)
    const search = new Set(['r1', 'r3', 'r5']);
    const out = resolveBrowse(
      RECIPES,
      MATCH_MAP,
      baseState({ context: 'something_new', searchedRecipeIds: search }),
    ).map((r) => r.id);
    report('BROWSE-SEARCH+CTX', setEq(out, ['r3']),
      'search ∩ something_new → r3 only', out);
  }
  {
    // Empty search set → empty output
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ searchedRecipeIds: new Set() })).map((r) => r.id);
    report('BROWSE-SEARCH-empty', out.length === 0,
      'empty search set → empty output', out);
  }

  // ---- Combined: something_new + high_protein facet + cuisine=american + sort=protein_high ----
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({
      context: 'something_new',
      refinements: { minProteinPerServing: 25, cuisineTypes: ['american'] },
      sort: 'protein_high',
    })).map((r) => r.id);
    // something_new → r3, r4, r6. minProtein>=25 → r3 (38), r4 (18 excluded), r6 null excluded.
    // cuisine american → r3 only.
    report('BROWSE-COMBO', arrEq(out, ['r3']),
      'something_new + minProtein>=25 + cuisine=american → r3', out);
  }

  // ============================================
  // 11A-CP2 — new tile contexts
  // ============================================

  // ---- quick_tonight — total/active ≤30 or prep+cook=0≤30. Same set as quick30 quickFilter. ----
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ context: 'quick_tonight' })).map((r) => r.id);
    report('BROWSE-CTX-quick_tonight', setEq(out, ['r1', 'r3', 'r4', 'r6']),
      'r1/r3/r4 by time fields; r6 via prep+cook=0≤30 (parity with quick30)', out);
  }

  // ---- ready_to_cook — predicate is set membership in state.readyToCookIds. ----
  {
    const readyIds = new Set(['r4', 'r5']);
    const out = resolveBrowse(
      RECIPES,
      MATCH_MAP,
      baseState({ context: 'ready_to_cook', readyToCookIds: readyIds }),
    ).map((r) => r.id);
    report('BROWSE-CTX-ready_to_cook', setEq(out, ['r4', 'r5']),
      'exactly the ids the screen passed in via state.readyToCookIds', out);
  }
  // Null readyToCookIds → predicate falsey for every recipe (gate not yet computed).
  {
    const out = resolveBrowse(
      RECIPES,
      MATCH_MAP,
      baseState({ context: 'ready_to_cook', readyToCookIds: null }),
    ).map((r) => r.id);
    report('BROWSE-CTX-ready_to_cook-null', out.length === 0,
      'null readyToCookIds → empty result (gate not computed)', out);
  }

  // ---- recently_added — created_at within 30d. Fixture: none have created_at → empty. ----
  // Then a positive case with a synthetic created_at.
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ context: 'recently_added' })).map((r) => r.id);
    report('BROWSE-CTX-recently_added-empty', out.length === 0,
      'no fixture has created_at → empty set', out);
  }
  {
    const recipesWithCreated = RECIPES.map((r, i) => {
      if (r.id === 'r2') return { ...r, created_at: new Date(NOW - 5 * DAY).toISOString() } as Recipe;
      if (r.id === 'r4') return { ...r, created_at: new Date(NOW - 50 * DAY).toISOString() } as Recipe;
      return r;
    });
    const out = resolveBrowse(recipesWithCreated, MATCH_MAP, baseState({ context: 'recently_added' })).map((r) => r.id);
    report('BROWSE-CTX-recently_added', setEq(out, ['r2']),
      'r2 created 5d ago is in; r4 50d ago is out', out);
  }

  // ---- for_your_diet — AND over state.userDietaryFlags. ----
  // r1 = vegetarian only, r4 = vegan + vegetarian, others false/undefined.
  {
    const out = resolveBrowse(
      RECIPES,
      MATCH_MAP,
      baseState({ context: 'for_your_diet', userDietaryFlags: { is_vegetarian: true } }),
    ).map((r) => r.id);
    report('BROWSE-CTX-for_your_diet-veg', setEq(out, ['r1', 'r4']),
      'vegetarian → r1, r4', out);
  }
  {
    const out = resolveBrowse(
      RECIPES,
      MATCH_MAP,
      baseState({ context: 'for_your_diet', userDietaryFlags: { is_vegan: true, is_vegetarian: true } }),
    ).map((r) => r.id);
    report('BROWSE-CTX-for_your_diet-AND', setEq(out, ['r4']),
      'vegan AND vegetarian → r4 only', out);
  }
  {
    // No prefs set → context is vacuously empty (matches the inroad gate logic).
    const out = resolveBrowse(
      RECIPES,
      MATCH_MAP,
      baseState({ context: 'for_your_diet', userDietaryFlags: {} }),
    ).map((r) => r.id);
    report('BROWSE-CTX-for_your_diet-noprefs', out.length === 0,
      'no flags set → empty (screen renders inroad instead)', out);
  }

  // ---- friends_cook — friends_cooked_count > 0. Only r1 has count=2. ----
  {
    const out = resolveBrowse(RECIPES, MATCH_MAP, baseState({ context: 'friends_cook' })).map((r) => r.id);
    report('BROWSE-CTX-friends_cook', setEq(out, ['r1']),
      'r1 only (friends_cooked_count > 0)', out);
  }

  console.warn('[BROWSE-DONE]', 'Recipe browse resolver smoke tests complete.');
}
