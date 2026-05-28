// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// components/stats/StatsNutrition.tsx
// Nutrition sub-page for the Stats dashboard.
// Sections: Macro Ring (SVG Circle donut) + NutrientRow list,
// Nutrient Drill-Down Panels (inline, one at a time),
// Your Goals, How You Eat (dietary tiles), Micronutrients (placeholder).
// Tone: empowering and discovery-oriented, not judgmental.

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import {
  getNutritionAverages,
  getNutrientTrend,
  getTopNutrientSources,
  getHighestNutrientRecipes,
  getDietaryBreakdown,
} from '../../lib/services/statsService';
import type {
  MealTypeFilter,
  DateRange,
  StatsParams,
  StatsNutrient,
  NutritionAverages,
  NutrientTrendPoint,
  NutrientSourceItem,
  HighNutrientRecipe,
  DietaryBreakdown,
} from '../../lib/services/statsService';
import NutrientRow from './NutrientRow';
import GoalRow from './GoalRow';
import DrillDownPanel from './DrillDownPanel';
import MiniBarRow from './MiniBarRow';
import { getNutritionGoals } from '../../lib/services/nutritionGoalsService';
import type { NutritionGoal } from '../../lib/services/nutritionGoalsService';
import NutritionGoalsModal from '../NutritionGoalsModal';
import { getDvPercent } from '../../lib/constants/dailyValues';
import type { MicronutrientKey } from '../../lib/constants/dailyValues';

interface StatsNutritionProps {
  userId: string;
  mealType: MealTypeFilter;
  dateRange: DateRange;
}

// ── Nutrition color palette ───────────────────────────────────────

const NUTRITION_COLORS = {
  protein: { main: '#0891b2', bg: '#ecfeff' },  // teal-cyan
  carbs:   { main: '#d97706', bg: '#fffbeb' },  // warm amber
  fat:     { main: '#e11d48', bg: '#fff1f2' },  // muted rose
  fiber:   { main: '#16a34a', bg: '#dcfce7' },
  sodium:  { main: '#7c3aed', bg: '#f5f3ff' },
  sugar:   { main: '#db2777', bg: '#fdf2f8' },
};

// ── Nutrient config ──────────────────────────────────────────────

interface NutrientConfig {
  key: StatsNutrient;
  label: string;
  unit: string;
  color: string;
  bg: string;
  // Whether top sources are available (false for fiber/sugar/sodium + all micros)
  hasSources: boolean;
  // 10D: when true, NutrientRow renders without the colored dot (micros)
  hideDot?: boolean;
}

// Neutral slate used for the 10 micros — keeps drill-down trend chart / browse button
// visible (an empty color string would render transparent). Row visual itself hides the
// dot via hideDot, so this color only surfaces in the drill-down panel.
const MICRO_NEUTRAL_COLOR = '#64748b';

