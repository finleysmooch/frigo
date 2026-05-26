# CC Prompt — Phase 8D CP2 Patch: Substitution Whitelist + Null-Form Wildcard

**Date:** 2026-05-19
**Estimated:** ~30-45 minutes
**Authored by:** Claude.ai planning, 2026-05-19
**Purpose:** Patch the CP2 4-level matcher with two gating rules that prevent confusing/incorrect substitution signals from reaching F&F testers:
1. **L3 + L2 substitutability whitelist** — only ~75 hand-validated subtypes fire form_variant and substitute matches; the rest demote to L4 missing. Closes the "you have banana ≈ mango" class of false positives.
2. **Null-form wildcard rule** — within whitelisted subtypes, when either side of a pair has form=NULL, treat as L1 exact (silent ✓). Closes the "you have a different form" confusing copy on generic-base rows like `sugar`, `vinegar`, and citrus whole fruits.

Also captures the rationale and post-F&F roadmap in a new `SUBSTITUTION_INTELLIGENCE_ROADMAP.md` doc.

**Resolves:** No new T-items closed by this work itself. Adds T30 (subtype audit + split — post-F&F project bucket).

---

## Context

CP2 shipped the 4-level matcher 2026-05-19. Tom dogfooded immediately and surfaced two classes of bad UX:

1. **Cross-fruit substitute warnings.** Recipe wants mango; user has banana → matcher fires L3 "Close: you have banana." Both share `subtype='tropical_fruit'`, but banana ≠ mango. Same problem visible across cheese (38 rows), leafy_green (21), fish (19), and ~40 other coarse subtype groupings. The subtypes were designed under D8D-Q1 "soft-match category" semantics; they encode loose family relationship, not substitutability.

2. **Null-form L2 noise.** Recipe wants `sugar` (form=NULL — generic catalog row); user has `granulated sugar`. Matcher correctly identifies same subtype + different form → L2 form_variant. But the sub-line copy renders as "you have granulated; recipe wants a different form" because the recipe-side form is NULL. Same pattern across vinegar (`vinegar` generic row + named-specific), citrus (whole fruit + juice form variants), and a handful of generic-base rows.

**Strategic call:** rather than auditing all ~80 multi-member subtypes for substitutability (multi-session project), gate L2/L3 by a hand-validated whitelist of ~75 subtypes where the substitution signal is reliable. Non-whitelisted L2/L3 demote to L4 (missing). The matcher logic and 4-level enum stay intact — only one constant + one conditional change.

The whitelist was curated 2026-05-19 against the full catalog discovery output (113 multi-member subtypes, 604 rows total). Tom approved as Option (a) — accept-as-listed for F&F.

---

## Inputs to read

1. **`lib/services/pantryMatchingService.ts`** — current 4-level matcher (post-CP2 state). Public API unchanged by this patch. The per-recipe-ingredient assembly loop is where the whitelist gate + null-form rule slot in.
2. **`lib/services/_pantryMatchingSmokeTest.ts`** — existing harness. New SMOKE-CP2-WL* and SMOKE-CP2-NF* scenarios append to the existing CP2 set.
3. **`components/recipe/IngredientsSection.tsx`** — read-only verification that no UI changes are needed. The component renders `level` directly; the matcher demoting non-whitelisted L3 → missing[] handles all UI flow automatically.
4. **`docs/PHASE_8_PANTRY_AND_GROCERY.md`** — CP2 results section gets a "Patch" sub-entry.
5. **`docs/DEFERRED_WORK.md`** — T30 added (subtype audit/split roadmap).
6. **`docs/SESSION_LOG.md`** — today's `## 2026-05-19` header; this patch's entry appends below the existing CP2 entries.

**Schema verification (read-only):** no schema changes required. The matcher reads `ingredient_subtype` and `form` (existing columns); the whitelist is a hardcoded const in `pantryMatchingService.ts`.

---

## Task

Execute Part 1 → Part 5 in order. Single fused commit when done — no Part-by-Part commits this time, since the work is tightly coupled.

### Part 1 — Add `SUBSTITUTABLE_SUBTYPES` constant

In `lib/services/pantryMatchingService.ts`, near the top of the file (after imports, before the existing types block), add:

