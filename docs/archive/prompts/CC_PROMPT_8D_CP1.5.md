# CC_PROMPT_8D_CP1.5 — Catalog variant linkage backfill (AI-assisted)

**Phase:** 8D — Recipe-pantry matching
**Estimated:** ~1 CC session (pipeline build + dry-run) + ~30-45 min Tom review of Haiku output + small SQL execution
**F&F-blocker:** Yes — without this, matcher under-matches at 82% orphan rate; F&F testers lose trust in the feature within the first hour.
**Authored by:** Claude.ai planning, 2026-05-19
**Depends on:** 8D-CP1 shipped (matcher + smoke harness v2 + cheese cleanup applied to prod); 5 D8D-CP1.5 decisions locked (D8D-Q14 through Q18, captured below).

---

## Context

CP1 shipped the matcher primitive and verified it on real data: math correct, bulk path correct, form annotations correct. But verification surfaced a substrate problem: **82% of non-base ingredients are orphans** (no `base_ingredient_id`), so variant traversal fires for less than 1 in 5 variants. The matcher is sound; the catalog is the issue. EVOO recipes read as missing olive oil, kosher salt recipes read as missing salt, etc.

Orphan distribution (from 8D-CP1 closeout audit):

| Family | Bases | Linked variants | Orphan variants | % orphan |
|---|---|---|---|---|
| Pantry | 18 | 30 | 346 | 88% |
| Produce | 22 | 18 | 130 | 76% |
| Proteins | 9 | 2 | 75 | 87% |
| Dairy | 9 | 21 | 38 | 56% |
| **Total** | **58** | **71** | **589** | **82%** |

CP1.5 is an **AI-assisted catalog backfill** that resolves the orphan rate before F&F. Pattern mirrors the Phase 3 recipe-classification Haiku backfill: discovery → Haiku batch → Tom review → SQL apply. Output: orphan rate drops from 82% to ~20% (the remainder are legitimate standalones — distinctive-flavor oils, generic-only items, etc.).

The 58-base set itself is structurally incomplete and needs surgery before linkage runs. Three known gaps:
1. **Proteins missing the big three:** no chicken, no beef, no pork.
2. **Produce missing common herbs/aromatics:** no basil, cilantro, parsley, mint, dill, rosemary, thyme, oregano, onion.
3. **Cheese cleanup left orphans:** feta, cheddar, brie, swiss, ricotta, gouda all exist as orphan rows. Per D8D-Q1, different cheeses should NOT share a base (cheddar ≠ brie). Each should be promoted to its own base.

Plus one D8D-Q1 cleanup: the existing `cheese` base needs to be demoted to standalone — it has 1 retained `recipe_ingredients` reference (verified 2026-05-19 via direct query), so delete is unsafe; demotion preserves the row while removing it from variant-traversal semantics.

This work is **catalog data only**. No service code changes. No screen changes. No new behavior — the matcher already works against linked variants; this prompt just makes more linkage exist.

---

## Locked decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D8D-Q14 | `cheese` base demoted to standalone (`is_base_ingredient=false`, `base_ingredient_id=null`). 1 retained `recipe_ingredients` reference flagged as DEFERRED_WORK candidate. | Refs check 2026-05-19 returned `recipe_refs=1, supply_refs=0`. Delete would orphan one recipe ingredient; demote is safe and reversible. Aligns with D8D-Q1 (cheddar ≠ brie should not share a base). |
| D8D-Q15 | Three-bucket `oil` framing: (a) cooking-fat-substitutable (canola/vegetable/sunflower/grapeseed) → link to `oil`; (b) olive-oil family (EVOO/light/extra-light/pomace) → link to `olive oil`; (c) distinctive-flavor finishing oils (coconut/toasted sesame/walnut/avocado) → **standalone orphan**. Decision rule: interchangeable for general cooking fat (link) vs. bringing the flavor the recipe is asking for (standalone). | D8D-Q1 says variants in a family are interchangeable. Coconut oil is NOT a swap for canola in stir-fry. Standalone preserves the user's flavor choice. |
| D8D-Q16 | Haiku for the classification batch. | ~589 rows, bounded taxonomy, structured output. Sonnet overkill at ~10x cost; Haiku verified-sufficient in Phase 3. |
| D8D-Q17 | Brand variants link as variants of the underlying base (Maldon → salt; Kerrygold → butter; Diamond Crystal → salt). | Brand is display/sourcing concern, not matcher concern. Transitively makes Maldon substitute for kosher salt — correct from matcher POV (both are salt for cooking purposes). |
| D8D-Q18 | Form-column backfill deferred to a separate post-CP1.5 pass. | Form is orthogonal to base linkage (affects `formMismatch` annotation, not match resolution). Bundling expands Haiku's classification surface and muddies Tom's triage. ~30-40 row job rides a follow-up. |

