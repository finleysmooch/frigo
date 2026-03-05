// components/stats/StatsOverview.tsx
// Overview sub-page for the Stats dashboard.
// Cards: CalendarWeekCard, WeeklyChart (extracted, multi-mode),
// Gateway cards (Recipes, Nutrition, Insights, Social),
// How You Cook (compact), Cooking Partners (full), New vs Repeat (compact).

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import UserAvatar from '../UserAvatar';
import type { StatsStackParamList } from '../../App';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import {
  getWeekDots,
  getCookingStreak,
  getWeeklyFrequency,
  getOverviewStats,
  getHowYouCook,
  getCookingPartners,
  getNewVsRepeat,
  getDiversityScore,
  getWeekStats,
  getGatewayInsights,
} from '../../lib/services/statsService';
import type {
  MealTypeFilter,
  DateRange,
  StatsParams,
  WeekDot,
  CookingStreak,
  WeeklyFrequency,
  OverviewStats,
  HowYouCook,
  CookingPartner,
  NewVsRepeat,
  DiversityScore,
  WeekStats,
  GatewayInsights,
} from '../../lib/services/statsService';
import CalendarWeekCard from './CalendarWeekCard';
import GatewayCard from './GatewayCard';
import WeeklyChart from './WeeklyChart';
import type { ChartMode } from './WeeklyChart';
import PeriodToggle from './PeriodToggle';
import type { PeriodOption } from './PeriodToggle';
import MealTypeDropdown from './MealTypeDropdown';
import { RecipesOutline } from '../icons';
import type { StatsPeriod } from '../../lib/services/statsService';

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: '12W', value: '12w' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
];

interface StatsOverviewProps {
  userId: string;
  mealType: MealTypeFilter;
  onMealTypeChange: (mealType: MealTypeFilter) => void;
  dateRange: DateRange;
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
  timeOffset: number;
  onTimeOffsetChange: React.Dispatch<React.SetStateAction<number>>;
  isAtMaxOffset: boolean;
  onNavigateSubTab: (tab: 'overview' | 'recipes' | 'nutrition' | 'insights') => void;
  onDataBoundsReady?: (earliestWeek: string) => void;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
}

function getDateRangeLabel(dateRange: DateRange): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const startStr = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const endStr = `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${startStr}, ${start.getFullYear()} - ${endStr}, ${end.getFullYear()}`;
  }
  return `${startStr} - ${endStr}, ${end.getFullYear()}`;
}

