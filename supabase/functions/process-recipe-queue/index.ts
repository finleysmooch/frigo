// supabase/functions/process-recipe-queue/index.ts
// VERSION 12 - FIXED IMAGE HANDLING
// Deploy: supabase functions deploy process-recipe-queue
//
// FIXES:
// 1. Image resize with 'contain' to prevent cropping
// 2. Smaller dimensions + lower quality to stay under 5 MB
// 3. Improved title detection prompt (LARGE/BOLD text focus)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8000;
const COST_PER_INPUT_TOKEN = 0.003 / 1000;
const COST_PER_OUTPUT_TOKEN = 0.015 / 1000;

interface ProcessRequest {
  book_id: string;
  limit?: number;
  user_id: string;
}

interface TocRecipe {
  title: string;
  page: number;
  page_confidence?: number;
  section?: string;
}

// ============================================================================
// IMPROVED PROMPTS WITH BETTER TITLE DETECTION
// ============================================================================

const SYSTEM_PROMPT = `You are an expert recipe extraction assistant. Extract all recipe content from cookbook pages accurately and completely.

CRITICAL TITLE DETECTION RULES:
1. Recipe titles are in LARGER or BOLDER text than body text
2. Read titles COMPLETELY - include all adjectives and descriptors
3. A page can have BOTH a title at top AND instructions below - that's a NEW recipe, not continuation
4. Don't confuse page numbers, section markers, or body text with titles

OUTPUT: Return ONLY valid JSON. Use decimals for fractions (1/2 = 0.5).`;

// Standard prompt (no TOC)
function buildStandardPrompt(): string {
  return `Extract all recipes from this two-page cookbook spread from "Plenty" by Yotam Ottolenghi.

**CRITICAL FIRST STEP - TITLE DETECTION:**

For EACH page (LEFT and RIGHT), look at the TOP PORTION (top 25% of page):
1. Is there text that is LARGER or BOLDER than the rest? This is the TITLE.
2. Titles are recipe names like "Two-potato vindaloo" or "Beet, yogurt and preserved lemon relish"
3. If you see a TITLE at the top, it's a NEW RECIPE - even if there are instructions below

**IMPORTANT:** Don't confuse:
- Page numbers (bottom corners) with titles
- Section headers with recipe titles
- Body text with titles

Read the COMPLETE title including all adjectives:
✓ "Spicy Moroccan carrot salad" (correct - full title)
✗ "Carrot salad" (wrong - missing "Spicy Moroccan")

**PAGE ANALYSIS:**

LEFT PAGE:
1. Top portion - any LARGE/BOLD text? That's the title.
2. Bottom left corner - page number?
3. Ingredients list present?
4. Instructions present? (May be numbered steps OR paragraph-style)
5. Photos?

RIGHT PAGE:
1. Top portion - any LARGE/BOLD text? That's the title.
2. Bottom right corner - page number?
3. Ingredients list present?
4. Instructions present? (May be numbered steps OR paragraph-style)
5. Photos?

**NOTE:** This cookbook uses paragraph-style instructions (not numbered). Extract them as individual steps based on sentence structure.

${JSON_FORMAT}`;
}

// TOC-guided prompt
function buildTocGuidedPrompt(tocRecipes: TocRecipe[]): string {
  const recipeList = tocRecipes
    .map(r => `• "${r.title}" (expected around page ${r.page})`)
    .join('\n');

  return `Extract all recipes from this two-page cookbook spread from "Plenty" by Yotam Ottolenghi.

**REFERENCE - Expected recipes in this area:**
${recipeList}

**CRITICAL FIRST STEP - TITLE DETECTION:**

Look at the TOP PORTION (top 25%) of EACH page:
1. LEFT PAGE - Is there LARGE/BOLD text at the top? Write it EXACTLY.
2. RIGHT PAGE - Is there LARGE/BOLD text at the top? Write it EXACTLY.

Match what you see to the recipe list above. Use the EXACT title from the list.

**IMPORTANT:** 
- A page can have a title at top AND instructions below = NEW RECIPE
- Recipe titles are in LARGER/BOLDER text than body text
- Read page numbers from BOTTOM corners (not from recipe text)

${JSON_FORMAT}`;
}

