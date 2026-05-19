# CC Prompt — Living-Doc Reconciliation + Phase 8/8R Merge

**For:** Claude Code session
**Issued:** 2026-05-15 (Claude.ai)
**Phase:** 8R Closeout
**Estimated:** 45-75 min
**Branch:** main

---

## Context

Phase 8R smoke validation passed clean 2026-05-15. Claude.ai authored four doc updates capturing this state + the 8D-not-shipped verification finding + 5 stale `pantry_items` query site discovery. This prompt applies those updates to repo, merges the two phase docs (8 + 8R) into a single canonical doc, and stages everything to `_pk_sync/`.

**Inputs Tom will provide:** Four files Claude.ai staged at `/mnt/user-data/uploads/` (or attached to your session):
- `PROJECT_CONTEXT.md` — drop-in replacement for repo `docs/PROJECT_CONTEXT.md`
- `PHASE_8R_UNIFIED_NEEDS.md` — v0.7 content; provides the closeout-state additions Claude.ai authored
- `DEFERRED_WORK_v5_20_addendum.md` — edit instructions for repo `docs/DEFERRED_WORK.md`
- `FF_LAUNCH_MASTER_PLAN_v6_4_addendum.md` — edit instructions for repo `docs/FF_LAUNCH_MASTER_PLAN.md`

The "addendum" files are edit-instructions, not drop-ins — they specify which sections to add/modify in the existing repo file. Read them carefully and apply the specified changes.

The PROJECT_CONTEXT.md staged file is a COMPLETE replacement, but contains ONE outdated reference that this prompt corrects: its "Active phase doc" pointer says `PHASE_8R_UNIFIED_NEEDS.md`. After this prompt runs, the active phase doc will be `PHASE_8_PANTRY_AND_GROCERY.md`. Apply that correction during ingestion.

---

## Task

### Part 1 — Merge phase docs into `PHASE_8_PANTRY_AND_GROCERY.md`

**Source files (in repo):**
- `docs/PHASE_8_PANTRY_INTELLIGENCE.md` — captures sub-phases 8A, 8B, 8C, 8C-Shared, 8D, 8E. Sub-phases 8C-CP5 through CP8 + 8C-Shared CP3/CP4 were superseded by 8R mid-flight; their content stays but with superseded-status flags. Existing version is v2.15.
- `docs/PHASE_8R_UNIFIED_NEEDS.md` — captures the unified-needs refactor (CP1 through CP6e + smoke). Existing version is v0.6 in repo (Claude.ai has authored v0.7 as the staged input).

**Output file (new):** `docs/PHASE_8_PANTRY_AND_GROCERY.md`

**Merge approach — Approach A (chronological narrative with superseded sections preserved):**

The merged doc should read top-to-bottom as the full Phase 8 arc:

```
# Phase 8 — Pantry & Grocery (Household Needs)

## Why this phase exists
[Pull from existing PHASE_8_PANTRY_INTELLIGENCE Goals + PHASE_8R "Why this phase exists" — synthesize the
combined narrative: original Phase 8 reframed mid-flight by 8R refactor 2026-04-29.]

## Canonical terminology
[Pull from PHASE_8 canonical terminology section. Add: "After 8R-CP1, the term 'staples' is preserved
in user-facing language but the underlying model is the unified supplies+needs schema. See architectural
concept below."]

## Prerequisites
[Pull from existing PHASE_8 prerequisites unchanged; add 8R-CP1 schema as foundation prerequisite for 8D/8E.]

## Scope
### Product Feature Roadmap items touched
[Preserve from PHASE_8 unchanged.]

### Sub-phase overview (final, post-refactor)
| Sub | Scope | Sessions | Status |
|-----|-------|----------|--------|
| 8A | Schema foundation + pantry polish | 3-4 | ✅ Complete |
| 8B | Staples & depletion | 4-5 | ✅ Complete |
| 8C | Grocery UX overhaul | 6-8 | 🟡 Partially shipped — CP1-CP4 + CP4a ship valuable; CP4b/CP4c/CP5-CP8 superseded by 8R |
| 8C-Shared | Shared grocery list infrastructure | 4 | 🟡 PARTIALLY SUPERSEDED by 8R — CP1+CP2+CP2b+CP2b.1 shipped (architectural background); CP3+CP4 absorbed into 8R-CP3/CP4 |
| **8R** | **Unified household needs refactor** | **~6 weeks actual** | 🟢 Mid-closeout — CP1 through CP6e shipped; smoke clean 2026-05-15 |
| 8D | Recipe-pantry matching | 3-5 | 🔲 Verified NOT SHIPPED 2026-05-15 — see PHASE_8D_PLANNING.md |
| 8E | Recipe discovery polish | 3-4 | 🔲 F&F-relevant subset deferred to after 8D |

## Sub-phase details (chronological, preserving full history)

### 8A — Schema foundation + pantry polish
[Preserve verbatim from PHASE_8_PANTRY_INTELLIGENCE. Already shipped.]

### 8B — Staples & depletion
[Preserve verbatim from PHASE_8_PANTRY_INTELLIGENCE. Already shipped.]

### 8C — Grocery UX overhaul + Ingredient Detail + Freezer cleanout
[Preserve verbatim from PHASE_8_PANTRY_INTELLIGENCE. Mark CP5-CP8 as 🟡 SUPERSEDED by Phase 8R with
inline annotation; mark CP1-CP4a as ✅ shipped. Preserve all the decision-trace narrative — it
documents what was tried + why it changed.]

### 8C-Shared — Shared grocery list infrastructure
[Preserve verbatim from PHASE_8_PANTRY_INTELLIGENCE. Already marked 🟡 SUPERSEDED throughout.]

### 8R — Unified household needs refactor

[Pull from PHASE_8R_UNIFIED_NEEDS.md v0.6 (repo) plus the v0.7 additions from the staged input file:
 - "Why this phase exists" sub-section becomes a sub-header here, framed as "Why 8R replaced the
   8C continuation"
 - "Architectural concept" section preserved verbatim from PHASE_8R v0.6
 - "Scope" section preserved
 - "Decisions log" section preserved including the v0.7 D8R-Q54-OVERRIDE addition
 - "Build plan" section preserved with v0.7's final status (all CPs ✅, smoke ✅ 2026-05-15)
 - "Wireframe reference" preserved]

### 8D — Recipe-pantry matching
🔲 Not yet started. Verified NOT SHIPPED 2026-05-15. See `PHASE_8D_PLANNING.md` (scoping doc) for full
build plan: 5 CPs, ~3.5-4.5 sessions, cheese duplicate cleanup migration bundled as CP1 Part 0.

### 8E — Recipe discovery polish + natural search + low stock
[Preserve verbatim from PHASE_8_PANTRY_INTELLIGENCE. Note that 8E rewrites against 8R substrate when it
arrives, so the specifics may need refresh during 8E planning.]

## Cross-cutting architectural patterns
[Preserve from PHASE_8 unchanged. View toggle pattern, locked filter chip pattern, fraction display utility,
inline tap-sheet pattern. Note that all these patterns survived the 8R refactor — they were UX patterns,
not data-model decisions.]

## Decisions log (combined)
[Preserve all D8-1 through D8-41, D8C-CP4-* series, D8C-CP4a-* series, D8C-CP4b-* series, D8C-Shared-* 
series from PHASE_8 unchanged. THEN add a divider:

----
### Phase 8R decisions (D8R-Q1 through Q60 + D8R-Q54-OVERRIDE)

[Preserve all D8R-Q1 through D8R-Q60 from PHASE_8R v0.6. THEN add the D8R-Q54-OVERRIDE entry from the
staged v0.7 input file. Preserve full original wireframe iteration narrative (Q19-Q27, Q28-Q34, Q35-Q37,
Q43-Q60) — the decisions matter for any future revisit.]
----

## Deferred items (preserve all P8R-D series with v0.7 status updates)
[Preserve from PHASE_8R v0.7 staged input — P8R-D1 through D38 with current resolution states.]

## Changelog
[Combine the two changelog tables. Add a new top entry capturing the merge:
| 2026-05-15 | merged | **Phase 8 and Phase 8R merged into single PHASE_8_PANTRY_AND_GROCERY.md.** All sub-phase 
content + decisions logs + deferred items preserved from both source docs verbatim. 8C-CP5-CP8 + 8C-Shared CP3-CP4
remain marked 🟡 SUPERSEDED inline. 8R content gains v0.7 closeout state (CP6e shipped, smoke clean, D8R-Q54 OVERRIDE).
Original PHASE_8_PANTRY_INTELLIGENCE.md and PHASE_8R_UNIFIED_NEEDS.md moved to docs/archive/phases/. |
```

