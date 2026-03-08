"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Play, Trash2, AlertTriangle, FileText, Search, BarChart3, MessageSquare, Star } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface PendingAction {
  id: string;
  agent_name: string;
  action_type: string;
  priority: string;
  title: string;
  description: string;
  keyword?: string;
  competitor?: string;
  status: string;
  created_at: string;
}

const AGENT_ICONS: Record<string, any> = {
  content: FileText,
  seo: Search,
  ads: BarChart3,
  social: MessageSquare,
  reviews: Star,
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

export default function ApprovalsPage() {
  const toast = useToast();
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>("all");

  useEffect(() => {
    fetchPendingActions();
  }, []);

  const fetchPendingActions = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/dashboard/pending-actions`);
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
      }
    } catch (error) {
      console.error('Error fetching pending actions:', error);
      toast.error('Failed to load pending actions');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (action: PendingAction) => {
    setExecuting(action.id);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/${action.agent_name}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: action.id })
      });
      if (res.ok) {
        setActions(prev => prev.filter(a => a.id !== action.id));
        toast.success(`Executed: ${action.title}`);
      } else {
        toast.error('Execution failed');
      }
    } catch {
      toast.error('Error executing action');
    } finally {
      setExecuting(null);
    }
  };

  const handleDismiss = async (actionId: string) => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/content/actions/${actionId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setActions(prev => prev.filter(a => a.id !== actionId));
        toast.success('Action dismissed');
      }
    } catch {
      toast.error('Error dismissing action');
    }
  };

  const agents = Array.from(new Set(actions.map(a => a.agent_name)));
  const filtered = filterAgent === "all" ? actions : actions.filter(a => a.agent_name === filterAgent);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Pending Actions</h2>
          <p className="mt-1 text-slate-500 text-sm">
            {actions.length} actions recommended by agents awaiting your review.
          </p>
        </div>

        {/* Agent filter tabs */}
        {agents.length > 1 && (
          <div className="mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterAgent("all")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filterAgent === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border hover:bg-slate-50"
              }`}
            >
              All ({actions.length})
            </button>
            {agents.map(agent => {
              const count = actions.filter(a => a.agent_name === agent).length;
              return (
                <button
                  key={agent}
                  onClick={() => setFilterAgent(agent)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                    filterAgent === agent
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border hover:bg-slate-50"
                  }`}
                >
                  {agent} ({count})
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Loading pending actions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">All caught up!</h3>
            <p className="mt-2 text-sm text-slate-500">No pending actions at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((action) => {
              const IconComponent = AGENT_ICONS[action.agent_name] || Clock;
              return (
                <div
                  key={action.id}
                  className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="rounded-lg bg-slate-100 p-2.5 flex-shrink-0">
                        <IconComponent className="h-5 w-5 text-slate-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-slate-900 truncate">{action.title}</h3>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.medium}`}>
                            {action.priority}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 capitalize">
                            {action.agent_name}
                          </span>
                          <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500">
                            {action.action_type}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600 line-clamp-2">{action.description}</p>

                        {(action.keyword || action.competitor) && (
                          <p className="mt-1 text-xs text-slate-400">
                            {action.keyword && <>Keyword: <span className="font-medium text-slate-500">{action.keyword}</span></>}
                            {action.keyword && action.competitor && " · "}
                            {action.competitor && <>Competitor: <span className="font-medium text-slate-500">{action.competitor}</span></>}
                          </p>
                        )}

                        <p className="mt-1.5 text-xs text-slate-400">
                          {new Date(action.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleExecute(action)}
                        disabled={executing === action.id}
                        className="rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {executing === action.id ? 'Running...' : 'Execute'}
                      </button>
                      <button
                        onClick={() => handleDismiss(action.id)}
                        className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
