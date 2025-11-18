// services/recipeExtraction/bookService.ts
// Handle book lookup, creation, and ownership verification
// UPDATED: Better book detection, logging, and fallback handling

import { supabase } from '../../supabase';
import { Book, UserBook, ExtractedRecipeData } from '../../types/recipeExtraction';

/**
 * Find book by ISBN, or by title and author if ISBN not available
 */
export async function findBook(bookMetadata: ExtractedRecipeData['book_metadata']): Promise<Book | null> {
  if (!bookMetadata) {
    console.log('📚 No book metadata provided');
    return null;
  }

  console.log('🔍 Searching for book with metadata:', {
    title: bookMetadata.book_title,
    author: bookMetadata.author,
    isbn: bookMetadata.isbn,
    isbn13: bookMetadata.isbn13,
  });

  try {
    // Try ISBN13 first (most specific)
    if (bookMetadata.isbn13) {
      console.log('  Trying ISBN13:', bookMetadata.isbn13);
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('isbn13', bookMetadata.isbn13)
        .single();
      
      if (data && !error) {
        console.log('  ✅ Found by ISBN13:', data.title);
        return data as Book;
      }
    }

    // Try ISBN10
    if (bookMetadata.isbn) {
      console.log('  Trying ISBN10:', bookMetadata.isbn);
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('isbn', bookMetadata.isbn)
        .single();
      
      if (data && !error) {
        console.log('  ✅ Found by ISBN10:', data.title);
        return data as Book;
      }
    }

    // Try title + author match
    if (bookMetadata.book_title && bookMetadata.author) {
      console.log('  Trying title + author:', bookMetadata.book_title, 'by', bookMetadata.author);
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .ilike('title', `%${bookMetadata.book_title}%`)
        .ilike('author', `%${bookMetadata.author}%`)
        .limit(1)
        .single();
      
      if (data && !error) {
        console.log('  ✅ Found by title+author:', data.title);
        return data as Book;
      }
    }

    // Try just title (less precise, but better than nothing)
    // Use fuzzy matching to catch slight variations
    if (bookMetadata.book_title) {
      console.log('  Trying title only:', bookMetadata.book_title);
      
      // First try exact match (case-insensitive)
      const { data: exactMatch, error: exactError } = await supabase
        .from('books')
        .select('*')
        .ilike('title', bookMetadata.book_title)
        .limit(1)
        .single();
      
      if (exactMatch && !exactError) {
        console.log('  ✅ Found exact title match:', exactMatch.title);
        return exactMatch as Book;
      }
      
      // Then try partial match
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .ilike('title', `%${bookMetadata.book_title}%`)
        .limit(1)
        .single();
      
      if (data && !error) {
        console.log('  ⚠️ Found by title only (less certain):', data.title);
        return data as Book;
      }
    }

    console.log('  ❌ No book found');
    return null;
    
  } catch (error) {
    console.error('Error finding book:', error);
    return null;
  }
}

/**
 * Create new book record
 */
