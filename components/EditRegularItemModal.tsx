// ============================================
// FRIGO - EDIT REGULAR ITEM MODAL
// ============================================
// Modal for editing existing regular grocery items
// Location: components/EditRegularItemModal.tsx

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { typography, spacing } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import { updateRegularItem, deleteRegularItem } from '../lib/groceryService';
import {
  RegularGroceryItemWithIngredient,
  PurchaseFrequency,
} from '../lib/types/grocery';

interface EditRegularItemModalProps {
  visible: boolean;
  item: RegularGroceryItemWithIngredient | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditRegularItemModal({
  visible,
  item,
  onClose,
  onSuccess,
}: EditRegularItemModalProps) {
  const { colors, functionalColors } = useTheme();
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [frequency, setFrequency] = useState<PurchaseFrequency>('weekly');
  const [customDays, setCustomDays] = useState('');
  const [lastPurchased, setLastPurchased] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity_display.toString());
      setUnit(item.unit_display);
      setFrequency(item.purchase_frequency);
      setCustomDays(item.frequency_days?.toString() || '');
      setLastPurchased(item.last_purchased || '');
      setIsPaused(!item.is_active);
    }
  }, [item]);

  const calculateNextDate = (): string => {
    const lastDate = new Date(lastPurchased);
    let daysToAdd = 0;

    switch (frequency) {
      case 'weekly':
        daysToAdd = 7;
        break;
      case 'biweekly':
        daysToAdd = 14;
        break;
      case 'monthly':
        daysToAdd = 30;
        break;
      case 'custom':
        daysToAdd = parseInt(customDays) || 7;
        break;
    }

    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    return nextDate.toISOString().split('T')[0];
  };

  const handleSave = async () => {
    if (!item) return;

    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (frequency === 'custom' && (!customDays || parseInt(customDays) <= 0)) {
      Alert.alert('Error', 'Please enter valid custom frequency days');
      return;
    }

    try {
      setLoading(true);

      await updateRegularItem(item.id, {
        quantity: parseFloat(quantity),
        unit: unit,
        frequency: frequency,
        frequencyDays: frequency === 'custom' ? parseInt(customDays) : undefined,
        isActive: !isPaused,
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error updating regular item:', error);
      Alert.alert('Error', 'Failed to update regular item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!item) return;

    Alert.alert(
      'Delete Regular Item',
      `Are you sure you want to delete "${item.ingredient?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteRegularItem(item.id);
              onSuccess();
              handleClose();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    onClose();
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    title: {
      fontSize: typography.sizes.xl,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    closeButton: {
      padding: spacing.sm,
    },
    closeButtonText: {
      fontSize: 24,
      color: colors.text.tertiary,
    },
    content: {
      padding: spacing.md,
    },
    section: {
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: typography.sizes.md,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      padding: spacing.md,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      backgroundColor: colors.background.card,
    },
    readOnlyField: {
      backgroundColor: colors.background.secondary,
      padding: spacing.md,
      borderRadius: 8,
    },
    readOnlyText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    quantityInput: {
      flex: 1,
    },
    unitInput: {
      flex: 1,
    },
    frequencyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      marginBottom: spacing.sm,
    },
    frequencyOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border.medium,
      marginRight: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    frequencyText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
    frequencyTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    customFrequencyContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    customDaysInput: {
      flex: 1,
    },
    customDaysLabel: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
    helperText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      marginTop: spacing.xs,
    },
    pauseToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
    },
    pauseToggleActive: {
      borderColor: functionalColors.warning,
      backgroundColor: functionalColors.warning + '10',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: colors.border.medium,
      borderRadius: 4,
      marginRight: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkmark: {
      fontSize: 16,
      color: functionalColors.warning,
      fontWeight: 'bold',
    },
    pauseToggleText: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    pauseToggleHelper: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
    },
    previewContainer: {
      backgroundColor: colors.background.secondary,
      padding: spacing.md,
      borderRadius: 8,
      marginBottom: spacing.md,
    },
    previewLabel: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      marginBottom: spacing.xs,
    },
    previewDate: {
      fontSize: typography.sizes.lg,
      fontWeight: 'bold',
      color: colors.primary,
    },
    deleteButton: {
      backgroundColor: functionalColors.error,
      padding: spacing.md,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    deleteButtonText: {
      color: colors.background.card,
      fontSize: typography.sizes.md,
      fontWeight: 'bold',
    },
    footer: {
      flexDirection: 'row',
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      gap: spacing.sm,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border.medium,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      backgroundColor: colors.text.tertiary,
    },
    saveButtonText: {
      fontSize: typography.sizes.md,
      color: colors.background.card,
      fontWeight: 'bold',
    },
  }), [colors, functionalColors]);

  if (!item) return null;

  const frequencyOptions: { value: PurchaseFrequency; label: string }[] = [
    { value: 'weekly', label: 'Weekly (7 days)' },
    { value: 'biweekly', label: 'Biweekly (14 days)' },
    { value: 'monthly', label: 'Monthly (30 days)' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Edit Regular Item</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              {/* Ingredient Name (Read-only) */}
              <View style={styles.section}>
                <Text style={styles.label}>Ingredient</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>
                    {item.ingredient?.name || 'Unknown item'}
                  </Text>
                </View>
              </View>

              {/* Quantity & Unit */}
              <View style={styles.section}>
                <Text style={styles.label}>Default Quantity *</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.quantityInput]}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="2"
                    keyboardType="numeric"
                    placeholderTextColor={colors.text.tertiary}
                  />
                  <TextInput
                    style={[styles.input, styles.unitInput]}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="lbs"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
              </View>

              {/* Purchase Frequency */}
              <View style={styles.section}>
                <Text style={styles.label}>Purchase Frequency *</Text>
                {frequencyOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.frequencyOption,
                      frequency === option.value && styles.frequencyOptionActive,
                    ]}
                    onPress={() => setFrequency(option.value)}
                  >
                    <View style={styles.radio}>
                      {frequency === option.value && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.frequencyText,
                        frequency === option.value && styles.frequencyTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                {frequency === 'custom' && (
                  <View style={styles.customFrequencyContainer}>
                    <TextInput
                      style={[styles.input, styles.customDaysInput]}
                      value={customDays}
                      onChangeText={setCustomDays}
                      placeholder="14"
                      keyboardType="numeric"
                      placeholderTextColor={colors.text.tertiary}
                    />
                    <Text style={styles.customDaysLabel}>days</Text>
                  </View>
                )}
              </View>

              {/* Last Purchased Date */}
              <View style={styles.section}>
                <Text style={styles.label}>Last Purchased</Text>
                <TextInput
                  style={styles.input}
                  value={lastPurchased}
                  onChangeText={setLastPurchased}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={styles.helperText}>
                  Update this when you purchase the item
                </Text>
              </View>

              {/* Pause Toggle */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={[
                    styles.pauseToggle,
                    isPaused && styles.pauseToggleActive,
                  ]}
                  onPress={() => setIsPaused(!isPaused)}
                >
                  <View style={styles.checkbox}>
                    {isPaused && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View>
                    <Text style={styles.pauseToggleText}>Pause this item</Text>
                    <Text style={styles.pauseToggleHelper}>
                      Won't appear in Quick Add until resumed
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Preview Next Due Date */}
              {!isPaused && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewLabel}>Next due date:</Text>
                  <Text style={styles.previewDate}>{calculateNextDate()}</Text>
                </View>
              )}

              {/* Delete Button */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>🗑️ Delete Item</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !quantity && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!quantity || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}