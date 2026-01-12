// ============================================
// FRIGO - SPACE SETTINGS SCREEN
// ============================================
// Screen for managing space details, members, and settings
// Location: screens/SpaceSettingsScreen.tsx
// Created: December 18, 2025
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import {
  SpaceWithDetails,
  SpaceMemberWithProfile,
  SpaceRole,
  getRoleDisplayName,
  getRoleBadgeColor,
  getSpacePermissions,
} from '../lib/types/space';
import {
  getSpaceWithDetails,
  updateSpace,
  deleteSpace,
  removeMember,
  leaveSpace,
  changeRole,
} from '../lib/services/spaceService';
import { useSpace } from '../contexts/SpaceContext';
import { supabase } from '../lib/supabase';
import InviteMemberModal from '../components/InviteMemberModal';

// ============================================
// TYPES
// ============================================

type Props = NativeStackScreenProps<any, 'SpaceSettings'>;

// ============================================
// COMPONENT
// ============================================

export default function SpaceSettingsScreen({ route, navigation }: Props) {
  const { spaceId } = route.params || {};
  const { colors, functionalColors } = useTheme();

  // State
  const [space, setSpace] = useState<SpaceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Context
  const { refreshSpaces, switchSpace, activeSpaceId } = useSpace();

  // ============================================
  // STYLES
  // ============================================

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      padding: spacing.xl,
    },
    errorText: {
      fontSize: typography.sizes.lg,
      color: colors.text.secondary,
      marginBottom: spacing.lg,
    },
    backButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    backButtonText: {
      color: colors.background.card,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.primary,
      paddingTop: 60,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    backArrow: {
      marginRight: spacing.md,
      padding: spacing.xs,
    },
    backArrowText: {
      fontSize: 28,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    headerEmoji: {
      fontSize: 24,
      marginRight: spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.text.tertiary,
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    inviteButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
    inviteButtonText: {
      color: colors.background.card,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
    card: {
      backgroundColor: colors.background.primary,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      ...shadows.small,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    settingRowLast: {
      borderBottomWidth: 0,
    },
    settingLabel: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    settingValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    settingValueText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
    settingEmoji: {
      fontSize: 24,
    },
    settingArrow: {
      fontSize: typography.sizes.lg,
      color: colors.text.tertiary,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberAvatarText: {
      color: colors.background.card,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
    },
    memberInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    memberName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium,
      color: colors.text.primary,
    },
    youBadge: {
      color: colors.text.tertiary,
      fontWeight: typography.weights.regular,
    },
    memberRoleRow: {
      flexDirection: 'row',
      marginTop: 2,
    },
    roleBadge: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 1,
      borderRadius: borderRadius.sm,
    },
    roleBadgeText: {
      fontSize: 10,
      fontWeight: typography.weights.semibold,
    },
    roleBadgeLarge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    roleBadgeLargeText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
    memberActions: {
      padding: spacing.sm,
    },
    memberActionsIcon: {
      fontSize: typography.sizes.xl,
      color: colors.text.tertiary,
    },
    permissionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    permissionLabel: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    permissionList: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    permissionItem: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      paddingVertical: spacing.xs,
    },
    dangerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      gap: spacing.md,
    },
    dangerRowLast: {
      borderBottomWidth: 0,
    },
    dangerIcon: {
      fontSize: typography.sizes.lg,
    },
    dangerText: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    dangerTextRed: {
      color: functionalColors.error,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    infoIcon: {
      fontSize: typography.sizes.md,
    },
    infoText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      lineHeight: 20,
    },
  }), [colors, functionalColors]);

  // ============================================
  // LOAD DATA
  // ============================================

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (spaceId && currentUserId) {
      loadSpace();
    }
  }, [spaceId, currentUserId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadSpace = async () => {
    if (!spaceId || !currentUserId) return;

    try {
      setLoading(true);
      const data = await getSpaceWithDetails(spaceId, currentUserId);
      setSpace(data);
    } catch (error) {
      console.error('Error loading space:', error);
      Alert.alert('Error', 'Failed to load space details');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSpace();
    setRefreshing(false);
  }, [spaceId, currentUserId]);

  // ============================================
  // COMPUTED
  // ============================================

  const userMembership = space?.members.find(m => m.user_id === currentUserId);
  const userRole = userMembership?.role || null;
  const permissions = getSpacePermissions(userRole, space?.owner_count);
  const isOwner = userRole === 'owner';

  // ============================================
  // HANDLERS
  // ============================================

  const handleEditName = () => {
    if (!permissions.canEditSettings) return;

    Alert.prompt(
      'Edit Space Name',
      'Enter a new name for this space',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newName: string | undefined) => {
            if (!newName?.trim() || !currentUserId) return;

            const result = await updateSpace(spaceId, currentUserId, {
              name: newName.trim()
            });

            if (result.success) {
              await loadSpace();
              await refreshSpaces();
            } else {
              Alert.alert('Error', result.error || 'Failed to update name');
            }
          },
        },
      ],
      'plain-text',
      space?.name
    );
  };

  const handleEditEmoji = () => {
    if (!permissions.canEditSettings) return;

    // Simple emoji options
    const emojis = ['🏠', '🏡', '🏔️', '🏖️', '🏕️', '👨‍👩‍👧‍👦', '❤️', '⭐'];

    Alert.alert(
      'Choose Icon',
      'Select an icon for this space',
      [
        ...emojis.map(emoji => ({
          text: emoji,
          onPress: async () => {
            if (!currentUserId) return;
            const result = await updateSpace(spaceId, currentUserId, { emoji });
            if (result.success) {
              await loadSpace();
              await refreshSpaces();
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleChangeMemberRole = (member: SpaceMemberWithProfile) => {
    if (!permissions.canEditSettings || member.user_id === currentUserId) return;

    const roleOptions: SpaceRole[] = ['guest', 'member', 'owner'];

    Alert.alert(
      'Change Role',
      `Select a new role for ${member.user_profile.display_name || member.user_profile.username}`,
      [
        ...roleOptions.map(role => ({
          text: getRoleDisplayName(role) + (member.role === role ? ' ✓' : ''),
          onPress: async () => {
            if (role === member.role || !currentUserId) return;

            const result = await changeRole(spaceId, currentUserId, member.user_id, role);
            if (result.success) {
              await loadSpace();
            } else {
              Alert.alert('Error', result.error || 'Failed to change role');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRemoveMember = (member: SpaceMemberWithProfile) => {
    if (!permissions.canRemoveMembers) return;

    const memberName = member.user_profile.display_name || member.user_profile.username;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from this space?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;
            const result = await removeMember(spaceId, currentUserId, member.user_id);
            if (result.success) {
              await loadSpace();
            } else {
              Alert.alert('Error', result.error || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleLeaveSpace = () => {
    if (!permissions.canLeave) {
      Alert.alert(
        'Cannot Leave',
        'You are the only owner. Transfer ownership to someone else or delete the space.'
      );
      return;
    }

    Alert.alert(
      'Leave Space',
      `Are you sure you want to leave "${space?.name}"? You will lose access to the shared pantry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;
            const result = await leaveSpace(spaceId, currentUserId);
            if (result.success) {
              await refreshSpaces();
              navigation.goBack();
            } else {
              Alert.alert('Error', result.error || 'Failed to leave space');
            }
          },
        },
      ]
    );
  };

  const handleDeleteSpace = () => {
    if (!permissions.canDeleteSpace) return;

    if (space?.is_default) {
      Alert.alert('Cannot Delete', 'You cannot delete your Home space.');
      return;
    }

    Alert.alert(
      'Delete Space',
      `Are you sure you want to delete "${space?.name}"?\n\nThis will delete all pantry items in this space. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;

            // If this is the active space, we need to switch first
            const wasActiveSpace = activeSpaceId === spaceId;

            const result = await deleteSpace(spaceId, currentUserId);
            if (result.success) {
              await refreshSpaces();
              navigation.goBack();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete space');
            }
          },
        },
      ]
    );
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderMember = (member: SpaceMemberWithProfile) => {
    const isCurrentUser = member.user_id === currentUserId;
    const displayName = member.user_profile.display_name || member.user_profile.username;
    const roleColors = getRoleBadgeColor(member.role);

    return (
      <View key={member.id} style={styles.memberRow}>
        {/* Avatar */}
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {displayName}
            {isCurrentUser && <Text style={styles.youBadge}> (you)</Text>}
          </Text>
          <View style={styles.memberRoleRow}>
            <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleColors.text }]}>
                {getRoleDisplayName(member.role)}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions (for owners, not on self) */}
        {permissions.canRemoveMembers && !isCurrentUser && (
          <TouchableOpacity
            style={styles.memberActions}
            onPress={() => {
              Alert.alert(
                displayName,
                'What would you like to do?',
                [
                  { text: 'Change Role', onPress: () => handleChangeMemberRole(member) },
                  { text: 'Remove', style: 'destructive', onPress: () => handleRemoveMember(member) },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
          >
            <Text style={styles.memberActionsIcon}>⋮</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!space) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Space not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backArrow}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerEmoji}>{space.emoji}</Text>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {space.name}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Space Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPACE DETAILS</Text>
          <View style={styles.card}>
            {/* Name */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={handleEditName}
              disabled={!permissions.canEditSettings}
            >
              <Text style={styles.settingLabel}>Name</Text>
              <View style={styles.settingValue}>
                <Text style={styles.settingValueText}>{space.name}</Text>
                {permissions.canEditSettings && (
                  <Text style={styles.settingArrow}>›</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Icon */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={handleEditEmoji}
              disabled={!permissions.canEditSettings}
            >
              <Text style={styles.settingLabel}>Icon</Text>
              <View style={styles.settingValue}>
                <Text style={styles.settingEmoji}>{space.emoji}</Text>
                {permissions.canEditSettings && (
                  <Text style={styles.settingArrow}>›</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Stats */}
            <View style={[styles.settingRow, styles.settingRowLast]}>
              <Text style={styles.settingLabel}>Pantry Items</Text>
              <Text style={styles.settingValueText}>{space.item_count}</Text>
            </View>
          </View>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              MEMBERS ({space.members.length})
            </Text>
            {permissions.canInviteGuests && (
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={() => setShowInviteModal(true)}
              >
                <Text style={styles.inviteButtonText}>+ Invite</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            {space.members
              .sort((a, b) => {
                // Owners first, then members, then guests
                const roleOrder = { owner: 0, member: 1, guest: 2 };
                return roleOrder[a.role] - roleOrder[b.role];
              })
              .map(renderMember)}
          </View>
        </View>

        {/* Your Role */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOUR PERMISSIONS</Text>
          <View style={styles.card}>
            <View style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>Your role</Text>
              <View style={[styles.roleBadgeLarge, { backgroundColor: getRoleBadgeColor(userRole || 'guest').bg }]}>
                <Text style={[styles.roleBadgeLargeText, { color: getRoleBadgeColor(userRole || 'guest').text }]}>
                  {getRoleDisplayName(userRole || 'guest')}
                </Text>
              </View>
            </View>
            <View style={styles.permissionList}>
              <Text style={styles.permissionItem}>
                {permissions.canAddItems ? '✓' : '✗'} Add items
              </Text>
              <Text style={styles.permissionItem}>
                {permissions.canDeleteItems ? '✓' : '✗'} Delete items
              </Text>
              <Text style={styles.permissionItem}>
                {permissions.canInviteGuests ? '✓' : '✗'} Invite guests
              </Text>
              <Text style={styles.permissionItem}>
                {permissions.canInviteMembers ? '✓' : '✗'} Invite members
              </Text>
              <Text style={styles.permissionItem}>
                {permissions.canEditSettings ? '✓' : '✗'} Edit settings
              </Text>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          <View style={styles.card}>
            {!space.is_default && (
              <TouchableOpacity
                style={styles.dangerRow}
                onPress={handleLeaveSpace}
              >
                <Text style={styles.dangerIcon}>🚪</Text>
                <Text style={styles.dangerText}>Leave Space</Text>
              </TouchableOpacity>
            )}

            {permissions.canDeleteSpace && !space.is_default && (
              <TouchableOpacity
                style={[styles.dangerRow, styles.dangerRowLast]}
                onPress={handleDeleteSpace}
              >
                <Text style={styles.dangerIcon}>🗑️</Text>
                <Text style={[styles.dangerText, styles.dangerTextRed]}>
                  Delete Space
                </Text>
              </TouchableOpacity>
            )}

            {space.is_default && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>ℹ️</Text>
                <Text style={styles.infoText}>
                  This is your default Home space. It cannot be deleted or left.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Invite Modal */}
      <InviteMemberModal
        visible={showInviteModal}
        spaceId={spaceId}
        spaceName={space.name}
        canInviteMembers={permissions.canInviteMembers}
        onClose={() => setShowInviteModal(false)}
        onInvited={loadSpace}
      />
    </View>
  );
}
