// ============================================
// FRIGO — BROWSE LENS / REFINEMENT CHIP (Phase 11A-CP3)
// ============================================
// Reusable locked-filter chip per the 8E-CP3 master-plan pattern. Two variants:
//   - `lens`        the primary active context/cuisine/search — filled primary,
//                   clear → return to all in place.
//   - `refinement`  a single applied refinement — lighter, clear → remove just
//                   that one refinement.
//
// CP2 shipped a minimal lens-only version; CP3 generalizes the API so the
// same component handles both the lens row and the dismissible refinement
// chip row. WhatCanICookScreen and stats DrillDown can adopt this same chip
// in a later pass (out of scope for CP3 per the prompt).
// ============================================

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

interface Props {
  label: string;
  icon?: IconComponent;
  count?: number;
  variant?: 'lens' | 'refinement';
  onClear: () => void;
  // Optional: tap the chip BODY (not the ✕) — e.g. to adjust a threshold.
  onPress?: () => void;
}

export function BrowseLensChip({
  label,
  icon: IconCmp,
  count,
  variant = 'lens',
  onClear,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const isLens = variant === 'lens';

  const styles = useMemo(() =>
    StyleSheet.create({
      container: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 5,
        borderRadius: 16,
        gap: 6,
        backgroundColor: isLens ? colors.primary : colors.background.card,
        borderWidth: 1,
        borderColor: isLens ? colors.primary : colors.border.medium,
      },
      label: {
        fontSize: 13,
        fontWeight: isLens ? '600' : '500',
        color: isLens ? '#ffffff' : colors.text.primary,
      },
      count: {
        fontSize: 12,
        fontWeight: '600',
        color: isLens ? '#ffffff' : colors.text.tertiary,
        opacity: isLens ? 0.85 : 1,
      },
      body: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      },
      clearButton: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
      },
      clearText: {
        fontSize: 14,
        lineHeight: 14,
        fontWeight: '600',
        color: isLens ? '#ffffff' : colors.text.secondary,
      },
    }),
  [colors, isLens]);

  const Body: any = onPress ? TouchableOpacity : View;
  return (
    <View style={styles.container}>
      <Body style={styles.body} {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}>
        {IconCmp && (
          <IconCmp size={14} color={isLens ? '#ffffff' : colors.text.tertiary} />
        )}
        <Text style={styles.label}>{label}</Text>
        {typeof count === 'number' && (
          <Text style={styles.count}>{count}</Text>
        )}
      </Body>
      <TouchableOpacity
        style={styles.clearButton}
        onPress={onClear}
        accessibilityLabel={`Clear ${label}`}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.clearText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}
