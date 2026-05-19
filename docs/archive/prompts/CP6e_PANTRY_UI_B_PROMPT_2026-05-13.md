# CC Prompt — CP6e-PantryUI-b · SupplyDetail rebuild + LotEditSheet + search-within-lots

**Date:** 2026-05-13
**Author:** Claude.ai planning instance
**Type:** UI component build — second of three CP6e-PantryUI sub-prompts
**Estimated effort:** ~1 CC session, ~600-900 lines net
**Depends on:** CP6e-PantryUI-a SHIPPED (LotBadge, LotsList, LotRow, unitIcons all exist).

---

## Context

CP6e-PantryUI-a is complete. SupplyRow renders lot-aware badges; expand panel shows a lots collapser; lot rows are display-only.

This is the SECOND of three CP6e-PantryUI sub-prompts:
- **-a (shipped):** SupplyRow lot-aware badge + lots inline expansion + variant sub-headers
- **-b (this prompt):** SupplyDetail rebuild + LotEditSheet + "+ Add lot" affordance + Q43 tracks_lots toggle + search-within-lots (Q51)
- **-c (later):** SupplyCreateSheet tracks_lots toggle + first-lot inline inputs + Pantry overview mixed rendering

**Authoritative spec:** `docs/phase_8r_lots_wireframes_v2.html` (Tabs 5, 6, 7, 8 cover this prompt).

**No service-layer changes in -b.** All data flows through existing service APIs.

**No SupplyCreateSheet changes in -b.** That's -c.

---

## Inputs to read

1. **`docs/phase_8r_lots_wireframes_v2.html`** — Tabs 5, 6, 7, 8 are the spec. Tab 5 = SupplyDetail with lots section + tracks_lots toggle + Add lot button. Tab 6 = lot edit modal (full field set). Tab 7 = search-within-lots input + filtered results. Tab 8 = expiration urgency styling in lot list (already covered in -a but referenced for consistency).

2. **`docs/PHASE_8R_UNIFIED_NEEDS.md`** (v0.6) — relevant decisions:
   - D8R-Q43 (tracks_lots opt-in flag)
   - D8R-Q46 (lot fields)
   - D8R-Q47 (storage move recomputes expiration unless overridden)
   - D8R-Q48 (lot consume → archive)
   - D8R-Q51 (search-within-lots at 4+ lots)
   - D8R-Q56 (search dimensions)
   - D8R-Q58 (storage synonym map)
   - D8R-Q60 (tracks_lots toggle hidden when lots exist)

3. **`screens/SupplyDetailScreen.tsx`** — full file. ~1169 lines. The screen you'll modify. Read end-to-end. Key existing structure:
   - Line ~416: `<UsageLevelSlider />` — the 5-circle slider for non-lots supplies
   - Line ~485-529: "Tracking mode" section (restock vs track_only radio)
   - Line ~531-560: "Storage location" section (segmented fridge/freezer/pantry/counter)
   - Multiple other sections below (priority, notes, brands, tags, etc.)

4. **`lib/services/lotsService.ts`** — confirm these functions exist (from -a):
   - `createLot(params: CreateLotParams)`
   - `updateLot(lotId, params: UpdateLotParams)`
   - `archiveLot(lotId)`
   - `getLotsForSupply(supplyId, opts)`
   - `getLotAggregate(lots)`
   - `moveLotStorage(lotId, newStorage)`

5. **`lib/services/suppliesService.ts`** — confirm `setSupplyTracksLots(supplyId, value, initialLot?)` exists.

6. **`components/pantry/LotsList.tsx`** — read the -a build. You'll extend it (Task 6) to support the optional `onLotTap` prop and the search filter prop.

7. **`components/pantry/LotRow.tsx`** — read the -a build. You'll connect its `onTap` to the LotEditSheet.

8. **Existing edit sheets to model after:**
   - `components/EditNeedSheet.tsx` — closest pattern. Modal sheet with form fields + save + cancel. Mirror its layout conventions, save-button styling, validation feedback, busy-state handling.
   - `components/SupplyCreateSheet.tsx` — also relevant. Same modal conventions; you'll mirror but not modify.

