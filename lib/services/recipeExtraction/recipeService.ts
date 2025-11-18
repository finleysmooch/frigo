// services/recipeExtraction/recipeService.ts
// Save extracted and processed recipe to database
// UPDATED: Now handles chef creation from book authors

import { supabase } from '../../supabase';
import { ProcessedRecipe } from '../../types/recipeExtraction';
import { getChefFromBookAuthor } from './chefService';

/**
 * Save complete recipe to database
 * Handles all related tables: recipes, recipe_ingredients, recipe_ingredient_alternatives,
 * recipe_references, recipe_media
 */
export async function saveRecipeToDatabase(
  userId: string,
  processedRecipe: ProcessedRecipe,
  bookId?: string
): Promise<string> {
  try {
    // Get chef from book author (if available)
    let chefId: string | null = null;
    if (processedRecipe.book_metadata?.author) {
      console.log('👨‍🍳 Getting chef from book author:', processedRecipe.book_metadata.author);
      chefId = await getChefFromBookAuthor(processedRecipe.book_metadata.author);
      console.log('Chef ID:', chefId || 'none');
    }

    // Save main recipe first
    const recipeId = await saveRecipe(userId, processedRecipe, bookId, chefId);

    // Save ingredients
    await saveIngredients(recipeId, processedRecipe);

    // Save cross-references if any
    if (processedRecipe.cross_references && processedRecipe.cross_references.length > 0) {
      await saveCrossReferences(recipeId, processedRecipe.cross_references);
    }

    // Save media references if any
    if (processedRecipe.media_references && processedRecipe.media_references.length > 0) {
      await saveMediaReferences(recipeId, processedRecipe.media_references);
    }

    return recipeId;
    
  } catch (error) {
    console.error('Error saving recipe:', error);
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
  const { recipe, book_metadata, ai_difficulty_assessment } = processedRecipe;

  console.log('\n💾 Saving recipe to database...');
  console.log('Title:', recipe.title);
  console.log('Chef ID:', chefId || 'none');
  console.log('Book ID:', bookId || 'none');
  console.log('Times:', {
    prep: recipe.prep_time_min,
    cook: recipe.cook_time_min,
    inactive: recipe.inactive_time_min,
  });

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      book_id: bookId || null,
      chef_id: chefId || null, // NEW: Link to chef
      page_number: book_metadata?.page_number || null,
      title: recipe.title,
      description: recipe.description || null,
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
      is_public: false, // Default to private
      // Convert instructions to jsonb format
      instructions: [],
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error saving recipe:', error);
    throw error;
  }

  console.log('✅ Recipe saved successfully!');
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
  }));

  const { error: ingredientsError, data: insertedIngredients } = await supabase
    .from('recipe_ingredients')
    .insert(ingredientInserts)
    .select('id');

  if (ingredientsError) {
    throw ingredientsError;
  }

  // Save ingredient alternatives if any
  for (let i = 0; i < processedRecipe.ingredients_with_matches.length; i++) {
    const ingredient = processedRecipe.ingredients_with_matches[i];
    const recipeIngredientId = insertedIngredients[i].id;

    if (ingredient.alternatives && ingredient.alternatives.length > 0) {
      await saveIngredientAlternatives(
        recipeIngredientId,
        ingredient.alternatives
      );
    }
  }
}

/**
 * Save ingredient alternatives
 */
async function saveIngredientAlternatives(
  recipeIngredientId: string,
  alternatives: Array<{
    ingredient_name: string;
    is_equivalent: boolean;
    notes?: string;
  }>
): Promise<void> {
  // For each alternative, we need to find the ingredient ID
  // This is simplified - in production you'd match these to the ingredients table
  const alternativeInserts = alternatives.map((alt, index) => ({
    recipe_ingredient_id: recipeIngredientId,
    alternative_ingredient_id: null, // Would match to ingredients table
    is_equivalent: alt.is_equivalent,
    preference_order: index + 1,
    // Store original text in a notes field if needed
  }));

  // Note: This table structure may need adjustment based on your actual
  // recipe_ingredient_alternatives schema
  const { error } = await supabase
    .from('recipe_ingredient_alternatives')
    .insert(alternativeInserts);

  if (error) {
    console.error('Error saving alternatives:', error);
    // Don't throw - alternatives are nice-to-have
  }
}

/**
 * Save cross-references to other recipes
 */
async function saveCrossReferences(
  recipeId: string,
  crossReferences: ProcessedRecipe['cross_references']
): Promise<void> {
  if (!crossReferences) return;

  const referenceInserts = crossReferences.map((ref) => ({
    source_recipe_id: recipeId,
    reference_text: ref.reference_text,
    referenced_page_number: ref.page_number || null,
    referenced_recipe_name: ref.recipe_name || null,
    reference_type: ref.reference_type,
    is_fulfilled: false, // Will be updated when user adds the referenced recipe
  }));

  const { error } = await supabase
    .from('recipe_references')
    .insert(referenceInserts);

  if (error) {
    console.error('Error saving cross-references:', error);
    // Don't throw - references are nice-to-have
  }
}

/**
 * Save media references (QR codes, videos, etc.)
 */
async function saveMediaReferences(
  recipeId: string,
  mediaReferences: ProcessedRecipe['media_references']
): Promise<void> {
  if (!mediaReferences) return;

  const mediaInserts = mediaReferences.map((media) => ({
    recipe_id: recipeId,
    media_type: media.type,
    url: media.visible_url || null,
    description: media.description || null,
    location_on_page: media.location || null,
  }));

  const { error } = await supabase
    .from('recipe_media')
    .insert(mediaInserts);

  if (error) {
    console.error('Error saving media references:', error);
    // Don't throw - media is nice-to-have
  }
}

/**
 * Get recipes with unfulfilled cross-references
 * Use this to show users which referenced recipes they haven't added yet
 */
export async function getUnfulfilledReferences(
  userId: string
): Promise<Array<{ recipe: any; references: any[] }>> {
  try {
    const { data, error } = await supabase
      .from('recipe_references')
      .select(`
        *,
        recipe:recipes!source_recipe_id(id, title, book_id)
      `)
      .eq('is_fulfilled', false)
      .eq('recipe.user_id', userId);

    if (error) {
      throw error;
    }

    // Group by recipe
    const grouped = new Map();
    for (const ref of data) {
      const recipeId = ref.recipe.id;
      if (!grouped.has(recipeId)) {
        grouped.set(recipeId, {
          recipe: ref.recipe,
          references: [],
        });
      }
      grouped.get(recipeId).references.push(ref);
    }

    return Array.from(grouped.values());
    
  } catch (error) {
    console.error('Error getting unfulfilled references:', error);
    return [];
  }
}

/**
 * Check if a recipe fulfills any cross-references
 * Call this after adding a new recipe to update references
 */
export async function checkAndFulfillReferences(
  recipeId: string,
  bookId: string,
  pageNumber: number
): Promise<void> {
  try {
    // Find any references pointing to this page in this book
    const { error } = await supabase
      .from('recipe_references')
      .update({
        referenced_recipe_id: recipeId,
        is_fulfilled: true,
      })
      .eq('recipe.book_id', bookId)
      .eq('referenced_page_number', pageNumber)
      .is('is_fulfilled', false);

    if (error) {
      console.error('Error fulfilling references:', error);
    }
  } catch (error) {
    console.error('Error checking references:', error);
  }
}