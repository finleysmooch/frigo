// components/InlineEditableIngredient.tsx
// Inline ingredient editor - shows original text in editable field

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard
} from 'react-native';

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
  const [text, setText] = useState(originalText);
  const inputRef = useRef<TextInput>(null);

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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f8f8',
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
    color: '#34C759',
    marginRight: 8,
    width: 20,
  },
  checkmarkNeed: {
    fontSize: 16,
    color: '#ccc',
    marginRight: 8,
    width: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 6,
    padding: 8,
    minHeight: 44,
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
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});