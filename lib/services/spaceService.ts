// ============================================
// FRIGO - SPACE SERVICE (MERGED)
// ============================================
// Service functions for managing shared spaces
// Location: lib/services/spaceService.ts
// Created: December 18, 2025
//
// Combines:
// - Consistent {success, error} return pattern
// - Mutual follows search (privacy-focused)
// - SQL RPC permission checks
// - Complete CRUD operations
// ============================================

import { supabase } from '../supabase';
import {
  Space,
  SpaceUpdate,
  SpaceRole,
  SpaceMemberWithProfile,
  SpaceMemberStatus,
  SpaceSettings,
  SpaceSettingsUpdate,
  SpaceWithRole,
  SpaceWithDetails,
  CreateSpaceInput,
  PendingSpaceInvitation,
  SpaceAction,
  ServiceResult,
} from '../types/space';

// ============================================
// SPACE CRUD
// ============================================

/**
 * Create a new space
 * Automatically adds creator as owner and creates default settings
 */
export async function createSpace(
  userId: string,
  input: CreateSpaceInput
): Promise<ServiceResult<Space>> {
  try {
    console.log('🏠 Creating space:', input.name);

    // Validate input
    if (!input.name?.trim()) {
      return { success: false, error: 'Space name is required' };
    }

    // Create the space
    const { data: space, error: spaceError } = await supabase
      .from('spaces')
      .insert({
        name: input.name.trim(),
        emoji: input.emoji || '🏠',
        description: input.description?.trim() || null,
        created_by: userId,
        is_default: false,
      })
      .select()
      .single();

    if (spaceError) {
      console.error('❌ Error creating space:', spaceError);
      throw spaceError;
    }

    // Add creator as owner (auto-accepted)
    const { error: memberError } = await supabase
      .from('space_members')
      .insert({
        space_id: space.id,
        user_id: userId,
        role: 'owner' as SpaceRole,
        invited_by: userId,
        status: 'accepted' as SpaceMemberStatus,
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('❌ Error adding owner:', memberError);
      // Rollback space creation
      await supabase.from('spaces').delete().eq('id', space.id);
      throw memberError;
    }

    // Create default settings (copy from user's preferences if available)
    const { data: userPrefs } = await supabase
      .from('user_pantry_preferences')
      .select('low_stock_threshold, critical_stock_threshold')
      .eq('user_id', userId)
      .single();

    const { error: settingsError } = await supabase
      .from('space_settings')
      .insert({
        space_id: space.id,
        low_stock_threshold: userPrefs?.low_stock_threshold || 2,
        critical_stock_threshold: userPrefs?.critical_stock_threshold || 0,
      });

    if (settingsError) {
      console.error('⚠️ Error creating settings (non-fatal):', settingsError);
    }

    console.log('✅ Space created:', space.id);
    return { success: true, data: space };
  } catch (error) {
    console.error('❌ Error in createSpace:', error);
    return { success: false, error: 'Failed to create space' };
  }
}

/**
 * Get a space by ID
 */
export async function getSpace(spaceId: string): Promise<Space | null> {
  try {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', spaceId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error getting space:', error);
    return null;
  }
}

/**
 * Get a space with all details (members, settings, counts)
 */
export async function getSpaceWithDetails(
  spaceId: string,
  userId: string
): Promise<SpaceWithDetails | null> {
  try {
    // Get space
    const { data: space, error: spaceError } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', spaceId)
      .single();

    if (spaceError || !space) return null;

    // Get members with profiles
    const { data: members } = await supabase
      .from('space_members')
      .select(`
        *,
        user_profile:user_profiles!space_members_user_id_fkey(
          id, username, display_name, avatar_url
        ),
        invited_by_profile:user_profiles!space_members_invited_by_fkey(
          id, username, display_name
        )
      `)
      .eq('space_id', spaceId)
      .eq('status', 'accepted');

    // Get settings
    const { data: settings } = await supabase
      .from('space_settings')
      .select('*')
      .eq('space_id', spaceId)
      .single();

    // Get counts
    const { count: itemCount } = await supabase
      .from('pantry_items')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', spaceId);

    const ownerCount = members?.filter(m => m.role === 'owner').length || 0;

    return {
      ...space,
      members: (members || []) as SpaceMemberWithProfile[],
      settings: settings as SpaceSettings,
      member_count: members?.length || 0,
      item_count: itemCount || 0,
      owner_count: ownerCount,
    };
  } catch (error) {
    console.error('❌ Error getting space details:', error);
    return null;
  }
}

