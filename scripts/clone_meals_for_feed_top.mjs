// One-off seed: clone the kombucha meal and the "Friends over for dinner"
// potluck with today's date so they sit at the top of Tom's feed.
//
// Run with: node scripts/clone_meals_for_feed_top.mjs

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Load .env manually so we don't need dotenv
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
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

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
  if (!res.ok) {
    throw new Error(
      `INSERT ${table}: ${res.status} ${await res.text()}`
    );
  }
  return res.json();
}

/**
 * Clone a single meal with all its children.
 * @param {string} sourceMealId - the meal post id to clone
 * @param {string} newCookedAtISO - ISO timestamp for the new meal's cooked_at / meal_time
 * @param {string} newCreatedAtISO - ISO timestamp for the new meal's created_at (used for ordering)
 * @param {string} newTitle - optional title override
 */
async function cloneMeal(sourceMealId, newCookedAtISO, newCreatedAtISO, newTitle) {
  console.log(`\n=== Cloning meal ${sourceMealId} ===`);

  // 1. Source meal row
  const [sourceMeal] = await pgrstGet(
    `posts?select=*&id=eq.${sourceMealId}`
  );
  if (!sourceMeal) throw new Error(`meal ${sourceMealId} not found`);

  // 2. Source dish_courses
  const dishCourses = await pgrstGet(
    `dish_courses?select=*&meal_id=eq.${sourceMealId}&order=course_order`
  );
  const dishIds = dishCourses.map((d) => d.dish_id);

  // 3. Source dish posts
  const dishPosts =
    dishIds.length > 0
      ? await pgrstGet(
          `posts?select=*&id=in.(${dishIds.join(',')})`
        )
      : [];

  // 4. Source post_participants
  const postParts = await pgrstGet(
    `post_participants?select=*&post_id=eq.${sourceMealId}`
  );

  // 5. Source meal_participants
  const mealParts = await pgrstGet(
    `meal_participants?select=*&meal_id=eq.${sourceMealId}`
  );

  console.log(
    `  source: ${dishCourses.length} dishes, ${postParts.length} post_participants, ${mealParts.length} meal_participants`
  );

  // ── Build new ids ──
  const newMealId = randomUUID();
  const dishIdMap = new Map(); // oldDishId → newDishId
  for (const dp of dishPosts) {
    dishIdMap.set(dp.id, randomUUID());
  }

  // ── Insert new meal post ──
  const newMeal = {
    ...sourceMeal,
    id: newMealId,
    title: newTitle || sourceMeal.title,
    cooked_at: newCookedAtISO,
    created_at: newCreatedAtISO,
    meal_time: newCookedAtISO,
  };
  // Remove generated/server columns that shouldn't be copied literally
  delete newMeal.updated_at;

  await pgrstInsert('posts', [newMeal]);
  console.log(`  inserted meal post ${newMealId} "${newMeal.title}"`);

  // ── Insert new dish posts ──
  const newDishPosts = dishPosts.map((dp) => {
    const row = {
      ...dp,
      id: dishIdMap.get(dp.id),
      parent_meal_id: newMealId,
      cooked_at: newCookedAtISO,
      created_at: newCookedAtISO,
    };
    delete row.updated_at;
    return row;
  });
  if (newDishPosts.length > 0) {
    await pgrstInsert('posts', newDishPosts);
    console.log(`  inserted ${newDishPosts.length} dish posts`);
  }

  // ── Insert new dish_courses ──
  const newDishCourses = dishCourses.map((dc) => ({
    id: randomUUID(),
    dish_id: dishIdMap.get(dc.dish_id),
    meal_id: newMealId,
    course_type: dc.course_type,
    is_main_dish: dc.is_main_dish,
    course_order: dc.course_order,
    created_at: newCookedAtISO,
  }));
  if (newDishCourses.length > 0) {
    await pgrstInsert('dish_courses', newDishCourses);
    console.log(`  inserted ${newDishCourses.length} dish_courses`);
  }

  // ── Insert new post_participants ──
  const newPostParts = postParts.map((pp) => ({
    id: randomUUID(),
    post_id: newMealId,
    participant_user_id: pp.participant_user_id,
    role: pp.role,
    status: pp.status,
    invited_by_user_id: pp.invited_by_user_id,
    created_at: newCookedAtISO,
    responded_at: pp.responded_at,
    external_name: pp.external_name,
  }));
  if (newPostParts.length > 0) {
    await pgrstInsert('post_participants', newPostParts);
    console.log(`  inserted ${newPostParts.length} post_participants`);
  }

  // ── Insert new meal_participants ──
  const newMealParts = mealParts.map((mp) => ({
    id: randomUUID(),
    meal_id: newMealId,
    user_id: mp.user_id,
    role: mp.role,
    rsvp_status: mp.rsvp_status,
    invited_at: newCookedAtISO,
    responded_at: mp.responded_at,
  }));
  if (newMealParts.length > 0) {
    await pgrstInsert('meal_participants', newMealParts);
    console.log(`  inserted ${newMealParts.length} meal_participants`);
  }

  return newMealId;
}

// Today = 2026-04-10. Put the potluck at 18:00 and the kombucha at 19:30
// so the kombucha sits slightly above it in the feed.
const KOMBUCHA_ID = '55da1828-0e84-4b88-bd65-15e5fd56d6d3';
const POTLUCK_ID = '75fcd7f8-a70b-43f8-85f2-53bf854f38dd';

(async () => {
  try {
    await cloneMeal(
      POTLUCK_ID,
      '2026-04-10T18:00:00+00:00',
      '2026-04-10T18:00:00+00:00',
      "Friends over for dinner (potluck re-run)"
    );

    await cloneMeal(
      KOMBUCHA_ID,
      '2026-04-10T19:30:00+00:00',
      '2026-04-10T19:30:00+00:00',
      'Kombucha batch #2 with Anthony 🫖'
    );

    console.log('\n✅ Done.');
  } catch (err) {
    console.error('❌ Clone failed:', err);
    process.exit(1);
  }
})();
