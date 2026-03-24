// screens/RecipeDetailScreen.tsx
// Phase 6B redesign — NYT Cooking-style layout
// Sub-components in components/recipe/: RecipeHeader, IngredientsSection, PreparationSection, ScaleConvertControls

import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { RecipesStackParamList } from '../App';
import { getPantryItems } from '../lib/pantryService';
import { PantryItemWithIngredient } from '../lib/types/pantry';
import { getInstructionSections } from '../lib/services/instructionSectionsService';
import { InstructionSection } from '../lib/types/recipeExtraction';
import AddRecipeToListModal from '../components/AddRecipeToListModal';
import IngredientPopup from '../components/IngredientPopup';
import SelectMealForRecipeModal from '../components/SelectMealForRecipeModal';
import RecipeNutritionPanel from '../components/RecipeNutritionPanel';
import RecipeHeader from '../components/recipe/RecipeHeader';
import IngredientsSection from '../components/recipe/IngredientsSection';
import PreparationSection from '../components/recipe/PreparationSection';
import ScaleConvertControls from '../components/recipe/ScaleConvertControls';
import {
  formatIngredientForPopup,
} from '../utils/ingredientMatcher';
import {
  convertRecipeIngredients,
  UnitSystem,
} from '../lib/services/unitConverter';
import { mapIngredientsToSteps } from '../lib/services/cookingService';
import { StepIngredient } from '../lib/types/cooking';
import { buildStepKeys } from '../components/recipe/PreparationSection';
import { toTitleCase } from '../components/recipe/RecipeHeader';
import { SaveOutlineIcon, SaveFilledIcon } from '../components/recipe/SaveIcon';
import { addToCookSoon, removeFromCookSoon, isInCookSoon } from '../lib/services/userRecipeTagsService';
import {
  getUserRecipeAnnotations,
  saveIngredientEdit,
  saveInstructionEdit,
  deleteInstruction,
  applyIngredientAnnotations,
  applyInstructionAnnotations,
  RecipeAnnotation,
  ViewMode
} from '../lib/services/recipeAnnotationsService';

type Props = NativeStackScreenProps<RecipesStackParamList, 'RecipeDetail'>;

interface Ingredient {
  id: string;
  name: string;
  displayText: string;
  family: string;
  quantity_amount?: number;
  quantity_unit?: string;
  preparation?: string;
  group_name: string | null;
  group_number: number | null;
  _annotation?: {
    original: string;
    new: string;
    notes?: string;
    showMarkup: boolean;
  };
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string;
  recipe_type: string;
  prep_time_min: number;
  cook_time_min: number;
  instructions: string[];
  ingredients: string[];
  chef_name?: string;
  chef_id?: string;
  times_cooked?: number;
  book_id?: string;
  page_number?: number;
  book_title?: string;
  book_author?: string;
  servings?: number;
}

const UNIT_SYSTEMS: Array<{ label: string; value: UnitSystem }> = [
  { label: 'Original', value: 'original' },
  { label: 'Metric', value: 'metric' },
  { label: 'Imperial', value: 'imperial' },
];

const generatePickerOptions = () => {
  const options = [];
  for (let i = 1; i <= 10; i += 0.5) {
    options.push(i);
  }
  return options;
};

const PICKER_OPTIONS = generatePickerOptions();

function getInstructionText(instruction: any): string {
  if (typeof instruction === 'string') {
    return instruction;
  }
  return instruction.instruction || instruction.text || '';
}

