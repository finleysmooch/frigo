// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// screens/DrillDownScreen.tsx
// Reusable drill-down detail screen for cuisine, concept, method, or ingredient.
// Receives { type, value, label } route params, calls matching statsService function.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';
import type { StatsStackParamList } from '../App';
import type {
  StatsParams,
  MealTypeFilter,
  StatsPeriod,
  DrillDownDetail,
} from '../lib/services/statsService';
import {
  getCuisineDetail,
  getConceptDetail,
  getMethodDetail,
  getIngredientDetail,
} from '../lib/services/statsService';
import { RankedList, TappableConceptList, MiniBarRow } from '../components/stats';

type Props = NativeStackScreenProps<StatsStackParamList, 'DrillDown'>;

export default function DrillDownScreen({ route, navigation }: Props) {
  const { type, value, label } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [userId, setUserId] = useState('');
  const [data, setData] = useState<DrillDownDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set the header title to the label
  useEffect(() => {
    navigation.setOptions({ title: label });
  }, [label, navigation]);

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Fetch drill-down data
  useEffect(() => {
    if (!userId) return;

    const params: StatsParams = {
      userId,
      period: 'all' as StatsPeriod,
      mealType: 'all' as MealTypeFilter,
    };

    setLoading(true);
    setError(null);

    const fetchDetail = () => {
      switch (type) {
        case 'cuisine':
          return getCuisineDetail(params, value);
        case 'concept':
          return getConceptDetail(params, value);
        case 'method':
          return getMethodDetail(params, value);
        case 'ingredient':
          return getIngredientDetail(params, value);
      }
    };

    fetchDetail()
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [userId, type, value]);

  const handleRecipePress = useCallback(
    (recipeId: string, title: string) => {
      navigation.navigate('RecipeDetail', { recipe: { id: recipeId, title } });
    },
    [navigation]
  );

  const handleChefPress = useCallback(
    (chefId: string) => {
      navigation.navigate('ChefDetail', { chefId });
    },
    [navigation]
  );

  const handleBrowseUncooked = useCallback(() => {
    // Build filter params based on drill-down type
    const filterParams: Record<string, any> = {
      initialBrowseMode: 'try_new',
    };

    switch (type) {
      case 'cuisine':
        filterParams.initialCuisine = value;
        break;
      case 'concept':
        filterParams.initialCookingConcept = value;
        break;
      case 'method':
        // Methods don't have a dedicated initial param — use cooking concept as closest match
        filterParams.initialCookingConcept = value;
        break;
      case 'ingredient':
        // Ingredient filtering not yet supported via initial params
        break;
    }

    // Cross-stack navigation to RecipesStack > RecipeList
    navigation.getParent()?.navigate('RecipesStack', {
      screen: 'RecipeList',
      params: filterParams,
    });
  }, [type, value, navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'No data available'}</Text>
      </View>
    );
  }

  const { stats, mostCooked, ingredients, chefs, concepts, uncookedCount } = data;

  // Format trend display
  const trendPrefix = stats.trend > 0 ? '+' : '';
  const trendLabel = stats.trend !== 0 ? `${trendPrefix}${stats.trend}%` : 'Steady';
  const trendColor =
    stats.trend > 0 ? colors.success : stats.trend < 0 ? colors.error : colors.text.tertiary;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Hero Stats Row */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{stats.count}</Text>
            <Text style={styles.heroLabel}>Times Cooked</Text>
          </View>
          <View style={[styles.heroStat, styles.heroDivider]}>
            <Text style={styles.heroValue}>
              {stats.avgRating != null ? stats.avgRating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.heroLabel}>Avg Rating</Text>
          </View>
          <View style={[styles.heroStat, styles.heroDivider]}>
            <Text style={[styles.heroValue, { color: trendColor }]}>{trendLabel}</Text>
            <Text style={styles.heroLabel}>Trend</Text>
          </View>
        </View>
      </View>

      {/* Most Cooked */}
      {mostCooked.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Most Cooked</Text>
          <View style={styles.card}>
            {mostCooked.map((item, i) => (
              <MiniBarRow
                key={item.recipeId}
                rank={i + 1}
                name={item.title}
                subtitle={item.chef || undefined}
                count={item.count}
                barPct={item.barPct}
                onPress={() => handleRecipePress(item.recipeId, item.title)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Signature Ingredients */}
      {ingredients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Ingredients</Text>
          <View style={styles.card}>
            {ingredients.slice(0, 8).map((item, i) => (
              <MiniBarRow
                key={item.ingredientId}
                rank={i + 1}
                name={item.name}
                subtitle={item.family || undefined}
                count={item.count}
                barPct={item.barPct}
              />
            ))}
          </View>
        </View>
      )}

      {/* Top Chefs */}
      {chefs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Chefs</Text>
          <View style={styles.card}>
            {chefs.slice(0, 5).map((chef, i) => (
              <MiniBarRow
                key={chef.chefId}
                rank={i + 1}
                name={chef.name}
                count={chef.count}
                barPct={
                  chefs[0].count > 0
                    ? Math.round((chef.count / chefs[0].count) * 100)
                    : 0
                }
                onPress={() => handleChefPress(chef.chefId)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Related Concepts */}
      {concepts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Related Concepts</Text>
          <TappableConceptList
            items={concepts.map((c) => ({ name: c.concept, count: c.count }))}
          />
        </View>
      )}

      {/* Explore CTA */}
      {uncookedCount > 0 && (
        <TouchableOpacity
          style={styles.ctaCard}
          onPress={handleBrowseUncooked}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaCount}>{uncookedCount}</Text>
          <Text style={styles.ctaText}>
            {label} recipes you haven't tried yet
          </Text>
          <Text style={styles.ctaButton}>Browse</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.primary,
    },
    errorText: {
      fontSize: typography.sizes.md,
      color: colors.text.tertiary,
    },

    // Hero stats
    heroCard: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border.light,
      marginBottom: spacing.lg,
    },
    heroRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    heroStat: {
      alignItems: 'center',
      flex: 1,
    },
    heroDivider: {
      borderLeftWidth: 1,
      borderLeftColor: colors.border.light,
    },
    heroValue: {
      fontSize: typography.sizes.xxl,
      fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
    },
    heroLabel: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      marginTop: 2,
    },

    // Sections
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.light,
    },

    // CTA
    ctaCard: {
      backgroundColor: colors.primary + '15',
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    ctaCount: {
      fontSize: typography.sizes.xxl,
      fontWeight: typography.weights.bold as any,
      color: colors.primary,
    },
    ctaText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    ctaButton: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.primary,
    },
  });
}
