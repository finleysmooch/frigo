// CP9c — T6 Router Q0 "How do you cook?" (wireframes v4 screen 6; D-ON-5).
// Pure route-only step (the one deliberate route-only exception):
//   recipes / both → recipe path (T7–T9, CP9d — NOT BUILT YET: until it lands,
//   both route to Staples; CP9d inserts itself between this screen and T11)
//   by feel       → Freehand placeholder (T10, shelved per S6) → Staples
// The Q0 answer is FLOW-LOCAL (not persisted) — persistence as a
// personalization signal has no ruling; flagged in SESSION_LOG.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'Router'>;

type CookStyle = 'recipes' | 'both' | 'feel';

const CHOICES: { key: CookStyle; icon: string; title: string; subtitle: string }[] = [
  {
    key: 'recipes',
    icon: '📖',
    title: 'I follow recipes',
    subtitle: 'Cookbooks, saved links, the NYT app — I cook from sources.',
  },
  {
    key: 'both',
    icon: '🔀',
    title: 'A bit of both',
    subtitle: 'Sometimes a recipe, sometimes I wing it.',
  },
  {
    key: 'feel',
    icon: '🔥',
    title: 'I go by feel',
    subtitle: 'I rarely follow a recipe — I just cook.',
  },
];

export default function OnboardingRouterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<CookStyle>('recipes');

  const handleContinue = () => {
    if (selected === 'feel') {
      navigation.navigate('Freehand');
    } else {
      // CP9d insertion point: recipes/both → T7 (L1 sources) once built.
      navigation.navigate('Staples');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>How do you cook?</Text>
        <Text style={styles.subtitle}>
          Just helps us set you up — you can do it all either way.
        </Text>
      </View>

      <View style={styles.choices}>
        {CHOICES.map((choice) => {
          const isSelected = selected === choice.key;
          return (
            <TouchableOpacity
              key={choice.key}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelected(choice.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={styles.cardIcon}>{choice.icon}</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{choice.title}</Text>
                <Text style={styles.cardSubtitle}>{choice.subtitle}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
      padding: 24,
    },
    titleBlock: {
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 24,
      gap: 6,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
    },
    subtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    choices: {
      flex: 1,
      gap: 12,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1.5,
      borderColor: colors.border.medium,
      borderRadius: 12,
      padding: 16,
      backgroundColor: colors.background.card,
    },
    cardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.background.secondary ?? colors.background.card,
    },
    cardIcon: {
      fontSize: 24,
    },
    cardText: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    cardSubtitle: {
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 18,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
  });
