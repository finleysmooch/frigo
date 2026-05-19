// ============================================
// FRIGO — LOT PICKER MODAL (Phase 8R-CP6e-FlowsUI-a)
// ============================================
// Opened from CookDepletionReviewModal's "Change ▾" affordance on a per-row
// basis. Lets the user revise which lots a cook event drew from, and how
// much from each, for a single supply.
//
// Multi-select with per-lot qty inputs (F1=a). Lot rows are display-only —
// no inline edit (F2=a). Pre-selects from the supply's current
// `lots_affected`. Running total in recipe unit at the footer; shortfall
// surfaces as a subtle "?" + faint hint (no blocking, no "I have enough"
// affordance — deferred to a follow-up planning pass).
//
// Unit-incompat lots (no convertBetween bridge to recipeQuantityUnit) are
// rendered at 0.5 opacity, unselectable, with a "Can't combine with recipe
// unit" sub-line.
//
// Confirm hands the parent a LotDeductionPlanItem[]; the parent calls
// `cookDepletionService.replaceSupplyDeduction(plan, supplyId, newDraw)`
// and then the banner context's `updateSupplyEntry`.
// Location: components/pantry/LotPickerModal.tsx
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme/ThemeContext';
import { borderRadius, spacing, typography } from '../../lib/theme';
import { getLotsForSupply } from '../../lib/services/lotsService';
import { convertBetween } from '../../lib/services/unitConverter';
import type {
  LotDeductionPlanItem,
  LotDeductionResult,
  SupplyLot,
} from '../../lib/types/supplies';
import LotRow from './LotRow';

type LotsAffected = LotDeductionResult['lots_affected'];

interface Props {
  visible: boolean;
  supplyId: string;
  supplyName: string;
  recipeQuantity: number;
  recipeQuantityUnit: string;
  currentLotsAffected: LotsAffected;
  onConfirm: (newDraw: LotDeductionPlanItem[]) => Promise<void>;
  onCancel: () => void;
}

interface LotPickerEntry {
  lot: SupplyLot;
  /** Result of convertBetween(lot.quantity, lot.quantity_unit, recipeUnit). null = incompat. */
  recipeUnitFactor: number | null;
}

