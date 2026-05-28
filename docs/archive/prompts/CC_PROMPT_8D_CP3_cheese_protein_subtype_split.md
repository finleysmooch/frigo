# 8D-CP3 — Cheese + protein subtype split + matcher whitelist expansion

Split the overloaded `cheese`, `beef`, `chicken`, and `cured_meat` ingredient subtypes into substitution-meaningful sub-subtypes, then expand `SUBSTITUTABLE_SUBTYPES` in the matcher so the new subtypes surface legitimate cross-ingredient substitutes via L3.

This builds on 8D-CP2.1 (L1c fix). The L1c fix correctly demoted false-positive sibling matches to L4 for non-whitelisted subtypes. This CP completes the picture by creating subtypes that ARE legitimate substitution groups and whitelisting them.

No code changes beyond the matcher whitelist addition + smoke tests + roadmap doc. All other work is SQL.

## Files to read first

- `lib/services/pantryMatchingService.ts` — find `SUBSTITUTABLE_SUBTYPES` and the L2/L3 routing logic
- `lib/services/_pantryMatchingSmokeTest.ts` — pattern for adding new SMOKE scenarios
- `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` — for the changelog update
- Verify `ingredient_subtype` column type in Supabase metadata. If it's TEXT, proceed directly. If it's an ENUM, add `ALTER TYPE ... ADD VALUE` statements before the UPDATEs. Surface what you find before running the migration.

## Part A — SQL migration

Create `supabase/migrations/20260526_cheese_protein_subtype_split.sql`.

**Migration scope:** ALTER TABLE only if ingredient_subtype is an enum (to add new values). Then UPDATE 78 ingredient rows across cheese (48), beef (11), chicken (8), and cured_meat (11). No structural schema change otherwise.

### Migration contents

