# Phase 8D — Recipe-Pantry Matching

**Version:** 0.2 (decisions locked)
**Created:** 2026-05-15
**Status:** 🔲 Planning complete — ready for CP1 prompt drafting
**Estimated:** 3-4 sessions total
**F&F-blocker:** Yes

---

## Why this phase exists

Verified 2026-05-15 via code-level grep: **no recipe-pantry matching code currently exists in the codebase.** The old `pantryService.calculatePantryMatchPercentage` family was deleted with the 8R schema purge and never re-implemented against the new `supplies` model. Recipe surfaces have no pantry indicators today.

The catalog substrate work shipped during the CP6d/CP6e period — `base_ingredient_id` linkage, `form` column, vinegar promotion (SF-5), cheese variant additions, plural_name audit — is investment with no current consumer. The moment 8D-CP1 lands, that investment starts paying off.

F&F-blocker because:
- "What can I cook with what I have" is stated F&F success criterion
- Recipe ingredient rows on `RecipeDetailScreen` currently show no pantry state
- The 8D-CP3 recipe tap-sheet (D6-18 deferred feature) is a must-have on the master plan
- The What-can-I-cook screen (CP4) is the most-flagged pre-F&F utility feature

---

## Architecture (locked)

### Where the primitive lives

New module at `lib/services/pantryMatchingService.ts`.

Rationale: clear single responsibility (matching only — not CRUD, not state cycling), easy to test, doesn't pollute `suppliesService` (already 1000+ lines).

### Signature contract

```typescript
export interface MatchedIngredient {
  ingredientId: string;
  supplyId: string;          // the supply that satisfied the match
  formMismatch: {            // null when no form data on either side or forms equal
    recipeForm: string;
    supplyForm: string;
  } | null;
}

export interface PantryMatchResult {
  recipeId: string;
  matchPercentage: number;          // 0.0 - 1.0
  matched: MatchedIngredient[];     // ingredients with a matching supply (status in_stock/low/critical)
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

Consumers: `RecipeDetailScreen` (single recipe, drives tap-sheet), `RecipeListScreen` (bulk for tiles + sort), `WhatCanICookScreen` (bulk for filtering).

### Matching algorithm (locked per Q1, Q2/Q7, Q6, Q8)

For each recipe ingredient (from `recipe_ingredients WHERE recipe_id = $1`):

**Step 1 — Resolve match group via full variant tree traversal (Q1):**
- Fetch the ingredient row from `ingredients`
- If `is_base_ingredient = true`: match group = `[this.id]` plus all variant rows pointing to it via `base_ingredient_id`
- Else if `base_ingredient_id IS NOT NULL`: match group = the full variant family — query `ingredients WHERE base_ingredient_id = this.base_ingredient_id` PLUS the base itself
- Else (orphan): match group = `[this.id]`

**Step 2 — Check supplies:**
- Query: `supplies` WHERE `space_id = $spaceId` AND `ingredient_id IN (match_group)` AND `archived_at IS NULL` AND `status != 'unknown'`
- If `ingredient_id IS NULL` on a supply (custom_name supply), it cannot match a recipe ingredient — by design (Q6). The filter `ingredient_id IN (match_group)` excludes these naturally.

**Step 3 — Status-based match resolution (Q2/Q7):**
- Supply found AND `status IN ('in_stock', 'low', 'critical')` → **matched** (user has some — push to `matched[]`)
- Supply found AND `status = 'out'` → **missing** (supply exists but user is out)
- No supply found → **missing**

**Step 4 — Form comparison (opportunistic, Q8):**
- For each matched ingredient, compare `recipeIngredient.ingredient.form` vs `supply.ingredient.form`
- If both non-null AND different → set `formMismatch = { recipeForm, supplyForm }`
- If either null or equal → set `formMismatch = null`
- No matches are rejected based on form mismatch — this is a UI signal only (CP3 surfaces it; CP4 ignores it for section bucketing)

**Step 5 — Compute percentage:**
- `matchPercentage = matchedCount / totalCount`
- No special "exclude staples from denominator" math (Q2/Q7) — all recipe ingredients count toward total
- Edge case: if recipe has zero ingredients (data anomaly), return `matchPercentage = 0`

### tracking_mode does NOT participate in matching (Q5)

Per code inspection 2026-05-15, `tracking_mode` has two values:
- `'restock'` — spawn need on out (regular "I keep this stocked" behavior)
- `'track_only'` — auto-archive on out (no spawn)

This enum governs **spawn behavior on out-transitions**, not match semantics. The matcher reads `status` and `archived_at`; `tracking_mode` is ignored in the match path.

### Bulk function optimization

For N recipes:
1. One query: get all `recipe_ingredients` for the N recipes (collect distinct ingredient_ids)
2. One query: resolve all match groups by joining `ingredients` to itself on `base_ingredient_id` for the universe of distinct ids
3. One query: get all supplies in space with `ingredient_id IN (full match-group universe)` AND `archived_at IS NULL` AND `status != 'unknown'`
4. Assemble per-recipe in memory

Target: bulk for N=200 recipes runs in 3 queries total. Critical for `RecipeListScreen` perf.

---

## Build plan — 4 effective CPs (CP2 dissolves)

### CP1 — Matching primitive + cheese cleanup migration + form comparison wiring (~1.25 sessions)

**Part 0 — Cheese duplicate cleanup migration (runs FIRST, as SQL migration).**

Known orphan pairs from 2026-05-14 catalog work:
- `feta` ← canonical; `feta cheese` ← orphan
- `mozzarella`, `cheddar`, `parmesan`, `brie`, `swiss`, `monterey jack`, `ricotta`, `gouda`, plus `kashkaval`, `manouri` (confirm pair structure during CC audit)

Claude.ai will pre-write the migration SQL in the CP1 prompt (per Q4). Structure:

```sql
BEGIN;

