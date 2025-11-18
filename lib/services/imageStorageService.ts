// lib/services/imageStorageService.ts
// Service for uploading images to Supabase Storage
// FIXED: Removed aspect ratio forcing to preserve natural image dimensions
// Updated: November 16, 2025

import { supabase } from '../supabase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';

export interface ImageUploadResult {
  url: string;
  path: string;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  
  if (status !== 'granted') {
    Alert.alert(
      'Camera Permission Required',
      'Please enable camera access in your device settings to take photos.'
    );
    return false;
  }
  
  return true;
}

/**
 * Request photo library permissions
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (status !== 'granted') {
    Alert.alert(
      'Photo Library Permission Required',
      'Please enable photo library access in your device settings.'
    );
    return false;
  }
  
  return true;
}

/**
 * Launch camera to take a photo
 * FIXED: Removed allowsEditing and aspect to preserve natural dimensions
 */
export async function takePicture(): Promise<string | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // FIXED: Don't force editing/cropping
      quality: 0.8,
    });

    if (result.canceled) return null;
    return result.assets[0].uri;
  } catch (error) {
    console.error('Error taking picture:', error);
    Alert.alert('Error', 'Failed to take picture. Please try again.');
    return null;
  }
}

/**
 * Pick image from photo library
 * FIXED: Removed allowsEditing and aspect to preserve natural dimensions
 */
export async function pickImage(): Promise<string | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // FIXED: Don't force editing/cropping
      quality: 0.8,
    });

    if (result.canceled) return null;
    return result.assets[0].uri;
  } catch (error) {
    console.error('Error picking image:', error);
    Alert.alert('Error', 'Failed to select image. Please try again.');
    return null;
  }
}

/**
 * Show action sheet to choose between camera or photo library
 */
export async function chooseImageSource(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Choose Photo',
      'Select a photo from your library or take a new one',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const uri = await takePicture();
            resolve(uri);
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const uri = await pickImage();
            resolve(uri);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ]
    );
  });
}

/**
 * Compress and resize image for upload
 * Max width: 1600px, quality: 0.8
 * Maintains original aspect ratio
 */
async function processImage(uri: string): Promise<string> {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }], // Maintains aspect ratio
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (error) {
    console.error('Error processing image:', error);
    return uri; // Return original if processing fails
  }
}

/**
 * Upload image to Supabase Storage
 * @param imageUri - Local image URI
 * @param bucket - Storage bucket name ('recipe-images' or 'post-images')
 * @param folder - Optional folder within bucket (e.g., userId)
 */
export async function uploadImage(
  imageUri: string,
  bucket: 'recipe-images' | 'post-images',
  folder?: string
): Promise<ImageUploadResult> {
  try {
    // Process image (compress/resize)
    const processedUri = await processImage(imageUri);

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const filename = `${timestamp}_${randomString}.jpg`;
    
    // Build storage path
    const storagePath = folder ? `${folder}/${filename}` : filename;

    // Fetch image data
    const response = await fetch(processedUri);
    const blob = await response.blob();

    // Convert blob to ArrayBuffer
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return {
      url: urlData.publicUrl,
      path: storagePath,
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImage(
  bucket: 'recipe-images' | 'post-images',
  path: string
): Promise<void> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      console.error('Delete error:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

/**
 * Upload recipe image
 * Convenience function that uploads to recipe-images bucket
 */
export async function uploadRecipeImage(
  imageUri: string,
  userId: string
): Promise<ImageUploadResult> {
  return uploadImage(imageUri, 'recipe-images', userId);
}

/**
 * Upload post image
 * Convenience function that uploads to post-images bucket
 */
export async function uploadPostImage(
  imageUri: string,
  userId: string
): Promise<ImageUploadResult> {
  return uploadImage(imageUri, 'post-images', userId);
}

/**
 * Upload multiple images for a post
 */
export async function uploadPostImages(
  imageUris: string[],
  userId: string
): Promise<Array<{ url: string; caption?: string; order: number }>> {
  const uploadPromises = imageUris.map(async (uri, index) => {
    const result = await uploadPostImage(uri, userId);
    return {
      url: result.url,
      order: index + 1,
    };
  });

  return Promise.all(uploadPromises);
}