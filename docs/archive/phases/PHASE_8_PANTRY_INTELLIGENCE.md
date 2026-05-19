# Phase 8: Pantry Intelligence & UX Overhaul

**Started:** TBD (wireframing complete 2026-04-23, execution pending)
**Last Updated:** April 29, 2026 (v2.15)
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
| 8A | Schema foundation + standalone pantry polish ✅ | 3-4 |
| 8B | Staples & depletion ✅ | 4-5 |
| 8C | Grocery UX overhaul (PARTIAL — see 8R) | 6-8 (PARTIAL) |
| 8C-Shared | Shared grocery list infrastructure (SUPERSEDED) | 4 (PARTIAL) |
| **8R** | **Unified household needs refactor** | **4-6 weeks** |
| 8D | Recipe-pantry matching upgrade — REWRITES against 8R substrate | 3-5 |
| 8E | Recipe discovery polish + natural-language search + low-stock indicators — REWRITES against 8R substrate | 3-4 |

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
- **8B-CP4 Cook-post depletion banner. ✅ Complete (2026-04-23).** Option A per wireframe: post flow unchanged; after success, banner appears "Pantry updated · N items · Review / Undo" (5-second auto-dismiss, Frigo teal palette). Silent default when no matches. Review opens modal with per-row checkboxes for selective rollback; Undo rolls back all depletion. Staple state changes on depletion bump `last_confirmed_at`. Batch dedup: picks earliest-expiring pantry row per ingredient (non-perishables last). Zero-quantity decrements fall through to `touch_only` to avoid DB check-constraint violation. See D8-31 (LogCookSheet structural adaptation), D8-32 (recipe_ingredients table vs JSONB), D8-33 (space_id as param vs row column).

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
- **8C-CP1 Grocery 3-tier restructure. ✅ Complete (2026-04-27).** GroceryListDetailScreen restructured around `priority` field (`'needed'` = Now, `'nice_to_have'` = Could wait, `is_in_cart=true` = In cart). Aisle sub-grouping within tiers via `ingredients.typical_store_section` (49.5% populated; gracefully falls back to `family` for unpopulated rows; custom items bucket into a synthetic "Household" aisle). New `priority_reason` column renders as a subtle subtitle under item name when populated; long-press on a row opens an Alert tier-move picker (Move to Now / Move to Could wait / Cancel) which writes `priority_reason: 'manual'`. Service alignment bundled in: `lib/groceryListsService.ts` deleted its inline `GroceryList`/`GroceryListItem` types, imported canonical from `lib/types/grocery`, widened `getItemsForList` SELECT, and gained new `getUserGroceryListsWithCounts(userId)` (single batched query reduced client-side; replaces the prior N+1 `getListItemCount` pattern on GroceryListsScreen). `components/GroceryListItem.tsx` rewritten as a tier-aware presentational row. Lists screen: per-row footer replaced with tier summary line (`{n} now · {n} could wait · {n} in cart`) + red "N now" pill badge when Now-tier has items. **8C-CP1a patch-up (2026-04-27)** resolved D8-35 (store_name was vestigial pre-CP1 — DB column missing, service inserts silently dropping the field, badge never rendering) by shipping schema migration + canonical type addition + caller cleanup, and added `useFocusEffect` to GroceryListsScreen so tier counts refresh on return navigation (the only smoke-test failure on CP1). See D8-34 (typical_store_section type addition), D8-35 (store_name resolved by CP1a), D8-36 (`getUserGroceryListsWithCounts` new function), D8-37 (default tier collapse state).
- **8C-CP2 Cross-list awareness via checkoff-moment confirmation. ✅ Complete (2026-04-27).** Original spec was passive always-visible subtitle ("→ also on Costco run") + 4-hour auto-dismiss on checkoff. Both reframed during 2026-04-27 design pass: auto-dismiss cut entirely (P8-18 — same item on different lists usually represents *different* purchase intents like bulk vs immediate, so auto-dismissing one when you check the other erases that distinction); subtitle dropped in favor of a checkoff-moment prompt because the failure mode is *forgetting the bulk resupply* after checking the immediate-need entry, which a passive subtitle (becomes wallpaper) doesn't address. Final UX: when an item with `ingredient_id` is checked on (false → true) on a grocery list, system queries other active lists owned by the same user that still have the same ingredient pending; if any are found, top-floating prompt appears ("✓ {item} checked off / Also on your **{list1}, {list2}** — keep it there?") with [Keep] [Remove] buttons + 5s auto-dismiss → Keep. Tap Remove deletes pending entries from those other lists; Keep is a no-op confirmation. Custom items (`ingredient_id IS NULL`) skipped. Un-check transitions never fire. Architecture mirrors `CookDepletionBanner` (8B-CP4) — top-floating absolute-positioned, SafeAreaView+edges, auto-dismiss timer via `useEffect` + `useRef` cleanup. Implementation: new `lib/types/grocery.ts::CrossListIngredientPresence`, two new service functions (`getOtherListsContainingIngredient` filtering on user-owned + `is_active=true` + `is_in_cart=false`; `deleteItemsByIngredientFromLists` doing two-step fetch+bulk-delete with user-ownership safety), new `components/CrossListPrompt.tsx`, wiring in `GroceryListDetailScreen.handleToggleItem`. See D8-38 (canonical type addition), D8-39 (service helper addition).
- **8C-CP2a Recipe attribution junction table. ✅ Complete (2026-04-27).** Data-layer prerequisite for CP3 — discovered during CP3 design pass that `grocery_list_items.recipe_id` is single-valued per item with last-write-wins semantics on merge, which can't support CP3's wireframe (multi-recipe pills, per-recipe quantities for "for X · 2 cloves" annotations). Built `grocery_list_item_recipes` junction table (PK, FKs ON DELETE CASCADE, unique `(item_id, recipe_id)`, RLS via parent ownership, 2 indexes). Backfilled 18 legacy rows from `grocery_list_items.recipe_id IS NOT NULL` into junction with `quantity_display`/`unit_display` as best-effort per-recipe quantity. Service rewrote `addItemToList` to write junction rows on both insert and merge paths via private `upsertItemRecipeAttribution` helper (read-then-write on conflict because PostgREST doesn't expose additive `ON CONFLICT DO UPDATE` via supabase-js). Two new public functions: `getRecipesForItem(itemId)` returning junction rows joined to `recipes.title`; `getItemsWithRecipes(listId)` returning items with `recipes` field populated for batch fetch (avoids N+1 — used by CP3 in Detailed mode). `AddRecipeToListModal.handleAddToList` updated to pass `recipeId` + per-recipe quantity; legacy `notes: "From: ${recipe.title}"` attribution dropped. Legacy `grocery_list_items.recipe_id` column kept in place for backward-compat (CP3 reads junction first, falls back to legacy column for items without junction rows). Also fixed `added_from` enum bug in `lib/types/grocery.ts` (was `'template'`, actual DB constraint is `'regular'` — single-line correction inline). No new decisions; all design choices were spec-time.
- **8C-CP3 Compact/Detailed view + recipe pills + filter-by-recipe. ✅ Complete (2026-04-27).** Original spec was a chip bar at top of GroceryListDetailScreen with always-on annotations — reframed during 2026-04-27 design pass after Tom's "lots of added text" feedback on the wireframe. Final UX: per-list view-mode preference (`compact` default, `detailed` opt-in) persisted via new `grocery_lists.view_mode` column with CHECK constraint. Compact mode preserves existing CP1+CP2 layout — `priority_reason` subtitle replaced by inline staple pill (red/error) on the row's name line, eliminating subtitle row entirely while keeping urgency information. Detailed mode adds: a "For: {recipe1} · {recipe2} · ..." strip below the action buttons (recipe names tappable to filter, ordered by first-appearance in items list), and inline recipe pills on recipe-linked rows (`[Recipe]` for single-recipe items, `[N recipes]` for multi). Multi-recipe pill tap → bottom-sheet `RecipeDisambiguationSheet` with per-recipe item counts. Filter is strict (recipe association alone determines inclusion; custom items drop). While filtered, For: strip is replaced with `Showing: {recipe} ×` chip; tap × clears. Filter doesn't persist across navigation; view mode does. Toggle icon in list header is two-state SVG (3 equal lines for compact / 4 alternating-length lines tinted primary for detailed), 22×22 inside 44×44 tap target. Implementation: schema migration + `view_mode` on `GroceryList` canonical type + `viewMode` on `UpdateGroceryListParams` + new `getGroceryList(listId)` and `updateGroceryList(listId, params)` service functions + `GroceryListItem` rewritten with widened props (`viewMode`, `onRecipePillTap`) and pill rendering replacing subtitle, conservative `priority_reason.toLowerCase().includes('staple')` match for staple pills + screen widened with `viewMode`/`activeFilter`/`disambiguationState` state, `loadItems` switched to `getItemsWithRecipes` unconditionally, hydrate-from-DB on mount, four inline subcomponents (`ViewModeToggle`, `RecipeStrip`, `FilterChip`, `RecipeDisambiguationSheet`), defensive cleanup on Compact↔Detailed mode switches. See D8-40 (service function added vs inline call), D8-41 (staple pill substring match).
- **8C-CP4 Staple → grocery auto-routing + P8-19 fold-in.** ✅ Complete (2026-04-27). When a pantry staple's state transitions to `'out'` (via tap-cycle in StaplesGrid or via cookDepletion's `setStapleState` path), the new `routeStapleToGroceryList(stapleId)` service function fires automatically, gated inside both `cycleStapleState` and `setStapleState` themselves on `newState === 'out'`. Routing resolves the acting user via `supabase.auth.getUser`, picks their most-recently-updated `is_active=true` list as primary (auto-creates `'Groceries'` if none exists), and runs three-stage dedup: Stage 1 matches `source_staple_id` (exact prior route), Stage 2 falls back to `ingredient_id`/`custom_name` `ORDER BY updated_at DESC LIMIT 1` (existing manually-added items), Stage 3 inserts a new row. All matched/inserted rows get `priority='needed'`, `priority_reason='staple · out'` (always overwritten), `added_from='staple'`. Reverse direction: in `GroceryListDetailScreen.handleToggleItem`, on check-on of a row with non-null `source_staple_id`, the linked staple is restored to `'good'` and `last_confirmed_at` bumps. Un-check (correction) and delete (intent reversal) do NOT trigger restoration. Schema diff: `grocery_list_items.source_staple_id UUID NULL REFERENCES pantry_staples(id) ON DELETE SET NULL`, partial index `idx_gli_source_staple_id`, `added_from` CHECK extended with `'staple'` as fifth enum value. P8-19 inline fix: `addIngredientsToDefaultList` now forwards `recipeId`/`recipeQuantityAmount`/`recipeQuantityUnit` to each `addItemToList` call so junction rows write on the recipe→default-list path. Migration applied + smoke-tested 7 of 8 high-signal paths (Tests 1–3, 5, 6, 7, 8 pass; Test 4 cook-depletion path deferred-to-future-cook with rationale; Test 9 idempotency Stage-1 dedup covered algorithmically by Test 8; Test 10 auto-create-list deferred to F&F validation). See D8C-CP4-1 through D8C-CP4-8 in Decisions Log.
- **8C-CP4a running_low routing + pill differentiation + P8-20 fold-in.** ✅ Complete (2026-04-27). Extends 8C-CP4's staple→grocery routing to cover the `'running_low'` state. Routing trigger gates at both `cycleStapleState` and `setStapleState` widened from `newState === 'out'` to `(newState === 'out' || newState === 'running_low')`. `routeStapleToGroceryList` now derives a `routingValues` object from the live `staple.state` after its internal refetch — `'out' → priority='needed', priority_reason='staple · out'`; `'running_low' → priority='nice_to_have', priority_reason='staple · low'`. Stage 1/2/3 thread these through, so cross-state promotion (low → out) and demotion (out → low) both work as Stage-1 priority+reason rewrites on the same row, preserving `is_in_cart`. Pill render in `GroceryListItem.tsx` switched from substring-match-on-`priority_reason` (CP3's D8-41) to the structural `item.source_staple_id !== null` boolean — closes P8-20 inline. New `stapleVariantFromReason` helper extracts 'out'|'low' for the color variant; styles split into `staplePillOut` (red) + `staplePillLow` (amber via `functionalColors.warning`). cookDepletion's `cookTransition` already emits `'running_low'` for `good → running_low`, so routing fires from cookDepletion automatically without `cookDepletionService.ts` changes. Reverse direction unchanged (CP4's `handleToggleItem` truthy-check on `source_staple_id` works for both states). Smoke-tested 6 of 8 paths (Tests 1, 2, 4, 5 — must-pass — green; Test 3 promotion verified via cookDepletion banner, demotion deferred due to banner-timing UX; Tests 6/7/8 deferred-with-rationale per algorithmic equivalence). See D8C-CP4a-1 through D8C-CP4a-7 in Decisions Log.
- **8C-CP4c Pantry layout overhaul.** 🟡 SUPERSEDED by Phase 8R (2026-04-29). 🔲 Queued — ships after 8C-Shared + 8C-CP4b. Compact StaplesGrid cells (fit more staples in visible area, replacing current 8-cell-with-overflow). Inline expansion to full staples list within PantryScreen (rather than navigating to ManageStaplesScreen). Organization options for expanded view: by food type / by state (out/low/good) / both. Subsumes P8-22 (ManageStaplesScreen state cycling) if the inline expansion replaces ManageStaplesScreen as the management surface. Tom flagged additional scope items he wants in this overhaul during 2026-04-27 planning chat — to be enumerated when CP4c design pass kicks off post-8C-Shared. Estimated 2-3 sessions.
- **8C-CP5 Ingredient Detail screen.** 🟡 SUPERSEDED by Phase 8R (2026-04-29). New surface. Hero (name + type + current state + 3 action buttons: Find recipes / +Grocery / +Pantry). 4 tabs:
  - **Recipes** — section accordion (Ready right now / Your classics / Friends cooked recently / From a new cookbook / Never cooked yet). One expanded by default. Subset-search bar at top. Locked chip for the ingredient filter.
  - **Info** — nutrition, common prep methods, storage tips, alternatives, pairs-well-with. Freeform cooking aid.
  - **Brands** — read-only preview pulling from `grocery_list_items.brand_preference` history: "what you buy" and "what Mary buys" sections with last-purchased date. Full community brand discovery post-F&F.
  - **History** — personal usage stats (times cooked with, different recipes, avg days between purchases, last purchased/cooked, most-cooked recipes).
  
  Also: wires PantryScreen and StapleCell label-tap handlers that were left as Alert placeholders in 8A/8B. **Specific call sites to swap when this CP is written:**
  - `screens/PantryScreen.tsx` — `handleTapRecipes` (~line 512) and `handleTapItem` (~line 518). Currently show `Alert.alert` stubs. Replace with `navigation.navigate('IngredientDetail', { ingredientId, customName })`.
  - `screens/PantryScreen.tsx` — the `onStapleLabelTap` handler passed down to `<StaplesGrid />` (wired in 8B-CP2 with an Alert stub). Replace with the same `navigation.navigate('IngredientDetail', ...)` call, pulling `ingredientId` and `customName` from the staple object.
  
  This is one-line-swap work, folded into 8C-CP5 as the final sub-step rather than living as its own checkpoint.