**Hard requirements:**
- Zero information loss. Every decision-log entry, every deferred-item entry, every architectural-concept paragraph, every wireframe reference from BOTH source docs must appear in the merged doc.
- Verbatim preservation of decisions logs and deferred items (do NOT paraphrase D-numbered entries).
- Superseded content stays in place with status flags — do not delete the 8C-CP5-CP8 or 8C-Shared CP3-CP4 content even though those were never shipped. The decision-trace value is real.
- Preserve the v0.6 PHASE_8R "Architectural concept" section verbatim. The v0.7 staged file has a "preserved by reference to v0.6" note in that section — do NOT carry forward the placeholder note; pull the actual content from v0.6 into the merged doc.
- Final merged doc will be ~900-1100 lines. That's expected; don't trim for length.

### Part 2 — Apply PROJECT_CONTEXT.md update

The staged `PROJECT_CONTEXT.md` is a complete replacement for repo `docs/PROJECT_CONTEXT.md`. Apply with ONE correction:

**Find every reference to** `PHASE_8R_UNIFIED_NEEDS.md` **in the staged file** and replace with `PHASE_8_PANTRY_AND_GROCERY.md`.

Specifically these spots in the staged file need correction:
- "Active phase doc (currently `PHASE_8R_UNIFIED_NEEDS.md`)" → "Active phase doc (currently `PHASE_8_PANTRY_AND_GROCERY.md`)"
- "Active phase doc (`PHASE_8R_UNIFIED_NEEDS.md`)" → "Active phase doc (`PHASE_8_PANTRY_AND_GROCERY.md`)"
- "Read the active phase doc (`PHASE_8R_UNIFIED_NEEDS.md`)" → "Read the active phase doc (`PHASE_8_PANTRY_AND_GROCERY.md`)"
- "Active phase doc — `PHASE_8R_UNIFIED_NEEDS.md`" → "Active phase doc — `PHASE_8_PANTRY_AND_GROCERY.md`"

Also in the "Active phase" section under "What's Next", currently says "Phase 8R — Unified Household Needs." Change to "Phase 8 — Pantry & Grocery (Household Needs)." The status state below it stays unchanged.

Write the corrected file to `docs/PROJECT_CONTEXT.md`.

### Part 3 — Apply DEFERRED_WORK addendum

Open the staged `DEFERRED_WORK_v5_20_addendum.md`. It contains 5 sections of edit instructions:
- **Section 1:** new section to insert at a specific anchor — append after "From: Phase 8R — CP6e-Lots planning (May 6, 2026)" subsection, before "## From: Phase 7" section
- **Section 2:** status updates to existing items — apply the strike-through + status updates in the existing tables for P8R-D24, P8R-D27, P8R-D28, P8R-D4
- **Section 3:** new row in "Cross-Cutting Technical Debt" table — T8
- **Section 4:** changelog entry to prepend to the changelog table
- **Section 5:** no DEFERRED_WORK change — informational only, ignore

