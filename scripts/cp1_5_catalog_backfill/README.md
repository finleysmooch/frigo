# CP1.5 — Catalog variant linkage backfill

AI-assisted backfill that links orphan ingredients to base ingredients so the
recipe-pantry matcher (`lib/services/pantryMatchingService.ts`) can do variant
traversal. Pre-CP1.5, 82% of non-base ingredients were orphans, so variant
matching fired for fewer than 1 in 5 variants.

**Full spec:** `docs/CC_PROMPT_8D_CP1.5.md` + `docs/CC_PROMPT_8D_CP1.5_DELTA_1.md`
**Phase context:** `docs/PHASE_8D_PLANNING.md` (decisions D8D-Q14–Q18)

## Pipeline

| Step | File | What it does | Who runs it |
|------|------|--------------|-------------|
| 0 | `docs/CC_PROMPTS/8D_CP1.5_base_set_corrections.sql` | Demote `cheese`; add/promote protein + herb + cheese bases; add the base/variant CHECK constraint (Sub-op D) | Tom — Supabase SQL editor, **first** |
| 1 | `01_discovery.py` | Enumerate orphans + bases → `output/orphans.csv`, `output/bases.csv` | Tom — local |
| 2 | `02_classify_with_haiku.py` | Haiku classifies each orphan → `output/dispositions.csv` | Tom — local |
| 3 | `03_render_review.py` | `dispositions.csv` → `output/review_table.md` (read-only skim) | Tom — local |
| — | (Tom edits `output/dispositions.csv` for overrides, re-runs step 3) | | Tom |
| 4 | `04_generate_sql.py` | Approved `dispositions.csv` → `docs/CC_PROMPTS/8D_CP1.5_variant_linkage_migration.sql` | Tom — local |
| — | run the generated migration | | Tom — Supabase SQL editor |
| 5 | `05_verify.sql` | Orphan-rate before/after + sanity checks | Tom — Supabase SQL editor |

## Running

```bash
# Env: .env in the repo root supplies SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# ANTHROPIC_API_KEY (the scripts auto-load it).
pip install supabase anthropic        # one-time, if not already installed

python scripts/cp1_5_catalog_backfill/01_discovery.py
python scripts/cp1_5_catalog_backfill/02_classify_with_haiku.py --sample 20   # quality check first
python scripts/cp1_5_catalog_backfill/02_classify_with_haiku.py               # full run (~$2-4)
python scripts/cp1_5_catalog_backfill/03_render_review.py
#   ... triage output/review_table.md, edit output/dispositions.csv ...
python scripts/cp1_5_catalog_backfill/03_render_review.py                     # refresh after edits
python scripts/cp1_5_catalog_backfill/04_generate_sql.py
```

### Mock mode (no DB, no API)

`01` and `02` accept `--mock` — they substitute a small fixture dataset so the
CSV stages are exercisable without credentials. Used for pipeline smoke-testing.

```bash
python scripts/cp1_5_catalog_backfill/01_discovery.py --mock
python scripts/cp1_5_catalog_backfill/02_classify_with_haiku.py --mock --sample 3
python scripts/cp1_5_catalog_backfill/03_render_review.py
python scripts/cp1_5_catalog_backfill/04_generate_sql.py
```

## Notes

- **`output/` is git-ignored** — generated CSVs/markdown are never committed.
- **CC never executes SQL or calls the Anthropic API** — it builds the pipeline;
  Tom runs it.
- Haiku model: `claude-haiku-4-5-20251001`. Decision taxonomy: `link_to_existing_base`,
  `promote_to_base`, `link_to_new_base`, `standalone`.
- The `08_CP1.5_variant_linkage_migration.sql` file is a placeholder until
  `04_generate_sql.py` overwrites it.
- TEMP-ish: this is a one-shot backfill. The scripts can be deleted after the
  migration ships and the orphan rate is verified, or kept for the deferred
  form-column backfill pass (D8D-Q18).
