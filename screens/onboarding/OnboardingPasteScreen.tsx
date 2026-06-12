// CP9d — T9a Paste (wireframes v4 screen 9a). "Paste a link — including NYT
// Cooking. They land in your library now." Runs the REAL extraction chain
// (extractRecipeFromUrl → parseStandardizedRecipe → matchIngredientsToDatabase
// → saveRecipeToDatabase) DIRECT-SAVE — the review + missing-ingredient steps
// of the full AddRecipeFromUrl flow are deliberately skipped in onboarding
// (unmatched ingredients save unmatched; the user can refine later). Flagged.
// Social/video URLs (S4): route + personalize only — extraction is attempted
// but failure copy keeps it a no-promise.

import React, { useMemo, useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme/ThemeContext';
import { extractRecipeFromUrl, getDomainFromUrl } from '../../lib/services/recipeExtraction/webExtractor';
import { parseStandardizedRecipe } from '../../lib/services/recipeExtraction/unifiedParser';
import { matchIngredientsToDatabase } from '../../lib/services/recipeExtraction/ingredientMatcher';
import { saveRecipeToDatabase } from '../../lib/services/recipeExtraction/recipeService';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'Paste'>;

interface ImportedRow {
  title: string;
  domain: string;
}

export default function OnboardingPasteScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [imported, setImported] = useState<ImportedRow[]>([]);

  const handleImport = async () => {
    const trimmed = url.trim();
    if (!trimmed || status) return;
    setErrorText(null);
    try {
      const fullUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      setStatus('Fetching recipe…');
      const standardized = await extractRecipeFromUrl(fullUrl);
      setStatus('Understanding the recipe…');
      const extracted = await parseStandardizedRecipe(standardized);
      setStatus('Matching ingredients…');
      const matched = await matchIngredientsToDatabase(extracted);
      setStatus('Saving to your library…');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('no session');
      await saveRecipeToDatabase(user.id, matched);
      setImported((prev) => [...prev, {
        title: extracted.recipe.title,
        domain: getDomainFromUrl(fullUrl),
      }]);
      setUrl('');
    } catch (error) {
      console.error('❌ Onboarding paste import failed:', error);
      setErrorText(
        "Couldn't pull a recipe from that link — some sources (Reels, TikTok, YouTube) don't share recipes cleanly. Try another link, or skip for now."
      );
    } finally {
      setStatus(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Bring in a few you love</Text>
      <Text style={styles.instruction}>
        Paste a link — including NYT Cooking. They land in your library now.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Paste a recipe URL"
        placeholderTextColor={colors.text.tertiary}
        value={url}
        onChangeText={(t) => { setUrl(t); setErrorText(null); }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      {errorText && <Text style={styles.errorText}>{errorText}</Text>}

      <TouchableOpacity
        style={[styles.importButton, (status != null || !url.trim()) && styles.buttonDisabled]}
        onPress={handleImport}
        disabled={status != null || !url.trim()}
      >
        {status ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.background.card} size="small" />
            <Text style={styles.importButtonText}>{status}</Text>
          </View>
        ) : (
          <Text style={styles.importButtonText}>Import</Text>
        )}
      </TouchableOpacity>

      <ScrollView style={styles.list}>
        {imported.map((row, i) => (
          <View key={i} style={styles.importedRow}>
            <Text style={styles.importedIcon}>🔗</Text>
            <View style={styles.importedText}>
              <Text style={styles.importedTitle}>{row.title}</Text>
              <Text style={styles.importedDomain}>{row.domain}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Imported</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Signature')}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryLink} onPress={() => navigation.navigate('Signature')}>
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
    input: {
      borderWidth: 1, borderColor: colors.border.medium, borderRadius: 8,
      padding: 14, fontSize: 15, color: colors.text.primary,
    },
    errorText: { marginTop: 8, fontSize: 13, color: '#cc3333', lineHeight: 18 },
    importButton: {
      backgroundColor: colors.primary, padding: 14, borderRadius: 8,
      alignItems: 'center', marginTop: 12,
    },
    buttonDisabled: { opacity: 0.6 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    importButtonText: { color: colors.background.card, fontSize: 15, fontWeight: '600' },
    list: { flex: 1, marginTop: 16 },
    importedRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.medium,
    },
    importedIcon: { fontSize: 18 },
    importedText: { flex: 1 },
    importedTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
    importedDomain: { fontSize: 12, color: colors.text.secondary },
    pill: { backgroundColor: colors.primary + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    pillText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
    primaryButton: {
      backgroundColor: colors.primary, padding: 16, borderRadius: 8,
      alignItems: 'center', marginTop: 8,
    },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    secondaryLink: { alignItems: 'center', marginTop: 14 },
    secondaryLinkText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  });
