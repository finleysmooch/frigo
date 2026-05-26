# CC_PROMPT_8D_CP1_cleanup — Smoke harness RLS rewrite + ProfileStackNavigator cleanup + SQL correction + watchpoints

**Phase:** 8D-CP1 verification + cross-cutting cleanup
**Estimated:** ~1 hour
**Authored by:** Claude.ai planning, 2026-05-18
**Depends on:** CP1 shipped and verified working on real data (390-recipe bulk + on-device ✓ marks + Pantry Match % sort). Cheese cleanup SQL already executed in Supabase (v2 with XOR-aware Phase 3b).

---

## Context

Four cleanup items surfaced during 8D-CP1 verification, all unblocking or correcting the previous session's work. Bundled here because each is small individually but they share file context and benefit from one verification pass.

1. **Part A — Smoke harness rewrite.** The current `_pantryMatchingSmokeTest.ts` is blocked by RLS: it tries to INSERT into `ingredients` (a globally-shared catalog table — RLS correctly restricts INSERT to service-role). Rewrite to **discover existing catalog ingredients** by name + create synthetic **user-scoped** recipes/supplies that reference them. Better than the original synthetic approach: it tests the real catalog substrate (real `base_ingredient_id` linkage, real `form` values, real cheese cleanup outcome). This is the F&F-blocker fix.

2. **Part B — Delete dead `ProfileStackNavigator` + re-home `LogoPlayground`.** CC found during the last session that `ProfileStackNavigator` is defined in `App.tsx` but never mounted (no Profile tab exists in `RootTabParamList`; `Settings`/`Profile`/`EditProfile` are reached as nested screens inside `FeedStack` and `StatsStack`). The Admin wiring fix correctly registered Admin in both live stacks; `LogoPlayground` is still only registered in the dead `ProfileStackNavigator` and is therefore unreachable. Delete the dead navigator entirely and re-home `LogoPlayground` in both live stacks (same pattern as Admin).

3. **Part C — Overwrite the committed cheese cleanup SQL** to reflect what actually ran. The current `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` has the v0 OR-semantics Phase 3b that failed against the actual XOR `supply_has_identity` constraint. Replace with the v2 version that was actually applied to production.

4. **Part D — Apply DEFERRED_WORK + PROCESS_WATCHPOINTS entries** authored by Claude.ai. Two new watchpoint candidates (W12 + W13) and one cleanup item closure. Full text provided below.

Execute in numbered order. Separate commit per Part for clean history. Each Part is independently shippable — if Part A discovers a catalog gap, the smoke test logs `SETUP-FAIL` and continues; Parts B/C/D are unaffected.

---

## Inputs to read

**For Part A (harness rewrite):**
1. `lib/services/_pantryMatchingSmokeTest.ts` — the current harness. Full rewrite (keep the file path, replace contents).
2. `lib/services/pantryMatchingService.ts` — confirm the public API (`calculateRecipeSupplyMatch`, `calculateRecipeSupplyMatchBulk`, `PantryMatchResult` shape).

**For Part B (navigator cleanup):**
3. `App.tsx` — locate `ProfileStackParamList` (~line 252), `ProfileStack` declaration (~line 291), `ProfileStackNavigator` function (~lines 665-695, contains the LogoPlayground registration), the `FeedStackNavigator` (Settings registered ~line 408), and the `StatsStackNavigator` (Settings registered ~line 600).
4. `screens/SettingsScreen.tsx` — verify `navigation.navigate('LogoPlayground')` is the call site to preserve (existing Developer section row).

**For Part C (SQL correction):**
5. `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` — current file. Full overwrite.

**For Part D (docs additions):**
6. `docs/DEFERRED_WORK.md` — current head, find the changelog table and the appropriate insertion point.
7. `docs/PROCESS_WATCHPOINTS.md` — find the "Closed watchpoints" section and the W-numbering convention.

---

## Task

### PART A — Smoke harness rewrite (~30 min)

