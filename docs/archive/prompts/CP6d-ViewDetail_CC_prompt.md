# CC PROMPT — Phase 8R-CP6d-ViewDetail

**Phase:** 8R-CP6d-ViewDetail (grocery-side UX overhaul)
**Estimated cost:** M-L. ~600-900 lines net.
**Prerequisite:** CP6d-Schema (service layer) shipped. Specifically, the createNeed dedup softening (Gap-G41) is required for inline-add behavior to work right.

---

## Context

Per audit doc (`8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md`, section "CP6d-ViewDetail"). This CP transforms ViewDetailScreen from CP6c's current state (cycle-tap need rows + long-press EditNeedSheet + global cart footer + acquired-only progress bar) to: inline type-and-add row, split tap-zones (dot=cycle, name=edit), inline +/- quantity buttons, cart-as-section that physically partitions in_cart needs out of main body, in_cart-counted progress bar, and merged-row expand-children.

Plus: Bulk Acquire promotion prompt (uses CP6d-Schema service behavior — when needs without supply_id are bulk-acquired, prompt user to track them as supplies).

Can ship parallel to CP6d-Pantry. Both depend only on Schema.

---

## Inputs to read

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — sections "Decisions Locked", "CP6d-ViewDetail", and gap rows G5, G6, G7, G14, O8, LR8.
2. `screens/ViewDetailScreen.tsx` — full file. Heavy modification target.
3. `lib/services/needsService.ts` — `createNeed`, `setNeedStatus`, `cycleNeedStatus`, `mergeNeedsForDisplay`, `updateNeed`. Post-CP6d-Schema, createNeed dedup is softened.
4. `lib/services/suppliesService.ts` — `createSupply`. Post-CP6d-Schema, accepts new optional params.
5. `lib/types/needs.ts` — Need types.
6. `components/AddNeedSheet.tsx` — read for the "configure-once-and-done" pattern; do NOT modify in this CP.
7. `components/EditNeedSheet.tsx` — read for tag-picker + delete pattern; do NOT modify here.
8. `lib/utils/pluralize.ts` — added in CP6d-Pantry; reuse for need rows.

---

## Tasks

### Task 1 — Inline type-and-add row (Gap-G5)

NEW component: `components/InlineAddNeedRow.tsx` (~150 lines).

Renders ABOVE the Regulars strip in ViewDetailScreen body. Visual: a TextInput row that looks like a need-row-shaped placeholder.

Behavior:
- TextInput placeholder: "+ Type to add"
- As user types (debounce 200ms): hit `search_ingredients` RPC for top 3 matches. Show inline below the input as compact suggestions (T1 supply hits with 🏠 prefix, T2 ingredient hits with 🆕 prefix, T3 custom always-visible at top per Q33).
- **Tap a T1 supply suggestion:** creates need with `supply_id: <id>`, view's filter inheritance applied. Closes suggestion list. Clears input. Refreshes parent list.
- **Tap a T2 ingredient suggestion:** creates need with `ingredient_id: <id>`, view's filter inheritance applied.
- **Tap T3 (custom name):** creates need with `custom_name: <query>`.
- **Submit-on-return without selecting:** treats as T3 if no exact match in T1/T2; otherwise picks the top T1.
- **"More options" affordance:** small chevron at right of input. Tap → opens AddNeedSheet pre-populated with the current query (full configure path).

