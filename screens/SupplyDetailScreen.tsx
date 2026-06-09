// ============================================
// FRIGO - SUPPLY DETAIL SCREEN (Phase 8R-CP6d-SupplyDetail, Tab 8 build)
// ============================================
// Per-supply edit + introspection surface. Direct-manipulation pattern:
// every field writes individually on toggle/select; no central save button.
// Optimistic UI with revert-on-error.
//
// Sections:
//   • Header (back / name / overflow ⋯)
//   • Hero state strip (tap-to-set: in_stock/low/out/unknown — 'critical' retired)
//   • Inline usage-level slider (0–4) driven by usage_level
//   • Dual CTAs: + Add to needs / Restock
//   • Priority toggle (★ is_priority)
//   • Tracking mode radio (restock auto-spawn / track_only auto-archive)
//   • Storage location segmented picker
//   • Stores section (multi-select tag chips, dimension='store')
//   • Brands section (free-text comma-separated TextInput)
//   • For-user (read-only stub for F&F per P8R-D13)
//   • Find recipes CTA (navigates to RecipeList with initialIngredient)
//   • Activity log (created / last touched timestamps)
//   • Archive / Delete destructive actions
//
// Location: screens/SupplyDetailScreen.tsx
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { PantryStackParamList, RecipesStackParamList, RootTabParamList } from '../App';
import {
  archiveSupply,
  deleteSupply,
  getSupplyById,
  getSupplyDisplayName,
  setSupplyBrands,
  setSupplyPriority,
  setSupplyStatus,
  setSupplyUsageLevel,
  setSupplyStorage,
  setSupplyTrackingMode,
  setSupplyTracksLots,
} from '../lib/services/suppliesService';
import { getLotsForSupply } from '../lib/services/lotsService';
import {
  addSupplyTag,
  getOrCreateTag,
  getTagsForSpace,
  removeSupplyTag,
} from '../lib/services/tagsService';
import {
  StorageLocation,
  SupplyLot,
  SupplyStatus,
  SupplyWithTags,
  TrackingMode,
} from '../lib/types/supplies';
import { Tag } from '../lib/types/tags';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { UsageLevel } from '../components/pantry/StatusIcon';
import UsageLevelSlider from '../components/pantry/UsageLevelSlider';
import LotsList from '../components/pantry/LotsList';
import LotEditSheet from '../components/pantry/LotEditSheet';
import AddNeedSheet from '../components/AddNeedSheet';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<PantryStackParamList, 'SupplyDetail'>;

// CP6d-SmokeFix-4 Task 3: 'unknown' added as a 5th tap-to-set option here.
// Long-press on PantryRow + this strip are the only entry points into
// 'unknown'; cycle-tap on the row's status icon does NOT cycle through it.
// Battery rework: 'critical' retired from the level system AND removed here, so
// it's no longer user-selectable anywhere. The value stays in the SupplyStatus
// type + the label/color helpers so any legacy 'critical' row still renders.
const STATUS_SEGMENTS: SupplyStatus[] = ['in_stock', 'low', 'out', 'unknown'];
const STORAGE_OPTIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'counter'];

function statusLabel(s: SupplyStatus): string {
  switch (s) {
    case 'in_stock':
      return 'In stock';
    case 'low':
      return 'Low';
    case 'critical':
      return 'Critical';
    case 'out':
      return 'Out';
    case 'unknown':
      return 'Unknown';
  }
}

function clampUsageLevel(raw: number | null | undefined): UsageLevel {
  if (raw === null || raw === undefined) return 4;
  const n = Math.max(0, Math.min(4, Math.round(raw)));
  return n as UsageLevel;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours <= 0) return 'just now';
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

