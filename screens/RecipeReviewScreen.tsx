// screens/RecipeReviewScreen.tsx
// Review and edit recipe before saving
// UPDATED: Now also saves instruction sections
// UPDATED: Fixed navigation flow to prevent modal stacking
// Date: December 2, 2025

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { ProcessedRecipe } from '../lib/types/recipeExtraction';
import { saveRecipeToDatabase } from '../lib/services/recipeExtraction/recipeService';
import { saveInstructionSections } from '../lib/services/instructionSectionsService';
import { colors } from '../lib/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipesStackParamList } from '../App';

type Props = NativeStackScreenProps<RecipesStackParamList, 'RecipeReview'>;

export function RecipeReviewScreen({ route, navigation }: Props) {
  const { processedRecipe, bookId, userId } = route.params;
  
  const [title, setTitle] = useState(processedRecipe.recipe.title);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    console.log('📝 Starting recipe save...');
    console.log('User ID:', userId);
    console.log('Book ID:', bookId);
    console.log('Recipe title:', title);
    
    try {
      // Save recipe to database
      console.log('💾 Calling saveRecipeToDatabase...');
      const recipeId = await saveRecipeToDatabase(
        userId,
        { ...processedRecipe, recipe: { ...processedRecipe.recipe, title } },
        bookId
      );

      console.log('✅ Recipe saved successfully! Recipe ID:', recipeId);

      // Save instruction sections if present
      if (processedRecipe.instruction_sections && processedRecipe.instruction_sections.length > 0) {
        console.log(`📝 Saving ${processedRecipe.instruction_sections.length} instruction sections...`);
        
        try {
          await saveInstructionSections(recipeId, processedRecipe.instruction_sections);
          console.log('✅ Instruction sections saved successfully');
        } catch (sectionError) {
          console.error('⚠️ Error saving instruction sections:', sectionError);
          // Don't fail the entire save if sections fail
          // Recipe is still saved, just without sections
        }
      } else {
        console.log('ℹ️ No instruction sections to save');
      }
      
      // Show success alert
      Alert.alert(
        'Success!',
        'Recipe added successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              // Use replace to prevent stacking, navigate to recipe detail
              navigation.replace('RecipeDetail', { recipe: { id: recipeId } });
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Error saving recipe:', error);
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
      setSaving(false);
    }
  }

  function handleCancel() {
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.header}>Review Recipe</Text>

        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
        />

        {/* Book info */}
        {processedRecipe.book_metadata && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Book Info</Text>
            <Text style={styles.infoText}>
              {processedRecipe.book_metadata.book_title || processedRecipe.book_metadata.title}
              {processedRecipe.book_metadata.author && ` by ${processedRecipe.book_metadata.author}`}
            </Text>
          </View>
        )}

        {/* Web source info */}
        {processedRecipe.recipe.source_author && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipe Author</Text>
            <Text style={styles.infoText}>{processedRecipe.recipe.source_author}</Text>
          </View>
        )}

        {/* Description */}
        {processedRecipe.recipe.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.infoText}>{processedRecipe.recipe.description}</Text>
          </View>
        )}

        {/* Times */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cooking Times</Text>
          {processedRecipe.recipe.prep_time_min && (
            <Text style={styles.infoText}>Prep: {processedRecipe.recipe.prep_time_min} min</Text>
          )}
          {processedRecipe.recipe.cook_time_min && (
            <Text style={styles.infoText}>Cook: {processedRecipe.recipe.cook_time_min} min</Text>
          )}
          {processedRecipe.recipe.inactive_time_min && (
            <Text style={styles.infoText}>Inactive: {processedRecipe.recipe.inactive_time_min} min</Text>
          )}
          {!processedRecipe.recipe.prep_time_min && 
           !processedRecipe.recipe.cook_time_min && 
           !processedRecipe.recipe.inactive_time_min && (
            <Text style={styles.infoText}>No timing information available</Text>
          )}
        </View>

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>
          Ingredients ({processedRecipe.ingredients_with_matches?.length || 0})
        </Text>
        {processedRecipe.ingredients_with_matches?.map((ingredient: any, index: number) => (
          <View key={`ingredient-${index}`} style={styles.ingredientRow}>
            <Text style={styles.ingredientText}>{ingredient.original_text}</Text>
            {ingredient.needs_review && (
              <Text style={styles.reviewBadge}>⚠️ Needs review</Text>
            )}
          </View>
        ))}

        {/* Instructions */}
        <Text style={styles.sectionTitle}>Instructions</Text>
        {processedRecipe.instruction_sections && processedRecipe.instruction_sections.length > 0 ? (
          processedRecipe.instruction_sections.map((section: any, sectionIndex: number) => (
            <View key={`section-${sectionIndex}`} style={styles.instructionSection}>
              <Text style={styles.instructionSectionTitle}>{section.section_title}</Text>
              {section.steps?.map((step: any, stepIndex: number) => (
                <View key={`section-${sectionIndex}-step-${stepIndex}`} style={styles.instructionStep}>
                  <Text style={styles.stepNumber}>{step.step_number}.</Text>
                  <Text style={styles.stepText}>{step.instruction}</Text>
                </View>
              ))}
            </View>
          ))
        ) : (
          <Text style={styles.infoText}>No instruction sections found</Text>
        )}

        {/* Raw data info */}
        {processedRecipe.raw_extraction_data && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Additional Data</Text>
            <Text style={styles.infoTextSmall}>
              Recipe notes, ingredient swaps, and other details will be saved for future use.
            </Text>
          </View>
        )}

        {/* Spacer for footer */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Recipe</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    marginTop: 40, // Account for status bar
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoTextSmall: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ingredientText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  reviewBadge: {
    fontSize: 12,
    color: '#ff9800',
  },
  instructionSection: {
    marginBottom: 20,
  },
  instructionSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 10,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
    minWidth: 20,
  },
  stepText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 40, // Account for home indicator
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 2,
    padding: 15,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});