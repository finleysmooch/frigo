// ============================================
// FRIGO — LOT EDIT SHEET (Phase 8R-CP6e-PantryUI-b)
// ============================================
// Modal sheet for creating + editing individual lots on a tracks_lots supply.
// Discriminated by presence of `lot` prop — undefined = create, present = edit.
//
// Sections (per wireframe v2 Tab 6):
//   1. Quantity + Unit
//   2. Storage (segmented)
//   3. Variant label (disclosure-toggled)
//   4. Brand
//   5. Acquired at (date)
//   6. Expires at (date, with "(auto)" hint when computed default)
//   7. Notes
//   Actions: Cancel · Save · Mark consumed (edit mode only)
//
// Q-rule wiring:
//   D8R-Q47: storage change in edit mode (when expires_at_overridden=false)
//            recomputes expires_at — routed through lotsService.moveLotStorage
//   D8R-Q48: "Mark consumed" calls archiveLot
//
// Storage synonym fallback: 'pantry' when supply.storage_location is null.
// Location: components/pantry/LotEditSheet.tsx
// ============================================

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  archiveLot,
  createLot,
  moveLotStorage,
  updateLot,
} from '../../lib/services/lotsService';
import type {
  CreateLotParams,
  StorageLocation,
  SupplyLot,
  SupplyWithTags,
  UpdateLotParams,
} from '../../lib/types/supplies';
import { useTheme } from '../../lib/theme/ThemeContext';
import { borderRadius, spacing, typography } from '../../lib/theme';
import DateTimePicker from '../DateTimePicker';

const STORAGE_OPTIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'counter'];

const DAY_MS = 24 * 60 * 60 * 1000;

interface LotEditSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (lot: SupplyLot) => void;
  onArchived?: (lotId: string) => void;
  supply: SupplyWithTags;
  lot?: SupplyLot;
}

function pickShelfLifeDays(
  storage: StorageLocation,
  ing: {
    shelf_life_days_fridge?: number | null;
    shelf_life_days_freezer?: number | null;
    shelf_life_days_pantry?: number | null;
  } | null | undefined
): number | null {
  if (!ing) return null;
  switch (storage) {
    case 'freezer':
      return ing.shelf_life_days_freezer ?? null;
    case 'fridge':
      return ing.shelf_life_days_fridge ?? null;
    case 'pantry':
    case 'counter':
      return ing.shelf_life_days_pantry ?? null;
  }
}

