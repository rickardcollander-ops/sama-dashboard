"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload, Loader2, AlertCircle, CheckCircle2, X, Plus, Phone,
  ArrowLeft, Trash2, ChevronRight, FileSpreadsheet, Link2,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { isAdminEmail } from "@/lib/admin";

interface CampaignRow {
  id: string;
  name: string;
  source_filename: string | null;
  status: "pending" | "running" | "completed" | "failed";
  total_leads: number;
  audited_leads: number;
  failed_leads: number;
  created_at: string;
  updated_at: string;
}

const STATUS_TONE: Record<CampaignRow["status"], string> = {
  pending: "bg-slate-100 text-slate-600",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CampaignsListPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const isAdmin = isAdminEmail(user?.email);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    setError("");
    try {
      const res = await fetch("/api/admin/campaigns", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { campaigns: CampaignRow[] };
      setCampaigns(body.campaigns);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load campaigns");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/c/login"); return; }
    if (!isAdmin) { router.push("/c/dashboard"); return; }
    void load();
  }, [user, loading, isAdmin, router, load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const handleDelete = async (c: CampaignRow) => {
    if (!confirm(`Delete campaign "${c.name}" and all ${c.total_leads} leads?`)) return;
    try {
      const res = await fetch(`/api/admin/campaigns/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
      setNotice(`Deleted "${c.name}"`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  };

  if (loading || (!user && !loading) || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      {showImport && (
        <ImportCampaignModal
          onClose={() => setShowImport(false)}
          onImported={(campaignId, inserted) => {
            setShowImport(false);
            setNotice(`Imported ${inserted} leads. Audits queued.`);
            void load();
            router.push(`/c/admin/campaigns/${campaignId}`);
          }}
          onError={(msg) => {
            setShowImport(false);
            setError(msg);
          }}
        />
      )}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <Link
            href="/c/admin"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
        </div>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-slate-900">
              <Phone className="h-7 w-7 text-violet-600" />
              Telemarketing campaigns
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Import an Apollo CSV, run a site-audit per company, and download a per-lead PDF report ready to email.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const url = `${window.location.origin}/tm`;
                void navigator.clipboard.writeText(url);
                setNotice(`TM-portallänk kopierad: ${url}`);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
              title="Kopiera länk till den externa TM-portalen — dela med operatörer som ska arbeta listan."
            >
              <Link2 className="h-4 w-4" /> Kopiera TM-portallänk
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" /> Import Apollo CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {notice && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fetching && campaigns.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
              )}
              {!fetching && campaigns.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 font-medium text-slate-700">No campaigns yet</p>
                  <p className="mt-1 text-xs text-slate-400">Click &ldquo;Import Apollo CSV&rdquo; to upload your first list.</p>
                </td></tr>
              )}
              {campaigns.map((c) => {
                const pct = c.total_leads > 0
                  ? Math.round(((c.audited_leads + c.failed_leads) / c.total_leads) * 100)
                  : 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/c/admin/campaigns/${c.id}`} className="block">
                        <div className="font-medium text-slate-900 hover:text-violet-700">{c.name}</div>
                        {c.source_filename && (
                          <div className="text-xs text-slate-400">{c.source_filename}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full transition-all ${
                              c.status === "failed"
                                ? "bg-rose-500"
                                : c.status === "completed"
                                ? "bg-emerald-500"
                                : "bg-violet-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {c.audited_leads}/{c.total_leads}
                          {c.failed_leads > 0 && (
                            <span className="ml-1 text-rose-500">({c.failed_leads} failed)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_TONE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="text-xs text-slate-400">{fmtRelative(c.created_at)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/c/admin/campaigns/${c.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100"
                        >
                          Open <ChevronRight className="h-3 w-3" />
                        </Link>
                        <button
                          onClick={() => void handleDelete(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

// ── Import modal ─────────────────────────────────────────────────────────────

function ImportCampaignModal({
  onClose, onImported, onError,
}: {
  onClose: () => void;
  onImported: (campaignId: string, inserted: number) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !file) return;
    setSubmitting(true);
    try {
      const csv = await file.text();
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), csv, source_filename: file.name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      onImported(body.campaign_id, body.inserted ?? 0);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Import Apollo CSV</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Campaign name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q2 SaaS prospects — Sweden"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Apollo CSV file</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-sm text-slate-600 hover:bg-slate-100"
            >
              <Upload className="h-4 w-4" />
              {file ? file.name : "Choose CSV…"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-2 text-xs text-slate-400">
              Apollo&apos;s standard &ldquo;Export contacts&rdquo; CSV works. Required: a column with the company website (Website, Domain, or URL).
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!name.trim() || !file || submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {submitting ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
