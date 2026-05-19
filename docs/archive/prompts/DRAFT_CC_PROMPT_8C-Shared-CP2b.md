# [DRAFT] CC Prompt — 8C-Shared-CP2b: Add-to-list flow on `GroceryListDetailScreen`

> Mini-CP between 8C-Shared-CP2 and CP3. F&F-blocker fix per P8-24. Replaces the placeholder "Add Item" button alert on `GroceryListDetailScreen` with a real bottom-sheet flow: typo-tolerant ingredient autocomplete + custom-item fallback + quantity defaults + add-to-list submit.
>
> Estimated work: ~2 hr (service function + new sheet UI + handler wiring + smoke test).
>
> Surfaced during 8C-Shared-CP2 smoke test: `handleAddItem` in `screens/GroceryListDetailScreen.tsx` (line ~614 currently) is a placeholder showing "Adding items to specific lists coming soon!" alert. Mary's primary mental model post-CP2 is "open the shared Costco list, add bread"; that flow currently dead-ends.
>
> See P8-24 in `docs/DEFERRED_WORK.md` v5.16+ for the deferred-work entry that motivated this CP.

---

## Context

CP2 shipped shared lists end-to-end. Smoke test verified Mary can see/add/check off items from her own modal-driven flow on `GroceryListsScreen` (the global add-ingredient flow). But the per-list `GroceryListDetailScreen` exposes its own "+ Add to List" button that's been a placeholder alert since pre-CP2. CP2b ships the real implementation.

**Three threads of work:**

1. **Schema (Tom applies via Dashboard before CC runs).** Enables `pg_trgm` extension if not already on, creates GIN trigram indexes on `ingredients.name` + `plural_name`, creates `search_ingredients(query_text)` RPC that combines substring (ILIKE) and trigram-similarity matching with score-based ordering. The RPC is the substrate for typo-tolerant autocomplete — without it, "corriander" returns zero results.

