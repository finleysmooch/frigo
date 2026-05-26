// ============================================
// FRIGO - PANTRY SCREEN (Phase 8R-CP6d-Pantry)
// ============================================
// Header redesign: "My Pantry" title left, subtle home + profile icon group
// right (home-icon shows space label, profile-icon opens space switcher).
// Multi-purpose search bar moves into the screen header level (Gap-P1).
// 8R-UX1: StaleItemsBanner removed; stale items folded into SuppliesSection's
// "Use Soon" top section (alongside expiring lots).
// Location: screens/PantryScreen.tsx
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { PantryStackParamList } from '../App';
import PantryOutline from '../components/icons/PantryOutline';
import TimerIcon from '../components/icons/recipe/TimerIcon';
import AlertCircleIcon from '../components/icons/AlertCircleIcon';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { useSpace, useActiveSpaceId, useSpaceSwitcher } from '../contexts/SpaceContext';
import SpaceSwitcherInline from '../components/SpaceSwitcherInline';
import CreateSpaceModal from '../components/CreateSpaceModal';
import PendingSpaceInvitations from '../components/PendingSpaceInvitations';
import SuppliesSection, {
  SuppliesSectionRef,
} from '../components/pantry/SuppliesSection';
import PantrySearchBar from '../components/pantry/PantrySearchBar';
import SupplyQuickEditModal from '../components/pantry/SupplyQuickEditModal';
import SupplyCreateSheet from '../components/SupplyCreateSheet';
import ListPickerModal from '../components/ListPickerModal';
import {
  getHeroFrequency,
  type HeroFrequencyData,
} from '../lib/services/heroIngredientService';
import { SupplyWithTags } from '../lib/types/supplies';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<PantryStackParamList, 'Pantry'>;

// ============================================
// SCREEN
// ============================================

