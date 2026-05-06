"use client";

import { useState, useEffect } from "react";
import {
  Activity, CheckCircle, AlertCircle, Clock, RefreshCw,
} from "lucide-react";
import { tenantApi } from "@/lib/api";
import { AGENTS } from "@/lib/agents";
import { useLanguage } from "@/lib/hooks/useLanguage";

export interface ActivityEvent {
  id: string;
  agent: string;
  title: string;
  description?: string;
  severity?: "info" | "success" | "warning" | "critical";
  created_at: string;
  link?: string;
}

const SYSTEM_META = { icon: Activity, color: "text-slate-600", bg: "bg-slate-100" };

function getAgentMeta(agent: string) {
  const a = AGENTS[agent];
  if (a) return { icon: a.icon, color: a.iconColor, bg: a.bg };
  return SYSTEM_META;
}

function severityIcon(severity?: string) {
  switch (severity) {
    case "success":
      return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
    case "warning":
    case "critical":
      return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-slate-400" />;
  }
}

interface ActivityFeedProps {
  userId: string;
}

export default function ActivityFeed({ userId }: ActivityFeedProps) {
  const { t } = useLanguage();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function fmtRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.time.justNow;
    if (mins < 60) return `${mins}${t.time.minutesSuffix}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}${t.time.hoursSuffix}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}${t.time.daysSuffix}`;
    return new Date(iso).toLocaleDateString();
  }

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const load = async () => {
    setLoading(true);
    try {
      const client = tenantApi(userId);
      const data = await client.get<{ events?: ActivityEvent[] }>("/api/activity?limit=15");
      setEvents(data?.events || []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500" />
          <h3 className="font-semibold text-slate-900">{t.activity.title}</h3>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || loading}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title={t.activity.refresh}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
            {t.activity.loading}
          </div>
        ) : events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <Activity className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">{t.activity.empty}</p>
            <p className="mt-1 text-xs text-slate-400">{t.activity.emptyDesc}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((e) => {
              const meta = getAgentMeta(e.agent);
              const Icon = meta.icon;
              const body = (
                <div className="flex items-start gap-3 px-6 py-3 hover:bg-slate-50 transition-colors">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{e.title}</p>
                    {e.description && (
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{e.description}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1.5">
                      {severityIcon(e.severity)}
                      <span className="text-[11px] text-slate-400">{fmtRelative(e.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
              return (
                <li key={e.id}>
                  {e.link ? (
                    <a href={e.link} className="block">{body}</a>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
