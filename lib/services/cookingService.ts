// lib/services/cookingService.ts
// Core cooking mode service — instruction normalization, section parsing,
// step notes CRUD, and cooking session management.
// Created: March 19, 2026
// Updated: March 19, 2026 — Step 1 Correction: handle 3 data sources

import { supabase } from '../supabase';
import {
  StepNote,
  CookingSession,
  TimerHistoryEntry,
  InstructionSection,
  StepIngredient,
  NormalizedStep,
} from '../types/cooking';

// ── Internal: DB table helpers ──────────────────────────────────────

/** Fetched row from instruction_sections + instruction_steps tables */
interface DBSectionWithSteps {
  sectionTitle: string;
  sectionOrder: number;
  steps: { stepNumber: number; instruction: string }[];
}

/**
 * Fetch section/step data from the instruction_sections + instruction_steps
 * tables for a given recipe. Returns empty array if none exist.
 */
async function fetchDBSectionSteps(recipeId: string): Promise<DBSectionWithSteps[]> {
  try {
    const { data: sections, error } = await supabase
      .from('instruction_sections')
      .select('id, section_title, section_order')
      .eq('recipe_id', recipeId)
      .order('section_order', { ascending: true });

    if (error || !sections || sections.length === 0) return [];

    const result: DBSectionWithSteps[] = [];

    for (const section of sections) {
      const { data: steps, error: stepsError } = await supabase
        .from('instruction_steps')
        .select('step_number, instruction')
        .eq('section_id', section.id)
        .order('step_number', { ascending: true });

      if (stepsError || !steps || steps.length === 0) continue;

      result.push({
        sectionTitle: section.section_title,
        sectionOrder: section.section_order,
        steps: steps.map(s => ({ stepNumber: s.step_number, instruction: s.instruction })),
      });
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Convert DB section/step rows to NormalizedStep[] with global numbering.
 * Per-section step numbers are renumbered globally:
 *   Section 1 steps 1,2 → global 1,2
 *   Section 2 steps 1,2,3 → global 3,4,5
 */
function dbSectionsToNormalizedSteps(dbSections: DBSectionWithSteps[]): NormalizedStep[] {
  const result: NormalizedStep[] = [];
  let globalStep = 1;

  for (const section of dbSections) {
    for (const step of section.steps) {
      result.push({
        number: globalStep,
        text: step.instruction,
        section: section.sectionTitle,
      });
      globalStep++;
    }
  }

  return result;
}

/**
 * Convert DB section/step rows to InstructionSection[] with global step ranges.
 */
function dbSectionsToInstructionSections(dbSections: DBSectionWithSteps[]): InstructionSection[] {
  const result: InstructionSection[] = [];
  let globalStep = 1;

  for (const section of dbSections) {
    const startStep = globalStep;
    const endStep = globalStep + section.steps.length - 1;
    globalStep = endStep + 1;

    result.push({
      name: section.sectionTitle,
      startStep,
      endStep,
    });
  }

  return result;
}

// ── Instruction Normalization ───────────────────────────────────────

/**
 * Normalize recipe instructions into a flat list of steps.
 *
 * Handles THREE data sources:
 * 1. `instructions` JSONB — plain string array OR structured {step, text, section?} objects
 * 2. DB tables (instruction_sections + instruction_steps) — for recipes where instructions = []
 *
 * For source 2, pass pre-fetched DB data via the optional `dbSections` param
 * to avoid making this function async. Use `normalizeInstructionsAsync` for
 * the auto-fetching version.
 *
 * Returns 1-indexed NormalizedStep[] regardless of input format.
 */
export function normalizeInstructions(
  recipe: any,
  dbSections?: DBSectionWithSteps[]
): NormalizedStep[] {
  const instructions = recipe?.instructions;

  // If instructions JSONB has data, use it
  if (instructions && Array.isArray(instructions) && instructions.length > 0) {
    const first = instructions[0];

    // Structured objects with step/text fields
    if (typeof first === 'object' && first !== null) {
      return instructions.map((item: any, idx: number) => ({
        number: item.step ?? item.step_number ?? idx + 1,
        text: item.text ?? item.instruction ?? '',
        section: item.section ?? undefined,
      }));
    }

    // Plain string array
    if (typeof first === 'string') {
      return instructions.map((text: string, idx: number) => ({
        number: idx + 1,
        text,
      }));
    }
  }

  // Fallback: use pre-fetched DB section/step data
  if (dbSections && dbSections.length > 0) {
    return dbSectionsToNormalizedSteps(dbSections);
  }

  return [];
}

/**
 * Async version of normalizeInstructions. Automatically fetches from
 * the DB tables if the instructions JSONB is empty.
 */
export async function normalizeInstructionsAsync(recipe: any): Promise<NormalizedStep[]> {
  // Try JSONB first (synchronous)
  const fromJsonb = normalizeInstructions(recipe);
  if (fromJsonb.length > 0) return fromJsonb;

  // Fallback: fetch from DB tables
  const dbSections = await fetchDBSectionSteps(recipe.id);
  if (dbSections.length > 0) {
    return dbSectionsToNormalizedSteps(dbSections);
  }

  return [];
}

// ── Section Parsing ─────────────────────────────────────────────────

/**
 * Get instruction sections for a recipe (async, checks all sources).
 *
 * Priority:
 * 1. `recipes.instruction_sections` JSONB column (Phase 6 format from Step 3 batch)
 * 2. `instruction_sections` + `instruction_steps` DB tables (extraction pipeline)
 * 3. Structured objects in `instructions` JSONB with `{section}` fields
 * 4. Fallback: each step = its own "Step N" section
 */
export async function getInstructionSections(recipe: any): Promise<InstructionSection[]> {
  // 1. Check Phase 6 JSONB column on the recipe row
  const jsonbSections = await getPhase6SectionsFromDB(recipe.id);
  if (jsonbSections.length > 0) {
    return jsonbSections;
  }

  // 2. Check instruction_sections + instruction_steps tables
  const dbSections = await fetchDBSectionSteps(recipe.id);
  if (dbSections.length > 0) {
    return dbSectionsToInstructionSections(dbSections);
  }

  // 3. Check structured instructions with {section} fields
  const steps = normalizeInstructions(recipe);
  if (steps.length > 0) {
    const hasSections = steps.some(s => s.section);
    if (hasSections) {
      return groupStepsBySection(steps);
    }

    // 4. Fallback: each step is its own section
    return steps.map(s => ({
      name: `Step ${s.number}`,
      startStep: s.number,
      endStep: s.number,
    }));
  }

  // steps is empty — might be a table-only recipe, already checked in #2
  return [];
}

/**
 * Synchronous version — uses only the recipe object, no DB calls.
 *
 * Checks sources: (1) recipe.instruction_sections JSONB if present on the
 * object, (3) structured instructions with {section}, (4) fallback.
 * Cannot check DB tables (source 2) — use the async version for that.
 */
export function getInstructionSectionsSync(recipe: any): InstructionSection[] {
  // 1. Check Phase 6 JSONB if it's already on the recipe object
  if (recipe?.instruction_sections && Array.isArray(recipe.instruction_sections) && recipe.instruction_sections.length > 0) {
    return recipe.instruction_sections.map((s: any) => ({
      name: s.name,
      startStep: s.startStep,
      endStep: s.endStep,
    }));
  }

  const steps = normalizeInstructions(recipe);
  if (steps.length === 0) return [];

  // 3. Structured instructions with {section} fields
  const hasSections = steps.some(s => s.section);
  if (hasSections) {
    return groupStepsBySection(steps);
  }

  // 4. Fallback
  return steps.map(s => ({
    name: `Step ${s.number}`,
    startStep: s.number,
    endStep: s.number,
  }));
}

/**
 * Query the recipes.instruction_sections JSONB column (Phase 6 format).
 * Returns [] if null or empty.
 */
async function getPhase6SectionsFromDB(recipeId: string): Promise<InstructionSection[]> {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('instruction_sections')
      .eq('id', recipeId)
      .not('instruction_sections', 'is', null)
      .single();

    if (error || !data?.instruction_sections) return [];

    const sections = data.instruction_sections;
    if (!Array.isArray(sections) || sections.length === 0) return [];

    return sections.map((s: any) => ({
      name: s.name,
      startStep: s.startStep,
      endStep: s.endStep,
    }));
  } catch {
    return [];
  }
}

/** Group consecutive steps with the same section name */
function groupStepsBySection(steps: NormalizedStep[]): InstructionSection[] {
  const sections: InstructionSection[] = [];
  let currentSectionName = steps[0].section ?? `Step ${steps[0].number}`;
  let startStep = steps[0].number;

  for (let i = 1; i < steps.length; i++) {
    const stepSection = steps[i].section ?? `Step ${steps[i].number}`;
    if (stepSection !== currentSectionName) {
      sections.push({
        name: currentSectionName,
        startStep,
        endStep: steps[i - 1].number,
      });
      currentSectionName = stepSection;
      startStep = steps[i].number;
    }
  }

  // Push last section
  sections.push({
    name: currentSectionName,
    startStep,
    endStep: steps[steps.length - 1].number,
  });

  return sections;
}

// ── Ingredient-to-Step Mapping ──────────────────────────────────────

// Words too common / generic to match on — would produce false positives
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'or', 'and', 'to', 'for', 'with', 'in', 'on',
  'plus', 'extra', 'about', 'cup', 'cups', 'tsp', 'tbsp', 'tablespoon',
  'tablespoons', 'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces', 'lb',
  'lbs', 'pound', 'pounds', 'large', 'small', 'medium', 'freshly', 'ground',
  'inch', 'piece', 'pieces', 'bunch', 'whole', 'ml', 'g', 'pinch',
]);

