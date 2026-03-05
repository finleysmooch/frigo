# Code_Log Tracker Specification

**Location:** `docs/TRACKER_SPEC.md`
**Referenced from:** `CLAUDE.md`
**Sheet:** FRIGO_TRACKER → Code_Log tab

---

## Overview

The Code_Log sheet is an append-only log of every file touched per commit. The Codebase tab auto-generates a current-state rollup from Code_Log via formulas — never edit Codebase directly.

---

## Columns (tab-separated, this exact order)

| # | Column | Description |
|---|--------|-------------|
| 1 | **EntryDate** | `YYYY-MM-DD` format |
| 2 | **File** | Full relative path from repo root (e.g., `screens/PantryScreen.tsx`). **Primary key.** |
| 3 | **Status** | `Active` · `Renamed` · `Deleted` |
| 4 | **ReplacedBy** | Full path of replacement (Renamed only, blank otherwise) |
| 5 | **Domain** | `Recipe` · `Cooking` · `Planning` · `Social` · `Pantry` · `Grocery` · `Discovery` · `Platform` |
| 6 | **Type** | `Screen` · `Modal` · `Service` · `Component` · `Utility` |
| 7 | **Lines** | Total line count |
| 8 | **CodeDate** | `YYYY-MM-DD` format |
| 9 | **Imports** | Semicolon-separated local imports, no extensions (e.g., `supabase; theme; recipeService`) |
| 10 | **Exports** | Semicolon-separated named exports |
| 11 | **Purpose** | Short description. `[PURPOSE]` placeholder if unsure — owner fills in |
| 12 | **Changes** | Commit message + file-specific details. `Initial import` for first entries |
| 13 | **Notes** | Optional. Flag anything unusual |

---

## File Path Rules

- Always use forward slashes: `lib/services/recipeService.ts`
- Path is relative to repo root — no leading `./` or `/`
- The File column is the **primary key**. Two files with the same basename (e.g., `lib/services/recipeService.ts` vs `lib/services/recipeExtraction/recipeService.ts`) must have distinct full paths.

---

## Date Format

All dates must be `YYYY-MM-DD`. This prevents Excel auto-conversion to serial numbers.

---

## Batch Entries

For large groups of similar files (e.g., 78 SVG icon components), use a single batch row:
- File: `components/icons/ (78 icon files)`
- Lines: approximate total prefixed with `~` (e.g., `~2400`)
- Purpose: describe the batch
- Track index/barrel files as individual rows alongside the batch row

---

## Handling Renames, Moves, and Deletes

**Renamed or moved file (TWO rows):**
```
2026-03-03	components/OldName.tsx	Renamed	components/NewName.tsx									
2026-03-03	components/NewName.tsx	Active		Recipe	Modal	234	2026-03-03	imports	exports	[PURPOSE]	refactor: Renamed	
```

**Deleted file:**
```
2026-03-03	components/DeadFile.tsx	Deleted										chore: Remove unused
```

---

## Examples

**New file:**
```
2026-03-03	screens/NewScreen.tsx	Active		Recipe	Screen	234	2026-03-03	theme; types	NewScreen	[PURPOSE]	feat(recipes): Add screen	
```

**Modified existing file (Purpose blank — Codebase preserves original via formula):**
```
2026-03-03	lib/services/recipeService.ts	Active		Recipe	Service	445	2026-03-03	supabase	updateRecipe		feat(recipes): Add scaling	
```

---

## TSV Output

Generate the file at `docs/tracker_update.tsv`. This file is the handoff — owner pastes it into Code_Log.

```bash
# Header
printf "EntryDate\tFile\tStatus\tReplacedBy\tDomain\tType\tLines\tCodeDate\tImports\tExports\tPurpose\tChanges\tNotes\n" > docs/tracker_update.tsv

# Append rows
printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
  "2026-03-03" "lib/services/recipeService.ts" "Active" "" \
  "Recipe" "Service" "445" "2026-03-03" \
  "supabase" "updateRecipe" "" "feat(recipes): Add scaling" "" \
  >> docs/tracker_update.tsv
```

Rules:
- Tab-delimited, no quoting unless a value contains a tab (it shouldn't)
- Empty fields = empty string between tabs (never skip a column)
- No trailing content after the Notes column
- Always include the header row

---

## Generation Workflow

1. Get commit message: `git log -1 --pretty=%s`
2. Get changed files: `git diff-tree --no-commit-id --name-status -r HEAD`
3. For each changed `.ts` / `.tsx` file, generate one row with full relative path
4. Write all rows to `docs/tracker_update.tsv`
5. Tell the owner:
   - How many rows were generated
   - Which files are new (need `[PURPOSE]` filled in)
   - Remind to paste into Code_Log sheet