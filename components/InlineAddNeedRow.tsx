// ============================================
// FRIGO — INLINE ADD NEED ROW (Phase 8R-CP6d-ViewDetail, Gap-G5)
// ============================================
// Type-and-add row that lives at the top of ViewDetailScreen body. Sibling to
// the Regulars strip. Debounced search_ingredients RPC + supplies-side T1
// match to surface 🏠 / 🆕 / ✏️ tier suggestions; tap a suggestion creates a
// need in one shot. "More options" chevron opens AddNeedSheet pre-populated
// with the current query.
//
// View-context inheritance (Q21): the active view's filters get applied as
// tag IDs on createNeed. Multi-value urgency filters collapse to most-specific
// (today wins over this-week). Status filter is ignored (row-level, not tag).
// Location: components/InlineAddNeedRow.tsx
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { createNeed } from '../lib/services/needsService';
import { getTagsForSpace } from '../lib/services/tagsService';
import { getSuppliesForSpace } from '../lib/services/suppliesService';
import { SupplyWithTags } from '../lib/types/supplies';
import { Tag } from '../lib/types/tags';
import { ViewWithFilters } from '../lib/types/views';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { resolveViewTagIds } from '../lib/utils/viewTagResolution';

const SEARCH_DEBOUNCE_MS = 200;

type Tier = 'tier1' | 'tier2' | 'tier3';

interface Suggestion {
  tier: Tier;
  key: string;
  display: string;
  supply?: SupplyWithTags;
  ingredient?: { id: string; name: string };
}

interface IngredientRpcRow {
  id: string;
  name: string;
}

export interface InlineAddNeedRowProps {
  spaceId: string;
  userId: string;
  view: ViewWithFilters | null;
  onCreated: () => void;
  /** Opens AddNeedSheet pre-populated with the current query. */
  onMoreOptions: (query: string) => void;
}

