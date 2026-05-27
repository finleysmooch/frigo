// ============================================
// FRIGO - LISTS SCREEN (ViewsScreen) (Phase 8R-CP5a)
// ============================================
// "Lists" home screen (per Q2: UI calls views "lists"). Shows default views
// first, custom views below. Tap → ViewDetail. Long-press → Hide (defaults)
// or Edit/Delete (custom). + New view button opens ViewCreatorModal.
// Renamed from GroceryListsScreen.tsx in 8R-CP6c (Part 5).
// Location: screens/ViewsScreen.tsx
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ViewsStackParamList } from '../App';
import {
  deleteView,
  getViewsForSpace,
  toggleViewHidden,
} from '../lib/services/viewsService';
import { getNeedsForView, mergeNeedsForDisplay } from '../lib/services/needsService';
import { ViewWithFilters } from '../lib/types/views';
import { useActiveSpaceId } from '../contexts/SpaceContext';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';
import ViewCreatorModal from '../components/ViewCreatorModal';
import HiddenIcon from '../components/icons/HiddenIcon';
import { renderListIcon } from '../lib/utils/listIcon';

type Props = NativeStackScreenProps<ViewsStackParamList, 'Views'>;

export default function ViewsScreen({ navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const spaceId = useActiveSpaceId();

  const [views, setViews] = useState<ViewWithFilters[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hiddenExpanded, setHiddenExpanded] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editingView, setEditingView] = useState<ViewWithFilters | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  const load = useCallback(async (sid: string) => {
    try {
      const allViews = await getViewsForSpace(sid, true); // includeHidden=true; UI gates on showHidden
      setViews(allViews);
      // Counts via parallel Promise.all — N+1 by design at F&F scale (4-7 views).
      // TODO: post-F&F if view count grows, consider getViewCountsForSpace RPC.
      // includeRecipes=false: counts don't need recipe attribution; saves N extra queries.
      const countsResult = await Promise.all(
        allViews.map(async (v) => {
          try {
            const needs = await getNeedsForView(v.id);
            const merged = mergeNeedsForDisplay(needs);
            return [v.id, merged.length] as const;
          } catch (error) {
            console.error('❌ ViewsScreen count error for view:', v.id, error);
            return [v.id, 0] as const;
          }
        })
      );
      const map: Record<string, number> = {};
      for (const [id, count] of countsResult) map[id] = count;
      setCounts(map);
    } catch (error) {
      console.error('❌ ViewsScreen load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (spaceId) {
      setLoading(true);
      load(spaceId);
    }
  }, [spaceId, load]);

  useFocusEffect(
    useCallback(() => {
      if (spaceId) load(spaceId);
    }, [spaceId, load])
  );

  const handleRefresh = useCallback(() => {
    if (!spaceId) return;
    setRefreshing(true);
    load(spaceId);
  }, [spaceId, load]);

  const handleViewTap = (view: ViewWithFilters) => {
    navigation.navigate('ViewDetail', { viewId: view.id });
  };

  const handleViewLongPress = (view: ViewWithFilters) => {
    if (view.is_default) {
      Alert.alert(view.name, undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: view.is_hidden ? 'Unhide' : 'Hide',
          onPress: async () => {
            try {
              await toggleViewHidden(view.id);
              if (spaceId) await load(spaceId);
            } catch (error) {
              console.error('❌ toggleViewHidden error:', error);
              Alert.alert('Error', 'Could not update.');
            }
          },
        },
      ]);
    } else {
      Alert.alert(view.name, undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => {
            setEditingView(view);
            setCreatorOpen(true);
          },
        },
        {
          text: view.is_hidden ? 'Unhide' : 'Hide',
          onPress: async () => {
            try {
              await toggleViewHidden(view.id);
              if (spaceId) await load(spaceId);
            } catch (error) {
              console.error('❌ toggleViewHidden error:', error);
              Alert.alert('Error', 'Could not update.');
            }
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(`Delete ${view.name}?`, 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteView(view.id);
                    if (spaceId) await load(spaceId);
                  } catch (error) {
                    console.error('❌ deleteView error:', error);
                    Alert.alert('Error', 'Could not delete.');
                  }
                },
              },
            ]);
          },
        },
      ]);
    }
  };

  const handleUnhideOne = async (viewId: string) => {
    try {
      await toggleViewHidden(viewId);
      if (spaceId) await load(spaceId);
    } catch (error) {
      console.error('❌ toggleViewHidden error:', error);
      Alert.alert('Error', 'Could not unhide.');
    }
  };

  const handleNewView = () => {
    setEditingView(null);
    setCreatorOpen(true);
  };

  const handleCreatorClose = () => {
    setCreatorOpen(false);
    setEditingView(null);
  };

  const handleCreatorSaved = () => {
    if (spaceId) load(spaceId);
  };

  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  // Defaults sorted first by sort_order, custom views by sort_order then
  // created_at desc. 8R-UX1: In Cart pins to the very bottom regardless of
  // sort_order, so new custom lists slot in above it. Hidden lists are
  // EXCLUDED entirely from the main grid — they live in a single "Hidden
  // lists" row rendered above the In Cart divider.
  const sortedViews = useMemo(() => {
    const visible = views.filter((v) => !v.is_hidden);
    return [...visible].sort((a, b) => {
      const aIsCart = a.is_default && a.name === 'In Cart';
      const bIsCart = b.is_default && b.name === 'In Cart';
      if (aIsCart !== bIsCart) return aIsCart ? 1 : -1;
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      const orderDiff = a.sort_order - b.sort_order;
      if (orderDiff !== 0) return orderDiff;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [views]);

  const hiddenViews = useMemo(
    () => views.filter((v) => v.is_hidden),
    [views]
  );
  const hiddenCount = hiddenViews.length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>My Lists</Text>
        <Text style={styles.headerSubtitle}>
          {sortedViews.length} {sortedViews.length === 1 ? 'list' : 'lists'}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {sortedViews.map((view) => {
          const listIcon = renderListIconSlot(view, colors);
          const subtitle = formatFilterSubtitle(view);
          const showSubtitle = subtitle.length > 0 || view.is_hidden;
          // 8R-UX1: In Cart is visually separated from the active grocery
          // trio — it's a staged/transition state, not a to-do bucket. Render
          // a thin divider above it and apply a muted card style.
          const isInCart = view.is_default && view.name === 'In Cart';
          return (
            <React.Fragment key={view.id}>
              {isInCart && hiddenCount > 0 && (
                <View>
                  <TouchableOpacity
                    style={styles.hiddenRow}
                    onPress={() => setHiddenExpanded((prev) => !prev)}
                    activeOpacity={0.6}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${hiddenCount} hidden ${hiddenCount === 1 ? 'list' : 'lists'}, tap to ${hiddenExpanded ? 'collapse' : 'expand'}`}
                  >
                    <HiddenIcon size={16} color={colors.text.tertiary} />
                    <Text style={styles.hiddenRowText}>
                      {hiddenCount} hidden {hiddenCount === 1 ? 'list' : 'lists'} {hiddenExpanded ? '▾' : '▸'}
                    </Text>
                  </TouchableOpacity>
                  {hiddenExpanded && (
                    <View style={styles.hiddenExpandedList}>
                      {hiddenViews.map((hv) => (
                        <TouchableOpacity
                          key={hv.id}
                          style={styles.hiddenItemRow}
                          onPress={() => handleUnhideOne(hv.id)}
                          activeOpacity={0.6}
                          accessibilityRole="button"
                          accessibilityLabel={`Unhide ${hv.name}`}
                        >
                          <Text style={styles.hiddenItemName} numberOfLines={1}>
                            {hv.name}
                          </Text>
                          <Text style={styles.hiddenItemAction}>Unhide</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
              {isInCart && <View style={styles.inCartDivider} />}
              <TouchableOpacity
                style={[
                  styles.card,
                  view.is_hidden && styles.cardHidden,
                  isInCart && styles.cardMuted,
                ]}
                onPress={() => handleViewTap(view)}
                onLongPress={() => handleViewLongPress(view)}
                activeOpacity={0.7}
              >
                {listIcon ?? (
                  <Text style={styles.cardEmoji}>{view.emoji ?? '📋'}</Text>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{view.name}</Text>
                  {showSubtitle && (
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {subtitle}
                      {view.is_hidden && (subtitle ? '  ·  hidden' : 'hidden')}
                    </Text>
                  )}
                </View>
                <View style={styles.cardCount}>
                  <Text style={styles.cardCountText}>{counts[view.id] ?? 0}</Text>
                </View>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}

        <TouchableOpacity
          style={styles.newButton}
          onPress={handleNewView}
          activeOpacity={0.7}
        >
          <Text style={styles.newButtonText}>+ New list</Text>
        </TouchableOpacity>
      </ScrollView>

      {spaceId && currentUserId && (
        <ViewCreatorModal
          visible={creatorOpen}
          onClose={handleCreatorClose}
          onSaved={handleCreatorSaved}
          spaceId={spaceId}
          userId={currentUserId}
          existingView={editingView}
        />
      )}
    </View>
  );
}

// 8R-UX1: subtitle communicates the filter cascade — where else items in
// this list appear.
//   Default lists:
//     Medium List → "Includes Short List"
//     Long List   → "Includes everything"
//     Short List  → (nothing — bottom of the cascade)
//     In Cart     → (nothing — separate semantic)
//   Custom lists: read the view's urgency filter to determine cascade target.
//     urgency=['today']      → "Also in Short List"
//     urgency=['this-week']  → "Also in Medium List"
//     no urgency filter      → "Also in Long List"
function formatFilterSubtitle(view: ViewWithFilters): string {
  if (view.is_default) {
    if (view.name === 'Medium List') return 'Includes Short List';
    if (view.name === 'Long List') return 'Includes everything';
    return '';
  }
  // Standalone (private) custom lists are identified by an event tag value
  // suffixed with `__private` (set by ViewCreatorModal's "Just this list").
  const eventFilter = view.filters.find((f) => f.dimension === 'event');
  if (eventFilter?.values.some((v) => v.endsWith('__private'))) {
    return 'Only in this list';
  }
  const urgencyFilter = view.filters.find((f) => f.dimension === 'urgency');
  if (urgencyFilter?.values.includes('today')) return 'Also in Short List';
  if (urgencyFilter?.values.includes('this-week')) return 'Also in Medium List';
  return 'Also in Long List';
}

// 8R-UX6 Item 4b: renderListIcon extracted to lib/utils/listIcon.tsx.
// Local wrapper preserves the 56px-wide centered slot used for card-body
// alignment in ViewsScreen (other callers render the raw icon).
const LIST_ICON_SIZE = 46;
const LIST_ICON_SLOT_WIDTH = 56;

function renderListIconSlot(
  view: ViewWithFilters,
  colors: ReturnType<typeof useTheme>['colors']
): React.ReactElement | null {
  const icon = renderListIcon(view, {
    size: LIST_ICON_SIZE,
    iconColor: colors.primary,
    cartColor: colors.text.primary,
  });
  if (!icon) return null;
  return (
    <View
      style={{
        width: LIST_ICON_SLOT_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
      }}
    >
      {icon}
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  _fc: ReturnType<typeof useTheme>['functionalColors']
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.primary,
    },
    headerContainer: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 12,
      backgroundColor: colors.background.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.text.secondary,
      marginTop: 2,
    },
    scroll: { flex: 1 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    cardHidden: { opacity: 0.5 },
    // 8R-UX1: In Cart is visually de-emphasized vs the active grocery trio.
    cardMuted: {
      backgroundColor: colors.background.secondary,
      borderColor: 'transparent',
    },
    inCartDivider: {
      height: 1,
      backgroundColor: colors.border.light,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    cardEmoji: { fontSize: 28, marginRight: 12 },
    cardBody: { flex: 1 },
    cardName: {
      fontSize: 16,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    cardSubtitle: {
      fontSize: 12,
      color: colors.text.secondary,
      marginTop: 2,
    },
    cardCount: {
      minWidth: 32,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
    },
    cardCountText: {
      fontSize: 13,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    newButton: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      paddingVertical: 12,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border.medium,
      alignItems: 'center',
    },
    newButtonText: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    hiddenRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      paddingVertical: 4,
      gap: 6,
    },
    hiddenRowText: {
      fontSize: 13,
      color: colors.text.tertiary,
      fontWeight: typography.weights.medium,
    },
    hiddenExpandedList: {
      marginHorizontal: spacing.md,
      marginTop: 4,
      marginLeft: spacing.md + 22,
    },
    hiddenItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 4,
      gap: 12,
    },
    hiddenItemName: {
      flex: 1,
      fontSize: 14,
      color: colors.text.secondary,
    },
    hiddenItemAction: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
  });
}
