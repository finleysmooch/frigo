# [DRAFT] CC Prompt — Phase 8C-CP3 — Compact/Detailed toggle + recipe pills + filter-by-recipe

> **⚠️ DRAFT v1 — 2026-04-27.** Largest CP of 8C so far. Pending Tom's audit before handoff to Claude Code.

**Session type:** Schema migration + service consumption + UI rewrite of GroceryListDetailScreen + GroceryListItem
**Checkpoint:** 8C-CP3 — Final UX layer for grocery: per-list view mode (Compact/Detailed) toggle, recipe + staple pills inline on rows, tappable pills filter-by-recipe with disambiguation sheet for multi-recipe items.
**Estimated duration:** 2.5-3.5 hours
**Dependencies:** 8C-CP1 + CP1a + CP1b + CP2 + CP2a complete. Junction table populated; `getItemsWithRecipes(listId)` available; `priority_reason` rendered as subtitle today (CP1).

---

## Context

The wireframes signed off 2026-04-27 define this CP's UX. Three states:

**Compact (default).** Identical to current CP1+CP2 layout — tier headers, aisle subheaders, name + qty + checkbox. The existing `priority_reason` subtitle for staples ("staple · out") is REPLACED by an inline staple pill on the row's name line (red/error pill), so subtitles disappear entirely on rows. A single new toggle icon in the list header lets the user switch to Detailed.

**Detailed (opt-in, per-list persisted).** Adds two surfaces:
- A "For: {recipe1} · {recipe2} · {recipe3}" strip below the list header showing all recipes referenced by items on the list (truncates with ellipsis past screen edge).
- Inline recipe pills on each recipe-linked row's name line. Single-recipe items show `[Lasagna]` (blue/info pill); multi-recipe items show `[2 recipes]` (count form). Staple pills (red/error) coexist with recipe pills on the same row when both apply (warning first, recipe second).

**Filter-by-recipe.** Pills are tappable in Detailed mode. Tapping a single-recipe pill `[Lasagna]` or any pill in the strip filters the list to only items associated with that recipe. Multi-recipe pill `[2 recipes]` opens a small action sheet listing the recipes by name; tap one to filter. While a filter is active:
- Non-matching items hide entirely.
- Items matching `recipe_id` (via junction) AND items still warning as staples (priority_reason='staple · out' OR equivalent — see Constraints) stay visible *only if they're also tied to the filtered recipe*. The filter is strict — recipe association alone determines inclusion.
- The "For: ..." strip is replaced with a `Showing: Lasagna ×` chip at the top. Tap × clears the filter.
- Filter doesn't persist across navigation (returning to the list shows the unfiltered view).

The data layer from 8C-CP2a (junction table + `getItemsWithRecipes`) supplies everything the UI needs. The 18 legacy rows with `grocery_list_items.recipe_id IS NOT NULL` are already backfilled into the junction, so they render correctly without special-case logic.

**Per-list persistence.** Each grocery list remembers its view mode via a new `grocery_lists.view_mode` column (additive migration, default `'compact'`). Tapping the toggle writes to the DB. Existing lists default to compact.

---

## Inputs to read

1. `screens/GroceryListDetailScreen.tsx` — current state (post-CP2). 600+ lines. Key sections:
   - Imports (lines 1-30)
   - Tier model + helpers (lines 30-90)
   - Component setup + state (lines 95-280)
   - `loadItems`, `tierGroups` memo (lines 290-365)
   - `handleToggleItem` (the cross-list prompt site, line ~395)
   - Render block (lines 540-700)
2. `components/GroceryListItem.tsx` — current state (post-CP1 rewrite). Pure presentational row with props `item`, `onToggleCart`, `onAdjustQuantity`, `onMoveTier`, `onDelete`. Renders the existing `priority_reason` subtitle.
3. `lib/groceryListsService.ts` — current state (post-CP2a). `getItemsWithRecipes(listId)` returns items with `recipes?: GroceryListItemRecipe[]` populated. `updateGroceryList` already exists for the view_mode update — verify before drafting code; if not, CP3 adds it.
4. `lib/types/grocery.ts` — current state (post-CP2a). `GroceryListItemRecipe` interface available; `GroceryListItemWithIngredient.recipes?` field available.
5. **Schema reference:** `Supabase_Snippet_DB_Structure_2026-04-27.csv`. Confirms `grocery_lists` table currently has 9 columns: id, user_id, name, emoji, is_active, is_template, sort_order, store_name (post-CP1a), created_at, updated_at. Adding `view_mode` makes 10.

