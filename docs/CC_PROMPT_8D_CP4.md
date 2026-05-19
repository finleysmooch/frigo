# CC_PROMPT_8D_CP4 — What-can-I-cook screen

**Phase:** 8D — Recipe-pantry matching
**Estimated:** ~1 session
**F&F-blocker:** Yes — "What can I cook with what I have" is stated F&F success criterion
**Authored by:** Claude.ai planning, 2026-05-18
**Depends on:** CC_PROMPT_8D_CP1 shipped — `pantryMatchingService.ts` with `calculateRecipeSupplyMatchBulk` exists.

---

## Context

CP4 is the headline utility surface of Phase 8D — the "what can I cook with what I have" screen. After CP1's matching primitive lands, CP4 puts a filtered recipe list in front of the user showing only recipes that are genuinely ready to cook given their current supplies.

Per locked decision D8D-Q3 (collapsed from earlier 5-section design), CP4 ships with a **single "Ready now" section**. Criterion is locked:

- `matchPercentage >= 0.90` AND
- Every ingredient in `recipes.hero_ingredients` is in the recipe's `matched[]` list (NOT in `missing[]`)

Hero ingredients are the recipe's defining ingredients — Phase 3's AI classification stored them in `recipes.hero_ingredients` as a JSONB array of `{ingredient_id, name}` objects. The check ensures we don't surface a recipe as "ready" if the main thing (chicken for a chicken recipe, salmon for a salmon recipe) is missing — even at 90%+ overall match.

Surface: subset-search bar at top, locked filter chip showing "Pantry: 90%+ match", scrollable list sorted by match % descending, empty state when zero recipes qualify, auto-hides when empty.

Reachable from: PantryScreen "What can I cook?" CTA. Possibly Recipes tab entry point — Tom decides post-build.

---

## Inputs to read

**Required (architectural context):**
1. `docs/PHASE_8D_PLANNING.md` — CP4 section, decisions D8D-Q3, D8D-Q7.
2. `docs/wireframes/phase_8/phase_8_system_prototype_v5.html` — What-can-I-cook tab. Note the locked filter chip pattern, subset search, list rendering. (V5 collapsed the earlier 5-section design — single section is correct.)

**Required (code-level inputs):**
3. `lib/services/pantryMatchingService.ts` — the `calculateRecipeSupplyMatchBulk` function CP4 consumes.
4. `lib/services/recipeService.ts` — recipe fetch patterns; how to load the full set of recipes with `hero_ingredients`.
5. `screens/RecipeListScreen.tsx` — reference for recipe card rendering pattern (the existing `renderRecipeCard` function). CP4's screen reuses this rendering or factors out a shared card component if straightforward — see Constraints.
6. `screens/PantryScreen.tsx` — add the "What can I cook?" CTA here.
7. `App.tsx` — navigator config; CP4 adds the new screen to whichever stack houses it.
8. `contexts/SpaceContext.tsx` — `useActiveSpaceId` for the matching query.

**Schema verification (already verified through CP1):**
- `recipes.hero_ingredients` is JSONB array of `{ingredient_id: string, name: string}`. **(needs-verification — confirm shape by reading one or two rows from the recipes table, or by tracing how `availableHeroIngredients` is computed in `RecipeListScreen.tsx`.)**

If `hero_ingredients` is shaped differently or routinely empty: **STOP and report.** The "Ready now" criterion depends on this column being populated.

---

## Task

### Part 1 — Create `screens/WhatCanICookScreen.tsx`

**Structure:**

```typescript
type Props = NativeStackScreenProps<RecipesStackParamList, 'WhatCanICook'>;
//                                  or PantryStackParamList depending on placement decision

export default function WhatCanICookScreen({ navigation }: Props) {
  // Load all recipes
  // Bulk-match against active space
  // Filter to qualifying recipes
  // Render search bar + locked filter chip + list
}
```

**Data flow:**

1. Load all recipes via `recipeService` (the same call `RecipeListScreen` uses). Fields needed: `id`, `title`, `image_url`, `hero_ingredients`, plus whatever the card renderer needs.
2. Call `calculateRecipeSupplyMatchBulk(allRecipeIds, activeSpaceId)`.
3. Filter the recipe list:
   ```typescript
   const qualifying = recipes.filter((recipe) => {
     const result = matchMap.get(recipe.id);
     if (!result) return false;
     if (result.matchPercentage < 0.90) return false;
     // Hero ingredient check: every hero ingredient ID must be in matched[]
     const heroIds = (recipe.hero_ingredients ?? []).map((h) => h.ingredient_id);
     if (heroIds.length === 0) return false; // no defined hero → can't qualify
     const matchedIds = new Set(result.matched.map((m) => m.ingredientId));
     // Hero ingredient match via the same match-group traversal as the matcher itself
     // (Option A: trust pantryMatchingService — if the hero ID appears in `missing[]`, fail; otherwise pass)
     // (Option B: re-resolve match group for each hero ID and check supply availability)
     // ↓ Use Option A — the matcher already did the work. If hero is in missing[], the recipe doesn't qualify.
     return !heroIds.some((heroId) => result.missing.includes(heroId));
   });
   ```
