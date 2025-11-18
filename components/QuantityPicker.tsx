// ============================================
// FRIGO - QUANTITY PICKER COMPONENT
// ============================================
// Inline scroll picker for editing pantry item quantity
// Location: components/QuantityPicker.tsx

import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';
import { QUANTITY_VALUES } from '../constants/pantry';

interface Props {
  visible: boolean;
  currentQuantity: number;
  onClose: () => void;
  onSave: (quantity: number) => void;
}

export default function QuantityPicker({
  visible,
  currentQuantity,
  onClose,
  onSave,
}: Props) {
  const [selectedQuantity, setSelectedQuantity] = useState(currentQuantity);

  const handleSave = () => {
    onSave(selectedQuantity);
    onClose();
  };

  // Find closest quantity value if current quantity not in list
  const initialValue = QUANTITY_VALUES.includes(currentQuantity)
    ? currentQuantity
    : QUANTITY_VALUES.reduce((prev: number, curr: number) =>
        Math.abs(curr - currentQuantity) < Math.abs(prev - currentQuantity) ? curr : prev
      );

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
            <Text style={styles.title}>Edit Quantity</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Picker */}
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedQuantity}
              onValueChange={(value: number) => setSelectedQuantity(value)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {QUANTITY_VALUES.map((value: number) => (
                <Picker.Item
                  key={value}
                  label={value.toString()}
                  value={value}
                />
              ))}
            </Picker>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  pickerContainer: {
    paddingVertical: spacing.md,
  },
  picker: {
    height: 200,
  },
  pickerItem: {
    fontSize: typography.sizes.xl,
    height: 200,
  },
});