# CC Prompt — Phase 10A: DEFERRED_WORK update (trigger-vs-client deferral)

## Context

Phase 10A (Raw/cooked architecture fix) shipped its database portion today 2026-05-27 in a Claude.ai planning chat with Tom. The DB-side work is complete and verified:

- Added `ingredient_state` text column to `recipe_ingredients` (CHECK constraint: `IS NULL OR IN ('raw','cooked')`)
- Backfilled 81 affected rows via SQL regex on `original_text` + `preparation` (26 → 'cooked', 55 → 'raw')
- Rewrote `recipe_nutrition_computed` materialized view to apply `cooked_ratio` only when `ri.ingredient_state = 'cooked'` (11 occurrences in view body)
- Added missing unique index `recipe_nutrition_computed_recipe_id_idx` on `recipe_id` — `refresh_recipe_nutrition()` was silently broken because `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index and none existed
- Verified against 5 control recipes including Quesadillas (state='cooked' control: stayed exactly unchanged at cal_per_serving=737)

The **going-forward mechanism** for auto-populating `ingredient_state` on newly-created/edited recipe_ingredients rows was discussed but deferred. Two options on the table:
- **(A) PostgreSQL trigger** (BEFORE INSERT/UPDATE on recipe_ingredients) applying the same regex rule used in the 10A backfill
- **(B) TypeScript update** in the extraction pipeline (likely `lib/services/recipeExtraction/unifiedParser.ts`)

Tom's call: defer the choice to the next time extraction-pipeline-adjacent work is on the table — likely 10B (USDA FDC micronutrient work) or P8D-CP4-1 (Haiku→Sonnet upgrade), whichever ships first. Until then, new extractions store `ingredient_state = NULL`, which the new view treats identically to `'raw'` — correct for the dominant case (recipes specifying dry weight).

## Inputs to read

1. `docs/DEFERRED_WORK.md` — read the current state (Tom's earlier 8D-CP4 update from today already landed; current version and structure should reflect that)

## Task

### Edit 1: Add new section at top of phase-sections list

Insert a new `## From: Phase 10A` section **above whatever section is currently topmost** in the phase-sections list (preserves reverse-chronological convention; Phase 10 is newer than any existing section).

Section header (verbatim, including formatting):

```
## From: Phase 10A — Raw/Cooked Architecture Fix (May 27, 2026)
```

Section body (verbatim, including the table header row):

```
| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P10A-1 | **Trigger vs. client-side mechanism for auto-populating `ingredient_state` on new/edited `recipe_ingredients` rows.** Two options on the table: (A) BEFORE INSERT/UPDATE PostgreSQL trigger applying the same regex rule used in the 10A SQL backfill (`original_text ~* '\y(cooked\|leftover\|cans?\|canned)\y'` plus `preparation ~* '\y(cooked\|canned)\y'`); (B) TypeScript update in the extraction pipeline (likely `lib/services/recipeExtraction/unifiedParser.ts`). Trade-offs: trigger = single source of truth, can't be bypassed regardless of insert path, zero TS changes; client-side = visible in code review, easier to test in isolation, evolves naturally with extraction logic. **Until decided, new extractions store `ingredient_state = NULL`**, which the rewritten `recipe_nutrition_computed` view treats identically to `'raw'`. This is correct for the dominant case (dry-weight recipe specs) and matches the rule applied to the existing 55 raw rows in the backfill. Decide when extraction pipeline updates are next on the table — likely co-located with Phase 10B USDA FDC backfill work or with P8D-CP4-1 (Haiku→Sonnet upgrade), whichever ships first. | 🔧 | 🟡 | Deferred 2026-05-27 during 10A wrap-up. Not blocking; only affects recipes added between now and the decision. Expect ~30-50 new affected rows during F&F period at current extraction velocity. |
```

### Edit 2: Update document header

- Update the `**Last Updated:**` line to `May 27, 2026` (if not already that date from an earlier 2026-05-27 edit, leave it; otherwise update)
- Increment the `**Version:**` number by 0.01 (e.g., 5.29 → 5.30, or 5.30 → 5.31 — whatever the current version is)

### Edit 3: Add changelog row

Add a new row at the **top** of the changelog table at the bottom of the doc (above the most recent existing row, which is probably an earlier 2026-05-27 entry from the 8D-CP4 reconciliation):

