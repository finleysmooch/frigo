# 8D-CP3.1 — Remove null-form wildcard from matcher

Surgical follow-up to 8D-CP3. CP3 split overloaded subtypes and whitelisted the new ones, expecting cross-base same-subtype pairs (parmesan ↔ pecorino, ribeye ↔ sirloin, bacon ↔ pancetta) to surface as L3 substitutes. But every cheese row has `form = NULL` in the catalog, and the null-form wildcard from the original CP2 patch fires on any pair where either side has NULL form — collapsing legitimate L3 substitutes to silent L1 exact.

The wildcard is removed entirely. Catalog-side restructuring for flat subtypes (vinegar, sugar, salt, etc.) is captured as deferred work for post-F&F.

## Files to read first

- `lib/services/pantryMatchingService.ts` — find the null-form wildcard conditional (per CP2 patch notes: "one const + one conditional"). Look for logic involving `form === null` / `form == null` in the L1/L2/L3 routing path
- `lib/services/_pantryMatchingSmokeTest.ts` — find scenarios L2a (black pepper vs peppercorns), L3a (basmati / jasmine), L3c (chicken broth / stock), WL8 (pepper form-variant). Per DEFERRED_WORK T29, these have "stale expectations" that were patched to work around the wildcard
- `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` — for the changelog + current-implementation section updates
- `docs/DEFERRED_WORK.md` — find T29 to mark resolved + add new P8D-CP3.1-1

## Task

### Part A — remove the null-form wildcard

In `lib/services/pantryMatchingService.ts`, locate the null-form wildcard. Per the CP2 patch session notes:

> "a null-form wildcard: within a whitelisted subtype, a NULL `form` on either side collapses to a silent L1 exact."

This is a single conditional in the level-determination path. It likely sits AFTER the L1 exact-id-match check and AFTER the L1 base-linkage check, but BEFORE the L2 form-variant check. When the wildcard fires, level becomes 'exact' (L1) instead of falling through to L2/L3.

Remove the wildcard conditional entirely. The level-determination path should then be:

1. **L1 exact** — same `ingredient_id` OR linked via `base_ingredient_id` (recipe→supply or supply→recipe, including the CP2.1 sibling fix which routes shared-base siblings through L2/L3 instead of L1)
2. **L2 form_variant** — same `ingredient_subtype` + different `form` (whitelisted only)
3. **L3 substitute** — same `ingredient_subtype` + same `form` including NULL=NULL match (whitelisted only)
4. **L4 no_match** — different subtype, OR same subtype not in `SUBSTITUTABLE_SUBTYPES`

**Important nuance about L3:** with the wildcard gone, two rows that both have `form = NULL` and share a whitelisted subtype now match at L3 (same subtype, same form value where the value happens to be NULL). This is the intended behavior. Don't add new "NULL form" special-casing to the L2/L3 split; treat NULL as a normal form value for matching purposes (NULL matches NULL → L3; NULL doesn't match 'fresh' → L2).

If there's any leftover reference to the wildcard in code comments, remove those too.

### Part B — verify and reconcile smoke test expectations

Run the smoke tests with the wildcard removed. Several scenarios will change behavior:

**Scenarios CP3 added (verify they now pass correctly):**
- SMOKE-CP3-FRESH-CHEESE (feta ↔ goat cheese) — was likely silently passing as 'exact' via wildcard; should now correctly fire as 'substitute' (L3)
- SMOKE-CP3-HARD-CHEESE (parmesan ↔ pecorino) — same
- SMOKE-CP3-SEMI-HARD-CHEESE (cheddar ↔ gouda) — same
- SMOKE-CP3-BLUE-CHEESE (gorgonzola ↔ roquefort) — same
- SMOKE-CP3-SOFT-RIPENED-CHEESE (brie ↔ camembert) — same
- SMOKE-CP3-BEEF-STEAK (ribeye ↔ sirloin) — same
- SMOKE-CP3-BEEF-BRAISING (short ribs ↔ brisket) — same
- SMOKE-CP3-CHICKEN-DARK (chicken thigh ↔ chicken leg) — same
- SMOKE-CP3-CURED-PORK (bacon ↔ pancetta) — same
- SMOKE-CP3-SAUSAGE (chorizo ↔ kielbasa) — same

