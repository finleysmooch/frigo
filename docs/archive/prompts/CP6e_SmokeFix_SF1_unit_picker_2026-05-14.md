# CC PROMPT — CP6e-SmokeFix-SF1 · UnitPicker no-ingredient mode + LotInputRowView swap

**Phase:** 8R · CP6e-Lots closeout smoke
**Source:** SF-1 in `CP6e_SMOKE_FINDINGS_2026-05-14.md`
**Maps to:** P8R-D27 (escalated 🟢 → 🟡 by SF-1)
**Severity:** 🟡 Annoying — UX friction surfaced in CP6e smoke 2026-05-14
**Estimated effort:** ~150-200 lines net, 1 focused session
**F&F target:** late August / early September 2026

---

## Context

CP6e smoke 2026-05-14 (SF-1) surfaced friction in lot entry on `SupplyCreateSheet`:

> "unit for lot entry should be a single select (Maybe scroll?) rather than free text. and it should default to the most common unit type for that item. for custom items default should just be 'unit' or something. I'm trying to add falafel and it's requiring a unit, but i just want to log i have 50 falafel in my freezer"

Three problems bundled:

1. **`LotInputRowView` uses a plain TextInput for `quantity_unit`** — free text, no validation, no suggestions, no sensible default. Tom hit it on the falafel-in-freezer scenario.
2. **`UnitPicker` requires a non-null `ingredientId`** — its `Props.ingredientId: string` is strict-non-null, blocking direct use in any flow that doesn't have an ingredient (custom-name supplies, custom-name lots).
3. **No default-unit logic** — even when an ingredient is selected, `LotInputRow` initializes `quantity_unit: ''` rather than seeding from `ingredient.typical_unit`.

The fix has three coordinated parts:
- **UnitPicker**: accept `ingredientId: string | null`. When null, skip common-units loading and route directly to all-units mode.
- **LotInputRowView**: swap the TextInput for UnitPicker. Receive `ingredientId` from parent. Pass it through.
- **SupplyCreateSheet** (the parent): pass `ingredientId` to LotInputRowView, and seed `quantity_unit` defaults at LotInputRow creation time (from `ingredient.typical_unit` if available; fall back to a generic "unit"/"each"/"count" for custom-name supplies).

### Scope leans (locked in Claude.ai chat)

- **In scope:** UnitPicker null-ingredient mode + LotInputRowView swap + SupplyCreateSheet default-seeding.
- **Out of scope:** AddNeedSheet / EditNeedSheet UnitPicker integration for custom-name needs (CP6d-Sheets uses UnitPicker conditionally — branches to TextInput when no ingredient). These are separate consumers; widening scope here risks breaking working flows. If post-SF-1 smoke shows that custom-name need entry has the same friction, file a follow-up prompt then. **Code comment in UnitPicker should note the null-ingredient mode is now available for these consumers to adopt.**
- **Out of scope:** Adding `quantity_unit` to a unit-FK column on `supply_lots`. Today the field is free-text string (verified from the falafel lot SQL: `"quantity_unit": "unit"`). Keeping that contract — UnitPicker still passes a display-name string back via `onSelectUnit(unitId, displayName)`, and we store `displayName` into `LotInputRow.quantity_unit`.

---

## Pre-read order

1. `components/UnitPicker.tsx` — current implementation. Note that `ingredientId: string` is non-nullable in Props, and `loadCommonUnits()` runs in a useEffect keyed off `ingredientId`. The "Other units…" button is conditioned on `!showingAll && commonUnits.length > 0`.
2. `components/pantry/LotInputRowView.tsx` — current implementation. The `quantity_unit` TextInput is in the `qtyUnitRow` View (the `<TextInput style={[styles.input, styles.unitInput]} ...>` block).
3. `components/SupplyCreateSheet.tsx` (latest, `_2026-05-13`). Read the LotInputRow initialization path — where rows get appended to the lot inputs state, and where the supply's ingredient_id resolves (T1 inherits from supply, T2 from catalog ingredient, T3 = custom = null).
4. `lib/types/supplies.ts` — verify `SupplyLot.quantity_unit` is free-text string (not FK). Used to confirm we keep storing display-name strings.
5. `screens/AddRecipeFromUrlScreen.tsx` / `components/AddNeedSheet.tsx` — read-only reference. Look at the current ingredient.typical_unit access pattern (the catalog seed flow probably already references it; mirror the pattern).

