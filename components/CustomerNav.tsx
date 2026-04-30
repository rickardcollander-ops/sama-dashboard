"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart2, Settings, LogOut, Menu, X, Bot,
  Search, FileText, Share2, TrendingUp, CreditCard, Megaphone, Sparkles, ShieldCheck,
} from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import NotificationBell from "@/components/NotificationBell";

const NAV_ITEMS = [
  { href: "/c/dashboard", label: "Dashboard", icon: BarChart2 },
  { href: "/c/analysis", label: "Analysis", icon: Sparkles },
  { href: "/c/seo", label: "SEO", icon: Search },
  { href: "/c/content", label: "Content", icon: FileText },
  { href: "/c/social", label: "Social", icon: Share2 },
  { href: "/c/ads", label: "Ads", icon: Megaphone },
  { href: "/c/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/c/geo", label: "GEO Monitor", icon: Bot },
  { href: "/c/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/c/settings", label: "Settings", icon: Settings },
];

const BOTTOM_NAV_ITEMS = [
  { href: "/c/pricing", label: "Plan", icon: CreditCard },
];

export default function CustomerNav() {
  const pathname = usePathname();
  const { user, signOut } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="sm:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/c/dashboard" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold text-slate-900">SAMA</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 ml-6">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold shadow-[inset_0_-2px_0_0_#2563eb]"
                      : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              );
            })}
            <div className="mx-2 h-5 w-px bg-slate-200" />
            {BOTTOM_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          {user && (
            <span className="hidden sm:block text-xs text-slate-400 truncate max-w-[180px]">
              {user.email}
            </span>
          )}
          <button
            onClick={signOut}
            title="Sign out"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30 sm:hidden" onClick={() => setMobileOpen(false)} />
          <nav className="fixed top-14 left-0 right-0 z-30 bg-white border-b shadow-lg sm:hidden p-2 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              );
            })}
            <div className="my-1 h-px bg-slate-200 mx-4" />
            {BOTTOM_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </>
  );
}
