// components/TimesMadeModal.tsx
// Phase 7B Revision: "I've Made This Before" — stepper for historical cook count updates
// Stepper shows number of additional cooks to add. Preview line shows resulting total.

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

interface TimesMadeModalProps {
  visible: boolean;
  recipeName: string;
  currentCount: number;
  onConfirm: (count: number) => void;
  onCancel: () => void;
}

export default function TimesMadeModal({
  visible,
  recipeName,
  currentCount,
  onConfirm,
  onCancel,
}: TimesMadeModalProps) {
  const { colors } = useTheme();

  // `additions` = how many extra cooks to add (defaults to 1)
  const [additions, setAdditions] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setAdditions(1);
      setIsEditing(false);
    }
  }, [visible]);

  const newTotal = currentCount + additions;

  const handleMinus = () => {
    if (additions > 1) setAdditions(additions - 1);
  };

  const handlePlus = () => {
    if (additions < 99) setAdditions(additions + 1);
  };

  const handleCountTap = () => {
    setEditText(String(additions));
    setIsEditing(true);
  };

  const handleEditSubmit = () => {
    const parsed = parseInt(editText, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      setAdditions(Math.min(parsed, 99));
    }
    setIsEditing(false);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        },
        container: {
          backgroundColor: colors.background.card,
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 340,
          alignItems: 'center',
        },
        recipeName: {
          fontSize: 13,
          color: colors.text.tertiary,
          marginBottom: 8,
          textAlign: 'center',
        },
        heading: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.text.primary,
          textAlign: 'center',
          marginBottom: 4,
        },
        subtext: {
          fontSize: 13,
          color: colors.text.secondary,
          textAlign: 'center',
          marginBottom: 24,
        },
        stepperRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
        },
        stepperButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1.5,
          justifyContent: 'center',
          alignItems: 'center',
        },
        stepperButtonEnabled: {
          borderColor: colors.primary,
          backgroundColor: colors.primaryLight,
        },
        stepperButtonDisabled: {
          borderColor: colors.border.light,
          backgroundColor: colors.background.secondary,
        },
        stepperButtonText: {
          fontSize: 22,
          fontWeight: '600',
        },
        stepperButtonTextEnabled: {
          color: colors.primary,
        },
        stepperButtonTextDisabled: {
          color: colors.border.medium,
        },
        countDisplay: {
          minWidth: 64,
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: 16,
        },
        countText: {
          fontSize: 36,
          fontWeight: '700',
          color: colors.text.primary,
        },
        countInput: {
          fontSize: 36,
          fontWeight: '700',
          color: colors.text.primary,
          textAlign: 'center',
          borderBottomWidth: 2,
          borderBottomColor: colors.primary,
          minWidth: 60,
          padding: 0,
        },
        totalPreview: {
          fontSize: 14,
          color: colors.text.secondary,
          textAlign: 'center',
          marginBottom: 20,
        },
        totalNumber: {
          fontWeight: '700',
          color: colors.primary,
        },
        confirmButton: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          width: '100%',
          alignItems: 'center',
          marginBottom: 10,
        },
        confirmButtonText: {
          color: '#ffffff',
          fontSize: 16,
          fontWeight: '600',
        },
        cancelButton: {
          paddingVertical: 8,
        },
        cancelButtonText: {
          fontSize: 14,
          color: colors.text.tertiary,
        },
      }),
    [colors]
  );

  const minusDisabled = additions <= 1;
  const plusDisabled = additions >= 99;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.recipeName} numberOfLines={2}>
            {recipeName}
          </Text>
          <Text style={styles.heading}>How many times?</Text>
          <Text style={styles.subtext}>
            {currentCount > 0
              ? `Currently logged ${currentCount} time${currentCount !== 1 ? 's' : ''}`
              : 'Add previous cooks to your history'}
          </Text>

          {/* Stepper — shows additions count */}
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                minusDisabled
                  ? styles.stepperButtonDisabled
                  : styles.stepperButtonEnabled,
              ]}
              onPress={handleMinus}
              disabled={minusDisabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.stepperButtonText,
                  minusDisabled
                    ? styles.stepperButtonTextDisabled
                    : styles.stepperButtonTextEnabled,
                ]}
              >
                {'\u2212'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.countDisplay}
              onPress={handleCountTap}
              activeOpacity={0.7}
            >
              {isEditing ? (
                <TextInput
                  style={styles.countInput}
                  value={editText}
                  onChangeText={setEditText}
                  onBlur={handleEditSubmit}
                  onSubmitEditing={handleEditSubmit}
                  keyboardType="number-pad"
                  autoFocus
                  selectTextOnFocus
                />
              ) : (
                <Text style={styles.countText}>{additions}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.stepperButton,
                plusDisabled
                  ? styles.stepperButtonDisabled
                  : styles.stepperButtonEnabled,
              ]}
              onPress={handlePlus}
              disabled={plusDisabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.stepperButtonText,
                  plusDisabled
                    ? styles.stepperButtonTextDisabled
                    : styles.stepperButtonTextEnabled,
                ]}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>

          {/* Total preview */}
          <Text style={styles.totalPreview}>
            Update total to <Text style={styles.totalNumber}>{newTotal}</Text> time{newTotal !== 1 ? 's' : ''} logged
          </Text>

          {/* Confirm */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => onConfirm(newTotal)}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmButtonText}>Update</Text>
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