4. Sort qualifying recipes by `matchPercentage` descending. Tiebreaker: alphabetical by title.
5. Apply the subset-search filter (Part 3) on the qualifying set.

**UI elements:**

- **Header:** title "Ready to cook", subtitle "Recipes you can make right now" or similar (cross-reference wireframe v5).
- **Subset search bar:** a `TextInput` filtering qualifying recipes by `title.toLowerCase().includes(query.toLowerCase())`. Subset only — does not search the full recipe corpus.
- **Locked filter chip:** non-removable chip with a lock icon + label "Pantry: 90%+ match". This is the visual marker that the user is in a filtered subset. Style matches the locked-chip pattern in the wireframe v5 (look at the "All recipes" tab for the existing chip styles). Tap should do nothing or show a brief explainer toast — chip is intentionally locked.
- **Recipe list:** reuse the recipe card rendering. Options:
  - **Option A:** Import and reuse `renderRecipeCard` logic from `RecipeListScreen`. Tricky because that function references local state.
  - **Option B:** Extract a `RecipeCard.tsx` component from RecipeListScreen first, then use it in both places. Cleaner long-term but adds refactor cost to CP4.
  - **Option C:** Render a simpler card variant inline in WhatCanICookScreen (image + title + match % + "Cook this" CTA). Faster to ship; less feature parity.
  - **Default to Option C** for CP4 — match the wireframe v5 styling. RecipeListScreen extraction is a separate refactor that can land later. The card here should be:
    - Recipe image (left)
    - Title (top)
    - "Match: {NN}%" badge (small, primary color)
    - Cooking time + servings if available (subtle line)
    - Tap → navigate to RecipeDetail
- **Empty state:** when zero recipes qualify, render: "Nothing's quite ready right now — review your supplies or browse recipes that need a shopping trip" + a button "Browse all recipes →" navigating to RecipeList.

### Part 2 — Add navigation entry

**PantryScreen CTA:**

Add a "What can I cook?" CTA near the top of `screens/PantryScreen.tsx` (above the SuppliesSection). Style: rounded card with icon (could reuse a PantryFilled or RecipesOutline icon) + label + chevron right. Tap → `navigation.navigate('WhatCanICook')` — confirm the navigation pattern by reading existing cross-stack nav uses in PantryScreen.

