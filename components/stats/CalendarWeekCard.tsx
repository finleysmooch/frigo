// components/stats/CalendarWeekCard.tsx
// Weekly calendar card showing 7-day emoji grid, streak badge,
// week navigation, and stats row with deltas.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import type { WeekDot, CookingStreak, WeekStats } from '../../lib/services/statsService';

interface CalendarWeekCardProps {
  weekDots: WeekDot[];
  streak: CookingStreak;
  weekStats: { current: WeekStats; prior: WeekStats } | null;
  selectedWeekOffset: number;
  onWeekChange: (offset: number) => void;
  onDayPress?: (date: string, mealId?: string) => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getWeekTitle(offset: number, dots: WeekDot[]): string {
  if (offset === 0) return 'This Week';
  if (dots.length < 7) return 'Week';
  const first = new Date(dots[0].day + 'T00:00:00');
  const last = new Date(dots[6].day + 'T00:00:00');
  const startStr = `${MONTHS[first.getMonth()]} ${first.getDate()}`;
  const endStr = `${last.getDate()}`;
  return `${startStr} – ${endStr}`;
}

function getTodayStr(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export default function CalendarWeekCard({
  weekDots,
  streak,
  weekStats,
  selectedWeekOffset,
  onWeekChange,
  onDayPress,
}: CalendarWeekCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = getTodayStr();
  const title = getWeekTitle(selectedWeekOffset, weekDots);

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.navGroup}>
          <TouchableOpacity
            onPress={() => onWeekChange(selectedWeekOffset + 1)}
            style={styles.navBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.navArrow}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={styles.weekTitle}>{title}</Text>
          <TouchableOpacity
            onPress={() => onWeekChange(Math.max(0, selectedWeekOffset - 1))}
            disabled={selectedWeekOffset === 0}
            style={[styles.navBtn, selectedWeekOffset === 0 && styles.navBtnDisabled]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.navArrow, selectedWeekOffset === 0 && styles.navArrowDisabled]}>{'›'}</Text>
          </TouchableOpacity>
        </View>
        {streak.current > 0 && (
          <View style={[styles.streakPill, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.streakPillText, { color: colors.primary }]}>
              🔥 {streak.current} week{streak.current !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Day labels */}
      <View style={styles.dayLabelRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.dayLabelCell}>
            <Text style={styles.dayLabelText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* 7-day grid */}
      <View style={styles.dotsRow}>
        {weekDots.map((dot, i) => {
          const isToday = dot.day === today;
          const hasMeal = dot.hasMeal;

          return (
            <TouchableOpacity
              key={dot.day}
              style={[
                styles.dayCell,
                hasMeal && { backgroundColor: colors.primary + '15' },
                !hasMeal && styles.dayCellEmpty,
                isToday && !hasMeal && { backgroundColor: colors.background.card, borderColor: colors.primary, borderWidth: 2 },
                isToday && hasMeal && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              onPress={() => onDayPress?.(dot.day, dot.mealId)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayEmoji,
                !hasMeal && !isToday && styles.dayDot,
                isToday && !hasMeal && { color: colors.primary },
              ]}>
                {hasMeal ? (dot.emoji || '👨‍🍳') : (isToday ? '?' : '·')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stats row */}
      {weekStats && (
        <View style={styles.statsRow}>
          <StatColumn
            label="Meals"
            value={weekStats.current.meals}
            delta={weekStats.current.meals - weekStats.prior.meals}
            colors={colors}
          />
          <StatColumn
            label="Recipes"
            value={weekStats.current.uniqueRecipes}
            delta={weekStats.current.uniqueRecipes - weekStats.prior.uniqueRecipes}
            colors={colors}
          />
          <StatColumn
            label="Cal Avg"
            value={weekStats.current.calAvg}
            delta={weekStats.current.calAvg - weekStats.prior.calAvg}
            colors={colors}
          />
          <StatColumn
            label="New"
            value={weekStats.current.newRecipes}
            delta={weekStats.current.newRecipes - weekStats.prior.newRecipes}
            colors={colors}
          />
        </View>
      )}
    </View>
  );
}

function StatColumn({ label, value, delta, colors }: {
  label: string;
  value: number;
  delta: number;
  colors: any;
}) {
  const deltaText = delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : '';
  const deltaColor = delta > 0 ? '#10B981' : colors.text.tertiary;

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{
        fontSize: typography.sizes.xs,
        color: colors.text.tertiary,
        marginBottom: 2,
      }}>{label}</Text>
      <Text style={{
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold as any,
        color: colors.text.primary,
      }}>{value}</Text>
      {deltaText !== '' && (
        <Text style={{
          fontSize: 10,
          color: deltaColor,
          marginTop: 1,
        }}>{deltaText}</Text>
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.background.card,
      borderRadius: 14,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...shadows.small,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    navGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    navBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBtnDisabled: {
      opacity: 0.25,
    },
    navArrow: {
      fontSize: 22,
      color: colors.text.secondary,
      fontWeight: '600',
    },
    navArrowDisabled: {
      color: colors.text.tertiary,
    },
    weekTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
    },
    streakPill: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
    },
    streakPillText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
    },
    dayLabelRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    dayLabelCell: {
      flex: 1,
      alignItems: 'center',
    },
    dayLabelText: {
      fontSize: 11,
      color: colors.text.tertiary,
      fontWeight: typography.weights.medium as any,
    },
    dotsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      maxWidth: 40,
      maxHeight: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellEmpty: {
      backgroundColor: colors.background.secondary,
    },
    dayEmoji: {
      fontSize: 16,
    },
    dayDot: {
      fontSize: 18,
      color: colors.text.tertiary,
    },
    statsRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      paddingTop: spacing.sm,
    },
  });
}
