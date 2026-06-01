import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ThumbsUpIconProps {
  size?: number;
  color?: string;
}

/**
 * Simple thumbs-up icon for displaying a comment's upvote / recommendation
 * count. Stroke-based to stay crisp at small sizes.
 */
export default function ThumbsUpIcon({ size = 14, color = '#64748b' }: ThumbsUpIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* forearm / base */}
      <Path
        d="M7 10.5V20H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1H7z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {/* hand + raised thumb */}
      <Path
        d="M7 10.5l3.8-6.2a1.6 1.6 0 0 1 2.9 1.1L13 9h5.2a1.8 1.8 0 0 1 1.77 2.13l-1.1 6A1.8 1.8 0 0 1 17.1 20H7"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
