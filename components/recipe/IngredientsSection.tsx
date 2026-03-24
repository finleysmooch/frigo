import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import InlineEditableIngredient from '../InlineEditableIngredient';
import MarkupText from '../MarkupText';
import { PantryItemWithIngredient } from '../../lib/types/pantry';
import { ViewMode } from '../../lib/services/recipeAnnotationsService';
import { UnitSystem } from '../../lib/services/unitConverter';

interface Ingredient {
  id: string;
  name: string;
  displayText: string;
  family: string;
  quantity_amount?: number;
  quantity_unit?: string;
  preparation?: string;
  group_name: string | null;
  group_number: number | null;
  _annotation?: {
    original: string;
    new: string;
    notes?: string;
    showMarkup: boolean;
  };
}

function parseAndScaleQuantity(text: string, scale: number): string {
  if (scale === 1) return text;

  const parts = text.split(' ');
  const firstPart = parts[0];

  const fractionMap: { [key: string]: number } = {
    '\u00BC': 0.25, '\u00BD': 0.5, '\u00BE': 0.75,
    '\u2153': 0.333, '\u2154': 0.667,
    '\u215B': 0.125, '\u215C': 0.375, '\u215D': 0.625, '\u215E': 0.875,
  };

  let numericValue = 0;
  let hasNumber = false;

  if (fractionMap[firstPart]) {
    numericValue = fractionMap[firstPart];
    hasNumber = true;
  } else {
    const numberMatch = firstPart.match(/^(\d+(?:\.\d+)?)([\u00BC-\u00BE\u2150-\u215E])?/);
    if (numberMatch) {
      numericValue = parseFloat(numberMatch[1]);
      if (numberMatch[2] && fractionMap[numberMatch[2]]) {
        numericValue += fractionMap[numberMatch[2]];
      }
      hasNumber = true;
    }
  }

  if (hasNumber) {
    const scaled = numericValue * scale;
    const restOfText = parts.slice(1).join(' ');

    if (scaled % 1 === 0) {
      return `${scaled} ${restOfText}`;
    } else {
      const whole = Math.floor(scaled);
      const frac = scaled - whole;
      let fractionChar = '';
      if (Math.abs(frac - 0.5) < 0.01) fractionChar = '\u00BD';
      else if (Math.abs(frac - 0.25) < 0.01) fractionChar = '\u00BC';
      else if (Math.abs(frac - 0.75) < 0.01) fractionChar = '\u00BE';
      else if (Math.abs(frac - 0.333) < 0.02) fractionChar = '\u2153';
      else if (Math.abs(frac - 0.667) < 0.02) fractionChar = '\u2154';
      else if (Math.abs(frac - 0.125) < 0.01) fractionChar = '\u215B';
      else if (Math.abs(frac - 0.375) < 0.01) fractionChar = '\u215C';
      else if (Math.abs(frac - 0.625) < 0.01) fractionChar = '\u215D';
      else if (Math.abs(frac - 0.875) < 0.01) fractionChar = '\u215E';

      if (fractionChar) {
        return whole > 0 ? `${whole}${fractionChar} ${restOfText}` : `${fractionChar} ${restOfText}`;
      }
      return `${scaled.toFixed(1)} ${restOfText}`;
    }
  }

  return text;
}

/**
 * Split displayText into { prefix, ingredientName, preparation } by structure.
 *
 * displayText format: "[quantity] [unit] [ingredient name][, preparation]"
 * Strategy:
 *   1. Strip the quantity+unit prefix using regex.
 *   2. Split the remainder on the first comma.
 *   3. Everything before the comma = ingredient name (bold).
 *   4. Everything after = preparation (regular weight).
 *
 * This handles plurals, descriptors, and compound ingredient names because
 * it works with the actual display string, not a normalized lookup.
 */
