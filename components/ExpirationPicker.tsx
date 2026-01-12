// ============================================
// FRIGO - EXPIRATION PICKER COMPONENT
// ============================================
// Dual scroll picker for editing expiration (number + unit)
// Location: components/ExpirationPicker.tsx

import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import { EXPIRATION_UNITS } from '../constants/pantry';
import { getDaysUntilExpiration } from '../utils/pantryHelpers';

interface Props {
  visible: boolean;
  currentExpiration: string | null;
  onClose: () => void;
  onSave: (days: number) => void;
}

export default function ExpirationPicker({
  visible,
  currentExpiration,
  onClose,
  onSave,
}: Props) {
  const { colors, functionalColors } = useTheme();
  // Convert current expiration to number and unit
  const initialDays = currentExpiration ? getDaysUntilExpiration(currentExpiration) : 7;
  
  let initialNumber = 7;
  let initialUnit = 'days';
  
  if (initialDays <= 30) {
    initialNumber = Math.max(1, initialDays);
    initialUnit = 'days';
  } else if (initialDays <= 90) {
    initialNumber = Math.max(1, Math.floor(initialDays / 7));
    initialUnit = 'weeks';
  } else {
    initialNumber = Math.max(1, Math.floor(initialDays / 30));
    initialUnit = 'months';
  }

  const [selectedNumber, setSelectedNumber] = useState(initialNumber);
  const [selectedUnit, setSelectedUnit] = useState(initialUnit);

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      ...shadows.large,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    title: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
    },
    cancelButton: {
      fontSize: typography.sizes.md,
      color: colors.text.tertiary,
    },
    saveButton: {
      fontSize: typography.sizes.md,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    pickersContainer: {
      flexDirection: 'row',
      paddingVertical: spacing.md,
    },
    pickerWrapper: {
      flex: 1,
    },
    picker: {
      height: 200,
    },
    pickerItem: {
      fontSize: typography.sizes.xl,
      height: 200,
    },
  }), [colors, functionalColors]);

  const handleSave = () => {
    let totalDays = selectedNumber;
    
    if (selectedUnit === 'weeks') {
      totalDays = selectedNumber * 7;
    } else if (selectedUnit === 'months') {
      totalDays = selectedNumber * 30;
    }
    
    onSave(totalDays);
    onClose();
  };

  // Generate numbers 1-30 for picker
  const numbers = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.container}
          activeOpacity={1}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Expires In</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Dual Pickers */}
          <View style={styles.pickersContainer}>
            {/* Number Picker */}
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedNumber}
                onValueChange={(value: number) => setSelectedNumber(value)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {numbers.map((num: number) => (
                  <Picker.Item
                    key={num}
                    label={num.toString()}
                    value={num}
                  />
                ))}
              </Picker>
            </View>

            {/* Unit Picker */}
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedUnit}
                onValueChange={(value: string) => setSelectedUnit(value)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {EXPIRATION_UNITS.map((unit) => (
                  <Picker.Item
                    key={unit.value}
                    label={unit.label}
                    value={unit.value}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}