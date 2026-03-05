// components/stats/WeeklyChart.tsx
// Extracted from StatsOverview — multi-mode weekly chart with mode toggle pills,
// tappable dots, selected week highlight, and hint text.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Line, Text as SvgText, Rect, Circle } from 'react-native-svg';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../../lib/theme';
import type { WeeklyFrequency, DateRange, StatsPeriod } from '../../lib/services/statsService';

// ── Types ────────────────────────────────────────────────────────

export type ChartMode = 'meals' | 'calories' | 'protein' | 'veg_pct' | 'new_repeat';

export interface WeeklyChartProps {
  data: WeeklyFrequency[];
  mode: ChartMode;
  onModeChange: (mode: ChartMode) => void;
  selectedWeekIndex: number | null; // index in data array
  onWeekSelect: (index: number) => void;
  dateRange: DateRange;
  period?: StatsPeriod;
}

// ── Monthly aggregation (for 1Y period) ──────────────────────────

function aggregateToMonthly(data: WeeklyFrequency[]): WeeklyFrequency[] {
  const monthMap = new Map<string, { weeks: WeeklyFrequency[]; representative: WeeklyFrequency }>();

  for (const w of data) {
    const d = new Date(w.week + 'T00:00:00');
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { weeks: [], representative: w });
    }
    monthMap.get(key)!.weeks.push(w);
  }

  return Array.from(monthMap.values()).map(({ weeks, representative }) => {
    const avg = (vals: number[]) => vals.length > 0
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 0;
    return {
      ...representative,
      count: avg(weeks.map(w => w.count)),
      caloriesAvg: avg(weeks.map(w => w.caloriesAvg ?? 0)),
      proteinAvg: avg(weeks.map(w => w.proteinAvg ?? 0)),
      vegPct: avg(weeks.map(w => w.vegPct ?? 0)),
      newCount: avg(weeks.map(w => w.newCount ?? 0)),
      repeatCount: avg(weeks.map(w => w.repeatCount ?? 0)),
    } as WeeklyFrequency;
  });
}

// ── Mode config ──────────────────────────────────────────────────

interface ModeConfig {
  label: string;
  pillLabel: string;
  getValue: (d: WeeklyFrequency) => number;
  formatTick?: (v: number) => string;
}

const MODE_CONFIGS: Record<Exclude<ChartMode, 'new_repeat'>, ModeConfig> = {
  meals: {
    label: 'Meals Per Week',
    pillLabel: 'Meals',
    getValue: (d) => d.count,
  },
  calories: {
    label: 'Avg Calories Per Week',
    pillLabel: 'Calories',
    getValue: (d) => d.caloriesAvg ?? 0,
  },
  protein: {
    label: 'Avg Protein Per Week',
    pillLabel: 'Protein',
    getValue: (d) => d.proteinAvg ?? 0,
    formatTick: (v) => `${Math.round(v)}g`,
  },
  veg_pct: {
    label: 'Vegetarian % Per Week',
    pillLabel: 'Veg %',
    getValue: (d) => d.vegPct ?? 0,
    formatTick: (v) => `${Math.round(v)}%`,
  },
};

const MODE_ORDER: ChartMode[] = ['meals', 'calories', 'protein', 'veg_pct', 'new_repeat'];

// ── X-axis helpers ───────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getXAxisLabels(data: WeeklyFrequency[]): { index: number; label: string }[] {
  if (data.length === 0) return [];
  const labels: { index: number; label: string }[] = [];
  let lastMonth = -1;
  for (let i = 0; i < data.length; i++) {
    const d = new Date(data[i].week + 'T00:00:00');
    const month = d.getMonth();
    if (month !== lastMonth) {
      labels.push({ index: i, label: MONTH_NAMES[month] });
      lastMonth = month;
    }
  }
  return labels;
}

// ── Component ────────────────────────────────────────────────────

