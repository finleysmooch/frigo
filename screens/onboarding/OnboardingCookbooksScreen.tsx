// CP9d — T8a Cookbooks search (wireframes v4 screen 8a; T8b snap-shelf is OUT
// of F&F per D-ON-9 → OB-8). Searches the curated catalog; tier badges key off
// has_recipes (CP4-ext / D-ON-12, anchor §4.1 — never toc_extracted_at).
// Cross-workstream seam: degrades gracefully on an empty/sparse catalog —
// "we're adding cookbooks" nudge + skip, never a dead-end, never blocks the
// spine (the catalog fills via CP4-seed/CP4b in parallel).

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme/ThemeContext';
import {
  searchBookCatalog,
  createUserBookOwnership,
  CatalogBookResult,
} from '../../lib/services/recipeExtraction/bookService';
import { hasWebSources } from './OnboardingSourcesScreen';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'Cookbooks'>;

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
      : navigation.navigate('Signature');

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    try {
      setResults(await searchBookCatalog(query));
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const toggle = (book: CatalogBookResult) =>
    setSelected((prev) => {
      const nextSel = new Map(prev);
      nextSel.has(book.id) ? nextSel.delete(book.id) : nextSel.set(book.id, book);
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
          // Likely already on the shelf — non-fatal, verification still offered.
          console.warn(`⚠️ shelf add for "${book.title}" failed (continuing):`, e);
        }
      }
      navigation.navigate('CookbookVerify', {
        sources,
        books: books.map((b) => ({ id: b.id, title: b.title, author: b.author })),
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Add cookbooks you own</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or author…"
          placeholderTextColor={colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator color={colors.background.card} />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {searched && results.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>We're adding cookbooks</Text>
          <Text style={styles.emptyText}>
            Yours may not be in the catalog yet — we're adding titles all the time. Skip for now
            and check back soon.
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={results}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id);
            return (
              <TouchableOpacity style={styles.bookRow} onPress={() => toggle(item)}>
                <View style={styles.bookText}>
                  <Text style={styles.bookTitle}>{item.title}</Text>
                  <Text style={styles.bookAuthor}>{item.author ?? ''}</Text>
                </View>
                <View style={[styles.badge, item.has_recipes ? styles.badgeReady : styles.badgeTitleOnly]}>
                  <Text style={[styles.badgeText, item.has_recipes && styles.badgeTextReady]}>
                    {item.has_recipes ? 'Recipes ready' : 'Title only'}
                  </Text>
                </View>
                <Text style={[styles.addMark, isSelected && styles.addMarkSelected]}>
                  {isSelected ? '✓' : '+'}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity
        style={[styles.primaryButton, (selected.size === 0 || adding) && styles.buttonDisabled]}
        onPress={handleAdd}
        disabled={selected.size === 0 || adding}
      >
        {adding ? (
          <ActivityIndicator color={colors.background.card} />
        ) : (
          <Text style={styles.primaryButtonText}>
            {selected.size > 0 ? `Add ${selected.size} book${selected.size > 1 ? 's' : ''} →` : 'Select books you own'}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryLink} onPress={next}>
        <Text style={styles.secondaryLinkText}>Skip for now</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.card, padding: 24 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 14 },
    searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    searchInput: {
      flex: 1, borderWidth: 1, borderColor: colors.border.medium, borderRadius: 8,
      padding: 12, fontSize: 15, color: colors.text.primary,
    },
    searchButton: {
      backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16,
      alignItems: 'center', justifyContent: 'center',
    },
    searchButtonText: { color: colors.background.card, fontWeight: '600' },
    list: { flex: 1 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    emptyText: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 20 },
    bookRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.medium,
    },
    bookText: { flex: 1 },
    bookTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
    bookAuthor: { fontSize: 13, color: colors.text.secondary },
    badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    badgeReady: { backgroundColor: colors.primary + '22' },
    badgeTitleOnly: { backgroundColor: colors.border.medium + '44' },
    badgeText: { fontSize: 11, color: colors.text.tertiary },
    badgeTextReady: { color: colors.primary, fontWeight: '600' },
    addMark: { fontSize: 20, color: colors.text.tertiary, width: 24, textAlign: 'center' },
    addMarkSelected: { color: colors.primary, fontWeight: '700' },
    primaryButton: {
      backgroundColor: colors.primary, padding: 16, borderRadius: 8,
      alignItems: 'center', marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    secondaryLink: { alignItems: 'center', marginTop: 14 },
    secondaryLinkText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  });