// JSON format (shared)
const JSON_FORMAT = `
**JSON FORMAT:**
{
  "title_identification": {
    "left_page_has_title": boolean,
    "left_page_title_seen": "exact title text or null",
    "right_page_has_title": boolean,
    "right_page_title_seen": "exact title text or null",
    "notes": "what you observed at the top of each page"
  },

  "spread_analysis": {
    "left_page_number": number | null (from BOTTOM corner),
    "right_page_number": number | null (from BOTTOM corner),
    "page_number_confidence": 0.0-1.0,
    "left_page_content": "recipe_start" | "recipe_continuation" | "photo_only" | "blank",
    "right_page_content": "recipe_start" | "recipe_continuation" | "photo_only" | "blank",
    "notes": "overall spread description"
  },
  
  "recipes": [
    {
      "position": "left" | "right" | "both",
      "is_new_recipe": boolean,
      "title": "exact complete title or null",
      "guessed_recipe_name": "best guess if no title visible",
      "matched_toc_title": "TOC title this matches (if using TOC)",
      
      "description": "intro text before ingredients",
      "page_number": number (from the actual page),
      "page_number_confidence": 0.0-1.0,
      "servings": "string like 'Serves 4'",
      "servings_number": number | null,
      
      "prep_time_min": number | null,
      "cook_time_min": number | null,
      "inactive_time_min": number | null,
      "total_time_min": number | null,
      
      "cuisine_types": ["string"] | null,
      "dietary_tags": ["vegetarian", "vegan", etc] | null,
      "cooking_methods": ["roasted", "grilled", etc] | null,
      
      "ingredients": [
        {
          "original_text": "2 cups flour",
          "quantity_amount": 2,
          "quantity_unit": "cups",
          "ingredient_name": "flour",
          "preparation": "sifted" or null,
          "sequence_order": 1,
          "is_optional": false,
          "group_header": "For the dough" or null,
          "alternatives": null
        }
      ],
      
      "instruction_sections": [
        {
          "section_title": "Main preparation" or null,
          "section_order": 1,
          "estimated_time_min": null,
          "steps": [
            {
              "step_number": 1,
              "instruction": "Preheat oven to 350°F",
              "is_optional": false,
              "is_time_sensitive": false
            }
          ]
        }
      ],
      
      "cross_references": null,
      "notes": "chef's notes or tips",
      "confidence_score": 0.0-1.0
    }
  ],
  
  "photos": [
    {
      "description": "photo of finished dish",
      "likely_recipe_title": "which recipe this photo shows",
      "location": "left_page" | "right_page" | "full_spread",
      "is_primary": boolean,
      "is_full_page": boolean
    }
  ],
  
  "extraction_notes": "any issues or observations"
}`;

// ============================================================================
// SMART POST-PROCESSING WITH TOC MATCHING
// ============================================================================

