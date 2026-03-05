// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/IngredientFilterPills.tsx
// Horizontal scrollable filter pills for ingredient type/family filtering.
// Uses SVG icon components from constants/pantry.ts.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';

interface FilterPillOption {
  label: string;
  value: string;
  iconComponent?: React.ComponentType<{ size?: number; color?: string }>;
}

interface IngredientFilterPillsProps {
  options: FilterPillOption[];
  selected: string;
  onSelect: (value: string) => void;
}

export default function IngredientFilterPills({ options, selected, onSelect }: IngredientFilterPillsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            {opt.iconComponent && (
              <opt.iconComponent
                size={14}
                color={isSelected ? '#ffffff' : colors.text.secondary}
              />
            )}
            <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.round,
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    pillSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
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
