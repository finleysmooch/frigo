// ============================================
// FRIGO - VIEW DETAIL SCREEN (Phase 8R-CP6d-ViewDetail)
// ============================================
// View body: needs filtered by view's filter predicates, rendered in
// Tier / Aisle / Flat mode (Q25). Per-view render mode persists via
// viewsService.setViewRenderMode (Q26).
//
// CP6d-ViewDetail changes vs CP6c:
//   • InlineAddNeedRow at top of body (Gap-G5).
//   • NeedRow tap-zones split (dot=cycle, name=edit, qty=±) (Gap-G6, G7).
//   • +/- inline quantity buttons on need rows (Gap-G7).
//   • Cart-as-section partition replaces global cart footer (Gap-G14).
//   • Progress bar increments on in_cart||acquired (Gap-G14b).
//   • Bulk acquire opens BulkAcquirePromotionModal when withoutSupply > 0 (Gap-LR8).
//   • Merged-row expand-children chevron + child rows (Gap-O8).
//   • Pluralization via lib/utils/pluralize.
//
// Renamed from GroceryListDetailScreen.tsx in 8R-CP6c (Part 5).
// Location: screens/ViewDetailScreen.tsx
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
import { ViewsStackParamList } from '../App';
import {
  deleteView,
  getViewById,
  setViewRenderMode,
  toggleViewHidden,
} from '../lib/services/viewsService';
import {
  cycleNeedStatus,
  cycleNeedStatusWithDetails,
  getNeedDisplayName,
  getNeedsForView,
  mergeNeedsForDisplay,
  setNeedStatus,
  updateNeed,
} from '../lib/services/needsService';
import { useAcquireLotToast } from '../contexts/AcquireLotToastContext';
import { getSuppliesForSpace, setSupplyStatus } from '../lib/services/suppliesService';
import {
  MergedNeedGroup,
  NeedStatus,
  NeedWithDetails,
} from '../lib/types/needs';
import { RenderMode, ViewWithFilters } from '../lib/types/views';
import { SupplyWithTags } from '../lib/types/supplies';
import { useActiveSpaceId } from '../contexts/SpaceContext';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import ViewCreatorModal from '../components/ViewCreatorModal';
import AddNeedSheet from '../components/AddNeedSheet';
import ExpandedRegularsSheet from '../components/ExpandedRegularsSheet';
import EditNeedSheet from '../components/EditNeedSheet';
import InlineAddNeedRow from '../components/InlineAddNeedRow';
import BulkAcquirePromotionModal from '../components/BulkAcquirePromotionModal';
import { pluralize } from '../lib/utils/pluralize';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<ViewsStackParamList, 'ViewDetail'>;

const URGENCY_ORDER = ['today', 'this-week', 'this-month'];

interface RegularsCounts {
  out: number;
  critical: number;
  low: number;
  in_stock: number;
}

