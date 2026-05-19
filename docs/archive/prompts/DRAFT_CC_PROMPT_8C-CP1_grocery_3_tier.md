# [DRAFT] CC Prompt — Phase 8C-CP1 Grocery 3-tier restructure

> **⚠️ DRAFT v1 — 2026-04-23.** First prompt of Phase 8C. Authored by Claude.ai after reading dated PK snapshots of types/grocery, groceryListsService, GroceryListDetailScreen, GroceryListItem, and the 8C-CP1 section of `PHASE_8_PANTRY_INTELLIGENCE.md` v2.5. Pending Tom's audit pass before handoff to Claude Code.

**Session type:** Execution
**Checkpoint:** 8C-CP1 — Grocery 3-tier restructure (first executable Phase 8C prompt)
**Estimated duration:** One session (~2-3 hours based on 8B pace)
**Dependencies:** 8A-CP1 complete (schema migration applied 2026-04-23; `grocery_list_items.priority_reason` + `grocery_list_items.custom_name` exist; `grocery_list_items.ingredient_id` is nullable). 8B complete (staples shipped — not a functional dependency but establishes the pantry/grocery mental model this CP extends).

---

## Context

Grocery list detail today is a flat, family-grouped list where every item looks equally urgent. Phase 8's grocery overhaul makes the list **triage-driven**: three priority tiers (Now / Could wait / In cart) surface what matters, and aisle grouping *inside* each tier keeps the shopping experience usable.

**What 8C-CP1 ships:**
1. `GroceryListDetailScreen` restructured around three tiers using the existing `grocery_list_items.priority` field:
   - **Now** = `priority='needed'` AND `is_in_cart=false`
   - **Could wait** = `priority='nice_to_have'` AND `is_in_cart=false`
   - **In cart** = `is_in_cart=true` (regardless of priority)
2. Within Now and Could wait, items group by **aisle** (`ingredients.typical_store_section`), not by family. Family becomes a fallback when `typical_store_section` is null.
3. `priority_reason` renders as a subtle subtitle under the item name when populated (e.g., "staple · out", "for Tyler's dinner"). 8C-CP1 is **read-only** on this field — the writers land in 8C-CP4 (staple auto-routing). Most existing items will have `priority_reason = null`; UI must handle that cleanly.
4. Custom items (`ingredient_id = null`, `custom_name` set) render in a synthetic **"Household"** aisle group. They have no aisle data and no ingredient-family fallback — they just show `custom_name` + quantity.
5. **Manual tier-move UI:** long-press (or a dedicated action button) on an item opens an Alert with "Move to Now / Move to Could wait / Cancel." When the user moves an item, `priority_reason` is set to `'manual'`. This lives in 8C-CP1 so the tiers are usable immediately — even before 8C-CP4's auto-routing lands. Drag polish stays deferred to 8C-CP4.
6. `GroceryListsScreen` row summary changes from family list ("Produce · Dairy · …") to tier summary ("2 now · 9 could wait · 8 in cart"). A red "N now" badge appears on the row when Now tier has items.
7. **Service alignment (scope expansion):** `lib/groceryListsService.ts` currently defines its own minimal `GroceryListItem` interface inline (missing `priority`, `priority_reason`, `custom_name`, `brand_preference`, `size_preference`), and `getItemsForList` only selects `ingredient (id, name, family)`. This CP removes the inline type, imports from `lib/types/grocery.ts`, widens the SELECT, and widens the `updateListItem` signature. Without this, the UI can't read the fields it needs.

**What 8C-CP1 does NOT ship:**
- Cross-list awareness ("also on Costco run") — that's 8C-CP2.
- Recipe chips at the top — 8C-CP3.
- Automatic staple→grocery routing that writes `priority_reason` — 8C-CP4.
- Drag-to-reorder polish — 8C-CP4.
- Ingredient Detail screen — 8C-CP5.
- Any changes to `lib/groceryService.ts` (that file is for `regular_grocery_items` only, untouched here).

**Why service widening is bundled in:** The alternative is shipping the tier UI against a service that returns partial data, which guarantees a visible data gap the moment 8C-CP1 lands. Rolled together, the migration is additive-only: every current caller keeps working, and new fields become available to the UI.

