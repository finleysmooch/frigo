# CC PROMPT — Phase 8R Doc Hygiene + Wireframes Staging

**Date:** 2026-04-29  
**Phase:** 8R doc hygiene (mechanical edits + file staging — no code changes)  
**Estimated time:** 30-40 min  
**Output:** 5 living docs updated · `docs/wireframes/phase_8r/` directory created · `_pk_sync/` files staged · SESSION_LOG entry written

---

## Context

Phase 8R is the unified-needs refactor decided 2026-04-29. The PHASE_8R doc was authored at v0.1 by Claude.ai earlier today; wireframe iteration ran in 3 rounds + audit pass + audit follow-up; **9 decisions from wireframe iteration (Q19-Q27) + 7 decisions from audit pass (Q28-Q34) + 3 decisions from audit follow-up (Q35-Q37) = 19 new design decisions**; PHASE_8R bumped to v0.4; wireframes locked at v3 single consolidated file.

This prompt applies **mechanical edits only** to four other living docs to align them with the 8R reframe + wireframe completion. PHASE_8R v0.4 + wireframes README + single v3 wireframe HTML are dropped by Tom before this prompt runs (see Prerequisites).

**You write only `_SESSION_LOG.md` for the entry.** All other writes are mechanical text replacements or file copies.

---

## Prerequisites — Tom drops these before running

Tom places the following files at the indicated paths in the working tree before invoking you:

1. `docs/PHASE_8R_UNIFIED_NEEDS.md` — content from `PHASE_8R_UNIFIED_NEEDS_v0.4.md` (Tom downloads from `/mnt/user-data/outputs/`); REPLACES any existing file at this path.
2. `docs/wireframes/phase_8r/phase_8r_wireframes_README.md` — content from `phase_8r_wireframes_README.md` (Tom downloads from `/mnt/user-data/outputs/`); NEW file in NEW directory.
3. `docs/wireframes/phase_8r/phase_8r_wireframes_v3.html` — Tom downloads from `/mnt/user-data/outputs/`; NEW file. (Single consolidated wireframe file with all 12 tabs — replaces the chunk1+chunk2 two-file structure from earlier iterations.)

**First task: verify these are present.** Halt and flag if not.

---

## Tasks

### Task 1 — Verify Tom's drops

Run from repo root:
```bash
test -f docs/PHASE_8R_UNIFIED_NEEDS.md && head -3 docs/PHASE_8R_UNIFIED_NEEDS.md  # should show "Version: 0.4"
test -f docs/wireframes/phase_8r/phase_8r_wireframes_README.md
test -f docs/wireframes/phase_8r/phase_8r_wireframes_v3.html
```

If any are missing or PHASE_8R isn't v0.4, halt and report. Tom must complete the drops before continuing.

### Task 2 — Apply mechanical edits to 4 living docs

#### Task 2a — `docs/PHASE_8_PANTRY_INTELLIGENCE.md` v2.14 → v2.15

**Edit 2a.1 — Bump version header**

Find: `**Version:** 2.14`  
Replace with: `**Version:** 2.15`

**Edit 2a.2 — Replace 8C-Shared sub-phase block with SUPERSEDED note**

Find the sub-phase section starting with `### 8C-Shared — Shared grocery list infrastructure` and ending where the next `### 8` heading begins. Replace ONLY the immediate sub-section header + its scope/status text (keep the CP1/CP2/CP2b/CP2b.1 ✅ details below the header) with this paragraph below the header:

```
### 8C-Shared — Shared grocery list infrastructure

**Status:** 🟡 SUPERSEDED by Phase 8R (2026-04-29). CP1 + CP2 shipped 2026-04-28 + smoke-tested end-to-end with Tom + Mary. CP2b shipped 2026-04-28 (closes P8-24 add-to-list F&F-blocker). CP2b.1 shipped 2026-04-28 (autocomplete polish). All work in this sub-phase becomes architectural background for Phase 8R; the underlying schema (lists-as-containers + grocery_lists.space_id + RLS) will be nuked and replaced with the unified-needs filter-views model. CP3 (routing R2 + recipe attribution RA2) and CP4 (UX visibility) NOT shipped under 8C-Shared; their semantics absorbed into 8R-CP3 + 8R-CP4. See PHASE_8R_UNIFIED_NEEDS.md.
```

