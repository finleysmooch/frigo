# CC Prompt — Phase 8R-CP6c: Cart visibility + Bulk acquire + Cleanup

**Phase:** 8R-CP6c (LAST CP of the 8R series — cart visibility build + bulk acquire + filename rename + type cleanup + PK snapshot reconciliation + toast Edit disposition)
**Predecessor:** 8R-CP6b shipped 2026-04-30 (Tab 12 supply create + Tab 9 spawn toast + edit-need modal). CP6a + CP6b smoke-test deferred per Tom's "build 6c first, then test everything" decision — smoke happens after CP6c lands.
**Successor:** F&F launch. CP6c is the last build CP before testing campaign begins.
**Standing rules in effect:** A, B, C, D, E.

---

## Context

CP6c builds the remaining user-facing UX (cart visibility + progress bar + bulk acquire) AND closes out cleanup that's been deferred across CP5a/b/CP6a/b: filename rename, dead types deletion, PK snapshot reconciliation, and one small UX call (toast Edit button) deferred from CP6b.

**Three smoke-test deferred items from earlier CPs are NOT in CP6c scope:**
- P8R-D14 (TagDimensionPicker extraction) — 4 consumers justify it, but the refactor risk isn't right pre-F&F. Stays in DEFERRED_WORK at 🟡.
- ManageSuppliesScreen create-path disposition (CP6b Q1/Q4 deferral) — its create path is now redundant after PantryScreen FAB rewire, but browse-path users aren't broken. New item P8R-D24 captures it.
- Catalog data audit (P8R-D20) — separate parallel workstream.

**Three layers of untested code stack here.** CP6a (createNeed dedup, T3 reorder, long-press jump-set) + CP6b (Tab 12, spawn toast, edit-need modal) + CP6c. Smoke test after CP6c needs to cover all three. Worth flagging in SESSION_LOG.

---

## Pre-flight checks (run BEFORE starting Part 1; STOP and report on any violation)

These cover assumptions Claude.ai is making that haven't been verified against current repo state. Run all 5 and report results; only proceed if all clear.

```bash
# 1. Confirm needs from getNeedsForView only loads view-filtered statuses (NOT all statuses).
#    Expected: view.filters has status filter; query applies it; default views like "Tonight"
#    only return need-status needs.
grep -n "getNeedsForView\|.in('status'" lib/services/needsService.ts | head -10

# 2. Identify lib/types/grocery.ts current consumers.
#    Expected: grep returns a small list of files importing from this types file.
grep -rn "from.*lib/types/grocery\|from '../lib/types/grocery'" --include="*.ts" --include="*.tsx" | head -30

# 3. Identify ALL navigation refs to GroceryLists + GroceryListDetail route names.
#    These need rewiring as part of the filename rename.
grep -rn "navigate('GroceryList\|navigate(\"GroceryList\|name=\"GroceryList\|name='GroceryList\|GroceryStackParamList" --include="*.ts" --include="*.tsx" | head -30

# 4. Confirm the toast Edit button currently exists in components/SpawnOnOutToast.tsx.
#    Expected: grep returns the Edit button JSX or handler.
grep -n "Edit\|onEditPress" components/SpawnOnOutToast.tsx

# 5. Confirm in-cart needs query semantics — verify there's no existing helper that
#    returns "all in_cart needs for a space" that we'd duplicate.
grep -rn "in_cart\|status: 'in_cart'\|status === 'in_cart'" lib/services/ --include="*.ts" | head -20
```

**STOP conditions:**
- Pre-flight #2 returns surprising consumers (e.g., a file Claude.ai didn't anticipate using grocery types). Report the list.
- Pre-flight #3 returns more than ~10 navigation refs OR includes references in unexpected files (e.g., a non-screen file hardcoding the route name). Report the full list.
- Pre-flight #4 confirms no Edit button exists (CP6b deviated from prompt). Report deviation.
- Pre-flight #5 surfaces an existing `getInCartNeedsForSpace` or similar helper. Report — it changes how Part 1 implements cart footer queries.

---

## Inputs to read

