// components/SelectMealForRecipeModal.tsx
// Modal for adding a recipe to a meal plan (before cooking)
// Different from SelectMealModal which adds completed dishes to meals
// Created: December 3, 2025

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../lib/theme';
import {
  getUserPlanningMeals,
  getUnclaimedPlanItems,
  addRecipeToPlanItem,
  volunteerWithRecipe,
  MealPlanItem,
  CourseType,
  getCourseEmoji,
  getCourseDisplayName,
  getPlanItemDisplayName,
} from '../lib/services/mealPlanService';

interface PlanningMeal {
  meal_id: string;
  title: string;
  meal_time?: string;
  role: string;
  unclaimed_count: number;
}

interface SelectMealForRecipeModalProps {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  recipeTitle: string;
  currentUserId: string;
  onSuccess?: (mealId: string, mealTitle: string) => void;
  onCreateNewMeal?: () => void;
}

type Step = 'select_meal' | 'select_slot' | 'select_course';

const COURSE_OPTIONS: { type: CourseType; emoji: string; label: string }[] = [
  { type: 'appetizer', emoji: '🥗', label: 'Appetizer' },
  { type: 'main', emoji: '🍖', label: 'Main' },
  { type: 'side', emoji: '🥔', label: 'Side' },
  { type: 'dessert', emoji: '🍰', label: 'Dessert' },
  { type: 'drink', emoji: '🍷', label: 'Drink' },
  { type: 'other', emoji: '🍽️', label: 'Other' },
];