CP1, CP2, CP2b, CP2b.1 ✅ shipped notes already in place stay as-is.

**Edit 2a.3 — Mark unshipped 8C numbered CPs as SUPERSEDED**

For each of `8C-CP4b`, `8C-CP4c`, `8C-CP5`, `8C-CP6`, `8C-CP7`, `8C-CP8` in their checkpoint definitions, append to their status line: `🟡 SUPERSEDED by Phase 8R (2026-04-29).`

**Edit 2a.4 — Update build plan table — 8C-Shared row**

Find the row beginning `| 8C-Shared | CP1-CP4 | 4 (~7hr) | 🟡 In progress`...  
Replace with:
```
| 8C-Shared | CP1-CP2b.1 | 4 shipped (CP1 + CP2 + CP2b + CP2b.1) | 🟡 SUPERSEDED by 8R (2026-04-29). CP3, CP4 not shipped — semantics absorbed into 8R-CP3, 8R-CP4. See PHASE_8R_UNIFIED_NEEDS.md. |
```

**Edit 2a.5 — Update build plan table — 8C row**

Find the row beginning `| 8C |` with status `🟡 In progress — CP1+CP1a+CP1b+CP2+CP2a+CP3+CP4 shipped 2026-04-27`...  
Replace status text with:
```
🟡 PARTIALLY SUPERSEDED — CP1-CP4 + CP4a shipped 2026-04-27 ship valuable; CP4b/CP4c/CP5-CP8 unshipped CPs absorbed into 8R or thrown away depending on scope. See PHASE_8R doc.
```

**Edit 2a.6 — Add 8R row to build plan table**

Insert a new row between the 8C-Shared row (now updated) and the 8D row:
```
| 8R | CP1-CP6 | 4-6 weeks | 🔲 Planning — Unified household needs refactor. Replaces lists-as-containers model with filter-views over a unified bag of supplies + needs. Pantry + grocery merge into one schema layer. F&F target slips to late July or August. Wireframes ✅ shipped 2026-04-29 (v3 single consolidated file at `docs/wireframes/phase_8r/`). See PHASE_8R_UNIFIED_NEEDS.md v0.4. |
```

**Edit 2a.7 — Update sub-phase overview table**

Find the table block beginning `| Sub | Scope | Sessions |` and ending after the 8E row. Replace the entire body (rows only, keep the header) with:
```
| 8A | Schema foundation + standalone pantry polish ✅ | 3-4 |
| 8B | Staples & depletion ✅ | 4-5 |
| 8C | Grocery UX overhaul (PARTIAL — see 8R) | 6-8 (PARTIAL) |
| 8C-Shared | Shared grocery list infrastructure (SUPERSEDED) | 4 (PARTIAL) |
| **8R** | **Unified household needs refactor** | **4-6 weeks** |
| 8D | Recipe-pantry matching upgrade — REWRITES against 8R substrate | 3-5 |
| 8E | Recipe discovery polish + natural-language search + low-stock indicators — REWRITES against 8R substrate | 3-4 |
```

**Edit 2a.8 — Prepend v2.15 changelog row**

Find the changelog table. Find the most-recent existing row (will be a v2.14 or earlier entry). Prepend ABOVE that row this new row:

```
| 2026-04-29 | **v2.15 — Phase 8R reframe + wireframe iteration + audit cycle complete; 8C-Shared sub-phase + remaining 8C numbered CPs SUPERSEDED.** After 8C-Shared CP1 + CP2 + CP2b + CP2b.1 shipped 2026-04-28 with full Tom + Mary smoke test, 2026-04-29 design walkthrough surfaced architectural concern with the lists-as-containers model. Tom committed to a foundational refactor: replace lists-as-containers with filter-views over a unified household-needs bag. Pantry "staples" + grocery "list items" merge into one model with status enums (supplies cycle in_stock/low/critical/out; needs cycle need/in_cart/acquired). Tags handle store/urgency/recipe/etc. dimensions; views are saved filter expressions presented as "lists" in UI. Supply transitions to `out` auto-spawn needs. Multi-user (subset) supplies via `for_user_ids UUID[]` with empty-array-means-all-current-and-future-members write semantics (per Q27/Q37 — supersedes Q17 and Q31). Multi-store membership eliminates the cross-list duplicate problem. F&F target slips from early-to-mid June to **late July or August**. Phase doc: `PHASE_8R_UNIFIED_NEEDS.md` v0.4 — 37 architectural decisions (D8R-Q1 through D8R-Q37) + 6-CP build plan. Same-day wireframe iteration completed in 3 rounds + audit pass + audit follow-up: 12 surfaces wireframed in single consolidated file (`docs/wireframes/phase_8r/phase_8r_wireframes_v3.html`); 19 new design decisions captured (Q19-Q37); P8R-D6 + D7 RESOLVED (D6 view-rule visibility; D7 search affordance F&F-prereq); P8R-D8 through D11 added. CP1 schema design is the next CC handoff. Existing 8C-Shared schema + work shipped 2026-04-28 becomes throwaway; existing pantry + grocery data nuked at 8R-CP1 (no migration). 8D + 8E push to after 8R completes. |
```

