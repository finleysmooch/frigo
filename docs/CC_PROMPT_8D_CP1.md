# CC_PROMPT_8D_CP1 — Recipe-pantry matching primitive + cheese cleanup migration + wiring

**Phase:** 8D — Recipe-pantry matching
**Estimated:** ~1.25 sessions
**F&F-blocker:** Yes
**Authored by:** Claude.ai planning, 2026-05-18

---

## Context

Phase 8R landed the new `supplies` / `needs` / `tags` / `views` model in April-May 2026. The catalog substrate work (`base_ingredient_id` linkage, `form` column, vinegar promotion SF-5, cheese variant additions, plural_name audit) shipped during the CP6d/CP6e period. None of that investment has a current consumer: **no recipe-pantry matching code currently exists in the codebase** (verified 2026-05-15 via grep — the old `pantryService.calculatePantryMatchPercentage` family was deleted with the 8R schema purge and never re-implemented). Recipe surfaces have no pantry indicators today.

CP1 is the foundational sub-phase of Phase 8D: it builds the matching primitive that everything else in 8D consumes (CP3 tap-sheet, CP4 What-can-I-cook, CP5 missing-to-grocery). All 13 design decisions for 8D are locked in `docs/PHASE_8D_PLANNING.md` v0.2 — read it before starting if you have any architectural questions.

This prompt has three parts that ship in order:
- **Part 0:** Cheese duplicate cleanup migration (SQL). Tom runs this in Supabase SQL editor; CC does NOT execute SQL directly. Pre-written below.
- **Part 1:** Build `lib/services/pantryMatchingService.ts` — the matching primitive.
- **Part 2:** Wire to `RecipeDetailScreen` + `RecipeListScreen` so the ✓ marks and a new sort option appear immediately.
- **Part 3:** Smoke tests via `console.warn` assertions (no test framework setup).

Part 4 from the locked plan (5 stale `pantry_items` query sites) is **deferred** from this prompt — it depends on the repo cleanup pass audit. Claude.ai will issue a surgical follow-up prompt after that audit lands.

---

## Inputs to read

**Required (architectural context):**
1. `docs/PHASE_8D_PLANNING.md` — the canonical scoping doc. Read all 13 decisions and the "Matching algorithm" section.
2. `docs/FRIGO_ARCHITECTURE.md` — services pattern (no Supabase calls in components).

**Required (code-level inputs):**
3. `lib/services/suppliesService.ts` — supplies query patterns, `SupplyWithTags` shape.
4. `lib/types/supplies.ts` — `SupplyStatus` enum, `SupplyWithTags` type.
5. `components/recipe/IngredientsSection.tsx` — existing props `availableIngredientIds: Set<string>` and `missingCount: number` (currently passed but empty — CP1 populates them).
6. `screens/RecipeDetailScreen.tsx` — focus where match result holds state; do NOT touch IngredientsSection prop interface, just supply the data.
7. `screens/RecipeListScreen.tsx` — sort dropdown state (`sortOption`, `SortOption` type, `renderSortPickerModal`), filter logic, `filteredRecipes` derivation.

**Schema verification (needs-verification — confirm during reading pass):**
- `ingredients` table has `base_ingredient_id` (FK to self, nullable), `is_base_ingredient` (boolean), `form` (text, nullable). Verify in `Supabase Snippet Schema Column Details with PK_FK Metadata.csv` or via a quick `\d ingredients` mental check from the schema CSV.
- `recipe_ingredients` table has `ingredient_id` (FK to `ingredients`, nullable for free-text rows).
- `recipes.hero_ingredients` is JSONB array of `{ingredient_id, name}` — NOT needed for CP1, but verify shape for CP4 planning.
- `supplies` table has `space_id`, `ingredient_id` (nullable), `status` (enum), `archived_at` (nullable timestamp). Verify `status` enum includes `in_stock`, `low`, `critical`, `out`, `unknown`.

If any schema fact contradicts the above: **STOP and report.** Do not proceed with code based on a wrong assumption.

---

## Task

### Part 0 — Cheese duplicate cleanup migration

**Action:** Save the SQL below to a new file `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql`. Tom runs it manually in Supabase SQL editor before Part 1 service code is written. **CC does NOT execute SQL.**

Then commit the SQL file with a brief message: `chore(8D-CP1): add cheese cleanup migration SQL`.

