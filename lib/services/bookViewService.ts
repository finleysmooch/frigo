// ============================================
// BOOK & AUTHOR VIEW SERVICE
// ============================================
// Organizes recipes by book and author/chef
// Provides views for browsing cookbook libraries
// FIXED: Added type annotation for implicit any parameter
// ============================================

import { supabase } from '../supabase';
import { fetchAllRows } from '../utils/fetchAllRows';
import { Book, BookWithRecipeCount, AuthorWithBooks, RecipeWithBook, BookGroup, AuthorGroup } from '../types/recipeFeatures';
import { getCookingHistory, getFriendsCookingInfo } from './recipeHistoryService';
import { getRecipesWithTag } from './userRecipeTagsService';

// ============================================
// BOOK QUERIES
// ============================================

/**
 * Get all books with recipe counts
 */
export async function getAllBooks(userId?: string): Promise<BookWithRecipeCount[]> {
  try {
    const { data, error } = await supabase.rpc('get_books_with_counts', {
      p_user_id: userId || null
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching books:', error);
    // Fallback if RPC doesn't exist
    return fallbackGetBooks(userId);
  }
}

/**
 * Fallback book query (if RPC not available)
 */
async function fallbackGetBooks(userId?: string): Promise<BookWithRecipeCount[]> {
  try {
    const booksQuery = supabase.from('books').select('*').order('title');

    const { data: books, error: booksError } = await booksQuery;
    if (booksError) throw booksError;

    // Get recipe counts for each book
    const booksWithCounts: BookWithRecipeCount[] = await Promise.all(
      (books || []).map(async book => {
        const { count: recipeCount } = await supabase
          .from('recipes')
          .select('*', { count: 'exact', head: true })
          .eq('book_id', book.id);

        const { count: userRecipeCount } = userId
          ? await supabase
              .from('recipes')
              .select('*', { count: 'exact', head: true })
              .eq('book_id', book.id)
              .eq('user_id', userId)
          : { count: 0 };

        const { data: ownership } = userId
          ? await supabase
              .from('user_books')
              .select('id')
              .eq('user_id', userId)
              .eq('book_id', book.id)
              .single()
          : { data: null };

        return {
          ...book,
          recipe_count: recipeCount || 0,
          user_recipe_count: userRecipeCount || 0,
          is_owned: !!ownership
        };
      })
    );

    return booksWithCounts;
  } catch (error) {
    console.error('Error in fallback book query:', error);
    return [];
  }
}

/**
 * Get single book with details
 */
export async function getBook(bookId: string): Promise<Book | null> {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching book:', error);
    return null;
  }
}

/**
 * Get book by ISBN
 */
export async function getBookByISBN(isbn: string): Promise<Book | null> {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .or(`isbn.eq.${isbn},isbn13.eq.${isbn}`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching book by ISBN:', error);
    return null;
  }
}

/**
 * Search books by title or author
 */
export async function searchBooks(query: string): Promise<Book[]> {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .or(`title.ilike.%${query}%,author.ilike.%${query}%`)
      .order('title')
      .limit(20);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching books:', error);
    return [];
  }
}

// ============================================
// RECIPES BY BOOK
// ============================================

/**
 * Get all recipes from a specific book
 */
