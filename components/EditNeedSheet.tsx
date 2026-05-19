// ============================================
// FRIGO - EDIT NEED SHEET (Phase 8R-CP6b, Tab 9 long-press)
// ============================================
// Opens via long-press on a need row in ViewDetailScreen, OR via the spawn
// toast's Edit action. Configure form: quantity, unit, tags, for-user, notes.
//
// Conditional "Update default routing" toggle per D8R-Q34: appears ONLY when
// (need.supply_id is set) AND (the form's tag IDs differ from the supply's
// tag IDs). Toggle ON → Save also calls setSupplyTags(supply.id, formTagIds)
// so future restocks inherit the new tag set.
//
// Tag-picker pattern is inlined (matches AddNeedSheet + ViewCreatorModal +
// SupplyCreateSheet); P8R-D14 captures shared <TagDimensionPicker> as future
// cleanup once a 4th consumer arrives.
// Location: components/EditNeedSheet.tsx
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  deleteNeed,
  getNeedById,
  updateNeed,
} from '../lib/services/needsService';
import { getSupplyById } from '../lib/services/suppliesService';
import {
  getOrCreateTag,
  getTagsForSpace,
  setSupplyTags,
} from '../lib/services/tagsService';
import { NeedWithDetails } from '../lib/types/needs';
import { SupplyWithTags } from '../lib/types/supplies';
import { Tag, TagDimension } from '../lib/types/tags';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import UnitPicker from './UnitPicker';

const TAG_DIMENSIONS: TagDimension[] = ['urgency', 'store', 'recipe'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  spaceId: string;
  userId: string | null;
  needId: string | null;
}

