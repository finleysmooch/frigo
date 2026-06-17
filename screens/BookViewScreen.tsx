// screens/BookViewScreen.tsx
// Phase 11D-CP3b — Browse all recipes from a specific book with the unified
// browse model (BrowseLensChip + RefineSheet + searchService-style scope).
// Refactored from inline Supabase queries to bookViewService + the resolver.
//
// Locked CP3 decisions (Tom, 2026-05-29):
//   1. (CP3a) "See all →" passes a sectionId; BookView reads route.params.sectionId
//      and applies the section's natural sort on mount.
//   2. RefineSheet shows all facets + Quick refine, with the Cookbook facet
//      hidden because the book IS the locked lens.
//   3. Search scopes to the current book — runs the shared server-side
//      engine (searchRecipesByMixedTerms: full ingredients + title + chef +
//      metadata) and intersects the results with the book's loaded recipes.
//      (11D search upgrade — was a 4-field client-side substring filter.)
//   4. Lens chip ✕ pops back (the book is the screen's primary identity;
//      clearing the lens means leaving the book).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipesStackParamList } from '../App';
import { useTheme } from '../lib/theme/ThemeContext';
import { supabase } from '../lib/supabase';
import { RecipeCard, type Recipe } from '../components/recipe/RecipeCard';
import { BrowseLensChip } from '../components/recipe/BrowseLensChip';
import BookmarkFilterRow from '../components/recipe/BookmarkFilterRow';
import BookmarkSheet from '../components/recipe/BookmarkSheet';
import { getRecipesForBookmark, getBookmarksByRecipe, type Bookmark } from '../lib/services/bookmarkService';
import RefineSheet, { type FilterState } from '../components/RefineSheet';
import {
  resolveBrowse,
  getActiveFacets,
  type BrowseState,
  type SortOption,
} from '../lib/services/recipeBrowseService';
import { getBook } from '../lib/services/bookViewService';
import { searchRecipesByMixedTerms } from '../lib/searchService';
import { useCollapsibleHeader } from '../hooks/useCollapsibleHeader';
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
import {
  getDietaryPreferences,
  DIETARY_FLAG_KEYS,
  type DietaryPreferences,
} from '../lib/services/dietaryPreferencesService';
import { SearchIcon, SortIcon } from '../components/icons';
import type { Book } from '../lib/types/recipeFeatures';

type Props = NativeStackScreenProps<RecipesStackParamList, 'BookView'>;
type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

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

