// ============================================
// FRIGO - STORES SCREEN
// ============================================
// Manage stores and ingredient preferences
// Location: screens/StoresScreen.tsx
// Created: November 6, 2025

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing } from '../lib/theme';
import {
  getUserStores,
  createStore,
  updateStore,
  deleteStore,
  getIngredientsWithPreferences,
  updateIngredientPreference,
} from '../lib/storeService';
import { Store, IngredientWithPreference, PurchaseFrequency } from '../lib/types/store';

type Props = NativeStackScreenProps<any, 'Stores'>;

const FREQUENCY_OPTIONS: { value: PurchaseFrequency | null; label: string }[] = [
  { value: null, label: 'Not Set' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'as_needed', label: 'As Needed' },
];

export default function StoresScreen({ navigation }: Props) {
  const { colors, functionalColors } = useTheme();

  // ============================================
  // STATE
  // ============================================

  const [userId, setUserId] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [ingredients, setIngredients] = useState<IngredientWithPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Store management
  const [newStoreName, setNewStoreName] = useState('');
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingStoreName, setEditingStoreName] = useState('');

  // Ingredient search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'stores' | 'preferences'>('stores');

  // ============================================
  // STYLES
  // ============================================

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
    header: {
      backgroundColor: colors.background.card,
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.background.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
    },
    section: {
      gap: spacing.md,
    },
    addStoreContainer: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border.medium,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    editInput: {
      flex: 1,
      marginRight: spacing.sm,
    },
    addButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      justifyContent: 'center',
    },
    addButtonText: {
      color: colors.background.card,
      fontWeight: typography.weights.semibold,
      fontSize: typography.sizes.md,
    },
    storeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      padding: spacing.md,
      borderRadius: 8,
      shadowColor: colors.text.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    storeName: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    iconButton: {
      padding: spacing.xs,
      marginLeft: spacing.sm,
    },
    iconButtonText: {
      fontSize: 18,
    },
    editIcon: {
      fontSize: 16,
    },
    deleteIcon: {
      fontSize: 20,
      color: functionalColors.error,
    },
    searchContainer: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    searchInput: {
      flex: 1,
      backgroundColor: colors.background.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border.medium,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    searchButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 50,
    },
    searchButtonText: {
      fontSize: 20,
    },
    infoBox: {
      backgroundColor: colors.background.secondary,
      padding: spacing.md,
      borderRadius: 8,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    infoText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
    },
    ingredientItem: {
      backgroundColor: colors.background.card,
      padding: spacing.md,
      borderRadius: 8,
      shadowColor: colors.text.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      gap: spacing.sm,
    },
    ingredientName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    ingredientFamily: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
    },
    pickerRow: {
      gap: spacing.xs,
    },
    pickerLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.text.secondary,
    },
    pickerScroll: {
      flexDirection: 'row',
    },
    pickerOption: {
      backgroundColor: colors.background.secondary,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 6,
      marginRight: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    pickerOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pickerOptionText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
    },
    pickerOptionTextActive: {
      color: colors.background.card,
      fontWeight: typography.weights.semibold,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: spacing.md,
    },
    emptyText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      textAlign: 'center',
    },
  }), [colors, functionalColors]);

  // ============================================
  // LIFECYCLE
  // ============================================

  useEffect(() => {
    initializeScreen();
  }, []);

  async function initializeScreen() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await loadData(user.id);
      }
    } catch (error) {
      console.error('Error initializing:', error);
    }
  }

  async function loadData(uid: string) {
    try {
      setLoading(true);
      const [storesList, ingredientsList] = await Promise.all([
        getUserStores(uid),
        getIngredientsWithPreferences(uid, ''),
      ]);
      setStores(storesList);
      setIngredients(ingredientsList);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load stores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => {
    if (userId) {
      setRefreshing(true);
      loadData(userId);
    }
  }, [userId]);

  // ============================================
  // STORE ACTIONS
  // ============================================

  async function handleAddStore() {
    if (!userId || !newStoreName.trim()) return;

    try {
      await createStore(userId, newStoreName);
      setNewStoreName('');
      await loadData(userId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add store');
    }
  }

  function startEditingStore(store: Store) {
    setEditingStoreId(store.id);
    setEditingStoreName(store.name);
  }

  async function handleUpdateStore() {
    if (!editingStoreId || !editingStoreName.trim()) return;

    try {
      await updateStore(editingStoreId, editingStoreName);
      setEditingStoreId(null);
      setEditingStoreName('');
      if (userId) await loadData(userId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update store');
    }
  }

  function cancelEditingStore() {
    setEditingStoreId(null);
    setEditingStoreName('');
  }

  async function handleDeleteStore(storeId: string, storeName: string) {
    Alert.alert(
      'Delete Store',
      `Delete "${storeName}"? Ingredients will be unassigned from this store.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStore(storeId);
              if (userId) await loadData(userId);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete store');
            }
          },
        },
      ]
    );
  }

  // ============================================
  // INGREDIENT PREFERENCE ACTIONS
  // ============================================

  async function handleSearchIngredients() {
    if (!userId) return;

    try {
      setSearchLoading(true);
      const results = await getIngredientsWithPreferences(userId, searchQuery);
      setIngredients(results);
    } catch (error) {
      console.error('Error searching ingredients:', error);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSetIngredientStore(
    ingredientId: string,
    storeId: string | null
  ) {
    if (!userId) return;

    try {
      await updateIngredientPreference(userId, ingredientId, {
        preferred_store_id: storeId,
      });
      // Update local state
      setIngredients(prev =>
        prev.map(ing =>
          ing.id === ingredientId
            ? {
                ...ing,
                preferred_store_id: storeId,
                preferred_store: storeId
                  ? stores.find(s => s.id === storeId)
                  : null,
              }
            : ing
        )
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update store preference');
    }
  }

  async function handleSetIngredientFrequency(
    ingredientId: string,
    frequency: PurchaseFrequency | null
  ) {
    if (!userId) return;

    try {
      await updateIngredientPreference(userId, ingredientId, {
        purchase_frequency: frequency,
      });
      // Update local state
      setIngredients(prev =>
        prev.map(ing =>
          ing.id === ingredientId
            ? { ...ing, purchase_frequency: frequency }
            : ing
        )
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update frequency');
    }
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading stores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Stores</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stores' && styles.tabActive]}
          onPress={() => setActiveTab('stores')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'stores' && styles.tabTextActive,
            ]}
          >
            Stores
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'preferences' && styles.tabActive]}
          onPress={() => setActiveTab('preferences')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'preferences' && styles.tabTextActive,
            ]}
          >
            Preferences
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'stores' ? (
          <View style={styles.section}>
            {/* Add Store */}
            <View style={styles.addStoreContainer}>
              <TextInput
                style={styles.input}
                placeholder="Store name (e.g., Whole Foods)"
                placeholderTextColor={colors.text.tertiary}
                value={newStoreName}
                onChangeText={setNewStoreName}
                onSubmitEditing={handleAddStore}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddStore}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Stores List */}
            {stores.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏪</Text>
                <Text style={styles.emptyText}>
                  No stores yet. Add your first store above!
                </Text>
              </View>
            ) : (
              stores.map(store => (
                <View key={store.id} style={styles.storeItem}>
                  {editingStoreId === store.id ? (
                    // Edit mode
                    <>
                      <TextInput
                        style={[styles.input, styles.editInput]}
                        value={editingStoreName}
                        onChangeText={setEditingStoreName}
                        onSubmitEditing={handleUpdateStore}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={handleUpdateStore}
                      >
                        <Text style={styles.iconButtonText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={cancelEditingStore}
                      >
                        <Text style={styles.iconButtonText}>✕</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    // View mode
                    <>
                      <Text style={styles.storeName}>{store.name}</Text>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => startEditingStore(store)}
                      >
                        <Text style={styles.editIcon}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleDeleteStore(store.id, store.name)}
                      >
                        <Text style={styles.deleteIcon}>✕</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {/* Search Ingredients */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search ingredients..."
                placeholderTextColor={colors.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchIngredients}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleSearchIngredients}
              >
                {searchLoading ? (
                  <ActivityIndicator size="small" color={colors.background.card} />
                ) : (
                  <Text style={styles.searchButtonText}>🔍</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Instructions */}
            {stores.length === 0 ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Add some stores first to set preferences
                </Text>
              </View>
            ) : (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Search for ingredients to set store and frequency preferences
                </Text>
              </View>
            )}

            {/* Ingredients List */}
            {ingredients.map(ingredient => (
              <View key={ingredient.id} style={styles.ingredientItem}>
                <Text style={styles.ingredientName}>
                  {ingredient.plural_name || ingredient.name}
                </Text>
                <Text style={styles.ingredientFamily}>{ingredient.family}</Text>

                {/* Store Picker */}
                <View style={styles.pickerRow}>
                  <Text style={styles.pickerLabel}>Store:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.pickerScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.pickerOption,
                        !ingredient.preferred_store_id &&
                          styles.pickerOptionActive,
                      ]}
                      onPress={() =>
                        handleSetIngredientStore(ingredient.id, null)
                      }
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          !ingredient.preferred_store_id &&
                            styles.pickerOptionTextActive,
                        ]}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                    {stores.map(store => (
                      <TouchableOpacity
                        key={store.id}
                        style={[
                          styles.pickerOption,
                          ingredient.preferred_store_id === store.id &&
                            styles.pickerOptionActive,
                        ]}
                        onPress={() =>
                          handleSetIngredientStore(ingredient.id, store.id)
                        }
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            ingredient.preferred_store_id === store.id &&
                              styles.pickerOptionTextActive,
                          ]}
                        >
                          {store.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Frequency Picker */}
                <View style={styles.pickerRow}>
                  <Text style={styles.pickerLabel}>Frequency:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.pickerScroll}
                  >
                    {FREQUENCY_OPTIONS.map(option => (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          styles.pickerOption,
                          ingredient.purchase_frequency === option.value &&
                            styles.pickerOptionActive,
                        ]}
                        onPress={() =>
                          handleSetIngredientFrequency(
                            ingredient.id,
                            option.value
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            ingredient.purchase_frequency === option.value &&
                              styles.pickerOptionTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
