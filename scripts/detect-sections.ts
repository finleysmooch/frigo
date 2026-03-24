// scripts/detect-sections.ts
// Phase 6 Step 3: Batch job to populate recipes.instruction_sections JSONB
// for all 475 recipes.
//
// Categories:
//   1. Table-only (instructions=[]) — convert from DB instruction_sections table
//   2. With {section} fields — parse from instructions JSONB
//   3. Short ≤3 steps — trivial "Step N" sections
//   4. Long 4+ steps — Claude Haiku AI grouping
//
// Run: npx tsx scripts/detect-sections.ts
// Flags:
//   --dry-run     Log what would be done, don't write to DB
//   --ai-only     Only process category 4 (AI recipes)
//   --no-ai       Skip category 4

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const DRY_RUN = process.argv.includes('--dry-run');
const AI_ONLY = process.argv.includes('--ai-only');
const NO_AI = process.argv.includes('--no-ai');

interface Section {
  name: string;
  startStep: number;
  endStep: number;
}

// ── Stats ──
const stats = {
  tableOnly: { total: 0, success: 0, failed: 0 },
  sectionField: { total: 0, success: 0, failed: 0 },
  shortRecipes: { total: 0, success: 0, failed: 0 },
  aiRecipes: { total: 0, success: 0, failed: 0 },
  failedIds: [] as { id: string; title: string; reason: string }[],
};

// ── Main ──
async function main() {
  console.log(`=== Section Detection Batch Job ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${AI_ONLY ? ' (AI only)' : ''}${NO_AI ? ' (no AI)' : ''}\n`);

  // Fetch all recipes needing sections
  const { data: recipes, error } = await sb.from('recipes')
    .select('id, title, instructions')
    .is('instruction_sections', null)
    .order('title');

  if (error || !recipes) {
    console.error('Failed to fetch recipes:', error);
    return;
  }

  console.log(`Recipes needing sections: ${recipes.length}\n`);

  // Categorize
  const tableOnly: typeof recipes = [];
  const withSectionField: typeof recipes = [];
  const shortRecipes: typeof recipes = [];
  const longRecipes: typeof recipes = [];

  for (const r of recipes) {
    const instr = r.instructions;
    if (!instr || !Array.isArray(instr) || instr.length === 0) {
      tableOnly.push(r);
    } else if (typeof instr[0] === 'object' && instr.some((s: any) => s.section)) {
      withSectionField.push(r);
    } else if (instr.length <= 3) {
      shortRecipes.push(r);
    } else {
      longRecipes.push(r);
    }
  }

  console.log(`Categories:`);
  console.log(`  1. Table-only: ${tableOnly.length}`);
  console.log(`  2. With section fields: ${withSectionField.length}`);
  console.log(`  3. Short ≤3 steps: ${shortRecipes.length}`);
  console.log(`  4. Long 4+ steps (AI): ${longRecipes.length}\n`);

  // Process each category
  if (!AI_ONLY) {
    await processTableOnly(tableOnly);
    await processSectionField(withSectionField);
    await processShortRecipes(shortRecipes);
  }

  if (!NO_AI) {
    await processWithAI(longRecipes);
  }

  // Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`Table-only:    ${stats.tableOnly.success}/${stats.tableOnly.total} success`);
  console.log(`Section field: ${stats.sectionField.success}/${stats.sectionField.total} success`);
  console.log(`Short recipes: ${stats.shortRecipes.success}/${stats.shortRecipes.total} success`);
  console.log(`AI recipes:    ${stats.aiRecipes.success}/${stats.aiRecipes.total} success`);

  const totalSuccess = stats.tableOnly.success + stats.sectionField.success +
    stats.shortRecipes.success + stats.aiRecipes.success;
  const totalProcessed = stats.tableOnly.total + stats.sectionField.total +
    stats.shortRecipes.total + stats.aiRecipes.total;
  console.log(`\nTotal: ${totalSuccess}/${totalProcessed} success`);

  if (stats.failedIds.length > 0) {
    console.log(`\nFailed recipes (${stats.failedIds.length}):`);
    for (const f of stats.failedIds) {
      console.log(`  ${f.id.substring(0, 8)} "${f.title}" — ${f.reason}`);
    }
  }

  // Verification query
  console.log(`\n=== VERIFICATION ===`);
  const { count: totalRecipes } = await sb.from('recipes').select('id', { count: 'exact', head: true });
  const { count: hasSections } = await sb.from('recipes').select('id', { count: 'exact', head: true })
    .not('instruction_sections', 'is', null);
  console.log(`Total recipes: ${totalRecipes}`);
  console.log(`Has instruction_sections: ${hasSections}`);
  console.log(`Missing: ${(totalRecipes ?? 0) - (hasSections ?? 0)}`);
}

