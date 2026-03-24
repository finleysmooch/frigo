// components/cooking/ClassicView.tsx
// Classic cookbook view — full scrollable page with ingredients, all steps, section headers.

import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import type { NormalizedStep, InstructionSection, StepIngredient, StepNote } from '../../lib/types/cooking';
import StepNoteDisplay from './StepNoteDisplay';

interface Props {
  recipe: any;
  steps: NormalizedStep[];
  sections: InstructionSection[];
  ingredientsByStep: Map<number, StepIngredient[]>;
  currentStepNumber: number;
  notesByStep: Map<number, StepNote>;
  onSwitchToStepView: () => void;
  onStepTap: (stepNumber: number) => void;
  onNoteEdit: (stepNumber: number) => void;
}

export default function ClassicView({
  recipe,
  steps,
  sections,
  ingredientsByStep,
  currentStepNumber,
  notesByStep,
  onSwitchToStepView,
  onStepTap,
  onNoteEdit,
}: Props) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  // Build flat ingredient list (deduplicated)
  const allIngredients = recipe.ingredients || [];
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (currentStepNumber - 1) / totalSteps : 0;

  // Find which section each step belongs to
  const sectionForStep = (stepNumber: number): InstructionSection | undefined =>
    sections.find(s => stepNumber >= s.startStep && stepNumber <= s.endStep);

  // Group steps with section headers
  let lastSectionName = '';

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressRow}>
        <Text style={[styles.progressText, { color: colors.primary }]}>
          On Step {currentStepNumber} / {totalSteps}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.border.light }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        <TouchableOpacity onPress={onSwitchToStepView}>
          <Text style={[styles.switchLink, { color: colors.primary }]}>Step view →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Recipe photo */}
        {recipe.image_url && (
          <Image
            source={{ uri: recipe.image_url }}
            style={styles.photo}
            resizeMode="cover"
          />
        )}

        {/* Ingredients */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Ingredients</Text>
        {allIngredients.map((ing: any, i: number) => {
          const text = typeof ing === 'string' ? ing : ing.original_text || ing.ingredient || '';
          return (
            <Text key={i} style={[styles.ingredientText, { color: colors.text.secondary }]}>
              • {text}
            </Text>
          );
        })}

        {/* Steps */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary, marginTop: 16 }]}>
          Steps
        </Text>

        {steps.map(step => {
          const sec = sectionForStep(step.number);
          const showSectionHeader = sec && sec.name !== lastSectionName;
          if (sec) lastSectionName = sec.name;

          const isCurrent = step.number === currentStepNumber;
          const isDone = step.number < currentStepNumber;
          const note = notesByStep.get(step.number);

          return (
            <View key={step.number}>
              {/* Section header */}
              {showSectionHeader && sec && (
                <Text style={[styles.classicSectionHeader, { color: colors.primary }]}>
                  {sec.name}
                </Text>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onStepTap(step.number)}
                style={[
                  styles.stepRow,
                  {
                    backgroundColor: isCurrent ? colors.primaryLight : 'transparent',
                    borderLeftColor: isCurrent ? colors.primary : 'transparent',
                    opacity: isDone ? 0.45 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stepNum,
                    {
                      color: isCurrent
                        ? colors.primary
                        : isDone
                          ? colors.text.tertiary
                          : colors.text.secondary,
                    },
                  ]}
                >
                  {step.number}
                </Text>
                <View style={styles.stepBody}>
                  <Text
                    style={[
                      styles.stepText,
                      {
                        color: isCurrent ? colors.text.primary : colors.text.secondary,
                        fontWeight: isCurrent ? '500' : '400',
                      },
                    ]}
                  >
                    {step.text}
                    {isCurrent && (
                      <Text style={[styles.hereMarker, { color: colors.primary }]}>
                        {' '}← you're here
                      </Text>
                    )}
                  </Text>

                  {/* Saved note */}
                  {note?.note_text && (
                    <StepNoteDisplay
                      noteText={note.note_text}
                      updatedAt={note.updated_at}
                      onEdit={() => onNoteEdit(step.number)}
                    />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  switchLink: {
    fontSize: 11,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 14,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  ingredientText: {
    fontSize: 12,
    lineHeight: 20,
    paddingVertical: 1,
  },
  classicSectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 6,
    borderRadius: 6,
    borderLeftWidth: 3,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    width: 18,
    flexShrink: 0,
  },
  stepBody: {
    flex: 1,
  },
  stepText: {
    fontSize: 12,
    lineHeight: 18,
  },
  hereMarker: {
    fontSize: 10,
    fontWeight: '600',
  },
});
