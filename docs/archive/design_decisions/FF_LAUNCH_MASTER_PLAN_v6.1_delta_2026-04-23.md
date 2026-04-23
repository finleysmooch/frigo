# [DRAFT] FF_LAUNCH_MASTER_PLAN v6.1 — Phase 8 scope expansion delta v2.1

> **⚠️ DRAFT v2.1 — second audit pass cleared.** v2 risk register "update existing row" language was ambiguous ("commentary vs replacement"). Second audit caught this; now rewritten as explicit find/replace with before/after cell content. No other changes since v2. Generated 2026-04-23.

**Target doc:** `FF_LAUNCH_MASTER_PLAN.md` in repo (currently v6.0)
**Purpose:** Patch the Phase 8 section + session budget + risk register following 2026-04-23 wireframe session + 2026-04-23 audit. Not a full rewrite — this is a targeted delta the audit instance can apply against the current file.

---

## Sections to update

### 1. Phase 8 scope block

**Find:** `### Phase 8: Pantry Intelligence + Pantry/Grocery UX Overhaul 🔲`

**Replace the `Must have:` list + estimate block with:**

```
### Phase 8: Pantry Intelligence + Pantry/Grocery UX Overhaul 🔲

**Must have:**
- [must] Pantry schema foundation — space-scoped `pantry_staples` table, Path B foundation columns on `pantry_items`, grocery tier reasons on `grocery_list_items`, expiration fall-off config (8A-CP1)
- [must] Pantry UX foundation — view toggle (Category/Storage/Expiry), fraction display utility wired across surfaces, auto-expiry fall-off job (8A-CP2 through 8A-CP4)
- [must] Staples & depletion — `pantryStaplesService` with state cycling, staples grid UI with soft colors, cook-post banner-after depletion (8B)
- [must] Grocery UX overhaul — 3-tier structure (Now/Could wait/In cart) using existing `priority` field, recipe chips, cross-list awareness, staple-to-grocery auto-routing, aisle grouping via existing `typical_store_section` (8C-CP1 through 8C-CP4)
- [must] Ingredient Detail screen — hero + Recipes/Info/Brands/History tabs, reachable from every ingredient tap (8C-CP5)
- [must] Freezer cleanout — forgotten-item detector, thaw tray, async planning pattern, multi-select cross-ingredient search (8C-CP6 through 8C-CP8)
- [must] Recipe-pantry matching upgrade — base-ingredient normalization, staple exclusion, tap-sheet on RecipeDetailScreen ingredient rows (8D-CP1 through 8D-CP3)
- [must] What-can-I-cook screen with sectioned results, missing-to-grocery one-tap (8D-CP4 through 8D-CP5)
- [must] Browse recipes rebuild — search + tiles + full list with collapsed filter row (8E-CP1)
- [must] Natural-language search — Haiku parse → chips → existing search engine (8E-CP2) — scope-cut lever if needed
- [must] Locked filter chips pattern on subset pages (8E-CP3)
- [must] Low stock indicators (#31) — ingredient-level chips on recipe surfaces (8E-CP4)

**Pre-launch foundation (schema only, UI deferred):**
- [prep] Path B staleness foundation (`last_confirmed_at` on pantry_items, `staleness_threshold_days` per category) — unknown state UI for staples only at F&F; tracked-item staleness 1 session post-launch

**Moved to post-launch:**
- [post-launch] Brand discovery full UI — data already captures via existing `grocery_list_items.brand_preference` + `size_preference`; full community-scale discovery UI is 3-5 sessions post-launch
- [post-launch] Smart (silent-automatic) cook-post depletion — opt-in banner v1, smart post-launch once matching proven
- [post-launch] Full accessibility audit across Phase 8 surfaces — per-prompt tap target + label verification only for v1
- [post-launch] Flex meal planning v1 → Phase 9
- [post-launch] NYT Cooking integration → top-of-queue
- [post-launch] Receipt scanning → post-launch
- [post-launch] Per-store grocery aisle layouts → v1 uses global `typical_store_section`; per-store "where found last time" memory post-launch
- [post-launch] Category-level pantry matching ("any cheese", "any pasta") → user-configurable setting
- [post-launch] Quantity-aware matching ("recipe needs 4 eggs, I have 2") → smart subtraction v2
- [post-launch] Staples onboarding survey → likely Phase 12
- [post-launch] Smart thaw-time calculation → v1 is manual
- [post-launch] Auto-schedule thawed items onto meal calendar → Phase 9
- [post-launch] App-level voice recording → v1 uses OS dictation only
- [post-launch] Conversational search refinement → v1 is single-turn

**Estimated: 18-28 sessions** (was 7-12 at v6.0). Revised after 2026-04-23 wireframe session added 5 new scope items (Ingredient Detail, Freezer cleanout, natural search, locked chips pattern, view toggle pattern) and 2026-04-23 audit surfaced per-checkpoint estimates that warranted sub-phase bump (8B: 3-4 → 4-5; 8C: 4-6 → 6-8).

**Sub-phase structure (5 sub-phases):** 8A schema foundation + pantry polish (3-4) · 8B staples & depletion (4-5) · 8C grocery + Ingredient Detail + freezer (6-8) · 8D recipe matching + tap-sheet (3-5) · 8E discovery polish + natural search (3-4).

**Primary scope-cut lever:** Natural-language search → keep existing FilterDrawer for F&F, ship natural search as first post-launch work. Brings total to 16-25 sessions.
```