/** Get Monday of a given date's week */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function StatsOverview({ userId, mealType, onMealTypeChange, dateRange, period, onPeriodChange, timeOffset, onTimeOffsetChange, isAtMaxOffset, onNavigateSubTab, onDataBoundsReady, navigation }: StatsOverviewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [frequencyLoading, setFrequencyLoading] = useState(true);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [weekDots, setWeekDots] = useState<WeekDot[]>([]);
  const [streak, setStreak] = useState<CookingStreak>({ current: 0, best: 0 });
  const [frequency, setFrequency] = useState<WeeklyFrequency[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [howYouCook, setHowYouCook] = useState<HowYouCook | null>(null);
  const [partners, setPartners] = useState<CookingPartner[]>([]);
  const [newVsRepeat, setNewVsRepeat] = useState<NewVsRepeat | null>(null);
  const [diversity, setDiversity] = useState<DiversityScore | null>(null);
  const [gatewayInsights, setGatewayInsights] = useState<GatewayInsights | null>(null);

  // Week selection state (Task 2)
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [weekStatsData, setWeekStatsData] = useState<{ current: WeekStats; prior: WeekStats } | null>(null);
  const weekFetchRef = useRef(0); // for cancelling stale week fetches

  // Chart mode state (Session 2 — lives here so it persists across re-renders)
  const [chartMode, setChartMode] = useState<ChartMode>('meals');
  const [dateRangePopupVisible, setDateRangePopupVisible] = useState(false);
  const dateChipRef = useRef<TouchableOpacity>(null);
  const [dateChipLayout, setDateChipLayout] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const handleDateChipPress = useCallback(() => {
    dateChipRef.current?.measureInWindow((x, y, w, h) => {
      setDateChipLayout({ x, y, w, h });
      setDateRangePopupVisible(true);
    });
  }, []);

  const params: StatsParams = useMemo(
    () => ({ userId, dateRange, mealType }),
    [userId, dateRange, mealType]
  );

  // Streak — only depends on userId
  useEffect(() => {
    if (!userId) return;
    getCookingStreak(userId).then(setStreak).catch(console.error);
  }, [userId]);

  // Chart data (frequency)
  useEffect(() => {
    if (!userId) return;
    setFrequencyLoading(true);
    getWeeklyFrequency(userId, mealType).then(freqRaw => {
      if (freqRaw.length > 0 && onDataBoundsReady) {
        onDataBoundsReady(freqRaw[0].week);
      }
      const rangeStart = new Date(dateRange.start);
      const rangeEnd = new Date(dateRange.end);
      const sliced = freqRaw.filter(f => {
        const d = new Date(f.week + 'T00:00:00');
        return d >= rangeStart && d <= rangeEnd;
      });
      setFrequency(sliced);
    }).catch(err => console.error('Error loading frequency:', err))
      .finally(() => setFrequencyLoading(false));
  }, [userId, dateRange.start, dateRange.end, mealType]);

  // Sections data (overview stats, gateway insights, partners, how you cook, new vs repeat, diversity)
  useEffect(() => {
    if (!userId) return;
    setSectionsLoading(true);

    const windowMs = new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime();
    const priorDateRange: DateRange = {
      start: new Date(new Date(dateRange.start).getTime() - windowMs).toISOString(),
      end: dateRange.start,
    };

    Promise.all([
      getOverviewStats(params),
      getHowYouCook(params),
      getCookingPartners(params),
      getNewVsRepeat(params),
      getDiversityScore(params),
      getGatewayInsights(params, priorDateRange),
    ]).then(([over, how, parts, nvr, div, insights]) => {
      setOverview(over);
      setHowYouCook(how);
      setPartners(parts);
      setNewVsRepeat(nvr);
      setDiversity(div);
      setGatewayInsights(insights);
    }).catch(err => console.error('Error loading sections:', err))
      .finally(() => setSectionsLoading(false));
  }, [userId, dateRange.start, dateRange.end, mealType]);

  // Week-specific data load (separate — Task 2)
  useEffect(() => {
    if (!userId) return;
    const fetchId = ++weekFetchRef.current;
    const monday = getMondayOfWeek(new Date());
    monday.setDate(monday.getDate() - selectedWeekOffset * 7);

    Promise.all([
      getWeekDots(userId, monday),
      getWeekStats(userId, monday, mealType),
    ]).then(([dots, stats]) => {
      if (fetchId !== weekFetchRef.current) return; // stale
      setWeekDots(dots);
      setWeekStatsData(stats);
    }).catch(err => {
      console.error('Error loading week data:', err);
    });
  }, [userId, selectedWeekOffset, mealType]);

  // Compute partner cooking percentage for Social gateway
  const totalCooks = overview?.totalCooks || 0;
  const partnerCooks = partners.reduce((sum, p) => sum + p.count, 0);
  const partnerPct = totalCooks > 0 ? Math.round((partnerCooks / totalCooks) * 100) : 0;

  // How You Cook compact percentages
  const howTotal = howYouCook ? (howYouCook.fromRecipe + howYouCook.modified + howYouCook.freeform) : 0;
  const howRecipePct = howTotal > 0 ? Math.round((howYouCook!.fromRecipe / howTotal) * 100) : 0;
  const howModifiedPct = howTotal > 0 ? Math.round((howYouCook!.modified / howTotal) * 100) : 0;
  const howFreeformPct = howTotal > 0 ? Math.round((howYouCook!.freeform / howTotal) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* CalendarWeekCard — replaces Streak + StreakDots (Task 3) */}
      <CalendarWeekCard
        weekDots={weekDots}
        streak={streak}
        weekStats={weekStatsData}
        selectedWeekOffset={selectedWeekOffset}
        onWeekChange={setSelectedWeekOffset}
        onDayPress={(date, mealId) => {
          const dot = weekDots.find(d => d.day === date);
          if (dot?.recipeId && dot?.recipeName) {
            navigation.navigate('RecipeDetail', {
              recipe: { id: dot.recipeId, title: dot.recipeName },
            });
          }
        }}
      />

      {/* Weekly Chart with mode toggles + footer controls */}
      <View style={styles.card}>
        {/* Top row: title + meal type */}
        <View style={styles.chartHeaderRow}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
            {chartMode === 'meals' ? 'Meals Per Week'
              : chartMode === 'calories' ? 'Avg Calories'
              : chartMode === 'protein' ? 'Avg Protein'
              : chartMode === 'veg_pct' ? 'Veg %'
              : 'New vs Repeat'}
          </Text>
          <MealTypeDropdown selected={mealType} onSelect={onMealTypeChange} />
        </View>

        {/* Chart (WeeklyChart renders its own mode pills internally) */}
        {frequencyLoading ? (
          <View style={{ height: 120, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <WeeklyChart
            data={frequency}
            mode={chartMode}
            onModeChange={setChartMode}
            selectedWeekIndex={
              selectedWeekOffset >= 0 && selectedWeekOffset <= frequency.length - 1
                ? (frequency.length - 1) - selectedWeekOffset
                : null
            }
            onWeekSelect={(index) => {
              setSelectedWeekOffset((frequency.length - 1) - index);
            }}
            dateRange={dateRange}
          />
        )}

        {/* Footer: date range chip | period pills */}
        <View style={styles.chartFooterSeparator} />
        <View style={styles.chartFooter}>
          <TouchableOpacity
            ref={dateChipRef}
            style={styles.dateRangeChip}
            onPress={handleDateChipPress}
            activeOpacity={0.7}
          >
            <Text style={styles.dateRangeChipText}>{getDateRangeLabel(dateRange)}</Text>
            <Text style={styles.dateRangeChipChevron}>▾</Text>
          </TouchableOpacity>
          <View style={styles.chartPeriodGroup}>
            <PeriodToggle
              options={PERIOD_OPTIONS}
              selected={period}
              onSelect={(v) => onPeriodChange(v as StatsPeriod)}
            />
          </View>
        </View>
      </View>

      {/* Date range navigation popup */}
      <Modal
        visible={dateRangePopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateRangePopupVisible(false)}
      >
        <TouchableOpacity
          style={styles.popupBackdrop}
          activeOpacity={1}
          onPress={() => setDateRangePopupVisible(false)}
        >
          {dateChipLayout && (
          <View
            style={[
              styles.dateNavPopup,
              {
                position: 'absolute',
                top: dateChipLayout.y + dateChipLayout.h + 4,
                left: dateChipLayout.x,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.dateNavRow}>
              <TouchableOpacity
                style={[styles.dateNavBtn, isAtMaxOffset && { opacity: 0.25 }]}
                onPress={() => onTimeOffsetChange(o => o + 1)}
                disabled={isAtMaxOffset}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.dateNavBtnText}>← Older</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateNavBtn, timeOffset === 0 && { opacity: 0.25 }]}
                onPress={() => onTimeOffsetChange(o => Math.max(0, o - 1))}
                disabled={timeOffset === 0}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.dateNavBtnText}>Newer →</Text>
              </TouchableOpacity>
            </View>
            {timeOffset > 0 && (
              <TouchableOpacity
                style={styles.dateNavReset}
                onPress={() => onTimeOffsetChange(0)}
              >
                <Text style={styles.dateNavResetText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* Sections: gateway cards, how you cook, partners, new vs repeat */}
      {sectionsLoading ? (
        <View style={{ height: 80, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <>
          {/* Gateway Cards - 2x2 grid */}
          <View style={styles.gatewayGrid}>
            <View style={styles.gatewayRow}>
              <GatewayCard
                iconComponent={RecipesOutline}
                value={overview?.uniqueRecipes ?? 0}
                label="Recipes"
                detail={`${overview?.newRecipesThisWeek ?? 0} new this week`}
                insight={gatewayInsights?.recipes.insight}
                period={gatewayInsights?.recipes.period}
                actionText="Explore"
                onPress={() => onNavigateSubTab('recipes')}
              />
              <GatewayCard
                iconEmoji="🥗"
                value={overview?.avgCalories != null && overview.avgCalories > 0
                  ? `${Math.round(overview.avgCalories)}`
                  : '—'}
                label="Cal Avg"
                detail="per recipe"
                insight={gatewayInsights?.calories.insight}
                period={gatewayInsights?.calories.period}
                actionText="Details"
                onPress={() => onNavigateSubTab('nutrition')}
              />
            </View>
            <View style={styles.gatewayRow}>
              <GatewayCard
                iconEmoji="🌍"
                value={diversity?.score ?? 0}
                label="Diversity"
                detail={diversity?.label ?? 'Cook more to see'}
                insight={gatewayInsights?.diversity.insight}
                period={gatewayInsights?.diversity.period}
                actionText="Explore"
                onPress={() => onNavigateSubTab('insights')}
              />
              <GatewayCard
                iconEmoji="👥"
                value={`${partnerPct}%`}
                label="Social"
                detail={`${partners.length} cooking partner${partners.length !== 1 ? 's' : ''}`}
                insight={gatewayInsights?.social.insight}
                period={gatewayInsights?.social.period}
              />
            </View>
          </View>

          {/* How You Cook — compact */}
          {howYouCook && howTotal > 0 && (
            <View style={styles.compactCard}>
              <Text style={styles.compactTitle}>How You Cook</Text>
              <View style={styles.compactRow}>
                <CompactStat color={colors.primary} label="Recipe" pct={howRecipePct} />
                <Text style={styles.compactDot}>·</Text>
                <CompactStat color={colors.accent || '#f59e0b'} label="Modified" pct={howModifiedPct} />
                <Text style={styles.compactDot}>·</Text>
                <CompactStat color={colors.text.tertiary} label="Freeform" pct={howFreeformPct} />
              </View>
            </View>
          )}

          {/* Cooking Partners */}
          {partners.length > 0 && (() => {
            const maxPartnerCount = Math.max(...partners.map(p => p.count), 1);
            return (
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitleIcon}>👥</Text>
                  <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Cooking Partners</Text>
                </View>
                {partners.slice(0, 5).map((partner) => (
                  <TouchableOpacity
                    key={partner.userId}
                    style={styles.partnerRow}
                    onPress={() => navigation.navigate('UserPosts', {
                      userId: partner.userId,
                      displayName: partner.displayName,
                    })}
                    activeOpacity={0.7}
                  >
                    <UserAvatar user={{ avatar_url: partner.avatarUrl }} size={36} />
                    <Text style={styles.partnerName} numberOfLines={1}>{partner.displayName}</Text>
                    <Text style={styles.partnerCount}>{partner.count}</Text>
                    <View style={styles.partnerBarTrack}>
                      <View style={[styles.partnerBarFill, { width: `${(partner.count / maxPartnerCount) * 100}%` }]} />
                    </View>
                    <Text style={styles.partnerChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}

          {/* New vs Repeat — compact */}
          {newVsRepeat && (newVsRepeat.newPct > 0 || newVsRepeat.repeatPct > 0) && (
            <View style={styles.compactCard}>
              <View style={styles.compactRow}>
                <Text style={[styles.compactStatText, { color: colors.primary }]}>
                  {newVsRepeat.newPct}% New
                </Text>
                <Text style={styles.compactDot}>·</Text>
                <Text style={[styles.compactStatText, { color: colors.text.tertiary }]}>
                  {newVsRepeat.repeatPct}% Repeat
                </Text>
              </View>
              <View style={styles.thinBarTrack}>
                <View style={[styles.thinBarFill, {
                  width: `${newVsRepeat.newPct}%`,
                  backgroundColor: colors.primary,
                }]} />
              </View>
            </View>
          )}
        </>
      )}

      <View style={styles.bottomPadding} />
    </View>
  );
}

// ── Compact stat helper ──────────────────────────────────────────

function CompactStat({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: typography.sizes.xs, color: '#6b7280' }}>
        {pct}% {label}
      </Text>
    </View>
  );
}


// ── Styles ───────────────────────────────────────────────────────

function createStyles(colors: any) {
  return StyleSheet.create({
    loadingContainer: {
      paddingVertical: 80,
      alignItems: 'center',
    },
    container: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...shadows.small,
    },
    cardTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    chartHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    chartFooterSeparator: {
      height: 1,
      backgroundColor: colors.border.light,
      marginTop: spacing.sm,
    },
    chartFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.sm,
    },
    dateRangeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    dateRangeChipText: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      fontWeight: typography.weights.medium as any,
    },
    dateRangeChipChevron: {
      fontSize: 10,
      color: colors.primary,
    },
    popupBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    dateNavPopup: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      ...shadows.medium,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    dateNavRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    dateNavBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.sm,
    },
    dateNavBtnText: {
      fontSize: typography.sizes.xs,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium as any,
    },
    dateNavReset: {
      alignItems: 'center',
      paddingTop: spacing.xs,
    },
    dateNavResetText: {
      fontSize: typography.sizes.xs,
      color: colors.primary,
      fontWeight: typography.weights.medium as any,
    },
    chartPeriodGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    cardTitleIcon: {
      fontSize: 18,
    },
    compactCard: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...shadows.small,
    },
    compactTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    compactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    compactDot: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
    },
    compactStatText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
    },
    thinBarTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border.light,
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    thinBarFill: {
      height: '100%',
      borderRadius: 2,
    },
    gatewayGrid: {
      gap: spacing.md,
    },
    gatewayRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    partnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    partnerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    partnerName: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    partnerCount: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
    },
    partnerBarTrack: {
      width: 60,
      height: 3,
      backgroundColor: colors.border.light,
      borderRadius: 2,
      overflow: 'hidden',
    },
    partnerBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    partnerChevron: {
      fontSize: 16,
      color: colors.text.tertiary,
      marginLeft: spacing.xs,
    },
    bottomPadding: {
      height: 40,
    },
  });
}
