// components/AddRecipeModal.tsx
// Modal for choosing how to add a recipe (camera, gallery, or web URL)

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { colors } from '../lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  onSelectWeb: () => void;
}

export function AddRecipeModal({
  visible,
  onClose,
  onSelectCamera,
  onSelectGallery,
  onSelectWeb,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <View style={styles.header}>
                <Text style={styles.title}>Add Recipe</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.options}>
                {/* Camera Option */}
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onClose();
                    onSelectCamera();
                  }}
                >
                  <View style={styles.optionIcon}>
                    <Text style={styles.optionIconText}>📷</Text>
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Take Photo</Text>
                    <Text style={styles.optionDescription}>
                      Capture a recipe from a cookbook or magazine
                    </Text>
                  </View>
                  <Text style={styles.optionArrow}>›</Text>
                </TouchableOpacity>

                {/* Gallery Option */}
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onClose();
                    onSelectGallery();
                  }}
                >
                  <View style={styles.optionIcon}>
                    <Text style={styles.optionIconText}>🖼️</Text>
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Choose from Gallery</Text>
                    <Text style={styles.optionDescription}>
                      Select an existing photo of a recipe
                    </Text>
                  </View>
                  <Text style={styles.optionArrow}>›</Text>
                </TouchableOpacity>

                {/* Web URL Option */}
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onClose();
                    onSelectWeb();
                  }}
                >
                  <View style={styles.optionIcon}>
                    <Text style={styles.optionIconText}>🌐</Text>
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Import from Web</Text>
                    <Text style={styles.optionDescription}>
                      Paste a link from any recipe website
                    </Text>
                  </View>
                  <Text style={styles.optionArrow}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '85%',
    maxWidth: 400,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
    lineHeight: 24,
  },
  options: {
    padding: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 5,
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  optionIconText: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  optionDescription: {
    fontSize: 13,
    color: '#666',
  },
  optionArrow: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 10,
  },
});