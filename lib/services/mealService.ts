// lib/services/mealService.ts
// Service for managing meals (collections of dishes)
// Created: December 2, 2025

import { supabase } from '../supabase';
import { computeMealTypeFromHour } from '../utils/mealTypeHelpers';
import type { MealEventContext } from '../types/feed';

// Re-export for consumers that used to import the type from this file.
export type { MealEventContext };

// ============================================================================
// TYPES
// ============================================================================

export type MealStatus = 'planning' | 'completed';
export type ParticipantRole = 'host' | 'attendee';
export type RSVPStatus = 'pending' | 'accepted' | 'maybe' | 'declined';
export type CourseType = 'appetizer' | 'main' | 'side' | 'dessert' | 'drink' | 'other';

export interface Meal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  meal_type?: string;
  meal_status: MealStatus;
  meal_time?: string;
  meal_location?: string;
  photos?: any[];
  created_at: string;
  /**
   * Phase 7I Checkpoint 1 migration (2026-04-13): this field type shifted from
   * 'meal' to 'meal_event'. The DB rows and interface value both changed.
   * The legacy 'meal' value was removed from the `PostType` union in
   * Checkpoint 7 cleanup.
   */
  post_type: 'meal_event';
}

export interface MealParticipant {
  id: string;
  meal_id: string;
  user_id: string;
  role: ParticipantRole;
  rsvp_status: RSVPStatus;
  invited_at: string;
  responded_at?: string;
  user_profile?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    subscription_tier?: string;
  };
  dish_count?: number;
}

export interface DishInMeal {
  dish_id: string;
  dish_title: string;
  dish_user_id: string;
  dish_rating?: number;
  dish_photos?: any[];
  dish_created_at: string;
  recipe_id?: string;
  recipe_title?: string;
  recipe_image_url?: string;
  /** Recipe cook time in minutes — added to get_meal_dishes RPC in 7F Checkpoint 2 fix pass */
  recipe_cook_time_min?: number | null;
  /** Recipe times cooked counter — added to get_meal_dishes RPC in 7F Checkpoint 2 fix pass */
  recipe_times_cooked?: number | null;
  course_type: CourseType;
  is_main_dish: boolean;
  course_order?: number;
  contributor_username?: string;
  contributor_display_name?: string;
  contributor_avatar_url?: string;
}

export interface MealWithDetails extends Meal {
  dish_count: number;
  participant_count: number;
  host_id: string;
  dish_ids?: string[];
  participant_ids?: string[];
  host_profile?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  /** Aggregate times_cooked across all dishes in the meal (null treated as 0) */
  total_times_cooked?: number;
  /** Aggregate cook_time_min across all dishes in the meal (null treated as 0) */
  total_cook_time_min?: number;
}

export interface CreateMealInput {
  title: string;
  description?: string;
  meal_type?: string;
  meal_time?: string;
  meal_location?: string;
}

export interface AddDishInput {
  dish_id: string;
  course_type: CourseType;
  is_main_dish?: boolean;
  course_order?: number;
}

// ============================================================================
// SMART-DETECT: Planned meal detection for cook logging (D33)
// ============================================================================

export interface SmartDetectResult {
  meal: Meal;
  confidence: 'high' | 'low';
}

/**
 * Detect whether the user has a planned meal that matches this cook.
 * Tiered fallback: ±4hr of now → meal-type slot today → any meal today.
 * Confidence: high if recipe is in the meal's dish plans, low otherwise.
 */
export async function detectPlannedMealForCook(
  userId: string,
  recipeId: string
): Promise<SmartDetectResult | null> {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Infer current meal-type slot from time of day (shared 4-band helper)
    const currentMealSlot = computeMealTypeFromHour(now);

    // Fetch all of the user's planning-status meals for today
    const { data: todayMeals, error } = await supabase
      .from('posts')
      .select('id, user_id, title, description, meal_type, meal_status, meal_time, meal_location, photos, created_at, post_type')
      .eq('user_id', userId)
      .eq('post_type', 'meal_event')
      .eq('meal_status', 'planning')
      .or(`and(meal_time.gte.${todayStart.toISOString()},meal_time.lte.${todayEnd.toISOString()}),and(meal_time.is.null,created_at.gte.${todayStart.toISOString()})`)
      .order('meal_time', { ascending: true, nullsFirst: false });

    if (error || !todayMeals || todayMeals.length === 0) {
      return null;
    }

    // Tier 1: meals within ±4hr of now
    const fourHourMs = 4 * 60 * 60 * 1000;
    const nearbyMeals = todayMeals.filter(m => {
      if (!m.meal_time) return false;
      const mealTime = new Date(m.meal_time).getTime();
      return Math.abs(mealTime - now.getTime()) <= fourHourMs;
    });

    // Tier 2: meals matching current meal-type slot today
    const slotMeals = todayMeals.filter(m => m.meal_type === currentMealSlot);

    // Tier 3: any planned meal today (already fetched)

    // Pick the best match: tier 1 first, then tier 2, then tier 3
    let matchedMeal: any = null;

    if (nearbyMeals.length > 0) {
      // Pick the one closest in time to now
      nearbyMeals.sort((a, b) => {
        const aDiff = Math.abs(new Date(a.meal_time).getTime() - now.getTime());
        const bDiff = Math.abs(new Date(b.meal_time).getTime() - now.getTime());
        return aDiff - bDiff;
      });
      matchedMeal = nearbyMeals[0];
    } else if (slotMeals.length > 0) {
      // Pick the first slot match (closest to now if multiple)
      matchedMeal = slotMeals[0];
    } else if (todayMeals.length > 0) {
      // Any meal today — pick the one closest to now
      const withTime = todayMeals.filter(m => m.meal_time);
      if (withTime.length > 0) {
        withTime.sort((a, b) => {
          const aDiff = Math.abs(new Date(a.meal_time).getTime() - now.getTime());
          const bDiff = Math.abs(new Date(b.meal_time).getTime() - now.getTime());
          return aDiff - bDiff;
        });
        matchedMeal = withTime[0];
      } else {
        // Meals with no time — just pick the first one
        matchedMeal = todayMeals[0];
      }
    }

    if (!matchedMeal) return null;

    // Check confidence: does this meal's plan include the recipe being logged?
    const { data: planItems } = await supabase
      .from('meal_dish_plans')
      .select('id, recipe_id')
      .eq('meal_id', matchedMeal.id);

    const hasRecipeInPlan = planItems?.some(item => item.recipe_id === recipeId) ?? false;

    const meal: Meal = {
      id: matchedMeal.id,
      user_id: matchedMeal.user_id,
      title: matchedMeal.title,
      description: matchedMeal.description,
      meal_type: matchedMeal.meal_type,
      meal_status: matchedMeal.meal_status,
      meal_time: matchedMeal.meal_time,
      meal_location: matchedMeal.meal_location,
      photos: matchedMeal.photos,
      created_at: matchedMeal.created_at,
      post_type: 'meal_event',
    };

    return {
      meal,
      confidence: hasRecipeInPlan ? 'high' : 'low',
    };
  } catch (error) {
    console.error('Error in detectPlannedMealForCook:', error);
    return null;
  }
}

