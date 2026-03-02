// supabase/functions/scan-book-pages/index.ts
// FIXED VERSION - Better title detection
// Deploy: supabase functions deploy scan-book-pages

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 6000;
const COST_PER_INPUT_TOKEN = 0.003 / 1000;
const COST_PER_OUTPUT_TOKEN = 0.015 / 1000;

interface ScanRequest {
  book_id: string;
  user_id: string;
  limit?: number;
}

// ============================================================================
// IMPROVED SCAN PROMPT - Focus on TITLES, not "first line"
// ============================================================================

const SYSTEM_PROMPT = `You are a cookbook page scanner. Your job is to identify recipe titles and transcribe page content.

CRITICAL: Recipe titles are in LARGER or BOLDER text than the body text. Don't confuse page numbers, section markers, or body text with titles.`;

const USER_PROMPT = `Scan this two-page cookbook spread from "Plenty" by Yotam Ottolenghi.

**CRITICAL INSTRUCTION - TITLE DETECTION:**

For each page (LEFT and RIGHT), look at the TOP PORTION (top 25% of the page) and identify:

1. Is there any text that is LARGER or BOLDER than the rest? This is the TITLE.
   - Titles are usually in a different font size/weight
   - Example titles: "Two-potato vindaloo", "Beet, yogurt and preserved lemon relish"
   - Titles are recipe names, not page numbers or section names

2. If you see a TITLE, write it exactly as shown

3. IMPORTANT: A page can have BOTH:
   - A title at the top (= NEW RECIPE)
   - Instructions/ingredients below (= RECIPE CONTENT)
   Don't confuse these - if there's a title, it's a NEW recipe start!

**STEP-BY-STEP SCANNING:**

LEFT PAGE:
1. Look at the top portion - is there LARGE/BOLD text? If yes, that's the title.
2. Check the bottom left corner - what's the page number?
3. Does the page have ingredients (with quantities like "2 cups")?
4. Does it have numbered steps?
5. Is there a photo? Describe it.
6. Transcribe the main body text (up to ~600 words)

RIGHT PAGE:
1. Look at the top portion - is there LARGE/BOLD text? If yes, that's the title.
2. Check the bottom right corner - what's the page number?
3. Does the page have ingredients?
4. Does it have numbered steps?
5. Is there a photo? Describe it.
6. Transcribe the main body text (up to ~600 words)

**REMEMBER:**
- Even pages (2, 4, 6, ...) are on the LEFT
- Odd pages (1, 3, 5, ...) are on the RIGHT
- TITLES are in larger/bolder text - this is the most important thing to identify!

**JSON OUTPUT:**
{
  "left_page": {
    "title_text": "the COMPLETE recipe title if you see large/bold text, else null",
    "title_confidence": 0.0-1.0 (how confident you are this is a title),
    "page_number": number or null,
    "has_ingredient_list": true/false,
    "has_numbered_steps": true/false,
    "has_photo": true/false,
    "photo_description": "what the photo shows" or null,
    "photo_size": "full_page" | "half_page" | "small" | "none",
    "body_text": "transcribed text content",
    "scanning_notes": "describe what you saw in the top portion of this page"
  },
  "right_page": {
    "title_text": "the COMPLETE recipe title if you see large/bold text, else null",
    "title_confidence": 0.0-1.0,
    "page_number": number or null,
    "has_ingredient_list": true/false,
    "has_numbered_steps": true/false,
    "has_photo": true/false,
    "photo_description": "what the photo shows" or null,
    "photo_size": "full_page" | "half_page" | "small" | "none",
    "body_text": "transcribed text content",
    "scanning_notes": "describe what you saw in the top portion of this page"
  },
  "scan_notes": "overall observations about this spread"
}

Take your time and be thorough. Identifying titles correctly is CRITICAL.`;

// ============================================================================
// FUNCTIONS
// ============================================================================

async function scanImage(imageUrl: string): Promise<{ data: any; usage: any }> {
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = btoa(
    new Uint8Array(imageBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );
  
  const mediaType = imageUrl.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";

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
              source: { type: "base64", media_type: mediaType, data: base64Image },
            },
            { type: "text", text: USER_PROMPT },
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
  let scanData;
  try {
    scanData = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      scanData = JSON.parse(jsonMatch[1]);
    } else {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        scanData = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error("Could not parse JSON from response");
      }
    }
  }

  return { data: scanData, usage: result.usage };
}

async function getSignedUrl(supabase: any, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("recipe-extraction-queue")
    .createSignedUrl(path, 3600, {
      transform: {
        width: 1600,
        height: 2100,
        resize: 'contain',  // Keeps aspect ratio, no cropping
        quality: 70         // Lower quality for smaller file size
      }
    });
  
  if (error) throw error;
  return data.signedUrl;
}

function classifyPageType(pageData: any): string {
  if (!pageData) return 'blank';
  
  const hasTitle = pageData.title_text && pageData.title_confidence >= 0.7;
  const hasIngredients = pageData.has_ingredient_list;
  const hasSteps = pageData.has_numbered_steps;
  const hasPhoto = pageData.has_photo;
  const photoSize = pageData.photo_size;
  
  // Full page photo
  if (photoSize === 'full_page') return 'photo_only';
  
  // Photo with some text
  if (hasPhoto && photoSize === 'half_page' && !hasIngredients) return 'photo_with_text';
  
  // Recipe start - has title with good confidence
  if (hasTitle) return 'recipe_start';
  
  // Recipe continuation - no title but has recipe content
  if (!hasTitle && (hasIngredients || hasSteps)) return 'recipe_continuation';
  
  // Just text
  if (pageData.body_text && pageData.body_text.length > 100) {
    return 'recipe_continuation';
  }
  
  return 'other';
}

