// DEPRECATED (April 2026): Functionality merged into LogCookSheet 'full' mode.
// This component is no longer rendered. Kept for reference until a future cleanup pass.
//
// components/cooking/PostCookFlow.tsx
// Post-cook retrospective — "Nice cook!" → remember prompts → modifications → continue to LogCookSheet.
// Phase 7B: Simplified — share section moved to LogCookSheet.

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';

interface Props {
  recipeTitle: string;
  bookLine?: string | null;
  onContinue: (data: RememberData) => void;
  onSkip: () => void;
  onNoteOnStep: () => void;
}

export interface RememberData {
  modifications: string;
}

// Keep legacy export name for backward compat during transition
export type PostCookData = RememberData;

export default function PostCookFlow({
  recipeTitle,
  bookLine,
  onContinue,
  onSkip,
  onNoteOnStep,
}: Props) {
  const { colors } = useTheme();
  const [modifications, setModifications] = useState('');

  const handlePlaceholder = (feature: string) => {
    Alert.alert('Coming soon', `${feature} will be available in a future update.`);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>{'\u{1F468}\u200D\u{1F373}'}</Text>
        <Text style={[styles.title, { color: colors.text.primary }]}>Nice cook!</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{recipeTitle}</Text>
        {bookLine && (
          <Text style={[styles.bookRef, { color: colors.text.tertiary }]}>{bookLine}</Text>
        )}
      </View>

      {/* Remember section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          Anything to remember next time?
        </Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}
            onPress={onNoteOnStep}
          >
            <Text style={[styles.chipText, { color: colors.text.secondary }]}>Note on a step</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}
            onPress={() => handlePlaceholder('Voice memos')}
          >
            <Text style={[styles.chipText, { color: colors.text.secondary }]}>Voice memo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}
            onPress={() => handlePlaceholder('Quantity editing')}
          >
            <Text style={[styles.chipText, { color: colors.text.secondary }]}>Edit a quantity</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border.light }]} />

      {/* Modifications */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          What did you change?
        </Text>
        <TextInput
          style={[
            styles.modificationsInput,
            {
              backgroundColor: colors.background.secondary,
              color: colors.text.primary,
              borderColor: colors.border.light,
            },
          ]}
          placeholder="Substitutions, tweaks, timing changes..."
          placeholderTextColor={colors.text.tertiary}
          value={modifications}
          onChangeText={setModifications}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* CTAs */}
      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => onContinue({ modifications: modifications.trim() })}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onSkip}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.text.tertiary }]}>
            Skip — just log the cook
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  headerEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  bookRef: {
    fontSize: 11,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  modificationsInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    minHeight: 60,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaSection: {
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryBtnText: {
    fontSize: 12,
  },
});
