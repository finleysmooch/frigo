// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/NutrientRow.tsx
// Single nutrient row for the macro ring list — colored dot + name + value + arrow.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing } from '../../lib/theme';

interface NutrientRowProps {
  name: string;
  dotColor: string;
  value: string;
  onPress?: () => void;
  // 10D: when true, skip the colored dot but preserve horizontal alignment with macro rows above
  hideDot?: boolean;
  // 10D: optional small secondary-text-color suffix rendered after the value (e.g. "23% DV")
  dvSuffix?: string;
}

export default function NutrientRow({ name, dotColor, value, onPress, hideDot, dvSuffix }: NutrientRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const content = (
    <View style={styles.row}>
      {hideDot ? (
        <View style={styles.dotPlaceholder} />
      ) : (
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      )}
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.value}>{value}</Text>
      {dvSuffix && <Text style={styles.dvSuffix}>{dvSuffix}</Text>}
      {onPress && <Text style={styles.arrow}>›</Text>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function createStyles(colors: any) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: spacing.sm + 2,
    },
    dotPlaceholder: {
      // Matches `dot` width + marginRight so micro rows align with macro rows above.
      width: 10,
      marginRight: spacing.sm + 2,
    },
    name: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
    },
    value: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.secondary,
      marginRight: spacing.xs,
    },
    dvSuffix: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      marginRight: spacing.xs,
    },
    arrow: {
      fontSize: typography.sizes.lg,
      color: colors.text.tertiary,
    },
  });
}
