// components/AnnotationModeModal.tsx
// Edit mode foundation for recipe annotations
// TODO: Full implementation in future session

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

export type ViewMode = 'original' | 'clean' | 'markup';

interface AnnotationModeModalProps {
  visible: boolean;
  currentViewMode: ViewMode;
  onClose: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  recipeId: string;
  userId: string;
}

export default function AnnotationModeModal({
  visible,
  currentViewMode,
  onClose,
  onViewModeChange,
  recipeId,
  userId
}: AnnotationModeModalProps) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, functionalColors), [colors, functionalColors]);

  const [selectedMode, setSelectedMode] = useState<ViewMode>(currentViewMode);

  const handleApply = () => {
    onViewModeChange(selectedMode);
    onClose();
  };

  const handleEnterEditMode = () => {
    Alert.alert(
      'Edit Mode',
      'Full edit functionality coming soon! This will allow you to:\n\n• Edit ingredient quantities\n• Modify instructions\n• Add personal notes\n• Track changes with markup view',
      [{ text: 'OK' }]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Recipe View Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* View Mode Selection */}
            <Text style={styles.sectionTitle}>View Mode</Text>
            <Text style={styles.sectionDescription}>
              Choose how to display recipe edits and annotations
            </Text>

            <TouchableOpacity
              style={[
                styles.modeOption,
                selectedMode === 'original' && styles.modeOptionSelected
              ]}
              onPress={() => setSelectedMode('original')}
            >
              <View style={styles.modeOptionLeft}>
                <Text style={styles.modeOptionTitle}>Original</Text>
                <Text style={styles.modeOptionDesc}>
                  Show recipe exactly as written in cookbook
                </Text>
              </View>
              <View style={[
                styles.radio,
                selectedMode === 'original' && styles.radioSelected
              ]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeOption,
                selectedMode === 'clean' && styles.modeOptionSelected
              ]}
              onPress={() => setSelectedMode('clean')}
            >
              <View style={styles.modeOptionLeft}>
                <Text style={styles.modeOptionTitle}>Clean</Text>
                <Text style={styles.modeOptionDesc}>
                  Show your edited version only (default)
                </Text>
              </View>
              <View style={[
                styles.radio,
                selectedMode === 'clean' && styles.radioSelected
              ]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeOption,
                selectedMode === 'markup' && styles.modeOptionSelected
              ]}
              onPress={() => setSelectedMode('markup')}
            >
              <View style={styles.modeOptionLeft}>
                <Text style={styles.modeOptionTitle}>Markup</Text>
                <Text style={styles.modeOptionDesc}>
                  Show original crossed out with your edits
                </Text>
              </View>
              <View style={[
                styles.radio,
                selectedMode === 'markup' && styles.radioSelected
              ]} />
            </TouchableOpacity>

            {/* Edit Mode Button (Future Feature) */}
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.editModeButton}
              onPress={handleEnterEditMode}
            >
              <Text style={styles.editModeButtonText}>
                ✏️ Enter Edit Mode
              </Text>
              <Text style={styles.comingSoon}>Coming Soon</Text>
            </TouchableOpacity>

            <Text style={styles.editModeDescription}>
              Edit mode will allow you to modify ingredients, instructions, and add personal notes while preserving the original recipe.
            </Text>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: any, functionalColors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text.primary,
    },
    closeButton: {
      padding: 4,
    },
    closeButtonText: {
      fontSize: 24,
      color: colors.text.secondary,
    },
    content: {
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 6,
    },
    sectionDescription: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 16,
    },
    modeOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderWidth: 2,
      borderColor: colors.border.medium,
      borderRadius: 12,
      marginBottom: 12,
    },
    modeOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    modeOptionLeft: {
      flex: 1,
    },
    modeOptionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    modeOptionDesc: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.text.tertiary,
      marginLeft: 12,
    },
    radioSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.medium,
      marginVertical: 24,
    },
    editModeButton: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border.medium,
      borderStyle: 'dashed',
      alignItems: 'center',
      marginBottom: 12,
    },
    editModeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 4,
    },
    comingSoon: {
      fontSize: 12,
      color: colors.text.tertiary,
      fontStyle: 'italic',
    },
    editModeDescription: {
      fontSize: 13,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    applyButton: {
      flex: 1,
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    applyButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.inverse,
    },
  });
}