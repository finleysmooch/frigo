// components/cooking/IngredientSheet.tsx
// Pull-up ingredient bottom sheet — grouped by step, NOW badge on current step.

import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import type { NormalizedStep, StepIngredient, InstructionSection } from '../../lib/types/cooking';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onClose: () => void;
  steps: NormalizedStep[];
  sections: InstructionSection[];
  ingredientsByStep: Map<number, StepIngredient[]>;
  currentStepNumber: number;
  onIngredientTap: (ingredient: StepIngredient, stepNumber: number) => void;
}

export default function IngredientSheet({
  visible,
  onClose,
  steps,
  sections,
  ingredientsByStep,
  currentStepNumber,
  onIngredientTap,
}: Props) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(onClose);
  };

  // Get section name for a step number
  const getSectionName = (stepNumber: number): string => {
    const sec = sections.find(
      s => stepNumber >= s.startStep && stepNumber <= s.endStep
    );
    return sec?.name || '';
  };

  // Build ordered step groups that have ingredients
  const stepGroups = steps
    .filter(step => {
      const ings = ingredientsByStep.get(step.number);
      return ings && ings.length > 0;
    })
    .map(step => ({
      step,
      sectionName: getSectionName(step.number),
      ingredients: ingredientsByStep.get(step.number) || [],
      isCurrent: step.number === currentStepNumber,
      isPast: step.number < currentStepNumber,
    }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.background.card, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            {/* Handle bar */}
            <TouchableOpacity onPress={handleClose} style={styles.handleArea} activeOpacity={0.8}>
              <View style={[styles.handle, { backgroundColor: colors.border.medium }]} />
            </TouchableOpacity>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text.primary }]}>Ingredients</Text>

            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {stepGroups.map(({ step, sectionName, ingredients, isCurrent, isPast }) => (
                <View key={step.number} style={[styles.stepGroup, isPast && styles.stepGroupFaded]}>
                  {/* Step header */}
                  {isCurrent ? (
                    <View style={[styles.nowBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.nowBadgeText}>
                        STEP {step.number} — NOW
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.stepHeader,
                        { color: isPast ? colors.text.tertiary : colors.primary },
                      ]}
                    >
                      STEP {step.number}
                      {sectionName ? ` — ${sectionName}` : ''}
                    </Text>
                  )}

                  {/* Ingredients */}
                  {ingredients.map((ing, i) => {
                    const right = [ing.quantity, ing.preparation].filter(Boolean).join(', ');
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.ingredientRow,
                          { borderBottomColor: colors.border.light },
                          isCurrent && { backgroundColor: colors.background.secondary },
                        ]}
                        activeOpacity={0.6}
                        onPress={() => onIngredientTap(ing, step.number)}
                      >
                        <Text
                          style={[
                            styles.ingredientName,
                            {
                              color: isCurrent ? colors.text.primary : colors.text.secondary,
                              fontWeight: isCurrent ? '600' : '400',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {ing.name}
                        </Text>
                        {right ? (
                          <Text
                            style={[styles.ingredientQty, { color: colors.text.tertiary }]}
                            numberOfLines={1}
                          >
                            {right}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.75,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  scrollArea: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  stepGroup: {
    marginBottom: 14,
  },
  stepGroupFaded: {
    opacity: 0.4,
  },
  stepHeader: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  nowBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  nowBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderRadius: 4,
  },
  ingredientName: {
    fontSize: 13,
    flex: 1,
  },
  ingredientQty: {
    fontSize: 11,
    textAlign: 'right',
    marginLeft: 8,
    flexShrink: 0,
    maxWidth: '45%',
  },
});
