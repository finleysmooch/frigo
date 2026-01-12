// ============================================
// FRIGO - SPACE TYPES
// ============================================
// TypeScript types for shared pantries/spaces feature
// Location: lib/types/space.ts
// Created: December 18, 2025
// ============================================

// ============================================
// ENUMS / CONSTANTS
// ============================================

export type SpaceRole = 'owner' | 'member' | 'guest';
export type SpaceMemberStatus = 'pending' | 'accepted' | 'declined';
export type RecipeAccessType = 'sous_chef' | 'meal_plan';
export type PurchaseType = 'recipe' | 'cookbook';

export type SpaceAction = 
  | 'view'
  | 'add_item'
  | 'delete_item'
  | 'edit_settings'
  | 'invite_member'
  | 'invite_guest'
  | 'remove_member'
  | 'delete_space';

// ============================================
// CORE SPACE TYPES
// ============================================

export interface Space {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  created_by: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpaceInsert {
  name: string;
  emoji?: string;
  description?: string;
  created_by: string;
  is_default?: boolean;
}

export interface SpaceUpdate {
  name?: string;
  emoji?: string;
  description?: string;
}

// ============================================
// SPACE MEMBER TYPES
// ============================================

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  role: SpaceRole;
  invited_by: string | null;
  invited_at: string;
  joined_at: string | null;
  status: SpaceMemberStatus;
}

export interface SpaceMemberWithProfile extends SpaceMember {
  user_profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  invited_by_profile?: {
    id: string;
    username: string;
    display_name: string | null;
  };
}

export interface SpaceMemberInsert {
  space_id: string;
  user_id: string;
  role: SpaceRole;
  invited_by?: string;
  status?: SpaceMemberStatus;
}

// ============================================
// SPACE SETTINGS TYPES
// ============================================

export interface SpaceSettings {
  id: string;
  space_id: string;
  default_expiration_fridge_days: number;
  default_expiration_freezer_days: number;
  default_expiration_pantry_days: number;
  default_expiration_counter_days: number;
  low_stock_threshold: number;
  critical_stock_threshold: number;
  settings_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SpaceSettingsUpdate {
  default_expiration_fridge_days?: number;
  default_expiration_freezer_days?: number;
  default_expiration_pantry_days?: number;
  default_expiration_counter_days?: number;
  low_stock_threshold?: number;
  critical_stock_threshold?: number;
  settings_json?: Record<string, any>;
}

// ============================================
// SPACE WITH DETAILS (JOINED DATA)
// ============================================

export interface SpaceWithRole extends Space {
  role: SpaceRole;
  status: SpaceMemberStatus;
  joined_at: string | null;
  member_count: number;
  item_count: number;
}

export interface SpaceWithDetails extends Space {
  members: SpaceMemberWithProfile[];
  settings: SpaceSettings;
  member_count: number;
  item_count: number;
  owner_count: number;
}

// ============================================
// USER ACTIVE SPACE
// ============================================

export interface UserActiveSpace {
  user_id: string;
  active_space_id: string;
  switched_at: string;
}

// ============================================
// RECIPE TEMPORARY ACCESS
// ============================================

export interface RecipeTemporaryAccess {
  id: string;
  recipe_id: string;
  user_id: string;
  granted_by: string;
  meal_id: string | null;
  access_type: RecipeAccessType;
  granted_at: string;
  expires_at: string | null;
}

export interface RecipeTemporaryAccessWithDetails extends RecipeTemporaryAccess {
  recipe: {
    id: string;
    title: string;
    image_url: string | null;
  };
  grantor: {
    id: string;
    username: string;
    display_name: string | null;
  };
  meal?: {
    id: string;
    title: string;
  };
}

export interface RecipeAccessResult {
  has_access: boolean;
  access_type: 'owner' | 'temporary' | 'none';
  can_annotate: boolean;
  can_share: boolean;
  temporary_access?: RecipeTemporaryAccess;
  expires_at?: string;
}

// ============================================
// RECIPE PURCHASES
// ============================================

export interface RecipePurchase {
  id: string;
  user_id: string;
  source_recipe_id: string;
  purchased_recipe_id: string | null;
  source_owner_id: string;
  include_annotations: boolean;
  purchase_type: PurchaseType;
  cookbook_id: string | null;
  purchased_at: string;
  simulated_price: number | null;
  tip_amount: number | null;
}

export interface PurchaseRecipeOptions {
  include_annotations: boolean;
  simulated_price?: number;
}

export interface PurchaseCookbookOptions {
  book_id: string;
  source_user_id: string;
  simulated_price?: number;
}

export interface TipChefOptions {
  recipe_id: string;
  amount: number;
}

// ============================================
// GROCERY LIST MEMBERS
// ============================================

export interface GroceryListMember {
  id: string;
  list_id: string;
  user_id: string;
  added_by: string | null;
  added_at: string;
}

export interface GroceryListMemberWithProfile extends GroceryListMember {
  user_profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// ============================================
// SERVICE INPUT TYPES
// ============================================

export interface CreateSpaceInput {
  name: string;
  emoji?: string;
  description?: string;
}

export interface InviteMemberInput {
  space_id: string;
  user_id: string;
  role: SpaceRole;
}

export interface GrantRecipeAccessInput {
  recipe_id: string;
  user_id: string;
  meal_id?: string;
  access_type?: RecipeAccessType;
}

// ============================================
// SERVICE RESULT TYPES
// ============================================

export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// SPACE CONTEXT TYPES (For React Context)
// ============================================

export interface SpaceContextValue {
  // Current active space
  activeSpace: SpaceWithRole | null;
  activeSpaceId: string | null;
  
