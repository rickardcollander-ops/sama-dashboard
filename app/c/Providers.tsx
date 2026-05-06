"use client";

import type { ReactNode } from "react";
import { PeriodProvider } from "@/lib/hooks/usePeriod";
import { ActiveRunsProvider } from "@/lib/hooks/useActiveRuns";
import { SiteProvider } from "@/lib/hooks/useSite";
import ActiveRunsBanner from "@/components/ActiveRunsBanner";
import AdminViewBanner from "@/components/AdminViewBanner";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SiteProvider>
      <PeriodProvider>
        <ActiveRunsProvider>
          <AdminViewBanner />
          {children}
          <ActiveRunsBanner />
        </ActiveRunsProvider>
      </PeriodProvider>
    </SiteProvider>
  );
}
