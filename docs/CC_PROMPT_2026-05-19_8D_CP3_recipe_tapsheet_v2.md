# CC Prompt — Phase 8D CP3: Recipe Tap-Sheet + Match % Banner — v2

**Date drafted:** 2026-05-19 (v2 supersedes the 2026-05-18 v1 draft after a code-grounded review post-CP2 + CP2-patch)
**Estimated:** ~2 sessions (CP3 + CP5 banner bundled)
**F&F-blocker:** Yes — implements D6-18 deferred feature
**Depends on:** CP1, CP1.5, CP2, and CP2-patch all shipped 2026-05-19. The matcher returns a 4-level `MatchedIngredient` shape; `IngredientsSection.tsx` renders L1/L2/L3 distinctly; `RecipeDetailScreen.tsx` already holds `matchResult` in state.

---

## Context

CP1+CP2 lit up the ingredient rows in `IngredientsSection.tsx`: green ✓ for L1/always_available, yellow ⚠ for L2 form variants, yellow ≈ for L3 substitutes, red for L4 missing. The rows are currently passive indicators — tap does nothing.

CP3 makes rows interactive:
- **Tap → inline tap-sheet appears directly below the tapped row** (not a bottom overlay; preserves scroll position).
- **Actions adapt to the row's state.** Matched rows get "See more / Update qty / Which step? / Other recipes" plus "+ Need now" when supply status is low/critical. Missing rows get "+ Need now / Substitute / Add to supplies / See more."
- **always_available rows (water, ice) are non-tappable.** No useful actions; row appearance unchanged.
- **All matched levels (L1, L2, L3) share identical tap-sheet behavior.** The L2/L3 inline indicators already carry the form-variant / substitute information; the tap-sheet doesn't repeat that.

CP3 also bundles CP5 (match % banner): a single tappable banner at the top of `RecipeDetailScreen` when match% < 100%, opening the existing `AddRecipeToNeedsModal` with `mode='missing'`. Bundled because both touch the same screen, both consume `matchResult`, and the wiring overlap is significant.

**Wireframe reference:** `docs/wireframes/phase_8/phase_8_system_prototype_v5.html` — Recipe tab. The structural pattern (inline below-row tap-sheet, primary + secondary actions, banner-at-top) is still authoritative. The ingredient-row visual has evolved post-CP2 (4-level matcher) — **DO NOT re-implement or restyle the ingredient row**; CP3 only adds tap behavior and the banner.

---

## Inputs to read

**Architectural (read first):**
1. `docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md` — CP3 design notes in the planning section. Note: this doc carries some pre-8R framing in older sections; treat the substantive decisions (D6-18 implementation, action sets per state) as authoritative, but newer architecture lives in the CP2 results subsection.
2. `docs/PHASE_8D_PLANNING.md` — historical reference only. CC has flagged this as carrying pre-8R framing; this CP3 prompt supersedes any conflicting framing from that doc. Read for D6-18 background and the test inventory.
3. `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` — context on the L2/L3 visual layer and the whitelist. CP3 doesn't change this layer; just provides tap interaction on top of it.
4. `docs/wireframes/phase_8/phase_8_system_prototype_v5.html` — Recipe tab. Reference for the inline tap-sheet pattern (tap row → sheet below → tap same row or another row to dismiss/switch).

**Code-level (verify shapes against current state — code has changed post-CP2):**

5. **`lib/services/pantryMatchingService.ts`** — the post-CP2-patch matcher. Public API:
   - `calculateRecipeSupplyMatch(recipeId, spaceId): Promise<PantryMatchResult>`
   - `calculateRecipeSupplyMatchBulk(recipeIds, spaceId): Promise<Map<string, PantryMatchResult>>`
   - Current `MatchedIngredient` shape: `{ ingredientId, supplyId: string | null, level: MatchLevel, formMismatch: {recipeForm: string|null, supplyForm: string|null}|null, reason: string }`
   - `MatchLevel = 'exact' | 'form_variant' | 'substitute' | 'always_available'`
   - `PantryMatchResult.missing: string[]` is the L4 ingredient_ids; `PantryMatchResult.matched[]` is everything else
6. **`lib/services/needsService.ts`** — `addNeedFromRecipe` already exists and is wired correctly. Signature:
   ```typescript
   addNeedFromRecipe({
     spaceId, ingredientId, quantityDisplay, unitDisplay, addedBy,
     recipeId, recipeQuantityAmount, recipeQuantityUnit, tagIds
   }): Promise<NeedWithDetails>
   ```
   It writes the need (with `addedFrom='recipe'`), creates the `needs_recipes` junction row, and applies tag IDs. **`needs.priority_reason` does NOT exist as a column** — attribution is via `needs_recipes`; urgency is via tags. CC: do NOT add a `priority_reason` column; use this signature as-is.
