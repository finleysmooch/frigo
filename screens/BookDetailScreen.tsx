// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// screens/BookDetailScreen.tsx
// Stats-focused book detail screen. Shows cooking stats and progress for a specific cookbook.
// Separate from BookViewScreen (which shows recipe browsing, not stats).

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
import type { BookStats } from '../lib/services/statsService';
import { getBookStats } from '../lib/services/statsService';
import {
  MiniBarRow,
  ComparisonBars,
  TappableConceptList,
} from '../components/stats';

type Props = NativeStackScreenProps<StatsStackParamList, 'BookDetail'>;

export default function BookDetailScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [userId, setUserId] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [data, setData] = useState<BookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Load book title
  useEffect(() => {
    supabase
      .from('books')
      .select('title')
      .eq('id', bookId)
      .single()
      .then(({ data: book }) => {
        const title = book?.title || 'Cookbook';
        setBookTitle(title);
        navigation.setOptions({ title });
      });
  }, [bookId, navigation]);

  // Load book stats
  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    getBookStats(userId, bookId)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load book stats'))
      .finally(() => setLoading(false));
  }, [userId, bookId]);

  const handleRecipePress = useCallback(
    (recipeId: string, title: string) => {
      navigation.navigate('RecipeDetail', { recipe: { id: recipeId, title } });
    },
    [navigation]
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

  const { completionPct, avgRating, timesCooked, progress, comparison, mostCooked, highestRated, keyIngredients, cuisines, methods } = data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Hero Stats Row */}
      <View style={styles.heroCard}>
        {/* Progress bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${Math.min(completionPct, 100)}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {progress.cooked} of {progress.total} recipes cooked
        </Text>

        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{completionPct}%</Text>
            <Text style={styles.heroLabel}>Complete</Text>
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
            valueA={Math.round(comparison.book.avgCalories)}
            valueB={Math.round(comparison.overall.avgCalories)}
            labelA={bookTitle}
            labelB="You"
            unit=" cal"
          />
          <ComparisonBars
            label="Avg Protein"
            valueA={Math.round(comparison.book.avgProtein)}
            valueB={Math.round(comparison.overall.avgProtein)}
            labelA={bookTitle}
            labelB="You"
            unit="g"
          />
          <ComparisonBars
            label="Vegetarian %"
            valueA={Math.round(comparison.book.vegetarianPct)}
            valueB={Math.round(comparison.overall.vegetarianPct)}
            labelA={bookTitle}
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

      {/* Highest Rated */}
      {highestRated.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Highest Rated</Text>
          <View style={styles.card}>
            {highestRated.map((item, i) => (
              <MiniBarRow
                key={item.recipeId}
                rank={i + 1}
                name={item.title}
                subtitle={item.rating != null ? `${item.rating.toFixed(1)} stars` : undefined}
                count={item.count}
                barPct={item.barPct}
                onPress={() => handleRecipePress(item.recipeId, item.title)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Key Ingredients */}
      {keyIngredients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Ingredients</Text>
          <View style={styles.card}>
            {keyIngredients.slice(0, 10).map((item, i) => (
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

      {/* Cuisines & Methods side by side */}
      {(cuisines.length > 0 || methods.length > 0) && (
        <View style={styles.sideBySide}>
          {cuisines.length > 0 && (
            <View style={styles.halfSection}>
              <Text style={styles.sectionTitle}>Cuisines</Text>
              <TappableConceptList
                items={cuisines.map((c) => ({ name: c.cuisine, count: c.count }))}
                onPress={(item) => {
                  navigation.navigate('DrillDown', {
                    type: 'cuisine',
                    value: item.name,
                    label: item.name,
                  });
                }}
              />
            </View>
          )}
          {methods.length > 0 && (
            <View style={styles.halfSection}>
              <Text style={styles.sectionTitle}>Methods</Text>
              <TappableConceptList
                items={methods.map((m) => ({ name: m.method, count: m.count }))}
                onPress={(item) => {
                  navigation.navigate('DrillDown', {
                    type: 'method',
                    value: item.name,
                    label: item.name,
                  });
                }}
              />
            </View>
          )}
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
    progressBarTrack: {
      height: 8,
      backgroundColor: colors.border.light,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
    progressLabel: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: spacing.md,
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

    // Side by side layout for cuisines + methods
    sideBySide: {
      marginBottom: spacing.lg,
    },
    halfSection: {
      marginBottom: spacing.md,
    },
  });
}
