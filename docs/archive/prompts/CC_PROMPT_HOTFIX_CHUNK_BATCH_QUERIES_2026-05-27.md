# CC Prompt — Hot Fix: Chunk batch `.in('recipe_id', ...)` queries

## Context

After Phase 10F shipped 2026-05-27, smoke testing in Expo Go surfaced "Bad Request" errors on three batch services. Root cause: with the user's 737 recipes, calling `.in('recipe_id', recipeIds)` produces URLs of ~27KB, well above PostgREST's URL length limit (~4-8KB).

Failure was pre-existing — has been silently broken since recipe count crossed ~150 — but 10F's dietary-prefs auto-filter made it visible: when nutrition data fails to load, the matview's dietary flags don't reach the client, the gluten-free filter excludes every recipe, and the screen renders empty.

Three services affected, all in the same way:

1. `lib/services/nutritionService.ts` → `getRecipeNutritionBatch` (single `.in()`)
2. `lib/services/readyToCookService.ts` → `getRecipeIngredientNames` (single `.in()`)
3. `lib/services/pantryMatchingService.ts` → `calculateRecipeSupplyMatchBulk`:
   - Query 1: `.in('recipe_id', recipeIds)` — needs chunking
   - Query 3: `.or('id.in.(...),base_ingredient_id.in.(...)')` — also at URL-length risk with ~500+ ingredient ids

## Approach

Chunk every `.in()` and `.or()` call with a large ID array into batches of 100 IDs, run them via `Promise.all`, merge results. 100 IDs × ~37 chars (UUID + delimiter) = ~3.7KB per request — comfortably under PostgREST limits.

No algorithmic changes to any of the three services. The chunking is purely a transport-layer fix: gather the same data via multiple smaller queries, merge into the same intermediate structure, run the existing logic.

## Inputs to read

1. `lib/services/nutritionService.ts` — `getRecipeNutritionBatch` (line ~284)
2. `lib/services/readyToCookService.ts` — `getRecipeIngredientNames` (line ~88)
3. `lib/services/pantryMatchingService.ts` — `calculateRecipeSupplyMatchBulk` (line ~210); Query 1 at line ~227; Query 3 at line ~258

## Task

### Shared chunk size constant

Define `const CHUNK_SIZE = 100` as a module-level constant in each of the three services (or as a single shared export — your call, but don't over-engineer; if it's just a number used three places, inlining is fine). Use the same value across all three for consistency.

### Edit 1 — `lib/services/nutritionService.ts`

Replace the body of `getRecipeNutritionBatch` (currently lines ~287-359) to chunk the query. The existing empty-array guard, dedup, and row-mapping logic all stay — only the `supabase.from(...).select(...).in(...)` call is split.

```typescript
export async function getRecipeNutritionBatch(
  recipeIds: string[]
): Promise<Map<string, RecipeNutrition>> {
  const uniqueIds = [...new Set(recipeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  // Chunk the .in() query — PostgREST URL limit is ~4-8KB and 737 UUIDs
  // produces ~27KB. Each chunk ~3.7KB. Promise.all runs them in parallel.
  const CHUNK_SIZE = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map(chunk =>
      supabase
        .from('recipe_nutrition_computed')
        .select('*')
        .in('recipe_id', chunk)
    )
  );

  const map = new Map<string, RecipeNutrition>();
  for (const { data, error } of chunkResults) {
    if (error) {
      console.error('Error batch fetching recipe nutrition:', error);
      continue; // Skip failed chunks; partial data better than no data
    }
    for (const row of data || []) {
      // ... existing row-mapping logic unchanged ...
    }
  }
  return map;
}
```

The existing row-mapping (the `map.set(row.recipe_id, { ... 50+ fields ... })`) stays byte-identical. Just lift the loop body from the old version into the new chunked loop.

### Edit 2 — `lib/services/readyToCookService.ts`

Replace the body of `getRecipeIngredientNames` (currently lines ~88-120) with the same pattern. The function already initializes the result Map with empty arrays for every requested id — that init stays. Only the query is chunked.

