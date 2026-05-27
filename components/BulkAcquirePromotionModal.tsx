// ============================================
// FRIGO — BULK ACQUIRE PROMOTION MODAL (Phase 8R-CP6d-ViewDetail, Gap-LR8)
// ============================================
// Surfaces when the user bulk-acquires from the In Cart view AND any of the
// in-cart needs lack a supply_id back-reference. Asks: "track these as
// supplies?" with default-checked multi-select per item.
//
// On confirm:
//   • For each CHECKED need-without-supply: createSupply (CP6d-Schema infers
//     tracking_mode + storage_location from the catalog), then
//     setNeedStatus(needId, 'acquired'), then setSupplyStatus(newSupplyId,
//     'in_stock'). The setSupplyStatus call cycles the freshly-created
//     supply from its initial state into in_stock — needed for the visual
//     "supply is fully stocked after this purchase" outcome.
//   • For each UNCHECKED need-without-supply: setNeedStatus(needId,
//     'acquired') only (preserves the pre-CP6d behavior).
//   • Needs WITH supply_id are handled by the caller (existing behavior:
//     acquire + restock).
//
// Note: ViewDetailScreen still owns the supply-linked half. This modal only
// owns the no-supply-yet half.
// Location: components/BulkAcquirePromotionModal.tsx
// ============================================

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { createSupply, setSupplyStatus } from '../lib/services/suppliesService';
import { linkNeedToSupply, setNeedStatus } from '../lib/services/needsService';
import { getNeedDisplayName } from '../lib/services/needsService';
import { NeedWithDetails } from '../lib/types/needs';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';

export interface BulkAcquirePromotionModalProps {
  visible: boolean;
  needsWithoutSupply: NeedWithDetails[];
  spaceId: string;
  userId: string;
  onCancel: () => void;
  /**
   * Called after the modal finishes its work. The parent should run its own
   * post-step (acquire the supply-linked half) and refresh the screen.
   */
  onConfirmed: (result: {
    promotedNeedIds: Set<string>;
    skippedNeedIds: Set<string>;
    failedNeedIds: Set<string>;
  }) => void;
}

