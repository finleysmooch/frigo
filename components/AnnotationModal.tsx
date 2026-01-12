// components/AnnotationModal.tsx
// Modal for editing recipe fields with annotations
// FIXED: Added missing AnnotationFieldType import and corrected function call
// Created: November 11, 2025

import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { saveAnnotation } from '../lib/services/recipeAnnotationsService';
import { useTheme } from '../lib/theme/ThemeContext';
import { AnnotationFieldType } from '../lib/types/recipeExtraction'; // FIXED: Added import
import { AnnotationType } from '../lib/types/recipeFeatures'; // FIXED: Added import

interface AnnotationModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  recipeId: string;
  fieldType: AnnotationFieldType;
  fieldId?: string;
  fieldIndex?: number;
  originalValue: string;
  currentValue?: string;
  onSave: (newValue: string) => void;
}

export default function AnnotationModal({
  visible,
  onClose,
  userId,
  recipeId,
  fieldType,
  fieldId,
  fieldIndex,
  originalValue,
  currentValue,
  onSave,
}: AnnotationModalProps) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, functionalColors), [colors, functionalColors]);

  const [editedValue, setEditedValue] = useState(currentValue || originalValue);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Only save if value changed
      if (editedValue !== originalValue) {
        // FIXED: Map fieldType to proper AnnotationType
        const annotationType: AnnotationType = 
          fieldType === 'ingredient' ? 'ingredient_edit' :
          fieldType === 'instruction' ? 'instruction_edit' :
          'note';

        // FIXED: Construct proper targetField path
        const targetField = fieldIndex !== undefined
          ? `${fieldType}s[${fieldIndex}]`
          : fieldType;

        // FIXED: Call saveAnnotation with correct parameters
        await saveAnnotation(
          userId,
          recipeId,
          annotationType,
          targetField,
          originalValue,
          editedValue,
          notes || undefined
        );

        onSave(editedValue);
      }

      onClose();
    } catch (error) {
      console.error('Error saving annotation:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setEditedValue(originalValue);
    setNotes('');
  };

  const getFieldLabel = () => {
    switch (fieldType) {
      case 'ingredient':
        return 'Ingredient';
      case 'instruction':
        return 'Instruction';
      case 'time':
        return 'Time';
      case 'servings':
        return 'Servings';
      case 'note':
        return 'Note';
      default:
        return 'Field';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit {getFieldLabel()}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Original Value */}
          <View style={styles.section}>
            <Text style={styles.label}>Original:</Text>
            <View style={styles.originalBox}>
              <Text style={styles.originalText}>{originalValue}</Text>
            </View>
          </View>

          {/* Edited Value */}
          <View style={styles.section}>
            <Text style={styles.label}>Your Version:</Text>
            <TextInput
              style={styles.input}
              value={editedValue}
              onChangeText={setEditedValue}
              multiline={fieldType === 'instruction'}
              numberOfLines={fieldType === 'instruction' ? 4 : 1}
              placeholder="Enter your version..."
              autoFocus
            />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes (optional):</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholder="Why did you make this change?"
            />
          </View>

          {/* Preview */}
          <View style={styles.section}>
            <Text style={styles.label}>Preview (Markup View):</Text>
            <View style={styles.previewBox}>
              <Text>
                <Text style={styles.strikethrough}>{originalValue}</Text>
                <Text style={styles.annotated}> {editedValue}</Text>
              </Text>
              {notes && (
                <Text style={styles.previewNotes}>📝 {notes}</Text>
              )}
            </View>
          </View>

          {/* Reset Button */}
          {editedValue !== originalValue && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>Reset to Original</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    cancelButton: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    saveButton: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    saveButtonDisabled: {
      color: colors.text.tertiary,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    originalBox: {
      padding: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    originalText: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    input: {
      fontSize: 16,
      padding: 12,
      backgroundColor: colors.background.card,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary,
      minHeight: 44,
      color: colors.text.primary,
    },
    notesInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    previewBox: {
      padding: 12,
      backgroundColor: functionalColors.warning + '15',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: functionalColors.warning,
    },
    strikethrough: {
      textDecorationLine: 'line-through',
      color: colors.text.tertiary,
    },
    annotated: {
      color: colors.primary,
      fontWeight: '600',
    },
    previewNotes: {
      fontSize: 12,
      color: colors.text.secondary,
      marginTop: 8,
      fontStyle: 'italic',
    },
    resetButton: {
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    resetButtonText: {
      fontSize: 16,
      color: colors.text.secondary,
      fontWeight: '600',
    },
  });
}