// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/GatewayCard.tsx
// Tappable overview card with icon, value, label, detail text, and action arrow.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';

interface GatewayCardProps {
  iconComponent?: React.ComponentType<{ size: number; color: string }>;
  iconEmoji?: string;
  value: string | number;
  label: string;
  detail?: string;
  actionText?: string;
  onPress?: () => void;
  insight?: string;   // e.g., "3 new cuisines tried"
  period?: string;    // e.g., "in last 12 weeks"
}

export default function GatewayCard({
  iconComponent: IconComponent,
  iconEmoji,
  value,
  label,
  detail,
  actionText,
  onPress,
  insight,
  period,
}: GatewayCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.iconRow}>
        {IconComponent ? (
          <IconComponent size={24} color={colors.primary} />
        ) : iconEmoji ? (
          <Text style={styles.emoji}>{iconEmoji}</Text>
        ) : null}
      </View>

      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>

      {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}

      {insight ? <Text style={styles.insight}>{insight}</Text> : null}
      {period ? <Text style={styles.period}>{period}</Text> : null}

      {actionText && onPress ? (
        <View style={styles.actionRow}>
          <Text style={styles.actionText}>{actionText}</Text>
          <Text style={styles.actionArrow}>›</Text>
        </View>
      ) : null}
    </TouchableOpacity>
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
      flex: 1,
      ...shadows.small,
    },
    iconRow: {
      marginBottom: spacing.sm,
    },
    emoji: {
      fontSize: 22,
    },
    value: {
      fontSize: typography.sizes.xxl,
      fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
    },
    label: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      marginTop: 2,
    },
    detail: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      marginTop: spacing.xs,
    },
    insight: {
      fontSize: 10,
      fontWeight: typography.weights.semibold as any,
      color: colors.primary,
      marginTop: spacing.xs,
    },
    period: {
      fontSize: 9,
      color: colors.text.quaternary || colors.text.tertiary,
      marginTop: 1,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    actionText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.primary,
    },
    actionArrow: {
      fontSize: typography.sizes.lg,
      color: colors.primary,
      marginLeft: spacing.xs,
    },
  });
}
