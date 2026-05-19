# CC PROMPT — Phase 8R-CP6d-Recipe

**Phase:** 8R-CP6d-Recipe (recipe-add flow rebuild)
**Estimated cost:** M. ~250-350 lines net.
**Prerequisite:** None — independent of all other CPs. Can ship anytime.

---

## Context

Per audit doc (sections "CP6d-Recipe", gap rows G38, G38b). Currently the recipe → needs flow has:

- **RecipeDetailScreen:** single button ("Add to needs") that dumps every ingredient into the unified bag with no urgency tag — meaning they only show up in "All needs" view, not in any urgency-filtered view like Tonight or This Week.
- **AddRecipeToNeedsModal:** stub with one "Add to needs" button. No urgency picker. No list picker. No way for the user to indicate "I want these for Tonight specifically."

Both are getting rebuilt:

1. **RecipeDetailScreen:** dual CTAs replacing the single button — "Add N missing" (primary, ingredients NOT in supplies as in_stock) + "Add all N" (secondary).
2. **AddRecipeToNeedsModal:** rebuilt with a forced list-picker dropdown (Today / This Week / pick another custom view). User MUST pick a destination before the Add button enables.

---

## Inputs to read

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — section "CP6d-Recipe" + gap rows G38, G38b + decision Q-NEW-22.
2. `screens/RecipeDetailScreen.tsx` — find the existing CTA button(s) that open AddRecipeToNeedsModal. Look for `setShowListModal` and `listModalMode` state (already exists per CP3 era).
3. `components/AddRecipeToNeedsModal.tsx` — full rewrite candidate. Currently ~150 lines.
4. `lib/services/needsService.ts` — `addNeedFromRecipe` is the consumer; signature for tag application should accept urgency tag inheritance.
5. `lib/services/viewsService.ts` — `getViewsForSpace` for fetching custom views to populate the picker dropdown.
6. `lib/services/tagsService.ts` — `getOrCreateTag` for creating urgency tags if they don't exist.
7. `lib/types/views.ts` — ViewWithFilters shape.

---

## Tasks

### Task 1 — RecipeDetailScreen dual CTAs (Gap-G38b)

Find the existing single CTA in RecipeDetailScreen. The current state has:
```tsx
<AddRecipeToNeedsModal
  visible={showListModal}
  onClose={...}
  recipe={recipe}
  ingredients={listModalMode === 'missing' ? missingIngredients : ingredients}
  scale={currentScale}
  spaceId={activeSpaceId || ''}
/>
```

So there's already a `listModalMode: 'missing' | 'all'` state — good. The opening button is what needs work.

Replace single button with two:

```
[ + Add N missing  →  ]    (primary — N = ingredients not in supplies as in_stock)
[ + Add all N         ]    (secondary — N = total ingredient count)
```

Computing N for missing:
- `missingIngredients` already computed in CP4 era (presence-only check against supplies, status !== 'out'). Use existing logic. Refer to the `availableIngredientIds` memoization.
- N for "Add all" = total ingredient count (filter to ingredients with `quantity_amount`, matching existing logic in AddRecipeToNeedsModal).

Disable "Add N missing" when N=0 (everything in pantry).

Tap primary → opens modal with `listModalMode='missing'` (existing pattern).
Tap secondary → opens modal with `listModalMode='all'`.

Visual: two buttons stacked or side-by-side depending on screen width. Match existing button styling on the screen (look at "I Made This" CTA for reference).

Position: same place as the current CTA (probably below the ingredients section or near the LogCookSheet button area).

### Task 2 — AddRecipeToNeedsModal rebuild (Gap-G38)

Major rewrite of `components/AddRecipeToNeedsModal.tsx`.

New layout (bottom sheet modal):

```
[Header]
  Cancel                Add to {selectedView.name}
  
[Title]
  Add to...
  
[Subtitle]
  N ingredients from "Recipe Title"
  
[List picker]
  ┌──────────────────────────────┐
  │ Today                      ▾ │   (or whatever's selected)
  └──────────────────────────────┘
  
  [Tap opens dropdown:]
  ╔═══════════════════════════════╗
  ║ Today           urgency=today ║
  ║ This Week  urgency=this-week  ║
  ║ ─────────────────             ║
  ║ Pick another list...          ║
  ╚═══════════════════════════════╝
  
[Ingredients summary] (compact, scrollable if long)
  • 2 cups flour
  • 1 cup sugar
  • 3 eggs
  ...

[Footer]
  Add button (disabled until selectedView is non-null)
```

State:
```ts
const [selectedView, setSelectedView] = useState<ViewWithFilters | null>(null);
const [pickerOpen, setPickerOpen] = useState(false);
const [allViews, setAllViews] = useState<ViewWithFilters[]>([]);
```

On modal open:
- Fetch all views via `getViewsForSpace(spaceId, false)` (not including hidden).
- Populate `allViews`.
- Default selection: NULL. Force user to pick — per Tom's call: "force urgency choice."

