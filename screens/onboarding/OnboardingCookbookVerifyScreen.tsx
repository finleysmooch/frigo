// CP9d — T8c Verify your copy (wireframes v4 screen 8c; O1 verify-first).
// Wires the CP6a-1 OwnershipVerificationCapture per selected book — its first
// screen placement (built + deliberately unwired until now). Submission writes
// a pending verification; approval (CP6a-2 portal / allowlist auto-grant) then
// CP6b delivery fire downstream — NO delivery code here. "Verify later" keeps
// the books on the shelf (user_books already created by T8a).

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import { OwnershipVerificationCapture } from '../../components/OwnershipVerificationCapture';
import { hasWebSources } from './OnboardingSourcesScreen';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'CookbookVerify'>;

export default function OnboardingCookbookVerifyScreen({ navigation, route }: Props) {
  const { sources, books } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const next = () =>
    hasWebSources(sources)
      ? navigation.navigate('Paste', { sources })
      : navigation.navigate('Signature');

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Verify your copy</Text>
      <Text style={styles.instruction}>
        A quick photo confirms you own it. Recipes land in your library once your copy is verified.
      </Text>

      <ScrollView style={styles.list}>
        {books.map((book) => (
          <View key={book.id} style={styles.bookBlock}>
            <Text style={styles.bookTitle}>{book.title}</Text>
            {!!book.author && <Text style={styles.bookAuthor}>{book.author}</Text>}
            <OwnershipVerificationCapture
              bookId={book.id}
              bookTitle={book.title}
              bookAuthor={book.author ?? undefined}
            />
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.primaryButton} onPress={next}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryLink} onPress={next}>
        <Text style={styles.secondaryLinkText}>Verify later — keep on my shelf</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.card, padding: 24 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
    instruction: { fontSize: 14, color: colors.text.secondary, marginBottom: 16, lineHeight: 20 },
    list: { flex: 1 },
    bookBlock: {
      marginBottom: 20, paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.medium,
    },
    bookTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    bookAuthor: { fontSize: 13, color: colors.text.secondary, marginBottom: 8 },
    primaryButton: {
      backgroundColor: colors.primary, padding: 16, borderRadius: 8,
      alignItems: 'center', marginTop: 8,
    },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    secondaryLink: { alignItems: 'center', marginTop: 14 },
    secondaryLinkText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  });