These five decisions extend the locked-decisions table in `docs/PHASE_8D_PLANNING.md` (v0.2 has D8D-Q1 through Q13). The planning doc itself will be updated by Claude.ai at phase close, not by this prompt.

---

## In-flight uncommitted code — DO NOT trust `git log`

Tom is holding all 8D work uncommitted until phase close. The following files have shipped but not been committed. CC must `git status` and `git diff` to discover the actual working-tree state before reading; do not assume `git log` reflects what's running on Tom's phone.

| Path | Status | From |
|------|--------|------|
| `lib/services/pantryMatchingService.ts` | NEW, uncommitted | CP1 |
| `lib/services/_pantryMatchingSmokeTest.ts` | NEW, uncommitted | CP1 cleanup Part A (v2 RLS-friendly) |
| `screens/RecipeDetailScreen.tsx` | modified, uncommitted | CP1 (matchResult state + IngredientsSection wiring) |
| `screens/RecipeListScreen.tsx` | modified, uncommitted | CP1 ('pantry_match' sort option) |
| `screens/AdminScreen.tsx` | modified, uncommitted | CP1 + CP1 cleanup (smoke runner button) |
| `App.tsx` | modified, uncommitted | CP1 cleanup Part B (ProfileStackNavigator deleted; LogoPlayground re-homed) |
| `screens/SettingsScreen.tsx` | modified, uncommitted | CP1 cleanup Part B (LogoPlayground navigation target) |
| `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql` | modified, uncommitted | CP1 cleanup Part C (v2 XOR-aware overwrite) |
| `docs/DEFERRED_WORK.md` | modified, uncommitted | CP1 cleanup Part D (T9, T10, T11 added) |
| `docs/PROCESS_WATCHPOINTS.md` | modified, uncommitted | CP1 cleanup Part D (W12, W13 added) |

**Implication for CP1.5:** the pipeline this prompt builds is greenfield (new files under `scripts/`); it does not collide with the in-flight set. But CC should still `git status` at session start to confirm the working tree matches the table above. If there's drift, surface it before proceeding.

---

## Inputs to read

**Required (architectural / decision context):**
1. `docs/PHASE_8D_PLANNING.md` — locked D8D-Q1 through Q13. Especially Q1 (variant tree interchangeability) and Q8 (form comparison opportunistic).
2. `docs/HANDOFF_BRIEFING_2026-05-18.md` — full CP1 closeout context, the orphan-distribution table, and the original CP1.5 scoping notes.
3. `docs/PROCESS_WATCHPOINTS.md` — **especially W12** (cite/verify actual CHECK constraint definitions before destructive SQL).

**Required (code/schema context):**
4. `Supabase Snippet Schema Column Details with PK_FK Metadata.csv` — confirm `ingredients` columns: `id`, `name`, `family`, `ingredient_type`, `is_base_ingredient`, `base_ingredient_id`, `form`, `plural_name`, `aliases`, USDA fields.
5. `Supabase Snippet List Public CHECK Constraints.csv` — find any CHECK constraints on `ingredients` (e.g., self-FK cycle guards, base/parent mutual exclusivity). **Cite the exact `check_clause` text in the SQL header comments** — this is the W12 discipline.
6. `lib/services/pantryMatchingService.ts` — confirm what the matcher does with `base_ingredient_id`. Pay attention to the variant-tree traversal in `expandToVariantGroup` (or whatever the helper is called). Understanding this confirms that linking variants to the right base is what unblocks the under-matching, and that mis-linking variants would silently corrupt match semantics.

**Prior art (search & read if found):**
7. `scripts/recipe_classification_backfill.py` or similar — the Phase 3 Haiku backfill. If it exists, mirror its structure (config loading, batching, retry, output format). If it doesn't exist, this prompt is greenfield and CC builds from scratch.
8. PK conversation search: `"Phase 3 recipe classification Haiku backfill"` — for context on how the prior pattern handled batching, dispositions, and Tom-triage.

**Schema facts to verify (STOP and report if any contradicts):**
- `ingredients.is_base_ingredient` is `boolean NOT NULL DEFAULT false`.
- `ingredients.base_ingredient_id` is nullable, FK to `ingredients(id)` (self-reference).
- A CHECK constraint exists preventing `is_base_ingredient=true AND base_ingredient_id IS NOT NULL` (or similar — confirm exact clause text). The CP1 closeout fixed 4 contradictory rows; the constraint may or may not be in place.
- `ingredients.family` is text with values like `'Pantry'`, `'Produce'`, `'Proteins'`, `'Dairy'`.

---

## Task — pipeline overview

CC builds a Python pipeline under `scripts/cp1_5_catalog_backfill/`. Five parts, executed in order. Tom runs each part locally after CC reports it complete.

