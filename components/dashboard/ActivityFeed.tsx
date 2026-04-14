"use client";

import { useState, useEffect } from "react";
import {
  Activity, Bot, Search, FileText, Share2, Megaphone, TrendingUp,
  CheckCircle, AlertCircle, Clock, RefreshCw,
} from "lucide-react";
import { tenantApi } from "@/lib/api";

export interface ActivityEvent {
  id: string;
  agent: "geo" | "seo" | "content" | "social" | "ads" | "analytics" | "system";
  title: string;
  description?: string;
  severity?: "info" | "success" | "warning" | "critical";
  created_at: string;
  link?: string;
}

const AGENT_META: Record<string, { icon: React.ComponentType<any>; color: string; bg: string }> = {
  geo: { icon: Bot, color: "text-violet-600", bg: "bg-violet-50" },
  seo: { icon: Search, color: "text-blue-600", bg: "bg-blue-50" },
  content: { icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
  social: { icon: Share2, color: "text-indigo-600", bg: "bg-indigo-50" },
  ads: { icon: Megaphone, color: "text-orange-600", bg: "bg-orange-50" },
  analytics: { icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
  system: { icon: Activity, color: "text-slate-600", bg: "bg-slate-100" },
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
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
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          <h3 className="font-semibold text-slate-900">Activity</h3>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || loading}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading activity...
          </div>
        ) : events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <Activity className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">No activity yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Agent actions will appear here as they run.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((e) => {
              const meta = AGENT_META[e.agent] || AGENT_META.system;
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
                    <a href={e.link} className="block">
                      {body}
                    </a>
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