1. `docs/PHASE_8R_UNIFIED_NEEDS.md` v0.5 — CP6c scope section + decisions log.
2. `docs/SESSION_LOG.md` — most recent CP6a + CP6b entries.
3. `screens/GroceryListDetailScreen.tsx` (post-CP6b — line count ~891). Layout reference for cart footer placement + bulk-acquire button conditional rendering. Bottom bar structure has "+ Add need" button; cart footer goes ABOVE this when applicable.
4. `lib/services/needsService.ts` — Part 1 extends `getNeedsForView` signature.
5. `lib/services/suppliesService.ts` — Part 3 calls `setSupplyStatus` for restock.
6. `lib/types/needs.ts` — `NeedStatus` enum.
7. `lib/types/views.ts` — `ViewFilter`, `ViewFilterDimension`. Part 3 reads view's filter to detect "is this an in-cart-only view."
8. `App.tsx` — Part 4 updates `GroceryStackParamList` + Screen registrations.
9. `lib/types/grocery.ts` — Part 5 deletes this; verify per-Part 5 grep results which consumers (if any) need rewire first.
10. `docs/PK_CODE_SNAPSHOTS.md` — Part 6 updates this. **READ THE FORMAT FIRST** before editing — match existing row format exactly. Per Rule A, this is the FIRST CP that's authorized to edit PK_CODE_SNAPSHOTS directly.
11. `components/SpawnOnOutToast.tsx` — Part 7 either removes or keeps the Edit button.

---

## Task

### Part 1 — `needsService.getNeedsForView` statusOverride parameter

Edit `lib/services/needsService.ts`.

**Why:** the cart footer (Part 2) on a need-only view (e.g., Tonight, status=['need']) needs to also fetch in-cart needs matching the same tag predicates. Currently `getNeedsForView` applies the view's full filter (including status). Adding an optional `statusOverride` parameter lets the cart footer fetch in-cart needs while reusing all the view's other filter logic.

**Edits:**

1. Update `getNeedsForView` signature:
   ```ts
   // BEFORE:
   export async function getNeedsForView(
     viewId: string,
     includeRecipes: boolean = false
   ): Promise<NeedWithDetails[]>

   // AFTER:
   export async function getNeedsForView(
     viewId: string,
     includeRecipes: boolean = false,
     statusOverride?: NeedStatus[]
   ): Promise<NeedWithDetails[]>
   ```

2. In the function body, when `statusOverride` is provided, skip applying the view's status filter and use the override instead. Tag predicates (urgency, store, recipe, for-user) still apply from the view. Implementation: in the existing query-building path, replace the view's status filter with `statusOverride` when present.

3. Add JSDoc explaining: "When statusOverride is provided, the view's own status filter is ignored. Used by the cart-footer surface to fetch in_cart needs from a need-only view."

4. **Two existing callers must remain unchanged in behavior.** `screens/GroceryListsScreen.tsx` (counts) calls `getNeedsForView(v.id)` — stays default. `screens/GroceryListDetailScreen.tsx` body calls `getNeedsForView(viewId, true)` — stays default. Verify post-edit via grep that no existing call signature breaks.

### Part 2 — Cart progress bar in ViewDetailScreen

Edit `screens/GroceryListDetailScreen.tsx`.

**Why:** smoke-test feedback — Tom liked the gamification of a cart progress bar in the prior app. New format: `5/12 (42%)` showing numerator, denominator, and percentage. Resets per-view-mount; tracks acquired progress against initial need count.

**Spec:**

- Renders BELOW the render-mode segmented toggle (Tier/Aisle/Flat), ABOVE the body and Regulars strip.
- Format: `{done}/{total} ({percent}%)` — both numbers visible plus percentage.
- Layout: full-width horizontal bar (height ~6-8px) with filled portion left-aligned showing progress, numbers + percent text above or beside the bar.
- Suppressed (do NOT render) when `total === 0` (no work to do for this view).
- Suppressed when the view is the In Cart default view (status filter === ['in_cart']) — cart-only views show bulk-acquire UX (Part 3) instead of progress.

**Implementation:**

