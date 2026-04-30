"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, X } from "lucide-react";
import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Notification {
  id: string;
  title: string;
  message: string;
  severity: string;
  agent: string;
  read: boolean;
  created_at: string;
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  warning: "bg-amber-500",
  medium: "bg-yellow-500",
  info: "bg-blue-500",
  success: "bg-green-500",
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Realtime: new notifications appear instantly (falls back to polling)
  useRealtimeSubscription<Notification>({
    table: "notifications",
    filter: "read=eq.false",
    onInsert: useCallback((row: Notification) => {
      setNotifications(prev => {
        if (prev.some(n => n.id === row.id)) return prev;
        return [row, ...prev].slice(0, 20);
      });
    }, []),
    onPoll: useCallback(() => fetchNotifications(), []),
  });

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/notifications?limit=15&unread_only=true`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch { /* silent */ }
  };

  const markRead = async (id: string) => {
    try {
      await fetch(`${SAMA_API_URL}/api/notifications/${id}/read`, { method: "POST" });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${SAMA_API_URL}/api/notifications/read-all`, { method: "POST" });
      setNotifications([]);
    } catch { /* silent */ }
  };

  const fmtRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const count = notifications.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border bg-white shadow-xl z-50">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Notifications {count > 0 && <span className="text-slate-400">({count})</span>}
            </h3>
            {count > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {count === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No new notifications
              </div>
            ) : (
              notifications.map(n => (
                <div
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
                      {n.agent} · {fmtRelative(n.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => markRead(n.id)}
                    className="flex-shrink-0 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