```typescript
export async function getRecipeIngredientNames(
  recipeIds: string[]
): Promise<Map<string, Array<{ id: string; name: string }>>> {
  const result = new Map<string, Array<{ id: string; name: string }>>();
  for (const id of recipeIds) result.set(id, []);
  if (recipeIds.length === 0) return result;

  const CHUNK_SIZE = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < recipeIds.length; i += CHUNK_SIZE) {
    chunks.push(recipeIds.slice(i, i + CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map(chunk =>
      supabase
        .from('recipe_ingredients')
        .select('recipe_id, ingredient_id, ingredient:ingredients(id, name)')
        .in('recipe_id', chunk)
    )
  );

  for (const { data, error } of chunkResults) {
    if (error) {
      console.error('[readyToCookService] getRecipeIngredientNames chunk failed', error);
      continue; // Partial data better than throwing
    }
    for (const row of (data ?? []) as Array<{
      recipe_id: string;
      ingredient_id: string | null;
      ingredient: { id: string; name: string } | null;
    }>) {
      if (!row.ingredient_id || !row.ingredient) continue;
      const arr = result.get(row.recipe_id);
      if (arr) arr.push({ id: row.ingredient.id, name: row.ingredient.name });
    }
  }

  return result;
}
```

**Behavior change to flag:** the original function `throw`s on any error. The new version logs and continues — partial data is better than crashing the screen. This is intentional and matches the new nutrition batch behavior. If you think this is wrong, flag it for review rather than reverting silently.

### Edit 3 — `lib/services/pantryMatchingService.ts`

Two queries in this file need chunking. The function structure stays the same — only the data-gathering steps split.

**Query 1 (line ~227-232)** — chunk by `recipeIds`:

```typescript
// ---- Query 1: recipe_ingredients + embedded ingredient metadata. ----
// Chunked to stay under PostgREST URL limit (~4-8KB) with large recipe sets.
const CHUNK_SIZE = 100;
const recipeChunks: string[][] = [];
for (let i = 0; i < recipeIds.length; i += CHUNK_SIZE) {
  recipeChunks.push(recipeIds.slice(i, i + CHUNK_SIZE));
}

const riChunkResults = await Promise.all(
  recipeChunks.map(chunk =>
    supabase
      .from('recipe_ingredients')
      .select(
        'recipe_id, ingredient_id, ingredient:ingredients(id, base_ingredient_id, is_base_ingredient, form, ingredient_subtype, name)'
      )
      .in('recipe_id', chunk)
  )
);

// Flatten chunks. Any failed chunk logs and is skipped — partial data is
// better than no data for the UI.
const riData: Array<{
  recipe_id: string;
  ingredient_id: string | null;
  ingredient: IngredientMeta | null;
}> = [];
for (const { data, error } of riChunkResults) {
  if (error) {
    console.error('❌ Error loading recipe_ingredients chunk for matching:', error);
    continue;
  }
  if (data) riData.push(...(data as any));
}
```

The rest of the function (building `recipeIngredients` / `universe` maps from `riData`, running Query 2, etc.) stays unchanged. The `throw riError;` line goes away — handled via the per-chunk log.

**Query 3 (line ~254-271)** — the `.or('id.in.(...),base_ingredient_id.in.(...)')` clause. Chunk by splitting it into two separate queries:

- Query 3a: `id IN (idInList)` — chunked
- Query 3b: `base_ingredient_id IN (baseIdList)` — chunked

Merge both result streams into `catalogById` (which already deduplicates by `id` via `Map.set`).

```typescript
// ---- Query 3: catalog metadata. ----
// Originally one .or() query; split + chunked here. catalogById's Map.set
// naturally dedupes any rows returned by both halves.
const catalogById = new Map<string, IngredientMeta>();

if (idInList.length > 0) {
  const idChunks: string[][] = [];
  for (let i = 0; i < idInList.length; i += CHUNK_SIZE) {
    idChunks.push(idInList.slice(i, i + CHUNK_SIZE));
  }
  const idChunkResults = await Promise.all(
    idChunks.map(chunk =>
      supabase
        .from('ingredients')
        .select('id, base_ingredient_id, is_base_ingredient, form, ingredient_subtype, name')
        .in('id', chunk)
    )
  );
  for (const { data, error } of idChunkResults) {
    if (error) {
      console.error('❌ Error loading ingredient catalog (id chunk) for matching:', error);
      continue;
    }
    for (const meta of (data ?? []) as IngredientMeta[]) {
      catalogById.set(meta.id, meta);
    }
  }
}

if (baseIdList.length > 0) {
  const baseChunks: string[][] = [];
  for (let i = 0; i < baseIdList.length; i += CHUNK_SIZE) {
    baseChunks.push(baseIdList.slice(i, i + CHUNK_SIZE));
  }
  const baseChunkResults = await Promise.all(
    baseChunks.map(chunk =>
      supabase
        .from('ingredients')
        .select('id, base_ingredient_id, is_base_ingredient, form, ingredient_subtype, name')
        .in('base_ingredient_id', chunk)
    )
  );
  for (const { data, error } of baseChunkResults) {
    if (error) {
      console.error('❌ Error loading ingredient catalog (base_id chunk) for matching:', error);
      continue;
    }
    for (const meta of (data ?? []) as IngredientMeta[]) {
      catalogById.set(meta.id, meta);
    }
  }
}
```

