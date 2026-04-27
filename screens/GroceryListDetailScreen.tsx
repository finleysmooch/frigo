// ============================================
// FRIGO - GROCERY LIST DETAIL SCREEN (3-TIER)
// ============================================
// Phase 8C-CP1: triage-driven 3-tier grouping (Now / Could wait / In cart),
// aisle sub-headers within each tier, custom items in a "Household" bucket,
// long-press → tier-move picker, priority_reason rendered as subtitle.
// Location: screens/GroceryListDetailScreen.tsx

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { typography, spacing } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import { GroceryFilled } from '../components/icons';
import {
  deleteItemFromList,
  toggleItemInCart,
  updateListItem,
  getOtherListsContainingIngredient,
  deleteItemsByIngredientFromLists,
  getItemsWithRecipes,
  getGroceryList,
  updateGroceryList,
} from '../lib/groceryListsService';
import {
  GroceryListItemWithIngredient,
  CrossListIngredientPresence,
  GroceryListItemRecipe,
} from '../lib/types/grocery';
import GroceryListItem from '../components/GroceryListItem';
import CrossListPrompt from '../components/CrossListPrompt';
import { addPantryItem } from '../lib/pantryService';
import { supabase as supabaseClient } from '../lib/supabase';

// Define the route params type
export type GroceryStackParamList = {
  GroceryLists: undefined;
  GroceryListDetail: {
    listId: string;
    listName: string;
  };
  RegularItems: undefined;
};

type Props = NativeStackScreenProps<GroceryStackParamList, 'GroceryListDetail'>;

// ============================================
// TIER MODEL
// ============================================

type Tier = 'now' | 'could_wait' | 'in_cart';

interface AisleGroup {
  aisle: string;
  items: GroceryListItemWithIngredient[];
}

interface TierGroup {
  tier: Tier;
  label: string;
  hint: string | null;
  count: number;
  aisles: AisleGroup[];
}

const HOUSEHOLD_AISLE = 'Household';

const TIER_ORDER: Tier[] = ['now', 'could_wait', 'in_cart'];

const TIER_META: Record<Tier, { label: string; hint: string | null }> = {
  now: {
    label: 'Now',
    hint: 'Acute — out of a staple or needed for a recipe this week',
  },
  could_wait: {
    label: 'Could wait',
    hint: 'Low but not out — pick up when convenient',
  },
  in_cart: {
    label: 'In cart',
    hint: null,
  },
};

function tierForItem(item: GroceryListItemWithIngredient): Tier {
  if (item.is_in_cart) return 'in_cart';
  if (item.priority === 'nice_to_have') return 'could_wait';
  return 'now';
}

function aisleForItem(item: GroceryListItemWithIngredient): string {
  if (!item.ingredient) return HOUSEHOLD_AISLE;
  const section = item.ingredient.typical_store_section;
  if (section && section.trim().length > 0) return section;
  return item.ingredient.family || HOUSEHOLD_AISLE;
}

function displayNameOf(item: GroceryListItemWithIngredient): string {
  if (item.ingredient) {
    return item.ingredient.plural_name || item.ingredient.name;
  }
  return item.custom_name || '(unnamed item)';
}

function compareAisles(a: string, b: string): number {
  if (a === HOUSEHOLD_AISLE && b !== HOUSEHOLD_AISLE) return 1;
  if (b === HOUSEHOLD_AISLE && a !== HOUSEHOLD_AISLE) return -1;
  return a.localeCompare(b);
}