---

### 2. Session budget section

**Find:** The `### Session Budget` block (references "remaining estimate ~33-53 build sessions").

**Update the total:**

The original 33-53 estimate assumed Phase 8 at 7-12. With Phase 8 at 18-28, remaining estimate becomes **44-69 build sessions**.

At 14-16 sessions/week:
- Base: ~5-6 weeks total (3-4 weeks build + 2 weeks testing)
- +50% growth buffer: ~6.5-7.5 weeks
- Phase-7-style 2× growth: ~7.5-9 weeks

Testing window stays calendar-fixed. Phase 11 remains the primary scope-cut lever; Phase 8's natural search is the secondary lever.

---

### 3. Risk register

**Add new row** to the risk register (matching the existing 3-column structure: **Risk | Impact | Mitigation**):

| Risk | Impact | Mitigation |
|------|--------|------------|
| Phase 8 scope growth during wireframing (already occurred) | Medium | Session estimate revised 7-12 → 18-28 to reflect actual scope after wireframe iteration + per-checkpoint sizing audit. Natural-language search explicitly flagged as primary scope-cut lever (saves 2 sessions). Brand discovery UI pushed post-F&F (no schema additions needed — captures via existing `grocery_list_items.brand_preference`). Full accessibility audit deferred to post-F&F with per-prompt tap target + label verification sufficient for v1. |

**Update existing risk register row** — find the row referencing "2×-growth-repeat risk" (or equivalent language about phase scope growth) and replace the Mitigation cell.

**Find cell content (approximately):** "Accept as documented worst-case scenario; Phase 11 is primary scope-cut lever." (or whatever the current Mitigation text is for that row — match by Risk column reference to 2×-growth or scope-repeat)

**Replace with:** "Phase 8 already grew ~150% during wireframing before any execution — this is scope *discovery* (happening in planning, the right place for it), not scope *creep*. Actual build velocity from this point forward is the remaining unknown. Phase 11 remains primary scope-cut lever; Phase 8's natural-language search is secondary."

If the exact current Mitigation text doesn't match the expected content, flag in audit notes — don't silently overwrite a different mitigation.

---

### 4. Changelog

**Add row at top:**

| Date | Change |
|------|--------|
| 2026-04-23 | **v6.1 — Phase 8 scope expansion delta.** Post-wireframe session + first audit. Phase 8 restructured 4 sub-phases → 5 (8A-8E), then further restructured within 8A/8B/8C per audit to ensure executable-in-order dependency graph. Session estimate 7-12 → 18-28. Net total 33-53 → 44-69. New scope items: Ingredient Detail screen (hero + 4 tabs), Freezer cleanout surface, Natural-language search, Recipe tap-sheet pattern preserving Phase 6G layout, Locked filter chip pattern, View toggle cross-cutting pattern, fraction display utility (restored from v1.0 scope after audit caught the drop). Data model foundation for Path B staleness (UI deferred post-F&F). Brand schema changes dropped (existing `grocery_list_items.brand_preference` captures data). Full detail in `PHASE_8_PANTRY_INTELLIGENCE.md` v2.1 + `docs/wireframes/phase_8/` preserved HTML prototypes (v3, v4, v5). |

---

## What's unchanged

- Phase sequence (7P → 8 → 9 → 10 → 11 → 12)
- Target launch window (early-to-mid June 2026)
- Working agreements
- Org route decision (LLC + D-U-N-S + Frigo domain admin track)
- Apple Developer enrollment timing (end of Phase 8)
- Phase 11 as primary scope-cut lever
- Every other phase's scope

---

## Audit instance instructions

1. Open current `FF_LAUNCH_MASTER_PLAN.md` (v6.0 in repo at `docs/planning/`)
2. Apply the 4 section updates above in order
3. Bump version header at top of doc to v6.1
4. Verify changelog row added correctly
5. Spot-check: Phase 8 session estimate appears in 3 places (scope section, session budget, phase sequence table) — all should say 18-28 after patch
6. Verify risk register row has 3 columns matching existing format

If any detail conflicts with current repo state, flag in audit notes — don't silently resolve.
