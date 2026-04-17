// lib/services/postParticipantsService.ts
// Service for managing cooking partners and meal relationships
// Created: November 19, 2025

import { supabase } from '../supabase';
import { generateSmartTitle } from '../../utils/titleGenerator';

export type ParticipantRole = 'sous_chef' | 'ate_with' | 'host';
export type ParticipantStatus = 'pending' | 'approved' | 'declined';
export type RelationshipType = 'meal_group' | 'dish_pair';
/**
 * Phase 7I note: 'meal' is deprecated and has been migrated to 'meal_event'
 * (Checkpoint 1, 2026-04-13). Meal events are now connective-tissue records
 * that link multiple cook posts (post_type='dish') into a shared event
 * context. They are not rendered as feed cards — see PHASE_7I_MASTER_PLAN.md
 * for full context.
 *
 * After Checkpoint 4, only 'dish' post types render in the feed. The legacy
 * 'meal' value was removed from the union in Checkpoint 7 cleanup after
 * confirming the Checkpoint 1 migration converted all remaining rows to
 * 'meal_event'.
 *
 * This supersedes the D44 M3 architecture framing (see
 * PHASE_7F_DESIGN_DECISIONS.md) per the 2026-04-13 planning session (D47).
 */
export type PostType = 'dish' | 'meal_event';

export interface PostParticipant {
  id: string;
  post_id: string;
  participant_user_id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  invited_by_user_id: string;
  created_at: string;
  responded_at?: string;
  /** Non-Frigo guest name (D27). When set, participant_user_id may be null. */
  external_name?: string | null;
  participant_profile?: {
    id: string;
    display_name?: string;
    username: string;
    avatar_url?: string;
  };
}

export interface RoleParticipants {
  cooks: PostParticipant[];     // host + sous_chef
  eaters: PostParticipant[];    // ate_with
  external: PostParticipant[];  // any role with external_name set
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
 * Get participants for a post split by role (D45 cook-vs-eat byline).
 * Queries post_participants (NOT meal_participants RSVP table).
 * Returns three buckets: cooks, eaters, and external guests.
 * An external participant appears in BOTH their role bucket AND the external bucket.
 * Only returns approved participants.
 */
export async function getPostParticipantsByRole(
  postId: string
): Promise<RoleParticipants> {
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
      .eq('status', 'approved')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const participants = (data || []) as PostParticipant[];

    const cooks = participants.filter(
      p => p.role === 'host' || p.role === 'sous_chef'
    );
    const eaters = participants.filter(p => p.role === 'ate_with');
    const external = participants.filter(p => !!p.external_name);

    return { cooks, eaters, external };
  } catch (error) {
    console.error('Error getting participants by role:', error);
    return { cooks: [], eaters: [], external: [] };
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
          .eq('post_type', 'meal_event')
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

// ============================================================================
// PHASE 7I CHECKPOINT 2 — LINKED COOK PARTNERS
// ============================================================================

/**
 * Describes another user's cook post that is linked to a given cook post via
 * reciprocal sous_chef tagging. This is the L3b case from the 7I wireframes:
 * Tom and Anthony each post about the same cook and each tag the other as
 * sous_chef. `post_id` is the partner's OWN cook post, not the original.
 */
export interface LinkedCookPartner {
  post_id: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  role: ParticipantRole;
}

/**
 * Time window for reciprocal-tagging match (Phase 7I). Used by
 * `getLinkedCookPartners` / `getLinkedCookPartnersForPosts` to find a
 * partner's own cook post "around the same time" as the original. 60 minutes
 * is a heuristic — flagged as NEEDS REVIEW in Checkpoint 2's SESSION_LOG.
 */
const LINKED_COOK_WINDOW_MS = 60 * 60 * 1000;

/**
 * For a given cook post, return the list of other cook posts linked to it
 * via reciprocal sous_chef tagging. Under the 7I model, these form L3b
 * linked pairs in the feed.
 *
 * Algorithm:
 * 1. Find users tagged as `sous_chef` (approved) on this post.
 * 2. For each tagged user, search for a dish post of their own created
 *    within ±60 minutes of the original post where the original post's
 *    author is reciprocally tagged as sous_chef.
 * 3. Apply visibility: only return partners the viewer follows (via
 *    `followingIds`) or who is the viewer themselves.
 *
 * Edge cases:
 * - No tagged partners → returns [].
 * - Tagged partner but no reciprocal post (L3a state) → that partner is
 *   omitted. L3a's prehead is not this function's responsibility.
 * - Historical `host` rows on dish posts are ignored (`role = 'sous_chef'`
 *   filter).
 * - Self-tags (`participant_user_id = postAuthorId`) are filtered defensively.
 *
 * For batch querying over many posts, prefer `getLinkedCookPartnersForPosts`.
 */
export async function getLinkedCookPartners(
  postId: string,
  postAuthorId: string,
  followingIds: string[]
): Promise<LinkedCookPartner[]> {
  try {
    // 1. Who did the author tag as sous_chef on this post?
    const { data: tagged, error: tagErr } = await supabase
      .from('post_participants')
      .select('participant_user_id')
      .eq('post_id', postId)
      .eq('role', 'sous_chef')
      .eq('status', 'approved');

    if (tagErr || !tagged || tagged.length === 0) return [];

    const taggedUserIds = tagged
      .map((t: any) => t.participant_user_id as string | null)
      .filter((id): id is string => !!id && id !== postAuthorId);

    if (taggedUserIds.length === 0) return [];

    // 2. Fetch the original post's created_at to form the ±60m window.
    const { data: originalPost } = await supabase
      .from('posts')
      .select('id, created_at, user_id')
      .eq('id', postId)
      .single();

    if (!originalPost) return [];

    const anchor = new Date(originalPost.created_at).getTime();
    const windowStart = new Date(anchor - LINKED_COOK_WINDOW_MS).toISOString();
    const windowEnd = new Date(anchor + LINKED_COOK_WINDOW_MS).toISOString();

    // 3. For each tagged user, find their own cook post in-window where the
    //    original post's author appears reciprocally as sous_chef. Do this in
    //    a single pass: fetch candidate posts by (user_id IN taggedUserIds,
    //    post_type='dish', created_at IN window), then for each candidate
    //    check reciprocal tagging.
    const { data: candidatePosts, error: candErr } = await supabase
      .from('posts')
      .select('id, user_id, created_at')
      .in('user_id', taggedUserIds)
      .eq('post_type', 'dish')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd);

    if (candErr || !candidatePosts || candidatePosts.length === 0) return [];

    // Fetch reciprocal sous_chef participant rows for the candidate posts in
    // one query: where post_id IN candidates AND participant_user_id = author.
    const candidateIds = candidatePosts.map((p: any) => p.id as string);
    const { data: reciprocal, error: recErr } = await supabase
      .from('post_participants')
      .select('post_id')
      .in('post_id', candidateIds)
      .eq('participant_user_id', postAuthorId)
      .eq('role', 'sous_chef')
      .eq('status', 'approved');

    if (recErr || !reciprocal) return [];

    const reciprocalPostIds = new Set(reciprocal.map((r: any) => r.post_id as string));
    const reciprocalCandidates = candidatePosts.filter((p: any) =>
      reciprocalPostIds.has(p.id)
    );

    if (reciprocalCandidates.length === 0) return [];

    // 4. Apply visibility filter and join on partner profiles.
    const followingSet = new Set(followingIds);
    const partnerUserIds = reciprocalCandidates
      .map((p: any) => p.user_id as string)
      .filter(uid => followingSet.has(uid) || uid === postAuthorId);

    if (partnerUserIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', partnerUserIds);

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id as string, p])
    );

