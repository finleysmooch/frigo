// ============================================
// FRIGO INGREDIENT PARSER WITH CONFIDENCE SCORING
// ============================================
// Version 2.2 - Features:
// - Parent-child ingredient hierarchy (generic "sugar" vs specific types)
// - OR pattern detection with equivalent vs primary logic
// - Tracks all OR patterns for future Option B migration
// - Smart fallback to generic ingredients
// - Flags new ingredients for database addition
// - Preserves original recipe text for display
// - Color variant detection (red/green = equivalent)

import { supabase } from './supabase';

// Types
interface ParsedIngredient {
  original_text: string;
  quantity_amount: number | null;
  quantity_unit: string | null;
  preparation: string | null;
  ingredient_name: string | null;
  confidence_scores: {
    quantity: number;
    unit: number;
    ingredient: number;
  };
}

interface MatchResult {
  ingredient_id: string | null;
  match_confidence: number;
  match_method: 'exact' | 'fuzzy' | 'partial' | 'manual' | 'none';
  match_notes: string | null;
  needs_review: boolean;
}

interface RecipeIngredientInsert {
  recipe_id: string;
  ingredient_id: string | null;
  original_text: string;
  quantity_amount: number | null;
  quantity_unit: string | null;
  preparation: string | null;
  sequence_order: number;
  match_confidence: number | null;
  match_method: string | null;
  match_notes: string | null;
  needs_review: boolean;
  optional_confidence?: number;
  substitute_confidence?: number;
}

interface AlternativeIngredient {
  recipe_ingredient_index: number;
  alternative_ingredient_id: string;
  is_equivalent: boolean;  // true = equal options, false = primary/secondary
}

// Common cooking units (expand as needed)
const UNITS = {
  volume: ['cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp', 
           'liter', 'liters', 'l', 'milliliter', 'milliliters', 'ml', 'gallon', 'gallons',
           'quart', 'quarts', 'pint', 'pints', 'fluid ounce', 'fluid ounces', 'fl oz'],
  weight: ['pound', 'pounds', 'lb', 'lbs', 'ounce', 'ounces', 'oz', 'gram', 'grams', 'g',
           'kilogram', 'kilograms', 'kg', 'milligram', 'milligrams', 'mg'],
  count: ['', 'piece', 'pieces', 'whole', 'each', 'clove', 'cloves', 'head', 'heads', 
          'bunch', 'bunches', 'sprig', 'sprigs', 'can', 'cans', 'package', 'packages',
          'box', 'boxes', 'bag', 'bags'],
  other: ['pinch', 'pinches', 'dash', 'dashes', 'handful', 'handfuls', 'to taste']
};

const ALL_UNITS = [...UNITS.volume, ...UNITS.weight, ...UNITS.count, ...UNITS.other];

// Preparation methods (expand as needed)
const PREPARATIONS = [
  'diced', 'chopped', 'minced', 'sliced', 'grated', 'shredded', 'crushed',
  'ground', 'whole', 'halved', 'quartered', 'julienned', 'cubed', 'mashed',
  'peeled', 'seeded', 'deveined', 'trimmed', 'torn', 'crumbled', 'melted',
  'softened', 'room temperature', 'cold', 'frozen', 'thawed', 'drained',
  'rinsed', 'dried', 'fresh', 'packed', 'lightly packed', 'firmly packed',
  'finely chopped', 'coarsely chopped', 'thinly sliced', 'thickly sliced'
];

// Track OR pattern decisions for future analysis
// This data will help us:
// 1. Learn which ingredients are truly equivalent vs primary/alternative
// 2. Understand regional/seasonal preferences
// 3. Build smarter matching rules (Option B migration)
// 4. Enable features like "you have green cabbage, skip buying red"
async function trackOrPattern(data: {
  original_text: string;
  option1_name: string;
  option1_ingredient_id: string | null;
  option1_found: boolean;
  option2_name: string;
  option2_ingredient_id: string | null;
  option2_found: boolean;
  detected_as_equivalent: boolean;
  primary_choice: string;
  parser_confidence: number;
  decision_reason: string;
  recipe_id?: string;
  recipe_title?: string;
}) {
  try {
    const { error } = await supabase
      .from('or_pattern_decisions')
      .insert([data]);
    
    if (error) {
      console.error('Failed to track OR pattern:', error);
    }
  } catch (err) {
    console.error('Error tracking OR pattern:', err);
  }
}