**Stack placement:** The WhatCanICookScreen logically belongs in `RecipesStack` (it's a recipe view). Register the screen there in `App.tsx`. The PantryScreen CTA does cross-stack nav: `navigation.navigate('Recipes', { screen: 'WhatCanICook' })` — verify this pattern is used elsewhere in the app and follow whichever pattern is established.

### Part 3 — Subset search

Inline `TextInput` in the screen header (style similar to the existing subset search in MyMealsScreen or similar). Filter the qualifying recipe set, not the full corpus. Show "{N} recipes ready" count below the search bar.

### Part 4 — Loading + error states

- While bulk match runs: show ActivityIndicator centered.
- If bulk match throws: show error state with "Something went wrong" and a retry button.
- If no active space (e.g., user hasn't joined or created any): show "Set up your pantry first" with a CTA to PantryScreen.

---

## Constraints

- **Single section only.** No "Almost ready" or "Buy 1 more thing" sections — D8D-Q3 locked single-section.
- **Services own all Supabase calls.** WhatCanICookScreen calls `pantryMatchingService` and `recipeService` only, not Supabase directly.
- **Auto-hide pattern is NOT in scope for CP4.** Original spec says "auto-hides when empty" via locked-filter-chips pattern — but that pattern doesn't fully exist yet (8E-CP3 introduces the reusable locked-filter-chip component). For CP4: just render the empty state inline when zero recipes qualify. Don't build the auto-hide UI plumbing.
- **No new sort options.** Match % descending with title tiebreaker only.
- **Don't refactor RecipeListScreen's renderRecipeCard.** Use Option C (inline simpler card) per the build plan. RecipeListScreen extraction is deferred to its own refactor.
- **PantryScreen CTA placement:** above SuppliesSection but below StaleItemsBanner. Don't push the StaleItemsBanner out of position.
- **STOP and report** if `recipes.hero_ingredients` is routinely empty (>50% of recipes have empty/null `hero_ingredients`). In that case the screen would be near-empty regardless of supplies — Claude.ai needs to triage before CP4 ships.

---

## Verification

Before writing the SESSION_LOG entry:

1. **TypeScript compiles.** Run `npx tsc --noEmit`. Report new errors.
2. **`screens/WhatCanICookScreen.tsx` exists** with the expected default export.
3. **Screen is registered in `App.tsx`** in the correct stack.
4. **PantryScreen has the CTA** — grep `WhatCanICook` in `screens/PantryScreen.tsx`.
5. **Hero ingredient filter logic is present** — grep for `hero_ingredients` in `WhatCanICookScreen.tsx`.
6. **Empty state renders** when zero recipes qualify — verify the JSX branch exists.

On-device verification (Tom runs separately):
- From PantryScreen, tap "What can I cook?" → screen opens.
- If supplies are stocked: see recipes that match ≥90% AND have heroes all in stock.
- Tap a recipe → opens RecipeDetail.
- Search bar filters the displayed subset.
- Locked filter chip is visible and non-tappable (or shows brief toast).
- Empty state shows when no recipes qualify (e.g., empty pantry).
- Cross-spot check: pick a "Ready now" recipe → confirm in RecipeDetail that the matches ARE in fact >= 90% and hero ingredients all have ✓ marks.

---

## SESSION_LOG entry format

```markdown
## 2026-MM-DD — Phase 8D CP4: What-can-I-cook screen
**Phase:** 8D
**Prompt from:** CC_PROMPT_8D_CP4.md

[Body. Note: hero_ingredients population rate observed; which option (A/B/C) chosen for card rendering; any wireframe ambiguity calls.]

**Files modified:**
- `screens/WhatCanICookScreen.tsx` (NEW, ~XXX lines)
- `screens/PantryScreen.tsx` (CTA add) ⚠️ PK snapshot now stale (was YYYY-MM-DD)
- `App.tsx` (navigator registration) ⚠️ PK snapshot now stale (was YYYY-MM-DD)

**Verification results:**
- TypeScript: [N new errors / clean]
- Screen registration: ✅
- PantryScreen CTA: ✅
- Hero ingredient filter: ✅
- Empty state: ✅

**Hero ingredient coverage observation:** [out of N recipes, M have non-empty hero_ingredients. If M/N < 50%, flag for Claude.ai.]

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md`: add `screens/WhatCanICookScreen.tsx` to screens table.
- `PROJECT_CONTEXT.md`: 8D-CP4 flip to ✅ (or 🟢 if partial); add a "What Works" line for "What can I cook?" surface.
- `FF_LAUNCH_MASTER_PLAN.md`: mark 8D-CP4 complete.

**Recommended next steps for Tom:**
1. On-device: open PantryScreen → tap "What can I cook?" → confirm screen renders.
2. Cross-spot check: pick a recipe from the list, open it, verify it really is ≥90% match with heroes in stock.
3. If hero_ingredients coverage is sparse, decide whether to relax the criterion or backfill heroes (Phase 3 backfill task).
4. With CP1, CP3, CP4 all shipped, recipe-pantry matching is functionally complete. Next planning session: 8E F&F subset (Browse rebuild + locked filter chips component + low stock indicators).

**Surprises / Notes for Claude.ai:**
[hero_ingredients shape surprises, cross-stack nav quirks, card rendering decisions.]
```

---

## Open questions (STOP conditions)

1. **`recipes.hero_ingredients` is empty or null for >50% of recipes.** Filter would near-empty the screen. STOP and surface — Claude.ai may relax the hero check, fall back to top-N-by-frequency ingredients, or trigger a Phase 3 backfill.
2. **Cross-stack navigation pattern is unclear.** Multiple existing screens use different patterns to navigate from Pantry to Recipes stack. Report which pattern you chose.
3. **`RecipesStackParamList` doesn't include `WhatCanICook`** and adding it conflicts with other type declarations. Report the conflict.
4. **Bulk match performance is bad at N=475 recipes** — RecipeList load + match takes >3s on-device. CP1's 3-query target may not be holding. STOP and report perf numbers; Claude.ai may pull forward caching from D8D-Q10 (currently OUT OF SCOPE).
