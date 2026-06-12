// CP9a — T3 Account (wireframes v4 screen 3; adapts SignupScreen).
// Email + password ONLY for F&F (D-ON-15 — the wireframe's OAuth buttons do
// not ship). S1: display_name = "First Last", passed via signUp metadata so
// the CP5 trigger sets it atomically (retires SignupScreen's 500ms post-update
// race — that screen is untouched and now unreachable from the entry stack).
// Invite contract: this screen is only reachable with a pre-validated code;
// redemption runs POST-signup, best-effort + idempotent — a code race must
// never orphan the new account.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme/ThemeContext';
import { redeemCode } from '../../lib/services/inviteCodeService';
import type { OnboardingStackParamList } from '../../App';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Account'>;

export default function OnboardingAccountScreen({ navigation, route }: Props) {
  const { inviteCode } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateAccount = async () => {
    if (!email || !password || !firstName.trim() || !lastName.trim()) {
      Alert.alert('Almost there', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Almost there', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          // CP5 trigger reads raw_user_meta_data->>'display_name' — set
          // atomically at insert, no post-update needed.
          data: { display_name: displayName },
        },
      });

      if (error) {
        Alert.alert('Signup failed', error.message);
        return;
      }

      if (data.user) {
        // Best-effort redemption AFTER the account exists. False/throw must
        // never block or orphan the account (CP2 contract).
        if (data.session) {
          try {
            const redeemed = await redeemCode(inviteCode);
            if (!redeemed) console.warn('⚠️ Invite code redemption returned false (race?) — continuing.');
          } catch (e) {
            console.warn('⚠️ Invite code redemption failed (non-fatal):', e);
          }
        } else {
          console.warn('⚠️ No session after signUp (email confirmation on?) — redemption skipped.');
        }
        // No navigation: the App.tsx gate sees the new session and routes to
        // the post-auth onboarding stack (T4).
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>

          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>

          <Text style={styles.title}>Create your account</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor={colors.text.tertiary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor={colors.text.tertiary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.text.tertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={colors.text.tertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleCreateAccount}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background.card} />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
    },
    backButton: {
      marginBottom: 16,
    },
    backText: {
      fontSize: 16,
      color: colors.primary,
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
      marginBottom: 20,
    },
    form: {
      gap: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      padding: 16,
      fontSize: 16,
      backgroundColor: colors.background.card,
      color: colors.text.primary,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
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
