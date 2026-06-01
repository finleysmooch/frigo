import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

interface GlobeIconProps {
  size?: number;
  color?: string;
}

/**
 * Classic globe / web-source icon: outer circle with a meridian, an equator,
 * and two latitude lines. Stroke-based so it stays crisp at small sizes.
 * Used to mark web-imported (URL-sourced) recipes, paired with BookIcon for
 * book-sourced recipes.
 */
export default function GlobeIcon({ size = 24, color = '#000' }: GlobeIconProps) {
  const sw = 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={sw} />
      {/* equator */}
      <Line x1={3} y1={12} x2={21} y2={12} stroke={color} strokeWidth={sw} />
      {/* meridian (vertical ellipse, drawn as two mirrored curves) */}
      <Path d="M12 3c3.6 3.4 3.6 14.6 0 18" stroke={color} strokeWidth={sw} />
      <Path d="M12 3c-3.6 3.4-3.6 14.6 0 18" stroke={color} strokeWidth={sw} />
      {/* latitude lines */}
      <Path d="M4.8 7.2c4.6 2.6 9.8 2.6 14.4 0" stroke={color} strokeWidth={sw} />
      <Path d="M4.8 16.8c4.6-2.6 9.8-2.6 14.4 0" stroke={color} strokeWidth={sw} />
    </Svg>
  );
}
