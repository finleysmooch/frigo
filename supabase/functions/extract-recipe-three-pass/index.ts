// supabase/functions/extract-recipe-three-pass/index.ts
// THREE-PASS RECIPE EXTRACTION WITH HAIKU 4.5 - UPDATED 22 JAN 2026
// Deploy: supabase functions deploy extract-recipe-three-pass
//
// CHANGES FROM ORIGINAL:
// 1. Changed group_header → group_name
// 2. Added group_number field
// 3. Clarified sequence_order is continuous across all sections
// 4. Preserve unicode fractions in original_text + decimals in quantity_amount
// 5. Updated Pass 3 fraction verification messaging
//
// APPROACH:
// - Pass 1: Visual Analysis (count items, list fractions)
// - Pass 2: Detailed Extraction (must match Pass 1 counts)
// - Pass 3: Verification (check Pass 2 against image)
//
// Default model: claude-haiku-4-5-20251001 (92% cheaper!)
// Can override to claude-sonnet-4-5-20250929 for specific recipes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const MODELS = {
  haiku: "claude-haiku-4-5-20251001",      // NEWEST! 92% cheaper!
  sonnet: "claude-sonnet-4-5-20250929",    // NEWEST Sonnet
  opus: "claude-opus-4-5-20251101"
};

const PRICING = {
  "claude-haiku-4-5-20251001": { input: 0.25, output: 1.25 },
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-opus-4-5-20251101": { input: 15.0, output: 75.0 },
};

interface ExtractRequest {
  book_id: string;
  user_id: string;
  queue_item_id?: string;
  limit?: number;
  model?: "haiku" | "sonnet";
  force_reprocess?: boolean;
  test_mode?: boolean;  // If true, saves to test_results field instead of overwriting
  test_run_number?: number;  // NEW: For multi-run testing (1, 2, 3, 4...)
  randomize_order?: boolean;  // NEW: Randomize extraction order for testing
}

interface TocRecipe {
  title: string;
  page: number;
  section?: string;
}

// ============================================================================
// METADATA LOOKUP - Get gold standard mapping for comparison
// ============================================================================

async function getRecipeMetadata(supabase: any, filename: string) {
  const { data, error } = await supabase
    .from('recipe_image_mapping')
    .select(`
      recipe_order,
      is_photo_only,
      notes,
      recipe_id,
      recipes (
        id,
        title
      )
    `)
    .eq('filename', filename)
    .order('recipe_order');
  
  if (error || !data) {
    console.log(`   ⚠️  No mapping found for ${filename}`);
    return [];
  }
  
  return data.map((mapping: any) => ({
    recipe_order: mapping.recipe_order,
    position: mapping.recipe_order === 1 ? 'left' : 'right',
    is_photo_only: mapping.is_photo_only,
    gold_standard_id: mapping.recipe_id,
    gold_standard_title: mapping.recipes?.title || null,
    notes: mapping.notes
  }));
}

// ============================================================================
// PASS 1: VISUAL ANALYSIS
// ============================================================================

const PASS1_SYSTEM = `You are analyzing a cookbook page spread. Your job is to COUNT and LIST what you see.

DO NOT extract full recipes yet. Only observe and count.

Be mechanical and precise.`;

