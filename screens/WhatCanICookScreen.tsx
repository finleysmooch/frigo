// ============================================
// FRIGO — WHAT CAN I COOK SCREEN (Phase 8D-CP4)
// ============================================
// Dedicated surface for the "ready to cook right now" recipe subset — recipes
// passing the D8D-Q3 gate (>=90% pantry match AND all hero ingredients on
// hand). Reachable from RecipeListScreen's "X you can make now" badge and
// PantryScreen's "What can I cook?" CTA.
//
// The gating + load lives in useReadyToCookRecipes; this screen is presentation
// only — search filter, locked chip, list, empty/loading states.
// ============================================

import React, { useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, FlatList, TextInput, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipesStackParamList } from '../App';
import { useTheme } from '../lib/theme/ThemeContext';
import { useActiveSpaceId } from '../contexts/SpaceContext';
import { useReadyToCookRecipes } from '../lib/hooks/useReadyToCookRecipes';
import { RecipeCard, Recipe } from '../components/recipe/RecipeCard';
import { SearchIcon } from '../components/icons';

type Props = NativeStackScreenProps<RecipesStackParamList, 'WhatCanICook'>;

export default function WhatCanICookScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const spaceId = useActiveSpaceId();
  const { readyToCookRecipes, loading, error, refresh } = useReadyToCookRecipes(spaceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const displayed = useMemo(() => {
    if (!searchQuery.trim()) return readyToCookRecipes;
    const q = searchQuery.toLowerCase();
    return readyToCookRecipes.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.hero_ingredients?.some((h) => h.toLowerCase().includes(q))
    );
  }, [readyToCookRecipes, searchQuery]);

  const handleRecipePress = (recipe: Recipe) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <SearchIcon size={18} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ready-to-cook recipes"
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Locked filter chip — TEMPORARY one-off styling. 8E-CP3 (locked filter
          chips pattern) will replace this with the shared component. */}
      <View style={styles.chipRow}>
        <View style={styles.lockedChip}>
          <Text style={styles.lockedChipIcon}>🔒</Text>
          <Text style={styles.lockedChipText}>Pantry: 90%+ match</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Couldn't load recipes — pull to retry.</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              isExpanded={expandedCardId === item.id}
              onToggleExpand={() =>
                setExpandedCardId((cur) => (cur === item.id ? null : item.id))
              }
              onPress={handleRecipePress}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No ready-to-cook recipes match that search.'
                  : "Nothing's quite ready right now."}
              </Text>
              {!searchQuery.trim() && (
                <Text style={styles.emptySubText}>
                  Review your supplies or browse recipes that need a shopping trip.
                </Text>
              )}
            </View>
          }
        />
      )}

      {/*
        FUTURE: Free-form recipe ideas section
        AI-generated suggestions based on the user's pantry contents.
        Will render below the matched-recipes list, separated by a section divider.
        Out of scope for CP4 (Tom's call, 2026-05-19) — architectural reservation only.
        See PHASE_9+ planning.
      */}
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    searchBarWrapper: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background.card,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text.primary,
      padding: 0,
    },
    chipRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    lockedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.background.secondary,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    lockedChipIcon: {
      fontSize: 11,
    },
    lockedChipText: {
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: '600',
    },
    listContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 32,
      flexGrow: 1,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.secondary,
      textAlign: 'center',
    },
    emptySubText: {
      fontSize: 13,
      color: colors.text.tertiary,
      textAlign: 'center',
      marginTop: 6,
    },
  });
}
