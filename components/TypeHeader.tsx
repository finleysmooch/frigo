// ============================================
// FRIGO - TYPE HEADER COMPONENT
// ============================================
// Collapsible header for ingredient types (Fruit, Alliums, etc.)
// Location: components/TypeHeader.tsx

import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../lib/theme';
import { TypeSection } from '../utils/pantryHelpers';
import { getTypeIcon } from '../constants/pantry';

interface Props {
  typeSection: TypeSection;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function TypeHeader({
  typeSection,
  isExpanded,
  onToggle,
}: Props) {
  const icon = getTypeIcon(typeSection.type);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.typeText}>{typeSection.type}</Text>
        <Text style={styles.count}>({typeSection.items.length})</Text>
        {typeSection.expiringCount > 0 && (
          <Text style={styles.expiringBadge}>
            {typeSection.expiringCount} soon
          </Text>
        )}
        <View style={styles.spacer} />
        <Text style={styles.collapseIcon}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: {
    fontSize: typography.sizes.md,
  },
  typeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  count: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
  },
  expiringBadge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
    backgroundColor: '#FFF9E6',
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  spacer: {
    flex: 1,
  },
  collapseIcon: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
});