// ============================================
// FRIGO - ACQUIRE LOT TOAST CONTEXT (Phase 8R-CP6e-FlowsUI-b1)
// ============================================
// Sibling pattern to SpawnOnOutToastContext + CookDepletionBannerContext.
// Holds the in-flight acquire-lot toast state (need id, supply, freshly-
// created lot, and the supply's status at acquire time for Undo).
//
// Unlike SpawnOnOutToastContext, the auto-dismiss timer lives in the toast
// COMPONENT — not the provider — so the toast can pause-on-edit-sheet-open
// and resume on close with a fresh 5s. Mirrors CookDepletionBanner's
// approach.
// Location: contexts/AcquireLotToastContext.tsx
// ============================================

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import {
  SupplyLot,
  SupplyStatus,
  SupplyWithTags,
} from '../lib/types/supplies';

export interface AcquireLotToastPayload {
  needId: string;                    // for Undo's setNeedStatus revert
  supply: SupplyWithTags;            // for display name + supply_id
  lot: SupplyLot;                    // freshly-created lot
  statusBefore: SupplyStatus | null; // for Undo's setSupplyStatus revert
}

interface AcquireLotToastContextValue {
  currentToast: AcquireLotToastPayload | null;
  showToast: (payload: AcquireLotToastPayload) => void;
  dismissToast: () => void;
}

const AcquireLotToastContext = createContext<
  AcquireLotToastContextValue | undefined
>(undefined);

interface ProviderProps {
  children: ReactNode;
}

export function AcquireLotToastProvider({ children }: ProviderProps) {
  const [currentToast, setCurrentToast] =
    useState<AcquireLotToastPayload | null>(null);

  const showToast = useCallback((payload: AcquireLotToastPayload) => {
    // Singleton — replaces any existing toast.
    setCurrentToast(payload);
  }, []);

  const dismissToast = useCallback(() => {
    setCurrentToast(null);
  }, []);

  const value = useMemo<AcquireLotToastContextValue>(
    () => ({ currentToast, showToast, dismissToast }),
    [currentToast, showToast, dismissToast]
  );

  return (
    <AcquireLotToastContext.Provider value={value}>
      {children}
    </AcquireLotToastContext.Provider>
  );
}

export function useAcquireLotToast(): AcquireLotToastContextValue {
  const ctx = useContext(AcquireLotToastContext);
  if (ctx === undefined) {
    throw new Error(
      'useAcquireLotToast must be used within an AcquireLotToastProvider'
    );
  }
  return ctx;
}
