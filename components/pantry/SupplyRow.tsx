// ============================================
// FRIGO — SUPPLY ROW (Phase 8R-CP6e-PantryUI-a)
// ============================================
// Compact pantry row with left-bar accent. CP6e-PantryUI-a layers lot-aware
// rendering on top of the CP6d-SmokeFix-1 row:
//   • Non-lots supplies (tracks_lots=false): StatusIcon vertical-battery fill
//     (0–4); tap cycles 4 → 3 → 2 → 1 → 0 → 4 via setSupplyUsageLevel.
//   • Lots supplies (tracks_lots=true): LotBadge replaces StatusIcon. Tap
//     cycles supply.status (in_stock → low → critical → out → in_stock) per
//     D8R-Q54 — the numeric value comes from lot_aggregate and is
//     independent of status cycling.
//   • Expand panel: when supply.tracks_lots && lots.length > 0, the panel
//     prepends a LotsCollapser (default closed) showing "N lots · M unit ·
//     oldest exp Date". When opened, renders LotsList with variant grouping
//     (D8R-Q50) when applicable.
// Location: components/pantry/SupplyRow.tsx
// ============================================

import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  getSupplyDisplayName,
  setSupplyUsageLevel,
} from '../../lib/services/suppliesService';
import {
  SupplyLot,
  SupplyStatus,
  SupplySearchMatch,
  SupplyWithTags,
} from '../../lib/types/supplies';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../../lib/theme';
import { getUnitIconKind } from '../../lib/utils/unitIcons';
import StatusIcon, { UsageLevel } from './StatusIcon';
import { RegularBookmarkIcon, PriorityBookmarkIcon } from './BookmarkIcons';
import LightningBoltIcon from '../icons/LightningBoltIcon';
import SupplyControls from './SupplyControls';
import LotBadge from './LotBadge';
import LotsList from './LotsList';
import MatchPillRow from './MatchPillRow';

/**
 * 8R-UX1: Use Soon context passed by SuppliesSection when this row is rendered
 * inside the new "Use Soon" top section. Overrides the row's left-bar color
 * and replaces the status label text with a time-to-expiration / idle-days
 * marker, so the urgency reads at a glance. The same supply rendered below
 * (in On Hand / Regulars via dual-listing) does NOT receive urgency — it
 * keeps its normal stock-status presentation.
 */
export interface UrgencyContext {
  /** Hex color for the left bar AND for the urgency label text. */
  color: string;
  /** Short label that replaces the status text on the right (e.g. "2d", "Today"). */
  label: string;
}

export interface SupplyRowProps {
  supply: SupplyWithTags;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSupplyChanged: (next: SupplyWithTags) => void;
  onLongPress: (supply: SupplyWithTags) => void;
  onOpenDetail?: (supply: SupplyWithTags) => void;
  onCycleError?: (error: unknown) => void;
  userId: string | null;
  /**
   * CP6e-FlowsUI-b2: present when the server-side `search_supplies` RPC
   * returned a match for this supply. Drives MatchPillRow below the row
   * and lot-level highlighting in the expand panel. Undefined → non-search
   * rendering (zero visual change vs pre-b2).
   */
  searchMatch?: SupplySearchMatch;
  /**
   * 8R-UX1: when set, the row paints its left-bar in `urgency.color` and
   * shows `urgency.label` in place of the stock-status text. Used by the
   * Use Soon section to surface expiration / idle urgency.
   */
  urgency?: UrgencyContext;
  /**
   * 8R-UX5: when true, render a ⚡ glyph inline before the name. Set by
   * SuppliesSection only on the Use Soon outer tab + only when the supply's
   * ingredient qualifies as a hero (isHeroIngredient). Visual is in-line
   * with the name, no row-height shift.
   */
  showHeroMarker?: boolean;
}

// Battery cycle — tap decrements (uses up) and wraps: 4 → 3 → 2 → 1 → 0 → 4.
function nextLevelInCycle(level: UsageLevel): UsageLevel {
  return ((level + 4) % 5) as UsageLevel;
}

// Clamp into the 0–4 battery range; also folds any legacy 5 (pre-rework data)
// down to a full 4-bar battery on read.
function clampUsageLevel(raw: number | null | undefined): UsageLevel {
  if (raw === null || raw === undefined) return 4;
  const n = Math.max(0, Math.min(4, Math.round(raw)));
  return n as UsageLevel;
}

