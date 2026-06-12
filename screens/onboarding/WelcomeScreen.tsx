// CP9a — T1 Welcome (wireframes v4 screen 1; D-ON-1 spine entry).
// Verbiage source: cookfrigo.com landing page (S8).

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import { Logo } from '../../components/branding';
import type { OnboardingStackParamList } from '../../App';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Logo size="large" />
        <Text style={styles.tagline}>A home for your home cooking</Text>
        <Text style={styles.subheading}>
          Your recipes, your cooking, and the friends you cook with.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('InviteCode')}>
          <Text style={styles.primaryButtonText}>Get started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryLink} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.secondaryLinkText}>I already have an account</Text>
        </TouchableOpacity>
      </View>
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
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    tagline: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text.primary,
      textAlign: 'center',
      marginTop: 16,
    },
    subheading: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 12,
    },
    actions: {
      gap: 16,
      paddingBottom: 12,
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
    secondaryLink: {
      alignItems: 'center',
    },
    secondaryLinkText: {
      fontSize: 14,
      color: colors.primary,
      textDecorationLine: 'underline',
    },
  });
