"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Clock, Play, Trash2, AlertTriangle, FileText, Search, BarChart3, MessageSquare, Star, CheckSquare, Square, Wifi } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";

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
  critical: "bg-red-200 text-red-800",
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismissReason, setDismissReason] = useState<{ id: string; reason: string } | null>(null);
  const [detailAction, setDetailAction] = useState<PendingAction | null>(null);

  // Realtime subscription for live updates (falls back to polling)
  const { connected } = useRealtimeSubscription<PendingAction>({
    table: 'agent_actions',
    filter: 'status=eq.pending',
    onInsert: useCallback((row: PendingAction) => {
      setActions(prev => {
        if (prev.some(a => a.id === row.id)) return prev;
        return [row, ...prev];
      });
      toast.success(`New action: ${row.title}`);
    }, [toast]),
    onUpdate: useCallback((row: PendingAction) => {
      if (row.status !== 'pending') {
        setActions(prev => prev.filter(a => a.id !== row.id));
      } else {
        setActions(prev => prev.map(a => a.id === row.id ? row : a));
      }
    }, []),
    onDelete: useCallback((row: PendingAction) => {
      setActions(prev => prev.filter(a => a.id !== row.id));
    }, []),
    onPoll: useCallback(() => fetchPendingActions(), []),
  });

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
      const res = await fetch(`${SAMA_API_URL}/api/dashboard/actions/${action.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setActions(prev => prev.filter(a => a.id !== action.id));
        setSelected(prev => { const n = new Set(prev); n.delete(action.id); return n; });
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

  const handleDismiss = async (actionId: string, reason?: string) => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/dashboard/actions/${actionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Dismissed by user' }),
      });
      if (res.ok) {
        setActions(prev => prev.filter(a => a.id !== actionId));
        setSelected(prev => { const n = new Set(prev); n.delete(actionId); return n; });
        toast.success('Action dismissed');
      }
    } catch {
      toast.error('Error dismissing action');
    }
    setDismissReason(null);
  };

  const agents = Array.from(new Set(actions.map(a => a.agent_name)));
  const filtered = filterAgent === "all" ? actions : actions.filter(a => a.agent_name === filterAgent);

  // Bulk actions
  const handleBulkExecute = async () => {
    const toExecute = filtered.filter(a => selected.has(a.id));
    for (const action of toExecute) {
      await handleExecute(action);
    }
    setSelected(new Set());
  };

  const handleBulkDismiss = async () => {
    const toDismiss = [...selected];
    for (const id of toDismiss) {
      await handleDismiss(id, 'Bulk dismissed');
    }
    setSelected(new Set());
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

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Pending Actions</h2>
            <p className="mt-1 text-slate-500 text-sm">
              {actions.length} actions recommended by agents awaiting your review.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <Wifi className="h-3 w-3" />
                Live
              </span>
            )}
          </div>
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

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <span className="text-sm font-medium text-blue-800">{selected.size} selected</span>
            <button
              onClick={handleBulkExecute}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-1"
            >
              <Play className="h-3.5 w-3.5" /> Execute All
            </button>
            <button
              onClick={handleBulkDismiss}
              className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300 flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Dismiss All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-sm text-blue-600 hover:text-blue-800"
            >
              Clear selection
            </button>
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
            {/* Select all */}
            <div className="flex items-center gap-2 px-1">
              <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                {selected.size === filtered.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </button>
              <span className="text-xs text-slate-400">Select all</span>
            </div>

            {filtered.map((action) => {
              const IconComponent = AGENT_ICONS[action.agent_name] || Clock;
              const isSelected = selected.has(action.id);
              return (
                <div
                  key={action.id}
                  className={`rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-300' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <button onClick={() => toggleSelect(action.id)} className="mt-0.5 text-slate-400 hover:text-blue-600 flex-shrink-0">
                        {isSelected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5" />}
                      </button>

                      <div className="rounded-lg bg-slate-100 p-2.5 flex-shrink-0">
                        <IconComponent className="h-5 w-5 text-slate-600" />
                      </div>

                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailAction(action)}>
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
                        onClick={() => setDismissReason({ id: action.id, reason: '' })}
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

        {/* Dismiss Reason Modal */}
        {dismissReason && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Dismiss Action</h3>
              <p className="text-sm text-slate-500 mb-4">Optionally provide a reason — this helps agents learn from your feedback.</p>
              <textarea
                value={dismissReason.reason}
                onChange={(e) => setDismissReason({ ...dismissReason, reason: e.target.value })}
                placeholder="Why are you dismissing this action? (optional)"
                className="w-full rounded-md border p-3 text-sm mb-4 min-h-[80px] focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDismissReason(null)}
                  className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDismiss(dismissReason.id, dismissReason.reason)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Detail Drawer */}
        {detailAction && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setDetailAction(null)}>
            <div className="w-full max-w-lg bg-white shadow-xl h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Action Details</h3>
                <button onClick={() => setDetailAction(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500">Title</label>
                  <p className="text-sm font-semibold text-slate-900">{detailAction.title}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Description</label>
                  <p className="text-sm text-slate-700">{detailAction.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Agent</label>
                    <p className="text-sm text-slate-700 capitalize">{detailAction.agent_name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Priority</label>
                    <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[detailAction.priority] || PRIORITY_STYLES.medium}`}>
                      {detailAction.priority}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Type</label>
                    <p className="text-sm text-slate-700">{detailAction.action_type}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Created</label>
                    <p className="text-sm text-slate-700">{new Date(detailAction.created_at).toLocaleString()}</p>
                  </div>
                </div>
                {detailAction.keyword && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Keyword</label>
                    <p className="text-sm text-slate-700">{detailAction.keyword}</p>
                  </div>
                )}
                {detailAction.competitor && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Competitor</label>
                    <p className="text-sm text-slate-700">{detailAction.competitor}</p>
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => { handleExecute(detailAction); setDetailAction(null); }}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4" /> Execute
                </button>
                <button
                  onClick={() => { setDismissReason({ id: detailAction.id, reason: '' }); setDetailAction(null); }}
                  className="flex-1 rounded-md bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