export default function ViewDetailScreen({ navigation, route }: Props) {
  const { colors, functionalColors } = useTheme();
  // CP6e-FlowsUI-b1: surfaces the lot-create side-effect after a single-tap
  // acquire on a tracks_lots-linked need. Wired into the handleCycleNeed
  // path below.
  const { showToast: showAcquireLotToast } = useAcquireLotToast();
  const { viewId } = route.params;
  const spaceId = useActiveSpaceId();

  const [view, setView] = useState<ViewWithFilters | null>(null);
  const [needs, setNeeds] = useState<NeedWithDetails[]>([]);
  const [supplies, setSupplies] = useState<SupplyWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [addNeedSheetOpen, setAddNeedSheetOpen] = useState(false);
  const [addNeedSheetInitialQuery, setAddNeedSheetInitialQuery] = useState<
    string | undefined
  >(undefined);
  const [expandedRegularsSheetOpen, setExpandedRegularsSheetOpen] = useState(false);
  const [editNeedSheetOpen, setEditNeedSheetOpen] = useState(false);
  const [editingNeedId, setEditingNeedId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // CP6d-ViewDetail: progress bar tracks in_cart-or-acquired (G14b).
  // acquiredSinceMount is the one-way ratchet for acquired needs (which leave
  // the loaded list once acquired). Currently-in-cart count is derived from
  // the live needs array, so going in_cart→need decrements naturally.
  const initialNeedIdsRef = useRef<Set<string> | null>(null);
  const [acquiredSinceMount, setAcquiredSinceMount] = useState<Set<string>>(new Set());

  // Bulk-acquire idempotency.
  const [bulkAcquireRunning, setBulkAcquireRunning] = useState(false);

  // CP6d-ViewDetail: cart-as-section state.
  const [cartExpanded, setCartExpanded] = useState(false);

  // CP6d-ViewDetail: merged-row expand-children state.
  const [expandedMergedKeys, setExpandedMergedKeys] = useState<Set<string>>(new Set());

  // CP6d-ViewDetail (Gap-LR8): bulk-acquire promotion modal.
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [promotionPending, setPromotionPending] = useState<{
    withoutSupply: NeedWithDetails[];
    withSupply: NeedWithDetails[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  // Determine the right status override for fetching needs.
  // Cart-only views (status=['in_cart']): respect the view's own filter.
  // Otherwise: pull both 'need' and 'in_cart' so the cart section can render.
  const computeStatusOverride = useCallback(
    (v: ViewWithFilters | null): NeedStatus[] | undefined => {
      if (!v) return undefined;
      const sf = v.filters.find((f) => f.dimension === 'status');
      if (sf && sf.values.length === 1 && sf.values[0] === 'in_cart') {
        return undefined; // cart-only view — respect its filter
      }
      return ['need', 'in_cart'];
    },
    []
  );

  const load = useCallback(async () => {
    if (!viewId || !spaceId) return;
    try {
      // Sequential: view first so we can compute the right statusOverride,
      // then needs + supplies in parallel.
      const viewData = await getViewById(viewId);
      const override = computeStatusOverride(viewData);
      const [needsData, suppliesData] = await Promise.all([
        getNeedsForView(viewId, true, override),
        getSuppliesForSpace(spaceId),
      ]);
      setView(viewData);
      setNeeds(needsData);
      setSupplies(suppliesData);
    } catch (error) {
      console.error('❌ ViewDetailScreen load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [viewId, spaceId, computeStatusOverride]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleRenderModeChange = async (mode: RenderMode) => {
    if (!view || view.render_mode === mode) return;
    try {
      const updated = await setViewRenderMode(view.id, mode);
      setView(updated);
    } catch (error) {
      console.error('❌ setViewRenderMode error:', error);
      Alert.alert('Error', 'Could not update render mode.');
    }
  };

  const handleMenuPress = () => {
    if (!view) return;
    const isDefault = view.is_default;

    const options: Array<{ text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }> = [
      { text: 'Cancel', style: 'cancel' },
    ];

    if (isDefault) {
      options.push({
        text: 'Edit view (locked filters)',
        onPress: () => setCreatorOpen(true),
      });
      options.push({
        text: view.is_hidden ? 'Unhide view' : 'Hide view',
        onPress: async () => {
          try {
            await toggleViewHidden(view.id);
            navigation.goBack();
          } catch (error) {
            console.error('❌ toggleViewHidden error:', error);
            Alert.alert('Error', 'Could not update.');
          }
        },
      });
    } else {
      options.push({
        text: 'Edit view',
        onPress: () => setCreatorOpen(true),
      });
      options.push({
        text: 'Delete view',
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
                  navigation.goBack();
                } catch (error) {
                  console.error('❌ deleteView error:', error);
                  Alert.alert('Error', 'Could not delete.');
                }
              },
            },
          ]);
        },
      });
    }

    Alert.alert(view.name, undefined, options);
  };

  const handleCycleNeed = async (needId: string) => {
    let prev: NeedStatus | null = null;
    let nextStatus: NeedStatus | null = null;
    setNeeds((current) =>
      current.map((n) => {
        if (n.id !== needId) return n;
        prev = n.status;
        const next: NeedStatus =
          n.status === 'need'
            ? 'in_cart'
            : n.status === 'in_cart'
            ? 'acquired'
            : n.status;
        nextStatus = next;
        return { ...n, status: next };
      })
    );
    try {
      // CP6e-FlowsUI-b1: use the *withDetails wrapper so we can surface a
      // toast when the transition lands on 'acquired' AND a lot was created
      // (tracks_lots supply, qty/unit present). Non-acquire transitions and
      // non-tracks_lots / no-supply paths return acquireSideEffect=null
      // (or with skippedReason) and we silently skip the toast.
      const { acquireSideEffect } = await cycleNeedStatusWithDetails(needId);

      if (acquireSideEffect?.lotCreated) {
        const supplyId = acquireSideEffect.lotCreated.supply_id;
        const supply = supplies.find((s) => s.id === supplyId);
        if (supply) {
          showAcquireLotToast({
            needId,
            supply,
            lot: acquireSideEffect.lotCreated,
            statusBefore: acquireSideEffect.statusBefore,
          });
        }
      }

      // CP6d-ViewDetail (G14b): progress bar guard flipped — count both
      // in_cart and acquired transitions. acquiredSinceMount is a one-way
      // ratchet for acquired (since acquired needs leave the loaded list);
      // currently-in-cart count is derived from live state in the memo
      // below, so going back from in_cart→need decrements naturally.
      if (
        nextStatus === 'acquired' &&
        initialNeedIdsRef.current?.has(needId)
      ) {
        setAcquiredSinceMount((current) => {
          const updated = new Set(current);
          updated.add(needId);
          return updated;
        });
      }

      load();
    } catch (error) {
      console.error('❌ cycleNeedStatus error:', error);
      if (prev !== null) {
        const reverted = prev;
        setNeeds((current) =>
          current.map((n) => (n.id === needId ? { ...n, status: reverted } : n))
        );
      }
      Alert.alert('Error', 'Could not update status.');
    }
  };

  /**
   * CP6d-ViewDetail follow-up (P8R-D25 group-cycle). Merged-row parent dot
   * cycles ALL children together. Each child's `cycleNeedStatus` is called
   * via Promise.all; on any failure, ALL local optimistic updates revert.
   * Acquired-since-mount tracking applies per-child against the snapshot.
   * True per-child independent cycling deferred to post-F&F.
   */
  const handleCycleMergedGroup = async (needIds: string[]) => {
    if (needIds.length === 0) return;
    if (needIds.length === 1) {
      await handleCycleNeed(needIds[0]);
      return;
    }

    // Capture priors per id; compute next status per id; apply optimistic.
    const priors = new Map<string, NeedStatus>();
    const nexts = new Map<string, NeedStatus>();
    setNeeds((current) =>
      current.map((n) => {
        if (!needIds.includes(n.id)) return n;
        priors.set(n.id, n.status);
        const next: NeedStatus =
          n.status === 'need'
            ? 'in_cart'
            : n.status === 'in_cart'
            ? 'acquired'
            : n.status;
        nexts.set(n.id, next);
        return { ...n, status: next };
      })
    );

    try {
      await Promise.all(needIds.map((id) => cycleNeedStatus(id)));

      // Progress-bar accounting per child: acquired transitions ratchet,
      // in_cart counts derive from live state.
      const newlyAcquired: string[] = [];
      for (const id of needIds) {
        if (nexts.get(id) === 'acquired' && initialNeedIdsRef.current?.has(id)) {
          newlyAcquired.push(id);
        }
      }
      if (newlyAcquired.length > 0) {
        setAcquiredSinceMount((current) => {
          const updated = new Set(current);
          for (const id of newlyAcquired) updated.add(id);
          return updated;
        });
      }

      load();
    } catch (error) {
      console.error('❌ Group-cycle error — reverting all:', error);
      setNeeds((current) =>
        current.map((n) => {
          const prior = priors.get(n.id);
          if (prior === undefined) return n;
          return { ...n, status: prior };
        })
      );
      Alert.alert('Error', 'Could not update status.');
    }
  };

  const handleOpenEdit = (needId: string) => {
    setEditingNeedId(needId);
    setEditNeedSheetOpen(true);
  };

  const handleIncrementQty = async (needId: string) => {
    const target = needs.find((n) => n.id === needId);
    if (!target) return;
    const next = (target.quantity_display ?? 0) + 1;
    setNeeds((current) =>
      current.map((n) => (n.id === needId ? { ...n, quantity_display: next } : n))
    );
    try {
      await updateNeed(needId, { quantityDisplay: next });
    } catch (error) {
      console.error('❌ Increment qty error:', error);
      // Revert.
      setNeeds((current) =>
        current.map((n) =>
          n.id === needId ? { ...n, quantity_display: target.quantity_display } : n
        )
      );
      Alert.alert('Error', 'Could not update quantity.');
    }
  };

  const handleDecrementQty = async (needId: string) => {
    const target = needs.find((n) => n.id === needId);
    if (!target) return;
    const current = target.quantity_display ?? 0;
    if (current <= 1) return; // Disabled at qty 1; user must long-press → Delete.
    const next = current - 1;
    setNeeds((cur) =>
      cur.map((n) => (n.id === needId ? { ...n, quantity_display: next } : n))
    );
    try {
      await updateNeed(needId, { quantityDisplay: next });
    } catch (error) {
      console.error('❌ Decrement qty error:', error);
      setNeeds((cur) =>
        cur.map((n) =>
          n.id === needId ? { ...n, quantity_display: target.quantity_display } : n
        )
      );
      Alert.alert('Error', 'Could not update quantity.');
    }
  };

  const handleAddQty = async (needId: string) => {
    const target = needs.find((n) => n.id === needId);
    if (!target) return;
    setNeeds((cur) =>
      cur.map((n) => (n.id === needId ? { ...n, quantity_display: 1 } : n))
    );
    try {
      await updateNeed(needId, { quantityDisplay: 1 });
    } catch (error) {
      console.error('❌ Add qty error:', error);
      setNeeds((cur) =>
        cur.map((n) =>
          n.id === needId ? { ...n, quantity_display: target.quantity_display } : n
        )
      );
      Alert.alert('Error', 'Could not set quantity.');
    }
  };

  const toggleMergedExpand = (key: string) => {
    setExpandedMergedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // CP6d-ViewDetail (LR8): bulk acquire with promotion prompt. Cart-only view path.
  const handleBulkAcquire = async () => {
    if (bulkAcquireRunning) return;
    const visibleInCart = needs.filter((n) => n.status === 'in_cart');
    if (visibleInCart.length === 0) return;

    const withSupply = visibleInCart.filter((n) => n.supply_id !== null);
    const withoutSupply = visibleInCart.filter((n) => n.supply_id === null);

    if (withoutSupply.length === 0) {
      // Original behavior — confirm + acquire all + restock.
      Alert.alert(
        'Acquire all',
        `Mark ${visibleInCart.length} item${visibleInCart.length === 1 ? '' : 's'} as acquired? This will restock ${withSupply.length} suppl${withSupply.length === 1 ? 'y' : 'ies'}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Acquire',
            onPress: () => doBulkAcquireSupplyLinked(withSupply, []),
          },
        ]
      );
      return;
    }

    // Promotion prompt path: open the modal, defer acquire-all logic to
    // confirm callback (which handles withoutSupply); then acquire the
    // withSupply set inline once the modal returns.
    setPromotionPending({ withoutSupply, withSupply });
    setPromotionModalOpen(true);
  };

  const doBulkAcquireSupplyLinked = async (
    withSupply: NeedWithDetails[],
    promotionFailedIds: string[]
  ) => {
    setBulkAcquireRunning(true);
    setNeeds((prev) =>
      prev.map((n) =>
        withSupply.some((s) => s.id === n.id)
          ? { ...n, status: 'acquired' as NeedStatus }
          : n
      )
    );

    let successCount = 0;
    const failedIds: string[] = [];

    for (const need of withSupply) {
      try {
        await setNeedStatus(need.id, 'acquired');
        if (need.supply_id) {
          await setSupplyStatus(need.supply_id, 'in_stock');
        }
        successCount++;
      } catch (error) {
        console.error('❌ Bulk acquire — error on need', need.id, error);
        failedIds.push(need.id);
      }
    }

    if (failedIds.length > 0) {
      setNeeds((prev) =>
        prev.map((n) =>
          failedIds.includes(n.id) ? { ...n, status: 'in_cart' as NeedStatus } : n
        )
      );
    }

    const totalFailed = failedIds.length + promotionFailedIds.length;
    if (totalFailed > 0) {
      Alert.alert(
        'Partial success',
        `${successCount} acquired (supply-linked). ${totalFailed} failed.`
      );
    } else if (withSupply.length > 0) {
      Alert.alert(
        'Success',
        `${successCount} need${successCount === 1 ? '' : 's'} acquired.`
      );
    }

    setBulkAcquireRunning(false);
    load();
  };

  const handlePromotionConfirmed = (result: {
    promotedNeedIds: Set<string>;
    skippedNeedIds: Set<string>;
    failedNeedIds: Set<string>;
  }) => {
    setPromotionModalOpen(false);
    const pending = promotionPending;
    setPromotionPending(null);
    if (!pending) return;
    // Continue with the supply-linked half.
    doBulkAcquireSupplyLinked(pending.withSupply, Array.from(result.failedNeedIds));
  };

  const handleAddNeed = () => {
    setAddNeedSheetInitialQuery(undefined);
    setAddNeedSheetOpen(true);
  };

  const handleInlineMoreOptions = (query: string) => {
    setAddNeedSheetInitialQuery(query);
    setAddNeedSheetOpen(true);
  };

  const handleOpenRegulars = () => {
    setExpandedRegularsSheetOpen(true);
  };

  const handleSheetSaved = () => {
    setAddNeedSheetInitialQuery(undefined);
    load();
  };

  const handleEditNeedSaved = () => {
    setEditNeedSheetOpen(false);
    setEditingNeedId(null);
    load();
  };

  const handleCreatorSaved = () => {
    load();
  };

  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  // CP6d-ViewDetail: partition needs by status before merging.
  const bodyNeeds = useMemo(
    () => needs.filter((n) => n.status === 'need'),
    [needs]
  );
  const cartNeeds = useMemo(
    () => needs.filter((n) => n.status === 'in_cart'),
    [needs]
  );

  // CP6d-SmokeFix-3 (V22 reorder fix): defensively sort merged groups
  // alphabetically by display name in the body + cart partitions, so a need
  // that flips back from in_cart → need lands in alphabetical position
  // regardless of the underlying needs array's fetch order. Pre-fix,
  // `mergeNeedsForDisplay` returned groups in insertion order, and the
  // status-flip via optimistic `.map` preserved that order — so cycling back
  // could land in the wrong spot. Aisle/Tier mode sorts within their
  // sections in renderBody; this top-level sort is a parallel safety net for
  // the flat path AND ensures within-section sorts inherit a stable base.
  const bodyMerged: MergedNeedGroup[] = useMemo(
    () => sortMergedAlphabetically(mergeNeedsForDisplay(bodyNeeds)),
    [bodyNeeds]
  );
  const cartMerged: MergedNeedGroup[] = useMemo(
    () => sortMergedAlphabetically(mergeNeedsForDisplay(cartNeeds)),
    [cartNeeds]
  );

  const regularsCounts: RegularsCounts = useMemo(() => {
    const matching = view ? supplies.filter((s) => supplyMatchesView(s, view)) : [];
    return matching.reduce<RegularsCounts>(
      (acc, s) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      },
      { out: 0, critical: 0, low: 0, in_stock: 0 }
    );
  }, [supplies, view]);

  const isCartOnlyView = useMemo(() => {
    if (!view) return false;
    const statusFilter = view.filters.find((f) => f.dimension === 'status');
    return statusFilter?.values.length === 1 && statusFilter.values[0] === 'in_cart';
  }, [view]);

  // CP6d-ViewDetail: snapshot the need IDs visible at first load → progress denominator.
  useEffect(() => {
    if (initialNeedIdsRef.current === null && !loading && needs.length > 0) {
      initialNeedIdsRef.current = new Set(needs.map((n) => n.id));
    }
  }, [needs, loading]);

  // Progress bar metric (G14b): in_cart + acquired against the mount-time set.
  const progressTotal = initialNeedIdsRef.current?.size ?? 0;
  const inCartFromSnapshotCount = useMemo(() => {
    if (!initialNeedIdsRef.current) return 0;
    return needs.filter(
      (n) => initialNeedIdsRef.current!.has(n.id) && n.status === 'in_cart'
    ).length;
  }, [needs]);
  const progressDone = acquiredSinceMount.size + inCartFromSnapshotCount;
  const progressPercent =
    progressTotal > 0
      ? Math.min(100, Math.round((progressDone / progressTotal) * 100))
      : 0;
  const showProgressBar = progressTotal > 0 && !isCartOnlyView;

  // Bulk-acquire counts for cart-only view footer.
  const visibleInCartCount = cartNeeds.length;
  const supplyLinkedInCartCount = cartNeeds.filter((n) => n.supply_id !== null).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!view) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>List not found.</Text>
      </View>
    );
  }

  const explicitFilters = view.filters.filter((f) => f.dimension !== 'status');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {view.emoji ?? '📋'} {view.name}
        </Text>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={handleMenuPress}
          accessibilityRole="button"
          accessibilityLabel="View menu"
        >
          <Text style={styles.menuButtonText}>⋯</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subHeader}>
        <View style={styles.segmentedRow}>
          {(['tier', 'aisle', 'flat'] as RenderMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.segmented,
                view.render_mode === m && styles.segmentedSelected,
              ]}
              onPress={() => handleRenderModeChange(m)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentedText,
                  view.render_mode === m && styles.segmentedTextSelected,
                ]}
              >
                {m === 'tier' ? 'Tier' : m === 'aisle' ? 'Aisle' : 'Flat'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {showProgressBar && (
        <View style={styles.progressBarContainer}>
          <Text style={styles.progressBarLabel}>
            {progressDone}/{progressTotal} ({progressPercent}%)
          </Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}

      {explicitFilters.length > 0 && (
        <View style={styles.filterChipsRow}>
          {explicitFilters.map((f) => (
            <View key={f.id} style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                {f.dimension}: {f.values.join(', ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.regularsStrip}>
        <Text style={styles.regularsText} numberOfLines={1}>
          Regulars · {regularsCounts.out} out · {regularsCounts.low + regularsCounts.critical} low · {regularsCounts.in_stock} in stock
        </Text>
        <TouchableOpacity onPress={handleOpenRegulars} activeOpacity={0.7}>
          <Text style={styles.regularsOpen}>Open ▸</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* CP6d-ViewDetail: inline type-and-add row above body. Hidden on
            cart-only views since adding a need to "in_cart" makes no sense. */}
        {spaceId && currentUserId && !isCartOnlyView && (
          <InlineAddNeedRow
            spaceId={spaceId}
            userId={currentUserId}
            view={view}
            onCreated={load}
            onMoreOptions={handleInlineMoreOptions}
          />
        )}

        {/* Body — needs with status='need'. Empty body is fine on cart-only views. */}
        {bodyMerged.length === 0 && !isCartOnlyView ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {needs.length === 0
                ? 'No needs match this list yet.'
                : 'Nothing to grab — everything is in the cart.'}
            </Text>
          </View>
        ) : bodyMerged.length > 0 ? (
          renderBody({
            mode: view.render_mode,
            merged: bodyMerged,
            view,
            styles,
            colors,
            functionalColors,
            expandedMergedKeys,
            onCycle: handleCycleNeed,
            onCycleGroup: handleCycleMergedGroup,
            onOpenEdit: handleOpenEdit,
            onIncrementQty: handleIncrementQty,
            onDecrementQty: handleDecrementQty,
            onAddQty: handleAddQty,
            onToggleExpand: toggleMergedExpand,
          })
        ) : null}

        {/* Cart-as-section. Renders below body. Default-collapsed when populated. */}
        {cartMerged.length > 0 && (
          <View style={styles.cartSection}>
            <TouchableOpacity
              style={styles.cartSectionHeader}
              onPress={() => setCartExpanded((prev) => !prev)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                cartExpanded
                  ? 'Collapse cart section'
                  : `Expand cart section, ${cartNeeds.length} items`
              }
            >
              <Text style={styles.cartSectionHeaderText}>
                🛒 In cart ({cartNeeds.length}) {cartExpanded ? '▾' : '▸'}
              </Text>
            </TouchableOpacity>
            {cartExpanded && (
              <View>
                {cartMerged.map((m) => (
                  <NeedRow
                    key={m.key}
                    merged={m}
                    view={view}
                    styles={styles}
                    colors={colors}
                    functionalColors={functionalColors}
                    expanded={expandedMergedKeys.has(m.key)}
                    onCycle={handleCycleNeed}
                    onCycleGroup={handleCycleMergedGroup}
                    onOpenEdit={handleOpenEdit}
                    onIncrementQty={handleIncrementQty}
                    onDecrementQty={handleDecrementQty}
                    onAddQty={handleAddQty}
                    onToggleExpand={toggleMergedExpand}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        {isCartOnlyView ? (
          <TouchableOpacity
            style={[
              styles.bulkAcquireButton,
              (visibleInCartCount === 0 || bulkAcquireRunning) &&
                styles.bulkAcquireButtonDisabled,
            ]}
            onPress={handleBulkAcquire}
            disabled={visibleInCartCount === 0 || bulkAcquireRunning}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Acquire all ${visibleInCartCount} items`}
          >
            <Text style={styles.bulkAcquireButtonText}>
              {bulkAcquireRunning
                ? 'Acquiring…'
                : `Acquire all (${visibleInCartCount}) → restocks ${supplyLinkedInCartCount}`}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.addNeedButton}
            onPress={handleAddNeed}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add need"
          >
            <Text style={styles.addNeedButtonText}>+ Add need</Text>
          </TouchableOpacity>
        )}
      </View>

      {spaceId && currentUserId && (
        <>
          <ViewCreatorModal
            visible={creatorOpen}
            onClose={() => setCreatorOpen(false)}
            onSaved={handleCreatorSaved}
            spaceId={spaceId}
            userId={currentUserId}
            existingView={view}
          />
          <AddNeedSheet
            visible={addNeedSheetOpen}
            onClose={() => {
              setAddNeedSheetOpen(false);
              setAddNeedSheetInitialQuery(undefined);
            }}
            onSaved={handleSheetSaved}
            spaceId={spaceId}
            userId={currentUserId}
            view={view}
            initialQuery={addNeedSheetInitialQuery}
          />
          <ExpandedRegularsSheet
            visible={expandedRegularsSheetOpen}
            onClose={() => setExpandedRegularsSheetOpen(false)}
            onSaved={handleSheetSaved}
            spaceId={spaceId}
            userId={currentUserId}
            view={view}
          />
          <EditNeedSheet
            visible={editNeedSheetOpen}
            onClose={() => {
              setEditNeedSheetOpen(false);
              setEditingNeedId(null);
            }}
            onSaved={handleEditNeedSaved}
            spaceId={spaceId}
            userId={currentUserId}
            needId={editingNeedId}
          />
          <BulkAcquirePromotionModal
            visible={promotionModalOpen}
            needsWithoutSupply={promotionPending?.withoutSupply ?? []}
            spaceId={spaceId}
            userId={currentUserId}
            onCancel={() => {
              setPromotionModalOpen(false);
              setPromotionPending(null);
            }}
            onConfirmed={handlePromotionConfirmed}
          />
        </>
      )}
    </View>
  );
}

