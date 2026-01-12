// ============================================
// FRIGO - SPACE SWITCHER COMPONENT
// ============================================
// Dropdown component for switching between spaces
// Location: components/SpaceSwitcher.tsx
// Created: December 18, 2025
//
// Usage: Place below screen headers (like "My Pantry")
// Shows current space with tap to open dropdown
// ============================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSpaceSwitcher, usePendingInvitations } from '../contexts/SpaceContext';
import { getRoleDisplayName, getRoleBadgeColor } from '../lib/types/space';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';

interface SpaceSwitcherProps {
  onCreateSpace?: () => void;  // Callback to open create space modal
  onViewInvitations?: () => void;  // Callback to view invitations
  onManageSpaces?: () => void;  // Callback to open space settings
  compact?: boolean;           // Smaller version for tight spaces
}

export default function SpaceSwitcher({
  onCreateSpace,
  onViewInvitations,
  onManageSpaces,
  compact = false
}: SpaceSwitcherProps) {
  const { colors, functionalColors } = useTheme();

  const {
    currentSpace,
    spaces,
    isSwitching,
    switchTo,
  } = useSpaceSwitcher();

  const { invitations, count: invitationCount } = usePendingInvitations();

  const [isOpen, setIsOpen] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    containerCompact: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      marginHorizontal: spacing.md,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    loadingText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
    },
    currentSpace: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: spacing.sm,
    },
    emoji: {
      fontSize: 18,
    },
    emojiCompact: {
      fontSize: 16,
    },
    spaceName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium,
      color: colors.text.primary,
      flex: 1,
    },
    spaceNameCompact: {
      fontSize: typography.sizes.sm,
    },
    dropdownIcon: {
      fontSize: 10,
      color: colors.text.tertiary,
      marginLeft: spacing.xs,
    },
    switchingIndicator: {
      marginLeft: spacing.xs,
    },
    memberBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      marginLeft: spacing.sm,
    },
    memberBadgeText: {
      fontSize: typography.sizes.xs,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    invitationBadge: {
      backgroundColor: functionalColors.warning,
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: spacing.sm,
    },
    invitationBadgeText: {
      fontSize: typography.sizes.xs,
      color: colors.background.card,
      fontWeight: typography.weights.bold,
    },

    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    dropdown: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.xl,
      maxHeight: '70%',
      ...shadows.large,
    },
    dropdownHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    dropdownTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
    },
    headerBadge: {
      backgroundColor: '#FEF3C7',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
    },
    headerBadgeText: {
      fontSize: typography.sizes.xs,
      color: '#92400E',
      fontWeight: typography.weights.semibold,
    },
    spaceList: {
      maxHeight: 280,
    },
    spaceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    spaceItemActive: {
      backgroundColor: colors.primary + '10',
    },
    spaceItemEmoji: {
      fontSize: 24,
      marginRight: spacing.md,
    },
    spaceItemInfo: {
      flex: 1,
    },
    spaceItemNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 2,
    },
    spaceItemName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium,
      color: colors.text.primary,
    },
    spaceItemNameActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
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
    spaceItemMeta: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
    },
    checkmark: {
      fontSize: typography.sizes.lg,
      color: colors.primary,
      fontWeight: typography.weights.bold,
    },
    emptyState: {
      padding: spacing.xxl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
    },

    // Invitations preview
    invitationsPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: '#FEF3C7',
      gap: spacing.sm,
    },
    invitationsPreviewIcon: {
      fontSize: typography.sizes.lg,
    },
    invitationsPreviewText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: '#92400E',
      fontWeight: typography.weights.medium,
    },
    invitationsPreviewArrow: {
      fontSize: typography.sizes.xl,
      color: '#92400E',
    },

    // Create button
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      gap: spacing.sm,
    },
    createButtonIcon: {
      fontSize: typography.sizes.xl,
      color: colors.primary,
      fontWeight: typography.weights.bold,
    },
    createButtonText: {
      fontSize: typography.sizes.md,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },

    // Manage button
    manageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      gap: spacing.sm,
    },
    manageButtonIcon: {
      fontSize: typography.sizes.md,
    },
    manageButtonText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },

    // Cancel button
    cancelButton: {
      paddingVertical: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
  }), [colors, functionalColors]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSelectSpace = async (spaceId: string) => {
    setIsOpen(false);
    if (spaceId !== currentSpace?.id) {
      await switchTo(spaceId);
    }
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    onCreateSpace?.();
  };

  const handleViewInvitations = () => {
    setIsOpen(false);
    onViewInvitations?.();
  };

  // ============================================
  // RENDER
  // ============================================

  // Loading state
  if (!currentSpace) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.text.tertiary} />
          <Text style={styles.loadingText}>Loading spaces...</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      {/* Current Space Button */}
      <TouchableOpacity
        style={[styles.container, compact && styles.containerCompact]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <View style={styles.currentSpace}>
          <Text style={[styles.emoji, compact && styles.emojiCompact]}>
            {currentSpace.emoji}
          </Text>
          <Text style={[styles.spaceName, compact && styles.spaceNameCompact]} numberOfLines={1}>
            {currentSpace.name}
          </Text>
          {isSwitching ? (
            <ActivityIndicator size="small" color={colors.text.tertiary} style={styles.switchingIndicator} />
          ) : (
            <Text style={styles.dropdownIcon}>▼</Text>
          )}
        </View>
        
        {/* Member count badge */}
        {currentSpace.member_count > 1 && (
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>
              {currentSpace.member_count} 👤
            </Text>
          </View>
        )}
        
        {/* Pending invitations badge */}
        {invitationCount > 0 && (
          <View style={styles.invitationBadge}>
            <Text style={styles.invitationBadgeText}>
              {invitationCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.dropdown}>
            {/* Header */}
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Switch Space</Text>
              {invitationCount > 0 && (
                <TouchableOpacity 
                  style={styles.headerBadge}
                  onPress={handleViewInvitations}
                >
                  <Text style={styles.headerBadgeText}>
                    {invitationCount} invite{invitationCount > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Space List */}
            <FlatList
              data={spaces}
              keyExtractor={(item) => item.id}
              style={styles.spaceList}
              renderItem={({ item }) => {
                const roleColors = getRoleBadgeColor(item.role);
                return (
                  <TouchableOpacity
                    style={[
                      styles.spaceItem,
                      item.id === currentSpace.id && styles.spaceItemActive,
                    ]}
                    onPress={() => handleSelectSpace(item.id)}
                  >
                    <Text style={styles.spaceItemEmoji}>{item.emoji}</Text>
                    <View style={styles.spaceItemInfo}>
                      <View style={styles.spaceItemNameRow}>
                        <Text style={[
                          styles.spaceItemName,
                          item.id === currentSpace.id && styles.spaceItemNameActive,
                        ]}>
                          {item.name}
                        </Text>
                        {!item.is_default && (
                          <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                            <Text style={[styles.roleBadgeText, { color: roleColors.text }]}>
                              {getRoleDisplayName(item.role)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.spaceItemMeta}>
                        {item.item_count} item{item.item_count !== 1 ? 's' : ''}
                        {item.member_count > 1 && ` • ${item.member_count} members`}
                      </Text>
                    </View>
                    {item.id === currentSpace.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No spaces yet</Text>
                </View>
              }
            />

            {/* Pending Invitations Preview */}
            {invitationCount > 0 && (
              <TouchableOpacity 
                style={styles.invitationsPreview}
                onPress={handleViewInvitations}
              >
                <Text style={styles.invitationsPreviewIcon}>📨</Text>
                <Text style={styles.invitationsPreviewText}>
                  You have {invitationCount} pending invitation{invitationCount > 1 ? 's' : ''}
                </Text>
                <Text style={styles.invitationsPreviewArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* Create New Button */}
            {onCreateSpace && (
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateNew}
              >
                <Text style={styles.createButtonIcon}>+</Text>
                <Text style={styles.createButtonText}>Create New Space</Text>
              </TouchableOpacity>
            )}

            {/* Manage Space Button */}
            {onManageSpaces && currentSpace && (
              <TouchableOpacity
                style={styles.manageButton}
                onPress={() => {
                  setIsOpen(false);
                  onManageSpaces();
                }}
              >
                <Text style={styles.manageButtonIcon}>⚙️</Text>
                <Text style={styles.manageButtonText}>Manage {currentSpace.name}</Text>
              </TouchableOpacity>
            )}

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsOpen(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}