---

## SQL pre-check (Tom runs in Supabase before CC starts)

This determines what fallback unit name to use for custom-name supplies. Run:

```sql
-- See if a generic count unit exists in measurement_units
SELECT id, unit, display_singular, display_plural, unit_type
FROM measurement_units
WHERE LOWER(unit) IN ('unit','each','count','piece','pieces','item')
   OR LOWER(display_singular) IN ('unit','each','count','piece','item')
   OR LOWER(display_plural) IN ('units','each','count','pieces','items')
ORDER BY unit_type, unit;
```

Paste output. If a generic count-type unit exists, use that row's `display_plural` (or `display_singular`) as the custom-supply default. If multiple candidates, prefer `unit_type='count'`. If none exist, just default to the literal string `'unit'` — the field is free-text so this still saves cleanly.

---

## Task list

### Task 1 — `components/UnitPicker.tsx` — null-ingredient mode

**Change Props interface:**

```typescript
interface Props {
  ingredientId: string | null;  // was: string
  selectedUnit: string | null;
  onSelectUnit: (unitId: string, displayName: string) => void;
  disabled?: boolean;
}
```

**Change `useEffect` that loads common units:**

```typescript
useEffect(() => {
  if (ingredientId) {
    loadCommonUnits();
  } else {
    // No ingredient → no common units; ensure we start in all-units mode.
    setCommonUnits([]);
    setShowingAll(true);
    if (allUnits.length === 0) {
      loadAllUnits();
    }
  }
}, [ingredientId]);
```

**Adjust header logic in the modal:**

- When `ingredientId === null`: header title is always "All Units"; the back button never renders (no common units to go back to).
- When `ingredientId !== null`: existing behavior preserved (header flips between "Select Unit" and "All Units"; back button shows when in all-units view).

**Adjust "Other units…" button conditional:**

```typescript
{!showingAll && ingredientId !== null && commonUnits.length > 0 && (
  <TouchableOpacity ...>
    <Text style={styles.otherButtonText}>Other units...</Text>
  </TouchableOpacity>
)}
```

The `ingredientId !== null` guard makes the intent explicit (the existing `commonUnits.length > 0` would have suppressed the button anyway, but the guard documents the design).

**Add a code comment near the top of the file:**

```typescript
// CP6e-SmokeFix-SF1: ingredientId is now nullable. When null, the picker
// skips common-units loading and goes straight to all-units mode. Consumers
// that previously fell back to a plain TextInput for the no-ingredient case
// (AddNeedSheet / EditNeedSheet for T3 custom-name needs) can now adopt this
// component directly — see P8R-D27 in DEFERRED_WORK.md.
```

### Task 2 — `components/pantry/LotInputRowView.tsx` — swap TextInput for UnitPicker

**Extend `LotInputRowViewProps`:**

```typescript
export interface LotInputRowViewProps {
  row: LotInputRow;
  index: number;
  canRemove: boolean;
  disabled?: boolean;
  /**
   * CP6e-SmokeFix-SF1: ingredient_id from the supply being created.
   * Null for custom-name supplies. Passed through to UnitPicker so it can
   * load common units when an ingredient is selected, or fall back to
   * all-units mode otherwise.
   */
  ingredientId: string | null;
  onChange: (updated: Partial<LotInputRow>) => void;
  onRemove: () => void;
}
```

**Replace the `quantity_unit` TextInput** (the one in `qtyUnitRow`):

```tsx
<View style={styles.qtyUnitRow}>
  <TextInput
    style={[styles.input, styles.qtyInput]}
    keyboardType="decimal-pad"
    value={row.quantity}
    onChangeText={(v) => onChange({ quantity: v })}
    placeholder="Qty"
    placeholderTextColor={colors.text.tertiary}
    editable={!disabled}
    accessibilityLabel={`Lot ${index + 1} quantity`}
  />
  <View style={styles.unitPickerWrapper}>
    <UnitPicker
      ingredientId={ingredientId}
      selectedUnit={row.quantity_unit || null}
      onSelectUnit={(_unitId, displayName) =>
        onChange({ quantity_unit: displayName })
      }
      disabled={disabled}
    />
  </View>
</View>
```

**Add import:**

```typescript
import UnitPicker from '../UnitPicker';
```

