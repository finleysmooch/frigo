// screens/CookingScreen.tsx
// Updated: December 3, 2025
// Added: Meal plan integration - links completed dishes to plan items

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
import { completePlanItem } from '../lib/services/mealPlanService';

type Props = NativeStackScreenProps<RecipesStackParamList, 'Cooking'>;

export default function CookingScreen({ route, navigation }: Props) {
  const { recipe, planItemId, mealId, mealTitle } = route.params;
  const [showPostModal, setShowPostModal] = useState(false);
  
  useKeepAwake();

  const handleFinishCooking = () => {
    setShowPostModal(true);
  };

  const handlePostSubmit = async (postData: PostData) => {
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

      // Create the dish post
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
          notes: postData.modifications,
          post_type: 'dish',
          // If cooking for a meal, link to it
          parent_meal_id: mealId || null,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
      
      console.log('Post created successfully:', data);
      const dishId = data.id;

      // If this was from a meal plan, link the dish to the plan item
      if (planItemId && dishId) {
        console.log('Linking dish to meal plan item:', planItemId);
        const linkResult = await completePlanItem(planItemId, user.id, dishId);
        
        if (!linkResult.success) {
          console.warn('Failed to link dish to plan item:', linkResult.error);
          // Still show success - the dish was created, just the linking failed
        }
      }
      
      setShowPostModal(false);

      // Show different alert based on whether this was for a meal plan
      if (planItemId && mealId && mealTitle) {
        // Meal plan flow - offer to view the meal
        Alert.alert(
          'Added to Meal! 🎉',
          `Your dish has been added to "${mealTitle}"`,
          [
            {
              text: 'View Meal',
              onPress: () => {
                // Navigate to the meal detail screen
                // We need to go back first, then navigate to the meal
                // Using reset to avoid deep navigation stack
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'RecipeList' }],
                });
                // Note: Ideally we'd navigate to MealDetail, but that's in a different stack
                // For now, just go back to recipe list. 
                // The user can access the meal from MyMeals or the feed.
                // TODO: Consider cross-stack navigation
              }
            },
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('RecipeList');
              }
            }
          ]
        );
      } else {
        // Regular flow
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
      }
      
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post: ' + (error as any).message);
    }
  };

  const handlePostCancel = () => {
    setShowPostModal(false);
  };

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

        {/* Meal Plan Banner */}
        {mealTitle && (
          <View style={styles.mealBanner}>
            <Text style={styles.mealBannerText}>
              🍽️ Cooking for: {mealTitle}
            </Text>
          </View>
        )}

        <Text style={styles.cookingTitle}>{recipe.title}</Text>
        
        <View style={styles.timeInfo}>
          <Text style={styles.timeText}>
            Prep: {recipe.prep_time_min} min | Cook: {recipe.cook_time_min} min
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {recipe.ingredients?.map((ingredient: string, index: number) => (
            <Text key={index} style={styles.ingredient}>
              • {ingredient}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {recipe.instructions?.map((instruction: string, index: number) => (
            <View key={index} style={styles.instructionContainer}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.instruction}>{instruction}</Text>
            </View>
          ))}
        </View>

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
  mealBanner: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  mealBannerText: {
    fontSize: 15,
    color: '#1E40AF',
    fontWeight: '500',
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