-- Phase 1: Discovery — identify orphan/canonical pairs, output for Tom's review
WITH orphan_pairs AS (
  SELECT
    orphan.id AS orphan_id, orphan.name AS orphan_name,
    canon.id AS canonical_id, canon.name AS canonical_name
  FROM ingredients orphan
  JOIN ingredients canon
    ON LOWER(canon.name) = LOWER(REGEXP_REPLACE(orphan.name, ' cheese$', '', 'i'))
  WHERE LOWER(orphan.name) ~ ' cheese$'
    AND orphan.base_ingredient_id IS NULL
    AND canon.id != orphan.id
)
SELECT * FROM orphan_pairs;  -- Tom reviews before next phase

-- Phase 2: Update recipe_ingredients FKs
UPDATE recipe_ingredients ri
SET ingredient_id = pairs.canonical_id
FROM (... orphan_pairs CTE ...) pairs
WHERE ri.ingredient_id = pairs.orphan_id;

-- Phase 3: Update supplies FKs (with collision safety)
UPDATE supplies s
SET ingredient_id = pairs.canonical_id
FROM (... orphan_pairs CTE ...) pairs
WHERE s.ingredient_id = pairs.orphan_id
  AND NOT EXISTS (
    SELECT 1 FROM supplies s2
    WHERE s2.space_id = s.space_id AND s2.ingredient_id = pairs.canonical_id
  );

-- Collision case: user had BOTH feta and feta cheese in same space. Archive the orphan-side.
UPDATE supplies SET archived_at = NOW()
WHERE ingredient_id IN (SELECT orphan_id FROM orphan_pairs)
  AND archived_at IS NULL;

-- Phase 4: Delete orphan ingredient rows
DELETE FROM ingredients WHERE id IN (SELECT orphan_id FROM orphan_pairs);

