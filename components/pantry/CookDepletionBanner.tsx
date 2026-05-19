// ============================================
// FRIGO - COOK DEPLETION BANNER (Phase 8B-CP4)
// ============================================
// Floats at the top of the app. Shows after a cook-post with depletion lands.
// 30s auto-dismiss; Review opens the modal, Undo rolls back everything, X
// dismisses + commits. Timer pauses while the Review modal is open.
// Location: components/pantry/CookDepletionBanner.tsx
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DepletionPlan,
  rollbackDepletion,
} from '../../lib/cookDepletionService';
import { useCookDepletionBanner } from '../../contexts/CookDepletionBannerContext';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import CookDepletionReviewModal from './CookDepletionReviewModal';

const AUTO_DISMISS_MS = 5_000;

export default function CookDepletionBanner() {
  const { currentBanner, dismissBanner } = useCookDepletionBanner();
  const { colors, functionalColors } = useTheme();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss timer. Starts on banner mount, clears when banner changes,
  // pauses while the review modal is open (restarts when modal closes without
  // consuming the banner).
  useEffect(() => {
    if (!currentBanner || reviewOpen) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => {
      dismissBanner();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentBanner, reviewOpen, dismissBanner]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          marginTop: 64,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: borderRadius.md,
          backgroundColor: colors.primaryLight,
          borderLeftWidth: 3,
          borderLeftColor: colors.primary,
          ...shadows.small,
        },
        checkIcon: {
          fontSize: 18,
          color: colors.primary,
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
        reviewButton: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.medium,
        },
        reviewButtonText: {
          fontSize: 13,
          fontWeight: typography.weights.medium,
          color: colors.text.secondary,
        },
        undoButton: {
          backgroundColor: functionalColors.error,
        },
        undoButtonText: {
          fontSize: 13,
          fontWeight: typography.weights.semibold,
          color: '#ffffff',
        },
        closeButton: { paddingHorizontal: 6, paddingVertical: 6, marginLeft: 4 },
        closeButtonText: {
          fontSize: 18,
          color: colors.text.secondary,
        },
      }),
    [colors, functionalColors]
  );

  if (!currentBanner) return null;
  const plan = currentBanner.plan;
  const changeCount = plan.supplies.length;

  const handleUndo = async () => {
    if (rollingBack) return;
    setRollingBack(true);
    try {
      await rollbackDepletion(plan);
    } catch (err) {
      console.error('❌ CookDepletionBanner undo failed:', err);
    } finally {
      setRollingBack(false);
      dismissBanner();
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} pointerEvents="box-none">
      <View
        style={styles.bar}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.checkIcon}>✓</Text>
        <View style={styles.messageWrap}>
          <Text style={styles.messageTitle} numberOfLines={1}>
            Pantry updated — {changeCount} {changeCount === 1 ? 'supply' : 'supplies'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.button, styles.reviewButton]}
          onPress={() => setReviewOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Review pantry changes"
        >
          <Text style={styles.reviewButtonText}>Review</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.undoButton]}
          onPress={handleUndo}
          disabled={rollingBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Undo pantry changes"
        >
          <Text style={styles.undoButtonText}>{rollingBack ? '…' : 'Undo'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={dismissBanner}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss banner"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <CookDepletionReviewModal
        visible={reviewOpen}
        plan={plan}
        onClose={() => setReviewOpen(false)}
        onDone={() => {
          setReviewOpen(false);
          dismissBanner();
        }}
      />
    </SafeAreaView>
  );
}
