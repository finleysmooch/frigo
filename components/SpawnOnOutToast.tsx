// ============================================
// FRIGO - SPAWN-ON-OUT TOAST (Phase 8R-CP6b, Tab 9 ephemeral; CP6c trim)
// ============================================
// Bottom-pinned toast surfaced when a supply transitions to 'out' AND a need
// was auto-spawned by setSupplyStatus. Undo + × actions.
//   - Undo  → deletes spawned need + reverts supply to priorStatus.
//   - ×     → manual dismiss (no-op).
// Auto-dismisses 5s after mount via the context's internal timer.
//
// CP6c removed the Edit button: at App-level mount the onEditPress callback
// had no consumer (no edit modal at App scope), so Edit dismissed without
// doing anything. Long-press on the need row in any view containing it edits
// in one extra step.
//
// App-level mount alongside CookDepletionBanner (precedent in App.tsx — both
// providers wrap the NavigationContainer; both visual components render once
// inside the providers).
// Location: components/SpawnOnOutToast.tsx
// ============================================

import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpawnOnOutToast } from '../contexts/SpawnOnOutToastContext';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { setSupplyStatus } from '../lib/services/suppliesService';
import { deleteNeed } from '../lib/services/needsService';

export default function SpawnOnOutToast() {
  const { currentToast, dismissToast } = useSpawnOnOutToast();
  const { colors, functionalColors } = useTheme();
  const [actioning, setActioning] = useState(false);

  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  if (!currentToast) return null;

  const { supply, spawnedNeedId, priorStatus } = currentToast;
  const displayName =
    supply.ingredient?.name ?? supply.custom_name ?? 'Supply';

  const handleUndo = async () => {
    if (actioning) return;
    setActioning(true);
    try {
      await deleteNeed(spawnedNeedId);
      // Revert supply to its prior status. priorStatus is in_stock/low/critical
      // (never out — we wouldn't have spawned otherwise). setSupplyStatus's
      // spawn-on-out logic only fires on transitions TO 'out', so reverting
      // away from 'out' won't re-spawn.
      await setSupplyStatus(supply.id, priorStatus);
    } catch (error) {
      console.error('❌ SpawnOnOutToast undo failed:', error);
    } finally {
      setActioning(false);
      dismissToast();
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['bottom']} pointerEvents="box-none">
      <View
        style={styles.bar}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.icon}>📦</Text>
        <View style={styles.messageWrap}>
          <Text style={styles.messageTitle} numberOfLines={1}>
            {displayName} out → added to needs
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.button, styles.undoButton]}
          onPress={handleUndo}
          disabled={actioning}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Undo spawn"
        >
          <Text style={styles.undoButtonText}>{actioning ? '…' : 'Undo'}</Text>
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
      </View>
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
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      elevation: 1000,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.md,
      marginBottom: 24,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      backgroundColor: functionalColors.errorLight,
      borderLeftWidth: 3,
      borderLeftColor: functionalColors.error,
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
    undoButton: {
      backgroundColor: functionalColors.error,
    },
    undoButtonText: {
      fontSize: 13,
      fontWeight: typography.weights.semibold,
      color: '#ffffff',
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
