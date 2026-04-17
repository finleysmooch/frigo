// components/StarRating.tsx
// Reusable half-star slide-to-rate component.
// Extracted from LogCookSheet's PanResponder-based implementation.
// Used by LogCookSheet and EditPostScreen.

import React, { useRef, useMemo, useCallback } from 'react';
import { View, PanResponder } from 'react-native';
import { StarIcon } from './icons';

const STAR_SIZE = 36;
const STAR_GAP = 6;
const STARS_TOTAL_WIDTH = 5 * STAR_SIZE + 4 * STAR_GAP; // 204

interface StarRatingProps {
  rating: number | null;
  onRatingChange: (rating: number | null) => void;
  colors: {
    border: { medium: string };
    primary: string;
  };
}

export default function StarRating({ rating, onRatingChange, colors }: StarRatingProps) {
  const starsContainerRef = useRef<View>(null);
  const starsPageXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleStarsLayout = useCallback(() => {
    starsContainerRef.current?.measureInWindow((x) => {
      starsPageXRef.current = x;
    });
  }, []);

  const ratingFromTouchX = useCallback((pageX: number): number | 'clear' | null => {
    const relativeX = pageX - starsPageXRef.current;
    if (relativeX > STARS_TOTAL_WIDTH + 8) return null;
    if (relativeX < 0) return 'clear';
    const clamped = Math.min(relativeX, STARS_TOTAL_WIDTH);

    for (let i = 0; i < 5; i++) {
      const starStart = i * (STAR_SIZE + STAR_GAP);
      const starEnd = starStart + STAR_SIZE;
      if (clamped <= starEnd) {
        const withinStar = Math.max(0, clamped - starStart);
        return withinStar < STAR_SIZE / 2 ? i + 0.5 : i + 1;
      }
      if (clamped < starStart + STAR_SIZE + STAR_GAP) {
        return i + 1;
      }
    }
    return 5;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 4 && Math.abs(gs.dx) > Math.abs(gs.dy),
        onPanResponderGrant: (evt) => {
          isDraggingRef.current = false;
          starsContainerRef.current?.measureInWindow((x) => {
            starsPageXRef.current = x;
          });
          const result = ratingFromTouchX(evt.nativeEvent.pageX);
          if (result === 'clear') onRatingChange(null);
          else if (result !== null) onRatingChange(result);
        },
        onPanResponderMove: (evt) => {
          isDraggingRef.current = true;
          const result = ratingFromTouchX(evt.nativeEvent.pageX);
          if (result === 'clear') onRatingChange(null);
          else if (result !== null) onRatingChange(result);
        },
      }),
    [ratingFromTouchX, onRatingChange]
  );

  const renderStar = (starIndex: number) => {
    const starNumber = starIndex + 1;
    const fillAmount = rating === null
      ? 0
      : rating >= starNumber
        ? 1
        : rating >= starNumber - 0.5
          ? 0.5
          : 0;

    const emptyColor = colors.border.medium;
    const filledColor = colors.primary;

    return (
      <View key={starIndex} style={{ width: STAR_SIZE, height: STAR_SIZE }}>
        <View style={{ position: 'absolute' }}>
          <StarIcon size={STAR_SIZE} color={emptyColor} />
        </View>
        {fillAmount > 0 && (
          <View style={{
            position: 'absolute',
            width: fillAmount === 1 ? STAR_SIZE : STAR_SIZE / 2,
            height: STAR_SIZE,
            overflow: 'hidden',
          }}>
            <StarIcon size={STAR_SIZE} color={filledColor} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View
      ref={starsContainerRef}
      onLayout={handleStarsLayout}
      style={{
        flexDirection: 'row',
        gap: STAR_GAP,
        paddingVertical: 16,
        marginVertical: -8,
      }}
      {...panResponder.panHandlers}
    >
      {[0, 1, 2, 3, 4].map(i => renderStar(i))}
    </View>
  );
}
