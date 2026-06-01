// components/RefineSheet.tsx
// 11A-CP4 — formerly FilterDrawer. The refine surface (chips + facets) lives
// above the list in RecipeListScreen; this sheet is the long-tail refinement
// UI behind More › and the cuisine facet (initialSection='cuisine').
//
// Changes vs CP3 FilterDrawer: grouped sections in a flat order (no Advanced
// collapse), the four numeric sliders replaced with mutually-exclusive range
// chip groups, a live "Show N recipes" count on Apply, lens-label header
// ("Refine · <lens>"), and an initialSection prop for anchored open.
//
// FilterState kept under the same name and exported from this file — it's
// the refinements shape consumed by recipeBrowseService.resolveBrowse and
// imported throughout. Renaming it would ripple too far for CP4's scope.

import React, { ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { VIBE_TAG_ICONS } from '../constants/vibeIcons';
import { sourceLabel } from '../lib/utils/sourceLabel';
import {
  SproutIcon, VegetablesIcon, GlutenFreeIcon, DairyFreeIcon,
  NutFreeIcon, ShellfishFreeIcon, SoyFreeIcon, EggFreeIcon,
  FireIcon, OvenIcon, GrillIcon, SlowCookerIcon, PotIcon, AirFryerIcon,
  WarmIcon, ThermometerIcon, ColdIcon,
} from '../components/icons';
import { FACET_META, type FacetId } from '../lib/services/recipeBrowseService';

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
  // 11D: high/low nutrition thresholds (the other directions + carbs/fat),
  // driven by the search typeahead + tap-to-adjust pills. Resolver applies all.
  minCaloriesPerServing?: number;
  maxProteinPerServing?: number;
  minCarbsPerServing?: number;
  maxCarbsPerServing?: number;
  minFatPerServing?: number;
  maxFatPerServing?: number;
  maxActiveTime?: number;
  maxTotalTime?: number;
  difficultyLevels: string[];
  easierThanLooks: boolean;
  cookingMethods: string[];
  cuisineTypes: string[];
  sources: string[];
  courseTypes: string[];
  ingredientCountRanges: string[];
  makeAheadFriendly: boolean;
  servingTemp: string[];
  recentlySaved: boolean;
  recentlyCookedByFriends: boolean;
  // 11A-CP3: facet-driven refinements with no sheet UI. The browse refine
  // surface toggles these directly from the facet row — they get no section
  // here (surfacing them would double-represent dietary/protein/time/method
  // dimensions the sheet already covers per CP4).
  quickUnder30?: boolean;
  onePotOnly?: boolean;
}

// 11A-CP4 — section ids for the cuisine-anchored open. The cuisine facet on
// the refine row opens the sheet with initialSection='cuisine' so the user
// doesn't have to scroll past Time/Nutrition/Dietary to pick a cuisine.
export type SectionId =
  | 'time'
  | 'nutrition'
  | 'dietary'
  | 'cuisine'
  | 'vibe'
  | 'difficulty'
  | 'method'
  | 'course'
  | 'hero'
  | 'count'
  | 'temp'
  | 'makeAhead'
  | 'social';

export interface RefineSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (filters: FilterState) => void;
  availableHeroIngredients?: string[];
  /** Active lens label for the "Refine · <lens>" header. Falls back to "Refine recipes". */
  lensLabel?: string;
  /** Live preview count of recipes the draft refinements would surface,
   *  reflecting the full pipeline (active context + search + draft refinements).
   *  Wire it in the parent via resolveBrowse over the current BrowseState. */
  previewCount?: (draftRefinements: FilterState) => number;
  /** When set, the sheet scrolls to that section on open. */
  initialSection?: SectionId;
  /** 11A-CP5a — contextual facet ids for the new "Quick refine" section at
   *  the top of the scrollable content. The parent computes via
   *  recipeBrowseService.getActiveFacets(state). When empty/undefined, the
   *  Quick refine section is skipped. */
  activeFacets?: FacetId[];
  /** 11A-CP5a — fires when the user taps the `cookbook` picker facet from
   *  Quick refine. The parent closes the sheet + opens the existing book
   *  picker modal (which sets selectedBook on the screen). */
  onOpenCookbookPicker?: () => void;
  /** NYT import — distinct web-source domains for the "Source" multi-select. */
  availableSources?: string[];
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
  sources: [],
  courseTypes: [],
  ingredientCountRanges: [],
  makeAheadFriendly: false,
  servingTemp: [],
  recentlySaved: false,
  recentlyCookedByFriends: false,
  quickUnder30: false,
  onePotOnly: false,
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