Replace the entire contents of `lib/services/_pantryMatchingSmokeTest.ts`. Strategy:

- **Discover** existing catalog ingredients by case-insensitive exact-name match via `supabase.from('ingredients').select(...).ilike('name', name)`. Per scenario, log `SETUP-FAIL` and skip if discovery returns null — don't crash the run.
- **Create** only user-scoped data: synthetic recipes (with `__smoke8d_` prefix in `title`), `recipe_ingredients` rows pointing at real catalog ingredient_ids, and supplies (real ingredient_id OR `__smoke8d_`-prefixed `custom_name`).
- **No INSERT into `ingredients`** anywhere. `makeIngredient` is gone.
- **Teardown** only deletes user-scoped rows — `__smoke8d_`-prefixed recipes, their `recipe_ingredients`, all tracked supplies. **Never** attempts to delete ingredient rows.
- **Pre-clean** mirrors teardown — same scope (no ingredient deletes).

**Drop-in file contents:**

```typescript
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

    // ---- SMOKE-7..11: salt status states. ----
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
```

**That's the entire file. Replace `lib/services/_pantryMatchingSmokeTest.ts` contents with the above.** Keep the `// TEMP — remove after 8D-CP3 ships.` marker at the top.

**No changes** to AdminScreen — the button already calls `runPantryMatchingSmokeTests(activeSpaceId)`.

**Commit message:** `fix(8D-CP1): rewrite smoke harness to discovery-based RLS-friendly approach`

### PART B — Delete dead `ProfileStackNavigator` + re-home `LogoPlayground` (~15 min)

In `App.tsx`:

**B1. Verify dead-code claim before deleting.** Run:
```bash
grep -rn "ProfileStackNavigator\|ProfileStackParamList\|<ProfileStack\." App.tsx screens/ components/ lib/
```

The only matches should be inside `App.tsx` itself (the type, the declaration, the function body, the screens registered within it). **STOP and report** if any other file references `ProfileStack` — that contradicts the dead-code claim and means we need a different approach.

**B2. Delete the `ProfileStackParamList` type** (~line 252):
```typescript
// DELETE THIS BLOCK
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  EditProfile: undefined;
  LogoPlayground: undefined;
  Admin: undefined;
};
```

**B3. Delete the `ProfileStack` navigator declaration** (~line 291):
```typescript
// DELETE THIS LINE
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
```

**B4. Delete the `ProfileStackNavigator` function entirely** (~lines 665-695). This is the function body that registers `ProfileHome`/`Settings`/`EditProfile`/`LogoPlayground` plus the now-inert `Admin`.

**B5. Re-home `LogoPlayground` in `FeedStackNavigator`.** Add to `FeedStackParamList` (the param list FeedStack uses):
```typescript
// ADD inside FeedStackParamList (mirror the Admin: undefined line added in the previous fix)
LogoPlayground: undefined;
```

Add the Screen registration in `FeedStackNavigator`, immediately after the existing `Settings` registration and beside the `Admin` registration:
```typescript
<FeedStack.Screen
  name="LogoPlayground"
  component={LogoPlaygroundScreen}
  options={{
    headerShown: true,
    title: 'Logo Playground',
  }}
/>
```

**B6. Mirror in `StatsStackNavigator`.** Same two additions in `StatsStackParamList` and `StatsStackNavigator`.

**B7. The `LogoPlaygroundScreen` import in `App.tsx` (~line 45) stays.** It was previously only used by the dead navigator; now it's used by the two live ones.

**Commit message:** `refactor(nav): delete dead ProfileStackNavigator; re-home LogoPlayground in Feed + Stats stacks`

### PART C — Overwrite the cheese cleanup SQL file (~5 min)

Replace the entire contents of `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` with the version below — same 6-phase structure, but Phase 3b is the **v2 atomic null+custom_name+archive** that actually ran (the v0 in the current file violates the `supply_has_identity` XOR CHECK and would fail again if re-run).

