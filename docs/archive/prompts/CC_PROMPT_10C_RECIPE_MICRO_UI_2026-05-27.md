# CC Prompt — Phase 10C: Recipe-level micronutrient UI

## Context

Phase 10A (raw/cooked architecture fix) and 10B (micronutrient data layer) shipped earlier today 2026-05-27. The `recipe_nutrition_computed` materialized view now exposes 10 new totals for vitamin A, C, D, B12, folate, iron, calcium, potassium, magnesium, zinc. Catalog has ~3,431 USDA-sourced nutrient values backfilled across 458 ingredients.

This step (10C) wires those values into the recipe-level UI surface. Users opening a recipe on `RecipeDetailScreen` will be able to expand `RecipeNutritionPanel`, tap a new "Vitamins & minerals" sub-section, and see all 10 micros with daily-value percentages.

Design locked via wireframe review (Variant C):
- Sub-toggle behind the existing macros grid, parallel to the existing "Ingredient breakdown" toggle
- When opened, shows two labeled subsections: **Vitamins** (A, C, D, B12, Folate) and **Minerals** (Iron, Calcium, Potassium, Magnesium, Zinc)
- Each row uses the existing `NutrientRow` pattern extended with an optional gray DV % suffix
- Source disclaimer at the bottom of the section
- Per-serving values (computed from totals / servings, same pattern as the existing fiber/sugar/sodium per-serving derivations)

## Inputs to read

1. `lib/services/nutritionService.ts` — existing patterns for type + getRecipeNutrition (especially how `fiber_per_serving_g` is computed at lines ~127-130 in PK snapshot)
2. `components/RecipeNutritionPanel.tsx` — the surface being extended. Existing `NutrientRow` sub-component is the pattern to extend.

## Task

### File 1: NEW — `lib/constants/dailyValues.ts`

Create this file. Hardcoded FDA Reference Daily Intake values (revised 2016, current Nutrition Facts label). Sourced from FDA labeling guidance, not from a database. These values are stable; updating them is a deliberate code change.

```typescript
/**
 * FDA Reference Daily Intake (RDI) values, revised 2016 (current Nutrition Facts label).
 * Source: 21 CFR § 101.9(c)(8)(iv)
 * 
 * Used by RecipeNutritionPanel to compute Daily Value (DV) percentages.
 * 
 * Units must match the per-100g column units on the `ingredients` table
 * and the totals on the recipe_nutrition_computed materialized view.
 */

export const DAILY_VALUES = {
  vitamin_a_mcg: 900,    // mcg RAE (Retinol Activity Equivalents)
  vitamin_c_mg: 90,
  vitamin_d_mcg: 20,     // 800 IU
  vitamin_b12_mcg: 2.4,
  folate_mcg: 400,       // mcg DFE (Dietary Folate Equivalents)
  iron_mg: 18,
  calcium_mg: 1300,
  potassium_mg: 4700,
  magnesium_mg: 420,
  zinc_mg: 11,
} as const;

export type MicronutrientKey = keyof typeof DAILY_VALUES;

/**
 * Compute Daily Value percentage for a given micronutrient.
 * Returns an integer percent (e.g., 23 for 23%). Not capped at 100 — values 
 * above 100 are meaningful ("high in vitamin C"). Returns 0 if value is 
 * null/undefined/0.
 */
export function getDvPercent(
  value: number | null | undefined,
  key: MicronutrientKey
): number {
  if (!value) return 0;
  return Math.round((value / DAILY_VALUES[key]) * 100);
}
```

### File 2: EDIT — `lib/services/nutritionService.ts`

Two changes, both in the `RecipeNutrition` interface and the `getRecipeNutrition` function body:

**(a)** Add 10 total fields to the `RecipeNutrition` interface (after `total_sodium_mg`, before the per-serving derivations). Names must match the matview column names exactly:

```typescript
// Micronutrient totals (from materialized view)
total_vitamin_a_mcg: number;
total_vitamin_c_mg: number;
total_vitamin_d_mcg: number;
total_vitamin_b12_mcg: number;
total_folate_mcg: number;
total_iron_mg: number;
total_calcium_mg: number;
total_potassium_mg: number;
total_magnesium_mg: number;
total_zinc_mg: number;

// Per-serving derived (computed client-side from totals + servings)
vitamin_a_per_serving_mcg: number;
vitamin_c_per_serving_mg: number;
vitamin_d_per_serving_mcg: number;
vitamin_b12_per_serving_mcg: number;
folate_per_serving_mcg: number;
iron_per_serving_mg: number;
calcium_per_serving_mg: number;
potassium_per_serving_mg: number;
magnesium_per_serving_mg: number;
zinc_per_serving_mg: number;
```

