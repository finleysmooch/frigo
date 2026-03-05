// components/stats/FrontierCards.tsx
// Horizontal scrollable cards showing "Worth Exploring" frontier suggestions.
// Each card: dashed border, amber label, bold title, gray description.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius } from '../../lib/theme';
import type { FrontierSuggestion } from '../../lib/services/statsService';

interface FrontierCardsProps {
  suggestions: FrontierSuggestion[];
  onSuggestionPress: (suggestion: FrontierSuggestion) => void;
  loading?: boolean;
}

export default function FrontierCards({ suggestions, onSuggestionPress, loading }: FrontierCardsProps) {
  const { colors } = useTheme();

  if (loading) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 16 }}
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Text style={{ fontSize: typography.sizes.sm, color: colors.text.tertiary, textAlign: 'center', paddingVertical: spacing.lg }}>
        You're exploring everything! 🎉
      </Text>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 16 }}
    >
      {suggestions.map((suggestion, i) => (
        <TouchableOpacity
          key={`${suggestion.type}-${suggestion.title}-${i}`}
          style={[styles.card, { borderColor: colors.border.default || '#d1d5db', backgroundColor: colors.background.card }]}
          onPress={() => onSuggestionPress(suggestion)}
          activeOpacity={0.7}
        >
          <Text style={styles.label}>{suggestion.label.toUpperCase()}</Text>
          <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={2}>{suggestion.title}</Text>
          <Text style={[styles.description, { color: colors.text.tertiary }]} numberOfLines={3}>{suggestion.description}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[styles.card, styles.skeleton, { opacity }]} />
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 12,
  },
  skeleton: {
    height: 120,
    backgroundColor: '#e5e7eb',
  },
  label: {
    fontSize: 9,
    fontWeight: typography.weights.semibold as any,
    color: '#f59e0b',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: typography.weights.bold as any,
    marginBottom: 4,
  },
  description: {
    fontSize: 10,
    lineHeight: 14,
  },
});