export default function PantryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { activeSpace, isLoading: spaceLoading, isSwitching, refreshSpaces } =
    useSpace();
  const { currentSpace } = useSpaceSwitcher();
  const activeSpaceId = useActiveSpaceId();

  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false);
  const [supplyCreateSheetOpen, setSupplyCreateSheetOpen] = useState(false);
  const [createSheetInitialQuery, setCreateSheetInitialQuery] = useState<
    string | undefined
  >(undefined);
  // 8R-UX1: when set, SupplyCreateSheet opens with this ingredient already
  // selected (skips the search-and-pick step). Wired from shadow-row taps.
  const [createSheetInitialIngredient, setCreateSheetInitialIngredient] =
    useState<{ id: string; name: string } | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSpaceSwitcherSheet, setShowSpaceSwitcherSheet] = useState(false);
  // CP6d-SmokeFix-1 (P32): long-press quick-edit modal.
  const [quickEditSupply, setQuickEditSupply] = useState<SupplyWithTags | null>(null);

  // 8R-UX1: state lifted from SuppliesSection so the toolbar / action-bar
  // can sit in the sticky white space below the search bar. Defaults:
  // groupBy='type' (hierarchical family > type view), merged=true.
  const [groupBy, setGroupBy] = useState<'family' | 'type' | 'storage'>('type');
  const [mergeOnHandRegulars, setMergeOnHandRegulars] = useState(true);
  // 8R-UX1: collapsed by default — a small chevron exposes the full controls.
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActioning, setBulkActioning] = useState(false);
  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, []);
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);
  const toggleSelection = useCallback((supplyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(supplyId)) next.delete(supplyId);
      else next.add(supplyId);
      return next;
    });
  }, []);

  const suppliesRef = useRef<SuppliesSectionRef>(null);

  // 8R-UX1: bulk actions are delegated to SuppliesSection via ref — it owns
  // the supplies data. Parent just collects IDs from selectedIds and asks
  // the ref to do the work, then exits selection mode.
  const runBulk = useCallback(
    async (op: (ids: string[]) => Promise<void>) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      setBulkActioning(true);
      try {
        await op(ids);
      } finally {
        setBulkActioning(false);
        exitSelectionMode();
      }
    },
    [selectedIds, exitSelectionMode]
  );
  const handleBulkMarkInStock = useCallback(
    () => runBulk((ids) => suppliesRef.current?.bulkMarkInStock(ids) ?? Promise.resolve()),
    [runBulk]
  );
  const handleBulkMarkOut = useCallback(
    () => runBulk((ids) => suppliesRef.current?.bulkMarkOut(ids) ?? Promise.resolve()),
    [runBulk]
  );
  // 8R-UX3: outer tab strip state. Three tabs in StatsScreen toggleRow style.
  // Default 'everything' = current behavior. Switching outer tab resets the
  // inner family pill to that outer's default (handled inside SuppliesSection).
  const [activeOuterTab, setActiveOuterTab] = useState<
    'everything' | 'use_soon' | 'low_out'
  >('everything');
  const [outerCounts, setOuterCounts] = useState<{
    everything: number;
    useSoon: number;
    lowOut: number;
  }>({ everything: 0, useSoon: 0, lowOut: 0 });

  // 8R-UX5: hero ingredient frequency — loaded once on mount + on every
  // refreshTrigger bump. Non-blocking; null during load / on failure means
  // SuppliesSection degrades gracefully (no ⚡ markers, no Heroes pill).
  const [heroFrequencyData, setHeroFrequencyData] = useState<HeroFrequencyData | null>(null);
  useEffect(() => {
    if (!activeSpaceId) return;
    let cancelled = false;
    getHeroFrequency(activeSpaceId)
      .then((data) => {
        if (!cancelled) setHeroFrequencyData(data);
      })
      .catch((err) => {
        console.error('❌ heroFrequency load failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSpaceId, refreshTrigger]);

  // 8R-UX1 continuation: open list picker first; the picker resolves
  // view-context tag IDs and passes them into bulkAddToGrocery so the new
  // needs land in the chosen list (Short/Medium/Long/custom). Without the
  // picker, needs were created untagged → only Long List could see them.
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const handleBulkAddToGrocery = useCallback(
    () => setListPickerOpen(true),
    []
  );
  const handleListPicked = useCallback(
    async (_view: unknown, tagIds: string[]) => {
      setListPickerOpen(false);
      await runBulk(
        (ids) =>
          suppliesRef.current?.bulkAddToGrocery(ids, tagIds) ?? Promise.resolve()
      );
    },
    [runBulk]
  );

  // 8R-UX1: find recipes that use all selected supplies. We pull display
  // names from the SuppliesSection ref's snapshot of selectedIds → supplies,
  // then cross-stack-nav into RecipeListScreen with the joined names as
  // initialIngredient. Live-search there tokenizes on whitespace + ANDs the
  // tokens across recipe text (ingredient names + original_text), so a
  // multi-name query lands as an intersection.
  const handleBulkFindRecipes = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const names = await (suppliesRef.current?.getDisplayNamesForIds?.(ids) ?? Promise.resolve([] as string[]));
    const joined = names.filter((n) => n.length > 0).join(' ');
    exitSelectionMode();
    if (!joined) return;
    (navigation.getParent() as any)?.navigate('RecipesStack', {
      screen: 'RecipeList',
      params: { initialIngredient: joined, initialBrowseMode: 'all' },
    });
  }, [selectedIds, exitSelectionMode, navigation]);

  // CP6d-SmokeFix-3 (V33 auto-refresh): re-pull supplies when the screen
  // gains focus, so navigating back from BulkAcquire / SupplyDetail / etc.
  // surfaces newly-created supplies immediately. SuppliesSection reacts to
  // refreshTrigger by re-fetching getSuppliesForSpace.
  useFocusEffect(
    useCallback(() => {
      setRefreshTrigger((n) => n + 1);
    }, [])
  );

  // CP6d-SmokeFix-2 (Task 5): clear search when the user re-taps the Pantry
  // tab while already focused on this screen. `getParent()` walks up to the
  // bottom-tab navigator that owns the tabPress event.
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    const unsubscribe = parent.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        setSearchQuery('');
      }
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  // CP6d-SmokeFix-4 follow-up: routing into SpaceSettings is now ONLY via
  // SpaceSwitcherInline's per-space "edit" pill. The previous direct nav
  // path (home-icon tap → SpaceSettings) was removed.

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshTrigger((n) => n + 1);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const handleOpenDetail = useCallback(
    (supply: SupplyWithTags) => {
      navigation.navigate('SupplyDetail', { supplyId: supply.id });
    },
    [navigation]
  );

  const handleAddNewTap = useCallback(() => {
    setCreateSheetInitialQuery(undefined);
    setSupplyCreateSheetOpen(true);
  }, []);

  const handleSearchAddNew = useCallback((query: string) => {
    setCreateSheetInitialQuery(query);
    setSupplyCreateSheetOpen(true);
  }, []);

  const handleSupplyCreated = useCallback(() => {
    setSupplyCreateSheetOpen(false);
    setCreateSheetInitialQuery(undefined);
    setCreateSheetInitialIngredient(undefined);
    setRefreshTrigger((n) => n + 1);
  }, []);

  const noExactMatch =
    searchQuery.trim().length > 0 &&
    !(suppliesRef.current?.hasExactMatch(searchQuery) ?? false);

  // CP6d-SmokeFix-2 (Task 4): family-match count for the recommendations hint.
  const matchedFamilyCount =
    searchQuery.trim().length >= 2
      ? suppliesRef.current?.getFilteredFamilyCount(searchQuery) ?? 0
      : 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background.secondary,
        },
        headerContainer: {
          backgroundColor: colors.background.card,
          paddingHorizontal: 20,
          paddingTop: 60,
          paddingBottom: 4,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        headerTitle: {
          fontSize: typography.sizes.xxl,
          fontWeight: typography.weights.bold,
          color: colors.text.primary,
        },
        headerRightRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        whatCanICookCta: {
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 8,
          paddingVertical: 6,
          paddingHorizontal: 12,
          marginHorizontal: 16,
          marginTop: 8,
          marginBottom: 4,
          alignItems: 'center',
        },
        whatCanICookCtaText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.primary,
        },
        // 8R-UX3: outer tab strip (Everything / Use soon / Low / out)
        outerTabRow: {
          flexDirection: 'row',
          backgroundColor: colors.background.card,
          paddingHorizontal: 16,
          gap: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
        },
        outerTab: {
          flex: 1,
          paddingVertical: 10,
          alignItems: 'center',
          position: 'relative',
        },
        outerTabLabelRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        },
        outerTabText: {
          fontSize: 14,
          fontWeight: '500',
          color: colors.text.tertiary,
        },
        outerTabTextActive: {
          color: colors.text.primary,
          fontWeight: '700',
        },
        outerTabBadge: {
          minWidth: 22,
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
        },
        outerTabBadgeText: {
          fontSize: 11,
          fontWeight: '600',
        },
        outerTabCountZero: {
          fontSize: 12,
          color: colors.text.tertiary,
          marginLeft: 2,
        },
        outerTabUnderline: {
          position: 'absolute',
          bottom: 0,
          left: 16,
          right: 16,
          height: 3,
          backgroundColor: colors.primary,
          borderRadius: 1.5,
        },
        headerIconButton: {
          padding: 6,
        },
        // 8R-UX1: header chevron — toggles the view-options toolbar.
        headerChevron: {
          fontSize: 14,
          color: colors.text.secondary,
          paddingHorizontal: 2,
        },
        spacePill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.background.secondary,
          maxWidth: 180,
        },
        spacePillChevron: {
          fontSize: 11,
          color: colors.text.tertiary,
          fontWeight: typography.weights.bold,
        },
        spacePillEmoji: {
          fontSize: 14,
        },
        spacePillText: {
          fontSize: typography.sizes.sm,
          color: colors.text.primary,
          fontWeight: typography.weights.medium,
          flexShrink: 1,
        },
        searchBarWrapper: {
          backgroundColor: colors.background.card,
          paddingTop: 8,
          paddingBottom: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
        },
        invitationsContainer: {
          paddingHorizontal: 20,
        },
        // 8R-UX1: sticky toolbar + action bar styles.
        stickyToolbarWrap: {
          backgroundColor: colors.background.card,
          paddingHorizontal: 16,
          paddingBottom: 6,
        },
        toolbar: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          paddingVertical: 6,
        },
        // 8R-UX1: collapsed state — small chevron, right-aligned, low weight.
        toolbarCollapsed: {
          alignItems: 'flex-end',
          paddingVertical: 4,
        },
        toolbarChevron: {
          fontSize: 14,
          color: colors.text.tertiary,
        },
        toolbarSelectButton: {
          paddingVertical: 4,
          paddingRight: 4,
        },
        toolbarSelectText: {
          fontSize: 13,
          fontWeight: typography.weights.semibold,
          color: colors.primary,
        },
        toolbarPills: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          flexShrink: 1,
        },
        pill: {
          flexDirection: 'row',
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border.medium,
          overflow: 'hidden',
        },
        pillButton: {
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        pillButtonOn: {
          backgroundColor: colors.primary,
        },
        pillText: {
          fontSize: 11,
          color: colors.text.secondary,
          fontWeight: typography.weights.medium,
        },
        pillTextOn: {
          color: '#ffffff',
        },
        actionBar: {
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: colors.background.card,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        actionBarTopRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
        actionBarCount: {
          fontSize: 13,
          fontWeight: typography.weights.semibold,
          color: colors.text.primary,
        },
        actionBarCancel: {
          fontSize: 13,
          color: colors.text.secondary,
          fontWeight: typography.weights.medium,
        },
        actionBarButtonsRow: {
          flexDirection: 'row',
          gap: 6,
        },
        actionBarButton: {
          flex: 1,
          paddingVertical: 8,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.primary,
          alignItems: 'center',
        },
        actionBarButtonDisabled: {
          opacity: 0.4,
        },
        actionBarButtonText: {
          fontSize: 12,
          fontWeight: typography.weights.semibold,
          color: '#ffffff',
        },
        loadingContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background.primary,
        },
        loadingText: {
          marginTop: 12,
          fontSize: typography.sizes.sm,
          color: colors.text.secondary,
        },
        // Switcher modal
        switcherModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        },
        switcherModalCard: {
          backgroundColor: colors.background.card,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          paddingBottom: 32,
        },
      }),
    [colors]
  );

  if (spaceLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your spaces...</Text>
      </View>
    );
  }

  if (isSwitching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          Switching to {activeSpace?.name}...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Pantry</Text>
          {/* Right side, single row: [ ▾ {emoji} Name ] [ Pantry icon ].
              The space-name pill IS the dropdown trigger now (down-arrow
              signals the dropdown affordance); tapping either opens the
              space switcher. SpaceSettings is reachable only from the
              "edit" pill inside the switcher modal (per Tom's call). */}
          <View style={styles.headerRightRow}>
            {currentSpace && (
              <TouchableOpacity
                style={styles.spacePill}
                onPress={() => setShowSpaceSwitcherSheet(true)}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={`Current space: ${currentSpace.name}. Tap to switch.`}
              >
                <Text style={styles.spacePillChevron}>▾</Text>
                <Text style={styles.spacePillEmoji}>{currentSpace.emoji}</Text>
                <Text style={styles.spacePillText} numberOfLines={1}>
                  {currentSpace.name}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setShowSpaceSwitcherSheet(true)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Switch space"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <PantryOutline size={24} color={colors.text.secondary} />
            </TouchableOpacity>
            {/* 8R-UX1: view-options chevron. Collapsed by default — tap to
                show the toolbar (Select / Family / Type / Storage /
                Split / Merged). Hidden during selection mode (action bar
                takes over). */}
            {!selectionMode && (
              <TouchableOpacity
                onPress={() => setToolbarExpanded((v) => !v)}
                activeOpacity={0.6}
                style={styles.headerIconButton}
                accessibilityRole="button"
                accessibilityLabel={
                  toolbarExpanded ? 'Hide view options' : 'Show view options'
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.headerChevron}>
                  {toolbarExpanded ? '▴' : '▾'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.invitationsContainer}>
        <PendingSpaceInvitations
          compact
          onInvitationResponded={refreshSpaces}
        />
      </View>

      {/* 8R-UX1: sticky toolbar / action-bar — sits between the search bar
          and the scrollable content so it stays visible regardless of scroll
          position. Renders the bulk-action bar when in selection mode,
          otherwise the Select + group-by + split/merge controls. */}
      {selectionMode ? (
        <View style={styles.stickyToolbarWrap}>
          <View style={styles.actionBar}>
            <View style={styles.actionBarTopRow}>
              <Text style={styles.actionBarCount}>
                {selectedIds.size} selected
              </Text>
              <TouchableOpacity onPress={exitSelectionMode} activeOpacity={0.7}>
                <Text style={styles.actionBarCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionBarButtonsRow}>
              {(
                [
                  { label: 'In stock', on: handleBulkMarkInStock },
                  { label: 'Out', on: handleBulkMarkOut },
                  { label: 'Add to list', on: handleBulkAddToGrocery },
                  { label: 'Find recipes', on: handleBulkFindRecipes },
                ] as const
              ).map((btn) => {
                const disabled = selectedIds.size === 0 || bulkActioning;
                return (
                  <TouchableOpacity
                    key={btn.label}
                    style={[
                      styles.actionBarButton,
                      disabled && styles.actionBarButtonDisabled,
                    ]}
                    onPress={btn.on}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionBarButtonText}>{btn.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      ) : (
        toolbarExpanded && (
          <View style={styles.stickyToolbarWrap}>
            <View style={styles.toolbar}>
              <TouchableOpacity
                onPress={enterSelectionMode}
                activeOpacity={0.7}
                style={styles.toolbarSelectButton}
                accessibilityRole="button"
                accessibilityLabel="Enter multi-select mode"
              >
                <Text style={styles.toolbarSelectText}>Select items</Text>
              </TouchableOpacity>
              <View style={styles.toolbarPills}>
                <View style={styles.pill}>
                  {(['family', 'type', 'storage'] as const).map((mode) => {
                    const isOn = groupBy === mode;
                    const label =
                      mode === 'family'
                        ? 'Family'
                        : mode === 'type'
                        ? 'Type'
                        : 'Storage';
                    return (
                      <TouchableOpacity
                        key={mode}
                        style={[styles.pillButton, isOn && styles.pillButtonOn]}
                        onPress={() => setGroupBy(mode)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.pillText, isOn && styles.pillTextOn]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.pill}>
                  {([false, true] as const).map((value) => {
                    const isOn = mergeOnHandRegulars === value;
                    return (
                      <TouchableOpacity
                        key={String(value)}
                        style={[styles.pillButton, isOn && styles.pillButtonOn]}
                        onPress={() => setMergeOnHandRegulars(value)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.pillText, isOn && styles.pillTextOn]}
                        >
                          {value ? 'Merged' : 'Split'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )
      )}

      {/* 8R-UX3: outer tab strip — Everything / Use soon / Low / out.
          Strava-style underline pattern matching StatsScreen toggleRow. */}
      <View style={styles.outerTabRow}>
        {(
          [
            { key: 'everything', label: 'Everything', count: null, icon: null, badgeBg: null, badgeText: null },
            {
              key: 'use_soon',
              label: 'Use soon',
              count: outerCounts.useSoon,
              icon: <TimerIcon size={14} color="#BA7517" />,
              badgeBg: '#FAEEDA',
              badgeText: '#854F0B',
            },
            {
              key: 'low_out',
              label: 'Low / out',
              count: outerCounts.lowOut,
              icon: <AlertCircleIcon size={14} color="#A32D2D" />,
              badgeBg: '#FCEBEB',
              badgeText: '#791F1F',
            },
          ] as const
        ).map((t) => {
          const isActive = activeOuterTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.outerTab}
              onPress={() => setActiveOuterTab(t.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${t.label}${t.count !== null ? `, ${t.count}` : ''}`}
            >
              <View style={styles.outerTabLabelRow}>
                {t.icon}
                <Text
                  style={[
                    styles.outerTabText,
                    isActive && styles.outerTabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
                {t.count !== null && t.count > 0 && (
                  <View
                    style={[
                      styles.outerTabBadge,
                      { backgroundColor: t.badgeBg ?? colors.background.secondary },
                    ]}
                  >
                    <Text style={[styles.outerTabBadgeText, { color: t.badgeText ?? colors.text.secondary }]}>
                      {t.count}
                    </Text>
                  </View>
                )}
              </View>
              {isActive && <View style={styles.outerTabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        // 8R-UX1 follow-up: 'handled' so taps on background/empty areas
        // dismiss the keyboard (iOS-standard tap-out behavior). Taps on
        // Touchable children — including the shadow-row +Track button —
        // still fire on the first tap because RN routes through the handler
        // before considering keyboard dismissal. Previous 'always' left users
        // stuck in keyboard mode with no way out.
        keyboardShouldPersistTaps="handled"
      >
        {/* 8D-CP4: "What can I cook?" CTA → WhatCanICookScreen (Recipes
            stack — cross-stack nav via the parent tab navigator). */}
        <TouchableOpacity
          style={styles.whatCanICookCta}
          activeOpacity={0.7}
          onPress={() =>
            (navigation.getParent() as any)?.navigate('RecipesStack', {
              screen: 'WhatCanICook',
            })
          }
        >
          <Text style={styles.whatCanICookCtaText}>What can I cook?</Text>
        </TouchableOpacity>

        <SuppliesSection
          ref={suppliesRef}
          spaceId={activeSpaceId}
          refreshTrigger={refreshTrigger}
          searchQuery={searchQuery}
          onOpenDetail={handleOpenDetail}
          onAddNewTap={handleAddNewTap}
          onLongPressSupply={(supply) => {
            // 8R-UX1 continuation: long-press enters multi-select mode AND
            // pre-selects the long-pressed supply. Equivalent to tapping
            // "Select items" in the toolbar then ticking this row.
            setSelectionMode(true);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.add(supply.id);
              return next;
            });
          }}
          userId={currentUserId}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          groupBy={groupBy}
          mergeOnHandRegulars={mergeOnHandRegulars}
          activeOuterTab={activeOuterTab}
          onOuterCountsChange={setOuterCounts}
          heroFrequencyData={heroFrequencyData}
          onShadowTap={(candidate) => {
            // 8R-UX1: pass the candidate as pre-selected so the user lands
            // on the form view directly. CP6d-SmokeFix-4 used to drop them
            // onto the search step with a pre-populated query — that
            // required a redundant re-pick of the same item.
            setCreateSheetInitialIngredient({
              id: candidate.id,
              name: candidate.name,
            });
            setCreateSheetInitialQuery(undefined);
            setSupplyCreateSheetOpen(true);
          }}
        />
      </ScrollView>

      {/* 8R-UX1: search bar moved to the bottom of the screen (iOS Safari-
          style). KeyboardAvoidingView lifts it above the on-screen keyboard
          when focused. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.searchBarWrapper}>
          <PantrySearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            noExactMatch={noExactMatch}
            onAddNew={handleSearchAddNew}
            matchedFamilyCount={matchedFamilyCount}
          />
        </View>
      </KeyboardAvoidingView>

      <CreateSpaceModal
        visible={showCreateSpaceModal}
        onClose={() => setShowCreateSpaceModal(false)}
      />

      {/* CP6d-SmokeFix-4 Task 4: inline-anchored dropdown variant of the
          space switcher. Replaces the prior bottom-sheet host. The dropdown
          renders near the home icon (top-right of header). */}
      <SpaceSwitcherInline
        visible={showSpaceSwitcherSheet}
        onClose={() => setShowSpaceSwitcherSheet(false)}
        onCreateSpace={() => {
          setShowSpaceSwitcherSheet(false);
          setShowCreateSpaceModal(true);
        }}
        onEditSpace={(spaceId) => {
          // CP6d-SmokeFix-4 follow-up: only routing into SpaceSettings.
          navigation.navigate('SpaceSettings', { spaceId });
        }}
      />

      {activeSpaceId && currentUserId && (
        <SupplyCreateSheet
          visible={supplyCreateSheetOpen}
          onClose={() => {
            setSupplyCreateSheetOpen(false);
            setCreateSheetInitialIngredient(undefined);
            setCreateSheetInitialQuery(undefined);
          }}
          onSaved={handleSupplyCreated}
          spaceId={activeSpaceId}
          userId={currentUserId}
          initialQuery={createSheetInitialQuery}
          initialSelectedIngredient={createSheetInitialIngredient}
        />
      )}

      <SupplyQuickEditModal
        visible={quickEditSupply !== null}
        supply={quickEditSupply}
        userId={currentUserId}
        onClose={() => setQuickEditSupply(null)}
        onSupplyChanged={(next) => {
          // Keep the modal showing the latest snapshot; SuppliesSection
          // re-fetches via refreshTrigger when the user closes the modal
          // anyway, but bumping here keeps the section in sync proactively.
          setQuickEditSupply(next);
          setRefreshTrigger((n) => n + 1);
        }}
      />

      {activeSpaceId && currentUserId && (
        <ListPickerModal
          visible={listPickerOpen}
          spaceId={activeSpaceId}
          userId={currentUserId}
          onCancel={() => setListPickerOpen(false)}
          onPick={handleListPicked}
        />
      )}
    </View>
  );
}
