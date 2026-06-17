// screens/BookDetailScreen.tsx
// Phase 11D-CP3a — Book Detail rewritten from a stats dashboard into a
// curated discovery surface. Four sections (Most cooked / Recently cooked /
// Friends' favorites / Bookmarked), each hidden when empty, surface 5 top
// recipes per section from getCuratedBookSections (11D-CP1). "See all →" on
// a section header passes a section id to BookView, which CP3b will read to
// preset the sort. "Browse all N recipes →" at the bottom routes to BookView
// with no preset.
//
// Locked CP3 decisions (Tom, 2026-05-29):
//   1. "See all →" routes to BookView with the section's natural sort
//      (mostCooked → most_cooked, recentlyCooked → recently_cooked,
//      friendsFavorites → friends_favorites, bookmarked → bookmarked).
//      The CP3a screen passes a sectionId param; CP3b consumes it.
//   2-4. (BookView concerns — handled in CP3b.)
//   5. Header meta line: "N recipes · X cooked · Y bookmarked" — three
//      counts. Same pattern will apply to Chef Detail in CP4.
//
// The screen is registered in both `RecipesStack` (CP2 — from BookList) and
// `StatsStack` (legacy — from stats drill-down). Same component, same params
// shape (`{ bookId: string }`). Cross-stack navigation via the tab navigator
// handles "go to BookView" from either entry path without the tab switching
// surprising the user.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StatsStackParamList } from '../App';
import { useTheme } from '../lib/theme/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  getBook,
  getCuratedBookSections,
  getRecipesByBook,
  type CuratedRecipe,
  type CuratedSections,
} from '../lib/services/bookViewService';
import { getCookingHistory } from '../lib/services/recipeHistoryService';
import { getRecipesWithTag } from '../lib/services/userRecipeTagsService';
import BookmarkFilterRow from '../components/recipe/BookmarkFilterRow';
import type { Book } from '../lib/types/recipeFeatures';

// Typed against StatsStackParamList for the existing drill-down entry point;
// also reachable from RecipesStack with the same `{ bookId: string }` shape,
// so reading `route.params.bookId` works from either stack. Outbound
// navigations to RecipesStack-only screens (BookView) cross-stack via the
// tab navigator (see `goToBookView` below).
type Props = NativeStackScreenProps<StatsStackParamList, 'BookDetail'>;

// Section ids passed to BookView as a sort preset hint (consumed in CP3b).
export type BookSectionId =
  | 'mostCooked'
  | 'recentlyCooked'
  | 'friendsFavorites'
  | 'bookmarked';

// Cover fallback palette — kept in sync with BookListScreen so the same book
// gets the same color across the index and the detail surface. Promote to a
// shared helper if a third consumer arrives.
const COVER_PALETTE = [
  '#E8C5A0', '#C5A88B', '#A8C5BA', '#B5A8C5',
  '#E8B0A0', '#A0B8E8', '#C5C5A0', '#A0C5A8',
];
function hashCoverColor(bookId: string): string {
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = (hash * 31 + bookId.charCodeAt(i)) | 0;
  }
  return COVER_PALETTE[Math.abs(hash) % COVER_PALETTE.length];
}

function authorDisplay(book: Book | null): string {
  if (!book) return '';
  return book.author?.trim() || '';
}

