// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
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
  PantryOutline,
} from '../components/icons';
import GlobeIcon from '../components/icons/recipe/GlobeIcon';
import { VIBE_TAG_ICONS } from '../constants/vibeIcons';
import {
  StyleSheet,
  Text,
  View,
  Image,
  FlatList,
  SectionList,
  TouchableOpacity,
  Pressable,
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
import RefineSheet, { FilterState, type SectionId } from '../components/RefineSheet';
import { AddRecipeModal } from '../components/AddRecipeModal';
import { getSearchEntities, getSearchSuggestions, searchRecipesByScopedTerms } from '../lib/searchService';
import {
  processBox,
  tokenize,
  effectiveSearchTerms,
  matchSuggestions,
  isSearchSuggestion,
  KIND_LABEL,
  type SearchTerm,
  type Suggestion,
} from '../lib/searchTerms';
import { getRecipeNutritionBatch, RecipeNutrition } from '../lib/services/nutritionService';
import { getCookingHistory, getFriendsCookingInfo, CookingHistory } from '../lib/services/recipeHistoryService';
import {
  getDietaryPreferences,
  DIETARY_FLAG_KEYS,
  DietaryPreferences,
} from '../lib/services/dietaryPreferencesService';
import { calculateRecipeSupplyMatchBulk, PantryMatchResult } from '../lib/services/pantryMatchingService';
import { filterReadyToCook, getRecipeIngredientNames } from '../lib/services/readyToCookService';
import { RecipeCard, type Recipe } from '../components/recipe/RecipeCard';
import { BrowseLensChip } from '../components/recipe/BrowseLensChip';
import BookmarkFilterRow from '../components/recipe/BookmarkFilterRow';
import BookmarkSheet from '../components/recipe/BookmarkSheet';
import { getRecipesForBookmark, getBookmarksByRecipe, type Bookmark } from '../lib/services/bookmarkService';
import {
  resolveBrowse,
  getCookAgainSections,
  DEFAULT_TILES,
  FACET_META,
  getActiveFacets,
  isFacetActive,
  type BrowseState,
  type BrowseContextId,
  type FacetId,
  type SortOption,
} from '../lib/services/recipeBrowseService';
import { useActiveSpaceId } from '../contexts/SpaceContext';
import { useCollapsibleHeader } from '../hooks/useCollapsibleHeader';
import Slider from '@react-native-community/slider';
import { ImportQueueStrip } from '../components/onboarding/ImportQueueStrip';

type Props = NativeStackScreenProps<RecipesStackParamList, 'RecipeList'>;

// 11A-CP2: local Recipe interface folded into the canonical
// `components/recipe/RecipeCard.tsx` export (CP1 carryover cleanup #1).
// Browse-mode type is now BrowseContextId from recipeBrowseService.

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

// 11D: adjustable macro thresholds. Each can be HIGH (≥, min field) or LOW
// (≤, max field). Driven by the search typeahead + tap-to-adjust pills; the
// resolver applies the fields. (Recipes only carry cal/protein/carbs/fat per
// serving — sugar/fiber/sodium aren't available.)
type NutrientKey = 'calories' | 'protein' | 'carbs' | 'fat';
interface NutrientCfg {
  label: string;
  unit: string;
  minField: keyof FilterState;
  maxField: keyof FilterState;
  recipeField: 'cal_per_serving' | 'protein_per_serving_g' | 'carbs_per_serving_g' | 'fat_per_serving_g';
  defaultDir: 'min' | 'max';
  defaultValue: number;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
}
const NUTRIENTS: Record<NutrientKey, NutrientCfg> = {
  calories: { label: 'Calories', unit: '',     minField: 'minCaloriesPerServing', maxField: 'maxCaloriesPerServing', recipeField: 'cal_per_serving',        defaultDir: 'max', defaultValue: 600, sliderMin: 0, sliderMax: 1200, sliderStep: 50 },
  protein:  { label: 'Protein',  unit: 'g',     minField: 'minProteinPerServing',  maxField: 'maxProteinPerServing',  recipeField: 'protein_per_serving_g', defaultDir: 'min', defaultValue: 25,  sliderMin: 0, sliderMax: 60,   sliderStep: 5 },
  carbs:    { label: 'Carbs',    unit: 'g',     minField: 'minCarbsPerServing',    maxField: 'maxCarbsPerServing',    recipeField: 'carbs_per_serving_g',   defaultDir: 'max', defaultValue: 30,  sliderMin: 0, sliderMax: 100,  sliderStep: 5 },
  fat:      { label: 'Fat',      unit: 'g',     minField: 'minFatPerServing',      maxField: 'maxFatPerServing',      recipeField: 'fat_per_serving_g',     defaultDir: 'max', defaultValue: 20,  sliderMin: 0, sliderMax: 60,   sliderStep: 5 },
};
const TIME_SLIDER = { min: 10, max: 120, step: 5 };

// 11D: bucket recipes by a numeric value into N bins for the slider histogram.
const HISTO_BINS = 18;
function buildHistogram(
  items: Recipe[],
  accessor: (r: Recipe) => number | null | undefined,
  min: number,
  max: number,
  bins: number,
): number[] {
  const size = (max - min) / bins;
  const out = new Array(bins).fill(0);
  for (const r of items) {
    const x = accessor(r);
    if (x == null) continue;
    let i = Math.floor((x - min) / size);
    if (i < 0) i = 0;
    if (i >= bins) i = bins - 1;
    out[i]++;
  }
  return out;
}

// 11A-CP3: legacy QuickFilter interface removed — the four quick filters are
// now facet-driven refinements on BrowseState.refinements (dietary, protein,
// quickUnder30, vibeTags).

export default function RecipeListScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const activeSpaceId = useActiveSpaceId();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  // 11A-CP2 (CP1 carryover cleanup #2): `filteredRecipes` is now a useMemo
  // derived from `browseState`. Declared below alongside the other browse
  // useMemos.
  // 8R-UX1: search results live as a Set of recipe IDs (or null = no active
  // search). applyFilters intersects with this; previously handleSearch wrote
  // straight to filteredRecipes and got clobbered by the next applyFilters
  // re-run when matchMap updated.
  const [searchedRecipeIds, setSearchedRecipeIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  // 11A-CP4: section the RefineSheet should scroll to on open. The `cuisine`
  // facet sets this to 'cuisine' so the user lands on the picker directly
  // instead of scrolling past Time/Nutrition/Dietary. Cleared on close.
  const [refineInitialSection, setRefineInitialSection] = useState<SectionId | undefined>(undefined);
  // 11A-CP5a: explicit screen mode. 'home' = tiles only (discovery); 'list' =
  // recipe list with the compact filter line. Explicit rather than derived so
  // "Browse all" can land in Mode B with context='all' (which derivation from
  // context alone can't express). Initial value 'home'.
  const [screenMode, setScreenMode] = useState<'home' | 'list'>('home');
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  // 11D stacked search — committed search terms (pills); the box (`searchText`)
  // holds the in-progress word. `entitySet` (real ingredient + chef names)
  // keeps multi-word entities like "olive oil" from splitting.
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [entitySet, setEntitySet] = useState<Set<string>>(new Set());
  // 11D typeahead — suggestion index (ingredients/categories/chefs/cuisines).
  const [suggestionIndex, setSuggestionIndex] = useState<Suggestion[]>([]);
  // 11D: true while a committed search is in flight — shows a spinner in the
  // list area so an Enter-commit lands on the list immediately (with pills)
  // rather than hanging on the home screen until results return.
  const [searching, setSearching] = useState(false);
  // 11D: tap-a-pill threshold picker target (a macro w/ direction, or time).
  const [adjustTarget, setAdjustTarget] = useState<{ kind: 'time' } | { kind: 'nutrient'; nutrient: NutrientKey } | null>(null);
  const [adjustDir, setAdjustDir] = useState<'min' | 'max'>('max');
  const [sliderValue, setSliderValue] = useState(0);
  // Recipes passing ALL other active filters except the one being adjusted —
  // cached on open so the live count is a cheap numeric filter per slider tick.
  const [adjustBaseSet, setAdjustBaseSet] = useState<Recipe[]>([]);
  // Histogram bin counts (the distribution of the base set across the range).
  const [adjustBins, setAdjustBins] = useState<number[]>([]);
  // CP6d-SmokeFix-3 (D11): set when initialIngredient route param drives the
  // search; the next searchText change after this flag triggers handleSearch.
  const [userId, setUserId] = useState<string | null>(null);
  // Bookmark view-filter (single-select). Applied to the list only in list mode.
  const [activeBookmark, setActiveBookmark] = useState<string | null>(null);
  const [bookmarkFilterIds, setBookmarkFilterIds] = useState<Set<string> | null>(null);
  // Per-recipe bookmark assignments for the card glyphs + the picker sheet.
  const [bookmarksByRecipe, setBookmarksByRecipe] = useState<Map<string, Bookmark[]>>(new Map());
  const [bookmarkSheetRecipeId, setBookmarkSheetRecipeId] = useState<string | null>(null);
  const [bmVersion, setBmVersion] = useState(0);
  const [nutritionMap, setNutritionMap] = useState<Map<string, RecipeNutrition>>(new Map());
  const [historyMap, setHistoryMap] = useState<Map<string, CookingHistory>>(new Map());
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Browse mode — 11A-CP2: BrowseContextId now covers tile contexts as well.
  const [browseMode, setBrowseMode] = useState<BrowseContextId>('all');
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [showBookDropdown, setShowBookDropdown] = useState(false);

  // Sort
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [sortAnchor, setSortAnchor] = useState({ top: 0, right: 0 });
  const sortButtonRef = useRef<any>(null);
  // 11D: monotonically-increasing search id so a slower earlier query can't
  // clobber a newer one's results as the user types (latest-wins guard).
  const searchSeqRef = useRef(0);

  // 11D: direction-aware collapsing filter chrome (list mode). Scrolling down
  // collapses search bar + filter line + status to a tappable pill; scrolling
  // up / reaching the top restores them. `listRef` powers scroll-to-top on
  // pill tap.
  const { collapsed, onScroll: onListScroll, expand: expandHeader } = useCollapsibleHeader();
  const listRef = useRef<any>(null);
  const scrollListToTop = useCallback(() => {
    const r: any = listRef.current;
    if (!r) return;
    if (r.scrollToOffset) r.scrollToOffset({ offset: 0, animated: true });
    else if (r.scrollToLocation) {
      try { r.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true }); } catch {}
    }
  }, []);
  // Start every fresh result view expanded (new search / tile / mode) so the
  // chrome is visible before the user scrolls.
  useEffect(() => { expandHeader(); }, [screenMode, browseMode, searchedRecipeIds, expandHeader]);

  // 8D-CP1: bulk recipe ↔ pantry match results, keyed by recipe id.
  const [matchMap, setMatchMap] = useState<Map<string, PantryMatchResult>>(new Map());
  // 8D-CP4: per-recipe catalog ingredient {id,name} pairs — needed for the
  // ready-to-cook hero-resolution gate (recipes.hero_ingredients has no ids).
  const [recipeIngredientsMap, setRecipeIngredientsMap] = useState<
    Map<string, Array<{ id: string; name: string }>>
  >(new Map());

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionFormData, setSelectionFormData] = useState<any>(null);

  // 11A-CP3: legacy quickFilters state removed. The four semantics now live
  // as refinements toggled via the contextual facet row (see refine surface
  // below): `vegetarian` → dietaryFlags.is_vegetarian, `highProtein` →
  // minProteinPerValues=25, `quick30` → quickUnder30=true, `comfort` →
  // vibeTags=['comfort'] (the latter is via More, not a default facet).

  // Advanced filter state (managed by FilterDrawer + the CP3 facet row)
  const [advancedFilters, setAdvancedFilters] = useState<Partial<FilterState>>({});

  // 10F — user dietary prefs auto-applied to refinements.dietaryFlags on load.
  // CP3 removes the "From your dietary preferences / Show all" text indicator;
  // active dietary flags now render as dismissible refinement chips in the
  // refine row (clearing one removes the chip without touching saved prefs).
  const [userDietaryPrefs, setUserDietaryPrefs] = useState<DietaryPreferences | null>(null);

  // Smart counts
  const [pinnedCount, setPinnedCount] = useState(0);
  // 8D-CP4: canMakeCount is now derived (useMemo below), not state.

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

  // NYT import — distinct web-source domains across the user's recipes,
  // most-common first. Feeds the RefineSheet "Source" multi-select (raw domains;
  // friendly labels via sourceLabel()).
  const availableSources = useMemo(() => {
    const counts: Record<string, number> = {};
    recipes.forEach(r => {
      const d = (r as any).source_domain;
      if (d) counts[d] = (counts[d] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([d]) => d);
  }, [recipes]);

  // 8D-CP4: recipes with the real pantry_match % threaded in from the matcher
  // (was always 0). Derived — never mutates `recipes` state. applyFilters runs
  // over this so filteredRecipes carry the populated field.
  const recipesWithMatch = useMemo(
    () => recipes.map(r => ({
      ...r,
      pantry_match: matchMap.get(r.id)?.matchPercentage ?? 0,
    })),
    [recipes, matchMap]
  );

  // 11A-CP2: ready-to-cook id set (used by both the `ready_to_cook` tile
  // context predicate and the legacy "X you can make now" badge). Computed
  // once via readyToCookService.filterReadyToCook over matchMap +
  // recipeIngredientsMap; the tile context predicate just does set membership.
  // Returns null when the gate hasn't been computed yet (no supplies / no
  // recipes loaded), which the predicate treats as "no matches".
  const readyToCookIds = useMemo<Set<string> | null>(() => {
    if (recipes.length === 0 || matchMap.size === 0) return null;
    const withIngredients = recipes.map(r => ({
      ...r,
      ingredients: recipeIngredientsMap.get(r.id) ?? [],
    }));
    const ready = filterReadyToCook(withIngredients, matchMap);
    return new Set(ready.map(r => r.id));
  }, [recipes, matchMap, recipeIngredientsMap]);

  // 8D-CP4: "X you can make now" status-bar count, now derived from
  // readyToCookIds (was its own filterReadyToCook call; consolidated in CP2).
  const canMakeCount = readyToCookIds?.size ?? 0;

  // 11A-CP2: dictionary of dietary flags the user has set in their preferences.
  // Drives the `for_your_diet` tile predicate (AND over set flags) and its
  // liveness gate (live iff at least one flag is set).
  const userDietaryFlagsActive = useMemo<Record<string, boolean>>(() => {
    if (!userDietaryPrefs) return {};
    const flags: Record<string, boolean> = {};
    DIETARY_FLAG_KEYS.forEach(k => {
      if (userDietaryPrefs[k]) flags[k] = true;
    });
    return flags;
  }, [userDietaryPrefs]);

  // 11A-CP2: cookAgainSections moved to live next to the filteredRecipes
  // useMemo (now derived from browseState rather than useState/useEffect).
  // See "browse derivations" block below the route-param effect.

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

    // ── 11A-CP2: top search + tile grid + cuisine strip ───────────
    topSearchContainer: {
      paddingHorizontal: 15,
      paddingTop: 0,
      paddingBottom: 10,
    },
    topSearchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 25,
      paddingHorizontal: 15,
      paddingVertical: 11,
    },
    // 11D typeahead suggestion dropdown (under the search bar).
    suggestionDropdown: {
      marginTop: 6,
      backgroundColor: colors.background.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
      overflow: 'hidden',
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 10,
    },
    suggestionRowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    suggestionLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.text.primary,
    },
    suggestionKind: {
      fontSize: 11,
      color: colors.text.tertiary,
      textTransform: 'capitalize',
      fontWeight: '600',
    },
    tilePrompt: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: '600',
      paddingHorizontal: 15,
      paddingTop: 2,
      paddingBottom: 8,
    },
    tileGrid: {
      paddingHorizontal: 11,
      paddingBottom: 4,
    },
    tileRow: {
      flexDirection: 'row',
    },
    tileCell: {
      flex: 1,
      marginHorizontal: 4,
      marginVertical: 4,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.background.card,
      borderWidth: 1,
      borderColor: colors.border.light,
      minHeight: 78,
    },
    tileCellInroad: {
      borderStyle: 'dashed',
      backgroundColor: colors.background.primary,
      borderColor: colors.border.medium,
    },
    tileTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    tileLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
      flex: 1,
    },
    tileLabelInroad: {
      color: colors.text.tertiary,
      fontWeight: '500',
    },
    tileCount: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.primary,
    },
    tileCountMuted: {
      color: colors.text.tertiary,
    },
    tileInroadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tileInroadText: {
      fontSize: 11,
      color: colors.text.tertiary,
      flex: 1,
    },
    tileInroadArrow: {
      fontSize: 14,
      color: colors.text.tertiary,
    },
    cuisineStripContainer: {
      paddingTop: 4,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    bookmarkFilterRow: {
      paddingLeft: 15,
      paddingTop: 8,
      paddingBottom: 8,
    },
    cuisineStripLabel: {
      fontSize: 13,
      color: colors.text.secondary,
      paddingHorizontal: 15,
      marginBottom: 6,
      fontWeight: '600',
    },
    cuisineStripScroll: {
      paddingHorizontal: 15,
    },
    cuisineChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: colors.background.card,
      borderWidth: 1,
      borderColor: colors.border.light,
      marginRight: 6,
    },
    cuisineChipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    cuisineChipText: {
      fontSize: 13,
      color: colors.text.primary,
      fontWeight: '500',
      textTransform: 'capitalize' as const,
    },
    cuisineChipTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },

    // ── 11A-CP3: refine surface ────────────────────────────────────
    refinementChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 15,
      paddingTop: 4,
      paddingBottom: 2,
    },
    refinementChipSlot: {
      marginRight: 6,
      marginBottom: 6,
    },
    facetRowContainer: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },

    // ── 11A-CP5a: Mode A "Browse all <N> →" link + Mode B filter line ──
    browseAllRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 18,
      paddingTop: 4,
      paddingBottom: 10,
    },
    browseAllText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    // 11D-CP2 Mode A "Browse by → Books · Chefs" row.
    browseByRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 4,
      paddingBottom: 4,
    },
    browseByPrefix: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    browseByLink: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    browseByLinkMuted: {
      fontSize: 13,
      color: colors.text.tertiary,
      fontWeight: '500',
    },
    filterLineContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      gap: 6,
    },
    filterLineChips: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    filterLineChipSlot: {
      marginRight: 6,
      marginBottom: 6,
    },
    refineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      borderWidth: 1,
      borderColor: colors.border.medium,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 4,
      marginTop: 0,
    },
    refineButtonText: {
      fontSize: 13,
      color: colors.text.primary,
      fontWeight: '600',
    },
    compactStatus: {
      paddingHorizontal: 18,
      paddingTop: 4,
      paddingBottom: 6,
    },
    compactStatusText: {
      fontSize: 12,
      color: colors.text.tertiary,
      fontWeight: '500',
    },
    // 11D: collapsed filter pill (shown in place of the chrome when scrolled).
    collapsedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 15,
      paddingVertical: 9,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    collapsedBarText: {
      flex: 1,
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: '600',
    },
    collapsedBarChevron: {
      fontSize: 14,
      color: colors.text.tertiary,
      fontWeight: '700',
    },

    // ── 11A-CP4 dead-style sweep: segmentedWrapper/Container/Tab*
    // (segmented control gone in CP2) + bookFilter* (standalone book dropdown
    // gone in CP3, cookbook is a facet now) removed.

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
    // 11D: tap-a-pill threshold picker sheet.
    adjustSheet: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 8,
      paddingBottom: 32,
    },
    adjustTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    adjustOption: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    adjustOptionText: {
      fontSize: 16,
      color: colors.text.primary,
    },
    adjustToggleRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    adjustToggle: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: colors.background.card,
    },
    adjustToggleActive: {
      // Solid fill so the active toggle matches the coloured (included) bars.
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    adjustToggleText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    adjustToggleTextActive: {
      color: '#ffffff',
    },
    adjustCaption: {
      fontSize: 12,
      color: colors.text.tertiary,
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 6,
    },
    adjustValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    adjustCount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    histoRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 60,
      paddingHorizontal: 20,
      gap: 2,
      marginBottom: 2,
    },
    histoCol: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    histoBar: {
      width: '100%',
      borderRadius: 2,
    },
    adjustSliderWrap: {
      paddingHorizontal: 20,
    },
    adjustSliderBounds: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: -4,
    },
    adjustBoundText: {
      fontSize: 11,
      color: colors.text.tertiary,
    },
    adjustDone: {
      marginTop: 12,
      marginHorizontal: 20,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
    },
    adjustDoneText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
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

    // ── Sort dropdown (button removed in CP3 — Sort is now a facet) ───
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

    // 11A-CP4 dead-style sweep: dietaryPrefIndicator* (10F text indicator
    // removed in CP3; dietary chips render via BrowseLensChip now);
    // quickFiltersContainer (replaced by facetRowContainer in CP3);
    // quickFilterChipActive / quickFilterLabelActive (active facets render
    // as dismissible refinement chips above, not in the facet row);
    // quickFilterIcon (emoji text style — never used post-CP3).
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
    quickFilterLabel: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: '500',
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

    // 11A-CP4 dead-style sweep: bottomSearchContainer / searchBar / searchIcon
    // (bottom search bar replaced with topSearchBar in CP2; searchIcon was an
    // emoji text style — SearchIcon SVG used now).
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
    getSearchEntities().then(setEntitySet).catch(() => {});
    getSearchSuggestions().then(setSuggestionIndex).catch(() => {});
  }, []);

  // 8D-CP1: bulk-compute recipe ↔ pantry match for the loaded recipe set.
  // 8D-CP4: also load each recipe's catalog ingredient {id,name} pairs for the
  // ready-to-cook hero-resolution gate. Re-runs when recipes / space change.
  useEffect(() => {
    if (!activeSpaceId || recipes.length === 0) {
      setMatchMap(new Map());
      setRecipeIngredientsMap(new Map());
      return;
    }
    let cancelled = false;
    const recipeIds = recipes.map((r) => r.id);
    calculateRecipeSupplyMatchBulk(recipeIds, activeSpaceId)
      .then((result) => {
        if (!cancelled) setMatchMap(result);
      })
      .catch((err) => {
        console.error('Error computing bulk pantry match:', err);
      });
    getRecipeIngredientNames(recipeIds)
      .then((result) => {
        if (!cancelled) setRecipeIngredientsMap(result);
      })
      .catch((err) => {
        console.error('Error loading recipe ingredient names:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [recipes, activeSpaceId]);

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

  // 11A-CP5a — Recipes tab tap while focused → reset to Mode A. Acts as a
  // "go home" affordance: from any Mode B lens/filter state, tapping the tab
  // icon returns to the discovery tiles. Skipped on a different tab
  // (isFocused false at event time) or in selection mode (clearLens would
  // wipe state the picker flow expects).
  //
  // Navigation tree from this screen: `navigation` IS the RecipesStack
  // navigator; `navigation.getParent()` is the bottom-tab navigator (where
  // `tabPress` is emitted). One climb — not two. (The framework's documented
  // "reset nested stack on tab re-press" pattern.)
  useEffect(() => {
    const tab = navigation.getParent();
    if (!tab) return;
    const unsubscribe = tab.addListener('tabPress' as any, () => {
      if (navigation.isFocused() && !isSelectionMode) {
        clearLens();
      }
    });
    return unsubscribe;
  }, [navigation, clearLens, isSelectionMode]);

  // Handle initial filter params from stats drill-downs
  useEffect(() => {
    const params = route.params;
    if (!params) return;

    const {
      initialBrowseMode,
      initialCuisine,
      initialCookingConcept,
      initialDietaryFlag,
      initialChefId,
      initialBookId,
      initialIngredient,
    } = params;

    const hasInitialFilter =
      initialBrowseMode || initialCuisine || initialCookingConcept ||
      initialDietaryFlag || initialChefId || initialBookId || initialIngredient;

    // Handle sortBy param (from stats podium "See all")
    if (params.sortBy === 'cook_count') {
      setSortOption('most_cooked');
      navigation.setParams({ sortBy: undefined } as any);
    }

    if (!hasInitialFilter) return;

    // 11A-CP5a: stats drill-downs land in Mode B (list view), not Mode A —
    // the user came in with a specific lens, they want to see results, not
    // the home tiles.
    setScreenMode('list');

    // Apply browse mode. 11A-CP2: legacy stats drill-down values
    // ('cook_again' / 'try_new') map to the new tile contexts. Default for
    // drill-down without an explicit mode is `something_new` (preserves the
    // pre-CP2 "Try New" default for cuisine/concept/dietary drill-downs).
    if (initialBrowseMode === 'cook_again') {
      setBrowseMode('your_classics');
    } else if (initialBrowseMode === 'try_new') {
      setBrowseMode('something_new');
    } else if (initialBrowseMode === 'all') {
      setBrowseMode('all');
    } else {
      setBrowseMode('something_new');
    }

    // Build advanced filters from initial params
    const newFilters: Partial<FilterState> = {};

    if (initialCuisine) {
      newFilters.cuisineTypes = [initialCuisine];
    }
    if (initialCookingConcept) {
      // cooking concept maps to vibe tags in filter system
      newFilters.vibeTags = [initialCookingConcept];
    }
    if (initialDietaryFlag) {
      newFilters.dietaryFlags = { [initialDietaryFlag]: true } as any;
    }

    if (Object.keys(newFilters).length > 0) {
      setAdvancedFilters(prev => ({ ...prev, ...newFilters }));
    }

    // CP6d-SmokeFix-3 (D11): "Find recipes" from SupplyDetail now uses the
    // full-text search path instead of hero_ingredients. Hero-only filtering
    // was too narrow (parmesan via heroIngredients = 7 results vs 41 via
    // free-text search). Force browseMode='all' AND populate searchText so
    // handleSearch fires the full-text path. Pre-fix this set hero filter +
    // defaulted to try_new mode.
    if (initialIngredient) {
      setBrowseMode('all');
      setSearchText(initialIngredient);
      // 8R-UX1: live-search debounce picks up the searchText change
      // automatically; no manual fire needed.
    }

    // Clear the initial params so they don't re-apply on re-focus
    navigation.setParams({
      initialBrowseMode: undefined,
      initialCuisine: undefined,
      initialCookingConcept: undefined,
      initialDietaryFlag: undefined,
      initialChefId: undefined,
      initialBookId: undefined,
      initialIngredient: undefined,
    } as any);
  }, [route.params?.initialCuisine, route.params?.initialCookingConcept, route.params?.initialDietaryFlag, route.params?.initialBrowseMode, route.params?.initialChefId, route.params?.initialBookId, route.params?.initialIngredient]);

  // ── 11A-CP2 browse derivations ────────────────────────────────
  // CP1 introduced BrowseState as a useMemo + a setFilteredRecipes useEffect.
  // CP2 (a) extends BrowseState with readyToCookIds + userDietaryFlags for the
  // new tile contexts, (b) converts filteredRecipes from useState/useEffect to
  // a useMemo derived directly from browseState (drops the exhaustive-deps
  // warning CP1 carried), and (c) adds the tile counts + cuisine strip
  // useMemos that drive the new home presentation.
  const browseState = useMemo<BrowseState>(() => ({
    context: browseMode,
    selectedBook,
    refinements: advancedFilters,
    searchedRecipeIds,
    sort: sortOption,
    readyToCookIds,
    userDietaryFlags: userDietaryFlagsActive,
  }), [
    browseMode,
    selectedBook,
    advancedFilters,
    searchedRecipeIds,
    sortOption,
    readyToCookIds,
    userDietaryFlagsActive,
  ]);

  const filteredRecipes = useMemo(
    () => {
      let out = resolveBrowse(recipesWithMatch, matchMap, browseState);
      // Bookmark view-filter — applied in list mode only so the home tiles /
      // counts (which also read filteredRecipes) stay unfiltered.
      if (screenMode === 'list' && bookmarkFilterIds) {
        out = out.filter(r => bookmarkFilterIds.has(r.id));
      }
      return out;
    },
    [recipesWithMatch, matchMap, browseState, screenMode, bookmarkFilterIds],
  );

  // Load the recipe-id set for the active bookmark filter (single-select).
  useEffect(() => {
    if (!userId || !activeBookmark) { setBookmarkFilterIds(null); return; }
    let alive = true;
    getRecipesForBookmark(userId, activeBookmark)
      .then((rows) => { if (alive) setBookmarkFilterIds(new Set(rows.map((r) => r.id))); })
      .catch(() => { if (alive) setBookmarkFilterIds(new Set()); });
    return () => { alive = false; };
  }, [userId, activeBookmark, bmVersion]);

  // Per-recipe bookmark map for the card glyphs (one tag scan, reloaded on edits).
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getBookmarksByRecipe(userId)
      .then((m) => { if (alive) setBookmarksByRecipe(m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId, bmVersion]);

  // Tapping a bookmark chip filters the list; from home it also enters list mode.
  const handleBookmarkFilter = useCallback((key: string | null) => {
    setActiveBookmark(key);
    if (key) setScreenMode('list');
  }, []);

  // Cook Again sectioning — gated on the your_classics tile (CP1 cook_again).
  // The pure grouping lives in recipeBrowseService.getCookAgainSections.
  const cookAgainSections = useMemo(() => {
    if (browseMode !== 'your_classics') return [];
    // Tag each item with its section title so the SectionList keyExtractor can
    // build keys that are unique across sections. A recipe may legitimately
    // appear in more than one Cook Again section (e.g. Recent Favorites AND
    // Regulars); without the section in the key, `${id}-${index}` collides
    // (index resets per section) and React warns about duplicate keys.
    return getCookAgainSections(filteredRecipes).map(s => ({
      ...s,
      data: s.data.map(r => ({ ...r, _sectionKey: s.title })),
    }));
  }, [filteredRecipes, browseMode]);

  // Tile counts — one resolveBrowse pass per default tile with empty
  // refinements/quickFilters/search so the count reflects the tile lens alone.
  // ready_to_cook + for_your_diet pull readyToCookIds + userDietaryFlagsActive
  // from the same state used by resolveBrowse, so counts stay consistent.
  const tileCounts = useMemo(() => {
    const out: Partial<Record<BrowseContextId, number>> = {};
    for (const tile of DEFAULT_TILES) {
      out[tile.id] = resolveBrowse(recipesWithMatch, matchMap, {
        context: tile.id,
        selectedBook: null,
        refinements: {},
        searchedRecipeIds: null,
        sort: 'newest',
        readyToCookIds,
        userDietaryFlags: userDietaryFlagsActive,
      }).length;
    }
    return out;
  }, [recipesWithMatch, matchMap, readyToCookIds, userDietaryFlagsActive]);

  // Tile liveness — when the gate is unmet, the tile renders as an inroad CTA
  // instead of a count. quick_tonight + recently_added are always live (so
  // long as the user has any recipes); the rest gate on real signal.
  const tileLiveness = useMemo<Partial<Record<BrowseContextId, boolean>>>(() => ({
    quick_tonight: recipes.length > 0,
    ready_to_cook: !!readyToCookIds && readyToCookIds.size > 0,
    recently_added: recipes.length > 0,
    your_classics: recipes.some(r => (r.times_cooked ?? 0) > 0),
    for_your_diet: Object.keys(userDietaryFlagsActive).length > 0,
    friends_cook: recipes.some(r => (r.friends_cooked_count ?? 0) > 0),
  }), [recipes, readyToCookIds, userDietaryFlagsActive]);

  // Cuisine strip — top ~8 cuisines from the loaded recipe set, by frequency.
  // Powers the horizontal chip row below the tile grid; CP4 may revisit the
  // ordering (e.g. dietary-aware boosting).
  const cuisineStrip = useMemo(() => {
    const counts: Record<string, number> = {};
    recipes.forEach(r => (r.cuisine_types ?? []).forEach(c => {
      counts[c] = (counts[c] ?? 0) + 1;
    }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [recipes]);

  // 11A-CP5a — lens chip ✕. Returns to Mode A (home), resets context to
  // 'all', clears search + selectedBook + all refinements EXCEPT the
  // auto-applied dietary flags (which get re-seeded so Mode A's tile counts
  // continue to reflect the user's dietary prefs). Removing a dietary chip
  // in Mode B still leaves saved prefs untouched per the CP3 semantic — this
  // re-seed only fires on the lens-clear path, not on individual chip clears.
  const clearLens = useCallback(() => {
    const seededDietary = userDietaryPrefs?.auto_apply_to_browse ? userDietaryFlagsActive : {};
    setAdvancedFilters({
      dietaryFlags: seededDietary,
      heroIngredients: [],
      vibeTags: [],
      difficultyLevels: [],
      cookingMethods: [],
      cuisineTypes: [],
      sources: [],
      courseTypes: [],
      ingredientCountRanges: [],
      servingTemp: [],
      easierThanLooks: false,
      makeAheadFriendly: false,
      recentlySaved: false,
      recentlyCookedByFriends: false,
      quickUnder30: false,
      onePotOnly: false,
    });
    setSearchText('');
    setSearchTerms([]);
    setSearchedRecipeIds(null);
    setBrowseMode('all');
    setSelectedBook(null);
    setExpandedCardId(null);
    setActiveBookmark(null);
    setScreenMode('home');
  }, [userDietaryPrefs, userDietaryFlagsActive]);

  // 11A-CP5a — active-lens label for the Mode B filter line. Search wins
  // over tile context (a search inside a tile is still primarily a search
  // from the user's perspective); tile wins over the implicit "Browse all"
  // case. Closes P11A-CP5-deferred-1 — the search lens now surfaces a
  // `"<query>"` label rather than falling back silently. Clearing always
  // returns to Mode A via `clearLens` (supersedes CP2's clear-in-place).
  const lens = useMemo<{ label: string; clear: () => void } | null>(() => {
    if (screenMode !== 'list') return null;
    // 11D: the search query lives in the persistent search bar (now mounted in
    // list mode too), so the lens reflects the browse CONTEXT rather than the
    // search term — no redundant `"<query>"` chip duplicating the bar.
    if (browseMode !== 'all') {
      const tile = DEFAULT_TILES.find(t => t.id === browseMode);
      const label =
        tile?.label
        ?? (browseMode === 'something_new' ? 'Something new' : String(browseMode));
      return { label, clear: clearLens };
    }
    // 11D: no "All recipes" lens chip — redundant; the search bar/pills already
    // convey state. Plain 'all' context shows no lens chip.
    return null;
  }, [screenMode, browseMode, clearLens]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
  };

  // 10F — load user dietary preferences on mount; if auto_apply_to_browse is on,
  // pre-populate advancedFilters.dietaryFlags. The existing filter logic at
  // lines ~1268-1277 already AND's selected flags against recipes; we just seed it.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const prefs = await getDietaryPreferences(user.id);
      setUserDietaryPrefs(prefs);

      if (prefs && prefs.auto_apply_to_browse) {
        const dietaryFlags: Record<string, boolean> = {};
        DIETARY_FLAG_KEYS.forEach(key => {
          if (prefs[key]) dietaryFlags[key] = true;
        });
        if (Object.keys(dietaryFlags).length > 0) {
          setAdvancedFilters(prev => ({
            ...prev,
            dietaryFlags: { ...(prev.dietaryFlags ?? {}), ...dietaryFlags },
          }));
        }
      }
    })();
  }, []);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Paginate the fetch: PostgREST caps a single select at 1000 rows, so a
      // user with >1000 recipes would silently see only their latest 1000 (and
      // any count derived from the loaded set would be wrong). Loop in
      // 1000-row pages until exhausted so the full set is loaded — search /
      // filter / sort here are client-side over this set, so they need it all.
      const RECIPE_PAGE = 1000;
      let data: any[] = [];
      for (let pageFrom = 0; ; pageFrom += RECIPE_PAGE) {
        const { data: page, error } = await supabase
          .from('recipes')
          .select(`
            *,
            chefs:chef_id (name)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(pageFrom, pageFrom + RECIPE_PAGE - 1);

        if (error) throw error;
        data = data.concat(page || []);
        if (!page || page.length < RECIPE_PAGE) break;
      }

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
      // 11A-CP2: filteredRecipes is derived via useMemo from browseState;
      // setting recipes triggers the resolveBrowse recomputation downstream.

      const pinned = enrichedRecipes.filter(r => r.is_pinned).length;
      setPinnedCount(pinned);
      // 8D-CP4: canMakeCount is derived via the canMakeCount useMemo (which
      // runs the shared ready-to-cook gate over matchMap + recipeIngredientsMap).

      setLoading(false);
    } catch (error) {
      console.error('Error loading recipes:', error);
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setAdvancedFilters({
      dietaryFlags: {},
      heroIngredients: [],
      vibeTags: [],
      difficultyLevels: [],
      cookingMethods: [],
      cuisineTypes: [],
      sources: [],
      courseTypes: [],
      ingredientCountRanges: [],
      servingTemp: [],
      easierThanLooks: false,
      makeAheadFriendly: false,
      recentlySaved: false,
      recentlyCookedByFriends: false,
      quickUnder30: false,
      onePotOnly: false,
    });
    setSearchText('');
    setSearchTerms([]);
    setBrowseMode('all');
    setSelectedBook(null);
    // 11A-CP2: filteredRecipes is derived — the state resets above are enough
    // to recompute it via the browseState useMemo.
  };

  // 11A-CP5a: clearLens hoisted above the `lens` useMemo where it's consumed.

  // ── 11A-CP3 refinement chip / facet plumbing ───────────────────
  // DIETARY_LABELS mirrors the FilterDrawer DIETARY_FLAGS labels (kept here to
  // avoid coupling the screen to FilterDrawer's internal constants).
  const DIETARY_LABELS: Record<string, string> = {
    is_vegan: 'Vegan',
    is_vegetarian: 'Vegetarian',
    is_gluten_free: 'Gluten-free',
    is_dairy_free: 'Dairy-free',
    is_nut_free: 'Nut-free',
    is_shellfish_free: 'Shellfish-free',
    is_soy_free: 'Soy-free',
    is_egg_free: 'Egg-free',
  };

  const updateRefinement = (patch: Partial<FilterState>) => {
    setAdvancedFilters(prev => ({ ...prev, ...patch }));
  };
  const unsetDietary = (key: string) => {
    setAdvancedFilters(prev => {
      const next = { ...(prev.dietaryFlags ?? {}) } as Record<string, boolean>;
      delete next[key];
      return { ...prev, dietaryFlags: next };
    });
  };
  const removeFromArray = (field: keyof FilterState, item: string) => {
    setAdvancedFilters(prev => {
      const cur = (prev[field] as string[] | undefined) ?? [];
      return { ...prev, [field]: cur.filter(v => v !== item) };
    });
  };

  // 11D: open the slider picker. Seed the High/Low toggle + value from current
  // state, and cache the base set (all OTHER filters applied) so the live count
  // is a cheap numeric filter per slider tick.
  const openAdjust = (a: { kind: 'time' } | { kind: 'nutrient'; nutrient: NutrientKey }) => {
    let cleared: Partial<FilterState> = { ...advancedFilters };
    if (a.kind === 'nutrient') {
      const cfg = NUTRIENTS[a.nutrient];
      const curMax = advancedFilters[cfg.maxField] as number | undefined;
      const curMin = advancedFilters[cfg.minField] as number | undefined;
      setAdjustDir(curMax != null ? 'max' : curMin != null ? 'min' : cfg.defaultDir);
      setSliderValue(curMax ?? curMin ?? cfg.defaultValue);
      cleared = { ...cleared, [cfg.minField]: undefined, [cfg.maxField]: undefined };
    } else {
      setSliderValue(advancedFilters.maxTotalTime ?? 30);
      cleared = { ...cleared, maxTotalTime: undefined, maxActiveTime: undefined, quickUnder30: false };
    }
    const base = resolveBrowse(recipesWithMatch, matchMap, { ...browseState, refinements: cleared });
    setAdjustBaseSet(base);
    const lo = a.kind === 'nutrient' ? NUTRIENTS[a.nutrient].sliderMin : TIME_SLIDER.min;
    const hi = a.kind === 'nutrient' ? NUTRIENTS[a.nutrient].sliderMax : TIME_SLIDER.max;
    const accessor = a.kind === 'nutrient'
      ? (r: Recipe) => (r as any)[NUTRIENTS[a.nutrient].recipeField] as number | null | undefined
      : (r: Recipe) => r.total_time_min ?? r.active_time_min ?? null;
    setAdjustBins(buildHistogram(base, accessor, lo, hi, HISTO_BINS));
    setAdjustTarget(a);
  };
  // Apply the threshold to the filter (live as the slider moves — does NOT close).
  const applyNutrient = (nutrient: NutrientKey, dir: 'min' | 'max', value: number) => {
    const cfg = NUTRIENTS[nutrient];
    setAdvancedFilters(prev => ({
      ...prev,
      [cfg.minField]: dir === 'min' ? value : undefined,
      [cfg.maxField]: dir === 'max' ? value : undefined,
    }));
  };
  const applyTimeAdjust = (value: number) => updateRefinement({ maxTotalTime: value, quickUnder30: false });
  // Live count: recipes in the base set that pass the candidate threshold.
  const adjustCount = (
    target: typeof adjustTarget,
    dir: 'min' | 'max',
    value: number,
  ): number => {
    if (!target) return 0;
    if (target.kind === 'nutrient') {
      const cfg = NUTRIENTS[target.nutrient];
      return adjustBaseSet.filter(r => {
        const x = (r as any)[cfg.recipeField] as number | null | undefined;
        return dir === 'min' ? (x != null && x >= value) : (x == null || x <= value);
      }).length;
    }
    return adjustBaseSet.filter(r => {
      const total = r.total_time_min ?? null;
      const active = r.active_time_min ?? null;
      return (total == null || total <= value) && (active == null || active <= value);
    }).length;
  };

  // Active-refinement chip list. Each entry → one dismissible chip on the
  // refine row. Order: facet-driven booleans first, then dietary, then
  // multi-selects, then numeric bounds, then social/misc, then cookbook.
  interface RefinementChip {
    key: string;
    label: string;
    clear: () => void;
    // Numeric refinements are tappable to adjust their threshold (a macro with
    // High/Low direction, or max time).
    adjust?: { kind: 'time' } | { kind: 'nutrient'; nutrient: NutrientKey };
  }
  const activeRefinementChips = useMemo<RefinementChip[]>(() => {
    const af = advancedFilters;
    const chips: RefinementChip[] = [];

    if (af.quickUnder30)
      chips.push({ key: 'quick', label: 'Under 30m', adjust: { kind: 'time' }, clear: () => updateRefinement({ quickUnder30: false }) });
    if (af.onePotOnly)
      chips.push({ key: 'one_pot', label: 'One pot', clear: () => updateRefinement({ onePotOnly: false }) });
    // 11D: macro threshold chips (high/low) generated from NUTRIENTS — tap to
    // adjust direction + value.
    (Object.keys(NUTRIENTS) as NutrientKey[]).forEach(nk => {
      const cfg = NUTRIENTS[nk];
      const minV = af[cfg.minField] as number | undefined;
      const maxV = af[cfg.maxField] as number | undefined;
      if (minV != null) chips.push({ key: `nut:${nk}:min`, label: `${cfg.label} ${minV}${cfg.unit}+`, adjust: { kind: 'nutrient', nutrient: nk }, clear: () => updateRefinement({ [cfg.minField]: undefined } as Partial<FilterState>) });
      if (maxV != null) chips.push({ key: `nut:${nk}:max`, label: `${cfg.label} ${maxV}${cfg.unit} max`, adjust: { kind: 'nutrient', nutrient: nk }, clear: () => updateRefinement({ [cfg.maxField]: undefined } as Partial<FilterState>) });
    });

    if (af.dietaryFlags) {
      Object.entries(af.dietaryFlags).forEach(([k, v]) => {
        if (v) chips.push({ key: `diet:${k}`, label: DIETARY_LABELS[k] ?? k, clear: () => unsetDietary(k) });
      });
    }
    (af.cuisineTypes ?? []).forEach(c =>
      chips.push({ key: `cuisine:${c}`, label: c, clear: () => removeFromArray('cuisineTypes', c) }),
    );
    (af.heroIngredients ?? []).forEach(h =>
      chips.push({ key: `hero:${h}`, label: h, clear: () => removeFromArray('heroIngredients', h) }),
    );
    (af.vibeTags ?? []).forEach(v =>
      chips.push({ key: `vibe:${v}`, label: v, clear: () => removeFromArray('vibeTags', v) }),
    );
    (af.cookingMethods ?? []).forEach(m =>
      chips.push({ key: `method:${m}`, label: m, clear: () => removeFromArray('cookingMethods', m) }),
    );
    (af.courseTypes ?? []).forEach(c =>
      chips.push({ key: `course:${c}`, label: c, clear: () => removeFromArray('courseTypes', c) }),
    );
    (af.difficultyLevels ?? []).forEach(d =>
      chips.push({ key: `diff:${d}`, label: d, clear: () => removeFromArray('difficultyLevels', d) }),
    );
    (af.servingTemp ?? []).forEach(t =>
      chips.push({ key: `temp:${t}`, label: t, clear: () => removeFromArray('servingTemp', t) }),
    );
    (af.ingredientCountRanges ?? []).forEach(rng =>
      chips.push({ key: `ing:${rng}`, label: `Ingredients ${rng}`, clear: () => removeFromArray('ingredientCountRanges', rng) }),
    );

    if (af.maxActiveTime != null)
      chips.push({ key: 'maxActive', label: `Active ≤${af.maxActiveTime}m`, adjust: { kind: 'time' }, clear: () => updateRefinement({ maxActiveTime: undefined }) });
    if (af.maxTotalTime != null)
      chips.push({ key: 'maxTotal', label: `Total ≤${af.maxTotalTime}m`, adjust: { kind: 'time' }, clear: () => updateRefinement({ maxTotalTime: undefined }) });

    if (af.easierThanLooks)
      chips.push({ key: 'easier', label: 'Easier than looks', clear: () => updateRefinement({ easierThanLooks: false }) });
    if (af.makeAheadFriendly)
      chips.push({ key: 'makeAhead', label: 'Make-ahead', clear: () => updateRefinement({ makeAheadFriendly: false }) });
    if (af.recentlySaved)
      chips.push({ key: 'recentlySaved', label: 'Recently saved', clear: () => updateRefinement({ recentlySaved: false }) });
    if (af.recentlyCookedByFriends)
      chips.push({ key: 'friendsCooked', label: 'Friends cooked', clear: () => updateRefinement({ recentlyCookedByFriends: false }) });

    if (selectedBook)
      chips.push({ key: 'book', label: selectedBook, clear: () => setSelectedBook(null) });

    return chips;
  }, [advancedFilters, selectedBook]);

  const getActiveFilterCount = () => activeRefinementChips.length;

  // 8R-UX1: live-as-you-type search. 300ms debounce on searchText changes.
  // Empty text clears the search constraint; non-empty kicks off the search
  // service and stores matching recipe IDs. applyFilters intersects with
  // searchedRecipeIds so the search survives matchMap updates (the bug it
  // replaced: handleSearch wrote straight to filteredRecipes and the next
  // applyFilters re-run overwrote the result).
  //
  // CP6d-SmokeFix-3 (D11): the route-param "Find recipes" path still works —
  // it sets searchText, which trips this debounce and runs the search.
  useEffect(() => {
    if (!userId) return;
    const handle = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, searchTerms, userId]);

  const handleSearch = async () => {
    // 11D: search the EFFECTIVE term list = committed pills + the in-progress
    // box word. Each term is one entity-aware phrase; the engine AND's them.
    const terms = effectiveSearchTerms(searchTerms, searchText, entitySet);
    // 11D: bump the sequence on every invocation (incl. clears) so any
    // in-flight earlier search recognises it's stale before applying.
    const seq = ++searchSeqRef.current;
    if (terms.length === 0) {
      setSearchedRecipeIds(null);
      setSearching(false);
      return;
    }
    try {
      const recipeIds = await searchRecipesByScopedTerms(terms);
      // 11D: ignore stale responses — only the latest search applies (a newer
      // search owns the `searching` flag, so don't clear it here).
      if (seq !== searchSeqRef.current) return;
      // recipesWithMatch is already user-scoped (loadRecipes filters by user_id);
      // applyFilters does the intersection. We don't need a second user_id query.
      setSearchedRecipeIds(new Set(recipeIds));
      // 11D: active search lands in list mode. The search bar stays mounted
      // (rendered above both layouts) so typing continues seamlessly.
      setScreenMode('list');
      setSearching(false);
    } catch (error) {
      console.error('Search error:', error);
      setSearching(false);
    }
  };

  // 11D stacked-search input handler: peel off completed leading terms into
  // pills (prefix-deferred so multi-word entities like "molly baz" don't split)
  // and keep the in-progress tail in the box.
  const asText = (v: string): SearchTerm => ({ kind: 'text', value: v, label: v });
  const onSearchChange = (value: string) => {
    const { commit, rest } = processBox(value, entitySet);
    if (commit.length) setSearchTerms(prev => [...prev, ...commit.map(asText)]);
    setSearchText(rest);
  };
  const removeSearchTerm = (index: number) => {
    setSearchTerms(prev => prev.filter((_, i) => i !== index));
  };
  // 11D: Enter/Search key force-commits the box to free-text pill(s), overriding
  // the prefix-deferral (so "chicken" — a prefix of "chicken stock" — still pills).
  const commitSearchNow = () => {
    const toks = tokenize(searchText, entitySet);
    if (toks.length === 0 && searchTerms.length === 0) return; // nothing to search
    if (toks.length) setSearchTerms(prev => [...prev, ...toks.map(asText)]);
    setSearchText('');
    // Land on the list immediately (pills visible) + show a spinner until the
    // debounced search returns, instead of hanging on home.
    setScreenMode('list');
    setSearching(true);
  };
  // 11D typeahead — a picked suggestion either becomes a SCOPED search pill
  // (ingredient/category/chef/cuisine) or applies a REFINEMENT (dietary /
  // cooking method / vibe / course / attribute), rendered as a refinement chip.
  const onSuggestionPick = (s: Suggestion) => {
    setSearchText('');
    setScreenMode('list');
    if (isSearchSuggestion(s.kind)) {
      setSearchTerms(prev => [...prev, { kind: s.kind as SearchTerm['kind'], value: s.value, label: s.label }]);
      setSearching(true);
      return;
    }
    applyRefineSuggestion(s);
  };
  const applyRefineSuggestion = (s: Suggestion) => {
    switch (s.kind) {
      case 'dietary':
        setAdvancedFilters(prev => ({ ...prev, dietaryFlags: { ...(prev.dietaryFlags ?? {}), [s.value]: true } }));
        break;
      case 'method':
        setAdvancedFilters(prev => ({ ...prev, cookingMethods: [...new Set([...(prev.cookingMethods ?? []), s.value])] }));
        break;
      case 'vibe':
        setAdvancedFilters(prev => ({ ...prev, vibeTags: [...new Set([...(prev.vibeTags ?? []), s.value])] }));
        break;
      case 'course':
        setAdvancedFilters(prev => ({ ...prev, courseTypes: [...new Set([...(prev.courseTypes ?? []), s.value])] }));
        break;
      case 'attribute':
        if (s.value.startsWith('nut:')) {
          const [, nutrient, dir, valStr] = s.value.split(':');
          applyNutrient(nutrient as NutrientKey, dir as 'min' | 'max', Number(valStr));
        }
        else if (s.value === 'quick') updateRefinement({ quickUnder30: true });
        else if (s.value === 'one_pot') updateRefinement({ onePotOnly: true });
        else if (s.value === 'make_ahead') updateRefinement({ makeAheadFriendly: true });
        else if (s.value === 'easier') updateRefinement({ easierThanLooks: true });
        break;
    }
  };
  const suggestions = useMemo(
    () => matchSuggestions(searchText, suggestionIndex),
    [searchText, suggestionIndex],
  );

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

  // 11A-CP2: top-of-screen search bar (relocated from the bottom). Search
  // logic — debounced searchedRecipeIds + searchService call — is unchanged;
  // only the bar's position moves.
  const renderTopSearch = () => {
    if (isSelectionMode) return null;
    return (
      <View style={styles.topSearchContainer}>
        <View style={styles.topSearchBar}>
          <SearchIcon size={18} color={colors.text.tertiary} />
          <TextInput
            style={[styles.searchInput, { marginLeft: 8 }]}
            placeholder={searchTerms.length ? 'Add another term…' : 'Try: thai chicken, quick, from molly'}
            placeholderTextColor={colors.text.tertiary}
            value={searchText}
            onChangeText={onSearchChange}
            // Return force-commits the in-progress term to a pill + dismisses
            // the keyboard (tap the box again to add another term).
            onSubmitEditing={commitSearchNow}
            blurOnSubmit={true}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {/* 11D typeahead dropdown — pick a precise, scoped term. */}
        {suggestions.length > 0 && (
          <View style={styles.suggestionDropdown}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={`${s.kind}-${s.value}-${i}`}
                style={[styles.suggestionRow, i > 0 && styles.suggestionRowBorder]}
                activeOpacity={0.7}
                onPress={() => onSuggestionPick(s)}
              >
                <Text style={styles.suggestionLabel} numberOfLines={1}>{s.label}</Text>
                <Text style={styles.suggestionKind}>{KIND_LABEL[s.kind]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // 11A-CP2: tile metadata wired to existing SVG icons + inroad copy. Live
  // tiles set BrowseState.context; inroads cross-stack-navigate to the screen
  // that unlocks the gate.
  const TILE_ICONS: Partial<Record<BrowseContextId, IconComponent>> = {
    quick_tonight: TimerIcon,
    ready_to_cook: PantryOutline,
    recently_added: NewIcon,
    your_classics: AgainIcon,
    for_your_diet: VegetablesIcon,
    friends_cook: FriendsIcon,
  };
  const TILE_INROAD_LABEL: Partial<Record<BrowseContextId, string>> = {
    ready_to_cook: 'Track your pantry',
    for_your_diet: 'Set dietary preferences',
    friends_cook: 'Follow friends',
    your_classics: 'Cook a few to build these',
  };
  const handleTileInroad = (id: BrowseContextId) => {
    switch (id) {
      case 'ready_to_cook':
        navigation.getParent()?.navigate('PantryStack');
        break;
      case 'for_your_diet':
        navigation.getParent()?.navigate('FeedStack', { screen: 'DietaryPreferences' });
        break;
      case 'friends_cook':
        navigation.getParent()?.navigate('FeedStack', { screen: 'UserSearch' });
        break;
      case 'your_classics':
        setBrowseMode('all');
        break;
    }
  };
  const handleTilePress = (id: BrowseContextId) => {
    setExpandedCardId(null);
    if (tileLiveness[id]) {
      setBrowseMode(id);
      // 11A-CP5a: live tile tap transitions Mode A → Mode B with the tile
      // context as the lens. Inroad tiles handle their own navigation
      // (cross-stack); they don't change screen mode.
      setScreenMode('list');
    } else {
      handleTileInroad(id);
    }
  };

  // 11A-CP5a — "Browse all <N> →" link on Mode A. Lands in Mode B with
  // context='all' (no tile/cuisine/search lens); the lens chip shows
  // "All recipes" so the user can ✕ back to home.
  const handleBrowseAll = () => {
    setExpandedCardId(null);
    setScreenMode('list');
  };

  const renderTilePrompt = () => {
    if (isSelectionMode) return null;
    return <Text style={styles.tilePrompt}>What are you looking for?</Text>;
  };

  const renderTileGrid = () => {
    if (isSelectionMode) return null;
    const rows = [DEFAULT_TILES.slice(0, 3), DEFAULT_TILES.slice(3, 6)];
    return (
      <View style={styles.tileGrid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.tileRow}>
            {row.map(tile => {
              const live = !!tileLiveness[tile.id];
              const Icon = TILE_ICONS[tile.id];
              const count = tileCounts[tile.id] ?? 0;
              return (
                <TouchableOpacity
                  key={tile.id}
                  style={[styles.tileCell, !live && styles.tileCellInroad]}
                  activeOpacity={0.8}
                  onPress={() => handleTilePress(tile.id)}
                >
                  <View style={styles.tileTopRow}>
                    {Icon && (
                      <Icon
                        size={16}
                        color={live ? colors.primary : colors.text.tertiary}
                      />
                    )}
                    <Text style={[styles.tileLabel, !live && styles.tileLabelInroad]}>
                      {tile.label}
                    </Text>
                  </View>
                  {live ? (
                    <Text style={styles.tileCount}>{count}</Text>
                  ) : (
                    <View style={styles.tileInroadRow}>
                      <Text style={styles.tileInroadText}>
                        {TILE_INROAD_LABEL[tile.id] ?? ''}
                      </Text>
                      <Text style={styles.tileInroadArrow}>›</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderCuisineStrip = () => {
    if (isSelectionMode) return null;
    if (cuisineStrip.length === 0) return null;
    const activeCuisine = advancedFilters.cuisineTypes?.length === 1
      ? advancedFilters.cuisineTypes[0]
      : null;
    return (
      <View style={styles.cuisineStripContainer}>
        <Text style={styles.cuisineStripLabel}>Or by cuisine</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cuisineStripScroll}
        >
          {cuisineStrip.map(cuisine => {
            const active = activeCuisine === cuisine;
            return (
              <TouchableOpacity
                key={cuisine}
                style={[styles.cuisineChip, active && styles.cuisineChipActive]}
                onPress={() => {
                  setBrowseMode('all');
                  setAdvancedFilters(prev => ({
                    ...prev,
                    cuisineTypes: active ? [] : [cuisine],
                  }));
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.cuisineChipText, active && styles.cuisineChipTextActive]}>
                  {cuisine}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.cuisineChip}
            onPress={() => setShowFilterDrawer(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.cuisineChipText}>More ›</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // Bookmark view-filter chip row. Shown on the home screen (under the tiles)
  // and in list mode. Single-select; tapping from home enters list mode.
  const renderBookmarkRow = (label?: string) => {
    if (isSelectionMode || !userId) return null;
    return (
      <BookmarkFilterRow
        userId={userId}
        activeKey={activeBookmark}
        onChange={handleBookmarkFilter}
        label={label}
        reloadKey={bmVersion}
        style={styles.bookmarkFilterRow}
      />
    );
  };

  // 11A-CP5a: renderActiveLensChip removed — the lens chip is now part of
  // the Mode B filter line (see renderFilterLine).

  // 11A-CP5a — Mode A "Browse all <N> →" link below the tile grid.
  // Right-aligned, small. Tapping enters Mode B with context='all'.
  const renderBrowseAllLink = () => {
    if (isSelectionMode) return null;
    return (
      <View style={styles.browseAllRow}>
        <TouchableOpacity onPress={handleBrowseAll} activeOpacity={0.7}>
          <Text style={styles.browseAllText}>
            Browse all {recipes.length} →
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // 11D-CP2 — Mode A "Browse by →" entry into the Books/Chefs index screens.
  // Plain text row, "Books" tappable → BookList. "Chefs" muted/non-tappable
  // until 11D-CP4 ships ChefListScreen (Tom-locked 2026-05-29).
  const renderBrowseByRow = () => {
    if (isSelectionMode) return null;
    return (
      <View style={styles.browseByRow}>
        <Text style={styles.browseByPrefix}>Browse by → </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('BookList')}
        >
          <Text style={styles.browseByLink}>Books</Text>
        </TouchableOpacity>
        <Text style={styles.browseByPrefix}> · </Text>
        <Text style={styles.browseByLinkMuted}>Chefs</Text>
      </View>
    );
  };

  // 11A-CP5a — Mode B filter line. Lens chip (always present, leftmost) +
  // dismissible refinement chips (auto-dietary + user-set) + right-aligned
  // Refine button that opens RefineSheet. Replaces the CP3 trio (active lens
  // chip row, refinement chips row, persistent facet row).
  const renderFilterLine = () => {
    if (isSelectionMode) return null;
    return (
      <View style={styles.filterLineContainer}>
        <View style={styles.filterLineChips}>
          {/* Tile/cuisine lens chip (only when a real lens is active). */}
          {lens && (
            <View style={styles.filterLineChipSlot}>
              <BrowseLensChip label={lens.label} variant="lens" onClear={lens.clear} />
            </View>
          )}
          {/* 11D stacked search-term pills — free-text + scoped (labelled by
              kind so you can see exactly what you're filtering on). */}
          {searchTerms.map((t, i) => (
            <View key={`term-${t.value}-${i}`} style={styles.filterLineChipSlot}>
              <BrowseLensChip
                label={t.kind === 'text' ? t.value : `${KIND_LABEL[t.kind]}: ${t.label}`}
                variant={t.kind === 'text' ? 'refinement' : 'lens'}
                onClear={() => removeSearchTerm(i)}
              />
            </View>
          ))}
          {activeRefinementChips.map(chip => (
            <View key={chip.key} style={styles.filterLineChipSlot}>
              <BrowseLensChip
                label={chip.label}
                variant="refinement"
                onClear={chip.clear}
                onPress={chip.adjust ? () => openAdjust(chip.adjust!) : undefined}
              />
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={styles.refineButton}
          onPress={() => setShowFilterDrawer(true)}
          activeOpacity={0.7}
        >
          <SortIcon size={13} color={colors.text.secondary} />
          <Text style={styles.refineButtonText}>Refine</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // 11A-CP5a — Mode B compact status: "<N> recipes". Drops the previous
  // "Y you can make now" tap-through (Ready to cook tile is the entry now;
  // CP5b will formalize that absorption).
  const renderCompactStatus = () => {
    if (isSelectionMode) return null;
    const n = filteredRecipes.length;
    return (
      <View style={styles.compactStatus}>
        <Text style={styles.compactStatusText}>
          {n} recipe{n !== 1 ? 's' : ''}
        </Text>
      </View>
    );
  };

  // 11A-CP3: renderBookFilter removed — cookbook is now a contextual facet
  // in something_new (and any other context that registers it). The book
  // picker modal below is still used; the facet chip just triggers it.

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
      { value: 'pantry_match', IconComponent: PantryOutline,   label: 'Pantry Match %' },
      { value: 'alpha',        IconComponent: SortIcon,        label: 'A → Z' },
      { value: 'cal_low',      IconComponent: FireIcon,        label: 'Cal: Low → High' },
      { value: 'cal_high',     IconComponent: FireIcon,        label: 'Cal: High → Low' },
      { value: 'protein_high', IconComponent: BodybuilderIcon, label: 'Protein: High' },
      { value: 'fastest',      IconComponent: TimerIcon,       label: 'Fastest' },
      { value: 'most_cooked',  IconComponent: PanIcon,         label: 'Most Cooked' },
      { value: 'highest_rated',IconComponent: StarIcon,        label: 'Highest Rated' },
      { value: 'source_updated', IconComponent: GlobeIcon,     label: 'Source: Recently Updated' },
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

  // 11A-CP1: iconKey ('fire' | 'gem' | 'again' | undefined) comes from the
  // pure recipeBrowseService section builder; the screen owns the icon mapping
  // so the service stays React-free.
  const SECTION_ICONS: Record<'fire' | 'gem' | 'again', IconComponent> = {
    fire: FireIcon,
    gem: GemIcon,
    again: AgainIcon,
  };
  const renderSectionHeader = ({ section }: { section: { title: string; iconKey?: 'fire' | 'gem' | 'again' } }) => {
    const SectionIcon = section.iconKey ? SECTION_ICONS[section.iconKey] : null;
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderContent}>
          {SectionIcon && <SectionIcon size={18} color={colors.primary} />}
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
        </View>
      </View>
    );
  };

  // 11A-CP3: refine surface — dismissible refinement chips (incl. auto-
  // applied dietary pills) on top, contextual facet chips + Sort + More
  // below. Replaces the legacy quickFilters row, the standalone Sort button,
  // the standalone book dropdown, and the 10F "From your dietary preferences"
  // text indicator.
  const FACET_ICONS: Partial<Record<FacetId, IconComponent>> = {
    quick: TimerIcon,
    vegetarian: VegetablesIcon,
    high_protein: BodybuilderIcon,
    one_pot: PotIcon,
    cuisine: VegetablesIcon,
    cookbook: BookIcon,
    sort: SortIcon,
  };

  // For toggle facets: flip the corresponding refinement on. Clearing happens
  // via the dismissible refinement chip (one-source-of-truth).
  const applyToggleFacet = (id: FacetId) => {
    switch (id) {
      case 'quick':
        updateRefinement({ quickUnder30: true });
        break;
      case 'vegetarian':
        setAdvancedFilters(prev => ({
          ...prev,
          dietaryFlags: { ...(prev.dietaryFlags ?? {}), is_vegetarian: true },
        }));
        break;
      case 'high_protein':
        updateRefinement({ minProteinPerServing: 25 });
        break;
      case 'one_pot':
        updateRefinement({ onePotOnly: true });
        break;
    }
  };

  const openPickerFacet = (id: FacetId) => {
    if (id === 'sort') {
      handleSortPress();
    } else if (id === 'cookbook') {
      setShowBookDropdown(true);
    } else if (id === 'cuisine') {
      // 11A-CP4: cuisine facet opens the RefineSheet anchored at the Cuisine
      // section (replaces the CP3 stopgap that opened the drawer at the top).
      setRefineInitialSection('cuisine');
      setShowFilterDrawer(true);
    }
  };

  // 11A-CP4 — closure passed to RefineSheet.previewCount. The draft is the
  // sheet's local refinement state; we resolve the full pipeline (active
  // context + search + draft) so the count reflects what Apply will produce.
  const previewRefineCount = (draft: FilterState) =>
    resolveBrowse(recipesWithMatch, matchMap, { ...browseState, refinements: draft }).length;

  // 11A-CP4 — header label for "Refine · <lens>". Reuses the CP5a `lens`
  // which now covers search-lens too (closes P11A-CP5-deferred-1).
  const refineLensLabel = lens?.label;

  const renderRefinementChipsRow = () => {
    if (isSelectionMode) return null;
    if (activeRefinementChips.length === 0) return null;
    return (
      <View style={styles.refinementChipsRow}>
        {activeRefinementChips.map(chip => (
          <View key={chip.key} style={styles.refinementChipSlot}>
            <BrowseLensChip label={chip.label} variant="refinement" onClear={chip.clear} />
          </View>
        ))}
      </View>
    );
  };

  const renderFacetRow = () => {
    if (isSelectionMode) return null;
    const facets = getActiveFacets(browseState);
    return (
      <View style={styles.facetRowContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFiltersScroll}
        >
          {facets.map(id => {
            const meta = FACET_META[id];
            const active = isFacetActive(id, browseState);
            // Active toggle facets are already rendered as dismissible chips
            // above — don't double-render them in the facet row.
            if (meta.kind === 'toggle' && active) return null;
            const Icon = FACET_ICONS[id];
            const isPicker = meta.kind === 'picker';
            return (
              <TouchableOpacity
                key={id}
                style={styles.quickFilterChip}
                onPress={() => (isPicker ? openPickerFacet(id) : applyToggleFacet(id))}
                activeOpacity={0.7}
              >
                {Icon && <Icon size={14} color={colors.text.secondary} />}
                <Text style={styles.quickFilterLabel}>
                  {meta.label}{isPicker ? ' ▾' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Sort facet — always present, opens existing sort picker modal. */}
          <TouchableOpacity
            ref={sortButtonRef}
            style={styles.quickFilterChip}
            onPress={handleSortPress}
            activeOpacity={0.7}
          >
            <SortIcon size={14} color={colors.text.secondary} />
            <Text style={styles.quickFilterLabel}>Sort ▾</Text>
          </TouchableOpacity>

          {/* More chip — opens the existing FilterDrawer (unchanged in CP3). */}
          <TouchableOpacity
            style={styles.moreChip}
            onPress={() => setShowFilterDrawer(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.moreChipText}>More ›</Text>
          </TouchableOpacity>

          {getActiveFilterCount() > 0 && (
            <TouchableOpacity
              style={styles.clearFiltersChip}
              onPress={clearAllFilters}
              activeOpacity={0.7}
            >
              <Text style={styles.clearFiltersText}>✕ Clear</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  // 11A-CP2: status bar now leads with "All recipes · N" by default and
  // reflects the active tile context when one is set. The "X you can make now"
  // tap-target survives unchanged (8D-CP4 Preservation Contract).
  const renderStatusBar = () => {
    const n = filteredRecipes.length;
    let title: string;
    if (browseMode === 'your_classics') {
      title = `${n} recipe${n !== 1 ? 's' : ''} you've cooked`;
    } else if (browseMode === 'something_new') {
      title = `${n} recipe${n !== 1 ? 's' : ''} to try`;
    } else if (browseMode !== 'all') {
      const tile = DEFAULT_TILES.find(t => t.id === browseMode);
      title = `${tile?.label ?? 'Filtered'} · ${n}`;
    } else {
      // 'all' context — suppress the bar when nothing is narrowing the set.
      if (n === recipes.length && getActiveFilterCount() === 0 && !lens) {
        return null;
      }
      title = `All recipes · ${n}`;
    }
    return (
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{title}</Text>
        {browseMode === 'all' && canMakeCount > 0 && (
          <>
            <Text style={styles.statusDot}> • </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('WhatCanICook')}
            >
              <Text style={styles.statusText}>{canMakeCount} you can make now</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // 11A-CP2: bottom search bar removed; search lives in renderTopSearch.

  // 8D-CP4: card rendering extracted to <RecipeCard> (components/recipe/
  // RecipeCard.tsx) — internal refactor, byte-identical visual output. The
  // formatRelativeTime + buildDietaryBadges helpers moved there too (the card
  // was their only consumer).
  const renderCardItem = ({ item }: { item: Recipe }) => (
    <RecipeCard
      recipe={item}
      isExpanded={expandedCardId === item.id}
      onToggleExpand={() =>
        setExpandedCardId(expandedCardId === item.id ? null : item.id)
      }
      onPress={handleRecipePress}
      isSelectionMode={isSelectionMode}
      onSelectForMeal={handleSelectForMeal}
      bookmarks={bookmarksByRecipe.get(item.id)}
      onOpenBookmarks={(r) => setBookmarkSheetRecipeId(r.id)}
    />
  );

  const emptyListComponent = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {(searchText || searchTerms.length > 0)
          ? 'No recipes found'
          : browseMode === 'your_classics'
          ? "You haven't cooked any recipes yet"
          : browseMode === 'something_new'
          ? 'No new recipes to try'
          : 'No recipes match'}
      </Text>
      {(searchText || searchTerms.length > 0 || getActiveFilterCount() > 0 || browseMode !== 'all') && (
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

  // 11A-CP5a — render list (FlatList or SectionList for your_classics).
  // Extracted so both Mode B and selection mode can render it without
  // duplicating the branch.
  const renderList = () =>
    browseMode === 'your_classics' ? (
      <SectionList
        ref={listRef}
        onScroll={onListScroll}
        scrollEventThrottle={16}
        sections={cookAgainSections}
        renderItem={renderCardItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item, index) => `${(item as any)._sectionKey ?? ''}-${item.id}-${index}`}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={emptyListComponent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    ) : (
      <FlatList
        ref={listRef}
        onScroll={onListScroll}
        scrollEventThrottle={16}
        data={filteredRecipes}
        renderItem={renderCardItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={emptyListComponent}
        showsVerticalScrollIndicator={false}
      />
    );

  // 11D: collapsed filter pill — replaces the search bar + filter line + status
  // when the user scrolls down into results. Summarizes the active lens/search
  // + count; tap to expand the full chrome and jump back to the top.
  const renderCollapsedBar = () => {
    const n = filteredRecipes.length;
    const activeTerms = effectiveSearchTerms(searchTerms, searchText, entitySet);
    const summary = activeTerms.length ? activeTerms.map(t => t.label).join(', ') : (lens?.label ?? 'All recipes');
    return (
      <TouchableOpacity
        style={styles.collapsedBar}
        activeOpacity={0.7}
        onPress={() => { expandHeader(); scrollListToTop(); }}
      >
        <SearchIcon size={14} color={colors.text.secondary} />
        <Text style={styles.collapsedBarText} numberOfLines={1}>
          {summary} · {n} recipe{n !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.collapsedBarChevron}>⌄</Text>
      </TouchableOpacity>
    );
  };

  // 11A-CP5a — modal/sheet block reused across all three layouts (Mode A,
  // Mode B, selection mode) so each branch stays small.
  // 11D: slider threshold picker. Macros get a High/Low (≥/≤) toggle; time is
  // max-only. A live recipe count updates as the slider moves; the threshold is
  // applied to the filter on release (Done just closes).
  const renderAdjustModal = () => {
    const t = adjustTarget;
    const cfg = t && t.kind === 'nutrient' ? NUTRIENTS[t.nutrient] : null;
    const dir = cfg ? adjustDir : 'max';
    const sMin = cfg ? cfg.sliderMin : TIME_SLIDER.min;
    const sMax = cfg ? cfg.sliderMax : TIME_SLIDER.max;
    const sStep = cfg ? cfg.sliderStep : TIME_SLIDER.step;
    const unit = cfg ? cfg.unit : ' min';
    const count = adjustCount(t, dir, sliderValue);
    const maxBin = adjustBins.length ? Math.max(1, ...adjustBins) : 1;
    const binSize = adjustBins.length ? (sMax - sMin) / adjustBins.length : 1;
    const applyValue = (v: number) => {
      if (t && t.kind === 'nutrient') applyNutrient(t.nutrient, adjustDir, v);
      else applyTimeAdjust(v);
    };
    return (
      <Modal
        visible={t !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAdjustTarget(null)}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop behind the sheet — tap to close. Kept separate (not a
              wrapping Touchable) so it never steals the Slider's drag gesture. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAdjustTarget(null)} />
          <View style={styles.adjustSheet}>
            <Text style={styles.adjustTitle}>{cfg ? `${cfg.label} per serving` : 'Total time'}</Text>
            {cfg && (
              <View style={styles.adjustToggleRow}>
                {(['min', 'max'] as const).map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.adjustToggle, adjustDir === d && styles.adjustToggleActive]}
                    onPress={() => { setAdjustDir(d); if (t && t.kind === 'nutrient') applyNutrient(t.nutrient, d, sliderValue); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.adjustToggleText, adjustDir === d && styles.adjustToggleTextActive]}>
                      {d === 'min' ? 'More than' : 'Less than'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {/* Graph label + distribution histogram. Bars on the INCLUDED side
                are coloured (same fill as the active toggle); flipping More/Less
                flips which side lights up. */}
            <Text style={styles.adjustCaption}>
              Recipes by {cfg ? `${cfg.label.toLowerCase()} per serving` : 'total time'}
            </Text>
            {adjustBins.length > 0 && (
              <View style={styles.histoRow}>
                {adjustBins.map((c, i) => {
                  const center = sMin + (i + 0.5) * binSize;
                  const included = dir === 'min' ? center >= sliderValue : center <= sliderValue;
                  return (
                    <View key={i} style={styles.histoCol}>
                      <View
                        style={[
                          styles.histoBar,
                          {
                            height: Math.max(3, (c / maxBin) * 56),
                            backgroundColor: included ? colors.primary : colors.border.medium,
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            )}
            <View style={styles.adjustSliderWrap}>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={sMin}
                maximumValue={sMax}
                step={sStep}
                value={sliderValue}
                onValueChange={setSliderValue}
                onSlidingComplete={(v) => { setSliderValue(v); applyValue(v); }}
                // Track colour = the INCLUDED side: "Less than" fills the left
                // (teal), "More than" fills the right (teal); the excluded side
                // is grey. Matches the histogram + active toggle.
                minimumTrackTintColor={dir === 'min' ? colors.border.medium : colors.primary}
                maximumTrackTintColor={dir === 'min' ? colors.primary : colors.border.medium}
                thumbTintColor={colors.primary}
              />
              <View style={styles.adjustSliderBounds}>
                <Text style={styles.adjustBoundText}>{sMin}{unit}</Text>
                <Text style={styles.adjustBoundText}>{sMax}{unit}</Text>
              </View>
            </View>
            <Text style={styles.adjustValue}>
              {sliderValue}{unit} {dir === 'min' ? 'or more' : 'or less'}{cfg ? ' per serving' : ''}
              <Text style={styles.adjustCount}>   ·   {count} recipe{count !== 1 ? 's' : ''}</Text>
            </Text>
            <TouchableOpacity style={styles.adjustDone} onPress={() => setAdjustTarget(null)} activeOpacity={0.8}>
              <Text style={styles.adjustDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderModalsAndSheets = () => (
    <>
      {renderBookPickerModal()}
      {renderSortPickerModal()}
      {renderAdjustModal()}
      <RefineSheet
        visible={showFilterDrawer}
        onClose={() => {
          setShowFilterDrawer(false);
          setRefineInitialSection(undefined);
        }}
        filters={advancedFilters as FilterState}
        onApplyFilters={(filters: FilterState) => {
          setAdvancedFilters(filters);
          setShowFilterDrawer(false);
          setRefineInitialSection(undefined);
        }}
        availableHeroIngredients={availableHeroIngredients}
        availableSources={availableSources}
        lensLabel={refineLensLabel}
        previewCount={previewRefineCount}
        initialSection={refineInitialSection}
        activeFacets={getActiveFacets(browseState)}
        onOpenCookbookPicker={() => {
          setShowFilterDrawer(false);
          setShowBookDropdown(true);
        }}
      />
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
    </>
  );

  // 11A-CP5a — selection mode bypasses the mode split entirely. Header swap
  // + recipe list, no tile/search/filter-line chrome (matches the existing
  // pre-CP5a selection picker layout).
  if (isSelectionMode) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderHeader()}
        {renderList()}
        {renderModalsAndSheets()}
      </KeyboardAvoidingView>
    );
  }

  // 11D search-UX fix — header + search bar render ONCE, above both layouts,
  // so the search TextInput stays mounted across the home↔list flip and keeps
  // focus while you type a full query. Only the content BELOW the bar switches
  // on screenMode. (Previously home and list were separate returns, so the
  // input unmounted on the first debounced search → focus dropped mid-type.)
  //   • home (discovery): tile grid + browse links
  //   • list: filter line + compact status + recipe list
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {renderHeader()}
      {/* In-process background recipe imports (onboarding T9a / paste rail);
          renders null when the session queue is empty. */}
      <ImportQueueStrip />
      {screenMode === 'list' && collapsed ? renderCollapsedBar() : renderTopSearch()}
      {screenMode === 'home' ? (
        <>
          {renderTilePrompt()}
          {renderTileGrid()}
          {renderBookmarkRow('Bookmarks')}
          {renderBrowseByRow()}
          {renderBrowseAllLink()}
        </>
      ) : (
        <>
          {!collapsed && renderFilterLine()}
          {!collapsed && renderBookmarkRow()}
          {!collapsed && renderCompactStatus()}
          {searching ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            renderList()
          )}
        </>
      )}
      {renderModalsAndSheets()}
      {bookmarkSheetRecipeId && userId && (
        <BookmarkSheet
          visible
          onClose={() => setBookmarkSheetRecipeId(null)}
          recipeId={bookmarkSheetRecipeId}
          userId={userId}
          onChange={() => setBmVersion((v) => v + 1)}
        />
      )}
    </KeyboardAvoidingView>
  );
}
