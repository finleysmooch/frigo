// components/MadeOtherDishesSheet.tsx
// Phase 7E Checkpoint 4: "Made other dishes too?" post-publish sheet (D40)
// States 2a (planned meal with suggestions), 2b (added rows), 2c (unplanned with recommendations)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { useTheme } from '../lib/theme/ThemeContext';
import { supabase } from '../lib/supabase';
import { createDishPost, computeMealType } from '../lib/services/postService';
import { addDishesToMeal } from '../lib/services/mealService';
import { searchRecipesByTitle } from '../lib/searchService';
import { getRecipesWithTag } from '../lib/services/userRecipeTagsService';

// ── Inline icons ──

function CloseIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon({ size = 16, color = '#0F6E56' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function StarMiniIcon({ size = 14, filled = false, color = '#0F6E56' }: { size?: number; filled?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Types ──

interface MadeOtherDishesSheetProps {
  visible: boolean;
  mealId: string;
  mealTitle: string;
  mealType?: string;
  userId: string;
  onClose: () => void;
}

interface DishRow {
  id: string;
  recipeId: string | null;
  recipeTitle: string | null;
  dishName: string | null; // for freeform
  rating: number | null;
  fromSuggestion: boolean;
  planItemId: string | null; // meal_dish_plans id, if promoted from suggestion
}

interface SuggestedRow {
  planItemId: string;
  recipeId: string | null;
  recipeTitle: string;
}

interface RecommendationCard {
  recipeId: string;
  recipeTitle: string;
  sourceLabel: string;
}

const TEAL_700 = '#0F6E56';

// ── Component ──

export default function MadeOtherDishesSheet({
  visible,
  mealType,
  mealId,
  mealTitle,
  userId,
  onClose,
}: MadeOtherDishesSheetProps) {
  const { colors } = useTheme();

  const [suggestedRows, setSuggestedRows] = useState<SuggestedRow[]>([]);
  const [addedDishes, setAddedDishes] = useState<DishRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [isPlannedMeal, setIsPlannedMeal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; title: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadMealData();
    } else {
      setSuggestedRows([]);
      setAddedDishes([]);
      setRecommendations([]);
      setSearchText('');
      setSearchResults([]);
    }
  }, [visible, mealId]);

  const loadMealData = async () => {
    setLoading(true);
    try {
      // Check if meal has plan items (suggested dishes)
      const { data: planItems } = await supabase
        .from('meal_dish_plans')
        .select('id, recipe_id, placeholder_name, completed_at, logged_meal_post_id')
        .eq('meal_id', mealId)
        .is('completed_at', null);

      if (planItems && planItems.length > 0) {
        setIsPlannedMeal(true);
        // Get recipe titles for plan items that have recipes
        const suggestions: SuggestedRow[] = [];
        for (const item of planItems) {
          let title = item.placeholder_name || 'Planned dish';
          if (item.recipe_id) {
            const { data: recipe } = await supabase
              .from('recipes')
              .select('title')
              .eq('id', item.recipe_id)
              .single();
            if (recipe) title = recipe.title;
          }
          suggestions.push({
            planItemId: item.id,
            recipeId: item.recipe_id,
            recipeTitle: title,
          });
        }
        setSuggestedRows(suggestions);
      } else {
        setIsPlannedMeal(false);
        // Load recommendations for unplanned meals
        await loadRecommendations();
      }
    } catch (err) {
      console.error('Error loading meal data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const recs: RecommendationCard[] = [];

      // Signal 1: Cook Soon recipes
      const cookSoonRecipes = await getRecipesWithTag(userId, 'cook_soon');
      for (const r of cookSoonRecipes.slice(0, 3)) {
        recs.push({
          recipeId: r.id,
          recipeTitle: r.title,
          sourceLabel: 'Saved to Cook Soon',
        });
      }

      // Signal 2: Recently viewed — TODO: implement view tracking
      // No view-tracking table exists. Skipping silently.

      // Signal 3: Frequently cooked (high times_cooked in last 30 days)
      if (recs.length < 5) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: frequentPosts } = await supabase
          .from('posts')
          .select('recipe_id, recipes(id, title, times_cooked)')
          .eq('user_id', userId)
          .eq('post_type', 'dish')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(20);

        if (frequentPosts) {
          const seen = new Set(recs.map(r => r.recipeId));
          const recipeCounts = new Map<string, { id: string; title: string; count: number }>();
          for (const p of frequentPosts) {
            const recipe = p.recipes as any;
            if (recipe?.id && !seen.has(recipe.id)) {
              const existing = recipeCounts.get(recipe.id);
              if (existing) {
                existing.count++;
              } else {
                recipeCounts.set(recipe.id, { id: recipe.id, title: recipe.title, count: 1 });
              }
            }
          }
          const sorted = Array.from(recipeCounts.values()).sort((a, b) => b.count - a.count);
          for (const r of sorted.slice(0, 5 - recs.length)) {
            recs.push({
              recipeId: r.id,
              recipeTitle: r.title,
              sourceLabel: `Cooked ${r.count}\u00d7 recently`,
            });
          }
        }
      }

      setRecommendations(recs.slice(0, 5));
    } catch (err) {
      console.error('Error loading recommendations:', err);
    }
  };

  // Search recipes as user types
  useEffect(() => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await searchRecipesByTitle(searchText.trim());
        if (result?.recipeIds?.length > 0) {
          const { data: recipes } = await supabase
            .from('recipes')
            .select('id, title')
            .in('id', result.recipeIds.slice(0, 5));
          setSearchResults(recipes || []);
        } else {
          setSearchResults([]);
        }
      } catch (_) {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Promote a suggested row (user tapped a star on it)
  const promoteSuggestion = (suggestion: SuggestedRow, rating: number) => {
    const newDish: DishRow = {
      id: `dish_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      recipeId: suggestion.recipeId,
      recipeTitle: suggestion.recipeTitle,
      dishName: null,
      rating,
      fromSuggestion: true,
      planItemId: suggestion.planItemId,
    };
    setAddedDishes(prev => [...prev, newDish]);
    setSuggestedRows(prev => prev.filter(s => s.planItemId !== suggestion.planItemId));
  };

  // Add a recipe from search
  const addRecipeFromSearch = (recipeId: string, recipeTitle: string) => {
    const newDish: DishRow = {
      id: `dish_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      recipeId,
      recipeTitle,
      dishName: null,
      rating: null,
      fromSuggestion: false,
      planItemId: null,
    };
    setAddedDishes(prev => [...prev, newDish]);
    setSearchText('');
    setSearchResults([]);
  };

  // Add freeform dish
  const addFreeformDish = () => {
    const name = searchText.trim();
    if (!name) return;
    const newDish: DishRow = {
      id: `dish_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      recipeId: null,
      recipeTitle: null,
      dishName: name,
      rating: null,
      fromSuggestion: false,
      planItemId: null,
    };
    setAddedDishes(prev => [...prev, newDish]);
    setSearchText('');
    setSearchResults([]);
  };

  // Add from recommendation
  const addFromRecommendation = (rec: RecommendationCard) => {
    addRecipeFromSearch(rec.recipeId, rec.recipeTitle);
    setRecommendations(prev => prev.filter(r => r.recipeId !== rec.recipeId));
  };

  // Update rating on an added dish
  const updateDishRating = (dishId: string, rating: number) => {
    setAddedDishes(prev => prev.map(d => d.id === dishId ? { ...d, rating } : d));
  };

  // Handle Done — create dish posts and link to meal
  const handleDone = async () => {
    if (addedDishes.length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    const failures: Array<{ dishName: string; error: string }> = [];

    try {
      const effectiveMealType = computeMealType({
        parentMeal: mealType ? { meal_type: mealType } : undefined,
      });

      for (const dish of addedDishes) {
        let postId: string | null = null;
        try {
          // For freeform, insert directly since createDishPost requires recipeId
          if (!dish.recipeId) {
            const { data: freeformPost, error } = await supabase
              .from('posts')
              .insert({
                user_id: userId,
                title: dish.dishName || 'Dish',
                dish_name: dish.dishName,
                recipe_id: null,
                rating: dish.rating,
                visibility: 'followers',
                meal_type: effectiveMealType,
                post_type: 'dish',
                parent_meal_id: mealId,
              })
              .select()
              .single();
            if (error) throw error;
            postId = freeformPost?.id;
          } else {
            const post = await createDishPost({
              userId,
              recipeId: dish.recipeId,
              title: dish.recipeTitle || 'Dish',
              rating: dish.rating,
              visibility: 'followers',
              parentMealId: mealId,
            });
            postId = post?.id;
          }
        } catch (err: any) {
          console.error('Error creating dish post:', err);
          failures.push({
            dishName: dish.recipeTitle || dish.dishName || 'Unknown dish',
            error: err?.message || 'Unknown error',
          });
          continue;
        }

        if (!postId) continue;

        // Link to meal via dish_courses (addDishesToMeal handles all 3 representations)
        try {
          await addDishesToMeal(mealId, userId, [{
            dish_id: postId,
            course_type: 'main',
            is_main_dish: false,
            course_order: addedDishes.indexOf(dish) + 1,
          }]);
        } catch (err: any) {
          console.error('Error linking dish to meal:', err);
          failures.push({
            dishName: dish.recipeTitle || dish.dishName || 'Unknown dish',
            error: `Link failed: ${err?.message || 'Unknown error'}`,
          });
        }

        // If promoted from a suggestion, update the meal_dish_plans row
        if (dish.planItemId) {
          try {
            await supabase
              .from('meal_dish_plans')
              .update({
                completed_at: new Date().toISOString(),
                logged_meal_post_id: postId,
              })
              .eq('id', dish.planItemId);
          } catch (err: any) {
            console.error('Error updating plan item:', err);
            failures.push({
              dishName: dish.recipeTitle || dish.dishName || 'Unknown dish',
              error: `Plan update failed: ${err?.message || 'Unknown error'}`,
            });
          }
        }
      }

      // Report results
      if (failures.length === 0) {
        onClose();
      } else if (failures.length === addedDishes.length) {
        const message = failures
          .map(f => `• ${f.dishName}: ${f.error}`)
          .join('\n');
        Alert.alert(
          'Failed to save dishes',
          `None of your dishes were saved:\n\n${message}`,
          [{ text: 'OK' }]
        );
      } else {
        const failedNames = failures.map(f => f.dishName).join(', ');
        Alert.alert(
          'Some dishes failed to save',
          `Saved ${addedDishes.length - failures.length} of ${addedDishes.length} dishes.\n\nFailed: ${failedNames}`,
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Mini star rating ──
  const renderMiniStars = (currentRating: number | null, onRate: (r: number) => void) => (
    <View style={styles.miniStarsRow}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity key={star} onPress={() => onRate(star)} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
          <StarMiniIcon size={16} filled={currentRating !== null && star <= currentRating} color={TEAL_700} />
        </TouchableOpacity>
      ))}
      {currentRating === null && <Text style={styles.tapToRate}>tap to rate</Text>}
    </View>
  );

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border.medium,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 6,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    body: {
      paddingHorizontal: 20,
    },
    // Search input
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text.primary,
    },
    helpText: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginBottom: 14,
    },
    // Search results dropdown
    searchResultRow: {
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    searchResultText: {
      fontSize: 14,
      color: colors.text.primary,
    },
    freeformRow: {
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    freeformText: {
      fontSize: 14,
      color: TEAL_700,
    },
    // Suggested row
    suggestedRow: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    suggestedTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text.primary,
    },
    suggestedLabel: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    // Added dish row
    addedRow: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    addedTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text.primary,
    },
    addedFreeformNote: {
      fontSize: 12,
      color: colors.text.tertiary,
      fontStyle: 'italic',
    },
    miniStarsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    tapToRate: {
      fontSize: 11,
      color: colors.text.placeholder,
      marginLeft: 4,
    },
    // Recommendation cards (unplanned)
    recSectionLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text.tertiary,
      letterSpacing: 0.5,
      marginTop: 12,
      marginBottom: 8,
    },
    recCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.border.medium,
      borderRadius: 10,
      marginBottom: 8,
      gap: 10,
    },
    recCardTextArea: {
      flex: 1,
    },
    recCardTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text.primary,
    },
    recCardSource: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    // CTA area
    ctaArea: {
      paddingHorizontal: 20,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    doneButton: {
      backgroundColor: TEAL_700,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 8,
    },
    doneButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    skipButton: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    skipText: {
      fontSize: 14,
      color: colors.text.tertiary,
    },
    loadingContainer: {
      paddingVertical: 30,
      alignItems: 'center',
    },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Made other dishes too?</Text>
              <Text style={styles.headerSubtitle}>Add them to {mealTitle}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <CloseIcon size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={TEAL_700} />
              </View>
            ) : (
              <>
                {/* Search input */}
                <View style={styles.searchRow}>
                  <PlusIcon size={16} color={TEAL_700} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Pick a recipe or type a name…"
                    placeholderTextColor={colors.text.placeholder}
                    value={searchText}
                    onChangeText={setSearchText}
                  />
                </View>

                {/* Search results */}
                {searchText.trim().length > 0 && (
                  <>
                    {searchResults.map(r => (
                      <TouchableOpacity
                        key={r.id}
                        style={styles.searchResultRow}
                        onPress={() => addRecipeFromSearch(r.id, r.title)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.searchResultText}>{r.title}</Text>
                      </TouchableOpacity>
                    ))}
                    {searchText.trim().length >= 2 && searchResults.length === 0 && (
                      <TouchableOpacity style={styles.freeformRow} onPress={addFreeformDish} activeOpacity={0.7}>
                        <Text style={styles.freeformText}>
                          Add as freeform: "{searchText.trim()}"
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {searchText.trim().length === 0 && (
                  <Text style={styles.helpText}>Quick rate as you add. Skip what you didn't cook.</Text>
                )}

                {/* Suggested rows (planned meal) */}
                {suggestedRows.map(s => (
                  <View key={s.planItemId} style={styles.suggestedRow}>
                    <Text style={styles.suggestedTitle}>{s.recipeTitle}</Text>
                    <Text style={styles.suggestedLabel}>Suggested · planned for tonight</Text>
                    {renderMiniStars(null, (rating) => promoteSuggestion(s, rating))}
                  </View>
                ))}

                {/* Recommendation cards (unplanned meal) */}
                {!isPlannedMeal && recommendations.length > 0 && (
                  <>
                    <Text style={styles.recSectionLabel}>YOU MIGHT HAVE MADE</Text>
                    {recommendations.map(rec => (
                      <TouchableOpacity
                        key={rec.recipeId}
                        style={styles.recCard}
                        onPress={() => addFromRecommendation(rec)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.recCardTextArea}>
                          <Text style={styles.recCardTitle}>{rec.recipeTitle}</Text>
                          <Text style={styles.recCardSource}>{rec.sourceLabel}</Text>
                        </View>
                        <PlusIcon size={18} color={TEAL_700} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Added dish rows */}
                {addedDishes.map(dish => (
                  <View key={dish.id} style={styles.addedRow}>
                    <Text style={styles.addedTitle}>
                      {dish.recipeTitle || dish.dishName}
                      {!dish.recipeId && <Text style={styles.addedFreeformNote}> · no recipe</Text>}
                    </Text>
                    {renderMiniStars(dish.rating, (r) => updateDishRating(dish.id, r))}
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          {/* CTA area */}
          <View style={styles.ctaArea}>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleDone}
              activeOpacity={0.7}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.doneButtonText}>Done</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              {/* TODO post-launch: actually preserve partial state on Skip for now */}
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