export async function getRecipesByBook(
  bookId: string,
  userId?: string
): Promise<RecipeWithBook[]> {
  try {
    // 11D fix: the `recipes_with_books` view this used to read doesn't exist
    // in the DB (no migration ever created it → PGRST205). Query the base
    // `recipes` table with book/chef joins instead and flatten to the
    // denormalized RecipeWithBook shape — same direct-query pattern
    // BookViewScreen already uses. All joined columns are known-present
    // (used elsewhere in this service).
    // Select all columns on the joined books/chefs rows so missing columns
    // come back undefined (→ null below) rather than throwing 42703. The
    // books table's author_* columns in particular are inconsistent across
    // environments, so we don't name them explicitly.
    let query = supabase
      .from('recipes')
      .select(`
        *,
        books:book_id ( * ),
        chefs:chef_id ( * )
      `)
      .eq('book_id', bookId)
      .order('page_number', { ascending: true, nullsFirst: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return ((data ?? []) as any[]).map((row) => {
      const { books, chefs, ...recipe } = row;
      return {
        ...recipe,
        book_title: books?.title ?? null,
        book_author: books?.author ?? null,
        author_normalized: books?.author_normalized ?? null,
        author_bio: books?.author_bio ?? null,
        author_image_url: books?.author_image_url ?? null,
        author_website: books?.author_website ?? null,
        book_cover: books?.cover_image_url ?? null,
        book_year: books?.publication_year ?? null,
        chef_name: chefs?.name ?? null,
        chef_bio: null,
        chef_image: chefs?.image_url ?? null,
      } as RecipeWithBook;
    });
  } catch (error) {
    console.error('Error fetching recipes by book:', error);
    return [];
  }
}

/**
 * Get user's books with their recipes
 */
export async function getUserBooks(userId: string): Promise<BookGroup[]> {
  try {
    // Get books the user owns
    const { data: userBooks, error: userBooksError } = await supabase
      .from('user_books')
      .select('book_id')
      .eq('user_id', userId);

    if (userBooksError) throw userBooksError;

    if (!userBooks || userBooks.length === 0) return [];

    const bookIds = userBooks.map(ub => ub.book_id);

    // Get book details
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('*')
      .in('id', bookIds)
      .order('title');

    if (booksError) throw booksError;

    // Get recipes for each book
    const bookGroups: BookGroup[] = await Promise.all(
      (books || []).map(async book => {
        const recipes = await getRecipesByBook(book.id, userId);
        return {
          book,
          recipes
        };
      })
    );

    return bookGroups.filter(bg => bg.recipes.length > 0);
  } catch (error) {
    console.error('Error fetching user books:', error);
    return [];
  }
}

// ============================================
// AUTHOR/CHEF QUERIES
// ============================================

/**
 * Get all authors with their books and recipe counts
 */
export async function getAllAuthors(): Promise<AuthorWithBooks[]> {
  try {
    // Get unique authors from books
    const { data: books, error } = await supabase
      .from('books')
      .select('author, author_normalized, author_bio, author_image_url, author_website')
      .not('author', 'is', null)
      .order('author');

    if (error) throw error;

    // Group by author_normalized (or author if normalized not available)
    const authorMap = new Map<string, AuthorWithBooks>();

    for (const book of books || []) {
      const key = book.author_normalized || book.author || 'Unknown';

      if (!authorMap.has(key)) {
        authorMap.set(key, {
          author_normalized: key,
          author: book.author || 'Unknown',
          author_bio: book.author_bio,
          author_image_url: book.author_image_url,
          author_website: book.author_website,
          book_count: 0,
          recipe_count: 0,
          books: []
        });
      }
    }

    // Get books and recipes for each author
    const authors = await Promise.all(
      Array.from(authorMap.values()).map(async author => {
        const { data: authorBooks, error: booksError } = await supabase
          .from('books')
          .select('*')
          .or(
            `author_normalized.eq.${author.author_normalized},author.eq.${author.author}`
          );

        if (booksError) throw booksError;

        // Get recipe count for each book
        const booksWithCounts: BookWithRecipeCount[] = await Promise.all(
          (authorBooks || []).map(async book => {
            const { count: recipeCount } = await supabase
              .from('recipes')
              .select('*', { count: 'exact', head: true })
              .eq('book_id', book.id);

            return {
              ...book,
              recipe_count: recipeCount || 0,
              user_recipe_count: 0,
              is_owned: false
            };
          })
        );

        const totalRecipes = booksWithCounts.reduce(
          (sum, book) => sum + book.recipe_count,
          0
        );

        return {
          ...author,
          book_count: booksWithCounts.length,
          recipe_count: totalRecipes,
          books: booksWithCounts
        };
      })
    );

    return authors.filter(a => a.recipe_count > 0).sort((a, b) => a.author.localeCompare(b.author));
  } catch (error) {
    console.error('Error fetching authors:', error);
    return [];
  }
}

/**
 * Get single author with all their books
 */
export async function getAuthor(authorNormalized: string): Promise<AuthorWithBooks | null> {
  try {
    const authors = await getAllAuthors();
    return authors.find(a => a.author_normalized === authorNormalized) || null;
  } catch (error) {
    console.error('Error fetching author:', error);
    return null;
  }
}

/**
 * Get recipes by author/chef
 */
export async function getRecipesByAuthor(
  authorNormalized: string
): Promise<AuthorGroup | null> {
  try {
    const author = await getAuthor(authorNormalized);
    if (!author) return null;

    // Get all recipes from author's books
    const bookGroups: BookGroup[] = await Promise.all(
      author.books.map(async book => {
        const recipes = await getRecipesByBook(book.id);
        return {
          book,
          recipes
        };
      })
    );

    const totalRecipes = bookGroups.reduce((sum, bg) => sum + bg.recipes.length, 0);

    return {
      author_normalized: author.author_normalized,
      author_display_name: author.author,
      author_bio: author.author_bio,
      author_image_url: author.author_image_url,
      books: bookGroups,
      total_recipes: totalRecipes
    };
  } catch (error) {
    console.error('Error fetching recipes by author:', error);
    return null;
  }
}

// ============================================
// CHEF QUERIES (from chefs table)
// ============================================

/**
 * Get recipes by chef (using chef_id)
 */
export async function getRecipesByChef(chefId: string): Promise<RecipeWithBook[]> {
  try {
    const { data, error } = await supabase
      .from('recipes_with_books')
      .select('*')
      .eq('chef_id', chefId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching recipes by chef:', error);
    return [];
  }
}

/**
 * Get chef's books
 */
export async function getChefBooks(chefId: string): Promise<Book[]> {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('chef_id', chefId)
      .order('publication_year', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching chef books:', error);
    return [];
  }
}

// ============================================
// BOOK STATISTICS
// ============================================

/**
 * Get statistics for a book
 */
export async function getBookStats(bookId: string): Promise<{
  total_recipes: number;
  recipes_with_times: number;
  avg_prep_time: number | null;
  avg_cook_time: number | null;
  difficulty_distribution: Record<string, number>;
  cuisine_types: string[];
}> {
  try {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('prep_time_min, cook_time_min, difficulty_level, cuisine_types')
      .eq('book_id', bookId);

    if (error) throw error;

    const stats = {
      total_recipes: recipes?.length || 0,
      recipes_with_times:
        recipes?.filter(r => r.prep_time_min || r.cook_time_min).length || 0,
      avg_prep_time: null as number | null,
      avg_cook_time: null as number | null,
      difficulty_distribution: {} as Record<string, number>,
      cuisine_types: [] as string[]
    };

    if (recipes && recipes.length > 0) {
      const prepTimes = recipes
        .map(r => r.prep_time_min)
        .filter((t): t is number => t !== null);
      const cookTimes = recipes
        .map(r => r.cook_time_min)
        .filter((t): t is number => t !== null);

      stats.avg_prep_time =
        prepTimes.length > 0
          ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
          : null;

      stats.avg_cook_time =
        cookTimes.length > 0
          ? Math.round(cookTimes.reduce((a, b) => a + b, 0) / cookTimes.length)
          : null;

      // Count difficulty levels
      recipes.forEach(r => {
        const diff = r.difficulty_level || 'medium';
        stats.difficulty_distribution[diff] =
          (stats.difficulty_distribution[diff] || 0) + 1;
      });

      // Collect unique cuisines
      // FIXED: Added type annotation for parameter 'c'
      const cuisineSet = new Set<string>();
      recipes.forEach(r => {
        (r.cuisine_types || []).forEach((c: string) => cuisineSet.add(c));
      });
      stats.cuisine_types = Array.from(cuisineSet);
    }

    return stats;
  } catch (error) {
    console.error('Error fetching book stats:', error);
    return {
      total_recipes: 0,
      recipes_with_times: 0,
      avg_prep_time: null,
      avg_cook_time: null,
      difficulty_distribution: {},
      cuisine_types: []
    };
  }
}

// ============================================
// 11D-CP1 — Curated sections + index queries (book & chef variants)
// ============================================
// Data foundation for the Phase 11D Book Detail / Chef Detail redesigns and
// the new Books / Chefs index screens. Pure data layer — no React, no UI
// coupling. Empty arrays (never throw, never null) for the "no content" case;
// CP3/CP4 hide empty sections at render time.
//
// Scope rules (locked):
//   - Curated chef sections: direct `recipes.chef_id = X` match only — does
//     NOT broaden to recipes from books authored by that chef. (The data
//     model lets the same chef appear via either `recipes.chef_id` or via
//     `recipes.book_id → books.chef_id`; v1 uses the simpler scope. CP3+
//     can widen later if it under-surfaces.)
//   - All user-scoping is done by intersecting with the user's recipes set
//     (the existing pattern from `getAllBooks`'s fallback path).
//   - `recipe_count` on the index queries = the user's recipes in the
//     scope, not the global recipe count (matches the existing
//     `user_recipe_count` semantic).
//
// Bookmark concept = `user_recipe_tags` rows with `tag = 'saved'`, accessed
// via `userRecipeTagsService.getRecipesWithTag(userId, 'saved')`. Cook Soon
// (`tag = 'cook_soon'`) is intentionally not surfaced here — additive in a
// later CP if a "Want to cook from this book" section earns its place.

// ── Types ───────────────────────────────────────────────────────────

export interface CuratedRecipe {
  id: string;
  title: string;
  image_url: string | null;
  chef_name: string | null;
  book_title: string | null;
  // Section-specific metric — exactly one is populated per row, matching
  // the section the row came from.
  times_cooked?: number;          // 'mostCooked'
  last_cooked_at?: string;        // 'recentlyCooked'  (ISO)
  friends_cooked_count?: number;  // 'friendsFavorites'
  saved_at?: string;              // 'bookmarked'      (ISO; tag created_at)
}

export interface CuratedSections {
  mostCooked: CuratedRecipe[];
  recentlyCooked: CuratedRecipe[];
  friendsFavorites: CuratedRecipe[];
  bookmarked: CuratedRecipe[];
}

export type BookSortOption =
  | 'author_then_title'   // default — chef last_name → first_name → title
  | 'title_asc'
  | 'recipes_desc'
  | 'recently_added'
  | 'most_cooked';

export interface BookWithStats {
  id: string;
  title: string;
  author: string | null;
  cover_image_url: string | null;
  chef_id: string | null;
  chef_first_name: string | null;
  chef_last_name: string | null;
  chef_name: string | null;
  recipe_count: number;
  cooked_count: number;
}

export type ChefSortOption =
  | 'name'           // default — last_name → first_name → name fallback
  | 'recipes_desc'
  | 'most_cooked'
  | 'recently_added';

export interface ChefWithStats {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  recipe_count: number;
  cooked_count: number;
  book_count: number;
}

// ── Internal helpers ────────────────────────────────────────────────

function emptyCuratedSections(): CuratedSections {
  return {
    mostCooked: [],
    recentlyCooked: [],
    friendsFavorites: [],
    bookmarked: [],
  };
}

interface ScopeRecipeRow {
  id: string;
  title: string;
  image_url: string | null;
  chefs: { name: string | null } | null;
  books: { title: string | null } | null;
}

function toCuratedRecipe(
  r: ScopeRecipeRow,
  metric: Partial<CuratedRecipe>,
): CuratedRecipe {
  return {
    id: r.id,
    title: r.title,
    image_url: r.image_url,
    chef_name: r.chefs?.name ?? null,
    book_title: r.books?.title ?? null,
    ...metric,
  };
}

// Build all four curated sections from a pre-fetched scope recipe set.
// Shared between `getCuratedBookSections` and `getCuratedChefSections` —
// the two callers differ only in how they fetch the scope set.
async function buildCuratedSections(
  scopeRecipes: ScopeRecipeRow[],
  userId: string,
  limit: number,
): Promise<CuratedSections> {
  if (scopeRecipes.length === 0) return emptyCuratedSections();

  const scopeIds = new Set(scopeRecipes.map((r) => r.id));

  const [history, friends, saved] = await Promise.all([
    getCookingHistory(userId),
    getFriendsCookingInfo(userId),
    getRecipesWithTag(userId, 'saved'),
  ]);

  // mostCooked — times_cooked > 0, sort desc by times_cooked, tie-break by
  // last_cooked desc.
  const mostCooked = scopeRecipes
    .map((r) => ({ r, h: history.get(r.id) }))
    .filter((x) => (x.h?.times_cooked ?? 0) > 0)
    .sort((a, b) => {
      const cmp = b.h!.times_cooked - a.h!.times_cooked;
      if (cmp !== 0) return cmp;
      return (b.h!.last_cooked ?? '').localeCompare(a.h!.last_cooked ?? '');
    })
    .slice(0, limit)
    .map((x) => toCuratedRecipe(x.r, { times_cooked: x.h!.times_cooked }));

  // recentlyCooked — last_cooked != null, sort desc by last_cooked.
  const recentlyCooked = scopeRecipes
    .map((r) => ({ r, h: history.get(r.id) }))
    .filter((x) => x.h?.last_cooked != null)
    .sort((a, b) => b.h!.last_cooked.localeCompare(a.h!.last_cooked))
    .slice(0, limit)
    .map((x) => toCuratedRecipe(x.r, { last_cooked_at: x.h!.last_cooked }));

  // friendsFavorites — friends_cooked_count > 0, sort desc.
  const friendsFavorites = scopeRecipes
    .map((r) => ({ r, f: friends.get(r.id) }))
    .filter((x) => (x.f?.friends_cooked_count ?? 0) > 0)
    .sort((a, b) => b.f!.friends_cooked_count - a.f!.friends_cooked_count)
    .slice(0, limit)
    .map((x) => toCuratedRecipe(x.r, { friends_cooked_count: x.f!.friends_cooked_count }));

  // bookmarked — `saved` tag rows scoped to the recipe set, ordered desc
  // by tag created_at (most recently saved first). `getRecipesWithTag`
  // already returns in DESC order, so just intersect and slice.
  const bookmarked: CuratedRecipe[] = [];
  const scopeRecipeById = new Map(scopeRecipes.map((r) => [r.id, r]));
  for (const tagged of saved) {
    if (!scopeIds.has(tagged.id)) continue;
    const r = scopeRecipeById.get(tagged.id);
    if (!r) continue;
    bookmarked.push(toCuratedRecipe(r, { saved_at: tagged.tagged_at }));
    if (bookmarked.length >= limit) break;
  }

  return { mostCooked, recentlyCooked, friendsFavorites, bookmarked };
}

// ── Curated section queries ─────────────────────────────────────────

/**
 * Curated discovery sections for a single book's Detail surface.
 *
 * Scope = `recipes` rows with `book_id = bookId AND user_id = userId`.
 * Returns four sections (mostCooked / recentlyCooked / friendsFavorites /
 * bookmarked), each capped at `limit` (default 5). Empty arrays are the
 * contract for "no content" — never throws on a valid (bookId, userId).
 */
export async function getCuratedBookSections(
  bookId: string,
  userId: string,
  limit: number = 5,
): Promise<CuratedSections> {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, image_url, chefs:chef_id (name), books:book_id (title)')
      .eq('book_id', bookId)
      .eq('user_id', userId);
    if (error) throw error;
    const scope = (data ?? []) as unknown as ScopeRecipeRow[];
    return await buildCuratedSections(scope, userId, limit);
  } catch (error) {
    console.error('Error fetching curated book sections:', error);
    return emptyCuratedSections();
  }
}

/**
 * Curated discovery sections for a single chef's Detail surface.
 *
 * Scope = `recipes` rows with `chef_id = chefId AND user_id = userId`.
 * Does NOT broaden via `books.chef_id` — v1 uses the simpler direct match.
 * Same 4-section contract as `getCuratedBookSections`.
 */
export async function getCuratedChefSections(
  chefId: string,
  userId: string,
  limit: number = 5,
): Promise<CuratedSections> {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, image_url, chefs:chef_id (name), books:book_id (title)')
      .eq('chef_id', chefId)
      .eq('user_id', userId);
    if (error) throw error;
    const scope = (data ?? []) as unknown as ScopeRecipeRow[];
    return await buildCuratedSections(scope, userId, limit);
  } catch (error) {
    console.error('Error fetching curated chef sections:', error);
    return emptyCuratedSections();
  }
}

// ── Books index ─────────────────────────────────────────────────────

interface BookIndexRow {
  id: string;
  title: string;
  author: string | null;
  cover_image_url: string | null;
  chef_id: string | null;
  created_at: string;
  chefs: {
    first_name: string | null;
    last_name: string | null;
    name: string | null;
  } | null;
}

// Tagged result row for internal sort with metadata that isn't in the public
// BookWithStats shape (created_at for 'recently_added').
interface SortableBook extends BookWithStats {
  _created_at: string;
}

/**
 * Books index for the Phase 11D Books index screen (CP2).
 *
 * "Books in the user's library" = distinct `recipes.book_id` for the user's
 * recipes. Returns each book with chef join (LEFT JOIN so chef-less books
 * still surface), `recipe_count` (user's recipes in the book), and
 * `cooked_count` (distinct recipes in the book the user has cooked).
 *
 * Default sort is the compound `chefs.last_name ASC NULLS LAST, first_name
 * ASC NULLS LAST, title ASC` — books without a linked chef sort to the
 * bottom (defensive against incomplete data). Sort is applied client-side
 * since Supabase's `.order()` on joined columns is awkward when nulls-last
 * + multi-key is needed.
 */
export async function getBooksForIndex(
  userId: string,
  sort: BookSortOption = 'author_then_title',
): Promise<BookWithStats[]> {
  try {
    // 1. Get the user's recipes with a book_id — gives the book set + the
    //    per-book recipe list (needed for both recipe_count and cooked_count).
    //    Paginated: an unpaginated select caps at 1000 rows, which silently
    //    UNDERCOUNTS per-book recipe_count for users with >1000 recipes (the
    //    books-page-shows-67-but-detail-shows-120 bug).
    const userRecipes = await fetchAllRows<{ id: string; book_id: string | null }>((from, to) =>
      supabase
        .from('recipes')
        .select('id, book_id')
        .eq('user_id', userId)
        .not('book_id', 'is', null)
        .range(from, to)
    );
    if (userRecipes.length === 0) return [];

    const bookRecipeIds = new Map<string, string[]>();
    for (const r of userRecipes) {
      if (!r.book_id) continue;
      const list = bookRecipeIds.get(r.book_id) ?? [];
      list.push(r.id);
      bookRecipeIds.set(r.book_id, list);
    }
    const bookIds = Array.from(bookRecipeIds.keys());

    // 2. Fetch the books with chef join. LEFT JOIN — chef-less books still
    //    surface.
    const { data: booksData, error: booksError } = await supabase
      .from('books')
      .select(`
        id, title, author, cover_image_url, chef_id, created_at,
        chefs:chef_id ( first_name, last_name, name )
      `)
      .in('id', bookIds);
    if (booksError) throw booksError;
    const books = (booksData ?? []) as unknown as BookIndexRow[];

    // 3. History for cooked_count.
    const history = await getCookingHistory(userId);

    // 4. Build SortableBook rows.
    const rows: SortableBook[] = books.map((b) => {
      const recipes = bookRecipeIds.get(b.id) ?? [];
      const cooked = recipes.filter((id) => (history.get(id)?.times_cooked ?? 0) > 0).length;
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        cover_image_url: b.cover_image_url,
        chef_id: b.chef_id,
        chef_first_name: b.chefs?.first_name ?? null,
        chef_last_name: b.chefs?.last_name ?? null,
        chef_name: b.chefs?.name ?? null,
        recipe_count: recipes.length,
        cooked_count: cooked,
        _created_at: b.created_at,
      };
    });

    // 5. Sort.
    sortBookRows(rows, sort);

    // 6. Strip private fields before returning.
    return rows.map(({ _created_at: _, ...rest }) => rest);
  } catch (error) {
    console.error('Error fetching books for index:', error);
    return [];
  }
}

