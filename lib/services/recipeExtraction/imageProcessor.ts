// services/recipeExtraction/imageProcessor.ts
// Handle image capture, selection, and processing for API

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert, Platform } from 'react-native';

/**
 * Request camera permissions from user
 */
export async function requestCameraPermissions(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Frigo needs camera access to add recipes from photos. Please enable camera access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              if (Platform.OS === 'ios') {
                // Linking.openURL('app-settings:');
              }
            }
          }
        ]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting camera permissions:', error);
    return false;
  }
}

/**
 * Request photo library permissions from user
 */
export async function requestGalleryPermissions(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Frigo needs access to your photo library to select recipe photos. Please enable photo library access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              if (Platform.OS === 'ios') {
                // Linking.openURL('app-settings:');
              }
            }
          }
        ]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting gallery permissions:', error);
    return false;
  }
}

/**
 * Launch camera to take a photo of recipe
 */
export async function pickImageFromCamera(): Promise<string | null> {
  try {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4], // Portrait aspect for cookbook pages
      quality: 0.8, // Good balance of quality and file size
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error('Error launching camera:', error);
    Alert.alert('Error', 'Failed to launch camera. Please try again.');
    return null;
  }
}

/**
 * Open photo library to select existing recipe photo
 */
export async function pickImageFromGallery(): Promise<string | null> {
  try {
    const hasPermission = await requestGalleryPermissions();
    if (!hasPermission) {
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error('Error launching gallery:', error);
    Alert.alert('Error', 'Failed to open photo library. Please try again.');
    return null;
  }
}

/**
 * Process image for API: resize, compress, convert to base64
 * Optimizes image size to reduce upload time and API costs
 */
export async function processImageForAPI(
  imageUri: string
): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  try {
    // Resize if too large (max 1600px width for good OCR while keeping file small)
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1600 } }], // Maintains aspect ratio
      { 
        compress: 0.8, // 80% quality - good balance
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );

    // Convert to base64 for API transmission
    const response = await fetch(manipResult.uri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    // Remove data URL prefix (data:image/jpeg;base64,)
    const base64Data = base64.split(',')[1];

    return {
      base64: base64Data,
      mediaType: 'image/jpeg',
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image for extraction');
  }
}

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Calculate hash of image for deduplication in logs
 * Simple hash - just use first 32 chars of base64
 */
export function getImageHash(base64: string): string {
  return base64.substring(0, 32);
}