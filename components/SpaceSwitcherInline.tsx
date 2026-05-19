// ============================================
// FRIGO — INLINE SPACE SWITCHER (Phase 8R-CP6d-SmokeFix-4 Task 4)
// ============================================
// Anchored-near-icon dropdown variant of SpaceSwitcher. Opened by tapping
// the home-icon in PantryScreen's header. Compact panel — emoji + name +
// checkmark — list of spaces; tap to switch + close.
//
// The existing bottom-sheet SpaceSwitcher stays for any other consumers.
// This file is the inline variant; pick the right one at the consumer.
// Location: components/SpaceSwitcherInline.tsx
// ============================================

import { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSpaceSwitcher } from '../contexts/SpaceContext';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';

export interface SpaceSwitcherInlineProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Optional create-space hook. If omitted, the "Create new space" footer
   * is hidden. Mirrors the bottom-sheet SpaceSwitcher's prop.
   */
  onCreateSpace?: () => void;
  /**
   * CP6d-SmokeFix-4 follow-up: tap the small grey "Edit" pill on a space
   * row → routes to SpaceSettings for that space. Per Tom: this is the
   * ONLY entrypoint into SpaceSettings now.
   */
  onEditSpace?: (spaceId: string) => void;
}

export default function SpaceSwitcherInline({
  visible,
  onClose,
  onCreateSpace,
  onEditSpace,
}: SpaceSwitcherInlineProps) {
  const { colors, functionalColors } = useTheme();
  const { currentSpace, spaces, isSwitching, switchTo } = useSpaceSwitcher();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Translucent background so the dropdown appears anchored to the
        // header rather than as a centered/bottom-sheet modal. The dropdown
        // itself is positioned near the top-right (where the home icon is).
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.15)',
        },
        dropdown: {
          position: 'absolute',
          top: 96, // ~ header height (paddingTop 60 + padding + icon row)
          right: 16,
          minWidth: 220,
          maxWidth: 280,
          maxHeight: '70%',
          backgroundColor: colors.background.card,
          borderRadius: borderRadius.md,
          paddingVertical: 6,
          ...shadows.large,
        },
        title: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          color: colors.text.tertiary,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
        },
        loadingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
        },
        loadingText: {
          fontSize: typography.sizes.sm,
          color: colors.text.tertiary,
        },
        spaceRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
        },
        spaceRowActive: {
          backgroundColor: colors.primaryLight,
        },
        spaceRowSelect: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        emoji: {
          fontSize: 18,
        },
        nameCol: {
          flex: 1,
        },
        name: {
          fontSize: typography.sizes.md,
          color: colors.text.primary,
          fontWeight: typography.weights.medium,
        },
        nameActive: {
          color: colors.primary,
        },
        meta: {
          fontSize: 11,
          color: colors.text.tertiary,
          marginTop: 2,
        },
        check: {
          fontSize: typography.sizes.md,
          color: colors.primary,
          fontWeight: typography.weights.bold,
        },
        // CP6d-SmokeFix-4 follow-up: edit pill — only routing into SpaceSettings.
        editPill: {
          marginLeft: 8,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.background.secondary,
        },
        editPillText: {
          fontSize: 11,
          color: colors.text.secondary,
          fontWeight: typography.weights.medium,
          letterSpacing: 0.4,
        },
        divider: {
          height: 1,
          backgroundColor: colors.border.light,
          marginVertical: 4,
        },
        footerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
        },
        footerPlus: {
          fontSize: typography.sizes.lg,
          color: colors.primary,
          fontWeight: typography.weights.bold,
        },
        footerLabel: {
          fontSize: typography.sizes.sm,
          color: colors.primary,
          fontWeight: typography.weights.medium,
        },
      }),
    [colors, functionalColors]
  );

  const handleSelect = async (spaceId: string) => {
    if (currentSpace?.id !== spaceId) {
      await switchTo(spaceId);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dropdown} onPress={() => {}}>
          <Text style={styles.title}>Switch space</Text>
          {!currentSpace ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.text.tertiary} />
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          ) : (
            <ScrollView>
              {spaces.map((s) => {
                const active = s.id === currentSpace.id;
                return (
                  <View
                    key={s.id}
                    style={[styles.spaceRow, active && styles.spaceRowActive]}
                  >
                    <TouchableOpacity
                      style={styles.spaceRowSelect}
                      onPress={() => handleSelect(s.id)}
                      disabled={isSwitching}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Switch to ${s.name}`}
                    >
                      <Text style={styles.emoji}>{s.emoji}</Text>
                      <View style={styles.nameCol}>
                        <Text
                          style={[styles.name, active && styles.nameActive]}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                        {s.member_count > 1 && (
                          <Text style={styles.meta}>
                            {s.member_count} members
                          </Text>
                        )}
                      </View>
                      {active && <Text style={styles.check}>✓</Text>}
                    </TouchableOpacity>
                    {onEditSpace && (
                      <TouchableOpacity
                        style={styles.editPill}
                        onPress={() => {
                          onClose();
                          onEditSpace(s.id);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${s.name} space details`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.editPillText}>edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
          {onCreateSpace && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.footerRow}
                onPress={() => {
                  onClose();
                  onCreateSpace();
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Create new space"
              >
                <Text style={styles.footerPlus}>+</Text>
                <Text style={styles.footerLabel}>Create new space</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
