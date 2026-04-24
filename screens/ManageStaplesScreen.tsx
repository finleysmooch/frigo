// ============================================
// FRIGO - MANAGE STAPLES SCREEN (Phase 8B-CP3)
// ============================================
// Single-screen surface for adding, editing, and deleting staples.
// Reached from StaplesGrid (footer "Add new", empty-state CTA, "+N more").
// Location: screens/ManageStaplesScreen.tsx
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PantryStackParamList } from '../App';
import { PantryStaple, StapleState } from '../lib/types/pantry';
import {
  addStapleByCustomName,
  addStapleByIngredient,
  deleteStaple,
  DuplicateStapleError,
  getStaplesBySpace,
  getStapleDisplayName,
  PantryStapleWithIngredientName,
  searchIngredientsForStapleAdd,
  updateStapleCustomName,
} from '../lib/pantryStaplesService';
import { useActiveSpaceId } from '../contexts/SpaceContext';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<PantryStackParamList, 'ManageStaples'>;

type IngredientSearchResult = { id: string; name: string; already_staple: boolean };

const SEARCH_DEBOUNCE_MS = 200;

export default function ManageStaplesScreen({ navigation }: Props) {
  const spaceId = useActiveSpaceId();
  const { colors, functionalColors } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IngredientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [staples, setStaples] = useState<PantryStapleWithIngredientName[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const [customNameInput, setCustomNameInput] = useState('');
  const [customAddExpanded, setCustomAddExpanded] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  const loadStaples = useCallback(async (sid: string) => {
    try {
      const data = await getStaplesBySpace(sid);
      setStaples(data);
    } catch (error) {
      console.error('❌ ManageStaples load error:', error);
    }
  }, []);

  useEffect(() => {
    if (spaceId) loadStaples(spaceId);
  }, [spaceId, loadStaples]);

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!spaceId) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (q.length === 0) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchIngredientsForStapleAdd(spaceId, q);
        setSearchResults(results);
      } catch (error) {
        console.error('❌ ManageStaples search error:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, spaceId]);

  const handleAddIngredient = useCallback(async (result: IngredientSearchResult) => {
    if (!spaceId || !currentUserId || result.already_staple) return;
    try {
      await addStapleByIngredient(spaceId, result.id, currentUserId);
    } catch (error) {
      if (error instanceof DuplicateStapleError) {
        Alert.alert('Already on your list', `${result.name} is already a staple.`);
      } else {
        console.error('❌ addStapleByIngredient error:', error);
        Alert.alert('Error', 'Could not add staple. Try again.');
        return;
      }
    }
    setSearchQuery('');
    if (spaceId) await loadStaples(spaceId);
  }, [spaceId, currentUserId, loadStaples]);

  const handleAddCustom = useCallback(async () => {
    if (!spaceId || !currentUserId) return;
    const name = customNameInput.trim();
    if (!name) return;
    try {
      await addStapleByCustomName(spaceId, name, currentUserId);
      setCustomNameInput('');
      await loadStaples(spaceId);
    } catch (error) {
      if (error instanceof DuplicateStapleError) {
        Alert.alert('Already on your list', `${name} is already a staple.`);
      } else {
        console.error('❌ addStapleByCustomName error:', error);
        Alert.alert('Error', 'Could not add staple. Try again.');
      }
    }
  }, [spaceId, currentUserId, customNameInput, loadStaples]);

  const handleDelete = useCallback((staple: PantryStapleWithIngredientName) => {
    const name = getStapleDisplayName(staple);
    Alert.alert(
      `Delete ${name}?`,
      'This removes it from your staples list. You can always add it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setStaples((prev) => prev.filter((s) => s.id !== staple.id));
            try {
              await deleteStaple(staple.id);
            } catch (error) {
              console.error('❌ deleteStaple error:', error);
              Alert.alert('Error', 'Could not delete. Refreshing list.');
              if (spaceId) await loadStaples(spaceId);
            }
          },
        },
      ]
    );
  }, [spaceId, loadStaples]);

  const handleEditStart = (staple: PantryStapleWithIngredientName) => {
    setEditingId(staple.id);
    setEditingValue(staple.custom_name ?? '');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    const name = editingValue.trim();
    if (!name) {
      handleEditCancel();
      return;
    }
    try {
      await updateStapleCustomName(editingId, name);
      setEditingId(null);
      setEditingValue('');
      if (spaceId) await loadStaples(spaceId);
    } catch (error) {
      console.error('❌ updateStapleCustomName error:', error);
      Alert.alert('Error', 'Could not update. Try again.');
    }
  };

  const styles = useMemo(() => makeStyles(colors, functionalColors), [colors, functionalColors]);

  const renderSearchResult = ({ item }: { item: IngredientSearchResult }) => (
    <TouchableOpacity
      style={[styles.searchRow, item.already_staple && styles.searchRowDisabled]}
      onPress={() => handleAddIngredient(item)}
      disabled={item.already_staple}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={
        item.already_staple
          ? `${item.name} — already a staple`
          : `Add ${item.name} as staple`
      }
    >
      <Text style={[styles.searchRowName, item.already_staple && styles.searchRowNameDisabled]}>
        {item.name}
      </Text>
      {item.already_staple && <Text style={styles.searchRowBadge}>✓ Already a staple</Text>}
    </TouchableOpacity>
  );

  const renderStapleRow = (staple: PantryStapleWithIngredientName) => {
    const isEditing = editingId === staple.id;
    const isCustom = staple.ingredient_id === null;
    const name = getStapleDisplayName(staple);

    return (
      <View key={staple.id} style={styles.stapleRow}>
        <View style={[styles.stateDot, { backgroundColor: stateDotColor(staple.state, functionalColors) }]} />
        {isEditing ? (
          <TextInput
            style={styles.editInput}
            value={editingValue}
            onChangeText={setEditingValue}
            autoFocus
            onSubmitEditing={handleEditSave}
            onBlur={handleEditCancel}
            returnKeyType="done"
            accessibilityLabel={`Edit name for ${name}`}
          />
        ) : (
          <Text style={styles.stapleName} numberOfLines={1}>{name}</Text>
        )}
        <View style={styles.stapleActions}>
          {isCustom && !isEditing && (
            <TouchableOpacity
              onPress={() => handleEditStart(staple)}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${name}`}
            >
              <Text style={styles.iconButtonText}>✎</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => handleDelete(staple)}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${name}`}
          >
            <Text style={styles.iconButtonText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const addCustomDisabled = customNameInput.trim().length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backArrow}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staples</Text>
      </View>

      <FlatList
        data={[]}
        renderItem={() => null}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* Search section heading (8B-CP3a Part 2) */}
            <View style={styles.searchHeadingBlock}>
              <Text style={styles.searchHeading}>Search our ingredient list</Text>
              <Text style={styles.searchSubtitle}>
                Produce, pantry items, spices — 2000+ matches
              </Text>
            </View>

            {/* Search bar */}
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search ingredients..."
                placeholderTextColor={colors.text.placeholder}
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel="Search ingredients"
              />
            </View>

            {/* Search results (conditional) */}
            {searchQuery.trim().length > 0 && (
              <View style={styles.searchResultsContainer}>
                {searching && searchResults.length === 0 ? (
                  <Text style={styles.searchHint}>Searching…</Text>
                ) : searchResults.length === 0 ? (
                  <Text style={styles.searchHint}>
                    No ingredients match. Try a different term or add a custom staple below.
                  </Text>
                ) : (
                  searchResults.map((r) => (
                    <View key={r.id}>{renderSearchResult({ item: r })}</View>
                  ))
                )}
              </View>
            )}

            <View style={styles.divider} />

            {/* Current staples */}
            <Text style={styles.sectionHeader}>
              Your staples ({staples.length})
            </Text>
            {staples.length === 0 ? (
              <Text style={styles.emptyHint}>No staples yet. Search above or add a custom one below.</Text>
            ) : (
              staples.map(renderStapleRow)
            )}

            {/* Custom-name add (8B-CP3a Part 3: collapsed by default) */}
            <View style={styles.customSection}>
              {customAddExpanded ? (
                <>
                  <View style={styles.customHeaderRow}>
                    <Text style={styles.customHeader}>Add a custom staple</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setCustomAddExpanded(false);
                        setCustomNameInput('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Collapse custom staple input"
                    >
                      <Text style={styles.customCollapseIcon}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.customRow}>
                    <TextInput
                      style={styles.customInput}
                      value={customNameInput}
                      onChangeText={setCustomNameInput}
                      placeholder="Branded or non-standard name"
                      placeholderTextColor={colors.text.placeholder}
                      autoCorrect={false}
                      autoFocus
                      accessibilityLabel="Custom staple name"
                      onSubmitEditing={addCustomDisabled ? undefined : handleAddCustom}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={[styles.addButton, addCustomDisabled && styles.addButtonDisabled]}
                      onPress={handleAddCustom}
                      disabled={addCustomDisabled}
                      accessibilityRole="button"
                      accessibilityLabel="Add custom staple"
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.customToggleButton}
                    onPress={() => setCustomAddExpanded(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Add a custom staple"
                  >
                    <Text style={styles.customToggleButtonText}>
                      Can't find it? Add a custom staple →
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.customSubtitle}>
                    For branded items or anything not in our ingredient list (e.g., "Motor City pizza").
                  </Text>
                </>
              )}
            </View>
          </View>
        }
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function stateDotColor(
  state: StapleState,
  fc: ReturnType<typeof useTheme>['functionalColors']
): string {
  if (state === 'good') return fc.success;
  if (state === 'running_low') return fc.warning;
  if (state === 'out') return fc.error;
  return 'transparent';
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  _fc: ReturnType<typeof useTheme>['functionalColors']
) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    keyboardAvoid: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    backArrow: { paddingRight: spacing.sm, paddingVertical: 4 },
    backArrowText: { fontSize: 28, color: colors.primary, fontWeight: '300' },
    headerTitle: { fontSize: 18, fontWeight: typography.weights.semibold, color: colors.text.primary },
    searchHeadingBlock: {
      paddingHorizontal: spacing.md,
      paddingTop: 16,
    },
    searchHeading: {
      fontSize: 17,
      fontWeight: typography.weights.medium,
      color: colors.text.primary,
    },
    searchSubtitle: {
      fontSize: 13,
      fontWeight: typography.weights.regular,
      color: colors.text.secondary,
      marginTop: 4,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.md,
      marginTop: 12,
      paddingHorizontal: 10,
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    searchIcon: { fontSize: 14, marginRight: 6 },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text.primary },
    searchResultsContainer: { marginHorizontal: spacing.md, marginTop: 6 },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 10, paddingHorizontal: 10,
      borderRadius: borderRadius.sm, backgroundColor: colors.background.card, marginBottom: 4,
    },
    searchRowDisabled: { opacity: 0.5 },
    searchRowName: { fontSize: 14, color: colors.text.primary },
    searchRowNameDisabled: { color: colors.text.tertiary },
    searchRowBadge: { fontSize: 12, color: colors.text.tertiary },
    searchHint: { fontSize: 13, color: colors.text.tertiary, paddingVertical: 10, paddingHorizontal: 10 },
    divider: { height: 1, backgroundColor: colors.border.light, marginVertical: spacing.md, marginHorizontal: spacing.md },
    sectionHeader: {
      fontSize: 12, fontWeight: typography.weights.semibold, color: colors.text.secondary,
      letterSpacing: 0.8, paddingHorizontal: spacing.md, paddingBottom: 6,
    },
    emptyHint: { fontSize: 13, color: colors.text.tertiary, paddingHorizontal: spacing.md, paddingVertical: 12 },
    stapleRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 10, paddingHorizontal: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border.light,
    },
    stateDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    stapleName: { flex: 1, fontSize: 15, color: colors.text.primary },
    editInput: {
      flex: 1, fontSize: 15, color: colors.text.primary,
      borderBottomWidth: 1, borderBottomColor: colors.primary, paddingVertical: 2,
    },
    stapleActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    iconButtonText: { fontSize: 18, color: colors.text.secondary },
    customSection: {
      marginTop: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    customHeader: { fontSize: 15, fontWeight: typography.weights.semibold, color: colors.text.primary },
    customHeaderRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
    },
    customCollapseIcon: { fontSize: 18, color: colors.text.secondary, paddingHorizontal: 4 },
    customSubtitle: { fontSize: 12, color: colors.text.tertiary, marginTop: 8 },
    customToggleButton: {
      paddingVertical: 12, paddingHorizontal: 14,
      borderRadius: borderRadius.sm,
      borderWidth: 1, borderColor: colors.border.medium,
      backgroundColor: 'transparent',
      alignItems: 'center',
    },
    customToggleButtonText: {
      fontSize: 14, fontWeight: typography.weights.medium, color: colors.text.secondary,
    },
    customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    customInput: {
      flex: 1, paddingVertical: 10, paddingHorizontal: 10,
      backgroundColor: colors.background.card, borderRadius: borderRadius.sm,
      borderWidth: 1, borderColor: colors.border.light,
      fontSize: 15, color: colors.text.primary,
    },
    addButton: {
      paddingHorizontal: 16, paddingVertical: 10,
      backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    },
    addButtonDisabled: { opacity: 0.4 },
    addButtonText: { fontSize: 14, fontWeight: typography.weights.semibold, color: '#ffffff' },
  });
}
