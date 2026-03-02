import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface NoneIconProps {
  size?: number;
  color?: string;
}

export default function NoneIcon({ size = 24, color = '#000' }: NoneIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path d="m1e3 600c0 220.91-179.09 400-400 400-92.434 0-177.55-31.355-245.28-84.004l561.28-561.28c52.648 67.734 84.004 152.85 84.004 245.28zm-715.99 245.28 561.27-561.27c-67.73-52.652-152.85-84.008-245.28-84.008-220.91 0-400 179.09-400 400 0 92.434 31.355 177.55 84.008 245.28zm815.99-245.28c0 276.14-223.86 500-500 500s-500-223.86-500-500 223.86-500 500-500 500 223.86 500 500z" fillRule="evenodd" fill={color} />
    </Svg>
  );
}
