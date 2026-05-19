# Phase 8 — Pantry & Grocery (Household Needs)

**Status:** ✅ Complete pending cleanup pass — 8R closeout (CP1 → CP6e shipped, smoke clean 2026-05-15) + 8D (CP1 → CP4 shipped 2026-05-19, CP5 bundled into CP3). 8E retired and merged into Phase 11 (2026-05-19). Remaining: 8D cleanup pass (console.warn removal, T29 smoke realignment, PHASE_8D_PLANNING refresh, PK_CODE_SNAPSHOTS revert+refresh).
**Last Updated:** May 19, 2026
**Merged doc version:** 1.0 — merged from `PHASE_8_PANTRY_INTELLIGENCE.md` v2.15 + `PHASE_8R_UNIFIED_NEEDS.md` v0.7
**Master Plan:** See `FF_LAUNCH_MASTER_PLAN.md` for full F&F context

---

## Why this phase exists

Phase 8 set out to turn pantry from static inventory into an active assistant ("What can I cook with what I have?") and to make pantry, grocery, and recipe-pantry integration feel like a coherent system rather than disconnected features — the single most-flagged UX weak spot in pre-F&F testing.

**Why this is Phase 8:** Most complex remaining domain. Recipe-pantry matching depends on Phase 5's ingredient architecture. Staples + depletion + freezer cleanout are compound-utility features that need weeks of real use to validate — F&F is the right moment. Flex meal planning moved to Phase 9; NYT Cooking deferred to post-launch.

**Reframed mid-flight by 8R (2026-04-29).** Phase 8 executed 8A (schema foundation + pantry polish), 8B (staples & depletion), 8C (grocery UX overhaul, partial), and 8C-Shared (shared grocery list infrastructure) within a "lists-as-containers" model. 8C-Shared shipped CP1 + CP2 + CP2b + CP2b.1 on 2026-04-28; end-to-end smoke test (Tom + Mary) passed all paths. During the CP3 design pass on 2026-04-29, Tom raised the question of how recipe ingredients route to lists and whether the underlying lists-as-containers model was the right architecture going forward.

After a deep walkthrough, the conclusion was that **the model should be re-architected to filter-views over a unified "needs" bag**, with pantry staples generalized to "supplies" within the same model. The existing lists-as-containers concept doesn't cleanly express:
- Items belonging to multiple shopping contexts simultaneously (olive oil on Costco AND Groceries)
- The supply-vs-transient-need distinction Tom and Mary already operate on (Costco list = supplies that toggle in stock/out of stock; Groceries list = transient needs that lifecycle)
- Future store-aware reordering ("I'm at Fred Meyer, reorder by that store's aisle layout")
- Status as a first-class data dimension (urgency, storage location)

The core architectural insight that emerged: **pantry and grocery are unified surfaces in the user's mental model**. A supply low → spawns a need. A need acquired → replenishes a supply. They are the same lifecycle viewed from different sides. The separate `pantry_staples` + `grocery_lists` schemas treated them as separate domains; the unified model collapses them.

Phase 8R committed to this reframe and is, as of 2026-05-15, functionally complete (CP1 → CP6e shipped, smoke validation passed clean). The remaining sub-phases — 8D (recipe-pantry matching) and 8E (recipe discovery polish) — were pushed to after 8R and will be rebuilt against the new unified substrate. This document is the full Phase 8 arc: the original pantry/grocery work, the 8R refactor that replaced its grocery continuation, and what remains.

---

## Canonical terminology

**State enum (DB authoritative, 8A–8C era):** `unknown | good | running_low | out`. The DB stores `running_low`. UI display may render it as "low" for brevity; code and SQL everywhere else use `running_low`.

**Last touched / last confirmed:** Unified under `last_confirmed_at` column on both `pantry_items` and `pantry_staples`. Bumped on any user-initiated state change (quantity edit, expiration edit, state cycle, cook-post depletion credit, manual "still have this" action). Serves both "has the user engaged with this recently" (Path B staleness) and "was this touched in the last N days" (freezer cleanout detection).

**After 8R-CP1, the term "staples" is preserved in user-facing language but the underlying model is the unified supplies + needs schema.** A "supply" is a household item kept in ongoing stock (cycles `in_stock → low → critical → out → in_stock`); a "need" is a transient household need (cycles `need → in_cart → acquired`). The user-facing "staples" / "lists" vocabulary survives; the data model beneath it is the unified bag. See the 8R "Architectural concept" section below.

**Wireframe references:** Phase 8 (8A–8C) HTML prototypes live at `docs/wireframes/phase_8/`; Phase 8R prototypes at `docs/wireframes/phase_8r/`. See the "Wireframe reference" section.

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
- **8R-CP1 schema as foundation prerequisite for 8D/8E.** Because 8R-CP1 drops `pantry_items` / `pantry_staples` / `grocery_lists` and replaces them with `supplies` / `needs` / `tags` / `views` / `supply_lots`, the 8D matching upgrade and the 8E discovery/search rewrite both depend on the 8R schema being in place. 8D and 8E rewrite against the new substrate.

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

### Sub-phase overview (final, post-refactor)

| Sub | Scope | Sessions | Status |
|-----|-------|----------|--------|
| 8A | Schema foundation + pantry polish | 3-4 | ✅ Complete |
| 8B | Staples & depletion | 4-5 | ✅ Complete |
| 8C | Grocery UX overhaul | 6-8 | 🟡 Partially shipped — CP1-CP4 + CP4a ship valuable; CP4b/CP4c/CP5-CP8 superseded by 8R |
| 8C-Shared | Shared grocery list infrastructure | 4 | 🟡 PARTIALLY SUPERSEDED by 8R — CP1+CP2+CP2b+CP2b.1 shipped (architectural background); CP3+CP4 absorbed into 8R-CP3/CP4 |
| **8R** | **Unified household needs refactor** | **~6 weeks actual** | 🟢 Mid-closeout — CP1 through CP6e shipped; smoke clean 2026-05-15 |
| 8D | Recipe-pantry matching | 3-5 | ✅ Complete pending cleanup pass — CP1 (matcher primitive) + CP1.5 (catalog backfill) + CP2 (4-level matcher) + CP3 (recipe tap-sheet + match % banner, CP5 bundled) + CP4 (What-can-I-cook screen) shipped 2026-05-19. Cleanup: console.warn removal in IngredientTapSheet, T29 smoke realignment, PHASE_8D_PLANNING refresh, PK_CODE_SNAPSHOTS revert+refresh. |
| 8E | Recipe discovery polish | — | **MERGED → Phase 11** (2026-05-19). F&F-relevant CPs (CP1 Browse rebuild, CP3 Locked filter chips, CP4 Low stock) absorbed into Phase 11 must-haves; CP2 Natural-language search stays post-launch. |

**Original Phase 8 estimate:** 18-28 sessions (revised up from 16-23 after per-checkpoint re-estimation in 8B and 8C). The 8R refactor replaced ~3-4 weeks of remaining Phase 8 scope and added ~6 weeks of actual work.

---

## Sub-phase details (chronological, preserving full history)

### 8A — Schema foundation + pantry polish (3-4 sessions) ✅

**Goal:** Lay the schema foundation for all downstream Phase 8 work, plus ship pantry polish items that don't depend on later sub-phases.

**Checkpoints:**
- **8A-CP1 Schema foundation migration.** Single atomic SQL migration creating `pantry_staples` table (space-scoped, state enum CHECK, `custom_name` support for branded items, `last_confirmed_at`, `added_by`, RLS matching `pantry_items` pattern via `space_members`); adds `last_confirmed_at` + `discarded_at` + `discarded_reason` + `thaw_planned_for` to `pantry_items`; adds `priority_reason` + `custom_name` + nullable `ingredient_id` + CHECK constraint to `grocery_list_items`; adds `expiration_falloff_days` to `space_settings`; adds `staleness_threshold_days` JSONB to `user_pantry_preferences`; backfills `last_confirmed_at = updated_at` on existing `pantry_items` rows. TypeScript types updated in same checkpoint. **Executes first in Phase 8 — unblocks everything else.**
- **8A-CP2 View toggle on PantryScreen.** Extends the current 2-option Family/Storage toggle with a third option (Expiry). Same toggle infrastructure; new sort mode that orders items by expiration date, no grouping. Reusable view-toggle component structure (applied to 3+ surfaces across Phase 8).
- **8A-CP3 Fraction display utility + wiring.** Restored from v1.0 scope. Utility function converting decimal quantities to unicode fractions (½, ⅓, ¼, ¾, ⅛, ⅜, ⅝, ⅞, ⅙, ⅚). Falls back to decimal for unsupported values. Wired into `PantryItemRow`, grocery list rows, and `StapleCell` in this checkpoint (~0.5 session). **Recipe tap-sheet quantity rendering is wired as part of 8D-CP3's scope, not 8A-CP3** — it's a few lines inside the tap-sheet work, not a separate cost center. 8A-CP3's estimate covers utility + pantry/grocery/staple surfaces only.
- **8A-CP4 Auto-expiry fall-off job.** Uses `discarded_at` column from CP1. Background query run on app open (or scheduled edge function post-F&F) that sets `discarded_at = NOW()` and `discarded_reason = 'expired'` for non-freezer items where `expiration_date < NOW() - INTERVAL '{expiration_falloff_days}'`. Configurable per space. Queries across app updated to filter `WHERE discarded_at IS NULL` for active items.

**Out of scope for 8A:** Staples table + UI (8B). New Ingredient Detail screen (8C). Any grocery work beyond schema additions (8C). Cook-post depletion UI (8B).

**Dependencies:** None upstream. CP1 unblocks CP4 within 8A. CP2 and CP3 are independent polish.

---

### 8B — Staples & depletion (4-5 sessions) ✅

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

### 8C — Grocery UX overhaul + Ingredient Detail + Freezer cleanout (6-8 sessions) 🟡 PARTIALLY SUPERSEDED

**Goal:** Grocery list becomes triage-driven. Ingredient Detail becomes a real surface. Freezer cleanout introduces the async-planning pattern.

**Status note:** CP1 through CP4a shipped 2026-04-27 and are valuable, working code. CP4b/CP4c and CP5-CP8 were superseded by Phase 8R (2026-04-29) — they were never shipped. Their content is preserved below with status flags because the decision-trace value is real.

