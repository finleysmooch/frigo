# CC Prompt — CP6e-PantryUI-c · SupplyCreateSheet tracks_lots + first-lot inline inputs + Pantry overview verification

**Date:** 2026-05-13
**Author:** Claude.ai planning instance
**Type:** UI component build — third and final CP6e-PantryUI sub-prompt
**Estimated effort:** ~0.5-1 CC session, ~300-450 lines net
**Depends on:** CP6e-PantryUI-a + -b SHIPPED. LotBadge, LotsList, LotRow, LotEditSheet, lotSearch, unitIcons all exist.

---

## Context

CP6e-PantryUI-a and -b are complete. SupplyRow renders lot-aware badges in the Pantry overview; SupplyDetail rebuilds with Lots section + LotEditSheet for create/edit/archive; search-within-lots works.

This is the THIRD and FINAL CP6e-PantryUI sub-prompt:
- **-a (shipped):** SupplyRow lot-aware badge + lots inline expansion + variant sub-headers
- **-b (shipped):** SupplyDetail rebuild + LotEditSheet + search-within-lots
- **-c (this prompt):** SupplyCreateSheet tracks_lots toggle + first-lot inline inputs + multi-lot "Add another lot" + Pantry overview verification

After -c lands, CP6e-PantryUI is complete. Next CP is **CP6e-FlowsUI** (CookDepletionBanner lot-aware, grocery acquire toast, lot picker for cook overrides).

**Authoritative spec:** `docs/phase_8r_lots_wireframes_v2.html` (Tabs 9 and 10 cover this prompt — the SupplyCreateSheet variant with the tracks_lots toggle and the multi-lot "+ Add another lot" inputs).

**No service-layer changes in -c.** All data flows through existing service APIs.

**Smoke testing happens at end** of full -a/-b/-c (Tom's already deferred -a's individual smoke; planning batch-smoke now).

---

## Inputs to read

1. **`docs/phase_8r_lots_wireframes_v2.html`** — Tabs 9 and 10. Tab 9 = SupplyCreateSheet with tracks_lots toggle off (default) → on → first-lot fields appear. Tab 10 = multiple lot-input rows after tapping "+ Add another lot".

2. **`docs/PHASE_8R_UNIFIED_NEEDS.md`** (v0.6) — relevant decisions:
   - D8R-Q43 (tracks_lots opt-in flag)
   - D8R-Q46 (lot fields)

3. **`components/SupplyCreateSheet.tsx`** — full file (~792 lines). The component you're modifying. Read end-to-end. Key existing structure:
   - Form state for ingredient, customName, status, brands, notes, tags
   - `handleSubmit` calls `createSupply` then `setSupplyTags` then `onSaved` + `onClose`
   - Existing tracking_mode and storage_location selectors are NOT yet in this file (CP6d added them to SupplyDetail but not CreateSheet — verify this is still the case by reading; if they ARE here, integrate the new toggle nearby).

4. **`components/pantry/LotEditSheet.tsx`** — the modal from -b. **Don't modify**, but study the form patterns for inline lot inputs (qty + unit + storage + variant + brand + acquired_at + expires_at + notes). The -c first-lot inputs are a slimmer inline variant of these.

5. **`lib/services/suppliesService.ts`** — confirm `setSupplyTracksLots(supplyId, value, initialLot?)` exists from -a. You can call it post-createSupply to flip tracks_lots on without requiring a service change to createSupply.

6. **`lib/services/lotsService.ts`** — confirm `createLot(params: CreateLotParams)` exists. You'll call it for each lot input row on save.

7. **`screens/PantryScreen.tsx`** + **`components/pantry/SuppliesSection.tsx`** — quick read. Verify if any further changes are needed for "mixed lot/non-lot rendering" beyond what -a already wired (Task 4 below).

8. **`components/EditNeedSheet.tsx`** or similar — match the inline-list-of-rows pattern (each row has its own field cluster with a remove "X" button). If no existing inline-list-of-rows pattern in the codebase, design simply: a `<View>` per row containing a `<View>` of fields + a remove button on the right.

---

## Tasks — execute in order

### Task 1 — Add tracks_lots toggle to SupplyCreateSheet

In the form area (likely above or below the existing brands/notes section — keep proximity to the existing tracking-mode field if it exists in this file, else near the tags section), add:

```tsx
<View style={styles.section}>
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>Track quantity / individual lots</Text>
    <Switch
      value={tracksLots}
      onValueChange={handleToggleTracksLots}
      disabled={submitting}
    />
  </View>
  <Text style={styles.fieldHint}>
    Track each pack, bottle, or batch separately with quantities and expiration dates.
  </Text>
</View>
```

