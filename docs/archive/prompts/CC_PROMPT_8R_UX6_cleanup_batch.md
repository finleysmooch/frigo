# 8R-UX6 — Cleanup batch (small items, multiple cuts)

Seven independent cleanups in one session. Items can be done in any order; each is self-contained. No new features — closing backlog from prior sessions plus folding in the deferred largest-family default from the 8R-UX3 tab refactor.

## Before starting

**Verify clean working tree.** Run `git status` first. If there's uncommitted work, stop and surface — these are mechanical changes, but if anything's uncommitted from yesterday/today, we want it captured first so any regressions from this batch are bisectable. Confirm clean before any edits.

## Items in scope

1. SupplyQuickEditModal deletion (orphaned after 8R-UX1 long-press multi-select)
2. createSupply existing-supply dedup at service layer
3. `seed_default_views` SQL function rename + row migration + UI override removal
4. Shared util extractions (3 helpers, 6+ call sites)
5. UnitPicker `sort_order` bug fix
6. Dead code cleanup from tab refactor (`ExpandedSection` variants, dead handlers, dead constants)
7. Largest-family default on Everything tab (deferred from 8R-UX3 Part D.2)

---

## Item 1 — SupplyQuickEditModal deletion

Long-press on a SupplyRow now enters multi-select mode (per 8R-UX1). The original `SupplyQuickEditModal` (built in CP6d-SmokeFix-1 / P32) is orphaned — its mount + state are still in PantryScreen but the modal is never opened.

**Files to touch:**
- `screens/PantryScreen.tsx` — remove `quickEditSupply` state, the `<SupplyQuickEditModal>` JSX block, and the import
- `components/pantry/SupplyQuickEditModal.tsx` — delete the file

**Before deleting**, grep for any other references to `SupplyQuickEditModal` (imports, JSX, type references). Expected: only PantryScreen imports it. If grep finds another caller, stop and surface — the modal is more reachable than we thought.

**Verification:**
- App loads, Pantry renders normally
- Long-press a SupplyRow → enters multi-select mode (no modal pops up)
- No "module not found" errors

---

## Item 2 — createSupply existing-supply dedup at service layer

Currently only `BulkAcquirePromotionModal` checks for existing supplies before creating; every other caller (SupplyCreateSheet, etc.) can blindly create duplicate supplies. Move dedup logic into `createSupply` itself so every caller benefits.

**Files to read first:**
- `lib/services/suppliesService.ts` — current `createSupply` signature + flow
- `lib/services/needsService.ts` — reference for the `createNeed` dedup pattern (Tom called this out as the model)
- `components/BulkAcquirePromotionModal.tsx` — current dedup pre-check that becomes redundant

**Implementation:**

In `lib/services/suppliesService.ts`, modify `createSupply` to check for an existing match BEFORE inserting:

```typescript
// Inside createSupply, after parameter validation and before the insert:

// Dedup check — same space, same ingredient (or case-insensitive custom_name match),
// not archived. Mirror createNeed's pattern.
let existingMatch: SupplyWithTags | null = null;
if (params.ingredientId) {
  const { data, error } = await supabase
    .from('supplies')
    .select(SUPPLY_SELECT)
    .eq('space_id', params.spaceId)
    .eq('ingredient_id', params.ingredientId)
    .is('archived_at', null)
    .maybeSingle();
  if (error) {
    console.error('❌ createSupply dedup lookup error (ingredient):', error);
    // Continue to insert — dedup is best-effort, don't block creation on lookup failure
  } else if (data) {
    existingMatch = data as SupplyWithTags;
  }
} else if (params.customName) {
  // Case-insensitive custom_name match within space
  const { data, error } = await supabase
    .from('supplies')
    .select(SUPPLY_SELECT)
    .eq('space_id', params.spaceId)
    .ilike('custom_name', params.customName.trim())
    .is('archived_at', null)
    .is('ingredient_id', null)
    .maybeSingle();
  if (error) {
    console.error('❌ createSupply dedup lookup error (custom_name):', error);
  } else if (data) {
    existingMatch = data as SupplyWithTags;
  }
}

if (existingMatch) {
  console.log('📦 createSupply dedup hit — returning existing supply:', existingMatch.id);
  // If the existing supply is 'out', set it to the requested initial status
  // (typically 'in_stock' for restock scenarios). Otherwise leave the status alone —
  // the caller asked to add the supply, not change its state.
  if (existingMatch.status === 'out' && params.status && params.status !== 'out') {
    const result = await setSupplyStatus(existingMatch.id, params.status);
    return result.supply;
  }
  return existingMatch;
}

// Otherwise fall through to the existing insert path
```

