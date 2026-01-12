import { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

interface PostCreationModalProps {
  visible: boolean;
  recipeTitle: string;
  onSubmit: (postData: PostData) => void;
  onCancel: () => void;
}

export interface PostData {
  rating: number;
  modifications: string;
  cooking_method: 'cook' | 'bake' | 'bbq' | 'meal_prep' | 'snack' | 'eating_out' | 'breakfast' | 'slow_cook' | 'soup' | 'preserve';
  title: string;
}

const COOKING_METHODS = [
  { value: 'cook', label: '🍳 Cook', emoji: '🍳' },
  { value: 'bake', label: '🥖 Bake', emoji: '🥖' },
  { value: 'bbq', label: '🔥 BBQ', emoji: '🔥' },
  { value: 'meal_prep', label: '📦 Meal Prep', emoji: '📦' },
  { value: 'snack', label: '🍎 Snack', emoji: '🍎' },
  { value: 'eating_out', label: '🍽️ Eat Out', emoji: '🍽️' },
  { value: 'breakfast', label: '🥞 Breakfast', emoji: '🥞' },
  { value: 'slow_cook', label: '🍲 Slow Cook', emoji: '🍲' },
  { value: 'soup', label: '🥘 Soup/Stew', emoji: '🥘' },
  { value: 'preserve', label: '🫙 Preserve', emoji: '🫙' },
] as const;

export default function PostCreationModal({
  visible,
  recipeTitle,
  onSubmit,
  onCancel
}: PostCreationModalProps) {
  const { colors, functionalColors } = useTheme();
  const [rating, setRating] = useState<number>(5);
  const [modifications, setModifications] = useState<string>('');
  const [cookingMethod, setCookingMethod] = useState<PostData['cooking_method']>('cook');

  const styles = useMemo(() => StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 40,
      maxHeight: '85%',
    },
    header: {
      marginBottom: 20,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 5,
      color: colors.text.primary,
    },
    recipeTitle: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    section: {
      marginBottom: 25,
    },
    sectionLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 10,
      color: colors.text.primary,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    starButton: {
      padding: 5,
    },
    star: {
      fontSize: 40,
    },
    methodsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    methodButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.secondary,
      width: 60,
      height: 60,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    methodButtonActive: {
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    methodEmoji: {
      fontSize: 32,
    },
    notesInput: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      minHeight: 100,
      color: colors.text.primary,
    },
    previewSection: {
      backgroundColor: colors.background.secondary,
      padding: 15,
      borderRadius: 8,
      marginBottom: 20,
    },
    previewLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      marginBottom: 5,
    },
    previewTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 10,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.background.secondary,
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      color: colors.text.secondary,
      fontWeight: '600',
    },
    submitButton: {
      flex: 2,
      backgroundColor: functionalColors.success,
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
    },
    submitButtonText: {
      fontSize: 16,
      color: 'white',
      fontWeight: '600',
    },
  }), [colors, functionalColors]);

  // Generate auto title based on time of day and cooking method
  const generateTitle = (): string => {
    const hour = new Date().getHours();
    let timeOfDay = 'Evening';
    
    if (hour < 12) timeOfDay = 'Morning';
    else if (hour < 17) timeOfDay = 'Afternoon';
    
    const methodLabel = COOKING_METHODS.find(m => m.value === cookingMethod)?.label.split(' ')[1] || 'Cooking';
    
    return `${timeOfDay} ${methodLabel}`;
  };

  const handleSubmit = () => {
    onSubmit({
      rating,
      modifications: modifications.trim(),
      cooking_method: cookingMethod,
      title: generateTitle()
    });
    
    // Reset form
    setRating(5);
    setModifications('');
    setCookingMethod('cook');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>How'd it go?</Text>
              <Text style={styles.recipeTitle}>{recipeTitle}</Text>
            </View>

            {/* Rating */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Rating</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starButton}
                  >
                    <Text style={styles.star}>
                      {star <= rating ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Cooking Method */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Cooking Method</Text>
              <View style={styles.methodsContainer}>
                {COOKING_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.value}
                    style={[
                      styles.methodButton,
                      cookingMethod === method.value && styles.methodButtonActive
                    ]}
                    onPress={() => setCookingMethod(method.value)}
                  >
                    <Text style={styles.methodEmoji}>{method.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Modifications / Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>What would you do differently?</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                numberOfLines={4}
                placeholder="Any notes, substitutions, or changes you'd make next time..."
                value={modifications}
                onChangeText={setModifications}
                textAlignVertical="top"
              />
            </View>

            {/* Preview title */}
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Post Title</Text>
              <Text style={styles.previewTitle}>{generateTitle()}</Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Post It! 🎉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}