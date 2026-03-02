// supabase/functions/extract-book-toc/index.ts
// VERSION 2 - IMPROVED TOC EXTRACTION
// Deploy: supabase functions deploy extract-book-toc
//
// IMPROVEMENTS:
// - Better prompts for accuracy
// - Column-by-column reading approach
// - Emphasis on reading EVERY recipe
// - Validation guidance

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 16000; // Increased for large TOCs
const COST_PER_INPUT_TOKEN = 0.003 / 1000;
const COST_PER_OUTPUT_TOKEN = 0.015 / 1000;

interface ExtractTocRequest {
  book_id: string;
  user_id: string;
  toc_image_path: string;
}

// ============================================================================
// IMPROVED TOC EXTRACTION PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are an expert at reading cookbook tables of contents with perfect accuracy.

YOUR TASK: Extract EVERY recipe title and page number from the table of contents image.

CRITICAL RULES:
1. Read CAREFULLY - every word matters
2. Read the COMPLETE title - don't truncate or abbreviate
3. Include ALL recipes - don't skip any
4. Page numbers must be accurate
5. Section headers (in different color/style) organize recipes but are NOT recipes themselves

This is a vegetarian cookbook, so all recipes should be vegetable/plant-based dishes.`;

const USER_PROMPT = `Extract ALL recipes from this cookbook table of contents.

READING STRATEGY:
1. This appears to be a multi-column layout
2. Read each column from top to bottom
3. Move left to right across columns
4. Don't miss any recipes between sections

IDENTIFYING CONTENT:
- SECTION HEADERS: Usually in a different color (yellow/gold), larger font, or different style
  Examples: "Roots", "Funny Onions", "Mushrooms", "Brassicas", "The Mighty Eggplant"
  These are category names, NOT recipes
  
- RECIPE TITLES: Regular text with page numbers
  Examples: "Poached baby vegetables with caper mayonnaise 11"
  These ARE recipes - extract every single one

READ EACH RECIPE TITLE COMPLETELY:
- ✓ "Roasted parsnips and sweet potatoes with caper vinaigrette" (complete)
- ✗ "Roasted parsnips" (incomplete - missing rest of title)
- ✓ "Spicy Moroccan carrot salad" (complete)
- ✗ "Carrot salad" (incomplete - missing "Spicy Moroccan")

CONFIDENCE SCORING:
For each recipe, rate your confidence (0.0 to 1.0) in the page number:
- 1.0 = Page number is crystal clear, easy to read
- 0.8 = Pretty confident, minor blur or small text
- 0.5 = Somewhat uncertain, text is hard to read
- 0.3 = Guessing based on context/sequence

EXPECTED OUTPUT:
This cookbook likely has 100-130 recipes across 15-20 sections. Make sure you capture ALL of them.

Return this JSON structure:
{
  "book_title": "Plenty" or whatever is shown,
  "author": "Yotam Ottolenghi" or whoever,
  "total_recipe_count": number,
  
  "sections": [
    {
      "name": "Section Name (e.g., Roots)",
      "page_start": first page number of this section,
      "recipes": [
        {
          "title": "Complete Recipe Title",
          "page": page number as integer,
          "page_confidence": number (0.0-1.0, how confident you are in this page number)
        }
      ]
    }
  ],
  
  "extraction_notes": "any uncertainties or issues"
}

VALIDATION:
- Recipe titles should sound like food dishes
- Page numbers should generally increase through the book
- Each section should have multiple recipes (typically 4-15)
- Total should be 100+ recipes for a full cookbook

Take your time and be thorough. Missing recipes or incorrect titles will cause problems later.`;

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function extractTocFromImage(imageUrl: string): Promise<{ data: any; usage: any }> {
  // Fetch image and convert to base64
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
              text: USER_PROMPT,
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
  
  // Parse JSON from response
  let tocData;
  try {
    tocData = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      tocData = JSON.parse(jsonMatch[1]);
    } else {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        tocData = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error("Could not parse JSON from Claude response");
      }
    }
  }

  // Add flattened recipe list for easy lookup
  if (tocData.sections) {
    tocData.all_recipes = tocData.sections.flatMap((s: any) => 
      s.recipes.map((r: any) => ({
        title: r.title,
        page: r.page,
        page_confidence: r.page_confidence || 0.5,
        section: s.name
      }))
    );
    tocData.total_recipe_count = tocData.all_recipes.length;
  }

  return {
    data: tocData,
    usage: result.usage,
  };
}

async function getSignedUrl(supabase: any, path: string): Promise<string> {
  // No transform - use full resolution for TOC reading
  const { data, error } = await supabase.storage
    .from("recipe-extraction-queue")
    .createSignedUrl(path, 3600);
  
  if (error) throw error;
  return data.signedUrl;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const { book_id, user_id, toc_image_path }: ExtractTocRequest = await req.json();

    if (!book_id || !user_id || !toc_image_path) {
      return new Response(
        JSON.stringify({ error: "book_id, user_id, and toc_image_path are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    console.log(`📚 Extracting TOC for book ${book_id} from ${toc_image_path}`);

    const startTime = Date.now();

    // Get signed URL for the TOC image (full resolution)
    const imageUrl = await getSignedUrl(supabase, toc_image_path);

    // Extract TOC data
    const { data: tocData, usage } = await extractTocFromImage(imageUrl);

    const processingTime = Date.now() - startTime;
    const cost =
      usage.input_tokens * COST_PER_INPUT_TOKEN +
      usage.output_tokens * COST_PER_OUTPUT_TOKEN;

    console.log(`✅ Extracted ${tocData.total_recipe_count} recipes in ${tocData.sections?.length || 0} sections`);
    console.log(`💰 Cost: $${cost.toFixed(4)} | ⏱️ Time: ${processingTime}ms`);

    // Update book with TOC data
    const { error: updateError } = await supabase
      .from("books")
      .update({
        toc_data: tocData,
        toc_image_path: toc_image_path,
        toc_extracted_at: new Date().toISOString(),
      })
      .eq("id", book_id);

    if (updateError) {
      throw new Error(`Failed to update book: ${updateError.message}`);
    }

    // Build response with section summary
    const sectionSummary = tocData.sections?.map((s: any) => ({
      name: s.name,
      recipe_count: s.recipes.length,
      page_start: s.page_start
    }));

    const response = {
      success: true,
      book_id,
      book_title: tocData.book_title,
      author: tocData.author,
      total_recipes: tocData.total_recipe_count,
      total_sections: tocData.sections?.length || 0,
      sections: sectionSummary,
      processing_time_ms: processingTime,
      cost_usd: cost.toFixed(4),
      extraction_notes: tocData.extraction_notes,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});