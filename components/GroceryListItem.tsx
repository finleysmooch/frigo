// ============================================
// FRIGO - GROCERY LIST ITEM (TIER-AWARE PRESENTATIONAL ROW)
// ============================================
// Phase 8C-CP1: pure presentational row used inside the 3-tier grocery list.
// Phase 8C-CP3: pill-aware. Compact mode renders staple pill (when applicable).
// Detailed mode also renders recipe pill ([Lasagna] or [N recipes]) which is
// tappable; tap fires onRecipePillTap so the parent screen can drive
// disambiguation/filter behavior.
// All mutations flow through props (screen owns state and service calls).
// Location: components/GroceryListItem.tsx

import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { typography, spacing } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import { GroceryListItemWithIngredient, GroceryListItemRecipe } from '../lib/types/grocery';

interface GroceryListItemProps {
  item: GroceryListItemWithIngredient;
  viewMode: 'compact' | 'detailed';
  onToggleCart: (itemId: string, currentInCart: boolean) => void;
  onAdjustQuantity: (itemId: string, currentQty: number, delta: number) => void;
  onMoveTier: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onRecipePillTap?: (itemId: string, recipes: GroceryListItemRecipe[]) => void;
}

const STAPLE_PILL_MAX_CHARS = 12;
const RECIPE_PILL_MAX_CHARS = 14;

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function stapleLabelFromReason(reason: string): string {
  // Conservative match: only render when reason mentions a staple. Pull a short
  // label from the second segment if formatted "staple · {label}", else "staple".
  const trimmed = reason.trim();
  const parts = trimmed.split('·').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return truncate(parts[1], STAPLE_PILL_MAX_CHARS);
  }
  return 'staple';
}

export default function GroceryListItem({
  item,
  viewMode,
  onToggleCart,
  onAdjustQuantity,
  onMoveTier,
  onDelete,
  onRecipePillTap,
}: GroceryListItemProps) {
  const { colors, functionalColors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      backgroundColor: colors.background.card,
    },
    rowChecked: {
      opacity: 0.5,
    },
    checkbox: {
      marginRight: spacing.sm,
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxEmpty: {
      fontSize: 24,
      color: colors.text.tertiary,
    },
    checkboxFilled: {
      fontSize: 24,
      color: functionalColors.success,
    },
    info: {
      flex: 1,
      marginRight: spacing.sm,
      paddingVertical: spacing.xs,
    },
    nameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      gap: spacing.xs,
    },
    nameText: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
      flexShrink: 1,
    },
    nameTextChecked: {
      textDecorationLine: 'line-through',
      color: colors.text.tertiary,
    },
    quantity: {
      color: colors.text.secondary,
    },
    pill: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      flexShrink: 0,
    },
    staplePill: {
      backgroundColor:
        (functionalColors as { errorLight?: string }).errorLight || '#FEE2E2',
    },
    staplePillText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium,
      color: functionalColors.error,
    },
    recipePill: {
      backgroundColor:
        (colors as { info?: { light?: string } }).info?.light || '#E6F1FB',
    },
    recipePillText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium,
      color:
        (colors as { info?: { dark?: string } }).info?.dark || '#185FA5',
    },
    quantityControls: {
      flexDirection: 'row',
      marginRight: spacing.sm,
    },
    quantityButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.border.light,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: spacing.xs,
    },
    quantityButtonText: {
      fontSize: 18,
      color: colors.text.primary,
      fontWeight: typography.weights.semibold,
    },
    deleteButton: {
      fontSize: 20,
      color: functionalColors.error,
      paddingHorizontal: spacing.sm,
    },
  }), [colors, functionalColors]);

  // Display name: ingredient (plural preferred) or custom_name fallback.
  const displayName = item.ingredient
    ? (item.ingredient.plural_name || item.ingredient.name)
    : (item.custom_name || '(unnamed item)');

  // Quantity string with optional brand/size annotations.
  let quantityText = `${item.quantity_display} ${item.unit_display}`;
  if (item.brand_preference) {
    quantityText += ` · ${item.brand_preference}`;
  }
  if (item.size_preference) {
    quantityText += ` · ${item.size_preference}`;
  }

  // Staple pill: render whenever priority_reason includes "staple". Always-on
  // (Compact AND Detailed). Replaces the CP1-era subtitle.
  const showStaplePill =
    typeof item.priority_reason === 'string' &&
    item.priority_reason.toLowerCase().includes('staple');
  const staplePillLabel = showStaplePill
    ? stapleLabelFromReason(item.priority_reason as string)
    : null;

  // Recipe pill: only in Detailed mode, only when recipes are populated.
  const recipes = (item.recipes ?? []) as GroceryListItemRecipe[];
  const showRecipePill = viewMode === 'detailed' && recipes.length > 0;
  const recipePillLabel = showRecipePill
    ? recipes.length === 1
      ? truncate(recipes[0].recipe_title || 'recipe', RECIPE_PILL_MAX_CHARS)
      : `${recipes.length} recipes`
    : null;

  return (
    <View style={[styles.row, item.is_in_cart && styles.rowChecked]}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onToggleCart(item.id, item.is_in_cart)}
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_in_cart }}
        accessibilityLabel={item.is_in_cart ? `Uncheck ${displayName}` : `Check ${displayName}`}
      >
        <Text style={item.is_in_cart ? styles.checkboxFilled : styles.checkboxEmpty}>
          {item.is_in_cart ? '✓' : '○'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.info}
        onPress={() => onToggleCart(item.id, item.is_in_cart)}
        onLongPress={() => onMoveTier(item.id)}
        delayLongPress={350}
        activeOpacity={0.7}
        accessibilityLabel={`${displayName}, ${quantityText}${staplePillLabel ? `, staple ${staplePillLabel}` : ''}${recipePillLabel ? `, ${recipePillLabel}` : ''}`}
        accessibilityHint="Long-press to move between Now and Could wait"
      >
        <View style={styles.nameLine}>
          <Text
            style={[styles.nameText, item.is_in_cart && styles.nameTextChecked]}
            numberOfLines={1}
          >
            {displayName} · <Text style={styles.quantity}>{quantityText}</Text>
          </Text>
          {staplePillLabel && (
            <View style={[styles.pill, styles.staplePill]}>
              <Text style={styles.staplePillText} numberOfLines={1}>
                {staplePillLabel}
              </Text>
            </View>
          )}
          {recipePillLabel && (
            <TouchableOpacity
              style={[styles.pill, styles.recipePill]}
              onPress={() => onRecipePillTap?.(item.id, recipes)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={
                recipes.length === 1
                  ? `Filter by recipe ${recipes[0].recipe_title}`
                  : `Choose recipe to filter by, ${recipes.length} options`
              }
            >
              <Text style={styles.recipePillText} numberOfLines={1}>
                {recipePillLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {!item.is_in_cart && (
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => onAdjustQuantity(item.id, item.quantity_display, -0.5)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Decrease quantity of ${displayName}`}
          >
            <Text style={styles.quantityButtonText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => onAdjustQuantity(item.id, item.quantity_display, 0.5)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Increase quantity of ${displayName}`}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`Delete ${displayName}`}
      >
        <Text style={styles.deleteButton}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}
