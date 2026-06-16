// CP9d — T8a Cookbooks search (wireframes v4 screen 8a; T8b OUT per D-ON-9).
// Visual continuity pass (Tom's walk, 2026-06-12): the search bar clones the
// recipes-page topSearchBar (SearchIcon + pill), results present as the 11D
// typeahead-style dropdown directly under the bar, and selected books render
// as RecipeCard-style blocks (card radius 12 / padding 15 / image right) on
// the primary background. Tapping a result adds the book + clears the search
// (snap back to the shelf); tapping outside dismisses the keyboard.
// Tier badges key off has_recipes (CP4-ext / anchor §4.1). Degrades to the
// "we're adding cookbooks" nudge on an empty catalog — never a dead-end.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme/ThemeContext';
import { SearchIcon } from '../../components/icons';
import {
  searchBookCatalog,
  createUserBookOwnership,
  CatalogBookResult,
} from '../../lib/services/recipeExtraction/bookService';
import { hasWebSources } from './OnboardingSourcesScreen';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'Cookbooks'>;

export function BookCover({ book, styles }: { book: { title: string; cover_image_url?: string | null }; styles: any }) {
  return book.cover_image_url ? (
    <Image source={{ uri: book.cover_image_url }} style={styles.cover} />
  ) : (
    <View style={[styles.cover, styles.coverPlaceholder]}>
      <Text style={styles.coverLetter}>{book.title.charAt(0)}</Text>
    </View>
  );
}