```tsx
// Add refs + state at component top:
const initialNeedIdsRef = useRef<Set<string> | null>(null);
const [acquiredSinceMount, setAcquiredSinceMount] = useState<Set<string>>(new Set());

// Initialize once after first load completes:
useEffect(() => {
  if (initialNeedIdsRef.current === null && needs.length > 0) {
    // Snapshot the need IDs visible at mount.
    initialNeedIdsRef.current = new Set(needs.map((n) => n.id));
  }
}, [needs]);

// In handleCycleNeed, after the optimistic update + service call succeeds:
// (this happens inside the existing handleCycleNeed function — don't duplicate)
const newStatus = computeNextStatus(currentStatus); // existing logic
if (newStatus === 'acquired' && initialNeedIdsRef.current?.has(needId)) {
  setAcquiredSinceMount((prev) => {
    const next = new Set(prev);
    next.add(needId);
    return next;
  });
}

// Render conditional:
const isInCartView = view?.filters
  .find((f) => f.dimension === 'status')
  ?.values.length === 1 &&
  view.filters.find((f) => f.dimension === 'status')?.values[0] === 'in_cart';

const total = initialNeedIdsRef.current?.size ?? 0;
const done = acquiredSinceMount.size;
const percent = total > 0 ? Math.round((done / total) * 100) : 0;
const showProgressBar = total > 0 && !isInCartView;

// In JSX, below render-mode toggle:
{showProgressBar && (
  <View style={styles.progressBarContainer}>
    <Text style={styles.progressBarLabel}>{done}/{total} ({percent}%)</Text>
    <View style={styles.progressBarTrack}>
      <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
    </View>
  </View>
)}
```

**Design decisions:**
- **Progress = acquired only**, not in_cart + acquired. Marking in_cart is "still working on it" — not a state of completion. Q1 below flags this is reversible.
- Denominator locks at first-load mount. Items added during session don't increment denominator. Items already acquired pre-mount don't count.
- Items that DROP OUT of view filter (e.g., user marks Tonight need as in_cart → leaves view) are tracked silently — when they return as acquired, numerator increments if they were in initialNeedIdsRef. If user marks an item in_cart and it's still on the original list when they come back to acquire, the progress works.

**Edge cases:**
- User cycles same need acquired→need (not possible per Q50 — acquired is terminal); skip handling.
- User adds new need during session: not in initialNeedIdsRef, doesn't count toward progress.
- User leaves the view and returns: ref resets on remount (component unmounts), denominator re-snapshots based on current visible needs. This matches "resets per-view-mount" intent.

### Part 3 — Bulk acquire on cart-only views

Edit `screens/GroceryListDetailScreen.tsx`.

**Why:** smoke-test feedback — "ability to select all" + "add what's in cart to pantry" + "originally we had like a cart progress bar" gamification. Bulk acquire is the close-the-loop action.

**Spec:**

- Visible only on views where status filter === `['in_cart']`. The default In Cart view qualifies. A custom view like "Costco cart" (status=['in_cart'] + store=Costco) also qualifies.
- Replaces the "+ Add need" bottom bar on these views (cart-only views don't add needs; they consume them).
- Layout: full-width primary button at bottom: `Acquire all ({N}) → restocks supplies`.
- Tap → confirmation Alert: "Mark {N} items as acquired? This will restock {M} supplies."
  - {N} = total in_cart needs visible.
  - {M} = subset of those with `supply_id !== null`.
- On confirm: loop through visible needs, set each to acquired, restock supplies that have supply_id.

**Implementation:**

```tsx
const isCartOnlyView = useMemo(() => {
  if (!view) return false;
  const statusFilter = view.filters.find((f) => f.dimension === 'status');
  return statusFilter?.values.length === 1 && statusFilter.values[0] === 'in_cart';
}, [view]);

const visibleInCartCount = needs.filter((n) => n.status === 'in_cart').length;
const supplyLinkedCount = needs.filter((n) => n.status === 'in_cart' && n.supply_id !== null).length;

const handleBulkAcquire = async () => {
  if (visibleInCartCount === 0) return;

  Alert.alert(
    'Acquire all',
    `Mark ${visibleInCartCount} item${visibleInCartCount === 1 ? '' : 's'} as acquired? This will restock ${supplyLinkedCount} suppl${supplyLinkedCount === 1 ? 'y' : 'ies'}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Acquire',
        onPress: async () => {
          // Capture for optimistic update.
          const targetNeeds = needs.filter((n) => n.status === 'in_cart');

          // Optimistic UI: mark all in-cart needs as acquired.
          setNeeds((prev) => prev.map((n) =>
            n.status === 'in_cart' ? { ...n, status: 'acquired' } : n
          ));

          let successCount = 0;
          let failedNeedIds: string[] = [];

          for (const need of targetNeeds) {
            try {
              await setNeedStatus(need.id, 'acquired');
              if (need.supply_id) {
                await setSupplyStatus(need.supply_id, 'in_stock');
              }
              successCount++;
            } catch (error) {
              console.error('❌ Bulk acquire — error on need', need.id, error);
              failedNeedIds.push(need.id);
            }
          }

          if (failedNeedIds.length > 0) {
            // Revert failed needs to in_cart in UI.
            setNeeds((prev) => prev.map((n) =>
              failedNeedIds.includes(n.id) ? { ...n, status: 'in_cart' } : n
            ));
            Alert.alert(
              'Partial success',
              `${successCount} acquired. ${failedNeedIds.length} failed and have been restored.`
            );
          } else {
            Alert.alert('Success', `${successCount} need${successCount === 1 ? '' : 's'} acquired.`);
          }

          // Refetch in background to reconcile.
          load();
        },
      },
    ]
  );
};

