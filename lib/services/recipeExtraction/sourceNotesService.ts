// lib/services/recipeExtraction/sourceNotesService.ts
// Persist + fetch community notes/comments captured from a recipe source
// (NYT Cooking). Notes are scraped by the scrape-recipe edge function from the
// page's __NEXT_DATA__ payload and carried through extraction as SourceNote[].

import { supabase } from '../../supabase';
import { SourceNote } from '../../types/recipeExtraction';

/** A note row as stored/returned from recipe_source_notes. */
export interface StoredSourceNote {
  id: string;
  source_note_id: string;
  note_type: string | null;
  author_name: string | null;
  message: string;
  parent_source_note_id: string | null;
  is_recommended: boolean;
  recommendations_count: number;
  replies_count: number;
  source_created_at: string | null;
}

/**
 * Save source notes for a recipe. Upserts on (recipe_id, source_note_id) so
 * re-importing the same recipe doesn't duplicate notes. Non-fatal on error —
 * the recipe itself is already saved.
 */
export async function saveSourceNotes(
  recipeId: string,
  notes: SourceNote[] | undefined,
  meta: { externalSourceId?: string | null; sourceDomain?: string | null }
): Promise<void> {
  if (!notes || notes.length === 0) {
    console.log('ℹ️ No source notes to save');
    return;
  }

  const rows = notes.map((n) => ({
    recipe_id: recipeId,
    external_source_id: meta.externalSourceId || null,
    source_domain: meta.sourceDomain || null,
    source_note_id: n.sourceNoteId,
    note_type: n.type || null,
    author_name: n.authorName || null,
    author_external_id: n.authorExternalId || null,
    message: n.message,
    parent_source_note_id: n.parentSourceNoteId || null,
    is_recommended: !!n.isRecommended,
    recommendations_count: n.recommendationsCount || 0,
    replies_count: n.repliesCount || 0,
    source_created_at: n.createdAt || null,
  }));

  const { error } = await supabase
    .from('recipe_source_notes')
    .upsert(rows, { onConflict: 'recipe_id,source_note_id' });

  if (error) {
    console.error('❌ Error saving source notes:', error);
    return; // non-fatal
  }
  console.log(`✅ Saved ${rows.length} source notes`);
}

/**
 * Fetch a recipe's stored source notes, recommended first, then most-helpful,
 * then newest. Returns [] on error.
 */
export async function getSourceNotes(recipeId: string): Promise<StoredSourceNote[]> {
  const { data, error } = await supabase
    .from('recipe_source_notes')
    .select(
      'id, source_note_id, note_type, author_name, message, parent_source_note_id, is_recommended, recommendations_count, replies_count, source_created_at'
    )
    .eq('recipe_id', recipeId)
    .order('is_recommended', { ascending: false })
    .order('recommendations_count', { ascending: false })
    .order('source_created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching source notes:', error);
    return [];
  }
  return data || [];
}
