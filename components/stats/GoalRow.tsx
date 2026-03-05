// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/GoalRow.tsx
// Single nutrition goal row with label, progress bar, and status indicator.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';

type GoalStatus = 'on_track' | 'over' | 'under' | 'not_set';

interface GoalRowProps {
  label: string;
  current: number;
  goal: number;
  status: GoalStatus;
}

function getStatusColor(status: GoalStatus): { text: string; bar: string } {
  switch (status) {
    case 'on_track': return { text: '#22c55e', bar: '#22c55e' };
    case 'over':     return { text: '#f59e0b', bar: '#f59e0b' };
    case 'under':    return { text: '#94a3b8', bar: '#94a3b8' };
    case 'not_set':  return { text: '#94a3b8', bar: '#e2e8f0' };
  }
}

export default function GoalRow({ label, current, goal, status }: GoalRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = getStatusColor(status);
  const pct = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.values, { color: statusColors.text }]}>
          {status === 'not_set' ? '—' : `${current} / ${goal}`}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: statusColors.bar }]} />
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    row: {
      paddingVertical: spacing.sm,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    label: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
    },
    values: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
    },
    barTrack: {
      height: 6,
      backgroundColor: colors.border.light,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: borderRadius.sm,
    },
  });
}
