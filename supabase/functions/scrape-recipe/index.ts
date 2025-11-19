// @ts-nocheck
// Supabase Edge Function: scrape-recipe
// Deploy this to: supabase/functions/scrape-recipe/index.ts
// Deploy command: supabase functions deploy scrape-recipe
// UPDATED: Added text-based author, time, and description extraction
// Date: November 19, 2025

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"

// Types for our standardized format
interface StandardizedRecipeData {
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
    imageUrl?: string;
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: string;
    ingredients: string[];
    instructions: string[];
    notes?: string;
    ingredientSwaps?: string;
    yieldText?: string;
    category?: string;
    cuisine?: string;
    tags?: string[];
    storageNotes?: string;
  };
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      throw new Error('URL is required')
    }

    console.log(`🌐 Fetching recipe from: ${url}`)

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FrigoApp/1.0; +https://frigo.app)',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')

    if (!doc) {
      throw new Error('Failed to parse HTML')
    }

    // Extract recipe data using multiple strategies
    const recipeData = extractRecipeData(doc, url)

    console.log(`✅ Extracted recipe: ${recipeData.rawText.title}`)
    console.log(`📝 Found ${recipeData.rawText.ingredients.length} ingredients, ${recipeData.rawText.instructions.length} steps`)

    return new Response(
      JSON.stringify(recipeData),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('❌ Scraping error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to scrape recipe',
        details: error.toString()
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

/**
 * Extract recipe data from HTML document
 * Uses multiple strategies to maximize data extraction
 */
function extractRecipeData(doc: any, url: string): StandardizedRecipeData {
  // Try JSON-LD structured data first (most reliable)
  const jsonLdData = extractFromJsonLd(doc)
  
  // Try microdata/schema.org
  const schemaData = extractFromSchema(doc)
  
  // Fallback to heuristic extraction
  const heuristicData = extractFromHeuristics(doc)
  
  // NEW: Extract author from text patterns (more reliable than meta tags)
  const textAuthor = extractAuthorFromText(doc)
  
  // NEW: Extract times from visible text
  const textTimes = extractTimesFromText(doc)
  
  // NEW: Extract description from meta tags
  const description = extractDescription(doc, jsonLdData)
  
  // Extract image from Open Graph or other meta tags
  const imageUrl = extractImage(doc, jsonLdData, schemaData)
  
  // Extract recipe notes and swaps
  const notesData = extractNotesAndSwaps(doc)

  // Merge data (prioritize text patterns for author, then JSON-LD > Schema > Heuristics)
  const merged = mergeRecipeData(
    jsonLdData, 
    schemaData, 
    heuristicData, 
    imageUrl, 
    notesData,
    textAuthor,
    textTimes,
    description
  )

  // Get site name
  const siteName = extractSiteName(doc, url)

  return {
    source: {
      type: 'web',
      url,
      siteName,
      author: merged.author,
    },
    rawText: merged,
  }
}

/**
 * Extract from JSON-LD structured data
 */
function extractFromJsonLd(doc: any): any {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent)
      
      // Handle array of items
      const items = Array.isArray(data) ? data : [data]
      
      for (const item of items) {
        if (item['@type'] === 'Recipe' || item['@type']?.includes('Recipe')) {
          return {
            title: item.name || '',
            author: item.author?.name || item.author || '',
            description: item.description || '',
            imageUrl: item.image?.url || item.image || '',
            prepTime: item.prepTime || '',
            cookTime: item.cookTime || '',
            totalTime: item.totalTime || '',
            servings: item.recipeYield?.toString() || item.yield?.toString() || '',
            yieldText: item.recipeYield?.toString() || '',
            category: item.recipeCategory || '',
            cuisine: item.recipeCuisine || '',
            ingredients: Array.isArray(item.recipeIngredient) 
              ? item.recipeIngredient 
              : [],
            instructions: extractInstructionsFromJsonLd(item.recipeInstructions || []),
            tags: item.keywords ? 
              (Array.isArray(item.keywords) ? item.keywords : item.keywords.split(',').map((k: string) => k.trim())) 
              : [],
            notes: item.recipeNotes || item.notes || '',
          }
        }
      }
    } catch (e) {
      console.log('Failed to parse JSON-LD:', e)
    }
  }
  
  return {}
}