export async function createBook(
  bookMetadata: ExtractedRecipeData['book_metadata'],
  styleMetadata: ExtractedRecipeData['style_metadata'],
  coverImageUrl?: string
): Promise<Book> {
  if (!bookMetadata || !bookMetadata.book_title) {
    throw new Error('Book title is required to create a book');
  }

  console.log('📖 Creating new book:', bookMetadata.book_title);

  try {
    const { data, error } = await supabase
      .from('books')
      .insert({
        title: bookMetadata.book_title,
        author: bookMetadata.author || null,
        isbn: bookMetadata.isbn || null,
        isbn13: bookMetadata.isbn13 || null,
        cover_image_url: coverImageUrl || null,
        style_metadata: styleMetadata || null,
        is_verified: false,
        verification_source: 'user_submitted',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Book created successfully:', data.id);
    return data as Book;
    
  } catch (error) {
    console.error('Error creating book:', error);
    throw new Error('Failed to create book record');
  }
}

/**
 * Check if user has claimed ownership of a book
 */
export async function checkUserOwnership(userId: string, bookId: string): Promise<UserBook | null> {
  try {
    const { data, error } = await supabase
      .from('user_books')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single();

    if (error || !data) {
      console.log('  No ownership record found');
      return null;
    }

    console.log('  ✅ User already owns this book');
    return data as UserBook;
    
  } catch (error) {
    console.error('Error checking user ownership:', error);
    return null;
  }
}

/**
 * Create user book ownership record
 */
export async function createUserBookOwnership(
  userId: string,
  bookId: string,
  ownershipClaimed: boolean,
  proofImageUrl?: string
): Promise<UserBook> {
  try {
    const { data, error } = await supabase
      .from('user_books')
      .insert({
        user_id: userId,
        book_id: bookId,
        ownership_claimed: ownershipClaimed,
        ownership_proof_image_url: proofImageUrl || null,
        recipe_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as UserBook;
    
  } catch (error) {
    console.error('Error creating user book ownership:', error);
    throw new Error('Failed to create ownership record');
  }
}

/**
 * Upload book cover image to storage
 */
export async function uploadBookCover(
  bookId: string,
  imageUri: string
): Promise<string> {
  try {
    // Create unique filename
    const fileName = `${bookId}-cover-${Date.now()}.jpg`;
    const filePath = `book-covers/${fileName}`;

    // For React Native, we need to create FormData with the file URI
    const formData = new FormData();
    
    // Extract file extension from URI
    const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    
    // Create file object compatible with React Native
    const file: any = {
      uri: imageUri,
      name: fileName,
      type: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
    };
    
    formData.append('file', file);

    // Upload to Supabase Storage using FormData
    const { data, error } = await supabase.storage
      .from('recipe-images')
      .upload(filePath, formData, {
        contentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('recipe-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
    
  } catch (error) {
    console.error('Error uploading book cover:', error);
    throw new Error('Failed to upload book cover image');
  }
}

/**
 * Update book with cover image URL
 */
export async function updateBookCoverUrl(
  bookId: string,
  coverUrl: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('books')
      .update({ cover_image_url: coverUrl })
      .eq('id', bookId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error updating book cover URL:', error);
    throw new Error('Failed to update book cover');
  }
}

/**
 * Get or create book from extracted metadata
 * Returns { book, needsOwnershipVerification, shouldPromptForBook }
 * 
 * NEW: Added shouldPromptForBook flag for when no book is detected
 */
export async function getOrCreateBook(
  userId: string,
  extractedData: ExtractedRecipeData
): Promise<{ 
  book: Book | null; 
  needsOwnershipVerification: boolean;
  shouldPromptForBook: boolean; // NEW: Prompt user to select/add book manually
}> {
  console.log('\n📚 ===== BOOK DETECTION =====');
  console.log('Book metadata:', extractedData.book_metadata);

  // Check if we have ANY book information at all
  const hasBookInfo = extractedData.book_metadata && (
    extractedData.book_metadata.book_title ||
    extractedData.book_metadata.author ||
    extractedData.book_metadata.isbn ||
    extractedData.book_metadata.isbn13
  );

  // If NO book information detected, prompt user
  if (!hasBookInfo) {
    console.log('⚠️ No book information detected');
    console.log('👉 User should be prompted to select/add book manually');
    return { 
      book: null, 
      needsOwnershipVerification: false,
      shouldPromptForBook: true 
    };
  }

  // If we have partial book info (author but no title, for example)
  if (extractedData.book_metadata && !extractedData.book_metadata.book_title) {
    console.log('⚠️ Partial book information detected (no title)');
    console.log('Author:', extractedData.book_metadata.author);
    console.log('👉 User should be prompted to select/add book manually');
    return { 
      book: null, 
      needsOwnershipVerification: false,
      shouldPromptForBook: true 
    };
  }

  console.log('✅ Book information detected!');
  console.log('Title:', extractedData.book_metadata?.book_title);
  console.log('Author:', extractedData.book_metadata?.author);

  // Try to find existing book
  let book = await findBook(extractedData.book_metadata);

  // If book doesn't exist, create it
  if (!book) {
    console.log('📖 Creating new book...');
    book = await createBook(
      extractedData.book_metadata,
      extractedData.style_metadata
    );
    console.log('✅ New book created:', book.title);
  } else {
    console.log('✅ Found existing book:', book.title);
  }

  // Check if user has already claimed ownership
  const ownership = await checkUserOwnership(userId, book.id);

  // If no ownership record, they need to verify
  const needsOwnershipVerification = !ownership;

  if (needsOwnershipVerification) {
    console.log('🔐 User needs to verify ownership');
  } else {
    console.log('✅ User already owns this book');
  }

  console.log('===== END BOOK DETECTION =====\n');

  return {
    book,
    needsOwnershipVerification,
    shouldPromptForBook: false // We found a book, no need to prompt
  };
}

/**
 * NEW: Find books that might match based on style similarity
 * Useful for subsequent recipes from the same book
 */
export async function findSimilarBooks(
  userId: string,
  styleMetadata: ExtractedRecipeData['style_metadata']
): Promise<Book[]> {
  try {
    // Get all books the user has added recipes from
    const { data: userBooks } = await supabase
      .from('user_books')
      .select('book:books(*)')
      .eq('user_id', userId);

    if (!userBooks || userBooks.length === 0) {
      return [];
    }

    // For now, return all user's books
    // TODO: Implement style similarity matching using styleMetadata
    return userBooks.map((ub: any) => ub.book).filter(Boolean);
    
  } catch (error) {
    console.error('Error finding similar books:', error);
    return [];
  }
}

/**
 * Get all books for a user
 */
export async function getUserBooks(userId: string): Promise<(UserBook & { book: Book })[]> {
  try {
    const { data, error } = await supabase
      .from('user_books')
      .select(`
        *,
        book:books(*)
      `)
      .eq('user_id', userId)
      .order('added_date', { ascending: false });

    if (error) {
      throw error;
    }

    return data as (UserBook & { book: Book })[];
    
  } catch (error) {
    console.error('Error getting user books:', error);
    return [];
  }
}

/**
 * Get all recipes from a specific book
 */
export async function getBookRecipes(bookId: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('book_id', bookId)
      .eq('user_id', userId)
      .order('page_number', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
    
  } catch (error) {
    console.error('Error getting book recipes:', error);
    return [];
  }
}