// TEMP — remove after 8D-CP3 ships.
// ============================================
// FRIGO — PANTRY MATCHING SMOKE TEST (Phase 8D-CP1 Part 3 — v2 RLS-friendly)
// ============================================
// Discovery-based harness: looks up real catalog ingredients by name, then
// creates user-scoped synthetic recipes + supplies that reference them. Tests
// the real catalog substrate (base_ingredient_id linkage, form values, cheese
// cleanup outcome) rather than fabricating synthetic catalog rows. The
// catalog table is read-only at the RLS layer; only user-scoped rows are
// written or deleted.
//
// Trigger: AdminScreen → "Run pantry matching smoke tests" button. Results
// land in the Metro/React Native debugger console as [SMOKE-N] lines.
//
// If a scenario's required catalog ingredient is absent, that scenario logs
// `SETUP-FAIL` and the run continues. This makes the harness a catalog-
// integrity check as well as an algorithm test: failures point at specific
// substrate gaps (missing variant, missing form value, etc.).
//
// Every user-scoped row is `__smoke8d_`-prefixed for identifiability +
// teardown.
// ============================================

import { supabase } from '../supabase';
import {
  calculateRecipeSupplyMatch,
  calculateRecipeSupplyMatchBulk,
} from './pantryMatchingService';
import type { PantryMatchResult } from './pantryMatchingService';
import { isReadyToCook, filterReadyToCook } from './readyToCookService';

const PREFIX = '__smoke8d_';

// ============================================
// TYPES
// ============================================

interface IngredientMeta {
  id: string;
  name: string;
  base_ingredient_id: string | null;
  is_base_ingredient: boolean;
  form: string | null;
}

interface Tracked {
  recipeIds: string[];
  supplyIds: string[];
}

// ============================================
// LOGGING
// ============================================

function report(label: string, pass: boolean, expected: string, result: unknown): void {
  console.warn(`[${label}]`, pass ? '✅ PASS' : '❌ FAIL', { result, expected });
}

function setupFail(label: string, err: unknown): void {
  console.warn(`[${label}]`, '⚠️ SETUP-FAIL', err);
}

function skipMissing(label: string, what: string): void {
  console.warn(`[${label}]`, '⏭ SKIPPED — missing catalog ingredient:', what);
}

// ============================================
// DISCOVERY
// ============================================

async function findIngredient(name: string): Promise<IngredientMeta | null> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, base_ingredient_id, is_base_ingredient, form')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[SMOKE-DISCOVER]', '⚠️ discover error for', name, error);
    return null;
  }
  return (data as IngredientMeta | null) ?? null;
}

// ============================================
// USER-SCOPED CREATE HELPERS
// ============================================

async function makeRecipe(t: Tracked, userId: string, label: string): Promise<string> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({ title: PREFIX + label, user_id: userId, ingredients: [] })
    .select('id')
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  t.recipeIds.push(id);
  return id;
}

async function addRecipeIngredient(
  recipeId: string,
  ingredientId: string,
  seq: number
): Promise<void> {
  const { error } = await supabase.from('recipe_ingredients').insert({
    recipe_id: recipeId,
    ingredient_id: ingredientId,
    original_text: PREFIX + 'ing' + seq,
    sequence_order: seq,
    needs_review: false,
  });
  if (error) throw error;
}

