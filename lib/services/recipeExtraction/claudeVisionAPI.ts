// services/recipeExtraction/claudeVisionAPI.ts
// Claude Vision API integration for recipe extraction
// UPDATED: Now generates instruction sections instead of flat arrays
// FIXED: Removed backticks from prompt examples (was causing syntax error)

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '@env';
import { ExtractedRecipeData } from '../../types/recipeExtraction';

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// ============================================================================
// PROMPTS - UPDATED WITH INSTRUCTION SECTIONS
// ============================================================================

const SYSTEM_PROMPT = `You are an expert recipe extraction assistant. Extract recipe information from images with high accuracy and attention to detail.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. For quantities: extract as numbers (use decimals for fractions: 1/2 = 0.5, 1/4 = 0.25, 1/3 = 0.33, 2/3 = 0.67, 3/4 = 0.75)
3. For ingredient_name: extract just the base ingredient without quantities/prep (e.g., "2 cups chopped onions" → ingredient_name: "onions")
4. For preparation: extract terms like "chopped", "diced", "minced", "sliced"
5. If uncertain about any value, use null rather than guessing
6. Preserve original_text exactly as written in the recipe
7. Pay close attention to ingredient options (OR patterns) and substitutions
8. **EXTREMELY IMPORTANT: Look VERY carefully for book metadata - it's almost always there!**
9. Detect cross-references to other recipes
10. Analyze visual style of the page for future use
11. **NEW: Group instructions into logical sections with descriptive titles**

FRACTION CONVERSIONS:
- ½, 1/2 → 0.5
- ⅓, 1/3 → 0.33
- ⅔, 2/3 → 0.67
- ¼, 1/4 → 0.25
- ¾, 3/4 → 0.75
- ⅛, 1/8 → 0.125
- ⅜, 3/8 → 0.375
- ⅝, 5/8 → 0.625
- ⅞, 7/8 → 0.875`;

