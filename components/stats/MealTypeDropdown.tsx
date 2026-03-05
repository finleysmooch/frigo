// components/stats/MealTypeDropdown.tsx
// Anchored meal type filter dropdown for the stats dashboard.

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../lib/theme';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import type { MealTypeFilter } from '../../lib/services/statsService';

const MEAL_TYPE_OPTIONS: { label: string; value: MealTypeFilter }[] = [
  { label: 'All Meals', value: 'all' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Dessert', value: 'dessert' },
  { label: 'Meal Prep', value: 'meal_prep' },
];

interface MealTypeDropdownProps {
  selected: MealTypeFilter;
  onSelect: (value: MealTypeFilter) => void;
}

export default function MealTypeDropdown({ selected, onSelect }: MealTypeDropdownProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [btnLayout, setBtnLayout] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const btnRef = useRef<TouchableOpacity>(null);

  const selectedLabel = MEAL_TYPE_OPTIONS.find(o => o.value === selected)?.label || 'All Meals';

  const handleOpen = useCallback(() => {
    btnRef.current?.measureInWindow((x, y, w, h) => {
      setBtnLayout({ x, y, w, h });
      setVisible(true);
    });
  }, []);

  const screenH = Dimensions.get('window').height;
  const opensUp = btnLayout ? btnLayout.y > screenH / 2 : false;

  return (
    <>
      <TouchableOpacity ref={btnRef} style={styles.trigger} onPress={handleOpen}>
        <Text style={styles.triggerText}>{selectedLabel}</Text>
        <Text style={styles.triggerChevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setVisible(false)}>
          {btnLayout && (
            <View style={[
              styles.dropdown,
              opensUp
                ? { position: 'absolute', bottom: screenH - btnLayout.y + 4, left: btnLayout.x }
                : { position: 'absolute', top: btnLayout.y + btnLayout.h + 4, left: btnLayout.x },
            ]}>
              {MEAL_TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.item, selected === opt.value && styles.itemActive]}
                  onPress={() => { onSelect(opt.value); setVisible(false); }}
                >
                  <Text style={[styles.itemText, selected === opt.value && styles.itemTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.sm,
    },
    triggerText: {
      fontSize: typography.sizes.xs,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium as any,
    },
    triggerChevron: {
      fontSize: 10,
      color: colors.text.tertiary,
    },
    backdrop: {
      flex: 1,
    },
    dropdown: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.xs,
      minWidth: 140,
      ...shadows.medium,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    item: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    itemActive: {
      backgroundColor: colors.primary + '10',
    },
    itemText: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
    },
    itemTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold as any,
    },
  });
}
