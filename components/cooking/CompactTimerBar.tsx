// components/cooking/CompactTimerBar.tsx
// Single-line timer pills: ⏱ Soak 14:22 /20:00 · Onion ✓ · Crisp 4:30 /7:00

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useCookingTimers, type Timer } from '../../contexts/CookingTimerContext';
import { formatTime } from '../../lib/utils/timerDetection';

interface Props {
  onTimerTap: (timer: Timer) => void;
}

export default function CompactTimerBar({ onTimerTap }: Props) {
  const { timers } = useCookingTimers();

  // Only show timers that are running, paused, or done (not idle)
  const visible = timers.filter(t => t.status !== 'idle');

  if (visible.length === 0) {
    return (
      <View style={styles.emptyRow}>
        <Text style={styles.emptyText}>⏱ No active timers</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.icon}>⏱</Text>
      {visible.map((timer, i) => (
        <View key={timer.id} style={styles.pillRow}>
          {i > 0 && <Text style={styles.separator}>·</Text>}
          <TouchableOpacity
            style={[
              styles.pill,
              timer.status === 'done' && styles.pillDone,
            ]}
            onPress={() => onTimerTap(timer)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, timer.status === 'done' && styles.labelDone]}>
              {timer.label}
            </Text>
            {timer.status === 'done' ? (
              <Text style={styles.checkmark}>✓</Text>
            ) : (
              <>
                <Text
                  style={[
                    styles.time,
                    timer.status === 'paused' && styles.timePaused,
                  ]}
                >
                  {formatTime(timer.elapsedSeconds)}
                </Text>
                <Text style={styles.recommended}>
                  /{formatTime(timer.recommendedSeconds)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 30,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
  },
  icon: {
    fontSize: 11,
    color: '#7eb8b3',
    marginRight: 2,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    fontSize: 10,
    color: '#1e4845',
    marginHorizontal: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pillDone: {
    backgroundColor: 'rgba(13,148,136,0.15)',
    borderColor: '#0d9488',
  },
  label: {
    fontSize: 10,
    color: '#c4e8e5',
    fontWeight: '600',
  },
  labelDone: {
    color: '#0d9488',
  },
  time: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#84cc16',
  },
  timePaused: {
    color: '#f59e0b',
  },
  recommended: {
    fontSize: 9,
    color: '#5eaba4',
  },
  checkmark: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d9488',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  emptyText: {
    fontSize: 11,
    color: '#5eaba4',
  },
});