export default function BulkAcquirePromotionModal({
  visible,
  needsWithoutSupply,
  spaceId,
  userId,
  onCancel,
  onConfirmed,
}: BulkAcquirePromotionModalProps) {
  const { colors } = useTheme();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Default-all-checked when the modal opens.
    if (visible) {
      setChecked(new Set(needsWithoutSupply.map((n) => n.id)));
    }
  }, [visible, needsWithoutSupply]);

  const checkedCount = checked.size;

  const toggle = (needId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(needId)) next.delete(needId);
      else next.add(needId);
      return next;
    });
  };

  /**
   * CP6d-SmokeFix-3 (V33): dedup needs by identity before creating supplies.
   * Pre-fix, two cart needs both for "lemon" (no supply_id) created TWO
   * separate "lemon" supplies. Now: one supply per identity group; duplicate
   * needs in the same group acquire AND link to the single new supply.
   */
  const dedupKey = (n: NeedWithDetails): string => {
    if (n.ingredient_id) return `ing:${n.ingredient_id}`;
    return `custom:${(n.custom_name ?? '').toLowerCase().trim()}`;
  };

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    const promotedNeedIds = new Set<string>();
    const skippedNeedIds = new Set<string>();
    const failedNeedIds = new Set<string>();

    // Partition: checked → promote (with dedup), unchecked → acquire-only.
    const willPromote = needsWithoutSupply.filter((n) => checked.has(n.id));
    const willSkipPromote = needsWithoutSupply.filter((n) => !checked.has(n.id));

    // Dedup the promotion set by identity. The first need in each identity
    // group spawns the supply; siblings link to it.
    const groups = new Map<string, NeedWithDetails[]>();
    for (const n of willPromote) {
      const key = dedupKey(n);
      const list = groups.get(key) ?? [];
      list.push(n);
      groups.set(key, list);
    }

    // 8R-UX6 Item 2: within-space dedup now lives in createSupply itself —
    // any pre-existing matching supply (by ingredient_id OR custom_name) is
    // returned by createSupply instead of inserting a duplicate, and an
    // 'out' existing supply is restocked to 'in_stock' automatically.
    // What remains here is the within-BATCH dedup (the `groups` Map above):
    // when two needs in one promotion resolve to the same identity, the
    // first one's createSupply call returns the supply (new or existing),
    // and all siblings in the group link to it.

    for (const [, members] of groups) {
      if (members.length === 0) continue;
      const head = members[0];
      try {
        // createSupply handles dedup internally — returns existing supply
        // (potentially restocked from 'out') or inserts a new one.
        const supply = await createSupply({
          spaceId,
          ingredientId: head.ingredient_id ?? undefined,
          customName: head.ingredient_id ? undefined : head.custom_name ?? undefined,
          status: 'in_stock',
          forUserIds: head.for_user_ids,
          addedBy: userId,
        });
        const targetSupplyId = supply.id;

        // Acquire all members; link each to the target supply so the dedup
        // softening (CP6d-Schema Gap-G41) recognizes them as same-supply.
        for (const member of members) {
          try {
            await linkNeedToSupply(member.id, targetSupplyId);
            await setNeedStatus(member.id, 'acquired');
            promotedNeedIds.add(member.id);
          } catch (error) {
            console.error('❌ BulkAcquire member acquire error:', member.id, error);
            failedNeedIds.add(member.id);
          }
        }
      } catch (error) {
        console.error('❌ BulkAcquire promote error for group head', head.id, error);
        for (const member of members) failedNeedIds.add(member.id);
      }
    }

    // Skip-promote half: just acquire, no supply created.
    for (const need of willSkipPromote) {
      try {
        await setNeedStatus(need.id, 'acquired');
        skippedNeedIds.add(need.id);
      } catch (error) {
        console.error('❌ BulkAcquire skip-promote error:', need.id, error);
        failedNeedIds.add(need.id);
      }
    }

    setSubmitting(false);
    onConfirmed({ promotedNeedIds, skippedNeedIds, failedNeedIds });

    if (failedNeedIds.size > 0) {
      Alert.alert(
        'Partial success',
        `${promotedNeedIds.size + skippedNeedIds.size} acquired, ${failedNeedIds.size} failed.`
      );
    }
  };

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
          paddingBottom: 32,
          maxHeight: '85%',
        },
        header: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
        },
        title: {
          fontSize: typography.sizes.lg,
          fontWeight: typography.weights.bold,
          color: colors.text.primary,
        },
        subtitle: {
          fontSize: typography.sizes.sm,
          color: colors.text.secondary,
          marginTop: 4,
        },
        list: {
          maxHeight: 360,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
          gap: 12,
        },
        checkbox: {
          width: 22,
          height: 22,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: colors.border.medium,
          alignItems: 'center',
          justifyContent: 'center',
        },
        checkboxChecked: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        checkmark: {
          color: '#ffffff',
          fontSize: 14,
          fontWeight: typography.weights.bold,
        },
        rowText: {
          flex: 1,
          fontSize: typography.sizes.md,
          color: colors.text.primary,
        },
        footer: {
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
        },
        cancelButton: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border.medium,
        },
        cancelText: {
          fontSize: typography.sizes.md,
          color: colors.text.secondary,
          fontWeight: typography.weights.medium,
        },
        confirmButton: {
          flex: 2,
          paddingVertical: 12,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          backgroundColor: colors.primary,
        },
        confirmButtonDisabled: {
          opacity: 0.5,
        },
        confirmText: {
          fontSize: typography.sizes.md,
          color: '#ffffff',
          fontWeight: typography.weights.semibold,
        },
      }),
    [colors]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>
              You bought {needsWithoutSupply.length} item
              {needsWithoutSupply.length === 1 ? '' : 's'} not yet tracked
            </Text>
            <Text style={styles.subtitle}>
              Track them as supplies so they're easier to manage next time?
            </Text>
          </View>
          <ScrollView style={styles.list}>
            {needsWithoutSupply.map((need) => {
              const isChecked = checked.has(need.id);
              return (
                <TouchableOpacity
                  key={need.id}
                  style={styles.row}
                  onPress={() => toggle(need.id)}
                  disabled={submitting}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                >
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                    {isChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.rowText} numberOfLines={1}>
                    {getNeedDisplayName(need)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmText}>
                  Acquire all + track {checkedCount}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