---

## Task

### Part 1 — Schema migration

**Create** `supabase/migrations/20260427_8c_cp3_view_mode.sql`:

```sql
-- Phase 8C-CP3 — grocery_lists.view_mode
-- Per-list persistence of Compact/Detailed view preference.
-- Additive, NOT NULL with default — existing lists backfill to 'compact'.

BEGIN;

ALTER TABLE grocery_lists
  ADD COLUMN IF NOT EXISTS view_mode TEXT NOT NULL DEFAULT 'compact'
  CHECK (view_mode IN ('compact', 'detailed'));

COMMENT ON COLUMN grocery_lists.view_mode IS
  'Per-list UI preference: ''compact'' (default, no recipe annotations on rows) or ''detailed'' (recipe pills + For: strip + filter-by-recipe enabled). Toggled via the list header icon. Added 2026-04-27 (Phase 8C-CP3).';

COMMIT;

-- Rollback (if needed):
-- BEGIN;
-- ALTER TABLE grocery_lists DROP COLUMN view_mode;
-- COMMIT;
```

### Part 2 — STOP for Tom to apply migration

Output:
> Migration staged at `supabase/migrations/20260427_8c_cp3_view_mode.sql`. Tom — please apply via Supabase Dashboard SQL Editor. Recommended order:
> 1. Snapshot for rollback safety:
>    ```sql
>    CREATE TABLE _grocery_lists_pre_cp3_snapshot AS
>    SELECT * FROM grocery_lists;
>    ```
> 2. Apply the migration.
> 3. Run the verification query below.
>
> ```sql
> SELECT column_name, data_type, is_nullable, column_default
> FROM information_schema.columns
> WHERE table_name = 'grocery_lists' AND column_name = 'view_mode';
> ```
> Expected: 1 row, `text`, `NO` (NOT NULL), default `'compact'::text`.

If the verification fails, STOP and report.

### Part 3 — Type updates

**Edit `lib/types/grocery.ts`.**

3a. Add `view_mode` to `GroceryList`:

```ts
export interface GroceryList {
  // ...existing fields...
  store_name: string | null;
  view_mode: 'compact' | 'detailed';   // NEW: Phase 8C-CP3
  created_at: string;
  updated_at: string;
}
```

3b. Add to `UpdateGroceryListParams`:

```ts
export interface UpdateGroceryListParams {
  // ...existing fields...
  storeName?: string;
  viewMode?: 'compact' | 'detailed';   // NEW: Phase 8C-CP3
}
```

(Camelcase per the CP1a precedent.)

### Part 4 — Service additions

**Edit `lib/groceryListsService.ts`.**

4a. Verify or add `updateGroceryList(listId, params)`. If a function with that signature exists, widen it to accept `viewMode` and write `view_mode = params.viewMode` (snake_case for DB column, camelCase for params). If it doesn't exist, add a new exported function:

```ts
export async function updateGroceryList(
  listId: string,
  params: UpdateGroceryListParams
): Promise<GroceryList> {
  // Build update object mapping camelCase params to snake_case columns
  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.emoji !== undefined) updates.emoji = params.emoji;
  if (params.isActive !== undefined) updates.is_active = params.isActive;
  if (params.isTemplate !== undefined) updates.is_template = params.isTemplate;
  if (params.sortOrder !== undefined) updates.sort_order = params.sortOrder;
  if (params.storeName !== undefined) updates.store_name = params.storeName;
  if (params.viewMode !== undefined) updates.view_mode = params.viewMode;
  // ... existing implementation
}
```

If the function already exists in some form, just widen it; don't rewrite from scratch.

4b. Confirm `getItemsWithRecipes(listId)` is exported and returns `Promise<GroceryListItemWithIngredient[]>` with each item's `recipes?: GroceryListItemRecipe[]` populated. If the implementation has any rough edges (e.g., it doesn't gracefully handle items with no junction rows), tighten as needed. Don't rewrite — small fixes only.

