// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/DiversityBadge.tsx
// Visual badge for diversity score with label and colored ring indicator.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';

interface DiversityBadgeProps {
  score: number;
  label: string;
}

function getScoreColor(score: number): string {
  if (score <= 25) return '#94a3b8';  // grey — Creature of Habit
  if (score <= 50) return '#f59e0b';  // amber — Curious Cook
  if (score <= 75) return '#22c55e';  // green — Explorer
  return '#0d9488';                    // teal — Adventurer
}

export default function DiversityBadge({ score, label }: DiversityBadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scoreColor = getScoreColor(score);

  return (
    <View style={styles.container}>
      <View style={[styles.ring, { borderColor: scoreColor }]}>
        <Text style={[styles.score, { color: scoreColor }]}>{score}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
    },
    ring: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 4,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.card,
    },
    score: {
      fontSize: typography.sizes.xxl,
      fontWeight: typography.weights.bold as any,
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.secondary,
      marginTop: spacing.sm,
    },
  });
}