// In JSX, REPLACE the existing bottom bar conditional logic:
<View style={styles.bottomBar}>
  {isCartOnlyView ? (
    <TouchableOpacity
      style={[styles.bulkAcquireButton, visibleInCartCount === 0 && styles.bulkAcquireButtonDisabled]}
      onPress={handleBulkAcquire}
      disabled={visibleInCartCount === 0}
    >
      <Text style={styles.bulkAcquireButtonText}>
        Acquire all ({visibleInCartCount}) → restocks {supplyLinkedCount}
      </Text>
    </TouchableOpacity>
  ) : (
    // EXISTING "+ Add need" button stays here unchanged
    <TouchableOpacity style={styles.addNeedButton} onPress={handleAddNeed}>
      <Text style={styles.addNeedButtonText}>+ Add need</Text>
    </TouchableOpacity>
  )}
</View>
```

**Notes:**
- Imports needed: `setNeedStatus` from needsService (already imported as `cycleNeedStatus`; verify `setNeedStatus` is exported separately or replace with `cycleNeedStatus(need.id)` → since the cycle from in_cart is in_cart→acquired, this works).
- `setSupplyStatus` from suppliesService — already imported in Part 3 of CP6b's wiring (verify).
- Use existing `setNeeds` state setter (available in ViewDetailScreen).
- The `load()` call refetches from DB — for cart-only views, this leaves an empty list (acquired needs drop out), which is intentional UX.

### Part 4 — Collapsible cart footer on need-only views

Edit `screens/GroceryListDetailScreen.tsx`.

**Why:** smoke-test feedback — "see what's in your cart when you look at the bottom of your tonight list."

**Spec:**

- Visible only on views where status filter === `['need']` (the default "need-only" case, e.g., Tonight, This week, All needs). NOT visible on cart-only views (Part 3 footer takes over) or multi-status custom views.
- Default state: collapsed. Sticky above the bottom bar.
- Collapsed format: `🛒 {N} in cart ▸` where N = count of in-cart needs matching the view's tag predicates (NOT status filter — overridden via Part 1's statusOverride).
- Tap → expanded. Shows individual in-cart need rows (same NeedRow component, scrollable).
- Suppressed when N === 0 (no in-cart needs match this view).
- Each row in the expanded list is read-only display; long-press opens edit-need modal (reuse handleLongPressNeed from CP6b); tap cycles the need (acquired terminal — same as Part 2 progress increment fires if applicable).

**Implementation:**

```tsx
// State for cart footer
const [cartFooterExpanded, setCartFooterExpanded] = useState(false);
const [cartNeeds, setCartNeeds] = useState<NeedWithDetails[]>([]);

// Determine if footer should appear at all
const isNeedOnlyView = useMemo(() => {
  if (!view) return false;
  const statusFilter = view.filters.find((f) => f.dimension === 'status');
  return statusFilter?.values.length === 1 && statusFilter.values[0] === 'need';
}, [view]);

// Load in-cart needs for this view's tag predicates (separate from main `needs`)
useEffect(() => {
  if (!isNeedOnlyView || !view) {
    setCartNeeds([]);
    return;
  }
  let cancelled = false;
  (async () => {
    try {
      const inCart = await getNeedsForView(view.id, true, ['in_cart']);
      if (!cancelled) setCartNeeds(inCart);
    } catch (error) {
      console.error('❌ Cart footer load error:', error);
    }
  })();
  return () => { cancelled = true; };
}, [isNeedOnlyView, view, refreshTrigger]); // refreshTrigger or whatever existing reload counter