/**
 * Extract instructions from JSON-LD (handles various formats)
 */
function extractInstructionsFromJsonLd(instructions: any): string[] {
  if (!instructions) return []
  
  if (Array.isArray(instructions)) {
    return instructions.map((inst: any) => {
      if (typeof inst === 'string') return inst
      if (inst.text) return inst.text
      if (inst['@type'] === 'HowToStep' && inst.text) return inst.text
      return ''
    }).filter((text: string) => text.length > 0)
  }
  
  if (typeof instructions === 'string') {
    return [instructions]
  }
  
  return []
}

/**
 * Extract from Schema.org microdata
 */
function extractFromSchema(doc: any): any {
  const result: any = {}
  
  // Look for elements with itemprop attributes
  const title = doc.querySelector('[itemprop="name"]')
  if (title) result.title = title.textContent?.trim()
  
  const author = doc.querySelector('[itemprop="author"]')
  if (author) result.author = author.textContent?.trim()
  
  const description = doc.querySelector('[itemprop="description"]')
  if (description) result.description = description.textContent?.trim()
  
  const prepTime = doc.querySelector('[itemprop="prepTime"]')
  if (prepTime) result.prepTime = prepTime.getAttribute('content') || prepTime.textContent?.trim()
  
  const cookTime = doc.querySelector('[itemprop="cookTime"]')
  if (cookTime) result.cookTime = cookTime.getAttribute('content') || cookTime.textContent?.trim()
  
  const totalTime = doc.querySelector('[itemprop="totalTime"]')
  if (totalTime) result.totalTime = totalTime.getAttribute('content') || totalTime.textContent?.trim()
  
  // Ingredients
  const ingredients = doc.querySelectorAll('[itemprop="recipeIngredient"]')
  result.ingredients = Array.from(ingredients)
    .map((el: any) => el.textContent?.trim())
    .filter((text: string) => text)
  
  // Instructions
  const instructions = doc.querySelectorAll('[itemprop="recipeInstructions"]')
  result.instructions = Array.from(instructions)
    .map((el: any) => el.textContent?.trim())
    .filter((text: string) => text)
  
  return result
}

/**
 * Extract using heuristics (class names, common patterns)
 */
function extractFromHeuristics(doc: any): any {
  const result: any = {
    ingredients: [],
    instructions: [],
  }
  
  // Title - try common selectors
  const titleSelectors = [
    'h1.recipe-title',
    'h1[class*="recipe"]',
    'h1[class*="title"]',
    '.recipe-header h1',
    'h1',
  ]
  
  for (const selector of titleSelectors) {
    const element = doc.querySelector(selector)
    if (element && element.textContent?.trim()) {
      result.title = element.textContent.trim()
      break
    }
  }
  
  // Ingredients - look for lists with common class names
  const ingredientSelectors = [
    '.ingredients li',
    '[class*="ingredient"] li',
    '.recipe-ingredients li',
    'ul[class*="ingredient"] li',
  ]
  
  for (const selector of ingredientSelectors) {
    const elements = doc.querySelectorAll(selector)
    if (elements.length > 0) {
      result.ingredients = Array.from(elements)
        .map((el: any) => el.textContent?.trim())
        .filter((text: string) => text && text.length > 0)
      if (result.ingredients.length > 0) break
    }
  }
  
  // Instructions - look for ordered lists or steps
  const instructionSelectors = [
    '.instructions li',
    '[class*="instruction"] li',
    '.recipe-instructions li',
    'ol[class*="instruction"] li',
    '[class*="step"] li',
    '.steps li',
  ]
  
  for (const selector of instructionSelectors) {
    const elements = doc.querySelectorAll(selector)
    if (elements.length > 0) {
      result.instructions = Array.from(elements)
        .map((el: any) => el.textContent?.trim())
        .filter((text: string) => text && text.length > 0)
      if (result.instructions.length > 0) break
    }
  }
  
  return result
}

