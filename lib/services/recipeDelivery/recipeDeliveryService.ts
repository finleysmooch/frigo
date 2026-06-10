// lib/services/recipeDelivery/recipeDeliveryService.ts
// CP6b — copy-on-verify DELIVERY ENGINE. Isolated, config-driven, row-level deep-copier.
//
// Consumes the CP6a-2 seam: for a verified-undelivered (user_id, book_id) it links the book into the
// user's library and deep-copies the catalog book's canonical recipes into the user's account as
// independent, editable rows, then stamps delivered_at LAST. Reads canonical rows; NEVER mutates them.
//
// ISOLATION (anchor §4.3): this module imports NOTHING from the extraction copy path
// (recipeExtraction/recipeService saveRecipeToDatabase + its child-savers) and is imported by nothing
// there. The user_books link is created inline with the EXACT shape of createUserBookOwnership
// (recipeExtraction/bookService) — inlined rather than imported so the isolation grep stays clean
// (createUserBookOwnership lives under recipeExtraction/); it is the same operation, not a divergent
// second path. (Tension flagged in SESSION_LOG: anchor says "reuse createUserBookOwnership"; the Task
// grep says "import nothing from recipeExtraction/*" — inlining honors both in substance.)
//
// Images are copied as REFERENCE strings only (§3 (a)): recipes.image_url, recipe_media.url,
// recipe_photos.image_url are copied verbatim so the copy points at the SAME stored object. This
// module NEVER fetches+re-uploads bytes (that would flip to (b) and re-open §3).

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RECIPE_ENGINE_SET_COLUMNS,
  RECIPE_EXCLUDED_COLUMNS,
  COPIED_CHILDREN,
  CHILD_ENGINE_SET_COLUMNS,
} from './copySet';

export interface DeliveryResult {
  userId: string;
  bookId: string;
  status: 'delivered' | 'already-delivered' | 'not-verified';
  recipesCopied: number;
}

type Row = Record<string, any>;

/** Provenance INHERITED from the canonical (Amendment B) — never the current models.ts value. */
function inheritedProvenance(canonical: Row): Row {
  const raw = (canonical.raw_extraction_data as Row) || {};
  return {
    extraction_method:
      canonical.extraction_method ?? raw.extraction_method ?? 'unknown_legacy',
    extraction_model:
      canonical.extraction_model ?? raw.extraction_model ?? raw.model ?? 'unknown_legacy',
    is_author_authenticated: false,
  };
}

/** Copy a row: drop engine-owned + excluded columns, apply overrides; let the DB default id/timestamps. */
function copyRowValues(row: Row, drop: readonly string[], overrides: Row): Row {
  const out: Row = { ...row };
  for (const k of drop) delete out[k];
  return { ...out, ...overrides };
}

/**
 * Deliver one verified, undelivered (userId, catalogBookId).
 *
 * ORDER (Amendment E): user_books link FIRST → recipe copies SECOND (idempotent per-recipe) →
 * delivered_at stamped LAST when the full set completes. Idempotent on delivered_at: a re-run of an
 * already-delivered book copies NOTHING; a re-run after a mid-flight crash resumes without duplicating.
 *
 * Pass a SERVICE-ROLE client (the async invocation path uses one) — it reads canonical recipes owned by
 * the assembly account and writes rows under another user, both of which require bypassing RLS.
 */
export async function deliverVerifiedBook(
  client: SupabaseClient,
  userId: string,
  catalogBookId: string
): Promise<DeliveryResult> {
  // 0. Seam gate — only deliver to a verified, undelivered record.
  const { data: ver, error: verErr } = await client
    .from('book_ownership_verifications')
    .select('id, status, delivered_at')
    .eq('user_id', userId)
    .eq('book_id', catalogBookId)
    .maybeSingle();
  if (verErr) throw verErr;
  if (!ver || ver.status !== 'verified') {
    return { userId, bookId: catalogBookId, status: 'not-verified', recipesCopied: 0 };
  }
  if (ver.delivered_at) {
    return { userId, bookId: catalogBookId, status: 'already-delivered', recipesCopied: 0 };
  }

  // 1. user_books link FIRST (idempotent: check-then-insert; inline createUserBookOwnership shape).
  const { data: link, error: linkErr } = await client
    .from('user_books')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', catalogBookId)
    .maybeSingle();
  if (linkErr) throw linkErr;
  if (!link) {
    const { error: insErr } = await client.from('user_books').insert({
      user_id: userId,
      book_id: catalogBookId,
      ownership_claimed: true,
      ownership_proof_image_url: null,
      recipe_count: 0,
    });
    if (insErr) throw insErr;
  }

  // 2. Deep-copy each canonical recipe (book_id = catalog, parent_recipe_id IS NULL = not itself a copy).
  const { data: canon, error: canonErr } = await client
    .from('recipes')
    .select('*')
    .eq('book_id', catalogBookId)
    .is('parent_recipe_id', null);
  if (canonErr) throw canonErr;

  let copied = 0;
  for (const recipe of canon || []) {
    const didCopy = await copyOneRecipe(client, recipe, userId, catalogBookId);
    if (didCopy) copied++;
  }

  // 3. Stamp delivered_at LAST — only after the full set completed.
  const { error: stampErr } = await client
    .from('book_ownership_verifications')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', ver.id)
    .is('delivered_at', null); // guard: don't overwrite a concurrent stamp
  if (stampErr) throw stampErr;

  return { userId, bookId: catalogBookId, status: 'delivered', recipesCopied: copied };
}

