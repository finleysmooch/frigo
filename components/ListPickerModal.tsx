// ============================================
// FRIGO — LIST PICKER MODAL (Phase 8R-UX1 continuation)
// ============================================
// Lightweight bottom-sheet modal for choosing which list (view) to add items
// to. Used by the Pantry bulk "Add to list" action; could be reused by other
// surfaces that need a quick view-pick.
//
// On select, resolves the view's filter values to tag IDs (urgency collapsed
// to most-specific). Caller receives both the view AND the resolved tagIds.
//
// Location: components/ListPickerModal.tsx
// ============================================

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getViewsForSpace } from '../lib/services/viewsService';
import { getTagsForSpace } from '../lib/services/tagsService';
import { Tag } from '../lib/types/tags';
import { resolveViewTagIds } from '../lib/utils/viewTagResolution';
import { ViewWithFilters } from '../lib/types/views';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
// 8R-UX6 Item 4b: renderListIcon extracted to lib/utils/listIcon.tsx.
import { renderListIcon } from '../lib/utils/listIcon';

export interface ListPickerModalProps {
  visible: boolean;
  spaceId: string;
  userId: string;
  onCancel: () => void;
  onPick: (view: ViewWithFilters, tagIds: string[]) => void;
}

export default function ListPickerModal({
  visible,
  spaceId,
  userId,
  onCancel,
  onPick,
}: ListPickerModalProps) {
  const { colors } = useTheme();
  const [views, setViews] = useState<ViewWithFilters[]>([]);
  const [tagsBySpace, setTagsBySpace] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingViewId, setResolvingViewId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    (async () => {
      try {
        const [viewsData, tagsData] = await Promise.all([
          getViewsForSpace(spaceId, false), // includeHidden=false
          getTagsForSpace(spaceId),
        ]);
        setViews(viewsData);
        setTagsBySpace(tagsData);
      } catch (error) {
        console.error('❌ ListPickerModal load error:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, spaceId]);

  // Pickable lists: skip In Cart (semantically a "done" state, not a target
  // for new needs). Same sort as ViewsScreen: defaults first, then customs.
  const pickable = useMemo(() => {
    const filtered = views.filter(
      (v) => !(v.is_default && v.name === 'In Cart')
    );
    return [...filtered].sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      const orderDiff = a.sort_order - b.sort_order;
      if (orderDiff !== 0) return orderDiff;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [views]);

  // 8R-UX6 Item 4a: resolveViewTagIds extracted to lib/utils/viewTagResolution.ts

  const handlePick = async (view: ViewWithFilters) => {
    if (resolvingViewId) return;
    setResolvingViewId(view.id);
    try {
      const tagIds = await resolveViewTagIds(view, tagsBySpace, spaceId, userId);
      onPick(view, tagIds);
    } finally {
      setResolvingViewId(null);
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
          maxHeight: '75%',
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
        list: { maxHeight: 400 },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
          gap: 12,
        },
        rowIconSlot: {
          width: 32,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rowEmoji: { fontSize: 20 },
        rowName: {
          flex: 1,
          fontSize: typography.sizes.md,
          color: colors.text.primary,
          fontWeight: typography.weights.medium,
        },
        rowSpinner: { width: 18 },
        loadingContainer: { paddingVertical: 40, alignItems: 'center' },
        footer: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
        },
        cancelButton: {
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
            <Text style={styles.title}>Add to list</Text>
            <Text style={styles.subtitle}>Choose which list these items go to.</Text>
          </View>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {pickable.map((v) => {
                const icon = renderListIcon(v, {
                  size: 28,
                  iconColor: colors.primary,
                  cartColor: colors.text.primary,
                });
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.row}
                    onPress={() => handlePick(v)}
                    disabled={resolvingViewId !== null}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Add to ${v.name}`}
                  >
                    <View style={styles.rowIconSlot}>
                      {icon ?? (
                        <Text style={styles.rowEmoji}>{v.emoji ?? '📋'}</Text>
                      )}
                    </View>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {v.name}
                    </Text>
                    <View style={styles.rowSpinner}>
                      {resolvingViewId === v.id && (
                        <ActivityIndicator size="small" color={colors.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={resolvingViewId !== null}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
