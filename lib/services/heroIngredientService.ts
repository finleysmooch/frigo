// ============================================
// FRIGO — HERO INGREDIENT SERVICE (Phase 8R-UX5)
// ============================================
// Computes a "hero ingredient" signal from `recipe_ingredients.
// ingredient_classification = 'hero'`. Drives two UI surfaces in Pantry:
//
//   1. ⚡ inline marker before the name on Use Soon rows
//   2. A `⚡ Heroes N` pill in the inner family-pill strip on Everything +
//      Use Soon tabs (mutually exclusive with family pills)
//
// Hero qualification rules (an ingredient is a hero iff):
//   • user_library_hero_count >= USER_HERO_THRESHOLD, OR
//   • global_hero_appearances >= GLOBAL_MIN_APPEARANCES AND
//     global_hero_rate >= GLOBAL_HERO_RATE_THRESHOLD
//
// User-library scope: recipes.user_id = currentUser.id (same scope as
// useReadyToCookRecipes). Global scope: all recipe_ingredients rows.
//
// Thresholds are best-guess for F&F. Use AdminScreen → "Dump Hero
// Frequency Audit" to see what each threshold surfaces in practice; tune
// post-tester-data. See DEFERRED_WORK item "Hero ingredient thresholds —
// tune after F&F".
// ============================================

import { supabase } from '../supabase';

// ============================================
// TYPES
// ============================================

export interface HeroFrequencyData {
  userLibrary: Map<string, number>; // ingredient_id → hero count in user's library
  global: Map<string, { heroAppearances: number; totalAppearances: number }>;
}

export interface HeroAuditEntry {
  ingredientId: string;
  ingredientName: string;
  userHeroCount: number;
  globalHeroCount: number;
  globalTotalCount: number;
  globalHeroRate: number;
  qualifiesAsHero: boolean;
  qualifyReason: 'user_library' | 'global_rate' | 'neither';
}

export interface HeroAuditData {
  byUserLibrary: HeroAuditEntry[]; // top 30 by userHeroCount desc
  byGlobalRate: HeroAuditEntry[];  // top 30 by globalHeroRate desc (min 3 appearances)
  thresholds: {
    USER_HERO_THRESHOLD: number;
    GLOBAL_MIN_APPEARANCES: number;
    GLOBAL_HERO_RATE_THRESHOLD: number;
  };
}

// ============================================
// THRESHOLDS (single source of truth for tuning)
// ============================================

export const USER_HERO_THRESHOLD = 2;
export const GLOBAL_MIN_APPEARANCES = 3;
export const GLOBAL_HERO_RATE_THRESHOLD = 0.5;

// ============================================
// PUBLIC API
// ============================================

/**
 * Two queries:
 *   1. User library — recipe_ingredients where classification='hero' for
 *      recipes owned by the current user (recipes.user_id = auth.uid).
 *      Aggregated per ingredient_id.
 *   2. Global — all recipe_ingredients with classification='hero' (hero
 *      count) + all recipe_ingredients (total appearances) per ingredient.
 *      Total appearances becomes the denominator for the global rate.
 *
 * Returns both Maps always (never undefined). Empty Maps are fine —
 * isHeroIngredient handles missing-key lookups gracefully.
 */
export async function getHeroFrequency(_spaceId: string): Promise<HeroFrequencyData> {
  console.log('🎯 getHeroFrequency: loading hero frequency data');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('🎯 getHeroFrequency: no auth user — returning empty data');
    return { userLibrary: new Map(), global: new Map() };
  }

  // ---- Query 1: user library hero counts. ----
  // Uses a PostgREST inner-join filter so we don't have to first fetch all
  // recipe IDs and then pass them via `.in()` — Tom's library can be 600+
  // recipes, which blows past the URL-length budget for in-list filters
  // (Bad Request 400). The join restricts rows to recipes where
  // recipes.user_id matches the current user, all in one round-trip.
  const userLibrary = new Map<string, number>();
  const { data: userRi, error: userRiError } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_id, recipes!inner(user_id)')
    .eq('ingredient_classification', 'hero')
    .eq('recipes.user_id', user.id)
    .not('ingredient_id', 'is', null);
  if (userRiError) {
    console.error('❌ getHeroFrequency user-ri query:', userRiError);
    throw userRiError;
  }
  for (const row of (userRi ?? []) as Array<{ ingredient_id: string }>) {
    userLibrary.set(row.ingredient_id, (userLibrary.get(row.ingredient_id) ?? 0) + 1);
  }

  // ---- Query 2: global hero + total counts per ingredient. ----
  // Single query pulls all recipe_ingredients with non-null ingredient_id;
  // we tabulate both axes (hero count + total count) in one pass.
  const { data: globalRi, error: globalRiError } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_id, ingredient_classification')
    .not('ingredient_id', 'is', null);
  if (globalRiError) {
    console.error('❌ getHeroFrequency global-ri query:', globalRiError);
    throw globalRiError;
  }
  const global = new Map<string, { heroAppearances: number; totalAppearances: number }>();
  for (const row of (globalRi ?? []) as Array<{
    ingredient_id: string;
    ingredient_classification: string | null;
  }>) {
    const entry = global.get(row.ingredient_id) ?? {
      heroAppearances: 0,
      totalAppearances: 0,
    };
    entry.totalAppearances++;
    if (row.ingredient_classification === 'hero') entry.heroAppearances++;
    global.set(row.ingredient_id, entry);
  }

  console.log('🎯 getHeroFrequency: loaded', {
    userLibrarySize: userLibrary.size,
    globalSize: global.size,
  });
  return { userLibrary, global };
}

