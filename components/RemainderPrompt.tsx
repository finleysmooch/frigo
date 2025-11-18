// ============================================
// FRIGO - REMAINDER PROMPT COMPONENT
// ============================================
// Ask what happened to remaining quantity when moving partial amount
// Options: Keep in original location, Mark as used, Mark as discarded
// Location: components/RemainderPrompt.tsx

import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';

export type RemainderAction = 'keep' | 'used' | 'discarded';

interface Props {
  visible: boolean;
  itemName: string;
  remainingQuantity: number;
  unit: string;
  originalStorage: string;
  onClose: () => void;
  onSelect: (action: RemainderAction) => void;
}

export default function RemainderPrompt({
  visible,
  itemName,
  remainingQuantity,
  unit,
  originalStorage,
  onClose,
  onSelect,
}: Props) {
  const handleSelect = (action: RemainderAction) => {
    onSelect(action);
    onClose();
  };

  const formattedQuantity = remainingQuantity % 1 === 0 
    ? remainingQuantity.toString() 
    : remainingQuantity.toFixed(2).replace(/\.?0+$/, '');

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>What about the rest?</Text>
            <Text style={styles.subtitle}>
              {formattedQuantity} {unit} of {itemName} remaining in {originalStorage}
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {/* Keep in Original Location */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => handleSelect('keep')}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionEmoji}>📦</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Keep in {originalStorage}</Text>
                  <Text style={styles.optionDescription}>
                    Leave remaining {formattedQuantity} {unit} where it is
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Mark as Used */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => handleSelect('used')}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionEmoji}>✓</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Mark as Used</Text>
                  <Text style={styles.optionDescription}>
                    I used the remaining {formattedQuantity} {unit} in cooking
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Mark as Discarded */}
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => handleSelect('discarded')}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionEmoji}>🗑️</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Discarded</Text>
                  <Text style={styles.optionDescription}>
                    The remaining {formattedQuantity} {unit} went bad or was thrown away
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  container: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.large,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  optionsContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  optionButton: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionEmoji: {
    fontSize: typography.sizes.xxxl,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
  },
  cancelButton: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});