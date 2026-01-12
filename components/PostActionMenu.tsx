// components/PostActionMenu.tsx
// Strava-style action menu for posts (triggered by ••• button)

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

interface PostActionMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddMedia: () => void;
  onEditPost: () => void;
  onDeletePost: () => void;
}

export default function PostActionMenu({
  visible,
  onClose,
  onAddMedia,
  onEditPost,
  onDeletePost,
}: PostActionMenuProps) {
  const { colors, functionalColors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'flex-end',
    },
    safeArea: {
      backgroundColor: 'transparent',
    },
    menuContainer: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      paddingBottom: 20,
    },
    menuItem: {
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuItemText: {
      fontSize: 17,
      color: colors.primary,
      textAlign: 'center',
      fontWeight: '400',
    },
    deleteText: {
      color: functionalColors.error,
    },
    cancelButton: {
      marginTop: 8,
      marginHorizontal: 10,
      backgroundColor: colors.background.card,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    cancelText: {
      fontSize: 17,
      color: colors.primary,
      textAlign: 'center',
      fontWeight: '600',
    },
  }), [colors, functionalColors]);

  const handleAction = (action: () => void) => {
    onClose();
    // Small delay to let modal close before action
    setTimeout(action, 300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleAction(onAddMedia)}
            >
              <Text style={styles.menuItemText}>Add Media</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleAction(onEditPost)}
            >
              <Text style={styles.menuItemText}>Edit Activity</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => handleAction(onDeletePost)}
            >
              <Text style={[styles.menuItemText, styles.deleteText]}>
                Delete Activity
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableOpacity>
    </Modal>
  );
}