- **8C-CP6 Freezer cleanout screen.** 🟡 SUPERSEDED by Phase 8R (2026-04-29). New surface accessible from Pantry. View toggle at top (Age/Category/Storage). Collapsed rows with name + qty + age chip. Tap expands 3 actions: 🍳 Find recipes / ❄️ Thaw & plan / Toss. Age chips color-coded (90d+ red, 60-89d amber, 30-59d neutral). Qualifying items: `storage_location='freezer' AND last_confirmed_at < NOW() - INTERVAL '60 days' AND discarded_at IS NULL`. Uses `last_confirmed_at` as engagement signal (unified column, no separate `last_touched_at`).
- **8C-CP7 Thawing tray.** 🟡 SUPERSEDED by Phase 8R (2026-04-29). State managed via `pantry_items.thaw_planned_for DATE` column from CP1 schema. When set, item surfaces in "Thawing · N" tray above Use soon on PantryScreen. If date arrives with no meal planned, soft reminder banner.
- **8C-CP8 Multi-select on Use soon + Freezer.** 🟡 SUPERSEDED by Phase 8R (2026-04-29). Checkbox selection on use-soon rows (min 2 selected → action bar appears); same on freezer multi-select. Both route to multi-ingredient recipe search (new reusable query). Enables "I'm at the store with cilantro AND thawed chicken — what can I make?"

