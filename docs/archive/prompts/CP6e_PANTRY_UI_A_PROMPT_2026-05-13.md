# CC Prompt — CP6e-PantryUI-a · SupplyRow lot-aware badge + lots inline expansion

**Date:** 2026-05-13
**Author:** Claude.ai planning instance
**Type:** UI component build — first of three CP6e-PantryUI sub-prompts
**Estimated effort:** ~1 CC session, ~500-700 lines net (mostly new components + targeted SupplyRow modifications)
**Depends on:** CP6e-Services-a/-b/-c SHIPPED + smoke passed. lotsService exists; supplies have `tracks_lots`; `SupplyWithTags` may include `lots?` and `lot_aggregate?` when fetched with `includeLots: true`.

---

## Context

CP6e-Services-a/-b/-c are complete and smoke-tested. The service layer fully supports tracks_lots supplies (create lots, deduct lots on cook, restock via lot create on acquire). But the UI still renders every supply as a non-lots supply — usage_level slider, 5-circle dots, no lot visibility.

This is the FIRST of three CP6e-PantryUI sub-prompts:
- **-a (this prompt):** SupplyRow lot-aware badge + inline lots expansion + variant sub-headers (Q50). Lots are display-only here.
- **-b (next):** SupplyDetail rebuild + lot edit modal + search-within-lots (Q51).
- **-c (later):** SupplyCreateSheet tracks_lots toggle + first-lot inline inputs + Pantry overview mixed rendering.

