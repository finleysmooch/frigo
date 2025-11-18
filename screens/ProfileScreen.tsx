import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = width / 4;

interface ProfileScreenProps {
  navigation: any;
}

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  following_count: number;
  followers_count: number;
}

interface Post {
  id: string;
  created_at: string;
  recipes: {
    title: string;
  } | null;
}

// Use the same avatar system from MyPostsScreen
const getAvatarForUser = (userId: string): string => {
  const emojis = ['👨‍🍳', '👩‍🍳', '🧑‍🍳', '🍳', '🥘', '🍲'];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return emojis[hash % emojis.length];
};

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [thisWeekCount, setThisWeekCount] = useState(0);
  const [avatar, setAvatar] = useState('👨‍🍳'); // Default avatar

  // Reload profile when screen comes into focus (after editing)
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Set avatar (use stored or default from hash)
      if (profileData.avatar_url) {
        setAvatar(profileData.avatar_url);
      } else {
        setAvatar(getAvatarForUser(user.id));
      }

      // Load user's posts for photo grid
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          created_at,
          recipes (
            title
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);

      if (postsError) throw postsError;
      setPosts((postsData || []) as unknown as Post[]);

      // Calculate this week's cooking count
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: weekPosts, error: weekError } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', oneWeekAgo.toISOString());

      if (!weekError && weekPosts) {
        setThisWeekCount(weekPosts.length);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FC4C02" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Profile not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Header with Settings */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Home</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Photo Grid */}
        <View style={styles.photoGrid}>
          {posts.length > 0 ? (
            posts.map((post) => (
              <View key={post.id} style={styles.photoPlaceholder}>
                <Text style={styles.photoEmoji}>🍽️</Text>
              </View>
            ))
          ) : (
            <View style={styles.noPhotosContainer}>
              <Text style={styles.noPhotosText}>No cooking sessions yet!</Text>
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.userInfoSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{avatar}</Text>
          </View>
          <Text style={styles.displayName}>{profile.display_name}</Text>
          {profile.location && (
            <Text style={styles.location}>{profile.location}</Text>
          )}
          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}
        </View>

        {/* Social Stats */}
        <View style={styles.socialStats}>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.following_count}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.followers_count}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
        </View>

        {/* Edit Profile Button */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editButtonText}>✏️ Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Cooking Stats */}
        <View style={styles.statsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This week</Text>
          </View>
          <View style={styles.weekStats}>
            <View style={styles.weekStatItem}>
              <Text style={styles.weekStatLabel}>Recipes</Text>
              <Text style={styles.weekStatValue}>{thisWeekCount}</Text>
            </View>
            <View style={styles.weekStatItem}>
              <Text style={styles.weekStatLabel}>Time</Text>
              <Text style={styles.weekStatValue}>--</Text>
            </View>
            <View style={styles.weekStatItem}>
              <Text style={styles.weekStatLabel}>Ingredients</Text>
              <Text style={styles.weekStatValue}>--</Text>
            </View>
          </View>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton}>
            <Text style={styles.quickActionEmoji}>🍳</Text>
            <Text style={styles.quickActionText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton}>
            <Text style={styles.quickActionEmoji}>🥞</Text>
            <Text style={styles.quickActionText}>Breakfast</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton}>
            <Text style={styles.quickActionEmoji}>🥗</Text>
            <Text style={styles.quickActionText}>Lunch</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton}>
            <Text style={styles.quickActionEmoji}>🍽️</Text>
            <Text style={styles.quickActionText}>Dinner</Text>
          </TouchableOpacity>
        </View>

        {/* Activities Section */}
        <View style={styles.activitiesSection}>
          <TouchableOpacity 
            style={styles.activityRow}
            onPress={() => navigation.navigate('MyPosts', { screen: 'MyPostsList' })}
          >
            <View style={styles.activityLeft}>
              <Text style={styles.activityIcon}>📋</Text>
              <View>
                <Text style={styles.activityTitle}>Activities</Text>
                <Text style={styles.activitySubtitle}>{posts.length} sessions</Text>
              </View>
            </View>
            <Text style={styles.activityChevron}>›</Text>
          </TouchableOpacity>

          {/* Future sections */}
          <TouchableOpacity style={styles.activityRow} disabled>
            <View style={styles.activityLeft}>
              <Text style={styles.activityIcon}>❤️</Text>
              <View>
                <Text style={[styles.activityTitle, styles.comingSoon]}>Saved Recipes</Text>
                <Text style={styles.activitySubtitle}>Coming soon</Text>
              </View>
            </View>
            <Text style={styles.activityChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.activityRow} disabled>
            <View style={styles.activityLeft}>
              <Text style={styles.activityIcon}>⭐</Text>
              <View>
                <Text style={[styles.activityTitle, styles.comingSoon]}>Most Cooked</Text>
                <Text style={styles.activitySubtitle}>Coming soon</Text>
              </View>
            </View>
            <Text style={styles.activityChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.activityRow}
            onPress={() => navigation.navigate('Pantry')}
          >
            <View style={styles.activityLeft}>
              <Text style={styles.activityIcon}>🏺</Text>
              <View>
                <Text style={styles.activityTitle}>My Pantry</Text>
                <Text style={styles.activitySubtitle}>View pantry</Text>
              </View>
            </View>
            <Text style={styles.activityChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.activityRow}
            onPress={() => navigation.navigate('Grocery', { screen: 'GroceryLists' })}
          >
            <View style={styles.activityLeft}>
              <Text style={styles.activityIcon}>🛒</Text>
              <View>
                <Text style={styles.activityTitle}>Grocery Lists</Text>
                <Text style={styles.activitySubtitle}>View lists</Text>
              </View>
            </View>
            <Text style={styles.activityChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    fontSize: 16,
    color: '#FC4C02',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  settingsIcon: {
    fontSize: 24,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 1,
  },
  photoPlaceholder: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  photoEmoji: {
    fontSize: 40,
  },
  noPhotosContainer: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
  },
  noPhotosText: {
    fontSize: 16,
    color: '#999',
  },
  userInfoSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    fontSize: 40,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
  },
  socialStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  editButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsSection: {
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  weekStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  weekStatItem: {
    alignItems: 'center',
  },
  weekStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  weekStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  quickActionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickActionText: {
    fontSize: 11,
    color: '#333',
  },
  activitiesSection: {
    padding: 16,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIcon: {
    fontSize: 24,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  activityChevron: {
    fontSize: 24,
    color: '#ccc',
  },
  comingSoon: {
    color: '#999',
  },
});