**Architectural decisions:**
- **Olive oil case (canonical example):** `running_low` state + prefer-Costco tag → Could wait on "This week," also appears on Costco run list with "→ also on Costco." If state changes to `out` → auto-promotes to Now tier but stays cross-linked. Buy anywhere, both lists clear (D8-13).
- **Grocery aisle grouping (v1):** Uses existing `ingredients.typical_store_section` column. Per-store aisle override deferred post-F&F (D8-14, D8-27 supersedes original `default_aisle` proposal).
- **Custom (non-ingredient) grocery items:** `grocery_list_items.ingredient_id` becomes nullable, adds `custom_name` column. Supports duct tape, toilet paper, etc. Same pattern as `pantry_staples.custom_name`.

**Out of scope for 8C:** Drag-to-reorder within groups. Recipe substitution from grocery list. Shopping-mode view (hide filtered-out items). Per-store aisle layout. Smart thaw-time calculation. Auto-scheduling of thaw dates onto meal calendar. Push notification infrastructure (in-app banners only).

---

### 8C-Shared — Shared grocery list infrastructure

**Status:** 🟡 SUPERSEDED by Phase 8R (2026-04-29). CP1 + CP2 shipped 2026-04-28 + smoke-tested end-to-end with Tom + Mary. CP2b shipped 2026-04-28 (closes P8-24 add-to-list F&F-blocker). CP2b.1 shipped 2026-04-28 (autocomplete polish). All work in this sub-phase becomes architectural background for Phase 8R; the underlying schema (lists-as-containers + grocery_lists.space_id + RLS) will be nuked and replaced with the unified-needs filter-views model. CP3 (routing R2 + recipe attribution RA2) and CP4 (UX visibility) NOT shipped under 8C-Shared; their semantics absorbed into 8R-CP3 + 8R-CP4. See PHASE_8R_UNIFIED_NEEDS.md.

