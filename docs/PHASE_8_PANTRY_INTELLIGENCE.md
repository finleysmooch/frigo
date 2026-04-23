# Phase 8: Pantry Intelligence & UX Overhaul

**Started:** TBD (wireframing complete 2026-04-23, execution pending)
**Last Updated:** April 23, 2026 (v2.3)
**Status:** 🔲 Planning complete, execution not yet started
**Master Plan:** See `FF_LAUNCH_MASTER_PLAN.md` for full F&F context

---

## Goals

Turn pantry from static inventory into an active assistant ("What can I cook with what I have?") and make pantry, grocery, and recipe-pantry integration feel like a coherent system rather than disconnected features. The single most-flagged UX weak spot in pre-F&F testing.

**Why this is Phase 8:** Most complex remaining domain. Recipe-pantry matching depends on Phase 5's ingredient architecture. Staples + depletion + freezer cleanout are compound-utility features that need weeks of real use to validate — F&F is the right moment. Flex meal planning moved to Phase 9; NYT Cooking deferred to post-launch.

**Success criteria:**
- Pantry screen feels approachable — not clunky, not overwhelming
- Fraction quantities render as human-readable unicode (½ cup, ¾ lb) not decimals
- Users can flag staples as low/out in one tap and those flags route to grocery lists automatically
- Users can see which recipes they can cook based on pantry contents (upgraded matching, not just ingredient_id exact match)
- Missing ingredients flow to grocery list in one tap, quantity from recipe
- Grocery list reorganizes around urgency (Now / Could wait / In cart) instead of one flat list
- Cross-list awareness: item on "This week" + "Costco run" visible on both, checkoff clears both
- Cook posts optionally deplete pantry (banner-after pattern, silent default with undo)
- Forgotten freezer items surface with action affordances (recipes / thaw-and-plan / toss)
- Each ingredient has a dedicated detail view (hero + Recipes / Info / Brands / History tabs)
- Natural-language recipe search ("thai chicken from ottolenghi, mostly from my pantry") parses to structured filter chips

---

## Canonical terminology

**State enum (DB authoritative):** `unknown | good | running_low | out`. The DB stores `running_low`. UI display may render it as "low" for brevity; code and SQL everywhere else use `running_low`.

**Last touched / last confirmed:** Unified under `last_confirmed_at` column on both `pantry_items` and `pantry_staples`. Bumped on any user-initiated state change (quantity edit, expiration edit, state cycle, cook-post depletion credit, manual "still have this" action). Serves both "has the user engaged with this recently" (Path B staleness) and "was this touched in the last N days" (freezer cleanout detection).

**Wireframe references:** Three HTML prototypes will live at `docs/wireframes/phase_8/` after the wireframe setup commit. v5 is primary reference; v3 and v4 preserved for evolution context. Not in repo yet.

---

## Prerequisites

- Phase 5 complete (ingredient architecture — categorization, dietary flags, matching foundation)
- Phase 7 complete (social loop done, utility features get focus)
- Phase 7P complete (feed polish shipped 2026-04-22)
- MissingIngredientsScreen stub exists
- Existing pantry: PantryScreen, PantryItemRow, pantryService, shared spaces (via `space_members` table — NOT `space_memberships`), SVG category icons
- Existing grocery: GroceryListsScreen, GroceryListDetailScreen, groceryService, groceryListsService, regular items
- Existing recipe matching: `calculatePantryMatchPercentage()` / `calculateSpacePantryMatchPercentage()` and bulk variants in pantryService — naive exact `ingredient_id` match, no normalization or staple exclusion. Used by RecipeListScreen and RecipeDetailScreen today. 8D upgrades internals; preserves function signatures.
- RecipeDetailScreen Phase 6G layout: NYT-style flat rows, group headers, `✓ qty unit <n>, prep` format. Tap-sheet pattern added in 8D-CP3 builds on this without restructuring it (implements D6-18 deferred feature).
- Existing ingredients column `typical_store_section` populated with values like "Produce", "Dairy", etc. — used in 8C for grocery aisle grouping (no new column needed).
- Existing `grocery_list_items.brand_preference` + `size_preference` columns — already capture brand data organically on grocery add. No new brand schema needed at F&F.

---

## Scope

### Product Feature Roadmap items touched

| # | Feature | Action |
|---|---------|--------|
| 57 | Recipe-pantry matching | Core build: upgraded scoring (base-ingredient normalization, staple exclusion), browse filter, pantry shortcut, missing-to-grocery one-tap |
| 65 | Pantry feature | UX overhaul: view toggle (Category/Storage/Expiry), staples as separate class, auto-expiry fall-off, softer color treatment, fraction display |
| 67 | Grocery list | UX overhaul: 3-tier structure (Now/Could wait/In cart), recipe chips, cross-list awareness, grocery→pantry polish |
| 31 | Low stock in recipes | Ingredient-level pantry state on RecipeDetailScreen via tap-sheet pattern |
| (new) | Staples & depletion | New concept — space-scoped staples table, unknown/good/running_low/out state, cook-post opt-in depletion |
| (new) | Freezer cleanout | New surface — forgotten-item detector, thaw-and-plan tray, async planning pattern |
| (new) | Ingredient Detail | New surface — hero + Recipes / Info / Brands / History tabs. Accessible from every ingredient tap across app |
| (new) | Natural-language search | Claude Haiku parse → structured filter chips → existing search engine |
| (promoted must-have) | Fraction display | Unicode-fraction rendering in pantry rows, grocery rows, staple cells, recipe tap-sheet quantity field |

