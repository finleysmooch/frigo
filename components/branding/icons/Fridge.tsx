import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface FridgeProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function Fridge({ size = 24, color = '#000', strokeWidth = 0 }: FridgeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200" fill="none">
      {/* Top section (freezer) */}
      <Path
        d="m791.76 60h-383.48c-53.766 0-97.266 42.188-97.266 94.078v325.6c0 1.6406 1.3125 2.9531 2.9531 2.9531h572.11c1.6406 0 2.9531-1.3125 2.9531-2.9531v-325.6c0-51.844-43.5-94.078-97.266-94.078zm-356.63 327c0 13.547-10.969 24.562-24.562 24.562-13.547 0-24.562-10.969-24.562-24.562v-137.63c0-13.547 10.969-24.562 24.562-24.562 13.547 0 24.562 10.969 24.562 24.562z"
        fill={color}
        stroke={strokeWidth > 0 ? color : undefined}
        strokeWidth={strokeWidth > 0 ? strokeWidth : undefined}
      />
      {/* Bottom section (fridge) */}
      <Path
        d="m886.03 536.76h-572.06c-1.6406 0-2.9531 1.3125-2.9531 2.9531v503.02c0 53.719 43.547 97.266 97.266 97.266h383.48c53.719 0 97.266-43.547 97.266-97.266v-503.02c0-1.6406-1.3125-2.9531-2.9531-2.9531zm-450.89 345.32c0 13.547-10.969 24.562-24.562 24.562-13.547 0-24.562-10.969-24.562-24.562v-197.34c0-13.547 10.969-24.562 24.562-24.562 13.547 0 24.562 10.969 24.562 24.562z"
        fill={color}
        stroke={strokeWidth > 0 ? color : undefined}
        strokeWidth={strokeWidth > 0 ? strokeWidth : undefined}
      />
    </Svg>
  );
}
