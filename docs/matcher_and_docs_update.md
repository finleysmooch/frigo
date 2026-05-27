# Matcher Update + Documentation Additions — 2026-05-27

## 1. Matcher whitelist update — `lib/services/pantryMatchingService.ts`

Add three subtypes to `SUBSTITUTABLE_SUBTYPES`. The set is around line 51 of the
file. Find the closing `]` of the set declaration and add a new block before it:

```typescript
  // 8D-CP4 — catalog hygiene additions (2026-05-27). cultured_dairy
  // whitelisted post-mascarpone-move (sour cream ↔ crème fraîche ↔ mascarpone
  // are reasonable substitutes; buttermilk moved to its own subtype to avoid
  // bad substitutions). tomato whitelisted post-addition of whole peeled +
  // tomato puree (canned tomato variants substitute at L3). ginger_fresh
  // whitelisted post-galangal addition (Zingiberaceae family members substitute
  // honestly).
  'cultured_dairy', 'tomato', 'ginger_fresh',
```

### After the change

The set looks like (around the end):

```typescript
  // ... existing 'sweet_potato', 'thickener', etc. lines ...
  
  // 8D-CP3 — cheese + protein subtype split ...
  'fresh_cheese', 'hard_cheese', 'semi_hard_cheese',
  'soft_ripened_cheese', 'blue_cheese',
  'beef_steak', 'beef_braising',
  'chicken_dark',
  'cured_pork_sliced', 'sausage',

  // 8D-CP4 — catalog hygiene additions (2026-05-27).
  'cultured_dairy', 'tomato', 'ginger_fresh',
]);
```

### When to deploy

This code change can land any time, but its effects only become useful AFTER
Migration C runs (since pre-Migration-C, recipe ingredients still point to the
wrong catalog rows). Sequence:

1. Migration A (catalog modifications)
2. Migration B (catalog additions)
3. Edit `pantryMatchingService.ts`, reload Expo Go
4. Migration C (recipe ingredient corrections)
5. Re-open the four screenshot recipes; confirm visuals

---

## 2. SESSION_LOG entry

Append to `docs/SESSION_LOG.md` under a new `## 2026-05-27` header:

```markdown
### Claude.ai + Tom: 8D-CP4 — Catalog hygiene pass

Triggered by a real-recipe symptom (egg-spinach-pecorino pizza showed ✓ green
for pecorino with parmesan in pantry — actual data: recipe ingredient row had
`ingredient_id` pointing at parmesan instead of pecorino). Diagnostic widened
to a full catalog + recipe_ingredients audit; found 4 categories of issue:

1. **~95 recipe_ingredients rows misclassified** by previous Claude.ai-driven
   recipe extraction sessions. Examples: sumac→cumin (8), pomegranate
   molasses→honey (5), crème fraîche→sour cream (14), pecorino→parmesan (7),
   lemongrass→ginger (8), golden raisins→date (6), burrata→mozzarella (4),
   distilled white vinegar→white wine vinegar (5), prepared horseradish→dijon
   (4), plus smaller fixes.
2. **Catalog data quality bugs** — `salt.form='fresh'`, `sea salt.form='dried'`
   (both meaningless, produced bad UI copy); `extra-virgin olive oil` was
   independent base, not variant of `olive oil`; 7 salt variants were all
   independent bases.
3. **Subtype mis-assignments** — `mascarpone` in `fresh_cheese` produced
   nonsensical "you have feta" substitutions; `buttermilk` in `cultured_dairy`
   would substitute with sour cream.
4. **11 missing catalog rows** — horseradish, galangal, burrata, truffle oil,
   currants, self-rising flour, aleppo pepper, whole peeled tomatoes, tomato
   puree, short-grain rice, beef chuck. Extractor was forcing them into
   nearest-match rows in same/related subtypes.

**What shipped:**

Migrations (all idempotent):
- `20260527_migration_a_catalog_modifications.sql` — 6 catalog modifications:
  mascarpone moved to cultured_dairy; buttermilk to own subtype; cultured_dairy
  forms normalized to 'fresh'; salt variants linked to base; EVOO linked to
  olive oil base; salt/sea salt form values set to NULL; pepper 'powder' → 'ground'.
- `20260527_migration_b_catalog_additions.sql` — 11 new ingredient rows.
- `20260527_migration_c_recipe_ingredient_corrections.sql` — ~95 recipe_ingredients
  UPDATEs across 22 statement groups.

Matcher (`lib/services/pantryMatchingService.ts`):
- Added 3 subtypes to `SUBSTITUTABLE_SUBTYPES`: `cultured_dairy`, `tomato`,
  `ginger_fresh`. Enables L3 substitute UX for the cross-base same-subtype
  pairs introduced by the migrations.

**Manual next steps for Tom:**
1. Apply Migration A in Supabase SQL editor; run verification block.
2. Apply Migration B; run verification block.
3. Edit `pantryMatchingService.ts` per `matcher_and_docs_update.md`; hot-reload Expo.
4. Apply Migration C; run verification block.
5. Re-open four recipes (Egg-Spinach-Pecorino Pizza, Pizza Bianca, Burnt
   Eggplant with Tahini, Golden Brown Chicken Breasts) and confirm:
   - Pecorino on pizza recipe shows ✓ green (you have pecorino now — wait, no:
     you have PARMESAN in pantry, recipe asks for PECORINO, should show ≈ amber
     "Close: you have parmesan") — substitute UX
   - Pomegranate molasses shows ≈ amber "Close: you have honey"
   - Mascarpone no longer shows "you have feta"
   - Crème fraîche shows ≈ amber if user has sour cream
   - Salt rows show ✓ green if user has any salt variant
   - EVOO shows ✓ green if user has olive oil
6. Note: smoke harness will still show some failures (real-pantry contamination
   bug, pre-existing). Smoke harness isolation fix captured as deferred.
7. Refresh `_pk_sync/` with the 3 migration files, the matcher diff,
   SESSION_LOG entry, and DEFERRED_WORK additions.

**Recipe extraction quality** — captured as deferred. All ~95 misclassifications
were Claude.ai-driven (recipes extracted by previous chat sessions, not the
function path). For future extraction, both the function-side extractor and
human-driven extraction need a review-and-confirm step. Detailed entries in
DEFERRED_WORK below.
```

---

## 3. DEFERRED_WORK additions

Append to `docs/DEFERRED_WORK.md` in a new section:

```markdown
### From: 8D-CP4 — Catalog hygiene pass (2026-05-27)

**Context:** Surgical fix of ~95 misclassified recipe_ingredients rows + 11
catalog additions + 6 catalog data-quality fixes. Surfaced multiple structural
issues with recipe extraction quality that need a dedicated CP post-F&F.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8D-CP4-1 | **Recipe extraction quality CP.** Three convergent problems: (a) Claude Vision in `claudeVisionAPI.ts` extracts `ingredient_name` separately from `original_text` and can mis-extract (e.g., visual misread of "sumac" as "cumin"); (b) `unifiedParser.ts` uses Claude Haiku 3 which is markedly less accurate than Sonnet for nuanced parsing; (c) `matchToDatabase` in `ingredientsParser.ts` uses `.find()` for partial matches with no scoring — first DB row in iteration order wins, producing pomegranate-molasses→honey kind of failures when intended target isn't an exact match. Proposed structural fix: (1) upgrade unifiedParser to Sonnet 4; (2) add a scoring step to partial match (token overlap, edit distance, subtype hint matching); (3) when confidence < 0.8, flag with `needs_review=true` AND surface a review-and-fix UI on RecipeReviewScreen. | 🔧 | 🟡 | Post-F&F. Blocks new batch imports being clean. |
| P8D-CP4-2 | **RecipeReviewScreen review-and-fix UI.** Currently shows a ⚠️ "needs review" badge but provides no UI to correct the mapping. User reviews the recipe, sees the warning, saves anyway — review is purely informational. Add: tap on flagged ingredient → modal/sheet showing top 5 candidate catalog rows by score, with a "create new" option. Required for the post-F&F extraction CP to be useful. | 🔧 | 🟡 | Post-F&F. |
| P8D-CP4-3 | **Audit step for Claude.ai-extracted recipes (manual workflow).** All ~95 misclassifications fixed in this CP came from Claude.ai-driven extractions (previous chat sessions extracted recipes via copy-paste workflows, not the function path). For Tom's planned pre-F&F additional recipe imports: either (a) run all new recipes through the function-path with the quality improvements from P8D-CP4-1, or (b) run a post-import audit query similar to the Q1 scan and fix-as-you-go. Document the workflow either way. | 📋 | 🟡 | Process change, pre-F&F if doing more imports. |
| P8D-CP4-4 | **Fresh_cheese form normalization.** Subtype currently has mixed form values (feta=null, ricotta=null, halloumi=null, paneer=null, mozzarella=null, manouri=null, sheep's milk=null vs goat cheese='fresh', cottage cheese='fresh', cream cheese='fresh', mascarpone='fresh' — moved out in CP4). Produces spurious L2 form_variant suggestions across these. Decide on normalization (all null OR all 'fresh') and apply. Same fix shape as the cultured_dairy normalization in this CP. | 🔧 | 🟢 | Post-F&F catalog hygiene. |
| P8D-CP4-5 | **Cured_pork_sliced form normalization.** Bacon='fresh', pancetta=null. Chorizo='fresh', kielbasa=null. Produces L2 form_variant instead of L3 substitute on these pairs. Domain decision needed: are bacon-pancetta and chorizo-kielbasa really fresh items? (Cured items are technically not "fresh".) Normalize to a consistent value. | 🔧 | 🟢 | Post-F&F catalog hygiene. |
| P8D-CP4-6 | **Syrup subtype refinement.** Currently lumps honey, maple syrup, pomegranate molasses, molasses, agave, corn syrup, date molasses together. Honey ↔ pomegranate molasses substitution is questionable (sweet vs sweet-tart with distinctive flavor). After F&F testing, audit which pairs produce bad suggestions and either split the subtype or add a substitution rationale layer. | 🔧 | 🟢 | Post-F&F substitution intelligence work. Builds on existing SUBSTITUTION_INTELLIGENCE_ROADMAP. |
| P8D-CP4-7 | **Specific pasta shape catalog additions.** Recipes use specific pasta shapes (linguine, fettuccine, rigatoni, fusilli, orecchiette, etc.) — current catalog has only a subset. The `pasta` subtype is whitelisted so substitution works at L3, but L1 ✓ for exact matches requires the specific row. Audit pasta names in `recipe_ingredients.original_text` to identify missing shapes; add as needed. ~15-20 shapes likely. | 📊 | 🟢 | Post-F&F catalog hygiene. |
| P8D-CP4-8 | **Preparation axis on canned tomatoes.** Current matcher uses `(subtype, form)` for L1/L2/L3 routing. Recipe wants "whole peeled tomatoes" + user has "diced tomatoes" → L3 substitute (≈ amber) which is the desired UX. But the "you have a different prep" distinction isn't surfaced in the copy. A future enhancement: add a `preparation` axis to ingredients (whole, diced, crushed, puree, paste) and matcher logic for prep-mismatch surfacing. Would also help for "whole vs ground" (spices), "fresh vs frozen" (produce), etc. Architectural change, scope to a dedicated CP post-F&F. | 🔧 | 🟢 | Post-F&F architecture. |
```

---

## 4. Note on smoke harness

The pantry-matching smoke harness (`lib/services/_pantryMatchingSmokeTest.ts`)
has a pre-existing test-isolation bug: it runs against the user's real space
and the matcher fetches all active supplies (synthetic + real). After this
migration, the smoke harness will continue to produce false-positive failures
for any synthetic scenario where the recipe ingredient happens to be in Tom's
real pantry.

Captured as separate deferred work (no new entry needed — already covered by
the May 26 handoff). Resolution shape: smoke harness creates a throwaway test
space at run-start, passes that `spaceId` to all matcher calls, deletes the
space at teardown. Estimated ~1-2 hours of CC work.

---

## 5. Summary — file inventory for this CP

```
20260527_migration_a_catalog_modifications.sql       — Migration A
20260527_migration_b_catalog_additions.sql           — Migration B
20260527_migration_c_recipe_ingredient_corrections.sql — Migration C
matcher_and_docs_update.md                            — this file
```

Apply sequence: A → B → matcher code change → C → verify on real recipes.
