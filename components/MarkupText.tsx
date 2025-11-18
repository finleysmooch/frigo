// components/MarkupText.tsx
// Displays text with strikethrough original and cursive edit above

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform
} from 'react-native';

interface MarkupTextProps {
  original: string;
  edited: string;
  notes?: string;
  isDeleted?: boolean;
}

export default function MarkupText({
  original,
  edited,
  notes,
  isDeleted = false
}: MarkupTextProps) {
  const [showNotes, setShowNotes] = useState(false);

  const handlePress = () => {
    if (notes) {
      setShowNotes(true);
    }
  };

  if (isDeleted) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          onPress={handlePress}
          disabled={!notes}
        >
          <Text style={styles.deletedText}>{original}</Text>
          {notes && (
            <Text style={styles.tapHint}>Tap to see note</Text>
          )}
        </TouchableOpacity>

        {notes && (
          <Modal
            visible={showNotes}
            transparent
            animationType="fade"
            onRequestClose={() => setShowNotes(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowNotes(false)}
            >
              <View style={styles.notesModal}>
                <Text style={styles.notesLabel}>Note:</Text>
                <Text style={styles.notesText}>{notes}</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowNotes(false)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={!notes}
      >
        <Text style={styles.editedText}>{edited}</Text>
        <Text style={styles.strikethroughText}>{original}</Text>
        {notes && (
          <Text style={styles.tapHint}>Tap to see note</Text>
        )}
      </TouchableOpacity>

      {notes && (
        <Modal
          visible={showNotes}
          transparent
          animationType="fade"
          onRequestClose={() => setShowNotes(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowNotes(false)}
          >
            <View style={styles.notesModal}>
              <Text style={styles.notesLabel}>Note:</Text>
              <Text style={styles.notesText}>{notes}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowNotes(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
  },
  editedText: {
    fontSize: 16,
    fontFamily: Platform.select({
      ios: 'Bradley Hand',
      android: 'cursive',
      default: 'cursive'
    }),
    color: '#007AFF',
    lineHeight: 24,
  },
  strikethroughText: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
    lineHeight: 22,
  },
  deletedText: {
    fontSize: 16,
    color: '#ff3b30',
    textDecorationLine: 'line-through',
    lineHeight: 22,
  },
  tapHint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  closeButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});