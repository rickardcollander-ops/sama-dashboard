"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCustomerPortal = pathname.startsWith("/c/") || pathname === "/c";

  // Customer portal: no admin sidebar, no notification bell
  if (isCustomerPortal) {
    return <>{children}</>;
  }

  // Admin dashboard: full sidebar + notification bell
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="relative flex-1 overflow-y-auto w-0 min-w-0 pt-14 md:pt-0">
        <div className="fixed top-3 right-4 z-40 md:absolute md:top-4 md:right-6">
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
