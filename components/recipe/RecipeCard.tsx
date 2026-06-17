// ============================================
// FRIGO — RECIPE CARD (Phase 8D-CP4)
// ============================================
// Extracted verbatim from RecipeListScreen's inline `renderRecipeCard` so the
// card can be shared by RecipeListScreen and WhatCanICookScreen. The visual
// output is byte-identical to the pre-CP4 inline render — this is an internal
// refactor, not a redesign (CP4 Preservation Contract).
//
// The closure values `renderRecipeCard` previously captured are now props:
// `isExpanded` (was `expandedCardId === id`), `onToggleExpand`, `onPress`,
// `isSelectionMode`, `onSelectForMeal`. Styles are theme-derived via `makeStyles`
// memoized on [colors] — mirrors RecipeListScreen's own styling pattern.
// ============================================

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import {
  TimerIcon, FireIcon, BodybuilderIcon, PanIcon, FriendsIcon, ChefHat2,
} from '../icons';
import GlobeIcon from '../icons/recipe/GlobeIcon';
import { SaveOutlineIcon, SaveFilledIcon } from './SaveIcon';
import StarIcon from '../icons/recipe/StarIcon';
import { VIBE_TAG_ICONS } from '../../constants/vibeIcons';
import { useTheme } from '../../lib/theme/ThemeContext';
import { sourceLabel } from '../../lib/utils/sourceLabel';

// Card-data shape. Owned here because RecipeCard is the canonical consumer;
// RecipeListScreen + WhatCanICookScreen import this type.
export interface Recipe {
  id: string;
  title: string;
  description: string;
  prep_time_min: number;
  cook_time_min: number;
  inactive_time_min: number;
  active_time_min: number;
  total_time_min: number;
  servings: number;
  difficulty_level: 'easy' | 'medium' | 'advanced';
  easier_than_looks: boolean;
  cooking_methods: string[];
  cuisine_types: string[];
  make_ahead_friendly: boolean;
  is_one_pot: boolean;
  chef_id: string;
  chef_name?: string;
  book_name?: string;
  cost_per_serving?: number;
  ingredient_count?: number;
  pantry_match?: number;
  is_pinned?: boolean;
  image_url?: string;
  source_domain?: string;
  source_updated_at?: string;

  // Phase 3A fields (already on recipes table from AI backfill)
  hero_ingredients: string[];
  vibe_tags: string[];
  serving_temp: string | null;
  course_type: string | null;
  make_ahead_score: number | null;

  // Cooking history (computed from posts)
  times_cooked?: number;
  last_cooked?: string | null;
  first_cooked?: string | null;
  avg_rating?: number | null;
  latest_rating?: number | null;
  friends_cooked_count?: number;