**(b)** Extend the returned object in `getRecipeNutrition` to include the new fields. Mirror the existing `fiber_per_serving_g` pattern for per-serving derivation. The mg/integer-value nutrients (iron, calcium, potassium, magnesium, zinc, vitamin C) round to 1 decimal; the mcg ones (vitamin A, D, B12, folate) also round to 1 decimal for consistency. Use the existing `Math.round(((data.total_X ?? 0) / servings) * 10) / 10` idiom.

Example insertion (slot in after the existing `sodium_per_serving_mg` line, before dietary flags):

```typescript
// Micronutrient totals
total_vitamin_a_mcg: data.total_vitamin_a_mcg ?? 0,
total_vitamin_c_mg: data.total_vitamin_c_mg ?? 0,
total_vitamin_d_mcg: data.total_vitamin_d_mcg ?? 0,
total_vitamin_b12_mcg: data.total_vitamin_b12_mcg ?? 0,
total_folate_mcg: data.total_folate_mcg ?? 0,
total_iron_mg: data.total_iron_mg ?? 0,
total_calcium_mg: data.total_calcium_mg ?? 0,
total_potassium_mg: data.total_potassium_mg ?? 0,
total_magnesium_mg: data.total_magnesium_mg ?? 0,
total_zinc_mg: data.total_zinc_mg ?? 0,

// Per-serving micronutrients
vitamin_a_per_serving_mcg: Math.round(((data.total_vitamin_a_mcg ?? 0) / servings) * 10) / 10,
vitamin_c_per_serving_mg: Math.round(((data.total_vitamin_c_mg ?? 0) / servings) * 10) / 10,
vitamin_d_per_serving_mcg: Math.round(((data.total_vitamin_d_mcg ?? 0) / servings) * 10) / 10,
vitamin_b12_per_serving_mcg: Math.round(((data.total_vitamin_b12_mcg ?? 0) / servings) * 10) / 10,
folate_per_serving_mcg: Math.round(((data.total_folate_mcg ?? 0) / servings) * 10) / 10,
iron_per_serving_mg: Math.round(((data.total_iron_mg ?? 0) / servings) * 10) / 10,
calcium_per_serving_mg: Math.round(((data.total_calcium_mg ?? 0) / servings) * 10) / 10,
potassium_per_serving_mg: Math.round(((data.total_potassium_mg ?? 0) / servings) * 10) / 10,
magnesium_per_serving_mg: Math.round(((data.total_magnesium_mg ?? 0) / servings) * 10) / 10,
zinc_per_serving_mg: Math.round(((data.total_zinc_mg ?? 0) / servings) * 10) / 10,
```

**Do NOT modify** `aggregateMealNutrition` or `getCompactNutrition` in this checkpoint. Meal-level micro aggregation belongs to 10E; feed-card compact view doesn't need micros.

### File 3: EDIT — `components/RecipeNutritionPanel.tsx`

Three changes:

**(a)** Add new state at the top of the component, alongside `showIngredients`:

```typescript
const [showMicros, setShowMicros] = useState(false);
```

**(b)** Extend the `NutrientRow` sub-component (at the bottom of the file) to accept an optional `dvPercent` prop. When provided, render it as a smaller, secondary-text-color suffix appended to the value:

```typescript
function NutrientRow({
  label,
  value,
  unit,
  dvPercent,
}: {
  label: string;
  value: number;
  unit: string;
  dvPercent?: number;
}) {
  const formattedValue = typeof value === 'number' && value % 1 !== 0 
    ? value.toFixed(1) 
    : Math.round(value);
  return (
    <View style={styles.nutrientRow}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <View style={styles.nutrientValueContainer}>
        <Text style={styles.nutrientValue}>
          {formattedValue}{unit}
        </Text>
        {dvPercent !== undefined && (
          <Text style={styles.nutrientDvPercent}>
            {' '}({dvPercent}% DV)
          </Text>
        )}
      </View>
    </View>
  );
}
```

