// components/PostActionMenu.tsx
// Strava-style action menu for posts (triggered by ••• button)

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 20,
  },
  menuItem: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 17,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '400',
  },
  deleteText: {
    color: '#FF3B30',
  },
  cancelButton: {
    marginTop: 8,
    marginHorizontal: 10,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelText: {
    fontSize: 17,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
});