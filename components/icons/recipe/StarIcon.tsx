import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface StarIconProps {
  size?: number;
  color?: string;
}

export default function StarIcon({ size = 24, color = '#000' }: StarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path d="m637.32 168 94.922 294.12 309.12-0.60156c39 0 53.641 48.238 19.441 73.078l-246.96 178.68 96.121 293.76c12.238 37.441-32.879 66.961-62.398 41.641l-247.32-180.36-249.84 182.16c-33.84 24.719-71.398-8.5195-57.238-51.719l93.359-285.48-250.32-181.2c-31.922-23.039-13.078-73.199 25.559-70.559l306.36 0.60156 95.039-294.12c11.52-36.121 62.641-35.641 74.16 0z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}
