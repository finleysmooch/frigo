// Phase 8R-CP2a — tag taxonomy types.
// Per Q39: split tables (supply_tags + need_tags). Per Q1: predefined dimensions.

export type TagDimension = 'store' | 'urgency' | 'recipe' | 'event' | 'storage';

export interface Tag {
  id: string;
  space_id: string;
  dimension: TagDimension;
  value: string;
  created_by: string | null;
  created_at: string;
}

export interface SupplyTagRow {
  id: string;
  supply_id: string;
  tag_id: string;
  created_at: string;
}

export interface NeedTagRow {
  id: string;
  need_id: string;
  tag_id: string;
  created_at: string;
}
