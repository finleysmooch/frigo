// ============================================
// RECIPE ANNOTATIONS SERVICE - UPDATED
// ============================================
// Handles user edits to recipes with full support for:
// - Ingredient edits (quantity, unit, name)
// - Instruction edits (text changes)
// - Instruction deletions
// - Step reordering
// - Markup view display
// ============================================

import { supabase } from '../supabase';

// ============================================
// TYPES
// ============================================

export type AnnotationType = 'ingredient_edit' | 'instruction_edit' | 'instruction_delete' | 'step_reorder';
export type ViewMode = 'original' | 'clean' | 'markup';

export interface RecipeAnnotation {
  id: string;
  user_id: string;
  recipe_id: string;
  field_type: string; // 'ingredient' | 'instruction'
  field_id: string | null; // ingredient_id or section_id
  field_index: number | null; // array index for instructions
  original_value: string;
  annotated_value: string;
  annotation_type: AnnotationType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnotationDisplay {
  original: string;
  new: string;
  notes?: string;
  showMarkup: boolean;
}

export interface SaveAnnotationResult {
  success: boolean;
  annotation?: RecipeAnnotation;
  error?: string;
}

// ============================================
// FETCH ANNOTATIONS
// ============================================

/**
 * Get all annotations for a recipe by a specific user
 */
export async function getUserRecipeAnnotations(
  userId: string,
  recipeId: string
): Promise<RecipeAnnotation[]> {
  try {
    const { data, error } = await supabase
      .from('recipe_annotations')
      .select('*')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return [];
  }
}

/**
 * Get annotation for specific field
 */
export async function getFieldAnnotation(
  userId: string,
  recipeId: string,
  fieldType: string,
  fieldIndex: number
): Promise<RecipeAnnotation | null> {
  try {
    const { data, error } = await supabase
      .from('recipe_annotations')
      .select('*')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .eq('field_type', fieldType)
      .eq('field_index', fieldIndex)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching field annotation:', error);
    return null;
  }
}

// ============================================
// CREATE/UPDATE ANNOTATIONS
// ============================================

/**
 * Save ingredient edit
 */
export async function saveIngredientEdit(
  userId: string,
  recipeId: string,
  ingredientId: string,
  fieldIndex: number,
  originalValue: string,
  newValue: string,
  notes?: string
): Promise<SaveAnnotationResult> {
  try {
    // First, check if annotation exists
    const { data: existing } = await supabase
      .from('recipe_annotations')
      .select('id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .eq('field_type', 'ingredient')
      .eq('field_index', fieldIndex)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      // Update existing
      const result = await supabase
        .from('recipe_annotations')
        .update({
          field_id: ingredientId,
          original_value: originalValue,
          annotated_value: newValue,
          annotation_type: 'ingredient_edit',
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('recipe_annotations')
        .insert({
          user_id: userId,
          recipe_id: recipeId,
          field_type: 'ingredient',
          field_id: ingredientId,
          field_index: fieldIndex,
          original_value: originalValue,
          annotated_value: newValue,
          annotation_type: 'ingredient_edit',
          notes: notes || null
        })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    return {
      success: true,
      annotation: data
    };
  } catch (error) {
    console.error('Error saving ingredient edit:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Save instruction edit
 */
export async function saveInstructionEdit(
  userId: string,
  recipeId: string,
  instructionIndex: number,
  originalText: string,
  newText: string,
  notes?: string,
  sectionId?: string
): Promise<SaveAnnotationResult> {
  try {
    // First, check if annotation exists
    const { data: existing } = await supabase
      .from('recipe_annotations')
      .select('id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .eq('field_type', 'instruction')
      .eq('field_index', instructionIndex)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      // Update existing
      const result = await supabase
        .from('recipe_annotations')
        .update({
          field_id: sectionId || null,
          original_value: originalText,
          annotated_value: newText,
          annotation_type: 'instruction_edit',
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('recipe_annotations')
        .insert({
          user_id: userId,
          recipe_id: recipeId,
          field_type: 'instruction',
          field_id: sectionId || null,
          field_index: instructionIndex,
          original_value: originalText,
          annotated_value: newText,
          annotation_type: 'instruction_edit',
          notes: notes || null
        })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    return {
      success: true,
      annotation: data
    };
  } catch (error) {
    console.error('Error saving instruction edit:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete instruction (mark as deleted)
 */
export async function deleteInstruction(
  userId: string,
  recipeId: string,
  instructionIndex: number,
  originalText: string,
  sectionId?: string
): Promise<SaveAnnotationResult> {
  try {
    // First, check if annotation exists
    const { data: existing } = await supabase
      .from('recipe_annotations')
      .select('id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .eq('field_type', 'instruction')
      .eq('field_index', instructionIndex)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      // Update existing to mark as deleted
      const result = await supabase
        .from('recipe_annotations')
        .update({
          field_id: sectionId || null,
          original_value: originalText,
          annotated_value: '', // Empty string indicates deletion
          annotation_type: 'instruction_delete',
          notes: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } else {
      // Insert new deletion annotation
      const result = await supabase
        .from('recipe_annotations')
        .insert({
          user_id: userId,
          recipe_id: recipeId,
          field_type: 'instruction',
          field_id: sectionId || null,
          field_index: instructionIndex,
          original_value: originalText,
          annotated_value: '', // Empty string indicates deletion
          annotation_type: 'instruction_delete',
          notes: null
        })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    return {
      success: true,
      annotation: data
    };
  } catch (error) {
    console.error('Error deleting instruction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Save reordered steps
 */
export async function saveStepReorder(
  userId: string,
  recipeId: string,
  originalOrder: number[],
  newOrder: number[],
  sectionId?: string
): Promise<SaveAnnotationResult> {
  try {
    const { data, error } = await supabase
      .from('recipe_annotations')
      .upsert(
        {
          user_id: userId,
          recipe_id: recipeId,
          field_type: 'instruction',
          field_id: sectionId || null,
          field_index: -1, // Special index for reordering
          original_value: JSON.stringify(originalOrder),
          annotated_value: JSON.stringify(newOrder),
          annotation_type: 'step_reorder',
          notes: null
        },
        {
          onConflict: 'user_id,recipe_id,field_type,field_index'
        }
      )
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      annotation: data
    };
  } catch (error) {
    console.error('Error saving step reorder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================
// DELETE ANNOTATIONS
// ============================================

/**
 * Delete specific annotation
 */
export async function deleteAnnotation(annotationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('recipe_annotations')
      .delete()
      .eq('id', annotationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return false;
  }
}

/**
 * Delete all annotations for a recipe (user resets to original)
 */
export async function deleteAllRecipeAnnotations(
  userId: string,
  recipeId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('recipe_annotations')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting annotations:', error);
    return false;
  }
}

// ============================================
// APPLY ANNOTATIONS
// ============================================

/**
 * Apply annotations to ingredients
 */
export function applyIngredientAnnotations(
  ingredients: any[],
  annotations: RecipeAnnotation[],
  viewMode: ViewMode
): any[] {
  if (viewMode === 'original') {
    return ingredients;
  }

  const ingredientEdits = annotations.filter(a => a.field_type === 'ingredient');
  
  return ingredients.map((ingredient, index) => {
    const annotation = ingredientEdits.find(a => a.field_index === index);
    
    if (!annotation) {
      return ingredient;
    }

    if (viewMode === 'clean') {
      return {
        ...ingredient,
        displayText: annotation.annotated_value
      };
    }

    // Markup mode
    return {
      ...ingredient,
      displayText: annotation.annotated_value,
      _annotation: {
        original: annotation.original_value,
        new: annotation.annotated_value,
        notes: annotation.notes,
        showMarkup: true
      }
    };
  });
}

/**
 * Apply annotations to instructions
 */
export function applyInstructionAnnotations(
  instructions: any[],
  annotations: RecipeAnnotation[],
  viewMode: ViewMode
): any[] {
  if (viewMode === 'original') {
    return instructions;
  }

  const instructionAnnotations = annotations.filter(
    a => a.field_type === 'instruction' && a.annotation_type !== 'step_reorder'
  );

  let result = instructions.map((instruction, index) => {
    const annotation = instructionAnnotations.find(a => a.field_index === index);
    
    if (!annotation) {
      return instruction;
    }

    // Handle deletions
    if (annotation.annotation_type === 'instruction_delete') {
      if (viewMode === 'clean') {
        return null; // Will be filtered out
      }
      // Markup mode - show as deleted
      return {
        ...instruction,
        _annotation: {
          original: annotation.original_value,
          new: '',
          notes: null,
          showMarkup: true,
          isDeleted: true
        }
      };
    }

    // Handle edits
    const text = typeof instruction === 'string' ? instruction : instruction.instruction || instruction.text;
    
    if (viewMode === 'clean') {
      if (typeof instruction === 'string') {
        return annotation.annotated_value;
      }
      return {
        ...instruction,
        instruction: annotation.annotated_value,
        text: annotation.annotated_value
      };
    }

    // Markup mode - always return object with _annotation
    if (typeof instruction === 'string') {
      return {
        text: annotation.annotated_value,
        instruction: annotation.annotated_value,
        _annotation: {
          original: annotation.original_value,
          new: annotation.annotated_value,
          notes: annotation.notes,
          showMarkup: true
        }
      };
    }
    
    return {
      ...instruction,
      instruction: annotation.annotated_value,
      text: annotation.annotated_value,
      _annotation: {
        original: annotation.original_value,
        new: annotation.annotated_value,
        notes: annotation.notes,
        showMarkup: true
      }
    };
  }).filter(i => i !== null); // Remove deleted items in clean mode

  // Apply reordering if exists
  const reorderAnnotation = annotations.find(
    a => a.field_type === 'instruction' && a.annotation_type === 'step_reorder'
  );

  if (reorderAnnotation) {
    try {
      const newOrder = JSON.parse(reorderAnnotation.annotated_value);
      result = newOrder.map((oldIndex: number) => result[oldIndex]);
    } catch (error) {
      console.error('Error parsing reorder annotation:', error);
    }
  }

  return result;
}

/**
 * Get count of annotations
 */
export async function getAnnotationCount(
  userId: string,
  recipeId: string
): Promise<number> {
  try {
    const annotations = await getUserRecipeAnnotations(userId, recipeId);
    return annotations.length;
  } catch (error) {
    console.error('Error counting annotations:', error);
    return 0;
  }
}

/**
 * Check if recipe has any edits
 */
export async function recipeHasEdits(
  userId: string,
  recipeId: string
): Promise<boolean> {
  const count = await getAnnotationCount(userId, recipeId);
  return count > 0;
}