```sql
-- 8D-CP3 — cheese + protein subtype split
-- Splits overloaded subtypes into substitution-meaningful sub-subtypes.
-- Paired with whitelist additions in lib/services/pantryMatchingService.ts.
--
-- IF ingredient_subtype IS AN ENUM, prepend these ALTER TYPE statements
-- (12 new values total). Run before the UPDATEs to avoid invalid-value errors.
--
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'fresh_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'hard_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'semi_hard_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'soft_ripened_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'blue_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'processed_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'beef_steak';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'beef_braising';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'beef_ground';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'chicken_dark';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'cured_pork_sliced';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'sausage';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'ham_and_salami';

-- ============================================
-- CHEESE → 6 subtypes
-- ============================================

-- fresh_cheese (12 rows): feta, mozzarella, goat cheese, ricotta, cream cheese,
-- cottage cheese, halloumi, mascarpone, manouri, paneer, fresh mozzarella,
-- young sheep's milk cheese
UPDATE ingredients SET ingredient_subtype = 'fresh_cheese' WHERE id IN (
  '8d2b34fa-d6fa-41cc-8282-55468e3b8718',  -- feta
  '4a9182de-36f8-426b-b676-11d5fcfcc7d0',  -- mozzarella
  'f36acb3c-833a-4c92-a2c6-998b9345eb6e',  -- goat cheese
  '48840de1-a43f-4efc-aaf5-48e746b770d7',  -- ricotta
  '00c6cb38-45a5-4ca6-a478-41657319aa2d',  -- cream cheese
  '7e22c624-83b8-4c24-9970-160e4025dd63',  -- cottage cheese
  '0a29b46c-d7ef-4bec-8763-78f68afb96d4',  -- halloumi
  '1335c9c6-e212-4f6e-817a-7843ba1ef3ae',  -- mascarpone
  'e6e60fd8-d01a-42ff-911a-fb90289b213f',  -- manouri cheese
  'adde7c05-f5fd-4fce-accc-1bb21fc4e891',  -- paneer
  '592a9e8e-6939-4ad6-a938-48b73b9d9189',  -- fresh mozzarella
  'ec421ad3-6a16-4af9-b21e-6ce6e88bf1a4'   -- young sheep's milk cheese
);

-- hard_cheese (4 rows): parmesan, pecorino, parmigiano, parmigiano reggiano
UPDATE ingredients SET ingredient_subtype = 'hard_cheese' WHERE id IN (
  '611a8ebe-828d-46c2-b8fb-97f935363e28',  -- parmesan
  'eb2d032d-8cd8-4eb5-83f8-9a567a0358a6',  -- pecorino
  '35784da5-e39f-4cf1-84c9-ccaff2d3327d',  -- parmigiano
  '5c023e13-ebff-426e-8e1b-4d64b18a2cb4'   -- parmigiano reggiano
);

-- semi_hard_cheese (14 rows): cheddar, gruyere, manchego, kashkaval, cotija,
-- scamorza, gouda, monterey jack, pepper jack, provolone, swiss, cheddar
-- cheese, sharp cheddar, gouda cheese
UPDATE ingredients SET ingredient_subtype = 'semi_hard_cheese' WHERE id IN (
  'ea9be16a-1697-497c-bb31-25668f9eebea',  -- cheddar
  '92c47629-e854-4ebb-8ec5-f9bbc278190a',  -- gruyere
  '024a6aae-cb05-4174-94f2-58d11fe1a2d3',  -- manchego
  'a0ff710c-430a-46cf-88f9-4e5f29e0ec23',  -- kashkaval cheese
  'cec57f4b-2ffb-4f5a-abd4-9b5a3ce85495',  -- cotija cheese
  '507c4d40-c087-4741-a580-d6612622ebf5',  -- scamorza
  'd17ec4f7-ee00-463d-b73b-f667a610f5d4',  -- gouda
  'e9721f67-bbeb-423e-a448-510b38bcd314',  -- monterey jack cheese
  '5b92a2f5-f71e-4216-b27e-8aece9d11829',  -- pepper jack
  '317a42e3-df70-4754-8650-6d1250894877',  -- provolone
  'ee789715-243b-49f0-ae5f-f72127572580',  -- swiss
  'b9a50889-655a-4edd-bbf3-36696a499b9a',  -- cheddar cheese (variant)
  '8f9e1f76-f6ab-4e2a-9bf6-e96a5716b1d3',  -- sharp cheddar (variant)
  'e5ec8ab3-f924-466b-90bc-7c4ef0097c94'   -- gouda cheese (variant)
);

-- soft_ripened_cheese (3 rows): brie, camembert, taleggio
UPDATE ingredients SET ingredient_subtype = 'soft_ripened_cheese' WHERE id IN (
  'b0bc1b46-b884-4070-8512-e51b1562283d',  -- brie
  '70c42614-fceb-40d0-ad3f-feaed945486c',  -- camembert
  '5703f439-7d4b-4cea-86b4-8a85a975d256'   -- taleggio
);

-- blue_cheese (3 rows): gorgonzola, roquefort, blue cheese (generic)
UPDATE ingredients SET ingredient_subtype = 'blue_cheese' WHERE id IN (
  '72f55c37-0fb2-454c-9d26-c7190c929717',  -- gorgonzola
  '9f0bad36-6afb-4415-a4f8-c321dc2ecd48',  -- roquefort
  'fe477b89-cd3b-4186-a9e7-a30739c4b418'   -- blue cheese
);

-- processed_cheese (1 row): american cheese
UPDATE ingredients SET ingredient_subtype = 'processed_cheese' WHERE id IN (
  'e576a345-6762-4920-8837-b2e53bd6aac3'   -- american cheese
);

-- Note: the generic "cheese" row (8fbe2d77-3f3e-4b01-abec-f82d176fa45d) is
-- left in subtype='cheese' deliberately. Catalog hygiene issue — surfaced as
-- a deferred item (P8D-CP3-1).

-- ============================================
-- BEEF → 3 subtypes (base 'beef' row stays as subtype='beef')
-- ============================================

-- beef_steak (5 rows): beef steak, skirt steak, flank steak, ribeye, sirloin
UPDATE ingredients SET ingredient_subtype = 'beef_steak' WHERE id IN (
  'ba76d986-92a0-4021-88aa-076086099dc3',  -- beef steak
  '1fd193bf-8cc7-4d5e-a51a-b402fee7f436',  -- skirt steak
  'c7176d4f-9824-4cb8-9107-8e2b4aef32ea',  -- flank steak
  '91fb881e-6e9b-4c52-a1a6-dc58eab43d7d',  -- ribeye
  '8e71058d-4ff0-41cb-b971-0fcbd835016f'   -- sirloin
);

-- beef_braising (4 rows): short ribs, brisket, beef ribs, beef roast
UPDATE ingredients SET ingredient_subtype = 'beef_braising' WHERE id IN (
  '57d8d1d4-bd59-4cbe-9eef-105311f8ce0d',  -- short ribs
  '6d56eb8b-faf5-486d-81a7-d6f45ab959de',  -- brisket
  '8bc1c511-ff15-481a-821e-63eba6b4bea5',  -- beef ribs
  'cd0cad03-dfe5-4e80-ae71-870e0fe29859'   -- beef roast
);

-- beef_ground (1 row): ground beef
UPDATE ingredients SET ingredient_subtype = 'beef_ground' WHERE id IN (
  '5df092c9-0afc-4a45-8a70-f0752105302e'   -- ground beef
);

-- Base 'beef' row (a2e1e030-d8cf-45d6-a3bd-68709c6cdab0) stays as subtype='beef'.

-- ============================================
-- CHICKEN → carve out chicken_dark
-- ============================================

-- chicken_dark (3 rows): chicken thigh, chicken leg, chicken drumstick
UPDATE ingredients SET ingredient_subtype = 'chicken_dark' WHERE id IN (
  'be6b480f-6261-4a46-8ced-cd8cbf4389c9',  -- chicken thigh
  '43bc1bb3-a505-4417-a91f-7318156a3664',  -- chicken leg
  '182dd53e-c923-4497-80ed-00029810aebc'   -- chicken drumstick
);

-- The other 5 chicken rows (chicken base, chicken breast, whole chicken,
-- chicken wing, ground chicken) stay as subtype='chicken'. NOT whitelisted —
-- breast/wing/whole/ground are too distinct to surface as substitutes.

-- ============================================
-- CURED_MEAT → 3 subtypes
-- ============================================

-- cured_pork_sliced (3 rows): bacon, pancetta, prosciutto
UPDATE ingredients SET ingredient_subtype = 'cured_pork_sliced' WHERE id IN (
  'bf234822-5e3f-4216-8749-30e6ca8c5e80',  -- bacon
  '61bce288-3b9c-4f3e-8354-19f84f14b2ee',  -- pancetta
  '7f10c965-2dc6-4c94-b5d8-6f22128a0e16'   -- prosciutto
);

-- sausage (4 rows): sausage, chorizo, kielbasa, italian sausage
UPDATE ingredients SET ingredient_subtype = 'sausage' WHERE id IN (
  '9c6beaf3-5ecf-4a83-8c16-07629434b7a6',  -- sausage
  '1f46977a-7878-4a0e-bb96-d10b34b546c1',  -- chorizo
  '95393ad1-e10b-4fc9-89fb-10ea6256884b',  -- kielbasa
  'f8c75431-aed0-4e3b-aa02-6677c2345a50'   -- italian sausage
);

-- ham_and_salami (4 rows): ham hock, salami, ham, hard salami
UPDATE ingredients SET ingredient_subtype = 'ham_and_salami' WHERE id IN (
  '8a8c7339-a8b5-474f-a243-a54afdbacb0a',  -- ham hock
  '04976ca0-7752-4758-afb4-69949d1aa6ce',  -- salami
  '8a3eb586-9bfd-454e-a15c-6a3417af685f',  -- ham
  '72b50723-16a6-4f78-b0e2-a7ff9bdc0909'   -- hard salami
);

-- ============================================
-- VERIFICATION QUERY (run after migration)
-- ============================================
-- SELECT ingredient_subtype, COUNT(*) AS row_count
-- FROM ingredients
-- WHERE ingredient_subtype IN (
--   'fresh_cheese', 'hard_cheese', 'semi_hard_cheese', 'soft_ripened_cheese',
--   'blue_cheese', 'processed_cheese', 'beef_steak', 'beef_braising',
--   'beef_ground', 'chicken_dark', 'cured_pork_sliced', 'sausage',
--   'ham_and_salami'
-- )
-- GROUP BY ingredient_subtype
-- ORDER BY ingredient_subtype;
--
-- Expected counts: fresh_cheese=12, hard_cheese=4, semi_hard_cheese=14,
-- soft_ripened_cheese=3, blue_cheese=3, processed_cheese=1, beef_steak=5,
-- beef_braising=4, beef_ground=1, chicken_dark=3, cured_pork_sliced=3,
-- sausage=4, ham_and_salami=4. Total: 61 rows changed.
```

