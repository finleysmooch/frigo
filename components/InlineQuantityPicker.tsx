// ============================================
// FRIGO - INLINE QUANTITY PICKER
// ============================================
// Scroll picker for quantity that renders inline (no modal)
// Location: components/InlineQuantityPicker.tsx

import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { QUANTITY_VALUES } from '../constants/pantry';

interface Props {
  currentQuantity: number;
  onSave: (quantity: number) => void;
  onCancel: () => void;
}

export default function InlineQuantityPicker({
  currentQuantity,
  onSave,
  onCancel,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const [selectedQuantity, setSelectedQuantity] = useState(currentQuantity);

  const styles = useMemo(() => StyleSheet.create({
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
    pickerContainer: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    picker: {
      height: 150,
      width: '100%',
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
  }), [colors, functionalColors]);

  const handleSave = () => {
    onSave(selectedQuantity);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Quantity</Text>
      
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedQuantity}
          onValueChange={(value) => setSelectedQuantity(value)}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {QUANTITY_VALUES.map((value) => (
            <Picker.Item
              key={value}
              label={value.toString()}
              value={value}
            />
          ))}
        </Picker>
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