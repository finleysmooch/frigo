# CC PROMPT — CP6d Smoke Fixes Group 2: Pantry Header + Search Bar

**Phase:** 8R-CP6d-SmokeFix-2 (post-CP6d series, header + search redesign)
**Estimated cost:** L. ~400-600 lines net spread across 4-5 files.
**Prerequisite:** CP6d-SmokeFix-1 (Pantry visual + structural) shipped and TS-clean.

---

## Notes from CP6d retrospective (read first)

Three things to internalize before executing:

**1. Schema field-name verification before writing code.** Always grep `Supabase_Snippet_Schema_Column_Details_with_PK_FK_Metadata.csv` to confirm column names. If a column doesn't exist, pick the closest existing field and flag in SESSION_LOG.

**2. The audit doc is in the repo.** `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` is authoritative when prompts are ambiguous.

**3. SmokeFix-1 has shipped.** SuppliesSection now uses single-source-of-truth accordion state, dual-listing works, and SupplyRow has the new visual + bookmark icons + inline-expand layout. Don't undo that work.

---

## Context

Tom's smoke surfaced significant friction with the Pantry header + search bar interaction. Specifically:

- Profile emoji in header should be replaced with an icon that opens space-sharing (member management)
- Home-icon tap should open the space switcher modal directly (currently opens an inline label)
- Search bar has TWO layers (the visible bar + a dropdown that obscures filtered results) — should be ONE
- Filtered results are hidden under the dropdown — broken UX
- Tapping the Pantry tab/button at the bottom of the screen should clear active search and restore full pantry
- Search should match across categories (typing "spices" filters to all spices, typing "cheese" finds parmesan, etc.)
- Search bar needs more interactive recommendations — not JUST the "+ Add" button

Plus a catalog data issue (parmesan AND parmesan cheese both exist) that's a Workstream A item, but mentioned here for completeness — NOT in scope for this CP.

---

## Inputs to read

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — original Pantry header/search decisions.
2. `screens/PantryScreen.tsx` — header layout, search-bar mounting, current Tab navigation pattern.
3. `components/pantry/PantrySearchBar.tsx` — current single-input search component.
4. `components/pantry/SuppliesSection.tsx` — receives the search query as prop, runs the filter pre-classification.
5. `screens/SpaceSettingsScreen.tsx` — existing surface for space membership management. This is the destination for the profile-icon tap.
6. `App.tsx` — for navigation route registration (if SpaceSettingsScreen needs new route plumbing).
7. `contexts/SpaceContext.tsx` and `components/SpaceSwitcher.tsx` — for header-icon → space switcher behavior.
8. `lib/services/searchService.ts` — for understanding existing search patterns; also useful if we want category-name matching.
9. `Supabase_Snippet_Schema_Column_Details_with_PK_FK_Metadata.csv` — confirm `ingredients.family` and `ingredients.ingredient_type` are the correct category columns.

Asset prerequisite: home + profile icons already added in CP6d-Pantry. No new assets.

---

## Tasks

### Task 1 — Header icon UX: home → space switcher, profile → sharing (P3 redesign)

Currently in PantryScreen header:
- Home-icon tap → toggles muted current-space label inline below title (the toggle behavior)
- Profile-icon tap → opens SpaceSwitcher modal in a bottom-sheet wrapper

**New behavior per Tom's smoke note:**
- **Home-icon tap → opens the space switcher modal directly.** The home icon represents the space; tapping it shows what spaces are available and lets you switch.
- **Profile-icon tap → navigates to SpaceSettingsScreen** (the existing screen, routed in App.tsx). Per Tom's clarification: "the profile icon is just replacing the profile emoji showing how many individuals are tied to the pantry — by clicking it, maybe that allows you into a module to update the sharing of the pantry."
- The profile icon should also subtly indicate the **count of members** in the current space — a small badge or numeral overlay (e.g., "👥 2" or just a "2" in a corner). Use `space.members.length` if accessible, else query members count once on mount.

