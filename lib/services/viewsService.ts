// ============================================
// FRIGO — VIEWS SERVICE (Phase 8R-CP2b)
// ============================================
// Saved filter expressions presented as "lists" in UI (Q2).
// 4 default views per space (Q19); render modes tier/aisle/flat (Q25).
// View-filter query engine lives in needsService.getNeedsForView (Q42), not here.
// Q46: all param/return interfaces live in lib/types/.
// ============================================

import { supabase } from '../supabase';
import {
  CreateViewParams,
  RenderMode,
  UpdateViewParams,
  View,
  ViewFilter,
  ViewFilterInput,
  ViewWithFilters,
} from '../types/views';

// ============================================
// ERROR CLASSES
// ============================================

export class ViewNotFoundError extends Error {
  constructor(id: string) {
    super(`View ${id} not found or not accessible`);
    this.name = 'ViewNotFoundError';
  }
}

export class DefaultViewDeleteError extends Error {
  constructor(id: string) {
    super(`Default views cannot be deleted (view ${id}). Toggle is_hidden instead.`);
    this.name = 'DefaultViewDeleteError';
  }
}

// ============================================
// INTERNAL HELPERS
// ============================================

// 8R-UX1: rename the three urgency-based default views to "Short / Medium /
// Long List" without touching the DB. Applied at the read layer so every
// caller (ViewsScreen, ViewDetailScreen, AddNeedSheet, etc.) sees the new
// labels automatically. Only applies when is_default=true — preserves any
// user-renamed views. The 4th default "In Cart" stays unchanged.
//
// To make the rename permanent (i.e., new spaces also get these names),
// update the DB's seed_default_views() function — Claude.ai topic.
const DEFAULT_VIEW_NAME_OVERRIDES: Record<string, string> = {
  tonight: 'Short List',
  'this week': 'Medium List',
  'all needs': 'Long List',
  // 8R-UX1: DB seed names this 'In cart' (lowercase c). Override capitalizes
  // for consistency with the other two-word default names.
  'in cart': 'In Cart',
};

function flattenViewRow(
  row: View & { view_filters: ViewFilter[] | null }
): ViewWithFilters {
  const { view_filters, ...rest } = row;
  const renamed =
    rest.is_default && DEFAULT_VIEW_NAME_OVERRIDES[rest.name.toLowerCase()]
      ? DEFAULT_VIEW_NAME_OVERRIDES[rest.name.toLowerCase()]
      : rest.name;
  return {
    ...rest,
    name: renamed,
    filters: view_filters ?? [],
  };
}

const VIEW_SELECT = `*, view_filters(*)`;

// ============================================
// READ
// ============================================

export async function getViewsForSpace(
  spaceId: string,
  includeHidden: boolean = false
): Promise<ViewWithFilters[]> {
  console.log('📋 Loading views for space:', { spaceId, includeHidden });

  let query = supabase.from('views').select(VIEW_SELECT).eq('space_id', spaceId);

  if (!includeHidden) {
    query = query.eq('is_hidden', false);
  }

  const { data, error } = await query.order('sort_order', { ascending: true });

  if (error) {
    console.error('❌ Error loading views:', error);
    throw error;
  }

  return (data ?? []).map((row) =>
    flattenViewRow(row as View & { view_filters: ViewFilter[] | null })
  );
}

export async function getViewById(viewId: string): Promise<ViewWithFilters | null> {
  const { data, error } = await supabase
    .from('views')
    .select(VIEW_SELECT)
    .eq('id', viewId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error loading view:', error);
    throw error;
  }

  if (!data) return null;
  return flattenViewRow(data as View & { view_filters: ViewFilter[] | null });
}

// ============================================
// CREATE
// ============================================

