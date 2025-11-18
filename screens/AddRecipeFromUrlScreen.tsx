// screens/AddRecipeFromUrlScreen.tsx
// Screen for adding recipes from web URLs
// Similar flow to AddRecipeFromPhotoScreen but for web scraping

import React, { useState } from 'react';
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
import { saveRecipeToDatabase } from '../lib/services/recipeExtraction/recipeService';
import { saveInstructionSections } from '../lib/services/instructionSectionsService';
import { RecipeReviewScreen } from './RecipeReviewScreen';
import { RecipesStackParamList } from '../App';
import { ProcessedRecipe, ProcessedIngredient  } from '../lib/types/recipeExtraction';
import { colors } from '../lib/theme';

type Props = NativeStackScreenProps<RecipesStackParamList, 'AddRecipeFromUrl'>;

type ExtractionStatus = 
  | 'input' 
  | 'fetching' 
  | 'parsing' 
  | 'matching' 
  | 'reviewing' 
  | 'error';

export function AddRecipeFromUrlScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ExtractionStatus>('input');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [processedRecipe, setProcessedRecipe] = useState<ProcessedRecipe | null>(null);

  // Handle navigation callbacks
  const handleComplete = (recipeId: string) => {
    navigation.navigate('RecipeDetail', { recipe: { id: recipeId } });
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

    // Quick validation
    if (!isLikelyRecipeUrl(fullUrl)) {
      Alert.alert(
        'Not a Recipe URL?',
        'This URL doesn\'t look like a recipe page. Do you want to try anyway?',
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

      // Step 2: Parse with Claude
      setStatus('parsing');
      setStatusMessage('Understanding recipe structure...');

      const extractedData = await parseStandardizedRecipe(standardizedData);

      // Step 3: Match ingredients
      setStatus('matching');
      setStatusMessage('Matching ingredients to database...');

      const ingredientsWithMatches = await matchIngredientsToDatabase(
        extractedData.ingredients
      );

      console.log(`🔍 Matched ${ingredientsWithMatches.filter(i => i.ingredient_id).length}/${ingredientsWithMatches.length} ingredients`);

      // Step 4: Prepare for review
      const processed: ProcessedRecipe = {
        ...extractedData,
        ingredients_with_matches: ingredientsWithMatches,
        book: null, // Web recipes don't have books
        needsOwnershipVerification: false,
      };

      // Step 5: Check for missing ingredients
      const missingIngredients = ingredientsWithMatches.filter(
        (ing) => ing.ingredient_id === null
        );

        if (missingIngredients.length > 0) {
            console.log(`⚠️ Found ${missingIngredients.length} missing ingredients`);
        
            navigation.navigate('MissingIngredients', {
                missingIngredients,
                allIngredients: ingredientsWithMatches,
                onComplete: (updatedIngredients: ProcessedIngredient[]) => {
                const updatedProcessed: ProcessedRecipe = {
                    ...processed,
                    ingredients_with_matches: updatedIngredients,
                };
                setProcessedRecipe(updatedProcessed);
                setStatus('reviewing');
                },
            });
            return;
        }

    // No missing ingredients, proceed to review
      setProcessedRecipe(processed);
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

  // Render review screen
  if (status === 'reviewing' && processedRecipe) {
    return (
      <RecipeReviewScreen
        processedRecipe={processedRecipe}
        bookId={undefined}
        userId={userId}
        onSave={handleComplete}
        onCancel={handleCancel}
      />
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
                placeholderTextColor="#999"
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
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  inputSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
  },
  extractButton: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  extractButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exampleSection: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 10,
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  exampleText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  loadingSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  progressSteps: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 20,
  },
  progressStep: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  progressStepActive: {
    backgroundColor: colors.primary + '20',
  },
  progressStepText: {
    fontSize: 12,
    color: '#666',
  },
  errorSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});