7. **`components/AddRecipeToNeedsModal.tsx`** — existing modal. Has a `mode: 'missing' | 'all'` prop. Currently invoked from `IngredientsSection.tsx`'s "+ Add N missing →" / "+ Add all N" buttons.
8. **`components/SupplyCreateSheet.tsx`** — existing sheet. Lift open state up to RecipeDetailScreen for the "Add to supplies" tap-sheet action.
9. **`components/recipe/IngredientsSection.tsx`** — host. Post-CP2 it consumes `ingredientMatches: Map<string, MatchedIngredient>`. CP3 modifies: rows become tappable, tap-sheet renders inline below the tapped row, "+ Add N missing →" modal-open lifts up.
10. **`screens/RecipeDetailScreen.tsx`** — parent. Already holds `matchResult` (post-CP1) and derives `ingredientMatches` Map for IngredientsSection (post-CP2). CP3 adds the banner, lifts modal state up, adds `focusedStepIndex` ref for step scroll.
11. **`lib/services/cookingService.ts`** — look for `mapIngredientsToSteps` (or equivalent). Used by the "Which step?" action to identify which prep step references the tapped ingredient.
12. **`components/recipe/PreparationSection.tsx`** — verify if it accepts a `focusedStepIndex` prop or has an internal scroll mechanism that can be triggered from the parent. **STOP and report** if no such mechanism exists; we'll need to either add scroll-to-step or downgrade the "Which step?" action to a placeholder Alert for v0.
13. **`screens/SupplyDetailScreen.tsx`** — has a `handleFindRecipes` function that's the canonical pattern for cross-stack navigation from a detail surface to a filtered RecipeList. Mirror that pattern for the "Other recipes" tap-sheet action.
14. **`contexts/SpaceContext.tsx`** — `useActiveSpaceId` for the need creation flow.
15. **`lib/services/tagsService.ts`** — `getOrCreateTag` for the `urgency:this-week` tag.

**Schema verification (read-only sanity check):**
- `needs` columns (verify via the schema CSV or `lib/types/needs.ts`): `id, space_id, ingredient_id, custom_name, status, quantity_display, unit_display, for_user_ids, supply_id, added_by, added_from, notes, created_at, updated_at`. No `priority_reason`.
- `needs_recipes` junction exists with `(need_id, recipe_id, recipe_quantity_amount, recipe_quantity_unit, added_by, created_at)`.
- `tags.dimension` enum includes `'urgency'`; common urgency values: `'today'`, `'this-week'`, `'this-month'`.

If anything contradicts the above, **STOP and report** in SESSION_LOG.

---

## Task

Execute Part 0 → Part G in order. Single fused commit when done; the work is tightly coupled.

### Preservation Contract — what MUST stay unchanged

CP3 is **strictly additive** at the visual layer. Post-CP2, the recipe surface visual design is locked for F&F. CP3 wires interactivity on top of that surface; it does not change how anything currently looks.

The following elements must be byte-identical (or pixel-identical at render time) before and after CP3:

**`IngredientsSection.tsx` row visual:**
- Row format: `[indicator] qty unit **ingredient name**, preparation`
- Indicator glyphs: green `✓` for L1/always_available, yellow `⚠` for L2 form_variant, yellow `≈` for L3 substitute, red missing for L4
- Sub-line copy (when present): "Close: you have X" for L3; "you have Y; recipe wants Z" for L2
- Group headers (when displayed)
- Section header: `INGREDIENTS [count/total]` in teal
- Black accent line under section header
- Vertical spacing between rows
- Font sizes and weights
- Color tokens (anything currently hardcoded as hex stays exactly as that hex)

**`IngredientsSection.tsx` button visual:**
- "+ Add N missing →" — teal-bordered button, full-width, centered text, exact same copy and styling
- "+ Add all N" — gray text link below, exact same copy and styling
- Position relative to the ingredient list and section bottom

**Behavioral preservation:**
- Tapping "+ Add N missing →" still opens `AddRecipeToNeedsModal` with `mode='missing'`
- Tapping "+ Add all N" still opens `AddRecipeToNeedsModal` with `mode='all'`
- Modal still receives the same ingredients, recipe, scale, spaceId props as before
- Modal still closes the same way

