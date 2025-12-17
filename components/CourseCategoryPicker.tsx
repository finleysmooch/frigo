// components/meals/CourseCategoryPicker.tsx
// Reusable component for selecting course category
// Created: December 2, 2025

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors } from '../lib/theme';
import { CourseType } from '../lib/services/mealService';

interface CourseOption {
  value: CourseType;
  label: string;
  emoji: string;
  description: string;
}

const COURSE_OPTIONS: CourseOption[] = [
  { 
    value: 'appetizer', 
    label: 'Appetizer', 
    emoji: '🥗',
    description: 'Starters, salads, small bites'
  },
  { 
    value: 'main', 
    label: 'Main', 
    emoji: '🍖',
    description: 'The main course'
  },
  { 
    value: 'side', 
    label: 'Side', 
    emoji: '🥔',
    description: 'Side dishes, vegetables'
  },
  { 
    value: 'dessert', 
    label: 'Dessert', 
    emoji: '🍰',
    description: 'Sweets, treats'
  },
  { 
    value: 'drink', 
    label: 'Drink', 
    emoji: '🍷',
    description: 'Beverages, cocktails'
  },
  { 
    value: 'other', 
    label: 'Other', 
    emoji: '🍽️',
    description: 'Bread, condiments, etc.'
  },
];

interface CourseCategoryPickerProps {
  selectedCourse?: CourseType;
  onSelect: (course: CourseType) => void;
  showIsMainDish?: boolean;
  isMainDish?: boolean;
  onIsMainDishChange?: (value: boolean) => void;
  layout?: 'horizontal' | 'grid';
  size?: 'small' | 'medium' | 'large';
}

export default function CourseCategoryPicker({
  selectedCourse,
  onSelect,
  showIsMainDish = false,
  isMainDish = false,
  onIsMainDishChange,
  layout = 'horizontal',
  size = 'medium',
}: CourseCategoryPickerProps) {
  
  const getButtonSize = () => {
    switch (size) {
      case 'small': return { paddingH: 10, paddingV: 8, emoji: 20, label: 11 };
      case 'large': return { paddingH: 18, paddingV: 14, emoji: 32, label: 14 };
      default: return { paddingH: 14, paddingV: 10, emoji: 24, label: 12 };
    }
  };

  const sizeConfig = getButtonSize();

  const renderOption = (option: CourseOption) => {
    const isSelected = selectedCourse === option.value;
    
    return (
      <TouchableOpacity
        key={option.value}
        style={[
          styles.optionButton,
          layout === 'grid' && styles.optionButtonGrid,
          isSelected && styles.optionButtonSelected,
          {
            paddingHorizontal: sizeConfig.paddingH,
            paddingVertical: sizeConfig.paddingV,
          },
        ]}
        onPress={() => onSelect(option.value)}
        activeOpacity={0.7}
      >
        <Text style={[styles.optionEmoji, { fontSize: sizeConfig.emoji }]}>
          {option.emoji}
        </Text>
        <Text style={[
          styles.optionLabel,
          isSelected && styles.optionLabelSelected,
          { fontSize: sizeConfig.label },
        ]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {layout === 'horizontal' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalContainer}
        >
          {COURSE_OPTIONS.map(renderOption)}
        </ScrollView>
      ) : (
        <View style={styles.gridContainer}>
          {COURSE_OPTIONS.map(renderOption)}
        </View>
      )}

      {/* Main Dish Toggle - show for main or side courses */}
      {showIsMainDish && (selectedCourse === 'main' || selectedCourse === 'side') && (
        <TouchableOpacity
          style={styles.mainDishToggle}
          onPress={() => onIsMainDishChange?.(!isMainDish)}
        >
          <View style={[
            styles.checkbox,
            isMainDish && styles.checkboxChecked,
          ]}>
            {isMainDish && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.mainDishText}>
            <Text style={styles.mainDishLabel}>This is a main dish</Text>
            <Text style={styles.mainDishHint}>
              Main dishes appear first in the course section
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Export course options for use elsewhere
export { COURSE_OPTIONS };
export type { CourseOption };

const styles = StyleSheet.create({
  container: {},
  horizontalContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    minWidth: 70,
  },
  optionButtonGrid: {
    width: '30%',
    minWidth: 90,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
  },
  optionEmoji: {
    marginBottom: 4,
  },
  optionLabel: {
    fontWeight: '500',
    color: '#6B7280',
  },
  optionLabelSelected: {
    color: 'white',
  },
  mainDishToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mainDishText: {
    flex: 1,
  },
  mainDishLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  mainDishHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});