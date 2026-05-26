import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

export default function AlertCircleIcon({
  size = 16,
  color = '#A32D2D',
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      {/* Vertical bar + dot drawn as a single Path so we depend only on
          react-native-svg primitives that the other icons in the project
          already use (Path). */}
      <Path
        d="M12 7 L12 13 M12 16.5 L12 17.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
