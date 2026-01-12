// ============================================
// FRIGO - INVITE MEMBER MODAL
// ============================================
// Modal for inviting users to a space
// Location: components/InviteMemberModal.tsx
// Created: December 18, 2025
//
// Note: Uses mutual follows search for privacy
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import {
  SpaceRole,
  getRoleDisplayName,
  getRoleDescription
} from '../lib/types/space';
import {
  searchUsersToInvite,
  inviteMember
} from '../lib/services/spaceService';
import { supabase } from '../lib/supabase';

// ============================================
// PROPS
// ============================================

interface InviteMemberModalProps {
  visible: boolean;
  spaceId: string;
  spaceName: string;
  canInviteMembers: boolean;  // Only owners can invite members
  onClose: () => void;
  onInvited?: () => void;
}

interface SearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

// ============================================
// COMPONENT
// ============================================

export default function InviteMemberModal({
  visible,
  spaceId,
  spaceName,
  canInviteMembers,
  onClose,
  onInvited,
}: InviteMemberModalProps) {
  const { colors, functionalColors } = useTheme();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<SpaceRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modal: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '85%',
      minHeight: 400,
      ...shadows.large,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
      flex: 1,
    },
    closeButton: {
      fontSize: typography.sizes.xl,
      color: colors.text.tertiary,
      padding: spacing.xs,
    },
    content: {
      flex: 1,
      padding: spacing.lg,
    },
    successContainer: {
      backgroundColor: '#D1FAE5',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
    },
    successText: {
      color: '#065F46',
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    errorContainer: {
      backgroundColor: '#FEE2E2',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
    },
    errorText: {
      color: functionalColors.error,
      fontSize: typography.sizes.sm,
    },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.text.tertiary,
      marginBottom: spacing.sm,
      letterSpacing: 0.5,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    searchInput: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    searchSpinner: {
      marginRight: spacing.md,
    },
    searchResults: {
      marginTop: spacing.md,
      maxHeight: 200,
    },
    searchResult: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.background.card,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
    },
    userInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    displayName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium,
      color: colors.text.primary,
    },
    username: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
    },
    noResults: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    noResultsText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
    helpText: {
      marginTop: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
    },
    helpTextTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    helpTextContent: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    selectedSection: {
      flex: 1,
    },
    selectedUser: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      padding: spacing.md,
      borderRadius: borderRadius.md,
    },
    removeButton: {
      padding: spacing.sm,
    },
    removeButtonText: {
      fontSize: typography.sizes.md,
      color: colors.text.tertiary,
    },
    roleOptions: {
      gap: spacing.sm,
    },
    roleOption: {
      padding: spacing.md,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    roleOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    roleOptionDisabled: {
      opacity: 0.5,
    },
    roleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.text.tertiary,
      marginRight: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioButtonSelected: {
      borderColor: colors.primary,
    },
    radioButtonInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    roleName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text.primary,
    },
    roleNameDisabled: {
      color: colors.text.tertiary,
    },
    roleDescription: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      marginLeft: 28,
    },
    roleDescriptionDisabled: {
      color: colors.text.tertiary,
    },
    footer: {
      flexDirection: 'row',
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      gap: spacing.md,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text.secondary,
    },
    inviteButton: {
      flex: 2,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteButtonDisabled: {
      backgroundColor: colors.text.tertiary,
    },
    inviteButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.background.card,
    },
  }), [colors, functionalColors]);

  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  // ============================================
  // SEARCH (with debounce)
  // ============================================

  useEffect(() => {
    if (!currentUserId) return;

    const searchTimeout = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          // Uses mutual follows search - only shows people you both follow
          const results = await searchUsersToInvite(
            searchQuery, 
            spaceId, 
            currentUserId
          );
          setSearchResults(results);
        } catch (err) {
          console.error('Search error:', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, spaceId, currentUserId]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setSelectedRole('member');
    setError(null);
    setSuccess(null);
    onClose();
  };

  const handleSelectUser = (user: SearchResult) => {
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
    // Default to guest if user can't invite members
    if (!canInviteMembers) {
      setSelectedRole('guest');
    }
  };

  const handleInvite = async () => {
    if (!selectedUser || !currentUserId) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await inviteMember(
        spaceId,
        currentUserId,
        selectedUser.id,
        selectedRole
      );

      if (!result.success) {
        setError(result.error || 'Failed to send invitation');
        return;
      }

      setSuccess(`Invitation sent to ${selectedUser.display_name || selectedUser.username}!`);
      setSelectedUser(null);
      onInvited?.();

      // Close after showing success briefly
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      console.error('Invite error:', err);
      setError('Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.searchResult}
      onPress={() => handleSelectUser(item)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.display_name || item.username).charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>
          {item.display_name || item.username}
        </Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderRoleOption = (role: SpaceRole) => {
    const isDisabled = (role === 'member' || role === 'owner') && !canInviteMembers;
    const isSelected = selectedRole === role;

    return (
      <TouchableOpacity
        key={role}
        style={[
          styles.roleOption,
          isSelected && styles.roleOptionSelected,
          isDisabled && styles.roleOptionDisabled,
        ]}
        onPress={() => !isDisabled && setSelectedRole(role)}
        disabled={isDisabled}
      >
        <View style={styles.roleHeader}>
          <View style={[
            styles.radioButton,
            isSelected && styles.radioButtonSelected,
          ]}>
            {isSelected && <View style={styles.radioButtonInner} />}
          </View>
          <Text style={[
            styles.roleName,
            isDisabled && styles.roleNameDisabled,
          ]}>
            {getRoleDisplayName(role)}
          </Text>
        </View>
        <Text style={[
          styles.roleDescription,
          isDisabled && styles.roleDescriptionDisabled,
        ]}>
          {getRoleDescription(role)}
          {isDisabled && ' (Owner only)'}
        </Text>
      </TouchableOpacity>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Invite to {spaceName}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Success Message */}
            {success && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>✓ {success}</Text>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Selected User or Search */}
            {selectedUser ? (
              <View style={styles.selectedSection}>
                <Text style={styles.sectionLabel}>INVITING</Text>
                <View style={styles.selectedUser}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(selectedUser.display_name || selectedUser.username).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.displayName}>
                      {selectedUser.display_name || selectedUser.username}
                    </Text>
                    <Text style={styles.username}>@{selectedUser.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => setSelectedUser(null)}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Role Selection */}
                <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
                  SELECT ROLE
                </Text>
                <View style={styles.roleOptions}>
                  {renderRoleOption('guest')}
                  {renderRoleOption('member')}
                  {canInviteMembers && renderRoleOption('owner')}
                </View>
              </View>
            ) : (
              <>
                {/* Search Input */}
                <Text style={styles.sectionLabel}>SEARCH USERS</Text>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by username or name..."
                    placeholderTextColor={colors.text.tertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {isSearching && (
                    <ActivityIndicator 
                      size="small" 
                      color={colors.primary} 
                      style={styles.searchSpinner}
                    />
                  )}
                </View>

                {/* Help Text */}
                {searchQuery.length === 0 && (
                  <View style={styles.helpText}>
                    <Text style={styles.helpTextTitle}>💡 Who can I invite?</Text>
                    <Text style={styles.helpTextContent}>
                      You can invite people you mutually follow on Frigo. 
                      This helps keep your spaces private and secure.
                    </Text>
                  </View>
                )}

                {/* Search Results */}
                {searchQuery.length >= 2 && (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSearchResult}
                    style={styles.searchResults}
                    ListEmptyComponent={
                      !isSearching ? (
                        <View style={styles.noResults}>
                          <Text style={styles.noResultsText}>
                            {searchQuery.length >= 2 
                              ? 'No mutual follows found matching your search'
                              : 'Type at least 2 characters to search'
                            }
                          </Text>
                        </View>
                      ) : null
                    }
                  />
                )}
              </>
            )}
          </View>

          {/* Footer */}
          {selectedUser && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSelectedUser(null)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.inviteButton,
                  isSubmitting && styles.inviteButtonDisabled,
                ]}
                onPress={handleInvite}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.inviteButtonText}>
                    Send Invitation
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}