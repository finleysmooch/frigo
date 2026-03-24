// components/cooking/StepNoteInput.tsx
// Inline note input — appears below a step when 📝 is tapped.

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

interface Props {
  stepNumber: number;
  existingText?: string;
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
}

export default function StepNoteInput({ stepNumber, existingText, onSave, onClose }: Props) {
  const [text, setText] = useState(existingText || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handlePlaceholder = (feature: string) => {
    Alert.alert('Coming soon', `${feature} notes will be available in a future update.`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Note for Step {stepNumber}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Jot a note for next time..."
        placeholderTextColor="#cbd5e1"
        multiline
        autoFocus
        textAlignVertical="top"
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.micBtn} onPress={() => handlePlaceholder('Voice')}>
          <Text style={styles.micIcon}>🎙</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, (!text.trim() || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!text.trim() || saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fef9e7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#e8d88c',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b8942d',
  },
  closeBtn: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  input: {
    backgroundColor: '#fffef8',
    borderRadius: 8,
    padding: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#e8d88c',
    marginBottom: 8,
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0eacc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: {
    fontSize: 17,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#b8942d',
    borderRadius: 8,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
});
