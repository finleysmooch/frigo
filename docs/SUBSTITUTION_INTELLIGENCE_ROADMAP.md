# Substitution Intelligence — Roadmap, Assumptions, and Gaps

**Status as of 2026-05-21:** F&F-ready with hand-validated whitelist gating + L1c sibling routing fix (8D-CP2.1). Full intelligence is multi-quarter roadmap.

## Current implementation (F&F)

The 4-level matcher (`pantryMatchingService.ts`) computes:

- **L1 exact** — split into three sub-cases:
  - **L1a — same row.** `recipe.ingredient_id === supply.ingredient_id`. Always L1.
  - **L1b — variant ↔ direct base.** Recipe IS the base of supply, OR supply IS the base of recipe. Examples: `olive oil` (base) ↔ `extra-virgin olive oil` (variant); `salt` ↔ `kosher salt`. Always L1.
  - **L1c — sibling via same base.** Both sides have non-null `base_ingredient_id` pointing to the same row, and neither IS that base (e.g., `brisket` ↔ `ribeye`, both variants of `beef` base). **Routes through L2/L3 + whitelist, NOT L1.** Same-subtype routing decision: matches at L3 (or L2 if forms differ, or silent L1 via the null-form wildcard) when the subtype IS in `SUBSTITUTABLE_SUBTYPES`; demotes to L4 missing otherwise.
- **L2 form_variant** — same `ingredient_subtype` + different `form` (only for whitelisted subtypes)
- **L3 substitute** — same `ingredient_subtype` + same `form` (only for whitelisted subtypes)
- **L4 no_match** — different subtype, or same subtype but NOT in `SUBSTITUTABLE_SUBTYPES`
- **always_available** — water/ice auto-match (no supply lookup)

L2 and L3 are surfaced only when `recipe.ingredient_subtype IN SUBSTITUTABLE_SUBTYPES`. The whitelist is hand-curated against the full catalog (113 multi-member subtypes, 604 rows total) and contains ~75 subtypes where substitution semantics are reliable. Non-whitelisted same-subtype matches (cheese, fish, leafy_green, tropical_fruit, etc.) demote to L4 missing.

A null-form wildcard rule applies within whitelisted subtypes: when either side has `form IS NULL`, treat as L1 exact (silent ✓). This handles generic-base rows like `sugar`, `vinegar`, citrus whole fruits.

**L1c routing rationale.** The catalog's `base_ingredient_id` linkage encodes "variant of a parent" semantics — useful for surfacing the base when the user holds a specific variant (and vice versa). It does NOT encode substitutability between siblings. Two variants of the same parent are at most as substitutable as their shared subtype permits; the matcher must therefore route them through the same whitelist gate that governs all other same-subtype pairings. Pre-CP2.1, the matcher conflated "user has the base" with "user has a sibling" and fired L1 for both. Post-CP2.1, only the variant-↔-base axis fires L1; sibling-↔-sibling routes through L3.

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

### G7 — Multi-candidate substitution surfacing

When multiple supplies satisfy the same substitution match (e.g. recipe wants white wine vinegar; user has apple cider + red wine + sherry vinegars — all subtype='vinegar', form='liquid' → all L3 candidates), the matcher currently picks one supply via `pickBestSupply` (most recent by `supplies.created_at` DESC, tie-break by `id`). The other matching supplies are invisible to the user.

Future work:
- (a) Surface all candidates in the ingredient row's sub-line (UI complexity tradeoff — single line vs expanded affordance)
- (b) Pick based on similarity rather than recency (requires per-pair substitution metadata or AI scoring — adjacent to G2/G3)

For F&F, recency is a defensible heuristic (most recent = front of mind = likely still in stock). Touches both matcher (similarity ranking) and UI (rendering multiple candidates without crowding).

## Realistic ambition

The full vision — recipe-context-aware substitution recommendations with quantity adjustments and substitution rationale, grounded in trusted cookbook authority — is a multi-quarter project. F&F ships the foundation: rough match with honest hedging via whitelist gating.

Each gap above is a known roadmap item, not a hidden flaw. The whitelist is the explicit honesty layer — non-whitelisted subtypes show as missing rather than pretending to match.

## Additivity principle for the post-CP2 recipe surface

Post-CP2 (4-level matcher + substitution whitelist + null-form wildcard), the visual design of the recipe ingredient surface is locked for F&F. Subsequent checkpoints in Phase 8D (CP3 tap-sheet, CP4 What-can-I-cook, CP5 banner-bundled-with-CP3) and beyond add interactivity, navigation, and net-new surfaces — they do NOT modify the existing row visual, sub-line copy, button styling, section header, or spacing.

This is a design discipline, not a hard schema constraint:
- The 4-level visual (✓ green / ⚠ yellow form variant / ≈ yellow substitute / red missing) is the F&F design contract.
- L2/L3 sub-line copy ("Close: you have X", "you have Y; recipe wants Z") is the F&F authoritative phrasing.
- The "+ Add N missing →" button and "+ Add all N" link styling and copy are F&F locked.
- Tap targets, new tap-sheets, banners, modals, and navigation pushes are all additive — they appear alongside or above the existing surface without restyling it.

Future visual changes (subtype audit-driven L3 visibility expansion, multi-candidate display, substitution rationale copy) are explicitly post-F&F and will be planned as a single coordinated visual revision, not piecemeal during interactivity checkpoints.

Rationale: the F&F testers will give us signal on whether the current visual reads correctly. Changing it mid-stream confounds the signal. Once we have feedback on the locked design, we revisit deliberately.

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

## Changelog

- **2026-05-21 — L1c sibling routing fix (8D-CP2.1).** Was incorrectly firing L1 exact for siblings of the same base; now routes through L2/L3 + whitelist. Matcher logic only; no catalog data changes, no schema changes, no UI changes. Existing `SMOKE-CP2-L1c` expectation updated (`exact` → `L4`, since `citrus` not in whitelist) with comment. New scenarios added: `SMOKE-CP2.1-L1c-DEMOTE-BEEF`, `SMOKE-CP2.1-L1c-DEMOTE-CHICKEN`, `SMOKE-CP2.1-L1c-WHITELIST-RICE`, `SMOKE-CP2.1-L1b-PRESERVED`.
- **2026-05-19 — F&F whitelist curation.** `SUBSTITUTABLE_SUBTYPES` hand-curated against the full catalog (113 multi-member subtypes, 604 rows). ~75 subtypes in the whitelist; ~40 silent-demoted to L4 pending the G1 post-F&F audit.