export default function SelectMealForRecipeModal({
  visible,
  onClose,
  recipeId,
  recipeTitle,
  currentUserId,
  onSuccess,
  onCreateNewMeal,
}: SelectMealForRecipeModalProps) {
  const [step, setStep] = useState<Step>('select_meal');
  const [meals, setMeals] = useState<PlanningMeal[]>([]);
  const [unclaimedSlots, setUnclaimedSlots] = useState<MealPlanItem[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<PlanningMeal | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseType>('main');
  const [isMainDish, setIsMainDish] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadMeals();
      resetState();
    }
  }, [visible]);

  const resetState = () => {
    setStep('select_meal');
    setSelectedMeal(null);
    setUnclaimedSlots([]);
    setSelectedCourse('main');
    setIsMainDish(true);
  };

  const loadMeals = async () => {
    setLoading(true);
    try {
      const data = await getUserPlanningMeals(currentUserId);
      setMeals(data);
    } catch (error) {
      console.error('Error loading meals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMealSelect = async (meal: PlanningMeal) => {
    setSelectedMeal(meal);
    setLoading(true);
    
    try {
      // Load unclaimed slots for this meal
      const slots = await getUnclaimedPlanItems(meal.meal_id);
      setUnclaimedSlots(slots);
      setStep('select_slot');
    } catch (error) {
      console.error('Error loading slots:', error);
      Alert.alert('Error', 'Failed to load meal details');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = async (slot: MealPlanItem) => {
    // Claim the slot and add recipe
    setSaving(true);
    try {
      const result = await addRecipeToPlanItem(slot.id, currentUserId, recipeId);
      
      if (result.success) {
        Alert.alert(
          'Added! 🎉',
          `"${recipeTitle}" has been added to ${selectedMeal?.title}`,
          [{ text: 'OK', onPress: () => {
            onSuccess?.(selectedMeal!.meal_id, selectedMeal!.title);
            onClose();
          }}]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to add recipe');
      }
    } catch (error) {
      console.error('Error adding to slot:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewSlot = () => {
    setStep('select_course');
  };

  const handleCourseConfirm = async () => {
    if (!selectedMeal) return;
    
    setSaving(true);
    try {
      const result = await volunteerWithRecipe(
        selectedMeal.meal_id,
        currentUserId,
        recipeId,
        selectedCourse,
        isMainDish
      );
      
      if (result.success) {
        Alert.alert(
          'Added! 🎉',
          `"${recipeTitle}" has been added to ${selectedMeal.title}`,
          [{ text: 'OK', onPress: () => {
            onSuccess?.(selectedMeal.meal_id, selectedMeal.title);
            onClose();
          }}]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to add recipe');
      }
    } catch (error) {
      console.error('Error volunteering:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
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
    if (step === 'select_course') {
      setStep('select_slot');
    } else if (step === 'select_slot') {
      setStep('select_meal');
      setSelectedMeal(null);
    } else {
      onClose();
    }
  };

  // ============================================================================
  // RENDER: Step 1 - Select Meal
  // ============================================================================
  const renderSelectMealStep = () => (
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : meals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>No planning meals</Text>
          <Text style={styles.emptyText}>
            You need to be part of a meal that's being planned to add recipes.
          </Text>
          {onCreateNewMeal && (
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => {
                onClose();
                onCreateNewMeal();
              }}
            >
              <Text style={styles.createButtonText}>+ Create New Meal</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {onCreateNewMeal && (
            <TouchableOpacity 
              style={styles.createNewRow}
              onPress={() => {
                onClose();
                onCreateNewMeal();
              }}
            >
              <Text style={styles.createNewText}>+ Create New Meal</Text>
            </TouchableOpacity>
          )}
          <FlatList
            data={meals}
            keyExtractor={(item) => item.meal_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.mealItem}
                onPress={() => handleMealSelect(item)}
              >
                <View style={styles.mealEmoji}>
                  <Text style={styles.mealEmojiText}>📅</Text>
                </View>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.mealMeta}>
                    {item.meal_time ? formatDate(item.meal_time) : 'No date set'}
                    {item.unclaimed_count > 0 && ` · ${item.unclaimed_count} open ${item.unclaimed_count === 1 ? 'slot' : 'slots'}`}
                  </Text>
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
        </>
      )}
    </>
  );

  // ============================================================================
  // RENDER: Step 2 - Select Slot
  // ============================================================================
  const renderSelectSlotStep = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Select Slot</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{selectedMeal?.title}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.slotContainer}>
          {/* Always show option to create new */}
          <TouchableOpacity 
            style={styles.createNewSlotRow}
            onPress={handleCreateNewSlot}
          >
            <View style={styles.slotIcon}>
              <Text style={styles.slotIconText}>➕</Text>
            </View>
            <View style={styles.slotInfo}>
              <Text style={styles.createNewSlotText}>Add as new item</Text>
              <Text style={styles.slotMeta}>I'll bring this recipe</Text>
            </View>
          </TouchableOpacity>

          {/* Show unclaimed slots if any */}
          {unclaimedSlots.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Or claim an open slot:</Text>
              <FlatList
                data={unclaimedSlots}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.slotItem}
                    onPress={() => handleSlotSelect(item)}
                    disabled={saving}
                  >
                    <View style={styles.slotIcon}>
                      <Text style={styles.slotIconText}>{getCourseEmoji(item.course_type)}</Text>
                    </View>
                    <View style={styles.slotInfo}>
                      <Text style={styles.slotTitle}>
                        {item.placeholder_name || getCourseDisplayName(item.course_type)}
                      </Text>
                      <Text style={styles.slotMeta}>
                        {getCourseDisplayName(item.course_type)}
                        {item.is_main_dish && ' · Main dish'}
                      </Text>
                    </View>
                    <Text style={styles.arrow}>›</Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </>
          )}

          {unclaimedSlots.length === 0 && (
            <View style={styles.noSlotsInfo}>
              <Text style={styles.noSlotsText}>
                No open slots in this meal. Tap "Add as new item" to volunteer with your recipe.
              </Text>
            </View>
          )}
        </View>
      )}

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.savingText}>Adding recipe...</Text>
        </View>
      )}
    </>
  );

  // ============================================================================
  // RENDER: Step 3 - Select Course (for new slot)
  // ============================================================================
  const renderSelectCourseStep = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Course Type</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{recipeTitle}</Text>
        </View>
        <TouchableOpacity 
          onPress={handleCourseConfirm}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.addButton}>Add</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.courseContainer}>
        <Text style={styles.courseLabel}>What course is this?</Text>
        
        <View style={styles.courseGrid}>
          {COURSE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.type}
              style={[
                styles.courseOption,
                selectedCourse === option.type && styles.courseOptionSelected
              ]}
              onPress={() => setSelectedCourse(option.type)}
            >
              <Text style={styles.courseEmoji}>{option.emoji}</Text>
              <Text style={[
                styles.courseOptionText,
                selectedCourse === option.type && styles.courseOptionTextSelected
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main dish toggle for main course */}
        {selectedCourse === 'main' && (
          <TouchableOpacity
            style={styles.mainDishToggle}
            onPress={() => setIsMainDish(!isMainDish)}
          >
            <View style={[styles.checkbox, isMainDish && styles.checkboxChecked]}>
              {isMainDish && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.mainDishText}>This is the main dish of the meal</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {step === 'select_meal' && renderSelectMealStep()}
          {step === 'select_slot' && renderSelectSlotStep()}
          {step === 'select_course' && renderSelectCourseStep()}
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
    maxHeight: '80%',
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  createNewRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  createNewText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    color: '#111',
    marginBottom: 2,
  },
  mealMeta: {
    fontSize: 13,
    color: '#6B7280',
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
    color: '#9CA3AF',
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
    color: '#111',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  createButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  // Slot selection styles
  slotContainer: {
    padding: 16,
  },
  createNewSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    marginBottom: 16,
  },
  createNewSlotText: {
    fontSize: 16,
    color: '#166534',
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    marginTop: 8,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  slotIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  slotIconText: {
    fontSize: 20,
  },
  slotInfo: {
    flex: 1,
  },
  slotTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
    marginBottom: 2,
  },
  slotMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  noSlotsInfo: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginTop: 8,
  },
  noSlotsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  // Course selection styles
  courseContainer: {
    padding: 20,
  },
  courseLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
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
    backgroundColor: '#F9FAFB',
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
    color: '#6B7280',
    fontWeight: '500',
  },
  courseOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  mainDishToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  mainDishText: {
    fontSize: 15,
    color: '#374151',
  },
});