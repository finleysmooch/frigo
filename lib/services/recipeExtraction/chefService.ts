// services/recipeExtraction/chefService.ts
// Handle chef lookup and creation from book authors
// UPDATED: Now stores website URL when creating from web recipes

import { supabase } from '../../supabase';

export interface Chef {
  id: string;
  name: string;
  bio?: string;
  image_url?: string;
  website?: string;  // ADDED
  created_at: string;
}

/**
 * Find chef by name (case-insensitive)
 */
export async function findChefByName(name: string): Promise<Chef | null> {
  if (!name || !name.trim()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('chefs')
      .select('*')
      .ilike('name', name.trim())
      .single();

    if (error || !data) {
      return null;
    }

    return data as Chef;
  } catch (error) {
    console.error('Error finding chef:', error);
    return null;
  }
}

/**
 * Create new chef record
 * UPDATED: Now accepts optional website URL
 */
export async function createChef(name: string, website?: string): Promise<Chef> {
  if (!name || !name.trim()) {
    throw new Error('Chef name is required');
  }

  console.log('👨‍🍳 Creating new chef:', name);
  if (website) {
    console.log('🌐 With website:', website);
  }

  try {
    const { data, error } = await supabase
      .from('chefs')
      .insert({
        name: name.trim(),
        website: website || null,  // ADDED
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Chef created:', data.id);
    return data as Chef;
  } catch (error) {
    console.error('Error creating chef:', error);
    throw new Error('Failed to create chef record');
  }
}

/**
 * Get or create chef by name
 * Returns existing chef if found, creates new one if not
 * UPDATED: Now accepts optional website URL
 */
export async function getOrCreateChef(
  name: string | null | undefined, 
  website?: string
): Promise<Chef | null> {
  if (!name || !name.trim()) {
    console.log('⚠️ No chef name provided');
    return null;
  }

  console.log('\n👨‍🍳 ===== CHEF LOOKUP =====');
  console.log('Chef name:', name);
  if (website) {
    console.log('Website:', website);
  }

  // Try to find existing chef
  let chef = await findChefByName(name);

  if (chef) {
    console.log('✅ Found existing chef:', chef.name, `(${chef.id})`);
    
    // ADDED: Update website if chef exists but doesn't have one
    if (website && !chef.website) {
      console.log('📝 Updating chef with website...');
      const { data, error } = await supabase
        .from('chefs')
        .update({ website })
        .eq('id', chef.id)
        .select()
        .single();
      
      if (!error && data) {
        chef = data as Chef;
        console.log('✅ Chef website updated');
      }
    }
  } else {
    // Create new chef
    console.log('📝 Chef not found, creating new chef...');
    chef = await createChef(name, website);
    console.log('✅ New chef created:', chef.name, `(${chef.id})`);
  }

  console.log('===== END CHEF LOOKUP =====\n');

  return chef;
}

/**
 * Get chef from book author
 * If book has an author, find or create a chef with that name
 */
export async function getChefFromBookAuthor(
  bookAuthor: string | null | undefined,
  website?: string  // ADDED
): Promise<string | null> {
  if (!bookAuthor) {
    return null;
  }

  const chef = await getOrCreateChef(bookAuthor, website);
  return chef?.id || null;
}

/**
 * Extract domain from URL for website field
 * Example: "https://www.ambitiouskitchen.com/recipe" -> "https://ambitiouskitchen.com"
 */
export function extractWebsiteFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    return `https://${hostname}`;
  } catch {
    return url;
  }
}

/**
 * Phase 7K: One-time backfill of chef_id on recipes that were extracted
 * before the chef service was wired. Processes in batches of 50.
 *
 * Join path: recipes.book_id -> books.id, then use books.chef_id or
 * books.author to find or create the chef.
 */
export async function backfillChefIds(): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;
  const BATCH_SIZE = 50;
  let offset = 0;
  let hasMore = true;

  console.warn('[backfillChefIds] starting backfill...');

  while (hasMore) {
    const { data: recipes, error: fetchError } = await supabase
      .from('recipes')
      .select('id, book_id, books(id, chef_id, author)')
      .is('chef_id', null)
      .not('book_id', 'is', null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchError) {
      console.warn('[backfillChefIds] fetch error:', fetchError);
      errors++;
      break;
    }

    if (!recipes || recipes.length === 0) {
      hasMore = false;
      break;
    }

    for (const recipe of recipes) {
      try {
        const book = Array.isArray(recipe.books)
          ? recipe.books[0]
          : recipe.books;

        if (!book) continue;

        let chefId: string | null = null;

        if (book.chef_id) {
          // Book already has a chef_id — use it directly
          chefId = book.chef_id;
        } else if (book.author) {
          // Book has an author name — find or create the chef
          const chef = await getOrCreateChef(book.author);
          if (chef) {
            chefId = chef.id;
            // Also set chef_id on the book
            await supabase
              .from('books')
              .update({ chef_id: chef.id })
              .eq('id', book.id);
          }
        } else {
          // No chef_id and no author — skip
          continue;
        }

        if (chefId) {
          const { error: updateError } = await supabase
            .from('recipes')
            .update({ chef_id: chefId })
            .eq('id', recipe.id);

          if (updateError) {
            console.warn(`[backfillChefIds] update error for recipe ${recipe.id}:`, updateError);
            errors++;
          } else {
            updated++;
          }
        }
      } catch (err) {
        console.warn(`[backfillChefIds] error processing recipe ${recipe.id}:`, err);
        errors++;
      }
    }

    if ((offset + BATCH_SIZE) % 50 === 0 || recipes.length < BATCH_SIZE) {
      console.warn(`[backfillChefIds] progress: ${updated} updated, ${errors} errors, ${offset + recipes.length} processed`);
    }

    if (recipes.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      offset += BATCH_SIZE;
    }
  }

  console.warn(`[backfillChefIds] complete: ${updated} updated, ${errors} errors`);
  return { updated, errors };
}