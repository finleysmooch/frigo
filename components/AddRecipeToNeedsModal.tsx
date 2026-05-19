// ============================================
// FRIGO - ADD RECIPE TO NEEDS MODAL (Phase 8R-CP6d-Recipe rebuild)
// ============================================
// Forces an urgency / list choice before adding (Gap-G38).
//
// Layout (bottom sheet):
//   [Header] Cancel / "Add to {selectedView.name}"
//   [Title] "Add to..."
//   [Subtitle] "N ingredients from {recipe title}"
//   [List picker button] tap → secondary picker modal (Today / This Week /
//     divider / custom views).
//   [Ingredient summary] compact, scrollable.
//   [Footer] Cancel + Add (disabled until selectedView !== null).
//
// On confirm: per ingredient, call addNeedFromRecipe with the selected view's
// non-status filters resolved to tag IDs (via getOrCreateTag). T1 dedup
// applies via the softened createNeed predicate (CP6d-Schema).
// Location: components/AddRecipeToNeedsModal.tsx
// ============================================

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { typography, spacing, borderRadius } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import { addNeedFromRecipe } from '../lib/services/needsService';
import { getViewsForSpace } from '../lib/services/viewsService';
import { getOrCreateTag, getTagsForSpace } from '../lib/services/tagsService';
import { ViewWithFilters } from '../lib/types/views';
import { Tag, TagDimension } from '../lib/types/tags';
import { supabase } from '../lib/supabase';

interface Ingredient {
  id: string;
  name: string;
  quantity_amount?: number;
  quantity_unit?: string;
  family: string;
}

interface Recipe {
  id: string;
  title: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  recipe: Recipe;
  ingredients: Ingredient[];
  scale: number;
  spaceId: string;
  /**
   * Which CTA opened the modal — drives the Add button label so the post-tap
   * UX matches the pre-tap one (mirrors the RecipeDetailScreen dual-CTA
   * wording). Default 'all' for backwards compatibility.
   */
  mode?: 'missing' | 'all';
}

// Synthetic-view sentinel: when the user picks "Today" or "This Week" but no
// matching default view exists in the space, we fabricate a placeholder that
// drives only the urgency tag. The shape is compatible enough with
// ViewWithFilters for our consumption (we only use `name` + `filters`).
type PickedView =
  | { kind: 'real'; view: ViewWithFilters }
  | {
      kind: 'synthetic';
      name: string;
      filters: Array<{ dimension: 'urgency'; values: string[] }>;
    };

function pickedViewName(pv: PickedView | null): string {
  if (!pv) return '';
  return pv.kind === 'real' ? pv.view.name : pv.name;
}

function pickedViewFilters(pv: PickedView): Array<{ dimension: string; values: string[] }> {
  if (pv.kind === 'real') return pv.view.filters;
  return pv.filters;
}

