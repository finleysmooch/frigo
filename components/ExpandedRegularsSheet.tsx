// ============================================
// FRIGO - EXPANDED REGULARS SHEET (Phase 8R-CP5b)
// ============================================
// Multi-select panel for the Regulars zone (D8R-Q20). Sections:
//   Out (pre-selected on open) → Low (not pre-selected) → In stock (collapsed default).
// Filtered to supplies whose tags overlap the active view's tag filter
// (replicates the predicate in ViewDetailScreen.supplyMatchesView).
// Bulk submit creates 'manual'-added needs; existing-active-need dedup
// handled inline (createNeed lacks supply_id-based dedup at service layer).
// Location: components/ExpandedRegularsSheet.tsx
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNeed } from '../lib/services/needsService';
import { getSuppliesForSpace } from '../lib/services/suppliesService';
import { getTagsForSpace } from '../lib/services/tagsService';
import { Tag } from '../lib/types/tags';
import { resolveViewTagIds } from '../lib/utils/viewTagResolution';
import { supplyMatchesView } from '../lib/utils/supplyViewMatching';
import { ViewWithFilters } from '../lib/types/views';
import { SupplyStatus, SupplyWithTags } from '../lib/types/supplies';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';
import SupplyCreateSheet from './SupplyCreateSheet';


interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  spaceId: string;
  userId: string;
  view: ViewWithFilters | null;
}

