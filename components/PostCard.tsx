// components/PostCard.tsx
// Shared post card component - MATCHES MyPosts layout exactly
// Updated: November 20, 2025

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import ParticipantsListModal from './ParticipantsListModal';  // ← NEW

const SCREEN_WIDTH = Dimensions.get('window').width;

interface PostPhoto {
  url: string;
  caption?: string;
  order: number;
  is_highlight?: boolean;
}

interface Recipe {
  id: string;
  title: string;
  image_url?: string;
  chefs?: {
    name: string;
  } | { name: string }[];
}

interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
}

export interface PostCardData {
  id: string;
  user_id: string;
  title: string;
  rating: number | null;
  cooking_method: string | null;
  created_at: string;
  modifications?: string | null;
  photos?: PostPhoto[];
  recipes?: Recipe;
  user_profiles: UserProfile;
}

interface PostCardProps {
  post: PostCardData;
  currentUserId: string;
  isOwnPost?: boolean;
  userInitials?: string;
  likeData?: {
    hasLike: boolean;
    likesText?: string;
    commentCount?: number;
    likes?: Array<{ user_id: string; created_at: string; avatar_url?: string | null }>;
  };
  participants?: {
    sous_chefs: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
    ate_with: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
    hiddenSousChefs?: number;  // ← NEW
    hiddenAteWith?: number;    // ← NEW
  };
  onLike?: () => void;
  onComment?: () => void;
  onMenu?: () => void;
  onViewLikes?: () => void;
  onViewParticipants?: () => void;  // ← NEW (optional, for custom handling)
}

const COOKING_METHOD_ICON_IMAGES: { [key: string]: any } = {
  cook: require('../assets/icons/cook.png'),
  bake: require('../assets/icons/bake.png'),
  bbq: require('../assets/icons/bbq.png'),
  meal_prep: require('../assets/icons/meal-prep.png'),
  snack: require('../assets/icons/snack.png'),
  eating_out: require('../assets/icons/eating-out.png'),
  breakfast: require('../assets/icons/breakfast.png'),
  slow_cook: require('../assets/icons/slow-cook.png'),
  soup: require('../assets/icons/soup.png'),
  preserve: require('../assets/icons/preserve.png'),
};

