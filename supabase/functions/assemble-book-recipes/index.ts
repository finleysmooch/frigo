// supabase/functions/assemble-book-recipes/index.ts
// PHASE 2: Assemble recipes from scanned pages
// Deploy: supabase functions deploy assemble-book-recipes
//
// Takes page scans and assembles them into complete recipes.
// Processes in overlapping chunks for validation and to stay within context limits.
//
// Example for 100 pages:
// - Chunk 1: Pages 1-30  → Recipes A, B, C
// - Chunk 2: Pages 25-55 → Recipes C, D, E (C validates overlap)
// - Chunk 3: Pages 50-80 → Recipes E, F, G (E validates overlap)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8000;
const COST_PER_INPUT_TOKEN = 0.003 / 1000;
const COST_PER_OUTPUT_TOKEN = 0.015 / 1000;

// Chunking configuration
const CHUNK_SIZE = 30;      // Pages per chunk
const OVERLAP_SIZE = 5;     // Pages to overlap

interface AssembleRequest {
  book_id: string;
  user_id: string;
  chunk_number?: number;  // Optional: process specific chunk only
  process_all?: boolean;  // Process all chunks
}

interface PageScan {
  id: string;
  page_number: number;
  page_side: string;
  page_type: string;
  title_text: string | null;
  body_text: string | null;
  has_ingredients_list: boolean;
  has_numbered_steps: boolean;
  has_photo: boolean;
  photo_description: string | null;
}

// ============================================================================
// ASSEMBLY PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are a recipe assembly assistant. You receive scanned cookbook pages and assemble them into complete recipes. Each recipe has a title, ingredients, and instructions that may span 1-4 pages.`;