export default function EditNeedSheet({
  visible,
  onClose,
  onSaved,
  spaceId,
  userId,
  needId,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  const [need, setNeed] = useState<NeedWithDetails | null>(null);
  const [supply, setSupply] = useState<SupplyWithTags | null>(null);
  const [loading, setLoading] = useState(false);

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [updateRouting, setUpdateRouting] = useState(false);

  const [tagsByDimension, setTagsByDimension] = useState<Record<TagDimension, Tag[]>>({
    urgency: [],
    store: [],
    recipe: [],
    event: [],
    storage: [],
  });
  const [selectedTagsByDimension, setSelectedTagsByDimension] = useState<
    Record<TagDimension, string[]>
  >({
    urgency: [],
    store: [],
    recipe: [],
    event: [],
    storage: [],
  });
  const [newTagInput, setNewTagInput] = useState<Record<TagDimension, string>>({
    urgency: '',
    store: '',
    recipe: '',
    event: '',
    storage: '',
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !needId) {
      setNeed(null);
      setSupply(null);
      return;
    }
    setLoading(true);
    setUpdateRouting(false);
    setNewTagInput({ urgency: '', store: '', recipe: '', event: '', storage: '' });

    (async () => {
      try {
        const [needData, tagsData] = await Promise.all([
          getNeedById(needId),
          getTagsForSpace(spaceId),
        ]);
        setNeed(needData);

        // Hydrate tag catalog grouped by dimension.
        const grouped: Record<TagDimension, Tag[]> = {
          urgency: [],
          store: [],
          recipe: [],
          event: [],
          storage: [],
        };
        for (const t of tagsData) {
          if (t.dimension in grouped) grouped[t.dimension].push(t);
        }
        setTagsByDimension(grouped);

        if (!needData) {
          setLoading(false);
          return;
        }

        // Pre-populate form fields from need.
        setQuantity(
          needData.quantity_display !== null && needData.quantity_display !== undefined
            ? String(needData.quantity_display)
            : ''
        );
        setUnit(needData.unit_display ?? '');
        setNotes(needData.notes ?? '');

        const initial: Record<TagDimension, string[]> = {
          urgency: [],
          store: [],
          recipe: [],
          event: [],
          storage: [],
        };
        for (const t of needData.tags) {
          if (t.dimension in initial) {
            initial[t.dimension as TagDimension].push(t.value);
          }
        }
        setSelectedTagsByDimension(initial);

        // Hydrate parent supply if linked (for the conditional routing toggle).
        if (needData.supply_id) {
          try {
            const supplyData = await getSupplyById(needData.supply_id);
            setSupply(supplyData);
          } catch (error) {
            console.error('❌ EditNeedSheet supply hydrate error:', error);
            setSupply(null);
          }
        } else {
          setSupply(null);
        }
      } catch (error) {
        console.error('❌ EditNeedSheet hydrate error:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, needId, spaceId]);

  // Sync best-effort: only finds tag IDs already cached in tagsByDimension.
  // Used for the routing-toggle visibility check, where false positives
  // (toggle appearing because some uncached value lacks an ID) are acceptable.
  const collectAllSelectedTagIds = (): string[] => {
    const ids: string[] = [];
    for (const dim of TAG_DIMENSIONS) {
      for (const v of selectedTagsByDimension[dim]) {
        const tag = tagsByDimension[dim].find(
          (t) => t.value.toLowerCase() === v.toLowerCase()
        );
        if (tag) ids.push(tag.id);
      }
    }
    return ids;
  };

  /**
   * CP6d-SmokeFix-3 (V19 root cause): full-fidelity tag-id resolution for
   * save. Falls back to `getOrCreateTag` for any selected value that isn't
   * yet in the cached `tagsByDimension`. Async; used by handleSave only.
   */
  const resolveAllSelectedTagIds = async (): Promise<string[]> => {
    if (!userId) return collectAllSelectedTagIds();
    const ids: string[] = [];
    for (const dim of TAG_DIMENSIONS) {
      for (const v of selectedTagsByDimension[dim]) {
        const cached = tagsByDimension[dim].find(
          (t) => t.value.toLowerCase() === v.toLowerCase()
        );
        if (cached) {
          ids.push(cached.id);
        } else {
          try {
            const created = await getOrCreateTag(spaceId, dim, v, userId);
            ids.push(created.id);
          } catch (error) {
            console.error('❌ resolveAllSelectedTagIds error:', error);
          }
        }
      }
    }
    return ids;
  };

  // Routing toggle visibility: supply linked AND form tagIds differ from supply tagIds.
  const showRoutingToggle = useMemo(() => {
    if (!supply) return false;
    const formIds = new Set(collectAllSelectedTagIds());
    const supplyIds = new Set(supply.tags.map((t) => t.id));
    if (formIds.size !== supplyIds.size) return true;
    for (const id of formIds) if (!supplyIds.has(id)) return true;
    return false;
  }, [supply, selectedTagsByDimension, tagsByDimension]);

  const toggleTagSelection = (dimension: TagDimension, value: string) => {
    setSelectedTagsByDimension((prev) => {
      const current = prev[dimension];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [dimension]: next };
    });
  };

  const handleAddNewTag = async (dimension: TagDimension) => {
    if (!userId) return;
    const value = newTagInput[dimension].trim();
    if (!value) return;
    try {
      const tag = await getOrCreateTag(spaceId, dimension, value, userId);
      setTagsByDimension((prev) => ({
        ...prev,
        [dimension]: prev[dimension].some((t) => t.id === tag.id)
          ? prev[dimension]
          : [...prev[dimension], tag],
      }));
      setSelectedTagsByDimension((prev) => ({
        ...prev,
        [dimension]: prev[dimension].includes(tag.value)
          ? prev[dimension]
          : [...prev[dimension], tag.value],
      }));
      setNewTagInput((prev) => ({ ...prev, [dimension]: '' }));
    } catch (error) {
      console.error('❌ getOrCreateTag error:', error);
      Alert.alert('Error', 'Could not add tag. Try again.');
    }
  };

  const handleSave = async () => {
    if (submitting || !need) return;

    const trimmedQty = quantity.trim();
    const qtyNum = trimmedQty === '' ? null : Number(trimmedQty);
    if (trimmedQty !== '' && (Number.isNaN(qtyNum) || (qtyNum !== null && qtyNum <= 0))) {
      Alert.alert('Quantity', 'Quantity must be a positive number or empty.');
      return;
    }

    setSubmitting(true);
    try {
      const tagIds = await resolveAllSelectedTagIds();

      await updateNeed(need.id, {
        quantityDisplay: qtyNum,
        unitDisplay: unit.trim() || null,
        notes: notes.trim() || null,
        tagIds,
      });

      if (updateRouting && supply) {
        await setSupplyTags(supply.id, tagIds);
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('❌ EditNeedSheet save error:', error);
      Alert.alert('Error', 'Could not update. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!need) return;
    const displayName =
      need.ingredient?.name ?? need.custom_name ?? 'this need';
    Alert.alert(
      `Delete ${displayName}?`,
      'This removes the need from your list. You can always add it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await deleteNeed(need.id);
              onSaved();
              onClose();
            } catch (error) {
              console.error('❌ EditNeedSheet delete error:', error);
              Alert.alert('Error', 'Could not delete. Try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const renderTagDimensionSection = (dimension: TagDimension, label: string) => {
    const tags = tagsByDimension[dimension];
    const selectedValues = selectedTagsByDimension[dimension];
    return (
      <View key={dimension} style={styles.section}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <View style={styles.chipsRow}>
          {tags.map((tag) => {
            const isSelected = selectedValues.includes(tag.value);
            return (
              <TouchableOpacity
                key={tag.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleTagSelection(dimension, tag.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.chipText, isSelected && styles.chipTextSelected]}
                >
                  {tag.value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.addTagRow}>
          <TextInput
            style={styles.addTagInput}
            value={newTagInput[dimension]}
            onChangeText={(v) =>
              setNewTagInput((prev) => ({ ...prev, [dimension]: v }))
            }
            placeholder={`+ Add new ${dimension}`}
            placeholderTextColor={colors.text.placeholder}
            onSubmitEditing={() => handleAddNewTag(dimension)}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={styles.addTagButton}
            onPress={() => handleAddNewTag(dimension)}
            disabled={!newTagInput[dimension].trim()}
            activeOpacity={0.7}
          >
            <Text style={styles.addTagButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const displayName =
    need?.ingredient?.name ?? need?.custom_name ?? 'Need';
  const supplyName =
    supply?.ingredient?.name ?? supply?.custom_name ?? 'supply';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.kavWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} disabled={submitting}>
                <Text style={styles.headerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit need</Text>
              <TouchableOpacity onPress={handleSave} disabled={submitting || !need}>
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={[
                      styles.headerSave,
                      (!need) && styles.headerSaveDisabled,
                    ]}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {loading || !need ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView
                style={styles.body}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.bodyContent}
              >
                <Text style={styles.displayName}>{displayName}</Text>

                <View style={styles.qtyRow}>
                  <View style={styles.qtyField}>
                    <Text style={styles.fieldLabel}>Quantity</Text>
                    <TextInput
                      style={styles.qtyInput}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                      placeholder="(optional)"
                      placeholderTextColor={colors.text.placeholder}
                    />
                  </View>
                  <View style={styles.unitField}>
                    <Text style={styles.fieldLabel}>Unit</Text>
                    {need?.ingredient_id ? (
                      // CP6d-Sheets (Gap-G35): UnitPicker for catalog-linked
                      // needs. Falls back to TextInput for custom_name needs
                      // (no ingredient_id → UnitPicker can't load common units).
                      <UnitPicker
                        ingredientId={need.ingredient_id}
                        selectedUnit={unit || null}
                        onSelectUnit={(_unitId, displayName) =>
                          setUnit(displayName)
                        }
                      />
                    ) : (
                      <TextInput
                        style={styles.unitInput}
                        value={unit}
                        onChangeText={setUnit}
                        placeholder="unit"
                        placeholderTextColor={colors.text.placeholder}
                        autoCapitalize="none"
                      />
                    )}
                  </View>
                </View>

                {renderTagDimensionSection('urgency', 'Urgency')}
                {renderTagDimensionSection('store', 'Store')}
                {renderTagDimensionSection('recipe', 'Recipe')}

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>For-user</Text>
                  <Text style={styles.lockedHint}>
                    Inherited from supply / Everyone (default). Per-user picker coming in a future CP.
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional"
                    placeholderTextColor={colors.text.placeholder}
                    multiline
                  />
                </View>

                {showRoutingToggle && supply && (
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleBody}>
                      <Text style={styles.toggleLabel}>Update default routing</Text>
                      <Text style={styles.toggleHint}>
                        Apply these tags to {supplyName} as the default for future restocks.
                      </Text>
                    </View>
                    <Switch value={updateRouting} onValueChange={setUpdateRouting} />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  disabled={submitting}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Delete need"
                >
                  <Text style={styles.deleteButtonText}>Delete need</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
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
    kavWrap: { width: '100%' },
    sheet: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    headerCancel: { fontSize: 15, color: colors.text.secondary },
    headerSave: {
      fontSize: 15,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    headerSaveDisabled: { color: colors.text.tertiary },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    body: { maxHeight: '100%' },
    bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    displayName: {
      fontSize: 18,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
      paddingVertical: spacing.md,
    },
    section: { paddingVertical: spacing.md },
    sectionLabel: {
      fontSize: 13,
      fontWeight: typography.weights.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    lockedHint: { fontSize: 12, color: colors.text.tertiary },
    qtyRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: spacing.md,
    },
    qtyField: { flex: 1 },
    unitField: { flex: 1 },
    fieldLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    qtyInput: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      fontSize: 15,
      color: colors.text.primary,
      backgroundColor: colors.background.secondary,
    },
    unitInput: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      fontSize: 15,
      color: colors.text.primary,
      backgroundColor: colors.background.secondary,
    },
    notesInput: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      fontSize: 15,
      color: colors.text.primary,
      backgroundColor: colors.background.secondary,
      minHeight: 60,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: 'transparent',
    },
    chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.text.secondary },
    chipTextSelected: {
      color: '#ffffff',
      fontWeight: typography.weights.medium,
    },
    addTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    addTagInput: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: borderRadius.sm,
      fontSize: 14,
      color: colors.text.primary,
      backgroundColor: colors.background.secondary,
    },
    addTagButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
    },
    addTagButtonText: {
      fontSize: 13,
      color: '#ffffff',
      fontWeight: typography.weights.semibold,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      marginTop: spacing.md,
    },
    toggleBody: { flex: 1 },
    toggleLabel: {
      fontSize: 15,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    toggleHint: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    deleteButton: {
      marginTop: spacing.lg,
      paddingVertical: 12,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: functionalColors.error,
      alignItems: 'center',
    },
    deleteButtonText: {
      fontSize: 14,
      color: functionalColors.error,
      fontWeight: typography.weights.semibold,
    },
  });
}
