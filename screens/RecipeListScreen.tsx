// screens/RecipeListScreen.tsx
// Updated: February 2026
// - Phase 3A Block 4: Browse modes (All/Cook Again/Try New) + header simplification
//   - Segmented control between header and quick chips
//   - Cook Again: SectionList with Recent Favorites, Forgotten Gems, Regulars sections
//   - Try New: book dropdown filter
//   - Header: removed More/filter button, replaced + with wide "Add Recipe" button

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  TimerIcon, FireIcon, BodybuilderIcon, LevelIcon, PiggyBankIcon,
  BookIcon, AgainIcon, NewIcon, GemIcon, PanIcon, FriendsIcon, PotIcon,
  EasyIcon, SearchIcon, SortIcon, StarIcon, PinIcon, ChefHat2, VegetablesIcon, SoupIcon,
} from '../components/icons';
import { VIBE_TAG_ICONS } from '../constants/vibeIcons';
import {
  StyleSheet,
  Text,
  View,
  Image,
  FlatList,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { RecipesStackParamList } from '../App';
import { useTheme } from '../lib/theme/ThemeContext';
import FilterDrawer, { FilterState } from '../components/FilterDrawer';
import { AddRecipeModal } from '../components/AddRecipeModal';
import { searchRecipesByMixedTerms } from '../lib/searchService';
import { getRecipeNutritionBatch, RecipeNutrition } from '../lib/services/nutritionService';
import { getCookingHistory, getFriendsCookingInfo, CookingHistory } from '../lib/services/recipeHistoryService';

type Props = NativeStackScreenProps<RecipesStackParamList, 'RecipeList'>;

type BrowseMode = 'all' | 'cook_again' | 'try_new';

type SortOption = 'newest' | 'alpha' | 'cal_low' | 'cal_high' | 'protein_high' | 'fastest' | 'most_cooked' | 'highest_rated';

interface Recipe {
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

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

interface QuickFilter {
  id: string;
  label: string;
  icon?: string;
  IconComponent?: IconComponent;
  active: boolean;
}

export default function RecipeListScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [nutritionMap, setNutritionMap] = useState<Map<string, RecipeNutrition>>(new Map());
  const [historyMap, setHistoryMap] = useState<Map<string, CookingHistory>>(new Map());
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Browse mode
  const [browseMode, setBrowseMode] = useState<BrowseMode>('all');
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [showBookDropdown, setShowBookDropdown] = useState(false);

  // Sort
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [sortAnchor, setSortAnchor] = useState({ top: 0, right: 0 });
  const sortButtonRef = useRef<any>(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionFormData, setSelectionFormData] = useState<any>(null);

  // Quick filters state
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([
    { id: 'vegetarian',   label: 'Vegetarian', IconComponent: VegetablesIcon, active: false },
    { id: 'highProtein',  label: 'High Protein', IconComponent: BodybuilderIcon, active: false },
    { id: 'quick30',      label: 'Under 30m', IconComponent: TimerIcon, active: false },
    { id: 'comfort',      label: 'Comfort', IconComponent: SoupIcon, active: false },
  ]);

  // Advanced filter state (managed by FilterDrawer)
  const [advancedFilters, setAdvancedFilters] = useState<Partial<FilterState>>({});

  // Smart counts
  const [pinnedCount, setPinnedCount] = useState(0);
  const [canMakeCount, setCanMakeCount] = useState(0);

  // ── Derived data ──────────────────────────────────────────────

  // Distinct book names for the Try New dropdown
  const availableBooks = useMemo(() => {
    const books = new Set<string>();
    recipes.forEach(r => { if (r.book_name) books.add(r.book_name); });
    return Array.from(books).sort();
  }, [recipes]);

  // Top hero ingredients across all recipes, sorted by frequency — passed to FilterDrawer
  const availableHeroIngredients = useMemo(() => {
    const counts: Record<string, number> = {};
    recipes.forEach(r => (r.hero_ingredients ?? []).forEach(h => {
      counts[h] = (counts[h] ?? 0) + 1;
    }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 50);
  }, [recipes]);

  // Cook Again sections — organises filteredRecipes (already browse-filtered) into smart groups
  const cookAgainSections = useMemo(() => {
    if (browseMode !== 'cook_again') return [];
    const now = Date.now();
    const msPerDay = 1000 * 60 * 60 * 24;

    const recentFavorites = filteredRecipes.filter(r => {
      if (!r.last_cooked) return false;
      const days = (now - new Date(r.last_cooked).getTime()) / msPerDay;
      return days <= 30 && (r.avg_rating ?? 0) >= 4;
    });

    const forgottenGems = filteredRecipes.filter(r => {
      if (!r.last_cooked) return false;
      const days = (now - new Date(r.last_cooked).getTime()) / msPerDay;
      return (r.avg_rating ?? 0) >= 4 && days > 60;
    });

    const regulars = filteredRecipes.filter(r => (r.times_cooked ?? 0) >= 3);

    const sections: { title: string; SectionIcon?: IconComponent; data: Recipe[] }[] = [];
    if (recentFavorites.length > 0) sections.push({ title: 'Recent Favorites', SectionIcon: FireIcon, data: recentFavorites });
    if (forgottenGems.length > 0) sections.push({ title: 'Forgotten Gems', SectionIcon: GemIcon, data: forgottenGems });
    if (regulars.length > 0) sections.push({ title: 'Regulars', SectionIcon: AgainIcon, data: regulars });

    // Fallback: show everything under a generic heading when no smart sections match
    if (sections.length === 0 && filteredRecipes.length > 0) {
      sections.push({ title: 'Cooked Recipes', data: filteredRecipes });
    }

    return sections;
  }, [filteredRecipes, browseMode]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 15,
    },
    header: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    cancelText: {
      fontSize: 16,
      color: colors.primary,
      width: 70,
    },
    selectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    addRecipeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      gap: 5,
    },
    addRecipeButtonIcon: {
      fontSize: 18,
      color: '#ffffff',
      fontWeight: '300',
      lineHeight: 20,
    },
    addRecipeButtonText: {
      fontSize: 14,
      color: '#ffffff',
      fontWeight: '600',
    },

    // ── Segmented control ─────────────────────────────────────────
    segmentedWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    segmentedContainer: {
      flexDirection: 'row',
      backgroundColor: colors.background.secondary,
      borderRadius: 10,
      padding: 3,
    },
    segmentedTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 7,
      paddingHorizontal: 4,
      borderRadius: 8,
      gap: 4,
    },
    segmentedTabActive: {
      backgroundColor: colors.background.card,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.12,
          shadowRadius: 2,
        },
        android: { elevation: 2 },
      }),
    },
    segmentedTabIcon: {
      fontSize: 13,
    },
    segmentedTabText: {
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    segmentedTabTextActive: {
      color: colors.text.primary,
      fontWeight: '700',
    },

    // ── Book filter ───────────────────────────────────────────────
    bookFilterContainer: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    bookFilterButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.background.card,
      borderWidth: 1,
      borderColor: colors.border.medium,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    bookFilterText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    bookFilterTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },

    // ── Book picker bottom sheet ──────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'flex-end',
    },
    bookPickerSheet: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 32,
      maxHeight: '60%',
    },
    bookPickerHeader: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    bookPickerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    bookPickerClose: {
      fontSize: 15,
      color: colors.primary,
    },
    bookOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    bookOptionText: {
      fontSize: 15,
      color: colors.text.primary,
    },
    bookCheckmark: {
      fontSize: 15,
      color: colors.primary,
    },

    // ── Sort button + dropdown ────────────────────────────────────
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      borderWidth: 1,
      borderColor: colors.border.medium,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 4,
    },
    sortButtonText: {
      fontSize: 13,
      color: colors.text.tertiary,
      fontWeight: '500',
    },
    sortOverlay: {
      flex: 1,
    },
    sortDropdown: {
      position: 'absolute',
      backgroundColor: colors.background.card,
      borderRadius: 12,
      minWidth: 210,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
        },
        android: { elevation: 10 },
      }),
      overflow: 'hidden',
    },
    sortDropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 10,
    },
    sortDropdownRowActive: {
      backgroundColor: colors.primaryLight,
    },
    sortDropdownIconContainer: {
      width: 22,
      alignItems: 'center' as const,
    },
    sortDropdownLabel: {
      fontSize: 14,
      color: colors.text.primary,
      flex: 1,
    },
    sortDropdownLabelActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    sortDropdownCheck: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '700',
    },
    sortDropdownDivider: {
      height: 1,
      backgroundColor: colors.border.light,
      marginHorizontal: 14,
    },

    // ── Section header (Cook Again SectionList) ───────────────────
    sectionHeader: {
      paddingHorizontal: 15,
      paddingTop: 16,
      paddingBottom: 8,
      backgroundColor: colors.background.primary,
    },
    sectionHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionHeaderText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
      letterSpacing: 0.2,
    },

    quickFiltersContainer: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    quickFiltersScroll: {
      paddingHorizontal: 15,
      gap: 8,
    },
    quickFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    quickFilterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    quickFilterIcon: {
      fontSize: 14,
      marginRight: 4,
    },
    quickFilterLabel: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    quickFilterLabelActive: {
      color: '#ffffff',
      fontWeight: '600',
    },
    moreChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    moreChipText: {
      fontSize: 13,
      color: colors.text.tertiary,
      fontWeight: '500',
    },
    clearFiltersChip: {
      backgroundColor: '#FF3B30',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
    },
    clearFiltersText: {
      color: colors.background.card,
      fontSize: 13,
      fontWeight: '600',
    },

    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.background.secondary,
    },
    statusText: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '600',
    },
    statusDot: {
      fontSize: 14,
      color: colors.text.tertiary,
    },

    listContainer: {
      padding: 15,
      paddingBottom: 10,
    },
    // Shadow lives on the wrapper (overflow: visible so iOS shadow isn't clipped)
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
    // Inner card clips content to rounded corners without killing the shadow
    card: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 15,
      overflow: 'hidden',
    },
    pinnedBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      zIndex: 1,
    },
    pinnedText: {
      fontSize: 20,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      flex: 1,
      marginRight: 10,
      color: colors.text.primary,
    },

    difficultyBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    difficultyEasy: {
      backgroundColor: '#E8F5E9',
    },
    difficultyMedium: {
      backgroundColor: '#FFF3E0',
    },
    difficultyAdvanced: {
      backgroundColor: '#FFEBEE',
    },
    difficultyText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      color: colors.text.primary,
    },

    metaRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    chefName: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    cuisineType: {
      fontSize: 14,
      color: colors.primary,
    },

    specialBadge: {
      backgroundColor: '#FFF9C4',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    specialBadgeText: {
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: '500',
    },

    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
    },
    statsLeft: {
      flexDirection: 'row',
      gap: 12,
      flex: 1,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statIcon: {
      fontSize: 14,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    statText: {
      fontSize: 13,
      color: colors.text.secondary,
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

    bottomSearchContainer: {
      backgroundColor: colors.background.card,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      paddingHorizontal: 15,
      paddingVertical: 10,
      paddingBottom: 20,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 25,
      paddingHorizontal: 15,
      paddingVertical: 12,
    },
    searchIcon: {
      fontSize: 18,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text.primary,
      padding: 0,
    },

    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.tertiary,
      marginBottom: 20,
    },
    clearButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    clearButtonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },

    // ── Expandable card layout ──────────────────────────────────────
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
  }), [colors]);

  useEffect(() => {
    loadRecipes();
    getCurrentUser();
  }, []);

  // Handle selection mode params - check on every focus
  useFocusEffect(
    useCallback(() => {
      const params = route.params;
      if (params?.selectionMode && params?.returnToMeals) {
        setIsSelectionMode(true);
        setSelectionFormData(params.mealFormData);
      } else {
        setIsSelectionMode(false);
        setSelectionFormData(null);
      }
    }, [route.params?.selectionMode, route.params?.returnToMeals])
  );

  useEffect(() => {
    const runFilters = async () => { await applyFilters(); };
    runFilters();
  }, [recipes, quickFilters, advancedFilters, browseMode, selectedBook, sortOption]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
  };

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          chefs:chef_id (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const recipesWithChefs = (data || []).map((recipe: any) => ({
        ...recipe,
        chef_name: recipe.chefs?.name || 'Unknown Chef',
        // book_name: populated from recipes table if a book_name column exists
        book_name: recipe.book_name || undefined,
      }));

      const recipesWithMatches = recipesWithChefs.map(r => ({ ...r, pantry_match: 0 }));

      const recipeIds = recipesWithMatches.map(r => r.id);
      const [nutritionResult, historyResult, friendsResult] = await Promise.allSettled([
        getRecipeNutritionBatch(recipeIds),
        getCookingHistory(user.id),
        getFriendsCookingInfo(user.id),
      ]);

      const nutMap = nutritionResult.status === 'fulfilled'
        ? nutritionResult.value
        : new Map<string, RecipeNutrition>();
      const hisMap = historyResult.status === 'fulfilled'
        ? historyResult.value
        : new Map<string, CookingHistory>();
      const frnMap = friendsResult.status === 'fulfilled'
        ? friendsResult.value
        : new Map();

      if (nutritionResult.status === 'rejected')
        console.error('Nutrition batch fetch failed:', nutritionResult.reason);
      if (historyResult.status === 'rejected')
        console.error('Cooking history fetch failed:', historyResult.reason);
      if (friendsResult.status === 'rejected')
        console.error('Friends cooking info fetch failed:', friendsResult.reason);

      setNutritionMap(nutMap);
      setHistoryMap(hisMap);

      const enrichedRecipes = recipesWithMatches.map(recipe => {
        const nutrition = nutMap.get(recipe.id);
        const history = hisMap.get(recipe.id);
        const friends = frnMap.get(recipe.id);
        return {
          ...recipe,
          ...(nutrition && {
            cal_per_serving: nutrition.cal_per_serving,
            protein_per_serving_g: nutrition.protein_per_serving_g,
            fat_per_serving_g: nutrition.fat_per_serving_g,
            carbs_per_serving_g: nutrition.carbs_per_serving_g,
            is_vegan: nutrition.is_vegan,
            is_vegetarian: nutrition.is_vegetarian,
            is_gluten_free: nutrition.is_gluten_free,
            is_dairy_free: nutrition.is_dairy_free,
            is_nut_free: nutrition.is_nut_free,
            is_shellfish_free: nutrition.is_shellfish_free,
            is_soy_free: nutrition.is_soy_free,
            is_egg_free: nutrition.is_egg_free,
            nutrition_quality_label: nutrition.quality_label,
          }),
          ...(history && {
            times_cooked: history.times_cooked,
            last_cooked: history.last_cooked,
            first_cooked: history.first_cooked,
            avg_rating: history.avg_rating,
            latest_rating: history.latest_rating,
          }),
          ...(friends && {
            friends_cooked_count: friends.friends_cooked_count,
          }),
        };
      });

      setRecipes(enrichedRecipes);
      setFilteredRecipes(enrichedRecipes);

      const pinned = enrichedRecipes.filter(r => r.is_pinned).length;
      const canMake = enrichedRecipes.filter(r => r.pantry_match >= 80).length;
      setPinnedCount(pinned);
      setCanMakeCount(canMake);

      setLoading(false);
    } catch (error) {
      console.error('Error loading recipes:', error);
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    let filtered = [...recipes];

    // 1. Browse mode (applied first)
    if (browseMode === 'cook_again') {
      filtered = filtered.filter(r => (r.times_cooked ?? 0) > 0);
    } else if (browseMode === 'try_new') {
      filtered = filtered.filter(r => (r.times_cooked ?? 0) === 0);
      if (selectedBook) {
        filtered = filtered.filter(r => r.book_name === selectedBook);
      }
    }

    // 2. Quick filters
    quickFilters.forEach(filter => {
      if (!filter.active) return;
      switch (filter.id) {
        case 'vegetarian':
          filtered = filtered.filter(r => r.is_vegetarian === true);
          break;
        case 'highProtein':
          filtered = filtered.filter(r =>
            r.protein_per_serving_g != null && r.protein_per_serving_g >= 25
          );
          break;
        case 'quick30':
          filtered = filtered.filter(r =>
            (r.total_time_min && r.total_time_min <= 30) ||
            (r.active_time_min && r.active_time_min <= 30) ||
            (r.prep_time_min + r.cook_time_min <= 30)
          );
          break;
        case 'comfort':
          filtered = filtered.filter(r =>
            r.vibe_tags?.some(t => t.toLowerCase() === 'comfort')
          );
          break;
      }
    });

    // 3. Advanced filters
    const af = advancedFilters;

    // Dietary — AND logic: every selected flag must be true on the recipe
    if (af.dietaryFlags) {
      const flags = af.dietaryFlags as Record<string, boolean | undefined>;
      Object.entries(flags).forEach(([key, required]) => {
        if (!required) return;
        filtered = filtered.filter(r => (r as any)[key] === true);
      });
    }

    // Hero ingredients — OR logic: at least one selected ingredient in recipe.hero_ingredients
    if (af.heroIngredients?.length) {
      filtered = filtered.filter(r =>
        af.heroIngredients!.some(h =>
          r.hero_ingredients?.some(rh => rh.toLowerCase() === h.toLowerCase())
        )
      );
    }

    // Vibe tags — OR logic
    if (af.vibeTags?.length) {
      filtered = filtered.filter(r =>
        af.vibeTags!.some(v =>
          r.vibe_tags?.some(rv => rv.toLowerCase() === v.toLowerCase())
        )
      );
    }

    // Nutrition
    if (af.maxCaloriesPerServing != null) {
      filtered = filtered.filter(r =>
        r.cal_per_serving == null || r.cal_per_serving <= af.maxCaloriesPerServing!
      );
    }
    if (af.minProteinPerServing != null) {
      filtered = filtered.filter(r =>
        r.protein_per_serving_g != null && r.protein_per_serving_g >= af.minProteinPerServing!
      );
    }

    // Time
    if (af.maxActiveTime != null) {
      filtered = filtered.filter(r =>
        r.active_time_min == null || r.active_time_min <= af.maxActiveTime!
      );
    }
    if (af.maxTotalTime != null) {
      filtered = filtered.filter(r =>
        (r.total_time_min == null || r.total_time_min <= af.maxTotalTime!) &&
        (r.active_time_min == null || r.active_time_min <= af.maxTotalTime!)
      );
    }

    // Difficulty — OR logic across selected levels
    if (af.difficultyLevels?.length) {
      filtered = filtered.filter(r =>
        r.difficulty_level != null && af.difficultyLevels!.includes(r.difficulty_level)
      );
    }
    if (af.easierThanLooks) {
      filtered = filtered.filter(r => r.easier_than_looks === true);
    }

    // Cooking methods — OR logic
    if (af.cookingMethods?.length) {
      filtered = filtered.filter(r =>
        r.cooking_methods?.some(m => af.cookingMethods!.includes(m))
      );
    }

    // Cuisine — OR logic
    if (af.cuisineTypes?.length) {
      filtered = filtered.filter(r =>
        r.cuisine_types?.some(c => af.cuisineTypes!.includes(c))
      );
    }

    // Course type — OR logic
    if (af.courseTypes?.length) {
      filtered = filtered.filter(r =>
        r.course_type != null && af.courseTypes!.includes(r.course_type)
      );
    }

    // Ingredient count ranges — OR logic (ranges are '1–5', '6–10', etc.)
    if (af.ingredientCountRanges?.length) {
      filtered = filtered.filter(r => {
        if (r.ingredient_count == null) return false;
        return af.ingredientCountRanges!.some(range => {
          if (range === '16+') return r.ingredient_count! >= 16;
          const [lo, hi] = range.split('–').map(Number);
          return r.ingredient_count! >= lo && r.ingredient_count! <= hi;
        });
      });
    }

    // Make-ahead
    if (af.makeAheadFriendly) {
      filtered = filtered.filter(r => r.make_ahead_friendly === true);
    }

    // Serving temp — OR logic
    if (af.servingTemp?.length) {
      filtered = filtered.filter(r =>
        r.serving_temp != null && af.servingTemp!.includes(r.serving_temp)
      );
    }

    // Social
    if (af.recentlySaved) {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(r =>
        (r as any).created_at && new Date((r as any).created_at).getTime() >= thirtyDaysAgo
      );
    }
    if (af.recentlyCookedByFriends) {
      filtered = filtered.filter(r => (r.friends_cooked_count ?? 0) > 0);
    }

    // 4. Sort (nulls/undefineds pushed to end)
    switch (sortOption) {
      case 'newest':
        // Already ordered by created_at desc from the query — no-op
        break;
      case 'alpha':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'cal_low':
        filtered.sort((a, b) => {
          if (a.cal_per_serving == null && b.cal_per_serving == null) return 0;
          if (a.cal_per_serving == null) return 1;
          if (b.cal_per_serving == null) return -1;
          return a.cal_per_serving - b.cal_per_serving;
        });
        break;
      case 'cal_high':
        filtered.sort((a, b) => {
          if (a.cal_per_serving == null && b.cal_per_serving == null) return 0;
          if (a.cal_per_serving == null) return 1;
          if (b.cal_per_serving == null) return -1;
          return b.cal_per_serving - a.cal_per_serving;
        });
        break;
      case 'protein_high':
        filtered.sort((a, b) => {
          if (a.protein_per_serving_g == null && b.protein_per_serving_g == null) return 0;
          if (a.protein_per_serving_g == null) return 1;
          if (b.protein_per_serving_g == null) return -1;
          return b.protein_per_serving_g - a.protein_per_serving_g;
        });
        break;
      case 'fastest':
        filtered.sort((a, b) => {
          const timeA = a.total_time_min ?? a.active_time_min ?? null;
          const timeB = b.total_time_min ?? b.active_time_min ?? null;
          if (timeA == null && timeB == null) return 0;
          if (timeA == null) return 1;
          if (timeB == null) return -1;
          return timeA - timeB;
        });
        break;
      case 'most_cooked':
        filtered.sort((a, b) => {
          const ca = a.times_cooked ?? 0;
          const cb = b.times_cooked ?? 0;
          if (ca === 0 && cb === 0) return 0;
          if (ca === 0) return 1;
          if (cb === 0) return -1;
          return cb - ca;
        });
        break;
      case 'highest_rated':
        filtered.sort((a, b) => {
          if (a.avg_rating == null && b.avg_rating == null) return 0;
          if (a.avg_rating == null) return 1;
          if (b.avg_rating == null) return -1;
          return b.avg_rating - a.avg_rating;
        });
        break;
    }

    setFilteredRecipes(filtered);
  };

  const toggleQuickFilter = (filterId: string) => {
    setQuickFilters(prev =>
      prev.map(f => f.id === filterId ? { ...f, active: !f.active } : f)
    );
  };

  const clearAllFilters = () => {
    setQuickFilters(prev => prev.map(f => ({ ...f, active: false })));
    setAdvancedFilters({
      dietaryFlags: {},
      heroIngredients: [],
      vibeTags: [],
      difficultyLevels: [],
      cookingMethods: [],
      cuisineTypes: [],
      courseTypes: [],
      ingredientCountRanges: [],
      servingTemp: [],
      easierThanLooks: false,
      makeAheadFriendly: false,
      recentlySaved: false,
      recentlyCookedByFriends: false,
    });
    setSearchText('');
    setBrowseMode('all');
    setSelectedBook(null);
    setFilteredRecipes(recipes);
  };

  const getActiveFilterCount = () => {
    const quickCount = quickFilters.filter(f => f.active).length;
    const advancedCount = Object.keys(advancedFilters).length;
    return quickCount + advancedCount;
  };

  const handleSearch = async () => {
    if (!searchText.trim()) {
      await applyFilters();
      return;
    }

    Keyboard.dismiss();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const recipeIds = await searchRecipesByMixedTerms([searchText]);

      if (recipeIds.length === 0) {
        setFilteredRecipes([]);
        return;
      }

      const { data: searchResults, error } = await supabase
        .from('recipes')
        .select(`
          *,
          chefs:chef_id (name)
        `)
        .eq('user_id', user.id)
        .in('id', recipeIds);

      if (error) throw error;

      const recipesWithChefs = (searchResults || []).map((recipe: any) => ({
        ...recipe,
        chef_name: recipe.chefs?.name || 'Unknown Chef',
        pantry_match: 0,
      }));

      setFilteredRecipes(recipesWithChefs);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleRecipePress = (recipe: Recipe) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  const handleSelectForMeal = (recipe: Recipe) => {
    navigation.getParent()?.navigate('MealsStack', {
      screen: 'MyMealsList',
      params: {
        selectedRecipe: {
          id: recipe.id,
          title: recipe.title,
          image_url: recipe.image_url,
        },
        returnedFormData: selectionFormData,
      },
    });
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectionFormData(null);
    navigation.setParams({ selectionMode: undefined, returnToMeals: undefined, mealFormData: undefined } as any);
    navigation.getParent()?.navigate('MealsStack', {
      screen: 'MyMealsList',
      params: { returnedFormData: selectionFormData },
    });
  };

  const handleSortPress = () => {
    sortButtonRef.current?.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
      const screenWidth = Dimensions.get('window').width;
      setSortAnchor({
        top: pageY + height + 6,
        right: screenWidth - pageX - width,
      });
      setShowSortPicker(true);
    });
  };

  // ── Render helpers ──────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {isSelectionMode ? (
        <>
          <TouchableOpacity onPress={handleCancelSelection}>
            <Text style={styles.cancelText}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>Select a Recipe</Text>
          <View style={{ width: 70 }} />
        </>
      ) : (
        <>
          <Text style={styles.header}>Recipes</Text>
          <TouchableOpacity
            style={styles.addRecipeButton}
            onPress={() => setShowAddRecipeModal(true)}
          >
            <Text style={styles.addRecipeButtonIcon}>+</Text>
            <Text style={styles.addRecipeButtonText}>Add Recipe</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderSegmentedControl = () => {
    if (isSelectionMode) return null;

    const tabs: { mode: BrowseMode; TabIcon: IconComponent; label: string }[] = [
      { mode: 'all', TabIcon: BookIcon, label: 'All' },
      { mode: 'cook_again', TabIcon: AgainIcon, label: 'Cook Again' },
      { mode: 'try_new', TabIcon: NewIcon, label: 'Try New' },
    ];

    return (
      <View style={styles.segmentedWrapper}>
        <View style={styles.segmentedContainer}>
          {tabs.map(tab => {
            const active = browseMode === tab.mode;
            return (
              <TouchableOpacity
                key={tab.mode}
                style={[styles.segmentedTab, active && styles.segmentedTabActive]}
                onPress={() => { setBrowseMode(tab.mode); setExpandedCardId(null); }}
                activeOpacity={0.8}
              >
                <tab.TabIcon size={13} color={active ? '#fff' : colors.text.tertiary} />
                <Text style={[styles.segmentedTabText, active && styles.segmentedTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderBookFilter = () => {
    if (browseMode !== 'try_new' || availableBooks.length === 0) return null;
    return (
      <View style={styles.bookFilterContainer}>
        <TouchableOpacity
          style={styles.bookFilterButton}
          onPress={() => setShowBookDropdown(true)}
        >
          <Text style={[styles.bookFilterText, !!selectedBook && styles.bookFilterTextActive]}>
            {selectedBook ?? 'All Books'} ▾
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderBookPickerModal = () => (
    <Modal
      visible={showBookDropdown}
      transparent
      animationType="slide"
      onRequestClose={() => setShowBookDropdown(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowBookDropdown(false)}
      >
        <View style={styles.bookPickerSheet}>
          <View style={styles.bookPickerHeader}>
            <Text style={styles.bookPickerTitle}>Filter by Book</Text>
            <TouchableOpacity onPress={() => setShowBookDropdown(false)}>
              <Text style={styles.bookPickerClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            <TouchableOpacity
              style={styles.bookOption}
              onPress={() => { setSelectedBook(null); setShowBookDropdown(false); }}
            >
              <Text style={styles.bookOptionText}>All Books</Text>
              {!selectedBook && <Text style={styles.bookCheckmark}>✓</Text>}
            </TouchableOpacity>
            {availableBooks.map(book => (
              <TouchableOpacity
                key={book}
                style={styles.bookOption}
                onPress={() => { setSelectedBook(book); setShowBookDropdown(false); }}
              >
                <Text style={styles.bookOptionText}>{book}</Text>
                {selectedBook === book && <Text style={styles.bookCheckmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderSortPickerModal = () => {
    const options: { value: SortOption; IconComponent: IconComponent; label: string }[] = [
      { value: 'newest',       IconComponent: AgainIcon,       label: 'Newest' },
      { value: 'alpha',        IconComponent: SortIcon,        label: 'A → Z' },
      { value: 'cal_low',      IconComponent: FireIcon,        label: 'Cal: Low → High' },
      { value: 'cal_high',     IconComponent: FireIcon,        label: 'Cal: High → Low' },
      { value: 'protein_high', IconComponent: BodybuilderIcon, label: 'Protein: High' },
      { value: 'fastest',      IconComponent: TimerIcon,       label: 'Fastest' },
      { value: 'most_cooked',  IconComponent: PanIcon,         label: 'Most Cooked' },
      { value: 'highest_rated',IconComponent: StarIcon,        label: 'Highest Rated' },
    ];

    return (
      <Modal
        visible={showSortPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortPicker(false)}
      >
        <TouchableOpacity
          style={styles.sortOverlay}
          activeOpacity={1}
          onPress={() => setShowSortPicker(false)}
        >
          <View style={[styles.sortDropdown, { top: sortAnchor.top, right: sortAnchor.right }]}>
            {options.map((opt, index) => {
              const active = sortOption === opt.value;
              return (
                <View key={opt.value}>
                  {index > 0 && <View style={styles.sortDropdownDivider} />}
                  <TouchableOpacity
                    style={[styles.sortDropdownRow, active && styles.sortDropdownRowActive]}
                    onPress={() => { setSortOption(opt.value); setShowSortPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sortDropdownIconContainer}>
                      <opt.IconComponent size={16} color={active ? colors.primary : colors.text.tertiary} />
                    </View>
                    <Text style={[styles.sortDropdownLabel, active && styles.sortDropdownLabelActive]}>
                      {opt.label}
                    </Text>
                    {active && <Text style={styles.sortDropdownCheck}>✓</Text>}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string; SectionIcon?: IconComponent } }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderContent}>
        {section.SectionIcon && <section.SectionIcon size={18} color={colors.primary} />}
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    </View>
  );

  const renderQuickFilters = () => (
    <View style={styles.quickFiltersContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickFiltersScroll}
      >
        {quickFilters.map(filter => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.quickFilterChip,
              filter.active && styles.quickFilterChipActive
            ]}
            onPress={() => toggleQuickFilter(filter.id)}
          >
            {filter.IconComponent
              ? <filter.IconComponent size={14} color={filter.active ? '#fff' : colors.text.secondary} />
              : filter.icon ? <Text style={styles.quickFilterIcon}>{filter.icon}</Text> : null}
            <Text style={[
              styles.quickFilterLabel,
              filter.active && styles.quickFilterLabelActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* More › chip — opens FilterDrawer */}
        <TouchableOpacity
          style={styles.moreChip}
          onPress={() => setShowFilterDrawer(true)}
        >
          <Text style={styles.moreChipText}>More ›</Text>
        </TouchableOpacity>

        {/* Sort button */}
        <TouchableOpacity
          ref={sortButtonRef}
          style={styles.sortButton}
          onPress={handleSortPress}
        >
          <SortIcon size={14} color={colors.text.tertiary} />
          <Text style={styles.sortButtonText}>Sort</Text>
        </TouchableOpacity>

        {getActiveFilterCount() > 0 && (
          <TouchableOpacity
            style={styles.clearFiltersChip}
            onPress={clearAllFilters}
          >
            <Text style={styles.clearFiltersText}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  const renderStatusBar = () => {
    if (browseMode === 'cook_again') {
      return (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} you've cooked
          </Text>
        </View>
      );
    }
    if (browseMode === 'try_new') {
      return (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} to try
          </Text>
        </View>
      );
    }
    if (filteredRecipes.length === recipes.length && getActiveFilterCount() === 0) {
      return null;
    }
    return (
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
        </Text>
        {canMakeCount > 0 && (
          <>
            <Text style={styles.statusDot}> • </Text>
            <Text style={styles.statusText}>{canMakeCount} you can make now</Text>
          </>
        )}
      </View>
    );
  };

  const renderBottomSearchBar = () => (
    <View style={styles.bottomSearchContainer}>
      <View style={styles.searchBar}>
        <SearchIcon size={18} color={colors.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes (e.g., lemon, molly or basil, italian)"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );

  const formatRelativeTime = (dateStr: string): string => {
    const diffDays = Math.floor(
      (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const buildDietaryBadges = (recipe: Recipe) => {
    if (recipe.cal_per_serving == null) return [];
    const badges: { key: string; label: string }[] = [];
    if (recipe.is_vegan) badges.push({ key: 'vegan', label: 'VG' });
    else if (recipe.is_vegetarian) badges.push({ key: 'veg', label: 'V' });
    if (recipe.is_gluten_free) badges.push({ key: 'gf', label: 'GF' });
    if (recipe.is_dairy_free) badges.push({ key: 'df', label: 'DF' });
    if (recipe.is_nut_free) badges.push({ key: 'nf', label: 'NF' });
    return badges;
  };

  const renderRecipeCard = ({ item }: { item: Recipe }) => {
    const isExpanded = expandedCardId === item.id;
    const toggleExpand = () => setExpandedCardId(isExpanded ? null : item.id);

    const timeStr = item.prep_time_min && item.cook_time_min
      ? `${item.prep_time_min + item.cook_time_min}m`
      : item.total_time_min
      ? `${item.total_time_min}m`
      : item.active_time_min
      ? `${item.active_time_min}m`
      : null;

    const showChef = item.chef_name && item.chef_name !== 'Unknown Chef';
    const dietaryBadges = buildDietaryBadges(item);

    return (
      <View style={styles.cardWrapper}>
      <TouchableOpacity style={styles.card} onPress={toggleExpand} activeOpacity={0.95}>

        {/* ── Collapsed row: left content + right image ── */}
        <View style={styles.cardRow}>

          {/* Left column */}
          <View style={styles.cardLeft}>

            {/* Title + chef → navigate to detail */}
            <TouchableOpacity onPress={() => handleRecipePress(item)} activeOpacity={0.7}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              {showChef && (
                <View style={styles.chefLine}>
                  <ChefHat2 size={12} color={colors.text.secondary} />
                  <Text style={styles.chefLineText} numberOfLines={1}>{item.chef_name}</Text>
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
            <TouchableOpacity onPress={() => handleRecipePress(item)} activeOpacity={0.7}>
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
            onPress={() => handleSelectForMeal(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.selectButtonText}>Select</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      </View>
    );
  };

  const emptyListComponent = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {searchText
          ? 'No recipes found'
          : browseMode === 'cook_again'
          ? "You haven't cooked any recipes yet"
          : browseMode === 'try_new'
          ? 'No new recipes to try'
          : 'No recipes yet'}
      </Text>
      {(searchText || getActiveFilterCount() > 0) && (
        <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}>
          <Text style={styles.clearButtonText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {renderHeader()}
      {renderSegmentedControl()}
      {renderBookFilter()}
      {renderQuickFilters()}
      {renderStatusBar()}

      {browseMode === 'cook_again' ? (
        <SectionList
          sections={cookAgainSections}
          renderItem={renderRecipeCard}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={emptyListComponent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <FlatList
          data={filteredRecipes}
          renderItem={renderRecipeCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={emptyListComponent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom search bar - hide in selection mode */}
      {!isSelectionMode && renderBottomSearchBar()}

      {/* Book picker modal */}
      {renderBookPickerModal()}

      {/* Sort picker modal */}
      {renderSortPickerModal()}

      {/* Filter Drawer */}
      <FilterDrawer
        visible={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        filters={advancedFilters as FilterState}
        onApplyFilters={(filters: FilterState) => {
          setAdvancedFilters(filters);
          setShowFilterDrawer(false);
        }}
        availableHeroIngredients={availableHeroIngredients}
      />

      {/* Add Recipe Modal - only in normal mode */}
      {!isSelectionMode && (
        <AddRecipeModal
          visible={showAddRecipeModal}
          onClose={() => setShowAddRecipeModal(false)}
          onSelectCamera={() => {
            setShowAddRecipeModal(false);
            if (userId) {
              navigation.navigate('AddRecipeFromPhoto', {
                userId: userId,
                source: 'camera',
              });
            }
          }}
          onSelectGallery={() => {
            setShowAddRecipeModal(false);
            if (userId) {
              navigation.navigate('AddRecipeFromPhoto', {
                userId: userId,
                source: 'gallery',
              });
            }
          }}
          onSelectWeb={() => {
            setShowAddRecipeModal(false);
            if (userId) {
              navigation.navigate('AddRecipeFromUrl', {
                userId: userId,
              });
            }
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}
