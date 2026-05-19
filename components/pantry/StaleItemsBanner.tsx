// ============================================
// FRIGO — STALE ITEMS BANNER (Phase 8R-CP6d-Pantry, Gap-NEED-5)
// ============================================
// Inline banner above the Attention section. Surfaces track_only supplies
// that haven't been touched in >14 days. Tap-expand reveals each item with
// "Find recipes" and "Toss" quick actions.
//
// Detection lives in suppliesService.getStaleTrackOnlySupplies (uses
// updated_at as freshness signal — see service-side comment).
// Location: components/pantry/StaleItemsBanner.tsx
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getStaleTrackOnlySupplies,
  getSupplyDisplayName,
  setSupplyStatus,
} from '../../lib/services/suppliesService';
import { SupplyWithTags } from '../../lib/types/supplies';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../../lib/theme';

export interface StaleItemsBannerProps {
  spaceId: string | null;
  /**
   * Bumped to refetch — same convention as SuppliesSection.refreshTrigger.
   * Allows the parent to refresh the banner alongside the main list.
   */
  refreshTrigger?: number;
  /**
   * Optional: invoked when the user taps "Find recipes". Until CP6d-SupplyDetail
   * adds initialIngredient routing, callers can leave this unset and the
   * banner falls back to an Alert "Recipes filter coming soon."
   */
  onFindRecipes?: (supply: SupplyWithTags) => void;
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export default function StaleItemsBanner({
  spaceId,
  refreshTrigger = 0,
  onFindRecipes,
}: StaleItemsBannerProps) {
  const { colors, functionalColors } = useTheme();
  const [stale, setStale] = useState<SupplyWithTags[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async (sid: string) => {
    try {
      setLoading(true);
      const data = await getStaleTrackOnlySupplies(sid);
      setStale(data);
    } catch (error) {
      console.error('❌ StaleItemsBanner load error:', error);
      setStale([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (spaceId) load(spaceId);
  }, [spaceId, refreshTrigger, load]);

  const handleToss = async (supply: SupplyWithTags) => {
    // Optimistic remove from local list. setSupplyStatus → out auto-archives
    // (track_only path from CP6d-Schema), so the supply is gone from the
    // pantry surface entirely after success.
    setStale((prev) => prev.filter((s) => s.id !== supply.id));
    try {
      await setSupplyStatus(supply.id, 'out');
    } catch (error) {
      console.error('❌ Error tossing stale supply:', error);
      Alert.alert('Could not toss item', 'Please try again.');
      // Re-load to restore truth.
      if (spaceId) load(spaceId);
    }
  };

  const handleFindRecipes = (supply: SupplyWithTags) => {
    if (onFindRecipes) {
      onFindRecipes(supply);
    } else {
      Alert.alert(
        getSupplyDisplayName(supply),
        'Recipes filter coming soon.'
      );
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
          marginBottom: spacing.xs,
          borderRadius: borderRadius.md,
          backgroundColor: '#FEF3C7',
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        headerText: {
          fontSize: typography.sizes.sm,
          color: '#92400E',
          fontWeight: typography.weights.medium,
          flex: 1,
        },
        chevron: {
          fontSize: 14,
          color: '#92400E',
          marginLeft: 8,
        },
        list: {
          marginTop: 10,
          gap: 8,
        },
        item: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          paddingHorizontal: 10,
          backgroundColor: colors.background.card,
          borderRadius: borderRadius.sm,
        },
        itemLeft: {
          flex: 1,
          minWidth: 0,
          flexShrink: 1,
          paddingRight: 8,
        },
        itemName: {
          fontSize: typography.sizes.sm,
          color: colors.text.primary,
          fontWeight: typography.weights.medium,
        },
        itemMeta: {
          fontSize: 11,
          color: colors.text.tertiary,
          marginTop: 2,
        },
        actions: {
          flexDirection: 'row',
          gap: 6,
          flexShrink: 0,
        },
        actionButton: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: borderRadius.sm,
          borderWidth: 1,
          borderColor: colors.border.medium,
        },
        actionTextNeutral: {
          fontSize: 12,
          color: colors.text.secondary,
          fontWeight: typography.weights.medium,
        },
        actionDestructive: {
          backgroundColor: functionalColors.errorLight,
          borderColor: functionalColors.error,
        },
        actionTextDestructive: {
          fontSize: 12,
          color: functionalColors.error,
          fontWeight: typography.weights.semibold,
        },
        loading: {
          paddingVertical: 6,
        },
      }),
    [colors, functionalColors]
  );

  if (loading && stale.length === 0) {
    return null; // silent on first load — banner appears only when items exist
  }
  if (stale.length === 0) {
    return null;
  }

  const headerLabel =
    stale.length === 1
      ? "🍂 1 item hasn't been used in a while"
      : `🍂 ${stale.length} items haven't been used in a while`;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${headerLabel}. ${expanded ? 'Tap to collapse' : 'Tap to expand'}`}
      >
        <Text style={styles.headerText} numberOfLines={1}>
          {headerLabel}
        </Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.list}>
          {stale.map((supply) => {
            const days = daysSince(supply.updated_at);
            return (
              <View key={supply.id} style={styles.item}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {getSupplyDisplayName(supply)}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {days} {days === 1 ? 'day' : 'days'} since last touch
                  </Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleFindRecipes(supply)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Find recipes for ${getSupplyDisplayName(supply)}`}
                  >
                    <Text style={styles.actionTextNeutral}>Find recipes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionDestructive]}
                    onPress={() => handleToss(supply)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Toss ${getSupplyDisplayName(supply)}`}
                  >
                    <Text style={styles.actionTextDestructive}>Toss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
