// CameraIcon — first SVG camera in the icon set (2026-06-12; the app previously
// used the 📷 emoji everywhere, incl. AddRecipeModal). Standard 24-viewBox
// camera body + lens, stroke-drawn to sit alongside the outline icon family.

import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface CameraIconProps {
  size?: number;
  color?: string;
}

export default function CameraIcon({
  size = 24,
  color = '#000'
}: CameraIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8.5C3 7.4 3.9 6.5 5 6.5H7.2L8.4 4.6C8.77 4.04 9.39 3.7 10.06 3.7H13.94C14.61 3.7 15.23 4.04 15.6 4.6L16.8 6.5H19C20.1 6.5 21 7.4 21 8.5V17.5C21 18.6 20.1 19.5 19 19.5H5C3.9 19.5 3 18.6 3 17.5V8.5Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12.8" r="3.4" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}