Picker UX:
- Tap the list picker button → opens secondary picker modal (or inline dropdown).
- Top items: Today (mapped to default view with urgency=today filter), This Week (default view with urgency=this-week filter).
- Below divider: all custom views in the space.
- "All needs" view should NOT be a default option in the top section (forces urgency choice). It's available in the custom-views list if user explicitly wants no-urgency dump.
- Selecting a view sets `selectedView`, closes picker.

Selecting Today/This Week:
- These are PSEUDO-options. When user selects "Today," internally we set `selectedView` to either:
  - The actual default view named "Tonight" or "Today" (find via `allViews.find(v => v.is_default && v.filters.find(f => f.dimension === 'urgency' && f.values.includes('today')))`), OR
  - A synthetic placeholder that drives only the urgency tag (no view-id linkage required).

Simplest approach: find the matching default view. If not found (edge case), use synthetic placeholder { name: 'Today', filters: [{ dimension: 'urgency', values: ['today'] }] }.

Add button:
- Disabled until `selectedView !== null`.
- On tap: iterate ingredients, call `addNeedFromRecipe` for each, passing the `selectedView`'s urgency tag value as inheritance.
- Use the same iteration logic as the current modal (skip unmatched ingredients, count successes/failures).
- Show toast/Alert on success: "N ingredients added to {view.name}".

`addNeedFromRecipe` signature (verify in needsService):
- It should accept either an explicit urgency value OR a view object whose tags get applied.
- If the existing function doesn't apply urgency tags, extend it. Pseudocode:
  ```ts
  // After need is created, apply view-context tags:
  const viewTags = selectedView.filters.filter(f => f.dimension !== 'status');
  // For each filter, getOrCreateTag(spaceId, dimension, value) → setNeedTags(needId, tagIds)
  ```
- T1 dedup applies via the softened createNeed logic from CP6d-Schema.

Per Tom's note: "I think we should force an urgency choice" — confirmed forced selection. No "Add to All needs" default.

### Task 3 — Update RecipeDetailScreen modal call signature

The existing call passes `listModalMode` to determine the ingredient set. That stays. But the new modal doesn't need a `listModalMode` prop name change — it just uses the passed `ingredients` array (filtered to missing or full per the existing logic).

Verify the prop signature aligns. Update if needed.

---

## Constraints

- **DO NOT** modify needsService's existing exports; extend addNeedFromRecipe if needed but preserve call signature for non-recipe consumers.
- **DO NOT** modify the existing pantry-match logic (CP4-era `availableIngredientIds` memo — still works post-CP6d-Schema).
- **DO NOT** add urgency tags directly to needs through some side channel. Apply via `setNeedTags` after creating tags via `getOrCreateTag` — same pattern as ExpandedRegularsSheet.
- **DO NOT** force a list selection if the user cancels — Cancel just closes the modal without doing anything.
- **DO NOT** create new views or modify existing views from this modal — only consume them via the picker.
- **PRESERVE** the unmatched-ingredient handling (currently shows a count of failed/skipped at the end).
- **PRESERVE all existing exports.**

---

## Verification

1. **RecipeDetailScreen dual CTAs.** With a recipe that has 5 ingredients and 2 missing from supplies: "Add 2 missing →" and "Add all 5" both render. Primary disabled when N=0 (all in pantry).
2. **Tap "Add 2 missing →".** Modal opens. Subtitle: "2 ingredients from {recipe title}". List picker shows "Tap to pick a list". Add button disabled.
3. **Pick "Today".** Picker dropdown shows Today / This Week / divider / custom views. Tap "Today" → selectedView set to the Tonight default view. Picker closes. Add button enables.
4. **Tap Add.** 2 needs created. Each has `urgency: today` tag applied. Each has `recipe_id` linked via needs_recipes junction (existing addNeedFromRecipe behavior). Toast/Alert: "2 ingredients added to Tonight".
5. **Verify in ViewDetail.** Open Tonight view → 2 new needs visible.
6. **"Add all 5" path.** Tap secondary CTA → modal opens with all 5 ingredients. Pick "This Week" → 5 needs created with urgency=this-week tag.
7. **Custom view path.** With a custom view named "Costco run" (filter: store=Costco): tap list picker → "Pick another list..." → secondary picker shows custom views including Costco run. Select it → confirm → needs created with `store=Costco` tag applied.
8. **T1 dedup.** Recipe has "olive oil" as ingredient. User has olive oil supply. Add to Tonight → if no active olive-oil need exists, one is created with supply_id link. If one already exists with same routing → returns existing (no duplicate, per CP6d-Schema dedup softening).
9. **Force-pick guard.** Cancel without picking → no needs created. Tap Add when no view picked → button is disabled, no action.
10. **Unmatched ingredients.** Recipe has an ingredient with no `ingredient_id` (e.g., "fancy custom thing") → still creates need (custom_name path), or skips with appropriate count. Match existing behavior.

---

## SESSION_LOG entry format

(Standard template. Note that AddRecipeToNeedsModal is a major rewrite, not just modification.)