const PASS1_USER = `TASK: Analyze this two-page cookbook spread.

This is from "Plenty" by Yotam Ottolenghi.

STEP 1 - IDENTIFY TITLES:
Look at the TOP 25% of EACH page.
Is there text in LARGER or BOLDER font than the body text?
If YES, that is a recipe TITLE.
Write it EXACTLY as shown, including ALL words.

LEFT PAGE:
□ Title visible? (yes/no)
□ If yes, write COMPLETE title: ___________

RIGHT PAGE:
□ Title visible? (yes/no)
□ If yes, write COMPLETE title: ___________

STEP 2 - COUNT PAGE NUMBERS:
Look at BOTTOM corners.
LEFT bottom corner: ___
RIGHT bottom corner: ___

STEP 3 - COUNT INGREDIENTS:
Count items that have quantities (like "2 cups flour", "1 tbsp oil").
Do NOT count instruction text.

LEFT PAGE ingredients: ___
RIGHT PAGE ingredients: ___

STEP 4 - COUNT INSTRUCTIONS:
Count paragraphs or numbered steps that explain HOW to make the recipe.
Do NOT count ingredient lists.

LEFT PAGE instruction steps: ___
RIGHT PAGE instruction steps: ___

STEP 5 - LIST ALL FRACTIONS:
Write down EVERY fraction symbol you see: ½, ⅓, ¼, ¾, ⅔, ⅛, ⅜, ⅝, ⅞, 2¾, 1½, etc.
List them exactly as shown.

LEFT PAGE fractions: [list all]
RIGHT PAGE fractions: [list all]

STEP 6 - PHOTOS:
□ LEFT PAGE has photo? (yes/no)
□ RIGHT PAGE has photo? (yes/no)

Return ONLY this JSON (no extra text):
{
  "left_page": {
    "has_title": boolean,
    "title_text": "exact title or null",
    "page_number": number or null,
    "ingredient_count": number,
    "instruction_count": number,
    "fractions_seen": ["1/2", "3/4", ...],
    "has_photo": boolean
  },
  "right_page": {
    "has_title": boolean,
    "title_text": "exact title or null",
    "page_number": number or null,
    "ingredient_count": number,
    "instruction_count": number,
    "fractions_seen": ["1/2", "3/4", ...],
    "has_photo": boolean
  },
  "observations": "any concerns or unclear items"
}`;

// ============================================================================
// PASS 2: DETAILED EXTRACTION - UPDATED
// ============================================================================

const PASS2_SYSTEM = `You are extracting recipe content from a cookbook.

RULES (ZERO TOLERANCE):
1. Copy text EXACTLY as shown - do NOT paraphrase
2. PRESERVE unicode fractions in original_text (½, ¼, ⅓, ¾, etc.)
3. ALSO convert fractions to decimals in quantity_amount (½ = 0.5, ¼ = 0.25, ⅓ = 0.333)
4. Extract the EXACT number of items you counted in Pass 1
5. If you extract fewer items, you FAILED
6. Assign group_number sequentially (1, 2, 3...) based on sections
7. Assign sequence_order continuously across ALL ingredients (never reset to 1)
8. Return ONLY valid JSON`;

