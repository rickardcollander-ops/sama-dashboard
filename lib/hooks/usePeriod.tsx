"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Period } from "@/components/dashboard/PeriodSelector";

const STORAGE_KEY = "sama-period";
const VALID: Period[] = ["7d", "30d", "90d"];

interface PeriodCtx {
  period: Period;
  setPeriod: (p: Period) => void;
  days: number;
}

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

const PeriodContext = createContext<PeriodCtx>({
  period: "30d",
  setPeriod: () => {},
  days: 30,
});

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodRaw] = useState<Period>("30d");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Period | null;
      if (saved && VALID.includes(saved)) setPeriodRaw(saved);
    } catch {}
  }, []);

  const setPeriod = (p: Period) => {
    setPeriodRaw(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {}
  };

  return (
    <PeriodContext.Provider value={{ period, setPeriod, days: PERIOD_DAYS[period] }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod(): PeriodCtx {
  return useContext(PeriodContext);
}