COMMIT;
```

Verification queries before commit:
- Zero `recipe_ingredients` rows still point to orphan IDs
- Zero non-archived `supplies` rows still point to orphan IDs
- Row counts at each phase match expected pair count

**Part 1 — Build `pantryMatchingService.ts`** per the contract + algorithm above.

**Part 2 — Wire to two consumers:**
- `RecipeDetailScreen` — call `calculateRecipeSupplyMatch` on focus; hold result in state; pass to whatever UI consumes it (CP3 wires the UI proper; CP1 just gets data plumbed and renders a basic match % indicator in the header)
- `RecipeListScreen` — call `calculateRecipeSupplyMatchBulk` for the visible recipe set; expose as a sortable column

**Part 3 — Smoke tests** (CC writes console.log assertions, not real tests):
- Recipe with all-base ingredients matches when user has those ingredients as supplies (status=in_stock)
- Recipe with "extra-virgin olive oil" matches when user has "olive oil" as supply (base_ingredient_id traversal)
- Recipe with "olive oil" matches when user has "extra-virgin olive oil" as supply (reverse traversal)
- Recipe with "feta cheese" matches when user has "feta" supply (post-cheese-cleanup)
- Recipe with "kosher salt" matches when user has "salt" supply at status=in_stock (no special staple treatment — just supply match)
- Recipe with "salt" misses when user has "salt" supply at status=out
- Recipe with "salt" matches when user has "salt" supply at status=low or critical (low/critical count as "have some")
- Form mismatch: recipe wants "dried basil" (form=dried), supply has "basil" (form=fresh) — match returned with formMismatch populated
- Custom-name supply (`ingredient_id=NULL`) doesn't satisfy any recipe ingredient (by design)

**Part 4 — Address 5 stale `pantry_items` query sites** (discovered during 8D verification):
- `lib/services/spaceService.ts` lines 182, 318, 416
- `lib/services/statsService.ts` lines 2033, 2456

Decision pending CC's audit report from the repo-cleanup pass: each site is either (a) dead code → delete, or (b) live feature reading from a dropped table → re-point to `supplies` or rewrite the query.

Bundle in CP1 if straightforward; spawn separate prompt if it widens scope.

**Estimate:** ~1.25 sessions. The matching logic is ~200 lines including SQL queries. Cheese migration is mechanical. Form comparison adds ~30 lines spread across CP1 + CP3.

### CP3 — Recipe tap-sheet on RecipeDetail ingredient rows (~1.5 sessions)

Implements D6-18 deferred feature.

Existing Phase 6G IngredientsSection layout preserved 1:1 (group headers, `✓ qty unit <n>, prep` format). Rows become tappable. Tap opens inline tap-sheet directly below row (not overlay).

Actions adapt to ingredient state from the matching result:

- **Matched (status=in_stock/low/critical):** See more / Update qty / Which step? / Other recipes
  - If `formMismatch` is non-null: small annotation "form: dried (recipe) ↔ fresh (you have)" — opportunistic form comparison surface (Q8)
- **Matched but low/critical:** + above, plus "+ Need now" affordance (user might want to add to grocery)
- **Missing:** + Need now / Substitute / Add to supplies / See more

"+ Need now" creates a need via existing `addNeedFromRecipe` service flow. "Add to supplies" routes to `SupplyCreateSheet` pre-populated.

Wireframes exist in `docs/wireframes/phase_8/` v5 (preserved from Phase 8 era; should be cross-referenced during CP3 prompt drafting).

**Estimate:** 1.5 sessions. Touches a high-traffic file (RecipeDetailScreen) but most of the design is settled in wireframes. Tap-sheet component is new but standalone.

### CP4 — What-can-I-cook screen (~1 session)

Single "Ready now" section per Q3.

Criterion: `matchPercentage >= 0.90` AND every ingredient in `recipes.hero_ingredients` resolves to a matched supply (per Q3 + hero_ingredients = "critical" confirmation).

Hero ingredients live on `recipes.hero_ingredients` as a JSONB array of `{ingredient_id, name}`. The check: for each hero ingredient, that ingredient_id (or any in its match group via base traversal) must appear in the recipe's `matched[]` list (i.e., not in `missing[]`).

Surface:
- Subset-search bar at top
- Locked filter chip: "Pantry: 90%+ match"
- Scrollable list of matching recipes, sortable by match % descending
- Empty state when zero recipes qualify: "Nothing's quite ready right now — review your supplies or browse recipes that need a shopping trip"

Auto-hides when empty (per existing locked-filter-chips pattern).

Reachable from: PantryScreen ("What can I cook?" CTA), possibly Recipes tab entry point.

**Estimate:** 1 session. New screen but uses proven patterns. CP4 was the biggest cost in v0.1 of this doc (1.5 sessions, 5 sections) — collapses cleanly to 1 with single-section criterion.

### CP5 — Missing-to-grocery one-tap from recipe (~0.5 sessions)

Banner CTA on RecipeDetail when `matchPercentage < 1.0`: "85% in pantry · add missing →"

Tap → bottom sheet listing the missing ingredients with checkboxes (default all-checked). Confirm → bulk `addNeedFromRecipe` writes needs with `priority_reason: 'for X recipe'`, urgency=this-week, recipe-tagged.

Per-row "+ Need now" action on the CP3 tap-sheet provides the single-ingredient variant.

**Estimate:** 0.5 sessions. Small, uses existing service flows.

---

## Decisions log (all locked)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8D-Q1 | 2026-05-15 | Match group traversal depth | Full variant tree — all variants sharing same base treated as interchangeable. Bidirectional. Substitution recommendations deferred post-F&F. |
| D8D-Q2 | 2026-05-15 | Staple exclusion math | (b) auto-match. Supplies just match like any other; no special denominator math. Status=in_stock/low/critical → matched; status=out → missing. |
| D8D-Q3 | 2026-05-15 | CP4 section count and criterion | ONE section ("Ready now"). Criterion = 90%+ match AND all hero_ingredients matched (not status=out). |
| D8D-Q4 | 2026-05-15 | Cheese cleanup SQL authorship | Claude.ai pre-writes the migration in the CP1 prompt. CC executes with discovery-output verification before committing the destructive phases. |
| D8D-Q5 | 2026-05-15 | tracking_mode role in matching | None. tracking_mode values are `'restock'` / `'track_only'` (verified via PK grep) and govern spawn behavior on out-transitions, NOT match semantics. Matcher reads `status` + `archived_at` only. |
| D8D-Q6 | 2026-05-15 | Custom-name supplies in matching | Don't match recipe ingredients (intended behavior). `ingredient_id IS NULL` supplies are non-cataloged items not present in recipes. |
| D8D-Q7 | 2026-05-15 | Critical ingredients definition | `recipes.hero_ingredients` (Phase 3 AI-classified defining ingredients). CP4 criterion uses this. |
| D8D-Q8 | 2026-05-15 | Form comparison inclusion | INCLUDED as opportunistic. `MatchedIngredient.formMismatch` populated when `ingredient.form` differs across sides AND both non-null. Surfaces in CP3 tap-sheet annotation. No matches rejected based on form mismatch. Catalog form coverage improves over time; F&F gets partial-but-correct experience. |
| D8D-Q9 | 2026-05-15 | Quantity-aware matching | OUT OF SCOPE for F&F. Reason: `tracks_lots` adoption is opt-in and small at F&F scale; existence-matching delivers higher utility-per-effort. Not technical difficulty (~2-3 sessions if pursued). Revisit post-F&F when tester behavior tells us about quantity-mindset users. |
| D8D-Q10 | 2026-05-15 | Match caching layer | OUT OF SCOPE. 3-query bulk path is fast enough at F&F scale (5-10 testers, ~475 recipes). Revisit if user-visible latency surfaces. |
| D8D-Q11 | 2026-05-15 | Multi-space cross-match | OUT OF SCOPE. F&F UX is single-active-space (SpaceContext). Theoretical use case only. |
| D8D-Q12 | 2026-05-15 | Category-level matching ("any cheese") | OUT OF SCOPE. Base_ingredient_id traversal handles same-thing-different-form cases. Cross-variant substitution is a separate v2 feature. |
| D8D-Q13 | 2026-05-15 | Recipe substitution engine | OUT OF SCOPE. Tom: "eventually I'll want substitutions" — Phase 11 stretch or post-F&F. Big design space (substitution data, culinary context). |

---

## Test inventory (used to verify CP1 + CP3 + CP4)

These should produce predictable results post-CP1:

| Scenario | Setup | Expected | Verifies |
|---|---|---|---|
| Exact match | Recipe needs ingredient A; supply has A at status=in_stock | A in matched[] | Base case |
| Variant match | Recipe needs "extra-virgin olive oil"; supply has "olive oil" | EVOO in matched[] via base_ingredient_id | Traversal |
| Reverse variant | Recipe needs "olive oil"; supply has "extra-virgin olive oil" | Olive oil in matched[] | Bidirectional traversal |
| Vinegar tree | Recipe needs "white wine vinegar"; supply has "vinegar" (base) | WWV in matched[] | SF-5 vinegar promotion |
| Cheese post-cleanup | Recipe needs "feta cheese"; supply has "feta" | Feta in matched[] | CP1 Part 0 migration |
| Cheese pre-cleanup (negative) | Recipe needs "feta cheese"; supply has "feta"; migration NOT yet run | Feta in missing[] | Demonstrates migration necessity |
| Salt matched | Recipe needs "kosher salt"; supply "salt" at status=in_stock | Salt in matched[]; no special handling | Q2/Q7 simplified |
| Salt low | Recipe needs "salt"; supply "salt" at status=low | Salt in matched[] | low/critical count as "have" |
| Salt out | Recipe needs "kosher salt"; supply "salt" at status=out | Salt in missing[] | Out trumps match |
| Salt unknown | Recipe needs "salt"; supply "salt" at status=unknown | Salt in missing[] (no supply qualifies) | Unknown filtered out |
| Salt archived | Recipe needs "salt"; supply "salt" with archived_at set | Salt in missing[] | Archived filtered out |
| Form match | Recipe needs "fresh basil" (form=fresh); supply has "basil" (form=fresh) | Basil in matched[], formMismatch=null | Same form |
| Form mismatch | Recipe needs "dried basil" (form=dried); supply has "basil" (form=fresh) | Basil in matched[], formMismatch={recipeForm:'dried', supplyForm:'fresh'} | Q8 opportunistic |
| Form data missing | Recipe ingredient.form=null; supply ingredient.form=null | matched[], formMismatch=null | No false positives on missing data |
| Missing | Recipe needs ingredient B; no supply for B | B in missing[] | Base missing case |
| Custom-name supply | Supply with ingredient_id=NULL, custom_name="Motor City"; recipe needs anything | Custom-name supply ignored | Q6 |
| CP4 ready-now match | Recipe at 95% match, all 3 hero_ingredients matched | In "Ready now" | CP4 criterion |
| CP4 percent-fail | Recipe at 85% match, all hero_ingredients matched | NOT in "Ready now" | 90% threshold |
| CP4 hero-fail | Recipe at 95% match, 1 of 3 hero ingredients status=out | NOT in "Ready now" | Hero check |
| Edge: zero ingredients | Recipe with empty recipe_ingredients (data anomaly) | matchPercentage=0, no crash | Defensive |

---

## Dependencies

- `ingredients` table: `base_ingredient_id` (FK to self), `is_base_ingredient`, `form` (consumed for form comparison)
- `recipe_ingredients` table: `ingredient_id` FK to ingredients
- `recipes.hero_ingredients` (JSONB array of `{ingredient_id, name}`) — for CP4 criterion
- `supplies` table: `space_id`, `ingredient_id`, `status`, `archived_at` (NOT `tracking_mode`)
- Active space context via `SpaceContext` / `useActiveSpaceId()`

No new schema. CP1 Part 0 modifies existing rows but no DDL changes beyond data migration.

---

## Stale `pantry_items` query sites (CC audit pending)

5 sites discovered during 8D verification, reading from dropped table:
- `lib/services/spaceService.ts` lines 182, 318, 416
- `lib/services/statsService.ts` lines 2033, 2456

CC's repo-cleanup pass (Part 4 of `CC_PROMPT_repo_cleanup_2026-05-15.md`) audits each site without modifying code. Per-site decision (Claude.ai reviews CC's report):
- (a) Dead code → delete the call site
- (b) Live feature reading from dropped table → re-point to `supplies` (rewrite the query against new model)

Bundle resolution into CP1 if straightforward; spawn separate prompt if scope widens.

---

## Out of scope (post-F&F)

Items locked OUT of scope (Q9-Q13):

| Item | Why out | When to revisit |
|---|---|---|
| Quantity-aware matching | Low F&F data coverage (tracks_lots is opt-in); not technical difficulty | Post-F&F when tester behavior surfaces demand |
| Category-level matching | Base_ingredient_id covers same-thing-different-form; cross-variant substitution is separate v2 feature | Post-F&F user-configurable opt-in |
| Recipe substitution engine | Phase 11 stretch or post-F&F; pairs with concept cooking | Post-F&F |
| Multi-space cross-match | F&F UX is single-active-space | If/when multi-space UX gets a real use case |
| Match caching | F&F volumes don't need it | If latency surfaces in testing |
| Pantry-match-affecting form rejection | v1 lets all variants match (with annotation); user decides | v2 when substitution engine lands |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-15 | 0.2 | **Decisions locked.** All 7 open questions resolved by Tom + tracking_mode actual values confirmed via PK grep. Scope simplified: CP2 dissolves into CP1 (no special staple math); CP4 collapses from 5 sections to 1 (90% + hero_ingredients criterion). Form comparison INCLUDED as opportunistic (CP1 returns formMismatch; CP3 renders annotation). 13 decisions captured in decisions log (D8D-Q1 through Q13). Test inventory expanded with form match/mismatch cases + edge cases. Estimated total down from 3.5-4.5 to 3-4 sessions. Ready for CP1 prompt drafting. |
| 2026-05-15 | 0.1 | Initial scoping draft created post-8D verification (NOT SHIPPED finding). 5 CPs scoped; 7 open questions raised. |