**Update styles:**

Replace `unitInput` with `unitPickerWrapper`:

```typescript
unitPickerWrapper: {
  flex: 1,
},
```

(The picker provides its own internal styling; the wrapper just enforces the flex layout. Remove `styles.unitInput` if no other consumers reference it.)

**Verify the existing `qtyUnitRow` flex layout still works.** UnitPicker's `container` style is `flex: 1`, so wrapping it in a `flex: 1` View inside the row should give the same visual weight as the previous TextInput did.

### Task 3 — `components/SupplyCreateSheet.tsx` — pass ingredientId + seed defaults

**Find the LotInputRow creation site.** There are likely two: initial-row seed when tracks_lots toggles on, and append-row on "+ Add lot" tap. Both need the same default logic.

**Add a default-unit helper.** Place near top of file with other helpers, or inline if there's only one call site:

```typescript
/**
 * Determine the default quantity_unit for a new LotInputRow.
 * Priority:
 *   1. ingredient.typical_unit if an ingredient is selected
 *   2. Generic count unit ('{TBD from SQL pre-check}') for custom-name
 * Returns a display-name string suitable for storing in LotInputRow.quantity_unit.
 */
function defaultLotUnit(
  ingredient: { typical_unit: string | null } | null
): string {
  if (ingredient?.typical_unit) {
    return ingredient.typical_unit;
  }
  return 'unit';  // [or whatever the SQL pre-check determined]
}
```

**Update LotInputRow initialization to seed `quantity_unit` from this helper.**

For the initial row when tracks_lots toggles on:

```typescript
const seedRow: LotInputRow = {
  id: makeLocalId(),
  quantity: '',
  quantity_unit: defaultLotUnit(selectedIngredient),
  storage_location: selectedIngredient?.default_storage_location ?? 'pantry',
  // ... other fields ...
};
```

For "+ Add lot" appends:

```typescript
function addLotRow() {
  setLotInputs((prev) => [
    ...prev,
    {
      id: makeLocalId(),
      quantity: '',
      quantity_unit: defaultLotUnit(selectedIngredient),
      storage_location: selectedIngredient?.default_storage_location ?? 'pantry',
      // ... other fields ...
    },
  ]);
}
```

(Adjust names — `selectedIngredient` is illustrative; use whatever the actual state variable is.)

**Pass `ingredientId` through to LotInputRowView in the render:**

```tsx
<LotInputRowView
  row={row}
  index={idx}
  canRemove={lotInputs.length > 1}
  disabled={submitting}
  ingredientId={selectedIngredient?.id ?? null}
  onChange={(patch) => updateLotRow(row.id, patch)}
  onRemove={() => removeLotRow(row.id)}
/>
```

(Again — adjust names to match actual state. The key: pass `selectedIngredient?.id ?? null` as `ingredientId`.)

### Task 4 — Verification probes

After implementation, before declaring done:

1. **TypeScript:** `npx tsc --noEmit -p .` filtered to the 3 touched files. Zero new errors.
2. **Behavior parity check** for the ingredient-present path:
   - User selects an ingredient with `typical_unit='cup'` in SupplyCreateSheet, enables tracks_lots → first LotInputRow's quantity_unit should pre-populate with "cup" (display name).
   - User opens the UnitPicker → "Select Unit" header shows; common units appear if any are configured in `ingredient_common_units`; "Other units…" footer button shows.
   - User picks a different common unit → row's quantity_unit updates.
   - User taps "Other units…" → header flips to "All Units"; back button appears; full list loads.