// NB: refreshTrigger may not exist; use whatever pattern the existing load() uses to retrigger.
// If the screen has a useFocusEffect that calls load(), wire cart footer reload alongside.

const cartCount = cartNeeds.length;
const showCartFooter = isNeedOnlyView && cartCount > 0;
```

Mount the collapsible footer JSX between the body's ScrollView and the bottom bar:

```tsx
{showCartFooter && (
  <View style={styles.cartFooter}>
    <TouchableOpacity
      style={styles.cartFooterHeader}
      onPress={() => setCartFooterExpanded(!cartFooterExpanded)}
      activeOpacity={0.7}
    >
      <Text style={styles.cartFooterHeaderText}>
        🛒 {cartCount} in cart {cartFooterExpanded ? '▾' : '▸'}
      </Text>
    </TouchableOpacity>
    {cartFooterExpanded && (
      <ScrollView style={styles.cartFooterBody} keyboardShouldPersistTaps="handled">
        {cartNeeds.map((need) => {
          // Use existing NeedRow component. Cycle behavior + long-press both work.
          // To use NeedRow, wrap the need in a MergedNeedGroup (single-need group).
          const merged: MergedNeedGroup = {
            // Construct from the need — match the existing wrap pattern in renderBody.
            // ... see existing code for structure.
          };
          return (
            <NeedRow
              key={need.id}
              merged={merged}
              view={view!}
              styles={styles}
              colors={colors}
              functionalColors={functionalColors}
              onCycle={handleCycleNeed}
              onLongPress={handleLongPressNeed}
            />
          );
        })}
      </ScrollView>
    )}
  </View>
)}
```

**Implementation notes:**
- The MergedNeedGroup wrapping for the cart footer rows: do the simplest thing — single-need group per need, no grouping. If `mergeNeedsForDisplay` is the canonical way to wrap, call it with `[need]` as input.
- Cart footer body should have a max height (e.g., 240px) with internal scroll. Otherwise expanded footer can take over the screen on long carts.
- When user cycles a cart row from in_cart → acquired, the row disappears from cartNeeds on next reload. Trigger a refetch from `handleCycleNeed` post-success: increment a counter or call the cart footer's loader directly. **Flag the refetch wiring** — depends on existing patterns in the screen.

### Part 5 — Filename rename: GroceryListsScreen → ViewsScreen, GroceryListDetailScreen → ViewDetailScreen

**Why:** the screens were renamed via export only in CP5a (function name `ViewsScreen`/`ViewDetailScreen`) but file paths and route names kept the legacy `Grocery*` naming. CP6c finishes the rename in one pass so no nav refs are touched in two CPs.

**Steps:**

1. **Rename files** via `git mv` (per Standing Rule C — verify tracked first):
   ```bash
   git ls-files --error-unmatch screens/GroceryListsScreen.tsx
   git mv screens/GroceryListsScreen.tsx screens/ViewsScreen.tsx
   git ls-files --error-unmatch screens/GroceryListDetailScreen.tsx
   git mv screens/GroceryListDetailScreen.tsx screens/ViewDetailScreen.tsx
   ```

2. **Update App.tsx**:
   - `import GroceryListsScreen from './screens/GroceryListsScreen'` → `import ViewsScreen from './screens/ViewsScreen'`
   - `import GroceryListDetailScreen from './screens/GroceryListDetailScreen'` → `import ViewDetailScreen from './screens/ViewDetailScreen'`
   - `GroceryStackParamList` type: rename keys `GroceryLists` → `Views`, `GroceryListDetail` → `ViewDetail`. Param shape unchanged (`{ viewId: string }`).
   - `<Stack.Screen name="GroceryLists" component={...}>` → `<Stack.Screen name="Views" component={ViewsScreen}>`
   - `<Stack.Screen name="GroceryListDetail" component={...}>` → `<Stack.Screen name="ViewDetail" component={ViewDetailScreen}>`
   - **Q2 below: rename `GroceryStackParamList` to `ViewsStackParamList`?** Both options work. Renaming is more consistent. Leaving avoids more mechanical churn. Default: rename to `ViewsStackParamList`. Flag if Tom prefers leaving.

3. **Update all navigation refs across the codebase.** Use the pre-flight grep results to identify all callers. Replace each:
   - `navigation.navigate('GroceryLists')` → `navigation.navigate('Views')`
   - `navigation.navigate('GroceryListDetail', { viewId })` → `navigation.navigate('ViewDetail', { viewId })`
   - Type imports: `GroceryStackParamList` → `ViewsStackParamList` (if renaming per Q2)

4. **Update internal cross-references in the renamed files:**
   - `ViewsScreen.tsx` — `navigation.navigate('GroceryListDetail', { viewId })` → `navigation.navigate('ViewDetail', { viewId })`
   - `ViewDetailScreen.tsx` — same kind of update.

5. **Verify no orphan refs:**
   ```bash
   grep -rn "GroceryListsScreen\|GroceryListDetailScreen\|GroceryLists'\|GroceryListDetail'\|GroceryStackParamList" --include="*.ts" --include="*.tsx"
   ```
   Should return 0 matches in active code post-edit (comment-line mentions OK).

### Part 6 — `lib/types/grocery.ts` deletion

**Pre-flight check #2 told you the live consumers.** This part assumes consumers are zero (from CP5b/CP6a context) BUT verifies first.

**Steps:**

1. If pre-flight #2 returned 0 consumers in active code: delete the file.
   ```bash
   git ls-files --error-unmatch lib/types/grocery.ts
   git rm lib/types/grocery.ts
   ```

2. If pre-flight #2 returned consumers: those need rewire FIRST. Most likely candidates:
   - `GroceryListItem` type → defunct after 8R (no list-as-container model). Replace consumers' use with `NeedWithDetails` or appropriate replacement. STOP and report consumer list before rewriting; let Tom + Claude.ai decide rewires.

3. After deletion, verify:
   ```bash
   grep -rn "from.*lib/types/grocery" --include="*.ts" --include="*.tsx"
   ls lib/types/grocery.ts 2>&1  # should print "No such file or directory"
   ```

### Part 7 — Toast Edit button disposition

Edit `components/SpawnOnOutToast.tsx`.

**Why:** CP6b SESSION_LOG flagged that the Edit button on the spawn toast has no consumer at App-level mount (no `onEditPress` provided), so it dismisses without doing anything. Tom's recommended option (per Claude.ai's guidance): remove the Edit button entirely. Reasoning: long-press on the need row in any view containing it accomplishes the edit in one extra step; the Edit affordance was speculative.

**Steps:**

1. Remove the Edit `<TouchableOpacity>` from the JSX.
2. Remove the `onEditPress` prop from the component's interface.
3. Remove `onEditPress` from any caller (App.tsx mount).
4. Update the file's header comment to note the disposition decision.

If pre-flight #4 confirmed no Edit button exists (i.e., CP6b didn't ship it), this part becomes a no-op. STOP and flag.

### Part 8 — PK_CODE_SNAPSHOTS.md reconciliation

Edit `docs/PK_CODE_SNAPSHOTS.md`.

**Why:** CP5a/b/CP6a/b all flagged 12+ files with stale PK snapshots. CP6c is authorized to update the doc directly (Rule A relaxed for this part).

**Read the existing file structure first** — match the row format exactly. Likely it has tables for HIGH-tier files with date + last-CP-touched + tier columns.

**Updates:**

For files that EXISTED in PK_CODE_SNAPSHOTS pre-CP5a and were edited 2026-04-30:
- `screens/GroceryListsScreen.tsx` (renamed to ViewsScreen.tsx in Part 5) — bump date to 2026-04-30; tier stays whatever it was; row's filename changes.
- `screens/GroceryListDetailScreen.tsx` (renamed to ViewDetailScreen.tsx) — same.
- `lib/services/needsService.ts` — bump date to 2026-04-30 (touched in CP5b, CP6a, CP6b, CP6c).
- `screens/PantryScreen.tsx` — bump date to 2026-04-30 (touched in CP6b).
- `App.tsx` — bump date to 2026-04-30.
- Other files touched: `components/pantry/SuppliesSection.tsx`, `components/pantry/SupplyRow.tsx`, etc.

For files that are NEW in CP5a/b/CP6a/b/c — assign tier and add row:
- `components/ViewCreatorModal.tsx` (CP5a) → Tier 3 by analogy
- `components/AddNeedSheet.tsx` (CP5b) → Tier 2 (heavy component, 800+ lines, high churn surface)
- `components/ExpandedRegularsSheet.tsx` (CP5b) → Tier 3
- `components/SupplyCreateSheet.tsx` (CP6b) → Tier 2 (similar to AddNeedSheet)
- `contexts/SpawnOnOutToastContext.tsx` (CP6b) → Tier 3
- `components/SpawnOnOutToast.tsx` (CP6b) → Tier 3
- `components/EditNeedSheet.tsx` (CP6b) → Tier 2

For files that were DELETED — remove row:
- `components/AddGroceryItemModal.tsx` (deleted in CP5b)
- `components/QuickAddSection.tsx` (deleted in CP5b)
- `components/InlineQuantityPicker.tsx` (deleted in CP5a)
- `lib/types/grocery.ts` (deleted in CP6c Part 6)

**Add changelog row** at the top of the file's changelog table noting "8R completion sweep — 12 files reconciled across CP5a→CP6c."

**STOP and flag** any tier-assignment ambiguity. The new Tier 3 components are by analogy; if the existing tier rubric in the doc doesn't fit cleanly, flag rather than guess.

---

## Constraints

1. **DO NOT** modify any other living doc beyond `PK_CODE_SNAPSHOTS.md` (Part 8). The CP5a/b/6a/b SESSION_LOG entries are sufficient; no need to bump PHASE_8R or PROJECT_CONTEXT.
2. **DO NOT** extract `<TagDimensionPicker>` (P8R-D14). Deferred post-F&F.
3. **DO NOT** rewrite or modify `screens/ManageSuppliesScreen.tsx`. Disposition deferred to P8R-D24.
4. **DO NOT** add a CookDepletionBanner-style edit-need flow for the toast. Toast Edit button disposition is removal (Part 7).
5. **DO NOT** invent service functions. Part 1 is the only service-layer change in CP6c (statusOverride param on getNeedsForView). Parts 2-3 use existing functions.
6. **DO NOT** modify the cycle behavior. setNeedStatus + setSupplyStatus + cycleNeedStatus all stay untouched.
7. **DO NOT** add bulk-acquire to non-cart-only views. Strictly conditional on view.filters' status === ['in_cart'].
8. **DO NOT** modify SupplyCreateSheet, EditNeedSheet, or AddNeedSheet. CP6c is consumer-side except Part 1 + Part 8 (doc).
9. **TARGET LINE COUNTS** (soft, ~30% tolerance — calibrated against CP5a/b/CP6a/b actual sizes):
   - Part 1: +15-25 lines (signature + body branch)
   - Part 2: +60-90 lines (state + effects + JSX + styles)
   - Part 3: +120-180 lines (handlers + JSX + styles)
   - Part 4: +200-280 lines (state + effects + JSX + styles + cart row wrapping)
   - Part 5: ±0 (filename rename + reference updates; no logic change)
   - Part 6: -50-200 lines (deletion of types/grocery.ts; ±0 elsewhere)
   - Part 7: -10-30 lines (button removal + prop cleanup)
   - Part 8: ±0 net code; +30-80 lines doc edits
   - **Total CP6c new code: ~400-600 lines.** Significantly smaller than CP5a/b/CP6b.

---

## Verification

1. `npx tsc --noEmit -p tsconfig.json` — confirm zero new errors. Baseline 181.
2. **Part 1 verification:**
   - `grep -n "statusOverride" lib/services/needsService.ts` — confirms param added.
   - `grep -rn "getNeedsForView(" --include="*.tsx" --include="*.ts"` — confirms only THREE call sites: ViewsScreen counts (default), ViewDetailScreen body (default + true), ViewDetailScreen cart footer (default + true + ['in_cart']).
3. **Part 2 + 3 verification:**
   - Smoke step: open Tonight view → progress bar shows e.g. `0/12 (0%)`. Cycle 3 needs to acquired → bar shows `3/12 (25%)`.
   - Smoke step: open In Cart view → progress bar SUPPRESSED. Bulk acquire button visible. Tap → confirm Alert → all in-cart needs acquired + supplies restocked.
4. **Part 4 verification:**
   - Smoke step: open Tonight view (with at least 1 in-cart need matching its filter) → cart footer shows `🛒 N in cart ▸`. Tap → expands. Tap a row's dot → cycles. Long-press → edit modal opens.
5. **Part 5 verification:**
   - `ls screens/GroceryListsScreen.tsx 2>&1` → "No such file."
   - `ls screens/GroceryListDetailScreen.tsx 2>&1` → "No such file."
   - `ls screens/ViewsScreen.tsx screens/ViewDetailScreen.tsx` → both exist.
   - `grep -rn "GroceryListsScreen\|GroceryListDetailScreen\|navigate('GroceryList\|navigate(\"GroceryList" --include="*.ts" --include="*.tsx"` → 0 matches in active code.
6. **Part 6 verification:**
   - `ls lib/types/grocery.ts 2>&1` → "No such file."
   - `grep -rn "from.*lib/types/grocery" --include="*.ts" --include="*.tsx"` → 0 matches.
7. **Part 7 verification:**
   - `grep -n "Edit\|onEditPress" components/SpawnOnOutToast.tsx` → 0 matches.
   - `grep -rn "onEditPress" --include="*.tsx" --include="*.ts"` → 0 matches in active code.
8. **Part 8 verification:**
   - `docs/PK_CODE_SNAPSHOTS.md` updated; manually inspect the changelog for 2026-04-30 entry.
   - 12+ stale flags resolved (per CP5a/b/CP6a/b SESSION_LOG flagged files).
9. **Smoke-test plan (full 8R surface — covers CP6a + CP6b + CP6c together since they're ship-batched):**
   - **CP6a items:** createNeed dedup (re-add olive oil → returns existing); T3 always-top in AddNeedSheet; long-press jump-set on supply.
   - **CP6b items:** Tab 12 supply create from PantryScreen + ExpandedRegularsSheet; spawn-on-out toast fires on supply→out manual transitions; long-press need → edit modal; "Update default routing" toggle conditional.
   - **CP6c items:** progress bar, cart footer collapsible, bulk acquire on In Cart view, filename rename works (navigation still navigates correctly), no broken imports post type-deletion.
   - **Regression:** existing flows still work — RecipeDetailScreen pantry-match (basmati now shows correctly if added via T2), Feed loads + scrolls, Cooking flow logs cooks.

---

## Open questions to flag (per Rule D)

- **Q1: Progress = acquired only vs in_cart + acquired.** Spec implements acquired only. Reversible if Tom wants in_cart counted too — flag the choice in SESSION_LOG.
- **Q2: `GroceryStackParamList` type rename.** Spec says rename to `ViewsStackParamList`. Reversible — flag if Tom prefers leaving the type name for less mechanical churn.
- **Q3: PK_CODE_SNAPSHOTS tier assignments.** The new Tier 2/3 assignments in Part 8 are by analogy. STOP and flag any case where the existing rubric doesn't fit cleanly.
- **Q4: lib/types/grocery.ts consumers.** Pre-flight #2 might surface a consumer Claude.ai didn't anticipate. STOP and report before deleting.
- **Q5: Cart footer reload trigger.** When user cycles a row inside the expanded cart footer, the in-cart list needs to refetch. Wire the refetch to whatever existing reload pattern the screen uses (refreshTrigger counter, useFocusEffect, manual call). Flag the choice in SESSION_LOG.
- **Q6: Bulk acquire idempotency.** If user taps "Acquire all" then immediately taps it again before the loop completes, behavior is undefined. Mitigation: button disabled during loop (use a `bulkAcquireRunning` state). Flag if implemented.

---

## SESSION_LOG entry format

Per `docs/DOC_MAINTENANCE_PROCESS.md` Section 8. Single entry. Include all standard sections.

**Critical:** the SESSION_LOG entry should explicitly note that this is the LAST CP of the 8R series and that smoke testing of CP6a + CP6b + CP6c is now urgent + bundled.

Tracker rows per `docs/TRACKER_SPEC.md` for each modified/created/deleted/renamed file.

---

## Recommended commit message (when smoke test passes)

```
git commit -m "feat(8R): Phase 8R-CP6c — cart visibility + bulk acquire + filename rename + cleanup [LAST 8R CP]" -- screens/ViewsScreen.tsx screens/ViewDetailScreen.tsx App.tsx lib/services/needsService.ts components/SpawnOnOutToast.tsx docs/PK_CODE_SNAPSHOTS.md docs/SESSION_LOG.md
```

(Adjust paths based on rename results + any other files touched.)
