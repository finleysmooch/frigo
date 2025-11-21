// screens/FeedScreen.tsx
// Feed showing posts from people you follow
// Updated: November 20, 2025 - Added mini avatars support

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import PostCard, { PostCardData } from '../components/PostCard';
import LinkedPostsGroup from '../components/LinkedPostsGroup';
import { FeedStackParamList } from '../App';
import { getPostParticipants } from '../lib/services/postParticipantsService';
import { groupPostsForFeed, FeedItem } from '../lib/services/feedGroupingService';

type Props = NativeStackScreenProps<FeedStackParamList, 'FeedMain'>;

interface Post {
  id: string;
  user_id: string;
  title: string;
  rating: number | null;
  cooking_method: string | null;
  created_at: string;
  modifications?: string | null;
  photos?: any[];
  recipes?: any;
  user_profiles: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}

interface Like {
  user_id: string;
  created_at: string;
  avatar_url?: string | null;  // ← Added avatar support
}

interface PostLikes {
  [postId: string]: {
    hasLike: boolean;
    totalCount: number;
    likes: Like[];
  };
}

interface PostComments {
  [postId: string]: number;
}

interface PostParticipants {
  [postId: string]: {
    sous_chefs: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
    ate_with: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
    hiddenSousChefs?: number;  // ← NEW
    hiddenAteWith?: number;    // ← NEW
  };
}