export default function BookViewScreen({ route, navigation }: Props) {
  const { bookId, sectionId, bookmarkKey } = route.params;
  const { colors } = useTheme();

  const [book, setBook] = useState<Book | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  // 11D search upgrade — in-book search now runs through the same server-side
  // engine as the main Recipes screen (searchRecipesByMixedTerms), which
  // matches the FULL ingredient list + title + chef + metadata (cuisine,
  // cooking methods, vibe tags, course, difficulty). Result ids are stored
  // here and intersected with the book's loaded recipes in visibleRecipes.
  // null = no active search.
  const [searchedRecipeIds, setSearchedRecipeIds] = useState<Set<string> | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<Partial<FilterState>>({});
  const [userDietaryPrefs, setUserDietaryPrefs] = useState<DietaryPreferences | null>(null);
  const [showRefineSheet, setShowRefineSheet] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  // Bookmark view-filter (single-select). When set, the list is intersected
  // with the recipes filed under this bookmark key.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeBookmark, setActiveBookmark] = useState<string | null>(bookmarkKey ?? null);
  const [bookmarkFilterIds, setBookmarkFilterIds] = useState<Set<string> | null>(null);
  // Per-recipe bookmark assignments for the card glyphs + the picker sheet.
  const [bookmarksByRecipe, setBookmarksByRecipe] = useState<Map<string, Bookmark[]>>(new Map());
  const [bookmarkSheetRecipeId, setBookmarkSheetRecipeId] = useState<string | null>(null);
  const [bmVersion, setBmVersion] = useState(0);

  // 11D: direction-aware collapsing filter chrome (filter line + search + status
  // collapse to a tappable pill on scroll-down; restore on scroll-up / at top).
  const { collapsed, onScroll: onListScroll, expand: expandHeader } = useCollapsibleHeader();
  const listRef = useRef<any>(null);
  const scrollListToTop = useCallback(() => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  }, []);
  // Start fresh views expanded (e.g. after a new search) before the user scrolls.
  useEffect(() => { expandHeader(); }, [searchedRecipeIds, expandHeader]);

  // 11D-CP3b — load everything in parallel. The recipe set is bookView-scoped
  // (book_id + user_id) so it's small; the heavier RecipeListScreen pattern
  // (pantry-match enrichment, ready-to-cook gate) is intentionally skipped —
  // BookView doesn't need them and the cost shape is friendlier without.
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Not signed in');
          setLoading(false);
          return;
        }
        const userId = user.id;
        setCurrentUserId(userId);

        // Phase 1: book metadata + scope recipe rows + cross-recipe per-user maps.
        const [bookRes, scopeRecipesRes, history, friends, prefs] = await Promise.all([
          getBook(bookId),
          // Direct supabase query for full recipe shape (getRecipesByBook
          // uses the recipes_with_books view with limited columns).
          supabase
            .from('recipes')
            .select('*, chefs:chef_id (name)')
            .eq('book_id', bookId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          getCookingHistory(userId),
          getFriendsCookingInfo(userId),
          getDietaryPreferences(userId),
        ]);

        if (scopeRecipesRes.error) throw scopeRecipesRes.error;
        const rawRecipes = (scopeRecipesRes.data ?? []) as any[];

        // Phase 2: nutrition batch (depends on the loaded recipe ids).
        const recipeIds = rawRecipes.map(r => r.id);
        const nutritionMap = recipeIds.length > 0
          ? await getRecipeNutritionBatch(recipeIds)
          : new Map<string, RecipeNutrition>();

        setBook(bookRes);
        setUserDietaryPrefs(prefs);

        // Enrich each recipe with nutrition + cooking history + friends.
        const enriched: Recipe[] = rawRecipes.map(r => {
          const n = nutritionMap.get(r.id);
          const h: CookingHistory | undefined = history.get(r.id);
          const f: FriendsCookingInfo | undefined = friends.get(r.id);
          return {
            ...r,
            chef_name: r.chefs?.name ?? 'Unknown Chef',
            book_name: bookRes?.title,
            // Nutrition
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
            // Cooking history
            ...(h && {
              times_cooked: h.times_cooked,
              last_cooked: h.last_cooked,
              first_cooked: h.first_cooked,
              avg_rating: h.avg_rating,
              latest_rating: h.latest_rating,
            }),
            // Friends
            ...(f && {
              friends_cooked_count: f.friends_cooked_count,
            }),
          } as Recipe;
        });

        setRecipes(enriched);

        // 10F auto-apply dietary — seed advancedFilters.dietaryFlags from the
        // user's saved prefs on first load. Same pattern as RecipeListScreen.
        if (prefs?.auto_apply_to_browse) {
          const dietaryFlags: Record<string, boolean> = {};
          DIETARY_FLAG_KEYS.forEach(key => {
            if ((prefs as any)[key]) dietaryFlags[key] = true;
          });
          if (Object.keys(dietaryFlags).length > 0) {
            setAdvancedFilters(prev => ({
              ...prev,
              dietaryFlags: { ...(prev.dietaryFlags ?? {}), ...dietaryFlags },
            }));
          }
        }
      } catch (e: any) {
        console.error('Error loading BookView data:', e);
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [bookId]);

  // 11D search upgrade — debounced server search (300ms). Empty query clears
  // the constraint (searchedRecipeIds = null). Non-empty tokenizes on
  // whitespace and ANDs across terms, each term matching ingredients/title/
  // chef/metadata. Mirrors RecipeListScreen's handleSearch path exactly so
  // the two surfaces behave identically.
  useEffect(() => {
    const term = searchText.trim();
    const handle = setTimeout(async () => {
      if (!term) {
        setSearchedRecipeIds(null);
        return;
      }
      try {
        const tokens = term.split(/\s+/).filter(Boolean);
        const ids = await searchRecipesByMixedTerms(tokens.length > 0 ? tokens : [term]);
        setSearchedRecipeIds(new Set(ids));
      } catch (e) {
        console.error('BookView search error:', e);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchText]);

  // Dietary flags dictionary (active prefs only) — used for the for_your_diet
  // / BrowseState.userDietaryFlags hookup so resolveBrowse can AND-filter.
  const userDietaryFlagsActive = useMemo<Record<string, boolean>>(() => {
    if (!userDietaryPrefs) return {};
    const flags: Record<string, boolean> = {};
    DIETARY_FLAG_KEYS.forEach(k => {
      if ((userDietaryPrefs as any)[k]) flags[k] = true;
    });
    return flags;
  }, [userDietaryPrefs]);

  // BrowseState — context='all' since the book scope is implicit (we already
  // loaded only book-scoped recipes); the resolver just applies refinements.
  // Sort stays 'newest' here because we apply the sectionId-specific sort
  // ourselves below (the SortOption enum doesn't include last_cooked /
  // friends_cooked sorts).
  const browseState = useMemo<BrowseState>(() => ({
    context: 'all',
    selectedBook: null,
    refinements: advancedFilters,
    searchedRecipeIds: null, // local search applies below
    sort: 'newest' as SortOption,
    readyToCookIds: null,
    userDietaryFlags: userDietaryFlagsActive,
  }), [advancedFilters, userDietaryFlagsActive]);

  // Load the recipe-id set for the active bookmark filter (single-select).
  useEffect(() => {
    if (!currentUserId || !activeBookmark) { setBookmarkFilterIds(null); return; }
    let alive = true;
    getRecipesForBookmark(currentUserId, activeBookmark)
      .then((rows) => { if (alive) setBookmarkFilterIds(new Set(rows.map((r) => r.id))); })
      .catch(() => { if (alive) setBookmarkFilterIds(new Set()); });
    return () => { alive = false; };
  }, [currentUserId, activeBookmark, bmVersion]);

  // Per-recipe bookmark map for the card glyphs (one tag scan, reloaded on edits).
  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;
    getBookmarksByRecipe(currentUserId)
      .then((m) => { if (alive) setBookmarksByRecipe(m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [currentUserId, bmVersion]);

  // Resolve → section sort → search filter → bookmark filter. Each a transform.
  const visibleRecipes = useMemo<Recipe[]>(() => {
    if (recipes.length === 0) return [];
    let out = resolveBrowse(recipes, new Map(), browseState);

    // CP3b — sectionId determines the initial sort. SortOption doesn't have
    // last_cooked or friends_cooked sorts, so we apply those inline.
    if (sectionId === 'mostCooked') {
      out = [...out].sort((a, b) => (b.times_cooked ?? 0) - (a.times_cooked ?? 0));
    } else if (sectionId === 'recentlyCooked') {
      out = [...out].sort((a, b) =>
        (b.last_cooked ?? '').localeCompare(a.last_cooked ?? ''),
      );
    } else if (sectionId === 'friendsFavorites') {
      out = [...out].sort((a, b) =>
        (b.friends_cooked_count ?? 0) - (a.friends_cooked_count ?? 0),
      );
    }
    // 'bookmarked' falls through to the resolver's 'newest' (no saved_at
    // field on Recipe — would need a parallel saved-tag fetch to honor).

    // Search intersection — when a search is active, keep only book recipes
    // whose id is in the server result set (full ingredient + title + chef +
    // metadata matching). null = no active search.
    if (searchedRecipeIds !== null) {
      out = out.filter(r => searchedRecipeIds.has(r.id));
    }

    // Bookmark view-filter intersection. null = no active bookmark filter.
    if (bookmarkFilterIds !== null) {
      out = out.filter(r => bookmarkFilterIds.has(r.id));
    }

    return out;
  }, [recipes, browseState, sectionId, searchedRecipeIds, bookmarkFilterIds]);

  // 11A-CP3 dismissible refinement chips — one chip per applied refinement.
  // Mirrors the activeRefinementChips list in RecipeListScreen so the user
  // gets the same affordance for clearing individual refinements here.
  interface RefinementChip { key: string; label: string; clear: () => void }

  const updateRefinement = useCallback((patch: Partial<FilterState>) => {
    setAdvancedFilters(prev => ({ ...prev, ...patch }));
  }, []);
  const unsetDietary = useCallback((key: string) => {
    setAdvancedFilters(prev => {
      const next = { ...(prev.dietaryFlags ?? {}) } as Record<string, boolean>;
      delete next[key];
      return { ...prev, dietaryFlags: next };
    });
  }, []);
  const removeFromArray = useCallback((field: keyof FilterState, item: string) => {
    setAdvancedFilters(prev => {
      const cur = (prev[field] as string[] | undefined) ?? [];
      return { ...prev, [field]: cur.filter(v => v !== item) };
    });
  }, []);

  const activeRefinementChips = useMemo<RefinementChip[]>(() => {
    const af = advancedFilters;
    const chips: RefinementChip[] = [];

    if (af.quickUnder30)
      chips.push({ key: 'quick', label: 'Under 30m', clear: () => updateRefinement({ quickUnder30: false }) });
    if (af.onePotOnly)
      chips.push({ key: 'one_pot', label: 'One pot', clear: () => updateRefinement({ onePotOnly: false }) });
    if ((af.minProteinPerServing ?? 0) >= 25)
      chips.push({ key: 'high_protein', label: 'High Protein', clear: () => updateRefinement({ minProteinPerServing: undefined }) });

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

    if (af.maxCaloriesPerServing != null)
      chips.push({ key: 'maxCal', label: `≤${af.maxCaloriesPerServing} cal`, clear: () => updateRefinement({ maxCaloriesPerServing: undefined }) });
    if (af.maxActiveTime != null)
      chips.push({ key: 'maxActive', label: `Active ≤${af.maxActiveTime}m`, clear: () => updateRefinement({ maxActiveTime: undefined }) });
    if (af.maxTotalTime != null)
      chips.push({ key: 'maxTotal', label: `Total ≤${af.maxTotalTime}m`, clear: () => updateRefinement({ maxTotalTime: undefined }) });

    if (af.makeAheadFriendly)
      chips.push({ key: 'makeAhead', label: 'Make-ahead', clear: () => updateRefinement({ makeAheadFriendly: false }) });
    if (af.recentlyCookedByFriends)
      chips.push({ key: 'friendsCooked', label: 'Friends cooked', clear: () => updateRefinement({ recentlyCookedByFriends: false }) });

    return chips;
  }, [advancedFilters, updateRefinement, unsetDietary, removeFromArray]);

  // RefineSheet wiring — Cookbook facet hidden because the book is the
  // locked lens (Tom-locked decision #2). Pass the full `getActiveFacets`
  // list minus 'cookbook'.
  const activeFacetsForSheet = useMemo(() => {
    return getActiveFacets(browseState).filter(f => f !== 'cookbook');
  }, [browseState]);

  // Live preview count for RefineSheet's Apply button — shows what the draft
  // refinements would surface against the book's recipe set.
  const previewRefineCount = useCallback(
    (draft: FilterState) => {
      const filtered = resolveBrowse(recipes, new Map(), {
        ...browseState,
        refinements: draft,
      });
      // Intersect with the active search result set so the count matches what
      // the user will see after Apply (same engine as visibleRecipes).
      if (searchedRecipeIds === null) return filtered.length;
      return filtered.filter(r => searchedRecipeIds.has(r.id)).length;
    },
    [recipes, browseState, searchedRecipeIds],
  );

  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Hero ingredients dropdown source for RefineSheet — book-scoped.
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

  const handleRecipePress = useCallback((recipe: Recipe) => {
    navigation.navigate('RecipeDetail', { recipe });
  }, [navigation]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.errorText}>{error || 'Book not found'}</Text>
      </View>
    );
  }

  const n = visibleRecipes.length;

  return (
    <View style={styles.screen}>
      {collapsed ? (
        // 11D: collapsed pill — replaces filter line + search + status on
        // scroll-down. Tap to expand the chrome and jump back to the top.
        <TouchableOpacity
          style={styles.collapsedBar}
          activeOpacity={0.7}
          onPress={() => { expandHeader(); scrollListToTop(); }}
        >
          <SearchIcon size={14} color={colors.text.secondary} />
          <Text style={styles.collapsedBarText} numberOfLines={1}>
            {searchText.trim() ? `“${searchText.trim()}”` : book.title} · {n} recipe{n !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.collapsedBarChevron}>⌄</Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* 11D-CP3b filter line — book lens chip + refinement chips + Refine.
              Lens chip ✕ pops back to BookList per Tom-locked decision #4. */}
          <View style={styles.filterLine}>
            <View style={styles.filterLineChips}>
              <View style={styles.chipSlot}>
                <BrowseLensChip
                  label={book.title}
                  variant="lens"
                  onClear={() => navigation.goBack()}
                />
              </View>
              {activeRefinementChips.map(chip => (
                <View key={chip.key} style={styles.chipSlot}>
                  <BrowseLensChip label={chip.label} variant="refinement" onClear={chip.clear} />
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.refineButton}
              onPress={() => setShowRefineSheet(true)}
              activeOpacity={0.7}
            >
              <SortIcon size={13} color={colors.text.secondary} />
              <Text style={styles.refineButtonText}>Refine</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar — scoped to the current book (server-side engine). */}
          <View style={styles.searchRow}>
            <View style={styles.searchWrap}>
              <SearchIcon size={16} color={colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search within ${book.title}`}
                placeholderTextColor={colors.text.tertiary}
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Bookmark view-filter chips (single-select, scoped to this book). */}
          {currentUserId && (
            <BookmarkFilterRow
              userId={currentUserId}
              activeKey={activeBookmark}
              onChange={setActiveBookmark}
              reloadKey={bmVersion}
              style={styles.bookmarkFilterRow}
            />
          )}

          {/* Status text */}
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>
              {n} recipe{n !== 1 ? 's' : ''}
              {n !== recipes.length && ` of ${recipes.length}`}
            </Text>
          </View>
        </>
      )}

      <FlatList
        ref={listRef}
        onScroll={onListScroll}
        scrollEventThrottle={16}
        data={visibleRecipes}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            isExpanded={expandedCardId === item.id}
            onToggleExpand={() =>
              setExpandedCardId(expandedCardId === item.id ? null : item.id)
            }
            onPress={handleRecipePress}
            isSelectionMode={false}
            bookmarks={bookmarksByRecipe.get(item.id)}
            onOpenBookmarks={(r) => setBookmarkSheetRecipeId(r.id)}
          />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {searchText || activeRefinementChips.length > 0
                ? 'No recipes match.'
                : 'No recipes from this book yet.'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* 11D-CP3b RefineSheet — same component as RecipeListScreen Mode B,
          but with the Cookbook facet filtered out of activeFacets. Lens
          label "Refine · <Book Title>" via the CP4 lensLabel prop. */}
      <RefineSheet
        visible={showRefineSheet}
        onClose={() => setShowRefineSheet(false)}
        filters={advancedFilters as FilterState}
        onApplyFilters={(filters: FilterState) => {
          setAdvancedFilters(filters);
          setShowRefineSheet(false);
        }}
        availableHeroIngredients={availableHeroIngredients}
        lensLabel={book.title}
        previewCount={previewRefineCount}
        activeFacets={activeFacetsForSheet}
        // Cookbook facet is filtered out of activeFacetsForSheet, so this
        // callback never fires; pass a no-op so the prop type-checks.
        onOpenCookbookPicker={() => {}}
      />

      {bookmarkSheetRecipeId && currentUserId && (
        <BookmarkSheet
          visible
          onClose={() => setBookmarkSheetRecipeId(null)}
          recipeId={bookmarkSheetRecipeId}
          userId={currentUserId}
          onChange={() => setBmVersion((v) => v + 1)}
        />
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    // 11D: collapsed filter pill (shown in place of chrome when scrolled).
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
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    errorText: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: 'center',
    },

    filterLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 6,
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    filterLineChips: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    chipSlot: {
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
    },
    refineButtonText: {
      fontSize: 13,
      color: colors.text.primary,
      fontWeight: '600',
    },

    searchRow: {
      paddingHorizontal: 15,
      paddingTop: 8,
      paddingBottom: 6,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 9,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text.primary,
      padding: 0,
    },

    bookmarkFilterRow: {
      paddingLeft: 15,
      paddingTop: 4,
      paddingBottom: 2,
    },
    statusRow: {
      paddingHorizontal: 18,
      paddingVertical: 6,
    },
    statusText: {
      fontSize: 12,
      color: colors.text.tertiary,
      fontWeight: '500',
    },

    listContainer: {
      padding: 15,
      paddingBottom: 30,
    },

    empty: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
  });
}
