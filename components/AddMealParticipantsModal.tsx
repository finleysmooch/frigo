// components/meals/AddMealParticipantsModal.tsx
// Modal for inviting participants to a meal
// Created: December 2, 2025

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { inviteParticipants, getMealParticipants } from '../lib/services/mealService';

interface FollowedUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

interface AddMealParticipantsModalProps {
  visible: boolean;
  onClose: () => void;
  mealId: string;
  mealTitle: string;
  currentUserId: string;
  onInvitesSent?: () => void;
}

export default function AddMealParticipantsModal({
  visible,
  onClose,
  mealId,
  mealTitle,
  currentUserId,
  onInvitesSent,
}: AddMealParticipantsModalProps) {
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [existingParticipantIds, setExistingParticipantIds] = useState<Set<string>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
      setSelectedUserIds(new Set());
      setSearchQuery('');
    }
  }, [visible]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load followed users
      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select(`
          following_id,
          user_profiles!follows_following_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('follower_id', currentUserId);

      if (followsError) throw followsError;

      const users: FollowedUser[] = followsData
        ?.map((f: any) => f.user_profiles)
        .filter(Boolean) || [];

      setFollowedUsers(users);

      // Load existing participants
      const participants = await getMealParticipants(mealId);
      setExistingParticipantIds(new Set(participants.map(p => p.user_id)));
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load your connections');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    // Can't select existing participants
    if (existingParticipantIds.has(userId)) return;

    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleInvite = async () => {
    if (selectedUserIds.size === 0) {
      Alert.alert('No Selection', 'Please select at least one person');
      return;
    }

    setSaving(true);
    try {
      const result = await inviteParticipants(
        mealId,
        currentUserId,
        Array.from(selectedUserIds)
      );

      if (result.success) {
        Alert.alert(
          'Invitations Sent',
          `Invited ${result.invitedCount} ${result.invitedCount === 1 ? 'person' : 'people'} to ${mealTitle}`,
          [{ text: 'OK', onPress: () => {
            onInvitesSent?.();
            onClose();
          }}]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to send invitations');
      }
    } catch (error) {
      console.error('Error inviting participants:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = followedUsers.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(query) ||
      user.display_name?.toLowerCase().includes(query)
    );
  });

  const getAvatarEmoji = (userId: string): string => {
    const emojis = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🍕', '🌮', '🍔', '🍜', '🥘'];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return emojis[hash % emojis.length];
  };

  const renderUserItem = ({ item }: { item: FollowedUser }) => {
    const isExisting = existingParticipantIds.has(item.id);
    const isSelected = selectedUserIds.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          isExisting && styles.userItemDisabled,
        ]}
        onPress={() => toggleUserSelection(item.id)}
        disabled={isExisting}
      >
        <View style={styles.userInfo}>
          <View style={[styles.avatar, isExisting && styles.avatarDisabled]}>
            <Text style={styles.avatarEmoji}>
              {item.avatar_url || getAvatarEmoji(item.id)}
            </Text>
          </View>
          <View style={styles.userText}>
            <Text style={[styles.displayName, isExisting && styles.textDisabled]}>
              {item.display_name || item.username}
            </Text>
            {item.display_name && (
              <Text style={[styles.username, isExisting && styles.textDisabled]}>
                @{item.username}
              </Text>
            )}
            {isExisting && (
              <Text style={styles.alreadyInvited}>Already invited</Text>
            )}
          </View>
        </View>

        <View style={[
          styles.checkbox,
          isSelected && styles.checkboxSelected,
          isExisting && styles.checkboxDisabled,
        ]}>
          {isSelected && !isExisting && (
            <Text style={styles.checkmark}>✓</Text>
          )}
          {isExisting && (
            <Text style={styles.checkmarkDisabled}>✓</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={[styles.cancelButton, saving && styles.disabled]}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Invite to Meal</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{mealTitle}</Text>
            </View>
            <TouchableOpacity 
              onPress={handleInvite} 
              disabled={saving || selectedUserIds.size === 0}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[
                  styles.inviteButton,
                  selectedUserIds.size === 0 && styles.disabled
                ]}>
                  Invite ({selectedUserIds.size})
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Invited friends can add their own dishes to this meal
          </Text>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search your connections..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>

          {/* User List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              renderItem={renderUserItem}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>👥</Text>
                  <Text style={styles.emptyText}>
                    {searchQuery
                      ? 'No connections found'
                      : 'Follow some people to invite them!'
                    }
                  </Text>
                </View>
              }
              contentContainerStyle={styles.listContent}
            />
          )}

          {/* Selected Count */}
          {selectedUserIds.size > 0 && (
            <View style={styles.selectedCountContainer}>
              <Text style={styles.selectedCountText}>
                {selectedUserIds.size} person{selectedUserIds.size !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
  },
  inviteButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingVertical: 15,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 15,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  userItemDisabled: {
    opacity: 0.6,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#FFE5D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarDisabled: {
    backgroundColor: '#E5E7EB',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  userText: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  username: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  textDisabled: {
    color: '#9CA3AF',
  },
  alreadyInvited: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxDisabled: {
    backgroundColor: '#E5E7EB',
    borderColor: '#E5E7EB',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkmarkDisabled: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  selectedCountContainer: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  selectedCountText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
});