If any of these are CURRENTLY passing with `level: 'exact'`, that's the wildcard silently overriding the intended substitute level. They should now correctly return `level: 'substitute'`. The CP3 scenarios were defined with `expectedLevel: 'substitute'` — confirm they hit substitute, not exact.

**Negative scenarios (verify they still demote):**
- SMOKE-CP3-PROCESSED-CHEESE-DEMOTE (american ↔ cheddar) — different subtypes, L4
- SMOKE-CP3-BEEF-CROSS-BUCKET-DEMOTE (ribeye ↔ brisket) — different beef subtypes, L4
- SMOKE-CP3-CHICKEN-DARK-VS-WHITE (chicken thigh ↔ chicken breast) — different subtypes, L4
- SMOKE-CP3-HAM-AND-SALAMI-DEMOTE (salami ↔ ham hock) — same subtype but NOT whitelisted, L4

These shouldn't change. Different-subtype pairs were already demoting via the whitelist gate, not the wildcard.

**T29 scenarios (verify and reconcile):**

Per DEFERRED_WORK T29, four scenarios had their expectations adjusted to work around the wildcard:
- L2a: black pepper vs peppercorns
- L3a: basmati vs jasmine
- L3c: chicken broth vs stock
- WL8: pepper form-variant

For each, read the scenario in the smoke harness:
1. **If the expectation is currently `'exact'`** (stale, accommodating the wildcard) → revert to its original intent. Black pepper vs peppercorns is L2 form_variant (same subtype 'pepper', different form). Basmati vs jasmine is L3 substitute (same subtype 'rice', same form). Chicken broth vs stock is L3 substitute (same subtype 'stock', same form). WL8 pepper form-variant is L2.
2. **If the expectation is currently `'substitute'` or `'form_variant'`** (already correct) → no change needed.
3. **If the scenario was using non-NULL-form pairs deliberately** (e.g., picked specific rows where both have forms filled in to dodge the wildcard) → it'll still pass at the same level post-removal; no change needed.

Surface what you find for each. The goal: all four T29 scenarios pass at their semantically-correct levels (L2 or L3), not L1.

