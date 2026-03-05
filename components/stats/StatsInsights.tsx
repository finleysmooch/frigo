// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/StatsInsights.tsx
// Insights sub-page for the Stats dashboard.
// Sections: Cooking Personality, Diversity Score, Growth Timeline,
// Complexity Trend, Seasonal Patterns, When You Cook (heatmap), Pantry Utilization.

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import {
  getDiversityScore,
  getComplexityTrend,
  getSeasonalPatterns,
  getCookingHeatmap,
  getPantryUtilization,
  getCookingPersonality,
  getGrowthMilestones,
} from '../../lib/services/statsService';
import type {
  MealTypeFilter,
  DateRange,
  StatsParams,
  DiversityScore,
  ComplexityTrendPoint,
  SeasonalPattern,
  HeatmapCell,
  PantryUtilization,
  CookingPersonality,
  GrowthMilestone,
} from '../../lib/services/statsService';
import DiversityBadge from './DiversityBadge';
import CookingPersonalityCard from './CookingPersonalityCard';
import GrowthTimeline from './GrowthTimeline';

/** Convert DB strings like "composed_plate" → "Composed Plate" */
function formatConcept(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

interface StatsInsightsProps {
  userId: string;
  mealType: MealTypeFilter;
  dateRange: DateRange;
}

export default function StatsInsights({ userId, mealType, dateRange }: StatsInsightsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params: StatsParams = useMemo(
    () => ({ userId, dateRange, mealType }),
    [userId, dateRange, mealType]
  );

  return (
    <View style={styles.container}>
      <PersonalitySection params={params} colors={colors} styles={styles} />
      <DiversitySection params={params} colors={colors} styles={styles} />
      <GrowthSection userId={userId} mealType={mealType} colors={colors} styles={styles} />
      <ComplexitySection params={params} colors={colors} styles={styles} />
      <SeasonalSection userId={userId} colors={colors} styles={styles} />
      <HeatmapSection params={params} colors={colors} styles={styles} />
      <PantrySection userId={userId} colors={colors} styles={styles} />
      <View style={styles.bottomPadding} />
    </View>
  );
}

// ── Section: Cooking Personality ──────────────────────────────────

function PersonalitySection({
  params, colors, styles,
}: {
  params: StatsParams; colors: any; styles: any;
}) {
  const [data, setData] = useState<CookingPersonality | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getCookingPersonality(params));
    } catch (err) {
      console.error('Error loading personality:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CardShell title="Your Cooking Style" styles={styles}><SectionLoader color={colors.primary} /></CardShell>;
  if (!data) return null;

  return <CookingPersonalityCard title={data.title} narrative={data.narrative} tags={data.tags} />;
}

// ── Section: Growth Timeline ─────────────────────────────────────

function GrowthSection({
  userId, mealType, colors, styles,
}: {
  userId: string; mealType: MealTypeFilter; colors: any; styles: any;
}) {
  const [milestones, setMilestones] = useState<GrowthMilestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [userId, mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setMilestones(await getGrowthMilestones(userId, mealType, 6));
    } catch (err) {
      console.error('Error loading growth milestones:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CardShell title="How You've Grown" styles={styles}><SectionLoader color={colors.primary} /></CardShell>;
  if (milestones.length === 0) return null;

  return <GrowthTimeline milestones={milestones} />;
}

// ── Section: Diversity Score ─────────────────────────────────────

function DiversitySection({
  params, colors, styles,
}: {
  params: StatsParams; colors: any; styles: any;
}) {
  const [data, setData] = useState<DiversityScore | null>(null);
  const [priorData, setPriorData] = useState<DiversityScore | null>(null);
  const [loading, setLoading] = useState(true);

  // Compute prior date range by shifting back one window
  const priorParams = useMemo(() => {
    const start = new Date(params.dateRange.start);
    const end = new Date(params.dateRange.end);
    const windowMs = end.getTime() - start.getTime();
    const priorEnd = new Date(start.getTime());
    const priorStart = new Date(start.getTime() - windowMs);
    return {
      ...params,
      dateRange: {
        start: priorStart.toISOString().split('T')[0],
        end: priorEnd.toISOString().split('T')[0],
      },
    };
  }, [params]);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      const [current, prior] = await Promise.all([
        getDiversityScore(params),
        getDiversityScore(priorParams),
      ]);
      setData(current);
      setPriorData(prior);
    } catch (err) {
      console.error('Error loading diversity:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CardShell title="Diversity Score" styles={styles}><SectionLoader color={colors.primary} /></CardShell>;
  if (!data) return null;

  // Compute growth deltas
  const newCuisines = priorData ? data.cuisineCount - priorData.cuisineCount : 0;
  const newMethods = priorData ? data.methodCount - priorData.methodCount : 0;
  const hasGrowth = newCuisines > 0 || newMethods > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Diversity Score</Text>
      <View style={styles.diversityContainer}>
        <DiversityBadge score={data.score} label={data.label} />
        <View style={styles.diversityBreakdown}>
          <BreakdownRow label="Cuisines" count={data.cuisineCount} colors={colors} />
          <BreakdownRow label="Methods" count={data.methodCount} colors={colors} />
          <BreakdownRow label="Concepts" count={data.conceptCount} colors={colors} />
          {/* Growth context */}
          <View style={styles.growthContext}>
            <Text style={styles.growthLabel}>Since last period</Text>
            <Text style={styles.growthValue}>
              {hasGrowth
                ? `+${newMethods} new methods, +${newCuisines} new cuisines`
                : 'Maintaining your range'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function BreakdownRow({ label, count, colors }: { label: string; count: number; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs + 1 }}>
      <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>{label}</Text>
      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold as any, color: colors.text.primary }}>{count}</Text>
    </View>
  );
}

// ── Section: Complexity Trend ────────────────────────────────────

function ComplexitySection({
  params, colors, styles,
}: {
  params: StatsParams; colors: any; styles: any;
}) {
  const [data, setData] = useState<ComplexityTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getComplexityTrend(params));
    } catch (err) {
      console.error('Error loading complexity:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CardShell title="Complexity Over Time" styles={styles}><SectionLoader color={colors.primary} /></CardShell>;

  // Sparse data: only ~11 recipes have difficulty scores
  if (data.length < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Complexity Over Time</Text>
        <View style={styles.encourageContainer}>
          <Text style={styles.encourageEmoji}>📈</Text>
          <Text style={styles.encourageTitle}>Building your complexity picture</Text>
          <Text style={styles.encourageSubtext}>
            As you cook more recipes with difficulty ratings, you'll see how your cooking complexity evolves over time
          </Text>
          {data.length === 1 && (
            <Text style={styles.encourageDetail}>
              {data[0].month}: avg difficulty {data[0].avgDifficulty}/10
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Complexity Over Time</Text>
      <ComplexityChart data={data} colors={colors} />
      <Text style={styles.complexityHint}>Improves as more recipes are scored</Text>
    </View>
  );
}

function ComplexityChart({ data, colors }: { data: ComplexityTrendPoint[]; colors: any }) {
  const chartWidth = 320;
  const chartHeight = 80;
  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = 20;
  const plotW = chartWidth - padL - padR;
  const plotH = chartHeight - padT - padB;

  const maxVal = Math.max(...data.map(d => d.avgDifficulty), 1);
  const yTicks = [0, Math.round(maxVal / 2), Math.ceil(maxVal)];

  const points = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * plotW,
    y: padT + plotH - (d.avgDifficulty / maxVal) * plotH,
  }));

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }

  const fillD = pathD
    + ` L ${points[points.length - 1].x} ${padT + plotH}`
    + ` L ${points[0].x} ${padT + plotH} Z`;

  // X-axis labels: first and last month
  const firstLabel = formatMonthLabel(data[0].month);
  const lastLabel = formatMonthLabel(data[data.length - 1].month);

  return (
    <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
      {yTicks.map((tick) => {
        const y = padT + plotH - (tick / maxVal) * plotH;
        return (
          <React.Fragment key={tick}>
            <Line x1={padL} y1={y} x2={chartWidth - padR} y2={y} stroke={colors.border.light} strokeWidth={1} />
            <SvgText x={padL - 4} y={y + 4} fontSize={10} fill={colors.text.tertiary} textAnchor="end">{tick}</SvgText>
          </React.Fragment>
        );
      })}
      <Path d={fillD} fill={colors.accent || '#f59e0b'} opacity={0.1} />
      <Path d={pathD} stroke={colors.accent || '#f59e0b'} strokeWidth={2} fill="none" />
      <SvgText x={padL} y={chartHeight - 4} fontSize={10} fill={colors.text.tertiary}>{firstLabel}</SvgText>
      <SvgText x={chartWidth - padR} y={chartHeight - 4} fontSize={10} fill={colors.text.tertiary} textAnchor="end">{lastLabel}</SvgText>
    </Svg>
  );
}

function formatMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

// ── Section: Seasonal Patterns ───────────────────────────────────

const SEASON_CONFIG: Record<string, { emoji: string; color: string }> = {
  Spring: { emoji: '🌸', color: '#ec4899' },
  Summer: { emoji: '☀️', color: '#f59e0b' },
  Fall: { emoji: '🍂', color: '#ea580c' },
  Winter: { emoji: '❄️', color: '#3b82f6' },
};

function SeasonalSection({
  userId, colors, styles,
}: {
  userId: string; colors: any; styles: any;
}) {
  const [data, setData] = useState<SeasonalPattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getSeasonalPatterns(userId));
    } catch (err) {
      console.error('Error loading seasonal:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CardShell title="Seasonal Patterns" styles={styles}><SectionLoader color={colors.primary} /></CardShell>;
  if (data.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Seasonal Patterns</Text>
      <View style={styles.seasonGrid}>
        {data.map((sp) => {
          const config = SEASON_CONFIG[sp.season] || { emoji: '🍽️', color: colors.primary };
          return (
            <View key={sp.season} style={styles.seasonTile}>
              <Text style={styles.seasonEmoji}>{config.emoji}</Text>
              <Text style={styles.seasonName}>{sp.season}</Text>
              {sp.topConcepts.slice(0, 3).map((concept) => (
                <Text key={concept} style={styles.seasonConcept} numberOfLines={1}>{formatConcept(concept)}</Text>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Section: When You Cook (Heatmap) ─────────────────────────────

// Day labels: Mon-Sun order for display (reorder from service's Sun=0 to Mon-first)
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_LABELS = ['AM', 'Midday', 'PM'];

// Remap service day (0=Sun) to display row (0=Mon)
function serviceToDisplayDay(serviceDay: number): number {
  // Service: 0=Sun,1=Mon,...,6=Sat → Display: 0=Mon,...,5=Sat,6=Sun
  return serviceDay === 0 ? 6 : serviceDay - 1;
}

function HeatmapSection({
  params, colors, styles,
}: {
  params: StatsParams; colors: any; styles: any;
}) {
  const [data, setData] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      const raw = await getCookingHeatmap(params);
      // Adjust from UTC to local timezone
      setData(adjustHeatmapToLocal(raw));
    } catch (err) {
      console.error('Error loading heatmap:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CardShell title="When You Cook" styles={styles}><SectionLoader color={colors.primary} /></CardShell>;

  // Build a lookup: displayDay -> slot -> intensity
  const grid = new Map<string, number>();
  for (const cell of data) {
    const displayDay = serviceToDisplayDay(cell.day);
    grid.set(`${displayDay}-${cell.timeSlot}`, cell.intensity);
  }

  const slots: ('am' | 'mid' | 'pm')[] = ['am', 'mid', 'pm'];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>When You Cook</Text>
      <View style={styles.heatmapContainer}>
        {/* Column headers */}
        <View style={styles.heatmapHeaderRow}>
          <View style={styles.heatmapDayLabel} />
          {SLOT_LABELS.map((label) => (
            <View key={label} style={styles.heatmapHeaderCell}>
              <Text style={styles.heatmapHeaderText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {DAY_LABELS.map((dayLabel, displayDay) => (
          <View key={dayLabel} style={styles.heatmapRow}>
            <View style={styles.heatmapDayLabel}>
              <Text style={styles.heatmapDayText}>{dayLabel}</Text>
            </View>
            {slots.map((slot) => {
              const intensity = grid.get(`${displayDay}-${slot}`) || 0;
              return (
                <View key={slot} style={styles.heatmapCellContainer}>
                  <View
                    style={[
                      styles.heatmapCell,
                      {
                        backgroundColor: colors.primary,
                        opacity: intensity > 0 ? 0.15 + (intensity / 100) * 0.75 : 0.05,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Adjust heatmap cells from UTC to local timezone.
 * The service buckets by UTC hour (AM < 12, Mid 12-17, PM 17+).
 * We shift each bucket's representative hour by the local offset,
 * then re-bucket into local day/slot.
 */
function adjustHeatmapToLocal(cells: HeatmapCell[]): HeatmapCell[] {
  // getTimezoneOffset returns minutes, positive = behind UTC (e.g., +300 for EST)
  const offsetMinutes = new Date().getTimezoneOffset();
  const offsetHours = -offsetMinutes / 60; // e.g., EST = -5, AEST = +10

  // Representative center hour for each slot
  const slotCenterHour: Record<string, number> = { am: 6, mid: 14, pm: 20 };
  const slots: ('am' | 'mid' | 'pm')[] = ['am', 'mid', 'pm'];

  // Accumulate into new local grid
  const localGrid = new Map<string, number>();

  for (const cell of cells) {
    if (cell.intensity === 0) continue;

    const utcHour = slotCenterHour[cell.timeSlot];
    let localHour = utcHour + offsetHours;
    let dayShift = 0;

    if (localHour < 0) {
      localHour += 24;
      dayShift = -1;
    } else if (localHour >= 24) {
      localHour -= 24;
      dayShift = 1;
    }

    // Re-bucket into local slot
    let localSlot: 'am' | 'mid' | 'pm';
    if (localHour < 12) localSlot = 'am';
    else if (localHour < 17) localSlot = 'mid';
    else localSlot = 'pm';

    // Adjust day (0=Sun...6=Sat in service convention)
    let localDay = (cell.day + dayShift + 7) % 7;

    const key = `${localDay}-${localSlot}`;
    localGrid.set(key, (localGrid.get(key) || 0) + cell.intensity);
  }

  // Normalize: find max and scale to 0-100
  const maxIntensity = Math.max(1, ...Array.from(localGrid.values()));

  const result: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (const slot of slots) {
      const key = `${day}-${slot}`;
      const raw = localGrid.get(key) || 0;
      result.push({
        day,
        timeSlot: slot,
        intensity: Math.round((raw / maxIntensity) * 100),
      });
    }
  }

  return result;
}

// ── Section: Pantry Utilization ──────────────────────────────────

function PantrySection({
  userId, colors, styles,
}: {
  userId: string; colors: any; styles: any;
}) {
  const [data, setData] = useState<PantryUtilization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getPantryUtilization(userId));
    } catch (err) {
      console.error('Error loading pantry utilization:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CardShell title="Pantry Utilization" styles={styles}><SectionLoader color={colors.primary} /></CardShell>;
  if (!data || data.total === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pantry Utilization</Text>
        <View style={styles.encourageContainer}>
          <Text style={styles.encourageEmoji}>🥕</Text>
          <Text style={styles.encourageTitle}>Add items to your pantry</Text>
          <Text style={styles.encourageSubtext}>
            See how much of your pantry you're using in your cooking
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Pantry Utilization</Text>
      <View style={styles.pantryContent}>
        <View style={styles.pantryPctContainer}>
          <Text style={styles.pantryPctValue}>{data.pct}%</Text>
          <Text style={styles.pantryPctLabel}>used recently</Text>
        </View>
        <View style={styles.pantryDetail}>
          <Text style={styles.pantryDetailText}>
            {data.used} of {data.total} pantry items used in the last 30 days
          </Text>
          {/* Progress bar */}
          <View style={styles.pantryBarTrack}>
            <View style={[styles.pantryBarFill, { width: `${Math.min(data.pct, 100)}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Shared helpers ───────────────────────────────────────────────

function SectionLoader({ color }: { color: string }) {
  return (
    <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
      <ActivityIndicator size="small" color={color} />
    </View>
  );
}

function CardShell({ title, styles, children }: { title: string; styles: any; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────

function createStyles(colors: any) {
  return StyleSheet.create({
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
    bottomPadding: {
      height: 40,
    },
    // Diversity
    diversityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xl,
      paddingVertical: spacing.md,
    },
    diversityBreakdown: {
      flex: 1,
    },
    growthContext: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.light,
    },
    growthLabel: {
      fontSize: 12,
      fontWeight: typography.weights.medium as any,
      color: colors.text.secondary,
    },
    growthValue: {
      fontSize: 11,
      fontWeight: typography.weights.semibold as any,
      color: colors.primary,
      marginTop: 2,
    },
    // Complexity hint
    complexityHint: {
      fontSize: typography.sizes.xs,
      fontStyle: 'italic',
      color: colors.text.tertiary,
      marginTop: spacing.xs,
    },
    // Encouragement (sparse data)
    encourageContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    encourageEmoji: {
      fontSize: 32,
      marginBottom: spacing.sm,
    },
    encourageTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    encourageSubtext: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
      lineHeight: 20,
    },
    encourageDetail: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      marginTop: spacing.md,
      fontWeight: typography.weights.medium as any,
    },
    // Seasonal
    seasonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    seasonTile: {
      width: '47%' as any,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      gap: spacing.xs,
    },
    seasonEmoji: {
      fontSize: 20,
    },
    seasonName: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
    },
    seasonConcept: {
      fontSize: typography.sizes.xs,
      color: colors.text.secondary,
    },
    // Heatmap
    heatmapContainer: {
      gap: spacing.xs,
    },
    heatmapHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heatmapHeaderCell: {
      flex: 1,
      alignItems: 'center',
    },
    heatmapHeaderText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium as any,
      color: colors.text.tertiary,
    },
    heatmapRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heatmapDayLabel: {
      width: 36,
    },
    heatmapDayText: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
    },
    heatmapCellContainer: {
      flex: 1,
      padding: 2,
    },
    heatmapCell: {
      height: 28,
      borderRadius: borderRadius.sm,
    },
    // Pantry
    pantryContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.sm,
    },
    pantryPctContainer: {
      alignItems: 'center',
    },
    pantryPctValue: {
      fontSize: 32,
      fontWeight: typography.weights.bold as any,
      color: colors.primary,
    },
    pantryPctLabel: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
    },
    pantryDetail: {
      flex: 1,
    },
    pantryDetailText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      marginBottom: spacing.sm,
    },
    pantryBarTrack: {
      height: 8,
      backgroundColor: colors.border.light,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
    },
    pantryBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
  });
}
