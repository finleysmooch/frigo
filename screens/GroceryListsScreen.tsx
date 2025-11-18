// ============================================
// FRIGO - GROCERY LISTS SCREEN (WITH CART ICON)
// ============================================
// Shows all grocery lists with cart icon and smaller new button
// Location: screens/GroceryListsScreen.tsx
// Updated: November 7, 2025

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
  TextInput,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../lib/theme';
import { 
  getUserGroceryLists, 
  createGroceryList,
  deleteGroceryList,
  getListItemCount 
} from '../lib/groceryListsService';

type Props = NativeStackScreenProps<any, 'GroceryLists'>;

interface GroceryList {
  id: string;
  name: string;
  store_name?: string;
  item_count?: number;
}

export default function GroceryListsScreen({ navigation }: Props) {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadLists();
    }
  }, [currentUserId]);

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

  const loadLists = async () => {
    if (!currentUserId) return;

    try {
      const userLists = await getUserGroceryLists(currentUserId);
      
      // Get item counts for each list
      const listsWithCounts = await Promise.all(
        userLists.map(async (list) => {
          const count = await getListItemCount(list.id);
          return { ...list, item_count: count };
        })
      );

      setLists(listsWithCounts);
    } catch (error) {
      console.error('Error loading lists:', error);
      Alert.alert('Error', 'Failed to load grocery lists');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLists();
  }, [currentUserId]);

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Error', 'Please log in to create a list');
      return;
    }

    try {
      await createGroceryList({
        user_id: currentUserId,
        name: newListName.trim(),
        store_name: newStoreName.trim() || undefined,
      });
      
      setShowAddModal(false);
      setNewListName('');
      setNewStoreName('');
      loadLists();
    } catch (error) {
      console.error('Error creating list:', error);
      Alert.alert('Error', 'Failed to create list');
    }
  };

  const handleDeleteList = (listId: string, listName: string) => {
    Alert.alert(
      'Delete List',
      `Are you sure you want to delete "${listName}"? This will also delete all items in this list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroceryList(listId);
              loadLists();
            } catch (error) {
              console.error('Error deleting list:', error);
              Alert.alert('Error', 'Failed to delete list');
            }
          },
        },
      ]
    );
  };

  const handleListPress = (list: GroceryList) => {
    navigation.navigate('GroceryListDetail', {
      listId: list.id,
      listName: list.name,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading lists...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header WITH CART ICON */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.cartIcon}>🛒</Text>
            <Text style={styles.title}>My Grocery Lists</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.addButtonText}>+ New List</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {lists.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>No Lists Yet</Text>
              <Text style={styles.emptyText}>
                Create your first grocery list to get started!
              </Text>
              <TouchableOpacity
                style={styles.createFirstButton}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.createFirstButtonText}>Create List</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listsContainer}>
              {lists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={styles.listCard}
                  onPress={() => handleListPress(list)}
                  onLongPress={() => handleDeleteList(list.id, list.name)}
                >
                  <View style={styles.listHeader}>
                    <Text style={styles.listName}>{list.name}</Text>
                    {list.store_name && (
                      <Text style={styles.storeBadge}>🏪 {list.store_name}</Text>
                    )}
                  </View>
                  <View style={styles.listFooter}>
                    <Text style={styles.itemCount}>
                      {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
                    </Text>
                    <Text style={styles.arrow}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Add List Modal */}
        {showAddModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New List</Text>
              
              <TextInput
                style={styles.input}
                placeholder="List name (e.g., Costco, Fred Meyer)"
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
              />
              
              <TextInput
                style={styles.input}
                placeholder="Store name (optional)"
                value={newStoreName}
                onChangeText={setNewStoreName}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowAddModal(false);
                    setNewListName('');
                    setNewStoreName('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleCreateList}
                >
                  <Text style={styles.createButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
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
  
  // Header with cart icon
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cartIcon: {
    fontSize: 24,
  },
  title: {
    fontSize: typography.sizes.xl,
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
  },
  // REDUCED BY 35%: was paddingHorizontal: 20, paddingVertical: 10, fontSize: 16
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 13, // 65% of 20
    paddingVertical: 6.5,   // 65% of 10
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 10.4,  // 65% of 16
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },

  scrollView: {
    flex: 1,
  },
  listsContainer: {
    padding: spacing.lg,
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  listName: {
    fontSize: typography.sizes.lg,
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
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
  listFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  arrow: {
    fontSize: typography.sizes.xxl,
    color: colors.text.tertiary,
  },

  // Empty state
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
    marginBottom: spacing.lg,
  },
  createFirstButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 10,
  },
  createFirstButtonText: {
    fontSize: typography.sizes.md,
    color: '#fff',
    fontWeight: typography.weights.bold,
  },

  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    fontSize: typography.sizes.md,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    fontWeight: typography.weights.semibold,
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  createButtonText: {
    fontSize: typography.sizes.md,
    color: '#fff',
    fontWeight: typography.weights.bold,
  },
});