// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/ComparisonBars.tsx
// Side-by-side comparison bars for chef/book detail pages.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';

interface ComparisonBarsProps {
  label: string;
  valueA: number;
  valueB: number;
  labelA: string;
  labelB: string;
  unit?: string;
}

export default function ComparisonBars({
  label,
  valueA,
  valueB,
  labelA,
  labelB,
  unit = '',
}: ComparisonBarsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const maxVal = Math.max(valueA, valueB, 1);
  const pctA = Math.round((valueA / maxVal) * 100);
  const pctB = Math.round((valueB / maxVal) * 100);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.barGroup}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>{labelA}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFillA, { width: `${pctA}%` }]} />
          </View>
          <Text style={styles.barValue}>{valueA}{unit}</Text>
        </View>

        <View style={styles.barRow}>
          <Text style={styles.barLabel}>{labelB}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFillB, { width: `${pctB}%` }]} />
          </View>
          <Text style={styles.barValue}>{valueB}{unit}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.secondary,
      marginBottom: spacing.xs,
    },
    barGroup: {
      gap: spacing.xs + 2,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    barLabel: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      width: 55,
    },
    barTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.border.light,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
      marginHorizontal: spacing.sm,
    },
    barFillA: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
    barFillB: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: borderRadius.sm,
    },
    barValue: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.secondary,
      minWidth: 40,
      textAlign: 'right',
    },
  });
}
