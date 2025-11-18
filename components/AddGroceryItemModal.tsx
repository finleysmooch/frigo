// ============================================
// FRIGO - ADD GROCERY ITEM MODAL (NEW ARCHITECTURE)
// ============================================
// Modal for adding new items to a specific grocery list
// Location: components/AddGroceryItemModal.tsx
// Updated: November 6, 2025 - Works with multiple lists system

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, typography, spacing } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { addItemToList } from '../lib/groceryListsService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  listId: string;  // NEW: Which list to add to
}

interface Ingredient {
  id: string;
  name: string;
  plural_name: string | null;
  family: string;
  typical_unit: string | null;
}

export default function AddGroceryItemModal({
  visible,
  onClose,
  onSuccess,
  userId,
  listId,
}: Props) {
  // ============================================
  // STATE
  // ============================================
  
  const [searchQuery, setSearchQuery] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [brandPreference, setBrandPreference] = useState('');
  const [sizePreference, setSizePreference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // ============================================
  // EFFECTS
  // ============================================
  
  useEffect(() => {
    if (visible) {
      loadIngredients();
      resetForm();
    }
  }, [visible]);

  useEffect(() => {
    filterIngredients();
  }, [searchQuery, ingredients]);

  // ============================================
  // DATA LOADING
  // ============================================
  
  async function loadIngredients() {
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('ingredients')
        .select('id, name, plural_name, family, typical_unit')
        .order('name');

      if (error) throw error;
      setIngredients(data || []);
    } catch (error) {
      console.error('Error loading ingredients:', error);
    } finally {
      setSearching(false);
    }
  }

  function filterIngredients() {
    if (!searchQuery.trim()) {
      setFilteredIngredients([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = ingredients.filter(ing =>
      ing.name.toLowerCase().includes(query) ||
      (ing.plural_name && ing.plural_name.toLowerCase().includes(query))
    );
    setFilteredIngredients(filtered.slice(0, 20));
  }

  // ============================================
  // FORM ACTIONS
  // ============================================
  
  function resetForm() {
    setSearchQuery('');
    setSelectedIngredient(null);
    setQuantity('1');
    setUnit('');
    setBrandPreference('');
    setSizePreference('');
    setNotes('');
  }

  function selectIngredient(ingredient: Ingredient) {
    setSelectedIngredient(ingredient);
    setSearchQuery(ingredient.plural_name || ingredient.name);
    setUnit(ingredient.typical_unit || '');
    setFilteredIngredients([]);
  }

  async function handleSubmit() {
    if (!selectedIngredient) {
      Alert.alert('Error', 'Please select an ingredient');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (!unit.trim()) {
      Alert.alert('Error', 'Please enter a unit');
      return;
    }

    try {
      setLoading(true);

      // FIXED: Call with single object parameter
      await addItemToList({
        list_id: listId,
        ingredient_id: selectedIngredient.id,
        quantity_display: qty,
        unit_display: unit.trim(),
        notes: notes.trim() || undefined,
      });

      onSuccess();
    } catch (error) {
      console.error('Error adding grocery item:', error);
      Alert.alert('Error', 'Failed to add item to grocery list');
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Item</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeButton}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
            {/* Search Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Ingredient</Text>
              <TextInput
                style={styles.input}
                placeholder="Search ingredients..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              {/* Search Results */}
              {filteredIngredients.length > 0 && (
                <View style={styles.searchResults}>
                  {filteredIngredients.map(ing => (
                    <TouchableOpacity
                      key={ing.id}
                      style={styles.searchResultItem}
                      onPress={() => selectIngredient(ing)}
                    >
                      <Text style={styles.searchResultName}>
                        {ing.plural_name || ing.name}
                      </Text>
                      <Text style={styles.searchResultFamily}>{ing.family}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {searching && (
                <View style={styles.searchingIndicator}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
            </View>

            {/* Quantity & Unit */}
            {selectedIngredient && (
              <>
                <View style={styles.row}>
                  <View style={[styles.section, { flex: 1, marginRight: spacing.sm }]}>
                    <Text style={styles.label}>Quantity</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="1"
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={[styles.section, { flex: 1, marginLeft: spacing.sm }]}>
                    <Text style={styles.label}>Unit</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="cup, lb, etc"
                      value={unit}
                      onChangeText={setUnit}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Brand & Size (Optional) */}
                <View style={styles.row}>
                  <View style={[styles.section, { flex: 1, marginRight: spacing.sm }]}>
                    <Text style={styles.label}>Brand (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Kirkland, etc"
                      value={brandPreference}
                      onChangeText={setBrandPreference}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={[styles.section, { flex: 1, marginLeft: spacing.sm }]}>
                    <Text style={styles.label}>Size (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="large, 2L, etc"
                      value={sizePreference}
                      onChangeText={setSizePreference}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Notes */}
                <View style={styles.section}>
                  <Text style={styles.label}>Notes (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Any special instructions..."
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (!selectedIngredient || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedIngredient || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Add Item</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  closeButton: {
    fontSize: 36,
    color: colors.text.secondary,
    fontWeight: typography.weights.regular,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Search Results
  searchResults: {
    marginTop: spacing.xs,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 200,
  },
  searchResultItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  searchResultFamily: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  searchingIndicator: {
    padding: spacing.md,
    alignItems: 'center',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },
});