import { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator 
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { supabase } from './lib/supabase';

interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  prep_time: number;
  cook_time: number;
}

export default function App() {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [cookingMode, setCookingMode] = useState(false);
  
  // Keep screen awake in cooking mode
  useKeepAwake();

  useEffect(() => {
    loadRecipe();
  }, []);

  const loadRecipe = async () => {
    try {
      // Load our test recipe
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .limit(1)
        .single();
      
      if (error) throw error;
      setRecipe(data);
    } catch (error) {
      console.error('Error loading recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCooking = () => {
    setCookingMode(true);
  };

  const finishCooking = async () => {
    // Create a post to track that we cooked this
    if (recipe) {
      const { error } = await supabase
        .from('posts')
        .insert({
          recipe_id: recipe.id,
          meal_type: 'dinner',
          notes: 'Cooked with Frigo app!'
        });
      
      if (!error) {
        alert('Great job! Meal recorded 👨‍🍳');
      }
    }
    setCookingMode(false);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.centerContainer}>
        <Text>No recipe found. Check your Supabase connection!</Text>
      </View>
    );
  }

  if (cookingMode) {
    // COOKING MODE - Clean, readable interface
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.cookingContainer}>
          <Text style={styles.cookingTitle}>{recipe.title}</Text>
          
          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              Prep: {recipe.prep_time} min | Cook: {recipe.cook_time} min
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ingredient, index) => (
              <Text key={index} style={styles.ingredient}>
                • {ingredient}
              </Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.instructions.map((instruction, index) => (
              <View key={index} style={styles.instructionContainer}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={styles.instruction}>{instruction}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.finishButton} onPress={finishCooking}>
            <Text style={styles.finishButtonText}>Finish Cooking</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // RECIPE PREVIEW MODE
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.previewContainer}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.subtitle}>
          Ready in {(recipe.prep_time_min || 0) + (recipe.cook_time_min || 0)} minutes
        </Text>
        
        <TouchableOpacity style={styles.startButton} onPress={startCooking}>
          <Text style={styles.startButtonText}>Start Cooking</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cookingContainer: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  cookingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
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
  startButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
  },
  startButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
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