export default function BookDetailScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { colors } = useTheme();

  const [book, setBook] = useState<Book | null>(null);
  const [sections, setSections] = useState<CuratedSections | null>(null);
  const [headerStats, setHeaderStats] = useState<{
    recipe_count: number;
    cooked_count: number;
    bookmarked_count: number;
  }>({ recipe_count: 0, cooked_count: 0, bookmarked_count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Per-book bookmark counts (key → # of this book's recipes carrying it).
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Not signed in');
          setLoading(false);
          return;
        }
        const userId = user.id;
        setCurrentUserId(userId);
        // Parallel fetch — `getCuratedBookSections` internally calls history
        // + saved tags too, so we accept a small double-fetch here for the
        // header totals to keep CP1's contract pristine. The cost is two
        // small concurrent queries; negligible at dev scale.
        const [bookRes, sectionsRes, scopeRecipes, history, savedTags] =
          await Promise.all([
            getBook(bookId),
            getCuratedBookSections(bookId, userId, 5),
            getRecipesByBook(bookId, userId),
            getCookingHistory(userId),
            getRecipesWithTag(userId, 'saved'),
          ]);

        setBook(bookRes);
        setSections(sectionsRes);

        const savedSet = new Set(savedTags.map((s) => s.id));
        const recipe_count = scopeRecipes.length;
        const cooked_count = scopeRecipes.filter(
          (r) => (history.get(r.id)?.times_cooked ?? 0) > 0,
        ).length;
        const bookmarked_count = scopeRecipes.filter((r) => savedSet.has(r.id)).length;
        setHeaderStats({ recipe_count, cooked_count, bookmarked_count });

        // Per-book bookmark counts — one tag row per (recipe, tag), so counting
        // tag occurrences over this book's recipes = # of recipes per bookmark.
        // Chunk the .in() list to stay comfortably under PostgREST limits.
        const bookRecipeIds = scopeRecipes.map((r) => r.id);
        const bmCounts: Record<string, number> = {};
        if (bookRecipeIds.length) {
          const chunks: string[][] = [];
          for (let i = 0; i < bookRecipeIds.length; i += 200) chunks.push(bookRecipeIds.slice(i, i + 200));
          const tagRowSets = await Promise.all(
            chunks.map((ids) =>
              supabase.from('user_recipe_tags').select('tag').eq('user_id', userId).in('recipe_id', ids),
            ),
          );
          for (const res of tagRowSets) {
            for (const row of (res.data ?? []) as { tag: string }[]) {
              bmCounts[row.tag] = (bmCounts[row.tag] ?? 0) + 1;
            }
          }
        }
        setBookmarkCounts(bmCounts);
      } catch (e: any) {
        console.error('Error loading BookDetail data:', e);
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [bookId]);

  // Cross-stack navigation to BookView. Reaches the bottom-tab navigator via
  // two getParent() climbs (screen → stack → tab) and dispatches a nested
  // navigation into RecipesStack regardless of which stack opened this
  // screen. Tab switches to Recipes — fine, since the user wants to browse.
  const goToBookView = useCallback(
    (sectionId?: BookSectionId, bookmarkKey?: string) => {
      // Walk UP the navigator chain to find the one that can route to
      // RecipesStack (the bottom-tab navigator). BookDetail is registered in
      // both RecipesStack (Browse-by-Books path) and StatsStack (drill-down
      // path), so the tab navigator sits at a different depth depending on the
      // entry path. A fixed getParent().getParent() climb overshoots from the
      // Recipes path (lands above the tab navigator → undefined); walking until
      // we find a navigator whose routeNames include 'RecipesStack' works from
      // both.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let nav: any = navigation;
      while (nav) {
        const routeNames: string[] | undefined = nav.getState?.()?.routeNames;
        if (routeNames?.includes('RecipesStack')) {
          nav.navigate('RecipesStack', {
            screen: 'BookView',
            params: { bookId, sectionId, bookmarkKey },
          });
          return;
        }
        nav = nav.getParent?.();
      }
      console.warn('BookDetail: RecipesStack navigator not reachable');
    },
    [navigation, bookId],
  );

  const onRecipePress = useCallback(
    (recipeId: string, title: string) => {
      // RecipeDetail is in both RecipesStack and (likely) StatsStack — same
      // route name + param shape. Same `navigation.navigate` works in both.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigation.navigate('RecipeDetail' as any, { recipe: { id: recipeId, title } });
    },
    [navigation],
  );

  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Set the navigation header title once the book loads.
  useEffect(() => {
    if (book?.title) navigation.setOptions({ title: book.title });
  }, [book?.title, navigation]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.errorText}>{error || 'Book not found'}</Text>
      </View>
    );
  }

  const { recipe_count, cooked_count, bookmarked_count } = headerStats;
  const metaParts = [`${recipe_count} recipe${recipe_count !== 1 ? 's' : ''}`];
  if (cooked_count > 0) metaParts.push(`${cooked_count} cooked`);
  if (bookmarked_count > 0) metaParts.push(`${bookmarked_count} bookmarked`);

  const renderSection = (
    id: BookSectionId,
    label: string,
    items: CuratedRecipe[],
  ) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.section} key={id}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {label}{' '}
            <Text style={styles.sectionCount}>· {items.length}</Text>
          </Text>
          <TouchableOpacity onPress={() => goToBookView(id)} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          data={items}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.recipeCard}
              activeOpacity={0.8}
              onPress={() => onRecipePress(item.id, item.title)}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.recipeImage} />
              ) : (
                <View style={[styles.recipeImage, styles.recipeImagePlaceholder]}>
                  <Text style={styles.recipeImagePlaceholderText} numberOfLines={3}>
                    {item.title}
                  </Text>
                </View>
              )}
              <Text style={styles.recipeTitle} numberOfLines={2}>{item.title}</Text>
              {renderSectionMetric(id, item)}
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionListContent}
        />
      </View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      {/* Header — cover thumb + title + author + meta line. */}
      <View style={styles.headerRow}>
        {book.cover_image_url ? (
          <Image source={{ uri: book.cover_image_url }} style={styles.headerCover} />
        ) : (
          <View
            style={[styles.headerCoverFallback, { backgroundColor: hashCoverColor(bookId) }]}
          >
            <Text style={styles.headerCoverFallbackText} numberOfLines={4}>
              {book.title}
            </Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={3}>{book.title}</Text>
          {!!authorDisplay(book) && (
            <Text style={styles.headerAuthor} numberOfLines={1}>{authorDisplay(book)}</Text>
          )}
          <Text style={styles.headerMeta} numberOfLines={2}>{metaParts.join(' · ')}</Text>
        </View>
      </View>

      {/* Quick access at the top — browse-all CTA + bookmark filter pills. */}
      {recipe_count > 0 && (
        <TouchableOpacity
          style={styles.browseAllTop}
          activeOpacity={0.8}
          onPress={() => goToBookView()}
        >
          <Text style={styles.browseAllButtonText}>
            Browse all {recipe_count} recipe{recipe_count !== 1 ? 's' : ''} →
          </Text>
        </TouchableOpacity>
      )}
      {currentUserId && (
        <BookmarkFilterRow
          userId={currentUserId}
          activeKey={null}
          onChange={(key) => { if (key) goToBookView(undefined, key); }}
          counts={bookmarkCounts}
          showCounts
          style={styles.bookmarkPills}
        />
      )}

      {/* Curated sections — order matches the prompt spec; empty hide. */}
      {sections && (
        <>
          {renderSection('mostCooked', 'Most cooked', sections.mostCooked)}
          {renderSection('recentlyCooked', 'Recently cooked', sections.recentlyCooked)}
          {renderSection('friendsFavorites', "Friends' favorites", sections.friendsFavorites)}
          {renderSection('bookmarked', 'Bookmarked', sections.bookmarked)}
        </>
      )}

      {/* Empty state — book has no recipes the user owns (rare edge case
          where a book record exists but no recipes from it). */}
      {recipe_count === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No recipes in this book yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

// Per-section trailing metric on the recipe card — small text under the
// title. Each section's CuratedRecipe carries exactly one of these fields
// populated (see CuratedRecipe in bookViewService).
function renderSectionMetric(id: BookSectionId, item: CuratedRecipe) {
  let text: string | null = null;
  if (id === 'mostCooked' && item.times_cooked != null) {
    text = `${item.times_cooked}× cooked`;
  } else if (id === 'recentlyCooked' && item.last_cooked_at) {
    text = relativeDate(item.last_cooked_at);
  } else if (id === 'friendsFavorites' && item.friends_cooked_count != null) {
    const n = item.friends_cooked_count;
    text = `${n} friend${n !== 1 ? 's' : ''}`;
  } else if (id === 'bookmarked' && item.saved_at) {
    text = `Saved ${relativeDate(item.saved_at)}`;
  }
  if (!text) return null;
  return <BookCardMetric>{text}</BookCardMetric>;
}

function relativeDate(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return '';
  }
}

// Inline child component for the per-section metric line — separate so it
// can pull from the parent's theme via useTheme without prop-drilling.
function BookCardMetric({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 2 }}>
      {children}
    </Text>
  );
}

