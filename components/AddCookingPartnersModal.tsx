// components/AddCookingPartnersModal.tsx
// Modal for tagging sous chefs and people you ate with
// Created: November 19, 2025
// Updated: November 20, 2025 - Uses proper foreign key joins

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
import { ParticipantRole } from '../lib/services/postParticipantsService';

interface FollowedUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

interface AddCookingPartnersModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedUsers: string[], role: ParticipantRole) => void;
  currentUserId: string;
  defaultRole?: ParticipantRole;
}

export default function AddCookingPartnersModal({
  visible,
  onClose,
  onConfirm,
  currentUserId,
  defaultRole = 'ate_with',
}: AddCookingPartnersModalProps) {
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState<ParticipantRole>(defaultRole);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadFollowedUsers();
    } else {
      // Reset state when modal closes
      setSelectedUserIds(new Set());
      setSearchQuery('');
      setSelectedRole(defaultRole);
    }
  }, [visible]);

  const loadFollowedUsers = async () => {
    setLoading(true);
    try {
      // Now that we have foreign keys, we can use the clean join syntax!
      const { data, error } = await supabase
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

      if (error) {
        console.error('Error loading followed users:', error);
        throw error;
      }

      const users: FollowedUser[] = data
        ?.map((f: any) => f.user_profiles)
        .filter(Boolean) || [];

      setFollowedUsers(users);
    } catch (error) {
      console.error('Error loading followed users:', error);
      Alert.alert('Error', 'Failed to load your connections');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleConfirm = () => {
    if (selectedUserIds.size === 0) {
      Alert.alert('No Selection', 'Please select at least one person');
      return;
    }
    onConfirm(Array.from(selectedUserIds), selectedRole);
    onClose();
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
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Add Cooking Partners</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Role Selector */}
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                selectedRole === 'sous_chef' && styles.roleButtonActive,
              ]}
              onPress={() => setSelectedRole('sous_chef')}
            >
              <Text style={[
                styles.roleButtonText,
                selectedRole === 'sous_chef' && styles.roleButtonTextActive,
              ]}>
                🧑‍🍳 Cooked With
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleButton,
                selectedRole === 'ate_with' && styles.roleButtonActive,
              ]}
              onPress={() => setSelectedRole('ate_with')}
            >
              <Text style={[
                styles.roleButtonText,
                selectedRole === 'ate_with' && styles.roleButtonTextActive,
              ]}>
                🍽️ Ate With
              </Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            {selectedRole === 'sous_chef' 
              ? 'Select people who helped cook this dish'
              : 'Select people who ate this meal with you'
            }
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
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userItem}
                  onPress={() => toggleUserSelection(item.id)}
                >
                  <View style={styles.userInfo}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarEmoji}>
                        {getAvatarEmoji(item.id)}
                      </Text>
                    </View>
                    <View style={styles.userText}>
                      <Text style={styles.displayName}>
                        {item.display_name || item.username}
                      </Text>
                      {item.display_name && (
                        <Text style={styles.username}>@{item.username}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[
                    styles.checkbox,
                    selectedUserIds.has(item.id) && styles.checkboxSelected,
                  ]}>
                    {selectedUserIds.has(item.id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchQuery 
                      ? 'No connections found'
                      : 'Follow some people to tag them in your cooking sessions!'
                    }
                  </Text>
                </View>
              }
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
  },
  doneButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: colors.primary,
  },
  roleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  roleButtonTextActive: {
    color: 'white',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingBottom: 15,
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
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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