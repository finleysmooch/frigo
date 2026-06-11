// lib/services/recipeExtraction/recipeService.ts
// Save extracted and processed recipe to database
// UPDATED: Handles chef creation from web recipes, instruction_sections, raw extraction data
// Date: November 19, 2025

import { supabase } from '../../supabase';
import { ProcessedRecipe } from '../../types/recipeExtraction';
import { getChefFromBookAuthor } from './chefService';
import { saveInstructionSections } from '../instructionSectionsService';
import { getDomainFromUrl } from './webExtractor';
import { saveSourceNotes } from './sourceNotesService';

/**
 * Source provenance derived from a recipe's source URL.
 * All three fields are null for photo/book recipes (no source URL) — that is
 * correct, not a failure.
 */
export interface SourceMetadata {
  source_url: string | null;
  source_domain: string | null;
  external_source_id: string | null;
}

/**
 * NYT Import #1: derive the three top-level source-metadata columns from the
 * raw source URL captured during extraction (raw_extraction_data.source_url).
 *
 * - source_url: the URL with query string / hash (tracking params) stripped.
 * - source_domain: hostname with leading "www." removed — reuses
 *   getDomainFromUrl so there is one domain parser in the codebase.
 * - external_source_id: for cooking.nytimes.com, the numeric recipe ID parsed
 *   from /recipes/(\d+) (robust to slug + query params; NYT keys on this ID).
 *   Null for every other domain for now.
 *
 * The backfill script (scripts/backfill_source_metadata.mjs) mirrors this
 * logic in plain JS — keep the two in sync if the rules change.
 */
export function deriveSourceMetadata(rawUrl?: string | null): SourceMetadata {
  if (!rawUrl) {
    return { source_url: null, source_domain: null, external_source_id: null };
  }

  let cleanUrl: string;
  let domain: string | null;
  try {
    const u = new URL(rawUrl);
    u.search = ''; // strip query string (utm_*, etc.)
    u.hash = '';
    cleanUrl = u.toString();
    domain = getDomainFromUrl(rawUrl); // hostname, www. stripped
  } catch {
    // Not a parseable URL — preserve the raw string, no domain/id.
    return { source_url: rawUrl, source_domain: null, external_source_id: null };
  }

  let externalSourceId: string | null = null;
  if (domain === 'cooking.nytimes.com') {
    const match = cleanUrl.match(/\/recipes\/(\d+)/);
    if (match) externalSourceId = match[1];
  }

  return {
    source_url: cleanUrl,
    source_domain: domain,
    external_source_id: externalSourceId,
  };
}

/**
 * Save complete recipe to database
 * Handles all related tables: recipes, recipe_ingredients, instruction_sections,
 * recipe_ingredient_alternatives, recipe_references, recipe_media
 */
export async function saveRecipeToDatabase(
  userId: string,
  processedRecipe: ProcessedRecipe,
  bookId?: string
): Promise<string> {
  try {
    console.log('\n💾 === Starting Recipe Save Process ===');
    console.log('User ID:', userId);
    console.log('Book ID:', bookId || 'none (web recipe)');
    console.log('Recipe Title:', processedRecipe.recipe.title);
    
    // Get chef from book author (if available from book)
    let chefId: string | null = null;
    if (processedRecipe.book_metadata?.author) {
      console.log('👨‍🍳 Getting chef from book author:', processedRecipe.book_metadata.author);
      chefId = await getChefFromBookAuthor(processedRecipe.book_metadata.author);
      console.log('Chef ID:', chefId || 'none');
    }
    
    // Get chef from web recipe author (if available from web scraping)
    if (!chefId && processedRecipe.recipe.source_author) {
      console.log('👨‍🍳 Creating chef from web recipe author:', processedRecipe.recipe.source_author);
      
      // Extract website from source URL if available
      let website: string | undefined;
      if (processedRecipe.raw_extraction_data?.source_url) {
        const { extractWebsiteFromUrl } = await import('./chefService');
        website = extractWebsiteFromUrl(processedRecipe.raw_extraction_data.source_url);
        console.log('🌐 Website URL:', website);
      }
      
      chefId = await getChefFromBookAuthor(processedRecipe.recipe.source_author, website);
      console.log('Chef ID:', chefId || 'none');
    }

    // Save main recipe first
    const recipeId = await saveRecipe(userId, processedRecipe, bookId, chefId);
    console.log('✅ Recipe saved with ID:', recipeId);

    // Save ingredients
    console.log('📦 Saving ingredients...');
    await saveIngredients(recipeId, processedRecipe);
    console.log('✅ Ingredients saved');

    // Save instruction sections (for web-extracted recipes)
    if (processedRecipe.instruction_sections && processedRecipe.instruction_sections.length > 0) {
      console.log('📝 Saving instruction sections...');
      console.log('Sections to save:', processedRecipe.instruction_sections.length);
      await saveInstructionSections(recipeId, processedRecipe.instruction_sections);
      console.log('✅ Instruction sections saved');
    } else {
      console.log('⚠️ No instruction sections to save');
    }

    // Save community source notes (NYT Cooking comments), if any. Idempotent
    // upsert; non-fatal on failure. Keyed with the same source metadata derived
    // for the recipe row.
    if (processedRecipe.source_notes && processedRecipe.source_notes.length > 0) {
      console.log(`💬 Saving ${processedRecipe.source_notes.length} source notes...`);
      const noteMeta = deriveSourceMetadata(processedRecipe.raw_extraction_data?.source_url);
      await saveSourceNotes(recipeId, processedRecipe.source_notes, {
        externalSourceId: noteMeta.external_source_id,
        sourceDomain: noteMeta.source_domain,
      });
    }

    // Save cross-references if any
    if (processedRecipe.cross_references && processedRecipe.cross_references.length > 0) {
      console.log('🔗 Saving cross-references...');
      await saveCrossReferences(recipeId, processedRecipe.cross_references);
      console.log('✅ Cross-references saved');
    }

    // Save media references if any
    if (processedRecipe.media_references && processedRecipe.media_references.length > 0) {
      console.log('📸 Saving media references...');
      await saveMediaReferences(recipeId, processedRecipe.media_references);
      console.log('✅ Media references saved');
    }

    console.log('🎉 === Recipe Save Complete ===\n');
    return recipeId;
    
  } catch (error) {
    console.error('❌ Error saving recipe:', error);
    throw new Error('Failed to save recipe to database');
  }
}