#### Task 2b — `docs/DEFERRED_WORK.md` v5.16 → v5.17

**Edit 2b.1 — Bump version header**

Find: `**Version:** 5.16`  
Replace with: `**Version:** 5.17`

**Edit 2b.2 — Mark P8-24 ✅ Resolved**

Find the P8-24 row. Update its status / replace the row with a resolution note. Adjust to existing column structure of DEFERRED_WORK; the substance:
```
P8-24 ~~Add to list F&F-blocker~~ — RESOLVED 2026-04-28 by 8C-Shared-CP2b. AddRecipeToListModal shipped; closes the F&F-blocker. Note: surface itself will be rebuilt under 8R-CP4 but the data path concern is resolved.
```

**Edit 2b.3 — Mark P8-25 + P8-26 likely superseded**

Find P8-25 and P8-26 rows (create-modal polish from 2026-04-28). Append to each row's notes column: `🟡 LIKELY SUPERSEDED by 8R (2026-04-29) — the create-list modal disappears; concerns may not apply to new ViewsScreen create flow. Don't close yet — implementation at 8R-CP4 confirms whether issues recur.`

**Edit 2b.4 — Add P8R-D1 through P8R-D11 as new deferred items**

Add a new section under the existing Phase 8 deferred items. Use the table format that matches DEFERRED_WORK.md's existing column layout (typically: # / Item / Type / Priority / Notes). Add this content:

```
## From: Phase 8R — Unified Needs Planning + Wireframes (April 29, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8R-D1 | **Configurable spawn thresholds.** Per-supply user-settable threshold for auto-spawn (currently fires only on `out`). γ option from D8R-Q10. | 🔧 | 🟡 | Post-F&F based on tester usage. |
| P8R-D2 | **Cross-dimension OR-filter views.** AND-only across dimensions for F&F (multi-value within dim supported per Q16). | 🔧 | 🟡 | Post-F&F. |
| P8R-D3 | **Add-time combine prompts.** F&F renders display-merged at view-time only (Q12/Q28/Q36). | 🔧 | 🟡 | Post-F&F. |
| P8R-D4 | **Quantitative supply tracking.** Battery-scale or numeric quantity-on-hand for supplies. | 🔧 | 🟢 | Post-F&F. |
| P8R-D5 | **Hierarchy storage strategy.** Time-window tags currently use derived hierarchy at query time. | 🔧 | 🟢 | Watch in F&F. |
| P8R-D6 | ~~View-rule visibility UX~~ | 🔧 | ⚪ | **RESOLVED 2026-04-29 by D8R-Q19/Q22.** Filter rules visible in 3 places (view-card subtitle on Lists home; Add-need hint; View settings). NOT permanent header chips. |
| P8R-D7 | ~~Search bar on Supplies grid + Expanded Regulars~~ | 🔧 | ⚪ | **RESOLVED 2026-04-29 as F&F-prereq.** Tom confirmed: at 50+ supplies search becomes valuable; ship at CP5. Wireframed in v3 Tab 7 + Tab 10. |
| P8R-D8 | **Subgroup-within-category hierarchy.** E.g., Pantry → Oils / Grains / Spices. F&F ships category-level only. | 🔧 | 🟢 | Post-F&F. |
| P8R-D9 | **Auto-select urgency from meal calendar in recipe-add modal.** If recipe is on tonight's calendar, default Tonight. | 🚀 | 🟢 | Polish; depends on meal calendar maturity. |
| P8R-D10 | **Pre-select-out-items default in expanded Regulars.** F&F ships pre-selected (opinionated). Per-user setting if testers prefer fully-unchecked default. | 🔧 | 🟢 | Post-F&F based on tester preference. |
| P8R-D11 | **Cold-start / empty-state polish.** Day-1 first-launch UX: empty Lists home, empty Pantry, empty view detail, first-time add-to-needs sheet. | 🎨 | 🟡 | Post-F&F per Tom 2026-04-29: be thoughtful with the design but not where we focus pre-F&F. F&F ships reasonable defaults. Dedicated wireframes deferred. |
```

**Edit 2b.5 — Prepend v5.17 changelog row**

Find DEFERRED_WORK's changelog. Add row:
```
| 2026-04-29 | **v5.17 — Phase 8R deferred items added (P8R-D1 through P8R-D11).** Captures decisions deferred during 8R planning (Q1-Q18) + wireframe iteration (Q19-Q27) + audit pass (Q28-Q34) + audit follow-up (Q35-Q37). P8-24 ✅ Resolved by 8C-Shared-CP2b. P8-25/26 marked LIKELY SUPERSEDED pending 8R-CP4 implementation. P8R-D6 RESOLVED by Q19/Q22; P8R-D7 RESOLVED as F&F-prereq per Tom; P8R-D8-D11 deferred. |
```

#### Task 2c — `docs/FF_LAUNCH_MASTER_PLAN.md` v6.1 → v6.2

**Edit 2c.1 — Bump version header**

Find: `**Version:** 6.1`  
Replace with: `**Version:** 6.2`

**Edit 2c.2 — Update Phase Sequence table**

Find the Phase Sequence table. Find the Phase 8 row.  
Replace Phase 8 row with these two rows:
```
| **8** | Pantry Intelligence + Pantry/Grocery UX Overhaul | 18-28 (8A+8B shipped; 8C partial; 8C-Shared SUPERSEDED) | 🟡 In progress (refactored mid-flight) |
| **8R** | **Unified household needs refactor** | **4-6 weeks** | 🔲 Planning — wireframes ✅ 2026-04-29 v3 final (audit pass + follow-up); supersedes 8C + 8C-Shared remaining work |
```

**Edit 2c.3 — Update calendar estimate**

Find the line containing "Total remaining calendar time: ~5-6 weeks base, up to ~9 weeks with Phase-7-style 2× growth" (or similar). Replace with text reflecting 8R insertion:
```
Total remaining calendar time: ~9-12 weeks (8R 4-6 weeks + 8D/8E rewrite ~3-5 weeks against new substrate + Phase 9 Meal & Planning UX). F&F target adjusted from early-to-mid June to **late July or August** to accommodate the 8R refactor.
```

**Edit 2c.4 — Prepend v6.2 changelog row**

Add row to FF_LAUNCH_MASTER_PLAN's changelog:
```
| 2026-04-29 | **v6.2 — Phase 8R inserted; F&F target slips to late July / August; wireframes ✅ shipped same day with audit cycle.** Mid-flight architectural refactor decision: replace lists-as-containers grocery model with unified filter-views over supplies + needs. Pantry + grocery surfaces merge into one schema layer. 8C-Shared sub-phase work (CP1, CP2, CP2b, CP2b.1) shipped 2026-04-28 becomes architectural background but the schema + RLS + service code is throwaway. New 8R phase doc captures 37 architectural decisions (D8R-Q1 through Q37) + 6-CP build plan. Same-day wireframe iteration + audit pass + audit follow-up produced 12 surfaces in single consolidated file at `docs/wireframes/phase_8r/`. F&F target adjusted from early-to-mid June to **late July or August** to accommodate ~4-6 weeks 8R + remaining ~3-5 weeks 8D/8E rewriting against new substrate. Tom committed to the slip with eyes open after sleeping on the decision. |
```

#### Task 2d — `docs/PROJECT_CONTEXT.md` v10.1 → v10.2

**Edit 2d.1 — Bump version header**

Find: `**Version:** 10.1`  
Replace with: `**Version:** 10.2`

**Edit 2d.2 — Update "What's Next" section**

Find the "What's Next" section's Phase 8 entry. Replace with:
```
**Phase 8R — Unified household needs refactor** (active, 4-6 weeks)
- Architectural reframe decided 2026-04-29: replace lists-as-containers grocery model with filter-views over a unified bag of supplies + needs. Pantry + grocery merge into one schema layer.
- Wireframes ✅ shipped 2026-04-29 (`docs/wireframes/phase_8r/` — 12 surfaces, 37 decisions Q1-Q37 across walkthrough + 3 wireframe rounds + audit pass + audit follow-up).
- 6-CP build plan: CP1 schema → CP2 services → CP3 recipe + cook flow → CP4 grocery UX → CP5 pantry UX → CP6 polish + smoke.
- F&F target shifted from early-to-mid June to late July or August.
- See `PHASE_8R_UNIFIED_NEEDS.md` v0.4 for full architectural concept + decisions log.
```

**Edit 2d.3 — Prepend v10.2 changelog row**

Add row:
```
| 2026-04-29 | 10.2 | **Phase 8R reframe + wireframes complete with audit cycle.** Active phase shifts from Phase 8 to Phase 8R after 2026-04-29 architectural walkthrough. 8C-Shared work shipped 2026-04-28 becomes background; existing pantry + grocery data nuked at 8R-CP1. F&F target slips late July / August. Same-day wireframe iteration + audit pass + audit follow-up: 12 surfaces, 37 decisions (Q1-Q37), wireframes consolidated to single file at `docs/wireframes/phase_8r/`. CP1 schema design is the next handoff. |
```

### Task 3 — Stage `_pk_sync/` copies

After all edits in Task 2 land, copy the canonical files to `_pk_sync/` with date-stamped names. Use the existing convention `path__encoded__name_2026-04-29.ext`.

```bash
mkdir -p _pk_sync
cp docs/PHASE_8_PANTRY_INTELLIGENCE.md _pk_sync/PHASE_8_PANTRY_INTELLIGENCE_2026-04-29.md
cp docs/DEFERRED_WORK.md _pk_sync/DEFERRED_WORK_2026-04-29.md
cp docs/FF_LAUNCH_MASTER_PLAN.md _pk_sync/FF_LAUNCH_MASTER_PLAN_2026-04-29.md
cp docs/PROJECT_CONTEXT.md _pk_sync/PROJECT_CONTEXT_2026-04-29.md
cp docs/PHASE_8R_UNIFIED_NEEDS.md _pk_sync/PHASE_8R_UNIFIED_NEEDS_2026-04-29.md
cp docs/wireframes/phase_8r/phase_8r_wireframes_README.md _pk_sync/wireframes__phase_8r__README_2026-04-29.md
cp docs/wireframes/phase_8r/phase_8r_wireframes_v3.html _pk_sync/wireframes__phase_8r__v3_2026-04-29.html
```

That's **7 files staged** (down from 8 in v1 of this prompt — single consolidated wireframe file replaces the prior chunk1+chunk2 two-file structure).

### Task 4 — Write SESSION_LOG entry

Write to `docs/_SESSION_LOG.md` (or whatever the canonical SESSION_LOG path is). Use this template:

```markdown
## 2026-04-29 — [Phase 8R doc hygiene + wireframes staging]