// Parse quantity from string
function parseQuantity(text: string): { amount: number | null; confidence: number } {
  // Handle fractions
  const fractionMap: { [key: string]: number } = {
    '½': 0.5, '1/2': 0.5, '⅓': 0.333, '1/3': 0.333, '⅔': 0.667, '2/3': 0.667,
    '¼': 0.25, '1/4': 0.25, '¾': 0.75, '3/4': 0.75, '⅛': 0.125, '1/8': 0.125,
    '⅜': 0.375, '3/8': 0.375, '⅝': 0.625, '5/8': 0.625, '⅞': 0.875, '7/8': 0.875
  };

  // Try to find number patterns
  const patterns = [
    /^(\d+\.?\d*)/,  // 1, 1.5, etc.
    /^(\d+)\s*-\s*(\d+)/, // ranges like "2-3"
    /^a\s+few/i, // "a few" = ~3
    /^a\s+couple/i, // "a couple" = 2
    /^one/i, // "one" = 1
    /^two/i, // "two" = 2
    /^three/i, // "three" = 3
  ];

  // Check for fractions first
  for (const [frac, value] of Object.entries(fractionMap)) {
    if (text.includes(frac)) {
      // Check for mixed numbers like "1 1/2"
      const mixedMatch = text.match(/(\d+)\s*[½⅓⅔¼¾⅛⅜⅝⅞]|(\d+)\s+\d+\/\d+/);
      if (mixedMatch) {
        const whole = parseInt(mixedMatch[1] || mixedMatch[2]);
        return { amount: whole + value, confidence: 0.95 };
      }
      return { amount: value, confidence: 0.95 };
    }
  }

  // Try numeric patterns
  const rangeMatch = text.match(/^(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const avg = (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2;
    return { amount: avg, confidence: 0.8 };
  }

  const numMatch = text.match(/^(\d+\.?\d*)/);
  if (numMatch) {
    return { amount: parseFloat(numMatch[1]), confidence: 1.0 };
  }

  // Try word patterns
  if (/^a\s+few/i.test(text)) return { amount: 3, confidence: 0.6 };
  if (/^a\s+couple/i.test(text)) return { amount: 2, confidence: 0.8 };
  if (/^one\s+/i.test(text)) return { amount: 1, confidence: 0.9 };
  if (/^two\s+/i.test(text)) return { amount: 2, confidence: 0.9 };
  if (/^three\s+/i.test(text)) return { amount: 3, confidence: 0.9 };

  return { amount: null, confidence: 0 };
}

// Parse unit from string
function parseUnit(text: string): { unit: string | null; confidence: number; remaining: string } {
  const lowerText = text.toLowerCase();
  
  // Find the longest matching unit
  let bestMatch = { unit: null as string | null, length: 0, confidence: 0 };
  
  for (const unit of ALL_UNITS) {
    if (unit === '') continue; // Skip empty unit
    
    const regex = new RegExp(`^${unit}\\s+|^${unit}$`, 'i');
    if (regex.test(lowerText)) {
      if (unit.length > bestMatch.length) {
        bestMatch = { 
          unit, 
          length: unit.length, 
          confidence: 1.0 
        };
      }
    }
  }

  if (bestMatch.unit) {
    const remaining = text.substring(bestMatch.length).trim();
    return { unit: bestMatch.unit, confidence: bestMatch.confidence, remaining };
  }

  // Check for abbreviated units
  const abbrMatch = lowerText.match(/^(tbsp?|tsp?|oz|lbs?|g|kg|ml|l)\s+/);
  if (abbrMatch) {
    const abbr = abbrMatch[1];
    const unitMap: { [key: string]: string } = {
      'tbsp': 'tablespoon', 'tbs': 'tablespoon', 'tb': 'tablespoon',
      'tsp': 'teaspoon', 'ts': 'teaspoon',
      'oz': 'ounce', 'lbs': 'pound', 'lb': 'pound',
      'g': 'gram', 'kg': 'kilogram', 'ml': 'milliliter', 'l': 'liter'
    };
    return { 
      unit: unitMap[abbr] || abbr, 
      confidence: 0.9,
      remaining: text.substring(abbrMatch[0].length).trim()
    };
  }

  return { unit: null, confidence: 0, remaining: text };
}

// Extract preparation methods
function extractPreparation(text: string): { preparation: string[]; cleaned: string } {
  const found: string[] = [];
  let cleaned = text;

  for (const prep of PREPARATIONS) {
    const regex = new RegExp(`\\b${prep}\\b`, 'gi');
    if (regex.test(text)) {
      found.push(prep);
      cleaned = cleaned.replace(regex, '').trim();
    }
  }

  // Clean up extra spaces and commas
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();

  return { preparation: found, cleaned };
}

// Main parser function
export function parseIngredientString(text: string): ParsedIngredient {
  let working = text.trim();
  
  // Remove parenthetical notes
  const notes = [];
  const parenMatch = working.match(/\([^)]+\)/g);
  if (parenMatch) {
    notes.push(...parenMatch);
    working = working.replace(/\([^)]+\)/g, '').trim();
  }

  // Parse quantity
  const { amount, confidence: qtyConfidence } = parseQuantity(working);
  if (amount !== null) {
    // Remove the quantity from the string
    working = working.replace(/^[\d\s.½⅓⅔¼¾⅛⅜⅝⅞\/\-]+/, '').trim();
  }

  // Parse unit
  const { unit, confidence: unitConfidence, remaining } = parseUnit(working);
  working = remaining;

  // Extract preparation
  const { preparation, cleaned } = extractPreparation(working);
  
  // What's left should be the ingredient name
  let ingredientName = cleaned;
  
  // Clean up common patterns
  ingredientName = ingredientName
    .replace(/^of\s+/, '') // Remove leading "of"
    .replace(/,\s*$/, '') // Remove trailing comma
    .trim();

  return {
    original_text: text,
    quantity_amount: amount,
    quantity_unit: unit,
    preparation: preparation.length > 0 ? preparation.join(', ') : null,
    ingredient_name: ingredientName || null,
    confidence_scores: {
      quantity: qtyConfidence,
      unit: unitConfidence,
      ingredient: ingredientName ? 0.5 : 0 // Base confidence, will be updated by matching
    }
  };
}

