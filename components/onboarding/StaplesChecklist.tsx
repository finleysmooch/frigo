// CP3 (D-ON-2 / D-ON-13) — the pantry-staples checklist component.
//
// Standalone by design: hosted by onboarding T11 (CP9 wiring), the empty-pantry
// "Add staples" CTA (T15 / CP9f), and the dev StaplesPlaygroundScreen. The host
// decides navigation via onDone — this component never navigates.
//
// Space-ensure (anchor §6 — THE load-bearing constraint): a brand-new user has
// NO space (handle_new_user doesn't create one). Before the first supplies
// write, this component resolves a real space id: SpaceContext's activeSpaceId
// when the context has initialized, else it awaits ensureDefaultSpace (the one
// existing lazy-create path) directly. Never assume the context's async load
// has won the race.
//
// All DB work goes through staplesService/suppliesService/spaceService — this
// component never touches supabase directly.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { useSpace } from '../../contexts/SpaceContext';
import { ensureDefaultSpace } from '../../lib/services/spaceService';
import { addStaples } from '../../lib/services/staplesService';
import { STAPLES_CHECKLIST, StapleItem } from '../../lib/config/staplesChecklist';

interface Props {
  /** The signed-in user (hosts resolve this; see StaplesPlaygroundScreen). */
  userId: string;
  /** Fired after submit (addedCount > 0) or skip (addedCount === 0). */
  onDone: (addedCount: number) => void;
}

const itemKey = (item: StapleItem) => item.catalogName;

export function StaplesChecklist({ userId, onDone }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeSpaceId, isInitialized } = useSpace();

  // All default-checked (D-ON-2: default in-stock; tap to deselect).
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(STAPLES_CHECKLIST.flatMap((c) => c.items.map(itemKey)))
  );
  const [submitting, setSubmitting] = useState(false);

  const checkedCount = checked.size;

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (checkedCount === 0) {
      onDone(0);
      return;
    }

    setSubmitting(true);
    try {
      // Space-ensure BEFORE the first space-scoped write (anchor §6).
      const spaceId =
        isInitialized && activeSpaceId ? activeSpaceId : await ensureDefaultSpace(userId);

      const items = STAPLES_CHECKLIST.flatMap((c) =>
        c.items.filter((i) => checked.has(itemKey(i)))
      );
      const results = await addStaples(userId, spaceId, items);
      onDone(results.length);
    } catch (error) {
      console.error('❌ StaplesChecklist submit error:', error);
      Alert.alert('Could not add staples', 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {STAPLES_CHECKLIST.map((category) => (
          <View key={category.key} style={styles.category}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            {category.items.map((item) => {
              const key = itemKey(item);
              const isChecked = checked.has(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.row}
                  onPress={() => toggle(key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                >
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                    {isChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.cta, submitting && styles.ctaDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.background.card} />
        ) : (
          <Text style={styles.ctaText}>
            {checkedCount > 0 ? `Add ${checkedCount} staples →` : 'Skip for now'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 16,
    },
    category: {
      marginBottom: 20,
    },
    categoryTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.text.secondary,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      backgroundColor: colors.background.card,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      color: colors.background.card,
      fontSize: 14,
      fontWeight: '700',
    },
    rowLabel: {
      fontSize: 16,
      color: colors.text.primary,
    },
    cta: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    ctaDisabled: {
      opacity: 0.6,
    },
    ctaText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
  });
