"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

interface LogEntry {
  id: string;
  agent: string;
  action: string;
  status: "success" | "error" | "warning";
  timestamp: string;
  details: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading logs
    setTimeout(() => {
      setLogs([
        {
          id: "1",
          agent: "SEO Agent",
          action: "GSC Data Fetch",
          status: "success",
          timestamp: "2 minutes ago",
          details: "Fetched 34 clicks, 117 impressions from Google Search Console",
        },
        {
          id: "2",
          agent: "Social Agent",
          action: "Twitter Auth",
          status: "success",
          timestamp: "5 minutes ago",
          details: "Authenticated as @successifier",
        },
        {
          id: "3",
          agent: "Ads Agent",
          action: "Campaign Fetch",
          status: "warning",
          timestamp: "10 minutes ago",
          details: "No active campaigns found in Google Ads account",
        },
        {
          id: "4",
          agent: "SEO Agent",
          action: "PageSpeed Audit",
          status: "success",
          timestamp: "15 minutes ago",
          details: "Performance score: 92/100",
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

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
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">Activity Logs</h1>
            </Link>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Agent Activity</h2>
          <p className="mt-2 text-slate-600">Real-time logs from all SAMA 2.0 agents</p>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-lg border bg-white p-8 text-center">
              <p className="text-slate-500">Loading logs...</p>
            </div>
          ) : (
            logs.map((log) => (
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

        <div className="mt-8 flex justify-center">
          <button className="rounded-lg border bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">
            Load More
          </button>
        </div>
      </main>
    </div>
  );
}