```typescript
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
```

### Part 2 — Patch the per-recipe-ingredient assembly loop

In `calculateRecipeSupplyMatchBulk`'s per-ingredient assembly loop, the existing order is approximately:

```
1. always_available skip (level='always_available' → matched)
2. L1 exact via match group walk (level='exact' → matched)
3. L2 form_variant (same subtype, different form, level='form_variant' → matched)
4. L3 substitute (same subtype, same form, level='substitute' → matched)
5. L4 → missing[]
```

**Modify the flow to (changes in CAPS):**

```
1. always_available skip (unchanged)
2. L1 exact via match group walk (unchanged)
3. RESOLVE recipe.ingredient_subtype. If NULL or NOT IN SUBSTITUTABLE_SUBTYPES → missing[]; continue.
4. NULL-FORM WILDCARD: if recipe.form IS NULL OR any subtype_candidate.form IS NULL:
   - Pick best subtype_candidate via existing pick_best_supply (created_at DESC tie-break).
   - matched.push(level='exact', supplyId, formMismatch=null, reason='You have it')
   - continue
5. L2 form_variant: filter candidates where form differs from recipe.form. If any → push best as form_variant. continue.
6. L3 substitute: filter candidates where form === recipe.form. If any → push best as substitute. continue.
7. L4 → missing[]
```

**Key behavioral changes:**

- **Non-whitelisted subtypes skip L2/L3 entirely.** Recipe wants `salmon` (subtype='fish'), user has `tuna` → not whitelisted → straight to missing[]. Salmon shows in the "+ Add missing" button, doesn't count toward matched%.
- **Whitelisted subtypes with NULL form on either side → L1 silent.** Recipe wants `sugar` (form=NULL), user has `granulated sugar` → null-form rule fires → L1 exact, green ✓, no sub-line. The L2 path doesn't see it.
- **Whitelisted subtypes with both forms populated** → L2 if forms differ (yellow ⚠ with form sub-line), L3 if equal (yellow ≈ with substitute sub-line). Existing CP2 behavior preserved.

**Implementation note:** the gate at step 3 SHORT-CIRCUITS the rest of the subtype logic for non-whitelisted subtypes. This is the key efficiency property — no wasted L2/L3 candidate filtering for subtypes we'd demote anyway. The check is a simple `SUBSTITUTABLE_SUBTYPES.has(subtype)`.

**Edge case to preserve:** if recipe.ingredient_subtype is NULL (defensive — should never trigger post-CP1.5), still fall to missing[] as in the current code. NULL subtype ≠ whitelisted.

### Part 3 — Add smoke test scenarios

Append to `lib/services/_pantryMatchingSmokeTest.ts`, following the existing `cp2()` helper pattern. Label new scenarios `SMOKE-CP2-WL*` (whitelist) and `SMOKE-CP2-NF*` (null-form wildcard).

**Whitelist scenarios (demotion tests — verify non-whitelisted subtypes go to missing):**

```
SMOKE-CP2-WL1  Recipe wants mango (tropical_fruit, NOT whitelisted), user has banana
               → expect: meta.id IN result.missing, NOT in matched
SMOKE-CP2-WL2  Recipe wants salmon (fish, NOT whitelisted), user has tuna
               → expect: meta.id IN result.missing
SMOKE-CP2-WL3  Recipe wants cheddar (cheese, NOT whitelisted), user has feta
               → expect: meta.id IN result.missing
SMOKE-CP2-WL4  Recipe wants jalapeño (chile, NOT whitelisted), user has habanero
               → expect: meta.id IN result.missing
```

**Whitelist scenarios (positive tests — verify whitelisted subtypes still fire L3):**

```
SMOKE-CP2-WL5  Recipe wants maple syrup (syrup, whitelisted), user has honey
               → expect: matched[meta.id].level === 'substitute' (L3 yellow ≈)
SMOKE-CP2-WL6  Recipe wants dijon mustard (mustard, whitelisted), user has yellow mustard
               → expect: matched[meta.id].level === 'substitute'
SMOKE-CP2-WL7  Recipe wants chicken stock (stock, whitelisted), user has chicken broth
               → expect: matched[meta.id].level === 'substitute'
```

