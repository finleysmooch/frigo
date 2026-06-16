// In-process recipe imports strip (Tom's walk feedback, 2026-06-12).
// Renders NOTHING unless the session's background import queue
// (lib/services/recipeImportQueue) has jobs — a compact status strip showing
// working spinners / Imported pills / failures. Self-contained and additive:
// host screens (RecipeListScreen; the onboarding T9a screen has its own fuller
// list) just drop it in. Session-scoped — jobs don't persist across restarts.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import {
  subscribeToImports,
  getImportJobs,
  ImportJob,
} from '../../lib/services/recipeImportQueue';

export function ImportQueueStrip() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [jobs, setJobs] = useState<ImportJob[]>(getImportJobs());

  useEffect(() => subscribeToImports(setJobs), []);

  if (jobs.length === 0) return null;

  return (
    <View style={styles.strip}>
      {jobs.map((job) => (
        <View key={job.id} style={styles.row}>
          {job.status === 'working' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.mark}>{job.status === 'done' ? '✓' : '✕'}</Text>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {job.title ?? job.domain}
          </Text>
          <Text style={styles.status}>
            {job.status === 'working' ? 'importing…' : job.status === 'done' ? 'imported' : 'failed'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    strip: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 4,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
    mark: { fontSize: 13, fontWeight: '700', color: colors.primary, width: 16, textAlign: 'center' },
    title: { flex: 1, fontSize: 13, color: colors.text.primary },
    status: { fontSize: 11, color: colors.text.tertiary },
  });
