// components/cooking/IngredientDetailPopup.tsx
// Tap an ingredient → popup with quantity, prep, "used in" steps, personal note.

import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import type { StepIngredient, NormalizedStep } from '../../lib/types/cooking';

interface Props {
  visible: boolean;
  onClose: () => void;
  ingredient: StepIngredient | null;
  /** All step numbers where this ingredient is used */
  usedInSteps: number[];
  /** All steps (for showing step text snippets) */
  steps: NormalizedStep[];
  /** Personal note for a relevant step (if any) */
  note?: string | null;
}

export default function IngredientDetailPopup({
  visible,
  onClose,
  ingredient,
  usedInSteps,
  steps,
  note,
}: Props) {
  const { colors } = useTheme();

  if (!ingredient) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.popup, { backgroundColor: colors.background.card, borderColor: colors.border.light }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.text.placeholder }]}>✕</Text>
          </TouchableOpacity>

          {/* Name */}
          <Text style={[styles.name, { color: colors.text.primary }]}>
            {ingredient.name}
          </Text>

          {/* Quantity + Prep boxes */}
          <View style={styles.boxRow}>
            <View style={[styles.box, { backgroundColor: colors.background.secondary }]}>
              <Text style={[styles.boxLabel, { color: colors.text.tertiary }]}>QUANTITY</Text>
              <Text style={[styles.boxValue, { color: colors.text.primary }]}>
                {ingredient.quantity || '—'}
              </Text>
            </View>
            <View style={[styles.box, { backgroundColor: colors.background.secondary }]}>
              <Text style={[styles.boxLabel, { color: colors.text.tertiary }]}>PREP</Text>
              <Text style={[styles.boxValue, { color: colors.text.primary }]}>
                {ingredient.preparation || '—'}
              </Text>
            </View>
          </View>

          {/* Used in */}
          {usedInSteps.length > 0 && (
            <View style={[styles.usedInBox, { backgroundColor: colors.background.secondary }]}>
              <Text style={[styles.boxLabel, { color: colors.text.tertiary }]}>USED IN</Text>
              {usedInSteps.map(stepNum => {
                const step = steps.find(s => s.number === stepNum);
                const snippet = step
                  ? step.text.substring(0, 60) + (step.text.length > 60 ? '…' : '')
                  : '';
                return (
                  <Text key={stepNum} style={[styles.usedInText, { color: colors.text.secondary }]}>
                    Step {stepNum}{snippet ? ` — ${snippet}` : ''}
                  </Text>
                );
              })}
            </View>
          )}

          {/* Personal note */}
          {note ? (
            <View style={styles.noteCard}>
              <Text style={styles.noteLabel}>YOUR NOTE</Text>
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popup: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 1,
    padding: 4,
  },
  closeText: {
    fontSize: 16,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
    paddingRight: 24,
  },
  boxRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  box: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
  },
  boxLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  boxValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  usedInBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  usedInText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  noteCard: {
    backgroundColor: '#fef9e7',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#b8942d',
  },
  noteLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#b8942d',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  noteText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
});
