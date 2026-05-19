// ============================================
// FRIGO — PANTRY MATCHING SERVICE (Phase 8D-CP1 → CP2)
// ============================================
// Recipe ↔ supply matching primitive. Computes a 4-level match for every
// recipe ingredient against the active space's supplies:
//   L1 exact         — same ingredient row, or linked via base_ingredient_id
//   L2 form_variant  — same ingredient_subtype, different form
//   L3 substitute    — same ingredient_subtype, same form
//   L4 no match      — different / non-overlapping subtype  (→ missing[])
//
// `ingredient_subtype = 'always_available'` (water, ice) is treated as L1 with
// no supply lookup at all (T22). UI renders it identically to L1 exact.
//
// CP2 resolves T20 (4-level refactor) + T22 (always_available skip). The
// subtype + form data scaffolding shipped in CP1.5 and was finalized in the
// 2026-05-19 planning Part 0 (Produce herb forms, dried_chile forms,
// spice_blend subtype split).
//
// Fixed 3-query bulk design (preserved from CP1):
//   1. recipe_ingredients (+ embedded ingredient metadata)
//   2. supplies — every active supply in the space
//   3. ingredients — catalog metadata for recipe-ingredient families + every
//      supply's ingredient_id
// All 4-level logic runs in the in-memory assembly loop.
//
// Consumers: RecipeDetailScreen (single), RecipeListScreen (bulk).
// ============================================

import { supabase } from '../supabase';
import { SupplyStatus } from '../types/supplies';

/**
 * Subtypes where L2 (form_variant) and L3 (substitute) matches are surfaced
 * to users. For subtypes NOT in this set, the matcher demotes same-subtype
 * matches to L4 (missing).
 *
 * Rationale: the catalog's `ingredient_subtype` system was designed under
 * D8D-Q1 "soft-match category" semantics — it encodes loose family
 * relationship, not substitutability. Roughly half the multi-member
 * subtypes (mustard, syrup, sugar, etc.) ARE substitution-valid; the other
 * half (cheese, fish, leafy_green, etc.) are too coarse to surface as
 * substitutes without producing wrong/confusing signals.
 *
 * Curated 2026-05-19 by Tom against full catalog discovery (113 multi-
 * member subtypes). See `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` for
 * assumptions, gaps, and post-F&F audit plan.
 *
 * Adding to this set is safe (more substitutions surface). Removing requires
 * verification that no current F&F user relies on a specific behavior.
 */
export const SUBSTITUTABLE_SUBTYPES: ReadonlySet<string> = new Set([
  // Core cooking staples
  'mustard', 'stock', 'syrup', 'sugar', 'rice', 'vinegar', 'salt',
  'neutral_oil', 'butter', 'cream',

  // Fruits/vegetables with valid cross-substitution
  'bell_pepper', 'stone_fruit', 'berry', 'dried_fruit', 'pome_fruit',
  'potato', 'winter_squash', 'pickled_pepper',

  // Carbs / grains / pasta
  'pasta', 'whole_grain', 'oats', 'cornmeal',

  // Pantry depth
  'nut_butter', 'soy_sauce', 'fortified_wine', 'preserves', 'yeast',
  'coffee', 'paprika',

  // Form-variant-heavy multi-row subtypes
  'pepper', 'oregano', 'thyme', 'basil', 'clove', 'nutmeg',
  'ginger_spice', 'rosemary', 'parsley',

  // Singular/plural and minor variants (n=2 form pairs)
  'almond', 'bay_leaf', 'brussels_sprouts', 'caraway', 'cashew',
  'cayenne', 'chia_seed', 'coriander', 'dough', 'fenugreek', 'fig',
  'flax_seed', 'green_beans', 'ice_cream', 'leavening', 'mayonnaise',
  'miso', 'olive_oil', 'pecan', 'pickle', 'pumpkin_seed', 'seaweed',
  'sesame_seeds', 'sprout', 'summer_squash', 'sunflower_seed',
  'sweet_potato', 'thickener', 'vanilla', 'walnut', 'dried_lime',
  'bbq_sauce', 'peanut',
]);

// ============================================
// TYPES
// ============================================

export type MatchLevel = 'exact' | 'form_variant' | 'substitute' | 'always_available';

export interface MatchedIngredient {
  ingredientId: string;          // the recipe ingredient_id that matched
  supplyId: string | null;       // null only when level='always_available'
  level: MatchLevel;
  formMismatch: {                // populated for L2 form_variant; null otherwise
    recipeForm: string | null;
    supplyForm: string | null;
  } | null;
  reason: string;                // short, UI-facing string
  // 8D-CP3: status of the satisfying supply (in_stock / low / critical). null
  // for always_available (no supply). Powers the tap-sheet's matched_in_stock
  // vs matched_low/critical state distinction. Additive — populated from the
  // existing Query-2 supply rows, no extra query.
  supplyStatus: SupplyStatus | null;
}