### Sub-phase overview (5 sub-phases, 18-28 sessions)

| Sub | Scope | Sessions |
|-----|-------|----------|
| **8A** | Schema foundation + standalone pantry polish (view toggle, fraction display, expiration fall-off) | 3-4 |
| **8B** | Staples & depletion — service, UI with soft colors, bulk pre-populate, cook-post depletion | 4-5 |
| **8C** | Grocery UX overhaul + Ingredient Detail + Freezer cleanout | 6-8 |
| **8D** | Recipe-pantry matching upgrade + recipe tap-sheet + what-can-I-cook + missing-to-grocery | 3-5 |
| **8E** | Recipe discovery polish + natural-language search + low-stock indicators | 3-4 |

**Estimated total: 18-28 sessions** (revised up from initial 16-23 after per-checkpoint re-estimation in 8B and 8C). Within master plan's 2× growth buffer but eating into it.

**Primary scope-cut lever:** Natural-language search → keep existing FilterDrawer for F&F, ship natural search as first post-launch work. Brings total to 16-25.

---

## Sub-phase details

### 8A — Schema foundation + pantry polish (3-4 sessions)

**Goal:** Lay the schema foundation for all downstream Phase 8 work, plus ship pantry polish items that don't depend on later sub-phases.

**Checkpoints:**
- **8A-CP1 Schema foundation migration.** Single atomic SQL migration creating `pantry_staples` table (space-scoped, state enum CHECK, `custom_name` support for branded items, `last_confirmed_at`, `added_by`, RLS matching `pantry_items` pattern via `space_members`); adds `last_confirmed_at` + `discarded_at` + `discarded_reason` + `thaw_planned_for` to `pantry_items`; adds `priority_reason` + `custom_name` + nullable `ingredient_id` + CHECK constraint to `grocery_list_items`; adds `expiration_falloff_days` to `space_settings`; adds `staleness_threshold_days` JSONB to `user_pantry_preferences`; backfills `last_confirmed_at = updated_at` on existing `pantry_items` rows. TypeScript types updated in same checkpoint. **Executes first in Phase 8 — unblocks everything else.**
- **8A-CP2 View toggle on PantryScreen.** Extends the current 2-option Family/Storage toggle with a third option (Expiry). Same toggle infrastructure; new sort mode that orders items by expiration date, no grouping. Reusable view-toggle component structure (applied to 3+ surfaces across Phase 8).
- **8A-CP3 Fraction display utility + wiring.** Restored from v1.0 scope. Utility function converting decimal quantities to unicode fractions (½, ⅓, ¼, ¾, ⅛, ⅜, ⅝, ⅞, ⅙, ⅚). Falls back to decimal for unsupported values. Wired into `PantryItemRow`, grocery list rows, and `StapleCell` in this checkpoint (~0.5 session). **Recipe tap-sheet quantity rendering is wired as part of 8D-CP3's scope, not 8A-CP3** — it's a few lines inside the tap-sheet work, not a separate cost center. 8A-CP3's estimate covers utility + pantry/grocery/staple surfaces only.
- **8A-CP4 Auto-expiry fall-off job.** Uses `discarded_at` column from CP1. Background query run on app open (or scheduled edge function post-F&F) that sets `discarded_at = NOW()` and `discarded_reason = 'expired'` for non-freezer items where `expiration_date < NOW() - INTERVAL '{expiration_falloff_days}'`. Configurable per space. Queries across app updated to filter `WHERE discarded_at IS NULL` for active items.

**Out of scope for 8A:** Staples table + UI (8B). New Ingredient Detail screen (8C). Any grocery work beyond schema additions (8C). Cook-post depletion UI (8B).

**Dependencies:** None upstream. CP1 unblocks CP4 within 8A. CP2 and CP3 are independent polish.

---

### 8B — Staples & depletion (4-5 sessions)

**Goal:** Introduce staples as a first-class pantry concept. Make cook posts optionally deplete pantry without forcing friction into the posting flow.

