import { useCallback, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// ============================================
// useCollapsibleHeader — collapsing chrome for a scroll list
// ============================================
// 11D search UX: as the user scrolls DOWN into a result list, the filter chrome
// (search bar + filter line + status) collapses to a single tappable pill so
// more of the screen goes to recipes. Shared by RecipeListScreen + BookView.
//
// "Sticky-collapsed" model (Tom-tuned): once collapsed it STAYS collapsed while
// scrolling — no upscroll reveal. It re-expands only when the user:
//   (a) scrolls back to the very top, or
//   (b) taps the collapsed pill (calls `expand()`).
// An accumulator (reset on any upward move) makes collapse work at any scroll
// speed while ignoring jitter.
//
// Usage:
//   const { collapsed, onScroll, expand } = useCollapsibleHeader();
//   <FlatList onScroll={onScroll} scrollEventThrottle={16} ... />
//   {collapsed ? <Pill onPress={() => { expand(); scrollToTop(); }} /> : <FullChrome />}
export function useCollapsibleHeader(opts: {
  collapseDistance?: number; // downward run (px) before collapsing
} = {}) {
  const { collapseDistance = 24 } = opts;

  const [collapsed, setCollapsed] = useState(false);
  const lastY = useRef(0);
  const downRun = useRef(0); // accumulated downward movement (px) since last reset

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      lastY.current = y;

      // Re-expand only at/near the very top.
      if (y <= 4) {
        downRun.current = 0;
        setCollapsed(false);
        return;
      }

      // Scrolling up does NOT reveal — just reset the downward run.
      if (dy < 0) {
        downRun.current = 0;
        return;
      }

      // Accumulate downward movement; collapse after a short run.
      downRun.current += dy;
      if (downRun.current > collapseDistance) {
        setCollapsed(true);
        downRun.current = 0;
      }
    },
    [collapseDistance],
  );

  // Force-expand (tapping the collapsed pill, or entering a fresh view).
  const expand = useCallback(() => {
    downRun.current = 0;
    setCollapsed(false);
  }, []);

  return { collapsed, onScroll, expand };
}
