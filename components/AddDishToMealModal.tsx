// components/meals/AddDishToMealModal.tsx
// Modal for adding dishes to a meal (4 tabs)
// Created: December 2, 2025

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import {
  addDishesToMeal,
  getUserAvailableDishes,
  CourseType,
  AddDishInput,
} from '../lib/services/mealService';

interface AvailableDish {
  id: string;
  title: string;
  recipe_title?: string;
  recipe_image_url?: string;
  rating?: number;
  created_at: string;
}

interface AddDishToMealModalProps {
  visible: boolean;
  onClose: () => void;
  mealId: string;
  mealTitle: string;
  currentUserId: string;
  onDishesAdded?: () => void;
}

type TabType = 'my_dishes' | 'cook_new' | 'recipes' | 'friends';

const COURSE_OPTIONS: { value: CourseType; label: string; emoji: string }[] = [
  { value: 'appetizer', label: 'Appetizer', emoji: '🥗' },
  { value: 'main', label: 'Main', emoji: '🍖' },
  { value: 'side', label: 'Side', emoji: '🥔' },
  { value: 'dessert', label: 'Dessert', emoji: '🍰' },
  { value: 'drink', label: 'Drink', emoji: '🍷' },
  { value: 'other', label: 'Other', emoji: '🍽️' },
];

