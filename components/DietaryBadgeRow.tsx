// components/DietaryBadgeRow.tsx
// Reusable row of dietary flag badges (Vegan, GF, Dairy-Free, etc.)
// Used on RecipeNutritionPanel (Phase 1) and PostCard/MealPostCard (Phase 2).

import { View, Text, StyleSheet } from 'react-native';
import { DietaryFlag } from '../lib/services/nutritionService';

interface DietaryBadgeRowProps {
  flags: DietaryFlag[];
  /** 'compact' for PostCard, 'default' for RecipeDetailScreen */
  size?: 'compact' | 'default';
  /** Max badges to show before "+N more" */
  maxVisible?: number;
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  vegan:          { bg: '#E8F5E9', text: '#2E7D32' },
  vegetarian:     { bg: '#E8F5E9', text: '#388E3C' },
  gluten_free:    { bg: '#FFF3E0', text: '#E65100' },
  dairy_free:     { bg: '#E3F2FD', text: '#1565C0' },
  nut_free:       { bg: '#FCE4EC', text: '#C62828' },
  egg_free:       { bg: '#F3E5F5', text: '#6A1B9A' },
  shellfish_free: { bg: '#E0F7FA', text: '#00695C' },
  soy_free:       { bg: '#FFFDE7', text: '#F57F17' },
};

const DEFAULT_BADGE_COLOR = { bg: '#F5F5F5', text: '#666666' };

export default function DietaryBadgeRow({
  flags,
  size = 'default',
  maxVisible = 5,
}: DietaryBadgeRowProps) {
  if (flags.length === 0) return null;

  const isCompact = size === 'compact';
  const visibleFlags = flags.slice(0, maxVisible);
  const overflow = flags.length - maxVisible;

  return (
    <View style={styles.container}>
      {visibleFlags.map((flag) => {
        const badgeColor = BADGE_COLORS[flag.key] || DEFAULT_BADGE_COLOR;
        return (
          <View
            key={flag.key}
            style={[
              styles.badge,
              isCompact && styles.badgeCompact,
              { backgroundColor: badgeColor.bg },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isCompact && styles.badgeTextCompact,
                { color: badgeColor.text },
              ]}
            >
              {isCompact ? flag.shortLabel : flag.label}
            </Text>
          </View>
        );
      })}
      {overflow > 0 && (
        <View style={[styles.badge, styles.overflowBadge]}>
          <Text style={[styles.badgeText, styles.overflowText]}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextCompact: {
    fontSize: 10,
  },
  overflowBadge: {
    backgroundColor: '#F5F5F5',
  },
  overflowText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
});