export default function WeeklyChart({
  data,
  mode,
  onModeChange,
  selectedWeekIndex,
  onWeekSelect,
  dateRange,
  period,
}: WeeklyChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - (spacing.lg * 4);

  // Infer period from dateRange span if not explicitly provided
  const effectivePeriod = useMemo(() => {
    if (period) return period;
    const spanDays = (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24);
    if (spanDays > 300) return '1y' as StatsPeriod;
    if (spanDays > 150) return '6m' as StatsPeriod;
    return '12w' as StatsPeriod;
  }, [period, dateRange]);

  // Aggregate to monthly when period is 1Y
  const displayData = effectivePeriod === '1y' ? aggregateToMonthly(data) : data;

  // When in monthly mode, map monthly dot press back to original data index
  const handleDotPress = (index: number) => {
    if (effectivePeriod === '1y') {
      const monthDot = displayData[index];
      const originalIndex = data.findIndex(w => w.week === monthDot.week);
      if (originalIndex >= 0) onWeekSelect(originalIndex);
    } else {
      onWeekSelect(index);
    }
  };

  // Map selectedWeekIndex from original data to displayData index
  const displaySelectedIndex = useMemo(() => {
    if (selectedWeekIndex === null) return null;
    if (effectivePeriod !== '1y') return selectedWeekIndex;
    const selectedWeek = data[selectedWeekIndex]?.week;
    if (!selectedWeek) return null;
    return displayData.findIndex(d => d.week === selectedWeek);
  }, [selectedWeekIndex, effectivePeriod, data, displayData]);

  // Check if a mode has any non-zero data
  const hasDataForMode = (m: ChartMode): boolean => {
    if (m === 'new_repeat') {
      return displayData.some(d => (d.newCount ?? 0) > 0 || (d.repeatCount ?? 0) > 0);
    }
    const config = MODE_CONFIGS[m as Exclude<ChartMode, 'new_repeat'>];
    return displayData.some(d => config.getValue(d) > 0);
  };

  const currentModeHasData = hasDataForMode(mode);

  if (displayData.length < 2) {
    return (
      <View>
        <ModePills mode={mode} onModeChange={onModeChange} colors={colors} styles={styles} />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>
            Not enough data yet
          </Text>
        </View>
      </View>
    );
  }

  if (!currentModeHasData) {
    return (
      <View>
        <ModePills mode={mode} onModeChange={onModeChange} colors={colors} styles={styles} />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>
            Not enough data for this view
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <ModePills mode={mode} onModeChange={onModeChange} colors={colors} styles={styles} />

      {mode === 'new_repeat' ? (
        <DualLineChart
          data={displayData}
          chartWidth={chartWidth}
          selectedWeekIndex={displaySelectedIndex}
          onWeekSelect={handleDotPress}
          colors={colors}
        />
      ) : (
        <SingleLineChart
          data={displayData}
          chartWidth={chartWidth}
          mode={mode}
          selectedWeekIndex={displaySelectedIndex}
          onWeekSelect={handleDotPress}
          colors={colors}
        />
      )}

      {/* Hint text — shown when no week is selected */}
      {displaySelectedIndex === null && (
        <Text style={[styles.hintText, { color: colors.text.tertiary }]}>
          Tap a week to explore details above
        </Text>
      )}
    </View>
  );
}

// ── Mode Pills ───────────────────────────────────────────────────

function ModePills({
  mode,
  onModeChange,
  colors,
  styles,
}: {
  mode: ChartMode;
  onModeChange: (m: ChartMode) => void;
  colors: any;
  styles: any;
}) {
  const pillLabels: Record<ChartMode, string> = {
    meals: 'Meals',
    calories: 'Calories',
    protein: 'Protein',
    veg_pct: 'Veg %',
    new_repeat: 'New / Repeat',
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillsContainer}
      style={styles.pillsScroll}
    >
      {MODE_ORDER.map((m) => {
        const isActive = mode === m;
        return (
          <TouchableOpacity
            key={m}
            style={[
              styles.pill,
              isActive
                ? { backgroundColor: colors.primary + '18', borderWidth: 0 }
                : { backgroundColor: 'transparent', borderWidth: 0 },
            ]}
            onPress={() => onModeChange(m)}
          >
            <Text
              style={[
                styles.pillText,
                { color: isActive ? colors.primary : colors.text.tertiary },
                isActive && { fontWeight: '600' as any },
              ]}
            >
              {pillLabels[m]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Single Line Chart ────────────────────────────────────────────

function SingleLineChart({
  data,
  chartWidth,
  mode,
  selectedWeekIndex,
  onWeekSelect,
  colors,
}: {
  data: WeeklyFrequency[];
  chartWidth: number;
  mode: Exclude<ChartMode, 'new_repeat'>;
  selectedWeekIndex: number | null;
  onWeekSelect: (index: number) => void;
  colors: any;
}) {
  const config = MODE_CONFIGS[mode];
  const chartHeight = 140;
  const paddingLeft = 30;
  const paddingRight = 8;
  const paddingTop = 8;
  const paddingBottom = 28;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const values = data.map(d => config.getValue(d));
  const maxVal = Math.max(...values, 1);

  // Y-axis ticks
  const yTicks = mode === 'veg_pct'
    ? [0, 50, 100]
    : [0, Math.ceil(maxVal / 2), Math.ceil(maxVal)];
  const yMax = mode === 'veg_pct' ? 100 : Math.ceil(maxVal);

  const formatTick = config.formatTick || ((v: number) => `${Math.round(v)}`);

  // Points
  const points = data.map((_, i) => {
    const x = paddingLeft + (i / (data.length - 1)) * plotWidth;
    const y = paddingTop + plotHeight - (values[i] / yMax) * plotHeight;
    return { x, y };
  });

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }

  const fillD = pathD
    + ` L ${points[points.length - 1].x} ${paddingTop + plotHeight}`
    + ` L ${points[0].x} ${paddingTop + plotHeight} Z`;

  const xLabels = getXAxisLabels(data);

  return (
    <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
      {/* Y-axis grid lines */}
      {yTicks.map((tick) => {
        const y = paddingTop + plotHeight - (tick / yMax) * plotHeight;
        return (
          <React.Fragment key={tick}>
            <Line
              x1={paddingLeft}
              y1={y}
              x2={chartWidth - paddingRight}
              y2={y}
              stroke={colors.border.light}
              strokeWidth={1}
            />
            <SvgText
              x={paddingLeft - 4}
              y={y + 4}
              fontSize={10}
              fill={colors.text.tertiary}
              textAnchor="end"
            >
              {formatTick(tick)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Selected week highlight — 16px wide, 6% teal opacity */}
      {selectedWeekIndex !== null && selectedWeekIndex >= 0 && selectedWeekIndex < points.length && (
        <Rect
          x={points[selectedWeekIndex].x - 8}
          y={paddingTop}
          width={16}
          height={plotHeight}
          rx={4}
          fill={colors.primary}
          opacity={0.06}
        />
      )}

      {/* Fill area */}
      <Path d={fillD} fill={colors.primary} opacity={0.1} />

      {/* Line */}
      <Path d={pathD} stroke={colors.primary} strokeWidth={2} fill="none" />

      {/* Data dots */}
      {points.map((pt, i) => {
        const isSelected = i === selectedWeekIndex;
        return (
          <Circle
            key={`dot-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={isSelected ? 5.5 : 3.5}
            fill={colors.primary}
            stroke={isSelected ? '#fff' : 'none'}
            strokeWidth={isSelected ? 2 : 0}
          />
        );
      })}

      {/* Invisible 44x44 hit areas */}
      {points.map((pt, i) => (
        <Rect
          key={`hit-${i}`}
          x={pt.x - 22}
          y={pt.y - 22}
          width={44}
          height={44}
          fill="transparent"
          onPress={() => onWeekSelect(i)}
        />
      ))}

      {/* X-axis labels */}
      {xLabels.map(({ index, label }) => {
        const x = paddingLeft + (index / (data.length - 1)) * plotWidth;
        return (
          <SvgText
            key={`x-${index}`}
            x={x}
            y={chartHeight - 4}
            fontSize={9}
            fill={colors.text.tertiary}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ── Dual Line Chart (New vs Repeat) ──────────────────────────────

function DualLineChart({
  data,
  chartWidth,
  selectedWeekIndex,
  onWeekSelect,
  colors,
}: {
  data: WeeklyFrequency[];
  chartWidth: number;
  selectedWeekIndex: number | null;
  onWeekSelect: (index: number) => void;
  colors: any;
}) {
  const chartHeight = 160; // slightly taller for legend
  const paddingLeft = 24;
  const paddingRight = 8;
  const paddingTop = 8;
  const paddingBottom = 44; // room for legend
  const REPEAT_COLOR = '#9ca3af'; // gray

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const newVals = data.map(d => d.newCount ?? 0);
  const repeatVals = data.map(d => d.repeatCount ?? 0);
  const maxVal = Math.max(...newVals, ...repeatVals, 1);
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal];

  const makePoints = (vals: number[]) =>
    data.map((_, i) => ({
      x: paddingLeft + (i / (data.length - 1)) * plotWidth,
      y: paddingTop + plotHeight - (vals[i] / maxVal) * plotHeight,
    }));

  const newPoints = makePoints(newVals);
  const repeatPoints = makePoints(repeatVals);

  const makePath = (pts: { x: number; y: number }[]) => {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    return d;
  };

  const newPathD = makePath(newPoints);
  const repeatPathD = makePath(repeatPoints);

  // Fill for new line
  const newFillD = newPathD
    + ` L ${newPoints[newPoints.length - 1].x} ${paddingTop + plotHeight}`
    + ` L ${newPoints[0].x} ${paddingTop + plotHeight} Z`;

  const xLabels = getXAxisLabels(data);

  return (
    <View>
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Y-axis grid lines */}
        {yTicks.map((tick) => {
          const y = paddingTop + plotHeight - (tick / maxVal) * plotHeight;
          return (
            <React.Fragment key={tick}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke={colors.border.light}
                strokeWidth={1}
              />
              <SvgText
                x={paddingLeft - 4}
                y={y + 4}
                fontSize={10}
                fill={colors.text.tertiary}
                textAnchor="end"
              >
                {tick}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Selected week highlight */}
        {selectedWeekIndex !== null && selectedWeekIndex >= 0 && selectedWeekIndex < newPoints.length && (
          <Rect
            x={newPoints[selectedWeekIndex].x - 8}
            y={paddingTop}
            width={16}
            height={plotHeight}
            rx={4}
            fill={colors.primary}
            opacity={0.06}
          />
        )}

        {/* New line fill */}
        <Path d={newFillD} fill={colors.primary} opacity={0.1} />

        {/* New line (solid, teal) */}
        <Path d={newPathD} stroke={colors.primary} strokeWidth={2} fill="none" />

        {/* Repeat line (dashed, gray) */}
        <Path d={repeatPathD} stroke={REPEAT_COLOR} strokeWidth={2} fill="none" strokeDasharray="6,4" />

        {/* New dots */}
        {newPoints.map((pt, i) => {
          const isSelected = i === selectedWeekIndex;
          return (
            <Circle
              key={`new-dot-${i}`}
              cx={pt.x}
              cy={pt.y}
              r={isSelected ? 5.5 : 3.5}
              fill={colors.primary}
              stroke={isSelected ? '#fff' : 'none'}
              strokeWidth={isSelected ? 2 : 0}
            />
          );
        })}

        {/* Repeat dots */}
        {repeatPoints.map((pt, i) => {
          const isSelected = i === selectedWeekIndex;
          return (
            <Circle
              key={`rep-dot-${i}`}
              cx={pt.x}
              cy={pt.y}
              r={isSelected ? 5.5 : 3.5}
              fill={REPEAT_COLOR}
              stroke={isSelected ? '#fff' : 'none'}
              strokeWidth={isSelected ? 2 : 0}
            />
          );
        })}

        {/* Hit areas (use new line positions — both lines share same x) */}
        {newPoints.map((pt, i) => (
          <Rect
            key={`hit-${i}`}
            x={pt.x - 22}
            y={paddingTop - 10}
            width={44}
            height={plotHeight + 20}
            fill="transparent"
            onPress={() => onWeekSelect(i)}
          />
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ index, label }) => {
          const x = paddingLeft + (index / (data.length - 1)) * plotWidth;
          return (
            <SvgText
              key={`x-${index}`}
              x={x}
              y={chartHeight - paddingBottom + 16}
              fontSize={9}
              fill={colors.text.tertiary}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}

        {/* Legend */}
        {/* New line legend */}
        <Line x1={paddingLeft} y1={chartHeight - 12} x2={paddingLeft + 16} y2={chartHeight - 12} stroke={colors.primary} strokeWidth={2} />
        <SvgText x={paddingLeft + 20} y={chartHeight - 8} fontSize={10} fill={colors.text.secondary}>New</SvgText>

        {/* Repeat line legend */}
        <Line x1={paddingLeft + 52} y1={chartHeight - 12} x2={paddingLeft + 68} y2={chartHeight - 12} stroke={REPEAT_COLOR} strokeWidth={2} strokeDasharray="4,3" />
        <SvgText x={paddingLeft + 72} y={chartHeight - 8} fontSize={10} fill={colors.text.secondary}>Repeat</SvgText>
      </Svg>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

function createStyles(colors: any) {
  return StyleSheet.create({
    pillsScroll: {
      flexGrow: 0,
      marginBottom: spacing.sm,
    },
    pillsContainer: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    pill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    pillText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium as any,
    },
    emptyContainer: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: typography.sizes.sm,
    },
    hintText: {
      fontSize: typography.sizes.xs,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: spacing.xs,
    },
  });
}
