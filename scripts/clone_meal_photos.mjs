// Follow-up: copy meal_photos rows from the source meals to the clones
// created by clone_meals_for_feed_top.mjs.

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

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

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function pgrstGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function pgrstInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`INSERT ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Source → clone mapping (from the previous clone run)
const PAIRS = [
  {
    source: '55da1828-0e84-4b88-bd65-15e5fd56d6d3', // kombucha original
    clone: 'c52687c9-c932-4400-af65-46e4463b5e96',
    cookedAt: '2026-04-10T19:30:00+00:00',
  },
  {
    source: '75fcd7f8-a70b-43f8-85f2-53bf854f38dd', // friends original
    clone: '6e32071e-f90d-4c2b-947a-38c060cbbfb4',
    cookedAt: '2026-04-10T18:00:00+00:00',
  },
];

(async () => {
  for (const pair of PAIRS) {
    const sourcePhotos = await pgrstGet(
      `meal_photos?select=*&meal_id=eq.${pair.source}&order=created_at.asc`
    );
    if (sourcePhotos.length === 0) {
      console.log(`- ${pair.source}: no photos to copy`);
      continue;
    }

    // Skip if the clone already has photos (idempotent)
    const existing = await pgrstGet(
      `meal_photos?select=id&meal_id=eq.${pair.clone}`
    );
    if (existing.length > 0) {
      console.log(`- ${pair.clone}: already has ${existing.length} photos, skipping`);
      continue;
    }

    const rows = sourcePhotos.map((p) => ({
      id: randomUUID(),
      meal_id: pair.clone,
      user_id: p.user_id,
      photo_url: p.photo_url,
      caption: p.caption,
      created_at: pair.cookedAt,
    }));

    await pgrstInsert('meal_photos', rows);
    console.log(`+ ${pair.clone}: inserted ${rows.length} meal_photos`);
  }

  console.log('\n✅ Done.');
})();
