// ============================================
// FRIGO — PANTRY SEARCH BAR (Phase 8R-CP6d-Pantry, Gap-P1)
// ============================================
// Multi-purpose: filter the visible supplies list AND open SupplyCreateSheet
// pre-populated with the typed query when no exact match exists.
//
// Single source of truth for "search query" lives in PantryScreen; this
// component reports query changes upward and exposes an "+ Add 'X' as supply"
// affordance below the input when the parent flags `noExactMatch=true`.
// Location: components/pantry/PantrySearchBar.tsx
// ============================================

import { useMemo } from 'react';
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../../lib/theme';
import SearchIcon from '../icons/SearchIcon';

export interface PantrySearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  /**
   * True when the trimmed query is ≥2 chars AND no visible supply name
   * matches case-insensitively. Drives the "+ Add 'X' as supply" affordance.
   */
  noExactMatch: boolean;
  /**
   * Fired with the trimmed query when the user taps the inline "+ Add" or
   * presses Submit on the keyboard. Parent opens SupplyCreateSheet with the
   * query pre-populated.
   */
  onAddNew: (query: string) => void;
  /**
   * CP6d-SmokeFix-2 (Task 4): when the query matches across multiple
   * `ingredient.family` values, render a tiny "Found in N categories" hint.
   * Default 0 (no hint).
   */
  matchedFamilyCount?: number;
}

export default function PantrySearchBar({
  query,
  onQueryChange,
  noExactMatch,
  onAddNew,
  matchedFamilyCount = 0,
}: PantrySearchBarProps) {
  const { colors } = useTheme();
  const trimmed = query.trim();
  const showAddRow = noExactMatch && trimmed.length >= 2;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
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
        input: {
          flex: 1,
          fontSize: typography.sizes.md,
          color: colors.text.primary,
          padding: 0,
        },
        clearButton: {
          paddingHorizontal: 4,
          paddingVertical: 2,
        },
        clearText: {
          fontSize: 18,
          color: colors.text.tertiary,
          fontWeight: typography.weights.medium,
        },
        addRow: {
          marginTop: 8,
          paddingVertical: 10,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.sm,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border.medium,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        addPlus: {
          fontSize: typography.sizes.md,
          color: colors.primary,
          fontWeight: typography.weights.bold,
        },
        addText: {
          fontSize: typography.sizes.sm,
          color: colors.text.primary,
          flex: 1,
        },
        addQuery: {
          fontWeight: typography.weights.semibold,
          color: colors.primary,
        },
        hintText: {
          marginTop: 6,
          paddingHorizontal: 4,
          fontSize: typography.sizes.xs,
          color: colors.text.tertiary,
          fontStyle: 'italic',
        },
      }),
    [colors]
  );

  const handleSubmit = () => {
    if (trimmed.length === 0) return;
    Keyboard.dismiss();
    onAddNew(trimmed);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <SearchIcon size={16} color={colors.text.tertiary} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search or add..."
          placeholderTextColor={colors.text.placeholder}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {trimmed.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => onQueryChange('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {showAddRow && (
        <TouchableOpacity
          style={styles.addRow}
          onPress={() => onAddNew(trimmed)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Add "${trimmed}" as a new supply`}
        >
          <Text style={styles.addPlus}>+</Text>
          <Text style={styles.addText} numberOfLines={1}>
            Add{' '}
            <Text style={styles.addQuery}>"{trimmed}"</Text>
            {' '}as supply
          </Text>
        </TouchableOpacity>
      )}

      {/* CP6d-SmokeFix-2 (Task 4): non-intrusive recommendations hint —
          shipped as the simpler "Found in N categories" variant per prompt
          default. Renders only when query has matches across 2+ families. */}
      {trimmed.length >= 2 && matchedFamilyCount >= 2 && (
        <Text style={styles.hintText}>
          Found in {matchedFamilyCount} categories — keep typing to narrow.
        </Text>
      )}
    </View>
  );
}
