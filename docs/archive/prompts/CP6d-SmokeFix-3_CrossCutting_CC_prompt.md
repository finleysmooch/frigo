# CC PROMPT — CP6d Smoke Fixes Group 3: Cross-cutting Bugs + Recipe Filter

**Phase:** 8R-CP6d-SmokeFix-3 (post-CP6d series, cross-cutting fixes)
**Estimated cost:** M-L. ~400-500 lines net spread across 6-8 files.
**Prerequisite:** CP6d-SmokeFix-1 (Pantry visual + structural) and CP6d-SmokeFix-2 (header + search) shipped and TS-clean.

---

## Notes from CP6d retrospective (read first)

Three things to internalize before executing:

**1. Schema field-name verification before writing code.** Always grep `Supabase_Snippet_Schema_Column_Details_with_PK_FK_Metadata.csv` to confirm column names. If a column doesn't exist, pick the closest existing field and flag in SESSION_LOG.

**2. The audit doc is in the repo.** `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` is authoritative when prompts are ambiguous.

**3. Two prior smoke-fix CPs have shipped.** SmokeFix-1 (Pantry visual + structural — bookmark icons, full cycle, dual-listing, accordion, long-press modal, P8R-D24 resolved). SmokeFix-2 (header + search redesign). Don't undo that work.

---

## Context

This CP closes out the smoke-fix series. Items here are cross-cutting bugs across the ViewDetail, RecipeList, Bulk Acquire, and SupplyDetail surfaces — none of which fit cleanly under a single-screen prompt. Plus one new feature (P38 — shelf-life days scroll on SupplyDetail).

The bigger grocery-list redesign Tom flagged ("needs a bigger redesign / wireframes session") is **NOT in scope here**. That's a future phase.

---

## Inputs to read

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — original ViewDetail / Recipe / SupplyDetail decisions.
2. `screens/ViewDetailScreen.tsx` — for V19 counter bug, V22 cart-uncheck-reorder bug.
3. `screens/ViewsScreen.tsx` — for the Tonight/This Week count display.
4. `lib/services/needsService.ts` — for `getNeedsForView`, `mergeNeedsForDisplay`. Counter logic likely lives here or just above.
5. `components/BulkAcquirePromotionModal.tsx` — for V33 dedup-on-create bug.
6. `lib/services/suppliesService.ts` — for `createSupply` deduplication if needed.
7. `screens/SupplyDetailScreen.tsx` — for P38 shelf-life days scroll feature.
8. `screens/RecipeListScreen.tsx` — for D11 "Find recipes" defaults to wrong browse mode + hero-only filter narrow-scope.
9. `screens/PantryScreen.tsx` — for V33 auto-refresh pattern after returning from BulkAcquire.
10. `Supabase_Snippet_Schema_Column_Details_with_PK_FK_Metadata.csv` — confirm `ingredients.shelf_life_days_*` columns and `supplies.shelf_life_days_*` if a supply-level override exists.

---

## Tasks

### Task 1 — V19 counter bug investigation + fix (Tonight/This Week count shows 0)

Tom's smoke note: "The regulars counter on tonight doesn't seem to be counting correctly — it says 0 for everything. Counter does seem to be working for all needs, though. Why is counter for this week and tonight not working?"

This is a real bug. Tom asked you (CC) to investigate and fix.

**Investigation steps:**

1. Check `screens/ViewsScreen.tsx` — the Lists home renders cards with counts via the `counts: Record<string, number>` map populated by `Promise.all(allViews.map(async (v) => { const needs = await getNeedsForView(v.id); ... }))`.
2. The count is `merged.length` after `mergeNeedsForDisplay(needs)`. If All Needs view shows correct count but Tonight (status filter `['need']`, urgency filter `['today']`) shows 0, the issue is one of:
   - **(a) View's filter doesn't match any needs.** Needs being created via inline-add or recipe-add aren't getting the urgency=today tag applied. Check `addNeedFromRecipe` and the inline-add flow's tag application logic.
   - **(b) `getNeedsForView` returns the wrong shape for filtered views.** The filter pipeline misapplies the urgency filter for default views.
   - **(c) The view's filters are missing or malformed in the DB.** Check the view's `view_filters` table for the urgency=today row.