2. **Service-layer add.** New `searchIngredientsForAutocomplete(query)` function in `lib/groceryListsService.ts` (or `lib/searchService.ts` if Tom's preference; `groceryListsService.ts` is the simpler home since this is a grocery-flow concern) that wraps the RPC call. The existing `addItemToList` from the same service is reused — already supports the schema we need.

3. **UI: replace placeholder with bottom-sheet add-item flow.** New inline modal in `screens/GroceryListDetailScreen.tsx` matching the existing disambiguation-sheet pattern (already inline at the bottom of that file, with `sheetBackdrop` / `sheetContainer` / `sheetHandle` styles). Search input → autocomplete results → quantity input → submit. Custom-item fallback at the bottom of results when no match.

**Tom's decisions (sign-off captured during CP2b kickoff):**

- **Q1 ✅** UX shape: bottom-sheet inline modal (matches existing pattern in same file).
- **Q2 ✅** Reuse existing picker if found; else build via `pg_trgm` RPC. **Critical: typo-tolerance required** — Tom hit "corriander" → no results during smoke test.
- **Q3 ✅** Custom items supported in v1. "+ Add '<query>' as custom item" fallback at end of empty/no-match results.
- **Q4 ✅** Quantity defaults: `1` + ingredient's `typical_unit`; fallback `'unit'` for custom items per D8C-CP4-8 convention.
- **Q5 ✅** After submit: optimistic UI via `loadItems()` round-trip + sheet close. No "added!" toast.
- **Q6 ✅** CP naming: 8C-Shared-CP2b.
- **Q7 ✅** PK_CODE_SNAPSHOTS: `screens/GroceryListDetailScreen.tsx` not currently in PK tier — no staging needed for that file. Service file IS in PK; staleness flag applies if modified.
- **Q8 ✅** Add Item button location: top of screen, in `actionButtonsRow` (just below progress bar), as `addItemButton` per existing styles. Already wired to `handleAddItem` callback — CP2b just replaces the body.

---

## Inputs to read

**Required:**
1. `phase_8c_shared_cp2b_search_rpc.sql` (Tom places at `docs/` or repo root before handing prompt to CC) — the standalone SQL Tom pasted into Supabase. CC moves it; do not modify.
2. `screens/GroceryListDetailScreen.tsx` — current `handleAddItem` placeholder (currently around line 614, but locate by function name); existing inline modal pattern at bottom of file (the disambiguation modal — `sheetBackdrop`, `sheetContainer`, `sheetHandle`, `sheetItemRow` styles); existing imports + state shape.
3. `lib/groceryListsService.ts` — current `addItemToList` shape; current imports; pattern for adding new functions (matches CP2's `getOtherListsContainingIngredient` style).
4. `lib/types/grocery.ts` — `AddItemToListParams` interface (note: this may be in service file vs canonical — CC checks both); `GroceryListItemWithIngredient` shape (returned by `loadItems()`).
5. `lib/searchService.ts` — review for any reusable patterns; **not** suitable as drop-in for autocomplete (does recipe search, not ingredient autocomplete). New function needed in groceryListsService.
6. `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 — canonical SESSION_LOG format.
7. `docs/PK_CODE_SNAPSHOTS.md` — Rule E check for `lib/groceryListsService.ts` after CP2b ships.

**Reference only (do not modify):**
- `lib/ingredientsParser.ts` — has fuzzy match logic for server-side recipe parsing. Not a fit for live UI autocomplete (works against in-memory ingredient list, not direct DB query). Don't try to reuse.
- `lib/services/spaceService.ts` — `getUserSpaces` pattern for service function shape (reference for new function styling).

---

## Task

Five parts. Do them in order.

### Part 1 — Move the migration file

Tom will have placed `phase_8c_shared_cp2b_search_rpc.sql` at `docs/` (preferred) or repo root (fallback) before handing this prompt to CC.

Search order: try `docs/` first, then repo root. If found in neither, STOP and flag in SESSION_LOG.

Move the file to `supabase/migrations/20260428_phase_8c_shared_cp2b_search_rpc.sql`. (If today's date when CC runs is not 2026-04-28, use actual current date in YYYYMMDD format.)

Per Rule C: if file is untracked, use `mv` + `git add`, NOT `git mv`. Do NOT modify SQL content during the move.

### Part 2 — Service-layer additions in `lib/groceryListsService.ts`

**2a. Add type for autocomplete result.** Append to the existing service-internal types section (or import from `lib/types/grocery.ts` if it makes sense to canonical-ize; service-internal is fine for CP2b since this is autocomplete-specific):

```typescript
// Phase 8C-Shared-CP2b: result row from search_ingredients RPC.
// Fields mirror the ingredients table columns the autocomplete UI needs;
// `score` is server-computed combining ILIKE match (1.0) and trigram
// similarity (0.0-1.0).
export interface IngredientSearchResult {
  id: string;
  name: string;
  plural_name: string | null;
  family: string;
  ingredient_type: string | null;
  typical_unit: string | null;
  typical_store_section: string | null;
  score: number;
}
```

**2b. Add `searchIngredientsForAutocomplete` function.** Place near other read functions:

```typescript
/**
 * Phase 8C-Shared-CP2b — typo-tolerant ingredient search for autocomplete.
 * Wraps the search_ingredients RPC, which combines substring (ILIKE) +
 * trigram-similarity matching. Returns top 20 by score DESC, name ASC.
 * Empty query returns empty array (no DB call).
 */
export async function searchIngredientsForAutocomplete(
  query: string
): Promise<IngredientSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const { data, error } = await supabase.rpc('search_ingredients', {
      query_text: trimmed,
    });

    if (error) {
      console.error('❌ Error searching ingredients:', error);
      throw error;
    }

    return (data as IngredientSearchResult[]) || [];
  } catch (error) {
    console.error('❌ Error in searchIngredientsForAutocomplete:', error);
    throw error;
  }
}
```

The 2-character minimum guards against single-char queries returning hundreds of rows.

**2c. No changes to `addItemToList`.** Existing signature handles both ingredient (`ingredient_id`) and custom (`custom_name`) paths via 8A-CP1's nullable column. Verify by reading the current function — if it doesn't already support `custom_name`, flag in SESSION_LOG; CP2b assumes 8A-CP1's schema is wired through service.

### Part 3 — Replace `handleAddItem` placeholder in `GroceryListDetailScreen.tsx`

**3a. New imports.** Add:
```typescript
import { searchIngredientsForAutocomplete, addItemToList } from '../lib/groceryListsService';
import type { IngredientSearchResult } from '../lib/groceryListsService';
import { TextInput } from 'react-native';
```

(`TextInput` may already be imported — check first.)

**3b. New state for the add-item sheet.** Add to component state block (after existing state):

```typescript
// Phase 8C-Shared-CP2b: add-item sheet state.
const [addItemSheetVisible, setAddItemSheetVisible] = useState(false);
const [addItemQuery, setAddItemQuery] = useState('');
const [addItemResults, setAddItemResults] = useState<IngredientSearchResult[]>([]);
const [addItemSearching, setAddItemSearching] = useState(false);
const [addItemSelected, setAddItemSelected] = useState<IngredientSearchResult | null>(null);
const [addItemCustomName, setAddItemCustomName] = useState<string | null>(null);
const [addItemQuantity, setAddItemQuantity] = useState('1');
const [addItemUnit, setAddItemUnit] = useState('');
const [addItemSubmitting, setAddItemSubmitting] = useState(false);
```

State shape rationale:
- `addItemSelected`: ingredient picked from autocomplete (mutually exclusive with custom)
- `addItemCustomName`: set when user picks "Add as custom item" (mutually exclusive with selected)
- `addItemQuantity` as string for input flexibility; parsed to number on submit
- `addItemUnit` populated from `typical_unit` on selection or `'unit'` for custom

**3c. Search-as-you-type effect.** Add a `useEffect` debouncing the query:

```typescript
// Phase 8C-Shared-CP2b: debounced ingredient autocomplete.
useEffect(() => {
  if (!addItemSheetVisible) return;
  if (addItemSelected || addItemCustomName) return; // already past selection
  
  const trimmed = addItemQuery.trim();
  if (trimmed.length < 2) {
    setAddItemResults([]);
    setAddItemSearching(false);
    return;
  }

  setAddItemSearching(true);
  const handle = setTimeout(async () => {
    try {
      const results = await searchIngredientsForAutocomplete(trimmed);
      setAddItemResults(results);
    } catch (error) {
      // Soft-fail — keep existing results visible, don't crash
      console.error('Autocomplete search failed:', error);
    } finally {
      setAddItemSearching(false);
    }
  }, 250);

  return () => clearTimeout(handle);
}, [addItemQuery, addItemSheetVisible, addItemSelected, addItemCustomName]);
```

250ms debounce is responsive without hammering the DB.

**3d. Selection handlers.**

```typescript
const handleSelectIngredient = (ingredient: IngredientSearchResult) => {
  setAddItemSelected(ingredient);
  setAddItemCustomName(null);
  setAddItemUnit(ingredient.typical_unit || 'unit');
};

