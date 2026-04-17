// components/MealPicker.tsx
// Phase 7E Checkpoint 3: Meal picker sub-view for LogCookSheet (state 1c)
// Rendered inside LogCookSheet when the meal chip is tapped.

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { useTheme } from '../lib/theme/ThemeContext';
import { getUserRecentMeals } from '../lib/services/mealService';
import { supabase } from '../lib/supabase';

// ── Inline icons ──

function PlateIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.5} />
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={1.5} />
      <Line x1="12" y1="3" x2="12" y2="2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon({ size = 20, color = '#0F6E56' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronRight({ size = 16, color = '#999' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 18 15 12 9 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Types ──

interface MealPickerProps {
  currentMealId: string | null;
  onSelectMeal: (mealId: string, mealTitle: string, mealType?: string) => void;
  onDetach: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

interface RecentMeal {
  meal_id: string;
  title: string;
  meal_status: string;
  meal_time?: string;
  meal_type?: string;
  dish_count: number;
  participant_count: number;
  user_role: string;
}

const TEAL_700 = '#0F6E56';

// ── Helper ──

function formatMealSubtext(meal: RecentMeal): string {
  const parts: string[] = [];

  if (meal.meal_time) {
    const mealDate = new Date(meal.meal_time);
    const now = new Date();
    const diffMs = now.getTime() - mealDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      // Future
      if (diffDays === -0 || Math.abs(diffDays) < 1) {
        parts.push('Tonight');
      } else {
        parts.push(`In ${Math.abs(diffDays)} days`);
      }
    } else if (diffDays === 0) {
      parts.push('Today');
    } else if (diffDays === 1) {
      parts.push('Yesterday');
    } else {
      parts.push(`${diffDays} days ago`);
    }
  }

  if (meal.dish_count > 0) {
    parts.push(`${meal.dish_count} dish${meal.dish_count !== 1 ? 'es' : ''}`);
  }

  if (meal.meal_status === 'planning') {
    parts.push('planned');
  }

  return parts.join(' \u00b7 ');
}

// ── Component ──

export default function MealPicker({
  currentMealId,
  onSelectMeal,
  onDetach,
  onCreateNew,
  onCancel,
}: MealPickerProps) {
  const { colors } = useTheme();
  const [meals, setMeals] = useState<RecentMeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMeals();
  }, []);

  const loadMeals = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const result = await getUserRecentMeals(session.user.id, 10);
      // Sort: today's planned meals first, then by meal_time desc
      const sorted = [...result].sort((a, b) => {
        const aIsPlanning = a.meal_status === 'planning' ? 0 : 1;
        const bIsPlanning = b.meal_status === 'planning' ? 0 : 1;
        if (aIsPlanning !== bIsPlanning) return aIsPlanning - bIsPlanning;
        const aTime = a.meal_time ? new Date(a.meal_time).getTime() : 0;
        const bTime = b.meal_time ? new Date(b.meal_time).getTime() : 0;
        return bTime - aTime;
      });
      setMeals(sorted);
    } catch (err) {
      console.error('Error loading recent meals:', err);
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 16,
    },
    mealRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
      gap: 12,
    },
    mealRowSelected: {
      backgroundColor: '#E1F5EE',
      marginHorizontal: -12,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    mealTextArea: {
      flex: 1,
    },
    mealTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text.primary,
    },
    mealSubtext: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    createRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 12,
      marginTop: 4,
    },
    createTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: TEAL_700,
    },
    createSubtext: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: 14,
      marginTop: 8,
    },
    cancelText: {
      fontSize: 15,
      color: colors.text.tertiary,
    },
    detachButton: {
      alignItems: 'center',
      paddingVertical: 12,
      marginTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.light,
    },
    detachText: {
      fontSize: 14,
      color: '#DC2626',
    },
    loadingContainer: {
      paddingVertical: 30,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.text.tertiary,
      textAlign: 'center',
      paddingVertical: 20,
    },
  }), [colors]);

  const renderMealRow = ({ item }: { item: RecentMeal }) => {
    const isSelected = currentMealId === item.meal_id;
    return (
      <TouchableOpacity
        style={[styles.mealRow, isSelected && styles.mealRowSelected]}
        onPress={() => onSelectMeal(item.meal_id, item.title, item.meal_type)}
        activeOpacity={0.7}
      >
        <PlateIcon size={20} color={isSelected ? TEAL_700 : colors.text.tertiary} />
        <View style={styles.mealTextArea}>
          <Text style={styles.mealTitle}>{item.title}</Text>
          <Text style={styles.mealSubtext}>{formatMealSubtext(item)}</Text>
        </View>
        <ChevronRight size={16} color={colors.text.tertiary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Add to a meal</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : meals.length === 0 ? (
        <Text style={styles.emptyText}>No recent meals</Text>
      ) : (
        <FlatList
          data={meals}
          keyExtractor={(item) => item.meal_id}
          renderItem={renderMealRow}
          scrollEnabled={meals.length > 5}
          style={{ maxHeight: 280 }}
        />
      )}

      {/* Create new meal */}
      <TouchableOpacity style={styles.createRow} onPress={onCreateNew} activeOpacity={0.7}>
        <PlusIcon size={20} color={TEAL_700} />
        <View style={styles.mealTextArea}>
          <Text style={styles.createTitle}>Create new meal</Text>
          <Text style={styles.createSubtext}>Start fresh from this dish</Text>
        </View>
        <ChevronRight size={16} color={colors.text.tertiary} />
      </TouchableOpacity>

      {/* Detach button (only when a meal is currently attached) */}
      {currentMealId && (
        <TouchableOpacity style={styles.detachButton} onPress={onDetach} activeOpacity={0.7}>
          <Text style={styles.detachText}>Detach from current meal</Text>
        </TouchableOpacity>
      )}

      {/* Cancel */}
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