---

## Inputs to read

**Required:**

1. `docs/planning/PHASE_8_PANTRY_INTELLIGENCE.md` v2.5 — specifically the 8C-CP1 subsection under "8C — Grocery UX overhaul + Ingredient Detail + Freezer cleanout." Contains the canonical scope statement. Do not re-expand scope beyond what is listed there unless this prompt explicitly says to.
2. `lib/types/grocery.ts` (current — already post-8A-CP1, includes `priority_reason`, `custom_name`, nullable `ingredient_id`, `brand_preference`, `size_preference`, `AddGroceryItemParams.priorityReason`, `UpdateGroceryItemParams.priorityReason`, `UpdateGroceryItemParams.customName`). This is the canonical source of truth for grocery types. **Do not modify.** Import from here in the service.
3. `lib/groceryListsService.ts` — current surface. Specifically note:
   - Lines 22-36: inline `GroceryListItem` interface that must be deleted.
   - Lines 150-178: `getItemsForList` SELECT that must widen.
   - Lines 345-372: `updateListItem` signature that must widen to accept `priority`, `priority_reason`, `brand_preference`, `size_preference`.
4. `screens/GroceryListDetailScreen.tsx` — current surface. Specifically note:
   - Line 29-30: imports `GroceryListItem` as TYPE from the service. That import becomes `GroceryListItemWithIngredient` from `lib/types/grocery.ts`.
   - Line 357-370: current family-grouping logic. Replaces with tier + aisle.
   - Line 358: early-returns `acc` on `!item.ingredient` — the bug that drops custom items. Must change.
   - Line 538: early-returns `null` on `!item.ingredient` in `renderItem`. Must change (custom items render with `custom_name`).
   - Line 537-601: inline `renderItem()` — replaced by `<GroceryListItem />` component invocation.
   - Line 447-531: `handleMoveToPantry` — unchanged by this CP (future cleanup but not in scope).
5. `components/GroceryListItem.tsx` — currently unused standalone component (not imported anywhere in the repo per `grep` of all `.tsx` files; only its internals reference the service). This CP repurposes it as the tier-aware row component. Full rewrite is acceptable; nobody depends on the current behavior.
6. `screens/GroceryListsScreen.tsx` — the list-of-lists screen. Used for the tier summary + red "now" badge changes. Before editing, view it to locate the row-summary rendering and per-list stats calculation.

