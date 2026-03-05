// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/StockUpCard.tsx
// Green highlight card showing chef ingredients not in the user's pantry, with "Add to grocery list" CTA.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius } from '../../lib/theme';

interface StockUpIngredient {
  id: string;
  name: string;
  ingredientType: string | null;
}

interface StockUpCardProps {
  ingredients: StockUpIngredient[];
  onAddToGrocery: (ingredients: StockUpIngredient[]) => void;
}

export default function StockUpCard({ ingredients, onAddToGrocery }: StockUpCardProps) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, functionalColors), [colors, functionalColors]);

  if (ingredients.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Stock Up</Text>
      <Text style={styles.subtitle}>
        {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''} you don't have yet
      </Text>

      <View style={styles.list}>
        {ingredients.map((ing) => (
          <View key={ing.id} style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.ingredientName}>{ing.name}</Text>
            {ing.ingredientType && (
              <Text style={styles.ingredientType}>{ing.ingredientType}</Text>
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => onAddToGrocery(ingredients)}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Add to grocery list</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: any, functionalColors: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: functionalColors.successLight,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: functionalColors.success + '30',
    },
    title: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: functionalColors.success,
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      marginTop: spacing.xs,
    },
    list: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: functionalColors.success,
      marginRight: spacing.sm,
    },
    ingredientName: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
      flex: 1,
    },
    ingredientType: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
    },
    button: {
      backgroundColor: functionalColors.success,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    buttonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: '#ffffff',
    },
  });
}
