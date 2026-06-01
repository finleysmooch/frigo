// screens/BookListScreen.tsx
// Phase 11D-CP2 — Books index. Reached from Mode A on RecipeListScreen via
// "Browse by → Books". 2-column cover grid using getBooksForIndex from
// 11D-CP1, search (client-side filter over loaded books — library scale
// is small enough that a server round-trip isn't worth it), and a single
// Sort dropdown with the 5 BookSortOption variants. Tap → BookDetail.
//
// Locked CP2 decisions (Tom, 2026-05-29):
//   1. Empty state — copy + "Add a recipe" CTA that pops back to RecipeList.
//   2. Missing cover_image_url — hash-stable solid color from a small
//      muted palette + white title overlay. No new gradient library.
//   3. (Mode A) Chefs link disabled until CP4 — handled in RecipeListScreen.
//   4. Tap target = BookDetailScreen (stats-style until CP3 redesigns it).
//   5. (Mode A) "Browse by → Books · Chefs" plain text row — handled in
//      RecipeListScreen.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RecipesStackParamList } from '../App';
import { useTheme } from '../lib/theme/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  getBooksForIndex,
  type BookSortOption,
  type BookWithStats,
} from '../lib/services/bookViewService';
import { SearchIcon, SortIcon } from '../components/icons';

type Props = NativeStackScreenProps<RecipesStackParamList, 'BookList'>;

const SORT_OPTIONS: { value: BookSortOption; label: string }[] = [
  { value: 'author_then_title', label: 'By author' },
  { value: 'title_asc',         label: 'A → Z' },
  { value: 'recipes_desc',      label: 'Most recipes' },
  { value: 'recently_added',    label: 'Recently added' },
  { value: 'most_cooked',       label: 'Most cooked' },
];

// 11D-CP2 cover fallback. Muted/warm palette; the index into it comes from a
// stable hash of book.id so the same book always gets the same color across
// renders, devices, and reorderings.
const COVER_PALETTE = [
  '#E8C5A0', // sand
  '#C5A88B', // taupe
  '#A8C5BA', // sage
  '#B5A8C5', // dusty lavender
  '#E8B0A0', // peach
  '#A0B8E8', // soft blue
  '#C5C5A0', // mustard
  '#A0C5A8', // muted green
];

function hashCoverColor(bookId: string): string {
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = (hash * 31 + bookId.charCodeAt(i)) | 0;
  }
  return COVER_PALETTE[Math.abs(hash) % COVER_PALETTE.length];
}

function authorDisplay(b: BookWithStats): string {
  // Prefer the chef join (clean first/last split) when present; fall back to
  // the legacy `books.author` text column when the chef FK isn't set.
  const last = b.chef_last_name?.trim();
  const first = b.chef_first_name?.trim();
  if (last && first) return `${first} ${last}`;
  if (b.chef_name?.trim()) return b.chef_name.trim();
  if (b.author?.trim()) return b.author.trim();
  return 'Unknown author';
}

