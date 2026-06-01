// lib/services/recipeExtraction/webExtractor.ts
// Web recipe extraction service
// Calls Supabase Edge Function to scrape recipe from URL
// UPDATED: Added image_url, notes, and ingredient_swaps fields
// Date: November 19, 2025

import { supabase } from '../../supabase';

export interface StandardizedRecipeData {
  source: {
    type: 'web';
    url: string;
    siteName: string;
    author?: string;
  };
  rawText: {
    title: string;
    author?: string;
    description?: string;
    imageUrl?: string; // NEW: Recipe main image
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: string;
    ingredients: string[];
    instructions: string[];
    notes?: string; // NEW: Recipe notes from website
    ingredientSwaps?: string; // NEW: Ingredient substitutions
    yieldText?: string;
    category?: string;
    cuisine?: string;
    tags?: string[];
    storageNotes?: string;
  };
  // Community notes/comments embedded in the source page (NYT Cooking).
  // Populated by the scrape-recipe edge function; empty for other sources.
  notes?: SourceNoteRaw[];
  notesTotal?: number;
  // Richer provenance from the source payload (NYT scoopRecipe).
  sourceMeta?: SourceMetaRaw;
}

/** Provenance fields from the scrape-recipe edge function (NYT scoopRecipe). */
export interface SourceMetaRaw {
  originalAuthor?: string | null;
  authors?: string[];
  byline?: string | null;
  credit?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

/** A community note as returned by the scrape-recipe edge function. */
export interface SourceNoteRaw {
  sourceNoteId: string;
  type: string;
  authorName?: string | null;
  authorExternalId?: string | null;
  message: string;
  parentSourceNoteId?: string | null;
  isRecommended: boolean;
  recommendationsCount: number;
  repliesCount: number;
  createdAt?: string | null;
}

/**
 * Extract recipe from URL using Supabase Edge Function
 * 
 * @param url - Recipe URL to scrape
 * @returns Standardized recipe data with all extracted fields
 */
export async function extractRecipeFromUrl(url: string): Promise<StandardizedRecipeData> {
  try {
    console.log('🌐 Extracting recipe from URL:', url);

    // Validate URL
    if (!isValidUrl(url)) {
      throw new Error('Invalid URL format');
    }

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('scrape-recipe', {
      body: { url },
    });

    if (error) {
      console.error('❌ Edge function error:', error);
      throw new Error(`Failed to scrape recipe: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from scraper');
    }

    // Validate we got required fields
    if (!data.rawText?.title) {
      throw new Error('Could not extract recipe title. This may not be a valid recipe page.');
    }

    if (data.rawText.ingredients.length === 0) {
      throw new Error('Could not extract ingredients. This may not be a valid recipe page.');
    }

    if (data.rawText.instructions.length === 0) {
      throw new Error('Could not extract instructions. This may not be a valid recipe page.');
    }

    console.log('✅ Recipe extracted successfully');
    console.log(`📝 Found ${data.rawText.ingredients.length} ingredients, ${data.rawText.instructions.length} steps`);
    console.log('📸 Image:', data.rawText.imageUrl ? 'YES' : 'NO');
    console.log('👨‍🍳 Author:', data.source.author || 'none');
    console.log('📋 Description:', data.rawText.description ? 'YES' : 'NO');
    console.log('📝 Notes:', data.rawText.notes ? 'YES' : 'NO');
    console.log('🔄 Ingredient Swaps:', data.rawText.ingredientSwaps ? 'YES' : 'NO');

    return data as StandardizedRecipeData;

  } catch (error: any) {
    console.error('❌ Web extraction failed:', error);
    throw error;
  }
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Test if a URL is likely a recipe page (pre-validation)
 * This is a LENIENT check - we prefer false positives over false negatives
 */
export function isLikelyRecipeUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;

  const lowerUrl = url.toLowerCase();
  
  // Hard blocks (definitely not recipes)
  const blockedPatterns = [
    'youtube.com',
    'youtu.be',
    'instagram.com',
    'tiktok.com',
    'pinterest.com',
    'google.com',
    'bing.com',
  ];

  for (const pattern of blockedPatterns) {
    if (lowerUrl.includes(pattern)) {
      return false;
    }
  }

  // If it has recipe indicators, it's probably a recipe
  const recipeIndicators = [
    '/recipe/', '/recipes/', 'recipe?', 'recipes?', '-recipe', 'recipe-',
    '/cook/', '/cooking/', '/food/', '/dish/', '/meal/',
  ];

  const hasIndicator = recipeIndicators.some(indicator => lowerUrl.includes(indicator));
  
  // CHANGED: Default to true if no clear blocker
  // We'd rather try to extract and fail than reject valid recipes
  return hasIndicator || !hasObviousNonRecipePattern(lowerUrl);
}

/**
 * Check if URL has patterns that clearly indicate it's not a recipe
 */
function hasObviousNonRecipePattern(url: string): boolean {
  const nonRecipePatterns = [
    '/category/',
    '/tag/',
    '/author/',
    '/search',
    '/about',
    '/contact',
    '/blog-post',
    '/article',
  ];

  return nonRecipePatterns.some(pattern => url.includes(pattern));
}

/**
 * Extract domain name from URL for display
 */
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Get a user-friendly site name
 */
export function getFriendlySiteName(url: string): string {
  const domain = getDomainFromUrl(url);
  
  // Convert to title case and remove TLD
  const name = domain
    .split('.')[0]
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  return name;
}