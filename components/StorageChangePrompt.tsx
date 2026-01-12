// ============================================
// FRIGO - STORAGE CHANGE PROMPT COMPONENT
// ============================================
// Multi-step prompt when changing storage location
// Asks: How much? How long? What about remainder?
// Location: components/StorageChangePrompt.tsx

import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { StorageLocation } from '../lib/types/pantry';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { QUANTITY_VALUES, EXPIRATION_UNITS, getStorageInfo } from '../constants/pantry';

type Step = 'quantity' | 'expiration';

interface Props {
  visible: boolean;
  itemName: string;
  currentQuantity: number;
  currentUnit: string;
  newStorage: StorageLocation;
  onClose: () => void;
  onConfirm: (moveQuantity: number, expirationDays: number) => void;
}

export default function StorageChangePrompt({
  visible,
  itemName,
  currentQuantity,
  currentUnit,
  newStorage,
  onClose,
  onConfirm,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const [step, setStep] = useState<Step>('quantity');
  const [moveQuantity, setMoveQuantity] = useState(currentQuantity);
  const [expirationNumber, setExpirationNumber] = useState(7);
  const [expirationUnit, setExpirationUnit] = useState('days');

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
    descriptionContainer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    description: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      textAlign: 'center',
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
    dualPickers: {
      flexDirection: 'row',
    },
    pickerWrapper: {
      flex: 1,
    },
  }), [colors, functionalColors]);

  const storageInfo = getStorageInfo(newStorage);

  const handleNext = () => {
    if (step === 'quantity') {
      setStep('expiration');
    } else {
      // Calculate total days
      let totalDays = expirationNumber;
      if (expirationUnit === 'weeks') {
        totalDays = expirationNumber * 7;
      } else if (expirationUnit === 'months') {
        totalDays = expirationNumber * 30;
      }
      
      onConfirm(moveQuantity, totalDays);
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setStep('quantity');
    setMoveQuantity(currentQuantity);
    setExpirationNumber(7);
    setExpirationUnit('days');
    onClose();
  };

  // Filter quantity values to only show up to current quantity
  const availableQuantities = QUANTITY_VALUES.filter(q => q <= currentQuantity);
  const numbers = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={resetAndClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={resetAndClose}
      >
        <TouchableOpacity
          style={styles.container}
          activeOpacity={1}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={resetAndClose}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {step === 'quantity' ? 'How much?' : 'How long?'}
            </Text>
            <TouchableOpacity onPress={handleNext}>
              <Text style={styles.saveButton}>
                {step === 'quantity' ? 'Next' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>
              {step === 'quantity' 
                ? `How much ${itemName} are you moving to ${storageInfo.emoji} ${storageInfo.label}?`
                : `How long will it last in the ${storageInfo.label}?`
              }
            </Text>
          </View>

          {/* Pickers */}
          <View style={styles.pickerContainer}>
            {step === 'quantity' ? (
              <Picker
                selectedValue={moveQuantity}
                onValueChange={(value: number) => setMoveQuantity(value)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {availableQuantities.map((value: number) => (
                  <Picker.Item
                    key={value}
                    label={`${value} ${currentUnit}`}
                    value={value}
                  />
                ))}
              </Picker>
            ) : (
              <View style={styles.dualPickers}>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={expirationNumber}
                    onValueChange={(value: number) => setExpirationNumber(value)}
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
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={expirationUnit}
                    onValueChange={(value: string) => setExpirationUnit(value)}
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
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}