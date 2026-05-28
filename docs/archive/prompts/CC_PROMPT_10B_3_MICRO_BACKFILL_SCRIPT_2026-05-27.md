# CC Prompt — Phase 10B-3: Generate USDA FDC micronutrient backfill SQL

## Context

Phase 10B (Micronutrient Data Layer) is in flight. Step 10B-1 (schema: 10 new columns on `ingredients`) is shipped. Step 10B-2 (FDC nutrient ID verification against broccoli ground truth) is complete — all values match.

This step (10B-3) is the **script-generation step**. CC writes a one-shot Python script that consumes USDA FDC SR Legacy bulk CSV data + Frigo's fdc_id allowlist, and emits a single `.sql` file containing one atomic `UPDATE` statement that backfills 10 micronutrient columns across ~458 ingredient rows.

**Critical constraint:** CC does NOT touch the database. CC produces SQL. Tom runs SQL in Supabase. Same workflow as 10A.

## Inputs

### Input 1: USDA SR Legacy bulk CSVs (already on Tom's machine)

Local path: `C:\Users\tommo\Frigo Support Docs\USDA Data\FoodData_Central_sr_legacy_food_csv_2018-04\`

Files we need:
- **`food_nutrient.csv`** (~644K rows, ~60MB). Schema (header row 1):
  ```
  "id","fdc_id","nutrient_id","amount","data_points","derivation_id","min","max","median","footnote","min_year_acquired"
  ```
  We use columns `fdc_id`, `nutrient_id`, `amount`. Stream-process it — don't load all 644K rows into memory.

- **`nutrient.csv`** (475 rows). Reference only; we don't need to read it programmatically, the nutrient IDs are hardcoded below.

### Input 2: Frigo fdc_id allowlist

Tom will save the file at: `<repo_root>/_scratch/frigo_fdc_ids_2026-05-27.csv`

Schema:
```
ingredient_id,name,usda_fdc_id
6ee54c20-...,2% milk,170870
...
```

~458 rows. Multiple ingredient rows may share the same `usda_fdc_id` (synonyms — e.g., "almond" / "almonds" / "almond flour" all → 170567). The script's UPDATE statement matches on `usda_fdc_id`, so one VALUES row updates all matching ingredient rows automatically. Dedup at this step — emit one VALUES row per unique fdc_id.

### Input 3: The 10 FDC nutrient IDs and target column names

Hardcode this mapping in the script:

| FDC nutrient_id | Frigo column | Unit |
|---|---|---|
| 1106 | `vitamin_a_per_100g_mcg` | mcg (FDC unit "UG") |
| 1162 | `vitamin_c_per_100g_mg` | mg (FDC unit "MG") |
| 1114 | `vitamin_d_per_100g_mcg` | mcg (FDC unit "UG") |
| 1178 | `vitamin_b12_per_100g_mcg` | mcg (FDC unit "UG") |
| 1190 | `folate_per_100g_mcg` | mcg (FDC unit "UG") |
| 1089 | `iron_per_100g_mg` | mg (FDC unit "MG") |
| 1087 | `calcium_per_100g_mg` | mg (FDC unit "MG") |
| 1092 | `potassium_per_100g_mg` | mg (FDC unit "MG") |
| 1090 | `magnesium_per_100g_mg` | mg (FDC unit "MG") |
| 1095 | `zinc_per_100g_mg` | mg (FDC unit "MG") |

Units already match Frigo's column units. No conversion needed.

## Task

### Step 1: Write the Python script

Save to: `<repo_root>/_scratch/scripts/backfill_micros_2026-05-27.py`

Script behavior:

1. Parse `frigo_fdc_ids_2026-05-27.csv`, extract the unique set of `usda_fdc_id` values (call this `target_fdc_ids`). The CSV may have integer strings; preserve them as strings to match how the food_nutrient.csv stores them. Log how many unique fdc_ids were loaded.

2. Stream-read `food_nutrient.csv` (use `csv.DictReader` with a file handle — DO NOT use pandas.read_csv on the full file; it's too big to load comfortably). For each row:
   - Skip if `fdc_id` is not in `target_fdc_ids`
   - Skip if `nutrient_id` is not in our 10 IDs
   - Accumulate the value into a nested dict: `data[fdc_id][nutrient_id] = float(amount)` (handle empty `amount` as None)

3. After streaming, log:
   - How many fdc_ids found at least one matching nutrient row (should be close to len(target_fdc_ids); flag any missing)
   - How many fdc_ids had ALL 10 nutrients populated (informational — many won't, especially plant foods missing B12/D)

4. Emit the SQL file at: `<repo_root>/_scratch/sql/backfill_micros_2026-05-27.sql`

   Format (ONE atomic UPDATE statement):

   ```sql
   -- Phase 10B-3 Backfill: USDA FDC micronutrient data for ~458 ingredients
   -- Generated YYYY-MM-DD HH:MM:SS by _scratch/scripts/backfill_micros_2026-05-27.py
   -- Source: USDA SR Legacy food_nutrient.csv (April 2018)
   -- Affects: ingredients table, 10 micronutrient columns
   
   BEGIN;
   
   UPDATE ingredients i
   SET 
     vitamin_a_per_100g_mcg   = m.vitamin_a,
     vitamin_c_per_100g_mg    = m.vitamin_c,
     vitamin_d_per_100g_mcg   = m.vitamin_d,
     vitamin_b12_per_100g_mcg = m.vitamin_b12,
     folate_per_100g_mcg      = m.folate,
     iron_per_100g_mg         = m.iron,
     calcium_per_100g_mg      = m.calcium,
     potassium_per_100g_mg    = m.potassium,
     magnesium_per_100g_mg    = m.magnesium,
     zinc_per_100g_mg         = m.zinc
   FROM (
     VALUES
       ('170379', 31::numeric, 89.2::numeric, 0::numeric, 0::numeric, 63::numeric, 0.73::numeric, 47::numeric, 316::numeric, 21::numeric, 0.41::numeric),  -- broccoli
       ('170870', NULL::numeric, NULL::numeric, ..., ...)  -- 2% milk
       -- ... etc, one row per unique fdc_id
   ) AS m(fdc_id, vitamin_a, vitamin_c, vitamin_d, vitamin_b12, folate, iron, calcium, potassium, magnesium, zinc)
   WHERE i.usda_fdc_id = m.fdc_id;
   
   COMMIT;
   ```

   Format rules:
   - The `::numeric` cast is only needed on the FIRST row of VALUES (PostgreSQL infers types from there). Cast all values in row 1; subsequent rows omit casts.
   - Use `NULL` (no cast needed) when a nutrient is missing for that fdc_id.
   - Comment each VALUES row with the human-readable ingredient name (best-effort — when multiple ingredients share an fdc_id, comment the first one alphabetically + "(N more)" where N is the additional count, e.g. `-- almond (+2 more)`).
   - One row per unique fdc_id (deduped).
   - Wrap in BEGIN/COMMIT for atomicity.

5. Emit a verification report at the end of the script's stdout:
   - Print the broccoli row that was generated. It MUST be:
     ```
     ('170379', 31, 89.2, 0, 0, 63, 0.73, 47, 316, 21, 0.41)
     ```
     If it doesn't match exactly, STOP and report a discrepancy — do not write the SQL file.
   - Print row count of unique fdc_ids in the SQL.
   - Print any fdc_ids from `target_fdc_ids` that had ZERO matching rows in food_nutrient.csv (these become a warning — they're fdc_ids in Frigo that don't exist in the FDC bulk). List them with their ingredient name from the Frigo CSV.

### Step 2: Run the script

Once written, run the script. Capture the stdout.

### Step 3: Sanity check the SQL output

Before reporting done, run these checks against the generated SQL file:

```bash
# Should have exactly one BEGIN, one COMMIT, one UPDATE
grep -c "^BEGIN;" _scratch/sql/backfill_micros_2026-05-27.sql   # expect 1
grep -c "^COMMIT;" _scratch/sql/backfill_micros_2026-05-27.sql  # expect 1
grep -c "^UPDATE ingredients" _scratch/sql/backfill_micros_2026-05-27.sql  # expect 1