export default function BookListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [books, setBooks] = useState<BookWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState<BookSortOption>('author_then_title');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadBooks = useCallback(async (uid: string, s: BookSortOption) => {
    try {
      setLoading(true);
      const result = await getBooksForIndex(uid, s);
      setBooks(result);
    } catch (e) {
      console.error('Error loading books for index:', e);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await loadBooks(user.id, sort);
      } else {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload on screen focus so newly-added recipes (which may add new books to
  // the library) surface without manual refresh.
  useFocusEffect(
    useCallback(() => {
      if (userId) loadBooks(userId, sort);
    }, [userId, sort, loadBooks])
  );

  const filteredBooks = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return books;
    return books.filter(b =>
      b.title.toLowerCase().includes(q) ||
      authorDisplay(b).toLowerCase().includes(q),
    );
  }, [books, searchText]);

  const sortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'By author';

  const screenWidth = Dimensions.get('window').width;
  // Grid math: outer container padding 15 each side, gap 12 between cards.
  const CARD_W = (screenWidth - 15 * 2 - 12) / 2;
  const CARD_COVER_H = CARD_W * 1.35; // book-spine-ish ratio

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    backButton: {
      paddingVertical: 4,
      paddingRight: 8,
    },
    backText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '500',
    },

    controlsRow: {
      flexDirection: 'row',
      paddingHorizontal: 15,
      paddingBottom: 12,
      gap: 8,
      alignItems: 'center',
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 9,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text.primary,
      padding: 0,
    },
    sortChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      borderWidth: 1,
      borderColor: colors.border.medium,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 16,
      gap: 4,
    },
    sortChipText: {
      fontSize: 13,
      color: colors.text.primary,
      fontWeight: '500',
    },

    gridContainer: { paddingHorizontal: 15, paddingBottom: 20 },
    row: { justifyContent: 'space-between', marginBottom: 16 },
    card: { width: CARD_W },
    cardCoverImage: {
      width: CARD_W,
      height: CARD_COVER_H,
      borderRadius: 10,
      backgroundColor: colors.background.secondary,
    },
    cardCoverFallback: {
      width: CARD_W,
      height: CARD_COVER_H,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    cardCoverFallbackText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#ffffff',
      textAlign: 'center',
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginTop: 8,
    },
    cardAuthor: {
      fontSize: 12,
      color: colors.text.secondary,
      marginTop: 2,
    },
    cardStats: {
      fontSize: 11,
      color: colors.text.tertiary,
      marginTop: 4,
    },

    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingTop: 60,
    },
    emptyText: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: 18,
      lineHeight: 22,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    emptyButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },

    // Sort picker modal — reuses the dropdown anchored at the controls row.
    sortOverlay: { flex: 1 },
    sortDropdown: {
      position: 'absolute',
      top: 152,
      right: 15,
      backgroundColor: colors.background.card,
      borderRadius: 12,
      minWidth: 200,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
        },
        android: { elevation: 10 },
      }),
      overflow: 'hidden',
    },
    sortRow: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sortRowActive: { backgroundColor: colors.primaryLight },
    sortRowText: { fontSize: 14, color: colors.text.primary },
    sortRowTextActive: { color: colors.primary, fontWeight: '600' },
    sortRowCheck: { fontSize: 13, color: colors.primary, fontWeight: '700' },
    sortDivider: {
      height: 1,
      backgroundColor: colors.border.light,
      marginHorizontal: 14,
    },
  }), [colors, CARD_W, CARD_COVER_H]);

  const renderCard = ({ item }: { item: BookWithStats }) => {
    const cooked = item.cooked_count;
    const total = item.recipe_count;
    const stats = `${total} recipe${total !== 1 ? 's' : ''}${
      cooked > 0 ? ` · ${cooked} cooked` : ''
    }`;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('BookDetail', { bookId: item.id })}
      >
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.cardCoverImage} />
        ) : (
          <View
            style={[
              styles.cardCoverFallback,
              { backgroundColor: hashCoverColor(item.id) },
            ]}
          >
            <Text style={styles.cardCoverFallbackText} numberOfLines={4}>
              {item.title}
            </Text>
          </View>
        )}
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardAuthor} numberOfLines={1}>{authorDisplay(item)}</Text>
        <Text style={styles.cardStats}>{stats}</Text>
      </TouchableOpacity>
    );
  };

  const renderSortPicker = () => (
    <Modal
      visible={showSortPicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSortPicker(false)}
    >
      <TouchableOpacity
        style={styles.sortOverlay}
        activeOpacity={1}
        onPress={() => setShowSortPicker(false)}
      >
        <View style={styles.sortDropdown}>
          {SORT_OPTIONS.map((opt, idx) => {
            const active = sort === opt.value;
            return (
              <View key={opt.value}>
                {idx > 0 && <View style={styles.sortDivider} />}
                <TouchableOpacity
                  style={[styles.sortRow, active && styles.sortRowActive]}
                  onPress={() => {
                    setSort(opt.value);
                    setShowSortPicker(false);
                    if (userId) loadBooks(userId, opt.value);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sortRowText, active && styles.sortRowTextActive]}>
                    {opt.label}
                  </Text>
                  {active && <Text style={styles.sortRowCheck}>✓</Text>}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Empty state: library has 0 books. Tom-locked copy + "Add a recipe" CTA
  // that pops back to the Recipes home (Mode A) where AddRecipeModal lives.
  if (books.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Recipes</Text>
          </TouchableOpacity>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Your library is empty — recipes added from a cookbook will appear here.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>Add a recipe</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Recipes</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Books</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.searchWrap}>
          <SearchIcon size={16} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search books or authors"
            placeholderTextColor={colors.text.tertiary}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity
          style={styles.sortChip}
          onPress={() => setShowSortPicker(true)}
          activeOpacity={0.7}
        >
          <SortIcon size={13} color={colors.text.secondary} />
          <Text style={styles.sortChipText}>{sortLabel} ▾</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredBooks}
        keyExtractor={b => b.id}
        renderItem={renderCard}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      />

      {renderSortPicker()}
    </View>
  );
}
