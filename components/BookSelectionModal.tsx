// components/BookSelectionModal.tsx
// Modal for selecting or adding a book when auto-detection fails

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { getUserBooks, createBook, createUserBookOwnership } from '../lib/services/recipeExtraction/bookService';
import { Book } from '../lib/types/recipeExtraction';

interface Props {
  visible: boolean;
  userId: string;
  onBookSelected: (bookId: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function BookSelectionModal({
  visible,
  userId,
  onBookSelected,
  onSkip,
  onCancel,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, functionalColors), [colors, functionalColors]);

  const [loading, setLoading] = useState(true);
  const [userBooks, setUserBooks] = useState<Array<{ book: Book }>>([]);
  const [showAddNew, setShowAddNew] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<Book[]>([]); // NEW
  
  // Form state for adding new book
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadUserBooks();
    }
  }, [visible]);

  async function loadUserBooks() {
    setLoading(true);
    try {
      const books = await getUserBooks(userId);
      setUserBooks(books);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  }

  // NEW: Check for potential duplicates when user types
  async function checkForDuplicates(title: string) {
    if (!title || title.trim().length < 3) {
      setPotentialDuplicates([]);
      return;
    }

    try {
      // Search for books with similar titles
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .ilike('title', `%${title.trim()}%`)
        .limit(5);

      if (error) {
        console.error('Error checking duplicates:', error);
        return;
      }

      // Filter to only show books the user already has
      const userBookIds = userBooks.map(ub => ub.book.id);
      const duplicates = (data || []).filter(book => 
        userBookIds.includes(book.id)
      );

      setPotentialDuplicates(duplicates);
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
  }

  async function handleSelectBook(book: Book) {
    console.log('📚 User selected book:', book.title);
    onBookSelected(book.id);
  }

  async function handleAddNewBook() {
    if (!newBookTitle.trim()) {
      Alert.alert('Missing Information', 'Please enter a book title');
      return;
    }

    setSaving(true);
    console.log('📖 Creating new book:', newBookTitle, 'by', newBookAuthor);

    try {
      // Create the book
      const book = await createBook(
        {
          book_title: newBookTitle.trim(),
          author: newBookAuthor.trim() || undefined,
          page_number: undefined,
          isbn: undefined,
          isbn13: undefined,
        },
        undefined // No style metadata since user is entering manually
      );

      // Create ownership record
      await createUserBookOwnership(userId, book.id, true);

      console.log('✅ Book created and ownership claimed:', book.id);
      
      // Select this new book
      onBookSelected(book.id);
      
    } catch (error) {
      console.error('Error creating book:', error);
      Alert.alert('Error', 'Failed to create book. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Not Detected</Text>
          <Text style={styles.headerSubtitle}>
            We couldn't identify the book from the photo. Please select or add the book manually.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading your books...</Text>
          </View>
        ) : showAddNew ? (
          // Add new book form
          <ScrollView style={styles.content}>
            <Text style={styles.sectionTitle}>Add New Book</Text>
            
            <Text style={styles.label}>Book Title *</Text>
            <TextInput
              style={styles.input}
              value={newBookTitle}
              onChangeText={(text) => {
                setNewBookTitle(text);
                checkForDuplicates(text); // Check for duplicates as user types
              }}
              placeholder="e.g., That Sounds So Good"
              autoFocus
            />

            {/* Duplicate warning */}
            {potentialDuplicates.length > 0 && (
              <View style={styles.duplicateWarning}>
                <Text style={styles.duplicateWarningIcon}>⚠️</Text>
                <View style={styles.duplicateWarningTextContainer}>
                  <Text style={styles.duplicateWarningTitle}>
                    Similar book already exists:
                  </Text>
                  {potentialDuplicates.map((book) => (
                    <Text key={book.id} style={styles.duplicateWarningBook}>
                      • {book.title}
                      {book.author && ` by ${book.author}`}
                    </Text>
                  ))}
                  <Text style={styles.duplicateWarningHint}>
                    Consider selecting the existing book instead of creating a duplicate.
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.label}>Author</Text>
            <TextInput
              style={styles.input}
              value={newBookAuthor}
              onChangeText={setNewBookAuthor}
              placeholder="e.g., Carla Lalli Music"
            />

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleAddNewBook}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? 'Creating...' : 'Create Book'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setShowAddNew(false)}
            >
              <Text style={styles.secondaryButtonText}>Back to Selection</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          // Select existing book
          <ScrollView style={styles.content}>
            {userBooks.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Select from Your Books</Text>
                {userBooks.map(({ book }) => (
                  <TouchableOpacity
                    key={book.id}
                    style={styles.bookItem}
                    onPress={() => handleSelectBook(book)}
                  >
                    <View>
                      <Text style={styles.bookTitle}>{book.title}</Text>
                      {book.author && (
                        <Text style={styles.bookAuthor}>by {book.author}</Text>
                      )}
                    </View>
                    <Text style={styles.selectArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  You haven't added any books yet.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.primaryButton, styles.addNewButton]}
              onPress={() => setShowAddNew(true)}
            >
              <Text style={styles.primaryButtonText}>+ Add New Book</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onCancel}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.tertiaryButton]}
            onPress={onSkip}
          >
            <Text style={styles.tertiaryButtonText}>Skip (No Book)</Text>
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
      backgroundColor: colors.background.card,
    },
    header: {
      padding: 20,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.text.secondary,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 16,
    },
    bookItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
      marginBottom: 12,
    },
    bookTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    bookAuthor: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    selectArrow: {
      fontSize: 24,
      color: colors.primary,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyStateText: {
      fontSize: 16,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text.primary,
      backgroundColor: colors.background.card,
    },
    duplicateWarning: {
      flexDirection: 'row',
      backgroundColor: functionalColors.warning + '20',
      borderWidth: 1,
      borderColor: functionalColors.warning,
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    duplicateWarningIcon: {
      fontSize: 20,
      marginRight: 10,
    },
    duplicateWarningTextContainer: {
      flex: 1,
    },
    duplicateWarningTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    duplicateWarningBook: {
      fontSize: 13,
      color: colors.text.secondary,
      marginLeft: 8,
      marginVertical: 2,
    },
    duplicateWarningHint: {
      fontSize: 12,
      color: colors.text.secondary,
      fontStyle: 'italic',
      marginTop: 6,
    },
    button: {
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 16,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.text.inverse,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.background.secondary,
    },
    secondaryButtonText: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    tertiaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    tertiaryButtonText: {
      color: colors.text.secondary,
      fontSize: 16,
      fontWeight: '600',
    },
    addNewButton: {
      marginTop: 24,
    },
    footer: {
      flexDirection: 'row',
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      gap: 12,
    },
  });
}