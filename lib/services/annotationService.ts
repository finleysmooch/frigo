// services/annotationsService.ts
// Service functions for managing user recipe annotations
// Created: November 11, 2025

import { supabase } from '../supabase';
import {
  RecipeAnnotation,
  CreateAnnotation,
  UserRecipePreferences,
  ViewMode,
} from '../types/recipeExtraction';

// ============================================================================
// CREATE ANNOTATIONS
// ============================================================================

/**
 * Create a new annotation for a recipe field
 */
export async function createAnnotation(
  annotation: CreateAnnotation
): Promise<RecipeAnnotation> {
  try {
    console.log('✏️ Creating annotation:', annotation.field_type);

    const { data, error } = await supabase
      .from('recipe_annotations')
      .insert({
        user_id: annotation.user_id,
        recipe_id: annotation.recipe_id,
        field_type: annotation.field_type,
        field_id: annotation.field_id,
        field_index: annotation.field_index,
        original_value: annotation.original_value,
        annotated_value: annotation.annotated_value,
        annotation_type: annotation.annotation_type || 'edit',
        notes: annotation.notes,
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Annotation created');
    return data as RecipeAnnotation;
  } catch (error) {
    console.error('❌ Error creating annotation:', error);
    throw error;
  }
}

/**
 * Batch create multiple annotations (e.g., when scaling a recipe)
 */
export async function batchCreateAnnotations(
  annotations: CreateAnnotation[]
): Promise<RecipeAnnotation[]> {
  try {
    console.log(`✏️ Creating ${annotations.length} annotations`);

    const { data, error } = await supabase
      .from('recipe_annotations')
      .insert(
        annotations.map(a => ({
          user_id: a.user_id,
          recipe_id: a.recipe_id,
          field_type: a.field_type,
          field_id: a.field_id,
          field_index: a.field_index,
          original_value: a.original_value,
          annotated_value: a.annotated_value,
          annotation_type: a.annotation_type || 'edit',
          notes: a.notes,
        }))
      )
      .select();

    if (error) throw error;

    console.log('✅ Batch annotations created');
    return data as RecipeAnnotation[];
  } catch (error) {
    console.error('❌ Error batch creating annotations:', error);
    throw error;
  }
}

// ============================================================================
// READ ANNOTATIONS
// ============================================================================

/**
 * Get all annotations for a recipe by a user
 */
export async function getRecipeAnnotations(
  userId: string,
  recipeId: string
): Promise<RecipeAnnotation[]> {
  try {
    const { data, error } = await supabase
      .from('recipe_annotations')
      .select('*')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data as RecipeAnnotation[];
  } catch (error) {
    console.error('❌ Error getting annotations:', error);
    throw error;
  }
}

/**
 * Get annotation for a specific field
 */
export async function getFieldAnnotation(
  userId: string,
  recipeId: string,
  fieldType: string,
  fieldId?: string,
  fieldIndex?: number
): Promise<RecipeAnnotation | null> {
  try {
    let query = supabase
      .from('recipe_annotations')
      .select('*')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .eq('field_type', fieldType);

    if (fieldId) {
      query = query.eq('field_id', fieldId);
    }

    if (fieldIndex !== undefined) {
      query = query.eq('field_index', fieldIndex);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No annotation found
        return null;
      }
      throw error;
    }

    return data as RecipeAnnotation;
  } catch (error) {
    console.error('❌ Error getting field annotation:', error);
    return null;
  }
}

// ============================================================================
// UPDATE ANNOTATIONS
// ============================================================================

/**
 * Update an existing annotation
 */
export async function updateAnnotation(
  annotationId: string,
  updates: {
    annotated_value?: string;
    notes?: string;
    annotation_type?: 'edit' | 'note' | 'highlight' | 'warning';
  }
): Promise<RecipeAnnotation> {
  try {
    console.log('✏️ Updating annotation:', annotationId);

    const { data, error } = await supabase
      .from('recipe_annotations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', annotationId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Annotation updated');
    return data as RecipeAnnotation;
  } catch (error) {
    console.error('❌ Error updating annotation:', error);
    throw error;
  }
}

/**
 * Upsert annotation (create if doesn't exist, update if does)
 */
export async function upsertAnnotation(
  annotation: CreateAnnotation
): Promise<RecipeAnnotation> {
  try {
    // Check if annotation exists
    const existing = await getFieldAnnotation(
      annotation.user_id,
      annotation.recipe_id,
      annotation.field_type,
      annotation.field_id,
      annotation.field_index
    );

    if (existing) {
      // Update existing
      return await updateAnnotation(existing.id, {
        annotated_value: annotation.annotated_value,
        notes: annotation.notes,
        annotation_type: annotation.annotation_type,
      });
    } else {
      // Create new
      return await createAnnotation(annotation);
    }
  } catch (error) {
    console.error('❌ Error upserting annotation:', error);
    throw error;
  }
}

// ============================================================================
// DELETE ANNOTATIONS
// ============================================================================

/**
 * Delete an annotation
 */
export async function deleteAnnotation(annotationId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting annotation:', annotationId);

    const { error } = await supabase
      .from('recipe_annotations')
      .delete()
      .eq('id', annotationId);

    if (error) throw error;

    console.log('✅ Annotation deleted');
  } catch (error) {
    console.error('❌ Error deleting annotation:', error);
    throw error;
  }
}

/**
 * Delete all annotations for a recipe by a user
 */
export async function deleteAllRecipeAnnotations(
  userId: string,
  recipeId: string
): Promise<void> {
  try {
    console.log('🗑️ Deleting all annotations for recipe');

    const { error } = await supabase
      .from('recipe_annotations')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId);

    if (error) throw error;

    console.log('✅ All annotations deleted');
  } catch (error) {
    console.error('❌ Error deleting annotations:', error);
    throw error;
  }
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

/**
 * Get user preferences for a recipe
 */
export async function getUserRecipePreferences(
  userId: string,
  recipeId: string
): Promise<UserRecipePreferences | null> {
  try {
    const { data, error } = await supabase
      .from('user_recipe_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found - return defaults
        return {
          id: '',
          user_id: userId,
          recipe_id: recipeId,
          preferred_view_mode: 'clean',
          show_section_times: true,
          auto_collapse_sections: false,
          highlight_annotations: true,
          preferred_scale: 1.0,
          hide_optional_steps: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      throw error;
    }

    return data as UserRecipePreferences;
  } catch (error) {
    console.error('❌ Error getting preferences:', error);
    return null;
  }
}

/**
 * Update user preferences for a recipe
 */
export async function updateUserRecipePreferences(
  userId: string,
  recipeId: string,
  updates: Partial<UserRecipePreferences>
): Promise<UserRecipePreferences> {
  try {
    console.log('⚙️ Updating recipe preferences');

    const { data, error } = await supabase
      .from('user_recipe_preferences')
      .upsert({
        user_id: userId,
        recipe_id: recipeId,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Preferences updated');
    return data as UserRecipePreferences;
  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    throw error;
  }
}

/**
 * Update view mode (most common preference update)
 */
export async function setViewMode(
  userId: string,
  recipeId: string,
  viewMode: ViewMode
): Promise<void> {
  try {
    await updateUserRecipePreferences(userId, recipeId, {
      preferred_view_mode: viewMode,
    });
  } catch (error) {
    console.error('❌ Error setting view mode:', error);
    throw error;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if user has any annotations for a recipe
 */
export async function hasAnnotations(
  userId: string,
  recipeId: string
): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('recipe_annotations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('recipe_id', recipeId);

    if (error) throw error;

    return (count || 0) > 0;
  } catch (error) {
    console.error('❌ Error checking annotations:', error);
    return false;
  }
}

/**
 * Get annotation count by type
 */
export async function getAnnotationStats(
  userId: string,
  recipeId: string
): Promise<{
  total: number;
  edits: number;
  notes: number;
  highlights: number;
}> {
  try {
    const annotations = await getRecipeAnnotations(userId, recipeId);

    return {
      total: annotations.length,
      edits: annotations.filter(a => a.annotation_type === 'edit').length,
      notes: annotations.filter(a => a.annotation_type === 'note').length,
      highlights: annotations.filter(a => a.annotation_type === 'highlight').length,
    };
  } catch (error) {
    console.error('❌ Error getting annotation stats:', error);
    return { total: 0, edits: 0, notes: 0, highlights: 0 };
  }
}

/**
 * Helper: Format annotated text for display
 */
export function formatAnnotatedText(
  originalValue: string,
  annotatedValue: string,
  viewMode: ViewMode
): string {
  switch (viewMode) {
    case 'original':
      return originalValue;
    case 'clean':
      return annotatedValue;
    case 'markup':
      return `~~${originalValue}~~ ${annotatedValue}`;
    default:
      return annotatedValue;
  }
}