// Match parsed ingredient to database
export async function matchToDatabase(
  parsed: ParsedIngredient,
  availableIngredients?: any[],
  context?: { recipe_id?: string; recipe_title?: string }
): Promise<MatchResult> {
  
  // Get ingredients from DB if not provided - NOW INCLUDING base_ingredient_id
  if (!availableIngredients) {
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, plural_name, base_ingredient_id');
    
    if (error || !data) {
      return {
        ingredient_id: null,
        match_confidence: 0,
        match_method: 'none',
        match_notes: 'Failed to load ingredients from database',
        needs_review: true
      };
    }
    availableIngredients = data;
  }

  if (!parsed.ingredient_name) {
    return {
      ingredient_id: null,
      match_confidence: 0,
      match_method: 'none',
      match_notes: 'No ingredient name extracted from text',
      needs_review: true
    };
  }

  const searchTerm = parsed.ingredient_name.toLowerCase();
  
  // Check for "OR" patterns first
  const orPattern = /(.+?)\s+or\s+(.+)/i;
  const orMatch = parsed.ingredient_name.match(orPattern);
  
  if (orMatch) {
    // Handle "X or Y" ingredients
    let option1 = orMatch[1].trim();
    let option2 = orMatch[2].trim();
    
    // FIX: Check if option2 has multiple words and option1 is a single word/descriptor
    // This catches patterns like "purple or green cabbage" → "purple cabbage" + "green cabbage"
    const option2Words = option2.split(' ');
    const option1Words = option1.split(' ');
    
    if (option1Words.length === 1 && option2Words.length > 1) {
      // option2 likely has the shared noun(s)
      // Get all words except the first (the descriptor/color)
      const sharedWords = option2Words.slice(1).join(' ');
      option1 = `${option1} ${sharedWords}`;
    }
    
    // Analyze the pattern BEFORE looking for matches
    let isEquivalent = false;
    let decisionReason = '';
    let confidence = 0;
    
    // Check for color variants (usually equivalent)
    const colors = ['red', 'green', 'yellow', 'white', 'purple', 'orange', 'brown', 'black'];
    const hasColor1 = colors.some(c => option1.toLowerCase().includes(c));
    const hasColor2 = colors.some(c => option2.toLowerCase().includes(c));
    
    if (hasColor1 && hasColor2) {
      // Remove colors and check if base ingredient is same
      const base1 = option1.toLowerCase().replace(new RegExp(colors.join('|'), 'g'), '').trim();
      const base2 = option2.toLowerCase().replace(new RegExp(colors.join('|'), 'g'), '').trim();
      
      if (base1 === base2) {
        isEquivalent = true;
        decisionReason = 'Color variants of same ingredient';
        confidence = 0.95;
      }
    }
    
    // Now try to find the ingredients
    const match1 = availableIngredients?.find(
      (ing: any) => ing.name?.toLowerCase() === option1.toLowerCase() || 
                    ing.plural_name?.toLowerCase() === option1.toLowerCase()
    );
    
    const match2 = availableIngredients?.find(
      (ing: any) => ing.name?.toLowerCase() === option2.toLowerCase() || 
                    ing.plural_name?.toLowerCase() === option2.toLowerCase()
    );
    
    // If color variants, also try to find the base ingredient
    let baseMatch = null;
    if (isEquivalent && (!match1 || !match2)) {
      const baseName = option1.toLowerCase().replace(new RegExp(colors.join('|'), 'g'), '').trim();
      baseMatch = availableIngredients?.find(
        (ing: any) => ing.name?.toLowerCase() === baseName || 
                      ing.plural_name?.toLowerCase() === baseName
      );
    }
    
    // Determine if there's a natural primary (more common ingredient)
    const commonIngredients = ['jalapeño', 'jalapeños', 'butter', 'milk', 'sugar'];
    const isPrimary1 = match1 && commonIngredients.some(c => match1.name.toLowerCase().includes(c));
    const isPrimary2 = match2 && commonIngredients.some(c => match2.name.toLowerCase().includes(c));
    
    // If not already determined as equivalent, check for primary/alternative
    if (!isEquivalent && (match1 || match2)) {
      if (isPrimary1 && !isPrimary2) {
        decisionReason = `${match1.name} is more commonly used`;
        confidence = 0.85;
      } else if (isPrimary2 && !isPrimary1) {
        decisionReason = `${match2.name} is more commonly used`;
        confidence = 0.85;
      } else {
        isEquivalent = true;
        decisionReason = 'No clear primary, treating as equivalent options';
        confidence = 0.7;
      }
    }
    
    // Track this decision for future analysis
    if (typeof window === 'undefined') {
      // Only track when running on server/migration (not in browser)
      const primary = isPrimary1 && !isPrimary2 ? match1 : 
                     isPrimary2 && !isPrimary1 ? match2 : 
                     match1 || match2 || baseMatch;
                     
      trackOrPattern({
        recipe_id: context?.recipe_id,
        recipe_title: context?.recipe_title,
        original_text: parsed.original_text,
        option1_name: option1,
        option1_ingredient_id: match1?.id || null,
        option1_found: !!match1,
        option2_name: option2,
        option2_ingredient_id: match2?.id || null,
        option2_found: !!match2,
        detected_as_equivalent: isEquivalent,
        primary_choice: primary?.name || (baseMatch?.name || 'none'),
        parser_confidence: confidence,
        decision_reason: decisionReason
      }).catch(err => console.log('Failed to track OR pattern:', err));
    }
    
    if ((match1 && match2) || (isEquivalent && baseMatch)) {
      // Both found OR it's color variants with base ingredient
      const finalPrimary = match1 || match2 || baseMatch;
      const alternative = match1 && match2 ? (finalPrimary === match1 ? match2 : match1) : null;
      
      return {
        ingredient_id: finalPrimary!.id,
        match_confidence: confidence,
        match_method: 'fuzzy',
        match_notes: `OR pattern: "${option1}" or "${option2}". ${decisionReason}. ${isEquivalent ? 'Equivalent options' : `Primary: ${finalPrimary!.name}`}${alternative ? `. Alternative: ${alternative.name}` : ''}`,
        needs_review: false
      };
    } else if (match1 || match2) {
      // Only one found
      const found = match1 || match2;
      const missing = match1 ? option2 : option1;
      return {
        ingredient_id: found!.id,
        match_confidence: 0.7,
        match_method: 'partial',
        match_notes: `OR pattern: Only found "${found!.name}", missing "${missing}"${isEquivalent ? ' (color variant)' : ''}`,
        needs_review: true
      };
    } else {
      // Neither found
      return {
        ingredient_id: baseMatch?.id || null,
        match_confidence: baseMatch ? 0.6 : 0,
        match_method: baseMatch ? 'fuzzy' : 'none',
        match_notes: `OR pattern: Neither "${option1}" nor "${option2}" found in database${baseMatch ? `, using base "${baseMatch.name}"` : ''}`,
        needs_review: true
      };
    }
  }
  
  // Try exact match
  const exactMatch = availableIngredients?.find(
    (ing: any) => ing.name?.toLowerCase() === searchTerm || 
                  ing.plural_name?.toLowerCase() === searchTerm
  );
  
  if (exactMatch) {
    return {
      ingredient_id: exactMatch.id,
      match_confidence: 1.0,
      match_method: 'exact',
      match_notes: null,
      needs_review: false
    };
  }

  // Try removing common descriptors
  const descriptors = ['fresh', 'dried', 'canned', 'frozen', 'organic', 'large', 'small', 
                      'medium', 'extra-virgin', 'virgin', 'light', 'dark', 'white', 'brown',
                      'red', 'yellow', 'green', 'ripe', 'unripe', 'raw', 'cooked'];
  
  let simplified = searchTerm;
  for (const desc of descriptors) {
    simplified = simplified.replace(new RegExp(`\\b${desc}\\s+`, 'g'), '');
  }
  simplified = simplified.trim();

  // Try match with simplified version
  const simplifiedMatch = availableIngredients?.find(
    (ing: any) => ing.name?.toLowerCase() === simplified || 
                  ing.plural_name?.toLowerCase() === simplified
  );
  
  if (simplifiedMatch) {
    return {
      ingredient_id: simplifiedMatch.id,
      match_confidence: 0.8,
      match_method: 'fuzzy',
      match_notes: `Matched "${parsed.ingredient_name}" to "${simplifiedMatch.name}" after removing descriptors`,
      needs_review: true
    };
  }

  // Try partial match (ingredient name contains our term or vice versa)
  const partialMatches = availableIngredients?.filter((ing: any) => {
    const ingName = ing.name?.toLowerCase() || '';
    const ingPlural = ing.plural_name?.toLowerCase() || '';
    return ingName.includes(simplified) || simplified.includes(ingName) ||
           ingPlural.includes(simplified) || simplified.includes(ingPlural);
  }) || [];

  if (partialMatches.length === 1) {
    return {
      ingredient_id: partialMatches[0].id,
      match_confidence: 0.6,
      match_method: 'partial',
      match_notes: `Partial match: "${parsed.ingredient_name}" → "${partialMatches[0].name}"`,
      needs_review: true
    };
  } else if (partialMatches.length > 1) {
    // Check if any matches are generic parents (no base_ingredient_id)
    const genericParent = partialMatches.find(m => !m.base_ingredient_id);
    if (genericParent) {
      return {
        ingredient_id: genericParent.id,
        match_confidence: 0.7,
        match_method: 'fuzzy',
        match_notes: `Matched to generic "${genericParent.name}" (multiple specific types available)`,
        needs_review: false
      };
    }
    
    const matchNames = partialMatches.slice(0, 3).map(m => m.name).join(', ');
    return {
      ingredient_id: null,
      match_confidence: 0.3,
      match_method: 'none',
      match_notes: `Multiple possible matches: ${matchNames}`,
      needs_review: true
    };
  }

  // Last resort: Check if this might be a specific type of a generic ingredient
  // e.g., "whole wheat flour" might match to generic "flour"
  const words = simplified.split(' ');
  const lastWord = words[words.length - 1];
  
  const genericMatch = availableIngredients?.find((ing: any) => 
    !ing.base_ingredient_id && // It's a parent
    (ing.name?.toLowerCase() === lastWord || ing.plural_name?.toLowerCase() === lastWord)
  );
  
  if (genericMatch) {
    return {
      ingredient_id: genericMatch.id,
      match_confidence: 0.5,
      match_method: 'partial',
      match_notes: `No exact match for "${parsed.ingredient_name}". Using generic "${genericMatch.name}". Consider adding "${parsed.ingredient_name}" to database.`,
      needs_review: true  // FLAG FOR REVIEW - potential new ingredient
    };
  }

  // No match found
  return {
    ingredient_id: null,
    match_confidence: 0,
    match_method: 'none',
    match_notes: `No match found for "${parsed.ingredient_name}"`,
    needs_review: true
  };
}

