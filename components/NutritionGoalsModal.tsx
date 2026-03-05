import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../lib/theme';
import { getNutritionGoals, upsertNutritionGoals } from '../lib/services/nutritionGoalsService';
import type { NutritionGoal } from '../lib/services/nutritionGoalsService';

interface NutritionGoalsModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

const MEALS_PER_DAY = 2.5;

const GOAL_NUTRIENTS = [
  { key: 'calories', label: 'Calories', unit: 'cal', color: '#0f172a', step: 50, defaultValue: 2000 },
  { key: 'protein',  label: 'Protein',  unit: 'g',   color: '#0891b2', step: 5,  defaultValue: 80 },
  { key: 'carbs',    label: 'Carbs',    unit: 'g',   color: '#d97706', step: 5,  defaultValue: 200 },
  { key: 'fat',      label: 'Fat',      unit: 'g',   color: '#e11d48', step: 5,  defaultValue: 65 },
  { key: 'fiber',    label: 'Fiber',    unit: 'g',   color: '#16a34a', step: 5,  defaultValue: 25 },
  { key: 'sodium',   label: 'Sodium',   unit: 'mg',  color: '#7c3aed', step: 100, defaultValue: 2300 },
];

export default function NutritionGoalsModal({ visible, userId, onClose, onSaved }: NutritionGoalsModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [values, setValues] = useState<Record<string, number>>({});
  const [displayMode, setDisplayMode] = useState<'daily' | 'per_meal'>('daily');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadGoals();
    }
  }, [visible]);

  const loadGoals = async () => {
    const goals = await getNutritionGoals(userId);
    const vals: Record<string, number> = {};
    GOAL_NUTRIENTS.forEach(n => {
      const existing = goals.find(g => g.nutrient === n.key);
      vals[n.key] = existing ? existing.goalValue : n.defaultValue;
    });
    setValues(vals);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const goals: NutritionGoal[] = GOAL_NUTRIENTS.map(n => ({
        nutrient: n.key,
        goalValue: values[n.key] ?? n.defaultValue,
        goalUnit: n.unit,
      }));
      await upsertNutritionGoals(userId, goals);
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving goals:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      transparent={Platform.OS !== 'ios'}
      onRequestClose={onClose}
    >
      {Platform.OS !== 'ios' && (
        <View style={styles.androidOverlay} />
      )}
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Edit Nutrition Goals</Text>
        <Text style={styles.subtitle}>Set your daily targets</Text>

        {/* Daily / Per meal toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, displayMode === 'daily' && styles.modeBtnActive]}
            onPress={() => setDisplayMode('daily')}
          >
            <Text style={[styles.modeBtnText, displayMode === 'daily' && styles.modeBtnTextActive]}>Daily</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, displayMode === 'per_meal' && styles.modeBtnActive]}
            onPress={() => setDisplayMode('per_meal')}
          >
            <Text style={[styles.modeBtnText, displayMode === 'per_meal' && styles.modeBtnTextActive]}>Per meal</Text>
          </TouchableOpacity>
        </View>

        <ScrollView>
          {GOAL_NUTRIENTS.map(n => {
            const dailyVal = values[n.key] ?? n.defaultValue;
            const displayVal = displayMode === 'per_meal'
              ? Math.round(dailyVal / MEALS_PER_DAY)
              : dailyVal;
            return (
              <View key={n.key} style={styles.inputRow}>
                <View style={styles.inputLeft}>
                  <View style={[styles.dot, { backgroundColor: n.color }]} />
                  <Text style={styles.nutrientName}>{n.label}</Text>
                  <Text style={styles.unitLabel}>{n.unit}</Text>
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => {
                      const step = displayMode === 'per_meal' ? Math.round(n.step / MEALS_PER_DAY) : n.step;
                      const dailyStep = displayMode === 'per_meal' ? step * MEALS_PER_DAY : step;
                      setValues(prev => ({ ...prev, [n.key]: Math.max(0, (prev[n.key] ?? n.defaultValue) - dailyStep) }));
                    }}
                  >
                    <Text style={styles.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepVal}
                    value={String(displayVal)}
                    keyboardType="numeric"
                    onChangeText={text => {
                      const num = parseInt(text, 10);
                      if (!isNaN(num)) {
                        const daily = displayMode === 'per_meal' ? Math.round(num * MEALS_PER_DAY) : num;
                        setValues(prev => ({ ...prev, [n.key]: daily }));
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => {
                      const step = displayMode === 'per_meal' ? Math.round(n.step / MEALS_PER_DAY) : n.step;
                      const dailyStep = displayMode === 'per_meal' ? step * MEALS_PER_DAY : step;
                      setValues(prev => ({ ...prev, [n.key]: (prev[n.key] ?? n.defaultValue) + dailyStep }));
                    }}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Goals</Text>
          }
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    androidOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.background.card,
      ...(Platform.OS !== 'ios' ? {
        marginTop: 80,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      } : {}),
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border.light,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      padding: 3,
      marginBottom: spacing.lg,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: borderRadius.md - 2,
    },
    modeBtnActive: {
      backgroundColor: colors.background.card,
    },
    modeBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.tertiary,
    },
    modeBtnTextActive: {
      color: colors.text.primary,
      fontWeight: typography.weights.semibold as any,
    },
    inputRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    inputLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    nutrientName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium as any,
      color: colors.text.primary,
    },
    unitLabel: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: {
      fontSize: 18,
      fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
    },
    stepVal: {
      width: 60,
      textAlign: 'center',
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      paddingVertical: spacing.xs,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md + 2,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    saveBtnText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold as any,
      color: '#fff',
    },
  });
}
