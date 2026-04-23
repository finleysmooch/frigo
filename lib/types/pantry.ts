// Pantry Types for Frigo
// Location: lib/types/pantry.ts

export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'counter';

export type StapleState = 'unknown' | 'good' | 'running_low' | 'out';

export interface PantryItem {
  id: string;
  user_id: string;
  ingredient_id: string;
  quantity_display: number;
  unit_display: string;
  quantity_metric: number | null;
  unit_metric: string | null;
  storage_location: StorageLocation;
  purchase_date: string; // ISO date string
  expiration_date: string | null; // ISO date string
  is_opened: boolean;
  opened_date: string | null; // ISO date string
  notes: string | null;
  last_confirmed_at: string | null;
  discarded_at: string | null;
  discarded_reason: string | null;
  thaw_planned_for: string | null;
  created_at: string;
  updated_at: string;
}

export interface PantryItemInsert {
  user_id: string;
  ingredient_id: string;
  quantity_display: number;
  unit_display: string;
  quantity_metric?: number | null;
  unit_metric?: string | null;
  storage_location: StorageLocation;
  purchase_date: string;
  expiration_date?: string | null;
  is_opened?: boolean;
  opened_date?: string | null;
  notes?: string | null;
  last_confirmed_at?: string | null;
  discarded_at?: string | null;
  discarded_reason?: string | null;
  thaw_planned_for?: string | null;
}

export interface PantryItemUpdate {
  quantity_display?: number;
  unit_display?: string;
  quantity_metric?: number | null;
  unit_metric?: string | null;
  storage_location?: StorageLocation;
  purchase_date?: string;
  expiration_date?: string | null;
  is_opened?: boolean;
  opened_date?: string | null;
  notes?: string | null;
  last_confirmed_at?: string | null;
  discarded_at?: string | null;
  discarded_reason?: string | null;
  thaw_planned_for?: string | null;
}

// ============================================
// PANTRY STAPLES (Phase 8A-CP1)
// ============================================
// Space-scoped, state-based staples (olive oil, salt, Motor City pizza).
// Separate from pantry_items — no quantity, no expiration.
// DB CHECK: ingredient_id IS NOT NULL OR custom_name IS NOT NULL.

export interface PantryStaple {
  id: string;
  space_id: string;
  ingredient_id: string | null;
  custom_name: string | null;
  state: StapleState;
  last_confirmed_at: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PantryStapleInsert {
  space_id: string;
  ingredient_id?: string | null;
  custom_name?: string | null;
  state?: StapleState;
  last_confirmed_at?: string | null;
  added_by?: string | null;
}

export interface PantryStapleUpdate {
  ingredient_id?: string | null;
  custom_name?: string | null;
  state?: StapleState;
  last_confirmed_at?: string | null;
}

// Extended Ingredient type with new pantry-related fields
export interface IngredientWithPantryData {
  id: string;
  name: string;
  plural_name: string | null;
  family: string;
  ingredient_type: string | null;
  ingredient_subtype: string | null;
  typical_unit: string | null;
  typical_weight_small_g: number | null;
  typical_weight_medium_g: number | null;
  typical_weight_large_g: number | null;
  default_storage_location: StorageLocation | null;
  shelf_life_days_fridge: number | null;
  shelf_life_days_freezer: number | null;
  shelf_life_days_pantry: number | null;
  shelf_life_days_counter: number | null;
  shelf_life_days_fridge_opened: number | null;
  shelf_life_days_pantry_opened: number | null;
  requires_metric_conversion: boolean;
}

// For displaying pantry summary (aggregated batches)
export interface PantryItemWithIngredient extends PantryItem {
  ingredient: {
    name: string;
    plural_name: string | null;
    family: string;
    ingredient_type: string | null;
  };
}

export interface PantrySummary {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_family: string;
  total_quantity_display: number;
  unit_display: string;
  total_quantity_metric: number | null;
  unit_metric: string | null;
  earliest_expiration: string | null;
  batch_count: number;
  batches: PantryItemWithIngredient[];
}