import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface EggsIconProps {
  size?: number;
  color?: string;
}

export default function EggsIcon({ size = 24, color = '#000' }: EggsIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path d="m694.86 137.96c29.449-16.875 57.801-26.176 83.363-26.176 144.12 0 396.77 321.06 396.77 614.12 0 293.05-177.79 447.84-396.77 447.84-36.961 0-72.762-4.3984-106.73-13.148 41.602-21.438 79.477-49.562 112.49-84.188 83.262-87.324 135.99-216.71 135.99-386.59 0-201.82-105.54-415.54-225.11-551.86z" fillRule="evenodd" fill={color} />
      <Path d="m453.74 26.25c155.74 0 428.74 346.91 428.74 663.57 0 316.66-192.11 483.93-428.74 483.93s-428.74-167.26-428.74-483.93c0-316.66 266.45-663.57 428.74-663.57z" fillRule="evenodd" fill={color} />
    </Svg>
  );
}
