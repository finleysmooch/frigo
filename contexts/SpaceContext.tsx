// ============================================
// FRIGO - SPACE CONTEXT (MERGED)
// ============================================
// React Context for global space state management
// Location: contexts/SpaceContext.tsx
// Created: December 18, 2025
//
// Combines:
// - Invitation handling in context
// - Convenience hooks
// - isInitialized flag
// - Consistent permission helpers
// ============================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  Space,
  SpaceWithRole,
  SpaceContextValue,
  CreateSpaceInput,
  PendingSpaceInvitation,
  getSpacePermissions,
} from '../lib/types/space';
import {
  getUserSpaces,
  getActiveSpace,
  setActiveSpace,
  createSpace as createSpaceService,
  ensureDefaultSpace,
  getPendingInvitations,
  respondToInvitation,
} from '../lib/services/spaceService';

// ============================================
// CONTEXT
// ============================================

const SpaceContext = createContext<SpaceContextValue | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

interface SpaceProviderProps {
  children: ReactNode;
}

export function SpaceProvider({ children }: SpaceProviderProps) {
  // State
  const [activeSpace, setActiveSpaceState] = useState<SpaceWithRole | null>(null);
  const [userSpaces, setUserSpaces] = useState<SpaceWithRole[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingSpaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ============================================
  // INITIALIZATION
  // ============================================

  // Get current user on mount
  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Error getting user:', error);
        setIsLoading(false);
      }
    };

    initUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setCurrentUserId(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUserId(null);
          setActiveSpaceState(null);
          setUserSpaces([]);
          setPendingInvitations([]);
          setIsInitialized(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load spaces when user changes
  useEffect(() => {
    if (currentUserId) {
      loadSpaces();
    }
  }, [currentUserId]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadSpaces = useCallback(async () => {
    if (!currentUserId) return;

    try {
      setIsLoading(true);
      console.log('🔄 Loading spaces for user...');

      // Ensure user has default space
      await ensureDefaultSpace(currentUserId);

      // Get all user's spaces
      const spaces = await getUserSpaces(currentUserId);
      setUserSpaces(spaces);

      // Get active space
      const active = await getActiveSpace(currentUserId);
      setActiveSpaceState(active);

      // Get pending invitations
      const invitations = await getPendingInvitations(currentUserId);
      setPendingInvitations(invitations);

      setIsInitialized(true);
      console.log('✅ Loaded', spaces.length, 'spaces,', invitations.length, 'pending invitations');
    } catch (error) {
      console.error('❌ Error loading spaces:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Switch to a different space
   */
  const switchSpace = useCallback(async (spaceId: string) => {
    if (!currentUserId) return;
    if (spaceId === activeSpace?.id) return; // Already active

    try {
      setIsSwitching(true);
      console.log('🔄 Switching to space:', spaceId);

      const result = await setActiveSpace(currentUserId, spaceId);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to switch space');
        return;
      }

      // Update local state
      const newActive = userSpaces.find(s => s.id === spaceId);
      if (newActive) {
        setActiveSpaceState(newActive);
      } else {
        // Space not in local list, reload
        const active = await getActiveSpace(currentUserId);
        setActiveSpaceState(active);
      }

      console.log('✅ Switched to:', newActive?.name);
    } catch (error) {
      console.error('❌ Error switching space:', error);
      Alert.alert('Error', 'Failed to switch space');
    } finally {
      setIsSwitching(false);
    }
  }, [currentUserId, activeSpace, userSpaces]);

  /**
   * Refresh spaces list
   */
  const refreshSpaces = useCallback(async () => {
    await loadSpaces();
  }, [loadSpaces]);

  /**
   * Create a new space and switch to it
   */
  const createSpace = useCallback(async (
    input: CreateSpaceInput
  ): Promise<Space | null> => {
    if (!currentUserId) return null;

    try {
      console.log('🏠 Creating new space:', input.name);

      const result = await createSpaceService(currentUserId, input);

      if (!result.success || !result.data) {
        Alert.alert('Error', result.error || 'Failed to create space');
        return null;
      }

      // Refresh spaces list
      await loadSpaces();

      // Switch to new space
      await switchSpace(result.data.id);

      console.log('✅ Created and switched to:', result.data.name);
      return result.data;
    } catch (error) {
      console.error('❌ Error creating space:', error);
      Alert.alert('Error', 'Failed to create space');
      return null;
    }
  }, [currentUserId, loadSpaces, switchSpace]);

  /**
   * Accept a space invitation
   */
  const acceptInvitation = useCallback(async (invitationId: string) => {
    if (!currentUserId) return;

    try {
      console.log('✅ Accepting invitation:', invitationId);

      // Find the invitation to get space_id
      const invitation = pendingInvitations.find(i => i.id === invitationId);
      if (!invitation) {
        Alert.alert('Error', 'Invitation not found');
        return;
      }

      const result = await respondToInvitation(invitation.space_id, currentUserId, true);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to accept invitation');
        return;
      }

      // Refresh to get updated spaces and invitations
      await loadSpaces();

      Alert.alert('Joined!', `You are now part of ${invitation.space_name}`);
    } catch (error) {
      console.error('❌ Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to accept invitation');
    }
  }, [currentUserId, pendingInvitations, loadSpaces]);

  /**
   * Decline a space invitation
   */
  const declineInvitation = useCallback(async (invitationId: string) => {
    if (!currentUserId) return;

    try {
      console.log('❌ Declining invitation:', invitationId);

      // Find the invitation to get space_id
      const invitation = pendingInvitations.find(i => i.id === invitationId);
      if (!invitation) {
        Alert.alert('Error', 'Invitation not found');
        return;
      }

      const result = await respondToInvitation(invitation.space_id, currentUserId, false);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to decline invitation');
        return;
      }

      // Remove from local state immediately
      setPendingInvitations(prev => prev.filter(i => i.id !== invitationId));
    } catch (error) {
      console.error('❌ Error declining invitation:', error);
      Alert.alert('Error', 'Failed to decline invitation');
    }
  }, [currentUserId, pendingInvitations]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const permissions = getSpacePermissions(
    activeSpace?.role || null,
    userSpaces.filter(s => s.id === activeSpace?.id && s.role === 'owner').length
  );

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: SpaceContextValue = {
    // State
    activeSpace,
    activeSpaceId: activeSpace?.id || null,
    userSpaces,
    pendingInvitations,
    isLoading,
    isSwitching,
    isInitialized,

    // Actions
    switchSpace,
    refreshSpaces,
    createSpace,
    acceptInvitation,
    declineInvitation,

    // Permission helpers
    isOwner: activeSpace?.role === 'owner',
    isMember: activeSpace?.role === 'member',
    isGuest: activeSpace?.role === 'guest',
    canEditSettings: permissions.canEditSettings,
    canDeleteItems: permissions.canDeleteItems,
    canInviteMembers: permissions.canInviteMembers,
    canInviteGuests: permissions.canInviteGuests,
  };

  return (
    <SpaceContext.Provider value={value}>
      {children}
    </SpaceContext.Provider>
  );
}

// ============================================
// MAIN HOOK
// ============================================

/**
 * Hook to access space context
 * Must be used within SpaceProvider
 */
export function useSpace(): SpaceContextValue {
  const context = useContext(SpaceContext);

  if (context === undefined) {
    throw new Error('useSpace must be used within a SpaceProvider');
  }

  return context;
}

// ============================================
// CONVENIENCE HOOKS
// ============================================

/**
 * Get just the active space ID (for queries)
 */
export function useActiveSpaceId(): string | null {
  const { activeSpaceId } = useSpace();
  return activeSpaceId;
}

/**
 * Get just the active space
 */
export function useActiveSpace(): SpaceWithRole | null {
  const { activeSpace } = useSpace();
  return activeSpace;
}

/**
 * Check if user can perform action in current space
 */
export function useSpacePermissions() {
  const {
    activeSpace,
    isOwner,
    isMember,
    isGuest,
    canEditSettings,
    canDeleteItems,
    canInviteMembers,
    canInviteGuests,
  } = useSpace();

  return {
    role: activeSpace?.role || null,
    isOwner,
    isMember,
    isGuest,
    canEditSettings,
    canDeleteItems,
    canInviteMembers,
    canInviteGuests,
    canAddItems: true, // All roles can add
    canView: true, // All roles can view
  };
}

/**
 * Hook for space switching UI
 */
export function useSpaceSwitcher() {
  const {
    activeSpace,
    userSpaces,
    pendingInvitations,
    isSwitching,
    switchSpace,
    createSpace,
    refreshSpaces,
  } = useSpace();

  return {
    currentSpace: activeSpace,
    spaces: userSpaces,
    pendingInvitations,
    isSwitching,
    switchTo: switchSpace,
    createNew: createSpace,
    refresh: refreshSpaces,
  };
}

/**
 * Hook for pending invitations
 */
export function usePendingInvitations() {
  const {
    pendingInvitations,
    acceptInvitation,
    declineInvitation,
    refreshSpaces,
  } = useSpace();

  return {
    invitations: pendingInvitations,
    count: pendingInvitations.length,
    accept: acceptInvitation,
    decline: declineInvitation,
    refresh: refreshSpaces,
  };
}

/**
 * Hook to check if context is ready
 */
export function useSpaceReady(): boolean {
  const { isInitialized, isLoading, activeSpace } = useSpace();
  return isInitialized && !isLoading && activeSpace !== null;
}

// ============================================
// EXPORTS
// ============================================

export { SpaceContext };