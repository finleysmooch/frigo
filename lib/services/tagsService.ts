// ============================================
// FRIGO — TAGS SERVICE (Phase 8R-CP2a)
// ============================================
// Space-scoped tag taxonomy + supply/need junction management.
// Per Q39: split tables (supply_tags + need_tags). Per Q1: predefined dimensions.
// RLS handles space-access enforcement; service code does not duplicate that check.
// ============================================

import { supabase } from '../supabase';
import { Tag, TagDimension } from '../types/tags';

// ============================================
// TAG CRUD
// ============================================

export async function getTagsForSpace(
  spaceId: string,
  dimension?: TagDimension
): Promise<Tag[]> {
  console.log('🏷️ Loading tags for space:', { spaceId, dimension });

  let query = supabase
    .from('tags')
    .select('*')
    .eq('space_id', spaceId);

  if (dimension) {
    query = query.eq('dimension', dimension);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Error loading tags:', error);
    throw error;
  }

  const rows = (data ?? []) as Tag[];
  // Alphabetical by value within each dimension; secondary sort by dimension for stable ordering.
  rows.sort((a, b) => {
    const dimDiff = a.dimension.localeCompare(b.dimension);
    if (dimDiff !== 0) return dimDiff;
    return a.value.toLowerCase().localeCompare(b.value.toLowerCase());
  });

  return rows;
}

export async function getTagById(tagId: string): Promise<Tag | null> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('id', tagId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error loading tag:', error);
    throw error;
  }

  return (data as Tag | null) ?? null;
}

/**
 * Find-or-create tag by (space, dimension, value) with case-insensitive value match.
 * Trims input. If a row matches case-insensitively, returns the existing row's stored value.
 * Otherwise inserts the trimmed value as-typed (preserves the user's preferred casing).
 */
export async function getOrCreateTag(
  spaceId: string,
  dimension: TagDimension,
  value: string,
  createdBy: string
): Promise<Tag> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Tag value cannot be empty');
  }

  const normalized = trimmed.toLowerCase();

  // Case-insensitive lookup: ilike with exact pattern (no wildcard) matches the
  // value with case-insensitive equality on PostgreSQL.
  const { data: existing, error: lookupError } = await supabase
    .from('tags')
    .select('*')
    .eq('space_id', spaceId)
    .eq('dimension', dimension)
    .ilike('value', trimmed)
    .maybeSingle();

  if (lookupError) {
    console.error('❌ Error looking up tag:', lookupError);
    throw lookupError;
  }

  if (existing) {
    const existingTag = existing as Tag;
    // Defensive belt-and-suspenders: confirm true case-insensitive equality.
    if (existingTag.value.toLowerCase() === normalized) {
      return existingTag;
    }
  }

  console.log('🏷️ Creating tag:', { spaceId, dimension, value: trimmed });

  const { data: created, error: insertError } = await supabase
    .from('tags')
    .insert({
      space_id: spaceId,
      dimension,
      value: trimmed,
      created_by: createdBy,
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Error creating tag:', insertError);
    throw insertError;
  }

  return created as Tag;
}

export async function deleteTag(tagId: string): Promise<void> {
  console.log('🏷️ Deleting tag:', tagId);

  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId);

  if (error) {
    console.error('❌ Error deleting tag:', error);
    throw error;
  }
}

// ============================================
// SUPPLY TAG MANAGEMENT (Q39)
// ============================================

export async function getSupplyTags(supplyId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('supply_tags')
    .select('tag:tags(*)')
    .eq('supply_id', supplyId);

  if (error) {
    console.error('❌ Error loading supply tags:', error);
    throw error;
  }

  return (data ?? [])
    .map((row) => (row as { tag: Tag | null }).tag)
    .filter((t): t is Tag => t !== null);
}

/**
 * Replace all tags on a supply. Computes the delta against current attachments
 * and applies only the differences (idempotent: same tagIds → no writes).
 */
