# CC Prompt — CP1.5 Close-out: Doc Reconciliation

**Date:** 2026-05-19
**Session type for the planning side:** phase planning (Phase 8D CP1.5 close)
**Purpose of this prompt:** mechanical doc updates that lock in the CP1.5 catalog backfill as shipped work and prepare the planning baseline for CP2 (4-level matcher build).

---

## Context

Phase 8D-CP1.5 (AI-assisted ingredient catalog variant linkage backfill) shipped on 2026-05-19 via 9 interactive SQL migrations executed by Tom directly in Supabase (Claude.ai proposed dispositions chunk-by-chunk; Tom approved and ran each). The work delivered:

- **Strict (i) per D8D-Q19 applied retroactively across all 4 families** (Dairy, Proteins, Produce, Pantry) — each functionally-distinct variety is its own base; soft-match category encoded in `ingredient_subtype`.
- **Catalog state at CP1.5 close:**
  - Dairy: 46 bases, 17 linked, 6 orphan
  - Proteins: 51 bases, 37 linked, 1 orphan
  - Produce: 152 bases, 16 linked, 3 orphan
  - Pantry: 355 bases, 38 linked, 0 orphan
  - **Total catalog:** ~604 bases, ~108 linked, **10 known-intentional orphans**, **0 NULL subtypes**
- **~700+ rows received meaningful subtypes** across ~70 distinct subtype values
- **Soft-match scaffolding complete** — 4-level matcher (T20, deferred) can read `ingredient_subtype` + `form` directly to compute Level 1/2/3/4 match results
- **No code or schema changes** in CP1.5 — pure data migration

CP1.5 was originally scoped as a Python pipeline via Haiku. Mid-session pivot to interactive SQL with Claude.ai proposing dispositions. Resulting orphaned code at `scripts/cp1_5_catalog_backfill/` to be cleaned up (see Task 5 below).

---

## Inputs to read

Before making any edits:

1. `docs/SESSION_LOG.md` — head to confirm the last entry style
2. `docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md` — find the CP1.5 status block and its surrounding structure
3. `docs/DEFERRED_WORK_2026-05-15.md` — confirm the T-numbering convention; check the highest T-number currently in use
4. `docs/PROJECT_CONTEXT_2026-05-15.md` — find the Phase 8 status summary section
5. `docs/DOC_MAINTENANCE_PROCESS_2026-04-22.md` Sections 6 (`_pk_sync/` workflow), 10 (phase reconciliation discipline) — for reference on staging PK-resident doc updates

Do **not** edit `FRIGO_ARCHITECTURE.md` in this prompt — schema changes were data-only, no architectural impact requiring documentation. If you spot a relevant outdated reference flag it in the SESSION_LOG instead of editing.

---

## Task

### Task 1 — Append SESSION_LOG entry for CP1.5

Add an entry at the top of `docs/SESSION_LOG.md` under today's date header (`## 2026-05-19`, create the header if it doesn't exist). The entry should be titled `CP1.5 — Catalog Variant Linkage Backfill — COMPLETE` and include:

