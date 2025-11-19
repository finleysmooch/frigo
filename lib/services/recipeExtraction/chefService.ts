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