// components/BookOwnershipModal.tsx
// Modal for verifying book ownership when user adds recipe from a new book

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { Book } from '../lib/types/recipeExtraction';
import { useTheme } from '../lib/theme/ThemeContext';
import { pickImageFromCamera } from '../lib/services/recipeExtraction/imageProcessor';
import {
  uploadBookCover,
  createUserBookOwnership,
  updateBookCoverUrl,
} from '../lib/services/recipeExtraction/bookService';

interface Props {
  visible: boolean;
  book: Book;
  userId: string;
  onComplete: (claimed: boolean) => void;
  onCancel: () => void;
}

export function BookOwnershipModal({
  visible,
  book,
  userId,
  onComplete,
  onCancel,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, functionalColors), [colors, functionalColors]);

  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleTakeCoverPhoto() {
    const imageUri = await pickImageFromCamera();
    if (imageUri) {
      setCoverImage(imageUri);
    }
  }

  async function handleConfirmOwnership(claimed: boolean) {
    setLoading(true);
    
    try {
      let coverUrl: string | undefined;
      
      // Upload cover photo if taken
      if (coverImage) {
        coverUrl = await uploadBookCover(book.id, coverImage);
        await updateBookCoverUrl(book.id, coverUrl);
      }

      // Create ownership record
      await createUserBookOwnership(userId, book.id, claimed, coverUrl);

      onComplete(claimed);
      
    } catch (error) {
      console.error('Error saving ownership:', error);
      Alert.alert('Error', 'Failed to save ownership. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <View style={styles.modal}>
          <Text style={styles.title}>📖 Book Detected</Text>
          
          <Text style={styles.bookTitle}>{book.title}</Text>
          {book.author && (
            <Text style={styles.author}>by {book.author}</Text>
          )}

          <View style={styles.divider} />

          <Text style={styles.question}>Do you own this book?</Text>

          {/* Cover photo */}
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.coverImage} />
          ) : (
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handleTakeCoverPhoto}
            >
              <Text style={styles.photoButtonText}>📷 Take Photo of Cover</Text>
            </TouchableOpacity>
          )}

          {/* Ownership buttons */}
          <TouchableOpacity
            style={[styles.button, styles.yesButton]}
            onPress={() => handleConfirmOwnership(true)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Saving...' : 'Yes, I Own It'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.noButton]}
            onPress={() => handleConfirmOwnership(false)}
            disabled={loading}
          >
            <Text style={styles.buttonTextDark}>No, Borrowed/Library</Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            Please only add recipes from books you own or have permission to use.
          </Text>

          {/* Cancel */}
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: any, functionalColors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modal: {
      width: '85%',
      backgroundColor: colors.background.card,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 16,
    },
    bookTitle: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.text.primary,
      marginBottom: 4,
    },
    author: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 16,
    },
    divider: {
      width: '100%',
      height: 1,
      backgroundColor: colors.border.medium,
      marginBottom: 16,
    },
    question: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 16,
    },
    coverImage: {
      width: 200,
      height: 200,
      borderRadius: 8,
      marginBottom: 16,
    },
    photoButton: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 8,
      marginBottom: 16,
      width: '100%',
    },
    photoButtonText: {
      textAlign: 'center',
      fontSize: 16,
      color: colors.text.primary,
    },
    button: {
      width: '100%',
      padding: 16,
      borderRadius: 8,
      marginBottom: 12,
    },
    yesButton: {
      backgroundColor: colors.primary,
    },
    noButton: {
      backgroundColor: colors.background.secondary,
    },
    buttonText: {
      color: colors.text.inverse,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextDark: {
      color: colors.text.primary,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
    },
    disclaimer: {
      fontSize: 12,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: 8,
      fontStyle: 'italic',
    },
    cancelButton: {
      marginTop: 8,
    },
    cancelText: {
      color: colors.primary,
      fontSize: 14,
    },
  });
}