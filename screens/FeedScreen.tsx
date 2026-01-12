// screens/FeedScreen.tsx
// Feed showing posts from people you follow
// Updated: December 4, 2025 - Added meal integration

import React, { useState, useEffect, useMemo } from 'react';
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
import { useTheme } from '../lib/theme/ThemeContext';
import PostCard, { PostCardData } from '../components/PostCard';
import LinkedPostsGroup from '../components/LinkedPostsGroup';
import MealPostCard from '../components/MealPostCard';
import { FeedStackParamList } from '../App';
import { getPostParticipants } from '../lib/services/postParticipantsService';
import { groupPostsForFeed, FeedItem } from '../lib/services/feedGroupingService';
import { getMealsForFeed, MealWithDetails } from '../lib/services/mealService';

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
  avatar_url?: string | null;
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
    hiddenSousChefs?: number;
    hiddenAteWith?: number;
  };
}

// Combined feed item type that includes meals
type CombinedFeedItem = 
  | FeedItem 
  | { type: 'meal'; meal: MealWithDetails };

export default function FeedScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedItems, setFeedItems] = useState<CombinedFeedItem[]>([]);
  const [postLikes, setPostLikes] = useState<PostLikes>({});
  const [postComments, setPostComments] = useState<PostComments>({});
  const [postParticipants, setPostParticipants] = useState<PostParticipants>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      color: colors.text.primary,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
  }), [colors]);

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
      
      // Store following IDs for meal card privacy filtering
      setFollowingIds(followedIds);

      // Fetch posts and meals in parallel
      const [postsResult, mealsResult] = await Promise.all([
        loadDishPosts(allUserIds),
        getMealsForFeed(currentUserId, 20),
      ]);

      const transformedPosts = postsResult;
      setPosts(transformedPosts);

      // Group dish posts with relationships (for linked cooking partners)
      const groupedDishItems = await groupPostsForFeed(transformedPosts);

      // Combine dishes and meals, then sort chronologically
      const combinedItems: CombinedFeedItem[] = [
        ...groupedDishItems,
        ...mealsResult.map(meal => ({ type: 'meal' as const, meal })),
      ];

      // Sort all items by date (newest first)
      combinedItems.sort((a, b) => {
        const getDate = (item: CombinedFeedItem): Date => {
          if (item.type === 'meal') {
            return new Date(item.meal.created_at);
          } else if (item.type === 'grouped') {
            return new Date(item.mainPost.created_at);
          } else {
            return new Date(item.post.created_at);
          }
        };
        return getDate(b).getTime() - getDate(a).getTime();
      });

      setFeedItems(combinedItems);

      // Load likes, comments, and participants for dish posts
      if (transformedPosts.length > 0) {
        const postIds = transformedPosts.map(p => p.id);
        await Promise.all([
          loadLikesForPosts(postIds),
          loadCommentsForPosts(postIds),
          loadParticipantsForPosts(postIds),
        ]);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDishPosts = async (userIds: string[]): Promise<Post[]> => {
    // Get posts from followed users (dishes only, not meal posts)
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('id, user_id, title, rating, cooking_method, created_at, photos, recipe_id, modifications, post_type')
      .in('user_id', userIds)
      .or('post_type.eq.dish,post_type.is.null') // Only dish posts (or old posts without type)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!postsData || postsData.length === 0) {
      return [];
    }

    // Fetch user profiles separately
    const userProfileIds = [...new Set(postsData.map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userProfileIds);

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
    return postsData.map((post: any) => ({
      id: post.id,
      user_id: post.user_id,
      title: post.title || 'Untitled Post',
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
    }));
  };

  const loadLikesForPosts = async (postIds: string[]) => {
    try {
      const { data: likesData, error } = await supabase
        .from('post_likes')
        .select('post_id, user_id, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get unique user IDs from all likes
      const likerUserIds = [...new Set(likesData?.map(l => l.user_id) || [])];
      
      // Fetch user profiles for all likers
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
            avatar_url: likerProfiles.get(l.user_id)?.avatar_url || null
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
      
      const followingIdsSet = new Set(followingData?.map(f => f.following_id) || []);
      
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
            const followsCreator = followingIdsSet.has(postCreatorId || '');
            const followsParticipant = followingIdsSet.has(participantId);
            
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
      const isCurrentlyLiked = postLikes[postId]?.hasLike;

      if (isCurrentlyLiked) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);

        setPostLikes(prev => ({
          ...prev,
          [postId]: {
            hasLike: false,
            totalCount: Math.max(0, (prev[postId]?.totalCount || 1) - 1),
            likes: prev[postId]?.likes.filter(l => l.user_id !== currentUserId) || [],
          }
        }));
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: currentUserId });

        // Get current user's avatar for the like
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
              avatar_url: currentUserProfile?.avatar_url || null
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
    
    if (hasLike) {
      if (totalCount === 1) {
        return 'You gave yas chef';
      } else {
        return `You and ${totalCount - 1} other${totalCount - 1 !== 1 ? 's' : ''} gave yas chef`;
      }
    } else {
      return `${totalCount} gave yas chef${totalCount !== 1 ? 's' : ''}`;
    }
  };

  const handleMealPress = (mealId: string) => {
    // Navigate to meal detail - need to handle cross-stack navigation
    // For now, we'll use the navigation prop to go to PostDetail (or could add MealDetail to FeedStack)
    // TODO: Consider adding MealDetail to FeedStack for better UX
    console.log('Meal pressed:', mealId);
    // navigation.navigate('MealDetail', { mealId, currentUserId });
  };

  const renderFeedItem = ({ item }: { item: CombinedFeedItem }) => {
    try {
      // Handle meal posts
      if (item.type === 'meal') {
        return (
          <MealPostCard
            meal={item.meal}
            currentUserId={currentUserId}
            followingIds={followingIds}
            onPress={() => handleMealPress(item.meal.id)}
            onLike={() => {
              // TODO: Implement meal liking
              console.log('Like meal:', item.meal.id);
            }}
            onComment={() => {
              // TODO: Navigate to meal comments
              console.log('Comment on meal:', item.meal.id);
            }}
          />
        );
      }

      // Handle grouped dish posts (cooking partners)
      if (item.type === 'grouped') {
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
      }

      // Handle single dish post
      const post = item.post;
      const likeData = postLikes[post.id];
      const commentCount = postComments[post.id] || 0;
      const likesText = formatLikesText(post.id);
      const participants = postParticipants[post.id];
      
      const avatarUrl = post.user_profiles?.avatar_url;
      const userAvatar = avatarUrl || '👤';

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
          keyExtractor={(item) => {
            if (item.type === 'meal') return `meal-${item.meal.id}`;
            if (item.type === 'grouped') return item.id;
            return item.post.id;
          }}
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