# Broccoli row check
grep "170379" _scratch/sql/backfill_micros_2026-05-27.sql  # expect line ending with: 0.41), or similar with broccoli comment
```

### Step 4: SESSION_LOG entry

Append to `docs/SESSION_LOG.md` under today's date (today is 2026-05-27, the same date as the 10A entry that should already be there — append under it):

```
### Phase 10B-3 — USDA FDC micronutrient backfill SQL generated
Generated SQL backfill for 10 new micronutrient columns across ~458 ingredient rows.

Inputs:
- USDA SR Legacy bulk CSV (food_nutrient.csv, ~644K rows) from Tom's local USDA data
- Frigo fdc_id allowlist (_scratch/frigo_fdc_ids_2026-05-27.csv, 458 rows / ~350 unique fdc_ids)

Outputs:
- _scratch/scripts/backfill_micros_2026-05-27.py — one-shot generation script
- _scratch/sql/backfill_micros_2026-05-27.sql — atomic UPDATE statement for Tom to run in Supabase

Verification:
- Broccoli row (fdc_id 170379) matches expected values exactly: 31, 89.2, 0, 0, 63, 0.73, 47, 316, 21, 0.41 ✓
- N unique fdc_ids written, M of N had all 10 nutrients populated [fill in actual numbers]
- [List any fdc_ids that had ZERO matching rows — these need follow-up by Tom]

Pending: Tom runs the SQL in Supabase as step 10B-4, then we move to 10B-5 (inherit micros for the 22 estimated_from_similar rows) and 10B-6 (matview rewrite to roll up micros).
```

## Constraints

- DO NOT touch the database (no Supabase client, no API calls)
- DO NOT modify any files outside `_scratch/`, `docs/SESSION_LOG.md`
- DO NOT load food_nutrient.csv into memory all at once (use streaming/iterator pattern — `csv.DictReader` on file handle is fine)
- DO NOT add dependencies — use stdlib only (`csv`, `pathlib`, `datetime`, no pandas)
- The SQL file MUST be valid PostgreSQL. Test that the syntax parses if possible (Python can do a rough check; full validation is Tom's job when he runs it).
- If broccoli's row doesn't match the verification values exactly, ABORT and report — do not emit the SQL file. This is a tripwire.
- Preserve the exact column-name spellings from the schema (`vitamin_a_per_100g_mcg` etc. — see Input 3 table)

## What to do if things go wrong

- **fdc_id list file missing:** Tell Tom to save the CSV to `_scratch/frigo_fdc_ids_2026-05-27.csv` and re-run.
- **food_nutrient.csv path doesn't resolve:** The path uses Windows-style backslashes; if running under WSL or unix shell, convert to `/mnt/c/Users/tommo/...` or similar. Ask Tom which environment CC is running in if unclear.
- **Broccoli verification fails:** Do not emit SQL. Print the actual vs expected values and stop. Tom will diagnose.
- **fdc_ids in Frigo that aren't in food_nutrient.csv:** Continue — log them as warnings, emit SQL for the ones that match.

## Reporting back

When done, paste:
1. Stdout summary from the script run
2. Confirmation of all 4 sanity checks passing
3. The exact line count of the generated SQL file
4. The first 30 lines of the SQL file so we can eyeball formatting
5. The SESSION_LOG entry you appended