**Phase:** 8R doc hygiene (mechanical edits + file staging — no code changes)  
**Prompt from:** `CC_PROMPT_8R_DOC_HYGIENE.md`  
**Status:** Shipped (5 docs updated · `docs/wireframes/phase_8r/` created · 7 files staged in `_pk_sync/`)

**Scope:** Aligned 4 living docs with the 2026-04-29 8R reframe + wireframe iteration + audit pass + audit follow-up. Replaced `PHASE_8R_UNIFIED_NEEDS.md` with v0.4 (authored by Claude.ai). Created `docs/wireframes/phase_8r/` with README + single consolidated v3 HTML wireframe file (Tom dropped before this prompt ran).

**Files modified (canonical living docs):**
- `docs/PHASE_8_PANTRY_INTELLIGENCE.md` v2.14 → v2.15: 8C-Shared sub-phase marked SUPERSEDED; unshipped 8C numbered CPs marked SUPERSEDED; build plan table updated with 8R row; sub-phase overview table updated; v2.15 changelog row prepended (37 decisions, 12 surfaces, single file).
- `docs/DEFERRED_WORK.md` v5.16 → v5.17: P8-24 ✅ Resolved; P8-25/26 LIKELY SUPERSEDED; P8R-D1 through P8R-D11 added (D6 + D7 RESOLVED inline); v5.17 changelog row added.
- `docs/FF_LAUNCH_MASTER_PLAN.md` v6.1 → v6.2: Phase 8 row updated; 8R row added; calendar estimate adjusted; v6.2 changelog row added (37 decisions, single file).
- `docs/PROJECT_CONTEXT.md` v10.1 → v10.2: "What's Next" Phase 8 entry replaced with Phase 8R reframe (37 decisions, 12 surfaces); v10.2 changelog row added.

