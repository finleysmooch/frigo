// scripts/test-ingredient-mapping.ts
// Test mapIngredientsToSteps against Bulgur and Schmaltzy Rice recipes.
// Run: npx tsx scripts/test-ingredient-mapping.ts

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ── Inline types + logic from cookingService (to avoid module issues) ──

interface StepIngredient {
  name: string;
  quantity: string;
  preparation: string;
  originalText: string;
}

interface NormalizedStep {
  number: number;
  text: string;
  section?: string;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'or', 'and', 'to', 'for', 'with', 'in', 'on',
  'plus', 'extra', 'about', 'cup', 'cups', 'tsp', 'tbsp', 'tablespoon',
  'tablespoons', 'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces', 'lb',
  'lbs', 'pound', 'pounds', 'large', 'small', 'medium', 'freshly', 'ground',
  'inch', 'piece', 'pieces', 'bunch', 'whole', 'ml', 'g', 'pinch',
]);

function stemVariants(word: string): string[] {
  const variants = [word];
  if (word.endsWith('ies')) variants.push(word.slice(0, -3) + 'y');
  else if (word.endsWith('ves')) variants.push(word.slice(0, -3) + 'f');
  else if (word.endsWith('es')) variants.push(word.slice(0, -2));
  else if (word.endsWith('s') && !word.endsWith('ss')) variants.push(word.slice(0, -1));
  if (!word.endsWith('s')) variants.push(word + 's');
  return variants;
}

function extractKeywords(ingredientName: string): string[] {
  const raw = ingredientName
    .toLowerCase()
    .replace(/[(),]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/[^a-z\u00e0-\u00ff'-]/g, '').trim())
    .filter(w => w.length > 1);
  const filtered = raw.filter(w => !STOP_WORDS.has(w));
  const withVariants = new Set<string>();
  for (const kw of filtered) {
    for (const v of stemVariants(kw)) {
      if (!STOP_WORDS.has(v)) withVariants.add(v);
    }
  }
  return [...withVariants];
}

function parseIngredients(recipe: any): StepIngredient[] {
  const ingredients = recipe?.ingredients;
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) return [];
  return ingredients.map((item: any) => {
    if (typeof item === 'string') {
      return { name: item, quantity: '', preparation: '', originalText: item };
    }
    return {
      name: item.ingredient || item.name || '',
      quantity: item.quantity || '',
      preparation: item.preparation || '',
      originalText: item.original_text || item.originalText || '',
    };
  });
}

function normalizeInstructions(recipe: any): NormalizedStep[] {
  const instructions = recipe?.instructions;
  if (!instructions || !Array.isArray(instructions) || instructions.length === 0) return [];
  const first = instructions[0];
  if (typeof first === 'object' && first !== null) {
    return instructions.map((item: any, idx: number) => ({
      number: item.step ?? item.step_number ?? idx + 1,
      text: item.text ?? item.instruction ?? '',
      section: item.section ?? undefined,
    }));
  }
  if (typeof first === 'string') {
    return instructions.map((text: string, idx: number) => ({ number: idx + 1, text }));
  }
  return [];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapIngredientsToSteps(recipe: any): Map<number, StepIngredient[]> {
  const steps = normalizeInstructions(recipe);
  const ingredients = parseIngredients(recipe);
  const result = new Map<number, StepIngredient[]>();

  if (steps.length === 0 || ingredients.length === 0) return result;

  for (const step of steps) result.set(step.number, []);

  const lastStepNumber = steps[steps.length - 1].number;
  const stepTextsLower = new Map<number, string>();
  for (const step of steps) stepTextsLower.set(step.number, step.text.toLowerCase());

  for (const ingredient of ingredients) {
    const name = ingredient.name;
    if (!name) continue;

    const origLower = (ingredient.originalText || ingredient.preparation || '').toLowerCase();
    const isGarnish = /\bto (serve|garnish|finish)\b/i.test(origLower) ||
                      /\bfor (serving|garnish|garnishing)\b/i.test(origLower);

    const subNames = name.includes(' and ')
      ? name.split(/\s+and\s+/).map(s => s.trim())
      : [name];

    const allKeywords: string[][] = subNames.map(sn => extractKeywords(sn));

    let matched = false;

    for (const step of steps) {
      const stepText = stepTextsLower.get(step.number)!;
      const isMatch = allKeywords.some(keywords =>
        keywords.some(kw => {
          const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
          return regex.test(stepText);
        })
      );

      if (isMatch) {
        result.get(step.number)!.push(ingredient);
        matched = true;
      }
    }

    if (!matched && isGarnish) {
      result.get(lastStepNumber)!.push(ingredient);
    }
  }

  for (const [stepNum, ings] of result) {
    if (ings.length === 0) result.delete(stepNum);
  }

  return result;
}

// ── Test runner ──

async function main() {
  console.log('=== Ingredient-to-Step Mapping Test ===\n');

  // Test 1: Bulgur
  console.log('--- Test 1: Bulgur with mushrooms and feta ---');
  const { data: r1 } = await sb.from('recipes')
    .select('id, title, instructions, ingredients')
    .eq('id', '6f2f5544-7ac6-46c6-a975-98c2c15bab11')
    .single();

  if (r1) {
    testMapping(r1);
  } else {
    console.log('  NOT FOUND');
  }

  // Test 2: Schmaltzy Rice (18-step)
  console.log('\n--- Test 2: One-Pot Chicken & Schmaltzy Rice (18 steps) ---');
  const { data: r2 } = await sb.from('recipes')
    .select('id, title, instructions, ingredients')
    .eq('id', '07737de5-33fd-401b-9c68-dcb35f1395a9')
    .single();

  if (r2) {
    testMapping(r2);
  } else {
    console.log('  NOT FOUND');
  }
}

function testMapping(recipe: any) {
  console.log(`  Recipe: "${recipe.title}"`);

  const steps = normalizeInstructions(recipe);
  const ingredients = parseIngredients(recipe);
  console.log(`  Steps: ${steps.length}, Ingredients: ${ingredients.length}`);

  // Show keyword extraction for each ingredient
  console.log('\n  Ingredient keywords:');
  for (const ing of ingredients) {
    const subNames = ing.name.includes(' and ')
      ? ing.name.split(/\s+and\s+/).map(s => s.trim())
      : [ing.name];
    const allKeywords = subNames.map(sn => extractKeywords(sn));
    console.log(`    "${ing.name}" → ${JSON.stringify(allKeywords.flat())}`);
  }

  // Run mapping
  const mapping = mapIngredientsToSteps(recipe);

  console.log('\n  Step-by-step mapping:');
  for (const step of steps) {
    const ings = mapping.get(step.number);
    const sectionTag = step.section ? ` [${step.section}]` : '';
    console.log(`\n  Step ${step.number}${sectionTag}: ${step.text.substring(0, 70)}...`);
    if (ings && ings.length > 0) {
      for (const ing of ings) {
        console.log(`    → ${ing.name} (${ing.quantity}${ing.preparation ? ', ' + ing.preparation : ''})`);
      }
    } else {
      console.log(`    (no ingredients matched)`);
    }
  }

  // Show unmatched ingredients
  const matchedNames = new Set<string>();
  for (const ings of mapping.values()) {
    for (const ing of ings) matchedNames.add(ing.name);
  }
  const unmatched = ingredients.filter(i => !matchedNames.has(i.name));
  if (unmatched.length > 0) {
    console.log('\n  Unmatched ingredients:');
    for (const ing of unmatched) {
      console.log(`    ✗ "${ing.name}" (${ing.originalText})`);
    }
  }
}

main().catch(console.error);
