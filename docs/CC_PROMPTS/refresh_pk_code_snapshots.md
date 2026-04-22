# Standing CC Prompt — Refresh PK Code Snapshots

**Purpose:** Regenerates every file in `docs/PK_CODE_SNAPSHOTS.md`'s Tier 1–3 tables as dated snapshots in `_pk_sync/code/`, ready for Tom to batch-upload to PK.

**When to run:**
- Sub-phase boundary (standard, every sub-phase)
- Phase completion (mandatory — per Phase Completion Checklist step 1a)
- Mid-phase (optional, when a specific file has drifted significantly)

**How Tom fires this:** paste one of the opening lines below into a Claude Code session:

- Full refresh (all tiers): `Refresh PK code snapshots. All tiers.`
- Tier-scoped: `Refresh PK code snapshots. Tier 1 only.`
- File-scoped: `Refresh PK code snapshots. Just lib/services/postService.ts and lib/services/pantryService.ts.`
- Auto-add newly-discovered files: append `Auto-add newly-discovered files in their expected tiers.` to any of the above. Default is flag-only — new files are reported in SESSION_LOG for review, not silently added to the tracking doc.

---

## Task

### Step 1 — Read the tracking doc and run discovery

1a. **Read the tracking doc.** Read `docs/PK_CODE_SNAPSHOTS.md` to get the canonical file list. Identify which tiers/files are in scope based on Tom's opening line.

If Tom's opening is ambiguous about scope, STOP and ask before doing any file operations.

