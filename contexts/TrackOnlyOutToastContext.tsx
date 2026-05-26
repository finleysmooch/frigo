// ============================================
// FRIGO - TRACK_ONLY OUT TOAST CONTEXT (Phase 8R-UX1)
// ============================================
// Sibling of SpawnOnOutToastContext, for track_only supplies marked 'out'
// via the Use Soon swipe gesture. Restock supplies already get the existing
// SpawnOnOutToast (status flip auto-spawns a need + Undo). Track_only
// supplies auto-archive on out with no spawn — this toast lets the user
// opt into adding to the grocery list, and optionally promote the supply to
// 'restock' so future out-events spawn automatically.
//
// Auto-dismisses after 5s.
// Location: contexts/TrackOnlyOutToastContext.tsx
// ============================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { SupplyStatus, SupplyWithTags } from '../lib/types/supplies';

const AUTO_DISMISS_MS = 5_000;

interface ToastState {
  supply: SupplyWithTags;
  priorStatus: SupplyStatus; // for Undo
}

interface TrackOnlyOutToastContextValue {
  currentToast: ToastState | null;
  showToast: (supply: SupplyWithTags, priorStatus: SupplyStatus) => void;
  dismissToast: () => void;
}

const TrackOnlyOutToastContext = createContext<
  TrackOnlyOutToastContextValue | undefined
>(undefined);

interface ProviderProps {
  children: ReactNode;
}

export function TrackOnlyOutToastProvider({ children }: ProviderProps) {
  const [currentToast, setCurrentToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setCurrentToast(null);
  }, []);

  const showToast = useCallback(
    (supply: SupplyWithTags, priorStatus: SupplyStatus) => {
      setCurrentToast({ supply, priorStatus });
    },
    []
  );

  useEffect(() => {
    if (!currentToast) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => {
      setCurrentToast(null);
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentToast]);

  const value = useMemo<TrackOnlyOutToastContextValue>(
    () => ({ currentToast, showToast, dismissToast }),
    [currentToast, showToast, dismissToast]
  );

  return (
    <TrackOnlyOutToastContext.Provider value={value}>
      {children}
    </TrackOnlyOutToastContext.Provider>
  );
}

export function useTrackOnlyOutToast(): TrackOnlyOutToastContextValue {
  const ctx = useContext(TrackOnlyOutToastContext);
  if (ctx === undefined) {
    throw new Error(
      'useTrackOnlyOutToast must be used within a TrackOnlyOutToastProvider'
    );
  }
  return ctx;
}
