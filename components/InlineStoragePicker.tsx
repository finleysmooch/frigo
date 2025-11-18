// ============================================
// FRIGO - INLINE STORAGE PICKER
// ============================================
// Storage location picker that renders inline (no modal)
// Location: components/InlineStoragePicker.tsx

import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { StorageLocation } from '../lib/types/pantry';
import { colors, typography, spacing, borderRadius } from '../lib/theme';
import { STORAGE_LOCATIONS } from '../constants/pantry';

interface Props {
  currentStorage: StorageLocation;
  onSave: (storage: StorageLocation) => void;
  onCancel: () => void;
}

export default function InlineStoragePicker({
  currentStorage,
  onSave,
  onCancel,
}: Props) {
  const [selectedStorage, setSelectedStorage] = useState<StorageLocation>(currentStorage);

  const handleSave = () => {
    onSave(selectedStorage);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Move to</Text>
      
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedStorage}
          onValueChange={(value) => setSelectedStorage(value)}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {STORAGE_LOCATIONS.map((location) => (
            <Picker.Item
              key={location.value}
              label={`${location.emoji} ${location.label}`}
              value={location.value}
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
          <Text style={styles.saveButtonText}>Move</Text>
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
});