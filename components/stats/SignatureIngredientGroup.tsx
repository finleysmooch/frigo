// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/SignatureIngredientGroup.tsx
// Grouped ingredient list by family (Produce, Proteins, etc.) for chef detail and drill-downs.
// Uses SVG icon components via getFamilyIconComponent from constants/pantry.ts.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';
import { getFamilyIconComponent } from '../../constants/pantry';
import MiniBarRow from './MiniBarRow';

interface IngredientItem {
  id: string;
  name: string;
  count: number;
  barPct: number;
}

interface SignatureIngredientGroupProps {
  familyLabel: string;
  items: IngredientItem[];
}

export default function SignatureIngredientGroup({ familyLabel, items }: SignatureIngredientGroupProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (items.length === 0) return null;

  const FamilyIcon = getFamilyIconComponent(familyLabel);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {FamilyIcon ? (
          <FamilyIcon size={18} color={colors.text.secondary} />
        ) : null}
        <Text style={styles.familyLabel}>{familyLabel}</Text>
      </View>
      {items.map((item) => (
        <MiniBarRow
          key={item.id}
          name={item.name}
          count={item.count}
          barPct={item.barPct}
        />
      ))}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingBottom: spacing.xs,
      marginBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    familyLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
}
