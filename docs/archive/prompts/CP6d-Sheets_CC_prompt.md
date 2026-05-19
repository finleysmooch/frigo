# CC PROMPT — Phase 8R-CP6d-Sheets

**Phase:** 8R-CP6d-Sheets (existing-sheet polish)
**Estimated cost:** S-M. ~150-250 lines net.
**Prerequisite:** None — independent of all other CPs. Can ship anytime.

---

## Context

Per audit doc, three small but important polish items on existing sheet components:

- **G24/G35 — UnitPicker swap.** AddNeedSheet and EditNeedSheet currently use plain `TextInput` for the unit field. This was supposed to ship in CP6a but wasn't. Replace with the existing `UnitPicker` component (drop-in from CP4.5) for controlled vocabulary.
- **G27 — ExpandedRegularsSheet search bar.** Tab 10 wireframe spec'd a search bar at top; never built.
- **G28 — "+ N more in [Category]" expand-in-place.** Sub-category sections in ExpandedRegulars currently render flat. Should collapse by default with expand-on-demand.

Three small tasks, one prompt. Independent.

---

## Inputs to read

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — section "CP6d-Sheets" and gap rows G24, G27, G28, G35.
2. `components/AddNeedSheet.tsx` — find the unit TextInput (~mid-file).
3. `components/EditNeedSheet.tsx` — same target (different consumer of the same pattern).
4. `components/UnitPicker.tsx` — existing component, look at its props shape.
5. `components/ExpandedRegularsSheet.tsx` — full file. Adding search + collapsible sub-categories.

---

## Tasks

### Task 1 — UnitPicker swap in AddNeedSheet (Gap-G24)

Locate the unit field in AddNeedSheet (likely in the configure-form section, after the quantity input). Currently:

```tsx
<TextInput
  style={styles.unitInput}
  value={unit}
  onChangeText={setUnit}
  placeholder="unit (optional)"
  ...
/>
```

Replace with:

```tsx
<UnitPicker
  value={unit}
  onChange={setUnit}
  placeholder="unit (optional)"
  // any other props UnitPicker exposes
/>
```

Verify UnitPicker's API by reading its component file. If it has a different prop signature (e.g., `selectedUnit` / `onSelectUnit`), adapt accordingly.

UnitPicker should provide a controlled vocabulary (cup, tbsp, tsp, oz, lb, g, kg, ml, l, etc.) plus a "custom" affordance for unusual units. If UnitPicker doesn't already include a "no unit" option, ensure empty string remains a valid value (some needs have no unit — e.g., "1 banana").

Adjust styling if UnitPicker needs different layout (e.g., it may render as a button that opens a picker modal, vs the current inline TextInput). Match the existing form section's styling.

### Task 2 — UnitPicker swap in EditNeedSheet (Gap-G35)

Same change as Task 1, applied to EditNeedSheet's unit field.

EditNeedSheet has the additional context that the unit may already be set (editing an existing need). Make sure the picker hydrates correctly with the existing value.

### Task 3 — Search bar in ExpandedRegularsSheet (Gap-G27)

Add a TextInput at the top of the sheet body, ABOVE the section headers. Behavior:

- Placeholder: "Search regulars..."
- As user types: filter the visible supplies in all sections (Out / Low / In stock).
- Matching logic: `displayName.toLowerCase().includes(query.toLowerCase())`. Display name uses the existing logic (`ingredient?.name ?? custom_name`).
- Empty sections hide when filtered.
- Clear button (×) at right of input when query non-empty.

State: simple `useState<string>('')` for query, derive filtered sections in the existing memoized sections logic.

The "+ Add new supply" footer button stays as-is (existing CP6b wiring). Search bar only filters; it doesn't add. (Add path is already covered by SupplyCreateSheet.)

### Task 4 — "+ N more in [Category]" expand-in-place (Gap-G28)

Currently sections (Out / Low / In stock) in ExpandedRegularsSheet render all rows. With many supplies this scrolls long.

Update the In stock section specifically (Out and Low usually small) to:
- Group supplies in In stock by `ingredient.category`.
- Per category sub-section: show first 5 supplies. If more exist, show "+ N more in [Category]" tappable row at bottom of that sub-section.
- Tap "+ N more" → expands inline, showing all rows in that sub-category. No collapse-back affordance needed for F&F (post-F&F polish item).

Sub-category headers within In stock: small caps, muted color, similar to existing section headers but smaller font.

If In stock has fewer than 6 supplies total: don't sub-categorize. Render flat.

For Out and Low sections: leave as flat lists. They're typically small and the user wants to see all of them.

---

## Constraints

- **DO NOT** modify the supplies fetching logic (loadSupplies in ExpandedRegularsSheet stays as-is).
- **DO NOT** modify the multi-select / submit logic in ExpandedRegularsSheet — those already work.
- **DO NOT** change UnitPicker's internal logic — just consume it.
- **DO NOT** affect the supply-tag predicate filtering (supplyMatchesView logic stays untouched).
- **PRESERVE** the pre-select-out behavior on open (Q20).
- **PRESERVE all existing exports.**

---

## Verification

1. **AddNeedSheet unit picker.** Opens correctly. Selecting a unit (e.g., "tbsp") sets the unit field. Saving creates a need with `unit_display: "tbsp"`. Empty/no-unit option still works.
2. **EditNeedSheet unit picker.** Opens with existing unit pre-selected. Changing unit and saving updates the need correctly.
3. **No more free-text units.** Verify in Supabase: new needs from these sheets have units from the controlled vocabulary, not arbitrary strings like "Tbsp" or "tablespoon".
4. **ExpandedRegulars search.** Open sheet, type "olive" — only olive-related supplies remain across sections. Empty sections hidden. Clear button works.
5. **In stock sub-categorization.** With ≥10 in-stock supplies across multiple categories: sub-headers appear (Spices, Dairy, etc.). First 5 per category render; "+ N more in Spices" appears for categories with >5. Tap expands.
6. **Multi-select still works.** Select 3 supplies (mixed across sections) → counter at bottom shows "3 selected". Submit → 3 needs created (or skipped if already on a list).

---

## SESSION_LOG entry format

(Standard template. List the 3 modified files with line counts, deviations if any.)