// ============================================================================
// OPTION γ WRAP PATTERN (D26)
// ============================================================================

/**
 * Wrap an existing dish post into a new meal post.
 * Creates a new meal, then links the dish to it via addDishesToMeal.
 * Non-destructive: the dish post's rating, notes, photos, likes, comments are untouched.
 */
export async function wrapDishIntoNewMeal(
  dishPostId: string,
  userId: string,
  mealTitle: string
): Promise<{ mealId: string; dishId: string }> {
  // 1. Validate the dish post exists and belongs to the user
  const { data: dishPost, error: dishError } = await supabase
    .from('posts')
    .select('id, user_id, parent_meal_id, post_type')
    .eq('id', dishPostId)
    .eq('post_type', 'dish')
    .single();

  if (dishError || !dishPost) {
    throw new Error('Dish post not found.');
  }
  if (dishPost.user_id !== userId) {
    throw new Error('You can only wrap your own dish posts.');
  }

  // 2. Validate the dish post is not already in a meal
  if (dishPost.parent_meal_id) {
    // Fetch the parent meal title for a helpful error message
    const { data: parentMeal } = await supabase
      .from('posts')
      .select('title')
      .eq('id', dishPost.parent_meal_id)
      .single();
    throw new Error(`This dish is already part of "${parentMeal?.title || 'a meal'}".`);
  }

  // 3. Create a new meal post
  const result = await createMeal(userId, { title: mealTitle });
  if (!result.success || !result.mealId) {
    throw new Error(result.error || 'Failed to create meal.');
  }

  // 4. Link the dish to the new meal via addDishesToMeal
  // This handles all 3 representations: dish_courses, parent_meal_id, post_relationships
  const linkResult = await addDishesToMeal(result.mealId, userId, [{
    dish_id: dishPostId,
    course_type: 'main',
    is_main_dish: true,
    course_order: 0,
  }]);

  if (!linkResult.success) {
    throw new Error(linkResult.error || 'Failed to link dish to meal.');
  }

  return { mealId: result.mealId, dishId: dishPostId };
}

// ============================================================================
// MEAL CRUD OPERATIONS
// ============================================================================

/**
 * Create a new meal post
 */
export async function createMeal(
  userId: string,
  input: CreateMealInput
): Promise<{ success: boolean; mealId?: string; error?: string }> {
  try {
    // Validate required fields
    if (!input.title?.trim()) {
      return { success: false, error: 'Meal title is required' };
    }

    // Create the meal post
    const { data: meal, error: mealError } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        meal_type: input.meal_type || null,
        meal_time: input.meal_time ?? new Date().toISOString(),
        meal_location: input.meal_location?.trim() || null,
        meal_status: 'planning' as MealStatus,
        post_type: 'meal_event',
        photos: [],
      })
      .select('id')
      .single();

    if (mealError) throw mealError;

    // Add creator as host participant (auto-accepted)
    const { error: participantError } = await supabase
      .from('meal_participants')
      .insert({
        meal_id: meal.id,
        user_id: userId,
        role: 'host' as ParticipantRole,
        rsvp_status: 'accepted' as RSVPStatus,
        responded_at: new Date().toISOString(),
      });

    if (participantError) throw participantError;

    return { success: true, mealId: meal.id };
  } catch (error) {
    console.error('Error creating meal:', error);
    return { success: false, error: 'Failed to create meal' };
  }
}

/**
 * Get a meal by ID with all details
 */
export async function getMeal(
  mealId: string
): Promise<MealWithDetails | null> {
  try {
    const { data: meal, error } = await supabase
      .from('posts')
      .select(`
        *,
        host_profile:meal_participants!inner(
          user_profiles!inner(
            id,
            username,
            display_name,
            avatar_url
          )
        )
      `)
      .eq('id', mealId)
      .eq('post_type', 'meal_event')
      .eq('meal_participants.role', 'host')
      .single();

    if (error) throw error;
    if (!meal) return null;

    // Get counts
    const { data: dishCount } = await supabase
      .from('dish_courses')
      .select('id', { count: 'exact' })
      .eq('meal_id', mealId);

    const { data: participantCount } = await supabase
      .from('meal_participants')
      .select('id', { count: 'exact' })
      .eq('meal_id', mealId)
      .eq('rsvp_status', 'accepted');

    // Extract host profile from nested data
    const hostData = (meal as any).host_profile?.[0]?.user_profiles;

    return {
      ...meal,
      dish_count: dishCount?.length || 0,
      participant_count: participantCount?.length || 0,
      host_id: hostData?.id,
      host_profile: hostData,
    } as MealWithDetails;
  } catch (error) {
    console.error('Error getting meal:', error);
    return null;
  }
}