**Checkpoints:**
- **8B-CP1 Staples service layer.** New `pantryStaplesService.ts`. CRUD, state cycling (`unknown → good → running_low → out → good`, where `unknown → good` is first-tap confirmation and exits unknown permanently). Auto-bumps `last_confirmed_at = NOW()` on every state transition including unknown→good confirmation. Typed error classes (`DuplicateStapleError`, `StapleNotFoundError`). No UI changes.
- **8B-CP2 Staples UI + color softening.** Renders `StaplesGrid` + `StapleCell` components at top of PantryScreen per v5 wireframe. Unknown state = dashed border + italic label + empty outlined dot. Low/out states = soft tint + border-left accent + dot + bolder label ("out" auto-sorts to top-left of grid). Color softening absorbed here (no longer a standalone 8A checkpoint). Split tap zones: dot (~28-32px) cycles state; label opens Ingredient Detail screen (stub until 8C-CP5 — Alert shown for now). Optimistic updates; re-sort on state change.
- **8B-CP3 Add/Manage Staples screen.** Single-screen surface for adding, editing, and deleting staples. Entry points from StaplesGrid: footer "Add new", empty-state CTA, and "+N more" overflow cell all navigate here. Search bar with case-insensitive ILIKE prefix match on `ingredients.name` — results show current staples greyed out. Tap an ingredient row to add it as a staple (state=`unknown`). Custom-name add via dedicated input at bottom (for brands like "Motor City pizza"). List view shows all current staples with edit (custom_name only) and delete affordances. No manual state setting from this screen (cycling lives on the grid per D8-29). Bulk pre-populate tooling for Tom + Mary handled out-of-band via direct SQL; not part of this checkpoint.
- **8B-CP4 Cook-post depletion banner.** Option A per wireframe: post flow unchanged; after success, banner appears "✓ Posted · We updated your pantry · 4 items · review / undo." Silent default. Review opens compact modal showing which `pantry_items` quantities will decrement and which staples change state (uncheckable per-item). Undo rolls back all depletion (quantity and state restorations). Staple state changes on depletion bump `last_confirmed_at`.

**Architectural decisions:**
- Staples space-scoped, not user-scoped — matches pantry_items pattern. Household shares state (D8-8).
- Separate `pantry_staples` table, not column on `pantry_items` — cleaner separation, supports `custom_name` for branded items without contaminating tracked-item schema (D8-7).
- Unknown state belongs to staples only (D8-9). Tracked items always have quantity + expiration. Path B (stale tracked items) deferred post-F&F but data foundation (`last_confirmed_at`) ready.
- Cook post depletion Option A (banner after, silent default with undo) selected over Options B (inline toggle at compose) and C (ask-later on next pantry open) (D8-10).

**Out of scope for 8B:** Automatic-silent depletion (smart-auto flagged as post-F&F fast-follow once matching proven). Brand preferences UI (post-F&F; data already captures via existing `grocery_list_items.brand_preference`). Staples onboarding survey (deferred — likely Phase 12).

---

### 8C — Grocery UX overhaul + Ingredient Detail + Freezer cleanout (6-8 sessions)

**Goal:** Grocery list becomes triage-driven. Ingredient Detail becomes a real surface. Freezer cleanout introduces the async-planning pattern.

**Checkpoints:**
- **8C-CP1 Grocery 3-tier restructure.** GroceryListDetailScreen restructured around `priority` field (`'needed'` = Now, `'nice_to_have'` = Could wait, `is_in_cart=true` = In cart). Uses existing `typical_store_section` column on `ingredients` for aisle grouping within tiers. New `priority_reason` column explains machine-set priorities ("staple out" / "for X recipe" / "manual"). Lists screen shows tier summary ("2 now · 9 could wait · 8 in cart") with red "now" badge.
- **8C-CP2 Cross-list awareness.** Same ingredient on multiple lists shows "→ also on Costco run" / "→ prefer Costco" indicators. Query-time join on `ingredient_id` + active-list membership. Checkoff on one list dismisses same-ingredient copies on other lists within recent window (configurable — default 4 hours).
- **8C-CP3 Recipe chips on grocery detail.** Chip bar at top filters to items linked via `grocery_list_items.recipe_id`. Recipe-linked rows show recipe name + recipe quantity inline. Non-recipe items stay minimal.
- **8C-CP4 Staple-to-grocery auto-routing.** Staple marked `running_low` with no scheduled recipe use → Could wait. Staple marked `out` → Now. `running_low` staple needed for this week's recipe → auto-promote to Now with reason "for X recipe." User can drag between tiers.
- **8C-CP5 Ingredient Detail screen.** New surface. Hero (name + type + current state + 3 action buttons: Find recipes / +Grocery / +Pantry). 4 tabs:
  - **Recipes** — section accordion (Ready right now / Your classics / Friends cooked recently / From a new cookbook / Never cooked yet). One expanded by default. Subset-search bar at top. Locked chip for the ingredient filter.
  - **Info** — nutrition, common prep methods, storage tips, alternatives, pairs-well-with. Freeform cooking aid.
  - **Brands** — read-only preview pulling from `grocery_list_items.brand_preference` history: "what you buy" and "what Mary buys" sections with last-purchased date. Full community brand discovery post-F&F.
  - **History** — personal usage stats (times cooked with, different recipes, avg days between purchases, last purchased/cooked, most-cooked recipes).
  
  Also: wires PantryScreen and StapleCell label-tap handlers that were left as Alert placeholders in 8A/8B. **Specific call sites to swap when this CP is written:**
  - `screens/PantryScreen.tsx` — `handleTapRecipes` (~line 512) and `handleTapItem` (~line 518). Currently show `Alert.alert` stubs. Replace with `navigation.navigate('IngredientDetail', { ingredientId, customName })`.
  - `screens/PantryScreen.tsx` — the `onStapleLabelTap` handler passed down to `<StaplesGrid />` (wired in 8B-CP2 with an Alert stub). Replace with the same `navigation.navigate('IngredientDetail', ...)` call, pulling `ingredientId` and `customName` from the staple object.
  
  This is one-line-swap work, folded into 8C-CP5 as the final sub-step rather than living as its own checkpoint.
