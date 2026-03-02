// ============================================
// FRIGO - CATEGORY HEADER COMPONENT
// ============================================
// Collapsible section header showing family with type breakdown
// Location: components/CategoryHeader.tsx

import { useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { typography, spacing, borderRadius } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import { FamilySection } from '../utils/pantryHelpers';
import { getFamilyIcon, getTypeIcon, getFamilyIconComponent, getTypeIconComponent } from '../constants/pantry';

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
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, functionalColors), [colors, functionalColors]);

  const familyIcon = getFamilyIcon(section.family);
  const FamilyIconComponent = getFamilyIconComponent(section.family);

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
            {FamilyIconComponent ? (
              <FamilyIconComponent size={30} color={colors.text.primary} />
            ) : (
              <Text style={styles.familyEmoji}>{familyIcon}</Text>
            )}
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
            <View style={styles.typeBreakdownRow}>
              {section.types.map(({ type, items, expiringCount }) => {
                const TypeIcon = getTypeIconComponent(type);
                const typeEmoji = getTypeIcon(type);
                const shortType = type.replace('Vegetables', 'Veg');
                const countText = expiringCount > 0
                  ? `${items.length}, ${expiringCount} soon`
                  : `${items.length}`;
                return (
                  <View key={type} style={styles.typeChip}>
                    {TypeIcon
                      ? <TypeIcon size={12} color={colors.text.tertiary} />
                      : <Text style={styles.typeChipEmoji}>{typeEmoji}</Text>}
                    <Text style={styles.typeChipText}>{shortType} ({countText})</Text>
                  </View>
                );
              })}
            </View>
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

function createStyles(colors: any, functionalColors: any) {
  return StyleSheet.create({
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
      color: functionalColors.warning,
      backgroundColor: functionalColors.warning + '15',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.sm,
    },
    typeBreakdownRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    typeChipEmoji: {
      fontSize: 11,
    },
    typeChipText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
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
}
