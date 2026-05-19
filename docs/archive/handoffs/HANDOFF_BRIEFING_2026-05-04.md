# HANDOFF BRIEFING — Phase 8R Audit + CP6d Execution

**Author:** Claude.ai (audit instance)
**Date:** 2026-05-04
**For:** Next Claude.ai instance picking up Frigo CP6d execution
**Required reading:** `8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` (the canonical reference for everything below)

---

## TL;DR

Tom and I (previous instance) just completed a 5-round multi-session UX audit of Phase 8R post-CP6c. Output: v0.2 audit doc with ~52 gaps catalogued, all decisions locked, CP grouping defined. The first execution prompt (CP6d-Schema) is drafted. Your job is to oversee CP6d execution: refine the Schema prompt with Tom if needed, draft CP6d-Pantry / ViewDetail / Sheets / Recipe / SupplyDetail prompts in sequence, reconcile SESSION_LOG entries back into living docs after each CC run.

F&F target unchanged: late June 2026. CP6d series is ~3-4 weeks of work.

---

## Where we are

**Just shipped (8R-CP1 through CP6c, between 2026-04-29 and 2026-04-30):**
- Schema overhaul: needs / supplies / views / tags / supply_tags / need_tags / needs_recipes
- Service layer: needsService, suppliesService, viewsService, tagsService
- Lists home (ViewsScreen), View detail (ViewDetailScreen), Pantry shell (PantryScreen), Supply create (SupplyCreateSheet), need add (AddNeedSheet), need edit (EditNeedSheet), expanded regulars (ExpandedRegularsSheet), spawn-on-out toast, cook-flow depletion banner
- ManageSuppliesScreen as a transitional surface (will be deleted in CP6d-SupplyDetail)

**Just decided (this audit):**
- CP6d series: 6 sub-checkpoints, dependency-ordered
- Schema additions: tracking_mode, storage_location, archived_at, is_priority, usage_level
- Perishable taxonomy via tracking_mode (inferred from shelf_life + storage)
- Pantry section restructure: Attention / Regulars / On Hand
- 5-circle status icon system with custom cycle order
- Inline type-and-add on grocery views (Gap-G5)
- Tap-zones split (dot=cycle, name=edit) + inline +/- quantity
- Cart-as-section all views (Option A)
- Recipe-add modal rebuild with forced list-picker
- New SupplyDetailScreen (Tab 8) — replaces handful of stubs
- 8D recipe-pantry matching upgrade pulled forward to F&F-prereq
- Catalog audit (plural_name + missing items) as parallel workstream

**Just confirmed shipped (post-verification):**
- G1 (filter-rule subtitle on view cards) — `formatFilterSubtitle` in ViewsScreen.tsx
- G19 (status default = need-only in ViewCreatorModal) — `useState(['need'])`

**Just confirmed broken / missing (post-verification):**
- G24/G35 — UnitPicker swap in AddNeedSheet/EditNeedSheet (they use plain TextInput)
- G27 — ExpandedRegularsSheet has no search bar
- G38 — AddRecipeToNeedsModal has one button only, no urgency picker, no list picker
- O8 — Merged-row expand-children not rendered in ViewDetail
- G41 (NEW BUG) — createNeed dedup is too aggressive, blocks legitimate olive-oil "small now + bulk later" scenario

---

## Tom's working style — quick read

- **Background:** Co-founder of Visana Health (digital health app), biomedical engineering. App architect. Reads code; doesn't write it.
- **Communication:** Direct, pragmatic, evidence-based. Pushes back if something doesn't make sense. Appreciates when you acknowledge uncertainty. Will tell you when he disagrees.
- **Decision pattern:** Often answers questions in batches (numbered Q-NEW-N format). Prefers numbered traceability. Rarely uses "yes" without context — usually elaborates with edge cases or new questions.
- **Tone preference:** Direct over elaborate. Concise > comprehensive. Chunk responses if they get too long.
- **Hard rules:**
  - Never use the `ask_user_input_v0` widget tool. Ask in normal text, label numerically.
  - Don't touch living docs without explicit authorization (Standing Rule A).
  - Push back if you disagree with direction.
  - For complex multi-day tasks, suggest spinning up a focused subproject.