### Part 5 — Rewrite `components/GroceryListItem.tsx`

**Wholesale prop widening + render rewrite.** The existing component has props `item, onToggleCart, onAdjustQuantity, onMoveTier, onDelete`. Widen to:

```ts
interface GroceryListItemProps {
  item: GroceryListItemWithIngredient;  // recipes?: GroceryListItemRecipe[] available in detailed mode
  viewMode: 'compact' | 'detailed';
  onToggleCart: (itemId: string, currentInCart: boolean) => void;
  onAdjustQuantity: (itemId: string, currentQty: number, delta: number) => void;
  onMoveTier: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onRecipePillTap?: (itemId: string, recipes: GroceryListItemRecipe[]) => void;  // NEW: only fires in detailed mode
}
```

**Render contract:**

The row layout stays the same. The change is what appears on the **name line** and the elimination of the subtitle:

- **Name line:** `[checkbox] {name} {pills}` where pills are 0+ inline tags rendered horizontally next to the name.
- **No subtitle in either mode.** The existing `priority_reason` subtitle is replaced by a staple pill (red) inline.

**Pill rendering rules:**

1. **Staple-out pill** — render whenever `item.priority_reason === 'staple · out'` OR contains the substring `'staple'` (defensive — the existing CP1 priority_reason values are unstructured; match loosely). Style: red/error background, white text, "staple" or "out" or whatever the priority_reason says (truncate at ~12 chars). Always rendered (in both Compact AND Detailed) — staples are actionable info, not contextual.
2. **Recipe pill (Detailed mode only)** — render based on `item.recipes` array length:
   - 0 recipes (`recipes` empty or undefined): no pill.
   - 1 recipe: pill text = `recipes[0].recipe_title` (truncate at ~14 chars). Tap → `onRecipePillTap(itemId, recipes)` (parent handles).
   - 2+ recipes: pill text = `${recipes.length} recipes`. Tap → `onRecipePillTap(itemId, recipes)` (parent disambiguates via action sheet).
