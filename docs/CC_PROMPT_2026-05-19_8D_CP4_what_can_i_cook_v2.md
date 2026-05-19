# CC Prompt — Phase 8D CP4: What-can-I-cook Screen + RecipeList Match Wiring — v2

**Date drafted:** 2026-05-19 (v2 supersedes the 2026-05-18 v1 draft after code-grounded review post-CP1/CP2/CP3)
**Estimated:** ~1.5 sessions
**F&F-blocker:** Yes — "What can I cook with what I have" is stated F&F success criterion
**Depends on:** CP1, CP1.5, CP2, CP2-patch, CP3 all shipped 2026-05-19. The matcher returns `PantryMatchResult` with `matched[].supplyStatus` populated; recipes carry `hero_ingredients: string[]` (text array of names — NOT JSONB objects).

---

## Context

CP4 is Phase 8D's headline utility — "what can I cook with what I have right now." After CP1/CP2/CP3 made pantry matching work in the matcher service and surfaced it on RecipeDetailScreen, CP4 puts a filtered recipe list in front of the user showing only recipes that are genuinely ready to cook given current supplies.

Per locked decision D8D-Q3, the **"Ready to cook" criterion** is:
- `matchPercentage >= 0.90` AND
- Every ingredient in `recipes.hero_ingredients` (the recipe's defining ingredients) resolves to a matched ingredient_id (NOT in `matchResult.missing[]`)

**Data shape constraint (critical):** `recipes.hero_ingredients` is **`text[]` — an array of name strings**, NOT a JSONB array of `{ingredient_id, name}` objects. The v1 CP4 prompt assumed JSONB and would have broken at runtime. To check whether a hero ingredient is missing, name-resolve at filter time: for each hero name, look up the matching row in `recipe.ingredients[]` (case-insensitive name match) to get the ingredient_id, then check `missing[]`. Console-warn on resolution misses (hero name doesn't match any recipe ingredient) so we can measure data-quality issues for a post-F&F schema decision (captured as T31).

**Architecture (hybrid):**
1. **Shared gating logic** in `lib/services/readyToCookService.ts` — single source of truth for the "ready to cook" predicate.
2. **`useReadyToCookRecipes` hook** in `lib/hooks/` — loads recipes, bulk-matches, applies the gate, returns the qualifying subset.
3. **`RecipeCard` component** extracted from RecipeListScreen — shared by both screens.
4. **`WhatCanICookScreen`** — new dedicated screen for the gated subset, reachable from PantryScreen + RecipeListScreen's "X you can make now" badge. Architectural space for future free-form recipe ideas (no UI in this CP; just structural reservation).
5. **RecipeListScreen integration** — load path wires in the bulk matcher, `pantry_match` field gets populated, `canMakeCount` becomes real, the "X you can make now" badge renders and becomes a tappable CTA to WhatCanICookScreen.

**Wireframe reference:** `docs/wireframes/phase_8/phase_8_system_prototype_v5.html` — What-can-I-cook tab. The locked filter chip pattern referenced there is formally 8E-CP3 work; for CP4 we render a one-off locked-looking chip in WhatCanICookScreen that 8E-CP3 will replace with the shared component.

---

## Inputs to read

**Architectural:**
1. `docs/PHASE_8_PANTRY_AND_GROCERY.md` — CP4 section, D8D-Q3, D8D-Q7 decisions
2. `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` — note the Additivity Principle (applies to RecipeListScreen visual layer)
3. `docs/wireframes/phase_8/phase_8_system_prototype_v5.html` — What-can-I-cook tab

**Code-level:**
4. `lib/services/pantryMatchingService.ts` — `calculateRecipeSupplyMatchBulk` is CP4's primary consumer
5. `lib/services/recipeService.ts` — recipe loading patterns; what fields come back
6. `screens/RecipeListScreen.tsx` (~2125 lines, busy file) — the existing browse surface
   - Pay special attention to: `loadRecipes` (the data-load path), `renderRecipeCard` (the card to extract), the `pantry_match` field (currently dormant), `canMakeCount` state + "X you can make now" badge (currently never renders), the quick filter chip pattern (Vegetarian, High Protein, Quick 30, Comfort), the `applyFilters` function
7. `screens/PantryScreen.tsx` — where the "What can I cook?" CTA gets added
8. `App.tsx` — navigator config; needs WhatCanICookScreen route added
9. `contexts/SpaceContext.tsx` — `useActiveSpaceId`
10. `lib/types/store.ts` or wherever `Recipe` is typed — confirm `pantry_match?: number` shape and `hero_ingredients: string[]` shape

**Schema verification:**
- `recipes.hero_ingredients` is `text[]` (verify in `Supabase_Snippet_Schema_Column_Details_with_PK_FK_Metadata.csv` if uncertain). Sample value: `['salmon', 'capers']`. **STOP and report** if it's any other shape — the runtime resolution approach in this prompt depends on it being a string array.
- `recipes.pantry_match` field on the TS type is `number?`. The DB column may or may not exist — verify which. If DB column doesn't exist, this is a runtime-only field populated on the client (which is already the case — current code initializes to 0).

---

## Task

Execute Part 0 → Part G in order. Single fused commit when done.

### Preservation Contract — what MUST stay unchanged in RecipeListScreen

CP4 wires matching into RecipeListScreen as foundational work. The screen's visual and behavior must stay byte-identical except for the additive surfaces explicitly listed below.

**Must NOT change in RecipeListScreen:**
- Recipe card visual (during card extraction — the extracted component must render exactly as today's inline `renderRecipeCard`)
- Quick filter chips (Vegetarian, High Protein, Quick 30, Comfort) — visual, behavior, ordering
- Browse mode toggle (Cook Again / Try New)
- Advanced filters via FilterDrawer (heroes, vibes, dietary, nutrition, time)
- Sort dropdown options and default sort
- Section organization (Cook Again sections, Try New layout)
- Search bar behavior
- "Pinned" badge / `pinnedCount` display
- Loading state visuals
- Empty state copy and visuals
- Pull-to-refresh behavior

**Additive changes ONLY:**
- `pantry_match` field on each recipe gets populated with the real match percentage (was always 0, now real number 0-1)
- `canMakeCount` state now counts recipes passing the "ready to cook" gate (was always 0)
- The existing "X you can make now" badge renders when `canMakeCount > 0` (was always hidden because count was 0)
- The badge becomes tappable → pushes to WhatCanICookScreen
- `renderRecipeCard` is replaced with `<RecipeCard ... />` calling the extracted component (same visual output)

If during execution CC notices itself making a change that would alter any preserved element (card visual, filter behavior, sort order, etc.), **STOP and report**. The card extraction is internal refactor — visual output must be identical. Tom will take screenshot diffs of RecipeListScreen before/after.

### Part 0 — Pre-flight doc updates

Two doc edits, both small.

**T31 — Refactor hero_ingredients to structured format** (append to `docs/DEFERRED_WORK.md` Cross-Cutting Technical Debt table in the live 5-column format CC threaded for T27-T29):

```
T31 | 2026-05-19 | Refactor hero_ingredients to structured format | Currently `recipes.hero_ingredients` is `text[]` of names. CP4's "ready to cook" check name-resolves heroes against the recipe's own `ingredients[]` at filter time. Console.warn on misses surfaces data-quality issues. Once miss-rate data accumulates, decide between (a) JSONB array of `{ingredient_id, name}`, (b) junction table `recipe_hero_ingredients`, or (c) augment with `hero_ingredient_ids: uuid[]`. Touches AI tagging pipeline, RecipeListScreen filter, FilterDrawer hero chips, this new CP4 logic. Post-F&F. | 🔧 | 🟡
```

Adjust column assignment to match the live table format (CC: read the existing T27-T30 rows for the actual column order and thread T31 consistently).

**Update T29 to fold in SMOKE-CP2-tie** — surgical edit to T29's description. Find the existing T29 row and append to its description text:

> "Also include SMOKE-CP2-tie in the realignment — uses the basmati/jasmine rice pair (same null-form-wildcard staleness as L3a) and additionally hits harness contamination (Tom stocks real rice supplies)."

This is an edit to an existing row, not a new row.

**Changelog:** bump DEFERRED_WORK to v5.27 noting both changes (T31 added, T29 expanded).

### Part A — Shared gating logic (`lib/services/readyToCookService.ts`)

**Create:** `lib/services/readyToCookService.ts` — single source of truth for the "ready to cook" predicate. Both RecipeListScreen and WhatCanICookScreen call this.

**Exports:**

```typescript
import type { Recipe } from '...';  // wherever Recipe is typed
import type { PantryMatchResult } from './pantryMatchingService';

export const READY_TO_COOK_THRESHOLD = 0.90;  // D8D-Q3 locked decision

/**
 * Resolve a hero ingredient name to its ingredient_id by looking up
 * the recipe's own ingredients[] (case-insensitive name match).
 * Returns null if no match — emits console.warn for data-quality tracking.
 */
export function resolveHeroToIngredientId(
  heroName: string,
  recipeIngredients: Array<{ id: string; name: string }>
): string | null {
  const match = recipeIngredients.find(
    (ing) => ing.name.toLowerCase() === heroName.toLowerCase()
  );
  if (!match) {
    console.warn('[readyToCookService] hero name unresolved', {
      heroName,
      recipeIngredientCount: recipeIngredients.length,
      // Don't log all ingredient names — keeps the warn compact
    });
    return null;
  }
  return match.id;
}

/**
 * Returns true if the recipe is ready to cook given its match result.
 * Criterion: matchPercentage >= 0.90 AND every resolvable hero ingredient
 * is in matched[] (not in missing[]).
 *
 * Unresolvable heroes (name doesn't match any recipe ingredient) are
 * SKIPPED — treated as soft pass. This is the conservative choice for
 * F&F given uneven hero-tagging coverage. Tracked as T31.
 */
export function isReadyToCook(
  recipe: Recipe & { ingredients: Array<{ id: string; name: string }> },
  matchResult: PantryMatchResult | undefined
): boolean {
  if (!matchResult) return false;
  if (matchResult.matchPercentage < READY_TO_COOK_THRESHOLD) return false;
  
  const heroNames = recipe.hero_ingredients ?? [];
  if (heroNames.length === 0) return false;  // no heroes → can't qualify per D8D-Q3
  
  const missingSet = new Set(matchResult.missing);
  
  for (const heroName of heroNames) {
    const heroIngredientId = resolveHeroToIngredientId(heroName, recipe.ingredients);
    if (heroIngredientId === null) continue;  // unresolved → skip (soft pass per T31)
    if (missingSet.has(heroIngredientId)) return false;  // hero is missing → not ready
  }
  
  return true;
}

/**
 * Filter a list of recipes to those passing the ready-to-cook gate.
 * Sorts qualifying recipes by matchPercentage DESC, tiebreaker by title ASC.
 */
export function filterReadyToCook(
  recipes: Array<Recipe & { ingredients: Array<{ id: string; name: string }> }>,
  matchMap: Map<string, PantryMatchResult>
): typeof recipes {
  return recipes
    .filter((r) => isReadyToCook(r, matchMap.get(r.id)))
    .sort((a, b) => {
      const pctA = matchMap.get(a.id)?.matchPercentage ?? 0;
      const pctB = matchMap.get(b.id)?.matchPercentage ?? 0;
      if (pctA !== pctB) return pctB - pctA;
      return a.title.localeCompare(b.title);
    });
}
```

**Constraint on the recipe shape:** the service expects recipes to carry `ingredients: Array<{id, name}>` for hero resolution. **STOP and report** if the recipe object passed in doesn't have this — we may need to fetch recipe ingredients separately or change the function signature.

### Part B — `useReadyToCookRecipes` hook (`lib/hooks/useReadyToCookRecipes.ts`)

**Create:** `lib/hooks/useReadyToCookRecipes.ts`.

If the project has no `lib/hooks/` directory yet, create it. If it has other hooks elsewhere (e.g., `contexts/`), report — we may want to standardize.

**Hook shape:**

```typescript
import { useEffect, useState, useCallback } from 'react';
import { calculateRecipeSupplyMatchBulk } from '../services/pantryMatchingService';
import { filterReadyToCook } from '../services/readyToCookService';
import { getRecipes } from '../services/recipeService'; // or whatever the current recipe-loading function is
import type { Recipe } from '...';
import type { PantryMatchResult } from '../services/pantryMatchingService';

interface UseReadyToCookResult {
  readyToCookRecipes: Recipe[];  // gated subset, sorted by match% DESC
  matchMap: Map<string, PantryMatchResult>;  // full match data for all recipes
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useReadyToCookRecipes(spaceId: string | null): UseReadyToCookResult {
  const [readyToCookRecipes, setReadyToCookRecipes] = useState<Recipe[]>([]);
  const [matchMap, setMatchMap] = useState<Map<string, PantryMatchResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const load = useCallback(async () => {
    if (!spaceId) {
      setReadyToCookRecipes([]);
      setMatchMap(new Map());
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Load all recipes (with hero_ingredients + ingredients[] populated)
      const recipes = await getRecipes(/* args per existing pattern */);
      
      // 2. Bulk-match
      const matches = await calculateRecipeSupplyMatchBulk(
        recipes.map((r) => r.id),
        spaceId
      );
      setMatchMap(matches);
      
      // 3. Filter + sort
      const ready = filterReadyToCook(recipes, matches);
      setReadyToCookRecipes(ready);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      console.error('[useReadyToCookRecipes] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return { readyToCookRecipes, matchMap, loading, error, refresh: load };
}
```

**Verify during reading pass:** the actual recipe-loading function name and signature. The recipe object must have `ingredients[]` populated for hero resolution. If the standard load doesn't include ingredients, STOP and propose — we either fetch separately or call a different service.

### Part C — Extract `RecipeCard` component (`components/recipe/RecipeCard.tsx`)

**Create:** `components/recipe/RecipeCard.tsx`. Extract the existing `renderRecipeCard` function from RecipeListScreen into a standalone component.

**Visual output must be byte-identical** to today's render. The extraction is an internal refactor — same JSX, same styles, same prop passthrough. RecipeListScreen will replace its inline `renderRecipeCard` call with `<RecipeCard ... />`.

**Props:** mirror what the current `renderRecipeCard` reads from its closure. Typical pattern:

```typescript
interface RecipeCardProps {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
  // ... any other callbacks/state currently captured in the closure
  // (selection mode toggles, long-press handlers, etc. — verify during extraction)
}
```

**Pantry-match indicator (additive, optional surface):** the card can show a subtle pantry-match pill (e.g., "92%") when `recipe.pantry_match > 0`. If RecipeListScreen's current card already shows this somewhere, preserve it exactly. If it doesn't, do NOT add it as a new surface in this CP — the dormant infrastructure has the field but doesn't render anything; keep that contract for now. The pantry-match badge UX is its own design decision (post-CP4 or 8E-CP4 territory).

**STOP and report** if extraction hits dependency tangles — references to multiple closure-captured callbacks, local state, etc. — that can't be cleanly factored. Options to propose: pass everything as props (verbose but works), keep inline and copy minimally to WhatCanICookScreen, or refactor more aggressively.

### Part D — `WhatCanICookScreen.tsx` (new screen)

**Create:** `screens/WhatCanICookScreen.tsx`.

**Structure:**

```typescript
import { useReadyToCookRecipes } from '../lib/hooks/useReadyToCookRecipes';
import { RecipeCard } from '../components/recipe/RecipeCard';
import { useActiveSpaceId } from '../contexts/SpaceContext';
// ... navigation, styling, etc.

export default function WhatCanICookScreen({ navigation }: Props) {
  const spaceId = useActiveSpaceId();
  const { readyToCookRecipes, loading, error, refresh } = useReadyToCookRecipes(spaceId);
  const [searchQuery, setSearchQuery] = useState('');
  
  const displayed = useMemo(() => {
    if (!searchQuery.trim()) return readyToCookRecipes;
    const q = searchQuery.toLowerCase();
    return readyToCookRecipes.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.hero_ingredients?.some((h) => h.toLowerCase().includes(q))
    );
  }, [readyToCookRecipes, searchQuery]);
  
  // Render: header, search bar, locked filter chip, list (or empty state)
}
```

**UI elements:**
- **Header:** title "Ready to cook" (or per wireframe v5 — cross-reference). Optional back button per the standard navigation pattern.
- **Search bar** below the header. Filters the displayed subset on title or hero name match.
- **Locked filter chip** below the search bar: small lock icon, gray background, text "Pantry: 90%+ match", non-tappable. One-off styling for now; 8E-CP3 will replace with shared component. Add a code comment marking the temporary nature.
- **List of `<RecipeCard>` components**, scrollable. Tap → navigates to `RecipeDetail` (same destination as RecipeListScreen).
- **Empty state** (when `readyToCookRecipes.length === 0` and not loading): friendly copy per wireframe v5 ("Nothing's quite ready right now — review your supplies or browse recipes that need a shopping trip"). Optional CTA button to PantryScreen or RecipeListScreen.
- **Loading state**: standard activity indicator pattern.
- **Pull-to-refresh** on the list: triggers `refresh()` from the hook.

**Architectural reservation for free-form recipe ideas (Q3.1 = option a):** add a clearly-marked code comment block where a future "Free-form ideas" section would render. NO UI in this CP — the screen should look complete with just the gated recipe list. The comment marks intent only.

```typescript
// FUTURE: Free-form recipe ideas section
// AI-generated suggestions based on user's pantry contents.
// Will render below the matched-recipes list, separated by a section divider.
// Out of scope for CP4 (Tom's call, 2026-05-19) — architectural reservation only.
// See PHASE_9+ planning.
```

### Part E — RecipeListScreen integration

**Wire matching into the load flow.** In RecipeListScreen's existing `loadRecipes` function (or whatever the data-load is named), after the existing recipe enrichment, add:

```typescript
// After existing enrichment, before setRecipes:
const matches = await calculateRecipeSupplyMatchBulk(
  enrichedRecipes.map((r) => r.id),
  spaceId  // from useActiveSpaceId
);
const recipesWithMatch = enrichedRecipes.map((r) => ({
  ...r,
  pantry_match: matches.get(r.id)?.matchPercentage ?? 0,
}));
setRecipes(recipesWithMatch);
setFilteredRecipes(recipesWithMatch);

// Compute canMakeCount via the shared gate:
const canMake = filterReadyToCook(recipesWithMatch, matches).length;
setCanMakeCount(canMake);
```

**Wire the "X you can make now" badge to push to WhatCanICookScreen.**

Find the badge render block:
```typescript
{canMakeCount > 0 && (
  <View style={styles.statusItem}>
    <Text style={styles.statusText}>{canMakeCount} you can make now</Text>
  </View>
)}
```

Wrap in TouchableOpacity → `navigation.navigate('WhatCanICook')` on tap. Visual treatment: minimal — `activeOpacity={0.7}` only. Don't change the badge styling, don't add chevrons or icons. **Same preservation discipline as CP3's tap target.**

**Replace inline `renderRecipeCard` with `<RecipeCard>` component.** Find every site that calls `renderRecipeCard` and replace with the extracted component. Visual output must be byte-identical (Tom verifies via screenshot diff).

**DO NOT add a "Ready to cook" filter chip** to the quick filter row in this CP. It's a clean candidate for 8E-CP3 (locked filter chips) or 8E-CP4 — out of scope here. Tap-the-badge → push-to-dedicated-screen is the only entry point.

**DO NOT touch any other filter logic, sort logic, or section rendering.** The matcher wiring is the only behavioral addition to the existing screen.

### Part F — PantryScreen CTA + App.tsx navigator

**PantryScreen — add "What can I cook?" CTA:**

Find an appropriate location in PantryScreen (likely near the top, below the space switcher / view selector, but verify what fits the existing layout). Add a tappable button:

```typescript
<TouchableOpacity onPress={() => navigation.navigate('WhatCanICook')}>
  <Text>What can I cook?</Text>
</TouchableOpacity>
```

Styling: match existing PantryScreen button/CTA patterns. If unclear which pattern, use a primary-color outline button at full container width with 12pt vertical padding.

**Cross-stack navigation note:** PantryScreen is in the Pantry stack; WhatCanICookScreen sits in the Recipes stack (per the v1 prompt's lean and matching the RecipeDetail flow). Use the cross-stack pattern from `SupplyDetailScreen.handleFindRecipes` — wrap in `tabNav.navigate('Recipes', { screen: 'WhatCanICook' })`. Verify the actual tabNav reference pattern during reading.

**App.tsx — register the route:**

Add `WhatCanICookScreen` to the Recipes stack navigator (`RecipesStackParamList`):

```typescript
<Stack.Screen name="WhatCanICook" component={WhatCanICookScreen} options={{ title: 'Ready to cook' }} />
```

Add `WhatCanICook: undefined;` to the `RecipesStackParamList` type. Verify the exact stack file is `App.tsx` or a separate navigators file.

### Part G — Smoke tests + console.warn instrumentation

**Add to `lib/services/_pantryMatchingSmokeTest.ts`:**

```
SMOKE-CP4-RTC1  Synthetic recipe: 5 ingredients, all in pantry, 1 hero ('salmon') matching ingredient name 'salmon' that IS in pantry
                → expect isReadyToCook returns true; recipe in filterReadyToCook output

SMOKE-CP4-RTC2  Synthetic recipe: 5 ingredients, 4 in pantry, 1 hero ('salmon') matching ingredient name 'salmon' that IS NOT in pantry
                → expect isReadyToCook returns false (hero in missing[])

SMOKE-CP4-RTC3  Synthetic recipe: 10 ingredients, all in pantry except 1 non-hero
                → matchPercentage = 0.90 (10/10 → 9 in stock + 1 missing = 0.90)
                → hero = 'salmon', resolves and is in matched[]
                → expect isReadyToCook returns true (90% threshold met exactly)

SMOKE-CP4-RTC4  Synthetic recipe: 10 ingredients, 8 in pantry
                → matchPercentage = 0.80
                → expect isReadyToCook returns false (under threshold)

SMOKE-CP4-RTC5  Synthetic recipe: hero name doesn't match any recipe ingredient name (data hygiene case)
                → expect isReadyToCook treats as soft pass — the unresolvable hero doesn't fail the recipe
                → console.warn emitted ("[readyToCookService] hero name unresolved")
                → if other heroes resolve and pass, recipe still qualifies (assuming pct >= 0.90)
```

Skip if the synthetic catalog doesn't support a scenario (`SETUP-FAIL` per existing harness pattern).

**Console.warn instrumentation lifecycle:** the `[readyToCookService] hero name unresolved` warning is permanent for now — it surfaces a data-quality measurement we want long-term until T31 resolves the schema question. Do NOT mark this for removal at 8D cleanup. Other CP4 console.warns (if any, e.g. for matcher-related debugging) ARE marked for removal at the 8D phase-completion cleanup pass.

### Doc updates

1. `docs/FRIGO_ARCHITECTURE.md` — add `screens/WhatCanICookScreen.tsx` to the screens table; add `components/recipe/RecipeCard.tsx` to the recipe components directory tree; add `lib/services/readyToCookService.ts` to the services table; add `lib/hooks/useReadyToCookRecipes.ts` to a hooks subsection (create the subsection if no other hooks exist).

2. `docs/PHASE_8_PANTRY_AND_GROCERY.md` — CP4 results subsection; 8D status updated (CP1-CP4 + CP5 shipped, CP5 was bundled with CP3 reminder, "phase essentially complete pending cleanup pass").

3. `docs/DEFERRED_WORK.md` — T31 + T29 update from Part 0. Mark P? (if any earlier deferred item corresponds to "what-can-I-cook surface" — search for it; if exists, mark resolved). Changelog → v5.27.

4. `docs/PROJECT_CONTEXT.md` — 8D-CP4 status flip; phase table update; changelog bump.

5. `docs/FF_LAUNCH_MASTER_PLAN.md` — 8D-CP4 marked complete in phase sequence row; mention 8D essentially complete; note 8E F&F subset is next.

6. `docs/SESSION_LOG.md` — append CP4 entry under today's (2026-05-19) header.

### Stage to `_pk_sync/`

```bash
cp docs/FRIGO_ARCHITECTURE.md _pk_sync/FRIGO_ARCHITECTURE_2026-05-19.md
cp docs/PHASE_8_PANTRY_AND_GROCERY.md _pk_sync/PHASE_8_PANTRY_AND_GROCERY_2026-05-19.md
cp docs/DEFERRED_WORK.md _pk_sync/DEFERRED_WORK_2026-05-19.md
cp docs/PROJECT_CONTEXT.md _pk_sync/PROJECT_CONTEXT_2026-05-19.md
cp docs/FF_LAUNCH_MASTER_PLAN.md _pk_sync/FF_LAUNCH_MASTER_PLAN_2026-05-19.md
cp docs/SESSION_LOG.md _pk_sync/SESSION_LOG_2026-05-19.md
```

Overwrite existing today-dated copies (this consolidates CP3 + CP4 staged state).

---

## Constraints

- **DO NOT change the visual or behavior of RecipeListScreen** except for the explicit additive changes (matcher wiring → populated `pantry_match`, working `canMakeCount` badge, badge becomes tappable, inline card replaced by extracted RecipeCard). All other elements byte-identical.
- **DO NOT add a "Ready to cook" filter chip** to RecipeListScreen's quick filters. Out of scope; clean candidate for 8E-CP3 or 8E-CP4.
- **DO NOT modify any other filter, sort, or browse logic** in RecipeListScreen.
- **DO NOT change the `pantry_match` field's type or initialization elsewhere** — just populate it correctly in the load flow.
- **DO NOT migrate `hero_ingredients` to a different schema.** Runtime name resolution is the F&F approach. T31 captures the post-F&F decision.
- **DO NOT add free-form recipe ideas UI** to WhatCanICookScreen. Architectural comment reservation only (per Tom's call, 2026-05-19).
- **DO NOT build a custom locked filter chip component.** Inline one-off styling in WhatCanICookScreen for now; 8E-CP3 will formalize.
- **DO NOT commit.** Tom batches.

---

## Verification

```bash
# 1. TypeScript clean
npx tsc --noEmit
# Expect: 0 new errors

# 2. New files exist
ls -la lib/services/readyToCookService.ts lib/hooks/useReadyToCookRecipes.ts components/recipe/RecipeCard.tsx screens/WhatCanICookScreen.tsx
# Expect: all four present

# 3. RecipeCard extracted (no inline renderRecipeCard duplication)
grep -c "function renderRecipeCard\|const renderRecipeCard" screens/RecipeListScreen.tsx
# Expect: 0 (inline definition gone)
grep -c "<RecipeCard" screens/RecipeListScreen.tsx
# Expect: at least 1 (usage)

# 4. Matcher wired into RecipeListScreen load
grep -c "calculateRecipeSupplyMatchBulk\|filterReadyToCook" screens/RecipeListScreen.tsx
# Expect: at least 2 (one for match, one for canMake count)

# 5. WhatCanICookScreen registered in navigator
grep "WhatCanICook" App.tsx
# Expect: at least 2 hits (route name in navigator + type param)

# 6. PantryScreen CTA exists
grep "WhatCanICook" screens/PantryScreen.tsx
# Expect: at least 1 hit

# 7. Hero resolution console.warn present
grep "hero name unresolved" lib/services/readyToCookService.ts
# Expect: 1 hit

# 8. T31 in DEFERRED_WORK
grep "^| T31 \|^| T31|T31 |" docs/DEFERRED_WORK.md | head -3
# Expect: 1 hit (in the table)

# 9. SMOKE-CP4-RTC1..5 added
grep -c "SMOKE-CP4-RTC" lib/services/_pantryMatchingSmokeTest.ts
# Expect: at least 5

# 10. _pk_sync/ staging complete
ls _pk_sync/ | grep "2026-05-19" | wc -l
# Expect: at least 7 (FRIGO_ARCHITECTURE, PHASE_8, DEFERRED_WORK, PROJECT_CONTEXT, FF_LAUNCH_MASTER_PLAN, SUBSTITUTION_INTELLIGENCE_ROADMAP, SESSION_LOG)
```

**Manual verification (Tom runs separately):**

**Visual regression checks (run FIRST):**
1. RecipeListScreen — screenshot before CP4 firing, screenshot after. Recipe cards must look identical (the extraction is internal refactor). Quick filter chips, sort, sections, search bar, headers — all unchanged. The "X you can make now" badge IS allowed to appear (was hidden before; now visible when count > 0).
2. PantryScreen — screenshot before/after. The new "What can I cook?" CTA is an addition; everything else unchanged.

**Functional checks:**
1. Open RecipeListScreen — "X you can make now" badge renders when pantry has stocked items. Tap → pushes to WhatCanICookScreen.
2. Open PantryScreen — "What can I cook?" CTA visible → tap → pushes to WhatCanICookScreen (cross-stack nav works).
3. WhatCanICookScreen renders gated subset, sorted by match% DESC.
4. Locked filter chip "Pantry: 90%+ match" visible and non-tappable.
5. Search bar filters the displayed subset.
6. Tap a recipe in WhatCanICook → opens RecipeDetail (with CP3 tap-sheet + match% banner working).
7. Empty state renders when no recipes qualify (test by un-stocking key ingredients).
8. Pull-to-refresh works on WhatCanICookScreen.
9. Run smoke tests via AdminScreen — SMOKE-CP4-RTC1..5 should all pass (skip with SETUP-FAIL only if catalog rows are missing; this should be rare).
10. Cross-spot check: pick a "Ready now" recipe from WhatCanICook, open it in RecipeDetail, verify the banner shows ≥90% match and all hero ingredients are matched (not in the "+ Add N missing →" list).
11. Console output: check `[readyToCookService] hero name unresolved` warnings to gauge hero-resolution miss rate. Note the count and most-common unresolved names in SESSION_LOG.

---

## SESSION_LOG entry format

```markdown
### CC: Phase 8D CP4 — What-can-I-cook screen + RecipeList match wiring — [DONE or PARTIAL]

**Prompt:** `CC_PROMPT_2026-05-19_8D_CP4_what_can_i_cook_v2.md`
**Files modified:**
- lib/services/readyToCookService.ts (NEW, ~XX lines)
- lib/hooks/useReadyToCookRecipes.ts (NEW, ~XX lines)
- components/recipe/RecipeCard.tsx (NEW, extracted from RecipeListScreen)
- screens/WhatCanICookScreen.tsx (NEW, ~XX lines)
- screens/RecipeListScreen.tsx (matcher wired into load; canMake badge made tappable; renderRecipeCard replaced with <RecipeCard>)
- screens/PantryScreen.tsx ("What can I cook?" CTA added)
- App.tsx (WhatCanICook route registered)
- lib/services/_pantryMatchingSmokeTest.ts (+SMOKE-CP4-RTC1..5)
- docs/FRIGO_ARCHITECTURE.md
- docs/PHASE_8_PANTRY_AND_GROCERY.md
- docs/DEFERRED_WORK.md (T31 added, T29 updated; v5.27)
- docs/PROJECT_CONTEXT.md
- docs/FF_LAUNCH_MASTER_PLAN.md
**Files staged in _pk_sync/:** [list]
**Resolved deferred items:** [if any P# from earlier deferred items corresponded to "what-can-I-cook" surface]. T31 added.
**Smoke test result:** [tally]
**Hero resolution miss-rate observation:** [out of N hero names across all loaded recipes, M resolved successfully. If M/N < 70%, flag for Claude.ai — may need to accelerate T31.]
**Notes:**
- Preservation Contract for RecipeListScreen: [confirm card visual identical pre/post extraction; confirm no filter/sort/section regression]
- STOP conditions: [whether any triggered — hero schema mismatch, card extraction tangles, recipe service ingredient-loading shape, etc.]
- Architectural reservation for free-form recipe ideas: [confirm comment marker placed; no UI shipped]
```

---

## Suggested commit message

```
feat(8D-CP4): What-can-I-cook screen + RecipeList match wiring

Implements D8D-Q3 "Ready to cook" criterion: matchPercentage >= 0.90
AND every hero_ingredient resolves to a matched ingredient_id.

Architecture (hybrid):
- lib/services/readyToCookService.ts — single source of truth for the
  ready-to-cook predicate; runtime name-resolution for hero_ingredients
  (text[]) against the recipe's own ingredients[] list.
- lib/hooks/useReadyToCookRecipes.ts — loader + gate + sort for the
  qualifying subset.
- components/recipe/RecipeCard.tsx — extracted from RecipeListScreen;
  shared between RecipeList and WhatCanICook.
- screens/WhatCanICookScreen.tsx — new dedicated screen; gated subset;
  locked filter chip "Pantry: 90%+ match" (one-off styling; 8E-CP3
  will formalize). Architectural comment reservation for future
  free-form recipe ideas section (no UI in this CP).
- RecipeListScreen wired: bulk matcher in load path → pantry_match
  populated → canMakeCount real → "X you can make now" badge renders
  and pushes to WhatCanICook.

Strictly additive at the visual layer for RecipeListScreen — card
visual byte-identical to pre-CP4 (extraction is internal refactor);
all existing filters/sort/sections preserved.

Hero ingredients runtime-resolved via case-insensitive name match
against recipe.ingredients[]. Unresolvable heroes are soft-passes
(console.warn for data-quality measurement). T31 captures the
post-F&F schema decision.

Resolves D8D-Q3.
```

---

## After CP4 ships

Phase 8D is essentially complete. Remaining cleanup (~30-60 min):
- Remove `console.warn` instrumentation from `IngredientTapSheet` (CP3 Part D)
- T29 smoke harness expectation realignment (now including SMOKE-CP2-tie)
- PHASE_8D_PLANNING.md refresh to remove pre-8R framing
- PK_CODE_SNAPSHOTS.md revert + refresh

**Then 8E F&F subset** (~2-3 sessions):
- 8E-CP1: Browse recipes rebuild
- 8E-CP3: Locked filter chips pattern (formalizes the one-off chip in WhatCanICookScreen)
- 8E-CP4: Low stock indicators

**Post-F&F roadmap:**
- T31 hero_ingredients schema decision
- Free-form recipe ideas (architectural slot reserved in WhatCanICookScreen)
- G1-G7 substitution intelligence work
- Subtype audit + split (T30)
