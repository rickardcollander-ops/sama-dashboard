"use client";

import { PeriodProvider } from "@/lib/hooks/usePeriod";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <PeriodProvider>{children}</PeriodProvider>;
}
