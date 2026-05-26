// ============================================
// FRIGO — SWIPEABLE ROW (Phase 8R-UX1)
// ============================================
// PanResponder-based swipe wrapper for SupplyRow inside Use Soon. No new
// dependency (the codebase doesn't ship react-native-gesture-handler).
//
// Behavior:
//   • Drag right → reveal left action ("Used") in green. Past threshold on
//     release → fires onMarkUsed and snaps back closed.
//   • Drag left  → reveal right action ("Out") in red. Past threshold on
//     release → fires onMarkOut and snaps back closed.
//   • Under threshold on release → springs back without firing anything.
//   • Vertical-dominant gestures (|dy| > |dx|) skip the responder so the
//     parent ScrollView keeps scrolling.
//
// Location: components/pantry/SwipeableRow.tsx
// ============================================

import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, borderRadius } from '../../lib/theme';

export interface SwipeableRowProps {
  children: React.ReactNode;
  /** Fires when the user commits a right-drag (used). */
  onMarkUsed: () => void;
  /** Fires when the user commits a left-drag (out). */
  onMarkOut: () => void;
}

const COMMIT_THRESHOLD_PX = 70;
const MAX_REVEAL_PX = 120;

export default function SwipeableRow({
  children,
  onMarkUsed,
  onMarkOut,
}: SwipeableRowProps) {
  const { colors, functionalColors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  // Track latest dx in a ref so onPanResponderRelease can read it without
  // closing over a stale state value.
  const dxRef = useRef(0);
  // Callbacks via refs so the PanResponder can be memoized for the row's
  // lifetime. The original implementation re-created the PanResponder on
  // every parent render (because callers pass fresh `() => handler(supply)`
  // arrow functions per render), which orphaned in-flight gestures whenever
  // SuppliesSection re-rendered mid-swipe — symptom: row springs back even
  // while the finger is still down.
  const onMarkUsedRef = useRef(onMarkUsed);
  const onMarkOutRef = useRef(onMarkOut);
  useEffect(() => {
    onMarkUsedRef.current = onMarkUsed;
    onMarkOutRef.current = onMarkOut;
  }, [onMarkUsed, onMarkOut]);

  const panResponder = useMemo(
    () => {
      const horizontalDominant = (dx: number, dy: number) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
      return PanResponder.create({
        // Same predicate for both the bubble + capture phases. The capture
        // variant is what reclaims the gesture from child TouchableOpacity
        // elements inside SupplyRow once horizontal movement crosses the
        // threshold (without it, a touch that lands on the status icon or
        // name area gets locked there and the swipe never registers).
        onMoveShouldSetPanResponder: (_evt, gesture) => {
          const claim = horizontalDominant(gesture.dx, gesture.dy);
          if (claim)
            console.log('🟢 SwipeableRow.claim (bubble)', {
              dx: gesture.dx,
              dy: gesture.dy,
            });
          return claim;
        },
        onMoveShouldSetPanResponderCapture: (_evt, gesture) => {
          const claim = horizontalDominant(gesture.dx, gesture.dy);
          if (claim)
            console.log('🟢 SwipeableRow.claim (capture)', {
              dx: gesture.dx,
              dy: gesture.dy,
            });
          return claim;
        },
        onPanResponderGrant: () => {
          console.log('🟢 SwipeableRow.grant');
        },
        // Refuse to yield the responder once we have it. The log showed
        // left-swipe gestures being terminated mid-drag (claim → grant →
        // terminate) — most likely the parent ScrollView trying to reclaim
        // for vertical scroll, or iOS's edge-swipe back gesture. Right
        // swipes happened to complete because their motion vector probably
        // didn't trigger the other responder's interest.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (_evt, gesture) => {
          const clamped = Math.max(
            -MAX_REVEAL_PX,
            Math.min(MAX_REVEAL_PX, gesture.dx)
          );
          dxRef.current = clamped;
          translateX.setValue(clamped);
        },
        onPanResponderRelease: () => {
          const dx = dxRef.current;
          console.log('🟢 SwipeableRow.release', { dx });
          dxRef.current = 0;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 60,
          }).start();
          if (dx >= COMMIT_THRESHOLD_PX) {
            console.log('🟢 SwipeableRow.commit Used');
            onMarkUsedRef.current();
          } else if (dx <= -COMMIT_THRESHOLD_PX) {
            console.log('🟢 SwipeableRow.commit Out');
            onMarkOutRef.current();
          }
        },
        onPanResponderTerminate: () => {
          console.log('🟡 SwipeableRow.terminate');
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
    // Empty deps: PanResponder is created once per mount. Callbacks invoked
    // through refs (above), so we don't need them in deps. translateX is a
    // useRef value and stable for the row's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          marginBottom: 4,
          borderRadius: borderRadius.sm,
          overflow: 'hidden',
          position: 'relative',
        },
        // Action backgrounds — sit behind the content; revealed by translateX.
        leftAction: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: MAX_REVEAL_PX,
          backgroundColor: functionalColors.success ?? '#16A34A',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingLeft: 18,
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
        actionSubLabel: {
          fontSize: 10,
          color: 'rgba(255,255,255,0.85)',
          marginTop: 2,
        },
      }),
    [functionalColors]
  );

  // Opacity of each action background scales with how far the user has dragged.
  const leftActionOpacity = translateX.interpolate({
    inputRange: [0, COMMIT_THRESHOLD_PX],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const rightActionOpacity = translateX.interpolate({
    inputRange: [-COMMIT_THRESHOLD_PX, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.outer}>
      <Animated.View style={[styles.leftAction, { opacity: leftActionOpacity }]}>
        <Text style={styles.actionLabel}>Used</Text>
        <Text style={styles.actionSubLabel}>refresh</Text>
      </Animated.View>
      <Animated.View style={[styles.rightAction, { opacity: rightActionOpacity }]}>
        <Text style={styles.actionLabel}>Out</Text>
        <Text style={styles.actionSubLabel}>mark out</Text>
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
