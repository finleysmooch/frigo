// components/MealCalendarView.tsx
// Calendar view for displaying meals by date
// Created: December 10, 2025
// Updated: December 10, 2025 - Fixed timezone issue, combined view toggle

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MealSummary {
  id: string;
  title: string;
  meal_time?: string;
  meal_type?: string;
  participant_count: number;
  meal_status: 'planning' | 'completed';
}

type ViewMode = 'month' | 'week';

interface MealCalendarViewProps {
  meals: MealSummary[];
  selectedDate: Date | null;
  viewMode: ViewMode;
  currentMonth: Date;
  onDaySelect: (date: Date) => void;
  onMealPress: (mealId: string) => void;
  onMonthChange: (date: Date) => void;
  currentUserId: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper to get local date string (YYYY-MM-DD) without timezone issues
const getLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Parse meal_time to local date key
const getMealDateKey = (mealTime: string): string => {
  const date = new Date(mealTime);
  return getLocalDateKey(date);
};

export default function MealCalendarView({
  meals,
  selectedDate,
  viewMode,
  currentMonth,
  onDaySelect,
  onMealPress,
  onMonthChange,
  currentUserId,
}: MealCalendarViewProps) {
  const { colors, functionalColors } = useTheme();

  const DAY_SIZE = (SCREEN_WIDTH - 32 - 12) / 7; // Account for padding and gaps

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 8,
      padding: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    navButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navButtonText: {
      fontSize: 20,
      color: colors.text.primary,
      fontWeight: '300',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    weekdayHeader: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    weekdayText: {
      width: DAY_SIZE,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '600',
      color: colors.text.tertiary,
    },
    monthGrid: {
      // Container for month view
    },
    weekView: {
      // Container for week view
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 1,
    },
    dayCell: {
      width: DAY_SIZE,
      height: DAY_SIZE * 0.85,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 2,
      borderRadius: 6,
    },
    weekDayCell: {
      width: DAY_SIZE,
      minHeight: 70,
      alignItems: 'center',
      paddingTop: 4,
      paddingHorizontal: 2,
      borderRadius: 6,
      backgroundColor: colors.background.secondary,
      marginHorizontal: 1,
    },
    todayCell: {
      backgroundColor: '#EFF6FF',
    },
    selectedCell: {
      backgroundColor: colors.primary,
    },
    otherMonthCell: {
      opacity: 0.4,
    },
    dayNumber: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text.primary,
    },
    todayText: {
      color: colors.primary,
      fontWeight: '700',
    },
    selectedText: {
      color: colors.background.card,
      fontWeight: '700',
    },
    selectedSubText: {
      color: 'rgba(255, 255, 255, 0.8)',
    },
    otherMonthText: {
      color: colors.text.tertiary,
    },
    mealIndicators: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 1,
      gap: 2,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    planningDot: {
      backgroundColor: functionalColors.warning,
    },
    completedDot: {
      backgroundColor: functionalColors.success,
    },
    participantCount: {
      fontSize: 8,
      color: colors.text.tertiary,
      marginLeft: 1,
    },
    weekMealList: {
      marginTop: 2,
      width: '100%',
    },
    weekMealTitle: {
      fontSize: 9,
      color: colors.text.primary,
      textAlign: 'center',
      lineHeight: 12,
    },
    weekMoreMeals: {
      fontSize: 8,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.background.secondary,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendText: {
      fontSize: 11,
      color: colors.text.secondary,
    },
  }), [colors, functionalColors, DAY_SIZE]);

  // Get meals grouped by local date string (YYYY-MM-DD)
  const mealsByDate = useMemo(() => {
    const grouped = new Map<string, MealSummary[]>();
    
    meals.forEach(meal => {
      if (meal.meal_time) {
        const dateKey = getMealDateKey(meal.meal_time);
        const existing = grouped.get(dateKey) || [];
        existing.push(meal);
        grouped.set(dateKey, existing);
      }
    });
    
    return grouped;
  }, [meals]);

  const getMealsForDate = (date: Date): MealSummary[] => {
    return mealsByDate.get(getLocalDateKey(date)) || [];
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const isSameMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth() &&
           date.getFullYear() === currentMonth.getFullYear();
  };

  // Navigation
  const goToPrevious = () => {
    const newDate = new Date(currentMonth);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    onMonthChange(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentMonth);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    onMonthChange(newDate);
  };

  const goToToday = () => {
    onMonthChange(new Date());
    onDaySelect(new Date());
  };

  // Generate calendar days
  const getMonthDays = (): (Date | null)[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const endPadding = 6 - lastDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Padding at start
    for (let i = 0; i < startPadding; i++) {
      const date = new Date(year, month, -startPadding + i + 1);
      days.push(date);
    }
    
    // Days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    // Padding at end
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(year, month + 1, i);
      days.push(date);
    }
    
    return days;
  };

  const getWeekDays = (): Date[] => {
    const startOfWeek = new Date(currentMonth);
    startOfWeek.setDate(currentMonth.getDate() - currentMonth.getDay());
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    
    return days;
  };

  const renderDayCell = (date: Date | null, index: number, isWeekView: boolean) => {
    if (!date) return <View key={index} style={styles.dayCell} />;
    
    const dayMeals = getMealsForDate(date);
    const hasPlanning = dayMeals.some(m => m.meal_status === 'planning');
    const hasCompleted = dayMeals.some(m => m.meal_status === 'completed');
    const totalParticipants = dayMeals.reduce((sum, m) => sum + m.participant_count, 0);
    
    const isCurrentMonth = isSameMonth(date);
    const today = isToday(date);
    const selected = isSelected(date);
    
    return (
      <TouchableOpacity
        key={index}
        style={[
          isWeekView ? styles.weekDayCell : styles.dayCell,
          today && !selected && styles.todayCell,
          selected && styles.selectedCell,
          !isCurrentMonth && !isWeekView && styles.otherMonthCell,
        ]}
        onPress={() => onDaySelect(date)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.dayNumber,
          today && !selected && styles.todayText,
          selected && styles.selectedText,
          !isCurrentMonth && !isWeekView && styles.otherMonthText,
        ]}>
          {date.getDate()}
        </Text>
        
        {/* Meal indicators + participant count */}
        {dayMeals.length > 0 && (
          <View style={styles.mealIndicators}>
            {hasPlanning && <View style={[styles.dot, styles.planningDot]} />}
            {hasCompleted && <View style={[styles.dot, styles.completedDot]} />}
            {totalParticipants > 0 && (
              <Text style={[styles.participantCount, selected && styles.selectedSubText]}>
                {totalParticipants}👤
              </Text>
            )}
          </View>
        )}
        
        {/* Week view: show meal titles */}
        {isWeekView && dayMeals.length > 0 && (
          <View style={styles.weekMealList}>
            {dayMeals.slice(0, 2).map((meal) => (
              <Text 
                key={meal.id} 
                style={[styles.weekMealTitle, selected && styles.selectedSubText]}
                numberOfLines={1}
              >
                {meal.title}
              </Text>
            ))}
            {dayMeals.length > 2 && (
              <Text style={[styles.weekMoreMeals, selected && styles.selectedSubText]}>
                +{dayMeals.length - 2} more
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMonthView = () => {
    const days = getMonthDays();
    const weeks: (Date | null)[][] = [];
    
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    
    return (
      <View style={styles.monthGrid}>
        {/* Weekday headers */}
        <View style={styles.weekdayHeader}>
          {WEEKDAYS.map(day => (
            <Text key={day} style={styles.weekdayText}>{day}</Text>
          ))}
        </View>
        
        {/* Calendar grid */}
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((date, dayIndex) => renderDayCell(date, dayIndex, false))}
          </View>
        ))}
      </View>
    );
  };

  const renderWeekView = () => {
    const days = getWeekDays();
    
    return (
      <View style={styles.weekView}>
        {/* Weekday headers */}
        <View style={styles.weekdayHeader}>
          {WEEKDAYS.map(day => (
            <Text key={day} style={styles.weekdayText}>{day}</Text>
          ))}
        </View>
        
        {/* Week row */}
        <View style={styles.weekRow}>
          {days.map((date, index) => renderDayCell(date, index, true))}
        </View>
      </View>
    );
  };

  const getHeaderTitle = () => {
    if (viewMode === 'month') {
      return `${MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }
    
    const weekDays = getWeekDays();
    const start = weekDays[0];
    const end = weekDays[6];
    
    if (start.getMonth() === end.getMonth()) {
      return `${MONTHS[start.getMonth()]} ${start.getDate()}-${end.getDate()}`;
    }
    
    return `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} - ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
  };

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPrevious} style={styles.navButton}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToToday}>
          <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToNext} style={styles.navButton}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      {viewMode === 'month' ? renderMonthView() : renderWeekView()}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.planningDot]} />
          <Text style={styles.legendText}>Planning</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.completedDot]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
      </View>
    </View>
  );
}