// ============================================
// FRIGO - SUPPLIES SECTION (Phase 8R-CP6d-SmokeFix-1)
// ============================================
// Top-section order Attention → On Hand → Regulars (P18). Single
// expanded-content surface across all sections (P18 — opening one closes
// the others). Lifted inline-expand state for SupplyRow accordion.
// Dual-listing fix (P19/P20): Attention items ALSO render in their
// tracking-mode-appropriate sub-category, fully interactive in both places.
// Long-press bubbles to parent for SupplyQuickEditModal (P32).
// Location: components/pantry/SuppliesSection.tsx
// ============================================

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  getSuppliesForSpace,
  searchCatalogIngredients,
  searchSuppliesServerSide,
  ShadowSupplyCandidate,
} from '../../lib/services/suppliesService';
import {
  SupplySearchMatch,
  SupplyStatus,
  SupplyWithTags,
} from '../../lib/types/supplies';
import { computeSupplySearchMatch } from '../../lib/utils/lotSearch';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import SupplyRow, { UrgencyContext } from './SupplyRow';
import SwipeableRow from './SwipeableRow';
import LightningBoltIcon from '../icons/LightningBoltIcon';
import { useSpawnOnOutToast } from '../../contexts/SpawnOnOutToastContext';
import { useCookDepletionBanner } from '../../contexts/CookDepletionBannerContext';
import { useTrackOnlyOutToast } from '../../contexts/TrackOnlyOutToastContext';
import { RegularBookmarkIcon } from './BookmarkIcons';
import TimerIcon from '../icons/recipe/TimerIcon';
import FridgeIcon from '../icons/pantry/FridgeIcon';
import ColdIcon from '../icons/pantry/ColdIcon';
import { markSupplyUsed, setSupplyStatus } from '../../lib/services/suppliesService';
import { createNeed } from '../../lib/services/needsService';
import { isHeroIngredient } from '../../lib/services/heroIngredientService';
import { supabase } from '../../lib/supabase';

const STATUS_SORT_PRIORITY: Record<SupplyStatus, number> = {
  out: 0,
  critical: 1,
  low: 2,
  in_stock: 3,
};

// Single source of truth for "which expanded body is visible." Tapping any
// top/sub header sets this; opening one section closes the others.
// 8R-UX6 Item 6: 'use_soon' + 'attention' variants removed — those
// standalone sections were deleted in 8R-UX3 in favor of the outer tab
// strip. Only the 'sub' variant (type-subgroup expand/collapse inside
// Everything tab) remains in use.
type ExpandedSection =
  | { kind: 'sub'; top: 'restock' | 'track_only'; key: string }
  | null;

// 8R-UX5: inner-filter axis. Heroes pill and family pills are mutually
// exclusive — at most one active at a time. 'all' = no inner filter; the
// outer-tab universe is unfiltered.
type ActiveInnerFilter =
  | { kind: 'all' }
  | { kind: 'family'; familyKey: string }
  | { kind: 'hero' };

export interface SuppliesSectionRef {
  hasExactMatch: (q: string) => boolean;
  /**
   * CP6d-SmokeFix-2: count of distinct ingredient.family values that contain
   * at least one supply matching the query. Drives the "Found in N
   * categories" recommendations hint in PantrySearchBar.
   */
  getFilteredFamilyCount: (q: string) => number;
  // 8R-UX1: bulk action methods called from the parent's sticky toolbar.
  // PantryScreen owns the selection/group UI state; SuppliesSection owns
  // the supplies data, so the bulk handlers live here and are reached via
  // this ref.
  bulkMarkInStock: (supplyIds: string[]) => Promise<void>;
  bulkMarkOut: (supplyIds: string[]) => Promise<void>;
  bulkAddToGrocery: (supplyIds: string[], tagIds?: string[]) => Promise<void>;
  /** 8R-UX1: returns display names (plural where available) for the given
   *  supply IDs, drawn from the local supplies snapshot. Used by the bulk
   *  "Find recipes" action to build a multi-ingredient search query. */
  getDisplayNamesForIds: (supplyIds: string[]) => Promise<string[]>;
}

export interface SuppliesSectionProps {
  spaceId: string | null;
  refreshTrigger?: number;
  searchQuery?: string;
  onOpenDetail?: (supply: SupplyWithTags) => void;
  onAddNewTap: () => void;
  // 8R-UX1: state lifted to PantryScreen so the toolbar/action-bar can sit
  // above the ScrollView (sticky). Optional with defaults so legacy/test
  // mounts keep working.
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (supplyId: string) => void;
  groupBy?: 'family' | 'type' | 'storage';
  mergeOnHandRegulars?: boolean;
  // 8R-UX3: outer tab strip — PantryScreen owns the active tab + count
  // display; SuppliesSection owns the data + branches rendering. Counts
  // emitted via callback whenever the supply set changes so the parent
  // can display them in the tab labels.
  activeOuterTab?: 'everything' | 'use_soon' | 'low_out';
  onOuterCountsChange?: (counts: {
    everything: number;
    useSoon: number;
    lowOut: number;
  }) => void;
  // 8R-UX5: hero ingredient frequency data, loaded once at PantryScreen
  // mount + refresh. Null while loading or on failure — UI degrades
  // gracefully (no ⚡ markers, no Heroes pill).
  heroFrequencyData?: import('../../lib/services/heroIngredientService').HeroFrequencyData | null;
  onLongPressSupply: (supply: SupplyWithTags) => void;
  userId: string | null;
  /**
   * CP6d-SmokeFix-4 Task 2: invoked when the user taps a shadow-supply row
   * (catalog ingredient that isn't a real supply yet). Parent opens
   * SupplyCreateSheet pre-populated with the ingredient name as initialQuery.
   */
  onShadowTap?: (candidate: ShadowSupplyCandidate) => void;
}