export async function createView(params: CreateViewParams): Promise<ViewWithFilters> {
  console.log('📋 Creating view:', { spaceId: params.spaceId, name: params.name });

  const insertRow = {
    space_id: params.spaceId,
    name: params.name,
    emoji: params.emoji ?? '📋',
    is_default: false,
    is_hidden: false,
    render_mode: params.renderMode ?? ('aisle' as RenderMode),
    created_by: params.createdBy,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('views')
    .insert(insertRow)
    .select('id')
    .single();

  if (insertError) {
    console.error('❌ Error creating view:', insertError);
    throw insertError;
  }

  const newId = (inserted as { id: string }).id;

  if (params.filters.length > 0) {
    const filterRows = params.filters.map((f) => ({
      view_id: newId,
      dimension: f.dimension,
      values: f.values,
    }));

    const { error: filterError } = await supabase
      .from('view_filters')
      .insert(filterRows);

    if (filterError) {
      console.error('❌ Error inserting view filters:', filterError);
      throw filterError;
    }
  }

  const result = await getViewById(newId);
  if (!result) throw new ViewNotFoundError(newId);
  return result;
}

// ============================================
// UPDATE
// ============================================

export async function updateView(
  viewId: string,
  params: UpdateViewParams
): Promise<ViewWithFilters> {
  console.log('📋 Updating view:', { viewId, params });

  const patch: Record<string, unknown> = {};
  if (params.name !== undefined) patch.name = params.name;
  if (params.emoji !== undefined) patch.emoji = params.emoji;
  if (params.renderMode !== undefined) patch.render_mode = params.renderMode;
  if (params.sortOrder !== undefined) patch.sort_order = params.sortOrder;

  if (Object.keys(patch).length === 0) {
    const result = await getViewById(viewId);
    if (!result) throw new ViewNotFoundError(viewId);
    return result;
  }

  const { error } = await supabase.from('views').update(patch).eq('id', viewId);

  if (error) {
    console.error('❌ Error updating view:', error);
    throw error;
  }

  const result = await getViewById(viewId);
  if (!result) throw new ViewNotFoundError(viewId);
  return result;
}

/**
 * Replace all filters on a view. Delete existing view_filters, insert new ones.
 */
export async function updateViewFilters(
  viewId: string,
  filters: ViewFilterInput[]
): Promise<void> {
  console.log('📋 Replacing view filters:', { viewId, count: filters.length });

  const { error: deleteError } = await supabase
    .from('view_filters')
    .delete()
    .eq('view_id', viewId);

  if (deleteError) {
    console.error('❌ Error deleting existing view filters:', deleteError);
    throw deleteError;
  }

  if (filters.length === 0) return;

  const filterRows = filters.map((f) => ({
    view_id: viewId,
    dimension: f.dimension,
    values: f.values,
  }));

  const { error: insertError } = await supabase
    .from('view_filters')
    .insert(filterRows);

  if (insertError) {
    console.error('❌ Error inserting view filters:', insertError);
    throw insertError;
  }
}

export async function toggleViewHidden(viewId: string): Promise<ViewWithFilters> {
  console.log('📋 Toggling view hidden:', viewId);

  const current = await getViewById(viewId);
  if (!current) throw new ViewNotFoundError(viewId);

  const { error } = await supabase
    .from('views')
    .update({ is_hidden: !current.is_hidden })
    .eq('id', viewId);

  if (error) {
    console.error('❌ Error toggling view hidden:', error);
    throw error;
  }

  const result = await getViewById(viewId);
  if (!result) throw new ViewNotFoundError(viewId);
  return result;
}

export async function setViewRenderMode(
  viewId: string,
  mode: RenderMode
): Promise<ViewWithFilters> {
  console.log('📋 Setting view render mode:', { viewId, mode });

  const { error } = await supabase
    .from('views')
    .update({ render_mode: mode })
    .eq('id', viewId);

  if (error) {
    console.error('❌ Error setting view render mode:', error);
    throw error;
  }

  const result = await getViewById(viewId);
  if (!result) throw new ViewNotFoundError(viewId);
  return result;
}

// ============================================
// DELETE
// ============================================

/**
 * Delete a custom view. Blocks default views (use toggleViewHidden instead).
 */
export async function deleteView(viewId: string): Promise<void> {
  console.log('📋 Deleting view:', viewId);

  const current = await getViewById(viewId);
  if (!current) throw new ViewNotFoundError(viewId);

  if (current.is_default) {
    throw new DefaultViewDeleteError(viewId);
  }

  const { error } = await supabase.from('views').delete().eq('id', viewId);

  if (error) {
    console.error('❌ Error deleting view:', error);
    throw error;
  }
}

// ============================================
// SEED
// ============================================

/**
 * Calls the DB function seed_default_views(target_space_id) — creates the 4
 * default views if not already present (Q19). Idempotent.
 */
export async function seedDefaultViews(spaceId: string): Promise<void> {
  console.log('📋 Seeding default views for space:', spaceId);

  const { error } = await supabase.rpc('seed_default_views', {
    target_space_id: spaceId,
  });

  if (error) {
    console.error('❌ Error seeding default views:', error);
    throw error;
  }
}