// NULLS-LAST string comparator: a `null` value sorts AFTER any concrete
// string. Uses a sentinel max-codepoint string so a single `localeCompare`
// call works.
const NULL_LAST_SENTINEL = '￿';
function nullsLast(s: string | null | undefined): string {
  return (s ?? NULL_LAST_SENTINEL).toLowerCase();
}

function sortBookRows(rows: SortableBook[], sort: BookSortOption): void {
  switch (sort) {
    case 'author_then_title':
      rows.sort((a, b) => {
        const cmpLast = nullsLast(a.chef_last_name).localeCompare(nullsLast(b.chef_last_name));
        if (cmpLast !== 0) return cmpLast;
        const cmpFirst = nullsLast(a.chef_first_name).localeCompare(nullsLast(b.chef_first_name));
        if (cmpFirst !== 0) return cmpFirst;
        return a.title.localeCompare(b.title);
      });
      break;
    case 'title_asc':
      rows.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'recipes_desc':
      rows.sort((a, b) => {
        const cmp = b.recipe_count - a.recipe_count;
        return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
      });
      break;
    case 'recently_added':
      rows.sort((a, b) => b._created_at.localeCompare(a._created_at));
      break;
    case 'most_cooked':
      rows.sort((a, b) => {
        const cmp = b.cooked_count - a.cooked_count;
        if (cmp !== 0) return cmp;
        return b.recipe_count - a.recipe_count;
      });
      break;
  }
}

