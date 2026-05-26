# CC Prompt — Phase 8D CP2: 4-Level Matcher Refactor (T20) — v2

**Date drafted:** 2026-05-19 (v2 supersedes the v1 draft after a code-grounded review pass)
**Session type for the planning side:** phase planning (Phase 8D CP2)
**Purpose:** Upgrade `pantryMatchingService.ts` from binary (matched/missing) to 4-level (L1 exact / L2 form variant / L3 substitute / L4 no match), implement the `always_available` skip rule, and update the rendering surface in `IngredientsSection.tsx` to display the three non-exact states. Data scaffolding shipped in CP1.5 and was finalized in the 2026-05-19 planning session — no schema migrations or data work required from CC.

**Resolves:** T20 (the matcher refactor) and T22 (always_available skip).

---

## Context

CP1.5 (closed 2026-05-19) delivered complete data scaffolding for soft-match: every ingredient row has an `ingredient_subtype` and a `form` column carrying meaningful values; 0 NULL subtypes in production. The catalog now supports a 4-level match relationship between any (recipe ingredient, supply) pair, but the matcher service today only computes binary results — it walks the `base_ingredient_id` variant family for L1 and treats everything else as missing.

The four levels are encoded entirely in existing columns — no schema change required:

| Level | Condition | UI says | Visual |
|---|---|---|---|
| **L1 — Exact** | Same ingredient row OR linked via `base_ingredient_id` (in either direction, or shared base) | "You have it" | ✓ green |
| **L2 — Form variant** | Same `ingredient_subtype` + **different `form`** | "You have a different form" | ⚠ yellow with form sub-line |
| **L3 — Substitute** | Same `ingredient_subtype` + **same `form`** | "You have a similar ingredient" | ⚠ yellow with substitute sub-line |
| **L4 — No match** | Different (or non-overlapping) `ingredient_subtype` | "Don't have this ingredient" | ✗ red / missing |

**`subtype = 'always_available'`** is treated as L1 exact for every recipe ingredient that has it (currently 2 rows: water with 69 recipe references, ice with 1). The matcher skips the supply lookup entirely for these. UI renders them identically to L1 exact — no special badge.

**Real-world examples the new logic enables:**
- Recipe wants `basmati rice`, user has `jasmine rice` → both `subtype='rice'`, `form='dried'` → **L3** "Close: you have jasmine rice"
- Recipe wants `black pepper` (`form='ground'`), user has `black peppercorns` (`form='whole'`) → both `subtype='pepper'` → **L2** "You have whole peppercorns; recipe wants ground"
- Recipe wants `dried basil` (Pantry, `form='dried'`), user has `basil` (Produce, `form='fresh'`) → both `subtype='basil'` → **L2** cross-family form variant
- Recipe wants `chicken broth`, user has `chicken stock` → both `subtype='stock'` (broths merged into stock in Chunk F) → **L3**
- Recipe wants `dijon mustard`, user has `yellow mustard` → both `subtype='mustard'`, `form='paste'` → **L3**
- Recipe wants `water` → `subtype='always_available'` → **L1** regardless of supplies

