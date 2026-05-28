// components/MealNutritionPanel.tsx
// Phase 10E — Meal-level nutrition aggregation panel.
//
// Used by MealEventDetailScreen and MealDetailScreen. Always-expanded
// (no outer collapse — at the meal page users have already opted in to detail);
// Vitamins & minerals are behind a sub-toggle matching the recipe panel pattern.
//
// Aggregation semantic: one serving of each dish in the meal.

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  RecipeNutrition,
  MealNutrition,
  getRecipeNutritionBatch,
  aggregateMealNutrition,
  getActiveDietaryFlags,
  getQualityDisplayText,
  getQualityExplanation,
  getQualityColor,
} from '../lib/services/nutritionService';
import DietaryBadgeRow from './DietaryBadgeRow';
import { getDvPercent } from '../lib/constants/dailyValues';

interface MealNutritionPanelProps {
  recipeIds: string[];
}

export default function MealNutritionPanel({ recipeIds }: MealNutritionPanelProps) {
  const [nutrition, setNutrition] = useState<MealNutrition | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMicros, setShowMicros] = useState(false);
  const [emptyAggregation, setEmptyAggregation] = useState(false);

  useEffect(() => {
    loadNutrition();
    // recipeIds is an array — depend on its stringified form to avoid stale effects
    // when the parent re-renders with the same id set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeIds.join('|')]);

  const loadNutrition = async () => {
    if (recipeIds.length === 0) {
      setNutrition(null);
      setEmptyAggregation(false);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setEmptyAggregation(false);
      const map = await getRecipeNutritionBatch(recipeIds);
      const rows: RecipeNutrition[] = Array.from(map.values());
      const agg = aggregateMealNutrition(rows, recipeIds.length);
      setNutrition(agg);
      if (!agg) setEmptyAggregation(true);
    } catch (error) {
      console.error('Error loading meal nutrition:', error);
      setNutrition(null);
    } finally {
      setLoading(false);
    }
  };

  // Parent should already gate on dishes existing; we still defensively render
  // nothing when there are no recipe ids at all.
  if (recipeIds.length === 0) return null;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#999" />
          <Text style={styles.loadingText}>Loading meal nutrition...</Text>
        </View>
      </View>
    );
  }

  // Empty aggregation state — recipes existed but none had nutrition data
  if (emptyAggregation || !nutrition) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Meal nutrition</Text>
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>No nutrition data available yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Add recipes to dishes to see meal nutrition
          </Text>
        </View>
      </View>
    );
  }

  const dietaryFlags = getActiveDietaryFlags({
    is_vegan: nutrition.is_vegan,
    is_vegetarian: nutrition.is_vegetarian,
    is_gluten_free: nutrition.is_gluten_free,
    is_dairy_free: nutrition.is_dairy_free,
    is_nut_free: nutrition.is_nut_free,
    is_shellfish_free: nutrition.is_shellfish_free,
    is_soy_free: nutrition.is_soy_free,
    is_egg_free: nutrition.is_egg_free,
  } as RecipeNutrition);

  const qualityColor = getQualityColor(nutrition.quality_label);

  // Macro proportion bar (percentage of total macro grams)
  const totalMacroG =
    nutrition.protein_per_person_g +
    nutrition.fat_per_person_g +
    nutrition.carbs_per_person_g;

  const proteinPct = totalMacroG > 0 ? (nutrition.protein_per_person_g / totalMacroG) * 100 : 0;
  const fatPct = totalMacroG > 0 ? (nutrition.fat_per_person_g / totalMacroG) * 100 : 0;
  const carbsPct = totalMacroG > 0 ? (nutrition.carbs_per_person_g / totalMacroG) * 100 : 0;

  const handleQualityInfo = () => {
    Alert.alert(
      getQualityDisplayText(nutrition.quality_label),
      getQualityExplanation(nutrition.quality_label)
    );
  };

  const hasPartialData = nutrition.dishes_with_nutrition < nutrition.total_dishes;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Meal nutrition</Text>
      <Text style={styles.subtitle}>Total · one serving of each dish</Text>

      {/* Calorie headline */}
      <View style={styles.headlineRow}>
        <Text style={styles.calorieText}>
          {nutrition.cal_per_person}
          <Text style={styles.calorieUnit}> cal</Text>
        </Text>
      </View>

      {/* Dietary badges */}
      {dietaryFlags.length > 0 && (
        <View style={styles.badgeRow}>
          <DietaryBadgeRow flags={dietaryFlags} />
        </View>
      )}

      {/* Macro Proportion Bar */}
      <View style={styles.macroBarContainer}>
        <View style={styles.macroBarRow}>
          {proteinPct > 0 && (
            <View style={[styles.macroBarSegment, { flex: proteinPct, backgroundColor: '#4A9B4F' }]} />
          )}
          {carbsPct > 0 && (
            <View style={[styles.macroBarSegment, { flex: carbsPct, backgroundColor: '#FF9500' }]} />
          )}
          {fatPct > 0 && (
            <View style={[styles.macroBarSegment, { flex: fatPct, backgroundColor: '#007AFF' }]} />
          )}
        </View>
        <View style={styles.macroBarLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4A9B4F' }]} />
            <Text style={styles.legendText}>Protein {Math.round(proteinPct)}%</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
            <Text style={styles.legendText}>Carbs {Math.round(carbsPct)}%</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
            <Text style={styles.legendText}>Fat {Math.round(fatPct)}%</Text>
          </View>
        </View>
      </View>

      {/* Macro grid */}
      <View style={styles.detailGrid}>
        <NutrientRow label="Protein" value={nutrition.protein_per_person_g} unit="g" />
        <NutrientRow label="Carbs" value={nutrition.carbs_per_person_g} unit="g" />
        <NutrientRow label="Fat" value={nutrition.fat_per_person_g} unit="g" />
        <NutrientRow label="Fiber" value={nutrition.fiber_per_person_g} unit="g" />
        <NutrientRow label="Sugar" value={nutrition.sugar_per_person_g} unit="g" />
        <NutrientRow label="Sodium" value={nutrition.sodium_per_person_mg} unit="mg" />
      </View>

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
            value={nutrition.vitamin_a_per_person_mcg}
            unit="mcg"
            dvPercent={getDvPercent(nutrition.vitamin_a_per_person_mcg, 'vitamin_a_mcg')}
          />
          <NutrientRow
            label="Vitamin C"
            value={nutrition.vitamin_c_per_person_mg}
            unit="mg"
            dvPercent={getDvPercent(nutrition.vitamin_c_per_person_mg, 'vitamin_c_mg')}
          />
          <NutrientRow
            label="Vitamin D"
            value={nutrition.vitamin_d_per_person_mcg}
            unit="mcg"
            dvPercent={getDvPercent(nutrition.vitamin_d_per_person_mcg, 'vitamin_d_mcg')}
          />
          <NutrientRow
            label="Vitamin B12"
            value={nutrition.vitamin_b12_per_person_mcg}
            unit="mcg"
            dvPercent={getDvPercent(nutrition.vitamin_b12_per_person_mcg, 'vitamin_b12_mcg')}
          />
          <NutrientRow
            label="Folate"
            value={nutrition.folate_per_person_mcg}
            unit="mcg"
            dvPercent={getDvPercent(nutrition.folate_per_person_mcg, 'folate_mcg')}
          />

          {/* Minerals subsection */}
          <Text style={styles.microsSubsectionLabel}>Minerals</Text>
          <NutrientRow
            label="Iron"
            value={nutrition.iron_per_person_mg}
            unit="mg"
            dvPercent={getDvPercent(nutrition.iron_per_person_mg, 'iron_mg')}
          />
          <NutrientRow
            label="Calcium"
            value={nutrition.calcium_per_person_mg}
            unit="mg"
            dvPercent={getDvPercent(nutrition.calcium_per_person_mg, 'calcium_mg')}
          />
          <NutrientRow
            label="Potassium"
            value={nutrition.potassium_per_person_mg}
            unit="mg"
            dvPercent={getDvPercent(nutrition.potassium_per_person_mg, 'potassium_mg')}
          />
          <NutrientRow
            label="Magnesium"
            value={nutrition.magnesium_per_person_mg}
            unit="mg"
            dvPercent={getDvPercent(nutrition.magnesium_per_person_mg, 'magnesium_mg')}
          />
          <NutrientRow
            label="Zinc"
            value={nutrition.zinc_per_person_mg}
            unit="mg"
            dvPercent={getDvPercent(nutrition.zinc_per_person_mg, 'zinc_mg')}
          />

          <Text style={styles.microsDisclaimer}>
            Estimates based on USDA data and ingredient matching. Directional, not for medical use.
          </Text>
        </View>
      )}

      {/* Quality indicator */}
      <TouchableOpacity
        style={styles.qualityRow}
        onPress={handleQualityInfo}
        activeOpacity={0.7}
      >
        <View style={[styles.qualityDot, { backgroundColor: qualityColor }]} />
        <Text style={styles.qualityText}>
          {getQualityDisplayText(nutrition.quality_label)}
        </Text>
        <Text style={styles.qualityInfo}>ⓘ</Text>
      </TouchableOpacity>

      {/* Partial-data note */}
      {hasPartialData && (
        <Text style={styles.partialNote}>
          Nutrition shown for {nutrition.dishes_with_nutrition} of {nutrition.total_dishes} dishes
        </Text>
      )}
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────

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
  const formattedValue =
    typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : Math.round(value);
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

