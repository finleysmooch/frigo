// ============================================
// FRIGO - NEED QUICK-EDIT MODAL (Phase 8R-UX1)
// ============================================
// Lightweight inline editor opened from the Edit button on SpawnOnOutToast
// (and potentially TrackOnlyOutToast). Lets the user tweak the just-spawned
// need's quantity, unit, and notes without leaving the current screen.
//
// App-level mount (no navigation context). Stateful within the modal —
// caller provides needId + initial display name, modal calls updateNeed and
// fires onSaved/onCancel.
// Location: components/NeedQuickEditModal.tsx
// ============================================

import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { updateNeed } from '../lib/services/needsService';
import { getTagsForSpace, getOrCreateTag } from '../lib/services/tagsService';
import { Tag } from '../lib/types/tags';
import { supabase } from '../lib/supabase';

export interface NeedQuickEditModalProps {
  visible: boolean;
  needId: string | null;
  spaceId: string | null;
  displayName: string;
  onSaved: () => void;
  onCancel: () => void;
}

// 8R-UX1: "Lists" map onto the existing urgency-tag system. The three
// default views (Short / Medium / Long) are driven by these tag values:
//   Short List   = urgency tag value 'today'      (Tonight view)
//   Medium List  = urgency tag value 'this week'  (This Week view)
//   Long List    = no urgency tag                 (All needs view)
// Custom lists the user adds via "+ Add new list" become new urgency tags.
// 8R-UX1: tag values must match what the default view filters look for.
// See phase_8r_cp1_schema_migration.sql — Tonight view filters urgency=today,
// This Week view filters urgency=this-week (hyphenated). Using the wrong
// slug silently fails: the tag is created, but the view doesn't match it.
const SHORT_LIST_TAG_VALUE = 'today';
const MEDIUM_LIST_TAG_VALUE = 'this-week';

type ListChoice =
  | { kind: 'short' }
  | { kind: 'medium' }
  | { kind: 'long' }
  | { kind: 'custom'; tagId: string };

function listChoiceEqual(a: ListChoice | null, b: ListChoice | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'custom' && b.kind === 'custom') return a.tagId === b.tagId;
  return true;
}