**Checkpoints:**
- **8C-CP1 Grocery 3-tier restructure. ✅ Complete (2026-04-27).** GroceryListDetailScreen restructured around `priority` field (`'needed'` = Now, `'nice_to_have'` = Could wait, `is_in_cart=true` = In cart). Aisle sub-grouping within tiers via `ingredients.typical_store_section` (49.5% populated; gracefully falls back to `family` for unpopulated rows; custom items bucket into a synthetic "Household" aisle). New `priority_reason` column renders as a subtle subtitle under item name when populated; long-press on a row opens an Alert tier-move picker (Move to Now / Move to Could wait / Cancel) which writes `priority_reason: 'manual'`. Service alignment bundled in: `lib/groceryListsService.ts` deleted its inline `GroceryList`/`GroceryListItem` types, imported canonical from `lib/types/grocery`, widened `getItemsForList` SELECT, and gained new `getUserGroceryListsWithCounts(userId)` (single batched query reduced client-side; replaces the prior N+1 `getListItemCount` pattern on GroceryListsScreen). `components/GroceryListItem.tsx` rewritten as a tier-aware presentational row. Lists screen: per-row footer replaced with tier summary line (`{n} now · {n} could wait · {n} in cart`) + red "N now" pill badge when Now-tier has items. **8C-CP1a patch-up (2026-04-27)** resolved D8-35 (store_name was vestigial pre-CP1 — DB column missing, service inserts silently dropping the field, badge never rendering) by shipping schema migration + canonical type addition + caller cleanup, and added `useFocusEffect` to GroceryListsScreen so tier counts refresh on return navigation (the only smoke-test failure on CP1). See D8-34 (typical_store_section type addition), D8-35 (store_name resolved by CP1a), D8-36 (`getUserGroceryListsWithCounts` new function), D8-37 (default tier collapse state).
- **8C-CP2 Cross-list awareness via checkoff-moment confirmation. ✅ Complete (2026-04-27).** Original spec was passive always-visible subtitle ("→ also on Costco run") + 4-hour auto-dismiss on checkoff. Both reframed during 2026-04-27 design pass: auto-dismiss cut entirely (P8-18 — same item on different lists usually represents *different* purchase intents like bulk vs immediate, so auto-dismissing one when you check the other erases that distinction); subtitle dropped in favor of a checkoff-moment prompt because the failure mode is *forgetting the bulk resupply* after checking the immediate-need entry, which a passive subtitle (becomes wallpaper) doesn't address. Final UX: when an item with `ingredient_id` is checked on (false → true) on a grocery list, system queries other active lists owned by the same user that still have the same ingredient pending; if any are found, top-floating prompt appears ("✓ {item} checked off / Also on your **{list1}, {list2}** — keep it there?") with [Keep] [Remove] buttons + 5s auto-dismiss → Keep. Tap Remove deletes pending entries from those other lists; Keep is a no-op confirmation. Custom items (`ingredient_id IS NULL`) skipped. Un-check transitions never fire. Architecture mirrors `CookDepletionBanner` (8B-CP4) — top-floating absolute-positioned, SafeAreaView+edges, auto-dismiss timer via `useEffect` + `useRef` cleanup. Implementation: new `lib/types/grocery.ts::CrossListIngredientPresence`, two new service functions (`getOtherListsContainingIngredient` filtering on user-owned + `is_active=true` + `is_in_cart=false`; `deleteItemsByIngredientFromLists` doing two-step fetch+bulk-delete with user-ownership safety), new `components/CrossListPrompt.tsx`, wiring in `GroceryListDetailScreen.handleToggleItem`. See D8-38 (canonical type addition), D8-39 (service helper addition).
- **8C-CP2a Recipe attribution junction table. ✅ Complete (2026-04-27).** Data-layer prerequisite for CP3 — discovered during CP3 design pass that `grocery_list_items.recipe_id` is single-valued per item with last-write-wins semantics on merge, which can't support CP3's wireframe (multi-recipe pills, per-recipe quantities for "for X · 2 cloves" annotations). Built `grocery_list_item_recipes` junction table (PK, FKs ON DELETE CASCADE, unique `(item_id, recipe_id)`, RLS via parent ownership, 2 indexes). Backfilled 18 legacy rows from `grocery_list_items.recipe_id IS NOT NULL` into junction with `quantity_display`/`unit_display` as best-effort per-recipe quantity. Service rewrote `addItemToList` to write junction rows on both insert and merge paths via private `upsertItemRecipeAttribution` helper (read-then-write on conflict because PostgREST doesn't expose additive `ON CONFLICT DO UPDATE` via supabase-js). Two new public functions: `getRecipesForItem(itemId)` returning junction rows joined to `recipes.title`; `getItemsWithRecipes(listId)` returning items with `recipes` field populated for batch fetch (avoids N+1 — used by CP3 in Detailed mode). `AddRecipeToListModal.handleAddToList` updated to pass `recipeId` + per-recipe quantity; legacy `notes: "From: ${recipe.title}"` attribution dropped. Legacy `grocery_list_items.recipe_id` column kept in place for backward-compat (CP3 reads junction first, falls back to legacy column for items without junction rows). Also fixed `added_from` enum bug in `lib/types/grocery.ts` (was `'template'`, actual DB constraint is `'regular'` — single-line correction inline). No new decisions; all design choices were spec-time.
- **8C-CP3 Compact/Detailed view + recipe pills + filter-by-recipe. ✅ Complete (2026-04-27).** Original spec was a chip bar at top of GroceryListDetailScreen with always-on annotations — reframed during 2026-04-27 design pass after Tom's "lots of added text" feedback on the wireframe. Final UX: per-list view-mode preference (`compact` default, `detailed` opt-in) persisted via new `grocery_lists.view_mode` column with CHECK constraint. Compact mode preserves existing CP1+CP2 layout — `priority_reason` subtitle replaced by inline staple pill (red/error) on the row's name line, eliminating subtitle row entirely while keeping urgency information. Detailed mode adds: a "For: {recipe1} · {recipe2} · ..." strip below the action buttons (recipe names tappable to filter, ordered by first-appearance in items list), and inline recipe pills on recipe-linked rows (`[Recipe]` for single-recipe items, `[N recipes]` for multi). Multi-recipe pill tap → bottom-sheet `RecipeDisambiguationSheet` with per-recipe item counts. Filter is strict (recipe association alone determines inclusion; custom items drop). While filtered, For: strip is replaced with `Showing: {recipe} ×` chip; tap × clears. Filter doesn't persist across navigation; view mode does. Toggle icon in list header is two-state SVG (3 equal lines for compact / 4 alternating-length lines tinted primary for detailed), 22×22 inside 44×44 tap target. Implementation: schema migration + `view_mode` on `GroceryList` canonical type + `viewMode` on `UpdateGroceryListParams` + new `getGroceryList(listId)` and `updateGroceryList(listId, params)` service functions + `GroceryListItem` rewritten with widened props (`viewMode`, `onRecipePillTap`) and pill rendering replacing subtitle, conservative `priority_reason.toLowerCase().includes('staple')` match for staple pills + screen widened with `viewMode`/`activeFilter`/`disambiguationState` state, `loadItems` switched to `getItemsWithRecipes` unconditionally, hydrate-from-DB on mount, four inline subcomponents (`ViewModeToggle`, `RecipeStrip`, `FilterChip`, `RecipeDisambiguationSheet`), defensive cleanup on Compact↔Detailed mode switches. See D8-40 (service function added vs inline call), D8-41 (staple pill substring match).
- **8C-CP4 Staple → grocery auto-routing + P8-19 fold-in.** ✅ Complete (2026-04-27). When a pantry staple's state transitions to `'out'` (via tap-cycle in StaplesGrid or via cookDepletion's `setStapleState` path), the new `routeStapleToGroceryList(stapleId)` service function fires automatically, gated inside both `cycleStapleState` and `setStapleState` themselves on `newState === 'out'`. Routing resolves the acting user via `supabase.auth.getUser`, picks their most-recently-updated `is_active=true` list as primary (auto-creates `'Groceries'` if none exists), and runs three-stage dedup: Stage 1 matches `source_staple_id` (exact prior route), Stage 2 falls back to `ingredient_id`/`custom_name` `ORDER BY updated_at DESC LIMIT 1` (existing manually-added items), Stage 3 inserts a new row. All matched/inserted rows get `priority='needed'`, `priority_reason='staple · out'` (always overwritten), `added_from='staple'`. Reverse direction: in `GroceryListDetailScreen.handleToggleItem`, on check-on of a row with non-null `source_staple_id`, the linked staple is restored to `'good'` and `last_confirmed_at` bumps. Un-check (correction) and delete (intent reversal) do NOT trigger restoration. Schema diff: `grocery_list_items.source_staple_id UUID NULL REFERENCES pantry_staples(id) ON DELETE SET NULL`, partial index `idx_gli_source_staple_id`, `added_from` CHECK extended with `'staple'` as fifth enum value. P8-19 inline fix: `addIngredientsToDefaultList` now forwards `recipeId`/`recipeQuantityAmount`/`recipeQuantityUnit` to each `addItemToList` call so junction rows write on the recipe→default-list path. Migration applied + smoke-tested 7 of 8 high-signal paths (Tests 1–3, 5, 6, 7, 8 pass; Test 4 cook-depletion path deferred-to-future-cook with rationale; Test 9 idempotency Stage-1 dedup covered algorithmically by Test 8; Test 10 auto-create-list deferred to F&F validation). See D8C-CP4-1 through D8C-CP4-8 in Decisions Log.
- **8C-CP4a running_low routing + pill differentiation + P8-20 fold-in.** ✅ Complete (2026-04-27). Extends 8C-CP4's staple→grocery routing to cover the `'running_low'` state. Routing trigger gates at both `cycleStapleState` and `setStapleState` widened from `newState === 'out'` to `(newState === 'out' || newState === 'running_low')`. `routeStapleToGroceryList` now derives a `routingValues` object from the live `staple.state` after its internal refetch — `'out' → priority='needed', priority_reason='staple · out'`; `'running_low' → priority='nice_to_have', priority_reason='staple · low'`. Stage 1/2/3 thread these through, so cross-state promotion (low → out) and demotion (out → low) both work as Stage-1 priority+reason rewrites on the same row, preserving `is_in_cart`. Pill render in `GroceryListItem.tsx` switched from substring-match-on-`priority_reason` (CP3's D8-41) to the structural `item.source_staple_id !== null` boolean — closes P8-20 inline. New `stapleVariantFromReason` helper extracts 'out'|'low' for the color variant; styles split into `staplePillOut` (red) + `staplePillLow` (amber via `functionalColors.warning`). cookDepletion's `cookTransition` already emits `'running_low'` for `good → running_low`, so routing fires from cookDepletion automatically without `cookDepletionService.ts` changes. Reverse direction unchanged (CP4's `handleToggleItem` truthy-check on `source_staple_id` works for both states). Smoke-tested 6 of 8 paths (Tests 1, 2, 4, 5 — must-pass — green; Test 3 promotion verified via cookDepletion banner, demotion deferred due to banner-timing UX; Tests 6/7/8 deferred-with-rationale per algorithmic equivalence). See D8C-CP4a-1 through D8C-CP4a-7 in Decisions Log.
- **8C-CP4b Cleanup-on-good + sticky routing + long-press picker.** 🟡 SUPERSEDED by Phase 8R (2026-04-29). Designed but never shipped — execution was paused pending 8C-Shared. See D8C-CP4b-1 through D8C-CP4b-4 in the Decisions Log for the captured design (cleanup-on-good resolves P8-23; E3 sticky routing via `last_routed_list_id`; B3 long-press picker on both StaplesGrid + ManageStaplesScreen; immediate-no-delay cleanup). Semantics absorbed into the 8R model.
- **8C-CP4c Pantry layout overhaul.** 🟡 SUPERSEDED by Phase 8R (2026-04-29). 🔲 Queued — was to ship after 8C-Shared + 8C-CP4b. Compact StaplesGrid cells (fit more staples in visible area, replacing current 8-cell-with-overflow). Inline expansion to full staples list within PantryScreen (rather than navigating to ManageStaplesScreen). Organization options for expanded view: by food type / by state (out/low/good) / both. Subsumes P8-22 (ManageStaplesScreen state cycling) if the inline expansion replaces ManageStaplesScreen as the management surface. Tom flagged additional scope items he wants in this overhaul during 2026-04-27 planning chat — to be enumerated when CP4c design pass kicks off post-8C-Shared. Estimated 2-3 sessions.
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

**Status:** 🟡 SUPERSEDED by Phase 8R (2026-04-29). CP1 + CP2 shipped 2026-04-28 + smoke-tested end-to-end with Tom + Mary. CP2b shipped 2026-04-28 (closes P8-24 add-to-list F&F-blocker). CP2b.1 shipped 2026-04-28 (autocomplete polish). All work in this sub-phase becomes architectural background for Phase 8R; the underlying schema (lists-as-containers + grocery_lists.space_id + RLS) was nuked and replaced with the unified-needs filter-views model. CP3 (routing R2 + recipe attribution RA2) and CP4 (UX visibility) NOT shipped under 8C-Shared; their semantics absorbed into 8R-CP3 + 8R-CP4.

**Checkpoints:**
- **8C-Shared-CP1** Schema + RLS + migration. **✅ Complete (2026-04-28).** Adds `grocery_lists.space_id UUID NULL REFERENCES spaces(id) ON DELETE SET NULL`, `grocery_list_item_recipes.added_by UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL`, partial index `idx_grocery_lists_space WHERE space_id IS NOT NULL`. RLS rewritten on three tables — `grocery_lists` (4 policies, owner OR space-member with EXISTS pattern; DELETE stays owner-only per D8C-Shared-3 EP2), `grocery_list_items` (4 policies via parent-list reach), and **`grocery_list_item_recipes` (4 policies, parent-RLS-delegation pattern)** — the junction widening folded in via v2-revision after audit surfaced silent-break risk on CP3 recipe pills. v3-revision Section 5c dropped 9 legacy orphan policies across 3 tables surfaced during planning verification (third pre-existing naming convention beyond the two the defensive DROPs covered). 5 existing lists backfilled to "Home" space. Types extended (`GroceryList.space_id`, `GroceryListItemRecipe.added_by`, `CreateGroceryListParams.space_id?`). `tsc --noEmit` clean. See SESSION_LOG 2026-04-28 entry + Decisions Log D8C-Shared-1/2/3/6.
- **8C-Shared-CP2** Service layer + edit permissions + sharing toggle on list creation. **✅ Complete (2026-04-28; ~3hr actual vs ~2hr estimated; smoke-tested end-to-end with Tom + Mary cross-user paths).** Service-layer queries widened: `getUserGroceryLists` and `getUserGroceryListsWithCounts` dropped explicit `.eq('user_id', userId)` filter (RLS gates visibility now), gained `space:spaces(name)` joined select with client-side `space_name` flattening, return new `GroceryListWithSpace[]` (and `GroceryListWithCounts[]` re-rooted to extend it). `getOtherListsContainingIngredient` widened per D8C-Shared-5 XL2 (cross-list query absorbed into CP2 — CP3 scope narrowed). P8-16 consolidation: service-internal `CreateGroceryListParams` deleted; canonical imported throughout; `createGroceryList` resolves user via `auth.getUser()` + writes all canonical fields; CP1's `space_id?` renamed to `spaceId?` for camelCase consistency (zero callers, non-breaking); 4 call sites updated. New inline toggle/picker in `CreateGroceryListModal` (which is inline in `screens/GroceryListsScreen.tsx`, not a standalone component): defaults ON per D8C-Shared-8 CF1; multi-space picker defaults to first-created accepted space per **new D8C-Shared-CP2-3** decision; 3 picker variants (0/1/2+ spaces) with graceful degradation. End-to-end smoke test passed: Mary sees Tom's shared list, can add/check-off items; cannot see private list; cannot delete shared list (RLS-enforced). See SESSION_LOG 2026-04-28 entry "Phase 8C-Shared-CP2" + Decisions Log D8C-Shared-1/4/5/8 + new D8C-Shared-CP2-3.
- **8C-Shared-CP2b** Add-to-list surface. **✅ Complete (2026-04-28).** Closes P8-24 (the `GroceryListDetailScreen` add-to-list placeholder F&F-blocker). `AddRecipeToListModal` shipped.
- **8C-Shared-CP2b.1** Autocomplete polish. **✅ Complete (2026-04-28).**
- **8C-Shared-CP3** Routing + recipe attribution (narrowed). 🟡 SUPERSEDED — NOT shipped under 8C-Shared; semantics absorbed into 8R-CP3. XL2 cross-list query widening (D8C-Shared-5) already landed in CP2 per scope shift. Remaining (as designed): `routeStapleToGroceryList` updated to prefer shared lists in the staple's space (R2 + member-can-route extension); members can route to shared lists they don't own; `addItemToList` populates `grocery_list_item_recipes.added_by` from `auth.uid()` on insert (RA2). Estimated ~1hr (was ~1.5hr).
- **8C-Shared-CP4** UX visibility + edit-sharing flow + delete-affordance gating. 🟡 SUPERSEDED — NOT shipped under 8C-Shared; semantics absorbed into 8R-CP4. As designed: list card subtitle on GroceryListsScreen ("Shared with [space name]" / "Private") (UX3); icon on GroceryListDetailScreen header (👥 shared / 🔒 private) (UX1); settings affordance on list detail to toggle sharing post-creation. **Plus (added per CP2 smoke-test findings):** non-owner UX gating on list-delete (RLS already enforces server-side; UI should hide/disable the affordance for non-owners) per D8C-Shared-3 EP2 + owner-only-hard-delete; confirmation friction on item-delete. Estimated ~2hr (was ~1.5hr; +0.5hr for added scope).

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

### 8R — Unified household needs refactor (~6 weeks actual) 🟢 Mid-closeout

**Status:** CP1 → CP6e shipped (2026-04-29 → 2026-05-13). SmokeFix-SF1/SF2/SF3 + catalog SF-5 shipped 2026-05-14. Smoke validation passed clean 2026-05-15. Doc reconciliation + CC cleanup pass remaining.

#### Why 8R replaced the 8C continuation

Phase 8C-Shared shipped CP1 + CP2 + CP2b + CP2b.1 on 2026-04-28 within a "lists-as-containers" model. End-to-end smoke test (Tom + Mary) passed all paths. During the CP3 design pass on 2026-04-29, Tom raised the question of how recipe ingredients route to lists and whether the underlying lists-as-containers model was the right architecture going forward.

After deep walkthrough, the conclusion was that **the model should be re-architected to filter-views over a unified "needs" bag**, with pantry staples generalized to "supplies" within the same model. The existing lists-as-containers concept doesn't cleanly express: items belonging to multiple shopping contexts simultaneously (olive oil on Costco AND Groceries); the supply-vs-transient-need distinction Tom and Mary already operate on; future store-aware reordering; status as a first-class data dimension.

The core architectural insight: **pantry and grocery are unified surfaces in the user's mental model**. A supply low → spawns a need. A need acquired → replenishes a supply. They are the same lifecycle viewed from different sides. Today's separate `pantry_staples` + `grocery_lists` schemas treat them as separate domains; the unified model collapses them.