const handleSelectCustomItem = (name: string) => {
  setAddItemCustomName(name);
  setAddItemSelected(null);
  setAddItemUnit('unit');
};

const resetAddItemSheet = () => {
  setAddItemSheetVisible(false);
  setAddItemQuery('');
  setAddItemResults([]);
  setAddItemSelected(null);
  setAddItemCustomName(null);
  setAddItemQuantity('1');
  setAddItemUnit('');
  setAddItemSubmitting(false);
};
```

**3e. Submit handler.**

```typescript
const handleSubmitAddItem = async () => {
  // Parse quantity defensively
  const parsedQty = parseFloat(addItemQuantity);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    Alert.alert('Invalid quantity', 'Please enter a number greater than 0.');
    return;
  }

  if (!addItemSelected && !addItemCustomName) {
    Alert.alert('No item selected', 'Pick an ingredient or add as a custom item.');
    return;
  }

  setAddItemSubmitting(true);
  try {
    await addItemToList({
      list_id: listId,
      ingredient_id: addItemSelected?.id ?? null,
      custom_name: addItemCustomName ?? null,
      quantity_display: parsedQty,
      unit_display: addItemUnit || 'unit',
      // Defaults: priority='needed', priority_reason='manual' so it lands in
      // Now tier (manually-added items signal user intent, not staple-driven).
      priority: 'needed',
      priority_reason: 'manual',
      added_from: 'manual',
    });

    resetAddItemSheet();
    await loadItems();
  } catch (error) {
    console.error('Error adding item to list:', error);
    Alert.alert('Error', 'Failed to add item. Please try again.');
    setAddItemSubmitting(false);
  }
};
```

**Important:** verify `addItemToList`'s actual signature before submitting this code. The fields shown above (`ingredient_id`, `custom_name`, `priority`, `priority_reason`, `added_from`) match the post-8A-CP1 schema — if `addItemToList`'s `AddItemToListParams` interface doesn't include them all, EITHER widen the interface (mirroring P8-16-style consolidation) OR adapt the call to fit current shape with appropriate downstream service-side mapping. Flag any divergence in SESSION_LOG.

**3f. Replace the placeholder.** Existing function:

```typescript
const handleAddItem = () => {
  Alert.alert(
    'Add Item',
    'Adding items to specific lists coming soon! For now, use the main Grocery screen.',
    [{ text: 'OK' }]
  );
};
```

Replace with:

```typescript
const handleAddItem = () => {
  setAddItemSheetVisible(true);
};
```

### Part 4 — Add the bottom-sheet UI

Place a new `<Modal>` block near the end of the `return` JSX, AFTER the existing disambiguation modal (mirrors that pattern). Reuses `sheetBackdrop`, `sheetContainer`, `sheetHandle`, `sheetTitle` styles from the existing modal block. New styles needed for the input + result rows + submit button — add to the existing `styles` block.

**4a. New styles to add to the StyleSheet:**

```typescript
addItemInput: {
  marginHorizontal: spacing.lg,
  marginTop: spacing.sm,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderWidth: 1,
  borderColor: colors.border.medium,
  borderRadius: 8,
  fontSize: typography.sizes.md,
  color: colors.text.primary,
  backgroundColor: colors.background.secondary,
},
addItemResultsContainer: {
  maxHeight: 240,
  marginTop: spacing.sm,
},
addItemResultRow: {
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  borderBottomWidth: 1,
  borderBottomColor: colors.border.light,
},
addItemResultRowSelected: {
  backgroundColor: colors.background.secondary,
},
addItemResultName: {
  fontSize: typography.sizes.md,
  color: colors.text.primary,
  fontWeight: typography.weights.medium,
},
addItemResultMeta: {
  fontSize: typography.sizes.xs,
  color: colors.text.secondary,
  marginTop: 2,
},
addItemCustomRow: {
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  borderBottomWidth: 1,
  borderBottomColor: colors.border.light,
  backgroundColor: colors.background.secondary,
},
addItemCustomText: {
  fontSize: typography.sizes.sm,
  color: colors.primary,
  fontWeight: typography.weights.medium,
},
addItemQuantityRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.md,
  gap: spacing.sm,
},
addItemQuantityInput: {
  width: 60,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderWidth: 1,
  borderColor: colors.border.medium,
  borderRadius: 6,
  fontSize: typography.sizes.md,
  color: colors.text.primary,
  textAlign: 'center',
},
addItemUnitInput: {
  flex: 1,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderWidth: 1,
  borderColor: colors.border.medium,
  borderRadius: 6,
  fontSize: typography.sizes.md,
  color: colors.text.primary,
},
addItemSelectedRow: {
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  marginTop: spacing.sm,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
addItemSelectedName: {
  fontSize: typography.sizes.md,
  color: colors.text.primary,
  fontWeight: typography.weights.semibold,
  flex: 1,
},
addItemSelectedClear: {
  fontSize: typography.sizes.sm,
  color: colors.primary,
  fontWeight: typography.weights.medium,
  paddingHorizontal: spacing.sm,
},
addItemSubmitButton: {
  backgroundColor: colors.primary,
  paddingVertical: spacing.md,
  marginHorizontal: spacing.lg,
  marginTop: spacing.md,
  borderRadius: 8,
  alignItems: 'center',
},
addItemSubmitButtonDisabled: {
  backgroundColor: colors.border.medium,
},
addItemSubmitButtonText: {
  fontSize: typography.sizes.md,
  color: colors.background.card,
  fontWeight: typography.weights.semibold,
},
addItemEmptyHint: {
  fontSize: typography.sizes.sm,
  color: colors.text.tertiary,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
  textAlign: 'center',
},
```

**4b. JSX block** (insert after the existing disambiguation `<Modal>` near end of the return):

```tsx
{/* Phase 8C-Shared-CP2b: add-item sheet */}
<Modal
  visible={addItemSheetVisible}
  transparent
  animationType="slide"
  onRequestClose={resetAddItemSheet}
>
  <TouchableOpacity
    style={styles.sheetBackdrop}
    activeOpacity={1}
    onPress={resetAddItemSheet}
  >
    <TouchableOpacity activeOpacity={1} style={styles.sheetContainer}>
      <View style={styles.sheetHandle} />
      <Text style={styles.sheetTitle}>Add to {listName}</Text>

      {/* Selected state — shows the chosen ingredient/custom item with clear option */}
      {(addItemSelected || addItemCustomName) ? (
        <>
          <View style={styles.addItemSelectedRow}>
            <Text style={styles.addItemSelectedName}>
              {addItemSelected
                ? (addItemSelected.plural_name || addItemSelected.name)
                : addItemCustomName}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setAddItemSelected(null);
                setAddItemCustomName(null);
                setAddItemUnit('');
              }}
            >
              <Text style={styles.addItemSelectedClear}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addItemQuantityRow}>
            <TextInput
              style={styles.addItemQuantityInput}
              value={addItemQuantity}
              onChangeText={setAddItemQuantity}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={colors.text.tertiary}
            />
            <TextInput
              style={styles.addItemUnitInput}
              value={addItemUnit}
              onChangeText={setAddItemUnit}
              placeholder="unit"
              placeholderTextColor={colors.text.tertiary}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.addItemSubmitButton,
              addItemSubmitting && styles.addItemSubmitButtonDisabled,
            ]}
            onPress={handleSubmitAddItem}
            disabled={addItemSubmitting}
          >
            <Text style={styles.addItemSubmitButtonText}>
              {addItemSubmitting ? 'Adding...' : 'Add to list'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.addItemInput}
            value={addItemQuery}
            onChangeText={setAddItemQuery}
            placeholder="Search ingredients..."
            placeholderTextColor={colors.text.tertiary}
            autoFocus
          />

          <ScrollView style={styles.addItemResultsContainer} keyboardShouldPersistTaps="handled">
            {addItemSearching && addItemResults.length === 0 && (
              <Text style={styles.addItemEmptyHint}>Searching...</Text>
            )}

            {!addItemSearching && addItemQuery.trim().length < 2 && (
              <Text style={styles.addItemEmptyHint}>Type at least 2 characters</Text>
            )}

            {addItemResults.map((result) => (
              <TouchableOpacity
                key={result.id}
                style={styles.addItemResultRow}
                onPress={() => handleSelectIngredient(result)}
              >
                <Text style={styles.addItemResultName}>
                  {result.plural_name || result.name}
                </Text>
                {(result.family || result.typical_unit) && (
                  <Text style={styles.addItemResultMeta}>
                    {[result.family, result.typical_unit].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </TouchableOpacity>
            ))}

            {/* Custom-item fallback when query has results OR no results */}
            {addItemQuery.trim().length >= 2 && !addItemSearching && (
              <TouchableOpacity
                style={styles.addItemCustomRow}
                onPress={() => handleSelectCustomItem(addItemQuery.trim())}
              >
                <Text style={styles.addItemCustomText}>
                  + Add "{addItemQuery.trim()}" as custom item
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </>
      )}

      <TouchableOpacity style={styles.sheetCancel} onPress={resetAddItemSheet}>
        <Text style={styles.sheetCancelText}>Cancel</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>
```

UX flow:
1. Sheet opens → search input auto-focused
2. User types ≥2 chars → autocomplete results appear after 250ms debounce
3. Custom-item fallback always visible at bottom of results (good UX even when matches exist — user might want to add as custom anyway)
4. User taps a result → sheet shifts to "selected state": shows chosen item + quantity/unit input + submit button
5. User can tap "Change" to go back to search
6. Submit → sheet resets and closes; list refreshes via `loadItems()`

### Part 5 — Verification

**5a. CC-side (compile-level):**
- `npx tsc --noEmit` — confirm no new TypeScript errors
- Lint clean on changed files

**5b. Smoke-test plan for Tom (capture in SESSION_LOG; Tom executes post-session):**

1. **Substring-match path.** Open any list, tap "+ Add to List", type "tomato" → "Tomato" appears in results. Tap it → quantity input shows. Submit. Verify item appears on list with `quantity_display=1`, ingredient set.

2. **Typo-tolerance path (the killer test).** Open sheet, type "corriander" (extra `r`) → "Coriander" still appears in results. This was the smoke-test discovery that motivated the RPC. If "Coriander" is NOT in results → similarity threshold needs lowering or the RPC has a bug. Flag.

3. **Custom-item path.** Type "duct tape" → no ingredient match → "+ Add 'duct tape' as custom item" option shows at bottom. Tap it → quantity defaults to 1 unit. Submit. Verify item appears with `custom_name='duct tape'`, `ingredient_id=NULL`.

4. **Quantity override.** Same as #1 but change qty to "2" and unit to "lbs" before submitting. Verify item shows "2 lbs" on list.

5. **Cancel path.** Open sheet, type a query, tap Cancel. Sheet closes, no list change. State resets (next open shows empty input).

6. **Cross-user verification (deferred to Mary's account).** On Mary's device, open `Test Tom Mary list` (the shared list), tap "+ Add to List", add "milk". Verify Tom sees it after pull-to-refresh on his device. Confirms the new flow works through CP1's widened RLS for shared-list members.

---

## Constraints

1. **Do NOT modify the migration SQL** during the file move. Flag in SESSION_LOG if anything seems off and ask Tom for direction.
2. **Do NOT touch other CP scopes.** No CP3 work (`addItemToList.added_by`, routing service); no CP4 work (subtitle/icon/owner-only-delete UI).
3. **Match existing patterns.** The bottom-sheet should reuse the disambiguation-modal pattern's styles (`sheetBackdrop`, `sheetContainer`, `sheetHandle`, `sheetTitle`, `sheetCancel`). Don't introduce new modal libraries.
4. **`addItemToList`'s actual current shape may differ from prompt assumption.** Verify before submitting. If the function doesn't accept `priority` / `priority_reason` / `custom_name` directly, EITHER widen its interface OR pass equivalent fields by current name. Don't silently misalign.
5. **Soft-fail autocomplete errors.** Search RPC failures should not crash the modal — just log + keep prior results. The submit flow can hard-fail with Alert if `addItemToList` rejects.
6. **Match codebase conventions.** `console.error('❌ ...')` + throw pattern in service; React Native built-in primitives in UI (no new libs).
7. **No staleness flag for `screens/GroceryListDetailScreen.tsx`** per Q7. DO flag staleness for `lib/groceryListsService.ts` (Tier 1 PK file).

---

## Verification checklist

- [ ] Migration file moved from `docs/` (or repo root fallback) to `supabase/migrations/YYYYMMDD_phase_8c_shared_cp2b_search_rpc.sql`
- [ ] Part 2: `searchIngredientsForAutocomplete` function added to `lib/groceryListsService.ts`
- [ ] Part 2: `IngredientSearchResult` interface added (service-internal or canonical, CC's call)
- [ ] Part 2: No changes to `addItemToList` (or, if signature mismatch surfaced, change explicitly flagged)
- [ ] Part 3: `handleAddItem` placeholder replaced with sheet-open
- [ ] Part 3: Imports updated
- [ ] Part 3: 8 new state variables added
- [ ] Part 3: Debounced search `useEffect` added
- [ ] Part 3: Selection handlers (`handleSelectIngredient`, `handleSelectCustomItem`, `resetAddItemSheet`)
- [ ] Part 3: Submit handler (`handleSubmitAddItem`)
- [ ] Part 4: Bottom-sheet `<Modal>` JSX added
- [ ] Part 4: ~20 new styles added to `styles` block
- [ ] `tsc --noEmit` clean (baseline errors only)
- [ ] PK_CODE_SNAPSHOTS staleness flag set on `lib/groceryListsService.ts` (HIGH, Last Touched By = "Phase 8C-Shared-CP2b") per Rule E
- [ ] `_pk_sync/` copy staged for `lib/groceryListsService.ts`
- [ ] SESSION_LOG entry written per Section 8 format
- [ ] Smoke-test plan (6 steps) included in SESSION_LOG for Tom

---

## SESSION_LOG entry format

Use canonical Section 8 format. Include:

- **Phase:** 8C-Shared-CP2b (add-to-list flow on GroceryListDetailScreen; F&F-blocker fix per P8-24)
- **Prompt from:** `docs/DRAFT_CC_PROMPT_8C-Shared-CP2b.md`
- **Status:** Shipped / Blocked / Partial — one-sentence reason
- **Scope:** 1-paragraph summary. Reference P8-24 closure. Note migration file shipped.
- **Files modified:** SQL migration, service, screen. Line count deltas.
- **CC verification table:** TS compile, lint, addItemToList signature compatibility check
- **Smoke-test plan for Tom:** 6 steps from Part 5b verbatim
- **`_pk_sync/` staging:** 1 file (`lib/groceryListsService.ts`) — Tom uploads after commit
- **Recommended next steps for Tom:**
  - Run smoke-test plan; report any failures (especially Step 2 typo-tolerance)
  - Commit (suggested: `feat(grocery): 8C-Shared-CP2b — add-to-list flow on detail screen + fuzzy ingredient search; closes P8-24`)
  - P8-24 ready to mark ✅ resolved in DEFERRED_WORK (next doc-hygiene CP)
  - Queue 8C-Shared-CP3 design pass (narrowed scope: routing R2 + recipe attribution RA2)
- **Surprises / Notes for Claude.ai:**
  - `addItemToList` current signature vs prompt assumption — note any mismatch + how it was bridged
  - Any primitive name collisions in styles block (existing styles named similarly to new `addItem*` styles)
  - Whether `pg_trgm` was already enabled (per Tom's pre-flight check) or had to be enabled by this migration
  - 18th visible 2026-04-27/28+ SESSION_LOG entry across the Phase 8C arc (or whatever the actual count is post-prior CP doc-hygienes)

---

## Open questions for CC to flag

If any are NOT true at runtime:
- Migration file at `docs/` or repo root (not elsewhere)
- `screens/GroceryListDetailScreen.tsx`'s existing disambiguation modal pattern still has `sheetBackdrop`/`sheetContainer`/`sheetHandle`/`sheetTitle`/`sheetCancel` styles intact (search by style names)
- `lib/groceryListsService.ts`'s `addItemToList` accepts the param fields used in `handleSubmitAddItem` (especially `custom_name`, `priority`, `priority_reason`, `added_from`)
- `pg_trgm` extension successfully enabled via Tom's migration (confirm by checking `search_ingredients` RPC exists per pre-CC source-code check on the migration file content)
- The current `handleAddItem` placeholder still matches what the prompt expects to replace (search by Alert.alert text "Adding items to specific lists coming soon")
