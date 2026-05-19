# Phase 8R wireframes

Canonical UX reference for Phase 8R execution. Generated 2026-04-29 in three iteration rounds with Tom + audit pass + audit follow-up. **12 surfaces** in a single consolidated HTML file; **19 design decisions** captured (D8R-Q19 through Q37, see `docs/PHASE_8R_UNIFIED_NEEDS.md` v0.4).

These wireframes are the source of truth for visual / interaction design during 8R-CP3 through CP6 execution. CC prompts paste tab-and-variant references for visual specificity. Schema design (CP1) references the decisions log in PHASE_8R; wireframes inform but don't drive CP1.

**Open in any browser.** Tabs along the top switch between surfaces. Sub-toggles within tabs let you compare variants per surface. Notes pane on the right of each phone mockup explains design rationale + open questions. Audit fixes are inlined as blue callouts in each affected tab's notes.

---

## File guide

### `phase_8r_wireframes_v3.html` — single canonical file

12 surfaces covering grocery side, pantry side, and cross-cutting flows:

| Tab | Surface | Variants | Notes |
|-----|---------|----------|-------|
| 1 | **Lists home** | Single | 4 default views ship: Tonight · This week · All needs · In cart. |
| 2 | **View detail — All needs** | A · Tier · B · Aisle · C · Flat | Per-view persisted render mode. Collapsed Regulars strip default. |
| 3 | **View detail — Costco (custom)** | A · Implicit filter · B · Visible filter chips | Settles P8R-D6: implicit recommended. |
| 4 | **List creator + edit** | A · New · B · Edit custom · C · Edit default | Checkbox-grouped form, multi-select within dim, hide-unused, status default Need-only. Aisle dropped from More dimensions per Q29. |
| 5 | **Add-to-needs basic** | Single (deprecated) | **SUPERSEDED by Tab 11.** Kept as evolution reference. |
| 6 | **Recipe-add flow** | A · CTAs · B · Popup modal · C · Merged view | Inline buttons + popup with urgency picker only. Recipe combine rule explicit per Q28/Q36. |
| 7 | **Supplies grid (dense)** | A · List · B · 3-col grid | Search bar at top. Out + Low pulled to combined attention section with sub-section labels. "+ N more" expand-in-place pattern. |
| 8 | **Supply detail** | A · Two CTAs · B · One CTA · C · For-user sheet | State cycle 4-segment strip (tap-to-set per Q30). Stores + Brands first-class sections; for-user sub-sheet. |
| 9 | **Spawn toast + edit modal** | A · Toast · B · Edit modal (parent supply) · C · Edit modal (no parent) | Update-default toggle conditionally hidden when no parent supply per Q34. |
| 10 | **Expanded Regulars** | Single | Multi-select dense list. Search bar. "+ N more in [Category]" expand. "+ Add new supply" routes to Tab 12 per Q33. |
| 11 | **Add-to-needs configure-once** | A · Existing supply (fast) · B · New item (configure) | Configure-once-and-done pattern per Q21. For-user sub-sheet from Tab 8 Variant C. |
| 12 | **Supply create (NEW v3)** | Single | "Track without needing now." Initial state restricted to In stock / Low / Out per Q35. Triggered from Pantry "+" or "+ Add new supply" on Tab 10. |

---

## How to use during execution

1. **Before starting a checkpoint:** open the relevant tab. Variants and notes pane explain the design intent.
2. **When a CC prompt needs precision:** reference by tab + variant. E.g., "Build the Supplies grid per Tab 7 Variant A — list view, single line per supply, search bar at top, Out + Low combined attention section with sub-section labels, categories collapse-by-default for in-stock with `+ N more` expand pattern."
3. **When a UX decision is unclear:** check the notes pane on the relevant tab (audit fixes are inlined as blue callouts). If not, fall back to the decisions log in `PHASE_8R_UNIFIED_NEEDS.md` (D8R-Q1-Q37).

---

## Sub-phase mapping

Which wireframe tabs map to which CC checkpoints per `PHASE_8R_UNIFIED_NEEDS.md` v0.4:

| Wireframe surface | Checkpoint | Notes |
|-------------------|------------|-------|
| Schema decisions (multi-user `for_user_ids`, status enums, tag dimensions, view-filter expression, merge-query composite index) | **8R-CP1** | All Q1-Q37 decisions land in schema design. Wireframes inform field shape; Q36 flags CP1 indexing requirement. |
| Service hooks for supply→need spawn, "Save as regular," `setSupplyState` cycle, `for_user_ids` write-path (Q37) | **8R-CP2** | Service-layer foundations. |
| Tab 6 (recipe-add flow) | **8R-CP3** | Inline buttons on RecipeDetailScreen + popup modal + urgency picker. |
| Auto-spawn-on-out wired to cook-flow depletion + Tab 9 (spawn toast + edit modal) | **8R-CP3** | Toast surfaces depletion event; Edit modal handles per-need + supply-default updates with conditional toggle visibility (Q34). |
| Tab 1 (Lists home — 4 defaults), Tab 2 (View detail render modes), Tab 3 (Custom view filtered), Tab 4 (List creator + edit), Tab 11 (Add-to-needs configure-once), Tab 10 (Expanded Regulars) | **8R-CP4** | Grocery-side UX rebuild. ViewsScreen + ViewDetailScreen + creator + add-to-needs configure-once + Regulars zone. |
| Tab 7 (Supplies grid + search bar), Tab 8 (Supply detail), **Tab 12 (Supply create)** | **8R-CP5** | Pantry-side UX rebuild. List view default; supply detail with state cycle tap-to-set; supply-create with state restriction per Q35. |
| Cross-user smoke + tag-rule visibility refinement | **8R-CP6** | Polish + Mary smoke test across new model. |