/**
 * NEW: Extract author from common patterns in page text
 */
function extractAuthorFromText(doc: any): string {
  // Look for "Recipe by:", "By:", "Author:" patterns
  const authorPatterns = [
    /Recipe by:\s*([^|<\n//]+)/i,
    /By:\s*([^|<\n//]+)/i,
    /Author:\s*([^|<\n//]+)/i,
    /Photography by.*Recipe by:\s*([^|<\n//]+)/i,
  ]
  
  const bodyText = doc.body?.textContent || ''
  
  for (const pattern of authorPatterns) {
    const match = bodyText.match(pattern)
    if (match && match[1]) {
      let author = match[1].trim()
      
      // NEW: Remove trailing " // [site name]" pattern
      author = author.replace(/\s*\/\/.*$/i, '').trim()
      
      // Filter out common non-author phrases
      if (author.length > 2 && author.length < 50 && !author.includes('http')) {
        console.log(`✅ Found author via text pattern: ${author}`)
        return author
      }
    }
  }
  
  return ''
}

/**
 * NEW: Extract times from visible text (15 MINS, 1 HOUR, etc.)
 */
function extractTimesFromText(doc: any): { prepTime: string; cookTime: string; totalTime: string } {
  const result = {
    prepTime: '',
    cookTime: '',
    totalTime: '',
  }
  
  // Look for time patterns in the page
  const timePatterns = {
    prep: /PREP\s*TIME[:\s]*(\d+\s*(?:MIN|HOUR|HR)S?)/i,
    cook: /COOK\s*TIME[:\s]*(\d+\s*(?:MIN|HOUR|HR)S?)/i,
    total: /TOTAL\s*TIME[:\s]*(\d+\s*(?:MIN|HOUR|HR)S?)/i,
  }
  
  const bodyText = doc.body?.textContent || ''
  
  for (const [key, pattern] of Object.entries(timePatterns)) {
    const match = bodyText.match(pattern)
    if (match && match[1]) {
      const timeStr = match[1].trim()
      console.log(`✅ Found ${key} time via text: ${timeStr}`)
      
      if (key === 'prep') result.prepTime = timeStr
      if (key === 'cook') result.cookTime = timeStr
      if (key === 'total') result.totalTime = timeStr
    }
  }
  
  return result
}

/**
 * NEW: Extract description from meta tags
 */
function extractDescription(doc: any, jsonLdData: any): string {
  // Try JSON-LD first
  if (jsonLdData.description) return jsonLdData.description
  
  // Try Open Graph description
  const ogDescription = doc.querySelector('meta[property="og:description"]')
  if (ogDescription) {
    const content = ogDescription.getAttribute('content')
    if (content && content.length > 10) return content
  }
  
  // Try Twitter description
  const twitterDescription = doc.querySelector('meta[name="twitter:description"]')
  if (twitterDescription) {
    const content = twitterDescription.getAttribute('content')
    if (content && content.length > 10) return content
  }
  
  // Try standard meta description
  const metaDescription = doc.querySelector('meta[name="description"]')
  if (metaDescription) {
    const content = metaDescription.getAttribute('content')
    if (content && content.length > 10) return content
  }
  
  return ''
}

/**
 * Extract recipe image from various sources
 */
function extractImage(doc: any, jsonLdData: any, schemaData: any): string {
  // Try JSON-LD image first
  if (jsonLdData.imageUrl) return jsonLdData.imageUrl
  
  // Try Schema.org image
  const schemaImage = doc.querySelector('[itemprop="image"]')
  if (schemaImage) {
    const src = schemaImage.getAttribute('src') || schemaImage.getAttribute('content')
    if (src) return src
  }
  
  // Try Open Graph image
  const ogImage = doc.querySelector('meta[property="og:image"]')
  if (ogImage) {
    const content = ogImage.getAttribute('content')
    if (content) return content
  }
  
  // Try Twitter card image
  const twitterImage = doc.querySelector('meta[name="twitter:image"]')
  if (twitterImage) {
    const content = twitterImage.getAttribute('content')
    if (content) return content
  }
  
  // Try common recipe image patterns
  const imageSelectors = [
    '.recipe-image img',
    '.recipe-header img',
    '[class*="recipe"][class*="image"] img',
    'article img',
  ]
  
  for (const selector of imageSelectors) {
    const img = doc.querySelector(selector)
    if (img) {
      const src = img.getAttribute('src')
      if (src && !src.includes('logo') && !src.includes('icon')) {
        return src
      }
    }
  }
  
  return ''
}

/**
 * Extract recipe notes and ingredient swaps
 */
function extractNotesAndSwaps(doc: any): { notes: string; swaps: string } {
  let notes = ''
  let swaps = ''
  
  // Common selectors for recipe notes
  const noteSelectors = [
    '[class*="recipe-notes"]',
    '[class*="recipeNotes"]',
    '[class*="notes"]',
    '[data-test*="notes"]',
    '.notes',
  ]
  
  for (const selector of noteSelectors) {
    const notesEl = doc.querySelector(selector)
    if (notesEl) {
      const text = notesEl.textContent?.trim()
      if (text && text.length > 10) {
        notes = text
        break
      }
    }
  }
  
  // Common selectors for ingredient swaps/substitutions
  const swapSelectors = [
    '[class*="substitution"]',
    '[class*="swap"]',
    '[class*="alternative"]',
    '.substitutions',
    '.swaps',
  ]
  
  for (const selector of swapSelectors) {
    const swapsEl = doc.querySelector(selector)
    if (swapsEl) {
      const text = swapsEl.textContent?.trim()
      if (text && text.length > 10) {
        swaps = text
        break
      }
    }
  }
  
  return { notes, swaps }
}

/**
 * Merge recipe data from multiple sources
 * UPDATED: Now accepts textAuthor, textTimes, and description for better accuracy
 */
function mergeRecipeData(
  jsonLd: any, 
  schema: any, 
  heuristic: any, 
  imageUrl: string,
  notesData: { notes: string; swaps: string },
  textAuthor: string,
  textTimes: any,
  description: string
): any {
  return {
    title: jsonLd.title || schema.title || heuristic.title || 'Untitled Recipe',
    author: textAuthor || jsonLd.author || schema.author || '',
    description: description || jsonLd.description || schema.description || '',
    imageUrl: imageUrl,
    prepTime: textTimes.prepTime || jsonLd.prepTime || schema.prepTime || '',
    cookTime: textTimes.cookTime || jsonLd.cookTime || schema.cookTime || '',
    totalTime: textTimes.totalTime || jsonLd.totalTime || schema.totalTime || '',
    servings: jsonLd.servings || schema.servings || '',
    yieldText: jsonLd.yieldText || '',
    category: jsonLd.category || '',
    cuisine: jsonLd.cuisine || '',
    ingredients: jsonLd.ingredients?.length > 0 
      ? jsonLd.ingredients 
      : schema.ingredients?.length > 0 
        ? schema.ingredients 
        : heuristic.ingredients || [],
    instructions: jsonLd.instructions?.length > 0 
      ? jsonLd.instructions 
      : schema.instructions?.length > 0 
        ? schema.instructions 
        : heuristic.instructions || [],
    tags: jsonLd.tags || [],
    notes: jsonLd.notes || notesData.notes || '',
    storageNotes: '',
    ingredientSwaps: notesData.swaps || '',
  }
}

/**
 * Extract site name from document
 */
function extractSiteName(doc: any, url: string): string {
  // Try og:site_name
  const ogSiteName = doc.querySelector('meta[property="og:site_name"]')
  if (ogSiteName) return ogSiteName.getAttribute('content') || ''
  
  // Try site title
  const title = doc.querySelector('title')
  if (title) {
    const titleText = title.textContent || ''
    // Extract site name from patterns like "Recipe Name - Site Name"
    const parts = titleText.split(/[-–|]/)
    if (parts.length > 1) {
      return parts[parts.length - 1].trim()
    }
  }
  
  // Fallback to domain name
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return 'Unknown Site'
  }
}