**Likely root cause (my hypothesis):** view-context inheritance from inline-add isn't applying the urgency tag correctly. When a need is created on Tonight via inline-add, the `tagIds` should include the urgency=today tag — but if the inline-add flow's tag-context lookup fails (e.g., uses the wrong dimension key, treats `'today'` as a value but the tag is stored as `'Today'` capitalized, etc.), the tag never attaches and the need doesn't match Tonight's filter.

Run a quick SQL audit:
```sql
-- Check what urgency tags actually exist
SELECT id, dimension, value, space_id FROM tags 
WHERE dimension = 'urgency' AND space_id = '<your space>';

-- Check what tags are on a recently-created need
SELECT n.id, n.created_at, t.dimension, t.value 
FROM needs n
LEFT JOIN need_tags nt ON nt.need_id = n.id
LEFT JOIN tags t ON t.id = nt.tag_id
WHERE n.space_id = '<your space>'
ORDER BY n.created_at DESC LIMIT 10;
```

If recent needs have no urgency tags, the inline-add flow is the bug. Fix in `components/InlineAddNeedRow.tsx`'s view-context-inheritance logic — probably the tag-resolution helper isn't hitting the right tag.

If recent needs DO have urgency tags but the count is still 0, the bug is in `getNeedsForView`'s filter logic — the JOIN against need_tags isn't filtering correctly for multi-value filter sets.

Report the root cause in SESSION_LOG. Fix accordingly.

### Task 2 — V22 cart uncheck reorder bug

Tom's smoke note: "When i click and check an item off, it goes to in cart, but if i uncheck it, it does not go back to the top, it seems to go somewhere else?"

Currently in ViewDetailScreen, when a need cycles `in_cart` → `need`, it should reappear in the body section in alphabetical position. Tom reports it's NOT landing in alphabetical position.

**Investigation steps:**

1. Check the `mergeNeedsForDisplay` function and the body-section rendering logic in ViewDetailScreen.
2. The body partition is `bodyNeeds = needs.filter(n => n.status === 'need')`. After `mergeNeedsForDisplay`, the merged groups should sort alphabetically by display name.
3. Verify the sort comparator in `mergeNeedsForDisplay` (or wherever the body sort happens) uses `a.displayName.localeCompare(b.displayName)` (or equivalent).

**Likely root cause:** the merged groups are sorted by something other than alphabetical (created_at? insertion order?), so when an in_cart need flips back to 'need', it appends rather than slotting alphabetically.

Fix the sort comparator to alphabetical-by-display-name. Verify Tier mode and Aisle mode sort comparators don't conflict (Tier groups by ingredient family / typical_store_section, Aisle by store_section, then alpha within each group).

### Task 3 — V33 BulkAcquire dedup-on-create + auto-refresh fix

Tom's smoke note (paraphrased): two lemon needs in cart, hit Acquire, both got created as TWO separate supplies. After acquiring, search for "lemon" in pantry returned nothing immediately. Moving to another screen and back refreshed and supplies showed up — but as TWO duplicate "lemon" supplies that should have merged into one.

Two bugs here:

**(a) createSupply dedup gap.** In `components/BulkAcquirePromotionModal.tsx`'s confirm handler, the loop creates a supply per checked item. When multiple items resolve to the same ingredient (or the same custom_name), they should DEDUPE before creating.

Fix: in the BulkAcquirePromotionModal's confirm handler, BEFORE the createSupply loop:

```ts
// Dedupe by (ingredient_id || custom_name normalized)
const dedupKey = (need: Need): string => {
  if (need.ingredient_id) return `ing:${need.ingredient_id}`;
  return `custom:${(need.custom_name ?? '').toLowerCase().trim()}`;
};

const seen = new Set<string>();
const dedupedNeeds = needsToPromote.filter(need => {
  const key = dedupKey(need);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

After deduping, run createSupply only for `dedupedNeeds`. The OTHER needs (skipped duplicates) still acquire (set status to 'acquired') but DON'T get a new supply created — they share the supply created from the first instance.

After all supplies created, run a second pass: for the deduped-out needs, find the supply that was just created (look up by ingredient_id or custom_name) and link it (`UPDATE needs SET supply_id = ... WHERE id = ...`). This way all the duplicate needs end up linked to the single new supply.

**(b) Auto-refresh after BulkAcquire returns.** PantryScreen doesn't auto-refresh when the user navigates back from a flow that modified supplies. Tom's flow was: BulkAcquire → Pantry didn't show new supplies → went elsewhere and back → supplies appeared.

Standard fix: PantryScreen mounts a `useFocusEffect` that re-runs `loadSupplies()` when the screen gains focus. If this exists already, verify it's actually firing — possibly the focus event isn't triggering because navigation came from a modal-close rather than a screen-pop.

```ts
useFocusEffect(
  useCallback(() => {
    if (spaceId) loadSupplies(spaceId);
  }, [spaceId, loadSupplies])
);
```

Add or fix as needed.

### Task 4 — D11 RecipeList "Find recipes" defaults (defaults to 'all' not 'try_new')

Tom's smoke note: "Also it defaulted to only 'try new' not 'all'. It should default to 'all'."

When SupplyDetailScreen's "🍳 Find recipes with {name}" CTA navigates to RecipeListScreen with `initialIngredient` param, the screen should land in `browseMode='all'`, not `'try_new'`.

In `screens/RecipeListScreen.tsx`'s route-params useEffect:

```ts
if (initialIngredient) {
  setBrowseMode('all');  // <-- ensure this fires when initialIngredient is set
  setAdvancedFilters(prev => ({
    ...prev,
    heroIngredients: [...(prev.heroIngredients ?? []), initialIngredient],
  }));
}
```

Currently the param-handler block sets `browseMode` only when `initialBrowseMode` is provided. Add an explicit `setBrowseMode('all')` when `initialIngredient` is set, regardless of `initialBrowseMode`.

### Task 5 — D11 RecipeList "Find recipes" full-text not hero-only

Tom's smoke note: "i don't think this is all the recipes i have that contain parmesan? Also it defaulted to only 'try new' not 'all'... When i go directly to the recipes page and into the search and type 'parmesan', i get 41 recipes."

The hero-ingredients filter is too narrow. "Parmesan" via Find recipes filtered to 7 recipes; full-text search returns 41.

Two paths to fix:

**(a) Convert `initialIngredient` to use the full-text search path** instead of hero_ingredients filter. In RecipeListScreen, when `initialIngredient` is set, programmatically set `searchText = initialIngredient` and trigger `handleSearch()` instead of pushing to `heroIngredients`.

**(b) Keep hero_ingredients filter but ALSO trigger full-text.** Both filters apply (intersection or union — depends on UX).

My recommendation: **(a) — pure full-text path**. The hero-ingredients filter exists for a different use case (browsing by featured ingredient). For "Find recipes with this ingredient" the intent is "show all recipes that use this," which is full-text territory.

Implementation:
```ts
if (initialIngredient) {
  setBrowseMode('all');
  setSearchText(initialIngredient);
  // Don't push to heroIngredients
  // Trigger search programmatically
  setTimeout(() => handleSearch(), 0);  // or similar — needs to fire after state settles
}
```

Verify: navigating from SupplyDetail's "Find recipes" with name="parmesan" should now land RecipeList with browseMode='all', searchText='parmesan', and ~41 results visible.

### Task 6 — P38 shelf-life days scroll on SupplyDetail

Tom's smoke note: "Within detail, should have ability to update for that individual item it's remaining shelflife — maybe like a number of days scroll system?"

Add a new section to `screens/SupplyDetailScreen.tsx`: a per-supply shelf-life override that lets the user adjust how many days the system considers this specific supply to "expire" / become stale.

**Schema check:** does `supplies.shelf_life_days_override` exist? If not, this requires a migration — flag it in SESSION_LOG and stub the UI for now (TextInput stub with note: "Schema migration pending").

**Assumption: column doesn't exist yet.** Don't add a migration in this CP. Stub the UI with the picker but make it a no-op (logs to console, shows toast "Coming soon"). File a P8R-D row for "supplies.shelf_life_days_override schema migration."

If the schema column DOES exist (verify with grep on the schema CSV), wire it through:
- Service helper: `setSupplyShelfLifeOverride(supplyId, days: number | null)`
- UI: number scroll/slider on SupplyDetail. Range 0-365 days. Default value: from `supply.shelf_life_days_override ?? ingredient.shelf_life_days_<storage>`. Save on change.
- Stale-detection logic in `getStaleTrackOnlySupplies` updated to honor the override.

Place the new section under "Storage location" and above "Stores." Title: "Shelf life override". Hint text: "Defaulted from {ingredient name}'s {storage} shelf life."

### Task 7 — V33 follow-up: SupplyCreateSheet should auto-refresh post-create

Tied to Task 3's auto-refresh issue. After the BulkAcquirePromotionModal creates new supplies, when the user later opens SupplyCreateSheet to search "lemon", the existing supplies should already be in the searchable set.

This works via `getSuppliesForSpace`'s realtime fetch on each search. Verify the search input in SupplyCreateSheet hits a fresh query each time, not a stale cached list. If the cache is stale, force a refetch on every search debounce.

This may already work correctly — Tom's complaint was about the Pantry not refreshing, not the search. But verify SupplyCreateSheet doesn't have the same staleness issue.

---

## Constraints

- **DO NOT** modify Pantry header or search bar (SmokeFix-2 territory).
- **DO NOT** modify Pantry visual / structural / inline-expand / long-press modal (SmokeFix-1 territory).
- **DO NOT** redesign the grocery list interaction model — that's a future phase per Tom's smoke note.
- **DO NOT** add the `supplies.shelf_life_days_override` schema column in this CP. Stub UI only if column missing; flag as deferred.
- **DO NOT** modify the Workstream A catalog data (parmesan/parmesan cheese duplicates, missing ingredients) — those are separate work.
- **DO** preserve cookDepletionService, SpawnOnOutToast, dedup softening from CP6d-Schema, group-cycle from CP6d-ViewDetail-followup, and all CP6d feature work.
- **DO** preserve the SmokeFix-1 dual-listing fix (Tasks 9-10 of that prompt).
- **PRESERVE all existing exports.**

---

## Verification

1. **V19 counter bug.** Create 2 needs via inline-add on Tonight view → check ViewsScreen Lists home → Tonight count shows 2. This Week count shows 0. All Needs count shows 2.
2. **V22 cart uncheck reorder.** On Tonight with 5 needs (in body), cycle "Apple" to in_cart → moves to cart section. Cycle Apple back to need → reappears in body BEFORE "Banana" (alphabetical position).
3. **V33 BulkAcquire dedup.** Cart with 3 needs, all for "lemon" (no supply_id), no existing lemon supply. Acquire all + check the promotion modal → confirm → ONE new lemon supply created in supplies table. All 3 needs are acquired AND linked to the same new supply (supply_id matches).
4. **V33 auto-refresh.** After BulkAcquire confirm + close modal, navigate to PantryScreen → new supplies visible immediately, no manual refresh needed.
5. **D11 default browse mode.** SupplyDetail → Find recipes for "parmesan" → RecipeList opens with `browseMode='all'` (not `'try_new'`).
6. **D11 full-text scope.** RecipeList opened via Find recipes for "parmesan" → ~41 results visible (matching the result of typing "parmesan" in the search box manually). Not 7 (hero-only).
7. **P38 shelf-life override.** SupplyDetail shows shelf-life-days input under Storage. Either it works (column exists) or shows stub message (column missing, deferred).
8. **No regressions.** Pantry header/search behaviors from SmokeFix-2 unchanged. Pantry row visuals from SmokeFix-1 unchanged. CP6d feature work intact.

---

## SESSION_LOG entry format

Standard template. Per-file lines, deviations, schema-gaps surfaced, open questions.

Particular notes for Tom: 
- Root cause of V19 counter bug (was it tag-application or filter-logic?)
- V33 dedup outcome — was it as simple as the linear-dedup I described, or did multiple needs create a cascade issue?
- Whether `supplies.shelf_life_days_override` column exists or is deferred.

Stage to `_pk_sync/SESSION_LOG_2026-05-04_CP6d-SmokeFix-3.md`.

After this CP ships, the CP6d series + smoke-fix series is complete. Recommend: full re-smoke pass by Tom focused on the items SmokeFix-1/2/3 touched, then move to Workstream A (catalog audit) and Workstream B (8D matching) in parallel before F&F.
