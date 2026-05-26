# CC_PROMPT_8D_CP3 — Recipe tap-sheet pattern + match % banner

**Phase:** 8D — Recipe-pantry matching
**Estimated:** ~2 sessions (CP3 + CP5 bundled)
**F&F-blocker:** Yes — implements D6-18 deferred feature
**Authored by:** Claude.ai planning, 2026-05-18
**Depends on:** CC_PROMPT_8D_CP1 shipped — `pantryMatchingService.ts` exists and `RecipeDetailScreen` holds a `matchResult` in state.

---

## Context

CP1 landed the matching primitive and lit up the existing ✓ checkmarks in `IngredientsSection`. Recipe ingredient rows now show pantry state, but tapping a row does nothing — the ingredient is a passive indicator.

CP3 makes ingredient rows interactive. Tapping an ingredient opens an **inline tap-sheet directly below the tapped row** (not a bottom overlay — preserves scroll position and the surrounding context). The sheet's actions adapt to the ingredient's match state:

- **Matched (status=in_stock/low/critical):** See more / Update qty / Which step? / Other recipes (+ "+ Need now" if low/critical)
- **Missing:** + Need now / Substitute / Add to supplies / See more

This implements the D6-18 deferred feature from Phase 6G ("tap-to-see-steps in IngredientsSection") and unifies it with the pantry state and grocery-add affordances from Phase 8R.

This prompt **bundles CP5** (match % banner CTA) because:
- Both touch `RecipeDetailScreen` near each other
- Both consume the same `matchResult` from CP1
- The "banner" is small (~50 lines on top of existing `IngredientsSection` infrastructure — the `+ Add N missing →` button already exists; CP5 just adds the match-% framing)
- Wireframes show them as part of the same recipe surface

Wireframes: `docs/wireframes/phase_8/phase_8_system_prototype_v5.html` — primary reference. The Recipe tab shows the existing Phase 6G NYT-style layout preserved 1:1, with inline tap-sheets appearing below the tapped row. Cross-reference v5 (NOT v4 — v4 had a bottom-sheet overlay pattern that was replaced).

---

## Inputs to read

**Required (architectural context):**
1. `docs/PHASE_8D_PLANNING.md` — CP3 section, decision Q8 (form mismatch UI surface), test inventory.
2. `docs/wireframes/phase_8/phase_8_system_prototype_v5.html` — Recipe tab. Note the inline tap-sheet behavior (tap row → sheet appears directly below; tap same row again or another row to dismiss/switch).
3. `docs/PHASE_8_PANTRY_AND_GROCERY.md` — context on the unified needs model, how needs are tagged with urgency and recipes.

**Required (code-level inputs):**
4. `lib/services/pantryMatchingService.ts` — the `PantryMatchResult` and `MatchedIngredient` types CP3 consumes.
5. `lib/services/needsService.ts` — `addNeedFromRecipe` flow used by the "+ Need now" action.
6. `components/AddRecipeToNeedsModal.tsx` — existing modal for the bulk "Add N missing" flow; reused by the match-% banner.
7. `components/SupplyCreateSheet.tsx` — existing sheet for creating a new supply; reused by the "Add to supplies" action.
8. `components/recipe/IngredientsSection.tsx` — host component. CP3 modifies it (rows become tappable; tap-sheet renders inline).
9. `screens/RecipeDetailScreen.tsx` — parent that holds `matchResult` (from CP1) and passes it down. CP3 may add a banner here.
10. `lib/services/cookingService.ts` — `mapIngredientsToSteps` for the "Which step?" action.
11. `contexts/SpaceContext.tsx` — `useActiveSpaceId`, used to scope the need creation.

**Schema verification (already verified in CP1, just confirm still true):**
- `needs` table accepts `priority_reason` text. Confirm via the `Supabase Snippet Schema Column Details with PK_FK Metadata.csv` or by reading `lib/types/needs.ts`. **(needs-verification — confirm during reading pass.)**
- If `priority_reason` doesn't exist, the alternative is using `notes` on the need, or a recipe attribution via `needs_recipes` junction with a string field. CP5 sketch said `priority_reason: 'for X recipe'` but the actual `Need` type in `lib/types/needs.ts` doesn't list a `priority_reason` field. Verify and adapt.

If `priority_reason` is missing: **STOP and report.** Claude.ai will decide whether to use `notes`, add the column, or rely on `needs_recipes.recipe_id` + recipe title at display time.

---

## Task

### Part A — Inline tap-sheet component

**Create:** `components/recipe/IngredientTapSheet.tsx` — a new presentational component.

