# Phase 8R — Unified Household Needs

**Version:** 0.7
**Last updated:** 2026-05-15
**Status:** 🟢 Mid-closeout — CP1 → CP6e shipped; smoke clean 2026-05-15; doc reconciliation in flight
**Estimated:** 8-10 weeks of focused work — actual is tracking ~6 weeks elapsed (started 2026-04-29, smoke clean 2026-05-15)

---

## Why this phase exists

Phase 8C-Shared shipped CP1 + CP2 + CP2b + CP2b.1 on 2026-04-28 within a "lists-as-containers" model. End-to-end smoke test (Tom + Mary) passed all paths. During CP3 design pass on 2026-04-29, Tom raised the question of how recipe ingredients route to lists and whether the underlying lists-as-containers model is the right architecture going forward.

After deep walkthrough, the conclusion was that **the model should be re-architected to filter-views over a unified "needs" bag**, with pantry staples generalized to "supplies" within the same model. The existing lists-as-containers concept doesn't cleanly express:
- Items belonging to multiple shopping contexts simultaneously (olive oil on Costco AND Groceries)
- The supply-vs-transient-need distinction Tom and Mary already operate on
- Future store-aware reordering
- Status as a first-class data dimension (urgency, storage location)

The core architectural insight that emerged: **pantry and grocery are unified surfaces in the user's mental model**. A supply low → spawns a need. A need acquired → replenishes a supply. They are the same lifecycle viewed from different sides. Today's separate `pantry_staples` + `grocery_lists` schemas treat them as separate domains; the unified model collapses them.

8R commits to this reframe. Tom signed off on 2026-04-29 with explicit acceptance of:
- F&F target slipping from early-to-mid June to **late July or August** (later refined to late August / early September 2026 after CP6e-Lots scope addition)
- 8C-Shared work shipped 2026-04-28 becoming throwaway (schema + RLS + service + UI all nuked)
- All existing pantry + grocery user data nuked (no migration path; fresh start)
- A 6-CP refactor sequence with wireframe dev as a planning prerequisite (✅ completed 2026-04-29 through 3 iteration rounds + audit pass + follow-up resolution)

---

## Architectural concept

*(Architectural concept section preserved from v0.6 — see that version for the full conceptual narrative covering: the model, status as field not tag, time-window views with derived hierarchy, supply-spawn-need, configure-once-and-done, Regulars zone, recipe combine UX, personal/household-subset supplies, multi-store membership, lot tracking, search across supply+lot dimensions, catalog pluralization audit, edit-routing pattern, state-cycle UI pattern split.)*

**Single addition since v0.6:** D8R-Q54 has been **overridden** in implementation. See Decisions log entry. The original rule (LotBadge tap cycles supply status) was reversed during CP6e-SmokeFix-SF2 — tap now expands the row to show lots. The "lot-aware badge as interactive status indicator" design has been deferred; the concept-section text above describing list-view dot tap = tap-to-cycle still applies to non-lots supplies (5-circle dot), but for lots supplies the lot-aware badge is now display-only on tap → expand behavior.

---

## Scope

### In scope (all shipped as of 2026-05-15)

- ✅ New schema: `supplies`, `needs`, `tags`, `tag_memberships`, `views`, `view_filters`, `needs_recipes`, `supply_lots`. Composite index on needs `(ingredient_id, unit, store_tags, for_user_ids)` per Q36. tsvector + GIN on supplies and supply_lots.
- ✅ Dropped schema: `grocery_lists`, `grocery_list_items`, `grocery_list_item_recipes`, `pantry_staples`, `pantry_items` (though 5 stale query sites remain in `spaceService.ts` + `statsService.ts` — flagged in DEFERRED_WORK)
- ✅ Services: `suppliesService`, `needsService`, `tagsService`, `viewsService`, `lotsService`. Old services `groceryListsService` + `pantryStaplesService` deleted; `groceryService` (legacy) reviewed.
- ✅ Recipe-flow integration: `addNeedFromRecipe` rewrites against needs; combine-prompt logic; auto-tagging from current view context.
- ✅ Cook-flow integration: depletion routes to `setSupplyState`; on `out` transition, spawn-need fires; lot-aware depletion via `deductFromOldest` + manual override picker.
- ✅ UX: replaced `GroceryListsScreen` + `GroceryListDetailScreen` with `ViewsScreen` + `ViewDetailScreen` (file renames partial — pending CC cleanup pass). 4 default views ship pre-baked. Custom-view creator. Supplies grid replaces staples grid. State cycle UI for supplies (list = tap-to-cycle for non-lots; detail = tap-to-set). Regulars zone (collapsed default + expanded multi-select). Configure-once add-to-needs sheet. Edit-routing modal on spawn toast. Supply-create flow (Tab 12).
- ✅ Cross-user smoke test: Tom + Mary household interaction verified 2026-04-28 + 2026-05-15.
- ✅ Lot tracking: `tracks_lots` opt-in flag. `supply_lots` table. Lot-aware SupplyRow. Lot editor in SupplyDetail. Lot create inline in SupplyCreateSheet. Lot-aware cook depletion. Lot-aware grocery acquire (default-create with toast + edit). Server-side multi-dimension search via tsvector + storage synonym map. Catalog plural_name audit (P8R-D20 closed). 90 catalog rows added in SF-5 (coffee/tea/cheese/spice/grains).