function buildPass2Prompt(pass1Data: any, tocData: TocRecipe[] | null): string {
  const leftCounts = pass1Data.left_page;
  const rightCounts = pass1Data.right_page;
  
  let tocSection = "";
  if (tocData && tocData.length > 0) {
    tocSection = `\n\nREFERENCE - Expected recipes (from table of contents):
${tocData.map((r: any) => `• "${r.title}" (page ${r.page})`).join('\n')}

If you see a title that matches the TOC, use the EXACT TOC title.`;
  }

  return `Extract recipes from this cookbook spread.

YOU ALREADY COUNTED (Pass 1):
${JSON.stringify({ left_page: leftCounts, right_page: rightCounts }, null, 2)}
${tocSection}

EXTRACTION REQUIREMENTS:

LEFT PAGE:
${leftCounts.has_title ? `□ Title: "${leftCounts.title_text}" (use EXACTLY this)` : '□ No title (continuation page)'}
□ Extract EXACTLY ${leftCounts.ingredient_count} ingredients
□ Extract EXACTLY ${leftCounts.instruction_count} instruction steps
□ Fractions that MUST appear: ${leftCounts.fractions_seen.join(', ')}

RIGHT PAGE:
${rightCounts.has_title ? `□ Title: "${rightCounts.title_text}" (use EXACTLY this)` : '□ No title (continuation page)'}
□ Extract EXACTLY ${rightCounts.ingredient_count} ingredients
□ Extract EXACTLY ${rightCounts.instruction_count} instruction steps
□ Fractions that MUST appear: ${rightCounts.fractions_seen.join(', ')}

EXTRACTION FORMAT:

For EACH recipe found:

{
  "recipes": [
    {
      "position": "left" | "right" | "both",
      "title": "EXACT title from Pass 1 or TOC",
      "page_number": number from Pass 1,
      
      "description": "intro paragraph before ingredients (if any)",
      "servings": "text like 'Serves 4'",
      "servings_number": number or null,
      
      "ingredients": [
        {
          "original_text": "EXACT text as shown - PRESERVE unicode fractions",
          "quantity_amount": number or null,  // Convert fractions to decimals here
          "quantity_unit": "string or null",
          "ingredient_name": "string",
          "preparation": "string or null (e.g., 'chopped', 'sifted')",
          "sequence_order": 1,        // Continuous across entire recipe (1-21, not per section!)
          "group_number": 1,          // Which section: 1, 2, 3... (always 1 if no sections)
          "group_name": "Sauce" or null  // Section name or null
        }
        // Repeat for ALL ingredients
      ],
      
      "instruction_sections": [
        {
          "section_title": null,
          "section_order": 1,
          "steps": [
            {
              "step_number": 1,
              "instruction": "EXACT text as shown - do NOT paraphrase"
            }
            // Repeat for ALL steps
          ]
        }
      ],
      
      "notes": "any chef notes or tips",
      "confidence_score": 0.0-1.0
    }
  ]
}

GROUPING RULES:

If recipe has NO section headers:
- All ingredients: group_number = 1, group_name = null

If recipe has section headers (e.g., "For the sauce:", "For the broth:"):
- Detect section boundaries
- Assign sequential group_number starting at 1
- Extract section name (without "For the" prefix): "For the sauce" → "Sauce"
- sequence_order NEVER resets - continues across all sections

Example with sections:
Section "For the mayonnaise" (8 items):
  Item 1: group_number = 1, sequence_order = 1, group_name = "Mayonnaise"
  Item 2: group_number = 1, sequence_order = 2, group_name = "Mayonnaise"
  ...
  Item 8: group_number = 1, sequence_order = 8, group_name = "Mayonnaise"

Section "For the vegetables" (6 items):
  Item 9: group_number = 2, sequence_order = 9, group_name = "Vegetables"  ← NOT sequence_order 1!
  Item 10: group_number = 2, sequence_order = 10, group_name = "Vegetables"
  ...

IMPORTANT: sequence_order is the ingredient's position in the ENTIRE recipe.

CRITICAL RULES:
1. If you extract fewer ingredients/steps than counted, you FAILED
2. Each fraction from Pass 1 MUST appear somewhere in your extraction
3. Copy text WORD-FOR-WORD - paraphrasing = FAILURE
4. If text is unclear, write [UNCLEAR: best guess] - do NOT invent

Begin extraction:`;
}

// ============================================================================
// PASS 3: VERIFICATION - UPDATED MESSAGING
// ============================================================================

const PASS3_SYSTEM = `You are verifying a recipe extraction.

Check if Pass 2 extraction matches Pass 1 observations.

Be strict and mechanical - this is quality control.`;