**Props:**
```typescript
interface IngredientTapSheetProps {
  ingredient: {
    id: string;
    name: string;
    quantity_display: string;       // already-formatted quantity string, e.g. "2 tbsp"
    preparation: string | null;     // e.g. "chopped"
    form: string | null;            // 'dried', 'fresh', etc.
  };
  matchState: 'matched_in_stock' | 'matched_low' | 'matched_critical' | 'missing';
  formMismatch: { recipeForm: string; supplyForm: string } | null;
  matchedSupply: {
    id: string;
    custom_name: string | null;
    quantity_amount: number | null;
    quantity_unit: string | null;
  } | null;                          // null when missing
  recipeId: string;
  spaceId: string;
  userId: string;
  onClose: () => void;
  onActionFired: (action: string) => void; // for analytics/instrumentation — see Part D
}
```

**Layout (matches wireframe v5):**

```
┌─────────────────────────────────────────┐
│ Ingredient name              [state pill]│
│ 2 tbsp chopped · [extra detail]          │
│                                          │
│ form: dried (recipe) ↔ fresh (you have)  │  ← only when formMismatch is non-null
│                                          │
│ [Primary action]                         │
│ [Secondary] [Secondary] [Secondary]      │
└─────────────────────────────────────────┘
```

**Actions per state:**

| State | Primary | Secondary actions |
|---|---|---|
| `matched_in_stock` | See more | Update qty · Which step? · Other recipes |
| `matched_low` | + Need now | See more · Update qty · Which step? |
| `matched_critical` | + Need now | See more · Update qty · Which step? |
| `missing` | + Need now | Substitute · Add to supplies · See more |

**Action handlers:**

- **+ Need now:** Call `addNeedFromRecipe` from `needsService.ts`. Args: `spaceId`, `ingredientId: ingredient.id`, `quantityDisplay` parsed from `ingredient.quantity_display`, `unitDisplay`, `recipeId`, `recipeQuantityAmount`, `recipeQuantityUnit`, `addedBy: userId`. Tag with urgency `this-week` — fetch or create the `urgency:this-week` tag via `tagsService.getOrCreateTag` and pass its ID in `tagIds`. After success: show a toast "Added to needs · this week" using the existing toast pattern (look at how `SpawnOnOutToast` is invoked from `setSupplyStatus` for the toast pattern). Close the sheet.
- **See more:** v0 implementation is `Alert.alert('Ingredient detail coming soon', ingredient.name)`. (The Ingredient Detail screen is post-F&F per the master plan.)
- **Update qty:** v0 is `Alert.alert('Update qty coming soon')`. The proper modal lands post-F&F.
- **Which step?:** Call `mapIngredientsToSteps` to find which instruction step uses this ingredient. Close the sheet. Scroll the parent `RecipeDetailScreen`'s preparation section to that step (use existing step navigation pattern in PreparationSection — there's a `focusedStepIndex` state that you can lift to RecipeDetailScreen and call from here). If multiple steps use the ingredient, scroll to the first.
- **Other recipes:** Cross-stack navigate to `RecipeList` with a filter for the ingredient. The existing pattern for this is in `SupplyDetailScreen.tsx`'s `handleFindRecipes`. Use `navigation.navigate('Recipes', { screen: 'RecipeList', params: { initialIngredientFilter: ingredient.id } })` or whatever the established cross-stack route is — confirm with the existing pattern.
- **Substitute:** v0 is `Alert.alert('Substitutions coming soon')`. (Recipe substitution engine is post-F&F per D8D-Q13.)
- **Add to supplies:** Open `SupplyCreateSheet` with the ingredient pre-populated. The existing prop pattern uses `setCreateSheetInitialQuery` in `PantryScreen.tsx` — apply the same pattern by lifting `SupplyCreateSheet` open-state up to `RecipeDetailScreen` (don't put it inside the tap-sheet — it's a peer surface, not a nested modal). Tap-sheet's "Add to supplies" closes the tap-sheet and opens the SupplyCreateSheet.

**Form mismatch annotation:** Render below the metadata line, small text, both forms shown. Format: `form: dried (recipe) ↔ fresh (you have)`. Style: smaller font (12-13pt), tertiary text color, not a warning — purely informational.

### Part B — Modify `IngredientsSection.tsx`

CP1 left `IngredientsSection` untouched. CP3 modifies it minimally:

1. Add new props:
   - `matchResult: PantryMatchResult | null` — full match result from CP1
   - `recipeId: string`
   - `spaceId: string`
   - `userId: string`
   - `onWhichStep: (ingredientId: string) => void` — bubbles up to RecipeDetailScreen for step scroll
   - `onAddToSupplies: (ingredientId: string, ingredientName: string) => void` — bubbles up to RecipeDetailScreen for SupplyCreateSheet
