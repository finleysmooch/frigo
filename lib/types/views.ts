// Phase 8R-CP2a — view types.
// Per Q2/Q16/Q19/Q25/Q29/Q32 — see PHASE_8R_UNIFIED_NEEDS.md.

import { TagDimension } from './tags';

export type RenderMode = 'tier' | 'aisle' | 'flat';

// 'status' is a pseudo-dimension (filters the row field directly, not via tags).
// All other dimensions filter through need_tags / supply_tags joins.
export type ViewFilterDimension = 'status' | TagDimension;

export interface View {
  id: string;
  space_id: string;
  name: string;
  emoji: string;
  is_default: boolean;
  is_hidden: boolean;
  render_mode: RenderMode;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViewFilter {
  id: string;
  view_id: string;
  dimension: ViewFilterDimension;
  values: string[];
  created_at: string;
}

export interface ViewWithFilters extends View {
  filters: ViewFilter[];
}

export interface ViewFilterInput {
  dimension: ViewFilterDimension;
  values: string[];
}

export interface CreateViewParams {
  spaceId: string;
  name: string;
  emoji?: string;
  renderMode?: RenderMode;
  filters: ViewFilterInput[];
  createdBy: string;
}

export interface UpdateViewParams {
  name?: string;
  emoji?: string;
  renderMode?: RenderMode;
  sortOrder?: number;
}