State to add to SupplyCreateSheet:
```tsx
const [tracksLots, setTracksLots] = useState(false);
const [lotInputs, setLotInputs] = useState<LotInputRow[]>([emptyLotInputRow()]);
```

Where `LotInputRow` is a local interface:

```tsx
interface LotInputRow {
  id: string;  // local-only, for React key + remove targeting (use crypto.randomUUID() or similar)
  quantity: string;  // store as string for input control; parse on save
  quantity_unit: string;
  storage_location: 'fridge' | 'freezer' | 'pantry' | 'counter';
  variant_label: string;  // empty string = not set
  brand: string;
  acquired_at: Date;
  expires_at: Date | null;  // null = use computed default at save time
  expires_at_touched: boolean;
  notes: string;
}

function emptyLotInputRow(): LotInputRow {
  return {
    id: crypto.randomUUID(),
    quantity: '',
    quantity_unit: '',
    storage_location: 'pantry',  // default per Resolution A convention
    variant_label: '',
    brand: '',
    acquired_at: new Date(),
    expires_at: null,
    expires_at_touched: false,
    notes: '',
  };
}
```

#### Toggle handler

```tsx
const handleToggleTracksLots = (value: boolean) => {
  setTracksLots(value);
  if (!value) {
    // C3: discard lot inputs on toggle-off without confirm
    setLotInputs([emptyLotInputRow()]);
  }
};
```

### Task 2 — Render first-lot inline inputs when tracksLots is on

Below the toggle, when `tracksLots === true`, render the list of lot input rows:

```tsx
{tracksLots && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Lots to add</Text>
    {lotInputs.map((row, index) => (
      <LotInputRowView
        key={row.id}
        row={row}
        index={index}
        canRemove={lotInputs.length > 1}
        ingredient={selectedIngredient}  // for shelf_life lookup
        onChange={(updated) => updateLotInputRow(row.id, updated)}
        onRemove={() => removeLotInputRow(row.id)}
      />
    ))}
    <TouchableOpacity
      style={styles.addAnotherLotButton}
      onPress={handleAddAnotherLot}
      disabled={submitting}
    >
      <Text style={styles.addAnotherLotButtonText}>+ Add another lot</Text>
    </TouchableOpacity>
  </View>
)}
```

#### Handlers

```tsx
const updateLotInputRow = (id: string, updated: Partial<LotInputRow>) => {
  setLotInputs((prev) =>
    prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
  );
};

const removeLotInputRow = (id: string) => {
  setLotInputs((prev) => prev.filter((r) => r.id !== id));
};

const handleAddAnotherLot = () => {
  setLotInputs((prev) => {
    // C5: inherit defaults from the LAST row's current values
    // so user can quickly add similar-but-not-identical lots
    const last = prev[prev.length - 1];
    const newRow: LotInputRow = {
      id: crypto.randomUUID(),
      quantity: '',                            // always blank
      quantity_unit: last.quantity_unit,       // inherit unit
      storage_location: last.storage_location, // inherit storage
      variant_label: '',                        // always blank
      brand: last.brand,                        // inherit brand (often same pack)
      acquired_at: new Date(),                  // today
      expires_at: null,                         // recompute
      expires_at_touched: false,
      notes: '',
    };
    return [...prev, newRow];
  });
};
```

### Task 3 — Create `LotInputRowView` component (inline in SupplyCreateSheet, or separate file — your call)

Per wireframe Tab 10, each row is a compact horizontal/vertical input cluster:

```tsx
interface LotInputRowViewProps {
  row: LotInputRow;
  index: number;
  canRemove: boolean;
  ingredient: Ingredient | null;
  onChange: (updated: Partial<LotInputRow>) => void;
  onRemove: () => void;
}
```

Layout:
- **Header line:** "Lot {index + 1}" on left; "✕ Remove" button on right (disabled when `canRemove === false`)
- **Quantity + Unit row:** number input ("1.25") + unit input ("lb") — compact, side-by-side
- **Storage:** segmented control (fridge / freezer / pantry / counter), smaller than the modal version
- **Variant + Brand:** optional inline inputs in a row (or behind a disclosure for cleanliness — your call based on what fits the wireframe)
- **Acquired at + Expires at:** date pickers, compact
- **Notes:** single-line text input (multiline overkill for inline form)

Logic notes:
- **Computed expiration:** when storage or acquired_at changes AND `expires_at_touched === false`, recompute and display the new expires_at. Pure UI computation — use `ingredient.shelf_life_days_<storage>` if available; else show "—".
- **Override detection:** if user manually changes expires_at, set `expires_at_touched = true`. From that point, storage changes no longer recompute the displayed value.
- **Inline validation:** quantity > 0 required (other fields have defaults/can be empty). Show red text below quantity input if 0 or invalid.