View-context inheritance (Q21):
- Active view's filters get applied as tags. Tonight view (urgency=today) → new need gets urgency=today tag.
- Multiple-value filters (e.g., urgency in [today, this-week]): apply only the most-specific value (today wins).
- Status filter ignored (it's a row-level field, not a tag).

Default qty: 1. Default unit: empty (user can configure via AddNeedSheet for unit).

T1 dedup applies via createNeed's softened dedup from CP6d-Schema — same identity + same routing → returns existing need. Different routing (e.g., different unit) → creates separate need.

### Task 2 — Tap-zones split on need rows (Gap-G6)

Currently NeedRow is one big TouchableOpacity with `onPress={cycle}` and `onLongPress={edit}`.

Refactor to split tap zones:
- **Status dot tap-zone (left side):** small TouchableOpacity wrapping JUST the status indicator. `onPress` triggers cycle.
- **Name + tag area (center, takes most width):** `onPress` opens EditNeedSheet for that need.
- **Quantity area (right):** see Task 3.

Long-press still opens EditNeedSheet (defensive, hidden affordance — not removed).

Each tap zone needs its own TouchableOpacity to prevent gesture conflict. Wrap in a parent View with `flexDirection: 'row'`.

Visual: status dot stays roughly the same size. Tap-zone hit-target should be ≥30×30 pt for accessibility.

### Task 3 — Inline +/- quantity buttons (Gap-G7)

Currently quantity is display-only on need row.

Add to the right side of NeedRow: small minus and plus buttons inline. ~24x24 pt each, with quantity number between them.

Behavior:
- **Tap +:** call `updateNeed(needId, { quantityDisplay: currentQty + 1 })`. Optimistic update; revert on error.
- **Tap −:** call `updateNeed(needId, { quantityDisplay: currentQty - 1 })`. If quantity would go to 0, the button should be disabled (can't remove a need by hitting minus — they should long-press → Delete).
- **No quantity (qty is null):** show only "+ Add qty" button. Tapping creates qty=1.
- Increment by 1 (per Tom's call — OPEN-1 closed at 1, not 0.5).

Apply on every list, not just specific views.

For merged need groups: the +/- buttons act on the FIRST need in the group (or the merged-display logic — TBD; simplest is to make the buttons hidden when a row is merged from multiple recipes, since you'd be incrementing one specific source need without clear UX which one).

### Task 4 — Cart-as-section all views (Gap-G14)

Replace current global cart footer pattern with per-view cart-as-section that physically partitions needs.

Logic:
- All needs visible in the view get partitioned at render: `body = needs where status='need'`, `cart = needs where status='in_cart'`.
- Body renders first. Cart section renders below body.
- Cart section header: `🛒 In cart (N) ▾` — collapsible, default-collapsed if cart is non-empty. If cart is empty, section doesn't render at all.
- Items in cart section appear in same NeedRow format as body. Cycle from in_cart → acquired removes them from cart section (acquired needs don't render in any visible section).
- Items cycled from need → in_cart: physically move from body section to cart section. Use React's natural re-render (the partition recomputes on next render).
- Items cycled from in_cart → need: move back to body, sort alphabetically into their natural position. Position is determined by sort logic, not history (i.e., we don't track "where it was" — the natural alphabetical position is where it goes).
- **Apply to ALL views**, not conditional on whether the view filters need-only. The In Cart view filter (status=in_cart) shows ONLY the cart section (body is empty, but cart section renders).

For the In Cart view specifically:
- Body section is empty (no `need` status needs in scope).
- Cart section IS the whole view.
- Bulk Acquire button (Task 6) appears as a sticky footer instead of the inline `+ Add need` button.

Remove the existing CP6c global cart footer code path. Replace with this per-section pattern.

### Task 5 — Cart progress bar metric flip (Gap-G14b, Q2)

Currently progress bar counts `acquired` only. Flip to count `acquired || in_cart`.

Per Tom's note: should be "representative of what's in your cart while you're at the store."

In the existing `acquiredSinceMount` set logic: change the increment guard from `nextStatus === 'acquired'` to `nextStatus === 'acquired' || nextStatus === 'in_cart'`. Also: when transitioning OUT of in_cart back to need, decrement.

Track `inCartOrAcquiredSinceMount` instead. Same denominator (mount-time snapshot of visible need IDs).

3-line change in the existing handler.

### Task 6 — Bulk Acquire with promotion prompt (Gap-LR8)

Update existing `handleBulkAcquire` in ViewDetailScreen.

Pre-CP6d behavior: marks all visible in_cart needs as acquired, restocks supplies for any with supply_id set. Needs without supply_id just acquire (and effectively vanish).

New behavior:
1. Partition cart needs: `withSupply` (have supply_id) and `withoutSupply`.
2. If `withoutSupply.length === 0`: existing behavior (acquire all + restock).
3. If `withoutSupply.length > 0`: show **NEW BulkAcquirePromotionModal** before completing the bulk-acquire.

NEW component: `components/BulkAcquirePromotionModal.tsx` (~200 lines).

Modal shape:
```
"You bought N items not yet tracked"

Subtitle: "Track them as supplies so they're easier to manage next time?"

[Multi-select list of items]:
  ☑ Coffee beans
  ☑ Aluminum foil  
  ☑ Olive oil (small bottle)
  ...
  (default all checked)

[Cancel]   [Acquire all + track N]
```

On confirm:
- For each CHECKED item: createSupply (with inferred tracking_mode + storage_location from CP6d-Schema), then setNeedStatus(needId, 'acquired'), then setSupplyStatus(newSupplyId, 'in_stock').
- For each UNCHECKED item: setNeedStatus(needId, 'acquired') only (current behavior).
- For each `withSupply` item: existing behavior (acquire + restock).

On cancel: just close modal, don't acquire anything.

Wire ViewDetailScreen's existing handleBulkAcquire to open this modal when `withoutSupply.length > 0`.

### Task 7 — Merged-row expand-children (Gap-O8)

Per Tab 6 Variant C wireframe and Q28 (recipe-attribution preserved).

When a merged group has 2+ source needs (e.g., cream cheese needed by both Cheesecake and Cinnamon Rolls), show a `▾` chevron next to the merged display.

Tap chevron: expand inline to show child rows:
```
Cream cheese — 12 oz total · 2 recipes  ▾
   ├── 8 oz · Cheesecake
   └── 4 oz · Cinnamon Rolls
```

Child rows are visually indented + slightly smaller text. They DO have their own status indicators but are read-only on tap (cycling propagates to merged parent).

Implementation:
- Add `expandedMergedKeys` state (Set of merged-group keys) to ViewDetailScreen.
- In NeedRow rendering for merged groups: if `merged.needs.length > 1`, render the expand chevron. Toggle on tap.
- When expanded, render child rows below the parent merged row. Each child shows: `quantity unit · recipe name`.
- Source: each child need has its `recipe` attribution from `needs_recipes` junction (already loaded via NEED_SELECT join).

Visual: ~20px left indent for child rows, smaller font (typography.sizes.sm). Status dot smaller. No interactive cycle on children (read-only summary).

### Task 8 — Pluralization on need rows

Use the `lib/utils/pluralize.ts` helper from CP6d-Pantry.

In the NeedRow display name logic:
```ts
const displayName = pluralize(
  need.ingredient?.name ?? need.custom_name ?? '',
  need.ingredient?.plural_name,
  need.quantity_display ?? 1
);
```

Apply consistently in every render path (Tier mode, Aisle mode, Flat mode).

---

## Constraints

- **DO NOT** modify needsService logic (createNeed dedup softening came from CP6d-Schema). Add nothing to needsService in this CP.
- **DO NOT** modify suppliesService. createSupply already accepts the right params from CP6d-Schema.
- **DO NOT** modify AddNeedSheet, EditNeedSheet, ExpandedRegularsSheet — those changes are CP6d-Sheets.
- **DO NOT** modify RecipeDetailScreen or AddRecipeToNeedsModal — those are CP6d-Recipe.
- **DO NOT** break the existing CookDepletionBanner integration. Banner still appears after cook flow.
- **DO NOT** break the SpawnOnOutToast integration. Toast continues to fire on supply→out transitions (from supply rows in Pantry, not from this screen).
- **DO** preserve the CP5a/CP6c rendering of Tier/Aisle/Flat modes. Don't change render logic except where necessary for the new features (cart partition, expand-children, +/- buttons, tap-zones).
- **DO** preserve the existing Regulars strip and ExpandedRegularsSheet integration.
- **PRESERVE all existing exports.**

---

## Verification

1. **Inline add — basic case.** On Tonight view, type "milk" + return → need created with urgency=today tag. Appears in body section sorted alphabetically.
2. **Inline add — T1 supply hit.** Type "olive oil" (assuming you have an olive oil supply) → 🏠 suggestion appears → tap it → need created with supply_id linked. View now shows it.
3. **Inline add — dedup softening.** Type "olive oil" twice in a row with same routing → second attempt returns existing need (no duplicate). With different unit/store → creates separate need (per G41).
4. **Tap-zones split.** Tap status dot on a need → cycles. Tap name area → opens EditNeedSheet. No conflict.
5. **+/- quantity.** Need with qty=2: tap + → qty=3, tap − → qty=2, tap − → qty=1, − button disabled at qty=1 (or hidden).
6. **Cart-as-section.** On Tonight view with 5 needs: cycle 2 to in_cart. Body now shows 3 needs, cart section appears below with 2 items. Tap cart header to expand. Cycle one in cart back to need → reappears in body in alphabetical position.
7. **Cart-as-section on In Cart view.** Body is empty. Cart section IS the whole view. Bulk Acquire footer present.
8. **Cart progress bar.** Cycle a need to in_cart → progress bar increments. Cycle back to need → decrements. Cycle to acquired → stays incremented.
9. **Bulk Acquire promotion prompt.** Cart has 5 items, 2 with supply_id, 3 without. Tap Bulk Acquire → modal shows the 3 without with checkboxes. Default all checked. Confirm → 3 supplies created, 5 needs acquired. Verify in Supabase: 3 new rows in supplies table with `tracking_mode` inferred correctly.
10. **Merged expand-children.** A merged group with 2+ recipes (e.g., cream cheese from cheesecake + cinnamon rolls) shows ▾. Tap → child rows appear with per-recipe quantities.
11. **Pluralization on need rows.** Need for bananas, qty=3, ingredient.plural_name='bananas' → renders "3 bananas". Same need at qty=1 → "1 banana".
12. **Long-press still works.** Long-press a need row → EditNeedSheet opens (defensive path preserved).

---

## SESSION_LOG entry format

(Same template as CP6d-Schema. Note files created vs modified, deviations, open questions, tracker rows.)