export default function GroceryListDetailScreen({ route, navigation }: Props) {
  const { colors, functionalColors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },

    header: {
      backgroundColor: colors.background.card,
      paddingTop: 60,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    backButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    backButtonText: {
      fontSize: typography.sizes.lg,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    title: {
      fontSize: typography.sizes.xl,
      color: colors.text.primary,
      fontWeight: typography.weights.bold,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: spacing.sm,
    },
    headerSpacer: {
      width: 70,
    },

    progressContainer: {
      paddingLeft: spacing.lg,
      paddingRight: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    progressBar: {
      flex: 1,
      height: 8,
      backgroundColor: colors.border.medium,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: functionalColors.success,
      borderRadius: 4,
    },
    progressText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
      minWidth: 50,
    },

    actionButtonsRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      justifyContent: 'center',
    },
    addItemButton: {
      flex: 1,
      maxWidth: 160,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: 6,
      backgroundColor: colors.background.card,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addItemButtonText: {
      fontSize: typography.sizes.sm,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    toPantryButton: {
      flex: 1,
      maxWidth: 160,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: 6,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toPantryButtonDisabled: {
      backgroundColor: colors.border.medium,
    },
    toPantryButtonText: {
      fontSize: typography.sizes.sm,
      color: colors.background.card,
      fontWeight: typography.weights.semibold,
      textAlign: 'center',
    },
    toPantryButtonTextDisabled: {
      color: colors.text.tertiary,
    },

    scrollView: {
      flex: 1,
    },

    tierSection: {
      marginBottom: spacing.sm,
    },
    tierHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.border.light,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      minHeight: 44,
    },
    tierCaret: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      width: 14,
    },
    tierDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    tierDotNow: {
      backgroundColor: functionalColors.error,
    },
    tierDotCouldWait: {
      backgroundColor: colors.text.tertiary,
    },
    tierDotInCart: {
      backgroundColor: functionalColors.success,
    },
    tierLabel: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.semibold,
      flex: 1,
    },
    tierCount: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    tierHint: {
      fontSize: typography.sizes.xs,
      color: colors.text.secondary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      backgroundColor: colors.background.secondary,
    },
    aisleHeader: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.background.secondary,
    },
    aisleHeaderText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },

    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 100,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      fontSize: typography.sizes.xl,
      color: colors.text.primary,
      marginBottom: spacing.sm,
      fontWeight: typography.weights.bold,
    },
    emptyText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      textAlign: 'center',
    },

    // Phase 8C-CP3 — view-mode toggle in header
    viewModeToggle: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.xs,
    },

    // Phase 8C-CP3 — For: strip + filter chip
    recipeStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    recipeStripLabel: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      marginRight: spacing.xs,
    },
    recipeStripName: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    recipeStripDot: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      marginHorizontal: 2,
    },
    filterChipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        (colors as { info?: { light?: string } }).info?.light || '#E6F1FB',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 16,
      minHeight: 32,
    },
    filterChipText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color:
        (colors as { info?: { dark?: string } }).info?.dark || '#185FA5',
      marginRight: spacing.xs,
    },
    filterChipClose: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color:
        (colors as { info?: { dark?: string } }).info?.dark || '#185FA5',
      paddingHorizontal: 4,
    },

    // Phase 8C-CP3 — disambiguation modal
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: spacing.lg,
      maxHeight: '60%',
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border.medium,
      alignSelf: 'center',
      marginTop: spacing.sm,
    },
    sheetTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    sheetItemRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      minHeight: 56,
      justifyContent: 'center',
    },
    sheetItemTitle: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    sheetItemSubtitle: {
      fontSize: typography.sizes.xs,
      color: colors.text.secondary,
      marginTop: 2,
    },
    sheetCancel: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      marginTop: spacing.sm,
    },
    sheetCancelText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
  }), [colors, functionalColors]);

  // Extract params with proper typing
  const { listId, listName } = route.params;

  const [items, setItems] = useState<GroceryListItemWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Tier collapse state. Default: in_cart collapsed; Now and Could wait expanded.
  const [collapsedTiers, setCollapsedTiers] = useState<Record<Tier, boolean>>({
    now: false,
    could_wait: false,
    in_cart: true,
  });

  // Phase 8C-CP2: cross-list checkoff prompt state. null = no prompt visible.
  const [crossListPromptState, setCrossListPromptState] = useState<{
    visible: boolean;
    itemName: string;
    ingredientId: string;
    otherLists: CrossListIngredientPresence[];
  } | null>(null);

  // Phase 8C-CP3: per-list view mode (Compact/Detailed). Hydrated from
  // grocery_lists.view_mode on mount; toggle persists via updateGroceryList.
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');

  // Phase 8C-CP3: filter-by-recipe state. Set by tapping a single-recipe pill
  // or selecting from disambiguation sheet; cleared on chip × tap. Does NOT
  // persist across navigation (intentional per spec).
  const [activeFilter, setActiveFilter] = useState<{
    recipeId: string;
    recipeTitle: string;
  } | null>(null);

  // Phase 8C-CP3: multi-recipe pill disambiguation modal state.
  const [disambiguationState, setDisambiguationState] = useState<{
    itemId: string;
    recipes: GroceryListItemRecipe[];
  } | null>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadItems();
      hydrateViewMode();
    }
  }, [currentUserId, listId]);

  // ============================================
  // DATA LOADING
  // ============================================

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('Error getting user:', error);
    }
  };

  const loadItems = async () => {
    try {
      // Phase 8C-CP3: switched from getItemsForList to getItemsWithRecipes so
      // each item carries its junction-derived recipe attributions for the
      // pill rendering in Detailed mode. Compact mode ignores the recipes
      // field; the extra single batched query is cheap.
      const itemsData = await getItemsWithRecipes(listId);
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', 'Failed to load items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Phase 8C-CP3: hydrate per-list view_mode preference on mount.
  const hydrateViewMode = async () => {
    try {
      const list = await getGroceryList(listId);
      if (list && (list.view_mode === 'compact' || list.view_mode === 'detailed')) {
        setViewMode(list.view_mode);
      }
    } catch (error) {
      console.error('Error hydrating view mode:', error);
      // Non-fatal: keep default 'compact'.
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadItems();
  }, [listId]);

  // ============================================
  // TIER + AISLE GROUPING
  // ============================================

  const tierGroups = useMemo<TierGroup[]>(() => {
    // Phase 8C-CP3: when filter is active, restrict to items linked to the
    // filtered recipe via junction. Custom items (no `recipes`) drop out.
    const filteredItems = activeFilter
      ? items.filter((item) =>
          (item.recipes ?? []).some((r) => r.recipe_id === activeFilter.recipeId)
        )
      : items;

    const buckets: Record<Tier, Map<string, GroceryListItemWithIngredient[]>> = {
      now: new Map(),
      could_wait: new Map(),
      in_cart: new Map(),
    };

    for (const item of filteredItems) {
      const tier = tierForItem(item);
      const aisle = aisleForItem(item);
      const map = buckets[tier];
      const list = map.get(aisle) || [];
      list.push(item);
      map.set(aisle, list);
    }

    return TIER_ORDER.map((tier) => {
      const map = buckets[tier];
      const aisles: AisleGroup[] = Array.from(map.entries())
        .map(([aisle, aisleItems]) => ({
          aisle,
          items: aisleItems
            .slice()
            .sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b))),
        }))
        .sort((a, b) => compareAisles(a.aisle, b.aisle));

      const count = aisles.reduce((sum, g) => sum + g.items.length, 0);

      return {
        tier,
        label: TIER_META[tier].label,
        hint: TIER_META[tier].hint,
        count,
        aisles,
      };
    });
  }, [items, activeFilter]);

  // Phase 8C-CP3: ordered list of unique recipes appearing on this list, in
  // first-appearance order across the bucketed items. Used by the For: strip.
  const recipesOnList = useMemo<GroceryListItemRecipe[]>(() => {
    const seen = new Set<string>();
    const result: GroceryListItemRecipe[] = [];
    for (const item of items) {
      for (const r of item.recipes ?? []) {
        if (!seen.has(r.recipe_id)) {
          seen.add(r.recipe_id);
          result.push(r);
        }
      }
    }
    return result;
  }, [items]);

  // ============================================
  // STATS
  // ============================================

  const checkedCount = items.filter(item => item.is_in_cart).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  // ============================================
  // ITEM ACTIONS
  // ============================================

  const handleToggleItem = async (itemId: string, currentInCart: boolean) => {
    try {
      const newState = !currentInCart;
      // Capture from local state pre-toggle so we still have ingredient details
      // even if loadItems() reshapes the array.
      const item = items.find((i) => i.id === itemId);

      await toggleItemInCart(itemId, newState);
      await loadItems();

      // Phase 8C-CP2: cross-list prompt fires only on check-on (false → true)
      // and only for items with an ingredient_id (custom items skipped).
      if (newState && currentUserId && item?.ingredient_id && item.ingredient) {
        const otherLists = await getOtherListsContainingIngredient(
          item.ingredient_id,
          listId,
          currentUserId
        );
        if (otherLists.length > 0) {
          setCrossListPromptState({
            visible: true,
            itemName: item.ingredient.plural_name || item.ingredient.name,
            ingredientId: item.ingredient_id,
            otherLists,
          });
        }
      }
    } catch (error) {
      console.error('Error toggling item:', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleCrossListKeep = () => {
    setCrossListPromptState(null);
  };

  const handleCrossListRemove = async () => {
    const state = crossListPromptState;
    if (!state || !currentUserId) {
      setCrossListPromptState(null);
      return;
    }
    try {
      const listIds = state.otherLists.map((l) => l.list_id);
      await deleteItemsByIngredientFromLists(state.ingredientId, listIds, currentUserId);
    } catch (error) {
      console.error('Error removing cross-list items:', error);
      Alert.alert('Error', 'Failed to remove items from other lists');
    } finally {
      setCrossListPromptState(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItemFromList(itemId);
      await loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleAdjustQuantity = async (itemId: string, currentQty: number, delta: number) => {
    const newQty = Math.max(0.25, currentQty + delta);
    try {
      await updateListItem(itemId, { quantity_display: newQty });
      await loadItems();
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const handleMoveTier = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    Alert.alert(
      'Move item',
      undefined,
      [
        {
          text: 'Move to Now',
          onPress: async () => {
            try {
              await updateListItem(itemId, {
                priority: 'needed',
                priority_reason: 'manual',
                is_in_cart: false,
              });
              await loadItems();
            } catch (error) {
              console.error('Error moving item to Now:', error);
              Alert.alert('Error', 'Failed to move item');
            }
          },
        },
        {
          text: 'Move to Could wait',
          onPress: async () => {
            try {
              await updateListItem(itemId, {
                priority: 'nice_to_have',
                priority_reason: 'manual',
                is_in_cart: false,
              });
              await loadItems();
            } catch (error) {
              console.error('Error moving item to Could wait:', error);
              Alert.alert('Error', 'Failed to move item');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const toggleTier = (tier: Tier) => {
    setCollapsedTiers((prev) => ({ ...prev, [tier]: !prev[tier] }));
  };

  // Phase 8C-CP3: view-mode toggle. Optimistically update local state so the
  // UI flips immediately; persist via service. On persistence error we keep
  // the new mode for this session and let the next mount resync from DB.
  const handleToggleViewMode = async () => {
    const newMode: 'compact' | 'detailed' = viewMode === 'compact' ? 'detailed' : 'compact';
    setViewMode(newMode);
    if (newMode === 'compact') {
      // Switching to Compact clears any active filter — pills are gone.
      setActiveFilter(null);
      setDisambiguationState(null);
    }
    try {
      await updateGroceryList(listId, { viewMode: newMode });
    } catch (error) {
      console.error('Failed to persist view mode:', error);
    }
  };

  // Phase 8C-CP3: pill tap → either filter directly (1 recipe) or open the
  // disambiguation sheet (2+ recipes).
  const handleRecipePillTap = (itemId: string, recipes: GroceryListItemRecipe[]) => {
    if (recipes.length === 0) return;
    if (recipes.length === 1) {
      handleSetFilter(recipes[0].recipe_id, recipes[0].recipe_title);
      return;
    }
    setDisambiguationState({ itemId, recipes });
  };

  const handleSetFilter = (recipeId: string, recipeTitle: string) => {
    setActiveFilter({ recipeId, recipeTitle });
    setDisambiguationState(null);
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
  };

  const handleAddItem = () => {
    Alert.alert(
      'Add Item',
      'Adding items to specific lists coming soon! For now, use the main Grocery screen.',
      [{ text: 'OK' }]
    );
  };

  const handleMoveToPantry = async () => {
    const checkedItems = items.filter(item => item.is_in_cart);

    if (checkedItems.length === 0) {
      return;
    }

    Alert.alert(
      'Move to Pantry',
      `Move ${checkedItems.length} item${checkedItems.length !== 1 ? 's' : ''} to your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: async () => {
            try {
              let successCount = 0;
              let failCount = 0;

              for (const item of checkedItems) {
                try {
                  if (!item.ingredient?.id) {
                    failCount++;
                    continue;
                  }

                  // Get ingredient details for pantry storage
                  const { data: ingredient, error: ingError } = await supabaseClient
                    .from('ingredients')
                    .select('default_storage_location, shelf_life_days_fridge, shelf_life_days_pantry')
                    .eq('id', item.ingredient.id)
                    .single();

                  if (ingError) {
                    console.error('Error fetching ingredient:', ingError);
                    failCount++;
                    continue;
                  }

                  // Add to pantry
                  await addPantryItem(
                    {
                      ingredient_id: item.ingredient.id,
                      quantity_display: item.quantity_display,
                      unit_display: item.unit_display,
                      storage_location: ingredient?.default_storage_location || 'pantry',
                      purchase_date: new Date().toISOString().split('T')[0],
                      notes: item.notes || undefined,
                    },
                    currentUserId!
                  );

                  // Delete from grocery list
                  await deleteItemFromList(item.id);
                  successCount++;
                } catch (error) {
                  console.error(`Failed to move ${item.ingredient?.name}:`, error);
                  failCount++;
                }
              }

              await loadItems();

              if (failCount === 0) {
                Alert.alert(
                  'Success!',
                  `Moved ${successCount} item${successCount !== 1 ? 's' : ''} to your pantry`
                );
              } else {
                Alert.alert(
                  'Partial Success',
                  `Moved ${successCount} item${successCount !== 1 ? 's' : ''}. ${failCount} failed.`
                );
              }
            } catch (error) {
              console.error('Error moving to pantry:', error);
              Alert.alert('Error', 'Failed to move items to pantry');
            }
          },
        },
      ]
    );
  };

  // ============================================
  // RENDER
  // ============================================

  const tierDotStyle = (tier: Tier) => {
    if (tier === 'now') return styles.tierDotNow;
    if (tier === 'could_wait') return styles.tierDotCouldWait;
    return styles.tierDotInCart;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading {listName}...</Text>
      </View>
    );
  }

  const hasAnyItems = items.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{listName}</Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <GroceryFilled size={20} color={colors.primary} />
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {checkedCount} / {totalCount}
          </Text>
          {/* Phase 8C-CP3: view-mode toggle */}
          <TouchableOpacity
            style={styles.viewModeToggle}
            onPress={handleToggleViewMode}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={
              viewMode === 'compact'
                ? 'Switch to detailed view'
                : 'Switch to compact view'
            }
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              {viewMode === 'compact' ? (
                <>
                  <Path d="M4 6h16" stroke={colors.text.secondary} strokeWidth={2} strokeLinecap="round" />
                  <Path d="M4 12h16" stroke={colors.text.secondary} strokeWidth={2} strokeLinecap="round" />
                  <Path d="M4 18h16" stroke={colors.text.secondary} strokeWidth={2} strokeLinecap="round" />
                </>
              ) : (
                <>
                  <Path d="M4 6h16" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
                  <Path d="M4 10h10" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
                  <Path d="M4 14h16" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
                  <Path d="M4 18h10" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
                </>
              )}
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.addItemButton}
            onPress={handleAddItem}
          >
            <Text style={styles.addItemButtonText}>+ Add to List</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toPantryButton,
              checkedCount === 0 && styles.toPantryButtonDisabled,
            ]}
            onPress={handleMoveToPantry}
            disabled={checkedCount === 0}
          >
            <Text style={[
              styles.toPantryButtonText,
              checkedCount === 0 && styles.toPantryButtonTextDisabled,
            ]}>
              Place in Pantry ({checkedCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Phase 8C-CP3: filter chip (when active) — replaces the For: strip */}
      {activeFilter && (
        <View style={styles.filterChipRow}>
          <TouchableOpacity
            style={styles.filterChip}
            onPress={handleClearFilter}
            accessibilityRole="button"
            accessibilityLabel={`Clear filter: ${activeFilter.recipeTitle}`}
          >
            <Text style={styles.filterChipText} numberOfLines={1}>
              Showing: {activeFilter.recipeTitle}
            </Text>
            <Text style={styles.filterChipClose}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Phase 8C-CP3: For: strip — Detailed mode only, when not filtered */}
      {viewMode === 'detailed' && !activeFilter && recipesOnList.length > 0 && (
        <View style={styles.recipeStrip}>
          <Text style={styles.recipeStripLabel}>For:</Text>
          {recipesOnList.map((r, idx) => (
            <React.Fragment key={r.recipe_id}>
              {idx > 0 && <Text style={styles.recipeStripDot}>·</Text>}
              <TouchableOpacity
                onPress={() => handleSetFilter(r.recipe_id, r.recipe_title)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by recipe ${r.recipe_title}`}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={styles.recipeStripName} numberOfLines={1}>
                  {r.recipe_title}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!hasAnyItems ? (
          <View style={styles.emptyState}>
            <GroceryFilled size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No Items Yet</Text>
            <Text style={styles.emptyText}>
              Add items to your {listName} list
            </Text>
          </View>
        ) : (
          tierGroups.map((group) => {
            const isCollapsed = collapsedTiers[group.tier];
            return (
              <View key={group.tier} style={styles.tierSection}>
                <TouchableOpacity
                  style={styles.tierHeader}
                  onPress={() => toggleTier(group.tier)}
                  accessibilityRole="button"
                  accessibilityLabel={`${group.label} tier, ${group.count} ${group.count === 1 ? 'item' : 'items'}, ${isCollapsed ? 'collapsed' : 'expanded'}`}
                >
                  <Text style={styles.tierCaret}>{isCollapsed ? '▶' : '▼'}</Text>
                  <View style={[styles.tierDot, tierDotStyle(group.tier)]} />
                  <Text style={styles.tierLabel}>{group.label}</Text>
                  <Text style={styles.tierCount}>· {group.count}</Text>
                </TouchableOpacity>

                {group.hint && !isCollapsed && (
                  <Text style={styles.tierHint}>{group.hint}</Text>
                )}

                {!isCollapsed && group.aisles.map((aisleGroup) => (
                  <View key={`${group.tier}:${aisleGroup.aisle}`}>
                    <View style={styles.aisleHeader}>
                      <Text style={styles.aisleHeaderText}>{aisleGroup.aisle}</Text>
                    </View>
                    {aisleGroup.items.map((item) => (
                      <GroceryListItem
                        key={item.id}
                        item={item}
                        viewMode={viewMode}
                        onToggleCart={handleToggleItem}
                        onAdjustQuantity={handleAdjustQuantity}
                        onMoveTier={handleMoveTier}
                        onDelete={handleDeleteItem}
                        onRecipePillTap={handleRecipePillTap}
                      />
                    ))}
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {crossListPromptState && (
        <CrossListPrompt
          visible={crossListPromptState.visible}
          itemName={crossListPromptState.itemName}
          otherLists={crossListPromptState.otherLists}
          onKeep={handleCrossListKeep}
          onRemove={handleCrossListRemove}
          onDismiss={() => setCrossListPromptState(null)}
        />
      )}

      {/* Phase 8C-CP3: multi-recipe disambiguation sheet */}
      <Modal
        visible={!!disambiguationState}
        transparent
        animationType="slide"
        onRequestClose={() => setDisambiguationState(null)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setDisambiguationState(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filter by which recipe?</Text>
            {disambiguationState?.recipes.map((r) => {
              const itemCount = items.filter((it) =>
                (it.recipes ?? []).some((rr) => rr.recipe_id === r.recipe_id)
              ).length;
              return (
                <TouchableOpacity
                  key={r.recipe_id}
                  style={styles.sheetItemRow}
                  onPress={() => handleSetFilter(r.recipe_id, r.recipe_title)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${r.recipe_title}, ${itemCount} items`}
                >
                  <Text style={styles.sheetItemTitle}>{r.recipe_title}</Text>
                  <Text style={styles.sheetItemSubtitle}>
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setDisambiguationState(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