### Out of scope (deferred to post-F&F or later phase)

- Configurable spawn-thresholds per supply (D8R-Q10 γ)
- Cross-dimension OR-filter views (D8R-Q16 supports AND-only)
- Combine-prompts at add-time (D8R-Q12 — view-level merge sufficient)
- Sales/brand integration (Phase 9+)
- Store-aware reordering (Phase 9)
- Per-store brand preferences (P8-2)
- Subgroup-within-category hierarchy (P8R-D8)
- Auto-select urgency from meal calendar in recipe-add (P8R-D9)
- Cold-start / empty-state polish (P8R-D11)
- Onboarding flow for new accounts (Phase 12)
- Receipt scan to bulk-create lots (P8R-D22)
- Per-lot fill_level (P8R-D23)
- Per-supply auto-demote-on-cook toggle (P8R-D31)
- Multi-supply variant migration tooling (P8R-D32)
- Dedicated expiration flag in pantry Attention section (P8R-D33)

### Stays separate (NOT absorbed by 8R)

- **8A schema foundation** ✅ — shipped
- **8B staples & depletion** ✅ — shipped (staples became supplies in 8R)
- **8D recipe-pantry matching upgrade** — Verified 2026-05-15 as **NOT SHIPPED**. ~3-5 sessions of real work pending. F&F-blocker. See `PHASE_8D_PLANNING.md` (next session deliverable).
- **8E discovery polish + natural search** — pushed to after 8D. F&F-relevant subset: CP1, CP3, CP4.

### Phase 8 sequence after 8R

```
8A ✅ → 8B ✅ → 8R ✅ (closeout in flight) → 8D 🔲 → 8E 🔲 (subset) → F&F
```

---

## Decisions log

*(Q1-Q42 decisions preserved from v0.6 — see that version for the foundational decisions Q1-Q18, wireframe iteration decisions Q19-Q27, audit pass decisions Q28-Q34, and audit follow-up decisions Q35-Q37, plus the lot-tracking iteration Q43-Q60.)*

### Override applied during CP6e smoke (2026-05-14)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| **D8R-Q54-OVERRIDE** | 2026-05-14 | LotBadge tap behavior (REVERSES Q54) | **Q54 said:** "Tap on the lot-aware badge (number + unit icon) cycles `supply.status` exactly like tap on the 5-circle dots cycles a non-lot supply." **OVERRIDE:** During CP6e-SmokeFix-SF2, `handleLotBadgeTap` was changed to call `onToggleExpanded()` instead of `cycleSupplyStatus`. **Rationale:** smoke surfaced that the lot-badge-cycles-status behavior was confusing in context — users tapping the badge usually want to see the lots (which gives them the underlying information needed to decide if the status assignment is right), not advance the status state. The 5-circle pattern stays interactive for non-lots supplies; lots supplies use the badge as a display + expand affordance, with status assignment happening explicitly in SupplyDetail's state-cycle strip. **Code reflects this. Q54 stays in the decisions log as the original design intent; this row is the binding rule.** The concept-section text remains aligned to Q54 narrative for non-lots cases; lots-case behavior is the override. |

### Deferred decision points (P8R-D series) — status update

