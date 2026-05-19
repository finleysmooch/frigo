// ============================================
// FRIGO - SUPPLY CREATE SHEET (Phase 8R-CP6b, Tab 12)
// ============================================
// "Track without needing now." Bottom-sheet entry point for creating supplies.
// Wired from PantryScreen's + tap and from ExpandedRegularsSheet's + footer.
//
// 3-tier autocomplete (mirrors AddNeedSheet structure but inverts T1):
//   T1 🏠 — existing supply → "already in your pantry — edit it instead?" hint.
//   T2 🆕 — catalog ingredient (primary path; full configure form).
//   T3 ✏️ — custom name (always-visible at top per Q33).
//
// Initial status restricted to in_stock / low / out per Q35 (critical only via
// cycling). createSupply does NOT spawn a need on supply-create-as-out — spawn
// is on the transition path (setSupplyStatus), not create. Per Constraint 9.
// Location: components/SupplyCreateSheet.tsx
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootTabParamList } from '../App';
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
  createSupply,
  getSuppliesForSpace,
  setSupplyTracksLots,
} from '../lib/services/suppliesService';
import { createLot } from '../lib/services/lotsService';
import { setSupplyTags, getOrCreateTag, getTagsForSpace } from '../lib/services/tagsService';
import { SupplyInitialStatus, SupplyWithTags } from '../lib/types/supplies';
import { Tag, TagDimension } from '../lib/types/tags';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';
import LotInputRowView, { LotInputRow } from './pantry/LotInputRowView';

const SEARCH_DEBOUNCE_MS = 200;
const TAG_DIMENSIONS: TagDimension[] = ['urgency', 'store', 'recipe'];