const SuppliesSection = forwardRef<SuppliesSectionRef, SuppliesSectionProps>(
  function SuppliesSection(
    {
      spaceId,
      refreshTrigger = 0,
      searchQuery = '',
      onOpenDetail,
      onAddNewTap,
      onLongPressSupply,
      userId,
      onShadowTap,
      selectionMode: selectionModeProp,
      selectedIds: selectedIdsProp,
      onToggleSelection,
      groupBy: groupByProp,
      mergeOnHandRegulars: mergeOnHandRegularsProp,
      activeOuterTab = 'everything',
      onOuterCountsChange,
      heroFrequencyData = null,
    },
    ref
  ) {
    const { colors } = useTheme();
    const { showToast } = useSpawnOnOutToast();
    const { currentBanner } = useCookDepletionBanner();
    const [supplies, setSupplies] = useState<SupplyWithTags[]>([]);
    const [loading, setLoading] = useState(false);

    // 8R-UX6 Item 6: expandedSection state only governs type-subgroup
    // expand/collapse inside Everything tab now (the old Use Soon /
    // Attention top-section variants + their first-load cascade effect
    // were deleted in 8R-UX3).
    const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
    // 8R-UX1: each of the three Use Soon sub-sections collapses
    // independently. Default all open so users see content as soon as Use
    // Soon expands; from there individual sub-sections can be hidden.
    const [useSoonSubOpen, setUseSoonSubOpen] = useState({
      expiring: true,
      fridge: true,
      freezer: true,
    });
    const toggleUseSoonSub = (key: 'expiring' | 'fridge' | 'freezer') =>
      setUseSoonSubOpen((prev) => ({ ...prev, [key]: !prev[key] }));

    // 8R-UX1: UI state lifted to PantryScreen (above the ScrollView so the
    // toolbar can stay sticky). When parent doesn't supply props, fall back
    // to local defaults so the component still renders sensibly in isolation.
    const groupBy = groupByProp ?? 'family';
    const mergeOnHandRegulars = mergeOnHandRegularsProp ?? false;
    const selectionMode = selectionModeProp ?? false;
    const selectedIds = selectedIdsProp ?? new Set<string>();
    const toggleSelection = useCallback(
      (supplyId: string) => onToggleSelection?.(supplyId),
      [onToggleSelection]
    );
    // At most one inline-expanded supply row across the whole section.
    const [expandedSupplyId, setExpandedSupplyId] = useState<string | null>(null);

    // CP6d-SmokeFix-4 Task 2: shadow-supply candidates — fetched lazily during
    // search. Cleared when query is empty.
    const [shadowCandidates, setShadowCandidates] = useState<ShadowSupplyCandidate[]>([]);

    // CP6e-FlowsUI-b2: server-side search results, debounced. Map keyed by
    // supplyId → SupplySearchMatch (rank + matchedDimensions + matchedLotIds).
    // Empty map = no active search OR no matches. Triggered when
    // searchQuery.trim().length >= 2; cleared below that threshold.
    const [serverSearchResults, setServerSearchResults] = useState<
      Map<string, SupplySearchMatch>
    >(new Map());
    const [serverSearchLoading, setServerSearchLoading] = useState(false);
    const [serverSearchError, setServerSearchError] = useState<string | null>(null);

    // 8R-UX5: inner-filter state. Discriminated union — exactly one of:
    //   { kind: 'all' }                       — no filter applied (default)
    //   { kind: 'family', familyKey: string } — items in that family
    //   { kind: 'hero' }                      — items whose ingredient is a hero
    // Heroes and family pills are mutually exclusive (one axis at a time).
    //
    // 8R-UX6 Item 7: on Everything tab, the default is the LARGEST family
    // (not 'all'). The ref guards against re-defaulting after the user has
    // manually tapped All or another family — that intent is respected
    // until the user leaves the Everything tab. Use Soon / Low-out outer
    // tabs still default to 'all'.
    const [activeInnerFilter, setActiveInnerFilter] = useState<ActiveInnerFilter>(
      { kind: 'all' }
    );
    const everythingDefaultedRef = useRef(false);
    useEffect(() => {
      if (activeOuterTab !== 'everything') {
        everythingDefaultedRef.current = false;
        setActiveInnerFilter({ kind: 'all' });
        return;
      }
      // On Everything tab — apply largest-family default once per session
      // in this tab. Skip if already defaulted, still loading, or no data.
      if (everythingDefaultedRef.current) return;
      if (supplies.length === 0) return;
      const familyCounts = new Map<string, number>();
      for (const s of supplies) {
        if (s.archived_at !== null) continue;
        if (s.status === 'unknown') continue;
        const { key } = familyKeyForSupply(s);
        if (key === '__other__') continue; // too generic to default to
        familyCounts.set(key, (familyCounts.get(key) ?? 0) + 1);
      }
      if (familyCounts.size === 0) return;
      let largestKey: string | null = null;
      let largestCount = 0;
      for (const [key, count] of familyCounts) {
        if (count > largestCount) {
          largestCount = count;
          largestKey = key;
        }
      }
      if (largestKey) {
        setActiveInnerFilter({ kind: 'family', familyKey: largestKey });
        everythingDefaultedRef.current = true;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeOuterTab, supplies]);
    // Backwards-compat shims for the existing readers below. activeFamily
    // and setActiveFamily are still consumed by FamilyTabStrip; the wrapper
    // keeps the existing call sites untouched while routing through the
    // discriminated state.
    const activeFamily =
      activeInnerFilter.kind === 'family' ? activeInnerFilter.familyKey : null;
    const setActiveFamily = (familyKey: string | null) => {
      setActiveInnerFilter(
        familyKey === null
          ? { kind: 'all' }
          : { kind: 'family', familyKey }
      );
    };

    const load = useCallback(async (sid: string) => {
      try {
        setLoading(true);
        // CP6e-PantryUI-a: hydrate lots + lot_aggregate so SupplyRow can
        // render the lot-aware badge + lots collapser for tracks_lots=true
        // supplies. Non-lots supplies arrive with lots: [] and
        // lot_aggregate: undefined — visual path unchanged for them.
        const data = await getSuppliesForSpace(sid, { includeLots: true });
        setSupplies(data);
      } catch (error) {
        console.error('❌ SuppliesSection load error:', error);
        setSupplies([]);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      if (spaceId) load(spaceId);
    }, [spaceId, refreshTrigger, load]);

    // 8R-UX6 Item 6: first-load auto-expand cascade removed — it only set
    // the now-dead 'use_soon' / 'attention' kinds and no current JSX reads
    // them. The 'sub' kind is opened by user tap (tapSub) on demand.

    // CP6d-SmokeFix-4 Task 2: shadow-supply fetch on search query changes.
    // Debounced via timeout. Cleared when query is empty.
    useEffect(() => {
      const trimmed = searchQuery.trim();
      if (!spaceId || trimmed.length < 2) {
        setShadowCandidates([]);
        return;
      }
      const handle = setTimeout(async () => {
        try {
          const candidates = await searchCatalogIngredients(trimmed, spaceId, 10);
          setShadowCandidates(candidates);
        } catch (error) {
          console.error('❌ shadow search error:', error);
          setShadowCandidates([]);
        }
      }, 250);
      return () => clearTimeout(handle);
    }, [searchQuery, spaceId, refreshTrigger]);

    // CP6e-FlowsUI-b2: debounced server-side supply search at query length
    // >= 2. Routes through `search_supplies` RPC (tsvector + GIN). Local
    // post-hoc matcher reruns per-dimension scan to derive pill labels +
    // matched-lot IDs for highlighting.
    useEffect(() => {
      const trimmed = searchQuery.trim();
      if (!spaceId || trimmed.length < 2) {
        setServerSearchResults(new Map());
        setServerSearchError(null);
        setServerSearchLoading(false);
        return;
      }
      let cancelled = false;
      const timer = setTimeout(async () => {
        setServerSearchLoading(true);
        setServerSearchError(null);
        try {
          const hits = await searchSuppliesServerSide(trimmed, spaceId);
          if (cancelled) return;
          // Build the meta map. For each hit, find the local supply, run the
          // post-hoc matcher, overlay server rank. Supplies the server has
          // but the local snapshot doesn't (rare — only between refresh
          // races) are discarded defensively.
          const supplyById = new Map(supplies.map((s) => [s.id, s]));
          const map = new Map<string, SupplySearchMatch>();
          for (const hit of hits) {
            const supply = supplyById.get(hit.supplyId);
            if (!supply) continue;
            const match = computeSupplySearchMatch(supply, trimmed);
            match.rank = hit.rank;
            map.set(hit.supplyId, match);
          }
          if (!cancelled) setServerSearchResults(map);
        } catch (err) {
          if (cancelled) return;
          console.error('❌ searchSuppliesServerSide error:', err);
          setServerSearchError('Search failed. Try again.');
        } finally {
          if (!cancelled) setServerSearchLoading(false);
        }
      }, 200);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [searchQuery, spaceId, supplies, refreshTrigger]);

    useImperativeHandle(
      ref,
      () => ({
        hasExactMatch: (q: string) => {
          const trimmed = q.trim().toLowerCase();
          if (!trimmed) return false;
          return supplies.some(
            (s) =>
              (s.ingredient?.name ?? s.custom_name ?? '').toLowerCase() === trimmed
          );
        },
        getFilteredFamilyCount: (q: string) => {
          const trimmed = q.trim().toLowerCase();
          if (!trimmed) return 0;
          const families = new Set<string>();
          for (const s of supplies) {
            if (s.archived_at !== null) continue;
            if (!supplyMatchesQuery(s, trimmed)) continue;
            const fam = s.ingredient?.family?.trim().toLowerCase();
            families.add(fam && fam.length > 0 ? fam : '__other__');
          }
          return families.size;
        },
        bulkMarkInStock,
        bulkMarkOut,
        bulkAddToGrocery,
        getDisplayNamesForIds: async (ids: string[]) => {
          const byId = new Map(supplies.map((s) => [s.id, s]));
          return ids
            .map((id) => {
              const s = byId.get(id);
              if (!s) return '';
              return (
                s.ingredient?.name ??
                s.custom_name ??
                ''
              );
            })
            .filter((n) => n.length > 0);
        },
      }),
      [supplies, bulkMarkInStock, bulkMarkOut, bulkAddToGrocery]
    );

    const handleSupplyChanged = useCallback(
      (next: SupplyWithTags) => {
        // Detect spawn-on-out by comparing prior status to next status. We
        // only have the post-update supply here; for the toast the parent
        // hands off via showToast which expects (supply, needId, priorStatus)
        // — but post-CP6d-SmokeFix-1, SupplyControls/SupplyRow drive the
        // service calls directly via setSupplyUsageLevel, which routes
        // through setSupplyStatus internally. setSupplyStatus's spawnedNeed
        // result is consumed inside the service; the spawned-need toast
        // wiring loses some fidelity (we don't know about new spawns from
        // here). For F&F that's acceptable — the toast still fires from
        // SupplyDetailScreen's direct setSupplyStatus path; the inline
        // pantry surface is silent on spawn. Track as a follow-up if it
        // confuses testers.
        setSupplies((prev) => {
          const updated = prev.map((s) => (s.id === next.id ? next : s));
          // CP6d-Schema track_only auto-archive: the row may need to drop
          // from the list entirely. Archived rows are filtered server-side
          // on next reload; for now, hide locally.
          const visible = updated.filter((s) => s.archived_at === null);
          return sortSupplies(visible);
        });

        // Suppress: see comment above. We can't reliably re-fire the toast
        // here without the spawnedNeed reference. Surfacing in SESSION_LOG.
        void showToast;
        void currentBanner;
      },
      [showToast, currentBanner]
    );

    const handleToggleExpandedSupply = useCallback((supplyId: string) => {
      setExpandedSupplyId((prev) => (prev === supplyId ? null : supplyId));
    }, []);

    // 8R-UX1: track_only items go to the new TrackOnlyOutToast for the
    // "Add to grocery list" prompt. Restock items use the existing
    // SpawnOnOutToast — the `showToast` from useSpawnOnOutToast destructured
    // above gets used now (the prior `void showToast` suppression was
    // because SupplyControls drove the service call internally; swipe is
    // a new entry point that surfaces the toast directly).
    const trackOnlyOutToast = useTrackOnlyOutToast();

    // 8R-UX1: right-swipe handler on Use Soon rows. Bumps the freshness signal
    // so the supply drops out of Use Soon immediately, without changing
    // status or quantity. Optimistic local update via handleSupplyChanged.
    const handleSwipeMarkUsed = useCallback(
      async (supply: SupplyWithTags) => {
        try {
          const updated = await markSupplyUsed(supply.id);
          handleSupplyChanged(updated);
        } catch (error) {
          console.error('❌ Swipe mark used failed:', error);
        }
      },
      [handleSupplyChanged]
    );

    // 8R-UX1: bulk action implementations. Exposed via ref so PantryScreen's
    // sticky toolbar can trigger them. Each loops with Promise.allSettled so
    // one failure doesn't abort the rest, then re-loads to reconcile.
    const performBulk = useCallback(
      async (ids: string[], op: (supplyId: string) => Promise<unknown>) => {
        if (ids.length === 0) return;
        try {
          await Promise.allSettled(ids.map(op));
        } catch (error) {
          console.error('❌ bulk action failed:', error);
        } finally {
          if (spaceId) load(spaceId);
        }
      },
      [spaceId, load]
    );

    const bulkMarkInStock = useCallback(
      (ids: string[]) =>
        performBulk(ids, (id) => setSupplyStatus(id, 'in_stock')),
      [performBulk]
    );

    const bulkMarkOut = useCallback(
      (ids: string[]) => performBulk(ids, (id) => setSupplyStatus(id, 'out')),
      [performBulk]
    );

    const bulkAddToGrocery = useCallback(
      async (ids: string[], tagIds?: string[]) => {
        if (!spaceId || ids.length === 0) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const supplyById = new Map(supplies.map((s) => [s.id, s]));
        await performBulk(ids, async (id) => {
          const supply = supplyById.get(id);
          if (!supply) return;
          await createNeed({
            spaceId,
            ingredientId: supply.ingredient?.id,
            customName: supply.ingredient
              ? undefined
              : supply.custom_name ?? undefined,
            supplyId: supply.id,
            addedBy: user.id,
            addedFrom: 'manual',
            tagIds,
          });
        });
      },
      [performBulk, supplies, spaceId]
    );

    // 8R-UX1: left-swipe handler. Routes the post-out toast based on what
    // setSupplyStatus did:
    //   • restock supply spawned a need (result.spawnedNeed present) → fire
    //     the existing SpawnOnOutToast (was previously suppressed in this
    //     file; swipe is a new entry point so we surface it here).
    //   • track_only supply auto-archived (no spawn) → fire the new
    //     TrackOnlyOutToast so user can opt into a grocery-list add and
    //     optionally flip tracking_mode for next time.
    const handleSwipeMarkOut = useCallback(
      async (supply: SupplyWithTags) => {
        const priorStatus = supply.status;
        try {
          const result = await setSupplyStatus(supply.id, 'out');
          handleSupplyChanged(result.supply);
          if (result.spawnedNeed) {
            showToast(result.supply, result.spawnedNeed.id, priorStatus);
          } else if (supply.tracking_mode === 'track_only') {
            trackOnlyOutToast.showToast(result.supply, priorStatus);
          }
        } catch (error) {
          console.error('❌ Swipe mark out failed:', error);
        }
      },
      [handleSupplyChanged, showToast, trackOnlyOutToast]
    );

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            paddingHorizontal: spacing.md,
            paddingBottom: 14,
          },
          topHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 14,
            marginBottom: 4,
            paddingVertical: 6,
          },
          topTitle: {
            fontSize: 13,
            fontWeight: typography.weights.semibold,
            color: colors.text.primary,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          },
          topTitleWithIcon: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          },
          topRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          },
          topCount: {
            fontSize: 11,
            color: colors.text.tertiary,
          },
          topChevron: {
            fontSize: 12,
            color: colors.text.tertiary,
          },
          // 8R-UX1: Family / Storage toggle pill in the On Hand header.
          groupByPill: {
            flexDirection: 'row',
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.medium,
            overflow: 'hidden',
            marginRight: 8,
          },
          groupByPillButton: {
            paddingHorizontal: 8,
            paddingVertical: 3,
          },
          groupByPillButtonOn: {
            backgroundColor: colors.primary,
          },
          groupByPillText: {
            fontSize: 11,
            color: colors.text.secondary,
            fontWeight: typography.weights.medium,
          },
          groupByPillTextOn: {
            color: '#ffffff',
          },
          // 8R-UX1 continuation: family tab strip in Type mode.
          familyTabScroll: {
            marginTop: 8,
            marginBottom: 4,
            maxHeight: 36,
          },
          familyTabScrollContent: {
            paddingHorizontal: 2,
            gap: 6,
            alignItems: 'center',
          },
          familyTabChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.medium,
            backgroundColor: colors.background.card,
          },
          familyTabChipIcon: {
            marginRight: 4,
          },
          familyTabChipActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          },
          familyTabChipText: {
            fontSize: 12,
            color: colors.text.secondary,
            fontWeight: typography.weights.medium,
          },
          familyTabChipTextActive: {
            color: '#ffffff',
          },
          familyTabEmpty: {
            paddingVertical: 32,
            alignItems: 'center',
          },
          familyTabEmptyText: {
            fontSize: 13,
            color: colors.text.tertiary,
          },
          // 8R-UX3: per-outer-tab empty message.
          outerTabEmpty: {
            paddingVertical: 48,
            paddingHorizontal: 16,
            alignItems: 'center',
          },
          outerTabEmptyText: {
            fontSize: 14,
            color: colors.text.tertiary,
            textAlign: 'center',
          },
          // 8R-UX1: top toolbar (just under the search bar, above all
          // sections). Holds Select button + group-by + split/merge pills.
          toolbar: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            paddingTop: 10,
            paddingBottom: 6,
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
          // 8R-UX1: selection mode row wrapper.
          selectionRowOuter: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
            borderWidth: 1,
            borderColor: colors.border.light,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.background.card,
            overflow: 'hidden',
          },
          selectionRowCheckCol: {
            width: 40,
            alignItems: 'center',
            justifyContent: 'center',
          },
          selectionRowContentCol: {
            flex: 1,
          },
          selectionCheckbox: {
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: colors.border.medium,
            backgroundColor: colors.background.card,
            alignItems: 'center',
            justifyContent: 'center',
          },
          selectionCheckmark: {
            color: '#ffffff',
            fontSize: 14,
            fontWeight: typography.weights.bold,
          },
          // 8R-UX1: bulk action bar — sits in the toolbar slot (just under
          // search bar) when selection mode is on. Replaces the toolbar.
          actionBar: {
            marginTop: 10,
            marginBottom: 6,
            paddingVertical: 12,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.background.card,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.primary,
            ...shadows.small,
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
          subHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
            marginBottom: 2,
            paddingVertical: 4,
          },
          // 8R-UX1: family header for the nested Type view. Sits one level
          // above CategorySubsection's subHeader visually — uppercase, bold,
          // slightly larger.
          familyHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12,
            marginBottom: 2,
            paddingVertical: 4,
          },
          familyHeaderText: {
            fontSize: 13,
            fontWeight: typography.weights.semibold,
            color: colors.text.primary,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          },
          familyHeaderCount: {
            fontSize: 11,
            color: colors.text.tertiary,
          },
          subTitle: {
            fontSize: 12,
            fontWeight: typography.weights.medium,
            color: colors.text.secondary,
          },
          subCount: {
            fontSize: 11,
            color: colors.text.tertiary,
            marginRight: 6,
          },
          // 8R-UX1: larger collapsible sub-headers used inside Use Soon. Each
          // header has an icon on the left, count + chevron on the right.
          useSoonSubHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
            marginBottom: 4,
            paddingVertical: 6,
          },
          useSoonSubLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flex: 1,
          },
          useSoonSubTitle: {
            fontSize: 14,
            fontWeight: typography.weights.semibold,
            color: colors.text.primary,
          },
          useSoonSubRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          },
          useSoonSubCount: {
            fontSize: 12,
            color: colors.text.tertiary,
          },
          useSoonSubChevron: {
            fontSize: 12,
            color: colors.text.tertiary,
          },
          divider: {
            height: 1,
            backgroundColor: colors.border.light,
            marginVertical: 6,
          },
          dualListingNote: {
            fontSize: 10,
            color: colors.text.tertiary,
            fontStyle: 'italic',
            marginTop: 2,
            marginBottom: 4,
            paddingHorizontal: 4,
          },
          addNewButton: {
            marginTop: 16,
            paddingVertical: 12,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border.medium,
            alignItems: 'center',
          },
          addNewText: {
            fontSize: 14,
            fontWeight: typography.weights.medium,
            color: colors.text.secondary,
          },
          empty: {
            padding: 20,
            marginTop: 16,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border.medium,
            alignItems: 'center',
          },
          emptyTitle: {
            fontSize: 15,
            fontWeight: typography.weights.semibold,
            color: colors.text.primary,
            marginBottom: 6,
            textAlign: 'center',
          },
          emptyText: {
            fontSize: 13,
            color: colors.text.secondary,
            marginBottom: 12,
            textAlign: 'center',
          },
          emptyButton: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.primary,
          },
          emptyButtonText: {
            fontSize: 13,
            fontWeight: typography.weights.semibold,
            color: '#ffffff',
          },
          emptyFiltered: {
            padding: 14,
            marginTop: 12,
            alignItems: 'center',
          },
          emptyFilteredText: {
            fontSize: 13,
            color: colors.text.tertiary,
          },
          // CP6e-FlowsUI-b2 — server-search error banner.
          searchErrorBanner: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginTop: 8,
            borderRadius: 6,
            backgroundColor: colors.background.surface,
          },
          searchErrorText: {
            fontSize: 12,
            color: colors.text.tertiary,
          },
        }),
      [colors]
    );

    const trimmedQuery = searchQuery.trim().toLowerCase();
    // CP6e-FlowsUI-b2: at query length >= 2, filter via server-side
    // `search_supplies` RPC results (server-built tsvector covers 8
    // dimensions including tags + all lot fields with storage synonyms).
    // Below the threshold: no filter, all supplies pass through (existing
    // non-search rendering preserved). Query length 1 is treated as "no
    // search" — too noisy to roundtrip.
    const searchActive = trimmedQuery.length >= 2;
    const filtered = !searchActive
      ? supplies
      : supplies.filter((s) => serverSearchResults.has(s.id));

    // Section classification. Dual-listing (P19/P20): Attention items ALSO
    // appear in their tracking-mode-appropriate sub-category. We do NOT
    // exclude attention rows from the Regulars/On Hand classification.
    // CP6d-SmokeFix-4 Task 3: 'unknown'-status supplies are HIDDEN from all
    // sections — they surface only in the "Not tracked yet" search-only group.
    const attentionRaw = filtered.filter(
      (s) => s.status === 'out' || s.status === 'critical' || s.status === 'low'
    );
    const restockAllRaw = filtered.filter(
      (s) =>
        s.tracking_mode === 'restock' &&
        s.archived_at === null &&
        s.status !== 'unknown'
    );
    const trackOnlyAllRaw = filtered.filter(
      (s) =>
        s.tracking_mode === 'track_only' &&
        s.archived_at === null &&
        s.status !== 'unknown'
    );

    // CP6e-FlowsUI-b2: during active search, sort each section by RPC
    // ts_rank DESC so the most relevant matches surface first. Outside
    // search, fall back to the existing status-priority + name sort.
    const attentionSupplies = searchActive
      ? sortSuppliesByRank(attentionRaw, serverSearchResults)
      : attentionRaw;
    const restockAllUnfiltered = searchActive
      ? sortSuppliesByRank(restockAllRaw, serverSearchResults)
      : restockAllRaw;
    const trackOnlyAllUnfiltered = searchActive
      ? sortSuppliesByRank(trackOnlyAllRaw, serverSearchResults)
      : trackOnlyAllRaw;

    // Use Soon — combines expiring lots (per-supply lot_aggregate, 7d window
    // from CP6e schema) with idle cold-storage items derived in-render via
    // isIdleCold/getIdleSinceIso (no extra fetch). For lot-tracked supplies
    // the freshness signal is the oldest active lot's acquired_at — so a
    // brand-new supply with an old lot (Tom's miso paste case) still
    // surfaces. Idle items split by storage location for the two labels.
    // Dual-listing: items here also appear in their On Hand / Regulars
    // bucket below, same as Attention. During search, all sub-lists honor
    // the `filtered` set so they collapse with no matches.
    const expiringSupplies = filtered
      .filter(
        (s) =>
          s.lot_aggregate?.has_expiring_soon &&
          // 8R-UX1: an 'out' supply with lots is a contradiction (Q44 should
          // have caught it) but defend anyway — Use Soon is about items the
          // user still has.
          s.status !== 'out' &&
          s.status !== 'unknown'
      )
      .slice()
      .sort((a, b) => {
        const aT = a.lot_aggregate?.oldest_expiration ?? '￿';
        const bT = b.lot_aggregate?.oldest_expiration ?? '￿';
        return aT.localeCompare(bT);
      });
    const sortByIdleSince = (a: SupplyWithTags, b: SupplyWithTags) => {
      const aT = getIdleSinceIso(a) ?? a.updated_at;
      const bT = getIdleSinceIso(b) ?? b.updated_at;
      return aT.localeCompare(bT);
    };
    const fridgeIdleSupplies = filtered
      .filter((s) => isIdleCold(s) && s.storage_location === 'fridge')
      .slice()
      .sort(sortByIdleSince);
    const freezerIdleSupplies = filtered
      .filter((s) => isIdleCold(s) && s.storage_location === 'freezer')
      .slice()
      .sort(sortByIdleSince);

    // 8R-UX3: outer-tab universes — must be declared BEFORE outerUniverse /
    // familyTabs / per-tab filtered sets to avoid TDZ. Hermes phrases the
    // resulting iterator-on-undefined throw as "Cannot convert undefined
    // value to object" (the previous BISECT-2 stubs were declared below
    // outerUniverse, which is what caused the render error).
    //
    //   useSoonAll  — deduped union of expiring + idle-fridge + idle-freezer
    //                 (a supply can be both expiring AND idle-cold).
    //   lowOutAll   — alias for attentionSupplies (already out/critical/low).
    //   everythingAll — active filtered set (archived + unknown excluded).
    const useSoonAll = Array.from(
      new Map(
        [...expiringSupplies, ...fridgeIdleSupplies, ...freezerIdleSupplies].map(
          (s) => [s.id, s] as const
        )
      ).values()
    );
    const lowOutAll = attentionSupplies;
    const everythingAll = filtered.filter(
      (s) => s.archived_at === null && s.status !== 'unknown'
    );

    // 8R-UX3: emit outer-tab counts up to PantryScreen for the tab labels.
    // Runs whenever any universe length changes; the parent's setOuterCounts
    // identity is stable so the dep array stays tight.
    const everythingCount = everythingAll.length;
    const useSoonCount = useSoonAll.length;
    const lowOutCount = lowOutAll.length;
    useEffect(() => {
      onOuterCountsChange?.({
        everything: everythingCount,
        useSoon: useSoonCount,
        lowOut: lowOutCount,
      });
    }, [everythingCount, useSoonCount, lowOutCount, onOuterCountsChange]);

    // 8R-UX3: family-tabs strip derived from the ACTIVE OUTER TAB's universe
    // (counts reflect Use soon / Low-out / Everything filtered set per spec).
    // Sorted count-desc with `__other__` pinned last. Pills with zero count
    // are dropped (not rendered). Always shown when there's >=1 family with
    // items in the active outer set (no longer gated on groupBy='type').
    const outerUniverse =
      activeOuterTab === 'use_soon'
        ? useSoonAll
        : activeOuterTab === 'low_out'
        ? lowOutAll
        : everythingAll;
    const familyTabs: Array<{ key: string; label: string; count: number }> = (() => {
      const counts = new Map<string, { key: string; label: string; count: number }>();
      for (const s of outerUniverse) {
        const { key, label } = familyKeyForSupply(s);
        const existing = counts.get(key);
        if (existing) existing.count++;
        else counts.set(key, { key, label, count: 1 });
      }
      return Array.from(counts.values())
        .filter((c) => c.count > 0)
        .sort((a, b) => {
          if (a.key === '__other__') return 1;
          if (b.key === '__other__') return -1;
          if (a.count !== b.count) return b.count - a.count;
          return a.label.localeCompare(b.label);
        });
    })();

    // 8R-UX5: heroes count derived from the active outer-tab universe.
    // Drives the Heroes pill render gate (hidden when zero) and its label.
    // null heroFrequencyData → count is 0 → pill not rendered.
    const heroCount = heroFrequencyData
      ? outerUniverse.filter((s) =>
          isHeroIngredient(s.ingredient?.id ?? null, heroFrequencyData)
        ).length
      : 0;

    // 8R-UX3 / 8R-UX5: inner filter axis. Single helper checks whatever the
    // active filter axis is. `isFamilyFiltered` retains its old meaning
    // (controls flattenByType passthrough for Type-mode rendering inside
    // Everything tab). Hero-filtered universes still pass flattenByType=false
    // (Hero is orthogonal to family/type rendering).
    const isFamilyFiltered = activeInnerFilter.kind === 'family';
    const isHeroFiltered = activeInnerFilter.kind === 'hero';
    const matchesActiveFamily = (s: SupplyWithTags) => {
      if (activeInnerFilter.kind === 'all') return true;
      if (activeInnerFilter.kind === 'family') {
        return familyKeyForSupply(s).key === activeInnerFilter.familyKey;
      }
      // 'hero'
      return isHeroIngredient(s.ingredient?.id ?? null, heroFrequencyData);
    };
    const innerFilterActive = isFamilyFiltered || isHeroFiltered;
    const trackOnlyAll = innerFilterActive
      ? trackOnlyAllUnfiltered.filter(matchesActiveFamily)
      : trackOnlyAllUnfiltered;
    const restockAll = innerFilterActive
      ? restockAllUnfiltered.filter(matchesActiveFamily)
      : restockAllUnfiltered;
    const useSoonExpiringFiltered = innerFilterActive
      ? expiringSupplies.filter(matchesActiveFamily)
      : expiringSupplies;
    const useSoonFridgeFiltered = innerFilterActive
      ? fridgeIdleSupplies.filter(matchesActiveFamily)
      : fridgeIdleSupplies;
    const useSoonFreezerFiltered = innerFilterActive
      ? freezerIdleSupplies.filter(matchesActiveFamily)
      : freezerIdleSupplies;
    const lowOutFiltered = innerFilterActive
      ? lowOutAll.filter(matchesActiveFamily)
      : lowOutAll;

    // CP6d-SmokeFix-4 Tasks 2+3: "Not tracked yet" search-only group.
    // Combines real supplies at status='unknown' (matching the search query)
    // with shadow candidates from catalog. Renders only when search is active.
    const unknownSupplies = filtered.filter(
      (s) => s.status === 'unknown' && s.archived_at === null
    );
    const showNotTrackedYet =
      trimmedQuery.length > 0 &&
      (unknownSupplies.length > 0 || shadowCandidates.length > 0);

    if (!loading && supplies.length === 0) {
      return (
        <View style={styles.container}>
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Track your household supplies</Text>
            <Text style={styles.emptyText}>
              Olive oil, paper towels, eggs — anything you keep on hand.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={onAddNewTap}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add first supply"
            >
              <Text style={styles.emptyButtonText}>Add first supply</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (
      trimmedQuery &&
      attentionSupplies.length === 0 &&
      restockAll.length === 0 &&
      trackOnlyAll.length === 0 &&
      // 8R-UX1: don't short-circuit when there's catalog content to surface
      // — fall through so the "Not tracked yet" section can render.
      shadowCandidates.length === 0 &&
      unknownSupplies.length === 0
    ) {
      return (
        <View style={styles.container}>
          {serverSearchError && (
            <View style={styles.emptyFiltered}>
              <Text style={styles.emptyFilteredText}>{serverSearchError}</Text>
            </View>
          )}
          <View style={styles.emptyFiltered}>
            <Text style={styles.emptyFilteredText}>
              {serverSearchLoading
                ? 'Searching…'
                : `No supplies match "${searchQuery}".`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addNewButton}
            onPress={onAddNewTap}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add new supply"
          >
            <Text style={styles.addNewText}>+ Add new supply</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // CP6e-SmokeFix-SF2-followup (2026-05-14): during active search, the
    // existing manual expansion state (`expandedSection`) is preserved so
    // sections collapse back to whatever was open before when the query
    // clears. 8R-UX6 Item 6: isUseSoonOpen / isAttentionOpen / tapUseSoon /
    // tapAttention removed — those governed the deleted standalone Use
    // Soon + Attention sections.
    const openSubKey = (top: 'restock' | 'track_only'): string | null =>
      expandedSection?.kind === 'sub' && expandedSection.top === top
        ? expandedSection.key
        : null;

    const tapSub = (top: 'restock' | 'track_only', key: string) => {
      setExpandedSection((prev) =>
        prev?.kind === 'sub' && prev.top === top && prev.key === key
          ? null
          : { kind: 'sub', top, key }
      );
    };

    const renderRow = (
      supply: SupplyWithTags,
      keySuffix?: string,
      urgency?: UrgencyContext
    ) => {
      const compositeKey = `${supply.id}${keySuffix ?? ''}`;
      // 8R-UX5: ⚡ inline marker on Use Soon rows for hero ingredients. Scoped
      // to Use Soon tab per spec (Everything + Low/out do NOT show the marker
      // even for hero items).
      const showHeroMarker =
        activeOuterTab === 'use_soon' &&
        isHeroIngredient(supply.ingredient?.id ?? null, heroFrequencyData);
      const innerRow = (
        <SupplyRow
          key={compositeKey}
          supply={supply}
          expanded={expandedSupplyId === compositeKey}
          onToggleExpanded={() => handleToggleExpandedSupply(compositeKey)}
          onSupplyChanged={handleSupplyChanged}
          onLongPress={onLongPressSupply}
          onOpenDetail={onOpenDetail}
          userId={userId}
          // CP6e-FlowsUI-b2: pass through the per-supply search match when
          // server search is active. Undefined when not searching → SupplyRow
          // renders zero pills + no lot highlighting.
          searchMatch={
            searchActive ? serverSearchResults.get(supply.id) : undefined
          }
          urgency={urgency}
          showHeroMarker={showHeroMarker}
        />
      );
      // 8R-UX1: in selection mode, replace the swipe wrapper with a
      // selection overlay so taps toggle selection instead of triggering
      // SupplyRow's inner actions. Swipe disabled while selecting.
      if (selectionMode) {
        return (
          <SelectionRowWrapper
            key={`${compositeKey}:select`}
            isSelected={selectedIds.has(supply.id)}
            onPress={() => toggleSelection(supply.id)}
            styles={styles}
            primaryColor={colors.primary}
          >
            {innerRow}
          </SelectionRowWrapper>
        );
      }
      // 8R-UX1: swipe wraps every SupplyRow render across all sections.
      // Right = Mark used (refresh acquired_at / updated_at). Left = Mark
      // out (setSupplyStatus → existing spawn-on-out for Regulars / new
      // TrackOnlyOutToast for On Hand).
      return (
        <SwipeableRow
          key={`${compositeKey}:swipe`}
          onMarkUsed={() => handleSwipeMarkUsed(supply)}
          onMarkOut={() => handleSwipeMarkOut(supply)}
        >
          {innerRow}
        </SwipeableRow>
      );
    };

    return (
      <View style={styles.container}>
        {/* CP6e-FlowsUI-b2: server-search error banner — shows when search
            failed but we still have prior results to display. Non-blocking. */}
        {serverSearchError && (
          <View style={styles.searchErrorBanner}>
            <Text style={styles.searchErrorText}>{serverSearchError}</Text>
          </View>
        )}
        {/* 8R-UX3: family tab strip — always rendered when there's ≥1 family
            with items in the active outer tab's universe. Pills with zero
            count are dropped (handled inside familyTabs computation).
            8R-UX5: Heroes pill embedded in the strip when on everything /
            use_soon tabs AND any items in the universe qualify as heroes. */}
        {(familyTabs.length > 0 || heroCount > 0) && (
          <FamilyTabStrip
            tabs={familyTabs}
            activeInnerFilter={activeInnerFilter}
            onSelect={setActiveInnerFilter}
            heroCount={heroCount}
            showHeroPill={activeOuterTab !== 'low_out'}
            styles={styles}
            colors={colors}
          />
        )}

        {/* 8R-UX3: branch by outer tab. Use soon / Low / out render their
            own fixed sub-categories (UseSoonContent / AttentionContent),
            ignoring groupBy. Everything renders the existing On Hand /
            Regulars structure with groupBy + family-filter interaction. */}
        {activeOuterTab === 'use_soon' && (
          <>
            {useSoonExpiringFiltered.length +
              useSoonFridgeFiltered.length +
              useSoonFreezerFiltered.length === 0 ? (
              <View style={styles.outerTabEmpty}>
                <Text style={styles.outerTabEmptyText}>
                  {isFamilyFiltered
                    ? `Nothing in ${familyTabs.find((t) => t.key === activeFamily)?.label ?? 'this family'} is due soon.`
                    : 'Nothing expiring soon — nice work.'}
                </Text>
              </View>
            ) : (
              <UseSoonContent
                expiringSupplies={useSoonExpiringFiltered}
                fridgeIdleSupplies={useSoonFridgeFiltered}
                freezerIdleSupplies={useSoonFreezerFiltered}
                renderRow={(s, urgency) => renderRow(s, ':soon', urgency)}
                subOpen={useSoonSubOpen}
                onToggleSub={toggleUseSoonSub}
                styles={styles}
                iconColor={colors.text.primary}
              />
            )}
          </>
        )}

        {activeOuterTab === 'low_out' && (
          <>
            {lowOutFiltered.length === 0 ? (
              <View style={styles.outerTabEmpty}>
                <Text style={styles.outerTabEmptyText}>
                  {isFamilyFiltered
                    ? `Nothing in ${familyTabs.find((t) => t.key === activeFamily)?.label ?? 'this family'} is low or out.`
                    : 'All stocked up.'}
                </Text>
              </View>
            ) : (
              <AttentionContent
                attentionSupplies={lowOutFiltered}
                renderRow={(s) => renderRow(s, ':attn')}
                styles={styles}
              />
            )}
          </>
        )}

        {activeOuterTab === 'everything' && (
          <>
            {mergeOnHandRegulars
              ? (trackOnlyAll.length + restockAll.length > 0 && (
                  <>
                    <View style={styles.topHeader}>
                      <Text style={styles.topTitle}>Pantry</Text>
                      <View style={styles.topRight}>
                        <Text style={styles.topCount}>
                          {trackOnlyAll.length + restockAll.length}
                        </Text>
                      </View>
                    </View>
                    <CategorizedSubsections
                      top="track_only"
                      supplies={[...trackOnlyAll, ...restockAll]}
                      openSubKey={openSubKey('track_only')}
                      onTapSub={(k) => tapSub('track_only', k)}
                      renderRow={(s, family) => renderRow(s, `:merged:${family}`)}
                      styles={styles}
                      forceOpen={searchActive}
                      groupBy={groupBy}
                      flattenByType={isFamilyFiltered}
                    />
                  </>
                ))
              : (
                <>
                  {/* On Hand (above Regulars per P18) */}
                  {trackOnlyAll.length > 0 && (
                    <>
                      <View style={styles.topHeader}>
                        <Text style={styles.topTitle}>On Hand</Text>
                        <View style={styles.topRight}>
                          <Text style={styles.topCount}>{trackOnlyAll.length}</Text>
                        </View>
                      </View>
                      <CategorizedSubsections
                        top="track_only"
                        supplies={trackOnlyAll}
                        openSubKey={openSubKey('track_only')}
                        onTapSub={(k) => tapSub('track_only', k)}
                        renderRow={(s, family) => renderRow(s, `:track:${family}`)}
                        styles={styles}
                        forceOpen={searchActive}
                        groupBy={groupBy}
                        flattenByType={isFamilyFiltered}
                      />
                    </>
                  )}

                  {/* Regulars */}
                  {restockAll.length > 0 && (
                    <>
                      <View style={styles.topHeader}>
                        <View style={styles.topTitleWithIcon}>
                          <RegularBookmarkIcon size={14} color={colors.primary} />
                          <Text style={styles.topTitle}>Regulars</Text>
                        </View>
                        <View style={styles.topRight}>
                          <Text style={styles.topCount}>{restockAll.length}</Text>
                        </View>
                      </View>
                      <CategorizedSubsections
                        top="restock"
                        supplies={restockAll}
                        openSubKey={openSubKey('restock')}
                        onTapSub={(k) => tapSub('restock', k)}
                        renderRow={(s, family) => renderRow(s, `:reg:${family}`)}
                        forceOpen={searchActive}
                        styles={styles}
                        groupBy={groupBy}
                        flattenByType={isFamilyFiltered}
                      />
                    </>
                  )}
                </>
              )}

            {/* Family-tab empty state for Everything (only matters when
                user has filtered to a family with no items in that family). */}
            {isFamilyFiltered &&
              trackOnlyAll.length === 0 &&
              restockAll.length === 0 && (
                <View style={styles.outerTabEmpty}>
                  <Text style={styles.outerTabEmptyText}>
                    No items in{' '}
                    {familyTabs.find((t) => t.key === activeFamily)?.label ?? 'this family'}
                    {searchActive ? ' match your search' : ''}.
                  </Text>
                </View>
              )}
          </>
        )}

        {/* CP6d-SmokeFix-4 Tasks 2+3: "Not tracked yet" — search-only group
            with real-unknown supplies + shadow catalog candidates. */}
        {showNotTrackedYet && (
          <View>
            <View style={styles.topHeader}>
              <Text style={styles.topTitle}>Not tracked yet</Text>
              <View style={styles.topRight}>
                <Text style={styles.topCount}>
                  {unknownSupplies.length + shadowCandidates.length}
                </Text>
              </View>
            </View>
            {unknownSupplies.length > 0 && (
              <View>
                <View style={styles.subHeader}>
                  <Text style={styles.subTitle}>Unknown status</Text>
                  <Text style={styles.subCount}>{unknownSupplies.length}</Text>
                </View>
                {unknownSupplies.map((s) => renderRow(s, ':unknown'))}
              </View>
            )}
            {shadowCandidates.length > 0 && (
              <View>
                <View style={styles.subHeader}>
                  <Text style={styles.subTitle}>Could add</Text>
                  <Text style={styles.subCount}>{shadowCandidates.length}</Text>
                </View>
                {shadowCandidates.map((c) => (
                  <ShadowRow
                    key={`shadow-${c.id}`}
                    candidate={c}
                    onPress={() => onShadowTap?.(c)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.addNewButton}
          onPress={onAddNewTap}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Add new supply"
        >
          <Text style={styles.addNewText}>+ Add new supply</Text>
        </TouchableOpacity>
      </View>
    );
  }
);

export default SuppliesSection;

// ============================================
// SHADOW ROW — catalog-only candidate (CP6d-SmokeFix-4 Task 2)
// ============================================
function ShadowRow({
  candidate,
  onPress,
}: {
  candidate: ShadowSupplyCandidate;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          marginBottom: 4,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.background.card,
          overflow: 'hidden',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 6,
          paddingRight: spacing.md,
        },
        leftBar: {
          width: 4,
          alignSelf: 'stretch',
          marginRight: 10,
          backgroundColor: '#9ca3af',
        },
        iconCircle: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: '#9ca3af',
          marginRight: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        iconText: {
          fontSize: 11,
          color: '#9ca3af',
          fontWeight: typography.weights.bold,
        },
        body: {
          flex: 1,
          paddingVertical: 2,
          paddingRight: 6,
        },
        name: {
          fontSize: typography.sizes.md,
          color: colors.text.secondary,
          fontWeight: typography.weights.medium,
        },
        meta: {
          fontSize: 11,
          color: colors.text.tertiary,
          marginTop: 1,
        },
        addLabel: {
          fontSize: 11,
          color: colors.primary,
          fontWeight: typography.weights.semibold,
          marginLeft: 6,
        },
      }),
    [colors]
  );

  const displayName =
    candidate.plural_name && candidate.plural_name.length > 0
      ? candidate.plural_name
      : candidate.name;

  return (
    <View style={styles.outer}>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`Add ${displayName} as a tracked supply`}
      >
        <View style={styles.leftBar} />
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>?</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {candidate.family && (
            <Text style={styles.meta} numberOfLines={1}>
              {candidate.family}
              {candidate.ingredient_type ? ` · ${candidate.ingredient_type}` : ''}
            </Text>
          )}
        </View>
        <Text style={styles.addLabel}>+ Track</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================
// ATTENTION SUB-SECTIONS — Out + Low/Critical
// ============================================

function AttentionContent({
  attentionSupplies,
  renderRow,
  styles,
}: {
  attentionSupplies: SupplyWithTags[];
  renderRow: (s: SupplyWithTags) => React.ReactElement;
  styles: ReturnType<typeof StyleSheet.create>;
}) {
  const outItems = attentionSupplies.filter((s) => s.status === 'out');
  const lowItems = attentionSupplies.filter(
    (s) => s.status === 'low' || s.status === 'critical'
  );

  return (
    <View>
      {outItems.length > 0 && (
        <View>
          <View style={styles.subHeader}>
            <Text style={styles.subTitle}>Out</Text>
            <Text style={styles.subCount}>{outItems.length}</Text>
          </View>
          {outItems.map(renderRow)}
        </View>
      )}
      {lowItems.length > 0 && (
        <View>
          <View style={styles.subHeader}>
            <Text style={styles.subTitle}>Low</Text>
            <Text style={styles.subCount}>{lowItems.length}</Text>
          </View>
          {lowItems.map(renderRow)}
        </View>
      )}
      <Text style={styles.dualListingNote}>
        Items above are also in their original category below.
      </Text>
    </View>
  );
}

// ============================================
// USE SOON SUB-SECTIONS — Expiring + Sitting idle (8R-UX1)
// ============================================
// Urgency colors mirror the existing status palette (see colorForStatus in
// SupplyRow) so the visual language is consistent across the screen:
//   #DC2626 — same family as functionalColors.error  (today / past / 1d)
//   #EA580C — same as the hardcoded 'critical' shade (2d)
//   #F59E0B — amber                                  (3-4d / 30+d idle)
//   #CA8A04 — yellow                                 (5-7d / 14-29d idle)

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 8R-UX4: idle threshold is now per-supply, derived from
// `ingredients.shelf_life_days_<storage>` at IDLE_PERCENTAGE with an
// IDLE_FLOOR_DAYS floor. IDLE_FALLBACK_DAYS kicks in when shelf-life data
// is unavailable (no ingredient, or null shelf-life column for the supply's
// storage). The 40% / 14d / 1d numbers are best-guess for F&F — see
// DEFERRED_WORK item "Idle threshold tuning — 40% is a guess."
const IDLE_PERCENTAGE = 0.4;
const IDLE_FALLBACK_DAYS = 14;
const IDLE_FLOOR_DAYS = 1;

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / ONE_DAY_MS);
}

function daysSinceIso(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / ONE_DAY_MS));
}

/**
 * 8R-UX4: per-supply idle threshold derived from the ingredient's
 * shelf_life_days_<storage> at IDLE_PERCENTAGE (40%) with a 1-day floor.
 * Falls back to a flat 14 days when shelf-life data is missing (no
 * ingredient, or null shelf-life column for this storage). Only fridge and
 * freezer storage are in scope today; counter / pantry / garden don't get
 * an "idle" signal (Sitting Idle is a cold-storage concept).
 */
function getIdleThresholdDays(s: SupplyWithTags): number {
  const ingredient = s.ingredient;
  if (!ingredient) return IDLE_FALLBACK_DAYS;
  let shelfLife: number | null = null;
  switch (s.storage_location) {
    case 'fridge':
      shelfLife = ingredient.shelf_life_days_fridge ?? null;
      break;
    case 'freezer':
      shelfLife = ingredient.shelf_life_days_freezer ?? null;
      break;
    default:
      return IDLE_FALLBACK_DAYS;
  }
  if (shelfLife === null) return IDLE_FALLBACK_DAYS;
  return Math.max(IDLE_FLOOR_DAYS, Math.ceil(shelfLife * IDLE_PERCENTAGE));
}

/**
 * Returns the ISO timestamp representing "when did the user last confirm
 * engagement with this supply" — the idle freshness signal.
 *
 *   • lot-tracked → oldest active lot's `acquired_at` (physical-age signal,
 *     deliberately distinct from the behavioral-engagement signal — see
 *     DEFERRED_WORK item "Extend last_confirmed_at signal to lot-tracked
 *     supplies post-F&F").
 *   • lot-tracked with NO active lots → supplies.last_confirmed_at
 *     (behavioral fallback).
 *   • non-lot → supplies.last_confirmed_at. Replaces the previous
 *     MAX(created_at, updated_at) proxy, which bumped on every metadata
 *     edit (tag changes, notes) and produced a noisy idle signal.
 *
 * The bumper set is canonical in lib/services/suppliesService.ts under
 * CONFIRMING_FUNCTIONS_REFERENCE.
 */
function getIdleSinceIso(s: SupplyWithTags): string | null {
  if (s.tracks_lots) {
    const active = (s.lots ?? []).filter((l) => l.consumed_at === null);
    if (active.length === 0) return s.last_confirmed_at;
    return active.reduce(
      (oldest, l) => (l.acquired_at < oldest ? l.acquired_at : oldest),
      active[0].acquired_at
    );
  }
  return s.last_confirmed_at;
}

/**
 * Whether a supply qualifies for the Use Soon "back of the fridge" /
 * "freezer burn" sub-lists. Storage_location gates which items are in
 * scope; the idleSince signal (last_confirmed_at, or oldest lot
 * acquired_at for lot-tracked) decides whether enough time has passed
 * relative to the per-supply threshold (40% of shelf life, fallback 14d).
 */
function isIdleCold(s: SupplyWithTags): boolean {
  if (s.archived_at !== null) return false;
  // 8R-UX1: 'out' items have no physical thing in the fridge — they're done,
  // not idle. Same reasoning for 'unknown' (no state, shouldn't surface here).
  if (s.status === 'out' || s.status === 'unknown') return false;
  if (s.storage_location !== 'fridge' && s.storage_location !== 'freezer') {
    return false;
  }
  const iso = getIdleSinceIso(s);
  if (!iso) return false;
  return daysSinceIso(iso) >= getIdleThresholdDays(s);
}

function urgencyForExpiring(supply: SupplyWithTags): UrgencyContext {
  const iso = supply.lot_aggregate?.oldest_expiration;
  if (!iso) {
    // has_expiring_soon=true but no oldest_expiration is unexpected; treat as
    // amber so the row still reads urgent.
    return { color: '#F59E0B', label: 'soon' };
  }
  const days = daysUntil(iso);
  if (days < 0) return { color: '#DC2626', label: 'Past' };
  if (days === 0) return { color: '#DC2626', label: 'Today' };
  if (days === 1) return { color: '#DC2626', label: '1d' };
  if (days === 2) return { color: '#EA580C', label: '2d' };
  if (days <= 4) return { color: '#F59E0B', label: `${days}d` };
  return { color: '#CA8A04', label: `${days}d` };
}

function urgencyForIdle(supply: SupplyWithTags): UrgencyContext {
  const iso = getIdleSinceIso(supply) ?? supply.updated_at;
  const days = daysSinceIso(iso);
  if (days >= 60) return { color: '#EA580C', label: `${days}d idle` };
  if (days >= 30) return { color: '#F59E0B', label: `${days}d idle` };
  return { color: '#CA8A04', label: `${days}d idle` };
}

function UseSoonSubHeader({
  icon,
  title,
  count,
  isOpen,
  onPress,
  styles,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  isOpen: boolean;
  onPress: () => void;
  styles: ReturnType<typeof StyleSheet.create>;
}) {
  return (
    <TouchableOpacity
      style={styles.useSoonSubHeader}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${count} items, ${isOpen ? 'tap to collapse' : 'tap to expand'}`}
    >
      <View style={styles.useSoonSubLeft}>
        {icon}
        <Text style={styles.useSoonSubTitle}>{title}</Text>
      </View>
      <View style={styles.useSoonSubRight}>
        <Text style={styles.useSoonSubCount}>{count}</Text>
        <Text style={styles.useSoonSubChevron}>{isOpen ? '▾' : '▸'}</Text>
      </View>
    </TouchableOpacity>
  );
}

function UseSoonContent({
  expiringSupplies,
  fridgeIdleSupplies,
  freezerIdleSupplies,
  renderRow,
  subOpen,
  onToggleSub,
  styles,
  iconColor,
}: {
  expiringSupplies: SupplyWithTags[];
  fridgeIdleSupplies: SupplyWithTags[];
  freezerIdleSupplies: SupplyWithTags[];
  renderRow: (s: SupplyWithTags, urgency: UrgencyContext) => React.ReactElement;
  subOpen: { expiring: boolean; fridge: boolean; freezer: boolean };
  onToggleSub: (key: 'expiring' | 'fridge' | 'freezer') => void;
  styles: ReturnType<typeof StyleSheet.create>;
  iconColor: string;
}) {
  // 8R-UX1: renderRow itself wraps each SupplyRow in SwipeableRow now (so
  // swipe works across all sections, not just Use Soon). UseSoonContent no
  // longer needs its own wrap.
  return (
    <View>
      {expiringSupplies.length > 0 && (
        <View>
          <UseSoonSubHeader
            icon={<TimerIcon size={16} color={iconColor} />}
            title="Expiring soon"
            count={expiringSupplies.length}
            isOpen={subOpen.expiring}
            onPress={() => onToggleSub('expiring')}
            styles={styles}
          />
          {subOpen.expiring &&
            expiringSupplies.map((s) => renderRow(s, urgencyForExpiring(s)))}
        </View>
      )}
      {fridgeIdleSupplies.length > 0 && (
        <View>
          <UseSoonSubHeader
            icon={<FridgeIcon size={18} color={iconColor} />}
            title="Back of the fridge"
            count={fridgeIdleSupplies.length}
            isOpen={subOpen.fridge}
            onPress={() => onToggleSub('fridge')}
            styles={styles}
          />
          {subOpen.fridge &&
            fridgeIdleSupplies.map((s) => renderRow(s, urgencyForIdle(s)))}
        </View>
      )}
      {freezerIdleSupplies.length > 0 && (
        <View>
          <UseSoonSubHeader
            icon={<ColdIcon size={18} color={iconColor} />}
            title="Collecting freezer burn"
            count={freezerIdleSupplies.length}
            isOpen={subOpen.freezer}
            onPress={() => onToggleSub('freezer')}
            styles={styles}
          />
          {subOpen.freezer &&
            freezerIdleSupplies.map((s) => renderRow(s, urgencyForIdle(s)))}
        </View>
      )}
      <Text style={styles.dualListingNote}>
        Swipe right to mark used · swipe left to mark out
      </Text>
    </View>
  );
}

// ============================================
// CATEGORIZED SUB-SECTIONS — within Regulars / On Hand
// ============================================

function CategorizedSubsections({
  top: _top,
  supplies,
  openSubKey,
  onTapSub,
  renderRow,
  styles,
  forceOpen,
  groupBy,
  flattenByType,
}: {
  top: 'restock' | 'track_only';
  supplies: SupplyWithTags[];
  openSubKey: string | null;
  onTapSub: (key: string) => void;
  renderRow: (s: SupplyWithTags, family: string) => React.ReactElement;
  styles: ReturnType<typeof StyleSheet.create>;
  /**
   * CP6e-SmokeFix-SF2-followup (2026-05-14): when true (active search),
   * every category sub-section renders its contents regardless of
   * `openSubKey`. The user's manual expansion state stays intact under
   * the hood; clearing the search restores it.
   */
  forceOpen?: boolean;
  /** 8R-UX1: 'family' (default), 'type' (subfamily), or 'storage'. */
  groupBy: 'family' | 'type' | 'storage';
  /**
   * 8R-UX1 continuation: when true (active family-tab in Type mode), render
   * type subgroups directly without family wrappers — the tab IS the family
   * context. Supplies are pre-filtered to a single family by the parent.
   */
  flattenByType?: boolean;
}) {
  // 8R-UX1: type mode renders a true two-level hierarchy: family header
  // (Dairy / Produce / Proteins / ...) with type subgroups (Cheese / Yogurt
  // / Vegetable / ...) nested below. Other modes stay flat.
  // 8R-UX1 continuation: flattenByType skips the family header (single-family
  // context from the tab strip → no need for the redundant wrapper).
  if (groupBy === 'type') {
    const families = groupByFamilyThenType(supplies);
    if (flattenByType) {
      // Single-family branch: there should only be one entry in `families`
      // because supplies were pre-filtered. Render its types flat.
      const fam = families[0];
      if (!fam) return null;
      return (
        <View>
          {fam.types.map((t) => {
            const composite = `${fam.familyKey}::${t.key}`;
            return (
              <CategorySubsection
                key={composite}
                subKey={composite}
                label={t.label}
                items={t.items}
                isOpen={openSubKey === composite}
                forceOpen={forceOpen}
                onTap={() => onTapSub(composite)}
                renderRow={(s) => renderRow(s, composite)}
                styles={styles}
              />
            );
          })}
        </View>
      );
    }
    return (
      <View>
        {families.map((fam) => (
          <View key={fam.familyKey}>
            <View style={styles.familyHeader}>
              <Text style={styles.familyHeaderText}>{fam.familyLabel}</Text>
              <Text style={styles.familyHeaderCount}>{fam.totalCount}</Text>
            </View>
            {fam.types.map((t) => {
              const composite = `${fam.familyKey}::${t.key}`;
              return (
                <CategorySubsection
                  key={composite}
                  subKey={composite}
                  label={t.label}
                  items={t.items}
                  isOpen={openSubKey === composite}
                  forceOpen={forceOpen}
                  onTap={() => onTapSub(composite)}
                  renderRow={(s) => renderRow(s, composite)}
                  styles={styles}
                />
              );
            })}
          </View>
        ))}
      </View>
    );
  }

  const groups = groupByCategory(supplies, groupBy);
  return (
    <View>
      {groups.map(({ key, label, items }) => (
        <CategorySubsection
          key={key}
          subKey={key}
          label={label}
          items={items}
          isOpen={openSubKey === key}
          forceOpen={forceOpen}
          onTap={() => onTapSub(key)}
          renderRow={(s) => renderRow(s, key)}
          styles={styles}
          largeHeader
        />
      ))}
    </View>
  );
}

function CategorySubsection({
  subKey: _subKey,
  label,
  items,
  isOpen,
  forceOpen,
  onTap,
  renderRow,
  styles,
  largeHeader,
}: {
  subKey: string;
  label: string;
  items: SupplyWithTags[];
  isOpen: boolean;
  /** CP6e-SmokeFix-SF2-followup: when true, content renders regardless of `isOpen`. */
  forceOpen?: boolean;
  onTap: () => void;
  renderRow: (s: SupplyWithTags) => React.ReactElement;
  styles: ReturnType<typeof StyleSheet.create>;
  /**
   * 8R-UX1: when true, the section header uses the larger family-header
   * styling (uppercase / semibold). Used for top-level groups in Family and
   * Storage modes. False (default) keeps the compact subHeader used for
   * type-mode's nested type subgroups.
   */
  largeHeader?: boolean;
}) {
  const [prevCount, setPrevCount] = useState(items.length);
  const [pulse] = useState(() => new Animated.Value(1));
  const effectivelyOpen = isOpen || forceOpen === true;

  useEffect(() => {
    if (items.length > prevCount && !effectivelyOpen) {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 180, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
    setPrevCount(items.length);
  }, [items.length, effectivelyOpen, pulse, prevCount]);

  return (
    <View>
      <TouchableOpacity
        style={largeHeader ? styles.familyHeader : styles.subHeader}
        onPress={onTap}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label} category, ${items.length} items`}
      >
        <Text
          style={largeHeader ? styles.familyHeaderText : styles.subTitle}
        >
          {label} {effectivelyOpen ? '▾' : '▸'}
        </Text>
        <Animated.Text
          style={[
            largeHeader ? styles.familyHeaderCount : styles.subCount,
            { transform: [{ scale: pulse }] },
          ]}
        >
          {items.length}
        </Animated.Text>
      </TouchableOpacity>
      {effectivelyOpen && items.map(renderRow)}
    </View>
  );
}

// ============================================
// SELECTION WRAPPER + ACTION BAR (8R-UX1)
// ============================================

function SelectionRowWrapper({
  children,
  isSelected,
  onPress,
  styles,
  primaryColor,
}: {
  children: React.ReactNode;
  isSelected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof StyleSheet.create>;
  primaryColor: string;
}) {
  // Touchable wraps the entire row. The inner SupplyRow's internal
  // Touchables don't fire because we're capturing the press at the outer
  // level via TouchableWithoutFeedback's child taking priority.
  // Note: this disables expand/cycle/long-press while in selection mode by
  // design — selection mode is exclusive.
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.selectionRowOuter,
        isSelected && { borderColor: primaryColor },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
    >
      <View style={styles.selectionRowCheckCol}>
        <View
          style={[
            styles.selectionCheckbox,
            isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
          ]}
        >
          {isSelected && <Text style={styles.selectionCheckmark}>✓</Text>}
        </View>
      </View>
      <View style={styles.selectionRowContentCol} pointerEvents="none">
        {children}
      </View>
    </TouchableOpacity>
  );
}

function SelectionActionBar({
  selectedCount,
  actioning,
  onMarkInStock,
  onMarkOut,
  onAddToGrocery,
  onCancel,
  styles,
}: {
  selectedCount: number;
  actioning: boolean;
  onMarkInStock: () => void;
  onMarkOut: () => void;
  onAddToGrocery: () => void;
  onCancel: () => void;
  styles: ReturnType<typeof StyleSheet.create>;
}) {
  const disabled = selectedCount === 0 || actioning;
  return (
    <View style={styles.actionBar}>
      <View style={styles.actionBarTopRow}>
        <Text style={styles.actionBarCount}>
          {selectedCount} selected
        </Text>
        <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.actionBarCancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actionBarButtonsRow}>
        <TouchableOpacity
          style={[styles.actionBarButton, disabled && styles.actionBarButtonDisabled]}
          onPress={onMarkInStock}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.actionBarButtonText}>Mark in stock</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBarButton, disabled && styles.actionBarButtonDisabled]}
          onPress={onMarkOut}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.actionBarButtonText}>Mark out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBarButton, disabled && styles.actionBarButtonDisabled]}
          onPress={onAddToGrocery}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.actionBarButtonText}>Add to list</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// TOGGLE PILLS (8R-UX1)