/**
 * Update meal details (host only)
 */
export async function updateMeal(
  mealId: string,
  userId: string,
  updates: Partial<CreateMealInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify user is host
    const isHost = await checkIsHost(mealId, userId);
    if (!isHost) {
      return { success: false, error: 'Only the host can update meal details' };
    }

    const { error } = await supabase
      .from('posts')
      .update({
        title: updates.title?.trim(),
        description: updates.description?.trim(),
        meal_type: updates.meal_type,
        meal_time: updates.meal_time,
        meal_location: updates.meal_location?.trim(),
      })
      .eq('id', mealId)
      .eq('post_type', 'meal_event');

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating meal:', error);
    return { success: false, error: 'Failed to update meal' };
  }
}

/**
 * Complete a meal (transition from planning to completed)
 */
export async function completeMeal(
  mealId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify user is host
    const isHost = await checkIsHost(mealId, userId);
    if (!isHost) {
      return { success: false, error: 'Only the host can complete the meal' };
    }

    // Update meal status
    const { error: updateError } = await supabase
      .from('posts')
      .update({ meal_status: 'completed' as MealStatus })
      .eq('id', mealId)
      .eq('post_type', 'meal_event');

    if (updateError) throw updateError;

    // Remove pending invitations (optional - they missed the meal)
    await supabase
      .from('meal_participants')
      .delete()
      .eq('meal_id', mealId)
      .eq('rsvp_status', 'pending');

    return { success: true };
  } catch (error) {
    console.error('Error completing meal:', error);
    return { success: false, error: 'Failed to complete meal' };
  }
}

/**
 * Delete a meal (host only)
 * Note: Dishes remain standalone - they're just unlinked
 */
export async function deleteMeal(
  mealId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify user is host
    const isHost = await checkIsHost(mealId, userId);
    if (!isHost) {
      return { success: false, error: 'Only the host can delete the meal' };
    }

    // Clear parent_meal_id from all dishes (keeps them standalone)
    await supabase
      .from('posts')
      .update({ parent_meal_id: null })
      .eq('parent_meal_id', mealId);

    // Delete the meal (cascades to meal_participants, meal_photos, dish_courses)
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', mealId)
      .eq('post_type', 'meal_event');

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting meal:', error);
    return { success: false, error: 'Failed to delete meal' };
  }
}

// ============================================================================
// DISH MANAGEMENT
// ============================================================================

/**
 * Add dishes to a meal
 */
export async function addDishesToMeal(
  mealId: string,
  userId: string,
  dishes: AddDishInput[]
): Promise<{ success: boolean; addedCount?: number; error?: string }> {
  try {
    // Validate user can add dishes
    const validation = await canAddDishToMeal(mealId, userId);
    if (!validation.can_add) {
      return { success: false, error: validation.reason };
    }

    let addedCount = 0;

    for (const dish of dishes) {
      // Check if dish is already in a meal
      const { data: existingCourse } = await supabase
        .from('dish_courses')
        .select('id')
        .eq('dish_id', dish.dish_id)
        .single();

      if (existingCourse) {
        console.warn(`Dish ${dish.dish_id} is already in a meal, skipping`);
        continue;
      }

      // Verify the dish exists and user owns it (or it's being requested)
      const { data: dishPost } = await supabase
        .from('posts')
        .select('id, user_id')
        .eq('id', dish.dish_id)
        .eq('post_type', 'dish')
        .single();

      if (!dishPost) {
        console.warn(`Dish ${dish.dish_id} not found, skipping`);
        continue;
      }

      // Add dish to meal via dish_courses
      const { error: courseError } = await supabase
        .from('dish_courses')
        .insert({
          dish_id: dish.dish_id,
          meal_id: mealId,
          course_type: dish.course_type,
          is_main_dish: dish.is_main_dish || false,
          course_order: dish.course_order,
        });

      if (courseError) {
        console.error('Error adding dish course:', courseError);
        continue;
      }

      // Update dish's parent_meal_id
      await supabase
        .from('posts')
        .update({ parent_meal_id: mealId })
        .eq('id', dish.dish_id);

      // Create post relationship (for feed grouping) - ignore if already exists
      const [smallerId, largerId] = [mealId, dish.dish_id].sort();
      const { data: existingRel } = await supabase
        .from('post_relationships')
        .select('id')
        .eq('post_id_1', smallerId)
        .eq('post_id_2', largerId)
        .maybeSingle();

      if (!existingRel) {
        await supabase
          .from('post_relationships')
          .insert({
            post_id_1: smallerId,
            post_id_2: largerId,
            relationship_type: 'meal_group',
          });
      }

      addedCount++;
    }

    return { success: true, addedCount };
  } catch (error) {
    console.error('Error adding dishes to meal:', error);
    return { success: false, error: 'Failed to add dishes to meal' };
  }
}

/**
 * Remove a dish from a meal
 */
