// ============================================
// FRIGO - UNIT PICKER COMPONENT (DROPDOWN VERSION)
// ============================================
// Smart dropdown for selecting measurement units based on ingredient
// Shows common units first, with "Other..." option for full list
// Dropdown appears below the button, not at bottom of screen
// Location: components/UnitPicker.tsx

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Dimensions
} from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';

export interface MeasurementUnit {
  id: string;
  unit: string;
  display_singular: string;
  display_plural: string;
  unit_type: 'weight' | 'volume' | 'count';
  sort_order: number;
}

interface UnitOption {
  unit_id: string;
  display_name: string;
  is_common: boolean; // Is this a common unit for the ingredient?
  sort_order: number;
}

interface Props {
  ingredientId: string;
  selectedUnit: string | null;
  onSelectUnit: (unitId: string, displayName: string) => void;
  disabled?: boolean;
}

export default function UnitPicker({ 
  ingredientId, 
  selectedUnit, 
  onSelectUnit,
  disabled = false 
}: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [commonUnits, setCommonUnits] = useState<UnitOption[]>([]);
  const [allUnits, setAllUnits] = useState<UnitOption[]>([]);
  const [showingAll, setShowingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buttonLayout, setButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const buttonRef = useRef<View>(null);

  // Load common units when ingredient changes
  useEffect(() => {
    if (ingredientId) {
      loadCommonUnits();
    }
  }, [ingredientId]);

  const loadCommonUnits = async () => {
    setLoading(true);
    try {
      // Import here to avoid circular dependencies
      const { getIngredientUnits } = await import('../lib/pantryService');
      const units = await getIngredientUnits(ingredientId);
      setCommonUnits(units);
    } catch (error) {
      console.error('Error loading units:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUnits = async () => {
    if (allUnits.length > 0) {
      // Already loaded
      setShowingAll(true);
      return;
    }

    setLoading(true);
    try {
      const { getAllMeasurementUnits } = await import('../lib/pantryService');
      const units = await getAllMeasurementUnits();
      setAllUnits(units);
      setShowingAll(true);
    } catch (error) {
      console.error('Error loading all units:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUnit = (unit: UnitOption) => {
    onSelectUnit(unit.unit_id, unit.display_name);
    setShowPicker(false);
    setShowingAll(false);
  };

  const handleShowOther = () => {
    loadAllUnits();
  };

  const handleOpenPicker = () => {
    if (disabled) return;
    
    // Measure button position
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setButtonLayout({ x, y, width, height });
      setShowPicker(true);
    });
  };

  const displayText = selectedUnit || 'Select unit';
  const unitsToShow = showingAll ? allUnits : commonUnits;

  // Calculate dropdown position
  const screenHeight = Dimensions.get('window').height;
  const dropdownMaxHeight = 300;
  const spaceBelow = screenHeight - (buttonLayout.y + buttonLayout.height);
  const shouldShowAbove = spaceBelow < dropdownMaxHeight && buttonLayout.y > dropdownMaxHeight;

  return (
    <View style={styles.container}>
      <View ref={buttonRef} collapsable={false}>
        <TouchableOpacity
          style={[
            styles.pickerButton,
            disabled && styles.pickerButtonDisabled
          ]}
          onPress={handleOpenPicker}
          disabled={disabled}
        >
          <Text style={[
            styles.pickerButtonText,
            !selectedUnit && styles.pickerButtonPlaceholder
          ]}>
            {displayText}
          </Text>
          <Text style={styles.pickerButtonIcon}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Unit Picker Dropdown */}
      <Modal
        visible={showPicker}
        animationType="none"
        transparent={true}
        onRequestClose={() => {
          setShowPicker(false);
          setShowingAll(false);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowPicker(false);
          setShowingAll(false);
        }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View 
                style={[
                  styles.dropdownContainer,
                  {
                    left: buttonLayout.x,
                    width: buttonLayout.width,
                    ...(shouldShowAbove
                      ? { bottom: screenHeight - buttonLayout.y + 4 }
                      : { top: buttonLayout.y + buttonLayout.height + 4 }
                    )
                  }
                ]}
              >
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>
                    {showingAll ? 'All Units' : 'Select Unit'}
                  </Text>
                  {showingAll && (
                    <TouchableOpacity 
                      onPress={() => setShowingAll(false)}
                      style={styles.backButton}
                    >
                      <Text style={styles.backButtonText}>← Common</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Units List */}
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : (
                  <>
                    <FlatList
                      data={unitsToShow}
                      keyExtractor={(item) => item.unit_id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[
                            styles.unitOption,
                            selectedUnit === item.display_name && styles.unitOptionSelected
                          ]}
                          onPress={() => handleSelectUnit(item)}
                        >
                          <Text style={[
                            styles.unitOptionText,
                            selectedUnit === item.display_name && styles.unitOptionTextSelected
                          ]}>
                            {item.display_name}
                          </Text>
                          {selectedUnit === item.display_name && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      style={styles.unitsList}
                      nestedScrollEnabled={true}
                    />

                    {/* "Other..." button to show all units */}
                    {!showingAll && commonUnits.length > 0 && (
                      <TouchableOpacity
                        style={styles.otherButton}
                        onPress={handleShowOther}
                      >
                        <Text style={styles.otherButtonText}>Other units...</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  pickerButtonDisabled: {
    backgroundColor: colors.background.secondary,
    opacity: 0.5,
  },
  pickerButtonText: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    flex: 1,
  },
  pickerButtonPlaceholder: {
    color: colors.text.placeholder,
  },
  pickerButtonIcon: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  dropdownContainer: {
    position: 'absolute',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    maxHeight: 300,
    ...shadows.large,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  backButton: {
    marginLeft: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  loadingContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitsList: {
    maxHeight: 200,
  },
  unitOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  unitOptionSelected: {
    backgroundColor: colors.accentLight,
  },
  unitOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    flex: 1,
  },
  unitOptionTextSelected: {
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  checkmark: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  otherButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.medium,
    alignItems: 'center',
  },
  otherButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});