/**
 * Synchronous qualification check given pre-loaded frequency data.
 * Returns false for null/missing/empty inputs — safe to call before
 * heroFrequencyData has loaded.
 */
export function isHeroIngredient(
  ingredientId: string | null,
  data: HeroFrequencyData | null
): boolean {
  if (!ingredientId || !data) return false;
  const userCount = data.userLibrary.get(ingredientId) ?? 0;
  if (userCount >= USER_HERO_THRESHOLD) return true;
  const g = data.global.get(ingredientId);
  if (!g) return false;
  if (g.heroAppearances < GLOBAL_MIN_APPEARANCES) return false;
  return g.heroAppearances / g.totalAppearances >= GLOBAL_HERO_RATE_THRESHOLD;
}

/**
 * Self-documenting audit dump for AdminScreen. Returns top 30 per axis
 * plus the threshold constants used at decision time, so a future tuner
 * can see exactly what would qualify under different settings.
 */
export async function getHeroFrequencyAudit(spaceId: string): Promise<HeroAuditData> {
  const freq = await getHeroFrequency(spaceId);

  // Pull ingredient names for everything that has any signal.
  const idsWithSignal = new Set<string>([
    ...freq.userLibrary.keys(),
    ...freq.global.keys(),
  ]);
  const idArray = Array.from(idsWithSignal);
  const nameMap = new Map<string, string>();
  if (idArray.length > 0) {
    const { data: ingRows, error } = await supabase
      .from('ingredients')
      .select('id, name')
      .in('id', idArray);
    if (error) {
      console.error('❌ getHeroFrequencyAudit ingredients query:', error);
      throw error;
    }
    for (const row of (ingRows ?? []) as Array<{ id: string; name: string }>) {
      nameMap.set(row.id, row.name);
    }
  }

  const allEntries: HeroAuditEntry[] = Array.from(idsWithSignal).map((id) => {
    const userHeroCount = freq.userLibrary.get(id) ?? 0;
    const g = freq.global.get(id) ?? { heroAppearances: 0, totalAppearances: 0 };
    const globalHeroRate =
      g.totalAppearances > 0 ? g.heroAppearances / g.totalAppearances : 0;
    const userQualifies = userHeroCount >= USER_HERO_THRESHOLD;
    const globalQualifies =
      g.heroAppearances >= GLOBAL_MIN_APPEARANCES &&
      globalHeroRate >= GLOBAL_HERO_RATE_THRESHOLD;
    const qualifyReason: HeroAuditEntry['qualifyReason'] = userQualifies
      ? 'user_library'
      : globalQualifies
      ? 'global_rate'
      : 'neither';
    return {
      ingredientId: id,
      ingredientName: nameMap.get(id) ?? '(unknown)',
      userHeroCount,
      globalHeroCount: g.heroAppearances,
      globalTotalCount: g.totalAppearances,
      globalHeroRate,
      qualifiesAsHero: userQualifies || globalQualifies,
      qualifyReason,
    };
  });

  const byUserLibrary = [...allEntries]
    .filter((e) => e.userHeroCount > 0)
    .sort((a, b) => b.userHeroCount - a.userHeroCount)
    .slice(0, 30);
  const byGlobalRate = [...allEntries]
    .filter((e) => e.globalTotalCount >= GLOBAL_MIN_APPEARANCES)
    .sort((a, b) => b.globalHeroRate - a.globalHeroRate)
    .slice(0, 30);

  return {
    byUserLibrary,
    byGlobalRate,
    thresholds: {
      USER_HERO_THRESHOLD,
      GLOBAL_MIN_APPEARANCES,
      GLOBAL_HERO_RATE_THRESHOLD,
    },
  };
}
