// lib/services/recipeExtraction/unifiedParser.ts
// Unified parser for standardized recipe data
// Takes text from web scraper or image OCR and structures it for database

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '@env';
import { ExtractedRecipeData } from '../../types/recipeExtraction';
import { StandardizedRecipeData } from './webExtractor';

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// ============================================================================
// PARSER PROMPT
// ============================================================================

const PARSER_SYSTEM_PROMPT = `You are an expert recipe parser. You take semi-structured recipe data and convert it into a fully structured format.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. For quantities: extract as numbers (use decimals for fractions: 1/2 = 0.5, 1/4 = 0.25, 1/3 = 0.33, 2/3 = 0.67, 3/4 = 0.75)
3. For ingredient_name: extract just the base ingredient without quantities/prep
4. For preparation: extract terms like "chopped", "diced", "minced", "sliced"
5. Parse time strings into minutes (e.g., "1 hour 30 minutes" = 90, "30 mins" = 30)
6. For servings: extract the number only (e.g., "12 cups" = 12, "Serves 4-6" = 5)
7. Group instructions into logical sections with descriptive titles
8. If uncertain about any value, use null rather than guessing

FRACTION CONVERSIONS:
- ½, 1/2 → 0.5
- ⅓, 1/3 → 0.33
- ⅔, 2/3 → 0.67
- ¼, 1/4 → 0.25
- ¾, 3/4 → 0.75
- ⅛, 1/8 → 0.125`;

const PARSER_USER_PROMPT = `Parse this semi-structured recipe data into the full structured format.

INPUT DATA:
{INPUT_DATA}

PARSING INSTRUCTIONS:

**TIME PARSING:**
Convert time strings to minutes:
- "1 hour 30 minutes" → 90
- "30 mins" → 30
- "2 hours" → 120
- "PT1H30M" (ISO format) → 90
- "1h 15m" → 75

Separate into:
- **prep_time_min**: Hands-on prep (chopping, mixing) BEFORE heat
- **cook_time_min**: Active cooking time with heat
- **inactive_time_min**: Waiting time (marinating, rising, chilling)
- **total_time_min**: Sum of all times, or use provided total

**SERVINGS PARSING:**
Extract number from strings:
- "12 cups" → 12
- "Serves 4-6" → 5 (take middle)
- "Makes 24 cookies" → 24
- "4 servings" → 4

**INGREDIENT PARSING:**
For each ingredient string like "2 cups chopped fresh spinach":
- quantity_amount: 2
- quantity_unit: "cups"
- ingredient_name: "spinach"
- preparation: "chopped fresh"
- original_text: "2 cups chopped fresh spinach"

**INSTRUCTION SECTIONS:**
Group instructions into logical sections:
1. Look for natural breaks or phases in cooking
2. Create descriptive titles like "Prepare Beans", "Make Sauce", "Assemble and Bake"
3. Each section should have 1-8 steps
4. If recipe is simple (3-5 steps), create 1 section called "Prepare and Serve"

**DIFFICULTY ASSESSMENT:**
Assess difficulty based on:
- Ingredient count
- Step complexity
- Cooking techniques required
- Total time
- Special equipment needs

Score 0-100 and assign level:
- 0-30: easy
- 31-70: medium
- 71-100: hard

**RETURN THIS EXACT JSON STRUCTURE:**
{
  "recipe": {
    "title": "string",
    "description": "string or null",
    "servings": number or null,
    "prep_time_min": number or null,
    "cook_time_min": number or null,
    "inactive_time_min": number or null,
    "total_time_min": number or null,
    "cuisine_types": ["string"] or null,
    "meal_type": ["string"] or null,
    "dietary_tags": ["string"] or null,
    "cooking_methods": ["string"] or null
  },
  "ai_difficulty_assessment": {
    "difficulty_level": "easy" | "medium" | "hard",
    "difficulty_score": number (0-100),
    "factors": {
      "ingredient_count": number,
      "step_count": number,
      "advanced_techniques": ["string"],
      "total_time_min": number,
      "special_equipment": ["string"]
    },
    "reasoning": "string"
  },
  "ingredients": [
    {
      "original_text": "string",
      "quantity_amount": number or null,
      "quantity_unit": "string or null",
      "ingredient_name": "string",
      "preparation": "string or null",
      "sequence_order": number,
      "is_optional": boolean
    }
  ],
  "instruction_sections": [
    {
      "section_title": "string",
      "section_description": "string or null",
      "section_order": number,
      "estimated_time_min": number or null,
      "steps": [
        {
          "step_number": number,
          "instruction": "string",
          "is_optional": boolean,
          "is_time_sensitive": boolean
        }
      ]
    }
  ]
}`;

