// ============================================
// FRIGO — USAGE LEVEL SLIDER (Phase 8R-CP6d-SmokeFix-4 follow-up)
// ============================================
// Single 4-segment widget (vertical-rectangle progress bars) that fills
// progressively based on usage_level (0–4). Tap a bar → snap to that level.
// Drag across → continuously snap. Color derives from the resulting status
// (in_stock/low/out/unknown).
//
// The bars are built RN <View>s — NOT the noun-progress-bar-*-41956* SVG
// assets — so each segment stays an independent tap/drag target. Proportions
// mirror those rectangles (~0.6 aspect, fill left→right); the SVGs are the
// matching static-display source if ever needed. (Earlier this rendered
// circles; the inline pantry row uses the vertical battery in StatusIcon.)
//
// Replaces the 6-dot SupplyControls row AND the SupplyDetailScreen status
// strip + standalone StatusIcon visual. Mirrors StarRating's PanResponder
// pattern (lib/components/StarRating.tsx) — adapted for integer levels with
// no half-step.
// Location: components/pantry/UsageLevelSlider.tsx
// ============================================

import { useCallback, useMemo, useRef } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography } from '../../lib/theme';
import { SupplyStatus } from '../../lib/types/supplies';
import { UsageLevel } from './StatusIcon';

const BAR_WIDTH = 24;
const BAR_HEIGHT = 38;
const BAR_GAP = 8;
const SEGMENTS = 4; // progress-bar segments (vertical rectangles)
const TOTAL_WIDTH = SEGMENTS * BAR_WIDTH + (SEGMENTS - 1) * BAR_GAP; // 4 bars + 3 gaps

export interface UsageLevelSliderProps {
  /** Current usage_level (0–4). Drives fill count + color. */
  level: UsageLevel;
  /** Current status. When 'unknown', renders all-outline grey + label. */
  status: SupplyStatus;
  /** Fired with the new level when the user taps or releases a drag. */
  onLevelChange: (level: UsageLevel) => void;
  /** Disable interaction (e.g., during a service call). */
  disabled?: boolean;
}

function statusForLevel(level: UsageLevel): SupplyStatus {
  if (level >= 2) return 'in_stock';
  if (level === 1) return 'low';
  return 'out';
}