export interface PantryMatchResult {
  recipeId: string;
  matchPercentage: number;       // 0.0-1.0; L1+L2+L3+always_available in numerator
  matched: MatchedIngredient[];  // all non-L4 entries
  missing: string[];             // L4 recipe ingredient_ids only
  totalCount: number;            // ALL distinct recipe ingredients (incl. always_available)
  matchedCount: number;          // matched.length
}

// ============================================
// INTERNAL SHAPES
// ============================================

// The slice of an `ingredients` row the matcher needs.
interface IngredientMeta {
  id: string;
  base_ingredient_id: string | null;
  is_base_ingredient: boolean;
  form: string | null;
  ingredient_subtype: string | null;
  name: string;
}

// A supply row, post-filter (archived + unknown already excluded by the query).
interface SupplyRow {
  id: string;
  ingredient_id: string;
  status: SupplyStatus;
  created_at: string;
}

const ALWAYS_AVAILABLE = 'always_available';

// The "base" id that anchors an ingredient's variant family. For a base
// ingredient this is its own id; for a variant it is its base_ingredient_id;
// for an orphan (no linkage) it is its own id.
function resolveBaseId(m: IngredientMeta): string {
  if (m.is_base_ingredient) return m.id;
  return m.base_ingredient_id ?? m.id;
}

// Form comparison rules (CP2 C-rule). forms_equal: both null → true; both
// non-null and equal → true; otherwise false. forms_differ is its negation —
// so (one null, other not) counts as a form difference (→ L2).
function formsEqual(a: string | null, b: string | null): boolean {
  if (a === null && b === null) return true;
  if (a !== null && b !== null) return a === b;
  return false;
}

// Deterministic best-supply pick: most recently added supply wins
// (supplies.created_at DESC), id as a stable tie-breaker. `last_acquired_at`
// is not a column on `supplies` — the per-lot timestamp lives on supply_lots.
function pickBestSupply(candidates: SupplyRow[]): SupplyRow {
  return [...candidates].sort((a, b) => {
    const c = b.created_at.localeCompare(a.created_at);
    return c !== 0 ? c : a.id.localeCompare(b.id);
  })[0];
}