- One-paragraph summary of what shipped
- The 9 migration files executed (see list in Task 4 below)
- Final catalog state table (the bullet list under "Catalog state at CP1.5 close" in the Context section above)
- Key design decisions locked: D8D-Q14, Q15, Q17, **Q19** (the big one — replaces Q1's bidirectional substitutability with strict-promotion + soft-match-via-subtype; supersedes Q1)
- Cross-chunk subtype connections delivered (list at minimum: `mustard` 7 rows across 3 types, `coffee` 6 rows across 2 types, `flour` 9 rows, `chocolate` 5 rows, `stock` includes broths post-merge, `nut_butter` includes tahini)
- Reference to deferred items T12-T24 (see Task 3) — note "details captured in DEFERRED_WORK"
- Note that the next checkpoint is **CP2 = matcher 4-level logic build (separate CC prompt forthcoming)**

### Task 2 — Update PHASE_8_PANTRY_AND_GROCERY phase doc

In `docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md`:

(a) **Find the CP1.5 section/checkpoint block.** Update its status from in-progress to **COMPLETE 2026-05-19**.

(b) **Add a CP1.5 results subsection** (or expand the existing one) with:

- Short prose summary (3-5 sentences): what was done, why the Python pipeline got abandoned mid-execution, the strict-(i) D8D-Q19 retroactive scope, and that soft-match scaffolding is now complete.
- The catalog state table (same data as in the SESSION_LOG entry).
- A "Subtype conventions established" block listing the key subtype groupings: salt, pepper, chile/dried_chile (split), mushroom, leafy_green, root_vegetable, citrus, basil/oregano/parsley/rosemary/thyme (per-herb, cross-family fresh/dried share subtype), ginger_fresh vs ginger_spice (split per Tom's fresh-vs-spice principle), rice, pasta, noodle (split from pasta), vinegar, wine, fortified_wine, spirit, beer, oil split into neutral_oil / olive_oil / finishing_oil (D8D-Q15), sugar (shared across all dry sugars), syrup (shared across liquid sweeteners + fruit molasses), legume, dried_fruit, mustard (cross-form family), nut_butter (includes tahini), preserves, hot_sauce, soy_sauce, stock (broths merged in), spice_blend, always_available (water + ice — matcher should skip).
- A "Cross-chunk subtype family demonstrations" block — at minimum the mustard family (7 rows across Condiments, Spices, Nuts & Seeds) and coffee family (6 rows across Coffee & Tea, Baking). Use the structure: list the rows with `(name, ingredient_type, subtype, form)` tuples.

(c) **Add a "Known intentional orphans (10)" block** listing the rows that remain orphan post-CP1.5 with reasons. Pull from the catalog state table — should be Dairy 6 (the demoted cheese base + frozen yogurt + ghee + labneh + quail egg + young sheep's milk cheese), Proteins 1 (whole fish), Produce 3 (mixed greens, fresh chile, chili pepper).

(d) **Add a "What CP1.5 did NOT do" block.** Explicitly: no matcher code changes (matcher is still binary; needs T20 build); no UI changes; no removal of the orphaned Python pipeline at `scripts/cp1_5_catalog_backfill/`; no schema changes beyond the `ingredients_base_or_variant_not_both` CHECK constraint added in the base_set_corrections migration; no rename of `nut_butter` subtype (technically loose but functional — captured as deferred).

### Task 3 — Append deferred items to DEFERRED_WORK

In `docs/DEFERRED_WORK_2026-05-15.md`, append the following items at the end (or in the appropriate section if the doc has typed buckets). Use the existing T-numbering — increment from the highest current T-number; if the existing items already use T1-T11, these are T12-T24 (adjust if existing items use different numbering):

```
- **T12** [CP1.5 / 8D] — 1 recipe_ingredient row may point at the demoted cheese base 
  (id 8fbe2d77-...). Tom should run the Part 5 Query 5 from the base_set_corrections 
  migration to identify and redirect or leave per recipe context. Low priority — 
  unlikely to surface as a real bug; just hygiene.

- **T13** [CP1.5 / 8D] — Sub-family hierarchy for functional substitutes within a 
  subtype: e.g., ghee↔butter share subtype='butter' currently; further hierarchy 
  could distinguish "clarified" form for finer matcher decisions. Post-F&F if at all.

- **T14** [CP1.5 / 8D] — Remaining catalog dedup pass: scan for any X / X-cheese 
  pairs, unicode/case duplicates not caught in CP1.5, or pre-existing 
  inconsistencies the chunk-by-chunk audit may have missed. Run a 
  duplicate-name-fuzzy-match query post-F&F.

- **T15** [CP1.5 / 8D] — Non-dairy milks (almond/coconut/oat) are family='Dairy' 
  but technically not dairy. Family reclassification consideration post-F&F; 
  affects browse/filter UI more than matcher.

- **T16** [CP1.5 / 8D] — No DB constraint preventing `base_ingredient_id` from 
  pointing at a non-base row. Hand audit in Chunks 0a-3, 0b, A, C, D found ~11 
  such cases pre-CP1.5; all fixed in CP1.5. To prevent regression, add 
  trigger-based enforcement.

- **T17** [CP1.5 / 8D] — Cured meats (bacon, prosciutto, etc.) classified as 
  ingredient_type='Red Meat' in Proteins family but functionally distinct from 
  fresh red meats. Consider new ingredient_type='Cured Meats' post-F&F.

- **T18** [CP1.5 / 8D] — Color/cultivar variant link policy inconsistency. New 
  Produce-migration dispositions promoted color variants standalone (red 
  onion, color cabbages, color peppers each own base) while pre-existing 
  links for color bell peppers, potato cultivars, cherry/grape tomato were 
  preserved (then unlinked-and-promoted in Chunk 0a-3 for full (i) consistency). 
  Audit: any remaining color/cultivar links that should also be promoted.

- **T19** [CP1.5 / 8D] — Trigger-based enforcement for `base_ingredient_id` → 
  the referenced row's `is_base_ingredient=true`. Currently relies on app-level 
  discipline. Pairs with T16.

- **T20** [CP1.5 / 8D] — **THE BIG ONE** — Build 4-level soft-match feature. 
  Data scaffolding complete (see CP1.5 close-out). Matcher refactor + UI 
  changes required. Spec (see CP2 prompt):
  - L1 Exact: same row OR linked via base_ingredient_id → ✓ "you have it"
  - L2 Form variant: same subtype + different form → ⚠ "you have a different 
    form of this ingredient"
  - L3 Substitute: same subtype + same form → ⚠ "you have a similar ingredient"
  - L4 No match: different subtype → ✗ "you don't have it"
  Post-F&F engineering work. Estimated CP-scale: matcher service refactor + 
  RecipeDetailScreen UI update + smoke test = ~1-2 days CC work.

- **T21** [CP1.5 / 8D] — Rename `date` row to `dates` (plural canonical). 
  Currently kept singular because singular had 6 recipe refs; plural was 
  deleted. Convention is plural-canonical (per Tom — bay leaves, etc.). 
  Affects 6 recipe_ingredients rows; cosmetic. Defer indefinitely.

- **T22** [CP1.5 / 8D] — Matcher logic to skip `ingredient_subtype='always_available'` 
  ingredients. Currently 2 rows (water, ice). Affects ~70 recipes — without 
  this skip rule, recipes calling for water will show "missing" for users 
  who haven't stocked water. CRITICAL for matcher quality. Should bundle 
  with T20.

- **T23** [CP1.5 / 8D] — Coconut cream subtype review post-F&F. Currently 
  subtype='coconut_cream' (standalone). Could group with 'cream' subtype 
  for cross-family soft-match if user feedback shows demand. Pure data UPDATE 
  if pursued.

- **T24** [CP1.5 / 8D] — D8D-Q18 form-column backfill audit + remaining hygiene:
  - Extend the fresh-vs-spice principle to remaining ambiguous pairs.
  - Audit form values across all touched rows for consistency.
  - Consider rename of `nut_butter` → `seed_butter` or `nut_seed_butter` 
    (technically more accurate; tahini is in the subtype currently).
  - Cleanup of orphaned Python pipeline at `scripts/cp1_5_catalog_backfill/` 
    (see Task 5 below).
```

If the existing DEFERRED_WORK has typed buckets (e.g., "Bugs", "Tech Debt", "Deferred Features"), categorize each: T12/T13/T15/T17/T18/T23 = tech debt; T14/T16/T19 = catalog hygiene; T20/T22 = features (post-F&F); T21/T24 = polish.

### Task 4 — Update PROJECT_CONTEXT

In `docs/PROJECT_CONTEXT_2026-05-15.md`, find the Phase 8 status block. Update:

- CP1.5 status → **COMPLETE 2026-05-19**
- Add line: "CP2 (matcher 4-level logic) is the next checkpoint; data scaffolding ready."
- If there's an "F&F readiness" section, note that catalog data is F&F-ready; matcher behavior is still binary pending T20.

### Task 5 — Add the orphaned Python pipeline note

In `docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md`, in the CP1.5 results section, add a short subsection:

> **Orphaned scaffolding:** `scripts/cp1_5_catalog_backfill/` (the Python pipeline 
> originally scoped) is dead code after the mid-CP pivot to interactive SQL. 
> Tracked as part of T24 for cleanup. Acceptable to keep as reference until 
> 8D phase close; delete at end-of-phase doc reconciliation or capture as 
> standalone hygiene CP if Tom wants to formalize.

### Task 6 — Stage updated docs for PK sync

Per DOC_MAINTENANCE_PROCESS Section 6, copy the updated versions of:
- `PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md`
- `DEFERRED_WORK_2026-05-15.md`
- `PROJECT_CONTEXT_2026-05-15.md`

into `_pk_sync/` so Tom can manually upload them to PK. Do NOT stage `SESSION_LOG.md` — it's repo-only, not PK-resident.

### Task 7 — List of CP1.5 SQL migration files for the SESSION_LOG entry

These are the 9 migrations that executed (use this exact list in Task 1's SESSION_LOG entry):

1. `8D_CP1_5_base_set_corrections_v3.sql` — Part 0: cheese demote (1) + base inserts/promotions (18) + CHECK constraint `ingredients_base_or_variant_not_both`
2. `cp1_5_chunk_0a_1_dairy_subtypes.sql` — Dairy subtype population (69 rows)
3. `cp1_5_chunk_0a_2_proteins_subtypes.sql` — Proteins subtype population (89 rows)
4. `cp1_5_chunk_0a_3_produce_subtypes.sql` — Produce retroactive (10 promotions + 171 row subtype population)
5. `cp1_5_chunk_0b_pantry_retroactive.sql` — Pantry Q2 surgery (28 promotions + subtypes on 48 rows)
6. `cp1_5_chunk_a_pantry_small_types.sql` — Coffee & Tea (10), Dried Fruit (8), Oils & Fats (5), Stocks & Broths (5) = 28 orphans dispositioned
7. `cp1_5_chunk_b_pantry_midsize.sql` — Wines & Spirits (13), Legumes (14), Canned/Jarred (17), NULL (2) = 46 orphans dispositioned
8. `cp1_5_chunk_c_spices.sql` — Spices & Dried Herbs (83 orphans dispositioned)
9. `cp1_5_chunk_d_baking_nuts.sql` — Baking (50), Nuts & Seeds (36) = 86 orphans dispositioned
10. `cp1_5_chunk_e_grains.sql` — Grains (51 orphans dispositioned + rice wine type-fix)
11. `cp1_5_chunk_f_condiments.sql` — Condiments & Sauces (52 orphans dispositioned + dirty subtype cleanup)

(That's 11 files including the corrections + Chunk 0a-3 patch — the "9 migrations" count in the summary is approximate; use the list above as authoritative.)

---

## Constraints

- **Do not edit `FRIGO_ARCHITECTURE.md`** — schema additions in CP1.5 (one CHECK constraint) don't require architecture-level documentation.
- **Do not delete `scripts/cp1_5_catalog_backfill/`** — that's captured as T24 for end-of-phase cleanup.
- **Do not author new strategic content.** All decision text, design rationale, and subtype convention reasoning is in this prompt — your job is to copy/insert it into the right docs in the right places.
- **Preserve existing structure of the living docs.** Don't reorganize sections; just update the CP1.5 section and append where indicated.
- **Use the exact terminology from this prompt** — "D8D-Q19", "soft-match scaffolding", "4-level matcher", "T20", etc. These are referenced from other docs and the next planning session.

---

## Verification

After completing all 7 tasks:

1. `git status` should show modifications to: `SESSION_LOG.md`, `PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md`, `DEFERRED_WORK_2026-05-15.md`, `PROJECT_CONTEXT_2026-05-15.md`. Plus new files staged in `_pk_sync/`.
2. `grep -c "T20" docs/DEFERRED_WORK_2026-05-15.md` should return ≥1 (and that T20 entry should be the longest entry — it's the headline deferred item).
3. `grep "COMPLETE 2026-05-19" docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md` should return at least 1 hit (the CP1.5 status block).
4. The SESSION_LOG entry at the head of the file should be CP1.5 close, not a previous entry.
5. `_pk_sync/` should contain the 3 updated files ready for manual upload.

---

## SESSION_LOG entry format

Append this entry to `docs/SESSION_LOG.md` under `## 2026-05-19` (after writing the substantive CP1.5 close entry from Task 1):

```
### CC: doc reconciliation for CP1.5 close-out — DONE

**Prompt:** `CC_PROMPT_2026-05-19_cp1_5_close_doc_reconciliation.md`
**Files modified:**
- docs/SESSION_LOG.md (added CP1.5 close entry above this one)
- docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md (CP1.5 status → complete + results 
  block + subtype conventions + cross-chunk demonstrations + known orphans block + 
  what-CP1.5-did-not-do block + orphaned-pipeline note)
- docs/DEFERRED_WORK_2026-05-15.md (appended T12-T24)
- docs/PROJECT_CONTEXT_2026-05-15.md (Phase 8 status updated)
**Files staged in _pk_sync/:**
- PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md
- DEFERRED_WORK_2026-05-15.md
- PROJECT_CONTEXT_2026-05-15.md
**Notes:** [anything unusual found during execution, e.g., if a section structure 
  required interpretation, or if a T-number already existed and was incremented]
```

---

## Suggested commit message

```
docs: CP1.5 catalog backfill — close-out reconciliation

- CP1.5 marked COMPLETE in phase doc + project context
- T12-T24 captured in DEFERRED_WORK (T20 = 4-level matcher build, the big one)
- SESSION_LOG entry for the close
- _pk_sync/ staged with 3 updated PK-resident docs
- Living docs reflect: pantry_orphan=0, ~700 rows subtyped, 
  cross-chunk subtype families operational
```