**Note on archived supplies:** Out of scope for this batch. If a user tries to create a supply that matches an archived one, the existing insert path will run and create a duplicate. Acceptable for now — archived-supply restore is a separate UX flow. Add to DEFERRED_WORK as `P8R-UX6-1 — createSupply archived-supply restore path`.

**After the service change, simplify `BulkAcquirePromotionModal`:**

The modal currently does its own dedup pre-check (per CP6d-SmokeFix-3 V33) AND a within-batch dedup. The within-space pre-check becomes redundant — `createSupply` now handles it. But the within-BATCH dedup (acquiring two needs that resolve to the same ingredient in one promotion) is still load-bearing, since `createSupply` doesn't know about other in-flight calls. Keep the within-batch dedup, remove the within-space pre-check.

Trace through the file carefully — the dedup logic is tangled with the existing-supply linking flow. Don't break linkNeedToSupply.

**Verification:**
1. Existing happy path: create a new supply for an ingredient not in pantry → still inserts as before
2. New dedup path: create a supply for an ingredient already in pantry → returns the existing supply, no duplicate row in the DB
3. Out-status restock: create a supply for an ingredient that exists but is 'out' → existing supply is set to 'in_stock' (or whatever status param was passed)
4. BulkAcquirePromotionModal: acquire a need without supply_id where a matching supply already exists → links to existing, no duplicate
5. BulkAcquirePromotionModal: acquire two needs in one promotion that resolve to the same new ingredient → within-batch dedup still works (1 supply, 2 needs linked)
6. Custom-name path: create a custom-name supply for a name already used (case differs: "Hummus" vs "hummus") → returns the existing supply

---

## Item 3 — `seed_default_views` rename + row migration + UI override removal

The default view names in the DB are `'Tonight'`, `'This week'`, `'All needs'`. The UI overrides them to `'Short List'`, `'Medium List'`, `'Long List'` via `flattenViewRow` in `viewsService.ts`. Rename in the function so the app-side override isn't load-bearing.

**Three-step migration:**

### Step 3a — Update the SQL function

Find `seed_default_views` in the Supabase function definitions (likely in a prior migration file). Update the function to emit the new names:

```sql
CREATE OR REPLACE FUNCTION seed_default_views(p_space_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Short List (was 'Tonight')
  INSERT INTO views (space_id, name, emoji, ...)
  VALUES (p_space_id, 'Short List', '🛒', ...);

  -- Medium List (was 'This week')
  INSERT INTO views (space_id, name, emoji, ...)
  VALUES (p_space_id, 'Medium List', '🛍️', ...);

  -- Long List (was 'All needs')
  INSERT INTO views (space_id, name, emoji, ...)
  VALUES (p_space_id, 'Long List', '🧾', ...);

  -- In Cart (was 'In cart') — keep but normalize capitalization
  INSERT INTO views (space_id, name, emoji, ...)
  VALUES (p_space_id, 'In Cart', '🛒', ...);
END;
$$ LANGUAGE plpgsql;
```

Preserve everything else about the function (tag filter creation, render_mode default = 'aisle' per 8R-UX2, etc.) — only the `name` strings change. Read the existing function carefully before drafting the replacement.

Write this as a new migration file: `supabase/migrations/20260526_rename_default_view_names.sql`. Include both the function CREATE OR REPLACE and the row migration (Step 3b) so the migration is atomic.

### Step 3b — Migrate existing rows

In the same migration file:

```sql
-- Rename existing default views to match the new function output.
-- Only renames rows where the current name is the OLD default name AND
-- the view is a default-system view (has the corresponding system tag) —
-- avoids renaming any user-created view that happens to share the name.

UPDATE views
SET name = 'Short List'
WHERE name = 'Tonight'
  AND EXISTS (
    SELECT 1 FROM view_tags vt
    JOIN tags t ON t.id = vt.tag_id
    WHERE vt.view_id = views.id
      AND t.dimension = 'urgency'
      AND t.value = 'today'
  );

UPDATE views
SET name = 'Medium List'
WHERE name = 'This week'
  AND EXISTS (
    SELECT 1 FROM view_tags vt
    JOIN tags t ON t.id = vt.tag_id
    WHERE vt.view_id = views.id
      AND t.dimension = 'urgency'
      AND t.value = 'this-week'
  );

UPDATE views
SET name = 'Long List'
WHERE name = 'All needs'
  AND NOT EXISTS (
    -- Long List has no urgency tag filter; identify by name + absence of urgency tags
    SELECT 1 FROM view_tags vt
    JOIN tags t ON t.id = vt.tag_id
    WHERE vt.view_id = views.id
      AND t.dimension = 'urgency'
  );

UPDATE views
SET name = 'In Cart'
WHERE name = 'In cart';
```

