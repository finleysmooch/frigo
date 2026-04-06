// screens/CookingScreen.tsx
// Phase 6: Complete cooking mode — step-by-step, classic view, timers, notes, post-cook
// Rebuilt: March 19, 2026 — Step 8: all modes + post-cook flow

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { RecipesStackParamList } from '../App';
import { completePlanItem } from '../lib/services/mealPlanService';
import { createDishPost, updateTimesCooked } from '../lib/services/postService';
import LogCookSheet from '../components/LogCookSheet';
import type { LogCookData } from '../components/LogCookSheet';
import { generateSmartTitle } from '../utils/titleGenerator';
import { useTheme } from '../lib/theme/ThemeContext';
import {
  normalizeInstructions,
  getInstructionSectionsSync,
  mapIngredientsToSteps,
  getStepNotes,
  upsertStepNote,
} from '../lib/services/cookingService';
import type { NormalizedStep, InstructionSection, StepIngredient, StepNote } from '../lib/types/cooking';
import { CookingTimerProvider } from '../contexts/CookingTimerContext';
import SectionDots from '../components/cooking/SectionDots';
import SectionCard from '../components/cooking/SectionCard';
import CompactTimerBar from '../components/cooking/CompactTimerBar';
import TimerDetail from '../components/cooking/TimerDetail';
import IngredientSheet from '../components/cooking/IngredientSheet';
import IngredientDetailPopup from '../components/cooking/IngredientDetailPopup';
import ViewModeMenu, { type ViewMode } from '../components/cooking/ViewModeMenu';
import ClassicView from '../components/cooking/ClassicView';
import type { Timer } from '../contexts/CookingTimerContext';

const VIEW_MODE_KEY = 'frigo_cooking_view_mode';

type Props = NativeStackScreenProps<RecipesStackParamList, 'Cooking'>;

