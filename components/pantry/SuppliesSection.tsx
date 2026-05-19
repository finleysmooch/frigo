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

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { typography, spacing, borderRadius } from '../../lib/theme';
import SupplyRow from './SupplyRow';
import { useSpawnOnOutToast } from '../../contexts/SpawnOnOutToastContext';
import { useCookDepletionBanner } from '../../contexts/CookDepletionBannerContext';
import { RegularBookmarkIcon } from './BookmarkIcons';

const STATUS_SORT_PRIORITY: Record<SupplyStatus, number> = {
  out: 0,
  critical: 1,
  low: 2,
  in_stock: 3,
};

// Single source of truth for "which expanded body is visible." Tapping any
// top/sub header sets this; opening one section closes the others.
type ExpandedSection =
  | { kind: 'attention' }
  | { kind: 'sub'; top: 'restock' | 'track_only'; key: string }
  | null;

export interface SuppliesSectionRef {
  hasExactMatch: (q: string) => boolean;
  /**
   * CP6d-SmokeFix-2: count of distinct ingredient.family values that contain
   * at least one supply matching the query. Drives the "Found in N
   * categories" recommendations hint in PantrySearchBar.
   */
  getFilteredFamilyCount: (q: string) => number;
}

export interface SuppliesSectionProps {
  spaceId: string | null;
  refreshTrigger?: number;
  searchQuery?: string;
  onOpenDetail?: (supply: SupplyWithTags) => void;
  onAddNewTap: () => void;
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
    },
    ref
  ) {
    const { colors } = useTheme();
    const { showToast } = useSpawnOnOutToast();
    const { currentBanner } = useCookDepletionBanner();
    const [supplies, setSupplies] = useState<SupplyWithTags[]>([]);
    const [loading, setLoading] = useState(false);

    // Single source of truth — at most one expanded body visible.
    const [expandedSection, setExpandedSection] = useState<ExpandedSection>(
      { kind: 'attention' }
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
      }),
      [supplies]
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
          subHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
            marginBottom: 2,
            paddingVertical: 4,
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
    const restockAll = searchActive
      ? sortSuppliesByRank(restockAllRaw, serverSearchResults)
      : restockAllRaw;
    const trackOnlyAll = searchActive
      ? sortSuppliesByRank(trackOnlyAllRaw, serverSearchResults)
      : trackOnlyAllRaw;

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
      trackOnlyAll.length === 0
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

    // CP6e-SmokeFix-SF2-followup (2026-05-14): during active search, force-
    // expand all top sections + sub-categories so every match is visible
    // without nested folder taps. User's manual expansion state
    // (`expandedSection`) is preserved underneath — when the query clears,
    // sections collapse back to whatever was open before.
    const isAttentionOpen =
      expandedSection?.kind === 'attention' || searchActive;
    const openSubKey = (top: 'restock' | 'track_only'): string | null =>
      expandedSection?.kind === 'sub' && expandedSection.top === top
        ? expandedSection.key
        : null;

    const tapAttention = () => {
      setExpandedSection((prev) =>
        prev?.kind === 'attention' ? null : { kind: 'attention' }
      );
    };
    const tapSub = (top: 'restock' | 'track_only', key: string) => {
      setExpandedSection((prev) =>
        prev?.kind === 'sub' && prev.top === top && prev.key === key
          ? null
          : { kind: 'sub', top, key }
      );
    };

    const renderRow = (supply: SupplyWithTags, keySuffix?: string) => (
      <SupplyRow
        key={`${supply.id}${keySuffix ?? ''}`}
        supply={supply}
        expanded={expandedSupplyId === `${supply.id}${keySuffix ?? ''}`}
        onToggleExpanded={() => handleToggleExpandedSupply(`${supply.id}${keySuffix ?? ''}`)}
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
      />
    );

    return (
      <View style={styles.container}>
        {/* CP6e-FlowsUI-b2: server-search error banner — shows when search
            failed but we still have prior results to display. Non-blocking. */}
        {serverSearchError && (
          <View style={styles.searchErrorBanner}>
            <Text style={styles.searchErrorText}>{serverSearchError}</Text>
          </View>
        )}
        {/* Attention */}
        {attentionSupplies.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.topHeader}
              onPress={tapAttention}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Attention section, ${attentionSupplies.length} items`}
            >
              <Text style={styles.topTitle}>Attention</Text>
              <View style={styles.topRight}>
                <Text style={styles.topCount}>{attentionSupplies.length}</Text>
                <Text style={styles.topChevron}>{isAttentionOpen ? '▾' : '▸'}</Text>
              </View>
            </TouchableOpacity>
            {isAttentionOpen && (
              <AttentionContent
                attentionSupplies={attentionSupplies}
                renderRow={(s) => renderRow(s, ':attn')}
                styles={styles}
              />
            )}
          </>
        )}

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
            />
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
}) {
  const groups = useMemo(() => groupByCategory(supplies), [supplies]);

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
        style={styles.subHeader}
        onPress={onTap}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label} category, ${items.length} items`}
      >
        <Text style={styles.subTitle}>
          {label} {effectivelyOpen ? '▾' : '▸'}
        </Text>
        <Animated.Text style={[styles.subCount, { transform: [{ scale: pulse }] }]}>
          {items.length}
        </Animated.Text>
      </TouchableOpacity>
      {effectivelyOpen && items.map(renderRow)}
    </View>
  );
}

// ============================================
// HELPERS
// ============================================

function categoryKeyForSupply(s: SupplyWithTags): { key: string; label: string } {
  const family = s.ingredient?.family;
  if (family && family.trim().length > 0) {
    return { key: family.toLowerCase(), label: titleCase(family) };
  }
  return { key: '__other__', label: 'Other' };
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function groupByCategory(
  supplies: SupplyWithTags[]
): Array<{ key: string; label: string; items: SupplyWithTags[] }> {
  const buckets = new Map<string, { key: string; label: string; items: SupplyWithTags[] }>();
  for (const s of supplies) {
    const { key, label } = categoryKeyForSupply(s);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, label, items: [] };
      buckets.set(key, bucket);
    }
    bucket.items.push(s);
  }
  const arr = Array.from(buckets.values());
  arr.sort((a, b) => {
    if (a.key === '__other__') return 1;
    if (b.key === '__other__') return -1;
    if (a.items.length !== b.items.length) return b.items.length - a.items.length;
    return a.label.localeCompare(b.label);
  });
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
