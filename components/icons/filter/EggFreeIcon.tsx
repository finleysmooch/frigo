import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface EggFreeIconProps {
  size?: number;
  color?: string;
}

export default function EggFreeIcon({ size = 24, color = '#000' }: EggFreeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path d="m600 120c-153.52 2.8125-362.16 267.24-360 579.98 1.9219 274.74 191.02 380.95 360 380.02 168.98 0.9375 358.08-105.23 360-380.02 2.1562-312.79-206.48-577.18-360-579.98z" fill={color} />
    </Svg>
  );
}
