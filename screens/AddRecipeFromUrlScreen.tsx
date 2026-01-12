// screens/AddRecipeFromUrlScreen.tsx
// Screen for adding recipes from web URLs
// UPDATED: Fixed navigation issue (no more modal overlay), improved URL validation
// Date: November 19, 2025

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { extractRecipeFromUrl, isLikelyRecipeUrl, getDomainFromUrl } from '../lib/services/recipeExtraction/webExtractor';
import { parseStandardizedRecipe } from '../lib/services/recipeExtraction/unifiedParser';
import { matchIngredientsToDatabase } from '../lib/services/recipeExtraction/ingredientMatcher';
import { RecipesStackParamList } from '../App';
import { ProcessedRecipe, ProcessedIngredient  } from '../lib/types/recipeExtraction';
import { useTheme } from '../lib/theme/ThemeContext';

type Props = NativeStackScreenProps<RecipesStackParamList, 'AddRecipeFromUrl'>;

type ExtractionStatus = 
  | 'input' 
  | 'fetching' 
  | 'parsing' 
  | 'matching' 
  | 'reviewing' 
  | 'error';

export function AddRecipeFromUrlScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { userId } = route.params;

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ExtractionStatus>('input');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [processedRecipe, setProcessedRecipe] = useState<ProcessedRecipe | null>(null);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 30,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButtonText: {
      fontSize: 24,
      color: colors.text.primary,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text.primary,
    },
    inputSection: {
      marginBottom: 30,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 5,
    },
    hint: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 15,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      padding: 15,
      fontSize: 16,
      marginBottom: 15,
      color: colors.text.primary,
      backgroundColor: colors.background.card,
    },
    extractButton: {
      backgroundColor: colors.primary,
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
    },
    extractButtonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
    exampleSection: {
      backgroundColor: colors.background.secondary,
      padding: 15,
      borderRadius: 8,
    },
    exampleTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 10,
    },
    exampleText: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 24,
    },
    loadingSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 50,
    },
    loadingText: {
      marginTop: 20,
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    progressSteps: {
      flexDirection: 'row',
      marginTop: 30,
      gap: 10,
    },
    progressStep: {
      backgroundColor: colors.background.secondary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    progressStepActive: {
      backgroundColor: colors.primary,
    },
    progressStepText: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    errorSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 50,
    },
    errorIcon: {
      fontSize: 48,
      marginBottom: 20,
    },
    errorText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: 20,
      paddingHorizontal: 20,
    },
    retryButton: {
      backgroundColor: colors.primary,
      padding: 15,
      borderRadius: 8,
      paddingHorizontal: 30,
    },
    retryButtonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
  }), [colors]);

  // Handle navigation callbacks
  const handleComplete = (recipeId: string) => {
    // FIXED: Use replace instead of navigate to avoid modal stacking
    navigation.replace('RecipeDetail', { recipe: { id: recipeId } });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  // Start extraction process
  async function startExtraction() {
    if (!url.trim()) {
      Alert.alert('Missing URL', 'Please enter a recipe URL');
      return;
    }

    // Add https:// if missing
    let fullUrl = url.trim();
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = 'https://' + fullUrl;
    }

    // IMPROVED: More lenient URL validation
    const urlValidation = validateRecipeUrl(fullUrl);
    
    if (!urlValidation.isValid) {
      Alert.alert(
        'Invalid URL',
        urlValidation.message,
        [{ text: 'OK' }]
      );
      return;
    }

    // Only warn if URL looks suspicious (but still allow trying)
    if (urlValidation.warning) {
      Alert.alert(
        'Not a Recipe URL?',
        urlValidation.warning + ' Do you want to try anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Anyway', onPress: () => extractFromUrl(fullUrl) },
        ]
      );
      return;
    }

    await extractFromUrl(fullUrl);
  }

  async function extractFromUrl(fullUrl: string) {
    try {
      // Step 1: Fetch and scrape
      setStatus('fetching');
      setStatusMessage(`Fetching recipe from ${getDomainFromUrl(fullUrl)}...`);
      setError('');

      const standardizedData = await extractRecipeFromUrl(fullUrl);

      console.log('✅ Standardized data received');
      console.log('Author:', standardizedData.source.author || 'none');
      console.log('Description:', standardizedData.rawText.description || 'none');
      console.log('Image:', standardizedData.rawText.imageUrl || 'none');
      console.log('Notes:', standardizedData.rawText.notes || 'none');
      console.log('Swaps:', standardizedData.rawText.ingredientSwaps || 'none');

      // Step 2: Parse with Claude
      setStatus('parsing');
      setStatusMessage('Understanding recipe structure...');

      const extractedData = await parseStandardizedRecipe(standardizedData);

      console.log('📦 Extracted data received');
      console.log('Recipe title:', extractedData.recipe.title);
      console.log('Recipe author:', extractedData.recipe.source_author || 'none');
      console.log('Recipe description:', extractedData.recipe.description || 'none');
      console.log('Recipe image:', extractedData.recipe.image_url || 'none');
      console.log('Prep time:', extractedData.recipe.prep_time_min || 'none');
      console.log('Cook time:', extractedData.recipe.cook_time_min || 'none');
      console.log('Ingredients count:', extractedData.ingredients?.length || 0);
      console.log('Instruction sections:', extractedData.instruction_sections?.length || 0);
      console.log('Raw extraction data:', extractedData.raw_extraction_data ? 'YES' : 'NO');
      
      // Step 3: Match ingredients
      setStatus('matching');
      setStatusMessage('Matching ingredients to database...');

      const ingredientsWithMatches = await matchIngredientsToDatabase(extractedData);

      console.log(`🔍 Matched ${ingredientsWithMatches.ingredients_with_matches.filter(i => i.ingredient_id).length}/${ingredientsWithMatches.ingredients_with_matches.length} ingredients`);
      
      // Step 4: Check for missing ingredients
      const missingIngredients = ingredientsWithMatches.ingredients_with_matches.filter(
        (ing) => ing.ingredient_id === null
      );

      if (missingIngredients.length > 0) {
        console.log(`⚠️ Found ${missingIngredients.length} missing ingredients`);
        
        navigation.navigate('MissingIngredients', {
          missingIngredients,
          allIngredients: ingredientsWithMatches.ingredients_with_matches,
          onComplete: (updatedIngredients: ProcessedIngredient[]) => {
            const updatedProcessed: ProcessedRecipe = {
              ...ingredientsWithMatches,
              ingredients_with_matches: updatedIngredients,
            };
            setProcessedRecipe(updatedProcessed);
            setStatus('reviewing');
          },
        });
        return;
      }

      // No missing ingredients, proceed to review
      console.log('🎯 Final processed recipe ready');
      console.log('Has instruction_sections:', !!ingredientsWithMatches.instruction_sections);
      console.log('Has raw_extraction_data:', !!ingredientsWithMatches.raw_extraction_data);

      setProcessedRecipe(ingredientsWithMatches);
      setStatus('reviewing');

    } catch (error: any) {
      console.error('❌ Web extraction error:', error);
      setStatus('error');
      setError(error.message || 'Failed to extract recipe from URL');
      
      Alert.alert(
        'Extraction Failed',
        error.message || 'Could not extract recipe from this URL. Please make sure it\'s a valid recipe page.',
        [
          { text: 'Try Different URL', onPress: () => setStatus('input') },
          { text: 'Cancel', onPress: handleCancel, style: 'cancel' },
        ]
      );
    }
  }

  // FIXED: Navigate to RecipeReview when status changes
  // useEffect must be at component top level, before any returns
  useEffect(() => {
    if (status === 'reviewing' && processedRecipe) {
      console.log('📋 Navigating to RecipeReview screen');
      navigation.navigate('RecipeReview', {
        processedRecipe,
        bookId: undefined,
        userId,
      });
      // Reset status to prevent re-navigation
      setStatus('input');
    }
  }, [status, processedRecipe]);

  // Show loading while preparing review
  if (status === 'reviewing' && processedRecipe) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing review...</Text>
      </View>
    );
  }

  // Render main input/loading screen
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
            <Text style={styles.backButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Recipe from Web</Text>
          <View style={styles.backButton} />
        </View>

        {/* Input Section */}
        {status === 'input' && (
          <>
            <View style={styles.inputSection}>
              <Text style={styles.label}>Recipe URL</Text>
              <Text style={styles.hint}>
                Paste a link from any recipe website
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder="https://example.com/recipe/..."
                placeholderTextColor={colors.text.tertiary}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={startExtraction}
              />

              <TouchableOpacity 
                style={styles.extractButton}
                onPress={startExtraction}
              >
                <Text style={styles.extractButtonText}>Extract Recipe</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.exampleSection}>
              <Text style={styles.exampleTitle}>📌 Works with popular sites:</Text>
              <Text style={styles.exampleText}>
                • AllRecipes{'\n'}
                • Food Network{'\n'}
                • Bon Appétit{'\n'}
                • NYT Cooking{'\n'}
                • Serious Eats{'\n'}
                • Ambitious Kitchen{'\n'}
                • And many more!
              </Text>
            </View>
          </>
        )}

        {/* Loading Section */}
        {(status === 'fetching' || status === 'parsing' || status === 'matching') && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{statusMessage}</Text>
            
            <View style={styles.progressSteps}>
              <View style={[styles.progressStep, status === 'fetching' && styles.progressStepActive]}>
                <Text style={styles.progressStepText}>1. Fetching</Text>
              </View>
              <View style={[styles.progressStep, status === 'parsing' && styles.progressStepActive]}>
                <Text style={styles.progressStepText}>2. Parsing</Text>
              </View>
              <View style={[styles.progressStep, status === 'matching' && styles.progressStepActive]}>
                <Text style={styles.progressStepText}>3. Matching</Text>
              </View>
            </View>
          </View>
        )}

        {/* Error Section */}
        {status === 'error' && (
          <View style={styles.errorSection}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => setStatus('input')}
            >
              <Text style={styles.retryButtonText}>Try Another URL</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Improved URL validation
 * Returns more lenient validation with warnings instead of hard blocks
 */
function validateRecipeUrl(url: string): { isValid: boolean; message?: string; warning?: string } {
  // Basic URL format check
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, message: 'URL must start with http:// or https://' };
    }
  } catch {
    return { isValid: false, message: 'Invalid URL format' };
  }

  const lowerUrl = url.toLowerCase();

  // Hard blocks (definitely not recipes)
  const blockedPatterns = [
    'youtube.com', 'youtu.be', // Video sites
    'instagram.com', 'tiktok.com', // Social media (for now)
    'pinterest.com', // Usually links to other sites
    'google.com', 'bing.com', // Search engines
  ];

  for (const pattern of blockedPatterns) {
    if (lowerUrl.includes(pattern)) {
      return { 
        isValid: false, 
        message: `Cannot extract recipes from ${pattern}. Please use the direct recipe website.` 
      };
    }
  }

  // Soft warnings (might be recipes but look unusual)
  const recipeIndicators = [
    '/recipe/', '/recipes/', 'recipe?', 'recipes?', '-recipe', 'recipe-',
    '/cook/', '/cooking/', '/food/', '/dish/', '/meal/',
  ];

  const hasRecipeIndicator = recipeIndicators.some(indicator => lowerUrl.includes(indicator));

  if (!hasRecipeIndicator) {
    return {
      isValid: true,
      warning: 'This URL doesn\'t look like a typical recipe page.'
    };
  }

  return { isValid: true };
}