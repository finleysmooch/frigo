# CC Prompt — Phase 10D: Stats-screen micronutrient surface

## Context

Phase 10C (recipe-level micro UI) shipped earlier today 2026-05-27. This step (10D) wires the same 10 micronutrients into the Stats tab's Nutrition sub-page, replacing the existing 🔬 placeholder card at `components/stats/StatsNutrition.tsx` lines ~263-273.

Design locked via wireframe review:
- New "Micronutrients" card replaces the placeholder
- Two subsections: **Vitamins** (A, C, D, B12, Folate) and **Minerals** (Iron, Calcium, Potassium, Magnesium, Zinc)
- Each row uses the existing `NutrientRow` component (no color dots for micros — visual noise reduction), with name + value-with-unit + DV % suffix
- Rows are tappable to drill down (re-uses existing `NutrientDrillDown` pattern, set `hasSources: false` so "Source tracking coming soon" fallback fires)
- **Per Day / Per Meal toggle is being lifted** out of `GoalsSection` into a new shared position above both cards. State name renames from `goalsPeriod` → `nutritionPeriod` to reflect broader scope. Both Goals and Micronutrients cards read from the same state — single source of truth, no synchronization concerns.

## Inputs to read

1. `lib/services/statsService.ts` — extension target. Particularly: `StatsNutrient` type (line ~988), `NutritionAverages` interface (line ~880), `getNutrientValue` switch (line ~1061), `nutrientToIngredientColumn` (line ~1075), `getNutritionAverages` (line ~1592), `getNutrientTrend` (line ~1649), `getHighestNutrientRecipes` (line ~1751)
2. `components/stats/StatsNutrition.tsx` — main file. Particularly: state initialization (lines ~100-103), `NUTRIENTS` config (line ~81), `NUTRIENT_AVERAGES_MAP` (line ~553), `GoalsSection` toggle JSX (lines ~599-613), placeholder card (lines ~263-273)
3. `components/stats/NutrientRow.tsx` — needs two new optional props
4. `lib/constants/dailyValues.ts` — created in 10C, contains `DAILY_VALUES` constant + `getDvPercent` helper

## Task

### Edit 1 — `lib/services/statsService.ts`

**(a)** Extend the `StatsNutrient` type union (line ~988) to add 10 micro keys:

```typescript
export type StatsNutrient =
  | 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium'
  | 'vitamin_a' | 'vitamin_c' | 'vitamin_d' | 'vitamin_b12' | 'folate'
  | 'iron' | 'calcium' | 'potassium' | 'magnesium' | 'zinc';
```

**(b)** Extend `NutritionAverages` interface (line ~880) to add 10 micro fields:

```typescript
export interface NutritionAverages {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
  // Micronutrients (per-meal averages — multiply by MEALS_PER_DAY in UI for daily)
  vitamin_a: number;       // mcg
  vitamin_c: number;       // mg
  vitamin_d: number;       // mcg
  vitamin_b12: number;     // mcg
  folate: number;          // mcg
  iron: number;            // mg
  calcium: number;         // mg
  potassium: number;       // mg
  magnesium: number;       // mg
  zinc: number;            // mg
}
```

**(c)** Extend `getNutritionAverages` (line ~1592) to compute the 10 new averages. Mirror the existing fiber/sugar/sodium pattern — micros also use `total / servings` since the matview only stores totals:

- Extend the `.select(...)` string to add the 10 `total_*` columns
- Update the empty-return defaults in both branches to include the 10 micros with value 0
- In the accumulation loop, add `totalVitA += (n.total_vitamin_a_mcg ?? 0) / servings;` for each of the 10
- In the final return, add `vitamin_a: Math.round((totalVitA / count) * 10) / 10,` etc.
- Match precision: integers OR 1-decimal — use `Math.round((x / count) * 10) / 10` for 1-decimal consistency with existing fiber/sugar pattern

**(d)** Extend `getNutrientValue` switch (line ~1061) to handle the 10 new cases. Same pattern as fiber/sugar/sodium:

```typescript
case 'vitamin_a':    return (row.total_vitamin_a_mcg ?? 0) / servings;
case 'vitamin_c':    return (row.total_vitamin_c_mg ?? 0) / servings;
case 'vitamin_d':    return (row.total_vitamin_d_mcg ?? 0) / servings;
case 'vitamin_b12':  return (row.total_vitamin_b12_mcg ?? 0) / servings;
case 'folate':       return (row.total_folate_mcg ?? 0) / servings;
case 'iron':         return (row.total_iron_mg ?? 0) / servings;
case 'calcium':      return (row.total_calcium_mg ?? 0) / servings;
case 'potassium':    return (row.total_potassium_mg ?? 0) / servings;
case 'magnesium':    return (row.total_magnesium_mg ?? 0) / servings;
case 'zinc':         return (row.total_zinc_mg ?? 0) / servings;
```

**(e)** Leave `nutrientToIngredientColumn` (line ~1075) unchanged — its default case returns null which is correct behavior for micros (source-tracking falls back to "coming soon" message).

**(f)** Extend `getNutrientTrend` (line ~1649) — extend the `.select(...)` string to include the 10 `total_*` micro columns. The function uses `getNutrientValue` so no other changes needed.

**(g)** Extend `getHighestNutrientRecipes` (line ~1751) — same as (f), extend the `.select(...)` string.

### Edit 2 — `components/stats/NutrientRow.tsx`

Add two new optional props:

```typescript
interface NutrientRowProps {
  name: string;
  dotColor: string;
  value: string;
  onPress?: () => void;
  hideDot?: boolean;       // NEW — when true, skip rendering the colored dot entirely
  dvSuffix?: string;       // NEW — small gray text rendered after the value, e.g. "23% DV"
}
```

Behavior:
- When `hideDot === true`, do NOT render the colored dot circle. The name column should still left-align the same way (use a transparent placeholder or just shift styling — match what makes the rows align visually with the macro rows above)
- When `dvSuffix` is provided, render it after the value in smaller, secondary-text-color font (font-size 12-13, color matches existing `colors.text.secondary` or equivalent)
- Both props must be optional with default falsy values — existing call sites in the macros section MUST NOT break

### Edit 3 — `components/stats/StatsNutrition.tsx`

**(a)** Rename state variable (line ~103) and update its setter use everywhere in the file:

```typescript
// Before:
const [goalsPeriod, setGoalsPeriod] = useState<'daily' | 'per_meal'>('daily');

// After:
const [nutritionPeriod, setNutritionPeriod] = useState<'daily' | 'per_meal'>('daily');
```

Search the file for all uses of `goalsPeriod` / `setGoalsPeriod` and rename. Including in the `GoalsSection` props (drop the toggle prop callback, see (c) below).

**(b)** Lift the Per Day / Per Meal toggle out of `GoalsSection` and render it as a new row in the main `StatsNutrition` JSX, **positioned between the Nutrition Averages card and the GoalsSection call** (around current line ~248-249). 

Use the same visual style as the current toggle. Wrap in a centered container so it doesn't visually attach to either card. Suggested JSX shape:

```typescript
{/* Period selector — shared by Goals + Micronutrients */}
<View style={styles.nutritionPeriodToggleContainer}>
  <View style={styles.goalsModeToggle}>
    <TouchableOpacity
      style={[styles.goalsModeBtn, nutritionPeriod === 'daily' && styles.goalsModeBtnActive]}
      onPress={() => setNutritionPeriod('daily')}
    >
      <Text style={[styles.goalsModeBtnText, nutritionPeriod === 'daily' && styles.goalsModeBtnTextActive]}>Per Day</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.goalsModeBtn, nutritionPeriod === 'per_meal' && styles.goalsModeBtnActive]}
      onPress={() => setNutritionPeriod('per_meal')}
    >
      <Text style={[styles.goalsModeBtnText, nutritionPeriod === 'per_meal' && styles.goalsModeBtnTextActive]}>Per Meal</Text>
    </TouchableOpacity>
  </View>
</View>
```

