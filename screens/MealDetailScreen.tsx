// screens/MealDetailScreen.tsx
// Full screen view of a meal with all dishes and participants
// Created: December 2, 2025
// Updated: December 10, 2025 - Added edit meal functionality

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { colors } from '../lib/theme';
import {
  getMeal,
  getMealParticipants,
  getMealDishes,
  getMealPhotos,
  completeMeal,
  deleteMeal,
  checkIsHost,
  respondToInvitation,
  MealWithDetails,
  MealParticipant,
  DishInMeal,
  getCourseDisplayName,
  CourseType,
} from '../lib/services/mealService';
import { supabase } from '../lib/supabase';
import AddDishToMealModal from '../components/AddDishToMealModal';
import AddMealParticipantsModal from '../components/AddMealParticipantsModal';
import MealPlanSection from '../components/MealPlanSection';
import AddPlanItemModal from '../components/AddPlanItemModal';
import EditMealModal from '../components/EditMealModal';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MealDetailScreenProps {
  navigation: any;
  route: {
    params: {
      mealId: string;
      currentUserId: string;
    };
  };
}

export default function MealDetailScreen({ navigation, route }: MealDetailScreenProps) {
  const { mealId, currentUserId } = route.params;
  
  const [meal, setMeal] = useState<MealWithDetails | null>(null);
  const [participants, setParticipants] = useState<MealParticipant[]>([]);
  const [dishes, setDishes] = useState<DishInMeal[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRsvpStatus, setMyRsvpStatus] = useState<string | null>(null);
  
  // Modals
  const [showAddDishes, setShowAddDishes] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [showAddPlanItem, setShowAddPlanItem] = useState(false);
  const [showEditMeal, setShowEditMeal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadMealData();
  }, [mealId]);

  const loadMealData = async () => {
    try {
      const [mealData, participantsData, dishesData, photosData, hostStatus] = await Promise.all([
        getMeal(mealId),
        getMealParticipants(mealId),
        getMealDishes(mealId),
        getMealPhotos(mealId),
        checkIsHost(mealId, currentUserId),
      ]);

      setMeal(mealData);
      setParticipants(participantsData);
      setDishes(dishesData);
      setPhotos(photosData);
      setIsHost(hostStatus);

      // Check current user's RSVP status
      const { data: myParticipant } = await supabase
        .from('meal_participants')
        .select('rsvp_status')
        .eq('meal_id', mealId)
        .eq('user_id', currentUserId)
        .single();

      setMyRsvpStatus(myParticipant?.rsvp_status || null);
    } catch (error) {
      console.error('Error loading meal:', error);
      Alert.alert('Error', 'Failed to load meal');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMealData();
    setRefreshing(false);
  }, [mealId]);

  const handleRespondToInvitation = async (response: 'accepted' | 'maybe' | 'declined') => {
    try {
      const result = await respondToInvitation(mealId, currentUserId, response);
      if (result.success) {
        setMyRsvpStatus(response);
        await loadMealData();
        if (response === 'accepted') {
          Alert.alert('Accepted!', 'You can now claim items and add dishes to this meal.');
        } else if (response === 'maybe') {
          Alert.alert('Maybe', 'You\'ve responded maybe to this meal.');
        } else {
          Alert.alert('Declined', 'You\'ve declined this invitation.');
          navigation.goBack();
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to respond');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const handleCompleteMeal = async () => {
    Alert.alert(
      'Complete Meal',
      'Mark this meal as complete? It will appear in the feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            const result = await completeMeal(mealId, currentUserId);
            if (result.success) {
              await loadMealData();
              Alert.alert('Success', 'Meal completed and posted to feed!');
            } else {
              Alert.alert('Error', result.error || 'Failed to complete meal');
            }
          },
        },
      ]
    );
  };

  const handleDeleteMeal = () => {
    Alert.alert(
      'Delete Meal',
      'Are you sure? Dishes will remain as standalone posts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteMeal(mealId, currentUserId);
            if (result.success) {
              navigation.goBack();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete meal');
            }
          },
        },
      ]
    );
  };

  const handleSelectRecipeForPlanItem = (planItemId: string) => {
    // TODO: Navigate to recipe selection screen with planItemId
    Alert.alert('Coming Soon', 'Recipe selection for plan items will be available soon!');
  };