```
Part 0  →  docs/CC_PROMPTS/8D_CP1.5_base_set_corrections.sql      ← deterministic SQL; Tom runs first
Part 1  →  scripts/cp1_5_catalog_backfill/01_discovery.py          ← enumerates remaining orphans → CSV
Part 2  →  scripts/cp1_5_catalog_backfill/02_classify_with_haiku.py ← calls Haiku → dispositions CSV
Part 3  →  scripts/cp1_5_catalog_backfill/03_render_review.py      ← dispositions CSV → markdown review table
                                                                     ← Tom edits dispositions CSV in place
Part 4  →  scripts/cp1_5_catalog_backfill/04_generate_sql.py       ← approved CSV → BEGIN/COMMIT migration
                                                                     ← Tom runs the migration in Supabase
Part 5  →  scripts/cp1_5_catalog_backfill/05_verify.sql            ← orphan rate before/after + sanity queries
```

Key constraints:
- **CC does NOT execute SQL.** CC writes the SQL files; Tom runs them in Supabase SQL editor.
- **CC does NOT call the Anthropic API in this session.** CC builds the script; Tom runs it locally with his `ANTHROPIC_API_KEY`. CC may run the script on a small sample (~10 rows) ONLY IF Tom explicitly provides an env var during the session. Otherwise: dry-run / output-shape demos only.
- **CC pre-writes Haiku prompts and verifies prompt-output schema** with mocked Haiku responses (hardcoded JSON test fixtures) so the pipeline's CSV stages are exercisable without API calls.
- **W12 active:** before writing any destructive SQL, CC must `grep` or read the CHECK constraints CSV and cite the exact `check_clause` text in the SQL header comments. Do NOT assume constraint semantics.

---

## Task — Part 0: Pre-migration catalog corrections (deterministic SQL)

**Action:** Save to `docs/CC_PROMPTS/8D_CP1.5_base_set_corrections.sql`. Tom runs this FIRST, before Part 1 discovery. The Part 1 discovery script enumerates orphans against the post-Part-0 catalog state.

This is deterministic SQL — no Haiku judgment involved. Three sub-operations:

### Sub-op A: Demote `cheese` to standalone

```sql
-- ID confirmed via refs check 2026-05-19:
--   recipe_refs=1, supply_refs=0 → demote (not delete).
-- D8D-Q14.
UPDATE ingredients
SET is_base_ingredient = false
WHERE id = '8fbe2d77-3f3e-4b01-abec-f82d176fa45d';
```

### Sub-op B: Add or promote new bases

For each candidate, the SQL does an upsert-style operation: if an existing row matches by name (case-insensitive, family-matched), set `is_base_ingredient=true` and clear `base_ingredient_id` if present; if no row exists, INSERT a new base row.

**New bases to add or promote:**

| Family | Names |
|---|---|
| Proteins | chicken, beef, pork |
| Produce | basil, cilantro, parsley, mint, dill, rosemary, thyme, oregano, onion |
| Dairy (from cheese cleanup) | feta, cheddar, brie, swiss, ricotta, gouda |

CC writes one CTE-based block per family that:
1. Looks up the existing row by `LOWER(name) = LOWER('<candidate>') AND family = '<family>'`.
2. If found: `UPDATE ingredients SET is_base_ingredient=true, base_ingredient_id=NULL WHERE id = <found_id>`.
3. If not found: `INSERT INTO ingredients (name, family, ingredient_type, is_base_ingredient) VALUES (...)`. Set `ingredient_type` to the family's conventional type (Pantry → 'pantry_staple' or similar — **verify against the existing 58-base rows' `ingredient_type` values before writing**).

**Important:** before writing the INSERT clauses, CC must `SELECT DISTINCT ingredient_type FROM ingredients WHERE is_base_ingredient = true GROUP BY family` (mentally, from the schema CSV / sample data, or by adding a discovery query to Part 0 itself that Tom runs first). Don't guess `ingredient_type` values.

### Sub-op C: Discovery output

Output a row count summary that Tom can sanity-check before running Sub-ops A & B:
- How many candidate rows already exist (will be promoted)
- How many candidate rows don't exist (will be inserted)
- Confirmation of post-state base counts per family

Wrap the whole Part 0 file in `BEGIN; ... COMMIT;` so any anomaly rolls back cleanly. Header comment cites the CHECK constraint clauses found in Input 5 above (W12 discipline).

---

## Task — Part 1: Discovery script

**File:** `scripts/cp1_5_catalog_backfill/01_discovery.py`

Connects to Supabase (via `supabase-py` client or direct PostgREST HTTPS — match the pattern used in `scripts/recipe_classification_backfill.py` if it exists; otherwise use the connection pattern from any existing script in the repo).

