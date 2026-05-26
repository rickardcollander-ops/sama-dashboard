"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PeriodProvider } from "@/lib/hooks/usePeriod";
import { ActiveRunsProvider } from "@/lib/hooks/useActiveRuns";
import { SiteProvider } from "@/lib/hooks/useSite";
import { usePresenceHeartbeat } from "@/lib/hooks/usePresenceHeartbeat";
import ActiveRunsBanner from "@/components/ActiveRunsBanner";
import AdminViewBanner from "@/components/AdminViewBanner";
import TrialBanner from "@/components/TrialBanner";

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
  // Created once per browser session via lazy useState (never on the server),
  // and mounted in this layout — which Next.js keeps alive across client-side
  // navigations within /c/*. That persistence is what makes leaving a page and
  // returning instant: cached query data is served immediately while a
  // background refetch (gated by staleTime) keeps it fresh.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            // lib/api.ts already retries 5xx with backoff; one extra is plenty.
            retry: 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SiteProvider>
        <PeriodProvider>
          <ActiveRunsProvider>
            <PresenceHeartbeat />
            <AdminViewBanner />
            <TrialBanner />
            {children}
            <ActiveRunsBanner />
          </ActiveRunsProvider>
        </PeriodProvider>
      </SiteProvider>
    </QueryClientProvider>
  );
}
