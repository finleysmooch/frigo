// T10 — Freehand path placeholder (wireframes v4 screen 10; SHELVED per S6).
// The "I go by feel" first-value beat needs more design work; the router
// points here and we pass straight through to the staples seed (D-ON-2 is
// standalone and survives the shelving).

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'Freehand'>;

export default function FreehandPlaceholderScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.icon}>🔥</Text>
        <Text style={styles.title}>You cook by feel — we like that</Text>
        <Text style={styles.text}>
          We're building something special for cooks like you. For now, let's stock your pantry so
          Frigo can tell you what you can make tonight.
        </Text>
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Staples')}>
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
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    icon: {
      fontSize: 40,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      textAlign: 'center',
    },
    text: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 21,
      paddingHorizontal: 12,
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
