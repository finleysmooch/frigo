// screens/BookViewScreen.tsx
// NEW SCREEN: Browse all recipes from a specific book
// Created: November 11, 2025

import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { Book, RecipeWithBook } from '../lib/types/recipeExtraction';

type Props = NativeStackScreenProps<any, 'BookView'>;

export default function BookViewScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const [book, setBook] = useState<Book | null>(null);
  const [recipes, setRecipes] = useState<RecipeWithBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookData();
  }, [bookId]);

  const loadBookData = async () => {
    try {
      // Fetch book details
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookError) throw bookError;
      setBook(bookData as Book);

      // Fetch all recipes from this book
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select(`
          id,
          title,
          description,
          image_url,
          prep_time_min,
          cook_time_min,
          cuisine_types,
          page_number
        `)
        .eq('book_id', bookId)
        .order('page_number', { ascending: true });

      if (recipesError) throw recipesError;

      setRecipes(recipesData as RecipeWithBook[]);
    } catch (error) {
      console.error('Error loading book:', error);
      Alert.alert('Error', 'Failed to load book details');
    } finally {
      setLoading(false);
    }
  };

  const handleRecipePress = (recipe: RecipeWithBook) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  const handleAddRecipe = () => {
    // Navigate to recipe extraction screen with book pre-selected
    navigation.navigate('AddRecipeFromPhoto', { bookId });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading book...</Text>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Book not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Book Header */}
      <View style={styles.header}>
        {book.cover_image_url && (
          <Image
            source={{ uri: book.cover_image_url }}
            style={styles.coverImage}
          />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.bookTitle}>{book.title}</Text>
          {book.author && (
            <Text style={styles.bookAuthor}>by {book.author}</Text>
          )}
          {book.publisher && book.publication_year && (
            <Text style={styles.bookMeta}>
              {book.publisher} • {book.publication_year}
            </Text>
          )}
          {book.total_pages && (
            <Text style={styles.bookMeta}>{book.total_pages} pages</Text>
          )}
        </View>
      </View>

      {/* Recipe Count */}
      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} from this book
        </Text>
      </View>

      {/* Add Recipe Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddRecipe}
      >
        <Text style={styles.addButtonText}>+ Add Recipe from This Book</Text>
      </TouchableOpacity>

      {/* Recipes List */}
      <View style={styles.recipesContainer}>
        {recipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No recipes from this book yet
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Tap the button above to add your first recipe!
            </Text>
          </View>
        ) : (
          recipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.recipeCard}
              onPress={() => handleRecipePress(recipe)}
            >
              {recipe.image_url && (
                <Image
                  source={{ uri: recipe.image_url }}
                  style={styles.recipeImage}
                />
              )}
              <View style={styles.recipeInfo}>
                <View style={styles.recipeHeader}>
                  <Text style={styles.recipeTitle}>{recipe.title}</Text>
                  {recipe.page_number && (
                    <Text style={styles.recipePage}>p.{recipe.page_number}</Text>
                  )}
                </View>
                
                {recipe.description && (
                  <Text style={styles.recipeDescription} numberOfLines={2}>
                    {recipe.description}
                  </Text>
                )}

                <View style={styles.recipeStats}>
                  {recipe.prep_time_min != null && recipe.cook_time_min != null && (
                    <Text style={styles.recipeStat}>
                      ⏱️ {recipe.prep_time_min + recipe.cook_time_min}m
                    </Text>
                  )}
                  {recipe.cuisine_types && recipe.cuisine_types.length > 0 && (
                    <Text style={styles.recipeStat}>
                      {recipe.cuisine_types[0]}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
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
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  coverImage: {
    width: 150,
    height: 220,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
  },
  headerInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bookAuthor: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  bookMeta: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  countContainer: {
    padding: 20,
    paddingBottom: 12,
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recipesContainer: {
    padding: 20,
    paddingTop: 0,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
  recipeCard: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  recipeImage: {
    width: 100,
    height: 100,
    backgroundColor: '#f0f0f0',
  },
  recipeInfo: {
    flex: 1,
    padding: 12,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  recipePage: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 8,
  },
  recipeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  recipeStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeStat: {
    fontSize: 12,
    color: '#999',
    marginRight: 12,
  },
});