/**
 * Save main recipe record
 */
async function saveRecipe(
  userId: string,
  processedRecipe: ProcessedRecipe,
  bookId?: string,
  chefId?: string | null
): Promise<string> {
  const { recipe, book_metadata, ai_difficulty_assessment, raw_extraction_data } = processedRecipe;
  // Richer provenance (NYT byline/credit/dates). `source_meta` here is distinct
  // from the URL-derived `sourceMeta` (domain/external id) computed below.
  const provenance = processedRecipe.source_meta;

  console.log('\n💾 Saving recipe record to database...');
  console.log('Title:', recipe.title);
  console.log('Description:', recipe.description ? `"${recipe.description.substring(0, 50)}..."` : 'none');
  console.log('Image URL:', recipe.image_url || 'none');
  console.log('Chef ID:', chefId || 'none');
  console.log('Book ID:', bookId || 'none');
  console.log('Times:', {
    prep: recipe.prep_time_min,
    cook: recipe.cook_time_min,
    inactive: recipe.inactive_time_min,
  });
  console.log('Raw extraction data:', raw_extraction_data ? 'YES' : 'NO');

  // NYT Import #1: derive top-level source-provenance columns from the source
  // URL captured during extraction. Null for photo/book recipes (no URL).
  const sourceMeta = deriveSourceMetadata(raw_extraction_data?.source_url);
  console.log('Source metadata:', {
    domain: sourceMeta.source_domain || 'none',
    external_id: sourceMeta.external_source_id || 'none',
  });

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      book_id: bookId || null,
      chef_id: chefId || null,
      page_number: book_metadata?.page_number || null,
      title: recipe.title,
      description: recipe.description || null,
      source_author: recipe.source_author || null,
      // NYT Import #1: source provenance (null for photo/book recipes)
      source_url: sourceMeta.source_url,
      source_domain: sourceMeta.source_domain,
      external_source_id: sourceMeta.external_source_id,
      // Richer provenance: byline/credit + source + extraction dates. These let
      // us later re-scrape and compare source_updated_at to detect changes.
      // source_author/chef_id stay single (primary author); source_authors holds
      // the full co-author list for display.
      source_authors: provenance?.authors && provenance.authors.length > 0 ? provenance.authors : null,
      source_byline: provenance?.byline || null,
      source_credit: provenance?.credit || null,
      source_published_at: provenance?.publishedAt || null,
      source_updated_at: provenance?.updatedAt || null,
      source_extracted_at: raw_extraction_data?.extraction_date || null,
      image_url: recipe.image_url || null,
      servings: recipe.servings || null,
      prep_time_min: recipe.prep_time_min || null,
      cook_time_min: recipe.cook_time_min || null,
      inactive_time_min: recipe.inactive_time_min || null,
      chef_difficulty_label: recipe.chef_difficulty_label || null,
      chef_difficulty_level: recipe.chef_difficulty_level || null,
      ai_difficulty_level: ai_difficulty_assessment?.difficulty_level || null,
      ai_difficulty_score: ai_difficulty_assessment?.difficulty_score || null,
      ai_difficulty_factors: ai_difficulty_assessment?.factors || null,
      cuisine_types: recipe.cuisine_types || [],
      meal_type: recipe.meal_type || [],
      dietary_tags: recipe.dietary_tags || [],
      cooking_methods: recipe.cooking_methods || [],
      is_public: false,
      // Empty instructions array - actual instructions in instruction_sections table
      instructions: [],
      // Store raw extraction data for future parsing
      // This includes recipe notes, ingredient swaps, and other text not yet parsed
      raw_extraction_data: raw_extraction_data || null,
      // Phase 3A classification fields
      hero_ingredients: recipe.hero_ingredients || [],
      vibe_tags: recipe.vibe_tags || [],
      serving_temp: recipe.serving_temp || null,
      course_type: recipe.course_type || null,
      make_ahead_score: recipe.make_ahead_score || null,
      cooking_concept: recipe.cooking_concept || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error saving recipe:', error);
    throw error;
  }

  console.log('✅ Recipe record saved successfully!');
  return data.id;
}