export async function removeDishFromMeal(
  mealId: string,
  dishId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Must be host OR dish owner
    const isHost = await checkIsHost(mealId, userId);
    
    const { data: dish } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', dishId)
      .single();

    const isDishOwner = dish?.user_id === userId;

    if (!isHost && !isDishOwner) {
      return { success: false, error: 'Only the host or dish owner can remove this dish' };
    }

    // Remove from dish_courses
    const { error: courseError } = await supabase
      .from('dish_courses')
      .delete()
      .eq('meal_id', mealId)
      .eq('dish_id', dishId);

    if (courseError) throw courseError;

    // Clear parent_meal_id on dish
    await supabase
      .from('posts')
      .update({ parent_meal_id: null })
      .eq('id', dishId);

    // Remove post relationship
    await supabase
      .from('post_relationships')
      .delete()
      .eq('relationship_type', 'meal_group')
      .or(`and(post_id_1.eq.${mealId},post_id_2.eq.${dishId}),and(post_id_1.eq.${dishId},post_id_2.eq.${mealId})`);

    return { success: true };
  } catch (error) {
    console.error('Error removing dish from meal:', error);
    return { success: false, error: 'Failed to remove dish from meal' };
  }
}

/**
 * Get all dishes in a meal (sorted by course)
 */
export async function getMealDishes(mealId: string): Promise<DishInMeal[]> {
  try {
    // Use the database function for proper sorting
    const { data, error } = await supabase
      .rpc('get_meal_dishes', { p_meal_id: mealId });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting meal dishes:', error);
    return [];
  }
}

/**
 * Update dish course info within a meal
 */
export async function updateDishCourse(
  mealId: string,
  dishId: string,
  userId: string,
  updates: {
    course_type?: CourseType;
    is_main_dish?: boolean;
    course_order?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Must be host or dish owner
    const isHost = await checkIsHost(mealId, userId);
    const { data: dish } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', dishId)
      .single();

    if (!isHost && dish?.user_id !== userId) {
      return { success: false, error: 'Only the host or dish owner can update course info' };
    }

    const { error } = await supabase
      .from('dish_courses')
      .update(updates)
      .eq('meal_id', mealId)
      .eq('dish_id', dishId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating dish course:', error);
    return { success: false, error: 'Failed to update dish course' };
  }
}

// ============================================================================
// PARTICIPANT MANAGEMENT
// ============================================================================

/**
 * Invite users to a meal
 */
export async function inviteParticipants(
  mealId: string,
  hostUserId: string,
  userIds: string[]
): Promise<{ success: boolean; invitedCount?: number; error?: string }> {
  try {
    // Verify user is host
    const isHost = await checkIsHost(mealId, hostUserId);
    if (!isHost) {
      return { success: false, error: 'Only the host can invite participants' };
    }

    let invitedCount = 0;

    for (const userId of userIds) {
      // Don't invite yourself
      if (userId === hostUserId) continue;

      // Check if already invited
      const { data: existing } = await supabase
        .from('meal_participants')
        .select('id')
        .eq('meal_id', mealId)
        .eq('user_id', userId)
        .single();

      if (existing) continue;

      // Add invitation
      const { error } = await supabase
        .from('meal_participants')
        .insert({
          meal_id: mealId,
          user_id: userId,
          role: 'attendee' as ParticipantRole,
          rsvp_status: 'pending' as RSVPStatus,
        });

      if (!error) invitedCount++;
    }

    // TODO: Send notifications to invited users

    return { success: true, invitedCount };
  } catch (error) {
    console.error('Error inviting participants:', error);
    return { success: false, error: 'Failed to invite participants' };
  }
}

/**
 * Respond to a meal invitation (Accept/Maybe/Decline)
 */
export async function respondToInvitation(
  mealId: string,
  userId: string,
  response: 'accepted' | 'maybe' | 'declined'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('meal_participants')
      .update({
        rsvp_status: response,
        responded_at: new Date().toISOString(),
      })
      .eq('meal_id', mealId)
      .eq('user_id', userId);

    if (error) throw error;

    // TODO: Notify host of response

    return { success: true };
  } catch (error) {
    console.error('Error responding to invitation:', error);
    return { success: false, error: 'Failed to respond to invitation' };
  }
}

/**
 * Remove a participant from a meal (host only, planning mode only)
 */
export async function removeParticipant(
  mealId: string,
  hostUserId: string,
  participantUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify user is host
    const isHost = await checkIsHost(mealId, hostUserId);
    if (!isHost) {
      return { success: false, error: 'Only the host can remove participants' };
    }

    // Can't remove yourself (host)
    if (hostUserId === participantUserId) {
      return { success: false, error: 'Host cannot remove themselves. Transfer host first.' };
    }

    // Check meal status - can only remove during planning
    const { data: meal } = await supabase
      .from('posts')
      .select('meal_status')
      .eq('id', mealId)
      .single();

    if (meal?.meal_status === 'completed') {
      return { success: false, error: 'Cannot remove participants from completed meals' };
    }

    // Remove their dishes from the meal first
    const { data: userDishes } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', participantUserId)
      .eq('parent_meal_id', mealId);

    if (userDishes) {
      for (const dish of userDishes) {
        await removeDishFromMeal(mealId, dish.id, hostUserId);
      }
    }

    // Remove participant
    const { error } = await supabase
      .from('meal_participants')
      .delete()
      .eq('meal_id', mealId)
      .eq('user_id', participantUserId);

    if (error) throw error;

    // TODO: Notify removed participant

    return { success: true };
  } catch (error) {
    console.error('Error removing participant:', error);
    return { success: false, error: 'Failed to remove participant' };
  }
}

/**
 * Transfer host role to another participant
 */
