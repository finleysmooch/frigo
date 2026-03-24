import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import InlineEditableInstruction from '../InlineEditableInstruction';
import MarkupText from '../MarkupText';
import { InstructionSection } from '../../lib/types/recipeExtraction';
import { StepIngredient } from '../../lib/types/cooking';
import { RecipeAnnotation, ViewMode } from '../../lib/services/recipeAnnotationsService';
import {
  splitInstructionIntoParts,
} from '../../utils/ingredientMatcher';

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

function getInstructionText(instruction: any): string {
  if (typeof instruction === 'string') {
    return instruction;
  }
  return instruction.instruction || instruction.text || '';
}

/**
 * Merge consecutive instruction sections with the same name.
 * Known data quality issue: duplicate adjacent section names with different step ranges.
 */
function mergeConsecutiveSections(sections: InstructionSection[]): InstructionSection[] {
  if (sections.length <= 1) return sections;

  const merged: InstructionSection[] = [];
  for (const section of sections) {
    const prev = merged[merged.length - 1];
    if (prev && prev.section_title === section.section_title) {
      // Merge: combine steps into the previous section
      prev.steps = [...prev.steps, ...section.steps];
      // Keep the longer estimated time if both have one
      if (section.estimated_time_min) {
        prev.estimated_time_min = (prev.estimated_time_min || 0) + section.estimated_time_min;
      }
    } else {
      // Clone so we don't mutate the original
      merged.push({ ...section, steps: [...section.steps] });
    }
  }
  return merged;
}

/**
 * Clean up raw step ingredient quantities:
 * - Convert decimal strings to fraction characters (0.5→½, 0.333→⅓, etc.)
 * - If the quantity is a bare number with no unit text, look up the unit
 *   from the main ingredients list and append it.
 */
const FRACTION_MAP: [number, string][] = [
  [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.334, '⅓'],
  [0.375, '⅜'], [0.5, '½'], [0.625, '⅝'], [0.667, '⅔'],
  [0.75, '¾'], [0.875, '⅞'],
];

const UNICODE_TO_DECIMAL: { [k: string]: number } = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 0.333, '⅔': 0.667,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

function numberToFraction(num: number): string {
  const whole = Math.floor(num);
  const frac = num - whole;
  if (frac < 0.01) return String(whole || '0');
  const entry = FRACTION_MAP.find(([val]) => Math.abs(frac - val) < 0.02);
  if (entry) return whole > 0 ? `${whole}${entry[1]}` : entry[1];
  return num % 1 === 0 ? String(num) : num.toFixed(1);
}

function formatStepQuantity(
  rawQty: string,
  ingredientName: string,
  mainIngredients: Ingredient[],
  scale: number,
): string {
  if (!rawQty) return rawQty;

  // Replace decimal numbers and unicode fractions, applying scale
  const formatted = rawQty.replace(/([\d.]+[\u00BC-\u00BE\u2150-\u215E]?|[\u00BC-\u00BE\u2150-\u215E])/g, (match) => {
    let num = 0;
    // Pure unicode fraction
    if (UNICODE_TO_DECIMAL[match]) {
      num = UNICODE_TO_DECIMAL[match];
    } else {
      // Number possibly followed by unicode fraction
      const lastChar = match[match.length - 1];
      if (UNICODE_TO_DECIMAL[lastChar]) {
        num = parseFloat(match.slice(0, -1)) + UNICODE_TO_DECIMAL[lastChar];
      } else {
        num = parseFloat(match);
      }
    }
    if (isNaN(num)) return match;
    return numberToFraction(num * scale);
  });

  // Check if result is a bare number/fraction with no unit text
  const trimmed = formatted.trim();
  const isBareNumber = /^[\d\u00BC-\u00BE\u2150-\u215E\/]+$/.test(trimmed);
  if (isBareNumber) {
    const lowerName = ingredientName.toLowerCase();
    const match = mainIngredients.find(
      ing => ing.name.toLowerCase() === lowerName ||
             ing.displayText.toLowerCase().includes(lowerName)
    );
    if (match?.quantity_unit) {
      return `${trimmed} ${match.quantity_unit}`;
    }
  }

  return formatted;
}

/**
 * Build an ordered list of step keys from instruction data.
 * Used by the parent to support ‹/› navigation.
 */
export function buildStepKeys(
  instructionSections: InstructionSection[],
  displayInstructions: any[],
): string[] {
  const merged = mergeConsecutiveSections(instructionSections);
  if (merged.length > 0) {
    const keys: string[] = [];
    for (const section of merged) {
      for (const step of section.steps) {
        keys.push(`${section.id}-${step.step_number - 1}`);
      }
    }
    return keys;
  }
  return displayInstructions.map((_, i) => `flat-${i}`);
}

