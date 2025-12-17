// components/AddPlanItemModal.tsx
// Modal for hosts to add plan items (placeholders) to a meal
// Created: December 3, 2025
// Updated: December 10, 2025 - Added ability to assign items to participants during creation

import React, { useState } from 'react';
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
import {
  addPlanItem,
  addMultiplePlanItems,
  CourseType,
  AddPlanItemInput,
  getCourseDisplayName,
  getCourseEmoji,
} from '../lib/services/mealPlanService';

interface Participant {
  user_id: string;
  username?: string;
  display_name?: string;
  role: string;
  rsvp_status: string;
}

interface AddPlanItemModalProps {
  visible: boolean;
  onClose: () => void;
  mealId: string;
  mealTitle: string;
  currentUserId: string;
  participants?: Participant[];
  onItemsAdded?: () => void;
}

const COURSE_OPTIONS: { value: CourseType; label: string; emoji: string }[] = [
  { value: 'appetizer', label: 'Appetizer', emoji: '🥗' },
  { value: 'main', label: 'Main', emoji: '🍖' },
  { value: 'side', label: 'Side', emoji: '🥔' },
  { value: 'dessert', label: 'Dessert', emoji: '🍰' },
  { value: 'drink', label: 'Drink', emoji: '🍷' },
  { value: 'other', label: 'Other', emoji: '🍽️' },
];

type Mode = 'single' | 'quick';