export async function transferHost(
  mealId: string,
  currentHostId: string,
  newHostId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify current user is host
    const isHost = await checkIsHost(mealId, currentHostId);
    if (!isHost) {
      return { success: false, error: 'Only the current host can transfer host role' };
    }

    // Verify new host is an accepted participant
    const { data: newHostParticipant } = await supabase
      .from('meal_participants')
      .select('rsvp_status')
      .eq('meal_id', mealId)
      .eq('user_id', newHostId)
      .single();

    if (!newHostParticipant || newHostParticipant.rsvp_status !== 'accepted') {
      return { success: false, error: 'New host must be an accepted participant' };
    }

    // Update current host to attendee
    await supabase
      .from('meal_participants')
      .update({ role: 'attendee' as ParticipantRole })
      .eq('meal_id', mealId)
      .eq('user_id', currentHostId);

    // Update new host to host
    const { error } = await supabase
      .from('meal_participants')
      .update({ role: 'host' as ParticipantRole })
      .eq('meal_id', mealId)
      .eq('user_id', newHostId);

    if (error) throw error;

    // TODO: Notify both users

    return { success: true };
  } catch (error) {
    console.error('Error transferring host:', error);
    return { success: false, error: 'Failed to transfer host role' };
  }
}

/**
 * Get all participants in a meal
 */
export async function getMealParticipants(mealId: string): Promise<MealParticipant[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_meal_participants', { p_meal_id: mealId });

    if (error) throw error;

    // Transform the RPC result to match our interface
    return (data || []).map((p: any) => ({
      id: p.participant_id,
      meal_id: mealId,
      user_id: p.user_id,
      role: p.role,
      rsvp_status: p.rsvp_status,
      invited_at: p.invited_at,
      responded_at: p.responded_at,
      dish_count: p.dish_count,
      user_profile: {
        id: p.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        subscription_tier: p.subscription_tier,
      },
    }));
  } catch (error) {
    console.error('Error getting meal participants:', error);
    return [];
  }
}

/**
 * Get pending meal invitations for a user
 */
export async function getPendingMealInvitations(
  userId: string
): Promise<{
  id: string;
  meal_id: string;
  meal_title: string;
  meal_time?: string;
  host_username: string;
  host_display_name?: string;
  invited_at: string;
}[]> {
  try {
    const { data, error } = await supabase
      .from('meal_participants')
      .select(`
        id,
        meal_id,
        invited_at,
        meal:posts!meal_id(
          title,
          meal_time
        ),
        host:meal_participants!meal_id(
          user_profiles!user_id(
            username,
            display_name
          )
        )
      `)
      .eq('user_id', userId)
      .eq('rsvp_status', 'pending');

    if (error) throw error;

    return (data || []).map((inv: any) => ({
      id: inv.id,
      meal_id: inv.meal_id,
      meal_title: inv.meal?.title || 'Untitled Meal',
      meal_time: inv.meal?.meal_time,
      host_username: inv.host?.find((h: any) => h.role === 'host')?.user_profiles?.username || '',
      host_display_name: inv.host?.find((h: any) => h.role === 'host')?.user_profiles?.display_name,
      invited_at: inv.invited_at,
    }));
  } catch (error) {
    console.error('Error getting pending invitations:', error);
    return [];
  }
}

// ============================================================================
// MEAL PHOTOS
// ============================================================================

/**
 * Add a photo to a meal
 */