**Remove:** the inline-label-on-home-tap toggle. The label below the title that toggles on home-icon tap should be REMOVED. The space name is still visible somewhere — either keep it as a static muted subtitle below the title at all times, OR rely on the title bar of the modal (when it's open) to show the current space.

My recommendation: **keep the static muted "{emoji} {name}" subtitle below the title at all times** (no toggle, just always visible). Tap home icon to switch space; the subtitle updates on switch.

**Routes:** SpaceSettingsScreen should already be reachable from somewhere (probably Settings tab or Profile screen). If it's not in PantryStackParamList, you may need to either:
- (a) Add it to PantryStackParamList so the profile-icon can navigate within the same stack, OR
- (b) Cross-stack navigate to wherever it lives (e.g., `tabNav.navigate('SettingsStack', { screen: 'SpaceSettings' })`)

Pick the cleaner option based on existing routing. Flag the choice in SESSION_LOG.

### Task 2 — Single-layer search bar (P5 main fix)

In `components/pantry/PantrySearchBar.tsx`, the current implementation has the TextInput plus a dropdown of suggestions/affordances that floats below — Tom's note: "Currently two layers of search — is it possible to display everything as one layer?"

Two interpretations of "single-layer," reconcile with Tom's smoke notes:
- **(a) Drop the dropdown entirely.** Search bar is just an input. Filter applies to the supplies list rendered below in SuppliesSection. The "+ Add" affordance moves to a different location (e.g., inline below the input but as a static row, not a floating dropdown).
- **(b) Keep the dropdown but make it transparent/non-obscuring.** Filtered supplies remain visible behind/around the dropdown.

Tom's specific complaint: **"when you search, it successfully filters, but you can't actually see the items that it's filtered. They are hidden under the dropdown."** This means option (a) is correct — drop the floating dropdown. Filtered results render in the SuppliesSection list below.

**New PantrySearchBar layout:**
```
┌────────────────────────────────────────────────┐
│ 🔍 [Search or add...                    ] [×] │
└────────────────────────────────────────────────┘
[ + Add 'X' as supply  →  ] ← inline row, below input, ONLY when no exact match + query ≥2 chars
```

The "+ Add" row replaces the dropdown affordance — it's a normal row in the screen layout, not floating. Renders below the search input, above the StaleItemsBanner / SuppliesSection.

Submit-on-return still triggers the add path when no exact match exists. Tap on the "+ Add" row → opens SupplyCreateSheet pre-populated.

### Task 3 — Search by category name (P5 category-search)

Per Tom: "you should be able to just type 'spices' and see a filtered view of all your spices — don't we have ingredients organized by category?"

Yes — `ingredients.family` is the category column (verified in CP6d-Pantry). Extend the search filter logic in SuppliesSection's filter pipeline:

Currently the filter is `displayName.toLowerCase().includes(query.toLowerCase())`. Extend to:

```ts
const q = searchQuery.toLowerCase().trim();
const supplyMatches = (supply: SupplyWithTags): boolean => {
  if (!q) return true;
  const name = (supply.ingredient?.name ?? supply.custom_name ?? '').toLowerCase();
  const plural = (supply.ingredient?.plural_name ?? '').toLowerCase();
  const family = (supply.ingredient?.family ?? '').toLowerCase();
  const ingredientType = (supply.ingredient?.ingredient_type ?? '').toLowerCase();
  
  // Match against name, plural_name, family, OR ingredient_type
  return name.includes(q) || plural.includes(q) || family.includes(q) || ingredientType.includes(q);
};
```

Tom's "cheese" example: typing "cheese" should find parmesan because parmesan's `ingredient_type` is "cheese" or its `family` includes "cheese." Verify against actual catalog data — if neither family nor ingredient_type cleanly maps for cheese, the fallback is to also match against any tag values on the supply, but keep that as a follow-up if the basic match fails.

### Task 4 — Search recommendations affordance (P5 recommendations)

Per Tom: "The search bar should be more interactive (should give you recommendations based on what you typed to filter by or add? But this is a balancing act because i don't want it to take up too much room."

Interpretation: when user types a query that has multiple plausible interpretations or matches, a small subtle hint row appears under the search input suggesting refinements.

**Implementation (minimal, non-intrusive):**

When `searchQuery.length >= 2` AND there are matches across multiple families:
- Render a small horizontal scrollable row of "filter chips" below the search input
- Each chip represents a family that has matches for the query (e.g., for "cheese" search: `🧀 Dairy (3)` `🛒 Pantry (1)`)
- Tap a chip → adds family-restriction to the query (i.e., narrows further)
- Active chip has filled background; tap again to deselect

This row is COMPACT (one row, ~32pt height, horizontal scroll). It only renders when needed — not for every search.

If this feels like scope creep, fall back to **just the simpler version**: when query matches across families, show a tiny hint text below the input: "Found in 3 categories — keep typing to narrow." Don't build chips; let the user refine via more typing. **Default to this simpler version unless time permits the chips.**

Flag in SESSION_LOG which variant shipped.

### Task 5 — Pantry tab tap clears search (P5 clear-on-tab-tap)

Per Tom: "If you have the search bar open (and or things having been searched and filtered) and click the pantry button at the bottom, it should clear out the search and give you the view of your full pantry again."

The Pantry tab is one of the bottom-tab buttons. Currently tapping it when already on Pantry does... probably nothing (default tab behavior). Need to detect "tab tapped while already on this tab" and clear search.

React Navigation pattern: `tabPress` event handler that runs on tab tap, including re-tap. PantryScreen mounts a `useEffect` that subscribes to the tab's `tabPress` event:

```ts
useEffect(() => {
  const unsubscribe = navigation.getParent()?.addListener('tabPress', (e) => {
    // Only act if we're already focused (re-tap on current tab)
    if (navigation.isFocused()) {
      setSearchQuery('');
      // Also collapse all expanded sub-categories if you want full reset
    }
  });
  return unsubscribe;
}, [navigation]);
```

This clears `searchQuery` (which is lifted up from PantrySearchBar to PantryScreen state) and resets the filter. Optionally also reset the section accordion state to default (all sections collapsed except Attention).

### Task 6 — Lift search state up to PantryScreen (refactor needed for Task 5)

For Task 5 to work cleanly, `searchQuery` must live in PantryScreen state, not in PantrySearchBar's internal state. Make PantrySearchBar a controlled component:

```tsx
<PantrySearchBar
  query={searchQuery}
  onQueryChange={setSearchQuery}
  onAddNonMatch={(query) => { /* opens SupplyCreateSheet with initialQuery */ }}
/>
```

The `hasExactMatch` ref pattern from CP6d-Pantry can stay — it's still needed for the "+ Add" affordance logic.

Pass `searchQuery` down to SuppliesSection as before. The clear-on-tab-tap from Task 5 just calls `setSearchQuery('')`.

---

## Constraints

- **DO NOT** modify ViewDetail, AddNeedSheet, EditNeedSheet, ExpandedRegularsSheet, RecipeDetailScreen, AddRecipeToNeedsModal, SupplyDetailScreen, SupplyCreateSheet — out of scope.
- **DO NOT** alter the StaleItemsBanner, count-bump animation, or other features shipped in SmokeFix-1.
- **DO NOT** alter the section ordering (Attention → On Hand → Regulars from SmokeFix-1).
- **DO NOT** modify SpaceSettingsScreen — only navigate to it. If it needs a new feature for the sharing module use case, that's a separate prompt.
- **DO NOT** address the parmesan / parmesan cheese duplicate (catalog data issue, Workstream A territory).
- **DO** preserve all existing exports.
- **DO** preserve the inline +Add affordance as a static row (not floating dropdown) per Task 2.

---

## Verification

1. **Header icons.** Home-icon top-left tap → space switcher modal opens. Profile-icon top-right tap → navigates to SpaceSettingsScreen. Space subtitle below title shows "{emoji} {name}" always.
2. **Profile icon shows member count.** Subtle "2" or "👥 2" overlay/badge on the profile icon for a 2-member space.
3. **Search bar single-layer.** No floating dropdown obscures filtered results. As user types, supplies list below filters live.
4. **+Add affordance inline.** Type "newitem" (≥2 chars, no match) → "+ Add 'newitem' as supply" row appears between the search input and the StaleItemsBanner. Tap → SupplyCreateSheet opens pre-populated.
5. **Search by category — family match.** Type "spices" → filter shows all supplies with `ingredient.family = 'pantry'` and `ingredient_type = 'spice'` (or similar — depends on catalog). A reasonable subset of items renders. (Confirm against actual catalog state.)
6. **Search by category — cheese example.** Type "cheese" → parmesan and other cheeses surface. (May fail until catalog has cleaner ingredient_type values for cheeses; flag this as an expected dependency on Workstream A.)
7. **Recommendations affordance.** Type "cheese" with matches across families → either the family chips row appears OR a tiny "Found in X categories" hint shows below the input. Confirm which variant shipped.
8. **Pantry tab clear-on-tap.** Type something into search → tap the Pantry tab at the bottom → search clears, full pantry view restored, all sections in default state.
9. **Search query lifts to PantryScreen.** Verify the PantrySearchBar is now controlled (props-driven query state). Re-running clear-on-tap-tap from a deeper navigation state still clears.

---

## SESSION_LOG entry format

Standard template. Per-file lines, deviations, schema-gaps surfaced, open questions.

Particular note for Tom: which variant of the recommendations affordance shipped (chips vs hint text), and the route used for SpaceSettings navigation (in-stack vs cross-stack).

Stage to `_pk_sync/SESSION_LOG_2026-05-04_CP6d-SmokeFix-2.md`.