/**
 * Simple singular/plural stemming for food words.
 * Returns both the original and the stem to match either form.
 * "lemons" → ["lemons", "lemon"], "thighs" → ["thighs", "thigh"]
 * "peas" → ["peas", "pea"], "cloves" → ["cloves", "clove"]
 */
function stemVariants(word: string): string[] {
  const variants = [word];
  // Plural → singular
  if (word.endsWith('ies')) variants.push(word.slice(0, -3) + 'y');
  else if (word.endsWith('ves')) variants.push(word.slice(0, -3) + 'f');
  else if (word.endsWith('es')) variants.push(word.slice(0, -2));
  else if (word.endsWith('s') && !word.endsWith('ss')) variants.push(word.slice(0, -1));
  // Singular → plural
  if (!word.endsWith('s')) variants.push(word + 's');
  return variants;
}

/**
 * Extract searchable keywords from an ingredient name.
 *
 * "bone-in, skin-on chicken thighs" → ["bone-in", "skin-on", "chicken", "thighs", "thigh"]
 * "salt and black pepper" → ["salt", "black", "pepper", "peppers"]
 * "lemons" → ["lemons", "lemon"]
 */
function extractKeywords(ingredientName: string): string[] {
  // Split on spaces, commas, hyphens-keeping-hyphenated-words
  const raw = ingredientName
    .toLowerCase()
    .replace(/[(),]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/[^a-z\u00e0-\u00ff'-]/g, '').trim())
    .filter(w => w.length > 1);

  const filtered = raw.filter(w => !STOP_WORDS.has(w));

  // Add singular/plural variants for better matching
  const withVariants = new Set<string>();
  for (const kw of filtered) {
    for (const v of stemVariants(kw)) {
      if (!STOP_WORDS.has(v)) withVariants.add(v);
    }
  }

  return [...withVariants];
}

/**
 * Parse the recipe.ingredients JSONB column into a normalized list.
 * Handles both structured objects and plain strings.
 */
function parseIngredients(recipe: any): StepIngredient[] {
  const ingredients = recipe?.ingredients;
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return [];
  }

  return ingredients.map((item: any) => {
    if (typeof item === 'string') {
      return parseIngredientString(item);
    }
    // Structured object
    return {
      name: item.ingredient || item.name || '',
      quantity: item.quantity || '',
      preparation: item.preparation || '',
      originalText: item.original_text || item.originalText || '',
    };
  });
}

/** Best-effort parse of a plain ingredient string like "2 cups flour, sifted" */
function parseIngredientString(text: string): StepIngredient {
  // Try to split "quantity name, preparation" — very rough heuristic
  const commaIdx = text.indexOf(',');
  const preparation = commaIdx > -1 ? text.slice(commaIdx + 1).trim() : '';
  const beforeComma = commaIdx > -1 ? text.slice(0, commaIdx) : text;

  // Leading quantity pattern: digits/fractions, optional unit, then ingredient name
  const qtyMatch = beforeComma.match(
    /^([\d½¼¾⅓⅔⅛/.\s]+(?:cup|cups|tsp|tbsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|ml|g|bunch|pinch|large|small|medium)?s?\b)\s+(.+)/i
  );

  if (qtyMatch) {
    return {
      name: qtyMatch[2].trim(),
      quantity: qtyMatch[1].trim(),
      preparation,
      originalText: text,
    };
  }

  return { name: beforeComma.trim(), quantity: '', preparation, originalText: text };
}

/**
 * Map ingredients to steps by text matching.
 *
 * Returns Map<stepNumber, StepIngredient[]> (1-indexed step numbers).
 * Ingredients may appear in multiple steps.
 * Ingredients that don't match any step are not force-mapped.
 */
export function mapIngredientsToSteps(recipe: any): Map<number, StepIngredient[]> {
  const steps = normalizeInstructions(recipe);
  const ingredients = parseIngredients(recipe);
  const result = new Map<number, StepIngredient[]>();

  if (steps.length === 0 || ingredients.length === 0) return result;

  // Initialize empty arrays
  for (const step of steps) {
    result.set(step.number, []);
  }

  const lastStepNumber = steps[steps.length - 1].number;

  // Pre-lowercase all step texts for matching
  const stepTextsLower = new Map<number, string>();
  for (const step of steps) {
    stepTextsLower.set(step.number, step.text.toLowerCase());
  }

  for (const ingredient of ingredients) {
    const name = ingredient.name;
    if (!name) continue;

    // Check if this is a "to serve" / "to garnish" ingredient
    const origLower = (ingredient.originalText || ingredient.preparation || '').toLowerCase();
    const isGarnish = /\bto (serve|garnish|finish)\b/i.test(origLower) ||
                      /\bfor (serving|garnish|garnishing)\b/i.test(origLower);

    // Handle compound ingredients like "salt and black pepper"
    // Split into sub-ingredients on " and "
    const subNames = name.includes(' and ')
      ? name.split(/\s+and\s+/).map(s => s.trim())
      : [name];

    // Collect all keyword sets for this ingredient (one per sub-name)
    const allKeywords: string[][] = subNames.map(sn => extractKeywords(sn));

    let matched = false;

    for (const step of steps) {
      const stepText = stepTextsLower.get(step.number)!;

      // Check if any keyword set matches
      const isMatch = allKeywords.some(keywords =>
        keywords.some(kw => {
          // Word boundary match: look for the keyword as a whole word
          const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
          return regex.test(stepText);
        })
      );

      if (isMatch) {
        result.get(step.number)!.push(ingredient);
        matched = true;
      }
    }

    // If it's a garnish ingredient and didn't match anything, map to last step
    if (!matched && isGarnish) {
      result.get(lastStepNumber)!.push(ingredient);
    }
  }

  // Remove empty entries
  for (const [stepNum, ings] of result) {
    if (ings.length === 0) result.delete(stepNum);
  }

  return result;
}

/**
 * Async version that also handles table-only recipes (instructions = []).
 */
export async function mapIngredientsToStepsAsync(recipe: any): Promise<Map<number, StepIngredient[]>> {
  // If instructions JSONB has data, use sync version
  if (recipe?.instructions && Array.isArray(recipe.instructions) && recipe.instructions.length > 0) {
    return mapIngredientsToSteps(recipe);
  }

  // For table-only recipes, fetch steps from DB and build a synthetic recipe object
  const dbSections = await fetchDBSectionSteps(recipe.id);
  if (dbSections.length > 0) {
    const syntheticRecipe = {
      ...recipe,
      instructions: dbSectionsToNormalizedSteps(dbSections).map(s => ({
        step: s.number,
        text: s.text,
        section: s.section,
      })),
    };
    return mapIngredientsToSteps(syntheticRecipe);
  }

  return new Map();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Step Notes CRUD ─────────────────────────────────────────────────

/**
 * Get all step notes for a recipe by a given user.
 */
export async function getStepNotes(
  recipeId: string,
  userId: string
): Promise<StepNote[]> {
  const { data, error } = await supabase
    .from('recipe_step_notes')
    .select('*')
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .order('step_number', { ascending: true });

  if (error) {
    console.error('Error fetching step notes:', error);
    return [];
  }

  return data || [];
}

/**
 * Create or update a step note. Uses upsert on (user_id, recipe_id, step_number).
 */
export async function upsertStepNote(
  userId: string,
  recipeId: string,
  stepNumber: number,
  noteText: string
): Promise<StepNote | null> {
  const { data, error } = await supabase
    .from('recipe_step_notes')
    .upsert(
      {
        user_id: userId,
        recipe_id: recipeId,
        step_number: stepNumber,
        note_text: noteText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,recipe_id,step_number' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting step note:', error);
    return null;
  }

  return data;
}

/**
 * Delete a step note by ID.
 */
export async function deleteStepNote(noteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('recipe_step_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    console.error('Error deleting step note:', error);
    return false;
  }

  return true;
}

// ── Cooking Sessions ────────────────────────────────────────────────

/**
 * Start a new cooking session.
 */
export async function startCookingSession(
  userId: string,
  recipeId: string,
  totalSteps: number
): Promise<CookingSession | null> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .insert({
      user_id: userId,
      recipe_id: recipeId,
      started_at: new Date().toISOString(),
      timer_history: [],
      steps_completed: 0,
      total_steps: totalSteps,
      view_mode: 'step_by_step',
    })
    .select()
    .single();

  if (error) {
    console.error('Error starting cooking session:', error);
    return null;
  }

  return data;
}

/**
 * Update how many steps have been completed in a session.
 */
export async function updateSessionProgress(
  sessionId: string,
  stepsCompleted: number
): Promise<boolean> {
  const { error } = await supabase
    .from('cooking_sessions')
    .update({ steps_completed: stepsCompleted })
    .eq('id', sessionId);

  if (error) {
    console.error('Error updating session progress:', error);
    return false;
  }

  return true;
}

/**
 * Mark a cooking session as complete with timer history.
 */
export async function completeCookingSession(
  sessionId: string,
  timerHistory: TimerHistoryEntry[]
): Promise<boolean> {
  const { error } = await supabase
    .from('cooking_sessions')
    .update({
      completed_at: new Date().toISOString(),
      timer_history: timerHistory,
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error completing cooking session:', error);
    return false;
  }

  return true;
}

/**
 * Get all cooking sessions for a user + recipe, most recent first.
 */
export async function getSessionHistory(
  userId: string,
  recipeId: string
): Promise<CookingSession[]> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching session history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get how many times a user has cooked a recipe (completed sessions).
 */
export async function getCookCount(
  userId: string,
  recipeId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('cooking_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .not('completed_at', 'is', null);

  if (error) {
    console.error('Error fetching cook count:', error);
    return 0;
  }

  return count ?? 0;
}
