// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/CookbookProgressRow.tsx
// Single cookbook progress row with book icon, title, progress bar, and cooked/total count.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';
import { BookIcon } from '../icons/recipe';

interface CookbookProgressRowProps {
  title: string;
  cooked: number;
  total: number;
  onPress?: () => void;
}

export default function CookbookProgressRow({ title, cooked, total, onPress }: CookbookProgressRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pct = total > 0 ? Math.min(Math.round((cooked / total) * 100), 100) : 0;

  const content = (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <BookIcon size={20} color={colors.text.secondary} />
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.count}>{cooked}/{total}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
      </View>
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
    iconWrap: {
      marginRight: spacing.md,
    },
    info: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    title: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.primary,
      flex: 1,
      marginRight: spacing.sm,
    },
    count: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.tertiary,
    },
    barTrack: {
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
    arrow: {
      fontSize: typography.sizes.lg,
      color: colors.text.tertiary,
      marginLeft: spacing.sm,
    },
  });
}
