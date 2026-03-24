// components/cooking/StepIngredients.tsx
// Compact two-column ingredient list below a step.

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { StepIngredient } from '../../lib/types/cooking';

interface Props {
  ingredients: StepIngredient[];
}

export default function StepIngredients({ ingredients }: Props) {
  const { colors } = useTheme();

  if (!ingredients || ingredients.length === 0) return null;

  return (
    <View style={[styles.container, { borderTopColor: colors.border.light }]}>
      {ingredients.map((ing, i) => {
        const right = [ing.quantity, ing.preparation].filter(Boolean).join(', ');
        return (
          <View key={i} style={styles.row}>
            <Text style={[styles.name, { color: colors.text.secondary }]} numberOfLines={1}>
              {ing.name}
            </Text>
            {right ? (
              <Text style={[styles.qty, { color: colors.text.tertiary }]} numberOfLines={1}>
                {right}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  name: {
    fontSize: 12,
    flex: 1,
  },
  qty: {
    fontSize: 11,
    textAlign: 'right',
    marginLeft: 8,
    flexShrink: 0,
    maxWidth: '50%',
  },
});
