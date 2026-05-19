// ============================================
// FRIGO — INGREDIENT TAP-SHEET (Phase 8D-CP3)
// ============================================
// Inline tap-sheet rendered by IngredientsSection directly below a tapped
// ingredient row (NOT a bottom overlay — see CP3 prompt / wireframe v5). The
// action set adapts to the row's TapSheetState:
//
//   matched_in_stock → See more (primary) · Update qty · Which step? · Other recipes
//   matched_low      → + Need now (primary) · See more · Update qty · Which step?
//   matched_critical → + Need now (primary) · See more · Update qty · Which step?
//   missing          → + Need now (primary) · Substitute · Add to supplies · See more
//
// All matched levels (L1/L2/L3) collapse to the same state by supply status —
// the L2/L3 distinction is already carried by the inline row indicator, so the
// tap-sheet does not restate it.
//
// Several actions (See more, Update qty, Substitute) are v0 placeholder Alerts;
// the real surfaces land post-F&F. The console.warn instrumentation is marked
// for removal at 8D phase-completion cleanup (CP3 Part D).
// ============================================

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { SupplyStatus } from '../../lib/types/supplies';
import { addNeedFromRecipe } from '../../lib/services/needsService';
import { getOrCreateTag } from '../../lib/services/tagsService';

export type TapSheetState =
  | 'matched_in_stock'
  | 'matched_low'
  | 'matched_critical'
  | 'missing';

export interface TapSheetIngredient {
  id: string;
  name: string;
  quantityDisplay: string;       // already-formatted, e.g. "2 tbsp"
  preparation: string | null;    // e.g. "chopped"
  quantityAmount: number | null; // raw recipe amount — drives need creation
  quantityUnit: string | null;
}

export interface MatchedSupplyInfo {
  id: string;
  displayName: string;
  status: SupplyStatus;
}

interface IngredientTapSheetProps {
  ingredient: TapSheetIngredient;
  state: TapSheetState;
  matchedSupply: MatchedSupplyInfo | null; // null for the missing state
  recipeId: string;
  spaceId: string;
  userId: string | null;
  /** 0-based step index the ingredient is used in; null if not tied to a step. */
  stepIndex: number | null;
  onClose: () => void;
  onAddNeed: () => void;                 // parent shows the toast + refreshes
  onOpenSupplyCreate: () => void;        // parent opens SupplyCreateSheet
  onScrollToStep: (stepIndex: number) => void;
  onNavigateToOtherRecipes: () => void;
}

const STATE_PILL: Record<TapSheetState, { label: string; color: string }> = {
  matched_in_stock: { label: 'in stock', color: '#22c55e' },
  matched_low: { label: 'low', color: '#d97706' },
  matched_critical: { label: 'critical', color: '#dc2626' },
  missing: { label: 'missing', color: '#dc2626' },
};