export default function NeedQuickEditModal({
  visible,
  needId,
  spaceId,
  displayName,
  onSaved,
  onCancel,
}: NeedQuickEditModalProps) {
  const { colors, functionalColors } = useTheme();
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  // Custom (user-added) urgency tags excluding today/this week — those are
  // represented as the Short/Medium chips, not duplicated.
  const [customTags, setCustomTags] = useState<Tag[]>([]);
  const [selectedList, setSelectedList] = useState<ListChoice | null>(null);
  const [newListInput, setNewListInput] = useState('');
  const [saving, setSaving] = useState(false);

  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  // Load urgency tags whenever the modal becomes visible. Filter out
  // 'today' and 'this week' since those drive the built-in Short / Medium
  // chips — surfacing them again would be confusing duplicates.
  useEffect(() => {
    if (!visible || !spaceId) return;
    (async () => {
      try {
        const urgency = await getTagsForSpace(spaceId, 'urgency');
        // Filter out the underlying tag values that drive the built-in
        // chips. Also filter the spaced variant 'this week' in case it was
        // created during testing before the slug was hyphen-normalized.
        const custom = urgency.filter((t) => {
          const v = t.value.toLowerCase();
          return (
            v !== SHORT_LIST_TAG_VALUE &&
            v !== MEDIUM_LIST_TAG_VALUE &&
            v !== 'this week'
          );
        });
        setCustomTags(custom);
      } catch (error) {
        console.error('❌ NeedQuickEditModal urgency fetch:', error);
        setCustomTags([]);
      }
    })();
  }, [visible, spaceId]);

  const handleSelectList = (choice: ListChoice) => {
    setSelectedList((prev) => (listChoiceEqual(prev, choice) ? null : choice));
  };

  const handleAddListValue = async () => {
    if (!spaceId) return;
    const value = newListInput.trim().toLowerCase();
    if (!value) return;
    // Block creating duplicates of the built-in lists with the underlying
    // tag values — user should use the existing chip instead.
    if (value === SHORT_LIST_TAG_VALUE || value === MEDIUM_LIST_TAG_VALUE) {
      setNewListInput('');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const created = await getOrCreateTag(spaceId, 'urgency', value, user.id);
      setCustomTags((prev) =>
        prev.some((t) => t.id === created.id) ? prev : [...prev, created]
      );
      setSelectedList({ kind: 'custom', tagId: created.id });
      setNewListInput('');
    } catch (error) {
      console.error('❌ NeedQuickEditModal add list:', error);
    }
  };

  // Resolve the selected list to a tagIds value to pass into updateNeed.
  // Short/Medium need a get-or-create on the underlying urgency tag. Long
  // means empty array (clear urgency). Custom is the tag id we already have.
  const resolveTagIdsForSelection = async (): Promise<string[] | undefined> => {
    if (!selectedList || !spaceId) return undefined;
    if (selectedList.kind === 'long') return [];
    if (selectedList.kind === 'custom') return [selectedList.tagId];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;
    const value =
      selectedList.kind === 'short'
        ? SHORT_LIST_TAG_VALUE
        : MEDIUM_LIST_TAG_VALUE;
    const tag = await getOrCreateTag(spaceId, 'urgency', value, user.id);
    return [tag.id];
  };

  const handleSave = async () => {
    if (!needId || saving) return;
    setSaving(true);
    try {
      const trimmedQty = qty.trim();
      const trimmedUnit = unit.trim();
      const trimmedNotes = notes.trim();
      const qtyNumber = trimmedQty.length > 0 ? Number(trimmedQty) : null;
      // tagIds — when a list is selected we resolve to the right urgency
      // tag IDs (Short=today, Medium=this week, Long=[], Custom=tag id).
      // updateNeed's tagIds field replaces ALL tags via setNeedTags — for a
      // freshly-spawned need with no other tags this is fine. If this modal
      // is ever wired into a flow where the need has existing store/recipe
      // tags, switch to merging non-urgency tags + new urgency selection
      // instead of full replace. TODO marker for that case.
      const tagIds = await resolveTagIdsForSelection();
      await updateNeed(needId, {
        quantityDisplay: trimmedQty.length > 0
          ? Number.isFinite(qtyNumber) ? qtyNumber : undefined
          : undefined,
        unitDisplay: trimmedUnit.length > 0 ? trimmedUnit : undefined,
        notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
        tagIds,
      });
      resetState();
      onSaved();
    } catch (error) {
      console.error('❌ NeedQuickEditModal save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setQty('');
    setUnit('');
    setNotes('');
    setNewListInput('');
    setSelectedList(null);
  };

  const handleCancel = () => {
    resetState();
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={handleCancel}
        />
        <View style={styles.card}>
          <Text style={styles.title} numberOfLines={1}>
            Add {displayName} to grocery list
          </Text>
          <View style={styles.row}>
            <View style={styles.flex2}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={qty}
                onChangeText={setQty}
                placeholder="e.g. 1"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            <View style={styles.flex3}>
              <Text style={styles.label}>Unit</Text>
              <TextInput
                style={styles.input}
                value={unit}
                onChangeText={setUnit}
                placeholder="bottle, lb, …"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>
          </View>
          <Text style={styles.label}>List</Text>
          <View style={styles.chipRow}>
            {(['short', 'medium', 'long'] as const).map((kind) => {
              const choice: ListChoice = { kind };
              const selected = listChoiceEqual(selectedList, choice);
              const label =
                kind === 'short'
                  ? 'Short List'
                  : kind === 'medium'
                  ? 'Medium List'
                  : 'Long List';
              return (
                <TouchableOpacity
                  key={kind}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => handleSelectList(choice)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextSelected]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {customTags.map((tag) => {
              const choice: ListChoice = { kind: 'custom', tagId: tag.id };
              const selected = listChoiceEqual(selectedList, choice);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => handleSelectList(choice)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextSelected]}
                  >
                    {tag.value}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.addTagRow}>
            <TextInput
              style={[styles.input, styles.addTagInput]}
              value={newListInput}
              onChangeText={setNewListInput}
              placeholder="+ Add new list"
              placeholderTextColor={colors.text.tertiary}
              onSubmitEditing={handleAddListValue}
              returnKeyType="done"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.addTagButton}
              onPress={handleAddListValue}
              disabled={!newListInput.trim()}
            >
              <Text style={styles.addTagButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything to remember?"
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={2}
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>{saving ? '…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  _functionalColors: ReturnType<typeof useTheme>['functionalColors']
) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdropTouchable: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    card: {
      width: '85%',
      maxWidth: 420,
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      ...shadows.medium,
    },
    title: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    flex2: { flex: 2 },
    flex3: { flex: 3 },
    label: {
      fontSize: 12,
      fontWeight: typography.weights.medium,
      color: colors.text.secondary,
      marginTop: spacing.xs,
      marginBottom: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.text.primary,
      backgroundColor: colors.background.primary,
    },
    notesInput: {
      minHeight: 56,
      textAlignVertical: 'top',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 2,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: borderRadius.full ?? 16,
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: colors.background.primary,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    chipTextSelected: {
      color: '#ffffff',
    },
    emptyHint: {
      fontSize: 11,
      color: colors.text.tertiary,
      marginTop: 4,
      fontStyle: 'italic',
    },
    addTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    addTagInput: {
      flex: 1,
    },
    addTagButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.surface ?? colors.background.primary,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    addTagButtonText: {
      fontSize: 13,
      fontWeight: typography.weights.medium,
      color: colors.text.primary,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    cancelButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: typography.weights.medium,
      color: colors.text.secondary,
    },
    saveButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: typography.weights.semibold,
      color: '#ffffff',
    },
  });
}
