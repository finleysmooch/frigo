// ============================================
// FRIGO — LOT BADGE (Phase 8R-CP6e-PantryUI-a)
// ============================================
// Status-colored pill showing the lot-aggregate total quantity + a small
// unit icon. Replaces StatusIcon's 5-circle progression for tracks_lots
// supplies (D8R-Q54: tap cycles supply.status, the number itself is
// lot-derived and doesn't change on tap).
//
// Visual reference: wireframe v2 Tab 1/2/3 (.lot-badge class).
// Location: components/pantry/LotBadge.tsx
// ============================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography } from '../../lib/theme';
import type { SupplyStatus } from '../../lib/types/supplies';
import UnitIcon, { UnitIconKind } from '../../lib/utils/unitIcons';

export interface LotBadgeProps {
  totalQuantity: number;          // lot_aggregate.total_quantity
  canonicalUnit: string | null;   // lot_aggregate.canonical_unit; null = mixed
  iconKind: UnitIconKind;         // pre-resolved by parent via getUnitIconKind
  status: SupplyStatus;
  size?: number;                  // default 26 — matches StatusIcon's wrapper feel
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

// Format the badge's headline number. Whole integers render bare; decimals
// trim to one place. canonicalUnit === null surfaces as "—" (mixed).
function formatBadgeNumber(qty: number, canonicalUnit: string | null): string {
  if (canonicalUnit === null) return '—';
  if (!Number.isFinite(qty)) return '0';
  if (Number.isInteger(qty)) return String(qty);
  return qty.toFixed(1);
}

export default function LotBadge({
  totalQuantity,
  canonicalUnit,
  iconKind,
  status,
  size = 26,
}: LotBadgeProps) {
  const { colors, functionalColors } = useTheme();
  const bg = colorForStatus(status, functionalColors, colors.accent);
  const fg = '#ffffff';

  const label = formatBadgeNumber(totalQuantity, canonicalUnit);

  // Pill is sized via `size`; padding scales loosely off the digit length.
  const styles = makeStyles(bg, fg, size);

  return (
    <View
      style={styles.pill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.number}>{label}</Text>
      <UnitIcon kind={iconKind} size={Math.round(size * 0.46)} color={fg} />
    </View>
  );
}

function makeStyles(bg: string, fg: string, size: number) {
  return StyleSheet.create({
    pill: {
      minWidth: size + 8,
      height: size,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: size / 2,
      backgroundColor: bg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    number: {
      color: fg,
      fontSize: Math.round(size * 0.52),
      fontWeight: typography.weights.bold,
      lineHeight: Math.round(size * 0.6),
    },
  });
}
