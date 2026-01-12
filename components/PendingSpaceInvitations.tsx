// ============================================
// FRIGO - PENDING SPACE INVITATIONS
// ============================================
// Component to display and respond to space invitations
// Location: components/PendingSpaceInvitations.tsx
// Created: December 18, 2025
// ============================================

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';
import { PendingSpaceInvitation, getRoleDisplayName } from '../lib/types/space';
import { usePendingInvitations } from '../contexts/SpaceContext';

// ============================================
// PROPS
// ============================================

interface PendingSpaceInvitationsProps {
  onInvitationResponded?: () => void;
  compact?: boolean;  // For showing in a smaller space
}

// ============================================
// COMPONENT
// ============================================

export default function PendingSpaceInvitations({
  onInvitationResponded,
  compact = false,
}: PendingSpaceInvitationsProps) {
  // Use context hook
  const { 
    invitations, 
    accept, 
    decline 
  } = usePendingInvitations();

  const [respondingTo, setRespondingTo] = React.useState<string | null>(null);

  // ============================================
  // HANDLERS
  // ============================================

  const handleRespond = async (invitation: PendingSpaceInvitation, shouldAccept: boolean) => {
    try {
      setRespondingTo(invitation.id);

      if (shouldAccept) {
        await accept(invitation.id);
      } else {
        await decline(invitation.id);
      }

      onInvitationResponded?.();
    } catch (error) {
      console.error('Error responding to invitation:', error);
    } finally {
      setRespondingTo(null);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (invitations.length === 0) {
    return null; // Don't show anything if no invitations
  }

  const renderInvitation = ({ item }: { item: PendingSpaceInvitation }) => {
    const isResponding = respondingTo === item.id;

    return (
      <View style={[styles.invitationCard, compact && styles.invitationCardCompact]}>
        <View style={styles.invitationHeader}>
          <Text style={styles.spaceEmoji}>{item.space_emoji}</Text>
          <View style={styles.invitationInfo}>
            <Text style={styles.spaceName}>{item.space_name}</Text>
            <Text style={styles.inviteDetails}>
              {item.inviter_name} invited you as {getRoleDisplayName(item.role).toLowerCase()}
            </Text>
          </View>
        </View>

        <View style={styles.invitationActions}>
          {isResponding ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => handleRespond(item, false)}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleRespond(item, true)}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  if (compact) {
    // Compact mode: show inline with quick actions
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactBadge}>
          <Text style={styles.compactBadgeText}>
            {invitations.length} pending invitation{invitations.length > 1 ? 's' : ''}
          </Text>
        </View>
        {invitations.map(item => (
          <View key={item.id} style={styles.compactInvitation}>
            <Text style={styles.compactText}>
              {item.space_emoji} {item.space_name}
            </Text>
            <View style={styles.compactActions}>
              <TouchableOpacity
                style={styles.compactDecline}
                onPress={() => handleRespond(item, false)}
                disabled={respondingTo === item.id}
              >
                <Text style={styles.compactDeclineText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.compactAccept}
                onPress={() => handleRespond(item, true)}
                disabled={respondingTo === item.id}
              >
                <Text style={styles.compactAcceptText}>✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>PENDING INVITATIONS</Text>
      <FlatList
        data={invitations}
        keyExtractor={(item) => item.id}
        renderItem={renderInvitation}
        scrollEnabled={false}
      />
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  invitationCard: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.small,
  },
  invitationCardCompact: {
    marginHorizontal: 0,
    padding: spacing.sm,
  },
  invitationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  spaceEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  invitationInfo: {
    flex: 1,
  },
  spaceName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  inviteDetails: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  invitationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  declineButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
  },
  declineButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  acceptButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  acceptButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },

  // Compact styles
  compactContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  compactBadge: {
    marginBottom: spacing.xs,
  },
  compactBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: '#92400E',
  },
  compactInvitation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  compactText: {
    fontSize: typography.sizes.sm,
    color: '#92400E',
    flex: 1,
  },
  compactActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  compactDecline: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FCA5A5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactDeclineText: {
    color: '#7F1D1D',
    fontWeight: typography.weights.bold,
  },
  compactAccept: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#86EFAC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactAcceptText: {
    color: '#14532D',
    fontWeight: typography.weights.bold,
  },
});