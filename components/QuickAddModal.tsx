// ============================================
// FRIGO - QUICK ADD MODAL
// ============================================
// Fast ingredient selection with live search and emoji grid
// Location: components/QuickAddModal.tsx

import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';

interface BaseIngredient {
  id: string;
  name: string;
  emoji: string;
  has_variants: boolean;
  family: string;
}

interface SearchResult {
  id: string;
  name: string;
  family: string;
  ingredient_type: string;
  base_ingredient_id: string | null;
}

interface IngredientVariant {
  id: string;
  name: string;
  base_ingredient_id: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectIngredient: (ingredientId: string, ingredientName: string) => void;
  categoryFilter?: string | null;
}

export default function QuickAddModal({ 
  visible, 
  onClose, 
  onSelectIngredient,
  categoryFilter 
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [baseIngredients, setBaseIngredients] = useState<BaseIngredient[]>([]);
  const [variants, setVariants] = useState<IngredientVariant[]>([]);
  const [selectedBase, setSelectedBase] = useState<BaseIngredient | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load base ingredients when modal opens (for grid)
  useEffect(() => {
    if (visible && !searchTerm) {
      loadBaseIngredients();
    } else if (!visible) {
      // Reset when closing
      setSearchTerm('');
      setSearchResults([]);
      setSelectedBase(null);
      setVariants([]);
    }
  }, [visible, categoryFilter]);

  // Live search as user types
  useEffect(() => {
    if (searchTerm.length >= 2) {
      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(() => {
        performSearch();
      }, 300); // Wait 300ms after user stops typing
      
    } else {
      setSearchResults([]);
      setSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, categoryFilter]);

  const loadBaseIngredients = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ingredients')
        .select('id, name, family')
        .eq('is_base_ingredient', true)
        .not('quick_add_priority', 'is', null)
        .order('quick_add_priority');

      if (categoryFilter) {
        query = query.eq('family', categoryFilter);
      }

      const { data, error } = await query.limit(40);

      if (error) {
        console.error('Error loading base ingredients:', error);
        return;
      }

      // Check which ingredients have variants and assign emojis
      const ingredientsWithVariantInfo = await Promise.all(
        (data || []).map(async (ingredient) => {
          const { data: variantData } = await supabase
            .from('ingredients')
            .select('id')
            .eq('base_ingredient_id', ingredient.id)
            .limit(1);

          return {
            ...ingredient,
            emoji: getEmojiForIngredient(ingredient.name, ingredient.family),
            has_variants: (variantData?.length || 0) > 0
          };
        })
      );

      setBaseIngredients(ingredientsWithVariantInfo);

    } catch (error) {
      console.error('Error in loadBaseIngredients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Perform live search in database
  const performSearch = async () => {
    setSearching(true);
    try {
      console.log('🔍 Searching for:', searchTerm);
      
      let query = supabase
        .from('ingredients')
        .select('id, name, family, ingredient_type, base_ingredient_id')
        .or(`name.ilike.%${searchTerm}%,plural_name.ilike.%${searchTerm}%`);

      if (categoryFilter) {
        query = query.eq('family', categoryFilter);
      }

      const { data, error } = await query
        .order('name')
        .limit(20);

      if (error) {
        console.error('Error searching:', error);
        setSearchResults([]);
        return;
      }

      console.log('✅ Found', data?.length || 0, 'results');
      setSearchResults(data || []);

    } catch (error) {
      console.error('Error in performSearch:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const loadVariants = async (baseIngredientId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('id, name, base_ingredient_id')
        .eq('base_ingredient_id', baseIngredientId)
        .order('name');

      if (error) {
        console.error('Error loading variants:', error);
        return;
      }

      setVariants(data || []);

    } catch (error) {
      console.error('Error in loadVariants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBaseIngredientTap = async (ingredient: BaseIngredient) => {
    if (ingredient.has_variants) {
      // Show variant picker
      setSelectedBase(ingredient);
      await loadVariants(ingredient.id);
    } else {
      // No variants, go directly to add modal
      onSelectIngredient(ingredient.id, ingredient.name);
      onClose();
    }
  };

  const handleSearchResultTap = async (result: SearchResult) => {
    // Check if this is a base ingredient with variants
    if (result.base_ingredient_id === null) {
      // This is a base ingredient, check for variants
      const { data: variantData } = await supabase
        .from('ingredients')
        .select('id')
        .eq('base_ingredient_id', result.id)
        .limit(1);

      if (variantData && variantData.length > 0) {
        // Has variants, load them
        const baseIng: BaseIngredient = {
          id: result.id,
          name: result.name,
          family: result.family,
          emoji: getEmojiForIngredient(result.name, result.family),
          has_variants: true
        };
        setSelectedBase(baseIng);
        await loadVariants(result.id);
        return;
      }
    }
    
    // No variants, go directly
    onSelectIngredient(result.id, result.name);
    onClose();
  };

  const handleVariantTap = (variant: IngredientVariant) => {
    onSelectIngredient(variant.id, variant.name);
    onClose();
  };

  const handleBack = () => {
    setSelectedBase(null);
    setVariants([]);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSearching(false);
  };

  // Render search result item
  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleSearchResultTap(item)}
    >
      <View style={styles.searchResultContent}>
        <Text style={styles.searchResultEmoji}>
          {getEmojiForIngredient(item.name, item.family)}
        </Text>
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName}>{item.name}</Text>
          <Text style={styles.searchResultCategory}>
            {item.family} • {item.ingredient_type}
          </Text>
        </View>
      </View>
      <Text style={styles.searchResultArrow}>→</Text>
    </TouchableOpacity>
  );

  // Render base ingredient grid item
  const renderBaseIngredient = ({ item }: { item: BaseIngredient }) => (
    <TouchableOpacity
      style={styles.ingredientCard}
      onPress={() => handleBaseIngredientTap(item)}
    >
      <Text style={styles.ingredientEmoji}>{item.emoji}</Text>
      <Text style={styles.ingredientName} numberOfLines={2}>
        {item.name}
      </Text>
      {item.has_variants && (
        <Text style={styles.variantIndicator}>•••</Text>
      )}
    </TouchableOpacity>
  );

  // Render variant list item
  const renderVariant = ({ item }: { item: IngredientVariant }) => (
    <TouchableOpacity
      style={styles.variantItem}
      onPress={() => handleVariantTap(item)}
    >
      <Text style={styles.variantName}>{item.name}</Text>
      <Text style={styles.variantArrow}>→</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            {selectedBase && (
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>
              {selectedBase 
                ? `Choose ${selectedBase.name} Type` 
                : 'Quick Add'
              }
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar - only show when not viewing variants */}
          {!selectedBase && (
            <View style={styles.searchContainer}>
              <View style={styles.searchInputWrapper}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search ingredients..."
                  placeholderTextColor={colors.text.placeholder}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  clearButtonMode="never"
                />
                {searchTerm.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearSearch}
                  >
                    <Text style={styles.clearButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
                {searching && (
                  <ActivityIndicator 
                    size="small" 
                    color={colors.primary}
                    style={styles.searchingIndicator}
                  />
                )}
              </View>
            </View>
          )}

          {/* Content Area */}
          <View style={styles.contentArea}>
            {selectedBase ? (
              // Variant List View
              loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  key="variant-list"
                  data={variants}
                  keyExtractor={(item) => item.id}
                  renderItem={renderVariant}
                  contentContainerStyle={styles.variantList}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No variants found</Text>
                    </View>
                  }
                />
              )
            ) : searchTerm.length >= 2 ? (
              // Search Results View
              searching ? (
                <View style={styles.searchingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.searchingText}>Searching...</Text>
                </View>
              ) : searchResults.length > 0 ? (
                <FlatList
                  key="search-results"
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSearchResult}
                  contentContainerStyle={styles.searchResultsList}
                  keyboardShouldPersistTaps="handled"
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No ingredients found</Text>
                  <Text style={styles.emptySubtext}>Try a different search term</Text>
                </View>
              )
            ) : (
              // Base Ingredient Grid View
              loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  key="ingredient-grid"
                  data={baseIngredients}
                  keyExtractor={(item) => item.id}
                  renderItem={renderBaseIngredient}
                  numColumns={4}
                  contentContainerStyle={styles.gridContainer}
                  columnWrapperStyle={styles.gridRow}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        No quick-add ingredients available
                      </Text>
                    </View>
                  }
                />
              )
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Helper function to get emoji based on ingredient name or family
  function getEmojiForIngredient(name: string, family: string): string {
    const nameLower = name.toLowerCase();
    
    // Specific ingredient emojis
    if (nameLower.includes('tomato')) return '🍅';
    if (nameLower.includes('onion')) return '🧅';
    if (nameLower.includes('carrot')) return '🥕';
    if (nameLower.includes('potato')) return '🥔';
    if (nameLower.includes('lettuce') || nameLower.includes('salad')) return '🥬';
    if (nameLower.includes('pepper') || nameLower.includes('chili')) return '🌶️';
    if (nameLower.includes('bell pepper')) return '🫑';
    if (nameLower.includes('cucumber')) return '🥒';
    if (nameLower.includes('garlic')) return '🧄';
    if (nameLower.includes('broccoli')) return '🥦';
    if (nameLower.includes('cauliflower')) return '🥦';
    if (nameLower.includes('mushroom')) return '🍄';
    if (nameLower.includes('corn')) return '🌽';
    if (nameLower.includes('avocado')) return '🥑';
    if (nameLower.includes('eggplant')) return '🍆';
    if (nameLower.includes('lemon')) return '🍋';
    if (nameLower.includes('lime')) return '🍋';
    if (nameLower.includes('orange')) return '🍊';
    if (nameLower.includes('apple')) return '🍎';
    if (nameLower.includes('banana')) return '🍌';
    if (nameLower.includes('strawberry')) return '🍓';
    if (nameLower.includes('grape')) return '🍇';
    if (nameLower.includes('watermelon')) return '🍉';
    if (nameLower.includes('peach')) return '🍑';
    if (nameLower.includes('cherry')) return '🍒';
    if (nameLower.includes('pineapple')) return '🍍';
    if (nameLower.includes('mango')) return '🥭';
    if (nameLower.includes('kiwi')) return '🥝';
    if (nameLower.includes('coconut')) return '🥥';
    
    // Protein emojis
    if (nameLower.includes('chicken')) return '🍗';
    if (nameLower.includes('beef') || nameLower.includes('steak')) return '🥩';
    if (nameLower.includes('pork') || nameLower.includes('bacon')) return '🥓';
    if (nameLower.includes('fish') || nameLower.includes('salmon') || nameLower.includes('tuna')) return '🐟';
    if (nameLower.includes('shrimp')) return '🍤';
    if (nameLower.includes('egg')) return '🥚';
    
    // Dairy emojis
    if (nameLower.includes('milk')) return '🥛';
    if (nameLower.includes('cheese')) return '🧀';
    if (nameLower.includes('butter')) return '🧈';
    if (nameLower.includes('yogurt')) return '🥛';
    
    // Herbs & Spices
    if (nameLower.includes('basil')) return '🌿';
    if (nameLower.includes('parsley')) return '🌿';
    if (nameLower.includes('cilantro')) return '🌿';
    if (nameLower.includes('mint')) return '🌿';
    if (nameLower.includes('dill')) return '🌿';
    if (nameLower.includes('rosemary')) return '🌿';
    if (nameLower.includes('thyme')) return '🌿';
    
    // Pantry emojis
    if (nameLower.includes('rice')) return '🍚';
    if (nameLower.includes('pasta') || nameLower.includes('noodle')) return '🍝';
    if (nameLower.includes('bread')) return '🍞';
    if (nameLower.includes('flour')) return '🌾';
    if (nameLower.includes('sugar')) return '🍬';
    if (nameLower.includes('salt')) return '🧂';
    if (nameLower.includes('oil')) return '🫒';
    if (nameLower.includes('vinegar')) return '🫙';
    if (nameLower.includes('sauce')) return '🥫';
    if (nameLower.includes('can') || nameLower.includes('canned')) return '🥫';
    
    // Family-based fallbacks
    if (family === 'Produce') return '🥬';
    if (family === 'Proteins') return '🍖';
    if (family === 'Dairy') return '🥚';
    if (family === 'Pantry') return '🌾';
    if (family === 'Spices') return '🧂';
    if (family === 'Condiments') return '🥫';
    if (family === 'Frozen') return '❄️';
    
    // Default
    return '📦';
  }
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    height: '85%',
    ...shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    paddingRight: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: typography.sizes.xl,
    color: colors.text.tertiary,
  },
  
  // Search Container
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  searchInputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.xxxl,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  clearButton: {
    position: 'absolute',
    right: spacing.md,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.border.medium,
    borderRadius: borderRadius.round,
  },
  clearButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    fontWeight: typography.weights.bold,
  },
  searchingIndicator: {
    position: 'absolute',
    right: spacing.xl + spacing.md,
  },

  // Content Area
  contentArea: {
    flex: 1,
  },
  
  // Search Results
  searchResultsList: {
    padding: spacing.md,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  searchResultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchResultEmoji: {
    fontSize: typography.sizes.xxl,
    marginRight: spacing.md,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  searchResultCategory: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
  },
  searchResultArrow: {
    fontSize: typography.sizes.lg,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },
  
  // Base Ingredient Grid
  gridContainer: {
    padding: spacing.md,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  ingredientCard: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  ingredientEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  ingredientName: {
    fontSize: typography.sizes.xs,
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: typography.weights.medium,
  },
  variantIndicator: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  
  // Variant List
  variantList: {
    padding: spacing.lg,
  },
  variantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  variantName: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  variantArrow: {
    fontSize: typography.sizes.lg,
    color: colors.text.tertiary,
  },
  
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  searchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  searchingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text.tertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.text.quaternary,
    textAlign: 'center',
  },
});