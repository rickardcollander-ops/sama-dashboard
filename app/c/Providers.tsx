"use client";

import { Fragment, type ReactNode } from "react";
import { PeriodProvider } from "@/lib/hooks/usePeriod";
import { ActiveRunsProvider } from "@/lib/hooks/useActiveRuns";
import { SiteProvider, useSite } from "@/lib/hooks/useSite";
import ActiveRunsBanner from "@/components/ActiveRunsBanner";
import AdminViewBanner from "@/components/AdminViewBanner";

// Force a clean remount of the page tree when the active site (or admin
// view-as target) changes. Each site is treated as its own workspace, so
// switching wipes per-page state (filters, fetched data, in-flight loads)
// instead of leaving stale data from the previous site on screen.
function SiteScopedChildren({ children }: { children: ReactNode }) {
  const { effectiveTenantId } = useSite();
  return <Fragment key={effectiveTenantId || "no-site"}>{children}</Fragment>;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SiteProvider>
      <PeriodProvider>
        <ActiveRunsProvider>
          <AdminViewBanner />
          <SiteScopedChildren>{children}</SiteScopedChildren>
          <ActiveRunsBanner />
        </ActiveRunsProvider>
      </PeriodProvider>
    </SiteProvider>
  );
}