function splitIngredientParts(
  displayText: string,
): { prefix: string; ingredientName: string; preparation: string } {
  // Match quantity+unit prefix at the start of the string
  // Handles: "1 medium", "⅓ cup plus 1 tbsp", "2", "7 oz", etc.
  const qtyUnitPattern = /^([\d\u00BC-\u00BE\u2150-\u215E\/.,]+(?:\s*[\u00BC-\u00BE\u2150-\u215E])?\s*(?:plus\s+[\d\u00BC-\u00BE\u2150-\u215E\/.,]+(?:\s*[\u00BC-\u00BE\u2150-\u215E])?\s+)?(?:tablespoons?|tbsp|teaspoons?|tsp|cups?|pounds?|lbs?|ounces?|oz|grams?|g|kilograms?|kg|liters?|l|milliliters?|ml|pinch(?:es)?|dash(?:es)?|bunch(?:es)?|cloves?|heads?|stalks?|sprigs?|slices?|pieces?|whole|large|medium|small|can|cans|package|packages|jar|jars|bottle|bottles|sticks?|inches?|inch)?)\s+/i;

  let prefix = '';
  let remainder = displayText;

  const match = displayText.match(qtyUnitPattern);
  if (match) {
    prefix = match[0];
    remainder = displayText.slice(match[0].length);
  } else {
    // Check if it starts with just a number/fraction (no unit)
    const simpleMatch = displayText.match(/^([\d\u00BC-\u00BE\u2150-\u215E\/.]+)\s+/);
    if (simpleMatch) {
      prefix = simpleMatch[0];
      remainder = displayText.slice(simpleMatch[0].length);
    }
  }

  // Split remainder on first comma: ingredient name vs preparation
  const commaIdx = remainder.indexOf(',');
  if (commaIdx !== -1) {
    return {
      prefix,
      ingredientName: remainder.slice(0, commaIdx),
      preparation: remainder.slice(commaIdx), // includes the comma
    };
  }

  // No comma — everything is the ingredient name
  return { prefix, ingredientName: remainder, preparation: '' };
}

interface IngredientsSectionProps {
  displayIngredients: Ingredient[];
  currentScale: number;
  currentUnitSystem: UnitSystem;
  convertedIngredients: any[];
  pantryItems: PantryItemWithIngredient[];
  missingCount: number;
  isEditMode: boolean;
  viewMode: ViewMode;
  editingIngredientIndex: number | null;
  onEditIngredient: (index: number) => void;
  onSaveIngredientEdit: (index: number, newText: string) => void;
  onCancelIngredientEdit: () => void;
  onShowMissingListModal: () => void;
  onShowAllListModal: () => void;
  onHeaderLayout?: (absoluteY: number) => void;
}

