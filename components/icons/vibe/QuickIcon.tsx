import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface QuickIconProps {
  size?: number;
  color?: string;
}

export default function QuickIcon({ size = 24, color = '#000' }: QuickIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path d="m354.66 552.37 345.61-460.74c14.812-19.734 45.984-4.7344 39.797 19.172l-94.969 366.37c-4.3125 16.594 4.5469 33.797 20.578 39.984l159.89 61.5c27.844 10.734 37.781 45.094 19.828 69l-345.56 460.74c-14.812 19.734-45.984 4.7344-39.797-19.172l94.969-366.37c4.3125-16.594-4.5469-33.797-20.578-39.984l-159.89-61.5c-27.844-10.734-37.781-45.094-19.828-69z" fill={color} />
    </Svg>
  );
}