function smartPostProcess(extractedData: any, tocRecipes: TocRecipe[] | null): any {
  if (!extractedData || !extractedData.recipes) {
    return extractedData;
  }

  console.log(`🔧 Post-processing ${extractedData.recipes.length} recipes...`);

  // Get titles from title_identification
  const titleId = extractedData.title_identification || {};
  let leftTitleSeen = titleId.left_page_title_seen;
  let rightTitleSeen = titleId.right_page_title_seen;
  
  console.log(`  👀 Titles seen: left="${leftTitleSeen || 'none'}", right="${rightTitleSeen || 'none'}"`);

  // Get page numbers
  const leftPageNum = extractedData.spread_analysis?.left_page_number;
  const rightPageNum = extractedData.spread_analysis?.right_page_number;
  console.log(`  📄 Pages: left=${leftPageNum}, right=${rightPageNum}`);

  // Check if we're missing recipes that Claude saw titles for
  const hasLeftRecipe = extractedData.recipes.some((r: any) => r.position === 'left');
  const hasRightRecipe = extractedData.recipes.some((r: any) => r.position === 'right');
  
  if (leftTitleSeen && !hasLeftRecipe) {
    console.log(`  ⚠️ Claude saw left title "${leftTitleSeen}" but no left recipe extracted!`);
    const tocMatch = tocRecipes ? findTocMatch(leftTitleSeen, tocRecipes) : null;
    
    extractedData.recipes.unshift({
      position: 'left',
      is_new_recipe: true,
      title: tocMatch?.title || leftTitleSeen,
      page_number: leftPageNum,
      page_number_confidence: 0.5,
      confidence_score: 0.5,
      ingredients: [],
      instruction_sections: [],
      _was_created_from_title_identification: true
    });
    console.log(`  ➕ Added missing left recipe: "${tocMatch?.title || leftTitleSeen}"`);
  }

  if (rightTitleSeen && !hasRightRecipe) {
    console.log(`  ⚠️ Claude saw right title "${rightTitleSeen}" but no right recipe extracted!`);
    const tocMatch = tocRecipes ? findTocMatch(rightTitleSeen, tocRecipes) : null;
    
    extractedData.recipes.push({
      position: 'right',
      is_new_recipe: true,
      title: tocMatch?.title || rightTitleSeen,
      page_number: rightPageNum,
      page_number_confidence: 0.5,
      confidence_score: 0.5,
      ingredients: [],
      instruction_sections: [],
      _was_created_from_title_identification: true
    });
    console.log(`  ➕ Added missing right recipe: "${tocMatch?.title || rightTitleSeen}"`);
  }

  let leftBestTitle: string | null = null;
  let rightBestTitle: string | null = null;

  extractedData.recipes = extractedData.recipes.map((recipe: any, index: number) => {
    const position = recipe.position;
    
    // PRIORITIZE title_identification
    const titleFromIdentification = position === 'left' ? leftTitleSeen : 
                                    position === 'right' ? rightTitleSeen : null;
    
    const possibleTitles = [
      titleFromIdentification,
      recipe.title,
      recipe.guessed_recipe_name,
      recipe.matched_toc_title,
    ].filter(t => t && typeof t === 'string' && t.trim().length > 0);

    if (possibleTitles.length === 0) {
      console.log(`  ⚠️ Recipe ${index + 1} (${position}): No title found`);
      return recipe;
    }

    let bestTitle = possibleTitles[0];
    let tocMatch: TocRecipe | null = null;
    
    if (tocRecipes && tocRecipes.length > 0) {
      // Try EXACT match first
      if (titleFromIdentification) {
        const normalizedTitle = titleFromIdentification.toLowerCase().trim();
        tocMatch = tocRecipes.find(r => r.title.toLowerCase().trim() === normalizedTitle) || null;
        
        if (tocMatch) {
          bestTitle = tocMatch.title;
          console.log(`  📚 Exact TOC match: "${titleFromIdentification}"`);
        } else {
          bestTitle = titleFromIdentification;
          console.log(`  👀 Using title_identification: "${titleFromIdentification}"`);
        }
      } else {
        // Fuzzy match on other titles
        for (const possibleTitle of possibleTitles) {
          tocMatch = findTocMatch(possibleTitle, tocRecipes);
          if (tocMatch) {
            bestTitle = tocMatch.title;
            console.log(`  📚 TOC match: "${possibleTitle}" → "${tocMatch.title}"`);
            break;
          }
        }
      }
    }
    
    // Track best titles
    if (position === 'left' || position === 'both') {
      if (!leftBestTitle || bestTitle.length > leftBestTitle.length) {
        leftBestTitle = bestTitle;
      }
    }
    if (position === 'right' || position === 'both') {
      if (!rightBestTitle || bestTitle.length > rightBestTitle.length) {
        rightBestTitle = bestTitle;
      }
    }

    // Fix the recipe
    const currentTitle = recipe.title;
    const needsTitleFix = 
      !currentTitle ||
      currentTitle.length < bestTitle.length ||
      recipe.is_new_recipe === false;

    if (needsTitleFix) {
      console.log(`  ✅ Title fix: "${currentTitle || recipe.guessed_recipe_name}" → "${bestTitle}"`);
    }

    return {
      ...recipe,
      title: needsTitleFix ? bestTitle : recipe.title,
      is_new_recipe: true,
      guessed_recipe_name: needsTitleFix ? null : recipe.guessed_recipe_name,
      _was_fixed: needsTitleFix
    };
  });

  // Update titles_found
  extractedData.titles_found = {
    left_page: leftBestTitle,
    right_page: rightBestTitle,
    total_count: (leftBestTitle ? 1 : 0) + (rightBestTitle ? 1 : 0)
  };

  console.log(`  📋 Final: left="${leftBestTitle}", right="${rightBestTitle}"`);

  return extractedData;
}

