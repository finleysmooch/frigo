// lib/services/mealPlanService.ts
// Service for managing meal plan items (placeholders → claimed → recipe added → cooked)
// Created: December 3, 2025
// Updated: December 10, 2025 - Fixed claim bug, added host assignment feature

import { supabase } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

export type CourseType = 'appetizer' | 'main' | 'side' | 'dessert' | 'drink' | 'other';

export type PlanItemStatus = 'unclaimed' | 'assigned' | 'claimed' | 'has_recipe' | 'completed';

export interface MealPlanItem {
  id: string;
  meal_id: string;
  course_type: CourseType;
  placeholder_name?: string;
  is_main_dish: boolean;
  
  // Assignment info (host assigned to someone)
  assigned_to?: string;
  assigned_at?: string;
  assignee_username?: string;
  assignee_display_name?: string;
  assignee_avatar_url?: string;
  
  // Claim info (person accepted the assignment or self-claimed)
  claimed_by?: string;
  claimed_at?: string;
  claimer_username?: string;
  claimer_display_name?: string;
  claimer_avatar_url?: string;
  
  // Recipe info
  recipe_id?: string;
  recipe_title?: string;
  recipe_image_url?: string;
  
  // Completed dish info
  dish_id?: string;
  dish_title?: string;
  dish_rating?: number;
  completed_at?: string;
  
  // Audit
  created_at: string;
  created_by: string;
  
  // Computed
  status: PlanItemStatus;
}

export interface MealPlanSummary {
  total_items: number;
  claimed_items: number;
  unclaimed_items: number;
  assigned_items: number;
  with_recipe: number;
  completed: number;
}

export interface PlanningMealInfo {
  meal_id: string;
  title: string;
  meal_time?: string;
  role: string;
  unclaimed_count: number;
}

export interface AddPlanItemInput {
  course_type: CourseType;
  placeholder_name?: string;
  is_main_dish?: boolean;
  assigned_to?: string; // NEW: Host can assign during creation
}

// ============================================================================
// HELPER: Compute status from item data
// ============================================================================

