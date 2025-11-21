// lib/services/postParticipantsService.ts
// Service for managing cooking partners and meal relationships
// Created: November 19, 2025

import { supabase } from '../supabase';
import { generateSmartTitle } from '../../utils/titleGenerator';

export type ParticipantRole = 'sous_chef' | 'ate_with' | 'host';
export type ParticipantStatus = 'pending' | 'approved' | 'declined';
export type RelationshipType = 'meal_group' | 'dish_pair';
export type PostType = 'dish' | 'meal';

export interface PostParticipant {
  id: string;
  post_id: string;
  participant_user_id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  invited_by_user_id: string;
  created_at: string;
  responded_at?: string;
  participant_profile?: {
    id: string;
    display_name?: string;
    username: string;
    avatar_url?: string;
  };
}

export interface PostRelationship {
  id: string;
  post_id_1: string;
  post_id_2: string;
  relationship_type: RelationshipType;
  created_at: string;
}

export interface PendingApproval {
  id: string;
  post_id: string;
  role: ParticipantRole;
  invited_by_user_id: string;
  post_title: string;
  cooking_method?: string;
  post_created_at: string;
  inviter_name?: string;
  inviter_username: string;
  created_at: string;
}

/**
 * Add participants to a post (sous chefs or ate_with)
 */
export async function addParticipantsToPost(
  postId: string,
  participantUserIds: string[],
  role: ParticipantRole,
  currentUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify the current user owns this post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (postError) throw postError;
    if (post.user_id !== currentUserId) {
      return { success: false, error: 'You can only add participants to your own posts' };
    }

    // Insert participants
    const participants = participantUserIds.map(userId => ({
      post_id: postId,
      participant_user_id: userId,
      role,
      status: 'pending' as ParticipantStatus,
      invited_by_user_id: currentUserId,
    }));

    const { error: insertError } = await supabase
      .from('post_participants')
      .insert(participants);

    if (insertError) throw insertError;

    return { success: true };
  } catch (error) {
    console.error('Error adding participants:', error);
    return { success: false, error: 'Failed to add participants' };
  }
}

/**
 * Get participants for a post (with privacy filtering handled by RLS)
 */
