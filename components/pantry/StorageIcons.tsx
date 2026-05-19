// ============================================
// FRIGO — STORAGE ICONS (Phase 8R-CP6d-SmokeFix-4 follow-up)
// ============================================
// One icon per storage_location value (fridge / freezer / pantry / counter).
// Used as the single tappable affordance in SupplyControls + SupplyDetail
// (replaces the previous 4-segment picker). Tap → modal pops over the icon
// with the four options.
// Location: components/pantry/StorageIcons.tsx
// ============================================

import React from 'react';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { StorageLocation } from '../../lib/types/supplies';

// Fridge — paths from components/icons/pantry/FridgeIcon.tsx (existing).
const FRIDGE_PATH_A =
  'm262.5 537.52v412.5c0 75.984 61.5 137.48 137.48 137.48h399.98c75.984 0 137.48-61.5 137.48-137.48v-412.5zm225 162.47c0 20.484-17.016 37.5-37.5 37.5s-37.5-17.016-37.5-37.5v-50.016c0-20.484 17.016-37.5 37.5-37.5s37.5 17.016 37.5 37.5z';
const FRIDGE_PATH_B =
  'm800.02 112.5h-399.98c-75.984 0-137.48 61.5-137.48 137.48v212.48h675v-212.48c0-75.984-61.5-137.48-137.48-137.48zm-312.52 237.52c0 20.484-17.016 37.5-37.5 37.5s-37.5-17.016-37.5-37.5v-50.016c0-20.484 17.016-37.5 37.5-37.5s37.5 17.016 37.5 37.5z';

interface IconProps {
  size?: number;
  color?: string;
}

export function FridgeIcon({ size = 22, color = '#475569' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path d={FRIDGE_PATH_A} fill={color} />
      <Path d={FRIDGE_PATH_B} fill={color} />
    </Svg>
  );
}

// Freezer — fridge silhouette with snowflake. Reuses the fridge body and
// overlays a simple 6-pointed star outline.
export function FreezerIcon({ size = 22, color = '#475569' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path d={FRIDGE_PATH_A} fill={color} opacity={0.45} />
      <Path d={FRIDGE_PATH_B} fill={color} opacity={0.45} />
      {/* Snowflake at center */}
      <Line x1="600" y1="380" x2="600" y2="820" stroke={color} strokeWidth="55" strokeLinecap="round" />
      <Line x1="410" y1="490" x2="790" y2="710" stroke={color} strokeWidth="55" strokeLinecap="round" />
      <Line x1="790" y1="490" x2="410" y2="710" stroke={color} strokeWidth="55" strokeLinecap="round" />
    </Svg>
  );
}

// Pantry — shelved cabinet. Simple stacked-shelf primitive.
export function PantryIcon({ size = 22, color = '#475569' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Rect
        x="200"
        y="150"
        width="800"
        height="900"
        rx="60"
        ry="60"
        fill="none"
        stroke={color}
        strokeWidth="80"
      />
      <Line x1="240" y1="450" x2="960" y2="450" stroke={color} strokeWidth="60" strokeLinecap="round" />
      <Line x1="240" y1="700" x2="960" y2="700" stroke={color} strokeWidth="60" strokeLinecap="round" />
      <Line x1="240" y1="950" x2="960" y2="950" stroke={color} strokeWidth="60" strokeLinecap="round" />
    </Svg>
  );
}

// Counter — countertop with backsplash. Wide horizontal slab over a vertical line.
export function CounterIcon({ size = 22, color = '#475569' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      {/* Backsplash / wall */}
      <Rect x="120" y="220" width="960" height="60" rx="30" fill={color} />
      {/* Counter slab */}
      <Rect x="80" y="600" width="1040" height="110" rx="30" fill={color} />
      {/* Cabinet base */}
      <Line x1="200" y1="710" x2="200" y2="1020" stroke={color} strokeWidth="60" strokeLinecap="round" />
      <Line x1="600" y1="710" x2="600" y2="1020" stroke={color} strokeWidth="60" strokeLinecap="round" />
      <Line x1="1000" y1="710" x2="1000" y2="1020" stroke={color} strokeWidth="60" strokeLinecap="round" />
      <Line x1="200" y1="1020" x2="1000" y2="1020" stroke={color} strokeWidth="60" strokeLinecap="round" />
    </Svg>
  );
}

export function StorageIcon({
  storage,
  size = 22,
  color = '#475569',
}: {
  storage: StorageLocation | null;
  size?: number;
  color?: string;
}) {
  switch (storage) {
    case 'fridge':
      return <FridgeIcon size={size} color={color} />;
    case 'freezer':
      return <FreezerIcon size={size} color={color} />;
    case 'pantry':
      return <PantryIcon size={size} color={color} />;
    case 'counter':
      return <CounterIcon size={size} color={color} />;
    default:
      // Null / unset → faint pantry outline as a "pick a location" affordance.
      return <PantryIcon size={size} color={color} />;
  }
}

export function storageLabel(storage: StorageLocation | null): string {
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
      return 'Pick';
  }
}