function buildPass3Prompt(pass1Data: any, pass2Data: any): string {
  // Extract recipe from wrapper (Pass 2 format)
  const recipes = pass2Data.recipes || [];
  const leftRecipe = recipes.find((r: any) => r.position === 'left' || r.position === 'both');
  const rightRecipe = recipes.find((r: any) => r.position === 'right' || r.position === 'both');
  
  // Build searchable text from extracted data
  const leftIngredients = leftRecipe?.ingredients || [];
  const rightIngredients = rightRecipe?.ingredients || [];
  const leftSteps = leftRecipe?.instruction_sections?.[0]?.steps || [];
  const rightSteps = rightRecipe?.instruction_sections?.[0]?.steps || [];
  
  // Combine all text for fraction search
  const allText = [
    ...leftIngredients.map((i: any) => i.original_text || ''),
    ...rightIngredients.map((i: any) => i.original_text || ''),
    ...leftSteps.map((s: any) => s.instruction || ''),
    ...rightSteps.map((s: any) => s.instruction || ''),
  ].join(' ');
  
  // Check which fractions from Pass 1 appear in the extracted text
  const pass1Fractions = [
    ...pass1Data.left_page.fractions_seen,
    ...pass1Data.right_page.fractions_seen
  ];
  
  const foundFractions: string[] = [];
  const missingFractions: string[] = [];
  
  // Fraction to decimal mapping
  const decimalMap: { [key: string]: string } = {
    '½': '0.5',
    '⅓': '0.333',
    '¼': '0.25',
    '¾': '0.75',
    '⅔': '0.667',
    '⅛': '0.125',
    '⅜': '0.375',
    '⅝': '0.625',
    '⅞': '0.875',
    '1½': '1.5',
    '2½': '2.5',
    '1¼': '1.25',
    '1¾': '1.75',
    '2¼': '2.25',
    '2¾': '2.75',
  };
  
  for (const fraction of pass1Fractions) {
    // Check for both fraction symbol and decimal equivalent
    const decimal = decimalMap[fraction] || fraction;
    
    if (allText.includes(fraction) || allText.includes(decimal)) {
      foundFractions.push(fraction);
    } else {
      missingFractions.push(fraction);
    }
  }
  
  return `Verify the extraction against the original image.

PASS 1 OBSERVATIONS:
${JSON.stringify(pass1Data, null, 2)}

PASS 2 EXTRACTION:
- Recipes found: ${recipes.length}
- Left recipe: ${leftRecipe?.title || 'none'}
- Right recipe: ${rightRecipe?.title || 'none'}

VERIFICATION CHECKLIST:

1. TITLE VERIFICATION:
   Pass 1 left title: "${pass1Data.left_page.title_text}"
   Pass 2 left title: "${leftRecipe?.title || 'none'}"
   □ Do they match EXACTLY? (yes/no/n/a)
   
   Pass 1 right title: "${pass1Data.right_page.title_text}"
   Pass 2 right title: "${rightRecipe?.title || 'none'}"
   □ Do they match EXACTLY? (yes/no/n/a)

2. COUNT VERIFICATION:
   LEFT PAGE:
   - Ingredients: ${pass1Data.left_page.ingredient_count} expected, ${leftIngredients.length} extracted
   - Steps: ${pass1Data.left_page.instruction_count} expected, ${leftSteps.length} extracted
   □ Counts match? (yes/no)
   
   RIGHT PAGE:
   - Ingredients: ${pass1Data.right_page.ingredient_count} expected, ${rightIngredients.length} extracted
   - Steps: ${pass1Data.right_page.instruction_count} expected, ${rightSteps.length} extracted
   □ Counts match? (yes/no)

3. FRACTION VERIFICATION:
   Pass 1 saw these fractions: ${pass1Fractions.join(', ')}
   
   AUTOMATED CHECK RESULTS:
   - Found in extraction: ${foundFractions.join(', ') || 'none'}
   - Not found: ${missingFractions.join(', ') || 'none'}
   
   ${missingFractions.length > 0 ? 'Look at the original image and verify if the "not found" fractions are actually there. They should appear as unicode in original_text AND as decimals in quantity_amount.' : 'All fractions from Pass 1 were found in the extraction.'}

4. INVENTED INGREDIENTS CHECK:
   Look at the original image.
   Compare each ingredient in Pass 2 extraction.
   □ Are there ingredients in Pass 2 that are NOT in the image?
   List any.

5. PARAPHRASING CHECK:
   Compare instruction text in Pass 2 to the original image.
   □ Is the text copied EXACTLY or paraphrased?
   List any paraphrased steps.

6. QUANTITY LOGIC CHECK:
   Review all quantities in Pass 2.
   □ Do they make logical sense together?

Return JSON:
{
  "title_match": boolean (all titles match),
  "count_match": boolean (all counts match),
  "all_fractions_present": boolean,
  "missing_fractions": ["list any missing"],
  "invented_ingredients": ["list any invented"],
  "paraphrasing_detected": ["list any paraphrased"],
  "quantity_concerns": ["list any concerns"],
  "overall_confidence": 0.0-1.0,
  "needs_manual_review": boolean,
  "issues_summary": "brief description of problems or 'none'"
}`;
}

