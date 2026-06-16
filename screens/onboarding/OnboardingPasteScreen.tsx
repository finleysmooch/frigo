// CP9d — T9a Paste (wireframes v4 screen 9a), reworked per Tom's walk feedback
// (2026-06-12): imports are BACKGROUND JOBS (lib/services/recipeImportQueue) —
// paste a link, a progress row appears, the field clears immediately, paste
// more, and Continue any time; extractions finish behind the flow and land in
// the library. Review + missing-ingredient resolution stay deliberately
// skipped in onboarding (unmatched ingredients save unmatched — flagged).
// Social/video URLs (S4): route + personalize only — failure rows keep the
// no-promise.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import {
  startRecipeImport,
  subscribeToImports,
  getImportJobs,
  ImportJob,
} from '../../lib/services/recipeImportQueue';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'Paste'>;

export default function OnboardingPasteScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [url, setUrl] = useState('');
  const [jobs, setJobs] = useState<ImportJob[]>(getImportJobs());

  useEffect(() => subscribeToImports(setJobs), []);

  const handleImport = () => {
    if (!url.trim()) return;
    startRecipeImport(url);
    setUrl('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Bring in a few you love</Text>
      <Text style={styles.instruction}>
        Paste a link — including NYT Cooking. They import in the background; keep going whenever
        you're ready.
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Paste a recipe URL"
          placeholderTextColor={colors.text.tertiary}
          value={url}
          onChangeText={setUrl}
          onSubmitEditing={handleImport}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
        />
        <TouchableOpacity
          style={[styles.importButton, !url.trim() && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={!url.trim()}
        >
          <Text style={styles.importButtonText}>Import</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {jobs.map((job) => (
          <View key={job.id} style={styles.jobRow}>
            <Text style={styles.jobIcon}>🔗</Text>
            <View style={styles.jobText}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {job.title ?? job.url}
              </Text>
              <Text style={styles.jobDomain}>
                {job.status === 'failed' ? job.error : job.domain}
              </Text>
            </View>
            {job.status === 'working' && <ActivityIndicator size="small" color={colors.primary} />}
            {job.status === 'done' && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>Imported</Text>
              </View>
            )}
            {job.status === 'failed' && <Text style={styles.failMark}>✕</Text>}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Staples')}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryLink} onPress={() => navigation.navigate('Staples')}>
        <Text style={styles.secondaryLinkText}>Skip</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.card, padding: 24 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
    instruction: { fontSize: 14, color: colors.text.secondary, marginBottom: 16, lineHeight: 20 },
    inputRow: { flexDirection: 'row', gap: 8 },
    input: {
      flex: 1, borderWidth: 1, borderColor: colors.border.medium, borderRadius: 8,
      padding: 14, fontSize: 15, color: colors.text.primary,
    },
    importButton: {
      backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16,
      alignItems: 'center', justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    importButtonText: { color: colors.background.card, fontSize: 15, fontWeight: '600' },
    list: { flex: 1, marginTop: 16 },
    jobRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.medium,
    },
    jobIcon: { fontSize: 18 },
    jobText: { flex: 1 },
    jobTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
    jobDomain: { fontSize: 12, color: colors.text.secondary },
    pill: { backgroundColor: colors.primary + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    pillText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
    failMark: { fontSize: 16, color: '#cc3333', fontWeight: '700' },
    primaryButton: {
      backgroundColor: colors.primary, padding: 16, borderRadius: 8,
      alignItems: 'center', marginTop: 8,
    },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    secondaryLink: { alignItems: 'center', marginTop: 14 },
    secondaryLinkText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  });
