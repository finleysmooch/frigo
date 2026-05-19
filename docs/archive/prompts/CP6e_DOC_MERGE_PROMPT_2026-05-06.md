# CC Prompt — CP6e doc merge into PHASE_8R + cross-doc updates

**Date:** 2026-05-06
**Author:** Claude.ai planning instance
**Type:** Mechanical doc merge — no strategic content authoring
**Estimated effort:** ~15-25 min CC time

---

## Context

CP6e-Lots is a new sub-checkpoint of Phase 8R adding lot-tracking to supplies. Schema and catalog plural audit migrations have shipped (2026-05-06 — `cp6e_schema_migration.sql`, `cp6e_catalog_plural_audit.sql`, `cp6e_catalog_plural_audit_cleanup.sql`). Tom approved 18 new design decisions (D8R-Q43 through D8R-Q60) and 5 new deferred items (P8R-D22 through P8R-D26) during 2026-05-06 wireframe + planning sessions.

The complete decision content lives in a draft addition file (see Inputs below). Your job is to merge that draft into the canonical living docs, version the affected files, and stage the PK-resident copies via `_pk_sync/`.

This is a **mechanical merge** — do not edit, condense, or rewrite the strategic content. The draft has been reviewed and approved by Tom in chat. Treat the draft as authoritative for what goes into the docs.

---

## Inputs to read

Read these in order before making any edits:

1. **`docs/CC_PROMPTS/active/CP6e_DOC_ADDITION_DRAFT_2026-05-06.md`** (Tom will save this to that path before kicking you off — confirm it's there as your first action). This is the draft addition; contains all decisions Q43-Q60, deferred items D22-D26, the CP6e build plan section, the changelog entry, and a "Cross-document updates needed" footer that lists what to update in FF_LAUNCH_MASTER_PLAN.md and DEFERRED_WORK.md.

2. **`docs/PHASE_8R_UNIFIED_NEEDS.md`** — the doc receiving the merge. Read existing structure end-to-end so your insertions match section conventions, table styles, and changelog format.

3. **`docs/FF_LAUNCH_MASTER_PLAN.md`** — Phase 8R section + risk register + changelog need updates per the draft's "Cross-document updates" section.

4. **`docs/DEFERRED_WORK.md`** — 8R section needs 5 new entries + 1 strikethrough.

5. **`docs/wireframes/phase_8r/`** — confirm directory exists (it should from v3 wireframe placement). You will move a new wireframe file here.

---

## Tasks — execute in order

### Task 1 — PHASE_8R_UNIFIED_NEEDS.md merge

Apply the draft's section additions in this order:

1. **Architectural concept** — insert two new subsections (`Lot tracking (D8R-Q43-Q60)` and `Search across supply + lot dimensions (D8R-Q56)` and `Catalog pluralization audit (D8R-Q58)`) AFTER the existing `### Multi-store membership` subsection and BEFORE `### Edit-routing pattern (D8R-Q23)`. Use the exact prose from the draft's "Section additions → Architectural concept" block.

2. **Decisions log** — add a new subsection `### Decisions from lot tracking iteration (Q43-Q60, 2026-05-05 → 2026-05-06 wireframe sessions v1+v2)` AFTER the existing `### Decisions from audit follow-up (Q35-Q37, ...)` subsection. Use the exact 18-row table from the draft.

3. **Deferred decision points table** — apply two changes:
   - Mark **P8R-D4** with strikethrough on the Topic cell, append to the "Why deferred" cell: `**REOPENED 2026-05-06 by D8R-Q43.** Lot tracking opt-in via `tracks_lots` flag — selective, per-supply. Status enum remains sufficient for non-lots cases.`
   - Add 5 new rows after P8R-D11: P8R-D22 through P8R-D26 with the exact text from the draft.

4. **Scope → In scope** — append the new bullet about "Lot tracking foundation" exactly as written in the draft.

5. **Scope → Out of scope** — append 5 new bullets per the draft.

6. **Build plan table** — add a new row for `8R-CP6e` after `8R-CP6c`. Update the "Estimated total" line at the bottom from "4-6 weeks" to "8-10 weeks".

7. **CP detailed scope sections** — add a complete new `## CP6e detailed scope (planning, 2026-05-06)` section after the existing `## CP6 detailed scope (planning, 2026-04-30)` section, BEFORE the `---` and `## Changelog` block. Use the full content from the draft (CP6e-Schema, CP6e-Services, CP6e-PantryUI, CP6e-FlowsUI sub-sections).

8. **Changelog** — add a new row at the TOP of the table (between header and existing 2026-04-30 row) with the v0.6 changelog entry exactly as written in the draft.

After all 8 changes are applied:
- Read the resulting file back end-to-end to verify section ordering is correct.
- Verify no duplicate section IDs or broken markdown.

### Task 2 — FF_LAUNCH_MASTER_PLAN.md updates

Read the existing file. Make these targeted changes:

1. **Phase Sequence table (around line 78)** — leave the existing 8R row as-is, but update its sessions estimate to account for CP6e: change `**4-6 weeks**` → `**8-10 weeks**`. Update the status note: `🔲 Planning — CP5 shipped 2026-04-30; CP6a/b/c planned; CP6e (lots model) added 2026-05-06`.

2. **Total remaining calendar time (around line 87)** — update the parenthetical and final F&F target:
   - Was: `~9-12 weeks (8R 4-6 weeks + ...)`. F&F target adjusted from early-to-mid June to **late July or August**.
   - New: `~12-15 weeks (8R now 8-10 weeks including CP6e + 8D/8E rewrite ~3-5 weeks against new substrate + Phase 9 Meal & Planning UX). F&F target adjusted from late July/August to **late August or early September** to accommodate CP6e lots model addition.`

3. **Phase 8R scope description (line 78 area, before "Why This Order")** — find any prose that summarizes 8R scope and append a short sentence: `2026-05-06 added CP6e (lots model + multi-dimension search) — see PHASE_8R_UNIFIED_NEEDS.md v0.6.`

4. **Risk Register (around line 357)** — add ONE new row at the bottom of the table:

   | Risk | Impact | Mitigation |
   |------|--------|------------|
   | CP6e is the largest single CP of the 8R sequence (4 sub-checkpoints + parallel catalog audit) | Mid-CP slip risk material; could push F&F another 1-2 weeks beyond September | Escape hatch: ship CP6e-Schema + CP6e-Services without UI rewrite (revert to today's UI on the new schema) if execution slips significantly past late-August target. PantryUI and FlowsUI can ship incrementally post-F&F. |

5. **Changelog (around line 393)** — add a new row at the top:
   - Date: `2026-05-06`
   - Version: `v6.x` (use next available; if previous was v6.0, this is v6.1)
   - Change: `**CP6e-Lots added to Phase 8R.** Schema + catalog plural audit migrations shipped 2026-05-06. 18 new decisions (D8R-Q43-Q60) capturing lot-tracking model + multi-dimension server-side search. F&F target slips ~3 weeks (late July/August → late August/early September). New Risk Register entry on CP6e size. See PHASE_8R_UNIFIED_NEEDS.md v0.6 for full scope.`

After changes:
- Read file back to verify all 5 changes applied cleanly.

### Task 3 — DEFERRED_WORK.md updates

1. **8R section table (around line 67-95)** — apply two changes:
   - Mark P8R-D4 with strikethrough exactly as in PHASE_8R doc (Task 1 step 3 — same text on the 8R deferred-points table). The DEFERRED_WORK version of P8R-D4 is at line 72 currently.
   - Add 5 new rows after P8R-D21: P8R-D22 through P8R-D26 with the exact text from the draft. Format matches existing rows: `| P8R-Dxx | **Item.** Body. | 🔧 or 🚀 | 🟡 or 🟢 | Notes. |`

2. **Changelog (around line 547)** — add a new row at the top:
   - Date: `2026-05-06`
   - Version: `5.x` (use next available; if previous was 5.17, this is 5.18)
   - Change: `**Phase 8R/CP6e deferred items added (P8R-D22 through P8R-D26).** Captures decisions deferred during 2026-05-05 → 2026-05-06 lot-tracking iteration. P8R-D4 REOPENED 2026-05-06 by D8R-Q43 (tracks_lots opt-in flag). See PHASE_8R_UNIFIED_NEEDS.md v0.6 for full context.`

After changes:
- Read file back to verify edits applied.

### Task 4 — Wireframe file relocation

1. Confirm the directory `docs/wireframes/phase_8r/` exists.
2. Move `phase_8r_lots_wireframes_v2.html` from wherever Tom has staged it (likely `docs/wireframes/phase_8r/` already, OR a temporary location at repo root) into `docs/wireframes/phase_8r/`. If already there, no-op.
3. Update the "Final wireframes live at" section (around line 273 in PHASE_8R_UNIFIED_NEEDS.md) to add a new bullet for the v2 lots file: `- `phase_8r_lots_wireframes_v2.html` — CP6e-Lots wireframes, 10 surfaces, ~1950 lines. Adds variant supply rendering (lots-aware badge, collapsible variant sub-headers, search-within-lots), supply detail with lots editor, supply create with lots toggle, multi-dimension search demo, cook depletion against lots, grocery acquire → lot create. Visual language matches actual app screenshots from 2026-05-06; supersedes 8R wireframe v3 aesthetic for CP6e-touched surfaces.`

### Task 5 — Stage PK-resident copies in `_pk_sync/`

PK contains living-doc copies that need refresh. After the repo edits land, stage updated copies:

1. Copy `docs/PHASE_8R_UNIFIED_NEEDS.md` → `_pk_sync/PHASE_8R_UNIFIED_NEEDS_2026-05-06.md`
2. Copy `docs/FF_LAUNCH_MASTER_PLAN.md` → `_pk_sync/FF_LAUNCH_MASTER_PLAN_2026-05-06.md`
3. Copy `docs/DEFERRED_WORK.md` → `_pk_sync/DEFERRED_WORK_2026-05-06.md`

The dates in filenames match each file's updated `Last Updated` header (which you set as part of Task 1-3).

### Task 6 — Archive the consumed prompt

After successful merge:
1. Move `docs/CC_PROMPTS/active/CP6e_DOC_ADDITION_DRAFT_2026-05-06.md` → `docs/archive/prompts/CP6e_DOC_ADDITION_DRAFT_2026-05-06.md`. Standard "consumed CC prompt" archival pattern per DOC_MAINTENANCE_PROCESS.

Per same process, this CC prompt itself (when complete) → `docs/archive/prompts/CP6e_DOC_MERGE_PROMPT_2026-05-06.md`.

---

## Constraints

- **Do NOT author strategic content.** All new prose, decisions, table rows, and section bodies are pre-written in the draft. Your job is to merge and structure, not to summarize, expand, or reword.
- **Preserve existing wording.** Do not refactor unrelated sections of any of the 3 living docs. Touch only what's specified in this prompt.
- **Match existing markdown style.** Look at the section style/voice of the file you're editing and match it. PHASE_8R uses sentence-case headers, table format with consistent column widths, decision IDs in `D8R-QXX` form. DEFERRED_WORK uses `P8R-DXX` form.
- **Date stamping.** Update `Last Updated` headers on all 3 living docs to `2026-05-06`. The version number bumps:
  - PHASE_8R_UNIFIED_NEEDS.md: v0.5 → v0.6 (header + changelog)
  - FF_LAUNCH_MASTER_PLAN.md: increment by .1 (e.g., v6.0 → v6.1; check current version in file header)
  - DEFERRED_WORK.md: increment by .01 in changelog (e.g., 5.17 → 5.18)
- **Read after every multi-step edit.** Use `view` to verify changes landed where intended before moving to the next file.

---

## Verification at end

Before reporting back, run these spot-checks:

1. **PHASE_8R_UNIFIED_NEEDS.md:**
   - Confirm `D8R-Q43`, `D8R-Q60`, `P8R-D22`, `P8R-D26` strings all appear in the file.
   - Confirm `## CP6e detailed scope` section header exists.
   - Confirm changelog top row is dated `2026-05-06` with version `v0.6`.
   - Confirm `P8R-D4` row has strikethrough markers (`~~Quantitative supply tracking~~`) AND a "REOPENED" note in the Why-deferred cell.

2. **FF_LAUNCH_MASTER_PLAN.md:**
   - Confirm risk register has a row mentioning "CP6e is the largest single CP."
   - Confirm changelog top row dated `2026-05-06`.
   - Confirm "late August or early September" appears in the F&F target line.

3. **DEFERRED_WORK.md:**
   - Confirm `P8R-D22` through `P8R-D26` rows present.
   - Confirm `P8R-D4` strikethrough.
   - Confirm changelog top row dated `2026-05-06`.

4. **Wireframe placement:**
   - Confirm `docs/wireframes/phase_8r/phase_8r_lots_wireframes_v2.html` exists.

5. **`_pk_sync/`:**
   - Confirm 3 dated copies present (PHASE_8R, FF_LAUNCH_MASTER_PLAN, DEFERRED_WORK).

6. **Archive:**
   - Confirm `docs/archive/prompts/CP6e_DOC_ADDITION_DRAFT_2026-05-06.md` exists.
   - Confirm this prompt itself moved to `docs/archive/prompts/`.

---

## SESSION_LOG entry format

Append to `SESSION_LOG.md`:

```
## 2026-05-06 — CP6e doc merge

**Type:** Mechanical doc merge (Claude.ai-driven, CC-executed).

**Files modified:**
- docs/PHASE_8R_UNIFIED_NEEDS.md (v0.5 → v0.6)
- docs/FF_LAUNCH_MASTER_PLAN.md (vX.X → vX.X+1)
- docs/DEFERRED_WORK.md (5.17 → 5.18)

**Changes:**
- 18 new D8R-Q decisions appended (Q43-Q60)
- 5 new P8R-D deferred items appended (D22-D26)
- P8R-D4 reopened (strikethrough + REOPENED note)
- New CP6e detailed scope section with 4 sub-checkpoints
- New CP6e build plan row
- F&F target slipped late July/August → late August/early September
- 1 new risk register row (CP6e size)
- Wireframe v2 file referenced in PHASE_8R wireframe development section

**Files moved:**
- phase_8r_lots_wireframes_v2.html → docs/wireframes/phase_8r/
- CP6e_DOC_ADDITION_DRAFT_2026-05-06.md → docs/archive/prompts/

**_pk_sync/ staged:** 3 files dated 2026-05-06.

**Verification:** Spot-checks 1-6 from prompt all passed. [list any that didn't and why]

**Next:** Tom commits + uploads to PK. CP6e-Services CC prompt is the next CC engagement.
```

---

## If anything blocks

- **Draft file not at expected path.** STOP and report. Don't guess at content.
- **Wireframe file not at any obvious location.** STOP and ask. Tom will paste the path.
- **Existing section structure unclear.** STOP and report. Don't guess at insertion points; ask Claude.ai for clarification before editing.
- **Tom's PHASE_8R version turns out to not be v0.5 but something else.** Adjust the version bump accordingly (current → current+0.1) and note in SESSION_LOG.
- **Any markdown breakage discovered post-edit.** Fix and re-verify before reporting back.

Don't author strategic content under any circumstance — if you find yourself writing prose that wasn't in the draft, stop. Tom approved specific wording; don't drift.