/**
 * Save ingredients to recipe_ingredients table
 */
async function saveIngredients(
  recipeId: string,
  processedRecipe: ProcessedRecipe
): Promise<void> {
  const ingredientInserts = processedRecipe.ingredients_with_matches.map((ing) => ({
    recipe_id: recipeId,
    ingredient_id: ing.ingredient_id,
    original_text: ing.original_text,
    quantity_amount: ing.quantity_amount || null,
    quantity_unit: ing.quantity_unit || null,
    preparation: ing.preparation || null,
    sequence_order: ing.sequence_order,
    match_confidence: ing.match_confidence,
    match_method: ing.match_method,
    match_notes: ing.match_notes,
    needs_review: ing.needs_review,
    optional_confidence: ing.is_optional ? 1.0 : 0.0,
    // Phase 3A classification fields
    ingredient_classification: ing.ingredient_classification || 'secondary',
    flavor_tags: ing.flavor_tags || [],
  }));

  console.log(`Inserting ${ingredientInserts.length} ingredients...`);

  const { error } = await supabase
    .from('recipe_ingredients')
    .insert(ingredientInserts);

  if (error) {
    console.error('❌ Error saving ingredients:', error);
    throw error;
  }

  console.log('✅ Ingredients saved successfully');
}

/**
 * Save cross-references to recipe_references table
 */
async function saveCrossReferences(
  recipeId: string,
  crossReferences: any[]
): Promise<void> {
  // Map the extraction's CrossReference output → live `recipe_references` columns. Prior code wrote
  // recipe_id / page_number / notes (no such columns) AND read ref.type / ref.text / ref.notes — but the
  // parser emits reference_text / reference_type / recipe_name / page_number — so any non-empty
  // cross_references threw and failed the WHOLE recipe save. `notes` is a phantom (never emitted, no
  // column) → dropped; `recipe_name` (previously ignored) now lands in `referenced_recipe_name`.
  const referenceInserts = crossReferences.map((ref) => ({
    source_recipe_id: recipeId,
    reference_text: ref.reference_text,
    reference_type: ref.reference_type ?? null,
    referenced_page_number: ref.page_number ?? null,
    referenced_recipe_name: ref.recipe_name ?? null,
  }));

  const { error } = await supabase
    .from('recipe_references')
    .insert(referenceInserts);

  if (error) {
    console.error('❌ Error saving cross-references:', error);
    throw error;
  }

  console.log('✅ Cross-references saved successfully');
}

/**
 * Save media references to recipe_media table
 */
async function saveMediaReferences(
  recipeId: string,
  mediaReferences: any[]
): Promise<void> {
  // Map the extraction's MediaReference output → live `recipe_media` columns. Prior code wrote
  // image_url / caption / sequence_order (no such columns) AND read media.media_type / image_url /
  // caption — but the parser emits type / visible_url / description / location — so any non-empty
  // media_references threw. The numeric `sequence_order` is a phantom (never emitted, no column) →
  // dropped; `location` (previously ignored) now lands in `location_on_page`.
  const mediaInserts = mediaReferences.map((media) => ({
    recipe_id: recipeId,
    media_type: media.type ?? null,
    url: media.visible_url ?? null,
    description: media.description ?? null,
    location_on_page: media.location ?? null,
  }));

  const { error } = await supabase
    .from('recipe_media')
    .insert(mediaInserts);

  if (error) {
    console.error('❌ Error saving media references:', error);
    throw error;
  }

  console.log('✅ Media references saved successfully');
}