// ── Chefs index ─────────────────────────────────────────────────────

interface ChefIndexRow {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  created_at: string;
}

interface SortableChef extends ChefWithStats {
  _created_at: string;
}

interface ChefAggregate {
  recipeIds: string[];
  bookIds: Set<string>;
}

/**
 * Build the per-chef aggregate (recipe set + book set) from the user's
 * recipes. Shared by `getChefsForIndex` and `searchChefs`.
 */
async function getChefAggregatesForUser(
  userId: string,
): Promise<Map<string, ChefAggregate>> {
  const { data: userRecipes, error } = await supabase
    .from('recipes')
    .select('id, chef_id, book_id')
    .eq('user_id', userId)
    .not('chef_id', 'is', null);
  if (error) throw error;

  const map = new Map<string, ChefAggregate>();
  for (const r of userRecipes ?? []) {
    if (!r.chef_id) continue;
    let agg = map.get(r.chef_id);
    if (!agg) {
      agg = { recipeIds: [], bookIds: new Set<string>() };
      map.set(r.chef_id, agg);
    }
    agg.recipeIds.push(r.id);
    if (r.book_id) agg.bookIds.add(r.book_id);
  }
  return map;
}

function buildChefRows(
  chefs: ChefIndexRow[],
  aggregates: Map<string, ChefAggregate>,
  history: Map<string, { times_cooked: number }>,
): SortableChef[] {
  return chefs.map((c) => {
    const agg = aggregates.get(c.id) ?? { recipeIds: [], bookIds: new Set<string>() };
    const cooked = agg.recipeIds.filter((id) => (history.get(id)?.times_cooked ?? 0) > 0).length;
    return {
      id: c.id,
      name: c.name,
      first_name: c.first_name,
      last_name: c.last_name,
      image_url: c.image_url,
      recipe_count: agg.recipeIds.length,
      cooked_count: cooked,
      book_count: agg.bookIds.size,
      _created_at: c.created_at,
    };
  });
}

