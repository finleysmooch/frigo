// ============================================
// FRIGO - VIEW CREATOR / EDIT MODAL (Phase 8R-CP5a; 8R-UX1 simplification)
// ============================================
// Bottom-sheet modal for creating + editing views (UI calls them "lists" per Q2).
//
// 8R-UX1 simplifications vs prior form:
//   • Status is hidden — always [status: need]. Acquired / in_cart aren't
//     pickable list-defining filters.
//   • Urgency dimension is no longer surfaced directly. Instead an "Add to:"
//     radio with Short List / Long List sets the urgency filter implicitly:
//       Short  → urgency=['today']     (items here also show on Short List)
//       Long   → no urgency filter     (items show on Long List = everything)
//   • Render mode picker removed (defaults to 'flat' which is the new norm).
//   • Recipe tag dimension removed from this surface.
//   • Emoji input stays a free-text 4-char field (any emoji).
//   • Store tag dimension kept — natural use case for custom lists
//     ("Costco run" etc.).
// Location: components/ViewCreatorModal.tsx
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
  createView,
  updateView,
  updateViewFilters,
} from '../lib/services/viewsService';
import { getOrCreateTag, getTagsForSpace } from '../lib/services/tagsService';
import {
  CreateViewParams,
  ViewFilterInput,
  ViewWithFilters,
} from '../lib/types/views';
import { Tag } from '../lib/types/tags';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';

type ModalMode = 'create' | 'edit';
// 8R-UX1: "Add to" choice maps onto the urgency filter under the hood.
// 'standalone' marks the list as private — items don't cascade to Long List.
type AddToChoice = 'short' | 'medium' | 'long' | 'standalone';

// 8R-UX1: suffix convention for "private" list identity tags. Long List's
// post-filter in needsService.getNeedsForView excludes any need carrying an
// event tag whose value ends in this suffix.
const PRIVATE_LIST_SUFFIX = '__private';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  spaceId: string;
  userId: string;
  // Provide existing view in edit mode; omit for create.
  existingView?: ViewWithFilters | null;
}