// ============================================
// HELPERS
// ============================================

function supplyMatchesView(supply: SupplyWithTags, view: ViewWithFilters): boolean {
  // CP6d-SmokeFix-4 Task 5 (V19 Regulars strip fix): urgency is a need-level
  // concept (Tonight = "need this today"); supplies don't carry urgency tags
  // by default. Pre-fix, the Regulars strip on Tonight/This Week showed
  // 0/0/0/0 because no supply had an urgency=today tag. Now: urgency is
  // skipped entirely from the supply-matching predicate. Other dimensions
  // (store, storage, recipe) still apply — they're meaningful at the supply
  // level. Status filter is also skipped (need-level field).
  const tagFilters = view.filters.filter(
    (f) => f.dimension !== 'status' && f.dimension !== 'urgency'
  );
  if (tagFilters.length === 0) return true;
  for (const f of tagFilters) {
    const allowed = expandUrgencyValues(f.dimension, f.values);
    const matches = supply.tags.some(
      (t) => t.dimension === f.dimension && allowed.includes(t.value)
    );
    if (!matches) return false;
  }
  return true;
}

function expandUrgencyValues(dimension: string, values: string[]): string[] {
  if (dimension !== 'urgency') return values;
  const expanded = new Set<string>(values);
  if (values.includes('this-week')) expanded.add('today');
  if (values.includes('this-month')) {
    expanded.add('today');
    expanded.add('this-week');
  }
  return Array.from(expanded);
}

