"use client";

import { useCallback, useEffect, useRef } from "react";

// Accumulates foreground ("visible") seconds for whichever approval is
// currently open, so we can report how long a reviewer actually worked on a
// ticket before deciding. Only counts time while the tab is visible — same
// reasoning as usePresenceHeartbeat.ts — so leaving the tab parked in the
// background doesn't inflate the active-time metric.
export function useActiveTimer() {
  const activeId = useRef<string | null>(null);
  const accumulated = useRef(0); // seconds banked for the active id
  const lastTick = useRef<number | null>(null); // ms anchor of the current accrual

  // Bank "now - lastTick" into the accumulator and clear the anchor.
  const flushElapsed = useCallback(() => {
    if (lastTick.current !== null) {
      accumulated.current += (Date.now() - lastTick.current) / 1000;
      lastTick.current = null;
    }
  }, []);

  // Begin timing `id`. A repeat call for the already-active item is a no-op so
  // clicks inside the same card don't disturb its running tally. Switching to a
  // different item discards the previous one — we only report the item that
  // gets a decision.
  const start = useCallback((id: string) => {
    if (activeId.current === id) return;
    activeId.current = id;
    accumulated.current = 0;
    lastTick.current = document.visibilityState === "visible" ? Date.now() : null;
  }, []);

  // Stop timing and return whole seconds spent on `id` (0 if it isn't active).
  const stop = useCallback(
    (id: string): number => {
      if (activeId.current !== id) return 0;
      flushElapsed();
      const total = Math.round(accumulated.current);
      activeId.current = null;
      accumulated.current = 0;
      return total;
    },
    [flushElapsed],
  );

  // Pause accrual when the tab hides, resume when it returns.
  useEffect(() => {
    const onVisibility = () => {
      if (activeId.current === null) return;
      if (document.visibilityState === "visible") lastTick.current = Date.now();
      else flushElapsed();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flushElapsed]);

  return { start, stop };
}
