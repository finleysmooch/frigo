// components/InlineEditableIngredient.tsx
// Inline ingredient editor - shows original text in editable field

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

interface InlineEditableIngredientProps {
  originalText: string;
  onSave: (newText: string) => void;
  onCancel: () => void;
  hasSufficient?: boolean;
}

export default function InlineEditableIngredient({
  originalText,
  onSave,
  onCancel,
  hasSufficient = false
}: InlineEditableIngredientProps) {
  const { colors, functionalColors } = useTheme();
  const [text, setText] = useState(originalText);
  const inputRef = useRef<TextInput>(null);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    ingredientRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    checkmarkHave: {
      fontSize: 16,
      color: functionalColors.success,
      marginRight: 8,
      width: 20,
    },
    checkmarkNeed: {
      fontSize: 16,
      color: colors.text.tertiary,
      marginRight: 8,
      width: 20,
    },
    input: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      backgroundColor: colors.background.card,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 6,
      padding: 8,
      minHeight: 44,
      color: colors.text.primary,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    button: {
      flex: 1,
      padding: 10,
      borderRadius: 6,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.border.medium,
    },
    cancelButtonText: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    saveButtonText: {
      color: colors.background.card,
      fontSize: 14,
      fontWeight: '600',
    },
  }), [colors, functionalColors]);

  useEffect(() => {
    // Auto-focus when component mounts
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const handleSave = () => {
    if (text.trim() && text.trim() !== originalText) {
      onSave(text.trim());
    } else {
      onCancel();
    }
  };

  const handleCancel = () => {
    setText(originalText);
    onCancel();
  };

  return (
    <View style={styles.container}>
      <View style={styles.ingredientRow}>
        <Text style={hasSufficient ? styles.checkmarkHave : styles.checkmarkNeed}>
          {hasSufficient ? '✓' : '○'}
        </Text>
        
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSave}
          onBlur={handleSave}
          returnKeyType="done"
          multiline
          autoFocus
        />
      </View>

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
  );
}