interface PreparationSectionProps {
  instructionSections: InstructionSection[];
  displayInstructions: any[];
  ingredients: Ingredient[];
  isEditMode: boolean;
  viewMode: ViewMode;
  annotations: RecipeAnnotation[];
  onEditInstruction: (index: number, sectionId?: string) => void;
  onSaveInstructionEdit: (index: number, newText: string, sectionId?: string) => void;
  onCancelInstructionEdit: () => void;
  onDeleteInstruction: (index: number, sectionId?: string) => void;
  editingInstructionIndex: number | null;
  editingInstructionSection: string | null;
  onIngredientPress: (ingredient: Ingredient, event: any) => void;
  onMoveStepUp: (index: number) => void;
  onMoveStepDown: (index: number) => void;
  currentScale: number;
  stepIngredients: Map<number, StepIngredient[]>;
  // Focus mode
  focusedStepKey: string | null;
  onStepFocus: (stepKey: string) => void;
  // Y position reporting for scroll targeting
  onStepLayout?: (stepKey: string, y: number) => void;
  onHeaderLayout?: (absoluteY: number) => void;
}

export default function PreparationSection({
  instructionSections,
  displayInstructions,
  ingredients,
  isEditMode,
  viewMode,
  annotations,
  onEditInstruction,
  onSaveInstructionEdit,
  onCancelInstructionEdit,
  onDeleteInstruction,
  editingInstructionIndex,
  editingInstructionSection,
  onIngredientPress,
  onMoveStepUp,
  onMoveStepDown,
  currentScale,
  stepIngredients,
  focusedStepKey,
  onStepFocus,
  onStepLayout,
  onHeaderLayout,
}: PreparationSectionProps) {

  // Ref to track the container's Y offset within the scroll content
  const containerOffsetRef = useRef(0);

  // Step ingredients collapsed by default, reset when focus changes
  const [stepIngredientsCollapsed, setStepIngredientsCollapsed] = useState(true);

  // Reset to collapsed when focused step changes
  useEffect(() => {
    setStepIngredientsCollapsed(true);
  }, [focusedStepKey]);

  const renderInstructionWithClickableIngredients = (
    instruction: string,
    stepNumber: number,
    annotation?: any,
    bold?: boolean,
  ) => {
    if (viewMode === 'markup' && annotation) {
      return (
        <View style={styles.stepTextContainer}>
          <MarkupText
            original={annotation.original}
            edited={annotation.new}
            notes={annotation.notes}
            isDeleted={annotation.isDeleted}
          />
        </View>
      );
    }

    const parts = splitInstructionIntoParts(instruction, ingredients);

    return (
      <Text style={[styles.stepText, bold && styles.stepTextBold]}>
        {parts.map((part, index) => {
          if (part.type === 'ingredient' && part.ingredient) {
            return (
              <Text
                key={`${stepNumber}-${index}`}
                style={styles.clickableIngredient}
                onPress={(e) => onIngredientPress(part.ingredient!, e)}
              >
                {part.text}
              </Text>
            );
          }
          return (
            <Text key={`${stepNumber}-${index}`}>{part.text}</Text>
          );
        })}
      </Text>
    );
  };

  const renderStepIngredients = (stepNumber: number) => {
    const ingredientsForStep = stepIngredients.get(stepNumber);
    if (!ingredientsForStep || ingredientsForStep.length === 0) return null;

    return (
      <View style={styles.stepIngredientsContainer}>
        <TouchableOpacity
          style={styles.stepIngredientsHeader}
          onPress={() => setStepIngredientsCollapsed(prev => !prev)}
          activeOpacity={0.7}
        >
          <Text style={styles.stepIngredientsArrow}>{stepIngredientsCollapsed ? '▸' : '▾'}</Text>
          <Text style={styles.stepIngredientsLabel}>Ingredients for this step</Text>
        </TouchableOpacity>
        {!stepIngredientsCollapsed && ingredientsForStep.map((si, idx) => {
          const qty = formatStepQuantity(si.quantity, si.name, ingredients, currentScale);
          return (
            <View key={`si-${stepNumber}-${idx}`} style={styles.stepIngredientRow}>
              <Text style={styles.stepIngredientName} numberOfLines={1}>{si.name}</Text>
              <Text style={styles.stepIngredientQty} numberOfLines={1}>
                {qty}{si.preparation ? `, ${si.preparation}` : ''}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderStep = (
    stepText: string,
    stepNumber: number,
    stepIndex: number,
    sectionId?: string,
    annotationDisplay?: any,
  ) => {
    const stepKey = sectionId ? `${sectionId}-${stepIndex}` : `flat-${stepIndex}`;
    const isEditing = isEditMode &&
      editingInstructionIndex === stepIndex &&
      editingInstructionSection === (sectionId || null);

    if (isEditing) {
      return (
        <InlineEditableInstruction
          key={stepKey}
          originalText={stepText}
          stepNumber={stepNumber}
          onSave={(newText) => onSaveInstructionEdit(stepIndex, newText, sectionId)}
          onCancel={onCancelInstructionEdit}
          onDelete={() => onDeleteInstruction(stepIndex, sectionId)}
        />
      );
    }

    const isFocused = focusedStepKey === stepKey;

    return (
      <View
        key={stepKey}
        style={[
          styles.stepContainer,
          isFocused && styles.stepContainerFocused,
        ]}
        onLayout={(e) => {
          if (onStepLayout) {
            // Report absolute Y within scroll content
            onStepLayout(stepKey, containerOffsetRef.current + e.nativeEvent.layout.y);
          }
        }}
      >
        {/* Edit controls */}
        {isEditMode && (
          <View style={styles.editRow}>
            <TouchableOpacity
              style={styles.stepControlButton}
              onPress={() => onMoveStepUp(stepIndex)}
            >
              <Text style={styles.stepControlText}>⬆️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepControlButton}
              onPress={() => onMoveStepDown(stepIndex)}
            >
              <Text style={styles.stepControlText}>⬇️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onEditInstruction(stepIndex, sectionId)}
            >
              <Text style={styles.editButtonText}>✏️</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step label */}
        <Text style={styles.stepLabel}>Step {stepNumber}</Text>

        {/* Step text — tappable for focus mode */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onStepFocus(stepKey)}
          disabled={isEditMode}
        >
          {renderInstructionWithClickableIngredients(
            stepText,
            stepNumber,
            annotationDisplay,
            isFocused,
          )}
        </TouchableOpacity>

        {/* Expanded step ingredients (shown when focused) */}
        {isFocused && renderStepIngredients(stepNumber)}
      </View>
    );
  };

  // Merge consecutive sections with duplicate names
  const mergedSections = mergeConsecutiveSections(instructionSections);

  // Determine if we have multiple sections (to show section headers)
  const showSectionHeaders = mergedSections.length > 1;

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        containerOffsetRef.current = e.nativeEvent.layout.y;
      }}
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

      {/* Section header */}
      <Text style={styles.sectionTitle}>PREPARATION</Text>

      {mergedSections.length > 0 ? (
        // Table-based sections with steps
        mergedSections.map((section, sectionIdx) => (
          <View key={section.id} style={styles.sectionGroup}>
            {showSectionHeaders && (
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>{section.section_title}</Text>
                {section.estimated_time_min ? (
                  <Text style={styles.sectionHeaderTime}>~{section.estimated_time_min} min</Text>
                ) : null}
              </View>
            )}
            {section.steps.map((step) => {
              const stepIndex = step.step_number - 1;

              const annotation = annotations.find(
                a => a.field_type === 'instruction' &&
                     a.field_index === stepIndex &&
                     a.field_id === section.id
              );

              const annotationDisplay = annotation && viewMode === 'markup' ? {
                original: annotation.original_value,
                new: annotation.annotated_value,
                notes: annotation.notes || undefined,
                showMarkup: true,
                isDeleted: annotation.annotation_type === 'instruction_delete'
              } : undefined;

              return renderStep(
                step.instruction,
                step.step_number,
                stepIndex,
                section.id,
                annotationDisplay,
              );
            })}
          </View>
        ))
      ) : displayInstructions.length > 0 ? (
        // Flat instructions fallback
        <View>
          {displayInstructions.map((instruction, index) => {
            const annotationDisplay = typeof instruction === 'object' && instruction._annotation
              ? instruction._annotation
              : undefined;

            return renderStep(
              getInstructionText(instruction),
              index + 1,
              index,
              undefined,
              annotationDisplay,
            );
          })}
        </View>
      ) : (
        <Text style={styles.noInstructionsText}>No instructions available</Text>
      )}
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#111',
    marginBottom: 24,
  },
  sectionGroup: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
    marginTop: 12,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#333',
    textTransform: 'uppercase',
    flex: 1,
  },
  sectionHeaderTime: {
    fontSize: 13,
    color: '#888',
    marginLeft: 8,
  },
  stepContainer: {
    marginBottom: 28,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    paddingLeft: 12,
  },
  stepContainerFocused: {
    borderLeftColor: '#0d9488',
    backgroundColor: 'rgba(13, 148, 136, 0.03)',
    marginLeft: -16,
    paddingLeft: 28, // 16 margin restore + 12 content padding
    marginRight: -16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderRadius: 0,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  stepText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#222',
  },
  stepTextBold: {
    fontWeight: '600',
  },
  stepTextContainer: {
    // For MarkupText wrapper
  },
  clickableIngredient: {
    color: '#0d9488',
  },
  // Step ingredient expansion
  stepIngredientsContainer: {
    marginTop: 12,
    paddingLeft: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  stepIngredientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  stepIngredientsArrow: {
    fontSize: 11,
    color: '#888',
  },
  stepIngredientsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepIngredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingLeft: 16,
  },
  stepIngredientName: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  stepIngredientQty: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    textAlign: 'right',
    maxWidth: '45%',
  },
  // Edit mode
  editRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  stepControlButton: {
    padding: 2,
  },
  stepControlText: {
    fontSize: 16,
  },
  editButton: {
    padding: 2,
    marginLeft: 'auto',
  },
  editButtonText: {
    fontSize: 16,
  },
  noInstructionsText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