**Null-form wildcard scenarios (whitelisted subtypes only):**

```
SMOKE-CP2-NF1  Recipe wants sugar (form=NULL), user has granulated sugar (form=granulated)
               → expect: matched[meta.id].level === 'exact' (null-form wildcard fires, silent ✓)
SMOKE-CP2-NF2  Recipe wants white wine vinegar (form=liquid), user has generic vinegar (form=NULL)
               → expect: matched[meta.id].level === 'exact'
SMOKE-CP2-NF3  Recipe wants lime juice (form=liquid), user has lime (form=NULL after Part 0 data work)
               → expect: matched[meta.id].level === 'exact'
```

**Form variant within whitelist (sanity — make sure L2 still fires when no NULL):**

```
SMOKE-CP2-WL8  Recipe wants black pepper (form=powder), user has black peppercorns (form=dried)
               → expect: matched[meta.id].level === 'form_variant' (L2 yellow ⚠)
```

If a scenario's catalog row isn't discoverable by name, log `SETUP-FAIL` and continue (existing pattern).

### Part 4 — New doc: `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md`

Create the file with the following contents verbatim:

```markdown
# Substitution Intelligence — Roadmap, Assumptions, and Gaps

**Status as of 2026-05-19:** F&F-ready with hand-validated whitelist gating. Full intelligence is multi-quarter roadmap.

## Current implementation (F&F)

The 4-level matcher (`pantryMatchingService.ts`) computes:

- **L1 exact** — same ingredient row OR linked via `base_ingredient_id`
- **L2 form_variant** — same `ingredient_subtype` + different `form` (only for whitelisted subtypes)
- **L3 substitute** — same `ingredient_subtype` + same `form` (only for whitelisted subtypes)
- **L4 no_match** — different subtype, or same subtype but NOT in `SUBSTITUTABLE_SUBTYPES`
- **always_available** — water/ice auto-match (no supply lookup)

L2 and L3 are surfaced only when `recipe.ingredient_subtype IN SUBSTITUTABLE_SUBTYPES`. The whitelist is hand-curated against the full catalog (113 multi-member subtypes, 604 rows total) and contains ~75 subtypes where substitution semantics are reliable. Non-whitelisted same-subtype matches (cheese, fish, leafy_green, tropical_fruit, etc.) demote to L4 missing.

A null-form wildcard rule applies within whitelisted subtypes: when either side has `form IS NULL`, treat as L1 exact (silent ✓). This handles generic-base rows like `sugar`, `vinegar`, citrus whole fruits.

## Whitelist composition (curated 2026-05-19)

**Core cooking staples:** mustard, stock, syrup, sugar, rice, vinegar, salt, neutral_oil, butter, cream

**Fruits/vegetables with valid cross-substitution:** bell_pepper, stone_fruit, berry, dried_fruit, pome_fruit, potato, winter_squash, pickled_pepper

**Carbs/grains/pasta:** pasta, whole_grain, oats, cornmeal

**Pantry depth:** nut_butter, soy_sauce, fortified_wine, preserves, yeast, coffee, paprika

**Form-variant-heavy:** pepper, oregano, thyme, basil, clove, nutmeg, ginger_spice, rosemary, parsley

**Singular/plural and minor variants:** almond, bay_leaf, brussels_sprouts, caraway, cashew, cayenne, chia_seed, coriander, dough, fenugreek, fig, flax_seed, green_beans, ice_cream, leavening, mayonnaise, miso, olive_oil, pecan, pickle, pumpkin_seed, seaweed, sesame_seeds, sprout, summer_squash, sunflower_seed, sweet_potato, thickener, vanilla, walnut, dried_lime, bbq_sauce, peanut

## Subtypes NOT in whitelist (silent-demoted to L4)

cheese (n=38), leafy_green (21), fish (19), bread (15), legume (14), shellfish (14), chile (12), beef (11), cured_meat (11), citrus (10), dried_chile (10), flour (10), mushroom (10), tomato (10), tropical_fruit (10), milk (9), onion (9), root_vegetable (9), chicken (8), hot_sauce (7), spice_blend (7), wine (7), noodle (6), plant_protein (6), pork (6), cabbage (5), chocolate (5), egg (5), finishing_oil (5), lamb (5), yogurt (5), cereal (4), cultured_dairy (4), curry_paste (4), game (4), melon (4), snack (4), spirit (4), tea (4), turkey (3), extract (3), peas (3)

These are silent-demoted because their members are too varied for substitution-class semantics. They remain valid `ingredient_subtype` groupings for other purposes (filtering, browse, categorization), but the matcher does not surface them as substitutes to users.

## Assumptions encoded

1. **Substitution is rough match, not authoritative.** The ≈ symbol means "in the same neighborhood" not "1:1 swap." Users make the final substitution judgment when cooking.
2. **Quantity/ratio adjustments are NOT modeled.** Recipe calls for honey, user has maple syrup → matcher says "Close." It does NOT say "use 25% less because maple is sweeter."
3. **Recipe context is NOT considered.** Same substitution suggestion regardless of whether it's a delicate sauce or a hearty stew.
4. **Cuisine/style adjustments are NOT modeled.** Mexican vs French oregano, light vs dark soy, etc. — all treated as substitutable within their subtypes.
5. **Compound substitutions are NOT supported.** "Broth → water + bouillon cube + soy splash" cannot be expressed in the current data model.
6. **Form variants within whitelist are trusted.** Peppercorns whole vs ground are surfaced as L2; this requires that whitelisted subtypes have internally-consistent form semantics.

## Known gaps (post-F&F roadmap)

### G1 — Subtype audit + split for currently-silent subtypes

~40 subtypes silent because too coarse for substitution semantics. Highest priority candidates for split:

- **cheese** (38 rows) — split by type (soft/hard/blue/fresh/aged/processed); largest single subtype
- **fish** (19 rows) — split by white/oily/anchovy-family/roe; substantial recipe coverage
- **leafy_green** (21) — split by raw/cooking/bitter/braising
- **tropical_fruit** (10) — split per fruit (banana, mango, coconut etc. as singletons)
- **citrus** (10) — split per fruit (lemon, lime, orange, grapefruit) per fresh-vs-spice principle
- **dried_chile** (10) — split by heat level (mild ~1k SHU / medium ~10k / hot ~50k+)
- **chile** (12) — same split logic, fresh chiles

Each requires domain-thoughtful breakdown + smoke validation. Probably 2-3 sessions of careful catalog work. Adding a subtype to the whitelist post-split is a one-line edit to `SUBSTITUTABLE_SUBTYPES`.

### G2 — Quantity-adjusted substitutions

Honey → maple syrup is 1:1; broth → water + bouillon is multi-ingredient + ratio. Real implementation needs either:
- (a) Per-pair substitution metadata (`substitution_rules` table or similar)
- (b) AI-driven substitution suggestions at recipe-cook time
- (c) Hand-curated substitution database (Carla's book pattern)

Not F&F. Multi-CP project, probably contingent on G1 landing first.

### G3 — Recipe-context substitution intelligence

"Works in a stew, not in a delicate sauce." Needs recipe categorization + substitution suitability per context. Best candidate input: Carla's book (already in DB) has high-quality in-context substitution callouts that could be ingested as training data once recipe parsing is mature enough.

### G4 — Compound substitutions

"Instead of broth you could use water + bouillon cube + soy splash" — multi-ingredient suggestions. Requires substitution-as-recipe concept, not just substitution-as-1:1-mapping. Likely needs a new data model.

### G5 — Substitution explainer copy

"Works because both are dried legumes; texture may differ." Lives in a parallel substitution-rationale system, not the matcher. Could be hand-authored for whitelisted pairs (~50 lines of copy) or AI-generated. Out of scope for F&F but easy add-on.

### G6 — Catalog deduplication

Several subtypes have singular/plural duplicates (cheddar/cheddar cheese, eggs/egg, salmon/salmon roe, etc.) and case duplicates (Fresno/fresno, jalapeño/jalapeno pepper). Cosmetic cruft from extraction. Bundle with G1 audit.

## Realistic ambition

The full vision — recipe-context-aware substitution recommendations with quantity adjustments and substitution rationale, grounded in trusted cookbook authority — is a multi-quarter project. F&F ships the foundation: rough match with honest hedging via whitelist gating.

Each gap above is a known roadmap item, not a hidden flaw. The whitelist is the explicit honesty layer — non-whitelisted subtypes show as missing rather than pretending to match.

## Editing the whitelist post-F&F

To add a subtype:
1. Verify the subtype's members are genuinely substitutable (domain check + ideally a smoke test on 2-3 real recipes).
2. Add to `SUBSTITUTABLE_SUBTYPES` const in `lib/services/pantryMatchingService.ts`.
3. Note the addition in this doc's whitelist composition section with date and reasoning.

To remove a subtype (rare):
1. Confirm no current users rely on the matched behavior for that subtype.
2. Remove from const.
3. Note removal in this doc with date and reasoning.
4. Smoke-test that affected recipes correctly demote to L4.

No schema changes required for either operation.
```