Decision: design this component to be **simpler than LotEditSheet's form**. The full edit experience (notes, brand, variant) lives in the modal. The inline-create form should be focused on the must-haves: qty, unit, storage. Other fields (variant, brand, notes) should be available but visually de-emphasized — disclosure-toggled or compact secondary inputs.

If LotInputRowView grows past ~200 lines, split into its own file at `components/pantry/LotInputRowView.tsx`. Otherwise inline is fine.

### Task 4 — Modify the save path

The existing `handleSubmit`:

```tsx
const newSupply = await createSupply({...});
const tagIds = await collectAllSelectedTagIds();
if (tagIds.length > 0) {
  await setSupplyTags(newSupply.id, tagIds);
}
onSaved();
onClose();
```

Extend to handle tracks_lots + lot inputs:

```tsx
const newSupply = await createSupply({
  spaceId,
  ingredientId,
  customName,
  status: initialStatus,
  forUserIds: [],
  brands: brandsArr,
  addedBy: userId,
  notes: notes.trim() || undefined,
  // tracks_lots NOT in createSupply params — set via separate call below
});

const tagIds = await collectAllSelectedTagIds();
if (tagIds.length > 0) {
  await setSupplyTags(newSupply.id, tagIds);
}

// NEW: handle tracks_lots flip + initial lots
if (tracksLots) {
  try {
    // Flip tracks_lots ON. Pass undefined for initialLot — we'll create lots manually below.
    await setSupplyTracksLots(newSupply.id, true);
  } catch (error) {
    console.error('❌ SupplyCreateSheet tracks_lots flip error:', error);
    // Continue anyway — the supply was created; user can enable from SupplyDetail.
  }

  // Validate lot inputs before sending
  const validLotInputs = lotInputs.filter((row) => {
    const qty = parseFloat(row.quantity);
    return !isNaN(qty) && qty > 0 && row.quantity_unit.trim().length > 0;
  });

  if (validLotInputs.length === 0) {
    Alert.alert(
      'Lots',
      'Supply created, but no valid lots were entered. Add lots from the supply detail screen.'
    );
    onSaved();
    onClose();
    return;
  }

  // Create lots sequentially; track partial-success
  let successCount = 0;
  const failedRows: number[] = [];

  for (let i = 0; i < validLotInputs.length; i++) {
    const row = validLotInputs[i];
    try {
      await createLot({
        supply_id: newSupply.id,
        quantity: parseFloat(row.quantity),
        quantity_unit: row.quantity_unit.trim(),
        storage_location: row.storage_location,
        acquired_at: row.acquired_at.toISOString(),
        expires_at: row.expires_at_touched && row.expires_at
          ? row.expires_at.toISOString()
          : undefined,  // undefined = let lotsService compute default
        variant_label: row.variant_label.trim() || undefined,
        brand: row.brand.trim() || undefined,
        notes: row.notes.trim() || undefined,
      });
      successCount++;
    } catch (error) {
      console.error(`❌ SupplyCreateSheet lot ${i + 1} create error:`, error);
      failedRows.push(i + 1);
    }
  }

  // C2: partial success messaging
  if (failedRows.length > 0) {
    Alert.alert(
      'Some lots not created',
      `${successCount} of ${validLotInputs.length} lots created successfully. ` +
      `Add the missing lots from the supply detail screen.`
    );
  }
}

onSaved();
onClose();
```

Note: `createSupply` is called WITHOUT `tracks_lots`. The flip happens via `setSupplyTracksLots(id, true)` afterwards. This is intentional — avoids changing the createSupply service signature in -c (no service-layer changes allowed). One extra round-trip is acceptable for a create flow.

### Task 5 — Pantry overview rendering verification (C4)

Per the doc addition, "Mixed lot/non-lot rows side by side. Aggregate meta line on lot rows. Lot count cap on row." Most of this is already handled by -a's SupplyRow changes.

**Verify:**
1. `screens/PantryScreen.tsx` calls `getSuppliesForSpace(spaceId, { includeLots: true })` — should be in place from -a.
2. `components/pantry/SuppliesSection.tsx` doesn't filter or differentiate based on tracks_lots — should render all supplies uniformly.
3. Each SupplyRow self-decides its badge type via the `supply.tracks_lots` branch from -a.

**If all three are in place, Task 5 is a no-op.** Just confirm in SESSION_LOG that mixed rendering works without further changes.