/**
 * Update space details (owner only)
 */
export async function updateSpace(
  spaceId: string,
  userId: string,
  updates: SpaceUpdate
): Promise<ServiceResult> {
  try {
    // Check permission
    const hasPermission = await checkPermission(spaceId, userId, 'edit_settings');
    if (!hasPermission) {
      return { success: false, error: 'Only owners can edit space details' };
    }

    const { error } = await supabase
      .from('spaces')
      .update({
        name: updates.name?.trim(),
        emoji: updates.emoji,
        description: updates.description?.trim(),
      })
      .eq('id', spaceId);

    if (error) throw error;

    console.log('✅ Space updated:', spaceId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating space:', error);
    return { success: false, error: 'Failed to update space' };
  }
}

/**
 * Delete a space (owner only)
 * Note: Pantry items will be deleted due to CASCADE
 */
export async function deleteSpace(
  spaceId: string,
  userId: string
): Promise<ServiceResult> {
  try {
    // Check if this is a default space
    const { data: space } = await supabase
      .from('spaces')
      .select('is_default')
      .eq('id', spaceId)
      .single();

    if (space?.is_default) {
      return { success: false, error: 'Cannot delete your Home space' };
    }

    // Check permission
    const hasPermission = await checkPermission(spaceId, userId, 'delete_space');
    if (!hasPermission) {
      return { success: false, error: 'Only owners can delete spaces' };
    }

    // Delete space (cascades to members, settings, pantry items)
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', spaceId);

    if (error) throw error;

    console.log('✅ Space deleted:', spaceId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting space:', error);
    return { success: false, error: 'Failed to delete space' };
  }
}

// ============================================
// USER'S SPACES
// ============================================

/**
 * Get all spaces for a user (that they've accepted membership in)
 */
export async function getUserSpaces(userId: string): Promise<SpaceWithRole[]> {
  try {
    console.log('🔍 Getting spaces for user:', userId);

    const { data, error } = await supabase
      .from('space_members')
      .select(`
        role,
        status,
        joined_at,
        space:spaces(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (error) throw error;

    // Transform and add counts
    const spacesWithDetails: SpaceWithRole[] = await Promise.all(
      (data || []).map(async (item: any) => {
        // Handle Supabase nested relation - could be array or object
        const spaceData = Array.isArray(item.space) ? item.space[0] : item.space;
        if (!spaceData) return null;

        // Get member count
        const { count: memberCount } = await supabase
          .from('space_members')
          .select('*', { count: 'exact', head: true })
          .eq('space_id', spaceData.id)
          .eq('status', 'accepted');

        // Get item count
        const { count: itemCount } = await supabase
          .from('pantry_items')
          .select('*', { count: 'exact', head: true })
          .eq('space_id', spaceData.id);

        return {
          ...spaceData,
          role: item.role as SpaceRole,
          status: item.status as SpaceMemberStatus,
          joined_at: item.joined_at,
          member_count: memberCount || 0,
          item_count: itemCount || 0,
        };
      })
    );

    // Filter out nulls and sort: default first, then by name
    const validSpaces = spacesWithDetails.filter(s => s !== null) as SpaceWithRole[];
    validSpaces.sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return a.name.localeCompare(b.name);
    });

    console.log('✅ Found', validSpaces.length, 'spaces');
    return validSpaces;
  } catch (error) {
    console.error('❌ Error getting user spaces:', error);
    return [];
  }
}

// ============================================
// ACTIVE SPACE
// ============================================

/**
 * Get user's currently active space
 */
export async function getActiveSpace(userId: string): Promise<SpaceWithRole | null> {
  try {
    console.log('🔍 Getting active space for user:', userId);

    // Get active space ID
    const { data: activeData } = await supabase
      .from('user_active_space')
      .select('active_space_id')
      .eq('user_id', userId)
      .single();

    let activeSpaceId = activeData?.active_space_id;

    // If no active space, get default
    if (!activeSpaceId) {
      const { data: defaultSpace } = await supabase
        .from('space_members')
        .select('space_id, spaces!inner(is_default)')
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .eq('spaces.is_default', true)
        .single();

      activeSpaceId = defaultSpace?.space_id;
    }

    if (!activeSpaceId) {
      // No spaces at all - will be created by ensureDefaultSpace
      return null;
    }

    // Get full space details
    const { data } = await supabase
      .from('space_members')
      .select(`
        role,
        status,
        joined_at,
        space:spaces(*)
      `)
      .eq('user_id', userId)
      .eq('space_id', activeSpaceId)
      .eq('status', 'accepted')
      .single();

    if (!data) return null;

    // Supabase returns nested relations - handle the space object
    // It could be an array or object depending on the relationship
    const spaceData = Array.isArray(data.space) ? data.space[0] : data.space;
    if (!spaceData) return null;

    // Get counts
    const { count: memberCount } = await supabase
      .from('space_members')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', activeSpaceId)
      .eq('status', 'accepted');

    const { count: itemCount } = await supabase
      .from('pantry_items')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', activeSpaceId);

    return {
      ...(spaceData as Space),
      role: data.role as SpaceRole,
      status: data.status as SpaceMemberStatus,
      joined_at: data.joined_at,
      member_count: memberCount || 0,
      item_count: itemCount || 0,
    };
  } catch (error) {
    console.error('❌ Error getting active space:', error);
    return null;
  }
}

/**
 * Set user's active space
 */
export async function setActiveSpace(
  userId: string,
  spaceId: string
): Promise<ServiceResult> {
  try {
    console.log('🔄 Setting active space:', spaceId);

    // Verify user is a member
    const { data: membership } = await supabase
      .from('space_members')
      .select('id')
      .eq('user_id', userId)
      .eq('space_id', spaceId)
      .eq('status', 'accepted')
      .single();

    if (!membership) {
      return { success: false, error: 'You are not a member of this space' };
    }

    const { error } = await supabase
      .from('user_active_space')
      .upsert({
        user_id: userId,
        active_space_id: spaceId,
        switched_at: new Date().toISOString(),
      });

    if (error) throw error;

    console.log('✅ Active space set');
    return { success: true };
  } catch (error) {
    console.error('❌ Error setting active space:', error);
    return { success: false, error: 'Failed to switch space' };
  }
}

// ============================================
// INVITATIONS
// ============================================

/**
 * Invite a user to a space
 */
export async function inviteMember(
  spaceId: string,
  inviterId: string,
  inviteeId: string,
  role: SpaceRole
): Promise<ServiceResult> {
  try {
    console.log('📨 Inviting user:', inviteeId, 'as', role);

    // Check inviter's permission
    if (role === 'owner' || role === 'member') {
      const canInvite = await checkPermission(spaceId, inviterId, 'invite_member');
      if (!canInvite) {
        return { success: false, error: 'Only owners can invite members' };
      }
    } else {
      const canInvite = await checkPermission(spaceId, inviterId, 'invite_guest');
      if (!canInvite) {
        return { success: false, error: 'You do not have permission to invite' };
      }
    }

    // Check if already a member or has pending invitation
    const { data: existing } = await supabase
      .from('space_members')
      .select('id, status')
      .eq('space_id', spaceId)
      .eq('user_id', inviteeId)
      .single();

    if (existing) {
      if (existing.status === 'accepted') {
        return { success: false, error: 'User is already a member' };
      }
      if (existing.status === 'pending') {
        return { success: false, error: 'User already has a pending invitation' };
      }
      // If declined, we can re-invite by updating
      const { error } = await supabase
        .from('space_members')
        .update({
          role,
          status: 'pending',
          invited_by: inviterId,
          invited_at: new Date().toISOString(),
          joined_at: null,
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Create new invitation
      const { error } = await supabase
        .from('space_members')
        .insert({
          space_id: spaceId,
          user_id: inviteeId,
          role,
          invited_by: inviterId,
          status: 'pending',
        });

      if (error) throw error;
    }

    console.log('✅ Invitation sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Error inviting member:', error);
    return { success: false, error: 'Failed to send invitation' };
  }
}

/**
 * Get pending invitations for a user
 */
export async function getPendingInvitations(userId: string): Promise<PendingSpaceInvitation[]> {
  try {
    console.log('🔍 Getting pending invitations for:', userId);

    const { data, error } = await supabase
      .from('space_members')
      .select(`
        id,
        space_id,
        role,
        invited_by,
        invited_at,
        space:spaces(name, emoji),
        inviter:user_profiles!space_members_invited_by_fkey(username, display_name)
      `)
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;

    const invitations: PendingSpaceInvitation[] = (data || []).map((item: any) => ({
      id: item.id,
      space_id: item.space_id,
      space_name: item.space?.name || 'Unknown Space',
      space_emoji: item.space?.emoji || '🏠',
      role: item.role,
      invited_by: item.invited_by,
      inviter_name: item.inviter?.display_name || item.inviter?.username || 'Unknown',
      inviter_username: item.inviter?.username || 'unknown',
      invited_at: item.invited_at,
    }));

    console.log('✅ Found', invitations.length, 'pending invitations');
    return invitations;
  } catch (error) {
    console.error('❌ Error getting invitations:', error);
    return [];
  }
}

/**
 * Respond to a space invitation (accept or decline)
 */
export async function respondToInvitation(
  spaceId: string,
  userId: string,
  accept: boolean
): Promise<ServiceResult> {
  try {
    console.log(accept ? '✅ Accepting' : '❌ Declining', 'invitation to space:', spaceId);

    const { error } = await supabase
      .from('space_members')
      .update({
        status: accept ? 'accepted' : 'declined',
        joined_at: accept ? new Date().toISOString() : null,
      })
      .eq('space_id', spaceId)
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;

    console.log('✅ Invitation', accept ? 'accepted' : 'declined');
    return { success: true };
  } catch (error) {
    console.error('❌ Error responding to invitation:', error);
    return { success: false, error: 'Failed to respond to invitation' };
  }
}

/**
 * Remove a member from a space
 */
export async function removeMember(
  spaceId: string,
  removerId: string,
  targetUserId: string
): Promise<ServiceResult> {
  try {
    console.log('🗑️ Removing member:', targetUserId);

    // Check permission
    const hasPermission = await checkPermission(spaceId, removerId, 'remove_member');
    if (!hasPermission) {
      return { success: false, error: 'Only owners can remove members' };
    }

    // Can't remove yourself this way (use leaveSpace instead)
    if (removerId === targetUserId) {
      return { success: false, error: 'Use "Leave Space" to remove yourself' };
    }

    const { error } = await supabase
      .from('space_members')
      .delete()
      .eq('space_id', spaceId)
      .eq('user_id', targetUserId);

    if (error) throw error;

    console.log('✅ Member removed');
    return { success: true };
  } catch (error) {
    console.error('❌ Error removing member:', error);
    return { success: false, error: 'Failed to remove member' };
  }
}

/**
 * Leave a space (remove yourself)
 */
export async function leaveSpace(
  spaceId: string,
  userId: string
): Promise<ServiceResult> {
  try {
    console.log('👋 Leaving space:', spaceId);

    // Check if user is the only owner
    const { data: membership } = await supabase
      .from('space_members')
      .select('role')
      .eq('space_id', spaceId)
      .eq('user_id', userId)
      .single();

    if (membership?.role === 'owner') {
      // Count other owners
      const { count: ownerCount } = await supabase
        .from('space_members')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .eq('role', 'owner')
        .eq('status', 'accepted')
        .neq('user_id', userId);

      if ((ownerCount || 0) === 0) {
        return { 
          success: false, 
          error: 'Cannot leave: You are the only owner. Transfer ownership or delete the space.' 
        };
      }
    }

    // Check if this is their default space
    const { data: space } = await supabase
      .from('spaces')
      .select('is_default')
      .eq('id', spaceId)
      .single();

    if (space?.is_default) {
      return { success: false, error: 'Cannot leave your Home space' };
    }

    const { error } = await supabase
      .from('space_members')
      .delete()
      .eq('space_id', spaceId)
      .eq('user_id', userId);

    if (error) throw error;

    console.log('✅ Left space');
    return { success: true };
  } catch (error) {
    console.error('❌ Error leaving space:', error);
    return { success: false, error: 'Failed to leave space' };
  }
}

/**
 * Change a member's role (owner only)
 */
export async function changeRole(
  spaceId: string,
  changerId: string,
  targetUserId: string,
  newRole: SpaceRole
): Promise<ServiceResult> {
  try {
    // Check permission
    const hasPermission = await checkPermission(spaceId, changerId, 'edit_settings');
    if (!hasPermission) {
      return { success: false, error: 'Only owners can change roles' };
    }

    // If demoting an owner, make sure there's at least one other owner
    const currentRole = await getMemberRole(spaceId, targetUserId);
    if (currentRole === 'owner' && newRole !== 'owner') {
      const { count: ownerCount } = await supabase
        .from('space_members')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .eq('role', 'owner')
        .eq('status', 'accepted');

      if (ownerCount === 1) {
        return { 
          success: false, 
          error: 'Cannot demote the only owner' 
        };
      }
    }

    const { error } = await supabase
      .from('space_members')
      .update({ role: newRole })
      .eq('space_id', spaceId)
      .eq('user_id', targetUserId);

    if (error) throw error;

    console.log('✅ Role changed to:', newRole);
    return { success: true };
  } catch (error) {
    console.error('❌ Error changing role:', error);
    return { success: false, error: 'Failed to change role' };
  }
}

// ============================================
// SPACE SETTINGS
// ============================================

/**
 * Get space settings
 */
export async function getSpaceSettings(spaceId: string): Promise<SpaceSettings | null> {
  try {
    const { data, error } = await supabase
      .from('space_settings')
      .select('*')
      .eq('space_id', spaceId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error getting space settings:', error);
    return null;
  }
}

/**
 * Update space settings (owner only)
 */
export async function updateSpaceSettings(
  spaceId: string,
  userId: string,
  settings: SpaceSettingsUpdate
): Promise<ServiceResult> {
  try {
    // Check permission
    const hasPermission = await checkPermission(spaceId, userId, 'edit_settings');
    if (!hasPermission) {
      return { success: false, error: 'Only owners can edit settings' };
    }

    const { error } = await supabase
      .from('space_settings')
      .update(settings)
      .eq('space_id', spaceId);

    if (error) throw error;

    console.log('✅ Space settings updated');
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating space settings:', error);
    return { success: false, error: 'Failed to update settings' };
  }
}

// ============================================
// PERMISSION HELPERS
// ============================================

/**
 * Check if user has permission for an action (uses SQL function)
 */
export async function checkPermission(
  spaceId: string,
  userId: string,
  action: SpaceAction
): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('check_space_permission', {
      p_space_id: spaceId,
      p_user_id: userId,
      p_action: action,
    });

    return data === true;
  } catch (error) {
    console.error('❌ Error checking permission:', error);
    return false;
  }
}

/**
 * Get user's role in a space
 */
export async function getMemberRole(
  spaceId: string,
  userId: string
): Promise<SpaceRole | null> {
  try {
    const { data } = await supabase
      .from('space_members')
      .select('role')
      .eq('space_id', spaceId)
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .single();

    return data?.role || null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if user is a member of a space
 */
export async function isMember(spaceId: string, userId: string): Promise<boolean> {
  const role = await getMemberRole(spaceId, userId);
  return role !== null;
}

/**
 * Get space members
 */
export async function getSpaceMembers(
  spaceId: string
): Promise<SpaceMemberWithProfile[]> {
  try {
    const { data, error } = await supabase
      .from('space_members')
      .select(`
        *,
        user_profile:user_profiles!space_members_user_id_fkey(
          id, username, display_name, avatar_url
        ),
        invited_by_profile:user_profiles!space_members_invited_by_fkey(
          id, username, display_name
        )
      `)
      .eq('space_id', spaceId)
      .eq('status', 'accepted')
      .order('role', { ascending: true }); // owners first

    if (error) throw error;
    return (data || []) as SpaceMemberWithProfile[];
  } catch (error) {
    console.error('❌ Error getting space members:', error);
    return [];
  }
}

// ============================================
// SEARCH / DISCOVERY (MUTUAL FOLLOWS ONLY)
// ============================================

/**
 * Search for users to invite (must be mutual follows for privacy)
 * This ensures users can only invite people they have a relationship with
 */
export async function searchUsersToInvite(
  query: string,
  spaceId: string,
  currentUserId: string,
  limit: number = 10
): Promise<{ id: string; username: string; display_name: string | null; avatar_url: string | null }[]> {
  try {
    if (!query || query.length < 2) return [];

    console.log('🔍 Searching invitable users:', query);

    // Get users the current user follows
    const { data: following, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    if (followingError) throw followingError;

    const followingIds = (following || []).map(f => f.following_id);

    if (followingIds.length === 0) {
      return [];
    }

    // Check who follows back (mutual)
    const { data: followBack, error: followBackError } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', currentUserId)
      .in('follower_id', followingIds);

    if (followBackError) throw followBackError;

    const mutualIds = (followBack || []).map(f => f.follower_id);

    if (mutualIds.length === 0) {
      return [];
    }

    // Get current members to exclude
    const { data: currentMembers } = await supabase
      .from('space_members')
      .select('user_id')
      .eq('space_id', spaceId)
      .in('status', ['pending', 'accepted']);

    const excludeIds = (currentMembers || []).map(m => m.user_id);

    // Filter out existing members
    const invitableIds = mutualIds.filter(id => !excludeIds.includes(id));

    if (invitableIds.length === 0) {
      return [];
    }

    // Search within invitable users
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', invitableIds)
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;

    console.log('✅ Found', data?.length || 0, 'invitable users');
    return data || [];
  } catch (error) {
    console.error('❌ Error searching users:', error);
    return [];
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Ensure user has a default Home space
 * Called on app start / user creation
 */
export async function ensureDefaultSpace(userId: string): Promise<string> {
  try {
    // Check if user has a default space
    const { data: existing } = await supabase
      .from('space_members')
      .select('space_id, spaces!inner(is_default)')
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .eq('spaces.is_default', true)
      .single();

    if (existing?.space_id) {
      return existing.space_id;
    }

    // Create default space using SQL function
    const { data: newSpaceId } = await supabase.rpc('create_default_space_for_user', {
      p_user_id: userId,
    });

    return newSpaceId;
  } catch (error) {
    console.error('❌ Error ensuring default space:', error);
    throw error;
  }
}

/**
 * Get count of members by role
 */
export async function getMemberCounts(spaceId: string): Promise<{
  owners: number;
  members: number;
  guests: number;
  total: number;
}> {
  try {
    const { data, error } = await supabase
      .from('space_members')
      .select('role')
      .eq('space_id', spaceId)
      .eq('status', 'accepted');

    if (error) throw error;

    const counts = {
      owners: 0,
      members: 0,
      guests: 0,
      total: data?.length || 0,
    };

    data?.forEach(m => {
      if (m.role === 'owner') counts.owners++;
      else if (m.role === 'member') counts.members++;
      else if (m.role === 'guest') counts.guests++;
    });

    return counts;
  } catch (error) {
    console.error('❌ Error getting member counts:', error);
    return { owners: 0, members: 0, guests: 0, total: 0 };
  }
}