// components/cooking/SectionCard.tsx
// Main section card — shows all steps in a section with current/done/future states.

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { NormalizedStep, StepIngredient, InstructionSection } from '../../lib/types/cooking';
import { detectTimersInText, type DetectedTimer } from '../../lib/utils/timerDetection';
import { useCookingTimers } from '../../contexts/CookingTimerContext';
import type { StepNote } from '../../lib/types/cooking';
import StepIngredients from './StepIngredients';
import StepNoteDisplay from './StepNoteDisplay';
import StepNoteInput from './StepNoteInput';

interface Props {
  section: InstructionSection;
  sectionIndex: number;
  totalSections: number;
  steps: NormalizedStep[];
  currentStepNumber: number;
  ingredientsByStep: Map<number, StepIngredient[]>;
  onStepTap: (stepNumber: number) => void;
  autoExpand: boolean;
  /** Saved notes keyed by step number */
  notesByStep: Map<number, StepNote>;
  /** Save a note for a step */
  onNoteSave: (stepNumber: number, text: string) => Promise<void>;
}

export default function SectionCard({
  section,
  sectionIndex,
  totalSections,
  steps,
  currentStepNumber,
  ingredientsByStep,
  onStepTap,
  autoExpand,
  notesByStep,
  onNoteSave,
}: Props) {
  const { colors } = useTheme();
  const { startTimer } = useCookingTimers();
  const [editingNoteStep, setEditingNoteStep] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const stepPositions = useRef<Record<number, number>>({});

  // Pre-detect timers for each step
  const timersByStep = useMemo(() => {
    const map = new Map<number, DetectedTimer[]>();
    for (const step of steps) {
      const detected = detectTimersInText(step.text);
      if (detected.length > 0) map.set(step.number, detected);
    }
    return map;
  }, [steps]);

  // Scroll to current step when it changes
  useEffect(() => {
    const y = stepPositions.current[currentStepNumber];
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 20), animated: true });
    }
  }, [currentStepNumber]);

  const handleStepLayout = useCallback(
    (stepNumber: number) => (e: LayoutChangeEvent) => {
      stepPositions.current[stepNumber] = e.nativeEvent.layout.y;
    },
    []
  );

  const stepCount = section.endStep - section.startStep + 1;
  const currentStepInSection = currentStepNumber - section.startStep;

  return (
    <ScrollView ref={scrollRef} style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Section header */}
      <View style={[styles.sectionHeader, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.sectionName, { color: colors.primary }]}>{section.name}</Text>
        <Text style={[styles.sectionMeta, { color: colors.text.tertiary }]}>
          {stepCount} step{stepCount > 1 ? 's' : ''} · section {sectionIndex + 1}/{totalSections}
        </Text>
      </View>

      {/* Steps */}
      {steps.map((step) => {
        const isCurrent = step.number === currentStepNumber;
        const isDone = step.number < currentStepNumber;
        const stepIngredients = ingredientsByStep.get(step.number) || [];
        const shouldCollapse = autoExpand && !isCurrent && !isDone;

        return (
          <TouchableOpacity
            key={step.number}
            activeOpacity={0.7}
            onPress={() => onStepTap(step.number)}
            onLayout={handleStepLayout(step.number)}
            style={[
              styles.stepContainer,
              {
                backgroundColor: isCurrent ? colors.background.secondary : 'transparent',
                borderLeftColor: isCurrent ? colors.primary : 'transparent',
                opacity: isDone ? 0.4 : 1,
              },
            ]}
          >
            {/* Step number + NOW badge */}
            <View style={styles.stepHeader}>
              <Text
                style={[
                  styles.stepNumber,
                  { color: isCurrent ? colors.primary : colors.text.tertiary },
                ]}
              >
                {isDone ? '✓' : step.number}
              </Text>
              {isCurrent && (
                <View style={[styles.nowBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.nowText, { color: colors.primary }]}>NOW</Text>
                </View>
              )}
            </View>

            {/* Step text */}
            <Text
              style={[
                styles.stepText,
                {
                  fontSize: isCurrent ? 14 : 11,
                  fontWeight: isCurrent ? '600' : '400',
                  color: isCurrent ? colors.text.primary : colors.text.secondary,
                },
              ]}
              numberOfLines={shouldCollapse ? 2 : undefined}
            >
              {shouldCollapse
                ? `${step.text.substring(0, 60)}${step.text.length > 60 ? '…' : ''}`
                : step.text}
            </Text>

            {/* Per-step ingredients (current step only, or all if not auto-expanding) */}
            {(isCurrent || (!autoExpand && !isDone)) && stepIngredients.length > 0 && (
              <StepIngredients ingredients={stepIngredients} />
            )}

            {/* Timer suggestions + note button */}
            {isCurrent && (
              <View style={styles.actionRow}>
                {(timersByStep.get(step.number) || []).map((timer, ti) => (
                  <TouchableOpacity
                    key={ti}
                    style={[styles.actionButton, { borderColor: colors.border.light }]}
                    onPress={() => startTimer(timer.label, step.number, timer.seconds)}
                  >
                    <Text style={[styles.actionIcon, { fontSize: 10 }]}>⏱</Text>
                    <Text style={[styles.timerSuggestionText, { color: colors.text.secondary }]}>
                      ~{Math.round(timer.seconds / 60)}m
                    </Text>
                    <Text style={[styles.timerStartText, { color: colors.primary }]}>Start</Text>
                  </TouchableOpacity>
                ))}
                {/* Note button */}
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: colors.border.light }]}
                  onPress={() => setEditingNoteStep(
                    editingNoteStep === step.number ? null : step.number
                  )}
                >
                  <Text style={styles.actionIcon}>📝</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Note input (when editing) */}
            {editingNoteStep === step.number && (
              <StepNoteInput
                stepNumber={step.number}
                existingText={notesByStep.get(step.number)?.note_text || ''}
                onSave={(text) => onNoteSave(step.number, text)}
                onClose={() => setEditingNoteStep(null)}
              />
            )}

            {/* Saved note display (when not editing) */}
            {editingNoteStep !== step.number && notesByStep.has(step.number) && (
              <StepNoteDisplay
                noteText={notesByStep.get(step.number)!.note_text || ''}
                updatedAt={notesByStep.get(step.number)!.updated_at}
                onEdit={() => setEditingNoteStep(step.number)}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  sectionName: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionMeta: {
    fontSize: 11,
  },
  stepContainer: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
  },
  nowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  nowText: {
    fontSize: 9,
    fontWeight: '700',
  },
  stepText: {
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  actionIcon: {
    fontSize: 13,
  },
  timerSuggestionText: {
    fontSize: 11,
  },
  timerStartText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