**Mustard family demo** (handoff's canonical demonstration): mustard subtype spans 7 rows across 3 ingredient_types — mustard/dijon/yellow/whole-grain (Condiments), mustard powder (Spices), mustard seeds (Nuts & Seeds). All Level 2/3 substitutes of each other depending on form alignment. Make sure smoke tests cover this cross-`ingredient_type` reach.

**10 intentional orphans** (no soft-match should fire): demoted `cheese` (id `8fbe2d77-3f3e-4b01-abec-f82d176fa45d`), frozen yogurt, ghee, labneh, quail egg, young sheep's milk cheese (Dairy); whole fish (Proteins); mixed greens, fresh chile, chili pepper (Produce). These have no subtype counterparts in production catalogs and will naturally fall to L4 — no special-case code needed unless a smoke test surfaces a regression.

---

## Inputs to read

Before writing any code:

1. **`lib/services/pantryMatchingService.ts`** — the current service. Public API:
   - `calculateRecipeSupplyMatch(recipeId: string, spaceId: string): Promise<PantryMatchResult>` (single)
   - `calculateRecipeSupplyMatchBulk(recipeIds: string[], spaceId: string): Promise<Map<string, PantryMatchResult>>` (bulk; the single function delegates to this)
   - Current types: `PantryMatchResult { recipeId, matchPercentage, matched: MatchedIngredient[], missing: string[], totalCount, matchedCount }` and `MatchedIngredient { ingredientId, supplyId, formMismatch }`. The matcher is already batched into a fixed 3-query design — DO NOT refactor that structure.

2. **`lib/services/_pantryMatchingSmokeTest.ts`** — the existing discovery-based RLS-friendly smoke harness. Pattern: `findIngredient(name)`, `report(label, pass, expected, result)`, `setupFail(label, err)`, `skipMissing(label, what)`, with `__smoke8d_`-prefixed synthetic recipes/supplies. Triggered from AdminScreen via "Run pantry matching smoke tests" button. **Extend this file with new 4-level scenarios — do not create a parallel file.**

3. **`components/recipe/IngredientsSection.tsx`** — the actual UI rendering surface. Current props relevant here: `availableIngredientIds: Set<string>` + `missingCount: number`. The 8D-CP1 "DO NOT touch IngredientsSection" guard is **lifted for CP2** — the component itself needs to render three distinct visual states now.

4. **`screens/RecipeDetailScreen.tsx`** — calls `calculateRecipeSupplyMatch` on focus, derives the props for `IngredientsSection` from the result. This screen passes `availableIngredientIds: new Set(matched.map(m => m.ingredientId))` and `missingCount: missing.length` today.

5. **`screens/RecipeListScreen.tsx`** — calls `calculateRecipeSupplyMatchBulk` on the recipe-list load, stores in `matchMap`, uses `matchPercentage` for the "Pantry Match %" sort. No visual indicator changes here — just keep the sort working with the new percentage (which now includes L1+L2+L3+always_available in the numerator).

6. **`screens/CookSoonScreen.tsx`** — verify whether it consumes the matcher. Architecture doc says it's a "saved recipes queue." **Grep first**: `grep -n "calculateRecipeSupplyMatch\|PantryMatchResult\|MatchedIngredient" screens/CookSoonScreen.tsx`. If zero hits → drop it from scope and note in SESSION_LOG. If hits exist → mirror the RecipeDetailScreen treatment.

7. **`lib/types/supplies.ts`** — `SupplyStatus` enum and supply-related types. The current matcher's `MatchedIngredient` and `PantryMatchResult` are defined inside `pantryMatchingService.ts` itself, not in `supplies.ts`. Keep them there; just expand them.

8. **`docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md`** — particularly the **"Subtype conventions established"** block added during the CP1.5 close reconciliation. Gives the subtype semantic landscape: `pepper` covers black/white peppercorns + ground; `dried_chile` is split from `chile` deliberately; `stock` absorbed `broth`; `ginger_fresh` vs `ginger_spice` are split; `coconut_cream` stands alone (not joined with `cream`); etc. Useful for writing meaningful smoke scenarios and for any judgment calls during the refactor.

9. **`screens/AdminScreen.tsx`** — the existing smoke-test trigger surface (no changes expected here for CP2; the new scenarios reuse the existing button).

**Schema verification (read-only sanity check before writing code):**
- `ingredients.ingredient_subtype` (text, nullable) and `ingredients.form` (text, nullable). Both populated by CP1.5 across all ~604 catalog rows; 0 NULLs on subtype.
- `supplies` table has `id`, `space_id`, `ingredient_id` (nullable for custom-name supplies), `status`, `archived_at`, `created_at`. **`last_acquired_at` is NOT a column on `supplies`** — the per-lot acquisition timestamp lives in `supply_lots.acquired_at`. See Task 2 tie-breaker note.

If any schema fact contradicts the above, **STOP and report** in SESSION_LOG.

---

## Task

Execute Part 1 → Part 8 in order. Separate commits per Part for clean history (or one fused commit if you prefer — flag your choice).

### Part 0 (already completed in planning session 2026-05-19 — DO NOT REPEAT)

Catalog data hygiene was executed directly in the planning chat, **not via this prompt**. The work that ran:

- **4 Produce/Fresh Herbs singletons** backfilled to `form='fresh'`: chervil, curry leaves, kaffir lime leaves, lovage.
- **7 Pantry/dried_chile rows** assigned individual forms: ancho chile + chile de árbol → `whole`; gochugaru + kirmizi biber + urfa pepper → `flakes`; ancho chile powder + piment d'espelette → `powder`.
- **8 spice_blend rows split into singleton subtypes** so the matcher no longer cross-substitutes between functionally-different blends (e.g. ras el hanout was L3-substituting for garam masala). New subtypes: `apple_pie_spice`, `baharat`, `chinese_five_spice`, `garam_masala`, `herbes_de_provence`, `ras_el_hanout`, `shichimi_togarashi`, `zaatar`.

19 rows total, single transaction, verified clean. The post-2.5b SQL block is captured in SESSION_LOG (entry of 2026-05-19) for audit reference. **CC does not re-run this; the data is already in production.**

Deferred items captured: **T25 — 10 cosmetic singleton-subtype Pantry rows still have `form IS NULL`** (asafetida, cloves, fenugreek seeds, ginger spice, MSG, pink peppercorns, saffron, sichuan peppercorns, star anise, sumac). All are matcher-inert (singleton subtypes, no L2/L3 risk). Hygiene only; post-F&F. Add to DEFERRED_WORK if not already there.

### Part 1 — Expand `MatchedIngredient` and add `MatchLevel`

In `lib/services/pantryMatchingService.ts`, expand the existing types (do **not** rename or restructure them):

```typescript
export type MatchLevel = 'exact' | 'form_variant' | 'substitute' | 'always_available';

export interface MatchedIngredient {
  ingredientId: string;          // recipe ingredient_id that was matched
  supplyId: string | null;        // null only when level='always_available'
  level: MatchLevel;              // NEW
  formMismatch: {
    recipeForm: string | null;
    supplyForm: string | null;
  } | null;                       // populated for L2 form_variant; null otherwise
  reason: string;                 // NEW — short, UI-facing string
}

export interface PantryMatchResult {
  recipeId: string;
  matchPercentage: number;        // L1+L2+L3+always_available counted as matched
  matched: MatchedIngredient[];   // all non-L4 entries
  missing: string[];              // L4 ingredient_ids only (shape unchanged)
  totalCount: number;             // ALL recipe ingredients, including always_available
  matchedCount: number;           // matched.length
}
```

**Critical detail on `matchPercentage` and counts** (C2): always_available ingredients participate in both numerator and denominator. A recipe with 8 ingredients of which 1 is water → `totalCount=8`, `matchedCount` includes water as matched (level='always_available'), `matchPercentage = matchedCount / 8`. Otherwise the rollup math drifts.

**Reason strings** (CP2 ships with generic copy; explainer/substitution rationale is a polish CP):
- L1 exact: `"You have it"` (or empty — UI doesn't display a sub-line for exact)
- L2 form variant: `` `You have ${supplyForm ?? 'a different form'}; recipe wants ${recipeForm ?? 'a different form'}` `` (or similar; keep human-readable)
- L3 substitute: `` `Close: you have ${supplyName}` `` — requires looking up the supply's display name from the catalog metadata
- always_available: `"Always available"` (or empty — see C1: render identically to L1)

### Part 2 — Refactor the matcher logic in `calculateRecipeSupplyMatchBulk`

**Preserve the existing 3-query structure.** All 4-level logic happens in the in-memory assembly loop after the queries return. The only structural change to the query layer is Task 2.5 below (expanding the supply universe to cover L2/L3 candidates).

**The per-recipe-ingredient loop becomes:**

```
for each recipe_ingredient meta in recipe:

  // Step 0 — always_available skip (FIRST)
  if meta.ingredient_subtype == 'always_available':
    matched.push({
      ingredientId: meta.id,
      supplyId: null,
      level: 'always_available',
      formMismatch: null,
      reason: 'Always available'
    })
    continue

  // Step 1 — L1 exact via match group (current logic, preserved)
  group = matchGroups.get(meta.id) ?? [meta.id]
  l1_hit = find supply in group with status != 'out'
  if l1_hit:
    matched.push({
      ingredientId: meta.id,
      supplyId: l1_hit.id,
      level: 'exact',
      formMismatch: compute_form_mismatch(meta, l1_hit),  // existing logic, kept for annotation
      reason: 'You have it'
    })
    continue

  // Step 2 — Subtype-based L2/L3
  if meta.ingredient_subtype is null:
    // Defensive — should never trigger post-CP1.5 (0 NULL subtypes)
    missing.push(meta.id)
    continue

  // Find supplies whose catalog row has the same subtype as the recipe ingredient
  // (uses the expanded supply universe from Task 2.5)
  subtype_candidates = active_supplies_in_space
    .filter(s => catalog[s.ingredient_id].ingredient_subtype == meta.ingredient_subtype)
    .filter(s => s.status != 'out')

  if subtype_candidates is empty:
    missing.push(meta.id)
    continue

  // L2 — same subtype, different form (form null comparison: see C-rule below)
  l2_candidates = subtype_candidates.filter(s => forms_differ(meta.form, catalog[s.ingredient_id].form))
  if l2_candidates not empty:
    best = pick_best_supply(l2_candidates)   // see tie-breaker below
    matched.push({
      ingredientId: meta.id,
      supplyId: best.id,
      level: 'form_variant',
      formMismatch: { recipeForm: meta.form, supplyForm: catalog[best.ingredient_id].form },
      reason: 'You have ' + (catalog[best.ingredient_id].form ?? 'a different form') + '; recipe wants ' + (meta.form ?? 'a different form')
    })
    continue

  // L3 — same subtype, same form
  l3_candidates = subtype_candidates.filter(s => forms_equal(meta.form, catalog[s.ingredient_id].form))
  if l3_candidates not empty:
    best = pick_best_supply(l3_candidates)
    matched.push({
      ingredientId: meta.id,
      supplyId: best.id,
      level: 'substitute',
      formMismatch: null,
      reason: 'Close: you have ' + catalog[best.ingredient_id].name
    })
    continue

  // L4 — no match
  missing.push(meta.id)
```

**Form comparison rules (C-rule, explicit):**
- `forms_equal(a, b)`: both null → true; both non-null and `a === b` → true; otherwise false
- `forms_differ(a, b)`: NOT `forms_equal(a, b)`. So: (one null, other non-null) → true; (both non-null and different) → true; (both null) → false; (both same non-null) → false.

This means: recipe wants `dried basil` (`form='dried'`), supply has fresh `basil` (`form='fresh'`) → forms differ → L2. Recipe wants `basmati rice` (`form='dried'`), supply has `jasmine rice` (`form='dried'`) → forms equal → L3. After Part 0's herb backfill, the Produce-side herbs will all have `form='fresh'` so cross-family pairings classify correctly.

**Tie-breaker for `pick_best_supply` (C6):**
- Primary: `supplies.created_at` DESC (most recently added supply wins)
- That's it — `last_acquired_at` does NOT exist as a column on `supplies` (the per-lot timestamp `supply_lots.acquired_at` would require expanding the supply fetch to join active lots, which is out of scope). Note this constraint in SESSION_LOG.
- Stable secondary by `supplies.id` if `created_at` ties at the millisecond. The point is determinism — same matcher inputs always yield same outputs.

### Task 2.5 — Expand the supply-fetch universe

The current query for supplies is `space_id = $spaceId AND ingredient_id IN (full match-group universe) AND archived_at IS NULL AND status != 'unknown'`. The match-group universe only covers base_ingredient_id-linked siblings — it will not surface a `jasmine rice` supply for a `basmati rice` recipe ingredient because they're separate bases linked only by shared subtype.

**Adopt option (b):** drop the `ingredient_id IN (...)` filter on the supply query entirely. Fetch all active supplies in the space (`space_id = $spaceId AND archived_at IS NULL AND status != 'unknown' AND ingredient_id IS NOT NULL`), filter in memory after joining catalog metadata.

**Scale check:** at F&F (200 supplies/user, 100 recipes max on RecipeListScreen), this is well within budget — single round-trip fetches ~200 rows. Post-F&F, if users grow to 500+ supplies or analytics surface a hot path, option (a) — subtype-aware `IN` expansion — is a future tunable. **Capture as a post-F&F optimization candidate in DEFERRED_WORK** if you don't see it there already.

The catalog-metadata fetch (query 2) needs to be expanded too: instead of joining only on match-group siblings, include `ingredient_subtype` and `name` for every ingredient_id touched by either side (all recipe ingredients + all supplies' ingredient_ids). One way: keep query 2's existing match-group resolution but also fetch metadata (`id, ingredient_subtype, form, name, base_ingredient_id, is_base_ingredient`) for every distinct supply.ingredient_id. The catalog has ~604 rows total — even fetching the whole table is fine, but be targeted to be tidy.

### Part 3 — Update `IngredientsSection.tsx` to render 4 states

The 8D-CP1 "DO NOT touch IngredientsSection" guard is **lifted for CP2.**

**Prop change:** replace `availableIngredientIds: Set<string>` with `ingredientMatchLevels: Map<string, MatchLevel>` (or add it alongside, depending on how many sites hand in the Set today — grep first). The Map's keys are recipe ingredient ids; values are the level. L4 ingredients are NOT in the Map.

**Rendering per level:**
- `exact` and `always_available` — existing ✓ green visual. **Same rendering** for both (C1) — water shows as "you have it"; the user doesn't see "always available" as a distinct state. The level distinction exists for matcher logic + future analytics, not UX.
- `form_variant` — yellow ⚠ visual. Sub-line below the ingredient name: the `reason` string from `MatchedIngredient` ("You have whole peppercorns; recipe wants ground"). If the prop shape only carries the Map, the sub-line copy needs to come from a parallel `Map<string, MatchedIngredient>` or from the full `matched[]` array passed in.
- `substitute` — yellow ⚠ with a distinct visual cue (different icon or shade — designer's call, but visibly different from form_variant). Sub-line: "Close: you have jasmine rice" etc.
- L4 (ingredient not in the Map) — existing missing visual.

**`haveCount` rollup:** counts any ingredient with a level in the Map. This naturally includes L1+L2+L3+always_available — matches the new `matchedCount` semantics.

**Style notes:**
- Use the existing yellow accent in the design tokens (look for what FilterDrawer or similar yellow surfaces use — don't invent a new color).
- Sub-line typography: smaller than the ingredient text, paler color, single line max. Truncate with ellipsis if needed.

**RecipeDetailScreen update:** derive the new prop from `matchResult.matched`:
```typescript
const ingredientMatchLevels = useMemo(() => {
  const m = new Map<string, MatchLevel>();
  matchResult?.matched.forEach(mi => m.set(mi.ingredientId, mi.level));
  return m;
}, [matchResult]);
```
If you keep `availableIngredientIds` as a fallback compat prop, just derive both. The `missingCount` prop stays the same (`matchResult?.missing.length ?? 0`).

### Part 4 — Verify other consumers + Pantry-match sort

**`RecipeListScreen.tsx`:** no semantic changes needed. The "Pantry Match %" sort uses `matchPercentage`, which now includes L1+L2+L3+always_available in the numerator — directionally correct (recipes with workable substitutes rank higher). If the screen renders per-recipe match-% chips or any visual matcher signal in the row card, verify behavior; if it doesn't, leave it.

**`CookSoonScreen.tsx`:** **GREP FIRST.** Run `grep -n "calculateRecipeSupplyMatch\|PantryMatchResult\|MatchedIngredient" screens/CookSoonScreen.tsx`. If zero hits, drop it from scope and note in SESSION_LOG. If hits exist, mirror the RecipeDetailScreen pattern (derive `ingredientMatchLevels`, hand into whatever component renders the ingredient list).

**Grep for stragglers (E12):** before declaring done, run `grep -rn "calculateRecipeSupplyMatch\|PantryMatchResult\|MatchedIngredient" --include="*.ts" --include="*.tsx" lib/ screens/ components/`. For every hit, verify the consumer handles (a) the new `level` field on `MatchedIngredient`, (b) the unchanged shape of `missing` as `string[]`, and (c) the unchanged shape of `matchPercentage`. Report each site found in SESSION_LOG with status (handled / needs update / no-op).

### Part 5 — Extend the smoke test (E7)

**File:** extend `lib/services/_pantryMatchingSmokeTest.ts` — do not create a new file.

Use the existing patterns: `findIngredient(name)`, `report(label, pass, expected, result)`, `setupFail(label, err)`, `skipMissing(label, what)`. New synthetic rows continue to use the `__smoke8d_` prefix. Trigger continues from AdminScreen's existing "Run pantry matching smoke tests" button.

**Add scenarios** (label them `SMOKE-CP2-*` to distinguish from existing CP1 tests):

```
SMOKE-CP2-L1a  | user has lemon (base), recipe wants lemon       → L1 exact via direct id
SMOKE-CP2-L1b  | user has lemon (base), recipe wants lemon juice → L1 exact via base_ingredient_id (variant → base)
SMOKE-CP2-L1c  | user has lemon juice, recipe wants lemon zest   → L1 exact via shared base (variant ↔ variant)
SMOKE-CP2-L1d  | user has lemon juice, recipe wants lime juice   → L4 (different bases)
SMOKE-CP2-L2a  | user has black peppercorns (form=whole), recipe wants ground black pepper → L2 with formMismatch
SMOKE-CP2-L2b  | user has fresh basil (Produce, form=fresh), recipe wants dried basil (Pantry, form=dried) → L2 cross-family
SMOKE-CP2-L2c  | user has mustard seeds (form=whole), recipe wants dijon (form=paste) → L2 (mustard family)
SMOKE-CP2-L3a  | user has jasmine rice, recipe wants basmati rice → L3 substitute (both form=dried, subtype=rice)
SMOKE-CP2-L3b  | user has dijon mustard, recipe wants yellow mustard → L3 substitute (subtype=mustard, form=paste)
SMOKE-CP2-L3c  | user has chicken stock, recipe wants chicken broth → L3 (broths absorbed into stock subtype in Chunk F)
SMOKE-CP2-L4   | user has rice, recipe wants flour → L4
SMOKE-CP2-L4b  | user has garam masala, recipe wants ras el hanout → L4 (subtype split regression check; was L3 pre-Part 0)
SMOKE-CP2-AAa  | user has nothing, recipe wants water → L1 (always_available, supplyId=null)
SMOKE-CP2-AAb  | user has nothing, recipe wants ice  → L1 (always_available)
SMOKE-CP2-tie  | user has 2 supplies that both qualify L3 — verify deterministic pick (created_at DESC)
SMOKE-CP2-pct  | recipe with 4 ingredients: 1 L1 + 1 L2 + 1 L3 + 1 always_available → matchPercentage=1.0, matchedCount=4
SMOKE-CP2-mix  | recipe with 5 ingredients: 2 L1 + 1 L4 + 2 always_available → matchPercentage=0.8 (4/5)
```

If a scenario's catalog row isn't discoverable by name, log `SETUP-FAIL` and continue (existing pattern). The smoke harness doubles as a catalog-integrity check — failures point at substrate gaps.

### Part 6 — Update `docs/FRIGO_ARCHITECTURE.md` services section

The matcher's public function signatures haven't changed (`calculateRecipeSupplyMatch`, `calculateRecipeSupplyMatchBulk`), but the return shape did. Update the services section's `pantryMatchingService` blurb to mention the 4-level return semantics (3-5 lines).

### Part 7 — Update `docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md`

Append a CP2 results subsection under Phase 8D. Mark CP2 status COMPLETE with date. Include:
- Files modified (matcher service, IngredientsSection, RecipeDetailScreen, RecipeListScreen, possibly CookSoonScreen, smoke test, FRIGO_ARCHITECTURE)
- Brief summary of 4-level logic and the always_available skip
- Reference to T22 (always_available skip rule) as bundled-in
- The Part 0 herb form backfill: which rows were touched, any anomalies surfaced
- Any Part 4 grep findings (stragglers updated or not)

### Part 8 — Stage updated docs for PK sync

Copy any modified docs (`FRIGO_ARCHITECTURE.md`, `PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md`, `DEFERRED_WORK_2026-05-15.md` if you closed T20/T22) to `_pk_sync/`. Per DOC_MAINTENANCE Section 6.

---

## Constraints

- **Do not change the catalog data** beyond Part 0's herb backfill (and Part 0 is SQL Tom runs manually — CC does not execute SQL). If you find a missing subtype or wrong form on any non-herb row during testing, report in SESSION_LOG — do not silently fix.
- **Do not change the schema.** No new columns, no new constraints, no migrations beyond Part 0's data UPDATE.
- **Preserve the 3-query bulk structure.** The matcher is already batched; the 4-level logic is purely in-memory. The only query-layer change is Task 2.5's universe expansion (drop the supply `IN` filter).
- **Performance budget:** matcher latency for typical recipes (~10 ingredients) and for the bulk path (~100 recipes on RecipeListScreen, ~500 on whole-library) should not regress. Measure if you can; log baseline + post-change latencies in SESSION_LOG. If you can't measure, write "no regression observed."
- **Do not invent UI affordances.** Tappable L2/L3 indicators with explainer popovers are a future polish CP — out of scope for CP2.
- **Do not implement substitution rationale copy.** "Both are dried legumes; texture may differ" style explanations are a future polish CP — out of scope. CP2 ships generic reason strings only.
- **Do not delete the orphaned Python pipeline** at `scripts/cp1_5_catalog_backfill/`. T24 captures it.
- **Do not refactor the smoke harness's pattern.** Add scenarios; don't reshape.

---

## Verification

1. `npx tsc --noEmit` — passes with 0 errors.
2. Smoke test (Part 5): all 15 scenarios run; expected to pass on a catalog that includes the named ingredients (lemon, black pepper, basil, mustard variants, rice, etc.). Any `SETUP-FAIL` logs point at catalog gaps for Claude.ai follow-up.
3. Manual dev verification:
   - Open any pasta recipe. Without stocking water in pantry, the water line shows ✓ matched (not missing). Confirms T22.
   - Find a recipe with `basmati rice`. Stock `jasmine rice` (status=in_stock). The line shows L3 substitute with "Close: jasmine rice" sub-line.
   - Find a recipe with `black pepper` (ground). Stock `black peppercorns` (whole). Line shows L2 form variant with "you have whole; recipe wants ground" sub-line.
   - Find a recipe with `dried basil`. Stock fresh `basil` from Produce. Line shows L2 form variant.
   - Find a recipe with an ingredient whose subtype is unique vs your supplies. Line shows L4 missing.
   - Open RecipeDetailScreen for a recipe with mixed L1/L2/L3/L4 ingredients. Match-% includes L1+L2+L3+AA in numerator.
4. `git status` shows expected file modifications only. No accidental edits outside the matcher service / IngredientsSection / consumers / smoke test / docs.
5. `_pk_sync/` contains the modified docs.

---

## SESSION_LOG entry format

```
### CC: Phase 8D CP2 — 4-level matcher refactor (T20) + always_available skip (T22) — [DONE or PARTIAL]

**Prompt:** `CC_PROMPT_2026-05-19_8D_CP2_4level_matcher_v2.md`
**Files modified:**
- lib/services/pantryMatchingService.ts (4-level refactor; types expanded with `level` and `reason`)
- lib/services/_pantryMatchingSmokeTest.ts (extended with SMOKE-CP2-* scenarios)
- components/recipe/IngredientsSection.tsx (renders L1/L2/L3/L4 + always_available; new ingredientMatchLevels prop)
- screens/RecipeDetailScreen.tsx (derives ingredientMatchLevels Map from matchResult.matched)
- screens/RecipeListScreen.tsx (no semantic change; verified Pantry Match % sort works)
- screens/CookSoonScreen.tsx (if grep found references) OR [not modified — grep returned 0 references]
- docs/FRIGO_ARCHITECTURE.md (services section updated)
- docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md (CP2 status COMPLETE)
- docs/DEFERRED_WORK_2026-05-15.md (T20 + T22 closed; T25 added if not already present)
**Files staged in _pk_sync/:** [list]
**Resolved deferred items:** T20 (CP2 itself), T22 (always_available skip rule)
**Smoke test result:** [X / 16 pass — details on any failures]
**Performance:** [matcher latency before/after if measured; "no regression observed" if not]
**Grep findings (Part 4):** [list every callsite touched, and any that warranted no change]
**Notes:** [data anomalies surfaced (e.g. herbs with no Pantry counterpart); type-change surprises; supply-universe scale check]
```

---

## Suggested commit message

```
feat(8D-CP2): 4-level pantry matcher

Refactors pantryMatchingService from binary match/missing to 4 levels:
- L1 exact (same ingredient, or via base_ingredient_id walk)
- L2 form variant (same subtype, different form)
- L3 substitute (same subtype, same form)
- L4 no match (different subtype)

Plus: always_available subtype skip rule (T22) — water (69 recipe refs)
and ice (1) auto-match without supply lookup.

UI: IngredientsSection.tsx renders L2/L3 as distinct yellow states with
sub-line copy. L1 + always_available render identically (no UX difference).
RecipeDetailScreen passes a new ingredientMatchLevels Map prop.
RecipeListScreen unchanged. CookSoonScreen [updated|not a consumer].

Data scaffolding shipped in CP1.5 and finalized in the 2026-05-19 planning
session (19-row Part 0 transaction: Produce herb forms, dried_chile forms,
spice_blend subtype split). See SESSION_LOG.

Resolves T20, T22.
```

---

## After CP2 ships

Eligible items (NOT in scope for CP2; capture in DEFERRED_WORK or POST_FF_BACKLOG as appropriate):

- **L2/L3 polish CP** — substitution explainer copy ("works because both are dried legumes; texture may differ"), tap-to-expand affordance on yellow indicators.
- **Match analytics CP** — track which subtypes most frequently fire L2/L3 to inform future catalog refinement; surface in admin/stats.
- **cookDepletion interaction** — when a recipe is cooked and an L3-substituted supply satisfied the match, should `cookDepletionService` deplete the substitute supply or treat it as missing? Decision deferred; touches the post-cook flow.
- **Subtype-aware supply-fetch IN expansion (E4 option (a))** — if F&F or post-F&F surfaces a perf hot path in the bulk matcher with users carrying 500+ supplies, swap the unfiltered supply fetch for a subtype-aware IN clause. Estimated 1-day refactor.
- **F&F launch readiness check** — confirm catalog data + matcher behavior together pass an end-to-end test on 10+ real recipes before declaring F&F-ready.
- **Per-lot tie-breaker** — currently CP2's tie-breaker uses `supplies.created_at` because `last_acquired_at` doesn't exist as a column. If a future need arises (e.g. analytics show users want "newest lot wins"), expand the supply fetch to include `supply_lots.acquired_at` MAX per supply and use that as the primary tie-breaker.
