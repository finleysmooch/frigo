// T11 — Pantry staples host (wireframes v4 screen 11; D-ON-2/D-ON-13) with the
// D-ON-16 "S9-lite" branch: if a space invitation is pending (spouse case),
// lead with "Join {inviter}'s pantry" — accepting joins + makes it ACTIVE and
// SKIPS the staples seed (their pantry is already configured; the T15 empty
// state catches a genuinely empty shared space). Declining (or choosing your
// own pantry) falls through to the normal checklist. Reactive only — no
// shared-space question enters the spine.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import { useSpace } from '../../contexts/SpaceContext';
import { StaplesChecklist } from '../../components/onboarding/StaplesChecklist';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'Staples'> & {
  userId: string;
};

export default function OnboardingStaplesScreen({ navigation, userId }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pendingInvitations, acceptInvitation, switchSpace } = useSpace();
  const [joining, setJoining] = useState(false);
  // D-ON-16: once the user opts to build their own pantry, the join lead hides.
  const [showChecklist, setShowChecklist] = useState(false);

  const invitation = pendingInvitations[0] ?? null;
  const showJoinLead = !!invitation && !showChecklist;

  const handleJoin = async () => {
    if (!invitation || joining) return;
    setJoining(true);
    try {
      await acceptInvitation(invitation.id);
      await switchSpace(invitation.space_id); // shared pantry becomes PRIMARY
      navigation.navigate('Handoff'); // skip the seed — pantry already configured
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {showJoinLead ? (
        <View style={styles.joinWrap}>
          <Text style={styles.joinIcon}>🏠</Text>
          <Text style={styles.title}>Join {invitation!.inviter_name}'s pantry?</Text>
          <Text style={styles.subtitle}>
            {invitation!.inviter_name} invited you to share "{invitation!.space_name}" — you'll cook
            from the same pantry.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, joining && styles.buttonDisabled]}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color={colors.background.card} />
            ) : (
              <Text style={styles.primaryButtonText}>Join their pantry</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryLink} onPress={() => setShowChecklist(true)}>
            <Text style={styles.secondaryLinkText}>Set up my own pantry instead</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>What do you keep on hand?</Text>
            <Text style={styles.subtitle}>
              Tap what you usually have — unlocks "what can I cook?". All marked in-stock; fix any
              later.
            </Text>
          </View>
          <StaplesChecklist userId={userId} onDone={() => navigation.navigate('Handoff')} />
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
      padding: 16,
    },
    header: {
      marginBottom: 16,
    },
    joinWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 8,
    },
    joinIcon: {
      fontSize: 40,
    },
    title: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      alignSelf: 'stretch',
      marginTop: 16,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryLink: {
      alignItems: 'center',
      marginTop: 8,
    },
    secondaryLinkText: {
      fontSize: 14,
      color: colors.primary,
      textDecorationLine: 'underline',
    },
  });