- **8C-CP6 Freezer cleanout screen.** New surface accessible from Pantry. View toggle at top (Age/Category/Storage). Collapsed rows with name + qty + age chip. Tap expands 3 actions: 🍳 Find recipes / ❄️ Thaw & plan / Toss. Age chips color-coded (90d+ red, 60-89d amber, 30-59d neutral). Qualifying items: `storage_location='freezer' AND last_confirmed_at < NOW() - INTERVAL '60 days' AND discarded_at IS NULL`. Uses `last_confirmed_at` as engagement signal (unified column, no separate `last_touched_at`).
- **8C-CP7 Thawing tray.** State managed via `pantry_items.thaw_planned_for DATE` column from CP1 schema. When set, item surfaces in "Thawing · N" tray above Use soon on PantryScreen. If date arrives with no meal planned, soft reminder banner.
- **8C-CP8 Multi-select on Use soon + Freezer.** Checkbox selection on use-soon rows (min 2 selected → action bar appears); same on freezer multi-select. Both route to multi-ingredient recipe search (new reusable query). Enables "I'm at the store with cilantro AND thawed chicken — what can I make?"

**Architectural decisions:**
- **Olive oil case (canonical example):** `running_low` state + prefer-Costco tag → Could wait on "This week," also appears on Costco run list with "→ also on Costco." If state changes to `out` → auto-promotes to Now tier but stays cross-linked. Buy anywhere, both lists clear (D8-13).
- **Grocery aisle grouping (v1):** Uses existing `ingredients.typical_store_section` column. Per-store aisle override deferred post-F&F (D8-14, D8-27 supersedes original `default_aisle` proposal).
- **Custom (non-ingredient) grocery items:** `grocery_list_items.ingredient_id` becomes nullable, adds `custom_name` column. Supports duct tape, toilet paper, etc. Same pattern as `pantry_staples.custom_name`.

**Out of scope for 8C:** Drag-to-reorder within groups. Recipe substitution from grocery list. Shopping-mode view (hide filtered-out items). Per-store aisle layout. Smart thaw-time calculation. Auto-scheduling of thaw dates onto meal calendar. Push notification infrastructure (in-app banners only).

---

### 8D — Recipe-pantry matching (3-5 sessions)

**Goal:** Upgrade matching quality and make every ingredient on a recipe actionable without leaving the page.

**Checkpoints:**
- **8D-CP1 Base-ingredient normalization + P5-1 audit.** Matching uses `ingredients.base_ingredient_id` ladder. "Extra-virgin olive oil" pantry item matches "olive oil" recipe requirement, and vice versa. Touches P5-1 deferred work (base_ingredient_id wiring). **Audit pass, not full fix:** query `base_ingredient_id` coverage gaps, produce a report; if scope warrants, a separate data-backfill CC prompt spawns. Normalization logic change itself is contained.
- **8D-CP2 Staple exclusion from match calc.** Recipes don't get penalized for "salt / pepper / oil" if those are in user's staples with `state != 'out'`. `running_low` staples flagged but don't drop pantry % below threshold. `out` staples count as missing.
- **8D-CP3 Recipe tap-sheet on RecipeDetailScreen.** Existing Phase 6G IngredientsSection layout preserved 1:1 (group headers, `✓ qty unit <n>, prep` format). Fraction display from 8A-CP3 applies here. Rows become tappable. Tap opens inline tap-sheet directly below row (not overlay). Actions adapt to ingredient state:
  - Have (tracked): See more / Update qty / Which step? / Other recipes
  - Have (staple): See more / Mark low / Which step? / Other recipes
  - Low (staple): + Grocery now / Actually have / Mark out / See more
  - Missing: + Grocery now / Substitute / Add to pantry / See more
  
  "Which step?" implements the D6-18 deferred feature.
