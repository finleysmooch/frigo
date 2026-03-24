// scripts/test-cooking-service.ts
// Step 1 Correction: verify normalizeInstructions and getInstructionSections
// against all 4 required test recipes covering all 3 data sources.
//
// Run: npx tsx scripts/test-cooking-service.ts

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

// Use service role key to bypass RLS for testing
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Inlined types + functions (mirrors cookingService.ts) ───────────

interface NormalizedStep {
  number: number;
  text: string;
  section?: string;
}

interface InstructionSection {
  name: string;
  startStep: number;
  endStep: number;
}

interface DBSectionWithSteps {
  sectionTitle: string;
  sectionOrder: number;
  steps: { stepNumber: number; instruction: string }[];
}

async function fetchDBSectionSteps(recipeId: string): Promise<DBSectionWithSteps[]> {
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
}

function dbSectionsToNormalizedSteps(dbSections: DBSectionWithSteps[]): NormalizedStep[] {
  const result: NormalizedStep[] = [];
  let globalStep = 1;
  for (const section of dbSections) {
    for (const step of section.steps) {
      result.push({ number: globalStep, text: step.instruction, section: section.sectionTitle });
      globalStep++;
    }
  }
  return result;
}

function dbSectionsToInstructionSections(dbSections: DBSectionWithSteps[]): InstructionSection[] {
  const result: InstructionSection[] = [];
  let globalStep = 1;
  for (const section of dbSections) {
    const startStep = globalStep;
    const endStep = globalStep + section.steps.length - 1;
    globalStep = endStep + 1;
    result.push({ name: section.sectionTitle, startStep, endStep });
  }
  return result;
}

function normalizeInstructions(recipe: any, dbSections?: DBSectionWithSteps[]): NormalizedStep[] {
  const instructions = recipe?.instructions;
  if (instructions && Array.isArray(instructions) && instructions.length > 0) {
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
  }
  if (dbSections && dbSections.length > 0) {
    return dbSectionsToNormalizedSteps(dbSections);
  }
  return [];
}

async function normalizeInstructionsAsync(recipe: any): Promise<NormalizedStep[]> {
  const fromJsonb = normalizeInstructions(recipe);
  if (fromJsonb.length > 0) return fromJsonb;
  const dbSections = await fetchDBSectionSteps(recipe.id);
  if (dbSections.length > 0) return dbSectionsToNormalizedSteps(dbSections);
  return [];
}

function groupStepsBySection(steps: NormalizedStep[]): InstructionSection[] {
  const sections: InstructionSection[] = [];
  let currentSectionName = steps[0].section ?? `Step ${steps[0].number}`;
  let startStep = steps[0].number;
  for (let i = 1; i < steps.length; i++) {
    const stepSection = steps[i].section ?? `Step ${steps[i].number}`;
    if (stepSection !== currentSectionName) {
      sections.push({ name: currentSectionName, startStep, endStep: steps[i - 1].number });
      currentSectionName = stepSection;
      startStep = steps[i].number;
    }
  }
  sections.push({ name: currentSectionName, startStep, endStep: steps[steps.length - 1].number });
  return sections;
}

async function getPhase6SectionsFromDB(recipeId: string): Promise<InstructionSection[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('instruction_sections')
    .eq('id', recipeId)
    .not('instruction_sections', 'is', null)
    .single();

  if (error || !data?.instruction_sections) return [];
  const sections = data.instruction_sections;
  if (!Array.isArray(sections) || sections.length === 0) return [];
  return sections.map((s: any) => ({ name: s.name, startStep: s.startStep, endStep: s.endStep }));
}

async function getInstructionSections(recipe: any): Promise<InstructionSection[]> {
  // 1. Phase 6 JSONB column
  const jsonbSections = await getPhase6SectionsFromDB(recipe.id);
  if (jsonbSections.length > 0) return jsonbSections;

  // 2. DB tables
  const dbSections = await fetchDBSectionSteps(recipe.id);
  if (dbSections.length > 0) return dbSectionsToInstructionSections(dbSections);

  // 3. Structured instructions with {section} fields
  const steps = normalizeInstructions(recipe);
  if (steps.length > 0) {
    const hasSections = steps.some(s => s.section);
    if (hasSections) return groupStepsBySection(steps);
    // 4. Fallback
    return steps.map(s => ({ name: `Step ${s.number}`, startStep: s.number, endStep: s.number }));
  }

  return [];
}

// ── Test runner ─────────────────────────────────────────────────────

