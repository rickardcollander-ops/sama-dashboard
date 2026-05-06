"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart2, Settings, LogOut, Menu, X,
  FileText, Compass, Sparkles, Shield, ChevronDown, Globe, ChevronRight, Code2,
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

type SectionId = "home" | "strategy" | "insights" | "content" | "tech" | "settings" | "admin";

const TOP_NAV: NavItem[] = [
  {
    id: "home",
    href: "/c/dashboard",
    label: "Hem",
    icon: BarChart2,
    matchPrefixes: ["/c/dashboard"],
  },
  {
    id: "strategy",
    href: "/c/strategy",
    label: "Strategi",
    icon: Compass,
    matchPrefixes: ["/c/strategy"],
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
    id: "tech",
    href: "/c/tech",
    label: "Tech",
    icon: Code2,
    matchPrefixes: ["/c/tech"],
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
  strategy: [],
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

  if (sites.length <= 1) return null;

  const label = activeSite?.site_name || activeSite?.settings?.brand_name as string || "Välj sida";

  return (
    <div className="relative px-3 pb-3" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <Globe className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-lg py-1 overflow-hidden">
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

function SidebarContent({
  navItems,
  section,
  pathname,
  onClose,
}: {
  navItems: NavItem[];
  section: SectionId | null;
  pathname: string;
  onClose?: () => void;
}) {
  const { user, signOut } = useUser();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-slate-100">
        <Link href="/c/dashboard" className="flex items-center gap-2" onClick={onClose}>
          <Activity className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold text-slate-900">SAMA</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
        </div>
      </div>

      {/* Site switcher */}
      <div className="pt-3">
        <SiteSwitcher />
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = section === item.id;
          const subItems = SUB_NAV[item.id];
          return (
            <div key={item.id}>
              <Link
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <item.icon className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} style={{ width: "1.125rem", height: "1.125rem" }} />
                <span className="flex-1">{item.label}</span>
                {subItems.length > 0 && (
                  <ChevronRight className={`h-3.5 w-3.5 text-slate-300 transition-transform ${isActive ? "rotate-90" : ""}`} />
                )}
              </Link>

              {/* Sub-items for active section */}
              {isActive && subItems.length > 0 && (
                <div className="ml-9 mt-0.5 mb-1 space-y-0.5">
                  {subItems.map((sub) => {
                    const subActive = isSubItemActive(pathname, sub);
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onClose}
                        className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                          subActive
                            ? "text-blue-700 font-semibold bg-blue-50/60"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
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

      {/* User + logout */}
      <div className="border-t border-slate-100 p-3 space-y-1">
        {user && (
          <p className="truncate px-3 py-1 text-xs text-slate-400">{user.email}</p>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logga ut
        </button>
      </div>
    </div>
  );
}

export default function CustomerNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showAdmin = isAdminEmail(user?.email);
  const navItems = showAdmin ? [...TOP_NAV, ADMIN_NAV] : TOP_NAV;
  const section = activeSection(pathname, navItems);

  return (
    <>
      {/* Desktop sidebar — fixed left */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <SidebarContent navItems={navItems} section={section} pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label={mobileOpen ? "Stäng meny" : "Öppna meny"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/c/dashboard" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold text-slate-900">SAMA</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl lg:hidden">
            <SidebarContent
              navItems={navItems}
              section={section}
              pathname={pathname}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  );
}
