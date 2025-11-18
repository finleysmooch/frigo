// components/AddMediaModal.tsx
// Modal for adding photos to posts (like Strava's add media flow)

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { chooseImageSource } from '../lib/services/imageStorageService';

interface Photo {
  uri: string;
  caption?: string;
  order: number;
}

interface AddMediaModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (photos: Photo[]) => Promise<void>;
  existingPhotos?: Array<{ uri: string; caption?: string; order: number }>;
}

export default function AddMediaModal({
  visible,
  onClose,
  onSave,
  existingPhotos = [],
}: AddMediaModalProps) {
  const [photos, setPhotos] = useState<Photo[]>(existingPhotos);
  const [saving, setSaving] = useState(false);
  const [editingCaption, setEditingCaption] = useState<number | null>(null);

  const handleAddPhoto = async () => {
    if (photos.length >= 10) {
      Alert.alert('Maximum Photos', 'You can add up to 10 photos per post.');
      return;
    }

    const uri = await chooseImageSource();
    if (!uri) return;

    const newPhoto: Photo = {
      uri,
      order: photos.length + 1,
    };

    setPhotos([...photos, newPhoto]);
  };

  const handleRemovePhoto = (index: number) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const newPhotos = photos.filter((_, i) => i !== index);
            // Reorder remaining photos
            setPhotos(
              newPhotos.map((photo, i) => ({ ...photo, order: i + 1 }))
            );
          },
        },
      ]
    );
  };

  const handleUpdateCaption = (index: number, caption: string) => {
    const newPhotos = [...photos];
    newPhotos[index].caption = caption;
    setPhotos(newPhotos);
  };

  const handleSave = async () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Please add at least one photo.');
      return;
    }

    setSaving(true);
    try {
      await onSave(photos);
      setPhotos([]);
      setEditingCaption(null);
      onClose();
    } catch (error) {
      console.error('Error saving photos:', error);
      Alert.alert('Error', 'Failed to save photos. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (photos.length > existingPhotos.length) {
      Alert.alert(
        'Discard Changes',
        'You have unsaved photos. Are you sure you want to cancel?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setPhotos(existingPhotos);
              setEditingCaption(null);
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Photos</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            >
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photos Grid */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {photos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No photos added yet. Tap the button below to add photos!
              </Text>
            </View>
          ) : (
            <View style={styles.photosGrid}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoCard}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  
                  {/* Remove button */}
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>

                  {/* Caption input */}
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add a caption (optional)"
                    value={photo.caption || ''}
                    onChangeText={(text) => handleUpdateCaption(index, text)}
                    multiline
                    maxLength={200}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Add Photo Button */}
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={handleAddPhoto}
            disabled={saving}
          >
            <Text style={styles.addPhotoIcon}>📷</Text>
            <Text style={styles.addPhotoText}>
              Add Photo ({photos.length}/10)
            </Text>
          </TouchableOpacity>

          <View style={styles.spacer} />
        </ScrollView>

        {saving && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Uploading photos...</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  photosGrid: {
    padding: 12,
  },
  photoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#f0f0f0',
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  captionInput: {
    padding: 12,
    fontSize: 15,
    color: '#333',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    minHeight: 60,
  },
  addPhotoButton: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 8,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addPhotoIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  addPhotoText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  spacer: {
    height: 40,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
});