**All other smoke tests (CP2, CP2.1):**
Should all still pass. Spot-check a few:
- SMOKE-CP2-L1-BASE-VARIANT (sugar ↔ granulated sugar, if linked) — L1 via base_ingredient_id, unaffected
- SMOKE-CP2.1-L1c-DEMOTE-BEEF (ribeye ↔ brisket pre-CP3) — was L4 via "different subtype after CP3 split"; post-CP3.1 still L4
- SMOKE-CP2.1-L1c-DEMOTE-CHICKEN (chicken thighs ↔ chicken breast) — still L4 (different subtypes after CP3's chicken_dark carve-out)

If anything else breaks, surface it. The wildcard's removal is a strict semantic change but the existing smoke harness was designed to test 4-level intent — most scenarios should align cleanly post-removal.

### Part C — update SUBSTITUTION_INTELLIGENCE_ROADMAP.md

In `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md`:

**1. "Current implementation (F&F)" section** — remove the null-form wildcard paragraph entirely:

```
A null-form wildcard rule applies within whitelisted subtypes: when either 
side has `form IS NULL`, treat as L1 exact (silent ✓). This handles 
generic-base rows like `sugar`, `vinegar`, citrus whole fruits.
```

Replace nothing — it just goes away.

**2. "Additivity principle for the post-CP2 recipe surface" section** — update the parenthetical:

Old: `Post-CP2 (4-level matcher + substitution whitelist + null-form wildcard)`
New: `Post-CP3.1 (4-level matcher + substitution whitelist, null-form wildcard removed)`

**3. Add a changelog entry at the bottom:**

```markdown
### 2026-05-26 — 8D-CP3.1 null-form wildcard removed

The null-form wildcard from the 2026-05-19 CP2 patch — "within a whitelisted subtype, NULL form on either side collapses to silent L1 exact" — was over-firing post-CP3. With the cheese/protein subtypes whitelisted via CP3, and most cheese/protein rows having `form = NULL`, the wildcard was silently collapsing legitimate cross-base same-subtype pairs (parmesan ↔ pecorino, ribeye ↔ sirloin, bacon ↔ pancetta) to L1 exact instead of L3 substitute.

The wildcard's original purpose was to silence "different form" copy on generic-base pairings (e.g., "vinegar" generic recipe + "rice vinegar" specific supply). But the correct semantic — generic recipe should silently match any specific via L1 base linkage — is the catalog's job, not the matcher's. The catalog currently has these subtypes as flat (no base/variant linkages); the directional-genericity work is captured as DEFERRED_WORK P8D-CP3.1-1 for post-F&F.

Net effect:
- Parmesan ↔ pecorino, feta ↔ goat cheese, brown sugar ↔ granulated sugar, all cheese / protein subtype pairs now surface correctly as ≈ amber L3 substitute
- T29 (smoke harness expectation contamination) auto-resolves; L2a / L3a / L3c / WL8 now hit their semantically-correct levels
- Generic-recipe matches on flat-catalog subtypes (recipe "vinegar" + supply "rice vinegar"; recipe "salt" + supply "kosher salt") now surface as ≈ amber substitute instead of silent ✓; this is honest but slightly verbose. Captured in P8D-CP3.1-1 for catalog restructure that would restore ✓ via L1 base linkage
```

**4. Stage dated copy** in `_pk_sync/SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-26.md`.

### Part D — DEFERRED_WORK updates

In `docs/DEFERRED_WORK.md`:

**1. Mark T29 as resolved:**

Find the T29 entry. Add a `**✅ RESOLVED — 8D-CP3.1 (2026-05-26).**` prefix to the entry, similar to how T22 was marked resolved by 8D-CP2. Brief explanation: "Null-form wildcard removed in 8D-CP3.1. The four scenarios (L2a, L3a, L3c, WL8) now hit their semantically-correct L2 / L3 expectations directly. Smoke harness no longer needs to work around the wildcard."

**2. Add P8D-CP3.1-1:**

```markdown
**P8D-CP3.1-1 — Catalog restructure: link variants to canonical generic bases for flat subtypes**

Tag: post-F&F catalog work

Context: Per 2026-05-26 audit, 9 whitelisted "flat" subtypes have all rows as independent base ingredients (no variant linkages). With the null-form wildcard removed in CP3.1, generic-recipe-meets-specific-supply pairs (e.g., recipe "vinegar" + supply "rice vinegar"; recipe "sugar" + supply "brown sugar") now surface as ≈ amber substitute. Technically honest but slightly verbose — the recipe wasn't being picky, so the user shouldn't have to read "substitute" copy.

The correct semantic (generic recipe + any specific in same family = ✓ exact match) should be encoded in the catalog via base/variant linkage. Currently the catalog is flat for these subtypes.

Audit results (2026-05-26):

| Subtype | Total | Bases | Linked variants | Orphan variants |
|---|---|---|---|---|
| vinegar | 10 | 10 | 0 | 0 |
| sugar | 7 | 7 | 0 | 0 |
| salt | 9 | 9 | 0 | 0 |
| rice | 9 | 9 | 0 | 0 |
| pasta | 16 | 16 | 0 | 0 |
| soy_sauce | 4 | 4 | 0 | 0 |
| mustard | 7 | 6 | 1 | 0 |
| butter | 3 | 1 | 1 | 1 |
| cream | 4 | 2 | 2 | 0 |

Per-subtype decision needed: does a clean canonical generic exist?
- **Clear generics:** vinegar, sugar, salt, soy_sauce, mustard, butter, cream — designate one base row as generic, link others as variants
- **Ambiguous:** rice (basmati / jasmine / arborio — each is distinct, generic "rice" may or may not make sense as canonical), pasta (penne ≠ fettuccine even at "any pasta" level)

Process per subtype:
1. Pick canonical generic (or determine that there isn't one, and leave flat)
2. `UPDATE ingredients SET is_base_ingredient = false, base_ingredient_id = <canonical>` for non-generic rows
3. Verify `ingredients_base_or_variant_not_both` CHECK still holds
4. Smoke-test the matcher behavior post-link (recipe "vinegar" + supply "rice vinegar" should now L1-match via base linkage, surfacing as ✓)
5. Update SUBSTITUTION_INTELLIGENCE_ROADMAP with the linkage decisions per subtype

Estimated effort: 2-3 sessions of catalog audit + SQL. Prioritize the clear-generic subtypes first; defer pasta / rice until tester feedback informs whether the verbose amber UX is actually bothersome.

Related: Could expand the same audit to other subtypes currently silent-demoted (cheese, beef post-CP3 split — though most are correctly NOT flat now).
```

## Constraints

- **No schema changes.** This is matcher-logic-only.
- **No UI changes.** The IngredientsSection rendering already supports ≈ amber for L3.
- **No CP3 reversal.** All 13 new subtypes from CP3 stay; all 10 whitelist additions stay.
- **All existing smoke tests must continue passing** at their semantically-correct levels (which may differ from current "stale" expectations for the four T29 scenarios — those should be reverted/reconciled, not left stale).
- **No new dependencies** or service signature changes.

## Verification

1. **App loads, Pantry + RecipeDetailScreen render normally.** No console errors.
2. **AdminScreen → "Run pantry matching smoke tests"** — all scenarios pass. Surface any failures.
3. **T29 scenarios** — L2a, L3a, L3c, WL8 now report `level: 'form_variant'` or `'substitute'` (NOT `'exact'`). If any are still `'exact'`, the wildcard wasn't fully removed.
4. **Real-recipe verification.** Tom will open the parmesan-with-pecorino recipe. Should now see:
   - **≈ amber** indicator (not ✓ green) next to the parmesan row
   - Reason sub-line below: something like "Have pecorino — substitute for parmesan"
   - If still showing ✓ green, the wildcard removal is incomplete
5. **Brown sugar / granulated sugar verification** — find any recipe asking for one with the other in supply. Should surface as either L2 (different form, if forms are filled in) or L3 (same form including NULL=NULL).
6. **Flat-subtype regression check** — find a recipe asking for "vinegar" (the generic, if it exists in your library) with rice vinegar in supply. Should now surface as ≈ amber substitute (per CP3.1 design — captured in P8D-CP3.1-1 for future correction via catalog restructure).
7. **`npx tsc --noEmit` clean.**

## SESSION_LOG entry

```
### YYYY-MM-DD — 8D-CP3.1 — Null-form wildcard removed from matcher

**What shipped:**

Matcher (`lib/services/pantryMatchingService.ts`):
- Removed the null-form wildcard conditional (per 2026-05-19 CP2 patch session notes: "one const + one conditional" — only the conditional removed; `SUBSTITUTABLE_SUBTYPES` whitelist retained)
- L3 substitute now correctly fires for same-subtype same-form pairs including NULL=NULL form matches
- No other behavioral changes; L1 base-linkage, L2 form_variant, L4 demotion all unchanged

Smoke tests (`lib/services/_pantryMatchingSmokeTest.ts`):
- T29's four stale-expectation scenarios (L2a, L3a, L3c, WL8) — [report what was found and any reconciliation done]
- All CP3 substitute scenarios (10 positive) now hit `level: 'substitute'` correctly (were silently `'exact'` pre-CP3.1)
- All CP3 negative scenarios (5) still demote to L4 as expected
- All CP2 + CP2.1 scenarios still pass

Docs:
- `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` — removed null-form wildcard from current implementation; updated Additivity Principle parenthetical; added 2026-05-26 changelog entry. PK copy staged at `_pk_sync/SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-26.md`
- `docs/DEFERRED_WORK.md` — marked T29 resolved; added P8D-CP3.1-1 (catalog restructure for flat subtypes)

**Files modified:**
- lib/services/pantryMatchingService.ts
- lib/services/_pantryMatchingSmokeTest.ts (if T29 expectations needed reconciliation)
- docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md
- docs/DEFERRED_WORK.md
- _pk_sync/ (staged copies)

**Pre-flight check:**
- Working tree was [clean / had uncommitted from 8D-CP3]
- All four T29 scenario expectations: [report]
- All CP3 substitute scenarios now hit 'substitute' level: [report]
```

After CC ships, smoke priorities:
1. AdminScreen → run all smoke tests → expect 100% pass
2. Open the parmesan recipe with pecorino supply → should now see **≈ amber + "Have pecorino — substitute for parmesan"** (or similar reason copy), NOT ✓ green check
3. Open a recipe with brown sugar where you have granulated sugar (or vice versa) → ≈ amber (your intuition met)
4. Optional regression: a recipe asking for generic vinegar/salt/etc. with a specific in supply will now show ≈ amber. Honest behavior, slight verbosity. Captured in P8D-CP3.1-1 for post-F&F correction via catalog linkage.

If anything misfires, paste back and we patch.
