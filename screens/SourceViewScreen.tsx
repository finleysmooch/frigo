// screens/SourceViewScreen.tsx
// Increment ③ (NYT Cooking import) — "view all my recipes from this web source".
// Mirrors the BookViewScreen data-load pattern (direct `recipes` query + the
// nutrition / cooking-history / friends enrichment), sorted by
// `source_updated_at` desc (recipes with no source date sort to the bottom).
// Reached from the AuthorViewScreen "Other sources" pills.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipesStackParamList } from '../App';
import { useTheme } from '../lib/theme/ThemeContext';
import { supabase } from '../lib/supabase';
import { RecipeCard, type Recipe } from '../components/recipe/RecipeCard';
import {
  getCookingHistory,
  getFriendsCookingInfo,
  type CookingHistory,
  type FriendsCookingInfo,
} from '../lib/services/recipeHistoryService';
import {
  getRecipeNutritionBatch,
  type RecipeNutrition,
} from '../lib/services/nutritionService';
import { sourceLabel } from '../lib/utils/sourceLabel';
import GlobeIcon from '../components/icons/recipe/GlobeIcon';

type Props = NativeStackScreenProps<RecipesStackParamList, 'SourceView'>;

export default function SourceViewScreen({ route, navigation }: Props) {
  const { domain } = route.params;
  const { colors } = useTheme();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('Not signed in'); setLoading(false); return; }

        const { data, error: qErr } = await supabase
          .from('recipes')
          .select('*, chefs:chef_id (name)')
          .eq('source_domain', domain)
          .eq('user_id', user.id)
          .order('source_updated_at', { ascending: false, nullsFirst: false });
        if (qErr) throw qErr;

        const raw = (data ?? []) as any[];
        const ids = raw.map(r => r.id);
        const [nutritionMap, history, friends] = await Promise.all([
          ids.length ? getRecipeNutritionBatch(ids) : Promise.resolve(new Map<string, RecipeNutrition>()),
          getCookingHistory(user.id),
          getFriendsCookingInfo(user.id),
        ]);

        const enriched: Recipe[] = raw.map(r => {
          const n = nutritionMap.get(r.id);
          const h: CookingHistory | undefined = history.get(r.id);
          const f: FriendsCookingInfo | undefined = friends.get(r.id);
          return {
            ...r,
            chef_name: r.chefs?.name ?? 'Unknown Chef',
            ...(n && {
              cal_per_serving: n.cal_per_serving,
              protein_per_serving_g: n.protein_per_serving_g,
              fat_per_serving_g: n.fat_per_serving_g,
              carbs_per_serving_g: n.carbs_per_serving_g,
              is_vegan: n.is_vegan,
              is_vegetarian: n.is_vegetarian,
              is_gluten_free: n.is_gluten_free,
              is_dairy_free: n.is_dairy_free,
              is_nut_free: n.is_nut_free,
              is_shellfish_free: n.is_shellfish_free,
              is_soy_free: n.is_soy_free,
              is_egg_free: n.is_egg_free,
              nutrition_quality_label: n.quality_label,
            }),
            ...(h && {
              times_cooked: h.times_cooked,
              last_cooked: h.last_cooked,
              first_cooked: h.first_cooked,
              avg_rating: h.avg_rating,
              latest_rating: h.latest_rating,
            }),
            ...(f && { friends_cooked_count: f.friends_cooked_count }),
          } as Recipe;
        });
        setRecipes(enriched);
      } catch (e: any) {
        console.error('Error loading source recipes:', e);
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [domain]);

  // Set the native header title to the friendly source label.
  useEffect(() => {
    navigation.setOptions({ title: sourceLabel(domain) || domain });
  }, [domain, navigation]);

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background.primary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 15,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerText: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    statusRow: { paddingHorizontal: 15, paddingBottom: 6 },
    statusText: { fontSize: 12, color: colors.text.tertiary, fontWeight: '500' },
    listContainer: { padding: 15, paddingBottom: 10 },
    errorText: { fontSize: 15, color: colors.text.tertiary, textAlign: 'center' },
    emptyText: { fontSize: 15, color: colors.text.tertiary, textAlign: 'center' },
  });

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const n = recipes.length;
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <GlobeIcon size={18} color={colors.primary} />
        <Text style={styles.headerText}>{sourceLabel(domain) || domain}</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>{n} recipe{n !== 1 ? 's' : ''}</Text>
      </View>
      <FlatList
        data={recipes}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            isExpanded={expandedCardId === item.id}
            onToggleExpand={() =>
              setExpandedCardId(expandedCardId === item.id ? null : item.id)
            }
            onPress={(recipe) => navigation.navigate('RecipeDetail', { recipe })}
            isSelectionMode={false}
          />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No recipes from this source yet.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
