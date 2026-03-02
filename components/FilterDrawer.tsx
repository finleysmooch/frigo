// components/FilterDrawer.tsx
// Updated: February 2026
// Phase 3A Block 7: New FilterState — Dietary, Hero Ingredient, Vibe, Nutrition sections

import React, { ComponentType, useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../lib/theme/ThemeContext';
import { VIBE_TAG_ICONS } from '../constants/vibeIcons';
import {
  SproutIcon, VegetablesIcon, GlutenFreeIcon, DairyFreeIcon,
  NutFreeIcon, ShellfishFreeIcon, SoyFreeIcon, EggFreeIcon,
  FireIcon, OvenIcon, GrillIcon, SlowCookerIcon, PotIcon, AirFryerIcon,
  WarmIcon, ThermometerIcon, ColdIcon,
} from '../components/icons';

export interface FilterState {
  dietaryFlags: {
    is_vegan?: boolean;
    is_vegetarian?: boolean;
    is_gluten_free?: boolean;
    is_dairy_free?: boolean;
    is_nut_free?: boolean;
    is_shellfish_free?: boolean;
    is_soy_free?: boolean;
    is_egg_free?: boolean;
  };
  heroIngredients: string[];
  vibeTags: string[];
  maxCaloriesPerServing?: number;
  minProteinPerServing?: number;
  maxActiveTime?: number;
  maxTotalTime?: number;
  difficultyLevels: string[];
  easierThanLooks: boolean;
  cookingMethods: string[];
  cuisineTypes: string[];
  courseTypes: string[];
  ingredientCountRanges: string[];
  makeAheadFriendly: boolean;
  servingTemp: string[];
  recentlySaved: boolean;
  recentlyCookedByFriends: boolean;
}

export interface FilterDrawerProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (filters: FilterState) => void;
  availableHeroIngredients?: string[];
}

const EMPTY_FILTERS: FilterState = {
  dietaryFlags: {},
  heroIngredients: [],
  vibeTags: [],
  maxCaloriesPerServing: undefined,
  minProteinPerServing: undefined,
  maxActiveTime: undefined,
  maxTotalTime: undefined,
  difficultyLevels: [],
  easierThanLooks: false,
  cookingMethods: [],
  cuisineTypes: [],
  courseTypes: [],
  ingredientCountRanges: [],
  makeAheadFriendly: false,
  servingTemp: [],
  recentlySaved: false,
  recentlyCookedByFriends: false,
};

const DIETARY_FLAGS: { key: keyof FilterState['dietaryFlags']; label: string; icon: string; IconComponent: ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'is_vegan',         label: 'Vegan',       icon: '🌱', IconComponent: SproutIcon },
  { key: 'is_vegetarian',    label: 'Vegetarian',  icon: '🥦', IconComponent: VegetablesIcon },
  { key: 'is_gluten_free',   label: 'GF',          icon: '🌾', IconComponent: GlutenFreeIcon },
  { key: 'is_dairy_free',    label: 'Dairy-Free',  icon: '🥛', IconComponent: DairyFreeIcon },
  { key: 'is_nut_free',      label: 'Nut-Free',    icon: '🥜', IconComponent: NutFreeIcon },
  { key: 'is_shellfish_free',label: 'No Shellfish',icon: '🦐', IconComponent: ShellfishFreeIcon },
  { key: 'is_soy_free',      label: 'Soy-Free',    icon: '🫘', IconComponent: SoyFreeIcon },
  { key: 'is_egg_free',      label: 'Egg-Free',    icon: '🥚', IconComponent: EggFreeIcon },
];

const VIBE_TAGS = [
  'comfort', 'fresh & light', 'impressive', 'quick',
  'meal prep', 'budget', 'crowd pleaser', 'adventurous',
  'one pot', 'project',
];

const COOKING_METHODS: { id: string; label: string; icon: string; IconComponent: ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'stovetop',    label: 'Stovetop',    icon: '🔥', IconComponent: FireIcon },
  { id: 'oven',        label: 'Oven',        icon: '🫙', IconComponent: OvenIcon },
  { id: 'grill',       label: 'Grill',       icon: '🍖', IconComponent: GrillIcon },
  { id: 'slow_cooker', label: 'Slow Cooker', icon: '🥘', IconComponent: SlowCookerIcon },
  { id: 'instant_pot', label: 'Instant Pot', icon: '⚡', IconComponent: PotIcon },
  { id: 'air_fryer',   label: 'Air Fryer',   icon: '💨', IconComponent: AirFryerIcon },
];

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'advanced'];
const INGREDIENT_RANGES = ['1–5', '6–10', '11–15', '16+'];
const CUISINE_TYPES = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai',
  'Indian', 'Mediterranean', 'American', 'French', 'Middle Eastern',
];
const COURSE_TYPES = [
  'main', 'side', 'appetizer', 'dessert', 'snack', 'condiment', 'breakfast',
];
const SERVING_TEMPS: { id: string; label: string; icon: string; IconComponent: ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'hot',       label: 'Hot',       icon: '🔥', IconComponent: FireIcon },
  { id: 'warm',      label: 'Warm',      icon: '☀️', IconComponent: WarmIcon },
  { id: 'room_temp', label: 'Room Temp', icon: '🌡️', IconComponent: ThermometerIcon },
  { id: 'cold',      label: 'Cold',      icon: '❄️', IconComponent: ColdIcon },
];