async function savePageScan(
  supabase: any,
  bookId: string,
  queueItemId: string,
  filename: string,
  pageSide: 'left' | 'right',
  pageData: any,
  rawResponse: any,
  processingTimeMs: number,
  costUsd: number
): Promise<void> {
  
  const titleText = pageData.title_text;
  const titleConfidence = pageData.title_confidence || 0.0;
  const pageType = classifyPageType(pageData);
  const wordCount = pageData.body_text ? pageData.body_text.split(/\s+/).length : 0;
  
  // Delete existing record if any
  await supabase
    .from('book_page_scans')
    .delete()
    .eq('queue_item_id', queueItemId)
    .eq('page_side', pageSide);

  // Insert new record
  const { error } = await supabase
    .from('book_page_scans')
    .insert({
      book_id: bookId,
      queue_item_id: queueItemId,
      filename: filename,
      page_number: pageData.page_number,
      page_side: pageSide,
      page_type: pageType,
      title_text: titleText,
      title_confidence: titleConfidence,
      body_text: pageData.body_text,
      has_ingredients_list: pageData.has_ingredient_list || false,
      has_numbered_steps: pageData.has_numbered_steps || false,
      estimated_word_count: wordCount,
      has_photo: pageData.has_photo || false,
      photo_description: pageData.photo_description,
      photo_covers_full_page: pageData.photo_size === 'full_page',
      raw_response: rawResponse,
      processing_time_ms: processingTimeMs,
      cost_usd: costUsd,
      confidence_score: titleConfidence,
    });

  if (error) {
    console.error(`Error saving page scan:`, error);
    throw error;
  }
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

    const { book_id, user_id, limit = 5 }: ScanRequest = await req.json();

    if (!book_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "book_id and user_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get items that haven't been scanned yet
    const { data: pendingItems, error: fetchError } = await supabase
      .from("recipe_extraction_queue")
      .select("*")
      .eq("book_id", book_id)
      .or('scan_status.is.null,scan_status.eq.pending')
      .order("processing_order", { ascending: true })
      .limit(limit);

    if (fetchError) throw fetchError;

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending items to scan", scanned: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`📖 Scanning ${pendingItems.length} images for book ${book_id}`);

    const results = [];
    let totalCost = 0;

    for (const item of pendingItems) {
      const startTime = Date.now();
      
      try {
        console.log(`📸 Scanning: ${item.filename}`);

        const imageUrl = await getSignedUrl(supabase, item.filename);
        const { data: scanData, usage } = await scanImage(imageUrl);

        const processingTime = Date.now() - startTime;
        const cost = usage.input_tokens * COST_PER_INPUT_TOKEN + 
                     usage.output_tokens * COST_PER_OUTPUT_TOKEN;
        totalCost += cost;

        // Save left page
        if (scanData.left_page) {
          await savePageScan(
            supabase, book_id, item.id, item.filename,
            'left', scanData.left_page, scanData,
            Math.round(processingTime / 2), cost / 2
          );
        }

        // Save right page
        if (scanData.right_page) {
          await savePageScan(
            supabase, book_id, item.id, item.filename,
            'right', scanData.right_page, scanData,
            Math.round(processingTime / 2), cost / 2
          );
        }

        // Update queue item
        await supabase
          .from("recipe_extraction_queue")
          .update({ 
            scan_status: 'scanned',
            scan_processed_at: new Date().toISOString()
          })
          .eq("id", item.id);

        const leftTitle = scanData.left_page?.title_text;
        const rightTitle = scanData.right_page?.title_text;
        const leftPage = scanData.left_page?.page_number;
        const rightPage = scanData.right_page?.page_number;
        const leftConf = scanData.left_page?.title_confidence || 0;
        const rightConf = scanData.right_page?.title_confidence || 0;

        console.log(`✅ Pages ${leftPage || '?'}-${rightPage || '?'}:`);
        console.log(`   Left: "${leftTitle || '-'}" (conf=${leftConf.toFixed(2)})`);
        console.log(`   Right: "${rightTitle || '-'}" (conf=${rightConf.toFixed(2)})`);

        results.push({
          id: item.id,
          filename: item.filename,
          status: 'scanned',
          left_page: leftPage,
          right_page: rightPage,
          left_title: leftTitle,
          right_title: rightTitle,
          left_confidence: leftConf,
          right_confidence: rightConf,
          left_type: classifyPageType(scanData.left_page),
          right_type: classifyPageType(scanData.right_page),
          processing_time_ms: processingTime,
          cost_usd: cost.toFixed(4),
        });

      } catch (error: any) {
        console.error(`❌ Error scanning ${item.filename}:`, error.message);
        
        await supabase
          .from("recipe_extraction_queue")
          .update({ scan_status: 'error' })
          .eq("id", item.id);

        results.push({
          id: item.id,
          filename: item.filename,
          status: 'error',
          error: error.message,
        });
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const titlesFound = results.filter(r => r.left_title || r.right_title).length;
    
    const summary = {
      message: `Scanned ${results.length} images`,
      scanned: results.filter(r => r.status === 'scanned').length,
      errors: results.filter(r => r.status === 'error').length,
      images_with_titles: titlesFound,
      total_cost_usd: totalCost.toFixed(4),
      results,
    };

    console.log(`📊 Done: ${summary.scanned} scanned, ${titlesFound} with titles, $${summary.total_cost_usd}`);

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