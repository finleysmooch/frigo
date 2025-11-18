// screens/CookingScreen.tsx
// UPDATED VERSION: November 17, 2025
// Fixed to handle both old (string array) and new (object array) recipe formats
// Added proper error handling and loading states

import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { supabase } from '../lib/supabase';
import PostCreationModal, { PostData } from '../components/PostCreationModal';
import { RecipesStackParamList } from '../App';

type Props = NativeStackScreenProps<RecipesStackParamList, 'Cooking'>;

interface Recipe {
  id: string;
  title: string;
  prep_time_min: number;
  cook_time_min: number;
  ingredients: any[]; // Can be string[] or object[]
  instructions: any[]; // Can be string[] or object[]
}

/**
 * Helper to get instruction text from either format:
 * - String: "Do this..."
 * - Object: { step: 1, instruction: "Do this..." } or { instruction: "Do this..." }
 * 
 * This handles both old recipes (string array) and new recipes from extraction (object array)
 */
function getInstructionText(instruction: any): string {
  if (!instruction) return '';
  
  // If it's already a string, return it
  if (typeof instruction === 'string') {
    return instruction;
  }
  
  // If it's an object with an instruction property, return that
  if (instruction && typeof instruction === 'object' && instruction.instruction) {
    return instruction.instruction;
  }
  
  // Fallback: convert whatever it is to a string
  return String(instruction);
}

/**
 * Helper to get ingredient text from either format:
 * - String: "2 cups flour"
 * - Object: { displayText: "2 cups flour" } or { name: "flour", quantity_amount: 2, quantity_unit: "cups" }
 */
function getIngredientText(ingredient: any): string {
  if (!ingredient) return '';
  
  // If it's already a string, return it
  if (typeof ingredient === 'string') {
    return ingredient;
  }
  
  // If it's an object with displayText, use that
  if (ingredient && typeof ingredient === 'object') {
    if (ingredient.displayText) {
      return ingredient.displayText;
    }
    
    // Or construct from parts
    if (ingredient.name) {
      const parts = [];
      if (ingredient.quantity_amount) {
        parts.push(ingredient.quantity_amount);
      }
      if (ingredient.quantity_unit) {
        parts.push(ingredient.quantity_unit);
      }
      parts.push(ingredient.name);
      if (ingredient.preparation) {
        parts.push(`(${ingredient.preparation})`);
      }
      return parts.join(' ');
    }
  }
  
  // Fallback: convert whatever it is to a string
  return String(ingredient);
}

/**
 * Generate unique key for list items
 * Handles undefined/null items gracefully
 */
function generateKey(item: any, index: number, prefix: string): string {
  if (!item) return `${prefix}-${index}-empty`;
  
  const text = typeof item === 'string' ? item : JSON.stringify(item);
  const snippet = text.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '');
  return `${prefix}-${index}-${snippet}`;
}

export default function CookingScreen({ route, navigation }: Props) {
  const { recipeId } = route.params;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  
  useKeepAwake();

  // Fetch recipe data
  useEffect(() => {
    fetchRecipe();
  }, [recipeId]);

  const fetchRecipe = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, prep_time_min, cook_time_min, ingredients, instructions')
        .eq('id', recipeId)
        .single();

      if (error) throw error;
      
      if (!data) {
        throw new Error('Recipe not found');
      }
      
      // Ensure ingredients and instructions are arrays
      const processedRecipe: Recipe = {
        ...data,
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        instructions: Array.isArray(data.instructions) ? data.instructions : []
      };
      
      setRecipe(processedRecipe);
    } catch (error) {
      console.error('Error fetching recipe:', error);
      Alert.alert('Error', 'Failed to load recipe. Please try again.', [
        {
          text: 'Go Back',
          onPress: () => navigation.goBack()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishCooking = () => {
    setShowPostModal(true);
  };

  const handlePostSubmit = async (postData: PostData) => {
    if (!recipe) return;
    
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('Session:', session ? 'Found' : 'Not found');
      console.log('User:', session?.user?.email);
      
      if (!session || !session.user) {
        console.log('No session, attempting to re-authenticate...');
        
        // Try to sign in again
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: 'tommorley33@gmail.com',
          password: 'EASYpassword123'
        });
        
        if (authError || !authData.user) {
          Alert.alert('Error', 'Please restart the app and try again.');
          console.error('Re-auth failed:', authError);
          return;
        }
        
        console.log('Re-authenticated:', authData.user.email);
      }

      // Get user one more time to be sure
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'Authentication issue. Please restart the app.');
        return;
      }

      console.log('Creating post for user:', user.email);

      const { error, data } = await supabase
        .from('posts')
        .insert({
          recipe_id: recipe.id,
          user_id: user.id,
          meal_type: 'dinner',
          title: postData.title,
          rating: postData.rating,
          modifications: postData.modifications,
          cooking_method: postData.cooking_method,
          notes: postData.modifications
        })
        .select();
      
      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
      
      console.log('Post created successfully:', data);
      
      setShowPostModal(false);
      Alert.alert(
        'Success! 🎉', 
        'Your cooking session has been logged!',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('RecipeList');
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post: ' + (error as any).message);
    }
  };

  const handlePostCancel = () => {
    setShowPostModal(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Recipe not found</Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.cookingContainer}>
        {/* Back button */}
        <TouchableOpacity 
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.cookingTitle}>{recipe.title}</Text>
        
        <View style={styles.timeInfo}>
          <Text style={styles.timeText}>
            Prep: {recipe.prep_time_min || 0} min | Cook: {recipe.cook_time_min || 0} min
          </Text>
        </View>

        {/* Ingredients Section */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ingredient, index) => (
              <Text 
                key={generateKey(ingredient, index, 'ingredient')} 
                style={styles.ingredient}
              >
                • {getIngredientText(ingredient)}
              </Text>
            ))}
          </View>
        )}

        {/* Instructions Section */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.instructions.map((instruction, index) => (
              <View 
                key={generateKey(instruction, index, 'instruction')} 
                style={styles.instructionContainer}
              >
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={styles.instruction}>
                  {getInstructionText(instruction)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity 
          style={styles.finishButton} 
          onPress={handleFinishCooking}
        >
          <Text style={styles.finishButtonText}>Finish Cooking</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Post Creation Modal */}
      <PostCreationModal
        visible={showPostModal}
        recipeTitle={recipe.title}
        onSubmit={handlePostSubmit}
        onCancel={handlePostCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cookingContainer: {
    flex: 1,
    padding: 20,
  },
  headerBackButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  cookingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  timeInfo: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  timeText: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  ingredient: {
    fontSize: 18,
    lineHeight: 28,
    color: '#444',
    marginBottom: 5,
  },
  instructionContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 15,
    width: 25,
  },
  instruction: {
    fontSize: 18,
    lineHeight: 26,
    color: '#444',
    flex: 1,
  },
  finishButton: {
    backgroundColor: '#34C759',
    padding: 20,
    borderRadius: 10,
    marginVertical: 30,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});