Apply all 4 active sections to repo `docs/DEFERRED_WORK.md`. Verify before/after row counts.

### Part 4 — Apply FF_LAUNCH_MASTER_PLAN addendum

Open the staged `FF_LAUNCH_MASTER_PLAN_v6_4_addendum.md`. It contains 6 edit blocks (Edits 1-6) plus a cross-validation checklist (Section 7).

Apply each edit at the specified location in repo `docs/FF_LAUNCH_MASTER_PLAN.md`:
- **Edit 1:** Header status line replacement
- **Edit 2:** Phase Sequence table — 8R row replacement + new 8D row insertion + timeline summary replacement
- **Edit 3:** Strategic Context — new sub-section appended to "Where We Are"
- **Edit 4:** Risk Register — two new rows appended
- **Edit 5:** Working Agreements — no changes (skip)
- **Edit 6:** Changelog — prepend new row

After applying, run Section 7's cross-validation: confirm all the listed statements ("late August or early September 2026", 8R status, 8D status, cheese cleanup framing, T8 framing) appear consistently across the file.

### Part 5 — Archive the old phase docs

Use `git mv` to preserve history:
- `docs/PHASE_8_PANTRY_INTELLIGENCE.md` → `docs/archive/phases/PHASE_8_PANTRY_INTELLIGENCE.md`
- `docs/PHASE_8R_UNIFIED_NEEDS.md` → `docs/archive/phases/PHASE_8R_UNIFIED_NEEDS.md`

These are now subsumed by the merged `docs/PHASE_8_PANTRY_AND_GROCERY.md` but the archive copies preserve the original incremental history.

### Part 6 — Stage updated docs to `_pk_sync/`

Per the doc-maintenance workflow, every repo-side living-doc change stages a copy in `_pk_sync/` for Tom's manual PK upload.

Copy these into `_pk_sync/`:
- `docs/PROJECT_CONTEXT.md`
- `docs/PHASE_8_PANTRY_AND_GROCERY.md`
- `docs/DEFERRED_WORK.md`
- `docs/FF_LAUNCH_MASTER_PLAN.md`

Do NOT include the archived files in `_pk_sync/` — those are historical, not active PK members.

### Part 7 — SESSION_LOG entry

Append one entry to `docs/SESSION_LOG.md`:

```markdown
## 2026-05-15 — Living-doc reconciliation + Phase 8/8R merge

**Type:** Living doc updates per Claude.ai instructions. CC executes; doc content authored by Claude.ai.

**Files modified:**
- `docs/PROJECT_CONTEXT.md` — v10.3 (replaced; active phase pointer corrected to PHASE_8_PANTRY_AND_GROCERY.md)
- `docs/PHASE_8_PANTRY_AND_GROCERY.md` — NEW (merged from PHASE_8_PANTRY_INTELLIGENCE.md + PHASE_8R_UNIFIED_NEEDS.md)
- `docs/DEFERRED_WORK.md` — v5.20 (5 sections of edits applied)
- `docs/FF_LAUNCH_MASTER_PLAN.md` — v6.4 (6 edits applied)
- `docs/archive/phases/PHASE_8_PANTRY_INTELLIGENCE.md` — moved (git mv)
- `docs/archive/phases/PHASE_8R_UNIFIED_NEEDS.md` — moved (git mv)
- `_pk_sync/` — 4 files staged for Tom's manual PK upload

**Merge approach:** Approach A (chronological narrative) per Claude.ai design. Both source docs preserved verbatim 
in their respective sub-phase sections. Superseded 8C-CP5-CP8 and 8C-Shared CP3-CP4 content retained with status 
flags (decision-trace value). v0.7 closeout-state additions (CP6e ✅, smoke ✅, D8R-Q54-OVERRIDE) merged in. 
Zero information loss.

**Verification:**
- Merged doc line count: <N> lines (expected: 900-1100)
- Pre-existing D-numbered decisions in source docs: <count from both files>
- Post-merge D-numbered decisions: <count from merged file> (must match)
- Pre-existing P8R-D entries: <count>
- Post-merge P8R-D entries: <count> (must match)
- DEFERRED_WORK pre/post row counts per section (especially the 4 status-updated items)
- FF_LAUNCH_MASTER_PLAN cross-validation block: all 5 statements consistent

**Recommended doc updates Claude.ai should make:**
- None this pass — Claude.ai already authored everything.

**Open issues for Claude.ai:**
- <flag anything ambiguous CC encountered during merge>

**No commit yet.** Tom reviews + commits separately.
```