**Files created / replaced:**
- `docs/PHASE_8R_UNIFIED_NEEDS.md` (Tom dropped v0.4; replaces existing if any).
- `docs/wireframes/phase_8r/phase_8r_wireframes_README.md` (new — Tom dropped).
- `docs/wireframes/phase_8r/phase_8r_wireframes_v3.html` (new — Tom dropped; single consolidated file with 12 tabs).

**Files staged (`_pk_sync/`):** 7 files — see Task 3 list.

**Verification:**
- Version bumps verified: PHASE_8 head shows 2.15; DEFERRED_WORK shows 5.17; FF_LAUNCH shows 6.2; PROJECT_CONTEXT shows 10.2; PHASE_8R shows 0.4.
- All 7 files present in `_pk_sync/` with date-stamped names.
- `docs/wireframes/phase_8r/` directory contains 2 expected files (README + 1 HTML).

**Recommended doc updates:**
- DEFERRED_WORK.md: None.
- PROJECT_CONTEXT.md: None.
- FF_LAUNCH_MASTER_PLAN.md: None.
- FRIGO_ARCHITECTURE.md: None.
- PHASE_8R_UNIFIED_NEEDS.md: None.

**Recommended next steps for Tom:**

1. Upload the 7 files from `_pk_sync/` to PK (replacing existing copies of the 4 living docs + adding PHASE_8R + wireframe files).
2. Clear `_pk_sync/*_2026-04-29.*` locally after upload.
3. Open a fresh Claude.ai chat for 8R-CP1 schema migration design (or continue in current chat if context permits).

