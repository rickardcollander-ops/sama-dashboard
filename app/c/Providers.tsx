"use client";

import { type ReactNode } from "react";
import { PeriodProvider } from "@/lib/hooks/usePeriod";
import { ActiveRunsProvider } from "@/lib/hooks/useActiveRuns";
import { SiteProvider } from "@/lib/hooks/useSite";
import { usePresenceHeartbeat } from "@/lib/hooks/usePresenceHeartbeat";
import ActiveRunsBanner from "@/components/ActiveRunsBanner";
import AdminViewBanner from "@/components/AdminViewBanner";

function PresenceHeartbeat() {
  usePresenceHeartbeat();
  return null;
}

// Children render without a tenant-scoped key. Every explicit tenant
// switch (setActiveSiteId / setActiveAccountId / setViewAs /
// clearViewAs) already does window.location.reload(), so we don't need
// a key-based remount for cross-tenant safety. The previous keyed
// Fragment was unmounting the entire page tree each time
// `effectiveTenantId` flickered through "" → user.id → site.id during
// initial site resolution, killing the dashboard's in-flight API batch
// and forcing it to refetch from scratch.
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SiteProvider>
      <PeriodProvider>
        <ActiveRunsProvider>
          <PresenceHeartbeat />
          <AdminViewBanner />
          {children}
          <ActiveRunsBanner />
        </ActiveRunsProvider>
      </PeriodProvider>
    </SiteProvider>
  );
}
