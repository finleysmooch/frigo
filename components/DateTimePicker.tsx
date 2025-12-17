// components/DateTimePicker.tsx
// Combined date/time picker with spinner and calendar views
// Created: December 10, 2025

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { colors } from '../lib/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DateTimePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  initialDate?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  mode?: 'date' | 'datetime';
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate arrays for spinner
const generateHours = () => Array.from({ length: 12 }, (_, i) => i + 1);
const generateMinutes = () => ['00', '15', '30', '45'];
const generateAmPm = () => ['AM', 'PM'];

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 3;

export default function DateTimePicker({
  visible,
  onClose,
  onSelect,
  initialDate,
  minimumDate,
  maximumDate,
  mode = 'datetime',
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'spinner'>('calendar');
  const [calendarMonth, setCalendarMonth] = useState(initialDate || new Date());

  // Spinner values
  const [selectedHour, setSelectedHour] = useState(
    initialDate ? (initialDate.getHours() % 12 || 12) : 12
  );
  const [selectedMinute, setSelectedMinute] = useState(
    initialDate ? Math.floor(initialDate.getMinutes() / 15) * 15 : 0
  );
  const [selectedAmPm, setSelectedAmPm] = useState(
    initialDate ? (initialDate.getHours() >= 12 ? 'PM' : 'AM') : 'PM'
  );

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
      setCalendarMonth(initialDate);
      setSelectedHour(initialDate.getHours() % 12 || 12);
      setSelectedMinute(Math.floor(initialDate.getMinutes() / 15) * 15);
      setSelectedAmPm(initialDate.getHours() >= 12 ? 'PM' : 'AM');
    }
  }, [initialDate, visible]);

  // Combine date and time into final Date object
  const getCombinedDateTime = (): Date => {
    const result = new Date(selectedDate);
    if (mode === 'datetime') {
      let hours = selectedHour;
      if (selectedAmPm === 'PM' && hours !== 12) hours += 12;
      if (selectedAmPm === 'AM' && hours === 12) hours = 0;
      result.setHours(hours, selectedMinute, 0, 0);
    }
    return result;
  };

  const handleConfirm = () => {
    onSelect(getCombinedDateTime());
    onClose();
  };

  // Calendar navigation
  const goToPrevMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCalendarMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCalendarMonth(newMonth);
  };

  // Generate calendar days
  const getMonthDays = (): (Date | null)[] => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Padding at start
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    // Days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const isDateDisabled = (date: Date): boolean => {
    if (minimumDate && date < minimumDate) return true;
    if (maximumDate && date > maximumDate) return true;
    return false;
  };

  const isSelectedDay = (date: Date): boolean => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const isToday = (date: Date): boolean => {
    return date.toDateString() === new Date().toDateString();
  };

  const handleDayPress = (date: Date) => {
    if (!isDateDisabled(date)) {
      setSelectedDate(date);
    }
  };

  // Format selected date/time for display
  const formatSelectedDateTime = (): string => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };
    let result = selectedDate.toLocaleDateString('en-US', options);
    
    if (mode === 'datetime') {
      const minStr = selectedMinute.toString().padStart(2, '0');
      result += ` at ${selectedHour}:${minStr} ${selectedAmPm}`;
    }
    
    return result;
  };

  const monthDays = getMonthDays();

  // Spinner wheel component
  const SpinnerWheel = ({
    items,
    selectedIndex,
    onSelect: onItemSelect,
    width = 60,
  }: {
    items: (string | number)[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    width?: number;
  }) => {
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
      // Scroll to selected item
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, [selectedIndex]);

    const handleScrollEnd = (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      onItemSelect(Math.max(0, Math.min(index, items.length - 1)));
    };

    return (
      <View style={[styles.spinnerContainer, { width }]}>
        {/* Selection highlight */}
        <View style={styles.selectionHighlight} pointerEvents="none" />
        
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScrollEnd}
          contentContainerStyle={{
            paddingVertical: ITEM_HEIGHT,
          }}
        >
          {items.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.spinnerItem}
              onPress={() => {
                onItemSelect(index);
                scrollRef.current?.scrollTo({
                  y: index * ITEM_HEIGHT,
                  animated: true,
                });
              }}
            >
              <Text style={[
                styles.spinnerText,
                index === selectedIndex && styles.spinnerTextSelected,
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select {mode === 'datetime' ? 'Date & Time' : 'Date'}</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Selected Value Display */}
          <View style={styles.selectedDisplay}>
            <Text style={styles.selectedText}>{formatSelectedDateTime()}</Text>
          </View>

          {/* View Mode Toggle */}
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'calendar' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('calendar')}
            >
              <Text style={[styles.viewModeText, viewMode === 'calendar' && styles.viewModeTextActive]}>
                📅 Calendar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'spinner' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('spinner')}
            >
              <Text style={[styles.viewModeText, viewMode === 'spinner' && styles.viewModeTextActive]}>
                🔄 Spinner
              </Text>
            </TouchableOpacity>
          </View>

          {viewMode === 'calendar' ? (
            /* Calendar View */
            <View style={styles.calendarContainer}>
              {/* Month Navigation */}
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
                  <Text style={styles.navButtonText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                  {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </Text>
                <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
                  <Text style={styles.navButtonText}>›</Text>
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
                {monthDays.map((date, index) => (
                  <View key={index} style={styles.dayCell}>
                    {date ? (
                      <TouchableOpacity
                        style={[
                          styles.dayButton,
                          isSelectedDay(date) && styles.selectedDay,
                          isToday(date) && !isSelectedDay(date) && styles.todayDay,
                          isDateDisabled(date) && styles.disabledDay,
                        ]}
                        onPress={() => handleDayPress(date)}
                        disabled={isDateDisabled(date)}
                      >
                        <Text style={[
                          styles.dayText,
                          isSelectedDay(date) && styles.selectedDayText,
                          isToday(date) && !isSelectedDay(date) && styles.todayDayText,
                          isDateDisabled(date) && styles.disabledDayText,
                        ]}>
                          {date.getDate()}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            /* Spinner View */
            <View style={styles.spinnerViewContainer}>
              {/* Date Spinners */}
              <View style={styles.dateSpinners}>
                <SpinnerWheel
                  items={MONTHS}
                  selectedIndex={selectedDate.getMonth()}
                  onSelect={(index) => {
                    const newDate = new Date(selectedDate);
                    newDate.setMonth(index);
                    setSelectedDate(newDate);
                    setCalendarMonth(newDate);
                  }}
                  width={120}
                />
                <SpinnerWheel
                  items={Array.from({ length: 31 }, (_, i) => i + 1)}
                  selectedIndex={selectedDate.getDate() - 1}
                  onSelect={(index) => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(index + 1);
                    setSelectedDate(newDate);
                    setCalendarMonth(newDate);
                  }}
                  width={50}
                />
                <SpinnerWheel
                  items={Array.from({ length: 10 }, (_, i) => 2024 + i)}
                  selectedIndex={selectedDate.getFullYear() - 2024}
                  onSelect={(index) => {
                    const newDate = new Date(selectedDate);
                    newDate.setFullYear(2024 + index);
                    setSelectedDate(newDate);
                    setCalendarMonth(newDate);
                  }}
                  width={80}
                />
              </View>
            </View>
          )}

          {/* Time Picker (if datetime mode) */}
          {mode === 'datetime' && (
            <View style={styles.timeContainer}>
              <Text style={styles.timeLabel}>Time</Text>
              <View style={styles.timeSpinners}>
                <SpinnerWheel
                  items={generateHours()}
                  selectedIndex={selectedHour - 1}
                  onSelect={(index) => setSelectedHour(index + 1)}
                  width={50}
                />
                <Text style={styles.timeSeparator}>:</Text>
                <SpinnerWheel
                  items={generateMinutes()}
                  selectedIndex={selectedMinute / 15}
                  onSelect={(index) => setSelectedMinute(index * 15)}
                  width={50}
                />
                <SpinnerWheel
                  items={generateAmPm()}
                  selectedIndex={selectedAmPm === 'AM' ? 0 : 1}
                  onSelect={(index) => setSelectedAmPm(index === 0 ? 'AM' : 'PM')}
                  width={60}
                />
              </View>
            </View>
          )}

          {/* Quick Options */}
          <View style={styles.quickOptions}>
            <Text style={styles.quickLabel}>Quick Select:</Text>
            <View style={styles.quickButtons}>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => {
                  const now = new Date();
                  setSelectedDate(now);
                  setCalendarMonth(now);
                  if (mode === 'datetime') {
                    setSelectedHour(now.getHours() % 12 || 12);
                    setSelectedMinute(Math.floor(now.getMinutes() / 15) * 15);
                    setSelectedAmPm(now.getHours() >= 12 ? 'PM' : 'AM');
                  }
                }}
              >
                <Text style={styles.quickButtonText}>Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(18, 0, 0, 0);
                  setSelectedDate(tomorrow);
                  setCalendarMonth(tomorrow);
                  if (mode === 'datetime') {
                    setSelectedHour(6);
                    setSelectedMinute(0);
                    setSelectedAmPm('PM');
                  }
                }}
              >
                <Text style={styles.quickButtonText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  nextWeek.setHours(18, 0, 0, 0);
                  setSelectedDate(nextWeek);
                  setCalendarMonth(nextWeek);
                  if (mode === 'datetime') {
                    setSelectedHour(6);
                    setSelectedMinute(0);
                    setSelectedAmPm('PM');
                  }
                }}
              >
                <Text style={styles.quickButtonText}>Next Week</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const DAY_SIZE = (SCREEN_WIDTH - 80) / 7;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '90%',
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  selectedDisplay: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
  },
  selectedText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  viewModeToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  viewModeTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  calendarContainer: {
    padding: 20,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#374151',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    width: DAY_SIZE,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    width: DAY_SIZE - 8,
    height: DAY_SIZE - 8,
    borderRadius: (DAY_SIZE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 15,
    color: '#374151',
  },
  selectedDay: {
    backgroundColor: colors.primary,
  },
  selectedDayText: {
    color: 'white',
    fontWeight: '600',
  },
  todayDay: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  todayDayText: {
    color: colors.primary,
    fontWeight: '600',
  },
  disabledDay: {
    opacity: 0.3,
  },
  disabledDayText: {
    color: '#9CA3AF',
  },
  spinnerViewContainer: {
    padding: 20,
  },
  dateSpinners: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  spinnerContainer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
    position: 'relative',
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  spinnerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  spinnerTextSelected: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 18,
  },
  timeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  timeSpinners: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '600',
    color: '#374151',
  },
  quickOptions: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
});