```sql
-- 8D-CP1 Part 0 — Cheese duplicate cleanup migration
-- Run manually in Supabase SQL editor.
-- This migration deletes orphan ingredient rows of the form "X cheese" when a
-- canonical "X" row already exists with cheese-family metadata. The orphan rows
-- were created during recipe extraction before the cheese-family normalization
-- landed in CP6e-Catalog-SF5.
--
-- Each phase outputs row counts so Tom can verify before committing the
-- transaction. Run with the transaction open (BEGIN/COMMIT) so any anomaly
-- can be rolled back.

BEGIN;

-- ============================================
-- Phase 1: Discovery — enumerate orphan/canonical pairs
-- ============================================
-- Output: list of pairs for Tom's manual review before destructive phases.
-- Tom can SELECT this CTE first, sanity-check the pair count and names,
-- then proceed to Phase 2.

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
    AND orphan.base_ingredient_id IS NULL  -- only base-level orphans, not variants
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
    orphan.id   AS orphan_id,
    canon.id    AS canonical_id
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
-- Phase 3: Re-point supplies FKs (with collision safety)
-- ============================================
-- If a user has BOTH "feta" and "feta cheese" supplies in the same space,
-- we archive the orphan-side and leave the canonical-side intact.

-- Phase 3a: Re-point supplies that have no collision
WITH orphan_pairs AS (
  SELECT
    orphan.id   AS orphan_id,
    canon.id    AS canonical_id
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

-- Phase 3b: Archive orphan-side supplies where collision exists
WITH orphan_pairs AS (
  SELECT orphan.id AS orphan_id
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
UPDATE supplies
SET archived_at = NOW()
WHERE ingredient_id IN (SELECT orphan_id FROM orphan_pairs)
  AND archived_at IS NULL;

-- ============================================
-- Phase 4: Verify zero references remain before deleting ingredient rows
-- ============================================

-- Should return 0
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

-- Should return 0
SELECT COUNT(*) AS leftover_active_supply_refs
FROM supplies s
WHERE s.archived_at IS NULL
  AND s.ingredient_id IN (
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
-- Only run if Phase 4 verification queries return 0 for both checks.

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
-- Phase 6: Final verification
-- ============================================
-- Should return 0 orphan rows
SELECT COUNT(*) AS remaining_orphans
FROM ingredients orphan
JOIN ingredients canon
  ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
WHERE LOWER(orphan.name) ~ ' cheese$'
  AND orphan.base_ingredient_id IS NULL
  AND canon.id != orphan.id;

COMMIT;
```

### Part 1 — Build `lib/services/pantryMatchingService.ts`

**Action:** Create the new file with the contract and algorithm below.

**Signature contract (exported types and functions):**

```typescript
export interface MatchedIngredient {
  ingredientId: string;
  supplyId: string;
  formMismatch: {
    recipeForm: string;
    supplyForm: string;
  } | null;
}

export interface PantryMatchResult {
  recipeId: string;
  matchPercentage: number;          // 0.0 - 1.0
  matched: MatchedIngredient[];
  missing: string[];                // recipe ingredient_ids with no match or status=out
  totalCount: number;
  matchedCount: number;
}

export async function calculateRecipeSupplyMatch(
  recipeId: string,
  spaceId: string
): Promise<PantryMatchResult>;

export async function calculateRecipeSupplyMatchBulk(
  recipeIds: string[],
  spaceId: string
): Promise<Map<string, PantryMatchResult>>;
```

**Algorithm (per locked decisions D8D-Q1 through D8D-Q8):**

For each recipe ingredient (rows in `recipe_ingredients` for the given recipe):

1. **Resolve match group via full variant tree traversal** (D8D-Q1):
   - Fetch the ingredient row from `ingredients`.
   - If `is_base_ingredient = true`: match group = `[this.id]` + all variant rows where `base_ingredient_id = this.id`.
   - Else if `base_ingredient_id IS NOT NULL`: match group = the full variant family — all rows where `base_ingredient_id = this.base_ingredient_id` + the base row itself.
   - Else (orphan, no base linkage): match group = `[this.id]`.
   - Bidirectional traversal — both directions are interchangeable.

2. **Query supplies for that match group:**
   - `space_id = $spaceId`
   - `ingredient_id IN (match_group)`
   - `archived_at IS NULL`
   - `status != 'unknown'`
   - Note: `ingredient_id IS NULL` supplies (custom-name) are excluded naturally by `IN` filter (D8D-Q6).
   - Note: `tracking_mode` is NOT consulted (D8D-Q5).

3. **Status-based resolution** (D8D-Q2 / D8D-Q7):
   - Supply found AND `status IN ('in_stock', 'low', 'critical')` → **matched**
   - Supply found AND `status = 'out'` → **missing**
   - No supply found → **missing**