### Part 5 — Update existing docs

**`docs/PHASE_8_PANTRY_AND_GROCERY.md`:** add a "CP2 Patch — substitution whitelist + null-form wildcard" sub-entry under the existing CP2 results section. 5-8 lines. Cite the new SUBSTITUTION_INTELLIGENCE_ROADMAP.md for full details.

**`docs/DEFERRED_WORK.md`:** add T30 to the Cross-Cutting Technical Debt table (after T29, following CP1.5 numbering):

```
| T30 | 2026-05-19 | Subtype audit + split (post-F&F substitution intelligence work) | ~40 ingredient_subtypes currently silent-demoted by the matcher whitelist. Priority candidates for split: cheese (38 rows), fish (19), leafy_green (21), tropical_fruit (10), citrus (10), dried_chile (10), chile (12). See docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md G1 for full backlog. Post-F&F project, 2-3 sessions. |
```

**`docs/FRIGO_ARCHITECTURE.md`:** the `pantryMatchingService.ts` row in the Core Services table gets a 1-line update mentioning the whitelist gating. Minimal change.

**`docs/SESSION_LOG.md`:** append a new entry under today's `## 2026-05-19` header (after the existing CP2 + planning-session entries):

```
### CC: Phase 8D CP2 Patch — substitution whitelist + null-form wildcard — [DONE or PARTIAL]

**Prompt:** `CC_PROMPT_2026-05-19_8D_CP2_substitution_whitelist.md`
**Files modified:**
- lib/services/pantryMatchingService.ts (SUBSTITUTABLE_SUBTYPES const + per-ingredient loop patch)
- lib/services/_pantryMatchingSmokeTest.ts (+11 SMOKE-CP2-WL*/NF* scenarios)
- docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md (NEW — assumptions + gaps + roadmap)
- docs/PHASE_8_PANTRY_AND_GROCERY.md (CP2 patch sub-entry)
- docs/DEFERRED_WORK.md (T30 added)
- docs/FRIGO_ARCHITECTURE.md (1-line matcher row update)
**Files staged in _pk_sync/:** [list]
**Resolved deferred items:** none directly; T30 added as post-F&F roadmap bucket
**Smoke test result:** NOT run by CC (needs running app). Tom runs via AdminScreen.
**Notes:** [anything that surprised execution]
```