async function main() {
  console.log('=== Cooking Service Test (Step 1 Correction) ===\n');

  // Test 1: Plain string — Roasted Cauliflower
  console.log('--- Test 1: Plain string instructions ---');
  const { data: r1 } = await supabase
    .from('recipes')
    .select('id, title, instructions, book_id, instruction_sections')
    .ilike('title', '%Roasted Cauliflower%Date%')
    .limit(1);

  if (r1 && r1.length > 0) {
    await testRecipe(r1[0], 'Plain string (Cauliflower)');
  } else {
    console.log('  NOT FOUND');
  }

  // Test 2: Structured with sections — 18-step Schmaltzy Rice (Cook This Book)
  console.log('\n--- Test 2: Structured objects with sections (18-step Schmaltzy) ---');
  const { data: r2 } = await supabase
    .from('recipes')
    .select('id, title, instructions, book_id, instruction_sections')
    .eq('id', '07737de5-33fd-401b-9c68-dcb35f1395a9')
    .single();

  if (r2) {
    await testRecipe(r2, 'Schmaltzy Rice (Cook This Book)');
  } else {
    // fallback: search by title + book_id
    const { data: r2b } = await supabase
      .from('recipes')
      .select('id, title, instructions, book_id, instruction_sections')
      .ilike('title', '%schmaltzy%')
      .not('book_id', 'is', null)
      .limit(1);
    if (r2b && r2b.length > 0) {
      await testRecipe(r2b[0], 'Schmaltzy Rice (fallback search)');
    } else {
      console.log('  NOT FOUND');
    }
  }

  // Test 3: Table-only recipe — Almond Butter Oatmeal Cups
  console.log('\n--- Test 3: Table-only recipe (instructions = []) ---');
  const { data: r3 } = await supabase
    .from('recipes')
    .select('id, title, instructions, book_id, instruction_sections')
    .eq('id', '122263d6-0e96-4d31-aec2-3b117e5864c7')
    .single();

  if (r3) {
    await testRecipe(r3, 'Almond Butter Oatmeal Cups (table-only)');
  } else {
    console.log('  NOT FOUND');
  }

  // Test 4: Structured objects WITHOUT sections — Bulgur
  console.log('\n--- Test 4: Structured objects, no sections (Bulgur) ---');
  const { data: r4 } = await supabase
    .from('recipes')
    .select('id, title, instructions, book_id, instruction_sections')
    .eq('id', '6f2f5544-7ac6-46c6-a975-98c2c15bab11')
    .single();

  if (r4) {
    await testRecipe(r4, 'Bulgur (structured, no sections)');
  } else {
    console.log('  NOT FOUND');
  }
}

async function testRecipe(recipe: any, label: string) {
  console.log(`\n[${label}]`);
  console.log(`  Title: "${recipe.title}"`);
  console.log(`  ID: ${recipe.id}`);
  console.log(`  book_id: ${recipe.book_id || 'none'}`);

  const instrArr = recipe.instructions;
  const instrLen = Array.isArray(instrArr) ? instrArr.length : 0;
  const instrType = instrLen > 0 ? typeof instrArr[0] : 'empty/missing';
  console.log(`  instructions JSONB: ${instrLen} items, format: ${instrType}`);
  console.log(`  instruction_sections JSONB: ${recipe.instruction_sections ? JSON.stringify(recipe.instruction_sections).substring(0, 80) : 'null'}`);

  if (instrType === 'object' && instrLen > 0) {
    console.log(`  Sample object keys: ${Object.keys(instrArr[0]).join(', ')}`);
    console.log(`  Sample[0]: ${JSON.stringify(instrArr[0]).substring(0, 120)}`);
    if (instrArr[0].section) {
      // Show unique sections
      const uniqueSections = [...new Set(instrArr.map((i: any) => i.section).filter(Boolean))];
      console.log(`  Unique section values: ${JSON.stringify(uniqueSections)}`);
    }
  }

  // normalizeInstructionsAsync (handles all sources including DB tables)
  const normalized = await normalizeInstructionsAsync(recipe);
  console.log(`\n  normalizeInstructions → ${normalized.length} steps`);
  for (const s of normalized) {
    const sectionTag = s.section ? ` [${s.section}]` : '';
    console.log(`    Step ${s.number}${sectionTag}: ${s.text.substring(0, 80)}${s.text.length > 80 ? '...' : ''}`);
  }

  // getInstructionSections (async, checks all 4 priority sources)
  const sections = await getInstructionSections(recipe);
  console.log(`\n  getInstructionSections → ${sections.length} sections`);
  for (const sec of sections) {
    const stepRange = sec.startStep === sec.endStep ? `step ${sec.startStep}` : `steps ${sec.startStep}-${sec.endStep}`;
    console.log(`    "${sec.name}" → ${stepRange}`);
  }
}

main().catch(console.error);
