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
  } catch (err) {
    console.warn('[SMOKE-FATAL]', '❌ setup failed before assertions ran', err);
  } finally {
    await teardown(t);
    console.warn('[SMOKE-DONE]', 'Pantry matching smoke tests complete.');
  }
}
