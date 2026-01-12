// ============================================
// FRIGO - ADD REGULAR ITEM MODAL
// ============================================
// Modal for adding new regular grocery items
// Location: components/AddRegularItemModal.tsx

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
import { addRegularItem } from '../lib/groceryService';
import { PurchaseFrequency } from '../lib/types/grocery';

interface Ingredient {
  id: string;
  name: string;
  family: string;
  typical_unit?: string;
  typical_purchase_quantity?: number;
}

interface AddRegularItemModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddRegularItemModal({
  visible,
  onClose,
  onSuccess,
}: AddRegularItemModalProps) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, functionalColors), [colors, functionalColors]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Ingredient[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [frequency, setFrequency] = useState<PurchaseFrequency>('weekly');
  const [customDays, setCustomDays] = useState('');
  const [lastPurchased, setLastPurchased] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      searchIngredients();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchIngredients = async () => {
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('ingredients')
        .select('id, name, family, typical_unit, typical_purchase_quantity')
        .ilike('name', `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching ingredients:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectIngredient = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setSearchQuery(ingredient.name);
    setSearchResults([]);
    
    // Set smart defaults
    if (ingredient.typical_purchase_quantity) {
      setQuantity(ingredient.typical_purchase_quantity.toString());
    } else {
      setQuantity('1');
    }
    
    if (ingredient.typical_unit) {
      setUnit(ingredient.typical_unit);
    } else {
      setUnit('unit');
    }
  };

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
    if (!selectedIngredient) {
      Alert.alert('Error', 'Please select an ingredient');
      return;
    }

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      await addRegularItem(user.id, {
        ingredientId: selectedIngredient.id,
        quantity: parseFloat(quantity),
        unit: unit,
        frequency: frequency,
        frequencyDays: frequency === 'custom' ? parseInt(customDays) : undefined,
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error adding regular item:', error);
      Alert.alert('Error', 'Failed to add regular item');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedIngredient(null);
    setQuantity('');
    setUnit('');
    setFrequency('weekly');
    setCustomDays('');
    setLastPurchased(new Date().toISOString().split('T')[0]);
    onClose();
  };

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
              <Text style={styles.title}>Add Regular Item</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              {/* Ingredient Search */}
              <View style={styles.section}>
                <Text style={styles.label}>Ingredient *</Text>
                <TextInput
                  style={styles.input}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search for ingredient..."
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                />
                
                {searching && (
                  <ActivityIndicator style={styles.searchLoader} color={colors.primary} />
                )}

                {searchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {searchResults.map((ingredient) => (
                      <TouchableOpacity
                        key={ingredient.id}
                        style={styles.searchResultItem}
                        onPress={() => handleSelectIngredient(ingredient)}
                      >
                        <Text style={styles.searchResultName}>{ingredient.name}</Text>
                        <Text style={styles.searchResultFamily}>{ingredient.family}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {selectedIngredient && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedText}>✓ {selectedIngredient.name}</Text>
                  </View>
                )}
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
                  Leave as today unless you recently bought this item
                </Text>
              </View>

              {/* Preview Next Due Date */}
              {selectedIngredient && quantity && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewLabel}>Next due date:</Text>
                  <Text style={styles.previewDate}>{calculateNextDate()}</Text>
                </View>
              )}
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
                  (!selectedIngredient || !quantity) && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!selectedIngredient || !quantity || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.saveButtonText}>Add Item</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: any, functionalColors: any) {
  return StyleSheet.create({
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
    searchLoader: {
      marginTop: spacing.sm,
    },
    searchResults: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      maxHeight: 200,
    },
    searchResultItem: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    searchResultName: {
      fontSize: typography.sizes.md,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    searchResultFamily: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
    },
    selectedBadge: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary + '20',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 8,
    },
    selectedText: {
      fontSize: typography.sizes.md,
      color: colors.primary,
      fontWeight: '600',
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
    previewContainer: {
      backgroundColor: colors.background.secondary,
      padding: spacing.md,
      borderRadius: 8,
      marginTop: spacing.md,
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
      color: colors.text.inverse,
      fontWeight: 'bold',
    },
  });
}