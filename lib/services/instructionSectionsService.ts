// services/instructionSectionsService.ts
// Service functions for managing recipe instruction sections
// Created: November 11, 2025

import { supabase } from '../supabase';
import {
  InstructionSection,
  InstructionStep,
  ExtractedInstructionSection,
} from '../types/recipeExtraction';

// ============================================================================
// CREATE SECTIONS (During Recipe Extraction)
// ============================================================================

/**
 * Save instruction sections for a recipe (called during extraction)
 */
export async function saveInstructionSections(
  recipeId: string,
  sections: ExtractedInstructionSection[]
): Promise<void> {
  try {
    console.log(`📝 Saving ${sections.length} instruction sections for recipe ${recipeId}`);

    for (const section of sections) {
      // 1. Create the section
      const { data: sectionData, error: sectionError } = await supabase
        .from('instruction_sections')
        .insert({
          recipe_id: recipeId,
          section_title: section.section_title,
          section_description: section.section_description,
          section_order: section.section_order,
          estimated_time_min: section.estimated_time_min,
        })
        .select()
        .single();

      if (sectionError) throw sectionError;

      // 2. Create all steps
      const stepsToInsert = section.steps.map(step => ({
        section_id: sectionData.id,
        step_number: step.step_number,
        instruction: step.instruction,
        is_optional: step.is_optional || false,
        is_time_sensitive: step.is_time_sensitive || false,
      }));

      const { error: stepsError } = await supabase
        .from('instruction_steps')
        .insert(stepsToInsert);

      if (stepsError) throw stepsError;
    }

    console.log('✅ All instruction sections saved');
  } catch (error) {
    console.error('❌ Error saving sections:', error);
    throw error;
  }
}

/**
 * Get all instruction sections for a recipe
 */
export async function getInstructionSections(
  recipeId: string
): Promise<InstructionSection[]> {
  try {
    const { data: sections, error: sectionsError } = await supabase
      .from('instruction_sections')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('section_order', { ascending: true });

    if (sectionsError) throw sectionsError;
    if (!sections) return [];

    const sectionsWithSteps: InstructionSection[] = [];

    for (const section of sections) {
      const { data: steps, error: stepsError } = await supabase
        .from('instruction_steps')
        .select('*')
        .eq('section_id', section.id)
        .order('step_number', { ascending: true });

      if (stepsError) throw stepsError;

      sectionsWithSteps.push({
        ...section,
        steps: steps || [],
      } as InstructionSection);
    }

    return sectionsWithSteps;
  } catch (error) {
    console.error('❌ Error getting sections:', error);
    throw error;
  }
}