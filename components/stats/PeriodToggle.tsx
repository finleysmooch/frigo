// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/PeriodToggle.tsx
// Horizontal pill toggle for period selection (3M/6M/1Y, Month/Season/Year/All, etc.)

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';

export interface PeriodOption {
  label: string;
  value: string;
}

interface PeriodToggleProps {
  options: PeriodOption[];
  selected: string;
  onSelect: (value: string) => void;
  compact?: boolean;
}

export default function PeriodToggle({ options, selected, onSelect, compact }: PeriodToggleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.pill,
              isSelected && styles.pillSelected,
              compact && { paddingHorizontal: 8, paddingVertical: 3 },
            ]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.pillText,
              isSelected && styles.pillTextSelected,
              compact && { fontSize: 11 },
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.lg,
      padding: 2,
    },
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.md,
    },
    pillSelected: {
      backgroundColor: colors.primary,
    },
    pillText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.secondary,
    },
    pillTextSelected: {
      color: '#ffffff',
    },
  });
}
