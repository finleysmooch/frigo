// ============================================
// FRIGO — LOTS LIST (Phase 8R-CP6e-PantryUI-a)
// ============================================
// Renders an active-lots list inside the SupplyRow expand panel's lots
// collapser. D8R-Q50: when ≥2 distinct variant_labels exist among the lots,
// renders collapsible variant sub-groups (each defaulting to closed per
// wireframe Tab 3a). Otherwise, flat list.
//
// Ordering within each group (and within the flat list): expires_at ASC
// NULLS LAST, then acquired_at ASC. Mirrors lotsService.getLotsForSupply
// + cookDepletion oldest-first draw — UI ordering matches depletion order.
//
// Visual reference: wireframe v2 Tab 3 (.lot-variant-group / .lots-list).
// Location: components/pantry/LotsList.tsx
// ============================================

import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { borderRadius, spacing, typography } from '../../lib/theme';
import type { SupplyLot } from '../../lib/types/supplies';
import { filterLotsBySearch } from '../../lib/utils/lotSearch';
import LotRow from './LotRow';

// D8R-Q51: search-within-lots affordance kicks in at 4+ lots.
const SEARCH_THRESHOLD = 4;

export interface LotsListProps {
  lots: SupplyLot[];                  // active only; caller filters consumed_at IS NULL
  onLotTap?: (lot: SupplyLot) => void; // -a: undefined; -b: opens lot edit modal
  /**
   * CP6e-FlowsUI-b2: when present, lots whose IDs are in this set render
   * with a soft background tint to indicate they contributed to a server-
   * side search match. Undefined → no highlighting (non-search mode).
   */
  matchedLotIds?: Set<string>;
}

const UNLABELED_KEY = '__unlabeled__';

interface VariantGroup {
  key: string;
  label: string;          // display label; "Unlabeled" for null variant_label
  lots: SupplyLot[];
  totalQty: number;
  unit: string | null;    // null when group spans multiple units
  oldestExp: string | null;
}

function sortLots(lots: SupplyLot[]): SupplyLot[] {
  return [...lots].sort((a, b) => {
    const ae = a.expires_at;
    const be = b.expires_at;
    if (ae === null && be === null) {
      return a.acquired_at.localeCompare(b.acquired_at);
    }
    if (ae === null) return 1;  // NULLS LAST
    if (be === null) return -1;
    const cmp = ae.localeCompare(be);
    if (cmp !== 0) return cmp;
    return a.acquired_at.localeCompare(b.acquired_at);
  });
}

function buildVariantGroups(lots: SupplyLot[]): VariantGroup[] {
  const buckets = new Map<string, SupplyLot[]>();
  for (const lot of lots) {
    const k = lot.variant_label && lot.variant_label.trim().length > 0
      ? lot.variant_label.trim()
      : UNLABELED_KEY;
    const arr = buckets.get(k);
    if (arr) arr.push(lot);
    else buckets.set(k, [lot]);
  }

  const groups: VariantGroup[] = [];
  for (const [key, groupLots] of buckets) {
    const sorted = sortLots(groupLots);
    let total = 0;
    let unit: string | null = sorted[0]?.quantity_unit ?? null;
    let mixed = false;
    for (const l of sorted) {
      total += l.quantity;
      if (unit !== null && l.quantity_unit !== unit) {
        mixed = true;
      }
    }
    if (mixed) {
      unit = null;
      total = 0;
    }
    let oldest: string | null = null;
    for (const l of sorted) {
      if (l.expires_at === null) continue;
      if (oldest === null || l.expires_at < oldest) oldest = l.expires_at;
    }
    groups.push({
      key,
      label: key === UNLABELED_KEY ? 'Unlabeled' : key,
      lots: sorted,
      totalQty: total,
      unit,
      oldestExp: oldest,
    });
  }

  // Stable order: groups with the soonest oldestExp first, NULLS LAST.
  // Unlabeled always sorts to the bottom.
  groups.sort((a, b) => {
    if (a.key === UNLABELED_KEY && b.key !== UNLABELED_KEY) return 1;
    if (b.key === UNLABELED_KEY && a.key !== UNLABELED_KEY) return -1;
    if (a.oldestExp === null && b.oldestExp === null) {
      return a.label.localeCompare(b.label);
    }
    if (a.oldestExp === null) return 1;
    if (b.oldestExp === null) return -1;
    return a.oldestExp.localeCompare(b.oldestExp);
  });

  return groups;
}

