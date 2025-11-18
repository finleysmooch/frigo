// ============================================
// FRIGO - GROCERY LIST DETAIL SCREEN (WITH CART ICON)
// ============================================
// Shows items in a specific grocery list with improved UX
// Location: screens/GroceryListDetailScreen.tsx
// Updated: November 7, 2025 - Added cart icon

import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../lib/theme';
import {
  getItemsForList,
  deleteItemFromList,
  toggleItemInCart,
  updateListItem,
  GroceryListItem,
} from '../lib/groceryListsService';
import { addPantryItem } from '../lib/pantryService';
import { supabase as supabaseClient } from '../lib/supabase';

// Define the route params type
export type GroceryStackParamList = {
  GroceryLists: undefined;
  GroceryListDetail: {
    listId: string;
    listName: string;
  };
  RegularItems: undefined;
};

type Props = NativeStackScreenProps<GroceryStackParamList, 'GroceryListDetail'>;

export default function GroceryListDetailScreen({ route, navigation }: Props) {
  // Extract params with proper typing
  const { listId, listName } = route.params;

  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadItems();
    }
  }, [currentUserId, listId]);

  // ============================================
  // DATA LOADING
  // ============================================

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('Error getting user:', error);
    }
  };

  const loadItems = async () => {
    try {
      const itemsData = await getItemsForList(listId);
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', 'Failed to load items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadItems();
  }, [listId]);

  // ============================================
  // GROUPING
  // ============================================

  const groupedItems = items.reduce((acc, item) => {
    if (!item.ingredient) return acc;
    
    const family = item.ingredient.family;
    if (!acc[family]) {
      acc[family] = { unchecked: [], checked: [] };
    }
    if (item.is_in_cart) {
      acc[family].checked.push(item);
    } else {
      acc[family].unchecked.push(item);
    }
    return acc;
  }, {} as Record<string, { unchecked: GroceryListItem[]; checked: GroceryListItem[] }>);

  const families = Object.keys(groupedItems).sort((a, b) => {
    const aItems = groupedItems[a];
    const bItems = groupedItems[b];
    
    const aAllChecked = aItems.unchecked.length === 0 && aItems.checked.length > 0;
    const bAllChecked = bItems.unchecked.length === 0 && bItems.checked.length > 0;
    
    // If both are complete or both incomplete, sort alphabetically
    if (aAllChecked === bAllChecked) {
      return a.localeCompare(b);
    }
    
    // Otherwise, incomplete sections come first
    return aAllChecked ? 1 : -1;
  });

  // ============================================
  // STATS
  // ============================================

  const uncheckedCount = items.filter(item => !item.is_in_cart).length;
  const checkedCount = items.filter(item => item.is_in_cart).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  // ============================================
  // ITEM ACTIONS
  // ============================================

  const handleToggleItem = async (itemId: string, currentState: boolean) => {
    try {
      await toggleItemInCart(itemId, !currentState);
      await loadItems();
    } catch (error) {
      console.error('Error toggling item:', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItemFromList(itemId);
      await loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleAdjustQuantity = async (itemId: string, currentQty: number, delta: number) => {
    const newQty = Math.max(0.25, currentQty + delta);
    try {
      await updateListItem(itemId, { quantity_display: newQty });
      await loadItems();
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const toggleSection = (family: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [family]: !prev[family],
    }));
  };

  const handleAddItem = () => {
    Alert.alert(
      'Add Item',
      'Adding items to specific lists coming soon! For now, use the main Grocery screen.',
      [{ text: 'OK' }]
    );
  };

  const handleMoveToPantry = async () => {
    const checkedItems = items.filter(item => item.is_in_cart);
    
    if (checkedItems.length === 0) {
      return;
    }

    Alert.alert(
      'Move to Pantry',
      `Move ${checkedItems.length} item${checkedItems.length !== 1 ? 's' : ''} to your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: async () => {
            try {
              let successCount = 0;
              let failCount = 0;

              for (const item of checkedItems) {
                try {
                  if (!item.ingredient?.id) {
                    failCount++;
                    continue;
                  }

                  // Get ingredient details for pantry storage
                  const { data: ingredient, error: ingError } = await supabaseClient
                    .from('ingredients')
                    .select('default_storage_location, shelf_life_days_fridge, shelf_life_days_pantry')
                    .eq('id', item.ingredient.id)
                    .single();

                  if (ingError) {
                    console.error('Error fetching ingredient:', ingError);
                    failCount++;
                    continue;
                  }

                  // Add to pantry
                  await addPantryItem(
                    {
                      ingredient_id: item.ingredient.id,
                      quantity_display: item.quantity_display,
                      unit_display: item.unit_display,
                      storage_location: ingredient?.default_storage_location || 'pantry',
                      purchase_date: new Date().toISOString().split('T')[0],
                      notes: item.notes || undefined,
                    },
                    currentUserId!
                  );

                  // Delete from grocery list
                  await deleteItemFromList(item.id);
                  successCount++;
                } catch (error) {
                  console.error(`Failed to move ${item.ingredient?.name}:`, error);
                  failCount++;
                }
              }

              // Reload the list
              await loadItems();

              // Show result
              if (failCount === 0) {
                Alert.alert(
                  'Success!',
                  `Moved ${successCount} item${successCount !== 1 ? 's' : ''} to your pantry`
                );
              } else {
                Alert.alert(
                  'Partial Success',
                  `Moved ${successCount} item${successCount !== 1 ? 's' : ''}. ${failCount} failed.`
                );
              }
            } catch (error) {
              console.error('Error moving to pantry:', error);
              Alert.alert('Error', 'Failed to move items to pantry');
            }
          },
        },
      ]
    );
  };

  // ============================================
  // RENDER ITEM
  // ============================================

  const renderItem = (item: GroceryListItem) => {
    if (!item.ingredient) return null;

    return (
      <View
        key={item.id}
        style={[
          styles.itemRow,
          item.is_in_cart && styles.itemRowChecked,
        ]}
      >
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => handleToggleItem(item.id, item.is_in_cart)}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Text style={item.is_in_cart ? styles.checkboxFilled : styles.checkboxEmpty}>
            {item.is_in_cart ? '✓' : '○'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.itemInfo}
          onPress={() => handleToggleItem(item.id, item.is_in_cart)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.itemText,
              item.is_in_cart && styles.itemTextChecked,
            ]}
            numberOfLines={1}
          >
            {item.ingredient.name} · <Text style={styles.itemQuantity}>{item.quantity_display} {item.unit_display}</Text>
          </Text>
        </TouchableOpacity>

        {!item.is_in_cart && (
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleAdjustQuantity(item.id, item.quantity_display, -0.5)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleAdjustQuantity(item.id, item.quantity_display, 0.5)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          onPress={() => handleDeleteItem(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteButton}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading {listName}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>{listName}</Text>
          
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Bar WITH CART ICON */}
        <View style={styles.progressContainer}>
          <Text style={styles.cartIcon}>🛒</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progressPercent}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {checkedCount} / {totalCount}
          </Text>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.addItemButton}
            onPress={handleAddItem}
          >
            <Text style={styles.addItemButtonText}>+ Add to List</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toPantryButton,
              checkedCount === 0 && styles.toPantryButtonDisabled
            ]}
            onPress={handleMoveToPantry}
            disabled={checkedCount === 0}
          >
            <Text style={[
              styles.toPantryButtonText,
              checkedCount === 0 && styles.toPantryButtonTextDisabled
            ]}>
              Place in Pantry ({checkedCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>No Items Yet</Text>
            <Text style={styles.emptyText}>
              Add items to your {listName} list
            </Text>
          </View>
        ) : (
          <>
            {families.map((family) => {
              const familyItems = groupedItems[family];
              const isCollapsed = collapsedSections[family];
              const checkedInFamily = familyItems.checked.length;
              const totalInFamily = familyItems.unchecked.length + familyItems.checked.length;

              return (
                <View key={family} style={styles.familySection}>
                  <TouchableOpacity
                    style={styles.familyHeader}
                    onPress={() => toggleSection(family)}
                  >
                    <Text style={styles.familyHeaderText}>
                      {isCollapsed ? '▶' : '▼'} {family}
                    </Text>
                    <Text style={styles.familyCount}>
                      {checkedInFamily}/{totalInFamily}
                    </Text>
                  </TouchableOpacity>

                  {!isCollapsed && (
                    <View style={styles.familyItems}>
                      {familyItems.unchecked.map(renderItem)}
                      {familyItems.checked.map(renderItem)}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.sizes.lg,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  title: {
    fontSize: typography.sizes.xl,
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,  // Add margin to help centering
  },
  headerSpacer: {
    width: 70,  // Increased to better match back button width
  },

  // Progress bar with cart icon
  progressContainer: {
    paddingLeft: spacing.lg,
    paddingRight: 0,  // No right padding (push all the way)
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cartIcon: {
    fontSize: 20,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
    minWidth: 50,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
  },
  addItemButton: {
    flex: 1,
    maxWidth: 160,  // Equal max width for both buttons
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  toPantryButton: {
    flex: 1,
    maxWidth: 160,  // Equal max width for both buttons
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toPantryButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  toPantryButtonText: {
    fontSize: typography.sizes.sm,
    color: '#fff',
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  toPantryButtonTextDisabled: {
    color: '#999',
  },

  scrollView: {
    flex: 1,
  },
  familySection: {
    marginBottom: spacing.sm,
  },
  familyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  familyHeaderText: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  familyCount: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 48,
    textAlign: 'center',
    fontWeight: typography.weights.medium,
  },
  familyItems: {
    backgroundColor: '#fff',
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,  // Reduced from md
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemRowChecked: {
    opacity: 0.5,
  },
  checkbox: {
    marginRight: spacing.sm,  // Reduced from md
    width: 28,  // Reduced from 32
    height: 28,  // Reduced from 32
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxEmpty: {
    fontSize: 24,  // Reduced from 28
    color: colors.text.tertiary,
  },
  checkboxFilled: {
    fontSize: 24,  // Reduced from 28
    color: colors.success,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
    paddingVertical: spacing.xs,  // Reduced from sm
  },
  itemText: {
    fontSize: typography.sizes.sm,  // Reduced from md
    color: colors.text.primary,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: colors.text.tertiary,
  },
  itemQuantity: {
    color: '#666',  // Dark grey for quantities
  },

  quantityControls: {
    flexDirection: 'row',
    marginRight: spacing.sm,
  },
  quantityButton: {
    width: 30,  // Reduced from 36
    height: 30,  // Reduced from 36
    borderRadius: 15,  // Reduced from 18
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  quantityButtonText: {
    fontSize: 18,  // Reduced from 20
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  deleteButton: {
    fontSize: 20,  // Reduced from 24
    color: colors.error,
    paddingHorizontal: spacing.sm,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontWeight: typography.weights.bold,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});