function computeStatus(item: any): PlanItemStatus {
  if (item.dish_id) return 'completed';
  if (item.recipe_id) return 'has_recipe';
  if (item.claimed_by) return 'claimed';
  if (item.assigned_to) return 'assigned';
  return 'unclaimed';
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

export function getCourseDisplayName(course: CourseType): string {
  const names: Record<CourseType, string> = {
    appetizer: 'Appetizer',
    main: 'Main',
    side: 'Side',
    dessert: 'Dessert',
    drink: 'Drink',
    other: 'Other',
  };
  return names[course] || 'Other';
}

export function getCourseEmoji(course: CourseType): string {
  const emojis: Record<CourseType, string> = {
    appetizer: '🥗',
    main: '🍖',
    side: '🥔',
    dessert: '🍰',
    drink: '🍷',
    other: '🍽️',
  };
  return emojis[course] || '🍽️';
}

export function getPlanItemDisplayName(item: MealPlanItem): string {
  if (item.recipe_title) return item.recipe_title;
  if (item.placeholder_name) return item.placeholder_name;
  return getCourseDisplayName(item.course_type);
}

export function getStatusDisplayInfo(status: PlanItemStatus): {
  label: string;
  emoji: string;
  color: string;
} {
  switch (status) {
    case 'unclaimed':
      return { label: 'Needs someone', emoji: '❓', color: '#F59E0B' };
    case 'assigned':
      return { label: 'Assigned', emoji: '📌', color: '#8B5CF6' };
    case 'claimed':
      return { label: 'Claimed', emoji: '🙋', color: '#3B82F6' };
    case 'has_recipe':
      return { label: 'Recipe chosen', emoji: '📋', color: '#10B981' };
    case 'completed':
      return { label: 'Cooked', emoji: '✅', color: '#059669' };
    default:
      return { label: 'Unknown', emoji: '❔', color: '#6B7280' };
  }
}

export function groupPlanItemsByCourse(items: MealPlanItem[]): Map<CourseType, MealPlanItem[]> {
  const grouped = new Map<CourseType, MealPlanItem[]>();
  const courseOrder: CourseType[] = ['appetizer', 'main', 'side', 'dessert', 'drink', 'other'];
  
  courseOrder.forEach(course => grouped.set(course, []));
  
  items.forEach(item => {
    const group = grouped.get(item.course_type) || grouped.get('other')!;
    group.push(item);
  });
  
  return grouped;
}

// ============================================================================
// PLAN ITEM CRUD
// ============================================================================

/**
 * Add a plan item (placeholder) to a meal
 * Host only - can optionally assign to a participant
 */
export async function addPlanItem(
  mealId: string,
  userId: string,
  input: AddPlanItemInput
): Promise<{ success: boolean; planItemId?: string; error?: string }> {
  try {
    // Verify user is host
    const { data: participant } = await supabase
      .from('meal_participants')
      .select('role')
      .eq('meal_id', mealId)
      .eq('user_id', userId)
      .single();

    if (participant?.role !== 'host') {
      return { success: false, error: 'Only the host can add plan items' };
    }

    // Verify meal is in planning status
    const { data: meal } = await supabase
      .from('posts')
      .select('meal_status')
      .eq('id', mealId)
      .eq('post_type', 'meal')
      .single();

    if (meal?.meal_status !== 'planning') {
      return { success: false, error: 'Can only add plan items to meals in planning status' };
    }

    // If assigning to someone, verify they are an accepted participant
    if (input.assigned_to) {
      const { data: assignee } = await supabase
        .from('meal_participants')
        .select('rsvp_status')
        .eq('meal_id', mealId)
        .eq('user_id', input.assigned_to)
        .single();

      if (!assignee || assignee.rsvp_status !== 'accepted') {
        return { success: false, error: 'Can only assign to accepted participants' };
      }
    }

    // Insert plan item
    const { data, error } = await supabase
      .from('meal_dish_plans')
      .insert({
        meal_id: mealId,
        course_type: input.course_type,
        placeholder_name: input.placeholder_name?.trim() || null,
        is_main_dish: input.is_main_dish || false,
        assigned_to: input.assigned_to || null,
        assigned_at: input.assigned_to ? new Date().toISOString() : null,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, planItemId: data.id };
  } catch (error) {
    console.error('Error adding plan item:', error);
    return { success: false, error: 'Failed to add plan item' };
  }
}

/**
 * Add multiple plan items at once (for quick setup like "3 sides, 2 mains")
 */
export async function addMultiplePlanItems(
  mealId: string,
  userId: string,
  items: AddPlanItemInput[]
): Promise<{ success: boolean; addedCount?: number; error?: string }> {
  try {
    // Verify user is host
    const { data: participant } = await supabase
      .from('meal_participants')
      .select('role')
      .eq('meal_id', mealId)
      .eq('user_id', userId)
      .single();

    if (participant?.role !== 'host') {
      return { success: false, error: 'Only the host can add plan items' };
    }

    // Verify meal is in planning status
    const { data: meal } = await supabase
      .from('posts')
      .select('meal_status')
      .eq('id', mealId)
      .eq('post_type', 'meal')
      .single();

    if (meal?.meal_status !== 'planning') {
      return { success: false, error: 'Can only add plan items to meals in planning status' };
    }

    // Insert all items
    const insertData = items.map(item => ({
      meal_id: mealId,
      course_type: item.course_type,
      placeholder_name: item.placeholder_name?.trim() || null,
      is_main_dish: item.is_main_dish || false,
      assigned_to: item.assigned_to || null,
      assigned_at: item.assigned_to ? new Date().toISOString() : null,
      created_by: userId,
    }));

    const { data, error } = await supabase
      .from('meal_dish_plans')
      .insert(insertData)
      .select('id');

    if (error) throw error;

    return { success: true, addedCount: data?.length || 0 };
  } catch (error) {
    console.error('Error adding multiple plan items:', error);
    return { success: false, error: 'Failed to add plan items' };
  }
}

/**
 * Delete a plan item
 * Host only
 */
export async function deletePlanItem(
  planItemId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the plan item to find meal_id
    const { data: planItem } = await supabase
      .from('meal_dish_plans')
      .select('meal_id')
      .eq('id', planItemId)
      .single();

    if (!planItem) {
      return { success: false, error: 'Plan item not found' };
    }

    // Verify user is host
    const { data: participant } = await supabase
      .from('meal_participants')
      .select('role')
      .eq('meal_id', planItem.meal_id)
      .eq('user_id', userId)
      .single();

    if (participant?.role !== 'host') {
      return { success: false, error: 'Only the host can delete plan items' };
    }

    // Delete
    const { error } = await supabase
      .from('meal_dish_plans')
      .delete()
      .eq('id', planItemId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting plan item:', error);
    return { success: false, error: 'Failed to delete plan item' };
  }
}

/**
 * Update a plan item's basic info (course type, name)
 * Host only
 */
export async function updatePlanItem(
  planItemId: string,
  userId: string,
  updates: {
    course_type?: CourseType;
    placeholder_name?: string;
    is_main_dish?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the plan item to find meal_id
    const { data: planItem } = await supabase
      .from('meal_dish_plans')
      .select('meal_id')
      .eq('id', planItemId)
      .single();

    if (!planItem) {
      return { success: false, error: 'Plan item not found' };
    }

    // Verify user is host
    const { data: participant } = await supabase
      .from('meal_participants')
      .select('role')
      .eq('meal_id', planItem.meal_id)
      .eq('user_id', userId)
      .single();

    if (participant?.role !== 'host') {
      return { success: false, error: 'Only the host can update plan items' };
    }

    // Update
    const { error } = await supabase
      .from('meal_dish_plans')
      .update({
        course_type: updates.course_type,
        placeholder_name: updates.placeholder_name?.trim() || null,
        is_main_dish: updates.is_main_dish,
      })
      .eq('id', planItemId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating plan item:', error);
    return { success: false, error: 'Failed to update plan item' };
  }
}

// ============================================================================
// ASSIGNMENT OPERATIONS (NEW)
// ============================================================================

/**
 * Assign a plan item to a participant
 * Host only
 */
export async function assignPlanItem(
  planItemId: string,
  hostUserId: string,
  assigneeUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the plan item
    const { data: planItem } = await supabase
      .from('meal_dish_plans')
      .select('meal_id, claimed_by, dish_id')
      .eq('id', planItemId)
      .single();

    if (!planItem) {
      return { success: false, error: 'Plan item not found' };
    }

    if (planItem.dish_id) {
      return { success: false, error: 'Cannot reassign a completed item' };
    }

    if (planItem.claimed_by) {
      return { success: false, error: 'This item is already claimed. Unclaim it first to reassign.' };
    }

    // Verify user is host
    const { data: hostParticipant } = await supabase
      .from('meal_participants')
      .select('role')
      .eq('meal_id', planItem.meal_id)
      .eq('user_id', hostUserId)
      .single();

    if (hostParticipant?.role !== 'host') {
      return { success: false, error: 'Only the host can assign items' };
    }

    // Verify assignee is an accepted participant
    const { data: assigneeParticipant } = await supabase
      .from('meal_participants')
      .select('rsvp_status')
      .eq('meal_id', planItem.meal_id)
      .eq('user_id', assigneeUserId)
      .single();

    if (!assigneeParticipant || assigneeParticipant.rsvp_status !== 'accepted') {
      return { success: false, error: 'Can only assign to accepted participants' };
    }

    // Assign
    const { error } = await supabase
      .from('meal_dish_plans')
      .update({
        assigned_to: assigneeUserId,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', planItemId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error assigning plan item:', error);
    return { success: false, error: 'Failed to assign plan item' };
  }
}

/**
 * Unassign a plan item
 * Host only
 */
export async function unassignPlanItem(
  planItemId: string,
  hostUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the plan item
    const { data: planItem } = await supabase
      .from('meal_dish_plans')
      .select('meal_id, claimed_by, dish_id')
      .eq('id', planItemId)
      .single();

    if (!planItem) {
      return { success: false, error: 'Plan item not found' };
    }

    if (planItem.claimed_by) {
      return { success: false, error: 'Cannot unassign a claimed item. Unclaim it first.' };
    }

    // Verify user is host
    const { data: hostParticipant } = await supabase
      .from('meal_participants')
      .select('role')
      .eq('meal_id', planItem.meal_id)
      .eq('user_id', hostUserId)
      .single();

    if (hostParticipant?.role !== 'host') {
      return { success: false, error: 'Only the host can unassign items' };
    }

    // Unassign
    const { error } = await supabase
      .from('meal_dish_plans')
      .update({
        assigned_to: null,
        assigned_at: null,
      })
      .eq('id', planItemId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error unassigning plan item:', error);
    return { success: false, error: 'Failed to unassign plan item' };
  }
}

// ============================================================================
// CLAIM OPERATIONS (FIXED)
// ============================================================================

/**
 * Claim a plan item
 * - Accepted participants can claim unclaimed or assigned-to-them items
 * - Host can always claim any unclaimed/assigned item
 */
export async function claimPlanItem(
  planItemId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[claimPlanItem] Starting claim for item:', planItemId, 'user:', userId);
    
    // Get the plan item
    const { data: planItem, error: planItemError } = await supabase
      .from('meal_dish_plans')
      .select('meal_id, claimed_by, assigned_to')
      .eq('id', planItemId)
      .single();

    if (planItemError) {
      console.error('[claimPlanItem] Error fetching plan item:', planItemError);
      return { success: false, error: 'Plan item not found' };
    }

    if (!planItem) {
      return { success: false, error: 'Plan item not found' };
    }

    if (planItem.claimed_by) {
      return { success: false, error: 'This item is already claimed' };
    }

    // Get participant info for the user
    const { data: participant, error: participantError } = await supabase
      .from('meal_participants')
      .select('role, rsvp_status')
      .eq('meal_id', planItem.meal_id)
      .eq('user_id', userId)
      .single();

    if (participantError) {
      console.error('[claimPlanItem] Error fetching participant:', participantError);
      return { success: false, error: 'You are not a participant in this meal' };
    }

    if (!participant) {
      return { success: false, error: 'You are not a participant in this meal' };
    }

    const isHost = participant.role === 'host';
    const isAccepted = participant.rsvp_status === 'accepted';
    const isAssignedToUser = planItem.assigned_to === userId;

    console.log('[claimPlanItem] User status - isHost:', isHost, 'isAccepted:', isAccepted, 'isAssignedToUser:', isAssignedToUser);

    // Permission check:
    // - Host can always claim
    // - Accepted participants can claim unclaimed items
    // - Assigned users can claim their assigned items
    if (!isHost && !isAccepted) {
      return { success: false, error: 'You must accept the meal invitation before claiming items' };
    }

    // If item is assigned to someone else (not host, not the assignee), don't allow claim
    if (planItem.assigned_to && planItem.assigned_to !== userId && !isHost) {
      return { success: false, error: 'This item is assigned to someone else' };
    }

    // Claim it
    const { error: updateError } = await supabase
      .from('meal_dish_plans')
      .update({
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', planItemId);

    if (updateError) {
      console.error('[claimPlanItem] Error updating claim:', updateError);
      throw updateError;
    }

    console.log('[claimPlanItem] Successfully claimed item');
    return { success: true };
  } catch (error) {
    console.error('[claimPlanItem] Unexpected error:', error);
    return { success: false, error: 'Failed to claim plan item' };
  }
}

/**
 * Unclaim a plan item
 * Only the claimer or host can unclaim
 */
export async function unclaimPlanItem(
  planItemId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the plan item
    const { data: planItem } = await supabase
      .from('meal_dish_plans')
      .select('meal_id, claimed_by, dish_id')
      .eq('id', planItemId)
      .single();

    if (!planItem) {
      return { success: false, error: 'Plan item not found' };
    }

    if (!planItem.claimed_by) {
      return { success: false, error: 'This item is not claimed' };
    }

    if (planItem.dish_id) {
      return { success: false, error: 'Cannot unclaim a completed dish' };
    }

    // Check if user is the claimer or host
    const isOwner = planItem.claimed_by === userId;
    
    const { data: participant } = await supabase
      .from('meal_participants')
      .select('role')
      .eq('meal_id', planItem.meal_id)
      .eq('user_id', userId)
      .single();

    const isHost = participant?.role === 'host';

    if (!isOwner && !isHost) {
      return { success: false, error: 'Only the claimer or host can unclaim this item' };
    }

    // Unclaim (also clears recipe since they're not making it anymore)
    const { error } = await supabase
      .from('meal_dish_plans')
      .update({
        claimed_by: null,
        claimed_at: null,
        recipe_id: null,
      })
      .eq('id', planItemId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error unclaiming plan item:', error);
    return { success: false, error: 'Failed to unclaim plan item' };
  }
}

// ============================================================================
// RECIPE OPERATIONS
// ============================================================================

/**
 * Add a recipe to a claimed plan item
 * Only the claimer can add a recipe
 */
export async function addRecipeToPlanItem(
  planItemId: string,
  userId: string,
  recipeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the plan item
    const { data: planItem } = await supabase
      .from('meal_dish_plans')
      .select('meal_id, claimed_by')
      .eq('id', planItemId)
      .single();

    if (!planItem) {
      return { success: false, error: 'Plan item not found' };
    }

    if (planItem.claimed_by !== userId) {
      return { success: false, error: 'Only the person who claimed this item can add a recipe' };
    }

    // Verify recipe exists
    const { data: recipe } = await supabase
      .from('recipes')
      .select('id')
      .eq('id', recipeId)
      .single();

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Add recipe
    const { error } = await supabase
      .from('meal_dish_plans')
      .update({
        recipe_id: recipeId,
      })
      .eq('id', planItemId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error adding recipe to plan item:', error);
    return { success: false, error: 'Failed to add recipe' };
  }
}

/**
 * Volunteer with a recipe - claim an item and add recipe in one step
 */
export async function volunteerWithRecipe(
  planItemId: string,
  userId: string,
  recipeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the plan item
    const { data: planItem } = await supabase
      .from('meal_dish_plans')
      .select('meal_id, claimed_by, assigned_to')
      .eq('id', planItemId)
      .single();

    if (!planItem) {
      return { success: false, error: 'Plan item not found' };
    }

    if (planItem.claimed_by) {
      return { success: false, error: 'This item is already claimed' };
    }

    // Check participant status
    const { data: participant } = await supabase
      .from('meal_participants')
      .select('role, rsvp_status')
      .eq('meal_id', planItem.meal_id)
      .eq('user_id', userId)
      .single();

    const isHost = participant?.role === 'host';
    const isAccepted = participant?.rsvp_status === 'accepted';

    if (!isHost && !isAccepted) {
      return { success: false, error: 'You must accept the meal invitation first' };
    }

    // Check assignment rules
    if (planItem.assigned_to && planItem.assigned_to !== userId && !isHost) {
      return { success: false, error: 'This item is assigned to someone else' };
    }

    // Verify recipe exists
    const { data: recipe } = await supabase
      .from('recipes')
      .select('id')
      .eq('id', recipeId)
      .single();

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Claim and add recipe in one update
    const { error } = await supabase
      .from('meal_dish_plans')
      .update({
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        recipe_id: recipeId,
      })
      .eq('id', planItemId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error volunteering with recipe:', error);
    return { success: false, error: 'Failed to volunteer' };
  }
}

// ============================================================================
// COMPLETION OPERATIONS
// ============================================================================

/**
 * Complete a plan item by linking a dish post
 */
export async function completePlanItem(
  planItemId: string,
  userId: string,
  dishId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the plan item
    const { data: planItem } = await supabase
      .from('meal_dish_plans')
      .select('meal_id, claimed_by, course_type, is_main_dish')
      .eq('id', planItemId)
      .single();

    if (!planItem) {
      return { success: false, error: 'Plan item not found' };
    }

    // Verify claimer
    if (planItem.claimed_by !== userId) {
      return { success: false, error: 'Only the claimer can complete this item' };
    }

    // Verify dish exists and belongs to user
    const { data: dish } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', dishId)
      .eq('post_type', 'dish')
      .single();

    if (!dish) {
      return { success: false, error: 'Dish not found' };
    }

    if (dish.user_id !== userId) {
      return { success: false, error: 'You can only link your own dishes' };
    }

    // Update plan item with dish reference
    const { error: updateError } = await supabase
      .from('meal_dish_plans')
      .update({
        dish_id: dishId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', planItemId);

    if (updateError) throw updateError;

    // Also add to dish_courses for backward compatibility
    const { error: courseError } = await supabase
      .from('dish_courses')
      .insert({
        dish_id: dishId,
        meal_id: planItem.meal_id,
        course_type: planItem.course_type,
        is_main_dish: planItem.is_main_dish,
      });

    // Ignore if dish_courses entry already exists
    if (courseError && !courseError.message.includes('duplicate')) {
      console.warn('Warning adding to dish_courses:', courseError);
    }

    return { success: true };
  } catch (error) {
    console.error('Error completing plan item:', error);
    return { success: false, error: 'Failed to complete plan item' };
  }
}

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * Get all plan items for a meal
 */
export async function getMealPlanItems(mealId: string): Promise<MealPlanItem[]> {
  try {
    const { data, error } = await supabase
      .from('meal_dish_plans')
      .select(`
        id,
        meal_id,
        course_type,
        placeholder_name,
        is_main_dish,
        assigned_to,
        assigned_at,
        claimed_by,
        claimed_at,
        recipe_id,
        dish_id,
        completed_at,
        created_at,
        created_by,
        assignee:user_profiles!meal_dish_plans_assigned_to_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        claimer:user_profiles!meal_dish_plans_claimed_by_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        recipe:recipes(
          id,
          title,
          image_url
        ),
        dish:posts!meal_dish_plans_dish_id_fkey(
          id,
          title,
          rating
        )
      `)
      .eq('meal_id', mealId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      meal_id: item.meal_id,
      course_type: item.course_type as CourseType,
      placeholder_name: item.placeholder_name,
      is_main_dish: item.is_main_dish,
      assigned_to: item.assigned_to,
      assigned_at: item.assigned_at,
      assignee_username: item.assignee?.username,
      assignee_display_name: item.assignee?.display_name,
      assignee_avatar_url: item.assignee?.avatar_url,
      claimed_by: item.claimed_by,
      claimed_at: item.claimed_at,
      claimer_username: item.claimer?.username,
      claimer_display_name: item.claimer?.display_name,
      claimer_avatar_url: item.claimer?.avatar_url,
      recipe_id: item.recipe_id,
      recipe_title: item.recipe?.title,
      recipe_image_url: item.recipe?.image_url,
      dish_id: item.dish_id,
      dish_title: item.dish?.title,
      dish_rating: item.dish?.rating,
      completed_at: item.completed_at,
      created_at: item.created_at,
      created_by: item.created_by,
      status: computeStatus(item),
    }));
  } catch (error) {
    console.error('Error getting meal plan items:', error);
    return [];
  }
}

/**
 * Get summary counts for a meal's plan
 */
export async function getMealPlanSummary(mealId: string): Promise<MealPlanSummary | null> {
  try {
    const items = await getMealPlanItems(mealId);
    
    return {
      total_items: items.length,
      unclaimed_items: items.filter(i => i.status === 'unclaimed').length,
      assigned_items: items.filter(i => i.status === 'assigned').length,
      claimed_items: items.filter(i => i.status === 'claimed' || i.status === 'has_recipe' || i.status === 'completed').length,
      with_recipe: items.filter(i => i.status === 'has_recipe' || i.status === 'completed').length,
      completed: items.filter(i => i.status === 'completed').length,
    };
  } catch (error) {
    console.error('Error getting meal plan summary:', error);
    return null;
  }
}

/**
 * Get unclaimed items for a meal (for participant UI)
 */
export async function getUnclaimedPlanItems(mealId: string): Promise<MealPlanItem[]> {
  try {
    const allItems = await getMealPlanItems(mealId);
    return allItems.filter(item => item.status === 'unclaimed' || item.status === 'assigned');
  } catch (error) {
    console.error('Error getting unclaimed plan items:', error);
    return [];
  }
}

/**
 * Get items assigned to a specific user
 */
export async function getUserAssignedItems(
  mealId: string,
  userId: string
): Promise<MealPlanItem[]> {
  try {
    const allItems = await getMealPlanItems(mealId);
    return allItems.filter(item => item.assigned_to === userId && !item.claimed_by);
  } catch (error) {
    console.error('Error getting user assigned items:', error);
    return [];
  }
}

/**
 * Get items claimed by a specific user
 */
export async function getUserClaimedItems(
  mealId: string,
  userId: string
): Promise<MealPlanItem[]> {
  try {
    const allItems = await getMealPlanItems(mealId);
    return allItems.filter(item => item.claimed_by === userId);
  } catch (error) {
    console.error('Error getting user claimed items:', error);
    return [];
  }
}

/**
 * Get plan items for the current user across all their meals
 * Shows what they've committed to cook
 */
export async function getUserPlanCommitments(userId: string): Promise<{
  plan_item_id: string;
  meal_id: string;
  meal_title: string;
  meal_time?: string;
  course_type: CourseType;
  placeholder_name?: string;
  recipe_title?: string;
  status: PlanItemStatus;
}[]> {
  try {
    const { data, error } = await supabase
      .from('meal_dish_plans')
      .select(`
        id,
        meal_id,
        course_type,
        placeholder_name,
        recipe_id,
        dish_id,
        claimed_by,
        assigned_to,
        posts!meal_dish_plans_meal_id_fkey(
          title,
          meal_time,
          meal_status
        ),
        recipes(title)
      `)
      .or(`claimed_by.eq.${userId},assigned_to.eq.${userId}`)
      .eq('posts.meal_status', 'planning');

    if (error) throw error;

    return (data || [])
      .filter((item: any) => item.posts?.meal_status === 'planning')
      .map((item: any) => ({
        plan_item_id: item.id,
        meal_id: item.meal_id,
        meal_title: item.posts?.title || 'Untitled Meal',
        meal_time: item.posts?.meal_time,
        course_type: item.course_type as CourseType,
        placeholder_name: item.placeholder_name,
        recipe_title: item.recipes?.title,
        status: computeStatus(item),
      }));
  } catch (error) {
    console.error('Error getting user plan commitments:', error);
    return [];
  }
}

/**
 * Get meals where user is planning to bring something
 */
export async function getUserPlanningMeals(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('meal_dish_plans')
      .select('meal_id')
      .or(`claimed_by.eq.${userId},assigned_to.eq.${userId}`);

    if (error) throw error;

    return [...new Set((data || []).map(item => item.meal_id))];
  } catch (error) {
    console.error('Error getting user planning meals:', error);
    return [];
  }
}

/**
 * Get plan items that have a specific recipe
 */
export async function getMealsWithRecipe(recipeId: string): Promise<{
  meal_id: string;
  meal_title: string;
  plan_item_id: string;
  claimed_by?: string;
  status: PlanItemStatus;
}[]> {
  try {
    const { data, error } = await supabase
      .from('meal_dish_plans')
      .select(`
        id,
        meal_id,
        claimed_by,
        assigned_to,
        dish_id,
        recipe_id,
        posts!meal_dish_plans_meal_id_fkey(title)
      `)
      .eq('recipe_id', recipeId);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      meal_id: item.meal_id,
      meal_title: (item.posts as any)?.title || 'Untitled Meal',
      plan_item_id: item.id,
      claimed_by: item.claimed_by,
      status: computeStatus(item),
    }));
  } catch (error) {
    console.error('Error getting meals with recipe:', error);
    return [];
  }
}

