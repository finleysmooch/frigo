// ============================================
// FRIGO - VIEW CREATOR / EDIT MODAL (Phase 8R-CP5a)
// ============================================
// Bottom-sheet modal for creating + editing views (UI calls them "lists" per Q2).
// Filter dimensions: status (pseudo) + urgency / store / recipe / for-user (tag dims).
// Render modes: tier / aisle / flat (Q25). Aisle is render-mode-only, NOT a tag dim (Q29).
// Defaults: name + emoji + render-mode editable; filter section disabled per Q19 read
// (flagged in SESSION_LOG as Q1 — confirm with Tom).
// Location: components/ViewCreatorModal.tsx
// ============================================

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  RenderMode,
  ViewFilterInput,
  ViewWithFilters,
} from '../lib/types/views';
import { Tag, TagDimension } from '../lib/types/tags';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';

type ModalMode = 'create' | 'edit';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  spaceId: string;
  userId: string;
  // Provide existing view in edit mode; omit for create.
  existingView?: ViewWithFilters | null;
}

const TAG_DIMENSIONS: TagDimension[] = ['urgency', 'store', 'recipe'];
const STATUS_OPTIONS = ['need', 'in_cart', 'acquired'] as const;

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
  const [renderMode, setRenderMode] = useState<RenderMode>('tier');
  const [statusValues, setStatusValues] = useState<string[]>(['need']);
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
  const [saving, setSaving] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Hydrate from existing view if editing.
    if (existingView) {
      setName(existingView.name);
      setEmoji(existingView.emoji ?? '📋');
      setRenderMode(existingView.render_mode);

      const statusFilter = existingView.filters.find((f) => f.dimension === 'status');
      setStatusValues(statusFilter?.values ?? ['need']);

      const initial: Record<TagDimension, string[]> = {
        urgency: [],
        store: [],
        recipe: [],
        event: [],
        storage: [],
      };
      for (const f of existingView.filters) {
        if (f.dimension !== 'status' && f.dimension in initial) {
          initial[f.dimension as TagDimension] = f.values;
        }
      }
      setSelectedTagsByDimension(initial);
    } else {
      setName('');
      setEmoji('📋');
      setRenderMode('tier');
      setStatusValues(['need']);
      setSelectedTagsByDimension({
        urgency: [],
        store: [],
        recipe: [],
        event: [],
        storage: [],
      });
    }

    setNewTagInput({ urgency: '', store: '', recipe: '', event: '', storage: '' });

    // Load existing tags for the picker.
    loadTagsForSpace();
  }, [visible, existingView]);

  const loadTagsForSpace = async () => {
    if (!spaceId) return;
    try {
      setLoadingTags(true);
      const allTags = await getTagsForSpace(spaceId);
      const grouped: Record<TagDimension, Tag[]> = {
        urgency: [],
        store: [],
        recipe: [],
        event: [],
        storage: [],
      };
      for (const t of allTags) {
        if (t.dimension in grouped) {
          grouped[t.dimension].push(t);
        }
      }
      setTagsByDimension(grouped);
    } catch (error) {
      console.error('❌ ViewCreatorModal load tags error:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  const toggleStatus = (status: string) => {
    setStatusValues((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const toggleTagSelection = (dimension: TagDimension, tagValue: string) => {
    setSelectedTagsByDimension((prev) => {
      const current = prev[dimension];
      const next = current.includes(tagValue)
        ? current.filter((v) => v !== tagValue)
        : [...current, tagValue];
      return { ...prev, [dimension]: next };
    });
  };

  const handleAddNewTag = async (dimension: TagDimension) => {
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

  const buildFilterInputs = (): ViewFilterInput[] => {
    const filters: ViewFilterInput[] = [];
    if (statusValues.length > 0) {
      filters.push({ dimension: 'status', values: statusValues });
    }
    for (const dim of TAG_DIMENSIONS) {
      const values = selectedTagsByDimension[dim];
      if (values.length > 0) {
        filters.push({ dimension: dim, values });
      }
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
    if (filters.length === 0) {
      Alert.alert(
        'Filter required',
        'Pick at least one status or tag — otherwise the list would match nothing.'
      );
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        const params: CreateViewParams = {
          spaceId,
          name: trimmedName,
          emoji,
          renderMode,
          filters,
          createdBy: userId,
        };
        await createView(params);
      } else if (existingView) {
        // Edit mode: update view fields. Skip filter update on defaults per Q19 read.
        await updateView(existingView.id, {
          name: trimmedName,
          emoji,
          renderMode,
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

  const renderTagDimensionSection = (dimension: TagDimension, label: string) => {
    const tags = tagsByDimension[dimension];
    const selected = selectedTagsByDimension[dimension];

    return (
      <View key={dimension} style={styles.section}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {isDefault && (
          <Text style={styles.lockedHint}>Filter locked on default lists.</Text>
        )}
        <View style={styles.chipsRow}>
          {tags.map((tag) => {
            const isSelected = selected.includes(tag.value);
            return (
              <TouchableOpacity
                key={tag.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => !isDefault && toggleTagSelection(dimension, tag.value)}
                disabled={isDefault}
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
          {tags.length === 0 && !loadingTags && (
            <Text style={styles.emptyHint}>No {dimension} tags yet.</Text>
          )}
        </View>
        {!isDefault && (
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
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
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
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Render mode</Text>
              <View style={styles.segmentedRow}>
                {(['tier', 'aisle', 'flat'] as RenderMode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.segmented,
                      renderMode === m && styles.segmentedSelected,
                    ]}
                    onPress={() => setRenderMode(m)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        renderMode === m && styles.segmentedTextSelected,
                      ]}
                    >
                      {m === 'tier' ? 'Tier' : m === 'aisle' ? 'Aisle' : 'Flat'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Status</Text>
              {isDefault && (
                <Text style={styles.lockedHint}>Filter locked on default lists.</Text>
              )}
              <View style={styles.chipsRow}>
                {STATUS_OPTIONS.map((status) => {
                  const isSelected = statusValues.includes(status);
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => !isDefault && toggleStatus(status)}
                      disabled={isDefault}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {renderTagDimensionSection('urgency', 'Urgency')}
            {renderTagDimensionSection('store', 'Store')}
            {renderTagDimensionSection('recipe', 'Recipe')}
          </ScrollView>
        </View>
      </View>
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
    segmentedRow: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
    },
    segmented: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
    },
    segmentedSelected: {
      backgroundColor: colors.primary,
    },
    segmentedText: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    segmentedTextSelected: {
      color: '#ffffff',
      fontWeight: typography.weights.semibold,
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
