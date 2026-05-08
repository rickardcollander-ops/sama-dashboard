"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowRight, RefreshCw, Clock } from "lucide-react";
import { SAMA_API_URL } from "@/lib/api";

interface ApprovalRow {
  id: string;
  kind: string;
  channel?: string;
  agent_name?: string;
  title: string;
  body?: string;
  status: string;
  created_at: string;
  metadata?: Record<string, unknown> & { piece_id?: string; score?: number; min_score?: number };
}

/**
 * Renders content drafts that landed in pending_approvals (kind='content'),
 * typically from the autopilot when auto_publish=false. Each row links
 * straight to /content/<piece_id> where the user reviews + clicks
 * "Approve & Publish" — that endpoint flips this row to 'published' too.
 */
export default function ContentApprovalsSection() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/approvals?status=pending&limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      const list: ApprovalRow[] = Array.isArray(data.approvals) ? data.approvals : [];
      setRows(list.filter(r => r.kind === "content" && r.metadata?.piece_id));
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, []);

  if (loading || rows.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50/40 shadow-sm">
      <div className="flex items-center justify-between border-b border-purple-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-purple-700" />
          <h3 className="text-sm font-semibold text-purple-900">
            Auto-pilot drafts awaiting review · {rows.length}
          </h3>
        </div>
        <button
          onClick={fetchRows}
          className="rounded p-1.5 text-purple-600 hover:bg-purple-100"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <ul className="divide-y divide-purple-100">
        {rows.map(row => {
          const pieceId = row.metadata?.piece_id as string | undefined;
          const score = (row.metadata?.score as number | undefined) ?? null;
          const minScore = (row.metadata?.min_score as number | undefined) ?? 70;
          const passes = score !== null && score >= minScore;
          return (
            <li key={row.id} className="flex items-center gap-3 px-5 py-3">
              <FileText className="h-4 w-4 flex-shrink-0 text-purple-600" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{row.title}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-purple-700">
                    {row.channel?.replace(/_/g, " ") || "draft"}
                  </span>
                  {score !== null && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      passes ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      score {score}/{minScore}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {new Date(row.created_at).toLocaleString()}
                  {row.agent_name && <span className="ml-2 italic">via {row.agent_name}</span>}
                </p>
              </div>
              {pieceId ? (
                <Link
                  href={`/content/${pieceId}`}
                  className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
                >
                  Open in editor <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <span className="text-xs italic text-slate-400">no piece linked</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
