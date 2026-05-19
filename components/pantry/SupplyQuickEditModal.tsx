// ============================================
// FRIGO — SUPPLY QUICK EDIT MODAL (Phase 8R-CP6d-SmokeFix-1, P32)
// ============================================
// Long-press surface on SupplyRow. Same controls as the inline-expand body
// (slider + regular/priority/storage toggles + add-to-list + search recipes),
// rendered as a centered bottom-sheet modal with a header bar.
//
// Visual feel matches inline-expand per Tom's smoke note. Backdrop dismisses.
// Location: components/pantry/SupplyQuickEditModal.tsx
// ============================================

import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getSupplyDisplayName,
  setSupplyStatus,
} from '../../lib/services/suppliesService';
import { SupplyWithTags } from '../../lib/types/supplies';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../../lib/theme';
import SupplyControls from './SupplyControls';

export interface SupplyQuickEditModalProps {
  visible: boolean;
  supply: SupplyWithTags | null;
  userId: string | null;
  onClose: () => void;
  onSupplyChanged: (next: SupplyWithTags) => void;
}

export default function SupplyQuickEditModal({
  visible,
  supply,
  userId,
  onClose,
  onSupplyChanged,
}: SupplyQuickEditModalProps) {
  const { colors } = useTheme();

  // Local mirror so the modal stays responsive to optimistic updates without
  // a forced parent re-mount.
  const [localSupply, setLocalSupply] = useState<SupplyWithTags | null>(supply);
  // Resync when the prop changes (e.g., parent passes a new supply).
  if (supply && supply !== localSupply && (!localSupply || supply.id !== localSupply.id)) {
    setLocalSupply(supply);
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.background.card,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          paddingBottom: 28,
          maxHeight: '85%',
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
        },
        headerTitle: {
          flex: 1,
          fontSize: typography.sizes.lg,
          fontWeight: typography.weights.bold,
          color: colors.text.primary,
        },
        closeButton: {
          paddingHorizontal: 8,
          paddingVertical: 4,
        },
        closeButtonText: {
          fontSize: 22,
          color: colors.text.secondary,
        },
        body: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        },
        unknownButton: {
          marginTop: spacing.md,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: borderRadius.sm,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border.medium,
          alignItems: 'center',
        },
        unknownButtonText: {
          fontSize: typography.sizes.sm,
          color: colors.text.secondary,
          fontWeight: typography.weights.medium,
        },
      }),
    [colors]
  );

  if (!visible || !localSupply || !userId) return null;

  const displayName = getSupplyDisplayName(localSupply);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {displayName}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.body}>
            <SupplyControls
              supply={localSupply}
              userId={userId}
              showOpenDetail={false}
              onSupplyChanged={(next) => {
                setLocalSupply(next);
                onSupplyChanged(next);
              }}
            />
            {/* CP6d-SmokeFix-4 Task 3: Unknown is the 5th status, reachable
                only here + on SupplyDetail's strip. Tapping marks the supply
                as unknown without firing spawn/archive/restock. */}
            <TouchableOpacity
              style={styles.unknownButton}
              onPress={async () => {
                if (!localSupply || localSupply.status === 'unknown') return;
                try {
                  const updated = await setSupplyStatus(localSupply.id, 'unknown');
                  setLocalSupply(updated.supply);
                  onSupplyChanged(updated.supply);
                } catch (error) {
                  console.error('❌ Mark unknown error:', error);
                  Alert.alert('Error', 'Could not mark as unknown.');
                }
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Mark as unknown"
            >
              <Text style={styles.unknownButtonText}>
                {localSupply.status === 'unknown' ? '✓ Marked as unknown' : 'Mark as unknown'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
