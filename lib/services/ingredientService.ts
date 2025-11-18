// lib/services/ingredientService.ts
// CRUD operations for ingredients table

import { supabase } from '../supabase';
import { IngredientSuggestion } from './ingredientSuggestionService';

export interface Ingredient {
  id: string;
  name: string;
  plural_name: string | null;
  family: string;
  ingredient_type: string | null;
  ingredient_subtype: string | null;
  typical_unit: string | null;
  typical_store_section: string | null;
  form: string | null;
  created_at: string;
}

export interface CreateIngredientInput {
  name: string;
  plural_name?: string | null;
  family: string;
  ingredient_type?: string | null;
  ingredient_subtype?: string | null;
  typical_unit?: string | null;
  typical_store_section?: string | null;
  form?: string | null;
}

/**
 * Create a new ingredient in the database
 */
export async function createIngredient(
  ingredient: CreateIngredientInput
): Promise<string> {
  try {
    console.log(`📝 Creating ingredient: ${ingredient.name}`);

    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        name: ingredient.name,
        plural_name: ingredient.plural_name || null,
        family: ingredient.family,
        ingredient_type: ingredient.ingredient_type || null,
        ingredient_subtype: ingredient.ingredient_subtype || null,
        typical_unit: ingredient.typical_unit || null,
        typical_store_section: ingredient.typical_store_section || null,
        form: ingredient.form || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error creating ingredient:', error);
      throw new Error(`Failed to create ingredient: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from ingredient creation');
    }

    console.log(`✅ Ingredient created with ID: ${data.id}`);
    return data.id;

  } catch (error: any) {
    console.error('❌ Failed to create ingredient:', error);
    throw error;
  }
}

/**
 * Create multiple ingredients from AI suggestions
 */
export async function createIngredientsFromSuggestions(
  suggestions: IngredientSuggestion[]
): Promise<{ id: string; name: string }[]> {
  try {
    console.log(`📝 Creating ${suggestions.length} ingredients...`);

    const ingredientsToCreate = suggestions.map(s => ({
      name: s.name,
      plural_name: s.plural_name || null,
      family: s.family,
      ingredient_type: s.ingredient_type || null,
      ingredient_subtype: s.ingredient_subtype || null,
      typical_unit: s.typical_unit || null,
      typical_store_section: s.typical_store_section || null,
      form: s.form || null,
    }));

    const { data, error } = await supabase
      .from('ingredients')
      .insert(ingredientsToCreate)
      .select('id, name');

    if (error) {
      console.error('❌ Error creating ingredients:', error);
      throw new Error(`Failed to create ingredients: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No data returned from bulk ingredient creation');
    }

    console.log(`✅ Created ${data.length} ingredients`);
    return data;

  } catch (error: any) {
    console.error('❌ Failed to create ingredients:', error);
    throw error;
  }
}

/**
 * Search for ingredient by name (case-insensitive, fuzzy)
 */
export async function searchIngredientByName(
  name: string
): Promise<Ingredient | null> {
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('❌ Error searching ingredient:', error);
      throw error;
    }

    return data || null;

  } catch (error: any) {
    console.error('❌ Failed to search ingredient:', error);
    return null;
  }
}

/**
 * Check if ingredient already exists by exact name
 */
export async function ingredientExists(name: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('id')
      .ilike('name', name)
      .limit(1);

    if (error) {
      console.error('❌ Error checking ingredient existence:', error);
      return false;
    }

    return data && data.length > 0;

  } catch (error) {
    console.error('❌ Failed to check ingredient existence:', error);
    return false;
  }
}

/**
 * Get ingredient by ID
 */
export async function getIngredientById(id: string): Promise<Ingredient | null> {
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching ingredient:', error);
      return null;
    }

    return data;

  } catch (error) {
    console.error('❌ Failed to fetch ingredient:', error);
    return null;
  }
}

/**
 * Get all ingredients (for dropdown/selection)
 */
export async function getAllIngredients(): Promise<Ingredient[]> {
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('name');

    if (error) {
      console.error('❌ Error fetching ingredients:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('❌ Failed to fetch ingredients:', error);
    return [];
  }
}