```
| 2026-05-27 | <new-version> | Phase 10A reconciliation (database portion). Added new `## From: Phase 10A — Raw/Cooked Architecture Fix (May 27, 2026)` section with P10A-1 deferring trigger-vs-client-side decision for `ingredient_state` auto-population. DB side of 10A (column add, 81-row backfill, view rewrite to apply cooked_ratio conditionally, unique index fix for previously-broken concurrent refresh) shipped in-chat 2026-05-27. |
```

Use the new version number you set in Edit 2 in the changelog row.

### Edit 4: PK sync staging

Copy the updated `docs/DEFERRED_WORK.md` to `_pk_sync/2026-05-27-deferred-work/DEFERRED_WORK_2026-05-27.md` so Tom can manually upload to PK after this session. Create the `_pk_sync/2026-05-27-deferred-work/` directory if it doesn't exist.

If `_pk_sync/2026-05-27-deferred-work/` already exists from an earlier 8D-CP4 sync today, REPLACE the file in it (don't make a second sync directory for the same day).

### Edit 5: SESSION_LOG entry

Append to today's entry in `docs/SESSION_LOG.md` (a 2026-05-27 entry should already exist from the 8D-CP4 work — append under it, don't create a new one):

```
### Phase 10A — DB shipped + DEFERRED_WORK update
Phase 10A database portion shipped in Claude.ai planning chat with Tom:
- Added `ingredient_state` column to `recipe_ingredients` with CHECK constraint
- Backfilled 81 affected rows: 26 'cooked', 55 'raw'
- Rewrote `recipe_nutrition_computed` materialized view: `cooked_ratio` now applies only when `ri.ingredient_state = 'cooked'`
- Added `recipe_nutrition_computed_recipe_id_idx` (unique on recipe_id) — fixes previously-silent breakage of `refresh_recipe_nutrition()` since `REFRESH ... CONCURRENTLY` requires a unique index
- Verified against 5-recipe control set; Quesadillas (cooked-state control) stayed exactly unchanged; raw-state recipes shifted up in expected directions and magnitudes

DEFERRED_WORK.md updated: new section `From: Phase 10A` with item P10A-1 (trigger-vs-client mechanism for ingredient_state auto-population, deferred to next extraction-pipeline CP). Version bumped, staged to `_pk_sync/2026-05-27-deferred-work/`.

The going-forward extraction mechanism (P10A-1) is the only remaining 10A scope; everything else from 10A is shipped.
```

## Constraints

- DO NOT modify any other sections of DEFERRED_WORK.md
- DO NOT touch other docs (PROJECT_CONTEXT, PHASE_*, FF_LAUNCH_MASTER_PLAN, etc.) — that's the planning brain's work
- DO NOT change any existing item's priority, type, or notes
- DO NOT reformat existing sections
- The section header MUST match the existing convention exactly: `## From: Phase N — Name (Month DD, YYYY)`
- Preserve the table column order: `# | Item | Type | Priority | Notes`
- Use the doc's existing emoji legend: `🔧` (tech debt), `🟡` (medium priority)

## Verification

Before reporting done, run:

1. `grep -c "^## From" docs/DEFERRED_WORK.md` — should return one more than before (subtract pre-edit count from post-edit count = 1)
2. `grep "P10A-1" docs/DEFERRED_WORK.md` — should return exactly one line
3. `head -8 docs/DEFERRED_WORK.md` — should show updated Last Updated and Version lines
4. `ls _pk_sync/2026-05-27-deferred-work/` — should show `DEFERRED_WORK_2026-05-27.md`
5. `git diff docs/DEFERRED_WORK.md` — confirm changes are limited to: 2 header lines + 1 new section block (header + table header + 1 row) + 1 new changelog row. Nothing else.
6. `git diff docs/SESSION_LOG.md` — confirm only the appended Phase 10A entry under today's date, no other changes

If any verification step fails, do not commit. Report the failure and what you observed.

## Reporting back

When done, paste:
- The final SESSION_LOG entry you appended
- The version-number transition (e.g., "5.30 → 5.31")
- Confirmation that all 6 verification checks passed
- Any deviations or unexpected state encountered (e.g., if the repo's DEFERRED_WORK.md version was different than your PK snapshot expected, just note it — that's fine, CC reads canonical state)