const NUTRIENTS: NutrientConfig[] = [
  { key: 'protein', label: 'Protein', unit: 'g', color: NUTRITION_COLORS.protein.main, bg: NUTRITION_COLORS.protein.bg, hasSources: true },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: NUTRITION_COLORS.carbs.main, bg: NUTRITION_COLORS.carbs.bg, hasSources: true },
  { key: 'fat', label: 'Fat', unit: 'g', color: NUTRITION_COLORS.fat.main, bg: NUTRITION_COLORS.fat.bg, hasSources: true },
  { key: 'fiber', label: 'Fiber', unit: 'g', color: NUTRITION_COLORS.fiber.main, bg: NUTRITION_COLORS.fiber.bg, hasSources: false },
  { key: 'sodium', label: 'Sodium', unit: 'mg', color: NUTRITION_COLORS.sodium.main, bg: NUTRITION_COLORS.sodium.bg, hasSources: false },
  { key: 'sugar', label: 'Sugar', unit: 'g', color: NUTRITION_COLORS.sugar.main, bg: NUTRITION_COLORS.sugar.bg, hasSources: false },
  // Phase 10D — micros (Vitamins then Minerals). hideDot, no top-source tracking.
  { key: 'vitamin_a',   label: 'Vitamin A',   unit: 'mcg', color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
  { key: 'vitamin_c',   label: 'Vitamin C',   unit: 'mg',  color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
  { key: 'vitamin_d',   label: 'Vitamin D',   unit: 'mcg', color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
  { key: 'vitamin_b12', label: 'Vitamin B12', unit: 'mcg', color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
  { key: 'folate',      label: 'Folate',      unit: 'mcg', color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
  { key: 'iron',        label: 'Iron',        unit: 'mg',  color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
  { key: 'calcium',     label: 'Calcium',     unit: 'mg',  color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
  { key: 'potassium',   label: 'Potassium',   unit: 'mg',  color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
  { key: 'magnesium',   label: 'Magnesium',   unit: 'mg',  color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
  { key: 'zinc',        label: 'Zinc',        unit: 'mg',  color: MICRO_NEUTRAL_COLOR, bg: '', hasSources: false, hideDot: true },
];

// 10D — maps StatsNutrient micro keys to MicronutrientKey for DV lookup
const MICRO_DV_KEY_MAP: Partial<Record<StatsNutrient, MicronutrientKey>> = {
  vitamin_a: 'vitamin_a_mcg',
  vitamin_c: 'vitamin_c_mg',
  vitamin_d: 'vitamin_d_mcg',
  vitamin_b12: 'vitamin_b12_mcg',
  folate: 'folate_mcg',
  iron: 'iron_mg',
  calcium: 'calcium_mg',
  potassium: 'potassium_mg',
  magnesium: 'magnesium_mg',
  zinc: 'zinc_mg',
};

const VITAMIN_KEYS: StatsNutrient[] = ['vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_b12', 'folate'];
const MINERAL_KEYS: StatsNutrient[] = ['iron', 'calcium', 'potassium', 'magnesium', 'zinc'];

// Only P/C/F for the donut ring
const MACRO_NUTRIENTS = NUTRIENTS.slice(0, 3);

export default function StatsNutrition({ userId, mealType, dateRange }: StatsNutritionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [averages, setAverages] = useState<NutritionAverages | null>(null);
  const [dietary, setDietary] = useState<DietaryBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNutrient, setExpandedNutrient] = useState<StatsNutrient | null>(null);
  const [goals, setGoals] = useState<NutritionGoal[]>([]);
  const [goalsModalVisible, setGoalsModalVisible] = useState(false);
  const [nutritionPeriod, setNutritionPeriod] = useState<'daily' | 'per_meal'>('daily');

  const params: StatsParams = useMemo(
    () => ({ userId, dateRange, mealType }),
    [userId, dateRange, mealType]
  );

  const loadGoals = async () => {
    if (!userId) return;
    const g = await getNutritionGoals(userId);
    setGoals(g);
  };

  useEffect(() => { loadGoals(); }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId, dateRange.start, dateRange.end, mealType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [avg, diet] = await Promise.all([
        getNutritionAverages(params),
        getDietaryBreakdown(params),
      ]);
      setAverages(avg);
      setDietary(diet);
    } catch (err) {
      console.error('Error loading nutrition:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNutrientPress = (key: StatsNutrient) => {
    setExpandedNutrient(prev => (prev === key ? null : key));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Macro Ring + Nutrient List */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nutrition Averages</Text>

        {averages && (
          <>
            {/* Donut ring + calorie center */}
            <View style={styles.ringContainer}>
              <MacroRing
                protein={averages.protein}
                carbs={averages.carbs}
                fat={averages.fat}
                colors={colors}
              />
              <View style={styles.ringCenter}>
                <Text style={styles.ringCalValue}>{averages.calories}</Text>
                <Text style={styles.ringCalLabel}>cal avg</Text>
              </View>
            </View>

            {/* Macro summary cards */}
            <View style={styles.macroRow}>
              <MacroCard
                color={NUTRITION_COLORS.protein}
                value={averages.protein}
                unit="g"
                label="Protein"
              />
              <MacroCard
                color={NUTRITION_COLORS.carbs}
                value={averages.carbs}
                unit="g"
                label="Carbs"
              />
              <MacroCard
                color={NUTRITION_COLORS.fat}
                value={averages.fat}
                unit="g"
                label="Fat"
              />
            </View>

            {/* Macro nutrient rows (Protein, Carbs, Fat) */}
            {NUTRIENTS.slice(0, 3).map((n) => {
              const value = averages[n.key as keyof NutritionAverages];
              return (
                <React.Fragment key={n.key}>
                  <NutrientRow
                    name={n.label}
                    dotColor={n.color}
                    value={`${value}${n.unit}`}
                    onPress={() => handleNutrientPress(n.key)}
                  />
                  {expandedNutrient === n.key && (
                    <NutrientDrillDown
                      nutrientConfig={n}
                      params={params}
                      colors={colors}
                      styles={styles}
                      onClose={() => setExpandedNutrient(null)}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {/* Divider between macro and secondary nutrients */}
            <View style={[styles.nutrientDivider, { backgroundColor: colors.border.light }]} />

            {/* Secondary nutrient rows (Fiber, Sodium, Sugar) */}
            {NUTRIENTS.slice(3, 6).map((n) => {
              const value = averages[n.key as keyof NutritionAverages];
              return (
                <React.Fragment key={n.key}>
                  <NutrientRow
                    name={n.label}
                    dotColor={n.color}
                    value={`${value}${n.unit}`}
                    onPress={() => handleNutrientPress(n.key)}
                  />
                  {expandedNutrient === n.key && (
                    <NutrientDrillDown
                      nutrientConfig={n}
                      params={params}
                      colors={colors}
                      styles={styles}
                      onClose={() => setExpandedNutrient(null)}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}
      </View>

      {/* Period selector — shared by Goals + Micronutrients (lifted out of GoalsSection in 10D) */}
      <View style={styles.nutritionPeriodToggleContainer}>
        <View style={styles.goalsModeToggle}>
          <TouchableOpacity
            style={[styles.goalsModeBtn, nutritionPeriod === 'daily' && styles.goalsModeBtnActive]}
            onPress={() => setNutritionPeriod('daily')}
          >
            <Text style={[styles.goalsModeBtnText, nutritionPeriod === 'daily' && styles.goalsModeBtnTextActive]}>Per Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.goalsModeBtn, nutritionPeriod === 'per_meal' && styles.goalsModeBtnActive]}
            onPress={() => setNutritionPeriod('per_meal')}
          >
            <Text style={[styles.goalsModeBtnText, nutritionPeriod === 'per_meal' && styles.goalsModeBtnTextActive]}>Per Meal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Your Goals */}
      <GoalsSection
        goals={goals}
        averages={averages}
        period={nutritionPeriod}
        onEditPress={() => setGoalsModalVisible(true)}
        colors={colors}
        styles={styles}
      />

      {/* How You Eat */}
      {dietary && <DietarySection dietary={dietary} colors={colors} styles={styles} />}

      {/* Micronutrients (10D — replaced placeholder card) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Micronutrients</Text>

        {averages && (
          <>
            {/* Vitamins subsection */}
            <Text style={styles.microsSubsectionLabel}>Vitamins</Text>
            {NUTRIENTS.filter(n => VITAMIN_KEYS.includes(n.key)).map(n => {
              const perMealValue = (averages[n.key as keyof NutritionAverages] as number) ?? 0;
              const displayValue = nutritionPeriod === 'daily'
                ? Math.round(perMealValue * MEALS_PER_DAY * 10) / 10
                : perMealValue;
              const dvKey = MICRO_DV_KEY_MAP[n.key];
              const dvPercent = dvKey ? getDvPercent(displayValue, dvKey) : 0;
              return (
                <React.Fragment key={n.key}>
                  <NutrientRow
                    name={n.label}
                    dotColor=""
                    hideDot
                    value={`${displayValue}${n.unit}`}
                    dvSuffix={`${dvPercent}% DV`}
                    onPress={() => handleNutrientPress(n.key)}
                  />
                  {expandedNutrient === n.key && (
                    <NutrientDrillDown
                      nutrientConfig={n}
                      params={params}
                      colors={colors}
                      styles={styles}
                      onClose={() => setExpandedNutrient(null)}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {/* Minerals subsection */}
            <Text style={styles.microsSubsectionLabel}>Minerals</Text>
            {NUTRIENTS.filter(n => MINERAL_KEYS.includes(n.key)).map(n => {
              const perMealValue = (averages[n.key as keyof NutritionAverages] as number) ?? 0;
              const displayValue = nutritionPeriod === 'daily'
                ? Math.round(perMealValue * MEALS_PER_DAY * 10) / 10
                : perMealValue;
              const dvKey = MICRO_DV_KEY_MAP[n.key];
              const dvPercent = dvKey ? getDvPercent(displayValue, dvKey) : 0;
              return (
                <React.Fragment key={n.key}>
                  <NutrientRow
                    name={n.label}
                    dotColor=""
                    hideDot
                    value={`${displayValue}${n.unit}`}
                    dvSuffix={`${dvPercent}% DV`}
                    onPress={() => handleNutrientPress(n.key)}
                  />
                  {expandedNutrient === n.key && (
                    <NutrientDrillDown
                      nutrientConfig={n}
                      params={params}
                      colors={colors}
                      styles={styles}
                      onClose={() => setExpandedNutrient(null)}
                    />
                  )}
                </React.Fragment>
              );
            })}

            <Text style={styles.microsDisclaimer}>
              Estimates based on USDA data and ingredient matching. Directional, not for medical use.
            </Text>
          </>
        )}
      </View>

      <View style={styles.bottomPadding} />

      <NutritionGoalsModal
        visible={goalsModalVisible}
        userId={userId}
        onClose={() => setGoalsModalVisible(false)}
        onSaved={() => { loadGoals(); setGoalsModalVisible(false); }}
      />
    </View>
  );
}

// ── Macro Card ───────────────────────────────────────────────────

function MacroCard({
  color, value, unit, label,
}: {
  color: { main: string; bg: string };
  value: number;
  unit: string;
  label: string;
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: color.bg,
      borderRadius: 10,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{
          fontSize: 17,
          fontWeight: typography.weights.bold as any,
          color: color.main,
        }}>
          {value != null && value > 0 ? Math.round(value) : '—'}
        </Text>
        <Text style={{ fontSize: 9, color: color.main, marginLeft: 1 }}>{unit}</Text>
      </View>
      <Text style={{ fontSize: 10, color: color.main, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

// ── Macro Ring (SVG donut) ───────────────────────────────────────

function MacroRing({
  protein, carbs, fat, colors,
}: {
  protein: number; carbs: number; fat: number; colors: any;
}) {
  const size = 160;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const total = protein + carbs + fat;
  if (total === 0) {
    return (
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border.light}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>
    );
  }

  const proteinPct = protein / total;
  const carbsPct = carbs / total;
  const fatPct = fat / total;

  // Each segment: offset from previous end, dasharray = segment + remainder
  // Rotation starts at top (-90 degrees via transform or strokeDashoffset)
  const segments = [
    { pct: proteinPct, color: MACRO_NUTRIENTS[0].color },
    { pct: carbsPct, color: MACRO_NUTRIENTS[1].color },
    { pct: fatPct, color: MACRO_NUTRIENTS[2].color },
  ];

  let cumulativeOffset = 0;

  return (
    <Svg width={size} height={size}>
      {/* Background track */}
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={colors.border.light}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Segments */}
      {segments.map((seg, i) => {
        const segmentLength = seg.pct * circumference;
        // Gap of 2px between segments for visual separation
        const gap = 2;
        const dashLength = Math.max(segmentLength - gap, 0);
        const dashArray = `${dashLength} ${circumference - dashLength}`;
        // Offset: start at top (-90deg = circumference/4), then advance by cumulative
        const dashOffset = circumference * 0.25 - cumulativeOffset;
        cumulativeOffset += segmentLength;

        return (
          <Circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            stroke={seg.color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
          />
        );
      })}
    </Svg>
  );
}

// ── Nutrient Drill-Down Panel ────────────────────────────────────

function NutrientDrillDown({
  nutrientConfig, params, colors, styles, onClose,
}: {
  nutrientConfig: NutrientConfig;
  params: StatsParams;
  colors: any;
  styles: any;
  onClose: () => void;
}) {
  const [trend, setTrend] = useState<NutrientTrendPoint[]>([]);
  const [sources, setSources] = useState<NutrientSourceItem[]>([]);
  const [topRecipes, setTopRecipes] = useState<HighNutrientRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDrillDown();
  }, []);

  const loadDrillDown = async () => {
    setLoading(true);
    try {
      const [t, s, r] = await Promise.all([
        getNutrientTrend(params, nutrientConfig.key),
        nutrientConfig.hasSources
          ? getTopNutrientSources(params, nutrientConfig.key, 5)
          : Promise.resolve([]),
        getHighestNutrientRecipes(params, nutrientConfig.key, 5),
      ]);
      setTrend(t);
      setSources(s);
      setTopRecipes(r);
    } catch (err) {
      console.error(`Error loading ${nutrientConfig.key} drill-down:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DrillDownPanel title={`${nutrientConfig.label} Details`} onClose={onClose}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {/* Trend chart */}
          {trend.length >= 2 && (
            <View>
              <Text style={styles.drillDownSectionTitle}>Weekly Trend</Text>
              <NutrientTrendChart data={trend} color={nutrientConfig.color} colors={colors} />
            </View>
          )}

          {/* Top sources */}
          <View>
            <Text style={styles.drillDownSectionTitle}>Top Sources</Text>
            {!nutrientConfig.hasSources ? (
              <Text style={styles.comingSoonSmall}>
                Source tracking coming soon for {nutrientConfig.label.toLowerCase()}
              </Text>
            ) : sources.length === 0 ? (
              <Text style={styles.emptyText}>No source data yet</Text>
            ) : (
              sources.map((s) => (
                <View key={s.source} style={styles.sourceRow}>
                  <Text style={styles.sourceName} numberOfLines={1}>{s.source}</Text>
                  <Text style={styles.sourcePct}>{s.pct}%</Text>
                </View>
              ))
            )}
          </View>

          {/* Highest recipes */}
          {topRecipes.length > 0 && (
            <View>
              <Text style={styles.drillDownSectionTitle}>Highest {nutrientConfig.label} Recipes</Text>
              {topRecipes.map((r, i) => (
                <MiniBarRow
                  key={r.recipeId}
                  rank={i + 1}
                  name={r.title}
                  count={r.value}
                  barPct={topRecipes[0].value > 0 ? Math.round((r.value / topRecipes[0].value) * 100) : 0}
                />
              ))}
            </View>
          )}

          {/* Browse CTA */}
          <TouchableOpacity
            style={[styles.browseButton, { borderColor: nutrientConfig.color }]}
            onPress={() => console.log(`Browse high-${nutrientConfig.key} recipes tapped`)}
            activeOpacity={0.7}
          >
            <Text style={[styles.browseButtonText, { color: nutrientConfig.color }]}>
              Browse high-{nutrientConfig.label.toLowerCase()} recipes
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </DrillDownPanel>
  );
}

// ── Nutrient Trend Mini Chart (SVG) ──────────────────────────────

function NutrientTrendChart({
  data, color, colors,
}: {
  data: NutrientTrendPoint[]; color: string; colors: any;
}) {
  const chartWidth = 280;
  const chartHeight = 80;
  const padL = 4;
  const padR = 4;
  const padT = 4;
  const padB = 4;
  const plotW = chartWidth - padL - padR;
  const plotH = chartHeight - padT - padB;

  const maxVal = Math.max(...data.map(d => d.value), 1);

  const points = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * plotW,
    y: padT + plotH - (d.value / maxVal) * plotH,
  }));

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }

  const fillD = pathD
    + ` L ${points[points.length - 1].x} ${padT + plotH}`
    + ` L ${points[0].x} ${padT + plotH} Z`;

  return (
    <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
      <Path d={fillD} fill={color} opacity={0.1} />
      <Path d={pathD} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Goals Section ────────────────────────────────────────────────

const MEALS_PER_DAY = 2.5;

const NUTRIENT_AVERAGES_MAP: Record<string, keyof NutritionAverages> = {
  calories: 'calories', protein: 'protein', carbs: 'carbs',
  fat: 'fat', fiber: 'fiber', sodium: 'sodium',
  // Phase 10D — kept consistent for future goal-setting on micros (NutritionGoalsModal extension deferred)
  vitamin_a: 'vitamin_a', vitamin_c: 'vitamin_c', vitamin_d: 'vitamin_d',
  vitamin_b12: 'vitamin_b12', folate: 'folate',
  iron: 'iron', calcium: 'calcium', potassium: 'potassium',
  magnesium: 'magnesium', zinc: 'zinc',
};

type GoalStatus = 'on_track' | 'over' | 'under' | 'not_set';

function GoalsSection({
  goals, averages, period, onEditPress, colors, styles,
}: {
  goals: NutritionGoal[];
  averages: NutritionAverages | null;
  period: 'daily' | 'per_meal';
  onEditPress: () => void;
  colors: any; styles: any;
}) {
  if (goals.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Your Goals</Text>
          <TouchableOpacity onPress={onEditPress} activeOpacity={0.7}>
            <Text style={styles.editGoalsText}>Edit goals</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.goalsEmptyContainer}>
          <Text style={styles.goalsEmptyEmoji}>🎯</Text>
          <Text style={styles.goalsEmptyTitle}>Set your nutrition goals</Text>
          <Text style={styles.goalsEmptySubtext}>
            Track calories, protein, and more to see how your cooking aligns with your goals
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Your Goals</Text>
        <TouchableOpacity onPress={onEditPress} activeOpacity={0.7}>
          <Text style={styles.editGoalsText}>Edit goals</Text>
        </TouchableOpacity>
      </View>

      {/* Per Day / Per Meal toggle lifted out in 10D — now shared with Micronutrients above */}

      {goals.map(goal => {
        const avgKey = NUTRIENT_AVERAGES_MAP[goal.nutrient];
        const actualPerMeal = averages && avgKey ? (averages[avgKey] as number) : 0;

        const actualDisplay = period === 'daily'
          ? Math.round(actualPerMeal * MEALS_PER_DAY)
          : Math.round(actualPerMeal);
        const targetDisplay = period === 'daily'
          ? goal.goalValue
          : Math.round(goal.goalValue / MEALS_PER_DAY);

        const pct = targetDisplay > 0 ? Math.round((actualDisplay / targetDisplay) * 100) : 0;

        const status: GoalStatus = pct > 105 ? 'over' : pct >= 80 ? 'on_track' : 'under';
        const statusText = pct > 105 ? 'slightly over'
          : pct >= 80 ? 'on track'
          : pct >= 40 ? 'getting there'
          : 'room to grow';
        const statusColor = pct > 100 ? '#f59e0b' : pct >= 80 ? '#22c55e' : pct >= 40 ? colors.primary : colors.text.tertiary;

        const label = `${goal.nutrient.charAt(0).toUpperCase() + goal.nutrient.slice(1)} (${goal.goalUnit})`;

        return (
          <View key={goal.nutrient}>
            <GoalRow
              label={label}
              current={actualDisplay}
              goal={targetDisplay}
              status={status}
            />
            <Text style={[styles.goalStatusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Dietary Section (How You Eat) ────────────────────────────────

interface DietaryTileConfig {
  key: keyof DietaryBreakdown;
  label: string;
  emoji: string;
}

const DIETARY_TILES: DietaryTileConfig[] = [
  { key: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
  { key: 'vegan', label: 'Vegan', emoji: '🌱' },
  { key: 'glutenFree', label: 'Gluten Free', emoji: '🌾' },
  { key: 'dairyFree', label: 'Dairy Free', emoji: '🥛' },
];

function DietarySection({
  dietary, colors, styles,
}: {
  dietary: DietaryBreakdown; colors: any; styles: any;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>How You Eat</Text>
      <View style={styles.dietaryGrid}>
        {DIETARY_TILES.map((tile) => {
          const pct = dietary[tile.key];
          return (
            <TouchableOpacity
              key={tile.key}
              style={styles.dietaryTile}
              onPress={() => console.log(`Dietary tile tapped: ${tile.key}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.dietaryEmoji}>{tile.emoji}</Text>
              <Text style={styles.dietaryPct}>{pct}%</Text>
              <Text style={styles.dietaryLabel}>{tile.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    cardTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    // Ring
    ringContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.md,
      position: 'relative',
    },
    ringCenter: {
      position: 'absolute',
      alignItems: 'center',
    },
    ringCalValue: {
      fontSize: typography.sizes.xxl,
      fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
    },
    ringCalLabel: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
    },
    macroRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    nutrientDivider: {
      height: 1,
      marginVertical: spacing.xs,
    },
    // Drill-down
    drillDownSectionTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    sourceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs + 2,
    },
    sourceName: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
      flex: 1,
      marginRight: spacing.sm,
    },
    sourcePct: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.secondary,
    },
    browseButton: {
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    browseButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
    comingSoonSmall: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      fontStyle: 'italic',
      paddingVertical: spacing.sm,
    },
    // Goals empty state
    editGoalsText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.primary,
    },
    goalsEmptyContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    goalsEmptyEmoji: {
      fontSize: 32,
      marginBottom: spacing.sm,
    },
    goalsEmptyTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    goalsEmptySubtext: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
      lineHeight: 20,
    },
    // Goals toggle + status
    goalsModeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      padding: 3,
      marginBottom: spacing.sm,
    },
    goalsModeBtn: {
      flex: 1,
      paddingVertical: spacing.xs + 2,
      alignItems: 'center',
      borderRadius: borderRadius.md - 2,
    },
    goalsModeBtnActive: {
      backgroundColor: colors.background.card,
    },
    goalsModeBtnText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium as any,
      color: colors.text.tertiary,
    },
    goalsModeBtnTextActive: {
      color: colors.text.primary,
      fontWeight: typography.weights.semibold as any,
    },
    goalStatusText: {
      fontSize: typography.sizes.xs,
      marginTop: -spacing.xs,
      marginBottom: spacing.xs,
      paddingLeft: spacing.xs,
    },
    // Dietary tiles
    dietaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    dietaryTile: {
      width: '47%' as any,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.xs,
    },
    dietaryEmoji: {
      fontSize: 24,
    },
    dietaryPct: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
    },
    dietaryLabel: {
      fontSize: typography.sizes.xs,
      color: colors.text.secondary,
    },
    // 10D — Lifted period toggle container (renders above Goals + Micronutrients)
    nutritionPeriodToggleContainer: {
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    // 10D — Micronutrients section
    microsSubsectionLabel: {
      fontSize: 11,
      color: colors.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    microsDisclaimer: {
      fontSize: 11,
      color: colors.text.tertiary,
      fontStyle: 'italic',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 0.5,
      borderTopColor: colors.border.light,
      lineHeight: 16,
    },
    // Micronutrients placeholder (10C: still referenced if needed; left as-is to minimize touch)
    comingSoonContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    comingSoonEmoji: {
      fontSize: 32,
      marginBottom: spacing.sm,
    },
    comingSoonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    comingSoonSubtext: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
    bottomPadding: {
      height: 40,
    },
  });
}