export default function SupplyDetailScreen({ navigation, route }: Props) {
  const { colors, functionalColors } = useTheme();
  const { supplyId } = route.params;

  // Cross-stack nav for Find recipes CTA → RecipesStack/RecipeList.
  const tabNav = useNavigation<NavigationProp<RootTabParamList>>();

  const [supply, setSupply] = useState<SupplyWithTags | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [storeTagsCatalog, setStoreTagsCatalog] = useState<Tag[]>([]);
  const [newStoreInput, setNewStoreInput] = useState('');
  const [brandsInput, setBrandsInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [addNeedSheetOpen, setAddNeedSheetOpen] = useState(false);
  // CP6e-PantryUI-b: lots state + LotEditSheet open-state. Lots load
  // alongside the supply for tracks_lots=true supplies.
  const [lots, setLots] = useState<SupplyLot[]>([]);
  const [lotEditState, setLotEditState] = useState<{
    visible: boolean;
    lot?: SupplyLot;
  }>({ visible: false });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSupplyById(supplyId);
      setSupply(data);
      if (data) {
        setBrandsInput((data.brands ?? []).join(', '));
        const tags = await getTagsForSpace(data.space_id, 'store');
        setStoreTagsCatalog(tags);
        // CP6e-PantryUI-b: hydrate lots for tracks_lots supplies. Non-lots
        // supplies just get an empty array; the section is hidden anyway.
        if (data.tracks_lots) {
          const initialLots = await getLotsForSupply(supplyId);
          setLots(initialLots);
        } else {
          setLots([]);
        }
      }
    } catch (error) {
      console.error('❌ SupplyDetail load error:', error);
    } finally {
      setLoading(false);
    }
  }, [supplyId]);

  useEffect(() => {
    load();
  }, [load]);

  // CP6e-PantryUI-b: refresh helpers used after lot create/update/archive.
  // Status may auto-flip via Q44/Q45 cascade so we re-fetch the supply too.
  const refreshLots = useCallback(async () => {
    try {
      const fresh = await getLotsForSupply(supplyId);
      setLots(fresh);
    } catch (error) {
      console.error('❌ SupplyDetail refreshLots error:', error);
    }
  }, [supplyId]);

  const refreshSupply = useCallback(async () => {
    try {
      const fresh = await getSupplyById(supplyId);
      if (fresh) setSupply(fresh);
    } catch (error) {
      console.error('❌ SupplyDetail refreshSupply error:', error);
    }
  }, [supplyId]);

  const handleOpenCreateLot = () => {
    setLotEditState({ visible: true, lot: undefined });
  };
  const handleOpenLotEdit = (lot: SupplyLot) => {
    setLotEditState({ visible: true, lot });
  };
  const handleCloseLotEdit = () => {
    setLotEditState({ visible: false, lot: undefined });
  };
  const handleLotSaved = async () => {
    await Promise.all([refreshLots(), refreshSupply()]);
  };
  const handleLotArchived = async () => {
    await Promise.all([refreshLots(), refreshSupply()]);
  };

  // D8R-Q43 / Q60 — tracks_lots toggle handlers.
  const handleEnableLotTracking = async () => {
    if (!supply) return;
    setBusy(true);
    try {
      await setSupplyTracksLots(supplyId, true);
      await Promise.all([refreshSupply(), refreshLots()]);
      // Open LotEditSheet in create mode so the user can seed their first
      // lot immediately (matches the wireframe flow — toggling on without
      // adding a lot leaves the supply empty + visually awkward).
      handleOpenCreateLot();
    } catch (error) {
      console.error('❌ Enable lot tracking error:', error);
      Alert.alert('Error', 'Could not enable lot tracking. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisableLotTracking = async () => {
    // Q60: reachable only when supply.tracks_lots === true AND lots.length === 0.
    if (!supply) return;
    setBusy(true);
    try {
      await setSupplyTracksLots(supplyId, false);
      await refreshSupply();
    } catch (error) {
      console.error('❌ Disable lot tracking error:', error);
      Alert.alert('Error', 'Could not disable lot tracking. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Direct-manipulation handlers — each writes one field with optimistic UI.

  const withOptimisticReload = async <T,>(
    update: (next: SupplyWithTags) => SupplyWithTags,
    op: () => Promise<T>
  ): Promise<T | null> => {
    if (!supply) return null;
    const prior = supply;
    setSupply(update(supply));
    setBusy(true);
    try {
      const result = await op();
      // Re-fetch to pick up server-side derivations (usage_level on transitions, etc.).
      const refreshed = await getSupplyById(supplyId);
      if (refreshed) setSupply(refreshed);
      return result;
    } catch (error) {
      console.error('❌ SupplyDetail field update error:', error);
      setSupply(prior);
      Alert.alert('Error', 'Could not update. Please try again.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleSetStatus = async (newStatus: SupplyStatus) => {
    if (!supply || supply.status === newStatus) return;
    await withOptimisticReload(
      (s) => ({ ...s, status: newStatus }),
      () => setSupplyStatus(supplyId, newStatus)
    );
  };

  const handleRestock = async () => {
    if (!supply || supply.status === 'in_stock') return;
    await withOptimisticReload(
      (s) => ({ ...s, status: 'in_stock', usage_level: 4 }),
      () => setSupplyStatus(supplyId, 'in_stock')
    );
  };

  const handlePriorityToggle = async (next: boolean) => {
    if (!supply || supply.is_priority === next) return;
    await withOptimisticReload(
      (s) => ({ ...s, is_priority: next }),
      () => setSupplyPriority(supplyId, next)
    );
  };

  const handleTrackingModeChange = async (mode: TrackingMode) => {
    if (!supply || supply.tracking_mode === mode) return;
    await withOptimisticReload(
      (s) => ({ ...s, tracking_mode: mode }),
      () => setSupplyTrackingMode(supplyId, mode)
    );
  };

  const handleStorageChange = async (loc: StorageLocation) => {
    if (!supply || supply.storage_location === loc) return;
    await withOptimisticReload(
      (s) => ({ ...s, storage_location: loc }),
      () => setSupplyStorage(supplyId, loc)
    );
  };

  const handleStoreTagToggle = async (tag: Tag) => {
    if (!supply) return;
    const isSelected = supply.tags.some((t) => t.id === tag.id);
    setBusy(true);
    try {
      if (isSelected) {
        await removeSupplyTag(supplyId, tag.id);
      } else {
        await addSupplyTag(supplyId, tag.id);
      }
      const refreshed = await getSupplyById(supplyId);
      if (refreshed) setSupply(refreshed);
    } catch (error) {
      console.error('❌ SupplyDetail store-tag toggle error:', error);
      Alert.alert('Error', 'Could not update store.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddStoreTag = async () => {
    const value = newStoreInput.trim();
    if (!value || !supply || !currentUserId) return;
    setBusy(true);
    try {
      const tag = await getOrCreateTag(
        supply.space_id,
        'store',
        value,
        currentUserId
      );
      // Refresh catalog with new tag.
      setStoreTagsCatalog((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
      );
      // Attach to supply.
      await addSupplyTag(supplyId, tag.id);
      const refreshed = await getSupplyById(supplyId);
      if (refreshed) setSupply(refreshed);
      setNewStoreInput('');
    } catch (error) {
      console.error('❌ SupplyDetail add store error:', error);
      Alert.alert('Error', 'Could not add store.');
    } finally {
      setBusy(false);
    }
  };

  const handleBrandsBlur = async () => {
    if (!supply) return;
    const parsed = brandsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const existing = supply.brands ?? [];
    const sameAsExisting =
      parsed.length === existing.length &&
      parsed.every((p, i) => p === existing[i]);
    if (sameAsExisting) return;
    await withOptimisticReload(
      (s) => ({ ...s, brands: parsed }),
      () => setSupplyBrands(supplyId, parsed)
    );
  };

  const handleFindRecipes = () => {
    if (!supply) return;
    const name = supply.ingredient?.name ?? supply.custom_name ?? '';
    if (!name) return;
    // Cross-stack: jump to RecipesStack → RecipeList with initialIngredient.
    tabNav.navigate('RecipesStack', {
      screen: 'RecipeList',
      params: { initialIngredient: name },
    } as never);
  };

  const handleArchive = async () => {
    setActionMenuOpen(false);
    if (!supply) return;
    Alert.alert(
      'Archive supply?',
      `${getSupplyDisplayName(supply)} will be hidden from your pantry. You can resurrect it later by adding it again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              setBusy(true);
              await archiveSupply(supplyId);
              navigation.goBack();
            } catch (error) {
              console.error('❌ Archive error:', error);
              Alert.alert('Error', 'Could not archive supply.');
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    setActionMenuOpen(false);
    if (!supply) return;
    Alert.alert(
      'Delete supply?',
      `${getSupplyDisplayName(supply)} will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              await deleteSupply(supplyId);
              navigation.goBack();
            } catch (error) {
              console.error('❌ Delete error:', error);
              Alert.alert('Error', 'Could not delete supply.');
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  if (loading || !supply) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const displayName = getSupplyDisplayName(supply);
  const usageLevel = clampUsageLevel(supply.usage_level);
  const ingredientName = supply.ingredient?.name ?? supply.custom_name ?? 'this item';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayName}
        </Text>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setActionMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Supply menu"
        >
          <Text style={styles.menuButtonText}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* CP6e-PantryUI-b: tracks_lots supplies show a Lots section instead
            of the UsageLevelSlider. Non-lots supplies are unchanged from
            CP6d-SmokeFix-4 follow-up. */}
        {supply.tracks_lots ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lots</Text>
            {lots.length === 0 ? (
              <Text style={styles.fieldHint}>
                No active lots. Add one to get started.
              </Text>
            ) : (
              <LotsList lots={lots} onLotTap={handleOpenLotEdit} />
            )}
            <TouchableOpacity
              style={styles.addLotButton}
              onPress={handleOpenCreateLot}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add lot"
            >
              <Text style={styles.addLotButtonText}>+ Add lot</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sliderWrap}>
            <UsageLevelSlider
              level={usageLevel}
              status={supply.status}
              disabled={busy}
              onLevelChange={async (next) => {
                if (next === usageLevel || !supply) return;
                await withOptimisticReload(
                  (s) => ({ ...s, usage_level: next }),
                  () => setSupplyUsageLevel(supplyId, next)
                );
              }}
            />
            {/* "Mark as unknown" — separate explicit affordance since the
                slider is 0–5 only. Reachable here + via long-press modal. */}
            {supply.status !== 'unknown' ? (
              <TouchableOpacity
                style={styles.unknownButton}
                onPress={() => handleSetStatus('unknown')}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Mark as unknown"
              >
                <Text style={styles.unknownButtonText}>Mark as unknown</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.unknownActiveLabel}>Currently marked unknown</Text>
            )}
          </View>
        )}

        {/* Dual CTAs */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.ctaSecondary}
            onPress={() => setAddNeedSheetOpen(true)}
            disabled={busy || !currentUserId}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add this supply to needs"
          >
            <Text style={styles.ctaSecondaryText}>+ Add to needs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctaPrimary, supply.status === 'in_stock' && styles.ctaDisabled]}
            onPress={handleRestock}
            disabled={busy || supply.status === 'in_stock'}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Restock"
          >
            <Text style={styles.ctaPrimaryText}>Restock</Text>
          </TouchableOpacity>
        </View>

        {/* Priority toggle */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldLeft}>
            <Text style={styles.fieldTitle}>★ Priority</Text>
            <Text style={styles.fieldHint}>
              Auto-adds to your Short List the moment this runs low.
            </Text>
          </View>
          <Switch
            value={supply.is_priority}
            onValueChange={handlePriorityToggle}
            disabled={busy}
          />
        </View>

        {/* Tracking mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tracking mode</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleTrackingModeChange('restock')}
              disabled={busy}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioOuter,
                  supply.tracking_mode === 'restock' && styles.radioOuterActive,
                ]}
              >
                {supply.tracking_mode === 'restock' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Restock automatically when out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleTrackingModeChange('track_only')}
              disabled={busy}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioOuter,
                  supply.tracking_mode === 'track_only' && styles.radioOuterActive,
                ]}
              >
                {supply.tracking_mode === 'track_only' && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text style={styles.radioLabel}>Just track in pantry (no auto-restock)</Text>
            </TouchableOpacity>
          </View>
          {supply.ingredient?.name && (
            <Text style={styles.fieldHint}>
              Defaulted from {supply.ingredient.name}'s shelf life.
            </Text>
          )}

          {/* CP6e-PantryUI-b — D8R-Q43 + D8R-Q60. Track quantity / lots
              toggle. Hidden entirely when tracks_lots=true AND lots exist
              (Q60 — destructive disable would need lot archival first). */}
          {!supply.tracks_lots && (
            <View style={styles.subToggleRow}>
              <View style={styles.subToggleLeft}>
                <Text style={styles.subToggleLabel}>
                  Track quantity / individual lots
                </Text>
                <Text style={styles.fieldHint}>
                  Track each pack, bottle, or batch separately with quantities
                  and expiration dates.
                </Text>
              </View>
              <Switch
                value={false}
                onValueChange={handleEnableLotTracking}
                disabled={busy}
                accessibilityLabel="Enable lot tracking"
              />
            </View>
          )}
          {supply.tracks_lots && lots.length === 0 && (
            <View style={styles.subToggleRow}>
              <View style={styles.subToggleLeft}>
                <Text style={styles.subToggleLabel}>
                  Track quantity / individual lots
                </Text>
              </View>
              <Switch
                value
                onValueChange={handleDisableLotTracking}
                disabled={busy}
                accessibilityLabel="Disable lot tracking"
              />
            </View>
          )}
          {supply.tracks_lots && lots.length > 0 && (
            <Text style={styles.fieldHint}>
              Lot tracking is active. To disable, archive all lots first.
            </Text>
          )}
        </View>

        {/* Storage location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage location</Text>
          <View style={styles.segmentedRow}>
            {STORAGE_OPTIONS.map((opt) => {
              const active = supply.storage_location === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.storageSegment,
                    active && styles.storageSegmentActive,
                  ]}
                  onPress={() => handleStorageChange(opt)}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.storageSegmentText,
                      active && styles.storageSegmentTextActive,
                    ]}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.fieldHint}>Affects when staleness reminders fire.</Text>
        </View>

        {/* Shelf life override (P38) — stubbed pending P8R-D29 schema migration. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shelf life override</Text>
          <TouchableOpacity
            style={styles.shelfLifeStubButton}
            onPress={() =>
              Alert.alert(
                'Shelf life override',
                "Per-supply shelf-life adjustment is coming soon. Today the system uses the catalog's default shelf life for the chosen storage.",
                [{ text: 'OK' }]
              )
            }
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Adjust shelf life — coming soon"
          >
            <Text style={styles.shelfLifeStubText}>
              Use catalog default ({supply.ingredient?.name ? `${supply.ingredient.name}'s ${supply.storage_location ?? 'default'} shelf life` : 'no override yet'}) ›
            </Text>
          </TouchableOpacity>
          <Text style={styles.fieldHint}>
            Per-supply override coming in a follow-up; tracked as P8R-D29.
          </Text>
        </View>

        {/* Stores section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shopping at</Text>
          <View style={styles.chipsWrap}>
            {storeTagsCatalog.map((tag) => {
              const selected = supply.tags.some((t) => t.id === tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => handleStoreTagToggle(tag)}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {tag.value}
                    {selected ? '  ✓' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.addStoreRow}>
            <TextInput
              style={styles.addStoreInput}
              value={newStoreInput}
              onChangeText={setNewStoreInput}
              placeholder="+ Add store"
              placeholderTextColor={colors.text.placeholder}
              onSubmitEditing={handleAddStoreTag}
              autoCapitalize="words"
            />
            {newStoreInput.trim().length > 0 && (
              <TouchableOpacity
                style={styles.addStoreButton}
                onPress={handleAddStoreTag}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Text style={styles.addStoreButtonText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Brands */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Brands you like</Text>
          <TextInput
            style={styles.brandsInput}
            value={brandsInput}
            onChangeText={setBrandsInput}
            onBlur={handleBrandsBlur}
            placeholder="Kerrygold, Kirkland, Plugra"
            placeholderTextColor={colors.text.placeholder}
            autoCapitalize="words"
          />
          <Text style={styles.fieldHint}>Comma-separated. Saves on blur.</Text>
        </View>

        {/* For-user stub */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>For</Text>
          <Text style={styles.forUserText}>
            {supply.for_user_ids.length === 0
              ? 'Everyone (default)'
              : `${supply.for_user_ids.length} user${supply.for_user_ids.length === 1 ? '' : 's'}`}
          </Text>
          <Text style={styles.fieldHint}>Per-user supplies coming soon.</Text>
        </View>

        {/* Find recipes CTA */}
        <TouchableOpacity
          style={styles.findRecipesButton}
          onPress={handleFindRecipes}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Find recipes with ${ingredientName}`}
        >
          <Text style={styles.findRecipesText}>🍳 Find recipes with {ingredientName} →</Text>
        </TouchableOpacity>

        {/* Activity log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <View style={styles.activityRow}>
            <Text style={styles.activityKey}>Last touched</Text>
            <Text style={styles.activityValue}>{relativeTime(supply.updated_at)}</Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityKey}>Created</Text>
            <Text style={styles.activityValue}>{relativeTime(supply.created_at)}</Text>
          </View>
          {supply.archived_at && (
            <View style={styles.activityRow}>
              <Text style={styles.activityKey}>Archived</Text>
              <Text style={styles.activityValue}>{relativeTime(supply.archived_at)}</Text>
            </View>
          )}
          <Text style={styles.fieldHint}>
            Note: "Last touched" reflects updated_at — no dedicated last_confirmed_at column on supplies (CP6d-Schema).
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* CP6d-SupplyDetail follow-up: + Add to needs sheet, pre-selecting
          this supply as a T1 hit. */}
      {currentUserId && supply && (
        <AddNeedSheet
          visible={addNeedSheetOpen}
          onClose={() => setAddNeedSheetOpen(false)}
          onSaved={() => {
            setAddNeedSheetOpen(false);
            // Optionally refresh supply state — addNeedFromSupply doesn't
            // mutate the supply row directly, but the spawned need might
            // affect a follow-up readback in this screen if Tom adds one.
          }}
          spaceId={supply.space_id}
          userId={currentUserId}
          view={null}
          initialSelectedSupply={supply}
        />
      )}

      {/* CP6e-PantryUI-b — LotEditSheet (create + edit + mark consumed). */}
      {supply && (
        <LotEditSheet
          visible={lotEditState.visible}
          onClose={handleCloseLotEdit}
          onSaved={handleLotSaved}
          onArchived={handleLotArchived}
          supply={supply}
          lot={lotEditState.lot}
        />
      )}

      {/* Action menu modal — Archive / Delete */}
      <Modal
        visible={actionMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenuOpen(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setActionMenuOpen(false)}
        >
          <Pressable style={styles.menuCard} onPress={() => {}}>
            <Text style={styles.menuTitle}>{displayName}</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleArchive}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemText}>Archive supply</Text>
              <Text style={styles.menuItemHint}>Hide from pantry; can be resurrected.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDestructive]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>
                Delete supply
              </Text>
              <Text style={styles.menuItemHint}>Permanent. Cannot be undone.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuCancel}
              onPress={() => setActionMenuOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function colorForStatus(
  status: SupplyStatus,
  fc: ReturnType<typeof useTheme>['functionalColors']
): string {
  switch (status) {
    case 'in_stock':
      return fc.success;
    case 'low':
      return fc.warning;
    case 'critical':
      return '#ea580c';
    case 'out':
      return fc.error;
    case 'unknown':
      return '#9ca3af'; // grey-400 — neutral
  }
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  _fc: ReturnType<typeof useTheme>['functionalColors']
) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: 50,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      backgroundColor: colors.background.card,
    },
    backButton: { paddingRight: spacing.sm, paddingVertical: 4 },
    backButtonText: {
      fontSize: 28,
      color: colors.primary,
      fontWeight: '300',
    },
    headerTitle: {
      flex: 1,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    menuButton: { paddingHorizontal: 8, paddingVertical: 4 },
    menuButtonText: {
      fontSize: 24,
      color: colors.text.primary,
      fontWeight: typography.weights.bold,
      lineHeight: 24,
    },
    body: { flex: 1 },
    // CP6d-SmokeFix-4 follow-up: unified slider wrapper
    sliderWrap: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      alignItems: 'flex-start',
      gap: 12,
    },
    unknownButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border.medium,
    },
    unknownButtonText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    unknownActiveLabel: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      fontStyle: 'italic',
    },
    // Status strip (legacy — no longer used; kept for layout-consumer compat)
    statusStrip: {
      flexDirection: 'row',
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
      overflow: 'hidden',
    },
    statusSegment: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRightWidth: 1,
      borderRightColor: colors.border.light,
    },
    statusSegmentActive: {
      backgroundColor: colors.primary,
    },
    statusSegmentText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    statusSegmentTextActive: {
      color: '#ffffff',
      fontWeight: typography.weights.semibold,
    },
    // 5-circle visual
    usageVisualWrap: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    usageVisualLabel: {
      marginTop: 8,
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    // CTAs
    ctaRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    ctaPrimary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    ctaPrimaryText: {
      fontSize: typography.sizes.md,
      color: '#ffffff',
      fontWeight: typography.weights.semibold,
    },
    ctaSecondary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.medium,
      alignItems: 'center',
    },
    ctaSecondaryText: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.semibold,
    },
    ctaDisabled: { opacity: 0.5 },
    // Generic field row + sections
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    fieldLeft: { flex: 1, paddingRight: 12 },
    fieldTitle: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
      marginBottom: 2,
    },
    fieldHint: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      marginTop: 4,
    },
    // CP6e-PantryUI-b — tracks_lots toggle + add-lot button styles.
    subToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      gap: spacing.md,
    },
    subToggleLeft: {
      flex: 1,
    },
    subToggleLabel: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    addLotButton: {
      marginTop: spacing.sm,
      paddingVertical: 12,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
      alignItems: 'center',
    },
    addLotButtonText: {
      color: colors.primary,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium,
    },
    section: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    sectionTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    // Radio group
    radioGroup: { gap: 8 },
    radioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      gap: 10,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterActive: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    radioLabel: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
    },
    // Storage segmented
    segmentedRow: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
    },
    storageSegment: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRightWidth: 1,
      borderRightColor: colors.border.light,
    },
    storageSegmentActive: {
      backgroundColor: colors.primary,
    },
    storageSegmentText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
    },
    storageSegmentTextActive: {
      color: '#ffffff',
      fontWeight: typography.weights.semibold,
    },
    // Stores chips
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: { fontSize: 12, color: colors.text.primary },
    chipTextSelected: { color: '#ffffff', fontWeight: typography.weights.semibold },
    addStoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    addStoreInput: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.medium,
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
    },
    addStoreButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
    },
    addStoreButtonText: {
      fontSize: typography.sizes.sm,
      color: '#ffffff',
      fontWeight: typography.weights.semibold,
    },
    // Brands
    brandsInput: {
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.medium,
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
    },
    forUserText: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
    },
    shelfLifeStubButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    shelfLifeStubText: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
    },
    // Find recipes CTA
    findRecipesButton: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      paddingVertical: 14,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: colors.background.card,
      alignItems: 'center',
    },
    findRecipesText: {
      fontSize: typography.sizes.md,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    // Activity
    activityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    activityKey: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
    },
    activityValue: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    // Action menu modal
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    menuCard: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing.md,
      paddingBottom: 28,
    },
    menuTitle: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      fontSize: typography.sizes.md,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
    menuItem: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    menuItemDestructive: {},
    menuItemText: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    menuItemTextDestructive: { color: '#ef4444' },
    menuItemHint: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    menuCancel: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    menuCancelText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
  });
}
