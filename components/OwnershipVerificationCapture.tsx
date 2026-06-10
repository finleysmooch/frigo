// components/OwnershipVerificationCapture.tsx
// CP6a-1 — reusable, standalone capture UI for book-ownership verification.
//
// The user photographs the BOOK TOGETHER WITH A HANDWRITTEN NOTE SHOWING TODAY'S DATE, then submits
// it for review. This component AUTHORIZES NOTHING: it writes a 'pending' verification row via
// ownershipVerificationService and reflects status (which stays 'pending' until CP6a-2's review
// machinery exists). It is intentionally NOT wired into any screen — CP6b/CP9 place it.
//
// All DB/storage work goes through ownershipVerificationService + imageStorageService; this component
// never touches Supabase directly.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { chooseImageSource } from '../lib/services/imageStorageService';
import {
  submitVerification,
  getMyVerification,
  BookOwnershipVerification,
  VerificationStatus,
} from '../lib/services/ownershipVerificationService';

interface Props {
  bookId: string;
  bookTitle?: string;
  bookAuthor?: string;
  /** Fired after a successful submit with the resulting (pending) verification row. */
  onSubmitted?: (verification: BookOwnershipVerification) => void;
}

export function OwnershipVerificationCapture({
  bookId,
  bookTitle,
  bookAuthor,
  onSubmitted,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [verification, setVerification] = useState<BookOwnershipVerification | null>(null);
  const [loading, setLoading] = useState(true); // initial status load
  const [submitting, setSubmitting] = useState(false);

  // Today's date, for the user to copy onto their handwritten note.
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const existing = await getMyVerification(bookId);
        if (active) setVerification(existing);
      } catch (e) {
        // Non-fatal: still show the capture UI if the status read failed.
        console.warn('Could not load verification status', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookId]);

  const handleChoosePhoto = useCallback(async () => {
    const uri = await chooseImageSource();
    if (uri) setImageUri(uri);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!imageUri) return;
    setSubmitting(true);
    try {
      const result = await submitVerification(bookId, imageUri);
      setVerification(result);
      setImageUri(null);
      onSubmitted?.(result);
    } catch (e: any) {
      console.error('submitVerification failed', e);
      Alert.alert(
        'Submission failed',
        e?.message ?? 'Could not submit your verification. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }, [bookId, imageUri, onSubmitted]);

  const statusMeta = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return { label: 'Verified', fg: functionalColors.success, bg: functionalColors.successLight };
      case 'rejected':
        return { label: 'Not approved', fg: functionalColors.error, bg: functionalColors.errorLight };
      default:
        return { label: 'Pending review', fg: functionalColors.warning, bg: functionalColors.warningLight };
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Capture controls only make sense for a fresh book or a still-pending re-submit. Once a row has
  // been reviewed (verified/rejected) the DB (RLS) blocks user edits — re-submission after review is
  // a CP6a-2 policy decision, not a self-serve action — so we hide the picker/submit in that case.
  const canSubmit = !verification || verification.status === 'pending';

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Verify you own this book</Text>
      {bookTitle ? <Text style={styles.bookTitle}>{bookTitle}</Text> : null}
      {bookAuthor ? <Text style={styles.author}>by {bookAuthor}</Text> : null}

      {verification ? (
        <View
          style={[styles.statusBadge, { backgroundColor: statusMeta(verification.status).bg }]}
        >
          <Text style={[styles.statusText, { color: statusMeta(verification.status).fg }]}>
            {statusMeta(verification.status).label}
          </Text>
        </View>
      ) : null}

      <View style={styles.instructionCard}>
        <Text style={styles.instructionTitle}>📷 What to photograph</Text>
        <Text style={styles.instructionBody}>
          Take one photo of the book together with a handwritten note showing today's date
          {' '}
          (<Text style={styles.dateEmphasis}>{todayLabel}</Text>). The book cover and the dated note
          must both be clearly visible in the same shot.
        </Text>
      </View>

      {canSubmit ? (
        <>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          ) : null}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleChoosePhoto}
            disabled={submitting}
          >
            <Text style={styles.secondaryButtonText}>
              {imageUri ? 'Retake / choose another photo' : 'Take or choose photo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, (!imageUri || submitting) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!imageUri || submitting}
          >
            <Text style={styles.primaryButtonText}>
              {submitting
                ? 'Submitting…'
                : verification
                ? 'Re-submit for verification'
                : 'Submit for verification'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.footnote}>
            Submitting sends your proof for review. You'll get access to the book's recipes once it's
            approved — nothing is unlocked automatically.
          </Text>
        </>
      ) : (
        <Text style={styles.footnote}>
          Your submission has been reviewed. If you have questions about this decision, contact
          support.
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    center: {
      paddingVertical: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    container: {
      width: '100%',
      backgroundColor: colors.background.card,
      borderRadius: 16,
      padding: 20,
    },
    heading: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 4,
    },
    bookTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    author: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 4,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      marginTop: 8,
      marginBottom: 4,
    },
    statusText: {
      fontSize: 13,
      fontWeight: '600',
    },
    instructionCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      marginTop: 12,
      marginBottom: 16,
    },
    instructionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 6,
    },
    instructionBody: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text.secondary,
    },
    dateEmphasis: {
      fontWeight: '700',
      color: colors.text.primary,
    },
    preview: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: colors.background.secondary,
    },
    secondaryButton: {
      width: '100%',
      padding: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border.medium,
      marginBottom: 12,
    },
    secondaryButtonText: {
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
    },
    primaryButton: {
      width: '100%',
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.inverse,
    },
    footnote: {
      fontSize: 12,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: 12,
      fontStyle: 'italic',
    },
  });
}
