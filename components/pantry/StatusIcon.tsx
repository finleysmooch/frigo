// ============================================
// FRIGO — STATUS ICON (Phase 8R-CP6d-Pantry → Battery rework)
// ============================================
// Vertical-battery fill icon driven by usage_level (0–4). Color comes from
// status (in_stock / low / out / unknown). Replaces the earlier 5-circle
// progression dot.
//
// Geometry is inlined from `assets/svg-source/noun-battery-*-160121*.svg`
// (1200×1200 viewBox). Every level shares ONE outer shell path; the inner
// bars fill from the bottom up — `usage_level` bars are drawn (0 = bare
// shell, 4 = full). The whole glyph (shell + bars) is tinted the status
// color.
//
// State map (battery has 4 bars; see suppliesService.setSupplyUsageLevel):
//   4/4, 3/4, 2/4 → in_stock · 1/4 → low · 0/4 → out
//   'critical' is retired from the level system but kept in the type +
//   colorForStatus for legacy rows (renders its amber until re-touched).
// Location: components/pantry/StatusIcon.tsx
// ============================================

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../lib/theme/ThemeContext';
import type { SupplyStatus } from '../../lib/types/supplies';

// Battery has four bars → five discrete fill states.
export type UsageLevel = 0 | 1 | 2 | 3 | 4;

export interface StatusIconProps {
  usageLevel: UsageLevel;
  status: SupplyStatus | 'unknown';
  size?: number;
  /** Render the unknown-state icon regardless of usageLevel. */
  unknown?: boolean;
}

// Outer battery shell (body + top terminal) — identical for every level.
// From noun-battery-full-4-1601214.svg (the clean shell; the empty-0 source
// has a one-curve rounding artifact we sidestep by sharing this path).
const SHELL_PATH =
  'm843.6 135.6h-115.2v-84c0-12-9.6016-20.398-20.398-20.398l-214.8-0.003906c-12 0-20.398 9.6016-20.398 20.398v84h-115.2c-54 0-97.199 43.199-97.199 97.199v840c0 54 43.199 97.199 97.199 97.199h486c54 0 97.199-43.199 97.199-97.199v-840c0-53.996-43.199-97.195-97.199-97.195zm6 937.2c0 3.6016-2.3984 6-6 6h-487.2c-3.6016 0-6-2.3984-6-6v-840c0-3.6016 2.3984-6 6-6h486c3.6016 0 6 2.3984 6 6v840z';

// Inner level bars, ordered BOTTOM → TOP so slice(0, level) fills upward.
// Bar N is drawn when usage_level >= N (1-indexed). Geometry taken verbatim
// from the per-level battery SVGs (same y-rows across files).
const BARS_BOTTOM_UP: string[] = [
  // 1st bar — y≈879.6 (bottom). Present from level 1 (battery-empty-1).
  'm783.6 879.6h-367.2c-6 0-10.801 4.8008-10.801 10.801v123.6c0 6 4.8008 10.801 10.801 10.801h368.4c6 0 10.801-4.8008 10.801-10.801l0.003906-123.61c-1.2031-6-6-10.797-12-10.797z',
  // 2nd bar — y≈680.4. Present from level 2 (battery-level-2).
  'm783.6 680.4h-367.2c-6 0-10.801 4.8008-10.801 10.801v123.6c0 6 4.8008 10.801 10.801 10.801h368.4c6 0 10.801-4.8008 10.801-10.801l0.003906-123.6c-1.2031-6-6-10.801-12-10.801z',
  // 3rd bar — y≈481.2. Present from level 3 (battery-indicator-3).
  'm783.6 481.2h-367.2c-6 0-10.801 4.8008-10.801 10.801v123.6c0 6 4.8008 10.801 10.801 10.801h368.4c6 0 10.801-4.8008 10.801-10.801l0.003906-123.6c-1.2031-6-6-10.801-12-10.801z',
  // 4th bar — y≈282 (top). Present only at level 4 (battery-full-4).
  'm783.6 282h-367.2c-6 0-10.801 4.8008-10.801 10.801v123.6c0 6 4.8008 10.801 10.801 10.801h368.4c6 0 10.801-4.8008 10.801-10.801l0.003906-123.6c-1.2031-6-6-10.801-12-10.801z',
];

// noun-progress-bar-3318919.svg — single rectangle bar with diagonal hatching.
// Kept for the 'unknown' state (orthogonal to the battery fill). Follow-up:
// decide whether unknown should adopt a battery silhouette too.
const UNKNOWN_PATH =
  'm1066.8 508.8h-933.6c-50.398 0-91.199 40.801-91.199 91.199s40.801 91.199 91.199 91.199h933.6c50.398 0 91.199-40.801 91.199-91.199s-40.801-91.199-91.199-91.199zm0 12c43.801 0 79.199 35.398 79.199 79.199s-35.398 79.199-79.199 79.199h-933.6c-43.801 0-79.199-35.398-79.199-79.199s35.398-79.199 79.199-79.199z';

function colorForStatus(
  status: SupplyStatus | 'unknown',
  unknown: boolean,
  colors: ReturnType<typeof useTheme>['colors'],
  functionalColors: ReturnType<typeof useTheme>['functionalColors']
): string {
  if (unknown || status === 'unknown') return colors.text.tertiary;
  switch (status) {
    case 'in_stock':
      // CP6d-SmokeFix-4 follow-up: lime accent (theme.accent) replaces the
      // generic green (functionalColors.success) for in-stock fill.
      return colors.accent;
    case 'low':
      return functionalColors.warning;
    case 'critical':
      // Legacy-only: 'critical' is retired from the level system but kept so
      // rows that still carry it render in their distinct amber (not error).
      return '#ea580c';
    case 'out':
      return functionalColors.error;
  }
}

export default function StatusIcon({
  usageLevel,
  status,
  size = 24,
  unknown = false,
}: StatusIconProps) {
  const { colors, functionalColors } = useTheme();
  const color = colorForStatus(status, unknown, colors, functionalColors);

  if (unknown || status === 'unknown') {
    return (
      <Svg width={size} height={size} viewBox="0 0 1200 1200">
        <Path d={UNKNOWN_PATH} fill={color} fillRule="evenodd" />
      </Svg>
    );
  }

  // The battery is a tall, narrow glyph; render width follows its ~0.6
  // aspect so it doesn't sit in a wide empty box. Height tracks `size`.
  const width = Math.round(size * 0.62);
  const bars = BARS_BOTTOM_UP.slice(0, usageLevel);
  return (
    <Svg width={width} height={size} viewBox="240 0 720 1200">
      <Path d={SHELL_PATH} fill={color} fillRule="evenodd" />
      {bars.map((d, i) => (
        <Path key={i} d={d} fill={color} fillRule="evenodd" />
      ))}
    </Svg>
  );
}