// ============================================================================
// HELPER FUNCTIONS (unchanged from original)
// ============================================================================

async function callClaude(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  mediaType: string,
  maxTokens: number = 4000
): Promise<{ data: any; usage: any }> {
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.content[0].text;
  
  // Parse JSON
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      data = JSON.parse(jsonMatch[1]);
    } else {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        data = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error("Could not parse JSON from response");
      }
    }
  }

  return { data, usage: result.usage };
}

async function getImageData(supabase: any, filename: string): Promise<{ base64: string; mediaType: string }> {
  const { data, error } = await supabase.storage
    .from("recipe-extraction-queue")
    .createSignedUrl(filename, 3600, {
      transform: {
        width: 1600,
        height: 2100,
        resize: 'contain',
        quality: 70
      }
    });
  
  if (error) throw error;
  
  const imageResponse = await fetch(data.signedUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = btoa(
    new Uint8Array(imageBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );
  
  const mediaType = filename.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";
  
  return { base64: base64Image, mediaType };
}

async function getTocData(supabase: any, bookId: string): Promise<TocRecipe[] | null> {
  const { data, error } = await supabase
    .from("books")
    .select("toc_data")
    .eq("id", bookId)
    .single();

  if (error || !data?.toc_data) return null;
  
  const tocData = data.toc_data as any;
  return tocData.all_recipes || null;
}

function calculateCost(usage: any, model: string): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;
  
  return (
    (usage.input_tokens * pricing.input) / 1_000_000 +
    (usage.output_tokens * pricing.output) / 1_000_000
  );
}

// ============================================================================
// THREE-PASS EXTRACTION (unchanged logic, updated prompts used)
// ============================================================================

async function extractRecipeThreePass(
  supabase: any,
  queueItem: any,
  model: string,
  tocData: TocRecipe[] | null
) {
  const startTime = Date.now();
  let totalCost = 0;
  
  console.log(`\n📸 Processing: ${queueItem.filename}`);
  console.log(`   Model: ${model}`);
  
  // Fetch recipe metadata for this image
  const recipeMetadata = await getRecipeMetadata(supabase, queueItem.filename);
  console.log(`   Found ${recipeMetadata.length} recipe(s) in mapping`);
  
  const { base64, mediaType } = await getImageData(supabase, queueItem.filename);
  
  // PASS 1
  console.log(`   Pass 1: Visual analysis...`);
  const pass1Start = Date.now();
  
  const { data: pass1Data, usage: pass1Usage } = await callClaude(
    model,
    PASS1_SYSTEM,
    PASS1_USER,
    base64,
    mediaType,
    2000
  );
  
  const pass1Cost = calculateCost(pass1Usage, model);
  totalCost += pass1Cost;
  const pass1Time = Date.now() - pass1Start;
  
  console.log(`   ✓ Pass 1: ${pass1Time}ms, $${pass1Cost.toFixed(4)}`);
  
  // PASS 2
  console.log(`   Pass 2: Extraction...`);
  const pass2Start = Date.now();
  
  const pass2Prompt = buildPass2Prompt(pass1Data, tocData);
  const { data: pass2Data, usage: pass2Usage } = await callClaude(
    model,
    PASS2_SYSTEM,
    pass2Prompt,
    base64,
    mediaType,
    8000
  );
  
  const pass2Cost = calculateCost(pass2Usage, model);
  totalCost += pass2Cost;
  const pass2Time = Date.now() - pass2Start;
  
  console.log(`   ✓ Pass 2: ${pass2Time}ms, $${pass2Cost.toFixed(4)}`);
  
  // PASS 3
  console.log(`   Pass 3: Verification...`);
  const pass3Start = Date.now();
  
  const pass3Prompt = buildPass3Prompt(pass1Data, pass2Data);
  const { data: verification, usage: pass3Usage } = await callClaude(
    model,
    PASS3_SYSTEM,
    pass3Prompt,
    base64,
    mediaType,
    3000
  );
  
  const pass3Cost = calculateCost(pass3Usage, model);
  totalCost += pass3Cost;
  const pass3Time = Date.now() - pass3Start;
  
  console.log(`   ✓ Pass 3: ${pass3Time}ms, $${pass3Cost.toFixed(4)}`);
  console.log(`   Confidence: ${verification.overall_confidence.toFixed(2)}`);
  
  // INJECT SOURCE METADATA into each extracted recipe
  if (pass2Data.recipes && Array.isArray(pass2Data.recipes)) {
    pass2Data.recipes.forEach((recipe: any, index: number) => {
      const metadata = recipeMetadata[index] || {};
      recipe.source_metadata = {
        image_filename: queueItem.filename,
        position: metadata.position || (index === 0 ? 'left' : 'right'),
        recipe_order: index + 1,
        is_photo_only: metadata.is_photo_only || false,
        gold_standard_id: metadata.gold_standard_id || null,
        gold_standard_title: metadata.gold_standard_title || null,
        mapping_notes: metadata.notes || null
      };
    });
    console.log(`   ✓ Added source metadata to ${pass2Data.recipes.length} recipe(s)`);
  }
  
  const totalTime = Date.now() - startTime;
  
  let status = 'extracted';
  if (verification.needs_manual_review || verification.overall_confidence < 0.7) {
    status = 'needs_review';
  } else if (verification.overall_confidence >= 0.9) {
    status = 'verified';
  }
  
  return {
    status,
    pass1_data: pass1Data,
    extracted_data: pass2Data,
    verification,
    model_used: model,
    processing_time_ms: totalTime,
    cost_usd: totalCost,
    cost_breakdown: {
      pass1: pass1Cost,
      pass2: pass2Cost,
      pass3: pass3Cost
    }
  };
}

// ============================================================================
// MAIN HANDLER (unchanged from original)
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const {
      book_id,
      user_id,
      queue_item_id,
      limit = 5,
      model = "haiku",
      force_reprocess = false,
      test_mode = false,
      test_run_number = 1,
      randomize_order = false
    }: ExtractRequest = await req.json();

    if (!book_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "book_id and user_id required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const selectedModel = MODELS[model as keyof typeof MODELS];

    console.log(`\nTHREE-PASS EXTRACTION - Model: ${selectedModel}`);
    if (test_mode) {
      console.log(`🧪 TEST MODE - RUN ${test_run_number}: Results saved to test_results_run${test_run_number} field\n`);
    } else {
      console.log(`🚀 PRODUCTION MODE: Will overwrite extracted_data\n`);
    }

    const tocData = await getTocData(supabase, book_id);
    console.log(tocData ? `📚 TOC: ${tocData.length} recipes\n` : `📚 No TOC\n`);

    let query = supabase
      .from("recipe_extraction_queue")
      .select("*")
      .eq("book_id", book_id);
    
    if (queue_item_id) {
      query = query.eq("id", queue_item_id);
    } else {
      // In test mode, allow re-processing of extracted recipes
      if (!force_reprocess && !test_mode) {
        query = query.or('status.is.null,status.eq.pending,status.eq.error');
      } else if (test_mode) {
        // Test mode: Only process gold standard images (IMG_3911-3927) WITHOUT test_results for this run
        const runField = `test_results_run${test_run_number}`;
        query = query
          .eq('status', 'extracted')
          .gte('filename', 'plenty-ottolenghi/IMG_3911.JPG')
          .lte('filename', 'plenty-ottolenghi/IMG_3927.JPG')
          .or(`${runField}.is.null`);
      }
      
      // Apply ordering
      if (randomize_order) {
        // Random order using a random seed (different each time)
        query = query.order("id", { ascending: true });  // Supabase doesn't support random(), so we'll shuffle in code
      } else {
        query = query.order("processing_order", { ascending: true });
      }
      
      query = query.limit(limit);
    }

    const { data: items, error: fetchError } = await query;

    if (fetchError) throw fetchError;
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ message: "No items to process" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Shuffle items if randomization requested
    let itemsToProcess = items;
    if (randomize_order) {
      itemsToProcess = items.sort(() => Math.random() - 0.5);
      console.log(`🎲 Randomized order for ${itemsToProcess.length} items`);
    }

    console.log(`Processing ${itemsToProcess.length} items...\n`);

    const results = [];
    let totalCost = 0;

    for (const item of itemsToProcess) {
      try {
        await supabase
          .from("recipe_extraction_queue")
          .update({ status: "processing" })
          .eq("id", item.id);

        const result = await extractRecipeThreePass(supabase, item, selectedModel, tocData);
        totalCost += result.cost_usd;

        // Prepare update data
        const updateData: any = {
          processing_time_ms: result.processing_time_ms,
          cost_usd: result.cost_usd,
          processed_at: new Date().toISOString(),
        };

        // TEST MODE: Save to test_results_run# field
        if (test_mode) {
          const runField = `test_results_run${test_run_number}`;
          updateData[runField] = {
            model: result.model_used,
            status: result.status,
            extraction: result.extracted_data,
            verification: result.verification,
            cost_breakdown: result.cost_breakdown,
            tested_at: new Date().toISOString(),
            run_number: test_run_number
          };
          updateData.status = 'extracted';  // Keep original status
        } 
        // PRODUCTION MODE: Overwrite extracted_data
        else {
          updateData.status = result.status;
          updateData.extracted_data = result.extracted_data;
          updateData.confidence_score = result.verification.overall_confidence;
        }

        await supabase
          .from("recipe_extraction_queue")
          .update(updateData)
          .eq("id", item.id);

        await supabase
          .from("recipe_extraction_verification")
          .insert({
            queue_item_id: item.id,
            phase1_title_seen: result.pass1_data.left_page.title_text || result.pass1_data.right_page.title_text,
            phase1_ingredient_count: result.pass1_data.left_page.ingredient_count + result.pass1_data.right_page.ingredient_count,
            phase1_instruction_count: result.pass1_data.left_page.instruction_count + result.pass1_data.right_page.instruction_count,
            phase1_fractions_visible: [...result.pass1_data.left_page.fractions_seen, ...result.pass1_data.right_page.fractions_seen],
            title_match: result.verification.title_match,
            count_match: result.verification.count_match,
            all_fractions_present: result.verification.all_fractions_present,
            missing_fractions: result.verification.missing_fractions,
            invented_ingredients: result.verification.invented_ingredients,
            quantity_concerns: result.verification.quantity_concerns,
            paraphrasing_detected: result.verification.paraphrasing_detected,
            overall_confidence: result.verification.overall_confidence,
            status: result.status,
            issues_found: result.verification.issues_summary,
          });

        results.push({
          id: item.id,
          filename: item.filename,
          status: result.status,
          confidence: result.verification.overall_confidence,
          cost: result.cost_usd,
        });

        console.log(`   ✅ ${result.status.toUpperCase()}\n`);

      } catch (error: any) {
        console.error(`   ❌ ERROR: ${error.message}\n`);
        
        await supabase
          .from("recipe_extraction_queue")
          .update({
            status: "error",
            error_message: error.message,
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          filename: item.filename,
          status: "error",
          error: error.message,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const summary = {
      message: `Processed ${itemsToProcess.length} items`,
      model: selectedModel,
      test_mode: test_mode,
      test_run_number: test_run_number,
      randomized: randomize_order,
      results: {
        verified: results.filter(r => r.status === 'verified').length,
        extracted: results.filter(r => r.status === 'extracted').length,
        needs_review: results.filter(r => r.status === 'needs_review').length,
        error: results.filter(r => r.status === 'error').length,
      },
      total_cost_usd: totalCost.toFixed(4),
      avg_cost: (totalCost / itemsToProcess.length).toFixed(4),
      items: results,
    };

    console.log(`\nSUMMARY:`);
    console.log(`Mode: ${test_mode ? 'TEST' : 'PRODUCTION'}`);
    console.log(`Verified: ${summary.results.verified}`);
    console.log(`Needs review: ${summary.results.needs_review}`);
    console.log(`Errors: ${summary.results.error}`);
    console.log(`Total cost: $${summary.total_cost_usd}\n`);

    return new Response(
      JSON.stringify(summary),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Fatal:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});