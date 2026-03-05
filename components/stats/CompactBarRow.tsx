// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/CompactBarRow.tsx
// Compact ranked row for side-by-side cards (173px width). Two-line layout: name+count, then thin bar.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing } from '../../lib/theme';

interface CompactBarRowProps {
  name: string;
  count: number | string;
  barPct: number;
  onPress?: () => void;
}

export default function CompactBarRow({ name, count, barPct, onPress }: CompactBarRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const content = (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
        <Text style={styles.count}>{count}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(barPct, 100)}%` }]} />
      </View>
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
    container: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    name: {
      flex: 1,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.primary,
      marginRight: spacing.xs,
    },
    count: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.secondary,
    },
    barTrack: {
      height: 3,
      backgroundColor: colors.border.light,
      borderRadius: 2,
      marginTop: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
  });
}
