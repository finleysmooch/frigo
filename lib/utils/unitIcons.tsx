// ============================================
// FRIGO — UNIT ICONS (Phase 8R-CP6e-PantryUI-a)
// ============================================
// Maps a lot's quantity_unit (and the parent ingredient's typical_unit) to
// one of eight visual icon kinds, then renders a small inline SVG via
// react-native-svg. The icon kinds + visual silhouettes come from the
// CP6e-Lots wireframe v2 (docs/wireframes/phase_8r/phase_8r_lots_wireframes_v2.html
// — see the <defs> block, ids u-count / u-bag / u-bottle / u-jar / u-pack /
// u-bunch / u-container / u-weight).
//
// Project uses react-native-svg (not lucide-react-native); paths below are
// translated from the wireframe's 14×14 viewBox SVG symbols.
//
// Pure utility — no hooks, no side effects.
// ============================================

import React from 'react';
import Svg, { Circle, Ellipse, Line, Path, Rect, SvgProps, Text as SvgText } from 'react-native-svg';

export type UnitIconKind =
  | 'count'
  | 'bag'
  | 'bottle'
  | 'jar'
  | 'pack'
  | 'bunch'
  | 'container'
  | 'weight';

// Common unit string → icon kind. Case-insensitive.
const DIRECT_MAP: Record<string, UnitIconKind> = {
  // Count / discrete items
  ct: 'count',
  count: 'count',
  pc: 'count',
  pcs: 'count',
  piece: 'count',
  pieces: 'count',
  each: 'count',
  ea: 'count',

  // Weight
  oz: 'weight',
  lb: 'weight',
  lbs: 'weight',
  g: 'weight',
  gram: 'weight',
  grams: 'weight',
  kg: 'weight',
  kilogram: 'weight',
  kilograms: 'weight',

  // Bag
  bag: 'bag',
  bags: 'bag',
  sack: 'bag',
  pouch: 'bag',

  // Bottle
  bottle: 'bottle',
  bottles: 'bottle',
  btl: 'bottle',

  // Jar / cylindrical container
  jar: 'jar',
  jars: 'jar',
  can: 'jar',
  cans: 'jar',
  tin: 'jar',

  // Pack
  pack: 'pack',
  packs: 'pack',
  pkg: 'pack',
  package: 'pack',
  box: 'pack',
  boxes: 'pack',
  carton: 'pack',
  cartons: 'pack',

  // Bunch / leafy
  bunch: 'bunch',
  bunches: 'bunch',
  head: 'bunch',
  heads: 'bunch',
  sprig: 'bunch',
  sprigs: 'bunch',

  // Tub-style container
  container: 'container',
  containers: 'container',
  tub: 'container',
  tubs: 'container',
};

/**
 * Resolve a unit string (plus optional fallback `typicalUnit`) to one of the
 * 8 icon kinds. Unknown units fall back to `count` — a neutral dot.
 *
 * TODO (post-F&F): refine. Some lucide-equivalent shapes are approximations.
 * Add fluid-volume ('cup', 'tsp', 'tbsp', 'ml', 'l') once a clean glyph for
 * volume distinct from weight is picked.
 */
export function getUnitIconKind(
  quantityUnit: string | null | undefined,
  typicalUnit?: string | null
): UnitIconKind {
  const direct = lookup(quantityUnit);
  if (direct) return direct;
  const fallback = lookup(typicalUnit);
  if (fallback) return fallback;
  return 'count';
}

function lookup(s: string | null | undefined): UnitIconKind | null {
  if (!s) return null;
  const key = s.trim().toLowerCase();
  return DIRECT_MAP[key] ?? null;
}

// ============================================
// UnitIcon component
// ============================================
// Renders the icon for a given kind. Uses currentColor pattern — pass `color`
// via prop. Default size 14 to match the wireframe's 14×14 viewBox.

export interface UnitIconProps extends Omit<SvgProps, 'viewBox'> {
  kind: UnitIconKind;
  size?: number;
  color?: string;
}

export default function UnitIcon({
  kind,
  size = 14,
  color = '#000',
  ...rest
}: UnitIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" {...rest}>
      {renderPaths(kind, color)}
    </Svg>
  );
}

function renderPaths(kind: UnitIconKind, color: string): React.ReactNode {
  switch (kind) {
    case 'count':
      // Small filled dot — neutral indicator for discrete items.
      return <Circle cx={7} cy={7} r={2.5} fill={color} />;

    case 'bag':
      return (
        <>
          <Path
            d="M3 5L4.5 3H9.5L11 5V12H3Z"
            fill="none"
            stroke={color}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <Line x1={5.5} y1={5.5} x2={5.5} y2={7} stroke={color} strokeWidth={0.8} strokeLinecap="round" />
          <Line x1={8.5} y1={5.5} x2={8.5} y2={7} stroke={color} strokeWidth={0.8} strokeLinecap="round" />
        </>
      );

    case 'bottle':
      return (
        <>
          <Rect x={5.5} y={1.5} width={3} height={2} fill={color} />
          <Path
            d="M5 4H9L10 6V12.5H4V6Z"
            fill="none"
            stroke={color}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </>
      );

    case 'jar':
      return (
        <>
          <Ellipse cx={7} cy={3} rx={3.5} ry={1.2} fill="none" stroke={color} strokeWidth={1.2} />
          <Path
            d="M3.5 3V11C3.5 11.7 5.1 12.2 7 12.2C8.9 12.2 10.5 11.7 10.5 11V3"
            fill="none"
            stroke={color}
            strokeWidth={1.2}
          />
        </>
      );

    case 'pack':
      return (
        <>
          <Rect x={2} y={3} width={9} height={6.5} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
          <Rect x={3.5} y={4.5} width={9} height={6.5} fill="#ffffff" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
        </>
      );

    case 'bunch':
      return (
        <>
          <Path
            d="M7 1.5C5 4 4 6 4 8a3 3 0 0 0 6 0c0-2-1-4-3-6.5z"
            fill="none"
            stroke={color}
            strokeWidth={1.2}
          />
          <Line x1={7} y1={11} x2={7} y2={13} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
        </>
      );

    case 'container':
      return (
        <>
          <Path
            d="M2 6C2 4 4 3 7 3C10 3 12 4 12 6V12H2Z"
            fill="none"
            stroke={color}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <Line x1={2} y1={6.5} x2={12} y2={6.5} stroke={color} strokeWidth={0.8} />
        </>
      );

    case 'weight':
      // Scale/balance: rounded rectangle with handle + small "lb" text.
      return (
        <>
          <Rect x={2} y={4} width={10} height={8} rx={1} fill="none" stroke={color} strokeWidth={1.2} />
          <Line x1={7} y1={4} x2={7} y2={2} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
          <Line x1={5} y1={2} x2={9} y2={2} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
          <SvgText x={7} y={10.5} fontSize={4} fontWeight="700" textAnchor="middle" fill={color}>
            lb
          </SvgText>
        </>
      );
  }
}