export default function IngredientsSection({
  displayIngredients,
  currentScale,
  currentUnitSystem,
  convertedIngredients,
  pantryItems,
  missingCount,
  isEditMode,
  viewMode,
  editingIngredientIndex,
  onEditIngredient,
  onSaveIngredientEdit,
  onCancelIngredientEdit,
  onShowMissingListModal,
  onShowAllListModal,
  onHeaderLayout,
}: IngredientsSectionProps) {

  // Group ingredients by group_name (recipe-author grouping)
  const groups: { name: string | null; number: number | null; ingredients: Ingredient[] }[] = [];
  const groupMap = new Map<string | null, typeof groups[0]>();

  for (const ingredient of displayIngredients) {
    const key = ingredient.group_name;
    if (groupMap.has(key)) {
      groupMap.get(key)!.ingredients.push(ingredient);
    } else {
      const group = { name: key, number: ingredient.group_number, ingredients: [ingredient] };
      groupMap.set(key, group);
      groups.push(group);
    }
  }

  // Sort groups by group_number (null groups go first — ungrouped)
  groups.sort((a, b) => {
    if (a.number === null && b.number === null) return 0;
    if (a.number === null) return -1;
    if (b.number === null) return -1;
    return a.number - b.number;
  });

  // Determine if we should show group headers:
  // Don't show if all ingredients are in the same group (single group)
  // Don't show if all ingredients have null group_name
  const distinctGroupNames = new Set(displayIngredients.map(i => i.group_name));
  const showGroupHeaders = distinctGroupNames.size > 1 ||
    (distinctGroupNames.size === 1 && !distinctGroupNames.has(null));
  // Actually: if single non-null group, still don't show (it's redundant)
  const shouldShowHeader = (groupName: string | null) => {
    if (!showGroupHeaders) return false;
    if (distinctGroupNames.size === 1) return false;
    return groupName !== null;
  };

  const renderIngredientText = (_ingredient: Ingredient, displayText: string) => {
    const { prefix, ingredientName, preparation } = splitIngredientParts(displayText);

    if (ingredientName) {
      return (
        <Text style={styles.ingredientText}>
          {prefix}<Text style={styles.ingredientBoldName}>{ingredientName}</Text>{preparation}
        </Text>
      );
    }
    return <Text style={styles.ingredientText}>{displayText}</Text>;
  };

  // Compute pantry count
  const haveCount = displayIngredients.filter(ingredient => {
    const scaledAmount = (ingredient.quantity_amount || 0) * currentScale;
    const inPantry = pantryItems.find(item => item.ingredient_id === ingredient.id);
    return inPantry && (inPantry.quantity_display || 0) >= scaledAmount;
  }).length;
  const totalCount = displayIngredients.length;
  const containerOffsetRef = useRef(0);

  return (
    <View
      style={styles.container}
      onLayout={(e) => { containerOffsetRef.current = e.nativeEvent.layout.y; }}
    >
      {/* Accent line */}
      <View
        style={styles.accentLine}
        onLayout={(e) => {
          if (onHeaderLayout) {
            onHeaderLayout(containerOffsetRef.current + e.nativeEvent.layout.y);
          }
        }}
      />

      {/* Section header row */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>INGREDIENTS</Text>
        {totalCount > 0 && (
          <TouchableOpacity
            onPress={missingCount > 0 ? onShowMissingListModal : onShowAllListModal}
            activeOpacity={0.7}
          >
            <Text style={styles.pantryCount}>
              {haveCount}/{totalCount} in pantry
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Ingredient groups */}
      <View style={styles.ingredientsList}>
        {groups.map((group, groupIndex) => (
          <View key={`group-${groupIndex}-${group.name || 'ungrouped'}`}>
            {shouldShowHeader(group.name) && (
              <Text style={styles.groupHeader}>{group.name}:</Text>
            )}
            {group.ingredients.map((ingredient, idx) => {
              const globalIndex = displayIngredients.indexOf(ingredient);

              const scaledAmount = (ingredient.quantity_amount || 0) * currentScale;
              const inPantry = pantryItems.find(item => item.ingredient_id === ingredient.id);
              const hasSufficient = inPantry && (inPantry.quantity_display || 0) >= scaledAmount;

              // Get display text
              let displayText: string;
              if (currentUnitSystem === 'original') {
                displayText = parseAndScaleQuantity(ingredient.displayText, currentScale);
              } else {
                const converted = convertedIngredients.find(c => c.displayText === ingredient.displayText);
                displayText = converted?.converted?.displayText || parseAndScaleQuantity(ingredient.displayText, currentScale);
              }

              // Inline editing
              const isEditing = isEditMode && editingIngredientIndex === globalIndex;
              if (isEditing) {
                return (
                  <InlineEditableIngredient
                    key={`edit-${ingredient.id}-${globalIndex}`}
                    originalText={displayText}
                    onSave={(newText) => onSaveIngredientEdit(globalIndex, newText)}
                    onCancel={onCancelIngredientEdit}
                    hasSufficient={hasSufficient}
                  />
                );
              }

              // Markup mode
              const showMarkup = viewMode === 'markup' && ingredient._annotation;

              return (
                <View
                  key={`ingredient-${ingredient.id}-${globalIndex}-${idx}`}
                  style={styles.ingredientRow}
                >
                  {/* Have indicator — green checkmark */}
                  <View style={styles.indicatorContainer}>
                    {hasSufficient && <Text style={styles.haveCheck}>✓</Text>}
                  </View>

                  {/* Ingredient text with bold quantity */}
                  <View style={styles.ingredientContent}>
                    {showMarkup && ingredient._annotation ? (
                      <View style={styles.ingredientTextContainer}>
                        <MarkupText
                          original={ingredient._annotation.original}
                          edited={ingredient._annotation.new}
                          notes={ingredient._annotation.notes}
                        />
                      </View>
                    ) : (
                      renderIngredientText(ingredient, displayText)
                    )}
                  </View>

                  {/* Edit button */}
                  {isEditMode && (
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => onEditIngredient(globalIndex)}
                    >
                      <Text style={styles.editButtonText}>✏️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Grocery list actions */}
      <View style={styles.groceryListActions}>
        {missingCount > 0 && (
          <TouchableOpacity style={styles.groceryListBox} onPress={onShowMissingListModal}>
            <Text style={styles.groceryListBoxText}>
              🛒  Add missing ({missingCount}) to Grocery List
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.groceryListAllLink} onPress={onShowAllListModal}>
          <Text style={styles.groceryListAllText}>
            Add all to Grocery List
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  accentLine: {
    height: 3,
    backgroundColor: '#0f172a',
    marginBottom: 16,
    marginTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#111',
  },
  pantryCount: {
    fontSize: 13,
    color: '#0d9488',
    fontWeight: '500',
  },
  groupHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#333',
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 12,
  },
  ingredientsList: {
    // container for all groups
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    minHeight: 28,
  },
  indicatorContainer: {
    width: 20,
    paddingTop: 2,
    alignItems: 'center',
  },
  haveCheck: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  ingredientContent: {
    flex: 1,
  },
  ingredientTextContainer: {
    flex: 1,
  },
  ingredientText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#111',
  },
  ingredientBoldName: {
    fontWeight: '700',
  },
  editButton: {
    padding: 4,
    marginLeft: 8,
  },
  editButtonText: {
    fontSize: 16,
  },
  groceryListActions: {
    marginTop: 24,
    marginBottom: 8,
  },
  groceryListBox: {
    borderWidth: 1,
    borderColor: '#0d9488',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  groceryListBoxText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0d9488',
    textAlign: 'center',
  },
  groceryListAllLink: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  groceryListAllText: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
