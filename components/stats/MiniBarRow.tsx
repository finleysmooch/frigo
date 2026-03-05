// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/MiniBarRow.tsx
// Universal ranked item row with optional rank number, icon, name, subtitle, count, and bar.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';

interface MiniBarRowProps {
  rank?: number;
  iconComponent?: React.ComponentType<{ size: number; color: string }>;
  iconEmoji?: string;
  name: string;
  subtitle?: string;
  count: number;
  barPct: number;
  onPress?: () => void;
}

export default function MiniBarRow({
  rank,
  iconComponent: IconComponent,
  iconEmoji,
  name,
  subtitle,
  count,
  barPct,
  onPress,
}: MiniBarRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const content = (
    <View style={styles.row}>
      {rank != null && <Text style={styles.rank}>{rank}</Text>}

      {IconComponent ? (
        <View style={styles.iconWrap}>
          <IconComponent size={20} color={colors.text.secondary} />
        </View>
      ) : iconEmoji ? (
        <Text style={styles.emoji}>{iconEmoji}</Text>
      ) : null}

      <View style={styles.nameColumn}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      <Text style={styles.count}>{count}</Text>

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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.xs,
    },
    rank: {
      width: 22,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
    iconWrap: {
      marginRight: spacing.sm,
    },
    emoji: {
      fontSize: 18,
      marginRight: spacing.sm,
    },
    nameColumn: {
      flex: 1,
      marginRight: spacing.sm,
    },
    name: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.primary,
    },
    subtitle: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      marginTop: 1,
    },
    count: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.secondary,
      minWidth: 28,
      textAlign: 'right',
      marginRight: spacing.sm,
    },
    barTrack: {
      width: 60,
      height: 6,
      backgroundColor: colors.border.light,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
  });
}
