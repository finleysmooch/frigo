// components/meals/MealInvitationsCard.tsx
// Shows pending meal invitations for the current user
// Created: December 2, 2025

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../lib/theme';
import {
  getPendingMealInvitations,
  respondToInvitation,
} from '../lib/services/mealService';

interface MealInvitation {
  id: string;
  meal_id: string;
  meal_title: string;
  meal_time?: string;
  host_username: string;
  host_display_name?: string;
  invited_at: string;
}

interface MealInvitationsCardProps {
  currentUserId: string;
  onViewMeal?: (mealId: string) => void;
  onRefresh?: () => void;
}

export default function MealInvitationsCard({
  currentUserId,
  onViewMeal,
  onRefresh,
}: MealInvitationsCardProps) {
  const [invitations, setInvitations] = useState<MealInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, [currentUserId]);

  const loadInvitations = async () => {
    try {
      const data = await getPendingMealInvitations(currentUserId);
      setInvitations(data);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (
    mealId: string,
    response: 'accepted' | 'maybe' | 'declined'
  ) => {
    setResponding(mealId);
    try {
      const result = await respondToInvitation(mealId, currentUserId, response);
      
      if (result.success) {
        // Remove from list
        setInvitations(prev => prev.filter(inv => inv.meal_id !== mealId));
        
        if (response === 'accepted') {
          Alert.alert('Accepted!', 'You can now add dishes to this meal.');
        }
        
        onRefresh?.();
      } else {
        Alert.alert('Error', result.error || 'Failed to respond');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setResponding(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  if (loading) {
    return null; // Don't show loading state for this card
  }

  if (invitations.length === 0) {
    return null; // Don't render if no invitations
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🍽️</Text>
        <Text style={styles.headerTitle}>Meal Invitations</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{invitations.length}</Text>
        </View>
      </View>

      {invitations.map((invitation) => (
        <View key={invitation.id} style={styles.invitationCard}>
          <TouchableOpacity 
            style={styles.invitationContent}
            onPress={() => onViewMeal?.(invitation.meal_id)}
          >
            <Text style={styles.mealTitle} numberOfLines={1}>
              {invitation.meal_title}
            </Text>
            <Text style={styles.hostText}>
              from {invitation.host_display_name || invitation.host_username}
            </Text>
            {invitation.meal_time && (
              <Text style={styles.timeText}>
                📅 {formatDate(invitation.meal_time)}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.responseButtons}>
            {responding === invitation.meal_id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.responseButton, styles.declineButton]}
                  onPress={() => handleRespond(invitation.meal_id, 'declined')}
                >
                  <Text style={styles.declineText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.responseButton, styles.maybeButton]}
                  onPress={() => handleRespond(invitation.meal_id, 'maybe')}
                >
                  <Text style={styles.maybeText}>?</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.responseButton, styles.acceptButton]}
                  onPress={() => handleRespond(invitation.meal_id, 'accepted')}
                >
                  <Text style={styles.acceptText}>✓</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  invitationContent: {
    flex: 1,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  hostText: {
    fontSize: 13,
    color: '#6B7280',
  },
  timeText: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 4,
  },
  responseButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  responseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#FEE2E2',
  },
  maybeButton: {
    backgroundColor: '#FEF3C7',
  },
  acceptButton: {
    backgroundColor: '#D1FAE5',
  },
  declineText: {
    fontSize: 18,
    color: '#DC2626',
    fontWeight: '600',
  },
  maybeText: {
    fontSize: 18,
    color: '#D97706',
    fontWeight: '600',
  },
  acceptText: {
    fontSize: 18,
    color: '#059669',
    fontWeight: '600',
  },
});