---

## Constraints

- **Zero information loss.** Every decision-log entry, deferred-item entry, architectural-concept paragraph, and changelog entry from both source phase docs must appear in the merged doc.
- **Verbatim preservation of D-numbered decisions and P8R-D deferred items.** Do not paraphrase, condense, or restructure these — they're audit-trail content.
- **No source code changes.** This is a docs-only pass.
- **Don't commit.** Tom reviews everything before commit.
- **STOP and ask Claude.ai if you encounter:**
  - Conflict between the staged PHASE_8R v0.7 content and the repo v0.6 content beyond the documented v0.7 additions (D8R-Q54-OVERRIDE, P8R-D series status updates, build plan completion table)
  - Any decision-log entry in repo that's NOT in the staged content and therefore needs preservation logic clarified
  - Any DEFERRED_WORK or FF_LAUNCH_MASTER_PLAN row that doesn't match the addendum's "before" expected state (means repo has changed since Claude.ai's snapshot)

---

## Verification

After all parts complete:

1. `git status` — confirm:
   - `docs/PROJECT_CONTEXT.md` modified
   - `docs/PHASE_8_PANTRY_AND_GROCERY.md` new
   - `docs/DEFERRED_WORK.md` modified
   - `docs/FF_LAUNCH_MASTER_PLAN.md` modified
   - `docs/PHASE_8_PANTRY_INTELLIGENCE.md` → `docs/archive/phases/...` (rename)
   - `docs/PHASE_8R_UNIFIED_NEEDS.md` → `docs/archive/phases/...` (rename)
   - 4 files added in `_pk_sync/`
   - `docs/SESSION_LOG.md` modified (one entry appended)
   - No other files modified.

2. `wc -l docs/PHASE_8_PANTRY_AND_GROCERY.md` — expect 900-1100 lines.

3. `grep -c "^| D8" docs/PHASE_8_PANTRY_AND_GROCERY.md` — count D-numbered decision rows. Compare against pre-merge counts in source files.

4. `grep -c "^| P8R-D" docs/PHASE_8_PANTRY_AND_GROCERY.md` — count P8R-D deferred items. Compare against pre-merge counts.

5. Spot-check 3 random decisions logs and 3 random deferred items in the merged doc against their source-file equivalents — confirm verbatim preservation.

6. Open `docs/PROJECT_CONTEXT.md` and confirm zero remaining references to `PHASE_8R_UNIFIED_NEEDS.md` (all corrected to `PHASE_8_PANTRY_AND_GROCERY.md`).

7. Open `docs/FF_LAUNCH_MASTER_PLAN.md` and confirm Section 7 cross-validation: 5 statements consistent across header, scope, risks, changelog.

---

## Out of scope (deferred to other prompts)

- Repo cleanup pass (separate prompt: `CC_PROMPT_repo_cleanup_2026-05-15.md`) — can run before, after, or in parallel
- FRIGO_ARCHITECTURE.md refresh (dedicated session)
- CP6e commit batch landing (separate git workflow)
- 8D-CP1 prompt (next session, after Tom resolves 7 open questions in PHASE_8D_PLANNING.md)
- PK_CODE_SNAPSHOTS reconciliation (Claude.ai task)
- Any source-code changes (this is docs-only)