Add the new style:
```typescript
nutritionPeriodToggleContainer: {
  alignItems: 'center',
  marginBottom: spacing.md,
},
```

**(c)** Update `GoalsSection` to drop the toggle props (`goalsPeriod`, `onGoalsPeriodChange`) and accept a single `period` prop instead. Remove the toggle JSX (lines ~599-613) from inside the component. Update the call site to pass `period={nutritionPeriod}` instead.

The internal usage of `goalsPeriod === 'daily'` inside the function body becomes `period === 'daily'`.

**(d)** Extend the `NUTRIENTS` config (line ~81) to add 10 micro entries. Add a new optional field `hideDot?: boolean` to `NutrientConfig` interface. Add entries for the 10 micros with `hasSources: false, hideDot: true`, and any color value (won't be rendered) — use empty strings or the existing border color:

```typescript
interface NutrientConfig {
  key: StatsNutrient;
  label: string;
  unit: string;
  color: string;
  bg: string;
  hasSources: boolean;
  hideDot?: boolean;       // NEW — micros skip the colored dot
}

const NUTRIENTS: NutrientConfig[] = [
  // ... existing 6 macro entries unchanged ...
  // Vitamins
  { key: 'vitamin_a',   label: 'Vitamin A',   unit: 'mcg', color: '', bg: '', hasSources: false, hideDot: true },
  { key: 'vitamin_c',   label: 'Vitamin C',   unit: 'mg',  color: '', bg: '', hasSources: false, hideDot: true },
  { key: 'vitamin_d',   label: 'Vitamin D',   unit: 'mcg', color: '', bg: '', hasSources: false, hideDot: true },
  { key: 'vitamin_b12', label: 'Vitamin B12', unit: 'mcg', color: '', bg: '', hasSources: false, hideDot: true },
  { key: 'folate',      label: 'Folate',      unit: 'mcg', color: '', bg: '', hasSources: false, hideDot: true },
  // Minerals
  { key: 'iron',        label: 'Iron',        unit: 'mg',  color: '', bg: '', hasSources: false, hideDot: true },
  { key: 'calcium',     label: 'Calcium',     unit: 'mg',  color: '', bg: '', hasSources: false, hideDot: true },
  { key: 'potassium',   label: 'Potassium',   unit: 'mg',  color: '', bg: '', hasSources: false, hideDot: true },
  { key: 'magnesium',   label: 'Magnesium',   unit: 'mg',  color: '', bg: '', hasSources: false, hideDot: true },
  { key: 'zinc',        label: 'Zinc',        unit: 'mg',  color: '', bg: '', hasSources: false, hideDot: true },
];
```

Also add to `NUTRIENT_AVERAGES_MAP` (line ~553) the 10 micro entries — keys match `StatsNutrient` values:

```typescript
const NUTRIENT_AVERAGES_MAP: Record<string, keyof NutritionAverages> = {
  calories: 'calories', protein: 'protein', carbs: 'carbs',
  fat: 'fat', fiber: 'fiber', sodium: 'sodium',
  // Micros — for future goal-setting; not currently used but kept consistent
  vitamin_a: 'vitamin_a', vitamin_c: 'vitamin_c', vitamin_d: 'vitamin_d',
  vitamin_b12: 'vitamin_b12', folate: 'folate',
  iron: 'iron', calcium: 'calcium', potassium: 'potassium',
  magnesium: 'magnesium', zinc: 'zinc',
};
```

**(e)** Replace the placeholder Micronutrients card (lines ~263-273) with a new section. Two subsection labels (Vitamins, Minerals), 10 NutrientRow rows, drill-down support, disclaimer at bottom.

Import the DV helper:
```typescript
import { getDvPercent } from '../../lib/constants/dailyValues';
import type { MicronutrientKey } from '../../lib/constants/dailyValues';
```

Helper to convert StatsNutrient key to MicronutrientKey for `getDvPercent`:

```typescript
// Maps StatsNutrient micro keys to MicronutrientKey for DV lookup
const MICRO_DV_KEY_MAP: Partial<Record<StatsNutrient, MicronutrientKey>> = {
  vitamin_a: 'vitamin_a_mcg',
  vitamin_c: 'vitamin_c_mg',
  vitamin_d: 'vitamin_d_mcg',
  vitamin_b12: 'vitamin_b12_mcg',
  folate: 'folate_mcg',
  iron: 'iron_mg',
  calcium: 'calcium_mg',
  potassium: 'potassium_mg',
  magnesium: 'magnesium_mg',
  zinc: 'zinc_mg',
};
```

The new Micronutrients card replaces the placeholder JSX:

```typescript
{/* Micronutrients */}
<View style={styles.card}>
  <Text style={styles.cardTitle}>Micronutrients</Text>

  {averages && (
    <>
      {/* Vitamins subsection */}
      <Text style={styles.microsSubsectionLabel}>Vitamins</Text>
      {NUTRIENTS.filter(n => ['vitamin_a','vitamin_c','vitamin_d','vitamin_b12','folate'].includes(n.key)).map(n => {
        const perMealValue = averages[n.key as keyof NutritionAverages] ?? 0;
        const displayValue = nutritionPeriod === 'daily'
          ? Math.round(perMealValue * MEALS_PER_DAY * 10) / 10
          : perMealValue;
        const dvKey = MICRO_DV_KEY_MAP[n.key];
        const dvPercent = dvKey ? getDvPercent(displayValue, dvKey) : 0;
        return (
          <React.Fragment key={n.key}>
            <NutrientRow
              name={n.label}
              dotColor=""
              hideDot
              value={`${displayValue}${n.unit}`}
              dvSuffix={`${dvPercent}% DV`}
              onPress={() => handleNutrientPress(n.key)}
            />
            {expandedNutrient === n.key && (
              <NutrientDrillDown
                nutrientConfig={n}
                params={params}
                colors={colors}
                styles={styles}
                onClose={() => setExpandedNutrient(null)}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Minerals subsection */}
      <Text style={styles.microsSubsectionLabel}>Minerals</Text>
      {NUTRIENTS.filter(n => ['iron','calcium','potassium','magnesium','zinc'].includes(n.key)).map(n => {
        const perMealValue = averages[n.key as keyof NutritionAverages] ?? 0;
        const displayValue = nutritionPeriod === 'daily'
          ? Math.round(perMealValue * MEALS_PER_DAY * 10) / 10
          : perMealValue;
        const dvKey = MICRO_DV_KEY_MAP[n.key];
        const dvPercent = dvKey ? getDvPercent(displayValue, dvKey) : 0;
        return (
          <React.Fragment key={n.key}>
            <NutrientRow
              name={n.label}
              dotColor=""
              hideDot
              value={`${displayValue}${n.unit}`}
              dvSuffix={`${dvPercent}% DV`}
              onPress={() => handleNutrientPress(n.key)}
            />
            {expandedNutrient === n.key && (
              <NutrientDrillDown
                nutrientConfig={n}
                params={params}
                colors={colors}
                styles={styles}
                onClose={() => setExpandedNutrient(null)}
              />
            )}
          </React.Fragment>
        );
      })}

      <Text style={styles.microsDisclaimer}>
        Estimates based on USDA data and ingredient matching. Directional, not for medical use.
      </Text>
    </>
  )}
</View>
```

Add the new styles:

```typescript
microsSubsectionLabel: {
  fontSize: 11,
  color: colors.text.tertiary,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginTop: spacing.md,
  marginBottom: spacing.xs,
},
microsDisclaimer: {
  fontSize: 11,
  color: colors.text.tertiary,
  fontStyle: 'italic',
  marginTop: spacing.md,
  paddingTop: spacing.md,
  borderTopWidth: 0.5,
  borderTopColor: colors.border.light,
  lineHeight: 16,
},
```

## Constraints

- DO NOT modify matview or recipe_nutrition_computed — that's done in 10B
- DO NOT modify NutritionGoalsModal or `user_nutrition_goals` table — goal-setting for micros is deferred to v2 (will be a DEFERRED_WORK item)
- DO NOT add color dots to micros — visual cleanliness lock
- DO NOT add a second toggle in the Micronutrients card — single toggle is the design lock
- The new period state name MUST be `nutritionPeriod` (not `goalsPeriod`) — rename is intentional to reflect broader scope
- Existing macro section behavior MUST NOT change — toggle does NOT affect Nutrition Averages card display
- All TS must type-check with strict mode — no `any`, no `@ts-ignore`
- Existing NutrientRow call sites for macros (6 places) MUST NOT break — `hideDot` and `dvSuffix` are optional with default falsy

## Verification

Before reporting done:

1. `npx tsc --noEmit` — confirm zero new type errors
2. `grep -c "goalsPeriod\|setGoalsPeriod" components/stats/StatsNutrition.tsx` — should return 0 (all renamed)
3. `grep -c "nutritionPeriod\|setNutritionPeriod" components/stats/StatsNutrition.tsx` — should return ≥3 (state, setter, GoalsSection prop pass)
4. `grep "vitamin_a\|vitamin_c\|folate\|iron" lib/services/statsService.ts | wc -l` — should be ≥10 (multiple matches across NutritionAverages, getNutritionAverages, getNutrientValue, etc.)
5. `grep "Directional, not for medical use" components/stats/StatsNutrition.tsx` — exact disclaimer match
6. The 🔬 emoji string should NO LONGER appear in StatsNutrition.tsx — `grep "🔬" components/stats/StatsNutrition.tsx` returns nothing

## Smoke test guidance for Tom (post-CC)

1. Open the app, navigate to Stats → Nutrition tab
2. Verify the toggle pill appears between the Nutrition Averages card and Goals card
3. Toggle to Per Day mode — Goals values should multiply by ~2.5× as before. Micronutrients DV % should increase proportionally
4. Toggle back to Per Meal — both should return to prior values
5. Scroll to Micronutrients card — verify 10 rows in Vitamins/Minerals subsections, no color dots
6. Tap "Iron" row — drill-down panel should open inline. Should show weekly trend + highest-iron recipes. "Top sources" section should show "Source tracking coming soon for iron"
7. Tap iron row again — drill-down collapses
8. Verify a recipe-with-no-matched-ingredients case if one exists in your cooks — micros should show as `0mcg (0% DV)` without crashing

## SESSION_LOG entry

Append under today's 2026-05-27 day header, after the 10C entry:

```
### Phase 10D — Stats-screen micronutrient surface shipped

Replaced 🔬 placeholder in StatsNutrition with a real Micronutrients card showing 10 nutrients in Vitamins/Minerals subsections with DV percentages. Drill-down per nutrient works (top recipes + weekly trend; top sources shows "coming soon" placeholder for micros).

Hoisted the Per Day / Per Meal toggle out of GoalsSection into a shared position above both Goals and Micronutrients cards. State renamed from `goalsPeriod` → `nutritionPeriod` to reflect broader scope. Single source of truth, both cards stay in sync.

Files touched:
- `lib/services/statsService.ts` — extended StatsNutrient type, NutritionAverages interface, getNutritionAverages, getNutrientValue switch, getNutrientTrend & getHighestNutrientRecipes SELECTs (10 micros each)
- `components/stats/NutrientRow.tsx` — added optional hideDot and dvSuffix props
- `components/stats/StatsNutrition.tsx` — renamed nutritionPeriod state, lifted toggle UI, replaced placeholder card with new Micronutrients section, extended NUTRIENTS config and NUTRIENT_AVERAGES_MAP, added MICRO_DV_KEY_MAP helper

Deferred: goal-setting for micros (extend NutritionGoalsModal to expose micro sliders) — `user_nutrition_goals` table schema already supports any nutrient name, so this is non-breaking. Will track in DEFERRED_WORK as P10D-1.

Pending: Tom smoke test in Expo Go.
```

## Reporting back

When done, paste:
1. Result of `npx tsc --noEmit`
2. The grep counts from verification steps 2-6
3. Any deviations / unexpected issues
4. The SESSION_LOG entry