1b. **Discovery pass — Tier 1 and Tier 2 only.** Tier 3 is explicitly curated (see `PK_CODE_SNAPSHOTS.md`'s "Tier assignment" section — "Do not move files between tiers ad-hoc during refreshes"). Changes to Tier 3 come from deliberate edits, not discovery. For Tier 1 and Tier 2 in scope, enumerate every repo file matching the tier's rule, then diff against the tracking doc's tier table.

**Tier 1 discovery rule:**
- `lib/services/*.ts` (flat, top level of the directory)
- `lib/services/recipeExtraction/*.ts`
- `lib/utils/*.ts`
- `constants/*.ts`
- `lib/types/*.ts` **except** `env.d.ts` (TypeScript ambient module; infra-only)
- `lib/*.ts` (flat, top level of the directory) **except** `supabase.ts`, `oldTheme.ts`, `testParser.ts` (these are in the "Explicitly excluded" list in `PK_CODE_SNAPSHOTS.md`)
- Exclude `*.test.ts` and any file under `__tests__/`

**Tier 2 discovery rule:**
- `screens/*.tsx` (flat, top level of the directory) **except** `LogoPlaygroundScreen.tsx` (dev-only playground; in the "Explicitly excluded" list)
- `components/feedCard/*.tsx` (all files in that subdirectory)
- `components/LogCookSheet.tsx` (the named Tier 2 top-level component)
- `components/stats/*.tsx` AND `components/cooking/*.tsx` are **partially** Tier 2 — some files in those directories are Tier 2 coordinators/surfaces, others are Tier 4 primitives or Tier 3 supporting. For discovery purposes: enumerate all files in these two directories, diff against the Tier 2 table AND the Tier 3 table AND the "Explicitly excluded" list. Any file that matches none of these three is genuinely newly-discovered — flag as "candidate for Tier 2 / Tier 3 / Tier 4 — Tom to decide."
- Exclude `*.test.tsx` and any file under `__tests__/`

**Tier 3 discovery:** SKIPPED. Tier 3 is curated. If a new file in `components/*.tsx` (or `contexts/`, or a new subdirectory) warrants Tier 3 treatment, Tom adds it via a deliberate edit to `PK_CODE_SNAPSHOTS.md` — not via refresh-time auto-discovery. Refresh execution does not enumerate or flag `components/*.tsx` files that aren't already in the tracking doc. One exception: if a new file appears at a path covered by the `components/stats/` or `components/cooking/` rule above, it'll surface in the Tier 2 discovery block with the "candidate for Tier 2 / Tier 3 / Tier 4" framing.

A file is "newly discovered" if it matches a Tier 1 or Tier 2 discovery rule above AND is not listed in any of the three tier tables AND is not in the "Explicitly excluded" list.

1c. **Handle discoveries.** For each newly-discovered file:

- **If Tom's opening line includes `Auto-add newly-discovered files in their expected tiers`:** add a row to the appropriate tracking-doc tier table (Tier 1 for lib/services/utils/constants/types/lib-root matches; Tier 2 for screens, feedCard, LogCookSheet matches) with blank Snapshot Date, blank Last Touched By, Staleness Risk `—`, and a Notes entry of `Auto-added YYYY-MM-DD during refresh`. Include the file in the refresh scope so it gets stamped and staged in Step 3.
  - **For ambiguous stats/ and cooking/ matches** (files that could be Tier 2 or Tier 3): auto-add places them in Tier 2 with Notes entry `Auto-added YYYY-MM-DD during refresh — ambiguous Tier 2/Tier 3; Claude.ai to review.` Tom can re-tier later via deliberate edit.
- **Otherwise (default):** do NOT add to the tracking doc; do NOT stamp or stage; collect for the SESSION_LOG "Newly-discovered files" subsection (Step 6).

Scoped refreshes (Tier 1 only, file-scoped) only run discovery for the scoped tier(s); a Tier 1–only refresh does not discover Tier 2 files. File-scoped refreshes skip discovery entirely.

**Also flag deletions.** For each file listed in the tracking doc that does NOT exist in the repo, report in SESSION_LOG under a "Stale tracking rows" subsection. Do not silently remove rows — per `PK_CODE_SNAPSHOTS.md`'s "Tier assignment" section, row removal is a deliberate edit in the same commit as the file deletion, not a refresh side effect. If stale rows are present at refresh time, something has drifted and Tom needs to decide how to reconcile.

### Step 2 — Confirm target directory exists

```bash
mkdir -p _pk_sync/code
```

### Step 3 — For each in-scope file, generate the dated snapshot

For every file in scope:

1. Read the current contents from the repo working tree
2. Strip any existing `/** PK SNAPSHOT — ... */` header block if present (from a prior refresh)
3. Determine snapshot-header insertion point. Check the **first non-empty line** of the file (after stripping the old snapshot header, if any). If it is any of the following:
   - Shebang line (`#!...`)
   - TypeScript triple-slash reference directive (`/// <reference ... />`)
   - JSX pragma (`/** @jsx... */` or `/* @jsx... */` at the very top)
   - String directive (`"use client"`, `"use strict"`, etc.)

   …then insert the snapshot header **AFTER** that line (preserve any blank line the original had between the directive and the rest of the file). Otherwise, prepend the snapshot header to line 1.

   For Frigo specifically, these directive cases are expected to be rare or absent (Expo/RN projects typically don't use any of them), but the defense costs nothing.

4. The snapshot header to insert is:
   ```typescript
   /**
    * PK SNAPSHOT — YYYY-MM-DD
    * Canonical source: repo working tree at finleysmooch/frigo
    * This file may be stale if CC has edited it since the snapshot date.
    * During active phase work, the working tree is authoritative — not this snapshot.
    */
   ```
   where `YYYY-MM-DD` is today's date
5. Write the stamped file to `_pk_sync/code/<path-with-slashes-replaced-by-double-underscore>` — flat layout, no subdirectories. PK upload is per-file and doesn't accept folders, so staging must be flat. The `__` separator preserves path context in the filename so pattern-finding still works and basename collisions (two `recipeService.ts` files, etc.) stay distinguishable.
   - Example: `lib/services/postService.ts` → `_pk_sync/code/lib__services__postService.ts`
   - Example: `screens/FeedScreen.tsx` → `_pk_sync/code/screens__FeedScreen.tsx`
   - Example: `App.tsx` (no directory prefix) → `_pk_sync/code/App.tsx`
   - Collision example: `lib/services/recipeService.ts` → `lib__services__recipeService.ts` and `lib/services/recipeExtraction/recipeService.ts` → `lib__services__recipeExtraction__recipeService.ts` — both survive as distinct files.

### Step 4 — Update `docs/PK_CODE_SNAPSHOTS.md`

For each file refreshed:

1. Update the "Snapshot Date" column to today's date
2. Update the "Last Touched By" column if Tom's opening line mentioned the current phase (e.g., "refreshing after Phase 8A")
3. **Reset the "Staleness Risk" column to Low** for the refreshed files. A successful refresh supersedes any prior HIGH flag, because the snapshot is now synchronized with the working tree.

If Tom's opening doesn't specify the current phase, skip updating "Last Touched By" and flag this in the SESSION_LOG.

### Step 5 — Update the "Refresh history" table

Append a new row with today's date, the trigger (sub-phase / phase-completion / mid-phase / initial-seed), and the count of files refreshed per tier.

### Step 6 — Write SESSION_LOG entry

Use the standard v5.1 entry format from `DOC_MAINTENANCE_PROCESS.md` Section 8. Key things to include:

- Count of files refreshed per tier
- Note that Staleness Risk columns were reset to Low across the refreshed set
- **"Newly-discovered files" subsection** (from Step 1b/1c): list every file found in the Tier 1 or Tier 2 discovery pass, grouped by the tier it would belong to. For each file, include: path, expected tier (or "ambiguous Tier 2/Tier 3" for stats/cooking candidates), and a one-line guess at "Last Touched By" based on filename + any signals CC can grep for (recent phase references in the file header, git-log last-change, etc.). If auto-add mode was active, note which files were auto-added. If flag-only mode (default), the list is Tom's decision queue for whether to add to the tracking doc.
- **"Stale tracking rows" subsection** (from Step 1b): list any files in the tracking doc that don't exist in the repo. Each entry should include: path, last snapshot date from the tracking doc, and a one-line note if the file was obviously deleted in a known phase (based on DEFERRED_WORK T5 status for PostCookFlow, or git-log for others). Tom decides whether to remove the rows and when.
- "Recommended doc updates" block — if the discovery pass surfaced new files that weren't auto-added, recommend updating `PK_CODE_SNAPSHOTS.md`. Otherwise likely `none` across the board.

**Note on Rule E:** this refresh prompt itself does NOT edit any tier-listed files (it only reads them), so no PK-snapshot-staleness flagging applies to this execution. If you find yourself about to flag a tier-listed file during a refresh, stop — something has gone wrong, likely the refresh atomicity constraint has been violated.

### Step 7 — Report to Tom in chat

Summary in chat:
- "Refreshed N files across T tiers to `_pk_sync/code/`"
- Any anomalies flagged in SESSION_LOG
- Instructions for Tom: "Upload `_pk_sync/code/` contents to PK (bulk), replacing stale copies, then clear `_pk_sync/code/` keeping the directory structure but removing the files."

---

## Constraints

- **Only touch files in the Tier 1–3 tables.** Don't add ad-hoc files. If Tom asks for a file not in the table, flag it and ask whether it should be added permanently (update `PK_CODE_SNAPSHOTS.md`) or handled as a one-off direct upload instead.
- **Don't modify the source files in the repo.** Only read them.
- **Refresh atomicity — do not edit any tier-listed file during a refresh execution.** The refresh reads tier-listed files, stamps snapshots, resets Staleness Risk columns, and writes tracking-doc updates. If any tier-listed file is also edited in this execution, the snapshot and tracking-doc state become inconsistent (snapshot captures time T₀, Staleness Risk reset to Low claims currency as of T₁ where T₁ > T₀ and includes an edit at T₀.₅). If Tom's opening line implies editing tier-listed files as part of the refresh, STOP and report — the refresh and the edits must be separate executions.
- **Don't commit.** Tom reviews `_pk_sync/code/` contents, uploads, and commits `PK_CODE_SNAPSHOTS.md` separately if it changed.
- **Stage files flat with `__` path separators** in `_pk_sync/code/`. PK upload is per-file and doesn't accept folders, so mirrored subdirectories would be stripped at upload time anyway. The `__` convention (e.g., `lib__services__postService.ts`) preserves path context in the filename so pattern-finding still works and basename collisions (e.g., the two `recipeService.ts` files) stay distinguishable. Do NOT create subdirectories under `_pk_sync/code/`.
- If a file listed in `PK_CODE_SNAPSHOTS.md` doesn't exist in the repo, STOP that file and flag in SESSION_LOG — don't silently skip, don't guess.

---

## Verification

Before finishing:

```bash
# 1. Every file in _pk_sync/code/ has the snapshot header
grep -L "PK SNAPSHOT" _pk_sync/code/*.ts _pk_sync/code/*.tsx
# Expect: empty (no files missing the header). Flat layout — single-level glob, no recursion needed.

# 2. Flat layout intact — no subdirectories
find _pk_sync/code -mindepth 1 -type d | wc -l
# Expect: 0. Any subdirectories mean a file wasn't flattened via the __ separator rule.
# Also sanity-check the naming pattern:
ls _pk_sync/code/ | head -10
# Expect: files like App.tsx, lib__services__postService.ts, screens__FeedScreen.tsx, etc.

# 3. PK_CODE_SNAPSHOTS.md snapshot dates updated
grep "$(date +%Y-%m-%d)" docs/PK_CODE_SNAPSHOTS.md | head -5
# Expect: at least a few matches (more if full refresh)

# 4. Staleness Risk column reset across refreshed rows
grep -E '(\|| )HIGH(\|| )' docs/PK_CODE_SNAPSHOTS.md | wc -l
# Expect: 0 after a full refresh. Scoped refreshes: non-refreshed rows may still be HIGH, which is correct.

# 5. Discovery-pass summary reported in SESSION_LOG
grep -c "^### Newly-discovered files" docs/SESSION_LOG.md | head -1
# Expect: at least 1 if any new files were discovered in Tier 1 or Tier 2 regions;
# 0 is fine if repo matches tracking doc exactly.
# If discovery found new files but this subsection is missing, Step 6 was skipped.

# 6. Stale tracking rows subsection — only appears if files in tracking doc are missing from repo
grep -c "^### Stale tracking rows" docs/SESSION_LOG.md | head -1
# Expect: 0 in normal operation; 1+ only if something has drifted.
# Currently T5 tracks PostCookFlow deletion — if that lands before next refresh, expect this subsection to show up once.
```

---

## Recommended commit flow after refresh

Two separate commits:

1. `chore(pk): refresh code snapshots YYYY-MM-DD` — commit `docs/PK_CODE_SNAPSHOTS.md` updates (the tracking doc changes)
2. `_pk_sync/code/` itself is gitignored so doesn't commit — Tom just uploads to PK

After Tom uploads to PK, clean up:

```bash
rm -rf _pk_sync/code/*  # preserve the directory, remove the staged files
```