He's not precious about his ideas — he proposes things and expects pushback. Don't reflexively agree. If his framing is wrong (e.g., "perishables" naming wasn't quite right), name it and propose alternatives.

---

## CP6d execution sequence (locked)

Per audit doc, CP6d series:

| # | CP | Depends on | Cost | Status |
|---|---|---|---|---|
| 1 | CP6d-Schema | — | L | **Prompt drafted, awaiting Tom signoff to kick** |
| 2 | CP6d-Pantry | Schema | L | Prompt to be drafted (next) |
| 3 | CP6d-ViewDetail | Schema | M-L | Prompt to be drafted (parallel to Pantry) |
| 4 | CP6d-Sheets | — | S-M | Prompt to be drafted (independent) |
| 5 | CP6d-Recipe | — | M | Prompt to be drafted (independent) |
| 6 | CP6d-SupplyDetail | Schema | L | Prompt to be drafted (last in chain) |

**Parallel workstreams:**
- Catalog audit (Gap-X6) — separate CC prompt, ~30-min pass on `ingredients` table
- 8D matching upgrade (Gap-O3) — separate CC prompt, base-ingredient normalization + staple exclusion

**Smoke test:** Tom wants ONE smoke pass at the end of CP6d series. No mid-stack smoking.

---

## Workflow pattern (Tom-confirmed)

For each CP:

1. **Tom-side:** Tom runs any required SQL via Supabase dashboard (using SQL files we provide). Validates with included queries.
2. **Claude.ai-side:** You draft the CC prompt for the CP (using the v0.2 audit doc + the CP6d-Schema prompt as a template).
3. **Tom-side:** Tom reviews the prompt. May refine or send straight to CC.
4. **CC-side:** CC executes the prompt, updates SESSION_LOG.md, drops files in `_pk_sync/` for Tom's manual PK upload.
5. **Tom-side:** Tom uploads `_pk_sync/` files to PK (so subsequent claude.ai sessions see the updated state).
6. **Claude.ai-side:** You read SESSION_LOG, reconcile any open questions / deviations into the audit doc or DEFERRED_WORK, then draft the next CP prompt.
7. **Repeat.**

**Doc maintenance** (Standing Rule A):
- Don't edit living docs without Tom's authorization.
- For repo doc edits that should propagate to PK: have CC drop the file in `_pk_sync/` for Tom's manual upload.
- Living docs to keep updated through CP6d: PHASE_8R_UNIFIED_NEEDS_2026-04-30.md, FF_LAUNCH_MASTER_PLAN_2026-04-29.md, DEFERRED_WORK_2026-04-30.md.

---

## Files in this handoff package

These are sitting in Tom's outputs directory:

1. **`8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md`** — canonical audit doc. Read first. Has all decisions, the gap matrix organized by CP, deferred-work list, 🪦 register, and the locked open questions.
2. **`cp6d_schema_migration.sql`** — Tom runs this directly in Supabase SQL editor. 6 numbered sections + 8 validation queries. Idempotent (safe to re-run).
3. **`CP6d-Schema_CC_prompt.md`** — the first CC execution prompt. Service-layer changes only (post-SQL). ~6 tasks. Has full context, inputs, constraints, verification, SESSION_LOG format. Use this as the template for subsequent CP prompts.

---

## Open questions remaining (low-stakes, decidable during build)

Per audit doc:

- **OPEN-1:** Inline +/- increment 1 (resolved: Tom said 1).
- **OPEN-2:** On Hand sub-grouping by category (lean: yes; can be flipped post-build).
- **OPEN-3:** Long-press on supply rows post-Tab 8 — **resolved post-audit:** REMOVE long-press on supply rows when tap-row-expand-inline ships in CP6d-Pantry. Long-press is redundant once tap-row covers the use case. Update audit accordingly when authorized.

Plus one nuance Tom raised in final exchange:

- **Plural display nuance:** the existing logic (`plural_name && qty > 1 ? plural_name : name`) gives correct grammar at all qty levels ("1 banana", "3 bananas"). Tom noted ideal long-term is `default_unit` per ingredient (e.g., "bunch") so "1 banana" reads "1 bunch (bananas)." Filed as **P8R-D21 (post-F&F)** — "Default unit per ingredient + qty/unit/name display reformat." NOT blocking F&F. Note in DEFERRED_WORK when you next update it.

---

## What to do first

1. Confirm Tom has read the audit doc + handoff briefing. He may push back on CP grouping, decisions, or scope.
2. Wait for Tom to run `cp6d_schema_migration.sql` and confirm validation queries pass.
3. Once SQL is confirmed: send him the `CP6d-Schema_CC_prompt.md`. Refine if he requests changes.
4. CC executes CP6d-Schema. Read SESSION_LOG when done.
5. Reconcile: any deviations → audit doc + DEFERRED_WORK. Any new gaps → audit doc.
6. Draft `CP6d-Pantry_CC_prompt.md` using the Schema prompt as template + the audit doc's CP6d-Pantry section as the spec. Note: Pantry needs new icon files added to repo (Tom has them as `noun-progress-bar-3318XXX-YY` files — verify they're added before CC runs).
7. Continue through the CP series in dependency order (Pantry || ViewDetail can ship parallel).

