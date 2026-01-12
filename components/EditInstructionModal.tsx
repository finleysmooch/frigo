// components/EditInstructionModal.tsx
// Modal for editing instruction text with ingredient change detection

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

interface EditInstructionModalProps {
  visible: boolean;
  instructionText: string;
  stepNumber: number;
  onClose: () => void;
  onSave: (newText: string, notes?: string) => void;
  onDelete?: () => void;
}

export default function EditInstructionModal({
  visible,
  instructionText,
  stepNumber,
  onClose,
  onSave,
  onDelete
}: EditInstructionModalProps) {
  const { colors, functionalColors } = useTheme();
  const [editedText, setEditedText] = useState(instructionText);
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
      width: '90%',
      maxWidth: 500,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text.primary,
    },
    deleteButton: {
      padding: 4,
    },
    deleteButtonText: {
      fontSize: 24,
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
      color: colors.text.primary,
      backgroundColor: colors.background.card,
    },
    instructionInput: {
      minHeight: 120,
    },
    notesInput: {
      minHeight: 60,
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

  const handleDelete = () => {
    Alert.alert(
      'Delete Step',
      `Are you sure you want to delete step ${stepNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete?.();
            onClose();
          }
        }
      ]
    );
  };

  const handleCancel = () => {
    setEditedText(instructionText);
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
          <View style={styles.header}>
            <Text style={styles.title}>Edit Step {stepNumber}</Text>
            {onDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>Instruction Text</Text>
          <TextInput
            style={[styles.input, styles.instructionInput]}
            value={editedText}
            onChangeText={setEditedText}
            placeholder="Enter instruction..."
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