export default function AddRecipeToNeedsModal({
  visible,
  onClose,
  recipe,
  ingredients,
  scale,
  spaceId,
  mode = 'all',
}: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  const [selected, setSelected] = useState<PickedView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allViews, setAllViews] = useState<ViewWithFilters[]>([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const [adding, setAdding] = useState(false);

  // Hydrate views on open.
  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    setPickerOpen(false);
    setLoadingViews(true);
    (async () => {
      try {
        const views = await getViewsForSpace(spaceId, false);
        setAllViews(views);
      } catch (error) {
        console.error('❌ AddRecipeToNeedsModal views load error:', error);
        setAllViews([]);
      } finally {
        setLoadingViews(false);
      }
    })();
  }, [visible, spaceId]);

  const ingredientCount = ingredients.filter((i) => i.quantity_amount).length;

  // Find default views matching urgency=today / this-week so we can resolve
  // the "Today" / "This Week" pseudo-options to real views when present.
  const todayView = useMemo(
    () =>
      allViews.find(
        (v) =>
          v.is_default &&
          v.filters.some(
            (f) =>
              f.dimension === 'urgency' && f.values.includes('today')
          )
      ),
    [allViews]
  );
  const thisWeekView = useMemo(
    () =>
      allViews.find(
        (v) =>
          v.is_default &&
          v.filters.some(
            (f) =>
              f.dimension === 'urgency' && f.values.includes('this-week')
          )
      ),
    [allViews]
  );

  // Custom views shown in the "Pick another" section. Excludes default views
  // that are already represented above (Today / This Week). Default-named
  // views without urgency tags (e.g., "All needs", "In cart") still appear
  // in the custom list — users can dump ingredients there if they really
  // want to skip urgency entirely.
  const customViews = useMemo(() => {
    const usedIds = new Set<string>();
    if (todayView) usedIds.add(todayView.id);
    if (thisWeekView) usedIds.add(thisWeekView.id);
    return allViews.filter((v) => !usedIds.has(v.id));
  }, [allViews, todayView, thisWeekView]);

  const pickToday = () => {
    if (todayView) {
      setSelected({ kind: 'real', view: todayView });
    } else {
      setSelected({
        kind: 'synthetic',
        name: 'Today',
        filters: [{ dimension: 'urgency', values: ['today'] }],
      });
    }
    setPickerOpen(false);
  };
  const pickThisWeek = () => {
    if (thisWeekView) {
      setSelected({ kind: 'real', view: thisWeekView });
    } else {
      setSelected({
        kind: 'synthetic',
        name: 'This Week',
        filters: [{ dimension: 'urgency', values: ['this-week'] }],
      });
    }
    setPickerOpen(false);
  };
  const pickCustom = (v: ViewWithFilters) => {
    setSelected({ kind: 'real', view: v });
    setPickerOpen(false);
  };

  /**
   * Resolve view filters to tag IDs. Mirrors the InlineAddNeedRow helper —
   * non-status filters get dimension+value pairs resolved to existing tags
   * via case-insensitive lookup, falling back to getOrCreateTag for missing
   * ones. Default views may reference tag values that haven't been
   * materialized for this space yet.
   */
  const resolveFiltersToTagIds = async (
    spaceTags: Tag[],
    pv: PickedView,
    addedBy: string
  ): Promise<string[]> => {
    const tagIds: string[] = [];
    for (const f of pickedViewFilters(pv)) {
      if (f.dimension === 'status') continue;
      for (const value of f.values) {
        const existing = spaceTags.find(
          (t) =>
            t.dimension === f.dimension &&
            t.value.toLowerCase() === value.toLowerCase()
        );
        if (existing) {
          tagIds.push(existing.id);
        } else {
          try {
            const created = await getOrCreateTag(
              spaceId,
              f.dimension as TagDimension,
              value,
              addedBy
            );
            tagIds.push(created.id);
          } catch (error) {
            console.error('❌ Failed to resolve view filter to tag:', error);
          }
        }
      }
    }
    return tagIds;
  };

  const handleAdd = async () => {
    if (!selected) return;
    if (!spaceId) {
      Alert.alert('No active space', 'Pick a space before adding to needs.');
      return;
    }

    try {
      setAdding(true);

      const { data: { user } } = await supabase.auth.getUser();
      const addedBy = user?.id;
      if (!addedBy) {
        Alert.alert('Not signed in', 'Sign in before adding to needs.');
        setAdding(false);
        return;
      }

      // Hydrate the space's tag catalog ONCE for tag-id lookup.
      const spaceTags = await getTagsForSpace(spaceId);
      const tagIds = await resolveFiltersToTagIds(spaceTags, selected, addedBy);

      let addedCount = 0;
      let failedCount = 0;
      const unmatchedItems: string[] = [];

      for (const ingredient of ingredients) {
        try {
          if (!ingredient.id || ingredient.id.startsWith('unmatched-')) {
            unmatchedItems.push(ingredient.name);
            failedCount++;
            continue;
          }

          const scaledQty = ingredient.quantity_amount
            ? ingredient.quantity_amount * scale
            : 1;
          const unit = ingredient.quantity_unit || 'unit';

          await addNeedFromRecipe({
            spaceId,
            ingredientId: ingredient.id,
            quantityDisplay: scaledQty,
            unitDisplay: unit,
            recipeId: recipe.id,
            recipeQuantityAmount: scaledQty,
            recipeQuantityUnit: unit,
            addedBy,
            tagIds,
          });
          addedCount++;
        } catch (error) {
          console.error(`Failed to add ${ingredient.name}:`, error);
          failedCount++;
        }
      }

      const destName = pickedViewName(selected);
      let message =
        addedCount > 0
          ? `Added ${addedCount} ingredient${addedCount === 1 ? '' : 's'} to ${destName}`
          : 'No ingredients added.';
      if (unmatchedItems.length > 0) {
        message += `\n\nCouldn't add (not in database):\n• ${unmatchedItems.join('\n• ')}`;
      }
      if (failedCount > unmatchedItems.length) {
        message += `\n\n${failedCount - unmatchedItems.length} other items failed.`;
      }

      Alert.alert(addedCount > 0 ? 'Success!' : 'No items added', message, [
        { text: 'OK', onPress: onClose },
      ]);
    } catch (error) {
      console.error('Error adding to needs:', error);
      Alert.alert('Error', 'Failed to add ingredients to needs');
    } finally {
      setAdding(false);
    }
  };

  const headerActionLabel = selected ? `Add to ${pickedViewName(selected)}` : 'Add to...';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={adding}>
              <Text style={styles.headerCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerActionLabel}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Title + subtitle */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Add to...</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'} from "{recipe.title}"
              {scale !== 1 ? ` · scaled ${scale}x` : ''}
            </Text>
          </View>

          {/* List picker button */}
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setPickerOpen(true)}
            disabled={adding || loadingViews}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              selected ? `Selected list: ${pickedViewName(selected)}` : 'Pick a list'
            }
          >
            <Text
              style={[
                styles.pickerButtonText,
                !selected && styles.pickerButtonPlaceholder,
              ]}
              numberOfLines={1}
            >
              {selected ? pickedViewName(selected) : 'Tap to pick a list'}
            </Text>
            <Text style={styles.pickerChevron}>▾</Text>
          </TouchableOpacity>

          {/* Ingredients summary */}
          <ScrollView style={styles.ingredientsContainer}>
            {ingredients.map((ing, idx) => (
              <View key={`${ing.id}-${idx}`} style={styles.ingredientRow}>
                <Text style={styles.ingredientName} numberOfLines={1}>
                  {ing.name}
                </Text>
                {ing.quantity_amount !== undefined && (
                  <Text style={styles.ingredientQty}>
                    {(ing.quantity_amount * scale).toFixed(2).replace(/\.?0+$/, '')}{' '}
                    {ing.quantity_unit ?? ''}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelFooterButton}
              onPress={onClose}
              disabled={adding}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelFooterButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.addButton,
                (!selected || adding) && styles.addButtonDisabled,
              ]}
              onPress={handleAdd}
              disabled={!selected || adding}
              activeOpacity={0.7}
            >
              {adding ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.addButtonText}>
                  {selected
                    ? mode === 'missing'
                      ? `Add ${ingredientCount} missing →`
                      : `Add all ${ingredientCount} →`
                    : 'Pick a list to add'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* List picker secondary modal */}
          <Modal
            visible={pickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setPickerOpen(false)}
          >
            <Pressable
              style={styles.pickerOverlay}
              onPress={() => setPickerOpen(false)}
            >
              <Pressable style={styles.pickerCard} onPress={() => {}}>
                <Text style={styles.pickerHeading}>Pick a list</Text>
                {/* Today / This Week — top section */}
                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={pickToday}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerOptionLabel}>Today</Text>
                  <Text style={styles.pickerOptionMeta}>urgency = today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={pickThisWeek}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerOptionLabel}>This Week</Text>
                  <Text style={styles.pickerOptionMeta}>urgency = this-week</Text>
                </TouchableOpacity>
                {customViews.length > 0 && <View style={styles.pickerDivider} />}
                {/* Pick another / custom */}
                {customViews.length > 0 && (
                  <Text style={styles.pickerSubheading}>Pick another list…</Text>
                )}
                <ScrollView style={styles.pickerScroll}>
                  {customViews.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={styles.pickerOption}
                      onPress={() => pickCustom(v)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pickerOptionLabel}>
                        {v.emoji ? `${v.emoji} ` : ''}
                        {v.name}
                      </Text>
                      <Text style={styles.pickerOptionMeta}>
                        {v.filters
                          .filter((f) => f.dimension !== 'status')
                          .map((f) => `${f.dimension}=${f.values.join('/')}`)
                          .join(' · ') || 'no filters'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.pickerCancel}
                  onPress={() => setPickerOpen(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  _fc: ReturnType<typeof useTheme>['functionalColors']
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
      paddingBottom: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerCancel: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      width: 60,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    titleBlock: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      marginTop: 4,
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    pickerButtonText: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    pickerButtonPlaceholder: {
      color: colors.text.placeholder,
      fontWeight: typography.weights.regular,
    },
    pickerChevron: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginLeft: spacing.sm,
    },
    ingredientsContainer: {
      maxHeight: 240,
      paddingHorizontal: spacing.lg,
      paddingVertical: 4,
    },
    ingredientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    ingredientName: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
    },
    ingredientQty: {
      fontSize: typography.sizes.xs,
      color: colors.text.secondary,
      marginLeft: spacing.sm,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    cancelFooterButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
    },
    cancelFooterButtonText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      fontWeight: typography.weights.semibold,
    },
    addButton: {
      flex: 2,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonDisabled: {
      opacity: 0.4,
    },
    addButtonText: {
      fontSize: typography.sizes.md,
      color: '#ffffff',
      fontWeight: typography.weights.bold,
    },
    // Picker secondary modal
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    pickerCard: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      maxHeight: '70%',
    },
    pickerHeading: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    pickerSubheading: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.text.tertiary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: 4,
    },
    pickerScroll: {
      maxHeight: 320,
    },
    pickerOption: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    pickerOptionLabel: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    pickerOptionMeta: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    pickerDivider: {
      height: 8,
    },
    pickerCancel: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    pickerCancelText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
  });
}
