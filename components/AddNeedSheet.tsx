// ============================================
// FRIGO - ADD NEED SHEET (Phase 8R-CP5b)
// ============================================
// Configure-once-and-done (D8R-Q21). Three tiers:
//   T1 — existing supply autocomplete (fast path; supply IS the config).
//   T2 — catalog ingredient (full configure + optional Save as regular).
//   T3 — custom name (full configure + optional Save as regular).
// View context inheritance per D8R-Q11/Q24: tags, store filter, for-user
// defaults flow from the active view onto new needs.
// Location: components/AddNeedSheet.tsx
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { createNeed } from '../lib/services/needsService';
import { createSupply, getSuppliesForSpace } from '../lib/services/suppliesService';
import { getOrCreateTag, getTagsForSpace, setNeedTags, setSupplyTags } from '../lib/services/tagsService';
import { ViewWithFilters } from '../lib/types/views';
import { SupplyWithTags } from '../lib/types/supplies';
import { Tag, TagDimension } from '../lib/types/tags';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';
import UnitPicker from './UnitPicker';

const SEARCH_DEBOUNCE_MS = 200;
const TAG_DIMENSIONS: TagDimension[] = ['urgency', 'store', 'recipe'];

type Tier = 'tier1' | 'tier2' | 'tier3';

interface SearchResult {
  tier: Tier;
  id: string;
  display_name: string;
  // Tier 1: existing supply
  supply?: SupplyWithTags;
  // Tier 2: catalog ingredient
  ingredient?: { id: string; name: string; typical_unit: string | null };
}

interface IngredientRpcRow {
  id: string;
  name: string;
  typical_unit?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  spaceId: string;
  userId: string;
  view: ViewWithFilters | null;
  /**
   * CP6d-ViewDetail: optional pre-populated query when the sheet opens.
   * Wired from InlineAddNeedRow's "More options" affordance. Defaults to empty.
   */
  initialQuery?: string;
  /**
   * CP6d-SupplyDetail follow-up: when set, the sheet opens with this supply
   * already selected as a T1 hit — skipping the search step. Used by the
   * "+ Add to needs" CTA on SupplyDetailScreen. Tags merge per the existing
   * T1 path (Q21 union-on-select). Mutually exclusive with `initialQuery`.
   */
  initialSelectedSupply?: SupplyWithTags;
}

