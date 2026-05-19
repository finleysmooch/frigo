// ============================================
// FRIGO - SPAWN-ON-OUT TOAST CONTEXT (Phase 8R-CP6b, Tab 9)
// ============================================
// Sibling pattern to CookDepletionBannerContext. Holds the in-flight spawn
// toast state (supply that just transitioned to 'out' + the spawned need ID +
// the prior status for Undo). Provider auto-dismisses after 5s; Edit/Undo
// dismiss explicitly via consumer-side calls.
//
// Conflict suppression: callers should check useCookDepletionBanner() before
// invoking showToast — when the banner is showing, skip the toast (cook flow
// already surfaces the same intent via its own UX). Implemented at call sites
// rather than inside the provider to keep this context independent of the
// banner context (no cross-context coupling).
// Location: contexts/SpawnOnOutToastContext.tsx
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
  spawnedNeedId: string;
  priorStatus: SupplyStatus; // for Undo
}

interface SpawnOnOutToastContextValue {
  currentToast: ToastState | null;
  showToast: (
    supply: SupplyWithTags,
    spawnedNeedId: string,
    priorStatus: SupplyStatus
  ) => void;
  dismissToast: () => void;
}

const SpawnOnOutToastContext = createContext<
  SpawnOnOutToastContextValue | undefined
>(undefined);

interface ProviderProps {
  children: ReactNode;
}

export function SpawnOnOutToastProvider({ children }: ProviderProps) {
  const [currentToast, setCurrentToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setCurrentToast(null);
  }, []);

  const showToast = useCallback(
    (supply: SupplyWithTags, spawnedNeedId: string, priorStatus: SupplyStatus) => {
      setCurrentToast({ supply, spawnedNeedId, priorStatus });
    },
    []
  );

  // Auto-dismiss timer.
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

  const value = useMemo<SpawnOnOutToastContextValue>(
    () => ({ currentToast, showToast, dismissToast }),
    [currentToast, showToast, dismissToast]
  );

  return (
    <SpawnOnOutToastContext.Provider value={value}>
      {children}
    </SpawnOnOutToastContext.Provider>
  );
}

export function useSpawnOnOutToast(): SpawnOnOutToastContextValue {
  const ctx = useContext(SpawnOnOutToastContext);
  if (ctx === undefined) {
    throw new Error(
      'useSpawnOnOutToast must be used within a SpawnOnOutToastProvider'
    );
  }
  return ctx;
}
