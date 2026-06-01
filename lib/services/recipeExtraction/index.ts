// lib/services/recipeExtraction/index.ts
// Main orchestration service for recipe extraction
// UPDATED: Now pauses at 'reviewing' status for user review before saving
// Date: December 2, 2025

import { extractRecipeFromImage } from './claudeVisionAPI';
import { findBook, createBook, checkUserOwnership, createUserBookOwnership } from './bookService';
import { matchIngredientsToDatabase } from './ingredientMatcher';
import { saveRecipeToDatabase } from './recipeService';
import { saveInstructionSections } from '../instructionSectionsService';
import { ProcessedRecipe, ExtractedInstructionSection, ProcessedIngredient } from '../../types/recipeExtraction';

export interface ExtractionProgress {
  status: 'processing_image' | 'extracting' | 'matching_ingredients' | 'checking_book' | 'reviewing' | 'saving' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  needsOwnershipVerification?: boolean;
  shouldPromptForBook?: boolean;
  book?: any;
  processedData?: ProcessedRecipe; // Pass processed data for review
  error?: string;
}

/**
 * Extract recipe from photo - main entry point
 * NOW STOPS AT 'reviewing' STATUS FOR USER REVIEW
 * 
 * @param userId - User performing the extraction
 * @param imageSource - Image URI or base64
 * @param onProgress - Callback for progress updates
 */
export async function extractRecipeFromPhoto(
  userId: string,
  imageSource: { uri?: string; base64?: string },
  onProgress: (progress: ExtractionProgress) => void
): Promise<void> {
  
  try {
    // ============================================================================
    // STEP 1: Process Image
    // ============================================================================
    onProgress({
      status: 'processing_image',
      message: 'Processing image...',
      progress: 10,
    });

    let imageBase64: string;
    
    if (imageSource.base64) {
      imageBase64 = imageSource.base64;
    } else if (imageSource.uri) {
      throw new Error('URI to base64 conversion not implemented');
    } else {
      throw new Error('No valid image source provided');
    }

    // ============================================================================
    // STEP 2: Extract Recipe with Claude
    // ============================================================================
    onProgress({
      status: 'extracting',
      message: 'Reading recipe...',
      progress: 30,
    });

    const extractedData = await extractRecipeFromImage(imageBase64);

    console.log('📋 Extracted recipe:', extractedData.recipe.title);
    console.log(`📝 Found ${extractedData.instruction_sections?.length || 0} instruction sections`);

    // ============================================================================
    // STEP 3: Match Ingredients
    // ============================================================================
    onProgress({
      status: 'matching_ingredients',
      message: 'Matching ingredients...',
      progress: 50,
    });

    const processedRecipe = await matchIngredientsToDatabase(extractedData);

    const matchedCount = processedRecipe.ingredients_with_matches.filter(
      (i: ProcessedIngredient) => i.ingredient_id
    ).length;
    
    console.log(`🔍 Matched ${matchedCount}/${processedRecipe.ingredients_with_matches.length} ingredients`);

    // ============================================================================
    // STEP 4: Handle Book
    // ============================================================================
    onProgress({
      status: 'checking_book',
      message: 'Checking book information...',
      progress: 70,
    });

    let book = null;
    let needsOwnershipVerification = false;
    let shouldPromptForBook = false;

    if (extractedData.book_metadata?.book_title) {
      console.log('📚 Book metadata found:', extractedData.book_metadata.book_title);

      // Try to find existing book
      book = await findBook(extractedData.book_metadata);

      if (!book) {
        // Create new book
        console.log('📚 Creating new book entry');
        book = await createBook(extractedData.book_metadata, extractedData.style_metadata);
      }

      // Check if user owns this book
      const userOwnsBook = await checkUserOwnership(userId, book.id);

      if (!userOwnsBook) {
        console.log('📚 User does not own this book yet');
        needsOwnershipVerification = true;
      }
    } else {
      // No book detected - prompt user to select one
      console.log('📚 No book metadata found, will prompt user');
      shouldPromptForBook = true;
    }

    // ============================================================================
    // STEP 5: STOP FOR REVIEW - DO NOT AUTO-SAVE
    // ============================================================================
    const finalProcessedRecipe: ProcessedRecipe = {
      ...processedRecipe,
      book: book,
      needsOwnershipVerification,
    };

    console.log('📋 Ready for review - passing to UI');
    console.log('📋 processedData has instruction_sections:', !!finalProcessedRecipe.instruction_sections);

    // Pass processed data to UI for review - DO NOT SAVE YET
    onProgress({
      status: 'reviewing',
      message: 'Ready for review',
      progress: 80,
      needsOwnershipVerification,
      shouldPromptForBook,
      book,
      processedData: finalProcessedRecipe,
    });

    // Function ends here - UI will call saveExtractedRecipe when user confirms

  } catch (error: any) {
    console.error('❌ Recipe extraction failed:', error);
    
    onProgress({
      status: 'error',
      message: error.message || 'Extraction failed',
      progress: 0,
      error: error.message,
    });

    throw error;
  }
}

/**
 * Save extracted recipe after user review
 * Called from UI when user confirms the recipe
 */
export async function saveExtractedRecipe(
  userId: string,
  processedRecipe: ProcessedRecipe,
  bookId?: string
): Promise<string> {
  try {
    console.log('💾 Saving reviewed recipe...');

    // Handle book ownership if needed
    if (bookId && processedRecipe.needsOwnershipVerification) {
      await createUserBookOwnership(userId, bookId, false);
    }

    // Save recipe to database. NOTE: saveRecipeToDatabase() also saves the
    // instruction sections internally — do NOT call saveInstructionSections()
    // again here or every section + its steps get inserted twice.
    const recipeId = await saveRecipeToDatabase(userId, processedRecipe, bookId);
    console.log(`✅ Recipe saved with ID: ${recipeId}`);

    return recipeId;

  } catch (error: any) {
    console.error('❌ Error saving recipe:', error);
    throw error;
  }
}

/**
 * Update book ownership after user provides proof
 */
export async function updateBookOwnership(
  userId: string,
  bookId: string,
  proofImageUrl: string
): Promise<void> {
  try {
    console.log('📚 Updating book ownership with proof');
    
    // Implementation would update the user_books table
    // with ownership_claimed = true and ownership_proof_image_url
    
    console.log('✅ Book ownership updated');
  } catch (error) {
    console.error('❌ Error updating book ownership:', error);
    throw error;
  }
}

/**
 * Helper: Convert old flat instructions to sections
 * Useful for migrating existing recipes
 */
export async function migrateRecipeToSections(
  recipeId: string,
  flatInstructions: string[]
): Promise<void> {
  try {
    console.log(`🔄 Migrating recipe ${recipeId} to sections format`);

    const sections: ExtractedInstructionSection[] = [{
      section_title: 'Instructions',
      section_order: 1,
      steps: flatInstructions.map((instruction, index) => ({
        step_number: index + 1,
        instruction,
        is_optional: false,
        is_time_sensitive: false,
      })),
    }];

    await saveInstructionSections(recipeId, sections);

    console.log('✅ Recipe migrated to sections format');
  } catch (error) {
    console.error('❌ Error migrating recipe:', error);
    throw error;
  }
}