| ID | Topic | Status |
|----|-------|--------|
| P8R-D1 | Configurable spawn thresholds | Post-F&F |
| P8R-D2 | OR-filter views | Post-F&F |
| P8R-D3 | Add-time combine prompts | Post-F&F |
| P8R-D4 | Quantitative supply tracking | ✅ RESOLVED — opt-in `tracks_lots` shipped CP6e |
| P8R-D5 | Hierarchy storage strategy | Post-F&F |
| P8R-D6 | View-rule visibility UX | ✅ RESOLVED (Q19/Q22) |
| P8R-D7 | Search bar on Supplies grid + Expanded Regulars | ✅ RESOLVED — shipped CP6d-Pantry + CP5b |
| P8R-D8 | Subgroup-within-category hierarchy | Post-F&F |
| P8R-D9 | Auto-select urgency from meal calendar | Post-F&F |
| P8R-D10 | Pre-select-out-items default in expanded Regulars | Post-F&F |
| P8R-D11 | Cold-start / empty-state polish | Post-F&F |
| P8R-D20 | Catalog data audit | ✅ RESOLVED — plural audit (CP6e-Schema) + 90 rows added (SF-5 2026-05-14) |
| P8R-D22 | Receipt scan → bulk lot create | Post-F&F |
| P8R-D23 | Per-lot fill_level | Post-F&F |
| P8R-D24 | setSupplyStatus.usage_level patch on transitions only | ✅ RESOLVED — CP6d-SmokeFix-1 |
| P8R-D25 | InlineAddNeedRow submit-on-return priority order | ✅ RESOLVED — CP6d-ViewDetail follow-up |
| P8R-D26 | RecipeDetail dual CTAs + AddRecipeToNeedsModal rebuild | ✅ RESOLVED — CP6d-Recipe |
| P8R-D27 | UnitPicker null-ingredient mode for T3 custom-name needs | 🟢 PARTIALLY RESOLVED — UnitPicker now supports null-mode (CP6e-SmokeFix-SF1 for lot-entry); AddNeedSheet/EditNeedSheet null-mode adoption is the post-F&F follow-up unless smoke surfaces friction |
| P8R-D28 | setSupplyStatus(in_stock) clears archived_at | ✅ RESOLVED — CP6d-SupplyDetail follow-up |
| P8R-D29 | Per-supply shelf-life override schema + UI | 🟡 stub shipped CP6d-SmokeFix-3; full migration + UI deferred (optional F&F) |
| P8R-D30 | User-customizable category placement for custom-name supplies | Post-F&F |
| P8R-D31 | Per-supply auto-demote toggle (REVERSES prior 8R cook auto-demote rule) | Post-F&F |
| P8R-D32 | Multi-supply variant migration | Post-F&F |
| P8R-D33 | Expiration flag in pantry Attention section | Post-F&F |

---

## Build plan — final status

| Sub-phase | Checkpoints | Sessions | Status |
|-----------|-------------|----------|--------|
| Wireframe dev | (planning prerequisite) | 2 sessions + audit pass + follow-up | ✅ COMPLETE 2026-04-29 |
| 8R-CP1 | Schema foundation | 1 | ✅ 2026-04-29 |
| 8R-CP2 | Service layer foundation | 1-2 | ✅ 2026-04-29 |
| 8R-CP3 | Recipe + cook flow integration | 1-2 | ✅ 2026-04-29 |
| 8R-CP5a | View infrastructure | 1 | ✅ 2026-04-30 |
| 8R-CP5b | Add-Need Sheet + Expanded Regulars + getNeedsForView | 1 | ✅ 2026-04-30 |
| 8R-CP6a | Service fixes + small UX polish | 1 | ✅ post-2026-05-04 audit |
| 8R-CP6b | Tab 12 supply create + Tab 9 spawn-on-out toast + Tab 9 edit-need modal | 1-2 | ✅ post-audit |
| 8R-CP6c | Cart visibility + bulk acquire + filename rename + lib/types/grocery.ts deletion (partial) + PK_CODE_SNAPSHOTS reconciliation | 1 | ✅ shipped; CC cleanup pass pending for residuals |
| 8R-CP6d | SupplyDetailScreen, T1 inversion, dual-listing, slider patches, archived_at clearing, shelf-life override stub | 4 sub-CPs | ✅ post-2026-05-04 audit |
| 8R-CP6e | Lots schema + service layer + UI rebuild + search RPC + catalog audit | 4-6 (split a/b/c/d) | ✅ shipped 2026-05-06 → 05-13 |
| 8R-CP6e-Smoke | First round 2026-05-14 — 5 findings (SF-1 through SF-5) | — | ✅ Round 1 triaged |
| 8R-CP6e-SmokeFix-SF1 | UnitPicker null-mode + LotInputRowView swap + 'pieces' default | — | ✅ 2026-05-14 shipped + smoke-verified 2026-05-15 |
| 8R-CP6e-SmokeFix-SF2 | Lot hydration in suppliesService + LotBadge tap = expand-row (Q54 OVERRIDE) | — | ✅ 2026-05-14 shipped + smoke-verified 2026-05-15 |
| 8R-CP6e-SmokeFix-SF3 | `search_supplies` RPC tsquery prefix wildcard | — | ✅ 2026-05-14 shipped + verified |
| 8R-CP6e-Catalog-SF5 | Coffee/tea + comprehensive catalog adds (90 rows total) | — | ✅ 2026-05-14 |
| **Smoke validation gate** | 19 scenarios on Tom's phone | — | **✅ PASSED CLEAN 2026-05-15** |