function formatQty(qty: number, unit: string): string {
  if (!Number.isFinite(qty)) return `0 ${unit}`;
  const num = Number.isInteger(qty)
    ? String(qty)
    : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${num} ${unit}`.trim();
}

export default function LotPickerModal({
  visible,
  supplyId,
  supplyName,
  recipeQuantity,
  recipeQuantityUnit,
  currentLotsAffected,
  onConfirm,
  onCancel,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  // ---- Fetched lots + per-lot compat metadata ----
  const [entries, setEntries] = useState<LotPickerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- Picker state ----
  // Selection set keyed by lot_id.
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set());
  // Per-lot qty input (string for input control). Default = pre-selected qty.
  const [qtyByLotId, setQtyByLotId] = useState<Record<string, string>>({});

  // ---- Confirm state ----
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // ---- Running total (selected qty converted to recipeQuantityUnit) ----
  const [selectedTotalInRecipeUnit, setSelectedTotalInRecipeUnit] =
    useState<number>(0);

  // Load lots + per-lot compat probe when modal becomes visible.
  const loadLots = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const fetched = await getLotsForSupply(supplyId, { includeArchived: false });
      // Probe compat per-lot.
      const probed: LotPickerEntry[] = [];
      for (const lot of fetched) {
        const factor = await convertBetween(1, lot.quantity_unit, recipeQuantityUnit);
        probed.push({ lot, recipeUnitFactor: factor });
      }
      setEntries(probed);

      // Pre-selection from currentLotsAffected.
      const initialSelected = new Set<string>();
      const initialQty: Record<string, string> = {};
      for (const lotChange of currentLotsAffected) {
        if (lotChange.quantity_deducted > 0) {
          initialSelected.add(lotChange.lot_id);
          initialQty[lotChange.lot_id] = String(lotChange.quantity_deducted);
        }
      }
      setSelectedLotIds(initialSelected);
      setQtyByLotId(initialQty);
    } catch (err) {
      console.error('❌ LotPickerModal load error:', err);
      setLoadError('Could not load lots. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, [supplyId, recipeQuantityUnit, currentLotsAffected]);

  useEffect(() => {
    if (!visible) return;
    // Reset modal state on each open.
    setSelectedLotIds(new Set());
    setQtyByLotId({});
    setConfirmError(null);
    setConfirming(false);
    setEntries([]);
    loadLots();
  }, [visible, loadLots]);

  // Recompute running total whenever selection or qty inputs change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let total = 0;
      for (const entry of entries) {
        if (!selectedLotIds.has(entry.lot.id)) continue;
        const raw = qtyByLotId[entry.lot.id] ?? '';
        const parsed = parseFloat(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) continue;
        // entry.recipeUnitFactor is the factor for 1 lot-unit → recipe-unit.
        // Selected qty is in lot's native unit; multiply.
        if (entry.recipeUnitFactor === null) continue;
        total += parsed * entry.recipeUnitFactor;
      }
      if (!cancelled) setSelectedTotalInRecipeUnit(total);
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, selectedLotIds, qtyByLotId]);

  const toggleSelect = (lotId: string, incompat: boolean) => {
    if (incompat) return; // unselectable
    setSelectedLotIds((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) {
        next.delete(lotId);
      } else {
        next.add(lotId);
        // When toggling on, default qty to the lot's full quantity if no qty
        // currently set. Pre-selection from currentLotsAffected already
        // populates a value for those lots; this branch only matters for
        // newly-selected lots.
        if (!(lotId in qtyByLotId)) {
          const entry = entries.find((e) => e.lot.id === lotId);
          if (entry) {
            setQtyByLotId((prevQty) => ({
              ...prevQty,
              [lotId]: String(entry.lot.quantity),
            }));
          }
        }
      }
      return next;
    });
  };

  const setQty = (lotId: string, raw: string) => {
    setQtyByLotId((prev) => ({ ...prev, [lotId]: raw }));
  };

  // Confirm enabled when ≥1 selected lot has a positive qty.
  const canConfirm = useMemo(() => {
    if (selectedLotIds.size === 0) return false;
    for (const id of selectedLotIds) {
      const raw = qtyByLotId[id] ?? '';
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) return true;
    }
    return false;
  }, [selectedLotIds, qtyByLotId]);

  const handleConfirm = async () => {
    if (!canConfirm || confirming) return;
    setConfirming(true);
    setConfirmError(null);

    // Build LotDeductionPlanItem[]. Filter out invalid + zero qty.
    const newDraw: LotDeductionPlanItem[] = [];
    for (const entry of entries) {
      if (!selectedLotIds.has(entry.lot.id)) continue;
      const raw = qtyByLotId[entry.lot.id] ?? '';
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) continue;
      newDraw.push({
        lot_id: entry.lot.id,
        quantity: parsed,
        quantity_unit: entry.lot.quantity_unit, // native unit; deductFromSpecificLots handles conversion
      });
    }

    if (newDraw.length === 0) {
      setConfirming(false);
      return;
    }

    try {
      await onConfirm(newDraw);
      // Parent closes the modal by clearing pickerOpenFor; we stay agnostic.
    } catch (err) {
      console.error('❌ LotPickerModal confirm error:', err);
      const msg = err instanceof Error ? err.message : 'Could not save selection.';
      setConfirmError(msg);
    } finally {
      setConfirming(false);
    }
  };

  // Shortfall in recipe unit, for footer hint.
  const shortfall = Math.max(0, recipeQuantity - selectedTotalInRecipeUnit);
  const showShortfallHint =
    selectedLotIds.size > 0 && selectedTotalInRecipeUnit < recipeQuantity;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView
        style={styles.container}
        edges={['top', 'bottom']}
        accessibilityViewIsModal
      >
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            Change lots — {supplyName}
          </Text>
          <TouchableOpacity
            onPress={onCancel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close lot picker"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subheader}>
          Recipe needs {formatQty(recipeQuantity, recipeQuantityUnit)}
        </Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
          </View>
        ) : loadError ? (
          <TouchableOpacity
            style={styles.errorWrap}
            onPress={loadLots}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Retry loading lots"
          >
            <Text style={styles.errorText}>{loadError}</Text>
          </TouchableOpacity>
        ) : entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              No lots available for this supply. Add a lot first.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {entries.map((entry) => {
              const incompat = entry.recipeUnitFactor === null;
              const checked = selectedLotIds.has(entry.lot.id);
              const qty = qtyByLotId[entry.lot.id] ?? '';
              return (
                <View
                  key={entry.lot.id}
                  style={[styles.lotItem, incompat && styles.lotItemDisabled]}
                >
                  <TouchableOpacity
                    style={styles.lotItemSelectArea}
                    onPress={() => toggleSelect(entry.lot.id, incompat)}
                    activeOpacity={incompat ? 1 : 0.7}
                    disabled={incompat}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: incompat }}
                    accessibilityLabel={`${
                      checked ? 'Deselect' : 'Select'
                    } lot in ${entry.lot.storage_location}, ${formatQty(
                      entry.lot.quantity,
                      entry.lot.quantity_unit
                    )}`}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        checked ? styles.checkboxOn : styles.checkboxOff,
                      ]}
                    >
                      {checked && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <View style={styles.lotRowWrap}>
                      <LotRow lot={entry.lot} showVariantInline />
                      {incompat && (
                        <Text style={styles.incompatHint}>
                          Can't combine with recipe unit ({recipeQuantityUnit})
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TextInput
                    style={[
                      styles.qtyInput,
                      (!checked || incompat) && styles.qtyInputDisabled,
                    ]}
                    value={qty}
                    onChangeText={(v) => setQty(entry.lot.id, v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.text.tertiary}
                    editable={checked && !incompat && !confirming}
                    accessibilityLabel={`Quantity drawn from lot, in ${entry.lot.quantity_unit}`}
                  />
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <View style={styles.totalWrap}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Total: </Text>
              <Text style={styles.totalValue}>
                {formatQty(selectedTotalInRecipeUnit, recipeQuantityUnit)} /{' '}
                {formatQty(recipeQuantity, recipeQuantityUnit)}
              </Text>
              {showShortfallHint && (
                <Text style={styles.shortfallMarker}> ?</Text>
              )}
            </View>
            {showShortfallHint && (
              <Text style={styles.shortfallHint}>
                {formatQty(shortfall, recipeQuantityUnit)} short
              </Text>
            )}
            {confirmError && (
              <Text style={styles.confirmErrorText}>{confirmError}</Text>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!canConfirm || confirming) && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!canConfirm || confirming}
            accessibilityRole="button"
            accessibilityLabel="Confirm lot selection"
          >
            {confirming ? (
              <Text style={styles.confirmButtonText}>…</Text>
            ) : (
              <Text style={styles.confirmButtonText}>Confirm</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  functionalColors: ReturnType<typeof useTheme>['functionalColors']
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
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
      flexShrink: 1,
      paddingRight: spacing.sm,
    },
    closeText: {
      fontSize: 20,
      color: colors.text.secondary,
      paddingHorizontal: 6,
    },
    subheader: {
      fontSize: 13,
      color: colors.text.secondary,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    body: {
      flex: 1,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorWrap: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    errorText: {
      fontSize: 14,
      color: functionalColors.error,
      textAlign: 'center',
    },
    emptyWrap: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
    lotItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      gap: spacing.sm,
    },
    lotItemDisabled: {
      opacity: 0.5,
    },
    lotItemSelectArea: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: spacing.sm,
      minHeight: 44, // tap target
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxOff: {
      backgroundColor: 'transparent',
      borderColor: colors.border.medium,
    },
    checkboxMark: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: typography.weights.bold,
    },
    lotRowWrap: {
      flex: 1,
    },
    incompatHint: {
      fontSize: 11,
      color: colors.text.tertiary,
      marginTop: 2,
      paddingHorizontal: 6,
    },
    qtyInput: {
      width: 70,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      paddingVertical: 6,
      paddingHorizontal: 8,
      fontSize: 14,
      color: colors.text.primary,
      backgroundColor: colors.background.card,
      textAlign: 'right',
    },
    qtyInputDisabled: {
      opacity: 0.4,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      gap: spacing.md,
    },
    totalWrap: {
      flex: 1,
    },
    totalLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
    },
    totalValue: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    shortfallMarker: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      fontWeight: typography.weights.bold,
    },
    shortfallHint: {
      fontSize: 11,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    confirmErrorText: {
      fontSize: 11,
      color: functionalColors.error,
      marginTop: 4,
    },
    confirmButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
      minWidth: 90,
      alignItems: 'center',
    },
    confirmButtonDisabled: {
      opacity: 0.5,
    },
    confirmButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: typography.weights.semibold,
    },
  });
}