**Reference (don't modify, just consult):**

7. `docs/wireframes/phase_8/phase_8_system_prototype_v5.html` (path may differ — wireframes haven't been committed to repo yet per v2.5 phase doc changelog; if not present, fall back to the HTML files at repo root with `phase_8_system_prototype*.html` names). The "Inside a list — 3 tiers + recipe chips" section shows the tier heading format, tier hint subtitles, row layout with `priority_reason` subtitle. **Ignore the recipe chip bar** (that's 8C-CP3). Ignore the cross-list indicator text on rows (that's 8C-CP2).
8. `lib/types/grocery.ts` interface `GroceryListItemWithIngredient` (lines 67-76): canonical response shape for item-with-join queries. This is the type `getItemsForList` should return post-widening.

**Don't read:** `Supabase_Snippet_Supabase_Frigo_DB_Structure_Query_*.csv` files — the one currently in the repo predates 8A-CP1 and is stale for `grocery_list_items`. Trust `lib/types/grocery.ts` and the 8A-CP1 migration file (`supabase/migrations/20260424_phase_8_schema_foundation.sql`) instead.

---

## Task

### Part 1 — Widen `lib/groceryListsService.ts`

**1a. Delete the inline `GroceryListItem` and `GroceryList` interfaces (lines 13-20 and 22-36).** Do NOT re-export substitutes under the same names — the old inline `GroceryListItem` conflated row + join, and a re-export would continue that confusion. Instead, update every caller to import directly from `lib/types/grocery.ts`.

At the top of the service file, replace the deleted interfaces with:

```ts
import {
  GroceryList,
  GroceryListItemWithIngredient,
  UpdateGroceryItemParams,
} from './types/grocery';
```

Use `GroceryList` (the canonical, more-fleshed-out definition) as the type for the service's list-related functions. Use `GroceryListItemWithIngredient` for the item-with-join return type from `getItemsForList`. The local `CreateGroceryListParams` and `AddItemToListParams` interfaces at the bottom of the type block can stay as-is — they're service-level shapes, not DB rows, and the canonical types file has its own slightly different params types (`CreateGroceryListParams`, `AddGroceryItemParams`) that don't exactly match the current signatures. Leave the service's local params types alone for this CP; the params-shape alignment is a separate cleanup.

**After deleting the inline types, update all callers** (grep for `from '../lib/groceryListsService'` across the repo, then see what each pulls in). Expected changes:
- `screens/GroceryListDetailScreen.tsx` — no longer imports `GroceryListItem` from the service; instead imports `GroceryListItemWithIngredient` from `lib/types/grocery`.
- `screens/GroceryListsScreen.tsx` — if it currently imports `GroceryList` from the service, switch it to import from `lib/types/grocery`. The canonical `GroceryList` has fields (`emoji`, `is_active`, `is_template`, `sort_order`) the inline one lacked — expect to see those flow through. If the screen uses a distinct `GroceryListWithCounts` (see `lib/types/grocery.ts` lines 27-31), import that too.
- `components/GroceryListItem.tsx` — rewritten in Part 2; will import `GroceryListItemWithIngredient` from canonical types.

If a caller's usage site depends on a field that only exists in the inline type (unlikely given the inline type was a subset), flag it in SESSION_LOG rather than hacking around it.

**1b. Widen the SELECT in `getItemsForList` (lines 150-178).** Change the ingredient join from:

```ts
ingredient:ingredients (id, name, family)
```

to:

```ts
ingredient:ingredients (
  id,
  name,
  plural_name,
  family,
  ingredient_type,
  typical_unit,
  typical_store_section
)
```

The outer `.select('*, ...')` already pulls all grocery_list_items columns, so `priority`, `priority_reason`, `custom_name`, `brand_preference`, `size_preference` come through automatically.

Type the return: `Promise<GroceryListItemWithIngredient[]>`.

Custom items will have `ingredient_id = null`, `custom_name` set, and the joined `ingredient` field will be `null`. Don't filter them out — pass through.

**1c. Widen `updateListItem` signature (lines 345-372).** Add fields to the updates type:

```ts
export async function updateListItem(
  itemId: string,
  updates: {
    quantity_display?: number;
    unit_display?: string;
    notes?: string;
    is_in_cart?: boolean;
    priority?: 'needed' | 'nice_to_have';
    priority_reason?: string | null;
    brand_preference?: string | null;
    size_preference?: string | null;
    custom_name?: string | null;
  }
): Promise<void>
```

Supabase accepts the wider update object unchanged; no query rewrite needed.

**1d. Keep everything else in the service unchanged.** `addItemToList`, `toggleItemInCart`, `deleteItemFromList`, `deleteListItem`, `getListItemCount`, `addIngredientsToDefaultList` — all stay as-is for this CP. (The `addItemToList` ingredient-merge logic assumes non-null `ingredient_id`, which is fine: custom items get added through a different path in a future CP. Don't touch it here.)

**Verification for Part 1:** After the widening, the service's exported `GroceryListItem` type is the canonical `GroceryListItemWithIngredient`, and a TypeScript build of the repo (`npx tsc --noEmit`) passes without new errors. **Run the build to confirm before proceeding to Part 2.** If new errors surface in callers that reference now-missing fields, fix them inline with minimal changes — most will just be field-name corrections.

---

### Part 2 — Rewrite `components/GroceryListItem.tsx` as a tier-aware presentational row

**Replace the file wholesale.** The component becomes purely presentational (state lives in the screen), with these props:

```tsx
interface GroceryListItemProps {
  item: GroceryListItemWithIngredient;   // from lib/types/grocery.ts
  onToggleCart: (itemId: string, currentInCart: boolean) => void;
  onAdjustQuantity: (itemId: string, currentQty: number, delta: number) => void;
  onMoveTier: (itemId: string) => void;   // opens tier picker (handled by screen)
  onDelete: (itemId: string) => void;
}
```

**Render contract:**

- Row is a horizontal flex: `[checkbox] [main content: name + quantity + reason subtitle] [quantity buttons when not in cart] [delete]`.
- **Name display:** if `item.ingredient` is non-null, use `ingredient.plural_name || ingredient.name`. If `item.ingredient` is null, use `item.custom_name || '(unnamed item)'`.
- **Quantity display:** `{quantity_display} {unit_display}` — keep the existing simple string form. If `brand_preference` is present, append ` · {brand}`. If `size_preference` is present, append ` · {size}`. Do NOT add the fraction-display utility here — that's a cross-cutting wiring task (P5-4 / 8A-CP3 territory) and is out of scope for 8C-CP1.
- **Priority reason subtitle:** when `item.priority_reason` is non-null and non-empty, render below the name in `typography.sizes.xs`, `colors.text.tertiary`. Format: lowercase verbatim (`{item.priority_reason}`). When null, render nothing — no placeholder row.
- **Custom items styling:** no aisle tag needed, but visually they look just like normal items. The "Household" bucket grouping happens at the screen level.
- **Checked state visual:** existing `itemRowChecked` opacity 0.5 + strikethrough name. Preserved.
- **Long-press anywhere on the main-content touchable triggers `onMoveTier(item.id)`** (not on checkbox, not on delete). This is the tier-move entry point. `onLongPress` on a `TouchableOpacity` is the React Native primitive.

**Do NOT:**
- Do not call services directly from the component. All mutations go through props. (The old component imported `updateListItem`/`deleteListItem` directly — remove those imports.)
- Do not wrap the row in its own card/shadow container. The screen provides the grouping container; the row is borderless.
- Do not handle its own internal `updating` state. If the screen wants to debounce, it does so.

**Verification for Part 2:** Component renders in isolation without requiring any Supabase connection (no service imports). TypeScript build still passes.

---

### Part 3 — Restructure `screens/GroceryListDetailScreen.tsx`

This is the largest surface change. Approach it in strict order to avoid a broken-compile middle state.

**3a. Update import at line 29-30.** Replace the type import from the service with:

```ts
import {
  getItemsForList,
  deleteItemFromList,
  toggleItemInCart,
  updateListItem,
} from '../lib/groceryListsService';
import { GroceryListItemWithIngredient } from '../lib/types/grocery';
```

Then update `useState` (line 310) and any local type annotations to use `GroceryListItemWithIngredient[]`.

Remove the re-export alias usage if one exists. The goal is: this screen no longer uses the service's exported name — it uses the canonical type.

**3b. Replace the grouping logic (lines 357-370) with tier-first, aisle-second grouping.**

New shape:

```ts
type Tier = 'now' | 'could_wait' | 'in_cart';

interface TierGroup {
  tier: Tier;
  label: string;        // "Now" | "Could wait" | "In cart"
  hint: string | null;  // tier subtitle; null for in_cart
  count: number;
  aisles: AisleGroup[];
}

interface AisleGroup {
  aisle: string;        // typical_store_section || family || 'Household' for custom
  items: GroceryListItemWithIngredient[];
}
```

**Tier assignment:**
- `is_in_cart === true` → `in_cart`
- Otherwise: `priority === 'nice_to_have'` → `could_wait`; anything else (including `priority === 'needed'` and null) → `now`.

**Aisle assignment per item:**
1. If `item.ingredient === null`: aisle = `'Household'` (custom items bucket).
2. Else if `item.ingredient.typical_store_section` is non-null and non-empty: use it.
3. Else: fall back to `item.ingredient.family` (capitalized — matches current family-header display).

**Within-aisle sort:** alphabetical by display name (ingredient plural_name/name, or custom_name for custom items).

**Aisle sort within a tier:** alphabetical by aisle name, with `'Household'` pinned last (it's the "misc" bucket).

**Tier labels and hints:**
- Now: label "Now", hint "Acute — out of a staple or needed for a recipe this week"
- Could wait: label "Could wait", hint "Low but not out — pick up when convenient"
- In cart: label "In cart", hint null (no hint, just the header)

Compute tier groups with `useMemo` keyed on `items`.

**3c. Replace the render body (lines 682-723) with tier-first render.**

Render order: Now → Could wait → In cart.

Each tier renders as a section:
- Tier header with colored dot (red for Now, gray for Could wait, green/check for In cart), label, count. Example: `● Now · 2`. Use `functionalColors.error` for the Now dot; `colors.text.tertiary` for Could wait; `functionalColors.success` for In cart.
- Tier hint line below header when non-null, `typography.sizes.xs`, `colors.text.secondary`.
- **Collapse/expand toggle on the tier header itself.** Default-collapsed state: In cart collapsed by default, Now and Could wait expanded. The existing `collapsedSections` state pattern works — replace family keys with tier keys.
- Inside an expanded tier: aisle sub-headers (smaller than family headers were — `typography.sizes.sm`, `colors.text.secondary`, no border, no count badge), then `<GroceryListItem />` rows for each item in that aisle.
- **Empty tier handling:** if a tier has zero items, render the header and hint but no body. Do NOT hide the header — users should see "Now · 0" to know the tier exists. If ALL three tiers are empty (i.e., the list has zero items), render the existing `emptyState` block.

**3d. Wire `onMoveTier` to an Alert picker.**

Add a handler:

```ts
const handleMoveTier = (itemId: string) => {
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  Alert.alert(
    'Move item',
    null,
    [
      {
        text: 'Move to Now',
        onPress: async () => {
          await updateListItem(itemId, {
            priority: 'needed',
            priority_reason: 'manual',
            is_in_cart: false,
          });
          await loadItems();
        },
      },
      {
        text: 'Move to Could wait',
        onPress: async () => {
          await updateListItem(itemId, {
            priority: 'nice_to_have',
            priority_reason: 'manual',
            is_in_cart: false,
          });
          await loadItems();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
};
```

Notes:
- The picker intentionally does NOT include "Move to In cart" — that's what the checkbox does. Moving an item into In cart via a picker when the checkbox is right there would be redundant UI.
- `is_in_cart: false` is explicit when moving tier, because a user might long-press a checked item to re-file it; the move implies "take it back out of the cart into the new tier."
- `priority_reason: 'manual'` overwrites any previous machine-set reason. That's correct: the user's manual action supersedes the heuristic.

**3e. Progress bar + action buttons.**

The current progress bar ("{checkedCount}/{totalCount}") works as-is. Leave it unchanged. It represents the overall shopping progress across tiers, which is still useful.

The "Place in Pantry ({checkedCount})" and "+ Add to List" buttons stay where they are. Unchanged.

**3f. Remove the family-based logic wholesale.** After the tier restructure, nothing should reference `ingredient.family` as a primary grouping key. The fallback inside aisle assignment is the only remaining reference.

**3g. Do NOT touch:**
- `handleMoveToPantry` and its bulk-move logic. Unrelated to this CP.
- `handleAddItem` placeholder `Alert`. Add-item flow is its own body of work.
- `renderItem` — deleted entirely and replaced by `<GroceryListItem />` usage.
- Existing styles that are still used (`itemRow`, `itemRowChecked`, `checkbox`, etc.). Aisle headers will need *new* styles; leave the old ones that got orphaned alone rather than risk accidental style loss — a cleanup pass can come later.

**Verification for Part 3:** TypeScript build passes. Smoke test: open a grocery list with a mix of priorities and at least one custom item; confirm 3 tiers render, custom item lands in Household, long-press → move picker opens, move actually persists after round-trip.

---

### Part 4 — Tier summary on `screens/GroceryListsScreen.tsx`

**4a. Locate the per-list row summary.** Before editing, view the file and find where each list row is rendered — specifically the element that currently shows the family list ("Produce · Dairy · Dry goods"). If that element doesn't exist in the current codebase (the wireframe may have been aspirational), add a new stat line.

**4b. Compute tier counts per list.** The per-list `GroceryListWithCounts` type already has `total_items`, `checked_items`, `unchecked_items` (see `lib/types/grocery.ts` lines 27-31). It does NOT currently break down unchecked into `needed` vs `nice_to_have`. Two options:
- **Option A (cleaner):** Extend the `listStatsRpc` / whatever function populates `GroceryListWithCounts` to include `now_count` and `could_wait_count`. Requires touching the service layer that loads the lists.
- **Option B (simpler for this CP):** Load items per list on render (each row does its own small query). Acceptable if there are few lists.

**Choose Option A.** Inspect whichever service function returns `GroceryListWithCounts` (likely in `lib/groceryListsService.ts` or a related service — find it via grep). Add two derived counts to the returned shape: `now_count`, `could_wait_count`, `in_cart_count`. Add the grouping at query time (either via an additional aggregation or a per-list items scan — use judgment, but keep it a single round-trip).

If the existing function does a simple count query per list, extend it to a grouped count. Concretely, consider a single query like:

```ts
const { data } = await supabase
  .from('grocery_list_items')
  .select('list_id, priority, is_in_cart')
  .in('list_id', allListIds);
```

Then derive per-list counts client-side by reducing the results. This avoids N database round-trips and keeps the service layer honest.

**Update `lib/types/grocery.ts`** to reflect the new fields on `GroceryListWithCounts`. Keep `total_items` / `checked_items` / `unchecked_items` as-is — they're still useful as aggregate stats elsewhere.

**4c. Render the tier summary.** Replace the current per-row summary text (or add it if it doesn't exist) with:

```
{now_count} now · {could_wait_count} could wait · {in_cart_count} in cart
```

Use `typography.sizes.sm`, `colors.text.secondary`. If `now_count === 0`, just render "{could_wait_count} could wait · {in_cart_count} in cart" (drop the leading "0 now" segment for cleanliness). If the list is totally empty, render existing empty-state text (likely "Empty list" or similar).

**4d. Red "now" badge.** On the list row, when `now_count > 0`, render a small pill-shaped badge next to the list name or emoji:

```
{now_count} now
```

Style: `backgroundColor: functionalColors.error`, white text, `typography.sizes.xs`, `fontWeight: semibold`, `borderRadius: 10`, `paddingHorizontal: spacing.xs`, `paddingVertical: 2`. When `now_count === 0`, render nothing.

Position: near the list emoji/name. Use judgment based on the current row layout — the goal is "I can see from the lists screen which lists have urgent items without opening them."

**4e. Do NOT touch:** list creation, list deletion, list reorder, template lists, or any other GroceryListsScreen behavior beyond row summary + badge.

**Verification for Part 4:** TypeScript build passes. Smoke test: open lists screen with two lists (one having an item in the Now tier, one not). Confirm red badge appears on the first list only. Confirm tier summary line reads correctly for both.

---

### Part 5 — Verification checklist

Run these explicitly and confirm each in the SESSION_LOG:

1. `npx tsc --noEmit` passes cleanly (no new errors from this CP).
2. `npx expo start` loads the app without red-screen crashes.
3. Open a grocery list that has at least 2 items. Items default to `priority='needed'`, so expect to see them in the Now tier on first load.
4. Tap the checkbox on one item — it moves to In cart tier. Uncheck — it moves back to Now.
5. Long-press an item in Now — picker appears with "Move to Now / Move to Could wait / Cancel." Tap "Move to Could wait" — the item visually moves to Could wait tier and persists across refresh. Re-open the list; the item is still in Could wait. In the database, `priority='nice_to_have'` and `priority_reason='manual'`.
6. Repeat step 5 moving back to Now. Confirm `priority='needed'`, `priority_reason='manual'` (overwritten, not null).
7. Create a custom item (you can insert via Supabase Dashboard for this verification if no UI path exists yet):
   ```sql
   INSERT INTO grocery_list_items (list_id, user_id, ingredient_id, custom_name, quantity_display, unit_display, priority)
   VALUES ('<a real list_id>', '<a real user_id>', NULL, 'Duct tape', 1, 'each', 'nice_to_have');
   ```
   Reload the grocery list screen. Confirm the custom item renders in the "Household" aisle under Could wait, showing `Duct tape · 1 each`, no crash.
8. Collapse a tier — the items hide. Expand again — they return. Confirm In cart tier is collapsed by default on first open.
9. Go back to GroceryListsScreen. Confirm the row for this list shows a red "N now" badge matching the actual Now count. Confirm the summary line reads like `1 now · 2 could wait · 0 in cart`.
10. `git status` shows the expected five files modified:
    - `lib/groceryListsService.ts`
    - `lib/types/grocery.ts` (only if Part 4b required adding `now_count` etc.)
    - `components/GroceryListItem.tsx`
    - `screens/GroceryListDetailScreen.tsx`
    - `screens/GroceryListsScreen.tsx`

    No other files touched.

**If any verification item fails, STOP and report in SESSION_LOG.** Do not attempt silent fixes beyond small typo-level corrections.

---

## Constraints

- **Services handle ALL Supabase calls.** `components/GroceryListItem.tsx` must not import `supabase` or any service directly. All mutations flow through screen-owned handlers.
- **Do not remove existing functionality.** Current grocery-list features (checkbox toggle, quantity adjust, delete, move-to-pantry, regular items) all keep working.
- **Do not introduce new dependencies.** No new npm packages. React Native + existing theme system only.
- **Do not alter database schema.** 8A-CP1 already shipped the schema; this CP is UI + service layer only.
- **Do not wire the tap-sheet pattern from 8D-CP3.** That's a different surface with different actions. 8C-CP1 uses a plain `Alert.alert` for tier picking — simple and intentional.
- **Do not touch `lib/groceryService.ts`** (regular items service). Out of scope.
- **Do not build the recipe chip filter.** That's 8C-CP3.
- **Do not build cross-list indicators.** That's 8C-CP2.
- **Preserve shell quoting discipline when committing:** `git commit -m "..." -- <paths>`. The `-m` block comes before `--` path scope (bug caught during 8B-CP3a).
- **Per-prompt accessibility verification (not full audit):** minimum tap targets on checkbox, quantity buttons, tier-move long-press, and tier headers are ≥44pt. Labels on TouchableOpacity where possible. Full VoiceOver/contrast audit is P8-1 post-F&F.

---

## Out-of-band items to flag in SESSION_LOG

Under "Surprises / Notes for Claude.ai":

1. If `typical_store_section` data coverage in the `ingredients` table is poor (most rows null), note this. It affects whether 8C-CP2/CP3 can rely on aisle grouping or need a data-backfill subtask.
2. If the `GroceryListsScreen` row rendering turns out to be substantially different from what this prompt assumes (e.g., no existing summary line to replace), report the actual shape and the placement choice made.
3. If a widening of the list-counts service function requires changes beyond the one query identified here, flag the full scope before continuing.
4. If the 2026-04-23 SESSION_LOG rule on "Rule G candidate — schema/API claims cite file:line" has been formalized, note the prompt's conformance. If not yet formalized, no action needed.
5. Any other surprises per the normal pattern.

---

## SESSION_LOG entry format

Standard format per `DOC_MAINTENANCE_PROCESS.md` Section 8. One entry per prompt execution. Entry title: `Phase 8C-CP1 — Grocery 3-tier restructure`.

Required sections:
- **Prompt:** link to this file
- **Outcome:** ✅ Complete / ⚠️ Partial (with reason) / ❌ Blocked (with reason)
- **Files modified:** enumerated list with one-line per-file summary
- **Verification results:** one line per checklist item from Part 5
- **Decisions made during execution:** assign D8-34 onward; common cases include sort-order defaults, empty-state handling, badge placement on the lists screen
- **Open questions deferred:** anything that came up but didn't block execution
- **Surprises / Notes for Claude.ai:** per the list above + anything else
- **Next steps:** default is "8C-CP2 design (cross-list awareness)" unless blockers exist

---

## Closing

This CP is the structural backbone for 8C. The checkpoints after it (CP2 cross-list, CP3 chips, CP4 auto-routing) all build on the tier structure this CP establishes. Getting the data shape right (tier-first grouping, aisle fallback, custom-items routing, widened service) matters more than visual polish — polish lands in CP4 via drag-to-reorder and the auto-routing hints.

If any scope ambiguity surfaces mid-execution, STOP and report rather than assume. The 8B-CP4 STOPs (D8-32, D8-33 in the phase doc) cost less than silent drift would have.
