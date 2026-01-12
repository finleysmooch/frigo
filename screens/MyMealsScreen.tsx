// screens/MyMealsScreen.tsx
// Screen showing user's meals (planning and completed) with list and calendar views
// Created: December 3, 2025
// Updated: December 10, 2025 - Combined Month/Week/List toggle, fixed timezone, added dish/plan item details
// Updated: December 10, 2025 - Added Cook Soon tab and recipe selection flow for CreateMealModal

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { MealWithDetails, getMealDishes, DishInMeal, CourseType } from '../lib/services/mealService';
import { getMealPlanSummary, getMealPlanItems, MealPlanSummary, MealPlanItem } from '../lib/services/mealPlanService';
import { getRecipesWithTag } from '../lib/services/userRecipeTagsService';
import CreateMealModal from '../components/CreateMealModal';
import MealCalendarView from '../components/MealCalendarView';
import CookSoonSection from '../components/CookSoonSection';
import { MealsStackParamList } from '../App';

type Props = NativeStackScreenProps<MealsStackParamList, 'MyMealsList'>;

interface MealParticipantData {
  user_id: string;
  role: string;
  rsvp_status: string;
  user_profiles?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

interface MealWithPlanSummary extends MealWithDetails {
  planSummary?: MealPlanSummary;
  meal_participants?: MealParticipantData[];
  dishes?: DishInMeal[];
}

// UPDATED: Added 'cook_soon' to ViewMode
type ViewMode = 'month' | 'week' | 'list' | 'cook_soon';

const MEAL_TYPE_EMOJIS: Record<string, string> = {
  breakfast: '🌅',
  brunch: '🥂',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍿',
  party: '🎉',
  potluck: '🥘',
  holiday: '🦃',
  other: '🍽️',
};

// Helper to get local date string without timezone issues
const getLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function MyMealsScreen({ navigation, route }: Props) {
  const { colors, functionalColors } = useTheme();
  const [meals, setMeals] = useState<MealWithPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'planning' | 'completed'>('planning');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  // Calendar state (lifted up from MealCalendarView)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // For creating meal with pre-selected date
  const [createMealInitialDate, setCreateMealInitialDate] = useState<Date | undefined>(undefined);
  
  // Dishes for selected day meals (completed meals)
  const [selectedDayDishes, setSelectedDayDishes] = useState<Map<string, DishInMeal[]>>(new Map());
  // Plan items for selected day meals (planning meals)
  const [selectedDayPlanItems, setSelectedDayPlanItems] = useState<Map<string, MealPlanItem[]>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState(false);

  // NEW: Recipe selection flow state
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [selectedRecipeForModal, setSelectedRecipeForModal] = useState<{
    id: string;
    title: string;
    image_url?: string;
  } | null>(null);

  // NEW: Cook Soon data
  const [cookSoonRecipes, setCookSoonRecipes] = useState<any[]>([]);
  const [loadingCookSoon, setLoadingCookSoon] = useState(false);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        loadMeals();
        // Also refresh cook soon when returning to screen
        if (viewMode === 'cook_soon') {
          loadCookSoonRecipes();
        }
      }
    }, [currentUserId, viewMode])
  );

  // NEW: Handle return from recipe selection
  useEffect(() => {
    const params = route.params;
    if (params?.selectedRecipe) {
      // User returned from RecipeListScreen with a selected recipe
      setSelectedRecipeForModal(params.selectedRecipe);
      
      // Restore form data if we have it
      if (params.returnedFormData) {
        setPendingFormData(params.returnedFormData);
      }
      
      // Reopen the create modal
      setCreateModalVisible(true);
      
      // Clear the params so this doesn't fire again
      navigation.setParams({ selectedRecipe: undefined, returnedFormData: undefined } as any);
    } else if (params?.returnedFormData && !params?.selectedRecipe) {
      // User cancelled recipe selection, restore form data
      setPendingFormData(params.returnedFormData);
      setCreateModalVisible(true);
      navigation.setParams({ returnedFormData: undefined } as any);
    }
  }, [route.params]);

  // NEW: Load Cook Soon recipes when switching to that tab
  useEffect(() => {
    if (viewMode === 'cook_soon' && currentUserId) {
      loadCookSoonRecipes();
    }
  }, [viewMode, currentUserId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      loadMeals(user.id);
    }
  };

  // NEW: Load Cook Soon recipes
  const loadCookSoonRecipes = async () => {
    if (!currentUserId) return;
    
    setLoadingCookSoon(true);
    try {
      const recipes = await getRecipesWithTag(currentUserId, 'cook_soon');
      setCookSoonRecipes(recipes);
    } catch (error) {
      console.error('Error loading cook soon recipes:', error);
    } finally {
      setLoadingCookSoon(false);
    }
  };

  const loadMeals = async (userId?: string) => {
    const uid = userId || currentUserId;
    if (!uid) return;

    try {
      // Get meals where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('meal_participants')
        .select('meal_id')
        .eq('user_id', uid)
        .in('rsvp_status', ['accepted', 'pending', 'maybe']);

      if (participantError) throw participantError;

      const mealIds = participantData?.map(p => p.meal_id) || [];

      if (mealIds.length === 0) {
        setMeals([]);
        setLoading(false);
        return;
      }

      // Get meal details
      const { data: mealsData, error: mealsError } = await supabase
        .from('posts')
        .select(`
          *,
          meal_participants(
            user_id,
            role,
            rsvp_status,
            user_profiles:user_id(
              id,
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .in('id', mealIds)
        .eq('post_type', 'meal')
        .order('created_at', { ascending: false });

      if (mealsError) throw mealsError;

      // Get counts and plan summaries
      const mealsWithDetails: MealWithPlanSummary[] = await Promise.all(
        (mealsData || []).map(async (meal: any) => {
          // Get dish count
          const { count: dishCount } = await supabase
            .from('dish_courses')
            .select('id', { count: 'exact', head: true })
            .eq('meal_id', meal.id);

          // Get participant count
          const { count: participantCount } = await supabase
            .from('meal_participants')
            .select('id', { count: 'exact', head: true })
            .eq('meal_id', meal.id)
            .eq('rsvp_status', 'accepted');

          // Get plan summary
          const planSummary = await getMealPlanSummary(meal.id);

          // Find host
          const host = meal.meal_participants?.find((p: any) => p.role === 'host');

          return {
            ...meal,
            dish_count: dishCount || 0,
            participant_count: participantCount || 0,
            host_id: host?.user_id,
            host_profile: host?.user_profiles,
            planSummary,
          };
        })
      );

      setMeals(mealsWithDetails);
    } catch (error) {
      console.error('Error loading meals:', error);
      Alert.alert('Error', 'Failed to load meals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMeals();
    if (viewMode === 'cook_soon') {
      loadCookSoonRecipes();
    }
  };

  const handleMealCreated = (mealId: string) => {
    setCreateModalVisible(false);
    setCreateMealInitialDate(undefined);
    setSelectedRecipeForModal(null);
    setPendingFormData(null);
    if (currentUserId) {
      navigation.navigate('MealDetail', { mealId, currentUserId });
    }
    loadMeals();
  };

  // NEW: Handler for recipe selection from CreateMealModal
  const handleSelectRecipeFromModal = (formData: any) => {
    // Store the current form data
    setPendingFormData(formData);
    
    // Close the modal
    setCreateModalVisible(false);
    
    // Navigate to RecipeListScreen in selection mode
    navigation.getParent()?.navigate('RecipesStack', {
      screen: 'RecipeList',
      params: {
        selectionMode: true,
        returnToMeals: true,
        mealFormData: formData,
      },
    });
  };

  const handleDaySelect = useCallback(async (date: Date) => {
    setSelectedDate(date);
    
    // Load details for meals on this day
    const selectedKey = getLocalDateKey(date);
    const dayMeals = meals.filter(meal => {
      if (!meal.meal_time) return false;
      const mealKey = getLocalDateKey(new Date(meal.meal_time));
      return mealKey === selectedKey;
    });
    
    if (dayMeals.length > 0) {
      setLoadingDetails(true);
      try {
        const planItemsMap = new Map<string, MealPlanItem[]>();
        const dishesMap = new Map<string, DishInMeal[]>();
        
        await Promise.all(
          dayMeals.map(async (meal) => {
            if (meal.meal_status === 'planning') {
              // For planning meals, load plan items
              const planItems = await getMealPlanItems(meal.id);
              planItemsMap.set(meal.id, planItems);
            } else {
              // For completed meals, load actual dishes
              const dishes = await getMealDishes(meal.id);
              dishesMap.set(meal.id, dishes);
            }
          })
        );
        
        setSelectedDayPlanItems(planItemsMap);
        setSelectedDayDishes(dishesMap);
      } catch (error) {
        console.error('Error loading meal details:', error);
      } finally {
        setLoadingDetails(false);
      }
    } else {
      setSelectedDayPlanItems(new Map());
      setSelectedDayDishes(new Map());
    }
  }, [meals]);

  const handleAddMealForDate = useCallback((date: Date) => {
    // Set the date to default to 6pm on that day
    const mealDate = new Date(date);
    mealDate.setHours(18, 0, 0, 0);
    setCreateMealInitialDate(mealDate);
    setCreateModalVisible(true);
  }, []);

  const handleCreateNewMeal = useCallback(() => {
    // Open modal without pre-selected date
    setCreateMealInitialDate(undefined);
    setSelectedRecipeForModal(null);
    setPendingFormData(null);
    setCreateModalVisible(true);
  }, []);

  const handleViewMeal = useCallback((mealId: string) => {
    if (currentUserId) {
      navigation.navigate('MealDetail', { mealId, currentUserId });
    }
  }, [currentUserId, navigation]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const formatSelectedDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  };

  const formatTime = (timeString?: string): string => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getAvatarEmoji = (userId: string): string => {
    const emojis = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🍕', '🌮', '🍔', '🍜', '🥘'];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return emojis[hash % emojis.length];
  };

  const planningMeals = useMemo(() => meals.filter(m => m.meal_status === 'planning'), [meals]);
  const completedMeals = useMemo(() => meals.filter(m => m.meal_status === 'completed'), [meals]);
  const displayMeals = activeTab === 'planning' ? planningMeals : completedMeals;

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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 12,
      backgroundColor: colors.background.card,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
    },
    headerButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
    },
    headerButtonText: {
      color: colors.background.card,
      fontSize: 13,
      fontWeight: '600',
    },
    viewModeContainer: {
      flexDirection: 'row',
      backgroundColor: colors.background.tertiary,
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 8,
      padding: 3,
    },
    viewModeButton: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 6,
      alignItems: 'center',
    },
    viewModeButtonActive: {
      backgroundColor: colors.background.card,
      shadowColor: colors.text.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    viewModeText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    viewModeTextActive: {
      color: colors.text.primary,
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 8,
    },
    tab: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: colors.background.tertiary,
    },
    tabActive: {
      backgroundColor: colors.primaryLight,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text.secondary,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    emptyListContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    mealCard: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      shadowColor: colors.text.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    mealInfo: {
      flex: 1,
      marginRight: 8,
    },
    mealTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    metaText: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    statusPlanning: {
      backgroundColor: functionalColors.warning.light,
    },
    statusCompleted: {
      backgroundColor: functionalColors.success.light,
    },
    statusText: {
      fontSize: 12,
    },
    planProgress: {
      marginBottom: 8,
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
      padding: 8,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.border.light,
      borderRadius: 2,
      marginBottom: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: functionalColors.success.main,
      borderRadius: 2,
    },
    planStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    planStatText: {
      fontSize: 10,
      color: colors.text.secondary,
    },
    planStatValue: {
      fontWeight: '600',
      color: colors.text.primary,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statEmoji: {
      fontSize: 14,
      marginRight: 2,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    statDivider: {
      width: 1,
      height: 16,
      backgroundColor: colors.border.light,
      marginHorizontal: 12,
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyEmoji: {
      fontSize: 48,
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 13,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 20,
    },
    createButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    createButtonText: {
      color: colors.background.card,
      fontSize: 14,
      fontWeight: '600',
    },
    // Calendar view styles
    calendarScrollView: {
      flex: 1,
    },
    // Selected Day Section Styles (compact)
    selectedDaySection: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 12,
      marginHorizontal: 16,
      marginTop: 8,
      shadowColor: colors.text.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    selectedDayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    selectedDayDate: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
    },
    todayBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    todayBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.background.card,
    },
    selectedDayMeals: {
      gap: 8,
    },
    selectedDayMealCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 10,
      padding: 10,
    },
    selectedDayMealHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectedMealEmoji: {
      fontSize: 20,
      marginRight: 8,
    },
    selectedMealInfo: {
      flex: 1,
    },
    selectedMealTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    selectedMealMeta: {
      fontSize: 11,
      color: colors.text.secondary,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusDotPlanning: {
      backgroundColor: functionalColors.warning.main,
    },
    statusDotCompleted: {
      backgroundColor: functionalColors.success.main,
    },
    planItemsList: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    planItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 3,
    },
    planItemEmoji: {
      fontSize: 12,
      marginRight: 6,
    },
    planItemName: {
      flex: 1,
      fontSize: 12,
      color: colors.text.primary,
      fontWeight: '500',
    },
    planItemPerson: {
      fontSize: 11,
      color: colors.text.secondary,
      marginLeft: 4,
      maxWidth: 80,
    },
    planItemStatus: {
      fontSize: 11,
      marginLeft: 4,
      width: 16,
      textAlign: 'center',
    },
    dishList: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    dishListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 2,
    },
    dishListBullet: {
      fontSize: 10,
      color: colors.text.tertiary,
      marginRight: 4,
    },
    dishListName: {
      flex: 1,
      fontSize: 12,
      color: colors.text.primary,
    },
    dishListCourse: {
      fontSize: 10,
      marginLeft: 4,
    },
    moreItems: {
      fontSize: 11,
      color: colors.text.tertiary,
      fontStyle: 'italic',
      marginTop: 2,
    },
    noItemsText: {
      fontSize: 11,
      color: colors.text.tertiary,
      fontStyle: 'italic',
      marginTop: 6,
    },
    addAnotherMealButton: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    addAnotherMealText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    noMealsForDay: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    noMealsText: {
      fontSize: 13,
      color: colors.text.tertiary,
    },
    addMealButtonSmall: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
    },
    addMealButtonSmallText: {
      color: colors.background.card,
      fontSize: 12,
      fontWeight: '600',
    },
    // Upcoming section
    upcomingSection: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 12,
      marginHorizontal: 16,
      marginTop: 8,
      shadowColor: colors.text.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    upcomingSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    upcomingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    upcomingDate: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginRight: 10,
    },
    upcomingDateText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    upcomingInfo: {
      flex: 1,
    },
    upcomingTitle: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text.primary,
    },
    upcomingMeta: {
      fontSize: 11,
      color: colors.text.secondary,
    },
    upcomingArrow: {
      fontSize: 18,
      color: colors.text.tertiary,
      marginLeft: 4,
    },
    noUpcoming: {
      fontSize: 12,
      color: colors.text.tertiary,
      textAlign: 'center',
      paddingVertical: 8,
    },
  }), [colors, functionalColors]);

  // Prepare meals for calendar view (simplified format)
  const calendarMeals = useMemo(() => meals.map(m => ({
    id: m.id,
    title: m.title,
    meal_time: m.meal_time,
    meal_type: m.meal_type,
    participant_count: m.participant_count,
    meal_status: m.meal_status as 'planning' | 'completed',
  })), [meals]);

  // Get meals for selected date using local date comparison
  const selectedDayMeals = useMemo(() => {
    const selectedKey = getLocalDateKey(selectedDate);
    return meals.filter(meal => {
      if (!meal.meal_time) return false;
      const mealKey = getLocalDateKey(new Date(meal.meal_time));
      return mealKey === selectedKey;
    });
  }, [meals, selectedDate]);
  
  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();

  // Get sorted dishes (mains first, then sides, then others)
  const getSortedDishes = (dishes: DishInMeal[]): DishInMeal[] => {
    const order: CourseType[] = ['main', 'side', 'appetizer', 'dessert', 'drink', 'other'];
    return [...dishes].sort((a, b) => {
      return order.indexOf(a.course_type) - order.indexOf(b.course_type);
    });
  };

  // Get upcoming meals (future meals in planning status)
  const upcomingMeals = useMemo(() => planningMeals
    .filter(m => m.meal_time && new Date(m.meal_time) >= new Date())
    .sort((a, b) => {
      if (!a.meal_time || !b.meal_time) return 0;
      return new Date(a.meal_time).getTime() - new Date(b.meal_time).getTime();
    })
    .slice(0, 5), [planningMeals]);

  const renderMealCard = ({ item }: { item: MealWithPlanSummary }) => {
    const isPlanning = item.meal_status === 'planning';
    const isHost = item.host_id === currentUserId;

    return (
      <TouchableOpacity
        style={styles.mealCard}
        onPress={() => {
          if (currentUserId) {
            navigation.navigate('MealDetail', { 
              mealId: item.id, 
              currentUserId 
            });
          }
        }}
        activeOpacity={0.7}
      >
        {/* Header Row */}
        <View style={styles.cardHeader}>
          <View style={styles.mealInfo}>
            <Text style={styles.mealTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.metaRow}>
              {item.meal_time && (
                <Text style={styles.metaText}>
                  📅 {formatDate(item.meal_time)}
                </Text>
              )}
              {item.meal_location && (
                <Text style={styles.metaText}>
                  {' '}· 📍 {item.meal_location}
                </Text>
              )}
            </View>
          </View>
          <View style={[
            styles.statusBadge,
            isPlanning ? styles.statusPlanning : styles.statusCompleted
          ]}>
            <Text style={styles.statusText}>
              {isPlanning ? '📝' : '✓'}
            </Text>
          </View>
        </View>

        {/* Plan Progress (for planning meals) */}
        {isPlanning && item.planSummary && item.planSummary.total_items > 0 && (
          <View style={styles.planProgress}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${(item.planSummary.completed / item.planSummary.total_items) * 100}%` 
                  }
                ]} 
              />
            </View>
            <View style={styles.planStats}>
              <Text style={styles.planStatText}>
                <Text style={styles.planStatValue}>{item.planSummary.unclaimed_items}</Text> need someone
              </Text>
              <Text style={styles.planStatText}>
                <Text style={styles.planStatValue}>{item.planSummary.completed}</Text> done
              </Text>
            </View>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statEmoji}>🍽️</Text>
            <Text style={styles.statValue}>{item.dish_count}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statEmoji}>👥</Text>
            <Text style={styles.statValue}>{item.participant_count}</Text>
          </View>
          {isHost && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statEmoji}>👑</Text>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>
        {activeTab === 'planning' ? '📝' : '🍽️'}
      </Text>
      <Text style={styles.emptyTitle}>
        {activeTab === 'planning' 
          ? 'No meals planned yet' 
          : 'No completed meals'
        }
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'planning'
          ? 'Create a meal to start planning!'
          : 'Complete a planned meal to see it here.'
        }
      </Text>
      {activeTab === 'planning' && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateNewMeal}
        >
          <Text style={styles.createButtonText}>+ Create Meal</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render selected day section (compact, inline below calendar)
  const renderSelectedDaySection = () => {
    return (
      <View style={styles.selectedDaySection}>
        {/* Date Header */}
        <View style={styles.selectedDayHeader}>
          <Text style={styles.selectedDayDate}>
            {formatSelectedDate(selectedDate)}
          </Text>
          {isSelectedToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          )}
        </View>

        {/* Meals for this day */}
        {selectedDayMeals.length > 0 ? (
          <View style={styles.selectedDayMeals}>
            {selectedDayMeals.map(meal => {
              const isPlanning = meal.meal_status === 'planning';
              const planItems = selectedDayPlanItems.get(meal.id) || [];
              const dishes = selectedDayDishes.get(meal.id) || [];
              
              return (
                <View key={meal.id} style={styles.selectedDayMealCard}>
                  {/* Meal Header - tappable */}
                  <TouchableOpacity
                    style={styles.selectedDayMealHeader}
                    onPress={() => handleViewMeal(meal.id)}
                  >
                    <Text style={styles.selectedMealEmoji}>
                      {MEAL_TYPE_EMOJIS[meal.meal_type || 'other'] || '🍽️'}
                    </Text>
                    <View style={styles.selectedMealInfo}>
                      <Text style={styles.selectedMealTitle} numberOfLines={1}>
                        {meal.title}
                      </Text>
                      <Text style={styles.selectedMealMeta}>
                        {meal.meal_time && formatTime(meal.meal_time)} · 👥{meal.participant_count}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusDot,
                      isPlanning ? styles.statusDotPlanning : styles.statusDotCompleted
                    ]} />
                  </TouchableOpacity>
                  
                  {/* Loading indicator */}
                  {loadingDetails ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
                  ) : isPlanning && planItems.length > 0 ? (
                    /* Planning meals: show plan items */
                    <View style={styles.planItemsList}>
                      {planItems.slice(0, 5).map((item) => {
                        const courseEmoji = item.course_type === 'main' ? '🍖' : 
                                           item.course_type === 'side' ? '🥔' :
                                           item.course_type === 'appetizer' ? '🥗' :
                                           item.course_type === 'dessert' ? '🍰' :
                                           item.course_type === 'drink' ? '🍷' : '🍽️';
                        
                        const itemName = item.placeholder_name || 
                                        (item.recipe_title) ||
                                        `${item.course_type.charAt(0).toUpperCase() + item.course_type.slice(1)}`;
                        
                        // Check if claimed/assigned to current user
                        const isMyItem = item.claimed_by === currentUserId || item.assigned_to === currentUserId;
                        const responsibleName = isMyItem ? 'You' :
                                               item.claimer_display_name || item.claimer_username ||
                                               item.assignee_display_name || item.assignee_username;
                        
                        const statusIcon = item.status === 'completed' ? '✅' :
                                          item.status === 'has_recipe' ? '📋' :
                                          item.status === 'claimed' ? '✓' :
                                          item.status === 'assigned' ? '→' : '⏳';
                        
                        const statusColor = item.status === 'unclaimed' ? functionalColors.warning.main :
                                           item.status === 'completed' ? functionalColors.success.main : colors.text.secondary;
                        
                        return (
                          <View key={item.id} style={styles.planItemRow}>
                            <Text style={styles.planItemEmoji}>{courseEmoji}</Text>
                            <Text style={styles.planItemName} numberOfLines={1}>
                              {itemName}
                            </Text>
                            {responsibleName ? (
                              <Text style={[styles.planItemPerson, isMyItem && { fontWeight: '600', color: colors.primary }]} numberOfLines={1}>
                                ({responsibleName})
                              </Text>
                            ) : (
                              <Text style={[styles.planItemPerson, { color: functionalColors.warning.main }]}>
                                (needs someone)
                              </Text>
                            )}
                            <Text style={[styles.planItemStatus, { color: statusColor }]}>
                              {statusIcon}
                            </Text>
                          </View>
                        );
                      })}
                      {planItems.length > 5 && (
                        <Text style={styles.moreItems}>
                          +{planItems.length - 5} more items
                        </Text>
                      )}
                    </View>
                  ) : !isPlanning && dishes.length > 0 ? (
                    /* Completed meals: show actual dishes */
                    <View style={styles.dishList}>
                      {getSortedDishes(dishes).slice(0, 4).map((dish) => (
                        <View key={dish.dish_id} style={styles.dishListItem}>
                          <Text style={styles.dishListBullet}>•</Text>
                          <Text style={styles.dishListName} numberOfLines={1}>
                            {dish.recipe_title || dish.dish_title}
                          </Text>
                          <Text style={styles.dishListCourse}>
                            {dish.course_type === 'main' ? '🍖' : 
                             dish.course_type === 'side' ? '🥔' :
                             dish.course_type === 'appetizer' ? '🥗' :
                             dish.course_type === 'dessert' ? '🍰' :
                             dish.course_type === 'drink' ? '🍷' : ''}
                          </Text>
                        </View>
                      ))}
                      {dishes.length > 4 && (
                        <Text style={styles.moreItems}>
                          +{dishes.length - 4} more dishes
                        </Text>
                      )}
                    </View>
                  ) : (
                    /* No items yet */
                    <Text style={styles.noItemsText}>
                      {isPlanning ? 'No items planned yet' : 'No dishes'}
                    </Text>
                  )}
                </View>
              );
            })}
            
            {/* Add another meal button */}
            <TouchableOpacity
              style={styles.addAnotherMealButton}
              onPress={() => handleAddMealForDate(selectedDate)}
            >
              <Text style={styles.addAnotherMealText}>+ Add Meal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* No meals - show add button */
          <View style={styles.noMealsForDay}>
            <Text style={styles.noMealsText}>No meals</Text>
            <TouchableOpacity
              style={styles.addMealButtonSmall}
              onPress={() => handleAddMealForDate(selectedDate)}
            >
              <Text style={styles.addMealButtonSmallText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Render upcoming meals section
  const renderUpcomingSection = () => (
    <View style={styles.upcomingSection}>
      <Text style={styles.upcomingSectionTitle}>📅 Upcoming</Text>
      {upcomingMeals.length > 0 ? (
        upcomingMeals.map(meal => (
          <TouchableOpacity
            key={meal.id}
            style={styles.upcomingItem}
            onPress={() => handleViewMeal(meal.id)}
          >
            <View style={styles.upcomingDate}>
              <Text style={styles.upcomingDateText}>{formatDate(meal.meal_time)}</Text>
            </View>
            <View style={styles.upcomingInfo}>
              <Text style={styles.upcomingTitle} numberOfLines={1}>{meal.title}</Text>
              <Text style={styles.upcomingMeta}>👥 {meal.participant_count}</Text>
            </View>
            <Text style={styles.upcomingArrow}>›</Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.noUpcoming}>No upcoming meals</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Meals</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleCreateNewMeal}
        >
          <Text style={styles.headerButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* UPDATED: Combined View Mode Toggle: Month / Week / List / Cook Soon */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'month' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('month')}
        >
          <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'week' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('week')}
        >
          <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'cook_soon' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('cook_soon')}
        >
          <Text style={[styles.viewModeText, viewMode === 'cook_soon' && styles.viewModeTextActive]}>
            🔥 Soon
          </Text>
        </TouchableOpacity>
      </View>

      {/* NEW: Cook Soon View */}
      {viewMode === 'cook_soon' ? (
        <CookSoonSection
          recipes={cookSoonRecipes}
          loading={loadingCookSoon}
          currentUserId={currentUserId}
          onRefresh={loadCookSoonRecipes}
          onRecipePress={(recipe) => {
            // Navigate to recipe detail
            navigation.getParent()?.navigate('RecipesStack', {
              screen: 'RecipeDetail',
              params: { recipe },
            });
          }}
          onRemove={(recipeId) => {
            // Remove from local state immediately
            setCookSoonRecipes(prev => prev.filter(r => r.id !== recipeId));
          }}
        />
      ) : viewMode === 'list' ? (
        <>
          {/* Tabs (List View Only) */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'planning' && styles.tabActive]}
              onPress={() => setActiveTab('planning')}
            >
              <Text style={[styles.tabText, activeTab === 'planning' && styles.tabTextActive]}>
                Planning ({planningMeals.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
              onPress={() => setActiveTab('completed')}
            >
              <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
                Done ({completedMeals.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Meal List */}
          <FlatList
            data={displayMeals}
            renderItem={renderMealCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              displayMeals.length === 0 && styles.emptyListContent,
            ]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        /* Calendar View (Month or Week) */
        <ScrollView
          style={styles.calendarScrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <MealCalendarView
            meals={calendarMeals}
            selectedDate={selectedDate}
            viewMode={viewMode}
            currentMonth={currentMonth}
            onDaySelect={handleDaySelect}
            onMealPress={handleViewMeal}
            onMonthChange={setCurrentMonth}
            currentUserId={currentUserId || ''}
          />
          
          {/* Selected Day Section (inline) */}
          {renderSelectedDaySection()}
          
          {/* Upcoming Meals Section */}
          {renderUpcomingSection()}
          
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* Create Meal Modal */}
      {currentUserId && (
        <CreateMealModal
          visible={createModalVisible}
          onClose={() => {
            setCreateModalVisible(false);
            setCreateMealInitialDate(undefined);
            setSelectedRecipeForModal(null);
            setPendingFormData(null);
          }}
          onSuccess={handleMealCreated}
          currentUserId={currentUserId}
          initialDate={createMealInitialDate}
          // NEW: Props for recipe selection flow
          initialRecipeId={selectedRecipeForModal?.id}
          initialRecipeTitle={selectedRecipeForModal?.title}
          onSelectRecipe={handleSelectRecipeFromModal}
          initialFormData={pendingFormData}
        />
      )}
    </View>
  );
}