```sql
-- 8D-CP1 Part 0 — Cheese duplicate cleanup migration (v2 — actually applied)
-- Run manually in Supabase SQL editor.
-- This migration deletes orphan ingredient rows of the form "X cheese" when a
-- canonical "X" row already exists with cheese-family metadata. The orphan rows
-- were created during recipe extraction before the cheese-family normalization
-- landed in CP6e-Catalog-SF5.
--
-- Phase 3b v2 fix: previously set custom_name alongside ingredient_id, which
-- violated supply_has_identity (XOR CHECK on supplies — exactly one of
-- ingredient_id OR custom_name, never both). v2 nulls ingredient_id at the
-- same time, satisfying the constraint and pre-empting Phase 5's FK SET NULL
-- cascade.

BEGIN;

-- ============================================
-- Phase 1: Discovery — enumerate orphan/canonical pairs
-- ============================================
WITH orphan_pairs AS (
  SELECT
    orphan.id   AS orphan_id,
    orphan.name AS orphan_name,
    canon.id    AS canonical_id,
    canon.name  AS canonical_name
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
SELECT
  orphan_id,
  orphan_name,
  canonical_id,
  canonical_name,
  (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.ingredient_id = orphan_id) AS recipe_ingredient_refs,
  (SELECT COUNT(*) FROM supplies s WHERE s.ingredient_id = orphan_id AND s.archived_at IS NULL) AS active_supply_refs
FROM orphan_pairs
ORDER BY orphan_name;

-- ============================================
-- Phase 2: Re-point recipe_ingredients FKs
-- ============================================
WITH orphan_pairs AS (
  SELECT
    orphan.id AS orphan_id,
    canon.id  AS canonical_id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
UPDATE recipe_ingredients ri
SET ingredient_id = pairs.canonical_id
FROM orphan_pairs pairs
WHERE ri.ingredient_id = pairs.orphan_id;

-- ============================================
-- Phase 3a: Re-point supplies that have NO collision
-- ============================================
WITH orphan_pairs AS (
  SELECT
    orphan.id AS orphan_id,
    canon.id  AS canonical_id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
UPDATE supplies s
SET ingredient_id = pairs.canonical_id
FROM orphan_pairs pairs
WHERE s.ingredient_id = pairs.orphan_id
  AND NOT EXISTS (
    SELECT 1 FROM supplies s2
    WHERE s2.space_id = s.space_id
      AND s2.ingredient_id = pairs.canonical_id
      AND s2.archived_at IS NULL
  );

-- ============================================
-- Phase 3b (v2): Archive orphan-side supplies WHERE collision exists
--                Atomic: null FK + set custom_name + archive
--                Result: XOR constraint satisfied (ingredient_id NULL, custom_name NOT NULL)
-- ============================================
WITH orphan_pairs AS (
  SELECT
    orphan.id   AS orphan_id,
    orphan.name AS orphan_name
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
UPDATE supplies s
SET
  archived_at   = NOW(),
  custom_name   = pairs.orphan_name,
  ingredient_id = NULL
FROM orphan_pairs pairs
WHERE s.ingredient_id = pairs.orphan_id
  AND s.archived_at IS NULL;

-- ============================================
-- Phase 4: Verify zero references remain
-- ============================================
SELECT COUNT(*) AS leftover_recipe_ingredient_refs
FROM recipe_ingredients ri
WHERE ri.ingredient_id IN (
  SELECT orphan.id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
);

SELECT COUNT(*) AS leftover_supply_refs
FROM supplies s
WHERE s.ingredient_id IN (
  SELECT orphan.id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
);

-- ============================================
-- Phase 5: Delete orphan ingredient rows
-- ============================================
DELETE FROM ingredients
WHERE id IN (
  SELECT orphan.id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
);

-- ============================================
-- Phase 6: Final verification — should return 0
-- ============================================
SELECT COUNT(*) AS remaining_orphans
FROM ingredients orphan
JOIN ingredients canon
  ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
WHERE LOWER(orphan.name) ~ ' cheese$'
  AND orphan.base_ingredient_id IS NULL
  AND canon.id != orphan.id;

COMMIT;
```

