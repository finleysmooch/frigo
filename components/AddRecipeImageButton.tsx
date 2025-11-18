// components/AddRecipeImageButton.tsx
// Simple button for adding/updating recipe main image

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  View,
  Image,
} from 'react-native';
import { chooseImageSource, uploadRecipeImage } from '../lib/services/imageStorageService';
import { supabase } from '../lib/supabase';

interface AddRecipeImageButtonProps {
  recipeId: string;
  userId: string;
  currentImageUrl?: string;
  onImageUploaded?: (imageUrl: string) => void;
}

export default function AddRecipeImageButton({
  recipeId,
  userId,
  currentImageUrl,
  onImageUploaded,
}: AddRecipeImageButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(currentImageUrl);

  async function handleAddImage() {
    if (uploading) return;

    try {
      // Let user choose image source
      const uri = await chooseImageSource();
      if (!uri) return;

      setUploading(true);

      // Upload to Supabase Storage
      const result = await uploadRecipeImage(uri, userId);

      // Update recipe in database
      const { error } = await supabase
        .from('recipes')
        .update({ image_url: result.url })
        .eq('id', recipeId);

      if (error) throw error;

      setImageUrl(result.url);
      if (onImageUploaded) {
        onImageUploaded(result.url);
      }

      Alert.alert('Success', 'Recipe image uploaded!');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  if (imageUrl) {
    // Show current image with option to change
    return (
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUrl }} style={styles.image} />
        <TouchableOpacity
          style={styles.changeButton}
          onPress={handleAddImage}
          disabled={uploading}
        >
          <Text style={styles.changeButtonText}>
            {uploading ? 'Uploading...' : 'Change Photo'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show add button
  return (
    <TouchableOpacity
      style={styles.addButton}
      onPress={handleAddImage}
      disabled={uploading}
    >
      {uploading ? (
        <>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.addButtonText}>Uploading...</Text>
        </>
      ) : (
        <>
          <Text style={styles.addIcon}>📷</Text>
          <Text style={styles.addButtonText}>Add Recipe Photo</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    gap: 8,
  },
  addIcon: {
    fontSize: 24,
  },
  addButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  changeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});