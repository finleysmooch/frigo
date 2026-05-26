// ============================================
// FRIGO - SPAWN-ON-OUT TOAST (Phase 8R-CP6b, Tab 9 ephemeral; CP6c trim;
// 8R-UX1 top-pin + animation)
// ============================================
// Top-pinned slide-down toast surfaced when a supply transitions to 'out'
// AND a need was auto-spawned by setSupplyStatus. Undo + × actions.
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

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpawnOnOutToast } from '../contexts/SpawnOnOutToastContext';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { setSupplyStatus } from '../lib/services/suppliesService';
import { deleteNeed } from '../lib/services/needsService';
import NeedQuickEditModal from './NeedQuickEditModal';

export default function SpawnOnOutToast() {
  const { currentToast, dismissToast } = useSpawnOnOutToast();
  const { colors, functionalColors } = useTheme();
  const [actioning, setActioning] = useState(false);
  // 8R-UX1: Edit-button modal state. Snapshot of need data is held LOCALLY
  // so the modal survives the toast's 5s auto-dismiss timer — without this,
  // the parent currentToast goes null at t=5s, the component returns null,
  // and the modal unmounts. The snapshot decouples the modal from the
  // toast's lifecycle.
  const [editing, setEditing] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<{
    needId: string;
    displayName: string;
    spaceId: string;
  } | null>(null);
  // 8R-UX1: slide-down animation, matches the new TrackOnlyOutToast.
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

  // Both the toast bar and the edit modal can be active independently now.
  // Return null only when nothing is showing.
  if (!currentToast && !editing) return null;

  const supply = currentToast?.supply ?? null;
  const spawnedNeedId = currentToast?.spawnedNeedId ?? null;
  const priorStatus = currentToast?.priorStatus ?? null;
  const displayName =
    supply?.ingredient?.name ?? supply?.custom_name ?? editSnapshot?.displayName ?? 'Supply';

  const handleUndo = async () => {
    if (actioning || !supply || !spawnedNeedId || !priorStatus) return;
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

  const handleEditPress = () => {
    if (!spawnedNeedId || !supply) return;
    // Snapshot the need ID + display name + spaceId locally so the modal
    // can persist past the toast's 5s auto-dismiss. Dismiss the toast
    // immediately — the modal owns the user's attention now.
    setEditSnapshot({
      needId: spawnedNeedId,
      displayName,
      spaceId: supply.space_id,
    });
    setEditing(true);
    dismissToast();
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} pointerEvents="box-none">
      {currentToast && (
        <Animated.View
          style={[styles.bar, { transform: [{ translateY }] }]}
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
            style={[styles.button, styles.editButton]}
            onPress={handleEditPress}
            disabled={actioning}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Edit grocery list entry"
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
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
        </Animated.View>
      )}
      <NeedQuickEditModal
        visible={editing && editSnapshot !== null}
        needId={editSnapshot?.needId ?? null}
        spaceId={editSnapshot?.spaceId ?? null}
        displayName={editSnapshot?.displayName ?? ''}
        onSaved={() => {
          setEditing(false);
          setEditSnapshot(null);
        }}
        onCancel={() => {
          setEditing(false);
          setEditSnapshot(null);
        }}
      />
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
    editButton: {
      backgroundColor: 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: functionalColors.error,
    },
    editButtonText: {
      fontSize: 13,
      fontWeight: typography.weights.medium,
      color: functionalColors.error,
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
