// components/InlineEditableInstruction.tsx
// Inline instruction editor - shows original text in editable field

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';

interface InlineEditableInstructionProps {
  originalText: string;
  stepNumber: number;
  onSave: (newText: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function InlineEditableInstruction({
  originalText,
  stepNumber,
  onSave,
  onCancel,
  onDelete
}: InlineEditableInstructionProps) {
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
    } else if (text.trim() === originalText) {
      onCancel();
    } else {
      // Empty text - ask if they want to delete
      Alert.alert(
        'Empty Step',
        'This step is empty. Do you want to delete it?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setText(originalText) },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete?.() }
        ]
      );
    }
  };

  const handleCancel = () => {
    setText(originalText);
    onCancel();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Step',
      `Are you sure you want to delete step ${stepNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete?.() }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.instructionRow}>
        <Text style={styles.stepNumber}>{stepNumber}.</Text>
        
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
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

        {onDelete && (
          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}

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
    marginBottom: 16,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 24,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 6,
    padding: 12,
    minHeight: 80,
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
  deleteButton: {
    backgroundColor: '#ff3b30',
  },
  deleteButtonText: {
    color: '#fff',
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