The EXISTS clauses are defensive — only rename rows that match the system-view shape. If a user happened to name a custom view 'Tonight', it won't be renamed.

Trace through this carefully. If the tag-based identification differs from how `seed_default_views` actually creates the views, adapt. The goal is "rename system defaults, leave user customs alone."

### Step 3c — Remove UI override

In `lib/services/viewsService.ts`, find `flattenViewRow` (or wherever the name override map lives). Remove the override map and the override application. The DB row's `name` is now authoritative.

**Verification:**
1. Apply the migration via Supabase SQL editor
2. Existing spaces: views named 'Tonight' / 'This week' / 'All needs' / 'In cart' now show as 'Short List' / 'Medium List' / 'Long List' / 'In Cart' in the DB
3. Create a new space → `seed_default_views` fires → new views are inserted with the new names directly
4. ViewsScreen + ViewDetailScreen render the new names without UI override
5. No regression in the list-picker modal (ListPickerModal still shows correct names)
6. Custom user-created lists are unaffected

---

## Item 4 — Shared util extractions

Three helpers duplicated across components, one already drifted once.

### Item 4a — `resolveViewTagIds` → `lib/utils/viewTagResolution.ts`

**Duplicated in 3 places:**
- `components/InlineAddNeedRow.tsx`
- `components/ExpandedRegularsSheet.tsx`
- `components/ListPickerModal.tsx`

Find the existing definition in any of the three. They should be functionally identical (no drift yet to my knowledge, but verify). Pick the cleanest version, extract to `lib/utils/viewTagResolution.ts` as a named export, and update all three call sites to import.

If they HAVE drifted, surface the drift in the SESSION_LOG and use the most recent / most complete version. Don't silently pick — flag explicitly.

### Item 4b — `renderListIcon` → `lib/utils/listIcon.tsx`

**Duplicated in 3 places:**
- `screens/ViewsScreen.tsx`
- `screens/ViewDetailScreen.tsx`
- `components/ListPickerModal.tsx`

Same pattern as 4a. Extract to `lib/utils/listIcon.tsx` (note `.tsx` not `.ts` since it returns JSX). Pick cleanest version, surface any drift in SESSION_LOG.

### Item 4c — `supplyMatchesView` → `lib/utils/supplyViewMatching.ts`

**Already drifted once** between:
- `screens/ViewDetailScreen.tsx`
- `components/ExpandedRegularsSheet.tsx`

The drift was discovered + fixed during 8R-UX2 (per the session log entry from 2026-05-21). Use the post-drift-fix version (the one that skips both `status` and `urgency` dimensions when matching supplies). Extract to `lib/utils/supplyViewMatching.ts`, update both call sites.

**Verification for all of 4a/4b/4c:**
- `npx tsc --noEmit` clean
- Each call site renders the same as before
- No "module not found" or import errors
- The view-context filter still works in ExpandedRegularsSheet (Open the Regulars strip on Short List, verify items are filtered correctly)

---

## Item 5 — UnitPicker `sort_order` bug

Pre-existing CP4.5 regression. `components/UnitPicker.tsx:101-106` selects + orders by `sort_order` on `ingredient_common_units` but that column doesn't exist on the table. Fires `ERROR Error loading units: column ingredient_common_units.sort_order does not exist` whenever the UnitPicker renders.

**Fix:**

In `components/UnitPicker.tsx` around lines 101-106:
- Drop `sort_order` from the `.select()` clause
- Remove the `.order('sort_order')` call

If there's a meaningful ordering currently being lost (e.g., common units should appear before less-common ones), check whether there's another column that could substitute (`display_order`, `position`, etc.). If nothing else exists, just remove the `.order()` call and accept default ordering — fixing the unsorted order properly belongs in a future schema change.

**Verification:**
- Open SupplyCreateSheet with tracks_lots on
- Open the unit picker on a lot input row
- No console error
- Units load correctly

---

## Item 6 — Dead code cleanup from tab refactor

CC flagged these in the 8R-UX3 session log:

**In `components/pantry/SuppliesSection.tsx`:**
- `ExpandedSection` enum has dead variants `{ kind: 'use_soon' }` and `{ kind: 'attention' }` — the standalone Use Soon and Attention sections that used them were deleted in 8R-UX3
- `tapUseSoon` and `tapAttention` handlers are dead (no longer wired to any UI element)
- `useSoonTotal` constant is computed but no longer rendered anywhere
- `expansionInitializedRef` + the auto-expand cascade useEffect may also be dead if it only targeted the old `'use_soon'` / `'attention'` kinds — verify before removing

**Remove:**
- The dead variants from the `ExpandedSection` type definition
- The dead handlers (`tapUseSoon`, `tapAttention`)
- The dead `useSoonTotal` constant
- The auto-expand cascade useEffect IF it's confirmed dead (no current UI consumes it). If it serves the `'sub'` kind for type-subgroup expansion, leave that part alive but remove any `'use_soon'` / `'attention'` branches inside it.

**Don't remove** anything related to the `{ kind: 'sub'; top: ...; key: string }` variant — that's still in use for type-subgroup expand/collapse inside Everything tab.

**Verification:**
- App loads, Pantry renders normally
- Type-subgroup expand/collapse still works on Everything tab (tap a type header → its items show)
- `npx tsc --noEmit` clean
- No new console warnings

---

## Item 7 — Largest-family default on Everything tab (folded in from 8R-UX3 spec Part D.2)

When the user lands on the Everything tab, the inner family pill should default to the largest family by count, not `{ kind: 'all' }`. Was deferred during 8R-UX3 because it required an extra setState pass.

**Implementation pattern:**

In `components/pantry/SuppliesSection.tsx`, replace the existing reset-on-outer-tab-change useEffect:

```typescript
// Old:
// useEffect(() => {
//   setActiveInnerFilter({ kind: 'all' });
// }, [activeOuterTab]);

// New:
const everythingDefaultedRef = useRef(false);

useEffect(() => {
  if (activeOuterTab !== 'everything') {
    everythingDefaultedRef.current = false;
    setActiveInnerFilter({ kind: 'all' });
    return;
  }
  // On Everything tab — apply largest-family default once per "session in this tab"
  if (everythingDefaultedRef.current) return;
  if (supplies.length === 0) return;  // wait for data

  // Compute largest family directly (avoid familyTabs dep — it's recomputed each render)
  const familyCounts = new Map<string, number>();
  for (const s of supplies) {
    if (s.archived_at !== null) continue;
    if (s.status === 'unknown') continue;
    const { key } = familyKeyForSupply(s);
    if (key === '__other__') continue;  // skip Other as default — too generic
    familyCounts.set(key, (familyCounts.get(key) ?? 0) + 1);
  }
  if (familyCounts.size === 0) return;

  let largestKey: string | null = null;
  let largestCount = 0;
  for (const [key, count] of familyCounts) {
    if (count > largestCount) {
      largestCount = count;
      largestKey = key;
    }
  }
  if (largestKey) {
    setActiveInnerFilter({ kind: 'family', familyKey: largestKey });
    everythingDefaultedRef.current = true;
  }
}, [activeOuterTab, supplies]);
```

**Behavior:**
- First Pantry mount → outer tab = 'everything' → defaults to largest family (likely Pantry for most users)
- User taps "All" → inner = `{ kind: 'all' }` → respected (no re-default thanks to the ref)
- User taps Use Soon outer tab → inner resets to `{ kind: 'all' }`, ref resets to false
- User taps Everything outer tab back → ref is false → re-defaults to largest family
- User leaves Pantry to Recipes → comes back → fresh mount → fresh ref → defaults to largest

**Note on Heroes pill interaction:** The Heroes pill is mutually exclusive with family pills (per 8R-UX5). If the user activates Heroes, then switches outer tab and comes back, this default logic will re-apply largest family. That's correct — Heroes activation is preserved within a single Everything-tab session but resets on outer-tab switch, mirroring the family pill behavior.

**Verification:**
1. Fresh Pantry mount → Everything tab is active → inner filter shows the largest family selected (e.g., Pantry 45 has teal fill)
2. Tap "All" → all 86 items show, "All" is now active
3. Switch to Use Soon → All is active (default), inner shows use-soon items
4. Switch back to Everything → largest family is selected again
5. Activate Heroes → content filters to heroes
6. Switch to Use Soon, then back to Everything → largest family selected again (Heroes deactivated by the reset)
7. No render loops, no double-setState warnings

