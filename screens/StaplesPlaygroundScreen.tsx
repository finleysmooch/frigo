// CP3 — dev-only wrapper for the StaplesChecklist component.
// Reachable from Settings → Developer → Staples Playground (LogoPlayground
// pattern). Exists so Tom can review the D-ON-13 content/look pre-CP9a; the
// real T11 host arrives with the CP9 onboarding stack.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { StaplesChecklist } from '../components/onboarding/StaplesChecklist';

export default function StaplesPlaygroundScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  if (!userId) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>What do you keep on hand?</Text>
        <Text style={styles.subtitle}>
          Tap what you usually have — unlocks "what can I cook?". All marked in-stock; fix any
          later.
        </Text>
      </View>
      <StaplesChecklist
        userId={userId}
        onDone={(addedCount) =>
          Alert.alert(
            'Staples checklist',
            addedCount > 0 ? `Added ${addedCount} staples to your pantry.` : 'Skipped — nothing added.'
          )
        }
      />
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
    title: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
  });