export default function IngredientTapSheet({
  ingredient,
  state,
  matchedSupply,
  recipeId,
  spaceId,
  userId,
  stepIndex,
  onClose,
  onAddNeed,
  onOpenSupplyCreate,
  onScrollToStep,
  onNavigateToOtherRecipes,
}: IngredientTapSheetProps) {
  const [busy, setBusy] = useState(false);

  // CP3 Part D — console.warn instrumentation. Remove at 8D cleanup.
  const fireAction = (
    action: string,
    result: 'success' | 'error',
    errorMessage?: string
  ) => {
    console.warn('[IngredientTapSheet] action', {
      action,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      state,
      recipeId,
      result,
      errorMessage: errorMessage || undefined,
    });
  };

  const handleNeedNow = async () => {
    if (busy) return;
    if (!userId) {
      Alert.alert('Could not add to needs', 'No active user.');
      fireAction('add_need_now', 'error', 'no user');
      return;
    }
    setBusy(true);
    try {
      const urgencyTag = await getOrCreateTag(spaceId, 'urgency', 'this-week', userId);
      await addNeedFromRecipe({
        spaceId,
        ingredientId: ingredient.id,
        quantityDisplay: ingredient.quantityAmount ?? 1,
        unitDisplay: ingredient.quantityUnit ?? '',
        addedBy: userId,
        recipeId,
        recipeQuantityAmount: ingredient.quantityAmount ?? undefined,
        recipeQuantityUnit: ingredient.quantityUnit ?? undefined,
        tagIds: [urgencyTag.id],
      });
      fireAction('add_need_now', 'success');
      onAddNeed();
      onClose();
    } catch (err: any) {
      fireAction('add_need_now', 'error', err?.message);
      Alert.alert('Could not add to needs', err?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSeeMore = () => {
    fireAction('see_more', 'success');
    Alert.alert('Ingredient detail coming soon', ingredient.name);
  };

  const handleUpdateQty = () => {
    fireAction('update_qty', 'success');
    Alert.alert('Update qty coming soon');
  };

  const handleWhichStep = () => {
    if (stepIndex !== null) {
      fireAction('which_step', 'success');
      onScrollToStep(stepIndex);
      onClose();
    } else {
      fireAction('which_step', 'error', 'no step reference');
      Alert.alert('Used in this recipe, but not tied to a specific step');
    }
  };

  const handleOtherRecipes = () => {
    fireAction('other_recipes', 'success');
    onNavigateToOtherRecipes();
    onClose();
  };

  const handleSubstitute = () => {
    fireAction('substitute', 'success');
    Alert.alert('Substitutions coming soon');
  };

  const handleAddToSupplies = () => {
    fireAction('add_to_supplies', 'success');
    onOpenSupplyCreate();
    onClose();
  };

  // ---- Action layout per state ----
  type Action = { key: string; label: string; onPress: () => void };
  const seeMore: Action = { key: 'see_more', label: 'See more', onPress: handleSeeMore };
  const updateQty: Action = { key: 'update_qty', label: 'Update qty', onPress: handleUpdateQty };
  const whichStep: Action = { key: 'which_step', label: 'Which step?', onPress: handleWhichStep };
  const otherRecipes: Action = { key: 'other_recipes', label: 'Other recipes', onPress: handleOtherRecipes };
  const needNow: Action = { key: 'add_need_now', label: '+ Need now', onPress: handleNeedNow };
  const substitute: Action = { key: 'substitute', label: 'Substitute', onPress: handleSubstitute };
  const addToSupplies: Action = { key: 'add_to_supplies', label: 'Add to supplies', onPress: handleAddToSupplies };

  let primary: Action;
  let secondary: Action[];
  switch (state) {
    case 'matched_in_stock':
      primary = seeMore;
      secondary = [updateQty, whichStep, otherRecipes];
      break;
    case 'matched_low':
    case 'matched_critical':
      primary = needNow;
      secondary = [seeMore, updateQty, whichStep];
      break;
    case 'missing':
    default:
      primary = needNow;
      secondary = [substitute, addToSupplies, seeMore];
      break;
  }

  const pill = STATE_PILL[state];
  const subline = [ingredient.quantityDisplay, ingredient.preparation]
    .filter(Boolean)
    .join(' ');

  return (
    <View style={styles.sheet}>
      <View style={styles.headerRow}>
        <Text style={styles.ingredientName} numberOfLines={1}>
          {ingredient.name}
        </Text>
        <View style={[styles.pill, { backgroundColor: pill.color }]}>
          <Text style={styles.pillText}>{pill.label}</Text>
        </View>
      </View>

      {subline.length > 0 && <Text style={styles.qtyLine}>{subline}</Text>}

      {matchedSupply && (
        <Text style={styles.haveLine}>You have: {matchedSupply.displayName}</Text>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
        onPress={primary.onPress}
        activeOpacity={0.7}
        disabled={busy}
      >
        <Text style={styles.primaryButtonText}>{primary.label}</Text>
      </TouchableOpacity>

      <View style={styles.secondaryRow}>
        {secondary.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={styles.secondaryButton}
            onPress={a.onPress}
            activeOpacity={0.7}
            disabled={busy}
          >
            <Text style={styles.secondaryButtonText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingredientName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginRight: 8,
  },
  pill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qtyLine: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  haveLine: {
    fontSize: 13,
    color: '#334155',
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: '#0d9488',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  secondaryButton: {
    paddingVertical: 6,
    paddingRight: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#0d9488',
    fontWeight: '500',
  },
});
