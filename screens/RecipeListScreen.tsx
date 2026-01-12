// screens/RecipeListScreen.tsx
// Updated: December 12, 2025 
// - Fixed selection mode getting stuck when navigating away
// - Changed from "Tap to Select" badge to proper "Select" button
// - Tapping card goes to recipe details, button selects for meal

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { RecipesStackParamList } from '../App';
import { useTheme } from '../lib/theme/ThemeContext';
import FilterDrawer from '../components/FilterDrawer';
import { AddRecipeModal } from '../components/AddRecipeModal';
import { searchRecipesByMixedTerms } from '../lib/searchService';

type Props = NativeStackScreenProps<RecipesStackParamList, 'RecipeList'>;

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
  times_cooked?: number;
  cost_per_serving?: number;
  ingredient_count?: number;
  pantry_match?: number;
  is_pinned?: boolean;
  image_url?: string;
}

interface QuickFilter {
  id: string;
  label: string;
  icon: string;
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

  // Selection mode state - use local state that gets set from params
  // This allows us to reset it when navigating normally
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionFormData, setSelectionFormData] = useState<any>(null);

  // Quick filters state
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([
    { id: 'quick30', label: 'Under 30m', icon: '⏱️', active: false },
    { id: 'onePost', label: 'One-Pot', icon: '🥘', active: false },
    { id: 'easy', label: 'Easy', icon: '👍', active: false },
    { id: 'budget', label: 'Under $5', icon: '💰', active: false },
  ]);

  // Advanced filter state (managed by FilterDrawer)
  const [advancedFilters, setAdvancedFilters] = useState<any>({});

  // Smart counts
  const [pinnedCount, setPinnedCount] = useState(0);
  const [canMakeCount, setCanMakeCount] = useState(0);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
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
    // Selection mode header styles
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
    headerButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    addButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    addButtonIcon: {
      fontSize: 32,
      color: colors.background.card,
      fontWeight: '300',
      lineHeight: 32,
    },
    moreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      position: 'relative',
    },
    moreButtonIcon: {
      fontSize: 16,
      marginRight: 4,
    },
    moreButtonText: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    filterBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    filterBadgeText: {
      color: colors.background.card,
      fontSize: 11,
      fontWeight: 'bold',
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
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    quickFilterChipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    quickFilterIcon: {
      fontSize: 16,
      marginRight: 4,
    },
    quickFilterLabel: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    quickFilterLabelActive: {
      color: colors.text.primary,
      fontWeight: '600',
    },
    clearFiltersChip: {
      backgroundColor: '#FF3B30',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },
    clearFiltersText: {
      color: colors.background.card,
      fontSize: 14,
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
    card: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      marginBottom: 15,
      padding: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      position: 'relative',
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
    statText: {
      fontSize: 13,
      color: colors.text.secondary,
    },

    // Selection mode button - bottom right inline
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
  }), [colors]);

  useEffect(() => {
    loadRecipes();
    getCurrentUser();
  }, []);

  // Handle selection mode params - check on every focus
  useFocusEffect(
    useCallback(() => {
      // Check if we have valid selection mode params
      const params = route.params;
      if (params?.selectionMode && params?.returnToMeals) {
        // Entering selection mode from CreateMealModal
        setIsSelectionMode(true);
        setSelectionFormData(params.mealFormData);
      } else {
        // Normal navigation (e.g., from tab bar) - reset selection mode
        setIsSelectionMode(false);
        setSelectionFormData(null);
      }
    }, [route.params?.selectionMode, route.params?.returnToMeals])
  );

  useEffect(() => {
    // Apply filters whenever they change
    const runFilters = async () => {
      await applyFilters();
    };
    runFilters();
  }, [recipes, quickFilters, advancedFilters]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user found');
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
        chef_name: recipe.chefs?.name || 'Unknown Chef'
      }));

      // Get pantry matches
      const recipesWithMatches = recipesWithChefs.map(r => ({ ...r, pantry_match: 0 }));

      setRecipes(recipesWithMatches);
      setFilteredRecipes(recipesWithMatches);

      // Calculate smart counts
      const pinned = recipesWithMatches.filter(r => r.is_pinned).length;
      const canMake = recipesWithMatches.filter(r => r.pantry_match >= 80).length;
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

    // Apply quick filters
    quickFilters.forEach(filter => {
      if (!filter.active) return;

      switch (filter.id) {
        case 'quick30':
          filtered = filtered.filter(r => 
            (r.total_time_min && r.total_time_min <= 30) ||
            (r.active_time_min && r.active_time_min <= 30) ||
            (r.prep_time_min + r.cook_time_min <= 30)
          );
          break;
        case 'onePost':
          filtered = filtered.filter(r => r.is_one_pot);
          break;
        case 'easy':
          filtered = filtered.filter(r => r.difficulty_level === 'easy');
          break;
        case 'budget':
          filtered = filtered.filter(r => 
            r.cost_per_serving != null && r.cost_per_serving <= 5
          );
          break;
      }
    });

    // Apply advanced filters
    if (advancedFilters.cuisineTypes?.length > 0) {
      filtered = filtered.filter(r => 
        r.cuisine_types?.some(ct => advancedFilters.cuisineTypes.includes(ct))
      );
    }

    if (advancedFilters.cookingMethods?.length > 0) {
      filtered = filtered.filter(r => 
        r.cooking_methods?.some(cm => advancedFilters.cookingMethods.includes(cm))
      );
    }

    if (advancedFilters.difficulty) {
      filtered = filtered.filter(r => r.difficulty_level === advancedFilters.difficulty);
    }

    if (advancedFilters.makeAhead) {
      filtered = filtered.filter(r => r.make_ahead_friendly);
    }

    if (advancedFilters.maxTime) {
      filtered = filtered.filter(r => 
        (r.total_time_min && r.total_time_min <= advancedFilters.maxTime) ||
        (r.active_time_min && r.active_time_min <= advancedFilters.maxTime)
      );
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
    setAdvancedFilters({});
    setSearchText('');
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

      // Get matching recipe IDs
      const recipeIds = await searchRecipesByMixedTerms([searchText]);
      
      if (recipeIds.length === 0) {
        setFilteredRecipes([]);
        return;
      }

      // Fetch full recipe data for the matching IDs
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

  // Handle recipe card press - always go to details
  const handleRecipePress = (recipe: Recipe) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  // Handle Select button press - select for meal and return
  const handleSelectForMeal = (recipe: Recipe) => {
    // Navigate back to MealsStack with the selected recipe
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

  // Handle cancel in selection mode
  const handleCancelSelection = () => {
    // Clear local selection state
    setIsSelectionMode(false);
    setSelectionFormData(null);
    
    // Clear the route params to prevent re-triggering
    navigation.setParams({ selectionMode: undefined, returnToMeals: undefined, mealFormData: undefined } as any);
    
    // Navigate back to meals with just the form data (no recipe)
    navigation.getParent()?.navigate('MealsStack', {
      screen: 'MyMealsList',
      params: {
        returnedFormData: selectionFormData,
      },
    });
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {isSelectionMode ? (
        // Selection mode header
        <>
          <TouchableOpacity onPress={handleCancelSelection}>
            <Text style={styles.cancelText}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>Select a Recipe</Text>
          <View style={{ width: 70 }} />
        </>
      ) : (
        // Normal header
        <>
          <Text style={styles.header}>Recipes</Text>
          
          <View style={styles.headerButtons}>
            {/* Add Recipe Button */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddRecipeModal(true)}
            >
              <Text style={styles.addButtonIcon}>+</Text>
            </TouchableOpacity>

            {/* Existing More Button */}
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setShowFilterDrawer(true)}
            >
              <Text style={styles.moreButtonIcon}>🎚️</Text>
              <Text style={styles.moreButtonText}>More</Text>
              {getActiveFilterCount() > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{getActiveFilterCount()}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
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
            <Text style={styles.quickFilterIcon}>{filter.icon}</Text>
            <Text style={[
              styles.quickFilterLabel,
              filter.active && styles.quickFilterLabelActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}

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
            <Text style={styles.statusText}>
              {canMakeCount} you can make now
            </Text>
          </>
        )}
      </View>
    );
  };

  const renderBottomSearchBar = () => (
    <View style={styles.bottomSearchContainer}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
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

  const renderRecipeCard = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleRecipePress(item)}
      activeOpacity={0.7}
    >
      {item.is_pinned && (
        <View style={styles.pinnedBadge}>
          <Text style={styles.pinnedText}>📌</Text>
        </View>
      )}

      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={[
          styles.difficultyBadge,
          item.difficulty_level === 'easy' && styles.difficultyEasy,
          item.difficulty_level === 'medium' && styles.difficultyMedium,
          item.difficulty_level === 'advanced' && styles.difficultyAdvanced,
        ]}>
          <Text style={styles.difficultyText}>
            {item.difficulty_level}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.chefName}>{item.chef_name}</Text>
        {item.cuisine_types?.length > 0 && (
          <Text style={styles.cuisineType}> • {item.cuisine_types[0]}</Text>
        )}
      </View>

      {item.easier_than_looks && (
        <View style={styles.specialBadge}>
          <Text style={styles.specialBadgeText}>✨ Easier than it looks</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statsLeft}>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>⏱️</Text>
            <Text style={styles.statText}>
              {item.prep_time_min && item.cook_time_min 
                ? `${item.prep_time_min + item.cook_time_min}m`
                : item.total_time_min 
                ? `${item.total_time_min}m`
                : item.active_time_min
                ? `${item.active_time_min}m`
                : 'N/A'}
            </Text>
          </View>

          {item.is_one_pot && (
            <View style={styles.stat}>
              <Text style={styles.statIcon}>🥘</Text>
              <Text style={styles.statText}>One-Pot</Text>
            </View>
          )}

          <View style={styles.stat}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={styles.statText}>{item.pantry_match}%</Text>
          </View>

          {item.cost_per_serving != null && (
            <View style={styles.stat}>
              <Text style={styles.statIcon}>💰</Text>
              <Text style={styles.statText}>${item.cost_per_serving.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Selection mode: Show Select button on bottom right */}
        {isSelectionMode && (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => handleSelectForMeal(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.selectButtonText}>Select</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
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
      {renderQuickFilters()}
      {renderStatusBar()}

      <FlatList
        data={filteredRecipes}
        renderItem={renderRecipeCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchText ? 'No recipes found' : 'No recipes yet'}
            </Text>
            {(searchText || getActiveFilterCount() > 0) && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearAllFilters}
              >
                <Text style={styles.clearButtonText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom search bar - hide in selection mode for cleaner look */}
      {!isSelectionMode && renderBottomSearchBar()}

      {/* Filter Drawer */}
      <FilterDrawer
        visible={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        filters={advancedFilters}
        onApplyFilters={(filters: any) => {
          setAdvancedFilters(filters);
          setShowFilterDrawer(false);
        }}
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