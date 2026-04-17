// screens/MealDetailScreen.tsx
// Full screen view of a meal with all dishes and participants
// Created: December 2, 2025
// Updated: December 10, 2025 - Added edit meal functionality

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  TextInput,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
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
import {
  computeHighlightsListForDetailCard,
  Highlight,
} from '../lib/services/highlightsService';
import {
  getCommentsForMeal,
  Comment as PostComment,
  DishLevelComment,
} from '../lib/services/commentsService';
import { computeMealVibe, VibeTag } from '../lib/services/vibeService';
import { optimizeStorageUrl } from '../components/feedCard/sharedCardElements';

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
  const { colors, functionalColors } = useTheme();

  const [meal, setMeal] = useState<MealWithDetails | null>(null);
  const [participants, setParticipants] = useState<MealParticipant[]>([]);
  const [dishes, setDishes] = useState<DishInMeal[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRsvpStatus, setMyRsvpStatus] = useState<string | null>(null);

  // F1++++ additions (Phase 7F Checkpoint 4)
  const [highlights, setHighlights] = useState<{ author: Highlight[]; viewer: Highlight[] }>({
    author: [],
    viewer: [],
  });
  const [mealVibe, setMealVibe] = useState<VibeTag | null>(null);
  const [mealLevelComments, setMealLevelComments] = useState<PostComment[]>([]);
  const [dishLevelComments, setDishLevelComments] = useState<DishLevelComment[]>([]);
  const [newMealComment, setNewMealComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  // Gap Analysis Fix 13 — hero carousel page index.
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);

  // Modals
  const [showAddDishes, setShowAddDishes] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [showAddPlanItem, setShowAddPlanItem] = useState(false);
  const [showEditMeal, setShowEditMeal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.card,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      padding: 20,
    },
    errorText: {
      fontSize: 18,
      color: colors.text.secondary,
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
      backgroundColor: colors.background.secondary,
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
      color: colors.text.primary,
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
      color: colors.text.primary,
      flex: 1,
      marginRight: 12,
    },
    editButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
    },
    editButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text.primary,
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
      color: colors.text.secondary,
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
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 20,
      marginTop: 8,
      marginBottom: 4,
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
      color: functionalColors.error,
      fontWeight: '600',
    },
    maybeButton: {
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: functionalColors.warning,
    },
    maybeButtonText: {
      color: functionalColors.warning,
      fontWeight: '600',
    },
    acceptButton: {
      backgroundColor: functionalColors.success,
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
    // Gap Analysis Fix 6 — match feed card StatsRow layout: label on top,
    // value below, no vertical dividers, gap:20 between items.
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 20,
    },
    stat: {
      flexDirection: 'column',
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: '#999999',
      marginBottom: 2,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.1,
      lineHeight: 21,
      color: colors.text.primary,
    },
    statDivider: {
      display: 'none',
      width: 0,
      height: 0,
    },
    section: {
      padding: 20,
      borderTopWidth: 8,
      borderTopColor: colors.background.secondary,
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
      color: colors.text.primary,
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
      color: colors.text.secondary,
      fontWeight: '500',
      marginBottom: 8,
    },
    participantItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.background.secondary,
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
      backgroundColor: colors.border.medium,
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
      color: colors.text.primary,
    },
    participantNamePending: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    participantNameMaybe: {
      fontSize: 16,
      color: '#92400E',
    },
    participantMeta: {
      fontSize: 13,
      color: colors.text.secondary,
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
      color: colors.text.secondary,
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
    // Gap Analysis Fix 10 — small uppercase course label, no count.
    courseLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.primary,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    dishCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    },
    // Gap Analysis Fix 8 — compact dish row per wireframe.
    dishImageContainer: {
      width: 48,
      height: 48,
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
      backgroundColor: colors.border.medium,
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
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 2,
    },
    dishContributor: {
      fontSize: 11,
      color: colors.text.secondary,
    },
    dishRating: {
      fontSize: 11,
      color: colors.text.secondary,
      marginTop: 2,
    },
    dishArrow: {
      fontSize: 14,
      color: colors.text.tertiary,
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
      backgroundColor: colors.background.card,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      gap: 12,
    },
    secondaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border.medium,
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
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
    // ── F1++++ additions ──
    vibePillContainer: {
      flexDirection: 'row',
      marginTop: 10,
    },
    vibePill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: '#f5f0e0',
      borderWidth: 0.5,
      borderColor: '#e8dfc4',
    },
    vibePillText: {
      fontSize: 11,
      fontWeight: '500',
      color: '#7a6a3e',
    },
    startedByText: {
      marginTop: 8,
      fontSize: 11,
      fontStyle: 'italic',
      color: colors.text.tertiary,
    },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      gap: 8,
    },
    highlightInlinePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 0.5,
      flexShrink: 0,
      maxWidth: '60%',
    },
    // Gap Analysis Fix 11 — align pill colors with feed-card HighlightsPill
    // palette. Author = --teal-50/100/900. Viewer = sand/gold.
    highlightInlinePillAuthor: {
      backgroundColor: '#E1F5EE',
      borderColor: '#C6ECDD',
    },
    highlightInlinePillViewer: {
      backgroundColor: '#f5f0e0',
      borderColor: '#e8dfc4',
    },
    highlightInlinePillText: {
      fontSize: 12,
      fontWeight: '600',
    },
    highlightInlinePillTextAuthor: { color: '#04342C' },
    highlightInlinePillTextViewer: { color: '#7a6a3e' },
    highlightDescText: {
      fontSize: 12,
      color: colors.text.tertiary,
      flexShrink: 1,
    },
    // Gap Analysis Fix 12 — thin separator, not thick gap.
    forYouSection: {
      padding: 20,
      borderTopWidth: 0.5,
      borderTopColor: '#ebe8df',
      backgroundColor: '#faf7ee',
    },
    // Gap Analysis Fix 9 — small uppercase section label, not a heading.
    forYouTitle: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.66,
      color: '#7a6a3e',
      marginBottom: 2,
    },
    forYouSub: {
      fontSize: 11,
      color: '#a89878',
      fontStyle: 'italic',
      marginBottom: 8,
    },
    forYouDescText: {
      fontSize: 12,
      color: '#a89878',
      flexShrink: 1,
    },
    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 6,
    },
    commentAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentAvatarText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    commentBody: {
      flex: 1,
    },
    commentHeader: {
      fontSize: 12,
      color: colors.text.primary,
    },
    commentHeaderName: {
      fontWeight: '700',
    },
    commentHeaderTime: {
      color: colors.text.tertiary,
      fontWeight: '400',
    },
    commentText: {
      fontSize: 12,
      color: colors.text.secondary,
      marginTop: 2,
      lineHeight: 17,
    },
    dishChip: {
      fontSize: 10,
      backgroundColor: '#ccfbf1',
      color: '#134e4a',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
      marginLeft: 4,
      overflow: 'hidden',
    },
    composeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.background.secondary,
    },
    composeInput: {
      flex: 1,
      backgroundColor: colors.background.secondary,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.text.primary,
    },
    composeSubmit: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    composeSubmitText: {
      fontSize: 13,
      fontWeight: '600',
      color: 'white',
    },
    composeSubmitDisabled: {
      opacity: 0.4,
    },
    emptyCommentText: {
      fontSize: 13,
      color: colors.text.tertiary,
      fontStyle: 'italic',
      paddingVertical: 8,
    },
  }), [colors, functionalColors]);

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

      // F1++++ additions — load highlights, comments, vibe in parallel.
      // Failures here should not block the core screen render.
      try {
        const [highlightsData, commentsData, vibeData] = await Promise.all([
          computeHighlightsListForDetailCard(mealId, currentUserId),
          getCommentsForMeal(mealId),
          computeMealVibe(mealId),
        ]);

        // Belt-and-suspenders privacy check: if the current viewer is the host,
        // the For You section is not shown regardless of what the service
        // returned. The service also returns its own pantry/cuisine data which
        // we suppress at render time when viewerId === host.
        const isOwnMeal =
          mealData?.user_id === currentUserId ||
          mealData?.host_id === currentUserId;
        setHighlights({
          author: highlightsData.author,
          viewer: isOwnMeal ? [] : highlightsData.viewer,
        });
        setMealLevelComments(commentsData.mealLevel);
        setDishLevelComments(commentsData.dishLevel);
        setMealVibe(vibeData);
      } catch (e) {
        console.error('Error loading F1++++ data:', e);
      }
    } catch (error) {
      console.error('Error loading meal:', error);
      Alert.alert('Error', 'Failed to load meal');
    } finally {
      setLoading(false);
    }
  };

  // ── F1++++ helpers ────────────────────────────────────────────────────────

  /**
   * Map highlight signal identifiers to human-readable descriptions shown
   * beside the pill on the detail card. Graceful fallback: when a signal is
   * unknown, we surface an empty string so the pill still renders alone.
   */
  const getHighlightDescription = (signal: string, text: string): string => {
    switch (signal) {
      case 'first_cook':
        return 'first time cooking this recipe';
      case 'cooked_n_this_month':
        return 'already a staple this month';
      case 'cooked_n_this_year':
        return 'a repeat favorite this year';
      case 'cooking_with_new':
        return 'first time cooking with this person';
      case 'first_potluck':
        return 'first meal with 3+ cooks';
      case 'biggest_meal_yet':
        return 'most dishes in a meal for this host';
      case 'first_cuisine':
        return 'new cuisine for this host';
      case 'pantry_match':
        return 'high overlap with your pantry tonight';
      case 'cuisine_match':
        return 'matches the cuisine you cook most';
      default:
        return text; // graceful fallback
    }
  };

  /**
   * Render comment text with inline @-mentions styled in teal.
   * P7-36 tracks the actual mention parser + notifications — this renderer is
   * presentation-only for 7F. No validation, no user lookups, no side effects.
   */
  const renderCommentText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@[A-Za-z0-9_]+)/g);
    return parts.map((part, idx) => {
      if (/^@[A-Za-z0-9_]+$/.test(part)) {
        return (
          <Text key={idx} style={{ color: '#0f766e', fontWeight: '600' }}>
            {part}
          </Text>
        );
      }
      return <Text key={idx}>{part}</Text>;
    });
  };

  const formatRelativeTime = (iso: string): string => {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const min = Math.round(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h`;
    const d = Math.round(hr / 24);
    if (d < 7) return `${d}d`;
    const w = Math.round(d / 7);
    if (w < 5) return `${w}w`;
    const mo = Math.round(d / 30);
    return `${mo}mo`;
  };

  const handlePostMealLevelComment = async () => {
    const text = newMealComment.trim();
    if (!text || postingComment) return;
    setPostingComment(true);
    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: mealId,
          user_id: currentUserId,
          comment_text: text,
        });
      if (error) throw error;
      setNewMealComment('');
      // Refetch meal-level + dish-level so counts/order stay consistent
      const fresh = await getCommentsForMeal(mealId);
      setMealLevelComments(fresh.mealLevel);
      setDishLevelComments(fresh.dishLevel);
    } catch (err) {
      console.error('Error posting comment:', err);
      Alert.alert('Error', 'Could not post comment');
    } finally {
      setPostingComment(false);
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

  // Gap Analysis Fix 7 — deterministic color for comment-avatar initial circles.
  const commentAvatarColor = (seed: string): string => {
    const palette = [
      '#0d9488', '#f59e0b', '#ef4444', '#6366f1',
      '#10b981', '#ec4899', '#8b5cf6', '#14b8a6',
    ];
    const hash = (seed || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return palette[hash % palette.length];
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

  // ── F1++++ derived stats ──
  const cookCount = (() => {
    const unique = new Set<string>();
    for (const d of dishes) {
      if (d.dish_user_id) unique.add(d.dish_user_id);
    }
    // Fall back to at least 1 (the host) when we have no dishes yet
    return unique.size || 1;
  })();

  const totalCookTimeMin = dishes.reduce(
    (sum, d) => sum + (d.recipe_cook_time_min ?? 0),
    0
  );

  const formatMealTime = (min: number): string => {
    if (!min) return '—';
    if (min < 60) return `${min}m`;
    const hours = Math.floor(min / 60);
    const rem = min % 60;
    return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
  };

  const ratedDishes = dishes.filter(d => typeof d.dish_rating === 'number' && (d.dish_rating || 0) > 0);
  const averageRating =
    ratedDishes.length > 0
      ? (ratedDishes.reduce((s, d) => s + (d.dish_rating || 0), 0) / ratedDishes.length)
      : null;

  const hostDisplayName =
    meal.host_profile?.display_name || meal.host_profile?.username || 'Host';
  const invitedCount = acceptedParticipants.length + pendingParticipants.length + maybeParticipants.length;

  const isOwnMeal = currentUserId === meal.user_id || currentUserId === (meal as any).host_id;
  const showForYou = !isOwnMeal && highlights.viewer.length > 0;

  // Gap Analysis Fix 13 — D46 cascade hero carousel. meal_photos → dish
  // photos → recipe stock photo fallback → static placeholder.
  const heroPhotos: { url: string; isRecipe?: boolean }[] = [];
  if (photos.length > 0) {
    photos.forEach(p => heroPhotos.push({ url: p.photo_url }));
  } else {
    const dishPhotoUrls = dishes.flatMap(d =>
      (d.dish_photos || []).map((p: any) => ({ url: p.url }))
    );
    if (dishPhotoUrls.length > 0) {
      heroPhotos.push(...dishPhotoUrls);
    } else {
      const recipeDish = dishes.find(
        d => typeof d.recipe_image_url === 'string' && d.recipe_image_url.trim() !== ''
      );
      if (recipeDish?.recipe_image_url) {
        heroPhotos.push({ url: recipeDish.recipe_image_url.trim(), isRecipe: true });
      }
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Image/Placeholder — Gap Analysis Fix 13: swipeable carousel */}
        <View style={styles.headerImage}>
          {heroPhotos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              nestedScrollEnabled
              scrollEnabled
              directionalLockEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const idx = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH
                );
                setHeroPhotoIndex(idx);
              }}
              scrollEventThrottle={16}
              decelerationRate="fast"
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.6 }}
            >
              {heroPhotos.map((photo, idx) => (
                <Image
                  key={`hero-${idx}`}
                  source={{ uri: optimizeStorageUrl(photo.url, 2000, 60) }}
                  style={{
                    width: SCREEN_WIDTH,
                    height: SCREEN_WIDTH * 0.6,
                  }}
                  resizeMode="cover"
                  fadeDuration={0}
                  onError={(e) =>
                    console.warn(
                      'MealDetailScreen hero image load error:',
                      photo.url,
                      e.nativeEvent?.error
                    )
                  }
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.headerPlaceholder}>
              <Text style={styles.headerEmoji}>🍽️</Text>
            </View>
          )}

          {/* Dot indicators for multi-photo hero */}
          {heroPhotos.length > 1 && (
            <View
              style={{
                position: 'absolute',
                bottom: 10,
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {heroPhotos.map((_, idx) => (
                <View
                  key={`hero-dot-${idx}`}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      idx === heroPhotoIndex
                        ? 'rgba(255,255,255,0.95)'
                        : 'rgba(255,255,255,0.45)',
                  }}
                />
              ))}
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

        {/* Stats Row — F1++++: Dishes / Cooks / Time / Rating (Gap Fix 6: label above value, no dividers) */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Dishes</Text>
            <Text style={styles.statValue}>{dishes.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Cooks</Text>
            <Text style={styles.statValue}>{cookCount}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>{formatMealTime(totalCookTimeMin)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Rating</Text>
            <Text style={styles.statValue}>
              {averageRating !== null ? `★ ${averageRating.toFixed(1)}` : '—'}
            </Text>
          </View>
        </View>

        {/* Vibe pill + "started by" footnote (F1++++ title section) */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          {mealVibe && (
            <View style={styles.vibePillContainer}>
              <View style={styles.vibePill}>
                <Text style={styles.vibePillText}>
                  {mealVibe.emoji} {mealVibe.label}
                </Text>
              </View>
            </View>
          )}
          <Text style={styles.startedByText}>
            started by {hostDisplayName}
            {invitedCount > 0 ? ` · ${invitedCount} ${invitedCount === 1 ? 'person' : 'people'} invited` : ''}
          </Text>
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

        {/* Participants moved down per F1++++ section order */}

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
                      {getCourseDisplayName(course)}
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
                          {dish.dish_rating ? (
                            <Text style={styles.dishRating}>
                              ★{dish.dish_rating.toFixed(1)}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.dishArrow}>{'\u203A'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Highlights Section (F1++++) — author-side signals */}
        {highlights.author.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Highlights · {highlights.author.length}
            </Text>
            <View style={{ marginTop: 12 }}>
              {highlights.author.map((h, i) => (
                <View key={`author-${i}`} style={styles.highlightRow}>
                  <View style={[styles.highlightInlinePill, styles.highlightInlinePillAuthor]}>
                    <Text
                      style={[
                        styles.highlightInlinePillText,
                        styles.highlightInlinePillTextAuthor,
                      ]}
                      numberOfLines={1}
                    >
                      {h.text}
                    </Text>
                  </View>
                  <Text style={styles.highlightDescText} numberOfLines={1}>
                    — {getHighlightDescription(h.signal, h.text)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* For You Section (F1++++) — viewer-side signals. Hidden when
            viewer is the host (belt-and-suspenders privacy). */}
        {showForYou && (
          <View style={styles.forYouSection}>
            <Text style={styles.forYouTitle}>For you</Text>
            <Text style={styles.forYouSub}>
              Personal to you · the cook does not see this · color provisional
            </Text>
            <View>
              {highlights.viewer.map((h, i) => (
                <View key={`viewer-${i}`} style={styles.highlightRow}>
                  <View style={[styles.highlightInlinePill, styles.highlightInlinePillViewer]}>
                    <Text
                      style={[
                        styles.highlightInlinePillText,
                        styles.highlightInlinePillTextViewer,
                      ]}
                      numberOfLines={1}
                    >
                      {h.text}
                    </Text>
                  </View>
                  <Text style={styles.forYouDescText} numberOfLines={1}>
                    — {getHighlightDescription(h.signal, h.text)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Comments on this meal (F1++++, D41) — meal-level only */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Comments on this meal · {mealLevelComments.length}
          </Text>

          {mealLevelComments.length === 0 ? (
            <Text style={styles.emptyCommentText}>No comments yet</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {mealLevelComments.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <View
                    style={[
                      styles.commentAvatar,
                      { backgroundColor: commentAvatarColor(c.user_name || c.user_id) },
                    ]}
                  >
                    <Text style={styles.commentAvatarText}>
                      {((c.user_name || '?')[0] || '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentBody}>
                    <Text style={styles.commentHeader}>
                      <Text style={styles.commentHeaderName}>{c.user_name || 'Someone'}</Text>
                      <Text style={styles.commentHeaderTime}>
                        {' · ' + formatRelativeTime(c.created_at)}
                      </Text>
                    </Text>
                    <Text style={styles.commentText}>
                      {renderCommentText(c.comment_text)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Compose input — always available, even when zero comments */}
          <View style={styles.composeRow}>
            <TextInput
              style={styles.composeInput}
              placeholder="Add a comment on this meal..."
              placeholderTextColor={colors.text.tertiary}
              value={newMealComment}
              onChangeText={setNewMealComment}
              editable={!postingComment}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.composeSubmit,
                (!newMealComment.trim() || postingComment) && styles.composeSubmitDisabled,
              ]}
              onPress={handlePostMealLevelComment}
              disabled={!newMealComment.trim() || postingComment}
            >
              <Text style={styles.composeSubmitText}>
                {postingComment ? '...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Comments on individual dishes (F1++++, D41) */}
        {dishLevelComments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Comments on individual dishes · {dishLevelComments.length}
            </Text>
            <View style={{ marginTop: 8 }}>
              {dishLevelComments.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <View
                    style={[
                      styles.commentAvatar,
                      { backgroundColor: commentAvatarColor(c.user_name || c.user_id) },
                    ]}
                  >
                    <Text style={styles.commentAvatarText}>
                      {((c.user_name || '?')[0] || '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentBody}>
                    <Text style={styles.commentHeader}>
                      <Text style={styles.commentHeaderName}>{c.user_name || 'Someone'}</Text>
                      <Text style={styles.commentHeaderTime}>
                        {' · ' + formatRelativeTime(c.created_at)}
                      </Text>
                      <Text style={styles.dishChip}> on {c.dish_title}</Text>
                    </Text>
                    <Text style={styles.commentText}>
                      {renderCommentText(c.comment_text)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Participants Section — moved below comments per F1++++ */}
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
