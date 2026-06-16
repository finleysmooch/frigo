// CP9d — T8c Verify your copy (wireframes v4 screen 8c; O1 verify-first).
// Flow per Tom's walk (2026-06-12): NO per-book submit — tap each book's
// thumbnail to attach a photo (✓ marks it attached), and CONTINUE submits all
// attached photos in one pass via ownershipVerificationService. Books left
// without a photo stay on the shelf unverified (same as "Verify later").
// Instructions (incl. today's date + signature, O1 as amended by Tom) render
// once at the top. Approval (CP6a-2) and delivery (CP6b) fire downstream.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import { CameraIcon } from '../../components/icons';
import { chooseImageSource } from '../../lib/services/imageStorageService';
import { submitVerification } from '../../lib/services/ownershipVerificationService';
import { hasWebSources } from './OnboardingSourcesScreen';
import { BookCover, createBookBlockStyles } from './OnboardingCookbooksScreen';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'CookbookVerify'>;

export default function OnboardingCookbookVerifyScreen({ navigation, route }: Props) {
  const { sources, books } = route.params;
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, functionalColors), [colors, functionalColors]);

  const [photos, setPhotos] = useState<Map<string, string>>(new Map());
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    []
  );

  const next = () =>
    hasWebSources(sources)
      ? navigation.navigate('Paste', { sources })
      : navigation.navigate('Staples');

  const pickPhoto = async (bookId: string) => {
    if (submitting || submittedIds.has(bookId)) return;
    const uri = await chooseImageSource();
    if (uri) {
      setPhotos((prev) => new Map(prev).set(bookId, uri));
      setFailedIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(bookId);
        return nextSet;
      });
    }
  };

  // Continue = auto-submit every attached photo, then move on. Failures keep
  // you here with the failed books marked; a photo-less book just stays on
  // the shelf unverified.
  const handleContinue = async () => {
    if (submitting) return;
    const pending = books.filter((b) => photos.has(b.id) && !submittedIds.has(b.id));
    if (pending.length === 0) {
      next();
      return;
    }
    setSubmitting(true);
    const failures = new Set<string>();
    try {
      for (const book of pending) {
        try {
          await submitVerification(book.id, photos.get(book.id)!);
          setSubmittedIds((prev) => new Set(prev).add(book.id));
        } catch (e) {
          console.error(`❌ verification submit failed for "${book.title}":`, e);
          failures.add(book.id);
        }
      }
      setFailedIds(failures);
      if (failures.size === 0) {
        next();
      } else {
        Alert.alert(
          'Some photos did not send',
          'The marked books failed to submit — tap Continue to retry, or verify them later from your shelf.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const attachedCount = [...photos.keys()].filter((id) => !submittedIds.has(id)).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back to books</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Verify your copy</Text>
        <Text style={styles.instruction}>
          One photo per book: the book together with a handwritten note showing today's date
          {' '}(<Text style={styles.dateEmphasis}>{todayLabel}</Text>) and your signature — both
          clearly visible in the same shot. Recipes land in your library once your copy is verified.
        </Text>

        <ScrollView style={styles.list}>
          {books.map((book) => {
            const photo = photos.get(book.id);
            const isSubmitted = submittedIds.has(book.id);
            const isFailed = failedIds.has(book.id);
            return (
              <View key={book.id} style={styles.verifyCard}>
                <BookCover book={book} styles={styles} />
                <View style={styles.verifyText}>
                  <Text style={styles.bookCardTitle} numberOfLines={2}>{book.title}</Text>
                  {!!book.author && (
                    <Text style={styles.bookCardAuthor} numberOfLines={1}>{book.author}</Text>
                  )}
                  {isSubmitted ? (
                    <Text style={styles.stateSubmitted}>✓ Submitted for review</Text>
                  ) : isFailed ? (
                    <Text style={styles.stateFailed}>✕ Didn't send — Continue retries</Text>
                  ) : photo ? (
                    <Text style={styles.stateAttached}>✓ Photo attached</Text>
                  ) : (
                    <Text style={styles.stateHint}>Tap the camera to add your photo</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => pickPhoto(book.id)}
                  disabled={submitting || isSubmitted}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  {photo ? (
                    <View>
                      <Image source={{ uri: photo }} style={styles.photoThumb} resizeMode="cover" />
                      <View style={styles.photoCheck}>
                        <Text style={styles.photoCheckText}>✓</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.photoThumb, styles.photoPlaceholder]}>
                      <CameraIcon size={22} color={colors.text.tertiary} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.background.card} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {attachedCount > 0
                ? `Submit ${attachedCount} & continue →`
                : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryLink} onPress={next} disabled={submitting}>
          <Text style={styles.secondaryLinkText}>Verify later — keep on my shelf</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, functionalColors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    inner: { flex: 1, padding: 16 },
    backButton: { marginBottom: 10 },
    backText: { fontSize: 15, color: colors.primary },
    title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
    instruction: { fontSize: 14, color: colors.text.secondary, marginBottom: 14, lineHeight: 20 },
    dateEmphasis: { fontWeight: '700', color: colors.text.primary },
    list: { flex: 1 },
    ...createBookBlockStyles(colors),
    verifyCard: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    verifyText: { flex: 1, gap: 2 },
    stateHint: { fontSize: 12, color: colors.text.tertiary },
    stateAttached: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    stateSubmitted: { fontSize: 12, color: functionalColors?.success ?? colors.primary, fontWeight: '600' },
    stateFailed: { fontSize: 12, color: functionalColors?.error ?? '#cc3333', fontWeight: '600' },
    photoThumb: {
      width: 52,
      height: 52,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
    },
    photoPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderStyle: 'dashed',
    },
    photoCheck: {
      position: 'absolute',
      right: -4,
      top: 2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoCheckText: { color: colors.background.card, fontSize: 11, fontWeight: '700' },
    primaryButton: {
      backgroundColor: colors.primary, padding: 16, borderRadius: 8,
      alignItems: 'center', marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    secondaryLink: { alignItems: 'center', marginTop: 14 },
    secondaryLinkText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  });