8R commits to this reframe. Tom signed off on 2026-04-29 with explicit acceptance of:
- F&F target slipping from early-to-mid June to **late July or August** (later refined to late August / early September 2026 after CP6e-Lots scope addition)
- 8C-Shared work shipped 2026-04-28 becoming throwaway (schema + RLS + service + UI all nuked)
- All existing pantry + grocery user data nuked (no migration path; fresh start)
- A 6-CP refactor sequence with wireframe dev as a planning prerequisite (✅ completed 2026-04-29 through 3 iteration rounds + audit pass + follow-up resolution)

#### Architectural concept

##### The model

The application has three primary entities replacing the current grocery-lists / pantry-staples model:

**Supplies** — household items kept in ongoing stock. Cycle through `in_stock → low → critical → out → in_stock` over time. Examples: olive oil, toilet paper, basmati rice. Supplies have:
- Identity (`ingredient_id` for cooking ingredients OR `custom_name` for non-ingredient items like toilet paper)
- Status (the 4-state enum) — but **initial state on supply-create is restricted to `in_stock`, `low`, or `out`** (per Q35). Critical only reachable via state-cycling after creation; it's a transitional state, not a valid initial state.
- Tags (store, storage location, brand preferences, etc.)
- Optional `for_user_ids UUID[]` field — supplies can be marked as belonging to a subset of household members. Empty array = household-shared, all current and future members (forward-compatible for membership changes per Q37). (Per D8R-Q27 / Q37, supersedes Q17's single-UUID model. Multi-user array supports "Tom + Mary's yogurt vs Charlie's" use cases.)

**Needs** — transient household needs. Cycle through `need → in_cart → acquired` and disappear (or archive). Examples: a one-off bottle of olive oil for tonight's recipe; bread; lemonade for the BBQ. Needs have:
- Identity (same flexibility as supplies)
- Status (the 3-state enum)
- Quantity + unit
- Tags (store, urgency, recipe-attribution, etc.)
- Recipe attribution via `needs_recipes` junction (replaces current `grocery_list_item_recipes`)

**Tags** — properties attached to supplies and needs. Hybrid taxonomy: predefined dimensions (`store`, `urgency`, `recipe`, `event`, `storage`) with user-created values within them. Tag values are scoped to space. (Aisle is NOT a tag dimension — see Q29; it's a render mode computed from `ingredients.typical_store_section`.)

**Views** — saved filter expressions. Combine tag predicates (multi-value within dimension; AND across dimensions) with status filters. Examples:
- "Costco" view = `WHERE status='need' AND tag store='costco'`
- "Tonight" view = `WHERE status='need' AND tag urgency='today'`
- "All needs" view = `WHERE status='need'`

Views are presented in the UI as "lists" — the familiar grocery-app affordance — while the underlying data is the unified bag.

##### Status as field, not tag

Status updates frequently (every check-off). Storing status in a tag-membership table would mean INSERT/DELETE on every state change. Decision: **status is an enum column on the supply/need row**. Tags handle the slower-changing dimensions.

##### Time-window views with derived hierarchy

Time-window tags (today, this-week, this-month) have logical containment: today ⊂ this-week ⊂ this-month. Stored hierarchy would mean writing 3 tags every time something is "today." Derived hierarchy at query time means views know that "this-week view" matches anything tagged today OR this-week OR no-time-tag-but-this-week-derived.

Decision: **derived hierarchy at query time** for time-window tags. Stored membership for store/recipe tags (no parent-child relationships there).

##### Supply-spawn-need

When a supply transitions to `out`, the system **auto-creates a need** tagged with the supply's tags (store, etc.) plus default urgency. Need lives until acquired. Acquire restocks the supply.

Critical/low statuses are warnings, not action triggers — UI-only. (See D8R-Q10 for the deferred "configurable threshold" enhancement.)

##### Configure-once-and-done (D8R-Q21)

A core operating principle that emerged from wireframe iteration: **the supply IS the configuration.** Once a user creates a supply for "olive oil" with quantity 2L, store=Costco, brand=Kirkland — every subsequent path to a need (Regulars-zone tap, recipe-add, auto-spawn-on-out, autocomplete from add-to-needs sheet) inherits those defaults. The full add-to-needs ceremony only happens for genuine first-time configurations or one-offs.

This collapses a recurring pain point in today's UX where users re-enter the same data (quantity, store, brand) every time they add olive oil to a list. After the first save-as-regular, all subsequent adds are essentially one tap.

##### Regulars zone (D8R-Q20)

On every view detail screen, supplies whose tags match the view surface as a "Regulars" zone — Tom's iPhone Notes "click-to-add usuals" pattern. **Default state: collapsed strip** with one-line status summary ("Regulars · 3 out · 4 low · 16 in stock · Open ▸"). Tap → expanded multi-select interface, sorted out → low → in_stock with categories collapsing for in-stock items. Out items pre-selected on open (you're definitionally going to buy these).

Architecturally this is the same primitive as auto-spawn-on-out (D8R-Q10), but user-triggered for any supply at any status. Bridges pantry data → grocery action without a context switch.

##### Recipe combine UX (D8R-Q28 + Q36)

When adding recipe ingredients to needs and an overlapping ingredient already has a need, the **needs stay separate** (preserving recipe attribution) BUT views render display-merged when the merge predicate matches: same `ingredient_id` + same `unit` + same store tags (as set) + same `for_user_ids` (as set). Different stores → stay separate (intentional separate purchases like "1 bottle from each store"). Different `for_user_ids` → stay separate (different intended owners). Recipe attribution and urgency tags do NOT block merge.

CP1 schema needs efficient indexing on `(ingredient_id, unit, store_tags, for_user_ids)` for merge-query performance — likely a composite index or derived hash. See Q36 for CP1 schema flag.

##### Personal / household-subset supplies (D8R-Q27 + Q37 — supersedes Q17 + Q31)

Supplies and needs can be marked with a subset of household members via `for_user_ids UUID[]`.

**Write semantics (Q37):**
- "Everyone" selection in UI → writes **empty array**. Means "household-shared, all current AND future members." Forward-compatible: when household composition changes, an empty-array supply automatically applies to new members.
- Explicit subset selection (e.g., "Tom + Mary" in a 5-member household) → writes the array verbatim. Frozen even if household composition changes later.

**Render semantics (Q31, refined by Q37):**
- Empty array → "Everyone"
- Explicit-all-current-members array → "Everyone" (UI collapses; treats as if explicit-all)
- Explicit subset → "Tom + Mary"-style summary

**Schema (Q27):** Postgres array preferred over junction table for F&F (small cardinality, no per-user metadata). NO synthetic "everyone" flag column.

**Inheritance:** spawned needs inherit `for_user_ids` from parent supply (preserves user-intent through the spawn).

Q17's single-UUID model proved insufficient when Tom flagged the "family of 5" use case. Multi-user requires moving to Postgres array. Q31's render-only definition was completed by Q37 with the write-path rule.

##### Multi-store membership

A supply can be tagged with multiple `store` values. Olive oil tagged `store:costco` AND `store:fred-meyer-fallback` shows up in either view. The "duplicate" problem the current model handles via cross-list prompts evaporates.

##### Lot tracking (D8R-Q43-Q60)

**Two supply tracking modes.** Every supply has a `tracks_lots BOOLEAN` flag. Default `false` — most supplies (olive oil, salt, lemonade, eggs in the simple case) work as today: `usage_level` 5-circle indicator + manual cycle. When `true`, the supply tracks individual physical instances ("lots") with quantities, storage locations, and expirations.

**Lots are inventory facts; status is user judgment.** The two are decoupled. A user with 2 sealed bags of coffee can still mark the supply `Low` — meaning "we should buy more before we run out" — without that contradicting the qty. The only mechanical coupling: when total lot qty across all lots reaches 0, status auto-flips to `out` (D8R-Q44). When a lot is added to a supply currently in low/critical/out, status auto-flips to `in_stock` (D8R-Q45).

**One supply per ingredient; lots distinguish variants.** Fresh and frozen blueberries are ONE supply with TWO lots (different `storage_location`). Bone-in and boneless chicken thighs are ONE supply with multiple lots distinguished by `variant_label` (D8R-Q49). Search "blueberries" or "chicken" → finds the single supply, expanding to show relevant lots. The escape hatch — making them separate supplies — is available for power users who want different stores/tracking-modes per variant, but is not the default model.

**Variant grouping inside the supply row's expand panel.** When a supply has 2+ distinct `variant_label` values, lots render in collapsible variant sub-groups inside the lots list (D8R-Q50). Single-variant supplies show a flat list. Search-within-lots affordance surfaces when 4+ lots present (D8R-Q51).

**Cook depletion against lots.** When a recipe is cooked, the depletion plan draws qty from the oldest-expiring compatible lot first, with cross-lot decrement when needed (D8R-Q52). User can override per-ingredient via a lot picker. Lots that hit qty=0 auto-archive (`consumed_at = NOW()`).

**Cook depletion does NOT auto-demote status** for either lots or non-lots supplies (D8R-Q53). This reverses prior 8R behavior (one-step demotion in_stock → low → critical → out per cook). Users manage status manually; cooks decrement lot qty (lots supplies) or do nothing (non-lots supplies). The previous behavior was too aggressive — 5 cooks of olive oil per week would have it marked "out" by Sunday.

##### Search across supply + lot dimensions (D8R-Q56)

**Multi-token AND across all dimensions.** Search input "frozen gluten free pizza" tokenizes into 3 tokens; each token must match at least one searchable dimension on the result. Match dimensions:
- `ingredient.name`, `ingredient.plural_name`, `ingredient.family`, `ingredient.ingredient_type`
- `supply.custom_name`, `supply.brands`
- supply tags (joined via `tags.value`: stores, dietary, custom)
- `supply_lots.variant_label`, `supply_lots.brand`, `supply_lots.notes`
- `supply_lots.storage_location` (matched via storage synonym map: "frozen" → freezer; "fridge"/"refrigerated"/"cold" → fridge; "shelf"/"cupboard" → pantry; "room temp" → counter)
- `for_user_ids` (search "Mary" matches lots/supplies for Mary)

**Server-side full-text search via tsvector.** Per D8R-Q57: F&F ships server-side search (RPC `search_supplies(query_text, space_id)` returning ranked matches), not client-side filter. Reasoning: "build it correctly" directive; data churns constantly via cooks/acquires; durability over speed-to-F&F. Adds ~5-7 days to CP6e budget. Trade-off explicitly accepted.

**Lot-level match highlighting.** When some lots match all tokens but not all do, the matching lots render with highlighted background; non-matching lots in the same supply are dimmed but visible. Match pills next to results indicate which dimensions matched.

##### Catalog pluralization audit (D8R-Q58)

Existing catalog has algorithmic `name + 's'` pluralization which is wrong for mass nouns (dill, garlic, tarragon, cilantro, salt, sugar, milk, yogurt, etc.) and uncountables. Workstream A (parallel to CP6e build) sets `plural_name = NULL` for these. Display logic (`plural_name && qty > 1 ? plural_name : name`) handles NULL gracefully.

Bundles with the broader catalog data audit (P8R-D20 from CP5 smoke test).

##### Edit-routing pattern (D8R-Q23)

When the user edits a spawned need's tags (via toast Edit action), they get an optional "Update default routing" toggle. ON → the supply's tags update too. So next time olive oil hits out, it routes to the new tags automatically. This is the "system is learning" payoff — configure once, edit once when it shifts, never manual-tag again.

The toggle is **conditionally hidden** when the need has no parent supply (e.g., manually-created one-off without save-as-regular). See Q34.

##### State-cycle UI pattern split (D8R-Q30)

Two state-cycle interaction patterns coexist intentionally:
- **List-view dot tap** (Supplies grid) = tap-to-cycle. One tap advances state (in_stock → low → critical → out → in_stock). Compact, fast — for "I just used some" updates.
- **Detail-view 4-step strip** (Supply detail) = tap-to-set. Tap any step to set state directly. Precise — for "I want to mark this exactly."

Different mental models for different contexts. The UI affordance teaches each pattern via visual difference (single dot vs. 4-segment strip).

> **Implementation divergence (D8R-Q54-OVERRIDE, 2026-05-14):** The architectural-concept text above describes the list-view dot tap = tap-to-cycle behavior, which still applies to non-lots supplies (5-circle dot). For lots supplies, the lot-aware badge was changed during CP6e-SmokeFix-SF2 to **expand the row** on tap rather than cycle status. Status assignment for lots supplies happens explicitly in SupplyDetail's state-cycle strip. See the D8R-Q54-OVERRIDE entry in the Decisions log. Code is authoritative; the wireframes still reflect the original Q54 design intent.

#### Scope (8R)

##### In scope (all shipped as of 2026-05-15)

- ✅ New schema: `supplies`, `needs`, `tags`, `tag_memberships`, `views`, `view_filters`, `needs_recipes`, `supply_lots`. Composite index on needs `(ingredient_id, unit, store_tags, for_user_ids)` per Q36. tsvector + GIN on supplies and supply_lots.
- ✅ Dropped schema: `grocery_lists`, `grocery_list_items`, `grocery_list_item_recipes`, `pantry_staples`, `pantry_items` (though 5 stale query sites remain in `spaceService.ts` + `statsService.ts` — flagged in DEFERRED_WORK as T8)
- ✅ Services: `suppliesService`, `needsService`, `tagsService`, `viewsService`, `lotsService`. Old services `groceryListsService` + `pantryStaplesService` deleted; `groceryService` (legacy) reviewed.
- ✅ Recipe-flow integration: `addNeedFromRecipe` rewrites against needs; combine-prompt logic; auto-tagging from current view context.
- ✅ Cook-flow integration: depletion routes to `setSupplyState`; on `out` transition, spawn-need fires; lot-aware depletion via `deductFromOldest` + manual override picker.
- ✅ UX: replaced `GroceryListsScreen` + `GroceryListDetailScreen` with `ViewsScreen` + `ViewDetailScreen` (file renames partial — pending CC cleanup pass). 4 default views ship pre-baked. Custom-view creator. Supplies grid replaces staples grid. State cycle UI for supplies (list = tap-to-cycle for non-lots; detail = tap-to-set). Regulars zone (collapsed default + expanded multi-select). Configure-once add-to-needs sheet. Edit-routing modal on spawn toast. Supply-create flow (Tab 12).
- ✅ Cross-user smoke test: Tom + Mary household interaction verified 2026-04-28 + 2026-05-15.
- ✅ Lot tracking: `tracks_lots` opt-in flag. `supply_lots` table. Lot-aware SupplyRow. Lot editor in SupplyDetail. Lot create inline in SupplyCreateSheet. Lot-aware cook depletion. Lot-aware grocery acquire (default-create with toast + edit). Server-side multi-dimension search via tsvector + storage synonym map. Catalog plural_name audit (P8R-D20 closed). 90 catalog rows added in SF-5 (coffee/tea/cheese/spice/grains).

##### Out of scope (deferred to post-F&F or later phase)

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

##### Stays separate (NOT absorbed by 8R)

- **8A schema foundation** ✅ — shipped
- **8B staples & depletion** ✅ — shipped (staples became supplies in 8R)
- **8D recipe-pantry matching upgrade** — Verified 2026-05-15 as **NOT SHIPPED**. ~3-5 sessions of real work pending. F&F-blocker. See `PHASE_8D_PLANNING.md` (next session deliverable).
- **8E discovery polish + natural search** — pushed to after 8D. F&F-relevant subset: CP1, CP3, CP4.

##### Phase 8 sequence after 8R

```
8A ✅ → 8B ✅ → 8R ✅ (closeout in flight) → 8D 🔲 → 8E 🔲 (subset) → F&F
```

#### Build plan (8R) — final status

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
| Doc reconciliation: PROJECT_CONTEXT v10.3, PHASE_8R v0.7, DEFERRED_WORK v5.20, FF_LAUNCH_MASTER_PLAN v6.4 | 🟢 in flight (2026-05-15 session) |
| CC repo cleanup pass | 🔲 (next session) |
| FRIGO_ARCHITECTURE.md refresh | 🔲 (dedicated session) |
| D8R-Q54 override doc-reconciliation in PHASE_8R | ✅ done (v0.7) |
| CP6e commit batch landing | 🔲 (CC task) |
| 8R closeout marker | 🔲 (after above) |

**Prerequisites for CP1 (historical):** Wireframe dev complete (2026-04-29 v3 with audit pass + follow-up); Tom and Mary backed up any data to preserve outside Frigo (the nuke is destructive); 8C-Shared schema present in DB (dropped by CP1).

#### CP6 detailed scope (planning, 2026-04-30)

CP6 split into three sub-checkpoints based on dependency order and risk profile. CP6a is small + prerequisite (createNeed dedup before CP6c's bulk acquire builds on it; pantry-match fix unblocks F&F testing of any cooking flow). CP6b is the heavy structural build (Tab 12 + Tab 9 are both modal/sheet additions sharing patterns). CP6c is polish + cleanup, ships last when everything else is stable.

##### CP6a — Service fixes + small UX polish

Risk: low. Prerequisite for CP6b (Tab 12 builds on createNeed dedup) and CP6c (bulk acquire builds on createNeed dedup).

1. **createNeed supply_id dedup hoisting.** Service-layer fix to `needsService.createNeed`. Currently AddNeedSheet T1 fast path can create duplicate active needs for an existing supply (smoke test confirmed gap; only ExpandedRegularsSheet has inline dedup). Hoist to service layer so all consumers benefit (AddNeedSheet T1, ExpandedRegularsSheet, future bulk-acquire flow, addNeedFromRecipe). When `supply_id` is set and an active need (`status IN ('need','in_cart')`) already exists for that supply in the same space, return the existing need ID rather than create a duplicate.
2. **RecipeDetailScreen pantry-match fix.** Currently reads from deleted `pantry_items` table (smoke test: basmati rice in supplies still shows as "needed" on recipe detail). Re-point to `supplies` table. Likely a single service file + the consumer screen. Estimated ~30-50 line change.
3. **UnitPicker swap in AddNeedSheet.** Currently plain TextInput with `typical_unit` default; smoke test surfaced free-text units as a dirty-data risk. Swap to existing `UnitPicker` component (~120 lines drop-in) for controlled vocabulary.
4. **AddNeedSheet T3 always-visible custom row.** Smoke test feedback: "Add custom: '{query}'" should always be visible at 2+ chars rather than conditional on no T1/T2 match.
5. **Long-press on PantryScreen StaplesGrid → status jump-set.** Long-press a supply tile → action sheet with In stock / Low / Critical / Out. Direct jump-set, bypasses the cycle-tap.

##### CP6b — Tab 12 + Tab 9 build-out

Risk: medium-high. Heaviest CP of the 8R series. Three new modal/sheet surfaces; shares autocomplete + tag-picker patterns from CP5b's AddNeedSheet (no new shared primitives unless multiple consumers emerge — see DEFERRED_WORK P8R-D14).

1. **Supply create flow (Tab 12).** Wired from current "+ Add new supply" stubs (PantryScreen FAB; ExpandedRegularsSheet footer). 3-tier autocomplete mirrors AddNeedSheet but with Tier 1 inverted ("this already exists, edit it instead" path). Initial state restricted to In stock / Low / Out per Q35. "Add custom" affordance always-visible per smoke-test feedback.
2. **Spawn-on-out toast (Tab 9 — ephemeral toast).** Surfaces when supply transitions to `out`. Toast shows "Olive oil out → added to needs" with Edit + Undo actions. Edit opens edit-need modal (CP6b item 3). Undo reverts both supply state and the spawned need.
3. **Edit-need modal (Tab 9 — long-press on need row).** Replaces the current tap-to-cycle as the only need-edit affordance. Long-press a need row in ViewDetail → modal with quantity, tag chips, "Update default routing" toggle. Toggle ON updates supply's tags per Q23/Q34 conditional visibility rules.

##### CP6c — Cart visibility + bulk acquire + final cleanup

Risk: low-medium. Polish + cleanup. Several items are independent and can be reordered if any blocker surfaces.

1. **Collapsible cart footer section on need-only views.** Per Tom's option B selection: collapsed default reads `🛒 5 in cart ▸`; tap → expands to show in_cart rows scoped to the same view filter. Sticky at bottom of ViewDetail. NOT shown on views that already include `in_cart` in their status filter.
2. **Cart progress bar.** Horizontal bar at top of ViewDetail. Format: `5/12 (42%)`. Numerator = acquired count for the view; denominator = total (need + in_cart + acquired); percentage rounded. Resets per-view.
3. **Bulk acquire on In Cart view.** Footer action bar on the In Cart default view: "Acquire all (N) → restocks N supplies". Bulk transitions all in_cart needs to acquired. For needs with `supply_id` set, restocks the parent supply. Uses CP6a's createNeed dedup pattern (idempotent).
4. **Filename rename.** `screens/GroceryListsScreen.tsx` → `screens/ViewsScreen.tsx`; `screens/GroceryListDetailScreen.tsx` → `screens/ViewDetailScreen.tsx`. Update all navigation refs.
5. **`lib/types/grocery.ts` deletion.** CP5b verified zero `groceryListsService`/`groceryService`/`pantryStaplesService` imports across project. Verify type-file consumers via grep before delete.
6. **PK_CODE_SNAPSHOTS reconciliation.** ViewsScreen + ViewDetailScreen snapshots stale (HIGH-tier rewrites in CP5a). New components need tier assignment: ViewCreatorModal (Tier 3), AddNeedSheet (Tier 3), ExpandedRegularsSheet (Tier 3). Removed component rows: AddGroceryItemModal, QuickAddSection, InlineQuantityPicker.

#### CP6e detailed scope (planning, 2026-05-06)

CP6e is the lots model implementation. Scope is large enough to split into 4 sub-checkpoints by dependency order. CP6e-Schema must land before any UI; CP6e-Services builds the layer all UI consumes; CP6e-PantryUI rebuilds the pantry-side surfaces; CP6e-FlowsUI rebuilds cook + grocery flows. Search RPC and catalog audit run as parallel workstreams.

##### CP6e-Schema — Lots schema + tsvector

Risk: medium. Schema additions only; no behavior change yet. F&F-blocking — all subsequent CPs build on this.

1. **`supplies.tracks_lots BOOLEAN DEFAULT false`.** New column. Existing supplies all default to `false` (status-only) — zero-disruption default.
2. **`supply_lots` table.** Per D8R-Q46. Includes `consumed_at` for soft-delete pattern. RLS policy mirrors supplies table (space-scoped, household-shared).
3. **`supplies.search_vector tsvector` + trigger.** Maintained from supply.custom_name + supply.brands + ingredient.name + ingredient.plural_name + ingredient.family + ingredient.ingredient_type + supply tag values.
4. **`supply_lots.search_vector tsvector` + trigger.** Maintained from variant_label + brand + notes + storage_location + for_user_ids (joined to space_members for first names).
5. **GIN indexes** on both search_vectors.
6. **RPC `search_supplies(query_text TEXT, space_id UUID)` → returns ranked supply IDs + match dimensions array.** Tokenizes query, applies storage synonym map (D8R-Q58), runs `to_tsquery` AND across tokens against unioned supply + lot vectors.
7. **Updated `getSuppliesForSpace`** signature to optionally include lots (`includeLots?: boolean`). When true, hydrates `supply_lots` array per supply. Maintains backward-compat for non-lots consumers.
8. **Catalog plural_name pre-audit query.** Read-only query to verify P8R-D20 / D8R-Q59 catalog audit safety: identify which `ingredients` rows would be affected. CC reports back; Tom approves the change set; CP6e-Services executes the UPDATEs.

##### CP6e-Services — Lots service layer

Risk: medium-high. New service module + cookDepletion rewrite + grocery acquire rewrite. Behavior changes are substantive — testing before any UI lands is the gate.

1. **`lib/services/lotsService.ts`.** New module. CRUD for supply_lots (createLot, updateLot, archiveLot, getLotsForSupply). Aggregation helpers (getLotAggregate: total qty, soonest expiration, lot count, distinct variant count). Storage move with expiration recompute (D8R-Q47).
2. **suppliesService extensions.** `setSupplyTracksLots(supplyId, value)` — when flipping ON, create initial lot from current state if status is in_stock (or empty if low/out). When flipping OFF, archive all lots (only callable when no active lots — D8R-Q60). `setSupplyStatus` extension: auto-flip to `out` when total qty=0 (D8R-Q44); auto-flip to `in_stock` on lot add when prior status was low/critical/out (D8R-Q45).
3. **`cookDepletionService` rewrite.** Replace `cookTransition` per-cook demote with lot-decrement. For tracks_lots ingredients in the recipe, call `lotsService.deductFromOldest(supplyId, qty, qtyUnit)`. Cross-lot decrement when needed. Auto-archive lots that hit qty=0. For non-tracks_lots ingredients, no-op (D8R-Q53). Existing rollback still works.
4. **Grocery acquire path → lot create.** When a need linked to a tracks_lots supply transitions need → in_cart → acquired (or directly need → acquired in bulk-acquire flow), default-create a lot via `lotsService.createLot`. Auto-flip supply.status if applicable (Q45). Toast affordance to edit lot (handled in CP6e-FlowsUI).
5. **Catalog audit execution.** Per CP6e-Schema item 8: CC executes the approved UPDATE statements on `ingredients.plural_name` for mass nouns. Reports row count + spot-check sample.

##### CP6e-PantryUI — Pantry-side surfaces

Risk: medium. Heaviest UI work. Components touched: SupplyRow, SuppliesSection, SupplyDetailScreen, SupplyCreateSheet, ExpandedRegularsSheet (lot-aware peek). Wireframes in `phase_8r_lots_wireframes_v2.html` are authoritative.

1. **SupplyRow lot-aware badge.** Numeric value + unit icon (count/bag/bottle/jar/pack/bunch/container/weight). Status-colored background. Tap-cycle on badge mirrors 5-circle tap-cycle. Auto-derived from `ingredient.typical_unit` at create time, user-editable.
2. **Inline expand panel — lots-collapser default closed.** Summary line "N lots · M total · oldest exp Date" + chevron. Tap opens lots list inline.
3. **Lots list with variant sub-headers.** Sub-headers shown only when 2+ distinct variant_labels (D8R-Q50). Each variant block independently collapsible. Lot rows show: storage badge, qty, variant (text), expires (with warn coloring inside threshold).
4. **Search-within-lots.** Inline search bar inside expand panel when 4+ lots (D8R-Q51).
5. **SupplyDetail lots section.** Replaces the usage_level slider for tracks_lots supplies. Lot rows tappable → lot edit modal. "+ Add lot" affordance. Tracking section gets second toggle: "Track quantity / lots." Default storage section adds help text.
6. **SupplyCreateSheet lots toggle.** Off by default. When on, expands to show First Lot inline inputs (qty/unit, storage, optional variant_label, computed expiration). "+ Add another lot" for multi-lot create at registration.
7. **Lot edit modal (sheet).** Fields: storage (segmented), qty + unit, variant_label, brand, acquired_at (date picker), expires_at (computed default + override), notes, "Mark consumed" destructive action.
8. **Pantry overview rendering.** Mixed lot/non-lot rows side by side. Aggregate meta line on lot rows ("freezer · 8.75 lb"). Lot count cap on row.

##### CP6e-FlowsUI — Cook depletion + grocery acquire surfaces

Risk: low-medium. Surface updates that consume CP6e-Services rewrites.

1. **CookDepletionBanner lot-aware.** Per-row: ingredient name + qty + drawn-from lot. "Change ▾" affordance opens lot picker (multi-select) for manual override. Default = oldest-first auto-pick.
2. **Grocery acquire toast.** Post-acquire toast for tracks_lots supplies: "Acquired: eggs · 12 ct · added to fridge · expires May 22 (auto)." Edit lot / Undo affordances. 5s auto-dismiss.
3. **Lot edit sheet from acquire toast.** Reuses CP6e-PantryUI's lot edit modal.
4. **Search results UI.** Multi-supply rendering. Match pills next to row name showing matched dimension. Lot-level highlighting when only some lots match. For-user mini-badges (initials) on lots/supplies with non-empty for_user_ids.

#### Wireframe reference (8R)

✅ **Wireframe dev COMPLETE 2026-04-29.** Three iteration rounds with Tom + audit pass + audit follow-up settled the 8R UX.

**Final wireframes live at:** `docs/wireframes/phase_8r/`

- `phase_8r_wireframes_v3.html` — single consolidated file, 12 surfaces, 1660 lines. v3 incorporates 8 substantive audit fixes inlined as blue callouts. Visual is consistent with all 30+ decisions including Q35-Q37 from audit follow-up.
- `phase_8r_lots_wireframes_v2.html` — CP6e-Lots wireframes, 10 surfaces, ~1950 lines. Adds variant supply rendering (lots-aware badge, collapsible variant sub-headers, search-within-lots), supply detail with lots editor, supply create with lots toggle, multi-dimension search demo, cook depletion against lots, grocery acquire → lot create. Visual language matches actual app screenshots from 2026-05-06; supersedes 8R wireframe v3 aesthetic for CP6e-touched surfaces.
- `phase_8r_wireframes_README.md` — reference guide for execution.

**12 surfaces, 30+ variants, 19 new design decisions captured (Q19-Q37).** Both wireframe files are canonical references for design intent. **Implementation has diverged at D8R-Q54-OVERRIDE (LotBadge tap behavior)** — code is authoritative; wireframes reflect the original Q54 design intent which has been reversed.

---

### 8D — Recipe-pantry matching (3-5 sessions) 🟢 Essentially complete — CP1 + CP1.5 + CP2 + CP3 (CP5 bundled) + CP4 shipped

**Goal:** Upgrade matching quality and make every ingredient on a recipe actionable without leaving the page.

**Status:** 🟢 Essentially complete pending the end-of-phase cleanup pass. **8D-CP1** (matching primitive — `pantryMatchingService.ts`), **8D-CP1.5** (catalog variant linkage backfill), **8D-CP2** (4-level soft-match matcher + always_available skip), **8D-CP3** (recipe tap-sheet + match % banner, CP5 bundled), and **8D-CP4** (What-can-I-cook screen + RecipeList match wiring) all shipped 2026-05-19; see the CP1.5 + CP2 + CP3 + CP4 results subsections below and `PHASE_8D_PLANNING.md` for the build plan. **Next: 8D cleanup pass** (remove tap-sheet console.warn instrumentation, T29 smoke realignment, PHASE_8D_PLANNING refresh, PK_CODE_SNAPSHOTS), then 8E. The checkpoint list + architectural-decisions block immediately below are the pre-8R framing — to be refreshed in `PHASE_8D_PLANNING.md`; they no longer reflect the shipped CP1/CP1.5 work.

**Checkpoints (pre-8R framing — to be refreshed in PHASE_8D_PLANNING.md):**
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

**Architectural decisions (pre-8R framing):**
- `pantryMatchingService` vs extension of `pantryService`: extend existing `pantryService`. Replace internals of `calculatePantryMatchPercentage()` and bulk variants; preserve function signatures so RecipeListScreen/RecipeDetailScreen consumers don't need updates (D8-15). *(Note: superseded by 8R purge — 8D rebuilds against `supplies`.)*
- Match strictness v1: moderate (base-ingredient normalization + staple exclusion). Loose category-level matching deferred (D8-16).

**Out of scope for 8D:** Category-level matching (any cheese / any dried pasta). Quantity awareness. Recipe substitution engine.

#### 8D-CP1.5 — Catalog variant linkage backfill — COMPLETE 2026-05-19

CP1.5 was an AI-assisted ingredient-catalog variant-linkage backfill: orphan ingredients (no `base_ingredient_id`) were linked to base ingredients, and every touched row received an `ingredient_subtype`, so the matcher can do variant traversal and — once the 4-level matcher (T20) is built — soft-matching. It was originally scoped as a Python/Haiku pipeline; mid-checkpoint it pivoted to interactive SQL, with Claude.ai proposing dispositions chunk-by-chunk and Tom approving + running each migration in Supabase. The headline decision is **D8D-Q19**: strict-(i) promotion — each functionally-distinct variety is its own base, and the soft-match category lives in `ingredient_subtype`. D8D-Q19 supersedes D8D-Q1 (bidirectional substitutability) and was applied retroactively across all 4 families. Soft-match scaffolding is now complete — the deferred 4-level matcher reads `ingredient_subtype` + `form` directly.

**Catalog state at CP1.5 close:**

| Family | Bases | Linked | Orphan |
|--------|-------|--------|--------|
| Dairy | 46 | 17 | 6 |
| Proteins | 51 | 37 | 1 |
| Produce | 152 | 16 | 3 |
| Pantry | 355 | 38 | 0 |
| **Total** | **~604** | **~108** | **10 intentional** |

~700+ rows received `ingredient_subtype` across ~70 distinct subtypes; 0 NULL subtypes remain.

**Subtype conventions established:** salt; pepper; chile / dried_chile (split); mushroom; leafy_green; root_vegetable; citrus; per-herb subtypes for basil / oregano / parsley / rosemary / thyme (cross-family — fresh and dried share the herb's subtype); ginger_fresh vs ginger_spice (split, per Tom's fresh-vs-spice principle); rice; pasta; noodle (split from pasta); vinegar; wine; fortified_wine; spirit; beer; oil split into neutral_oil / olive_oil / finishing_oil (D8D-Q15); sugar (shared across all dry sugars); syrup (shared across liquid sweeteners + fruit molasses); legume; dried_fruit; mustard (cross-form family); nut_butter (includes tahini); preserves; hot_sauce; soy_sauce; stock (broths merged in); spice_blend; always_available (water + ice — matcher should skip these).

**Cross-chunk subtype family demonstrations:** subtypes deliberately span ingredient_types and migration chunks so the matcher treats them as one soft-match family. Per-row `(name, ingredient_type, subtype, form)` tuples are in the catalog export; the families:
- **mustard** — 7 rows sharing subtype `mustard`, spanning 3 ingredient_types (Condiments & Sauces, Spices & Dried Herbs, Nuts & Seeds) across separate migration chunks.
- **coffee** — 6 rows sharing subtype `coffee`, spanning 2 ingredient_types (Coffee & Tea, Baking).
- Additional cross-chunk families delivered: `flour` (9 rows), `chocolate` (5 rows), `stock` (broths merged in), `nut_butter` (includes tahini).

**Known intentional orphans (10)** — rows that remain orphan post-CP1.5, by design:
- **Dairy (6):** the demoted `cheese` base; frozen yogurt; ghee; labneh; quail egg; young sheep's-milk cheese.
- **Proteins (1):** whole fish.
- **Produce (3):** mixed greens; fresh chile; chili pepper.

**What CP1.5 did NOT do:**
- No matcher code changes — the matcher is still binary (exact / linked only); 4-level soft-match is T20, deferred.
- No UI changes.
- No removal of the orphaned Python pipeline at `scripts/cp1_5_catalog_backfill/`.
- No schema changes beyond the `ingredients_base_or_variant_not_both` CHECK constraint added in the base-set-corrections migration.
- No rename of the `nut_butter` subtype — technically loose (tahini is a seed butter) but functional; captured as deferred (T24).

**Orphaned scaffolding:** `scripts/cp1_5_catalog_backfill/` (the Python pipeline originally scoped) is dead code after the mid-CP pivot to interactive SQL. Tracked as part of T24 for cleanup. Acceptable to keep as reference until 8D phase close; delete at end-of-phase doc reconciliation or capture as a standalone hygiene CP if Tom wants to formalize.

#### 8D-CP2 — 4-level matcher refactor (T20 + T22) — COMPLETE 2026-05-19

Refactored `pantryMatchingService.ts` from binary (matched/missing) to a 4-level match: **L1 exact** (same ingredient row, or `base_ingredient_id`-linked), **L2 form variant** (same `ingredient_subtype`, different `form`), **L3 substitute** (same subtype + same form), **L4 no match** (different subtype → `missing[]`). `ingredient_subtype='always_available'` (water, ice) is treated as L1 with no supply lookup at all — resolves **T22**; recipes calling for water no longer read "missing." `MatchedIngredient` gained `level` + `reason` fields; `matchPercentage` counts L1+L2+L3+always_available in the numerator. The 3-query bulk design is preserved; Task 2.5 dropped the `ingredient_id IN (...)` filter on the supply query so same-subtype substitutes on separate bases surface — a full active-supply fetch, fine at F&F scale (subtype-aware IN expansion deferred as T26).

`IngredientsSection.tsx` renders three states: ✓ green (L1 / always_available — identical UX), ⚠ amber + reason sub-line (L2 form variant), ≈ amber + reason sub-line (L3 substitute); L4 = missing. `RecipeDetailScreen` passes a new `ingredientMatches: Map<ingredientId, MatchedIngredient>` prop. `RecipeListScreen`'s "Pantry Match %" sort is unchanged (still reads `matchPercentage`). `CookSoonScreen` verified NOT a matcher consumer (grep, 0 hits) — out of scope.

**Part 0 (catalog hygiene)** ran in the 2026-05-19 planning chat (not via CC): 19-row UPDATE — 4 Produce/Fresh Herbs → `form='fresh'`; 7 Pantry/dried_chile → individual forms; 8 spice_blend rows split into singleton subtypes (so the matcher stops L3-cross-substituting functionally-different blends). See the SESSION_LOG 2026-05-19 entry; no anomalies surfaced. Residual cosmetic form-NULL hygiene captured as T25.

**Files:** `pantryMatchingService.ts`, `_pantryMatchingSmokeTest.ts` (+16 `SMOKE-CP2-*` scenarios), `components/recipe/IngredientsSection.tsx`, `screens/RecipeDetailScreen.tsx`, `FRIGO_ARCHITECTURE.md`. Resolves **T20** + **T22**.

**CP2 Patch — substitution whitelist + null-form wildcard (2026-05-19).** Dogfooding surfaced two bad-UX classes: cross-fruit substitute warnings (banana ≈ mango — coarse subtypes encode family, not substitutability) and confusing "different form" copy on generic-base rows (`sugar`, `vinegar`, citrus whole fruits) whose `form` is NULL. Patched the matcher with a `SUBSTITUTABLE_SUBTYPES` whitelist (~75 hand-validated subtypes) — same-subtype matches in non-whitelisted subtypes (cheese, fish, leafy_green, tropical_fruit, etc.) demote to L4 missing — plus a null-form wildcard: within a whitelisted subtype, a NULL `form` on either side collapses to a silent L1 exact. No schema, UI, or type changes — one const + one conditional. Full rationale + assumptions + post-F&F audit roadmap (G1-G6) in `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md`; the subtype audit/split is captured as DEFERRED_WORK T30.

#### 8D-CP3 — recipe tap-sheet + match % banner (CP5 bundled) — COMPLETE 2026-05-19

Made the post-CP2 ingredient rows interactive. **Strictly additive at the visual layer** — the 4-level row visual, sub-line copy, "+ Add N missing →" / "+ Add all N" buttons, section header, and spacing are byte-identical to the pre-CP3 render (Preservation Contract; the only tap affordance is `activeOpacity={0.7}` press-down).

- **`IngredientTapSheet.tsx` (NEW).** Inline tap-sheet rendered by `IngredientsSection` directly below the tapped row (not a bottom overlay — preserves scroll position, per wireframe v5). Action set is state-driven: `matched_in_stock` → See more (primary) · Update qty · Which step? · Other recipes; `matched_low`/`matched_critical` → + Need now (primary) · See more · Update qty · Which step?; `missing` → + Need now (primary) · Substitute · Add to supplies · See more. `+ Need now` writes a need via `addNeedFromRecipe` with an `urgency:this-week` tag; `Which step?` scrolls the prep section to the referencing step; `Other recipes` jumps to the ingredient-filtered recipe list. See more / Update qty / Substitute are v0 placeholder Alerts (real surfaces post-F&F).
- **`IngredientsSection.tsx`.** Rows are tappable (except `always_available` water/ice — non-tappable, no useful actions; and edit-mode rows). One tap-sheet open at a time (`expandedIngredientId` state); tapping another row switches in place.
- **`RecipeDetailScreen.tsx`.** Match % banner below the recipe header when `matchPercentage < 100%` and `missing.length > 0` (`"{XX}% in pantry · {N} missing →"`) → opens `AddRecipeToNeedsModal` in `mode='missing'` — **this is CP5, bundled here.** `SupplyCreateSheet` lifted here for the tap-sheet "Add to supplies" action. The `AddRecipeToNeedsModal` lift the prompt called for was already done in a prior CP (modal state has lived at screen level since the dual-CTA work) — no change needed.
- **`MatchedIngredient.supplyStatus`** added (Option A) — `SupplyStatus | null`, populated from the existing Query-2 supply rows (no extra query, 3-query bulk structure unchanged). Powers the `matched_in_stock` vs `matched_low`/`matched_critical` distinction.

**Key decisions:** all matched levels (L1/L2/L3) collapse to the same tap-sheet state by supply status — the L2/L3 distinction is already carried by the inline row indicator, so the tap-sheet does not restate it; `always_available` rows stay non-tappable; the `supplyStatus` extension is Option A (single additive field, no refactor).

**Files:** `components/recipe/IngredientTapSheet.tsx` (NEW), `components/recipe/IngredientsSection.tsx`, `screens/RecipeDetailScreen.tsx`, `lib/services/pantryMatchingService.ts`, `lib/services/_pantryMatchingSmokeTest.ts` (+`SMOKE-CP3-S1/S2`). Resolves the **P6-10** tap-to-see-steps deferred item (the CP3 prompt referenced it as "D6-18" — no such literal ID; P6-10 is the description match).

#### 8D-CP4 — What-can-I-cook screen + RecipeList match wiring — COMPLETE 2026-05-19

Phase 8D's headline utility: a filtered list of recipes genuinely ready to cook given current supplies. Implements the D8D-Q3 **"ready to cook"** criterion — `matchPercentage >= 0.90` AND every hero ingredient on hand.

- **`readyToCookService.ts` (NEW).** Single source of truth for the gate: `isReadyToCook`, `filterReadyToCook`, `resolveHeroToIngredientId`, `READY_TO_COOK_THRESHOLD = 0.9`. **Data-model finding:** `recipes.hero_ingredients` is a bare `text[]` of names with no catalog ids, and `recipes.ingredients` (JSONB) is free-text — catalog `ingredient_id`s (what `matchResult.missing[]` holds) live only in `recipe_ingredients`. So heroes are **name-resolved at filter time** against each recipe's catalog ingredients, batch-loaded by the new `getRecipeIngredientNames` helper. Unresolvable heroes are a soft pass + a permanent `console.warn` measuring hero-tagging data quality (DEFERRED_WORK T31).
- **`useReadyToCookRecipes.ts` (NEW hook).** Loads recipes → bulk-matches → loads ingredient names → applies the gate → returns the sorted qualifying subset. First file in the new `lib/hooks/` directory.
- **`RecipeCard.tsx` (NEW).** The recipe list card extracted verbatim from `RecipeListScreen.renderRecipeCard` — byte-identical visual output (internal refactor) — shared by RecipeListScreen and WhatCanICookScreen. Owns the `Recipe` card-data type and the `formatRelativeTime` / `buildDietaryBadges` helpers.
- **`WhatCanICookScreen.tsx` (NEW).** Dedicated screen for the gated subset; search + a temporary one-off locked filter chip ("Pantry: 90%+ match" — 8E-CP3 will formalize it); empty/loading states; pull-to-refresh. Architectural comment reservation for a future free-form recipe-ideas section (no UI this CP, per Tom 2026-05-19).
- **RecipeListScreen integration.** `pantry_match` is now populated from the matcher via a derived `recipesWithMatch` memo (never mutates `recipes` state); `canMakeCount` is a derived memo running the shared gate; the long-dormant "X you can make now" badge now renders and is tappable → WhatCanICookScreen; the inline card render is replaced with `<RecipeCard>`. Strictly additive — card visual, filters, sort, sections all byte-identical.
- **PantryScreen** gains a "What can I cook?" CTA (cross-stack nav → Recipes stack); **App.tsx** registers the `WhatCanICook` route.

**Key decisions:** the prompt assumed recipes carry `ingredients: {id,name}[]` — they don't; resolved via a separate `recipe_ingredients` fetch (`getRecipeIngredientNames`), keeping `readyToCookService`'s public API as specced. RecipeListScreen already had a `matchMap` effect, so `pantry_match`/`canMakeCount` are wired through derived memos rather than a second bulk-match call. CP4 smoke tests (`SMOKE-CP4-RTC1..5`) are deterministic pure-predicate tests (constructed `PantryMatchResult` literals) — immune to T27 harness contamination.

**Files:** `lib/services/readyToCookService.ts` (NEW), `lib/hooks/useReadyToCookRecipes.ts` (NEW), `components/recipe/RecipeCard.tsx` (NEW), `screens/WhatCanICookScreen.tsx` (NEW), `screens/RecipeListScreen.tsx`, `screens/PantryScreen.tsx`, `App.tsx`, `lib/services/_pantryMatchingSmokeTest.ts` (+`SMOKE-CP4-RTC1..5`). CP5 (missing-to-grocery one-tap) was bundled into CP3. **Phase 8D is essentially complete** pending the end-of-phase cleanup pass.

---

### 8E — Recipe discovery polish — **MERGED INTO PHASE 11 (2026-05-19)**

Per Tom's 2026-05-19 close-out decision, 8E is retired as a standalone sub-phase. The F&F-relevant checkpoints are absorbed into Phase 11's "Recipe Polish" scope:

- **8E-CP1 (Browse recipes rebuild)** → Phase 11 must-have. Replaces the current Recipes tab with the wireframe v5 design.
- **8E-CP3 (Locked filter chips pattern)** → Phase 11 must-have. Formalizes the one-off locked chip currently inlined in `WhatCanICookScreen` (8D-CP4).
- **8E-CP4 (Low stock indicators #31)** → Phase 11 must-have. Uses the CP1 matching primitive's low/critical bucketing.

**8E-CP2 (Natural-language search)** remains post-launch as previously documented — first post-launch ship if Phase 11 exercises the scope-cut lever.

Phase 11 estimate revised 7-12 → 9-15 sessions to absorb the merge. See `FF_LAUNCH_MASTER_PLAN.md` Phase 11 section. Original 8E checkpoint detail preserved in the changelog + git history; do not re-execute against the bullets above without re-planning under Phase 11.

---

## Deferred to post-F&F (original Phase 8 planning — explicitly scoped out)

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

The Phase 8R deferred decision points (P8R-D series) are tracked separately in the "Deferred items — Phase 8R" section below and in `DEFERRED_WORK.md`.

---

## Architecture notes (8A–8C era — schema partially superseded by 8R-CP1)

> The `pantry_staples`, `pantry_items`-additions, and `grocery_list_items` schema below shipped in 8A-CP1 and 8C and was the foundation for 8A/8B/8C/8C-Shared. **8R-CP1 (2026-04-29) dropped `pantry_staples`, `pantry_items`, `grocery_lists`, `grocery_list_items`, and `grocery_list_item_recipes`** and replaced them with the unified `supplies` / `needs` / `tags` / `views` / `supply_lots` schema. This section is preserved as the historical record of the 8A–8C-era data model.

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

Full SQL was in `phase_8_schema_migration.sql` (8A-CP1). The 8R-CP1 schema migration lives at `docs/phase_8r_cp1_schema_migration.sql` (move to `supabase/migrations/` tracked as P8R-D21).

### Service layer additions

- `pantryStaplesService.ts` — new in 8B-CP1 *(deleted by 8R)*
- `pantryService.ts` — 8D was to upgrade matching functions *(deleted by 8R; 8D rebuilds against `supplies`)*
- `groceryService.ts` — 8C tier routing, cross-list query, recipe-link chip filter, staple-to-grocery routing *(legacy; reviewed/superseded by 8R)*
- `searchService.ts` — 8E adds `parseNaturalSearch()` + chip-parsing layer
- Reusable `multiIngredientRecipeSearch()` — 8C-CP8 (serves Use soon multi-select, freezer multi-select, "X + Y" search) *(8C-CP8 superseded by 8R)*
- **8R services (current):** `suppliesService`, `needsService`, `tagsService`, `viewsService`, `lotsService`.

### New screens / major components (8A–8C era — many superseded by 8R)

- **IngredientDetailScreen** (8C-CP5) — hero + 4 tabs *(8C-CP5 superseded by 8R)*
- **FreezerCleanoutScreen** (8C-CP6) — view toggle + collapsed rows *(8C-CP6 superseded by 8R)*
- **WhatCanICookScreen** (8D-CP4) — section-organized results with locked chips *(8D pending)*
- **NaturalSearchScreen** (8E-CP2) — text input + parsed chips + results *(8E pending)*
- **StaplesGrid + StapleCell** (8B-CP2) *(became the 8R supplies grid)*
- Upgraded **PantryScreen**, **GroceryListDetailScreen** *(rebuilt by 8R as PantryScreen + ViewDetailScreen)*
- Upgraded **RecipeDetailScreen IngredientsSection** — tappable rows + inline tap-sheet *(8D pending)*
- Upgraded **RecipeListScreen browse mode** *(8E pending)*

---

## Cross-cutting architectural patterns

These were UX patterns, not data-model decisions — all survived the 8R refactor intact.

**View toggle pattern.** Reusable component applied to 3+ surfaces (PantryScreen shelf: Category/Storage/Expiry; FreezerCleanoutScreen: Age/Category/Storage; RecipeListScreen full list: Pantry %/Recent/Rating/Time). User picks axis, minimal default info.

**Locked filter chip pattern.** Subset-of-recipes pages show defining filter as locked chip (lock icon, gray, not removable). User refinements appear as blue removable chips. Natural-language search refines on top of locked filters.

**Fraction display utility.** `formatQuantityDisplay(value: number, unit: string): string` — renders decimals as unicode fractions where possible (½, ⅓, ¼, ¾, ⅛, ⅜, ⅝, ⅞, ⅙, ⅚), falls back to decimal otherwise. Applied to PantryItemRow, grocery rows, StapleCell (if quantity shown), recipe tap-sheet quantity display.

**Inline tap-sheet pattern.** On recipe ingredient rows, inline-expanding sheet below tapped row (not bottom-sheet overlay). Preserves scroll position. Actions adapt to ingredient state.

---

## Decisions log (combined)

### Phase 8 decisions (8A–8C-Shared)

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

----

### Phase 8R decisions (D8R-Q1 through Q60 + D8R-Q54-OVERRIDE)

Captured during the 2026-04-29 design walkthrough + 3 wireframe iteration rounds + audit pass + audit follow-up, plus the 2026-05-05 → 2026-05-06 lot-tracking iteration and the 2026-05-14 CP6e smoke override.

#### Foundational decisions (Q1-Q18, 2026-04-29 walkthrough)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q1 | 2026-04-29 | Tag taxonomy | Hybrid: predefined dimensions (`store`, `urgency`, `recipe`, `event`, `storage`) with user-created values within them. Free-form values give per-household specificity (e.g., "fred-meyer-hawthorne" as a store value). Aisle removed from this list per Q29. |
| D8R-Q2 | 2026-04-29 | Default views as "lists" | UI presents default + custom views as "lists" using familiar list terminology. Internally they're filter expressions. |
| D8R-Q3 | 2026-04-29 | Custom view UX | Form-style picker for F&F (checkbox-grouped per dimension; multi-select within dimension; AND across dimensions). Tag-chip include/exclude (Option B) deferred post-F&F. **Refined in Q19/Q25/Q29 wireframe iteration.** |
| D8R-Q4 | 2026-04-29 | Status as field vs tag | Field (enum column on supply/need row). Tags reserved for slower-changing dimensions. |
| D8R-Q5 | 2026-04-29 | Bulk vs immediate | Two distinct entities: bulk = supply, immediate = need. They coexist; recipe-combine UX renders display-merged at view time. |
| D8R-Q6 | 2026-04-29 | Recipe attribution | Junction table `needs_recipes` (analog of `grocery_list_item_recipes`); preserves attribution metadata + author. |
| D8R-Q7 | 2026-04-29 | Supply status cycles | Supplies cycle `in_stock → low → critical → out → in_stock`. Needs cycle `need → in_cart → acquired`. Independent state machines. |
| D8R-Q8 | 2026-04-29 | Migration | None. Nuke existing pantry + grocery data. Fresh start. |
| D8R-Q9 | 2026-04-29 | RLS / sharing | Tags scoped to space; views scoped to space. Supplies + needs scoped to space (with optional `for_user_ids UUID[]` field — see Q27/Q37). |
| D8R-Q10 | 2026-04-29 | Spawn semantics | β — Auto-create need when supply transitions to `out`. `low` and `critical` are warnings only. (γ configurable thresholds deferred — see P8R-D1.) |
| D8R-Q11 | 2026-04-29 | Recipe auto-tagging | Adding recipe ingredients to needs auto-applies the tags of the current view (when added from within a view). User can edit tags before submit. Time-window tags use derived hierarchy at query time. **Refined in Q24.** |
| D8R-Q12 | 2026-04-29 | Combine UX | Needs stay separate at add-time. Views render display-merged when merge predicate matches (predicate explicit in Q28 / confirmed by Q36). |
| D8R-Q13 | 2026-04-29 | Are pantry staples always supplies | Supplies broader category; pantry staples are cooking-ingredient subset. |
| D8R-Q14 | 2026-04-29 | Supply identity flexibility | Same as needs: `ingredient_id` (cooking) OR `custom_name` (custom). NOT NULL CHECK constraint for one-or-the-other. |
| D8R-Q15 | 2026-04-29 | Quantity on supplies | Status enum only for F&F. Quantitative scale deferred. |
| D8R-Q16 | 2026-04-29 | Composable views | AND-composable across dimensions for F&F. Multi-value within dimension supported. Cross-dimension OR deferred. |
| D8R-Q17 | 2026-04-29 | Personal supplies | ~~θ — Optional `for_user UUID NULL` field on supplies + needs.~~ **SUPERSEDED by Q27** (multi-user array). |
| D8R-Q18 | 2026-04-29 | Migration of existing pantry data | Nuke. No backfill. |

#### Design decisions from wireframe iteration (Q19-Q27, 2026-04-29 wireframe rounds 1-3)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q19 | 2026-04-29 | Default view set | 4 default views ship pre-baked: **Tonight** (urgency=today), **This week** (urgency=this-week, includes today via derived hierarchy), **All needs** (status=need), **In cart** (status=in_cart). Defaults non-deletable but hidable from Lists home. Filter rule visible as small subtitle on view card (settles P8R-D6). |
| D8R-Q20 | 2026-04-29 | Regulars zone | View detail screens show a "Regulars" zone — supplies whose tags match the view's filter, sorted out → low → in_stock. **Collapsed default** = one-line status summary. **Expanded** = full-screen multi-select list; out items pre-selected on open. "+ Add new supply" routes to Tab 12 supply-create flow (per Q33). |
| D8R-Q21 | 2026-04-29 | Configure-once-and-done | The supply IS the configuration. Add-to-needs sheet is context-aware: existing supply → fast path; new item → full configure with optional "Save as regular" toggle. |
| D8R-Q22 | 2026-04-29 | Supply detail structure | First-class sections: **Stores**, **Brands**, other Tags. For-user demoted to settings row + multi-select sub-sheet. Two CTAs: Add to needs + Restock. State cycle strip (tap-to-set per Q30). Activity log. |
| D8R-Q23 | 2026-04-29 | Edit-routing on spawn toast | Toast on supply→out spawn has Edit + Undo. Edit modal: quantity, tag chips, "Update default routing" toggle. Toggle ON updates supply's tags. (Toggle hidden conditionally per Q34.) |
| D8R-Q24 | 2026-04-29 | Recipe-add UX simplified | Inline buttons + popup modal with urgency picker only. No store/list picker. |
| D8R-Q25 | 2026-04-29 | View detail render modes | Three render modes: **Tier** / **Aisle** / **Flat**. Per-view persisted preference. (Aisle is render mode, NOT tag dimension — see Q29.) |
| D8R-Q26 | 2026-04-29 | Supplies grid render | Two render modes: **List view** (default) and **3-col grid**. Out + Low pulled to combined attention section with visual sub-section labels. Search bar (per P8R-D7 RESOLVED). |
| D8R-Q27 | 2026-04-29 | Multi-user `for_user` (REOPENS Q17) | `for_user UUID NULL` → **`for_user_ids UUID[]`**. Empty array = household-shared. Multi-select sub-sheet UI. Inheritance: needs inherit from parent supply on spawn. (Write-path semantics refined by Q37.) |

#### Design decisions from audit pass (Q28-Q34, 2026-04-29 audit review)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q28 | 2026-04-29 | Recipe combine merge predicate | Two needs render display-merged when ALL match: same identity + same unit + same store tags as set + same `for_user_ids` as set. Recipe attribution does NOT block merge. Urgency tags don't block merge. **Confirmed and rationalized by Q36.** |
| D8R-Q29 | 2026-04-29 | Aisle as render-only | Aisle is a render mode (Q25), NOT a user tag dimension. Computed at query time from `ingredients.typical_store_section`. Dropped from Q1 dimensions. |
| D8R-Q30 | 2026-04-29 | State-cycle UI pattern split | List = tap-to-cycle (speed). Detail = tap-to-set (precision). Intentional. |
| D8R-Q31 | 2026-04-29 | "Everyone" rendering | ~~UI synthetic. Empty array AND explicit-all-current-members both render as "Everyone."~~ **SUPERSEDED by Q37** (which adds the write-path rule that completes the semantics). |
| D8R-Q32 | 2026-04-29 | Status filter default | List creator's Status section defaults to **Need only**. Multi-status views permitted but advanced. Footnote in creator clarifies. |
| D8R-Q33 | 2026-04-29 | "+ Add new supply" routing | "+ Add new supply" on Expanded Regulars routes to **supply-create flow (Tab 12)**, NOT add-to-needs. Captures "track without needing now." Exception: state=Out picked → need auto-spawns on save (consistent with Q10). |
| D8R-Q34 | 2026-04-29 | Edit modal toggle visibility | "Update default routing" toggle hidden when need has no parent supply. Footnote: "No update-default toggle — this need has no parent supply." |

#### Decisions from audit follow-up (Q35-Q37, 2026-04-29 audit reply)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q35 | 2026-04-29 | Supply create initial state restriction | Supply-create surface (Tab 12) restricts initial state picker to **In stock / Low / Out only**. Critical state OMITTED from initial picker — it's a transitional state that only emerges via state-cycling after first registration, not a valid initial state. Document at CP5 implementation that the omission is deliberate. Wireframe (v3 Tab 12) is consistent with this rule. |
| D8R-Q36 | 2026-04-29 | Recipe combine predicate (audit confirmation) | **Confirms Q28** with explicit rationale: store-distinct needs represent intentional separate purchases ("1 bottle from each store"); user-distinct needs represent different intended owners. Merging either would erase user intent. **CP1 schema flag:** the merge query needs efficient indexing on `(ingredient_id, unit, store_tags, for_user_ids)`. Likely a composite index or derived hash for query performance — designed at CP1. |
| D8R-Q37 | 2026-04-29 | `for_user_ids` write-path semantics (SUPERSEDES Q31) | **Write rule:** "Everyone" UI selection → writes **empty array** (means "household-shared, all current and future members" — forward-compatible). Explicit subset → writes the array verbatim (frozen subset; immune to membership changes). NEVER auto-populate empty selection with current member UUIDs. **Render rule** (unchanged from Q31): empty array OR explicit-all-current-members both render as "Everyone"; explicit subset renders as "Tom + Mary"-style summary. **Schema unchanged:** `for_user_ids UUID[]`, no flag column. The empty-vs-explicit semantic distinction matters when household composition changes. |

#### Decisions from lot tracking iteration (Q43-Q60, 2026-05-05 → 2026-05-06 wireframe sessions v1+v2)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q43 | 2026-05-06 | Lot tracking opt-in (REOPENS Q4 / P8R-D4) | Add `supplies.tracks_lots BOOLEAN DEFAULT false`. When true, supply tracks individual lots (`supply_lots` table) with qty, storage, expiration. When false, today's status-only behavior preserved. **Reverses P8R-D4** ("status enum sufficient") for opt-in cases driven by Tom's real-life cases: chicken pack inventory, fresh-vs-frozen variants, multi-bag staples, eventual receipt scan. Status enum still sufficient for the 80% case (olive oil, lemonade, eggs in simple use). |
| D8R-Q44 | 2026-05-06 | Lot qty=0 auto-flips status to out | When all lots on a tracks_lots supply reach qty=0 (whether via cook depletion, manual edit, or explicit consume), supply.status auto-flips to `out`. This is the only mechanical coupling between lots and status. |
| D8R-Q45 | 2026-05-06 | Lot add auto-restocks status | When a lot is added to a tracks_lots supply currently in low/critical/out status, supply.status auto-flips to `in_stock`. Edge case (small lot added but supply still genuinely low): toast shows "Status updated to In stock — undo?" with 5s auto-dismiss. |
| D8R-Q46 | 2026-05-06 | Lot fields | `supply_lots`: id, supply_id (FK), quantity NUMERIC, quantity_unit TEXT, storage_location TEXT, acquired_at TIMESTAMPTZ DEFAULT NOW, expires_at TIMESTAMPTZ NULL (computed default = acquired_at + ingredient.shelf_life_days_<storage>; user-overridable), variant_label TEXT NULL, brand TEXT NULL, notes TEXT NULL, consumed_at TIMESTAMPTZ NULL (soft-delete), search_vector tsvector. |
| D8R-Q47 | 2026-05-06 | Storage move recomputes expiration | When a lot's `storage_location` changes (e.g., fresh→freezer to extend shelf life), `expires_at` recomputes from current date + new-storage shelf-life — UNLESS user has previously overridden expires_at, in which case the override is preserved. Toast: "Expiration updated: now Feb 6 (was May 9)" for affordance discoverability. |
| D8R-Q48 | 2026-05-06 | Lot consume → auto-archive | When lot qty reaches 0 (via cook depletion or manual edit), set `consumed_at = NOW()`. Manual "mark consumed" available on lot row in SupplyDetail for cases where depletion didn't fire (ate raw, gave away, threw out). Archived lots excluded from active aggregations; remain queryable for activity history. |
| D8R-Q49 | 2026-05-06 | Variant model — variant_label vs separate supplies | Default: ONE supply per ingredient with `variant_label` per lot for sub-types ("bone-in skin-on" / "boneless skinless" / "fresh" / "frozen"). Fresh/frozen specifically is implicit from storage_location, not variant_label. variant_label is the escape hatch for catalog-imperfection cases. Power users can opt to model variants as separate supplies (different ingredient_id parents or different supply rows under same ingredient_id) when they want store/tracking-mode distinctions per variant. F&F doesn't need bulk migration tooling for variant-to-supply splits. |
| D8R-Q50 | 2026-05-06 | Variant sub-headers in lots list | When a supply has 2+ distinct variant_label values, lots list inside the expand panel renders variant sub-groups: each with collapsible header (variant name + count + summary stats), independently expandable. Single-variant supplies show flat list, no headers. |
| D8R-Q51 | 2026-05-06 | Search-within-lots affordance | Search input inside the lots list when a supply has 4+ lots. Filters lots by all the same dimensions as global search (variant_label, brand, storage, notes, for_user_ids, expiration window). Below the global threshold, scanning works fine. |
| D8R-Q52 | 2026-05-06 | Cook depletion default = oldest-first across lots | Depletion plan draws from oldest-expiring compatible lot first. When no single lot has enough, draws from oldest-first then next-oldest until quota met (cross-lot decrement). Lots that hit qty=0 auto-archive (Q48). User can override per-ingredient via lot picker (multi-select) in the depletion banner. Existing rollback / spawn-on-out semantics preserved. |
| D8R-Q53 | 2026-05-06 | Cook does NOT auto-demote status (REVERSES prior 8R-CP3 rule) | Previous 8R cook depletion logic (`cookTransition` in `cookDepletionService`) demoted supply status one step per cook regardless of recipe scale. New rule: tracks_lots supplies decrement lot qty only (status auto-flips to `out` only when total qty=0 per Q44). Non-tracks_lots supplies do nothing on cook — user manages status manually. Rationale: previous rule too aggressive ("5 cooks of olive oil per week marked it out by Sunday"). Per-supply auto-demote toggle deferred to P8R-D31 (post-F&F). |
| D8R-Q54 | 2026-05-06 | Status cycle preserved on lot supply badges | Tap on the lot-aware badge (number + unit icon) cycles `supply.status` exactly like tap on the 5-circle dots cycles a non-lot supply. Number doesn't change; color and label do. The two badge types are visually distinct (5-circle dots vs numeric badge) but interactively identical. **OVERRIDDEN 2026-05-14 — see D8R-Q54-OVERRIDE below.** |
| D8R-Q55 | 2026-05-06 | Accent color always mirrors status | The supply row's left-bar accent color is driven by `supply.status` only, not by lot expiration urgency. Soonest-expiring lot urgency surfaces via the lot row's own warn-border + "exp in Xd" text (visible when expanded). Decoupled — prevents accent flicker when a single lot crosses an expiration threshold. The pantry's "Attention" section is the right place to surface "berries expiring soon" via expiration flag (post-F&F enhancement; tracked as P8R-D33). |
| D8R-Q56 | 2026-05-06 | Search dimensions across supply + lot | Multi-token AND across: ingredient.name/plural_name/family/ingredient_type, supply.custom_name/brands, supply tags (stores/dietary/custom), lot.variant_label/brand/notes, lot.storage_location (via synonym map), for_user_ids. Tokens AND across results — every token must match at least one dimension on the surfaced supply (or one of its lots). |
| D8R-Q57 | 2026-05-06 | Search infrastructure: server-side tsvector | Server-side full-text search via PostgreSQL tsvector + GIN index, exposed through RPC `search_supplies(query_text, space_id)`. Triggers maintain tsvector on supply + lot writes. Storage synonym map applied at RPC level (query expansion: token "frozen" → token list "frozen | freezer"). Adds ~5-7 days to CP6e budget vs client-side filter alternative; explicitly accepted per "build it correctly" directive. F&F target slips ~1 week. |
| D8R-Q58 | 2026-05-06 | Storage synonym map | Static client-side const + server-side equivalent: "frozen" → freezer; "fridge"/"refrigerated"/"cold" → fridge; "shelf"/"cupboard"/"pantry" → pantry; "room temp"/"counter" → counter. Applied as query expansion at search time. |
| D8R-Q59 | 2026-05-06 | Catalog plural_name audit (CONFIRMS P8R-D20 within CP6e scope) | Set `plural_name = NULL` for mass nouns and uncountables. Display logic already handles NULL gracefully via `plural_name && qty > 1 ? plural_name : name`. Bundles with broader catalog data audit (P8R-D20). Run as parallel CC workstream during CP6e build. |
| D8R-Q60 | 2026-05-06 | tracks_lots toggle hidden when lots exist | When user opens SupplyDetail and the supply has 1+ active (non-archived) lots, the "Track quantity / lots" toggle is hidden. To toggle off, user must first archive all lots (overflow menu → "Archive all lots"). Avoids destructive confirmation modal; makes the destructive action discoverable through the menu rather than an accidental toggle flip. |

#### Override applied during CP6e smoke (2026-05-14)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| **D8R-Q54-OVERRIDE** | 2026-05-14 | LotBadge tap behavior (REVERSES Q54) | **Q54 said:** "Tap on the lot-aware badge (number + unit icon) cycles `supply.status` exactly like tap on the 5-circle dots cycles a non-lot supply." **OVERRIDE:** During CP6e-SmokeFix-SF2, `handleLotBadgeTap` was changed to call `onToggleExpanded()` instead of `cycleSupplyStatus`. **Rationale:** smoke surfaced that the lot-badge-cycles-status behavior was confusing in context — users tapping the badge usually want to see the lots (which gives them the underlying information needed to decide if the status assignment is right), not advance the status state. The 5-circle pattern stays interactive for non-lots supplies; lots supplies use the badge as a display + expand affordance, with status assignment happening explicitly in SupplyDetail's state-cycle strip. **Code reflects this. Q54 stays in the decisions log as the original design intent; this row is the binding rule.** The concept-section text remains aligned to Q54 narrative for non-lots cases; lots-case behavior is the override. |

---

## Deferred items — Phase 8R (P8R-D series)

Status as of v0.7 (2026-05-15). Full descriptions for each item live in `DEFERRED_WORK.md`. The post-smoke residual items P8R-D34 through D38 (UnitPicker null-mode adoption, `'pieces'` hardcoded fallback, legacy `supplyMatchesQuery`, D8R-Q54-OVERRIDE wireframe-divergence marker, CP6e PK staleness) were reconciled into `DEFERRED_WORK.md` v5.20 and are tracked there.

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

## Wireframe reference

### Phase 8 (8A–8C era) wireframes — `docs/wireframes/phase_8/`

Three HTML prototypes:
- **v3** — staples split taps, 3-tier grocery, Ingredient Detail hero+tabs, cook post A/B/C options, freezer cleanout full actions
- **v4** — adds recipe ingredient overlay sheet (later replaced), grocery recipe chips + linked quantities, view toggle cross-cutting pattern, natural search tab, freezer collapsed rows, browse 3-zone layout
- **v5** — final. Unknown state for staples, softer "out" treatment with auto-sort, recipe tab uses existing Phase 6G layout + inline tap-sheet (no overlay), locked filter chip pattern on subset pages, browse collapsed filter row

v5 is the primary 8A–8C reference; v3/v4 show evolution if context needed.

### Phase 8R wireframes — `docs/wireframes/phase_8r/`

See the "Wireframe reference (8R)" sub-section within the 8R sub-phase above. `phase_8r_wireframes_v3.html` (12 surfaces, base 8R UX) + `phase_8r_lots_wireframes_v2.html` (10 surfaces, CP6e-Lots) + `phase_8r_wireframes_README.md`. Implementation has diverged at D8R-Q54-OVERRIDE — code is authoritative.

---

## Claude Code prompts issued

The original Phase 8 first three prompts were drafted as `DRAFT_CC_PROMPT_1_8A-CP1_schema_foundation.md`, `DRAFT_CC_PROMPT_2_8B-CP1_staples_service.md`, `DRAFT_CC_PROMPT_3_8B-CP2_staples_ui.md`. 8R execution prompts (8R-CP1 through CP6e + SmokeFix series) live in `docs/` and `docs/archive/prompts/`. The full prompt history is in the repo git log and `SESSION_LOG.md`.

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-15 | merged | **Phase 8 and Phase 8R merged into single PHASE_8_PANTRY_AND_GROCERY.md.** All sub-phase content + decisions logs + deferred items preserved from both source docs verbatim. 8C-CP5-CP8 + 8C-Shared CP3-CP4 remain marked 🟡 SUPERSEDED inline. 8R content gains v0.7 closeout state (CP6e shipped, smoke clean 2026-05-15, D8R-Q54 OVERRIDE). Original `PHASE_8_PANTRY_INTELLIGENCE.md` and `PHASE_8R_UNIFIED_NEEDS.md` moved to `docs/archive/phases/`. |

### Phase 8R changelog (from PHASE_8R_UNIFIED_NEEDS.md)

| Date | Version | Change |
|------|---------|--------|
| 2026-05-15 | v0.7 | **Mid-closeout reconciliation.** CP6d/CP6e completion captured in build plan table. Smoke validation gate passed clean 2026-05-15. D8R-Q54 OVERRIDE entry added to decisions log (LotBadge tap = expand-row, not cycle-status per CP6e-SmokeFix-SF2). P8R-D series status updated: D4/D6/D7/D20/D24/D25/D26/D28 RESOLVED; D27 partially resolved (lot-entry scope shipped; AddNeedSheet/EditNeedSheet null-mode adoption is post-F&F follow-up); D29 stub shipped, full deferred. Scope section now lists shipped state rather than planned state. Remaining 8R closeout enumerated. |
| 2026-05-06 | v0.6 | **Lots model added (CP6e). 18 new design decisions (Q43-Q60).** Reopens P8R-D4 (quantitative tracking) as opt-in `tracks_lots` flag. Reverses prior 8R cook auto-demote rule (Q53). Adds server-side tsvector search (Q57). New CP6e split into Schema → Services → PantryUI → FlowsUI sub-checkpoints + catalog audit parallel workstream. Wireframes at `docs/wireframes/phase_8r/phase_8r_lots_wireframes_v2.html`. F&F target slips from late July/August to late August/early September (~3 weeks total addition: lots schema + services + tsvector + UI rebuild). 5 new deferred items (D22, D23, D31, D32, D33 — D24-D26 already taken by CP6d entries; renumbered at merge time). 0 decisions superseded; 1 reopened. |
| 2026-04-30 | v0.5 | CP5a + CP5b shipped; CP6 split into a/b/c. Pantry/grocery-era purge milestone reached (zero deleted-service imports across project). Smoke test (2026-04-30) confirmed CP5 surface working; surfaced 5 UX additions + 1 regression (RecipeDetailScreen pantry-match) + 1 soft regression (PantryScreen blank on first launch — resolved by restart, not reproducible). CP6a (services + polish) → CP6b (Tab 12 + Tab 9) → CP6c (cart visibility + bulk acquire + cleanup). |
| 2026-04-29 | v0.4 | **Audit follow-up resolution — 3 new decisions (Q35-Q37).** Audit instance reviewed v3 wireframes + v0.3 PHASE_8R; raised 3 follow-up questions; Tom resolved all three. **Q35** Supply-create initial state restricted to in_stock/low/out (Critical only via state-cycling; not a valid initial state). **Q36** Confirms Q28 recipe combine predicate with explicit rationale (store-distinct = intentional separate purchases; user-distinct = different intended owners) + flags CP1 schema indexing on `(ingredient_id, unit, store_tags, for_user_ids)`. **Q37** Refines Q31 with write-path semantics: "Everyone" UI selection always writes empty array (= household-shared, all current AND future members; forward-compatible); explicit subset writes verbatim (frozen). **Q31 SUPERSEDED by Q37.** Architectural-concept and build-plan sections updated. Wireframes unchanged visually (Q35 already shown; Q36 confirmed; Q37 not visualizable). |
| 2026-04-29 | v0.3 | **Audit pass + wireframe v3 completed.** Async audit instance reviewed v1 consolidated wireframes; flagged 8 substantive issues + 1 gap. All addressed in v3. **7 new design decisions captured (Q28-Q34):** Q28 recipe combine merge predicate; Q29 aisle as render-only; Q30 state-cycle UI pattern split; Q31 "Everyone" rendering semantics; Q32 status filter default Need-only; Q33 "+ Add new supply" routes to Tab 12; Q34 edit modal toggle conditionally hidden. P8R-D7 RESOLVED. P8R-D11 added. New Tab 12 supply-create flow. Final wireframes consolidated to single file at `docs/wireframes/phase_8r/phase_8r_wireframes_v3.html`. |
| 2026-04-29 | v0.2 | **Wireframe iteration complete — 9 new design decisions added (Q19-Q27).** 11 surfaces wireframed across two HTML chunks with 3 iteration rounds. Q19 default view set; Q20 Regulars zone; Q21 configure-once-and-done; Q22 supply detail structure; Q23 edit-routing on spawn toast; Q24 recipe-add simplified; Q25 view detail render modes; Q26 supplies grid render; Q27 reopens Q17 with multi-user `for_user_ids UUID[]`. P8R-D6 RESOLVED. P8R-D7-D10 added. |
| 2026-04-29 | v0.1 | Initial draft. Captures 2026-04-29 design walkthrough decisions (D8R-Q1 through Q18) and 6-CP build plan. F&F target slips to late July or August. |

### Phase 8 changelog (from PHASE_8_PANTRY_INTELLIGENCE.md)

| Date | Change |
|------|--------|
| 2026-04-29 | **v2.15 — Phase 8R reframe + wireframe iteration + audit cycle complete; 8C-Shared sub-phase + remaining 8C numbered CPs SUPERSEDED.** After 8C-Shared CP1 + CP2 + CP2b + CP2b.1 shipped 2026-04-28 with full Tom + Mary smoke test, 2026-04-29 design walkthrough surfaced architectural concern with the lists-as-containers model. Tom committed to a foundational refactor: replace lists-as-containers with filter-views over a unified household-needs bag. Pantry "staples" + grocery "list items" merge into one model with status enums (supplies cycle in_stock/low/critical/out; needs cycle need/in_cart/acquired). Tags handle store/urgency/recipe/etc. dimensions; views are saved filter expressions presented as "lists" in UI. Supply transitions to `out` auto-spawn needs. Multi-user (subset) supplies via `for_user_ids UUID[]` with empty-array-means-all-current-and-future-members write semantics (per Q27/Q37 — supersedes Q17 and Q31). Multi-store membership eliminates the cross-list duplicate problem. F&F target slips from early-to-mid June to **late July or August**. Phase doc: `PHASE_8R_UNIFIED_NEEDS.md` v0.4 — 37 architectural decisions (D8R-Q1 through D8R-Q37) + 6-CP build plan. Same-day wireframe iteration completed in 3 rounds + audit pass + audit follow-up: 12 surfaces wireframed in single consolidated file (`docs/wireframes/phase_8r/phase_8r_wireframes_v3.html`); 19 new design decisions captured (Q19-Q37); P8R-D6 + D7 RESOLVED (D6 view-rule visibility; D7 search affordance F&F-prereq); P8R-D8 through D11 added. CP1 schema design is the next CC handoff. Existing 8C-Shared schema + work shipped 2026-04-28 becomes throwaway; existing pantry + grocery data nuked at 8R-CP1 (no migration). 8D + 8E push to after 8R completes. |
| 2026-04-28 | **v2.14 — 8C-Shared-CP2 complete (service widening + sharing toggle + P8-16 consolidation; smoke-tested end-to-end).** Tom + Mary cross-user smoke test verified RLS widening works as designed: Mary sees shared lists, can add/check-off items; cannot see private lists; cannot delete shared list (RLS-enforced). Three core scope items shipped: (1) service-query widening — `getUserGroceryLists` + `getUserGroceryListsWithCounts` dropped owner-only filter + gained `space:spaces(name)` join (returning new `GroceryListWithSpace`/-`WithCounts` re-rooted types); `getOtherListsContainingIngredient` widened per D8C-Shared-5 XL2 (absorbed from CP3 scope — CP3 narrows). (2) P8-16 consolidation — service-internal `CreateGroceryListParams` deleted, canonical imported, `createGroceryList` resolves user via `auth.getUser()`, 4 call sites updated; CP1's `space_id?` → `spaceId?` rename for camelCase consistency (zero callers, non-breaking). (3) Inline toggle/picker added to create-list modal (which is inline in GroceryListsScreen, not standalone) per D8C-Shared-8 CF1 + new D8C-Shared-CP2-3 (first-created picker default). Three downstream scope shifts captured: CP3 narrowed (~1.5hr → ~1hr); CP4 expanded with non-owner-delete UI gating + item-delete confirmation friction (+0.5hr); three new deferred items P8-24/25/26 logged in DEFERRED_WORK v5.16 (P8-24 = `GroceryListDetailScreen` add-to-list placeholder is F&F-blocker; P8-25/26 = create-modal polish). All living-doc edits per Edit 1-7 of CC's doc-hygiene prompt. |
| 2026-04-28 | **v2.13 — 8C-Shared-CP1 complete (schema + RLS + migration; F&F-prerequisite first CP).** Migration applied to live Supabase by Tom in planning chat 2026-04-28; all 15 DB-state verification checks pass; CC moved file to `supabase/migrations/20260428_phase_8c_shared_cp1_schema.sql` and extended `lib/types/grocery.ts` with three type additions (`GroceryList.space_id`, `GroceryListItemRecipe.added_by`, `CreateGroceryListParams.space_id?`). Two notable revisions during planning + execution: v2 audit surfaced that CP2a's `grocery_list_item_recipes` parent-ownership RLS would silently break for shared-list members in CP3 (recipe pills failing to render junction rows owned by partner) — junction RLS widening folded into CP1 scope via parent-RLS-delegation pattern (`EXISTS (SELECT 1 FROM grocery_list_items gli WHERE gli.id = ...)`, inheriting parent's RLS automatically); v3 planning verification surfaced 9 orphan legacy policies across 3 tables using a third pre-existing naming convention beyond the two defensive DROPs covered — dropped via ad-hoc cleanup, then folded into the migration as Section 5c for replayability. 5 existing lists backfilled to "Home" space. Tom added Mary Frigo to "Home" as one-off prerequisite SQL. `tsc --noEmit` clean. 8C build-plan-table flipped to 🟡 in-progress. CP4b execution remains paused pending CP2-CP4 completion. No new deferred items. |
| 2026-04-27 | **v2.12 — 8C-CP4a complete + 8C-Shared sub-phase scoped + CP4b paused + CP4c queued.** 8C-CP4a `running_low` routing + pill differentiation + P8-20 fold-in shipped. Net effect: staple→grocery routing now covers both `'out'` and `'running_low'` transitions; pill renders use structural `source_staple_id` field (closes P8-20 substring brittleness); amber for low + red for out variants. **New 8C-Shared sub-phase scoped (F&F-prerequisite):** 4 CPs (~7hr) adding `grocery_lists.space_id` for optional space-sharing, default-shared list creation, edit permissions, routing/CP2/attribution updates, UX visibility. Migration approach (D8C-Shared-2): all existing lists default-share to "Home" space. 8 new shared-phase decisions D8C-Shared-1..8. **CP4b paused** pending 8C-Shared completion — D8C-CP4b-1..4 captured for design traceability. **CP4c queued** for pantry layout overhaul. 8C build-plan row updated. |
| 2026-04-27 | **v2.11 — 8C-CP4 complete (staple → grocery auto-routing + P8-19 fold-in).** When a staple transitions to `'out'`, routing service auto-creates or promotes a row on the user's most-recently-updated active grocery list with `priority='needed'`, `priority_reason='staple · out'`, `source_staple_id` linked, `added_from='staple'`. Stage 1 dedup matches existing `source_staple_id`; Stage 2 matches by `ingredient_id`/`custom_name` and backfills the link; Stage 3 inserts new row. Reverse direction: checking off a staple-routed grocery item restores the staple to `'good'` and bumps `last_confirmed_at`. Schema diff: `source_staple_id UUID` column on `grocery_list_items` + partial index + `'staple'` added to `added_from` CHECK enum. Migration applied 2026-04-27. Smoke-tested 7 of 8 high-signal paths. P8-19 folded inline as Task 1. Three new deferred items: P8-20, P8-21, P8-22. 8 new decisions D8C-CP4-1 through D8C-CP4-8. 8C build-plan row updated: 4 of 8 numbered CPs done. |
| 2026-04-27 | **v2.10 — 8C-CP3 complete (Compact/Detailed view + recipe pills + filter-by-recipe).** Largest CP of 8C so far — final UX layer for grocery. Original chip-bar spec reframed during 2026-04-27 wireframe design pass after Tom's feedback that always-on annotations were too visually heavy. Final UX: per-list view-mode (Compact default / Detailed opt-in, persisted via new `grocery_lists.view_mode` column), inline recipe pills + staple pills replacing the existing CP1 priority_reason subtitle, tappable pills filter-by-recipe, multi-recipe disambiguation via bottom-sheet modal, "Showing: {recipe} ×" filter chip while active. Implementation spans schema + canonical types + 2 new service functions + GroceryListItem rewrite + screen widening with 4 inline subcomponents. Two new decisions: D8-40, D8-41. Smoke-tested 7 of 8 paths verified. 8C build-plan row updated: 3 of 8 numbered CPs done. |
| 2026-04-27 | **v2.9 — 8C-CP2a complete (recipe attribution junction table data layer).** Data-layer prerequisite for 8C-CP3 — discovered during CP3 design pass that the existing single-`recipe_id`-per-item model couldn't support CP3's wireframe requirements. New `grocery_list_item_recipes` junction table replaces the model. 18 legacy rows backfilled. Service rewrote `addItemToList` with junction-aware paths; new `getRecipesForItem` + `getItemsWithRecipes` functions. `AddRecipeToListModal` updated. Smoke-tested all 4 verified paths. Inline fix for `added_from` enum bug (`'template'` → `'regular'`). Also flagged P8-19. No new D8-* decisions. CP3 unblocked. |
| 2026-04-27 | **v2.8 — 8C-CP2 complete (cross-list checkoff-moment confirmation; spec redirected during design pass).** Original CP2 spec (passive always-visible subtitle + 4-hour auto-dismiss) reframed during 2026-04-27 design pass to a checkoff-moment prompt only. Implementation: new `CrossListPrompt` component modeled on `CookDepletionBanner`, service functions for cross-list query + bulk delete, wiring in `GroceryListDetailScreen.handleToggleItem` on check-on transitions only. Two new decisions: D8-38, D8-39. One new deferred row: P8-18. 8C build-plan row updated: 2 of 8 numbered CPs done. |
| 2026-04-27 | **v2.7 — 8C-CP1b complete (data backfill).** Heuristic-SQL backfill applied to `ingredients.typical_store_section`: 314 null rows resolved via `(family, ingredient_type)` mapping; 2 capitalized anomalies normalized to lowercase. Closes P8-15. Plant-based protein subclass distinction parked as P8-17. |
| 2026-04-27 | **v2.6 — 8C-CP1 + 8C-CP1a complete; 8C sub-phase in progress.** 8C-CP1 (grocery 3-tier restructure + service alignment) shipped + smoke-tested 2026-04-27. 8C-CP1a (store_name schema migration + lists counts refresh on focus return) shipped same day as patch-up. Four new decisions: D8-34, D8-35, D8-36, D8-37. Two new post-F&F items: P8-15, P8-16. 8C build-plan row flipped to 🟡 In progress. |
| 2026-04-23 | **v2.5 — 8B-CP4 complete; 8B sub-phase complete.** 8B-CP4 (cook-post depletion banner) shipped + smoke-tested 2026-04-23 with 4 in-session fixes. 8B overall now ✅ Complete (all 4 checkpoints + 8B-CP3a patch). Three new decisions D8-31/32/33. Two post-F&F items added to DEFERRED_WORK: P8-13, P8-14. |
| 2026-04-23 | **v2.4 — 8B-CP3a patch-up log.** D8-30 records the 6-fix UX patch-up applied to 8B-CP3. No scope change. |
| 2026-04-23 | **v2.3 — 8B-CP3 scope swap.** Add/Manage Staples UI replaces Bulk pre-populate tooling (D8-29). |
| 2026-04-23 | **v2.2 — Second-audit polish pass.** D8-25 rationale extended; 8A-CP3 scope clarified; 8C-CP5 stub-handler wiring TODO names specific call sites. No structural changes. |
| 2026-04-23 | **v2.1 — Second-pass rewrite addressing first audit findings.** Sub-phase restructure: schema foundation moved 8B-CP1 → 8A-CP1. Staple color softening merged into 8B-CP2. Stub-handler cleanup folded into 8C-CP5. Fraction display restored as 8A-CP3. Decision IDs D8-1 through D8-28 added. `default_aisle` dropped (D8-27). Brand schema additions dropped (D8-28). `last_confirmed_at` backfill added (D8-25). State naming standardized on `running_low`. Session estimate 16-23 → 18-28. |
| 2026-04-23 | v2.0 — Full content rewrite following wireframe session. Replaced by v2.1 above. |
| 2026-04-22 | v1.0 — initial post-7 scaffold. |
| 2026-04-22 | v0.1 scaffold created via commit c6c2438. |
| 2026-03-17 | Original scaffold. |
