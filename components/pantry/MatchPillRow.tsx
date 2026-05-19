// ============================================
// FRIGO — MATCH PILL ROW (Phase 8R-CP6e-FlowsUI-b2)
// ============================================
// Decorative horizontal row of dimension-label pills shown under a
// SupplyRow when the server-side `search_supplies` RPC returned a match
// for that supply. Each pill names a matched dimension (name / variant /
// brand / family / type / tag / notes / storage).
//
// Render rules:
//   • Empty set → render nothing.
//   • Up to 3 visible pills in priority order, plus a +N overflow pill.
//   • Pills are decorative — `accessibilityElementsHidden` true; the parent
//     row's accessibility label communicates the meaning.
//
// Visual: small inline pills, no wrap, single row.
// Location: components/pantry/MatchPillRow.tsx
// ============================================

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { borderRadius, typography } from '../../lib/theme';
import type { SearchMatchDimension } from '../../lib/types/supplies';

// Priority order — most user-meaningful first. The first 3 in this order
// (from the matched set) render as pills; the rest collapse into "+N".
const DIMENSION_PRIORITY: SearchMatchDimension[] = [
  'name',
  'variant',
  'brand',
  'family',
  'type',
  'tag',
  'notes',
  'storage',
];

const DIMENSION_LABELS: Record<SearchMatchDimension, string> = {
  name: 'name',
  variant: 'variant',
  brand: 'brand',
  family: 'family',
  type: 'category',
  tag: 'tag',
  notes: 'notes',
  storage: 'storage',
};

const MAX_VISIBLE = 3;

export interface MatchPillRowProps {
  matchedDimensions: Set<SearchMatchDimension>;
}

export default function MatchPillRow({ matchedDimensions }: MatchPillRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (matchedDimensions.size === 0) return null;

  // Stable ordered list of matched dimensions.
  const orderedAll = DIMENSION_PRIORITY.filter((d) => matchedDimensions.has(d));
  const visible = orderedAll.slice(0, MAX_VISIBLE);
  const overflow = orderedAll.length - visible.length;

  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {visible.map((dim) => (
        <View key={dim} style={styles.pill}>
          <Text style={styles.pillText}>{DIMENSION_LABELS[dim]}</Text>
        </View>
      ))}
      {overflow > 0 && (
        <View style={styles.pill}>
          <Text style={styles.pillText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 2,
    },
    pill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.surface,
    },
    pillText: {
      fontSize: 11,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
  });
}
