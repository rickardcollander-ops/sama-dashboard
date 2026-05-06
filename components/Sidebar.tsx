"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search, MessageSquare, TrendingUp, Users, BarChart3, Activity,
  Bot, Shield, AlertTriangle, FileText, DollarSign, Code2,
  ChevronLeft, ChevronRight, Home, ClipboardList, BarChart2,
  Menu, X, Target, HeartPulse, FileBarChart, MessageCircle, UserPlus
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  badge?: string;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Command Center", desc: "Overview & quick actions", icon: Home, group: "main" },
  { href: "/gtm", label: "GTM Strategy", desc: "ICP, strategy & pipeline", icon: Target, group: "main" },

  { href: "/seo", label: "SEO", desc: "Rankings, audits & keywords", icon: Search, group: "agents" },
  { href: "/content", label: "Content", desc: "AI-generated articles & pages", icon: MessageSquare, group: "agents" },
  { href: "/tech", label: "Tech", desc: "Code changes via Pull Requests", icon: Code2, group: "agents" },
  { href: "/ads", label: "Google Ads", desc: "Campaign optimization", icon: TrendingUp, group: "agents" },
  { href: "/social", label: "Social Media", desc: "Twitter, Reddit & scheduling", icon: Users, group: "agents" },
  { href: "/reviews", label: "Reviews", desc: "G2, Capterra & responses", icon: BarChart3, group: "agents" },
  { href: "/analytics", label: "Analytics", desc: "Cross-channel metrics & ROI", icon: BarChart2, group: "agents" },
  { href: "/ai-visibility", label: "AI Visibility", desc: "Presence in AI assistants", icon: Bot, group: "agents" },

  { href: "/content-analytics", label: "Content Analytics", desc: "Performance per article", icon: FileText, group: "insights" },
  { href: "/budget-optimizer", label: "Budget Optimizer", desc: "Reallocate ad spend", icon: DollarSign, group: "insights" },
  { href: "/anomalies", label: "Anomalies", desc: "Unexpected metric changes", icon: AlertTriangle, group: "insights" },

  { href: "/leads", label: "Lead Pipeline", desc: "Leads, scoring & attribution", icon: UserPlus, group: "insights" },
  { href: "/goals", label: "Goals", desc: "Agent targets & progress", icon: Target, group: "ops" },
  { href: "/agent-reports", label: "Agent Reports", desc: "Daily agent status & needs", icon: FileBarChart, group: "ops" },
  { href: "/agent-chat", label: "Agent Chat", desc: "Chat with your agents", icon: MessageCircle, group: "ops" },
  { href: "/approvals", label: "Approvals", desc: "Review pending changes", icon: Shield, group: "ops" },
  { href: "/system-health", label: "System Health", desc: "Dev agent diagnostics", icon: HeartPulse, group: "ops" },
  { href: "/logs", label: "Activity Logs", desc: "Agent execution history", icon: ClipboardList, group: "ops" },
];

const GROUP_LABELS: Record<string, string> = {
  main: "",
  agents: "Agents",
  insights: "Insights",
  ops: "Operations",
};

function NavContent({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const groups = ["main", "agents", "insights", "ops"];

  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2">
      {groups.map((group) => {
        const items = NAV_ITEMS.filter((i) => i.group === group);
        if (items.length === 0) return null;
        const label = GROUP_LABELS[group];
        return (
          <div key={group} className={group !== "main" ? "mt-4" : ""}>
            {label && !collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
              </p>
            )}
            {label && collapsed && <div className="mx-auto my-2 h-px w-6 bg-slate-200" />}
            {items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? `${item.label} — ${item.desc}` : undefined}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <item.icon
                    className={`h-[18px] w-[18px] flex-shrink-0 ${
                      isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <span className="truncate block">{item.label}</span>
                      <span className="truncate block text-[10px] font-normal text-slate-400 leading-tight">{item.desc}</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Mobile: fixed top bar ───────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4">
        <Link href="/" className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          <span className="text-base font-bold text-slate-900">SAMA 2.0</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile slide-out nav */}
      <div className={`md:hidden fixed top-14 left-0 bottom-0 z-30 w-64 bg-white border-r transform transition-transform duration-200 flex flex-col ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <NavContent collapsed={false} />
        <div className="border-t px-4 py-3">
          <p className="text-[10px] text-slate-400">Successifier Marketing AI</p>
          <p className="text-[10px] text-slate-400">v2.0</p>
        </div>
      </div>

      {/* ── Desktop: persistent sidebar ─────────────────────── */}
      <aside
        className={`hidden md:flex flex-col border-r bg-white transition-all duration-200 flex-shrink-0 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <Activity className="h-7 w-7 text-blue-600 flex-shrink-0" />
              <span className="text-lg font-bold text-slate-900 whitespace-nowrap">SAMA 2.0</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/" className="mx-auto">
              <Activity className="h-7 w-7 text-blue-600" />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${collapsed ? "mx-auto mt-0" : ""}`}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <NavContent collapsed={collapsed} />

        {!collapsed && (
          <div className="border-t px-4 py-3">
            <p className="text-[10px] text-slate-400">Successifier Marketing AI</p>
            <p className="text-[10px] text-slate-400">v2.0</p>
          </div>
        )}
      </aside>
    </>
  );
}
