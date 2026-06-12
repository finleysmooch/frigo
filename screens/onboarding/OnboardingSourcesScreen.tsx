// CP9d — T7 L1 sources (wireframes v4 screen 7; S4 verbatim list).
// Pure routing/gating: selections decide which value steps follow.
// Branch map (ratified via the recovered spec harvest, plan §2 CP9d):
//   Cookbooks            -> T8 (search + verify)
//   web/social sources   -> T9a (paste)
//   In my head / Other   -> no import, personalization signal only
// T9b signature is offered to ALL recipe-path users (S5) and always closes the
// value steps. Selections are FLOW-LOCAL (persistence unruled — same flag as Q0).

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'Sources'>;

// S4 list verbatim. `web` flags route to T9a paste.
const SOURCES: { key: string; label: string; web?: boolean }[] = [
  { key: 'cookbooks', label: 'Cookbooks' },
  { key: 'nyt', label: 'NYT Cooking', web: true },
  { key: 'links', label: 'Saved web links', web: true },
  { key: 'instagram_tiktok', label: 'Instagram / TikTok', web: true },
  { key: 'youtube', label: 'YouTube', web: true },
  { key: 'reddit', label: 'Reddit', web: true },
  { key: 'substack', label: 'Substack', web: true },
  { key: 'in_my_head', label: 'In my head' },
  { key: 'other', label: 'Other' },
];

export const hasWebSources = (keys: string[]) =>
  SOURCES.some((s) => s.web && keys.includes(s.key));

export default function OnboardingSourcesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState('');

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleContinue = () => {
    const sources = [...checked];
    if (sources.includes('cookbooks')) {
      navigation.navigate('Cookbooks', { sources });
    } else if (hasWebSources(sources)) {
      navigation.navigate('Paste', { sources });
    } else {
      navigation.navigate('Signature'); // signature offered to all (S5)
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Where do your recipes live?</Text>
      <Text style={styles.instruction}>
        Pick all that apply — we'll only ask about the ones you use.
      </Text>

      <ScrollView style={styles.list}>
        {SOURCES.map((source) => {
          const isChecked = checked.has(source.key);
          return (
            <View key={source.key}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => toggle(source.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
              >
                <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                  {isChecked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rowLabel}>{source.label}</Text>
              </TouchableOpacity>
              {source.key === 'other' && isChecked && (
                <TextInput
                  style={styles.otherInput}
                  placeholder="e.g. recipe box, family cards, a friend's blog"
                  placeholderTextColor={colors.text.tertiary}
                  value={otherText}
                  onChangeText={setOtherText}
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryLink}
        onPress={() => navigation.navigate('Signature')}
      >
        <Text style={styles.secondaryLinkText}>I'll add recipes later</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.card, padding: 24 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
    instruction: { fontSize: 14, color: colors.text.secondary, marginBottom: 16 },
    list: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    checkbox: {
      width: 24, height: 24, borderRadius: 6, borderWidth: 1.5,
      borderColor: colors.border.medium, alignItems: 'center', justifyContent: 'center',
      marginRight: 12, backgroundColor: colors.background.card,
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkmark: { color: colors.background.card, fontSize: 14, fontWeight: '700' },
    rowLabel: { fontSize: 16, color: colors.text.primary },
    otherInput: {
      borderWidth: 1, borderColor: colors.border.medium, borderRadius: 8,
      padding: 12, fontSize: 14, color: colors.text.primary, marginLeft: 36, marginBottom: 6,
    },
    primaryButton: {
      backgroundColor: colors.primary, padding: 16, borderRadius: 8,
      alignItems: 'center', marginTop: 8,
    },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    secondaryLink: { alignItems: 'center', marginTop: 14 },
    secondaryLinkText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  });