  // All user's spaces
  userSpaces: SpaceWithRole[];
  
  // Pending invitations
  pendingInvitations: PendingSpaceInvitation[];
  
  // Loading states
  isLoading: boolean;
  isSwitching: boolean;
  isInitialized: boolean;
  
  // Actions
  switchSpace: (spaceId: string) => Promise<void>;
  refreshSpaces: () => Promise<void>;
  createSpace: (input: CreateSpaceInput) => Promise<Space | null>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  declineInvitation: (invitationId: string) => Promise<void>;
  
  // Permission helpers
  isOwner: boolean;
  isMember: boolean;
  isGuest: boolean;
  canEditSettings: boolean;
  canDeleteItems: boolean;
  canInviteMembers: boolean;
  canInviteGuests: boolean;
}

// ============================================
// PENDING INVITATIONS
// ============================================

export interface PendingSpaceInvitation {
  id: string;
  space_id: string;
  space_name: string;
  space_emoji: string;
  role: SpaceRole;
  invited_by: string;
  inviter_name: string;
  inviter_username: string;
  invited_at: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface SpacePermissions {
  canView: boolean;
  canAddItems: boolean;
  canDeleteItems: boolean;
  canEditSettings: boolean;
  canInviteMembers: boolean;
  canInviteGuests: boolean;
  canRemoveMembers: boolean;
  canDeleteSpace: boolean;
  canLeave: boolean;
}

/**
 * Get permissions for a given role
 * @param role - The user's role in the space
 * @param ownerCount - Number of owners (for determining if can leave)
 */
export function getSpacePermissions(role: SpaceRole | null, ownerCount?: number): SpacePermissions {
  if (!role) {
    return {
      canView: false,
      canAddItems: false,
      canDeleteItems: false,
      canEditSettings: false,
      canInviteMembers: false,
      canInviteGuests: false,
      canRemoveMembers: false,
      canDeleteSpace: false,
      canLeave: false,
    };
  }

  const isOwner = role === 'owner';
  const isMember = role === 'member';
  const isGuest = role === 'guest';

  return {
    canView: true,
    canAddItems: true,
    canDeleteItems: isOwner || isMember,
    canEditSettings: isOwner,
    canInviteMembers: isOwner,
    canInviteGuests: isOwner || isMember,
    canRemoveMembers: isOwner,
    canDeleteSpace: isOwner,
    // Can leave if: guest, member, or owner with other owners
    canLeave: isGuest || isMember || (isOwner && (ownerCount || 0) > 1),
  };
}

// ============================================
// DISPLAY HELPERS
// ============================================

/**
 * Get human-readable role name
 */
export function getRoleDisplayName(role: SpaceRole): string {
  switch (role) {
    case 'owner': return 'Owner';
    case 'member': return 'Member';
    case 'guest': return 'Guest';
    default: return 'Unknown';
  }
}

/**
 * Get role description for UI
 */
export function getRoleDescription(role: SpaceRole): string {
  switch (role) {
    case 'owner': return 'Full admin rights - can edit settings and manage members';
    case 'member': return 'Can add, use, and delete items. Can invite guests.';
    case 'guest': return 'Can add and use items only';
    default: return '';
  }
}

/**
 * Get human-readable status name
 */
export function getStatusDisplayName(status: SpaceMemberStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'accepted': return 'Active';
    case 'declined': return 'Declined';
    default: return 'Unknown';
  }
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: SpaceRole): { bg: string; text: string } {
  switch (role) {
    case 'owner':
      return { bg: '#FEF3C7', text: '#92400E' }; // Amber
    case 'member':
      return { bg: '#DBEAFE', text: '#1E40AF' }; // Blue
    case 'guest':
      return { bg: '#E5E7EB', text: '#374151' }; // Gray
    default:
      return { bg: '#E5E7EB', text: '#374151' };
  }
}

/**
 * Get status badge color
 */
export function getStatusBadgeColor(status: SpaceMemberStatus): { bg: string; text: string } {
  switch (status) {
    case 'pending':
      return { bg: '#FEF3C7', text: '#92400E' }; // Amber
    case 'accepted':
      return { bg: '#D1FAE5', text: '#065F46' }; // Green
    case 'declined':
      return { bg: '#FEE2E2', text: '#991B1B' }; // Red
    default:
      return { bg: '#E5E7EB', text: '#374151' };
  }
}