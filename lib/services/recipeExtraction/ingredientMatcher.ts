// services/recipeExtraction/ingredientMatcher.ts
// Match extracted ingredients to database using existing ingredientsParser

import { matchToDatabase } from '../../ingredientsParser';
import {
  ExtractedRecipeData,
  ProcessedRecipe,
  ProcessedIngredient,
} from '../../types/recipeExtraction';

/**
 * Match all extracted ingredients to database
 * Uses existing ingredientsParser.ts matching logic
 */
export async function matchIngredientsToDatabase(
  extractedData: ExtractedRecipeData
): Promise<ProcessedRecipe> {
  const ingredientsWithMatches: ProcessedIngredient[] = [];

  for (const ingredient of extractedData.ingredients) {
    try {
      // Use existing parser's matching function
      const matchResult = await matchToDatabase({
        original_text: ingredient.original_text,
        quantity_amount: ingredient.quantity_amount || null,
        quantity_unit: ingredient.quantity_unit || null,
        ingredient_name: ingredient.ingredient_name,
        preparation: ingredient.preparation || null,
        confidence_scores: {
          quantity: ingredient.quantity_amount ? 1.0 : 0,
          unit: ingredient.quantity_unit ? 1.0 : 0,
          ingredient: 0.5, // Will be updated by matching
        },
      });

      ingredientsWithMatches.push({
        ...ingredient,
        ingredient_id: matchResult.ingredient_id,
        match_confidence: matchResult.match_confidence,
        match_method: matchResult.match_method,
        match_notes: matchResult.match_notes,
        needs_review: matchResult.needs_review,
      });
      
    } catch (error) {
      console.error(`Error matching ingredient: ${ingredient.ingredient_name}`, error);
      
      // If matching fails, mark as needing review
      ingredientsWithMatches.push({
        ...ingredient,
        ingredient_id: null,
        match_confidence: 0,
        match_method: 'error',
        match_notes: 'Failed to match ingredient',
        needs_review: true,
      });
    }
  }

  return {
    ...extractedData,
    ingredients_with_matches: ingredientsWithMatches,
  };
}

/**
 * Calculate overall extraction confidence
 * Returns percentage of ingredients that matched with high confidence
 */
export function calculateExtractionConfidence(
  processedRecipe: ProcessedRecipe
): number {
  const ingredients = processedRecipe.ingredients_with_matches;
  
  if (ingredients.length === 0) {
    return 0;
  }

  const highConfidenceCount = ingredients.filter(
    (ing) => ing.match_confidence >= 0.8
  ).length;

  return Math.round((highConfidenceCount / ingredients.length) * 100);
}

/**
 * Get ingredients that need user review
 * These should be highlighted in the review UI
 */
export function getIngredientsNeedingReview(
  processedRecipe: ProcessedRecipe
): ProcessedIngredient[] {
  return processedRecipe.ingredients_with_matches.filter(
    (ing) => ing.needs_review || ing.match_confidence < 0.6
  );
}

/**
 * Group ingredients by confidence level for UI display
 */
export function groupIngredientsByConfidence(
  processedRecipe: ProcessedRecipe
): {
  high: ProcessedIngredient[];
  medium: ProcessedIngredient[];
  low: ProcessedIngredient[];
} {
  const high: ProcessedIngredient[] = [];
  const medium: ProcessedIngredient[] = [];
  const low: ProcessedIngredient[] = [];

  for (const ing of processedRecipe.ingredients_with_matches) {
    if (ing.match_confidence >= 0.8) {
      high.push(ing);
    } else if (ing.match_confidence >= 0.5) {
      medium.push(ing);
    } else {
      low.push(ing);
    }
  }

  return { high, medium, low };
}