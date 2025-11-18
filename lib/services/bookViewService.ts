// ============================================
// BOOK & AUTHOR VIEW SERVICE
// ============================================
// Organizes recipes by book and author/chef
// Provides views for browsing cookbook libraries
// FIXED: Added type annotation for implicit any parameter
// ============================================

import { supabase } from '../supabase';
import { Book, BookWithRecipeCount, AuthorWithBooks, RecipeWithBook, BookGroup, AuthorGroup } from '../types/recipeFeatures';

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
    let query = supabase
      .from('recipes_with_books')
      .select('*')
      .eq('book_id', bookId)
      .order('page_number', { ascending: true, nullsFirst: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
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