export default function OnboardingCookbooksScreen({ navigation, route }: Props) {
  const { sources } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogBookResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Map<string, CatalogBookResult>>(new Map());
  const [adding, setAdding] = useState(false);

  const next = () =>
    hasWebSources(sources)
      ? navigation.navigate('Paste', { sources })
      : navigation.navigate('Staples');

  // Live filtering: debounced search-as-you-type; stale responses discarded.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const hits = await searchBookCatalog(trimmed);
        if (active) {
          setResults(hits);
          setSearched(true);
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  // Picking from the dropdown adds the book + clears the search → you snap
  // back to the shelf and watch the new block land.
  const pick = (book: CatalogBookResult) => {
    setSelected((prev) => new Map(prev).set(book.id, book));
    setQuery('');
    Keyboard.dismiss();
  };

  const remove = (book: CatalogBookResult) =>
    setSelected((prev) => {
      const nextSel = new Map(prev);
      nextSel.delete(book.id);
      return nextSel;
    });

  const handleAdd = async () => {
    if (selected.size === 0 || adding) return;
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const books = [...selected.values()];
      for (const book of books) {
        try {
          await createUserBookOwnership(user.id, book.id, true);
        } catch (e) {
          console.warn(`⚠️ shelf add for "${book.title}" failed (continuing):`, e);
        }
      }
      navigation.navigate('CookbookVerify', {
        sources,
        books: books.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          cover_image_url: b.cover_image_url,
        })),
      });
    } finally {
      setAdding(false);
    }
  };

  const showDropdown = query.trim().length >= 2;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.inner}>
          <Text style={styles.title}>Add cookbooks you own</Text>

          <View style={styles.topSearchBar}>
            <SearchIcon size={18} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by title or author…"
              placeholderTextColor={colors.text.tertiary}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {showDropdown && (
            <View style={styles.dropdown}>
              {searched && results.length === 0 ? (
                <View style={styles.dropdownEmpty}>
                  <Text style={styles.emptyTitle}>We're adding cookbooks</Text>
                  <Text style={styles.emptyText}>
                    Yours may not be in the catalog yet — we're adding titles all the time.
                  </Text>
                </View>
              ) : (
                results.slice(0, 6).map((item, i) => {
                  const isSelected = selected.has(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.dropdownRow, i > 0 && styles.dropdownRowBorder]}
                      activeOpacity={0.7}
                      onPress={() => (isSelected ? remove(item) : pick(item))}
                    >
                      <View style={styles.dropdownText}>
                        <Text style={styles.dropdownTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.dropdownAuthor} numberOfLines={1}>
                          {item.author ?? ''}
                        </Text>
                      </View>
                      <Text style={styles.dropdownKind}>
                        {item.has_recipes ? 'Recipes ready' : 'Title only'}
                      </Text>
                      <Text style={[styles.addMark, isSelected && styles.addMarkSelected]}>
                        {isSelected ? '✓' : '+'}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          <FlatList
            style={styles.list}
            data={[...selected.values()]}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            keyExtractor={(b) => b.id}
            ListHeaderComponent={
              selected.size > 0 ? (
                <Text style={styles.shelfHeader}>YOUR BOOKS ({selected.size})</Text>
              ) : null
            }
            ListEmptyComponent={
              !showDropdown ? (
                <Text style={styles.emptyText}>
                  Search the catalog and add the cookbooks you own.
                </Text>
              ) : null
            }
            renderItem={({ item: book }) => (
              <View style={styles.bookCard}>
                <View style={styles.bookCardLeft}>
                  <Text style={styles.bookCardTitle} numberOfLines={2}>{book.title}</Text>
                  {!!book.author && (
                    <Text style={styles.bookCardAuthor} numberOfLines={1}>{book.author}</Text>
                  )}
                  <View style={[styles.badge, book.has_recipes ? styles.badgeReady : styles.badgeTitleOnly]}>
                    <Text style={[styles.badgeText, book.has_recipes && styles.badgeTextReady]}>
                      {book.has_recipes ? 'Recipes ready' : 'Title only'}
                    </Text>
                  </View>
                </View>
                <View style={styles.bookCardRight}>
                  <BookCover book={book} styles={styles} />
                  <TouchableOpacity
                    onPress={() => remove(book)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <TouchableOpacity
            style={[styles.primaryButton, (selected.size === 0 || adding) && styles.buttonDisabled]}
            onPress={handleAdd}
            disabled={selected.size === 0 || adding}
          >
            {adding ? (
              <ActivityIndicator color={colors.background.card} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {selected.size > 0
                  ? `Add ${selected.size} book${selected.size > 1 ? 's' : ''} →`
                  : 'Select books you own'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryLink} onPress={next}>
            <Text style={styles.secondaryLinkText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

export const createBookBlockStyles = (colors: any) => ({
  // RecipeCard-pattern block: card bg, radius 12, padding 15, image right.
  bookCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
  },
  bookCardLeft: { flex: 1, marginRight: 8, gap: 4 },
  bookCardRight: { alignItems: 'center' as const, width: 70, gap: 6 },
  bookCardTitle: { fontSize: 18, fontWeight: 'bold' as const, color: colors.text.primary },
  bookCardAuthor: { fontSize: 13, color: colors.text.secondary },
  cover: { width: 47, height: 62, borderRadius: 8 },
  coverPlaceholder: {
    backgroundColor: colors.background.secondary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  coverLetter: { color: colors.text.tertiary, fontSize: 20, fontWeight: '700' as const },
  badge: {
    alignSelf: 'flex-start' as const,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeReady: { backgroundColor: colors.primary + '22' },
  badgeTitleOnly: { backgroundColor: colors.border.medium + '44' },
  badgeText: { fontSize: 11, color: colors.text.tertiary },
  badgeTextReady: { color: colors.primary, fontWeight: '600' as const },
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    inner: { flex: 1, padding: 16 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 14 },
    // Recipes-page topSearchBar clone.
    topSearchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 25,
      paddingHorizontal: 15,
      paddingVertical: 11,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: colors.text.primary, padding: 0 },
    // 11D typeahead dropdown clone.
    dropdown: {
      marginTop: 6,
      backgroundColor: colors.background.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
      overflow: 'hidden',
    },
    dropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 8,
    },
    dropdownRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.light },
    dropdownText: { flex: 1 },
    dropdownTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
    dropdownAuthor: { fontSize: 12, color: colors.text.secondary },
    dropdownKind: { fontSize: 11, color: colors.text.tertiary },
    dropdownEmpty: { padding: 14, gap: 4 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    emptyText: { fontSize: 13, color: colors.text.secondary, lineHeight: 19 },
    addMark: { fontSize: 18, color: colors.text.tertiary, width: 22, textAlign: 'center' },
    addMarkSelected: { color: colors.primary, fontWeight: '700' },
    list: { flex: 1, marginTop: 14 },
    shelfHeader: {
      fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
      color: colors.text.secondary, marginBottom: 8,
    },
    removeText: { fontSize: 12, color: colors.text.tertiary, textDecorationLine: 'underline' },
    ...createBookBlockStyles(colors),
    primaryButton: {
      backgroundColor: colors.primary, padding: 16, borderRadius: 8,
      alignItems: 'center', marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    secondaryLink: { alignItems: 'center', marginTop: 14 },
    secondaryLinkText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  });
