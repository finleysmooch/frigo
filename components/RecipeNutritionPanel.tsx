// components/RecipeNutritionPanel.tsx
// Nutrition panel for RecipeDetailScreen.
// Collapsed: calories + macro highlights + dietary badges
// Expanded: macro bars, full breakdown, quality indicator, per-ingredient contributions

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
  IngredientNutrition,
  getRecipeNutrition,
  getIngredientNutrition,
  getActiveDietaryFlags,
  getQualityDisplayText,
  getQualityExplanation,
  getQualityColor,
} from '../lib/services/nutritionService';
import DietaryBadgeRow from './DietaryBadgeRow';

interface RecipeNutritionPanelProps {
  recipeId: string;
}

export default function RecipeNutritionPanel({ recipeId }: RecipeNutritionPanelProps) {
  const [nutrition, setNutrition] = useState<RecipeNutrition | null>(null);
  const [ingredientBreakdown, setIngredientBreakdown] = useState<IngredientNutrition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);

  useEffect(() => {
    loadNutrition();
  }, [recipeId]);

  const loadNutrition = async () => {
    try {
      setLoading(true);
      const data = await getRecipeNutrition(recipeId);
      setNutrition(data);
    } catch (error) {
      console.error('Error loading nutrition:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIngredientBreakdown = async () => {
    if (ingredientBreakdown.length > 0) return; // already loaded
    const data = await getIngredientNutrition(recipeId);
    setIngredientBreakdown(data);
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      loadIngredientBreakdown();
    }
  };

  const handleQualityInfo = () => {
    if (!nutrition) return;
    Alert.alert(
      getQualityDisplayText(nutrition.quality_label),
      getQualityExplanation(nutrition.quality_label) +
        `\n\n${nutrition.ingredients_with_nutrition} of ${nutrition.total_ingredients} ingredients have nutrition data (${nutrition.nutrition_coverage_pct}% coverage).`
    );
  };

  // ── Loading / No Data states ─────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#999" />
          <Text style={styles.loadingText}>Loading nutrition...</Text>
        </View>
      </View>
    );
  }

  if (!nutrition) return null; // No nutrition data for this recipe

  // ── Data Prep ────────────────────────────────────────────────

  const dietaryFlags = getActiveDietaryFlags(nutrition);
  const qualityColor = getQualityColor(nutrition.quality_label);

  // Macro bar proportions (percentage of total macro grams)
  const totalMacroG =
    nutrition.protein_per_serving_g +
    nutrition.fat_per_serving_g +
    nutrition.carbs_per_serving_g;

  const proteinPct = totalMacroG > 0 ? (nutrition.protein_per_serving_g / totalMacroG) * 100 : 0;
  const fatPct = totalMacroG > 0 ? (nutrition.fat_per_serving_g / totalMacroG) * 100 : 0;
  const carbsPct = totalMacroG > 0 ? (nutrition.carbs_per_serving_g / totalMacroG) * 100 : 0;

  // Per-ingredient: only show items with calories
  const ingredientsWithCals = ingredientBreakdown.filter(
    (i) => i.calories != null && i.calories > 0
  );

  // ── Render ───────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Collapsed Summary Row */}
      <TouchableOpacity
        style={styles.summaryRow}
        onPress={handleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.summaryLeft}>
          <Text style={styles.calorieText}>
            {nutrition.cal_per_serving}
            <Text style={styles.calorieUnit}> cal</Text>
          </Text>
          <View style={styles.macroSummary}>
            <Text style={styles.macroChip}>
              <Text style={styles.macroValue}>{Math.round(nutrition.protein_per_serving_g)}</Text>
              <Text style={styles.macroLabel}>g P</Text>
            </Text>
            <Text style={styles.macroDot}>·</Text>
            <Text style={styles.macroChip}>
              <Text style={styles.macroValue}>{Math.round(nutrition.carbs_per_serving_g)}</Text>
              <Text style={styles.macroLabel}>g C</Text>
            </Text>
            <Text style={styles.macroDot}>·</Text>
            <Text style={styles.macroChip}>
              <Text style={styles.macroValue}>{Math.round(nutrition.fat_per_serving_g)}</Text>
              <Text style={styles.macroLabel}>g F</Text>
            </Text>
          </View>
        </View>

        <View style={styles.summaryRight}>
          <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
        </View>
      </TouchableOpacity>

      {/* Dietary badges — always visible when present */}
      {dietaryFlags.length > 0 && (
        <View style={styles.badgeRow}>
          <DietaryBadgeRow flags={dietaryFlags} />
        </View>
      )}

      {/* ── Expanded Detail ──────────────────────────────────── */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Per-serving label */}
          <Text style={styles.perServingLabel}>
            Per serving ({nutrition.servings} servings)
          </Text>

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

          {/* Detailed Macros Grid */}
          <View style={styles.detailGrid}>
            <NutrientRow label="Protein" value={nutrition.protein_per_serving_g} unit="g" />
            <NutrientRow label="Carbs" value={nutrition.carbs_per_serving_g} unit="g" />
            <NutrientRow label="Fat" value={nutrition.fat_per_serving_g} unit="g" />
            <NutrientRow label="Fiber" value={nutrition.fiber_per_serving_g} unit="g" />
            <NutrientRow label="Sugar" value={nutrition.sugar_per_serving_g} unit="g" />
            <NutrientRow label="Sodium" value={nutrition.sodium_per_serving_mg} unit="mg" />
          </View>

          {/* Quality Indicator */}
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

          {/* Per-Ingredient Breakdown Toggle */}
          <TouchableOpacity
            style={styles.ingredientToggle}
            onPress={() => setShowIngredients(!showIngredients)}
            activeOpacity={0.7}
          >
            <Text style={styles.ingredientToggleText}>
              {showIngredients ? '▼' : '▶'} Ingredient breakdown
            </Text>
          </TouchableOpacity>

          {showIngredients && ingredientsWithCals.length > 0 && (
            <View style={styles.ingredientList}>
              {ingredientsWithCals.map((item) => (
                <View key={item.recipe_ingredient_id} style={styles.ingredientNutrRow}>
                  <Text style={styles.ingredientNutrName} numberOfLines={1}>
                    {item.ingredient_name || item.original_text}
                  </Text>
                  <Text style={styles.ingredientNutrCal}>
                    {Math.round(item.calories!)} cal
                  </Text>
                </View>
              ))}
              {/* Show unmatched count if any */}
              {nutrition.total_ingredients - nutrition.ingredients_with_nutrition > 0 && (
                <Text style={styles.unmatchedNote}>
                  {nutrition.total_ingredients - nutrition.ingredients_with_nutrition} ingredient
                  {nutrition.total_ingredients - nutrition.ingredients_with_nutrition > 1 ? 's' : ''}{' '}
                  without nutrition data
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function NutrientRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <View style={styles.nutrientRow}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={styles.nutrientValue}>
        {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : Math.round(value)}
        {unit}
      </Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
  },

  // ── Collapsed Summary ──
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  calorieText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  calorieUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  macroSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroChip: {
    fontSize: 14,
    color: '#666',
  },
  macroValue: {
    fontWeight: '600',
    color: '#333',
  },
  macroLabel: {
    fontWeight: '400',
    color: '#888',
  },
  macroDot: {
    fontSize: 14,
    color: '#999',
  },
  summaryRight: {
    paddingLeft: 8,
  },
  expandIcon: {
    fontSize: 10,
    color: '#999',
  },

  // ── Dietary Badges ──
  badgeRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },

  // ── Expanded Section ──
  expandedSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  perServingLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
    marginBottom: 8,
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

  // Quality
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
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

  // Ingredient breakdown
  ingredientToggle: {
    paddingVertical: 8,
  },
  ingredientToggleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ingredientList: {
    gap: 4,
    paddingTop: 4,
  },
  ingredientNutrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  ingredientNutrName: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 8,
  },
  ingredientNutrCal: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  unmatchedNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
});