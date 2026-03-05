// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/TappableConceptList.tsx
// Horizontal-wrap list of cooking concepts with optional icon and count.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';

interface ConceptItem {
  iconComponent?: React.ComponentType<{ size: number; color: string }>;
  emoji?: string;
  name: string;
  count: number;
}

interface TappableConceptListProps {
  items: ConceptItem[];
  onPress?: (item: ConceptItem) => void;
}

export default function TappableConceptList({ items, onPress }: TappableConceptListProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.name}
          style={styles.chip}
          onPress={() => onPress?.(item)}
          activeOpacity={onPress ? 0.7 : 1}
          disabled={!onPress}
        >
          {item.iconComponent ? (
            <item.iconComponent size={16} color={colors.text.secondary} />
          ) : item.emoji ? (
            <Text style={styles.emoji}>{item.emoji}</Text>
          ) : null}
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.count}>{item.count}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.round,
      gap: spacing.xs + 2,
    },
    emoji: {
      fontSize: 14,
    },
    name: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.primary,
    },
    count: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.tertiary,
    },
  });
}
