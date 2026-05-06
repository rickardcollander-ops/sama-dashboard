"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart2, Settings, LogOut, Menu, X,
  FileText, Code2, Sparkles, Shield, ChevronDown, Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { isAdminEmail } from "@/lib/admin";
import NotificationBell from "@/components/NotificationBell";

interface NavItem {
  id: SectionId;
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefixes: string[];
}

interface SubNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

type SectionId = "home" | "tech" | "insights" | "content" | "settings" | "admin";

const TOP_NAV: NavItem[] = [
  {
    id: "home",
    href: "/c/dashboard",
    label: "Hem",
    icon: BarChart2,
    matchPrefixes: ["/c/dashboard"],
  },
  {
    id: "tech",
    href: "/c/tech",
    label: "Tech",
    icon: Code2,
    matchPrefixes: ["/c/tech"],
  },
  {
    id: "insights",
    href: "/c/analysis",
    label: "Insikter",
    icon: Sparkles,
    matchPrefixes: ["/c/analysis", "/c/seo", "/c/geo", "/c/analytics"],
  },
  {
    id: "content",
    href: "/c/content",
    label: "Content",
    icon: FileText,
    matchPrefixes: ["/c/content"],
  },
  {
    id: "settings",
    href: "/c/settings",
    label: "Inställningar",
    icon: Settings,
    matchPrefixes: ["/c/settings"],
  },
];

const ADMIN_NAV: NavItem = {
  id: "admin",
  href: "/c/admin",
  label: "Admin",
  icon: Shield,
  matchPrefixes: ["/c/admin"],
};

const SUB_NAV: Record<SectionId, SubNavItem[]> = {
  home: [],
  tech: [],
  insights: [
    { href: "/c/analysis", label: "Översikt" },
    { href: "/c/seo", label: "Google" },
    { href: "/c/geo", label: "AI-assistenter" },
    { href: "/c/analytics", label: "Trafik" },
  ],
  content: [
    { href: "/c/content", label: "Översikt", exact: true },
    { href: "/c/content/calendar", label: "Kalender" },
  ],
  settings: [
    { href: "/c/settings", label: "Konto", exact: true },
    { href: "/c/settings/sites", label: "Sidor" },
    { href: "/c/settings/integrations", label: "Integrationer" },
    { href: "/c/settings/billing", label: "Plan & fakturering" },
  ],
  admin: [],
};

function activeSection(pathname: string, items: NavItem[]): SectionId | null {
  for (const item of items) {
    if (item.matchPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return item.id;
    }
  }
  return null;
}

function isSubItemActive(pathname: string, item: SubNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function SiteSwitcher() {
  const { sites, activeSite, setActiveSiteId } = useSite();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Only render when there's more than one site.
  if (sites.length <= 1) return null;

  const label = activeSite?.site_name || activeSite?.settings?.brand_name as string || "Välj sida";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors max-w-[180px]"
      >
        <Globe className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1 overflow-hidden">
            {sites.map((site) => {
              const isActive = site.id === activeSite?.id;
              const name = site.site_name || (site.settings?.brand_name as string) || "Namnlös sida";
              const domain = site.settings?.domain as string | undefined;
              return (
                <button
                  key={site.id}
                  onClick={() => { setActiveSiteId(site.id); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium truncate">{name}</div>
                  {domain && <div className="text-xs text-slate-400 truncate">{domain}</div>}
                </button>
              );
            })}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <Link
                href="/c/settings?tab=sites"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              >
                Hantera sidor →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CustomerNav() {
  const pathname = usePathname();
  const { user, signOut } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showAdmin = isAdminEmail(user?.email);
  const navItems = showAdmin ? [...TOP_NAV, ADMIN_NAV] : TOP_NAV;

  const section = activeSection(pathname, navItems);
  const subItems = section ? SUB_NAV[section] : [];

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="sm:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label={mobileOpen ? "Stäng meny" : "Öppna meny"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/c/dashboard" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold text-slate-900">SAMA</span>
          </Link>

          {/* Site switcher */}
          <div className="hidden sm:block">
            <SiteSwitcher />
          </div>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 ml-2">
            {navItems.map((item) => {
              const isActive = section === item.id;
              return (
                <Link
                  key={item.id}
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
            title="Logga ut"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logga ut</span>
          </button>
        </div>
      </header>

      {/* Section sub-nav (desktop). */}
      {subItems.length > 0 && (
        <div className="hidden sm:block sticky top-14 z-30 border-b bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 sm:px-6">
            {subItems.map((item) => {
              const isActive = isSubItemActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative -mb-px px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "text-blue-700 font-semibold border-b-2 border-blue-600"
                      : "text-slate-500 font-medium hover:text-slate-900 border-b-2 border-transparent"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30 sm:hidden" onClick={() => setMobileOpen(false)} />
          <nav className="fixed top-14 left-0 right-0 z-30 bg-white border-b shadow-lg sm:hidden p-2 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
            {/* Mobile site switcher */}
            <div className="px-2 pb-2 border-b border-slate-100 mb-2">
              <SiteSwitcher />
            </div>
            {navItems.map((item) => {
              const isActive = section === item.id;
              const itemSubs = SUB_NAV[item.id];
              return (
                <div key={item.id}>
                  <Link
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
                  {isActive && itemSubs.length > 0 && (
                    <div className="ml-9 mb-1 mt-0.5 flex flex-col gap-0.5">
                      {itemSubs.map((sub) => {
                        const subActive = isSubItemActive(pathname, sub);
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={() => setMobileOpen(false)}
                            className={`rounded-md px-3 py-2 text-sm ${
                              subActive
                                ? "text-blue-700 font-semibold"
                                : "text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </>
      )}
    </>
  );
}