function statusLabel(s: SupplyStatus): string {
  switch (s) {
    case 'in_stock':
      return 'In Stock';
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

function pantryDisplayName(supply: SupplyWithTags): string {
  return (
    supply.ingredient?.plural_name ??
    supply.ingredient?.name ??
    supply.custom_name ??
    ''
  );
}

function formatQty(qty: number, unit: string | null): string {
  if (unit === null) return 'mixed';
  if (!Number.isFinite(qty)) return `0 ${unit}`;
  const num = Number.isInteger(qty)
    ? String(qty)
    : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${num} ${unit}`.trim();
}

function formatExpShort(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SupplyRow({
  supply,
  expanded,
  onToggleExpanded,
  onSupplyChanged,
  onLongPress,
  onOpenDetail,
  onCycleError,
  userId,
  searchMatch,
  urgency,
  showHeroMarker,
}: SupplyRowProps) {
  const { colors, functionalColors } = useTheme();

  const displayName = pantryDisplayName(supply);
  const status = supply.status;
  const level = clampUsageLevel(supply.usage_level);
  const stockAccent = colorForStatus(status, functionalColors, colors.accent);
  // 8R-UX1: urgency wins for the visual focus when present.
  const accentColor = urgency?.color ?? stockAccent;
  const brandLabel =
    supply.brands && supply.brands.length > 0 ? supply.brands.join(', ') : null;
  const bookmarkKind: 'priority' | 'regular' | null = supply.is_priority
    ? 'priority'
    : supply.tracking_mode === 'restock'
    ? 'regular'
    : null;

  // CP6e-PantryUI-a — lot-tracking branch.
  const isLotSupply = supply.tracks_lots === true;
  const activeLots = supply.lots ?? [];
  const aggregate = supply.lot_aggregate;
  const hasActiveLots = activeLots.length > 0;

  // Resolve a unit icon kind from either the aggregate's canonical unit or
  // the first lot's unit; fall back to count.
  const iconKind = useMemo(() => {
    if (!isLotSupply) return 'count' as const;
    return getUnitIconKind(
      aggregate?.canonical_unit ?? activeLots[0]?.quantity_unit ?? null,
      // Ingredient typical_unit isn't on the joined SupplyIngredient today;
      // pass undefined and let getUnitIconKind default to 'count'.
      undefined
    );
  }, [isLotSupply, aggregate, activeLots]);

  const handleStatusIconTap = async () => {
    const target: UsageLevel = supply.status === 'unknown' ? 4 : nextLevelInCycle(level);
    try {
      const updated = await setSupplyUsageLevel(supply.id, target);
      onSupplyChanged(updated);
    } catch (error) {
      console.error('❌ SupplyRow cycle error:', error);
      onCycleError?.(error);
    }
  };

  // CP6e-SmokeFix-SF2: OVERRIDES D8R-Q54. Originally LotBadge tap was wired
  // to `cycleSupplyStatus` so users could manually override supply.status on
  // tracks_lots supplies. Smoke 2026-05-14 surfaced this as a footgun ("far
  // too easy to accidentally lose that lot") — Tom's preference is for tap
  // to surface lot details, not change status. Manual status override on
  // tracks_lots supplies stays available via:
  //   • SupplyControls in the expanded panel (same row, one tap away)
  //   • SupplyDetailScreen status buttons
  //   • Long-press → SupplyQuickEditModal (unchanged below)
  // The D8R-Q54 doc-side reconciliation happens at end-of-CP6e refresh.
  const handleLotBadgeTap = () => {
    onToggleExpanded();
  };

  const handleLongPress = () => {
    onLongPress(supply);
  };

  const handleOpenDetailTap = () => {
    if (onOpenDetail) onOpenDetail(supply);
    else Alert.alert(displayName, 'Detail screen coming soon.');
  };

  const styles = useMemo(
    () => makeStyles(colors, accentColor),
    [colors, accentColor]
  );

  return (
    <View style={styles.outer}>
      <View style={styles.row}>
        <View style={[styles.leftBar, { backgroundColor: accentColor }]} />

        <TouchableOpacity
          style={styles.iconTouchable}
          onPress={isLotSupply ? handleLotBadgeTap : handleStatusIconTap}
          onLongPress={handleLongPress}
          delayLongPress={500}
          activeOpacity={0.6}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={
            isLotSupply
              ? `${expanded ? 'Collapse' : 'Expand'} ${displayName} details, ${
                  aggregate
                    ? `${aggregate.lot_count} lots totaling ${formatQty(
                        aggregate.total_quantity,
                        aggregate.canonical_unit
                      )}`
                    : 'no active lots'
                }`
              : `Cycle ${displayName}, currently ${statusLabel(status)}`
          }
        >
          {isLotSupply && aggregate ? (
            <LotBadge
              totalQuantity={aggregate.total_quantity}
              canonicalUnit={aggregate.canonical_unit}
              iconKind={iconKind}
              status={status}
              size={26}
            />
          ) : (
            <StatusIcon usageLevel={level} status={status} size={22} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nameTouchable}
          onPress={onToggleExpanded}
          onLongPress={handleLongPress}
          delayLongPress={500}
          activeOpacity={0.6}
          hitSlop={{ top: 6, bottom: 6, left: 0, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={
            searchMatch
              ? `Toggle ${displayName} details; matched on ${searchMatch.matchedDimensions.size} dimension${
                  searchMatch.matchedDimensions.size === 1 ? '' : 's'
                }`
              : `Toggle ${displayName} details`
          }
        >
          <View style={styles.nameRow}>
            {showHeroMarker && (
              <View style={styles.heroMarker}>
                <LightningBoltIcon size={12} color={colors.primary} />
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          {brandLabel && (
            <Text style={styles.brand} numberOfLines={1}>
              {brandLabel}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.statusLabel, { color: accentColor }]}>
          {urgency?.label ?? statusLabel(status)}
        </Text>

        {bookmarkKind && (
          <View style={styles.bookmarks}>
            {bookmarkKind === 'priority' ? (
              <PriorityBookmarkIcon size={18} color={colors.primary} />
            ) : (
              <RegularBookmarkIcon size={14} color={colors.primary} />
            )}
          </View>
        )}
      </View>

      {/* CP6e-FlowsUI-b2 — match-dimension pills. Rendered below the row when
          a server-side search match exists. Non-search renders → undefined →
          MatchPillRow returns null → zero layout impact. */}
      {searchMatch && (
        <MatchPillRow matchedDimensions={searchMatch.matchedDimensions} />
      )}

      {expanded && userId && (
        <View style={styles.expandedPanel}>
          {/* CP6e-PantryUI-a — lots collapser. Only rendered for tracks_lots
              supplies with at least one active lot. Tom's call (Q-V2) was
              to keep the collapser even for single-lot cases — refine later.
              CP6e-FlowsUI-b2: pass through matchedLotIds so individual lots
              show the soft search-match tint. */}
          {isLotSupply && hasActiveLots && aggregate && (
            <LotsCollapser
              lots={activeLots}
              lotCount={aggregate.lot_count}
              totalQuantity={aggregate.total_quantity}
              canonicalUnit={aggregate.canonical_unit}
              oldestExpiration={aggregate.oldest_expiration}
              matchedLotIds={searchMatch?.matchedLotIds}
            />
          )}

          <SupplyControls
            supply={supply}
            userId={userId}
            showOpenDetail
            onOpenDetail={handleOpenDetailTap}
            onSupplyChanged={onSupplyChanged}
          />
        </View>
      )}
    </View>
  );
}

// ============================================
// LotsCollapser — internal to SupplyRow
// ============================================
// Default closed; tap header to expand. When open, renders LotsList which
// handles variant grouping (D8R-Q50) internally.

interface LotsCollapserProps {
  lots: SupplyLot[];
  lotCount: number;
  totalQuantity: number;
  canonicalUnit: string | null;
  oldestExpiration: string | null;
  /** CP6e-FlowsUI-b2: forward to LotsList for per-lot highlighting. */
  matchedLotIds?: Set<string>;
}

function LotsCollapser({
  lots,
  lotCount,
  totalQuantity,
  canonicalUnit,
  oldestExpiration,
  matchedLotIds,
}: LotsCollapserProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const summaryParts: string[] = [
    `${lotCount} ${lotCount === 1 ? 'lot' : 'lots'}`,
    canonicalUnit === null
      ? 'mixed'
      : formatQty(totalQuantity, canonicalUnit),
  ];
  if (oldestExpiration) {
    summaryParts.push(`oldest exp ${formatExpShort(oldestExpiration)}`);
  }
  const summary = summaryParts.join(' · ');

  const styles = useMemo(() => makeCollapserStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} lots — ${summary}`}
      >
        <Text style={styles.headerText} numberOfLines={1}>
          {open ? '▾' : '▸'} {summary}
        </Text>
      </TouchableOpacity>
      {open && (
        <LotsList lots={lots} onLotTap={undefined} matchedLotIds={matchedLotIds} />
      )}
    </View>
  );
}

function makeCollapserStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      marginBottom: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    header: {
      paddingVertical: 4,
    },
    headerText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
  });
}

function colorForStatus(
  status: SupplyStatus,
  fc: ReturnType<typeof useTheme>['functionalColors'],
  themeAccent: string
): string {
  switch (status) {
    case 'in_stock':
      return themeAccent;
    case 'low':
      return fc.warning;
    case 'critical':
      return '#ea580c';
    case 'out':
      return fc.error;
    case 'unknown':
      return '#9ca3af';
  }
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  accentColor: string
) {
  return StyleSheet.create({
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
    },
    iconTouchable: {
      minWidth: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    nameTouchable: {
      flex: 1,
      paddingVertical: 2,
      paddingRight: 6,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroMarker: {
      marginRight: 4,
    },
    name: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
      flexShrink: 1,
    },
    brand: {
      fontSize: 11,
      color: colors.text.tertiary,
      marginTop: 1,
    },
    statusLabel: {
      fontSize: 11,
      fontWeight: typography.weights.medium,
      marginLeft: 6,
    },
    bookmarks: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginLeft: 8,
    },
    expandedPanel: {
      paddingHorizontal: spacing.md,
      paddingTop: 8,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.background.card,
    },
  });
}
