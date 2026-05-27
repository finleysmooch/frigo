// ============================================
// FRIGO - UNIT PICKER COMPONENT (DROPDOWN VERSION)
// ============================================
// Smart dropdown for selecting measurement units based on ingredient
// Shows common units first, with "Other..." option for full list
// Dropdown appears below the button, not at bottom of screen
//
// CP6e-SmokeFix-SF1 (2026-05-14): `ingredientId` is now nullable. When null,
// the picker skips common-units loading and routes directly to all-units
// mode (no back button, no "Other units…" footer — the user is already
// looking at the full list). Consumers that previously fell back to a plain
// TextInput for the no-ingredient case (AddNeedSheet / EditNeedSheet for T3
// custom-name needs) can now adopt this component directly — see P8R-D27 in
// DEFERRED_WORK.md.
// Location: components/UnitPicker.tsx

import { useState, useEffect, useRef, useMemo } from 'react';
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
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import { supabase } from '../lib/supabase';

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
  /**
   * CP6e-SmokeFix-SF1: nullable. When null, skips common-units loading and
   * routes directly to all-units mode (no back button, no "Other units…"
   * footer).
   */
  ingredientId: string | null;
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
  const { colors, functionalColors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [commonUnits, setCommonUnits] = useState<UnitOption[]>([]);
  const [allUnits, setAllUnits] = useState<UnitOption[]>([]);
  const [showingAll, setShowingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buttonLayout, setButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const buttonRef = useRef<View>(null);

  // Load common units when ingredient changes.
  // CP6e-SmokeFix-SF1: null ingredientId → no common units exist; pre-load
  // the full all-units list and start in all-units mode so the picker opens
  // straight to a usable list. Switching from null → ingredient resets
  // showingAll so the user lands on common units first (existing behavior).
  useEffect(() => {
    if (ingredientId) {
      setShowingAll(false);
      loadCommonUnits();
    } else {
      setCommonUnits([]);
      setShowingAll(true);
      if (allUnits.length === 0) {
        loadAllUnits();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredientId]);

  const loadCommonUnits = async () => {
    setLoading(true);
    try {
      // 8R-CP4.5: replaced dynamic import of deleted pantryService with inline
      // Supabase query against ingredient_common_units + measurement_units.
      // 8R-UX6 Item 5: dropped `sort_order` from select + `.order('sort_order')`
      // — that column doesn't exist on ingredient_common_units. The CP4.5
      // substitution assumed it would but never verified. Pre-fix this fired
      // `ERROR Error loading units: column ingredient_common_units.sort_order
      // does not exist` whenever UnitPicker rendered.
      const { data, error } = await supabase
        .from('ingredient_common_units')
        .select(
          'unit_id, measurement_units(id, unit, display_singular, display_plural)'
        )
        .eq('ingredient_id', ingredientId);

      if (error) throw error;

      const units: UnitOption[] = (data ?? []).map((row) => {
        const r = row as {
          unit_id: string;
          measurement_units: { id: string; unit: string; display_singular: string; display_plural: string } | null;
        };
        const display = r.measurement_units?.display_plural ?? r.measurement_units?.unit ?? '';
        return {
          unit_id: r.unit_id,
          display_name: display,
          is_common: true,
          sort_order: 0,
        };
      });

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
      const { data, error } = await supabase
        .from('measurement_units')
        .select('id, unit, display_singular, display_plural, sort_order')
        .order('sort_order');

      if (error) throw error;

      const units: UnitOption[] = (data ?? []).map((row) => {
        const r = row as {
          id: string;
          unit: string;
          display_singular: string;
          display_plural: string;
          sort_order: number | null;
        };
        return {
          unit_id: r.id,
          display_name: r.display_plural ?? r.unit,
          is_common: false,
          sort_order: r.sort_order ?? 0,
        };
      });

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

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    pickerButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
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
      backgroundColor: colors.background.card,
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
  }), [colors, functionalColors]);

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
                  {/* CP6e-SmokeFix-SF1: back-button suppressed when
                      ingredientId is null — there are no common units to go
                      back to. */}
                  {showingAll && ingredientId !== null && (
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

                    {/* "Other..." button to show all units.
                        CP6e-SmokeFix-SF1: explicit guard on ingredientId
                        documents the design (commonUnits.length>0 would
                        have suppressed it anyway, but the guard makes the
                        no-ingredient path explicit). */}
                    {!showingAll && ingredientId !== null && commonUnits.length > 0 && (
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