// ============================================
// FRIGO - QUICK ADD SECTION COMPONENT
// ============================================
// Horizontal scroll cards for quickly adding regular/frequent items
// Location: components/QuickAddSection.tsx
// Created: November 4, 2025
// @ts-nocheck
// TODO: Fix grocery service imports later

// ... rest of file

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors, typography, spacing } from '../lib/theme';
import {
  getQuickAddSuggestions,
  addGroceryItem,
} from '../lib/groceryService';
import {
  RegularGroceryItemWithIngredient,
  QuickAddSuggestions,
} from '../lib/types/grocery';

interface Props {
  userId: string;
  onAdd: () => void;
}

export default function QuickAddSection({ userId, onAdd }: Props) {
  // ============================================
  // STATE
  // ============================================
  
  const [suggestions, setSuggestions] = useState<QuickAddSuggestions>({
    dueSoon: [],
    frequent: [],
    recent: [],
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ============================================
  // LIFECYCLE
  // ============================================
  
  useEffect(() => {
    loadSuggestions();
  }, []);

  async function loadSuggestions() {
    try {
      const data = await getQuickAddSuggestions(userId);
      setSuggestions(data);
    } catch (error) {
      console.error('Error loading Quick Add suggestions:', error);
    }
  }

  // ============================================
  // ACTIONS
  // ============================================
  
  function toggleSelection(itemId: string) {
    const newSelected = new Set(selected);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelected(newSelected);
  }

  async function handleAddSelected() {
    if (selected.size === 0) return;

    setLoading(true);
    try {
      const allItems = [...suggestions.dueSoon, ...suggestions.frequent];
      const itemsToAdd = allItems.filter(item => selected.has(item.id));

      for (const item of itemsToAdd) {
        await addGroceryItem({
          user_id: userId,
          ingredient_id: item.ingredient_id,
          quantity_display: item.quantity_display,
          unit_display: item.unit_display,
          added_from: 'regular',
        });
      }

      // Clear selection and reload
      setSelected(new Set());
      Alert.alert('Success', `Added ${itemsToAdd.length} items to grocery list`);
      onAdd();
      
      // Reload suggestions
      await loadSuggestions();
    } catch (error) {
      console.error('Error adding items:', error);
      Alert.alert('Error', 'Failed to add items to grocery list');
    } finally {
      setLoading(false);
    }
  }

  function selectAllDueSoon() {
    const newSelected = new Set(selected);
    suggestions.dueSoon.forEach(item => newSelected.add(item.id));
    setSelected(newSelected);
  }

  function selectAllFrequent() {
    const newSelected = new Set(selected);
    suggestions.frequent.forEach(item => newSelected.add(item.id));
    setSelected(newSelected);
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ============================================
  // RENDER HELPERS
  // ============================================
  
  function getUrgencyBadge(item: RegularGroceryItemWithIngredient): string | null {
    if (!item.next_suggested_date) return null;
    
    const today = new Date();
    const dueDate = new Date(item.next_suggested_date);
    const daysUntil = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return '🔴 Overdue';
    if (daysUntil === 0) return '⏰ Today';
    if (daysUntil <= 2) return `⏰ ${daysUntil}d`;
    return null;
  }

  function getIngredientEmoji(name: string): string {
    // Simple emoji mapping - expand as needed
    const emojiMap: Record<string, string> = {
      'milk': '🥛',
      'eggs': '🥚',
      'bread': '🍞',
      'butter': '🧈',
      'cheese': '🧀',
      'chicken': '🍗',
      'beef': '🥩',
      'fish': '🐟',
      'salmon': '🐟',
      'shrimp': '🦐',
      'tomato': '🍅',
      'onion': '🧅',
      'garlic': '🧄',
      'carrot': '🥕',
      'potato': '🥔',
      'lettuce': '🥬',
      'spinach': '🥬',
      'apple': '🍎',
      'banana': '🍌',
      'orange': '🍊',
      'lemon': '🍋',
      'rice': '🍚',
      'pasta': '🍝',
      'oil': '🫒',
    };

    const nameLower = name.toLowerCase();
    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (nameLower.includes(key)) return emoji;
    }
    return '📦';
  }

  // ============================================
  // RENDER
  // ============================================
  
  const hasSuggestions = suggestions.dueSoon.length > 0 || suggestions.frequent.length > 0;
  
  if (!hasSuggestions) {
    return null; // Don't show section if no suggestions
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => setCollapsed(!collapsed)}
        >
          <Text style={styles.headerTitle}>
            ➕ QUICK ADD
          </Text>
          <Text style={styles.headerCount}>
            ({suggestions.dueSoon.length + suggestions.frequent.length} items)
          </Text>
          <Text style={styles.collapseIcon}>
            {collapsed ? '+' : '−'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {/* TODO: Navigate to Regular Items screen */}}
        >
          <Text style={styles.editButton}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Collapsed Preview */}
      {collapsed && (
        <View style={styles.collapsedPreview}>
          {[...suggestions.dueSoon.slice(0, 5), ...suggestions.frequent.slice(0, 5)]
            .slice(0, 8)
            .map(item => (
              <Text key={item.id} style={styles.previewEmoji}>
                {getIngredientEmoji(item.ingredient.name)}
              </Text>
            ))}
        </View>
      )}

      {/* Expanded Content */}
      {!collapsed && (
        <>
          {/* Due Soon Section */}
          {suggestions.dueSoon.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>
                  DUE SOON ({suggestions.dueSoon.length})
                </Text>
                <TouchableOpacity onPress={selectAllDueSoon}>
                  <Text style={styles.selectAllButton}>Select All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardsContainer}
              >
                {suggestions.dueSoon.map(item => {
                  const isSelected = selected.has(item.id);
                  const badge = getUrgencyBadge(item);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.card,
                        isSelected && styles.cardSelected,
                      ]}
                      onPress={() => toggleSelection(item.id)}
                    >
                      {badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{badge}</Text>
                        </View>
                      )}

                      <Text style={styles.cardEmoji}>
                        {getIngredientEmoji(item.ingredient.name)}
                      </Text>
                      <Text style={styles.cardName} numberOfLines={2}>
                        {item.ingredient.name}
                      </Text>
                      <Text style={styles.cardQuantity}>
                        {item.quantity_display} {item.unit_display}
                      </Text>
                      
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Frequent Section */}
          {suggestions.frequent.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>
                  FREQUENT ({suggestions.frequent.length})
                </Text>
                <TouchableOpacity onPress={selectAllFrequent}>
                  <Text style={styles.selectAllButton}>Select All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardsContainer}
              >
                {suggestions.frequent.map(item => {
                  const isSelected = selected.has(item.id);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.card,
                        isSelected && styles.cardSelected,
                      ]}
                      onPress={() => toggleSelection(item.id)}
                    >
                      <Text style={styles.cardEmoji}>
                        {getIngredientEmoji(item.ingredient.name)}
                      </Text>
                      <Text style={styles.cardName} numberOfLines={2}>
                        {item.ingredient.name}
                      </Text>
                      <Text style={styles.cardQuantity}>
                        {item.quantity_display} {item.unit_display}
                      </Text>
                      
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Action Buttons */}
          {selected.size > 0 && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearSelection}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddSelected}
                disabled={loading}
              >
                <Text style={styles.addButtonText}>
                  {loading ? 'Adding...' : `🛒 Add ${selected.size} items`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  headerCount: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  collapseIcon: {
    fontSize: 18,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
  editButton: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },

  // Collapsed Preview
  collapsedPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  previewEmoji: {
    fontSize: 24,
  },

  // Section
  section: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  selectAllButton: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },

  // Cards
  cardsContainer: {
    paddingRight: spacing.md,
  },
  card: {
    width: 100,
    padding: spacing.md,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginRight: spacing.sm,
    alignItems: 'center',
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
  },
  cardEmoji: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },
  cardName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 2,
    height: 28, // Fixed height for 2 lines
  },
  cardQuantity: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d0d0d0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  clearButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.text.tertiary,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  addButton: {
    flex: 2,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: typography.sizes.md,
    color: '#fff',
    fontWeight: typography.weights.bold,
  },
});