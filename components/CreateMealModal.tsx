// components/meals/CreateMealModal.tsx
// Modal for creating new meal posts
// Created: December 2, 2025
// Updated: December 10, 2025 - Added initialDate prop, auto-generated default names, inline date picker
// Updated: December 10, 2025 - Added Quick Add Recipe section for streamlined solo meal planning

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { colors } from '../lib/theme';
import { createMeal, CreateMealInput } from '../lib/services/mealService';
import { createPlanItemWithRecipe, CourseType } from '../lib/services/mealPlanService';
import { supabase } from '../lib/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CreateMealModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (mealId: string) => void;
  currentUserId: string;
  initialDate?: Date; // Optional pre-selected date
  initialRecipeId?: string; // NEW: Recipe to add immediately after creation
  initialRecipeTitle?: string; // NEW: Title for display
  // NEW: Props for recipe selection flow
  onSelectRecipe?: (formData: FormData) => void;  // Called when user wants to pick a recipe
  initialFormData?: FormData;  // Form data restored after returning from recipe selection
}

// Form data interface for recipe selection flow
interface FormData {
  title: string;
  mealType: string;
  mealTime: string;
  location?: string;
  description?: string;
}

interface RecipeSearchResult {
  id: string;
  title: string;
  image_url?: string;
  recipe_type?: string;
  chef_name?: string;
}

const MEAL_TYPES = [
  { value: 'breakfast', label: '🌅 Breakfast', emoji: '🌅' },
  { value: 'brunch', label: '🥂 Brunch', emoji: '🥂' },
  { value: 'lunch', label: '☀️ Lunch', emoji: '☀️' },
  { value: 'dinner', label: '🌙 Dinner', emoji: '🌙' },
  { value: 'snack', label: '🍿 Snack', emoji: '🍿' },
  { value: 'party', label: '🎉 Party', emoji: '🎉' },
  { value: 'potluck', label: '🥘 Potluck', emoji: '🥘' },
  { value: 'holiday', label: '🦃 Holiday', emoji: '🦃' },
  { value: 'other', label: '🍽️ Other', emoji: '🍽️' },
];