4. **Form comparison** (D8D-Q8 — opportunistic):
   - For each matched ingredient: compare `recipeIngredient.ingredient.form` vs `supply.ingredient.form`.
   - If both non-null AND different → `formMismatch = { recipeForm, supplyForm }`.
   - Else → `formMismatch = null`.
   - **No matches are rejected based on form mismatch** — UI signal only.

5. **Compute percentage:**
   - `matchPercentage = matchedCount / totalCount`.
   - No special staple denominator math (D8D-Q2 simplification).
   - Edge case: if recipe has zero `recipe_ingredients` rows, return `matchPercentage = 0`, `totalCount = 0`, `matchedCount = 0`, empty arrays.

**Bulk function optimization (locked architecture):**

For N recipes, target is **3 queries total**:

1. `recipe_ingredients` for all N recipes — collect distinct `ingredient_id` values.
2. `ingredients` self-join to resolve all match groups for the distinct ingredient set (fetch each ingredient PLUS all sibling variants sharing its `base_ingredient_id`, PLUS the base row).
3. `supplies` filtered by `space_id`, `ingredient_id IN (entire match-group universe)`, `archived_at IS NULL`, `status != 'unknown'`.

Assemble per-recipe results in memory after the three queries return. Critical for `RecipeListScreen` performance with N=475 recipes.

**Implementation notes:**
- Standard `lib/services/` patterns — error handling via try/catch, `console.error('❌ ...')` on failure, throw.
- Add a `console.log('🔍 ...')` at function entry for visibility during dogfooding.
- Use `supabase` from `lib/supabase.ts`.
- Pure TypeScript; no React imports.

### Part 2 — Wire to consumers

**Part 2a — `RecipeDetailScreen.tsx`:**

1. Add state: `const [matchResult, setMatchResult] = useState<PantryMatchResult | null>(null);`
2. On `useFocusEffect` (or in the existing data load `useEffect`), call `calculateRecipeSupplyMatch(recipeId, activeSpaceId)` and store the result. Use `useActiveSpaceId()` from SpaceContext for the space.
3. Derive the props for `IngredientsSection`:
   - `availableIngredientIds`: `new Set(matchResult?.matched.map((m) => m.ingredientId) ?? [])`
   - `missingCount`: `matchResult?.missing.length ?? 0`
4. Pass them to `IngredientsSection` (the props already exist — just populate them).
5. **DO NOT** touch the `IngredientsSection.tsx` component itself. Its existing checkmark rendering and "+ Add N missing" / "+ Add all" buttons already consume these props — they'll light up automatically once populated.

**Part 2b — `RecipeListScreen.tsx`:**

1. Add a new sort option to the `SortOption` type union: `'pantry_match'`.
2. Add the option to the `renderSortPickerModal` options array:
   - `{ value: 'pantry_match', IconComponent: PantryOutline (from `components/icons`), label: 'Pantry Match %' }`
   - Insert it second in the options list (after the current first option), so it's prominent.
3. Add state: `const [matchMap, setMatchMap] = useState<Map<string, PantryMatchResult>>(new Map());`
4. In the existing recipes-load `useEffect`, after recipes are loaded: call `calculateRecipeSupplyMatchBulk(recipeIds, activeSpaceId)` where `recipeIds = recipes.map((r) => r.id)`. Store the result in `matchMap`.
5. Re-run the bulk call when `activeSpaceId` changes (add to the dep array).
6. In the sort logic where `filteredRecipes` is derived:
   - When `sortOption === 'pantry_match'`: sort by `(matchMap.get(recipe.id)?.matchPercentage ?? 0)` descending.
7. **DO NOT** change the existing default sort behavior or any other sort option.

### Part 3 — Smoke tests

**Action:** Add a temporary test runner — a function that executes the 13 test scenarios below and logs results via `console.warn`. Wire it to a hidden trigger so Tom can fire it from an admin/debug surface.

**Location options (pick the one with lowest blast radius):**
- New file: `lib/services/_pantryMatchingSmokeTest.ts`. Export a function `runPantryMatchingSmokeTests(spaceId: string): Promise<void>`.
- Wire a hidden invocation from `screens/AdminScreen.tsx` (if it exists) — add a button "Run pantry matching smoke tests" that calls the function with the current space ID.
- If `AdminScreen.tsx` doesn't exist, expose the test runner via a `console.log` instruction in the SESSION_LOG entry — Tom can call it from a React Native debugger console.

**Test scenarios:**

The smoke test should set up via a discovery query (find or create the necessary test data in the current space), execute the assertions, then clean up. Test scenarios (all assert via `console.warn('[SMOKE-N]', result, expected)`):

