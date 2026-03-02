import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface FridgeIconProps {
  size?: number;
  color?: string;
}

export default function FridgeIcon({ size = 24, color = '#000' }: FridgeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200">
      <Path d="m262.5 537.52v412.5c0 75.984 61.5 137.48 137.48 137.48h399.98c75.984 0 137.48-61.5 137.48-137.48v-412.5zm225 162.47c0 20.484-17.016 37.5-37.5 37.5s-37.5-17.016-37.5-37.5v-50.016c0-20.484 17.016-37.5 37.5-37.5s37.5 17.016 37.5 37.5z" fill={color} />
      <Path d="m800.02 112.5h-399.98c-75.984 0-137.48 61.5-137.48 137.48v212.48h675v-212.48c0-75.984-61.5-137.48-137.48-137.48zm-312.52 237.52c0 20.484-17.016 37.5-37.5 37.5s-37.5-17.016-37.5-37.5v-50.016c0-20.484 17.016-37.5 37.5-37.5s37.5 17.016 37.5 37.5z" fill={color} />
    </Svg>
  );
}
