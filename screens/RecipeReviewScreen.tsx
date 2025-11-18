// screens/RecipeReviewScreen.tsx
// Screen where user reviews and edits extracted recipe data before saving

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { ProcessedRecipe } from '../lib/types/recipeExtraction';
import { saveRecipeToDatabase } from '../lib/services/recipeExtraction/recipeService';

interface Props {
  processedRecipe: ProcessedRecipe;
  bookId?: string;
  userId: string;
  onSave: (recipeId: string) => void;
  onCancel: () => void;
}

export function RecipeReviewScreen({
  processedRecipe,
  bookId,
  userId,
  onSave,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(processedRecipe.recipe.title);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    console.log('📝 Starting recipe save...');
    console.log('User ID:', userId);
    console.log('Book ID:', bookId);
    console.log('Recipe title:', title);
    
    try {
      // Save to database
      console.log('💾 Calling saveRecipeToDatabase...');
      const recipeId = await saveRecipeToDatabase(
        userId,
        { ...processedRecipe, recipe: { ...processedRecipe.recipe, title } },
        bookId
      );

      console.log('✅ Recipe saved successfully! Recipe ID:', recipeId);
      Alert.alert('Success!', 'Recipe added successfully');
      onSave(recipeId);
      
    } catch (error) {
      console.error('❌ Error saving recipe:', error);
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    } finally {
      setSaving(false);
      console.log('🏁 Save process complete');
    }
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
            <Text>{processedRecipe.book_metadata.book_title}</Text>
            {processedRecipe.book_metadata.page_number && (
              <Text>Page {processedRecipe.book_metadata.page_number}</Text>
            )}
          </View>
        )}

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Ingredients ({processedRecipe.ingredients_with_matches.length})
          </Text>
          {processedRecipe.ingredients_with_matches.map((ing: any, index: any) => (
            <View key={index} style={styles.ingredient}>
              <Text style={styles.ingredientText}>{ing.original_text}</Text>
              {ing.needs_review && (
                <Text style={styles.warning}>⚠️ Needs review</Text>
              )}
            </View>
          ))}
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Instructions ({processedRecipe.instructions.length})
          </Text>
          {processedRecipe.instructions.map((inst: any) => (
            <Text key={inst.step_number} style={styles.instruction}>
              {inst.step_number}. {inst.instruction}
            </Text>
          ))}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Recipe'}
          </Text>
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
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  ingredient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ingredientText: {
    flex: 1,
    fontSize: 14,
  },
  warning: {
    fontSize: 12,
    color: '#ff9800',
  },
  instruction: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});