  // Nutrition (from batch fetch via nutritionService)
  cal_per_serving?: number;
  protein_per_serving_g?: number;
  fat_per_serving_g?: number;
  carbs_per_serving_g?: number;
  is_vegan?: boolean;
  is_vegetarian?: boolean;
  is_gluten_free?: boolean;
  is_dairy_free?: boolean;
  is_nut_free?: boolean;
  is_shellfish_free?: boolean;
  is_soy_free?: boolean;
  is_egg_free?: boolean;
  nutrition_quality_label?: string;
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// Helpers — extracted alongside the card (the card is their only consumer).
function formatRelativeTime(dateStr: string): string {
  const diffDays = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function buildDietaryBadges(recipe: Recipe): { key: string; label: string }[] {
  if (recipe.cal_per_serving == null) return [];
  const badges: { key: string; label: string }[] = [];
  if (recipe.is_vegan) badges.push({ key: 'vegan', label: 'VG' });
  else if (recipe.is_vegetarian) badges.push({ key: 'veg', label: 'V' });
  if (recipe.is_gluten_free) badges.push({ key: 'gf', label: 'GF' });
  if (recipe.is_dairy_free) badges.push({ key: 'df', label: 'DF' });
  if (recipe.is_nut_free) badges.push({ key: 'nf', label: 'NF' });
  return badges;
}

// A bookmark assigned to this recipe (just what the card needs to draw a glyph).
export interface CardBookmark {
  key: string;
  name: string;
  color: string;
  kind: 'favorite' | 'cook_soon' | 'custom';
}

interface RecipeCardProps {
  recipe: Recipe;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPress: (recipe: Recipe) => void;
  isSelectionMode?: boolean;
  onSelectForMeal?: (recipe: Recipe) => void;
  /** Bookmarks currently on this recipe — rendered as small colored glyphs. */
  bookmarks?: CardBookmark[];
  /** When provided, a compact bookmark button shows; tap opens the picker. */
  onOpenBookmarks?: (recipe: Recipe) => void;
}

export function RecipeCard({
  recipe: item,
  isExpanded,
  onToggleExpand,
  onPress,
  isSelectionMode = false,
  onSelectForMeal,
  bookmarks,
  onOpenBookmarks,
}: RecipeCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const timeStr = item.prep_time_min && item.cook_time_min
    ? `${item.prep_time_min + item.cook_time_min}m`
    : item.total_time_min
    ? `${item.total_time_min}m`
    : item.active_time_min
    ? `${item.active_time_min}m`
    : null;

  const showChef = item.chef_name && item.chef_name !== 'Unknown Chef';
  const sourceName = sourceLabel(item.source_domain);
  const dietaryBadges = buildDietaryBadges(item);

  return (
    <View style={styles.cardWrapper}>
    <TouchableOpacity style={styles.card} onPress={onToggleExpand} activeOpacity={0.95}>

      {/* ── Collapsed row: left content + right image ── */}
      <View style={styles.cardRow}>

        {/* Left column */}
        <View style={styles.cardLeft}>

          {/* Title + chef → navigate to detail */}
          <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.7}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            {showChef && (
              <View style={styles.chefLine}>
                <ChefHat2 size={12} color={colors.text.secondary} />
                <Text style={styles.chefLineText} numberOfLines={1}>{item.chef_name}</Text>
              </View>
            )}
            {sourceName && (
              <View style={styles.chefLine}>
                <GlobeIcon size={12} color={colors.text.secondary} />
                <Text style={styles.sourceLineText} numberOfLines={1}>{sourceName}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Hero ingredient pills */}
          {item.hero_ingredients?.length > 0 && (
            <View style={styles.heroRow}>
              {item.hero_ingredients.slice(0, 4).map(h => (
                <View key={h} style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{h}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Stats line + dietary badges */}
          <View style={styles.statsLine}>
            <View style={styles.statsItems}>
              {timeStr != null && (
                <View style={styles.statItem}>
                  <TimerIcon size={14} color={colors.text.tertiary} />
                  <Text style={styles.statsLineText}>{timeStr}</Text>
                </View>
              )}
              {item.cal_per_serving != null && (
                <View style={styles.statItem}>
                  <FireIcon size={14} color={colors.text.tertiary} />
                  <Text style={styles.statsLineText}>{Math.round(item.cal_per_serving)}</Text>
                </View>
              )}
              {item.protein_per_serving_g != null && (
                <View style={styles.statItem}>
                  <BodybuilderIcon size={14} color={colors.text.tertiary} />
                  <Text style={styles.statsLineText}>{Math.round(item.protein_per_serving_g)}g</Text>
                </View>
              )}
            </View>
            {dietaryBadges.length > 0 && (
              <View style={styles.dietaryBadgesGroup}>
                {dietaryBadges.map(b => (
                  <View key={b.key} style={styles.dietaryBadge}>
                    <Text style={styles.dietaryBadgeText}>{b.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Right column — image navigates, card taps toggle expand */}
        <View style={styles.cardRight}>
          <View style={styles.imageWrap}>
            <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.7}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.recipeImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder} />
              )}
            </TouchableOpacity>

            {/* Bookmark glyphs + quick-add, overlaid on the image top-left.
                Nested touchable so the tap opens the picker, not the card.
                Sits on a translucent chip so it stays legible over any photo. */}
            {onOpenBookmarks && (
              <TouchableOpacity
                style={styles.bmOverlay}
                onPress={() => onOpenBookmarks(item)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                activeOpacity={0.7}
              >
                {bookmarks && bookmarks.length > 0 ? (
                  <View style={styles.bmGlyphs}>
                    {bookmarks.slice(0, 2).map((b, i) => (
                      <View key={b.key} style={[styles.bmGlyph, i > 0 && { marginLeft: -6 }]}>
                        <SaveFilledIcon size={16} color={b.color} />
                        {b.kind === 'favorite' && (
                          <View style={styles.bmStar}><StarIcon size={7} color="#fff" /></View>
                        )}
                      </View>
                    ))}
                    {bookmarks.length > 2 && (
                      <Text style={styles.bmPlus}>+{bookmarks.length - 2}</Text>
                    )}
                  </View>
                ) : (
                  <SaveOutlineIcon size={15} color={colors.text.secondary} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── Expanded section ── */}
      {isExpanded && (
        <View style={styles.expandedSection}>
          {/* Description */}
          {!!item.description && (
            <Text style={styles.descriptionText}>{item.description}</Text>
          )}

          {/* Macros row: CAL | PROTEIN | FAT | CARBS */}
          {item.cal_per_serving != null && (
            <View style={styles.macrosRow}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(item.cal_per_serving)}</Text>
                <Text style={styles.macroLabel}>CAL</Text>
              </View>
              <View style={styles.macroDivider} />
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(item.protein_per_serving_g ?? 0)}g</Text>
                <Text style={styles.macroLabel}>PROTEIN</Text>
              </View>
              <View style={styles.macroDivider} />
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(item.fat_per_serving_g ?? 0)}g</Text>
                <Text style={styles.macroLabel}>FAT</Text>
              </View>
              <View style={styles.macroDivider} />
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(item.carbs_per_serving_g ?? 0)}g</Text>
                <Text style={styles.macroLabel}>CARBS</Text>
              </View>
            </View>
          )}

          {/* Difficulty badge + vibe tags */}
          {(item.difficulty_level || (item.vibe_tags?.length ?? 0) > 0) && (
            <View style={styles.expandedDetailsRow}>
              {item.difficulty_level && (
                <View style={styles.difficultyPill}>
                  <Text style={styles.difficultyPillText}>{item.difficulty_level}</Text>
                </View>
              )}
              {item.vibe_tags?.map(tag => {
                const VibeIcon = VIBE_TAG_ICONS[tag.toLowerCase()];
                return (
                  <View key={tag} style={styles.vibeTag}>
                    {VibeIcon && <VibeIcon size={11} color={colors.text.tertiary} />}
                    <Text style={styles.vibeTagText}>{tag}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Cooking history */}
          {(item.times_cooked ?? 0) > 0 && (
            <View style={styles.historyRow}>
              <PanIcon size={14} color={colors.text.tertiary} />
              <Text style={styles.historyText}>
                {' '}{item.times_cooked}x
                {item.last_cooked ? `  ·  ${formatRelativeTime(item.last_cooked)}` : ''}
                {item.avg_rating != null ? `  ⭐ ${item.avg_rating.toFixed(1)}` : ''}
              </Text>
            </View>
          )}

          {/* Friends count */}
          {(item.friends_cooked_count ?? 0) > 0 && (
            <View style={styles.friendsRow}>
              <FriendsIcon size={14} color={colors.text.tertiary} />
              <Text style={styles.friendsText}>
                {' '}{item.friends_cooked_count} friend{item.friends_cooked_count !== 1 ? 's' : ''} cooked this
              </Text>
            </View>
          )}

          {/* TODO: Add flavor profile line when recipe-level flavor data is computed */}
        </View>
      )}

      {/* Selection mode Select button */}
      {isSelectionMode && (
        <TouchableOpacity
          style={[styles.selectButton, { marginTop: 10, alignSelf: 'flex-end' }]}
          onPress={() => onSelectForMeal?.(item)}
          activeOpacity={0.8}
        >
          <Text style={styles.selectButtonText}>Select</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
    </View>
  );
}

export default RecipeCard;

// Card styles — lifted verbatim from RecipeListScreen's makeStyles so the
// rendered card is byte-identical. Keep in sync if RecipeListScreen's card
// styling ever changes.
function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cardWrapper: {
      marginBottom: 15,
      borderRadius: 12,
      backgroundColor: colors.background.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    card: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 15,
      overflow: 'hidden',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      flex: 1,
      marginRight: 10,
      color: colors.text.primary,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    selectButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 6,
      marginLeft: 12,
    },
    selectButtonText: {
      color: colors.background.card,
      fontSize: 13,
      fontWeight: '600',
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    cardLeft: {
      flex: 1,
      marginRight: 8,
    },
    cardRight: {
      alignItems: 'center',
      width: 70,
    },
    recipeImage: {
      width: 62,
      height: 62,
      borderRadius: 8,
    },
    imagePlaceholder: {
      width: 62,
      height: 62,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
    },
    chefLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 3,
    },
    chefLineText: {
      fontSize: 13,
      color: colors.text.secondary,
      fontStyle: 'italic',
    },
    sourceLineText: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    heroRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 4,
      marginBottom: 4,
    },
    heroPill: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
    },
    heroPillText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '500',
    },
    statsLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    statsItems: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    statsLineText: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    dietaryBadgesGroup: {
      flexDirection: 'row',
      gap: 3,
    },
    imageWrap: {
      position: 'relative',
      width: 62,
      height: 62,
    },
    bmOverlay: {
      position: 'absolute',
      top: 3,
      left: 3,
      backgroundColor: 'rgba(255,255,255,0.88)',
      borderRadius: 7,
      paddingHorizontal: 3,
      paddingVertical: 2,
      flexDirection: 'row',
      alignItems: 'center',
    },
    bmGlyphs: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    bmGlyph: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    bmStar: {
      position: 'absolute',
      top: 3,
    },
    bmPlus: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.text.tertiary,
      marginLeft: 2,
    },
    dietaryBadge: {
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    dietaryBadgeText: {
      fontSize: 10,
      color: colors.text.secondary,
      fontWeight: '600',
    },
    expandedSection: {
      marginTop: 10,
      marginHorizontal: -15,
      marginBottom: -15,
      paddingHorizontal: 15,
      paddingTop: 12,
      paddingBottom: 14,
      backgroundColor: colors.background.secondary,
    },
    descriptionText: {
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 18,
      marginBottom: 10,
    },
    macrosRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      borderRadius: 8,
      paddingVertical: 8,
      marginBottom: 10,
    },
    macroItem: {
      flex: 1,
      alignItems: 'center',
    },
    macroValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
    },
    macroLabel: {
      fontSize: 10,
      color: colors.text.tertiary,
      textTransform: 'uppercase',
      marginTop: 1,
    },
    macroDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.border.medium,
    },
    expandedDetailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginBottom: 8,
    },
    difficultyPill: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    difficultyPillText: {
      fontSize: 11,
      color: colors.text.tertiary,
    },
    vibeTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border.medium,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    vibeTagText: {
      fontSize: 11,
      color: colors.text.tertiary,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    historyText: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    friendsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    friendsText: {
      fontSize: 12,
      color: colors.text.secondary,
    },
  });
}
