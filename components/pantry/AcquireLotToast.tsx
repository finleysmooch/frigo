// ============================================
// FRIGO - ACQUIRE LOT TOAST (Phase 8R-CP6e-FlowsUI-b1)
// ============================================
// Top-floating toast surfaced when a single-need user-action acquire creates
// a new lot on a tracks_lots supply (D8R-Q45-adjacent). Edit + Undo + ✕.
//   - Edit  → opens LotEditSheet for the freshly-created lot. Pauses the
//             auto-dismiss timer while the sheet is open; resumes with a
//             fresh 5s on close.
//   - Undo  → best-effort revert: deleteLot + setSupplyStatus(statusBefore)
//             + setNeedStatus(in_cart, suppressSideEffects=true). The need
//             revert MUST suppress side effects to avoid re-firing the
//             helper (which would notice the missing lot + flip status →
//             cascade weirdness).
//   - ✕     → manual dismiss; the acquire stands.
//
// Mounted at App level alongside CookDepletionBanner + SpawnOnOutToast (top
// inset). No conflict suppression with sibling toasts/banners — visual
// stacking is acceptable for F&F; address in a follow-up if smoke flags it.
// Location: components/pantry/AcquireLotToast.tsx
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAcquireLotToast } from '../../contexts/AcquireLotToastContext';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { deleteLot } from '../../lib/services/lotsService';
import { setSupplyStatus } from '../../lib/services/suppliesService';
import { setNeedStatus } from '../../lib/services/needsService';
import LotEditSheet from './LotEditSheet';

const AUTO_DISMISS_MS = 5_000;

function formatQty(qty: number, unit: string): string {
  if (!Number.isFinite(qty)) return `0 ${unit}`;
  const num = Number.isInteger(qty)
    ? String(qty)
    : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${num} ${unit}`.trim();
}

function storageLabel(storage: string): string {
  switch (storage) {
    case 'fridge':
      return 'Fridge';
    case 'freezer':
      return 'Freezer';
    case 'pantry':
      return 'Pantry';
    case 'counter':
      return 'Counter';
    default:
      return storage;
  }
}

function formatExpDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AcquireLotToast() {
  const { currentToast, dismissToast } = useAcquireLotToast();
  const { colors, functionalColors } = useTheme();

  const [undoing, setUndoing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  // Auto-dismiss timer with pause-on-edit-sheet. Pattern mirrors
  // CookDepletionBanner: starts when toast appears + editOpen is false;
  // clears on unmount, toast change, or editOpen flip to true; restarts
  // fresh-5s when editOpen flips back to false.
  useEffect(() => {
    if (!currentToast) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (editOpen) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setTimeout(() => {
      dismissToast();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentToast, editOpen, dismissToast]);

  // Defensive guard — context payload type ensures `lot` is non-null, but
  // double-check before unwrapping fields.
  if (!currentToast) return null;
  const { supply, lot, statusBefore, needId } = currentToast;
  const supplyName =
    supply.ingredient?.name ?? supply.custom_name ?? 'item';
  const expDate = formatExpDate(lot.expires_at);
  const message =
    `Acquired: ${supplyName} · ${formatQty(lot.quantity, lot.quantity_unit)}` +
    ` · added to ${storageLabel(lot.storage_location)}` +
    (expDate ? ` · expires ${expDate}` : '');

  const handleEdit = () => {
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    // useEffect restart fires automatically once editOpen flips back.
  };

  const handleUndo = async () => {
    if (undoing) return;
    setUndoing(true);
    try {
      await deleteLot(lot.id);
      if (statusBefore !== null) {
        // Unconditional restore — any re-firing of Q10β/Q48 is benign.
        // (We're moving status AWAY from in_stock here only if statusBefore
        // was something else, in which case spawn-on-out would only fire on
        // a TO-out transition, not away-from-in_stock. Safe.)
        try {
          await setSupplyStatus(supply.id, statusBefore);
        } catch (err) {
          console.error('❌ AcquireLotToast undo setSupplyStatus failed:', err);
        }
      }
      // Revert the need to in_cart. suppressSideEffects to avoid the
      // helper re-firing (it would notice the now-missing lot and try to
      // flip status; safer to suppress and let our explicit calls own it).
      try {
        await setNeedStatus(needId, 'in_cart', { suppressSideEffects: true });
      } catch (err) {
        console.error('❌ AcquireLotToast undo setNeedStatus failed:', err);
      }
    } catch (err) {
      console.error('❌ AcquireLotToast undo deleteLot failed:', err);
    } finally {
      setUndoing(false);
      dismissToast();
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} pointerEvents="box-none">
      <View
        style={styles.bar}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.icon}>✓</Text>
        <View style={styles.messageWrap}>
          <Text style={styles.messageText} numberOfLines={1}>
            {message}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={handleEdit}
          disabled={undoing}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Edit lot"
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.undoButton]}
          onPress={handleUndo}
          disabled={undoing}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Undo acquire"
        >
          <Text style={styles.undoButtonText}>{undoing ? '…' : 'Undo'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={dismissToast}
          disabled={undoing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss toast"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* LotEditSheet mounted as sibling — only renders when editOpen.
          Pauses the auto-dismiss timer while open. The sheet's own save
          flow updates the lot in DB; the toast's message uses the snapshot
          (won't reflect edits — toast is about to dismiss anyway). */}
      <LotEditSheet
        visible={editOpen}
        onClose={handleEditClose}
        onSaved={handleEditClose}
        onArchived={handleEditClose}
        supply={supply}
        lot={lot}
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
      marginTop: 64, // clear the system status bar / navigation header
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      backgroundColor: functionalColors.successLight ?? '#d1fae5',
      borderLeftWidth: 3,
      borderLeftColor: functionalColors.success,
      ...shadows.small,
    },
    icon: {
      fontSize: 16,
      marginRight: 8,
      color: functionalColors.success,
      fontWeight: typography.weights.bold,
    },
    messageWrap: { flex: 1 },
    messageText: {
      fontSize: 13,
      fontWeight: typography.weights.medium,
      color: colors.text.primary,
    },
    button: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginLeft: 6,
      borderRadius: borderRadius.sm,
    },
    editButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: functionalColors.success,
    },
    editButtonText: {
      fontSize: 12,
      fontWeight: typography.weights.semibold,
      color: functionalColors.success,
    },
    undoButton: {
      backgroundColor: functionalColors.success,
    },
    undoButtonText: {
      fontSize: 12,
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