**Inputs:** none (reads env vars `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — service role needed because catalog is RLS-restricted to service-role for writes).

**Behavior:**
1. SELECT all rows from `ingredients` where `is_base_ingredient = false AND base_ingredient_id IS NULL`. These are the orphans.
2. For each row, emit a CSV record with columns:
   - `id` (UUID)
   - `name` (text)
   - `family` (text)
   - `ingredient_type` (text)
   - `form` (text, nullable)
   - `plural_name` (text, nullable)
   - `aliases` (text, nullable — may be JSONB)
3. Also enumerate the post-Part-0 base set (`is_base_ingredient=true`) into a sibling CSV. Haiku will reference this as the "available bases" list.

**Outputs:**
- `scripts/cp1_5_catalog_backfill/output/orphans.csv` (~589 rows expected pre-Part-0; ~570-575 expected post-Part-0 after promotions)
- `scripts/cp1_5_catalog_backfill/output/bases.csv` (~74 rows expected post-Part-0)
- Console summary: orphan count by family

**Verification:** CC runs the script with mock-fixtures (or a minimal real env if Tom enables it) and confirms output shapes. CC does NOT commit `output/*.csv` to the repo — add `.gitignore` entry under the pipeline dir.

---

## Task — Part 2: Haiku classification batch

**File:** `scripts/cp1_5_catalog_backfill/02_classify_with_haiku.py`

This is the AI-assisted heart of CP1.5. The script reads `orphans.csv` + `bases.csv`, sends batches to Haiku, writes dispositions to `dispositions.csv`.

### Haiku prompt (system + user template)

CC authors the prompts inline in the script. Required components:

**System message** establishes the role:
> You are a culinary taxonomy classifier. Given an ingredient name (an "orphan" with no parent in our catalog) and a list of available base ingredients, decide how the orphan should be related to the base set. The goal is to enable recipe-pantry matching: if a recipe calls for X and the cook has Y, the matcher should treat them as interchangeable when X and Y share a base.

**Decision options** (exact taxonomy — Haiku returns one of these for each orphan):
- `link_to_existing_base` — orphan is a variant of one of the bases in `bases.csv`. Return the target base name.
- `promote_to_base` — orphan should itself become a base (no existing base captures it; common-enough ingredient).
- `link_to_new_base` — orphan is a variant of a base that should also be promoted from the orphan list. Return the proposed new-base name (which Haiku also marks as `promote_to_base` in its own row).
- `standalone` — orphan stays as an orphan. No base relationship makes sense.

**Decision rules to bake into the prompt** (these are the locked Q14-Q17 decisions plus the categorization nuances from the handoff):

1. **D8D-Q15 — oil three-bucket rule:**
   - Cooking-fat-substitutable oils (canola, vegetable, sunflower, grapeseed, peanut, corn) → `link_to_existing_base` → `oil`.
   - Olive-oil family (EVOO, extra-virgin, light olive oil, pomace olive oil) → `link_to_existing_base` → `olive oil`.
   - Distinctive-flavor finishing oils (coconut, toasted sesame, walnut, avocado, truffle, chili oil) → `standalone`. The recipe is asking for that flavor specifically.
   - Decision rule (state in the prompt): "would a competent home cook swap this oil for plain canola in a sauté without noticeable flavor change? If yes → link. If no → standalone."

2. **D8D-Q17 — brand-variant policy:**
   - Brand-named variants link to the underlying base. Maldon, Diamond Crystal, Morton → `salt`. Kerrygold, Plugrá → `butter`. Heinz, Hellmann's → respective bases.
   - Lean variant-not-brand: when in doubt, link.

3. **D8D-Q1 — same-family non-interchangeability:**
   - **Different cheeses do NOT share a base.** Cheddar, brie, feta, swiss, etc. each get `promote_to_base` (or `link_to_existing_base` to their own canonical row if Part 0 promoted them).
   - Apples and oranges do not share a base. Tomatoes and tomatillos do not share a base.
   - General rule: same-family doesn't imply substitutable. Substitutability is the test.

4. **Form-distinct items stay orphan (D8D-Q18):**
   - "fresh basil" / "dried basil" / "frozen basil" — link to `basil` (the matcher cares about ingredient-identity; form mismatch is annotated by the matcher itself).
   - "garlic" (Produce, fresh bulb) vs "garlic powder" (Pantry, ground spice) → **do NOT link.** Different culinary roles. Garlic powder is its own base (already in the 58-base set); garlic is its own base.
   - "frozen peas" → `link_to_existing_base` → `peas` (if peas is a base; otherwise mark `peas` as a `promote_to_base` candidate).

5. **Bias on ambiguity:**
   - When confidence is low, prefer `standalone` over `link_to_*`. A missed link costs an under-match; a wrong link costs a false match (worse — user trusts the percentage less). Tom can re-link manually in a follow-up.

### Output schema (per orphan row)

```json
{
  "id": "uuid",
  "name": "kosher salt",
  "disposition": "link_to_existing_base",
  "target_base_name": "salt",
  "confidence": "high",
  "reasoning": "Salt variant; cooking-interchangeable; D8D-Q17 brand-like rule applies even though kosher is not a brand."
}
```

For `link_to_new_base`, `target_base_name` references a name that also appears in another row as `promote_to_base`. The Part 4 SQL generator resolves these forward references.

### Batching

- Send ~30-50 orphans per Haiku call (well under context limit; keeps latency reasonable). Pass the full `bases.csv` as context in every call.
- Use Haiku via the Anthropic SDK. Model string: `claude-haiku-4-5-20251001` (per product self-knowledge; verify the script picks up this exact value).
- JSON-mode output. Validate against the schema above; retry once on schema violation, surface as `SETUP-FAIL` on second failure.
- Output `dispositions.csv` (one row per orphan, columns: `id, name, family, disposition, target_base_name, confidence, reasoning`).
- Console summary: counts by disposition + counts by confidence.

### Sample run

CC writes a `--sample N` flag so Tom can run on a small subset first (~20 rows) to validate Haiku quality before burning API on the full 589.

---

## Task — Part 3: Review artifact generation

**File:** `scripts/cp1_5_catalog_backfill/03_render_review.py`

Reads `dispositions.csv`, emits a human-readable Markdown table to `output/review_table.md`.

**Sort order:**
1. Confidence ascending (low first — these are the ones Tom needs to actually look at).
2. Then by family.
3. Then alphabetic.

**Columns:**

| Approve? | Name | Family | Disposition | Target | Confidence | Reasoning |
|---|---|---|---|---|---|---|

The `Approve?` column is empty by default. Tom edits the **`dispositions.csv`** (not the markdown) to override any disposition he disagrees with. Markdown is read-only skim view; CSV is the editable source of truth.

**Editing rules Tom needs to know** (state these in the markdown header):
- To approve a row as-is: leave alone.
- To re-disposition a row: edit the `disposition` column in `dispositions.csv` to one of the four allowed values, edit `target_base_name` if needed, and append `[overridden]` to the `reasoning` column for traceability.
- To reject a row entirely (skip it from the migration): set `disposition` to `standalone` (the safe no-op).
- After editing, re-run `03_render_review.py` to refresh the markdown.

**Section breakdown in the markdown** (in addition to the main sorted table):
- Top-of-file summary: total rows, counts by disposition, counts by confidence.
- "Low-confidence rows" section (filter to confidence='low') — these are the ones most likely to need Tom's judgment.
- "New-base proposals" section (filter to disposition='promote_to_base' and 'link_to_new_base') — these create new base rows, so worth a separate skim.
- "Standalone proposals" section (filter to disposition='standalone') — Tom should verify Haiku didn't over-bias toward this (per the low-confidence safety rule).

---

## Task — Part 4: SQL generator

**File:** `scripts/cp1_5_catalog_backfill/04_generate_sql.py`

Reads the (possibly Tom-edited) `dispositions.csv`. Emits a SQL migration to `docs/CC_PROMPTS/8D_CP1.5_variant_linkage_migration.sql`.

**Generated SQL structure:**

```sql
-- 8D-CP1.5 — Catalog variant linkage migration (Haiku-classified)
-- Generated <timestamp> from dispositions.csv (<row count> rows)
-- Decisions: D8D-Q14 (cheese demote already shipped in Part 0), Q15 (oil), Q16, Q17, Q18
-- CHECK constraints (verified <date>):
--   <cite exact check_clause text for ingredients constraints>
-- Run manually in Supabase SQL editor with BEGIN/COMMIT open.

BEGIN;

-- ============================================
-- Phase 1: INSERT new bases (from disposition='promote_to_base')
-- ============================================
-- <One INSERT per row, with comments referencing the source orphan name>

-- ============================================
-- Phase 2: UPDATE existing rows to be base (from disposition='promote_to_base'
--          where the orphan already exists — Part 0 catches the major ones,
--          but Haiku may identify more)
-- ============================================

-- ============================================
-- Phase 3: UPDATE variants → base_ingredient_id link
-- ============================================
-- <Resolve target_base_name → target_base_id by name lookup in CTE>
-- <One UPDATE per orphan with disposition in ('link_to_existing_base', 'link_to_new_base')>

-- ============================================
-- Phase 4: Sanity guards
-- ============================================
-- Confirm no row has is_base_ingredient=true AND base_ingredient_id IS NOT NULL
-- Confirm no link references a non-existent base_ingredient_id
-- Confirm no cycles (base A → B → A); shouldn't be possible with the disposition vocabulary but verify

SELECT COUNT(*) FROM ingredients
WHERE is_base_ingredient = true AND base_ingredient_id IS NOT NULL;
-- Expected: 0

SELECT i.id, i.name
FROM ingredients i
WHERE i.base_ingredient_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ingredients b WHERE b.id = i.base_ingredient_id);
-- Expected: 0 rows

COMMIT;
```

**Idempotency:** the script must be safe to re-run. INSERTs guard against duplicates (`WHERE NOT EXISTS` or `ON CONFLICT DO NOTHING`). UPDATEs are idempotent by nature. State this explicitly in the header comments.

**Standalone disposition:** rows marked `standalone` produce NO SQL — they're already orphan and stay orphan. The script emits a comment summarizing the count for traceability.

---

## Task — Part 5: Verification queries

**File:** `scripts/cp1_5_catalog_backfill/05_verify.sql`

Five queries Tom runs after the Part 4 migration commits. CC writes them with expected-result comments inline.

1. **Orphan rate by family** — pre/post comparison. Expected: drop from 82% to ~20%.

   ```sql
   SELECT family,
          COUNT(*) FILTER (WHERE is_base_ingredient = true) AS bases,
          COUNT(*) FILTER (WHERE is_base_ingredient = false AND base_ingredient_id IS NOT NULL) AS linked_variants,
          COUNT(*) FILTER (WHERE is_base_ingredient = false AND base_ingredient_id IS NULL) AS orphans,
          ROUND(100.0 * COUNT(*) FILTER (WHERE is_base_ingredient = false AND base_ingredient_id IS NULL)
                / NULLIF(COUNT(*) FILTER (WHERE is_base_ingredient = false), 0), 0) AS orphan_pct
   FROM ingredients
   GROUP BY family
   ORDER BY family;
   ```

2. **Contradictory-base regression check** — must be 0.

   ```sql
   SELECT id, name FROM ingredients
   WHERE is_base_ingredient = true AND base_ingredient_id IS NOT NULL;
   ```

3. **Dangling link check** — must be 0.

   ```sql
   SELECT i.id, i.name, i.base_ingredient_id
   FROM ingredients i
   WHERE i.base_ingredient_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM ingredients b WHERE b.id = i.base_ingredient_id);
   ```

4. **Cycle check** — variants don't point at each other. Use a recursive CTE if helpful.

5. **The cheese-base follow-up surface** — list the recipes whose ingredient lines still reference the demoted `cheese` base. This becomes the T12 DEFERRED_WORK candidate.

   ```sql
   SELECT r.id AS recipe_id, r.title, ri.id AS recipe_ingredient_id, ri.notes
   FROM recipe_ingredients ri
   JOIN recipes r ON r.id = ri.recipe_id
   WHERE ri.ingredient_id = '8fbe2d77-3f3e-4b01-abec-f82d176fa45d';
   ```

   Expected: 1 row. Save the result for Tom to triage in DEFERRED_WORK.

---

## Verification steps (CC-side, before reporting done)

1. **`git status` matches the in-flight table above** — surface any drift.
2. **Inputs read confirmed** — paste a 1-line confirmation per input file (e.g., "PHASE_8D_PLANNING.md: read; Q1 + Q8 acknowledged").
3. **CHECK constraint text cited in Part 0 and Part 4 SQL header comments** (W12 discipline). Quote the exact `check_clause` text from the CSV.
4. **`ingredient_type` values for existing bases enumerated** — paste the distinct values per family. Cite the source (schema CSV row or sample data).
5. **Pipeline structure exists** — `scripts/cp1_5_catalog_backfill/{01_discovery,02_classify_with_haiku,03_render_review,04_generate_sql}.py` + `05_verify.sql` + `docs/CC_PROMPTS/8D_CP1.5_base_set_corrections.sql` + `docs/CC_PROMPTS/8D_CP1.5_variant_linkage_migration.sql` placeholder.
6. **`.gitignore` entry added** for `scripts/cp1_5_catalog_backfill/output/`.
7. **Haiku prompt visible in source** — not loaded from external file; embedded in `02_classify_with_haiku.py` for grep-ability.
8. **Model string verified** — `claude-haiku-4-5-20251001` exactly, not a placeholder.
9. **Dry-run output sample** — run `01_discovery.py` against mock fixtures (or real env if Tom enabled it) and paste the first 5 rows of `orphans.csv`. Confirms the connection + query work.
10. **`02_classify_with_haiku.py --sample 3` mock run** — wire a mock Haiku response (3 hardcoded fixture rows) into the script for testing without API calls. Paste the resulting `dispositions.csv` rows. Confirms the JSON parsing + CSV writing work end-to-end.
11. **`03_render_review.py` rendered against mock dispositions** — paste the first 10 lines of `review_table.md`.
12. **TypeScript still clean** — `npx tsc --noEmit` (the pipeline is Python, so this should be a no-op, but confirms nothing in the repo got accidentally touched).

---

## Verification steps (Tom-side, after CC reports done)

1. Read the Part 0 SQL header. Confirm CHECK constraint citations look right.
2. Run Part 0 in Supabase SQL editor. Confirm row counts match expectations (~12-18 promotions, 0-6 inserts for new bases).
3. Run `01_discovery.py` against real Supabase. Confirm `orphans.csv` has ~570-575 rows.
4. Run `02_classify_with_haiku.py --sample 20` on a 20-row subset. Skim the dispositions for quality. If Haiku is making bad calls, iterate the prompt before burning full API.
5. Run `02_classify_with_haiku.py` on the full file. Expect ~$2-4 in API cost (589 rows × ~500-800 tokens per row × Haiku pricing).
6. Run `03_render_review.py`. Open `review_table.md`. Skim the "Low-confidence rows" section first; the "New-base proposals" section second; the rest as time allows. Estimated triage time: 30-45 min.
7. Edit `dispositions.csv` for any overrides. Re-run `03_render_review.py` to confirm edits applied.
8. Run `04_generate_sql.py`. Open `docs/CC_PROMPTS/8D_CP1.5_variant_linkage_migration.sql`. Skim the INSERTs + UPDATEs.
9. Run the migration in Supabase SQL editor.
10. Run `05_verify.sql`. Confirm orphan rate dropped from 82% → ~20%.
11. On-device: open a recipe that uses EVOO. Confirm the ingredient line gets a ✓ if olive oil is stocked. Open a recipe that uses chicken breast. Confirm ✓ if chicken is stocked. Switch to "Pantry Match %" sort; recipes should re-order with the new linkage.
12. Capture the result of Query 5 (recipes still using the demoted `cheese` base) — drop into DEFERRED_WORK as T12.

---

## SESSION_LOG entry format

Append at the TOP of `docs/SESSION_LOG.md`:

```markdown
## 2026-MM-DD — Phase 8D CP1.5: catalog variant linkage backfill pipeline
**Phase:** 8D
**Prompt from:** CC_PROMPT_8D_CP1.5.md

[Body: what was built, files touched, verification results, surprises/notes. Especially flag any contradictions found between the schema CSV and the actual `ingredients` table structure, and any places where the Haiku prompt needed iteration.]

**Files created:**
- `docs/CC_PROMPTS/8D_CP1.5_base_set_corrections.sql` (Part 0)
- `docs/CC_PROMPTS/8D_CP1.5_variant_linkage_migration.sql` (placeholder; generated by Part 4)
- `scripts/cp1_5_catalog_backfill/01_discovery.py`
- `scripts/cp1_5_catalog_backfill/02_classify_with_haiku.py`
- `scripts/cp1_5_catalog_backfill/03_render_review.py`
- `scripts/cp1_5_catalog_backfill/04_generate_sql.py`
- `scripts/cp1_5_catalog_backfill/05_verify.sql`
- `scripts/cp1_5_catalog_backfill/.gitignore`
- `scripts/cp1_5_catalog_backfill/README.md` (brief pipeline overview pointing back at this prompt + the planning doc)

**Files NOT modified (per Tom's standing rule):** all 8D in-flight code stays uncommitted. CP1.5 pipeline is greenfield additions only.

**Verification results:**
- `git status` matches in-flight table: ✅ / drift surfaced as: [...]
- CHECK constraint text cited in SQL: ✅
- `ingredient_type` values enumerated: [paste]
- Pipeline structure complete: ✅
- Dry-run sample (`01_discovery.py`): [paste first 5 orphans.csv rows]
- Mock Haiku dispositions (`02_classify_with_haiku.py --sample 3`): [paste]
- Review markdown sample (`03_render_review.py`): [paste first 10 lines]
- TypeScript clean: ✅

**Surprises / notes:**
- [Anything unexpected — e.g., a CHECK constraint not in the CSV, an `ingredient_type` value variation, a Haiku-prompt iteration]

**Recommended doc updates:**
- `PHASE_8D_PLANNING.md`: append D8D-Q14 through Q18 to the decisions log (Claude.ai will do this at 8D close).
- `PROJECT_CONTEXT.md`: 8D-CP1.5 flip from 🔲 to 🟡 (pipeline built; awaiting Tom run).
- `DEFERRED_WORK.md`: T12 candidate (cheese-base recipe ingredient followup) — placeholder; populate after Tom runs Query 5.
- `FF_LAUNCH_MASTER_PLAN.md`: no change needed yet.

**Recommended next steps for Tom:**
1. Run Part 0 SQL in Supabase. Verify post-state.
2. Set `ANTHROPIC_API_KEY` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars locally.
3. Run `01_discovery.py`. Sanity-check the orphan count.
4. Run `02_classify_with_haiku.py --sample 20`. Skim quality. Iterate prompt if needed (re-run script after edit).
5. Run full classification batch. Triage `review_table.md` (~30-45 min).
6. Edit `dispositions.csv` for overrides.
7. Generate + run the linkage migration. Verify post-state with `05_verify.sql`.
8. Capture Query 5 result into DEFERRED_WORK T12.
9. On-device sanity check on a few recipes (EVOO, chicken breast, kosher salt).
```

---

## Anti-traps — things to NOT do

1. **Don't bundle form-column backfill.** D8D-Q18 explicitly defers it. If a "fresh basil" vs "dried basil" question comes up during Haiku iteration, the answer is: both link to `basil`, form is a separate problem. Adding form classification to the prompt doubles the schema surface and muddies Tom's triage.

2. **Don't pre-write any destructive SQL without grepping the CHECK constraint definitions.** This is W12 in active force. The cheese cleanup migration in CP1 failed twice because the prior instance assumed OR-semantics on `supply_has_identity` when the actual constraint is XOR. Cite exact `check_clause` text in SQL header comments before writing destructive operations.

3. **Don't execute SQL directly.** CC writes the SQL files; Tom runs them in Supabase. This is the standing project rule, not a CP1.5-specific carve-out.

4. **Don't call the Anthropic API in this session** unless Tom explicitly provides credentials AND asks for a sample run. The pipeline is greenfield + verifiable via mock fixtures. Burning API on 589 rows during CC's pipeline-build session is wasted spend.

5. **Don't trust `git log`.** All 8D work is uncommitted. `git status` + `git diff` are the source of truth for what's running on Tom's phone. The in-flight table above is the authoritative inventory.

6. **Don't update living docs.** `PROJECT_CONTEXT.md`, `PHASE_8D_PLANNING.md`, `FF_LAUNCH_MASTER_PLAN.md`, `FRIGO_ARCHITECTURE.md` stay as-is. Doc reconciliation happens at phase close per `DOC_MAINTENANCE_PROCESS.md` Section 10, not per-CP. Only `DEFERRED_WORK.md` and `PROCESS_WATCHPOINTS.md` are touched per-CP when items materialize — and this prompt doesn't touch them either (no new items emerge until Tom runs the pipeline).

7. **Don't bundle CP3 or CP4 work.** CP1.5 is data; CP3/CP4 are UI. Mixing them muddies verification. CP3 and CP4 prompts already exist; CP1.5 should ship cleanly and independently.

8. **Don't promote orphans beyond the structural-fix list in Part 0 without Haiku's input.** Part 0 is the deterministic surgery (3 protein bases, 9 produce bases, 6 cheese bases, 1 cheese demotion) that was scoped by the prior planning instance. Anything beyond that goes through the Haiku → Tom review pipeline.

9. **Don't assume "cheese" is the only legacy base needing demotion.** "oil" stays as a base per D8D-Q15 (cooking-fat parent). If Haiku surfaces other bases that look D8D-Q1-questionable (e.g., a base that's actually a non-substitutable category), flag in the review artifact but don't auto-demote — surface to Tom.

10. **Don't infer `ingredient_type` values for new bases.** Look them up via the discovery query CC adds to Part 0. Different families have different conventions; guessing risks a CHECK constraint failure mid-migration.

---

## Followups (not in this prompt's scope)

These are anticipated post-CP1.5 items. They land in DEFERRED_WORK or future prompts; CC does not create them in this session.

- **T12 (DEFERRED_WORK candidate):** The 1 recipe ingredient still pointing at the demoted `cheese` base — investigate and re-point to a specific cheese variant or improve the recipe's ingredient parsing. Surfaced by Query 5 in Part 5.
- **Form-column backfill pass (D8D-Q18 separate pass):** ~30-40 rows where `form` should be populated for matched ingredient pairs (`dried basil`/`fresh basil`, etc.). Drives the matcher's `formMismatch` annotation accuracy.
- **CP3 prompt (`CC_PROMPT_8D_CP3.md`):** Recipe tap-sheet on ingredient rows. Already drafted; cleared for execution after CP1.5 (or in parallel — UI doesn't depend on catalog state).
- **CP4 prompt (`CC_PROMPT_8D_CP4.md`):** What-can-I-cook screen. Already drafted; runs after CP3 lands.
- **`supabase/migrations/` discipline (P7-23):** two unapplied migrations surfaced in CP1 (cheese cleanup pre-cleanup, unknown-status). Bumping priority is a planning-pass decision; CP1.5 doesn't address.
