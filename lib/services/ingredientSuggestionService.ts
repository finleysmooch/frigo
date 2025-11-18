// lib/services/ingredientSuggestionService.ts
// AI-powered ingredient metadata suggestions using Claude

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '@env';
import { StorageLocation } from '../types/pantry';

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export interface IngredientSuggestion {
  name: string;
  plural_name: string;
  family: string; // 'produce', 'dairy', 'meat', 'pantry', 'seafood', 'bakery', etc.
  ingredient_type: string; // 'vegetable', 'fruit', 'spice', 'herb', 'condiment', etc.
  ingredient_subtype: string | null; // 'leafy green', 'root vegetable', 'citrus', etc.
  typical_unit: string; // 'cup', 'tablespoon', 'whole', 'ounce', etc.
  typical_store_section: string; // 'Produce', 'Dairy', 'Meat', 'Spices', etc.
  default_storage_location: StorageLocation;
  shelf_life_days_fridge: number | null;
  shelf_life_days_freezer: number | null;
  shelf_life_days_pantry: number | null;
  shelf_life_days_counter: number | null;
  shelf_life_days_fridge_opened: number | null;
  shelf_life_days_pantry_opened: number | null;
  is_staple: boolean; // Common household ingredient?
  form: string | null; // 'fresh', 'dried', 'canned', 'frozen', etc.
  confidence: number; // 0-100 confidence score
  reasoning: string; // Why these suggestions
}

const SUGGESTION_PROMPT = `You are an expert in food ingredients, grocery shopping, and food storage. Suggest comprehensive metadata for ingredients.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations
2. Be realistic about shelf life (days, not years)
3. Consider the FORM of the ingredient (fresh vs dried changes everything)
4. typical_unit should be the most common measurement for recipes
5. Use standard American grocery store sections
6. Be conservative with is_staple (only truly common ingredients)

FAMILY OPTIONS:
- produce (fruits, vegetables, herbs)
- dairy (milk, cheese, yogurt, butter)
- meat (beef, pork, chicken, lamb)
- seafood (fish, shellfish)
- pantry (grains, pasta, oils, canned goods, baking supplies)
- bakery (bread, tortillas)
- deli (prepared meats, cheeses)
- frozen (frozen vegetables, meals)
- beverages (drinks, not cooking ingredients)
- other

STORAGE LOCATIONS (default_storage_location):
- fridge
- freezer
- pantry
- counter

SHELF LIFE GUIDELINES:
Fresh produce (fridge): 3-14 days
Fresh meat (fridge): 1-3 days
Fresh dairy (fridge): 5-14 days
Dried goods (pantry): 180-730 days
Canned goods (pantry): 365-1095 days
Frozen items (freezer): 90-365 days
Spices (pantry): 365-1095 days

Opened items typically last 50-70% as long as unopened.

For each ingredient, suggest ALL fields. Be thorough and accurate.

INPUT: {INGREDIENTS}

RETURN THIS EXACT JSON STRUCTURE (array of suggestions):
[
  {
    "name": "string (singular form)",
    "plural_name": "string",
    "family": "string (from options above)",
    "ingredient_type": "string (vegetable, fruit, spice, etc.)",
    "ingredient_subtype": "string or null (more specific category)",
    "typical_unit": "string (cup, tablespoon, whole, etc.)",
    "typical_store_section": "string (Produce, Dairy, etc.)",
    "default_storage_location": "fridge | freezer | pantry | counter",
    "shelf_life_days_fridge": number or null,
    "shelf_life_days_freezer": number or null,
    "shelf_life_days_pantry": number or null,
    "shelf_life_days_counter": number or null,
    "shelf_life_days_fridge_opened": number or null,
    "shelf_life_days_pantry_opened": number or null,
    "is_staple": boolean,
    "form": "string or null (fresh, dried, canned, frozen)",
    "confidence": number (0-100),
    "reasoning": "string (brief explanation of suggestions)"
  }
]`;

/**
 * Get AI suggestions for missing ingredients
 * Uses Claude Haiku for cost-effective suggestions
 */
