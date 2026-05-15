"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart2, Settings, LogOut, Menu, X,
  FileText, Sparkles, Shield, ChevronDown, Globe, ChevronRight, Code2,
  Users, Megaphone, Share2,
  User, CreditCard, Palette, Link2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useActiveRuns } from "@/lib/hooks/useActiveRuns";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { LANGUAGES } from "@/lib/locales";
import type { Translations } from "@/lib/locales";
import { isAdminEmail } from "@/lib/admin";
import NotificationBell from "@/components/NotificationBell";
import ConfirmDialog from "@/components/ConfirmDialog";

interface NavItem {
  id: SectionId;
  href: string;
  icon: LucideIcon;
  matchPrefixes: string[];
  disabled?: boolean;
}

interface SubNavItem {
  href: string;
  labelKey: keyof Translations["subNav"];
  icon?: LucideIcon;
  exact?: boolean;
}

// Grouped variant: a labelled section that itself contains SubNavItems.
// Used by /c/settings to split sub-nav into "Personal" vs "Business" etc.
interface SubNavSection {
  titleKey: keyof Translations["subNavSections"];
  items: SubNavItem[];
}

// A section's sub-nav is either a flat list of items OR a list of
// grouped sections. Mixing the two within one section isn't supported —
// the renderer in the JSX below treats the two shapes separately.
type SubNavConfig = SubNavItem[] | SubNavSection[];

function isGroupedSubNav(config: SubNavConfig): config is SubNavSection[] {
  return config.length > 0 && "items" in config[0];
}

function flattenSubNav(config: SubNavConfig): SubNavItem[] {
  return isGroupedSubNav(config) ? config.flatMap((g) => g.items) : config;
}

type SectionId = "home" | "insights" | "content" | "tech" | "social" | "ads" | "settings" | "admin";

const TOP_NAV: NavItem[] = [
  {
    id: "home",
    href: "/c/dashboard",
    icon: BarChart2,
    matchPrefixes: ["/c/dashboard"],
  },
  {
    id: "insights",
    href: "/c/analysis",
    icon: Sparkles,
    // /audit is the public free-audit landing page; it's intentionally not
    // part of the customer insights area, so don't highlight Insights when
    // a user ends up on that route.
    matchPrefixes: ["/c/analysis", "/c/seo", "/c/geo", "/c/analytics"],
  },
  {
    id: "content",
    href: "/c/content",
    icon: FileText,
    matchPrefixes: ["/c/content"],
  },
  {
    id: "tech",
    href: "/c/tech",
    icon: Code2,
    matchPrefixes: ["/c/tech"],
  },
  {
    id: "social",
    href: "#",
    icon: Share2,
    matchPrefixes: [],
    disabled: true,
  },
  {
    id: "ads",
    href: "#",
    icon: Megaphone,
    matchPrefixes: [],
    disabled: true,
  },
  {
    id: "settings",
    href: "/c/settings",
    icon: Settings,
    matchPrefixes: ["/c/settings"],
  },
];

const ADMIN_NAV: NavItem = {
  id: "admin",
  href: "/c/admin",
  icon: Shield,
  matchPrefixes: ["/c/admin"],
};