// Find TOC match
function findTocMatch(title: string, tocRecipes: TocRecipe[]): TocRecipe | null {
  if (!title) return null;
  
  const normalizedTitle = title.toLowerCase().trim();
  
  // Exact match first
  const exactMatch = tocRecipes.find(r => 
    r.title.toLowerCase().trim() === normalizedTitle
  );
  if (exactMatch) return exactMatch;
  
  // Fuzzy match by word overlap
  const titleWords = normalizedTitle
    .split(/[\s,]+/)
    .filter(w => w.length > 2)
    .map(w => w.replace(/[^a-z]/g, ''));
  
  if (titleWords.length === 0) return null;
  
  let bestMatch: TocRecipe | null = null;
  let bestScore = 0;
  
  for (const tocRecipe of tocRecipes) {
    const tocTitle = tocRecipe.title.toLowerCase().trim();
    const tocWords = tocTitle
      .split(/[\s,]+/)
      .filter(w => w.length > 2)
      .map(w => w.replace(/[^a-z]/g, ''));
    
    const matchingWords = titleWords.filter(w => tocWords.includes(w));
    const score = matchingWords.length / Math.max(titleWords.length, tocWords.length);
    
    if (score > bestScore && matchingWords.length >= 2) {
      bestScore = score;
      bestMatch = tocRecipe;
    }
  }
  
  if (bestMatch && bestScore >= 0.4) {
    return bestMatch;
  }
  
  return null;
}

// ============================================================================
// API FUNCTIONS WITH FIXED IMAGE HANDLING
// ============================================================================

async function processImage(
  imageUrl: string, 
  tocRecipes: TocRecipe[] | null
): Promise<{ data: any; usage: any }> {
  
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = btoa(
    new Uint8Array(imageBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );
  
  const mediaType = imageUrl.toLowerCase().includes(".png")
    ? "image/png"
    : "image/jpeg";

  const userPrompt = tocRecipes && tocRecipes.length > 0
    ? buildTocGuidedPrompt(tocRecipes)
    : buildStandardPrompt();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
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
  
  let extractedData;
  try {
    extractedData = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      extractedData = JSON.parse(jsonMatch[1]);
    } else {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        extractedData = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error("Could not parse JSON from Claude response");
      }
    }
  }

  extractedData = smartPostProcess(extractedData, tocRecipes);

  return {
    data: extractedData,
    usage: result.usage,
  };
}

// FIXED: Proper image resize to avoid cropping and stay under 5 MB
async function getSignedUrl(supabase: any, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("recipe-extraction-queue")
    .createSignedUrl(path, 3600, {
      transform: {
        width: 1600,
        height: 2100,
        resize: 'contain',  // Maintains aspect ratio, no cropping!
        quality: 70         // Lower quality to ensure < 5 MB
      }
    });
  
  if (error) throw error;
  return data.signedUrl;
}

