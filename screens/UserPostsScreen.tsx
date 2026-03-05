// screens/UserPostsScreen.tsx
// Shows a specific user's public cooking posts.
// Navigated to from Cooking Partners in StatsOverview.
// TODO: Extract post fetch into a userService.ts function in future refactor.

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import type { StatsStackParamList } from '../App';

type Props = NativeStackScreenProps<StatsStackParamList, 'UserPosts'>;

interface UserPost {
  id: string;
  title: string;
  rating: number | null;
  cooking_method: string | null;
  created_at: string;
  recipe_id: string | null;
  recipes: { title: string } | null;
  post_photos: { url: string; order: number }[];
  yas_count: number;
  nutrition: {
    calories: number | null;
    protein: number | null;
  } | null;
}

export default function UserPostsScreen({ route, navigation }: Props) {
  const { userId, displayName } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState(displayName);

  useEffect(() => {
    navigation.setOptions({ title: displayName });
  }, [displayName]);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('avatar_url, display_name')
        .eq('id', userId)
        .single();

      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
      if (profile?.display_name) setName(profile.display_name);

      // Fetch posts
      const { data: rawPosts } = await supabase
        .from('posts')
        .select(`
          id, title, rating, cooking_method, created_at, recipe_id,
          recipes(title),
          post_photos(url, order)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!rawPosts) { setPosts([]); return; }

      // Fetch yas counts
      const postIds = rawPosts.map(p => p.id);
      const { data: yasCounts } = await supabase
        .from('post_reactions')
        .select('post_id')
        .in('post_id', postIds);

      const yasMap = new Map<string, number>();
      (yasCounts || []).forEach(r => {
        yasMap.set(r.post_id, (yasMap.get(r.post_id) || 0) + 1);
      });

      // Fetch nutrition for recipes
      const recipeIds = [...new Set(rawPosts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
      const nutritionMap = new Map<string, { calories: number; protein: number }>();
      if (recipeIds.length > 0) {
        const { data: nutrition } = await supabase
          .from('recipe_nutrition_computed')
          .select('recipe_id, cal_per_serving, protein_per_serving_g')
          .in('recipe_id', recipeIds);
        (nutrition || []).forEach(n => {
          nutritionMap.set(n.recipe_id, {
            calories: Math.round(n.cal_per_serving),
            protein: Math.round(n.protein_per_serving_g),
          });
        });
      }

      const enriched: UserPost[] = rawPosts.map(p => ({
        ...p,
        recipes: Array.isArray(p.recipes) ? p.recipes[0] ?? null : p.recipes,
        post_photos: (p.post_photos || []).sort((a: any, b: any) => a.order - b.order),
        yas_count: yasMap.get(p.id) || 0,
        nutrition: p.recipe_id ? nutritionMap.get(p.recipe_id) ?? null : null,
      }));

      setPosts(enriched);
    } catch (err) {
      console.error('Error loading user posts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No posts yet</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {posts.map(post => {
        const date = new Date(post.created_at);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
          <View key={post.id} style={styles.activityCard}>
            {/* Header row */}
            <View style={styles.acHeader}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.acAvatar} />
              ) : (
                <View style={[styles.acAvatar, styles.acAvatarPlaceholder]}>
                  <Text style={styles.acAvatarInitial}>{name?.charAt(0)?.toUpperCase() || '?'}</Text>
                </View>
              )}
              <View style={styles.acMeta}>
                <Text style={styles.acName}>{name}</Text>
                <View style={styles.acDateRow}>
                  <Text style={styles.acDate}>{dateStr}</Text>
                  {post.cooking_method && (
                    <Text style={styles.acMethod}> · {post.cooking_method}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.acTitle} numberOfLines={2}>
              {post.title || post.recipes?.title || 'Untitled Cook'}
            </Text>
            {post.recipes?.title && post.title && post.title !== post.recipes.title && (
              <Text style={styles.acSubtitle} numberOfLines={1}>{post.recipes.title}</Text>
            )}

            {/* Stats row */}
            <View style={styles.acStatsRow}>
              <View style={styles.acStat}>
                <Text style={styles.acStatVal}>
                  {post.rating ? `${post.rating.toFixed(1)}` : '—'}
                </Text>
                <Text style={styles.acStatLabel}>RATING</Text>
              </View>
              <View style={[styles.acStat, styles.acStatBorder]}>
                <Text style={styles.acStatVal}>
                  {post.nutrition?.calories != null ? `${post.nutrition.calories}` : '—'}
                </Text>
                <Text style={styles.acStatLabel}>CAL/SERVING</Text>
              </View>
              <View style={[styles.acStat, styles.acStatBorder]}>
                <Text style={styles.acStatVal}>
                  {post.nutrition?.protein != null ? `${post.nutrition.protein}g` : '—'}
                </Text>
                <Text style={styles.acStatLabel}>PROTEIN</Text>
              </View>
            </View>

            {/* Yas chefs count (read-only) */}
            {post.yas_count > 0 && (
              <Text style={styles.acYasText}>{post.yas_count} yas chefs</Text>
            )}
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Strava-style activity card styles — duplicated from StatsScreen ActivityCard
// TODO: potential extraction to components/stats/ActivityCard.tsx
function createStyles(colors: any) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    scrollContent: {
      padding: spacing.md,
      gap: spacing.md,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.secondary,
    },
    emptyText: {
      fontSize: typography.sizes.md,
      color: colors.text.tertiary,
    },
    activityCard: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...shadows.small,
    },
    acHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    acAvatar: { width: 42, height: 42, borderRadius: 21 },
    acAvatarPlaceholder: {
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acAvatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' as any },
    acMeta: { flex: 1 },
    acName: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
    },
    acDateRow: { flexDirection: 'row', marginTop: 1 },
    acDate: { fontSize: typography.sizes.xs, color: colors.text.tertiary },
    acMethod: { fontSize: typography.sizes.xs, color: colors.text.tertiary },
    acTitle: {
      fontSize: 19,
      fontWeight: '800' as any,
      color: colors.text.primary,
      marginBottom: 3,
      letterSpacing: -0.3,
    },
    acSubtitle: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      marginBottom: spacing.sm,
    },
    acStatsRow: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      marginVertical: spacing.sm,
    },
    acStat: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
    acStatBorder: { borderLeftWidth: 1, borderLeftColor: colors.border.light },
    acStatVal: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
    },
    acStatLabel: {
      fontSize: 9,
      color: colors.text.tertiary,
      fontWeight: '600' as any,
      letterSpacing: 0.5,
      marginTop: 1,
    },
    acYasText: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      marginTop: spacing.xs,
    },
  });
}
