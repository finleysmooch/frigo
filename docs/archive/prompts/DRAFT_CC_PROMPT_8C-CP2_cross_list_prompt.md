# [DRAFT] CC Prompt — Phase 8C-CP2 — Cross-list checkoff-moment confirmation

> **⚠️ DRAFT v1 — 2026-04-27.** Scope-redirected CP2 (original phase-doc spec was passive subtitle + auto-dismiss; redesigned to checkoff-moment prompt only after Tom's real-life shopping pattern review). Pending Tom's audit before handoff to Claude Code.

**Session type:** Execution (single CP, smaller scope than CP1)
**Checkpoint:** 8C-CP2 — Cross-list awareness via checkoff-moment confirmation prompt
**Estimated duration:** 1 session, ~1.5-2 hours
**Dependencies:** 8C-CP1 + 8C-CP1a + 8C-CP1b complete (canonical types, widened service, populated aisle data, schema with `priority`/`priority_reason`/`custom_name`).

---

## Context

The phase doc's original 8C-CP2 spec was a passive always-visible subtitle ("→ also on Costco run") plus a 4-hour auto-dismiss-on-checkoff behavior. Both reframed during design pass:

- **Auto-dismiss cut entirely** (P8-18 captured the reasoning — same item on different lists usually represents *different* purchase intents like bulk vs immediate, so auto-dismissing one when you check the other erases that distinction).
- **Subtitle dropped** in favor of a **checkoff-moment prompt** because the failure mode Tom actually wants to prevent is *forgetting the bulk resupply* after checking the immediate-need entry on a different list. A passive subtitle becomes wallpaper; the moment-of-decision prompt forces a conscious choice.

**The redesigned UX:**

Walking through the list, no cross-list cues are visible. Items render exactly as they do post-CP1.

When the user checks an item (`is_in_cart` flips to `true`), the system queries: *does this same `ingredient_id` appear on any other active grocery list owned by this user?*

- If **no** other lists contain it: the check goes through silently. No prompt. Same UX as today.
- If **yes** other lists contain it: a small bottom-sheet or toast appears:

  > ✓ Olive oil checked off
  > Also on your **Costco run**, **This Week** — keep it there?
  > [Keep] [Remove]

  - **Default:** Keep (auto-dismisses after 5 seconds, same effect as tapping Keep).
  - **Tapping Remove** deletes the matching items from the *other* lists (does NOT modify the just-checked item; that stays checked).
  - **Tapping Keep** explicitly is a no-op beyond closing the prompt.
  - **Tapping the checkbox to UN-check** the item never fires the prompt. Only the `false → true` transition triggers it.

**Why this redesign matches reality:**

Tom's real-life shopping pattern: Safeway/Fred Meyer weekly (staples), New Seasons weekly (fresh meat/produce for specific recipes — premium-priced, used selectively), Costco monthly (bulk resupply). The same ingredient legitimately appears on multiple lists with *different intents*. Olive oil on Fred Meyer = "small bottle to bridge the gap"; olive oil on Costco = "bulk resupply for next 2-3 months." Checking off the Fred Meyer entry should NOT remove the Costco entry by default — those are different purchases. But the user should also be reminded the Costco entry exists at the moment they decide whether it still makes sense.

---

## Scope

**In scope:**
1. New service function `getOtherListsContainingIngredient(ingredientId, currentListId, userId)` — returns array of `{ list_id, list_name }` for all other active lists owned by the same user that contain the ingredient. Skips the current list. Returns empty array if no overlap.
2. New presentation component `CrossListPrompt` (or whatever final name) — bottom-sheet or toast surface with the title, list-names string, [Keep] [Remove] buttons, 5-second auto-dismiss timer.
3. Wire the prompt into `screens/GroceryListDetailScreen.tsx`'s `handleToggleItem` — after a successful check-on (false → true transition), call the service, render the prompt if results are non-empty.
4. "Remove" path: deletes the matching `grocery_list_items` rows from each other list, by `list_id` + `ingredient_id` match. Uses existing `deleteListItem` (or a new `deleteItemsByIngredientFromLists` helper if cleaner).
5. Custom items (`ingredient_id IS NULL`, `custom_name` set) are skipped — no join key, no prompt fires.

**Out of scope:**
- Always-on inline subtitle indicating cross-list overlap (rejected during design pass; captured implicitly by no-CP1 follow-on).
- Cross-list overlap visibility on `GroceryListsScreen` (the lists-of-lists screen) — Tom confirmed users mostly enter a specific list, so this surface isn't needed for F&F.
- Auto-dismissal of items on other lists when an item is checked elsewhere (P8-18 — explicit per-item user opt-in is a future direction if revisited).
- Cross-user cross-list visibility (Tom's space partner Mary's lists) — Phase 9 (multi-user handoff) is the natural home for that.
- Price-aware "wait if you can" routing — needs store/price metadata that doesn't fully exist; not in scope for CP2.

---

## Inputs to read

1. `lib/groceryListsService.ts` — current state post-CP1+CP1a. Service file structure, existing query patterns, where to add the new function.
2. `lib/types/grocery.ts` — for canonical types. Likely a new small type for the cross-list query result (`OtherListPresence` or similar — `{ list_id: string; list_name: string }`).
3. `screens/GroceryListDetailScreen.tsx` — `handleToggleItem` at line 401 is the wiring site. `currentUserId` is already loaded (line 307 — `const [currentUserId, setCurrentUserId] = useState<string | null>(null);`); use it directly. The existing `loadItems()` call after the toggle stays — the prompt happens between the toggle and the reload (or in parallel; see Part 3 spec).
4. `components/GroceryListItem.tsx` — current state of the row component. **No changes expected** — the prompt is a sibling overlay, not a modification to the row.
5. **Pattern reference:** `components/pantry/CookDepletionBanner.tsx` and `contexts/CookDepletionBannerContext.tsx` from 8B-CP4 are the closest precedent for this kind of post-action prompt overlay. Use them as architectural reference for how to structure the prompt component + state. Do NOT reuse the depletion banner directly — different action, different copy, different lifetime — but mimic the pattern.

---

## Task

### Part 1 — Service: `getOtherListsContainingIngredient`

**1a. Add a new exported function** to `lib/groceryListsService.ts`:

```ts
export async function getOtherListsContainingIngredient(
  ingredientId: string,
  currentListId: string,
  userId: string
): Promise<Array<{ list_id: string; list_name: string }>> {
  // Query grocery_list_items joined to grocery_lists where:
  //   ingredient_id = ingredientId
  //   list_id != currentListId
  //   grocery_lists.user_id = userId
  //   grocery_lists.is_active = true
  //   is_in_cart = false  (only show entries that haven't already been picked up)
  // Return one entry per matching list (deduplicate if the ingredient appears
  // multiple times on the same list — return list once).
  ...
}
```

**Implementation notes:**

- Recommend a single query with a join on `grocery_list_items.list_id = grocery_lists.id`, filtered to `is_active = true` and `user_id = userId`. Project `list_id` and `grocery_lists.name AS list_name`.
- The `is_in_cart = false` filter on the *other* list's matching items prevents the prompt from firing on items the user has already checked elsewhere (e.g., if olive oil is on 3 lists and they checked one earlier today, only the still-pending lists prompt the next time).
- Deduplicate by `list_id` client-side after the query (in case an ingredient appears on the same list multiple times via different `recipe_id` annotations).
- Empty result → empty array. Log via `console.log('🔍 No cross-list overlap')` or similar (match existing service-log emoji conventions: 📋, 📦, etc.).

**1b. Optional new helper** if Part 4's "Remove" path is cleaner with a dedicated function:

```ts
export async function deleteItemsByIngredientFromLists(
  ingredientId: string,
  listIds: string[],
  userId: string
): Promise<number> {
  // Delete all grocery_list_items rows where:
  //   ingredient_id = ingredientId
  //   list_id IN (listIds)
  //   user_id = userId  (defensive; rows should already match)
  //   is_in_cart = false  (don't delete already-checked items elsewhere)
  // Return count of deleted rows.
  ...
}
```

CC's call: implement this helper if it cleans up the screen-side wiring; otherwise loop over `deleteListItem` from screen code. Prefer the helper for separation of concerns.

**1c. Type addition (optional).** If a typed return is cleaner than inline `Array<{...}>`, add a tiny type to `lib/types/grocery.ts`:

```ts
export interface CrossListIngredientPresence {
  list_id: string;
  list_name: string;
}
```

CC's call. If used, the function returns `Promise<CrossListIngredientPresence[]>`.

### Part 2 — Prompt component

**2a. Create `components/CrossListPrompt.tsx`** — new file. Naming intentionally generic so it can host future cross-list confirmations.

**Render contract:**
```
┌─────────────────────────────────────┐
│ ✓ {item name} checked off            │
│ Also on your **{list1}**, **{list2}**│
│   — keep it there?                   │
│                                      │
│      [Keep]              [Remove]    │
└─────────────────────────────────────┘
```

**Props:**
```ts
interface CrossListPromptProps {
  visible: boolean;
  itemName: string;                     // e.g., "Olive oil"
  otherLists: CrossListIngredientPresence[];  // 1+ lists
  onKeep: () => void;                    // Tap [Keep] OR auto-dismiss
  onRemove: () => void;                  // Tap [Remove] — caller handles deletion
  onDismiss: () => void;                 // Component calls this when timer fires
}
```

**Behavior:**

- Renders as a **top-floating banner** modeled on `components/pantry/CookDepletionBanner.tsx` (8B-CP4). Same absolute positioning pattern, same SafeAreaView handling for the top edge, same z-index strategy. Use the cook-depletion banner as the structural reference; differences are content (this prompt has [Keep] [Remove] buttons + a different copy structure) and lifetime (5s vs 30s). Bottom positioning was considered but rejected — bottom is obscured by the home indicator + tab bar, top has clean precedent. Do NOT subclass or import from CookDepletionBanner; create a new file with parallel structure.
- 5-second auto-dismiss timer — calls `onDismiss()` when fires. Equivalent to tapping Keep but explicitly fires the dismiss path so caller can distinguish if needed.
- Auto-dismiss timer is cleared if the user taps Keep, Remove, or somehow dismisses the prompt (e.g., navigates away). Use `useEffect` cleanup.
- If the user taps Keep before timer fires, also call `onKeep()` then `onDismiss()` (or just `onDismiss()` if the parent treats them equivalently — CC's call).
- Multi-list rendering of `otherLists`: comma-separated `list_name` values. If 3+, show first 2 then "+ N more". Example: 5 lists → "List A, List B + 3 more". Single list → just "List A".
- Style: subtle but visible. Use `colors.background.elevated` or similar non-jarring surface. Title in primary text color, "Also on your..." line in secondary. `[Keep]` is the default-action button (filled or higher-emphasis); `[Remove]` is secondary (outlined or text-button). Don't make Remove look dangerous — it isn't, it's just a different intent.
- Min tap target 44×44 on both buttons.
- `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` on the container so VoiceOver announces it.

**Out of scope for the component:**
- Keep does NOT need to do anything beyond closing the prompt. It's a no-op confirmation.
- Remove does NOT delete from the DB itself — it calls `onRemove()` which the parent handles. Keeps the component pure.

### Part 3 — Wire into `GroceryListDetailScreen.tsx`

**3a. Add state** for the prompt:

```ts
const [crossListPromptState, setCrossListPromptState] = useState<{
  visible: boolean;
  itemName: string;
  ingredientId: string;
  otherLists: CrossListIngredientPresence[];
} | null>(null);
```

`null` = no prompt. Object = prompt visible with this data.

**3b. Modify `handleToggleItem`** (line ~401) to fire the cross-list check:

```ts
const handleToggleItem = async (itemId: string, currentState: boolean) => {
  try {
    const newState = !currentState;
    await toggleItemInCart(itemId, newState);
    await loadItems();
    
    // Cross-list prompt: only fire on check-on (false → true), not check-off,
    // and only for items with an ingredient_id (skip custom items).
    if (newState && currentUserId) {
      const item = items.find(i => i.id === itemId);
      if (item?.ingredient_id && item.ingredient) {
        const otherLists = await getOtherListsContainingIngredient(
          item.ingredient_id,
          listId,  // route param: current list
          currentUserId
        );
        if (otherLists.length > 0) {
          setCrossListPromptState({
            visible: true,
            itemName: item.ingredient.plural_name || item.ingredient.name,
            ingredientId: item.ingredient_id,
            otherLists,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error toggling item:', error);
    Alert.alert('Error', 'Failed to update item');
  }
};
```

**Note the order:** toggle → reload → cross-list query. The reload happens regardless. The prompt fires *after* the reload, so the row visually settles into checked state before the prompt appears.

**Note the lookup pattern:** `items.find(i => i.id === itemId)` to get the ingredient_id and name from local state. This works because `items` was just reloaded with the toggled state.

**3c. Add prompt-handling callbacks:**

```ts
const handleCrossListKeep = () => {
  setCrossListPromptState(null);
};

const handleCrossListRemove = async () => {
  const state = crossListPromptState;
  if (!state || !currentUserId) {
    setCrossListPromptState(null);
    return;
  }
  try {
    const listIds = state.otherLists.map(l => l.list_id);
    await deleteItemsByIngredientFromLists(state.ingredientId, listIds, currentUserId);
    // No reload of current list needed — only other lists were modified.
  } catch (error) {
    console.error('Error removing cross-list items:', error);
    Alert.alert('Error', 'Failed to remove items from other lists');
  } finally {
    setCrossListPromptState(null);
  }
};
```

If using the loop-`deleteListItem` approach instead of the helper, use a per-list query to find the ingredient on each other list, then delete by item_id. The helper is simpler.

**3d. Render the prompt** as a sibling at the end of the screen's JSX:

```tsx
return (
  <View style={styles.container}>
    {/* existing screen content */}
    {crossListPromptState && (
      <CrossListPrompt
        visible={crossListPromptState.visible}
        itemName={crossListPromptState.itemName}
        otherLists={crossListPromptState.otherLists}
        onKeep={handleCrossListKeep}
        onRemove={handleCrossListRemove}
        onDismiss={() => setCrossListPromptState(null)}
      />
    )}
  </View>
);
```

(The prompt's own absolute-positioning handles where it appears — top or bottom depending on Part 2's choice.)

**3e. Do NOT touch:**
- The `handleDeleteItem`, `handleAdjustQuantity`, `handleMoveTier`, `handleMoveToPantry`, the tier-grouping `useMemo`, the rendering of tier headers / aisle subheaders / `<GroceryListItem />` rows.
- The `loadItems` function or the `items` state shape.

---

## Verification

1. `npx tsc --noEmit --skipLibCheck` — only the 2 pre-existing baseline errors. Zero new.
2. **Smoke test (Tom):**
   - **Path A — no overlap:** Open a list with an item that's NOT on any other active list. Check it off. Item moves to In cart tier. **No prompt.** Continue normally.
   - **Path B — overlap, Keep:** Manually create overlap. Add olive oil (or any common ingredient) to two of your active lists. Open list 1, check off the olive oil. Prompt appears: "✓ Olive oil checked off / Also on your **{list2}** — keep it there?" Wait 5 seconds. Prompt auto-dismisses. Open list 2 — olive oil still there.
   - **Path C — overlap, Remove:** Same setup. Check off on list 1 → prompt appears → tap **Remove**. Prompt closes. Open list 2 — olive oil is gone.
   - **Path D — overlap, Remove with already-checked elsewhere:** Add olive oil to lists A, B, C. Check off on B (list 1). On A, manually check off (so it's in cart). Now check off on C — prompt should fire showing only **list 1** (B), not A (already in cart, filtered out by `is_in_cart = false` clause).
   - **Path E — custom item, no prompt:** The duct-tape custom item from CP1 smoke test — it has `ingredient_id = null`. Check it off. **No prompt** (skipped at the wiring site).
   - **Path F — un-check, no prompt:** Check off any item, then un-check it. The un-check should NOT fire the prompt (only `false → true` transitions do).
3. `git status --short` — expected file changes:
   - `lib/groceryListsService.ts` (new function + optional helper)
   - `lib/types/grocery.ts` (only if the optional `CrossListIngredientPresence` type is added)
   - `components/CrossListPrompt.tsx` (NEW)
   - `screens/GroceryListDetailScreen.tsx` (state + 2-3 callbacks + JSX render of prompt)
   - `docs/PK_CODE_SNAPSHOTS.md` (Rule E: bump rows for the 2 service/screen files)
   - `docs/SESSION_LOG.md`

---

## Constraints

- **Services handle ALL Supabase calls.** Component does not import `supabase` directly.
- **Do not remove existing functionality.** All current grocery-list features stay intact.
- **Do not touch `pantryService` or any non-grocery service.**
- **Do not modify the `GroceryListItem` row component.** The prompt is a sibling overlay.
- **Auto-dismiss default is Keep.** The prompt does NOT default to Remove. This is the design intent — same item on different lists usually represents different intents.
- **Only `false → true` checkbox transitions fire the prompt.** Un-checking never fires it.
- **Custom items are skipped.** No prompt for `ingredient_id IS NULL` items.
- **Already-in-cart items on other lists are filtered out** in the service query (`is_in_cart = false` clause). The user shouldn't see a prompt referencing a list where the item has already been bought.
- **No new dependencies.** No new npm packages.
- **No phase doc / DEFERRED_WORK edits in this CP.** Doc-hygiene happens in a separate post-smoke-test pass, same pattern as CP1+CP1a.

---

## Out-of-band items to flag in SESSION_LOG

1. Whether the `CrossListIngredientPresence` type was added (Part 1c) or kept inline.
2. Whether the `deleteItemsByIngredientFromLists` helper was added (Part 1b) or the screen loops `deleteListItem`.
3. Any deviations from `CookDepletionBanner`'s structure that were necessary (e.g., differences in how the SafeAreaView edges or z-index were applied).
4. Any surface-level surprises in `handleToggleItem` integration (e.g., race conditions between `loadItems()` and the `items.find()` lookup).
5. If the existing `toggleItemInCart` service signature doesn't accept the data needed to know whether this was a check-on or check-off (i.e., it only takes the item id and not the new state) — flag as a service-shape concern.

---

## SESSION_LOG entry format

Standard format. Entry title: `Phase 8C-CP2 — Cross-list checkoff-moment confirmation`.

Required sections per `DOC_MAINTENANCE_PROCESS.md` Section 8.

`Decisions made during execution:` — assign D8-38 onward only if real decisions arise. Likely candidates: whether to add the `deleteItemsByIngredientFromLists` helper or loop `deleteListItem` from screen; whether to add the `CrossListIngredientPresence` type to canonical or keep inline.

---

## Closing

This CP closes the cross-list awareness scope of Phase 8C in a single execution session. After it lands and Tom smoke-tests:

1. Doc-hygiene CP runs (PHASE_8 v2.7 → v2.8 with 8C-CP2 ✅ Complete + relevant decisions in Decisions Log + 8C build-plan row updated to "2 of 8 done"). Combined with P8-18 addition.
2. 8C-CP3 design begins (recipe chips on grocery detail — chip bar at top filters to items linked via `grocery_list_items.recipe_id`, recipe-linked rows show recipe name + recipe quantity inline).

Phase 8C build plan still 6-8 sessions; 2 of 8 then complete.
