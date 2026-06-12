// CP9e — T12 Social hand-off (wireframes v4 screen 12). Both paths converge
// here. THE D-ON-10 COMPLETION STAMP LIVES HERE (moved from T4's interim
// placement — CP9a flag resolved). All exits stamp, then App.tsx flips to the
// main tabs. The two nudge cards currently exit to the app like "Go to Frigo"
// — deep-targeting (PostCreationModal / find-friends) arrives with CP9b/CP9f
// wiring; flagged in SESSION_LOG.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme/ThemeContext';
import { getOnboardingProfile, markOnboardingComplete } from '../../lib/services/onboardingService';

interface Props {
  /** Fired after the completion stamp succeeds — App.tsx flips to the tabs. */
  onComplete: () => void;
}

export default function OnboardingHandoffScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [firstName, setFirstName] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const profile = await getOnboardingProfile(user.id);
      setFirstName(profile?.display_name?.split(/\s+/)[0] ?? '');
    })();
  }, []);

  const finish = async () => {
    if (!userId || finishing) return;
    setFinishing(true);
    try {
      await markOnboardingComplete(userId); // D-ON-10: stamped at T12 completion
      onComplete();
    } catch (error) {
      console.error('❌ Could not complete onboarding:', error);
      Alert.alert('Hmm', 'Something went wrong — please try again.');
      setFinishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.icon}>✨</Text>
        <Text style={styles.title}>{firstName ? `You're all set, ${firstName}` : "You're all set"}</Text>
        <Text style={styles.subtitle}>
          Now the fun part — cook something and share it, or bring more friends in.
        </Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity style={styles.card} onPress={finish} disabled={finishing}>
          <Text style={styles.cardIcon}>🔥</Text>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Cook & post tonight</Text>
            <Text style={styles.cardSubtitle}>Your friends see what you make.</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={finish} disabled={finishing}>
          <Text style={styles.cardIcon}>👥</Text>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Find more friends</Text>
            <Text style={styles.cardSubtitle}>The feed gets better with people you know.</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, finishing && styles.buttonDisabled]}
        onPress={finish}
        disabled={finishing}
      >
        {finishing ? (
          <ActivityIndicator color={colors.background.card} />
        ) : (
          <Text style={styles.primaryButtonText}>Go to Frigo</Text>
        )}
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
    hero: {
      alignItems: 'center',
      marginTop: 32,
      marginBottom: 24,
      gap: 8,
    },
    icon: {
      fontSize: 40,
    },
    title: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.text.primary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    cards: {
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
    },
    primaryButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
  });
