// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/StreakDots.tsx
// 7-dot week display showing which days had cooking activity.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing } from '../../lib/theme';
import type { WeekDot } from '../../lib/services/statsService';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface StreakDotsProps {
  days: WeekDot[];
  onPress?: (day: WeekDot) => void;
}

export default function StreakDots({ days, onPress }: StreakDotsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Pad to 7 if needed
  const displayDays = days.length >= 7 ? days.slice(0, 7) : [
    ...days,
    ...Array(7 - days.length).fill({ day: '', hasMeal: false }),
  ];

  return (
    <View style={styles.container}>
      {displayDays.map((dot: WeekDot, i: number) => (
        <TouchableOpacity
          key={dot.day || i}
          style={styles.dayColumn}
          onPress={() => onPress?.(dot)}
          activeOpacity={onPress ? 0.7 : 1}
          disabled={!onPress}
        >
          <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
          <View style={[styles.dot, dot.hasMeal ? styles.dotActive : styles.dotInactive]} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    dayColumn: {
      alignItems: 'center',
      flex: 1,
    },
    dayLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium as any,
      color: colors.text.tertiary,
      marginBottom: spacing.xs,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    dotActive: {
      backgroundColor: colors.primary,
    },
    dotInactive: {
      backgroundColor: colors.border.light,
    },
  });
}
