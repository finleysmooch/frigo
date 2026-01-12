// screens/MissingIngredientsScreen.tsx
// Review and add missing ingredients to database before saving recipe

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipesStackParamList } from '../App';
import { ProcessedIngredient } from '../lib/types/recipeExtraction';
import {
  suggestIngredientMetadata,
  IngredientSuggestion,
  validateIngredientSuggestion,
} from '../lib/services/ingredientSuggestionService';
import { createIngredientsFromSuggestions } from '../lib/services/ingredientService';
import { useTheme } from '../lib/theme/ThemeContext';

type Props = NativeStackScreenProps<RecipesStackParamList, 'MissingIngredients'>;

interface EditableIngredient extends IngredientSuggestion {
  originalName: string;
  ingredientIndex: number;
}

export function MissingIngredientsScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { missingIngredients, allIngredients, onComplete } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<EditableIngredient[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  useEffect(() => {
    loadSuggestions();
  }, []);

  async function loadSuggestions() {
    try {
      setLoading(true);

      const missingNames = missingIngredients.map((ing: ProcessedIngredient) => ing.ingredient_name);

      console.log(`🤖 Getting AI suggestions for ${missingNames.length} ingredients...`);
      
      const aiSuggestions = await suggestIngredientMetadata(missingNames);

      const editableSuggestions: EditableIngredient[] = aiSuggestions.map((suggestion, index) => ({
        ...suggestion,
        originalName: missingIngredients[index].ingredient_name,
        ingredientIndex: allIngredients.findIndex(
          (ing: ProcessedIngredient) => ing.ingredient_name === missingIngredients[index].ingredient_name
        ),
      }));

      setSuggestions(editableSuggestions);
      setLoading(false);

    } catch (error: any) {
      console.error('❌ Error loading suggestions:', error);
      Alert.alert('Error', 'Failed to generate ingredient suggestions. Please try again.');
      setLoading(false);
    }
  }

  function updateSuggestion(index: number, field: keyof IngredientSuggestion, value: any) {
    setSuggestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function handleAddAll() {
    try {
      const validationErrors: string[] = [];
      suggestions.forEach((suggestion, index) => {
        const validation = validateIngredientSuggestion(suggestion);
        if (!validation.valid) {
          validationErrors.push(`${suggestion.name}: ${validation.errors.join(', ')}`);
        }
      });

      if (validationErrors.length > 0) {
        Alert.alert('Validation Errors', validationErrors.join('\n'));
        return;
      }

      setSaving(true);

      const createdIngredients = await createIngredientsFromSuggestions(suggestions);

      console.log(`✅ Created ${createdIngredients.length} ingredients`);

      const updatedIngredients = [...allIngredients];
      suggestions.forEach((suggestion, index) => {
        const createdIngredient = createdIngredients[index];
        const ingredientIndex = suggestion.ingredientIndex;
        
        if (ingredientIndex >= 0) {
          updatedIngredients[ingredientIndex] = {
            ...updatedIngredients[ingredientIndex],
            ingredient_id: createdIngredient.id,
            match_confidence: 100,
            match_method: 'user_created',
            match_notes: `Created from ${suggestion.form || 'recipe'} suggestion`,
            needs_review: false,
          };
        }
      });

      onComplete(updatedIngredients);
      navigation.goBack();

    } catch (error: any) {
      console.error('❌ Error adding ingredients:', error);
      Alert.alert('Error', `Failed to add ingredients: ${error.message}`);
      setSaving(false);
    }
  }

  function handleSkip() {
    Alert.alert(
      'Skip Missing Ingredients?',
      'Your recipe will be saved without matching these ingredients. You can add them later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          style: 'destructive',
          onPress: () => {
            onComplete(allIngredients);
            navigation.goBack();
          }
        },
      ]
    );
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.card },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.card, padding: 20 },
    loadingText: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginTop: 20 },
    loadingSubtext: { fontSize: 14, color: colors.text.secondary, marginTop: 8, textAlign: 'center' },
    header: { padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: colors.border.light },
    headerTitle: { fontSize: 24, fontWeight: '700', color: colors.text.primary, marginBottom: 5 },
    headerSubtitle: { fontSize: 14, color: colors.text.secondary },
    scrollView: { flex: 1 },
    scrollContent: { padding: 15 },
    ingredientCard: { backgroundColor: colors.background.card, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border.medium, overflow: 'hidden' },
    ingredientHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
    ingredientHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    ingredientEmoji: { fontSize: 32, marginRight: 12 },
    ingredientName: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
    ingredientSubtitle: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
    expandIcon: { fontSize: 16, color: colors.text.tertiary },
    ingredientDetails: { padding: 15, paddingTop: 0, borderTopWidth: 1, borderTopColor: colors.border.light },
    field: { marginBottom: 15 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text.secondary, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: colors.border.medium, borderRadius: 8, padding: 12, fontSize: 15, color: colors.text.primary, backgroundColor: colors.background.secondary },
    storageOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    storageOption: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.medium },
    storageOptionActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
    storageOptionText: { fontSize: 13, color: colors.text.secondary, textTransform: 'capitalize' },
    storageOptionTextActive: { color: colors.primary, fontWeight: '600' },
    confidenceBadge: { backgroundColor: colors.background.secondary, padding: 8, borderRadius: 6, marginBottom: 8 },
    confidenceText: { fontSize: 12, color: colors.text.secondary, textAlign: 'center' },
    reasoning: { fontSize: 12, color: colors.text.tertiary, fontStyle: 'italic', lineHeight: 18 },
    bottomActions: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: colors.border.light, gap: 10 },
    skipButton: { flex: 1, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border.medium, alignItems: 'center' },
    skipButtonText: { fontSize: 16, fontWeight: '600', color: colors.text.secondary },
    addButton: { flex: 2, padding: 16, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
    addButtonDisabled: { opacity: 0.5 },
    addButtonText: { fontSize: 16, fontWeight: '600', color: colors.background.card },
  }), [colors]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Analyzing ingredients...</Text>
        <Text style={styles.loadingSubtext}>AI is suggesting metadata for missing ingredients</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review Missing Ingredients</Text>
        <Text style={styles.headerSubtitle}>
          Found {suggestions.length} ingredient{suggestions.length !== 1 ? 's' : ''} not in database
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {suggestions.map((suggestion, index) => (
          <View key={index} style={styles.ingredientCard}>
            <TouchableOpacity
              style={styles.ingredientHeader}
              onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <View style={styles.ingredientHeaderLeft}>
                <Text style={styles.ingredientEmoji}>
                  {getIngredientEmoji(suggestion.family)}
                </Text>
                <View>
                  <Text style={styles.ingredientName}>{suggestion.name}</Text>
                  <Text style={styles.ingredientSubtitle}>
                    {suggestion.family} • {suggestion.ingredient_type}
                  </Text>
                </View>
              </View>
              <Text style={styles.expandIcon}>
                {expandedIndex === index ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {expandedIndex === index && (
              <View style={styles.ingredientDetails}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Name (singular)</Text>
                  <TextInput
                    style={styles.input}
                    value={suggestion.name}
                    onChangeText={(text) => updateSuggestion(index, 'name', text)}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Plural Name</Text>
                  <TextInput
                    style={styles.input}
                    value={suggestion.plural_name}
                    onChangeText={(text) => updateSuggestion(index, 'plural_name', text)}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Family</Text>
                  <TextInput
                    style={styles.input}
                    value={suggestion.family}
                    onChangeText={(text) => updateSuggestion(index, 'family', text)}
                    placeholder="produce, dairy, meat, etc."
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <TextInput
                    style={styles.input}
                    value={suggestion.ingredient_type}
                    onChangeText={(text) => updateSuggestion(index, 'ingredient_type', text)}
                    placeholder="vegetable, fruit, spice, etc."
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Default Storage</Text>
                  <View style={styles.storageOptions}>
                    {(['fridge', 'freezer', 'pantry', 'counter'] as const).map((location) => (
                      <TouchableOpacity
                        key={location}
                        style={[
                          styles.storageOption,
                          suggestion.default_storage_location === location && styles.storageOptionActive,
                        ]}
                        onPress={() => updateSuggestion(index, 'default_storage_location', location)}
                      >
                        <Text style={[
                          styles.storageOptionText,
                          suggestion.default_storage_location === location && styles.storageOptionTextActive,
                        ]}>
                          {location}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Form</Text>
                  <TextInput
                    style={styles.input}
                    value={suggestion.form || ''}
                    onChangeText={(text) => updateSuggestion(index, 'form', text)}
                    placeholder="fresh, dried, canned, frozen"
                  />
                </View>

                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    AI Confidence: {suggestion.confidence}%
                  </Text>
                </View>

                <Text style={styles.reasoning}>{suggestion.reasoning}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={saving}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addButton, saving && styles.addButtonDisabled]}
          onPress={handleAddAll}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background.card} />
          ) : (
            <Text style={styles.addButtonText}>
              Add All to Database
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getIngredientEmoji(family: string): string {
  const emojiMap: { [key: string]: string } = {
    produce: '🥬',
    dairy: '🥛',
    meat: '🥩',
    seafood: '🐟',
    pantry: '🫙',
    bakery: '🍞',
    frozen: '🧊',
    deli: '🧀',
    beverages: '🥤',
  };
  return emojiMap[family.toLowerCase()] || '🍽️';
}