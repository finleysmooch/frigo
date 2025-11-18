// ============================================
// FRIGO - ADD RECIPE TO LIST MODAL
// ============================================
// Modal for selecting which grocery list to add recipe ingredients to
// Location: components/AddRecipeToListModal.tsx
// Created: November 7, 2025

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { colors, typography, spacing } from '../lib/theme';
import {
  getUserGroceryLists,
  createGroceryList,
  addItemToList,
  GroceryList,
} from '../lib/groceryListsService';

interface Ingredient {
  id: string;
  name: string;
  quantity_amount?: number;
  quantity_unit?: string;
  family: string;
}

interface Recipe {
  id: string;
  title: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  recipe: Recipe;
  ingredients: Ingredient[];
  scale: number;
  userId: string;
}

export default function AddRecipeToListModal({
  visible,
  onClose,
  recipe,
  ingredients,
  scale,
  userId,
}: Props) {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    if (visible) {
      loadLists();
    }
  }, [visible]);

  const loadLists = async () => {
    try {
      setLoading(true);
      const userLists = await getUserGroceryLists(userId);
      setLists(userLists);
      
      // Auto-select first list if exists
      if (userLists.length > 0 && !selectedListId) {
        setSelectedListId(userLists[0].id);
      }
    } catch (error) {
      console.error('Error loading lists:', error);
      Alert.alert('Error', 'Failed to load grocery lists');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewList = async () => {
    if (!newListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }

    try {
      const newList = await createGroceryList({
        user_id: userId,
        name: newListName.trim(),
      });
      
      setLists([...lists, newList]);
      setSelectedListId(newList.id);
      setShowNewListInput(false);
      setNewListName('');
      
      Alert.alert('Success', `Created list "${newList.name}"`);
    } catch (error) {
      console.error('Error creating list:', error);
      Alert.alert('Error', 'Failed to create list');
    }
  };

  const handleAddToList = async () => {
    if (!selectedListId) {
      Alert.alert('Error', 'Please select a list');
      return;
    }

    try {
      setAdding(true);
      
      let addedCount = 0;
      let failedCount = 0;
      const unmatchedItems: string[] = [];

      // Add each ingredient with scaled quantity
      for (const ingredient of ingredients) {
        try {
          // Skip ingredients that don't have valid UUIDs (unmatched ingredients)
          if (!ingredient.id || ingredient.id.startsWith('unmatched-')) {
            console.log(`⚠️ Skipping unmatched ingredient: ${ingredient.name}`);
            unmatchedItems.push(ingredient.name);
            failedCount++;
            continue;
          }

          const scaledQty = ingredient.quantity_amount 
            ? ingredient.quantity_amount * scale 
            : 1;
          
          const unit = ingredient.quantity_unit || 'unit';

          await addItemToList({
            list_id: selectedListId,
            ingredient_id: ingredient.id,
            quantity_display: scaledQty,
            unit_display: unit,
            notes: `From: ${recipe.title}${scale !== 1 ? ` (${scale}x)` : ''}`,
          });
          
          addedCount++;
        } catch (error) {
          console.error(`Failed to add ${ingredient.name}:`, error);
          failedCount++;
        }
      }

      // Build success/failure message
      let message = `Added ${addedCount} ingredient${addedCount !== 1 ? 's' : ''} to your grocery list`;
      
      if (unmatchedItems.length > 0) {
        message += `\n\nCouldn't add (not in database):\n• ${unmatchedItems.join('\n• ')}`;
      }
      
      if (failedCount > unmatchedItems.length) {
        message += `\n\n${failedCount - unmatchedItems.length} other items failed`;
      }

      Alert.alert(
        addedCount > 0 ? 'Success!' : 'No Items Added',
        message,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Error adding to list:', error);
      Alert.alert('Error', 'Failed to add ingredients to list');
    } finally {
      setAdding(false);
    }
  };

  const ingredientCount = ingredients.filter(i => i.quantity_amount).length;

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
            <Text style={styles.headerTitle}>Add to Grocery List</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Recipe Info */}
          <View style={styles.recipeInfo}>
            <Text style={styles.recipeName}>{recipe.title}</Text>
            {scale !== 1 && (
              <Text style={styles.scaleInfo}>Scaled to {scale}x</Text>
            )}
            <Text style={styles.ingredientCount}>
              {ingredientCount} ingredients
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.listsContainer}>
              <Text style={styles.sectionTitle}>Choose List:</Text>

              {lists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={[
                    styles.listOption,
                    selectedListId === list.id && styles.listOptionSelected,
                  ]}
                  onPress={() => setSelectedListId(list.id)}
                >
                  <View style={styles.radioButton}>
                    {selectedListId === list.id && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.listName}>{list.name}</Text>
                  {list.store_name && (
                    <Text style={styles.storeBadge}>{list.store_name}</Text>
                  )}
                </TouchableOpacity>
              ))}

              {/* Create New List */}
              {!showNewListInput ? (
                <TouchableOpacity
                  style={styles.createNewButton}
                  onPress={() => setShowNewListInput(true)}
                >
                  <Text style={styles.createNewButtonText}>+ Create New List</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.newListInput}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter list name..."
                    value={newListName}
                    onChangeText={setNewListName}
                    autoFocus
                  />
                  <View style={styles.newListButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowNewListInput(false);
                        setNewListName('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.createButton}
                      onPress={handleCreateNewList}
                    >
                      <Text style={styles.createButtonText}>Create</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelFooterButton}
              onPress={onClose}
              disabled={adding}
            >
              <Text style={styles.cancelFooterButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, adding && styles.addButtonDisabled]}
              onPress={handleAddToList}
              disabled={adding || !selectedListId}
            >
              {adding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addButtonText}>
                  Add ({ingredientCount})
                </Text>
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
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.text.secondary,
  },
  recipeInfo: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#f9f9f9',
  },
  recipeName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  scaleInfo: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  ingredientCount: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  listsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: spacing.sm,
  },
  listOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  listName: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  storeBadge: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  createNewButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  createNewButtonText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  newListInput: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  textInput: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: typography.sizes.md,
    marginBottom: spacing.sm,
  },
  newListButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  createButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: typography.sizes.md,
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: spacing.md,
  },
  cancelFooterButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelFooterButtonText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    fontWeight: typography.weights.semibold,
  },
  addButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: typography.sizes.md,
    color: '#fff',
    fontWeight: typography.weights.bold,
  },
});