**If something is missing** (e.g., PantryScreen still doesn't pass includeLots: true, or SuppliesSection has a filter that excludes tracks_lots supplies), patch the minimum to fix. Don't refactor.

### Task 6 — Quick visual sanity in SupplyCreateSheet

After everything wires together, open SupplyCreateSheet in your mental model:
- Default state: tracks_lots off, looks like the existing CreateSheet (zero behavioral change for non-lots users).
- Toggle tracks_lots on → first lot input row appears with sensible defaults.
- Tap "+ Add another lot" → second row appears, inherits unit/storage/brand from first row.
- Fill in some rows, leave one empty (qty=0 or unit blank) → save → partial success path filters out invalid rows.
- All rows invalid → save → supply created without lots; user is told to add lots from detail screen.
- All rows valid → save → supply created + all lots created.

If any of those flows feel awkward (e.g., toggle-off accidentally erases a lot of typing), revisit C3 — but only do so via Claude.ai discussion, not a unilateral C3-reversal.

---

## Constraints

1. **No service-layer changes.** Use existing `createSupply`, `setSupplyTracksLots`, `createLot` as composed building blocks.

2. **No SupplyDetail or SupplyRow changes.** Those are -a/-b territory.

3. **No new types in `lib/types/`.** `LotInputRow` is a local interface inside SupplyCreateSheet — it's a UI-layer-only shape.

4. **No tests.**

5. **Match the wireframe** — Tabs 9 + 10.

6. **TypeScript strict.** No `any`.

7. **Accessibility:** every TouchableOpacity has `accessibilityRole` + `accessibilityLabel`. The Remove "✕" button label should include the lot index ("Remove lot 2").

8. **Performance:** the lot inputs list is local React state. No memoization needed at this scale (max realistic lot count at create = 8-10; users with more should use SupplyDetail's add-lot flow).

9. **Behavior parity for non-lots flow.** Users who leave the tracks_lots toggle OFF should see SupplyCreateSheet behave exactly as before -c. Zero regression risk on the 80% non-lots path.

10. **`crypto.randomUUID()` availability.** If not available in the React Native environment, fall back to a simple counter or `Date.now() + Math.random()` for the local row id. The id is React-key + remove targeting only; doesn't need to be a real UUID.

---

## What this prompt does NOT do

- SupplyDetail or SupplyRow changes (-a/-b)
- Service-layer changes
- Tests
- Cook depletion lot picker (CP6e-FlowsUI)
- Grocery acquire toast (CP6e-FlowsUI)
- Receipt scan (P8R-D22, post-F&F)

---

## SESSION_LOG entry format

```
## 2026-05-13 — CP6e-PantryUI-c · SupplyCreateSheet tracks_lots + first-lot inline inputs + Pantry overview verification

**Type:** UI build. Third and final CP6e-PantryUI sub-prompt.

**Files modified:**
- components/SupplyCreateSheet.tsx — added tracks_lots toggle, lot input rows state, LotInputRowView render, multi-lot save path with partial-success handling. N lines added.

**Files created (if any):**
- components/pantry/LotInputRowView.tsx (NEW, N lines) — IF split out from SupplyCreateSheet; else inline.

**Pantry overview verification (Task 5):**
- [Note whether PantryScreen / SuppliesSection needed any changes; expected: none, if -a wired correctly.]

**Q-rule wiring:**
- D8R-Q43 (tracks_lots) — toggle calls setSupplyTracksLots(id, true) post-create
- D8R-Q46 (lot fields) — full field set per lot input row mirrors LotEditSheet

**Decisions during build:**
- LotInputRowView placement (inline vs separate file)
- "+ Add another lot" inherits unit/storage/brand from last row (C5)
- Toggle-off discards lot inputs without confirm (C3)
- Partial-success save: invalid rows filtered + skipped; valid lots created; failed lot creates surface in alert (C2)
- tracks_lots flip via setSupplyTracksLots post-createSupply (avoids service-layer change)

**Verification:** npx tsc --noEmit filtered to touched files = zero errors.

**Followups noted in code as TODO:**
- [...]

**Next:** Tom batch-smokes the full CP6e-PantryUI -a/-b/-c. Then CP6e-FlowsUI (cook lot picker + grocery acquire toast).
```

---

## If anything blocks

- **`setSupplyTracksLots` has different signature than expected.** Read suppliesService; adapt.
- **`createLot` has different signature than expected.** Read lotsService; adapt.
- **`crypto.randomUUID()` not available.** Fall back per Constraint 10.
- **PantryScreen or SuppliesSection STILL needs an `includeLots: true` change despite -a SESSION_LOG.** Patch minimally; flag for SESSION_LOG entry.
- **Existing SupplyCreateSheet has unexpected state interactions (tag dimensions, ingredient lookup, etc.) that complicate the toggle placement.** Preserve existing behavior; the lot inputs are purely additive — never replace existing fields.
- **Wireframe shows a UI element that's ambiguous (e.g., "+ Add another lot" visual style).** Approximate with a standard button. Note as TODO with screenshot reference for post-F&F polish.

Don't invent rendering rules. Wireframe is the spec. Don't change service layer. Don't touch SupplyDetail or SupplyRow.
