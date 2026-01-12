// ============================================
// FRIGO - STORAGE PICKER COMPONENT
// ============================================
// Inline picker for changing storage location
// Triggers smart prompts when moving items
// Location: components/StoragePicker.tsx

import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { StorageLocation } from '../lib/types/pantry';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { STORAGE_LOCATIONS } from '../constants/pantry';

interface Props {
  visible: boolean;
  currentStorage: StorageLocation;
  onClose: () => void;
  onSave: (storage: StorageLocation) => void;
}

export default function StoragePicker({
  visible,
  currentStorage,
  onClose,
  onSave,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const [selectedStorage, setSelectedStorage] = useState<StorageLocation>(currentStorage);

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.background.card,
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
      borderBottomColor: colors.border.medium,
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
  }), [colors, functionalColors]);

  const handleSave = () => {
    onSave(selectedStorage);
    onClose();
  };

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
            <Text style={styles.title}>Change Storage</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Picker */}
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedStorage}
              onValueChange={(value: StorageLocation) => setSelectedStorage(value)}
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
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}