// ============================================

function GroupByPill({
  groupBy,
  onChange,
  styles,
}: {
  groupBy: 'family' | 'type' | 'storage';
  onChange: (mode: 'family' | 'type' | 'storage') => void;
  styles: ReturnType<typeof StyleSheet.create>;
}) {
  return (
    <View style={styles.groupByPill}>
      {(['family', 'type', 'storage'] as const).map((mode) => {
        const isOn = groupBy === mode;
        const label =
          mode === 'family' ? 'Family' : mode === 'type' ? 'Type' : 'Storage';
        return (
          <TouchableOpacity
            key={mode}
            style={[styles.groupByPillButton, isOn && styles.groupByPillButtonOn]}
            onPress={() => onChange(mode)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Group by ${mode}`}
          >
            <Text
              style={[styles.groupByPillText, isOn && styles.groupByPillTextOn]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SplitMergePill({
  merged,
  onChange,
  styles,
}: {
  merged: boolean;
  onChange: (next: boolean) => void;
  styles: ReturnType<typeof StyleSheet.create>;
}) {
  return (
    <View style={styles.groupByPill}>
      {([false, true] as const).map((value) => {
        const isOn = merged === value;
        const label = value ? 'Merged' : 'Split';
        return (
          <TouchableOpacity
            key={String(value)}
            style={[styles.groupByPillButton, isOn && styles.groupByPillButtonOn]}
            onPress={() => onChange(value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              value ? 'Merge On Hand and Regulars' : 'Split On Hand and Regulars'
            }
          >
            <Text
              style={[styles.groupByPillText, isOn && styles.groupByPillTextOn]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ============================================
// FAMILY TAB STRIP (8R-UX1 continuation)
// ============================================

function FamilyTabStrip({
  tabs,
  activeInnerFilter,
  onSelect,
  heroCount,
  showHeroPill,
  styles,
  colors,
}: {
  tabs: Array<{ key: string; label: string; count: number }>;
  activeInnerFilter: ActiveInnerFilter;
  onSelect: (next: ActiveInnerFilter) => void;
  // 8R-UX5: count of supplies in the active outer-tab universe that qualify
  // as heroes. Zero = pill not rendered. Only rendered when showHeroPill
  // is true (everything + use_soon tabs; never on low_out per spec).
  heroCount: number;
  showHeroPill: boolean;
  styles: ReturnType<typeof StyleSheet.create>;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const renderChip = (
    key: string | null,
    label: string,
    count: number | null,
    isActive: boolean,
    onPress: () => void,
    leadingIcon?: React.ReactElement
  ) => (
    <TouchableOpacity
      key={key ?? '__all__'}
      style={[styles.familyTabChip, isActive && styles.familyTabChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${label}${count !== null ? `, ${count}` : ''} filter`}
    >
      {leadingIcon && <View style={styles.familyTabChipIcon}>{leadingIcon}</View>}
      <Text
        style={[
          styles.familyTabChipText,
          isActive && styles.familyTabChipTextActive,
        ]}
      >
        {label}
        {count !== null ? ` ${count}` : ''}
      </Text>
    </TouchableOpacity>
  );
  const totalCount = tabs.reduce((acc, t) => acc + t.count, 0);
  const isAllActive = activeInnerFilter.kind === 'all';
  const isHeroActive = activeInnerFilter.kind === 'hero';
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.familyTabScroll}
      contentContainerStyle={styles.familyTabScrollContent}
    >
      {renderChip(null, 'All', totalCount, isAllActive, () =>
        onSelect({ kind: 'all' })
      )}
      {showHeroPill && heroCount > 0 &&
        renderChip(
          '__hero__',
          'Heroes',
          heroCount,
          isHeroActive,
          () => onSelect(isHeroActive ? { kind: 'all' } : { kind: 'hero' }),
          <LightningBoltIcon size={12} color={isHeroActive ? '#ffffff' : colors.primary} />
        )}
      {tabs.map((t) => {
        const isFamilyActive =
          activeInnerFilter.kind === 'family' && activeInnerFilter.familyKey === t.key;
        return renderChip(
          t.key,
          t.label,
          t.count,
          isFamilyActive,
          () =>
            onSelect(
              isFamilyActive
                ? { kind: 'all' }
                : { kind: 'family', familyKey: t.key }
            )
        );
      })}
    </ScrollView>
  );
}

// ============================================
// HELPERS
// ============================================

function familyKeyForSupply(s: SupplyWithTags): { key: string; label: string } {
  const family = s.ingredient?.family;
  if (family && family.trim().length > 0) {
    return { key: family.toLowerCase(), label: titleCase(family) };
  }
  return { key: '__other__', label: 'Other' };
}

// 8R-UX1: storage-location grouping for the On Hand / Regulars "Storage"
// view. Null storage_location falls back to "Other" — matches the existing
// fallback semantics for missing family.
function storageKeyForSupply(s: SupplyWithTags): { key: string; label: string } {
  switch (s.storage_location) {
    case 'fridge':
      return { key: 'fridge', label: 'Fridge' };
    case 'freezer':
      return { key: 'freezer', label: 'Freezer' };
    case 'pantry':
      return { key: 'pantry', label: 'Pantry' };
    case 'counter':
      return { key: 'counter', label: 'Counter' };
    case 'garden':
      return { key: 'garden', label: 'Garden' };
    default:
      return { key: '__other__', label: 'Other' };
  }
}

// 8R-UX1: subfamily-only grouping helper. Type mode now renders as a true
// two-level hierarchy (family headers with type subgroups nested below), so
// this returns just the type slug + a display label. groupByFamilyThenType
// composes this with the family resolver.
function typeKeyForSupply(s: SupplyWithTags): { key: string; label: string } {
  const type = s.ingredient?.ingredient_type;
  if (type && type.trim().length > 0) {
    return { key: type.toLowerCase(), label: titleCase(type.replace(/_/g, ' ')) };
  }
  return { key: '__no_type__', label: '(no type)' };
}

// 8R-UX1: nested grouping for type mode. Returns an outer family list, each
// containing its types and items. Sorts families by name and types within
// each family by count desc then alphabetical.
function groupByFamilyThenType(supplies: SupplyWithTags[]): Array<{
  familyKey: string;
  familyLabel: string;
  totalCount: number;
  types: Array<{ key: string; label: string; items: SupplyWithTags[] }>;
}> {
  const families = new Map<
    string,
    { familyKey: string; familyLabel: string; typeBuckets: Map<string, { key: string; label: string; items: SupplyWithTags[] }> }
  >();
  for (const s of supplies) {
    const { key: famKey, label: famLabel } = familyKeyForSupply(s);
    const { key: typeKey, label: typeLabel } = typeKeyForSupply(s);
    let fam = families.get(famKey);
    if (!fam) {
      fam = {
        familyKey: famKey,
        familyLabel: famLabel,
        typeBuckets: new Map(),
      };
      families.set(famKey, fam);
    }
    let typeBucket = fam.typeBuckets.get(typeKey);
    if (!typeBucket) {
      typeBucket = { key: typeKey, label: typeLabel, items: [] };
      fam.typeBuckets.set(typeKey, typeBucket);
    }
    typeBucket.items.push(s);
  }

  const result = Array.from(families.values()).map((fam) => {
    const types = Array.from(fam.typeBuckets.values()).sort((a, b) => {
      if (a.key === '__no_type__') return 1;
      if (b.key === '__no_type__') return -1;
      if (a.items.length !== b.items.length) return b.items.length - a.items.length;
      return a.label.localeCompare(b.label);
    });
    for (const t of types) {
      t.items.sort((a, b) => {
        const aName = (a.ingredient?.name ?? a.custom_name ?? '').toLowerCase();
        const bName = (b.ingredient?.name ?? b.custom_name ?? '').toLowerCase();
        return aName.localeCompare(bName);
      });
    }
    return {
      familyKey: fam.familyKey,
      familyLabel: fam.familyLabel,
      totalCount: types.reduce((sum, t) => sum + t.items.length, 0),
      types,
    };
  });

  result.sort((a, b) => {
    if (a.familyKey === '__other__') return 1;
    if (b.familyKey === '__other__') return -1;
    if (a.totalCount !== b.totalCount) return b.totalCount - a.totalCount;
    return a.familyLabel.localeCompare(b.familyLabel);
  });

  return result;
}

// Fixed display order for storage buckets — cold first, then dry, then
// ambient, then unknown. Ignores count so the cold sections always lead.
const STORAGE_DISPLAY_ORDER: Record<string, number> = {
  fridge: 0,
  freezer: 1,
  pantry: 2,
  counter: 3,
  garden: 4,
  __other__: 99,
};

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function groupByCategory(
  supplies: SupplyWithTags[],
  mode: 'family' | 'storage' | 'type' = 'family'
): Array<{ key: string; label: string; items: SupplyWithTags[] }> {
  const keyFn =
    mode === 'storage'
      ? storageKeyForSupply
      : mode === 'type'
      ? typeKeyForSupply
      : familyKeyForSupply;
  const buckets = new Map<string, { key: string; label: string; items: SupplyWithTags[] }>();
  for (const s of supplies) {
    const { key, label } = keyFn(s);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, label, items: [] };
      buckets.set(key, bucket);
    }
    bucket.items.push(s);
  }
  const arr = Array.from(buckets.values());
  if (mode === 'storage') {
    arr.sort((a, b) => {
      const ao = STORAGE_DISPLAY_ORDER[a.key] ?? 99;
      const bo = STORAGE_DISPLAY_ORDER[b.key] ?? 99;
      if (ao !== bo) return ao - bo;
      return a.label.localeCompare(b.label);
    });
  } else {
    // family (and any other flat mode): sort by count desc, then label asc;
    // '__other__' bottoms out. Type mode is handled separately via
    // groupByFamilyThenType + the nested renderer.
    arr.sort((a, b) => {
      if (a.key === '__other__') return 1;
      if (b.key === '__other__') return -1;
      if (a.items.length !== b.items.length) return b.items.length - a.items.length;
      return a.label.localeCompare(b.label);
    });
  }
  for (const bucket of arr) {
    bucket.items.sort((a, b) => {
      const aName = (a.ingredient?.name ?? a.custom_name ?? '').toLowerCase();
      const bName = (b.ingredient?.name ?? b.custom_name ?? '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }
  return arr;
}

// CP6d-SmokeFix-2 Task 3: search predicate matches across name, plural_name,
// family, and ingredient_type so users can type a category ("spices") or a
// loose category-ish term ("cheese") and surface relevant supplies.
/**
 * LEGACY (CP6e-FlowsUI-b2): client-side substring match across name /
 * plural / family / ingredient_type. Replaced by server-side
 * `searchSuppliesServerSide` for the main supplies filter, but kept here as
 * fallback / reference + still used by the imperative-handle search probes
 * (`hasExactMatch`, `getFilteredFamilyCount`) which operate on the local
 * snapshot before any search debounce settles. Don't delete without
 * checking those callers.
 */
function supplyMatchesQuery(s: SupplyWithTags, q: string): boolean {
  const lower = q.toLowerCase();
  const name = (s.ingredient?.name ?? s.custom_name ?? '').toLowerCase();
  if (name.includes(lower)) return true;
  const plural = (s.ingredient?.plural_name ?? '').toLowerCase();
  if (plural && plural.includes(lower)) return true;
  const family = (s.ingredient?.family ?? '').toLowerCase();
  if (family && family.includes(lower)) return true;
  const itype = (s.ingredient?.ingredient_type ?? '').toLowerCase();
  if (itype && itype.includes(lower)) return true;
  return false;
}

function sortSupplies(list: SupplyWithTags[]): SupplyWithTags[] {
  return [...list].sort((a, b) => {
    const statusDiff = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;
    const aName = (a.ingredient?.name ?? a.custom_name ?? '').toLowerCase();
    const bName = (b.ingredient?.name ?? b.custom_name ?? '').toLowerCase();
    return aName.localeCompare(bName);
  });
}

/**
 * CP6e-FlowsUI-b2: sort within sections by RPC ts_rank DESC during active
 * search. Name-localeCompare as tiebreaker. Supplies missing from the rank
 * map (shouldn't happen post-filter, but defensive) sort to the end.
 */
function sortSuppliesByRank(
  list: SupplyWithTags[],
  rankMap: Map<string, SupplySearchMatch>
): SupplyWithTags[] {
  return [...list].sort((a, b) => {
    const rankA = rankMap.get(a.id)?.rank ?? -1;
    const rankB = rankMap.get(b.id)?.rank ?? -1;
    if (rankB !== rankA) return rankB - rankA;
    const aName = (a.ingredient?.name ?? a.custom_name ?? '').toLowerCase();
    const bName = (b.ingredient?.name ?? b.custom_name ?? '').toLowerCase();
    return aName.localeCompare(bName);
  });
}
