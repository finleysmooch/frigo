# CC_PROMPT_8D_CP1.5 — DELTA 1 (corrections + Sub-op D)

**Issued by:** Claude.ai planning, 2026-05-19
**For:** CC, mid-build on CP1.5 pipeline
**Status:** Resolves the two blockers CC surfaced. Cleared to resume building.

This delta supersedes the corresponding sections of `CC_PROMPT_8D_CP1.5.md`. Apply these corrections, then continue from where you paused.

---

## Correction 1 — In-flight uncommitted code table

Your audit was correct. The original prompt's table was written from the handoff briefing's pre-cleanup state and never reconciled against the same-session cleanup commits (`2c5ebb6`, `4604188`, `76211f1`, `dd9b8b4`). Author-side discipline lesson logged; this delta is the truth.

**Replace the in-flight table in the original prompt with this:**

| Path | Status | From |
|------|--------|------|
| `lib/services/pantryMatchingService.ts` | NEW, uncommitted | CP1 |
| `screens/RecipeDetailScreen.tsx` | modified, uncommitted | CP1 |
| `screens/RecipeListScreen.tsx` | modified, uncommitted | CP1 |
| `screens/AdminScreen.tsx` | modified, uncommitted | CP1 + CP1 cleanup |
| `screens/SettingsScreen.tsx` | modified, uncommitted | CP1 cleanup Part B |