Note: `CHUNK_SIZE` is defined once at function-scope (or module-scope) — don't redefine it in each of the four chunking blocks within this function.

Query 2 (`supabase.from('supplies').select(...).eq('space_id', spaceId)...`) doesn't need chunking — no array filter, no URL length risk.

## Constraints

- DO NOT change any service's external API — signatures, return types, behavior contracts stay the same
- DO NOT change `calculateRecipeSupplyMatchBulk`'s post-query algorithm — the chunking only affects how data is gathered, not how it's processed
- DO NOT lower `CHUNK_SIZE` below 50 or raise above 150 — 100 is a safe middle (URL ~3.7KB, well under PostgREST's 4-8KB default)
- DO emit `console.error` on chunk failures so we can monitor in production logs, but DO NOT throw — partial data lets the UI degrade gracefully instead of going blank
- All TS must type-check with strict mode

## Verification

Before reporting done:

1. `npx tsc --noEmit` — zero new type errors
2. `grep -c "CHUNK_SIZE\|chunkResults\|chunks.push\|recipeChunks\|idChunks\|baseChunks" lib/services/nutritionService.ts lib/services/readyToCookService.ts lib/services/pantryMatchingService.ts` — should return ≥ ~15 (chunking added in 3 places: 1 + 1 + 3 distinct chunk loops)
3. `grep -c "Bad Request" lib/services/{nutritionService,readyToCookService,pantryMatchingService}.ts` — should return 0 (the literal string shouldn't appear in source)
4. No new files needed — all changes in-place

## Smoke test guidance for Tom (post-CC)

1. Force-quit Expo Go completely, reopen the app
2. Open recipe list — confirm recipes appear with NO console errors about `getRecipeNutritionBatch`, `calculateRecipeSupplyMatchBulk`, or `getRecipeIngredientNames`
3. With dietary prefs gluten-free toggled ON in Settings, navigate to recipe list — confirm ~306 recipes show (matching the matview count we verified)
4. Toggle dietary pref OFF — confirm ~822 recipes return
5. Verify recipe cards show nutrition badges (calories, dietary flags) — confirms `getRecipeNutritionBatch` is now returning data
6. Verify pantry-match % shows on recipe cards — confirms `calculateRecipeSupplyMatchBulk` is now returning data
7. If "X you can make now" badge appears, tap it → WhatCanICookScreen should load — confirms `getRecipeIngredientNames` working too

## SESSION_LOG entry

Append under today's 2026-05-27 day header, after the 10F entry:

```
### Hot fix — Chunked batch .in() queries for URL length

Smoke testing 10F in Expo Go surfaced "Bad Request" errors on three batch services. Root cause: with the user's 737 recipes, .in('recipe_id', recipeIds) produced URLs of ~27KB, far above PostgREST's 4-8KB URL limit. Pre-existing bug (latent since recipe count crossed ~150 in February 2026); 10F exposed it because the nutrition batch failure left recipes without dietary flags, breaking the gluten-free filter visibly.

Files touched:
- `lib/services/nutritionService.ts` — getRecipeNutritionBatch chunked by 100
- `lib/services/readyToCookService.ts` — getRecipeIngredientNames chunked by 100
- `lib/services/pantryMatchingService.ts` — calculateRecipeSupplyMatchBulk Query 1 (recipe_ingredients .in()) and Query 3 (split .or() into two chunked .in()s) both chunked by 100

Behavior changes:
- All three services now log per-chunk errors and continue rather than throwing. Partial data is shown instead of blank screens. Matches existing UX philosophy on RecipeListScreen catch handlers (already logged-and-continued at call sites; throwing was redundant defensive code).

Pending: P10-Followup-1 — long-term, these batch services should use a Supabase RPC function that accepts recipeIds[] as a parameter, avoiding URL encoding entirely. Defer to post-F&F.
```

## Reporting back

When done, paste:
1. Result of `npx tsc --noEmit`
2. The grep counts from verification steps 2-3
3. Any deviations / unexpected issues
4. The SESSION_LOG entry
