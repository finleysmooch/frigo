// screens/RecipeDetailScreen.tsx
// UPDATED VERSION: November 14, 2025
// New Features:
// - Unit conversion (Original/Metric/Imperial)
// - Clickable ingredients in instructions
// - Full annotation/edit mode with:
//   * Edit ingredients
//   * Edit/delete/reorder instructions
//   * Markup view display
//   * Ingredient change detection

import { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent
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
import InlineEditableIngredient from '../components/InlineEditableIngredient';
import InlineEditableInstruction from '../components/InlineEditableInstruction';
import MarkupText from '../components/MarkupText';
import { 
  splitInstructionIntoParts,
  formatIngredientForPopup,
  TextPart
} from '../utils/ingredientMatcher';
import { 
  convertUnit,
  convertRecipeIngredients,
  UnitSystem,
  ConversionResult
} from '../lib/services/unitConverter';
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
}

const FIXED_SCALE_OPTIONS = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '3x', value: 3 },
];

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

function parseAndScaleQuantity(text: string, scale: number): string {
  if (scale === 1) return text;
  
  const parts = text.split(' ');
  const firstPart = parts[0];
  
  const fractionMap: { [key: string]: number } = {
    '¼': 0.25, '½': 0.5, '¾': 0.75,
    '⅓': 0.333, '⅔': 0.667,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  };
  
  let numericValue = 0;
  let hasNumber = false;
  
  if (fractionMap[firstPart]) {
    numericValue = fractionMap[firstPart];
    hasNumber = true;
  } else {
    const numberMatch = firstPart.match(/^(\d+(?:\.\d+)?)([\u00BC-\u00BE\u2150-\u215E])?/);
    if (numberMatch) {
      numericValue = parseFloat(numberMatch[1]);
      if (numberMatch[2] && fractionMap[numberMatch[2]]) {
        numericValue += fractionMap[numberMatch[2]];
      }
      hasNumber = true;
    }
  }
  
  if (hasNumber) {
    const scaled = numericValue * scale;
    const restOfText = parts.slice(1).join(' ');
    
    if (scaled % 1 === 0) {
      return `${scaled} ${restOfText}`;
    } else if (scaled % 0.5 === 0) {
      const whole = Math.floor(scaled);
      return whole > 0 ? `${whole}½ ${restOfText}` : `½ ${restOfText}`;
    } else if (scaled % 0.25 === 0) {
      const whole = Math.floor(scaled);
      const fraction = scaled - whole;
      const fractionChar = fraction === 0.25 ? '¼' : fraction === 0.75 ? '¾' : '';
      return whole > 0 ? `${whole}${fractionChar} ${restOfText}` : `${fractionChar} ${restOfText}`;
    } else {
      return `${scaled.toFixed(1)} ${restOfText}`;
    }
  }
  
  return text;
}

