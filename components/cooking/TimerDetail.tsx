// components/cooking/TimerDetail.tsx
// Expanded timer detail view — large countdown, progress bar, controls.

import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useCookingTimers, type Timer } from '../../contexts/CookingTimerContext';
import { formatTime } from '../../lib/utils/timerDetection';

interface Props {
  timer: Timer;
  onClose: () => void;
}

export default function TimerDetail({ timer, onClose }: Props) {
  const { pauseTimer, resumeTimer, resetTimer, addTime, dismissTimer, timers } =
    useCookingTimers();

  // Get live timer from context (the prop may be stale)
  const live = timers.find(t => t.id === timer.id) || timer;

  const remaining = live.recommendedSeconds - live.elapsedSeconds;
  const progress = live.recommendedSeconds > 0
    ? Math.min(live.elapsedSeconds / live.recommendedSeconds, 1)
    : 0;

  // Other timers (shown dimmed below)
  const others = timers.filter(t => t.id !== live.id && t.status !== 'idle');

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
        {/* Handle bar */}
        <TouchableOpacity onPress={onClose} style={styles.handleArea}>
          <View style={styles.handle} />
        </TouchableOpacity>

        {/* Main timer card */}
        <View style={styles.card}>
          {/* Header: label + countdown | Recipe says + remaining */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.timerLabel}>{live.label.toUpperCase()}</Text>
              <Text
                style={[
                  styles.countdown,
                  live.status === 'done' && styles.countdownDone,
                  live.status === 'paused' && styles.countdownPaused,
                ]}
              >
                {formatTime(live.elapsedSeconds)}
              </Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={styles.recipeLabel}>Recipe says</Text>
              <Text style={styles.recipeTime}>
                {formatTime(live.recommendedSeconds)}
              </Text>
              {live.status !== 'done' && (
                <Text
                  style={[
                    styles.remaining,
                    remaining < 0 && styles.remainingOver,
                  ]}
                >
                  {remaining > 0
                    ? `${formatTime(remaining)} left`
                    : remaining === 0
                      ? 'Done!'
                      : `${formatTime(Math.abs(remaining))} over`}
                </Text>
              )}
              {live.status === 'done' && (
                <Text style={styles.doneLabel}>Done!</Text>
              )}
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progress * 100, 100)}%`,
                  backgroundColor: progress >= 1 ? '#0d9488' : '#84cc16',
                },
              ]}
            />
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {live.status === 'running' && (
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => pauseTimer(live.id)}
              >
                <Text style={styles.controlText}>⏸ Pause</Text>
              </TouchableOpacity>
            )}
            {live.status === 'paused' && (
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => resumeTimer(live.id)}
              >
                <Text style={styles.controlText}>▶ Resume</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => resetTimer(live.id)}
            >
              <Text style={styles.controlText}>↺ Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => addTime(live.id, 60)}
            >
              <Text style={styles.controlText}>+1 min</Text>
            </TouchableOpacity>
            {live.status === 'done' && (
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => {
                  dismissTimer(live.id);
                  onClose();
                }}
              >
                <Text style={styles.controlText}>✕ Dismiss</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Other timers (dimmed) */}
        {others.map(t => (
          <View key={t.id} style={styles.otherRow}>
            <Text style={styles.otherText}>
              ⏱ {t.label} — {t.status === 'done' ? 'done' : formatTime(t.elapsedSeconds)} ({formatTime(t.elapsedSeconds)} / {formatTime(t.recommendedSeconds)})
            </Text>
          </View>
        ))}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f2b29',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 28,
    height: 3,
    backgroundColor: '#1e4845',
    borderRadius: 2,
  },
  card: {
    backgroundColor: '#153633',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timerLabel: {
    fontSize: 11,
    color: '#7eb8b3',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  countdown: {
    fontSize: 32,
    fontWeight: '700',
    color: '#84cc16',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  countdownDone: {
    color: '#0d9488',
  },
  countdownPaused: {
    color: '#f59e0b',
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  recipeLabel: {
    fontSize: 10,
    color: '#5eaba4',
  },
  recipeTime: {
    fontSize: 16,
    color: '#7eb8b3',
    fontVariant: ['tabular-nums'],
  },
  remaining: {
    fontSize: 12,
    color: '#84cc16',
    fontWeight: '600',
    marginTop: 2,
  },
  remainingOver: {
    color: '#f87171',
  },
  doneLabel: {
    fontSize: 12,
    color: '#0d9488',
    fontWeight: '600',
    marginTop: 2,
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#1e4845',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  controlBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#1e4845',
    borderRadius: 8,
  },
  controlText: {
    fontSize: 12,
    color: '#c4e8e5',
    fontWeight: '600',
  },
  otherRow: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    opacity: 0.5,
  },
  otherText: {
    fontSize: 11,
    color: '#7eb8b3',
  },
});
