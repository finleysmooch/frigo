// components/WeekCalendarPicker.tsx
// Compact week view calendar for quick date selection
// Created: December 10, 2025

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors } from '../lib/theme';

interface WeekCalendarPickerProps {
  selectedDate?: Date;
  onSelectDate: (date: Date) => void;
  weeksToShow?: number; // How many weeks to display (default: 2)
  showTimeSlots?: boolean; // Whether to show meal time slots
  onSelectMealTime?: (date: Date, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MEAL_TIMES: { type: 'breakfast' | 'lunch' | 'dinner'; label: string; emoji: string; hour: number }[] = [
  { type: 'breakfast', label: 'Breakfast', emoji: '🌅', hour: 8 },
  { type: 'lunch', label: 'Lunch', emoji: '☀️', hour: 12 },
  { type: 'dinner', label: 'Dinner', emoji: '🌙', hour: 18 },
];

export default function WeekCalendarPicker({
  selectedDate,
  onSelectDate,
  weeksToShow = 2,
  showTimeSlots = false,
  onSelectMealTime,
}: WeekCalendarPickerProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(selectedDate || null);

  // Generate days for the next N weeks starting from today
  const days = useMemo(() => {
    const result: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Start from today
    for (let i = 0; i < weeksToShow * 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      result.push(day);
    }
    return result;
  }, [weeksToShow]);

  // Group days by week
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTomorrow = (date: Date): boolean => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  const isSelected = (date: Date): boolean => {
    if (!selectedDay) return false;
    return date.toDateString() === selectedDay.toDateString();
  };

  const handleDayPress = (date: Date) => {
    setSelectedDay(date);
    if (!showTimeSlots) {
      // If not showing time slots, set to dinner time by default
      const dateWithTime = new Date(date);
      dateWithTime.setHours(18, 0, 0, 0);
      onSelectDate(dateWithTime);
    }
  };

  const handleMealTimePress = (mealTime: typeof MEAL_TIMES[0]) => {
    if (!selectedDay) return;
    
    const dateWithTime = new Date(selectedDay);
    dateWithTime.setHours(mealTime.hour, 0, 0, 0);
    
    if (onSelectMealTime) {
      onSelectMealTime(dateWithTime, mealTime.type);
    } else {
      onSelectDate(dateWithTime);
    }
  };

  const getWeekLabel = (weekDays: Date[]): string => {
    const firstDay = weekDays[0];
    const lastDay = weekDays[weekDays.length - 1];
    
    if (firstDay.getMonth() === lastDay.getMonth()) {
      return `${MONTH_NAMES[firstDay.getMonth()]} ${firstDay.getDate()}-${lastDay.getDate()}`;
    } else {
      return `${MONTH_NAMES[firstDay.getMonth()]} ${firstDay.getDate()} - ${MONTH_NAMES[lastDay.getMonth()]} ${lastDay.getDate()}`;
    }
  };

  return (
    <View style={styles.container}>
      {/* Day name headers */}
      <View style={styles.headerRow}>
        {DAY_NAMES.map((day, index) => (
          <View key={day} style={styles.headerCell}>
            <Text style={[
              styles.headerText,
              index === 0 || index === 6 ? styles.weekendHeader : null
            ]}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex}>
          {/* Week label */}
          <Text style={styles.weekLabel}>
            {weekIndex === 0 ? 'This Week' : weekIndex === 1 ? 'Next Week' : getWeekLabel(week)}
          </Text>
          
          <View style={styles.weekRow}>
            {week.map((day, dayIndex) => {
              const today = isToday(day);
              const tomorrow = isTomorrow(day);
              const selected = isSelected(day);
              
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={[
                    styles.dayCell,
                    today && styles.todayCell,
                    selected && styles.selectedCell,
                  ]}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dayNumber,
                    today && styles.todayText,
                    selected && styles.selectedText,
                    (dayIndex === 0 || dayIndex === 6) && !selected && !today && styles.weekendText,
                  ]}>
                    {day.getDate()}
                  </Text>
                  {today && (
                    <Text style={[styles.dayLabel, selected && styles.selectedLabelText]}>
                      Today
                    </Text>
                  )}
                  {tomorrow && !today && (
                    <Text style={[styles.dayLabel, selected && styles.selectedLabelText]}>
                      Tmrw
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Meal time slots (when a day is selected) */}
      {showTimeSlots && selectedDay && (
        <View style={styles.mealTimesContainer}>
          <Text style={styles.mealTimesLabel}>
            Select meal time for {MONTH_NAMES[selectedDay.getMonth()]} {selectedDay.getDate()}
          </Text>
          <View style={styles.mealTimesRow}>
            {MEAL_TIMES.map((meal) => (
              <TouchableOpacity
                key={meal.type}
                style={styles.mealTimeButton}
                onPress={() => handleMealTimePress(meal)}
                activeOpacity={0.7}
              >
                <Text style={styles.mealTimeEmoji}>{meal.emoji}</Text>
                <Text style={styles.mealTimeLabel}>{meal.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  weekendHeader: {
    color: '#9CA3AF',
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 6,
    marginTop: 8,
    paddingLeft: 4,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
    marginVertical: 2,
    backgroundColor: 'white',
  },
  todayCell: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  selectedCell: {
    backgroundColor: colors.primary,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  todayText: {
    color: colors.primary,
    fontWeight: '700',
  },
  selectedText: {
    color: 'white',
    fontWeight: '700',
  },
  weekendText: {
    color: '#9CA3AF',
  },
  dayLabel: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 1,
  },
  selectedLabelText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  mealTimesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  mealTimesLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  mealTimesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mealTimeButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    minWidth: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mealTimeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  mealTimeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
});