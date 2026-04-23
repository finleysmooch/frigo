// ============================================
// FRIGO - STAPLES GRID (Phase 8B-CP2)
// ============================================
// Top section of PantryScreen: 2-column grid of staples with state cycling,
// "See all · Add new" footer, empty state, optimistic updates + re-sort.
// Location: components/pantry/StaplesGrid.tsx
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PantryStackParamList } from '../../App';
import { PantryStaple, StapleState } from '../../lib/types/pantry';
import {
  getStaplesBySpace,
  PantryStapleWithIngredientName,
  getStapleDisplayName,
} from '../../lib/pantryStaplesService';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../../lib/theme';
import StapleCell from './StapleCell';

type PantryStackNav = NativeStackNavigationProp<PantryStackParamList>;

const MAX_VISIBLE_CELLS = 8;

const STATE_SORT_PRIORITY: Record<StapleState, number> = {
  out: 0,
  running_low: 1,
  good: 2,
  unknown: 3,
};

export interface StaplesGridProps {
  spaceId: string | null;
  // Parent bumps this to signal a reload (e.g., from pull-to-refresh).
  refreshTrigger?: number;
  // Label tap is parent-owned — stubs to Alert.alert until 8C-CP5's Ingredient Detail screen lands.
  onStapleLabelTap: (staple: PantryStaple) => void;
}

export default function StaplesGrid({
  spaceId,
  refreshTrigger = 0,
  onStapleLabelTap,
}: StaplesGridProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<PantryStackNav>();
  const navigateToManage = useCallback(
    () => navigation.navigate('ManageStaples'),
    [navigation]
  );
  const [staples, setStaples] = useState<PantryStapleWithIngredientName[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (sid: string) => {
    try {
      setLoading(true);
      const data = await getStaplesBySpace(sid);
      setStaples(data);
    } catch (error) {
      console.error('❌ StaplesGrid load error:', error);
      setStaples([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (spaceId) load(spaceId);
  }, [spaceId, refreshTrigger, load]);

  const handleCycleComplete = useCallback((updated: PantryStaple) => {
    setStaples((prev) => {
      const updatedList = prev.map((s) =>
        s.id === updated.id
          ? { ...s, ...updated, ingredient_name: s.ingredient_name }
          : s
      );
      return sortStaples(updatedList);
    });
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      paddingBottom: 14,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: 12,
      fontWeight: typography.weights.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.8,
    },
    headerHint: {
      fontSize: 11,
      color: colors.text.tertiary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cellWrap: {
      width: '50%',
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    overflowCell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border.medium,
    },
    overflowText: {
      fontSize: 13,
      fontWeight: typography.weights.medium,
      color: colors.text.secondary,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    footerAction: {
      paddingHorizontal: 6,
      paddingVertical: 4,
    },
    footerActionText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    footerSeparator: {
      fontSize: 13,
      color: colors.text.tertiary,
    },
    empty: {
      padding: 16,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border.medium,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      color: colors.text.secondary,
      marginBottom: 10,
      textAlign: 'center',
    },
    emptyButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
    },
    emptyButtonText: {
      fontSize: 13,
      fontWeight: typography.weights.semibold,
      color: '#ffffff',
    },
  }), [colors]);

  // Empty state: skip header hint since there's nothing to tap yet.
  if (!loading && staples.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>STAPLES</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Track the things you always want to have on hand.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={navigateToManage}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add your first staple"
          >
            <Text style={styles.emptyButtonText}>Add your first staple</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const total = staples.length;
  const hasOverflow = total > MAX_VISIBLE_CELLS;
  const visibleCount = hasOverflow ? MAX_VISIBLE_CELLS - 1 : total;
  const visibleStaples = staples.slice(0, visibleCount);
  const overflowCount = total - visibleCount;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>STAPLES</Text>
        <Text style={styles.headerHint}>tap dot · tap label</Text>
      </View>

      <View style={styles.grid}>
        {visibleStaples.map((staple) => (
          <View key={staple.id} style={styles.cellWrap}>
            <StapleCell
              staple={staple}
              onLabelTap={() => onStapleLabelTap(staple)}
              onCycleComplete={handleCycleComplete}
            />
          </View>
        ))}

        {hasOverflow && (
          <View style={styles.cellWrap}>
            <TouchableOpacity
              style={styles.overflowCell}
              onPress={navigateToManage}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`See all ${total} staples`}
            >
              <Text style={styles.overflowText}>+ {overflowCount} more</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerAction}
          onPress={navigateToManage}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`See all ${total} staples`}
        >
          <Text style={styles.footerActionText}>
            See all {total} {total === 1 ? 'staple' : 'staples'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.footerSeparator}>·</Text>
        <TouchableOpacity
          style={styles.footerAction}
          onPress={navigateToManage}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Add new staple"
        >
          <Text style={styles.footerActionText}>Add new</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Re-sort keeping parity with pantryStaplesService.getStaplesBySpace.
function sortStaples(
  list: PantryStapleWithIngredientName[]
): PantryStapleWithIngredientName[] {
  return [...list].sort((a, b) => {
    const stateDiff = STATE_SORT_PRIORITY[a.state] - STATE_SORT_PRIORITY[b.state];
    if (stateDiff !== 0) return stateDiff;
    const aName = getStapleDisplayName(a).toLowerCase();
    const bName = getStapleDisplayName(b).toLowerCase();
    return aName.localeCompare(bName);
  });
}
