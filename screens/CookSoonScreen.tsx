// screens/CookSoonScreen.tsx
// Screen showing recipes the user has saved to cook soon
// Created: December 10, 2025
// Updated: December 12, 2025 - Fixed property names to match updated service

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import {
  getRecipesWithTag,
  removeFromCookSoon,
  TaggedRecipe,
} from '../lib/services/userRecipeTagsService';

interface CookSoonScreenProps {
  navigation: any;
}

export default function CookSoonScreen({ navigation }: CookSoonScreenProps) {
  const [recipes, setRecipes] = useState<TaggedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        loadRecipes();
      }
    }, [currentUserId])
  );

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      loadRecipes(user.id);
    }
  };

  const loadRecipes = async (userId?: string) => {
    const uid = userId || currentUserId;
    if (!uid) return;

    try {
      const data = await getRecipesWithTag(uid, 'cook_soon');
      setRecipes(data);
    } catch (error) {
      console.error('Error loading cook soon recipes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRecipes();
  };

  const handleRemoveRecipe = async (recipeId: string, recipeTitle: string) => {
    Alert.alert(
      'Remove Recipe',
      `Remove "${recipeTitle}" from your Cook Soon list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;
            
            const result = await removeFromCookSoon(currentUserId, recipeId);
            if (result.success) {
              // Updated: use 'id' not 'recipe_id'
              setRecipes(prev => prev.filter(r => r.id !== recipeId));
            } else {
              Alert.alert('Error', 'Failed to remove recipe');
            }
          },
        },
      ]
    );
  };

  const handleRecipePress = (recipe: TaggedRecipe) => {
    navigation.navigate('RecipeDetail', {
      recipe: {
        id: recipe.id,
        title: recipe.title,
        image_url: recipe.image_url,
      },
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderRecipeItem = ({ item }: { item: TaggedRecipe }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => handleRecipePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.recipeImageContainer}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.recipeImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.recipeImagePlaceholder}>
            <Text style={styles.recipeImagePlaceholderText}>🍳</Text>
          </View>
        )}
      </View>
      
      <View style={styles.recipeInfo}>
        <Text style={styles.recipeTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.chef_name && (
          <Text style={styles.recipeMeta}>{item.chef_name}</Text>
        )}
        {item.recipe_type && (
          <Text style={styles.recipeType}>{item.recipe_type}</Text>
        )}
        <Text style={styles.addedDate}>Added {formatDate(item.tagged_at)}</Text>
      </View>
      
      <View style={styles.recipeActions}>
        <TouchableOpacity
          style={styles.cookButton}
          onPress={() => {
            // Navigate to recipe with intent to cook
            navigation.navigate('RecipeDetail', {
              recipe: {
                id: item.id,
                title: item.title,
                image_url: item.image_url,
              },
            });
          }}
        >
          <Text style={styles.cookButtonText}>Cook</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveRecipe(item.id, item.title)}
        >
          <Text style={styles.removeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔥 Cook Soon</Text>
        <View style={{ width: 60 }} />
      </View>

      {recipes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔥</Text>
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptyText}>
            When you find a recipe you want to cook soon, tap the "Add to Meal Plan" button and select "Save to Cook Soon"
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate('RecipeList')}
          >
            <Text style={styles.browseButtonText}>Browse Recipes</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipeItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} to cook
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 60,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  listContent: {
    padding: 16,
  },
  listHeader: {
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 14,
    color: '#6B7280',
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recipeImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
  },
  recipeImagePlaceholderText: {
    fontSize: 28,
  },
  recipeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    lineHeight: 20,
  },
  recipeMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  recipeType: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  addedDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  recipeActions: {
    alignItems: 'center',
    gap: 8,
  },
  cookButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cookButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  separator: {
    height: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});