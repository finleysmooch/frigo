# [DRAFT] Phase 8 wireframes

> **⚠️ DRAFT v2 — pending second audit review.** README for a new `docs/wireframes/phase_8/` directory that does not yet exist in the repo. Generated 2026-04-23. Minor v2 updates: added sub-phase mapping section tying wireframe elements to restructured CP numbering (8A-CP1 through 8E-CP4 per Phase 8 v2.1 doc). Do NOT add to repo before second audit pass.

Preserved HTML prototypes from the 2026-04-23 Claude.ai wireframe session. Three iterations, all preserved. Reference during Phase 8 execution — specifically for UX decisions, interaction patterns, and visual hierarchy questions that aren't spelled out in `PHASE_8_PANTRY_INTELLIGENCE.md`.

**Open in any browser.** Tabs along the top switch between surfaces. Sub-toggles within some tabs (cook post options, older browse variants) let you compare approaches.

**Primary reference is v5.** The others show how decisions evolved.

---

## File guide

### `phase_8_system_prototype_v5.html` — **primary reference**

Final version. Nine tabs covering the full Phase 8 system.

Represents final decisions on:
- Pantry staples grid with **unknown state** (dashed border, italic label, empty dot — see Paprika). Out-state auto-sorts to top-left. Softer color treatment (border-left accent + subtle tint vs saturated fills).
- Recipe tab uses **existing Phase 6G NYT-style layout** (group headers, `✓ qty unit <strong>name</strong>, prep` format). No restructure. Only addition: **inline tap-sheet below the tapped row** with state-dependent actions (missing gets "Substitute", low gets "Actually have", staple gets "Mark low").
- **Locked filter chips pattern** on subset pages (What-can-I-cook, Ingredient Detail Recipes tab) — lock icon + gray = defining filter not removable; blue = user-added removable.
- **Collapsed filter row** on Browse full list ("Sort: Pantry % · 0 filters · Filter & sort ▸").
- Grocery 3-tier structure (Now / Could wait / In cart) with cross-list awareness.
- Recipe chips on grocery with inline recipe quantity.
- Ingredient Detail screen — hero + 4 tabs (Recipes / Info / Brands / History).
- Freezer cleanout with collapsed rows, view toggle (Age/Category/Storage), thaw tray pattern.
- View toggle pattern applied to 3+ surfaces.
- Natural-language search (Haiku parse → chips → existing engine).
- Cook post depletion: Option A (banner-after, silent default with undo).

### `phase_8_system_prototype_v4.html` — **evolution reference**

Intermediate version. Shows the earlier state of two decisions that later changed in v5:

1. **Recipe tab used a bottom-sheet overlay** (full-width, appeared over content). v5 replaced this with inline tap-sheets per Tom's direction ("don't change the recipe page too much, lean on what we have currently").
2. **Browse recipes had A/B sub-toggles** for "question-led tiles" vs "search-first with chips". v5 collapsed these into a single direction: search at top + tiles + scrollable full list below, solving the "empty feeling" concern.

Also contains:
- View toggle pattern introduction across Pantry shelf, Freezer, Browse
- Natural search tab first appearance
- Grocery recipe chips first appearance
- Freezer cleanout collapsed rows first appearance

Reference if CC needs to see why a v5 decision landed where it did.

### `phase_8_system_prototype.html` (v3) — **baseline reference**

Earliest full-system version. Shows the first pass at the 5-sub-phase scope:

- Staples split-taps introduced (dot cycles state, label opens detail)
- Grocery 3-tier Now/Could wait/In cart first shown
- Ingredient Detail hero + 4 tabs structure
- Cook post A/B/C options side-by-side toggle
- Freezer cleanout with full-button actions (before collapsed rows)
- Browse recipes with Option 1 / Option 3 side-by-side

Reference if CC needs to see the original shape of a decision before it was refined in v4/v5.

---

## How to use during execution

1. **Before starting a checkpoint:** open v5, navigate to the relevant tab, screenshot or reference the layout in your CC prompt
2. **When a CC prompt needs precision:** paste a link to the specific tab + describe which element. E.g., "Build the staples grid per the Pantry tab in v5.html, specifically the treatment of Paprika (unknown state) and Cholula (out state auto-sorted to top-left)."
3. **When a UX decision is unclear:** check the notes pane on each tab in v5 — most design rationale is captured there. If not, v4 notes may show why that element was changed.
4. **When evolution matters:** reference v3 → v4 → v5 to see the progression.

---

## Sub-phase mapping (post-restructure)

Which wireframe elements map to which CC checkpoints per `PHASE_8_PANTRY_INTELLIGENCE.md` v2.1:

| Wireframe element | Checkpoint | Notes |
|-------------------|------------|-------|
| Pantry tab — 3-option view toggle (Category/Storage/Expiry) | 8A-CP2 | Extends existing 2-option toggle |
| Any row showing fractions (½ cup, ¾ lb) | 8A-CP3 | Utility function + wiring across surfaces |
| Pantry tab — staples grid with states + split tap zones + unknown state + soft colors | 8B-CP2 | Color softening absorbed into this CP |
| Cook post tab (Option A banner-after) | 8B-CP4 | Review/undo modal shown |
| Grocery list detail — 3-tier with chips + cross-list | 8C-CP1 through 8C-CP3 | |
| Grocery staple-to-grocery routing | 8C-CP4 | |
| Ingredient Detail screen — hero + 4 tabs | 8C-CP5 | Label tap on StapleCell becomes real |
| Freezer cleanout tab — collapsed rows + view toggle + thaw tray | 8C-CP6 through 8C-CP7 | |
| Use soon multi-select + Freezer multi-select | 8C-CP8 | |
| Recipe tab — existing layout + inline tap-sheet | 8D-CP3 | Actions vary by ingredient state |
| What-can-I-cook tab — 5 sections + locked chip | 8D-CP4 | |
| Recipe banner "85% in pantry · add missing →" | 8D-CP5 | |
| Browse recipes — search + tiles + full list | 8E-CP1 | Collapsed filter row variant |
| Natural search tab | 8E-CP2 | |
| Locked filter chips pattern | 8E-CP3 | Reusable component; applied to 3+ surfaces |
| Low stock chips on recipe rows | 8E-CP4 | |

---

## What these are NOT

- Not a visual design system — these are wireframes, colors/typography are approximate
- Not a substitute for the phase doc — `PHASE_8_PANTRY_INTELLIGENCE.md` has the canonical scope, architecture, decisions, sub-phase structure
- Not interactive beyond showing tab navigation + state cycling + chip filtering as demos — production app will have real data and real routing

---

## Session context

Generated in a single Claude.ai chat session running ~15 rounds of iteration. Wireframes evolved as decisions landed. Each version explicitly preserved during iteration so earlier states could be compared. Ended up being the primary design artifact for Phase 8 — more concrete than any amount of text description could be.
