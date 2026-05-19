// ============================================
// FRIGO - COOK DEPLETION REVIEW MODAL (Phase 8R-CP3 / CP6e-FlowsUI-a)
// ============================================
// Opened when the user taps "Review" on CookDepletionBanner. Shows the full
// depletion plan with per-row checkboxes. Unchecking a row marks it for
// rollback. Tapping Done applies the rollback for unchecked rows (checked
// rows stay depleted). Cancel closes the modal without changes.
//
// 8R model: rows represent supplies (status transitions), not pantry-items
// or staples. spawn-on-out indicator shown for rows that auto-created a need.
//
// CP6e-FlowsUI-a additions:
//   • Per-row "Drew X from Y lot(s)" summary line (below status transition).
//     Summary is async-resolved via convertBetween for mixed-unit aggregation;
//     "…" placeholder while resolving.
//   • Per-row "Change ▾" affordance that opens LotPickerModal for the
//     supply. Tap doesn't toggle the row's checkbox.
//   • Confirm path (in the picker) calls replaceSupplyDeduction +
//     updateSupplyEntry on the banner context, which pushes a fresh
//     BannerState through to this modal's `plan` prop.
// Location: components/pantry/CookDepletionReviewModal.tsx
// ============================================

import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DepletionPlan,
  DepletionSupply,
  replaceSupplyDeduction,
  rollbackDepletion,
} from '../../lib/cookDepletionService';
import { convertBetween } from '../../lib/services/unitConverter';
import { useCookDepletionBanner } from '../../contexts/CookDepletionBannerContext';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../../lib/theme';
import { LotDeductionPlanItem, SupplyStatus } from '../../lib/types/supplies';
import LotPickerModal from './LotPickerModal';

interface Props {
  visible: boolean;
  plan: DepletionPlan;
  onClose: () => void;
  onDone: () => void;
}

// Format a number+unit pair, trimming trailing zeros.
function formatQty(qty: number, unit: string): string {
  if (!Number.isFinite(qty)) return `0 ${unit}`;
  const num = Number.isInteger(qty)
    ? String(qty)
    : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${num} ${unit}`.trim();
}

/**
 * Build a human-readable "Drew X from Y lot(s)" summary for one DepletionSupply.
 *
 * Async because aggregating across lots in mixed units needs convertBetween.
 * For the common case (single-lot or same-unit multi-lot) no actual await
 * fires once the measurement_units cache is warm (~first call cost only).
 */
async function formatLotDrawSummary(entry: DepletionSupply): Promise<string> {
  const lotsAffected = entry.lots_affected;
  const successful = lotsAffected.filter((l) => l.quantity_deducted > 0);

  // No successful draw — likely all-incompat unit (shortfall=full request).
  if (successful.length === 0 && entry.shortfall > 0) {
    return `Couldn't draw — no compatible lot`;
  }
  if (successful.length === 0) {
    return ''; // nothing drew + no shortfall = nothing to show
  }

  // Sum across successful lots. Try to aggregate into the first lot's unit.
  const firstUnit = successful[0].quantity_unit;
  let total = 0;
  let mixed = false;
  for (const lot of successful) {
    if (lot.quantity_unit === firstUnit) {
      total += lot.quantity_deducted;
      continue;
    }
    const converted = await convertBetween(
      lot.quantity_deducted,
      lot.quantity_unit,
      firstUnit
    );
    if (converted === null) {
      mixed = true;
      break;
    }
    total += converted;
  }

  let core: string;
  if (mixed) {
    // Rare edge case — show just the first lot's draw + "+ N more".
    const others = successful.length - 1;
    core = `Drew ${formatQty(successful[0].quantity_deducted, firstUnit)} + ${others} more`;
  } else if (successful.length === 1) {
    core = `Drew ${formatQty(total, firstUnit)} from oldest lot`;
  } else {
    core = `Drew ${formatQty(total, firstUnit)} across ${successful.length} lots`;
  }

  if (entry.shortfall > 0) {
    core += ` (${formatQty(entry.shortfall, entry.recipe_quantity_unit)} short)`;
  }

  return core;
}