### Part 6 — Stage updated docs to `_pk_sync/`

Copy all 5 modified/new docs to `_pk_sync/` with today's date:

```bash
cp docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md _pk_sync/SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-19.md
cp docs/PHASE_8_PANTRY_AND_GROCERY.md _pk_sync/PHASE_8_PANTRY_AND_GROCERY_2026-05-19.md
cp docs/DEFERRED_WORK.md _pk_sync/DEFERRED_WORK_2026-05-19.md
cp docs/FRIGO_ARCHITECTURE.md _pk_sync/FRIGO_ARCHITECTURE_2026-05-19.md
cp docs/SESSION_LOG.md _pk_sync/SESSION_LOG_2026-05-19.md
```

Overwrite if the day's earlier-staged copies exist.

---

## Constraints

- **Do NOT commit.** Working tree stays modified; Tom batches with the rest of the in-flight Phase 8 work.
- **Do NOT modify `components/recipe/IngredientsSection.tsx`.** No UI changes needed — the matcher's demotion of non-whitelisted L3 → missing[] flows through automatically.
- **Do NOT modify any other screens.** RecipeDetailScreen, RecipeListScreen, etc., are pass-through consumers that only need the matcher to return correctly-shaped results.
- **Do NOT change the `MatchLevel` enum or `MatchedIngredient` / `PantryMatchResult` shapes.** All four levels stay; non-whitelisted subtypes just never emit L2/L3 results.
- **Do NOT modify the catalog data.** Part 0 catalog hygiene (citrus whole-fruit form=NULL, vinegar form=liquid, etc.) was done in the planning session — already in production.
- **Do NOT change the 3-query bulk structure.** The whitelist check is in-memory only.