// ============================================================================
// PARSER FUNCTIONS
// ============================================================================

/**
 * Parse standardized recipe data into full structured format
 * Uses Claude Haiku (cheaper model) for text parsing
 */
export async function parseStandardizedRecipe(
  standardizedData: StandardizedRecipeData
): Promise<ExtractedRecipeData> {
  try {
    console.log('🤖 Parsing standardized recipe data...');
    const startTime = Date.now();

    // Prepare input data for Claude
    const inputData = JSON.stringify(standardizedData, null, 2);
    const userPrompt = PARSER_USER_PROMPT.replace('{INPUT_DATA}', inputData);

    // Use Claude Haiku for cheaper parsing
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514', // Much cheaper than Sonnet
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: PARSER_SYSTEM_PROMPT,
    });

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Parser processing time: ${processingTime}ms`);

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
    const parsedData: ExtractedRecipeData = JSON.parse(responseText);

    console.log('✅ Recipe parsed successfully');
    console.log(`📊 Parsed: ${parsedData.ingredients.length} ingredients, ${parsedData.instruction_sections?.length || 0} sections`);

    // Validate instruction sections exist
    if (!parsedData.instruction_sections || parsedData.instruction_sections.length === 0) {
      console.warn('⚠️ No instruction sections found, creating default section');
      parsedData.instruction_sections = [
        {
          section_title: 'Instructions',
          section_order: 1,
          steps: [],
        },
      ];
    }

    return parsedData;

  } catch (error: any) {
    console.error('❌ Error parsing recipe:', error);
    
    if (error.message?.includes('JSON')) {
      throw new Error('Failed to parse recipe data. The recipe format may be invalid.');
    }
    
    throw new Error(`Recipe parsing failed: ${error.message}`);
  }
}

/**
 * Helper: Parse time string to minutes
 * Useful for quick conversions without AI
 */
export function parseTimeToMinutes(timeString: string): number | null {
  if (!timeString) return null;

  const lower = timeString.toLowerCase().trim();

  // Handle ISO duration format (PT1H30M)
  if (lower.startsWith('pt')) {
    const hours = lower.match(/(\d+)h/);
    const minutes = lower.match(/(\d+)m/);
    return (hours ? parseInt(hours[1]) * 60 : 0) + (minutes ? parseInt(minutes[1]) : 0);
  }

  // Handle common formats
  let total = 0;

  // Hours
  const hoursMatch = lower.match(/(\d+)\s*(hour|hr|h)/);
  if (hoursMatch) {
    total += parseInt(hoursMatch[1]) * 60;
  }

  // Minutes
  const minutesMatch = lower.match(/(\d+)\s*(minute|min|m)/);
  if (minutesMatch) {
    total += parseInt(minutesMatch[1]);
  }

  // If no units found, assume minutes
  if (total === 0) {
    const numberMatch = lower.match(/(\d+)/);
    if (numberMatch) {
      total = parseInt(numberMatch[1]);
    }
  }

  return total > 0 ? total : null;
}

/**
 * Helper: Parse servings from string
 */
export function parseServings(servingsString: string): number | null {
  if (!servingsString) return null;

  const lower = servingsString.toLowerCase().trim();

  // Handle ranges (e.g., "4-6 servings") - take middle
  const rangeMatch = lower.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    return Math.round((start + end) / 2);
  }

  // Extract first number found
  const numberMatch = lower.match(/(\d+)/);
  if (numberMatch) {
    return parseInt(numberMatch[1]);
  }

  return null;
}