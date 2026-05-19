// ============================================
// FRIGO - LISTS SCREEN (ViewsScreen) (Phase 8R-CP5a)
// ============================================
// "Lists" home screen (per Q2: UI calls views "lists"). Shows default views
// first, custom views below. Tap → ViewDetail. Long-press → Hide (defaults)
// or Edit/Delete (custom). + New view button opens ViewCreatorModal.
// Renamed from GroceryListsScreen.tsx in 8R-CP6c (Part 5).
// Location: screens/ViewsScreen.tsx
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react';
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

type Props = NativeStackScreenProps<ViewsStackParamList, 'Views'>;

export default function ViewsScreen({ navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const spaceId = useActiveSpaceId();

  const [views, setViews] = useState<ViewWithFilters[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
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

  // Defaults sorted first by sort_order, custom views by sort_order then created_at desc.
  const sortedViews = useMemo(() => {
    const visible = views.filter((v) => showHidden || !v.is_hidden);
    return [...visible].sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      const orderDiff = a.sort_order - b.sort_order;
      if (orderDiff !== 0) return orderDiff;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [views, showHidden]);

  const hiddenCount = useMemo(
    () => views.filter((v) => v.is_hidden).length,
    [views]
  );

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
        <Text style={styles.headerTitle}>Lists</Text>
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
        {sortedViews.map((view) => (
          <TouchableOpacity
            key={view.id}
            style={[styles.card, view.is_hidden && styles.cardHidden]}
            onPress={() => handleViewTap(view)}
            onLongPress={() => handleViewLongPress(view)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardEmoji}>{view.emoji ?? '📋'}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{view.name}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {formatFilterSubtitle(view)}
                {view.is_hidden && '  ·  hidden'}
              </Text>
            </View>
            <View style={styles.cardCount}>
              <Text style={styles.cardCountText}>{counts[view.id] ?? 0}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.newButton}
          onPress={handleNewView}
          activeOpacity={0.7}
        >
          <Text style={styles.newButtonText}>+ New list</Text>
        </TouchableOpacity>

        {hiddenCount > 0 && (
          <TouchableOpacity
            style={styles.hiddenToggle}
            onPress={() => setShowHidden((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.hiddenToggleText}>
              {showHidden
                ? 'Hide hidden lists'
                : `Show ${hiddenCount} hidden ${
                    hiddenCount === 1 ? 'list' : 'lists'
                  }`}
            </Text>
          </TouchableOpacity>
        )}
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

function formatFilterSubtitle(view: ViewWithFilters): string {
  if (view.filters.length === 0) return 'no filters';
  return view.filters
    .map((f) => `${f.dimension}: ${f.values.join(', ')}`)
    .join('  ·  ');
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
    hiddenToggle: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    hiddenToggleText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
  });
}
