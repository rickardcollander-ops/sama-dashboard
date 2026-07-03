"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { AlertCircle, Bell, Check, FileText, X, Inbox } from "lucide-react";
import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { SAMA_API_URL } from "@/lib/api";

interface Notification {
  id: string;
  title: string;
  message: string;
  severity: string;
  agent: string;
  read: boolean;
  created_at: string;
}

interface PendingApproval {
  id: string;
  kind: string;
  channel: string | null;
  agent_name: string | null;
  title: string | null;
  body: string | null;
  status: string;
  created_at: string;
}

const ALERT_SEVERITIES = new Set(["critical", "high"]);

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  warning: "bg-amber-500",
  medium: "bg-yellow-500",
  info: "bg-blue-500",
  success: "bg-green-500",
};

type TabId = "pending" | "recent" | "alerts";

type TimeStrings = {
  never: string;
  justNow: string;
  minutesSuffix: string;
  hoursSuffix: string;
  daysSuffix: string;
};

function fmtRelative(iso: string, time: TimeStrings): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return time.justNow;
  if (mins < 60) return `${mins}${time.minutesSuffix}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${time.hoursSuffix}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${time.daysSuffix}`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const { user } = useUser();
  const { effectiveTenantId } = useSite();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("pending");
  const ref = useRef<HTMLDivElement>(null);

  const tabs: { id: TabId; label: string }[] = useMemo(
    () => [
      { id: "pending", label: t.notifications.tabPending },
      { id: "recent", label: t.notifications.tabRecent },
      { id: "alerts", label: t.notifications.tabAlerts },
    ],
    [t.notifications.tabPending, t.notifications.tabRecent, t.notifications.tabAlerts],
  );

  const fetchNotifications = useCallback(async () => {
    if (!effectiveTenantId) return;
    try {
      // The badge is non-critical, so give up early instead of waiting out a
      // slow backend (which otherwise surfaces as a 504 in the console).
      const res = await fetch(`${SAMA_API_URL}/api/notifications?limit=20&unread_only=true`, {
        headers: { "X-Tenant-ID": effectiveTenantId },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      /* silent — aborts and transient failures degrade to an empty badge */
    }
  }, [effectiveTenantId]);

  const fetchPending = useCallback(async () => {
    if (!user || !effectiveTenantId) return;
    try {
      const res = await fetch("/api/approvals?status=pending", {
        headers: { "X-Tenant-ID": effectiveTenantId },
      });
      if (res.ok) {
        const data = (await res.json()) as { approvals?: PendingApproval[] };
        setPending(data.approvals || []);
      }
    } catch {
      /* silent */
    }
  }, [user, effectiveTenantId]);

  // Realtime: new notifications appear instantly (falls back to polling)
  useRealtimeSubscription<Notification>({
    table: "notifications",
    filter: "read=eq.false",
    onInsert: useCallback((row: Notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === row.id)) return prev;
        return [row, ...prev].slice(0, 20);
      });
    }, []),
    onPoll: fetchNotifications,
  });

  // Clear pending list when the active site changes so the badge count
  // doesn't briefly show the previous site's drafts.
  useEffect(() => {
    setPending([]);
  }, [effectiveTenantId]);

  // Defer the initial fetches to idle time so the bell badge doesn't compete
  // with the main page paint. Falls back to a microtask delay on browsers
  // without requestIdleCallback (Safari).
  useEffect(() => {
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      void fetchNotifications();
      void fetchPending();
    };
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(run, { timeout: 1500 });
    } else {
      timeoutId = setTimeout(run, 200);
    }
    return () => {
      if (idleId != null && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchNotifications, fetchPending]);

  // Refresh pending when the panel opens (drafts can be approved on /c/approvals)
  useEffect(() => {
    if (open) fetchPending();
  }, [open, fetchPending]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const alerts = useMemo(
    () => notifications.filter((n) => ALERT_SEVERITIES.has(n.severity)),
    [notifications],
  );

  const totalBadge = pending.length + alerts.length;

  const markRead = async (id: string) => {
    try {
      await fetch(`${SAMA_API_URL}/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      /* silent */
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${SAMA_API_URL}/api/notifications/read-all`, { method: "POST" });
      setNotifications([]);
    } catch {
      /* silent */
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title={t.notifications.title}
        aria-label={t.notifications.title}
      >
        <Bell className="h-5 w-5" />
        {totalBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[22rem] sm:w-[26rem] rounded-xl border bg-white shadow-xl z-50 overflow-hidden">
          {/* Tab strip */}
          <div className="flex border-b">
            {tabs.map((tabItem) => {
              const isActive = tab === tabItem.id;
              const count =
                tabItem.id === "pending" ? pending.length :
                tabItem.id === "alerts" ? alerts.length :
                notifications.length;
              return (
                <button
                  key={tabItem.id}
                  onClick={() => setTab(tabItem.id)}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "text-blue-700 border-b-2 border-blue-600 -mb-px"
                      : "text-slate-500 hover:text-slate-900 border-b-2 border-transparent"
                  }`}
                >
                  {tabItem.label}
                  {count > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                      isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {tab === "pending" && (
              <PendingList items={pending} />
            )}
            {tab === "recent" && (
              <NotificationList
                items={notifications}
                onDismiss={markRead}
                emptyLabel={t.notifications.emptyRecent}
              />
            )}
            {tab === "alerts" && (
              <NotificationList
                items={alerts}
                onDismiss={markRead}
                emptyLabel={t.notifications.emptyAlerts}
              />
            )}
          </div>

          {/* Footer */}
          {tab === "recent" && notifications.length > 0 && (
            <div className="border-t bg-slate-50 px-4 py-2 text-right">
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                <Check className="h-3 w-3" />
                {t.notifications.markAllRead}
              </button>
            </div>
          )}
          {tab === "pending" && pending.length > 0 && (
            <div className="border-t bg-slate-50 px-4 py-2 text-right">
              <Link
                href="/c/approvals"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                {t.notifications.openAllDrafts}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PendingList({ items }: { items: PendingApproval[] }) {
  const { t } = useLanguage();
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400">
        <Inbox className="h-6 w-6 text-slate-300" />
        {t.notifications.emptyPending}
      </div>
    );
  }
  return (
    <ul>
      {items.map((p) => (
        <li key={p.id}>
          <Link
            href="/c/approvals"
            className="flex items-start gap-3 border-b last:border-0 px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <span className="mt-0.5 rounded-md bg-blue-50 p-1.5 text-blue-600">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {p.title || t.notifications.untitled}
              </p>
              <p className="text-xs text-slate-500 line-clamp-2">
                {p.body?.slice(0, 140) || (p.kind ? `${p.kind}${t.notifications.draftSuffix}` : t.notifications.waitingApproval)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {p.agent_name || p.kind} · {fmtRelative(p.created_at, t.time)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NotificationList({
  items,
  onDismiss,
  emptyLabel,
}: {
  items: Notification[];
  onDismiss: (id: string) => void;
  emptyLabel: string;
}) {
  const { t } = useLanguage();
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400">
        <AlertCircle className="h-6 w-6 text-slate-300" />
        {emptyLabel}
      </div>
    );
  }
  return (
    <ul>
      {items.map((n) => (
        <li
          key={n.id}
          className="flex items-start gap-3 border-b last:border-0 px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <span
            className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[n.severity] || SEVERITY_DOT.info}`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{n.title}</p>
            <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {n.agent} · {fmtRelative(n.created_at, t.time)}
            </p>
          </div>
          <button
            onClick={() => onDismiss(n.id)}
            className="flex-shrink-0 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
            title={t.notifications.close}
            aria-label={t.notifications.closeAria}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
