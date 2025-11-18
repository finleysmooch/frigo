// ============================================
// FRIGO - INLINE EXPIRATION PICKER
// ============================================
// Dual scroll picker for expiration that renders inline (no modal)
// Location: components/InlineExpirationPicker.tsx

import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, typography, spacing, borderRadius } from '../lib/theme';
import { EXPIRATION_UNITS } from '../constants/pantry';
import { getDaysUntilExpiration } from '../utils/pantryHelpers';

interface Props {
  currentExpiration: string | null;
  onSave: (days: number) => void;
  onCancel: () => void;
}

export default function InlineExpirationPicker({
  currentExpiration,
  onSave,
  onCancel,
}: Props) {
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

  const handleSave = () => {
    let totalDays = selectedNumber;
    
    if (selectedUnit === 'weeks') {
      totalDays = selectedNumber * 7;
    } else if (selectedUnit === 'months') {
      totalDays = selectedNumber * 30;
    }
    
    onSave(totalDays);
  };

  // Generate numbers 1-30 for picker
  const numbers = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expires In</Text>
      
      <View style={styles.pickersContainer}>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedNumber}
            onValueChange={(value: number) => setSelectedNumber(value)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {numbers.map((num: number) => {
              return (
                <Picker.Item
                  key={num}
                  label={num.toString()}
                  value={num}
                />
              );
            })}
          </Picker>
        </View>

        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedUnit}
            onValueChange={(value: string) => setSelectedUnit(value)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {EXPIRATION_UNITS.map((unit) => {
              return (
                <Picker.Item
                  key={unit.value}
                  label={unit.label}
                  value={unit.value}
                />
              );
            })}
          </Picker>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  pickersContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  pickerWrapper: {
    flex: 1,
  },
  picker: {
    height: 150,
  },
  pickerItem: {
    fontSize: typography.sizes.lg,
    height: 150,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background.tertiary,
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.background.primary,
  },
});