// components/DayMealsModal.tsx
// Modal that appears when tapping a day in the calendar view
// Shows meals for that day with View/Add options
// Created: December 10, 2025

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

interface MealSummary {
  id: string;
  title: string;
  meal_time?: string;
  meal_type?: string;
  participant_count: number;
  meal_status: 'planning' | 'completed';
}

interface DayMealsModalProps {
  visible: boolean;
  onClose: () => void;
  date: Date | null;
  meals: MealSummary[];
  onViewMeal: (mealId: string) => void;
  onAddMeal: (date: Date) => void;
}

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

export default function DayMealsModal({
  visible,
  onClose,
  date,
  meals,
  onViewMeal,
  onAddMeal,
}: DayMealsModalProps) {
  const { colors, functionalColors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    container: {
      backgroundColor: colors.background.card,
      borderRadius: 20,
      padding: 20,
      width: '100%',
      maxWidth: 360,
      maxHeight: '70%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      gap: 10,
    },
    dateText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      textAlign: 'center',
    },
    todayBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.background.card,
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      overflow: 'hidden',
    },
    mealsList: {
      maxHeight: 200,
    },
    mealItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    mealInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    mealEmoji: {
      fontSize: 28,
      marginRight: 12,
    },
    mealDetails: {
      flex: 1,
    },
    mealTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 2,
    },
    mealMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    mealTime: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    mealParticipants: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusPlanning: {
      backgroundColor: functionalColors.warning,
    },
    statusCompleted: {
      backgroundColor: functionalColors.success,
    },
    viewArrow: {
      fontSize: 24,
      color: colors.text.tertiary,
      marginLeft: 8,
    },
    actions: {
      marginTop: 16,
      gap: 10,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.background.secondary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '500',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    emptyEmoji: {
      fontSize: 48,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    closeButton: {
      marginTop: 16,
      paddingVertical: 10,
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 15,
      color: colors.text.secondary,
    },
  }), [colors, functionalColors]);

  if (!date) return null;

  const formatDate = (d: Date): string => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    return d.toLocaleDateString('en-US', options);
  };

  const formatTime = (timeString?: string): string => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isToday = date.toDateString() === new Date().toDateString();
  const isFuture = date > new Date();
  const hasMeals = meals.length > 0;

  const handleAddMeal = () => {
    onClose();
    onAddMeal(date);
  };

  const handleViewMeal = (mealId: string) => {
    onClose();
    onViewMeal(mealId);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            {isToday && <Text style={styles.todayBadge}>Today</Text>}
          </View>

          {/* Content */}
          {hasMeals ? (
            <>
              {/* Meals List */}
              <ScrollView style={styles.mealsList} showsVerticalScrollIndicator={false}>
                {meals.map((meal) => (
                  <TouchableOpacity
                    key={meal.id}
                    style={styles.mealItem}
                    onPress={() => handleViewMeal(meal.id)}
                  >
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealEmoji}>
                        {MEAL_TYPE_EMOJIS[meal.meal_type || 'other'] || '🍽️'}
                      </Text>
                      <View style={styles.mealDetails}>
                        <Text style={styles.mealTitle} numberOfLines={1}>
                          {meal.title}
                        </Text>
                        <View style={styles.mealMeta}>
                          {meal.meal_time && (
                            <Text style={styles.mealTime}>
                              {formatTime(meal.meal_time)}
                            </Text>
                          )}
                          <Text style={styles.mealParticipants}>
                            {meal.participant_count}
                          </Text>
                          <View style={[
                            styles.statusDot,
                            meal.meal_status === 'planning'
                              ? styles.statusPlanning
                              : styles.statusCompleted
                          ]} />
                        </View>
                      </View>
                    </View>
                    <Text style={styles.viewArrow}>></Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.actions}>
                {meals.length === 1 ? (
                  <>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={() => handleViewMeal(meals[0].id)}
                    >
                      <Text style={styles.primaryButtonText}>View Meal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={handleAddMeal}
                    >
                      <Text style={styles.secondaryButtonText}>+ Add Another Meal</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleAddMeal}
                  >
                    <Text style={styles.secondaryButtonText}>+ Add Another Meal</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            /* No Meals - Empty State */
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyText}>
                {isFuture || isToday
                  ? 'No meals planned for this day'
                  : 'No meals recorded for this day'}
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleAddMeal}
              >
                <Text style={styles.primaryButtonText}>+ Add Meal</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