// Process a full recipe
// IMPORTANT: Always display original_text to users in your UI, not the matched ingredient name
// This preserves the recipe author's exact wording including "or" options
export async function processRecipeIngredients(
  recipeId: string,
  ingredientStrings: string[],
  recipeTitle?: string
): Promise<{ 
  ingredients: RecipeIngredientInsert[], 
  alternatives: AlternativeIngredient[]
}> {
  
  // Load available ingredients once (including base_ingredient_id)
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name, plural_name, base_ingredient_id');

  const results: RecipeIngredientInsert[] = [];
  const alternatives: AlternativeIngredient[] = [];
  
  const context = { recipe_id: recipeId, recipe_title: recipeTitle };

  for (let i = 0; i < ingredientStrings.length; i++) {
    const parsed = parseIngredientString(ingredientStrings[i]);
    const match = await matchToDatabase(parsed, ingredients || [], context);

    // Check if match notes indicate alternatives
    if (match.match_notes?.includes('Alternative:')) {
      // Extract alternative info from notes
      const isEquivalent = match.match_notes.includes('Equivalent options');
      const altMatch = match.match_notes.match(/Alternative: (.+?)(?:\.|$)/);
      
      if (altMatch) {
        const altName = altMatch[1].trim();
        const altIngredient = ingredients?.find((ing: any) => ing.name === altName);
        if (altIngredient) {
          alternatives.push({
            recipe_ingredient_index: i,
            alternative_ingredient_id: altIngredient.id,
            is_equivalent: isEquivalent
          });
        }
      }
    }

    results.push({
      recipe_id: recipeId,
      ingredient_id: match.ingredient_id,
      original_text: ingredientStrings[i],
      quantity_amount: parsed.quantity_amount,
      quantity_unit: parsed.quantity_unit,
      preparation: parsed.preparation,
      sequence_order: i + 1,
      match_confidence: match.match_confidence,
      match_method: match.match_method,
      match_notes: match.match_notes,
      needs_review: match.needs_review,
      optional_confidence: 0.5, // Default, update based on recipe analysis
      substitute_confidence: 0.5 // Default, update based on ingredient type
    });
  }

  return { ingredients: results, alternatives };
}

