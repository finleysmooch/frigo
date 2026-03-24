import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SaveIconProps {
  size?: number;
  color?: string;
}

// Outline bookmark (unsaved state) — noun-bookmark-8322778
export function SaveOutlineIcon({ size = 22, color = '#333' }: SaveIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200" fill="none">
      <Path
        d="m863.86 1030.1c-11.062 0-21.938-3.9375-30.938-11.531l-232.92-197.76-232.92 197.76c-14.391 12.234-34.078 14.859-51.234 6.9375s-27.844-24.609-27.844-43.547v-764.02c0-26.531 21.469-48 48-48h528c26.531 0 48 21.469 48 48v764.16c0 18.938-10.688 35.625-27.844 43.547-6.6094 3-13.453 4.5469-20.297 4.5469zm-263.86-257.29c11.062 0 22.078 3.8438 31.078 11.531l232.92 197.76v-764.16h-528v764.16l232.92-197.76c9-7.6875 20.062-11.531 31.078-11.531z"
        fill={color}
      />
    </Svg>
  );
}

// Filled bookmark (saved state) — noun-bookmark-8323820
export function SaveFilledIcon({ size = 22, color = '#0d9488' }: SaveIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1200 1200" fill="none">
      <Path
        d="m864 169.92h-528c-26.531 0-48 21.469-48 48v764.16c0 18.938 10.688 35.625 27.844 43.547s36.844 5.2969 51.234-6.9375l232.92-197.76 232.92 197.76c8.8594 7.5469 19.781 11.531 30.938 11.531 6.8438 0 13.688-1.4531 20.297-4.5469 17.156-7.9219 27.844-24.609 27.844-43.547v-764.21c0-26.531-21.469-48-48-48z"
        fill={color}
      />
    </Svg>
  );
}
