// lib/services/recipeExtraction/webExtractor.ts
// Web recipe extraction service
// Calls Supabase Edge Function to scrape recipe from URL

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
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: string;
    ingredients: string[];
    instructions: string[];
    notes?: string;
    yieldText?: string;
    category?: string;
    cuisine?: string;
    tags?: string[];
    storageNotes?: string;
  };
}

/**
 * Extract recipe from URL using Supabase Edge Function
 * 
 * @param url - Recipe URL to scrape
 * @returns Standardized recipe data
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
 * This is a quick check before attempting full extraction
 */
export function isLikelyRecipeUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;

  const lowerUrl = url.toLowerCase();
  
  // Common recipe URL patterns
  const recipeIndicators = [
    '/recipe/',
    '/recipes/',
    'recipe?',
    'recipes?',
    '-recipe',
    'recipe-',
  ];

  return recipeIndicators.some(indicator => lowerUrl.includes(indicator));
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