function sortChefRows(rows: SortableChef[], sort: ChefSortOption): void {
  switch (sort) {
    case 'name':
      rows.sort((a, b) => {
        const cmpLast = nullsLast(a.last_name).localeCompare(nullsLast(b.last_name));
        if (cmpLast !== 0) return cmpLast;
        const cmpFirst = nullsLast(a.first_name).localeCompare(nullsLast(b.first_name));
        if (cmpFirst !== 0) return cmpFirst;
        return a.name.localeCompare(b.name);
      });
      break;
    case 'recipes_desc':
      rows.sort((a, b) => {
        const cmp = b.recipe_count - a.recipe_count;
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      });
      break;
    case 'most_cooked':
      rows.sort((a, b) => {
        const cmp = b.cooked_count - a.cooked_count;
        return cmp !== 0 ? cmp : b.recipe_count - a.recipe_count;
      });
      break;
    case 'recently_added':
      rows.sort((a, b) => b._created_at.localeCompare(a._created_at));
      break;
  }
}

/**
 * Chefs index for the Phase 11D Chefs index screen (CP4).
 *
 * "Chefs in the user's library" = distinct `recipes.chef_id` for the user's
 * recipes. Returns each chef with `recipe_count`, `cooked_count`, and
 * `book_count` (distinct books in the user's library by this chef).
 *
 * Default sort is `last_name → first_name → name` (the name fallback handles
 * single-name display chefs like "Ottolenghi" where first/last aren't split).
 */
