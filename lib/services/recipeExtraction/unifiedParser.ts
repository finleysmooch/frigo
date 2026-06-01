// lib/services/recipeExtraction/unifiedParser.ts
// Unified parser for standardized recipe data
// Takes text from web scraper or image OCR and structures it for database
// UPDATED: Now preserves raw extraction data for future parsing

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '@env';
import { ExtractedRecipeData, SourceNote, SourceMetaInfo } from '../../types/recipeExtraction';
import { StandardizedRecipeData } from './webExtractor';
import { RECIPE_PARSE_MODEL } from './models';

type ParsedRecipeWithNotes = ExtractedRecipeData & {
  source_notes?: SourceNote[];
  source_notes_total?: number;
  source_meta?: SourceMetaInfo;
};

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

/**
 * Normalize a scraped image value into a single URL string.
 *
 * recipes.image_url is a plain text URL column, but schema.org / JSON-LD
 * sources vary wildly: some give a string, some an ImageObject, and NYT gives
 * an ARRAY of ImageObjects (different crops/sizes). Previously the raw value
 * was saved verbatim, so NYT recipes stored a stringified array blob and no
 * image rendered. This collapses all shapes to one URL.
 *
 * For arrays, prefer the largest image up to 2000px wide — good display
 * quality without pulling a multi-thousand-pixel original. Falls back to the
 * first available URL when widths aren't given.
 */
function normalizeImageUrl(value: any): string | undefined {
  if (!value) return undefined;

  const urlOf = (v: any): string | undefined => {
    if (typeof v === 'string') return v.trim() || undefined;
    if (v && typeof v === 'object') return (v.url || v.contentUrl || undefined);
    return undefined;
  };

  if (Array.isArray(value)) {
    const withUrl = value
      .map((v) => ({ url: urlOf(v), width: Number(v?.width) || 0 }))
      .filter((x) => x.url);
    if (withUrl.length === 0) return undefined;
    const capped = withUrl.filter((x) => x.width > 0 && x.width <= 2000);
    const pool = capped.length ? capped : withUrl;
    pool.sort((a, b) => b.width - a.width);
    return pool[0].url;
  }

  return urlOf(value);
}

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
9. ALWAYS extract the author if available

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
    "source_author": "string or null",
    "image_url": "string or null",
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
): Promise<ParsedRecipeWithNotes> {
  try {
    console.log('🤖 Parsing standardized recipe data...');
    const startTime = Date.now();

    // Prepare input data for Claude
    const inputData = JSON.stringify(standardizedData, null, 2);
    const userPrompt = PARSER_USER_PROMPT.replace('{INPUT_DATA}', inputData);

    // Use Claude Haiku for cheaper parsing
    const response = await anthropic.messages.create({
      model: RECIPE_PARSE_MODEL,
      // Bumped 3000 -> 8000 during the Haiku 3 -> Haiku 4.5 migration: the
      // newer model emits fuller structured recipe JSON, and 3000 truncated
      // longer recipes mid-object (JSON.parse "Unexpected end of input").
      // Billed on actual output, so headroom is free; Haiku 4.5 allows 64k.
      max_tokens: 8000,
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

    // Surface truncation as a clear signal rather than a cryptic JSON error.
    if (response.stop_reason === 'max_tokens') {
      console.warn('⚠️ Parser response hit max_tokens — JSON likely truncated. Consider raising max_tokens.');
    }

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

    // Validate we got required fields
    if (!parsedData.recipe || !parsedData.ingredients || !parsedData.instruction_sections) {
      throw new Error('Parsed data missing required fields');
    }

    console.log('✅ Parser validation passed');
    console.log(`📊 Parsed: ${parsedData.ingredients.length} ingredients, ${parsedData.instruction_sections.length} sections`);

    // FIXED: Force preserve author from source (Claude often misses it).
    // Prefer the ORIGINAL author the recipe is "from" (NYT sourcesString, e.g.
    // "Yotam Ottolenghi") over the page byline/adapter (e.g. "Sam Sifton"),
    // so chef attribution credits the creator, not the NYT editor.
    // Use the PRIMARY original author (authors[0]) for chef attribution — not
    // the raw sourcesString, which may combine co-authors ("A and B") and would
    // otherwise create a single garbage chef. Co-authors are stored separately
    // (source_authors) for display.
    const primaryAuthor =
      standardizedData.sourceMeta?.authors?.[0] || standardizedData.sourceMeta?.originalAuthor;
    if (primaryAuthor) {
      parsedData.recipe.source_author = primaryAuthor;
      console.log('✅ Preserved primary author from sourceMeta:', primaryAuthor);
    } else if (standardizedData.source.author) {
      parsedData.recipe.source_author = standardizedData.source.author;
      console.log('✅ Preserved author from source:', standardizedData.source.author);
    } else if (standardizedData.rawText.author) {
      parsedData.recipe.source_author = standardizedData.rawText.author;
      console.log('✅ Preserved author from rawText:', standardizedData.rawText.author);
    }

    // FIXED: Force preserve image URL (Claude often misses it).
    // Normalize first — some sources (e.g. NYT) provide an array of image
    // objects, not a single URL string. Keep Claude's value if normalize fails.
    const normalizedImage = normalizeImageUrl(standardizedData.rawText.imageUrl);
    if (normalizedImage) {
      parsedData.recipe.image_url = normalizedImage;
      console.log('✅ Preserved image URL:', normalizedImage);
    }

    // FIXED: Force preserve description if available
    if (standardizedData.rawText.description && !parsedData.recipe.description) {
      parsedData.recipe.description = standardizedData.rawText.description;
      console.log('✅ Preserved description');
    }

    // ADD: Build raw extraction data blob for future parsing
    const rawExtractionData = {
      extraction_date: new Date().toISOString(),
      source_url: standardizedData.source.url,
      source_site: standardizedData.source.siteName,
      raw_data: {
        title: standardizedData.rawText.title,
        author: standardizedData.source.author,
        description: standardizedData.rawText.description,
        image_url: standardizedData.rawText.imageUrl,
        notes: standardizedData.rawText.notes,
        ingredient_swaps: standardizedData.rawText.ingredientSwaps,
        storage_notes: standardizedData.rawText.storageNotes,
        category: standardizedData.rawText.category,
        cuisine: standardizedData.rawText.cuisine,
        tags: standardizedData.rawText.tags,
        prep_time: standardizedData.rawText.prepTime,
        cook_time: standardizedData.rawText.cookTime,
        total_time: standardizedData.rawText.totalTime,
        servings: standardizedData.rawText.servings,
        yield_text: standardizedData.rawText.yieldText,
        ingredients: standardizedData.rawText.ingredients,
        instructions: standardizedData.rawText.instructions,
      },
      parsed_data: {
        recipe: parsedData.recipe,
        ingredients_count: parsedData.ingredients.length,
        instruction_sections_count: parsedData.instruction_sections.length,
        ai_difficulty: parsedData.ai_difficulty_assessment,
      },
    };

    // Add raw extraction data + carry source notes (NYT comments) through to
    // the saver. standardizedData.notes already matches the SourceNote shape.
    return {
      ...parsedData,
      raw_extraction_data: rawExtractionData,
      source_notes: standardizedData.notes,
      source_notes_total: standardizedData.notesTotal,
      source_meta: standardizedData.sourceMeta,
    };

  } catch (error: any) {
    console.error('❌ Parser error:', error);
    console.error('Error details:', error.message);
    throw new Error(`Failed to parse recipe: ${error.message}`);
  }
}