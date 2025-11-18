// ============================================
// FRIGO - GROCERY LIST ITEM (NEW ARCHITECTURE)
// ============================================
// Individual grocery list item - simple single-line design
// Location: components/GroceryListItem.tsx
// Updated: November 6, 2025 - No multi-tag system

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors, typography, spacing } from '../lib/theme';
import { updateListItem, deleteListItem } from '../lib/groceryListsService';

interface Props {
  item: any;
  onUpdate: () => void;
  navigation: any;
}

export default function GroceryListItem({ item, onUpdate, navigation }: Props) {
  const [updating, setUpdating] = useState(false);

  const ingredientName = item.ingredient.plural_name || item.ingredient.name;
  
  // Build display string with brand/size if present
  const getDisplayText = () => {
    let text = `${item.quantity_display} ${item.unit_display}`;
    if (item.brand_preference) {
      text += ` (${item.brand_preference})`;
    }
    if (item.size_preference) {
      text += ` - ${item.size_preference}`;
    }
    return text;
  };

  // ============================================
  // ACTIONS
  // ============================================

  async function toggleChecked() {
    if (updating) return;
    
    try {
      setUpdating(true);
      // FIXED: Use is_in_cart (snake_case) not isInCart (camelCase)
      await updateListItem(item.id, {
        is_in_cart: !item.is_in_cart,
      });
      onUpdate();
    } catch (error) {
      console.error('Error toggling checked:', error);
      Alert.alert('Error', 'Failed to update item');
    } finally {
      setUpdating(false);
    }
  }

  async function deleteItem() {
    Alert.alert(
      'Delete Item',
      `Remove ${ingredientName} from list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteListItem(item.id);
              onUpdate();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <View style={[styles.container, item.is_in_cart && styles.containerChecked]}>
      <View style={styles.mainRow}>
        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkbox}
          onPress={toggleChecked}
          disabled={updating}
        >
          <View
            style={[
              styles.checkboxInner,
              item.is_in_cart && styles.checkboxChecked,
            ]}
          >
            {item.is_in_cart && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.name,
                item.is_in_cart && styles.nameChecked,
              ]}
              numberOfLines={1}
            >
              {ingredientName}
            </Text>
            <Text style={styles.quantity}>
              {getDisplayText()}
            </Text>
          </View>
          
          {/* Notes on second line if present */}
          {item.notes && (
            <Text style={styles.notes} numberOfLines={1}>
              {item.notes}
            </Text>
          )}
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={deleteItem}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteIcon}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  containerChecked: {
    backgroundColor: '#f8f8f8',
    opacity: 0.7,
  },

  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  
  checkbox: {
    flexShrink: 0,
  },
  checkboxInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.text.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: typography.weights.bold,
  },

  content: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    flex: 1,
  },
  nameChecked: {
    color: colors.text.secondary,
    textDecorationLine: 'line-through',
  },
  quantity: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    flexShrink: 0,
  },
  notes: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },

  deleteButton: {
    padding: 4,
    flexShrink: 0,
  },
  deleteIcon: {
    fontSize: 24,
    color: colors.text.secondary,
    fontWeight: typography.weights.regular,
  },
});