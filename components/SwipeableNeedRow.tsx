// ============================================
// FRIGO — SWIPEABLE NEED ROW (Phase 8R-UX1 continuation)
// ============================================
// PanResponder-based left-swipe wrapper for need rows on ViewDetailScreen.
// Mirrors components/pantry/SwipeableRow.tsx's pattern but only renders the
// left-drag-from-finger (negative dx) reveal — grocery list rows only need a
// destructive "Remove" action; no equivalent of pantry's right-drag "Used".
//
// Location: components/SwipeableNeedRow.tsx
// ============================================

import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, borderRadius } from '../lib/theme';

export interface SwipeableNeedRowProps {
  children: React.ReactNode;
  onRemove: () => void;
}

const COMMIT_THRESHOLD_PX = 70;
const MAX_REVEAL_PX = 120;

export default function SwipeableNeedRow({
  children,
  onRemove,
}: SwipeableNeedRowProps) {
  const { colors, functionalColors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const dxRef = useRef(0);
  const onRemoveRef = useRef(onRemove);
  useEffect(() => {
    onRemoveRef.current = onRemove;
  }, [onRemove]);

  const panResponder = useMemo(
    () => {
      // Mirrors the pantry SwipeableRow predicate — horizontal motion must
      // dominate vertical by 1.5× and exceed an 8px deadzone before claiming
      // the gesture from the parent ScrollView. Left-only here, but we still
      // need both directions to be considered for claim purposes (a right
      // wiggle followed by a left commit should still register).
      const horizontalDominant = (dx: number, dy: number) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
      return PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          horizontalDominant(gesture.dx, gesture.dy),
        onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
          horizontalDominant(gesture.dx, gesture.dy),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (_evt, gesture) => {
          // Clamp to left-only: positive dx is pinned at 0 (no right-drag
          // reveal). This prevents finger-drag-right from doing nothing
          // visible but still capturing the gesture.
          const clamped = Math.max(-MAX_REVEAL_PX, Math.min(0, gesture.dx));
          dxRef.current = clamped;
          translateX.setValue(clamped);
        },
        onPanResponderRelease: () => {
          const dx = dxRef.current;
          dxRef.current = 0;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 60,
          }).start();
          if (dx <= -COMMIT_THRESHOLD_PX) {
            onRemoveRef.current();
          }
        },
        onPanResponderTerminate: () => {
          dxRef.current = 0;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 60,
          }).start();
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          position: 'relative',
          overflow: 'hidden',
        },
        rightAction: {
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: MAX_REVEAL_PX,
          backgroundColor: functionalColors.error,
          justifyContent: 'center',
          alignItems: 'flex-end',
          paddingRight: 18,
        },
        actionLabel: {
          fontSize: 13,
          fontWeight: typography.weights.semibold,
          color: '#ffffff',
        },
      }),
    [functionalColors]
  );

  const rightActionOpacity = translateX.interpolate({
    inputRange: [-COMMIT_THRESHOLD_PX, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.outer}>
      <Animated.View style={[styles.rightAction, { opacity: rightActionOpacity }]}>
        <Text style={styles.actionLabel}>Remove</Text>
      </Animated.View>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }], backgroundColor: colors.background.card }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
