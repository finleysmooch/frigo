// screens/UserSearchScreen.tsx
// Search for users and follow/unfollow them
// Created: November 19, 2025

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

type Props = NativeStackScreenProps<any, 'UserSearch'>;

interface User {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  followers_count: number;
  following_count: number;
}

interface UserWithFollowStatus extends User {
  isFollowing: boolean;
  followsYou: boolean;
}

const AVATAR_EMOJIS = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🍕', '🌮', '🍔', '🍜', '🥘', '🍱', '🥗', '🍝', '🥙'];

const getAvatarForUser = (userId: string): string => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
};

export default function UserSearchScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserWithFollowStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      if (searchQuery.length > 0) {
        searchUsers();
      } else {
        loadSuggestedUsers();
      }
    }
  }, [searchQuery, currentUserId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery || !currentUserId) return;

    setLoading(true);
    try {
      // Search by username or display name
      const { data: userData, error } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, bio, followers_count, following_count')
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .neq('id', currentUserId) // Don't show current user
        .limit(20);

      if (error) throw error;

      // Get follow status for each user
      await loadFollowStatus(userData || []);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedUsers = async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      // Get recent users (excluding current user and already following)
      const { data: userData, error } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, bio, followers_count, following_count')
        .neq('id', currentUserId)
        .limit(20);

      if (error) throw error;

      await loadFollowStatus(userData || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowStatus = async (userData: User[]) => {
    try {
      // Get all follows where current user is follower
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      // Get all follows where current user is being followed
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', currentUserId);

      const followingIds = new Set(following?.map(f => f.following_id) || []);
      const followerIds = new Set(followers?.map(f => f.follower_id) || []);

      const usersWithStatus: UserWithFollowStatus[] = userData.map(user => ({
        ...user,
        isFollowing: followingIds.has(user.id),
        followsYou: followerIds.has(user.id),
      }));

      setUsers(usersWithStatus);
    } catch (error) {
      console.error('Error loading follow status:', error);
    }
  };

  const toggleFollow = async (userId: string, currentlyFollowing: boolean) => {
    try {
      if (currentlyFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId);

        if (error) throw error;

        // Update local state
        setUsers(users.map(u => 
          u.id === userId ? { 
            ...u, 
            isFollowing: false,
            followers_count: Math.max(0, u.followers_count - 1)
          } : u
        ));

        // Update follower count (optional, will fail gracefully if RPC doesn't exist)
        updateFollowCounts(userId, currentUserId, 'unfollow').catch(console.error);
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: userId,
          });

        if (error) {
          // Check if it's an RLS error
          if (error.code === '42501') {
            Alert.alert(
              'Database Setup Required',
              'The follow feature needs to be configured in Supabase. Please run the provided SQL script to fix this.',
              [{ text: 'OK' }]
            );
            return;
          }
          throw error;
        }

        // Update local state
        setUsers(users.map(u => 
          u.id === userId ? { 
            ...u, 
            isFollowing: true,
            followers_count: u.followers_count + 1
          } : u
        ));

        // Update follower count (optional, will fail gracefully if RPC doesn't exist)
        updateFollowCounts(userId, currentUserId, 'follow').catch(console.error);
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      const message = error?.message || 'Failed to update follow status';
      Alert.alert('Error', message);
    }
  };

  const updateFollowCounts = async (
    followedUserId: string,
    followerUserId: string,
    action: 'follow' | 'unfollow'
  ) => {
    const increment = action === 'follow' ? 1 : -1;

    // Update followed user's follower count
    await supabase.rpc('increment_followers_count', {
      user_id: followedUserId,
      increment_by: increment,
    });

    // Update follower user's following count
    await supabase.rpc('increment_following_count', {
      user_id: followerUserId,
      increment_by: increment,
    });
  };

  const renderUser = ({ item }: { item: UserWithFollowStatus }) => {
    return (
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{getAvatarForUser(item.id)}</Text>
          </View>
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={styles.displayName}>
                {item.display_name || item.username}
              </Text>
              {item.followsYou && (
                <View style={styles.followsYouBadge}>
                  <Text style={styles.followsYouText}>Follows You</Text>
                </View>
              )}
            </View>
            <Text style={styles.username}>@{item.username}</Text>
            {item.bio && (
              <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>
            )}
            <View style={styles.stats}>
              <Text style={styles.statText}>
                {item.followers_count} follower{item.followers_count !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.statDivider}>•</Text>
              <Text style={styles.statText}>
                {item.following_count} following
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.followButton,
            item.isFollowing && styles.followingButton,
          ]}
          onPress={() => toggleFollow(item.id, item.isFollowing)}
        >
          <Text style={[
            styles.followButtonText,
            item.isFollowing && styles.followingButtonText,
          ]}>
            {item.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find People</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          placeholderTextColor="#9CA3AF"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No users found' : 'No suggestions yet'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery 
              ? 'Try a different search term'
              : 'Start searching to find people to follow'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    fontSize: 28,
    color: colors.primary,
    width: 30,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  clearButton: {
    fontSize: 20,
    color: '#9CA3AF',
    paddingHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFE5D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 26,
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginRight: 8,
  },
  followsYouBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  followsYouText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
  },
  username: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  bio: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    color: '#6B7280',
  },
  statDivider: {
    fontSize: 13,
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
  followButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  followingButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  followingButtonText: {
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});