async function makeSupply(
  t: Tracked,
  spaceId: string,
  userId: string,
  opts: {
    ingredientId?: string | null;
    customName?: string | null;
    status: string;
    archived?: boolean;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('supplies')
    .insert({
      space_id: spaceId,
      ingredient_id: opts.ingredientId ?? null,
      custom_name: opts.customName ?? null,
      status: opts.status,
      for_user_ids: [],
      brands: [],
      added_by: userId,
      notes: null,
      tracking_mode: 'restock',
      storage_location: null,
      is_priority: false,
      usage_level: 3,
      archived_at: opts.archived ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  t.supplyIds.push(id);
  return id;
}

async function deleteSupplies(t: Tracked, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from('supplies').delete().in('id', ids);
  t.supplyIds = t.supplyIds.filter((id) => !ids.includes(id));
}

// ============================================
// PRE-CLEAN + TEARDOWN (user-scoped only — never touches catalog)
// ============================================

async function preClean(spaceId: string): Promise<void> {
  try {
    const { data: staleRecipes } = await supabase
      .from('recipes')
      .select('id')
      .like('title', `${PREFIX}%`);
    const recipeIds = (staleRecipes ?? []).map((r) => (r as { id: string }).id);
    if (recipeIds.length > 0) {
      await supabase.from('recipe_ingredients').delete().in('recipe_id', recipeIds);
      await supabase.from('recipes').delete().in('id', recipeIds);
    }
    // User-scoped supply cleanup: any __smoke8d_ custom_name supplies in this
    // space. Real-ingredient supplies created by past runs would also need
    // cleanup but can't be filtered by prefix alone — teardown's finally
    // block is the primary defense.
    await supabase
      .from('supplies')
      .delete()
      .eq('space_id', spaceId)
      .like('custom_name', `${PREFIX}%`);
  } catch (err) {
    console.warn('[SMOKE-PRECLEAN]', '⚠️ pre-clean issue (non-fatal)', err);
  }
}

async function teardown(t: Tracked): Promise<void> {
  try {
    if (t.supplyIds.length > 0) {
      await supabase.from('supplies').delete().in('id', t.supplyIds);
    }
    if (t.recipeIds.length > 0) {
      await supabase.from('recipe_ingredients').delete().in('recipe_id', t.recipeIds);
      await supabase.from('recipes').delete().in('id', t.recipeIds);
    }
    console.warn('[SMOKE-TEARDOWN]', '✅ test data removed');
  } catch (err) {
    console.warn(
      '[SMOKE-TEARDOWN]',
      '⚠️ teardown issue — check for __smoke8d_ orphans',
      err
    );
  }
}

// ============================================
// RUNNER
// ============================================

export async function runPantryMatchingSmokeTests(spaceId: string): Promise<void> {
  console.warn('[SMOKE-START]', 'Pantry matching smoke tests v2 — space:', spaceId);

  if (!spaceId) {
    console.warn('[SMOKE-START]', '⚠️ no active space — aborting');
    return;
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    console.warn('[SMOKE-START]', '⚠️ no authenticated user — aborting');
    return;
  }

  await preClean(spaceId);

  const t: Tracked = { recipeIds: [], supplyIds: [] };

  try {
    // ---- CATALOG-INTEGRITY: post-cleanup orphan check. ----
    // The cheese cleanup migration (Part 0) deleted 6 orphan rows. Confirm
    // "feta cheese" no longer exists as a separate ingredient.
    try {
      const orphan = await findIngredient('feta cheese');
      report(
        'SMOKE-CATALOG-cheese-cleanup',
        orphan === null,
        '"feta cheese" not present (cleanup verified)',
        orphan
      );
    } catch (e) {
      setupFail('SMOKE-CATALOG-cheese-cleanup', e);
    }

    // ---- CATALOG-INTEGRITY: variant linkage check. ----
    // Verifies the EVOO → olive oil base_ingredient_id linkage from CP6e.
    try {
      const evoo = await findIngredient('extra-virgin olive oil');
      const oliveOil = await findIngredient('olive oil');
      const pass =
        !!evoo &&
        !!oliveOil &&
        (evoo.base_ingredient_id === oliveOil.id || evoo.id === oliveOil.id);
      report(
        'SMOKE-CATALOG-evoo-linkage',
        pass,
        'EVOO.base_ingredient_id === oliveOil.id',
        { evoo, oliveOil }
      );
    } catch (e) {
      setupFail('SMOKE-CATALOG-evoo-linkage', e);
    }

    // ---- SMOKE-1: exact base match. Recipe references olive oil; supply is olive oil. ----
    {
      const oliveOil = await findIngredient('olive oil');
      if (!oliveOil) {
        skipMissing('SMOKE-1', 'olive oil');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'recipe-1');
          await addRecipeIngredient(recipe, oliveOil.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: oliveOil.id,
              status: 'in_stock',
            })
          );
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass = r.matched.some((m) => m.ingredientId === oliveOil.id);
          report('SMOKE-1', pass, 'olive oil in matched[] (exact base)', r);
        } catch (e) {
          setupFail('SMOKE-1', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-2: variant forward (recipe=EVOO, supply=olive oil). ----
    {
      const evoo = await findIngredient('extra-virgin olive oil');
      const oliveOil = await findIngredient('olive oil');
      if (!evoo || !oliveOil) {
        skipMissing('SMOKE-2', 'extra-virgin olive oil or olive oil');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'recipe-2');
          await addRecipeIngredient(recipe, evoo.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: oliveOil.id,
              status: 'in_stock',
            })
          );
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass = r.matched.some((m) => m.ingredientId === evoo.id);
          report('SMOKE-2', pass, 'EVOO matched via base traversal', r);
        } catch (e) {
          setupFail('SMOKE-2', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-3: variant reverse (recipe=olive oil base, supply=EVOO variant). ----
    {
      const evoo = await findIngredient('extra-virgin olive oil');
      const oliveOil = await findIngredient('olive oil');
      if (!evoo || !oliveOil) {
        skipMissing('SMOKE-3', 'extra-virgin olive oil or olive oil');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'recipe-3');
          await addRecipeIngredient(recipe, oliveOil.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: evoo.id,
              status: 'in_stock',
            })
          );
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass = r.matched.some((m) => m.ingredientId === oliveOil.id);
          report('SMOKE-3', pass, 'olive oil matched via reverse traversal', r);
        } catch (e) {
          setupFail('SMOKE-3', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-4: vinegar tree (recipe=WWV, supply=vinegar base — SF-5 promotion). ----
    {
      const wwv = await findIngredient('white wine vinegar');
      const vinegar = await findIngredient('vinegar');
      if (!wwv || !vinegar) {
        skipMissing('SMOKE-4', 'white wine vinegar or vinegar');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'recipe-4');
          await addRecipeIngredient(recipe, wwv.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: vinegar.id,
              status: 'in_stock',
            })
          );
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass = r.matched.some((m) => m.ingredientId === wwv.id);
          report('SMOKE-4', pass, 'WWV matched (SF-5 vinegar promotion)', r);
        } catch (e) {
          setupFail('SMOKE-4', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-5: cheese post-cleanup. Recipe needs feta canonical; supply is feta. ----
    {
      const feta = await findIngredient('feta');
      if (!feta) {
        skipMissing('SMOKE-5', 'feta');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'recipe-5');
          await addRecipeIngredient(recipe, feta.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: feta.id,
              status: 'in_stock',
            })
          );
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass = r.matched.some((m) => m.ingredientId === feta.id);
          report('SMOKE-5', pass, 'feta canonical matches (post-cleanup)', r);
        } catch (e) {
          setupFail('SMOKE-5', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-6: salt variant match (recipe=kosher salt, supply=salt in_stock). ----
    {
      const kosherSalt = await findIngredient('kosher salt');
      const salt = await findIngredient('salt');
      if (!kosherSalt || !salt) {
        skipMissing('SMOKE-6', 'kosher salt or salt');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'recipe-6');
          await addRecipeIngredient(recipe, kosherSalt.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: salt.id,
              status: 'in_stock',
            })
          );
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass = r.matched.some((m) => m.ingredientId === kosherSalt.id);
          report('SMOKE-6', pass, 'kosher salt matched via salt base', r);
        } catch (e) {
          setupFail('SMOKE-6', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-7..10: salt status states. ----
    const saltStatusScenarios: Array<{
      n: string;
      status: 'out' | 'low' | 'critical' | 'unknown';
      archived: boolean;
      expectMatch: boolean;
      desc: string;
    }> = [
      { n: '7', status: 'out', archived: false, expectMatch: false, desc: 'status=out → missing' },
      { n: '8', status: 'low', archived: false, expectMatch: true, desc: 'status=low → matched' },
      { n: '9', status: 'critical', archived: false, expectMatch: true, desc: 'status=critical → matched' },
      { n: '10', status: 'unknown', archived: false, expectMatch: false, desc: 'status=unknown → missing' },
    ];
    for (const sc of saltStatusScenarios) {
      const salt = await findIngredient('salt');
      if (!salt) {
        skipMissing(`SMOKE-${sc.n}`, 'salt');
        continue;
      }
      const local: string[] = [];
      try {
        const recipe = await makeRecipe(t, userId, `recipe-${sc.n}`);
        await addRecipeIngredient(recipe, salt.id, 1);
        local.push(
          await makeSupply(t, spaceId, userId, {
            ingredientId: salt.id,
            status: sc.status,
            archived: sc.archived,
          })
        );
        const r = await calculateRecipeSupplyMatch(recipe, spaceId);
        const isMatched = r.matched.some((m) => m.ingredientId === salt.id);
        const isMissing = r.missing.includes(salt.id);
        const pass = sc.expectMatch ? isMatched : isMissing && !isMatched;
        report(`SMOKE-${sc.n}`, pass, sc.desc, r);
      } catch (e) {
        setupFail(`SMOKE-${sc.n}`, e);
      }
      await deleteSupplies(t, local);
    }

    // ---- SMOKE-11: archived supply (status=in_stock but archived) → missing. ----
    {
      const salt = await findIngredient('salt');
      if (!salt) {
        skipMissing('SMOKE-11', 'salt');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'recipe-11');
          await addRecipeIngredient(recipe, salt.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: salt.id,
              status: 'in_stock',
              archived: true,
            })
          );
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass =
            r.missing.includes(salt.id) && !r.matched.some((m) => m.ingredientId === salt.id);
          report('SMOKE-11', pass, 'archived supply excluded → missing', r);
        } catch (e) {
          setupFail('SMOKE-11', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-12: form mismatch (recipe=dried basil, supply=fresh basil). ----
    {
      const basilDried = await findIngredient('dried basil');
      const basilFresh = await findIngredient('fresh basil');
      if (!basilDried || !basilFresh) {
        skipMissing('SMOKE-12', 'dried basil or fresh basil');
      } else if (!basilDried.form || !basilFresh.form) {
        skipMissing(
          'SMOKE-12',
          `form values: dried.form=${basilDried.form}, fresh.form=${basilFresh.form}`
        );
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'recipe-12');
          await addRecipeIngredient(recipe, basilDried.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: basilFresh.id,
              status: 'in_stock',
            })
          );
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const hit = r.matched.find((m) => m.ingredientId === basilDried.id);
          const pass =
            !!hit &&
            !!hit.formMismatch &&
            hit.formMismatch.recipeForm === basilDried.form &&
            hit.formMismatch.supplyForm === basilFresh.form;
          report(
            'SMOKE-12',
            pass,
            `dried basil matched w/ formMismatch{${basilDried.form},${basilFresh.form}}`,
            r
          );
        } catch (e) {
          setupFail('SMOKE-12', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-13: custom-name supply never matches a recipe ingredient. ----
    {
      const oliveOil = await findIngredient('olive oil');
      if (!oliveOil) {
        skipMissing('SMOKE-13', 'olive oil');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'recipe-13');
          await addRecipeIngredient(recipe, oliveOil.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: oliveOil.id,
              status: 'in_stock',
            })
          );
          const customId = await makeSupply(t, spaceId, userId, {
            ingredientId: null,
            customName: PREFIX + 'Motor City',
            status: 'in_stock',
          });
          local.push(customId);
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass = r.matched.every((m) => m.supplyId !== customId);
          report('SMOKE-13', pass, 'custom-name supply not in matched[]', r);
        } catch (e) {
          setupFail('SMOKE-13', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- EDGE: zero-ingredient recipe + ghost recipe id. ----
    try {
      const emptyRecipe = await makeRecipe(t, userId, 'recipe-empty');
      const empty = await calculateRecipeSupplyMatch(emptyRecipe, spaceId);
      const passEmpty =
        empty.matchPercentage === 0 && empty.totalCount === 0 && empty.matchedCount === 0;
      report('SMOKE-EDGE-empty', passEmpty, 'zero-ingredient recipe → 0/0', empty);

      const ghost = await calculateRecipeSupplyMatch(
        '00000000-0000-0000-0000-000000000000',
        spaceId
      );
      const passGhost = ghost.matchPercentage === 0 && ghost.totalCount === 0;
      report('SMOKE-EDGE-ghost', passGhost, 'unknown recipe id → 0/0, no crash', ghost);
    } catch (e) {
      setupFail('SMOKE-EDGE', e);
    }

    // ---- BULK: 5 synthetic recipes against real catalog ingredients. ----
    try {
      const oliveOil = await findIngredient('olive oil');
      const salt = await findIngredient('salt');
      const feta = await findIngredient('feta');
      const vinegar = await findIngredient('vinegar');
      const basil = await findIngredient('basil');
      const anchors = [oliveOil, salt, feta, vinegar, basil].filter(
        (x): x is IngredientMeta => x !== null
      );
      if (anchors.length < 5) {
        setupFail(
          'SMOKE-BULK',
          `need 5 catalog anchors, found ${anchors.length}: ${anchors.map((a) => a.name).join(', ')}`
        );
      } else {
        const bulkRecipeIds: string[] = [];
        for (let i = 0; i < anchors.length; i++) {
          const recipe = await makeRecipe(t, userId, `bulk-${i}`);
          await addRecipeIngredient(recipe, anchors[i].id, 1);
          bulkRecipeIds.push(recipe);
        }
        // Stock the first anchor so percentages aren't all zero.
        const bulkSupply = await makeSupply(t, spaceId, userId, {
          ingredientId: anchors[0].id,
          status: 'in_stock',
        });
        const bulkMap = await calculateRecipeSupplyMatchBulk(bulkRecipeIds, spaceId);
        const sizeOk = bulkMap.size === 5;
        let percentagesMatch = true;
        for (const id of bulkRecipeIds) {
          const single = await calculateRecipeSupplyMatch(id, spaceId);
          const bulk = bulkMap.get(id);
          if (!bulk || bulk.matchPercentage !== single.matchPercentage) {
            percentagesMatch = false;
          }
        }
        report('SMOKE-BULK-size', sizeOk, 'bulk map has 5 entries', bulkMap.size);
        report(
          'SMOKE-BULK-parity',
          percentagesMatch,
          'each bulk percentage equals single-call result',
          [...bulkMap.values()].map((v) => v.matchPercentage)
        );
        console.warn(
          '[SMOKE-BULK-queries]',
          'ℹ️ bulk path issues 3 Supabase queries — confirm against the Supabase logs panel.'
        );
        await deleteSupplies(t, [bulkSupply]);
      }
    } catch (e) {
      setupFail('SMOKE-BULK', e);
    }

    // ============================================
    // CP2 — 4-level matcher scenarios (SMOKE-CP2-*)
    // ============================================
    // Each cp2() scenario: a synthetic recipe wants `recipeName`; the user
    // holds a synthetic supply of `supplyName` (or nothing if null). Asserts
    // the resulting MatchLevel. expectLevel 'L4' = recipe ingredient lands in
    // missing[]. Catalog rows discovered by name — skipMissing on a gap.
    const cp2 = async (
      label: string,
      recipeName: string,
      supplyName: string | null,
      expectLevel: 'exact' | 'form_variant' | 'substitute' | 'always_available' | 'L4'
    ): Promise<void> => {
      const ri = await findIngredient(recipeName);
      const su = supplyName ? await findIngredient(supplyName) : null;
      if (!ri || (supplyName && !su)) {
        skipMissing(label, `${recipeName}${supplyName ? ' / ' + supplyName : ''}`);
        return;
      }
      const local: string[] = [];
      try {
        const recipe = await makeRecipe(t, userId, label);
        await addRecipeIngredient(recipe, ri.id, 1);
        if (su) {
          local.push(
            await makeSupply(t, spaceId, userId, { ingredientId: su.id, status: 'in_stock' })
          );
        }
        const r = await calculateRecipeSupplyMatch(recipe, spaceId);
        const hit = r.matched.find((m) => m.ingredientId === ri.id);
        const pass =
          expectLevel === 'L4'
            ? !hit && r.missing.includes(ri.id)
            : hit?.level === expectLevel;
        report(label, pass, `${recipeName} vs ${supplyName ?? '(none)'} → ${expectLevel}`, r);
      } catch (e) {
        setupFail(label, e);
      }
      await deleteSupplies(t, local);
    };

    await cp2('SMOKE-CP2-L1a', 'lemon', 'lemon', 'exact');
    await cp2('SMOKE-CP2-L1b', 'lemon juice', 'lemon', 'exact');
    // 8D-CP2.1: lemon zest ↔ lemon juice are siblings under the lemon base.
    // Pre-fix: incorrectly matched as L1 exact via family traversal. Post-fix:
    // L1 only fires for self or direct base; siblings fall through to the
    // subtype/whitelist path. `citrus` is NOT in SUBSTITUTABLE_SUBTYPES → L4.
    // Was: 'exact'. Now: 'L4'.
    await cp2('SMOKE-CP2-L1c', 'lemon zest', 'lemon juice', 'L4');
    await cp2('SMOKE-CP2-L1d', 'lime juice', 'lemon juice', 'L4');
    await cp2('SMOKE-CP2-L2a', 'black pepper', 'black peppercorns', 'form_variant');
    await cp2('SMOKE-CP2-L2b', 'dried basil', 'basil', 'form_variant');
    await cp2('SMOKE-CP2-L2c', 'dijon mustard', 'mustard seeds', 'form_variant');
    await cp2('SMOKE-CP2-L3a', 'basmati rice', 'jasmine rice', 'substitute');
    await cp2('SMOKE-CP2-L3b', 'yellow mustard', 'dijon mustard', 'substitute');
    await cp2('SMOKE-CP2-L3c', 'chicken broth', 'chicken stock', 'substitute');
    await cp2('SMOKE-CP2-L4', 'flour', 'rice', 'L4');
    await cp2('SMOKE-CP2-L4b', 'ras el hanout', 'garam masala', 'L4');
    await cp2('SMOKE-CP2-AAa', 'water', null, 'always_available');
    await cp2('SMOKE-CP2-AAb', 'ice', null, 'always_available');

    // ---- SMOKE-CP2-tie: deterministic pick — 2 L3-qualifying supplies. ----
    {
      const basmati = await findIngredient('basmati rice');
      const jasmine = await findIngredient('jasmine rice');
      if (!basmati || !jasmine) {
        skipMissing('SMOKE-CP2-tie', 'basmati rice / jasmine rice');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'cp2-tie');
          await addRecipeIngredient(recipe, basmati.id, 1);
          // Two jasmine-rice supplies — both L3 candidates. created_at DESC
          // means the second-created supply must win.
          const s1 = await makeSupply(t, spaceId, userId, { ingredientId: jasmine.id, status: 'in_stock' });
          const s2 = await makeSupply(t, spaceId, userId, { ingredientId: jasmine.id, status: 'in_stock' });
          local.push(s1, s2);
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const hit = r.matched.find((m) => m.ingredientId === basmati.id);
          const pass = hit?.level === 'substitute' && hit.supplyId === s2;
          report('SMOKE-CP2-tie', pass, 'L3 tie → most-recent supply wins', { hit, s1, s2 });
        } catch (e) {
          setupFail('SMOKE-CP2-tie', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-CP2-pct: 4 ingredients, 1 L1 + 1 L2 + 1 L3 + 1 AA → 100%. ----
    {
      const lemon = await findIngredient('lemon');
      const bpepper = await findIngredient('black pepper');
      const bpeppercorns = await findIngredient('black peppercorns');
      const basmati = await findIngredient('basmati rice');
      const jasmine = await findIngredient('jasmine rice');
      const water = await findIngredient('water');
      if (!lemon || !bpepper || !bpeppercorns || !basmati || !jasmine || !water) {
        skipMissing('SMOKE-CP2-pct', 'lemon/black pepper/black peppercorns/basmati/jasmine/water');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'cp2-pct');
          await addRecipeIngredient(recipe, lemon.id, 1);
          await addRecipeIngredient(recipe, bpepper.id, 2);
          await addRecipeIngredient(recipe, basmati.id, 3);
          await addRecipeIngredient(recipe, water.id, 4);
          local.push(await makeSupply(t, spaceId, userId, { ingredientId: lemon.id, status: 'in_stock' }));
          local.push(await makeSupply(t, spaceId, userId, { ingredientId: bpeppercorns.id, status: 'in_stock' }));
          local.push(await makeSupply(t, spaceId, userId, { ingredientId: jasmine.id, status: 'in_stock' }));
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass = r.matchPercentage === 1 && r.matchedCount === 4 && r.totalCount === 4;
          report('SMOKE-CP2-pct', pass, '4 ingredients (L1+L2+L3+AA) → 100% / 4 matched', r);
        } catch (e) {
          setupFail('SMOKE-CP2-pct', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ---- SMOKE-CP2-mix: 5 ingredients, 2 L1 + 1 L4 + 2 AA → 80%. ----
    {
      const lemon = await findIngredient('lemon');
      const oliveOil = await findIngredient('olive oil');
      const flour = await findIngredient('flour');
      const water = await findIngredient('water');
      const ice = await findIngredient('ice');
      if (!lemon || !oliveOil || !flour || !water || !ice) {
        skipMissing('SMOKE-CP2-mix', 'lemon/olive oil/flour/water/ice');
      } else {
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, 'cp2-mix');
          await addRecipeIngredient(recipe, lemon.id, 1);
          await addRecipeIngredient(recipe, oliveOil.id, 2);
          await addRecipeIngredient(recipe, flour.id, 3);
          await addRecipeIngredient(recipe, water.id, 4);
          await addRecipeIngredient(recipe, ice.id, 5);
          local.push(await makeSupply(t, spaceId, userId, { ingredientId: lemon.id, status: 'in_stock' }));
          local.push(await makeSupply(t, spaceId, userId, { ingredientId: oliveOil.id, status: 'in_stock' }));
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const pass =
            Math.abs(r.matchPercentage - 0.8) < 0.001 &&
            r.matchedCount === 4 &&
            r.totalCount === 5;
          report('SMOKE-CP2-mix', pass, '5 ingredients (2 L1 + 1 L4 + 2 AA) → 80% / 4 matched', r);
        } catch (e) {
          setupFail('SMOKE-CP2-mix', e);
        }
        await deleteSupplies(t, local);
      }
    }

    // ============================================
    // CP2 PATCH — substitution whitelist + null-form wildcard (SMOKE-CP2-WL*/NF*)
    // ============================================
    // WL1-4: non-whitelisted subtypes (tropical_fruit, fish, cheese, chile)
    // demote to L4. WL5-8: whitelisted subtypes still fire L2/L3. NF1-3: the
    // null-form wildcard collapses a generic-base pairing to a silent L1.
    await cp2('SMOKE-CP2-WL1', 'mango', 'banana', 'L4');
    await cp2('SMOKE-CP2-WL2', 'salmon', 'tuna', 'L4');
    await cp2('SMOKE-CP2-WL3', 'cheddar', 'feta', 'L4');
    await cp2('SMOKE-CP2-WL4', 'jalapeño', 'habanero', 'L4');
    await cp2('SMOKE-CP2-WL5', 'maple syrup', 'honey', 'substitute');
    await cp2('SMOKE-CP2-WL6', 'dijon mustard', 'yellow mustard', 'substitute');
    await cp2('SMOKE-CP2-WL7', 'chicken stock', 'chicken broth', 'substitute');
    await cp2('SMOKE-CP2-WL8', 'black pepper', 'black peppercorns', 'form_variant');
    await cp2('SMOKE-CP2-NF1', 'sugar', 'granulated sugar', 'exact');
    await cp2('SMOKE-CP2-NF2', 'white wine vinegar', 'vinegar', 'exact');
    await cp2('SMOKE-CP2-NF3', 'lime juice', 'lime', 'exact');

    // ============================================
    // CP2.1 — L1c sibling routing fix (SMOKE-CP2.1-*)
    // ============================================
    // Before CP2.1, siblings under a shared base_ingredient_id were incorrectly
    // matched as L1 exact via family traversal (e.g., brisket ↔ ribeye, both
    // variants of beef base). After CP2.1, L1 only fires for self or direct
    // base; siblings fall through to L2/L3 + whitelist. DEMOTE cases verify
    // non-whitelisted subtypes correctly miss; WHITELIST cases verify
    // whitelisted siblings still route through; PRESERVED verifies the L1b
    // path is intact.
    await cp2('SMOKE-CP2.1-L1c-DEMOTE-BEEF', 'brisket', 'ribeye', 'L4');
    await cp2('SMOKE-CP2.1-L1c-DEMOTE-CHICKEN', 'chicken thighs', 'chicken breast', 'L4');
    // basmati ↔ jasmine: siblings under the rice base (or rice subtype) — rice
    // IS whitelisted. Outcome depends on null-form wildcard given current
    // catalog state; SMOKE-CP2-L3a already expects 'substitute' for this pair,
    // so this scenario doubles as an L1c-via-whitelist regression check.
    await cp2('SMOKE-CP2.1-L1c-WHITELIST-RICE', 'basmati rice', 'jasmine rice', 'substitute');
    // L1b regression check: recipe is the base, supply is a direct variant.
    // After CP2.1, L1 must still fire here (variant ↔ direct base relationship
    // is preserved).
    await cp2('SMOKE-CP2.1-L1b-PRESERVED', 'salt', 'kosher salt', 'exact');

    // ============================================
    // CP3 — MatchedIngredient.supplyStatus population (SMOKE-CP3-S*)
    // ============================================
    // The just-created synthetic supply is the most recent → pickBestSupply
    // favours it over any real lemon supply Tom stocks, so the asserted status
    // is deterministic.
    {
      const cp3 = async (
        label: string,
        statusToSet: 'in_stock' | 'low'
      ): Promise<void> => {
        const ing = await findIngredient('lemon');
        if (!ing) {
          skipMissing(label, 'lemon');
          return;
        }
        const local: string[] = [];
        try {
          const recipe = await makeRecipe(t, userId, label);
          await addRecipeIngredient(recipe, ing.id, 1);
          local.push(
            await makeSupply(t, spaceId, userId, {
              ingredientId: ing.id,
              status: statusToSet,
            })
          );
          const r = await calculateRecipeSupplyMatch(recipe, spaceId);
          const hit = r.matched.find((m) => m.ingredientId === ing.id);
          const pass = hit?.supplyStatus === statusToSet;
          report(
            label,
            pass,
            `lemon supply status=${statusToSet} → supplyStatus==='${statusToSet}'`,
            hit
          );
        } catch (e) {
          setupFail(label, e);
        }
        await deleteSupplies(t, local);
      };
      await cp3('SMOKE-CP3-S1', 'in_stock');
      await cp3('SMOKE-CP3-S2', 'low');
    }

    // ============================================
    // CP4 — ready-to-cook gate (SMOKE-CP4-RTC*)
    // ============================================
    // Deterministic pure-predicate tests of readyToCookService.isReadyToCook /
    // filterReadyToCook — constructed PantryMatchResult + ReadyToCookRecipe
    // literals, NO real matcher call, so they are immune to T27 harness
    // contamination (the prompt's discovery-based RTC scenarios would not be).
    {
      const mkResult = (
        recipeId: string,
        matchPercentage: number,
        missing: string[]
      ): PantryMatchResult => ({
        recipeId,
        matchPercentage,
        matched: [],
        missing,
        totalCount: 0,
        matchedCount: 0,
      });
      // 5-ingredient recipe; hero 'salmon' resolves to id i-salmon.
      const five = [
        { id: 'i-salmon', name: 'salmon' },
        { id: 'i-caper', name: 'capers' },
        { id: 'i-lemon', name: 'lemon' },
        { id: 'i-oil', name: 'olive oil' },
        { id: 'i-dill', name: 'dill' },
      ];

      // RTC1 — all matched, hero in stock → ready; appears in filterReadyToCook.
      {
        const recipe = {
          id: 'rtc1', title: 'RTC1',
          hero_ingredients: ['salmon'], ingredients: five,
        };
        const res = mkResult('rtc1', 1.0, []);
        const ready = isReadyToCook(recipe, res);
        const inFilter = filterReadyToCook(
          [recipe],
          new Map([['rtc1', res]])
        ).length === 1;
        report('SMOKE-CP4-RTC1', ready === true && inFilter,
          'all matched + hero in stock → ready, in filterReadyToCook output',
          { ready, inFilter });
      }

      // RTC2 — hero 'salmon' is missing → not ready.
      {
        const recipe = {
          id: 'rtc2', title: 'RTC2',
          hero_ingredients: ['salmon'], ingredients: five,
        };
        const res = mkResult('rtc2', 0.8, ['i-salmon']);
        const ready = isReadyToCook(recipe, res);
        report('SMOKE-CP4-RTC2', ready === false,
          'hero in missing[] → not ready', ready);
      }

      // RTC3 — 90% exactly, hero matched, only a non-hero ingredient missing.
      {
        const recipe = {
          id: 'rtc3', title: 'RTC3',
          hero_ingredients: ['salmon'], ingredients: five,
        };
        const res = mkResult('rtc3', 0.9, ['i-dill']); // non-hero missing
        const ready = isReadyToCook(recipe, res);
        report('SMOKE-CP4-RTC3', ready === true,
          'matchPct 0.90 exactly + hero matched → ready', ready);
      }

      // RTC4 — under the 0.90 threshold → not ready.
      {
        const recipe = {
          id: 'rtc4', title: 'RTC4',
          hero_ingredients: ['salmon'], ingredients: five,
        };
        const res = mkResult('rtc4', 0.8, []);
        const ready = isReadyToCook(recipe, res);
        report('SMOKE-CP4-RTC4', ready === false,
          'matchPct 0.80 < 0.90 threshold → not ready', ready);
      }

      // RTC5 — hero name resolves to no recipe ingredient → soft pass
      // (console.warn '[readyToCookService] hero name unresolved' emitted).
      {
        const recipe = {
          id: 'rtc5', title: 'RTC5',
          hero_ingredients: ['mystery-unresolvable-hero'], ingredients: five,
        };
        const res = mkResult('rtc5', 0.95, []);
        const ready = isReadyToCook(recipe, res);
        report('SMOKE-CP4-RTC5', ready === true,
          'unresolvable hero → soft pass (console.warn emitted), recipe still ready',
          ready);
      }
    }
  } catch (err) {
    console.warn('[SMOKE-FATAL]', '❌ setup failed before assertions ran', err);
  } finally {
    await teardown(t);
    console.warn('[SMOKE-DONE]', 'Pantry matching smoke tests complete.');
  }
}
