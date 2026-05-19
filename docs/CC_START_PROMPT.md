# CC Prompt — Stage current repo files for PK upload (CP6a planning prep)

**Type:** File staging only (no edits, no analysis, no SESSION_LOG entry needed)
**Trigger:** Claude.ai needs current repo state of 10 specific files to draft CP6a accurately. PK snapshots are pre-8R (April 22) and don't reflect CP1-CP5b changes.
**Standing rules:** A (no living-doc edits — N/A here), C (use git mv if tracked — N/A here, copying not moving), D (NO strategic content — N/A, this is mechanical).

---

## Task

Copy each of the following files from the repo working tree to `_pk_sync/` with datestamp suffix `_2026-04-30`. Use the existing `_pk_sync/` filename convention (replace path separators with `__`, append `_YYYY-MM-DD` before the extension).

### Files to stage

| # | Repo path | `_pk_sync/` target filename |
|---|-----------|---------------------------|
| 1 | `lib/pantryService.ts` (if it exists) | `_pk_sync/lib__pantryService_2026-04-30.ts` |
| 2 | `screens/RecipeDetailScreen.tsx` | `_pk_sync/screens__RecipeDetailScreen_2026-04-30.tsx` |
| 3 | `lib/services/highlightsService.ts` | `_pk_sync/lib__services__highlightsService_2026-04-30.ts` |
| 4 | `screens/PantryScreen.tsx` | `_pk_sync/screens__PantryScreen_2026-04-30.tsx` |
| 5 | `components/AddNeedSheet.tsx` | `_pk_sync/components__AddNeedSheet_2026-04-30.tsx` |
| 6 | `components/recipe/IngredientsSection.tsx` | `_pk_sync/components__recipe__IngredientsSection_2026-04-30.tsx` |
| 7 | `lib/services/needsService.ts` | `_pk_sync/lib__services__needsService_2026-04-30.ts` |
| 8 | The supply-tile component in PantryScreen — likely `components/pantry/StapleCell.tsx` OR the equivalent post-CP4 rename | `_pk_sync/components__pantry__StapleCell_2026-04-30.tsx` (adjust filename if renamed) |
| 9 | `lib/services/cookDepletionService.ts` | `_pk_sync/lib__services__cookDepletionService_2026-04-30.ts` |
| 10 | `lib/types/pantry.ts` (if it still exists) | `_pk_sync/lib__types__pantry_2026-04-30.ts` |

### Handling missing files

- If file #1 (`lib/pantryService.ts`) does NOT exist (i.e., already deleted in some prior CP), do NOT create the staged copy. Just note "DELETED" in the SESSION_LOG-equivalent summary below.
- If file #10 (`lib/types/pantry.ts`) does NOT exist, same handling.
- If file #8 has been renamed (e.g., from `StapleCell.tsx` to `SupplyCell.tsx` or similar post-CP4), stage the actual current file under the equivalent `_pk_sync/` name. Note the rename in the summary.
- For all other files (#2-7, #9): if any is missing, that's a **STOP and flag** condition — these should all exist post-CP5b.

### Output summary

Print a short summary to stdout (no SESSION_LOG entry, no doc edits, no commit):

```
Staged for PK upload:
- _pk_sync/lib__pantryService_2026-04-30.ts (NNN lines) | DELETED
- _pk_sync/screens__RecipeDetailScreen_2026-04-30.tsx (NNN lines)
- _pk_sync/lib__services__highlightsService_2026-04-30.ts (NNN lines)
- ...

Notes:
- [any rename observations]
- [any missing-file flags]
```

---

## Constraints

1. **DO NOT modify any source file.** This is a copy operation only.
2. **DO NOT edit any living doc.** No SESSION_LOG entry, no PHASE_8R update, no PROJECT_CONTEXT touch.
3. **DO NOT commit.** Tom uploads from `_pk_sync/` to PK manually; commit happens later if/when Tom decides to track these snapshots.
4. **DO NOT analyze the files.** No code review, no diff against PK, no observations beyond "exists / doesn't exist / renamed."
5. **DO NOT add files beyond the 10 listed.** If you see something that "looks relevant" while running this, flag it in the summary but don't stage it without authorization.

---

## Verification

1. `ls _pk_sync/*_2026-04-30.*` — confirm 10 (or fewer if any were DELETED) files exist with today's datestamp.
2. For each staged file: byte-identical to source via `diff` (no transformation).
3. `git status` — `_pk_sync/` is gitignored or accepts untracked files; either way, no source files should appear modified.

---

## Why this is needed

Claude.ai is drafting the CP6a prompt and needs current state of:
- The pantry-era purge surface area (files 1, 2, 3, 4, 6, 10) — to scope "complete the purge" correctly. PK snapshots are pre-8R; CC's CP5b verification grep was scoped narrowly (matched only `pantryStaplesService`, missed bare `pantryService`).
- The CP6a build targets (files 5, 7, 8) — to write accurate "edit this part of this file" instructions.
- The cookDepletion baseline (file 9) — to anticipate any CP6c (bulk acquire) cross-dependencies.

Once these are in PK, Claude.ai drafts CP6a with file-and-line-level precision instead of operating from stale snapshots.