import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TM-portalen — Sama",
  description: "Telemarketing-portal för kampanjlistor",
};

/**
 * Standalone layout for the TM portal. Intentionally minimal — no
 * customer/admin nav, no providers — so a logged-in operator only sees
 * the campaign list page and nothing else from the dashboard.
 */
export default function TmLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
