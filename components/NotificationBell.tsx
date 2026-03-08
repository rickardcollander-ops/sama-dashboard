"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, AlertTriangle, Star, Zap, X } from "lucide-react";
import Link from "next/link";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface Notification {
  id: string;
  type: 'anomaly' | 'review' | 'action' | 'info';
  title: string;
  message: string;
  href?: string;
  time: string;
  read: boolean;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  anomaly: AlertTriangle,
  review: Star,
  action: Zap,
  info: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  anomaly: 'text-red-500 bg-red-50',
  review: 'text-yellow-500 bg-yellow-50',
  action: 'text-blue-500 bg-blue-50',
  info: 'text-slate-500 bg-slate-50',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchNotifications = async () => {
    try {
      // Build notifications from multiple sources
      const notifs: Notification[] = [];

      // Check pending actions
      const actionsRes = await fetch(`${SAMA_API_URL}/api/dashboard/pending-actions`);
      if (actionsRes.ok) {
        const data = await actionsRes.json();
        const count = (data.actions || []).length;
        if (count > 0) {
          notifs.push({
            id: 'pending-actions',
            type: 'action',
            title: `${count} Pending Actions`,
            message: 'Agent-generated actions awaiting review',
            href: '/approvals',
            time: new Date().toISOString(),
            read: false,
          });
        }
      }

      // Check anomalies
      try {
        const anomRes = await fetch(`${SAMA_API_URL}/api/analytics/anomalies/traffic?days=7`);
        if (anomRes.ok) {
          const data = await anomRes.json();
          const anomalies = data.anomalies || [];
          if (anomalies.length > 0) {
            notifs.push({
              id: 'anomalies',
              type: 'anomaly',
              title: `${anomalies.length} Anomalies Detected`,
              message: 'Unexpected metric changes found',
              href: '/anomalies',
              time: new Date().toISOString(),
              read: false,
            });
          }
        }
      } catch { /* silent */ }

      setNotifications(notifs);
    } catch { /* silent */ }
  };

  const unread = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-white shadow-xl z-50">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
            {notifications.length > 0 && (
              <button onClick={() => setNotifications([])} className="text-xs text-slate-400 hover:text-slate-600">
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No notifications</div>
            ) : (
              notifications.map(n => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                const color = TYPE_COLORS[n.type] || TYPE_COLORS.info;
                const cls = `flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`;
                const inner = (
                  <>
                    <div className={`rounded-lg p-1.5 ${color} flex-shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      <p className="text-xs text-slate-500">{n.message}</p>
                    </div>
                  </>
                );
                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className={cls}>
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