    return reciprocalCandidates
      .filter((cand: any) => profileMap.has(cand.user_id))
      .map((cand: any) => {
        const prof = profileMap.get(cand.user_id);
        return {
          post_id: cand.id,
          user_id: cand.user_id,
          username: prof?.username || '',
          display_name: prof?.display_name,
          avatar_url: prof?.avatar_url,
          role: 'sous_chef' as ParticipantRole,
        };
      });
  } catch (err) {
    console.error('Error in getLinkedCookPartners:', err);
    return [];
  }
}

/**
 * Batched variant of `getLinkedCookPartners` for use by `buildFeedGroups`.
 * Instead of one sequence of queries per post, this fetches all sous_chef
 * participant rows for the input post IDs in a single round-trip and builds
 * an adjacency map client-side. Avoids the N+1 problem on a 200-post feed.
 *
 * Returns a Map keyed by `post_id` whose values are arrays of partner
 * entries. A post with no reciprocal partners is absent from the map (not
 * present as an empty array).
 *
 * This is the edge-gathering half of the algorithm. `buildFeedGroups`
 * consumes it to construct the adjacency graph for union-find DFS.
 *
 * Only cook-partner edges are returned — meal-event edges are gathered
 * separately via `parent_meal_id` grouping in `buildFeedGroups`.
 */