---

## Constraints (apply to all items)

- **Verify clean working tree at start.** Commit-before-edit hygiene.
- No new dependencies
- No schema changes outside Item 3 (the migration file is the only schema-touching change)
- No changes to the matcher (8D-CP2.1 stays as-is)
- No changes to the tab refactor architecture (8R-UX3 stays as-is; Item 7 is a layered behavior change, not an architecture change)
- No changes to `last_confirmed_at` (8R-UX4 stays as-is)
- No changes to hero ingredient logic (8R-UX5 stays as-is)
- All extractions are mechanical — don't rewrite logic during the extract pass. Flag drift but don't fix it (unless it's a known drift like supplyMatchesView)

## SESSION_LOG entry

```
### YYYY-MM-DD — 8R-UX6 — Cleanup batch (7 items)

**What shipped:**

1. **SupplyQuickEditModal deleted** — orphaned after 8R-UX1 long-press multi-select. Removed file + state + mount in PantryScreen.

2. **createSupply service-layer dedup** — checks for existing supply (by ingredient_id OR case-insensitive custom_name within space, not archived) before inserting. If 'out' existing supply is matched and a non-out status was requested, sets to the new status. BulkAcquirePromotionModal's within-space pre-check simplified — within-batch dedup retained.

3. **`seed_default_views` renamed** — Tonight → Short List, This week → Medium List, All needs → Long List, In cart → In Cart. Existing rows migrated via the same SQL migration. UI override map in `viewsService.flattenViewRow` removed.

4. **Shared utils extracted:**
   - `resolveViewTagIds` → `lib/utils/viewTagResolution.ts` (3 callers updated)
   - `renderListIcon` → `lib/utils/listIcon.tsx` (3 callers updated)
   - `supplyMatchesView` → `lib/utils/supplyViewMatching.ts` (2 callers updated, post-drift-fix version)

5. **UnitPicker `sort_order` bug fixed** — dropped non-existent column from select + order clauses.

6. **Dead code cleanup from 8R-UX3** — removed `{ kind: 'use_soon' }` and `{ kind: 'attention' }` from `ExpandedSection`, removed `tapUseSoon` / `tapAttention` handlers, removed `useSoonTotal`. Auto-expand cascade [decision].

7. **Largest-family default on Everything tab** — inner family pill defaults to the largest family on first entry; resets on outer-tab switch via ref pattern; respects user's manual taps to "All" or other families within a session.

**Files touched:**
- screens/PantryScreen.tsx (Item 1, 6 indirect)
- components/pantry/SupplyQuickEditModal.tsx (deleted, Item 1)
- lib/services/suppliesService.ts (Item 2)
- components/BulkAcquirePromotionModal.tsx (Item 2 simplification)
- supabase/migrations/20260526_rename_default_view_names.sql (new, Item 3)
- lib/services/viewsService.ts (Item 3 override removal)
- lib/utils/viewTagResolution.ts (new, Item 4a)
- lib/utils/listIcon.tsx (new, Item 4b)
- lib/utils/supplyViewMatching.ts (new, Item 4c)
- components/InlineAddNeedRow.tsx, components/ExpandedRegularsSheet.tsx, components/ListPickerModal.tsx (Item 4a/4b/4c imports updated)
- screens/ViewsScreen.tsx, screens/ViewDetailScreen.tsx (Item 4b/4c imports updated)
- components/UnitPicker.tsx (Item 5)
- components/pantry/SuppliesSection.tsx (Items 6 + 7)

**Deferred items added to DEFERRED_WORK.md:**
- P8R-UX6-1 — createSupply archived-supply restore path (out of scope for this batch)

**Known drift flagged during extraction (if any):**
- [list any drift discovered during Item 4 extractions, with old/new and which version was kept]

**Pre-flight check:**
- Working tree was [clean / had uncommitted: list]
```

After CC ships, smoke priorities in order:
1. App loads, Pantry renders, no errors
2. Long-press a supply → multi-select mode (Item 1)
3. Add a supply for an ingredient already in pantry → no duplicate created (Item 2)
4. Migration applied → default lists show new names (Item 3)
5. Open ExpandedRegularsSheet on Short List → items filter correctly (Item 4c regression check)
6. Open SupplyCreateSheet → unit picker loads cleanly with no console error (Item 5)
7. Fresh Pantry mount → Everything tab → largest family pre-selected (Item 7)

If any of these fail, paste the relevant code section and we patch before commit.
