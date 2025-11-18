// ============================================
// FRIGO - STORE TYPES
// ============================================
// TypeScript types for stores and ingredient preferences
// Location: lib/types/store.ts
// Created: November 6, 2025

export interface Store {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export type PurchaseFrequency = 
  | 'weekly' 
  | 'biweekly' 
  | 'monthly' 
  | 'rarely' 
  | 'as_needed';

export interface UserIngredientPreference {
  id: string;
  user_id: string;
  ingredient_id: string;
  preferred_store_id: string | null;
  purchase_frequency: PurchaseFrequency | null;
  created_at: string;
  updated_at: string;
}

export interface IngredientWithPreference {
  id: string;
  name: string;
  plural_name: string | null;
  family: string;
  preferred_store_id: string | null;
  preferred_store?: Store | null;
  purchase_frequency: PurchaseFrequency | null;
}

// For display purposes
export interface StoreGroup {
  store: Store | null; // null = unassigned
  items: any[]; // GroceryListItemWithIngredient[]
  totalCount: number;
  checkedCount: number;
}

export interface FamilyGroup {
  family: string;
  emoji: string;
  items: any[];
  totalCount: number;
  checkedCount: number;
}

// Grocery list view modes
export type GroceryViewMode = 'family' | 'store';

// Store filter options
export type StoreFilter = 'all' | string; // 'all' or store ID

// Helper type for creating/updating preferences
export interface PreferenceInput {
  ingredient_id: string;
  preferred_store_id?: string | null;
  purchase_frequency?: PurchaseFrequency | null;
}