const USER_PROMPT = `Extract this recipe into JSON format. Analyze the image carefully and extract ALL information visible.

**⚠️ INSTRUCTION SECTIONS - CRITICAL NEW FEATURE!**

Instead of a flat list of instructions, group steps into logical sections with descriptive titles.

**How to identify sections:**

1. **Look for natural breaks:**
   - Paragraph breaks in the recipe
   - Change in cooking method (prep → cook → finish)
   - Change in ingredient focus (beans → sauce → assembly)
   - Time-based phases (overnight → next day)

2. **Common section patterns:**
   - "Prepare [Ingredient]" (e.g., "Prepare Beans", "Prepare Aromatics")
   - "Cook [Main Item]" (e.g., "Cook Pork", "Sauté Vegetables")
   - "Make [Component]" (e.g., "Make Sauce", "Make Dressing")
   - "Assemble" or "Finish" or "Serve"
   - "For the [Component]" (e.g., "For the Vinaigrette")

3. **Section guidelines:**
   - Each section should have 1-8 steps
   - Sections should be sequential (do section 1, then section 2)
   - Give sections descriptive, action-oriented titles
   - If recipe is just 2-3 steps total, still create 1 section
   - If recipe has long paragraph-style instructions, break into logical sections

**Examples:**

**Example 1: Short recipe (3 steps)**
Expected JSON format:
{
  "instruction_sections": [
    {
      "section_title": "Prepare and Serve",
      "section_order": 1,
      "steps": [
        {"step_number": 1, "instruction": "Preheat oven to 350°F"},
        {"step_number": 2, "instruction": "Mix all ingredients"},
        {"step_number": 3, "instruction": "Bake for 20 minutes"}
      ]
    }
  ]
}

**Example 2: Recipe with clear phases**
Expected JSON format:
{
  "instruction_sections": [
    {
      "section_title": "Cook Beans",
      "section_order": 1,
      "estimated_time_min": 60,
      "steps": [
        {"step_number": 1, "instruction": "Soak beans overnight"},
        {"step_number": 2, "instruction": "Drain and rinse"},
        {"step_number": 3, "instruction": "Simmer for 1 hour"}
      ]
    },
    {
      "section_title": "Prepare Garlic and Basil",
      "section_order": 2,
      "estimated_time_min": 10,
      "steps": [
        {"step_number": 1, "instruction": "Bring water to boil"},
        {"step_number": 2, "instruction": "Cook garlic 5 minutes"},
        {"step_number": 3, "instruction": "Add basil and cook 1 minute"}
      ]
    },
    {
      "section_title": "Combine and Serve",
      "section_order": 3,
      "estimated_time_min": 5,
      "steps": [
        {"step_number": 1, "instruction": "Drain beans and plate"},
        {"step_number": 2, "instruction": "Top with garlic mixture"}
      ]
    }
  ]
}

**⚠️ BOOK INFORMATION - STILL CRITICAL!**
Look EVERYWHERE on the page for book information:
- Top of page, bottom of page, margins, spine
- Page numbers (if visible, it's a book!)
- Running headers/footers
- Copyright info
- Recipe attribution

**⏱️ TIME EXTRACTION - STILL CRITICAL!**
Be VERY careful to distinguish:

**prep_time_min** = Hands-on preparation BEFORE cooking:
- Chopping, dicing, measuring, mixing
- Any work done BEFORE heat is applied

**cook_time_min** = Active cooking time with heat:
- Baking, sautéing, boiling, grilling

**inactive_time_min** = Waiting time:
- Marinating overnight, rising, chilling, resting

**INGREDIENT OPTIONS - STILL CRITICAL:**
Two types:
1. EQUIVALENT: "peaches OR nectarines" → both equal
2. SUBSTITUTE: "peaches (can substitute nectarines)" → peaches primary

**DIFFICULTY ASSESSMENT - STILL CRITICAL:**
Assess TWO ways:
1. Chef's label: What does recipe say?
2. AI assessment: Your objective analysis (0-100 score)

**CROSS-REFERENCES:**
Look for: "see page 29", "use vinaigrette from p.42"

**RETURN FORMAT:**
{
  "recipe": {
    "title": "string",
    "description": "string or null",
    "servings": number or null,
    "prep_time_min": number or null,
    "cook_time_min": number or null,
    "inactive_time_min": number or null,
    "total_time_min": number or null,
    "chef_difficulty_label": "string or null",
    "chef_difficulty_level": "easy" | "medium" | "hard" | null,
    "cuisine_types": ["string"] or null,
    "meal_type": ["string"] or null,
    "dietary_tags": ["string"] or null,
    "cooking_methods": ["string"] or null
  },
  "book_metadata": {
    "book_title": "string or null",
    "author": "string or null",
    "page_number": number or null,
    "isbn": "string or null",
    "isbn13": "string or null"
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
      "is_optional": boolean,
      "alternatives": [
        {
          "ingredient_name": "string",
          "is_equivalent": boolean,
          "notes": "string or null"
        }
      ] or null
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
  ],
  "cross_references": [
    {
      "reference_text": "string",
      "page_number": number or null,
      "recipe_name": "string or null",
      "reference_type": "ingredient" | "technique" | "variation" | "note"
    }
  ] or null,
  "media_references": [
    {
      "type": "qr_code" | "url" | "youtube" | "instagram" | "video" | "podcast",
      "location": "string or null",
      "visible_url": "string or null",
      "description": "string or null"
    }
  ] or null
}`;

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Extract recipe from image using Claude Vision API
 */
export async function extractRecipeFromImage(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<ExtractedRecipeData> {
  try {
    console.log('🤖 Sending image to Claude Vision API...');
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: USER_PROMPT,
            },
          ],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Claude processing time: ${processingTime}ms`);

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
    const extractedData: ExtractedRecipeData = JSON.parse(responseText);

    console.log('✅ Recipe extracted successfully');
    console.log(`📊 Extracted: ${extractedData.ingredients.length} ingredients, ${extractedData.instruction_sections?.length || 0} sections`);

    // Validate instruction sections exist
    if (!extractedData.instruction_sections || extractedData.instruction_sections.length === 0) {
      console.warn('⚠️ No instruction sections found, creating default section');
      // If Claude didn't create sections, create a default one
      extractedData.instruction_sections = [
        {
          section_title: 'Instructions',
          section_order: 1,
          steps: [],
        },
      ];
    }

    return extractedData;
  } catch (error: any) {
    console.error('❌ Error extracting recipe:', error);
    
    if (error.message?.includes('JSON')) {
      throw new Error('Failed to parse recipe data. The image may not contain a clear recipe.');
    }
    
    throw new Error(`Recipe extraction failed: ${error.message}`);
  }
}

/**
 * Test connection to Claude API
 */
export async function testClaudeConnection(): Promise<boolean> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Test',
        },
      ],
    });

    return response.content.length > 0;
  } catch (error) {
    console.error('❌ Claude connection test failed:', error);
    return false;
  }
}