**Already committed (don't list as in-flight):**
- `lib/services/_pantryMatchingSmokeTest.ts` (commit `2c5ebb6`)
- `App.tsx` (commit `4604188`)
- `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` (commit `76211f1`)
- `docs/DEFERRED_WORK.md` + `docs/PROCESS_WATCHPOINTS.md` (commit `dd9b8b4`)

CP1.5's pipeline remains greenfield — no collision with either set.

---

## Correction 2 — Schema reality for `ingredients` table

Pulled from PK CSVs you flagged as absent. Citing here so you don't need them in repo to proceed (T9 deferred separately).

**Full column list (51 columns):** `id`, `name`, `plural_name`, `family`, `calories_per_100g`, `protein_per_100g`, `created_at`, `ingredient_type`, `ingredient_subtype`, `base_ingredient_id`, `form`, `typical_unit`, `typical_quantity`, `typical_store_section`, `carbohydrates_per_100g`, `fat_per_100g`, `fiber_per_100g`, `sugar_per_100g`, `sodium_per_100g_mg`, `estimated_cost_per_100g`, `estimated_cost_max_per_100g`, `last_price_update`, `typical_weight_small_g`, `typical_weight_medium_g`, `typical_weight_large_g`, `default_storage_location`, `shelf_life_days_fridge`, `shelf_life_days_freezer`, `shelf_life_days_pantry`, `shelf_life_days_counter`, `requires_metric_conversion`, `shelf_life_days_fridge_opened`, `shelf_life_days_pantry_opened`, `is_base_ingredient`, `quick_add_priority`, `created_by`, `nutrition_data_source`, `usda_fdc_id`, `g_per_cup`, `g_per_tbsp`, `g_per_tsp`, `g_per_whole`, `is_vegan`, `is_vegetarian`, `is_gluten_free`, `is_dairy_free`, `is_nut_free`, `is_shellfish_free`, `is_soy_free`, `is_egg_free`, `cooked_ratio`.

**Key facts that affect the pipeline:**

1. **No `aliases` column exists.** Drop from Part 1 (`01_discovery.py`) discovery CSV columns. Use `name`, `plural_name`, `family`, `ingredient_type`, `ingredient_subtype`, `form` for the orphan metadata. Pass those into Haiku's classification prompt.

2. **`is_base_ingredient`:** `boolean NULLABLE DEFAULT false`. Practically NOT NULL because of the default, but technically nullable. Treat as boolean for all purposes.

3. **`base_ingredient_id`:** `uuid NULLABLE`, FK to `ingredients(id)` with `ON DELETE NO ACTION`. Implication: a base cannot be deleted if any variant links to it. Add to anti-traps: do NOT attempt DELETE on base rows in this pipeline.

4. **`created_by`:** `text NULLABLE DEFAULT 'manual'::text`. **All new base INSERTs from Part 0 should explicitly set `created_by = 'cp1.5_haiku_backfill'`** for audit traceability. Same for any Part 4 INSERTs Haiku generates via `promote_to_base`.

5. **Useful base-row metadata for INSERTs:** keep nulls for nutrition (`calories_per_100g`, etc.), shelf-life, dietary booleans, USDA IDs. They can be backfilled later. Required fields for a new base row are minimal: `name`, `family`, `is_base_ingredient=true`, `created_by='cp1.5_haiku_backfill'`. Set `ingredient_type` from the discovery query you'll add to Part 0 (see below).

**Confirmed bases — `ingredient_type` discovery requirement preserved:** still run the `SELECT DISTINCT ingredient_type FROM ingredients WHERE is_base_ingredient = true GROUP BY family` (or similar) as the first statement in Part 0, before any UPDATE/INSERT, and cite the values in the SQL header comments. Don't guess.

---

## Correction 3 — W12 collapses to "absence is the finding" for `ingredients`

The full CHECK constraints inventory (both `Supabase_Snippet_List_Public_CHECK_Constraints.csv` and `_1.csv`) returns **zero rows for `ingredients`**. Confirmed via direct grep on both files.

**Implication:** there is no CHECK constraint preventing contradictory rows (`is_base_ingredient=true AND base_ingredient_id IS NOT NULL`) today. The CP1-cleanup's fix for the 4 contradictory rows was a manual `UPDATE`, not constraint-mediated. The smoke test's discovery of one such row (olive oil pre-cleanup) is the proof.

**Replace the SQL header comments in Part 0 and Part 4 with this text:**

```sql
-- CHECK constraints (verified 2026-05-19 via Supabase Snippet List Public CHECK
-- Constraints CSVs — both versions): NONE present on the ingredients table.
-- The invariant `NOT (is_base_ingredient = true AND base_ingredient_id IS NOT NULL)`
-- is currently unenforced; CP1 cleanup hand-fixed 4 contradictory rows on
-- 2026-05-18 (olive oil, parmesan, mozzarella, cream cheese). Sub-op D of this
-- migration lifts the invariant into the schema as a CHECK constraint.
```

W12 anti-trap (#2) stays in force as general discipline — but for the `ingredients` table specifically, the absence is the cited finding.

---

## Correction 4 — Sub-op D: add the missing CHECK constraint

**Add a new Sub-op D to Part 0**, after Sub-ops A, B, C. Pre-check + add constraint. Tom approved this scope addition 2026-05-19.

```sql
-- ============================================
-- Sub-op D: Lift the base-or-variant invariant into the schema
-- ============================================
-- The CP1-cleanup hand-fixed 4 contradictory rows. Without a CHECK constraint,
-- future destructive operations (Part 4 of this migration, the deferred
-- form-backfill pass, post-F&F catalog hygiene) can re-introduce the bug.
-- This Sub-op lifts the invariant into the schema after confirming no
-- contradictory rows currently exist.

-- D.1: Pre-check — confirm zero contradictory rows before adding the constraint.
-- If this returns any rows, ABORT and surface to Tom for triage. Do NOT proceed
-- to D.2 with contradictory rows present; the ADD CONSTRAINT would fail
-- mid-transaction and leave Sub-ops A/B/C committed in an inconsistent state.

SELECT id, name, family
FROM ingredients
WHERE is_base_ingredient = true AND base_ingredient_id IS NOT NULL;
-- Expected: 0 rows (CP1 cleanup fixed olive oil, parmesan, mozzarella, cream
-- cheese on 2026-05-18). Any non-zero result is a new finding — investigate
-- before retrying.

-- D.2: Add the constraint. Use IF NOT EXISTS for idempotency in case this
-- Sub-op is retried.

ALTER TABLE ingredients
ADD CONSTRAINT ingredients_base_or_variant_not_both
CHECK (NOT (is_base_ingredient = true AND base_ingredient_id IS NOT NULL));

-- D.3: Verify the constraint exists.

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ingredients'::regclass
  AND conname = 'ingredients_base_or_variant_not_both';
-- Expected: 1 row, constraint definition matches D.2.
```

**Important Postgres detail:** `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` does NOT support `IF NOT EXISTS` natively. If you want idempotency, wrap in a `DO $$ ... $$` block:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ingredients_base_or_variant_not_both'
      AND conrelid = 'ingredients'::regclass
  ) THEN
    ALTER TABLE ingredients
    ADD CONSTRAINT ingredients_base_or_variant_not_both
    CHECK (NOT (is_base_ingredient = true AND base_ingredient_id IS NOT NULL));
  END IF;
END $$;
```

Use the `DO $$` form. Tom may re-run Part 0 during iteration and it should not fail on the second run.

---

## Correction 5 — Sub-op D's effect on Part 4

Once Sub-op D commits, the constraint is active for the rest of the session. Part 4's generated migration will be checked against it — meaning if Haiku misclassifies a `promote_to_base` row AND that row already has `base_ingredient_id NOT NULL`, the Part 4 INSERT/UPDATE will fail.

**Add to Part 4's generated SQL header:**

```sql
-- Constraint `ingredients_base_or_variant_not_both` is active as of Part 0
-- Sub-op D. INSERTs and UPDATEs that produce contradictory state will fail
-- mid-transaction. The Phase 4 sanity guards in this file run AFTER all
-- INSERT/UPDATE statements to provide a clean error message if so.
```

**Update Part 4's generator logic:** before emitting an UPDATE that sets `base_ingredient_id` on a row, ensure that row is NOT also being set to `is_base_ingredient=true` in the same migration. Defensive check; should never trigger because the disposition vocabulary makes this combination impossible — but assert it explicitly in the generator script and fail loud if violated.

---

## Correction 6 — Followup capture

The CSV absence problem (T9 in DEFERRED_WORK) is now confirmed F&F-relevant. Two destructive prompts in a row (CP1 cheese cleanup, this CP1.5) have stumbled on it. Worth flagging for Claude.ai's planning attention but **does not require action from CC in this session.** Tom will dispatch the T9 schema-snapshot prompt separately.

Surface a 1-line note in your SESSION_LOG entry: "T9 (schema CSVs in repo) blocked W12 satisfaction twice in 24 hours; Claude.ai escalating priority."

---

## Cleared to resume

With the above applied:
- **Blocker 1 (in-flight table drift):** resolved — corrected table replaces original.
- **Blocker 2 (missing inputs / W12):** resolved — schema data inlined here, constraint absence is the cited finding, Sub-op D lifts the invariant going forward.

Resume the pipeline build. Continue from where you paused (after the `git status` + missing-inputs audit) into Part 0 SQL authoring with the Sub-op D addition.

The original prompt's CC-side verification checklist still applies; one item modifies:

- Item 3 ("CHECK constraint text cited in Part 0 and Part 4 SQL header comments") → modified to "CHECK constraint absence cited in Part 0 and Part 4 SQL header comments, with reference to the CP1-cleanup hand-fix of 4 prior contradictory rows; Sub-op D's constraint-add documented."