function emptyResult(recipeId: string): PantryMatchResult {
  return {
    recipeId,
    matchPercentage: 0,
    matched: [],
    missing: [],
    totalCount: 0,
    matchedCount: 0,
  };
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Match a single recipe's ingredients against the active space's supplies.
 * Delegates to the bulk path so the algorithm lives in one place. Always
 * resolves to a result (never throws for an unknown/empty recipe).
 */
export async function calculateRecipeSupplyMatch(
  recipeId: string,
  spaceId: string
): Promise<PantryMatchResult> {
  console.log('🔍 calculateRecipeSupplyMatch:', { recipeId, spaceId });
  const map = await calculateRecipeSupplyMatchBulk([recipeId], spaceId);
  return map.get(recipeId) ?? emptyResult(recipeId);
}

/**
 * Bulk match N recipes in a fixed 3 Supabase round-trips. The returned Map
 * always has an entry for every id in `recipeIds`.
 */
export async function calculateRecipeSupplyMatchBulk(
  recipeIds: string[],
  spaceId: string
): Promise<Map<string, PantryMatchResult>> {
  console.log('🔍 calculateRecipeSupplyMatchBulk:', {
    recipeCount: recipeIds.length,
    spaceId,
  });

  const resultMap = new Map<string, PantryMatchResult>();
  for (const id of recipeIds) {
    resultMap.set(id, emptyResult(id));
  }
  if (recipeIds.length === 0) return resultMap;

  try {
    // ---- Query 1: recipe_ingredients + embedded ingredient metadata. ----
    const { data: riData, error: riError } = await supabase
      .from('recipe_ingredients')
      .select(
        'recipe_id, ingredient_id, ingredient:ingredients(id, base_ingredient_id, is_base_ingredient, form, ingredient_subtype, name)'
      )
      .in('recipe_id', recipeIds);

    if (riError) {
      console.error('❌ Error loading recipe_ingredients for matching:', riError);
      throw riError;
    }

    // Per recipe → distinct ingredient_id → metadata. Free-text rows
    // (null ingredient_id) are excluded — they cannot be catalog-matched and
    // do not count toward totalCount. Distinct ingredient_ids only.
    const recipeIngredients = new Map<string, Map<string, IngredientMeta>>();
    const universe = new Map<string, IngredientMeta>();

    for (const row of (riData ?? []) as Array<{
      recipe_id: string;
      ingredient_id: string | null;
      ingredient: IngredientMeta | null;
    }>) {
      if (!row.ingredient_id || !row.ingredient) continue;
      const meta = row.ingredient;
      let perRecipe = recipeIngredients.get(row.recipe_id);
      if (!perRecipe) {
        perRecipe = new Map<string, IngredientMeta>();
        recipeIngredients.set(row.recipe_id, perRecipe);
      }
      perRecipe.set(meta.id, meta);
      universe.set(meta.id, meta);
    }

    if (universe.size === 0) {
      return resultMap; // no catalogued recipe ingredients in the batch
    }

    // ---- Query 2: every active supply in the space. ----
    // CP2 Task 2.5 — option (b): no ingredient_id IN filter. The match
    // universe no longer covers L2/L3 candidates (separate bases linked only
    // by shared subtype), so we fetch all active supplies and filter in
    // memory. At F&F scale (~200 supplies/space) this is a single ~200-row
    // round-trip. Subtype-aware IN expansion is a post-F&F tunable (T26).
    const { data: supData, error: supError } = await supabase
      .from('supplies')
      .select('id, ingredient_id, status, created_at')
      .eq('space_id', spaceId)
      .is('archived_at', null)
      .neq('status', 'unknown')
      .not('ingredient_id', 'is', null);

    if (supError) {
      console.error('❌ Error loading supplies for matching:', supError);
      throw supError;
    }

    const supplies = (supData ?? []) as SupplyRow[];
    const supplyIngredientIds = new Set<string>();
    for (const s of supplies) {
      if (s.ingredient_id) supplyIngredientIds.add(s.ingredient_id);
    }

    // ---- Query 3: catalog metadata. ----
    // Fetches: (a) the recipe ingredients' variant families (base + variants),
    // and (b) every supply's ingredient row — so L2/L3 can read each supply's
    // subtype/form/name. `id IN (bases ∪ supplyIngredientIds)` ∪
    // `base_ingredient_id IN bases`.
    const baseIds = new Set<string>();
    for (const meta of universe.values()) {
      baseIds.add(resolveBaseId(meta));
    }
    const idInList = [...new Set([...baseIds, ...supplyIngredientIds])];
    const baseIdList = [...baseIds];

    const catalogById = new Map<string, IngredientMeta>();
    if (idInList.length > 0) {
      const { data: famData, error: famError } = await supabase
        .from('ingredients')
        .select('id, base_ingredient_id, is_base_ingredient, form, ingredient_subtype, name')
        .or(
          `id.in.(${idInList.join(',')}),base_ingredient_id.in.(${baseIdList.join(',')})`
        );

      if (famError) {
        console.error('❌ Error loading ingredient catalog for matching:', famError);
        throw famError;
      }
      for (const meta of (famData ?? []) as IngredientMeta[]) {
        catalogById.set(meta.id, meta);
      }
    }

    // Group catalog rows by base id → variant families (L1 match groups).
    const familyByBase = new Map<string, IngredientMeta[]>();
    for (const meta of catalogById.values()) {
      const base = resolveBaseId(meta);
      const arr = familyByBase.get(base);
      if (arr) arr.push(meta);
      else familyByBase.set(base, [meta]);
    }

    // Per recipe ingredient, its L1 match group (list of ingredient_ids).
    const matchGroups = new Map<string, string[]>();
    for (const meta of universe.values()) {
      const base = resolveBaseId(meta);
      const family = familyByBase.get(base);
      matchGroups.set(
        meta.id,
        family && family.length > 0 ? family.map((f) => f.id) : [meta.id]
      );
    }

    // Index supplies by ingredient_id (for L1) and by subtype (for L2/L3).
    const suppliesByIngredient = new Map<string, SupplyRow[]>();
    const suppliesBySubtype = new Map<string, SupplyRow[]>();
    for (const sup of supplies) {
      const byIng = suppliesByIngredient.get(sup.ingredient_id);
      if (byIng) byIng.push(sup);
      else suppliesByIngredient.set(sup.ingredient_id, [sup]);

      const subtype = catalogById.get(sup.ingredient_id)?.ingredient_subtype;
      if (subtype) {
        const bySub = suppliesBySubtype.get(subtype);
        if (bySub) bySub.push(sup);
        else suppliesBySubtype.set(subtype, [sup]);
      }
    }

    // ---- Assemble per-recipe results in memory. ----
    for (const recipeId of recipeIds) {
      const perRecipe = recipeIngredients.get(recipeId);
      if (!perRecipe || perRecipe.size === 0) continue; // stays at empty seed

      const matched: MatchedIngredient[] = [];
      const missing: string[] = [];

      for (const meta of perRecipe.values()) {
        // ---- Step 0: always_available skip (FIRST). ----
        if (meta.ingredient_subtype === ALWAYS_AVAILABLE) {
          matched.push({
            ingredientId: meta.id,
            supplyId: null,
            level: 'always_available',
            formMismatch: null,
            reason: 'Always available',
            supplyStatus: null,
          });
          continue;
        }

        // ---- Step 1: L1 exact via the variant match group. ----
        const group = matchGroups.get(meta.id) ?? [meta.id];
        let l1Hit: SupplyRow | null = null;
        for (const gid of group) {
          const sups = suppliesByIngredient.get(gid);
          if (!sups) continue;
          const hit = sups.find((s) => s.status !== 'out');
          if (hit) {
            l1Hit = hit;
            break;
          }
        }
        if (l1Hit) {
          const supplyForm = catalogById.get(l1Hit.ingredient_id)?.form ?? null;
          const formMismatch =
            meta.form && supplyForm && meta.form !== supplyForm
              ? { recipeForm: meta.form, supplyForm }
              : null;
          matched.push({
            ingredientId: meta.id,
            supplyId: l1Hit.id,
            level: 'exact',
            formMismatch,
            reason: 'You have it',
            supplyStatus: l1Hit.status,
          });
          continue;
        }

        // ---- Step 2: subtype-based L2 / L3 (whitelist-gated). ----
        // The subtype must be in SUBSTITUTABLE_SUBTYPES — otherwise the
        // grouping is too coarse to surface as a substitute (cheese, fish,
        // tropical_fruit, etc.) and the ingredient demotes straight to L4.
        // A null subtype (defensive — should not happen post-CP1.5) also
        // demotes.
        if (
          !meta.ingredient_subtype ||
          !SUBSTITUTABLE_SUBTYPES.has(meta.ingredient_subtype)
        ) {
          missing.push(meta.id);
          continue;
        }

        const subtypeCandidates = (
          suppliesBySubtype.get(meta.ingredient_subtype) ?? []
        ).filter((s) => s.status !== 'out');

        if (subtypeCandidates.length === 0) {
          missing.push(meta.id);
          continue;
        }

        // Null-form wildcard: within a whitelisted subtype, if the recipe
        // side OR any candidate has a null form, the form axis is
        // uninformative — treat the best candidate as a silent L1 exact
        // rather than emitting confusing "different form" copy on generic-
        // base rows (sugar, vinegar, citrus whole fruits).
        const nullFormWildcard =
          meta.form === null ||
          subtypeCandidates.some(
            (s) => (catalogById.get(s.ingredient_id)?.form ?? null) === null
          );
        if (nullFormWildcard) {
          const best = pickBestSupply(subtypeCandidates);
          matched.push({
            ingredientId: meta.id,
            supplyId: best.id,
            level: 'exact',
            formMismatch: null,
            reason: 'You have it',
            supplyStatus: best.status,
          });
          continue;
        }

        // L2 — same subtype, different form.
        const l2 = subtypeCandidates.filter(
          (s) => !formsEqual(meta.form, catalogById.get(s.ingredient_id)?.form ?? null)
        );
        if (l2.length > 0) {
          const best = pickBestSupply(l2);
          const supplyForm = catalogById.get(best.ingredient_id)?.form ?? null;
          matched.push({
            ingredientId: meta.id,
            supplyId: best.id,
            level: 'form_variant',
            formMismatch: { recipeForm: meta.form, supplyForm },
            reason: `You have ${supplyForm ?? 'a different form'}; recipe wants ${
              meta.form ?? 'a different form'
            }`,
            supplyStatus: best.status,
          });
          continue;
        }

        // L3 — same subtype, same form.
        const l3 = subtypeCandidates.filter((s) =>
          formsEqual(meta.form, catalogById.get(s.ingredient_id)?.form ?? null)
        );
        if (l3.length > 0) {
          const best = pickBestSupply(l3);
          const supplyName = catalogById.get(best.ingredient_id)?.name ?? 'a similar ingredient';
          matched.push({
            ingredientId: meta.id,
            supplyId: best.id,
            level: 'substitute',
            formMismatch: null,
            reason: `Close: you have ${supplyName}`,
            supplyStatus: best.status,
          });
          continue;
        }

        // ---- L4 — no match. ----
        missing.push(meta.id);
      }

      const totalCount = perRecipe.size;
      const matchedCount = matched.length;
      resultMap.set(recipeId, {
        recipeId,
        matchPercentage: totalCount > 0 ? matchedCount / totalCount : 0,
        matched,
        missing,
        totalCount,
        matchedCount,
      });
    }

    return resultMap;
  } catch (error) {
    console.error('❌ calculateRecipeSupplyMatchBulk failed:', error);
    throw error;
  }
}