**What CHANGES (additive only):**
- Rows become tappable (no visual treatment beyond `activeOpacity={0.7}` press-down opacity flicker)
- Inline tap-sheet appears below tapped row (new UI element; doesn't modify the row it appears under)
- Match % banner appears above the section (new UI element; doesn't modify the section)
- `MatchedIngredient` gains a `supplyStatus` field (additive type extension)
- Modal state ownership moves from `IngredientsSection` to `RecipeDetailScreen` (plumbing only; user-visible behavior identical)

If during execution CC notices itself making a change that would alter any of the preserved elements above, **STOP and report**. Do not adjust spacing, padding, colors, or copy to "match" the new tap-sheet or banner — the new elements adapt to the existing surface, not the other way around.

### Part 0 — Pre-flight doc updates

Three small T-items to add to `docs/DEFERRED_WORK.md` and one gap section to append to `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md`. All entries pre-authored — insert verbatim into the appropriate sections.

**T27 — Smoke harness contamination fix** (append to Cross-Cutting Technical Debt table):
```
| T27 | 2026-05-19 | Smoke harness contamination | The discovery-based smoke harness creates synthetic recipes pointing at real catalog ingredients but the matcher queries Tom's real supplies. Scenarios needing controlled "user doesn't have X" or "user has only the synthetic supply X" states can't isolate when Tom stocks the real ingredient (salt/flour/rice). Fix options: (a) supply-state stubbing in harness, (b) targeted scenarios using intrinsically unstocked singleton-subtype ingredients (asafetida, sumac, etc.), (c) full test-isolation refactor with synthetic catalog rows (blocked by RLS). Post-F&F. |
```

**T28 — `whole grain mustard` vs `whole-grain mustard` duplicate** (append):
```
| T28 | 2026-05-19 | Catalog singular/plural and hyphen dedup | Catalog has two near-identical mustard rows differing only by hyphen — `whole grain mustard` and `whole-grain mustard`, both subtype='mustard' form='paste'. Cosmetic cruft from inconsistent recipe extraction. Likely other variants exist (Fresno/fresno, jalapeño/jalapeno pepper, cheddar/cheddar cheese, eggs/egg, etc.). Bundle with G1 subtype audit when subtypes are split. Post-F&F. |
```

**T29 — Smoke harness expectation realignment + obsolete evoo-linkage cleanup** (append):
```
| T29 | 2026-05-19 | Smoke harness expectation cleanup post-CP2-patch | Four scenarios have stale expectations: L2a (black pepper vs peppercorns), L3a (basmati/jasmine), L3c (chicken broth/stock), WL8 (pepper form-variant) all expect L2/L3 but now collapse to silent L1 because the null-form wildcard rule fires (one side has form=NULL — e.g., generic mustard set to paste during the 2026-05-19 form-hygiene round but other generics still NULL). Realign by picking pairs where both forms are genuinely non-null. Also drop the obsolete SMOKE-CATALOG-evoo-linkage assertion (post-D8D-Q19, EVOO and olive oil are each their own base). Post-F&F polish. |
```

**G7 — Multi-candidate substitution surfacing** (append to `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` immediately after the existing G6 section):
```markdown
### G7 — Multi-candidate substitution surfacing

When multiple supplies satisfy the same substitution match (e.g. recipe wants white wine vinegar; user has apple cider + red wine + sherry vinegars — all subtype='vinegar', form='liquid' → all L3 candidates), the matcher currently picks one supply via `pickBestSupply` (most recent by `supplies.created_at` DESC, tie-break by `id`). The other matching supplies are invisible to the user.

Future work:
- (a) Surface all candidates in the ingredient row's sub-line (UI complexity tradeoff — single line vs expanded affordance)
- (b) Pick based on similarity rather than recency (requires per-pair substitution metadata or AI scoring — adjacent to G2/G3)

For F&F, recency is a defensible heuristic (most recent = front of mind = likely still in stock). Touches both matcher (similarity ranking) and UI (rendering multiple candidates without crowding).
```

**Additivity principle** (append as a new top-level section to `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md`, immediately after the "Realistic ambition" section, before "Editing the whitelist post-F&F"):
```markdown
## Additivity principle for the post-CP2 recipe surface

Post-CP2 (4-level matcher + substitution whitelist + null-form wildcard), the visual design of the recipe ingredient surface is locked for F&F. Subsequent checkpoints in Phase 8D (CP3 tap-sheet, CP4 What-can-I-cook, CP5 banner-bundled-with-CP3) and beyond add interactivity, navigation, and net-new surfaces — they do NOT modify the existing row visual, sub-line copy, button styling, section header, or spacing.

This is a design discipline, not a hard schema constraint:
- The 4-level visual (✓ green / ⚠ yellow form variant / ≈ yellow substitute / red missing) is the F&F design contract.
- L2/L3 sub-line copy ("Close: you have X", "you have Y; recipe wants Z") is the F&F authoritative phrasing.
- The "+ Add N missing →" button and "+ Add all N" link styling and copy are F&F locked.
- Tap targets, new tap-sheets, banners, modals, and navigation pushes are all additive — they appear alongside or above the existing surface without restyling it.

Future visual changes (subtype audit-driven L3 visibility expansion, multi-candidate display, substitution rationale copy) are explicitly post-F&F and will be planned as a single coordinated visual revision, not piecemeal during interactivity checkpoints.

Rationale: the F&F testers will give us signal on whether the current visual reads correctly. Changing it mid-stream confounds the signal. Once we have feedback on the locked design, we revisit deliberately.
```

### Part A — `IngredientTapSheet.tsx` component

**Create:** `components/recipe/IngredientTapSheet.tsx` — a new presentational component, rendered inline by `IngredientsSection` below the tapped row.

**Props:**
```typescript
type TapSheetState =
  | 'matched_in_stock'    // matchedSupply.status === 'in_stock', level ∈ {exact, form_variant, substitute}
  | 'matched_low'         // matchedSupply.status === 'low'
  | 'matched_critical'    // matchedSupply.status === 'critical'
  | 'missing';            // ingredient is in matchResult.missing[]

interface IngredientTapSheetProps {
  ingredient: {
    id: string;
    name: string;
    quantity_display: string;   // already-formatted, e.g. "2 tbsp"
    preparation: string | null; // e.g. "chopped"
    form: string | null;        // recipe's form
  };
  state: TapSheetState;
  matchedSupply: {
    id: string;
    custom_name: string | null;
    quantity_amount: number | null;
    quantity_unit: string | null;
    status: SupplyStatus;       // 'in_stock' | 'low' | 'critical' (matched only)
    name: string;               // catalog name for display
  } | null;                     // null for missing state
  recipeId: string;
  spaceId: string;
  userId: string;
  onClose: () => void;
  onAddNeed: () => void;        // RecipeDetailScreen-level callback for toast/refresh
  onOpenSupplyCreate: () => void; // Lift state — actually opens SupplyCreateSheet at parent
  onScrollToStep: (stepIndex: number) => void; // for "Which step?" — see Part B
  onNavigateToOtherRecipes: () => void;        // for "Other recipes" — see Part B
  onActionFired: (action: string, result: 'success' | 'error', errorMessage?: string) => void;
}
```

**Note: all matched levels (exact / form_variant / substitute) collapse to the same `TapSheetState`** based on supply status. The L2/L3 inline indicators in `IngredientsSection` already carry the form-variant or substitute information visible to the user. The tap-sheet does not repeat or restate the level — it shows the matched supply (if any), the recipe quantity, and the actions.

**`always_available` rows are not handled by this component** — see Part B for how `IngredientsSection` skips tap behavior on those rows.

**Layout (matches v5 wireframe structure):**

```
┌─────────────────────────────────────────┐
│ Ingredient name             [state pill] │
│ 2 tbsp chopped                           │
│                                          │
│ [matched only:]                          │
│ You have: [supply name] (X qty)          │
│                                          │
│ [Primary action button]                  │
│ [Secondary] [Secondary] [Secondary]      │
└─────────────────────────────────────────┘
```

The state pill renders the current state in small text (e.g. "in stock" green, "low" amber, "missing" red). No form-mismatch sub-line in the tap-sheet — that's already visible on the inline row.

**Actions per state:**

| State | Primary | Secondary actions |
|---|---|---|
| `matched_in_stock` | See more | Update qty · Which step? · Other recipes |
| `matched_low` | + Need now | See more · Update qty · Which step? |
| `matched_critical` | + Need now | See more · Update qty · Which step? |
| `missing` | + Need now | Substitute · Add to supplies · See more |

**Action handlers:**

- **+ Need now:**
  1. Resolve the `urgency:this-week` tag ID via `tagsService.getOrCreateTag({spaceId, dimension: 'urgency', value: 'this-week'})`.
  2. Parse the recipe's `quantity_display` into `quantityDisplay` (string for `needs.quantity_display`) and split out unit if needed.
  3. Call `addNeedFromRecipe({spaceId, ingredientId: ingredient.id, quantityDisplay, unitDisplay, addedBy: userId, recipeId, recipeQuantityAmount, recipeQuantityUnit, tagIds: [urgencyTagId]})`.
  4. On success: call `onAddNeed()` (parent shows toast "Added to needs · this week"), close tap-sheet via `onClose()`.
  5. On error: surface `Alert.alert('Could not add to needs', err.message)`; do NOT close.
  6. `onActionFired('add_need_now', 'success' | 'error', errMsg)`.

- **See more:** v0 placeholder — `Alert.alert('Ingredient detail coming soon', ingredient.name)`. Ingredient Detail screen is post-F&F. Fire `onActionFired('see_more', 'success')`.

- **Update qty:** v0 placeholder — `Alert.alert('Update qty coming soon')`. Proper modal lands post-F&F. `onActionFired('update_qty', 'success')`.

- **Which step?:** Call `cookingService.mapIngredientsToSteps(recipeId)` (or equivalent — verify the actual function name during reading pass). If the ingredient appears in any step, take the first step index and call `onScrollToStep(stepIndex)`. Then `onClose()`. If no step references the ingredient: `Alert.alert('Used in this recipe, but not tied to a specific step')` and stay open. `onActionFired('which_step', 'success' | 'error')`.

- **Other recipes:** Call `onNavigateToOtherRecipes()` — parent handles the cross-stack navigation per the SupplyDetailScreen pattern. Close tap-sheet. `onActionFired('other_recipes', 'success')`.

- **Substitute:** v0 placeholder — `Alert.alert('Substitutions coming soon')`. Real substitution suggestions are post-F&F (covered by G2/G3/G5 in SUBSTITUTION_INTELLIGENCE_ROADMAP). `onActionFired('substitute', 'success')`.

- **Add to supplies:** Call `onOpenSupplyCreate()` — parent opens `SupplyCreateSheet` pre-populated with the ingredient. Close tap-sheet. `onActionFired('add_to_supplies', 'success')`.

**Styling:**
- Background: light fill (use existing theme tokens; check what AddNeedSheet or similar bottom-sheet components use). Slight border-top to visually separate from the row above.
- Primary action: solid button, primary color.
- Secondary actions: text buttons, primary color, ~14pt.
- State pill: small rounded badge, color per state (green/amber/red), uppercase 11pt text.

### Part B — `IngredientsSection.tsx` integration

1. **Tap target:** Wrap each ingredient row (except always_available rows) in `TouchableOpacity` with `activeOpacity={0.7}` and **NO other visual treatment**. No background color change, no border, no padding adjustment, no margin change, no font-weight change, no hover state. The row visual is byte-identical to today's render; the only indication of tap behavior is the brief opacity flicker on press-down. **STOP and report** if implementing the wrapper requires any spacing or styling adjustment to render correctly — that's a sign the wrapper structure is wrong, not the surface.

2. **Open-state management:** Add a local state `expandedIngredientId: string | null` in `IngredientsSection`. Tap a row:
   - If `expandedIngredientId === ingredient.id` → set to `null` (collapse same row).
   - Else → set to `ingredient.id` (switch or open).
   
3. **Inline tap-sheet render:** Immediately after rendering an ingredient row, if `expandedIngredientId === ingredient.id`, render the `<IngredientTapSheet>` directly below. NOT inside a Modal/Overlay — render as a sibling element in the list flow so it pushes subsequent rows down.

4. **Derive `TapSheetState` from `ingredientMatches` + supply status:**
   - If `ingredientMatches.get(id)` is undefined → `'missing'` (the ingredient is in `matchResult.missing[]`)
   - If `ingredientMatches.get(id).level === 'always_available'` → no tap-sheet, row non-tappable
   - Else (level ∈ exact/form_variant/substitute), look up the matched supply's status. **This requires `MatchedIngredient.supplyStatus` to be populated by the matcher** — see Part B.5 below.
   - Map `supplyStatus` to state: `in_stock → matched_in_stock`, `low → matched_low`, `critical → matched_critical`.

5. **Extend `MatchedIngredient` with `supplyStatus`:** in `lib/services/pantryMatchingService.ts`, add `supplyStatus: SupplyStatus | null` to the `MatchedIngredient` interface. Populate it in the assembly loop:
   - For L1/L2/L3 matched results: `supplyStatus = satisfyingSupply.status`
   - For always_available: `supplyStatus = null`
   - For L4 missing: ingredient doesn't appear in `matched[]` at all
   
   **This extension is purely additive.** Existing consumers (RecipeListScreen, the matcher's own internal logic) don't read `supplyStatus`. Adding the field does not change any existing field's type, default, or shape. **STOP and report** if making this work requires:
   - Refactoring any other field on `MatchedIngredient` (e.g., changing `level`, `reason`, or `formMismatch` shapes)
   - Changing the `PantryMatchResult` interface
   - Modifying the 3-query bulk structure
   - Adding any new Supabase query
   
   The supply status is already in the existing supply query result. Just plumb it through. This is **Option A** from the v1 prompt — confirmed as the right call.

6. **Lift modal-open state for `AddRecipeToNeedsModal`:** the existing "+ Add N missing →" and "+ Add all N" buttons in IngredientsSection currently manage their own modal state. Lift this up to `RecipeDetailScreen` so the banner (Part C) and the existing buttons all open the same instance.

   **Behavioral preservation requirements (user POV is unchanged):**
   - "+ Add N missing →" still opens the modal with `mode='missing'`
   - "+ Add all N" still opens the modal with `mode='all'`
   - The modal still receives the same `recipe`, `ingredients`, `scale`, `spaceId` props as today
   - The modal still closes the same way (Cancel, Add, backdrop tap)
   - The button visual (teal-bordered "+ Add N missing →", gray "+ Add all N" link) is unchanged
   - The button position relative to the ingredient list is unchanged
   
   **Plumbing:** IngredientsSection receives a new prop `onOpenNeedsModal: (mode: 'missing' | 'all') => void`. The "+ Add N missing →" button calls `onOpenNeedsModal('missing')`. The "+ Add all N" button calls `onOpenNeedsModal('all')`. IngredientsSection no longer owns modal `visible` state. RecipeDetailScreen owns the state and renders the modal.

7. **Lift modal-open state for `SupplyCreateSheet`:** the tap-sheet's "Add to supplies" action needs to open SupplyCreateSheet at the RecipeDetailScreen level (not nested inside the tap-sheet). Add `onOpenSupplyCreate: (ingredient: Ingredient) => void` prop to IngredientsSection; pass through to IngredientTapSheet.

8. **Add `onScrollToStep` and `onNavigateToOtherRecipes` props** to IngredientsSection; pass through to IngredientTapSheet. Implementation lives in Part C.

### Part C — `RecipeDetailScreen.tsx` integration + match % banner

1. **Match % banner:** Render directly below the recipe header (above the IngredientsSection accent line), only when:
   - `matchResult !== null` AND
   - `matchResult.matchPercentage < 1.0` AND
   - `matchResult.missing.length > 0`
   
   Content: `"{XX}% in pantry · {N} missing →"` where XX = `Math.round(matchResult.matchPercentage * 100)`, N = `matchResult.missing.length`.
   
   Visual: rounded box, primary color (teal) border 1pt, primary color text, centered horizontally, ~14pt, tappable. Padding 12pt vertical, 16pt horizontal. Margin-top 8pt, margin-bottom 12pt.
   
   Tap → opens `AddRecipeToNeedsModal` with `mode='missing'`.

2. **Lift `AddRecipeToNeedsModal` to RecipeDetailScreen:** Add state `needsModalMode: 'missing' | 'all' | null`. Render `<AddRecipeToNeedsModal visible={needsModalMode !== null} mode={needsModalMode ?? 'all'} ...other props />`. Open from banner tap (set to 'missing') and from IngredientsSection's existing button via the `onOpenNeedsModal` callback.

3. **Lift `SupplyCreateSheet` to RecipeDetailScreen:** Add state `supplyCreateInitial: {name, ingredientId} | null`. Render the sheet at this level. Open from IngredientsSection's `onOpenSupplyCreate` callback (which receives the ingredient and sets the initial state).

4. **`onScrollToStep` handler:** Pass a callback to IngredientsSection. Implementation: if `PreparationSection` accepts a `focusedStepIndex` prop or has a scroll mechanism, call it with the index. **If `PreparationSection` has no such mechanism, STOP and report** — we'll either add one or downgrade "Which step?" to a placeholder Alert for v0. Either way, "Which step?" is a real interaction in v1 and should not silently fail.

5. **`onNavigateToOtherRecipes` handler:** Mirror `SupplyDetailScreen.tsx`'s `handleFindRecipes` pattern. Specifically: navigate to `Recipes` stack with a screen + params for ingredient-filtered RecipeList. Use the existing `initialIngredientFilter` (or whatever the established param is — verify during reading) on RecipeList's params. **If the pattern doesn't match cleanly between SupplyDetail and RecipeDetail, STOP and report** the diff.

6. **Toast on add-need success:** When `onAddNeed` fires from the tap-sheet, show a toast: "Added to needs · this week." Use the existing `SpawnOnOutToast` pattern (referenced in `setSupplyStatus` in pantry flows) or `useSpawnOnOutToast` context — confirm during reading which toast surface is appropriate here.

### Part D — Console.warn instrumentation

The `onActionFired` callback at the RecipeDetailScreen level should funnel into:

```typescript
console.warn('[IngredientTapSheet] action', {
  action: '...',                  // see Part A
  ingredientId,
  ingredientName,
  state,                          // TapSheetState
  recipeId,
  result: 'success' | 'error',
  errorMessage: errorMessage || undefined,
});
```

Mark for removal at the end of 8D phase-completion cleanup pass (standard pattern).

### Part E — Smoke tests

CP3 is largely UI; mechanical smoke tests are minimal. Add **one** scenario to `lib/services/_pantryMatchingSmokeTest.ts` to confirm `MatchedIngredient.supplyStatus` is populated:

```
SMOKE-CP3-S1  Recipe needs X, user has X at status='in_stock'
              → expect matched[meta.id].supplyStatus === 'in_stock'
SMOKE-CP3-S2  Same but status='low'
              → expect matched[meta.id].supplyStatus === 'low'
```

Run all SMOKE-CP1, SMOKE-CP2, SMOKE-CP2-WL/NF, and SMOKE-CP3 scenarios; report pass/fail tally.

### Part F — Doc updates

1. **`docs/FRIGO_ARCHITECTURE.md`:** Add `components/recipe/IngredientTapSheet.tsx` to the components map. Add a 1-2 line note on the tap-sheet pattern (inline render, state-driven actions).

2. **`docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md`:** Add CP3 results subsection. Mark CP3 status COMPLETE with date. Note CP5 bundled-and-shipped here. Files modified, key decisions (the "all matched levels share tap-sheet" decision, the always_available non-tappable decision, the Option A `supplyStatus` extension).

3. **`docs/DEFERRED_WORK.md`:** Mark D6-18 (Phase 6G deferred) as ✅ RESOLVED — implemented by CP3. T27-T29 added (Part 0). Changelog bump.

4. **`docs/PROJECT_CONTEXT_2026-05-15.md`:** Phase 8D-CP3 status flip from in-progress to ✅. CP5 noted as bundled.

5. **`docs/FF_LAUNCH_MASTER_PLAN_2026-05-15.md`:** Mark 8D-CP3 + CP5 complete in the phase table.

6. **`docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md`:** G7 added (Part 0). Additivity principle section added (Part 0).

7. **`docs/SESSION_LOG.md`:** Append the CP3 entry below today's (2026-05-19) existing entries.

### Part G — Stage updated docs to `_pk_sync/`

Copy all modified docs:

```bash
cp docs/FRIGO_ARCHITECTURE.md _pk_sync/FRIGO_ARCHITECTURE_2026-05-19.md
cp docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md _pk_sync/PHASE_8_PANTRY_AND_GROCERY_2026-05-19.md
cp docs/DEFERRED_WORK.md _pk_sync/DEFERRED_WORK_2026-05-19.md
cp docs/PROJECT_CONTEXT_2026-05-15.md _pk_sync/PROJECT_CONTEXT_2026-05-19.md
cp docs/FF_LAUNCH_MASTER_PLAN_2026-05-15.md _pk_sync/FF_LAUNCH_MASTER_PLAN_2026-05-19.md
cp docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md _pk_sync/SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-19.md
cp docs/SESSION_LOG.md _pk_sync/SESSION_LOG_2026-05-19.md
```

Overwrite if today-dated copies already exist.

---

## Constraints

- **DO NOT touch the ingredient row visual.** The 4-level rendering (✓ green / ⚠ yellow / ≈ yellow / red missing) is CP2's territory. CP3 only adds tap behavior on top of the existing rows.
- **DO NOT collapse the L2/L3 inline indicators into the tap-sheet.** The inline indicators stay; the tap-sheet shows the matched supply + actions, not the level.
- **DO NOT add `priority_reason` to the `needs` table.** Attribution flows through the existing `needs_recipes` junction. CC: use `addNeedFromRecipe` as-is.
- **DO NOT change the 3-query bulk matcher structure.** Adding `supplyStatus` to `MatchedIngredient` is a single-field extension, populated from the existing supply query — no extra queries.
- **DO NOT make always_available rows tappable.** They render the same as L1 exact green ✓ but no tap interaction.
- **Tap-sheet renders INLINE below the tapped row.** Not bottom-overlay, not popover, not navigation push. Wireframe v5 explicitly chose this pattern.
- **One tap-sheet open at a time.** Tapping different row closes the previous and opens the new one.
- **Reuse `AddRecipeToNeedsModal` and `SupplyCreateSheet`.** No new modals for those flows.
- **Services own all Supabase calls.** Tap-sheet calls `addNeedFromRecipe` (service), not Supabase directly.
- **STOP and report** on: schema mismatch, missing prop pattern in upstream components, missing scroll mechanism in PreparationSection, ambiguous cross-stack navigation pattern, downstream breakage from `supplyStatus` extension.
- **Do NOT commit.** Leave working tree modified; Tom batches.

---

## Verification

```bash
# 1. TypeScript clean
npx tsc --noEmit
# Expect: 0 new errors

# 2. IngredientTapSheet exists with expected exports
ls -la components/recipe/IngredientTapSheet.tsx
grep -c "export default" components/recipe/IngredientTapSheet.tsx
# Expect: 1

# 3. IngredientsSection imports + uses IngredientTapSheet
grep -c "IngredientTapSheet" components/recipe/IngredientsSection.tsx
# Expect: at least 2 hits (import + JSX use)

# 4. supplyStatus added to MatchedIngredient
grep "supplyStatus" lib/services/pantryMatchingService.ts | head -5
# Expect: type declaration + assignment in assembly loop

# 5. Match % banner present in RecipeDetailScreen
grep "in pantry" screens/RecipeDetailScreen.tsx
# Expect: at least 1 hit (the banner copy)

# 6. AddRecipeToNeedsModal lifted to RecipeDetailScreen
grep "AddRecipeToNeedsModal" screens/RecipeDetailScreen.tsx
# Expect: at least 1 hit (the modal render)
grep "AddRecipeToNeedsModal" components/recipe/IngredientsSection.tsx
# Expect: 0 hits (modal no longer lives in IngredientsSection)

# 7. T27/T28/T29 + G7 captured
grep -c "^| T27 \|^| T28 \|^| T29 " docs/DEFERRED_WORK.md
# Expect: 3
grep "G7 — Multi-candidate" docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md
# Expect: 1 hit

# 8. _pk_sync/ has all 7 staged docs
ls _pk_sync/ | grep "2026-05-19" | wc -l
# Expect: at least 7
```

**Manual verification (Tom runs separately):**

**Visual regression check (run FIRST, before functional checks):**

Before firing this CC prompt, Tom takes a screenshot of Sweet Winter Slaw's recipe detail screen on a fresh app launch. After CP3 ships, Tom takes a second screenshot of the same recipe in the same scroll position. The two screenshots must match for every visual element in the ingredient list:

- Each row's indicator glyph (✓ / ⚠ / ≈ / missing) — identical color, identical character
- Each row's font weight on the ingredient name (bold) — identical
- Each row's sub-line copy (when present) — identical text, identical color (the L2/L3 amber sub-line)
- Vertical spacing between rows — identical
- INGREDIENTS header position and styling — identical
- Black accent line — identical
- "+ Add N missing →" button — identical (teal border, full-width, centered text, same copy)
- "+ Add all N" link — identical (gray text, same copy, same position)

The ONLY differences should be:
- A new match % banner above the section (new element; does not displace existing elements)
- New elements (tap-sheet) appearing only when the user taps a row

If any pre-existing element has shifted, restyled, or recolored, CP3 has regressed — revert and investigate.

**Functional checks (after visual regression passes):**

- Open a recipe with mixed pantry state. Confirm:
  - Tap a green ✓ matched row → inline sheet appears below with "See more" primary + 3 secondary actions
  - Tap a yellow ⚠ (L2 form variant) row → sheet appears, same actions as L1 (matched_in_stock state)
  - Tap a yellow ≈ (L3 substitute) row → sheet appears, same actions
  - Tap a red missing row → sheet appears with "+ Need now" primary
  - Tap a row with low/critical supply → "+ Need now" primary instead of "See more"
  - Tap water/ice row → nothing happens (non-tappable)
  - Tap same row twice → sheet dismisses
  - Tap different row → sheet switches in-place
  - "+ Need now" → toast appears, sheet closes, need shows up in Pantry tab → Needs view (verify the urgency:this-week tag is set and the recipe is attributed via needs_recipes)
  - "Add to supplies" → sheet closes, SupplyCreateSheet opens pre-populated
  - "Which step?" → page scrolls to the right step in the prep section
  - "Other recipes" → navigates to filtered RecipeList
- Match % banner shows when matchPercentage < 100%, hides when 100%
- Banner tap → opens AddRecipeToNeedsModal in mode='missing'
- "+ Add N missing →" button (still in IngredientsSection) → opens same modal in mode='missing' (behavior identical to pre-CP3)
- "+ Add all N" button → opens modal in mode='all' (behavior identical to pre-CP3)

---

## SESSION_LOG entry format

```markdown
### CC: Phase 8D CP3 — recipe tap-sheet + match % banner (D6-18, CP5 bundled) — [DONE or PARTIAL]

**Prompt:** `CC_PROMPT_2026-05-19_8D_CP3_recipe_tapsheet_v2.md`
**Files modified:**
- components/recipe/IngredientTapSheet.tsx (NEW, ~XXX lines)
- components/recipe/IngredientsSection.tsx (tap behavior + tap-sheet inline render + modal lift)
- screens/RecipeDetailScreen.tsx (match % banner + AddRecipeToNeedsModal lift + SupplyCreateSheet lift + step-scroll + cross-stack nav handler)
- lib/services/pantryMatchingService.ts (supplyStatus added to MatchedIngredient)
- lib/services/_pantryMatchingSmokeTest.ts (+SMOKE-CP3-S1/S2 scenarios)
- docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md (G7 added)
- docs/PHASE_8_PANTRY_AND_GROCERY_2026-05-15.md (CP3 results subsection)
- docs/DEFERRED_WORK.md (T27, T28, T29 added; D6-18 resolved)
- docs/FRIGO_ARCHITECTURE.md (IngredientTapSheet added to component map)
- docs/PROJECT_CONTEXT_2026-05-15.md (8D-CP3 status flip)
- docs/FF_LAUNCH_MASTER_PLAN_2026-05-15.md (8D-CP3 + CP5 marked complete)
**Files staged in _pk_sync/:** [list]
**Resolved deferred items:** D6-18 (Phase 6G tap-to-see-steps). T27-T29 added; G7 added to ROADMAP.
**Smoke test result:** [X / total pass — details on any failures]
**Notes:**
- Pattern decisions: [confirm Option A — supplyStatus extension — landed cleanly; or report if any downstream issues surfaced]
- STOP conditions: [whether any triggered — PreparationSection scroll mechanism, cross-stack nav pattern, etc.]
- Wireframe ambiguities: [any decisions made under ambiguity, with the chosen interpretation]
```

---

## Suggested commit message (Tom may use when batching)

```
feat(8D-CP3): recipe ingredient tap-sheet + match % banner

Implements D6-18 (deferred from Phase 6G).

- IngredientsSection rows are now tappable. Tap → inline tap-sheet
  appears below the row with state-appropriate actions.
- All matched levels (L1/L2/L3) share identical tap-sheet behavior;
  the inline indicators carry the L2/L3 distinction.
- always_available rows (water, ice) are non-tappable.
- Match % banner at the top of RecipeDetailScreen when match < 100%
  → opens AddRecipeToNeedsModal in mode='missing'. CP5 bundled.
- MatchedIngredient extended with supplyStatus (Option A). Powers
  the matched_in_stock vs matched_low/critical state distinction.
- Modal state for AddRecipeToNeedsModal and SupplyCreateSheet lifted
  to RecipeDetailScreen so banner + existing button + tap-sheet all
  share one instance.

Strictly additive at the visual layer: existing row visual, sub-line
copy, "+ Add N missing →" / "+ Add all N" buttons, section header, and
spacing are byte-identical to pre-CP3 render. Bisectable from CP2 if
visual regression surfaces.

T27 (smoke harness contamination), T28 (catalog hyphen/plural dedup),
T29 (smoke expectation cleanup) captured in DEFERRED_WORK. G7
(multi-candidate substitution surfacing) added to ROADMAP, plus
additivity-principle section codifying the post-CP2 design discipline.

Resolves D6-18.
```

**Bisectability note:** CP3 should land as a single fused commit (or at most two: matcher `supplyStatus` extension + everything else). Keep separate from the CP2 patch commit so `git bisect` can isolate the visual layer (CP2) from the interactivity layer (CP3) if regression surfaces later. If CC's diff naturally separates "matcher field add" from "UI changes," two commits are fine; otherwise one fused commit is acceptable.

---

## After CP3 ships

CP3 + CP5 = closes the recipe → pantry feedback loop for F&F.

**Next:** CP4 — What-can-I-cook screen (~1 session). Spin up as a new planning session. The PHASE_8 doc and PHASE_8D_PLANNING have CP4 specs already; a fresh planning instance can write the prompt directly.

**Phase-completion cleanup** (queued for end of 8D):
- Remove `console.warn` instrumentation from IngredientTapSheet (Part D)
- T29 smoke harness expectation realignment
- T27 harness contamination fix (lower priority)
- PHASE_8D_PLANNING.md refresh to remove pre-8R framing
- PK_CODE_SNAPSHOTS.md revert/refresh decision (still pending from CP2)