const SUB_NAV: Record<SectionId, SubNavConfig> = {
  home: [],
  tech: [],
  social: [],
  ads: [
    { href: "/c/ads/meta", labelKey: "metaAds" },
  ],
  // The public /audit page used to live here as "Site Audit". It's been
  // removed because the customer-side site review now runs from /c/analysis
  // and the AI-readability scorecard renders directly under InsightsOverview.
  insights: [
    { href: "/c/analysis", labelKey: "overview" },
    { href: "/c/seo", labelKey: "google" },
    { href: "/c/geo", labelKey: "aiAssistants" },
    { href: "/c/analytics", labelKey: "traffic" },
  ],
  content: [
    { href: "/c/content", labelKey: "overview", exact: true },
    { href: "/c/content/plan", labelKey: "plan" },
  ],
  settings: [
    {
      titleKey: "personal",
      items: [
        { href: "/c/settings", labelKey: "account", icon: User, exact: true },
        { href: "/c/settings/billing", labelKey: "billing", icon: CreditCard },
      ],
    },
    {
      titleKey: "business",
      items: [
        { href: "/c/settings/branding", labelKey: "branding", icon: Palette },
        { href: "/c/settings/sites", labelKey: "sites", icon: Globe },
        { href: "/c/settings/team", labelKey: "team", icon: Users },
        { href: "/c/settings/integrations", labelKey: "integrations", icon: Link2 },
      ],
    },
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

function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex gap-1 px-3 py-2">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLanguage(l.code)}
          title={l.label}
          className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
            language === l.code
              ? "bg-blue-100 text-blue-700"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          }`}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  );
}

function AccountSwitcher() {
  const { accounts, activeAccountId, setActiveAccountId, myRole } = useSite();
  const { runs } = useActiveRuns();
  const [open, setOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Background work that would be abandoned if we switch contexts.
  const inFlightRuns = runs.filter(
    (r) => r.status === "running" || r.status === "pending",
  );

  if (accounts.length <= 1) return null;

  const active = accounts.find((a) => a.account_id === activeAccountId);
  const label =
    active?.brand_name ||
    active?.domain ||
    active?.owner_email ||
    "Select account";

  const requestSwitch = (id: string) => {
    if (id === activeAccountId) {
      setOpen(false);
      return;
    }
    setPendingSwitch(id);
    setOpen(false);
  };

  const confirmTarget = pendingSwitch
    ? accounts.find((a) => a.account_id === pendingSwitch)
    : null;
  const confirmLabel =
    confirmTarget?.brand_name ||
    confirmTarget?.domain ||
    confirmTarget?.owner_email ||
    "the account";
  const confirmDescription =
    inFlightRuns.length > 0
      ? `You have ${inFlightRuns.length} run${
          inFlightRuns.length === 1 ? "" : "s"
        } in progress (${inFlightRuns
          .map((r) => r.label)
          .slice(0, 3)
          .join(
            ", ",
          )}). The results won't appear automatically once you switch to ${confirmLabel}.`
      : `All data and settings will switch to ${confirmLabel}. Any unsaved changes will be lost.`;

  return (
    <div className="relative px-3 pb-2" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Users className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <span className="truncate flex-1 text-left">{label}</span>
        {myRole && myRole !== "owner" && (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 uppercase">
            {myRole}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-lg py-1 overflow-hidden">
            {accounts.map((acc) => {
              const isActive = acc.account_id === activeAccountId;
              const accLabel =
                acc.brand_name || acc.domain || acc.owner_email || acc.account_id;
              return (
                <button
                  key={acc.account_id}
                  onClick={() => requestSwitch(acc.account_id)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate flex-1">{accLabel}</span>
                    {acc.role !== "owner" && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 uppercase flex-shrink-0">
                        {acc.role}
                      </span>
                    )}
                  </div>
                  {acc.domain && acc.brand_name && (
                    <div className="text-xs text-slate-400 truncate">{acc.domain}</div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={pendingSwitch !== null}
        title="Switch account?"
        description={confirmDescription}
        confirmLabel="Switch"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingSwitch) {
            setActiveAccountId(pendingSwitch);
            return;
          }
          setPendingSwitch(null);
        }}
        onCancel={() => setPendingSwitch(null)}
      />
    </div>
  );
}

function SiteSwitcher() {
  const { sites, activeSite, setActiveSiteId } = useSite();
  const { runs } = useActiveRuns();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const inFlightRuns = runs.filter(
    (r) => r.status === "running" || r.status === "pending",
  );

  if (sites.length <= 1) return null;

  const label = activeSite?.site_name || activeSite?.settings?.brand_name as string || t.siteSwitcher.selectSite;

  const requestSwitch = (id: string) => {
    if (id === activeSite?.id) {
      setOpen(false);
      return;
    }
    setPendingSwitch(id);
    setOpen(false);
  };

  const confirmTarget = pendingSwitch
    ? sites.find((s) => s.id === pendingSwitch)
    : null;
  const confirmLabel =
    confirmTarget?.site_name ||
    (confirmTarget?.settings?.brand_name as string | undefined) ||
    "the new site";
  const confirmDescription =
    inFlightRuns.length > 0
      ? `You have ${inFlightRuns.length} run${
          inFlightRuns.length === 1 ? "" : "s"
        } in progress (${inFlightRuns
          .map((r) => r.label)
          .slice(0, 3)
          .join(
            ", ",
          )}). The results won't appear automatically once you switch to ${confirmLabel}.`
      : `The view will switch to ${confirmLabel}. Pages will reload to show the right data for the selected site.`;

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
              const name = site.site_name || (site.settings?.brand_name as string) || t.siteSwitcher.unnamed;
              const domain = site.settings?.domain as string | undefined;
              return (
                <button
                  key={site.id}
                  onClick={() => requestSwitch(site.id)}
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
                {t.siteSwitcher.manageSites}
              </Link>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={pendingSwitch !== null}
        title="Byta sida?"
        description={confirmDescription}
        confirmLabel="Byt"
        cancelLabel="Avbryt"
        onConfirm={() => {
          if (pendingSwitch) {
            setActiveSiteId(pendingSwitch);
            return;
          }
          setPendingSwitch(null);
        }}
        onCancel={() => setPendingSwitch(null)}
      />
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
  const { t } = useLanguage();

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

      {/* Account + site switchers */}
      <div className="pt-3">
        <AccountSwitcher />
        <SiteSwitcher />
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = section === item.id;
          const subConfig = SUB_NAV[item.id];
          const hasSubItems = flattenSubNav(subConfig).length > 0;
          if (item.disabled) {
            return (
              <div
                key={item.id}
                aria-disabled="true"
                title={t.common.comingSoon}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed"
              >
                <item.icon className="h-4.5 w-4.5 flex-shrink-0 text-slate-300" style={{ width: "1.125rem", height: "1.125rem" }} />
                <span className="flex-1">{t.nav[item.id]}</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 uppercase">
                  {t.common.comingSoon}
                </span>
              </div>
            );
          }
          const renderSubItem = (sub: SubNavItem) => {
            const subActive = isSubItemActive(pathname, sub);
            const SubIcon = sub.icon;
            return (
              <Link
                key={sub.href}
                href={sub.href}
                onClick={onClose}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  subActive
                    ? "text-blue-700 font-semibold bg-blue-50/60"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {SubIcon && (
                  <SubIcon className={`h-4 w-4 flex-shrink-0 ${subActive ? "text-blue-600" : "text-slate-400"}`} />
                )}
                <span>{t.subNav[sub.labelKey]}</span>
              </Link>
            );
          };
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
                <span className="flex-1">{t.nav[item.id]}</span>
                {hasSubItems && (
                  <ChevronRight className={`h-3.5 w-3.5 text-slate-300 transition-transform ${isActive ? "rotate-90" : ""}`} />
                )}
              </Link>

              {/* Sub-items for active section */}
              {isActive && hasSubItems && (
                isGroupedSubNav(subConfig) ? (
                  <div className="ml-2 mt-1 mb-1 border-l border-slate-100 pl-2">
                    {subConfig.map((group) => (
                      <div key={group.titleKey} className="mt-3 first:mt-1">
                        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {t.subNavSections[group.titleKey]}
                        </p>
                        <div className="space-y-0.5">
                          {group.items.map(renderSubItem)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ml-9 mt-0.5 mb-1 space-y-0.5">
                    {subConfig.map(renderSubItem)}
                  </div>
                )
              )}
            </div>
          );
        })}
      </nav>

      {/* Language selector */}
      <div className="border-t border-slate-100">
        <LanguageSelector />
      </div>

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
          {t.common.logout}
        </button>
      </div>
    </div>
  );
}

export default function CustomerNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showAdmin = isAdminEmail(user?.email);
  const navItems = showAdmin
    ? [
        ...TOP_NAV.map((item) =>
          item.id === "ads"
            ? { ...item, href: "/c/ads", matchPrefixes: ["/c/ads"], disabled: false }
            : item
        ),
        ADMIN_NAV,
      ]
    : TOP_NAV;
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
            aria-label={mobileOpen ? t.common.closeMenu : t.common.openMenu}
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