export default function AddDishToMealModal({
  visible,
  onClose,
  mealId,
  mealTitle,
  currentUserId,
  onDishesAdded,
}: AddDishToMealModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('my_dishes');
  const [myDishes, setMyDishes] = useState<AvailableDish[]>([]);
  const [selectedDishes, setSelectedDishes] = useState<Map<string, CourseType>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // For course selection
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [pendingDishId, setPendingDishId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadMyDishes();
      setSelectedDishes(new Map());
      setSearchQuery('');
    }
  }, [visible]);

  const loadMyDishes = async () => {
    setLoading(true);
    try {
      const dishes = await getUserAvailableDishes(currentUserId);
      setMyDishes(dishes);
    } catch (error) {
      console.error('Error loading dishes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDishPress = (dishId: string) => {
    if (selectedDishes.has(dishId)) {
      // Deselect
      const newSelected = new Map(selectedDishes);
      newSelected.delete(dishId);
      setSelectedDishes(newSelected);
    } else {
      // Show course picker
      setPendingDishId(dishId);
      setShowCoursePicker(true);
    }
  };

  const handleCourseSelect = (courseType: CourseType) => {
    if (pendingDishId) {
      const newSelected = new Map(selectedDishes);
      newSelected.set(pendingDishId, courseType);
      setSelectedDishes(newSelected);
    }
    setShowCoursePicker(false);
    setPendingDishId(null);
  };

  const handleAddDishes = async () => {
    if (selectedDishes.size === 0) {
      Alert.alert('No Selection', 'Please select at least one dish');
      return;
    }

    setSaving(true);
    try {
      const dishes: AddDishInput[] = Array.from(selectedDishes.entries()).map(
        ([dish_id, course_type]) => ({
          dish_id,
          course_type,
          is_main_dish: course_type === 'main',
        })
      );

      const result = await addDishesToMeal(mealId, currentUserId, dishes);

      if (result.success) {
        Alert.alert(
          'Success',
          `Added ${result.addedCount} ${result.addedCount === 1 ? 'dish' : 'dishes'} to ${mealTitle}`,
          [{ text: 'OK', onPress: () => {
            onDishesAdded?.();
            onClose();
          }}]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to add dishes');
      }
    } catch (error) {
      console.error('Error adding dishes:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const filteredDishes = myDishes.filter(dish => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      dish.title?.toLowerCase().includes(query) ||
      dish.recipe_title?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const renderDishItem = ({ item }: { item: AvailableDish }) => {
    const isSelected = selectedDishes.has(item.id);
    const selectedCourse = selectedDishes.get(item.id);
    const courseInfo = COURSE_OPTIONS.find(c => c.value === selectedCourse);

    return (
      <TouchableOpacity
        style={[styles.dishItem, isSelected && styles.dishItemSelected]}
        onPress={() => handleDishPress(item.id)}
      >
        <View style={styles.dishImageContainer}>
          {item.recipe_image_url ? (
            <Image
              source={{ uri: item.recipe_image_url }}
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
            {item.recipe_title || item.title}
          </Text>
          <Text style={styles.dishMeta}>
            {formatDate(item.created_at)}
            {item.rating && ` · ${'⭐'.repeat(item.rating)}`}
          </Text>
          {isSelected && courseInfo && (
            <View style={styles.selectedCourseTag}>
              <Text style={styles.selectedCourseText}>
                {courseInfo.emoji} {courseInfo.label}
              </Text>
            </View>
          )}
        </View>

        <View style={[
          styles.checkbox,
          isSelected && styles.checkboxSelected,
        ]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'my_dishes':
        return (
          <>
            {/* Search */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search your dishes..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#999"
              />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={filteredDishes}
                keyExtractor={(item) => item.id}
                renderItem={renderDishItem}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>🍳</Text>
                    <Text style={styles.emptyText}>
                      {searchQuery
                        ? 'No dishes found'
                        : 'No available dishes from the last 30 days'
                      }
                    </Text>
                    <Text style={styles.emptySubtext}>
                      Cook something new to add it here!
                    </Text>
                  </View>
                }
                contentContainerStyle={styles.listContent}
              />
            )}
          </>
        );

      case 'cook_new':
        return (
          <View style={styles.tabPlaceholder}>
            <Text style={styles.placeholderEmoji}>🧑‍🍳</Text>
            <Text style={styles.placeholderTitle}>Cook Something New</Text>
            <Text style={styles.placeholderText}>
              Go to your recipes and start cooking!{'\n'}
              The dish will be available to add here after.
            </Text>
            <TouchableOpacity 
              style={styles.ctaButton}
              onPress={() => {
                // TODO: Navigate to recipe list
                onClose();
              }}
            >
              <Text style={styles.ctaButtonText}>Browse Recipes</Text>
            </TouchableOpacity>
          </View>
        );

      case 'recipes':
        return (
          <View style={styles.tabPlaceholder}>
            <Text style={styles.placeholderEmoji}>📚</Text>
            <Text style={styles.placeholderTitle}>From Recipes</Text>
            <Text style={styles.placeholderText}>
              Select recipes to cook and add to this meal.
            </Text>
            <Text style={styles.comingSoon}>Coming soon!</Text>
          </View>
        );

      case 'friends':
        return (
          <View style={styles.tabPlaceholder}>
            <Text style={styles.placeholderEmoji}>👥</Text>
            <Text style={styles.placeholderTitle}>Friends' Dishes</Text>
            <Text style={styles.placeholderText}>
              Request to add dishes your friends have cooked.
            </Text>
            <Text style={styles.comingSoon}>Coming soon!</Text>
          </View>
        );
    }
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={[styles.cancelButton, saving && styles.disabled]}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Add Dishes</Text>
              <Text style={styles.subtitle} numberOfLines={1}>to {mealTitle}</Text>
            </View>
            <TouchableOpacity 
              onPress={handleAddDishes} 
              disabled={saving || selectedDishes.size === 0}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[
                  styles.addButton,
                  selectedDishes.size === 0 && styles.disabled
                ]}>
                  Add ({selectedDishes.size})
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'my_dishes' && styles.tabActive]}
              onPress={() => setActiveTab('my_dishes')}
            >
              <Text style={[styles.tabText, activeTab === 'my_dishes' && styles.tabTextActive]}>
                My Dishes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'cook_new' && styles.tabActive]}
              onPress={() => setActiveTab('cook_new')}
            >
              <Text style={[styles.tabText, activeTab === 'cook_new' && styles.tabTextActive]}>
                Cook New
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'recipes' && styles.tabActive]}
              onPress={() => setActiveTab('recipes')}
            >
              <Text style={[styles.tabText, activeTab === 'recipes' && styles.tabTextActive]}>
                Recipes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
              onPress={() => setActiveTab('friends')}
            >
              <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
                Friends
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {renderTabContent()}
          </View>
        </View>
      </View>

      {/* Course Picker Modal */}
      <Modal
        visible={showCoursePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCoursePicker(false)}
      >
        <TouchableOpacity 
          style={styles.coursePickerOverlay}
          activeOpacity={1}
          onPress={() => setShowCoursePicker(false)}
        >
          <View style={styles.coursePickerContent}>
            <Text style={styles.coursePickerTitle}>Select Course</Text>
            {COURSE_OPTIONS.map(course => (
              <TouchableOpacity
                key={course.value}
                style={styles.courseOption}
                onPress={() => handleCourseSelect(course.value)}
              >
                <Text style={styles.courseEmoji}>{course.emoji}</Text>
                <Text style={styles.courseLabel}>{course.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
    height: '90%',
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
  },
  addButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dishItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dishItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
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
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 4,
  },
  dishMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  selectedCourseTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  selectedCourseText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  tabPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  placeholderEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  comingSoon: {
    marginTop: 20,
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  ctaButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  coursePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coursePickerContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  coursePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  courseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  courseEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  courseLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
});