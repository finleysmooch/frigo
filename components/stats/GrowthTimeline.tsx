// components/stats/GrowthTimeline.tsx
// "How You've Grown" vertical timeline with period labels, headlines, and details.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import type { GrowthMilestone } from '../../lib/services/statsService';

interface GrowthTimelineProps {
  milestones: GrowthMilestone[];
}

export default function GrowthTimeline({ milestones }: GrowthTimelineProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (milestones.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>How You've Grown</Text>
      {milestones.map((m, i) => (
        <View
          key={`${m.period}-${i}`}
          style={[
            styles.entry,
            i < milestones.length - 1 && styles.entryBorder,
          ]}
        >
          <View style={styles.periodCol}>
            <Text style={styles.periodText}>{m.period}</Text>
          </View>
          <View style={styles.contentCol}>
            <Text style={styles.headline}>{m.headline}</Text>
            {m.detail ? <Text style={styles.detail}>{m.detail}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...shadows.small,
    },
    cardTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    entry: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: spacing.sm,
    },
    entryBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    periodCol: {
      width: 40,
      flexShrink: 0,
    },
    periodText: {
      fontSize: 10,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.tertiary,
    },
    contentCol: {
      flex: 1,
    },
    headline: {
      fontSize: 12,
      fontWeight: typography.weights.medium as any,
      color: colors.text.primary,
    },
    detail: {
      fontSize: 10,
      color: colors.text.tertiary,
      marginTop: 2,
    },
  });
}
