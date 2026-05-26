// ============================================
// FRIGO - TRACK_ONLY OUT TOAST (Phase 8R-UX1)
// ============================================
// Bottom-pinned toast surfaced when a track_only supply transitions to 'out'
// (via Use Soon swipe). Restock supplies use SpawnOnOutToast; this is the
// track_only equivalent.
//
// Actions:
//   • Add to grocery list  → createNeed (manual, supply_id link). Then
//     prompts "Always restock this?" via Alert; if yes, flips tracking_mode
//     to 'restock' so future out-events auto-spawn.
//   • Undo                 → reverts supply status to priorStatus.
//   • ×                    → manual dismiss.
//
// Auto-dismisses 5s after mount via context's internal timer.
//
// App-level mount alongside SpawnOnOutToast in App.tsx.
// Location: components/TrackOnlyOutToast.tsx
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTrackOnlyOutToast } from '../contexts/TrackOnlyOutToastContext';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import {
  setSupplyStatus,
  setSupplyTrackingMode,
} from '../lib/services/suppliesService';
import { createNeed } from '../lib/services/needsService';
import { supabase } from '../lib/supabase';

export default function TrackOnlyOutToast() {
  const { currentToast, dismissToast } = useTrackOnlyOutToast();
  const { colors, functionalColors } = useTheme();
  const [actioning, setActioning] = useState(false);
  // Slide-down animation on appear. Initial position is above the top edge;
  // springs to 0 when the toast mounts. Uses native driver so it stays
  // smooth alongside any background work the action callbacks kick off.
  const translateY = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (currentToast) {
      translateY.setValue(-120);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 9,
        tension: 80,
      }).start();
    }
  }, [currentToast, translateY]);

  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  if (!currentToast) return null;

  const { supply, priorStatus } = currentToast;
  const displayName =
    supply.ingredient?.plural_name ??
    supply.ingredient?.name ??
    supply.custom_name ??
    'Supply';

  const handleAddToGrocery = async () => {
    if (actioning) return;
    setActioning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setActioning(false);
        return;
      }
      await createNeed({
        spaceId: supply.space_id,
        ingredientId: supply.ingredient?.id,
        customName: supply.ingredient ? undefined : supply.custom_name ?? undefined,
        supplyId: supply.id,
        addedBy: user.id,
        addedFrom: 'manual',
      });
      // Promote to restock? One-shot Alert prompt — non-blocking modal so
      // user can ignore.
      Alert.alert(
        'Always restock this?',
        `Mark ${displayName} as a regular so future out-events automatically add to your grocery list.`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Always restock',
            onPress: async () => {
              try {
                await setSupplyTrackingMode(supply.id, 'restock');
              } catch (error) {
                console.error('❌ Promote to restock failed:', error);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Add to grocery list failed:', error);
    } finally {
      setActioning(false);
      dismissToast();
    }
  };

  const handleUndo = async () => {
    if (actioning) return;
    setActioning(true);
    try {
      // Revert status. priorStatus was non-out (otherwise the swipe wouldn't
      // have triggered out), so this won't re-fire any spawn-on-out logic.
      await setSupplyStatus(supply.id, priorStatus);
    } catch (error) {
      console.error('❌ TrackOnlyOutToast undo failed:', error);
    } finally {
      setActioning(false);
      dismissToast();
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} pointerEvents="box-none">
      <Animated.View
        style={[styles.bar, { transform: [{ translateY }] }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.icon}>📦</Text>
        <View style={styles.messageWrap}>
          <Text style={styles.messageTitle} numberOfLines={1}>
            {displayName} marked out
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleAddToGrocery}
          disabled={actioning}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Add ${displayName} to grocery list`}
        >
          <Text style={styles.primaryButtonText}>
            {actioning ? '…' : 'Add to list'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleUndo}
          disabled={actioning}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Undo mark out"
        >
          <Text style={styles.secondaryButtonText}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={dismissToast}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss toast"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  functionalColors: ReturnType<typeof useTheme>['functionalColors']
) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      elevation: 1000,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.md,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background.card,
      borderLeftWidth: 3,
      borderLeftColor: functionalColors.warning,
      ...shadows.small,
    },
    icon: {
      fontSize: 16,
      marginRight: 8,
    },
    messageWrap: { flex: 1 },
    messageTitle: {
      fontSize: 14,
      fontWeight: typography.weights.medium,
      color: colors.text.primary,
    },
    button: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginLeft: 6,
      borderRadius: borderRadius.sm,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      fontSize: 13,
      fontWeight: typography.weights.semibold,
      color: '#ffffff',
    },
    secondaryButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      marginLeft: 4,
    },
    secondaryButtonText: {
      fontSize: 13,
      fontWeight: typography.weights.medium,
      color: colors.text.secondary,
    },
    closeButton: {
      paddingHorizontal: 6,
      paddingVertical: 6,
      marginLeft: 4,
    },
    closeButtonText: {
      fontSize: 18,
      color: colors.text.secondary,
    },
  });
}