export default function CookDepletionReviewModal({
  visible,
  plan,
  onClose,
  onDone,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const { updateSupplyEntry } = useCookDepletionBanner();

  const [keepIds, setKeepIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  // CP6e-FlowsUI-a: per-supply lot-draw summary cache. Recomputed when plan
  // updates (post picker-confirm context push). Showing "…" while resolving.
  const [summaryById, setSummaryById] = useState<Map<string, string>>(new Map());

  // CP6e-FlowsUI-a: picker open-state. Non-null = LotPickerModal mounted for
  // that entry. We hold the entry (not just the id) so the picker has access
  // to currentLotsAffected and recipe context without a re-find.
  const [pickerOpenFor, setPickerOpenFor] = useState<DepletionSupply | null>(null);

  // When a new plan comes in, default ALL rows to "keep" (checked).
  useEffect(() => {
    if (!visible) return;
    const initial = new Set<string>();
    plan.supplies.forEach((s) => initial.add(s.supply_id));
    setKeepIds(initial);
  }, [visible, plan]);

  // Recompute lot-draw summaries whenever the plan changes (incl. after
  // picker confirm pushes a fresh BannerState through the context).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const next = new Map<string, string>();
      // Seed with "…" placeholders so rows don't flash empty.
      for (const entry of plan.supplies) {
        next.set(entry.supply_id, '…');
      }
      if (!cancelled) setSummaryById(new Map(next));

      for (const entry of plan.supplies) {
        const summary = await formatLotDrawSummary(entry);
        if (cancelled) return;
        next.set(entry.supply_id, summary);
      }
      if (!cancelled) setSummaryById(new Map(next));
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, visible]);

  const toggle = (id: string) => {
    setKeepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = async () => {
    if (applying) return;
    setApplying(true);
    try {
      const excludeIds = Array.from(keepIds);
      await rollbackDepletion(plan, excludeIds);
    } catch (err) {
      console.error('❌ Review modal rollback failed:', err);
    } finally {
      setApplying(false);
      onDone();
    }
  };

  const handlePickerConfirm = async (newDraw: LotDeductionPlanItem[]) => {
    if (!pickerOpenFor) return;
    try {
      const updatedEntry = await replaceSupplyDeduction(
        plan,
        pickerOpenFor.supply_id,
        newDraw
      );
      updateSupplyEntry(updatedEntry.supply_id, updatedEntry);
      setPickerOpenFor(null);
    } catch (err) {
      console.error('❌ Review modal picker-confirm failed:', err);
      // Re-throw so the picker shows its own error UI.
      throw err;
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
        },
        title: {
          fontSize: 17,
          fontWeight: typography.weights.semibold,
          color: colors.text.primary,
        },
        closeText: {
          fontSize: 20,
          color: colors.text.secondary,
          paddingHorizontal: 6,
        },
        subtitle: {
          fontSize: 13,
          color: colors.text.secondary,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: 4,
        },
        scroll: { flex: 1 },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
        },
        rowSelectArea: {
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
          minHeight: 44, // tap target
        },
        checkbox: {
          width: 22,
          height: 22,
          borderRadius: 4,
          borderWidth: 1.5,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        },
        checkboxOn: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        checkboxOff: {
          backgroundColor: 'transparent',
          borderColor: colors.border.medium,
        },
        checkboxMark: { color: '#ffffff', fontSize: 13, fontWeight: typography.weights.bold },
        rowBody: { flex: 1 },
        rowLabel: { fontSize: 15, color: colors.text.primary },
        rowLabelUnchecked: { color: colors.text.tertiary },
        rowSummary: {
          fontSize: 12,
          color: colors.text.secondary,
          marginTop: 2,
        },
        rowLotDraw: {
          fontSize: 12,
          color: colors.text.tertiary,
          marginTop: 2,
        },
        rowLotDrawShortfall: {
          color: functionalColors.warning,
        },
        rowLotDrawError: {
          color: functionalColors.warning,
          fontStyle: 'italic',
        },
        spawnedTag: {
          fontSize: 12,
          color: functionalColors.warning,
          marginTop: 2,
          fontWeight: typography.weights.medium,
        },
        changeButton: {
          paddingVertical: 6,
          paddingHorizontal: 10,
          marginLeft: 8,
          minHeight: 44,
          justifyContent: 'center',
        },
        changeButtonText: {
          fontSize: typography.sizes.sm,
          color: colors.text.secondary,
          fontWeight: typography.weights.medium,
        },
        footer: {
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 8,
        },
        doneButton: {
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.primary,
        },
        doneButtonDisabled: { opacity: 0.5 },
        doneButtonText: {
          color: '#ffffff',
          fontSize: 15,
          fontWeight: typography.weights.semibold,
        },
        empty: {
          paddingHorizontal: spacing.md,
          paddingVertical: 40,
          alignItems: 'center',
        },
        emptyText: { fontSize: 14, color: colors.text.tertiary, textAlign: 'center' },
      }),
    [colors, functionalColors]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Review pantry changes</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close review"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Uncheck anything we shouldn't have updated.</Text>

        {plan.supplies.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing to review.</Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll}>
            {plan.supplies.map((entry) => {
              const checked = keepIds.has(entry.supply_id);
              const summary = `${statusLabel(entry.old_status)} → ${statusLabel(entry.new_status)}`;
              const lotDraw = summaryById.get(entry.supply_id) ?? '';
              const isError = lotDraw.startsWith("Couldn't");
              const hasShortfall = entry.shortfall > 0 && !isError;
              return (
                <View key={entry.supply_id} style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowSelectArea}
                    onPress={() => toggle(entry.supply_id)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`${entry.display_name} — ${summary}`}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        checked ? styles.checkboxOn : styles.checkboxOff,
                      ]}
                    >
                      {checked && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowLabel, !checked && styles.rowLabelUnchecked]}>
                        {entry.display_name}
                      </Text>
                      <Text style={styles.rowSummary}>{summary}</Text>
                      {lotDraw.length > 0 && (
                        <Text
                          style={[
                            styles.rowLotDraw,
                            isError && styles.rowLotDrawError,
                            hasShortfall && styles.rowLotDrawShortfall,
                          ]}
                        >
                          {lotDraw}
                        </Text>
                      )}
                      {entry.spawned_need_id && (
                        <Text style={styles.spawnedTag}>+ added to needs</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.changeButton}
                    onPress={() => setPickerOpenFor(entry)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Change lots drawn for ${entry.display_name}`}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Text style={styles.changeButtonText}>Change ▾</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.doneButton, applying && styles.doneButtonDisabled]}
            onPress={handleDone}
            disabled={applying}
            accessibilityRole="button"
            accessibilityLabel="Done reviewing"
          >
            <Text style={styles.doneButtonText}>{applying ? 'Saving…' : 'Done'}</Text>
          </TouchableOpacity>
        </View>

        {pickerOpenFor && (
          <LotPickerModal
            visible={pickerOpenFor !== null}
            supplyId={pickerOpenFor.supply_id}
            supplyName={pickerOpenFor.display_name}
            recipeQuantity={pickerOpenFor.recipe_quantity}
            recipeQuantityUnit={pickerOpenFor.recipe_quantity_unit}
            currentLotsAffected={pickerOpenFor.lots_affected}
            onConfirm={handlePickerConfirm}
            onCancel={() => setPickerOpenFor(null)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function statusLabel(s: SupplyStatus): string {
  switch (s) {
    case 'in_stock':
      return 'in stock';
    case 'low':
      return 'low';
    case 'critical':
      return 'critical';
    case 'out':
      return 'out';
    case 'unknown':
      return 'unknown';
  }
}

// Re-export DepletionSupply to keep the type accessible if any future caller
// wants to reference per-row data without going through cookDepletionService.
export type { DepletionSupply };