// ── Styles ───────────────────────────────────────────────────────
// Mirrors components/RecipeNutritionPanel.tsx so the meal panel feels like
// a sibling of the recipe panel. Self-contained (not imported) to keep this
// component independent.

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
  },

  // Header
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },

  // Empty state
  emptyStateContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },

  // Calorie headline
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  calorieText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  calorieUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },

  // Dietary badges
  badgeRow: {
    marginBottom: 12,
  },

  // Macro bar
  macroBarContainer: {
    marginBottom: 12,
  },
  macroBarRow: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  macroBarSegment: {
    height: '100%',
  },
  macroBarLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#888',
  },

  // Detail grid
  detailGrid: {
    gap: 4,
    marginBottom: 12,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  nutrientLabel: {
    fontSize: 14,
    color: '#666',
  },
  nutrientValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  nutrientValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  nutrientDvPercent: {
    fontSize: 13,
    color: '#888',
  },

  // Vitamins & Minerals
  microsToggle: {
    paddingVertical: 8,
  },
  microsToggleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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

  // Quality + partial-data note
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingVertical: 4,
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  qualityText: {
    fontSize: 12,
    color: '#888',
  },
  qualityInfo: {
    fontSize: 12,
    color: '#999',
  },
  partialNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2,
  },
});
