// ============================================
// FRIGO GROCERY - TYPESCRIPT TYPES (MULTIPLE LISTS SYSTEM)
// ============================================
// Location: lib/types/grocery.ts
// Updated: November 6, 2025 - Multiple independent lists with templates

// ============================================
// GROCERY LIST (CONTAINER) TYPES
// ============================================

export interface GroceryList {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  is_active: boolean;
  is_template: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type GroceryListInsert = Omit<GroceryList, 'id' | 'created_at' | 'updated_at'>;
export type GroceryListUpdate = Partial<Omit<GroceryListInsert, 'user_id'>>;

// Extended type with item counts
export interface GroceryListWithCounts extends GroceryList {
  total_items: number;
  checked_items: number;
  unchecked_items: number;
}

// ============================================
// GROCERY LIST ITEM TYPES
// ============================================

export interface GroceryListItem {
  id: string;
  user_id: string;
  list_id: string;  // FK to grocery_lists - which list this item belongs to
  ingredient_id: string;
  quantity_display: number;
  unit_display: string;
  brand_preference: string | null;  // NEW: e.g., "Kerrygold", "Kirkland"
  size_preference: string | null;   // NEW: e.g., "large", "family size", "2L"
  store_section: string | null;
  priority: 'needed' | 'nice_to_have';
  added_from: 'recipe' | 'pantry' | 'manual' | 'template' | null;
  recipe_id: string | null;
  source_pantry_item_id: string | null;
  is_in_cart: boolean;
  checked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type GroceryListItemInsert = Omit<GroceryListItem, 'id' | 'created_at' | 'updated_at'>;
export type GroceryListItemUpdate = Partial<Omit<GroceryListItemInsert, 'user_id'>>;

// Extended type with ingredient details
export interface GroceryListItemWithIngredient extends Omit<GroceryListItem, 'ingredient_id'> {
  ingredient_id: string;
  ingredient: {
    id: string;
    name: string;
    plural_name: string | null;
    family: string;
    ingredient_type: string | null;
    typical_unit: string | null;
  };
}

// Extended type with list and ingredient details
export interface GroceryListItemWithDetails extends GroceryListItemWithIngredient {
  list: {
    id: string;
    name: string;
    emoji: string;
    is_active: boolean;
    is_template: boolean;
  };
}

// ============================================
// REGULAR GROCERY ITEMS (unchanged)
// ============================================

export interface RegularGroceryItem {
  id: string;
  user_id: string;
  ingredient_id: string;
  quantity_display: number;
  unit_display: string;
  purchase_frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  frequency_days: number | null;
  last_purchased: string | null;
  next_suggested_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RegularGroceryItemInsert = Omit<RegularGroceryItem, 'id' | 'created_at' | 'updated_at'>;
export type RegularGroceryItemUpdate = Partial<RegularGroceryItemInsert>;

export interface RegularGroceryItemWithIngredient {
  id: string;
  user_id: string;
  ingredient_id: string;
  quantity_display: number;
  unit_display: string;
  purchase_frequency: PurchaseFrequency;
  frequency_days: number | null;
  last_purchased: string | null;
  next_suggested_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  ingredient: {
    id: string;
    name: string;
    plural_name: string | null;
    family: string;
    ingredient_type: string | null;
  };
}

// ============================================
// USER PREFERENCES (unchanged)
// ============================================

export interface UserPantryPreferences {
  user_id: string;
  default_storage_overrides: Record<string, string> | null;
  low_stock_threshold: number;
  critical_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export type UserPantryPreferencesUpdate = Partial<Omit<UserPantryPreferences, 'user_id' | 'created_at' | 'updated_at'>>;

// ============================================
// ENUM TYPES
// ============================================

export type AddedFrom = 'recipe' | 'pantry' | 'manual' | 'template';
export type Priority = 'needed' | 'nice_to_have';
export type PurchaseFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';

// ============================================
// SERVICE LAYER TYPES
// ============================================

// Create a new grocery list
export interface CreateGroceryListParams {
  name: string;
  emoji?: string;
  isActive?: boolean;
  isTemplate?: boolean;
  sortOrder?: number;
}

// Update a grocery list
export interface UpdateGroceryListParams {
  name?: string;
  emoji?: string;
  isActive?: boolean;
  isTemplate?: boolean;
  sortOrder?: number;
}

// Add item to a grocery list
export interface AddGroceryItemParams {
  listId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  brandPreference?: string;
  sizePreference?: string;
  priority?: Priority;
  addedFrom?: AddedFrom;
  recipeId?: string;
  sourcePantryItemId?: string;
  notes?: string;
}

// Update a grocery list item
export interface UpdateGroceryItemParams {
  quantity?: number;
  unit?: string;
  brandPreference?: string;
  sizePreference?: string;
  priority?: Priority;
  isInCart?: boolean;
  notes?: string;
}

// Duplicate/activate a template list
export interface DuplicateListParams {
  sourceListId: string;
  newName?: string;
  newEmoji?: string;
  makeActive?: boolean;
}

// Add items from regular grocery list
export interface AddRegularItemParams {
  ingredientId: string;
  quantity: number;
  unit: string;
  frequency: PurchaseFrequency;
  frequencyDays?: number;
}

export interface UpdateRegularItemParams {
  quantity?: number;
  unit?: string;
  frequency?: PurchaseFrequency;
  frequencyDays?: number;
  isActive?: boolean;
}

// Response types
export interface GroceryListResponse {
  items: GroceryListItemWithIngredient[];
  totalCount: number;
  checkedCount: number;
  uncheckedCount: number;
}

export interface GroceryListsResponse {
  lists: GroceryListWithCounts[];
  activeCount: number;
  templateCount: number;
}

// Quick add suggestions
export interface QuickAddSuggestions {
  dueSoon: RegularGroceryItemWithIngredient[];
  frequent: RegularGroceryItemWithIngredient[];
  recent: GroceryListItemWithIngredient[];
}

// Batch operations
export interface BatchAddToPantryResult {
  success: boolean;
  addedCount: number;
  failedCount: number;
  errors: string[];
}

// Constants
export const QUICK_ADD_LIMITS = {
  RECENT: 5,
  REGULAR: 10,
  DUE_SOON: 5,
} as const;

export const DEFAULT_LIST_EMOJIS = {
  default: '🛒',
  costco: '📦',
  weekend: '🎉',
  family: '👨‍👩‍👧‍👦',
  party: '🎊',
  holiday: '🎄',
  camping: '🏕️',
  bbq: '🍖',
  breakfast: '🥐',
  dinner: '🍽️',
} as const;