export default function PostCard({
  post,
  currentUserId,
  isOwnPost = false,
  userInitials,
  likeData,
  participants,
  onLike,
  onComment,
  onMenu,
  onViewLikes,
  onViewParticipants,  // ← NEW
}: PostCardProps) {
  const { colors, functionalColors } = useTheme();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [participantsModalVisible, setParticipantsModalVisible] = useState(false);  // ← NEW

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const formatParticipantsText = () => {
    if (!participants) return null;
    
    const { sous_chefs, ate_with, hiddenSousChefs = 0, hiddenAteWith = 0 } = participants;
    const parts: string[] = [];
    
    // Sous chefs text
    if (sous_chefs.length > 0 || hiddenSousChefs > 0) {
      const visibleCount = sous_chefs.length;
      const totalHidden = hiddenSousChefs;
      
      if (visibleCount === 0 && totalHidden > 0) {
        // Only hidden participants
        parts.push(`👨‍🍳 Cooked with ${totalHidden} other${totalHidden > 1 ? 's' : ''}`);
      } else if (visibleCount === 1 && totalHidden === 0) {
        // One visible, no hidden
        parts.push(`👨‍🍳 Cooked with ${sous_chefs[0].display_name || sous_chefs[0].username}`);
      } else if (visibleCount === 1 && totalHidden > 0) {
        // One visible, some hidden
        parts.push(`👨‍🍳 Cooked with ${sous_chefs[0].display_name || sous_chefs[0].username} and ${totalHidden} other${totalHidden > 1 ? 's' : ''}`);
      } else if (visibleCount === 2 && totalHidden === 0) {
        // Two visible, no hidden
        parts.push(`👨‍🍳 Cooked with ${sous_chefs[0].display_name || sous_chefs[0].username} and ${sous_chefs[1].display_name || sous_chefs[1].username}`);
      } else if (visibleCount >= 2) {
        // Multiple visible (with or without hidden)
        const othersCount = (visibleCount - 1) + totalHidden;
        parts.push(`👨‍🍳 Cooked with ${sous_chefs[0].display_name || sous_chefs[0].username} and ${othersCount} other${othersCount > 1 ? 's' : ''}`);
      }
    }
    
    // Ate with text
    if (ate_with.length > 0 || hiddenAteWith > 0) {
      const visibleCount = ate_with.length;
      const totalHidden = hiddenAteWith;
      
      if (visibleCount === 0 && totalHidden > 0) {
        // Only hidden participants
        parts.push(`🍽️ Ate with ${totalHidden} other${totalHidden > 1 ? 's' : ''}`);
      } else if (visibleCount === 1 && totalHidden === 0) {
        // One visible, no hidden
        parts.push(`🍽️ Ate with ${ate_with[0].display_name || ate_with[0].username}`);
      } else if (visibleCount === 1 && totalHidden > 0) {
        // One visible, some hidden
        parts.push(`🍽️ Ate with ${ate_with[0].display_name || ate_with[0].username} and ${totalHidden} other${totalHidden > 1 ? 's' : ''}`);
      } else if (visibleCount === 2 && totalHidden === 0) {
        // Two visible, no hidden
        parts.push(`🍽️ Ate with ${ate_with[0].display_name || ate_with[0].username} and ${ate_with[1].display_name || ate_with[1].username}`);
      } else if (visibleCount >= 2) {
        // Multiple visible (with or without hidden)
        const othersCount = (visibleCount - 1) + totalHidden;
        parts.push(`🍽️ Ate with ${ate_with[0].display_name || ate_with[0].username} and ${othersCount} other${othersCount > 1 ? 's' : ''}`);
      }
    }
    
    return parts.length > 0 ? parts : null;
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <View style={styles.starsContainer}>
        {[...Array(5)].map((_, i) => (
          <Text key={`star-${post.id}-${i}`} style={styles.star}>
            {i < rating ? '⭐' : '☆'}
          </Text>
        ))}
      </View>
    );
  };

  const renderPhotoCarousel = () => {
    if (!post.photos || post.photos.length === 0) return null;

    const sortedPhotos = [...post.photos].sort((a, b) => {
      if (a.is_highlight) return -1;
      if (b.is_highlight) return 1;
      return a.order - b.order;
    });

    const onScroll = (event: any) => {
      const slideSize = event.nativeEvent.layoutMeasurement.width;
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.round(offset / slideSize);
      setCarouselIndex(index);
    };

    return (
      <View style={styles.photoCarouselContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {sortedPhotos.map((photo, index) => (
            <View key={`photo-${post.id}-${index}`} style={styles.photoSlide}>
              <Image 
                source={{ uri: photo.url }}
                style={styles.photoImage}
                resizeMode="cover"
              />
              {photo.caption && (
                <View style={styles.captionOverlay}>
                  <Text style={styles.captionText}>{photo.caption}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
        
        {sortedPhotos.length > 1 && (
          <View style={styles.photoIndicators}>
            {sortedPhotos.map((_, index) => (
              <View
                key={`dot-${post.id}-${index}`}
                style={[
                  styles.indicator,
                  index === carouselIndex && styles.indicatorActive
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const recipe = post.recipes;
  const chef = recipe?.chefs ? (Array.isArray(recipe.chefs) ? recipe.chefs[0] : recipe.chefs) : null;
  
  const displayName = isOwnPost 
    ? 'You'
    : post.user_profiles?.display_name || post.user_profiles?.username || 'Someone';

  // Validate displayName is a string
  if (typeof displayName !== 'string') {
    console.error('❌ DISPLAY NAME NOT STRING:', {
      postId: post.id,
      displayName,
      type: typeof displayName,
      user_profiles: post.user_profiles
    });
  }

  // Use avatar from user profile, or userInitials prop, or default
  const avatarContent = post.user_profiles?.avatar_url || userInitials || '👤';

  // Validate post title
  const postTitle = post.title || 'Cooking Session';
  if (typeof postTitle !== 'string') {
    console.error('❌ POST TITLE NOT STRING:', {
      postId: post.id,
      title: post.title,
      type: typeof post.title
    });
  }

  const styles = useMemo(() => StyleSheet.create({
    postCard: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    postHeader: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
    avatarText: {
      fontSize: 28,
    },
    avatarEmoji: {
      fontSize: 24,
    },
    headerInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    userName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    methodIconSmall: {
      width: 20,
      height: 20,
      marginRight: 6,
    },
    metaText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    menuButton: {
      padding: 4,
    },
    menuButtonText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text.tertiary,
      lineHeight: 20,
    },
    photoCarouselContainer: {
      marginHorizontal: -16,
      marginBottom: 12,
      position: 'relative',
    },
    photoSlide: {
      width: SCREEN_WIDTH - 32,
      height: SCREEN_WIDTH - 32,
      backgroundColor: '#000',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    captionOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      padding: 12,
    },
    captionText: {
      color: colors.background.card,
      fontSize: 14,
    },
    photoIndicators: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    indicator: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      marginHorizontal: 3,
    },
    indicatorActive: {
      backgroundColor: colors.background.card,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    postTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 8,
    },
    recipeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    recipeTitle: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    chefName: {
      fontSize: 14,
      color: colors.primary,
    },
    ratingContainer: {
      marginBottom: 8,
    },
    starsContainer: {
      flexDirection: 'row',
    },
    star: {
      fontSize: 16,
      marginRight: 2,
    },
    participantsContainer: {
      marginBottom: 8,
    },
    participantText: {
      fontSize: 13,
      color: colors.text.primary,
      marginBottom: 2,
      fontWeight: '500',
    },
    modificationsContainer: {
      marginBottom: 12,
    },
    modificationsLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    modificationsText: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    likesSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 8,
      borderTopWidth: 0,
      borderTopColor: colors.background.secondary,
      marginTop: 12,
    },
    likesSectionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatarStack: {
      flexDirection: 'row',
      marginRight: 8,
    },
    miniAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.background.card,
      borderWidth: 2,
      borderColor: colors.background.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    miniAvatarText: {
      fontSize: 12,
    },
    likesText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    commentsText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    actionsRow: {
      flexDirection: 'row',
      paddingTop: 0,
      paddingHorizontal: '5%',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionButton: {
      padding: 8,
    },
    actionIcon: {
      width: 30,
      height: 30,
    },
  }), [colors, functionalColors]);

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>
            {avatarContent}
          </Text>
        </View>
        
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <View style={styles.metaRow}>
            {post.cooking_method && COOKING_METHOD_ICON_IMAGES[post.cooking_method] && (
              <Image 
                source={COOKING_METHOD_ICON_IMAGES[post.cooking_method]}
                style={styles.methodIconSmall}
                resizeMode="contain"
              />
            )}
            <Text style={styles.metaText}>
              {formatDate(post.created_at)} in Portland, Oregon
            </Text>
          </View>
        </View>

        {onMenu && (
          <TouchableOpacity style={styles.menuButton} onPress={onMenu}>
            <Text style={styles.menuButtonText}>•••</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderPhotoCarousel()}

      <Text style={styles.postTitle}>{postTitle}</Text>

      {recipe && (
        <View style={styles.recipeRow}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          {chef?.name && (
            <Text style={styles.chefName}> by {chef.name}</Text>
          )}
        </View>
      )}

      {post.rating && (
        <View style={styles.ratingContainer}>
          {renderStars(post.rating)}
        </View>
      )}

      {formatParticipantsText() && (
        <TouchableOpacity 
          style={styles.participantsContainer}
          onPress={() => {
            if (onViewParticipants) {
              onViewParticipants();
            } else {
              setParticipantsModalVisible(true);
            }
          }}
          activeOpacity={0.7}
        >
          {formatParticipantsText()!.map((text, index) => (
            <Text key={index} style={styles.participantText}>
              {text}
            </Text>
          ))}
        </TouchableOpacity>
      )}

      {post.modifications && (
        <View style={styles.modificationsContainer}>
          <Text style={styles.modificationsLabel}>💭 Notes:</Text>
          <Text style={styles.modificationsText} numberOfLines={3}>
            {post.modifications}
          </Text>
        </View>
      )}

      {likeData && (likeData.likesText || (likeData.commentCount && likeData.commentCount > 0 && onComment)) && (
        <View style={styles.likesSection}>
          {likeData.likesText && (
            <TouchableOpacity 
              onPress={onViewLikes} 
              activeOpacity={0.7}
              style={styles.likesSectionLeft}
            >
              {likeData.likes && likeData.likes.length > 0 && (
                <View style={styles.avatarStack}>
                  {likeData.likes.slice(0, 3).map((like, index) => {
                    // Use actual avatar from database or default
                    const likerAvatar = like.avatar_url || '👤';
                    
                    return (
                      <View 
                        key={like.user_id} 
                        style={[
                          styles.miniAvatar,
                          { marginLeft: index > 0 ? -8 : 0, zIndex: 10 - index }
                        ]}
                      >
                        <Text style={styles.miniAvatarText}>
                          {likerAvatar}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <Text style={styles.likesText}>{likeData.likesText}</Text>
            </TouchableOpacity>
          )}
          {likeData.commentCount && likeData.commentCount > 0 && onComment && (
            <TouchableOpacity onPress={onComment} activeOpacity={0.7}>
              <Text style={styles.commentsText}>
                {likeData.commentCount} comment{likeData.commentCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {(onLike || onComment) && (
        <View style={styles.actionsRow}>
          {onLike && (
            <TouchableOpacity style={styles.actionButton} onPress={onLike}>
              <Image 
                source={likeData?.hasLike
                  ? require('../assets/icons/like-outline-2-filled.png')
                  : require('../assets/icons/like-outline-2-thick.png')
                }
                style={[
                  styles.actionIcon,
                  likeData?.hasLike && { tintColor: functionalColors.like }
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          
          {onComment && (
            <TouchableOpacity style={styles.actionButton} onPress={onComment}>
              <Image 
                source={require('../assets/icons/comment.png')}
                style={styles.actionIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Participants List Modal */}
      {participants && (
        <ParticipantsListModal
          visible={participantsModalVisible}
          onClose={() => setParticipantsModalVisible(false)}
          postTitle={postTitle}
          sousChefs={participants.sous_chefs}
          ateWith={participants.ate_with}
          currentUserId={currentUserId}
        />
      )}
    </View>
  );
}