export async function getChefsForIndex(
  userId: string,
  sort: ChefSortOption = 'name',
): Promise<ChefWithStats[]> {
  try {
    const aggregates = await getChefAggregatesForUser(userId);
    if (aggregates.size === 0) return [];
    const chefIds = Array.from(aggregates.keys());

    const { data: chefsData, error: chefsError } = await supabase
      .from('chefs')
      .select('id, name, first_name, last_name, image_url, created_at')
      .in('id', chefIds);
    if (chefsError) throw chefsError;
    const chefs = (chefsData ?? []) as unknown as ChefIndexRow[];

    const history = await getCookingHistory(userId);
    const rows = buildChefRows(chefs, aggregates, history);
    sortChefRows(rows, sort);
    return rows.map(({ _created_at: _, ...rest }) => rest);
  } catch (error) {
    console.error('Error fetching chefs for index:', error);
    return [];
  }
}

/**
 * ILIKE search across `name`, `first_name`, `last_name` — same pattern as
 * `searchBooks` — but constrained to the user's library so the returned
 * stats are meaningful. Returns `ChefWithStats[]` (counts populated).
 */
export async function searchChefs(
  query: string,
  userId: string,
): Promise<ChefWithStats[]> {
  try {
    const aggregates = await getChefAggregatesForUser(userId);
    if (aggregates.size === 0) return [];
    const chefIds = Array.from(aggregates.keys());

    const trimmed = query.trim();
    if (trimmed.length === 0) return [];

    const { data: chefsData, error: chefsError } = await supabase
      .from('chefs')
      .select('id, name, first_name, last_name, image_url, created_at')
      .in('id', chefIds)
      .or(
        `name.ilike.%${trimmed}%,first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`,
      );
    if (chefsError) throw chefsError;
    const chefs = (chefsData ?? []) as unknown as ChefIndexRow[];

    const history = await getCookingHistory(userId);
    const rows = buildChefRows(chefs, aggregates, history);
    // Default to the canonical 'name' sort for search results.
    sortChefRows(rows, 'name');
    return rows.map(({ _created_at: _, ...rest }) => rest);
  } catch (error) {
    console.error('Error searching chefs:', error);
    return [];
  }
}