async function getBookTocData(supabase: any, bookId: string): Promise<TocRecipe[] | null> {
  const { data, error } = await supabase
    .from("books")
    .select("toc_data")
    .eq("id", bookId)
    .single();

  if (error || !data?.toc_data) {
    return null;
  }

  const tocData = data.toc_data as any;
  
  if (tocData.all_recipes) {
    return tocData.all_recipes;
  }
  
  if (tocData.sections) {
    return tocData.sections.flatMap((s: any) => 
      s.recipes.map((r: any) => ({ ...r, section: s.name }))
    );
  }
  
  return null;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const { book_id, limit = 5, user_id }: ProcessRequest = await req.json();

    if (!book_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "book_id and user_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get TOC data if available
    const tocRecipes = await getBookTocData(supabase, book_id);
    if (tocRecipes) {
      console.log(`📚 Using TOC with ${tocRecipes.length} recipes for matching`);
    } else {
      console.log(`📚 No TOC - using standard extraction`);
    }

    // Get pending items
    const { data: pendingItems, error: fetchError } = await supabase
      .from("recipe_extraction_queue")
      .select("*")
      .eq("book_id", book_id)
      .eq("status", "pending")
      .order("processing_order", { ascending: true })
      .limit(limit);

    if (fetchError) throw fetchError;

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending items to process", processed: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`🚀 Processing ${pendingItems.length} images for book ${book_id}`);

    const results = [];

    for (const item of pendingItems) {
      const startTime = Date.now();
      
      try {
        console.log(`📸 Processing: ${item.filename}`);
        
        await supabase
          .from("recipe_extraction_queue")
          .update({ status: "processing" })
          .eq("id", item.id);

        const imageUrl = await getSignedUrl(supabase, item.filename);
        const { data: extractedData, usage } = await processImage(imageUrl, tocRecipes);

        const processingTime = Date.now() - startTime;
        const cost =
          usage.input_tokens * COST_PER_INPUT_TOKEN +
          usage.output_tokens * COST_PER_OUTPUT_TOKEN;

        console.log(`✅ Extracted: ${extractedData.recipes?.length || 0} recipes`);
        console.log(`📋 Titles: left="${extractedData.titles_found?.left_page}", right="${extractedData.titles_found?.right_page}"`);
        console.log(`💰 Cost: $${cost.toFixed(4)} | ⏱️ Time: ${processingTime}ms`);

        const needsReview = extractedData.recipes?.some((r: any) => r.confidence_score < 0.7);
        const avgConfidence = extractedData.recipes?.length > 0
          ? extractedData.recipes.reduce((sum: number, r: any) => sum + (r.confidence_score || 0.5), 0) / extractedData.recipes.length
          : 0.5;

        const pageNumber = extractedData.spread_analysis?.left_page_number || 
                          extractedData.spread_analysis?.right_page_number;

        const { error: updateError } = await supabase
          .from("recipe_extraction_queue")
          .update({
            status: needsReview ? "needs_review" : "extracted",
            extracted_data: extractedData,
            detected_page_number: pageNumber,
            processing_time_ms: processingTime,
            cost_usd: cost,
            confidence_score: avgConfidence,
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (updateError) throw updateError;

        results.push({
          id: item.id,
          filename: item.filename,
          status: needsReview ? "needs_review" : "extracted",
          titles_found: extractedData.titles_found?.total_count || 0,
          left_title: extractedData.titles_found?.left_page,
          right_title: extractedData.titles_found?.right_page,
          recipes_found: extractedData.recipes?.length || 0,
          confidence: avgConfidence.toFixed(2),
          processing_time_ms: processingTime,
          cost_usd: cost.toFixed(4),
          used_toc: !!tocRecipes,
        });

      } catch (error: any) {
        console.error(`❌ Error processing ${item.filename}:`, error.message);
        
        await supabase
          .from("recipe_extraction_queue")
          .update({
            status: "error",
            error_message: error.message,
            processing_time_ms: Date.now() - startTime,
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          filename: item.filename,
          status: "error",
          error: error.message,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const totalCost = results
      .filter((r) => r.cost_usd)
      .reduce((sum, r) => sum + parseFloat(r.cost_usd || "0"), 0);

    const summary = {
      message: `Processed ${results.length} images`,
      processed: results.length,
      successful: results.filter(r => r.status !== "error").length,
      errors: results.filter(r => r.status === "error").length,
      needs_review: results.filter(r => r.status === "needs_review").length,
      total_cost_usd: totalCost.toFixed(4),
      used_toc: !!tocRecipes,
      toc_recipe_count: tocRecipes?.length || 0,
      results,
    };

    console.log(`📊 Summary: ${summary.successful} successful, ${summary.errors} errors`);
    console.log(`💰 Total cost: $${summary.total_cost_usd}`);

    return new Response(
      JSON.stringify(summary),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});