/** Returns true if a new copy was made, false if it already existed (resume-safe idempotency). */
async function copyOneRecipe(
  client: SupabaseClient,
  canonical: Row,
  userId: string,
  catalogBookId: string
): Promise<boolean> {
  // Per-recipe idempotency: a copy is (user_id, book_id=catalog, parent_recipe_id=canonical.id).
  const { data: existing, error: exErr } = await client
    .from('recipes')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', catalogBookId)
    .eq('parent_recipe_id', canonical.id)
    .maybeSingle();
  if (exErr) throw exErr;
  if (existing) return false; // already copied (resume)

  // Recipe row: copy all columns except engine-owned + excluded; set the engine-owned ones.
  const recipeInsert = copyRowValues(
    canonical,
    [...RECIPE_ENGINE_SET_COLUMNS, ...RECIPE_EXCLUDED_COLUMNS],
    {
      user_id: userId,
      book_id: catalogBookId,
      parent_recipe_id: canonical.id, // read-only lineage pointer
      is_public: false,
      ...inheritedProvenance(canonical),
    }
  );
  const { data: newRecipe, error: insErr } = await client
    .from('recipes')
    .insert(recipeInsert)
    .select('id')
    .single();
  if (insErr) throw insErr;
  const newRecipeId = newRecipe.id as string;

  // Children: config-driven walk. Top-level children re-parent to newRecipeId; instruction_steps
  // re-parent (two-level) to the NEW instruction_sections ids.
  const sectionIdMap = new Map<string, string>(); // old section id → new section id
  for (const spec of COPIED_CHILDREN) {
    const drop = [...CHILD_ENGINE_SET_COLUMNS, spec.parentKey];

    if (spec.parentMap === 'recipe') {
      const { data: kids, error: kidErr } = await client
        .from(spec.table)
        .select('*')
        .eq(spec.parentKey, canonical.id);
      if (kidErr) throw kidErr;
      if (!kids || kids.length === 0) continue; // copy-if-present (e.g. recipe_photos expected empty)

      const inserts = kids.map((k) => copyRowValues(k, drop, { [spec.parentKey]: newRecipeId }));

      if (spec.table === 'instruction_sections') {
        // need the new ids to re-parent steps → insert one-by-one capturing the map
        for (let i = 0; i < kids.length; i++) {
          const { data: ins, error } = await client
            .from(spec.table)
            .insert(inserts[i])
            .select('id')
            .single();
          if (error) throw error;
          sectionIdMap.set(kids[i].id as string, ins.id as string);
        }
      } else {
        const { error } = await client.from(spec.table).insert(inserts);
        if (error) throw error;
      }
    } else {
      // instruction_steps — re-parent each to the mapped new section id
      const oldSectionIds = Array.from(sectionIdMap.keys());
      if (oldSectionIds.length === 0) continue;
      const { data: steps, error: stepErr } = await client
        .from(spec.table)
        .select('*')
        .in(spec.parentKey, oldSectionIds);
      if (stepErr) throw stepErr;
      if (!steps || steps.length === 0) continue;
      const inserts = steps.map((s) =>
        copyRowValues(s, drop, { [spec.parentKey]: sectionIdMap.get(s[spec.parentKey] as string) })
      );
      const { error } = await client.from(spec.table).insert(inserts);
      if (error) throw error;
    }
  }

  return true;
}

/**
 * Purge-IDENTIFIABILITY (Amendment C — delivery-record-keyed, NOT parent_recipe_id-alone; row-scoped
 * per §3 — leaves the shared stored image objects). Returns the ids of every row in the delivered tree
 * for (userId, catalogBookId): the delivered recipes + all their copied children. Documented in
 * docs/COOKBOOK_VERIFICATION.md; the purge ACTION is a future operation, not run here.
 *
 * Predicate: delivered recipes = recipes WHERE user_id=U AND book_id=B AND parent_recipe_id IN
 * (canonical recipes of catalog book B). Children follow copy-coverage exactly.
 */
export async function identifyDeliveredSet(
  client: SupabaseClient,
  userId: string,
  catalogBookId: string
): Promise<{ recipeIds: string[]; children: Record<string, string[]> }> {
  // canonical recipes of the catalog book (the lineage anchors)
  const { data: canon, error: canonErr } = await client
    .from('recipes')
    .select('id')
    .eq('book_id', catalogBookId)
    .is('parent_recipe_id', null);
  if (canonErr) throw canonErr;
  const canonicalIds = (canon || []).map((r) => r.id as string);

  // delivered recipes: user-scoped, book-scoped, lineage ∈ canonical-of-book (NOT "parent IS NOT NULL")
  const { data: delivered, error: delErr } = await client
    .from('recipes')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', catalogBookId)
    .in('parent_recipe_id', canonicalIds.length ? canonicalIds : ['00000000-0000-0000-0000-000000000000']);
  if (delErr) throw delErr;
  const recipeIds = (delivered || []).map((r) => r.id as string);

  // children, by copy-coverage (same table set the copier writes)
  const children: Record<string, string[]> = {};
  if (recipeIds.length) {
    const sectionIds: string[] = [];
    for (const spec of COPIED_CHILDREN) {
      if (spec.parentMap === 'recipe') {
        const { data, error } = await client.from(spec.table).select('id').in(spec.parentKey, recipeIds);
        if (error) throw error;
        children[spec.table] = (data || []).map((r) => r.id as string);
        if (spec.table === 'instruction_sections') sectionIds.push(...children[spec.table]);
      } else {
        const { data, error } = await client
          .from(spec.table)
          .select('id')
          .in(spec.parentKey, sectionIds.length ? sectionIds : ['00000000-0000-0000-0000-000000000000']);
        if (error) throw error;
        children[spec.table] = (data || []).map((r) => r.id as string);
      }
    }
  }
  return { recipeIds, children };
}
