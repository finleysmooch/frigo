// components/QuickMealPlanModal.tsx
// Quick action modal for adding a recipe to meal plan
// Optimized for single-person meal planning with minimal clicks
// Created: December 10, 2025

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { createMeal, CreateMealInput } from '../lib/services/mealService';
import { 
  createPlanItemWithRecipe, 
  getUserPlanningMealsWithDetails, 
  PlanningMealInfo,
  CourseType 
} from '../lib/services/mealPlanService';
import { 
  addToCookSoon, 
  isInCookSoon, 
  removeFromCookSoon 
} from '../lib/services/userRecipeTagsService';
import WeekCalendarPicker from './WeekCalendarPicker';

interface QuickMealPlanModalProps {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  recipeTitle: string;
  recipeImageUrl?: string;
  currentUserId: string;
  defaultCourse?: CourseType;
  onSuccess?: (mealId: string, mealTitle: string, action: string) => void;
}

type ModalView = 'main' | 'calendar' | 'existing_meals' | 'course_select';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const COURSE_OPTIONS: { type: CourseType; emoji: string; label: string }[] = [
  { type: 'main', emoji: '🍖', label: 'Main' },
  { type: 'side', emoji: '🥔', label: 'Side' },
  { type: 'appetizer', emoji: '🥗', label: 'Appetizer' },
  { type: 'dessert', emoji: '🍰', label: 'Dessert' },
  { type: 'drink', emoji: '🍷', label: 'Drink' },
  { type: 'other', emoji: '🍽️', label: 'Other' },
];

// Generate meal name like "Tuesday Dinner"
function generateMealName(date: Date, mealType: 'breakfast' | 'lunch' | 'dinner'): string {
  const dayName = DAY_NAMES[date.getDay()];
  const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  return `${dayName} ${mealLabel}`;
}

// Get meal type from hour
function getMealTypeFromHour(hour: number): 'breakfast' | 'lunch' | 'dinner' {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  return 'dinner';
}

