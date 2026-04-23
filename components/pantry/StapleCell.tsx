// ============================================
// FRIGO - STAPLE CELL (Phase 8B-CP2)
// ============================================
// Single staple tile with split tap zones: label → ingredient detail,
// dot → cycle state. State styling per v5 wireframe (softer treatment).
// Location: components/pantry/StapleCell.tsx
// ============================================

import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  PantryStaple,
  StapleState,
} from '../../lib/types/pantry';
import {
  cycleStapleState,
  getStapleDisplayName,
} from '../../lib/pantryStaplesService';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, borderRadius } from '../../lib/theme';

export interface StapleCellProps {
  staple: PantryStaple & { ingredient_name?: string | null };
  onLabelTap: () => void;
  // Called with the updated staple after the service call succeeds; parent uses this
  // to update its local state array and re-sort.
  onCycleComplete: (updated: PantryStaple) => void;
  // Called with the error if cycling fails; parent shows a toast.
  onCycleError?: (error: unknown) => void;
}

export default function StapleCell({
  staple,
  onLabelTap,
  onCycleComplete,
  onCycleError,
}: StapleCellProps) {
  const { colors, functionalColors } = useTheme();
  const [cycling, setCycling] = useState(false);

  const displayName = getStapleDisplayName(staple);
  const state: StapleState = staple.state;
  const v = stateVisuals(state, colors, functionalColors);

  const handleDotTap = async () => {
    if (cycling) return;
    setCycling(true);
    try {
      const updated = await cycleStapleState(staple.id);
      onCycleComplete(updated);
    } catch (error) {
      console.error('❌ Error cycling staple from cell:', error);
      onCycleError?.(error);
    } finally {
      setCycling(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: borderRadius.md,
      backgroundColor: v.background,
      borderLeftWidth: v.accent ? 2 : 0,
      borderLeftColor: v.accent ?? 'transparent',
      ...(state === 'unknown'
        ? { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border.medium }
        : {}),
    },
    labelTouchable: { flex: 1, paddingVertical: 4, paddingRight: 8 },
    label: {
      fontSize: 14,
      fontWeight: v.labelWeight,
      fontStyle: state === 'unknown' ? 'italic' : 'normal',
      color: v.labelColor,
    },
    dotTouchable: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: v.dotFill,
      borderWidth: state === 'unknown' ? 1 : 0,
      borderStyle: state === 'unknown' ? 'dashed' : 'solid',
      borderColor: colors.border.dark,
      opacity: cycling ? 0.5 : 1,
    },
  }), [v, state, colors, cycling]);

  const labelText =
    state === 'running_low' ? `${displayName} · low`
    : state === 'out' ? `${displayName} · out`
    : displayName;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.labelTouchable}
        onPress={onLabelTap}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 0 }}
        accessibilityRole="button"
        accessibilityLabel={`Open ${displayName} details`}
      >
        <Text style={styles.label} numberOfLines={1}>
          {labelText}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.dotTouchable}
        onPress={handleDotTap}
        disabled={cycling}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Cycle ${displayName} state — currently ${state}`}
      >
        <View style={styles.dot} />
      </TouchableOpacity>
    </View>
  );
}

// State-driven visual tokens consolidated in one place. Accent null means no
// left-border stripe (good + unknown).
function stateVisuals(
  state: StapleState,
  colors: ReturnType<typeof useTheme>['colors'],
  functionalColors: ReturnType<typeof useTheme>['functionalColors']
): {
  background: string;
  accent: string | null;
  labelColor: string;
  labelWeight: string;
  dotFill: string;
} {
  switch (state) {
    case 'out':
      return {
        background: functionalColors.errorLight,
        accent: functionalColors.error,
        labelColor: functionalColors.error,
        labelWeight: typography.weights.medium,
        dotFill: functionalColors.error,
      };
    case 'running_low':
      return {
        background: functionalColors.warningLight,
        accent: functionalColors.warning,
        labelColor: functionalColors.warning,
        labelWeight: typography.weights.medium,
        dotFill: functionalColors.warning,
      };
    case 'good':
      return {
        background: colors.background.card,
        accent: null,
        labelColor: colors.text.primary,
        labelWeight: typography.weights.regular,
        dotFill: functionalColors.success,
      };
    case 'unknown':
      return {
        background: 'transparent',
        accent: null,
        labelColor: colors.text.tertiary,
        labelWeight: typography.weights.regular,
        dotFill: 'transparent',
      };
  }
}
