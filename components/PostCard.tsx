// components/PostCard.tsx
// Shared post card component
// Updated: February 19, 2026 v3
// Strava-style stat blocks, clickable recipe/chef, recipe image fallback

import React, { useState, useEffect, useMemo } from 'react';
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
import ParticipantsListModal from './ParticipantsListModal';
import UserAvatar from './UserAvatar';
import { CompactNutrition, getCompactNutrition } from '../lib/services/nutritionService';

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
  cook_time_min?: number;
  prep_time_min?: number;
  cuisine_types?: string[];
  chefs?: {
    name: string;
  } | { name: string }[];
}

interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  subscription_tier?: string;
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
    likes?: Array<{ user_id: string; created_at: string; avatar_url?: string | null; subscription_tier?: string }>;
  };
  participants?: {
    sous_chefs: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
    ate_with: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
    hiddenSousChefs?: number;
    hiddenAteWith?: number;
  };
  onLike?: () => void;
  onComment?: () => void;
  onMenu?: () => void;
  onViewLikes?: () => void;
  onViewParticipants?: () => void;
  onRecipePress?: (recipeId: string) => void;
  onChefPress?: (chefName: string) => void;
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

const COOKING_METHOD_DISPLAY: Record<string, string> = {
  cook: 'Cook',
  bake: 'Bake',
  bbq: 'BBQ',
  meal_prep: 'Meal Prep',
  snack: 'Snack',
  eating_out: 'Eat Out',
  breakfast: 'Breakfast',
  slow_cook: 'Slow Cook',
  soup: 'Soup',
  preserve: 'Preserve',
};

