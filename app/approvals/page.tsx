"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Play, Trash2, AlertTriangle, FileText, Search, BarChart3, MessageSquare, Star, Square, CheckSquare } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useUndo } from "@/components/UndoToast";

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
  const { pushAction: pushUndo } = useUndo();
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

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
        setSelected(prev => { const n = new Set(prev); n.delete(action.id); return n; });
        pushUndo({ id: action.id, title: action.title, agent: action.agent_name, payload: action });
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
        setSelected(prev => { const n = new Set(prev); n.delete(actionId); return n; });
        toast.success('Action dismissed');
      }
    } catch {
      toast.error('Error dismissing action');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(a => a.id)));
    }
  };

  const handleBulkExecute = async () => {
    setBulkRunning(true);
    const toRun = filtered.filter(a => selected.has(a.id));
    for (const action of toRun) {
      await handleExecute(action);
    }
    setBulkRunning(false);
    setSelected(new Set());
    toast.success(`Executed ${toRun.length} actions`);
  };

  const handleBulkDismiss = async () => {
    const ids = [...selected];
    for (const id of ids) {
      await handleDismiss(id);
    }
    setSelected(new Set());
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
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            {agents.length > 1 && (
              <>
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
              </>
            )}
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{selected.size} selected</span>
              <button
                onClick={handleBulkExecute}
                disabled={bulkRunning}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
              >
                {bulkRunning ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Execute All
              </button>
              <button
                onClick={handleBulkDismiss}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
              >
                <Trash2 className="h-3.5 w-3.5" /> Dismiss All
              </button>
            </div>
          )}
        </div>

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
          <>
            {/* Select all row */}
            <div className="mb-2 flex items-center gap-2 px-1">
              <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                {selected.size === filtered.length ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
              </button>
              <span className="text-xs text-slate-400">Select all</span>
            </div>

            <div className="space-y-3">
              {filtered.map((action) => {
                const IconComponent = AGENT_ICONS[action.agent_name] || Clock;
                const isSelected = selected.has(action.id);
                return (
                  <div
                    key={action.id}
                    className={`rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <button onClick={() => toggleSelect(action.id)} className="mt-1 flex-shrink-0 text-slate-400 hover:text-blue-600">
                          {isSelected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5" />}
                        </button>

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
          </>
        )}
      </main>
    </div>
  );
}