function formatQty(qty: number, unit: string | null): string {
  if (unit === null) return 'mixed';
  if (!Number.isFinite(qty)) return `0 ${unit}`;
  const num = Number.isInteger(qty)
    ? String(qty)
    : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${num} ${unit}`.trim();
}

function formatExp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function LotsList({ lots, onLotTap, matchedLotIds }: LotsListProps) {
  const { colors } = useTheme();

  // CP6e-PantryUI-b: internal search state (Q51 threshold 4+ lots). The
  // input itself only renders when lots.length >= SEARCH_THRESHOLD; below
  // that, scanning is fast enough that filtering UI adds clutter.
  const [searchQuery, setSearchQuery] = useState('');
  const showSearchInput = lots.length >= SEARCH_THRESHOLD;

  const filteredLots = useMemo(
    () => (showSearchInput ? filterLotsBySearch(lots, searchQuery) : lots),
    [lots, searchQuery, showSearchInput]
  );

  // Grouping rules use the FILTERED set so that headers reflect visible rows.
  // `useGrouping` decision is also based on the filtered set — narrowing a
  // search down to one variant should collapse the grouping rather than
  // showing a single-group structure (visually noisy).
  const { useGrouping, flatLots, groups } = useMemo(() => {
    const distinctVariants = new Set<string>();
    let hasUnlabeled = false;
    for (const l of filteredLots) {
      if (l.variant_label && l.variant_label.trim().length > 0) {
        distinctVariants.add(l.variant_label.trim());
      } else {
        hasUnlabeled = true;
      }
    }
    const groupCount = distinctVariants.size + (hasUnlabeled ? 1 : 0);
    const shouldGroup =
      distinctVariants.size >= 2 || (distinctVariants.size >= 1 && hasUnlabeled);
    return {
      useGrouping: shouldGroup && groupCount >= 2,
      flatLots: sortLots(filteredLots),
      groups: shouldGroup && groupCount >= 2 ? buildVariantGroups(filteredLots) : [],
    };
  }, [filteredLots]);

  // Per-variant collapse state — defaults to closed per wireframe Tab 3a.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const searchBar = showSearchInput ? (
    <View style={styles.searchInputRow}>
      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Find within lots…"
        placeholderTextColor={colors.text.tertiary}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search within lots"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity
          onPress={() => setSearchQuery('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.clearSearch}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  // Empty-state for a non-empty query that filtered everything out.
  if (showSearchInput && searchQuery.trim().length > 0 && filteredLots.length === 0) {
    return (
      <View>
        {searchBar}
        <Text style={styles.emptyMatch}>No lots match.</Text>
      </View>
    );
  }

  if (!useGrouping) {
    return (
      <View>
        {searchBar}
        <View style={styles.list}>
          {flatLots.map((lot) => (
            <LotRow
              key={lot.id}
              lot={lot}
              showVariantInline
              onTap={onLotTap ? () => onLotTap(lot) : undefined}
              highlighted={matchedLotIds?.has(lot.id) === true}
            />
          ))}
        </View>
      </View>
    );
  }

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View>
      {searchBar}
      {groups.map((g) => {
        const isOpen = openGroups.has(g.key);
        const qtyExpLine = [
          formatQty(g.totalQty, g.unit),
          g.oldestExp ? `exp ${formatExp(g.oldestExp)}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <View key={g.key} style={styles.variantGroup}>
            <TouchableOpacity
              onPress={() => toggleGroup(g.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${g.label}, ${g.lots.length} lots, ${qtyExpLine}. Tap to ${isOpen ? 'collapse' : 'expand'}.`}
              style={styles.variantHeader}
            >
              <Text style={styles.variantHeaderLeft} numberOfLines={1}>
                {isOpen ? '▾' : '▸'} {g.label} · {g.lots.length}
              </Text>
              {qtyExpLine.length > 0 && (
                <Text style={styles.variantHeaderRight} numberOfLines={1}>
                  {qtyExpLine}
                </Text>
              )}
            </TouchableOpacity>
            {isOpen && (
              <View style={styles.list}>
                {g.lots.map((lot) => (
                  <LotRow
                    key={lot.id}
                    lot={lot}
                    showVariantInline={false}
                    onTap={onLotTap ? () => onLotTap(lot) : undefined}
                    highlighted={matchedLotIds?.has(lot.id) === true}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    list: {
      marginTop: 2,
    },
    variantGroup: {
      marginTop: 6,
    },
    variantHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    variantHeaderLeft: {
      fontSize: 11,
      color: colors.text.secondary,
      fontWeight: typography.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      flexShrink: 1,
    },
    variantHeaderRight: {
      fontSize: 11,
      color: colors.text.tertiary,
      marginLeft: spacing.sm,
    },
    searchInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 4,
      marginBottom: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border.light,
      backgroundColor: colors.background.surface,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
      paddingVertical: 4,
    },
    clearSearch: {
      fontSize: 14,
      color: colors.text.tertiary,
      paddingHorizontal: 4,
    },
    emptyMatch: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      paddingVertical: 12,
      textAlign: 'center',
    },
  });
}
