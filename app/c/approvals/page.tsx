"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, Loader2, ShieldCheck, FileText, Share2, Star, AlertTriangle,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";

interface Approval {
  id: string;
  kind: string;
  channel: string | null;
  agent_name: string | null;
  title: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewer_note: string | null;
}

const KIND_ICON: Record<string, typeof FileText> = {
  content: FileText,
  social: Share2,
  reviews_response: Star,
};

export default function ApprovalsPage() {
  const { user, loading: userLoading } = useUser();
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [edited, setEdited] = useState<{ title: string; body: string }>({ title: "", body: "" });
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  const load = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/approvals?status=${tab}`, {
        headers: { "X-Tenant-ID": user.id },
      });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { approvals: Approval[] };
      setApprovals(data.approvals || []);
    } catch {
      setError("Kunde inte hämta utkast.");
      setApprovals([]);
    }
  };

  useEffect(() => {
    setApprovals(null);
    setError("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab]);

  const decide = async (id: string, action: "approve" | "reject", note?: string) => {
    if (!user) return;
    setWorking(id);
    setError("");
    try {
      const res = await fetch(`/api/approvals/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": user.id },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error("decide failed");
      await load();
    } catch {
      setError(action === "approve" ? "Kunde inte godkänna utkastet." : "Kunde inte avvisa utkastet.");
    }
    setWorking(null);
  };

  const saveEdit = async (id: string) => {
    if (!user) return;
    setWorking(id);
    try {
      await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": user.id },
        body: JSON.stringify({ title: edited.title, body: edited.body }),
      });
      setEditing(null);
      await load();
    } catch {
      setError("Kunde inte spara ändringen.");
    }
    setWorking(null);
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerNav />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            Att godkänna
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Utkast som dina agenter har förberett — granska innan publicering.
          </p>
        </div>

        <div className="mb-4 flex gap-1 border-b border-slate-200">
          {(["pending", "approved", "rejected"] as const).map((t) => {
            const label = t === "pending" ? "Väntar" : t === "approved" ? "Godkända" : "Avvisade";
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t ? "text-emerald-700" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
                {tab === t && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-emerald-600 rounded-t-sm" />}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {approvals === null ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center text-slate-500">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">
              {tab === "pending"
                ? "Inga utkast väntar på granskning."
                : tab === "approved"
                  ? "Inga godkända utkast."
                  : "Inga avvisade utkast."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {approvals.map((a) => {
              const Icon = KIND_ICON[a.kind] || FileText;
              const isEditing = editing === a.id;
              return (
                <li key={a.id} className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <span className="capitalize">{a.kind}</span>
                        {a.channel && <span>· {a.channel}</span>}
                        <span>· {new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            value={edited.title}
                            onChange={(e) => setEdited({ ...edited, title: e.target.value })}
                            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium"
                          />
                          <textarea
                            value={edited.body}
                            onChange={(e) => setEdited({ ...edited, body: e.target.value })}
                            rows={6}
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                      ) : (
                        <>
                          {a.title && <h3 className="font-semibold text-slate-900">{a.title}</h3>}
                          {a.body && (
                            <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap line-clamp-6">
                              {a.body}
                            </p>
                          )}
                        </>
                      )}
                      {a.reviewer_note && (
                        <p className="mt-2 text-xs italic text-slate-500">Notering: {a.reviewer_note}</p>
                      )}
                    </div>
                  </div>

                  {tab === "pending" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => decide(a.id, "approve")}
                            disabled={working === a.id}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {working === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Godkänn & publicera
                          </button>
                          <button
                            onClick={() => decide(a.id, "reject")}
                            disabled={working === a.id}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Avvisa
                          </button>
                          <button
                            onClick={() => {
                              setEditing(a.id);
                              setEdited({ title: a.title || "", body: a.body || "" });
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Redigera
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => saveEdit(a.id)}
                            disabled={working === a.id}
                            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                          >
                            Spara
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Avbryt
                          </button>
                        </>
                      )}
                    </div>
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