// 11A-CP4 — range chip presets per the prompt. Mutually exclusive within a
// dimension; tap active = clear (back to undefined / unbounded).
const TIME_ACTIVE_CHIPS: { label: string; value: number }[] = [
  { label: '≤15m', value: 15 },
  { label: '≤30m', value: 30 },
  { label: '≤45m', value: 45 },
  { label: '≤60m', value: 60 },
];
const TIME_TOTAL_CHIPS: { label: string; value: number }[] = [
  { label: '≤30m', value: 30 },
  { label: '≤60m', value: 60 },
  { label: '≤90m', value: 90 },
  { label: '≤2h',  value: 120 },
];
const CAL_MAX_CHIPS: { label: string; value: number }[] = [
  { label: '≤300', value: 300 },
  { label: '≤500', value: 500 },
  { label: '≤750', value: 750 },
];
const PROTEIN_MIN_CHIPS: { label: string; value: number }[] = [
  { label: '20g+', value: 20 },
  { label: '30g+', value: 30 },
  { label: '40g+', value: 40 },
];

export default function RefineSheet({
  visible,
  onClose,
  filters,
  onApplyFilters,
  availableHeroIngredients = [],
  availableSources = [],
  lensLabel,
  previewCount,
  initialSection,
  activeFacets,
  onOpenCookbookPicker,
}: RefineSheetProps) {
  const { colors } = useTheme();
  const [heroInput, setHeroInput] = useState('');
  const [localFilters, setLocalFilters] = useState<FilterState>(EMPTY_FILTERS);

  // 11A-CP4 anchored-open plumbing. Each section captures its y-offset via
  // onLayout into sectionLayouts; the open effect scrolls to it on mount.
  const scrollRef = useRef<ScrollView>(null);
  const sectionLayouts = useRef<Map<SectionId, number>>(new Map());
  const onSectionLayout = (id: SectionId) => (e: LayoutChangeEvent) => {
    sectionLayouts.current.set(id, e.nativeEvent.layout.y);
  };

  useEffect(() => {
    if (visible) {
      setLocalFilters({ ...EMPTY_FILTERS, ...filters, dietaryFlags: { ...filters?.dietaryFlags } });
      setHeroInput('');
      sectionLayouts.current.clear();
    }
  }, [visible]);

  // Scroll to initialSection once its y-offset is captured. Run on every
  // localFilters change (cheap re-check) so it lands even if onLayout fires
  // after the open effect.
  useEffect(() => {
    if (!visible || !initialSection) return;
    const y = sectionLayouts.current.get(initialSection);
    if (y != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
    }
  }, [visible, initialSection, localFilters]);

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

  // 11A-CP4 range chip — mutually exclusive within a dimension. Tapping the
  // active chip clears (undefined / unbounded); tapping a different chip
  // replaces. No "Any" chip — unselected IS any.
  const setRangeBound = (
    field: 'maxCaloriesPerServing' | 'minProteinPerServing' | 'maxActiveTime' | 'maxTotalTime',
    value: number,
  ) => {
    setLocalFilters(prev => ({
      ...prev,
      [field]: prev[field] === value ? undefined : value,
    }));
  };

  // 11A-CP5a — Quick refine plumbing. Toggle facets flip their refinement in
  // the local draft; picker facets either scroll the sheet to the dedicated
  // section (cuisine) or fire the parent callback (cookbook).
  const isFacetActiveInDraft = (id: FacetId): boolean => {
    switch (id) {
      case 'quick':        return !!localFilters.quickUnder30;
      case 'vegetarian':   return !!localFilters.dietaryFlags.is_vegetarian;
      case 'high_protein': return (localFilters.minProteinPerServing ?? 0) >= 25;
      case 'one_pot':      return !!localFilters.onePotOnly;
      case 'cuisine':      return (localFilters.cuisineTypes?.length ?? 0) > 0;
      case 'cookbook':     return false; // selectedBook is screen-level state
      case 'sort':         return false;
    }
  };
  const toggleFacetInDraft = (id: FacetId) => {
    setLocalFilters(prev => {
      switch (id) {
        case 'quick':
          return { ...prev, quickUnder30: !prev.quickUnder30 };
        case 'vegetarian':
          return {
            ...prev,
            dietaryFlags: {
              ...prev.dietaryFlags,
              is_vegetarian: prev.dietaryFlags.is_vegetarian ? undefined : true,
            },
          };
        case 'high_protein':
          return {
            ...prev,
            minProteinPerServing:
              (prev.minProteinPerServing ?? 0) >= 25 ? undefined : 25,
          };
        case 'one_pot':
          return { ...prev, onePotOnly: !prev.onePotOnly };
        default:
          return prev;
      }
    });
  };
  const handleQuickRefineTap = (id: FacetId) => {
    const meta = FACET_META[id];
    if (meta.kind === 'toggle') {
      toggleFacetInDraft(id);
      return;
    }
    if (id === 'cuisine') {
      const y = sectionLayouts.current.get('cuisine');
      if (y != null) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      }
    } else if (id === 'cookbook') {
      onOpenCookbookPicker?.();
    }
  };

  // Hero ingredient: add from text input
  const addHeroFromInput = () => {
    const trimmed = heroInput.trim().toLowerCase();
    if (trimmed && !localFilters.heroIngredients.includes(trimmed)) {
      setLocalFilters(prev => ({ ...prev, heroIngredients: [...prev.heroIngredients, trimmed] }));
    }
    setHeroInput('');
  };

  // Active filter count for header badge (kept as a quick at-a-glance hint;
  // the live "Show N recipes" on Apply is the user-facing measure now).
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
    n += localFilters.sources.length;
    n += localFilters.courseTypes.length;
    n += localFilters.ingredientCountRanges.length;
    if (localFilters.makeAheadFriendly) n++;
    n += localFilters.servingTemp.length;
    if (localFilters.recentlySaved) n++;
    if (localFilters.recentlyCookedByFriends) n++;
    return n;
  }, [localFilters]);

  // 11A-CP4 live result count for the Apply button. Reflects the full pipeline
  // (active context + search + draft refinements) since the parent's preview
  // closure resolves the whole BrowseState. Resolver is cheap (~475 recipes)
  // so no debounce; revisit if testing surfaces flicker.
  const previewN = useMemo(
    () => (previewCount ? previewCount(localFilters) : null),
    [previewCount, localFilters],
  );

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
      flex: 1,
      textAlign: 'center',
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
      width: 64,
      textAlign: 'right',
    },
    closeBtn: {
      fontSize: 20,
      color: colors.text.secondary,
      paddingHorizontal: 4,
      width: 28,
    },
    content: {
      paddingBottom: 8,
    },

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

    // 11A-CP4 range-chip group (Time / Nutrition). Reuses the chip styles
    // above with a row label.
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    rangeLabel: {
      fontSize: 13,
      color: colors.text.secondary,
      width: 68,
    },
    rangeChips: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },

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

  // Reusable chip renderer
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

  // 11A-CP4 range-chip row renderer
  const renderRangeRow = (
    rowLabel: string,
    field: 'maxCaloriesPerServing' | 'minProteinPerServing' | 'maxActiveTime' | 'maxTotalTime',
    chips: { label: string; value: number }[],
  ) => (
    <View style={styles.rangeRow}>
      <Text style={styles.rangeLabel}>{rowLabel}</Text>
      <View style={styles.rangeChips}>
        {chips.map(({ label, value }) =>
          renderChip(
            `${field}:${value}`,
            label,
            null,
            localFilters[field] === value,
            () => setRangeBound(field, value),
          ),
        )}
      </View>
    </View>
  );

  const headerTitle = lensLabel ? `Refine · ${lensLabel}` : 'Refine recipes';
  const applyLabel = previewN != null
    ? `Show ${previewN} recipe${previewN !== 1 ? 's' : ''}`
    : `Apply${activeCount > 0 ? ` (${activeCount})` : ''}`;

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

          {/* Header — "Refine · <lens>" + reset + ✕ */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
              {activeCount > 0 ? (
                <Text style={styles.headerBadge}> · {activeCount}</Text>
              ) : null}
            </Text>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>Clear all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false}>

            {/* ── 11A-CP5a Quick refine ──────────────────────────────
                Per-context facets relocated from the CP3 persistent row above
                the list. Toggle facets flip refinements in the draft; cuisine
                scrolls to the Cuisine section below; cookbook fires the
                parent callback (book picker modal lives on the screen). */}
            {(activeFacets?.length ?? 0) > 0 && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quick refine</Text>
                  <View style={styles.chipRow}>
                    {activeFacets!.map(id => {
                      const meta = FACET_META[id];
                      const labelSuffix = meta.kind === 'picker' ? ' ▾' : '';
                      return renderChip(
                        `qr-${id}`,
                        `${meta.label}${labelSuffix}`,
                        null,
                        isFacetActiveInDraft(id),
                        () => handleQuickRefineTap(id),
                      );
                    })}
                  </View>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* ── Time ─────────────────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('time')}>
              <Text style={styles.sectionTitle}>Time</Text>
              {renderRangeRow('Active', 'maxActiveTime', TIME_ACTIVE_CHIPS)}
              {renderRangeRow('Total',  'maxTotalTime',  TIME_TOTAL_CHIPS)}
            </View>

            <View style={styles.divider} />

            {/* ── Nutrition ─────────────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('nutrition')}>
              <Text style={styles.sectionTitle}>Nutrition</Text>
              {renderRangeRow('Cal max',     'maxCaloriesPerServing', CAL_MAX_CHIPS)}
              {renderRangeRow('Protein min', 'minProteinPerServing',  PROTEIN_MIN_CHIPS)}
            </View>

            <View style={styles.divider} />

            {/* ── Dietary ──────────────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('dietary')}>
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
                  ),
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Cuisine ──────────────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('cuisine')}>
              <Text style={styles.sectionTitle}>Cuisine</Text>
              <View style={styles.chipRow}>
                {CUISINE_TYPES.map(c =>
                  renderChip(
                    c, c, null,
                    localFilters.cuisineTypes.includes(c),
                    () => toggleInArray('cuisineTypes', c),
                  ),
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Vibe ─────────────────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('vibe')}>
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
                  ),
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Difficulty (+ Easier than looks) ─────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('difficulty')}>
              <Text style={styles.sectionTitle}>Difficulty</Text>
              <View style={styles.chipRow}>
                {DIFFICULTY_OPTIONS.map(d =>
                  renderChip(
                    d,
                    d.charAt(0).toUpperCase() + d.slice(1),
                    null,
                    localFilters.difficultyLevels.includes(d),
                    () => toggleInArray('difficultyLevels', d),
                  ),
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
            <View style={styles.section} onLayout={onSectionLayout('method')}>
              <Text style={styles.sectionTitle}>Cooking Method</Text>
              <View style={styles.chipRow}>
                {COOKING_METHODS.map(m =>
                  renderChip(
                    m.id, m.label, null,
                    localFilters.cookingMethods.includes(m.id),
                    () => toggleInArray('cookingMethods', m.id),
                    m.IconComponent,
                  ),
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Source (web-imported, e.g. NYT Cooking) — only when present ── */}
            {availableSources.length > 0 && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Source</Text>
                  <View style={styles.chipRow}>
                    {availableSources.map(domain =>
                      renderChip(
                        domain,
                        sourceLabel(domain) || domain,
                        null,
                        localFilters.sources.includes(domain),
                        () => toggleInArray('sources', domain),
                      )
                    )}
                  </View>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* ── Course ───────────────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('course')}>
              <Text style={styles.sectionTitle}>Course Type</Text>
              <View style={styles.chipRow}>
                {COURSE_TYPES.map(c =>
                  renderChip(
                    c,
                    c.charAt(0).toUpperCase() + c.slice(1),
                    null,
                    localFilters.courseTypes.includes(c),
                    () => toggleInArray('courseTypes', c),
                  ),
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Hero Ingredient ───────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('hero')}>
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
              {availableHeroIngredients.length > 0 && (
                <View style={styles.chipRow}>
                  {availableHeroIngredients.slice(0, 20).map(h =>
                    renderChip(
                      h, h, null,
                      localFilters.heroIngredients.includes(h),
                      () => toggleInArray('heroIngredients', h),
                    ),
                  )}
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* ── Ingredient Count ─────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('count')}>
              <Text style={styles.sectionTitle}>Ingredient Count</Text>
              <View style={styles.chipRow}>
                {INGREDIENT_RANGES.map(r =>
                  renderChip(
                    r, r, null,
                    localFilters.ingredientCountRanges.includes(r),
                    () => toggleInArray('ingredientCountRanges', r),
                  ),
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Serving Temp ─────────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('temp')}>
              <Text style={styles.sectionTitle}>Serving Temp</Text>
              <View style={styles.chipRow}>
                {SERVING_TEMPS.map(t =>
                  renderChip(
                    t.id, t.label, null,
                    localFilters.servingTemp.includes(t.id),
                    () => toggleInArray('servingTemp', t.id),
                    t.IconComponent,
                  ),
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Make-ahead ───────────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('makeAhead')}>
              <Text style={styles.sectionTitle}>Make-ahead</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>⏰ Make-ahead friendly</Text>
                <Switch
                  value={localFilters.makeAheadFriendly}
                  onValueChange={v => setLocalFilters(prev => ({ ...prev, makeAheadFriendly: v }))}
                  trackColor={{ false: colors.border.medium, true: colors.primary + '50' }}
                  thumbColor={localFilters.makeAheadFriendly ? colors.primary : colors.background.secondary}
                />
              </View>
            </View>

            <View style={styles.divider} />

            {/* ── Social ───────────────────────────────────────────── */}
            <View style={styles.section} onLayout={onSectionLayout('social')}>
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

            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Footer — "Show N recipes" live count */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>{applyLabel}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}