const COURSE_OPTIONS: { type: CourseType; emoji: string; label: string }[] = [
  { type: 'main', emoji: '🍖', label: 'Main' },
  { type: 'side', emoji: '🥔', label: 'Side' },
  { type: 'appetizer', emoji: '🥗', label: 'Appetizer' },
  { type: 'dessert', emoji: '🍰', label: 'Dessert' },
  { type: 'drink', emoji: '🍷', label: 'Drink' },
  { type: 'other', emoji: '🍽️', label: 'Other' },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate default meal name based on date and meal type
const generateDefaultName = (date: Date | undefined, mealType: string | undefined): string => {
  if (!date || !mealType) return '';
  
  const dayName = DAY_NAMES[date.getDay()];
  const mealTypeInfo = MEAL_TYPES.find(t => t.value === mealType);
  const mealLabel = mealTypeInfo ? mealTypeInfo.label.split(' ')[1] : 'Meal';
  
  return `${dayName} ${mealLabel}`;
};

// Check if a name matches the default pattern for any day/meal combo
const isDefaultName = (name: string): boolean => {
  if (!name) return true;
  
  for (const day of DAY_NAMES) {
    for (const mealType of MEAL_TYPES) {
      const label = mealType.label.split(' ')[1];
      if (name === `${day} ${label}`) {
        return true;
      }
    }
  }
  return false;
};

export default function CreateMealModal({
  visible,
  onClose,
  onSuccess,
  currentUserId,
  initialDate,
  initialRecipeId,
  initialRecipeTitle,
  onSelectRecipe,
  initialFormData,
}: CreateMealModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState<string | undefined>('dinner');
  const [mealTime, setMealTime] = useState<Date | undefined>(undefined);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerHour, setPickerHour] = useState(6);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [pickerAmPm, setPickerAmPm] = useState<'AM' | 'PM'>('PM');
  
  // Track if user has manually edited the title
  const userEditedTitle = useRef(false);
  
  // Quick Add Recipe state
  const [showRecipeSearch, setShowRecipeSearch] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [recipeSearchResults, setRecipeSearchResults] = useState<RecipeSearchResult[]>([]);
  const [searchingRecipes, setSearchingRecipes] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSearchResult | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseType>('main');
  
  // Debounce timer for recipe search
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // NEW: Restore form data when returning from recipe selection
  useEffect(() => {
    if (visible && initialFormData) {
      setTitle(initialFormData.title || '');
      setMealType(initialFormData.mealType || 'dinner');
      if (initialFormData.mealTime) {
        setMealTime(new Date(initialFormData.mealTime));
        setPickerDate(new Date(initialFormData.mealTime));
      }
      setLocation(initialFormData.location || '');
      setDescription(initialFormData.description || '');
      userEditedTitle.current = initialFormData.title ? !isDefaultName(initialFormData.title) : false;
    }
  }, [visible, initialFormData]);

  // Initialize with default values when modal opens
  useEffect(() => {
    if (visible) {
      userEditedTitle.current = false;
      setShowDatePicker(false);
      setShowRecipeSearch(false);
      setRecipeSearchQuery('');
      setRecipeSearchResults([]);
      setSelectedCourse('main');
      
      // Initialize with passed recipe if available
      if (initialRecipeId && initialRecipeTitle) {
        setSelectedRecipe({
          id: initialRecipeId,
          title: initialRecipeTitle,
        });
      } else {
        setSelectedRecipe(null);
      }
      
      if (initialDate) {
        // Set the time to 6 PM (dinner time) on the selected date
        const dateWithTime = new Date(initialDate);
        dateWithTime.setHours(18, 0, 0, 0);
        setMealTime(dateWithTime);
        setPickerDate(dateWithTime);
        setPickerHour(6);
        setPickerMinute(0);
        setPickerAmPm('PM');
        
        // Generate default name
        const defaultName = generateDefaultName(initialDate, 'dinner');
        setTitle(defaultName);
        setMealType('dinner');
      } else {
        setTitle('');
        setMealType('dinner');
        setMealTime(undefined);
        setPickerDate(new Date());
        setPickerHour(6);
        setPickerMinute(0);
        setPickerAmPm('PM');
      }
    }
  }, [visible, initialDate, initialRecipeId, initialRecipeTitle]);

  // Recipe search with debounce
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    if (recipeSearchQuery.trim().length < 2) {
      setRecipeSearchResults([]);
      return;
    }
    
    searchDebounceRef.current = setTimeout(() => {
      searchRecipes(recipeSearchQuery);
    }, 300);
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [recipeSearchQuery]);

  const searchRecipes = async (query: string) => {
    setSearchingRecipes(true);
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, image_url, recipe_type')
        .ilike('title', `%${query}%`)
        .limit(10);
      
      if (error) throw error;
      setRecipeSearchResults(data || []);
    } catch (error) {
      console.error('Error searching recipes:', error);
      setRecipeSearchResults([]);
    } finally {
      setSearchingRecipes(false);
    }
  };

  // Update title when meal type changes (only if using default name)
  const handleMealTypeChange = (newMealType: string | undefined) => {
    setMealType(newMealType);
    
    // If user hasn't manually edited and title is still a default pattern, update it
    if (!userEditedTitle.current && mealTime && newMealType) {
      const newDefaultName = generateDefaultName(mealTime, newMealType);
      setTitle(newDefaultName);
    }
  };

  // Track when user manually edits the title
  const handleTitleChange = (newTitle: string) => {
    // If the new title doesn't match a default pattern, mark as user-edited
    if (!isDefaultName(newTitle)) {
      userEditedTitle.current = true;
    }
    setTitle(newTitle);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setMealType('dinner');
    setMealTime(undefined);
    setLocation('');
    setShowDatePicker(false);
    setShowRecipeSearch(false);
    setRecipeSearchQuery('');
    setRecipeSearchResults([]);
    setSelectedRecipe(null);
    setSelectedCourse('main');
    userEditedTitle.current = false;
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a meal name');
      return;
    }

    setSaving(true);
    try {
      const input: CreateMealInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        meal_type: mealType,
        meal_time: mealTime?.toISOString(),
        meal_location: location.trim() || undefined,
      };

      const result = await createMeal(currentUserId, input);

      if (result.success && result.mealId) {
        // If a recipe was selected, add it to the meal
        if (selectedRecipe) {
          try {
            await createPlanItemWithRecipe(
              result.mealId,
              currentUserId,
              selectedRecipe.id,
              selectedCourse,
              selectedCourse === 'main'
            );
          } catch (recipeError) {
            console.warn('Meal created but recipe not added:', recipeError);
            // Don't fail the whole operation if recipe add fails
          }
        }
        
        resetForm();
        onSuccess(result.mealId);
      } else {
        Alert.alert('Error', result.error || 'Failed to create meal');
      }
    } catch (error) {
      console.error('Error creating meal:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    return date.toLocaleDateString('en-US', options);
  };

  // Initialize picker from mealTime
  const openDatePicker = () => {
    if (mealTime) {
      setPickerDate(new Date(mealTime));
      const hours = mealTime.getHours();
      setPickerHour(hours === 0 ? 12 : hours > 12 ? hours - 12 : hours);
      setPickerMinute(Math.floor(mealTime.getMinutes() / 15) * 15);
      setPickerAmPm(hours >= 12 ? 'PM' : 'AM');
    } else {
      setPickerDate(new Date());
      setPickerHour(6);
      setPickerMinute(0);
      setPickerAmPm('PM');
    }
    setShowDatePicker(true);
  };

  const handleDateConfirm = () => {
    // Build date from picker values
    let hour = pickerHour;
    if (pickerAmPm === 'PM' && hour !== 12) hour += 12;
    if (pickerAmPm === 'AM' && hour === 12) hour = 0;
    
    const newDate = new Date(pickerDate);
    newDate.setHours(hour, pickerMinute, 0, 0);
    
    setMealTime(newDate);
    setShowDatePicker(false);
    
    // Update title if still using default name
    if (!userEditedTitle.current && mealType) {
      const newDefaultName = generateDefaultName(newDate, mealType);
      setTitle(newDefaultName);
    }
  };

  // Calendar helpers
  const getMonthDays = (): (Date | null)[] => {
    const year = pickerDate.getFullYear();
    const month = pickerDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const goToPrevMonth = () => {
    const newDate = new Date(pickerDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setPickerDate(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(pickerDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setPickerDate(newDate);
  };

  const handleDayPress = (day: Date) => {
    const newDate = new Date(pickerDate);
    newDate.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setPickerDate(newDate);
  };

  const isSelectedDay = (day: Date): boolean => {
    return day.toDateString() === pickerDate.toDateString();
  };

  const isToday = (day: Date): boolean => {
    return day.toDateString() === new Date().toDateString();
  };

  const handleRecipeSelect = (recipe: RecipeSearchResult) => {
    setSelectedRecipe(recipe);
    setShowRecipeSearch(false);
    setRecipeSearchQuery('');
    setRecipeSearchResults([]);
  };

  const handleRemoveRecipe = () => {
    setSelectedRecipe(null);
  };

  // NEW: Handler for navigating to recipe selection
  const handleSelectRecipePress = () => {
    if (onSelectRecipe) {
      // Gather current form data
      const formData: FormData = {
        title,
        mealType: mealType || 'dinner',
        mealTime: mealTime?.toISOString() || new Date().toISOString(),
        location,
        description,
      };
      
      // Call the handler (will close modal and navigate)
      onSelectRecipe(formData);
    } else {
      // Fallback to inline search if no handler provided
      setShowRecipeSearch(true);
    }
  };

  // ============================================================================
  // RENDER: Recipe Search View
  // ============================================================================

  const renderRecipeSearchView = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowRecipeSearch(false)}>
          <Text style={styles.cancelButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🍳 Add Recipe</Text>
        <View style={{ width: 60 }} />
      </View>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes..."
          value={recipeSearchQuery}
          onChangeText={setRecipeSearchQuery}
          placeholderTextColor="#9CA3AF"
          autoFocus
        />
      </View>
      
      {searchingRecipes ? (
        <View style={styles.searchLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : recipeSearchResults.length === 0 && recipeSearchQuery.length >= 2 ? (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No recipes found</Text>
        </View>
      ) : (
        <FlatList
          data={recipeSearchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.recipeItem}
              onPress={() => handleRecipeSelect(item)}
            >
              <View style={styles.recipeIcon}>
                <Text style={styles.recipeIconText}>🍳</Text>
              </View>
              <View style={styles.recipeInfo}>
                <Text style={styles.recipeTitle} numberOfLines={1}>{item.title}</Text>
                {item.recipe_type && (
                  <Text style={styles.recipeMeta}>{item.recipe_type}</Text>
                )}
              </View>
              <Text style={styles.selectArrow}>+</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.searchResults}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {showRecipeSearch ? (
            renderRecipeSearchView()
          ) : showDatePicker ? (
            /* Date Picker View */
            <>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.cancelButton}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>📅 Select Date & Time</Text>
                <TouchableOpacity onPress={handleDateConfirm}>
                  <Text style={styles.createButton}>Done</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
                {/* Calendar */}
                <View style={styles.calendarContainer}>
                  {/* Month Header */}
                  <View style={styles.monthHeader}>
                    <TouchableOpacity onPress={goToPrevMonth} style={styles.monthArrow}>
                      <Text style={styles.monthArrowText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.monthTitle}>
                      {MONTHS[pickerDate.getMonth()]} {pickerDate.getFullYear()}
                    </Text>
                    <TouchableOpacity onPress={goToNextMonth} style={styles.monthArrow}>
                      <Text style={styles.monthArrowText}>›</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Weekday Headers */}
                  <View style={styles.weekdayRow}>
                    {WEEKDAYS.map(day => (
                      <Text key={day} style={styles.weekdayText}>{day}</Text>
                    ))}
                  </View>
                  
                  {/* Calendar Grid */}
                  <View style={styles.calendarGrid}>
                    {getMonthDays().map((day, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.dayCell,
                          day && isSelectedDay(day) && styles.dayCellSelected,
                          day && isToday(day) && !isSelectedDay(day) && styles.dayCellToday,
                        ]}
                        onPress={() => day && handleDayPress(day)}
                        disabled={!day}
                      >
                        <Text style={[
                          styles.dayText,
                          day && isSelectedDay(day) && styles.dayTextSelected,
                          day && isToday(day) && !isSelectedDay(day) && styles.dayTextToday,
                          !day && styles.dayTextEmpty,
                        ]}>
                          {day ? day.getDate() : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                {/* Time Picker */}
                <View style={styles.timePickerContainer}>
                  <Text style={styles.timeLabel}>Time</Text>
                  <View style={styles.timeRow}>
                    {/* Hour */}
                    <View style={styles.timeSelector}>
                      <TouchableOpacity 
                        style={styles.timeArrow}
                        onPress={() => setPickerHour(h => h === 12 ? 1 : h + 1)}
                      >
                        <Text style={styles.timeArrowText}>▲</Text>
                      </TouchableOpacity>
                      <Text style={styles.timeValue}>{pickerHour}</Text>
                      <TouchableOpacity 
                        style={styles.timeArrow}
                        onPress={() => setPickerHour(h => h === 1 ? 12 : h - 1)}
                      >
                        <Text style={styles.timeArrowText}>▼</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.timeColon}>:</Text>
                    
                    {/* Minute */}
                    <View style={styles.timeSelector}>
                      <TouchableOpacity 
                        style={styles.timeArrow}
                        onPress={() => setPickerMinute(m => m === 45 ? 0 : m + 15)}
                      >
                        <Text style={styles.timeArrowText}>▲</Text>
                      </TouchableOpacity>
                      <Text style={styles.timeValue}>{String(pickerMinute).padStart(2, '0')}</Text>
                      <TouchableOpacity 
                        style={styles.timeArrow}
                        onPress={() => setPickerMinute(m => m === 0 ? 45 : m - 15)}
                      >
                        <Text style={styles.timeArrowText}>▼</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* AM/PM */}
                    <View style={styles.ampmSelector}>
                      <TouchableOpacity 
                        style={[styles.ampmButton, pickerAmPm === 'AM' && styles.ampmButtonActive]}
                        onPress={() => setPickerAmPm('AM')}
                      >
                        <Text style={[styles.ampmText, pickerAmPm === 'AM' && styles.ampmTextActive]}>AM</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.ampmButton, pickerAmPm === 'PM' && styles.ampmButtonActive]}
                        onPress={() => setPickerAmPm('PM')}
                      >
                        <Text style={[styles.ampmText, pickerAmPm === 'PM' && styles.ampmTextActive]}>PM</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                
                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          ) : (
            /* Form View */
            <>
              <View style={styles.header}>
                <TouchableOpacity onPress={handleClose} disabled={saving}>
                  <Text style={[styles.cancelButton, saving && styles.disabled]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.title}>🍽️ Create Meal</Text>
                <TouchableOpacity onPress={handleCreate} disabled={saving || !title.trim()}>
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[
                      styles.createButton,
                      (!title.trim()) && styles.disabled
                    ]}>
                      Create
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.form} 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* ============================================================ */}
                {/* QUICK ADD RECIPE SECTION - NEW! */}
                {/* ============================================================ */}
                <View style={styles.quickAddSection}>
                  <Text style={styles.quickAddLabel}>🍳 Quick Add Recipe</Text>
                  
                  {selectedRecipe ? (
                    <View style={styles.selectedRecipeCard}>
                      <View style={styles.selectedRecipeInfo}>
                        <Text style={styles.selectedRecipeTitle} numberOfLines={1}>
                          {selectedRecipe.title}
                        </Text>
                        
                        {/* Course selector */}
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          style={styles.courseScrollView}
                          contentContainerStyle={styles.courseContainer}
                        >
                          {COURSE_OPTIONS.map((course) => (
                            <TouchableOpacity
                              key={course.type}
                              style={[
                                styles.courseChip,
                                selectedCourse === course.type && styles.courseChipSelected,
                              ]}
                              onPress={() => setSelectedCourse(course.type)}
                            >
                              <Text style={styles.courseChipEmoji}>{course.emoji}</Text>
                              <Text style={[
                                styles.courseChipText,
                                selectedCourse === course.type && styles.courseChipTextSelected,
                              ]}>
                                {course.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <TouchableOpacity
                        style={styles.removeRecipeButton}
                        onPress={handleRemoveRecipe}
                      >
                        <Text style={styles.removeRecipeText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addRecipeButton}
                      onPress={handleSelectRecipePress}
                    >
                      <Text style={styles.addRecipeIcon}>+</Text>
                      <Text style={styles.addRecipeText}>Add a recipe to this meal</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Divider */}
                <View style={styles.sectionDivider} />

                {/* Meal Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Meal Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Sunday Dinner, Friendsgiving, Date Night"
                    value={title}
                    onChangeText={handleTitleChange}
                    placeholderTextColor="#9CA3AF"
                    maxLength={100}
                  />
                </View>

                {/* Meal Type */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Meal Type</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.mealTypeContainer}
                  >
                    {MEAL_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.mealTypeButton,
                          mealType === type.value && styles.mealTypeButtonActive,
                        ]}
                        onPress={() => handleMealTypeChange(
                          mealType === type.value ? undefined : type.value
                        )}
                      >
                        <Text style={styles.mealTypeEmoji}>{type.emoji}</Text>
                        <Text style={[
                          styles.mealTypeLabel,
                          mealType === type.value && styles.mealTypeLabelActive,
                        ]}>
                          {type.label.split(' ')[1]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* When */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>When (optional)</Text>
                  {mealTime ? (
                    <View style={styles.selectedDateContainer}>
                      <TouchableOpacity 
                        style={styles.dateDisplayButton}
                        onPress={openDatePicker}
                      >
                        <Text style={styles.selectedDateText}>
                          📅 {formatDate(mealTime)}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setMealTime(undefined)}>
                        <Text style={styles.clearDateButton}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.addDateButton}
                      onPress={openDatePicker}
                    >
                      <Text style={styles.addDateButtonText}>+ Add date & time</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Location */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Location (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Home, Mom's house, Restaurant name"
                    value={location}
                    onChangeText={setLocation}
                    placeholderTextColor="#9CA3AF"
                    maxLength={100}
                  />
                </View>

                {/* Description */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Description (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Add any notes about this meal..."
                    value={description}
                    onChangeText={setDescription}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                  />
                </View>

                {/* Info Box */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoEmoji}>💡</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>What's a Meal?</Text>
                    <Text style={styles.infoText}>
                      A meal groups multiple dishes together. After creating, you can add more dishes or invite friends to contribute theirs!
                    </Text>
                  </View>
                </View>

                {/* Spacer for keyboard */}
                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
  },
  createButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Quick Add Recipe Section Styles
  quickAddSection: {
    marginBottom: 8,
  },
  quickAddLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  addRecipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderStyle: 'dashed',
  },
  addRecipeIcon: {
    fontSize: 20,
    fontWeight: '600',
    color: '#16A34A',
    marginRight: 10,
  },
  addRecipeText: {
    fontSize: 15,
    color: '#16A34A',
    fontWeight: '500',
  },
  selectedRecipeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedRecipeInfo: {
    flex: 1,
  },
  selectedRecipeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1D4ED8',
    marginBottom: 8,
  },
  courseScrollView: {
    marginTop: 4,
  },
  courseContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  courseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  courseChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  courseChipEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  courseChipText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  courseChipTextSelected: {
    color: 'white',
  },
  removeRecipeButton: {
    padding: 4,
    marginLeft: 8,
  },
  removeRecipeText: {
    fontSize: 16,
    color: '#6B7280',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  // Recipe Search Styles
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 16,
    color: '#111',
  },
  searchLoading: {
    padding: 40,
    alignItems: 'center',
  },
  noResults: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 15,
    color: '#6B7280',
  },
  searchResults: {
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recipeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipeIconText: {
    fontSize: 20,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
  },
  recipeMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  selectArrow: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: '500',
  },
  // Original Form Styles
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  mealTypeContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  mealTypeButton: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    minWidth: 70,
  },
  mealTypeButtonActive: {
    backgroundColor: colors.primary,
  },
  mealTypeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  mealTypeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  mealTypeLabelActive: {
    color: 'white',
  },
  addDateButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  addDateButtonText: {
    fontSize: 15,
    color: '#6B7280',
  },
  selectedDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dateDisplayButton: {
    flex: 1,
  },
  selectedDateText: {
    fontSize: 15,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  clearDateButton: {
    fontSize: 18,
    color: '#6B7280',
    padding: 4,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  infoEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  // Calendar styles
  calendarContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthArrow: {
    padding: 8,
  },
  monthArrowText: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: '300',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
  },
  dayText: {
    fontSize: 16,
    color: '#374151',
  },
  dayTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '600',
  },
  dayTextEmpty: {
    color: 'transparent',
  },
  // Time picker styles
  timePickerContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeSelector: {
    alignItems: 'center',
  },
  timeArrow: {
    padding: 8,
  },
  timeArrowText: {
    fontSize: 14,
    color: colors.primary,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '600',
    color: '#111',
    width: 50,
    textAlign: 'center',
  },
  timeColon: {
    fontSize: 32,
    fontWeight: '600',
    color: '#111',
    marginHorizontal: 4,
  },
  ampmSelector: {
    flexDirection: 'column',
    marginLeft: 16,
  },
  ampmButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  ampmButtonActive: {
    backgroundColor: colors.primary,
  },
  ampmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  ampmTextActive: {
    color: 'white',
  },
});