---

## Verification

```bash
# 1. TypeScript clean
npx tsc --noEmit
# Expect: 0 new errors (2 pre-existing errors remain in untouched files — see CP2 SESSION_LOG)

# 2. SUBSTITUTABLE_SUBTYPES const exists and is the right size
grep -A 5 "SUBSTITUTABLE_SUBTYPES" lib/services/pantryMatchingService.ts | head -10
# Expect: const declaration with ReadonlySet<string>

# 3. New smoke scenarios added
grep -c "SMOKE-CP2-WL\|SMOKE-CP2-NF" lib/services/_pantryMatchingSmokeTest.ts
# Expect: at least 11 references

# 4. New doc exists
ls -la docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md
# Expect: file present, non-empty

# 5. T30 in DEFERRED_WORK
grep -c "^| T30 " docs/DEFERRED_WORK.md
# Expect: 1

# 6. SESSION_LOG entry under today's date
grep "Phase 8D CP2 Patch" docs/SESSION_LOG.md
# Expect: at least 1 hit

# 7. All 5 docs staged in _pk_sync/
ls _pk_sync/ | grep "2026-05-19"
# Expect: SUBSTITUTION_INTELLIGENCE_ROADMAP, PHASE_8, DEFERRED_WORK, FRIGO_ARCHITECTURE, SESSION_LOG
```

---

## SESSION_LOG entry format

Use the format shown in Part 5 above (CC's standard reconciliation format). Append below the existing 2026-05-19 entries (planning-session Part 0 + CP2 close + Part 0 doc reconciliation if it ran), as the newest entry of the day.

---

## Suggested commit message (Tom may use when batching)

```
feat(8D-CP2 patch): substitution whitelist + null-form wildcard

Patches the CP2 4-level matcher with two gating rules:

1. SUBSTITUTABLE_SUBTYPES whitelist (~75 subtypes) gates L2/L3 emission.
   Same-subtype matches in non-whitelisted subtypes (cheese, fish,
   leafy_green, tropical_fruit, etc.) demote to L4 missing.

2. Null-form wildcard within whitelisted subtypes: when either side
   has form=NULL, treat as L1 exact (silent ✓). Handles generic-base
   rows (sugar, vinegar, citrus whole fruits).

Whitelist composition curated 2026-05-19 against full catalog
(113 multi-member subtypes). See docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md
for assumptions, gaps, and post-F&F audit plan (G1-G6, captured as T30).

Matcher 3-query bulk structure preserved. No schema changes. No UI
changes — matcher's demotion of non-whitelisted L3 → missing[] flows
through automatically. Type signatures unchanged.

Adds T30 (subtype audit + split — post-F&F roadmap bucket).
```

---

## After this ships

Closes the F&F-blocking dogfooding feedback. CP2 + this patch together = the matcher work for F&F is genuinely done.

Eligible items NOT in scope:
- **G1-G6 from the roadmap doc.** Post-F&F.
- **Smoke harness contamination fix (T27).** Discovery-based harness can't isolate scenarios needing controlled "user doesn't have X" states. Out of scope.
- **Recipe tap-sheet (CP3).** Next CP, per the original CP2 prompt's "after CP2 ships" list. Spin up as a new planning session.

The catalog form-hygiene work done in this planning session (Part 0 + the form/subtype splits + the citrus null-out + the vinegar backfill) is already in production. Smoke verification still pending — Tom runs the SMOKE-CP2-* scenarios via AdminScreen's "Run pantry matching smoke tests" button after CC commits.