// ── Category 1: Table-only recipes ──
async function processTableOnly(recipes: any[]) {
  console.log(`\n--- Processing ${recipes.length} table-only recipes ---`);
  stats.tableOnly.total = recipes.length;

  for (const recipe of recipes) {
    try {
      // Fetch from instruction_sections + instruction_steps tables
      const { data: dbSections } = await sb.from('instruction_sections')
        .select('id, section_title, section_order')
        .eq('recipe_id', recipe.id)
        .order('section_order', { ascending: true });

      if (!dbSections || dbSections.length === 0) {
        stats.failedIds.push({ id: recipe.id, title: recipe.title, reason: 'No DB sections found' });
        stats.tableOnly.failed++;
        continue;
      }

      const sections: Section[] = [];
      let globalStep = 1;

      for (const sec of dbSections) {
        const { data: steps } = await sb.from('instruction_steps')
          .select('step_number')
          .eq('section_id', sec.id)
          .order('step_number', { ascending: true });

        const stepCount = steps?.length ?? 0;
        if (stepCount === 0) continue;

        sections.push({
          name: sec.section_title,
          startStep: globalStep,
          endStep: globalStep + stepCount - 1,
        });
        globalStep += stepCount;
      }

      if (sections.length === 0) {
        stats.failedIds.push({ id: recipe.id, title: recipe.title, reason: 'DB sections had no steps' });
        stats.tableOnly.failed++;
        continue;
      }

      await writeSection(recipe.id, recipe.title, sections);
      stats.tableOnly.success++;
    } catch (e: any) {
      stats.failedIds.push({ id: recipe.id, title: recipe.title, reason: e.message });
      stats.tableOnly.failed++;
    }
  }
}

// ── Category 2: Recipes with {section} fields in instructions ──
async function processSectionField(recipes: any[]) {
  console.log(`\n--- Processing ${recipes.length} recipes with section fields ---`);
  stats.sectionField.total = recipes.length;

  for (const recipe of recipes) {
    try {
      const instructions = recipe.instructions;
      const sections: Section[] = [];
      let currentSection = instructions[0].section || 'Main';
      let startStep = instructions[0].step ?? 1;

      for (let i = 1; i < instructions.length; i++) {
        const stepSection = instructions[i].section || 'Main';
        const stepNum = instructions[i].step ?? (i + 1);

        if (stepSection !== currentSection) {
          const prevStep = instructions[i - 1].step ?? i;
          sections.push({ name: currentSection, startStep, endStep: prevStep });
          currentSection = stepSection;
          startStep = stepNum;
        }
      }

      // Push last section
      const lastStep = instructions[instructions.length - 1].step ?? instructions.length;
      sections.push({ name: currentSection, startStep, endStep: lastStep });

      await writeSection(recipe.id, recipe.title, sections);
      stats.sectionField.success++;
    } catch (e: any) {
      stats.failedIds.push({ id: recipe.id, title: recipe.title, reason: e.message });
      stats.sectionField.failed++;
    }
  }
}

// ── Category 3: Short recipes (≤3 steps) ──
async function processShortRecipes(recipes: any[]) {
  console.log(`\n--- Processing ${recipes.length} short recipes (≤3 steps) ---`);
  stats.shortRecipes.total = recipes.length;

  for (const recipe of recipes) {
    try {
      const instructions = recipe.instructions;
      const sections: Section[] = instructions.map((item: any, idx: number) => {
        const stepNum = (typeof item === 'object' ? (item.step ?? idx + 1) : idx + 1);
        return { name: `Step ${stepNum}`, startStep: stepNum, endStep: stepNum };
      });

      await writeSection(recipe.id, recipe.title, sections);
      stats.shortRecipes.success++;
    } catch (e: any) {
      stats.failedIds.push({ id: recipe.id, title: recipe.title, reason: e.message });
      stats.shortRecipes.failed++;
    }
  }
}