const handleCookPlanItem = async (planItemId: string, recipeId?: string) => {
  if (!recipeId) {
    Alert.alert('No Recipe', 'Add a recipe first before cooking.');
    return;
  }

  try {
    // Fetch the recipe to pass as object (RecipeDetailScreen expects recipe object)
    const { data: recipeData, error } = await supabase
      .from('recipes')
      .select('id, title, description, image_url, recipe_type, prep_time_min, cook_time_min')
      .eq('id', recipeId)
      .single();

    if (error || !recipeData) {
      Alert.alert('Error', 'Could not load recipe');
      return;
    }

    // Navigate to RecipeDetailScreen with meal plan context
    navigation.navigate('RecipesStack', {
      screen: 'RecipeDetail',
      params: { 
        recipe: recipeData,
        planItemId: planItemId,
        mealId: mealId,
        mealTitle: meal?.title,
      },
    });
  } catch (error) {
    console.error('Error navigating to cook:', error);
    Alert.alert('Error', 'Could not start cooking');
  }
};

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    return date.toLocaleDateString('en-US', options);
  };

  const getAvatarEmoji = (userId: string): string => {
    const emojis = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🍕', '🌮', '🍔', '🍜', '🥘'];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return emojis[hash % emojis.length];
  };

  // Group dishes by course
  const groupedDishes = new Map<CourseType, DishInMeal[]>();
  const courseOrder: CourseType[] = ['appetizer', 'main', 'side', 'dessert', 'drink', 'other'];
  courseOrder.forEach(course => groupedDishes.set(course, []));
  dishes.forEach(dish => {
    const group = groupedDishes.get(dish.course_type) || groupedDishes.get('other')!;
    group.push(dish);
  });

  // Check if current user is an accepted participant
  const isAcceptedParticipant = myRsvpStatus === 'accepted';
  
  // Get accepted participants for MealPlanSection
  const acceptedParticipantsForPlan = participants
    .filter(p => p.rsvp_status === 'accepted')
    .map(p => ({
      user_id: p.user_id,
      display_name: p.user_profile?.display_name,
      username: p.user_profile?.username || '',
      avatar_url: p.user_profile?.avatar_url,
      role: p.role,
      rsvp_status: p.rsvp_status,
    }));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Meal not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const acceptedParticipants = participants.filter(p => p.rsvp_status === 'accepted');
  const pendingParticipants = participants.filter(p => p.rsvp_status === 'pending');
  const maybeParticipants = participants.filter(p => p.rsvp_status === 'maybe');

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Image/Placeholder */}
        <View style={styles.headerImage}>
          {photos.length > 0 ? (
            <Image
              source={{ uri: photos[0].photo_url }}
              style={styles.headerImageContent}
              resizeMode="cover"
            />
          ) : dishes.length > 0 && dishes[0].dish_photos?.[0] ? (
            <Image
              source={{ uri: dishes[0].dish_photos[0].url }}
              style={styles.headerImageContent}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.headerPlaceholder}>
              <Text style={styles.headerEmoji}>🍽️</Text>
            </View>
          )}
          
          {/* Status Badge */}
          <View style={[
            styles.statusBadge,
            meal.meal_status === 'completed' ? styles.statusCompleted : styles.statusPlanning
          ]}>
            <Text style={styles.statusText}>
              {meal.meal_status === 'completed' ? '✓ Completed' : '📝 Planning'}
            </Text>
          </View>
        </View>

        {/* Meal Info */}
        <View style={styles.mealInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.mealTitle}>{meal.title}</Text>
            {isHost && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setShowEditMeal(true)}
              >
                <Text style={styles.editButtonText}>✏️ Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📅</Text>
            <Text style={styles.metaText}>
              {meal.meal_time ? formatDate(meal.meal_time) : 'Date not set'}
            </Text>
            {isHost && !meal.meal_time && (
              <TouchableOpacity
                style={styles.setDateButton}
                onPress={() => setShowEditMeal(true)}
              >
                <Text style={styles.setDateButtonText}>Set date</Text>
              </TouchableOpacity>
            )}
          </View>

          {meal.meal_location && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>📍</Text>
              <Text style={styles.metaText}>{meal.meal_location}</Text>
            </View>
          )}

          {meal.description && (
            <Text style={styles.description}>{meal.description}</Text>
          )}
        </View>

        {/* Invitation Banner (if pending) */}
        {myRsvpStatus === 'pending' && (
          <View style={styles.invitationBanner}>
            <Text style={styles.invitationText}>You're invited to this meal!</Text>
            <View style={styles.invitationButtons}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => handleRespondToInvitation('declined')}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.maybeButton}
                onPress={() => handleRespondToInvitation('maybe')}
              >
                <Text style={styles.maybeButtonText}>Maybe</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleRespondToInvitation('accepted')}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Maybe Status Banner */}
        {myRsvpStatus === 'maybe' && (
          <View style={styles.maybeBanner}>
            <Text style={styles.maybeStatusText}>You responded "maybe" to this meal</Text>
            <View style={styles.invitationButtons}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => handleRespondToInvitation('declined')}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleRespondToInvitation('accepted')}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{dishes.length}</Text>
            <Text style={styles.statLabel}>Dishes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{acceptedParticipants.length}</Text>
            <Text style={styles.statLabel}>Going</Text>
          </View>
          {pendingParticipants.length > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{pendingParticipants.length}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </>
          )}
        </View>

        {/* Meal Plan Section (only for planning meals) */}
        {meal.meal_status === 'planning' && (
          <MealPlanSection
            mealId={mealId}
            currentUserId={currentUserId}
            isHost={isHost}
            isAcceptedParticipant={isAcceptedParticipant}
            onAddPlanItem={() => setShowAddPlanItem(true)}
            onSelectRecipe={handleSelectRecipeForPlanItem}
            onCookItem={handleCookPlanItem}
            participants={acceptedParticipantsForPlan}
          />
        )}

        {/* Participants Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Who's Coming</Text>
            {isHost && meal.meal_status === 'planning' && (
              <TouchableOpacity onPress={() => setShowAddParticipants(true)}>
                <Text style={styles.addButton}>+ Invite</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Accepted */}
          {acceptedParticipants.length > 0 && (
            <View style={styles.participantGroup}>
              <Text style={styles.groupLabel}>Going ({acceptedParticipants.length})</Text>
              {acceptedParticipants.map(p => (
                <View key={p.user_id} style={styles.participantItem}>
                  <View style={styles.participantAvatar}>
                    <Text style={styles.participantAvatarText}>
                      {p.user_profile?.avatar_url || getAvatarEmoji(p.user_id)}
                    </Text>
                  </View>
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>
                      {p.user_profile?.display_name || p.user_profile?.username}
                    </Text>
                    {p.role === 'host' && (
                      <Text style={styles.participantMeta}>Host</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Maybe */}
          {maybeParticipants.length > 0 && (
            <View style={styles.participantGroup}>
              <Text style={styles.groupLabel}>Maybe ({maybeParticipants.length})</Text>
              {maybeParticipants.map(p => (
                <View key={p.user_id} style={[styles.participantItem, styles.participantMaybe]}>
                  <View style={[styles.participantAvatar, styles.avatarMaybe]}>
                    <Text style={styles.participantAvatarText}>
                      {p.user_profile?.avatar_url || getAvatarEmoji(p.user_id)}
                    </Text>
                  </View>
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantNameMaybe}>
                      {p.user_profile?.display_name || p.user_profile?.username}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Pending */}
          {pendingParticipants.length > 0 && (
            <View style={styles.participantGroup}>
              <Text style={styles.groupLabel}>Invited ({pendingParticipants.length})</Text>
              {pendingParticipants.map(p => (
                <View key={p.user_id} style={[styles.participantItem, styles.participantPending]}>
                  <View style={[styles.participantAvatar, styles.avatarPending]}>
                    <Text style={styles.participantAvatarText}>
                      {p.user_profile?.avatar_url || getAvatarEmoji(p.user_id)}
                    </Text>
                  </View>
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantNamePending}>
                      {p.user_profile?.display_name || p.user_profile?.username}
                    </Text>
                    <Text style={styles.participantMeta}>Awaiting response</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Dishes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dishes</Text>
            {(isHost || isAcceptedParticipant) && meal.meal_status === 'planning' && (
              <TouchableOpacity onPress={() => setShowAddDishes(true)}>
                <Text style={styles.addButton}>+ Add Dish</Text>
              </TouchableOpacity>
            )}
          </View>

          {dishes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🍽️</Text>
              <Text style={styles.emptyText}>No dishes added yet</Text>
              {(isHost || isAcceptedParticipant) && meal.meal_status === 'planning' && (
                <TouchableOpacity 
                  style={styles.ctaButton}
                  onPress={() => setShowAddDishes(true)}
                >
                  <Text style={styles.ctaButtonText}>Add Your Dishes</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {courseOrder.map(course => {
                const courseDishes = groupedDishes.get(course) || [];
                if (courseDishes.length === 0) return null;
                
                return (
                  <View key={course} style={styles.courseSection}>
                    <Text style={styles.courseLabel}>
                      {getCourseDisplayName(course)} ({courseDishes.length})
                    </Text>
                    {courseDishes.map(dish => (
                      <TouchableOpacity
                        key={dish.dish_id}
                        style={styles.dishCard}
                        onPress={() => {
                          // Navigate to dish/post detail
                          // TODO: Implement navigation
                        }}
                      >
                        <View style={styles.dishImageContainer}>
                          {dish.dish_photos?.[0]?.url || dish.recipe_image_url ? (
                            <Image
                              source={{ uri: dish.dish_photos?.[0]?.url || dish.recipe_image_url }}
                              style={styles.dishImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.dishImagePlaceholder}>
                              <Text style={styles.dishImageEmoji}>🍽️</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.dishInfo}>
                          <Text style={styles.dishTitle} numberOfLines={1}>
                            {dish.recipe_title || dish.dish_title}
                          </Text>
                          <Text style={styles.dishContributor}>
                            by {dish.contributor_display_name || dish.contributor_username}
                          </Text>
                          {dish.dish_rating && (
                            <Text style={styles.dishRating}>
                              {'⭐'.repeat(dish.dish_rating)}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.dishArrow}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      {isHost && meal.meal_status === 'planning' && (
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleDeleteMeal}
          >
            <Text style={styles.secondaryButtonText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleCompleteMeal}
          >
            <Text style={styles.primaryButtonText}>Complete Meal</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals */}
      <AddDishToMealModal
        visible={showAddDishes}
        onClose={() => setShowAddDishes(false)}
        mealId={mealId}
        mealTitle={meal.title}
        currentUserId={currentUserId}
        onDishesAdded={loadMealData}
      />

      <AddMealParticipantsModal
        visible={showAddParticipants}
        onClose={() => setShowAddParticipants(false)}
        mealId={mealId}
        mealTitle={meal.title}
        currentUserId={currentUserId}
        onInvitesSent={loadMealData}
      />

      <AddPlanItemModal
        visible={showAddPlanItem}
        onClose={() => setShowAddPlanItem(false)}
        mealId={mealId}
        mealTitle={meal.title}
        currentUserId={currentUserId}
        onItemsAdded={loadMealData}
        participants={acceptedParticipantsForPlan}
      />

      <EditMealModal
        visible={showEditMeal}
        onClose={() => setShowEditMeal(false)}
        onSuccess={loadMealData}
        mealId={mealId}
        currentUserId={currentUserId}
        initialValues={{
          title: meal.title,
          description: meal.description,
          meal_type: meal.meal_type,
          meal_time: meal.meal_time,
          meal_location: meal.meal_location,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  headerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.6,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  headerImageContent: {
    width: '100%',
    height: '100%',
  },
  headerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 80,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPlanning: {
    backgroundColor: '#FEF3C7',
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  mealInfo: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  mealTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    flex: 1,
    marginRight: 12,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  metaText: {
    fontSize: 15,
    color: '#6B7280',
    flex: 1,
  },
  setDateButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginLeft: 8,
  },
  setDateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  description: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginTop: 12,
  },
  // Invitation Banner Styles
  invitationBanner: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  invitationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 12,
  },
  invitationButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  declineButtonText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  maybeButton: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D97706',
  },
  maybeButtonText: {
    color: '#D97706',
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  maybeBanner: {
    backgroundColor: '#FEF9C3',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  maybeStatusText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#854D0E',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    marginHorizontal: 20,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  section: {
    padding: 20,
    borderTopWidth: 8,
    borderTopColor: '#F3F4F6',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  addButton: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  participantGroup: {
    marginBottom: 16,
  },
  groupLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  participantPending: {
    opacity: 0.6,
  },
  participantMaybe: {
    opacity: 0.8,
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFE5D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarPending: {
    backgroundColor: '#E5E7EB',
  },
  avatarMaybe: {
    backgroundColor: '#FEF3C7',
  },
  participantAvatarText: {
    fontSize: 22,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  participantNamePending: {
    fontSize: 16,
    color: '#6B7280',
  },
  participantNameMaybe: {
    fontSize: 16,
    color: '#92400E',
  },
  participantMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  courseSection: {
    marginBottom: 20,
  },
  courseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  dishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  dishImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  dishImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dishImageEmoji: {
    fontSize: 28,
  },
  dishInfo: {
    flex: 1,
  },
  dishTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  dishContributor: {
    fontSize: 13,
    color: '#6B7280',
  },
  dishRating: {
    fontSize: 12,
    marginTop: 4,
  },
  dishArrow: {
    fontSize: 24,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  primaryButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});