export async function setSupplyTags(supplyId: string, tagIds: string[]): Promise<void> {
  console.log('🏷️ Setting supply tags:', { supplyId, count: tagIds.length });

  const desired = new Set(tagIds);

  const { data: currentRows, error: currentError } = await supabase
    .from('supply_tags')
    .select('tag_id')
    .eq('supply_id', supplyId);

  if (currentError) {
    console.error('❌ Error loading current supply tags:', currentError);
    throw currentError;
  }

  const current = new Set(
    (currentRows ?? []).map((r) => (r as { tag_id: string }).tag_id)
  );

  const toAdd: string[] = [];
  const toRemove: string[] = [];
  desired.forEach((id) => {
    if (!current.has(id)) toAdd.push(id);
  });
  current.forEach((id) => {
    if (!desired.has(id)) toRemove.push(id);
  });

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('supply_tags')
      .delete()
      .eq('supply_id', supplyId)
      .in('tag_id', toRemove);

    if (deleteError) {
      console.error('❌ Error removing supply tags:', deleteError);
      throw deleteError;
    }
  }

  if (toAdd.length > 0) {
    const insertRows = toAdd.map((tagId) => ({
      supply_id: supplyId,
      tag_id: tagId,
    }));

    const { error: insertError } = await supabase
      .from('supply_tags')
      .insert(insertRows);

    if (insertError) {
      console.error('❌ Error inserting supply tags:', insertError);
      throw insertError;
    }
  }
}

export async function addSupplyTag(supplyId: string, tagId: string): Promise<void> {
  // No-op if already attached. Use the unique constraint to detect duplicates and swallow.
  const { error } = await supabase
    .from('supply_tags')
    .insert({ supply_id: supplyId, tag_id: tagId });

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      // unique_violation — already attached, treat as no-op.
      return;
    }
    console.error('❌ Error adding supply tag:', error);
    throw error;
  }
}

export async function removeSupplyTag(supplyId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('supply_tags')
    .delete()
    .eq('supply_id', supplyId)
    .eq('tag_id', tagId);

  if (error) {
    console.error('❌ Error removing supply tag:', error);
    throw error;
  }
}

// ============================================
// NEED TAG MANAGEMENT (Q39)
// ============================================

export async function getNeedTags(needId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('need_tags')
    .select('tag:tags(*)')
    .eq('need_id', needId);

  if (error) {
    console.error('❌ Error loading need tags:', error);
    throw error;
  }

  return (data ?? [])
    .map((row) => (row as { tag: Tag | null }).tag)
    .filter((t): t is Tag => t !== null);
}

export async function setNeedTags(needId: string, tagIds: string[]): Promise<void> {
  console.log('🏷️ Setting need tags:', { needId, count: tagIds.length });

  const desired = new Set(tagIds);

  const { data: currentRows, error: currentError } = await supabase
    .from('need_tags')
    .select('tag_id')
    .eq('need_id', needId);

  if (currentError) {
    console.error('❌ Error loading current need tags:', currentError);
    throw currentError;
  }

  const current = new Set(
    (currentRows ?? []).map((r) => (r as { tag_id: string }).tag_id)
  );

  const toAdd: string[] = [];
  const toRemove: string[] = [];
  desired.forEach((id) => {
    if (!current.has(id)) toAdd.push(id);
  });
  current.forEach((id) => {
    if (!desired.has(id)) toRemove.push(id);
  });

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('need_tags')
      .delete()
      .eq('need_id', needId)
      .in('tag_id', toRemove);

    if (deleteError) {
      console.error('❌ Error removing need tags:', deleteError);
      throw deleteError;
    }
  }

  if (toAdd.length > 0) {
    const insertRows = toAdd.map((tagId) => ({
      need_id: needId,
      tag_id: tagId,
    }));

    const { error: insertError } = await supabase
      .from('need_tags')
      .insert(insertRows);

    if (insertError) {
      console.error('❌ Error inserting need tags:', insertError);
      throw insertError;
    }
  }
}

export async function addNeedTag(needId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('need_tags')
    .insert({ need_id: needId, tag_id: tagId });

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return;
    }
    console.error('❌ Error adding need tag:', error);
    throw error;
  }
}

export async function removeNeedTag(needId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('need_tags')
    .delete()
    .eq('need_id', needId)
    .eq('tag_id', tagId);

  if (error) {
    console.error('❌ Error removing need tag:', error);
    throw error;
  }
}