// ── Category 4: Long recipes (4+ steps, needs AI) ──
async function processWithAI(recipes: any[]) {
  console.log(`\n--- Processing ${recipes.length} long recipes with Claude Haiku ---`);
  stats.aiRecipes.total = recipes.length;

  // Process in batches of 5 with a small delay between batches
  const BATCH_SIZE = 5;
  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);
    const promises = batch.map(r => processOneWithAI(r));
    await Promise.all(promises);

    const processed = Math.min(i + BATCH_SIZE, recipes.length);
    if (processed % 50 === 0 || processed === recipes.length) {
      console.log(`  Progress: ${processed}/${recipes.length} (${stats.aiRecipes.success} success, ${stats.aiRecipes.failed} failed)`);
    }

    // Small delay between batches to be nice to the API
    if (i + BATCH_SIZE < recipes.length) {
      await sleep(200);
    }
  }
}

async function processOneWithAI(recipe: any): Promise<void> {
  try {
    const instructions = recipe.instructions;
    const stepsText = instructions.map((item: any, idx: number) => {
      const num = typeof item === 'object' ? (item.step ?? idx + 1) : idx + 1;
      const text = typeof item === 'string' ? item : (item.text ?? item.instruction ?? '');
      return `${num}. ${text}`;
    }).join('\n');

    const totalSteps = instructions.length;

    const prompt = `Given these recipe instructions, group them into logical cooking sections.
Each section should be a continuous sequence of related steps (e.g., all prep work,
all steps for cooking the sauce, etc.). Sections should have short, descriptive names
like "Prep the vegetables", "Make the sauce", "Cook the pasta", "Assemble and serve".

Recipe: ${recipe.title}
Instructions:
${stepsText}

Return ONLY a JSON array, no other text:
[{"name": "Section Name", "startStep": 1, "endStep": 3}, ...]

Rules:
- Every step must belong to exactly one section
- Sections must be consecutive (no gaps or overlaps)
- startStep and endStep are 1-indexed and inclusive
- Use 2-4 word section names
- A section can be a single step if it's a distinct phase`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`API ${resp.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text) throw new Error('Empty API response');

    // Parse JSON — handle potential markdown wrapping
    let jsonText = text;
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const sections: Section[] = JSON.parse(jsonText);

    // Validate
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new Error('Parsed result is not a non-empty array');
    }

    // Validate coverage: every step must be covered, no gaps/overlaps
    const firstStep = typeof instructions[0] === 'object' ? (instructions[0].step ?? 1) : 1;
    const lastStep = typeof instructions[0] === 'object'
      ? (instructions[instructions.length - 1].step ?? totalSteps)
      : totalSteps;

    if (sections[0].startStep !== firstStep) {
      throw new Error(`First section starts at ${sections[0].startStep}, expected ${firstStep}`);
    }
    if (sections[sections.length - 1].endStep !== lastStep) {
      throw new Error(`Last section ends at ${sections[sections.length - 1].endStep}, expected ${lastStep}`);
    }

    for (let i = 1; i < sections.length; i++) {
      if (sections[i].startStep !== sections[i - 1].endStep + 1) {
        throw new Error(`Gap/overlap between section ${i} and ${i + 1}`);
      }
    }

    await writeSection(recipe.id, recipe.title, sections);
    stats.aiRecipes.success++;
  } catch (e: any) {
    stats.failedIds.push({ id: recipe.id, title: recipe.title, reason: e.message });
    stats.aiRecipes.failed++;
  }
}

// ── Write to DB ──
async function writeSection(recipeId: string, title: string, sections: Section[]) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] ${title.substring(0, 50)}: ${sections.length} sections`);
    return;
  }

  const { error } = await sb.from('recipes')
    .update({ instruction_sections: sections })
    .eq('id', recipeId);

  if (error) {
    throw new Error(`DB write failed: ${error.message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