3. **Pill order on row:** staple pill FIRST (most urgent), then recipe pill. Both flex-shrink with the name; name truncates with ellipsis if all pills don't fit.
4. **Pill style — recipe (info/blue):** background `colors.info?.light || '#E6F1FB'`, text `colors.info?.dark || '#185FA5'`, font size xs, weight medium, paddingHorizontal 6, paddingVertical 1, borderRadius 8.
5. **Pill style — staple (error/red):** background `functionalColors.errorLight || '#FEE2E2'`, text `functionalColors.error || '#993C1D'`, same dimensions as recipe pill.
6. **Tap target:** at least 32×32 effective via `hitSlop` for the recipe pill (it's a touchable). Staple pill is non-tappable in this CP.
7. **Compact mode:** Recipe pill never renders. Staple pill still renders. No subtitle.
8. **Backward compat for legacy items** (no junction rows, but `grocery_list_items.recipe_id` is non-null — the 18 legacy rows from before CP2a): The CP2a backfill already inserted these into the junction, so `recipes` will have an entry for them. No special handling needed.

**Don't change:** the checkbox + delete + quantity-adjust UI, the long-press → `onMoveTier` behavior, the row's overall layout/padding. Just the name-line content.

### Part 6 — Inline subcomponents in `GroceryListDetailScreen.tsx`

These three pieces of UI are tightly coupled to screen state, so they live as inline components inside `GroceryListDetailScreen.tsx` rather than separate files:

**6a. `<ViewModeToggle>`** — A small icon button in the list header next to the progress count. Two-state icon pair:
- Compact mode: simple horizontal lines icon (3 stacked lines, equal length).
- Detailed mode: lines-with-detail icon (alternating long and short lines, suggesting more info).
- Tap → flips mode, calls `handleToggleViewMode()`.
- Tap target ≥44×44 via hitSlop. `accessibilityLabel="Toggle detailed view"`.

Icon implementation: use inline SVG via `react-native-svg` (already a dependency). Two `<Path>` definitions, conditionally rendered based on current mode.

**6b. `<RecipeSummaryStrip>`** — Renders below the action-buttons row, visible only when:
- `viewMode === 'detailed'` AND
- `activeFilter === null` (no filter active) AND
- At least one item has `recipes` non-empty.

Layout: single row, padding spacing.md horizontal, padding spacing.sm vertical, background `colors.background.card`, bottom border 1px `colors.border.medium`.

Content: `For: {recipe1} · {recipe2} · {recipe3}` — recipe names ordered by **first-appearance order** (the order recipes appear when iterating items in the current `tierGroups` flow). Truncates with ellipsis past screen edge.

If a tap-to-filter affordance is desired on the strip itself (allowing tap-on-name to filter without a row pill): tap a recipe name → filters to that recipe. Make recipe names individually tappable (each is its own `<Text>` with `onPress={() => handleSetFilter(recipeId)}`). The dot separators are non-tappable.

`accessibilityRole="button"` on each name.

**6c. `<FilterChip>`** — Renders below the action-buttons row when `activeFilter !== null`. Replaces the For: strip when active.

Layout: rounded pill, height ~32, padding horizontal spacing.sm, background `colors.info?.light || '#E6F1FB'`, text `colors.info?.dark || '#185FA5'`.

Content: `Showing: {recipe_title}  ×` — the × is a tappable close button. Tap × → `handleClearFilter()`.

Whole chip is also tappable to clear (forgiving tap target).

**6d. `<RecipeDisambiguationSheet>`** — Bottom-sheet modal (use react-native's `Modal` with `animationType="slide"`, `transparent={true}`, half-screen height). Visible when a multi-recipe pill is tapped on a row.

Layout:
- Header: "Filter by which recipe?"
- List: each recipe row shows name + "{n} items" subtitle.
- Footer: Cancel button.

Tap a recipe row → `handleSetFilter(recipeId)`, modal closes. Tap Cancel → modal closes, no filter set.

State: `disambiguationState: { itemId, recipes } | null`. Set when a multi-recipe pill is tapped; cleared on selection or cancel.

### Part 7 — Wire it all into `GroceryListDetailScreen.tsx`

7a. **State additions:**

```ts
const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');  // hydrated from list.view_mode on mount
const [activeFilter, setActiveFilter] = useState<{ recipeId: string; recipeTitle: string } | null>(null);
const [disambiguationState, setDisambiguationState] = useState<{
  itemId: string;
  recipes: GroceryListItemRecipe[];
} | null>(null);
```

7b. **Hydrate `viewMode` from the list on mount.** Add to the existing `loadItems` flow (or a parallel `loadList` call):

```ts
// After getting currentUserId, fetch the list metadata to get its view_mode
const { data: list } = await supabase
  .from('grocery_lists')
  .select('view_mode')
  .eq('id', listId)
  .single();
if (list) setViewMode(list.view_mode);
```

This is a direct supabase call from the screen — minor exception to "services handle ALL Supabase calls" because it's a single-row metadata fetch. Alternative: add a `getGroceryList(listId)` service function. CC's call. My lean: add the service function, keep the screen pure.

7c. **Switch to `getItemsWithRecipes`.** Replace the existing `getItemsForList(listId)` call with `getItemsWithRecipes(listId)`. Same return shape, plus `recipes?` field.

7d. **`handleToggleViewMode`:**

```ts
const handleToggleViewMode = async () => {
  const newMode = viewMode === 'compact' ? 'detailed' : 'compact';
  setViewMode(newMode);
  try {
    await updateGroceryList(listId, { viewMode: newMode });
  } catch (error) {
    console.error('Failed to persist view mode:', error);
    // Don't revert UI state on persistence error — let the user keep using
    // the new mode for this session even if the write failed. The next mount
    // will hydrate from DB and resync.
  }
};
```

7e. **Filter handlers:**

```ts
const handleRecipePillTap = (itemId: string, recipes: GroceryListItemRecipe[]) => {
  if (recipes.length === 1) {
    handleSetFilter(recipes[0].recipe_id, recipes[0].recipe_title);
  } else {
    setDisambiguationState({ itemId, recipes });
  }
};

const handleSetFilter = (recipeId: string, recipeTitle: string) => {
  setActiveFilter({ recipeId, recipeTitle });
  setDisambiguationState(null);
};

const handleClearFilter = () => {
  setActiveFilter(null);
};
```

7f. **Filter the items in `tierGroups` memo.** Modify the existing memo to filter items before bucketing into tiers:

```ts
const tierGroups = useMemo<TierGroup[]>(() => {
  const filteredItems = activeFilter
    ? items.filter((item) =>
        (item.recipes ?? []).some((r) => r.recipe_id === activeFilter.recipeId)
      )
    : items;

  // ...rest of bucketing logic uses filteredItems instead of items
}, [items, activeFilter]);
```

Note custom items (`ingredient_id IS NULL`) are filtered out implicitly — they have no `recipes`. Acceptable: filter is recipe-driven, custom items are user-managed and live outside that framing.

Also: items that are staples but NOT linked to the filtered recipe disappear when filter is active. Per the spec, the filter is strict (recipe association alone determines inclusion). The `Showing: {recipe} ×` chip makes it clear the user is in filtered view.

7g. **Render the new components.** In the screen's JSX:

- Add `<ViewModeToggle>` to the right of the progress text in the header (or below the action buttons row — pick whichever fits the existing layout cleanly).
- Add `<RecipeSummaryStrip>` immediately after the header `</View>` and before the `<ScrollView>`.
- Add `<FilterChip>` in the same position as `<RecipeSummaryStrip>` (mutually exclusive — only one renders at a time).
- Add `<RecipeDisambiguationSheet>` as a sibling of the existing `<CrossListPrompt>` at the bottom of the screen tree.

7h. **Pass `viewMode` and `onRecipePillTap` to each `<GroceryListItem>` instance:**

```tsx
<GroceryListItem
  key={item.id}
  item={item}
  viewMode={viewMode}
  onToggleCart={handleToggleItem}
  onAdjustQuantity={handleAdjustQuantity}
  onMoveTier={handleMoveTier}
  onDelete={handleDeleteItem}
  onRecipePillTap={handleRecipePillTap}
/>
```

7i. **Don't touch:** all other state (loading, refreshing, currentUserId, collapsedTiers, crossListPromptState), all other callbacks (handleAddItem, handleMoveToPantry, handleDeleteItem, handleAdjustQuantity, handleMoveTier, the cross-list flow), tier headers, tier hints, aisle headers, the existing `<CrossListPrompt>` rendering. CP3 adds; doesn't replace.

### Part 8 — Verification

1. `npx tsc --noEmit --skipLibCheck` — only the 2 pre-existing baseline errors. Zero new.
2. **Smoke test (Tom — interactive):**
   - **Compact default.** Open any list. Toggle icon visible in header. No For: strip, no recipe pills on rows. Existing tier+aisle+row layout intact. Staple-out items (if any) show a red "staple" pill on their name line (replacing the old subtitle).
   - **Detailed toggle persists.** Tap toggle → enters Detailed. Strip appears, recipe pills appear on linked rows. Navigate away. Return to list. Detailed mode still active (verify in DB: `SELECT view_mode FROM grocery_lists WHERE id = '...'` returns 'detailed').
   - **Single-recipe pill filter.** In Detailed mode, tap a single-recipe pill (e.g., "Avocado butter"). List filters to only that recipe's items. Filter chip "Showing: Avocado butter ×" appears. Tap × → returns to unfiltered Detailed view.
   - **Multi-recipe pill disambiguation.** Tap an item showing `[2 recipes]`. Bottom sheet appears listing the 2 recipes by name. Tap one → filter applies. Tap Cancel → no filter set.
   - **Strip-tap filter.** In the For: strip, tap a recipe name (not the dots between). Filters as if the row pill was tapped.
   - **Filter doesn't persist.** Apply filter. Navigate away. Return. Filter is cleared (back to unfiltered Detailed mode).
   - **Compact still has staple pills.** Switch to Compact. Recipe pills disappear. Staple-out pills remain.
   - **Existing functionality intact.** Long-press → tier-move picker still works. Checkbox → cross-list prompt still fires. Tier collapse/expand still works.
3. `git status --short` — expected file changes:
   - `supabase/migrations/20260427_8c_cp3_view_mode.sql` (NEW, applied)
   - `lib/types/grocery.ts` (added view_mode to GroceryList + UpdateGroceryListParams)
   - `lib/groceryListsService.ts` (widened or added updateGroceryList)
   - `components/GroceryListItem.tsx` (rewrote prop interface + render)
   - `screens/GroceryListDetailScreen.tsx` (added viewMode/activeFilter/disambiguation state, three inline subcomponents, hydrate-on-mount, filter logic in tierGroups memo)
   - `docs/PK_CODE_SNAPSHOTS.md` (Rule E: 3 rows bumped)
   - `docs/SESSION_LOG.md`

---

## Constraints

- **Services handle Supabase calls** with one acceptable exception (Part 7b — single-row metadata fetch on mount). CC's call whether to extract to a service or keep inline; my lean is service.
- **Do not remove existing functionality.** All current behaviors stay. Cross-list prompt, tier-move picker, tier collapse, pull-to-refresh, place-in-pantry, etc. — untouched.
- **Do not introduce new dependencies.** Use `react-native-svg` for the toggle icon (already a project dependency). Use `Modal` from react-native for the disambiguation sheet (matches existing patterns).
- **Existing `priority_reason` subtitle is REPLACED by an inline staple pill** — not augmented. Subtitles disappear from rows entirely. The pill carries the same information (and visual urgency via color) without taking a separate line.
- **Filter is strict** — recipe association alone determines inclusion when filter is active. Custom items disappear when filter is active. This is intentional (spec call).
- **Filter does NOT persist** across navigation. View mode DOES persist (per-list, via DB column).
- **Staple pill text** — extract from `item.priority_reason` if it includes 'staple'. If it's just 'staple · out', render "staple" (or "out" if you prefer; CC's call). If `priority_reason` is something else (e.g., 'manual' from a tier-move), don't render the staple pill — only fire on staple-related reasons. Conservative match: pill renders iff `priority_reason?.includes('staple')`.
- **Multi-recipe pill text** — render as `{count} recipes`. The named-form alternative (`Lasagna +1`) is intentionally NOT used — it would imply a primary recipe.
- **The For: strip and Filter chip are mutually exclusive.** Only one renders at a time. Both occupy the same vertical position in the layout.
- **No phase doc / DEFERRED_WORK edits in this CP.** Doc-hygiene happens post-smoke-test.

---

## Out-of-band items to flag in SESSION_LOG

1. Whether `updateGroceryList` already existed and was widened, or had to be added from scratch.
2. Whether the `getGroceryList(listId)` service function was added (Part 7b option) or the screen makes a direct supabase call.
3. Whether `priority_reason` values in the codebase included anything more granular than "staple · out" (the exact substring used for matching). If you discover varied priority_reason values in actual rows, flag for spec adjustment.
4. Any awkwardness in the toggle icon SVG rendering at small sizes — react-native-svg can be finicky with stroke widths on icons under 20pt.
5. If `addIngredientsToDefaultList` (P8-19) is fixed inline as part of this CP's wiring (it accepts `recipeId` but doesn't forward it). My lean: include the 3-line fix here since it's tangentially in the scope; CC has discretion. Note in SESSION_LOG either way.
6. Standard surprises per the normal pattern.