export default function ViewCreatorModal({
  visible,
  onClose,
  onSaved,
  spaceId,
  userId,
  existingView,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const mode: ModalMode = existingView ? 'edit' : 'create';
  const isDefault = existingView?.is_default ?? false;

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📋');
  const [addTo, setAddTo] = useState<AddToChoice>('long');
  const [storeTags, setStoreTags] = useState<Tag[]>([]);
  const [selectedStoreTagValues, setSelectedStoreTagValues] = useState<string[]>([]);
  const [newStoreInput, setNewStoreInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    if (!visible) return;

    if (existingView) {
      setName(existingView.name);
      setEmoji(existingView.emoji ?? '📋');
      const urgencyFilter = existingView.filters.find((f) => f.dimension === 'urgency');
      const urgencyValues = urgencyFilter?.values ?? [];
      const eventFilter = existingView.filters.find((f) => f.dimension === 'event');
      const isStandalone =
        eventFilter?.values.some((v) => v.endsWith(PRIVATE_LIST_SUFFIX)) ?? false;
      if (isStandalone) setAddTo('standalone');
      else if (urgencyValues.includes('today')) setAddTo('short');
      else if (urgencyValues.includes('this-week')) setAddTo('medium');
      else setAddTo('long');
      const storeFilter = existingView.filters.find((f) => f.dimension === 'store');
      setSelectedStoreTagValues(storeFilter?.values ?? []);
    } else {
      setName('');
      setEmoji('📋');
      setAddTo('long');
      setSelectedStoreTagValues([]);
    }
    setNewStoreInput('');
    loadStoreTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, existingView]);

  const loadStoreTags = async () => {
    if (!spaceId) return;
    try {
      setLoadingTags(true);
      const tags = await getTagsForSpace(spaceId, 'store');
      setStoreTags(tags);
    } catch (error) {
      console.error('❌ ViewCreatorModal load store tags error:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  const toggleStoreTag = (value: string) => {
    setSelectedStoreTagValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleAddNewStore = async () => {
    const value = newStoreInput.trim();
    if (!value) return;
    try {
      const tag = await getOrCreateTag(spaceId, 'store', value, userId);
      setStoreTags((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
      );
      setSelectedStoreTagValues((prev) =>
        prev.includes(tag.value) ? prev : [...prev, tag.value]
      );
      setNewStoreInput('');
    } catch (error) {
      console.error('❌ getOrCreateTag (store) error:', error);
      Alert.alert('Error', 'Could not add store. Try again.');
    }
  };

  // 8R-UX1: build filters from the simplified form.
  // Always [status: need]. "Short"/"Medium" adds an urgency filter. Optional
  // [store: ...]. For NEW lists, the caller appends an [event: <list-id>]
  // filter so the list starts empty + items added inherit the tag via
  // AddNeedSheet view-context inheritance (instead of matching every existing
  // need with status=need).
  const buildFilterInputs = (): ViewFilterInput[] => {
    const filters: ViewFilterInput[] = [
      { dimension: 'status', values: ['need'] },
    ];
    if (addTo === 'short') {
      filters.push({ dimension: 'urgency', values: ['today'] });
    } else if (addTo === 'medium') {
      filters.push({ dimension: 'urgency', values: ['this-week'] });
    }
    // 'standalone' adds no urgency filter; the __private event tag suffix
    // is set in handleSave so items added here are excluded from Long List.
    if (selectedStoreTagValues.length > 0) {
      filters.push({ dimension: 'store', values: selectedStoreTagValues });
    }
    return filters;
  };

  const handleSave = async () => {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Give your list a name.');
      return;
    }
    const filters = buildFilterInputs();
    setSaving(true);
    try {
      if (mode === 'create') {
        // 8R-UX1: every new list gets a unique identifying tag (event
        // dimension, value derived from the list name). The view's filter
        // requires this tag, so the list starts EMPTY until items are added.
        // AddNeedSheet's view-context inheritance then auto-applies the tag
        // (plus any chosen urgency/store) when needs are added from this
        // list — items naturally appear here AND in the cascade list
        // (Short/Medium/Long) selected above.
        //
        // Standalone lists encode privacy in the tag value (suffix
        // `__private`). Long List's post-filter in needsService excludes
        // needs whose event tag value ends in this suffix — so standalone
        // list items don't cascade to Long.
        const identityValue =
          addTo === 'standalone'
            ? `${trimmedName.toLowerCase()}${PRIVATE_LIST_SUFFIX}`
            : trimmedName.toLowerCase();
        const identityTag = await getOrCreateTag(
          spaceId,
          'event',
          identityValue,
          userId
        );
        filters.push({ dimension: 'event', values: [identityTag.value] });

        const params: CreateViewParams = {
          spaceId,
          name: trimmedName,
          emoji,
          // 8R-UX1: render mode no longer surfaced — default to 'flat' which is
          // the simplest list layout. Users editing defaults retain whatever
          // render mode the seed gave them (handled in edit path below).
          renderMode: 'flat',
          filters,
          createdBy: userId,
        };
        await createView(params);
      } else if (existingView) {
        await updateView(existingView.id, {
          name: trimmedName,
          emoji,
        });
        if (!isDefault) {
          await updateViewFilters(existingView.id, filters);
        }
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error('❌ ViewCreatorModal save error:', error);
      Alert.alert('Error', 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={styles.headerCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {mode === 'create' ? 'New list' : 'Edit list'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.headerSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Name</Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Costco run"
                placeholderTextColor={colors.text.placeholder}
                autoCapitalize="sentences"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Emoji</Text>
              <TextInput
                style={styles.emojiInput}
                value={emoji}
                onChangeText={(v) => setEmoji(v.slice(0, 4))}
                maxLength={4}
              />
              <Text style={styles.hint}>
                Tap the field, then your keyboard's 😀 button to pick an emoji.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Add to</Text>
              {isDefault && (
                <Text style={styles.lockedHint}>Filter locked on default lists.</Text>
              )}
              <View style={styles.chipsRow}>
                {(['short', 'medium', 'long', 'standalone'] as AddToChoice[]).map(
                  (choice) => {
                    const selected = addTo === choice;
                    const label =
                      choice === 'short'
                        ? 'Short List'
                        : choice === 'medium'
                        ? 'Medium List'
                        : choice === 'long'
                        ? 'Long List'
                        : 'Just this list';
                    return (
                      <TouchableOpacity
                        key={choice}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => !isDefault && setAddTo(choice)}
                        disabled={isDefault}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
              <Text style={styles.hint}>
                {addTo === 'short'
                  ? 'Items here will also appear on Short List.'
                  : addTo === 'medium'
                  ? 'Items here will also appear on Medium List.'
                  : addTo === 'long'
                  ? 'Items here will also appear on Long List.'
                  : 'Items stay only in this list — hidden from Long List.'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Store (optional)</Text>
              {isDefault && (
                <Text style={styles.lockedHint}>Filter locked on default lists.</Text>
              )}
              <View style={styles.chipsRow}>
                {storeTags.map((tag) => {
                  const isSelected = selectedStoreTagValues.includes(tag.value);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => !isDefault && toggleStoreTag(tag.value)}
                      disabled={isDefault}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {tag.value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {storeTags.length === 0 && !loadingTags && (
                  <Text style={styles.emptyHint}>No stores yet.</Text>
                )}
              </View>
              {!isDefault && (
                <View style={styles.addTagRow}>
                  <TextInput
                    style={styles.addTagInput}
                    value={newStoreInput}
                    onChangeText={setNewStoreInput}
                    placeholder="+ Add new store"
                    placeholderTextColor={colors.text.placeholder}
                    onSubmitEditing={handleAddNewStore}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.addTagButton}
                    onPress={handleAddNewStore}
                    disabled={!newStoreInput.trim()}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addTagButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  _fc: ReturnType<typeof useTheme>['functionalColors']
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
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    section: { paddingVertical: spacing.md },
    sectionLabel: {
      fontSize: 13,
      fontWeight: typography.weights.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    lockedHint: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginBottom: 6,
    },
    hint: {
      fontSize: 11,
      color: colors.text.tertiary,
      marginTop: 6,
    },
    nameInput: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      fontSize: 15,
      color: colors.text.primary,
      backgroundColor: colors.background.secondary,
    },
    emojiInput: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      fontSize: 24,
      color: colors.text.primary,
      backgroundColor: colors.background.secondary,
      width: 80,
      textAlign: 'center',
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: 'transparent',
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    chipTextSelected: {
      color: '#ffffff',
      fontWeight: typography.weights.medium,
    },
    emptyHint: {
      fontSize: 12,
      color: colors.text.tertiary,
      paddingVertical: 4,
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
  });
}
