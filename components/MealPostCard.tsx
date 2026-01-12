// components/MealPostCard.tsx
// Card component for displaying meal posts in the feed
// Created: December 2, 2025

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
import {
  MealWithDetails,
  MealParticipant,
  DishInMeal,
  getMealParticipants,
  getMealDishes,
  getCourseDisplayName,
  CourseType,
} from '../lib/services/mealService';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MealPostCardProps {
  meal: MealWithDetails;
  currentUserId: string;
  followingIds: string[];
  onPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onMenu?: () => void;
  likeData?: {
    hasLike: boolean;
    likesText?: string;
    commentCount?: number;
  };
}

export default function MealPostCard({
  meal,
  currentUserId,
  followingIds,
  onPress,
  onLike,
  onComment,
  onMenu,
  likeData,
}: MealPostCardProps) {
  const { colors, functionalColors } = useTheme();
  const [participants, setParticipants] = useState<MealParticipant[]>([]);
  const [dishes, setDishes] = useState<DishInMeal[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    loadMealData();
  }, [meal.id]);

  const loadMealData = async () => {
    const [participantsData, dishesData] = await Promise.all([
      getMealParticipants(meal.id),
      getMealDishes(meal.id),
    ]);
    setParticipants(participantsData);
    setDishes(dishesData);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  // Get visible participants (those the viewer follows)
  const visibleParticipants = participants.filter(
    p => p.rsvp_status === 'accepted' && 
    (followingIds.includes(p.user_id) || p.user_id === currentUserId)
  );
  const hiddenCount = participants.filter(p => p.rsvp_status === 'accepted').length - visibleParticipants.length;

  // Format header text
  const formatHeaderText = () => {
    if (visibleParticipants.length === 0 && hiddenCount > 0) {
      return `${hiddenCount} ${hiddenCount === 1 ? 'person' : 'people'} shared a meal`;
    }

    const names = visibleParticipants
      .slice(0, 3)
      .map(p => p.user_profile?.display_name || p.user_profile?.username || 'Someone');

    const extraCount = Math.max(0, visibleParticipants.length - 3) + hiddenCount;

    if (names.length === 1 && extraCount === 0) {
      return `${names[0]}'s meal`;
    }
    if (names.length === 2 && extraCount === 0) {
      return `${names[0]} and ${names[1]} shared a meal`;
    }
    if (extraCount === 0) {
      return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} shared a meal`;
    }
    return `${names.join(', ')}, and ${extraCount} ${extraCount === 1 ? 'other' : 'others'} shared a meal`;
  };

  // Collect all photos from dishes
  const allPhotos: { url: string; dishTitle: string; contributor: string }[] = [];
  dishes.forEach(dish => {
    const photos = dish.dish_photos || [];
    photos.forEach((photo: any) => {
      allPhotos.push({
        url: photo.url,
        dishTitle: dish.recipe_title || dish.dish_title || 'Dish',
        contributor: dish.contributor_display_name || dish.contributor_username || '',
      });
    });
  });

  // Group dishes by course
  const groupedDishes = new Map<CourseType, DishInMeal[]>();
  const courseOrder: CourseType[] = ['appetizer', 'main', 'side', 'dessert', 'drink', 'other'];
  courseOrder.forEach(course => groupedDishes.set(course, []));
  dishes.forEach(dish => {
    const group = groupedDishes.get(dish.course_type) || groupedDishes.get('other')!;
    group.push(dish);
  });

  // Get avatar emoji based on user ID hash
  const getAvatarEmoji = (userId: string): string => {
    const emojis = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🍕', '🌮', '🍔', '🍜', '🥘'];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return emojis[hash % emojis.length];
  };

  const styles = useMemo(() => StyleSheet.create({
    card: {
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    participantAvatars: {
      flexDirection: 'row',
      marginRight: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background.card,
    },
    avatarOverlap: {
      marginLeft: -12,
    },
    avatarEmoji: {
      fontSize: 20,
    },
    headerInfo: {
      flex: 1,
    },
    headerText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    mealIcon: {
      fontSize: 14,
      marginRight: 4,
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
    },
    photoCarouselContainer: {
      marginHorizontal: -16,
      marginBottom: 12,
      position: 'relative',
    },
    photoSlide: {
      width: SCREEN_WIDTH - 32,
      height: (SCREEN_WIDTH - 32) * 0.75,
      backgroundColor: '#000',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    photoCaption: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    photoCaptionText: {
      color: colors.background.card,
      fontSize: 13,
      fontWeight: '500',
    },
    photoIndicators: {
      position: 'absolute',
      bottom: 50,
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
    morePhotosText: {
      color: colors.background.card,
      fontSize: 12,
      marginLeft: 6,
    },
    noPhotosPlaceholder: {
      height: 150,
      backgroundColor: colors.background.secondary,
      marginHorizontal: -16,
      marginBottom: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noPhotosEmoji: {
      fontSize: 48,
      marginBottom: 8,
    },
    noPhotosText: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    mealTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 12,
    },
    dishPreviewContainer: {
      marginBottom: 12,
    },
    courseSection: {
      marginBottom: 8,
    },
    courseLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    dishList: {
      paddingLeft: 8,
    },
    dishName: {
      fontSize: 14,
      color: colors.text.primary,
      marginBottom: 2,
    },
    moreText: {
      fontSize: 13,
      color: colors.text.tertiary,
      fontStyle: 'italic',
    },
    moreCourses: {
      fontSize: 13,
      color: colors.text.tertiary,
      fontStyle: 'italic',
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.background.secondary,
      marginTop: 4,
    },
    stat: {
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    statLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 30,
      backgroundColor: colors.border.medium,
    },
    likesSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      paddingBottom: 8,
      borderTopWidth: 1,
      borderTopColor: colors.background.secondary,
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
      paddingTop: 8,
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

  const renderPhotoCarousel = () => {
    if (allPhotos.length === 0) {
      // No photos - show placeholder
      return (
        <View style={styles.noPhotosPlaceholder}>
          <Text style={styles.noPhotosEmoji}>🍽️</Text>
          <Text style={styles.noPhotosText}>{meal.dish_count} dishes</Text>
        </View>
      );
    }

    return (
      <View style={styles.photoCarouselContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
            setPhotoIndex(index);
          }}
          scrollEventThrottle={16}
        >
          {allPhotos.slice(0, 5).map((photo, index) => (
            <View key={`photo-${index}`} style={styles.photoSlide}>
              <Image
                source={{ uri: photo.url }}
                style={styles.photoImage}
                resizeMode="cover"
              />
              <View style={styles.photoCaption}>
                <Text style={styles.photoCaptionText}>
                  {photo.dishTitle}
                  {photo.contributor ? ` · ${photo.contributor}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        
        {allPhotos.length > 1 && (
          <View style={styles.photoIndicators}>
            {allPhotos.slice(0, 5).map((_, index) => (
              <View
                key={`dot-${index}`}
                style={[
                  styles.indicator,
                  index === photoIndex && styles.indicatorActive
                ]}
              />
            ))}
            {allPhotos.length > 5 && (
              <Text style={styles.morePhotosText}>+{allPhotos.length - 5}</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderDishPreview = () => {
    // Show a compact preview of dishes grouped by course
    const nonEmptyCourses = courseOrder.filter(
      course => (groupedDishes.get(course)?.length || 0) > 0
    );

    if (nonEmptyCourses.length === 0) return null;

    return (
      <View style={styles.dishPreviewContainer}>
        {nonEmptyCourses.slice(0, 3).map(course => {
          const courseDishes = groupedDishes.get(course) || [];
          return (
            <View key={course} style={styles.courseSection}>
              <Text style={styles.courseLabel}>
                {getCourseDisplayName(course)}
              </Text>
              <View style={styles.dishList}>
                {courseDishes.slice(0, 2).map(dish => (
                  <Text key={dish.dish_id} style={styles.dishName} numberOfLines={1}>
                    • {dish.recipe_title || dish.dish_title}
                  </Text>
                ))}
                {courseDishes.length > 2 && (
                  <Text style={styles.moreText}>
                    +{courseDishes.length - 2} more
                  </Text>
                )}
              </View>
            </View>
          );
        })}
        {nonEmptyCourses.length > 3 && (
          <Text style={styles.moreCourses}>
            +{nonEmptyCourses.length - 3} more courses
          </Text>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={onPress ? 0.9 : 1}
    >
      {/* Header with participants */}
      <View style={styles.header}>
        <View style={styles.participantAvatars}>
          {visibleParticipants.slice(0, 3).map((p, index) => (
            <View 
              key={p.user_id} 
              style={[
                styles.avatar,
                index > 0 && styles.avatarOverlap,
              ]}
            >
              <Text style={styles.avatarEmoji}>
                {p.user_profile?.avatar_url || getAvatarEmoji(p.user_id)}
              </Text>
            </View>
          ))}
        </View>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerText}>{formatHeaderText()}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.mealIcon}>🍽️</Text>
            <Text style={styles.metaText}>
              {formatDate(meal.meal_time || meal.created_at)}
              {meal.meal_location && ` · ${meal.meal_location}`}
            </Text>
          </View>
        </View>

        {onMenu && (
          <TouchableOpacity style={styles.menuButton} onPress={onMenu}>
            <Text style={styles.menuButtonText}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Photo Carousel */}
      {renderPhotoCarousel()}

      {/* Meal Title */}
      <Text style={styles.mealTitle}>{meal.title}</Text>

      {/* Dish Preview */}
      {renderDishPreview()}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{meal.dish_count}</Text>
          <Text style={styles.statLabel}>
            {meal.dish_count === 1 ? 'dish' : 'dishes'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{meal.participant_count}</Text>
          <Text style={styles.statLabel}>
            {meal.participant_count === 1 ? 'person' : 'people'}
          </Text>
        </View>
      </View>

      {/* Likes Section */}
      {likeData && (likeData.likesText || likeData.commentCount) && (
        <View style={styles.likesSection}>
          {likeData.likesText && (
            <Text style={styles.likesText}>{likeData.likesText}</Text>
          )}
          {likeData.commentCount && likeData.commentCount > 0 && (
            <Text style={styles.commentsText}>
              {likeData.commentCount} comment{likeData.commentCount !== 1 ? 's' : ''}
            </Text>
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
    </TouchableOpacity>
  );
}