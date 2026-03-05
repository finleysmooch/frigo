// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/RankedList.tsx
// Ranked list of items with optional bars and period toggle.
// Wraps MiniBarRow for consistent rendering.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';
import MiniBarRow from './MiniBarRow';
import PeriodToggle, { PeriodOption } from './PeriodToggle';

interface RankedItem {
  id: string;
  name: string;
  subtitle?: string;
  count: number;
  barPct: number;
  iconComponent?: React.ComponentType<{ size: number; color: string }>;
  iconEmoji?: string;
}

interface RankedListProps {
  items: RankedItem[];
  onPress?: (item: RankedItem) => void;
  showBars?: boolean;
  periodToggle?: {
    options: PeriodOption[];
    selected: string;
    onSelect: (value: string) => void;
  };
  title?: string;
}

export default function RankedList({
  items,
  onPress,
  showBars = true,
  periodToggle,
  title,
}: RankedListProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {(title || periodToggle) && (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {periodToggle && (
            <PeriodToggle
              options={periodToggle.options}
              selected={periodToggle.selected}
              onSelect={periodToggle.onSelect}
            />
          )}
        </View>
      )}

      {items.length === 0 ? (
        <Text style={styles.emptyText}>No data yet</Text>
      ) : (
        items.map((item, i) => (
          <MiniBarRow
            key={item.id}
            rank={i + 1}
            iconComponent={item.iconComponent}
            iconEmoji={item.iconEmoji}
            name={item.name}
            subtitle={item.subtitle}
            count={item.count}
            barPct={showBars ? item.barPct : 0}
            onPress={onPress ? () => onPress(item) : undefined}
          />
        ))
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    title: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
  });
}