**Authoritative spec:** `docs/phase_8r_lots_wireframes_v2.html` (Tabs 1, 2, 3, 4 cover this prompt's scope). Open it in a browser and reference as you build. The visual language, badge shapes, expand panel structure, and variant sub-header rendering are all defined there.

**No service-layer changes in -a.** All data flows through existing service APIs.

**No SupplyDetail / SupplyCreateSheet edits in -a.** Those are -b and -c respectively.

**No lot edit modal in -a.** Lot rows are display-only; tap is a no-op (or breadcrumbs to SupplyDetail — see Task 5). PantryUI-b adds the modal.

**No search-within-lots input in -a** (Q51 / 4+ lots threshold) — deferred to -b.

---

## Inputs to read

1. **`docs/phase_8r_lots_wireframes_v2.html`** — Tabs 1-4. This is the spec. The wireframes' visual language, spacing, color palette, and component composition are authoritative. Match what's drawn.

2. **`docs/PHASE_8R_UNIFIED_NEEDS.md`** (v0.6) — relevant decisions:
   - D8R-Q43 (tracks_lots opt-in flag)
   - D8R-Q50 (variant sub-headers when 2+ distinct variant_labels)
   - D8R-Q54 (tap-cycle on lot-aware badge cycles status)
   - D8R-Q55 (accent color always mirrors status, not lot urgency)

3. **`components/pantry/SupplyRow.tsx`** — full file. The component you're modifying. Read end-to-end. Existing structure includes:
   - `<StatusIcon usageLevel={level} status={status} size={22} />` at line ~157 — renders the 5-circle badge for non-lots supplies
   - `handleStatusIconTap` at line ~113 — calls `setSupplyUsageLevel(supply.id, nextLevel)` and cycles through 1-5
   - Inline expand region below the row (currently shows brand, notes, tags) — you'll add a lots collapser to it

4. **`components/pantry/SuppliesSection.tsx`** — read to understand how SupplyRow is consumed and how data flows. You may need to thread `includeLots: true` through to the supplies fetch — see Task 2.

5. **`screens/PantryScreen.tsx`** — read to understand fetch path. Determine where `getSuppliesForSpace` is called and confirm whether `includeLots` is currently passed.

6. **`lib/services/lotsService.ts`** — confirm `getLotAggregate(lots)` function exists and returns the shape from -a. You'll consume it in SupplyRow.

7. **`lib/types/supplies.ts`** — confirm `SupplyWithTags` has optional `lots?` and `lot_aggregate?` fields per -a's contract. Confirm `SupplyLot` shape (storage_location, variant_label, brand, quantity, quantity_unit, expires_at, consumed_at).

8. **`constants/cookingMethods.ts` or similar icon constants** — find where existing pantry icons live (you'll likely add a new unit icon set in Task 1).

9. **Existing `StatusIcon` component** — find via grep on `StatusIcon` import in SupplyRow. Read it. You'll create a sibling `LotBadge` component that follows similar patterns.

---

## Tasks — execute in order

### Task 1 — Unit-icon mapping utility

Create `lib/utils/unitIcons.ts` (or wherever pantry-facing utilities live; match existing project structure).

Per the wireframe Tab 1, each lot's quantity displays alongside an icon representing the unit type. Examples:
- `count` (whole items like eggs, lemons) → numeric badge icon (a "#" or similar)
- `bag` (bag of chips, bag of frozen peas) → bag icon
- `bottle` (bottle of wine, soy sauce) → bottle icon
- `jar` (jar of mayo, pasta sauce) → jar icon
- `pack` (pack of chicken, pack of bacon) → pack/package icon
- `bunch` (bunch of cilantro, scallions) → bunch icon
- `container` (yogurt container, hummus tub) → container icon
- `weight` (chicken thighs in lb, butter in oz) → scale icon

Export a function `getUnitIcon(quantityUnit: string, ingredientTypicalUnit?: string): IconName` that maps a unit string to an icon. Strategy:
- Direct mapping for known units: `'lb' | 'oz' | 'g' | 'kg' → 'weight'`, `'ct' | 'count' → 'count'`, etc.
- Fall back to `ingredientTypicalUnit` if `quantityUnit` is unrecognized.
- Fall back to a generic icon (`count` or `package`) if both are unknown.

Use `lucide-react-native` icons (the project's existing icon library — confirm via grep on `lucide-react-native` imports in other components). Suggested mappings:
- `weight` → `Scale` or `Weight`
- `count` → `Hash` (a "#") — fallback to text-only if no good match
- `bag` → `ShoppingBag`
- `bottle` → `Wine` or `Milk`
- `jar` → `Coffee` (cylindrical container approximation; check wireframe)
- `pack` → `Package`
- `bunch` → `Wheat` (closest approximation for greens)
- `container` → `Box` or similar

If lucide-react-native lacks a clean match for one, pick the visually closest available; don't invent custom SVGs in -a. Add a TODO comment noting refinement candidates.

Keep this utility pure (no side effects, no hooks).

### Task 2 — Thread `includeLots: true` through pantry fetch

`SupplyRow` and `LotBadge` need lot data on tracks_lots supplies. The fetch happens upstream — likely in `PantryScreen.tsx` or a shared hook.

Find the call to `getSuppliesForSpace` (or `getSupplyById` in some flows). Modify the call site to pass `{ includeLots: true }` so all fetched supplies arrive with `lots` and `lot_aggregate` populated when applicable.

Note: per -a's contract, supplies with `tracks_lots = false` arrive with `lots: []` and `lot_aggregate: undefined`. Non-lots supplies are unaffected by this change.

If `getSuppliesForSpace` is called in multiple places, modify only the Pantry-tab call site for -a. Other call sites (grocery list, etc.) can stay non-lots-fetching until those screens need it.

### Task 3 — Create `LotBadge` component

Create `components/pantry/LotBadge.tsx`. Sibling to `StatusIcon`.

```tsx
interface LotBadgeProps {
  totalQuantity: number;        // from lot_aggregate.total_quantity
  canonicalUnit: string | null; // from lot_aggregate.canonical_unit; null = mixed
  status: SupplyStatus;         // 'in_stock' | 'low' | 'critical' | 'out' | 'unknown'
  size?: number;                // default 22 to match StatusIcon
}
```

Visual:
- Status-colored background pill (use `colorForStatus(status, ...)` already in SupplyRow imports)
- Numeric value (e.g., "3", "1.25", "12") rendered as text inside the pill
- Unit icon next to or behind the number (per wireframe Tab 1, the icon is small, on the right or as a background watermark — match the wireframe)
- If `canonicalUnit === null` (mixed units across lots): show "—" or "mixed" instead of a number (the lot count info is in the row summary, not the badge)
- For tiny lot counts (1, 2): center the digit; for larger or decimal: left-align with a smaller unit icon next to it

Tap handling is NOT in this component — SupplyRow wraps it in a TouchableOpacity (Task 4).

Reference the wireframe Tab 1 for sizing, padding, and color treatment. Match closely but not pixel-perfect — RN doesn't need that.

### Task 4 — Modify `SupplyRow.tsx` to branch on tracks_lots

Replace the `<StatusIcon ... />` call at ~line 157 with a ternary:

```tsx
{supply.tracks_lots && supply.lot_aggregate ? (
  <LotBadge
    totalQuantity={supply.lot_aggregate.total_quantity}
    canonicalUnit={supply.lot_aggregate.canonical_unit}
    status={status}
    size={22}
  />
) : (
  <StatusIcon usageLevel={level} status={status} size={22} />
)}
```

The TouchableOpacity wrapper stays unchanged.

Add a second tap handler `handleLotBadgeTap` for tracks_lots supplies:

```tsx
const handleLotBadgeTap = async () => {
  const nextStatus: SupplyStatus = STATUS_CYCLE_NEXT[status] ?? 'in_stock';
  try {
    const updated = await setSupplyStatus(supply.id, nextStatus);
    onSupplyChanged(updated);
  } catch (error) {
    console.error('❌ SupplyRow lot-badge cycle error:', error);
    onCycleError?.(error);
  }
};
```

The cycle order should match the existing one used by non-lots: in_stock → low → critical → out → in_stock. Read the existing `STATUS_CYCLE_NEXT` constant (likely in `lib/utils/...` or `constants/`); if not present, define inline.

**Important:** for tracks_lots supplies, tapping the badge ONLY changes status (color + label of badge). The lot count (number displayed) is derived from lot_aggregate and does NOT change on tap. This is intentional per D8R-Q54 — tap is "tell the system how things feel," not "magic the lot count."

The TouchableOpacity's `onPress` should branch:

```tsx
onPress={supply.tracks_lots ? handleLotBadgeTap : handleStatusIconTap}
```

### Task 5 — Lots inline expansion in the existing expand panel

The expand panel below the row currently shows brand, notes, tags. Add a NEW section to it: a lots collapser.

Behavior:
- ONLY rendered when `supply.tracks_lots === true` AND `(supply.lots?.length ?? 0) > 0`
- Default state: collapsed
- Header line: "N lots · M unit · oldest exp Date" with a chevron-down indicator
- Tap header → expand the lots list inline (within the supply's row expand panel — not a modal)

Header copy logic:
- N = lot_aggregate.lot_count (active lots only)
- M = lot_aggregate.total_quantity formatted to 1 decimal place (or whole number if integer)
- unit = lot_aggregate.canonical_unit; if null, render "M" as "mixed" (degrade gracefully per P4 in planning)
- Date = lot_aggregate.oldest_expiration formatted as "Mon DD" or "Mon DD, YYYY" if more than 11 months out. If null (no lot has expiration), omit the "· oldest exp Date" portion entirely.

Examples:
- "3 lots · 1.5 lb · oldest exp Jul 12"
- "2 lots · mixed · oldest exp May 22"  (mixed units)
- "1 lot · 12 ct"  (no expiration)
- "4 lots · 2.25 kg · oldest exp Jun 3"

Place this collapser ABOVE the existing brand/notes/tags content in the expand panel. The lots are the primary "what's in this supply" information; brand/notes/tags are secondary.

### Task 6 — Create `LotsList` component

Create `components/pantry/LotsList.tsx`. Renders the inline list of lots when the lots collapser is expanded.

```tsx
interface LotsListProps {
  lots: SupplyLot[];     // active lots only — caller pre-filters consumed_at IS NULL
  onLotTap?: (lot: SupplyLot) => void;  // optional — undefined in -a
}
```

Rendering rules:

**A. Variant grouping (D8R-Q50):**
- Compute distinct `variant_label` values across lots (excluding NULL).
- If `distinct_count >= 2`: render variant sub-groups. Each group has a small header text (the variant_label), an item count, and optional aggregate qty. The lots in that group render under the header.
- If `distinct_count < 2`: render a flat list. No sub-headers.

Sub-header format (when variant grouping):
- "Bone-in skin-on · 2 lots · 2.5 lb"
- "Boneless skinless · 1 lot · 0.75 lb"
- Lots with `variant_label = NULL` fall under a "Unlabeled" sub-group if any other lots HAVE labels (mixed case). Otherwise they're in the flat list (no grouping).

**B. Lot ordering within a group:**
- Sort by `expires_at ASC NULLS LAST, acquired_at ASC` — oldest-expiring first; ties broken by oldest-acquired first. This matches the depletion order users will see when cooking, which is the right mental model.

**C. Per-lot row (`LotRow.tsx` — new component, Task 7):**

### Task 7 — Create `LotRow` component

Create `components/pantry/LotRow.tsx`.

```tsx
interface LotRowProps {
  lot: SupplyLot;
  onTap?: () => void;  // -a: undefined (read-only); -b: opens edit modal
}
```

Visual per wireframe Tab 1/2:
- Small "chip" or "card" layout, horizontally laid out
- Left edge: storage location badge (small text label "Freezer", "Fridge", "Pantry", "Counter" or icon)
- Middle: quantity + unit (e.g., "1.25 lb")
- Right: expiration ("exp Jul 12" or "exp in 3d" with warn-color text/border when ≤ 3 days)
- Optional sub-line: variant_label (only when variant grouping is OFF — flat list mode), brand, notes truncated

Expiration urgency styling:
- > 7 days from now: muted text color
- 3-7 days: subtle warn color (yellow/amber)
- ≤ 3 days: stronger warn (orange/red border on the row, bold red text)
- ≤ 0 days (already expired): red strikethrough or "EXPIRED" badge

These thresholds are F&F defaults; can be made configurable post-F&F (P8R-D candidate per Tom's planning).

Tap: if `onTap` provided, call it. In -a it's undefined (no-op or breadcrumb). In -b it'll open the lot edit modal.

### Task 8 — Wire it together

In SupplyRow.tsx, the expand panel section should look approximately like:

```tsx
{expanded && (
  <View style={styles.expandPanel}>
    {/* NEW — only when tracks_lots */}
    {supply.tracks_lots && (supply.lots?.length ?? 0) > 0 && (
      <LotsCollapser
        lots={supply.lots!}
        aggregate={supply.lot_aggregate!}
        onLotTap={undefined}  // -a: no modal; tap is no-op or "Open supply detail"
      />
    )}

    {/* Existing — brand, notes, tags etc. */}
    {brandLabel && <Text>{brandLabel}</Text>}
    {/* ... */}
  </View>
)}
```

Where `LotsCollapser` is an internal component (could live in SupplyRow.tsx or a separate file — your call) that renders:
1. The collapser header line (Task 5)
2. The `<LotsList lots={lots} />` below when expanded

The lots-collapser's expand state is independent of the supply row's expand state. Both can be toggled independently.

---

## Constraints

1. **No service-layer changes.** All data flows through existing `getSuppliesForSpace(spaceId, { includeLots: true })` and `setSupplyStatus`. If you find a service gap that blocks the UI, STOP and report.

2. **No SupplyDetail / SupplyCreateSheet edits.** Out of scope for -a.

3. **No lot edit modal in -a.** Lot rows are display-only.

4. **No search-within-lots input in -a** (Q51 deferred).

5. **Match the wireframe.** Spacing, color, font sizes, badge shapes — `docs/phase_8r_lots_wireframes_v2.html` is the spec. Tabs 1-4 cover this prompt.

6. **Preserve all existing SupplyRow behavior for non-lots supplies.** Branch only on `supply.tracks_lots`. If a supply has `tracks_lots: false`, the row should look and behave identically to today.

7. **TypeScript strict.** Match existing strictness. No `any` unless existing code uses it for the same shape.

8. **No tests.** -a is display-layer; visual verification is the test.

9. **Performance:** the LotsList with variant grouping is a synchronous render. Pre-compute the grouping in a `useMemo` keyed on `lots` array reference. Don't re-compute on every render.

10. **Accessibility:** the LotBadge tap target should have an `accessibilityRole="button"` and `accessibilityLabel` describing the cycle action (e.g., `Cycle ${displayName}, currently ${statusLabel(status)}, 3 lots totaling 1.5 lb`).

11. **Empty / edge cases:**
    - `supply.tracks_lots === true` but `supply.lots` is `[]` or undefined: do NOT render the lots collapser. Render the supply as a regular row (status badge + no lots section). The LotBadge can still render but with `totalQuantity: 0` and `canonicalUnit: null` — show "—" or "0" as appropriate.
    - `supply.tracks_lots === true` and lot_aggregate.total_quantity is 0 but there are still active lots: this shouldn't happen normally (Q44 would have flipped status to out + lot_aggregate would compute 0 from those lots). Render "0" in the badge, status color drives the UI.

---

## What this prompt does NOT do (defer to -b/-c)

- Lot edit modal (-b)
- SupplyDetail screen rewrite (-b)
- Search-within-lots input (-b)
- SupplyCreateSheet tracks_lots toggle (-c)
- Pantry overview "mixed" rendering rules (-c — mostly inherits from these changes)
- Auto-restock toast (CP6e-FlowsUI)

---

## SESSION_LOG entry format

```
## 2026-05-13 — CP6e-PantryUI-a · SupplyRow lot-aware badge + lots inline expansion

**Type:** UI build. First of 3 CP6e-PantryUI sub-prompts.

**Files modified:**
- components/pantry/SupplyRow.tsx (modified) — branching on tracks_lots; new handleLotBadgeTap; lots collapser slot in expand panel
- screens/PantryScreen.tsx (modified) — added `includeLots: true` to getSuppliesForSpace call
- lib/utils/unitIcons.ts (NEW) — unit string → icon mapping helper

**Files created:**
- components/pantry/LotBadge.tsx (NEW) — numeric+icon badge for tracks_lots supplies
- components/pantry/LotsList.tsx (NEW) — variant-grouped lot list rendering
- components/pantry/LotRow.tsx (NEW) — individual lot row (read-only in -a)

**Visual changes:**
- Tracks_lots supplies now show numeric badge instead of 5-circle dots
- Tap on numeric badge cycles status (color/label changes; number is lot-derived)
- Expand panel includes a lots collapser (default closed) showing "N lots · M unit · oldest exp Date"
- Lots list with variant sub-headers when ≥2 distinct variant_labels (D8R-Q50)
- Lot rows show storage + qty + expiration urgency styling

**Q-rule wiring:**
- D8R-Q54 (tap-cycle on lot badge) — handleLotBadgeTap calls setSupplyStatus
- D8R-Q50 (variant sub-headers) — LotsList groups when ≥2 distinct variant_labels
- D8R-Q55 (accent color = status) — already wired via colorForStatus in existing SupplyRow

**No service-layer touched. No SupplyDetail / SupplyCreateSheet touched. No lot edit modal. No tests.**

**Verification:**
- npx tsc --noEmit on touched files = zero errors
- Visual check via the running app on test supplies (chicken thighs from smoke test)

**Followups noted in code as TODO:**
- Unit icon refinements (some lucide icons are approximations; refine post-F&F)
- LotRow tap → SupplyDetail breadcrumb (no-op in -a; wired in -b)

**Next:** CP6e-PantryUI-b (SupplyDetail rebuild + lot edit modal + search-within-lots).
```

---

## If anything blocks

- **`supply.lot_aggregate` shape doesn't match the -a contract.** STOP and report. Read `lib/types/supplies.ts` to confirm the exact field names.
- **`getSuppliesForSpace` doesn't have `includeLots` option despite -a SESSION_LOG.** STOP. Don't add it — read what's actually in `suppliesService.ts` and report the gap.
- **`StatusIcon` component has different props or location than expected.** Find the actual one via grep on imports; reference accordingly.
- **The wireframe shows a visual element you can't replicate (custom illustration, complex animation).** Approximate with what's available. Note as TODO with a screenshot reference.
- **Lucide icon library is not installed or has a different package name.** Read `package.json` for the actual icon library; adapt accordingly.
- **Existing SupplyRow has subtleties (long-press menu, swipe actions, etc.) that interact with tracks_lots in unexpected ways.** Preserve existing behavior; if a real conflict arises, STOP and report.

Don't invent rendering rules. The wireframe is the spec.