export default function FeedScreen({ navigation }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [postLikes, setPostLikes] = useState<PostLikes>({});
  const [postComments, setPostComments] = useState<PostComments>({});
  const [postParticipants, setPostParticipants] = useState<PostParticipants>({});  // ← NEW
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadFeed();
    }
  }, [currentUserId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadFeed = async () => {
    try {
      // Get posts from people you follow (including your own)
      const { data: followedUserIds } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      const followedIds = followedUserIds?.map(f => f.following_id) || [];
      const allUserIds = [...followedIds, currentUserId]; // Include own posts

      // Get posts from followed users
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('id, user_id, title, rating, cooking_method, created_at, photos, recipe_id, modifications')
        .in('user_id', allUserIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch user profiles separately (INCLUDING avatar_url for custom avatars)
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      // Fetch recipes separately
      const recipeIds = postsData
        .map(p => p.recipe_id)
        .filter((id): id is string => id !== null);
      
      let recipesData: any[] = [];
      if (recipeIds.length > 0) {
        const { data } = await supabase
          .from('recipes')
          .select('id, title, image_url, chefs(name)')
          .in('id', recipeIds);
        recipesData = data || [];
      }

      // Create lookup maps
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const recipesMap = new Map(recipesData.map(r => [r.id, r]));

      // Transform data
      const transformedPosts: Post[] = postsData.map((post: any) => {
        try {
          const transformed = {
            id: post.id,
            user_id: post.user_id,
            title: post.title || 'Untitled Post', // ← Ensure title is never null
            rating: post.rating,
            cooking_method: post.cooking_method,
            created_at: post.created_at,
            photos: post.photos || [],
            modifications: post.modifications || null,
            recipes: post.recipe_id ? recipesMap.get(post.recipe_id) : undefined,
            user_profiles: profilesMap.get(post.user_id) || {
              id: post.user_id,
              username: 'Unknown',
              display_name: 'Unknown User',
              avatar_url: null
            }
          };
          
          // Validate the transformed post
          if (typeof transformed.title !== 'string') {
            console.error('⚠️ POST TITLE NOT STRING:', {
              postId: post.id,
              title: transformed.title,
              titleType: typeof transformed.title
            });
            transformed.title = 'Untitled Post';
          }
          
          return transformed;
        } catch (err) {
          console.error('❌ Error transforming post:', post.id, err);
          setError(`Error transforming post: ${err}`);
          throw err;
        }
      });

      setPosts(transformedPosts);

      // Group posts with relationships (for linked cooking partners)
      const groupedItems = await groupPostsForFeed(transformedPosts);
      setFeedItems(groupedItems);

      // Load likes, comments, and participants
      if (transformedPosts.length > 0) {
        const postIds = transformedPosts.map(p => p.id);
        await Promise.all([
          loadLikesForPosts(postIds),
          loadCommentsForPosts(postIds),
          loadParticipantsForPosts(postIds),  // ← NEW
        ]);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadLikesForPosts = async (postIds: string[]) => {
    try {
      // Get likes with created_at for ordering
      const { data: likesData, error } = await supabase
        .from('post_likes')
        .select('post_id, user_id, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get unique user IDs from all likes
      const likerUserIds = [...new Set(likesData?.map(l => l.user_id) || [])];
      
      // Fetch user profiles for all likers (to get their avatars)
      let likerProfiles: Map<string, { avatar_url?: string | null }> = new Map();
      if (likerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, avatar_url')
          .in('id', likerUserIds);
        
        likerProfiles = new Map(profiles?.map(p => [p.id, { avatar_url: p.avatar_url }]) || []);
      }

      const likesMap: PostLikes = {};
      postIds.forEach(postId => {
        const postLikesList = likesData?.filter(l => l.post_id === postId) || [];
        likesMap[postId] = {
          hasLike: postLikesList.some(l => l.user_id === currentUserId),
          totalCount: postLikesList.length,
          likes: postLikesList.map(l => ({ 
            user_id: l.user_id, 
            created_at: l.created_at,
            avatar_url: likerProfiles.get(l.user_id)?.avatar_url || null  // ← Include actual avatar
          })),
        };
      });

      setPostLikes(likesMap);
    } catch (error) {
      console.error('Error loading likes:', error);
    }
  };

  const loadCommentsForPosts = async (postIds: string[]) => {
    try {
      const { data: commentsData, error } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', postIds);

      if (error) throw error;

      const commentsMap: PostComments = {};
      postIds.forEach(postId => {
        const count = commentsData?.filter(c => c.post_id === postId).length || 0;
        commentsMap[postId] = count;
      });

      setPostComments(commentsMap);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadParticipantsForPosts = async (postIds: string[]) => {
    try {
      const participantsMap: PostParticipants = {};
      
      // Get user's following list for privacy filtering
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);
      
      const followingIds = new Set(followingData?.map(f => f.following_id) || []);
      
      // Load participants for each post
      await Promise.all(
        postIds.map(async (postId) => {
          const participants = await getPostParticipants(postId);
          
          // Get the post creator ID for privacy check
          const post = posts.find(p => p.id === postId);
          const postCreatorId = post?.user_id;
          
          // Filter approved participants and apply privacy rules
          const approvedParticipants = participants.filter(p => p.status === 'approved');
          
          // Privacy filtering: only show participants if:
          // 1. Viewer is the post creator, OR
          // 2. Viewer is the participant, OR
          // 3. Viewer follows both the post creator AND the participant
          const visibleParticipants = approvedParticipants.filter(p => {
            const participantId = p.participant_user_id;
            
            // You can always see yourself
            if (participantId === currentUserId || postCreatorId === currentUserId) {
              return true;
            }
            
            // You can see participant if you follow both post creator and participant
            const followsCreator = followingIds.has(postCreatorId || '');
            const followsParticipant = followingIds.has(participantId);
            
            return followsCreator && followsParticipant;
          });
          
          // Count hidden participants
          const hiddenCount = {
            sous_chef: approvedParticipants.filter(p => 
              p.role === 'sous_chef' && 
              !visibleParticipants.find(vp => vp.participant_user_id === p.participant_user_id)
            ).length,
            ate_with: approvedParticipants.filter(p => 
              p.role === 'ate_with' && 
              !visibleParticipants.find(vp => vp.participant_user_id === p.participant_user_id)
            ).length,
          };
          
          participantsMap[postId] = {
            sous_chefs: visibleParticipants
              .filter(p => p.role === 'sous_chef')
              .map(p => ({
                user_id: p.participant_user_id,
                username: p.participant_profile?.username || 'Unknown',
                avatar_url: p.participant_profile?.avatar_url || null,
                display_name: p.participant_profile?.display_name,
              })),
            ate_with: visibleParticipants
              .filter(p => p.role === 'ate_with')
              .map(p => ({
                user_id: p.participant_user_id,
                username: p.participant_profile?.username || 'Unknown',
                avatar_url: p.participant_profile?.avatar_url || null,
                display_name: p.participant_profile?.display_name,
              })),
            // Add hidden counts for UI
            hiddenSousChefs: hiddenCount.sous_chef,
            hiddenAteWith: hiddenCount.ate_with,
          };
        })
      );
      
      setPostParticipants(participantsMap);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const toggleLike = async (postId: string) => {
    try {
      const currentLikeData = postLikes[postId];
      const isLiked = currentLikeData?.hasLike || false;

      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);

        if (error) throw error;

        setPostLikes(prev => ({
          ...prev,
          [postId]: {
            hasLike: false,
            totalCount: Math.max(0, (prev[postId]?.totalCount || 1) - 1),
            likes: (prev[postId]?.likes || []).filter(l => l.user_id !== currentUserId),
          }
        }));
      } else {
        // Like
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: currentUserId,
          });

        if (error) throw error;

        // Get current user's avatar for the mini avatar display
        const { data: currentUserProfile } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq('id', currentUserId)
          .single();

        setPostLikes(prev => ({
          ...prev,
          [postId]: {
            hasLike: true,
            totalCount: (prev[postId]?.totalCount || 0) + 1,
            likes: [...(prev[postId]?.likes || []), { 
              user_id: currentUserId, 
              created_at: new Date().toISOString(),
              avatar_url: currentUserProfile?.avatar_url || null  // ← Include actual avatar
            }],
          }
        }));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const formatLikesText = (postId: string) => {
    const likeData = postLikes[postId];
    if (!likeData || likeData.totalCount === 0) return undefined;

    const { hasLike, totalCount } = likeData;
    
    let text: string;
    if (hasLike) {
      if (totalCount === 1) {
        text = 'You gave yas chef';
      } else {
        text = `You and ${totalCount - 1} other${totalCount - 1 !== 1 ? 's' : ''} gave yas chef`;
      }
    } else {
      text = `${totalCount} gave yas chef${totalCount !== 1 ? 's' : ''}`;
    }
    
    // Validate text is actually a string
    if (typeof text !== 'string') {
      console.error('❌ LIKES TEXT NOT STRING:', {
        postId,
        text,
        type: typeof text,
        likeData
      });
      return 'Gave yas chef';
    }
    
    return text;
  };

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    try {
      if (item.type === 'grouped') {
        // Render grouped posts (cooking partners)
        const allPosts = [item.mainPost, ...item.linkedPosts];
        
        return (
          <LinkedPostsGroup
            posts={allPosts as PostCardData[]}
            currentUserId={currentUserId}
            postLikes={postLikes}
            postComments={postComments}
            postParticipants={postParticipants}
            onLike={(postId) => toggleLike(postId)}
            onComment={(postId) => navigation.navigate('CommentsList', { postId })}
            onViewLikes={(postId) => {
              const post = allPosts.find(p => p.id === postId);
              if (post && formatLikesText(postId)) {
                navigation.navigate('YasChefsList', { 
                  postId, 
                  postTitle: post.title || 'Post' 
                });
              }
            }}
          />
        );
      } else {
        // Render single post
        const post = item.post;
        const likeData = postLikes[post.id];
        const commentCount = postComments[post.id] || 0;
        const likesText = formatLikesText(post.id);
        const participants = postParticipants[post.id];
        
        // Validate all data before rendering
        if (!post.title || typeof post.title !== 'string') {
          console.error('❌ INVALID POST TITLE:', {
            postId: post.id,
            title: post.title,
            titleType: typeof post.title
          });
          post.title = 'Untitled Post';
        }
        
        if (!post.user_profiles || !post.user_profiles.username) {
          console.error('❌ INVALID USER PROFILE:', {
            postId: post.id,
            user_profiles: post.user_profiles
          });
        }
        
        const avatarUrl = post.user_profiles?.avatar_url;
        const userAvatar = avatarUrl || '👤';

        // Validate likes data
        if (likeData?.likes) {
          likeData.likes.forEach((like, idx) => {
            if (!like.user_id) {
              console.error('❌ INVALID LIKE DATA:', { postId: post.id, likeIndex: idx, like });
            }
          });
        }

        return (
          <PostCard
            post={post as PostCardData}
            currentUserId={currentUserId}
            isOwnPost={post.user_id === currentUserId}
            userInitials={userAvatar}
            likeData={{
              hasLike: likeData?.hasLike || false,
              likesText,
              commentCount,
              likes: likeData?.likes || [],
            }}
            participants={participants}
            onLike={() => toggleLike(post.id)}
            onComment={() => navigation.navigate('CommentsList', { postId: post.id })}
            onViewLikes={likesText ? () => {
              navigation.navigate('YasChefsList', { 
                postId: post.id, 
                postTitle: post.title || 'Post' 
              });
            } : undefined}
          />
        );
      }
    } catch (err) {
      console.error('❌ ERROR RENDERING FEED ITEM:', err);
      setError(`Error rendering feed item: ${err}`);
      return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {feedItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptyText}>
            Follow some people to see their cooking activity!
          </Text>
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => 
            item.type === 'grouped' ? item.id : item.post.id
          }
          renderItem={renderFeedItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 15,
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