---

## SESSION_LOG entry format

Standard format. Entry title: `Phase 8C-CP3 — Compact/Detailed view + recipe pills + filter-by-recipe`.

Required sections per `DOC_MAINTENANCE_PROCESS.md` Section 8.

`Decisions made during execution:` — assign D8-40 onward only if real decisions arise. Likely candidates: where to position the toggle icon in the header (right of progress vs below action buttons); whether to extract `getGroceryList` as a service function or keep the inline supabase call; how to structure the staple-pill match (substring vs structured priority_reason vocabulary); whether to bundle the P8-19 fix inline.

---

## Closing

This CP closes the recipe-attribution UX of Phase 8C. After it lands and Tom smoke-tests:

1. Doc-hygiene CP runs (PHASE_8 v2.9 → v2.10 + 8C-CP3 ✅ Complete + relevant decisions in Decisions Log + 8C build-plan row updated to "3 of 8 numbered CPs done"; potentially close P8-19 if folded inline).
2. 8C-CP4 design begins. Phase doc estimate stays at 6-8 sessions for 8C; 3 of 8 numbered CPs then done.

Phase 8C is roughly halfway through. Remaining likely: CP4 (staple auto-routing + drag), CP5 (Ingredient Detail screen), CP6 (freezer cleanout), CP7+CP8 TBD.