export default function InlineAddNeedRow({
  spaceId,
  userId,
  view,
  onCreated,
  onMoreOptions,
}: InlineAddNeedRowProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [supplies, setSupplies] = useState<SupplyWithTags[]>([]);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tagsBySpace, setTagsBySpace] = useState<Tag[]>([]);

  // Hydrate supplies + space tags once per visible space change. (Cheaper than
  // refetching on every keystroke; keeps the inline UX snappy.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, t] = await Promise.all([
          getSuppliesForSpace(spaceId),
          getTagsForSpace(spaceId),
        ]);
        if (!cancelled) {
          setSupplies(s);
          setTagsBySpace(t);
        }
      } catch (error) {
        console.error('❌ InlineAddNeedRow hydrate error:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  // Debounced search.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
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

        // T1: existing supplies (substring match on display name).
        const tier1: Suggestion[] = supplies
          .filter((s) => {
            const name = (s.ingredient?.name ?? s.custom_name ?? '').toLowerCase();
            return name.includes(lower);
          })
          .slice(0, 3)
          .map((s) => ({
            tier: 'tier1' as const,
            key: `t1-${s.id}`,
            display: s.ingredient?.name ?? s.custom_name ?? '',
            supply: s,
          }));

        // T2: catalog ingredients via search_ingredients RPC.
        const { data, error } = await supabase.rpc('search_ingredients', {
          query_text: q,
        });
        if (error) {
          console.warn('search_ingredients RPC error:', error);
        }
        const rpcRows = (data ?? []) as IngredientRpcRow[];
        const tier2: Suggestion[] = rpcRows.slice(0, 3).map((r) => ({
          tier: 'tier2' as const,
          key: `t2-${r.id}`,
          display: r.name,
          ingredient: { id: r.id, name: r.name },
        }));

        // T3: always-visible custom-name option (per Q33). Pinned to top.
        const tier3: Suggestion = {
          tier: 'tier3',
          key: `t3-${q}`,
          display: q,
        };

        setResults([tier3, ...tier1, ...tier2]);
      } catch (error) {
        console.error('❌ InlineAddNeedRow search error:', error);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, supplies]);

  const reset = () => {
    setQuery('');
    setResults([]);
  };

  const createFromSuggestion = async (s: Suggestion) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const tagIds = await resolveViewTagIds(view, tagsBySpace, spaceId, userId);
      if (s.tier === 'tier1' && s.supply) {
        await createNeed({
          spaceId,
          ingredientId: s.supply.ingredient_id ?? undefined,
          customName: s.supply.ingredient_id ? undefined : s.supply.custom_name ?? undefined,
          supplyId: s.supply.id,
          forUserIds: s.supply.for_user_ids,
          addedBy: userId,
          addedFrom: 'manual',
          tagIds,
        });
      } else if (s.tier === 'tier2' && s.ingredient) {
        await createNeed({
          spaceId,
          ingredientId: s.ingredient.id,
          addedBy: userId,
          addedFrom: 'manual',
          tagIds,
        });
      } else {
        // Tier 3 — custom name.
        await createNeed({
          spaceId,
          customName: s.display.trim(),
          addedBy: userId,
          addedFrom: 'manual',
          tagIds,
        });
      }
      Keyboard.dismiss();
      reset();
      onCreated();
    } catch (error) {
      console.error('❌ InlineAddNeedRow create error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    // Submit-on-return priority (P8R-D26 fix): T1 exact-name → T2 exact-name
    // → T3 custom_name fallback. Pre-fix this skipped T2 entirely, so typing
    // "olive oil" when both supply AND catalog had it created a custom_name
    // need — losing ingredient_id linkage downstream features depend on.
    const lower = trimmed.toLowerCase();
    const exactT1 = results.find(
      (r) =>
        r.tier === 'tier1' &&
        (r.supply?.ingredient?.name ?? r.supply?.custom_name ?? '')
          .toLowerCase() === lower
    );
    if (exactT1) {
      createFromSuggestion(exactT1);
      return;
    }
    const exactT2 = results.find(
      (r) =>
        r.tier === 'tier2' &&
        (r.ingredient?.name ?? '').toLowerCase() === lower
    );
    if (exactT2) {
      createFromSuggestion(exactT2);
      return;
    }
    createFromSuggestion({
      tier: 'tier3',
      key: `t3-${trimmed}`,
      display: trimmed,
    });
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.background.card,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
        },
        inputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 8,
          gap: 8,
        },
        plus: {
          fontSize: 18,
          color: colors.text.tertiary,
          fontWeight: typography.weights.bold,
        },
        input: {
          flex: 1,
          fontSize: typography.sizes.md,
          color: colors.text.primary,
          padding: 0,
        },
        moreButton: {
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        moreText: {
          fontSize: 16,
          color: colors.text.tertiary,
        },
        suggestions: {
          marginTop: 6,
          backgroundColor: colors.background.card,
          borderRadius: borderRadius.sm,
          borderWidth: 1,
          borderColor: colors.border.light,
        },
        suggestionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
          gap: 8,
        },
        suggestionRowLast: {
          borderBottomWidth: 0,
        },
        tierEmoji: {
          fontSize: 16,
        },
        suggestionLabel: {
          flex: 1,
          fontSize: typography.sizes.sm,
          color: colors.text.primary,
        },
        suggestionLabelTier3: {
          fontStyle: 'italic',
        },
        searchingHint: {
          paddingVertical: 6,
          paddingHorizontal: spacing.md,
          fontSize: 11,
          color: colors.text.tertiary,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <Text style={styles.plus}>+</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Type to add"
          placeholderTextColor={colors.text.placeholder}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          autoCorrect={false}
          autoCapitalize="none"
          editable={!submitting}
        />
        {submitting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : query.trim().length > 0 ? (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => onMoreOptions(query.trim())}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Text style={styles.moreText}>›</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {results.length > 0 && (
        <View style={styles.suggestions}>
          {searching && (
            <Text style={styles.searchingHint}>Searching…</Text>
          )}
          {results.map((s, i) => {
            const isLast = i === results.length - 1;
            const emoji = s.tier === 'tier1' ? '🏠' : s.tier === 'tier2' ? '🆕' : '✏️';
            const labelStyle =
              s.tier === 'tier3'
                ? [styles.suggestionLabel, styles.suggestionLabelTier3]
                : styles.suggestionLabel;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.suggestionRow, isLast && styles.suggestionRowLast]}
                onPress={() => createFromSuggestion(s)}
                disabled={submitting}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${
                  s.tier === 'tier1'
                    ? 'Existing supply'
                    : s.tier === 'tier2'
                    ? 'New ingredient'
                    : 'Custom name'
                }: ${s.display}`}
              >
                <Text style={styles.tierEmoji}>{emoji}</Text>
                <Text style={labelStyle} numberOfLines={1}>
                  {s.tier === 'tier3' ? `Add "${s.display}" as custom` : s.display}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
