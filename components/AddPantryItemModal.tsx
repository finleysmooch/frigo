// ============================================
// FRIGO - ADD PANTRY ITEM MODAL
// ============================================
// Modal for adding new items to pantry with ingredient search and auto-calculations
// Location: components/AddPantryItemModal.tsx

import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { 
  addPantryItem, 
  searchIngredientsForPantry,
} from '../lib/pantryService';
import { calculateExpirationDate } from '../utils/pantryConversions';
import { IngredientWithPantryData, StorageLocation } from '../lib/types/pantry';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';
import UnitPicker from './UnitPicker';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  preSelectedCategory?: string | null;
  preSelectedIngredientId?: string | null;
  preSelectedIngredientName?: string | null;
}

export default function AddPantryItemModal({ 
  visible, 
  onClose, 
  onSave, 
  preSelectedCategory,
  preSelectedIngredientId,
  preSelectedIngredientName 
}: Props) {
  // Search & Ingredient Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [ingredients, setIngredients] = useState<IngredientWithPantryData[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientWithPantryData | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  // Item Details
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageLocation>('fridge');
  const [isOpened, setIsOpened] = useState(false);
  
  // Dates
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showPurchasePicker, setShowPurchasePicker] = useState(false);
  const [showExpirationPicker, setShowExpirationPicker] = useState(false);
  
  // Other
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    getCurrentUser();
  }, []);

  // Load pre-selected ingredient if provided
  useEffect(() => {
    if (visible && preSelectedIngredientId && preSelectedIngredientName) {
      loadPreSelectedIngredient();
    }
  }, [visible, preSelectedIngredientId, preSelectedIngredientName]);

  const loadPreSelectedIngredient = async () => {
    if (!preSelectedIngredientId) return;
    
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select(`
          id,
          name,
          plural_name,
          family,
          ingredient_type,
          ingredient_subtype,
          typical_unit,
          typical_weight_small_g,
          typical_weight_medium_g,
          typical_weight_large_g,
          default_storage_location,
          shelf_life_days_fridge,
          shelf_life_days_freezer,
          shelf_life_days_pantry,
          shelf_life_days_counter,
          shelf_life_days_fridge_opened,
          shelf_life_days_pantry_opened,
          requires_metric_conversion
        `)
        .eq('id', preSelectedIngredientId)
        .single();

      if (error || !data) {
        console.error('Error loading pre-selected ingredient:', error);
        return;
      }

      // Auto-select the ingredient
      selectIngredient(data);
    } catch (error) {
      console.error('Error in loadPreSelectedIngredient:', error);
    }
  };

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  // Search ingredients as user types
  useEffect(() => {
    if (searchTerm.length >= 2) {
      handleSearch();
    } else {
      setIngredients([]);
      setShowResults(false);
    }
  }, [searchTerm]);

  const handleSearch = async () => {
    try {
      const results = await searchIngredientsForPantry(searchTerm, preSelectedCategory || undefined);
      setIngredients(results);
      setShowResults(results.length > 0);
    } catch (error) {
      console.error('Error searching ingredients:', error);
    }
  };

  // Handle ingredient selection
  const selectIngredient = async (ingredient: IngredientWithPantryData) => {
    setSelectedIngredient(ingredient);
    setSearchTerm(ingredient.name);
    setShowResults(false);
    
    // Set defaults from ingredient data
    setQuantity('1');
    setUnit(ingredient.plural_name || ingredient.name);
    setStorage(ingredient.default_storage_location || 'fridge');
    
    // Calculate expiration date
    const purchaseDateStr = purchaseDate.toISOString().split('T')[0];
    const expiry = calculateExpirationDate(
      purchaseDateStr,
      ingredient.default_storage_location || 'fridge',
      ingredient,
      isOpened
    );
    
    if (expiry) {
      setExpirationDate(new Date(expiry));
    }
  };

  // Recalculate expiration when storage or opened status changes
  useEffect(() => {
    if (selectedIngredient) {
      const purchaseDateStr = purchaseDate.toISOString().split('T')[0];
      const expiry = calculateExpirationDate(
        purchaseDateStr,
        storage,
        selectedIngredient,
        isOpened
      );
      if (expiry) {
        setExpirationDate(new Date(expiry));
      }
    }
  }, [storage, isOpened, purchaseDate, selectedIngredient]);

  // Handle save
  const handleSave = async () => {
    if (!selectedIngredient || !quantity || !currentUserId) {
      Alert.alert('Missing Information', 'Please select an ingredient and enter a quantity');
      return;
    }

    try {
      setSaving(true);
      
      await addPantryItem({
        ingredient_id: selectedIngredient.id,
        quantity_display: parseFloat(quantity),
        unit_display: unit,
        storage_location: storage,
        purchase_date: purchaseDate.toISOString().split('T')[0],
        expiration_date: expirationDate?.toISOString().split('T')[0] || null,
        is_opened: isOpened,
        opened_date: isOpened ? purchaseDate.toISOString().split('T')[0] : null,
        notes: notes || null
      }, currentUserId);

      // Reset form
      resetForm();
      onSave();
      
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item to pantry');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSearchTerm('');
    setIngredients([]);
    setSelectedIngredient(null);
    setShowResults(false);
    setQuantity('1');
    setUnit('');
    setUnitId(null);
    setStorage('fridge');
    setIsOpened(false);
    setPurchaseDate(new Date());
    setExpirationDate(null);
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add to Pantry</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Search Ingredient */}
            <View style={styles.section}>
              <Text style={styles.label}>INGREDIENT *</Text>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search ingredient..."
                  placeholderTextColor={colors.text.placeholder}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  enablesReturnKeyAutomatically={true}
                />
                {searchTerm.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearSearchButton}
                    onPress={() => {
                      setSearchTerm('');
                      setShowResults(false);
                    }}
                  >
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Search Results Dropdown */}
              {showResults && ingredients.length > 0 && (
                <View style={styles.searchResults}>
                  {ingredients.slice(0, 4).map((ingredient) => (
                    <TouchableOpacity
                      key={ingredient.id}
                      style={styles.searchResultItem}
                      onPress={() => selectIngredient(ingredient)}
                    >
                      <Text style={styles.searchResultText}>{ingredient.name}</Text>
                      <Text style={styles.searchResultCategory}>
                        {ingredient.family} • {ingredient.ingredient_type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* No results message */}
              {searchTerm.length >= 2 && !showResults && ingredients.length === 0 && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No ingredients found</Text>
                </View>
              )}
            </View>

            {/* Quantity & Unit */}
            {selectedIngredient && (
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>QUANTITY *</Text>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, styles.quantityInput]}
                      placeholder="5"
                      placeholderTextColor={colors.text.placeholder}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="decimal-pad"
                    />
                    <UnitPicker
                      ingredientId={selectedIngredient.id}
                      selectedUnit={unit}
                      onSelectUnit={(id, displayName) => {
                        setUnit(displayName);
                        setUnitId(id);
                      }}
                    />
                  </View>
                </View>

                {/* Storage Location */}
                <View style={styles.section}>
                  <Text style={styles.label}>STORAGE *</Text>
                  <View style={styles.buttonRow}>
                    {(['fridge', 'freezer', 'pantry', 'counter'] as StorageLocation[]).map((loc) => (
                      <TouchableOpacity
                        key={loc}
                        style={[
                          styles.storageButton,
                          storage === loc && styles.storageButtonActive
                        ]}
                        onPress={() => setStorage(loc)}
                      >
                        <Text style={[
                          styles.storageButtonText,
                          storage === loc && styles.storageButtonTextActive
                        ]}>
                          {loc.charAt(0).toUpperCase() + loc.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Opened/Unopened Status */}
                <View style={styles.section}>
                  <Text style={styles.label}>STATUS</Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        !isOpened && styles.statusButtonActive
                      ]}
                      onPress={() => setIsOpened(false)}
                    >
                      <Text style={[
                        styles.statusButtonText,
                        !isOpened && styles.statusButtonTextActive
                      ]}>
                        Unopened
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        isOpened && styles.statusButtonActive
                      ]}
                      onPress={() => setIsOpened(true)}
                    >
                      <Text style={[
                        styles.statusButtonText,
                        isOpened && styles.statusButtonTextActive
                      ]}>
                        Opened
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Purchase Date */}
                <View style={styles.section}>
                  <Text style={styles.label}>PURCHASE DATE</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowPurchasePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>{formatDate(purchaseDate)}</Text>
                    <Text style={styles.dateButtonIcon}>📅</Text>
                  </TouchableOpacity>
                  
                  {showPurchasePicker && (
                    <DateTimePicker
                      value={purchaseDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(event, selectedDate) => {
                        setShowPurchasePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setPurchaseDate(selectedDate);
                        }
                      }}
                    />
                  )}
                </View>

                {/* Expiration Date */}
                <View style={styles.section}>
                  <Text style={styles.label}>EXPIRATION (auto-calculated)</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowExpirationPicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {expirationDate ? formatDate(expirationDate) : 'Not set'}
                    </Text>
                    <Text style={styles.dateButtonIcon}>📅</Text>
                  </TouchableOpacity>
                  <Text style={styles.helperText}>Tap to edit calculated date</Text>
                  
                  {showExpirationPicker && expirationDate && (
                    <DateTimePicker
                      value={expirationDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(event, selectedDate) => {
                        setShowExpirationPicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setExpirationDate(selectedDate);
                        }
                      }}
                    />
                  )}
                </View>

                {/* Notes */}
                <View style={styles.section}>
                  <Text style={styles.label}>NOTES (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.notesInput]}
                    placeholder="Add any notes..."
                    placeholderTextColor={colors.text.placeholder}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </>
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
                (!selectedIngredient || !quantity || saving) && styles.saveButtonDisabled
              ]}
              onPress={handleSave}
              disabled={!selectedIngredient || !quantity || saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Adding...' : 'Add Item'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    height: '90%',
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
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: typography.sizes.xl,
    color: colors.text.tertiary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  searchInputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.xxxl, // Make room for clear button
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  clearSearchButton: {
    position: 'absolute',
    right: spacing.md,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.border.medium,
    borderRadius: borderRadius.round,
  },
  clearSearchText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    fontWeight: typography.weights.bold,
  },
  noResultsContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  searchResults: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
    ...shadows.small,
  },
  searchResultItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchResultText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  searchResultCategory: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  quantityInput: {
    flex: 1,
  },
  unitInput: {
    flex: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  storageButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
    alignItems: 'center',
  },
  storageButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  storageButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
  },
  storageButtonTextActive: {
    color: colors.background.primary,
  },
  statusButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
  },
  statusButtonTextActive: {
    color: colors.background.primary,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  dateButtonText: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  dateButtonIcon: {
    fontSize: typography.sizes.lg,
  },
  helperText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.border.medium,
  },
  saveButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.background.primary,
  },
});