**8R closeout — remaining work (~1 week):**

| Item | Status |
|---|---|
| Doc reconciliation: PROJECT_CONTEXT v10.3, PHASE_8R v0.7, DEFERRED_WORK v5.20, FF_LAUNCH_MASTER_PLAN v6.4 | 🟢 in flight (this session) |
| CC repo cleanup pass | 🔲 (next session) |
| FRIGO_ARCHITECTURE.md refresh | 🔲 (dedicated session) |
| D8R-Q54 override doc-reconciliation in PHASE_8R | ✅ done (this version) |
| CP6e commit batch landing | 🔲 (CC task) |
| 8R closeout marker | 🔲 (after above) |

---

## Wireframe reference

Final wireframes at `docs/wireframes/phase_8r/`:
- `phase_8r_wireframes_v3.html` — 12 surfaces, 1660 lines, base 8R UX
- `phase_8r_lots_wireframes_v2.html` — 10 surfaces, ~1950 lines, CP6e-Lots additions

Both are canonical references for design intent. Implementation has diverged at D8R-Q54-OVERRIDE (LotBadge tap behavior) — code is authoritative; wireframes reflect the original Q54 design intent which has been reversed.

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-15 | **v0.7** | **Mid-closeout reconciliation.** CP6d/CP6e completion captured in build plan table. Smoke validation gate passed clean 2026-05-15. D8R-Q54 OVERRIDE entry added to decisions log (LotBadge tap = expand-row, not cycle-status per CP6e-SmokeFix-SF2). P8R-D series status updated: D4/D6/D7/D20/D24/D25/D26/D28 RESOLVED; D27 partially resolved (lot-entry scope shipped; AddNeedSheet/EditNeedSheet null-mode adoption is post-F&F follow-up); D29 stub shipped, full deferred. Scope section now lists shipped state rather than planned state. Remaining 8R closeout enumerated. **Architectural concept section preserved by reference to v0.6** — no narrative-level changes since lot model + Q-rules captured; the single deviation (Q54 override) called out inline. |
| 2026-05-06 | v0.6 | Lots model added (CP6e). 18 new design decisions (Q43-Q60). Reopens P8R-D4 as opt-in `tracks_lots` flag. Reverses prior 8R cook auto-demote rule (Q53). Adds server-side tsvector search (Q57). |
| 2026-04-30 | v0.5 | CP5a + CP5b shipped; CP6 split into a/b/c. Pantry/grocery-era purge milestone reached. |
| 2026-04-29 | 0.4 | Audit follow-up resolution — 3 new decisions (Q35-Q37). |
| 2026-04-29 | 0.3 | Audit pass + wireframe v3 completed. 7 new design decisions (Q28-Q34). |
| 2026-04-29 | 0.2 | Wireframe iteration complete — 9 new design decisions (Q19-Q27). |
| 2026-04-29 | 0.1 | Initial draft. 2026-04-29 design walkthrough decisions (D8R-Q1 through Q18) and 6-CP build plan. |