export async function addMealPhoto(
  mealId: string,
  userId: string,
  photoUrl: string,
  caption?: string
): Promise<{ success: boolean; photoId?: string; error?: string }> {
  try {
    // Verify user is a participant
    const { data: participant } = await supabase
      .from('meal_participants')
      .select('rsvp_status')
      .eq('meal_id', mealId)
      .eq('user_id', userId)
      .single();

    if (!participant || !['accepted', 'maybe'].includes(participant.rsvp_status)) {
      return { success: false, error: 'Only participants can add photos' };
    }

    const { data, error } = await supabase
      .from('meal_photos')
      .insert({
        meal_id: mealId,
        user_id: userId,
        photo_url: photoUrl,
        caption: caption?.trim() || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, photoId: data.id };
  } catch (error) {
    console.error('Error adding meal photo:', error);
    return { success: false, error: 'Failed to add photo' };
  }
}

/**
 * Get all photos for a meal
 */
export async function getMealPhotos(mealId: string): Promise<{
  id: string;
  photo_url: string;
  caption?: string;
  user_id: string;
  username: string;
  created_at: string;
}[]> {
  try {
    const { data, error } = await supabase
      .from('meal_photos')
      .select(`
        id,
        photo_url,
        caption,
        user_id,
        created_at,
        user_profiles!user_id(username)
      `)
      .eq('meal_id', mealId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((p: any) => ({
      id: p.id,
      photo_url: p.photo_url,
      caption: p.caption,
      user_id: p.user_id,
      username: p.user_profiles?.username || '',
      created_at: p.created_at,
    }));
  } catch (error) {
    console.error('Error getting meal photos:', error);
    return [];
  }
}

/**
 * Delete a meal photo (uploader or host only)
 */
export async function deleteMealPhoto(
  photoId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get photo info
    const { data: photo } = await supabase
      .from('meal_photos')
      .select('meal_id, user_id')
      .eq('id', photoId)
      .single();

    if (!photo) {
      return { success: false, error: 'Photo not found' };
    }

    // Check if user is uploader or host
    const isUploader = photo.user_id === userId;
    const isHost = await checkIsHost(photo.meal_id, userId);

    if (!isUploader && !isHost) {
      return { success: false, error: 'Only the uploader or host can delete this photo' };
    }

    const { error } = await supabase
      .from('meal_photos')
      .delete()
      .eq('id', photoId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting meal photo:', error);
    return { success: false, error: 'Failed to delete photo' };
  }
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get user's recent meals (for "Add to Meal" picker)
 */
export async function getUserRecentMeals(
  userId: string,
  limit: number = 10
): Promise<{
  meal_id: string;
  title: string;
  meal_status: MealStatus;
  meal_time?: string;
  dish_count: number;
  participant_count: number;
  user_role: ParticipantRole;
}[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_recent_meals', { p_user_id: userId, p_limit: limit });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user recent meals:', error);
    return [];
  }
}

/**
 * Get meals for feed (completed meals from followed users)
 */
export async function getMealsForFeed(
  userId: string,
  limit: number = 20,
  beforeDate?: string
): Promise<MealWithDetails[]> {
  try {
    // Get users this person follows
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    const followingIds = following?.map(f => f.following_id) || [];
    followingIds.push(userId); // Include own meals

    // Get completed meals where user follows any participant
    let query = supabase
      .from('posts')
      .select(`
        *,
        meal_participants!inner(
          user_id,
          role,
          rsvp_status,
          user_profiles!user_id(
            id,
            username,
            display_name,
            avatar_url
          )
        )
      `)
      .eq('post_type', 'meal_event')
      .eq('meal_status', 'completed')
      .or('visibility.eq.everyone,visibility.eq.followers,visibility.is.null') // Gap 9 fix: exclude private/meal_tagged posts
      .in('meal_participants.user_id', followingIds)
      .eq('meal_participants.rsvp_status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (beforeDate) {
      query = query.lt('created_at', beforeDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Deduplicate meals and add counts
    const mealMap = new Map<string, MealWithDetails>();
    
    for (const meal of (data || [])) {
      if (!mealMap.has(meal.id)) {
        // Get dish data (includes recipe stats after RPC update)
        const dishes = await getMealDishes(meal.id);

        // Get participant count
        const { count: participantCount } = await supabase
          .from('meal_participants')
          .select('id', { count: 'exact', head: true })
          .eq('meal_id', meal.id)
          .eq('rsvp_status', 'accepted');

        // Find host
        const host = (meal as any).meal_participants?.find((p: any) => p.role === 'host');

        // Aggregate recipe stats across dishes.
        // Null cook_time_min / times_cooked treated as 0 — partial aggregation
        // is more useful than suppressing the stat entirely. Matches solo card
        // omission behavior for unknown times.
        const totalCookTimeMin = dishes.reduce(
          (sum, d) => sum + (d.recipe_cook_time_min ?? 0), 0
        );
        const totalTimesCooked = dishes.reduce(
          (sum, d) => sum + (d.recipe_times_cooked ?? 0), 0
        );

        mealMap.set(meal.id, {
          ...meal,
          dish_count: dishes.length,
          participant_count: participantCount || 0,
          host_id: host?.user_id,
          host_profile: host?.user_profiles,
          total_cook_time_min: totalCookTimeMin,
          total_times_cooked: totalTimesCooked,
        } as MealWithDetails);
      }
    }

    return Array.from(mealMap.values());
  } catch (error) {
    console.error('Error getting meals for feed:', error);
    return [];
  }
}

/**
 * Get user's dishes that can be added to a meal
 * (not already in a meal, from last 30 days)
 */
export async function getUserAvailableDishes(
  userId: string,
  excludeMealId?: string
): Promise<{
  id: string;
  title: string;
  recipe_title?: string;
  recipe_image_url?: string;
  rating?: number;
  created_at: string;
}[]> {
  try {
    // Get dishes not in any meal
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        rating,
        created_at,
        recipes(title, image_url)
      `)
      .eq('user_id', userId)
      .eq('post_type', 'dish')
      .is('parent_meal_id', null)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      recipe_title: d.recipes?.title,
      recipe_image_url: d.recipes?.image_url,
      rating: d.rating,
      created_at: d.created_at,
    }));
  } catch (error) {
    console.error('Error getting available dishes:', error);
    return [];
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if user is host of a meal
 */
export async function checkIsHost(mealId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('meal_participants')
      .select('id')
      .eq('meal_id', mealId)
      .eq('user_id', userId)
      .eq('role', 'host')
      .single();

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Check if user can add a dish to a meal
 */
export async function canAddDishToMeal(
  mealId: string,
  userId: string,
  dishId?: string
): Promise<{ can_add: boolean; reason: string }> {
  try {
    const { data, error } = await supabase
      .rpc('can_add_dish_to_meal', {
        p_meal_id: mealId,
        p_user_id: userId,
        p_dish_id: dishId || null,
      });

    if (error) throw error;
    return data?.[0] || { can_add: false, reason: 'Validation failed' };
  } catch (error) {
    console.error('Error checking can add dish:', error);
    return { can_add: false, reason: 'Validation failed' };
  }
}

/**
 * Check if user is a participant in a meal
 */
export async function isParticipant(mealId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('meal_participants')
      .select('id')
      .eq('meal_id', mealId)
      .eq('user_id', userId)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format participant names for display
 * "Mary, Nick, and 3 others shared a meal"
 */
export function formatMealParticipantsText(
  participants: MealParticipant[],
  viewerFollowingIds: string[],
  maxNames: number = 3
): string {
  // Filter to accepted participants that viewer follows
  const accepted = participants.filter(p => p.rsvp_status === 'accepted');
  const visible = accepted.filter(p => viewerFollowingIds.includes(p.user_id));
  const hiddenCount = accepted.length - visible.length;

  if (visible.length === 0 && hiddenCount > 0) {
    return `${hiddenCount} ${hiddenCount === 1 ? 'person' : 'people'} shared a meal`;
  }

  const names = visible
    .slice(0, maxNames)
    .map(p => p.user_profile?.display_name || p.user_profile?.username || 'Someone');

  const extraVisible = visible.length - maxNames;
  const totalHidden = Math.max(0, extraVisible) + hiddenCount;

  if (names.length === 0) return '';
  
  if (names.length === 1 && totalHidden === 0) {
    return `${names[0]}'s meal`;
  }

  if (totalHidden === 0) {
    if (names.length === 2) {
      return `${names[0]} and ${names[1]} shared a meal`;
    }
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} shared a meal`;
  }

  return `${names.join(', ')}, and ${totalHidden} ${totalHidden === 1 ? 'other' : 'others'} shared a meal`;
}

/**
 * Group dishes by course type for display
 */
export function groupDishesByCourse(dishes: DishInMeal[]): Map<CourseType, DishInMeal[]> {
  const groups = new Map<CourseType, DishInMeal[]>();
  
  const courseOrder: CourseType[] = ['appetizer', 'main', 'side', 'dessert', 'drink', 'other'];
  
  // Initialize all groups
  courseOrder.forEach(course => groups.set(course, []));
  
  // Group dishes
  dishes.forEach(dish => {
    const group = groups.get(dish.course_type) || groups.get('other')!;
    group.push(dish);
  });
  
  // Sort mains before sides within each group
  groups.forEach((dishes, course) => {
    if (course === 'main' || course === 'side') {
      dishes.sort((a, b) => (b.is_main_dish ? 1 : 0) - (a.is_main_dish ? 1 : 0));
    }
  });
  
  return groups;
}

/**
 * Get course display name
 */
export function getCourseDisplayName(course: CourseType): string {
  const names: Record<CourseType, string> = {
    appetizer: 'Appetizers',
    main: 'Mains',
    side: 'Sides',
    dessert: 'Desserts',
    drink: 'Drinks',
    other: 'Other',
  };
  return names[course];
}

// ============================================================================
// PHASE 7I CHECKPOINT 2 — MEAL EVENT CONTEXT (L4 prehead)
// ============================================================================

/**
 * For a dish post, return the minimal meal event context needed to render
 * the L4 prehead ("Tom's dish at Friday night crew") above a solo cook card
 * or the L5 group header above a linked stack.
 *
 * Returns null if the post has no parent meal or if the parent meal row
 * is missing (defensive — shouldn't happen after Checkpoint 1's 0 broken
 * refs verification).
 *
 * Host lookup: uses `post_participants` host role first, falls back to
 * `posts.user_id` if no explicit host participant row exists. Per Checkpoint
 * 1 findings there's 1 meal_event row (of 363) without an explicit host
 * participant row — the fallback covers that case.
 */
export async function getMealEventForCook(
  postId: string
): Promise<MealEventContext | null> {
  try {
    // 1. Fetch the cook post's parent_meal_id.
    const { data: cookPost, error: cookErr } = await supabase
      .from('posts')
      .select('id, parent_meal_id')
      .eq('id', postId)
      .single();

    if (cookErr || !cookPost || !cookPost.parent_meal_id) return null;

    // 2. Fetch the meal_event row.
    const { data: mealEvent, error: meErr } = await supabase
      .from('posts')
      .select('id, user_id, title, meal_time, meal_location')
      .eq('id', cookPost.parent_meal_id)
      .eq('post_type', 'meal_event')
      .single();

    if (meErr || !mealEvent) return null;

    // 3. Resolve the host — first try an explicit host participant row,
    //    fall back to mealEvent.user_id.
    const { data: hostRow } = await supabase
      .from('post_participants')
      .select('participant_user_id')
      .eq('post_id', mealEvent.id)
      .eq('role', 'host')
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();

    const hostUserId: string =
      (hostRow as any)?.participant_user_id || mealEvent.user_id;

    const { data: hostProfile } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', hostUserId)
      .maybeSingle();

    // 4. Count distinct cook post authors for total_contributor_count.
    const { data: contributorRows } = await supabase
      .from('posts')
      .select('user_id')
      .eq('parent_meal_id', mealEvent.id)
      .eq('post_type', 'dish');

    const uniqueContributors = new Set(
      (contributorRows || []).map((r: any) => r.user_id as string)
    );

    return {
      id: mealEvent.id,
      title: mealEvent.title || 'Meal',
      meal_time: mealEvent.meal_time,
      meal_location: mealEvent.meal_location,
      host_id: hostUserId,
      host_username: (hostProfile as any)?.username,
      host_display_name: (hostProfile as any)?.display_name,
      host_avatar_url: (hostProfile as any)?.avatar_url,
      total_contributor_count: uniqueContributors.size,
    };
  } catch (err) {
    console.error('Error in getMealEventForCook:', err);
    return null;
  }
}

// ============================================================================
// PHASE 7I CHECKPOINT 2 — MEAL EVENT DETAIL (L7 screen)
// ============================================================================

/**
 * Full meal event detail payload for Checkpoint 6's MealEventDetailScreen (L7).
 * Assembles: event metadata, host, all linked cook posts with authors and
 * recipe refs, attendees (with D43 private eater-rating visibility), shared
 * media from meal_photos, aggregate stats.
 *
 * D43 privacy: `private_rating` is only populated for an attendee entry if
 * the viewer is the event host OR is that attendee themselves. Otherwise
 * the field is null.
 */
export interface MealEventDetail {
  event: {
    id: string;
    title: string;
    description?: string;
    meal_time?: string;
    meal_location?: string;
    highlight_photo?: any;
    created_at: string;
  };
  host: {
    user_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  cooks: Array<{
    post_id: string;
    post_title: string;
    post_rating?: number | null;
    user_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
    recipe_id?: string | null;
    recipe_title?: string | null;
    photos?: any[];
    created_at: string;
  }>;
  attendees: Array<{
    user_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
    private_rating?: number | null;
  }>;
  shared_media: Array<{
    id: string;
    photo_url: string;
    caption?: string;
    uploaded_by_user_id: string;
    uploaded_by_username: string;
    created_at: string;
  }>;
  stats: {
    total_dishes: number;
    unique_cooks: number;
    total_attendees: number;
    avg_rating?: number;
  };
}

export async function getMealEventDetail(
  eventId: string,
  currentUserId: string
): Promise<MealEventDetail | null> {
  try {
    // 1. Event row
    const { data: event, error: eventErr } = await supabase
      .from('posts')
      .select(
        'id, user_id, title, description, meal_time, meal_location, photos, created_at'
      )
      .eq('id', eventId)
      .eq('post_type', 'meal_event')
      .single();

    if (eventErr || !event) return null;

    // 2. Host lookup (explicit post_participants host row first,
    //    fall back to event.user_id)
    const { data: hostRow } = await supabase
      .from('post_participants')
      .select('participant_user_id')
      .eq('post_id', eventId)
      .eq('role', 'host')
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();

    const hostUserId =
      (hostRow as any)?.participant_user_id || event.user_id;

    const { data: hostProfile } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', hostUserId)
      .maybeSingle();

    const host = {
      user_id: hostUserId,
      username: (hostProfile as any)?.username || '',
      display_name: (hostProfile as any)?.display_name,
      avatar_url: (hostProfile as any)?.avatar_url,
    };

    // 3. Linked cook posts (dishes attached via parent_meal_id)
    const { data: cookRows } = await supabase
      .from('posts')
      .select(
        `id, user_id, title, rating, recipe_id, photos, created_at,
         author:user_profiles!user_id ( id, username, display_name, avatar_url ),
         recipes ( id, title )`
      )
      .eq('parent_meal_id', eventId)
      .eq('post_type', 'dish')
      .order('created_at', { ascending: true });

    const cooks = (cookRows || []).map((row: any) => ({
      post_id: row.id,
      post_title: row.title || row.recipes?.title || 'Dish',
      post_rating: row.rating,
      user_id: row.user_id,
      username: row.author?.username || '',
      display_name: row.author?.display_name,
      avatar_url: row.author?.avatar_url,
      recipe_id: row.recipe_id,
      recipe_title: row.recipes?.title,
      photos: row.photos || [],
      created_at: row.created_at,
    }));

    // 4. Attendees (ate_with role on the event). D43: private_rating only
    //    visible to host or to the attendee themselves.
    const { data: attendeeRows } = await supabase
      .from('post_participants')
      .select(
        `participant_user_id, external_name,
         participant_profile:user_profiles!participant_user_id (
           id, username, display_name, avatar_url
         )`
      )
      .eq('post_id', eventId)
      .eq('role', 'ate_with')
      .eq('status', 'approved');

    // D43 note: eater_ratings schema isn't wired yet in the current repo.
    // Leaving `private_rating` null for every attendee — Checkpoint 6 will
    // wire the real query once the schema lands. The visibility rule (host
    // or self can see their own rating) is captured here as a comment so
    // Checkpoint 6 picks it up without rediscovering: a viewer is allowed
    // to see an attendee's rating iff `viewer === host OR viewer === attendee`.
    const attendees = (attendeeRows || [])
      .filter((r: any) => r.participant_user_id || r.external_name)
      .map((r: any) => ({
        user_id: r.participant_user_id || '',
        username:
          r.participant_profile?.username ||
          r.external_name ||
          '',
        display_name:
          r.participant_profile?.display_name || r.external_name,
        avatar_url: r.participant_profile?.avatar_url,
        private_rating: null,
      }));

    // 5. Shared media from meal_photos
    const { data: mediaRows } = await supabase
      .from('meal_photos')
      .select(
        `id, photo_url, caption, user_id, created_at,
         uploader:user_profiles!user_id ( username )`
      )
      .eq('meal_id', eventId)
      .order('created_at', { ascending: true });

    const shared_media = (mediaRows || []).map((r: any) => ({
      id: r.id,
      photo_url: r.photo_url,
      caption: r.caption,
      uploaded_by_user_id: r.user_id,
      uploaded_by_username: r.uploader?.username || '',
      created_at: r.created_at,
    }));

    // 6. Highlight photo — find posts.photos entry with is_highlight=true,
    //    fall back to first photo, or undefined if no photos.
    const eventPhotos: any[] = Array.isArray(event.photos) ? event.photos : [];
    const highlight_photo =
      eventPhotos.find((p: any) => p && p.is_highlight === true) ||
      eventPhotos[0] ||
      undefined;

    // 7. Stats
    const uniqueCookAuthors = new Set(cooks.map(c => c.user_id));
    const ratedCooks = cooks.filter(
      c => c.post_rating != null && c.post_rating > 0
    );
    const avgRating =
      ratedCooks.length > 0
        ? ratedCooks.reduce((s, c) => s + (c.post_rating || 0), 0) /
          ratedCooks.length
        : undefined;

    return {
      event: {
        id: event.id,
        title: event.title || 'Meal',
        description: event.description,
        meal_time: event.meal_time,
        meal_location: event.meal_location,
        highlight_photo,
        created_at: event.created_at,
      },
      host,
      cooks,
      attendees,
      shared_media,
      stats: {
        total_dishes: cooks.length,
        unique_cooks: uniqueCookAuthors.size,
        total_attendees: attendees.length,
        avg_rating: avgRating,
      },
    };
  } catch (err) {
    console.error('Error in getMealEventDetail:', err);
    return null;
  }
}