// components/stats/CookingPersonalityCard.tsx
// Dark teal personality card with title, narrative, and tag pills.
// Note: gradient (135deg, #065f56 → #0f766e) can be added when expo-linear-gradient is installed.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CookingPersonalityCardProps {
  title: string;
  narrative: string;
  tags: string[];
}

export default function CookingPersonalityCard({ title, narrative, tags }: CookingPersonalityCardProps) {
  const styles = useMemo(() => createStyles(), []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.narrative}>{narrative}</Text>
      {tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    card: {
      backgroundColor: '#0b6b60',
      borderRadius: 14,
      padding: 18,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: '#ffffff',
      marginBottom: 8,
    },
    narrative: {
      fontSize: 13,
      lineHeight: 13 * 1.6,
      color: '#ffffff',
      opacity: 0.85,
      marginBottom: 12,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    tagPill: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    tagText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#ffffff',
    },
  });
}
