// ONE-OFF BACKFILL — NYT Import #1: recipe source-metadata foundation
// ============================================================================
// Populates the three new top-level columns (source_url, source_domain,
// external_source_id) on existing recipes that captured a source URL inside
// raw_extraction_data.source_url. Most of the corpus is book/photo-sourced
// with NO URL, so a small populated count is EXPECTED, not a failure.
//
// Mirrors deriveSourceMetadata() in
//   lib/services/recipeExtraction/recipeService.ts
// Keep the two in sync if the derivation rules change.
//
// Usage:
//   node scripts/backfill_source_metadata.mjs --dry-run   # report only, no writes
//   node scripts/backfill_source_metadata.mjs             # apply updates
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in ../.env
// ============================================================================

import { readFileSync } from 'node:fs';

const DRY_RUN = process.argv.includes('--dry-run');

// --- env -------------------------------------------------------------------
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
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

// --- derivation (mirror of recipeService.ts deriveSourceMetadata) ----------
function deriveSourceMetadata(rawUrl) {
  if (!rawUrl) {
    return { source_url: null, source_domain: null, external_source_id: null };
  }
  let cleanUrl;
  let domain;
  try {
    const u = new URL(rawUrl);
    u.search = ''; // strip query string (utm_*, etc.)
    u.hash = '';
    cleanUrl = u.toString();
    domain = u.hostname.replace('www.', ''); // matches getDomainFromUrl
  } catch {
    // Not a parseable URL — preserve raw string, flag the parse failure.
    return {
      source_url: rawUrl,
      source_domain: null,
      external_source_id: null,
      parseFailed: true,
    };
  }
  let externalSourceId = null;
  if (domain === 'cooking.nytimes.com') {
    const m = cleanUrl.match(/\/recipes\/(\d+)/);
    if (m) externalSourceId = m[1];
  }
  return { source_url: cleanUrl, source_domain: domain, external_source_id: externalSourceId };
}

// --- fetch recipes that have a source_url inside the jsonb blob ------------
async function fetchRecipesWithSourceUrl() {
  const pageSize = 1000;
  let offset = 0;
  const rows = [];
  for (;;) {
    const path =
      `recipes?select=id,title,url:raw_extraction_data->>source_url` +
      `&raw_extraction_data->>source_url=not.is.null` +
      `&order=id.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
    if (!res.ok) {
      throw new Error(`GET recipes: ${res.status} ${await res.text()}`);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

// --- total recipe count (for context) --------------------------------------
async function fetchTotalRecipeCount() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?select=id`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  });
  // content-range looks like "0-0/12345"
  const cr = res.headers.get('content-range') || '';
  const total = cr.split('/')[1];
  return total ? Number(total) : null;
}

async function updateRecipe(id, meta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      source_url: meta.source_url,
      source_domain: meta.source_domain,
      external_source_id: meta.external_source_id,
    }),
  });
  if (!res.ok) {
    throw new Error(`PATCH recipes ${id}: ${res.status} ${await res.text()}`);
  }
}

// --- main ------------------------------------------------------------------
(async () => {
  console.log(`\n=== Source-metadata backfill ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`);

  const totalRecipes = await fetchTotalRecipeCount();
  const recipes = await fetchRecipesWithSourceUrl();

  let withDomain = 0;
  let withExternalId = 0;
  const parseFailures = [];
  const nytSamples = [];

  for (const r of recipes) {
    const meta = deriveSourceMetadata(r.url);
    if (meta.parseFailed) {
      parseFailures.push({ id: r.id, title: r.title, url: r.url });
      continue; // still write source_url below — see note
    }
    if (meta.source_domain) withDomain++;
    if (meta.external_source_id) {
      withExternalId++;
      if (nytSamples.length < 5) {
        nytSamples.push({ id: r.id, url: meta.source_url, external_source_id: meta.external_source_id });
      }
    }
    if (!DRY_RUN) {
      await updateRecipe(r.id, meta);
    }
  }

  // Parse failures: source_url unparseable. We still persist the raw string so
  // the row isn't silently dropped, but get no domain/id.
  if (!DRY_RUN) {
    for (const f of parseFailures) {
      await updateRecipe(f.id, deriveSourceMetadata(f.url));
    }
  }

  console.log('--- RESULTS ---');
  console.log(`Total recipes in table:        ${totalRecipes ?? 'unknown'}`);
  console.log(`Recipes with a source_url:     ${recipes.length}`);
  console.log(`  → got source_domain:         ${withDomain}`);
  console.log(`  → got external_source_id:    ${withExternalId} (NYT cooking.nytimes.com)`);
  console.log(`  → URL parse failures:        ${parseFailures.length}`);

  if (nytSamples.length) {
    console.log('\nNYT spot-check (id / external_source_id / url):');
    for (const s of nytSamples) {
      console.log(`  ${s.id}  ${s.external_source_id}  ${s.source_url}`);
    }
  }

  if (parseFailures.length) {
    console.log('\nURLs that failed to parse:');
    for (const f of parseFailures) {
      console.log(`  ${f.id}  ${JSON.stringify(f.url)}`);
    }
  }

  console.log(`\n${DRY_RUN ? 'DRY RUN — no rows written.' : 'Backfill complete.'}\n`);
})();
