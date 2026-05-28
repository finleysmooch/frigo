# 8R-UX5 — Hero ingredient marker + filter pill

Add a "hero ingredient" signal computed from `recipe_ingredients.ingredient_classification`. Surface it two ways:

1. ⚡ inline marker before the name on Use Soon rows
2. A `⚡ Heroes N` filter pill in the inner family-pill strip on Everything and Use Soon tabs (mutually exclusive with family pills — only one filter active at a time)

No schema changes. Service-only signal computed on the fly. Threshold values are best-guess and will tune post-F&F.

## Files to read first

- `lib/services/statsService.ts` — reference for the existing `recipe_ingredients` + `ingredient_classification` query pattern (look for getTopIngredients or similar)
- `lib/services/pantryMatchingService.ts` — reference for the existing recipe-library scope (how the user's recipes are identified for matching purposes)
- `lib/types/supplies.ts` — where to add the new hero data types
- `components/pantry/SuppliesSection.tsx` — current `activeFamily` state, the family-pill strip render, and the filter application
- `components/pantry/SupplyRow.tsx` — where the inline name renders + how leading icons/markers are positioned
- `screens/PantryScreen.tsx` — where to load and cache the hero frequency data
- `screens/AdminScreen.tsx` — to add the audit button

## Task

### Part A — service layer

Create `lib/services/heroIngredientService.ts` with these exports:

```typescript
export interface HeroFrequencyData {
  userLibrary: Map<string, number>;  // ingredient_id → hero count in user's library
  global: Map<string, { heroAppearances: number; totalAppearances: number }>;
}

export interface HeroAuditEntry {
  ingredientId: string;
  ingredientName: string;
  userHeroCount: number;
  globalHeroCount: number;
  globalTotalCount: number;
  globalHeroRate: number;
  qualifiesAsHero: boolean;
  qualifyReason: 'user_library' | 'global_rate' | 'neither';
}

export interface HeroAuditData {
  byUserLibrary: HeroAuditEntry[];  // top 30 by userHeroCount desc
  byGlobalRate: HeroAuditEntry[];   // top 30 by globalHeroRate desc (with min 3 appearances)
  thresholds: {
    USER_HERO_THRESHOLD: number;
    GLOBAL_MIN_APPEARANCES: number;
    GLOBAL_HERO_RATE_THRESHOLD: number;
  };
}

export const USER_HERO_THRESHOLD = 2;
export const GLOBAL_MIN_APPEARANCES = 3;
export const GLOBAL_HERO_RATE_THRESHOLD = 0.5;

export async function getHeroFrequency(spaceId: string): Promise<HeroFrequencyData> {
  // Query 1: User library — recipes in this user's library, recipe_ingredients
  //          where ingredient_classification = 'hero', group by ingredient_id, count.
  // Query 2: Global — recipe_ingredients across all recipes, classification = 'hero',
  //          group by ingredient_id, count. Plus total appearances (any classification)
  //          per ingredient_id for the rate denominator.
  // Return: { userLibrary: Map, global: Map }
}

export function isHeroIngredient(
  ingredientId: string | null,
  data: HeroFrequencyData | null
): boolean {
  if (!ingredientId || !data) return false;
  const userCount = data.userLibrary.get(ingredientId) ?? 0;
  if (userCount >= USER_HERO_THRESHOLD) return true;
  const global = data.global.get(ingredientId);
  if (!global) return false;
  if (global.heroAppearances < GLOBAL_MIN_APPEARANCES) return false;
  return (global.heroAppearances / global.totalAppearances) >= GLOBAL_HERO_RATE_THRESHOLD;
}

export async function getHeroFrequencyAudit(spaceId: string): Promise<HeroAuditData> {
  // Same queries as getHeroFrequency but also fetches ingredient.name for display.
  // Returns top 30 by each axis, plus the threshold values used (so the audit dump
  // self-documents what the current decision logic is).
}
```

**Implementation notes:**

- For "user library," follow whatever scoping `pantryMatchingService` uses. If recipes are scoped via a join table (e.g., `space_recipes`), use that. If recipes are scoped via `recipes.space_id` directly, use that.
- The queries should be efficient — `recipe_ingredients` has ~5,300 rows total per the prior audit. Two single-pass aggregations.
- Return both Maps even when empty (never undefined). Callers check `isHeroIngredient` which handles null/missing gracefully.

### Part B — type additions

In `lib/types/supplies.ts`:
- Re-export the three types from `heroIngredientService.ts` if needed for cross-file convenience, OR leave them in the service file. CC's judgment.
- No other type changes.

### Part C — PantryScreen integration

In `screens/PantryScreen.tsx`:
- New state: `const [heroFrequencyData, setHeroFrequencyData] = useState<HeroFrequencyData | null>(null);`
- Load once on screen mount (before SuppliesSection renders, but in parallel — don't block render): `getHeroFrequency(spaceId).then(setHeroFrequencyData).catch(err => console.error('❌ heroFrequency load failed:', err));`
- Refresh on `refreshTrigger` change so re-pull happens with the existing refresh pattern.
- Pass `heroFrequencyData` to `SuppliesSection` as a new prop.

When `heroFrequencyData` is null (still loading or load failed), the rest of the screen should render normally — just no ⚡ markers and no Heroes pill. Don't block the Pantry on this.

### Part D — SuppliesSection inner-filter refactor

In `components/pantry/SuppliesSection.tsx`, replace the existing `activeFamily` state with a discriminated union:

```typescript
type ActiveInnerFilter =
  | { kind: 'all' }
  | { kind: 'family'; familyKey: string }
  | { kind: 'hero' };

const [activeInnerFilter, setActiveInnerFilter] = useState<ActiveInnerFilter>({ kind: 'all' });
```

Reset on outer tab change (mirrors existing pattern):
```typescript
useEffect(() => {
  setActiveInnerFilter({ kind: 'all' });
}, [activeOuterTab]);
```

**Update all `activeFamily` consumers** — anywhere the code reads `activeFamily` or `setActiveFamily`, replace with reads/writes against `activeInnerFilter`. The relevant operations:

- "Is a family filter active?" → `activeInnerFilter.kind === 'family'`
- "Which family is filtered?" → `activeInnerFilter.kind === 'family' ? activeInnerFilter.familyKey : null`
- "Is hero filter active?" → `activeInnerFilter.kind === 'hero'`
- "Is no filter active?" → `activeInnerFilter.kind === 'all'`

Define a `matchesActiveInnerFilter(supply, filter, heroData)` helper:
```typescript
function matchesActiveInnerFilter(
  s: SupplyWithTags,
  filter: ActiveInnerFilter,
  heroData: HeroFrequencyData | null
): boolean {
  if (filter.kind === 'all') return true;
  if (filter.kind === 'family') {
    return familyKeyForSupply(s).key === filter.familyKey;
  }
  // filter.kind === 'hero'
  return isHeroIngredient(s.ingredient?.id ?? null, heroData);
}
```

Replace the existing family-filter applications (`useSoonExpiringFiltered`, `useSoonFridgeFiltered`, `useSoonFreezerFiltered`, `trackOnlyAll`, `restockAll`, `lowOutFiltered`) with calls to this helper.

### Part E — Heroes pill in the family-pill strip

The family-pill strip renders on outer tabs `everything` and `use_soon`. Add a `⚡ Heroes N` pill positioned immediately after "All N" and before the first family pill.

The Heroes pill is shown only when:
- `heroFrequencyData !== null` (data loaded)
- The current outer-tab universe contains ≥1 hero supply (count > 0)
- The outer tab is `everything` or `use_soon` (NOT `low_out`)

Count: number of supplies in the current outer-tab universe that pass `isHeroIngredient`. Zero-count = pill doesn't render.

Visual:
- Inactive state: `⚡ Heroes N` — same pill chrome as the family pills (border, neutral text), with the ⚡ icon leading the label. Icon color: primary teal.
- Active state: solid teal fill, white text, white ⚡ icon. Same active styling as the family pills.

Tap behavior: toggles between `{ kind: 'all' }` and `{ kind: 'hero' }`. (Tap to activate, tap again to deactivate, same as the family pills.)

When `kind: 'hero'` is active and the user taps a family pill, the inner filter switches to `{ kind: 'family', familyKey }` — mutually exclusive selection, matching existing pattern.

### Part F — ⚡ row marker on Use Soon

In `components/pantry/SupplyRow.tsx`:
- New optional prop: `showHeroMarker?: boolean`
- When true AND the supply qualifies, render ⚡ inline before the name text. Size: 14px, color: primary teal. Position: leading the name, with a small (4-6px) gap before the name text. Don't add a new row or layout shift — it sits in line with the existing name.

In `SuppliesSection.tsx`, in `renderRow`:
- Determine if the row should show the marker: only when the current outer tab is `use_soon` AND `isHeroIngredient(supply.ingredient?.id, heroFrequencyData)` is true
- Pass `showHeroMarker={isHero}` to SupplyRow when applicable
- For Everything and Low / out tabs, do NOT pass the marker (per spec — primarily visible on Use Soon)

### Part G — AdminScreen audit button

In `screens/AdminScreen.tsx`:
- New button: "Dump Hero Frequency Audit"
- On press: calls `getHeroFrequencyAudit(activeSpaceId)`, then `console.log('🎯 Hero Frequency Audit:', JSON.stringify(result, null, 2))`
- Don't render the result in the UI — console.log is enough for tuning purposes
- Wrap in try/catch with a brief Alert on error

The audit dump should be runnable any time the user wants to inspect tuning. It's not destructive, doesn't write anything, just reads.

### Part H — DEFERRED_WORK entries

Add to `docs/DEFERRED_WORK.md`:

1. **"Hero ingredient thresholds — tune after F&F"**
   - Tag: post-F&F
   - Context: `USER_HERO_THRESHOLD = 2`, `GLOBAL_MIN_APPEARANCES = 3`, `GLOBAL_HERO_RATE_THRESHOLD = 0.5` are best-guesses. Use the audit dump (AdminScreen → "Dump Hero Frequency Audit") to see what each threshold actually surfaces post-F&F. Likely needs tuning once we have real cooking data from testers.

2. **"Hero marker visibility — currently Use Soon only"**
   - Tag: post-F&F
   - Context: ⚡ row marker is scoped to Use Soon tab per intentional UX scoping. May want to surface on Everything and Low / out tabs later if testers report wanting that visibility.

3. **"Hero/family orthogonal filtering"**
   - Tag: post-F&F
   - Context: Currently the Heroes pill and family pills are mutually exclusive (single-axis selection). If user testing shows demand for combined filters (e.g., "Pantry-family heroes"), refactor inner filter to support orthogonal dimensions. Spec'd in May 26 design session.

## Constraints

- No schema changes
- No matcher changes (8D-CP2.1 stays as-is)
- No tab refactor changes (8R-UX3 stays as-is)
- No `last_confirmed_at` changes (8R-UX4 stays as-is)
- Hero marker visibility scoped to Use Soon tab per spec — don't add to Everything or Low / out
- Heroes pill scoped to Everything and Use Soon tabs — don't add to Low / out
- Mutually exclusive filter selection (Heroes pill OR family pill, never both)
- Don't block Pantry render on hero data load (async, non-blocking)
- All thresholds defined as `export const` in heroIngredientService.ts so future tuning is one place

## Verification

1. App loads, Pantry renders normally. No new render errors.
2. Hero frequency loads on Pantry mount (check console for any service errors).
3. On Everything tab, the family-pill strip shows `[All 86] [⚡ Heroes N] Pantry 45 | Produce 20 | ...` where N is non-zero if any hero items exist in user's universe.
4. On Use Soon tab, the strip shows the same pattern with use-soon-filtered counts.
5. On Low / out tab, NO Heroes pill (just family pills as before).
6. Tap Heroes pill → outer tab content filters to hero-only supplies. Family pills counts remain unchanged (they represent outer-tab universe counts always, not filtered counts).
7. Tap a family pill while Heroes is active → Heroes deactivates, family activates. Mutually exclusive.
8. Tap Heroes pill again while active → deactivates back to All.
9. On Use Soon tab, supplies that pass `isHeroIngredient` show ⚡ inline before the name. Non-heroes show no marker.
10. On Everything and Low / out tabs, NO ⚡ markers on rows even for hero items.
11. AdminScreen "Dump Hero Frequency Audit" button works — console shows structured output with byUserLibrary and byGlobalRate arrays plus thresholds.
12. Switching outer tabs resets the inner filter to `{ kind: 'all' }` (existing pattern preserved).
13. `npx tsc --noEmit` shows no new errors.

## SESSION_LOG entry

```
### YYYY-MM-DD — 8R-UX5 — Hero ingredient marker + filter pill

**What shipped:**
- New `lib/services/heroIngredientService.ts` — `getHeroFrequency`, `isHeroIngredient`, `getHeroFrequencyAudit` + threshold constants
- `PantryScreen` loads hero frequency once on mount, refreshes on `refreshTrigger`, passes data to SuppliesSection
- `SuppliesSection`'s `activeFamily` state replaced with `activeInnerFilter` discriminated union (`{ kind: 'all' | 'family' | 'hero' }`)
- New `⚡ Heroes N` pill in the family-pill strip on Everything and Use Soon tabs, mutually exclusive with family pills
- ⚡ inline marker on Use Soon row names when the supply's ingredient is a hero (user_library_hero_count >= 2 OR (global_hero_appearances >= 3 AND global_hero_rate >= 0.5))
- AdminScreen "Dump Hero Frequency Audit" button for tuning thresholds post-F&F

**Files touched:**
- lib/services/heroIngredientService.ts (new)
- screens/PantryScreen.tsx
- components/pantry/SuppliesSection.tsx
- components/pantry/SupplyRow.tsx
- screens/AdminScreen.tsx
- docs/DEFERRED_WORK.md
- _pk_sync/ (staged updated copies)

**Thresholds (locked in `heroIngredientService.ts`):**
- USER_HERO_THRESHOLD = 2
- GLOBAL_MIN_APPEARANCES = 3
- GLOBAL_HERO_RATE_THRESHOLD = 0.5

**Deferred items added:**
- Hero ingredient thresholds — tune after F&F
- Hero marker visibility — currently Use Soon only
- Hero/family orthogonal filtering (currently mutually exclusive)

**Known tradeoffs:**
- Hero frequency loaded once per screen mount + on refreshTrigger; not real-time. If a user adds a new recipe with a new hero ingredient, the Heroes pill count won't update until next refresh. Acceptable for F&F.
- "User library" scope follows the existing pantryMatchingService recipe-scope. If we later add a more sophisticated library concept (favorites, weighted recency), this signal should follow.
```
