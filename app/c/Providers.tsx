"use client";

import { PeriodProvider } from "@/lib/hooks/usePeriod";
import { ActiveRunsProvider } from "@/lib/hooks/useActiveRuns";
import ActiveRunsBanner from "@/components/ActiveRunsBanner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      <ActiveRunsProvider>
        {children}
        <ActiveRunsBanner />
      </ActiveRunsProvider>
    </PeriodProvider>
  );
}