export default function AddNeedSheet({
  visible,
  onClose,
  onSaved,
  spaceId,
  userId,
  view,
  initialQuery,
  initialSelectedSupply,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  const [query, setQuery] = useState('');
  const [supplies, setSupplies] = useState<SupplyWithTags[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [saveAsRegular, setSaveAsRegular] = useState(true);

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

  // Hydrate on open: load supplies + tags + apply view-context defaults to tag chips.
  useEffect(() => {
    if (!visible) return;

    // CP6d-SupplyDetail follow-up: pre-select an injected supply as a T1 hit.
    // Mirrors handleSelectResult's T1 branch — same tag-union behavior, same
    // unit + qty defaults — so the form looks identical to "user typed and
    // tapped the T1 result."
    if (initialSelectedSupply) {
      const t1Result: SearchResult = {
        tier: 'tier1',
        id: initialSelectedSupply.id,
        display_name:
          initialSelectedSupply.ingredient?.name ??
          initialSelectedSupply.custom_name ??
          '',
        supply: initialSelectedSupply,
      };
      setQuery('');
      setSelected(t1Result);
    } else {
      setQuery(initialQuery ?? '');
      setSelected(null);
    }
    setQuantity('1');
    setUnit('');
    setSaveAsRegular(true);
    setNewTagInput({ urgency: '', store: '', recipe: '', event: '', storage: '' });

    // View-context defaults: pre-populate tag selections from view's filters.
    // When initialSelectedSupply is provided, also union the supply's tag
    // values onto the seed (Q21) — same behavior as handleSelectResult's T1
    // branch but applied at hydration time.
    const seed: Record<TagDimension, string[]> = {
      urgency: [],
      store: [],
      recipe: [],
      event: [],
      storage: [],
    };
    if (view) {
      for (const f of view.filters) {
        if (f.dimension !== 'status' && f.dimension in seed) {
          seed[f.dimension as TagDimension] = [...f.values];
        }
      }
    }
    if (initialSelectedSupply) {
      for (const t of initialSelectedSupply.tags) {
        if (t.dimension in seed) {
          const dim = t.dimension as TagDimension;
          if (!seed[dim].includes(t.value)) seed[dim].push(t.value);
        }
      }
    }
    setSelectedTagsByDimension(seed);

    (async () => {
      try {
        const [suppliesData, tagsData] = await Promise.all([
          getSuppliesForSpace(spaceId),
          getTagsForSpace(spaceId),
        ]);
        setSupplies(suppliesData);
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
      } catch (error) {
        console.error('❌ AddNeedSheet hydrate error:', error);
      }
    })();
  }, [visible, spaceId, view, initialQuery, initialSelectedSupply]);

  // Debounced search.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!visible || selected) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        // Tier 1: existing supplies (client-side filter on supplies state).
        const lower = q.toLowerCase();
        const tier1: SearchResult[] = supplies
          .filter((s) => {
            const name = (s.ingredient?.name ?? s.custom_name ?? '').toLowerCase();
            return name.includes(lower);
          })
          .slice(0, 5)
          .map((s) => ({
            tier: 'tier1' as const,
            id: s.id,
            display_name: s.ingredient?.name ?? s.custom_name ?? '',
            supply: s,
          }));

        // Tier 2: catalog ingredients via search_ingredients RPC.
        const { data, error } = await supabase.rpc('search_ingredients', {
          query_text: q,
        });
        if (error) throw error;

        const existingSupplyIngredientIds = new Set(
          supplies
            .map((s) => s.ingredient_id)
            .filter((id): id is string => id !== null)
        );

        const tier2: SearchResult[] = ((data ?? []) as IngredientRpcRow[])
          .filter((row) => !existingSupplyIngredientIds.has(row.id))
          .slice(0, 10)
          .map((row) => ({
            tier: 'tier2' as const,
            id: row.id,
            display_name: row.name,
            ingredient: {
              id: row.id,
              name: row.name,
              typical_unit: row.typical_unit ?? null,
            },
          }));

        // T3 always-visible at top when 2+ chars typed (smoke test 2026-04-30).
        // User can always see the "Add custom: '{query}'" affordance even when
        // catalog matches exist — gives consistent UX across "I want this exact
        // catalog ingredient" vs "I want my own custom variant" intents.
        // Suppressed only when an EXACT name match already exists in T1/T2 to
        // avoid the "Add custom: 'olive oil'" row appearing alongside the
        // existing 'olive oil' supply (would be confusing duplication).
        const exactMatch = [...tier1, ...tier2].some(
          (r) => r.display_name.toLowerCase() === lower
        );

        const merged: SearchResult[] = [];
        if (q.length >= 2 && !exactMatch) {
          merged.push({
            tier: 'tier3',
            id: `custom:${q}`,
            display_name: q,
          });
        }
        merged.push(...tier1, ...tier2);

        setResults(merged);
      } catch (error) {
        console.error('❌ AddNeedSheet search error:', error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, supplies, visible, selected]);

  const handleSelectResult = (result: SearchResult) => {
    setSelected(result);
    if (result.tier === 'tier1' && result.supply) {
      // Tier 1: pre-populate from supply.
      setUnit(result.supply.ingredient?.typical_store_section ? '' : ''); // supplies don't carry typical_unit; user picks
      setUnit(''); // Q15: supplies are status-only, no unit field — let user enter.
      setQuantity('1');
      // Union supply tags onto current selection (per D8R-Q21).
      setSelectedTagsByDimension((prev) => {
        const next = { ...prev };
        for (const t of result.supply!.tags) {
          if (t.dimension in next && !next[t.dimension as TagDimension].includes(t.value)) {
            next[t.dimension as TagDimension] = [
              ...next[t.dimension as TagDimension],
              t.value,
            ];
          }
        }
        return next;
      });
    } else if (result.tier === 'tier2' && result.ingredient) {
      setUnit(result.ingredient.typical_unit ?? '');
      setQuantity('1');
    } else {
      // Tier 3 custom
      setUnit('');
      setQuantity('1');
    }
  };

  const handleClearSelection = () => {
    setSelected(null);
    setQuery('');
  };

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

  /**
   * CP6d-SmokeFix-3 (V19 root cause): the cached `tagsByDimension` may not
   * contain a tag row for view-context-inherited values (e.g., 'today') if
   * the space hasn't materialized that tag yet. Pre-fix, the strict-equality
   * `.find` would silently drop the value → tag never attaches to the need
   * → Tonight count stays at 0. Now we fall back to `getOrCreateTag` for any
   * value not yet in the cache. Async because getOrCreateTag is async.
   */
  const collectAllSelectedTagIds = async (): Promise<string[]> => {
    const ids: string[] = [];
    for (const dim of TAG_DIMENSIONS) {
      const values = selectedTagsByDimension[dim];
      for (const v of values) {
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
            console.error('❌ collectAllSelectedTagIds resolve error:', error);
          }
        }
      }
    }
    return ids;
  };

  const collectStoreTagIds = async (): Promise<string[]> => {
    const ids: string[] = [];
    for (const v of selectedTagsByDimension.store) {
      const cached = tagsByDimension.store.find(
        (t) => t.value.toLowerCase() === v.toLowerCase()
      );
      if (cached) {
        ids.push(cached.id);
      } else {
        try {
          const created = await getOrCreateTag(spaceId, 'store', v, userId);
          ids.push(created.id);
        } catch (error) {
          console.error('❌ collectStoreTagIds resolve error:', error);
        }
      }
    }
    return ids;
  };

  const handleSubmit = async () => {
    if (submitting || !selected) return;

    const trimmedQty = quantity.trim();
    const qtyNum = trimmedQty ? Number(trimmedQty) : null;
    if (trimmedQty && (Number.isNaN(qtyNum) || (qtyNum !== null && qtyNum <= 0))) {
      Alert.alert('Quantity', 'Quantity must be a positive number or empty.');
      return;
    }

    setSubmitting(true);
    try {
      const allTagIds = await collectAllSelectedTagIds();
      const storeTagIds = await collectStoreTagIds();

      // Resolve supply identity.
      let supplyId: string | undefined;
      let ingredientId: string | undefined;
      let customName: string | undefined;

      if (selected.tier === 'tier1' && selected.supply) {
        supplyId = selected.supply.id;
        ingredientId = selected.supply.ingredient_id ?? undefined;
        customName = selected.supply.custom_name ?? undefined;
      } else if (selected.tier === 'tier2' && selected.ingredient) {
        ingredientId = selected.ingredient.id;
      } else if (selected.tier === 'tier3') {
        customName = selected.display_name;
      }

      // Save as regular: create supply first if T2/T3 and toggle ON.
      if (saveAsRegular && (selected.tier === 'tier2' || selected.tier === 'tier3')) {
        const newSupply = await createSupply({
          spaceId,
          ingredientId,
          customName,
          status: 'in_stock',
          forUserIds: [],
          brands: [],
          addedBy: userId,
        });
        supplyId = newSupply.id;
        if (storeTagIds.length > 0) {
          await setSupplyTags(supplyId, storeTagIds);
        }
      }

      // Create the need.
      const need = await createNeed({
        spaceId,
        ingredientId,
        customName,
        status: 'need',
        quantityDisplay: qtyNum ?? undefined,
        unitDisplay: unit.trim() || undefined,
        supplyId,
        addedBy: userId,
        addedFrom: 'manual',
      });

      if (allTagIds.length > 0) {
        await setNeedTags(need.id, allTagIds);
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('❌ AddNeedSheet submit error:', error);
      Alert.alert('Error', 'Could not add need. Try again.');
    } finally {
      setSubmitting(false);
    }
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

  const renderSearchResultRow = (result: SearchResult) => {
    const prefix =
      result.tier === 'tier1' ? '🏠' : result.tier === 'tier2' ? '🆕' : '✏️';
    const subtitle =
      result.tier === 'tier1'
        ? 'existing supply'
        : result.tier === 'tier2'
        ? 'from catalog'
        : `add custom: "${result.display_name}"`;
    return (
      <TouchableOpacity
        key={`${result.tier}:${result.id}`}
        style={styles.resultRow}
        onPress={() => handleSelectResult(result)}
        activeOpacity={0.7}
      >
        <Text style={styles.resultPrefix}>{prefix}</Text>
        <View style={styles.resultBody}>
          <Text style={styles.resultName}>{result.display_name}</Text>
          <Text style={styles.resultSubtitle}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const headerTitle = view ? `Add to ${view.name}` : 'Add need';
  const showFullForm =
    selected !== null &&
    (selected.tier === 'tier2' || selected.tier === 'tier3' || selected.tier === 'tier1');

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
              <Text style={styles.headerTitle}>{headerTitle}</Text>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || !selected}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={[
                      styles.headerSave,
                      !selected && styles.headerSaveDisabled,
                    ]}
                  >
                    {saveAsRegular &&
                    (selected?.tier === 'tier2' || selected?.tier === 'tier3')
                      ? 'Add + save'
                      : 'Add'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.bodyContent}
            >
              {!selected ? (
                <>
                  <View style={styles.section}>
                    <TextInput
                      style={styles.searchInput}
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search supplies or ingredients…"
                      placeholderTextColor={colors.text.placeholder}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {searching && results.length === 0 ? (
                    <Text style={styles.hint}>Searching…</Text>
                  ) : results.length === 0 && query.trim().length > 0 ? (
                    <Text style={styles.hint}>
                      No matches yet. Type at least 2 characters to add a custom item.
                    </Text>
                  ) : (
                    results.map(renderSearchResultRow)
                  )}
                </>
              ) : (
                <>
                  <View style={styles.selectedHeader}>
                    <Text style={styles.selectedName}>{selected.display_name}</Text>
                    <TouchableOpacity onPress={handleClearSelection}>
                      <Text style={styles.changeLink}>Change</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.qtyRow}>
                    <View style={styles.qtyField}>
                      <Text style={styles.fieldLabel}>Quantity</Text>
                      <TextInput
                        style={styles.qtyInput}
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={colors.text.placeholder}
                      />
                    </View>
                    <View style={styles.unitField}>
                      <Text style={styles.fieldLabel}>Unit</Text>
                      {(() => {
                        // CP6d-Sheets (Gap-G24): UnitPicker for catalog-linked
                        // selections; falls back to TextInput for T3 custom or
                        // T1 supplies with no ingredient_id (UnitPicker requires
                        // an ingredientId to load common units; the "Other
                        // units…" affordance also gates on common_units > 0).
                        const effectiveIngredientId =
                          selected.tier === 'tier1'
                            ? selected.supply?.ingredient_id ?? null
                            : selected.tier === 'tier2'
                            ? selected.ingredient?.id ?? null
                            : null;
                        if (effectiveIngredientId) {
                          return (
                            <UnitPicker
                              ingredientId={effectiveIngredientId}
                              selectedUnit={unit || null}
                              onSelectUnit={(_unitId, displayName) =>
                                setUnit(displayName)
                              }
                            />
                          );
                        }
                        return (
                          <TextInput
                            style={styles.unitInput}
                            value={unit}
                            onChangeText={setUnit}
                            placeholder="unit"
                            placeholderTextColor={colors.text.placeholder}
                            autoCapitalize="none"
                          />
                        );
                      })()}
                    </View>
                  </View>

                  {(selected.tier === 'tier2' || selected.tier === 'tier3') && (
                    <View style={styles.toggleRow}>
                      <View style={styles.toggleBody}>
                        <Text style={styles.toggleLabel}>Save as staple</Text>
                        <Text style={styles.toggleHint}>
                          Adds to your supplies list so it shows up in Staples next time.
                        </Text>
                      </View>
                      <Switch value={saveAsRegular} onValueChange={setSaveAsRegular} />
                    </View>
                  )}

                  {showFullForm && (
                    <>
                      {renderTagDimensionSection('urgency', 'Urgency')}
                      {renderTagDimensionSection('store', 'Store')}
                      {renderTagDimensionSection('recipe', 'Recipe')}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    body: { maxHeight: '100%' },
    bodyContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
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
    searchInput: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: borderRadius.sm,
      fontSize: 15,
      color: colors.text.primary,
      backgroundColor: colors.background.secondary,
    },
    hint: {
      paddingVertical: spacing.md,
      fontSize: 13,
      color: colors.text.tertiary,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    resultPrefix: { fontSize: 18, marginRight: 10 },
    resultBody: { flex: 1 },
    resultName: { fontSize: 15, color: colors.text.primary },
    resultSubtitle: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
    selectedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    selectedName: {
      fontSize: 17,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    changeLink: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
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
  });
}