const SWIPE_THRESHOLD = 60;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function CookingScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { recipe, planItemId, mealId, mealTitle } = route.params;

  useKeepAwake();

  // ── Data: steps, sections, ingredients ──
  const steps = useMemo(() => normalizeInstructions(recipe), [recipe]);
  const sections = useMemo(() => getInstructionSectionsSync(recipe), [recipe]);
  const ingredientsByStep = useMemo(() => mapIngredientsToSteps(recipe), [recipe]);

  // ── State ──
  const [currentStep, setCurrentStep] = useState(steps.length > 0 ? steps[0].number : 1);
  const [showLogCookSheet, setShowLogCookSheet] = useState(false);
  const [expandedTimer, setExpandedTimer] = useState<Timer | null>(null);
  const [showIngredientSheet, setShowIngredientSheet] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<{
    ingredient: StepIngredient;
    stepNumber: number;
  } | null>(null);
  const [notesByStep, setNotesByStep] = useState<Map<number, StepNote>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('step_by_step');
  const [showViewMenu, setShowViewMenu] = useState(false);

  // ── Load saved view mode preference + step notes on mount ──
  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then(val => {
      if (val === 'classic' || val === 'step_by_step') setViewMode(val);
    }).catch(() => {});
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    AsyncStorage.setItem(VIEW_MODE_KEY, mode).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const notes = await getStepNotes(recipe.id, session.user.id);
        const map = new Map<number, StepNote>();
        for (const n of notes) map.set(n.step_number, n);
        setNotesByStep(map);
      } catch {
        // silently fail — notes are optional
      }
    })();
  }, [recipe.id]);

  const handleNoteSave = useCallback(async (stepNumber: number, text: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const saved = await upsertStepNote(session.user.id, recipe.id, stepNumber, text);
    if (saved) {
      setNotesByStep(prev => {
        const next = new Map(prev);
        next.set(stepNumber, saved);
        return next;
      });
    }
  }, [recipe.id]);

  // Auto-expand: true when current step text is long
  const autoExpand = useMemo(() => {
    const step = steps.find(s => s.number === currentStep);
    if (!step) return false;
    const ingredients = ingredientsByStep.get(currentStep) || [];
    return step.text.length > 200 || ingredients.length > 4;
  }, [currentStep, steps, ingredientsByStep]);

  // Which section is the current step in?
  const currentSectionIdx = useMemo(() => {
    return sections.findIndex(
      s => currentStep >= s.startStep && currentStep <= s.endStep
    );
  }, [currentStep, sections]);

  // Steps in the current section
  const currentSectionSteps = useMemo(() => {
    if (currentSectionIdx < 0) return [];
    const sec = sections[currentSectionIdx];
    return steps.filter(s => s.number >= sec.startStep && s.number <= sec.endStep);
  }, [currentSectionIdx, sections, steps]);

  // ── Swipe navigation via PanResponder ──
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
        onPanResponderMove: (_, gs) => {
          translateX.setValue(gs.dx);
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dx < -SWIPE_THRESHOLD && currentSectionIdx < sections.length - 1) {
            // Swipe left → next section
            Animated.spring(translateX, {
              toValue: -SCREEN_WIDTH,
              useNativeDriver: true,
              speed: 20,
            }).start(() => {
              const nextSection = sections[currentSectionIdx + 1];
              setCurrentStep(nextSection.startStep);
              translateX.setValue(0);
            });
          } else if (gs.dx > SWIPE_THRESHOLD && currentSectionIdx > 0) {
            // Swipe right → previous section
            Animated.spring(translateX, {
              toValue: SCREEN_WIDTH,
              useNativeDriver: true,
              speed: 20,
            }).start(() => {
              const prevSection = sections[currentSectionIdx - 1];
              setCurrentStep(prevSection.startStep);
              translateX.setValue(0);
            });
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              speed: 20,
            }).start();
          }
        },
      }),
    [currentSectionIdx, sections, translateX]
  );

  // ── Step navigation ──
  const handleStepTap = useCallback(
    (stepNumber: number) => {
      setCurrentStep(stepNumber);
    },
    []
  );

  const advanceStep = useCallback(() => {
    const idx = steps.findIndex(s => s.number === currentStep);
    if (idx < steps.length - 1) {
      setCurrentStep(steps[idx + 1].number);
    } else {
      // Past last step → open LogCookSheet in full mode
      setShowLogCookSheet(true);
    }
  }, [currentStep, steps]);

  // ── Ingredient sheet/detail handlers ──
  const handleIngredientTap = useCallback(
    (ingredient: StepIngredient, stepNumber: number) => {
      setSelectedIngredient({ ingredient, stepNumber });
      setShowIngredientSheet(false);
    },
    []
  );

  // Find all steps where the selected ingredient appears
  const selectedUsedInSteps = useMemo(() => {
    if (!selectedIngredient) return [];
    const name = selectedIngredient.ingredient.name;
    const stepNums: number[] = [];
    for (const [stepNum, ings] of ingredientsByStep) {
      if (ings.some(i => i.name === name)) stepNums.push(stepNum);
    }
    return stepNums.sort((a, b) => a - b);
  }, [selectedIngredient, ingredientsByStep]);

  // ── "Note on a step" from LogCookSheet full mode ──
  const handleNoteOnStep = useCallback(() => {
    setShowLogCookSheet(false);
    setViewMode('step_by_step');
  }, []);

  const handleLogCookSubmit = useCallback(async (logData: LogCookData) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Error', 'Please restart the app and try again.');
        return;
      }

      const visibility = logData.wantsToShare ? 'everyone' : 'private';

      const post = await createDishPost({
        userId: session.user.id,
        recipeId: recipe.id,
        title: generateSmartTitle(),
        rating: logData.rating || null,
        modifications: logData.modifications || null,
        notes: logData.thoughts || null,
        visibility,
        parentMealId: mealId || null,
      });

      // Increment times_cooked
      try {
        await updateTimesCooked(recipe.id, (recipe.times_cooked || 0) + 1);
      } catch (_) {}

      if (planItemId && post?.id) {
        await completePlanItem(planItemId, session.user.id, post.id);
      }

      setShowLogCookSheet(false);

      const successTitle = planItemId ? 'Added to Meal!' : 'Logged!';
      const successMsg = planItemId
        ? `Your dish has been added to "${mealTitle}"`
        : logData.wantsToShare
          ? 'Your cook has been shared!'
          : 'Logged privately \u2014 counts in your stats but not on the feed.';

      Alert.alert(successTitle, successMsg, [
        { text: 'OK', onPress: () => navigation.navigate('RecipeList') },
      ]);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post: ' + (error as any).message);
    }
  }, [recipe.id, recipe.times_cooked, planItemId, mealId, mealTitle, navigation]);

  // ── Derived display values ──
  const currentSection = sections[currentSectionIdx] || null;
  const prevSection = currentSectionIdx > 0 ? sections[currentSectionIdx - 1] : null;
  const nextSection =
    currentSectionIdx >= 0 && currentSectionIdx < sections.length - 1
      ? sections[currentSectionIdx + 1]
      : null;

  const bookLine = recipe.book_title
    ? `📖 ${recipe.book_title}${recipe.book_author ? ` · ${recipe.book_author}` : ''}${recipe.page_number ? ` · p.${recipe.page_number}` : ''}`
    : null;

  // ── Styles ──
  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.card },
        // Header
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingTop: 6,
          paddingBottom: 2,
        },
        exitBtn: { paddingVertical: 4, paddingRight: 8 },
        exitText: { fontSize: 13, color: colors.text.tertiary },
        headerTitle: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.text.primary,
          flex: 1,
          textAlign: 'center',
          marginHorizontal: 8,
        },
        headerIcons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
        headerIcon: { fontSize: 14, color: colors.text.tertiary },
        modeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
        modeBadgeText: { fontSize: 10, fontWeight: '700' },
        // Book ref
        bookLine: {
          paddingHorizontal: 14,
          paddingBottom: 4,
        },
        bookText: { fontSize: 11, color: colors.text.tertiary },
        // Meal banner
        mealBanner: {
          backgroundColor: colors.background.secondary,
          paddingHorizontal: 14,
          paddingVertical: 8,
          marginHorizontal: 14,
          marginBottom: 4,
          borderRadius: 8,
          borderLeftWidth: 3,
          borderLeftColor: colors.primary,
        },
        mealBannerText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
        // Section peeks
        peekContainer: { paddingHorizontal: 14, paddingVertical: 3, opacity: 0.25 },
        peekText: {
          fontSize: 10,
          color: colors.text.tertiary,
          fontWeight: '600',
          textTransform: 'uppercase',
        },
        divider: {
          height: 1,
          backgroundColor: colors.border.light,
          marginHorizontal: 14,
          marginVertical: 2,
        },
        // Bottom bar
        bottomBar: {
          backgroundColor: '#0f2b29',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          paddingTop: 8,
          paddingBottom: 10,
          paddingHorizontal: 14,
        },
        timerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderBottomColor: '#1e4845',
          marginBottom: 6,
        },
        timerPlaceholder: { fontSize: 11, color: '#5eaba4' },
        ingredientHandle: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        ingredientHandleText: { fontSize: 13, color: '#7eb8b3' },
        ingredientHandleArrow: { fontSize: 13, color: '#5eaba4' },
        // Done cooking
        doneContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 30,
        },
        doneEmoji: { fontSize: 48, marginBottom: 16 },
        doneTitle: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text.primary,
          marginBottom: 8,
          textAlign: 'center',
        },
        doneSubtitle: {
          fontSize: 14,
          color: colors.text.secondary,
          textAlign: 'center',
          marginBottom: 24,
        },
        finishButton: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          paddingHorizontal: 32,
          borderRadius: 12,
          marginBottom: 12,
        },
        finishButtonText: {
          color: 'white',
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
        },
        skipButton: { paddingVertical: 8 },
        skipText: { fontSize: 13, color: colors.text.tertiary },
        // Advance button
        advanceRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 14,
          paddingVertical: 6,
        },
        advanceBtn: {
          backgroundColor: colors.primary,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 8,
        },
        advanceBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
      }),
    [colors]
  );

  // ── Render helpers ──
  const isEmpty = steps.length === 0 || sections.length === 0;

  const renderContent = () => {
    // Empty state
    if (isEmpty) {
      return (
        <>
          <View style={s.header}>
            <TouchableOpacity style={s.exitBtn} onPress={() => navigation.goBack()}>
              <Text style={s.exitText}>← Exit</Text>
            </TouchableOpacity>
          </View>
          <View style={s.doneContainer}>
            <Text style={s.doneTitle}>No instructions found</Text>
            <Text style={s.doneSubtitle}>This recipe doesn't have steps to cook through.</Text>
          </View>
        </>
      );
    }

    // Main cooking UI
    return (
      <>
        {/* 1. Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.exitBtn} onPress={() => navigation.goBack()}>
            <Text style={s.exitText}>← Exit</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          <View style={s.headerIcons}>
            {viewMode === 'classic' && (
              <View style={[s.modeBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[s.modeBadgeText, { color: colors.primary }]}>Classic</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setShowViewMenu(true)}>
              <Text style={s.headerIcon}>⋮</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Book reference */}
        {bookLine && (
          <View style={s.bookLine}>
            <Text style={s.bookText}>{bookLine}</Text>
          </View>
        )}

        {/* Meal banner */}
        {mealTitle && (
          <View style={s.mealBanner}>
            <Text style={s.mealBannerText}>🍽️ Cooking for: {mealTitle}</Text>
          </View>
        )}

        {/* View-mode dependent content */}
        {viewMode === 'classic' ? (
          <ClassicView
            recipe={recipe}
            steps={steps}
            sections={sections}
            ingredientsByStep={ingredientsByStep}
            currentStepNumber={currentStep}
            notesByStep={notesByStep}
            onSwitchToStepView={() => handleViewModeChange('step_by_step')}
            onStepTap={handleStepTap}
            onNoteEdit={(stepNum) => {
              handleViewModeChange('step_by_step');
              setCurrentStep(stepNum);
            }}
          />
        ) : (
          <>
            {/* 3. Section progress dots */}
            <SectionDots current={currentSectionIdx} total={sections.length} />

            {/* 4. Previous section peek */}
            {prevSection && (
              <>
                <View style={s.peekContainer}>
                  <Text style={s.peekText}>
                    {prevSection.name} · {prevSection.endStep - prevSection.startStep + 1} step
                    {prevSection.endStep - prevSection.startStep > 0 ? 's' : ''}
                  </Text>
                </View>
                <View style={s.divider} />
              </>
            )}

            {/* 5-6. Section card (main content, swipeable) */}
            <Animated.View
              style={{ flex: 1, transform: [{ translateX }] }}
              {...panResponder.panHandlers}
            >
              {currentSection && (
                <SectionCard
                  section={currentSection}
                  sectionIndex={currentSectionIdx}
                  totalSections={sections.length}
                  steps={currentSectionSteps}
                  currentStepNumber={currentStep}
                  ingredientsByStep={ingredientsByStep}
                  onStepTap={handleStepTap}
                  autoExpand={autoExpand}
                  notesByStep={notesByStep}
                  onNoteSave={handleNoteSave}
                />
              )}
            </Animated.View>

            {/* Advance button */}
            <View style={s.advanceRow}>
              <TouchableOpacity style={s.advanceBtn} onPress={advanceStep}>
                <Text style={s.advanceBtnText}>
                  {currentStep === steps[steps.length - 1]?.number ? 'Done cooking →' : 'Next step →'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 7. Divider + Next section peek */}
            {nextSection && (
              <>
                <View style={s.divider} />
                <View style={s.peekContainer}>
                  <Text style={s.peekText}>
                    NEXT: {nextSection.name} · {nextSection.endStep - nextSection.startStep + 1} step
                    {nextSection.endStep - nextSection.startStep > 0 ? 's' : ''}
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        {/* 8. Bottom bar */}
        <View style={s.bottomBar}>
          {/* Compact timer pills */}
          <View style={s.timerRow}>
            <CompactTimerBar onTimerTap={(t) => setExpandedTimer(t)} />
          </View>
          {/* Ingredient handle → opens bottom sheet */}
          <TouchableOpacity
            style={s.ingredientHandle}
            activeOpacity={0.7}
            onPress={() => setShowIngredientSheet(true)}
          >
            <Text style={s.ingredientHandleText}>🥬 Ingredients</Text>
            <Text style={s.ingredientHandleArrow}>↑</Text>
          </TouchableOpacity>
        </View>

        {/* Timer detail overlay */}
        {expandedTimer && (
          <TimerDetail
            timer={expandedTimer}
            onClose={() => setExpandedTimer(null)}
          />
        )}
      </>
    );
  };

  return (
    <CookingTimerProvider recipeTitle={recipe.title}>
      <SafeAreaView style={s.container}>
        {renderContent()}
        <LogCookSheet
          visible={showLogCookSheet}
          mode="full"
          recipe={recipe}
          onSubmit={handleLogCookSubmit}
          onCancel={() => setShowLogCookSheet(false)}
          onNoteOnStep={handleNoteOnStep}
        />
        <IngredientSheet
          visible={showIngredientSheet}
          onClose={() => setShowIngredientSheet(false)}
          steps={steps}
          sections={sections}
          ingredientsByStep={ingredientsByStep}
          currentStepNumber={currentStep}
          onIngredientTap={handleIngredientTap}
        />
        <IngredientDetailPopup
          visible={!!selectedIngredient}
          onClose={() => setSelectedIngredient(null)}
          ingredient={selectedIngredient?.ingredient || null}
          usedInSteps={selectedUsedInSteps}
          steps={steps}
          note={selectedIngredient ? notesByStep.get(selectedIngredient.stepNumber)?.note_text : null}
        />
        <ViewModeMenu
          visible={showViewMenu}
          onClose={() => setShowViewMenu(false)}
          currentMode={viewMode}
          onSelectMode={handleViewModeChange}
        />
      </SafeAreaView>
    </CookingTimerProvider>
  );
}
