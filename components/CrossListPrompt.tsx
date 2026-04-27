// ============================================
// FRIGO - CROSS-LIST PROMPT (Phase 8C-CP2)
// ============================================
// Top-floating banner shown after a check-on (false → true) when the same
// ingredient still pends on other active lists. Auto-dismisses to "Keep" after
// 5s; tapping Remove deletes the matching pending entries from the other lists.
// Modeled structurally on CookDepletionBanner; lifetime + content differ.
// Location: components/CrossListPrompt.tsx

import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { CrossListIngredientPresence } from '../lib/types/grocery';

const AUTO_DISMISS_MS = 5_000;

interface CrossListPromptProps {
  visible: boolean;
  itemName: string;
  otherLists: CrossListIngredientPresence[];
  onKeep: () => void;
  onRemove: () => void;
  onDismiss: () => void;
}

function formatLists(lists: CrossListIngredientPresence[]): string {
  if (lists.length === 0) return '';
  if (lists.length === 1) return lists[0].list_name;
  if (lists.length === 2) return `${lists[0].list_name}, ${lists[1].list_name}`;
  // 3+ → first 2 + "+ N more"
  const remainder = lists.length - 2;
  return `${lists[0].list_name}, ${lists[1].list_name} + ${remainder} more`;
}

export default function CrossListPrompt({
  visible,
  itemName,
  otherLists,
  onKeep,
  onRemove,
  onDismiss,
}: CrossListPromptProps) {
  const { colors } = useTheme();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss timer — equivalent to tapping Keep. Cleared on unmount, on
  // visibility change, and when Keep/Remove fire (caller closes the prompt
  // via setState which re-runs this effect).
  useEffect(() => {
    if (!visible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          elevation: 1000,
        },
        bar: {
          marginHorizontal: spacing.md,
          marginTop: 64,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: borderRadius.md,
          backgroundColor: colors.background.elevated || colors.background.card,
          borderLeftWidth: 3,
          borderLeftColor: colors.primary,
          ...shadows.small,
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        checkIcon: {
          fontSize: 16,
          color: colors.primary,
          marginRight: 8,
          fontWeight: typography.weights.semibold,
        },
        title: {
          flex: 1,
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.medium,
          color: colors.text.primary,
        },
        subtitle: {
          fontSize: typography.sizes.xs,
          color: colors.text.secondary,
          marginBottom: spacing.sm,
        },
        listName: {
          fontWeight: typography.weights.semibold,
          color: colors.text.primary,
        },
        actionRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: spacing.sm,
        },
        button: {
          minHeight: 44,
          minWidth: 88,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.sm,
          alignItems: 'center',
          justifyContent: 'center',
        },
        keepButton: {
          backgroundColor: colors.primary,
        },
        keepButtonText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.text.inverse,
        },
        removeButton: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.medium,
        },
        removeButtonText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.medium,
          color: colors.text.secondary,
        },
      }),
    [colors]
  );

  if (!visible || otherLists.length === 0) return null;

  const listsLabel = formatLists(otherLists);

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} pointerEvents="box-none">
      <View
        style={styles.bar}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <View style={styles.topRow}>
          <Text style={styles.checkIcon}>✓</Text>
          <Text style={styles.title} numberOfLines={1}>
            {itemName} checked off
          </Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={2}>
          Also on your <Text style={styles.listName}>{listsLabel}</Text> — keep it there?
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.button, styles.removeButton]}
            onPress={onRemove}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${itemName} from ${listsLabel}`}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.keepButton]}
            onPress={onKeep}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Keep ${itemName} on other lists`}
          >
            <Text style={styles.keepButtonText}>Keep</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