// Example usage for testing
export async function testParser() {
  const testStrings = [
    "2 tablespoons extra-virgin olive oil",
    "1 pound boneless, skinless chicken thighs, cut into 1-inch pieces",
    "3 garlic cloves, minced",
    "1 (14.5 oz) can diced tomatoes",
    "Salt and pepper to taste",
    "2-3 cups baby spinach",
    "1/2 cup heavy cream",
    "A pinch of red pepper flakes",
    "One large onion, thinly sliced",
    "1½ cups basmati rice",
    "3 tablespoons sugar",  // Should match generic sugar
    "Fresno chiles or jalapeños",  // Should detect OR pattern with primary
    "red or green cabbage",  // Should detect OR pattern as equivalent
    "1 cup whole wheat flour",  // Should flag for adding to DB
    "1 cup all-purpose flour"  // Should match if exists
  ];

  console.log("Testing ingredient parser with hierarchy support:\n");
  
  const testContext = { recipe_id: 'test-recipe-id', recipe_title: 'Test Recipe' };
  
  for (const str of testStrings) {
    const parsed = parseIngredientString(str);
    console.log(`Original: "${str}"`);
    console.log(`Parsed:`, parsed);
    
    const match = await matchToDatabase(parsed, undefined, testContext);
    console.log(`Match:`, match);
    console.log('---');
  }
}