function buildAssemblyPrompt(pages: PageScan[], tocRecipes: any[] | null, chunkInfo: string): string {
  // Format pages into readable text
  const pageText = pages.map(p => {
    let text = `\n=== PAGE ${p.page_number} (${p.page_side}) ===\n`;
    text += `Type: ${p.page_type}\n`;
    if (p.title_text) text += `TITLE: "${p.title_text}"\n`;
    if (p.has_photo) text += `[PHOTO: ${p.photo_description || 'food photo'}]\n`;
    if (p.body_text) {
      // Truncate very long text
      const bodyPreview = p.body_text.length > 800 
        ? p.body_text.substring(0, 800) + '...' 
        : p.body_text;
      text += `Content:\n${bodyPreview}\n`;
    }
    return text;
  }).join('\n');

  // Include relevant TOC entries
  let tocSection = '';
  if (tocRecipes && tocRecipes.length > 0) {
    const minPage = Math.min(...pages.filter(p => p.page_number).map(p => p.page_number));
    const maxPage = Math.max(...pages.filter(p => p.page_number).map(p => p.page_number));
    
    const relevantToc = tocRecipes.filter(r => 
      r.page >= minPage - 3 && r.page <= maxPage + 3
    );
    
    if (relevantToc.length > 0) {
      tocSection = `\nREFERENCE - Table of Contents shows these recipes in this page range:\n`;
      tocSection += relevantToc.map(r => `• "${r.title}" (page ${r.page})`).join('\n');
      tocSection += '\n';
    }
  }

  return `Assemble recipes from these scanned cookbook pages.

${chunkInfo}
${tocSection}

SCANNED PAGES:
${pageText}

YOUR TASK:
1. Identify where each RECIPE STARTS (look for pages with title_text or type="recipe_start")
2. Identify where each recipe ENDS (next recipe starts, or chunk ends)
3. Combine all pages that belong to each recipe
4. Extract ingredients and instructions from the body text

RULES:
- A recipe STARTS when there's a title_text on a page
- A recipe may span 1-4 pages
- Pages with type="recipe_continuation" belong to the PREVIOUS recipe
- Photo pages belong to the nearest recipe (usually the one before or after)
- Use the Table of Contents to verify recipe titles when available

Return JSON:
{
  "recipes": [
    {
      "title": "Exact recipe title",
      "start_page": number,
      "end_page": number,
      
      "description": "intro paragraph before ingredients",
      "servings": "serves 4" or null,
      
      "ingredients": [
        {
          "text": "2 cups flour",
          "quantity": 2,
          "unit": "cups",
          "item": "flour"
        }
      ],
      
      "instructions": [
        {
          "step": 1,
          "text": "Preheat oven to 350°F"
        }
      ],
      
      "notes": "any chef notes or tips",
      "photo_pages": [page numbers with photos for this recipe],
      "confidence": 0.0-1.0
    }
  ],
  
  "page_assignments": {
    "page_number": "recipe_title or 'unassigned'"
  },
  
  "assembly_notes": "any issues or observations"
}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getPageScans(
  supabase: any,
  bookId: string,
  startPage: number,
  endPage: number
): Promise<PageScan[]> {
  const { data, error } = await supabase
    .from('book_page_scans')
    .select('*')
    .eq('book_id', bookId)
    .gte('page_number', startPage)
    .lte('page_number', endPage)
    .not('page_number', 'is', null)
    .order('page_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getBookPageRange(supabase: any, bookId: string): Promise<{ min: number; max: number } | null> {
  const { data, error } = await supabase
    .from('book_page_scans')
    .select('page_number')
    .eq('book_id', bookId)
    .not('page_number', 'is', null)
    .order('page_number', { ascending: true });

  if (error || !data || data.length === 0) return null;

  return {
    min: data[0].page_number,
    max: data[data.length - 1].page_number,
  };
}

async function getTocRecipes(supabase: any, bookId: string): Promise<any[] | null> {
  const { data, error } = await supabase
    .from('books')
    .select('toc_data')
    .eq('id', bookId)
    .single();

  if (error || !data?.toc_data) return null;
  return data.toc_data.all_recipes || null;
}

function calculateChunks(minPage: number, maxPage: number): Array<{ start: number; end: number; number: number }> {
  const chunks = [];
  let currentStart = minPage;
  let chunkNum = 1;

  while (currentStart <= maxPage) {
    const chunkEnd = Math.min(currentStart + CHUNK_SIZE - 1, maxPage);
    chunks.push({ 
      start: currentStart, 
      end: chunkEnd,
      number: chunkNum++
    });
    
    if (chunkEnd >= maxPage) break;
    currentStart = chunkEnd - OVERLAP_SIZE + 1;
  }

  return chunks;
}

async function assembleChunk(
  pages: PageScan[],
  tocRecipes: any[] | null,
  chunkInfo: string
): Promise<{ data: any; usage: any }> {
  
  const prompt = buildAssemblyPrompt(pages, tocRecipes, chunkInfo);

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
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.content[0].text;
  
  let assemblyData;
  try {
    assemblyData = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      assemblyData = JSON.parse(jsonMatch[1]);
    } else {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        assemblyData = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error("Could not parse JSON from response");
      }
    }
  }

  return { data: assemblyData, usage: result.usage };
}

async function saveAssembledRecipe(
  supabase: any,
  bookId: string,
  recipe: any,
  chunkNumber: number
): Promise<string> {
  const recipeData = {
    book_id: bookId,
    recipe_title: recipe.title,
    recipe_slug: recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    start_page: recipe.start_page,
    end_page: recipe.end_page,
    description: recipe.description,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    notes: recipe.notes,
    photo_page_numbers: recipe.photo_pages,
    assembly_chunk: chunkNumber,
    assembly_confidence: recipe.confidence,
    status: recipe.confidence >= 0.8 ? 'assembled' : 'needs_review',
  };

  // Upsert based on title and book
  const { data, error } = await supabase
    .from('book_recipe_assembly')
    .upsert(recipeData, {
      onConflict: 'book_id,recipe_title',
      ignoreDuplicates: false
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function saveAssemblyRun(
  supabase: any,
  bookId: string,
  chunk: { start: number; end: number; number: number },
  recipesFound: number,
  recipeIds: string[],
  status: string,
  error: string | null,
  processingTimeMs: number,
  costUsd: number
): Promise<void> {
  await supabase
    .from('book_assembly_runs')
    .upsert({
      book_id: bookId,
      chunk_number: chunk.number,
      start_page: chunk.start,
      end_page: chunk.end,
      overlap_pages: OVERLAP_SIZE,
      recipes_found: recipesFound,
      recipe_ids: recipeIds,
      status,
      error_message: error,
      processing_time_ms: processingTimeMs,
      cost_usd: costUsd,
    }, {
      onConflict: 'book_id,chunk_number'
    });
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

    const { book_id, user_id, chunk_number, process_all = false }: AssembleRequest = await req.json();

    if (!book_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "book_id and user_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get page range from scans
    const pageRange = await getBookPageRange(supabase, book_id);
    if (!pageRange) {
      return new Response(
        JSON.stringify({ error: "No scanned pages found. Run scan-book-pages first." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`📖 Book pages: ${pageRange.min} to ${pageRange.max}`);

    // Calculate all chunks
    const allChunks = calculateChunks(pageRange.min, pageRange.max);
    console.log(`📦 Total chunks needed: ${allChunks.length}`);

    // Get TOC for reference
    const tocRecipes = await getTocRecipes(supabase, book_id);
    console.log(`📋 TOC recipes: ${tocRecipes?.length || 0}`);

    // Determine which chunks to process
    let chunksToProcess: typeof allChunks;
    if (chunk_number !== undefined) {
      const chunk = allChunks.find(c => c.number === chunk_number);
      if (!chunk) {
        return new Response(
          JSON.stringify({ error: `Chunk ${chunk_number} not found. Valid: 1-${allChunks.length}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      chunksToProcess = [chunk];
    } else if (process_all) {
      chunksToProcess = allChunks;
    } else {
      // Default: process first unprocessed chunk
      const { data: existingRuns } = await supabase
        .from('book_assembly_runs')
        .select('chunk_number')
        .eq('book_id', book_id)
        .eq('status', 'completed');
      
      const completedChunks = new Set(existingRuns?.map(r => r.chunk_number) || []);
      chunksToProcess = allChunks.filter(c => !completedChunks.has(c.number)).slice(0, 1);
      
      if (chunksToProcess.length === 0) {
        return new Response(
          JSON.stringify({ 
            message: "All chunks already processed",
            total_chunks: allChunks.length,
            completed_chunks: completedChunks.size
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const results = [];
    let totalCost = 0;
    let totalRecipes = 0;

    for (const chunk of chunksToProcess) {
      const startTime = Date.now();
      console.log(`\n🔧 Processing chunk ${chunk.number}/${allChunks.length}: pages ${chunk.start}-${chunk.end}`);

      try {
        // Get scanned pages for this chunk
        const pages = await getPageScans(supabase, book_id, chunk.start, chunk.end);
        
        if (pages.length === 0) {
          console.log(`⚠️ No pages found for chunk ${chunk.number}`);
          continue;
        }

        console.log(`   ${pages.length} pages loaded`);

        // Build chunk info for context
        const chunkInfo = `Processing chunk ${chunk.number} of ${allChunks.length} (pages ${chunk.start}-${chunk.end}).
${chunk.number > 1 ? `Note: Pages ${chunk.start}-${chunk.start + OVERLAP_SIZE - 1} overlap with previous chunk for validation.` : ''}`;

        // Assemble recipes from pages
        const { data: assemblyData, usage } = await assembleChunk(pages, tocRecipes, chunkInfo);

        const processingTime = Date.now() - startTime;
        const cost = usage.input_tokens * COST_PER_INPUT_TOKEN + 
                     usage.output_tokens * COST_PER_OUTPUT_TOKEN;
        totalCost += cost;

        const recipes = assemblyData.recipes || [];
        console.log(`   Found ${recipes.length} recipes`);

        // Save each recipe
        const recipeIds: string[] = [];
        for (const recipe of recipes) {
          try {
            const recipeId = await saveAssembledRecipe(supabase, book_id, recipe, chunk.number);
            recipeIds.push(recipeId);
            console.log(`   ✅ Saved: "${recipe.title}" (pages ${recipe.start_page}-${recipe.end_page})`);
          } catch (err: any) {
            console.error(`   ❌ Error saving "${recipe.title}":`, err.message);
          }
        }

        // Save assembly run
        await saveAssemblyRun(
          supabase, book_id, chunk,
          recipes.length, recipeIds,
          'completed', null,
          processingTime, cost
        );

        totalRecipes += recipes.length;

        results.push({
          chunk_number: chunk.number,
          page_range: `${chunk.start}-${chunk.end}`,
          pages_processed: pages.length,
          recipes_found: recipes.length,
          recipe_titles: recipes.map((r: any) => r.title),
          processing_time_ms: processingTime,
          cost_usd: cost.toFixed(4),
        });

      } catch (error: any) {
        console.error(`❌ Chunk ${chunk.number} error:`, error.message);
        
        await saveAssemblyRun(
          supabase, book_id, chunk,
          0, [],
          'error', error.message,
          Date.now() - startTime, 0
        );

        results.push({
          chunk_number: chunk.number,
          page_range: `${chunk.start}-${chunk.end}`,
          status: 'error',
          error: error.message,
        });
      }

      // Delay between chunks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const summary = {
      message: `Processed ${results.length} chunk(s)`,
      book_id,
      page_range: `${pageRange.min}-${pageRange.max}`,
      total_chunks: allChunks.length,
      chunks_processed: results.length,
      total_recipes_found: totalRecipes,
      total_cost_usd: totalCost.toFixed(4),
      chunk_results: results,
    };

    console.log(`\n📊 Assembly complete: ${totalRecipes} recipes from ${results.length} chunks`);

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