// CP6e-PantryUI-c: local row-id generator. crypto.randomUUID() isn't always
// present in older React Native runtimes; fall back to a timestamp+random
// string. The id is React-key + remove-targeting only; uniqueness within a
// single render of this sheet is all that's required.
function generateLocalRowId(): string {
  const g: { randomUUID?: () => string } | undefined =
    typeof globalThis !== 'undefined' && 'crypto' in globalThis
      ? (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;
  if (g?.randomUUID) {
    try {
      return g.randomUUID();
    } catch {
      // fall through
    }
  }
  return `lot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * CP6e-SmokeFix-SF1: default `quantity_unit` for a new LotInputRow.
 * Priority:
 *   1. `ingredient.typical_unit` when an ingredient is selected (T2 path).
 *   2. `'pieces'` generic fallback for custom-name (T3) supplies.
 *
 * Tom's SQL pre-check confirmed `measurement_units` has exactly one
 * `unit_type='count'` row: `{ unit: 'piece', display_singular: 'piece',
 * display_plural: 'pieces' }`. Using `display_plural` as the fallback
 * matches catalog convention and keeps `LotInputRow.quantity_unit`
 * consistent with the display-name strings UnitPicker emits.
 *
 * Returns a display-name string (not a unit ID) — supply_lots.quantity_unit
 * is free-text per SF-1 scope-leans.
 */
function defaultLotUnit(
  ingredient: { typical_unit: string | null } | null | undefined
): string {
  if (ingredient?.typical_unit) {
    return ingredient.typical_unit;
  }
  return 'pieces';
}

function emptyLotInputRow(
  ingredient?: { typical_unit: string | null } | null
): LotInputRow {
  return {
    id: generateLocalRowId(),
    quantity: '',
    // CP6e-SmokeFix-SF1: seed the unit from ingredient.typical_unit when
    // available, else 'pieces'. Falafel-style custom names land with
    // 'pieces' pre-populated so the user can fill qty + submit without
    // touching the unit picker.
    quantity_unit: defaultLotUnit(ingredient),
    storage_location: 'pantry',
    variant_label: '',
    brand: '',
    acquired_at: new Date(),
    expires_at: null,
    expires_at_touched: false,
    notes: '',
  };
}

type Tier = 'tier1' | 'tier2' | 'tier3';

interface SearchResult {
  tier: Tier;
  id: string;
  display_name: string;
  supply?: SupplyWithTags;
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
  /**
   * CP6d-Pantry: optional pre-populated query when the sheet opens. Wired from
   * PantrySearchBar's "+ Add 'X' as supply" affordance. Defaults to empty.
   */
  initialQuery?: string;
}

export default function SupplyCreateSheet({
  visible,
  onClose,
  onSaved,
  spaceId,
  userId,
  initialQuery,
}: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );
  // CP6d-SupplyDetail (Gap-P9): T1 inversion — Edit routes here.
  const tabNav = useNavigation<NavigationProp<RootTabParamList>>();

  const [query, setQuery] = useState('');
  const [supplies, setSupplies] = useState<SupplyWithTags[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);

  // Configure form state
  const [initialStatus, setInitialStatus] = useState<SupplyInitialStatus>('in_stock');
  const [brandsInput, setBrandsInput] = useState('');
  const [notes, setNotes] = useState('');
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

  // CP6e-PantryUI-c: tracks_lots toggle + inline lot inputs. tracksLots
  // defaults to off so non-lots users see zero behavioral change.
  const [tracksLots, setTracksLots] = useState(false);
  const [lotInputs, setLotInputs] = useState<LotInputRow[]>([emptyLotInputRow()]);

  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery ?? '');
    setSelected(null);
    setInitialStatus('in_stock');
    setBrandsInput('');
    setNotes('');
    setSelectedTagsByDimension({
      urgency: [],
      store: [],
      recipe: [],
      event: [],
      storage: [],
    });
    setNewTagInput({ urgency: '', store: '', recipe: '', event: '', storage: '' });
    setTracksLots(false);
    setLotInputs([emptyLotInputRow()]);

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
        console.error('❌ SupplyCreateSheet hydrate error:', error);
      }
    })();
  }, [visible, spaceId, initialQuery]);

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

        // T3 always-visible at top per Q33; suppressed only on exact name match.
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
        console.error('❌ SupplyCreateSheet search error:', error);
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
    if (result.tier === 'tier1') {
      // CP6d-SupplyDetail (Gap-P9): T1 inverted — supply already exists.
      // Confirm + navigate to SupplyDetailScreen so the user can edit it.
      const supplyId = result.supply?.id;
      if (!supplyId) {
        // Defensive fallback; T1 results should always have a supply attached.
        setSelected(result);
        return;
      }
      Alert.alert(
        `${result.display_name} is already tracked`,
        'Edit it in detail view?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Edit',
            onPress: () => {
              onClose();
              tabNav.navigate('PantryStack', {
                screen: 'SupplyDetail',
                params: { supplyId },
              } as never);
            },
          },
        ]
      );
      return;
    }
    setSelected(result);
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
   * contain a tag row for selected values that haven't been materialized in
   * this space yet. Pre-fix, the strict-equality `.find` silently dropped
   * the value → tag never attached. Async + getOrCreateTag fallback closes
   * the gap.
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

  // CP6e-PantryUI-c — lot input handlers.
  const handleToggleTracksLots = (value: boolean) => {
    setTracksLots(value);
    if (value) {
      // CP6e-SmokeFix-SF1: re-seed the first lot input row with the current
      // selection's ingredient so quantity_unit pre-populates from
      // ingredient.typical_unit (or 'pieces' fallback). Without this, the
      // initial-state row created before selection lands with an empty
      // unit, defeating the SF-1 fix's "fill qty + submit" promise.
      setLotInputs([emptyLotInputRow(selected?.ingredient ?? null)]);
    } else {
      // C3: discard lot inputs on toggle-off without confirm. If the user
      // re-enables they'll start with a fresh row.
      setLotInputs([emptyLotInputRow()]);
    }
  };

  const updateLotInputRow = (id: string, updated: Partial<LotInputRow>) => {
    setLotInputs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
    );
  };

  const removeLotInputRow = (id: string) => {
    setLotInputs((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddAnotherLot = () => {
    setLotInputs((prev) => {
      // C5: inherit unit + storage + brand from the LAST row's current
      // values so users adding similar lots (e.g., 4 packs of chicken)
      // don't retype every field. qty + variant + acquired_at + expires_at
      // + notes always start blank to surface obvious next-action input.
      const last = prev[prev.length - 1];
      const newRow: LotInputRow = {
        id: generateLocalRowId(),
        quantity: '',
        quantity_unit: last?.quantity_unit ?? '',
        storage_location: last?.storage_location ?? 'pantry',
        variant_label: '',
        brand: last?.brand ?? '',
        acquired_at: new Date(),
        expires_at: null,
        expires_at_touched: false,
        notes: '',
      };
      return [...prev, newRow];
    });
  };

  const handleSubmit = async () => {
    if (submitting || !selected) return;

    let ingredientId: string | undefined;
    let customName: string | undefined;
    if (selected.tier === 'tier2' && selected.ingredient) {
      ingredientId = selected.ingredient.id;
    } else if (selected.tier === 'tier3') {
      customName = selected.display_name;
    } else {
      return; // T1 doesn't reach submit
    }

    setSubmitting(true);
    try {
      const brandsArr = brandsInput
        .split(',')
        .map((b) => b.trim())
        .filter((b) => b.length > 0);

      // Note: createSupply does NOT spawn a need even when status='out' —
      // spawn-on-out is on setSupplyStatus, not createSupply (Constraint 9).
      const newSupply = await createSupply({
        spaceId,
        ingredientId,
        customName,
        status: initialStatus,
        forUserIds: [],
        brands: brandsArr,
        addedBy: userId,
        notes: notes.trim() || undefined,
      });

      const tagIds = await collectAllSelectedTagIds();
      if (tagIds.length > 0) {
        await setSupplyTags(newSupply.id, tagIds);
      }

      // CP6e-PantryUI-c: handle tracks_lots flip + initial lots.
      // Done as separate calls post-createSupply to avoid changing the
      // createSupply service signature (Constraint 1 — no service-layer changes).
      if (tracksLots) {
        try {
          await setSupplyTracksLots(newSupply.id, true);
        } catch (error) {
          console.error('❌ SupplyCreateSheet tracks_lots flip error:', error);
          // Continue anyway — the supply was created; user can enable + add
          // lots from SupplyDetail. Skip lot creation since the flip failed.
          Alert.alert(
            'Lot tracking',
            'Supply created, but lot tracking could not be enabled. Enable it from the supply detail screen.'
          );
          onSaved();
          onClose();
          return;
        }

        const validLotInputs = lotInputs.filter((row) => {
          const qty = parseFloat(row.quantity);
          return Number.isFinite(qty) && qty > 0 && row.quantity_unit.trim().length > 0;
        });

        if (validLotInputs.length === 0) {
          Alert.alert(
            'Lots',
            'Supply created, but no valid lots were entered. Add lots from the supply detail screen.'
          );
          onSaved();
          onClose();
          return;
        }

        // Sequential creates so a mid-stream failure doesn't leave a
        // partial-success surprise. Each failed row is logged + counted.
        let successCount = 0;
        const failedIndexes: number[] = [];

        for (let i = 0; i < validLotInputs.length; i++) {
          const row = validLotInputs[i];
          try {
            await createLot({
              supply_id: newSupply.id,
              quantity: parseFloat(row.quantity),
              quantity_unit: row.quantity_unit.trim(),
              storage_location: row.storage_location,
              acquired_at: row.acquired_at.toISOString(),
              expires_at:
                row.expires_at_touched && row.expires_at
                  ? row.expires_at.toISOString()
                  : undefined,
              variant_label: row.variant_label.trim() || undefined,
              brand: row.brand.trim() || undefined,
              notes: row.notes.trim() || undefined,
            });
            successCount++;
          } catch (error) {
            console.error(
              `❌ SupplyCreateSheet lot ${i + 1} create error:`,
              error
            );
            failedIndexes.push(i + 1);
          }
        }

        if (failedIndexes.length > 0) {
          Alert.alert(
            'Some lots not created',
            `${successCount} of ${validLotInputs.length} lots created successfully. Add the missing lots from the supply detail screen.`
          );
        }
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('❌ SupplyCreateSheet submit error:', error);
      Alert.alert('Error', 'Could not add supply. Try again.');
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
        ? 'already in pantry — edit instead?'
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
              <Text style={styles.headerTitle}>Add to pantry</Text>
              <View style={{ width: 50 }} />
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

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Initial status</Text>
                    <View style={styles.segmentedRow}>
                      {(['in_stock', 'low', 'out'] as SupplyInitialStatus[]).map(
                        (s) => (
                          <TouchableOpacity
                            key={s}
                            style={[
                              styles.segmented,
                              initialStatus === s && styles.segmentedSelected,
                            ]}
                            onPress={() => setInitialStatus(s)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.segmentedText,
                                initialStatus === s && styles.segmentedTextSelected,
                              ]}
                            >
                              {s === 'in_stock' ? 'In stock' : s === 'low' ? 'Low' : 'Out'}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>

                  {renderTagDimensionSection('urgency', 'Urgency')}
                  {renderTagDimensionSection('store', 'Store')}
                  {renderTagDimensionSection('recipe', 'Recipe')}

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>For-user</Text>
                    <Text style={styles.lockedHint}>
                      Everyone (default). Per-user picker coming in a future CP.
                    </Text>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Brands (optional)</Text>
                    <TextInput
                      style={styles.searchInput}
                      value={brandsInput}
                      onChangeText={setBrandsInput}
                      placeholder="Comma-separated, e.g. Kerrygold, Kirkland"
                      placeholderTextColor={colors.text.placeholder}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Notes (optional)</Text>
                    <TextInput
                      style={styles.searchInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Any details to remember"
                      placeholderTextColor={colors.text.placeholder}
                    />
                  </View>

                  {/* CP6e-PantryUI-c — D8R-Q43 tracks_lots toggle. When on,
                      surfaces inline lot input rows below. Non-lots flow
                      (toggle off) preserves identical behavior to pre-CP6e. */}
                  <View style={styles.section}>
                    <View style={styles.toggleRow}>
                      <View style={styles.toggleLeft}>
                        <Text style={styles.toggleLabel}>
                          Track quantity / individual lots
                        </Text>
                        <Text style={styles.fieldHint}>
                          Track each pack, bottle, or batch separately with
                          quantities and expiration dates.
                        </Text>
                      </View>
                      <Switch
                        value={tracksLots}
                        onValueChange={handleToggleTracksLots}
                        disabled={submitting}
                        accessibilityLabel="Track quantity and individual lots"
                      />
                    </View>
                  </View>

                  {tracksLots && (
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Lots to add</Text>
                      {lotInputs.map((row, index) => (
                        <LotInputRowView
                          key={row.id}
                          row={row}
                          index={index}
                          canRemove={lotInputs.length > 1}
                          disabled={submitting}
                          // CP6e-SmokeFix-SF1: thread through the ingredient
                          // id so UnitPicker can load common units when the
                          // user is on a catalog ingredient (T2), and fall
                          // back to all-units mode for T3 custom names.
                          ingredientId={selected?.ingredient?.id ?? null}
                          onChange={(updated) => updateLotInputRow(row.id, updated)}
                          onRemove={() => removeLotInputRow(row.id)}
                        />
                      ))}
                      <TouchableOpacity
                        style={styles.addAnotherLotButton}
                        onPress={handleAddAnotherLot}
                        disabled={submitting}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Add another lot"
                      >
                        <Text style={styles.addAnotherLotButtonText}>
                          + Add another lot
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {selected && (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
    body: { maxHeight: '100%' },
    bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
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
    hint: { paddingVertical: spacing.md, fontSize: 13, color: colors.text.tertiary },
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
    segmentedSelected: { backgroundColor: colors.primary },
    segmentedText: { fontSize: 14, color: colors.text.secondary },
    segmentedTextSelected: {
      color: '#ffffff',
      fontWeight: typography.weights.semibold,
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
    footer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.background.card,
    },
    saveButton: {
      paddingVertical: 12,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: {
      fontSize: 15,
      fontWeight: typography.weights.semibold,
      color: '#ffffff',
    },
    // CP6e-PantryUI-c — tracks_lots toggle + lot inputs.
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    toggleLeft: {
      flex: 1,
    },
    toggleLabel: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    fieldHint: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 4,
    },
    addAnotherLotButton: {
      marginTop: spacing.sm,
      paddingVertical: 10,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
      alignItems: 'center',
    },
    addAnotherLotButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: typography.weights.medium,
    },
  });
}