export async function getLinkedCookPartnersForPosts(
  posts: Array<{ id: string; user_id: string; created_at: string }>,
  followingIds: string[]
): Promise<Map<string, LinkedCookPartner[]>> {
  const result = new Map<string, LinkedCookPartner[]>();
  if (posts.length === 0) return result;

  try {
    const postIds = posts.map(p => p.id);
    const postMap = new Map(posts.map(p => [p.id, p]));

    // 1. Fetch ALL sous_chef participant rows for these posts in one query.
    //    Each row describes "on post P, user U is tagged as sous_chef."
    const { data: taggedRows, error: tagErr } = await supabase
      .from('post_participants')
      .select('post_id, participant_user_id')
      .in('post_id', postIds)
      .eq('role', 'sous_chef')
      .eq('status', 'approved');

    if (tagErr || !taggedRows || taggedRows.length === 0) return result;

    // Build post_id → Set<tagged_user_id> (excluding self-tags).
    const taggedByPost = new Map<string, Set<string>>();
    for (const row of taggedRows as any[]) {
      if (!row.participant_user_id) continue;
      const post = postMap.get(row.post_id);
      if (!post) continue;
      if (row.participant_user_id === post.user_id) continue; // self-tag
      let set = taggedByPost.get(row.post_id);
      if (!set) {
        set = new Set();
        taggedByPost.set(row.post_id, set);
      }
      set.add(row.participant_user_id);
    }

    if (taggedByPost.size === 0) return result;

    // 2. For each post with tagged partners, we need to find reciprocal cook
    //    posts by those tagged users within ±60m. To keep this a single
    //    round-trip, fetch all candidate posts by (user_id IN all_tagged) in
    //    a wide window around this batch's min/max created_at. The DFS in
    //    buildFeedGroups only cares about posts already in the input array,
    //    so candidate filtering can be restricted to input post IDs.
    const allTaggedUserIds = new Set<string>();
    for (const set of taggedByPost.values()) {
      set.forEach(uid => allTaggedUserIds.add(uid));
    }

    if (allTaggedUserIds.size === 0) return result;

    // Fetch candidate posts from the input set where the author is a tagged
    // partner. This scopes the search to in-feed posts only — meaning a
    // reciprocal match also needs to be in the current feed window, which is
    // correct behavior for buildFeedGroups' grouping over a single feed page.
    const candidatePosts = posts.filter(p => allTaggedUserIds.has(p.user_id));
    if (candidatePosts.length === 0) return result;

    // 3. Fetch sous_chef participant rows for the candidate posts where the
    //    tagged user is one of the original posts' authors (in one query).
    const candidateIds = candidatePosts.map(p => p.id);
    const originalAuthorIds = Array.from(new Set(posts.map(p => p.user_id)));
    const { data: reciprocalRows, error: recErr } = await supabase
      .from('post_participants')
      .select('post_id, participant_user_id')
      .in('post_id', candidateIds)
      .in('participant_user_id', originalAuthorIds)
      .eq('role', 'sous_chef')
      .eq('status', 'approved');

    if (recErr || !reciprocalRows) return result;

    // Build candidate_post_id → Set<reciprocally_tagged_user_id>.
    const reciprocalByCandidate = new Map<string, Set<string>>();
    for (const row of reciprocalRows as any[]) {
      let set = reciprocalByCandidate.get(row.post_id);
      if (!set) {
        set = new Set();
        reciprocalByCandidate.set(row.post_id, set);
      }
      set.add(row.participant_user_id);
    }

    // 4. Fetch profiles for all candidate authors in one query.
    const candidateAuthorIds = Array.from(
      new Set(candidatePosts.map(p => p.user_id))
    );
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', candidateAuthorIds);
    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id as string, p])
    );

    // 5. For each input post, determine its linked partners:
    //    - Iterate tagged users on the post
    //    - For each tagged user, find a candidate post they authored
    //      within ±60m where the original post's author is reciprocally
    //      tagged
    //    - Apply visibility filter (viewer follows the partner OR is them)
    const followingSet = new Set(followingIds);
    const postById = new Map(posts.map(p => [p.id, p]));

    for (const [origPostId, taggedUsers] of taggedByPost) {
      const origPost = postById.get(origPostId)!;
      const origTime = new Date(origPost.created_at).getTime();
      const partners: LinkedCookPartner[] = [];

      for (const taggedUid of taggedUsers) {
        // Find candidate post by this user, in-window, reciprocally tagged
        const cand = candidatePosts.find(cp => {
          if (cp.user_id !== taggedUid) return false;
          const dt = Math.abs(new Date(cp.created_at).getTime() - origTime);
          if (dt > LINKED_COOK_WINDOW_MS) return false;
          const recip = reciprocalByCandidate.get(cp.id);
          return recip?.has(origPost.user_id) ?? false;
        });

        if (!cand) continue;

        // Visibility: partner must be followed by viewer OR be the viewer
        if (
          !followingSet.has(cand.user_id) &&
          cand.user_id !== origPost.user_id
        ) {
          continue;
        }

        const prof = profileMap.get(cand.user_id);
        if (!prof) continue;

        partners.push({
          post_id: cand.id,
          user_id: cand.user_id,
          username: prof.username || '',
          display_name: prof.display_name,
          avatar_url: prof.avatar_url,
          role: 'sous_chef',
        });
      }

      if (partners.length > 0) {
        result.set(origPostId, partners);
      }
    }

    return result;
  } catch (err) {
    console.error('Error in getLinkedCookPartnersForPosts:', err);
    return result;
  }
}