**Commit message:** `docs(8D-CP1): correct cheese cleanup SQL to v2 (XOR-aware Phase 3b — what actually ran)`

### PART D — Apply DEFERRED_WORK + PROCESS_WATCHPOINTS additions (~10 min)

**D1. Append to `docs/DEFERRED_WORK.md`** under the appropriate section (find the "From: Phase 8" or cross-cutting infrastructure section — wherever T7, T8 currently live):

```markdown
| T9 | **Repo schema-snapshot CSVs.** Supabase schema CSVs (column details, CHECK constraints, indexes) currently live only in Claude.ai project knowledge — not in the repo. CC sessions cannot grep them during prompt execution, which led to schema-claim drift in 8D-CP1 (cheese migration assumed OR-semantics on `supply_has_identity`; actual constraint is XOR). **Action:** snapshot a small set of CSVs into `docs/schema/` and refresh on a cadence (probably at phase boundaries). Snapshots needed: column details, CHECK constraints, indexes, function signatures. ~30 min initial setup + ~10 min per refresh. Surfaced during 8D-CP1 verification 2026-05-18. | 🔧 | 🟢 | Workflow hygiene. Catches schema-claim drift in future prompts before runtime. |
| T10 | **`missingCount` divergence on RecipeDetailScreen.** `IngredientsSection`'s `missingCount` prop now uses `matchResult.missing.length` from the matcher (catalog ingredients only — free-text rows excluded). The screen's separate `missingIngredients` array driving the "Add missing" modal still includes free-text rows. Counts can diverge slightly on recipes with free-text ingredients. **Action:** reconcile in CP3 by routing the modal's source through the matcher's `missing[]` or adding a separate free-text affordance. Surfaced during 8D-CP1 SESSION_LOG triage 2026-05-18. | 🔧 | 🟡 | UX inconsistency. Resolve before F&F if free-text recipes are common in seeded data. |
| T11 | **Bulk match URL-length risk at scale.** `pantryMatchingService.calculateRecipeSupplyMatchBulk` issues an `.or(id.in.(...),base_ingredient_id.in.(...))` query that could approach PostgREST URL limits at N≈475 recipes. Acceptable per D8D-Q10 (caching out of scope at F&F scale). **Action if surfaces:** chunk the bulk call into batches of ~100-150 recipes. Surfaced during 8D-CP1 SESSION_LOG triage 2026-05-18. | 🔧 | 🟢 | Contingency only — no observed failures yet. |
```

Also update the DEFERRED_WORK changelog row at the top of the doc (find the existing pattern) — bump the version and add a row noting `T9/T10/T11 added` with today's date.

**D2. Append to `docs/PROCESS_WATCHPOINTS.md`** (find the existing watchpoint format — W11 is the most recent). Add two new entries before the "Closed watchpoints" section:

