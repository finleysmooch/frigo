import { useState } from 'react';
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
  const [rating, setRating] = useState<number>(5);
  const [modifications, setModifications] = useState<string>('');
  const [cookingMethod, setCookingMethod] = useState<PostData['cooking_method']>('cook');

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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
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
  },
  recipeTitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 25,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
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
    backgroundColor: '#f0f0f0',
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  methodEmoji: {
    fontSize: 32,
  },
  notesInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  previewSection: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});