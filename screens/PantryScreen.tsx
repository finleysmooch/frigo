// ============================================
// FRIGO - PANTRY SCREEN (Phase 8R-CP6d-Pantry)
// ============================================
// Header redesign: "My Pantry" title left, subtle home + profile icon group
// right (home-icon shows space label, profile-icon opens space switcher).
// Multi-purpose search bar moves into the screen header level (Gap-P1).
// StaleItemsBanner mounts above SuppliesSection (Gap-NEED-5).
// Location: screens/PantryScreen.tsx
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { PantryStackParamList } from '../App';
import PantryOutline from '../components/icons/PantryOutline';
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
import StaleItemsBanner from '../components/pantry/StaleItemsBanner';
import SupplyQuickEditModal from '../components/pantry/SupplyQuickEditModal';
import SupplyCreateSheet from '../components/SupplyCreateSheet';
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSpaceSwitcherSheet, setShowSpaceSwitcherSheet] = useState(false);
  // CP6d-SmokeFix-1 (P32): long-press quick-edit modal.
  const [quickEditSupply, setQuickEditSupply] = useState<SupplyWithTags | null>(null);

  const suppliesRef = useRef<SuppliesSectionRef>(null);

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
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 4,
          alignItems: 'center',
        },
        whatCanICookCtaText: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.primary,
        },
        headerIconButton: {
          padding: 6,
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
          paddingBottom: 8,
        },
        invitationsContainer: {
          paddingHorizontal: 20,
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
          </View>
        </View>
      </View>

      <View style={styles.searchBarWrapper}>
        <PantrySearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          noExactMatch={noExactMatch}
          onAddNew={handleSearchAddNew}
          matchedFamilyCount={matchedFamilyCount}
        />
      </View>

      <View style={styles.invitationsContainer}>
        <PendingSpaceInvitations
          compact
          onInvitationResponded={refreshSpaces}
        />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
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

        <StaleItemsBanner spaceId={activeSpaceId} refreshTrigger={refreshTrigger} />
        <SuppliesSection
          ref={suppliesRef}
          spaceId={activeSpaceId}
          refreshTrigger={refreshTrigger}
          searchQuery={searchQuery}
          onOpenDetail={handleOpenDetail}
          onAddNewTap={handleAddNewTap}
          onLongPressSupply={(supply) => setQuickEditSupply(supply)}
          userId={currentUserId}
          onShadowTap={(candidate) => {
            // CP6d-SmokeFix-4 Task 2: shadow → real supply via SupplyCreateSheet.
            setCreateSheetInitialQuery(
              candidate.plural_name && candidate.plural_name.length > 0
                ? candidate.name // use singular when typing into search-by-name field
                : candidate.name
            );
            setSupplyCreateSheetOpen(true);
          }}
        />
      </ScrollView>

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
          onClose={() => setSupplyCreateSheetOpen(false)}
          onSaved={handleSupplyCreated}
          spaceId={activeSpaceId}
          userId={currentUserId}
          initialQuery={createSheetInitialQuery}
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
    </View>
  );
}
