// ============================================
// FRIGO — Ingredient type re-classifier (11D family-search split)
// ============================================
// Splits the two coarse `ingredient_type` buckets that bury searchable
// culinary families:
//   • Grains  → Pasta / Rice / Grains  (+ surfaces Asian noodles for review)
//   • Seafood → Fish / Shellfish
// Traps are reassigned to their correct canonical type (e.g. "fish sauce" →
// Condiments & Sauces, "rice vinegar" → Vinegars, "rice flour" → Baking).
//
// READ-ONLY against the DB. Writes a reviewable .sql file — DOES NOT apply it.
// Tom reviews + applies the SQL manually (handoff review gate).
//
// Run with:  node scripts/classifyIngredients.mjs
//
// Canonical vocabulary is inlined below. (A formal `ingredientTaxonomy.ts`
// constant is deferred to the classifier fast-follow per
// docs/CC_PROMPT_family_search_code_2026-06-01.md.)
// ============================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// ── Locked canonical vocabulary (mirror of constants/ingredientTaxonomy.ts) ──
const CANONICAL_TYPES = [
  // Produce
  'Vegetables', 'Fruits', 'Leafy Greens', 'Fresh Herbs', 'Root Vegetables',
  'Mushrooms', 'Alliums', 'Citrus', 'Gourds',
  // Proteins
  'Red Meat', 'Poultry', 'Fish', 'Shellfish', 'Plant-Based Proteins',
  // Dairy
  'Cheese', 'Fresh Dairy', 'Cultured Dairy', 'Eggs', 'Butter',
  // Pantry
  'Spices & Dried Herbs', 'Pasta', 'Noodles', 'Rice', 'Grains',
  'Condiments & Sauces', 'Baking', 'Nuts & Seeds', 'Canned/Jarred Goods',
  'Wines & Spirits', 'Legumes', 'Oils & Fats', 'Coffee & Tea', 'Vinegars',
  'Dried Fruit', 'Stocks & Broths', 'Beverages',
];
// 'Noodles' was adopted as its own type (Tom, 2026-06-01) for Asian noodles
// (udon/soba/ramen/rice/glass/vermicelli); the model still flags is_asian_noodle.

// ── .env (manual parse; matches scripts/clone_meals_for_feed_top.mjs) ──
const envRaw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx), l.slice(idx + 1)];
    })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