```markdown
## W12 — Pre-written destructive SQL should cite actual CHECK constraint definitions, not assume semantics

**Status:** Observing
**Opened:** 2026-05-18 (surfaced during 8D-CP1 Part 0 execution)

**Observation:**

The 8D-CP1 cheese cleanup migration's Phase 3b was pre-written by Claude.ai assuming `supply_has_identity` was an OR-semantics constraint (either `ingredient_id` OR `custom_name` non-null). The actual constraint is XOR (exactly one non-null). The migration failed twice in production execution — first when Phase 5's FK `ON DELETE SET NULL` cascade fired (because Phase 3b left `ingredient_id` non-null, then Phase 5 nulled it without backfilling `custom_name`, violating XOR via the absence-of-identity path), then again when an interim fix set both `ingredient_id` AND `custom_name` (violating XOR via the both-set path). The successful v2 atomically nulled `ingredient_id`, set `custom_name`, and set `archived_at` in one UPDATE.

The constraint definition lives in `phase_8r_cp1_schema_migration.sql` (committed during 8R-CP1). A targeted grep during prompt authoring would have surfaced it. The schema CSVs that would have helped exist in Claude.ai's project knowledge but not in the repo (filed as DEFERRED_WORK T9).

**Pattern identified:**

Destructive SQL prompts authored by Claude.ai sometimes carry constraint or schema assumptions that aren't verified against the actual constraint text. When the assumption is wrong, the migration fails at execution time — best case, the BEGIN/COMMIT rolls back cleanly (this case); worst case, partial state leaks if a check is missing.

**Proposed mitigation:**

Prompts that include destructive SQL (UPDATE/DELETE/DROP on shared tables) should include a "verify constraints" pre-flight step in the prompt's "Inputs to read" — either citing the constraint by name and source file, or running a `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'X'` query before the destructive phase. The fix is process-only: Claude.ai's prompt-authoring discipline, not a tooling change.

Tighter mitigation depends on closing T9 (repo schema snapshots) — once CSVs are in `docs/schema/`, CC can grep them as part of input reading.

**Counter-consideration:**

For trivially-safe SQL (single-table SELECT, well-known columns), constraint pre-flight adds overhead with no payoff. The mitigation applies to destructive SQL on tables with multiple constraints, FK cascades, or both — i.e., non-trivial migration scenarios.

**Review trigger:** re-evaluate W12 after the next prompt that includes destructive SQL on a table with non-trivial constraints. Did the prompt cite or verify? Did execution succeed first try?

---

## W13 — "Wire to screen X (if it exists)" prompts should verify the screen is currently reachable, not just that the file exists

**Status:** Observing
**Opened:** 2026-05-18 (surfaced during 8D-CP1 Part 3 trigger wiring)

**Observation:**

The 8D-CP1 prompt instructed CC to "wire a hidden invocation from `screens/AdminScreen.tsx` (if it exists)" for the smoke-test runner. CC found `AdminScreen.tsx` in the repo, added the button — but `AdminScreen` was unreachable from the running app (defined in `RootTabParamList` but not registered as a `<Tab.Screen>`; no other screen pushed to it). Tom hit the button-doesn't-do-anything dead end during verification.

A follow-up prompt added an `Admin Tools` row in `SettingsScreen` and registered AdminScreen in `ProfileStackNavigator` — but `ProfileStackNavigator` is also dead code (defined, never mounted). The second runtime error ("action 'navigate' with payload {name:'Admin'} was not handled by any navigator") was the bridge that finally surfaced the dead navigator. A third fix registered Admin in the two live stacks (`FeedStack`, `StatsStack`) where SettingsScreen actually lives.

Total: three prompts to land a one-button feature. Root cause was the false equivalence between "the file exists" and "the screen is reachable from the running app."

**Pattern identified:**

Prompts that wire features to existing screens use "if it exists" as the reachability test. File existence is a weaker test than reachability — a screen can exist in the repo but be defined inside a dead navigator, registered to a param list that's never mounted, or pushed-to via a route that no caller uses. The smoke-test wiring is a clear instance; the dead `ProfileStackNavigator` + unreachable `LogoPlayground` is the latent precedent.

**Proposed mitigation:**

When a prompt wires to or navigates from an existing screen, the prompt should instruct CC to verify reachability by tracing the navigator chain:
1. Find the navigator that registers the target screen.
2. Confirm that navigator is mounted by `Tab.Navigator` or another mounted navigator (transitively).
3. If unreachable, STOP and report rather than wiring blind.

Lightweight version: a single grep step in "Inputs to read" — `grep -n "<Tab.Screen.*{NavigatorName}" App.tsx` — surfaces the gap.

**Counter-consideration:**

For obviously-reachable target screens (the screen Tom is looking at right now, a screen referenced by a route the user just tapped), reachability is implicit. The mitigation applies when the target screen has no recent user-visible interaction — dev tools, admin screens, deeply-nested settings panels.

**Review trigger:** re-evaluate W13 after the next prompt that wires to or navigates from a screen Tom hasn't been actively touching. Did the prompt include a reachability check? Did CC trace the navigator chain?
```

