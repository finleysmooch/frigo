// components/cooking/PostCookFlow.tsx
// Post-cook retrospective screen — "Nice cook!" → remember prompts → share prompts.

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

type MakeAgain = 'yes' | 'maybe' | 'no' | null;

interface Props {
  recipeTitle: string;
  bookLine?: string | null;
  onLogAndShare: (data: PostCookData) => void;
  onJustLog: () => void;
  onNoteOnStep: () => void;
}

export interface PostCookData {
  makeAgain: MakeAgain;
  thoughts: string;
}

export default function PostCookFlow({
  recipeTitle,
  bookLine,
  onLogAndShare,
  onJustLog,
  onNoteOnStep,
}: Props) {
  const { colors } = useTheme();
  const [makeAgain, setMakeAgain] = useState<MakeAgain>(null);
  const [thoughts, setThoughts] = useState('');

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
        <Text style={styles.emoji}>👨‍🍳</Text>
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
            <Text style={[styles.chipText, { color: colors.text.secondary }]}>📝 Note on a step</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}
            onPress={() => handlePlaceholder('Voice memos')}
          >
            <Text style={[styles.chipText, { color: colors.text.secondary }]}>🎙 Voice memo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}
            onPress={() => handlePlaceholder('Quantity editing')}
          >
            <Text style={[styles.chipText, { color: colors.text.secondary }]}>✏️ Edit a quantity</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border.light }]} />

      {/* Share section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Share your cook</Text>

        {/* Photo placeholder */}
        <TouchableOpacity
          style={[styles.photoArea, { borderColor: colors.border.medium }]}
          onPress={() => handlePlaceholder('Photo upload')}
        >
          <Text style={styles.photoIcon}>📷</Text>
          <Text style={[styles.photoLabel, { color: colors.text.tertiary }]}>Add a photo</Text>
        </TouchableOpacity>

        {/* Would you make again? */}
        <View style={[styles.makeAgainBox, { backgroundColor: colors.background.secondary }]}>
          <Text style={[styles.makeAgainLabel, { color: colors.text.tertiary }]}>
            Would you make again?
          </Text>
          <View style={styles.makeAgainRow}>
            {(['yes', 'maybe', 'no'] as const).map(val => {
              const isSelected = makeAgain === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.makeAgainBtn,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.background.card,
                      borderColor: isSelected ? colors.primary : colors.border.light,
                    },
                  ]}
                  onPress={() => setMakeAgain(val)}
                >
                  <Text
                    style={[
                      styles.makeAgainBtnText,
                      { color: isSelected ? colors.primary : colors.text.tertiary },
                    ]}
                  >
                    {val.charAt(0).toUpperCase() + val.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Tag */}
        <TouchableOpacity
          style={[styles.tagRow, { backgroundColor: colors.background.secondary }]}
          onPress={() => handlePlaceholder('Tagging')}
        >
          <Text style={styles.tagIcon}>👥</Text>
          <Text style={[styles.tagText, { color: colors.text.tertiary }]}>
            Tag who you ate with
          </Text>
        </TouchableOpacity>

        {/* Thoughts */}
        <TextInput
          style={[
            styles.thoughtsInput,
            {
              backgroundColor: colors.background.secondary,
              color: colors.text.primary,
            },
          ]}
          placeholder="Any thoughts? What would you change?"
          placeholderTextColor={colors.text.tertiary}
          value={thoughts}
          onChangeText={setThoughts}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* CTAs */}
      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => onLogAndShare({ makeAgain, thoughts })}
        >
          <Text style={styles.primaryBtnText}>Log & Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onJustLog}>
          <Text style={[styles.secondaryBtnText, { color: colors.text.tertiary }]}>
            Just log it (skip post)
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
  emoji: {
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
  photoArea: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  photoIcon: {
    fontSize: 24,
  },
  photoLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  makeAgainBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  makeAgainLabel: {
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'center',
  },
  makeAgainRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  makeAgainBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
  },
  makeAgainBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  tagIcon: {
    fontSize: 14,
  },
  tagText: {
    fontSize: 12,
  },
  thoughtsInput: {
    borderRadius: 8,
    padding: 10,
    minHeight: 50,
    fontSize: 12,
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
