import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ProfileFilledProps {
  size?: number;
  color?: string;
}

export default function ProfileFilled({
  size = 24,
  color = '#000'
}: ProfileFilledProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path
        d="m862.5 337.5c0 144.98-117.52 262.5-262.5 262.5s-262.5-117.52-262.5-262.5 117.52-262.5 262.5-262.5 262.5 117.52 262.5 262.5z"
        fill={color}
      />
      <Path
        d="m832.87 603.37c-19.5-4.125-40.5 0.75-58.125 13.5-102.38 74.25-247.5 74.25-349.87 0-17.25-12.375-38.25-17.625-58.125-13.5-104.25 21.375-179.63 114-179.63 220.13v262.5c0 20.625 16.875 37.5 37.5 37.5h750c20.625 0 37.5-16.875 37.5-37.5v-262.5c0-106.12-75.375-198.74-179.63-220.13z"
        fill={color}
      />
    </Svg>
  );
}
