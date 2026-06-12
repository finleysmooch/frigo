// CP9d — T9b Signature (wireframes v4 screen 9b; S5 — offered to ALL
// recipe-path users). DEGRADED MODE per the anchor §7 flag (decided at draft):
// the post-backdating flags don't exist, so this creates the recipe + favorite
// only — no backdated post/profile entry; source and ~times live in the
// description text (no columns). The flags migration can upgrade later.
// T9c (chefs) is NOT in this slice: no chef-follow mechanism exists in the
// schema — reported at draft alongside this call.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme/ThemeContext';
import { addSignatureRecipe } from '../../lib/services/onboardingService';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'Signature'>;

export default function OnboardingSignatureScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [times, setTimes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  const next = () => navigation.navigate('Staples');

  const handleAdd = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await addSignatureRecipe(user.id, { title, source, timesMade: times });
      setSavedTitle(title.trim());
    } catch (error) {
      console.error('❌ Signature save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>A recipe you make on repeat?</Text>
      <Text style={styles.instruction}>
        Your signature dish — we'll add it to your favorites and your profile.
      </Text>

      {savedTitle ? (
        <View style={styles.savedWrap}>
          <Text style={styles.savedIcon}>❤️</Text>
          <Text style={styles.savedText}>"{savedTitle}" added to your favorites.</Text>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="e.g. My mom's chili"
            placeholderTextColor={colors.text.tertiary}
            value={title}
            onChangeText={setTitle}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.sourceInput]}
              placeholder="Source (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={source}
              onChangeText={setSource}
            />
            <TextInput
              style={[styles.input, styles.timesInput]}
              placeholder="~ times"
              placeholderTextColor={colors.text.tertiary}
              value={times}
              onChangeText={setTimes}
              keyboardType="number-pad"
            />
          </View>
          <TouchableOpacity
            style={[styles.primaryButton, (!title.trim() || saving) && styles.buttonDisabled]}
            onPress={handleAdd}
            disabled={!title.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.background.card} />
            ) : (
              <Text style={styles.primaryButtonText}>Add it</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        {savedTitle ? (
          <TouchableOpacity style={styles.primaryButton} onPress={next}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryLink} onPress={next}>
            <Text style={styles.secondaryLinkText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.card, padding: 24 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
    instruction: { fontSize: 14, color: colors.text.secondary, marginBottom: 20, lineHeight: 20 },
    form: { gap: 12 },
    input: {
      borderWidth: 1, borderColor: colors.border.medium, borderRadius: 8,
      padding: 14, fontSize: 15, color: colors.text.primary,
    },
    row: { flexDirection: 'row', gap: 8 },
    sourceInput: { flex: 2 },
    timesInput: { flex: 1 },
    savedWrap: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    savedIcon: { fontSize: 32 },
    savedText: { fontSize: 15, color: colors.text.primary, fontWeight: '600', textAlign: 'center' },
    footer: { flex: 1, justifyContent: 'flex-end', paddingBottom: 12 },
    primaryButton: {
      backgroundColor: colors.primary, padding: 16, borderRadius: 8, alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    secondaryLink: { alignItems: 'center' },
    secondaryLinkText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  });