export default function AddPlanItemModal({
  visible,
  onClose,
  mealId,
  mealTitle,
  currentUserId,
  participants = [],
  onItemsAdded,
}: AddPlanItemModalProps) {
  const [mode, setMode] = useState<Mode>('single');
  const [saving, setSaving] = useState(false);
  
  // Single mode state
  const [courseType, setCourseType] = useState<CourseType>('main');
  const [placeholderName, setPlaceholderName] = useState('');
  const [isMainDish, setIsMainDish] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  
  // Quick mode state (counts per course)
  const [courseCounts, setCourseCounts] = useState<Record<CourseType, number>>({
    appetizer: 0,
    main: 1,
    side: 2,
    dessert: 0,
    drink: 0,
    other: 0,
  });

  // Get accepted participants for assignment
  const acceptedParticipants = participants.filter(
    p => p.rsvp_status === 'accepted'
  );

  const getSelectedParticipantName = () => {
    if (!assignedTo) return 'Anyone (Unassigned)';
    if (assignedTo === currentUserId) return 'Me';
    const participant = acceptedParticipants.find(p => p.user_id === assignedTo);
    return participant?.display_name || participant?.username || 'Unknown';
  };

  const resetForm = () => {
    setCourseType('main');
    setPlaceholderName('');
    setIsMainDish(false);
    setAssignedTo(undefined);
    setCourseCounts({
      appetizer: 0,
      main: 1,
      side: 2,
      dessert: 0,
      drink: 0,
      other: 0,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddSingle = async () => {
    setSaving(true);
    try {
      const result = await addPlanItem(mealId, currentUserId, {
        course_type: courseType,
        placeholder_name: placeholderName.trim() || undefined,
        is_main_dish: isMainDish,
        assigned_to: assignedTo,
      });

      if (result.success) {
        const itemName = placeholderName || getCourseDisplayName(courseType);
        const assignedMessage = assignedTo 
          ? ` and assigned to ${getSelectedParticipantName()}`
          : '';
        
        Alert.alert('Added!', `${itemName} added to meal plan${assignedMessage}`, [
          { text: 'Add Another', onPress: () => {
            setPlaceholderName('');
            setIsMainDish(false);
            setAssignedTo(undefined);
          }},
          { text: 'Done', onPress: () => {
            onItemsAdded?.();
            handleClose();
          }},
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to add item');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuick = async () => {
    // Build list of items to add (no assignment in quick mode)
    const items: AddPlanItemInput[] = [];
    
    COURSE_OPTIONS.forEach(course => {
      const count = courseCounts[course.value];
      for (let i = 0; i < count; i++) {
        items.push({
          course_type: course.value,
          is_main_dish: course.value === 'main',
        });
      }
    });

    if (items.length === 0) {
      Alert.alert('No Items', 'Add at least one item to the plan');
      return;
    }

    setSaving(true);
    try {
      const result = await addMultiplePlanItems(mealId, currentUserId, items);

      if (result.success) {
        Alert.alert('Added!', `${result.addedCount} items added to meal plan`, [
          { text: 'OK', onPress: () => {
            onItemsAdded?.();
            handleClose();
          }},
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to add items');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const updateCourseCount = (course: CourseType, delta: number) => {
    setCourseCounts(prev => ({
      ...prev,
      [course]: Math.max(0, (prev[course] || 0) + delta),
    }));
  };

  const totalQuickItems = Object.values(courseCounts).reduce((a, b) => a + b, 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} disabled={saving}>
              <Text style={[styles.cancelButton, saving && styles.disabled]}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Add to Plan</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{mealTitle}</Text>
            </View>
            <TouchableOpacity 
              onPress={mode === 'single' ? handleAddSingle : handleAddQuick} 
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.addButton}>
                  {mode === 'single' ? 'Add' : `Add ${totalQuickItems}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'single' && styles.modeButtonActive]}
              onPress={() => setMode('single')}
            >
              <Text style={[styles.modeButtonText, mode === 'single' && styles.modeButtonTextActive]}>
                Single Item
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'quick' && styles.modeButtonActive]}
              onPress={() => setMode('quick')}
            >
              <Text style={[styles.modeButtonText, mode === 'quick' && styles.modeButtonTextActive]}>
                Quick Setup
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'single' ? (
              /* Single Item Mode */
              <>
                {/* Course Type Selection */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Course Type *</Text>
                  <View style={styles.courseGrid}>
                    {COURSE_OPTIONS.map(course => (
                      <TouchableOpacity
                        key={course.value}
                        style={[
                          styles.courseButton,
                          courseType === course.value && styles.courseButtonActive,
                        ]}
                        onPress={() => setCourseType(course.value)}
                      >
                        <Text style={styles.courseEmoji}>{course.emoji}</Text>
                        <Text style={[
                          styles.courseLabel,
                          courseType === course.value && styles.courseLabelActive,
                        ]}>
                          {course.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Placeholder Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Name (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`e.g., "Caesar Salad", "Grandma's Pie"`}
                    value={placeholderName}
                    onChangeText={setPlaceholderName}
                    placeholderTextColor="#9CA3AF"
                    maxLength={100}
                  />
                  <Text style={styles.hint}>
                    Leave blank to just show "{getCourseDisplayName(courseType)}"
                  </Text>
                </View>

                {/* Assignment Picker */}
                {acceptedParticipants.length > 0 && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Assign to</Text>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowAssignPicker(!showAssignPicker)}
                    >
                      <Text style={styles.pickerButtonText}>
                        {getSelectedParticipantName()}
                      </Text>
                      <Text style={styles.pickerArrow}>
                        {showAssignPicker ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>
                    
                    {showAssignPicker && (
                      <View style={styles.pickerOptions}>
                        <TouchableOpacity
                          style={[
                            styles.pickerOption,
                            assignedTo === undefined && styles.pickerOptionSelected,
                          ]}
                          onPress={() => {
                            setAssignedTo(undefined);
                            setShowAssignPicker(false);
                          }}
                        >
                          <Text style={styles.pickerOptionText}>
                            Anyone (Unassigned)
                          </Text>
                          {assignedTo === undefined && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </TouchableOpacity>
                        
                        {acceptedParticipants.map(participant => (
                          <TouchableOpacity
                            key={participant.user_id}
                            style={[
                              styles.pickerOption,
                              assignedTo === participant.user_id && styles.pickerOptionSelected,
                            ]}
                            onPress={() => {
                              setAssignedTo(participant.user_id);
                              setShowAssignPicker(false);
                            }}
                          >
                            <View style={styles.participantInfo}>
                              <Text style={styles.pickerOptionText}>
                                {participant.user_id === currentUserId 
                                  ? 'Me' 
                                  : (participant.display_name || participant.username)}
                              </Text>
                              {participant.role === 'host' && (
                                <Text style={styles.hostTag}>👑 Host</Text>
                              )}
                            </View>
                            {assignedTo === participant.user_id && (
                              <Text style={styles.checkmark}>✓</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    
                    <Text style={styles.hint}>
                      Assign to a specific person, or leave unassigned for anyone to claim
                    </Text>
                  </View>
                )}

                {/* Is Main Dish Toggle (for main/side) */}
                {(courseType === 'main' || courseType === 'side') && (
                  <View style={styles.fieldGroup}>
                    <TouchableOpacity
                      style={styles.toggleRow}
                      onPress={() => setIsMainDish(!isMainDish)}
                    >
                      <View style={[styles.checkbox, isMainDish && styles.checkboxChecked]}>
                        {isMainDish && <Text style={styles.checkboxMark}>✓</Text>}
                      </View>
                      <View>
                        <Text style={styles.toggleLabel}>This is the main dish</Text>
                        <Text style={styles.toggleHint}>Will appear prominently in the meal</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Preview */}
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Preview:</Text>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewEmoji}>
                      {getCourseEmoji(courseType)}
                    </Text>
                    <View style={styles.previewInfo}>
                      <Text style={styles.previewText}>
                        {placeholderName || getCourseDisplayName(courseType)}
                      </Text>
                      <Text style={styles.previewStatus}>
                        {assignedTo 
                          ? `📌 Assigned to ${getSelectedParticipantName()}` 
                          : '❓ Needs someone'}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              /* Quick Setup Mode */
              <>
                <Text style={styles.quickDescription}>
                  Quickly add multiple items. You can assign them to specific people after adding.
                </Text>

                {COURSE_OPTIONS.map(course => (
                  <View key={course.value} style={styles.quickRow}>
                    <View style={styles.quickInfo}>
                      <Text style={styles.quickEmoji}>{course.emoji}</Text>
                      <Text style={styles.quickLabel}>{course.label}</Text>
                    </View>
                    <View style={styles.quickCounter}>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => updateCourseCount(course.value, -1)}
                      >
                        <Text style={styles.counterButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterValue}>
                        {courseCounts[course.value]}
                      </Text>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => updateCourseCount(course.value, 1)}
                      >
                        <Text style={styles.counterButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* Quick Summary */}
                <View style={styles.quickSummary}>
                  <Text style={styles.summaryTitle}>
                    Total: {totalQuickItems} {totalQuickItems === 1 ? 'item' : 'items'}
                  </Text>
                  <Text style={styles.summaryText}>
                    {COURSE_OPTIONS
                      .filter(c => courseCounts[c.value] > 0)
                      .map(c => `${courseCounts[c.value]} ${c.label.toLowerCase()}${courseCounts[c.value] > 1 ? 's' : ''}`)
                      .join(', ') || 'No items selected'}
                  </Text>
                </View>
              </>
            )}

            {/* Spacer */}
            <View style={{ height: 40 }} />
          </ScrollView>
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
  modeToggle: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: 'white',
  },
  content: {
    paddingHorizontal: 20,
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
  courseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  courseButton: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  courseButtonActive: {
    backgroundColor: colors.primary,
  },
  courseEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  courseLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  courseLabelActive: {
    color: 'white',
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
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  // Assignment picker styles
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#374151',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#6B7280',
  },
  pickerOptions: {
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostTag: {
    fontSize: 11,
    color: '#F59E0B',
  },
  checkmark: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  toggleHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  previewBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 10,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
  },
  previewEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  previewInfo: {
    flex: 1,
  },
  previewText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  previewStatus: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
    marginTop: 2,
  },
  quickDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  quickInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  quickLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  quickCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    minWidth: 24,
    textAlign: 'center',
  },
  quickSummary: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    color: '#3B82F6',
  },
});