Add the corresponding styles to the StyleSheet:

```typescript
nutrientValueContainer: {
  flexDirection: 'row',
  alignItems: 'baseline',
},
nutrientDvPercent: {
  fontSize: 13,
  color: '#888',
  // Lighter weight than the main value
},
```

**(c)** Insert the new Vitamins & Minerals section between the Detailed Macros Grid (currently ending at line ~208) and the Quality Indicator (currently starting at line ~211). Pattern matches the existing "Ingredient breakdown" toggle.

Import the new helpers at the top of the file:

```typescript
import { getDvPercent } from '../lib/constants/dailyValues';
```

Then insert the new section between the macros grid and the quality indicator:

```typescript
{/* Vitamins & Minerals Toggle */}
<TouchableOpacity
  style={styles.microsToggle}
  onPress={() => setShowMicros(!showMicros)}
  activeOpacity={0.7}
>
  <Text style={styles.microsToggleText}>
    {showMicros ? '▼' : '▶'} Vitamins & minerals
  </Text>
</TouchableOpacity>

{showMicros && (
  <View style={styles.microsSection}>
    {/* Vitamins subsection */}
    <Text style={styles.microsSubsectionLabel}>Vitamins</Text>
    <NutrientRow
      label="Vitamin A"
      value={nutrition.vitamin_a_per_serving_mcg}
      unit="mcg"
      dvPercent={getDvPercent(nutrition.vitamin_a_per_serving_mcg, 'vitamin_a_mcg')}
    />
    <NutrientRow
      label="Vitamin C"
      value={nutrition.vitamin_c_per_serving_mg}
      unit="mg"
      dvPercent={getDvPercent(nutrition.vitamin_c_per_serving_mg, 'vitamin_c_mg')}
    />
    <NutrientRow
      label="Vitamin D"
      value={nutrition.vitamin_d_per_serving_mcg}
      unit="mcg"
      dvPercent={getDvPercent(nutrition.vitamin_d_per_serving_mcg, 'vitamin_d_mcg')}
    />
    <NutrientRow
      label="Vitamin B12"
      value={nutrition.vitamin_b12_per_serving_mcg}
      unit="mcg"
      dvPercent={getDvPercent(nutrition.vitamin_b12_per_serving_mcg, 'vitamin_b12_mcg')}
    />
    <NutrientRow
      label="Folate"
      value={nutrition.folate_per_serving_mcg}
      unit="mcg"
      dvPercent={getDvPercent(nutrition.folate_per_serving_mcg, 'folate_mcg')}
    />

    {/* Minerals subsection */}
    <Text style={styles.microsSubsectionLabel}>Minerals</Text>
    <NutrientRow
      label="Iron"
      value={nutrition.iron_per_serving_mg}
      unit="mg"
      dvPercent={getDvPercent(nutrition.iron_per_serving_mg, 'iron_mg')}
    />
    <NutrientRow
      label="Calcium"
      value={nutrition.calcium_per_serving_mg}
      unit="mg"
      dvPercent={getDvPercent(nutrition.calcium_per_serving_mg, 'calcium_mg')}
    />
    <NutrientRow
      label="Potassium"
      value={nutrition.potassium_per_serving_mg}
      unit="mg"
      dvPercent={getDvPercent(nutrition.potassium_per_serving_mg, 'potassium_mg')}
    />
    <NutrientRow
      label="Magnesium"
      value={nutrition.magnesium_per_serving_mg}
      unit="mg"
      dvPercent={getDvPercent(nutrition.magnesium_per_serving_mg, 'magnesium_mg')}
    />
    <NutrientRow
      label="Zinc"
      value={nutrition.zinc_per_serving_mg}
      unit="mg"
      dvPercent={getDvPercent(nutrition.zinc_per_serving_mg, 'zinc_mg')}
    />

    <Text style={styles.microsDisclaimer}>
      Estimates based on USDA data and ingredient matching. Directional, not for medical use.
    </Text>
  </View>
)}
```

Add styles to the StyleSheet to support the new elements. Match the existing `ingredientToggle` / `ingredientToggleText` style values for visual consistency between the two parallel toggles:

```typescript
microsToggle: {
  // Mirror styles.ingredientToggle exactly — same padding, borderTop, etc.
  // Goal is parallel visual treatment so users recognize the pattern.
},
microsToggleText: {
  // Mirror styles.ingredientToggleText exactly
},
microsSection: {
  paddingTop: 8,
  paddingBottom: 4,
},
microsSubsectionLabel: {
  fontSize: 11,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginTop: 8,
  marginBottom: 4,
},
microsDisclaimer: {
  fontSize: 11,
  color: '#999',
  fontStyle: 'italic',
  marginTop: 12,
  marginBottom: 4,
  lineHeight: 16,
},
```

Look up the actual values of `ingredientToggle` and `ingredientToggleText` in the existing StyleSheet (probably near lines 460-475 in PK snapshot) and copy them verbatim into `microsToggle` and `microsToggleText` so the two toggles look identical when stacked.

## Constraints

- DO NOT modify the matview (already done in 10B-6)
- DO NOT modify `aggregateMealNutrition` or `getCompactNutrition` — those belong to 10E
- DO NOT add new dependencies — use existing React Native primitives only
- DO NOT change visual treatment of existing macros section — only add the new micros section
- DO NOT cap DV percentages at 100% — values above 100 (e.g., vitamin C in a citrus-heavy recipe) are meaningful
- Sub-toggle MUST visually match the existing "Ingredient breakdown" toggle (same font size, color, padding, border)
- Disclaimer wording MUST be exactly: `"Estimates based on USDA data and ingredient matching. Directional, not for medical use."`
- All TypeScript MUST type-check with the existing strict mode settings — no `any`, no `@ts-ignore`

## Verification

Before reporting done, run:

1. `npx tsc --noEmit` — confirm zero new type errors
2. Search for typos / wrong field names:
   ```bash
   grep -E "(total_|per_serving_)(vitamin|folate|iron|calcium|potassium|magnesium|zinc)" lib/services/nutritionService.ts | wc -l
   # Expect 30 matches: 10 in the interface, 10 in the totals mapping, 10 in the per-serving mapping
   ```
3. Confirm new file exists: `ls lib/constants/dailyValues.ts`
4. Confirm `getDvPercent` is imported in the panel: `grep "getDvPercent" components/RecipeNutritionPanel.tsx`
5. Confirm disclaimer wording is exact: `grep "Directional, not for medical use" components/RecipeNutritionPanel.tsx`

## Manual smoke test guidance for Tom (post-CC)

After CC reports done, Tom should:
1. Run the app locally (`npx expo start`)
2. Open any recipe — e.g., "Lemon and eggplant risotto" 
3. Tap to expand the nutrition panel
4. Tap "▶ Vitamins & minerals" — should reveal 10 rows in two subsections with DV %
5. Verify the values look directionally correct (vitamin C should be ~14mg / 16% DV for risotto)
6. Tap to collapse — should hide the micros section cleanly
7. Open a recipe with NO ingredients matched (if one exists) — confirm the panel doesn't crash with zero/null micros

## SESSION_LOG entry

Append to `docs/SESSION_LOG.md` under the 2026-05-27 entry (after the 10B entries already there):

```
### Phase 10C — Recipe-level micronutrient UI shipped
Extended RecipeDetailScreen's nutrition panel to display 10 micronutrients with DV percentages.

Files touched:
- NEW `lib/constants/dailyValues.ts` — FDA RDI constants + getDvPercent helper
- `lib/services/nutritionService.ts` — added 10 totals + 10 per-serving fields to RecipeNutrition; mapped from materialized view
- `components/RecipeNutritionPanel.tsx` — added "Vitamins & minerals" sub-toggle section with Vitamins / Minerals subsections, per Variant C wireframe

Design notes:
- Sub-toggle behind macros grid, parallel to "Ingredient breakdown" toggle (same visual treatment)
- 10 rows split: Vitamins (A, C, D, B12, Folate), Minerals (Iron, Calcium, Potassium, Magnesium, Zinc)
- DV % shown as small gray suffix on each row, not capped at 100%
- Disclaimer "Estimates based on USDA data and ingredient matching. Directional, not for medical use." at section bottom

Verified: npx tsc --noEmit clean; grep counts match; panel visually matches Variant C wireframe.

Pending: Tom smoke test in Expo Go.
```

## Reporting back

When done, paste:
1. Result of `npx tsc --noEmit` (should be clean)
2. The grep counts from verification step 2
3. Confirmation files exist
4. Any deviations or unexpected issues
5. The SESSION_LOG entry you appended