Also add an entry to PROCESS_WATCHPOINTS' header changelog if it has one.

**Commit message:** `docs: add T9-T11 (deferred work) + W12-W13 (process watchpoints) from 8D-CP1 retrospective`

---

## Constraints

- **No changes to `pantryMatchingService.ts`.** It's verified working on real data. Smoke harness rewrite is a separate file.
- **No changes to AdminScreen.tsx.** The button + section CC added during 8D-CP1 are correct.
- **Part B: STOP if `grep -rn "ProfileStack" /repo` finds any reference outside App.tsx itself.** Don't delete blindly — report and let Claude.ai reconcile.
- **Part C: file overwrite, not edit.** Replace entire contents; don't merge with the v0 SQL.
- **Part D: insertion only.** Don't modify or delete existing DEFERRED_WORK rows or PROCESS_WATCHPOINTS entries.
- **Commit per-Part for clean history.** Four commits total (A, B, C, D).
- **STOP and report** on schema/code surprises during Part B — particularly if Settings is reached via a navigator other than Feed/Stats, or if either of those stacks has structural differences from the existing Admin registration.

---

## Verification

Before writing the SESSION_LOG entry:

**Part A:**
1. **TypeScript compiles clean.** `npx tsc --noEmit` — 0 new errors introduced.
2. **No `from('ingredients').insert` calls** in the new harness. Grep `_pantryMatchingSmokeTest.ts` for `.insert` — every match should be `recipes`, `recipe_ingredients`, or `supplies`. **Zero matches against `ingredients`.**
3. **No `.delete().in('id', ...)` calls against the ingredients table.** Same grep approach.
4. **`findIngredient` exported or used internally.** Grep for the helper.
5. **The 16 scenarios are present** (SMOKE-CATALOG-cheese-cleanup, SMOKE-CATALOG-evoo-linkage, SMOKE-1 through SMOKE-13, SMOKE-EDGE-empty, SMOKE-EDGE-ghost, SMOKE-BULK-size, SMOKE-BULK-parity). Grep for `SMOKE-` and count.

**Part B:**
6. **`ProfileStackNavigator` is gone.** Grep `App.tsx` for `ProfileStackNavigator` — zero matches.
7. **`ProfileStackParamList` is gone.** Same grep.
8. **`LogoPlayground` registered in FeedStack.** Grep `App.tsx` for `name="LogoPlayground"` in FeedStackNavigator — one match.
9. **`LogoPlayground` registered in StatsStack.** Same grep in StatsStackNavigator — one match.
10. **LogoPlaygroundScreen import preserved.** Grep `App.tsx` for `LogoPlaygroundScreen` — at least one match (the import).

**Part C:**
11. **SQL file contains v2 Phase 3b.** Grep `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` for `ingredient_id = NULL` (the atomic null in Phase 3b) — at least one match.
12. **v0 Phase 3b is gone.** Grep the file for the v0 pattern `SET archived_at = NOW()\s*FROM orphan_pairs` (the v0 form had only `archived_at` in SET). Should be zero matches.

**Part D:**
13. **T9, T10, T11 in DEFERRED_WORK.** Grep for `| T9 |`, `| T10 |`, `| T11 |` in `docs/DEFERRED_WORK.md`.
14. **W12, W13 in PROCESS_WATCHPOINTS.** Grep for `## W12` and `## W13` in `docs/PROCESS_WATCHPOINTS.md`.

**On-device verification (Tom runs separately):**
- Profile / Stats → Settings → Developer → Logo Playground → opens (post-Part-B re-home).
- Profile / Stats → Settings → Developer → Admin Tools → "Run pantry matching smoke tests" → smoke v2 results stream in Metro console.
- Paste the `[SMOKE-N]` console block in chat for Claude.ai triage.

