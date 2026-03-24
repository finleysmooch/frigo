// contexts/CookingTimerContext.tsx
// Timer state management for cooking mode.
// Wraps CookingScreen — timers survive step/section navigation.

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatTime } from '../lib/utils/timerDetection';

// ── Types ──

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface Timer {
  id: string;
  label: string;
  stepNumber: number;
  recommendedSeconds: number;
  elapsedSeconds: number;
  status: TimerStatus;
  notificationId?: string;
}

interface CookingTimerContextValue {
  timers: Timer[];
  startTimer: (label: string, stepNumber: number, recommendedSeconds: number) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  resetTimer: (id: string) => void;
  addTime: (id: string, seconds: number) => void;
  dismissTimer: (id: string) => void;
  recipeTitle: string;
}

const CookingTimerContext = createContext<CookingTimerContextValue | null>(null);

export function useCookingTimers() {
  const ctx = useContext(CookingTimerContext);
  if (!ctx) throw new Error('useCookingTimers must be inside CookingTimerProvider');
  return ctx;
}

// ── Configure notification handler ──

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Provider ──

interface ProviderProps {
  recipeTitle: string;
  children: ReactNode;
}

export function CookingTimerProvider({ recipeTitle, children }: ProviderProps) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionRequested = useRef(false);

  // Request notification permissions once
  const ensurePermissions = useCallback(async () => {
    if (permissionRequested.current) return;
    permissionRequested.current = true;

    if (Platform.OS === 'web') return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  }, []);

  // Schedule a notification for when a timer will complete
  const scheduleNotification = useCallback(
    async (timer: Timer): Promise<string | undefined> => {
      if (Platform.OS === 'web') return undefined;

      const remaining = timer.recommendedSeconds - timer.elapsedSeconds;
      if (remaining <= 0) return undefined;

      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏱ ${timer.label} timer done!`,
            body: recipeTitle,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: remaining,
          },
        });
        return id;
      } catch {
        return undefined;
      }
    },
    [recipeTitle]
  );

  // Cancel a scheduled notification
  const cancelNotification = useCallback(async (notificationId?: string) => {
    if (!notificationId || Platform.OS === 'web') return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // ignore
    }
  }, []);

  // ── Tick: runs every second, updates all running timers ──
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimers(prev => {
        let changed = false;
        const next = prev.map(t => {
          if (t.status !== 'running') return t;
          changed = true;
          const elapsed = t.elapsedSeconds + 1;

          if (elapsed >= t.recommendedSeconds && t.status === 'running') {
            // Timer complete
            return { ...t, elapsedSeconds: elapsed, status: 'done' as TimerStatus };
          }
          return { ...t, elapsedSeconds: elapsed };
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Actions ──

  const startTimer = useCallback(
    async (label: string, stepNumber: number, recommendedSeconds: number) => {
      await ensurePermissions();

      const id = `timer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const timer: Timer = {
        id,
        label,
        stepNumber,
        recommendedSeconds,
        elapsedSeconds: 0,
        status: 'running',
      };

      // Schedule notification
      const notificationId = await scheduleNotification(timer);

      setTimers(prev => [...prev, { ...timer, notificationId }]);
    },
    [ensurePermissions, scheduleNotification]
  );

  const pauseTimer = useCallback(
    (id: string) => {
      setTimers(prev =>
        prev.map(t => {
          if (t.id !== id || t.status !== 'running') return t;
          cancelNotification(t.notificationId);
          return { ...t, status: 'paused', notificationId: undefined };
        })
      );
    },
    [cancelNotification]
  );

  const resumeTimer = useCallback(
    async (id: string) => {
      setTimers(prev =>
        prev.map(t => {
          if (t.id !== id || t.status !== 'paused') return t;
          // Re-schedule notification (async, fire-and-forget for state update)
          scheduleNotification(t).then(notifId => {
            setTimers(p =>
              p.map(tt => (tt.id === id ? { ...tt, notificationId: notifId } : tt))
            );
          });
          return { ...t, status: 'running' };
        })
      );
    },
    [scheduleNotification]
  );

  const resetTimer = useCallback(
    (id: string) => {
      setTimers(prev =>
        prev.map(t => {
          if (t.id !== id) return t;
          cancelNotification(t.notificationId);
          return { ...t, elapsedSeconds: 0, status: 'idle', notificationId: undefined };
        })
      );
    },
    [cancelNotification]
  );

  const addTime = useCallback(
    (id: string, seconds: number) => {
      setTimers(prev =>
        prev.map(t => {
          if (t.id !== id) return t;
          const newRec = t.recommendedSeconds + seconds;
          // If was done, set back to running
          const newStatus: TimerStatus = t.status === 'done' ? 'running' : t.status;
          // Reschedule notification if running
          if (newStatus === 'running') {
            cancelNotification(t.notificationId);
            const updatedTimer = { ...t, recommendedSeconds: newRec, status: newStatus };
            scheduleNotification(updatedTimer).then(notifId => {
              setTimers(p =>
                p.map(tt => (tt.id === id ? { ...tt, notificationId: notifId } : tt))
              );
            });
          }
          return { ...t, recommendedSeconds: newRec, status: newStatus };
        })
      );
    },
    [cancelNotification, scheduleNotification]
  );

  const dismissTimer = useCallback(
    (id: string) => {
      setTimers(prev => {
        const timer = prev.find(t => t.id === id);
        if (timer?.notificationId) cancelNotification(timer.notificationId);
        return prev.filter(t => t.id !== id);
      });
    },
    [cancelNotification]
  );

  // Clean up notifications on unmount
  useEffect(() => {
    return () => {
      timers.forEach(t => {
        if (t.notificationId) cancelNotification(t.notificationId);
      });
    };
  }, []); // intentionally empty — cleanup on unmount only

  return (
    <CookingTimerContext.Provider
      value={{
        timers,
        startTimer,
        pauseTimer,
        resumeTimer,
        resetTimer,
        addTime,
        dismissTimer,
        recipeTitle,
      }}
    >
      {children}
    </CookingTimerContext.Provider>
  );
}
