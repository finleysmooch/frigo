import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface PinIconProps {
  size?: number;
  color?: string;
}

export default function PinIcon({ size = 24, color = '#000' }: PinIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path
        d="m1011.8 448.92-262.68 262.68c43.441 106.44 35.879 214.56-30.359 280.68l-511.2-511.2c66.121-66.121 174.24-73.801 280.68-30.359l262.68-262.68c-12.359-61.559-0.60156-119.52 38.16-158.16l380.88 380.88c-38.641 38.758-96.719 50.52-158.16 38.16z"
        fill={color}
        fillRule="evenodd"
      />
      <Path
        d="m372.84 735.48-342.84 434.52 434.64-342.84z"
        fill={color}
        fillRule="evenodd"
      />
    </Svg>
  );
}
