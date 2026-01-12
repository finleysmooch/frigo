// components/EditIngredientModal.tsx
// Modal for editing ingredient text

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

interface EditIngredientModalProps {
  visible: boolean;
  ingredientText: string;
  onClose: () => void;
  onSave: (newText: string, notes?: string) => void;
}

export default function EditIngredientModal({
  visible,
  ingredientText,
  onClose,
  onSave
}: EditIngredientModalProps) {
  const { colors, functionalColors } = useTheme();
  const [editedText, setEditedText] = useState(ingredientText);
  const [notes, setNotes] = useState('');

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: colors.background.card,
      borderRadius: 16,
      padding: 24,
      width: '85%',
      maxWidth: 400,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 20,
      color: colors.text.primary,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text.secondary,
      marginBottom: 8,
      marginTop: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      minHeight: 44,
      color: colors.text.primary,
      backgroundColor: colors.background.card,
    },
    notesInput: {
      minHeight: 80,
    },
    buttonRow: {
      flexDirection: 'row',
      marginTop: 24,
      gap: 12,
    },
    button: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.background.secondary,
    },
    cancelButtonText: {
      color: colors.text.secondary,
      fontSize: 16,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    saveButtonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
  }), [colors, functionalColors]);

  const handleSave = () => {
    if (editedText.trim()) {
      onSave(editedText.trim(), notes.trim() || undefined);
      setNotes('');
      onClose();
    }
  };

  const handleCancel = () => {
    setEditedText(ingredientText);
    setNotes('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Edit Ingredient</Text>

          <Text style={styles.label}>Ingredient Text</Text>
          <TextInput
            style={styles.input}
            value={editedText}
            onChangeText={setEditedText}
            placeholder="e.g., 2 cups rice"
            autoFocus
            multiline
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Why did you make this change?"
            multiline
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}