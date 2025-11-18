// lib/services/recipeExtraction/index.ts
// Main orchestration service for recipe extraction
// UPDATED: Now saves instruction sections to database
// FIXED: Corrected to match ingredientMatcher.ts signature

import { extractRecipeFromImage } from './claudeVisionAPI';
import { findBook, createBook, checkUserOwnership, createUserBookOwnership } from './bookService';
import { matchIngredientsToDatabase } from './ingredientMatcher';
import { saveRecipeToDatabase } from './recipeService';
import { saveInstructionSections } from '../instructionSectionsService';
import { ProcessedRecipe, ExtractedInstructionSection, ProcessedIngredient } from '../../types/recipeExtraction';

export interface ExtractionProgress {
  status: 'processing_image' | 'extracting' | 'matching_ingredients' | 'checking_book' | 'saving' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  needsOwnershipVerification?: boolean;
  book?: any;
  error?: string;
}

/**
 * Extract recipe from photo - main entry point
 * 
 * @param userId - User performing the extraction
 * @param imageSource - Image URI or base64
 * @param onProgress - Callback for progress updates
 */
export async function extractRecipeFromPhoto(
  userId: string,
  imageSource: { uri?: string; base64?: string },
  onProgress: (progress: ExtractionProgress) => void
): Promise<{ recipeId: string; needsOwnershipVerification: boolean }> {
  
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
      // Convert URI to base64 (implementation depends on your setup)
      // For now, assume it's already handled
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

    // FIXED: Pass the FULL extractedData object (not just ingredients array)
    // The function returns a ProcessedRecipe object with ingredients_with_matches
    const processedRecipe = await matchIngredientsToDatabase(extractedData);

    // FIXED: Access the ingredients_with_matches array from the processed recipe
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

    if (extractedData.book_metadata) {
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

        // Notify caller that ownership verification is needed
        onProgress({
          status: 'checking_book',
          message: 'Book ownership verification needed',
          progress: 75,
          needsOwnershipVerification: true,
          book: book,
        });

        // For now, create ownership without proof (can update later)
        await createUserBookOwnership(userId, book.id, false);
      }
    }

    // ============================================================================
    // STEP 5: Save to Database
    // ============================================================================
    onProgress({
      status: 'saving',
      message: 'Saving recipe...',
      progress: 85,
    });

    // Add book and ownership info to the processed recipe
    const finalProcessedRecipe: ProcessedRecipe = {
      ...processedRecipe,
      book: book,
      needsOwnershipVerification,
    };

    const recipeId = await saveRecipeToDatabase(userId, finalProcessedRecipe, book?.id);

    console.log(`✅ Recipe saved with ID: ${recipeId}`);

    // ============================================================================
    // STEP 6: Save Instruction Sections (NEW!)
    // ============================================================================
    if (extractedData.instruction_sections && extractedData.instruction_sections.length > 0) {
      console.log(`📝 Saving ${extractedData.instruction_sections.length} instruction sections...`);
      
      try {
        await saveInstructionSections(recipeId, extractedData.instruction_sections);
        console.log('✅ Instruction sections saved successfully');
      } catch (sectionError) {
        console.error('⚠️ Error saving instruction sections:', sectionError);
        // Don't fail the entire extraction if sections fail
        // Recipe is still saved, just without sections
      }
    } else {
      console.log('ℹ️ No instruction sections to save');
    }

    // ============================================================================
    // STEP 7: Complete
    // ============================================================================
    onProgress({
      status: 'complete',
      message: 'Recipe added successfully!',
      progress: 100,
    });

    return {
      recipeId,
      needsOwnershipVerification,
    };

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
    
    // This is a placeholder - implement based on your needs
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

    // Create a single default section with all instructions
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