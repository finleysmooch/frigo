// components/MarkupText.tsx
// Displays text with strikethrough original and cursive edit above

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

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
  const { colors, functionalColors } = useTheme();
  const [showNotes, setShowNotes] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
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
      color: colors.primary,
      lineHeight: 24,
    },
    strikethroughText: {
      fontSize: 16,
      color: colors.text.tertiary,
      textDecorationLine: 'line-through',
      lineHeight: 22,
    },
    deletedText: {
      fontSize: 16,
      color: functionalColors.error,
      textDecorationLine: 'line-through',
      lineHeight: 22,
    },
    tapHint: {
      fontSize: 11,
      color: colors.text.tertiary,
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
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 20,
      width: '80%',
      maxWidth: 400,
    },
    notesLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 8,
    },
    notesText: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.text.primary,
    },
    closeButton: {
      marginTop: 16,
      padding: 12,
      backgroundColor: colors.primary,
      borderRadius: 8,
      alignItems: 'center',
    },
    closeButtonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
  }), [colors, functionalColors]);

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