interface RenderBodyArgs {
  mode: RenderMode;
  merged: MergedNeedGroup[];
  view: ViewWithFilters;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
  functionalColors: ReturnType<typeof useTheme>['functionalColors'];
  expandedMergedKeys: Set<string>;
  onCycle: (needId: string) => void;
  onCycleGroup: (needIds: string[]) => void;
  onOpenEdit: (needId: string) => void;
  onIncrementQty: (needId: string) => void;
  onDecrementQty: (needId: string) => void;
  onAddQty: (needId: string) => void;
  onToggleExpand: (key: string) => void;
}

function renderBody({
  mode,
  merged,
  view,
  styles,
  colors,
  functionalColors,
  expandedMergedKeys,
  onCycle,
  onCycleGroup,
  onOpenEdit,
  onIncrementQty,
  onDecrementQty,
  onAddQty,
  onToggleExpand,
}: RenderBodyArgs) {
  const renderRow = (m: MergedNeedGroup) => (
    <NeedRow
      key={m.key}
      merged={m}
      view={view}
      styles={styles}
      colors={colors}
      functionalColors={functionalColors}
      expanded={expandedMergedKeys.has(m.key)}
      onCycle={onCycle}
      onCycleGroup={onCycleGroup}
      onOpenEdit={onOpenEdit}
      onIncrementQty={onIncrementQty}
      onDecrementQty={onDecrementQty}
      onAddQty={onAddQty}
      onToggleExpand={onToggleExpand}
    />
  );

  if (mode === 'flat') {
    const sorted = [...merged].sort((a, b) =>
      mergedDisplayName(a).toLowerCase().localeCompare(mergedDisplayName(b).toLowerCase())
    );
    return <View>{sorted.map(renderRow)}</View>;
  }

  if (mode === 'aisle') {
    const sectionsMap = new Map<string, MergedNeedGroup[]>();
    for (const m of merged) {
      const head = m.needs[0];
      const section = head?.ingredient?.typical_store_section?.trim() || 'Other';
      const titleCased = titleCase(section);
      if (!sectionsMap.has(titleCased)) sectionsMap.set(titleCased, []);
      sectionsMap.get(titleCased)!.push(m);
    }
    const sectionNames = Array.from(sectionsMap.keys()).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
    return (
      <View>
        {sectionNames.map((section) => {
          const items = sectionsMap.get(section) ?? [];
          items.sort((a, b) =>
            mergedDisplayName(a).toLowerCase().localeCompare(mergedDisplayName(b).toLowerCase())
          );
          return (
            <View key={section}>
              <Text style={styles.sectionHeader}>{section}</Text>
              {items.map(renderRow)}
            </View>
          );
        })}
      </View>
    );
  }

  // Tier mode: group by urgency tag value.
  const urgencySectionMap = new Map<string, MergedNeedGroup[]>();
  const noUrgency: MergedNeedGroup[] = [];
  for (const m of merged) {
    const head = m.needs[0];
    const urgencyTag = head?.tags.find((t) => t.dimension === 'urgency');
    if (urgencyTag) {
      const key = urgencyTag.value;
      if (!urgencySectionMap.has(key)) urgencySectionMap.set(key, []);
      urgencySectionMap.get(key)!.push(m);
    } else {
      noUrgency.push(m);
    }
  }

  const urgencyKeys = [
    ...URGENCY_ORDER,
    ...Array.from(urgencySectionMap.keys()).filter((k) => !URGENCY_ORDER.includes(k)),
  ];

  return (
    <View>
      {urgencyKeys.map((key) => {
        const items = urgencySectionMap.get(key);
        if (!items || items.length === 0) return null;
        items.sort((a, b) =>
          mergedDisplayName(a).toLowerCase().localeCompare(mergedDisplayName(b).toLowerCase())
        );
        return (
          <View key={key}>
            <Text style={styles.sectionHeader}>{titleCase(key)}</Text>
            {items.map(renderRow)}
          </View>
        );
      })}
      {noUrgency.length > 0 && (
        <View>
          <Text style={styles.sectionHeader}>No urgency</Text>
          {noUrgency
            .sort((a, b) =>
              mergedDisplayName(a).toLowerCase().localeCompare(mergedDisplayName(b).toLowerCase())
            )
            .map(renderRow)}
        </View>
      )}
    </View>
  );
}

