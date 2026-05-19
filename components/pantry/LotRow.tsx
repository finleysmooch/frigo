// ============================================
// FRIGO — LOT ROW (Phase 8R-CP6e-PantryUI-a)
// ============================================
// Individual lot row rendered inside the SupplyRow expand panel's lots list.
// Display-only in -a; PantryUI-b will add tap → lot edit modal.
//
// Visual reference: wireframe v2 Tab 2/3/4 (.lot-row class).
// Location: components/pantry/LotRow.tsx
// ============================================

import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, typography, borderRadius } from '../../lib/theme';
import type { SupplyLot } from '../../lib/types/supplies';

export interface LotRowProps {
  lot: SupplyLot;
  /** Show variant_label inline (used when LotsList is in flat-list mode). */
  showVariantInline?: boolean;
  /** -a: undefined; -b: opens lot edit modal. */
  onTap?: () => void;
  /**
   * CP6e-FlowsUI-b2: when true, layer a soft background tint to indicate
   * this lot contributed to a server-side search match. Renders inside the
   * existing urgency border so the two layers don't fight.
   */
  highlighted?: boolean;
}

type ExpirationUrgency = 'expired' | 'critical' | 'soon' | 'normal';

const DAY_MS = 24 * 60 * 60 * 1000;

function classifyExpiration(expiresAt: string | null): ExpirationUrgency {
  if (!expiresAt) return 'normal';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return 'normal';
  const days = ms / DAY_MS;
  if (days <= 0) return 'expired';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'soon';
  return 'normal';
}

function formatExpiration(expiresAt: string | null, urgency: ExpirationUrgency): string {
  if (!expiresAt) return '';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return '';
  if (urgency === 'expired') return 'EXPIRED';
  const days = Math.round((date.getTime() - Date.now()) / DAY_MS);
  if (urgency === 'critical' || urgency === 'soon') {
    return `exp in ${days}d`;
  }
  return `exp ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function formatQty(qty: number, unit: string): string {
  if (!Number.isFinite(qty)) return `0 ${unit}`;
  const num = Number.isInteger(qty) ? String(qty) : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${num} ${unit}`.trim();
}

function storageLabel(storage: string): string {
  switch (storage) {
    case 'fridge':
      return 'Fridge';
    case 'freezer':
      return 'Freezer';
    case 'pantry':
      return 'Pantry';
    case 'counter':
      return 'Counter';
    default:
      return storage;
  }
}

export default function LotRow({ lot, showVariantInline, onTap, highlighted }: LotRowProps) {
  const { colors, functionalColors } = useTheme();
  const urgency = classifyExpiration(lot.expires_at);
  const expirationText = formatExpiration(lot.expires_at, urgency);

  const expColor = useMemo(() => {
    switch (urgency) {
      case 'expired':
        return functionalColors.error;
      case 'critical':
        return functionalColors.error;
      case 'soon':
        return functionalColors.warning;
      case 'normal':
        return colors.text.tertiary;
    }
  }, [urgency, functionalColors, colors]);

  const styles = useMemo(
    () => makeStyles(colors, urgency === 'critical' || urgency === 'expired', highlighted === true),
    [colors, urgency, highlighted]
  );

  const content = (
    <View style={styles.row}>
      <View style={styles.storageBadge}>
        <Text style={styles.storageBadgeText} numberOfLines={1}>
          {storageLabel(lot.storage_location)}
        </Text>
      </View>
      <Text style={styles.qty} numberOfLines={1}>
        {formatQty(lot.quantity, lot.quantity_unit)}
      </Text>
      {showVariantInline && lot.variant_label && (
        <Text style={styles.variant} numberOfLines={1}>
          {lot.variant_label}
        </Text>
      )}
      <View style={styles.spacer} />
      {expirationText.length > 0 && (
        <Text
          style={[
            styles.expires,
            { color: expColor },
            urgency === 'expired' && styles.expiredText,
          ]}
          numberOfLines={1}
        >
          {expirationText}
        </Text>
      )}
    </View>
  );

  if (onTap) {
    return (
      <TouchableOpacity
        onPress={onTap}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Edit lot ${formatQty(lot.quantity, lot.quantity_unit)}${
          expirationText ? `, ${expirationText}` : ''
        }`}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  warnBorder: boolean,
  highlighted: boolean
) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 6,
      gap: 8,
      borderRadius: borderRadius.sm,
      borderWidth: warnBorder ? 1 : 0,
      borderColor: warnBorder ? '#ef4444' : 'transparent',
      // CP6e-FlowsUI-b2: soft search-match tint layered inside the urgency
      // border. Falls back to transparent when not highlighted so non-search
      // rendering is byte-identical to pre-b2.
      backgroundColor: highlighted ? (colors.background.surface ?? 'rgba(13, 148, 136, 0.08)') : 'transparent',
      marginVertical: 2,
    },
    storageBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.surface,
    },
    storageBadgeText: {
      fontSize: 10,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    qty: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    variant: {
      fontSize: 11,
      color: colors.text.tertiary,
    },
    spacer: {
      flex: 1,
    },
    expires: {
      fontSize: 11,
      fontWeight: typography.weights.medium,
    },
    expiredText: {
      textDecorationLine: 'line-through',
    },
  });
}