if (!ANTHROPIC_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

const MODEL = 'claude-sonnet-4-6';

// ── Fetch the two coarse buckets ──
async function fetchScopeRows() {
  const path =
    'ingredients?select=id,name,plural_name,ingredient_type&ingredient_type=in.(Grains,Seafood)&order=ingredient_type,name';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Ask Claude to classify ──
async function classify(rows) {
  const system =
    'You are a precise culinary data classifier. You assign each ingredient to exactly one ' +
    'canonical ingredient_type from the provided list. Respond with ONLY a JSON array, no prose.';

  const prompt = `We are splitting two over-broad ingredient_type buckets into finer culinary families.

CANONICAL TYPES (assign exactly one per row):
${CANONICAL_TYPES.map((t) => `- ${t}`).join('\n')}

RULES:
- Rows currently typed "Grains": most are pasta shapes (→ Pasta), rice varieties (→ Rice), or true grains/farro/bulgur/quinoa/oats/polenta/couscous (→ Grains).
- Rows currently typed "Seafood": finfish (→ Fish) vs crustaceans/molluscs/shrimp/crab/clam/mussel/oyster/scallop/squid (→ Shellfish).
- TRAPS: if a row is clearly mis-filed, assign its TRUE canonical type and explain in "note". Examples: "fish sauce" → Condiments & Sauces; "rice vinegar" → Vinegars; "rice flour"/"rice paper" → Baking; "rice wine" → Wines & Spirits.
- ASIAN NOODLES (udon, soba, ramen, rice noodles, glass/cellophane noodles, vermicelli, lo mein, etc.): set "is_asian_noodle": true and put your best fallback type in new_type (Rice if rice-based, else Grains). Tom will decide whether to introduce a dedicated "Noodles" type for these.
- Set "changed": true only if new_type differs from current_type.

ROWS:
${JSON.stringify(rows.map((r) => ({ id: r.id, name: r.name, plural_name: r.plural_name, current_type: r.ingredient_type })), null, 0)}

Respond with a JSON array of objects: {"id","name","current_type","new_type","is_asian_noodle":bool,"changed":bool,"note":string}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic call failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = (data.content ?? []).map((b) => b.text ?? '').join('');
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error(`No JSON array in model output:\n${text}`);
  return JSON.parse(text.slice(start, end + 1));
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

// ── Main ──
const rows = await fetchScopeRows();
console.log(`Fetched ${rows.length} rows (Grains + Seafood).`);
const results = await classify(rows);

const valid = results.filter((r) => CANONICAL_TYPES.includes(r.new_type));
const invalid = results.filter((r) => !CANONICAL_TYPES.includes(r.new_type));
const changed = valid.filter((r) => r.changed && r.new_type !== r.current_type);
const noodles = valid.filter((r) => r.is_asian_noodle);
const traps = valid.filter(
  (r) => r.changed && !['Pasta', 'Rice', 'Grains', 'Fish', 'Shellfish'].includes(r.new_type)
);

// ── Build reviewable SQL ──
const ts = '2026-06-01';
let sql = `-- Ingredient type reclassification (11D family-search split) — ${ts}\n`;
sql += `-- Generated by scripts/classifyIngredients.mjs. REVIEW before applying.\n`;
sql += `-- Scope: rows currently typed 'Grains' or 'Seafood' (${rows.length} fetched, ${changed.length} changed).\n\n`;

const mainChanged = changed.filter((r) => !r.is_asian_noodle);
sql += `-- ── Main reassignments (${mainChanged.length}) ──\n`;
for (const r of mainChanged) {
  sql += `UPDATE ingredients SET ingredient_type='${sqlEscape(r.new_type)}' WHERE id='${r.id}';  -- ${sqlEscape(r.name)} (was ${sqlEscape(r.current_type)})${r.note ? ` [${sqlEscape(r.note)}]` : ''}\n`;
}

sql += `\n-- ── ASIAN NOODLE ROWS (${noodles.length}) — DECISION NEEDED ──\n`;
sql += `-- Below use the fallback type. To introduce a dedicated 'Noodles' type,\n`;
sql += `-- replace the SET value with 'Noodles' (and add it to the taxonomy + icons).\n`;
for (const r of noodles) {
  sql += `UPDATE ingredients SET ingredient_type='${sqlEscape(r.new_type)}' WHERE id='${r.id}';  -- ${sqlEscape(r.name)} (was ${sqlEscape(r.current_type)})${r.note ? ` [${sqlEscape(r.note)}]` : ''}\n`;
}

const outDir = new URL('./out/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const outFile = new URL(`reclassify_ingredient_types_${ts}.sql`, outDir);
writeFileSync(outFile, sql, 'utf8');

// ── Summary to stdout ──
const byType = {};
for (const r of changed) byType[r.new_type] = (byType[r.new_type] ?? 0) + 1;
console.log('\n=== SUMMARY ===');
console.log(`Total fetched: ${rows.length} | changed: ${changed.length} | unchanged: ${valid.length - changed.length}`);
console.log('New-type distribution (changed rows):');
for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${n}`);
console.log(`\nTraps (mis-filed → correct type): ${traps.length}`);
for (const r of traps) console.log(`  "${r.name}" ${r.current_type} → ${r.new_type}  [${r.note ?? ''}]`);
console.log(`\nASIAN NOODLE ROWS (decide Noodles vs ${'fallback'}): ${noodles.length}`);
for (const r of noodles) console.log(`  "${r.name}" → fallback ${r.new_type}  [${r.note ?? ''}]`);
if (invalid.length) {
  console.log(`\n⚠️  ${invalid.length} rows returned a non-canonical type (excluded from SQL):`);
  for (const r of invalid) console.log(`  "${r.name}" → "${r.new_type}"`);
}
console.log(`\nSQL written to: scripts/out/reclassify_ingredient_types_${ts}.sql`);
console.log('NOT applied. Review, decide the noodle rows, then run it against Supabase manually.');