export default function RecipeDetailScreen({ navigation, route }: Props) {
  const { recipe: recipePreview } = route.params;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [showScalePicker, setShowScalePicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [pickerScale, setPickerScale] = useState(4);

  const [ingredientsCollapsed, setIngredientsCollapsed] = useState(false);
  const [instructionsCollapsed, setInstructionsCollapsed] = useState(false);
  
  const [scrollY, setScrollY] = useState(0);
  const [ingredientsHeaderY, setIngredientsHeaderY] = useState(0);
  const [instructionsHeaderY, setInstructionsHeaderY] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

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
  const [showViewModeMenu, setShowViewModeMenu] = useState(false);
  
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
      };

      setRecipe(formattedRecipe);

      const sections = await getInstructionSections(recipeData.id);
      console.log('📋 Instruction sections loaded:', sections);
      console.log('📋 Section count:', sections?.length || 0);
      if (sections && sections.length > 0) {
        console.log('📋 First section:', JSON.stringify(sections[0], null, 2));
        console.log('📋 First section steps:', sections[0].steps?.length || 0);
        setInstructionSections(sections);
        setExpandedSections(sections.map(s => s.id));
      } else {
        console.log('⚠️ No instruction sections found - check database!');
        console.log('⚠️ Recipe ID:', recipeData.id);
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

      const formattedIngredients = ingredientsData.map((item: any) => ({
        id: item.ingredient_id,
        name: item.ingredient?.name || 'Unknown',
        displayText: item.original_text,
        family: item.ingredient?.family || 'Other',
        quantity_amount: item.quantity_amount,
        quantity_unit: item.quantity_unit,
        preparation: item.preparation,
      }));

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

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    setScrollY(currentScrollY);
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

  const renderInstructionWithClickableIngredients = (
    instruction: string,
    stepNumber: number,
    annotation?: any
  ) => {
    // If in markup mode and has annotation, show markup
    if (viewMode === 'markup' && annotation) {
      return (
        <View style={styles.stepTextContainer}>
          <MarkupText
            original={annotation.original}
            edited={annotation.new}
            notes={annotation.notes}
            isDeleted={annotation.isDeleted}
          />
        </View>
      );
    }

    const parts = splitInstructionIntoParts(instruction, ingredients);

    return (
      <Text style={styles.stepText}>
        {parts.map((part, index) => {
          if (part.type === 'ingredient' && part.ingredient) {
            return (
              <Text
                key={`${stepNumber}-${index}`}
                style={styles.clickableIngredient}
                onPress={(e) => handleIngredientPress(part.ingredient!, e)}
              >
                {part.text}
              </Text>
            );
          }
          return (
            <Text key={`${stepNumber}-${index}`}>{part.text}</Text>
          );
        })}
      </Text>
    );
  };

  const showIngredientsSticky = scrollY >= ingredientsHeaderY - 50;
  const showInstructionsSticky = scrollY >= instructionsHeaderY - 50;

  // Apply annotations to data
  const displayIngredients = applyIngredientAnnotations(ingredients, annotations, viewMode);
  const displayInstructions = recipe?.instructions ? 
    applyInstructionAnnotations(recipe.instructions, annotations, viewMode) : [];

  const groupedIngredients = displayIngredients.reduce((acc, ingredient) => {
    const family = ingredient.family || 'Other';
    if (!acc[family]) {
      acc[family] = [];
    }
    acc[family].push(ingredient);
    return acc;
  }, {} as Record<string, Ingredient[]>);

  const sortedFamilies = Object.keys(groupedIngredients).sort((a, b) => {
    const order = ['Protein', 'Vegetables', 'Pantry', 'Spices', 'Other'];
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  if (loading || !recipe) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  const totalTime = recipe.prep_time_min + recipe.cook_time_min;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Compact Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <View style={styles.topRightButtons}>
          <TouchableOpacity
            style={styles.topSmallButton}
            onPress={() => setShowViewModeMenu(true)}
          >
            <Text style={styles.topSmallButtonText}>
              {viewMode === 'original' ? '📖' : viewMode === 'markup' ? '✏️' : '👁️'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.topSmallButton,
              isEditMode && styles.topSmallButtonActive
            ]}
            onPress={() => setIsEditMode(!isEditMode)}
          >
            <Text style={styles.topSmallButtonText}>
              {isEditMode ? '✓' : '✏️'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.topStartCookingButton}
            onPress={() => navigation.navigate('Cooking', { recipeId: recipe.id })}
          >
            <Text style={styles.topStartCookingButtonText}>Cook</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* View Mode Menu */}
      <Modal
        visible={showViewModeMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowViewModeMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowViewModeMenu(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>View Mode</Text>
            
            {(['original', 'clean', 'markup'] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.menuItem,
                  viewMode === mode && styles.menuItemActive
                ]}
                onPress={() => {
                  setViewMode(mode);
                  setShowViewModeMenu(false);
                }}
              >
                <Text style={styles.menuItemText}>
                  {mode === 'original' && '📖 Original'}
                  {mode === 'clean' && '👁️ Clean'}
                  {mode === 'markup' && '✏️ Markup'}
                </Text>
                {viewMode === mode && (
                  <Text style={styles.menuItemCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sticky Headers */}
      {showIngredientsSticky && !showInstructionsSticky && (
        <TouchableOpacity
          style={styles.stickyHeader}
          onPress={() => setIngredientsCollapsed(!ingredientsCollapsed)}
        >
          <View style={styles.stickyHeaderLeft}>
            <Text style={styles.stickySectionTitle}>
              🥬 Ingredients {currentScale > 1 && `(${currentScale}x)`}
            </Text>
            <Text style={styles.stickySectionIcon}>
              {ingredientsCollapsed ? '▶' : '▼'}
            </Text>
          </View>
          <View style={styles.stickyHeaderButtons}>
            {missingIngredients.length > 0 && (
              <TouchableOpacity
                style={styles.stickyInlineButton}
                onPress={() => setShowListModal(true)}
              >
                <Text style={styles.stickyInlineButtonText}>
                  + Missing ({missingIngredients.length})
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.stickyInlineButton}
              onPress={() => setShowListModal(true)}
            >
              <Text style={styles.stickyInlineButtonText}>+ All</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {showInstructionsSticky && (
        <TouchableOpacity
          style={styles.stickyHeader}
          onPress={() => setInstructionsCollapsed(!instructionsCollapsed)}
        >
          <View style={styles.stickyHeaderLeft}>
            <Text style={styles.stickySectionTitle}>📝 Instructions</Text>
            <Text style={styles.stickySectionIcon}>
              {instructionsCollapsed ? '▶' : '▼'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <ScrollView 
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header Image */}
        {recipe.image_url && (
          <Image source={{ uri: recipe.image_url }} style={styles.headerImage} />
        )}

        {/* Title & Meta */}
        <View style={styles.header}>
          <Text style={styles.title}>{recipe.title}</Text>
          
          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
          )}

          <View style={styles.metaRow}>
            {recipe.prep_time_min > 0 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>🔪 Prep: {recipe.prep_time_min} min</Text>
              </View>
            )}
            {recipe.cook_time_min > 0 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>🔥 Cook: {recipe.cook_time_min} min</Text>
              </View>
            )}
            {totalTime > 0 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>⏱️ Total: {totalTime} min</Text>
              </View>
            )}
            {recipe.times_cooked !== undefined && recipe.times_cooked > 0 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>👨‍🍳 Cooked {recipe.times_cooked}x</Text>
              </View>
            )}
          </View>

          {(recipe.book_title || recipe.chef_name) && (
            <View style={styles.sourceRow}>
              {recipe.book_title && (
                <TouchableOpacity onPress={handleBookPress}>
                  <Text style={styles.sourceText}>
                    📚 {recipe.book_title}
                    {recipe.page_number && ` (p. ${recipe.page_number})`}
                  </Text>
                </TouchableOpacity>
              )}
              {recipe.chef_name && (
                <TouchableOpacity onPress={handleChefPress}>
                  <Text style={styles.sourceText}>
                    👨‍🍳 {recipe.chef_name}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Scale and Convert Controls */}
        <View style={styles.controlsContainer}>
          <View style={styles.controlsRow}>
            <View style={styles.scaleSection}>
              <Text style={styles.scaleLabel}>Scale:</Text>
              <View style={styles.scaleButtons}>
                {FIXED_SCALE_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.scaleButton,
                      currentScale === option.value && styles.scaleButtonActive,
                    ]}
                    onPress={() => setCurrentScale(option.value)}
                  >
                    <Text
                      style={[
                        styles.scaleButtonText,
                        currentScale === option.value && styles.scaleButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.scaleButton,
                    currentScale > 3 && styles.scaleButtonActive,
                  ]}
                  onPress={() => setShowScalePicker(true)}
                >
                  <Text
                    style={[
                      styles.scaleButtonText,
                      currentScale > 3 && styles.scaleButtonTextActive,
                    ]}
                  >
                    {currentScale > 3 ? `${currentScale}x` : 'More'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.convertSection}>
              <Text style={styles.scaleLabel}>Convert:</Text>
              <TouchableOpacity
                style={styles.unitDropdown}
                onPress={() => setShowUnitPicker(true)}
              >
                <Text style={styles.unitDropdownText}>
                  {UNIT_SYSTEMS.find(u => u.value === currentUnitSystem)?.label}
                </Text>
                <Text style={styles.unitDropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Ingredients Section */}
        <View 
          onLayout={(event: LayoutChangeEvent) => {
            setIngredientsHeaderY(event.nativeEvent.layout.y);
          }}
        >
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setIngredientsCollapsed(!ingredientsCollapsed)}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>
                🥬 Ingredients {currentScale > 1 && `(${currentScale}x)`}
                {currentUnitSystem !== 'original' && ` • ${UNIT_SYSTEMS.find(u => u.value === currentUnitSystem)?.label}`}
              </Text>
              <Text style={styles.collapseIcon}>
                {ingredientsCollapsed ? '▶' : '▼'}
              </Text>
            </View>
            <View style={styles.sectionHeaderButtons}>
              {missingIngredients.length > 0 && (
                <TouchableOpacity
                  style={styles.inlineButton}
                  onPress={() => setShowListModal(true)}
                >
                  <Text style={styles.inlineButtonText}>
                    + Missing ({missingIngredients.length})
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.inlineButton}
                onPress={() => setShowListModal(true)}
              >
                <Text style={styles.inlineButtonText}>+ All</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          
          {!ingredientsCollapsed && (
            <View style={styles.sectionContent}>
              {sortedFamilies.map((family) => (
                <View key={family} style={styles.familyGroup}>
                  <Text style={styles.familyHeader}>{family}</Text>
                  {groupedIngredients[family].map((ingredient: Ingredient, familyIndex: number) => {
                    // Get the global index from displayIngredients
                    const globalIndex = displayIngredients.findIndex(i => i.id === ingredient.id);
                    
                    const scaledAmount = (ingredient.quantity_amount || 0) * currentScale;
                    const inPantry = pantryItems.find(item => item.ingredient_id === ingredient.id);
                    const hasSufficient = inPantry && (inPantry.quantity_display || 0) >= scaledAmount;

                    // Get display text - use original scaling if no conversion
                    let displayText: string;
                    
                    if (currentUnitSystem === 'original') {
                      // No unit conversion, just scale the quantity
                      displayText = parseAndScaleQuantity(ingredient.displayText, currentScale);
                    } else {
                      // Try to use converted version
                      const converted = convertedIngredients.find(c => c.displayText === ingredient.displayText);
                      displayText = converted?.converted?.displayText || parseAndScaleQuantity(ingredient.displayText, currentScale);
                    }

                    // Check if this ingredient is being edited
                    const isEditing = isEditMode && editingIngredientIndex === globalIndex;

                    // Show inline editor if editing this ingredient
                    if (isEditing) {
                      return (
                        <InlineEditableIngredient
                           key={`${family}-ingredient-${ingredient.id}-${globalIndex}`}
                          originalText={displayText}
                          onSave={(newText) => handleSaveIngredientEdit(globalIndex, newText)}
                          onCancel={handleCancelIngredientEdit}
                          hasSufficient={hasSufficient}
                        />
                      );
                    }

                    // Check for annotation in markup mode
                    const showMarkup = viewMode === 'markup' && ingredient._annotation;

                    return (
                      <View key={`ingredient-${ingredient.id}-${globalIndex}-${family}-${familyIndex}`} style={styles.ingredientRow}>
                        <View style={styles.ingredient}>
                          <Text style={hasSufficient ? styles.ingredientHave : styles.ingredientNeed}>
                            {hasSufficient ? '✓' : '○'}
                          </Text>
                          {showMarkup && ingredient._annotation ? (
                            <View style={styles.ingredientTextContainer}>
                              <MarkupText
                                original={ingredient._annotation.original}
                                edited={ingredient._annotation.new}
                                notes={ingredient._annotation.notes}
                              />
                            </View>
                          ) : (
                            <Text style={styles.ingredientText}>{displayText}</Text>
                          )}
                        </View>
                        {isEditMode && (
                          <View style={styles.ingredientEditButtons}>
                            <TouchableOpacity
                              style={styles.editIconButton}
                              onPress={() => handleEditIngredient(globalIndex)}
                            >
                              <Text style={styles.editIconText}>✏️</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Instructions Section */}
        <View 
          onLayout={(event: LayoutChangeEvent) => {
            setInstructionsHeaderY(event.nativeEvent.layout.y);
          }}
        >
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setInstructionsCollapsed(!instructionsCollapsed)}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>📝 Instructions</Text>
              <Text style={styles.collapseIcon}>
                {instructionsCollapsed ? '▶' : '▼'}
              </Text>
            </View>
          </TouchableOpacity>
          
          {!instructionsCollapsed && (
            <View style={styles.sectionContent}>
              {instructionSections.length > 0 ? (
                instructionSections.map((section) => {
                  const isExpanded = expandedSections.includes(section.id);
                  const stepCount = section.steps.length;
                  
                  return (
                    <View key={section.id} style={styles.instructionSectionGroup}>
                      <TouchableOpacity
                        style={styles.subsectionHeader}
                        onPress={() => toggleSection(section.id)}
                      >
                        <View style={styles.subsectionHeaderLeft}>
                          <Text style={styles.subsectionHeaderIcon}>
                            {isExpanded ? '▼' : '▶'}
                          </Text>
                          <View>
                            <Text style={styles.subsectionHeaderTitle}>
                              {section.section_title}
                            </Text>
                            {section.estimated_time_min && (
                              <Text style={styles.subsectionHeaderTime}>
                                ~{section.estimated_time_min} min
                              </Text>
                            )}
                          </View>
                        </View>
                        <Text style={styles.subsectionHeaderSteps}>
                          {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.subsectionSteps}>
                          {section.steps.map((step) => {
                            const stepIndex = step.step_number - 1;
                            const isEditing = isEditMode && 
                                            editingInstructionIndex === stepIndex &&
                                            editingInstructionSection === section.id;

                            // Show inline editor if editing this step
                            if (isEditing) {
                              return (
                                <InlineEditableInstruction
                                  key={step.id}
                                  originalText={step.instruction}
                                  stepNumber={step.step_number}
                                  onSave={(newText) => handleSaveInstructionEdit(stepIndex, newText, section.id)}
                                  onCancel={handleCancelInstructionEdit}
                                  onDelete={() => handleDeleteInstruction(stepIndex, section.id)}
                                />
                              );
                            }

                            const annotation = annotations.find(
                              a => a.field_type === 'instruction' && 
                                   a.field_index === stepIndex &&
                                   a.field_id === section.id
                            );

                            // Create annotation display object if annotation exists
                            const annotationDisplay = annotation && viewMode === 'markup' ? {
                              original: annotation.original_value,
                              new: annotation.annotated_value,
                              notes: annotation.notes || undefined,
                              showMarkup: true,
                              isDeleted: annotation.annotation_type === 'instruction_delete'
                            } : undefined;

                            return (
                              <View key={`section-${section.id}-step-${stepIndex}-${step.step_number}`} style={styles.stepRow}>
                                {isEditMode && (
                                  <View style={styles.stepControls}>
                                    <TouchableOpacity
                                      style={styles.stepControlButton}
                                      onPress={() => moveStepUp(stepIndex)}
                                    >
                                      <Text style={styles.stepControlText}>⬆️</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.stepControlButton}
                                      onPress={() => moveStepDown(stepIndex)}
                                    >
                                      <Text style={styles.stepControlText}>⬇️</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                                <View style={styles.step}>
                                  <Text style={styles.stepNumber}>{step.step_number}.</Text>
                                  {renderInstructionWithClickableIngredients(
                                    step.instruction, 
                                    step.step_number,
                                    annotationDisplay
                                  )}
                                </View>
                                {isEditMode && (
                                  <View style={styles.stepEditButtons}>
                                    <TouchableOpacity
                                      style={styles.editIconButton}
                                      onPress={() => handleEditInstruction(stepIndex, section.id)}
                                    >
                                      <Text style={styles.editIconText}>✏️</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              ) : displayInstructions.length > 0 ? (
                <View style={styles.flatInstructionsList}>
                  {displayInstructions.map((instruction, index) => {
                    const isEditing = isEditMode && 
                                    editingInstructionIndex === index &&
                                    editingInstructionSection === null;

                    // Show inline editor if editing this step
                    if (isEditing) {
                      return (
                        <InlineEditableInstruction
                          key={index}
                          originalText={getInstructionText(instruction)}
                          stepNumber={index + 1}
                          onSave={(newText) => handleSaveInstructionEdit(index, newText)}
                          onCancel={handleCancelInstructionEdit}
                          onDelete={() => handleDeleteInstruction(index)}
                        />
                      );
                    }

                    // Check if instruction object has _annotation property
                    const annotationDisplay = typeof instruction === 'object' && instruction._annotation
                      ? instruction._annotation
                      : undefined;

                    return (
                      <View key={`flat-instruction-${index}`} style={styles.stepRow}>
                        {isEditMode && (
                          <View style={styles.stepControls}>
                            <TouchableOpacity
                              style={styles.stepControlButton}
                              onPress={() => moveStepUp(index)}
                            >
                              <Text style={styles.stepControlText}>⬆️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.stepControlButton}
                              onPress={() => moveStepDown(index)}
                            >
                              <Text style={styles.stepControlText}>⬇️</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        <View style={styles.step}>
                          <Text style={styles.stepNumber}>{index + 1}.</Text>
                          {renderInstructionWithClickableIngredients(
                            getInstructionText(instruction),
                            index + 1,
                            annotationDisplay
                          )}
                        </View>
                        {isEditMode && (
                          <View style={styles.stepEditButtons}>
                            <TouchableOpacity
                              style={styles.editIconButton}
                              onPress={() => handleEditInstruction(index)}
                            >
                              <Text style={styles.editIconText}>✏️</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noInstructionsText}>No instructions available</Text>
              )}
            </View>
          )}
        </View>

        {/* Start Cooking Button */}
        <TouchableOpacity
          style={styles.startCookingButton}
          onPress={() => navigation.navigate('Cooking', { recipeId: recipe.id })}
        >
          <Text style={styles.startCookingButtonText}>Start Cooking</Text>
        </TouchableOpacity>
      </ScrollView>

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
        ingredients={missingIngredients.length > 0 ? missingIngredients : ingredients}
        scale={currentScale}
        userId={currentUserId || ''}
      />
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
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  topRightButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  topSmallButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    minWidth: 36,
    alignItems: 'center',
  },
  topSmallButtonActive: {
    backgroundColor: '#007AFF',
  },
  topSmallButtonText: {
    fontSize: 16,
  },
  topStartCookingButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#34C759',
  },
  topStartCookingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: 200,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: '#f0f7ff',
  },
  menuItemText: {
    fontSize: 15,
  },
  menuItemCheck: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  header: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 14,
    color: '#666',
  },
  sourceRow: {
    marginTop: 8,
    gap: 6,
  },
  sourceText: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  controlsContainer: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scaleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scaleLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  scaleButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  scaleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  scaleButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  scaleButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  scaleButtonTextActive: {
    color: '#fff',
  },
  convertSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 6,
  },
  unitDropdownText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  unitDropdownArrow: {
    fontSize: 10,
    color: '#666',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  collapseIcon: {
    fontSize: 12,
    color: '#666',
  },
  sectionHeaderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  inlineButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 16,
  },
  familyGroup: {
    marginBottom: 20,
  },
  familyHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  ingredientTextContainer: {
    flex: 1,
  },
  ingredientHave: {
    fontSize: 16,
    color: '#34C759',
    marginRight: 8,
    width: 20,
  },
  ingredientNeed: {
    fontSize: 16,
    color: '#ccc',
    marginRight: 8,
    width: 20,
  },
  ingredientText: {
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },
  ingredientEditButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  editIconButton: {
    padding: 4,
  },
  editIconText: {
    fontSize: 18,
  },
  instructionSectionGroup: {
    marginBottom: 16,
  },
  subsectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  subsectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  subsectionHeaderIcon: {
    fontSize: 14,
    color: '#666',
  },
  subsectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  subsectionHeaderTime: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  subsectionHeaderSteps: {
    fontSize: 13,
    color: '#666',
  },
  subsectionSteps: {
    paddingLeft: 12,
  },
  flatInstructionsList: {
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepControls: {
    flexDirection: 'column',
    gap: 4,
    marginRight: 8,
  },
  stepControlButton: {
    padding: 2,
  },
  stepControlText: {
    fontSize: 16,
  },
  step: {
    flexDirection: 'row',
    flex: 1,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 24,
  },
  stepText: {
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
  stepTextContainer: {
    flex: 1,
  },
  clickableIngredient: {
    color: '#007AFF',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  stepEditButtons: {
    flexDirection: 'column',
    gap: 4,
    marginLeft: 8,
  },
  noInstructionsText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  startCookingButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 24,
  },
  startCookingButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  stickyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stickyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stickySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  stickySectionIcon: {
    fontSize: 12,
    color: '#666',
  },
  stickyHeaderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  stickyInlineButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  stickyInlineButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: '#f0f7ff',
  },
  pickerOptionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  pickerOptionTextSelected: {
    color: '#007AFF',
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
    backgroundColor: '#007AFF',
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
    backgroundColor: '#f0f7ff',
  },
  unitPickerOptionText: {
    fontSize: 16,
  },
  unitPickerOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  unitPickerCheck: {
    fontSize: 16,
    color: '#007AFF',
  },
});