function formatDateDisplay(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isoFromDate(d: Date): string {
  return d.toISOString();
}

function dateFromIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function LotEditSheet({
  visible,
  onClose,
  onSaved,
  onArchived,
  supply,
  lot,
}: LotEditSheetProps) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  const isEdit = lot !== undefined;

  // ----- Local form state -----
  const [quantityText, setQuantityText] = useState('');
  const [unit, setUnit] = useState('');
  const [storage, setStorage] = useState<StorageLocation>('pantry');
  const [variantLabel, setVariantLabel] = useState('');
  const [showVariant, setShowVariant] = useState(false);
  const [brand, setBrand] = useState('');
  const [acquiredAt, setAcquiredAt] = useState<Date>(new Date());
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [expiresAtTouched, setExpiresAtTouched] = useState(false);
  const [notes, setNotes] = useState('');

  const [showAcquiredPicker, setShowAcquiredPicker] = useState(false);
  const [showExpiresPicker, setShowExpiresPicker] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ingredient shelf-life data — used for default expiration on storage change.
  const ingredient = supply.ingredient as
    | (typeof supply.ingredient & {
        shelf_life_days_fridge?: number | null;
        shelf_life_days_freezer?: number | null;
        shelf_life_days_pantry?: number | null;
        typical_unit?: string | null;
      })
    | null;

  // Compute the auto-default expires_at from current acquiredAt + storage.
  const computedDefaultExpires: Date | null = useMemo(() => {
    const shelfDays = pickShelfLifeDays(storage, ingredient);
    if (shelfDays === null) return null;
    return new Date(acquiredAt.getTime() + shelfDays * DAY_MS);
  }, [acquiredAt, storage, ingredient]);

  // ----- Initialize / reset on open -----
  useEffect(() => {
    if (!visible) return;
    setErrorMessage(null);

    if (lot) {
      // Edit mode — hydrate from the lot row.
      setQuantityText(String(lot.quantity));
      setUnit(lot.quantity_unit);
      setStorage(lot.storage_location);
      setVariantLabel(lot.variant_label ?? '');
      setShowVariant((lot.variant_label ?? '').length > 0);
      setBrand(lot.brand ?? '');
      setAcquiredAt(dateFromIso(lot.acquired_at) ?? new Date());
      setExpiresAt(dateFromIso(lot.expires_at));
      setExpiresAtTouched(false);
      setNotes(lot.notes ?? '');
    } else {
      // Create mode — defaults from supply context.
      setQuantityText('');
      const defaultUnit =
        ingredient?.typical_unit ??
        // Last-lot's unit isn't directly accessible without re-fetching; the
        // SupplyWithTags.lots? array (when hydrated via includeLots) gives us
        // that signal. Pick the most-recently-acquired lot's unit if any.
        (supply.lots && supply.lots.length > 0
          ? [...supply.lots]
              .sort((a, b) => b.acquired_at.localeCompare(a.acquired_at))[0]
              .quantity_unit
          : '');
      setUnit(defaultUnit);
      setStorage(supply.storage_location ?? 'pantry');
      setVariantLabel('');
      setShowVariant(false);
      setBrand('');
      const now = new Date();
      setAcquiredAt(now);
      // Computed default expiration; if no shelf-life data the user picks
      // manually and it stays null until they touch the picker.
      const shelfDays = pickShelfLifeDays(supply.storage_location ?? 'pantry', ingredient);
      setExpiresAt(shelfDays !== null ? new Date(now.getTime() + shelfDays * DAY_MS) : null);
      setExpiresAtTouched(false);
      setNotes('');
    }
  }, [visible, lot, supply, ingredient]);

  // While in edit mode, when user changes storage AND override is false,
  // locally recompute the displayed expires_at so the (auto) hint stays
  // truthful. Server-side, the moveLotStorage call on save will mirror this.
  useEffect(() => {
    if (!visible || expiresAtTouched) return;
    if (!isEdit) return; // create mode already recomputes via initial-set
    if (!lot) return;
    if (lot.expires_at_overridden) return;
    if (storage === lot.storage_location) return;
    if (computedDefaultExpires) {
      setExpiresAt(computedDefaultExpires);
    }
    // Don't reset null → null.
  }, [storage, visible, expiresAtTouched, isEdit, lot, computedDefaultExpires]);

  // ----- Validation -----
  const quantityNumber = useMemo(() => {
    const n = parseFloat(quantityText);
    return Number.isFinite(n) ? n : NaN;
  }, [quantityText]);
  const quantityValid = Number.isFinite(quantityNumber) && quantityNumber > 0;
  const unitValid = unit.trim().length > 0;
  const canSave = quantityValid && unitValid && !busy;

  // ----- Save path -----
  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    setErrorMessage(null);

    try {
      if (!isEdit) {
        // CREATE
        const params: CreateLotParams = {
          supply_id: supply.id,
          quantity: quantityNumber,
          quantity_unit: unit.trim(),
          storage_location: storage,
          acquired_at: isoFromDate(acquiredAt),
        };
        // Only pass expires_at when the user touched it OR when a computed
        // default exists. If neither, omit → lotsService computes from shelf
        // life (which is equivalent to what we'd send), so this avoids
        // marking expires_at_overridden=true incorrectly.
        if (expiresAtTouched && expiresAt) {
          params.expires_at = isoFromDate(expiresAt);
        }
        if (variantLabel.trim().length > 0) {
          params.variant_label = variantLabel.trim();
        }
        if (brand.trim().length > 0) params.brand = brand.trim();
        if (notes.trim().length > 0) params.notes = notes.trim();

        const created = await createLot(params);
        onSaved(created);
        onClose();
        return;
      }

      // EDIT
      if (!lot) {
        // defensive — isEdit implies lot is defined
        throw new Error('Edit mode requires lot');
      }

      const storageChanged = storage !== lot.storage_location;
      const overrideCurrent = lot.expires_at_overridden;

      // Compute the field-level patch (only include changed fields).
      const patch: UpdateLotParams = {};
      if (Math.abs(quantityNumber - lot.quantity) > 1e-9) patch.quantity = quantityNumber;
      if (unit.trim() !== lot.quantity_unit) patch.quantity_unit = unit.trim();
      const acquiredIso = isoFromDate(acquiredAt);
      if (acquiredIso !== lot.acquired_at) patch.acquired_at = acquiredIso;
      if (expiresAtTouched) {
        patch.expires_at = expiresAt ? isoFromDate(expiresAt) : undefined;
      }
      const trimmedVariant = variantLabel.trim() === '' ? null : variantLabel.trim();
      if (trimmedVariant !== (lot.variant_label ?? null)) patch.variant_label = trimmedVariant;
      const trimmedBrand = brand.trim() === '' ? null : brand.trim();
      if (trimmedBrand !== (lot.brand ?? null)) patch.brand = trimmedBrand;
      const trimmedNotes = notes.trim() === '' ? null : notes.trim();
      if (trimmedNotes !== (lot.notes ?? null)) patch.notes = trimmedNotes;

      // Routing:
      //  - storage changed AND override is false → moveLotStorage handles
      //    expires_at recompute; then updateLot for any remaining fields.
      //  - storage changed AND override is true → use plain updateLot for
      //    everything (moveLotStorage would preserve the override anyway,
      //    but plain updateLot is simpler since recompute is a no-op).
      //  - storage unchanged → plain updateLot.
      let result: SupplyLot = lot;
      if (storageChanged && !overrideCurrent) {
        const moveResult = await moveLotStorage(lot.id, storage);
        result = moveResult.lot;
        // Apply remaining patch (exclude storage_location since moveLotStorage
        // already set it, and exclude expires_at since the recompute owns it
        // when not overridden).
        const remaining: UpdateLotParams = { ...patch };
        delete remaining.storage_location;
        delete remaining.expires_at;
        if (Object.keys(remaining).length > 0) {
          result = await updateLot(lot.id, remaining);
        }
      } else {
        if (storageChanged) patch.storage_location = storage;
        if (Object.keys(patch).length > 0) {
          result = await updateLot(lot.id, patch);
        }
      }

      onSaved(result);
      onClose();
    } catch (err) {
      console.error('❌ LotEditSheet save error:', err);
      const msg = err instanceof Error ? err.message : 'Could not save lot.';
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  };

  // ----- Mark consumed (edit mode only) -----
  const handleMarkConsumed = () => {
    if (!isEdit || !lot) return;
    Alert.alert(
      'Mark this lot as consumed?',
      'It will be removed from your active lots.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark consumed',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await archiveLot(lot.id);
              onArchived?.(lot.id);
              onClose();
            } catch (err) {
              console.error('❌ LotEditSheet archive error:', err);
              const msg = err instanceof Error ? err.message : 'Could not archive lot.';
              setErrorMessage(msg);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const showAutoHint = !expiresAtTouched && expiresAt !== null && computedDefaultExpires !== null;
  const showManualHint = !expiresAtTouched && expiresAt === null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isEdit ? 'Edit lot' : 'Add lot'}</Text>
            <TouchableOpacity
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.headerCloseButton}
            >
              <Text style={styles.headerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subheader} numberOfLines={1}>
            {supply.ingredient?.name ?? supply.custom_name ?? 'Supply'}
          </Text>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.bodyContent}
          >
            {/* Quantity + Unit */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quantity</Text>
              <View style={styles.qtyUnitRow}>
                <TextInput
                  style={[styles.input, styles.qtyInput]}
                  keyboardType="decimal-pad"
                  value={quantityText}
                  onChangeText={setQuantityText}
                  placeholder="0"
                  placeholderTextColor={colors.text.tertiary}
                  editable={!busy}
                  accessibilityLabel="Quantity"
                />
                <TextInput
                  style={[styles.input, styles.unitInput]}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="unit"
                  placeholderTextColor={colors.text.tertiary}
                  autoCorrect={false}
                  autoCapitalize="none"
                  editable={!busy}
                  accessibilityLabel="Unit"
                />
              </View>
              {!quantityValid && quantityText.length > 0 && (
                <Text style={styles.fieldError}>
                  Quantity must be greater than 0 (use "Mark consumed" to archive).
                </Text>
              )}
              {!unitValid && (
                <Text style={styles.fieldError}>Unit is required.</Text>
              )}
            </View>

            {/* Storage */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Storage</Text>
              <View style={styles.segmentedRow}>
                {STORAGE_OPTIONS.map((opt) => {
                  const active = storage === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.storageSegment, active && styles.storageSegmentActive]}
                      onPress={() => setStorage(opt)}
                      disabled={busy}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Storage: ${opt}`}
                    >
                      <Text
                        style={[
                          styles.storageSegmentText,
                          active && styles.storageSegmentTextActive,
                        ]}
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Variant label (disclosure) */}
            <View style={styles.section}>
              {!showVariant && variantLabel.trim().length === 0 ? (
                <TouchableOpacity
                  onPress={() => setShowVariant(true)}
                  disabled={busy}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Add variant label"
                >
                  <Text style={styles.disclosureText}>+ Add variant label</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Variant</Text>
                  <TextInput
                    style={styles.input}
                    value={variantLabel}
                    onChangeText={setVariantLabel}
                    placeholder="e.g., bone-in skin-on, fresh, frozen"
                    placeholderTextColor={colors.text.tertiary}
                    autoCapitalize="none"
                    editable={!busy}
                    accessibilityLabel="Variant label"
                  />
                </>
              )}
            </View>

            {/* Brand */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Brand</Text>
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="(optional)"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="words"
                editable={!busy}
                accessibilityLabel="Brand"
              />
            </View>

            {/* Acquired at */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Acquired</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowAcquiredPicker(true)}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Acquired date: ${formatDateDisplay(acquiredAt)}`}
              >
                <Text style={styles.dateButtonText}>{formatDateDisplay(acquiredAt)}</Text>
              </TouchableOpacity>
            </View>

            {/* Expires at */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Expires</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowExpiresPicker(true)}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Expires date: ${
                  expiresAt ? formatDateDisplay(expiresAt) : 'not set'
                }`}
              >
                <Text style={styles.dateButtonText}>
                  {expiresAt ? formatDateDisplay(expiresAt) : 'Tap to set'}
                </Text>
                {showAutoHint && <Text style={styles.dateButtonHint}>(auto)</Text>}
                {showManualHint && <Text style={styles.dateButtonHint}>(set manually)</Text>}
              </TouchableOpacity>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="(optional)"
                placeholderTextColor={colors.text.tertiary}
                multiline
                editable={!busy}
                accessibilityLabel="Notes"
              />
            </View>

            {errorMessage && (
              <View style={styles.errorBlock}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {isEdit && (
              <View style={styles.destructiveBlock}>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.markConsumedButton}
                  onPress={handleMarkConsumed}
                  disabled={busy}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Mark lot as consumed"
                >
                  <Text style={styles.markConsumedText}>Mark consumed</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Save lot"
            >
              {busy ? (
                <ActivityIndicator color={colors.text.inverse ?? '#fff'} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <DateTimePicker
            visible={showAcquiredPicker}
            onClose={() => setShowAcquiredPicker(false)}
            onSelect={(d) => {
              setAcquiredAt(d);
              setShowAcquiredPicker(false);
            }}
            initialDate={acquiredAt}
            mode="date"
            quickSelectPreset="past"
          />
          <DateTimePicker
            visible={showExpiresPicker}
            onClose={() => setShowExpiresPicker(false)}
            onSelect={(d) => {
              setExpiresAt(d);
              setExpiresAtTouched(true);
              setShowExpiresPicker(false);
            }}
            initialDate={expiresAt ?? new Date()}
            mode="date"
            quickSelectPreset="future"
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  functionalColors: ReturnType<typeof useTheme>['functionalColors']
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '92%',
      paddingBottom: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    headerCloseButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCloseText: {
      fontSize: 18,
      color: colors.text.secondary,
    },
    subheader: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      color: colors.text.tertiary,
      fontSize: typography.sizes.sm,
    },
    body: {
      paddingHorizontal: spacing.lg,
    },
    bodyContent: {
      paddingBottom: spacing.md,
    },
    section: {
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.semibold,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      backgroundColor: colors.background.surface,
    },
    qtyUnitRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    qtyInput: {
      flex: 1,
    },
    unitInput: {
      flex: 1,
    },
    notesInput: {
      minHeight: 60,
      textAlignVertical: 'top',
    },
    fieldError: {
      color: functionalColors.error,
      fontSize: 12,
      marginTop: 4,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: 4,
    },
    storageSegment: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border.light,
      backgroundColor: colors.background.surface,
      alignItems: 'center',
    },
    storageSegmentActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    storageSegmentText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    storageSegmentTextActive: {
      color: '#ffffff',
    },
    disclosureText: {
      fontSize: typography.sizes.sm,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border.light,
      backgroundColor: colors.background.surface,
      gap: spacing.sm,
    },
    dateButtonText: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    dateButtonHint: {
      fontSize: 11,
      color: colors.text.tertiary,
    },
    errorBlock: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: borderRadius.sm,
      backgroundColor: functionalColors.error + '22',
    },
    errorText: {
      color: functionalColors.error,
      fontSize: typography.sizes.sm,
    },
    destructiveBlock: {
      marginTop: spacing.md,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.light,
      marginBottom: spacing.md,
    },
    markConsumedButton: {
      paddingVertical: 12,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: functionalColors.error,
      backgroundColor: 'transparent',
      alignItems: 'center',
    },
    markConsumedText: {
      color: functionalColors.error,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border.light,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.text.secondary,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium,
    },
    saveButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: '#ffffff',
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
    },
  });
}
