// components/EditMealModal.tsx
// Modal for editing meal details (title, description, date, location, type)
// Created: December 10, 2025

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { colors } from '../lib/theme';
import { supabase } from '../lib/supabase';
import DateTimePicker from './DateTimePicker';

interface EditMealModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mealId: string;
  currentUserId: string;
  initialValues: {
    title: string;
    description?: string;
    meal_type?: string;
    meal_time?: string;
    meal_location?: string;
  };
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

export default function EditMealModal({
  visible,
  onClose,
  onSuccess,
  mealId,
  currentUserId,
  initialValues,
}: EditMealModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState<string | undefined>(undefined);
  const [mealTime, setMealTime] = useState<Date | undefined>(undefined);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (visible && initialValues) {
      setTitle(initialValues.title || '');
      setDescription(initialValues.description || '');
      setMealType(initialValues.meal_type);
      setMealTime(initialValues.meal_time ? new Date(initialValues.meal_time) : undefined);
      setLocation(initialValues.meal_location || '');
    }
  }, [visible, initialValues]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a meal name');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          meal_type: mealType || null,
          meal_time: mealTime?.toISOString() || null,
          meal_location: location.trim() || null,
        })
        .eq('id', mealId)
        .eq('post_type', 'meal');

      if (error) throw error;

      Alert.alert('Saved', 'Meal details updated');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating meal:', error);
      Alert.alert('Error', 'Failed to update meal');
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

  const setQuickDate = (type: 'now' | 'today_lunch' | 'today_dinner' | 'tomorrow') => {
    const now = new Date();
    let date: Date;

    switch (type) {
      case 'now':
        date = now;
        break;
      case 'today_lunch':
        date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0);
        break;
      case 'today_dinner':
        date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0);
        break;
      case 'tomorrow':
        date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 18, 0);
        break;
    }

    setMealTime(date);
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
            <Text style={styles.headerTitle}>Edit Meal</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving || !title.trim()}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveButton, !title.trim() && styles.disabled]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Meal Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Meal Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Sunday Dinner, Friendsgiving 2025"
                value={title}
                onChangeText={setTitle}
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
                style={styles.typeScroll}
              >
                <View style={styles.typeContainer}>
                  {MEAL_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeButton,
                        mealType === type.value && styles.typeButtonActive,
                      ]}
                      onPress={() => setMealType(
                        mealType === type.value ? undefined : type.value
                      )}
                    >
                      <Text style={styles.typeEmoji}>{type.emoji}</Text>
                      <Text style={[
                        styles.typeLabel,
                        mealType === type.value && styles.typeLabelActive,
                      ]}>
                        {type.value.charAt(0).toUpperCase() + type.value.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* When - Date & Time */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>When</Text>
              
              {/* Main Date/Time Button */}
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <View style={styles.dateButtonContent}>
                  <Text style={styles.dateIcon}>📅</Text>
                  <Text style={[
                    styles.dateButtonText,
                    !mealTime && styles.dateButtonPlaceholder,
                  ]}>
                    {mealTime ? formatDate(mealTime) : 'Select date and time'}
                  </Text>
                </View>
                <Text style={styles.dateButtonArrow}>›</Text>
              </TouchableOpacity>

              {/* Quick Date Options */}
              <View style={styles.quickDates}>
                <TouchableOpacity 
                  style={styles.quickButton}
                  onPress={() => setQuickDate('now')}
                >
                  <Text style={styles.quickButtonText}>Now</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.quickButton}
                  onPress={() => setQuickDate('today_lunch')}
                >
                  <Text style={styles.quickButtonText}>Today Lunch</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.quickButton}
                  onPress={() => setQuickDate('today_dinner')}
                >
                  <Text style={styles.quickButtonText}>Tonight</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.quickButton}
                  onPress={() => setQuickDate('tomorrow')}
                >
                  <Text style={styles.quickButtonText}>Tomorrow</Text>
                </TouchableOpacity>
              </View>

              {/* Clear date option */}
              {mealTime && (
                <TouchableOpacity 
                  style={styles.clearButton}
                  onPress={() => setMealTime(undefined)}
                >
                  <Text style={styles.clearButtonText}>Clear date</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Location */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Location (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Tom's house, The kitchen"
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
                placeholder="Any notes about the meal..."
                value={description}
                onChangeText={setDescription}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>

      {/* Date Time Picker Modal */}
      <DateTimePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(date) => setMealTime(date)}
        initialDate={mealTime}
        mode="datetime"
      />
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
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
  },
  saveButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  typeScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 20,
  },
  typeButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    minWidth: 80,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
  },
  typeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  typeLabelActive: {
    color: 'white',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateIcon: {
    fontSize: 20,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111',
  },
  dateButtonPlaceholder: {
    color: '#9CA3AF',
  },
  dateButtonArrow: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  quickDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  quickButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  quickButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  clearButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    fontSize: 13,
    color: '#EF4444',
  },
});