"use client";

import { useState, useMemo } from "react";
import { Activity, CheckCircle, XCircle, AlertCircle, Search } from "lucide-react";
import { useActivityLogs } from "@/lib/hooks/useActivityLogs";

interface LogEntry {
  id: string;
  agent: string;
  action: string;
  status: "success" | "error" | "warning";
  timestamp: string;
  details: string;
}

export default function LogsPage() {
  const { loading, logs, loadMore, hasMore } = useActivityLogs();
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const uniqueAgents = useMemo(() => {
    const agents = new Set(logs.map((l: LogEntry) => l.agent));
    return Array.from(agents).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log: LogEntry) => {
      const matchesAgent = agentFilter === 'all' || log.agent === agentFilter;
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || log.action.toLowerCase().includes(q) || log.details.toLowerCase().includes(q) || log.agent.toLowerCase().includes(q);
      return matchesAgent && matchesStatus && matchesSearch;
    });
  }, [logs, agentFilter, statusFilter, searchQuery]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Activity className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-50 text-green-700 border-green-200";
      case "error":
        return "bg-red-50 text-red-700 border-red-200";
      case "warning":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Activity Logs</h2>
          <p className="mt-1 text-slate-500 text-sm">Complete execution history from all agents. Every analysis, content generation, ad optimization, and review response is logged here with timestamps and results.</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3 items-center rounded-lg border bg-white p-4 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Agents</option>
            {uniqueAgents.map(agent => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
          {(searchQuery || agentFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setAgentFilter('all'); setStatusFilter('all'); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear Filters
            </button>
          )}
          <span className="text-xs text-slate-400">{filteredLogs.length} of {logs.length} entries</span>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-lg border bg-white p-8 text-center">
              <p className="text-slate-500">Loading logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-lg border bg-white p-8 text-center">
              <p className="text-slate-500">No logs match your filters.</p>
            </div>
          ) : (
            filteredLogs.map((log: LogEntry) => (
              <div key={log.id} className="rounded-lg border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">{log.agent}</h3>
                        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-700">{log.action}</p>
                      <p className="mt-1 text-sm text-slate-500">{log.details}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400">{log.timestamp}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={loadMore}
              className="rounded-lg border bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Load More
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