export default function ExpandedRegularsSheet({
  visible,
  onClose,
  onSaved,
  spaceId,
  userId,
  view,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  const [supplies, setSupplies] = useState<SupplyWithTags[]>([]);
  const [tagsBySpace, setTagsBySpace] = useState<Tag[]>([]);
  const [activeNeedSupplyIds, setActiveNeedSupplyIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inStockExpanded, setInStockExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [supplyCreateOpen, setSupplyCreateOpen] = useState(false);
  // CP6d-Sheets (Gap-G27): client-side search filter on display name.
  const [searchQuery, setSearchQuery] = useState('');
  // CP6d-Sheets (Gap-G28): per-category expand state inside In stock sub-grouping.
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;

    setLoading(true);
    setInStockExpanded(false);
    setSearchQuery('');
    setExpandedCategoryKeys(new Set());
    (async () => {
      try {
        const [suppliesData, tagsData] = await Promise.all([
          getSuppliesForSpace(spaceId),
          getTagsForSpace(spaceId),
        ]);
        setSupplies(suppliesData);
        setTagsBySpace(tagsData);

        // Q48-style dedup prep: query active needs (status need|in_cart) with
        // supply_id set, so we can skip already-active rows on submit.
        const supplyIds = suppliesData.map((s) => s.id);
        if (supplyIds.length > 0) {
          const { data, error } = await supabase
            .from('needs')
            .select('supply_id')
            .eq('space_id', spaceId)
            .in('status', ['need', 'in_cart'])
            .in('supply_id', supplyIds);
          if (error) throw error;
          const ids = new Set<string>();
          for (const row of (data ?? []) as Array<{ supply_id: string | null }>) {
            if (row.supply_id) ids.add(row.supply_id);
          }
          setActiveNeedSupplyIds(ids);
        } else {
          setActiveNeedSupplyIds(new Set());
        }

        // Pre-select Out per Q20 (skip ones with active needs already).
        const matching = view
          ? suppliesData.filter((s) => supplyMatchesView(s, view))
          : suppliesData;
        const initial = new Set<string>();
        for (const s of matching) {
          if (s.status === 'out') {
            initial.add(s.id);
          }
        }
        setSelectedIds(initial);
      } catch (error) {
        console.error('❌ ExpandedRegularsSheet hydrate error:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, spaceId, view]);

  const matching = useMemo(
    () => (view ? supplies.filter((s) => supplyMatchesView(s, view)) : supplies),
    [supplies, view]
  );

  // CP6d-Sheets (Gap-G27): apply search filter pre-section-classification.
  const filteredMatching = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return matching;
    return matching.filter((s) =>
      (s.ingredient?.name ?? s.custom_name ?? '').toLowerCase().includes(q)
    );
  }, [matching, searchQuery]);

  const sections = useMemo(() => {
    const out: SupplyWithTags[] = [];
    const low: SupplyWithTags[] = [];
    const inStock: SupplyWithTags[] = [];
    for (const s of filteredMatching) {
      if (s.status === 'out') out.push(s);
      else if (s.status === 'critical' || s.status === 'low') low.push(s);
      else inStock.push(s);
    }
    const byName = (a: SupplyWithTags, b: SupplyWithTags) =>
      (a.ingredient?.name ?? a.custom_name ?? '')
        .toLowerCase()
        .localeCompare((b.ingredient?.name ?? b.custom_name ?? '').toLowerCase());
    return {
      out: out.sort(byName),
      low: low.sort(byName),
      inStock: inStock.sort(byName),
    };
  }, [filteredMatching]);

  // CP6d-Sheets (Gap-G28): sub-categorize In stock by ingredient.family when
  // ≥6 items total. Below that threshold, render flat. Custom-name supplies
  // (no ingredient) bucket into "Other"; "Other" is pinned to bottom.
  const inStockSubGroups = useMemo(() => {
    if (sections.inStock.length < 6) return null;
    const buckets = new Map<string, { key: string; label: string; items: SupplyWithTags[] }>();
    for (const s of sections.inStock) {
      const family = s.ingredient?.family;
      const key = family && family.trim().length > 0 ? family.toLowerCase() : '__other__';
      const label =
        key === '__other__'
          ? 'Other'
          : family!.charAt(0).toUpperCase() + family!.slice(1).toLowerCase();
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { key, label, items: [] };
        buckets.set(key, bucket);
      }
      bucket.items.push(s);
    }
    return Array.from(buckets.values()).sort((a, b) => {
      if (a.key === '__other__') return 1;
      if (b.key === '__other__') return -1;
      if (a.items.length !== b.items.length) return b.items.length - a.items.length;
      return a.label.localeCompare(b.label);
    });
  }, [sections.inStock]);

  const toggleCategoryExpand = (key: string) => {
    setExpandedCategoryKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelected = (supplyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(supplyId)) next.delete(supplyId);
      else next.add(supplyId);
      return next;
    });
  };

  const handleAddNewSupply = () => {
    setSupplyCreateOpen(true);
  };

  const handleSupplyCreated = async () => {
    setSupplyCreateOpen(false);
    // Reload supplies in this sheet so the new one appears in the appropriate section.
    try {
      const refreshed = await getSuppliesForSpace(spaceId);
      setSupplies(refreshed);
    } catch (error) {
      console.error('❌ ExpandedRegularsSheet refresh after create error:', error);
    }
  };

  // 8R-UX6 Item 4a: resolveViewTagIds extracted to lib/utils/viewTagResolution.ts

  const handleSubmit = async () => {
    if (submitting) return;
    if (selectedIds.size === 0) return;

    setSubmitting(true);
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      const viewTagIds = await resolveViewTagIds(view, tagsBySpace, spaceId, userId);
      const selectedSupplies = supplies.filter((s) => selectedIds.has(s.id));
      // Sequential to keep error attribution simple at F&F scale; Promise.all
      // would obscure which supply failed.
      for (const supply of selectedSupplies) {
        // Inline dedup — needsService.createNeed doesn't gate on supply_id.
        if (activeNeedSupplyIds.has(supply.id)) {
          skippedCount++;
          continue;
        }
        try {
          await createNeed({
            spaceId,
            ingredientId: supply.ingredient_id ?? undefined,
            customName: supply.ingredient_id ? undefined : supply.custom_name ?? undefined,
            status: 'need',
            quantityDisplay: undefined, // Q15: supplies are status-only.
            unitDisplay: undefined,
            forUserIds: supply.for_user_ids,
            supplyId: supply.id,
            addedBy: userId,
            addedFrom: 'manual',
            tagIds: viewTagIds,
          });
          createdCount++;
        } catch (error) {
          console.error('❌ ExpandedRegularsSheet createNeed error:', error);
          failedCount++;
        }
      }

      const parts: string[] = [];
      if (createdCount > 0) {
        parts.push(`${createdCount} added`);
      }
      if (skippedCount > 0) {
        parts.push(`${skippedCount} already on a list`);
      }
      if (failedCount > 0) {
        parts.push(`${failedCount} failed`);
      }
      const summary = parts.join(' · ') || 'No changes';

      onSaved();
      Alert.alert('Regulars', summary, [{ text: 'OK', onPress: onClose }]);
    } catch (error) {
      console.error('❌ ExpandedRegularsSheet submit error:', error);
      Alert.alert('Error', 'Could not add. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRow = (supply: SupplyWithTags, isPreSelected: boolean) => {
    const isSelected = selectedIds.has(supply.id);
    const alreadyActive = activeNeedSupplyIds.has(supply.id);
    const name = supply.ingredient?.name ?? supply.custom_name ?? '';
    const tagSummary = supply.tags
      .filter((t) => t.dimension === 'store' || t.dimension === 'urgency')
      .map((t) => t.value)
      .join(' · ');

    return (
      <TouchableOpacity
        key={supply.id}
        style={styles.row}
        onPress={() => toggleSelected(supply.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            isSelected ? styles.checkboxOn : styles.checkboxOff,
          ]}
        >
          {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: dotColor(supply.status, functionalColors) },
          ]}
        />
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>
            {name}
            {alreadyActive && <Text style={styles.rowMutedNote}>  · already on list</Text>}
          </Text>
          {tagSummary && <Text style={styles.rowTags}>{tagSummary}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const selectedCount = selectedIds.size;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={submitting}>
              <Text style={styles.headerCancel}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Regulars</Text>
            <View style={{ width: 50 }} />
          </View>

          {/* CP6d-Sheets (Gap-G27): search bar at top of body */}
          {!loading && (
            <View style={styles.searchBarWrapper}>
              <View style={styles.searchBarRow}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search regulars..."
                  placeholderTextColor={colors.text.placeholder}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    style={styles.searchClearButton}
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Text style={styles.searchClearText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.body}>
              {sections.out.length > 0 && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Out</Text>
                    <Text style={styles.sectionCount}>{sections.out.length}</Text>
                  </View>
                  {sections.out.map((s) => renderRow(s, true))}
                </View>
              )}

              {sections.low.length > 0 && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Low</Text>
                    <Text style={styles.sectionCount}>{sections.low.length}</Text>
                  </View>
                  {sections.low.map((s) => renderRow(s, false))}
                </View>
              )}

              {sections.inStock.length > 0 && (
                <View>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setInStockExpanded((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionTitle}>
                      {inStockExpanded ? '▼' : '▶'}  In stock
                    </Text>
                    <Text style={styles.sectionCount}>{sections.inStock.length}</Text>
                  </TouchableOpacity>
                  {inStockExpanded && (
                    inStockSubGroups ? (
                      // CP6d-Sheets (Gap-G28): sub-grouped by category with
                      // "+ N more in [Category]" expand-in-place.
                      inStockSubGroups.map((group) => {
                        const isExpanded = expandedCategoryKeys.has(group.key);
                        const visible = isExpanded ? group.items : group.items.slice(0, 5);
                        const overflow = group.items.length - 5;
                        return (
                          <View key={group.key}>
                            <View style={styles.subCategoryHeader}>
                              <Text style={styles.subCategoryTitle}>{group.label}</Text>
                              <Text style={styles.subCategoryCount}>{group.items.length}</Text>
                            </View>
                            {visible.map((s) => renderRow(s, false))}
                            {!isExpanded && overflow > 0 && (
                              <TouchableOpacity
                                style={styles.moreInCategoryButton}
                                onPress={() => toggleCategoryExpand(group.key)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={`Show ${overflow} more in ${group.label}`}
                              >
                                <Text style={styles.moreInCategoryText}>
                                  + {overflow} more in {group.label}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })
                    ) : (
                      sections.inStock.map((s) => renderRow(s, false))
                    )
                  )}
                </View>
              )}

              {filteredMatching.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {searchQuery.trim().length > 0
                      ? `No supplies match "${searchQuery}".`
                      : 'No supplies match this list yet.'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.addSupplyButton}
                onPress={handleAddNewSupply}
                activeOpacity={0.7}
              >
                <Text style={styles.addSupplyButtonText}>+ Add new supply</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          <View style={styles.bottomBar}>
            <Text style={styles.selectedCount}>
              {selectedCount} {selectedCount === 1 ? 'selected' : 'selected'}
            </Text>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (selectedCount === 0 || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={selectedCount === 0 || submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {view ? `Add to ${view.name}` : 'Add to list'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <SupplyCreateSheet
        visible={supplyCreateOpen}
        onClose={() => setSupplyCreateOpen(false)}
        onSaved={handleSupplyCreated}
        spaceId={spaceId}
        userId={userId}
      />
    </Modal>
  );
}

// 8R-UX6 Item 4c: supplyMatchesView + expandUrgencyValues extracted to
// lib/utils/supplyViewMatching.ts

function dotColor(
  status: SupplyStatus,
  fc: ReturnType<typeof useTheme>['functionalColors']
): string {
  switch (status) {
    case 'in_stock':
      return fc.success;
    case 'low':
      return fc.warning;
    case 'critical':
      return fc.warning;
    case 'out':
      return fc.error;
    case 'unknown':
      return '#9ca3af'; // grey-400 — neutral
  }
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
      flex: 1,
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
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    body: { flex: 1 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    collapsibleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: typography.weights.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    sectionCount: { fontSize: 12, color: colors.text.tertiary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
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
    checkboxMark: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: typography.weights.bold,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },
    rowBody: { flex: 1 },
    rowName: {
      fontSize: 15,
      color: colors.text.primary,
    },
    rowMutedNote: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    rowTags: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    empty: {
      paddingVertical: 60,
      alignItems: 'center',
    },
    emptyText: { fontSize: 14, color: colors.text.tertiary },
    addSupplyButton: {
      marginHorizontal: spacing.lg,
      marginVertical: spacing.md,
      paddingVertical: 12,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border.medium,
      alignItems: 'center',
    },
    addSupplyButtonText: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.background.card,
    },
    selectedCount: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    submitButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: {
      fontSize: 15,
      fontWeight: typography.weights.semibold,
      color: '#ffffff',
    },
    // CP6d-Sheets (Gap-G27)
    searchBarWrapper: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    searchBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      padding: 0,
    },
    searchClearButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    searchClearText: {
      fontSize: 18,
      color: colors.text.tertiary,
      fontWeight: typography.weights.medium,
    },
    // CP6d-Sheets (Gap-G28): sub-categories within In stock
    subCategoryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: 10,
      paddingBottom: 6,
    },
    subCategoryTitle: {
      fontSize: 11,
      fontWeight: typography.weights.semibold,
      color: colors.text.tertiary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    subCategoryCount: {
      fontSize: 11,
      color: colors.text.tertiary,
    },
    moreInCategoryButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    moreInCategoryText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
  });
}