---

## SESSION_LOG entry format

```markdown
## 2026-MM-DD — 8D-CP1 cleanup: smoke harness rewrite + nav cleanup + SQL correction + watchpoints
**Phase:** 8D-CP1 verification + cross-cutting cleanup
**Prompt from:** CC_PROMPT_8D_CP1_cleanup.md

Four-part cleanup. Each part shipped as its own commit.

**Part A — Smoke harness rewrite (commit XXXX).** Replaced `lib/services/_pantryMatchingSmokeTest.ts` with the discovery-based v2 harness. No more INSERT into `ingredients`. 16 scenarios covering 13 SMOKE numbered scenarios + 2 catalog-integrity checks + edge + bulk.

**Part B — Dead navigator cleanup (commit YYYY).** Deleted `ProfileStackParamList`, `ProfileStack`, and `ProfileStackNavigator` from `App.tsx`. Re-homed `LogoPlayground` in both `FeedStackNavigator` and `StatsStackNavigator` (mirror Admin pattern). Pre-flight grep confirmed no external references to ProfileStack.

**Part C — SQL correction (commit ZZZZ).** Overwrote `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` with the v2 XOR-aware version that actually ran in production.

**Part D — Docs additions (commit WWWW).** Added T9/T10/T11 to DEFERRED_WORK and W12/W13 to PROCESS_WATCHPOINTS.

**Files modified:**
- `lib/services/_pantryMatchingSmokeTest.ts` (full rewrite)
- `App.tsx` (ProfileStack deletion + LogoPlayground re-home in 2 stacks) ⚠️ PK snapshot now stale (was YYYY-MM-DD)
- `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` (full overwrite)
- `docs/DEFERRED_WORK.md` (T9-T11 added)
- `docs/PROCESS_WATCHPOINTS.md` (W12-W13 added)
- `docs/PK_CODE_SNAPSHOTS.md` (Rule E: App.tsx note appended)

**Verification results:**
- TypeScript: [N new errors / clean]
- Smoke harness has no ingredients INSERT: ✅ (grep returned 0)
- 16 scenarios present: ✅
- ProfileStackNavigator gone: ✅
- LogoPlayground in FeedStack + StatsStack: ✅
- SQL v2 Phase 3b present: ✅
- T9/T10/T11 in DEFERRED_WORK: ✅
- W12/W13 in PROCESS_WATCHPOINTS: ✅

**Recommended doc updates:** (none beyond Part D)

**Recommended next steps for Tom:**
1. Reload app. Profile/Stats → Settings → Developer → Logo Playground — confirm reachable.
2. Profile/Stats → Settings → Developer → Admin Tools → "Run pantry matching smoke tests".
3. Paste `[SMOKE-*]` results in chat for Claude.ai triage.
4. Once smoke verified, commit the still-uncommitted CP1 code (pantryMatchingService + 3 screen edits) alongside today's commits.

**Surprises / Notes for Claude.ai:**
[Anything unexpected during execution.]
```

---

## Open questions (STOP conditions)

1. **Part B grep finds external `ProfileStack` references.** Don't delete; report and let Claude.ai reconcile.
2. **Settings is reached via a navigator other than Feed/Stats.** Part B's re-home target is wrong; report.
3. **`recipes` or `recipe_ingredients` table INSERT is also RLS-blocked.** Part A's whole approach fails; report and let Claude.ai pivot (probably Option 3 — delete harness entirely — at that point).
4. **`docs/PROCESS_WATCHPOINTS.md` doesn't exist or uses a different format than W11.** Report; Claude.ai will adapt the entries.
5. **Discovery for any of the catalog ingredients returns case-sensitivity surprises** (e.g., "Olive Oil" with caps vs "olive oil"). The `.ilike` should handle case; report if not.