9. **`lib/types/supplies.ts`** — confirm shapes for `SupplyLot`, `CreateLotParams`, `UpdateLotParams`. Add additional types in `lib/types/supplies.ts` only if necessary (e.g., a discriminated union for the modal's create-vs-edit mode if it helps clarity).

10. **Existing date picker / segmented-control patterns** — find via grep on `DateTimePicker` or `react-native-date` and existing segmented-control implementations (probably custom). Match these.

---

## Tasks — execute in order

### Task 1 — Create `components/pantry/LotEditSheet.tsx`

New modal/sheet component for both creating and editing a lot. Discriminated by presence of `lot` prop.

```tsx
interface LotEditSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (lot: SupplyLot) => void;  // fires after successful create or update
  onArchived?: (lotId: string) => void;  // fires after mark-consumed
  supply: SupplyWithTags;  // for context: ingredient name, default storage, shelf life lookup
  lot?: SupplyLot;  // undefined → create mode; present → edit mode
}
```

#### Layout per wireframe Tab 6

- **Header:** "Add lot" (create) or "Edit lot" (edit). Close button on right.
- **Subheader:** the supply's display name (small, muted).
- **Fields (in order):**
  1. **Quantity + Unit** — number input + unit dropdown/text. Default unit from `supply.ingredient?.typical_unit` or last lot's unit; if no precedent, leave blank.
  2. **Storage** — segmented control (fridge / freezer / pantry / counter). Defaults to `supply.storage_location ?? 'pantry'`.
  3. **Variant label** — optional text input. Placeholder: "e.g., bone-in skin-on, fresh, frozen". Hidden by default behind a "+ Add variant" disclosure to avoid clutter unless the user wants it.
  4. **Brand** — optional text input.
  5. **Acquired at** — date picker. Defaults to today (create mode) or existing value (edit mode). Time component not needed — date-only.
  6. **Expires at** — date picker with computed default displayed. Show "(auto)" hint when `expires_at_overridden === false`. If user manually changes the date, the hint disappears and override flag will be set on save.
  7. **Notes** — multiline text input. Optional.
- **Actions:**
  - **Cancel** button (closes without save)
  - **Save** button (primary; disabled while saving)
  - **Mark consumed** (edit mode only; destructive style; placed at bottom with separator). Triggers archive → calls `onArchived` → closes.

#### Implementation notes

- **Computed expiration on create:** when `lot` is undefined, compute initial `expires_at` from `acquired_at + shelf_life_days_<storage>` (look up via `supply.ingredient`). If no shelf life data, leave expires_at empty; user can set manually.
- **Storage change recompute:** while open in edit mode, if user changes storage AND `expires_at_overridden === false`, locally recompute the displayed expires_at from the new storage's shelf life. The server-side recompute happens on save via `lotsService.moveLotStorage` or via the regular `updateLot` path (whichever applies — see Task 1.5 below).
- **Override detection:** track a local boolean `expiresAtTouched` that flips true when the user manually changes the date picker. On save, pass `expires_at` in `UpdateLotParams` only if touched (this signals to lotsService that the user set it; updateLot's internal logic sets `expires_at_overridden = true`).
- **Validation:**
  - Quantity must be > 0 to save.
  - Quantity unit must be non-empty.
  - Storage required (default ensures it).
  - Block save until validation passes; show inline validation hints (red text below the field) for invalid input.
- **Busy state:** disable Save while async call in flight. Show spinner inside the button.
- **Error handling:** wrap save calls in try/catch; on error, show toast or inline error message but keep modal open so user can retry.

#### Save path

- **Create mode** (`lot === undefined`):
  - Call `createLot({ supply_id: supply.id, quantity, quantity_unit, storage_location, acquired_at, expires_at: <if touched>, variant_label: <if provided>, brand: <if provided>, notes: <if provided> })`.
  - On success: call `onSaved(newLot)`, close modal.

- **Edit mode** (`lot !== undefined`):
  - Detect if storage changed. If yes AND override is false, call `moveLotStorage(lot.id, newStorage)` (which handles the recompute). Then call `updateLot` for any OTHER changed fields.
  - If storage didn't change OR override is true, call `updateLot(lot.id, { quantity, quantity_unit, variant_label, brand, acquired_at, expires_at: <if touched>, notes })` with the changed fields.
  - On success: call `onSaved(updatedLot)`, close modal.

- **Mark consumed** (edit mode only):
  - Confirm dialog: "Mark this lot as consumed? It will be removed from your active lots."
  - On confirm: call `archiveLot(lot.id)`. Call `onArchived(lot.id)`. Close modal.

#### Edge cases

- **Date in the past for expires_at** — allow it. User may be entering historical data; don't block.
- **Quantity = 0 on save in edit mode** — should that trigger consume? No — explicit "Mark consumed" affordance is the path. Block save with validation hint "Quantity must be greater than 0 (use 'Mark consumed' to archive)."
- **No ingredient on the supply** — no shelf life data to compute default. Show "(set manually)" hint instead of "(auto)" and leave expires_at empty until user picks.

### Task 1.5 — Helper: detect what changed

In LotEditSheet, before save, compute the set of changed fields by comparing initial state to current state. Use this to drive (a) which lotsService function to call and (b) the `UpdateLotParams` keys to send. Don't send fields that didn't change.

This isn't a separate file — just a helper inside LotEditSheet.

### Task 2 — Modify `SupplyDetailScreen.tsx` — replace UsageLevelSlider section for tracks_lots supplies

Find the section with `<UsageLevelSlider />` (around line 416). The current visual is the 5-circle slider that lets user pick usage_level 1-5, which drives status indirectly.

For **non-tracks_lots supplies**: keep the UsageLevelSlider exactly as-is. No changes.

For **tracks_lots supplies**: replace with a new Lots section:

```tsx
{supply.tracks_lots ? (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Lots</Text>
    {lots.length === 0 ? (
      <Text style={styles.fieldHint}>No active lots. Add one to get started.</Text>
    ) : (
      <LotsList
        lots={lots}
        onLotTap={handleOpenLotEdit}
      />
    )}
    <TouchableOpacity
      style={styles.addLotButton}
      onPress={handleOpenCreateLot}
      disabled={busy}
    >
      <Text style={styles.addLotButtonText}>+ Add lot</Text>
    </TouchableOpacity>
  </View>
) : (
  <UsageLevelSlider {/* existing props */} />
)}
```

State to add to SupplyDetailScreen:
- `lots: SupplyLot[]` — fetched on mount and refreshed after lot create/update/archive.
- `lotEditState: { visible: boolean; lot?: SupplyLot }` — drives the LotEditSheet open/close + create-vs-edit mode.

Handlers:
- `handleOpenLotEdit(lot: SupplyLot)` — sets `lotEditState = { visible: true, lot }`.
- `handleOpenCreateLot()` — sets `lotEditState = { visible: true, lot: undefined }`.
- `handleCloseLotEdit()` — sets `lotEditState = { visible: false, lot: undefined }`.
- `handleLotSaved(savedLot)` — refreshes `lots` from `getLotsForSupply(supply.id)`. Refreshes the supply itself (status may have auto-flipped via Q44/Q45).
- `handleLotArchived(lotId)` — refreshes lots + supply.

Fetch lots on mount + after every save/archive:
```tsx
const refreshLots = async () => {
  const fresh = await getLotsForSupply(supply.id);
  setLots(fresh);
};
```

### Task 3 — Add tracks_lots toggle inside Tracking section (B1 + D8R-Q43 + D8R-Q60)

In the existing Tracking mode section (line ~485-529), add a secondary toggle BELOW the existing restock/track_only radio:

```tsx
{/* Below the existing radio group */}
{!supply.tracks_lots && (
  <View style={styles.subToggleRow}>
    <Text style={styles.subToggleLabel}>Track quantity / individual lots</Text>
    <Switch
      value={supply.tracks_lots}
      onValueChange={handleEnableLotTracking}
      disabled={busy}
    />
    <Text style={styles.fieldHint}>
      Track each pack, bottle, or batch separately with quantities and expiration dates.
    </Text>
  </View>
)}
{supply.tracks_lots && lots.length === 0 && (
  <View style={styles.subToggleRow}>
    <Text style={styles.subToggleLabel}>Track quantity / individual lots</Text>
    <Switch
      value={supply.tracks_lots}
      onValueChange={handleDisableLotTracking}
      disabled={busy}
    />
  </View>
)}
{/* Q60: when tracks_lots is on AND lots exist, the toggle is HIDDEN.
    User must archive all lots first via the Lots section. */}
```

Handlers:

```tsx
const handleEnableLotTracking = async () => {
  try {
    await setSupplyTracksLots(supply.id, true);
    await refreshSupply();
    await refreshLots();
    // Optionally: open LotEditSheet in create mode to seed the first lot
    handleOpenCreateLot();
  } catch (error) {
    console.error('❌ Enable lot tracking error:', error);
    Alert.alert('Error', 'Could not enable lot tracking. Try again.');
  }
};

const handleDisableLotTracking = async () => {
  // Only reachable when supply.tracks_lots === true AND lots.length === 0
  try {
    await setSupplyTracksLots(supply.id, false);
    await refreshSupply();
  } catch (error) {
    console.error('❌ Disable lot tracking error:', error);
    Alert.alert('Error', 'Could not disable lot tracking. Try again.');
  }
};
```

**Q60 rendering rule:** when `supply.tracks_lots === true && lots.length > 0`, the toggle is hidden entirely. The user has no UI affordance to disable lot tracking while lots exist. To disable, they must first archive all lots (via LotEditSheet's "Mark consumed" on each, or via a future "Archive all" affordance which is post-F&F).

Add an info hint when the toggle is hidden:
```tsx
{supply.tracks_lots && lots.length > 0 && (
  <Text style={styles.fieldHint}>
    Lot tracking is active. To disable, archive all lots first.
  </Text>
)}
```

### Task 4 — Wire LotEditSheet into SupplyDetailScreen

Mount the LotEditSheet at the end of the render tree:

```tsx
<LotEditSheet
  visible={lotEditState.visible}
  onClose={handleCloseLotEdit}
  onSaved={handleLotSaved}
  onArchived={handleLotArchived}
  supply={supply}
  lot={lotEditState.lot}
/>
```

After a lot is saved or archived, refresh both lots and supply state (since Q44/Q45 may have auto-flipped supply.status).

### Task 5 — Search-within-lots (D8R-Q51)

Extend `LotsList.tsx` (created in -a) to support optional search filtering. Per Q51, the affordance shows ONLY when the lot count is ≥4. Below that, the search input doesn't render (scanning the list is fast enough).

Modify the LotsList signature:

```tsx
interface LotsListProps {
  lots: SupplyLot[];
  onLotTap?: (lot: SupplyLot) => void;
}
```

(No new prop needed — the search input is internal to LotsList. Threshold is computed from the lots count.)

Inside LotsList:

```tsx
const [searchQuery, setSearchQuery] = useState('');
const showSearchInput = lots.length >= 4;

const filteredLots = useMemo(() => {
  if (!searchQuery.trim()) return lots;
  return filterLotsBySearch(lots, searchQuery);
}, [lots, searchQuery]);
```

Render the search input at the top of the list when `showSearchInput === true`:

```tsx
{showSearchInput && (
  <View style={styles.searchInputRow}>
    <TextInput
      style={styles.searchInput}
      placeholder="Filter lots by storage, variant, brand, notes…"
      value={searchQuery}
      onChangeText={setSearchQuery}
      autoCorrect={false}
      autoCapitalize="none"
    />
    {searchQuery.length > 0 && (
      <TouchableOpacity onPress={() => setSearchQuery('')}>
        <Text style={styles.clearSearch}>✕</Text>
      </TouchableOpacity>
    )}
  </View>
)}
```

Then render the variant grouping logic over `filteredLots` instead of `lots`. The variant grouping recomputes from the filtered set — so an empty filter result shows "No matching lots" while a partial result shows only the matching variant groups.

#### `filterLotsBySearch` helper (place in `lib/utils/lotSearch.ts` — new file)

```ts
/**
 * Client-side multi-token AND match across lot search dimensions:
 *  - variant_label
 *  - brand
 *  - notes
 *  - storage_location (with synonym expansion: 'frozen' → 'freezer', etc.)
 *
 * Tokens AND across; each token must match at least one dimension.
 * Case-insensitive substring match.
 */
export function filterLotsBySearch(lots: SupplyLot[], query: string): SupplyLot[]
```

Storage synonym map (mirror the server-side `expand_storage_synonyms` from CP6e-Schema):
- `frozen | freezer` ↔ `freezer`
- `fridge | refrigerated | cold` ↔ `fridge`
- `shelf | cupboard | pantry` ↔ `pantry`
- `room temp | counter` ↔ `counter`

Implementation:

```ts
const STORAGE_SYNONYMS: Record<string, string[]> = {
  frozen: ['frozen', 'freezer'],
  freezer: ['freezer', 'frozen'],
  fridge: ['fridge', 'refrigerated', 'cold'],
  refrigerated: ['refrigerated', 'fridge', 'cold'],
  cold: ['cold', 'fridge', 'refrigerated'],
  shelf: ['shelf', 'pantry', 'cupboard'],
  cupboard: ['cupboard', 'pantry', 'shelf'],
  pantry: ['pantry', 'shelf', 'cupboard'],
  counter: ['counter', 'room', 'temp'],
};

function expandToken(token: string): string[] {
  return STORAGE_SYNONYMS[token.toLowerCase()] ?? [token.toLowerCase()];
}

export function filterLotsBySearch(lots: SupplyLot[], query: string): SupplyLot[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return lots;

  return lots.filter((lot) => {
    return tokens.every((token) => {
      const expanded = expandToken(token);
      const dimensions = [
        lot.variant_label ?? '',
        lot.brand ?? '',
        lot.notes ?? '',
        lot.storage_location,
      ].map((d) => d.toLowerCase());

      // Each expanded synonym is a candidate match; token passes if ANY synonym
      // matches ANY dimension via substring.
      return expanded.some((syn) =>
        dimensions.some((dim) => dim.includes(syn))
      );
    });
  });
}
```

### Task 6 — Modify LotsList to support tap and search

Update `LotsList.tsx`:
- Wire the search input as in Task 5.
- Pass `onLotTap` through to each `LotRow`.
- Empty-state copy: when `filteredLots.length === 0 && searchQuery.length > 0`, render "No lots match." Otherwise (no lots at all), render nothing (parent handles empty state in SupplyDetail).

### Task 7 — Modify `LotRow.tsx` to wire tap

Already accepts `onTap` prop from -a but it was effectively undefined. Now connect it to TouchableOpacity:

```tsx
<TouchableOpacity
  onPress={onTap ? () => onTap() : undefined}
  activeOpacity={onTap ? 0.6 : 1}
  // ... other props
>
  {/* existing lot row content */}
</TouchableOpacity>
```

If `onTap` is undefined, the row should not visually appear "tappable" — no opacity feedback, no accessibility role of button. Just informational.

---

## Constraints

1. **No service-layer changes.**

2. **No SupplyCreateSheet changes.** That's -c.

3. **Preserve all existing SupplyDetail behavior for non-lots supplies.** Non-tracks_lots supplies should see the same UsageLevelSlider, same Tracking mode UI (minus the new lots toggle, which only shows when tracks_lots is on OR when offering to enable), same everything.

4. **Match the wireframe** — Tabs 5, 6, 7, 8.

5. **TypeScript strict.** No `any`.

6. **No tests.**

7. **Accessibility:** every interactive element gets `accessibilityRole` + `accessibilityLabel`. Date picker accessibility is handled by the system component; spelling-it-out labels for switches and toggles is enough.

8. **Performance:** LotsList variant grouping runs over `filteredLots`; both `filteredLots` and the variant groups must be memoized (`useMemo`) keyed on `lots` + `searchQuery` references.

9. **Form state in LotEditSheet uses local React state only.** No global state, no context. Closes cleanly between opens; create-mode and edit-mode never bleed state between each other (key the modal by `lot?.id ?? 'create'` if helpful).

10. **Date picker conventions:** use whatever date picker is already in the project (probably `@react-native-community/datetimepicker` or similar). If none exists, use a simple modal date picker pattern — don't add a new library without flagging.

---

## What this prompt does NOT do

- SupplyCreateSheet tracks_lots toggle (-c)
- Pantry overview mixed rendering (-c — mostly inherits)
- Auto-restock toast (CP6e-FlowsUI)
- Cook depletion lot picker (CP6e-FlowsUI)
- Receipt scan (P8R-D22, post-F&F)
- Tests

---

## SESSION_LOG entry format

```
## 2026-05-13 — CP6e-PantryUI-b · SupplyDetail rebuild + LotEditSheet + search-within-lots

**Type:** UI build. Second of 3 CP6e-PantryUI sub-prompts.

**Files modified:**
- screens/SupplyDetailScreen.tsx — substantial. Replaces UsageLevelSlider with Lots section for tracks_lots supplies. Adds tracks_lots toggle inside Tracking section (Q43 + Q60). Wires LotEditSheet. N lines added.
- components/pantry/LotsList.tsx — extended with optional search-within-lots input (Q51 at ≥4 lots) + onLotTap wiring through to LotRow.
- components/pantry/LotRow.tsx — tap wiring now functional via onTap prop.

**Files created:**
- components/pantry/LotEditSheet.tsx (NEW) — modal sheet for create + edit, with Mark consumed (D8R-Q48), expires_at override detection (D8R-Q47), storage-recompute hint, validation.
- lib/utils/lotSearch.ts (NEW) — filterLotsBySearch helper with storage synonym expansion (mirrors D8R-Q58 server-side).

**Q-rule wiring:**
- D8R-Q43 (tracks_lots toggle) — handleEnableLotTracking calls setSupplyTracksLots(id, true)
- D8R-Q47 (storage move recomputes expiration) — LotEditSheet's edit mode calls moveLotStorage when storage changes and override is false
- D8R-Q48 (lot consume → archive) — LotEditSheet's "Mark consumed" calls archiveLot
- D8R-Q51 (search-within-lots at 4+ lots) — LotsList shows search input when lots.length >= 4
- D8R-Q56 (search dimensions) — lotSearch filters across variant_label/brand/notes/storage_location
- D8R-Q58 (storage synonyms) — STORAGE_SYNONYMS map in lotSearch mirrors server-side expand_storage_synonyms
- D8R-Q60 (toggle hidden when lots exist) — toggle render conditional on lots.length === 0

**Decisions during build:**
- [list anything CC needs to decide on the fly]

**Verification:** npx tsc --noEmit filtered to touched files = zero errors.

**Followups noted in code as TODO:**
- [...]

**Next:** CP6e-PantryUI-c (SupplyCreateSheet tracks_lots toggle + Pantry overview).
```

---

## If anything blocks

- **Date picker library missing or non-obvious.** Stop and ask. Don't add a new library without confirming.
- **`setSupplyTracksLots` has different signature than expected.** Read suppliesService; adapt.
- **`moveLotStorage` doesn't exist in lotsService despite -a claim.** Stop and report; fall back to plain `updateLot` if absolutely necessary.
- **Existing SupplyDetail has unexpected state interactions (animations, scroll position, derived state) that complicate the lot section swap.** Preserve existing behavior; if a real conflict surfaces, stop and report.
- **Existing UsageLevelSlider has imperative methods or refs that consumers depend on.** Preserve unchanged for non-tracks_lots; the lot section is an entirely separate render path.
- **`getLotsForSupply` returns different shape than expected.** Read lotsService; adapt.

Don't invent rendering rules. Wireframe is the spec.
