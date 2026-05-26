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

// 8R-UX1: match-threshold selector. Each option is a minimum pantry_match
// percentage; "Any" shows everything sorted by match desc. The default
// preserves the original strict gate (>=90%) so users used to that surface
// still see the same set first.
const THRESHOLD_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0.9, label: '90%+' },
  { value: 0.75, label: '75%+' },
  { value: 0.5, label: '50%+' },
  { value: 0, label: 'Any' },
];

export default function WhatCanICookScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const spaceId = useActiveSpaceId();
  const { allRecipesWithMatch, loading, error, refresh } =
    useReadyToCookRecipes(spaceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [threshold, setThreshold] = useState<number>(0.9);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // 8R-UX1: filter by threshold, then by search query. allRecipesWithMatch
  // arrives sorted by pantry_match DESC from the hook, so no re-sort needed.
  const displayed = useMemo(() => {
    const above = allRecipesWithMatch.filter(
      (r) => (r.pantry_match ?? 0) >= threshold
    );
    if (!searchQuery.trim()) return above;
    const q = searchQuery.toLowerCase();
    return above.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.hero_ingredients?.some((h) => h.toLowerCase().includes(q))
    );
  }, [allRecipesWithMatch, searchQuery, threshold]);

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

      {/* 8R-UX1: threshold-selector chips. Lowering threshold surfaces more
          recipes — at "Any" the entire user library shows, sorted by pantry
          match desc. */}
      <View style={styles.chipRow}>
        {THRESHOLD_OPTIONS.map((opt) => {
          const isOn = threshold === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.thresholdChip, isOn && styles.thresholdChipOn]}
              onPress={() => setThreshold(opt.value)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Match threshold ${opt.label}`}
            >
              <Text
                style={[
                  styles.thresholdChipText,
                  isOn && styles.thresholdChipTextOn,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
          renderItem={({ item }) => {
            const pct = Math.round((item.pantry_match ?? 0) * 100);
            return (
              <View>
                <View style={styles.matchBadgeRow}>
                  <View
                    style={[
                      styles.matchBadge,
                      pct >= 90 && styles.matchBadgeHigh,
                      pct < 50 && styles.matchBadgeLow,
                    ]}
                  >
                    <Text
                      style={[
                        styles.matchBadgeText,
                        pct >= 90 && styles.matchBadgeTextHigh,
                      ]}
                    >
                      {pct}% in pantry
                    </Text>
                  </View>
                </View>
                <RecipeCard
                  recipe={item}
                  isExpanded={expandedCardId === item.id}
                  onToggleExpand={() =>
                    setExpandedCardId((cur) => (cur === item.id ? null : item.id))
                  }
                  onPress={handleRecipePress}
                />
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No recipes match that search.'
                  : threshold > 0
                  ? `No recipes at ${Math.round(threshold * 100)}%+ pantry match.`
                  : 'No recipes loaded yet.'}
              </Text>
              {!searchQuery.trim() && threshold > 0 && (
                <Text style={styles.emptySubText}>
                  Try a lower threshold above, or stock up first.
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
      gap: 6,
    },
    thresholdChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: colors.background.card,
    },
    thresholdChipOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    thresholdChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    thresholdChipTextOn: {
      color: '#ffffff',
    },
    matchBadgeRow: {
      flexDirection: 'row',
      paddingTop: 6,
      paddingBottom: 2,
    },
    matchBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      backgroundColor: colors.background.secondary,
    },
    matchBadgeHigh: {
      backgroundColor: colors.primary,
    },
    matchBadgeLow: {
      backgroundColor: colors.background.secondary,
    },
    matchBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.secondary,
    },
    matchBadgeTextHigh: {
      color: '#ffffff',
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
