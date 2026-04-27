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
  store_name: string | null;   // Phase 8C-CP1a — optional store association (e.g., "Costco")
  created_at: string;
  updated_at: string;
}

export type GroceryListInsert = Omit<GroceryList, 'id' | 'created_at' | 'updated_at'>;
export type GroceryListUpdate = Partial<Omit<GroceryListInsert, 'user_id'>>;

// Extended type with item counts
// Phase 8C-CP1: tier counts added so the lists screen can show
// "{now} now · {could_wait} could wait · {in_cart} in cart" without N+1 queries.
export interface GroceryListWithCounts extends GroceryList {
  total_items: number;
  checked_items: number;
  unchecked_items: number;
  now_count: number;
  could_wait_count: number;
  in_cart_count: number;
}

// ============================================
// GROCERY LIST ITEM TYPES
// ============================================

export interface GroceryListItem {
  id: string;
  user_id: string;
  list_id: string;  // FK to grocery_lists - which list this item belongs to
  ingredient_id: string | null;  // Phase 8A-CP1: nullable — custom items set custom_name instead
  custom_name: string | null;    // Phase 8A-CP1: for non-ingredient items (duct tape, toilet paper)
  quantity_display: number;
  unit_display: string;
  brand_preference: string | null;  // NEW: e.g., "Kerrygold", "Kirkland"
  size_preference: string | null;   // NEW: e.g., "large", "family size", "2L"
  store_section: string | null;
  priority: 'needed' | 'nice_to_have';
  priority_reason: string | null;   // Phase 8A-CP1: machine-populated tier reason (staple out / for X recipe / manual)
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
// Phase 8A-CP1: ingredient_id stays nullable here since custom items still populate
// this shape with ingredient_id=null + custom_name=<value>. The `ingredient` join
// is null for custom items.
export interface GroceryListItemWithIngredient extends GroceryListItem {
  ingredient: {
    id: string;
    name: string;
    plural_name: string | null;
    family: string;
    ingredient_type: string | null;
    typical_unit: string | null;
    typical_store_section: string | null;
  } | null;
}

// Phase 8C-CP2: cross-list ingredient overlap result
// Returned by getOtherListsContainingIngredient — names the other active lists
// that still have this ingredient as a not-yet-in-cart entry.
export interface CrossListIngredientPresence {
  list_id: string;
  list_name: string;
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
  storeName?: string;   // Phase 8C-CP1a
}

// Update a grocery list
export interface UpdateGroceryListParams {
  name?: string;
  emoji?: string;
  isActive?: boolean;
  isTemplate?: boolean;
  sortOrder?: number;
  storeName?: string;   // Phase 8C-CP1a
}

// Add item to a grocery list
// Phase 8A-CP1: ingredientId is now optional — custom items set customName instead.
// One of ingredientId or customName MUST be provided (matches grocery_item_has_identity CHECK).
export interface AddGroceryItemParams {
  listId: string;
  ingredientId?: string | null;
  customName?: string | null;
  quantity: number;
  unit: string;
  brandPreference?: string;
  sizePreference?: string;
  priority?: Priority;
  priorityReason?: string;
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
  priorityReason?: string | null;
  customName?: string | null;
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