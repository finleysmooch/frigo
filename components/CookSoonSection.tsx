// components/CookSoonSection.tsx
// Displays Cook Soon recipes as a tab within MyMealsScreen
// Created: December 10, 2025

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { removeFromCookSoon } from '../lib/services/userRecipeTagsService';

interface CookSoonRecipe {
  id: string;
  title: string;
  image_url?: string;
  chef_name?: string;
  cuisine_types?: string[];
  total_time_min?: number;
  difficulty_level?: string;
  tagged_at?: string;
}

interface CookSoonSectionProps {
  recipes: CookSoonRecipe[];
  loading: boolean;
  currentUserId: string | null;
  onRefresh: () => void;
  onRecipePress: (recipe: CookSoonRecipe) => void;
  onRemove: (recipeId: string) => void;
}

export default function CookSoonSection({
  recipes,
  loading,
  currentUserId,
  onRefresh,
  onRecipePress,
  onRemove,
}: CookSoonSectionProps) {
  const { colors, functionalColors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingVertical: 60,
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 16,
    },
    emptyHint: {
      fontSize: 13,
      color: colors.text.tertiary,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    card: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      overflow: 'hidden',
    },
    cardContent: {
      flexDirection: 'row',
      padding: 12,
    },
    recipeImage: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
    },
    placeholderImage: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderEmoji: {
      fontSize: 32,
    },
    recipeInfo: {
      flex: 1,
      marginLeft: 12,
      justifyContent: 'center',
    },
    recipeTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    chefName: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    cuisine: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 4,
    },
    stat: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    addedDate: {
      fontSize: 11,
      color: colors.border.medium,
    },
    removeButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    removeButtonText: {
      fontSize: 14,
      color: colors.text.tertiary,
      fontWeight: '600',
    },
  }), [colors, functionalColors]);

  const handleRemove = async (recipeId: string) => {
    if (!currentUserId) return;

    try {
      await removeFromCookSoon(currentUserId, recipeId);
      onRemove(recipeId);
    } catch (error) {
      console.error('Error removing from cook soon:', error);
    }
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Added today';
    if (diffDays === 1) return 'Added yesterday';
    if (diffDays < 7) return `Added ${diffDays} days ago`;
    if (diffDays < 30) return `Added ${Math.floor(diffDays / 7)} weeks ago`;
    return `Added ${Math.floor(diffDays / 30)} months ago`;
  };

  const renderRecipeCard = ({ item }: { item: CookSoonRecipe }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onRecipePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.recipeImage} />
        ) : (
          <View style={[styles.recipeImage, styles.placeholderImage]}>
            <Text style={styles.placeholderEmoji}>🍳</Text>
          </View>
        )}

        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle} numberOfLines={2}>{item.title}</Text>

          <View style={styles.metaRow}>
            {item.chef_name && (
              <Text style={styles.chefName} numberOfLines={1}>{item.chef_name}</Text>
            )}
            {item.cuisine_types?.[0] && (
              <Text style={styles.cuisine}> - {item.cuisine_types[0]}</Text>
            )}
          </View>

          <View style={styles.statsRow}>
            {item.total_time_min && (
              <Text style={styles.stat}>{item.total_time_min}m</Text>
            )}
            {item.difficulty_level && (
              <Text style={styles.stat}>{item.difficulty_level}</Text>
            )}
          </View>

          <Text style={styles.addedDate}>{formatTimeAgo(item.tagged_at)}</Text>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemove(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.removeButtonText}>x</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading && recipes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🔥</Text>
        <Text style={styles.emptyTitle}>No Recipes Yet</Text>
        <Text style={styles.emptyText}>
          Save recipes to your "Cook Soon" list when browsing. They'll appear here ready to plan!
        </Text>
        <Text style={styles.emptyHint}>
          Tip: Open a recipe and tap the menu -> "Save to Cook Soon"
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={recipes}
      renderItem={renderRecipeCard}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