**Surprises / Notes for Claude.ai:**
- [Add any unexpected file states or anomalies here. None expected.]
```

Adjust the template if anything in execution differed from plan.

---

## Verification (mandatory before exit)

Run from repo root:

```bash
# Version bumps
head -5 docs/PHASE_8_PANTRY_INTELLIGENCE.md | grep "Version:"     # → 2.15
head -5 docs/DEFERRED_WORK.md | grep "Version:"                    # → 5.17
head -5 docs/FF_LAUNCH_MASTER_PLAN.md | grep "Version:"            # → 6.2
head -5 docs/PROJECT_CONTEXT.md | grep "Version:"                  # → 10.2
head -5 docs/PHASE_8R_UNIFIED_NEEDS.md | grep "Version:"           # → 0.4

# Wireframes directory (single HTML + README)
ls docs/wireframes/phase_8r/                                       # → README + 1 HTML (v3)

# _pk_sync staging
ls _pk_sync/*_2026-04-29.* | wc -l                                  # → 7

# 8R row in PHASE_8 build plan
grep -A1 "^| 8R |" docs/PHASE_8_PANTRY_INTELLIGENCE.md             # should show 8R row

# P8R-D series in DEFERRED
grep "^| P8R-D" docs/DEFERRED_WORK.md | wc -l                       # → 11

# SESSION_LOG entry
head -3 docs/_SESSION_LOG.md                                        # most-recent entry should be 2026-04-29 8R doc hygiene
```

If any check fails, halt and document what's off.

---

## Constraints

- **No code edits.** This is doc hygiene only.
- **No strategic content authorship.** All text in this prompt is verbatim — apply as-is. If a target file's structure doesn't match the find-anchor exactly, halt and report; do NOT improvise the edit.
- **Preserve existing column formats** in DEFERRED_WORK.md — its column layout may differ from the 5-column shape shown in this prompt. Adapt by matching the existing columns; preserve the substance.
- **Don't delete history.** Strikethrough resolved items, don't remove rows.
- **Halt on ambiguity.** If a find-anchor matches in unexpected places, or doesn't match at all, surface and ask — don't guess.
