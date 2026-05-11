"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  Phone,
  ChevronRight,
  FileSpreadsheet,
  LogOut,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

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
  if (mins < 1) return "just nu";
  if (mins < 60) return `${mins}m sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sedan`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d sedan`;
  return new Date(iso).toLocaleDateString();
}

export default function TmCampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setFetching(true);
    setError("");
    try {
      const res = await fetch("/api/tm/campaigns", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/tm/login");
        return;
      }
      if (res.status === 403) {
        setError("Ditt konto har inte tillgång till TM-portalen.");
        setFetching(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { campaigns: CampaignRow[] };
      setCampaigns(body.campaigns);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ladda kampanjer");
    } finally {
      setFetching(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSignOut = async () => {
    await getSupabaseBrowser().auth.signOut();
    router.push("/tm/login");
  };

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-slate-900">
            <Phone className="h-7 w-7 text-violet-600" />
            TM-kampanjlistor
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Logga ringningar, uppdatera status och anteckningar per kontakt.
          </p>
        </div>
        <button
          onClick={() => void handleSignOut()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <LogOut className="h-3.5 w-3.5" /> Logga ut
        </button>
      </header>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Kampanj</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Skapad</th>
              <th className="px-4 py-3 text-right">Öppna</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fetching && campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {!fetching && campaigns.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 font-medium text-slate-700">Inga kampanjer ännu</p>
                  <p className="mt-1 text-xs text-slate-400">
                    En admin importerar kampanjlistor i administrationsvyn.
                  </p>
                </td>
              </tr>
            )}
            {campaigns.map((c) => {
              const pct =
                c.total_leads > 0
                  ? Math.round(((c.audited_leads + c.failed_leads) / c.total_leads) * 100)
                  : 0;
              return (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/tm/${c.id}`} className="block">
                      <div className="font-medium text-slate-900 hover:text-violet-700">
                        {c.name}
                      </div>
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
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_TONE[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="text-xs text-slate-400">{fmtRelative(c.created_at)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Link
                        href={`/tm/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100"
                      >
                        Öppna <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
