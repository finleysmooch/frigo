// components/stats/ConceptBubbleMap.tsx
// Bubble map visualization for cooking concepts.
// Size-scaled circles with 3 visual tiers: Staple, Regular, Frontier.
// Falls back to TappableConceptList if < 3 concepts.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing } from '../../lib/theme';
import type { ConceptCount } from '../../lib/services/statsService';
import TappableConceptList from './TappableConceptList';

interface ConceptBubbleMapProps {
  concepts: ConceptCount[];
  onConceptPress: (concept: string) => void;
}

/** Convert DB strings like "composed_plate" → "Composed Plate" */
function formatConcept(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

const MIN_SIZE = 28;
const MAX_SIZE = 72;
const MAX_BUBBLES = 15;

export default function ConceptBubbleMap({ concepts, onConceptPress }: ConceptBubbleMapProps) {
  const { colors } = useTheme();

  // Limit and sort
  const sorted = useMemo(
    () => [...concepts].sort((a, b) => b.count - a.count).slice(0, MAX_BUBBLES),
    [concepts]
  );

  // Fallback for < 3 concepts
  if (sorted.length < 3) {
    return (
      <TappableConceptList
        items={sorted.map(d => ({ name: formatConcept(d.concept), count: d.count }))}
        onPress={(item) => {
          const raw = concepts.find(c => formatConcept(c.concept) === item.name)?.concept || item.name;
          onConceptPress(raw);
        }}
      />
    );
  }

  const maxCount = sorted[0]?.count || 1;

  return (
    <View>
      <View style={styles.bubbleContainer}>
        {sorted.map((item) => {
          const diameter = MIN_SIZE + ((item.count / maxCount) * (MAX_SIZE - MIN_SIZE));
          const tier = getTier(item.count);
          const tierStyle = getTierStyle(tier, colors);
          const fontSize = Math.max(8, Math.floor(diameter * 0.14));

          return (
            <TouchableOpacity
              key={item.concept}
              style={[
                styles.bubble,
                {
                  width: diameter,
                  height: diameter,
                  backgroundColor: tierStyle.bg,
                  borderColor: tierStyle.border,
                  borderWidth: 2,
                  borderStyle: tier === 'frontier' ? 'dashed' : 'solid',
                },
              ]}
              onPress={() => onConceptPress(item.concept)}
              activeOpacity={0.7}
            >
              <Text
                style={{ fontSize: fontSize + 1, fontWeight: typography.weights.bold as any, color: tierStyle.text }}
                numberOfLines={1}
              >
                {item.count}
              </Text>
              <Text
                style={{ fontSize, color: tierStyle.text, textAlign: 'center' }}
                numberOfLines={1}
              >
                {formatConcept(item.concept)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <LegendItem color={colors.primary} bg={colors.primaryLight || '#e0f2f1'} label="Staple" />
        <Text style={[styles.legendDot, { color: colors.text.tertiary }]}>·</Text>
        <LegendItem color="#6b7280" bg="#f3f4f6" label="Regular" />
        <Text style={[styles.legendDot, { color: colors.text.tertiary }]}>·</Text>
        <LegendItem color="#d1d5db" bg="#ffffff" label="Frontier" />
      </View>
    </View>
  );
}

type Tier = 'staple' | 'regular' | 'frontier';

function getTier(count: number): Tier {
  if (count >= 10) return 'staple';
  if (count >= 4) return 'regular';
  return 'frontier';
}

function getTierStyle(tier: Tier, colors: any): { bg: string; border: string; text: string } {
  switch (tier) {
    case 'staple':
      return {
        bg: colors.primaryLight || '#e0f2f1',
        border: colors.primary,
        text: colors.primaryDark || colors.primary,
      };
    case 'regular':
      return {
        bg: '#f3f4f6',
        border: '#9ca3af',
        text: '#6b7280',
      };
    case 'frontier':
      return {
        bg: '#ffffff',
        border: '#d1d5db',
        text: '#d1d5db',
      };
  }
}

function LegendItem({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendCircle, { backgroundColor: bg, borderColor: color, borderWidth: 1 }]} />
      <Text style={[styles.legendLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bubble: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: typography.sizes.xs,
  },
  legendDot: {
    fontSize: typography.sizes.sm,
  },
});