// Migration helper - run this for your existing recipes
export async function migrateExistingRecipes() {
  // Fetch recipes with JSON ingredients
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, title, ingredients');

  if (error || !recipes) {
    console.error('Failed to fetch recipes:', error);
    return;
  }

  for (const recipe of recipes) {
    if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
      continue;
    }

    console.log(`Processing recipe: ${recipe.title}`);
    const { ingredients: inserts, alternatives } = await processRecipeIngredients(
      recipe.id, 
      recipe.ingredients,
      recipe.title
    );
    
    // Insert into database
    const { error: insertError, data: insertedData } = await supabase
      .from('recipe_ingredients')
      .insert(inserts)
      .select();

    if (insertError) {
      console.error(`Failed to insert ingredients for ${recipe.title}:`, insertError);
    } else {
      console.log(`✓ Migrated ${inserts.length} ingredients for ${recipe.title}`);
      
      // Insert alternatives if any
      if (alternatives.length > 0 && insertedData) {
        const altInserts = alternatives.map(alt => ({
          recipe_ingredient_id: insertedData[alt.recipe_ingredient_index].id,
          alternative_ingredient_id: alt.alternative_ingredient_id,
          is_equivalent: alt.is_equivalent,
          preference_order: alt.is_equivalent ? 1 : 2  // 1 for equivalent, 2 for secondary
        }));
        
        const { error: altError } = await supabase
          .from('recipe_ingredient_alternatives')
          .insert(altInserts);
          
        if (!altError) {
          console.log(`  ✓ Added ${alternatives.length} alternatives`);
        }
      }
      
      // Log any that need review
      const needsReview = inserts.filter(i => i.needs_review);
      if (needsReview.length > 0) {
        console.log(`  ⚠ ${needsReview.length} ingredients need review`);
      }
    }
  }

  // Show summary
  const { data: summary } = await supabase
    .from('recipe_ingredients')
    .select('match_method')
    .not('match_method', 'is', null);

  if (summary) {
    const counts = summary.reduce((acc: any, curr: any) => {
      acc[curr.match_method] = (acc[curr.match_method] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nMigration Summary:');
    console.log(counts);
  }
}