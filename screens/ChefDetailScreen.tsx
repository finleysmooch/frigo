// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// screens/ChefDetailScreen.tsx
// Stats-focused chef detail screen. Shows cooking stats for a specific chef.
// Separate from AuthorViewScreen (which navigates by chefName, not chefId).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';
import type { StatsStackParamList } from '../App';
import type { ChefStats } from '../lib/services/statsService';
import { getChefStats } from '../lib/services/statsService';
import {
  MiniBarRow,
  ComparisonBars,
  TappableConceptList,
  SignatureIngredientGroup,
  StockUpCard,
} from '../components/stats';

type Props = NativeStackScreenProps<StatsStackParamList, 'ChefDetail'>;

export default function ChefDetailScreen({ route, navigation }: Props) {
  const { chefId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [userId, setUserId] = useState('');
  const [chefName, setChefName] = useState('');
  const [data, setData] = useState<ChefStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Load chef name
  useEffect(() => {
    supabase
      .from('chefs')
      .select('name')
      .eq('id', chefId)
      .single()
      .then(({ data: chef }) => {
        const name = chef?.name || 'Chef';
        setChefName(name);
        navigation.setOptions({ title: name });
      });
  }, [chefId, navigation]);

  // Load chef stats
  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    getChefStats(userId, chefId)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load chef stats'))
      .finally(() => setLoading(false));
  }, [userId, chefId]);

  const handleRecipePress = useCallback(
    (recipeId: string, title: string) => {
      navigation.navigate('RecipeDetail', { recipe: { id: recipeId, title } });
    },
    [navigation]
  );

  const handleBookPress = useCallback(
    (bookId: string) => {
      navigation.navigate('BookDetail', { bookId });
    },
    [navigation]
  );

  const handleAddToGrocery = useCallback(
    (ingredients: { id: string; name: string; ingredientType: string | null }[]) => {
      console.log('[ChefDetail] Add to grocery list:', ingredients.map((i) => i.name));
    },
    []
  );

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

  const { recipesCooked, avgRating, timesCooked, comparison, mostCooked, concepts, signatureIngredients, stockUpList, books } = data;

  // Group signature ingredients by family
  const familyGroups = new Map<string, typeof signatureIngredients>();
  for (const ing of signatureIngredients) {
    const family = ing.family || 'Other';
    if (!familyGroups.has(family)) familyGroups.set(family, []);
    familyGroups.get(family)!.push(ing);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Hero Stats Row */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{recipesCooked}</Text>
            <Text style={styles.heroLabel}>Recipes</Text>
          </View>
          <View style={[styles.heroStat, styles.heroDivider]}>
            <Text style={styles.heroValue}>
              {avgRating != null ? avgRating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.heroLabel}>Avg Rating</Text>
          </View>
          <View style={[styles.heroStat, styles.heroDivider]}>
            <Text style={styles.heroValue}>{timesCooked}</Text>
            <Text style={styles.heroLabel}>Times Cooked</Text>
          </View>
        </View>
      </View>

      {/* Nutrition Comparison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>vs Your Overall</Text>
        <View style={styles.card}>
          <ComparisonBars
            label="Avg Calories"
            valueA={Math.round(comparison.chef.avgCalories)}
            valueB={Math.round(comparison.overall.avgCalories)}
            labelA={chefName}
            labelB="You"
            unit=" cal"
          />
          <ComparisonBars
            label="Avg Protein"
            valueA={Math.round(comparison.chef.avgProtein)}
            valueB={Math.round(comparison.overall.avgProtein)}
            labelA={chefName}
            labelB="You"
            unit="g"
          />
          <ComparisonBars
            label="Vegetarian %"
            valueA={Math.round(comparison.chef.vegetarianPct)}
            valueB={Math.round(comparison.overall.vegetarianPct)}
            labelA={chefName}
            labelB="You"
            unit="%"
          />
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
                count={item.count}
                barPct={item.barPct}
                onPress={() => handleRecipePress(item.recipeId, item.title)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Cooking Concepts */}
      {concepts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cooking Concepts</Text>
          <TappableConceptList
            items={concepts.map((c) => ({ name: c.concept, count: c.count }))}
            onPress={(item) => {
              navigation.navigate('DrillDown', {
                type: 'concept',
                value: item.name,
                label: item.name,
              });
            }}
          />
        </View>
      )}

      {/* Signature Ingredients */}
      {signatureIngredients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signature Ingredients</Text>
          <View style={styles.card}>
            {[...familyGroups.entries()].map(([family, items]) => (
              <SignatureIngredientGroup
                key={family}
                familyLabel={family}
                items={items.map((ing) => ({
                  id: ing.ingredientId,
                  name: ing.name,
                  count: ing.count,
                  barPct: ing.barPct,
                }))}
              />
            ))}
          </View>
        </View>
      )}

      {/* Stock Up */}
      {stockUpList.length > 0 && (
        <View style={styles.section}>
          <StockUpCard
            ingredients={stockUpList}
            onAddToGrocery={handleAddToGrocery}
          />
        </View>
      )}

      {/* Books */}
      {books.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Books</Text>
          <View style={styles.card}>
            {books.map((book, i) => (
              <MiniBarRow
                key={book.bookId}
                rank={i + 1}
                name={book.title}
                count={book.count}
                barPct={
                  books[0].count > 0
                    ? Math.round((book.count / books[0].count) * 100)
                    : 0
                }
                onPress={() => handleBookPress(book.bookId)}
              />
            ))}
          </View>
        </View>
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
  });
}
