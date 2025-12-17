// components/meals/SelectMealModal.tsx
// Modal for selecting a meal to add a dish to
// Created: December 2, 2025

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
  getUserRecentMeals,
  addDishesToMeal,
  CourseType,
  MealStatus,
} from '../lib/services/mealService';
import CourseCategoryPicker from './CourseCategoryPicker';

interface RecentMeal {
  meal_id: string;
  title: string;
  meal_status: MealStatus;
  meal_time?: string;
  dish_count: number;
  participant_count: number;
  user_role: string;
}

interface SelectMealModalProps {
  visible: boolean;
  onClose: () => void;
  dishId: string;
  dishTitle: string;
  currentUserId: string;
  defaultCourse?: CourseType;
  onSuccess?: () => void;
  onCreateNewMeal?: () => void;
}

export default function SelectMealModal({
  visible,
  onClose,
  dishId,
  dishTitle,
  currentUserId,
  defaultCourse = 'main',
  onSuccess,
  onCreateNewMeal,
}: SelectMealModalProps) {
  const [meals, setMeals] = useState<RecentMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseType>(defaultCourse);
  const [isMainDish, setIsMainDish] = useState(defaultCourse === 'main');
  const [step, setStep] = useState<'select_meal' | 'select_course'>('select_meal');

  useEffect(() => {
    if (visible) {
      loadMeals();
      setStep('select_meal');
      setSelectedMealId(null);
      setSelectedCourse(defaultCourse);
      setIsMainDish(defaultCourse === 'main');
    }
  }, [visible]);

  const loadMeals = async () => {
    setLoading(true);
    try {
      const data = await getUserRecentMeals(currentUserId, 15);
      setMeals(data);
    } catch (error) {
      console.error('Error loading meals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMealSelect = (mealId: string) => {
    setSelectedMealId(mealId);
    setStep('select_course');
  };

  const handleAddToMeal = async () => {
    if (!selectedMealId) return;

    setSaving(true);
    try {
      const result = await addDishesToMeal(
        selectedMealId,
        currentUserId,
        [{
          dish_id: dishId,
          course_type: selectedCourse,
          is_main_dish: isMainDish,
        }]
      );

      if (result.success) {
        const selectedMeal = meals.find(m => m.meal_id === selectedMealId);
        Alert.alert(
          'Added!',
          `"${dishTitle}" has been added to ${selectedMeal?.title || 'the meal'}`,
          [{ text: 'OK', onPress: () => {
            onSuccess?.();
            onClose();
          }}]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to add dish to meal');
      }
    } catch (error) {
      console.error('Error adding dish to meal:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const renderMealItem = ({ item }: { item: RecentMeal }) => (
    <TouchableOpacity
      style={styles.mealItem}
      onPress={() => handleMealSelect(item.meal_id)}
    >
      <View style={styles.mealEmoji}>
        <Text style={styles.mealEmojiText}>🍽️</Text>
      </View>
      <View style={styles.mealInfo}>
        <Text style={styles.mealTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.mealMeta}>
          {item.dish_count} {item.dish_count === 1 ? 'dish' : 'dishes'} · {item.participant_count} {item.participant_count === 1 ? 'person' : 'people'}
          {item.meal_time && ` · ${formatDate(item.meal_time)}`}
        </Text>
      </View>
      <View style={[
        styles.statusBadge,
        item.meal_status === 'completed' ? styles.statusCompleted : styles.statusPlanning
      ]}>
        <Text style={styles.statusText}>
          {item.meal_status === 'completed' ? '✓' : '📝'}
        </Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  const renderSelectMealStep = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Add to Meal</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{dishTitle}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : meals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={styles.emptyTitle}>No meals yet</Text>
          <Text style={styles.emptyText}>
            Create a meal to group dishes together
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
            renderItem={renderMealItem}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </>
  );

  const renderSelectCourseStep = () => {
    const selectedMeal = meals.find(m => m.meal_id === selectedMealId);
    
    return (
      <>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('select_meal')}>
            <Text style={styles.backButton}>‹ Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Select Course</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{selectedMeal?.title}</Text>
          </View>
          <TouchableOpacity 
            onPress={handleAddToMeal}
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
          <Text style={styles.sectionLabel}>
            What course is "{dishTitle}"?
          </Text>
          
          <CourseCategoryPicker
            selectedCourse={selectedCourse}
            onSelect={setSelectedCourse}
            showIsMainDish={true}
            isMainDish={isMainDish}
            onIsMainDishChange={setIsMainDish}
            layout="grid"
            size="large"
          />
        </View>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {step === 'select_meal' ? renderSelectMealStep() : renderSelectCourseStep()}
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
    backgroundColor: '#FFF7ED',
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  statusPlanning: {
    backgroundColor: '#FEF3C7',
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
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
  courseContainer: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 16,
  },
});