// CP6d-SmokeFix-3: alphabetical sort by display name. Used by body + cart
// partition memos to enforce stable order regardless of fetch insertion.
function sortMergedAlphabetically(groups: MergedNeedGroup[]): MergedNeedGroup[] {
  return [...groups].sort((a, b) =>
    mergedDisplayName(a).toLowerCase().localeCompare(mergedDisplayName(b).toLowerCase())
  );
}

function mergedDisplayName(m: MergedNeedGroup): string {
  const head = m.needs[0];
  if (!head) return m.customName ?? '';
  // Use pluralization based on quantity_display (single-need groups) or
  // totalQuantity (merged groups). Fall back to qty=1 (singular) when null.
  const qty =
    m.needs.length === 1
      ? head.quantity_display ?? 1
      : m.totalQuantity ?? 1;
  const singular = head.ingredient?.name ?? head.custom_name ?? '';
  return pluralize(singular, head.ingredient?.plural_name ?? null, qty);
}

function titleCase(s: string): string {
  if (!s) return s;
  return s
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================
// NEED ROW — split tap-zones, +/- quantity, expand-children
// ============================================

interface NeedRowProps {
  merged: MergedNeedGroup;
  view: ViewWithFilters;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
  functionalColors: ReturnType<typeof useTheme>['functionalColors'];
  expanded: boolean;
  onCycle: (needId: string) => void;
  onCycleGroup: (needIds: string[]) => void;
  onOpenEdit: (needId: string) => void;
  onIncrementQty: (needId: string) => void;
  onDecrementQty: (needId: string) => void;
  onAddQty: (needId: string) => void;
  onToggleExpand: (key: string) => void;
}

function NeedRow({
  merged,
  view,
  styles,
  functionalColors,
  expanded,
  onCycle,
  onCycleGroup,
  onOpenEdit,
  onIncrementQty,
  onDecrementQty,
  onAddQty,
  onToggleExpand,
}: NeedRowProps) {
  const head = merged.needs[0];
  if (!head) return null;
  const status = head.status;
  const displayName = mergedDisplayName(merged);
  const isMergedGroup = merged.needs.length > 1;

  // Quantity display — for single-need rows show head qty; for merged rows
  // show totalQuantity (which mergeNeedsForDisplay sums up, when present).
  const qty = isMergedGroup
    ? merged.totalQuantity
    : head.quantity_display;
  const unit = merged.unitDisplay;

  const impliedDimensions = new Set(view.filters.map((f) => f.dimension));
  const tags = head.tags.filter((t) => !impliedDimensions.has(t.dimension));
  const visibleTags = tags.slice(0, 2);
  const overflowCount = tags.length - visibleTags.length;

  return (
    <View>
      <View style={styles.needRow}>
        {/* Status dot tap-zone — cycle. Merged groups cycle ALL children
            together (P8R-D25 group-cycle); single-need rows cycle just
            that need. */}
        <TouchableOpacity
          style={styles.statusDotTouchable}
          onPress={() =>
            isMergedGroup
              ? onCycleGroup(merged.needs.map((n) => n.id))
              : onCycle(head.id)
          }
          onLongPress={() => onOpenEdit(head.id)}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel={`Cycle ${displayName} status, currently ${status}${
            isMergedGroup ? ` (group of ${merged.needs.length})` : ''
          }`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        >
          <View style={[styles.statusDot, dotStyleForStatus(status, functionalColors)]}>
            {status === 'in_cart' && <Text style={styles.statusDotMark}>✓</Text>}
            {status === 'acquired' && <Text style={styles.statusDotMarkDimmed}>✓</Text>}
          </View>
        </TouchableOpacity>

        {/* Name + tag area — tap opens EditNeedSheet */}
        <TouchableOpacity
          style={styles.needRowBody}
          onPress={() => onOpenEdit(head.id)}
          onLongPress={() => onOpenEdit(head.id)}
          delayLongPress={400}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${displayName}`}
        >
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.needName,
                status === 'acquired' && styles.needNameAcquired,
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {isMergedGroup && (
              <TouchableOpacity
                style={styles.expandChevronTouchable}
                onPress={() => onToggleExpand(merged.key)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={
                  expanded ? 'Collapse children' : 'Show recipe breakdown'
                }
              >
                <Text style={styles.expandChevron}>{expanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.needRowMeta}>
            {merged.allRecipes.length > 0 && (
              <Text style={styles.needRecipes}>
                From {merged.allRecipes.length}{' '}
                {merged.allRecipes.length === 1 ? 'recipe' : 'recipes'}
              </Text>
            )}
          </View>
          {visibleTags.length > 0 && (
            <View style={styles.tagChipsRow}>
              {visibleTags.map((t) => (
                <View key={t.id} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{t.value}</Text>
                </View>
              ))}
              {overflowCount > 0 && (
                <View style={styles.tagChip}>
                  <Text style={styles.tagChipText}>+{overflowCount}</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Quantity tap-zone — +/- buttons or "+ Add qty" */}
        <View style={styles.qtyZone}>
          {isMergedGroup ? (
            // Per prompt: hide +/- on merged rows (incrementing one specific
            // source need without clear UX).
            qty !== null && unit ? (
              <Text style={styles.qtyText}>
                {qty} {unit}
              </Text>
            ) : qty !== null ? (
              <Text style={styles.qtyText}>{qty}</Text>
            ) : null
          ) : qty === null || qty === undefined ? (
            <TouchableOpacity
              style={styles.addQtyButton}
              onPress={() => onAddQty(head.id)}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Add quantity"
            >
              <Text style={styles.addQtyText}>+ qty</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyControls}>
              <TouchableOpacity
                style={[
                  styles.qtyButton,
                  qty <= 1 && styles.qtyButtonDisabled,
                ]}
                onPress={() => onDecrementQty(head.id)}
                disabled={qty <= 1}
                activeOpacity={0.6}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
              >
                <Text style={styles.qtyButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>
                {qty}
                {unit ? ` ${unit}` : ''}
              </Text>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => onIncrementQty(head.id)}
                activeOpacity={0.6}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Text style={styles.qtyButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Expanded children — read-only summary per recipe attribution. */}
      {isMergedGroup && expanded && (
        <View style={styles.childrenContainer}>
          {merged.needs.map((child) => {
            const childRecipes = child.recipes ?? [];
            const childQty = child.quantity_display;
            const childUnit = child.unit_display;
            const childLabel =
              childRecipes.length > 0
                ? childRecipes.map((r) => r.recipe_title ?? 'recipe').join(' + ')
                : 'manual';
            return (
              <View key={child.id} style={styles.childRow}>
                <View
                  style={[
                    styles.childStatusDot,
                    dotStyleForStatus(child.status, functionalColors),
                  ]}
                />
                <Text style={styles.childText} numberOfLines={1}>
                  {childQty !== null && childQty !== undefined
                    ? `${childQty}${childUnit ? ` ${childUnit}` : ''} · ${childLabel}`
                    : childLabel}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function dotStyleForStatus(
  status: NeedStatus,
  fc: ReturnType<typeof useTheme>['functionalColors']
) {
  if (status === 'need') {
    return {
      backgroundColor: 'transparent',
      borderColor: fc.warning,
    };
  }
  if (status === 'in_cart') {
    return {
      backgroundColor: fc.warning,
      borderColor: fc.warning,
    };
  }
  return {
    backgroundColor: fc.success,
    borderColor: fc.success,
    opacity: 0.5,
  };
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
    errorText: { fontSize: 14, color: colors.text.secondary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: 50,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    backButton: { paddingRight: spacing.sm, paddingVertical: 4 },
    backButtonText: { fontSize: 28, color: colors.primary, fontWeight: '300' },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    menuButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    menuButtonText: {
      fontSize: 24,
      color: colors.text.primary,
      fontWeight: typography.weights.bold,
      lineHeight: 24,
    },
    subHeader: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    segmentedRow: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
    },
    segmented: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
    },
    segmentedSelected: {
      backgroundColor: colors.primary,
    },
    segmentedText: { fontSize: 13, color: colors.text.secondary },
    segmentedTextSelected: {
      color: '#ffffff',
      fontWeight: typography.weights.semibold,
    },
    filterChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    filterChipText: { fontSize: 12, color: colors.text.secondary },
    regularsStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    regularsText: {
      flex: 1,
      fontSize: 12,
      color: colors.text.secondary,
    },
    regularsOpen: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: typography.weights.medium,
      paddingHorizontal: 8,
    },
    body: { flex: 1 },
    empty: {
      paddingVertical: 60,
      alignItems: 'center',
    },
    emptyText: { fontSize: 14, color: colors.text.tertiary },
    sectionHeader: {
      fontSize: 12,
      fontWeight: typography.weights.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.8,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      backgroundColor: colors.background.secondary,
    },
    needRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    statusDotTouchable: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    statusDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusDotMark: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: typography.weights.bold,
    },
    statusDotMarkDimmed: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: typography.weights.bold,
      opacity: 0.5,
    },
    needRowBody: {
      flex: 1,
      paddingVertical: 4,
      paddingRight: 8,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    needName: {
      fontSize: 15,
      color: colors.text.primary,
      flexShrink: 1,
    },
    needNameAcquired: {
      color: colors.text.tertiary,
      textDecorationLine: 'line-through',
    },
    expandChevronTouchable: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    expandChevron: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    needRowMeta: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 2,
    },
    needRecipes: { fontSize: 12, color: colors.text.tertiary },
    tagChipsRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
    tagChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.secondary,
    },
    tagChipText: { fontSize: 11, color: colors.text.tertiary },
    qtyZone: {
      minWidth: 90,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    qtyText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    qtyControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    qtyButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.card,
    },
    qtyButtonDisabled: {
      opacity: 0.4,
    },
    qtyButtonText: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: typography.weights.semibold,
      lineHeight: 18,
    },
    qtyValue: {
      minWidth: 28,
      textAlign: 'center',
      fontSize: 13,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    addQtyButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    addQtyText: {
      fontSize: 11,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    childrenContainer: {
      paddingLeft: 56,
      paddingRight: spacing.md,
      paddingBottom: 8,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    childRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      gap: 8,
    },
    childStatusDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1.5,
    },
    childText: {
      fontSize: 12,
      color: colors.text.secondary,
      flex: 1,
    },
    bottomBar: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.background.card,
    },
    addNeedButton: {
      paddingVertical: 12,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    addNeedButtonText: {
      fontSize: 15,
      fontWeight: typography.weights.semibold,
      color: '#ffffff',
    },
    bulkAcquireButton: {
      paddingVertical: 12,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    bulkAcquireButtonDisabled: { opacity: 0.5 },
    bulkAcquireButtonText: {
      fontSize: 15,
      fontWeight: typography.weights.semibold,
      color: '#ffffff',
    },
    progressBarContainer: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    progressBarLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      marginBottom: 4,
      fontWeight: typography.weights.medium,
    },
    progressBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.background.secondary,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    cartSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.background.secondary,
    },
    cartSectionHeader: {
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    cartSectionHeaderText: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: typography.weights.semibold,
    },
  });
}