export async function suggestIngredientMetadata(
  ingredientNames: string[]
): Promise<IngredientSuggestion[]> {
  try {
    console.log(`🤖 Getting AI suggestions for ${ingredientNames.length} ingredients...`);
    const startTime = Date.now();

    const prompt = SUGGESTION_PROMPT.replace(
      '{INGREDIENTS}',
      JSON.stringify(ingredientNames, null, 2)
    );

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514', // Cheap model for suggestions
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Suggestion processing time: ${processingTime}ms`);

    // Extract text content
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let responseText = content.text;

    // Remove markdown code blocks if present
    responseText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse JSON
    const suggestions: IngredientSuggestion[] = JSON.parse(responseText);

    console.log(`✅ Generated ${suggestions.length} ingredient suggestions`);

    return suggestions;

  } catch (error: any) {
    console.error('❌ Error generating ingredient suggestions:', error);
    
    // Fallback: Generate basic suggestions without AI
    console.log('⚠️ Falling back to basic suggestions...');
    return ingredientNames.map(name => generateBasicSuggestion(name));
  }
}

/**
 * Fallback: Generate basic suggestion without AI
 */
function generateBasicSuggestion(name: string): IngredientSuggestion {
  const lowerName = name.toLowerCase();
  
  // Try to guess family based on name
  let family = 'other';
  let ingredient_type = 'other';
  let storage: StorageLocation = 'pantry';
  
  if (lowerName.includes('milk') || lowerName.includes('cheese') || 
      lowerName.includes('yogurt') || lowerName.includes('butter') ||
      lowerName.includes('cream')) {
    family = 'dairy';
    ingredient_type = 'dairy';
    storage = 'fridge';
  } else if (lowerName.includes('chicken') || lowerName.includes('beef') || 
             lowerName.includes('pork') || lowerName.includes('turkey')) {
    family = 'meat';
    ingredient_type = 'meat';
    storage = 'fridge';
  } else if (lowerName.includes('fish') || lowerName.includes('shrimp') || 
             lowerName.includes('salmon')) {
    family = 'seafood';
    ingredient_type = 'seafood';
    storage = 'fridge';
  } else if (lowerName.includes('oil') || lowerName.includes('flour') || 
             lowerName.includes('sugar') || lowerName.includes('salt') ||
             lowerName.includes('pepper') || lowerName.includes('spice')) {
    family = 'pantry';
    ingredient_type = lowerName.includes('spice') ? 'spice' : 'pantry staple';
    storage = 'pantry';
  } else {
    // Default to produce
    family = 'produce';
    ingredient_type = 'produce';
    storage = 'fridge';
  }

  return {
    name: name,
    plural_name: makePlural(name),
    family,
    ingredient_type,
    ingredient_subtype: null,
    typical_unit: 'cup',
    typical_store_section: capitalizeFirst(family),
    default_storage_location: storage,
    shelf_life_days_fridge: storage === 'fridge' ? 7 : null,
    shelf_life_days_freezer: 180,
    shelf_life_days_pantry: storage === 'pantry' ? 365 : null,
    shelf_life_days_counter: null,
    shelf_life_days_fridge_opened: storage === 'fridge' ? 5 : null,
    shelf_life_days_pantry_opened: storage === 'pantry' ? 180 : null,
    is_staple: false,
    form: 'fresh',
    confidence: 30,
    reasoning: 'Basic suggestion (AI unavailable)',
  };
}

/**
 * Simple pluralization
 */
function makePlural(name: string): string {
  const lower = name.toLowerCase();
  
  if (lower.endsWith('s') || lower.endsWith('sh') || lower.endsWith('ch')) {
    return name + 'es';
  } else if (lower.endsWith('y') && !isVowel(lower[lower.length - 2])) {
    return name.slice(0, -1) + 'ies';
  } else {
    return name + 's';
  }
}

function isVowel(char: string): boolean {
  return ['a', 'e', 'i', 'o', 'u'].includes(char?.toLowerCase());
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Validate and sanitize ingredient suggestion before saving to DB
 */
export function validateIngredientSuggestion(
  suggestion: IngredientSuggestion
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!suggestion.name || suggestion.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!suggestion.family || suggestion.family.trim().length === 0) {
    errors.push('Family is required');
  }

  const validStorageLocations: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'counter'];
  if (suggestion.default_storage_location && 
      !validStorageLocations.includes(suggestion.default_storage_location)) {
    errors.push('Invalid storage location');
  }

  if (suggestion.confidence < 0 || suggestion.confidence > 100) {
    errors.push('Confidence must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}