**Checkpoints:**
- **8C-Shared-CP1** Schema + RLS + migration. **✅ Complete (2026-04-28).** Adds `grocery_lists.space_id UUID NULL REFERENCES spaces(id) ON DELETE SET NULL`, `grocery_list_item_recipes.added_by UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL`, partial index `idx_grocery_lists_space WHERE space_id IS NOT NULL`. RLS rewritten on three tables — `grocery_lists` (4 policies, owner OR space-member with EXISTS pattern; DELETE stays owner-only per D8C-Shared-3 EP2), `grocery_list_items` (4 policies via parent-list reach), and **`grocery_list_item_recipes` (4 policies, parent-RLS-delegation pattern)** — the junction widening folded in via v2-revision after audit surfaced silent-break risk on CP3 recipe pills. v3-revision Section 5c dropped 9 legacy orphan policies across 3 tables surfaced during planning verification (third pre-existing naming convention beyond the two the defensive DROPs covered). 5 existing lists backfilled to "Home" space. Types extended (`GroceryList.space_id`, `GroceryListItemRecipe.added_by`, `CreateGroceryListParams.space_id?`). `tsc --noEmit` clean. See SESSION_LOG 2026-04-28 entry + Decisions Log D8C-Shared-1/2/3/6.
- **8C-Shared-CP2** Service layer + edit permissions + sharing toggle on list creation. **✅ Complete (2026-04-28; ~3hr actual vs ~2hr estimated; smoke-tested end-to-end with Tom + Mary cross-user paths).** Service-layer queries widened: `getUserGroceryLists` and `getUserGroceryListsWithCounts` dropped explicit `.eq('user_id', userId)` filter (RLS gates visibility now), gained `space:spaces(name)` joined select with client-side `space_name` flattening, return new `GroceryListWithSpace[]` (and `GroceryListWithCounts[]` re-rooted to extend it). `getOtherListsContainingIngredient` widened per D8C-Shared-5 XL2 (cross-list query absorbed into CP2 — CP3 scope narrowed). P8-16 consolidation: service-internal `CreateGroceryListParams` deleted; canonical imported throughout; `createGroceryList` resolves user via `auth.getUser()` + writes all canonical fields; CP1's `space_id?` renamed to `spaceId?` for camelCase consistency (zero callers, non-breaking); 4 call sites updated. New inline toggle/picker in `CreateGroceryListModal` (which is inline in `screens/GroceryListsScreen.tsx`, not a standalone component): defaults ON per D8C-Shared-8 CF1; multi-space picker defaults to first-created accepted space per **new D8C-Shared-CP2-3** decision; 3 picker variants (0/1/2+ spaces) with graceful degradation. End-to-end smoke test passed: Mary sees Tom's shared list, can add/check-off items; cannot see private list; cannot delete shared list (RLS-enforced). See SESSION_LOG 2026-04-28 entry "Phase 8C-Shared-CP2" + Decisions Log D8C-Shared-1/4/5/8 + new D8C-Shared-CP2-3.
- **8C-Shared-CP3** Routing + recipe attribution (narrowed). XL2 cross-list query widening (D8C-Shared-5) already landed in CP2 per scope shift. Remaining: `routeStapleToGroceryList` updated to prefer shared lists in the staple's space (R2 + member-can-route extension); members can route to shared lists they don't own. `addItemToList` populates `grocery_list_item_recipes.added_by` from `auth.uid()` on insert (RA2). Estimated ~1hr (was ~1.5hr).
- **8C-Shared-CP4** UX visibility + edit-sharing flow + delete-affordance gating. List card subtitle on GroceryListsScreen ("Shared with [space name]" / "Private") (UX3). Icon on GroceryListDetailScreen header (👥 shared / 🔒 private) (UX1). Settings affordance on list detail to toggle sharing post-creation. **Plus (added per CP2 smoke-test findings):** non-owner UX gating on list-delete (RLS already enforces server-side; UI should hide/disable the affordance for non-owners) per D8C-Shared-3 EP2 + owner-only-hard-delete; confirmation friction on item-delete (currently one-tap; should require swipe-to-confirm or similar to align UX with EP2's "members can delete items" semantic without making it accidentally easy). Estimated ~2hr (was ~1.5hr; +0.5hr for added scope).

**Architectural decisions (all set in planning chat 2026-04-27 — see D8C-Shared-1 through D8C-Shared-8 in Decisions Log):**

- **D8C-Shared-1**: SU2 model — lists user-owned with optional `space_id`. Default = shared at creation; toggleable to private.
- **D8C-Shared-2**: Migration sets all existing lists to `space_id = '7aa945ab-fb32-4197-ae11-e6dbd3392587'` ("Home" — Tom's primary space). Tom adds Mary Frigo (`7c1616f6-517c-48bc-a96b-fd950142c1d7`) to "Home" as test partner separately (one-off SQL outside migration). Tom manually privatizes 1-2 lists post-CP4 UX.
- **D8C-Shared-3**: EP2 + owner-only-hard-delete. All members can edit/archive; only owner can DELETE FROM.
- **D8C-Shared-4**: R2 + member-can-route. Routing prefers shared lists in staple's space; members can route to shared lists they don't own; private lists stay owner-routing-only.
- **D8C-Shared-5**: XL2 cross-list scope. CP2 queries owner + shared-via-membership.
- **D8C-Shared-6**: RA2. Add `grocery_list_item_recipes.added_by UUID NULL`.
- **D8C-Shared-7**: CR1. Accept last-write-wins for F&F; document concurrent-edit limitation.
- **D8C-Shared-8**: UX3 subtitle on lists screen + UX1 icon on detail header. CF1 inline toggle on list creation modal (defaults ON for sharing).

**Migration prerequisite (Tom one-off):** Add Mary Frigo (`7c1616f6-517c-48bc-a96b-fd950142c1d7`) to "Home" space (`7aa945ab-fb32-4197-ae11-e6dbd3392587`) via `INSERT INTO space_members` before 8C-Shared-CP1's migration runs. This isn't part of the migration script — it's user-data setup needed for the migration's UPDATE to produce a meaningful shared state.

**Out of scope for 8C-Shared:**
- Per-list sharing (sharing one list with a different space than another list owned by same user) — covered architecturally by SU2 but no UX for switching spaces post-creation in CP4.
- Real-time sync of edits between members (Supabase Realtime out of scope).
- Per-user attribution badges on shared list items (RA2 column added; UX deferred).
- Cross-space list sharing (a list shared with two spaces simultaneously).

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
| D8-30 | 8B-CP3a patch-up — UX polish for ManageStaplesScreen | Smoke-test of 8B-CP3 surfaced 6 UX issues (back-button safe-area, search prominence, eagerness-to-skip-to-custom-add, case-insensitive dedup missing, cross-boundary dedup missing, grid staleness on nav return). All fixed in 8B-CP3a without expanding scope. Patch-up only — no new decisions, captured here for traceability | 2026-04-23 | Smoke test findings |
| D8-31 | 8B-CP4 — wire cook-post depletion at PARENT call sites (RecipeDetailScreen, CookingScreen), not inside LogCookSheet | LogCookSheet fires an `onSubmit` callback prop; the actual `createDishPost` call happens in the parent, which is where `newPost.id` is first known. Wiring depletion inside LogCookSheet would have required either making `onSubmit` async-with-return-contract or threading banner hooks through props — both more invasive. Parents gained 3 imports + 2 hook calls + 1 fire-and-forget line each; LogCookSheet stays pure. If future screens adopt LogCookSheet, the same 4-line pattern applies (candidate for a `useCookDepletion` custom-hook refactor post-F&F if proliferation happens) | 2026-04-23 | CC discovery during 8B-CP4 Part 5 wiring |
| D8-32 | 8B-CP4 — query the `recipe_ingredients` table for depletion, NOT a JSONB column on `recipes` | Actual schema has `recipe_ingredients` as a normalized table (one row per ingredient, fields: `recipe_id`, `ingredient_id`, `quantity_amount`, `quantity_unit`, `preparation`, etc.) — not a JSONB on `recipes`. The 8B-CP4 prompt's JSONB assumption was stale; CC caught it in pre-flight (Open Q #2 STOP) before any code was written. Adaptation: `.from('recipe_ingredients').select('ingredient_id, quantity_amount, quantity_unit').eq('recipe_id', recipeId)` with null-ingredient_id rows filtered | 2026-04-23 | CC pre-flight STOP; Tom authorized Option B adaptation |
| D8-33 | 8B-CP4 — pass `spaceId` as an explicit parameter to `computeDepletion`, don't read from posts row | `posts` table has no `space_id` column (posts are user-scoped, not space-scoped per actual schema). Callers pass `useActiveSpaceId()` from SpaceContext. Matches existing `pantryService` / `pantryStaplesService` signature convention (space is always an explicit parameter in Frigo services). CC caught in pre-flight (Open Q #1 STOP). Also tripped W11 (prompts should cite schema claims or mark needs-verification — added to PROCESS_WATCHPOINTS v1.5 same session) | 2026-04-23 | CC pre-flight STOP; Tom authorized Option B adaptation |
| D8-34 | 8C-CP1 — add `typical_store_section: string \| null` to canonical `GroceryListItemWithIngredient.ingredient` join shape | 8C-CP1 prompt was self-contradictory: instructed "do not modify `lib/types/grocery.ts`" while also requiring the SELECT widening to include `typical_store_section` AND typing the return as `GroceryListItemWithIngredient`. The canonical type didn't have the field; both instructions couldn't be honored. CC made the cleanest call (additive widening of canonical type) and flagged. Note for future prompts: when telling CC "don't modify X" alongside requirements that imply X must change, that's a self-contradiction caught in self-audit | 2026-04-27 | CC navigated prompt contradiction during 8C-CP1 |
| D8-35 | 8C-CP1a — `grocery_lists.store_name` resolved by schema migration (was vestigial pre-CP1) | Pre-8C-CP1, the inline service `GroceryList` type carried `store_name?: string`, two callers wrote/read it (GroceryListsScreen create-flow + 🏪 badge render; AddRecipeToListModal badge render), but the DB column never existed — Supabase silently ignored unknown columns on insert; reads always returned undefined. Store-badge UX silently non-functional since whenever the inline type was authored. 8C-CP1 deleted the inline type and used local `& { store_name?: string }` extensions in two callers to keep compile. 8C-CP1a then shipped the actual schema column (`ALTER TABLE grocery_lists ADD COLUMN IF NOT EXISTS store_name TEXT;`), added `store_name: string \| null` to canonical `GroceryList`, and removed the local extensions. Mid-session in-scope addition: renamed service's local `CreateGroceryListParams.store_name` → `storeName` (camelCase), 3 sites touched. Larger params-shape unification (service local vs canonical) deferred to P8-16 | 2026-04-27 | 8C-CP1 surface; resolved by 8C-CP1a |
| D8-36 | 8C-CP1 — created new `getUserGroceryListsWithCounts(userId)` function (no existing function returned `GroceryListWithCounts`) | Prompt's Part 4b instructed "Choose Option A: extend whichever function returns `GroceryListWithCounts`." But no such function existed — `GroceryListsScreen` was using its own inline `GroceryList { item_count? }` shape with per-list `getListItemCount` queries (N+1). CC built `getUserGroceryListsWithCounts` per Option A's spirit: single batched query (`select('list_id, priority, is_in_cart').in('list_id', listIds)`) reduced client-side to per-list tier counts. Avoids N+1; replaces the legacy pattern wholesale on the Lists screen. `getListItemCount` remains exported but unused externally (cleanup candidate, not blocking) | 2026-04-27 | CC discovery during 8C-CP1 |
| D8-37 | 8C-CP1 — default tier collapse state: `in_cart` collapsed, `now` and `could_wait` expanded | Done items aren't the thing the user is actively shopping for; collapsing In cart by default surfaces the live triage state without scroll. Now + Could wait stay expanded so all to-shop items are visible immediately. Mechanical implementation of prompt spec — recorded for traceability | 2026-04-27 | 8C-CP1 spec |
| D8-38 | 8C-CP2 — `CrossListIngredientPresence` added to canonical `lib/types/grocery.ts` (vs inline `Array<{...}>` typing) | The type is reusable (future cross-list queries return the same shape), the canonical types file is the established home for grocery shapes, and importing a named type at call sites is more grep-friendly than inline structural types. Per CC's "CC's call" leeway in CP2 prompt Part 1c | 2026-04-27 | CC discretion during 8C-CP2 |
| D8-39 | 8C-CP2 — `deleteItemsByIngredientFromLists` helper added to service (vs looping `deleteListItem` from screen) | Keeps all Supabase calls in the service layer per project-wide convention. Two-step (fetch ids with user-ownership join check, then bulk-delete by id) is non-trivial enough to warrant encapsulation. Per CC's "CC's call" leeway in CP2 prompt Part 1b | 2026-04-27 | CC discretion during 8C-CP2 |
| D8-40 | 8C-CP3 — `getGroceryList(listId)` service function added (vs inline supabase call from screen) | Per Part 7b's "my lean: add the service function, keep the screen pure" — and the project's standing "services handle ALL Supabase calls" convention. The function reads a single row by id; trivial implementation, but keeps the boundary clean. Pairs with new `updateGroceryList(listId, params)` for the view-mode write path | 2026-04-27 | CC discretion during 8C-CP3 |
| D8-41 | 8C-CP3 — staple pill match via `priority_reason.toLowerCase().includes('staple')` (substring match) | Spec's Part 5 conservative-match guidance was loose ("staple · out OR equivalent"). Implemented as substring includes "staple" so the existing `'manual'` reason set by CP1's tier-move picker doesn't render as a staple pill. Robust to "staple", "staple · out", "staple · low", etc.; ignores manual/recipe reasons. Label extracted from second segment if formatted `staple · {label}`, else just "staple"; truncates at 12 chars | 2026-04-27 | CC discretion during 8C-CP3 |
| D8C-CP4-1 | 2026-04-27 | 8C-CP4 routing fires inside `cycleStapleState` and `setStapleState`, gated on resolved `newState === 'out'` | Internalize routing inside the existing state-change service functions rather than wrapping at the orchestrator/UI layer. Catches all three state-change call sites (StaplesGrid tap-cycle, cookDepletion `applyDepletion`, cookDepletion `rollbackDepletion`) automatically. Soft-fail with `console.error` on routing error — primary state change succeeds. |
| D8C-CP4-2 | 2026-04-27 | 8C-CP4 primary grocery list = acting user's most-recently-updated `is_active=true` list (user-scoped, not space-scoped) | Schema audit during prompt drafting surfaced that `grocery_lists` has no `space_id` column — lists are per-user, not per-space. Routing follows the actor (resolved via `supabase.auth.getUser`), not the staple's `added_by`. Multi-user shared spaces: each member's check-cycle routes to their own list. No new schema (`is_primary` rejected as scope-creep). Auto-create `'Groceries'` if zero active lists exist. |
| D8C-CP4-3 | 2026-04-27 | 8C-CP4 two-stage dedup: Stage 1 by `source_staple_id`, Stage 2 by `ingredient_id`/`custom_name` `ORDER BY updated_at DESC LIMIT 1` | Stage 1 matches prior staple-routed rows for idempotent re-promotion. Stage 2 catches user-pre-added rows (e.g., manually added "lemon" before staple went out) and backfills `source_staple_id` to link for future. Multi-match in Stage 2 picks single most-recently-updated row; leaves any duplicates alone. Defensive third branch (both `ingredient_id` and `custom_name` null) forces no-match via hardcoded zero-UUID — should never fire given staple insert-time CHECK. |
| D8C-CP4-4 | 2026-04-27 | 8C-CP4 always overwrite `priority_reason='staple · out'` on routing, even if matched row had user-set value | Preserves staple-ness as the structural fact for CP3's substring-match pill render. Trade-off: user's manual `priority_reason` (e.g., "for cocktails") is lost when a staple route promotes the row. P8-20 follow-up will switch CP3's pill render to `source_staple_id IS NOT NULL`, removing the substring brittleness — at which point the structural field carries the staple-ness durably. |
| D8C-CP4-5 | 2026-04-27 | 8C-CP4 reverse direction fires on `is_in_cart: false → true` only — does NOT fire on un-check or delete | Check-on = "I have it" → restore staple to `'good'`. Un-check = correction → no state change (user just un-did the check). Delete = "I changed my mind about buying this" → no state change (intent reversal, not have-it signal). Edge case: check → un-check sequence leaves staple at `'good'` (won't re-flip to `'out'`); user must manually re-mark via StaplesGrid. Acceptable — un-check-after-check is rare; explicit re-mark path is fast. |
| D8C-CP4-6 | 2026-04-27 | 8C-CP4 schema diff: one column + one partial index + one CHECK constraint swap | `grocery_list_items.source_staple_id UUID NULL REFERENCES pantry_staples(id) ON DELETE SET NULL` (FK soft-detach on staple delete, not cascade). Partial index `idx_gli_source_staple_id ON grocery_list_items(source_staple_id) WHERE source_staple_id IS NOT NULL` keeps the index small (only routed rows). `added_from` CHECK extended to add `'staple'` as fifth enum value (existing: `'recipe'`, `'pantry'`, `'manual'`, `'regular'`). `'pantry'` retains "manually added from pantry tab" semantic and is NOT reused for staple routing — distinct semantics, distinct enum value. |
| D8C-CP4-7 | 2026-04-27 | 8C-CP4 state scope: `'out'` only — `'running_low'` deferred to a separate small CP | Cleaner case ships first. CP3's substring-match pill (D8-41) already handles `'staple · low'` if/when added (matches on substring `'staple'`), so no rework at the pill-render layer when running_low routing lands. Running_low routing is a candidate scope for CP5; design pass to settle whether it folds with drag-to-reorder or stands alone. |
| D8C-CP4-8 | 2026-04-27 | 8C-CP4 routed-row defaults: `quantity_display=1`, `unit_display='unit'`, `added_from='staple'` | `quantity_display NOT NULL CHECK > 0` forced a non-null integer default; `1` is the minimum-viable. `unit_display NOT NULL` forced a non-empty string default; `'unit'` is the codified "intentionally unitless" choice (no prior fallback convention existed in code per grep audit; chose `'unit'` over `''` for log/query clarity — empty string reads as "missing data," `'unit'` reads as "intentionally unitless"). User can adjust quantity/unit on the grocery list before shopping. |
| D8C-CP4a-1 | 2026-04-27 | 8C-CP4a routing trigger expanded to `(out \|\| running_low)` at both `cycleStapleState` and `setStapleState` gates | Same try/catch soft-fail wrapper as CP4. No new entry points. cookDepletion's `setStapleState` calls inherit the expanded gate automatically — running_low routing fires from cook flow without cookDepletionService changes. |
| D8C-CP4a-2 | 2026-04-27 | 8C-CP4a `routeStapleToGroceryList` learns state via internal refetch (no new param) | Function already calls `getStapleById` for ingredient_id/custom_name; reading `staple.state` is free. State is the source of truth; param threading would create TOCTOU coupling. Defensive guard soft-fails on non-routable states (only `'out'` and `'running_low'` route; gates above filter `'good'`/`'unknown'`). |
| D8C-CP4a-3 | 2026-04-27 | 8C-CP4a state-derived routing values | `'out' → priority='needed', priority_reason='staple · out'`, tier=Now. `'running_low' → priority='nice_to_have', priority_reason='staple · low'`, tier=Could wait. Threaded through Stage 1 update, Stage 2 update + link, Stage 3 insert in place of CP4's hardcoded values. |
| D8C-CP4a-4 | 2026-04-27 | 8C-CP4a Stage 1 dedup handles cross-state transitions | Promotion (low → out): Stage 1 finds existing row by `source_staple_id`, rewrites priority+reason; row visually moves Could wait → Now, pill flips amber → red. Demotion (out → low, fires only via cookDepletion rollback): symmetric — moves Now → Could wait, pill flips red → amber. `is_in_cart` preserved. |
| D8C-CP4a-5 | 2026-04-27 | 8C-CP4a pill render hybrid: `source_staple_id IS NOT NULL` for boolean, `priority_reason` substring for variant | Boolean check via structural field closes P8-20 (substring brittleness). Variant via `priority_reason` substring is sufficient because routing service writes verbatim and the field is never user-modified for staple-routed rows. Going fully structural would have required JOIN to `pantry_staples.state` per row — not worth the cost. |
| D8C-CP4a-6 | 2026-04-27 | 8C-CP4a pill colors: amber (`functionalColors.warning`) for low, red (`functionalColors.error`) for out | Saturated tones for at-a-glance visual hierarchy. Background uses `warningLight`/`errorLight` if defined on theme; falls back to inline hex `#FEF3C7` / `#FEE2E2` parallel to CP3 pattern. If amber reads weirdly next to red on the same screen, follow-up color-tuning CP candidate (post-CP4a UI tweak, not blocker). |
| D8C-CP4a-7 | 2026-04-27 | 8C-CP4a manual cycle 'out' → 'good' cleanup OUT OF SCOPE | Same restriction as CP4's D8C-CP4-5. Cleanup of routed grocery rows fires on check-off only in CP4a. Manual-cycle bypassing check-off leaves the row lingering; recoverable by user delete. **Status:** captured as P8-23 deferred work; **resolved by D8C-CP4b-1 design** (CP4b will fire cleanup on transition-to-good when `is_in_cart=false`). |
| D8C-CP4b-1 | 2026-04-27 | 8C-CP4b cleanup on transition-to-good when `is_in_cart=false` (resolves P8-23) | When a routed staple transitions to `'good'` AND its routed grocery row has `is_in_cart=false`, the row is deleted from the grocery list. Symmetric with CP4's check-off-restores logic, just inverted (state-side trigger instead of grocery-side). Trigger fires on any transition to `'good'` regardless of prior state (low→good, out→good, unknown→good). Carve-out: do NOT delete if `is_in_cart=true` — preserves the user's "already in cart" record. **Status:** designed; execution paused pending 8C-Shared (cleanup semantics on shared lists need shared-list infrastructure first). |
| D8C-CP4b-2 | 2026-04-27 | 8C-CP4b E3 sticky routing via `last_routed_list_id` | Solves the misclick → re-route placement-drift problem. Schema: `pantry_staples.last_routed_list_id UUID NULL REFERENCES grocery_lists(id) ON DELETE SET NULL`. Routing checks sticky reference first; falls back to "most-recently-updated" heuristic if NULL or list `is_active=false` or list not visible to actor (RLS). Written on every successful route (Stage 1/2/3, `Q4a` from chat). Never cleared by cleanup-to-good — sticky persists across cleanup→re-route cycles. **Status:** designed; execution shape may change after 8C-Shared (shared list visibility changes the "visible to actor" predicate). |
| D8C-CP4b-3 | 2026-04-27 | 8C-CP4b B3 long-press picker on both StaplesGrid + ManageStaplesScreen | Tap-cycle preserved (current 3-stop loop: good → low → out → good). Long-press opens ActionSheet with all 4 states (good/low/out/unknown) for explicit any-direction transitions. Both screens use same gesture vocabulary for parity (P8-22 ManageStaples cycling becomes redundant if folded into B3; deferred to CP4c if pantry layout overhaul subsumes ManageStaplesScreen). |
| D8C-CP4b-4 | 2026-04-27 | 8C-CP4b cleanup is immediate (no delay) | Considered delayed cleanup (setTimeout, server sweep, undo toast); rejected for infrastructure cost vs. recovery cost asymmetry. Misclick recovery: re-cycle to low/out re-routes via Stage 3 (or Stage 1 if E3 sticky reference still points to a valid list); re-route lands on E3-sticky list rather than current heuristic. Recovery in 1-2 taps via tap-cycle or long-press picker. Cleaner mental model than time-based delay. |
| D8C-Shared-1 | 2026-04-27 | 8C-Shared sharing model: SU2 (user-owned with optional `space_id`) | Lists keep `user_id` (owner). New nullable `space_id` references `spaces(id)`. NULL = private user list (current behavior preserved). Set = shared with all accepted members of that space. Default at creation = shared (pushes household-default UX), with explicit private toggle. UX makes shared/private status visible. Considered SU1 (replace user-ownership entirely with space-ownership) and SU3 (per-list-per-user invitations) — SU2 chosen as best balance of household-default + private escape hatch. |
| D8C-Shared-2 | 2026-04-27 | 8C-Shared migration: MD-B variant — default-share-all-to-Home | Tom's Supabase shows only "Home" space (id `7aa945ab-fb32-4197-ae11-e6dbd3392587`) as accepted-member; Mary Frigo (`7c1616f6-...`) is in `user_profiles` but not yet a space member. Migration sets all existing lists to `space_id = "Home"`. Tom adds Mary to "Home" as one-off SQL prerequisite. Tom manually privatizes 1-2 lists post-UX (CP4) for sanity testing. Considered MD2 (default-private-all) — rejected because Tom's intent is to validate shared behavior with Mary. |
| D8C-Shared-3 | 2026-04-27 | 8C-Shared edit permissions: EP2 + owner-only-hard-delete | All accepted space members can add/check-off/edit-quantity/edit-name/archive shared lists. Only owner (matched on `auth.uid() = grocery_lists.user_id`) can hard-delete the list. Mitigation for accidental destruction without full role-machinery overhead. RLS on grocery_lists DELETE policy: `user_id = auth.uid()`. UPDATE policy: `auth.uid() = user_id OR (space_id IS NOT NULL AND auth.uid() IN (SELECT user_id FROM space_members WHERE space_id = grocery_lists.space_id AND status = 'accepted'))`. |
| D8C-Shared-4 | 2026-04-27 | 8C-Shared routing: R2 + member-can-route extension | `routeStapleToGroceryList` prefers shared lists in the staple's space; both members of a household route to the same list (no double-add). Members can route to shared lists they don't own (extends RLS for grocery_list_items INSERT to allow members of shared list's space). Private lists stay owner-routing-only. E3 sticky `last_routed_list_id` works correctly per-staple — single column, points to a shared list both members can hit. |
| D8C-Shared-5 | 2026-04-27 | 8C-Shared CP2 cross-list query scope: XL2 | `getOtherListsContainingIngredient` widened from owner-only (`user_id = $userId`) to owner + shared-via-membership (`user_id = $userId OR space_id IN (SELECT space_id FROM space_members WHERE user_id = $userId AND status = 'accepted')`). Catches the household case ("partner already added olive oil to shared list — keep or remove?"). |
| D8C-Shared-6 | 2026-04-27 | 8C-Shared recipe attribution: RA2 | Add `grocery_list_item_recipes.added_by UUID NULL REFERENCES user_profiles(id)` (default NULL). New rows populated from `auth.uid()` at insert time. Backfilled rows = NULL. Enables future UX (per-user contribution badges, audit trail) at low cost. |
| D8C-Shared-7 | 2026-04-27 | 8C-Shared concurrent edit policy: CR1 (last-write-wins for F&F) | Two partners editing the same list simultaneously: DB accepts last write. Duplicate-add edge case (two partners both add "bread" while offline; both writes hit DB on reconnect): manual cleanup. CR2 (server dedup) and CR3 (Realtime sync) deferred to post-launch. F&F-acceptable because failure mode is recoverable duplicates, not data loss. Document limitation in user-facing release notes if needed. |
| D8C-Shared-8 | 2026-04-27 | 8C-Shared UX visibility: UX3 subtitle + UX1 icon + CF1 inline toggle | GroceryListsScreen list cards: subtitle line "Shared with [space name]" / "Private" under list name (UX3). GroceryListDetailScreen header: 👥 (shared) / 🔒 (private) icon next to list name (UX1). CreateGroceryListModal: inline toggle "Share with [space name]" defaulting ON (CF1). Post-creation editing: settings affordance on list detail to toggle sharing. Considered CF2 (two-step) and CF3 (silent default + edit-after) — CF1 chosen for balance of household-default nudge + private escape hatch. |
| D8C-Shared-CP2-3 | 2026-04-28 | 8C-Shared-CP2 multi-space picker default: first-created accepted space | When the user has 2+ accepted spaces, the inline picker on CreateGroceryListModal defaults to the space ordered earliest by `spaces.created_at` ASC. Single-space case (Tom's F&F-period setup) renders as static label "Sharing with [name]". Zero-spaces case degrades gracefully (toggle disabled with helper text "no shared spaces available — list will be private"). Considered alphabetical-by-name (rejected — arbitrary, doesn't track household intuition) and last-used (rejected — requires tracking last-used state, schema cost). First-created chosen as the most stable + intuitive default for households (typically the "main" space is the first one created). Implementation in `screens/GroceryListsScreen.tsx` modal block, sorted via `acceptedSpaces.sort((a, b) => a.created_at < b.created_at ? -1 : 1)`. |

---

## Deferred items (sub-phase specific)

*Populated during execution. Items deferred to later sub-phases or post-launch stay here with origin checkpoint noted.*

---

## Build plan

| Sub-phase | Checkpoints | Sessions | Status |
|-----------|-------------|----------|--------|
| 8A | CP1-CP4 | 3-4 | 🔲 Ready to start (8A-CP1 is first executable prompt of Phase 8) |
| 8B | CP1-CP4 | 4-5 | ✅ Complete — all 4 CPs + 8B-CP3a patch shipped 2026-04-23 |
| 8C | CP1-CP8 | 6-8 | 🟡 PARTIALLY SUPERSEDED — CP1-CP4 + CP4a shipped 2026-04-27 ship valuable; CP4b/CP4c/CP5-CP8 unshipped CPs absorbed into 8R or thrown away depending on scope. See PHASE_8R doc. |
| 8C-Shared | CP1-CP2b.1 | 4 shipped (CP1 + CP2 + CP2b + CP2b.1) | 🟡 SUPERSEDED by 8R (2026-04-29). CP3, CP4 not shipped — semantics absorbed into 8R-CP3, 8R-CP4. See PHASE_8R_UNIFIED_NEEDS.md. |
| 8R | CP1-CP6 | 4-6 weeks | 🔲 Planning — Unified household needs refactor. Replaces lists-as-containers model with filter-views over a unified bag of supplies + needs. Pantry + grocery merge into one schema layer. F&F target slips to late July or August. Wireframes ✅ shipped 2026-04-29 (v3 single consolidated file at `docs/wireframes/phase_8r/`). See PHASE_8R_UNIFIED_NEEDS.md v0.4. |
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
| 2026-04-29 | **v2.15 — Phase 8R reframe + wireframe iteration + audit cycle complete; 8C-Shared sub-phase + remaining 8C numbered CPs SUPERSEDED.** After 8C-Shared CP1 + CP2 + CP2b + CP2b.1 shipped 2026-04-28 with full Tom + Mary smoke test, 2026-04-29 design walkthrough surfaced architectural concern with the lists-as-containers model. Tom committed to a foundational refactor: replace lists-as-containers with filter-views over a unified household-needs bag. Pantry "staples" + grocery "list items" merge into one model with status enums (supplies cycle in_stock/low/critical/out; needs cycle need/in_cart/acquired). Tags handle store/urgency/recipe/etc. dimensions; views are saved filter expressions presented as "lists" in UI. Supply transitions to `out` auto-spawn needs. Multi-user (subset) supplies via `for_user_ids UUID[]` with empty-array-means-all-current-and-future-members write semantics (per Q27/Q37 — supersedes Q17 and Q31). Multi-store membership eliminates the cross-list duplicate problem. F&F target slips from early-to-mid June to **late July or August**. Phase doc: `PHASE_8R_UNIFIED_NEEDS.md` v0.4 — 37 architectural decisions (D8R-Q1 through D8R-Q37) + 6-CP build plan. Same-day wireframe iteration completed in 3 rounds + audit pass + audit follow-up: 12 surfaces wireframed in single consolidated file (`docs/wireframes/phase_8r/phase_8r_wireframes_v3.html`); 19 new design decisions captured (Q19-Q37); P8R-D6 + D7 RESOLVED (D6 view-rule visibility; D7 search affordance F&F-prereq); P8R-D8 through D11 added. CP1 schema design is the next CC handoff. Existing 8C-Shared schema + work shipped 2026-04-28 becomes throwaway; existing pantry + grocery data nuked at 8R-CP1 (no migration). 8D + 8E push to after 8R completes. |
| 2026-04-28 | **v2.14 — 8C-Shared-CP2 complete (service widening + sharing toggle + P8-16 consolidation; smoke-tested end-to-end).** Tom + Mary cross-user smoke test verified RLS widening works as designed: Mary sees shared lists, can add/check-off items; cannot see private lists; cannot delete shared list (RLS-enforced). Three core scope items shipped: (1) service-query widening — `getUserGroceryLists` + `getUserGroceryListsWithCounts` dropped owner-only filter + gained `space:spaces(name)` join (returning new `GroceryListWithSpace`/-`WithCounts` re-rooted types); `getOtherListsContainingIngredient` widened per D8C-Shared-5 XL2 (absorbed from CP3 scope — CP3 narrows). (2) P8-16 consolidation — service-internal `CreateGroceryListParams` deleted, canonical imported, `createGroceryList` resolves user via `auth.getUser()`, 4 call sites updated; CP1's `space_id?` → `spaceId?` rename for camelCase consistency (zero callers, non-breaking). (3) Inline toggle/picker added to create-list modal (which is inline in GroceryListsScreen, not standalone) per D8C-Shared-8 CF1 + new D8C-Shared-CP2-3 (first-created picker default). Three downstream scope shifts captured: CP3 narrowed (~1.5hr → ~1hr); CP4 expanded with non-owner-delete UI gating + item-delete confirmation friction (+0.5hr); three new deferred items P8-24/25/26 logged in DEFERRED_WORK v5.16 (P8-24 = `GroceryListDetailScreen` add-to-list placeholder is F&F-blocker; P8-25/26 = create-modal polish). All living-doc edits per Edit 1-7 of CC's doc-hygiene prompt. |
| 2026-04-28 | **v2.13 — 8C-Shared-CP1 complete (schema + RLS + migration; F&F-prerequisite first CP).** Migration applied to live Supabase by Tom in planning chat 2026-04-28; all 15 DB-state verification checks pass; CC moved file to `supabase/migrations/20260428_phase_8c_shared_cp1_schema.sql` and extended `lib/types/grocery.ts` with three type additions (`GroceryList.space_id`, `GroceryListItemRecipe.added_by`, `CreateGroceryListParams.space_id?`). Two notable revisions during planning + execution: v2 audit surfaced that CP2a's `grocery_list_item_recipes` parent-ownership RLS would silently break for shared-list members in CP3 (recipe pills failing to render junction rows owned by partner) — junction RLS widening folded into CP1 scope via parent-RLS-delegation pattern (`EXISTS (SELECT 1 FROM grocery_list_items gli WHERE gli.id = ...)`, inheriting parent's RLS automatically); v3 planning verification surfaced 9 orphan legacy policies across 3 tables using a third pre-existing naming convention beyond the two defensive DROPs covered ("Users can create...", "Users can view own grocery list", "Users can [...] own grocery items", "Users can [...] junction rows for their own list items") — dropped via ad-hoc cleanup, then folded into the migration as Section 5c for replayability. 5 existing lists backfilled to "Home" space. Tom added Mary Frigo to "Home" as one-off prerequisite SQL. `tsc --noEmit` clean. 8C build-plan-table flipped to 🟡 in-progress. CP4b execution remains paused pending CP2-CP4 completion. No new deferred items. |
| 2026-04-27 | **v2.12 — 8C-CP4a complete + 8C-Shared sub-phase scoped + CP4b paused + CP4c queued.** 8C-CP4a `running_low` routing + pill differentiation + P8-20 fold-in shipped (commit `<TBD>` — Tom commits after smoke-test). Net effect: staple→grocery routing now covers both `'out'` and `'running_low'` transitions; pill renders use structural `source_staple_id` field (closes P8-20 substring brittleness); amber for low + red for out variants. **New 8C-Shared sub-phase scoped (F&F-prerequisite):** 4 CPs (~7hr) adding `grocery_lists.space_id` for optional space-sharing, default-shared list creation, edit permissions, routing/CP2/attribution updates, UX visibility. Sub-phase parallel track to 8C numbered CPs. Migration approach (D8C-Shared-2): all existing lists default-share to "Home" space. Tom adds Mary Frigo to "Home" as test-partner prerequisite (one-off SQL). 8 new shared-phase decisions D8C-Shared-1..8 capture sharing model (SU2), edit permissions (EP2 + owner-only-hard-delete), routing (R2 + member-can-route), cross-list query scope (XL2), recipe attribution (RA2), concurrent edit policy (CR1 last-write-wins), UX (UX3 subtitle + UX1 icon + CF1 inline toggle). **CP4b paused** pending 8C-Shared completion — D8C-CP4b-1..4 captured for design traceability (cleanup-on-good resolves P8-23; E3 sticky routing via `last_routed_list_id`; B3 long-press picker on both StaplesGrid + ManageStaplesScreen; immediate-no-delay cleanup with E3 enabling clean misclick recovery). **CP4c queued** for pantry layout overhaul (compact cells + inline expansion + state/category organization) — Tom flagged additional scope to enumerate at design pass. 8C build-plan row updated. |
| 2026-04-27 | **v2.11 — 8C-CP4 complete (staple → grocery auto-routing + P8-19 fold-in).** When a staple transitions to `'out'`, routing service auto-creates or promotes a row on the user's most-recently-updated active grocery list with `priority='needed'`, `priority_reason='staple · out'`, `source_staple_id` linked, `added_from='staple'`. Stage 1 dedup matches existing `source_staple_id`; Stage 2 matches by `ingredient_id`/`custom_name` and backfills the link; Stage 3 inserts new row. Reverse direction: checking off a staple-routed grocery item restores the staple to `'good'` and bumps `last_confirmed_at`. Schema diff: `source_staple_id UUID` column on `grocery_list_items` + partial index + `'staple'` added to `added_from` CHECK enum. Migration applied 2026-04-27. Smoke-tested 7 of 8 high-signal paths; Tests 4/9/10 deferred-with-rationale; Test 7 verified via SQL. P8-19 (`addIngredientsToDefaultList` recipeId-pass-through gap) folded inline as Task 1. Three new deferred items: P8-20 (CP3 pill render switch from substring-match to `source_staple_id IS NOT NULL` once CP4 is in lived use), P8-21 (cookDepletion undo cleanup of routed grocery items — narrow undo path, recoverable manually), P8-22 (state cycling missing on ManageStaplesScreen — F&F-prerequisite-candidate; testers with >8 staples currently can't cycle bottom-N from anywhere except cook-depletion). 8 new decisions D8C-CP4-1 through D8C-CP4-8 capture the architectural calls. 8C build-plan row updated: 4 of 8 numbered CPs done. CP5 next (running_low routing + drag-to-reorder candidate; scope to be settled in design pass). |
| 2026-04-27 | **v2.10 — 8C-CP3 complete (Compact/Detailed view + recipe pills + filter-by-recipe).** Largest CP of 8C so far — final UX layer for grocery. Original chip-bar spec reframed during 2026-04-27 wireframe design pass after Tom's feedback that always-on annotations were too visually heavy. Final UX: per-list view-mode (Compact default / Detailed opt-in, persisted via new `grocery_lists.view_mode` column), inline recipe pills + staple pills replacing the existing CP1 priority_reason subtitle, tappable pills filter-by-recipe, multi-recipe disambiguation via bottom-sheet modal, "Showing: {recipe} ×" filter chip while active. Implementation spans schema + canonical types + 2 new service functions (`getGroceryList`, `updateGroceryList`) + GroceryListItem rewrite + screen widening with 4 inline subcomponents. Two new decisions: D8-40 (service-function-vs-inline-call), D8-41 (staple pill substring match). Smoke-tested 7 of 8 paths verified (Path 1 staple-pill-on-grocery-row deferred — staple→grocery auto-routing arrives in CP4; CP3's pill-render code path is code-confidence-only). 8C build-plan row updated: 3 of 8 numbered CPs done. CP4 (staple auto-routing + drag-to-reorder) next — will finally close the propagation loop Tom noticed during CP3 smoke-test setup. P8-19 (`addIngredientsToDefaultList` recipeId-pass-through) stays open per CC's discretion to defer. |
| 2026-04-27 | **v2.9 — 8C-CP2a complete (recipe attribution junction table data layer).** Data-layer prerequisite for 8C-CP3 — discovered during CP3 design pass that the existing single-`recipe_id`-per-item model couldn't support CP3's wireframe requirements (multi-recipe pills, per-recipe quantities for annotations). New `grocery_list_item_recipes` junction table replaces the model. 18 legacy rows backfilled. Service rewrote `addItemToList` with junction-aware paths; new `getRecipesForItem` + `getItemsWithRecipes` functions. `AddRecipeToListModal` updated. Smoke-tested all 4 verified paths (A/B/C/D); Path E (cascade delete) skipped — FK constraint is the contract. Path C confirmed additive merge math: exactly 3.0× the recipe's 1x amounts across every ingredient after a re-add, no per-ingredient drift. Inline fix for `added_from` enum bug (`'template'` → `'regular'`). Also flagged: `addIngredientsToDefaultList` accepts a `recipeId` parameter but doesn't currently forward it to its inner `addItemToList` call — captured as P8-19. No new D8-* decisions. CP3 unblocked. |
| 2026-04-27 | **v2.8 — 8C-CP2 complete (cross-list checkoff-moment confirmation; spec redirected during design pass).** Original CP2 spec (passive always-visible subtitle + 4-hour auto-dismiss) reframed during 2026-04-27 design pass to a checkoff-moment prompt only. Reasoning: same item on different lists usually represents different purchase intents (bulk Costco vs immediate Fred Meyer for olive oil, etc.), so auto-dismissal would erase that distinction; passive subtitle becomes wallpaper and doesn't address the actual failure mode (forgetting the bulk resupply after checking the immediate entry). Implementation: new `CrossListPrompt` component modeled on `CookDepletionBanner` (top-floating, 5s auto-dismiss → Keep), service functions for cross-list query + bulk delete, wiring in `GroceryListDetailScreen.handleToggleItem` on check-on transitions only. Two new decisions: D8-38 (canonical type addition), D8-39 (service helper). One new deferred row: P8-18 (auto-dismissal opt-in design pending). PostgREST join-filter quirk noted (joined-table predicates couldn't be cleanly expressed via supabase-js builder; used `!inner` + client-side filter; RLS handles user-ownership at DB layer regardless — acceptable at typical user-list volumes). 8C build-plan row updated: 2 of 8 numbered CPs done. CP3 (recipe chips on grocery detail) next. |
| 2026-04-27 | **v2.7 — 8C-CP1b complete (data backfill).** Heuristic-SQL backfill applied to `ingredients.typical_store_section`: 314 null rows resolved via `(family, ingredient_type)` mapping (Dairy→dairy, Produce→produce, Proteins+Seafood→seafood, other Proteins→meat including plant-based, Pantry+Baking→baking, other Pantry→pantry); 2 capitalized anomalies (`Produce`, `Pantry`) normalized to lowercase. Closes P8-15. Plant-based protein subclass distinction parked as P8-17 (UX enhancement, post-F&F). 8C build plan: 1 of 8 still done (CP1b is data correction, doesn't increment CP count). |
| 2026-04-27 | **v2.6 — 8C-CP1 + 8C-CP1a complete; 8C sub-phase in progress.** 8C-CP1 (grocery 3-tier restructure + service alignment) shipped + smoke-tested 2026-04-27. 8C-CP1a (store_name schema migration + lists counts refresh on focus return) shipped same day as patch-up resolving the one smoke-test failure (counts didn't refresh on navigation back) plus D8-35 (store_name was vestigial — DB column never existed despite the field being read by two render sites). Four new decisions in Decisions Log: D8-34 (canonical type widening for `typical_store_section`), D8-35 (store_name resolved by CP1a schema migration), D8-36 (new `getUserGroceryListsWithCounts` function — no existing GroceryListWithCounts caller existed), D8-37 (tier collapse default state). Two new post-F&F items in DEFERRED_WORK: P8-15 (typical_store_section coverage — 49.5% null), P8-16 (CreateGroceryListParams shape unification). 8C build-plan row flipped to 🟡 In progress (1 of 8 CPs done; CP2 cross-list awareness queued next). |
| 2026-04-23 | **v2.5 — 8B-CP4 complete; 8B sub-phase complete.** 8B-CP4 (cook-post depletion banner) shipped + smoke-tested 2026-04-23 with 4 in-session fixes (banner color/position/timing, zero-qty check-constraint workaround, per-ingredient batch dedup). 8B overall now ✅ Complete (all 4 checkpoints + 8B-CP3a patch). Three new decisions recorded (D8-31/32/33) covering structural adaptations required by actual codebase shape: LogCookSheet as callback fan-out not post-creator, recipe_ingredients as normalized table not JSONB, posts user-scoped not space-scoped. Two post-F&F items added to DEFERRED_WORK: P8-13 (cross-unit reconciliation) + P8-14 (soft-delete on zero-quantity depletion). |
| 2026-04-23 | **v2.4 — 8B-CP3a patch-up log.** D8-30 records the 6-fix UX patch-up applied to 8B-CP3 (back-button safe-area, search prominence, collapsed custom-add, case-insensitive + cross-boundary dedup, grid focus-refresh). No scope change. |
| 2026-04-23 | **v2.3 — 8B-CP3 scope swap.** Add/Manage Staples UI replaces Bulk pre-populate tooling (D8-29). Sub-phase count and session estimate (18-28) unchanged — Add UI is ~1-2 sessions same as bulk tooling was. Bulk pre-populate for Tom + Mary moves out-of-band via direct SQL. |
| 2026-04-23 | **v2.2 — Second-audit polish pass.** D8-25 rationale extended to note Day-1 freezer-cleanout surge as expected (not a bug — feature exists to surface forgotten items). 8A-CP3 scope clarified: recipe tap-sheet quantity wiring is 8D-CP3's cost, not 8A's — estimate unchanged. 8C-CP5 stub-handler wiring TODO now names specific call sites (`screens/PantryScreen.tsx` `handleTapRecipes` ~line 512, `handleTapItem` ~line 518, plus the `onStapleLabelTap` handler passed to StaplesGrid in 8B-CP2). No structural changes. |
| 2026-04-23 | **v2.1 — Second-pass rewrite addressing first audit findings.** Sub-phase restructure: schema foundation moved from 8B-CP1 → 8A-CP1 (first executable prompt). Staple color softening merged into 8B-CP2. Stub-handler cleanup folded into 8C-CP5. Fraction display restored as 8A-CP3 (was dropped in v2.0 by oversight). Decision IDs D8-N added (D8-1 through D8-28). `default_aisle` dropped in favor of existing `typical_store_section` (D8-27). Brand schema additions dropped in favor of existing `grocery_list_items.brand_preference` (D8-28). `last_confirmed_at` backfill added to migration (D8-25). State naming standardized on `running_low` (DB) with "low" permitted as display-only. Session estimate 16-23 → 18-28. 8B sessions 3-4 → 4-5. 8C sessions 4-6 → 6-8. |
| 2026-04-23 | v2.0 — Full content rewrite following wireframe session. Replaced by v2.1 above. |
| 2026-04-22 | v1.0 — initial post-7 scaffold. |
| 2026-04-22 | v0.1 scaffold created via commit c6c2438. |
| 2026-03-17 | Original scaffold. |
