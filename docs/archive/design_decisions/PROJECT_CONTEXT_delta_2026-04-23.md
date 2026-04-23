# [DRAFT] PROJECT_CONTEXT.md — Phase 8 planning-complete delta v2.1

> **⚠️ DRAFT v2.1 — second audit pass cleared.** v2 delta redundantly patched the Phase 8 scope bullets in two sections. Second audit caught this; Section 3 removed as it was duplicating Section 2's replacement. Delta is now 2 sections (heading + narrative block). Generated 2026-04-23.

**Target doc:** `PROJECT_CONTEXT.md` in repo
**Purpose:** Light update to reflect Phase 8 planning complete + scope expansion + 7P completion cleanup. Audit instance patches 3 specific sections.

---

## Section 1 — Section heading cleanup

**Find:** `### Immediate (Phase 7P → Phase 8, planning starting 2026-04-22)`

**Replace with:** `### Immediate (Phase 8 kickoff, planning complete 2026-04-23)`

Rationale: Phase 7P is ✅ complete as of 2026-04-22 (see `PHASE_7P_FEED_POLISH.md` completion status). Keeping the old heading implies 7P is still in flight.

---

## Section 2 — What's Next block

**Find:** The narrative block immediately under the section heading updated in Section 1.

**Replace the "Phase 8 follows immediately after 7P" block with:**

```
**Phase 7P** shipped 2026-04-22 (feed pagination + pull-to-refresh hang fix).

**Phase 8** planning complete as of 2026-04-23 (wireframe session + first audit pass). Scope in `PHASE_8_PANTRY_INTELLIGENCE.md` v2.1:

Sub-phase structure (5 sub-phases, 18-28 sessions):
- **8A — Schema foundation + pantry polish** (3-4) — pantry_staples table + Path B foundation columns (CP1), view toggle with 3 options, fraction display utility, auto-expiry fall-off
- **8B — Staples & depletion** (4-5) — pantryStaplesService, staples grid UI with softer colors, bulk pre-populate, cook-post banner-after depletion
- **8C — Grocery + Ingredient Detail + Freezer** (6-8) — 3-tier grocery (Now/Could wait/In cart), cross-list awareness, recipe chips, Ingredient Detail screen (hero + 4 tabs), Freezer cleanout surface with thaw tray
- **8D — Recipe matching upgrade + tap-sheet** (3-5) — base-ingredient normalization, staple exclusion, inline tap-sheet on RecipeDetailScreen, What-can-I-cook sectioned results, missing-to-grocery one-tap
- **8E — Discovery polish + natural search** (3-4) — Browse rebuild (search + tiles + collapsed-filter full list), natural-language search via Haiku, locked filter chips pattern, low stock indicators (#31)

Scope grew 7-12 → 18-28 during wireframing + audit. Within master plan 2× growth buffer. Natural search is primary scope-cut lever if needed (drops to 16-25).

Wireframe prototypes will be preserved at `docs/wireframes/phase_8/` after wireframe setup commit as design reference for CC execution.
```

---

## What's unchanged

- Everything else. Project metrics, known issues, deferred work, Phase 9-12 scope, past phase completion status (other than 7P, which was incorrect).

---

## Audit instance instructions

1. Open `PROJECT_CONTEXT.md`
2. Apply the 2 section updates above in order (Section 1 heading swap, Section 2 narrative block replacement)
3. Bump the "Last updated" header if present
4. No changelog row needed — this is a light touch-up, not a version milestone
5. Verify 7P is marked as complete elsewhere in the doc (scan for any other stale references)