export default function QuickMealPlanModal({
  visible,
  onClose,
  recipeId,
  recipeTitle,
  recipeImageUrl,
  currentUserId,
  defaultCourse = 'main',
  onSuccess,
}: QuickMealPlanModalProps) {
  const { colors, functionalColors } = useTheme();
  const [view, setView] = useState<ModalView>('main');
  const [loading, setLoading] = useState(false);
  const [existingMeals, setExistingMeals] = useState<PlanningMealInfo[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [isInCookSoonList, setIsInCookSoonList] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
      minHeight: 400,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      marginHorizontal: 10,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.text.secondary,
      marginTop: 2,
    },
    cancelButton: {
      fontSize: 16,
      color: colors.text.secondary,
      width: 60,
    },
    backButton: {
      fontSize: 16,
      color: colors.primary,
      width: 60,
    },
    addButton: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
      width: 60,
      textAlign: 'right',
    },
    disabled: {
      opacity: 0.4,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 10,
      marginLeft: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    quickActionPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: '#EFF6FF',
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    quickAction: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      marginBottom: 10,
    },
    activeOption: {
      backgroundColor: '#FEF3C7',
    },
    quickActionEmoji: {
      fontSize: 28,
      marginRight: 14,
    },
    quickActionContent: {
      flex: 1,
    },
    quickActionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    quickActionDesc: {
      fontSize: 13,
      color: colors.text.secondary,
      marginTop: 2,
    },
    quickActionArrow: {
      fontSize: 24,
      color: colors.text.tertiary,
      marginLeft: 8,
    },
    checkmark: {
      fontSize: 20,
      color: functionalColors.warning,
      fontWeight: '700',
      marginLeft: 8,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.medium,
      marginVertical: 16,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.text.secondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 200,
    },
    // Calendar view
    calendarInstructions: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    // Existing meals view
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 34,
    },
    mealItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.background.secondary,
    },
    mealEmoji: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: '#EFF6FF',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    mealEmojiText: {
      fontSize: 24,
    },
    mealInfo: {
      flex: 1,
    },
    mealTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 2,
    },
    mealMeta: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    hostBadge: {
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      marginRight: 8,
    },
    hostBadgeText: {
      fontSize: 11,
      color: '#92400E',
      fontWeight: '600',
    },
    arrow: {
      fontSize: 24,
      color: colors.text.tertiary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 10,
    },
    emptyButtonText: {
      fontSize: 16,
      color: colors.background.card,
      fontWeight: '600',
    },
    // Course selection
    courseContainer: {
      padding: 20,
    },
    courseLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text.primary,
      marginBottom: 16,
    },
    courseGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
    },
    courseOption: {
      width: '30%',
      margin: '1.5%',
      aspectRatio: 1,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    courseOptionSelected: {
      backgroundColor: '#EFF6FF',
      borderColor: colors.primary,
    },
    courseEmoji: {
      fontSize: 28,
      marginBottom: 4,
    },
    courseOptionText: {
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    courseOptionTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
  }), [colors, functionalColors]);
  
  // For calendar selection flow
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner'>('dinner');
  const [selectedCourse, setSelectedCourse] = useState<CourseType>(defaultCourse);
  const [selectedMeal, setSelectedMeal] = useState<PlanningMealInfo | null>(null);

  useEffect(() => {
    if (visible) {
      resetState();
      checkCookSoonStatus();
    }
  }, [visible]);

  const resetState = () => {
    setView('main');
    setSelectedDate(null);
    setSelectedMealType('dinner');
    setSelectedCourse(defaultCourse);
    setSelectedMeal(null);
  };

  const checkCookSoonStatus = async () => {
    try {
      const inList = await isInCookSoon(currentUserId, recipeId);
      setIsInCookSoonList(inList);
    } catch (error) {
      // If service not available, just leave as false
      console.log('Cook soon check not available');
    }
  };

  const loadExistingMeals = async () => {
    setLoadingMeals(true);
    try {
      const meals = await getUserPlanningMealsWithDetails(currentUserId);
      setExistingMeals(meals);
    } catch (error) {
      console.error('Error loading meals:', error);
    } finally {
      setLoadingMeals(false);
    }
  };

  // ============================================================================
  // QUICK ACTIONS - Create meal + add recipe in one step
  // ============================================================================

  const createMealWithRecipe = async (
    mealDate: Date,
    mealType: 'breakfast' | 'lunch' | 'dinner',
    course: CourseType = 'main'
  ) => {
    setLoading(true);
    try {
      // Generate meal name
      const mealName = generateMealName(mealDate, mealType);
      
      // Map meal type to the meal_type field
      const mealTypeMapping: Record<string, string> = {
        breakfast: 'breakfast',
        lunch: 'lunch',
        dinner: 'dinner',
      };
      
      // Create the meal
      const mealInput: CreateMealInput = {
        title: mealName,
        meal_type: mealTypeMapping[mealType],
        meal_time: mealDate.toISOString(),
      };
      
      const createResult = await createMeal(currentUserId, mealInput);
      
      if (!createResult.success || !createResult.mealId) {
        Alert.alert('Error', createResult.error || 'Failed to create meal');
        return;
      }
      
      // Add recipe to the meal as a plan item using the new helper
      const addResult = await createPlanItemWithRecipe(
        createResult.mealId,
        currentUserId,
        recipeId,
        course,
        course === 'main' // is_main_dish
      );
      
      if (!addResult.success) {
        // Meal was created but recipe wasn't added - still show success
        console.warn('Meal created but recipe not added:', addResult.error);
      }
      
      // Remove from cook soon list if it was there
      if (isInCookSoonList) {
        try {
          await removeFromCookSoon(currentUserId, recipeId);
        } catch (e) {
          // Ignore errors
        }
      }
      
      Alert.alert(
        '✨ Meal Planned!',
        `"${recipeTitle}" added to ${mealName}`,
        [{ text: 'Great!', onPress: () => {
          onSuccess?.(createResult.mealId!, mealName, 'created');
          onClose();
        }}]
      );
      
    } catch (error) {
      console.error('Error creating meal with recipe:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const addToExistingMeal = async (meal: PlanningMealInfo, course: CourseType = 'main') => {
    setLoading(true);
    try {
      const result = await createPlanItemWithRecipe(
        meal.meal_id,
        currentUserId,
        recipeId,
        course,
        course === 'main'
      );
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to add recipe');
        return;
      }
      
      // Remove from cook soon list if it was there
      if (isInCookSoonList) {
        try {
          await removeFromCookSoon(currentUserId, recipeId);
        } catch (e) {
          // Ignore errors
        }
      }
      
      Alert.alert(
        '✨ Added!',
        `"${recipeTitle}" added to ${meal.title}`,
        [{ text: 'Great!', onPress: () => {
          onSuccess?.(meal.meal_id, meal.title, 'added');
          onClose();
        }}]
      );
      
    } catch (error) {
      console.error('Error adding to meal:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCookSoonToggle = async () => {
    setLoading(true);
    try {
      if (isInCookSoonList) {
        await removeFromCookSoon(currentUserId, recipeId);
        setIsInCookSoonList(false);
        Alert.alert('Removed', `"${recipeTitle}" removed from Cook Soon list`);
      } else {
        await addToCookSoon(currentUserId, recipeId);
        setIsInCookSoonList(true);
        Alert.alert(
          '🔥 Saved!',
          `"${recipeTitle}" added to your Cook Soon list`,
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (error) {
      console.error('Error toggling cook soon:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // QUICK ACTION HANDLERS
  // ============================================================================

  const handleCookTonight = () => {
    const tonight = new Date();
    tonight.setHours(18, 0, 0, 0);
    createMealWithRecipe(tonight, 'dinner', selectedCourse);
  };

  const handleCookTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    createMealWithRecipe(tomorrow, 'dinner', selectedCourse);
  };

  const handleShowCalendar = () => {
    setView('calendar');
  };

  const handleShowExistingMeals = () => {
    loadExistingMeals();
    setView('existing_meals');
  };

  const handleCalendarDateSelect = (date: Date, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    // Go directly to creating the meal
    createMealWithRecipe(date, mealType, selectedCourse);
  };

  const handleExistingMealSelect = (meal: PlanningMealInfo) => {
    setSelectedMeal(meal);
    setView('course_select');
  };

  const handleCourseConfirm = () => {
    if (selectedMeal) {
      addToExistingMeal(selectedMeal, selectedCourse);
    }
  };

  const formatMealTime = (dateString?: string) => {
    if (!dateString) return 'No date set';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
  };

  const goBack = () => {
    if (view === 'course_select') {
      setView('existing_meals');
      setSelectedMeal(null);
    } else if (view === 'calendar' || view === 'existing_meals') {
      setView('main');
    } else {
      onClose();
    }
  };

  // ============================================================================
  // RENDER: Main Menu
  // ============================================================================

  const renderMainView = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Add to Meal Plan</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{recipeTitle}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Actions Section */}
        <Text style={styles.sectionLabel}>Quick Add</Text>
        
        <TouchableOpacity
          style={styles.quickActionPrimary}
          onPress={handleCookTonight}
          disabled={loading}
        >
          <Text style={styles.quickActionEmoji}>🌙</Text>
          <View style={styles.quickActionContent}>
            <Text style={styles.quickActionTitle}>Cook Tonight</Text>
            <Text style={styles.quickActionDesc}>Create dinner for today</Text>
          </View>
          <Text style={styles.quickActionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={handleCookTomorrow}
          disabled={loading}
        >
          <Text style={styles.quickActionEmoji}>📅</Text>
          <View style={styles.quickActionContent}>
            <Text style={styles.quickActionTitle}>Cook Tomorrow</Text>
            <Text style={styles.quickActionDesc}>Create dinner for tomorrow</Text>
          </View>
          <Text style={styles.quickActionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={handleShowCalendar}
          disabled={loading}
        >
          <Text style={styles.quickActionEmoji}>📆</Text>
          <View style={styles.quickActionContent}>
            <Text style={styles.quickActionTitle}>Pick a Day</Text>
            <Text style={styles.quickActionDesc}>Choose from this or next week</Text>
          </View>
          <Text style={styles.quickActionArrow}>›</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Other Options Section */}
        <Text style={styles.sectionLabel}>More Options</Text>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={handleShowExistingMeals}
          disabled={loading}
        >
          <Text style={styles.quickActionEmoji}>🍽️</Text>
          <View style={styles.quickActionContent}>
            <Text style={styles.quickActionTitle}>Add to Existing Meal</Text>
            <Text style={styles.quickActionDesc}>Join a planned meal</Text>
          </View>
          <Text style={styles.quickActionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickAction, isInCookSoonList && styles.activeOption]}
          onPress={handleCookSoonToggle}
          disabled={loading}
        >
          <Text style={styles.quickActionEmoji}>🔥</Text>
          <View style={styles.quickActionContent}>
            <Text style={styles.quickActionTitle}>
              {isInCookSoonList ? 'In Cook Soon List' : 'Save to Cook Soon'}
            </Text>
            <Text style={styles.quickActionDesc}>
              {isInCookSoonList ? 'Tap to remove' : 'Add to your cooking shortlist'}
            </Text>
          </View>
          {isInCookSoonList && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Creating meal...</Text>
        </View>
      )}
    </>
  );

  // ============================================================================
  // RENDER: Calendar View
  // ============================================================================

  const renderCalendarView = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Pick a Day</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{recipeTitle}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.calendarInstructions}>
          Select a day, then choose breakfast, lunch, or dinner
        </Text>
        
        <WeekCalendarPicker
          weeksToShow={2}
          showTimeSlots={true}
          onSelectDate={(date: Date) => {
            const mealType = getMealTypeFromHour(date.getHours());
            handleCalendarDateSelect(date, mealType);
          }}
          onSelectMealTime={handleCalendarDateSelect}
        />
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Creating meal...</Text>
        </View>
      )}
    </>
  );

  // ============================================================================
  // RENDER: Existing Meals View
  // ============================================================================

  const renderExistingMealsView = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Add to Meal</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{recipeTitle}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {loadingMeals ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : existingMeals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>No Planned Meals</Text>
          <Text style={styles.emptyText}>
            You don't have any meals being planned right now. Use "Pick a Day" to create one!
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setView('calendar')}
          >
            <Text style={styles.emptyButtonText}>Pick a Day</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={existingMeals}
          keyExtractor={(item) => item.meal_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.mealItem}
              onPress={() => handleExistingMealSelect(item)}
            >
              <View style={styles.mealEmoji}>
                <Text style={styles.mealEmojiText}>📅</Text>
              </View>
              <View style={styles.mealInfo}>
                <Text style={styles.mealTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.mealMeta}>{formatMealTime(item.meal_time)}</Text>
              </View>
              {item.role === 'host' && (
                <View style={styles.hostBadge}>
                  <Text style={styles.hostBadgeText}>Host</Text>
                </View>
              )}
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Adding to meal...</Text>
        </View>
      )}
    </>
  );

  // ============================================================================
  // RENDER: Course Selection View
  // ============================================================================

  const renderCourseSelectView = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Select Course</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{selectedMeal?.title}</Text>
        </View>
        <TouchableOpacity onPress={handleCourseConfirm} disabled={loading}>
          <Text style={[styles.addButton, loading && styles.disabled]}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.courseContainer}>
        <Text style={styles.courseLabel}>What type of dish is this?</Text>
        
        <View style={styles.courseGrid}>
          {COURSE_OPTIONS.map((course) => (
            <TouchableOpacity
              key={course.type}
              style={[
                styles.courseOption,
                selectedCourse === course.type && styles.courseOptionSelected,
              ]}
              onPress={() => setSelectedCourse(course.type)}
            >
              <Text style={styles.courseEmoji}>{course.emoji}</Text>
              <Text style={[
                styles.courseOptionText,
                selectedCourse === course.type && styles.courseOptionTextSelected,
              ]}>
                {course.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Adding to meal...</Text>
        </View>
      )}
    </>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {view === 'main' && renderMainView()}
          {view === 'calendar' && renderCalendarView()}
          {view === 'existing_meals' && renderExistingMealsView()}
          {view === 'course_select' && renderCourseSelectView()}
        </View>
      </View>
    </Modal>
  );
}