- **8D-CP4 What-can-I-cook screen.** 5 sections (Ready now / Almost ready / Uses what's expiring / Your classics / Friends cooked this week). Subset-search bar at top. Locked filter chips ("Pantry match ≥ 60%" / "Excludes staples"). Section headings clickable → drill into filtered list. Sections auto-hide when empty.
- **8D-CP5 Missing-to-grocery one-tap.** Banner CTA on recipe detail ("85% in pantry · add missing →"). Per-row "add to grocery" action on tap-sheet. Items add to "This week · Now" tier with `priority_reason='for X recipe'`. Quantity from recipe, displayed via fraction utility.

**Architectural decisions:**
- `pantryMatchingService` vs extension of `pantryService`: extend existing `pantryService`. Replace internals of `calculatePantryMatchPercentage()` and bulk variants; preserve function signatures so RecipeListScreen/RecipeDetailScreen consumers don't need updates (D8-15).
- Match strictness v1: moderate (base-ingredient normalization + staple exclusion). Loose category-level matching deferred (D8-16).

**Out of scope for 8D:** Category-level matching (any cheese / any dried pasta). Quantity awareness. Recipe substitution engine.

---

### 8E — Recipe discovery polish + natural search + low stock (3-4 sessions)

**Goal:** Discovery surfaces feel as considered as the pantry/grocery work. Add the one AI moment that earns its place.

**Checkpoints:**
- **8E-CP1 Browse recipes rebuild.** 3 zones: prominent search bar with mic + "What are you looking for?" tile grid + full scrollable list. Full list gets collapsed filter row (single line) with view toggle (Pantry %/Recent/Rating/Time) + filter pills inside the expanded view.
- **8E-CP2 Natural-language search.** New service function `parseNaturalSearch()` using Claude Haiku. System prompt includes app's structured vocabulary (cuisines, chefs/books, ingredient base-names). Returns filter object matching existing `searchService` shape. Parse shown as removable chips colored by category. Voice: OS dictation only. Graceful fallback: parse fails → existing text search.
- **8E-CP3 Locked filter chips pattern.** Applies on every filtered-subset page (What can I cook, Ingredient Detail Recipes tab, ingredient drill from stats, etc). Locked chip = small lock icon, gray background, not removable. User chips = blue, removable. Subset-search bar always applies implicit filters + user's refinement.
- **8E-CP4 Low stock indicators (#31).** Low-stock chips on recipe ingredient rows. "Low stock" filter on recipe lists. Surface on RecipeDetailScreen via tap-sheet `.low` state treatment.

**Out of scope for 8E:** Conversational refinement. Query autocomplete. App-level voice recording. Dietary-preference auto-injection.

---

## Deferred to post-F&F (explicitly scoped out)

| Item | Priority | Notes |
|------|----------|-------|
| Brand discovery full UI | 🔴 high | Data already captures during F&F via existing `grocery_list_items.brand_preference` + `size_preference`. Full community-scale discovery UI is 3-5 sessions post-launch. |
| Path B tracked-item staleness UI | 🟡 med | Data foundation laid in 8A-CP1 (`last_confirmed_at` on pantry_items, threshold_days JSONB). 1 session of UI work post-F&F. |
| Grocery per-store aisle override | 🟡 med | v1 uses global `typical_store_section`. Per-store layouts + "where you found it last time" memory post-F&F. |
| Smart cook-post depletion | 🟡 med | Opt-in banner pattern in v1. Silent-automatic once matching is proven (probably 6-8 weeks post-F&F). |
| Full accessibility audit across Phase 8 surfaces | 🟡 med | Per-prompt verification only for v1 (tap target size + labels). Full VoiceOver / focus order / contrast / reduced motion pass post-F&F. See DEFERRED_WORK. |
| Category-level pantry matching | 🟢 low | "Any cheese" / "any dried pasta" matching. Deferred to post-F&F user preference. |
| Quantity-aware matching | 🟢 low | "Recipe needs 4 eggs, I have 2" smart subtraction. v2. |
| Staples onboarding survey | 🟢 low | Likely Phase 12 (Distribution). |
| Receipt scan → pantry | 🟢 low | Post-F&F. |
| AI pantry photo recognition | 🟢 low | Moonshot. Post-F&F. |
| Recipe comments KB | 🟢 low | Deferred pre-F&F (master plan v6.0). |
| Smart thaw-time calculation | 🟢 low | "4 lb chicken = 24h." Useful but not v1. |
| Auto-schedule thawed items onto meal calendar | 🟢 low | Phase 9. |
| Push notification infrastructure | 🟢 low | In-app banners only for v1. |
| Conversational search refinement | 🟢 low | v1 single-turn only. |

---

## Architecture

### Data model additions (implemented in 8A-CP1)

```sql
-- New table: space-scoped staples (separate from pantry_items)
CREATE TABLE pantry_staples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  custom_name TEXT,
  state TEXT NOT NULL CHECK (state IN ('unknown', 'good', 'running_low', 'out')) DEFAULT 'unknown',
  last_confirmed_at TIMESTAMPTZ,
  added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staple_has_identity CHECK (ingredient_id IS NOT NULL OR custom_name IS NOT NULL),
  CONSTRAINT unique_staple_per_space UNIQUE(space_id, ingredient_id, custom_name)
);
-- RLS via space_members (accepted members read; owner+member write)

-- Path B foundation + soft delete + thaw planning on pantry_items
ALTER TABLE pantry_items ADD COLUMN last_confirmed_at TIMESTAMPTZ;
ALTER TABLE pantry_items ADD COLUMN discarded_at TIMESTAMPTZ;
ALTER TABLE pantry_items ADD COLUMN discarded_reason TEXT;
ALTER TABLE pantry_items ADD COLUMN thaw_planned_for DATE;
-- Backfill: UPDATE pantry_items SET last_confirmed_at = updated_at WHERE last_confirmed_at IS NULL;

-- Grocery tier reasons + custom items
ALTER TABLE grocery_list_items ALTER COLUMN ingredient_id DROP NOT NULL;
ALTER TABLE grocery_list_items ADD COLUMN priority_reason TEXT;
ALTER TABLE grocery_list_items ADD COLUMN custom_name TEXT;
-- CHECK: ingredient_id IS NOT NULL OR custom_name IS NOT NULL

-- Expiration fall-off config per space
ALTER TABLE space_settings ADD COLUMN expiration_falloff_days INTEGER DEFAULT 14;

-- Path B staleness thresholds (JSONB for flexibility)
ALTER TABLE user_pantry_preferences ADD COLUMN staleness_threshold_days JSONB
  DEFAULT '{"produce":7,"dairy":14,"pantry_staple":60,"freezer":180}';
```

Full SQL in `phase_8_schema_migration.sql` (ready for Tom to paste into Supabase Dashboard).

### Service layer additions

- `pantryStaplesService.ts` — new in 8B-CP1
- `pantryService.ts` — 8D upgrades to matching functions (preserve signatures)
- `groceryService.ts` — 8C tier routing, cross-list query, recipe-link chip filter, staple-to-grocery routing
- `searchService.ts` — 8E adds `parseNaturalSearch()` + chip-parsing layer
- Reusable `multiIngredientRecipeSearch()` — 8C-CP8 (serves Use soon multi-select, freezer multi-select, "X + Y" search)

### New screens / major components

- **IngredientDetailScreen** (8C-CP5) — hero + 4 tabs
- **FreezerCleanoutScreen** (8C-CP6) — view toggle + collapsed rows
- **WhatCanICookScreen** (8D-CP4) — section-organized results with locked chips
- **NaturalSearchScreen** (8E-CP2) — text input + parsed chips + results
- **StaplesGrid + StapleCell** (8B-CP2) — 2-col grid, soft color treatment, split tap zones
- Upgraded **PantryScreen** — staples grid + 3-option view toggle + thawing tray + use-soon multi-select
- Upgraded **GroceryListDetailScreen** — 3-tier structure + recipe chips + cross-list indicators
- Upgraded **RecipeDetailScreen IngredientsSection** — tappable rows + inline tap-sheet (existing layout preserved)
- Upgraded **RecipeListScreen browse mode** — search + tiles + full list with collapsed filter

### Cross-cutting patterns

**View toggle pattern.** Reusable component applied to 3+ surfaces (PantryScreen shelf: Category/Storage/Expiry; FreezerCleanoutScreen: Age/Category/Storage; RecipeListScreen full list: Pantry %/Recent/Rating/Time). User picks axis, minimal default info.

**Locked filter chip pattern.** Subset-of-recipes pages show defining filter as locked chip (lock icon, gray, not removable). User refinements appear as blue removable chips. Natural-language search refines on top of locked filters.

**Fraction display utility.** `formatQuantityDisplay(value: number, unit: string): string` — renders decimals as unicode fractions where possible (½, ⅓, ¼, ¾, ⅛, ⅜, ⅝, ⅞, ⅙, ⅚), falls back to decimal otherwise. Applied to PantryItemRow, grocery rows, StapleCell (if quantity shown), recipe tap-sheet quantity display.

**Inline tap-sheet pattern.** On recipe ingredient rows, inline-expanding sheet below tapped row (not bottom-sheet overlay). Preserves scroll position. Actions adapt to ingredient state.

---

## Decisions log

| ID | Decision | Rationale | Date | Origin |
|----|----------|-----------|------|--------|
| D8-1 | Pantry intelligence pre-F&F (originally post) | Highest viral-potential feature; expanded timeline allows it | 2026-03-17 | Tom direction |
| D8-2 | Pantry/grocery UX scope deferred to phase planning | "Just note that it needs to be done" | 2026-03-17 | Tom direction |
| D8-3 | Flex meal planning → Phase 9 | Master plan v6.0 correctly places flex planning in Phase 9 | 2026-04-22 | v6.0 refresh |
| D8-4 | NYT Cooking deferred to post-launch | Top-of-queue post-launch. Real pre-launch value not high enough given Phase 7 consumption pattern | 2026-04-22 | v6.0 refresh |
| D8-5 | Low stock indicators + pantry fraction display promoted to must-have | Both tightly related to core pantry UX; treating as nice-to-have risked rough UX | 2026-04-22 | v6.0 refresh |
| D8-6 | Restructure to 5 sub-phases (8A-8E) | Staples & depletion is its own theme; forcing into 8A or 8C muddles both. Grocery priority bumped earlier per Tom's "make grocery good first" steer | 2026-04-23 | Wireframe session |
| D8-7 | Staples as separate `pantry_staples` table, not column on `pantry_items` | Cleaner separation, supports `custom_name` for branded items (Motor City pizza, Banza) without contaminating tracked-item schema | 2026-04-23 | Wireframe session |
| D8-8 | Staples are space-scoped, not user-scoped | Matches pantry_items pattern. Household shares state | 2026-04-23 | Wireframe session |
| D8-9 | Unknown state for staples only (Path A visible), Path B data model laid | Best of both worlds — unknown UX visible for staples at F&F; schema ready for tracked-item staleness post-F&F | 2026-04-23 | Wireframe session |
| D8-10 | Cook post depletion — Option A (banner after post) | Silent default with review/undo. Fast flow, trust-based, reversible. B adds toggle fatigue. C creates time gap where pantry state is wrong | 2026-04-23 | Wireframe session |
| D8-11 | Browse recipes — Option 1 (question-led tiles) with scroll-down to full list | Addresses empty-feeling concern. Respects mood-led, search-led, scroll-led users | 2026-04-23 | Wireframe session |
| D8-12 | Grocery 3-tier (Now / Could wait / In cart) | Matches real shopping triage — acute vs deferrable vs in-progress. Uses existing priority field | 2026-04-23 | Wireframe session |
| D8-13 | Cross-list awareness (Cholula on "This week" + "Costco") | User's real case — out of a staple today but normally buys it at Costco. Indicator preserves both routes | 2026-04-23 | Wireframe session |
| D8-14 | Aisle grouping — use existing `typical_store_section`, per-store v2 post-F&F | Per-store aisle memory is richer but 3x the scope. D8-27 superseded original `default_aisle` proposal | 2026-04-23 | Wireframe session + audit |
| D8-15 | Recipe tab — keep Phase 6G layout, add tap behavior only | "Lean on and iterate on what we have currently." D6-18 deferred feature becomes concrete via inline tap-sheet | 2026-04-23 | Wireframe session |
| D8-16 | Tap-sheet is inline below row, not bottom-sheet overlay | Preserves scroll position and recipe readability | 2026-04-23 | Wireframe session |
| D8-17 | View toggle as cross-cutting pattern | User explicitly described wanting "multiple view options with minimal default info density." Applied to 3+ surfaces | 2026-04-23 | Wireframe session |
| D8-18 | Locked filter chips on subset pages | Users shouldn't have to re-specify the constraint defining the page they're on | 2026-04-23 | Wireframe session |
| D8-19 | Natural-language search via Haiku parse → existing filter engine | Graceful, transparent, cheap. 1-2 sessions. iOS dictation free. Fails open to text search. Primary scope-cut candidate | 2026-04-23 | Wireframe session |
| D8-20 | Browse filter row collapsed by default | "Eye drawn to recipes below" — reduces visual density at entry | 2026-04-23 | Wireframe session |
| D8-21 | Freezer cleanout — collapsed rows, tap to expand actions | Long list with minimal default info + view toggle. Matches "let user pick the axis" pattern | 2026-04-23 | Wireframe session |
| D8-22 | Forgotten-item threshold 60 days | Low-bar heuristic catches long tail without false positives. Configurable in settings post-F&F if needed | 2026-04-23 | Wireframe session |
| D8-23 | Brand preferences — data already captures via existing `grocery_list_items.brand_preference`; full UI post-F&F | Audit surfaced that no schema changes needed. 3-5 sessions to build discovery UI right — defer | 2026-04-23 | Wireframe session + audit |
| D8-24 | Sub-phase restructure post-audit — schema → 8A-CP1, color softening → 8B-CP2, stub-handler cleanup → 8C-CP5 | Audit surfaced that original 8A had checkpoints depending on 8B schema and 8C screens — inexecutable in order | 2026-04-23 | Audit response |
| D8-25 | Backfill `last_confirmed_at` on existing `pantry_items` using `updated_at` | Without backfill, every existing item would flag as "never confirmed" when Path B ships post-launch. `updated_at` is best-effort proxy; noisier for items touched only by bulk admin updates. Limitation flagged in migration comment. **Day-1 note for 8C-CP6 freezer cleanout:** existing freezer items with `updated_at > 60 days` will appear in the cleanout list immediately on 8C-CP6 ship — this is correct-by-spec (the feature exists to surface forgotten items) but may warrant expectation-setting in tester communications | 2026-04-23 | Audit response |
| D8-26 | Fraction display restored to Phase 8 scope (8A-CP3) | Dropped during v2.0 rewrite by oversight. Was promoted to must-have 2026-04-22. Utility function + wiring across pantry/grocery/recipe surfaces | 2026-04-23 | Audit response |
| D8-27 | Drop `default_aisle`; use existing `ingredients.typical_store_section` for grocery aisle grouping | Audit surfaced duplicate-column issue. Existing column has the data and semantics; no reason to add new | 2026-04-23 | Audit response |
| D8-28 | Drop brand schema additions; existing `grocery_list_items.brand_preference` + `size_preference` capture brand data organically | Audit surfaced that master plan delta's "brand capture during F&F" claim was unsupported by proposed schema. Existing columns cover it | 2026-04-23 | Audit response |
| D8-29 | 8B-CP3 scope swap — Add/Manage Staples UI replaces Bulk pre-populate tooling | Bulk pre-populate was Tom-specific onboarding; actual F&F need is the Add UI for testers to bring their own staples into the system. Seeding Tom+Mary moves out-of-band via direct SQL (~15 min manual). Scope decisions embedded: single-screen (not modal), ILIKE prefix search, delete + edit custom_name only, grey-out duplicates, no manual state setting | 2026-04-23 | Tom decision + Claude.ai option 2 recommendation |

---

## Deferred items (sub-phase specific)

*Populated during execution. Items deferred to later sub-phases or post-launch stay here with origin checkpoint noted.*

---

## Build plan

| Sub-phase | Checkpoints | Sessions | Status |
|-----------|-------------|----------|--------|
| 8A | CP1-CP4 | 3-4 | 🔲 Ready to start (8A-CP1 is first executable prompt of Phase 8) |
| 8B | CP1-CP4 | 4-5 | 🔲 Depends on 8A-CP1 schema |
| 8C | CP1-CP8 | 6-8 | 🔲 Depends on 8B staples |
| 8D | CP1-CP5 | 3-5 | 🔲 Depends on 8C Ingredient Detail |
| 8E | CP1-CP4 | 3-4 | 🔲 Depends on 8D matching |

**Total: 18-28 sessions.**

**Parallel admin track:** Apple Developer Program enrollment kicks off at the end of Phase 8 (as organization). Depends on LLC + D-U-N-S + Frigo domain admin track running in parallel since Phase 7P.

---

## Wireframe reference

Three HTML prototypes will live at `docs/wireframes/phase_8/` after the wireframe setup commit (not yet in repo):

- **v3** — staples split taps, 3-tier grocery, Ingredient Detail hero+tabs, cook post A/B/C options, freezer cleanout full actions
- **v4** — adds recipe ingredient overlay sheet (later replaced), grocery recipe chips + linked quantities, view toggle cross-cutting pattern, natural search tab, freezer collapsed rows, browse 3-zone layout
- **v5** — final. Unknown state for staples, softer "out" treatment with auto-sort, recipe tab uses existing Phase 6G layout + inline tap-sheet (no overlay), locked filter chip pattern on subset pages, browse collapsed filter row

CC references v5 first; v3/v4 show evolution if context needed. See `DRAFT_phase_8_wireframes_README.md` for orientation (will ship alongside wireframe commit).

---

## Claude Code prompts issued

*Populated during execution.*

First three prompts drafted (pending audit):
- `DRAFT_CC_PROMPT_1_8A-CP1_schema_foundation.md` — executes standalone schema migration SQL
- `DRAFT_CC_PROMPT_2_8B-CP1_staples_service.md` — new `pantryStaplesService.ts`
- `DRAFT_CC_PROMPT_3_8B-CP2_staples_ui.md` — StaplesGrid + StapleCell on PantryScreen

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-23 | **v2.3 — 8B-CP3 scope swap.** Add/Manage Staples UI replaces Bulk pre-populate tooling (D8-29). Sub-phase count and session estimate (18-28) unchanged — Add UI is ~1-2 sessions same as bulk tooling was. Bulk pre-populate for Tom + Mary moves out-of-band via direct SQL. |
| 2026-04-23 | **v2.2 — Second-audit polish pass.** D8-25 rationale extended to note Day-1 freezer-cleanout surge as expected (not a bug — feature exists to surface forgotten items). 8A-CP3 scope clarified: recipe tap-sheet quantity wiring is 8D-CP3's cost, not 8A's — estimate unchanged. 8C-CP5 stub-handler wiring TODO now names specific call sites (`screens/PantryScreen.tsx` `handleTapRecipes` ~line 512, `handleTapItem` ~line 518, plus the `onStapleLabelTap` handler passed to StaplesGrid in 8B-CP2). No structural changes. |
| 2026-04-23 | **v2.1 — Second-pass rewrite addressing first audit findings.** Sub-phase restructure: schema foundation moved from 8B-CP1 → 8A-CP1 (first executable prompt). Staple color softening merged into 8B-CP2. Stub-handler cleanup folded into 8C-CP5. Fraction display restored as 8A-CP3 (was dropped in v2.0 by oversight). Decision IDs D8-N added (D8-1 through D8-28). `default_aisle` dropped in favor of existing `typical_store_section` (D8-27). Brand schema additions dropped in favor of existing `grocery_list_items.brand_preference` (D8-28). `last_confirmed_at` backfill added to migration (D8-25). State naming standardized on `running_low` (DB) with "low" permitted as display-only. Session estimate 16-23 → 18-28. 8B sessions 3-4 → 4-5. 8C sessions 4-6 → 6-8. |
| 2026-04-23 | v2.0 — Full content rewrite following wireframe session. Replaced by v2.1 above. |
| 2026-04-22 | v1.0 — initial post-7 scaffold. |
| 2026-04-22 | v0.1 scaffold created via commit c6c2438. |
| 2026-03-17 | Original scaffold. |
