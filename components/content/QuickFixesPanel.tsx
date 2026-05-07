"use client";

import { useEffect, useState } from "react";
import {
  Zap, Clock, Play, ChevronDown, ChevronUp, FileText, TrendingUp, CheckCircle, AlertCircle,
} from "lucide-react";

interface Action {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  keyword?: string;
  content_id?: string;
  competitor?: string;
  pillar?: string;
  status: string;
}

interface Props {
  apiUrl: string;
}

const QUICK_FIX_TYPES = new Set(["optimize", "meta", "publish"]);

const TYPE_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  optimize: { label: "Expand", cls: "bg-green-100 text-green-700", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  meta:     { label: "Meta",   cls: "bg-orange-100 text-orange-700", icon: <FileText className="h-3.5 w-3.5" /> },
  publish:  { label: "Publish", cls: "bg-blue-100 text-blue-700", icon: <CheckCircle className="h-3.5 w-3.5" /> },
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
};

/**
 * Quick Fixes panel — surfaces analysis actions that don't produce a
 * brand-new article (optimize / meta / publish). These don't fit in the
 * Plan list (where every row maps to "write a new piece"), so they get
 * a tighter inline section above the plan with a Run-button per action.
 */
export default function QuickFixesPanel({ apiUrl }: Props) {
  const [actions, setActions] = useState<Action[]>([]);
  const [executing, setExecuting] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchActions = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/content/actions`);
      if (!res.ok) return;
      const d = await res.json();
      const filtered = (d.actions || []).filter((a: Action) =>
        QUICK_FIX_TYPES.has(a.type) && a.status === "pending"
      );
      setActions(filtered);
    } catch {
      /* non-fatal */
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { fetchActions(); /* eslint-disable-next-line */ }, []);

  const run = async (action: Action) => {
    setExecuting(prev => new Set([...prev, action.id]));
    try {
      const res = await fetch(`${apiUrl}/api/content/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (data.success) {
        setResults(prev => ({ ...prev, [action.id]: { ok: true, msg: "Done" } }));
        setActions(prev => prev.filter(a => a.id !== action.id));
      } else {
        setResults(prev => ({ ...prev, [action.id]: { ok: false, msg: data.error || data.message || "Failed" } }));
      }
    } catch (e) {
      setResults(prev => ({ ...prev, [action.id]: { ok: false, msg: e instanceof Error ? e.message : "Failed" } }));
    } finally {
      setExecuting(prev => { const next = new Set(prev); next.delete(action.id); return next; });
    }
  };

  if (!loaded) return null;
  if (actions.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/50 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-900">
            {actions.length} Quick {actions.length === 1 ? "fix" : "fixes"} available
          </span>
          <span className="text-xs text-amber-700">— small in-place tweaks, no new article needed</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-amber-700" /> : <ChevronDown className="h-4 w-4 text-amber-700" />}
      </button>

      {expanded && (
        <div className="divide-y divide-amber-100 border-t border-amber-100">
          {actions.map(action => {
            const badge = TYPE_BADGE[action.type] || { label: action.type, cls: "bg-slate-100 text-slate-700", icon: <FileText className="h-3.5 w-3.5" /> };
            const result = results[action.id];
            return (
              <div key={action.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_DOT[action.priority] || PRIORITY_DOT.medium}`} title={action.priority} />
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                  {badge.icon}{badge.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-900">{action.title}</p>
                  <p className="truncate text-xs text-slate-500">{action.description}</p>
                </div>
                {result && (
                  <span className={`flex items-center gap-1 text-xs ${result.ok ? "text-green-600" : "text-red-600"}`}>
                    {result.ok ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {result.msg}
                  </span>
                )}
                {!result && (
                  <button
                    onClick={() => run(action)}
                    disabled={executing.has(action.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:bg-amber-300"
                  >
                    {executing.has(action.id) ? <><Clock className="h-3 w-3 animate-spin" /> Running</> : <><Play className="h-3 w-3" /> Run</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