function makeStyles(colors: any) {
  const screenWidth = Dimensions.get('window').width;
  const CARD_W = Math.min(150, (screenWidth - 60) / 2.3);
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    errorText: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: 'center',
    },

    headerRow: {
      flexDirection: 'row',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 18,
      gap: 14,
    },
    headerCover: {
      width: 82,
      height: 112,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
    },
    headerCoverFallback: {
      width: 82,
      height: 112,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    headerCoverFallbackText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#ffffff',
      textAlign: 'center',
    },
    headerText: {
      flex: 1,
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      lineHeight: 25,
    },
    headerAuthor: {
      fontSize: 14,
      color: colors.text.secondary,
      marginTop: 4,
    },
    headerMeta: {
      fontSize: 13,
      color: colors.text.tertiary,
      marginTop: 8,
    },

    section: {
      paddingTop: 18,
      paddingBottom: 6,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text.primary,
    },
    sectionCount: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text.tertiary,
    },
    seeAll: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    sectionListContent: {
      paddingHorizontal: 18,
      gap: 12,
    },

    recipeCard: {
      width: CARD_W,
    },
    recipeImage: {
      width: CARD_W,
      height: CARD_W * 0.85,
      borderRadius: 10,
      backgroundColor: colors.background.secondary,
    },
    recipeImagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      backgroundColor: colors.background.secondary,
    },
    recipeImagePlaceholderText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      textAlign: 'center',
    },
    recipeTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
      marginTop: 6,
    },

    browseAllTop: {
      marginTop: 4,
      marginHorizontal: 18,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    bookmarkPills: {
      paddingLeft: 18,
      paddingTop: 12,
      paddingBottom: 2,
    },
    browseAllButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
    },

    empty: {
      paddingHorizontal: 24,
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
    },
  });
}
