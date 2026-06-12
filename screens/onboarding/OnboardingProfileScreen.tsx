// CP9a — T4 Profile (wireframes v4 screen 4; D-ON-4b — avatar only, NO username).
//
// PHOTO CAPTURE DEFERRED (flagged): no avatars storage bucket exists, and the
// live avatar system stores emoji glyphs in avatar_url (EditProfileScreen's
// emoji picker). Shipping photo upload needs a bucket + policies + a renderer
// audit — relayed to oversight; this screen ships initials + "add later".
//
// INTERIM COMPLETION STAMP (flagged): D-ON-10 stamps at T12, but T5–T12 don't
// exist yet — until CP9e lands, BOTH exits here stamp completion so the binary
// gate can't trap a new user in onboarding. CP9e moves the stamp to T12.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme/ThemeContext';
import {
  getOnboardingProfile,
  markOnboardingComplete,
  OnboardingProfile,
} from '../../lib/services/onboardingService';

interface Props {
  /** Fired after the completion stamp succeeds — App.tsx flips to the tabs. */
  onComplete: () => void;
}

const initialsOf = (name: string | null | undefined) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

export default function OnboardingProfileScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          setProfile(await getOnboardingProfile(user.id));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const finish = async () => {
    if (!userId || finishing) return;
    setFinishing(true);
    try {
      await markOnboardingComplete(userId);
      onComplete();
    } catch (error) {
      console.error('❌ Could not complete onboarding:', error);
      Alert.alert('Hmm', 'Something went wrong — please try again.');
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>

      <Text style={styles.title}>You're in</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(profile?.display_name)}</Text>
        </View>
        <Text style={styles.name}>{profile?.display_name ?? ''}</Text>
        <Text style={styles.email}>{profile?.email ?? ''}</Text>
      </View>

      <Text style={styles.note}>You can add a profile photo later in Settings.</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, finishing && styles.buttonDisabled]}
          onPress={finish}
          disabled={finishing}
        >
          {finishing ? (
            <ActivityIndicator color={colors.background.card} />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
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
    dots: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 24,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border.medium,
    },
    dotActive: {
      backgroundColor: colors.primary,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 24,
    },
    card: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: 24,
    },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    avatarText: {
      color: colors.background.card,
      fontSize: 28,
      fontWeight: '700',
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
    },
    email: {
      fontSize: 13,
      color: colors.text.tertiary,
    },
    note: {
      fontSize: 13,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: 12,
    },
    actions: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingBottom: 12,
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
