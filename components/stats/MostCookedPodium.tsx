// components/stats/MostCookedPodium.tsx
// 3-pedestal podium showing top-cooked recipes with medal emojis,
// concept emoji thumbnails, cook count, recipe name, and chef name.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import type { MostCookedItem } from '../../lib/services/statsService';
import MiniBarRow from './MiniBarRow';

interface PodiumProps {
  items: MostCookedItem[];
  onRecipePress: (recipeId: string) => void;
  onSeeAll: () => void;
  embedded?: boolean; // When true, skip card wrapper and header (used inside MostCookedSection)
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function MostCookedPodium({ items, onRecipePress, onSeeAll, embedded }: PodiumProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const Wrapper = embedded ? React.Fragment : ({ children }: { children: React.ReactNode }) => (
    <View style={styles.card}>{children}</View>
  );

  // Empty state
  if (items.length === 0) {
    return (
      <Wrapper>
        {!embedded && (
          <View style={styles.header}>
            <Text style={styles.title}>Most Cooked</Text>
          </View>
        )}
        <Text style={styles.emptyText}>Cook more recipes to see your podium!</Text>
      </Wrapper>
    );
  }

  // Fallback: < 2 items → simple ranked list
  if (items.length < 2) {
    return (
      <Wrapper>
        {!embedded && (
          <View style={styles.header}>
            <Text style={styles.title}>Most Cooked</Text>
            <TouchableOpacity onPress={onSeeAll}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all ›</Text>
            </TouchableOpacity>
          </View>
        )}
        {items.map((item, i) => (
          <MiniBarRow
            key={item.recipeId}
            rank={i + 1}
            name={item.title}
            subtitle={[item.chef, item.book].filter(Boolean).join(' · ') || undefined}
            count={item.count}
            barPct={item.barPct}
            onPress={() => onRecipePress(item.recipeId)}
          />
        ))}
      </Wrapper>
    );
  }

  // Podium layout: reorder as [#2, #1, #3]
  const podiumOrder = items.length >= 3
    ? [items[1], items[0], items[2]]
    : [items[1], items[0]];
  const rankOrder = items.length >= 3 ? [1, 0, 2] : [1, 0];

  return (
    <Wrapper>
      {!embedded && (
        <View style={styles.header}>
          <Text style={styles.title}>Most Cooked</Text>
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all ›</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.podiumRow}>
        {podiumOrder.map((item, i) => {
          const rank = rankOrder[i];
          const isCenter = rank === 0;
          return (
            <TouchableOpacity
              key={item.recipeId}
              style={[
                styles.pedestal,
                { width: isCenter ? 120 : 100 },
                isCenter && { backgroundColor: colors.background.secondary, paddingTop: spacing.sm },
                !isCenter && { paddingTop: isCenter ? spacing.sm : spacing.md + (rank === 2 ? 8 : 0) },
              ]}
              onPress={() => onRecipePress(item.recipeId)}
              activeOpacity={0.7}
            >
              <Text style={styles.medal}>{MEDALS[rank]}</Text>
              <Text style={[styles.cookCount, { color: colors.primary }]}>{item.count}×</Text>
              <Text style={styles.recipeName} numberOfLines={2}>{item.title}</Text>
              {item.chef && (
                <Text style={styles.chefName} numberOfLines={1}>{item.chef}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </Wrapper>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...shadows.small,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
    },
    seeAll: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    podiumRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: spacing.xs,
      paddingTop: spacing.sm,
    },
    pedestal: {
      alignItems: 'center',
      paddingBottom: spacing.sm,
      borderRadius: borderRadius.md,
    },
    medal: {
      fontSize: 20,
      marginBottom: spacing.xs,
    },
    cookCount: {
      fontSize: 16,
      fontWeight: typography.weights.bold as any,
      marginBottom: 2,
    },
    recipeName: {
      fontSize: 14,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      textAlign: 'center',
      lineHeight: 18,
    },
    chefName: {
      fontSize: 12,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: 2,
    },
  });
}