// Dietary flag emoji mapping
const DIETARY_EMOJIS: Record<string, { emoji: string; label: string }> = {
  vegan:       { emoji: '🌱', label: 'Vegan' },
  vegetarian:  { emoji: '🥬', label: 'Veg' },
  gluten_free: { emoji: '🌾', label: 'GF' },
  dairy_free:  { emoji: '🥛', label: 'DF' },
  nut_free:    { emoji: '🥜', label: 'NF' },
  egg_free:    { emoji: '🥚', label: 'EF' },
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
  onViewParticipants,
  onRecipePress,
  onChefPress,
}: PostCardProps) {
  const { colors, functionalColors } = useTheme();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [participantsModalVisible, setParticipantsModalVisible] = useState(false);
  const [nutrition, setNutrition] = useState<CompactNutrition | null>(null);

  // Fetch dietary flags for this post's recipe
  useEffect(() => {
    const recipeId = post.recipes?.id;
    if (recipeId) {
      getCompactNutrition(recipeId).then(setNutrition).catch(() => {});
    }
  }, [post.recipes?.id]);

  // ── Data extraction ──────────────────────────────────────────

  const recipe = post.recipes;
  const chef = recipe?.chefs ? (Array.isArray(recipe.chefs) ? recipe.chefs[0] : recipe.chefs) : null;
  
  const displayName = isOwnPost
    ? 'You'
    : post.user_profiles?.display_name || post.user_profiles?.username || 'Someone';

  const postTitle = post.title || 'Cooking Session';

  // ── Stats data ───────────────────────────────────────────────

  const cookTime = recipe?.cook_time_min;
  const prepTime = recipe?.prep_time_min;
  const totalTime = (cookTime || 0) + (prepTime || 0);
  const cuisines = recipe?.cuisine_types?.filter(Boolean) || [];
  const dietaryFlags = nutrition?.dietaryFlags || [];
  const cookingMethod = post.cooking_method;

  const formatTime = (minutes: number): string => {
    if (minutes >= 60) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }
    return `${minutes}m`;
  };

  // Build stats array — only include stats that have data
  const stats: Array<{ value: string; label: string; icon?: any }> = [];
  
  if (totalTime > 0) {
    stats.push({ value: formatTime(totalTime), label: 'Time' });
  }
  if (cookingMethod && COOKING_METHOD_DISPLAY[cookingMethod]) {
    stats.push({ 
      value: COOKING_METHOD_DISPLAY[cookingMethod], 
      label: 'Method',
      icon: COOKING_METHOD_ICON_IMAGES[cookingMethod],
    });
  }
  if (cuisines.length > 0) {
    stats.push({ 
      value: cuisines[0], 
      label: cuisines.length > 1 ? `+${cuisines.length - 1} more` : 'Cuisine' 
    });
  }

  // ── Helpers ──────────────────────────────────────────────────

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const formatParticipantsText = () => {
    if (!participants) return null;
    
    const { sous_chefs, ate_with, hiddenSousChefs = 0, hiddenAteWith = 0 } = participants;
    const parts: string[] = [];
    
    if (sous_chefs.length > 0 || hiddenSousChefs > 0) {
      const visibleCount = sous_chefs.length;
      const totalHidden = hiddenSousChefs;
      
      if (visibleCount === 0 && totalHidden > 0) {
        parts.push(`👨‍🍳 Cooked with ${totalHidden} other${totalHidden > 1 ? 's' : ''}`);
      } else if (visibleCount === 1 && totalHidden === 0) {
        parts.push(`👨‍🍳 Cooked with ${sous_chefs[0].display_name || sous_chefs[0].username}`);
      } else if (visibleCount === 1 && totalHidden > 0) {
        parts.push(`👨‍🍳 Cooked with ${sous_chefs[0].display_name || sous_chefs[0].username} and ${totalHidden} other${totalHidden > 1 ? 's' : ''}`);
      } else if (visibleCount === 2 && totalHidden === 0) {
        parts.push(`👨‍🍳 Cooked with ${sous_chefs[0].display_name || sous_chefs[0].username} and ${sous_chefs[1].display_name || sous_chefs[1].username}`);
      } else if (visibleCount >= 2) {
        const othersCount = (visibleCount - 1) + totalHidden;
        parts.push(`👨‍🍳 Cooked with ${sous_chefs[0].display_name || sous_chefs[0].username} and ${othersCount} other${othersCount > 1 ? 's' : ''}`);
      }
    }
    
    if (ate_with.length > 0 || hiddenAteWith > 0) {
      const visibleCount = ate_with.length;
      const totalHidden = hiddenAteWith;
      
      if (visibleCount === 0 && totalHidden > 0) {
        parts.push(`🍽️ Ate with ${totalHidden} other${totalHidden > 1 ? 's' : ''}`);
      } else if (visibleCount === 1 && totalHidden === 0) {
        parts.push(`🍽️ Ate with ${ate_with[0].display_name || ate_with[0].username}`);
      } else if (visibleCount === 1 && totalHidden > 0) {
        parts.push(`🍽️ Ate with ${ate_with[0].display_name || ate_with[0].username} and ${totalHidden} other${totalHidden > 1 ? 's' : ''}`);
      } else if (visibleCount === 2 && totalHidden === 0) {
        parts.push(`🍽️ Ate with ${ate_with[0].display_name || ate_with[0].username} and ${ate_with[1].display_name || ate_with[1].username}`);
      } else if (visibleCount >= 2) {
        const othersCount = (visibleCount - 1) + totalHidden;
        parts.push(`🍽️ Ate with ${ate_with[0].display_name || ate_with[0].username} and ${othersCount} other${othersCount > 1 ? 's' : ''}`);
      }
    }
    
    return parts.length > 0 ? parts : null;
  };

  // ── Photo carousel ───────────────────────────────────────────

  const renderPhotoCarousel = () => {
    const hasPostPhotos = post.photos && post.photos.length > 0;
    const recipeImageUrl = post.recipes?.image_url;
    
    if (!hasPostPhotos && !recipeImageUrl) return null;

    // Fallback to recipe image when no post photos
    if (!hasPostPhotos && recipeImageUrl) {
      return (
        <View style={styles.photoCarouselContainer}>
          <View style={styles.photoSlide}>
            <Image
              source={{ uri: recipeImageUrl }}
              style={styles.photoImage}
              resizeMode="cover"
            />
            <View style={styles.recipeImageBadge}>
              <Text style={styles.recipeImageBadgeText}>📖 Recipe photo</Text>
            </View>
          </View>
        </View>
      );
    }

    const sortedPhotos = [...post.photos!].sort((a, b) => {
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

  // ── Styles ───────────────────────────────────────────────────

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
    headerInfo: {
      flex: 1,
      justifyContent: 'center',
      marginLeft: 12,
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

    // ── Photo Carousel ──
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
    recipeImageBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    recipeImageBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '500',
    },

    // ── Content ──
    postTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
    },
    recipeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: 12,
    },
    recipeIcon: {
      fontSize: 14,
      marginRight: 4,
    },
    recipeTitle: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    recipeSeparator: {
      fontSize: 14,
      color: colors.text.tertiary,
    },
    chefName: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    linkText: {
      color: colors.primary,
      fontWeight: '500',
    },

    // ── Strava-style Stats Row ──
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border.medium,
      marginBottom: 10,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    statIcon: {
      width: 16,
      height: 16,
      marginRight: 4,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text.primary,
    },
    statLabel: {
      fontSize: 11,
      color: colors.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.border.medium,
    },

    // ── Dietary badges ──
    dietaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    dietaryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    dietaryEmoji: {
      fontSize: 12,
      marginRight: 3,
    },
    dietaryLabel: {
      fontSize: 11,
      color: colors.text.secondary,
      fontWeight: '500',
    },

    // ── Participants ──
    participantsContainer: {
      marginBottom: 8,
    },
    participantText: {
      fontSize: 13,
      color: colors.text.primary,
      marginBottom: 2,
      fontWeight: '500',
    },

    // ── Modifications ──
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

    // ── Social ──
    likesSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 6,
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

  // ── Render ───────────────────────────────────────────────────

  return (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <UserAvatar user={post.user_profiles} size={48} />

        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <View style={styles.metaRow}>
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

      {/* Post Title */}
      <Text style={styles.postTitle}>{postTitle}</Text>

      {/* Recipe + Chef (clickable) */}
      {recipe && (
        <View style={styles.recipeRow}>
          <Text style={styles.recipeIcon}>📖</Text>
          <TouchableOpacity
            onPress={() => onRecipePress?.(recipe.id)}
            activeOpacity={onRecipePress ? 0.6 : 1}
          >
            <Text style={[styles.recipeTitle, onRecipePress && styles.linkText]}>
              {recipe.title}
            </Text>
          </TouchableOpacity>
          {chef?.name && (
            <>
              <Text style={styles.recipeSeparator}> · by </Text>
              <TouchableOpacity
                onPress={() => onChefPress?.(chef.name)}
                activeOpacity={onChefPress ? 0.6 : 1}
              >
                <Text style={[styles.chefName, onChefPress && styles.linkText]}>
                  {chef.name}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Photos */}
      {renderPhotoCarousel()}

      {/* Strava-style Stats Row */}
      {stats.length > 0 && (
        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 && <View style={styles.statDivider} />}
              <View style={styles.stat}>
                <View style={styles.statValueRow}>
                  {stat.icon && (
                    <Image source={stat.icon} style={styles.statIcon} resizeMode="contain" />
                  )}
                  <Text style={styles.statValue}>{stat.value}</Text>
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* Dietary Badges */}
      {dietaryFlags.length > 0 && (
        <View style={styles.dietaryRow}>
          {dietaryFlags.map((flag) => {
            const display = DIETARY_EMOJIS[flag.key];
            if (!display) return null;
            return (
              <View key={flag.key} style={styles.dietaryBadge}>
                <Text style={styles.dietaryEmoji}>{display.emoji}</Text>
                <Text style={styles.dietaryLabel}>{display.label}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Participants */}
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

      {/* Notes */}
      {post.modifications && (
        <View style={styles.modificationsContainer}>
          <Text style={styles.modificationsLabel}>💭 Notes:</Text>
          <Text style={styles.modificationsText} numberOfLines={3}>
            {post.modifications}
          </Text>
        </View>
      )}

      {/* Likes & Comments */}
      {likeData && (!!likeData.likesText || ((likeData.commentCount ?? 0) > 0 && !!onComment)) && (
        <View style={styles.likesSection}>
          {likeData.likesText && (
            <TouchableOpacity 
              onPress={onViewLikes} 
              activeOpacity={0.7}
              style={styles.likesSectionLeft}
            >
              {likeData.likes && likeData.likes.length > 0 && (
                <View style={styles.avatarStack}>
                  {likeData.likes.slice(0, 3).map((like, index) => (
                    <View
                      key={like.user_id}
                      style={{ marginLeft: index > 0 ? -8 : 0, zIndex: 10 - index }}
                    >
                      <UserAvatar
                        user={{
                          avatar_url: like.avatar_url,
                        }}
                        size={28}
                      />
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.likesText}>{likeData.likesText}</Text>
            </TouchableOpacity>
          )}
          {(likeData.commentCount ?? 0) > 0 && onComment && (
            <TouchableOpacity onPress={onComment} activeOpacity={0.7}>
              <Text style={styles.commentsText}>
                {likeData.commentCount} comment{likeData.commentCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Action Buttons */}
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