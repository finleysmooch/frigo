// lib/services/mealService.ts
// Service for managing meals (collections of dishes)
// Created: December 2, 2025

import { supabase } from '../supabase';

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
  post_type: 'meal';
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
        meal_time: input.meal_time || null,
        meal_location: input.meal_location?.trim() || null,
        meal_status: 'planning' as MealStatus,
        post_type: 'meal',
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
      .eq('post_type', 'meal')
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
      .eq('post_type', 'meal');

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
      .eq('post_type', 'meal');

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
      .eq('post_type', 'meal');

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
      .eq('post_type', 'meal')
      .eq('meal_status', 'completed')
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
        // Get dish count
        const { count: dishCount } = await supabase
          .from('dish_courses')
          .select('id', { count: 'exact', head: true })
          .eq('meal_id', meal.id);

        // Get participant count
        const { count: participantCount } = await supabase
          .from('meal_participants')
          .select('id', { count: 'exact', head: true })
          .eq('meal_id', meal.id)
          .eq('rsvp_status', 'accepted');

        // Find host
        const host = (meal as any).meal_participants?.find((p: any) => p.role === 'host');

        mealMap.set(meal.id, {
          ...meal,
          dish_count: dishCount || 0,
          participant_count: participantCount || 0,
          host_id: host?.user_id,
          host_profile: host?.user_profiles,
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