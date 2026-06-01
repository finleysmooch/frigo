// screens/AuthorViewScreen.tsx
// NEW SCREEN: Browse all recipes by a specific chef/author
// Created: November 11, 2025

import { useEffect, useState, useMemo } from 'react';
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
import { useTheme } from '../lib/theme/ThemeContext';
import { Book, RecipeWithBook } from '../lib/types/recipeExtraction';
import { sourceLabel } from '../lib/utils/sourceLabel';
import GlobeIcon from '../components/icons/recipe/GlobeIcon';

type Props = NativeStackScreenProps<any, 'AuthorView'>;

interface Chef {
  id: string;
  name: string;
  bio?: string;
  image_url?: string;
  website?: string;
}

interface RecipeForAuthorView extends RecipeWithBook {
  page_number?: number;
  prep_time_min?: number;
  cook_time_min?: number;
  cuisine_types?: string[];
  source_domain?: string;
}

export default function AuthorViewScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { chefName } = route.params;
  const [chef, setChef] = useState<Chef | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [recipes, setRecipes] = useState<RecipeForAuthorView[]>([]);
  const [loading, setLoading] = useState(true);

  // Web sources this chef's recipes came from (e.g. NYT Cooking), with counts —
  // the "other sources" companion to the Books section.
  const sources = useMemo(() => {
    const counts: Record<string, number> = {};
    recipes.forEach(r => {
      if (r.source_domain) counts[r.source_domain] = (counts[r.source_domain] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [recipes]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.card,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.text.secondary,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    authorImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      marginBottom: 16,
      backgroundColor: colors.border.light,
    },
    headerInfo: {
      flex: 1,
    },
    authorName: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 8,
      color: colors.text.primary,
    },
    authorBio: {
      fontSize: 16,
      color: colors.text.secondary,
      marginBottom: 8,
      lineHeight: 24,
    },
    authorWebsite: {
      fontSize: 14,
      color: colors.primary,
    },
    section: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
      color: colors.text.primary,
    },
    booksScroll: {
      marginHorizontal: -20,
      paddingHorizontal: 20,
    },
    bookCard: {
      width: 140,
      marginRight: 16,
    },
    bookCover: {
      width: 140,
      height: 200,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: colors.border.light,
    },
    bookCoverPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    bookCoverPlaceholderText: {
      fontSize: 48,
    },
    bookCardTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
      color: colors.text.primary,
    },
    bookCardYear: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    sourceChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sourceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: colors.background.card,
    },
    sourceChipText: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '500',
    },
    sourceChipCount: {
      fontSize: 13,
      color: colors.text.tertiary,
    },
    recipesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -8,
    },
    recipeCard: {
      width: '50%',
      paddingHorizontal: 8,
      marginBottom: 16,
    },
    recipeImage: {
      width: '100%',
      height: 140,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: colors.border.light,
    },
    recipeImagePlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    recipeImagePlaceholderText: {
      fontSize: 36,
    },
    recipeCardInfo: {
      flex: 1,
    },
    recipeCardTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
      color: colors.text.primary,
    },
    recipeCardBook: {
      fontSize: 12,
      color: colors.text.secondary,
      marginBottom: 4,
    },
    recipeCardStats: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    recipeCardStat: {
      fontSize: 11,
      color: colors.text.tertiary,
      marginRight: 8,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyStateText: {
      fontSize: 16,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
  }), [colors]);

  useEffect(() => {
    loadAuthorData();
  }, [chefName]);

  const loadAuthorData = async () => {
    try {
      // Fetch chef details
      const { data: chefData, error: chefError } = await supabase
        .from('chefs')
        .select('*')
        .ilike('name', chefName)
        .single();

      if (chefError) {
        console.log('Chef not in database, using name only');
      } else {
        setChef(chefData as Chef);
      }

      // Fetch books by this author
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select('*')
        .ilike('author', `%${chefName}%`)
        .order('publication_year', { ascending: false });

      if (booksError) throw booksError;
      setBooks(booksData as Book[]);

  // Fetch all recipes by this chef (from any book or direct attribution)
        let recipesQuery = supabase
          .from('recipes')
          .select(`
            id,
            title,
            description,
            image_url,
            prep_time_min,
            cook_time_min,
            cuisine_types,
            book_id,
            page_number,
            source_domain,
            book:books (
              title
            )
          `);

        // Build query based on what data we have
        if (chefData?.id) {
          // If we have a chef ID, search by both ID and name
          recipesQuery = recipesQuery.or(`chef_id.eq.${chefData.id},source_author.ilike.%${chefName}%`);
        } else {
          // If no chef ID, search only by name
          recipesQuery = recipesQuery.ilike('source_author', `%${chefName}%`);
        }

        const { data: recipesData, error: recipesError } = await recipesQuery
          .order('created_at', { ascending: false });

        if (recipesError) throw recipesError;

        const formattedRecipes = recipesData.map((r: any) => ({
          ...r,
          book_title: r.book?.title,
        }));

        setRecipes(formattedRecipes as RecipeForAuthorView[]);
      } catch (error) {
        console.error('Error loading author:', error);
        Alert.alert('Error', 'Failed to load author details');
      } finally {
        setLoading(false);
      }
    };

  const handleRecipePress = (recipe: RecipeWithBook) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  const handleBookPress = (book: Book) => {
    navigation.navigate('BookView', { bookId: book.id });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading author...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Author Header */}
      <View style={styles.header}>
        {chef?.image_url && (
          <Image
            source={{ uri: chef.image_url }}
            style={styles.authorImage}
          />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.authorName}>
            {chef?.name || chefName}
          </Text>
          {chef?.bio && (
            <Text style={styles.authorBio}>{chef.bio}</Text>
          )}
          {chef?.website && (
            <Text style={styles.authorWebsite}>{chef.website}</Text>
          )}
        </View>
      </View>

      {/* Books Section */}
      {books.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Books by {chef?.name || chefName}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.booksScroll}
          >
            {books.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={styles.bookCard}
                onPress={() => handleBookPress(book)}
              >
                {book.cover_image_url ? (
                  <Image
                    source={{ uri: book.cover_image_url }}
                    style={styles.bookCover}
                  />
                ) : (
                  <View style={[styles.bookCover, styles.bookCoverPlaceholder]}>
                    <Text style={styles.bookCoverPlaceholderText}>📖</Text>
                  </View>
                )}
                <Text style={styles.bookCardTitle} numberOfLines={2}>
                  {book.title}
                </Text>
                {book.publication_year && (
                  <Text style={styles.bookCardYear}>
                    {book.publication_year}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Sources Section — web sources (e.g. NYT Cooking) this chef's recipes
          came from, alongside Books. Tapping a chip opens SourceView (increment
          ③) filtered to that domain. */}
      {sources.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Other sources
          </Text>
          <View style={styles.sourceChipRow}>
            {sources.map(([domain, count]) => (
              <TouchableOpacity
                key={domain}
                style={styles.sourceChip}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('SourceView', { domain })}
              >
                <GlobeIcon size={15} color={colors.text.secondary} />
                <Text style={styles.sourceChipText}>{sourceLabel(domain) || domain}</Text>
                <Text style={styles.sourceChipCount}>{count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Recipes Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          All Recipes ({recipes.length})
        </Text>
        
        {recipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No recipes from this chef yet
            </Text>
          </View>
        ) : (
          <View style={styles.recipesGrid}>
            {recipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => handleRecipePress(recipe)}
              >
                {recipe.image_url ? (
                  <Image
                    source={{ uri: recipe.image_url }}
                    style={styles.recipeImage}
                  />
                ) : (
                  <View style={[styles.recipeImage, styles.recipeImagePlaceholder]}>
                    <Text style={styles.recipeImagePlaceholderText}>🍽️</Text>
                  </View>
                )}
                <View style={styles.recipeCardInfo}>
                  <Text style={styles.recipeCardTitle} numberOfLines={2}>
                    {recipe.title}
                  </Text>
                  
                  {recipe.book_title && (
                    <Text style={styles.recipeCardBook} numberOfLines={1}>
                      {recipe.book_title}
                      {recipe.page_number && ` • p.${recipe.page_number}`}
                    </Text>
                  )}

                  <View style={styles.recipeCardStats}>
                    {recipe.prep_time_min != null && recipe.cook_time_min != null && (
                      <Text style={styles.recipeCardStat}>
                        ⏱️ {recipe.prep_time_min + recipe.cook_time_min}m
                      </Text>
                    )}
                    {recipe.cuisine_types && recipe.cuisine_types.length > 0 && (
                      <Text style={styles.recipeCardStat}>
                        {recipe.cuisine_types[0]}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}