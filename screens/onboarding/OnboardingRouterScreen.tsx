// CP9c — T6 Router Q0 "How do you cook?" (wireframes v4 screen 6; D-ON-5).
// Pure route-only step (the one deliberate route-only exception):
//   recipes / both → recipe path (T7 sources → gated T8/T9 value steps, CP9d)
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

const CHOICES: { key: CookStyle; emoji: string; title: string; subtitle: string }[] = [
  {
    key: 'recipes',
    emoji: '🤓',
    title: 'I like to follow recipes',
    subtitle: 'Cookbooks, saved links, NYT Cooking — I cook from sources (and maybe go rogue on the seasoning).',
  },
  {
    key: 'both',
    emoji: '🤹',
    title: 'A bit of both',
    subtitle: "Some nights it's a recipe, some nights it's whatever's in the fridge and a prayer.",
  },
  {
    key: 'feel',
    emoji: '😎',
    title: 'I go by feel',
    subtitle: 'Recipes? Barely know her. I just cook.',
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
      // CP9d: recipes/both → T7 (L1 sources) → gated value steps → staples.
      navigation.navigate('Sources');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>What happens in your kitchen most nights?</Text>
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
              <Text style={styles.cardEmoji}>{choice.emoji}</Text>
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
      fontSize: 26,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
      lineHeight: 32,
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
    cardEmoji: {
      fontSize: 40,
      width: 52,
      textAlign: 'center',
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