2. Add state: `const [expandedIngredientId, setExpandedIngredientId] = useState<string | null>(null);`
3. Wrap each ingredient row in a `TouchableOpacity` that toggles `expandedIngredientId`. Tapping the same row twice or another row dismisses/switches.
4. Below the tapped row's view, conditionally render `<IngredientTapSheet ... />` when `expandedIngredientId === ingredient.id`. Use a render branch inside the existing `groups.map(...)`.
5. Compute `matchState` for each ingredient by looking up:
   - If `ingredient.id` is in `matchResult.matched`: check the supply's status (in_stock/low/critical) — need to query the matched supply to find this. **OR** add `status` to `MatchedIngredient` in CP1.
   - **Schema review needed:** the current `MatchedIngredient` type stores `supplyId` but not `status`. CP3 needs `status` to differentiate `matched_in_stock` / `matched_low` / `matched_critical`. **Decide during execution:**
     - **Option A:** Extend `MatchedIngredient` to include `supplyStatus: SupplyStatus`. Backfill in `pantryMatchingService.ts`. Single-line addition.
     - **Option B:** Fetch the supply separately in `IngredientsSection` or RecipeDetailScreen. More query overhead.
   - **Default to Option A.** It's the cleaner fix. **STOP and report** if extending the type creates downstream issues you can't resolve.

### Part C — Match % banner in `RecipeDetailScreen.tsx` (CP5)

1. Render a banner directly below the recipe header (or above the IngredientsSection's `ACCENT_LINE` / section title), only when:
   - `matchResult !== null` AND
   - `matchResult.matchPercentage < 1.0` AND
   - `matchResult.missing.length > 0`
2. Banner content: `"{XX}% in pantry · {N} missing →"` where XX is `Math.round(matchPercentage * 100)` and N is `matchResult.missing.length`. Visually: rounded box with the primary color (teal) border, primary color text, centered, tappable.
3. Tap → open the existing `AddRecipeToNeedsModal` with `mode='missing'`. This modal already exists and handles the bulk add. The wiring already exists in `IngredientsSection` (the "+ Add N missing →" button there) — for CP5, lift the modal-open state up to `RecipeDetailScreen` and trigger from both the banner AND the existing button. **DO NOT** duplicate the modal — both entry points open the same instance.

### Part D — Console.warn instrumentation

Add temporary instrumentation to the tap-sheet actions:

```typescript
console.warn('[IngredientTapSheet] action', {
  action: 'add_need_now' | 'see_more' | 'update_qty' | 'which_step' | 'other_recipes' | 'substitute' | 'add_to_supplies',
  ingredientId: ingredient.id,
  matchState,
  recipeId,
  result: 'success' | 'error' | { errorMessage: string },
});
```

Mark for removal at the end of 8D. **Lifecycle:** instrumentation removed during the 8D phase-completion cleanup pass (per established pattern).

---

## Constraints

- **Preserve Phase 6G layout 1:1 inside `IngredientsSection`.** Group headers, the `✓ qty unit <name>, prep` row format, single-checkmark indicator. Do NOT restructure into cards or bordered containers.
- **Tap-sheet appears INLINE below the tapped row.** Not a bottom-overlay modal, not a popover, not a navigation push. The wireframe v5 explicitly chose this pattern; v4's overlay was rejected.
- **Services own all Supabase calls.** The tap-sheet component calls `addNeedFromRecipe` (service), not Supabase directly.
- **No new schema.** All needed columns exist on `needs`, `needs_recipes`, `tags`. If `priority_reason` is genuinely missing on `needs`, STOP and report — Claude.ai picks the alternative.
- **Reuse existing modals.** `AddRecipeToNeedsModal` and `SupplyCreateSheet` are reused; no new modals for those flows.
- **One tap-sheet open at a time.** Tapping a different ingredient row dismisses the previous and opens the new one. Tapping the same row dismisses.
- **Don't change the default sort or list rendering** in `IngredientsSection`.
- **STOP and report** on schema mismatch, missing prop in upstream components, or any case where the wireframe is ambiguous and you'd be making a judgment call.

---

## Verification

Before writing the SESSION_LOG entry:

1. **TypeScript compiles.** Run `npx tsc --noEmit`. Report new errors.
2. **`IngredientTapSheet.tsx` exists** with the expected exports.
3. **`IngredientsSection.tsx` renders tap-sheets inline.** Grep for `IngredientTapSheet` import in the file.
4. **Match % banner renders in `RecipeDetailScreen.tsx`.** Grep for the percentage-formatting string template literal.
5. **`AddRecipeToNeedsModal` is opened from BOTH the banner AND the IngredientsSection's existing "+ Add N missing" button** — and they share state (the modal isn't duplicated). Verify by reading the JSX in `RecipeDetailScreen.tsx`.
6. **`MatchedIngredient` shape extension** (if Option A was chosen): grep `pantryMatchingService.ts` for `supplyStatus` and confirm it's populated.

