// Phase 8R-CP2a — need types.
// Per Q5/Q6/Q10/Q14/Q28/Q36 — see PHASE_8R_UNIFIED_NEEDS.md.

import { Tag } from './tags';

export type NeedStatus = 'need' | 'in_cart' | 'acquired';
export type NeedAddedFrom = 'recipe' | 'supply_spawn' | 'manual';

export interface Need {
  id: string;
  space_id: string;
  ingredient_id: string | null;
  custom_name: string | null;
  status: NeedStatus;
  quantity_display: number | null;
  unit_display: string | null;
  for_user_ids: string[];
  supply_id: string | null;
  added_by: string | null;
  added_from: NeedAddedFrom | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NeedIngredient {
  id: string;
  name: string;
  plural_name: string | null;
  family: string;
  ingredient_type: string | null;
  typical_store_section: string | null;
}

export interface NeedWithTags extends Need {
  tags: Tag[];
  ingredient: NeedIngredient | null;
}

export interface NeedRecipe {
  id: string;
  need_id: string;
  recipe_id: string;
  recipe_quantity_amount: number | null;
  recipe_quantity_unit: string | null;
  added_by: string | null;
  created_at: string;
  recipe_title?: string;
}

export interface NeedWithDetails extends NeedWithTags {
  recipes: NeedRecipe[];
}

export interface CreateNeedParams {
  spaceId: string;
  ingredientId?: string;
  customName?: string;
  status?: NeedStatus;
  quantityDisplay?: number;
  unitDisplay?: string;
  forUserIds?: string[];
  supplyId?: string;
  addedBy: string;
  addedFrom: NeedAddedFrom;
  notes?: string;
  tagIds?: string[];
}

export interface AddNeedFromRecipeParams {
  spaceId: string;
  ingredientId: string;
  quantityDisplay: number;
  unitDisplay: string;
  recipeId: string;
  recipeQuantityAmount?: number;
  recipeQuantityUnit?: string;
  addedBy: string;
  tagIds?: string[];
}

export interface UpdateNeedParams {
  customName?: string | null;
  quantityDisplay?: number | null;
  unitDisplay?: string | null;
  forUserIds?: string[];
  notes?: string | null;
  tagIds?: string[];
}

// Display-merged group for view rendering (Q28/Q36).
export interface MergedNeedGroup {
  key: string;
  ingredientId: string | null;
  customName: string | null;
  unitDisplay: string | null;
  forUserIds: string[];
  storeTagIds: string[];
  totalQuantity: number | null;
  needs: NeedWithDetails[];
  allRecipes: NeedRecipe[];
}
