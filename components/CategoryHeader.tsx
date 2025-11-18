// ============================================
// FRIGO - CATEGORY HEADER COMPONENT
// ============================================
// Collapsible section header showing family with type breakdown
// Location: components/CategoryHeader.tsx

import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../lib/theme';
import { FamilySection } from '../utils/pantryHelpers';
import { getFamilyIcon, getTypeIcon } from '../constants/pantry';

interface Props {
  section: FamilySection;
  isExpanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
}

export default function CategoryHeader({
  section,
  isExpanded,
  onToggle,
  onAdd,
}: Props) {
  const familyIcon = getFamilyIcon(section.family);

  // Create type breakdown summary
  const typeBreakdown = section.types
    .map(({ type, items, expiringCount }) => {
      const icon = getTypeIcon(type);
      const shortType = type.replace('Vegetables', 'Veg');
      const count = items.length;
      
      if (expiringCount > 0) {
        return `${icon} ${shortType} (${count}, ${expiringCount} soon)`;
      }
      return `${icon} ${shortType} (${count})`;
    })
    .join(', ');

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Left Side: Family Info */}
        <View style={styles.leftSection}>
          <View style={styles.titleRow}>
            <Text style={styles.familyEmoji}>{familyIcon}</Text>
            <Text style={styles.familyTitle}>{section.family}</Text>
            <Text style={styles.count}>({section.totalCount})</Text>
            {section.expiringCount > 0 && (
              <Text style={styles.expiringBadge}>
                {section.expiringCount} expiring
              </Text>
            )}
          </View>
          
          {/* Type Breakdown - Only show when collapsed */}
          {!isExpanded && (
            <Text style={styles.typeBreakdown} numberOfLines={2}>
              {typeBreakdown}
            </Text>
          )}
        </View>

        {/* Right Side: Actions */}
        <View style={styles.rightSection}>
          {onAdd && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.collapseIcon}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    // No background - parent sectionCard provides white background
    marginBottom: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  familyEmoji: {
    fontSize: typography.sizes.xl,
  },
  familyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  count: {
    fontSize: typography.sizes.md,
    color: colors.text.tertiary,
  },
  expiringBadge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
    backgroundColor: '#FFF9E6',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  typeBreakdown: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  addButtonText: {
    fontSize: typography.sizes.md,
    color: colors.background.primary,
    fontWeight: typography.weights.bold,
  },
  collapseIcon: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    width: 20,
    textAlign: 'center',
  },
});