3. **Behavior check for the no-ingredient (custom-name) path:**
   - User creates a supply with no ingredient (T3 custom-name route), enables tracks_lots → first LotInputRow's quantity_unit pre-populates with the generic fallback ('unit' or whatever Tom's SQL pre-check determined).
   - User opens the UnitPicker → "All Units" header shows immediately; no "← Common" back button (no common units to go back to); no "Other units…" footer button (we're already in all-units mode).
   - User picks any unit → row's quantity_unit updates.
4. **The falafel scenario specifically:**
   - Tap "+ Add supply" → enter "falafel" as custom name (no catalog match) → toggle tracks_lots on → first lot row appears.
   - Quantity unit field shows "unit" pre-populated (or whatever the fallback was set to).
   - User can type "50" in quantity and submit without ever touching the unit picker.
   - Storage segment defaults to "pantry" (no ingredient.default_storage_location available); user can flip to "freezer".
   - Save → supply + lot both persist correctly.

---

## Constraints

1. **No changes to** the `measurement_units` or `ingredient_common_units` tables, no new tables, no new DB columns.
2. **No changes to** `supply_lots.quantity_unit` semantics — stays free-text string, populated from UnitPicker's display-name callback.
3. **No changes to** `AddNeedSheet.tsx` / `EditNeedSheet.tsx` — out of scope for this prompt. Their custom-name TextInput fallback can be migrated to UnitPicker null-mode later if smoke surfaces friction.
4. **TypeScript strict.** No `any`. UnitPicker's new nullable prop is `string | null`, not `string | undefined` (matches existing `selectedUnit: string | null` convention).
5. **No new dependencies.** Use existing React Native primitives and the existing theme system.
6. **Preserve the existing `unitInput` style** if it's referenced elsewhere; only remove it if grep shows no other consumers in the working tree.

---

## What's explicitly out of scope

- AddNeedSheet / EditNeedSheet integration (separate prompt if needed)
- LotEditSheet's unit field (separate component; same swap could apply but isn't part of SF-1's complaint surface — Tom flagged lot-entry-at-create, not lot-edit-after-the-fact)
- Any change to UnitPicker's modal-positioning logic, "Other units…" affordance design, or visual styling
- Backfilling unit data on existing supply_lots rows

---

## SESSION_LOG entry template

```
## 2026-05-14 — CP6e-SmokeFix-SF1 · UnitPicker no-ingredient mode + LotInputRowView swap

**Type:** Component fix. Closes SF-1 from CP6e smoke (lot entry unit-field friction).

**Files modified:**
- `components/UnitPicker.tsx` (+N / -N lines). Props.ingredientId widened to `string | null`. When null: skips common-units load, routes directly to all-units mode, suppresses "Other units…" button and back-button. Added code comment noting consumer adoption path for AddNeedSheet / EditNeedSheet custom-name needs (P8R-D27 follow-up). ⚠️ PK snapshot now stale.
- `components/pantry/LotInputRowView.tsx` (+N / -N lines). Replaced free-text `quantity_unit` TextInput with UnitPicker. Added `ingredientId: string | null` prop. Removed `unitInput` style (replaced by `unitPickerWrapper`). ⚠️ PK snapshot now stale.
- `components/SupplyCreateSheet.tsx` (+N lines). Added `defaultLotUnit` helper. LotInputRow initialization sites (initial seed + "+ Add lot" append) now seed `quantity_unit` from `ingredient.typical_unit` when available, else generic fallback. Passes `ingredientId` to each LotInputRowView. ⚠️ PK snapshot now stale.

**Decisions made during build:**
- [Generic-fallback unit choice — what the SQL pre-check returned + final string used]
- [Whether `unitInput` style was kept or removed]
- [Whether LotEditSheet was touched (should NOT have been — out of scope)]

**Constraints honored:**
- No DB schema changes.
- `supply_lots.quantity_unit` stays free-text string.
- TypeScript strict; no `any`.
- AddNeedSheet / EditNeedSheet untouched.

**Verification:** `npx tsc --noEmit -p .` filtered to touched files = zero errors.

**Read-through verification:**
- ✅ UnitPicker accepts `ingredientId: string | null`; null path routes to all-units mode without loading common units.
- ✅ "Other units…" button suppressed when ingredientId is null.
- ✅ Header text correctly conditional on null/non-null ingredientId.
- ✅ LotInputRowView's quantity_unit field renders UnitPicker, passes through ingredientId.
- ✅ SupplyCreateSheet seeds defaults at row creation; ingredient.typical_unit takes precedence; fallback for custom-name.
- ✅ AddNeedSheet / EditNeedSheet unchanged (verified via grep).

**Maps to:** Closes SF-1 in CP6e_SMOKE_FINDINGS_2026-05-14.md. P8R-D27 (escalated 🟢 → 🟡) partial-close — lot-entry scope ✅; AddNeedSheet/EditNeedSheet custom-name scope still open as follow-up.

**Surprises / Notes for Claude.ai:**
[anything worth flagging, e.g. SupplyCreateSheet internals that surprised you]
```

---

End of prompt.
