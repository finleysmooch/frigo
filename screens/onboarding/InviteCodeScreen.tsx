// CP9a — T2 Invite / access code (wireframes v4 screen 2; D-ON-4 / CP2).
// Locked contract (INVITE_CODES.md / handoff): validate_invite_code is
// anon-callable and gates PRE-signup; redemption happens POST-signup on T3.
// Never redeem-before-account.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import { validateCode, InviteCodeStatus } from '../../lib/services/inviteCodeService';
import type { OnboardingStackParamList } from '../../App';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'InviteCode'>;

const STATUS_MESSAGES: Record<Exclude<InviteCodeStatus, 'valid'>, string> = {
  invalid: "That code doesn't look right — check for typos and try again.",
  expired: 'That code has expired. Ask your inviter for a fresh one.',
  redeemed: "That code has reached its limit. Ask your inviter for a fresh one.",
};

export default function InviteCodeScreen({ navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, functionalColors), [colors, functionalColors]);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleContinue = async () => {
    const trimmed = code.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setErrorText(null);
    try {
      const status = await validateCode(trimmed);
      if (status === 'valid') {
        navigation.navigate('Account', { inviteCode: trimmed });
      } else {
        setErrorText(STATUS_MESSAGES[status]);
      }
    } catch (error) {
      console.error('❌ Invite validation failed:', error);
      setErrorText('Could not check the code — are you online? Try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>Enter your access code</Text>
        <Text style={styles.instruction}>
          Frigo is invite-only while we test with a small group of home cooks. Enter the code from
          your invite.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="FRIGO-7K2QX"
          placeholderTextColor={colors.text.tertiary}
          value={code}
          onChangeText={(t) => {
            setCode(t);
            setErrorText(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {errorText && <Text style={styles.errorText}>{errorText}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, checking && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color={colors.background.card} />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryLink}
          onPress={() => Linking.openURL('https://cookfrigo.com')}
        >
          <Text style={styles.secondaryLinkText}>No code? Request access →</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, functionalColors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    keyboardView: {
      flex: 1,
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
      marginBottom: 8,
    },
    instruction: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
      marginBottom: 24,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      padding: 16,
      fontSize: 16,
      backgroundColor: colors.background.card,
      color: colors.text.primary,
      letterSpacing: 1,
    },
    errorText: {
      marginTop: 8,
      fontSize: 13,
      color: functionalColors?.error ?? '#cc3333',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 24,
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
      marginTop: 20,
    },
    secondaryLinkText: {
      fontSize: 14,
      color: colors.primary,
      textDecorationLine: 'underline',
    },
  });
