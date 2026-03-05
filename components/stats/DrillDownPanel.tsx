// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/DrillDownPanel.tsx
// Expandable inline panel for nutrition drill-downs and micronutrients.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';

interface DrillDownPanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function DrillDownPanel({ title, onClose, children }: DrillDownPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    panel: {
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border.light,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    title: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
    },
    close: {
      fontSize: typography.sizes.lg,
      color: colors.text.tertiary,
    },
    content: {
      padding: spacing.lg,
    },
  });
}
