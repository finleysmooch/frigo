// ============================================
// FRIGO - CREATE SPACE MODAL
// ============================================
// Modal for creating a new shared space
// Location: components/CreateSpaceModal.tsx
// Created: December 18, 2025
// ============================================

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import { useSpace } from '../contexts/SpaceContext';

// ============================================
// EMOJI OPTIONS
// ============================================

const EMOJI_OPTIONS = [
  '🏠', '🏡', '🏢', '🏔️', '🏖️', '🏕️', '🏨', '🏰',
  '🍳', '🍽️', '👨‍🍳', '👩‍🍳', '🥘', '🍲', '🥗', '🍕',
  '👨‍👩‍👧‍👦', '👥', '❤️', '⭐', '🎉', '🌴', '⛷️', '🏂',
];

// ============================================
// PROPS
// ============================================

interface CreateSpaceModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (spaceId: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export default function CreateSpaceModal({
  visible,
  onClose,
  onCreated,
}: CreateSpaceModalProps) {
  const { colors, functionalColors } = useTheme();

  // State
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Context
  const { createSpace } = useSpace();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modal: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '85%',
      ...shadows.large,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    title: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
    },
    closeButton: {
      fontSize: typography.sizes.xl,
      color: colors.text.tertiary,
      padding: spacing.xs,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
    },
    errorContainer: {
      backgroundColor: '#FEE2E2',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
    },
    errorText: {
      color: functionalColors.error,
      fontSize: typography.sizes.sm,
    },
    field: {
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text.secondary,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    emojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    emojiOption: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    emojiOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    emojiText: {
      fontSize: 24,
    },
    infoBox: {
      flexDirection: 'row',
      backgroundColor: colors.background.secondary,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      gap: spacing.sm,
    },
    infoIcon: {
      fontSize: typography.sizes.lg,
    },
    infoText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    footer: {
      flexDirection: 'row',
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      gap: spacing.md,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text.secondary,
    },
    createButton: {
      flex: 2,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createButtonDisabled: {
      backgroundColor: colors.text.tertiary,
    },
    createButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.background.card,
    },
  }), [colors, functionalColors]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleClose = () => {
    // Reset form
    setName('');
    setEmoji('🏠');
    setDescription('');
    setError(null);
    onClose();
  };

  const handleCreate = async () => {
    // Validate
    if (!name.trim()) {
      setError('Please enter a space name');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const space = await createSpace({
        name: name.trim(),
        emoji,
        description: description.trim() || undefined,
      });

      if (space) {
        onCreated?.(space.id);
        handleClose();
      }
    } catch (err) {
      console.error('Error creating space:', err);
      setError('Failed to create space. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create New Space</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Space Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Space Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Vail House, Beach Cabin"
                placeholderTextColor={colors.text.tertiary}
                autoFocus
                maxLength={50}
              />
            </View>

            {/* Emoji Picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Icon</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[
                      styles.emojiOption,
                      emoji === e && styles.emojiOptionSelected,
                    ]}
                    onPress={() => setEmoji(e)}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What's this space for?"
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>
                You'll be the owner of this space. You can invite family and friends 
                to share a pantry and grocery lists.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.createButton,
                (!name.trim() || isSubmitting) && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Space</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}