function colorForStatus(
  status: SupplyStatus,
  fc: ReturnType<typeof useTheme>['functionalColors'],
  themeAccent: string
): string {
  switch (status) {
    case 'in_stock':
      // CP6d-SmokeFix-4 follow-up: lime accent (theme.accent — '#84cc16' on
      // limeZing) instead of generic green (functionalColors.success).
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

export default function UsageLevelSlider({
  level,
  status,
  onLevelChange,
  disabled = false,
}: UsageLevelSliderProps) {
  const { colors, functionalColors } = useTheme();
  const containerRef = useRef<View>(null);
  const containerPageXRef = useRef(0);
  const lastEmittedRef = useRef<UsageLevel>(level);

  // Effective level for rendering: when status is 'unknown', show 0 filled
  // circles AND grey color. The widget doesn't expose 'unknown' as a level
  // the user can drag to — that's reachable via separate "Mark as unknown"
  // affordances in SupplyQuickEditModal / SupplyDetailScreen.
  const isUnknown = status === 'unknown';
  const fillCount: UsageLevel = isUnknown ? 0 : level;
  const activeColor = colorForStatus(
    isUnknown ? 'unknown' : statusForLevel(level),
    functionalColors,
    colors.accent
  );

  const handleLayout = useCallback(() => {
    containerRef.current?.measureInWindow((x) => {
      containerPageXRef.current = x;
    });
  }, []);

  const levelFromTouchX = useCallback((pageX: number): UsageLevel => {
    const relative = pageX - containerPageXRef.current;
    if (relative <= 0) return 0;
    if (relative >= TOTAL_WIDTH) return SEGMENTS as UsageLevel;
    // Snap to whichever circle the touch is "on or past."
    for (let i = 0; i < SEGMENTS; i++) {
      const barEnd = (i + 1) * BAR_WIDTH + i * BAR_GAP;
      if (relative <= barEnd) return (i + 1) as UsageLevel;
    }
    return SEGMENTS as UsageLevel;
  }, []);

  const emitLevel = useCallback(
    (next: UsageLevel) => {
      if (next === lastEmittedRef.current) return;
      lastEmittedRef.current = next;
      onLevelChange(next);
    },
    [onLevelChange]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Capture phase — claim the gesture BEFORE any parent ScrollView,
        // so horizontal slides on the dots don't get hijacked by vertical
        // scroll. This is the fix that makes drag-to-0 actually feel like
        // a slide rather than a click.
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponderCapture: (_, gs) =>
          !disabled && Math.abs(gs.dx) > Math.abs(gs.dy),
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: (_, gs) =>
          !disabled && Math.abs(gs.dx) > Math.abs(gs.dy),
        onPanResponderGrant: (evt) => {
          containerRef.current?.measureInWindow((x) => {
            containerPageXRef.current = x;
          });
          lastEmittedRef.current = level; // re-baseline per touch
          const next = levelFromTouchX(evt.nativeEvent.pageX);
          emitLevel(next);
        },
        onPanResponderMove: (evt) => {
          const next = levelFromTouchX(evt.nativeEvent.pageX);
          emitLevel(next);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [disabled, level, levelFromTouchX, emitLevel]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          alignItems: 'flex-start',
        },
        row: {
          flexDirection: 'row',
          gap: BAR_GAP,
          paddingVertical: 6,
          opacity: disabled ? 0.5 : 1,
        },
        bar: {
          width: BAR_WIDTH,
          height: BAR_HEIGHT,
          borderRadius: 3,
          borderWidth: 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        label: {
          marginBottom: 4,
          fontSize: typography.sizes.xs,
          color: colors.text.tertiary,
          fontWeight: typography.weights.medium,
        },
        sliderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        stepButton: {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border.medium,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background.card,
        },
        stepButtonDisabled: {
          opacity: 0.4,
        },
        stepButtonText: {
          fontSize: 16,
          color: colors.text.primary,
          fontWeight: typography.weights.semibold,
          lineHeight: 18,
        },
      }),
    [colors, disabled]
  );

  const decrement = () => {
    if (disabled || level <= 0) return;
    onLevelChange((level - 1) as UsageLevel);
  };
  const increment = () => {
    if (disabled || level >= SEGMENTS) return;
    onLevelChange((level + 1) as UsageLevel);
  };

  return (
    <View style={styles.wrap}>
      {/* Label above the circles per Tom's smoke pass. */}
      <Text style={styles.label}>
        {fillCount}/{SEGMENTS} ·{' '}
        {statusLabel(isUnknown ? 'unknown' : statusForLevel(level))}
      </Text>
      <View style={styles.sliderRow}>
        <TouchableOpacity
          style={[styles.stepButton, level <= 0 && styles.stepButtonDisabled]}
          onPress={decrement}
          disabled={disabled || level <= 0}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Decrease level"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </TouchableOpacity>

        <View
          ref={containerRef}
          onLayout={handleLayout}
          style={styles.row}
          accessibilityLabel={`Usage level ${fillCount} of ${SEGMENTS}. ${statusLabel(
            isUnknown ? 'unknown' : statusForLevel(level)
          )}.`}
          {...panResponder.panHandlers}
        >
          {[0, 1, 2, 3].map((i) => {
            const filled = i < fillCount;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    backgroundColor: filled ? activeColor : 'transparent',
                    borderColor: filled ? activeColor : colors.border.medium,
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.stepButton, level >= SEGMENTS && styles.stepButtonDisabled]}
          onPress={increment}
          disabled={disabled || level >= SEGMENTS}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Increase level"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.stepButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
