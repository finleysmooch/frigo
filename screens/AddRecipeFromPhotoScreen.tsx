// screens/AddRecipeFromPhotoScreen.tsx
// Main coordinator screen for recipe extraction flow
// FIXED: Navigate to RecipeReview screen instead of rendering directly
// FIXED: Updated deprecated MediaTypeOptions
// FIXED: Added delay to prevent camera hang on navigation
// Date: December 2, 2025

import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { extractRecipeFromPhoto } from '../lib/services/recipeExtraction';
import { RecipeExtractionLoadingScreen } from './RecipeExtractionLoadingScreen';
import { BookOwnershipModal } from '../components/BookOwnershipModal';
import { BookSelectionModal } from '../components/BookSelectionModal';
import { RecipesStackParamList } from '../App';

type Props = NativeStackScreenProps<RecipesStackParamList, 'AddRecipeFromPhoto'>;

export function AddRecipeFromPhotoScreen({ route, navigation }: Props) {
  const { userId, source } = route.params;
  
  const [state, setState] = useState<any>({
    status: 'idle',
    needsOwnershipVerification: false,
    shouldPromptForBook: false,
    imageUri: null,
    processedData: null,
    book: null,
  });

  // Prevent double initialization
  const isInitializing = useRef(false);
  // Prevent double navigation
  const hasNavigatedToReview = useRef(false);

  useEffect(() => {
    if (isInitializing.current) {
      console.log('🔍 0. Already initializing, skipping...');
      return;
    }
    isInitializing.current = true;
    console.log('🔍 0. Starting initialization...');
    
    // Delay to prevent camera hang during navigation animation
    const timer = setTimeout(() => {
      console.log('🔍 0.5. Timeout complete, calling initializeImageCapture...');
      initializeImageCapture();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Navigate to review screen when ready
  useEffect(() => {
    if (
      state.status === 'reviewing' &&
      state.processedData &&
      !state.shouldPromptForBook &&
      !state.needsOwnershipVerification &&
      !hasNavigatedToReview.current
    ) {
      console.log('📋 Navigating to RecipeReview screen...');
      hasNavigatedToReview.current = true;
      
      navigation.replace('RecipeReview', {
        processedRecipe: state.processedData,
        bookId: state.book?.id,
        userId,
      });
    }
  }, [state.status, state.processedData, state.shouldPromptForBook, state.needsOwnershipVerification]);

  const handleCancel = () => {
    navigation.goBack();
  };

  // Image capture logic
  async function initializeImageCapture() {
    console.log('🔍 1. initializeImageCapture started');
    console.log('🔍 2. source:', source);
    console.log('🔍 3. userId:', userId);
    
    try {
      if (source === 'camera') {
        console.log('🔍 4. Requesting camera permission...');
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        console.log('🔍 5. Permission status:', status);
        
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          handleCancel();
          return;
        }

        console.log('🔍 6. Launching camera...');
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
          base64: true,
          allowsEditing: false,
        });
        console.log('🔍 7. Camera result:', result.canceled ? 'canceled' : 'got image');

        if (result.canceled) {
          handleCancel();
          return;
        }

        const base64Data = result.assets[0].base64 || undefined;
        console.log('🔍 8. Got base64:', base64Data ? 'yes' : 'no');
        
        console.log('🔍 9. Calling startExtraction...');
        startExtraction({
          uri: result.assets[0].uri,
          base64: base64Data,
        });
      } else {
        console.log('🔍 4b. Requesting media library permission...');
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('🔍 5b. Permission status:', status);
        
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Photo library access is required to select photos.');
          handleCancel();
          return;
        }

        console.log('🔍 6b. Launching image picker...');
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
          allowsEditing: false,
        });
        console.log('🔍 7b. Picker result:', result.canceled ? 'canceled' : 'got image');

        if (result.canceled) {
          handleCancel();
          return;
        }

        const base64Data = result.assets[0].base64 || undefined;
        console.log('🔍 8b. Got base64:', base64Data ? 'yes' : 'no');
        
        console.log('🔍 9b. Calling startExtraction...');
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
  function handleBookSelected(bookId: string) {
    console.log('✅ User selected book:', bookId);
    setState((prev: any) => ({
      ...prev,
      shouldPromptForBook: false,
      book: { id: bookId },
      needsOwnershipVerification: false,
    }));
  }

  // Handle skipping book selection
  function handleSkipBookSelection() {
    console.log('⏭️ User skipped book selection');
    setState((prev: any) => ({
      ...prev,
      shouldPromptForBook: false,
      book: undefined,
      needsOwnershipVerification: false,
    }));
  }

  // Handle ownership verification complete
  function handleOwnershipComplete() {
    console.log('✅ Ownership verification complete');
    setState((prev: any) => ({
      ...prev,
      needsOwnershipVerification: false,
    }));
  }

  // DEBUG: Log state on each render
  console.log('🔍 Current state:', {
    status: state.status,
    hasProcessedData: !!state.processedData,
    shouldPromptForBook: state.shouldPromptForBook,
    needsOwnershipVerification: state.needsOwnershipVerification,
    hasBook: !!state.book,
  });

  // Loading/processing state
  if ((state.status === 'processing' || state.status === 'processing_image' || 
       state.status === 'extracting' || state.status === 'matching_ingredients' ||
       state.status === 'checking_book') && state.imageUri) {
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
        onComplete={handleOwnershipComplete}
        onCancel={handleCancel}
      />
    );
  }

  // Error state
  if (state.status === 'error') {
    // Show alert only once
    Alert.alert(
      'Extraction Failed',
      state.error || 'An unknown error occurred',
      [
        {
          text: 'Try Again',
          onPress: () => {
            isInitializing.current = false;
            initializeImageCapture();
          },
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

  // Default loading state (idle, waiting for navigation, etc.)
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