export default function FilterDrawer({
  visible,
  onClose,
  filters,
  onApplyFilters,
  availableHeroIngredients = [],
}: FilterDrawerProps) {
  const { colors } = useTheme();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [heroInput, setHeroInput] = useState('');
  const [localFilters, setLocalFilters] = useState<FilterState>(EMPTY_FILTERS);

  useEffect(() => {
    if (visible) {
      setLocalFilters({ ...EMPTY_FILTERS, ...filters, dietaryFlags: { ...filters?.dietaryFlags } });
      setHeroInput('');
    }
  }, [visible]);

  const handleApply = () => onApplyFilters(localFilters);

  const handleReset = () => {
    setLocalFilters(EMPTY_FILTERS);
    setHeroInput('');
  };

  // Dietary flag toggle
  const toggleDietary = (key: keyof FilterState['dietaryFlags']) => {
    setLocalFilters(prev => ({
      ...prev,
      dietaryFlags: {
        ...prev.dietaryFlags,
        [key]: prev.dietaryFlags[key] ? undefined : true,
      },
    }));
  };

  // Generic string-array toggle
  const toggleInArray = (field: keyof FilterState, value: string) => {
    setLocalFilters(prev => {
      const arr = (prev[field] as string[]) ?? [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  };

  // Hero ingredient: add from text input
  const addHeroFromInput = () => {
    const trimmed = heroInput.trim().toLowerCase();
    if (trimmed && !localFilters.heroIngredients.includes(trimmed)) {
      setLocalFilters(prev => ({ ...prev, heroIngredients: [...prev.heroIngredients, trimmed] }));
    }
    setHeroInput('');
  };

  // Active filter count for header badge
  const activeCount = useMemo(() => {
    let n = 0;
    n += Object.values(localFilters.dietaryFlags).filter(Boolean).length;
    n += localFilters.heroIngredients.length;
    n += localFilters.vibeTags.length;
    if (localFilters.maxCaloriesPerServing != null) n++;
    if (localFilters.minProteinPerServing != null) n++;
    if (localFilters.maxActiveTime != null) n++;
    if (localFilters.maxTotalTime != null) n++;
    n += localFilters.difficultyLevels.length;
    if (localFilters.easierThanLooks) n++;
    n += localFilters.cookingMethods.length;
    n += localFilters.cuisineTypes.length;
    n += localFilters.courseTypes.length;
    n += localFilters.ingredientCountRanges.length;
    if (localFilters.makeAheadFriendly) n++;
    n += localFilters.servingTemp.length;
    if (localFilters.recentlySaved) n++;
    if (localFilters.recentlyCookedByFriends) n++;
    return n;
  }, [localFilters]);

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    drawer: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '92%',
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border.medium,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text.primary,
    },
    headerBadge: {
      fontSize: 12,
      color: colors.text.tertiary,
      fontWeight: '400',
    },
    resetText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    closeBtn: {
      fontSize: 20,
      color: colors.text.secondary,
      paddingHorizontal: 4,
    },
    content: {
      paddingBottom: 8,
    },

    // ── Section ───────────────────────────────────────────────────
    section: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 4,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.light,
      marginHorizontal: 18,
      marginTop: 14,
    },

    // ── Chip grid ─────────────────────────────────────────────────
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      borderWidth: 1,
      borderColor: colors.border.light,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 20,
      gap: 4,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipIcon: {
      fontSize: 13,
    },
    chipLabel: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    chipLabelActive: {
      color: '#ffffff',
      fontWeight: '600',
    },

    // ── Hero ingredient input ─────────────────────────────────────
    heroInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    heroInput: {
      flex: 1,
      backgroundColor: colors.background.card,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.text.primary,
    },
    heroAddBtn: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    heroAddBtnText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '600',
    },

    // ── Sliders ───────────────────────────────────────────────────
    sliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    sliderLabel: {
      fontSize: 13,
      color: colors.text.secondary,
      width: 56,
    },
    sliderValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      width: 52,
      textAlign: 'right',
    },
    slider: {
      flex: 1,
      height: 36,
    },

    // ── Switch rows ───────────────────────────────────────────────
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    switchLabel: {
      fontSize: 14,
      color: colors.text.primary,
    },

    // ── Advanced toggle ───────────────────────────────────────────
    advancedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    advancedToggleText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    advancedToggleIcon: {
      fontSize: 12,
      color: colors.primary,
    },

    // ── Footer ────────────────────────────────────────────────────
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.background.card,
    },
    applyButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    applyButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
  }), [colors]);

  // ── Reusable chip renderer ──────────────────────────────────────
  const renderChip = (
    id: string,
    label: string,
    icon: string | null,
    isActive: boolean,
    onPress: () => void,
    IconComponent?: ComponentType<{ size?: number; color?: string }>,
  ) => (
    <TouchableOpacity
      key={id}
      style={[styles.chip, isActive && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {IconComponent
        ? <IconComponent size={13} color={isActive ? '#ffffff' : undefined} />
        : icon ? <Text style={styles.chipIcon}>{icon}</Text> : null}
      <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.drawer}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              Filter Recipes{activeCount > 0 ? (
                <Text style={styles.headerBadge}> · {activeCount} active</Text>
              ) : null}
            </Text>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

            {/* ── Dietary ──────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dietary</Text>
              <View style={styles.chipRow}>
                {DIETARY_FLAGS.map(flag =>
                  renderChip(
                    flag.key,
                    flag.label,
                    null,
                    !!localFilters.dietaryFlags[flag.key],
                    () => toggleDietary(flag.key),
                    flag.IconComponent,
                  )
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Hero Ingredient ───────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hero Ingredient</Text>
              <View style={styles.heroInputRow}>
                <TextInput
                  style={styles.heroInput}
                  placeholder="e.g. lemon, miso, chicken..."
                  placeholderTextColor={colors.text.tertiary}
                  value={heroInput}
                  onChangeText={setHeroInput}
                  onSubmitEditing={addHeroFromInput}
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {heroInput.trim().length > 0 && (
                  <TouchableOpacity style={styles.heroAddBtn} onPress={addHeroFromInput}>
                    <Text style={styles.heroAddBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
              {/* Suggested chips from recipe library */}
              {availableHeroIngredients.length > 0 && (
                <View style={styles.chipRow}>
                  {availableHeroIngredients.slice(0, 20).map(h =>
                    renderChip(
                      h,
                      h,
                      null,
                      localFilters.heroIngredients.includes(h),
                      () => toggleInArray('heroIngredients', h),
                    )
                  )}
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* ── Vibe ─────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vibe</Text>
              <View style={styles.chipRow}>
                {VIBE_TAGS.map(tag =>
                  renderChip(
                    tag,
                    tag.charAt(0).toUpperCase() + tag.slice(1),
                    null,
                    localFilters.vibeTags.includes(tag),
                    () => toggleInArray('vibeTags', tag),
                    VIBE_TAG_ICONS[tag],
                  )
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Nutrition ─────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nutrition</Text>
              {/* Calorie max */}
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Cal max</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1000}
                  step={50}
                  value={localFilters.maxCaloriesPerServing ?? 1000}
                  onValueChange={v => setLocalFilters(prev => ({
                    ...prev,
                    maxCaloriesPerServing: v === 1000 ? undefined : v,
                  }))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
                <Text style={styles.sliderValue}>
                  {localFilters.maxCaloriesPerServing != null
                    ? `≤${localFilters.maxCaloriesPerServing}`
                    : 'Any'}
                </Text>
              </View>
              {/* Protein min */}
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Protein min</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={60}
                  step={5}
                  value={localFilters.minProteinPerServing ?? 0}
                  onValueChange={v => setLocalFilters(prev => ({
                    ...prev,
                    minProteinPerServing: v === 0 ? undefined : v,
                  }))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
                <Text style={styles.sliderValue}>
                  {localFilters.minProteinPerServing != null
                    ? `${localFilters.minProteinPerServing}g+`
                    : 'Any'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Time ─────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Time</Text>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Active</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={120}
                  step={5}
                  value={localFilters.maxActiveTime ?? 120}
                  onValueChange={v => setLocalFilters(prev => ({
                    ...prev,
                    maxActiveTime: v === 120 ? undefined : v,
                  }))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
                <Text style={styles.sliderValue}>
                  {localFilters.maxActiveTime != null ? `≤${localFilters.maxActiveTime}m` : 'Any'}
                </Text>
              </View>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Total</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={240}
                  step={15}
                  value={localFilters.maxTotalTime ?? 240}
                  onValueChange={v => setLocalFilters(prev => ({
                    ...prev,
                    maxTotalTime: v === 240 ? undefined : v,
                  }))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
                <Text style={styles.sliderValue}>
                  {localFilters.maxTotalTime != null ? `≤${localFilters.maxTotalTime}m` : 'Any'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Difficulty ───────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Difficulty</Text>
              <View style={styles.chipRow}>
                {DIFFICULTY_OPTIONS.map(d =>
                  renderChip(
                    d,
                    d.charAt(0).toUpperCase() + d.slice(1),
                    null,
                    localFilters.difficultyLevels.includes(d),
                    () => toggleInArray('difficultyLevels', d),
                  )
                )}
              </View>
              <View style={[styles.switchRow, { marginTop: 10 }]}>
                <Text style={styles.switchLabel}>✨ Easier than it looks</Text>
                <Switch
                  value={localFilters.easierThanLooks}
                  onValueChange={v => setLocalFilters(prev => ({ ...prev, easierThanLooks: v }))}
                  trackColor={{ false: colors.border.medium, true: colors.primary + '50' }}
                  thumbColor={localFilters.easierThanLooks ? colors.primary : colors.background.secondary}
                />
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Cooking Method ───────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cooking Method</Text>
              <View style={styles.chipRow}>
                {COOKING_METHODS.map(m =>
                  renderChip(
                    m.id,
                    m.label,
                    null,
                    localFilters.cookingMethods.includes(m.id),
                    () => toggleInArray('cookingMethods', m.id),
                    m.IconComponent,
                  )
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Advanced (collapsed) ─────────────────────────────── */}
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
              activeOpacity={0.7}
            >
              <Text style={styles.advancedToggleText}>
                Advanced {showAdvanced ? '▾' : '›'}
              </Text>
              {!showAdvanced && (
                <Text style={styles.advancedToggleIcon}>Cuisine, Course, Serving Temp…</Text>
              )}
            </TouchableOpacity>

            {showAdvanced && (
              <>
                {/* Cuisine */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Cuisine</Text>
                  <View style={styles.chipRow}>
                    {CUISINE_TYPES.map(c =>
                      renderChip(
                        c, c, null,
                        localFilters.cuisineTypes.includes(c),
                        () => toggleInArray('cuisineTypes', c),
                      )
                    )}
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Course */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Course Type</Text>
                  <View style={styles.chipRow}>
                    {COURSE_TYPES.map(c =>
                      renderChip(
                        c,
                        c.charAt(0).toUpperCase() + c.slice(1),
                        null,
                        localFilters.courseTypes.includes(c),
                        () => toggleInArray('courseTypes', c),
                      )
                    )}
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Ingredient count */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ingredient Count</Text>
                  <View style={styles.chipRow}>
                    {INGREDIENT_RANGES.map(r =>
                      renderChip(
                        r, r, null,
                        localFilters.ingredientCountRanges.includes(r),
                        () => toggleInArray('ingredientCountRanges', r),
                      )
                    )}
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Make-ahead + Serving temp */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>More Options</Text>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>⏰ Make-ahead friendly</Text>
                    <Switch
                      value={localFilters.makeAheadFriendly}
                      onValueChange={v => setLocalFilters(prev => ({ ...prev, makeAheadFriendly: v }))}
                      trackColor={{ false: colors.border.medium, true: colors.primary + '50' }}
                      thumbColor={localFilters.makeAheadFriendly ? colors.primary : colors.background.secondary}
                    />
                  </View>

                  <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Serving Temp</Text>
                  <View style={styles.chipRow}>
                    {SERVING_TEMPS.map(t =>
                      renderChip(
                        t.id, t.label, null,
                        localFilters.servingTemp.includes(t.id),
                        () => toggleInArray('servingTemp', t.id),
                        t.IconComponent,
                      )
                    )}
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Social */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Social</Text>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>📌 Recently saved by me</Text>
                    <Switch
                      value={localFilters.recentlySaved}
                      onValueChange={v => setLocalFilters(prev => ({ ...prev, recentlySaved: v }))}
                      trackColor={{ false: colors.border.medium, true: colors.primary + '50' }}
                      thumbColor={localFilters.recentlySaved ? colors.primary : colors.background.secondary}
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>🍳 Cooked by friends recently</Text>
                    <Switch
                      value={localFilters.recentlyCookedByFriends}
                      onValueChange={v => setLocalFilters(prev => ({ ...prev, recentlyCookedByFriends: v }))}
                      trackColor={{ false: colors.border.medium, true: colors.primary + '50' }}
                      thumbColor={localFilters.recentlyCookedByFriends ? colors.primary : colors.background.secondary}
                    />
                  </View>
                </View>

                <View style={{ height: 8 }} />
              </>
            )}

          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>
                Apply Filters{activeCount > 0 ? ` (${activeCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}