1. **Exact match.** Recipe A needs ingredient X (base ingredient). User has supply X, status=in_stock. Assert: X in `matched[]`.
2. **Variant match (forward).** Recipe needs "extra-virgin olive oil" (variant). User has "olive oil" (base) supply. Assert: EVOO ingredient_id in `matched[]` via base traversal.
3. **Variant match (reverse).** Recipe needs "olive oil" (base). User has "extra-virgin olive oil" (variant) supply. Assert: olive oil in `matched[]`.
4. **Vinegar tree.** Recipe needs "white wine vinegar". User has "vinegar" (base) supply. Assert: WWV in `matched[]` (verifies SF-5 promotion).
5. **Cheese post-cleanup.** Recipe needs "feta cheese" (post-Part-0 should now be re-pointed to canonical "feta"). User has "feta" supply. Assert: feta in `matched[]`.
6. **Salt at in_stock.** Recipe needs "kosher salt". User has "salt" supply at status=in_stock. Assert: salt in `matched[]` (variant match, no special staple treatment).
7. **Salt at out.** Recipe needs "salt". User has "salt" supply at status=out. Assert: salt in `missing[]`.
8. **Salt at low.** Recipe needs "salt". User has "salt" supply at status=low. Assert: salt in `matched[]`.
9. **Salt at critical.** Recipe needs "salt". User has "salt" supply at status=critical. Assert: salt in `matched[]`.
10. **Salt at unknown.** Recipe needs "salt". User has "salt" supply at status=unknown. Assert: salt in `missing[]` (status=unknown excluded from match query).
11. **Salt archived.** Recipe needs "salt". User has "salt" supply with `archived_at` set. Assert: salt in `missing[]`.
12. **Form mismatch.** Recipe needs ingredient with `form='dried'`. User has same ingredient (or variant) with `form='fresh'`. Assert: ingredient in `matched[]`, `formMismatch={recipeForm:'dried', supplyForm:'fresh'}`.
13. **Custom-name supply.** User has a supply with `ingredient_id=NULL`, `custom_name='Motor City'`. Recipe needs any ingredient. Assert: custom-name supply is NOT in any recipe's `matched[]`.