**Pre-flight check:** Run `SELECT pg_typeof(ingredient_subtype) FROM ingredients LIMIT 1;` or equivalent to determine whether the column is TEXT or an ENUM. Surface the result before running the migration. If ENUM, prepend the `ALTER TYPE ADD VALUE` statements (uncommenting from the template above). If TEXT, proceed directly to the UPDATEs.

## Part B — matcher whitelist additions

In `lib/services/pantryMatchingService.ts`, find `SUBSTITUTABLE_SUBTYPES` (the Set or Array that drives L3 substitute behavior).

**Add these 10 new subtypes:**

```typescript
// Existing entries preserved. Adding 10 new subtypes from 8D-CP3:
//   fresh_cheese, hard_cheese, semi_hard_cheese, soft_ripened_cheese, blue_cheese
//   beef_steak, beef_braising
//   chicken_dark
//   cured_pork_sliced, sausage
'fresh_cheese',
'hard_cheese',
'semi_hard_cheese',
'soft_ripened_cheese',
'blue_cheese',
'beef_steak',
'beef_braising',
'chicken_dark',
'cured_pork_sliced',
'sausage',
```

**Do NOT add:**
- `processed_cheese` (American cheese is distinctive — would mislead as substitute)
- `beef_ground` (single row, nothing to sub with)
- `ham_and_salami` (mixed bag — salami/ham_hock/ham aren't reliably interchangeable)
- The old `cheese`, `beef`, `chicken`, `pork`, `lamb`, `turkey`, `game`, `cured_meat` (the legacy subtypes — leftover rows stay non-whitelisted)

**Verify before saving:** Check that the existing `cheese`, `beef`, `chicken`, `cured_meat` entries are NOT in the whitelist. If they are, remove them — the split makes them obsolete and leaving them whitelisted would surface cross-subtype noise (e.g., feta ↔ american cheese, which the split was designed to prevent).

## Part C — smoke test additions

In `lib/services/_pantryMatchingSmokeTest.ts`, add new SMOKE-CP3 scenarios after the SMOKE-CP2.1 block. Pattern matches existing CP2.1 scenarios.

```typescript
// === SMOKE-CP3 — cheese + protein subtype splits ===

// fresh_cheese whitelist
{
  id: 'SMOKE-CP3-FRESH-CHEESE',
  description: 'feta ↔ goat cheese — fresh_cheese subtype whitelisted (L3)',
  recipeIngredientName: 'feta',
  supplyIngredientName: 'goat cheese',
  expectedLevel: 'substitute',
},
{
  id: 'SMOKE-CP3-FRESH-CHEESE-RICOTTA',
  description: 'ricotta ↔ cottage cheese — both in fresh_cheese (L3)',
  recipeIngredientName: 'ricotta',
  supplyIngredientName: 'cottage cheese',
  expectedLevel: 'substitute',
},

// hard_cheese whitelist
{
  id: 'SMOKE-CP3-HARD-CHEESE',
  description: 'parmesan ↔ pecorino — hard_cheese subtype whitelisted (L3)',
  recipeIngredientName: 'parmesan',
  supplyIngredientName: 'pecorino',
  expectedLevel: 'substitute',
},

// semi_hard_cheese whitelist
{
  id: 'SMOKE-CP3-SEMI-HARD-CHEESE',
  description: 'cheddar ↔ gouda — semi_hard_cheese subtype whitelisted (L3)',
  recipeIngredientName: 'cheddar',
  supplyIngredientName: 'gouda',
  expectedLevel: 'substitute',
},

// blue_cheese whitelist
{
  id: 'SMOKE-CP3-BLUE-CHEESE',
  description: 'gorgonzola ↔ roquefort — blue_cheese subtype whitelisted (L3)',
  recipeIngredientName: 'gorgonzola',
  supplyIngredientName: 'roquefort',
  expectedLevel: 'substitute',
},

// soft_ripened_cheese whitelist
{
  id: 'SMOKE-CP3-SOFT-RIPENED-CHEESE',
  description: 'brie ↔ camembert — soft_ripened_cheese subtype whitelisted (L3)',
  recipeIngredientName: 'brie',
  supplyIngredientName: 'camembert',
  expectedLevel: 'substitute',
},

// processed_cheese NOT whitelisted (negative test)
{
  id: 'SMOKE-CP3-PROCESSED-CHEESE-DEMOTE',
  description: 'american cheese ↔ cheddar — different subtypes, L4',
  recipeIngredientName: 'american cheese',
  supplyIngredientName: 'cheddar',
  expectedLevel: 'L4',
},

// beef_steak whitelist
{
  id: 'SMOKE-CP3-BEEF-STEAK',
  description: 'ribeye ↔ sirloin — beef_steak subtype whitelisted (L3)',
  recipeIngredientName: 'ribeye',
  supplyIngredientName: 'sirloin',
  expectedLevel: 'substitute',
},

// beef_braising whitelist
{
  id: 'SMOKE-CP3-BEEF-BRAISING',
  description: 'short ribs ↔ brisket — beef_braising subtype whitelisted (L3)',
  recipeIngredientName: 'short ribs',
  supplyIngredientName: 'brisket',
  expectedLevel: 'substitute',
},

// Cross-bucket NOT whitelisted (negative test — the original bug confirmation)
{
  id: 'SMOKE-CP3-BEEF-CROSS-BUCKET-DEMOTE',
  description: 'ribeye ↔ brisket — different beef subtypes (steak vs braising), L4',
  recipeIngredientName: 'ribeye',
  supplyIngredientName: 'brisket',
  expectedLevel: 'L4',
},

// chicken_dark whitelist
{
  id: 'SMOKE-CP3-CHICKEN-DARK',
  description: 'chicken thigh ↔ chicken leg — chicken_dark whitelisted (L3)',
  recipeIngredientName: 'chicken thigh',
  supplyIngredientName: 'chicken leg',
  expectedLevel: 'substitute',
},

// chicken_dark vs chicken (white meat) NOT whitelisted (negative test)
{
  id: 'SMOKE-CP3-CHICKEN-DARK-VS-WHITE',
  description: 'chicken thigh ↔ chicken breast — different subtypes, L4',
  recipeIngredientName: 'chicken thigh',
  supplyIngredientName: 'chicken breast',
  expectedLevel: 'L4',
},

// cured_pork_sliced whitelist
{
  id: 'SMOKE-CP3-CURED-PORK',
  description: 'bacon ↔ pancetta — cured_pork_sliced whitelisted (L3)',
  recipeIngredientName: 'bacon',
  supplyIngredientName: 'pancetta',
  expectedLevel: 'substitute',
},

// sausage whitelist
{
  id: 'SMOKE-CP3-SAUSAGE',
  description: 'chorizo ↔ kielbasa — sausage subtype whitelisted (L3)',
  recipeIngredientName: 'chorizo',
  supplyIngredientName: 'kielbasa',
  expectedLevel: 'substitute',
},

// ham_and_salami NOT whitelisted (negative test)
{
  id: 'SMOKE-CP3-HAM-AND-SALAMI-DEMOTE',
  description: 'salami ↔ ham hock — both in ham_and_salami but not whitelisted, L4',
  recipeIngredientName: 'salami',
  supplyIngredientName: 'ham hock',
  expectedLevel: 'L4',
},
```

## Part D — verify CP2.1 smoke tests still pass

The previous `SMOKE-CP2.1-L1c-DEMOTE-BEEF` (brisket ↔ ribeye) expects `L4`. Post-CP3 these are now in DIFFERENT subtypes (beef_braising vs beef_steak) — still L4 since their subtypes don't match for L2/L3 evaluation. Test stays correct, no update needed.

The previous `SMOKE-CP2.1-L1c-DEMOTE-CHICKEN` (chicken thighs ↔ chicken breast) expects `L4`. Post-CP3, thighs are `chicken_dark` and breast stays `chicken` — different subtypes, still L4. Test stays correct.

Confirm both pre-CP3 scenarios still pass after running the migration. If either flips to `substitute`, something is wrong with the migration data or the whitelist additions.

## Part E — substitution intelligence roadmap doc update

In `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md`:

1. Bump the `**Last Updated:**` header to today's date.

2. Add a new changelog entry at the bottom:

```markdown
### 2026-05-26 — 8D-CP3 cheese + protein subtype split

Split four overloaded subtypes into 12 substitution-meaningful sub-subtypes:

- **Cheese** (1 subtype → 6): fresh_cheese, hard_cheese, semi_hard_cheese, soft_ripened_cheese, blue_cheese, processed_cheese
- **Beef** (1 subtype → 3): beef_steak, beef_braising, beef_ground (base 'beef' stays as fallback)
- **Chicken**: carved out chicken_dark (thigh/leg/drumstick); breast/wing/whole/ground stay as 'chicken'
- **Cured_meat** (1 subtype → 3): cured_pork_sliced, sausage, ham_and_salami

10 of 12 new subtypes added to `SUBSTITUTABLE_SUBTYPES` whitelist (all except `processed_cheese`, `beef_ground`, `ham_and_salami` — none have clean within-bucket substitutability). Whitelist counts: 5 new cheese subtypes, 2 new beef, 1 new chicken, 2 new cured_meat.

The L1c fix from 8D-CP2.1 routed sibling pairs through the L2/L3 whitelist gate. This CP completes the picture by ensuring legitimate substitution groups now reach L3 substitute level instead of demoting to L4. Cross-bucket pairs (e.g., ribeye ↔ brisket: different beef subtypes) correctly stay at L4.

15 new SMOKE-CP3 scenarios added (10 positive, 5 negative).
```

3. Update the L3 description section if there's a "subtypes currently substitutable" list anywhere — make it accurate to the new whitelist composition.

Stage a dated copy in `_pk_sync/SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-26.md` per the standing rule.

## Part F — DEFERRED_WORK entries

Add to `docs/DEFERRED_WORK.md`:

1. **P8D-CP3-1 — Generic "cheese" ingredient row**
   - Tag: catalog hygiene
   - Context: row `8fbe2d77-3f3e-4b01-abec-f82d176fa45d` is a generic "cheese" (1 hero, 1 recipe) with no base link, subtype='cheese'. Recipe extraction landed an under-specified ingredient. Likely the recipe meant a specific cheese; auditing the source recipe and relinking would be the right fix. Out of scope for CP3 — flagged for post-F&F catalog cleanup.

2. **P8D-CP3-2 — Categorical recipe ingredients modeling**
   - Tag: post-F&F catalog work
   - Context: Some recipe ingredients are categorical placeholders rather than specific items ("young sheep's milk cheese," "blue cheese" as generic, hypothetical "any white wine," "any neutral oil"). Currently stored as concrete ingredient rows; substitution falls back to subtype-based L3 whitelist. For categoricals contained within a single subtype (e.g., young sheep's milk cheese → fresh_cheese), this works acceptably. For cross-subtype categoricals ("any cheese", "any leafy green"), explicit modeling needed. Options to evaluate: (a) `is_categorical` boolean column + matcher rule that surfaces any same-subtype supply as L3 substitute, (b) recipe-side preprocessing to expand categoricals into OR'd ingredient lists, (c) accept the imperfection. Revisit if recurring pattern surfaces in tester data.

3. **P8D-CP3-3 — Protein catalog expansion**
   - Tag: catalog work
   - Context: Pork, lamb, turkey, and game subtypes were left unsplit due to thin catalogs (5-6 rows each). Post-F&F, expand catalogs (e.g., add pork butt, pork belly, lamb leg, lamb breast, game birds beyond quail) then revisit splits. Pork shoulder ↔ pork butt is the most obvious missing whitelist pair.

4. **P8D-CP3-4 — Manchego subtype reconsideration**
   - Tag: catalog tuning
   - Context: Manchego currently placed in `semi_hard_cheese` per CP3 default. Aged manchego is closer to `hard_cheese` (grating cheese behavior). If tester data shows manchego often used in parmesan-substitution contexts (Italian pasta, grating applications), move to `hard_cheese`. Currently behaves correctly for fresh-application uses (salad, charcuterie) at `semi_hard_cheese`.

## Constraints

- No matcher algorithm changes — only the whitelist set is extended
- No schema changes beyond the (possible) enum value additions and the UPDATE statements
- No service signature changes
- No UI changes
- Existing 8D-CP2 / 8D-CP2.1 smoke tests must continue to pass post-migration
- The base 'beef', 'chicken', 'pork', 'lamb', 'turkey' rows stay in their original subtypes (they're fallback rows, not items)

## Verification

1. **Migration applies cleanly.** Run the verification query at the bottom of the migration file. Expected counts: 13 new subtypes with 61 rows total reassigned. Surface any discrepancy.

2. **Pre-CP3 smoke tests pass.** Run all existing SMOKE-CP2 / CP2.1 scenarios. None should change behavior. Brisket ↔ ribeye still demotes to L4. Chicken thigh ↔ chicken breast still demotes to L4. Salt ↔ kosher salt still L1 exact (base-variant link preserved).

3. **New SMOKE-CP3 tests pass.** All 15 scenarios resolve to their expected levels.

4. **Real-recipe smoke (manual).** Pick a recipe that uses parmesan. If user has pecorino, the pantry match should now show as a substitute (L3) rather than missing (L4). Similar for any feta recipe with goat cheese in the pantry.

5. **Whitelist composition.** `grep -A 50 "SUBSTITUTABLE_SUBTYPES" lib/services/pantryMatchingService.ts` should show the 10 new entries. Confirm the old `cheese`, `beef`, `chicken`, `cured_meat` ARE NOT in the set.

6. **`npx tsc --noEmit` clean** — no new type errors.

## SESSION_LOG entry

```
### YYYY-MM-DD — 8D-CP3 — Cheese + protein subtype split + matcher whitelist expansion

**What shipped:**

Catalog (SQL migration `20260526_cheese_protein_subtype_split.sql`):
- Cheese subtype split into 6: fresh_cheese (12), hard_cheese (4), semi_hard_cheese (14), soft_ripened_cheese (3), blue_cheese (3), processed_cheese (1). Generic "cheese" row left alone — flagged as catalog hygiene.
- Beef subtype split into 3: beef_steak (5), beef_braising (4), beef_ground (1). Base 'beef' row stays as 'beef'.
- Chicken: carved out chicken_dark (3). 5 other chicken rows stay as 'chicken'.
- Cured_meat subtype split into 3: cured_pork_sliced (3), sausage (4), ham_and_salami (4).
- Total: 13 new subtypes, 61 rows reassigned.

Matcher (`lib/services/pantryMatchingService.ts`):
- 10 of 13 new subtypes added to SUBSTITUTABLE_SUBTYPES whitelist: fresh_cheese, hard_cheese, semi_hard_cheese, soft_ripened_cheese, blue_cheese, beef_steak, beef_braising, chicken_dark, cured_pork_sliced, sausage.
- NOT whitelisted: processed_cheese, beef_ground, ham_and_salami.
- No algorithm changes — only whitelist set extended.

Smoke (`lib/services/_pantryMatchingSmokeTest.ts`):
- 15 new SMOKE-CP3 scenarios: 10 positive (legitimate L3 substitutes), 5 negative (cross-bucket / non-whitelisted demotions to L4).

Docs (`docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md`):
- New changelog entry, Last Updated bumped. PK copy staged at `_pk_sync/SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-26.md`.

**Deferred items added:**
- P8D-CP3-1: Generic "cheese" ingredient row (catalog hygiene)
- P8D-CP3-2: Categorical recipe ingredients modeling (cross-subtype categoricals)
- P8D-CP3-3: Protein catalog expansion (pork, lamb, turkey, game thin)
- P8D-CP3-4: Manchego subtype reconsideration

**Files modified:**
- supabase/migrations/20260526_cheese_protein_subtype_split.sql (new)
- lib/services/pantryMatchingService.ts (whitelist additions only)
- lib/services/_pantryMatchingSmokeTest.ts (15 new SMOKE-CP3 scenarios)
- docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md
- docs/DEFERRED_WORK.md
- _pk_sync/ (staged updated copies)

**Pre-flight check:**
- Working tree was [clean / had uncommitted: list]
- ingredient_subtype column type: [TEXT / ENUM — report what was found]

**Verification status:**
- Migration counts: [report]
- All SMOKE-CP2/CP2.1 still pass: [report]
- All SMOKE-CP3 pass: [report]
- TS clean: [report]
```

After CC ships, smoke priorities:
1. Apply the migration via Supabase SQL editor
2. Run the verification COUNT query — should show 13 subtypes with 61 rows reassigned
3. Run all smoke tests via AdminScreen → expect 100% pass
4. Open a real recipe (e.g., one using parmesan) — confirm a pecorino supply in pantry now shows as substitute, not missing
5. Open a brisket recipe (the original bug reporter) — confirm ribeye in pantry stays as missing (not substitute), since cross-bucket beef pairs are intentionally NOT whitelisted

If anything misfires, paste the failing smoke output here and we adjust.