---

## Decisions captured

The wireframe iteration + audit cycle produced 19 new design decisions logged in `PHASE_8R_UNIFIED_NEEDS.md` v0.4:

**From wireframe iteration (Q19-Q27):**

| ID | One-line summary |
|----|------------------|
| D8R-Q19 | 4 defaults: Tonight · This week · All needs · In cart |
| D8R-Q20 | Regulars zone — collapsed default + expanded multi-select |
| D8R-Q21 | Configure-once-and-done — supply IS the configuration |
| D8R-Q22 | Supply detail — Stores + Brands first-class; for-user sub-sheet |
| D8R-Q23 | Edit-routing on spawn toast with "Update default routing" toggle |
| D8R-Q24 | Recipe-add — inline buttons + popup; urgency picker only |
| D8R-Q25 | View detail render modes — Tier / Aisle / Flat |
| D8R-Q26 | Supplies grid — List default for scale; 3-col grid alt |
| D8R-Q27 | Multi-user `for_user_ids UUID[]` (reopens Q17) |

**From audit pass (Q28-Q34):**

| ID | One-line summary |
|----|------------------|
| D8R-Q28 | Recipe combine merge predicate — identity + unit + store tags + for_user_ids |
| D8R-Q29 | Aisle as render-only, NOT user tag dimension |
| D8R-Q30 | State-cycle UI pattern split — list = tap-to-cycle; detail = tap-to-set |
| D8R-Q31 | "Everyone" rendering — empty array OR all-members both render as Everyone (SUPERSEDED by Q37) |
| D8R-Q32 | Status filter default Need-only; multi-status permitted but advanced |
| D8R-Q33 | "+ Add new supply" routes to Tab 12 supply-create flow |
| D8R-Q34 | Edit modal toggle conditionally hidden when no parent supply |

**From audit follow-up (Q35-Q37):**

| ID | One-line summary |
|----|------------------|
| D8R-Q35 | Supply-create initial state restricted to in_stock/low/out (no Critical) |
| D8R-Q36 | Recipe combine confirmed + CP1 schema flag for composite index |
| D8R-Q37 | `for_user_ids` write-path — "Everyone" always writes empty array (forward-compatible); explicit subset writes verbatim. SUPERSEDES Q31. |

P8R-D6 (view-rule visibility) RESOLVED by Q19/Q22. P8R-D7 (search affordance) RESOLVED as F&F-prereq per Tom. P8R-D8 through D11 deferred post-F&F (subgroup-within-category · auto-urgency from meal calendar · pre-select-out-default · cold-start polish).

---

## What these are NOT

- Not a visual design system — colors, typography, and exact spacing are approximate. Production app uses the existing Frigo design tokens.
- Not a substitute for `PHASE_8R_UNIFIED_NEEDS.md` — that doc has the canonical scope, architecture, decisions, sub-phase structure.
- Not interactive beyond tab/variant navigation — production app will have real data and routing.

---

## Session context

Generated in three iteration rounds with Tom + audit pass + audit follow-up 2026-04-29:

1. **Round 1 (chunk 1 v1)** — initial sketch of grocery-side surfaces. Tom flagged Tab 4 view creator as "off"; auditor proposed checkbox-grouped form. 4-default-view set settled.
2. **Round 2 (chunk 1 v2 + chunk 2 v1)** — applied auditor changes. Added Regulars zone (Tom's iPhone Notes pattern). Built out chunk 2: pantry-side surfaces. "Everyone" instead of "Anyone" linguistic update.
3. **Round 3 (chunk 2 v2 + consolidation)** — Tom feedback: simpler recipe-add, denser supplies grid, supply detail with stores/brands/multi-user for-user, edit-routing on spawn toast. **D8R-Q17 reopened** — multi-user `for_user_ids UUID[]` per Q27.
4. **Audit pass (v3 wireframes)** — async audit instance flagged 8 substantive issues + 1 gap; 7 new decisions captured (Q28-Q34). All addressed in v3. Cold-start states deferred post-F&F. Tab 12 supply-create added.
5. **Audit follow-up** — 3 follow-up questions resolved. Q35 supply-create state restriction (consistent with v3); Q36 confirms Q28 + adds CP1 indexing flag; Q37 supersedes Q31 with write-path semantics. Wireframes unchanged visually.

Tom approved v3 as final. Wireframes locked. PHASE_8R bumped 0.1 → 0.2 → 0.3 → 0.4 across the cycle. Doc-hygiene applied to PHASE_8 (v2.15), DEFERRED_WORK (v5.17), FF_LAUNCH_MASTER_PLAN (v6.2), PROJECT_CONTEXT (v10.2).

Next: 8R-CP1 schema migration design.