/**
 * Create a plan item AND add a recipe in one step
 * Used for quick meal planning where user wants to add a recipe directly
 */
export async function createPlanItemWithRecipe(
  mealId: string,
  userId: string,
  recipeId: string,
  courseType: CourseType,
  isMainDish: boolean = false
): Promise<{ success: boolean; planItemId?: string; error?: string }> {
  try {
    // Verify user is a participant (host or accepted)
    const { data: participant } = await supabase
      .from('meal_participants')
      .select('role, rsvp_status')
      .eq('meal_id', mealId)
      .eq('user_id', userId)
      .single();

    const isHost = participant?.role === 'host';
    const isAccepted = participant?.rsvp_status === 'accepted';

    if (!isHost && !isAccepted) {
      return { success: false, error: 'You must be a participant to add recipes' };
    }

    // Verify meal is in planning status
    const { data: meal } = await supabase
      .from('posts')
      .select('meal_status')
      .eq('id', mealId)
      .eq('post_type', 'meal')
      .single();

    if (meal?.meal_status !== 'planning') {
      return { success: false, error: 'Can only add to meals in planning status' };
    }

    // Verify recipe exists
    const { data: recipe } = await supabase
      .from('recipes')
      .select('id, title')
      .eq('id', recipeId)
      .single();

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Create plan item with recipe and claimed by user in one insert
    const { data, error } = await supabase
      .from('meal_dish_plans')
      .insert({
        meal_id: mealId,
        course_type: courseType,
        placeholder_name: recipe.title, // Use recipe title as placeholder
        is_main_dish: isMainDish,
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        recipe_id: recipeId,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, planItemId: data.id };
  } catch (error) {
    console.error('Error creating plan item with recipe:', error);
    return { success: false, error: 'Failed to add recipe to meal' };
  }
}

/**
 * Get planning meals for a user with full details
 * Returns meals where user is host or accepted participant
 */
export async function getUserPlanningMealsWithDetails(
  userId: string
): Promise<PlanningMealInfo[]> {
  try {
    // Get meals where user is a participant
    const { data: participantData, error: participantError } = await supabase
      .from('meal_participants')
      .select(`
        meal_id,
        role,
        rsvp_status,
        posts!meal_participants_meal_id_fkey (
          id,
          title,
          meal_time,
          meal_status
        )
      `)
      .eq('user_id', userId)
      .in('rsvp_status', ['accepted', 'pending']);

    if (participantError) throw participantError;

    // Filter to only planning meals
    const planningMeals = (participantData || []).filter(
      (p: any) => p.posts?.meal_status === 'planning'
    );

    // Get unclaimed counts for each meal
    const results: PlanningMealInfo[] = await Promise.all(
      planningMeals.map(async (p: any) => {
        const { count } = await supabase
          .from('meal_dish_plans')
          .select('id', { count: 'exact', head: true })
          .eq('meal_id', p.meal_id)
          .is('claimed_by', null);

        return {
          meal_id: p.meal_id,
          title: p.posts?.title || 'Untitled Meal',
          meal_time: p.posts?.meal_time,
          role: p.role,
          unclaimed_count: count || 0,
        };
      })
    );

    // Sort by meal_time (upcoming first)
    return results.sort((a, b) => {
      if (!a.meal_time && !b.meal_time) return 0;
      if (!a.meal_time) return 1;
      if (!b.meal_time) return -1;
      return new Date(a.meal_time).getTime() - new Date(b.meal_time).getTime();
    });
  } catch (error) {
    console.error('Error getting user planning meals with details:', error);
    return [];
  }
}