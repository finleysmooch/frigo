// screens/AddRecipeFromPhotoScreen.tsx
// Main coordinator screen for recipe extraction flow
// FIXED: Updated to work with React Navigation and handle nullable base64
// UPDATED: Handles book selection fallback

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { extractRecipeFromPhoto } from '../lib/services/recipeExtraction';
import { RecipeExtractionLoadingScreen } from './RecipeExtractionLoadingScreen';
import { BookOwnershipModal } from '../components/BookOwnershipModal';
import { BookSelectionModal } from '../components/BookSelectionModal';
import { RecipeReviewScreen } from './RecipeReviewScreen';
import { RecipesStackParamList } from '../App';

// FIXED: Use navigation props instead of custom Props interface
type Props = NativeStackScreenProps<RecipesStackParamList, 'AddRecipeFromPhoto'>;

export function AddRecipeFromPhotoScreen({ route, navigation }: Props) {
  // FIXED: Get params from route
  const { userId, source } = route.params;
  
  const [state, setState] = useState<any>({
    status: 'idle',
    needsOwnershipVerification: false,
    shouldPromptForBook: false,
    imageUri: null,
  });

  useEffect(() => {
    // Request permissions and capture/pick image
    initializeImageCapture();
  }, []);

  // Handle navigation onComplete and onCancel
  const handleComplete = (recipeId: string) => {
    navigation.navigate('RecipeDetail', { recipe: { id: recipeId } });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  // Image capture logic
  async function initializeImageCapture() {
    try {
      if (source === 'camera') {
        // Request camera permission
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          handleCancel();
          return;
        }

        // Launch camera
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: true,
          allowsEditing: false,
        });

        if (result.canceled) {
          handleCancel();
          return;
        }

        // FIXED: Handle nullable base64
        const base64Data = result.assets[0].base64 || undefined;
        
        // Start extraction with the captured image
        startExtraction({
          uri: result.assets[0].uri,
          base64: base64Data,
        });
      } else {
        // Request media library permission
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Photo library access is required to select photos.');
          handleCancel();
          return;
        }

        // Launch image picker
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: true,
          allowsEditing: false,
        });

        if (result.canceled) {
          handleCancel();
          return;
        }

        // FIXED: Handle nullable base64
        const base64Data = result.assets[0].base64 || undefined;
        
        // Start extraction with the selected image
        startExtraction({
          uri: result.assets[0].uri,
          base64: base64Data,
        });
      }
    } catch (error) {
      console.error('❌ Error capturing image:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
      handleCancel();
    }
  }

  // Start extraction process
  async function startExtraction(imageSource: { uri?: string; base64?: string }) {
    try {
      // Validate that we have base64 data
      if (!imageSource.base64) {
        throw new Error('No image data available. Please try again.');
      }

      setState((prev: any) => ({
        ...prev,
        imageUri: imageSource.uri,
        status: 'processing',
      }));

      await extractRecipeFromPhoto(
        userId,
        imageSource,
        (progress: any) => {
          console.log('📊 Extraction progress:', progress.status);
          setState((prev: any) => ({ ...prev, ...progress }));
        }
      );
    } catch (error: any) {
      console.error('❌ Extraction error:', error);
      setState({ 
        status: 'error', 
        error: error?.message || 'Unknown error', 
        needsOwnershipVerification: false,
        shouldPromptForBook: false,
      });
    }
  }

  // Handle book selection from manual selection modal
  async function handleBookSelected(bookId: string) {
    console.log('✅ User selected book:', bookId);
    setState({
      ...state,
      shouldPromptForBook: false,
      book: { id: bookId } as any,
      needsOwnershipVerification: false,
    });
  }

  // Handle skipping book selection
  function handleSkipBookSelection() {
    console.log('⏭️ User skipped book selection');
    setState({
      ...state,
      shouldPromptForBook: false,
      book: undefined,
      needsOwnershipVerification: false,
    });
  }

  // Loading state
  if (state.status === 'processing' && state.imageUri) {
    return <RecipeExtractionLoadingScreen imageUri={state.imageUri} />;
  }

  // Show book selection modal if no book detected
  if (state.status === 'reviewing' && state.shouldPromptForBook && !state.book) {
    return (
      <BookSelectionModal
        visible={true}
        userId={userId}
        onBookSelected={handleBookSelected}
        onSkip={handleSkipBookSelection}
        onCancel={handleCancel}
      />
    );
  }

  // Show ownership modal if book detected but not owned
  if (
    state.status === 'reviewing' &&
    state.needsOwnershipVerification &&
    state.book &&
    !state.shouldPromptForBook
  ) {
    return (
      <BookOwnershipModal
        visible={true}
        book={state.book}
        userId={userId}
        onComplete={() => {
          console.log('✅ Ownership verification complete');
          setState({ ...state, needsOwnershipVerification: false });
        }}
        onCancel={handleCancel}
      />
    );
  }

  // Show review screen
  if (state.status === 'reviewing' && state.processedData) {
    return (
      <RecipeReviewScreen
        processedRecipe={state.processedData}
        bookId={state.book?.id}
        userId={userId}
        onSave={handleComplete}
        onCancel={handleCancel}
      />
    );
  }

  // Error state
  if (state.status === 'error') {
    Alert.alert(
      'Extraction Failed',
      state.error || 'An unknown error occurred',
      [
        {
          text: 'Try Again',
          onPress: () => initializeImageCapture(),
        },
        {
          text: 'Cancel',
          onPress: handleCancel,
          style: 'cancel',
        },
      ]
    );
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Default loading state
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});