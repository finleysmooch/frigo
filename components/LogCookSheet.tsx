// components/LogCookSheet.tsx
// Phase 7B Revision: Unified cook-logging bottom sheet with compact/full modes
// Phase 7E: Meal-attach chip, visibility model (D34/D35), smart-detect banner stubs
// Compact: from RecipeDetailScreen "I Made This" — lightweight popup (~55%)
// Full: from CookingScreen post-cook — replaces PostCookFlow (~90%)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  LayoutChangeEvent,
  Dimensions,
  InputAccessoryView,
  TouchableWithoutFeedback,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import { useTheme } from '../lib/theme/ThemeContext';
import { FriendsIcon } from './icons';
import StarRating from './StarRating';
import {
  computeDefaultVisibility,
  computeMealType,
  type PostVisibility,
} from '../lib/services/postService';
import {
  detectPlannedMealForCook,
  type SmartDetectResult,
  type Meal,
} from '../lib/services/mealService';
import { supabase } from '../lib/supabase';
import MealPicker from './MealPicker';
import InSheetMealCreate from './InSheetMealCreate';
import AddCookingPartnersModal from './AddCookingPartnersModal';
import DateTimePicker from './DateTimePicker';

// ── Inline SVG icons ──

function CameraIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function ImageIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="8.5" cy="8.5" r="1.5" fill={color} />
      <Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MicIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="1" width="6" height="12" rx="3" stroke={color} strokeWidth={1.5} />
      <Path d="M19 10v1a7 7 0 01-14 0v-1" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="12" y1="19" x2="12" y2="23" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="8" y1="23" x2="16" y2="23" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function NoteIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="8" y1="13" x2="16" y2="13" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="8" y1="17" x2="13" y2="17" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function EditQtyIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusDocIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="12" x2="12" y2="18" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="9" y1="15" x2="15" y2="15" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function LockIcon({ size = 16, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="11" width="18" height="11" rx="2" stroke={color} strokeWidth={1.5} />
      <Path d="M7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function CloseIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlateIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.5} />
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={1.5} />
      <Line x1="12" y1="3" x2="12" y2="2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function EyeIcon({ size = 16, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function CheckSmallIcon({ size = 14, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="20 6 9 17 4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRightIcon({ size = 14, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 18 15 12 9 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RadioIcon({ size = 18, selected = false, color = '#0F6E56' }: { size?: number; selected?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={selected ? color : '#999'} strokeWidth={1.5} />
      {selected && <Circle cx="12" cy="12" r="6" fill={color} />}
    </Svg>
  );
}

function SparkleIcon({ size = 18, color = '#0F6E56' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2.09 6.26L20 10.27l-4.91 3.82L16.18 22 12 18.27 7.82 22l1.09-7.91L4 10.27l5.91-2.01L12 2z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function QuestionIcon({ size = 18, color = '#92400E' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.5} />
      <Path d="M9 9a3 3 0 015.12 2.12c0 2-3.12 2-3.12 4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx="12" cy="19" r="0.5" fill={color} stroke={color} strokeWidth={0.5} />
    </Svg>
  );
}

// ── Visibility option config ──

const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  label: string;
  description: string;
  mealOnly?: boolean;
}[] = [
  { value: 'everyone', label: 'Everyone', description: 'Anyone on Frigo can find this post.' },
  { value: 'followers', label: 'Followers', description: 'Just the people who follow you.' },
  { value: 'meal_tagged', label: 'People tagged in this meal', description: 'Only the cooks and guests tagged in the meal.', mealOnly: true },
  { value: 'private', label: 'Just me', description: 'Saves to your history but never appears on the feed.' },
];

// ── Types ──

export interface LogCookSheetProps {
  visible: boolean;
  mode: 'compact' | 'full';
  recipe: {
    id: string;
    title: string;
    book_title?: string;
    book_author?: string;
    page_number?: number;
    meal_type?: string;
  };
  modifications?: string;       // only used in 'full' mode
  onSubmit: (data: LogCookData) => void;
  onCancel: () => void;
  onNoteOnStep?: () => void;    // full mode only: close sheet, return to step view
  onOpenMealPicker?: () => void; // Kept for external callers; internal picker used if not set
}

export interface LogCookData {
  rating: number | null;
  thoughts: string;
  modifications: string;
  wantsToShare: boolean;
  visibility: PostVisibility;
  mealId: string | null;
  mealTitle: string | null;
  mealMealType: string | null;
  participants: Array<{ userId: string; role: 'sous_chef' | 'ate_with' }>;
  /**
   * Phase 7G: when the cook actually happened. ISO string. Defaults to
   * now() at sheet open; user can backdate via the "When did you cook
   * this?" row. Callers pass this through to createDishPost's `cookedAt`.
   */
  cookedAt: string;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const KEYBOARD_ACCESSORY_ID = 'logcooksheet-keyboard-done';

// Teal color constants for the meal chip
const TEAL_FAINT_BG = '#E1F5EE';
const TEAL_200 = '#99D9C2';
const TEAL_700 = '#0F6E56';
const TEAL_ACTIVE_BG = '#C6F0DE';

// ── Component ──

export default function LogCookSheet({
  visible,
  mode,
  recipe,
  modifications: initialModifications,
  onSubmit,
  onCancel,
  onNoteOnStep,
  onOpenMealPicker,
}: LogCookSheetProps) {
  const { colors } = useTheme();
  const isCompact = mode === 'compact';

  // Existing state
  const [rating, setRating] = useState<number | null>(null);
  const [thoughts, setThoughts] = useState('');
  const [modifications, setModifications] = useState('');
  const thoughtsRef = useRef<TextInput>(null);
  const modificationsRef = useRef<TextInput>(null);

  // Meal context state
  const [mealContext, setMealContext] = useState<{ mealId: string; mealTitle: string; mealType?: string } | null>(null);
  // Phase 7L: cached user visibility preference for re-computation on meal context change
  const userDefaultVisRef = useRef<string | undefined>(undefined);

  // Smart-detect state (D33)
  const [smartDetectResult, setSmartDetectResult] = useState<SmartDetectResult | null>(null);
  const [smartDetectDismissed, setSmartDetectDismissed] = useState(false);
  // Banner display state: 'none' | 'high' | 'low' | 'confirmed'
  const [bannerState, setBannerState] = useState<'none' | 'high' | 'low' | 'confirmed'>('none');

  // Sheet sub-view state (Checkpoint 3)
  const [sheetView, setSheetView] = useState<'main' | 'picker' | 'create'>('main');

  // Tag modal state (Checkpoint 3.4)
  const [showTagModal, setShowTagModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [taggedParticipants, setTaggedParticipants] = useState<Array<{ userId: string; role: 'sous_chef' | 'ate_with' }>>([]);

  // Visibility state (D34/D35)
  const [visibility, setVisibility] = useState<PostVisibility>('followers');
  const [visibilityManuallySet, setVisibilityManuallySet] = useState(false);
  const [showVisibilityOverlay, setShowVisibilityOverlay] = useState(false);

  // Phase 7G: cooked_at state — when the cook actually happened.
  // Defaults to now() on every open; user can backdate via the date row.
  const [cookedAt, setCookedAt] = useState<Date>(new Date());
  const [dateManuallySet, setDateManuallySet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const dismissKeyboard = useCallback(() => {
    thoughtsRef.current?.blur();
    modificationsRef.current?.blur();
  }, []);

  // Compute meal_type for this post (used by visibility defaults and the post itself)
  const inferredMealType = useMemo(
    () => computeMealType({ recipe }),
    [recipe.meal_type]
  );

  // Reset form when sheet opens
  useEffect(() => {
    if (visible) {
      setRating(null);
      setThoughts('');
      setModifications(initialModifications?.trim() || '');
      setMealContext(null);
      setVisibilityManuallySet(false);
      setShowVisibilityOverlay(false);
      setSmartDetectResult(null);
      setSmartDetectDismissed(false);
      setBannerState('none');
      setSheetView('main');
      setShowTagModal(false);
      setTaggedParticipants([]);
      setCookedAt(new Date());
      setDateManuallySet(false);
      setShowDatePicker(false);
      // Get current user id + default visibility preference
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          setCurrentUserId(session.user.id);
          // Fetch stored visibility preference
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('default_visibility')
            .eq('id', session.user.id)
            .single();
          const userDefault = profile?.default_visibility || undefined;
          userDefaultVisRef.current = userDefault;
          const defaultVis = computeDefaultVisibility({
            hasMealContext: false,
            mealType: computeMealType({ recipe }),
            userDefault,
          });
          setVisibility(defaultVis);
        } else {
          const defaultVis = computeDefaultVisibility({
            hasMealContext: false,
            mealType: computeMealType({ recipe }),
          });
          setVisibility(defaultVis);
        }
      });
    }
  }, [visible, initialModifications, recipe.meal_type]);

  // Smart-detect: run on open (D33)
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || cancelled) return;

        const result = await detectPlannedMealForCook(session.user.id, recipe.id);
        if (cancelled) return;

        setSmartDetectResult(result);

        if (!result) {
          setBannerState('none');
          return;
        }

        if (result.confidence === 'high') {
          // Auto-attach (state 1b)
          setBannerState('high');
          setMealContext({ mealId: result.meal.id, mealTitle: result.meal.title, mealType: result.meal.meal_type });
        } else {
          // Show recommendation (state 1b-low) — do NOT auto-attach
          setBannerState('low');
        }
      } catch (err) {
        console.error('Smart-detect error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, recipe.id]);

  // Re-compute visibility when meal context changes (unless manually overridden)
  useEffect(() => {
    if (!visibilityManuallySet) {
      const defaultVis = computeDefaultVisibility({
        hasMealContext: !!mealContext,
        mealType: inferredMealType,
        userDefault: userDefaultVisRef.current as any,
      });
      setVisibility(defaultVis);
    }
  }, [mealContext, inferredMealType, visibilityManuallySet]);

  // ── Half-star rating label (StarRating component handles the UI) ──
  const ratingLabel = rating !== null
    ? (Number.isInteger(rating) ? `${rating}.0` : `${rating}`)
    : null;

  const handleSubmit = (wantsToShare: boolean) => {
    const finalVisibility = wantsToShare ? visibility : 'private';
    const cookedAtIso = cookedAt.toISOString();
    console.warn(
      `[LogCookSheet] handleSubmit — cookedAt: ${cookedAtIso}, manuallySet: ${dateManuallySet}, mode: ${mode}`
    );
    onSubmit({
      rating,
      thoughts: thoughts.trim(),
      modifications: isCompact ? '' : modifications.trim(),
      wantsToShare,
      visibility: finalVisibility,
      mealId: mealContext?.mealId ?? null,
      mealTitle: mealContext?.mealTitle ?? null,
      mealMealType: mealContext?.mealType ?? null,
      participants: taggedParticipants,
      cookedAt: cookedAtIso,
    });
  };

  // Phase 7G: date row handlers
  const handleDateRowPress = useCallback(() => {
    console.warn('[LogCookSheet] date row pressed — opening picker');
    setShowDatePicker(true);
  }, []);

  const handleDateSelect = useCallback((newDate: Date) => {
    console.warn(
      `[LogCookSheet] handleDateSelect — new cookedAt: ${newDate.toISOString()}`
    );
    setCookedAt(newDate);
    setDateManuallySet(true);
    setShowDatePicker(false);
  }, []);

  const handleDateReset = useCallback(() => {
    console.warn('[LogCookSheet] date reset to now');
    setCookedAt(new Date());
    setDateManuallySet(false);
  }, []);

  // Formatted date label for display in the row
  const formatDateLabel = useCallback((d: Date): string => {
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      // Full mode uses "Today, 2:30 PM"; compact mode uses "Today"
      if (!isCompact) {
        const time = d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        return `Today, ${time}`;
      }
      return 'Today';
    }
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }, [isCompact]);

  const handleVisibilitySelect = (value: PostVisibility) => {
    setVisibility(value);
    setVisibilityManuallySet(true);
    setShowVisibilityOverlay(false);
  };

  // Attach a meal (from any source: smart-detect, picker, etc.)
  const attachMeal = useCallback((mealId: string, mealTitle: string, mealType?: string) => {
    setMealContext({ mealId, mealTitle, mealType });
    setBannerState('confirmed');
    setSmartDetectDismissed(false);
  }, []);

  // Detach current meal
  const detachMeal = useCallback(() => {
    setMealContext(null);
    setBannerState('none');
    setSmartDetectResult(null);
    setSmartDetectDismissed(true);
  }, []);

  // Smart-detect low-confidence: user taps "Attach"
  const handleSmartDetectAttach = useCallback(() => {
    if (smartDetectResult?.meal) {
      attachMeal(smartDetectResult.meal.id, smartDetectResult.meal.title, smartDetectResult.meal.meal_type);
    }
  }, [smartDetectResult, attachMeal]);

  // Smart-detect low-confidence: user taps "Not this one"
  const handleSmartDetectDismiss = useCallback(() => {
    setBannerState('none');
    setSmartDetectDismissed(true);
  }, []);

  // Change/detach from banner or chip — opens the picker
  const handleChangeOrDetach = useCallback(() => {
    setSheetView('picker');
  }, []);

  const handleMealChipPress = () => {
    setSheetView('picker');
  };

  // Picker callbacks
  const handlePickerSelectMeal = useCallback((mealId: string, mealTitle: string, mealType?: string) => {
    attachMeal(mealId, mealTitle, mealType);
    setSheetView('main');
  }, [attachMeal]);

  const handlePickerDetach = useCallback(() => {
    detachMeal();
    setSheetView('main');
  }, [detachMeal]);

  const handlePickerCreateNew = useCallback(() => {
    setSheetView('create');
  }, []);

  const handlePickerCancel = useCallback(() => {
    setSheetView('main');
  }, []);

  // In-sheet creation callback
  const handleMealCreated = useCallback((mealId: string, mealTitle: string, mealType?: string) => {
    attachMeal(mealId, mealTitle, mealType);
    setSheetView('main');
  }, [attachMeal]);

  const comingSoon = (feature: string) => {
    Alert.alert('Coming soon', `${feature} will be available in a future update.`);
  };

  const bookRef = recipe.book_title
    ? `${recipe.book_title}${recipe.book_author ? ` \u00b7 ${recipe.book_author}` : ''}${recipe.page_number ? ` \u00b7 p.${recipe.page_number}` : ''}`
    : null;

  // Visibility display label
  const visibilityLabel = VISIBILITY_OPTIONS.find(o => o.value === visibility)?.label || 'Followers';

  // Expand sheet when showing picker or creation form — those tasks need more room.
  // NOTE (Fix Pass 4): 'create' view is capped at 0.55 to leave room for the keyboard
  // push from InSheetMealCreate's TextInputs. This is a hacky tactical fix; the proper
  // fix is to restructure KeyboardAvoidingView to use behavior="padding" with a flex
  // layout instead of fixed heights. Tracked as a deferred item.
  let sheetHeight: number;
  if (sheetView === 'create') {
    sheetHeight = SCREEN_HEIGHT * 0.55;
  } else if (sheetView === 'picker') {
    sheetHeight = SCREEN_HEIGHT * 0.85;
  } else {
    sheetHeight = isCompact ? SCREEN_HEIGHT * 0.65 : SCREEN_HEIGHT * 0.9;
  }

  // ── Chip row (both modes) ──
  const renderChipRow = () => (
    <View style={styles.chipRow}>
      <TouchableOpacity
        style={styles.actionChip}
        onPress={() => comingSoon('Photo upload')}
        activeOpacity={0.7}
      >
        <CameraIcon size={14} color={colors.text.secondary} />
        <Text style={styles.actionChipText}>Photo</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionChip}
        onPress={() => comingSoon('Voice recording')}
        activeOpacity={0.7}
      >
        <MicIcon size={14} color={colors.text.secondary} />
        <Text style={styles.actionChipText}>Voice</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.actionChip,
          taggedParticipants.length > 0 && styles.mealChipActive,
        ]}
        onPress={() => setShowTagModal(true)}
        activeOpacity={0.7}
      >
        <FriendsIcon size={14} color={taggedParticipants.length > 0 ? TEAL_700 : colors.text.secondary} />
        <Text style={[
          styles.actionChipText,
          taggedParticipants.length > 0 && styles.mealChipActiveText,
        ]}>
          {taggedParticipants.length > 0 ? `Tagged (${taggedParticipants.length})` : 'Tag'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.actionChip,
          mealContext ? styles.mealChipActive : styles.mealChipIdle,
        ]}
        onPress={handleMealChipPress}
        activeOpacity={0.7}
      >
        {mealContext ? (
          <>
            <CheckSmallIcon size={12} color={TEAL_700} />
            <Text style={styles.mealChipActiveText} numberOfLines={1}>
              {mealContext.mealTitle}
            </Text>
          </>
        ) : (
          <>
            <PlateIcon size={14} color={TEAL_700} />
            <Text style={styles.mealChipIdleText}>Add to meal</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  // ── Smart-detect banner (D33) ──
  const renderSmartDetectBanner = () => {
    if (bannerState === 'none' || smartDetectDismissed && bannerState !== 'confirmed') return null;

    const mealTitle = mealContext?.mealTitle || smartDetectResult?.meal?.title || 'Meal';

    // State 1b: High confidence — auto-attached, sparkle icon
    if (bannerState === 'high') {
      return (
        <View style={[styles.smartBanner, styles.smartBannerTeal]}>
          <SparkleIcon size={18} color={TEAL_700} />
          <View style={styles.smartBannerTextArea}>
            <Text style={styles.smartBannerLead}>Attached to {mealTitle}</Text>
            <Text style={styles.smartBannerBody}>Detected from your meal plan</Text>
          </View>
          <TouchableOpacity onPress={handleChangeOrDetach} activeOpacity={0.7}>
            <Text style={styles.smartBannerChangeLink}>change</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // State 1b-low: Low confidence — question icon, two action buttons
    if (bannerState === 'low') {
      return (
        <View style={[styles.smartBanner, styles.smartBannerAmber]}>
          <QuestionIcon size={18} color="#92400E" />
          <View style={styles.smartBannerTextArea}>
            <Text style={styles.smartBannerLeadAmber}>Part of {mealTitle}?</Text>
            <Text style={styles.smartBannerBodyAmber}>You have a planned meal tonight</Text>
            <View style={styles.smartBannerActions}>
              <TouchableOpacity
                style={styles.smartBannerDismissBtn}
                onPress={handleSmartDetectDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.smartBannerDismissBtnText}>Not this one</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smartBannerAttachBtn}
                onPress={handleSmartDetectAttach}
                activeOpacity={0.7}
              >
                <Text style={styles.smartBannerAttachBtnText}>Attach</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // State 1e: Confirmed — check icon (regardless of how meal was attached)
    if (bannerState === 'confirmed') {
      return (
        <View style={[styles.smartBanner, styles.smartBannerTeal]}>
          <CheckSmallIcon size={18} color={TEAL_700} />
          <View style={styles.smartBannerTextArea}>
            <Text style={styles.smartBannerLead}>Part of {mealTitle}</Text>
            <Text style={styles.smartBannerBody}>Tap to view or change</Text>
          </View>
          <TouchableOpacity onPress={handleChangeOrDetach} activeOpacity={0.7}>
            <Text style={styles.smartBannerChangeLink}>change</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  // ── Visibility override overlay ──
  const renderVisibilityOverlay = () => {
    if (!showVisibilityOverlay) return null;
    const hasMealCtx = !!mealContext;

    return (
      <View style={styles.visOverlay}>
        <Text style={styles.visOverlayTitle}>Who can see this</Text>
        {VISIBILITY_OPTIONS.map((opt) => {
          const disabled = opt.mealOnly && !hasMealCtx;
          const selected = visibility === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.visOptionRow, disabled && styles.visOptionDisabled]}
              onPress={() => !disabled && handleVisibilitySelect(opt.value)}
              activeOpacity={disabled ? 1 : 0.7}
              disabled={disabled}
            >
              <RadioIcon size={18} selected={selected} color={TEAL_700} />
              <View style={styles.visOptionTextArea}>
                <Text style={[styles.visOptionLabel, disabled && { color: colors.text.placeholder }]}>
                  {opt.label}
                  {disabled && <Text style={styles.visMealOnlyBadge}> (meal posts only)</Text>}
                </Text>
                <Text style={[styles.visOptionDesc, disabled && { color: colors.text.placeholder }]}>
                  {opt.mealOnly && hasMealCtx
                    ? `Only the cooks and guests tagged in ${mealContext?.mealTitle || 'the meal'}.`
                    : opt.description}
                </Text>
                {opt.value === 'followers' && !visibilityManuallySet && (
                  <Text style={styles.visDefaultHint}>your default \u00b7 change in settings</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ── Visibility row (in CTA area) ──
  const renderVisibilityRow = () => (
    <TouchableOpacity
      style={styles.visibilityRow}
      onPress={() => setShowVisibilityOverlay(!showVisibilityOverlay)}
      activeOpacity={0.7}
    >
      <View style={styles.visibilityRowLeft}>
        <EyeIcon size={14} color={colors.text.tertiary} />
        <Text style={styles.visibilityLabel}>Visible to</Text>
      </View>
      <View style={styles.visibilityRowRight}>
        <Text style={styles.visibilityValue}>{visibilityLabel}</Text>
        <ChevronRightIcon size={12} color={TEAL_700} />
      </View>
    </TouchableOpacity>
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        backdropTap: {
          flex: 1,
        },
        sheet: {
          backgroundColor: colors.background.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: sheetHeight,
        },
        dragHandle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border.medium,
          alignSelf: 'center',
          marginTop: 10,
          marginBottom: 6,
        },
        compactBody: {
          paddingHorizontal: 20,
          paddingBottom: 8,
        },
        scrollContent: {
          paddingHorizontal: 20,
          paddingBottom: 16,
        },
        // Header
        headerRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingTop: 4,
          paddingBottom: isCompact ? 16 : 20,
          paddingHorizontal: 20,
        },
        headerTextArea: {
          flex: 1,
          alignItems: 'center',
          paddingHorizontal: 32,
        },
        headerTitle: {
          fontSize: isCompact ? 18 : 20,
          fontWeight: '700',
          color: colors.text.primary,
          marginBottom: 4,
          textAlign: 'center',
        },
        headerRecipe: {
          fontSize: 15,
          color: colors.text.secondary,
          textAlign: 'center',
        },
        headerBook: {
          fontSize: 12,
          color: colors.text.tertiary,
          marginTop: 2,
          textAlign: 'center',
        },
        closeButton: {
          position: 'absolute',
          right: 16,
          top: 4,
          padding: 4,
        },
        // Section
        sectionLabel: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text.primary,
          marginBottom: 10,
        },
        sectionSublabel: {
          fontSize: 12,
          color: colors.text.tertiary,
          marginTop: -6,
          marginBottom: 10,
        },
        section: {
          marginBottom: 22,
        },
        // Stars
        ratingHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        ratingBadgeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        ratingBadge: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.primary,
        },
        ratingClear: {
          fontSize: 13,
          color: colors.text.tertiary,
          textDecorationLine: 'underline',
        },
        starsRow: {
          flexDirection: 'row',
          gap: 6,
          paddingVertical: 16,  // generous vertical hit area
          marginVertical: -8,   // visually reclaim some space
        },
        // Remember chips (full mode)
        rememberChipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 18,
        },
        rememberChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: colors.background.card,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
        },
        rememberChipText: {
          fontSize: 12,
          color: colors.text.secondary,
        },
        // Smart-detect banner (D33)
        smartBanner: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 12,
          marginBottom: 14,
        },
        smartBannerTeal: {
          backgroundColor: TEAL_FAINT_BG,
          borderWidth: 1,
          borderColor: TEAL_200,
        },
        smartBannerAmber: {
          backgroundColor: '#FEF3C7',
          borderWidth: 1,
          borderColor: '#F59E0B',
        },
        smartBannerTextArea: {
          flex: 1,
        },
        smartBannerLead: {
          fontSize: 14,
          fontWeight: '600',
          color: TEAL_700,
        },
        smartBannerBody: {
          fontSize: 12,
          color: TEAL_700,
          marginTop: 2,
          opacity: 0.8,
        },
        smartBannerLeadAmber: {
          fontSize: 14,
          fontWeight: '600',
          color: '#92400E',
        },
        smartBannerBodyAmber: {
          fontSize: 12,
          color: '#92400E',
          marginTop: 2,
          opacity: 0.8,
        },
        smartBannerChangeLink: {
          fontSize: 13,
          color: TEAL_700,
          textDecorationLine: 'underline',
          marginTop: 2,
        },
        smartBannerActions: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 8,
        },
        smartBannerDismissBtn: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#92400E',
        },
        smartBannerDismissBtnText: {
          fontSize: 12,
          fontWeight: '500',
          color: '#92400E',
        },
        smartBannerAttachBtn: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: TEAL_700,
        },
        smartBannerAttachBtnText: {
          fontSize: 12,
          fontWeight: '600',
          color: '#ffffff',
        },
        // Action chip row (both modes)
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 6,
        },
        actionChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: colors.background.card,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
        },
        actionChipText: {
          fontSize: 12,
          color: colors.text.secondary,
        },
        // Meal chip — idle state (lock 2: faint teal bg)
        mealChipIdle: {
          backgroundColor: TEAL_FAINT_BG,
          borderColor: TEAL_200,
        },
        mealChipIdleText: {
          fontSize: 12,
          color: TEAL_700,
          fontWeight: '500',
        },
        // Meal chip — active state (lock 10: brighter teal, leading check)
        mealChipActive: {
          backgroundColor: TEAL_ACTIVE_BG,
          borderColor: TEAL_700,
        },
        mealChipActiveText: {
          fontSize: 12,
          color: TEAL_700,
          fontWeight: '600',
          maxWidth: 120,
        },
        // Modifications input (full mode)
        modificationsInput: {
          backgroundColor: colors.background.secondary,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 10,
          padding: 12,
          fontSize: 15,
          color: colors.text.primary,
          minHeight: 60,
          textAlignVertical: 'top',
        },
        // Photo area
        photoRow: {
          flexDirection: 'row',
          gap: 12,
        },
        photoBox: {
          flex: 1,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.border.medium,
          borderRadius: 12,
          paddingVertical: 20,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        photoBoxText: {
          fontSize: 12,
          color: colors.text.secondary,
          fontWeight: '500',
        },
        // Thoughts
        thoughtsInput: {
          backgroundColor: colors.background.secondary,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 10,
          padding: 12,
          fontSize: 15,
          color: colors.text.primary,
          minHeight: isCompact ? 60 : 80,
          textAlignVertical: 'top',
        },
        helperChipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 10,
        },
        helperChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: colors.background.card,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
        },
        helperChipText: {
          fontSize: 12,
          color: colors.text.secondary,
        },
        privacyHint: {
          fontSize: 11,
          color: colors.text.tertiary,
          marginTop: 8,
        },
        // Multi-dish prompt
        multiDishRow: {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.border.medium,
          borderRadius: 12,
          padding: 14,
          gap: 12,
        },
        multiDishContent: {
          flex: 1,
        },
        multiDishTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text.primary,
        },
        multiDishSub: {
          fontSize: 12,
          color: colors.text.tertiary,
          marginTop: 2,
        },
        multiDishPlus: {
          fontSize: 20,
          fontWeight: '600',
          color: colors.primary,
        },
        // CTAs
        ctaArea: {
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 34 : 20,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
          backgroundColor: colors.background.card,
        },
        // Visibility row (above CTA buttons)
        visibilityRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 10,
          marginBottom: 8,
        },
        visibilityRowLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        visibilityLabel: {
          fontSize: 13,
          color: colors.text.tertiary,
        },
        visibilityRowRight: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        visibilityValue: {
          fontSize: 13,
          fontWeight: '600',
          color: TEAL_700,
        },
        // Visibility override overlay
        visOverlay: {
          backgroundColor: colors.background.card,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 6,
          marginBottom: 4,
        },
        visOverlayTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text.primary,
          marginBottom: 12,
        },
        visOptionRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingVertical: 10,
        },
        visOptionDisabled: {
          opacity: 0.4,
        },
        visOptionTextArea: {
          flex: 1,
        },
        visOptionLabel: {
          fontSize: 14,
          fontWeight: '500',
          color: colors.text.primary,
        },
        visOptionDesc: {
          fontSize: 12,
          color: colors.text.tertiary,
          marginTop: 2,
        },
        visMealOnlyBadge: {
          fontSize: 11,
          color: colors.text.placeholder,
          fontWeight: '400',
        },
        visDefaultHint: {
          fontSize: 11,
          color: colors.text.tertiary,
          fontStyle: 'italic',
          marginTop: 2,
        },
        // CTA buttons
        logShareButton: {
          backgroundColor: colors.primary,
          paddingVertical: 15,
          borderRadius: 12,
          alignItems: 'center',
          marginBottom: 8,
        },
        logShareButtonText: {
          color: '#ffffff',
          fontSize: 16,
          fontWeight: '600',
        },
        justLogButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 10,
        },
        justLogText: {
          fontSize: 14,
          color: colors.text.tertiary,
        },
        // Phase 7G — date row (compact + full)
        dateRowCompact: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 18,
        },
        dateRowButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border.light,
          backgroundColor: colors.background.card,
          flexShrink: 1,
        },
        dateRowButtonText: {
          fontSize: 13,
          fontWeight: '500',
          color: colors.text.secondary,
        },
        dateRowButtonTextActive: {
          color: TEAL_700,
          fontWeight: '600',
        },
        dateRowReset: {
          padding: 4,
        },
        dateRowFull: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: colors.background.secondary,
          marginBottom: 14,
        },
        dateRowFullText: {
          fontSize: 12,
          fontWeight: '500',
          color: colors.text.secondary,
        },
        // Keyboard accessory bar
        keyboardBar: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background.secondary,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border.light,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        keyboardDoneBtn: {
          paddingHorizontal: 12,
          paddingVertical: 4,
        },
        keyboardDoneText: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.primary,
        },
      }),
    [colors, isCompact, sheetHeight, sheetView, mealContext, visibilityManuallySet]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        {/* Backdrop tap to dismiss modal + keyboard + visibility overlay */}
        <TouchableOpacity
          style={styles.backdropTap}
          activeOpacity={1}
          onPress={() => {
            dismissKeyboard();
            setShowVisibilityOverlay(false);
            onCancel();
          }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'position' : 'height'}
          keyboardVerticalOffset={0}
        >
        <View style={styles.sheet} onTouchStart={dismissKeyboard}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header with close button */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextArea}>
              {isCompact ? (
                <Text style={styles.headerTitle}>Log Your Cook</Text>
              ) : (
                <Text style={styles.headerTitle}>{'\u{1F468}\u{200D}\u{1F373}'} Nice cook!</Text>
              )}
              <Text style={styles.headerRecipe} numberOfLines={2}>
                {recipe.title}
              </Text>
              {bookRef && <Text style={styles.headerBook}>{bookRef}</Text>}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onCancel} activeOpacity={0.7}>
              <CloseIcon size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* ── Picker sub-view (state 1c) ── */}
          {sheetView === 'picker' && (
            <View style={[styles.compactBody, { flex: 1 }]}>
              <MealPicker
                currentMealId={mealContext?.mealId ?? null}
                onSelectMeal={handlePickerSelectMeal}
                onDetach={handlePickerDetach}
                onCreateNew={handlePickerCreateNew}
                onCancel={handlePickerCancel}
              />
            </View>
          )}

          {/* ── In-sheet meal creation (state 1d) ── */}
          {sheetView === 'create' && (
            <View style={[styles.compactBody, { flex: 1 }]}>
              <InSheetMealCreate
                onCreated={handleMealCreated}
                onCancel={handlePickerCancel}
              />
            </View>
          )}

          {/* ── Main view ── */}
          {sheetView === 'main' && (isCompact ? (
            <View style={styles.compactBody}>
              {/* Smart-detect banner */}
              {renderSmartDetectBanner()}

              {/* Star rating */}
              <View style={[styles.section, { marginBottom: 10 }]}>
                <View style={styles.ratingHeader}>
                  <Text style={styles.sectionLabel}>Rate it (optional)</Text>
                  {rating !== null && (
                    <View style={styles.ratingBadgeRow}>
                      <Text style={styles.ratingBadge}>{ratingLabel}</Text>
                      <TouchableOpacity onPress={() => setRating(null)} activeOpacity={0.6}>
                        <Text style={styles.ratingClear}>clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <StarRating rating={rating} onRatingChange={setRating} colors={colors} />
              </View>

              {/* Phase 7G — When did you cook this? (compact) */}
              <View style={styles.dateRowCompact}>
                <Text style={styles.sectionLabel}>When did you cook this?</Text>
                <TouchableOpacity
                  style={styles.dateRowButton}
                  onPress={handleDateRowPress}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dateRowButtonText,
                      dateManuallySet && styles.dateRowButtonTextActive,
                    ]}
                  >
                    {formatDateLabel(cookedAt)}
                  </Text>
                  <ChevronRightIcon size={14} color={dateManuallySet ? TEAL_700 : colors.text.tertiary} />
                </TouchableOpacity>
                {dateManuallySet && (
                  <TouchableOpacity
                    onPress={handleDateReset}
                    style={styles.dateRowReset}
                    activeOpacity={0.7}
                  >
                    <CloseIcon size={14} color={colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Thoughts */}
              <View style={styles.section}>
                <TextInput
                  ref={thoughtsRef}
                  style={styles.thoughtsInput}
                  multiline
                  placeholder="Any thoughts or notes for next time?"
                  placeholderTextColor={colors.text.placeholder}
                  value={thoughts}
                  onChangeText={setThoughts}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                />
              </View>

              {/* Action chip row */}
              {renderChipRow()}
            </View>
          ) : (
            /* ── Full mode: scrollable ── */
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Smart-detect banner */}
              {renderSmartDetectBanner()}

              {/* Phase 7G — date/time display (full mode, low-frequency override) */}
              <TouchableOpacity
                style={styles.dateRowFull}
                onPress={handleDateRowPress}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dateRowFullText,
                    dateManuallySet && styles.dateRowButtonTextActive,
                  ]}
                >
                  {formatDateLabel(cookedAt)}
                </Text>
                <ChevronRightIcon
                  size={12}
                  color={dateManuallySet ? TEAL_700 : colors.text.tertiary}
                />
              </TouchableOpacity>

              {/* Remember chips */}
              <View style={styles.rememberChipsRow}>
                <TouchableOpacity
                  style={styles.rememberChip}
                  onPress={() => {
                    if (onNoteOnStep) {
                      onNoteOnStep();
                    } else {
                      comingSoon('Step-level notes');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <NoteIcon size={14} color={colors.text.secondary} />
                  <Text style={styles.rememberChipText}>Note on a step</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rememberChip}
                  onPress={() => comingSoon('Voice recording')}
                  activeOpacity={0.7}
                >
                  <MicIcon size={14} color={colors.text.secondary} />
                  <Text style={styles.rememberChipText}>Voice memo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rememberChip}
                  onPress={() => comingSoon('Quantity editing')}
                  activeOpacity={0.7}
                >
                  <EditQtyIcon size={14} color={colors.text.secondary} />
                  <Text style={styles.rememberChipText}>Edit qty</Text>
                </TouchableOpacity>
              </View>

              {/* Star rating */}
              <View style={styles.section}>
                <View style={styles.ratingHeader}>
                  <Text style={styles.sectionLabel}>Rate it (optional)</Text>
                  {rating !== null && (
                    <View style={styles.ratingBadgeRow}>
                      <Text style={styles.ratingBadge}>{ratingLabel}</Text>
                      <TouchableOpacity onPress={() => setRating(null)} activeOpacity={0.6}>
                        <Text style={styles.ratingClear}>clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <StarRating rating={rating} onRatingChange={setRating} colors={colors} />
              </View>

              {/* Modifications */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Modifications</Text>
                <TextInput
                  ref={modificationsRef}
                  style={styles.modificationsInput}
                  multiline
                  placeholder="What did you change about the recipe?"
                  placeholderTextColor={colors.text.placeholder}
                  value={modifications}
                  onChangeText={setModifications}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                />
              </View>

              {/* Thoughts */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Thoughts</Text>
                <Text style={styles.sectionSublabel}>quick notes for yourself</Text>
                <TextInput
                  ref={thoughtsRef}
                  style={styles.thoughtsInput}
                  multiline
                  placeholder="What did you notice? Ideas for next time..."
                  placeholderTextColor={colors.text.placeholder}
                  value={thoughts}
                  onChangeText={setThoughts}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                />
                <Text style={styles.privacyHint}>
                  Thoughts stay with you — not shared in posts unless you choose
                </Text>
              </View>

              {/* Photo area */}
              <View style={styles.section}>
                <View style={styles.photoRow}>
                  <TouchableOpacity
                    style={styles.photoBox}
                    onPress={() => comingSoon('Photo upload')}
                    activeOpacity={0.7}
                  >
                    <CameraIcon size={24} color={colors.text.tertiary} />
                    <Text style={styles.photoBoxText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoBox}
                    onPress={() => comingSoon('Photo upload')}
                    activeOpacity={0.7}
                  >
                    <ImageIcon size={24} color={colors.text.tertiary} />
                    <Text style={styles.photoBoxText}>From Library</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action chip row (replaces standalone tag row) */}
              {renderChipRow()}

              {/* Multi-dish prompt */}
              <View style={[styles.section, { marginTop: 14 }]}>
                <TouchableOpacity
                  style={styles.multiDishRow}
                  onPress={() => comingSoon('Multi-dish posts')}
                  activeOpacity={0.7}
                >
                  <PlusDocIcon size={22} color={colors.text.secondary} />
                  <View style={styles.multiDishContent}>
                    <Text style={styles.multiDishTitle}>Made other dishes too?</Text>
                    <Text style={styles.multiDishSub}>
                      Add more recipes or improvised items
                    </Text>
                  </View>
                  <Text style={styles.multiDishPlus}>+</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ))}

          {/* Bottom CTAs (pinned) — only in main view */}
          {sheetView === 'main' && (
          <View style={styles.ctaArea}>
            {/* Visibility override overlay (slides up from CTA area) */}
            {renderVisibilityOverlay()}

            {/* Visibility row */}
            {renderVisibilityRow()}

            <TouchableOpacity
              style={styles.logShareButton}
              onPress={() => handleSubmit(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.logShareButtonText}>Log & Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.justLogButton}
              onPress={() => handleSubmit(false)}
              activeOpacity={0.7}
            >
              <LockIcon size={14} color={colors.text.tertiary} />
              <Text style={styles.justLogText}>Just log it (private)</Text>
            </TouchableOpacity>
          </View>
          )}
        </View>
        </KeyboardAvoidingView>
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
          <View style={styles.keyboardBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={dismissKeyboard} style={styles.keyboardDoneBtn} activeOpacity={0.7}>
              <Text style={styles.keyboardDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
      {/* Phase 7G — date picker (nested inside main Modal so it renders above
          the sheet). maximumDate=now locks the calendar to past-only;
          quickSelectPreset="past" swaps Tomorrow/Next Week for Yesterday/Last Week. */}
      <DateTimePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateSelect}
        initialDate={cookedAt}
        maximumDate={new Date()}
        mode="date"
        quickSelectPreset="past"
      />

      {/* Tag modal (3.4 — nested inside main Modal for reliable display) */}
      {currentUserId && (
        <AddCookingPartnersModal
          visible={showTagModal}
          onClose={() => setShowTagModal(false)}
          onConfirm={(selectedUsers, role) => {
            // Modal returns the complete current selection (it was pre-populated with initialSelectedIds).
            // Replace the stored set with the returned set.
            setTaggedParticipants(
              selectedUsers.map((userId: string) => ({
                userId,
                role: role as 'sous_chef' | 'ate_with',
              }))
            );
            setShowTagModal(false);
          }}
          currentUserId={currentUserId}
          defaultRole="ate_with"
          initialSelectedIds={new Set(taggedParticipants.map(p => p.userId))}
        />
      )}
    </Modal>
  );
}
