// ============================================
// FRIGO - COOK DEPLETION BANNER CONTEXT
// ============================================
// Global singleton state for the cook-post depletion banner. Exactly one
// banner visible at a time; `showBanner` replaces any existing one.
// Introduced: Phase 8B-CP4.
// CP6e-FlowsUI-a: added `updateSupplyEntry` so the LotPickerModal confirm
// path can sync a revised entry back into the shared plan (banner Undo
// then reverses the revised lots, not the original auto-pick).
// Location: contexts/CookDepletionBannerContext.tsx
// ============================================

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { DepletionPlan, DepletionSupply } from '../lib/cookDepletionService';

interface BannerState {
  plan: DepletionPlan;
}

interface CookDepletionBannerContextValue {
  currentBanner: BannerState | null;
  showBanner: (plan: DepletionPlan) => void;
  dismissBanner: () => void;
  /**
   * CP6e-FlowsUI-a. Replace a single entry in the current banner's plan
   * (matched by supply_id) and rebuild a fresh BannerState so React
   * consumers re-render. No-op when no banner is showing or the supply_id
   * isn't in the plan.
   */
  updateSupplyEntry: (
    supplyId: string,
    updatedEntry: DepletionSupply
  ) => void;
}

const CookDepletionBannerContext = createContext<
  CookDepletionBannerContextValue | undefined
>(undefined);

interface ProviderProps {
  children: ReactNode;
}

export function CookDepletionBannerProvider({ children }: ProviderProps) {
  const [currentBanner, setCurrentBanner] = useState<BannerState | null>(null);

  const showBanner = useCallback((plan: DepletionPlan) => {
    setCurrentBanner({ plan });
  }, []);

  const dismissBanner = useCallback(() => {
    setCurrentBanner(null);
  }, []);

  const updateSupplyEntry = useCallback(
    (supplyId: string, updatedEntry: DepletionSupply) => {
      setCurrentBanner((prev) => {
        if (!prev) return prev;
        const idx = prev.plan.supplies.findIndex(
          (s) => s.supply_id === supplyId
        );
        if (idx === -1) return prev;
        // Build new supplies array preserving order; replace matched entry.
        const nextSupplies = prev.plan.supplies.map((s, i) =>
          i === idx ? updatedEntry : s
        );
        // Fresh BannerState object — reference equality matters for
        // re-renders. nextSupplies is a new array; the plan/banner wrappers
        // are also fresh.
        return {
          plan: { ...prev.plan, supplies: nextSupplies },
        };
      });
    },
    []
  );

  const value = useMemo<CookDepletionBannerContextValue>(
    () => ({ currentBanner, showBanner, dismissBanner, updateSupplyEntry }),
    [currentBanner, showBanner, dismissBanner, updateSupplyEntry]
  );

  return (
    <CookDepletionBannerContext.Provider value={value}>
      {children}
    </CookDepletionBannerContext.Provider>
  );
}

export function useCookDepletionBanner(): CookDepletionBannerContextValue {
  const context = useContext(CookDepletionBannerContext);
  if (context === undefined) {
    throw new Error(
      'useCookDepletionBanner must be used within a CookDepletionBannerProvider'
    );
  }
  return context;
}
