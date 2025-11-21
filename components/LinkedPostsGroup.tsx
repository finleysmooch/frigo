// components/LinkedPostsGroup.tsx
// Visual grouping of linked cooking partner posts (Strava-style)
// FIXED VERSION - Simplified avatar rendering
// Updated: November 21, 2025

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors } from '../lib/theme';
import PostCard, { PostCardData } from './PostCard';

interface LinkedPostsGroupProps {
  posts: PostCardData[];
  currentUserId: string;
  postLikes?: any;
  postComments?: any;
  postParticipants?: any;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onMenu?: (postId: string) => void;
  onViewLikes?: (postId: string) => void;
  onViewParticipants?: (postId: string) => void;
}

const LinkedPostsGroup: React.FC<LinkedPostsGroupProps> = ({
  posts,
  currentUserId,
  postLikes,
  postComments,
  postParticipants,
  onLike,
  onComment,
  onMenu,
  onViewLikes,
  onViewParticipants,
}) => {
  // Sort posts by creation date (earliest first)
  const sortedPosts = [...posts].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Generate header text
  const generateHeader = () => {
    if (sortedPosts.length < 2) return '';
    
    const firstUser = sortedPosts[0].user_profiles;
    const firstName = firstUser?.display_name || firstUser?.username || 'Someone';
    
    if (sortedPosts.length === 2) {
      const secondUser = sortedPosts[1].user_profiles;
      const secondName = secondUser?.display_name || secondUser?.username || 'someone';
      return `${firstName} cooked with ${secondName}`;
    } else {
      const othersCount = sortedPosts.length - 1;
      return `${firstName} cooked with ${othersCount} other${othersCount > 1 ? 's' : ''}`;
    }
  };

  // Get cooking method icon
  const getCookingIcon = (method: string | null): any => {
    const defaultIcon = require('../assets/icons/cook.png');
    
    if (!method) return defaultIcon;
    
    const methodIcons: { [key: string]: any } = {
      'bake': require('../assets/icons/bake.png'),
      'cook': require('../assets/icons/cook.png'),
      'grill': require('../assets/icons/bbq.png'),
      'bbq': require('../assets/icons/bbq.png'),
      'roast': require('../assets/icons/bake.png'),
      'eating_out': require('../assets/icons/eating-out.png'),
      'slow_cook': require('../assets/icons/slow-cook.png'),
      'meal_prep': require('../assets/icons/meal-prep.png'),
      'preserve': require('../assets/icons/preserve.png'),
      'fry': require('../assets/icons/cook.png'),
      'saute': require('../assets/icons/cook.png'),
      'steam': require('../assets/icons/cook.png'),
      'boil': require('../assets/icons/cook.png'),
      'air_fry': require('../assets/icons/cook.png'),
      'pressure_cook': require('../assets/icons/cook.png'),
    };
    
    try {
      return methodIcons[method.toLowerCase()] || defaultIcon;
    } catch (error) {
      console.warn('Icon not found for cooking method:', method);
      return defaultIcon;
    }
  };

  // ✅ SIMPLIFIED: Get user avatars - no complex emoji detection
  const getUserAvatars = () => {
    return sortedPosts.map(post => {
      const profile = post.user_profiles;
      const avatarUrl = profile?.avatar_url;
      
      // Debug log
      console.log('🔍 LinkedPostsGroup avatar:', {
        userId: post.user_id,
        username: profile?.username,
        avatarUrl: avatarUrl,
        avatarType: typeof avatarUrl
      });
      
      return {
        userId: post.user_id,
        avatar: avatarUrl || '👤',  // ✅ Use avatar or default
        displayName: profile?.display_name || profile?.username || 'Unknown'
      };
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  };

  const sharedRecipe = sortedPosts[0].recipes;
  const sharedRecipePhoto = sharedRecipe?.image_url;
  const cookingMethod = sortedPosts[0].cooking_method;
  const cookingIcon = getCookingIcon(cookingMethod);
  const userAvatars = getUserAvatars();
  const headerText = generateHeader();
  const timestamp = formatTimestamp(sortedPosts[0].created_at);
  const location = "Portland, Oregon";

  return (
    <View style={styles.groupContainer}>
      {/* Strava-style header */}
      <View style={styles.groupHeader}>
        <View style={styles.headerIcon}>
          <Image 
            source={cookingIcon}
            style={styles.cookingIcon}
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{headerText}</Text>
          <Text style={styles.headerMeta}>{timestamp} · {location}</Text>
          
          {/* Avatars below the timestamp line */}
          <View style={styles.avatarStack}>
            {userAvatars.map((user, index) => (
              <View 
                key={user.userId}
                style={[
                  styles.stackedAvatar,
                  { 
                    marginLeft: index > 0 ? -8 : 0,
                    zIndex: userAvatars.length - index 
                  }
                ]}
              >
                {/* ✅ SIMPLIFIED: Just show the avatar, no emoji check */}
                <Text style={styles.stackedAvatarEmoji}>{user.avatar}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Shared recipe photo */}
      {sharedRecipePhoto && (
        <View style={styles.sharedPhotoContainer}>
          <Image 
            source={{ uri: sharedRecipePhoto }} 
            style={styles.sharedPhoto}
            resizeMode="cover"
          />
          {sharedRecipe && (
            <View style={styles.recipeOverlay}>
              <Text style={styles.recipeOverlayText}>{sharedRecipe.title}</Text>
            </View>
          )}
        </View>
      )}

      {/* Individual posts stacked below */}
      <View style={styles.postsStack}>
        {sortedPosts.map((post, index) => {
          const likeData = postLikes?.[post.id];
          const commentCount = postComments?.[post.id] || 0;
          const participants = postParticipants?.[post.id];

          // Format likes text for likeData
          let likesText = '';
          if (likeData && likeData.totalCount > 0) {
            likesText = likeData.totalCount === 1 
              ? '1 chef\'s kiss'
              : `${likeData.totalCount} chef's kisses`;
          }

          // Build likeData object matching PostCard's expected structure
          const postLikeData = likeData ? {
            hasLike: likeData.hasLike || false,
            likesText: likesText,
            commentCount: commentCount,
            likes: likeData.likes || []
          } : undefined;

          return (
            <View key={post.id}>
              {index > 0 && (
                <View style={styles.connector}>
                  <View style={styles.connectorLine} />
                </View>
              )}
              
              <PostCard
                post={post}
                currentUserId={currentUserId}
                likeData={postLikeData}
                participants={participants}
                onLike={onLike ? () => onLike(post.id) : undefined}
                onComment={onComment ? () => onComment(post.id) : undefined}
                onMenu={onMenu ? () => onMenu(post.id) : undefined}
                onViewLikes={likesText ? () => onViewLikes?.(post.id) : undefined}
                onViewParticipants={participants ? () => onViewParticipants?.(post.id) : undefined}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  groupContainer: {
    marginBottom: 20,
  },
  groupHeader: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cookingIcon: {
    width: 64,
    height: 64,
    tintColor: '#666',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#333',
    marginBottom: 2,
    lineHeight: 18,
  },
  headerMeta: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
    marginBottom: 6,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stackedAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stackedAvatarEmoji: {
    fontSize: 12,
  },
  sharedPhotoContainer: {
    position: 'relative',
    backgroundColor: '#000',
  },
  sharedPhoto: {
    width: '100%',
    height: 280,
  },
  recipeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
  },
  recipeOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  postsStack: {
    backgroundColor: '#f9f9f9',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  connector: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  connectorLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.primary,
    opacity: 0.3,
  },
});

export default LinkedPostsGroup;