**Edge case:** also call `calculateRecipeSupplyMatch` against a recipe with zero `recipe_ingredients` rows (or `recipe_id` that doesn't exist) and assert no crash, `matchPercentage=0`, `totalCount=0`.

**Bulk path verification:** call `calculateRecipeSupplyMatchBulk` with 5 known recipe IDs and assert:
- Returns a Map with exactly 5 entries.
- Each entry's `matchPercentage` matches the result from calling `calculateRecipeSupplyMatch` on the same recipe individually.
- Note in the SESSION_LOG how many Supabase queries fired during the bulk call (use the Supabase logs panel or a query counter if convenient — best-effort, not a hard pass/fail).

**Instrumentation lifecycle:** This smoke test is temporary. Mark the file with a `// TEMP — remove after 8D-CP3 ships` comment. CP3 or a later phase removes it.

---

## Constraints

- **Services own all Supabase calls.** `RecipeDetailScreen` and `RecipeListScreen` MUST NOT call Supabase directly for matching — they call `pantryMatchingService.ts` functions only.
- **Do not modify `components/recipe/IngredientsSection.tsx`.** Its prop interface and rendering logic are correct as-is; CP1 only needs to populate the props from the parent screen.
- **Do not change the default sort option** in `RecipeListScreen.tsx`. New sort option is added but `'newest'` remains the default.
- **Do not delete or refactor any existing functionality.** All Phase 7 / 8R surfaces continue working.
- **Do not run the cheese cleanup SQL.** It's a Tom-runs-in-Supabase task. CC only commits the SQL file.
- **STOP and report** if any schema fact in "Inputs to read" turns out to differ from the prompt's claim.
- **Part 4 from the locked plan (5 stale `pantry_items` query sites) is explicitly out of scope** for this prompt. Do not touch `lib/services/spaceService.ts` lines 182/318/416 or `lib/services/statsService.ts` lines 2033/2456. They're being audited separately.

---

## Verification

Before writing the SESSION_LOG entry, verify each of the following and report inline in the entry:

1. **TypeScript compiles cleanly.** Run `npx tsc --noEmit` and report any new errors introduced by CP1 changes. Pre-existing errors elsewhere in the codebase can be noted but are not blockers.
2. **`pantryMatchingService.ts` exports the expected names.** Grep for `export` in the new file and confirm: `MatchedIngredient`, `PantryMatchResult`, `calculateRecipeSupplyMatch`, `calculateRecipeSupplyMatchBulk`.
3. **`RecipeDetailScreen` consumes the match result.** Grep for `calculateRecipeSupplyMatch` in `screens/RecipeDetailScreen.tsx`.
4. **`RecipeListScreen` has the new sort option.** Grep for `'pantry_match'` in `screens/RecipeListScreen.tsx`.
5. **Cheese cleanup SQL committed to repo.** Run `git ls-files docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` — should return the path.
6. **`IngredientsSection.tsx` unchanged.** Run `git diff components/recipe/IngredientsSection.tsx` — should be empty.

On-device verification (Tom runs separately, after CC reports done):
- After Tom runs the cheese cleanup SQL, open RecipeDetailScreen on a recipe that uses ingredients Tom has in his supplies. Confirm green ✓ marks appear next to matched ingredients.
- Open RecipeListScreen, switch sort to "Pantry Match %", confirm recipes re-order by descending match percentage.
- Open AdminScreen (or invoke the smoke test runner from the React Native debugger console). Verify all 13 smoke assertions pass.

---

## SESSION_LOG entry format

Append the entry at the TOP of `docs/SESSION_LOG.md` with the following structure:

```markdown
## 2026-MM-DD — Phase 8D CP1: matching primitive + cheese cleanup + wiring
**Phase:** 8D
**Prompt from:** CC_PROMPT_8D_CP1.md

[Body: what was done, files touched, verification results, surprises/notes.]

**Files modified:**
- `lib/services/pantryMatchingService.ts` (NEW, ~XXX lines)
- `lib/services/_pantryMatchingSmokeTest.ts` (NEW, temp — ~XXX lines)
- `screens/RecipeDetailScreen.tsx` (wiring) ⚠️ PK snapshot now stale (was YYYY-MM-DD)
- `screens/RecipeListScreen.tsx` (sort option + bulk wiring) ⚠️ PK snapshot now stale (was YYYY-MM-DD)
- `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` (NEW)

**Verification results:**
- TypeScript: [N new errors / clean]
- Exports verified: ✅
- RecipeDetailScreen wiring: ✅
- RecipeListScreen sort wiring: ✅
- Cheese SQL committed: ✅
- IngredientsSection unchanged: ✅

**Bulk-path query count (best effort):** N queries fired for 5-recipe bulk call (target: 3).

**Smoke test trigger location:** [AdminScreen button / debugger console / other]

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md`: add `lib/services/pantryMatchingService.ts` to services table; note new RecipeListScreen sort option.
- `DEFERRED_WORK.md`: T8 (5 stale pantry_items sites) still pending — explicit reminder that CP1 deferred it.
- `PROJECT_CONTEXT.md`: 8D-CP1 flip from 🔲 to 🟢 (mid-CP) or ✅ (if all parts shipped clean).
- `FF_LAUNCH_MASTER_PLAN.md`: mark 8D-CP1 complete in phase table if Tom confirms on-device.

**Recommended next steps for Tom:**
1. Run the cheese cleanup SQL in Supabase SQL editor (Part 0). Verify Phase 1 discovery output looks right before committing.
2. On-device: open a recipe with ingredients Tom has stocked → confirm ✓ marks appear.
3. On-device: open Recipes tab → Sort menu → switch to "Pantry Match %" → confirm reorder.
4. Run the smoke test runner — paste the 13 console.warn results in chat for Claude.ai to triage.
5. If all green, Claude.ai drafts the repo cleanup follow-up prompt for the 5 stale pantry_items sites (Part 4 deferred).

**Surprises / Notes for Claude.ai:**
[Anything unexpected during execution. Schema mismatches, ambiguity in instructions, places where the prompt's assumptions didn't hold.]
```

---

## Open questions (STOP conditions)

If any of the following turn out to be true, STOP and report — do not proceed:

1. **`base_ingredient_id` is missing or has different semantics** than described in D8D-Q1.
2. **`supplies.status` enum values differ** from the documented `in_stock / low / critical / out / unknown` set.
3. **`recipe_ingredients` has a different shape** (e.g., `ingredient_id` is in a different column or it's the wrong table).
4. **`IngredientsSection.tsx` no longer accepts `availableIngredientIds` and `missingCount` props.** If the prop shape changed, surface it before wiring.
5. **`RecipeListScreen.tsx` sort type is structured differently** than the planning expects (e.g., sort is on a context or service, not local state).

Report findings; Claude.ai will reconcile before proceeding.