---

## Reference points in PK / repo

- **`8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md`** — canonical reference, this audit
- **`PHASE_8R_UNIFIED_NEEDS_2026-04-30.md`** — phase doc, needs CP6d sub-divisions added (do this after Tom authorizes)
- **`FF_LAUNCH_MASTER_PLAN_2026-04-29.md`** — F&F launch plan, needs 8D pull-forward noted
- **`DEFERRED_WORK_2026-04-30.md`** — backlog, fold in resolved P8R-D items + new P8R-D21
- **`PROJECT_CONTEXT_2026-04-30.md`** — project overview, current phase status
- **`FRIGO_ARCHITECTURE_2026-04-21.md`** — codebase map
- **`SESSION_LOG.md_04MAY26`** — most recent session log
- **`docs/DOC_MAINTENANCE_PROCESS_2026-04-22.md`** — how to manage living docs / _pk_sync flow
- **`docs/PROCESS_WATCHPOINTS_2026-04-23.md`** — known process pitfalls

For specific UX patterns / decisions referenced in the audit:
- D8R-Q1 through Q42 → in `PHASE_8R_UNIFIED_NEEDS_2026-04-30.md`
- P8R-D1 through D20 → in `DEFERRED_WORK_2026-04-30.md`
- 8R wireframes → `phase_8r_wireframes_v3.html` + `phase_8r_wireframes_README.md`

---

## Common pitfalls to avoid

1. **Don't conflate "audit says X" with "code does X."** The 2026-05-04 PK snapshots may not match working tree. When in doubt, ask Tom for an updated upload.
2. **Don't draft multi-CP prompts in one shot.** Each CP gets its own prompt. CC works better with bounded scope.
3. **Don't update living docs unilaterally.** Standing Rule A. Always ask first.
4. **Don't strip the existing dedup guard.** Soften it (Gap-G41), don't replace it. Architectural regression risk.
5. **Don't break Constraint 9** (createSupply with status=out does NOT spawn). It's been preserved through 8R series and breaking it would surprise users.
6. **Don't trust "tests pass."** CC will say tests pass on builds with no tests written. Verify against the actual DB state and behavior described in the verification sections.
7. **Don't let scope creep.** Stale-items banner is in CP6d-SupplyDetail (or CP6d-Pantry, depending on how you split). The Freezer Cleanout full screen (Gap-O2) is post-F&F. Don't let CC build it.

---

## Final notes from previous instance

- Tom is a thoughtful, patient collaborator. Don't rush him. He'll engage deeply when given the chance.
- The audit took 5 rounds of back-and-forth. Most of those rounds were him surfacing edge cases I missed. Treat his pushback as signal, not noise.
- The schema work (CP6d-Schema) is the highest-leverage thing in the series. Get it right and the rest follows.
- The `_pk_sync/` folder pattern is genuinely useful for keeping the doc loop closed without heroics. Don't bypass it.
- If you find yourself going more than 2 rounds on the same question with Tom, stop and ask whether the framing is wrong. Often the question itself needs reshaping.

Good luck. The audit doc is solid. Execute carefully.

— Previous Claude.ai instance, 2026-05-04
