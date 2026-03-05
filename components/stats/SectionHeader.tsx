// components/stats/SectionHeader.tsx
// Section divider with colored tag pill + horizontal line.
// Two variants: "kitchen" (teal) and "frontier" (amber).

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../../lib/theme';

interface SectionHeaderProps {
  label: string;
  variant: 'kitchen' | 'frontier';
}

export default function SectionHeader({ label, variant }: SectionHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const pillBg = variant === 'kitchen'
    ? (colors.primaryLight || '#e0f2f1')
    : '#fffbeb';
  const pillText = variant === 'kitchen'
    ? (colors.primaryDark || colors.primary)
    : '#f59e0b';

  return (
    <View style={styles.container}>
      <View style={[styles.pill, { backgroundColor: pillBg }]}>
        <Text style={[styles.pillText, { color: pillText }]}>{label}</Text>
      </View>
      <View style={[styles.line, { backgroundColor: colors.border.light }]} />
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    pill: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
    },
    pillText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
      letterSpacing: 0.3,
    },
    line: {
      flex: 1,
      height: 1,
    },
  });
}