On-device verification (Tom runs separately):
- Open a recipe with mixed pantry state (some matched, some missing, some low). Confirm:
  - Tap a matched ingredient → sheet appears below with "See more" primary + secondary actions
  - Tap a missing ingredient → sheet appears with "+ Need now" primary
  - Tap a low ingredient → sheet has "+ Need now" primary
  - Tap the same row → sheet dismisses
  - Tap a different row → sheet switches
  - "+ Need now" creates a need (verify in Pantry tab → Needs view: a new need with the right ingredient + recipe attribution shows up)
  - "Add to supplies" closes the tap-sheet and opens SupplyCreateSheet pre-populated
  - "Which step?" scrolls the page to the relevant prep step
  - "Other recipes" navigates to RecipeList filtered by the ingredient
- Match % banner shows at the top when matchPercentage < 100%, hides when 100%.
- Banner tap opens AddRecipeToNeedsModal in mode='missing'.

---

## SESSION_LOG entry format

```markdown
## 2026-MM-DD — Phase 8D CP3: recipe tap-sheet + match % banner
**Phase:** 8D
**Prompt from:** CC_PROMPT_8D_CP3.md

[Body. Specifically note: which option (A or B) chosen for `MatchedIngredient.supplyStatus`; whether `priority_reason` exists on `needs` or an alternative was used; any wireframe ambiguity decisions made.]

**Files modified:**
- `components/recipe/IngredientTapSheet.tsx` (NEW, ~XXX lines)
- `components/recipe/IngredientsSection.tsx` (tap-sheet integration) ⚠️ PK snapshot now stale (was YYYY-MM-DD)
- `screens/RecipeDetailScreen.tsx` (banner + modal lift + step scroll) ⚠️ PK snapshot now stale (was YYYY-MM-DD)
- `lib/services/pantryMatchingService.ts` (if Option A: add supplyStatus to MatchedIngredient) ⚠️ PK snapshot now stale (was YYYY-MM-DD)

**Verification results:**
- TypeScript: [N new errors / clean]
- IngredientTapSheet exports: ✅
- Inline rendering verified: ✅
- Match % banner renders conditionally: ✅
- AddRecipeToNeedsModal shared between banner + existing button: ✅

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md`: add `components/recipe/IngredientTapSheet.tsx` to component map; note the tap-sheet pattern.
- `DEFERRED_WORK.md`: mark D6-18 as resolved (carries from Phase 6G).
- `PROJECT_CONTEXT.md`: 8D-CP3 flip from 🔲 to ✅ (or 🟢 if partial); note CP5 bundled and shipped together.
- `FF_LAUNCH_MASTER_PLAN.md`: mark 8D-CP3 + CP5 complete in phase table.

**Recommended next steps for Tom:**
1. On-device walkthrough: open a recipe, tap matched/missing/low ingredients, confirm each action works.
2. Confirm the inline tap-sheet doesn't trash scroll position when opening/closing.
3. If "+ Need now" works end-to-end, the recipe-pantry feedback loop is closed for F&F.
4. Next planning session: Claude.ai drafts `CC_PROMPT_8D_CP4.md` (What-can-I-cook screen).

**Surprises / Notes for Claude.ai:**
[Schema mismatches, unexpected behaviors, decisions made under ambiguity.]
```

---

## Open questions (STOP conditions)

1. **`needs.priority_reason` doesn't exist** — pick between `notes` field and reliance on `needs_recipes` junction. Report which.
2. **`MatchedIngredient` extension to include status causes downstream breakage** in `RecipeListScreen` (e.g., bulk path overhead grows beyond 3 queries). Report and recommend Option B.
3. **`mapIngredientsToSteps` doesn't return an ingredient → step index mapping** in a usable shape. Report what it returns and what's missing.
4. **Cross-stack navigation pattern for "Other recipes" is ambiguous** — multiple existing screens use different patterns. Report which pattern you adopted and why.
5. **The wireframe in v5 shows different actions than this prompt specifies** for one of the states. Report the diff.

Report findings; Claude.ai will reconcile before proceeding.
