// ============================================
// FRIGO - PANTRY ITEM ROW COMPONENT (UPDATED)
// ============================================
// Single-line pantry item with smart tappable zones + stock badges + quick-add to grocery
// Location: components/PantryItemRow.tsx

import { useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { PantryItemWithIngredient } from '../lib/types/pantry';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { formatQuantityDisplay, formatExpirationShort, isExpiringSoon } from '../utils/pantryHelpers';

interface Props {
  item: PantryItemWithIngredient;
  onTapQuantity: (item: PantryItemWithIngredient) => void;
  onTapStorage: (item: PantryItemWithIngredient) => void;
  onTapExpiration: (item: PantryItemWithIngredient) => void;
  onTapRecipes: (item: PantryItemWithIngredient) => void;
  onTapItem: (item: PantryItemWithIngredient) => void;
  onQuickAddToGrocery?: (item: PantryItemWithIngredient) => void; // NEW
  lowStockThreshold?: number; // NEW
  criticalStockThreshold?: number; // NEW
  isExpiring?: boolean;
  compact?: boolean;
}

type StockStatus = 'out' | 'critical' | 'low' | 'good';

export default function PantryItemRow({
  item,
  onTapQuantity,
  onTapStorage,
  onTapExpiration,
  onTapRecipes,
  onTapItem,
  onQuickAddToGrocery,
  lowStockThreshold = 2,
  criticalStockThreshold = 0,
  isExpiring = false,
  compact = false,
}: Props) {
  const { colors, functionalColors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.md,
      marginBottom: 4,
      ...shadows.small,
    },
    containerExpiring: {
      borderWidth: 2,
      borderColor: functionalColors.warning,
      backgroundColor: functionalColors.warning + '15',
    },
    containerLowStock: {
      borderWidth: 1,
      borderColor: functionalColors.warning,
      backgroundColor: functionalColors.warning + '15',
    },
    mainTouchable: {
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    nameSection: {
      flex: 1,
      minWidth: 100,
    },
    name: {
      fontSize: 15,
      fontWeight: typography.weights.medium,
      color: colors.text.primary,
      marginBottom: 2,
    },
    stockBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 2,
    },
    stockBadgeText: {
      fontSize: 11,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    detailsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    tapZone: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.sm,
      minWidth: 40,
      alignItems: 'center',
    },
    tapZoneLowStock: {
      backgroundColor: functionalColors.warning + '20',
    },
    detailValue: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    detailValueLowStock: {
      color: functionalColors.warning,
      fontWeight: typography.weights.bold,
    },
    detailValueWarning: {
      color: functionalColors.warning,
      fontWeight: typography.weights.semibold,
    },
    separator: {
      fontSize: typography.sizes.sm,
      color: colors.text.quaternary,
      fontWeight: typography.weights.regular,
    },
    recipesButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.sm,
    },
    recipesIcon: {
      fontSize: typography.sizes.md,
    },
    quickAddButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: functionalColors.warning,
      borderRadius: borderRadius.sm,
    },
    quickAddIcon: {
      fontSize: 14,
      fontWeight: typography.weights.bold,
    },
  }), [colors, functionalColors]);

  const quantityDisplay = formatQuantityDisplay(item.quantity_display, item.unit_display);
  const expirationDisplay = formatExpirationShort(item.expiration_date);
  const storageDisplay = item.storage_location.charAt(0).toUpperCase() + 
                        item.storage_location.slice(1);
  
  const isExpiringSoonItem = isExpiringSoon(item.expiration_date);

  // NEW: Stock status calculation
  const getStockStatus = (): StockStatus => {
    const qty = item.quantity_display;
    if (qty === 0) return 'out';
    if (qty <= criticalStockThreshold) return 'critical';
    if (qty <= lowStockThreshold) return 'low';
    return 'good';
  };

  const stockStatus = getStockStatus();
  const showStockBadge = stockStatus !== 'good';
  const showQuickAddButton = showStockBadge && onQuickAddToGrocery;

  const getStockBadge = () => {
    switch (stockStatus) {
      case 'out':
        return { emoji: '🚫', label: 'Out', color: functionalColors.error };
      case 'critical':
        return { emoji: '⚠️', label: 'Critical', color: functionalColors.warning };
      case 'low':
        return { emoji: '📉', label: 'Low', color: functionalColors.warning };
      default:
        return null;
    }
  };

  const badge = getStockBadge();
  
  return (
    <View style={[
      styles.container,
      isExpiring && styles.containerExpiring,
      showStockBadge && styles.containerLowStock,
    ]}>
      <TouchableOpacity
        style={styles.mainTouchable}
        onPress={() => onTapItem(item)}
        activeOpacity={0.7}
      >
        <View style={styles.content}>
          {/* Item Name + Stock Badge */}
          <View style={styles.nameSection}>
            <Text style={styles.name} numberOfLines={1}>
              {item.ingredient.name}
            </Text>
            {badge && (
              <View style={[styles.stockBadge, { backgroundColor: badge.color + '20' }]}>
                <Text style={styles.stockBadgeText}>
                  {badge.emoji} {badge.label}
                </Text>
              </View>
            )}
          </View>

          {/* Tappable Zones Row */}
          <View style={styles.detailsRow}>
            {/* [A] Quantity - Tappable */}
            <TouchableOpacity
              style={[
                styles.tapZone,
                showStockBadge && styles.tapZoneLowStock
              ]}
              onPress={() => onTapQuantity(item)}
              activeOpacity={0.6}
            >
              <Text style={[
                styles.detailValue,
                showStockBadge && styles.detailValueLowStock
              ]}>
                {item.quantity_display}
              </Text>
            </TouchableOpacity>

            <Text style={styles.separator}>·</Text>

            {/* [B] Storage - Tappable */}
            <TouchableOpacity
              style={styles.tapZone}
              onPress={() => onTapStorage(item)}
              activeOpacity={0.6}
            >
              <Text style={styles.detailValue}>
                {storageDisplay}
              </Text>
            </TouchableOpacity>

            <Text style={styles.separator}>·</Text>

            {/* [C] Expiration - Tappable */}
            {item.expiration_date && (
              <TouchableOpacity
                style={styles.tapZone}
                onPress={() => onTapExpiration(item)}
                activeOpacity={0.6}
              >
                <Text style={[
                  styles.detailValue,
                  isExpiringSoonItem && styles.detailValueWarning
                ]}>
                  {expirationDisplay}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Add Button OR Recipes Icon */}
          {showQuickAddButton ? (
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => onQuickAddToGrocery?.(item)}
              activeOpacity={0.6}
            >
              <Text style={styles.quickAddIcon}>+ 📝</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.recipesButton}
              onPress={() => onTapRecipes(item)}
              activeOpacity={0.6}
            >
              <Text style={styles.recipesIcon}>🔍</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}