export async function getPostParticipants(
  postId: string
): Promise<PostParticipant[]> {
  try {
    const { data, error } = await supabase
      .from('post_participants')
      .select(`
        *,
        participant_profile:user_profiles!participant_user_id(
          id,
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting participants:', error);
    return [];
  }
}

/**
 * Get all pending approvals for current user
 */
export async function getPendingApprovals(
  userId: string
): Promise<PendingApproval[]> {
  try {
    const { data, error } = await supabase
      .from('pending_participant_approvals')
      .select('*')
      .eq('participant_user_id', userId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    return [];
  }
}

/**
 * Approve a participant invitation and optionally create a linked post
 */
export async function approveParticipantInvitation(
  participantId: string,
  userId: string,
  createOwnPost: boolean = false
): Promise<{ success: boolean; newPostId?: string; error?: string }> {
  try {
    // Update status to approved
    const { data: participant, error: updateError } = await supabase
      .from('post_participants')
      .update({ 
        status: 'approved',
        responded_at: new Date().toISOString()
      })
      .eq('id', participantId)
      .eq('participant_user_id', userId)
      .select(`
        *,
        original_post:posts!post_id(
          id,
          user_id,
          recipe_id,
          title,
          rating,
          cooking_method,
          meal_type,
          notes,
          modifications,
          post_type,
          parent_meal_id
        )
      `)
      .maybeSingle(); // Use maybeSingle() to avoid throwing when no rows found

    if (updateError) throw updateError;
    if (!participant) {
      return { success: false, error: 'Participant invitation not found or already responded to' };
    }

    let newPostId: string | undefined;

    // If user wants to create their own post
    if (createOwnPost) {
      const originalPost = (participant as any).original_post;
      
      // Get recipe name if available
      let recipeName: string | undefined;
      if (originalPost.recipe_id) {
        const { data: recipe } = await supabase
          .from('recipes')
          .select('title')
          .eq('id', originalPost.recipe_id)
          .maybeSingle();
        
        recipeName = recipe?.title;
      }
      
      // Generate smart title based on time and cooking method
      const smartTitle = generateSmartTitle(
        new Date().toISOString(),
        originalPost.cooking_method,
        recipeName
      );
      
      // Create a new post for this user
      const { data: newPost, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          recipe_id: originalPost.recipe_id,
          title: smartTitle, // Smart contextual title
          rating: null, // User sets their own rating
          cooking_method: originalPost.cooking_method,
          meal_type: originalPost.meal_type,
          notes: '', // User adds their own notes
          post_type: originalPost.post_type,
          parent_meal_id: originalPost.parent_meal_id,
        })
        .select('id')
        .single();

      if (postError) throw postError;
      newPostId = newPost.id;

      // Create relationship between the two posts (we know newPostId is defined here)
      if (newPostId) {
        const { error: relError } = await createPostRelationship(
          originalPost.id,
          newPostId,
          'dish_pair'
        );

        if (relError) {
          console.error('Error creating post relationship:', relError);
        }
      }

      // If original post is part of a meal, link new post to meal too
      if (originalPost.parent_meal_id) {
        // Find the meal post owned by this user (if exists) or create one
        const { data: existingMealPost } = await supabase
          .from('posts')
          .select('id')
          .eq('user_id', userId)
          .eq('post_type', 'meal')
          .eq('parent_meal_id', originalPost.parent_meal_id)
          .maybeSingle(); // Use maybeSingle() to return null if not found instead of throwing

        if (existingMealPost) {
          // Link dish to existing meal
          await supabase
            .from('posts')
            .update({ parent_meal_id: existingMealPost.id })
            .eq('id', newPostId);
        }
      }
    }

    return { success: true, newPostId };
  } catch (error) {
    console.error('Error approving invitation:', error);
    return { success: false, error: 'Failed to approve invitation' };
  }
}

/**
 * Decline a participant invitation
 */
export async function declineParticipantInvitation(
  participantId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('post_participants')
      .update({ 
        status: 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', participantId)
      .eq('participant_user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error declining invitation:', error);
    return { success: false, error: 'Failed to decline invitation' };
  }
}

/**
 * Create a relationship between two posts
 */
export async function createPostRelationship(
  postId1: string,
  postId2: string,
  relationshipType: RelationshipType
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure post_id_1 < post_id_2 for the constraint
    const [smallerId, largerId] = [postId1, postId2].sort();

    const { error } = await supabase
      .from('post_relationships')
      .insert({
        post_id_1: smallerId,
        post_id_2: largerId,
        relationship_type: relationshipType,
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating post relationship:', error);
    return { success: false, error: 'Failed to create relationship' };
  }
}

/**
 * Get all related posts for a given post
 */
export async function getRelatedPosts(
  postId: string,
  currentUserId: string
): Promise<any[]> {
  try {
    // Call the database function
    const { data, error } = await supabase
      .rpc('get_related_posts', { p_post_id: postId });

    if (error) throw error;

    if (!data || data.length === 0) return [];

    // Fetch the actual post data for related posts
    const relatedPostIds = data.map((r: any) => r.related_post_id);
    
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`
        *,
        recipes(id, title, chef_id, image_url),
        user_profiles(id, username, display_name, avatar_url)
      `)
      .in('id', relatedPostIds);

    if (postsError) throw postsError;

    // Merge relationship type info with posts
    return posts?.map(post => {
      const relInfo = data.find((r: any) => r.related_post_id === post.id);
      return {
        ...post,
        relationship_type: relInfo?.relationship_type
      };
    }) || [];
  } catch (error) {
    console.error('Error getting related posts:', error);
    return [];
  }
}

/**
 * Remove yourself from a post (unlink)
 */
export async function removeParticipant(
  participantId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('post_participants')
      .delete()
      .eq('id', participantId)
      .eq('participant_user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error removing participant:', error);
    return { success: false, error: 'Failed to remove participant' };
  }
}

/**
 * Get count of pending approvals for a user
 */
export async function getPendingApprovalsCount(
  userId: string
): Promise<number> {
  try {
    // Use the view instead of table directly (RLS might block table)
    const { data, error } = await supabase
      .from('pending_participant_approvals')
      .select('id')
      .eq('participant_user_id', userId);

    if (error) {
      console.error('Error getting pending count (view query):', error);
      throw error;
    }
    
    return data?.length || 0;
  } catch (error) {
    console.error('Error getting pending count:', error);
    return 0;
  }
}

/**
 * Check if a user can see participant details
 * (Helper for client-side privacy filtering)
 */
export async function canSeeParticipant(
  viewerId: string,
  participantUserId: string,
  postCreatorId: string
): Promise<boolean> {
  // Viewer is the post creator
  if (viewerId === postCreatorId) return true;
  
  // Viewer is the participant
  if (viewerId === participantUserId) return true;

  // Check if viewer follows both post creator AND participant
  const { data: followsCreator } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', viewerId)
    .eq('following_id', postCreatorId)
    .single();

  const { data: followsParticipant } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', viewerId)
    .eq('following_id', participantUserId)
    .single();

  return !!followsCreator && !!followsParticipant;
}

/**
 * Format participant display text for UI
 * Example: "cooked with Mary" or "ate with 2 others"
 */
export function formatParticipantsText(
  participants: PostParticipant[],
  viewerId: string,
  role: ParticipantRole
): string {
  const approved = participants.filter(p => p.status === 'approved' && p.role === role);
  
  if (approved.length === 0) return '';

  // Filter to only participants viewer can see
  const visible = approved.filter(p => p.participant_profile);
  const hiddenCount = approved.length - visible.length;

  const roleVerb = role === 'sous_chef' ? 'cooked with' : 'ate with';

  if (visible.length === 0) {
    return `${roleVerb} ${hiddenCount} other${hiddenCount !== 1 ? 's' : ''}`;
  }

  const names = visible.map(p => p.participant_profile?.display_name || p.participant_profile?.username).filter(Boolean);
  
  if (hiddenCount === 0) {
    if (names.length === 1) return `${roleVerb} ${names[0]}`;
    if (names.length === 2) return `${roleVerb} ${names[0]} and ${names[1]}`;
    return `${roleVerb} ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }

  if (names.length === 1) {
    return `${roleVerb} ${names[0]} and ${hiddenCount} other${hiddenCount !== 1 ? 's' : ''}`;
  }

  return `${roleVerb} ${names.join(', ')} and ${hiddenCount} other${hiddenCount !== 1 ? 's' : ''}`;
}