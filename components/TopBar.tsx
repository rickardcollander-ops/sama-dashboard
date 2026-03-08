"use client";

import { usePathname } from "next/navigation";
import NotificationBell from "./NotificationBell";
import DarkModeToggle from "./DarkModeToggle";
import ExportButton from "./ExportButton";

const PAGE_TITLES: Record<string, string> = {
  '/': 'Command Center',
  '/seo': 'SEO Agent',
  '/content': 'Content Agent',
  '/ads': 'Google Ads Agent',
  '/social': 'Social Media Agent',
  '/reviews': 'Reviews Agent',
  '/analytics': 'Analytics',
  '/ai-visibility': 'AI Visibility',
  '/content-analytics': 'Content Analytics',
  '/budget-optimizer': 'Budget Optimizer',
  '/anomalies': 'Anomaly Detection',
  '/approvals': 'Approvals',
  '/logs': 'Activity Logs',
  '/settings': 'Settings',
  '/calendar': 'Content Calendar',
};

export default function TopBar() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  const title = PAGE_TITLES[pathname] || '';

  return (
    <div className="hidden md:flex items-center justify-end gap-2 border-b bg-white px-4 py-2 flex-shrink-0">
      <ExportButton />
      <DarkModeToggle />
      <NotificationBell />
    </div>
  );
}