export default function RecipeDetailScreen({ navigation, route }: Props) {
  const { recipe: recipePreview, planItemId, mealId, mealTitle } = route.params as {
    recipe: any;
    planItemId?: string;
    mealId?: string;
    mealTitle?: string;
  };
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [instructionSections, setInstructionSections] = useState<InstructionSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pantryItems, setPantryItems] = useState<PantryItemWithIngredient[]>([]);
  const [missingIngredients, setMissingIngredients] = useState<Ingredient[]>([]);
  const [currentScale, setCurrentScale] = useState(1);
  const [currentUnitSystem, setCurrentUnitSystem] = useState<UnitSystem>('original');
  const [convertedIngredients, setConvertedIngredients] = useState<any[]>([]);
  const [showListModal, setShowListModal] = useState(false);
  const [listModalMode, setListModalMode] = useState<'missing' | 'all'>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [nutritionExpanded, setNutritionExpanded] = useState(false);
  const [stepIngredients, setStepIngredients] = useState<Map<number, StepIngredient[]>>(new Map());
  const [showScalePicker, setShowScalePicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [pickerScale, setPickerScale] = useState(4);
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll tracking + sticky bar
  const [scrollY, setScrollY] = useState(0);
  const [ingredientsHeaderY, setIngredientsHeaderY] = useState(0);
  const [preparationHeaderY, setPreparationHeaderY] = useState(0);
  const [titleBottomY, setTitleBottomY] = useState(0);
  const hasSeenPreparation = useRef(false);
  const topBarHeight = 52;

  // Cook Soon
  const [isCookSoon, setIsCookSoon] = useState(false);

  // Step focus mode
  const [focusedStepKey, setFocusedStepKey] = useState<string | null>(null);
  const stepPositionsRef = useRef<Map<string, number>>(new Map());

  // Ingredient popup state
  const [ingredientPopup, setIngredientPopup] = useState<{
    visible: boolean;
    ingredientName: string;
    quantity: string;
    preparation?: string;
    position: { x: number; y: number };
  }>({
    visible: false,
    ingredientName: '',
    quantity: '',
    position: { x: 0, y: 0 }
  });

  // Annotation state
  const [viewMode, setViewMode] = useState<ViewMode>('clean');
  const [isEditMode, setIsEditMode] = useState(false);
  const [annotations, setAnnotations] = useState<RecipeAnnotation[]>([]);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showMealModal, setShowMealModal] = useState(false);
  
  // Inline editing state
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);
  const [editingInstructionIndex, setEditingInstructionIndex] = useState<number | null>(null);
  const [editingInstructionSection, setEditingInstructionSection] = useState<string | null>(null);

  useEffect(() => {
    loadRecipeDetails();
    loadPantryItems();
  }, [recipePreview.id]);

  useEffect(() => {
    if (ingredients.length > 0) {
      convertIngredientsToSystem();
    }
  }, [ingredients, currentScale, currentUnitSystem]);

  useEffect(() => {
    if (currentUserId && recipe) {
      loadAnnotations();
    }
  }, [currentUserId, recipe?.id]);

  const loadAnnotations = async () => {
    if (!currentUserId || !recipe) return;
    
    try {
      const userAnnotations = await getUserRecipeAnnotations(currentUserId, recipe.id);
      setAnnotations(userAnnotations);
    } catch (error) {
      console.error('Error loading annotations:', error);
    }
  };

  const loadRecipeDetails = async () => {
    try {
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select(`
          *,
          book:books (
            id,
            title,
            author
          ),
          chef:chefs (
            id,
            name,
            website
          )
        `)
        .eq('id', recipePreview.id)
        .single();

      if (recipeError) throw recipeError;

      const formattedRecipe: Recipe = {
        id: recipeData.id,
        title: recipeData.title,
        description: recipeData.description || '',
        image_url: recipeData.image_url || '',
        recipe_type: recipeData.recipe_type || '',
        prep_time_min: recipeData.prep_time_min || 0,
        cook_time_min: recipeData.cook_time_min || 0,
        instructions: recipeData.instructions || [],
        ingredients: recipeData.ingredients || [],
        chef_name: recipeData.chef?.name || recipeData.chef_name,  // Use chef relationship
        chef_id: recipeData.chef_id,
        times_cooked: recipeData.times_cooked || 0,
        book_id: recipeData.book_id,
        page_number: recipeData.page_number,
        book_title: recipeData.book?.title,
        book_author: recipeData.book?.author,
        servings: recipeData.servings || undefined,
      };


      setRecipe(formattedRecipe);

      const sections = await getInstructionSections(recipeData.id);
      if (sections && sections.length > 0) {
        setInstructionSections(sections);
      }

      // Precompute ingredient-to-step mapping for expandable steps
      try {
        const mapping = mapIngredientsToSteps(recipeData);
        setStepIngredients(mapping);
      } catch (e) {
        // Non-critical — step expansion just won't show ingredients
      }

      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select(`
          *,
          ingredient:ingredients (
            id,
            name,
            family
          )
        `)
        .eq('recipe_id', recipeData.id)
        .order('sequence_order');

      if (ingredientsError) throw ingredientsError;

      // Merge group_name from the recipes.ingredients JSONB
      const rawIngredients = recipeData.ingredients || [];

      const formattedIngredients = ingredientsData.map((item: any) => {
        // Find matching ingredient in JSONB by original_text or sequence_order
        const jsonbMatch = rawIngredients.find((raw: any) => {
          if (typeof raw === 'string') return false;
          return raw.original_text === item.original_text
              || raw.sequence_order === item.sequence_order;
        });

        return {
          id: item.ingredient_id,
          name: item.ingredient?.name || 'Unknown',
          displayText: item.original_text,
          family: item.ingredient?.family || 'Other',
          quantity_amount: item.quantity_amount,
          quantity_unit: item.quantity_unit,
          preparation: item.preparation,
          group_name: typeof jsonbMatch === 'object' ? (jsonbMatch.group_name || null) : null,
          group_number: typeof jsonbMatch === 'object' ? (jsonbMatch.group_number ?? null) : null,
        };
      });

      setIngredients(formattedIngredients);

    } catch (error) {
      console.error('Error loading recipe:', error);
      Alert.alert('Error', 'Failed to load recipe details');
    } finally {
      setLoading(false);
    }
  };

  const loadPantryItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);
      const items = await getPantryItems(user.id);
      setPantryItems(items);

      // Check Cook Soon status
      try {
        const saved = await isInCookSoon(user.id, recipePreview.id);
        setIsCookSoon(saved);
      } catch (_) {}
    } catch (error) {
      console.error('Error loading pantry:', error);
    }
  };

  const convertIngredientsToSystem = async () => {
    const converted = await convertRecipeIngredients(
      ingredients,
      currentUnitSystem,
      currentScale
    );
    setConvertedIngredients(converted);
  };

  useEffect(() => {
    if (ingredients.length > 0 && pantryItems.length > 0) {
      const missing = ingredients.filter(ingredient => {
        const scaled = (ingredient.quantity_amount || 0) * currentScale;
        const inPantry = pantryItems.find(item => item.ingredient_id === ingredient.id);
        
        if (!inPantry) return true;
        
        const pantryQuantity = inPantry.quantity_display || 0;
        return pantryQuantity < scaled;
      });
      
      setMissingIngredients(missing);
    }
  }, [ingredients, pantryItems, currentScale]);

  const handleBookPress = () => {
    if (recipe?.book_id) {
      navigation.navigate('BookView' as any, { bookId: recipe.book_id });
    }
  };

  const handleChefPress = () => {
    if (recipe?.chef_name) {
      // Get chef_id from the recipe data
      const chefId = (recipe as any).chef_id;
      navigation.navigate('AuthorView' as any, { 
        chefName: recipe.chef_name,
        chefId: chefId  // Pass the chef ID
      });
    }
  };

  const handleScalePickerConfirm = () => {
    setCurrentScale(pickerScale);
    setShowScalePicker(false);
  };

  const handleIngredientPress = (
    ingredient: Ingredient,
    event: any
  ) => {
    const { nativeEvent } = event;
    const { pageX, pageY } = nativeEvent;

    const formatted = formatIngredientForPopup(ingredient, currentScale);
    
    setIngredientPopup({
      visible: true,
      ingredientName: formatted.name,
      quantity: formatted.quantity,
      preparation: formatted.preparation,
      position: { x: pageX, y: pageY }
    });
  };

  // Annotation handlers
  const handleEditIngredient = (index: number) => {
    setEditingIngredientIndex(index);
  };

  const handleSaveIngredientEdit = async (index: number, newText: string) => {
    if (!currentUserId || !recipe) return;

    const ingredient = displayIngredients[index];
    
    const result = await saveIngredientEdit(
      currentUserId,
      recipe.id,
      ingredient.id,
      index,
      ingredient.displayText,
      newText
    );

    if (result.success) {
      await loadAnnotations();
      setEditingIngredientIndex(null);
    } else {
      Alert.alert('Error', 'Failed to save edit: ' + (result.error || 'Unknown error'));
      setEditingIngredientIndex(null);
    }
  };

  const handleCancelIngredientEdit = () => {
    setEditingIngredientIndex(null);
  };

  const handleEditInstruction = (index: number, sectionId?: string) => {
    setEditingInstructionIndex(index);
    setEditingInstructionSection(sectionId || null);
  };

  const handleSaveInstructionEdit = async (index: number, newText: string, sectionId?: string) => {
    if (!currentUserId || !recipe) return;

    // Get original text
    let originalText: string;
    if (sectionId) {
      const section = instructionSections.find(s => s.id === sectionId);
      const step = section?.steps.find(s => s.step_number - 1 === index);
      originalText = step?.instruction || '';
    } else {
      originalText = getInstructionText(recipe.instructions[index]);
    }

    const result = await saveInstructionEdit(
      currentUserId,
      recipe.id,
      index,
      originalText,
      newText,
      undefined,
      sectionId
    );

    if (result.success) {
      await loadAnnotations();
      setEditingInstructionIndex(null);
      setEditingInstructionSection(null);
      
      // Check for ingredient changes
      checkForIngredientChanges(originalText, newText);
    } else {
      Alert.alert('Error', 'Failed to save edit: ' + (result.error || 'Unknown error'));
      setEditingInstructionIndex(null);
      setEditingInstructionSection(null);
    }
  };

  const handleCancelInstructionEdit = () => {
    setEditingInstructionIndex(null);
    setEditingInstructionSection(null);
  };

  const handleDeleteInstruction = async (index: number, sectionId?: string) => {
    if (!currentUserId || !recipe) return;

    // Get original text
    let originalText: string;
    if (sectionId) {
      const section = instructionSections.find(s => s.id === sectionId);
      const step = section?.steps.find(s => s.step_number - 1 === index);
      originalText = step?.instruction || '';
    } else {
      originalText = getInstructionText(recipe.instructions[index]);
    }

    const result = await deleteInstruction(
      currentUserId,
      recipe.id,
      index,
      originalText,
      sectionId
    );

    if (result.success) {
      await loadAnnotations();
      setEditingInstructionIndex(null);
      setEditingInstructionSection(null);
    } else {
      Alert.alert('Error', 'Failed to delete instruction: ' + (result.error || 'Unknown error'));
    }
  };

  const checkForIngredientChanges = (originalText: string, newText: string) => {
    // Simple ingredient detection - extract ingredient names
    const originalIngredients = ingredients.map(i => i.name.toLowerCase());
    const wordsInOriginal = new Set(
      originalText.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );
    const wordsInNew = new Set(
      newText.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    // Check if any ingredient appears in new but not in original
    const potentialNewIngredients = Array.from(wordsInNew).filter(
      word => originalIngredients.some(ing => ing.includes(word)) && 
              !Array.from(wordsInOriginal).some(w => w === word)
    );

    // Check if any ingredient was removed
    const potentialRemovedIngredients = Array.from(wordsInOriginal).filter(
      word => originalIngredients.some(ing => ing.includes(word)) && 
              !Array.from(wordsInNew).some(w => w === word)
    );

    if (potentialNewIngredients.length > 0 || potentialRemovedIngredients.length > 0) {
      Alert.alert(
        'Ingredient Change Detected',
        'We noticed you may have changed ingredients in this step. Would you like to update the ingredients list as well?',
        [
          { text: 'No, Keep As Is', style: 'cancel' },
          { 
            text: 'Yes, Update', 
            onPress: () => {
              // TODO: Navigate to ingredients section or show edit modal
              Alert.alert('Info', 'This feature will allow you to edit the ingredients list. For now, please manually update the ingredients section.');
            }
          }
        ]
      );
    }
  };

  const moveStepUp = (index: number) => {
    // TODO: Implement step reordering
    Alert.alert('Coming Soon', 'Drag to reorder will be implemented in the next update');
  };

  const moveStepDown = (index: number) => {
    // TODO: Implement step reordering
    Alert.alert('Coming Soon', 'Drag to reorder will be implemented in the next update');
  };

  // Apply annotations to data
  const displayIngredients = applyIngredientAnnotations(ingredients, annotations, viewMode);
  const displayInstructions = recipe?.instructions ?
    applyInstructionAnnotations(recipe.instructions, annotations, viewMode) : [];

  // Step keys for ‹/› navigation
  const stepKeys = buildStepKeys(instructionSections, displayInstructions);

  // Sticky bar visibility (progressive)
  const stickyOffset = 35;
  const showStickyIngredients = scrollY >= ingredientsHeaderY + stickyOffset && ingredientsHeaderY > 0;
  const showStickyPrepNow = scrollY >= preparationHeaderY + stickyOffset && preparationHeaderY > 0;
  // Once PREPARATION has been seen, keep it in the sticky bar permanently
  if (showStickyPrepNow) hasSeenPreparation.current = true;
  const showStickyPrep = showStickyPrepNow || (hasSeenPreparation.current && showStickyIngredients);
  const showStickyBar = showStickyIngredients;

  // Top bar title visibility (show only when actual title scrolled offscreen)
  const showTopBarTitle = scrollY >= titleBottomY && titleBottomY > 0;

  // Cook Soon toggle
  const handleToggleCookSoon = async () => {
    if (!currentUserId || !recipe) return;
    try {
      if (isCookSoon) {
        await removeFromCookSoon(currentUserId, recipe.id);
        setIsCookSoon(false);
      } else {
        await addToCookSoon(currentUserId, recipe.id);
        setIsCookSoon(true);
      }
    } catch (_) {}
  };

  // Focus mode handlers
  const handleStepFocus = (stepKey: string) => {
    if (focusedStepKey === stepKey) {
      setFocusedStepKey(null);
    } else {
      setFocusedStepKey(stepKey);
      // No auto-scroll on tap — step expands in place
    }
  };

  const handleStepNav = (direction: 'prev' | 'next') => {
    if (!focusedStepKey) return;
    const currentIdx = stepKeys.indexOf(focusedStepKey);
    if (currentIdx === -1) return;
    const newIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (newIdx < 0 || newIdx >= stepKeys.length) return;
    const newKey = stepKeys[newIdx];
    setFocusedStepKey(newKey);
    const stepY = stepPositionsRef.current.get(newKey);
    if (stepY !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: Math.max(0, stepY - 80), animated: true });
    }
  };

  const handleStepLayout = (stepKey: string, y: number) => {
    stepPositionsRef.current.set(stepKey, y);
  };

  const focusedIdx = focusedStepKey ? stepKeys.indexOf(focusedStepKey) : -1;
  const canGoPrev = focusedIdx > 0;
  const canGoNext = focusedIdx >= 0 && focusedIdx < stepKeys.length - 1;

  if (loading || !recipe) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0d9488" />
      </SafeAreaView>
    );
  }

  const totalTime = recipe.prep_time_min + recipe.cook_time_min;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Bar: ← + Title + Save + ⋮ */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        {showTopBarTitle ? (
          <TouchableOpacity
            style={styles.topTitleContainer}
            onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
            activeOpacity={0.7}
          >
            <Text style={styles.topTitle} numberOfLines={1} ellipsizeMode="tail">
              {toTitleCase(recipe.title)}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.topTitleContainer} />
        )}

        <View style={styles.topRightButtons}>
          <TouchableOpacity
            style={styles.topBarIcon}
            onPress={handleToggleCookSoon}
            activeOpacity={0.7}
          >
            {isCookSoon ? <SaveFilledIcon size={23} /> : <SaveOutlineIcon size={23} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.overflowButton}
            onPress={() => setShowOverflowMenu(true)}
          >
            <Text style={styles.overflowButtonText}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Overflow Menu */}
      <Modal
        visible={showOverflowMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOverflowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowOverflowMenu(false)}
        >
          <View style={styles.menuContainer}>
            {/* View mode options */}
            {(['clean', 'original', 'markup'] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={styles.menuItem}
                onPress={() => {
                  setViewMode(mode);
                  setShowOverflowMenu(false);
                }}
              >
                <Text style={[styles.menuItemText, viewMode === mode && styles.menuItemTextActive]}>
                  {viewMode === mode ? '✓  ' : '    '}
                  {mode === 'clean' && 'Clean View'}
                  {mode === 'original' && 'Original View'}
                  {mode === 'markup' && 'Markup View'}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Edit Recipe */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsEditMode(!isEditMode);
                setShowOverflowMenu(false);
              }}
            >
              <Text style={styles.menuItemText}>
                {isEditMode ? '✓  ' : '    '}Edit Recipe
              </Text>
            </TouchableOpacity>

            {/* Unit Conversion */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowOverflowMenu(false);
                setShowUnitPicker(true);
              }}
            >
              <Text style={styles.menuItemText}>
                {'    '}Unit Conversion{currentUnitSystem !== 'original' ? ` (${UNIT_SYSTEMS.find(u => u.value === currentUnitSystem)?.label})` : ''}
              </Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Meal Plan */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowOverflowMenu(false);
                setShowMealModal(true);
              }}
            >
              <Text style={styles.menuItemText}>{'    '}+ Meal Plan</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Progressive sticky section bar */}
      {showStickyBar && (
        <View>
          <View style={styles.stickyAccentLine} />
          <View style={styles.stickyBar}>
            {showStickyIngredients && (
              <TouchableOpacity
                style={styles.stickyTab}
                onPress={() => scrollViewRef.current?.scrollTo({ y: Math.max(0, ingredientsHeaderY + stickyOffset + 30), animated: true })}
              >
                <Text style={[styles.stickyTabText, !showStickyPrepNow && styles.stickyTabTextActive]}>
                  INGREDIENTS
                  {displayIngredients.length > 0 && (
                    <Text style={styles.stickyPantryCount}>
                      {'  '}{displayIngredients.filter(ing => {
                        const scaled = (ing.quantity_amount || 0) * currentScale;
                        const inPantry = pantryItems.find(p => p.ingredient_id === ing.id);
                        return inPantry && (inPantry.quantity_display || 0) >= scaled;
                      }).length}/{displayIngredients.length}
                    </Text>
                  )}
                </Text>
              </TouchableOpacity>
            )}
            {showStickyPrep && (
              <TouchableOpacity
                style={[styles.stickyTab, styles.stickyTabRight]}
                onPress={() => scrollViewRef.current?.scrollTo({ y: Math.max(0, preparationHeaderY + stickyOffset + 35), animated: true })}
              >
                <Text style={[styles.stickyTabText, showStickyPrepNow && styles.stickyTabTextActive]}>PREPARATION</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        {/* Header: Image + Title + Chef + Book + Time + Description */}
        <RecipeHeader
          recipe={recipe}
          totalTime={totalTime}
          onBookPress={handleBookPress}
          onChefPress={handleChefPress}
          onShowMealModal={() => setShowMealModal(true)}
          onToggleCookSoon={handleToggleCookSoon}
          isCookSoon={isCookSoon}
          onTitleLayout={(y) => setTitleBottomY(y)}
        />

        {/* Nutrition — expandable row below metadata */}
        <TouchableOpacity
          style={styles.nutritionRow}
          onPress={() => setNutritionExpanded(!nutritionExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.nutritionRowArrow}>{nutritionExpanded ? '▾' : '▸'}</Text>
          <Text style={styles.nutritionRowText}>Nutritional Information</Text>
        </TouchableOpacity>
        {nutritionExpanded && recipe && (
          <View style={styles.nutritionPanel}>
            <RecipeNutritionPanel recipeId={recipe.id} />
          </View>
        )}

        {/* Scale and Convert Controls */}
        <ScaleConvertControls
          currentScale={currentScale}
          onScaleChange={setCurrentScale}
          onShowScalePicker={() => setShowScalePicker(true)}
        />

        {/* Ingredients Section */}
        <IngredientsSection
          displayIngredients={displayIngredients}
          currentScale={currentScale}
          currentUnitSystem={currentUnitSystem}
          convertedIngredients={convertedIngredients}
          pantryItems={pantryItems}
          missingCount={missingIngredients.length}
          isEditMode={isEditMode}
          viewMode={viewMode}
          editingIngredientIndex={editingIngredientIndex}
          onEditIngredient={handleEditIngredient}
          onSaveIngredientEdit={handleSaveIngredientEdit}
          onCancelIngredientEdit={handleCancelIngredientEdit}
          onShowMissingListModal={() => {
            setListModalMode('missing');
            setShowListModal(true);
          }}
          onShowAllListModal={() => {
            setListModalMode('all');
            setShowListModal(true);
          }}
          onHeaderLayout={(y) => setIngredientsHeaderY(y)}
        />

        {/* Preparation Section */}
        <PreparationSection
          instructionSections={instructionSections}
          displayInstructions={displayInstructions}
          ingredients={displayIngredients}
          isEditMode={isEditMode}
          viewMode={viewMode}
          annotations={annotations}
          onEditInstruction={handleEditInstruction}
          onSaveInstructionEdit={handleSaveInstructionEdit}
          onCancelInstructionEdit={handleCancelInstructionEdit}
          onDeleteInstruction={handleDeleteInstruction}
          editingInstructionIndex={editingInstructionIndex}
          editingInstructionSection={editingInstructionSection}
          onIngredientPress={handleIngredientPress}
          onMoveStepUp={moveStepUp}
          onMoveStepDown={moveStepDown}
          currentScale={currentScale}
          stepIngredients={stepIngredients}
          focusedStepKey={focusedStepKey}
          onStepFocus={handleStepFocus}
          onStepLayout={handleStepLayout}
          onHeaderLayout={(y) => setPreparationHeaderY(y)}
        />

        {/* Start Cooking Button — outlined style */}
        <TouchableOpacity
          style={styles.startCookingButton}
          onPress={() => navigation.navigate('Cooking', {
            recipe: recipe,
            planItemId,
            mealId,
            mealTitle,
          })}
        >
          <Text style={styles.startCookingButtonText}>Start Cooking</Text>
        </TouchableOpacity>

        {/* Your Notes section */}
        <View style={styles.notesSection}>
          <Text style={styles.notesSectionTitle}>Your Private Notes</Text>
          {annotations.filter(a => a.field_type === 'note').length > 0 ? (
            annotations.filter(a => a.field_type === 'note').map((note, idx) => (
              <View key={`note-${idx}`} style={styles.noteItem}>
                <Text style={styles.noteText}>{note.annotated_value}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.notesEmpty}>
              You haven't added any notes to this recipe yet.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Floating step navigation buttons */}
      {focusedStepKey !== null && (
        <View style={styles.floatingNav}>
          <TouchableOpacity
            style={[styles.floatingBtnPrev, !canGoPrev && styles.floatingBtnDisabled]}
            onPress={() => handleStepNav('prev')}
            disabled={!canGoPrev}
            activeOpacity={0.7}
          >
            <Text style={[styles.floatingBtnPrevText, !canGoPrev && styles.floatingBtnTextDisabled]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatingBtnNext, !canGoNext && styles.floatingBtnDisabled]}
            onPress={() => handleStepNav('next')}
            disabled={!canGoNext}
            activeOpacity={0.7}
          >
            <Text style={[styles.floatingBtnNextText, !canGoNext && styles.floatingBtnTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scale Picker Modal */}
      <Modal
        visible={showScalePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScalePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Scale</Text>
            <ScrollView style={styles.pickerScroll}>
              {PICKER_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.pickerOption,
                    pickerScale === option && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setPickerScale(option)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      pickerScale === option && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {option}x
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.pickerButtons}>
              <TouchableOpacity
                style={styles.pickerCancelButton}
                onPress={() => setShowScalePicker(false)}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickerConfirmButton}
                onPress={handleScalePickerConfirm}
              >
                <Text style={styles.pickerConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Unit Picker Modal */}
      <Modal
        visible={showUnitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUnitPicker(false)}
        >
          <View style={styles.unitPickerContainer}>
            <Text style={styles.pickerTitle}>Select Unit System</Text>
            {UNIT_SYSTEMS.map(system => (
              <TouchableOpacity
                key={system.value}
                style={[
                  styles.unitPickerOption,
                  currentUnitSystem === system.value && styles.unitPickerOptionSelected,
                ]}
                onPress={() => {
                  setCurrentUnitSystem(system.value);
                  setShowUnitPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.unitPickerOptionText,
                    currentUnitSystem === system.value && styles.unitPickerOptionTextSelected,
                  ]}
                >
                  {system.label}
                </Text>
                {currentUnitSystem === system.value && (
                  <Text style={styles.unitPickerCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Ingredient Popup */}
      <IngredientPopup
        visible={ingredientPopup.visible}
        ingredientName={ingredientPopup.ingredientName}
        quantity={ingredientPopup.quantity}
        preparation={ingredientPopup.preparation}
        position={ingredientPopup.position}
        onClose={() => setIngredientPopup({ ...ingredientPopup, visible: false })}
      />

      {/* Add to List Modal */}
      <AddRecipeToListModal
        visible={showListModal}
        onClose={() => setShowListModal(false)}
        recipe={recipe}
        ingredients={listModalMode === 'missing' ? missingIngredients : ingredients}
        scale={currentScale}
        userId={currentUserId || ''}
      />

      {/* Add to Meal Modal */}
      {currentUserId && recipe && (
        <SelectMealForRecipeModal
          visible={showMealModal}
          onClose={() => setShowMealModal(false)}
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          currentUserId={currentUserId}
          onSuccess={() => {}}
          onCreateNewMeal={() => {}}
        />
      )}
    </SafeAreaView>
  );
}

// Styles (continuing from existing styles)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 4,
  },
  backButtonText: {
    fontSize: 22,
    color: '#0d9488',
  },
  topTitleContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  topRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  topBarIcon: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  overflowButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  overflowButtonText: {
    fontSize: 22,
    color: '#333',
    fontWeight: '700',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    position: 'absolute',
    top: 52,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  menuItem: {
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    color: '#333',
  },
  menuItemTextActive: {
    color: '#0d9488',
    fontWeight: '500',
  },
  // Progressive sticky section bar
  stickyAccentLine: {
    height: 3,
    backgroundColor: '#0f172a',
    marginHorizontal: 16,
  },
  stickyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  stickyTab: {
  },
  stickyTabRight: {
    marginLeft: 'auto',
  },
  stickyTabText: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1.5,
    color: '#94a3b8',
  },
  stickyTabTextActive: {
    fontWeight: '700',
    color: '#111',
  },
  stickyPantryCount: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0,
    color: '#0d9488',
  },
  // Floating step nav buttons
  floatingNav: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  floatingBtnPrev: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingBtnNext: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingBtnDisabled: {
    opacity: 0.35,
  },
  floatingBtnPrevText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#0d9488',
    marginTop: -2,
  },
  floatingBtnNextText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#fff',
    marginTop: -2,
  },
  floatingBtnTextDisabled: {
    opacity: 0.5,
  },
  // Nutrition expandable row
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  nutritionRowArrow: {
    fontSize: 13,
    color: '#94a3b8',
  },
  nutritionRowText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  nutritionPanel: {
    paddingHorizontal: 0,
  },
  // Start Cooking — outlined style (NYT)
  startCookingButton: {
    borderWidth: 2,
    borderColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 24,
  },
  startCookingButtonText: {
    color: '#222',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Your Notes section
  notesSection: {
    paddingHorizontal: 16,
    marginTop: 32,
    marginBottom: 24,
  },
  notesSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#111',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  noteItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  noteText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  notesEmpty: {
    fontSize: 15,
    color: '#999',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '50%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerScroll: {
    maxHeight: 300,
  },
  pickerOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerOptionSelected: {
    backgroundColor: '#f0fdfa',
  },
  pickerOptionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  pickerOptionTextSelected: {
    color: '#0d9488',
    fontWeight: '600',
  },
  pickerButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  pickerCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  pickerConfirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#0d9488',
    alignItems: 'center',
  },
  pickerConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  unitPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 40,
    marginTop: 100,
  },
  unitPickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  unitPickerOptionSelected: {
    backgroundColor: '#f0fdfa',
  },
  unitPickerOptionText: {
    fontSize: 16,
  },
  unitPickerOptionTextSelected: {
    color: '#0d9488',
    fontWeight: '600',
  },
  unitPickerCheck: {
    fontSize: 16,
    color: '#0d9488',
  },
});